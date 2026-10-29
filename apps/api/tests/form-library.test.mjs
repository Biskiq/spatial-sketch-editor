/**
 * T5.P01.S04 — owner-scoped My Objects storage and routes.
 *
 * Real Postgres, **no skip guards**: the contract is an immutable, content-
 * addressed `form` item that belongs to one owner, survives project deletion,
 * is never reachable across owners and refuses invalid bytes before storing
 * anything. A mock would not prove the owner predicate, the advisory-lock count
 * or the stored bytes.
 *
 * Format-side strictness is proved in
 * `apps/editor/tests/lib/project-model/form-library.test.ts`.
 */
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import test, { after, before } from 'node:test';

import {
	FORM_LIBRARY_MAX_ITEMS,
	canonicalFormLibraryBytes,
	canonicalFormLibraryPayload,
	formLibraryContentId
} from '@portfolio/project-model/library';

import { createApp } from '../dist/app.js';
import { runMigrations } from '../dist/migrate.js';

import {
	SESSION_KEY,
	memoryObjectStore,
	projectDocument,
	saveRequestBody,
	sessionCookie
} from './test-support.mjs';

const DATABASE_URL = process.env.DATABASE_URL ?? 'postgresql://localhost:5432/biskiq';

let pool;
let app;
const owners = new Set();
const projects = new Set();

function payload(overrides = {}) {
	return canonicalFormLibraryPayload({
		formatVersion: 1,
		kind: 'form',
		name: 'Saved plinth',
		form: {
			generator: {
				kind: 'extrude',
				plane: 'plan',
				outline: [
					{ key: 1, u: 0, v: 0, smooth: false },
					{ key: 2, u: 1.4, v: 0, smooth: true },
					{ key: 3, u: 1.4, v: 0.9, smooth: false },
					{ key: 4, u: 0, v: 0.9, smooth: false }
				],
				extent: 0.8
			},
			scale: [1, 1.5, 0.75],
			nextKey: 5
		},
		materialId: 'wood-walnut',
		castShadow: true,
		receiveShadow: true,
		...overrides
	});
}

async function newOwner(label) {
	const id = `google:s04-${label}-${randomUUID()}`;
	await pool.query('INSERT INTO users (id) VALUES ($1) ON CONFLICT DO NOTHING', [id]);
	owners.add(id);
	return { id, cookie: await sessionCookie(app, id) };
}

async function postItem(cookie, item) {
	const contentId = await formLibraryContentId(item);
	return app.inject({
		method: 'POST',
		url: '/library/items',
		headers: {
			...(cookie === undefined ? {} : { cookie }),
			'content-type': 'application/json'
		},
		payload: { contentId, payload: item }
	});
}

async function listItems(cookie) {
	const response = await app.inject({ method: 'GET', url: '/library/items', headers: { cookie } });
	assert.equal(response.statusCode, 200, response.body);
	assert.equal(response.headers['cache-control'], 'private, no-store');
	return response.json().items;
}

function trackItem(id) {
	return id;
}

async function saveProject(cookie, id) {
	projects.add(id);
	const request = await saveRequestBody(projectDocument('Library project', { id }));
	const response = await app.inject({
		method: 'PUT',
		url: `/projects/${id}`,
		headers: { cookie, 'content-type': 'application/json' },
		payload: request
	});
	assert.equal(response.statusCode, 200, response.body);
	return response.json();
}

before(async () => {
	pool = new Pool({ connectionString: DATABASE_URL, connectionTimeoutMillis: 3000 });
	await pool.query('SELECT 1');
	await runMigrations(pool);
	app = createApp({
		pool,
		sessionKey: SESSION_KEY,
		logger: false,
		objectStore: memoryObjectStore(),
		objectNamespace: 'library-test'
	});
	await app.ready();
});

after(async () => {
	for (const owner of owners) {
		await pool.query('DELETE FROM form_library_items WHERE owner_id = $1', [owner]);
	}
	for (const project of projects) {
		await pool.query('DELETE FROM save_receipts WHERE project_id = $1', [project]);
		await pool.query('DELETE FROM project_versions WHERE project_id = $1', [project]);
		await pool.query('DELETE FROM projects WHERE id = $1', [project]);
	}
	for (const owner of owners) await pool.query('DELETE FROM users WHERE id = $1', [owner]);
	if (app) await app.close();
	else if (pool) await pool.end();
});

test('Save stores one canonical owner item that lists, reads and removes', async () => {
	const owner = await newOwner('owner');
	const item = payload();

	const unauthenticated = await app.inject({ method: 'GET', url: '/library/items' });
	assert.equal(unauthenticated.statusCode, 401);
	const unauthenticatedSave = await postItem(undefined, item);
	assert.equal(unauthenticatedSave.statusCode, 401);
	assert.equal((await listItems(owner.cookie)).length, 0);

	const saved = await postItem(owner.cookie, item);
	assert.equal(saved.statusCode, 201, saved.body);
	const summary = saved.json();
	trackItem(summary.id);
	assert.equal(summary.name, 'Saved plinth');
	assert.equal(summary.kind, 'form');
	assert.equal(summary.formatVersion, 1);
	assert.equal(summary.contentId, await formLibraryContentId(item));

	const listed = await listItems(owner.cookie);
	assert.equal(listed.length, 1);
	assert.equal(listed[0].id, summary.id);
	assert.equal(listed[0].contentId, summary.contentId);

	// A new signed-in session lists the same owner item: the library is owner data,
	// not a process or cookie cache.
	const secondSession = await sessionCookie(app, owner.id);
	const relisted = await listItems(secondSession);
	assert.equal(relisted.length, 1);
	assert.equal(relisted[0].id, summary.id);

	const read = await app.inject({
		method: 'GET',
		url: `/library/items/${summary.id}`,
		headers: { cookie: owner.cookie }
	});
	assert.equal(read.statusCode, 200, read.body);
	const expected = Buffer.from(canonicalFormLibraryBytes(item));
	assert.equal(Buffer.compare(Buffer.from(read.rawPayload), expected), 0);
	assert.equal(read.headers['content-type'], 'application/json; charset=utf-8');
	assert.equal(read.headers.etag, `"${summary.contentId}"`);
	assert.equal(read.headers['x-library-format-version'], '1');
	// Remove must be immediate and a later session must re-authorize; owner bytes
	// are never served from a long-lived or shared cache.
	assert.equal(read.headers['cache-control'], 'private, no-store');

	const stored = await pool.query(
		'SELECT canonical_bytes, content_id, format_version FROM form_library_items WHERE id = $1::uuid',
		[summary.id]
	);
	assert.equal(Buffer.compare(stored.rows[0].canonical_bytes, expected), 0);
	assert.equal(stored.rows[0].content_id, summary.contentId);
	assert.equal(stored.rows[0].format_version, 1);

	const removed = await app.inject({
		method: 'DELETE',
		url: `/library/items/${summary.id}`,
		headers: { cookie: owner.cookie }
	});
	assert.equal(removed.statusCode, 204);
	assert.equal((await listItems(owner.cookie)).length, 0);
	const gone = await app.inject({
		method: 'GET',
		url: `/library/items/${summary.id}`,
		headers: { cookie: owner.cookie }
	});
	assert.equal(gone.statusCode, 404);
});

test('a fresh signed-in creator can Save before any project row exists', async () => {
	const id = `google:s04-fresh-${randomUUID()}`;
	owners.add(id);
	const cookie = await sessionCookie(app, id);
	const before = await pool.query('SELECT count(*)::int AS count FROM users WHERE id = $1', [id]);
	assert.equal(before.rows[0].count, 0, 'the fixture must not pre-create the user row');

	const saved = await postItem(cookie, payload({ name: 'First object' }));
	assert.equal(saved.statusCode, 201, saved.body);
	const after = await pool.query('SELECT count(*)::int AS count FROM users WHERE id = $1', [id]);
	assert.equal(after.rows[0].count, 1, 'the library Save admitted the owner identity');
	assert.equal((await listItems(cookie)).length, 1);
});

test('another owner cannot list, read or remove an item, and an unknown id is not found', async () => {
	const owner = await newOwner('scope-owner');
	const stranger = await newOwner('scope-stranger');
	const saved = await postItem(owner.cookie, payload({ name: 'Private plinth' }));
	assert.equal(saved.statusCode, 201, saved.body);
	const id = saved.json().id;

	assert.equal((await listItems(stranger.cookie)).length, 0);
	for (const method of ['GET', 'DELETE']) {
		const response = await app.inject({
			method,
			url: `/library/items/${id}`,
			headers: { cookie: stranger.cookie }
		});
		assert.equal(response.statusCode, 404, `${method} by a stranger must be not found`);
	}
	const unknown = await app.inject({
		method: 'GET',
		url: `/library/items/${randomUUID()}`,
		headers: { cookie: owner.cookie }
	});
	assert.equal(unknown.statusCode, 404);
	const invalid = await app.inject({
		method: 'GET',
		url: '/library/items/not-a-uuid',
		headers: { cookie: owner.cookie }
	});
	assert.equal(invalid.statusCode, 404);

	const stillThere = await app.inject({
		method: 'GET',
		url: `/library/items/${id}`,
		headers: { cookie: owner.cookie }
	});
	assert.equal(stillThere.statusCode, 200);
});

test('malformed, wrong-format and content-id-mismatched payloads store nothing', async () => {
	const owner = await newOwner('refusals');
	const valid = payload();

	const unknown = await postItem(owner.cookie, { ...valid, extra: true });
	assert.equal(unknown.statusCode, 400);
	assert.equal(unknown.json().error.code, 'invalid_library_item');

	const otherFormat = await postItem(owner.cookie, { ...valid, formatVersion: 2 });
	assert.equal(otherFormat.statusCode, 400);
	assert.equal(otherFormat.json().error.code, 'invalid_library_item');

	const malformedForm = await postItem(owner.cookie, {
		...valid,
		form: { ...valid.form, generator: { ...valid.form.generator, extent: 0 } }
	});
	assert.equal(malformedForm.statusCode, 400);

	const unknownMaterial = await postItem(owner.cookie, { ...valid, materialId: 'unobtainium' });
	assert.equal(unknownMaterial.statusCode, 400);
	assert.equal(unknownMaterial.json().error.code, 'invalid_library_item');

	const mismatch = await app.inject({
		method: 'POST',
		url: '/library/items',
		headers: { cookie: owner.cookie, 'content-type': 'application/json' },
		payload: { contentId: `sha256-${'0'.repeat(64)}`, payload: valid }
	});
	assert.equal(mismatch.statusCode, 400);
	assert.equal(mismatch.json().error.code, 'content_id_mismatch');

	const notJson = await app.inject({
		method: 'POST',
		url: '/library/items',
		headers: { cookie: owner.cookie, 'content-type': 'text/plain' },
		payload: '{}'
	});
	assert.equal(notJson.statusCode, 415);

	assert.equal((await listItems(owner.cookie)).length, 0, 'no refused request stored a row');
});

test('a full library refuses Save in words and stores nothing', async () => {
	const owner = await newOwner('full');
	await pool.query(
		`INSERT INTO form_library_items
			(id, owner_id, kind, name, format_version, content_id, canonical_bytes)
		 SELECT gen_random_uuid(), $1, 'form', 'Bulk ' || value, 1,
			'sha256-' || repeat('a', 64), convert_to('{}', 'UTF8')
		 FROM generate_series(1, $2) AS value`,
		[owner.id, FORM_LIBRARY_MAX_ITEMS]
	);
	assert.equal((await listItems(owner.cookie)).length, FORM_LIBRARY_MAX_ITEMS);

	const refused = await postItem(owner.cookie, payload({ name: 'One too many' }));
	assert.equal(refused.statusCode, 409);
	assert.equal(refused.json().error.code, 'library_full');
	assert.match(refused.json().error.message, /Remove an item/i);
	const count = await pool.query(
		'SELECT count(*)::int AS count FROM form_library_items WHERE owner_id = $1',
		[owner.id]
	);
	assert.equal(count.rows[0].count, FORM_LIBRARY_MAX_ITEMS);
});

test('deleting a project leaves the item, and removing the item leaves the project', async () => {
	const owner = await newOwner('lifecycle');
	const projectId = `s04lib${Date.now().toString(36)}${randomUUID().slice(0, 6)}`;
	const acknowledgement = await saveProject(owner.cookie, projectId);
	const saved = await postItem(owner.cookie, payload({ name: 'Survives deletion' }));
	assert.equal(saved.statusCode, 201, saved.body);
	const id = saved.json().id;

	const deleted = await app.inject({
		method: 'DELETE',
		url: `/projects/${projectId}`,
		headers: { cookie: owner.cookie, 'content-type': 'application/json' },
		payload: {
			precondition: { kind: 'expected-saved-base', token: acknowledgement.savedBaseToken }
		}
	});
	assert.ok([200, 202].includes(deleted.statusCode), deleted.body);
	assert.equal((await listItems(owner.cookie)).some((item) => item.id === id), true);

	const removed = await app.inject({
		method: 'DELETE',
		url: `/library/items/${id}`,
		headers: { cookie: owner.cookie }
	});
	assert.equal(removed.statusCode, 204);
	const project = await app.inject({
		method: 'GET',
		url: `/projects/${projectId}`,
		headers: { cookie: owner.cookie }
	});
	assert.equal(project.statusCode, 404, 'the deleted project stays deleted when an item is removed');
});

test('an item stored by another development format stays listed, readable and removable', async () => {
	const owner = await newOwner('older-format');
	const bytes = Buffer.from(JSON.stringify({ formatVersion: 2, kind: 'form', name: 'Older' }), 'utf8');
	const contentId = `sha256-${createHash('sha256').update(bytes).digest('hex')}`;
	const id = randomUUID();
	await pool.query(
		`INSERT INTO form_library_items
			(id, owner_id, kind, name, format_version, content_id, canonical_bytes)
		 VALUES ($1::uuid, $2, 'form', 'Older', 2, $3, $4)`,
		[id, owner.id, contentId, bytes]
	);

	const listed = await listItems(owner.cookie);
	const item = listed.find((candidate) => candidate.id === id);
	assert.ok(item);
	assert.equal(item.formatVersion, 2);
	const read = await app.inject({
		method: 'GET',
		url: `/library/items/${id}`,
		headers: { cookie: owner.cookie }
	});
	assert.equal(read.statusCode, 200);
	assert.equal(read.headers['x-library-format-version'], '2');
	assert.equal(Buffer.compare(Buffer.from(read.rawPayload), bytes), 0);

	const removed = await app.inject({
		method: 'DELETE',
		url: `/library/items/${id}`,
		headers: { cookie: owner.cookie }
	});
	assert.equal(removed.statusCode, 204);
});
