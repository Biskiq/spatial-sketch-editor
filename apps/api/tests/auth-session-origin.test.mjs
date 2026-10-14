/**
 * API contract: OIDC login/callback, session issuance, origin enforcement and
 * logout. Split out of `api.test.mjs` by WP3T.
 *
 * The OIDC client is injected, so this file runs without a real identity
 * provider; the origin/credential checks are asserted through real HTTP
 * injection.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import { createApp } from '../dist/app.js';

import { cookieFrom, memoryPool, projectDocument, SESSION_COOKIE, SESSION_KEY, sessionCookie, stubPool } from './test-support.mjs';

test('login creates fresh state, PKCE, nonce, callback URL, and secure cookie', async () => {
	let authorization;
	const app = createApp({
		pool: stubPool(),
		apiOrigin: 'https://editor.example.test/api',
		editorOrigin: 'https://editor.example.test',
		sessionKey: SESSION_KEY,
		oidc: {
			async createAuthorizationUrl(input) {
				authorization = input;
				return `https://accounts.google.test/auth?${new URLSearchParams({
					client_id: 'client-id',
					redirect_uri: input.redirectUri,
					response_type: 'code',
					scope: 'openid email profile',
					state: input.state,
					code_challenge: input.codeChallenge,
					code_challenge_method: 'S256',
					nonce: input.nonce
				})}`;
			},
			async exchangeAuthorizationCode() {
				throw new Error('not called');
			}
		},
		logger: false
	});
	try {
		const response = await app.inject({ method: 'GET', url: '/auth/login' });
		assert.equal(response.statusCode, 302);
		assert.equal(authorization.redirectUri, 'https://editor.example.test/api/auth/callback');
		assert.match(authorization.state, /^\S+$/);
		assert.match(authorization.codeChallenge, /^\S+$/);
		assert.match(authorization.nonce, /^\S+$/);
		assert.notEqual(authorization.codeChallenge, authorization.state);
		const location = new URL(response.headers.location);
		assert.equal(location.searchParams.get('scope'), 'openid email profile');
		assert.equal(location.searchParams.get('redirect_uri'), authorization.redirectUri);
		assert.equal(location.searchParams.get('state'), authorization.state);
		assert.equal(location.searchParams.get('code_challenge_method'), 'S256');
		const cookie = cookieFrom(response);
		assert.match(response.headers['set-cookie'], /HttpOnly/i);
		assert.match(response.headers['set-cookie'], /Secure/i);
		assert.match(response.headers['set-cookie'], /SameSite=Lax/i);
		assert.match(cookie, new RegExp(`^${SESSION_COOKIE}=`));
	} finally {
		await app.close();
	}
});

test('callback validates the session-bound state and forwards PKCE plus nonce', async () => {
	let authorization;
	let callback;
	let queries = 0;
	const pool = stubPool({ query: async () => queries++ });
	const app = createApp({
		pool,
		apiOrigin: 'https://editor.example.test/api',
		editorOrigin: 'https://editor.example.test',
		sessionKey: SESSION_KEY,
		oidc: {
			async createAuthorizationUrl(input) {
				authorization = input;
				return 'https://accounts.google.test/auth';
			},
			async exchangeAuthorizationCode(input) {
				callback = input;
				return { subject: 'google-subject-1' };
			}
		},
		logger: false
	});
	try {
		const login = await app.inject({ method: 'GET', url: '/auth/login' });
		const callbackResponse = await app.inject({
			method: 'GET',
			url: `/auth/callback?code=authorization-code&state=${encodeURIComponent(authorization.state)}`,
			headers: { cookie: cookieFrom(login) }
		});
		assert.equal(callbackResponse.statusCode, 302);
		assert.equal(callbackResponse.headers.location, 'https://editor.example.test/projects');
		assert.equal(callback.callbackUrl.toString(), `https://editor.example.test/api/auth/callback?code=authorization-code&state=${encodeURIComponent(authorization.state)}`);
		assert.equal(callback.codeVerifier.length > 20, true);
		assert.equal(callback.expectedState, authorization.state);
		assert.equal(callback.expectedNonce, authorization.nonce);
		assert.equal(queries, 0);

		const me = await app.inject({
			method: 'GET',
			url: '/auth/me',
			headers: { cookie: cookieFrom(callbackResponse) }
		});
		assert.deepEqual(me.json(), { authenticated: true, user: { id: 'google:google-subject-1' } });
	} finally {
		await app.close();
	}
});

test('tampered state, rejected PKCE/token, and invalid identity never create a session', async () => {
	let exchangeCalls = 0;
	const logs = [];
	const app = createApp({
		pool: stubPool(),
		apiOrigin: 'https://api.example.test',
		editorOrigin: 'https://editor.example.test',
		sessionKey: SESSION_KEY,
		oidc: {
			async createAuthorizationUrl(input) {
				return `https://accounts.google.test/auth?state=${encodeURIComponent(input.state)}`;
			},
			async exchangeAuthorizationCode() {
				exchangeCalls += 1;
				throw new Error('token exchange rejected');
			}
		},
		logger: { level: 'warn', stream: { write: (line) => logs.push(JSON.parse(line)) } }
	});
	try {
		const login = await app.inject({ method: 'GET', url: '/auth/login' });
		const cookie = cookieFrom(login);
		const tampered = await app.inject({
			method: 'GET',
			url: '/auth/callback?code=authorization-code&state=wrong',
			headers: { cookie }
		});
		assert.equal(tampered.statusCode, 400);
		assert.equal(exchangeCalls, 0);
		const tamperedMe = await app.inject({ method: 'GET', url: '/auth/me', headers: { cookie: cookieFrom(tampered) } });
		assert.deepEqual(tamperedMe.json(), { authenticated: false });

		const secondLogin = await app.inject({ method: 'GET', url: '/auth/login' });
		const state = new URL(secondLogin.headers.location).searchParams.get('state');
		const rejected = await app.inject({
			method: 'GET',
			url: `/auth/callback?code=authorization-code&state=${encodeURIComponent(state)}`,
			headers: { cookie: cookieFrom(secondLogin) }
		});
		assert.equal(rejected.statusCode, 302);
		assert.equal(rejected.headers.location, 'https://editor.example.test/?auth=failed&intent=projects');
		assert.equal(exchangeCalls, 1);
		assert.equal(
			logs.some((entry) => entry.msg === 'OIDC callback failed' && entry.auth?.reason === 'exchange_failed' && entry.auth?.error?.name === 'Error'),
			true
		);
		assert.equal(JSON.stringify(logs).includes('token exchange rejected'), false);
		const rejectedMe = await app.inject({ method: 'GET', url: '/auth/me', headers: { cookie: cookieFrom(rejected) } });
		assert.deepEqual(rejectedMe.json(), { authenticated: false });
		assert.equal(rejected.body.includes('token exchange'), false);
	} finally {
		await app.close();
	}
});

test('save login intent survives the OIDC round trip and access denial is bounded', async () => {
	let authorization;
	const app = createApp({
		pool: stubPool(),
		apiOrigin: 'https://api.example.test',
		editorOrigin: 'https://editor.example.test',
		sessionKey: SESSION_KEY,
		oidc: {
			async createAuthorizationUrl(input) {
				authorization = input;
				return `https://accounts.google.test/auth?state=${encodeURIComponent(input.state)}`;
			},
			async exchangeAuthorizationCode() {
				return { subject: 'google-save-user' };
			}
		},
		logger: false
	});
	try {
		const invalid = await app.inject({ method: 'GET', url: '/auth/login?intent=other' });
		assert.equal(invalid.statusCode, 400);

		const saveLogin = await app.inject({ method: 'GET', url: '/auth/login?intent=save' });
		const saveCallback = await app.inject({
			method: 'GET',
			url: `/auth/callback?error=access_denied&state=${encodeURIComponent(authorization.state)}`,
			headers: { cookie: cookieFrom(saveLogin) }
		});
		assert.equal(saveCallback.statusCode, 302);
		assert.equal(saveCallback.headers.location, 'https://editor.example.test/?auth=cancelled&intent=save');
	} finally {
		await app.close();
	}
});

test('project routes require a valid secure session and do not query anonymously', async () => {
	let queries = 0;
	const app = createApp({
		pool: stubPool({ query: async () => queries++ }),
		sessionKey: SESSION_KEY,
		logger: false
	});
	try {
		const missing = await app.inject({ method: 'GET', url: '/projects' });
		const invalid = await app.inject({
			method: 'GET',
			url: '/projects',
			headers: { cookie: `${SESSION_COOKIE}=invalid` }
		});
		assert.equal(missing.statusCode, 401);
		assert.equal(invalid.statusCode, 401);
		assert.equal(queries, 0);
	} finally {
		await app.close();
	}
});

test('CORS, credentials, origin checks, and logout are restricted to the editor origin', async () => {
	const app = createApp({
		pool: memoryPool(),
		apiOrigin: 'https://api.example.test',
		editorOrigin: 'https://editor.example.test',
		sessionKey: SESSION_KEY,
		logger: false
	});
	try {
		const allowed = await app.inject({
			method: 'OPTIONS',
			url: '/projects',
			headers: {
				origin: 'https://editor.example.test',
				'access-control-request-method': 'GET',
				'access-control-request-headers': 'content-type'
			}
		});
		const rejected = await app.inject({
			method: 'OPTIONS',
			url: '/projects',
			headers: { origin: 'https://other.example.test' }
		});
		assert.equal(allowed.statusCode, 204);
		assert.equal(allowed.headers['access-control-allow-origin'], 'https://editor.example.test');
		assert.equal(allowed.headers['access-control-allow-credentials'], 'true');
		assert.equal(allowed.headers['access-control-allow-methods'], 'GET, PUT, POST, PATCH, DELETE, OPTIONS');
		assert.equal(allowed.headers['access-control-allow-headers'], 'Content-Type');
		assert.equal(rejected.statusCode, 403);

		const cookie = await sessionCookie(app, 'google:user-1');
		const badPut = await app.inject({
			method: 'PUT',
			url: '/projects/project:test',
			headers: { origin: 'https://other.example.test', cookie },
			payload: { document: projectDocument() }
		});
		const badAssetPost = await app.inject({
			method: 'POST',
			url: '/projects/project:test/assets',
			headers: { origin: 'https://other.example.test', cookie },
			payload: { name: 'blocked.png' }
		});
		const badLogout = await app.inject({
			method: 'POST',
			url: '/auth/logout',
			headers: { origin: 'https://other.example.test', cookie }
		});
		assert.equal(badPut.statusCode, 403);
		assert.equal(badAssetPost.statusCode, 403);
		assert.equal(badLogout.statusCode, 403);

		const logout = await app.inject({
			method: 'POST',
			url: '/auth/logout',
			headers: { origin: 'https://editor.example.test', cookie }
		});
		assert.equal(logout.statusCode, 204);
		const me = await app.inject({ method: 'GET', url: '/auth/me', headers: { cookie: cookieFrom(logout) } });
		assert.deepEqual(me.json(), { authenticated: false });
	} finally {
		await app.close();
	}
});
