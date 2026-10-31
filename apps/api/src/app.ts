import secureSession from '@fastify/secure-session';
import Fastify, {
	type FastifyInstance,
	type FastifyReply,
	type FastifyRequest,
	type FastifyServerOptions
} from 'fastify';
import { Readable } from 'node:stream';

import { admitAuthAttempt, enrollCredentials, findCredentials, hasCredentials, isSessionUserId, readCredentials, verifyPassword } from './auth.js';
import { sanitizeDatabaseError, type DatabasePool } from './database.js';
import {
	assetMetadata,
	AssetInputError,
	AssetNotFoundError,
	AssetNotReadyError,
	isValidAssetId,
	isValidProjectId,
	listAssets,
	MAX_ASSET_BYTES,
	readAsset,
	readAssetNameBody,
	registerAsset,
	uploadAsset
} from './asset-persistence.js';
import {
	ActivePublicationDeleteError,
	deleteProject as deleteProjectLifecycle,
	parseDeleteProjectRequest,
	parseRenameProjectRequest,
	ProjectDeletionBusyError,
	ProjectLifecycleInputError,
	renameProject as renameProjectLifecycle
} from './project-lifecycle.js';
import {
	approveModelImport,
	cancelModelImport,
	createModelImport,
	ModelInputError,
	ModelNotFoundError,
	ModelPinRefusalError,
	readModelRevisionContent,
	uploadModelFile
} from './model-persistence.js';
import {
	FormLibraryInputError,
	FormLibraryNotFoundError,
	listFormLibraryItems,
	readFormLibraryItem,
	removeFormLibraryItem,
	saveFormLibraryItem
} from './form-library.js';
import type { ObjectStore } from './object-store.js';
import { listProjects, loadProject, ProjectNotFoundError } from './project-persistence.js';
import { SaveRefusalError, saveAcceptedSource } from './save-persistence.js';
import {
	ProjectWriteAbortedError,
	resolveProjectLifecyclePolicy,
	type ProjectLifecyclePolicy
} from './project-write-lease.js';
import {
	getPublicationStatus,
	PublicationConflictError,
	PublicationNotFoundError,
	unpublishVersion
} from './publication-persistence.js';
import {
	isValidTestAuthSecret,
	readTestAuthBearer,
	readTestAuthTarget,
	resolveTestAuthUserId,
	type TestAuthOptions
} from './test-auth.js';
import { readSaveRequest } from '@portfolio/project-model/save';
import { MODEL_SOURCE_SET_MAX_BYTES, validateProjectEnvelope } from '@portfolio/project-model/units';

export type ApiAppOptions = {
	pool: DatabasePool;
	apiOrigin?: string;
	editorOrigin?: string;
	sessionKey?: Buffer;
	objectStore?: ObjectStore;
	/** Deployment-owned key namespace; production passes `R2_OBJECT_NAMESPACE`. */
	objectNamespace?: string;
	logger?: FastifyServerOptions['logger'];
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
	logger = true
}: ApiAppOptions): FastifyInstance {
	const lifecyclePolicy = resolveProjectLifecyclePolicy(projectLifecyclePolicy);
	const safeLogger =
		logger === true
			? { serializers: { req: safeRequestLog } }
			: logger && typeof logger === 'object'
				? { ...logger, serializers: { ...logger.serializers, req: safeRequestLog } }
				: logger;
	const app = Fastify({ logger: safeLogger, bodyLimit: BODY_LIMIT_BYTES });
	const sessionsEnabled = sessionKey !== undefined;
	const expectedBrowserOrigin = editorOrigin ?? apiOrigin;
	app.addContentTypeParser(
		'application/octet-stream',
		async (_request: FastifyRequest, payload: FastifyRequest['raw']) => payload
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
				maxAge: SESSION_EXPIRY_SECONDS
			}
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
			objectStoreClose ??= Promise.resolve().then(() => objectStore.close?.()).then(() => undefined);
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
					// My Objects reads these two headers to verify the item it listed.
					.header('Access-Control-Expose-Headers', 'ETag, X-Library-Format-Version');
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
			app.log.warn(
				{ database: sanitizeDatabaseError(error) },
				'Database readiness check failed'
			);
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
			const isAssetRegistration = request.url.startsWith('/projects/') && request.url.includes('/assets');
			return reply
				.code(400)
				.send(errorBody(isAssetRegistration ? 'invalid_asset' : 'invalid_json', 'Malformed JSON body'));
		}
		if (code === 'FST_ERR_CTP_INVALID_MEDIA_TYPE') {
			return reply.code(415).send(errorBody('unsupported_media_type', 'Unsupported Media Type'));
		}
		if (code === 'FST_ERR_CTP_INVALID_CONTENT_LENGTH') {
			return reply.code(400).send(errorBody('invalid_upload', 'Invalid upload length'));
		}
		return reply.code(500).send(errorBody('internal_error', 'Internal Server Error'));
	});

	// Bound memory-hard work without an unbounded request queue.
	let authBusy = false;
	for (const action of ['register', 'login', 'credentials'] as const) {
		app.post(`/auth/${action}`, { bodyLimit: 2048 }, async (request, reply) => {
			reply.header('Cache-Control', 'no-store');
			if (!sessionsEnabled) return authUnavailable(reply);
			const existingUserId = sessionUserId(request, sessionsEnabled);
			if (action === 'credentials' && !existingUserId) return unauthorized(reply);
			const credentials = readCredentials(request.body);
			if (!credentials) return reply.code(400).send(errorBody('invalid_credentials', 'Use a 3–32 character username and an 8–128 character password'));
			if (authBusy) return reply.header('Retry-After', '1').code(429).send(errorBody('auth_busy', 'Try again shortly'));
			authBusy = true;
			try {
				if (!await admitAuthAttempt(pool, request.ip, credentials.username)) {
					return reply.header('Retry-After', '900').code(429).send(errorBody('rate_limited', 'Too many attempts; try again later'));
				}
				let userId: string;
				if (action === 'login') {
					const account = await findCredentials(pool, credentials.username);
					if (!await verifyPassword(credentials.password, account?.password_hash)) {
						return reply.code(401).send(errorBody('invalid_login', 'Username or password is incorrect'));
					}
					userId = account!.user_id;
				} else {
					userId = await enrollCredentials(pool, credentials, action === 'credentials' ? existingUserId! : undefined);
				}
				appSession(request).regenerate();
				appSession(request).set('userId', userId);
				return reply.code(action === 'login' ? 200 : 201).send({ authenticated: true, user: { id: userId } });
			} catch (error) {
				if ((error as { code?: string }).code === '23505') {
					return reply.code(409).send(errorBody('credentials_unavailable', 'Username or account is already registered'));
				}
				return databaseFailure(app, reply, error, 'Local authentication failed');
			} finally {
				authBusy = false;
			}
		});
	}
	app.get('/auth/credentials', async (request, reply) => {
		reply.header('Cache-Control', 'no-store');
		const userId = sessionUserId(request, sessionsEnabled);
		if (!userId) return unauthorized(reply);
		try { return { enrolled: await hasCredentials(pool, userId) }; }
		catch (error) { return databaseFailure(app, reply, error, 'Credential status failed'); }
	});

	app.get('/auth/me', async (request, reply) => {
		reply.header('Cache-Control', 'no-store');
		const userId = sessionUserId(request, sessionsEnabled);
		app.log.info(
			{
				auth: {
					stage: 'session',
					hasCookie: request.headers.cookie?.includes(`${SESSION_COOKIE_NAME}=`) ?? false,
					authenticated: Boolean(userId)
				}
			},
			'Authentication session checked'
		);
		return userId
			? { authenticated: true, user: { id: userId } }
			: { authenticated: false };
	});

	app.post('/auth/logout', async (request, reply) => {
		if (sessionsEnabled) appSession(request).delete();
		return reply.code(204).send();
	});

	// Test-only authentication seam. Structural isolation: this route exists
	// only when the server was constructed with a test-auth secret and real
	// sessions. Otherwise POSTs fall through to Fastify's default 404, so
	// production has no login path here at all.
	if (testAuth && testAuth.secret.length > 0 && sessionsEnabled) {
		const testAuthSecret = testAuth.secret;
		app.post('/test-auth/session', async (request, reply) => {
			const secret = readTestAuthBearer(request.headers.authorization);
			if (!isValidTestAuthSecret(secret, testAuthSecret)) return unauthorized(reply);
			const target = readTestAuthTarget(request.body);
			if (!target) return reply.code(400).send(errorBody('invalid_body', 'Expected a test user body'));
			const userId = resolveTestAuthUserId(target.user);
			if (!userId) return reply.code(400).send(errorBody('unknown_test_user', 'Unknown test user'));
			// The canonical session creation path — identical to local login
			// issuance after credential verification. Everything downstream
			// (ownership, permission checks, persistence) sees a normal user.
			appSession(request).regenerate();
			appSession(request).set('userId', userId);
			return reply.code(201).send({ authenticated: true, user: { id: userId } });
		});
	}

	app.get('/projects', async (request, reply) => {
		const userId = sessionUserId(request, sessionsEnabled);
		if (!userId) return unauthorized(reply);
		try {
			return { projects: await listProjects(pool, userId) };
		} catch (error) {
			return databaseFailure(app, reply, error, 'Project list failed');
		}
	});

	app.put('/projects/:projectId', async (request, reply) => {
		const userId = sessionUserId(request, sessionsEnabled);
		if (!userId) return unauthorized(reply);
		const projectId = (request.params as { projectId?: unknown }).projectId;
		const body = request.body;
		if (typeof projectId !== 'string' || !projectId) {
			return reply.code(400).send(errorBody('invalid_project_id', 'Invalid project ID'));
		}
		// The unconditional document body is the old client. Refuse it with no
		// write and no implicit create rather than accepting an overwrite.
		if (isUnconditionedDocumentBody(body)) {
			return reply
				.code(400)
				.send(errorBody('precondition_required', 'Save requires a create-only or expected-saved-base precondition'));
		}
		const parsed = readSaveRequest(body);
		if (parsed.kind === 'invalid') {
			return reply.code(400).send({
				error: { code: 'invalid_save_request', message: 'Invalid SaveAcceptedSource@1 request' },
				issues: parsed.issues
			});
		}
		if (parsed.request.capture.projectId !== projectId) {
			return reply.code(400).send(errorBody('project_id_mismatch', 'Project ID does not match captured project ID'));
		}
		try {
			return await saveAcceptedSource(pool, userId, parsed.request);
		} catch (error) {
			if (error instanceof ProjectNotFoundError) return notFound(reply);
			if (error instanceof SaveRefusalError || error instanceof ModelPinRefusalError) return saveRefusal(reply, error);
			return databaseFailure(app, reply, error, 'Project save failed');
		}
	});

	app.patch('/projects/:projectId', async (request, reply) => {
		const userId = sessionUserId(request, sessionsEnabled);
		if (!userId) return unauthorized(reply);
		const projectId = (request.params as { projectId?: unknown }).projectId;
		if (!isValidProjectId(projectId)) {
			return reply.code(400).send(errorBody('invalid_project_id', 'Invalid project ID'));
		}
		const parsed = parseRenameProjectRequest(request.body);
		if (parsed.kind === 'invalid') return reply.code(400).send(errorBody(parsed.code, parsed.message));
		try {
			return await renameProjectLifecycle(pool, userId, projectId, parsed.request);
		} catch (error) {
			if (error instanceof ProjectNotFoundError) return notFound(reply);
			if (error instanceof SaveRefusalError) return saveRefusal(reply, error);
			if (error instanceof ProjectLifecycleInputError) {
				return reply.code(error.statusCode).send(errorBody(error.code, error.message));
			}
			return databaseFailure(app, reply, error, 'Project rename failed');
		}
	});

	app.delete('/projects/:projectId', async (request, reply) => {
		const userId = sessionUserId(request, sessionsEnabled);
		if (!userId) return unauthorized(reply);
		const projectId = (request.params as { projectId?: unknown }).projectId;
		if (!isValidProjectId(projectId)) {
			return reply.code(400).send(errorBody('invalid_project_id', 'Invalid project ID'));
		}
		const parsed = parseDeleteProjectRequest(request.body);
		if (parsed.kind === 'invalid') return reply.code(400).send(errorBody(parsed.code, parsed.message));
		if (!objectStore?.list || !objectStore.delete) {
			return reply.code(503).send(errorBody('storage_unavailable', 'Project cleanup is temporarily unavailable'));
		}
		try {
			const acknowledgement = await deleteProjectLifecycle(
				pool,
				userId,
				projectId,
				parsed.request,
				objectNamespace,
				objectStore,
				lifecyclePolicy
			);
			return reply.code(acknowledgement.cleanup === 'complete' ? 200 : 202).send(acknowledgement);
		} catch (error) {
			if (error instanceof ProjectNotFoundError) return notFound(reply);
			if (error instanceof SaveRefusalError) return saveRefusal(reply, error);
			if (error instanceof ActivePublicationDeleteError) {
				return reply.code(409).send(errorBody(error.code, error.message));
			}
			if (error instanceof ProjectDeletionBusyError) {
				return reply.code(409).send(errorBody(error.code, error.message));
			}
			return databaseFailure(app, reply, error, 'Project deletion failed');
		}
	});

	app.get('/projects/:projectId', async (request, reply) => {
		const userId = sessionUserId(request, sessionsEnabled);
		if (!userId) return unauthorized(reply);
		const projectId = (request.params as { projectId?: unknown }).projectId;
		if (typeof projectId !== 'string' || !projectId) {
			return reply.code(400).send(errorBody('invalid_project_id', 'Invalid project ID'));
		}
		try {
			const loaded = await loadProject(pool, userId, projectId);
			const validation = validateProjectEnvelope(loaded.document);
			if (!validation.success || validation.envelope.id !== projectId) {
				return databaseFailure(app, reply, new Error('Stored project failed validation'), 'Stored project failed validation');
			}
			return { ...loaded, document: validation.envelope };
		} catch (error) {
			if (error instanceof ProjectNotFoundError) return notFound(reply);
			return databaseFailure(app, reply, error, 'Project load failed');
		}
	});

	const requireAssetSession = async (request: FastifyRequest, reply: FastifyReply) => {
		if (!sessionUserId(request, sessionsEnabled)) return unauthorized(reply);
	};
	const requireAssetUpload = async (request: FastifyRequest, reply: FastifyReply) => {
		if (!sessionUserId(request, sessionsEnabled)) return unauthorized(reply);
		const { projectId, assetId } = request.params as { projectId?: unknown; assetId?: unknown };
		if (!isValidProjectId(projectId) || !isValidAssetId(assetId)) {
			return assetInputFailure(reply, new AssetInputError('invalid_asset', 400, 'Invalid asset identifier'));
		}
		const contentLength = readUploadContentLength(request);
		if (contentLength instanceof AssetInputError) return assetInputFailure(reply, contentLength);
	};

	app.get('/projects/:projectId/publication', async (request, reply) => {
		const userId = sessionUserId(request, sessionsEnabled);
		if (!userId) return unauthorized(reply);
		const projectId = (request.params as { projectId?: unknown }).projectId;
		if (typeof projectId !== 'string' || !projectId) {
			return reply.code(400).send(errorBody('invalid_project_id', 'Invalid project ID'));
		}
		try {
			return await getPublicationStatus(pool, userId, projectId);
		} catch (error) {
			if (error instanceof ProjectNotFoundError) return notFound(reply);
			return databaseFailure(app, reply, error, 'Publication status failed');
		}
	});

	app.put('/projects/:projectId/publication', async (request, reply) => {
		const userId = sessionUserId(request, sessionsEnabled);
		if (!userId) return unauthorized(reply);
		const projectId = (request.params as { projectId?: unknown }).projectId;
		if (typeof projectId !== 'string' || !projectId) {
			return reply.code(400).send(errorBody('invalid_project_id', 'Invalid project ID'));
		}
		// AM-9 publication gap (R4): every authored publication row is removed at
		// activation and prepared delivery is T4's. The request is understood and
		// refused with the ratified code, never read as an old release.
		return reply
			.code(501)
			.send(errorBody('prepared-reader-required', 'Publishing requires the prepared reader'));
	});

	app.delete('/projects/:projectId/publication', async (request, reply) => {
		const userId = sessionUserId(request, sessionsEnabled);
		if (!userId) return unauthorized(reply);
		const projectId = (request.params as { projectId?: unknown }).projectId;
		if (typeof projectId !== 'string' || !projectId) {
			return reply.code(400).send(errorBody('invalid_project_id', 'Invalid project ID'));
		}
		const revision = readExpectedPublicationRevision(request.body);
		if (revision === null) return reply.code(400).send(errorBody('invalid_body', 'Expected a publication body'));
		try {
			return await unpublishVersion(pool, userId, projectId, revision);
		} catch (error) {
			if (error instanceof ProjectNotFoundError || error instanceof PublicationNotFoundError) {
				return notFound(reply);
			}
			if (error instanceof PublicationConflictError) return publicationConflict(reply, error);
			return databaseFailure(app, reply, error, 'Project unpublish failed');
		}
	});

	// T2.P02.S01 — creator model staging and the immutable approved revision.
	// Owner-only throughout: an import the owner does not own is not-found, so no
	// route reveals another project's import or revision.
	const requireModelSession = async (request: FastifyRequest, reply: FastifyReply) => {
		if (!sessionUserId(request, sessionsEnabled)) return unauthorized(reply);
	};

	app.post('/projects/:projectId/models/imports', { onRequest: requireModelSession }, async (request, reply) => {
		const userId = sessionUserId(request, sessionsEnabled);
		const projectId = (request.params as { projectId?: unknown }).projectId;
		if (!userId) return unauthorized(reply);
		if (!isValidProjectId(projectId)) return modelInputFailure(reply, new ModelInputError('invalid_model_import', 400, 'Invalid project ID'));
		try {
			if (!isJsonContentType(request.headers['content-type'])) {
				return modelInputFailure(reply, new ModelInputError('unsupported_media_type', 415, 'Unsupported Media Type'));
			}
			const imported = await createModelImport(pool, userId, projectId, request.body, objectStore);
			return reply.code(201).send(imported);
		} catch (error) {
			return modelFailure(app, reply, error, 'Model staging failed');
		}
	});

	app.put('/projects/:projectId/models/imports/:importId/files/:fileId/content', {
		onRequest: requireModelSession,
		handlerTimeout: lifecyclePolicy.handlerTimeoutMs
	}, async (request, reply) => {
		const userId = sessionUserId(request, sessionsEnabled);
		const { projectId, importId, fileId } = request.params as { projectId?: unknown; importId?: unknown; fileId?: unknown };
		if (!userId) return unauthorized(reply);
		if (!isValidProjectId(projectId) || !isValidAssetId(importId) || !isValidAssetId(fileId)) {
			return modelInputFailure(reply, new ModelInputError('invalid_model_file', 400, 'Invalid model file identifier'));
		}
		const contentLength = readModelUploadContentLength(request);
		if (contentLength instanceof ModelInputError) return modelInputFailure(reply, contentLength);
		if (!(request.body instanceof Readable)) {
			return modelInputFailure(reply, new ModelInputError('invalid_upload', 400, 'Invalid upload body'));
		}
		const requestDeadline = createProjectWriteRequestSignal(request, lifecyclePolicy.handlerTimeoutMs);
		try {
			return await uploadModelFile(
				pool,
				userId,
				projectId,
				importId,
				fileId,
				contentLength,
				request.body,
				objectStore,
				objectNamespace,
				{ parentSignal: requestDeadline.signal, policy: lifecyclePolicy }
			);
		} catch (error) {
			return modelFailure(app, reply, error, 'Model file upload failed');
		} finally {
			requestDeadline.dispose();
		}
	});

	app.delete('/projects/:projectId/models/imports/:importId', { onRequest: requireModelSession }, async (request, reply) => {
		const userId = sessionUserId(request, sessionsEnabled);
		const { projectId, importId } = request.params as { projectId?: unknown; importId?: unknown };
		if (!userId) return unauthorized(reply);
		if (!isValidProjectId(projectId) || !isValidAssetId(importId)) {
			return modelInputFailure(reply, new ModelInputError('invalid_model_file', 400, 'Invalid model import identifier'));
		}
		try {
			await cancelModelImport(pool, userId, projectId, importId, objectStore);
			return reply.code(204).send();
		} catch (error) {
			return modelFailure(app, reply, error, 'Model staging cancel failed');
		}
	});

	app.post('/projects/:projectId/models/imports/:importId/approve', {
		onRequest: requireModelSession,
		handlerTimeout: lifecyclePolicy.handlerTimeoutMs
	}, async (request, reply) => {
		const userId = sessionUserId(request, sessionsEnabled);
		const { projectId, importId } = request.params as { projectId?: unknown; importId?: unknown };
		if (!userId) return unauthorized(reply);
		if (!isValidProjectId(projectId) || !isValidAssetId(importId)) {
			return modelInputFailure(reply, new ModelInputError('invalid_model_file', 400, 'Invalid model import identifier'));
		}
		const requestDeadline = createProjectWriteRequestSignal(request, lifecyclePolicy.handlerTimeoutMs);
		try {
			if (!isJsonContentType(request.headers['content-type'])) {
				return modelInputFailure(reply, new ModelInputError('unsupported_media_type', 415, 'Unsupported Media Type'));
			}
			const revision = await approveModelImport(
				pool,
				userId,
				projectId,
				importId,
				request.body,
				objectStore,
				objectNamespace,
				{ parentSignal: requestDeadline.signal, policy: lifecyclePolicy }
			);
			return reply.code(200).send(revision);
		} catch (error) {
			return modelFailure(app, reply, error, 'Model approval failed');
		} finally {
			requestDeadline.dispose();
		}
	});

	// Approved bytes are immutable: the read is keyed by the derivative's hash and
	// is cacheable, so repeat loads in the editor and Preview hit the cache. It is
	// still owner-only and never a public delivery route.
	app.get('/projects/:projectId/models/content/:hash', { onRequest: requireModelSession }, async (request, reply) => {
		const userId = sessionUserId(request, sessionsEnabled);
		const { projectId, hash } = request.params as { projectId?: unknown; hash?: unknown };
		if (!userId) return unauthorized(reply);
		if (!isValidProjectId(projectId) || typeof hash !== 'string') {
			return notFound(reply);
		}
		try {
			const content = await readModelRevisionContent(pool, userId, projectId, hash);
			if (!objectStore) throw new Error('Object storage is unavailable');
			const stored = await objectStore.get(content.objectKey);
			if (!stored || stored.contentLength !== content.size) {
				return reply.code(503).send(errorBody('service_unavailable', 'Service Unavailable'));
			}
			reply
				.header('Content-Type', content.mime)
				.header('Content-Length', String(content.size))
				.header('ETag', `"${hash}"`)
				.header('Cache-Control', 'private, max-age=31536000, immutable');
			return reply.send(stored.body);
		} catch (error) {
			if (error instanceof ModelNotFoundError) return notFound(reply);
			return databaseFailure(app, reply, error, 'Model content failed');
		}
	});

	// T5.P01.S04 — My Objects, the owner-scoped `form` library scope. Every route
	// is authenticated and owner-filtered; another owner's item answers as not
	// found. An item is not project data, so no project/release/visitor route can
	// reach it.
	const requireLibrarySession = async (request: FastifyRequest, reply: FastifyReply) => {
		if (!sessionUserId(request, sessionsEnabled)) return unauthorized(reply);
	};

	app.get('/library/items', { onRequest: requireLibrarySession }, async (request, reply) => {
		const userId = sessionUserId(request, sessionsEnabled);
		if (!userId) return unauthorized(reply);
		try {
			// Owner names and ids are as private as the bytes; never let a browser
			// retain them across a sign-out or owner switch.
			reply.header('Cache-Control', 'private, no-store');
			return { items: await listFormLibraryItems(pool, userId) };
		} catch (error) {
			return libraryFailure(app, reply, error, 'Library list failed');
		}
	});

	app.post('/library/items', { onRequest: requireLibrarySession }, async (request, reply) => {
		const userId = sessionUserId(request, sessionsEnabled);
		if (!userId) return unauthorized(reply);
		try {
			if (!isJsonContentType(request.headers['content-type'])) {
				return reply.code(415).send(errorBody('unsupported_media_type', 'Unsupported Media Type'));
			}
			return reply.code(201).send(await saveFormLibraryItem(pool, userId, request.body));
		} catch (error) {
			return libraryFailure(app, reply, error, 'Library save failed');
		}
	});

	app.get('/library/items/:itemId', { onRequest: requireLibrarySession }, async (request, reply) => {
		const userId = sessionUserId(request, sessionsEnabled);
		const itemId = (request.params as { itemId?: unknown }).itemId;
		if (!userId) return unauthorized(reply);
		if (!isValidLibraryItemId(itemId)) return notFound(reply);
		try {
			const { summary, bytes } = await readFormLibraryItem(pool, userId, itemId);
			return reply
				.header('Content-Type', 'application/json; charset=utf-8')
				.header('Content-Length', String(bytes.byteLength))
				.header('ETag', `"${summary.contentId}"`)
				.header('X-Library-Format-Version', String(summary.formatVersion))
				// Owner-scoped bytes are never a shared or long-lived browser cache:
				// Remove must be immediate, and a later session must re-authorize rather
				// than read a previous owner's item from disk.
				.header('Cache-Control', 'private, no-store')
				.send(Buffer.from(bytes));
		} catch (error) {
			return libraryFailure(app, reply, error, 'Library read failed');
		}
	});

	app.delete('/library/items/:itemId', { onRequest: requireLibrarySession }, async (request, reply) => {
		const userId = sessionUserId(request, sessionsEnabled);
		const itemId = (request.params as { itemId?: unknown }).itemId;
		if (!userId) return unauthorized(reply);
		if (!isValidLibraryItemId(itemId)) return notFound(reply);
		try {
			await removeFormLibraryItem(pool, userId, itemId);
			return reply.code(204).send();
		} catch (error) {
			return libraryFailure(app, reply, error, 'Library remove failed');
		}
	});

	// AM-9's publication gap: prepared delivery is T4's, and no public document
	// or asset read is served from an authored row. Both routes answer an
	// honest not-found for every ID, including a prior `/p/` link.
	app.get('/publications/:publicationId', async (_request, reply) => {
		reply.header('Cache-Control', 'no-store');
		return notFound(reply);
	});

	app.get('/publications/:publicationId/versions/:version/assets/:assetId/content', async (_request, reply) => {
		reply.header('Cache-Control', 'no-store');
		return notFound(reply);
	});

	app.get('/projects/:projectId/assets', { onRequest: requireAssetSession }, async (request, reply) => {
		const userId = sessionUserId(request, sessionsEnabled);
		const projectId = (request.params as { projectId?: unknown }).projectId;
		if (!userId) return unauthorized(reply);
		if (!isValidProjectId(projectId)) return assetInputFailure(reply, new AssetInputError('invalid_asset', 400, 'Invalid project ID'));
		try {
			return { assets: await listAssets(pool, userId, projectId) };
		} catch (error) {
			return assetFailure(app, reply, error, 'Asset list failed');
		}
	});

	app.post('/projects/:projectId/assets', { onRequest: requireAssetSession }, async (request, reply) => {
		const userId = sessionUserId(request, sessionsEnabled);
		const projectId = (request.params as { projectId?: unknown }).projectId;
		if (!userId) return unauthorized(reply);
		if (!isValidProjectId(projectId)) return assetInputFailure(reply, new AssetInputError('invalid_asset', 400, 'Invalid project ID'));
		try {
			if (!isJsonContentType(request.headers['content-type'])) {
				return assetInputFailure(reply, new AssetInputError('unsupported_media_type', 415, 'Unsupported Media Type'));
			}
			const name = readAssetNameBody(request.body);
			const asset = await registerAsset(pool, userId, projectId, name, objectNamespace);
			return reply.code(201).send(asset);
		} catch (error) {
			return assetFailure(app, reply, error, 'Asset registration failed');
		}
	});

	app.get('/projects/:projectId/assets/:assetId', { onRequest: requireAssetSession }, async (request, reply) => {
		const userId = sessionUserId(request, sessionsEnabled);
		const { projectId, assetId } = request.params as { projectId?: unknown; assetId?: unknown };
		if (!userId) return unauthorized(reply);
		if (!isValidProjectId(projectId) || !isValidAssetId(assetId)) {
			return assetInputFailure(reply, new AssetInputError('invalid_asset', 400, 'Invalid asset identifier'));
		}
		try {
			return assetMetadata(await readAsset(pool, userId, projectId, assetId));
		} catch (error) {
			return assetFailure(app, reply, error, 'Asset read failed');
		}
	});

	app.put('/projects/:projectId/assets/:assetId/content', {
		onRequest: requireAssetUpload,
		handlerTimeout: lifecyclePolicy.handlerTimeoutMs
	}, async (request, reply) => {
		const userId = sessionUserId(request, sessionsEnabled);
		const { projectId, assetId } = request.params as { projectId?: unknown; assetId?: unknown };
		if (!userId) return unauthorized(reply);
		if (!isValidProjectId(projectId) || !isValidAssetId(assetId)) {
			return assetInputFailure(reply, new AssetInputError('invalid_asset', 400, 'Invalid asset identifier'));
		}
		const contentLength = readUploadContentLength(request);
		if (contentLength instanceof AssetInputError) return assetInputFailure(reply, contentLength);
		if (!(request.body instanceof Readable)) {
			return assetInputFailure(reply, new AssetInputError('invalid_upload', 400, 'Invalid upload body'));
		}
		const requestDeadline = createProjectWriteRequestSignal(request, lifecyclePolicy.handlerTimeoutMs);
		try {
			return await uploadAsset(
				pool,
				userId,
				projectId,
				assetId,
				contentLength,
				request.body,
				objectStore,
				objectNamespace,
				{ parentSignal: requestDeadline.signal, policy: lifecyclePolicy }
			);
		} catch (error) {
			return assetFailure(app, reply, error, 'Asset upload failed');
		} finally {
			requestDeadline.dispose();
		}
	});

	app.get('/projects/:projectId/assets/:assetId/content', { onRequest: requireAssetSession }, async (request, reply) => {
		const userId = sessionUserId(request, sessionsEnabled);
		const { projectId, assetId } = request.params as { projectId?: unknown; assetId?: unknown };
		if (!userId) return unauthorized(reply);
		if (!isValidProjectId(projectId) || !isValidAssetId(assetId)) {
			return assetInputFailure(reply, new AssetInputError('invalid_asset', 400, 'Invalid asset identifier'));
		}
		try {
			const asset = await readAsset(pool, userId, projectId, assetId);
			if (asset.importState !== 'ready') throw new AssetNotReadyError();
			if (asset.storageKind !== 'r2' || asset.objectKey === null) throw new AssetNotReadyError();
			if (asset.mime === null || asset.byteSize === null) {
				return databaseFailure(app, reply, new Error('Ready asset metadata is incomplete'), 'Asset bytes failed');
			}
			if (!objectStore) throw new Error('Object storage is unavailable');
			const stored = await objectStore.get(asset.objectKey);
			if (!stored || stored.contentLength !== asset.byteSize) {
				return reply.code(503).send(errorBody('service_unavailable', 'Service Unavailable'));
			}
			reply
				.header('Content-Type', asset.mime)
				.header('Content-Length', String(asset.byteSize))
				.header('Cache-Control', 'private, no-store');
			return reply.send(stored.body);
		} catch (error) {
			return assetFailure(app, reply, error, 'Asset bytes failed');
		}
	});

	return app;
}

function assetInputFailure(reply: FastifyReply, error: AssetInputError) {
	return reply.code(error.statusCode).send(errorBody(error.code, error.message));
}

function modelInputFailure(reply: FastifyReply, error: ModelInputError) {
	return reply.code(error.statusCode).send(errorBody(error.code, error.message));
}

function libraryFailure(app: FastifyInstance, reply: FastifyReply, error: unknown, message: string) {
	if (error instanceof FormLibraryInputError) {
		return reply.code(error.statusCode).send(errorBody(error.code, error.message));
	}
	if (error instanceof FormLibraryNotFoundError) return notFound(reply);
	return databaseFailure(app, reply, error, message);
}

function isValidLibraryItemId(value: unknown): value is string {
	return (
		typeof value === 'string' &&
		/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
	);
}

function modelFailure(app: FastifyInstance, reply: FastifyReply, error: unknown, message: string) {
	if (error instanceof ModelInputError) return modelInputFailure(reply, error);
	if (error instanceof ModelNotFoundError) return notFound(reply);
	if (error instanceof ProjectNotFoundError) return notFound(reply);
	if (error instanceof ProjectWriteAbortedError) {
		if (reply.sent) return reply;
		return reply.code(409).send(errorBody('project-busy', 'The project write was stopped; retry after the project operation resolves'));
	}
	return databaseFailure(app, reply, error, message);
}

function assetFailure(app: FastifyInstance, reply: FastifyReply, error: unknown, message: string) {
	if (error instanceof AssetInputError) return assetInputFailure(reply, error);
	if (error instanceof AssetNotFoundError) return notFound(reply);
	if (error instanceof ProjectNotFoundError) return notFound(reply);
	if (error instanceof AssetNotReadyError) {
		return reply.code(409).send(errorBody('asset_not_ready', 'Asset Not Ready'));
	}
	if (error instanceof ProjectWriteAbortedError) {
		if (reply.sent) return reply;
		return reply.code(409).send(errorBody('project-busy', 'The project write was stopped; retry after the project operation resolves'));
	}
	return databaseFailure(app, reply, error, message);
}

function isOctetStream(value: string | undefined): boolean {
	return value?.split(';', 1)[0]?.trim().toLowerCase() === 'application/octet-stream';
}

/**
 * Fastify's signal also aborts when Node emits `IncomingMessage.close` after a
 * normal streamed request body completes. Ignore that completion event while
 * preserving true client disconnects and the handler deadline; the local timer
 * covers the full route work even when Fastify clears its timer on raw close.
 */
function createProjectWriteRequestSignal(
	request: FastifyRequest,
	timeoutMs: number
): { signal: AbortSignal; dispose(): void } {
	const fastifySignal = request.signal;
	const controller = new AbortController();
	const onAbort = () => {
		const reason = fastifySignal.reason as { code?: unknown } | undefined;
		if (!request.raw.aborted && reason?.code !== 'FST_ERR_HANDLER_TIMEOUT') return;
		if (!controller.signal.aborted) {
			controller.abort(new ProjectWriteAbortedError('The client disconnected or the request exceeded its handler deadline'));
		}
	};
	fastifySignal.addEventListener('abort', onAbort);
	if (fastifySignal.aborted) onAbort();
	const timer = setTimeout(() => {
		if (!controller.signal.aborted) {
			controller.abort(new ProjectWriteAbortedError('The request exceeded its handler deadline'));
		}
	}, timeoutMs);
	return {
		signal: controller.signal,
		dispose() {
			clearTimeout(timer);
			fastifySignal.removeEventListener('abort', onAbort);
		}
	};
}

function isJsonContentType(value: string | undefined): boolean {
	return value?.split(';', 1)[0]?.trim().toLowerCase() === 'application/json';
}

type DeclaredLengthRefusal = {
	readonly code: 'length_required' | 'invalid_upload' | 'payload_too_large' | 'unsupported_media_type';
	readonly statusCode: 400 | 411 | 413 | 415;
	readonly message: string;
};

/**
 * The declared `Content-Length` an upload route accepts. Both upload families
 * share these refusals and differ only in their ceiling and their error type.
 */
function readDeclaredLength(request: FastifyRequest, maxBytes: number): number | DeclaredLengthRefusal {
	if (!isOctetStream(request.headers['content-type'])) {
		return { code: 'unsupported_media_type', statusCode: 415, message: 'Unsupported Media Type' };
	}
	const value = request.headers['content-length'];
	if (typeof value !== 'string') {
		return { code: 'length_required', statusCode: 411, message: 'Content-Length is required' };
	}
	if (!/^\d+$/.test(value)) {
		return { code: 'invalid_upload', statusCode: 400, message: 'Invalid Content-Length' };
	}
	const declaredLength = BigInt(value);
	if (declaredLength === 0n) {
		return { code: 'invalid_upload', statusCode: 400, message: 'Invalid upload length' };
	}
	if (declaredLength > BigInt(maxBytes)) {
		return { code: 'payload_too_large', statusCode: 413, message: 'Payload Too Large' };
	}
	return Number(declaredLength);
}

/** Model files have their own role bounds; only the route-level ceiling lives here. */
function readModelUploadContentLength(request: FastifyRequest): number | ModelInputError {
	const read = readDeclaredLength(request, MODEL_SOURCE_SET_MAX_BYTES);
	return typeof read === 'number' ? read : new ModelInputError(read.code, read.statusCode, read.message);
}

function readUploadContentLength(request: FastifyRequest): number | AssetInputError {
	const read = readDeclaredLength(request, MAX_ASSET_BYTES);
	return typeof read === 'number' ? read : new AssetInputError(read.code, read.statusCode, read.message);
}

function sessionUserId(request: FastifyRequest, sessionsEnabled: boolean): string | null {
	if (!sessionsEnabled) return null;
	const userId = appSession(request).get('userId');
	return isSessionUserId(userId) ? userId : null;
}

type AppSession = {
	get(key: string): unknown;
	set(key: string, value: unknown): void;
	regenerate(): void;
	delete(): void;
};

function appSession(request: FastifyRequest): AppSession {
	return request.session as unknown as AppSession;
}

function authUnavailable(reply: { code(statusCode: number): { send(body: unknown): unknown } }) {
	return reply.code(503).send(errorBody('auth_unavailable', 'Authentication is unavailable'));
}

function readExpectedPublicationRevision(value: unknown): number | null {
	if (!isRecord(value) || Object.keys(value).length !== 1) return null;
	const revision = value.expectedPublicationRevision;
	if (!Number.isSafeInteger(revision) || (revision as number) < 0) return null;
	return revision as number;
}

function publicationConflict(
	reply: { code(statusCode: number): { send(body: unknown): unknown } },
	error: PublicationConflictError
) {
	return reply
		.code(409)
		.send({ error: { code: 'revision_conflict', message: error.message }, revision: error.revision });
}

function saveRefusal(
	reply: { code(statusCode: number): { send(body: unknown): unknown } },
	error: SaveRefusalError | ModelPinRefusalError
) {
	if (error instanceof ModelPinRefusalError) {
		return reply.code(400).send({
			error: { code: error.code, message: error.message },
			...(error.issues.length > 0 ? { issues: error.issues } : {})
		});
	}
	if (error.code === 'conflict') {
		// A conflict carries no remote contents; the client reloads explicitly.
		return reply.code(409).send(errorBody('conflict', error.message));
	}
	if (error.code === 'collision') {
		// Owner-blind: one answer for any existing ID, revealing nothing.
		return reply.code(409).send(errorBody('save_collision', error.message));
	}
	if (error.code === 'not-found') return notFound(reply);
	return reply.code(400).send({
		error: {
			code: error.code === 'invalid-project' ? 'invalid_project' : error.code,
			message: error.message
		},
		...(error.issues.length > 0 ? { issues: error.issues } : {})
	});
}

function isUnconditionedDocumentBody(value: unknown): value is { document: unknown } {
	return (
		typeof value === 'object' &&
		value !== null &&
		!Array.isArray(value) &&
		Object.keys(value).length === 1 &&
		Object.prototype.hasOwnProperty.call(value, 'document')
	);
}

function errorBody(code: string, message: string) {
	return { error: { code, message } };
}

function unauthorized(reply: { code(statusCode: number): { send(body: unknown): unknown } }) {
	return reply.code(401).send(errorBody('unauthorized', 'Unauthorized'));
}

function notFound(reply: { code(statusCode: number): { send(body: unknown): unknown } }) {
	return reply.code(404).send(errorBody('not_found', 'Not Found'));
}

function databaseFailure(
	app: FastifyInstance,
	reply: { code(statusCode: number): { send(body: unknown): unknown } },
	error: unknown,
	message: string
) {
	app.log.warn({ database: sanitizeDatabaseError(error) }, message);
	return reply.code(503).send(errorBody('service_unavailable', 'Service Unavailable'));
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function safeRequestLog(request: { method?: string; url?: string }) {
	return { method: request.method, url: request.url?.split('?', 1)[0] };
}
