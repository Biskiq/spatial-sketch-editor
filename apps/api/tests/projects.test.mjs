/**
 * API contract: project Save/Load, immutable versions, owner isolation and
 * request-body validation. Split out of `api.test.mjs` by WP3T.
 *
 * Runs against the in-memory pool double, so it needs no Postgres and still
 * exercises the real route/validation/transaction path through HTTP injection.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import { createApp } from '../dist/app.js';

import { memoryPool, projectDocument, SESSION_KEY, sessionCookie } from './test-support.mjs';

test('project save/load appends immutable versions and isolates owners', async () => {
	const pool = memoryPool();
	const app = createApp({ pool, sessionKey: SESSION_KEY, logger: false });
	try {
		const userOne = await sessionCookie(app, 'google:user-1');
		const userTwo = await sessionCookie(app, 'google:user-2');
		const first = await app.inject({
			method: 'PUT',
			url: '/projects/project:test',
			headers: { cookie: userOne },
			payload: { document: projectDocument() }
		});
		const secondDocument = projectDocument('Renamed project');
		const second = await app.inject({
			method: 'PUT',
			url: '/projects/project:test',
			headers: { cookie: userOne },
			payload: { document: secondDocument }
		});
		const loaded = await app.inject({ method: 'GET', url: '/projects/project:test', headers: { cookie: userOne } });
		const list = await app.inject({ method: 'GET', url: '/projects', headers: { cookie: userOne } });
		const otherList = await app.inject({ method: 'GET', url: '/projects', headers: { cookie: userTwo } });
		const otherLoad = await app.inject({ method: 'GET', url: '/projects/project:test', headers: { cookie: userTwo } });
		const otherSave = await app.inject({
			method: 'PUT',
			url: '/projects/project:test',
			headers: { cookie: userTwo },
			payload: { document: projectDocument('Intruder') }
		});

		assert.equal(first.statusCode, 200);
		assert.equal(first.json().version, 1);
		assert.equal(second.statusCode, 200);
		assert.equal(second.json().version, 2);
		assert.equal(loaded.statusCode, 200);
		assert.deepEqual(loaded.json().document, secondDocument);
		assert.deepEqual(list.json().projects.map(({ id, version }) => ({ id, version })), [{ id: 'project:test', version: 2 }]);
		assert.deepEqual(otherList.json(), { projects: [] });
		assert.equal(otherLoad.statusCode, 404);
		assert.equal(otherSave.statusCode, 404);
		assert.deepEqual(pool.versions.get('project:test').get(1), projectDocument());
		assert.equal(pool.calls.filter(({ text }) => text.includes('INSERT INTO users')).length, 3);
	} finally {
		await app.close();
	}
});

test('project body parsing keeps malformed, invalid, mismatched, and oversized JSON distinct', async () => {
	const app = createApp({ pool: memoryPool(), sessionKey: SESSION_KEY, logger: false });
	try {
		const cookie = await sessionCookie(app, 'google:user-1');
		const headers = { cookie, 'content-type': 'application/json' };
		const malformed = await app.inject({ method: 'PUT', url: '/projects/project:test', headers, payload: '{"document":' });
		const invalidDocument = await app.inject({
			method: 'PUT',
			url: '/projects/project:test',
			headers,
			payload: JSON.stringify({ document: { id: 'project:test', name: 'Missing fields' } })
		});
		const mismatchedDocument = await app.inject({
			method: 'PUT',
			url: '/projects/project:test',
			headers,
			payload: JSON.stringify({ document: { ...projectDocument(), id: 'project:other' } })
		});
		const oversized = await app.inject({
			method: 'PUT',
			url: '/projects/project:test',
			headers,
			payload: JSON.stringify({ document: 'x'.repeat(2 * 1024 * 1024) })
		});
		assert.equal(malformed.statusCode, 400);
		assert.equal(invalidDocument.statusCode, 400);
		assert.equal(invalidDocument.json().error.code, 'invalid_project');
		assert.equal(mismatchedDocument.statusCode, 400);
		assert.equal(mismatchedDocument.json().error.code, 'project_id_mismatch');
		assert.equal(oversized.statusCode, 413);
	} finally {
		await app.close();
	}
});

test('project payload just under 2 MiB is accepted', async () => {
	const pool = memoryPool();
	const app = createApp({ pool, sessionKey: SESSION_KEY, logger: false });
	try {
		const cookie = await sessionCookie(app, 'google:user-1');
		const limit = 2 * 1024 * 1024;
		const basePayload = JSON.stringify({ document: projectDocument('') });
		const name = 'x'.repeat(limit - Buffer.byteLength(basePayload) - 1);
		const payload = JSON.stringify({ document: projectDocument(name) });
		assert.equal(Buffer.byteLength(payload), limit - 1);

		const response = await app.inject({
			method: 'PUT',
			url: '/projects/project:test',
			headers: { cookie, 'content-type': 'application/json' },
			payload
		});

		assert.equal(response.statusCode, 200);
		assert.equal(response.json().version, 1);
	} finally {
		await app.close();
	}
});
