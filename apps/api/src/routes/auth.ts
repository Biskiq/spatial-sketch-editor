import { admitAuthAttempt, enrollCredentials, hasCredentials, loginAttempt, readCredentials } from '../auth.js';
import { isValidTestAuthSecret, readTestAuthBearer, readTestAuthTarget, resolveTestAuthUserId } from '../test-auth.js';
import { errorBody, unauthorized, databaseFailure, sessionUserId, appSession, authUnavailable } from '../http.js';

import type { RouteDeps } from './deps.js';

const SESSION_COOKIE_NAME = 'museum-editor-session';

export function registerAuthRoutes(deps: RouteDeps): void {
	const { app, pool, sessionsEnabled, testAuth, authState } = deps;
	for (const action of ['register', 'login', 'credentials'] as const) {
		app.post(`/auth/${action}`, { bodyLimit: 2048 }, async (request, reply) => {
			reply.header('Cache-Control', 'no-store');
			if (!sessionsEnabled) return authUnavailable(reply);
			const existingUserId = sessionUserId(request, sessionsEnabled);
			if (action === 'credentials' && !existingUserId) return unauthorized(reply);
			const credentials = readCredentials(request.body);
			if (!credentials) return reply.code(400).send(errorBody('invalid_credentials', 'Use a 3–32 character username and an 8–128 character password'));
			if (authState.busy) return reply.header('Retry-After', '1').code(429).send(errorBody('auth_busy', 'Try again shortly'));
			authState.busy = true;
			try {
				let userId: string;
				if (action === 'login') {
					// Admission, verification and failure recording are one serialized
					// transaction: a success is charged nothing and clears only this
					// source's budget for the username.
					const attempt = await loginAttempt(pool, request.ip, credentials.username, credentials.password);
					if (attempt.kind === 'limited') {
						return reply.header('Retry-After', '900').code(429).send(errorBody('rate_limited', 'Too many attempts; try again later'));
					}
					if (attempt.kind === 'invalid') {
						return reply.code(401).send(errorBody('invalid_login', 'Username or password is incorrect'));
					}
					userId = attempt.userId;
				} else {
					if (!await admitAuthAttempt(pool, request.ip)) {
						return reply.header('Retry-After', '900').code(429).send(errorBody('rate_limited', 'Too many attempts; try again later'));
					}
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
				authState.busy = false;
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
}


