import secureSession from '@fastify/secure-session';
import Fastify, {
	type FastifyInstance,
	type FastifyRequest,
	type FastifyServerOptions,
} from 'fastify';

import { sanitizeDatabaseError, type DatabasePool } from './database.js';

import type { ObjectStore } from './object-store.js';

import {
	resolveProjectLifecyclePolicy,
	type ProjectLifecyclePolicy,
} from './project-write-lease.js';

import type { TestAuthOptions } from './test-auth.js';
import { errorBody } from './http.js';
import { registerAssetRoutes } from './routes/assets.js';
import { registerAuthRoutes } from './routes/auth.js';
import type { RouteDeps } from './routes/deps.js';
import { registerLibraryRoutes } from './routes/library.js';
import { registerModelRoutes } from './routes/models.js';
import { registerProjectRoutes } from './routes/projects.js';
import { registerPublicationRoutes } from './routes/publications.js';
import { registerSaveRoutes } from './routes/saves.js';

export type ApiAppOptions = {
	pool: DatabasePool;
	apiOrigin?: string;
	editorOrigin?: string;
	sessionKey?: Buffer;
	objectStore?: ObjectStore;
	/** Deployment-owned key namespace; production passes `R2_OBJECT_NAMESPACE`. */
	objectNamespace?: string;
	logger?: FastifyServerOptions['logger'];
	/** Trusted proxy addresses/CIDRs; unset ignores forwarded headers. */
	trustProxy?: FastifyServerOptions['trustProxy'];
	/** Timeout/clock injection seam for deterministic lifecycle fault tests. */
	projectLifecyclePolicy?: Partial<ProjectLifecyclePolicy>;
	/**
	 * Test-only authentication issuer. When present (and sessions are
	 * enabled) a single `POST /test-auth/session` route is registered that
	 * mints the canonical session for an allowlisted automation identity.
	 * Absent by default — production construction never sets it, so the
	 * route does not exist there (Fastify answers 404).
	 */
	testAuth?: TestAuthOptions;
};

const BODY_LIMIT_BYTES = 2 * 1024 * 1024;
const SESSION_EXPIRY_SECONDS = 7 * 24 * 60 * 60;
const SESSION_NAME = 'session';
const SESSION_COOKIE_NAME = 'museum-editor-session';

export function createApp({
	pool,
	apiOrigin,
	editorOrigin,
	sessionKey,
	objectStore,
	objectNamespace = 'default',
	testAuth,
	projectLifecyclePolicy,
	trustProxy,
	logger = true,
}: ApiAppOptions): FastifyInstance {
	const lifecyclePolicy = resolveProjectLifecyclePolicy(projectLifecyclePolicy);
	const safeLogger =
		logger === true
			? { serializers: { req: safeRequestLog } }
			: logger && typeof logger === 'object'
				? { ...logger, serializers: { ...logger.serializers, req: safeRequestLog } }
				: logger;
	const app = Fastify({ logger: safeLogger, bodyLimit: BODY_LIMIT_BYTES, trustProxy });
	const sessionsEnabled = sessionKey !== undefined;
	const expectedBrowserOrigin = editorOrigin ?? apiOrigin;
	app.addContentTypeParser(
		'application/octet-stream',
		async (_request: FastifyRequest, payload: FastifyRequest['raw']) => payload,
	);

	if (sessionKey !== undefined) {
		app.register(secureSession, {
			sessionName: SESSION_NAME,
			cookieName: SESSION_COOKIE_NAME,
			key: sessionKey,
			expiry: SESSION_EXPIRY_SECONDS,
			cookie: {
				path: '/',
				httpOnly: true,
				secure: true,
				sameSite: 'lax',
				maxAge: SESSION_EXPIRY_SECONDS,
			},
		});
	}

	pool.on?.('error', (error) => {
		app.log.error({ database: sanitizeDatabaseError(error) }, 'Database pool error');
	});

	let poolClose: Promise<void> | undefined;
	let objectStoreClose: Promise<void> | undefined;
	app.addHook('onClose', async () => {
		poolClose ??= Promise.resolve().then(() => pool.end());
		if (objectStore?.close) {
			objectStoreClose ??= Promise.resolve()
				.then(() => objectStore.close?.())
				.then(() => undefined);
		}
		await Promise.all([poolClose, objectStoreClose]);
	});

	if (editorOrigin || apiOrigin) {
		app.addHook('onRequest', async (request, reply) => {
			const origin = request.headers.origin;
			if (origin === expectedBrowserOrigin) {
				reply
					.header('Access-Control-Allow-Origin', origin)
					.header('Access-Control-Allow-Credentials', 'true')
					.header('Vary', 'Origin')
					.header('Access-Control-Allow-Methods', 'GET, PUT, POST, PATCH, DELETE, OPTIONS')
					.header('Access-Control-Allow-Headers', 'Content-Type')
					// My Objects reads these headers to verify the item it listed.
					.header(
						'Access-Control-Expose-Headers',
						'ETag, X-Library-Format-Version, X-Library-Kind',
					);
			}
			if (request.method === 'OPTIONS') {
				if (!origin || origin !== expectedBrowserOrigin) {
					return reply.code(403).send(errorBody('forbidden', 'Forbidden'));
				}
				return reply.code(204).send();
			}
			const unsafeBrowserRequest = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method);
			if (unsafeBrowserRequest && expectedBrowserOrigin && origin !== expectedBrowserOrigin) {
				return reply.code(403).send(errorBody('forbidden', 'Forbidden'));
			}
		});
	}

	app.get('/health/live', async () => ({ status: 'ok' }));
	app.get('/health/ready', async (_request, reply) => {
		try {
			await pool.query('SELECT 1');
			return { status: 'ok' };
		} catch (error) {
			app.log.warn({ database: sanitizeDatabaseError(error) }, 'Database readiness check failed');
			return reply.code(503).send({ status: 'unavailable' });
		}
	});

	app.setErrorHandler((error, request, reply) => {
		const code = (error as { code?: unknown }).code;
		if (code === 'FST_ERR_CTP_BODY_TOO_LARGE') {
			return reply.code(413).send(errorBody('payload_too_large', 'Payload Too Large'));
		}
		if (code === 'FST_ERR_CTP_INVALID_JSON_BODY') {
			return reply.code(400).send(errorBody('invalid_json', 'Malformed JSON body'));
		}
		if (code === 'FST_ERR_CTP_EMPTY_JSON_BODY') {
			const isAssetRegistration =
				request.url.startsWith('/projects/') && request.url.includes('/assets');
			return reply
				.code(400)
				.send(
					errorBody(isAssetRegistration ? 'invalid_asset' : 'invalid_json', 'Malformed JSON body'),
				);
		}
		if (code === 'FST_ERR_CTP_INVALID_MEDIA_TYPE') {
			return reply.code(415).send(errorBody('unsupported_media_type', 'Unsupported Media Type'));
		}
		if (code === 'FST_ERR_CTP_INVALID_CONTENT_LENGTH') {
			return reply.code(400).send(errorBody('invalid_upload', 'Invalid upload length'));
		}
		return reply.code(500).send(errorBody('internal_error', 'Internal Server Error'));
	});

	const deps: RouteDeps = {
		app,
		pool,
		sessionsEnabled,
		objectStore,
		objectNamespace,
		lifecyclePolicy,
		testAuth,
		authState: { busy: false },
	};

	registerAuthRoutes(deps);
	registerProjectRoutes(deps);
	registerSaveRoutes(deps);
	registerPublicationRoutes(deps);
	registerModelRoutes(deps);
	registerLibraryRoutes(deps);
	registerAssetRoutes(deps);

	return app;
}

function safeRequestLog(request: { method?: string; url?: string }) {
	return { method: request.method, url: request.url?.split('?', 1)[0] };
}
