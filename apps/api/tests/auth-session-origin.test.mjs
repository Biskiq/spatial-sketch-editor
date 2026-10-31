/**
 * API contract: local credentials, session issuance, origin enforcement and
 * logout. Split out of `api.test.mjs` by WP3T.
 *
 * Origin/session checks use real HTTP injection. Password and ownership
 * round trips below use PostgreSQL, with no skipped contracts.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';

import { createApp } from '../dist/app.js';
import { runMigrations } from '../dist/migrate.js';

import { cookieFrom, memoryPool, projectDocument, SESSION_COOKIE, SESSION_KEY, sessionCookie, stubPool } from './test-support.mjs';

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

const DATABASE_URL = process.env.DATABASE_URL ?? 'postgresql://localhost:5432/biskiq';
const EDITOR_ORIGIN = 'https://editor.auth-test.example';
// Exercise registration, legacy enrollment and login at the minimum length.
const TEST_PASSWORD = 'eightchr';

async function withIsolatedAuthApp(run, { trustProxy } = {}) {
	const admin = new Pool({ connectionString: DATABASE_URL, max: 1 });
	const schema = `auth_test_${randomUUID().replaceAll('-', '')}`;
	let pool;
	let app;
	try {
		await admin.query(`CREATE SCHEMA ${schema}`);
		pool = new Pool({
			connectionString: DATABASE_URL,
			max: 4,
			options: `-c search_path=${schema},public`
		});
		await runMigrations(pool);
		app = createApp({
			pool,
			apiOrigin: 'https://api.auth-test.example',
			editorOrigin: EDITOR_ORIGIN,
			sessionKey: SESSION_KEY,
			logger: false,
			...(trustProxy ? { trustProxy } : {})
		});
		await app.ready();
		await run({ app, pool });
	} finally {
		if (app) await app.close();
		else if (pool) await pool.end();
		await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
		await admin.end();
	}
}

function authRequest(app, method, url, { payload, cookie, origin = EDITOR_ORIGIN, remoteAddress = '127.0.0.1', forwardedFor } = {}) {
	return app.inject({
		method,
		url,
		remoteAddress,
		headers: {
			...(origin ? { origin } : {}),
			...(cookie ? { cookie } : {}),
			...(forwardedFor ? { 'x-forwarded-for': forwardedFor } : {})
		},
		...(payload === undefined ? {} : { payload })
	});
}

test('a successful login never consumes or retains the credential failure budget', async () => {
	await withIsolatedAuthApp(async ({ app, pool }) => {
		const username = 'reset.target';
		const source = '10.10.0.1';
		const password = TEST_PASSWORD;
		assert.equal(
			(await authRequest(app, 'POST', '/auth/register', { remoteAddress: source, payload: { username, password } })).statusCode,
			201
		);

		const login = (remoteAddress = source, submitted = password) =>
			authRequest(app, 'POST', '/auth/login', { remoteAddress, payload: { username, password: submitted } });
		const sourceAttempts = async () =>
			(await pool.query('SELECT attempts FROM auth_attempts WHERE key = $1', [`ip:${source}`])).rows[0]?.attempts ?? 0;

		// Registration consumed one source attempt. A correct credential
		// submission records no failure and leaves that source counter unchanged.
		assert.equal(await sourceAttempts(), 1);
		assert.equal((await login()).statusCode, 200);
		assert.equal(await sourceAttempts(), 1);
		assert.equal(
			(await pool.query("SELECT count(*)::int AS count FROM auth_attempts WHERE key LIKE 'credential:%'")).rows[0].count,
			0
		);

		// Three failures, then a success: the budget is cleared...
		for (let attempt = 0; attempt < 3; attempt += 1) {
			assert.equal((await login(source, 'incorrect password value')).statusCode, 401);
		}
		assert.equal(
			(await pool.query("SELECT attempts FROM auth_attempts WHERE key LIKE 'credential:%'")).rows[0].attempts,
			3
		);
		assert.equal((await login()).statusCode, 200);
		assert.equal(
			(await pool.query("SELECT count(*)::int AS count FROM auth_attempts WHERE key LIKE 'credential:%'")).rows[0].count,
			0
		);

		// ...so nine more failures still verify instead of locking at ten total.
		for (let attempt = 0; attempt < 9; attempt += 1) {
			assert.equal((await login(source, 'incorrect password value')).statusCode, 401);
		}
		assert.equal((await login()).statusCode, 200);

		// A reset restores the full budget: ten failures verify, the eleventh is
		// refused. No prior counts survived the success above.
		for (let attempt = 0; attempt < 10; attempt += 1) {
			assert.equal((await login(source, 'incorrect password value')).statusCode, 401);
		}
		assert.equal((await login(source, 'incorrect password value')).statusCode, 429);
	});
});

test('failures from one source cannot lock a username out from another', async () => {
	await withIsolatedAuthApp(async ({ app }) => {
		const username = 'target.account';
		const password = TEST_PASSWORD;
		const attacker = '10.20.0.1';
		const owner = '10.20.0.2';
		assert.equal(
			(await authRequest(app, 'POST', '/auth/register', { remoteAddress: attacker, payload: { username, password } })).statusCode,
			201
		);
		for (let attempt = 0; attempt < 10; attempt += 1) {
			assert.equal(
				(await authRequest(app, 'POST', '/auth/login', { remoteAddress: attacker, payload: { username, password: 'incorrect password value' } })).statusCode,
				401
			);
		}
		const attackerRefused = await authRequest(app, 'POST', '/auth/login', {
			remoteAddress: attacker,
			payload: { username, password: 'incorrect password value' }
		});
		assert.equal(attackerRefused.statusCode, 429);

		const ownerLogin = await authRequest(app, 'POST', '/auth/login', { remoteAddress: owner, payload: { username, password } });
		assert.equal(ownerLogin.statusCode, 200);
	});
});

test('one source probing many usernames is still throttled', async () => {
	await withIsolatedAuthApp(async ({ app }) => {
		const source = '10.30.0.1';
		for (let probe = 0; probe < 30; probe += 1) {
			const response = await authRequest(app, 'POST', '/auth/login', {
				remoteAddress: source,
				payload: { username: `probe.${String(probe).padStart(2, '0')}`, password: 'incorrect password value' }
			});
			assert.equal(response.statusCode, 401, `probe ${probe} should verify and fail`);
		}
		const refused = await authRequest(app, 'POST', '/auth/login', {
			remoteAddress: source,
			payload: { username: 'probe.30', password: 'incorrect password value' }
		});
		assert.equal(refused.statusCode, 429);
		assert.equal(refused.json().error.code, 'rate_limited');
	});
});

test('trusted proxy forwarding keys budgets by the real client and ignores untrusted forwarding', async () => {
	await withIsolatedAuthApp(async ({ app, pool }) => {
		const username = 'proxy.target';
		const password = TEST_PASSWORD;
		const proxyPeer = '10.40.0.9';
		const clientA = '203.0.113.10';
		const clientB = '203.0.113.11';
		const directPeer = '198.51.100.50';
		const spoofed = '203.0.113.99';
		assert.equal(
			(await authRequest(app, 'POST', '/auth/register', {
				remoteAddress: proxyPeer,
				forwardedFor: clientA,
				payload: { username, password }
			})).statusCode,
			201
		);
		for (const { remoteAddress, forwardedFor } of [
			{ remoteAddress: proxyPeer, forwardedFor: clientA },
			{ remoteAddress: proxyPeer, forwardedFor: clientB },
			{ remoteAddress: directPeer, forwardedFor: spoofed }
		]) {
			assert.equal(
				(await authRequest(app, 'POST', '/auth/login', {
					remoteAddress,
					forwardedFor,
					payload: { username, password: 'incorrect password value' }
				})).statusCode,
				401
			);
		}
		const keys = (await pool.query('SELECT key FROM auth_attempts ORDER BY key')).rows.map((row) => row.key);
		// Two clients forwarded by the trusted proxy are distinct sources.
		assert.ok(keys.includes(`ip:${clientA}`));
		assert.ok(keys.includes(`ip:${clientB}`));
		assert.ok(keys.includes(`credential:${clientA}|${username}`));
		assert.ok(keys.includes(`credential:${clientB}|${username}`));
		// A direct peer cannot choose its source with a forwarded header.
		assert.ok(keys.includes(`ip:${directPeer}`));
		assert.ok(!keys.includes(`ip:${spoofed}`));
	}, { trustProxy: '10.40.0.0/24, loopback' });
});

test('forwarded addresses are ignored unless the proxy peer is configured', async () => {
	await withIsolatedAuthApp(async ({ app, pool }) => {
		const peer = '198.51.100.50';
		const spoofed = '203.0.113.99';
		const username = 'untrusted.proxy';
		const response = await authRequest(app, 'POST', '/auth/login', {
			remoteAddress: peer,
			forwardedFor: spoofed,
			payload: { username, password: 'incorrect password value' }
		});
		assert.equal(response.statusCode, 401);

		const keys = (await pool.query('SELECT key FROM auth_attempts ORDER BY key')).rows.map((row) => row.key);
		assert.ok(keys.includes(`ip:${peer}`));
		assert.ok(keys.includes(`credential:${peer}|${username}`));
		assert.ok(!keys.includes(`ip:${spoofed}`));
		assert.ok(!keys.includes(`credential:${spoofed}|${username}`));
	});
});

test('expired authentication windows reset their source and credential budgets', async () => {
	await withIsolatedAuthApp(async ({ app, pool }) => {
		const source = '198.51.100.51';
		const username = 'expired.window';
		const sourceKey = `ip:${source}`;
		const credentialKey = `credential:${source}|${username}`;
		await pool.query(
			`INSERT INTO auth_attempts (key, attempts, window_start)
VALUES ($1, 30, now() - interval '16 minutes'), ($2, 10, now() - interval '16 minutes')
ON CONFLICT (key) DO UPDATE SET attempts = EXCLUDED.attempts, window_start = EXCLUDED.window_start`,
			[sourceKey, credentialKey]
		);

		const response = await authRequest(app, 'POST', '/auth/login', {
			remoteAddress: source,
			payload: { username, password: 'incorrect password value' }
		});
		assert.equal(response.statusCode, 401);
		const rows = (await pool.query('SELECT key, attempts FROM auth_attempts WHERE key = ANY($1::text[])', [
			[sourceKey, credentialKey]
		])).rows;
		assert.deepEqual(Object.fromEntries(rows.map((row) => [row.key, row.attempts])), {
			[sourceKey]: 1,
			[credentialKey]: 1
		});
	});
});

test('concurrent failures from one source cannot both pass the last credential slot', async () => {
	await withIsolatedAuthApp(async ({ app, pool }) => {
		const username = 'race.target';
		const password = TEST_PASSWORD;
		const peer = '10.50.0.9';
		const source = '203.0.113.20';
		const wrong = 'incorrect password value';
		// A second app shares the pool and has its own in-process authBusy: exactly
		// the multi-worker condition the database lock must cover.
		const workerPool = {
			query: (text, values) => pool.query(text, values),
			connect: () => pool.connect(),
			end: async () => {},
			on: (event, listener) => pool.on(event, listener)
		};
		const second = createApp({
			pool: workerPool,
			apiOrigin: 'https://api.auth-test.example',
			editorOrigin: EDITOR_ORIGIN,
			sessionKey: SESSION_KEY,
			logger: false,
			trustProxy: '10.0.0.0/8'
		});
		await second.ready();
		try {
			assert.equal(
				(await authRequest(app, 'POST', '/auth/register', {
					remoteAddress: peer,
					forwardedFor: source,
					payload: { username, password }
				})).statusCode,
				201
			);
			for (let attempt = 0; attempt < 9; attempt += 1) {
				assert.equal(
					(await authRequest(app, 'POST', '/auth/login', {
						remoteAddress: peer,
						forwardedFor: source,
						payload: { username, password: wrong }
					})).statusCode,
					401
				);
			}
			const [first, concurrent] = await Promise.all([
				authRequest(app, 'POST', '/auth/login', {
					remoteAddress: peer,
					forwardedFor: source,
					payload: { username, password: wrong }
				}),
				authRequest(second, 'POST', '/auth/login', {
					remoteAddress: peer,
					forwardedFor: source,
					payload: { username, password: wrong }
				})
			]);
			assert.deepEqual([first.statusCode, concurrent.statusCode].sort(), [401, 429]);
			const credential = await pool.query('SELECT attempts FROM auth_attempts WHERE key = $1', [
				`credential:${source}|${username}`
			]);
			assert.equal(credential.rows[0].attempts, 10);
		} finally {
			await second.close();
		}
	}, { trustProxy: '10.0.0.0/8' });
});

test('concurrent login and registration share the last source slot across workers', async () => {
	await withIsolatedAuthApp(async ({ app, pool }) => {
		const second = createApp({
			pool: {
				query: (text, values) => pool.query(text, values),
				connect: () => pool.connect(),
				end: async () => {},
				on: (event, listener) => pool.on(event, listener)
			},
			apiOrigin: 'https://api.auth-test.example',
			editorOrigin: EDITOR_ORIGIN,
			sessionKey: SESSION_KEY,
			logger: false,
			trustProxy: '10.0.0.0/8'
		});
		await second.ready();
		try {
			const peer = '10.60.0.9';
			const source = '203.0.113.30';
			const username = 'mixed.race';
			await pool.query(
				`INSERT INTO auth_attempts (key, attempts, window_start)
VALUES ($1, 29, now()), ($2, 9, now())`,
				[`ip:${source}`, `credential:${source}|${username}`]
			);

			const [login, registration] = await Promise.all([
				authRequest(app, 'POST', '/auth/login', {
					remoteAddress: peer,
					forwardedFor: source,
					payload: { username, password: 'incorrect password value' }
				}),
				authRequest(second, 'POST', '/auth/register', {
					remoteAddress: peer,
					forwardedFor: source,
					payload: { username: 'mixed.register', password: TEST_PASSWORD }
				})
			]);
			const statuses = [login.statusCode, registration.statusCode];
			assert.equal(statuses.filter((status) => status === 429).length, 1);
			assert.ok(statuses.includes(401) || statuses.includes(201));
			assert.equal(
				(await pool.query('SELECT attempts FROM auth_attempts WHERE key = $1', [`ip:${source}`])).rows[0].attempts,
				30
			);
		} finally {
			await second.close();
		}
	}, { trustProxy: '10.0.0.0/8' });
});

test('local credentials authenticate, preserve legacy ownership, and enforce bounds', async () => {
	await withIsolatedAuthApp(async ({ app, pool }) => {
		const legacyId = 'google:stable-owner-subject';
		await pool.query('INSERT INTO users (id) VALUES ($1)', [legacyId]);
		const legacyProjectId = `legacy-project-${randomUUID()}`;
		await pool.query('INSERT INTO projects (id, owner_id, name, latest_version) VALUES ($1, $2, $3, 1)', [
			legacyProjectId,
			legacyId,
			'Legacy project'
		]);
		await pool.query(
			"INSERT INTO project_versions (project_id, version, document, source_format) VALUES ($1, 1, $2::jsonb, 'unit-envelope-v1')",
			[legacyProjectId, JSON.stringify(projectDocument('Legacy project', { id: legacyProjectId }))]
		);
		const legacyCookie = await sessionCookie(app, legacyId);

		const anonymousEnrollment = await authRequest(app, 'POST', '/auth/credentials', {
			payload: { username: 'legacy.owner', password: TEST_PASSWORD }
		});
		assert.equal(anonymousEnrollment.statusCode, 401);
		assert.equal((await authRequest(app, 'GET', '/auth/credentials', { cookie: legacyCookie })).json().enrolled, false);

		const enrollment = await authRequest(app, 'POST', '/auth/credentials', {
			cookie: legacyCookie,
			payload: { username: 'Legacy.Owner', password: TEST_PASSWORD }
		});
		assert.equal(enrollment.statusCode, 201);
		assert.deepEqual(enrollment.json(), { authenticated: true, user: { id: legacyId } });
		const enrollmentCookie = cookieFrom(enrollment);
		assert.equal((await authRequest(app, 'GET', '/auth/credentials', { cookie: enrollmentCookie })).json().enrolled, true);

		const legacyCredential = await pool.query(
			'SELECT user_id, username, password_hash FROM local_credentials WHERE user_id = $1',
			[legacyId]
		);
		assert.equal(legacyCredential.rows[0].user_id, legacyId);
		assert.equal(legacyCredential.rows[0].username, 'legacy.owner');
		assert.match(legacyCredential.rows[0].password_hash, /^scrypt-v1\$[0-9a-f]{32}\$[0-9a-f]{128}$/);
		assert.equal(legacyCredential.rows[0].password_hash.includes(TEST_PASSWORD), false);

		const overwritten = await authRequest(app, 'POST', '/auth/credentials', {
			cookie: enrollmentCookie,
			payload: { username: 'replacement.name', password: TEST_PASSWORD }
		});
		assert.equal(overwritten.statusCode, 409);
		const legacyLogin = await authRequest(app, 'POST', '/auth/login', {
			payload: { username: 'LEGACY.OWNER', password: TEST_PASSWORD }
		});
		assert.equal(legacyLogin.statusCode, 200);
		assert.deepEqual(legacyLogin.json(), { authenticated: true, user: { id: legacyId } });
		const owned = await authRequest(app, 'GET', '/projects', { cookie: cookieFrom(legacyLogin) });
		assert.equal(owned.statusCode, 200);
		assert.equal(owned.json().projects.some((project) => project.name === 'Legacy project'), true);
		const loggedOut = await authRequest(app, 'POST', '/auth/logout', { cookie: cookieFrom(legacyLogin) });
		assert.equal(loggedOut.statusCode, 204);
		assert.deepEqual((await authRequest(app, 'GET', '/auth/me', { cookie: cookieFrom(loggedOut) })).json(), { authenticated: false });

		const registration = await authRequest(app, 'POST', '/auth/register', {
			payload: { username: 'new.creator', password: TEST_PASSWORD }
		});
		assert.equal(registration.statusCode, 201);
		const registeredId = registration.json().user.id;
		assert.match(registeredId, /^local:[0-9a-f-]{36}$/);
		assert.notEqual(registeredId, legacyId);
		const secondRegistration = await authRequest(app, 'POST', '/auth/register', {
			payload: { username: 'second.creator', password: TEST_PASSWORD }
		});
		assert.equal(secondRegistration.statusCode, 201);
		assert.notEqual(
			(await pool.query('SELECT password_hash FROM local_credentials WHERE user_id = $1', [registeredId])).rows[0].password_hash,
			(await pool.query('SELECT password_hash FROM local_credentials WHERE user_id = $1', [secondRegistration.json().user.id])).rows[0].password_hash,
			'same password must receive independent salt and hash'
		);
		const duplicateName = await authRequest(app, 'POST', '/auth/register', {
			payload: { username: 'NEW.CREATOR', password: TEST_PASSWORD }
		});
		assert.equal(duplicateName.statusCode, 409);
		assert.equal((await pool.query('SELECT count(*)::int AS count FROM local_credentials WHERE username = $1', ['new.creator'])).rows[0].count, 1);

		const wrongPassword = await authRequest(app, 'POST', '/auth/login', {
			payload: { username: 'new.creator', password: 'incorrect password value' }
		});
		const unknownUsername = await authRequest(app, 'POST', '/auth/login', {
			payload: { username: 'unknown.creator', password: 'incorrect password value' }
		});
		assert.equal(wrongPassword.statusCode, 401);
		assert.equal(unknownUsername.statusCode, 401);
		assert.deepEqual(wrongPassword.json(), unknownUsername.json(), 'unknown and incorrect credentials expose the same response');

		const invalidCredentials = [
			{ username: 'ab', password: TEST_PASSWORD },
			{ username: 'bad/name', password: TEST_PASSWORD },
			{ username: 'valid.name', password: 'short7!' },
			{ username: 'valid.name', password: 'p'.repeat(129) },
			{ username: 'valid.name', password: TEST_PASSWORD, extra: true }
		];
		for (const payload of invalidCredentials) {
			const response = await authRequest(app, 'POST', '/auth/register', { payload });
			assert.equal(response.statusCode, 400);
		}
		const oversized = await authRequest(app, 'POST', '/auth/register', {
			payload: { username: 'valid.name', password: 'p'.repeat(3000) }
		});
		assert.equal(oversized.statusCode, 413);

		const claimedLegacy = await authRequest(app, 'POST', '/auth/register', {
			payload: { username: 'claim.attempt', password: TEST_PASSWORD }
		});
		assert.equal(claimedLegacy.statusCode, 201);
		assert.notEqual(claimedLegacy.json().user.id, legacyId);
		assert.equal((await pool.query('SELECT count(*)::int AS count FROM local_credentials WHERE user_id = $1', [legacyId])).rows[0].count, 1);

		const badOrigin = await authRequest(app, 'POST', '/auth/login', {
			origin: 'https://other.example.test',
			payload: { username: 'new.creator', password: TEST_PASSWORD }
		});
		assert.equal(badOrigin.statusCode, 403);
		assert.equal((await authRequest(app, 'GET', '/auth/login')).statusCode, 404);
		assert.equal((await authRequest(app, 'GET', '/auth/callback')).statusCode, 404);

		// A legacy global `name:` row (the pre-correction key) must not gate a
		// login: budgets are per source + username now. Old rows are ignored and
		// age out, so existing throttle state stays backward compatible.
		await pool.query(
			`INSERT INTO auth_attempts (key, attempts, window_start) VALUES ($1, 10, now()) ON CONFLICT (key) DO UPDATE SET attempts = 10, window_start = now()`,
			['name:new.creator']
		);
		const legacyKeyIgnored = await authRequest(app, 'POST', '/auth/login', {
			remoteAddress: '127.0.0.9',
			payload: { username: 'new.creator', password: TEST_PASSWORD }
		});
		assert.equal(legacyKeyIgnored.statusCode, 200);

		const first = authRequest(app, 'POST', '/auth/register', {
			remoteAddress: '127.0.0.2',
			payload: { username: 'parallel.one', password: TEST_PASSWORD }
		});
		await new Promise((resolve) => setTimeout(resolve, 10));
		const second = await authRequest(app, 'POST', '/auth/register', {
			remoteAddress: '127.0.0.3',
			payload: { username: 'parallel.two', password: TEST_PASSWORD }
		});
		assert.equal(second.statusCode, 429);
		assert.equal(second.json().error.code, 'auth_busy');
		assert.equal((await first).statusCode, 201);
	});
});
