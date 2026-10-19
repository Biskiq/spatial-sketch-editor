/**
 * API contract: conditional project Save/Load, immutable versions, owner
 * isolation, saved-base metadata and request-body validation.
 *
 * Runs against real Postgres with **no skip guards**: the Save contract is an
 * OCC/storage contract, and a mock would not prove it. The DB-backed lane is
 * `npm run test:api` with a reachable `DATABASE_URL`.
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import test, { after, before } from 'node:test';

import { createApp } from '../dist/app.js';
import { runMigrations } from '../dist/migrate.js';

import {
	SESSION_KEY,
	projectDocument,
	saveRequestBody,
	sessionCookie
} from './test-support.mjs';

const DATABASE_URL = process.env.DATABASE_URL ?? 'postgresql://localhost:5432/biskiq';

let pool;
let app;
const createdProjects = [];
let counter = 0;

function nextProjectId() {
	counter += 1;
	return `s02proj${Date.now().toString(36)}${counter}${randomUUID().slice(0, 8)}`;
}

function track(projectId) {
	createdProjects.push(projectId);
	return projectId;
}

async function cleanupProject(projectId) {
	await pool.query('DELETE FROM save_receipts WHERE project_id = $1', [projectId]);
	await pool.query('DELETE FROM releases WHERE project_id = $1', [projectId]);
	await pool.query('DELETE FROM publications WHERE project_id = $1', [projectId]);
	await pool.query('DELETE FROM assets WHERE project_id = $1', [projectId]);
	await pool.query('DELETE FROM project_versions WHERE project_id = $1', [projectId]);
	await pool.query('DELETE FROM projects WHERE id = $1', [projectId]);
}

async function save(projectId, cookie, request) {
	return app.inject({
		method: 'PUT',
		url: `/projects/${projectId}`,
		headers: { cookie, 'content-type': 'application/json' },
		payload: request
	});
}

before(async () => {
	pool = new Pool({ connectionString: DATABASE_URL, connectionTimeoutMillis: 3000 });
	await pool.query('SELECT 1');
	await runMigrations(pool);
	await runMigrations(pool);
	app = createApp({ pool, sessionKey: SESSION_KEY, logger: false });
	await app.ready();
});

after(async () => {
	for (const projectId of createdProjects) await cleanupProject(projectId);
	if (app) await app.close();
	else if (pool) await pool.end();
});

test('conditional save/load appends immutable versions and isolates owners', async () => {
	const projectId = track(nextProjectId());
	const ownerOne = await sessionCookie(app, 'google:s02-owner-1');
	const ownerTwo = await sessionCookie(app, 'google:s02-owner-2');

	const firstDocument = projectDocument('First save', { id: projectId });
	const firstRequest = await saveRequestBody(firstDocument);
	const first = await save(projectId, ownerOne, firstRequest);
	assert.equal(first.statusCode, 200, JSON.stringify(first.json()));
	const firstSaved = first.json();
	assert.equal(firstSaved.version, 1);
	assert.match(firstSaved.savedBaseToken, /^saved-base:/);
	assert.deepEqual(firstSaved.savedRevision, firstRequest.capture.acceptedRevision);
	assert.equal(firstSaved.sourceContentId, firstRequest.capture.sourceContentId);

	const secondDocument = projectDocument('Renamed project', { id: projectId });
	const secondRequest = await saveRequestBody(secondDocument, {
		precondition: { kind: 'expected-saved-base', token: firstSaved.savedBaseToken }
	});
	const second = await save(projectId, ownerOne, secondRequest);
	assert.equal(second.statusCode, 200, JSON.stringify(second.json()));
	const secondSaved = second.json();
	assert.equal(secondSaved.version, 2);
	assert.notEqual(secondSaved.savedBaseToken, firstSaved.savedBaseToken);

	const loaded = await app.inject({
		method: 'GET',
		url: `/projects/${projectId}`,
		headers: { cookie: ownerOne }
	});
	assert.equal(loaded.statusCode, 200);
	const loadedBody = loaded.json();
	assert.deepEqual(loadedBody.document, JSON.parse(secondRequest.capture.canonicalJson));
	assert.equal(loadedBody.savedBaseToken, secondSaved.savedBaseToken);
	assert.deepEqual(loadedBody.savedRevision, secondRequest.capture.acceptedRevision);
	assert.equal(loadedBody.savedSourceContentId, secondRequest.capture.sourceContentId);

	const list = await app.inject({ method: 'GET', url: '/projects', headers: { cookie: ownerOne } });
	const summary = list.json().projects.find((project) => project.id === projectId);
	assert.deepEqual(summary && { id: summary.id, version: summary.version }, { id: projectId, version: 2 });

	const otherList = await app.inject({ method: 'GET', url: '/projects', headers: { cookie: ownerTwo } });
	assert.equal(otherList.json().projects.some((project) => project.id === projectId), false);
	const otherLoad = await app.inject({
		method: 'GET',
		url: `/projects/${projectId}`,
		headers: { cookie: ownerTwo }
	});
	assert.equal(otherLoad.statusCode, 404);

	// Another owner's project under expected-saved-base is not-found, and a
	// create-only Save on an existing ID is the same owner-blind collision.
	const intruderExpected = await save(projectId, ownerTwo, secondRequest);
	assert.equal(intruderExpected.statusCode, 404);
	assert.equal(intruderExpected.json().error.code, 'not_found');
	const collision = await save(projectId, ownerTwo, await saveRequestBody(projectDocument('Intruder', { id: projectId })));
	assert.equal(collision.statusCode, 409);
	assert.equal(collision.json().error.code, 'save_collision');
	assert.equal(Object.keys(collision.json()).sort().join(','), 'error');

	// The old unconditional client is refused with no write and no implicit create.
	const unconditioned = await save(projectId, ownerOne, { document: projectDocument('Old client', { id: projectId }) });
	assert.equal(unconditioned.statusCode, 400);
	assert.equal(unconditioned.json().error.code, 'precondition_required');

	const versions = await pool.query(
		'SELECT version, document FROM project_versions WHERE project_id = $1 ORDER BY version',
		[projectId]
	);
	assert.deepEqual(versions.rows.map((row) => row.version), [1, 2]);
	assert.deepEqual(versions.rows[0].document, JSON.parse(firstRequest.capture.canonicalJson));
	assert.deepEqual(versions.rows[1].document, JSON.parse(secondRequest.capture.canonicalJson));

	// A stale expected base is a conflict carrying no remote contents.
	const staleRequest = await saveRequestBody(projectDocument('Stale', { id: projectId }), {
		precondition: { kind: 'expected-saved-base', token: firstSaved.savedBaseToken }
	});
	const conflict = await save(projectId, ownerOne, staleRequest);
	assert.equal(conflict.statusCode, 409);
	assert.deepEqual(conflict.json(), {
		error: { code: 'conflict', message: 'The saved base changed; reload before saving' }
	});
});

test('project body parsing keeps malformed, invalid, mismatched and oversized requests distinct', async () => {
	const projectId = track(nextProjectId());
	const cookie = await sessionCookie(app, 'google:s02-owner-1');
	const headers = { cookie, 'content-type': 'application/json' };

	const malformed = await app.inject({
		method: 'PUT',
		url: `/projects/${projectId}`,
		headers,
		payload: '{"contentIdentityScheme":'
	});
	assert.equal(malformed.statusCode, 400);
	assert.equal(malformed.json().error.code, 'invalid_json');

	const invalidCapture = await app.inject({
		method: 'PUT',
		url: `/projects/${projectId}`,
		headers,
		payload: { contentIdentityScheme: 'project-model/canonical-authored-json@1', capture: {} }
	});
	assert.equal(invalidCapture.statusCode, 400);
	assert.equal(invalidCapture.json().error.code, 'invalid_save_request');

	const mismatched = await save(
		projectId,
		cookie,
		await saveRequestBody(projectDocument('Other', { id: 'project:other' }))
	);
	assert.equal(mismatched.statusCode, 400);
	assert.equal(mismatched.json().error.code, 'project_id_mismatch');

	const request = await saveRequestBody(projectDocument('Placeholder', { id: projectId }));
	const invalidProject = await save(projectId, cookie, {
		...request,
		capture: {
			...request.capture,
			canonicalJson: JSON.stringify({ id: projectId, name: 'Missing fields' }) + '\n'
		}
	});
	assert.equal(invalidProject.statusCode, 400);
	assert.equal(invalidProject.json().error.code, 'invalid_project');

	const oversized = await save(
		projectId,
		cookie,
		await saveRequestBody(projectDocument('x'.repeat(2 * 1024 * 1024), { id: projectId }))
	);
	assert.equal(oversized.statusCode, 413);
	assert.equal(oversized.json().error.code, 'payload_too_large');

	const unconditioned = await save(projectId, cookie, { document: projectDocument('Old', { id: projectId }) });
	assert.equal(unconditioned.statusCode, 400);
	assert.equal(unconditioned.json().error.code, 'precondition_required');

	const count = await pool.query('SELECT count(*)::int AS count FROM project_versions WHERE project_id = $1', [
		projectId
	]);
	assert.equal(count.rows[0].count, 0);
});

test('project payload just under 2 MiB is accepted', async () => {
	const projectId = track(nextProjectId());
	const cookie = await sessionCookie(app, 'google:s02-owner-1');
	const limit = 2 * 1024 * 1024;

	let name = 'x';
	let payload = '';
	for (let attempt = 0; attempt < 10; attempt += 1) {
		payload = JSON.stringify(await saveRequestBody(projectDocument(name, { id: projectId })));
		const size = Buffer.byteLength(payload);
		if (size >= limit) {
			name = name.slice(0, Math.max(1, name.length - Math.ceil((size - limit + 2) / 2)));
			continue;
		}
		const remaining = limit - 1 - size;
		if (remaining < 16) break;
		// The name appears in the document and again inside the captured
		// canonical JSON, so one added character costs roughly two bytes.
		name += 'x'.repeat(Math.max(1, Math.floor(remaining / 2) - 1));
	}
	payload = JSON.stringify(await saveRequestBody(projectDocument(name, { id: projectId })));
	assert.ok(Buffer.byteLength(payload) < limit);
	assert.ok(Buffer.byteLength(payload) > limit - 4096);

	const response = await app.inject({
		method: 'PUT',
		url: `/projects/${projectId}`,
		headers: { cookie, 'content-type': 'application/json' },
		payload
	});
	assert.equal(response.statusCode, 200, JSON.stringify(response.json()));
	assert.equal(response.json().version, 1);
});
