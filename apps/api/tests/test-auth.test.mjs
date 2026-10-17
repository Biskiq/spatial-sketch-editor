import assert from 'node:assert/strict';
import { Pool } from 'pg';
import test, { after, before } from 'node:test';

import { createApp } from '../dist/app.js';
import { ConfigError, readConfig } from '../dist/config.js';
import { runMigrations } from '../dist/migrate.js';

import { projectDocument, saveRequestBody } from './test-support.mjs';

const SESSION_KEY = Buffer.alloc(32, 13);
const SESSION_COOKIE = 'museum-editor-session';
const TEST_SECRET = 'e2e-test-secret-with-enough-length';
const DATABASE_URL = process.env.DATABASE_URL ?? 'postgresql://localhost:5432/biskiq';

function stubPool({ query = async () => ({ rows: [] }), end = async () => undefined } = {}) {
	return { query, end };
}

function cookieFrom(response) {
	const header = response.headers['set-cookie'];
	const value = Array.isArray(header) ? header[0] : header;
	assert.ok(value, 'response should set a session cookie');
	return value.split(';', 1)[0];
}

function testAuthApp(pool = stubPool()) {
	return createApp({ pool, sessionKey: SESSION_KEY, testAuth: { secret: TEST_SECRET }, logger: false });
}

test('enabled seam mints the canonical session and protected routes work', async (t) => {
	const app = testAuthApp();
	try {
		const issued = await app.inject({
			method: 'POST',
			url: '/test-auth/session',
			headers: { authorization: `Bearer ${TEST_SECRET}`, 'content-type': 'application/json' },
			payload: { user: 'agent-admin' }
		});
		assert.equal(issued.statusCode, 201);
		assert.deepEqual(issued.json(), { authenticated: true, user: { id: 'google:e2e-agent-admin' } });
		const cookie = cookieFrom(issued);

		const me = await app.inject({ method: 'GET', url: '/auth/me', headers: { cookie } });
		assert.deepEqual(me.json(), { authenticated: true, user: { id: 'google:e2e-agent-admin' } });

		const projects = await app.inject({ method: 'GET', url: '/projects', headers: { cookie } });
		assert.equal(projects.statusCode, 200);
		assert.deepEqual(projects.json(), { projects: [] });
	} finally {
		await app.close();
	}
});

test('wrong, missing, or malformed bearer secrets create no session', async (t) => {
	const app = testAuthApp();
	try {
		for (const authorization of [
			undefined,
			'Bearer wrong-secret-with-enough-length',
			'Bearer ',
			'Bearer a b',
			'Token e2e-test-secret-with-enough-length',
			`bearer ${TEST_SECRET}`
		]) {
			const response = await app.inject({
				method: 'POST',
				url: '/test-auth/session',
				headers: {
					...(authorization === undefined ? {} : { authorization }),
					'content-type': 'application/json'
				},
				payload: { user: 'agent-admin' }
			});
			assert.equal(response.statusCode, 401, `expected 401 for ${String(authorization)}`);
			assert.equal(response.headers['set-cookie'], undefined);
		}
		const anonymous = await app.inject({ method: 'GET', url: '/auth/me' });
		assert.deepEqual(anonymous.json(), { authenticated: false });
	} finally {
		await app.close();
	}
});

test('unknown test identities and malformed bodies are rejected without a session', async (t) => {
	const app = testAuthApp();
	try {
		const bodies = [
			{ user: 'agent-nobody' },
			{ user: 'google:e2e-agent-admin' },
			{ user: '' },
			{},
			{ user: 'agent-admin', extra: true },
			{ user: 7 },
			[]
		];
		for (const payload of bodies) {
			const response = await app.inject({
				method: 'POST',
				url: '/test-auth/session',
				headers: { authorization: `Bearer ${TEST_SECRET}`, 'content-type': 'application/json' },
				payload
			});
			assert.equal(response.statusCode, 400, `expected 400 for ${JSON.stringify(payload)}`);
			assert.equal(response.headers['set-cookie'], undefined);
		}
	} finally {
		await app.close();
	}
});

test('seam is structurally absent without the option, and fails closed without sessions', async (t) => {
	const disabled = createApp({ pool: stubPool(), sessionKey: SESSION_KEY, logger: false });
	try {
		const post = await disabled.inject({
			method: 'POST',
			url: '/test-auth/session',
			headers: { authorization: `Bearer ${TEST_SECRET}`, 'content-type': 'application/json' },
			payload: { user: 'agent-admin' }
		});
		assert.equal(post.statusCode, 404);
		const get = await disabled.inject({ method: 'GET', url: '/test-auth/session' });
		assert.equal(get.statusCode, 404);
	} finally {
		await disabled.close();
	}

	const noSessions = createApp({
		pool: stubPool(),
		testAuth: { secret: TEST_SECRET },
		logger: false
	});
	try {
		const post = await noSessions.inject({
			method: 'POST',
			url: '/test-auth/session',
			headers: { authorization: `Bearer ${TEST_SECRET}`, 'content-type': 'application/json' },
			payload: { user: 'agent-admin' }
		});
		assert.equal(post.statusCode, 404);
	} finally {
		await noSessions.close();
	}
});

test('config fails closed and never leaks the secret', async (t) => {
	const base = {
		DATABASE_URL: 'postgres://user@db.example.test/app',
		PORT: '3000',
		EDITOR_ORIGIN: 'https://editor.example.test',
		GOOGLE_CLIENT_ID: 'client-id',
		GOOGLE_CLIENT_SECRET: 'client-secret',
		SESSION_KEY: SESSION_KEY.toString('base64'),
		R2_ENDPOINT: 'https://account.r2.cloudflarestorage.com',
		R2_BUCKET: 'museum-assets',
		R2_ACCESS_KEY_ID: 'access-key',
		R2_SECRET_ACCESS_KEY: 'secret-key'
	};
	assert.equal(readConfig(base).testAuthSecret, undefined);
	assert.equal(readConfig({ ...base, E2E_TEST_AUTH_SECRET: TEST_SECRET }).testAuthSecret, TEST_SECRET);
	assert.throws(
		() => readConfig({ ...base, E2E_TEST_AUTH_SECRET: 'short' }),
		(error) => error instanceof ConfigError && !error.message.includes('short')
	);
});

// --- Real-Postgres cross-ownership: the seam bypasses ceremony, not authorization. ---

let pool;
let poolEnded = false;
let HAS_DB = false;

before(async () => {
	try {
		pool = new Pool({ connectionString: DATABASE_URL, connectionTimeoutMillis: 3000 });
		await pool.query('SELECT 1');
		HAS_DB = true;
	} catch {
		HAS_DB = false;
	}
});

after(async () => {
	// The cross-ownership app below shares this pool and ends it through its
	// own onClose hook; only end here when no app took ownership.
	if (pool && !poolEnded) await pool.end();
});

async function cleanupProject(projectId) {
	if (!HAS_DB) return;
	await pool.query('DELETE FROM save_receipts WHERE project_id = $1', [projectId]);
	await pool.query('DELETE FROM releases WHERE project_id = $1', [projectId]);
	await pool.query('DELETE FROM publications WHERE project_id = $1', [projectId]);
	await pool.query('DELETE FROM assets WHERE project_id = $1', [projectId]);
	await pool.query('DELETE FROM project_versions WHERE project_id = $1', [projectId]);
	await pool.query('DELETE FROM projects WHERE id = $1', [projectId]);
}

test('seam user B cannot reach seam user A projects (real Postgres)', async (t) => {
	if (!HAS_DB) return t.skip('Postgres unreachable');
	await runMigrations(pool);
	await runMigrations(pool);
	const store = { async get() { return null; } };
	const app = createApp({
		pool,
		sessionKey: SESSION_KEY,
		testAuth: { secret: TEST_SECRET },
		objectStore: store,
		logger: false
	});
	const projectId = `e2eseam${Date.now().toString(36)}`;
	const login = (user) =>
		app
			.inject({
				method: 'POST',
				url: '/test-auth/session',
				headers: { authorization: `Bearer ${TEST_SECRET}`, 'content-type': 'application/json' },
				payload: { user }
			})
			.then((response) => {
				assert.equal(response.statusCode, 201);
				return cookieFrom(response);
			});
	try {
		const cookieA = await login('agent-user-a');
		const cookieB = await login('agent-user-b');

		const saved = await app.inject({
			method: 'PUT',
			url: `/projects/${projectId}`,
			headers: { cookie: cookieA, 'content-type': 'application/json' },
			payload: await saveRequestBody(projectDocument('A project', { id: projectId }))
		});
		assert.equal(saved.statusCode, 200);
		const token = saved.json().savedBaseToken;

		const foreignRead = await app.inject({
			method: 'GET',
			url: `/projects/${projectId}`,
			headers: { cookie: cookieB }
		});
		assert.equal(foreignRead.statusCode, 404);

		const foreignWrite = await app.inject({
			method: 'PUT',
			url: `/projects/${projectId}`,
			headers: { cookie: cookieB, 'content-type': 'application/json' },
			payload: await saveRequestBody(projectDocument('B takeover', { id: projectId }), {
				precondition: { kind: 'expected-saved-base', token }
			})
		});
		assert.equal(foreignWrite.statusCode, 404);

		const ownRead = await app.inject({
			method: 'GET',
			url: `/projects/${projectId}`,
			headers: { cookie: cookieA }
		});
		assert.equal(ownRead.statusCode, 200);
		assert.equal(ownRead.json().document.name, 'A project');
	} finally {
		await cleanupProject(projectId);
		await app.close();
		poolEnded = true;
	}
});
