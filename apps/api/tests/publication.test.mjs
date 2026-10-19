/**
 * Publication gap conformance (AM-9, R4; T3.P01.S04).
 *
 * Publishing is unavailable until `T4.P01.S05`. Publish/Update answer
 * `prepared-reader-required`, every public read is an honest not-found, and
 * status/Unpublish stay truthful. Real Postgres, **no skip guards**.
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import test, { after, before } from 'node:test';

import { createApp } from '../dist/app.js';
import { runMigrations } from '../dist/migrate.js';

import { SESSION_KEY, projectDocument, saveRequestBody, sessionCookie } from './test-support.mjs';

const DATABASE_URL = process.env.DATABASE_URL ?? 'postgresql://localhost:5432/biskiq';

let pool;
let app;
const createdProjects = [];
let counter = 0;

function nextProjectId() {
	counter += 1;
	return `s04pub${Date.now().toString(36)}${counter}${randomUUID().slice(0, 8)}`;
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

async function saveDoc(projectId, cookie) {
	const response = await app.inject({
		method: 'PUT',
		url: `/projects/${projectId}`,
		headers: { cookie, 'content-type': 'application/json' },
		payload: await saveRequestBody(projectDocument('Gap project', { id: projectId }))
	});
	assert.equal(response.statusCode, 200, JSON.stringify(response.json()));
	return response.json();
}

before(async () => {
	pool = new Pool({ connectionString: DATABASE_URL, connectionTimeoutMillis: 3000 });
	await pool.query('SELECT 1');
	await runMigrations(pool);
	app = createApp({ pool, sessionKey: SESSION_KEY, logger: false });
	await app.ready();
});

after(async () => {
	for (const projectId of createdProjects) await cleanupProject(projectId);
	if (app) await app.close();
	else if (pool) await pool.end();
});

test('Publish and Update answer prepared-reader-required and write nothing', async () => {
	const owner = 'google:s04-publish-gap';
	const cookie = await sessionCookie(app, owner);
	const projectId = track(nextProjectId());
	const saved = await saveDoc(projectId, cookie);

	for (const payload of [
		{ version: saved.version, expectedPublicationRevision: 0 },
		{ version: 1, expectedPublicationRevision: 0 }
	]) {
		const response = await app.inject({
			method: 'PUT',
			url: `/projects/${projectId}/publication`,
			headers: { cookie, 'content-type': 'application/json' },
			payload
		});
		assert.equal(response.statusCode, 501);
		assert.deepEqual(response.json(), {
			error: {
				code: 'prepared-reader-required',
				message: 'Publishing requires the prepared reader'
			}
		});
	}
	const rows = await pool.query('SELECT 1 FROM publications WHERE project_id = $1', [projectId]);
	assert.equal(rows.rows.length, 0);
	const releases = await pool.query('SELECT 1 FROM releases WHERE project_id = $1', [projectId]);
	assert.equal(releases.rows.length, 0);
});

test('Publish still requires an owner session', async () => {
	const response = await app.inject({
		method: 'PUT',
		url: `/projects/${nextProjectId()}/publication`,
		headers: { 'content-type': 'application/json' },
		payload: { version: 1, expectedPublicationRevision: 0 }
	});
	assert.equal(response.statusCode, 401);
});

test('status is truthful for a never-published F.2 project and owner scoped', async () => {
	const cookie = await sessionCookie(app, 'google:s04-pub-status');
	const stranger = await sessionCookie(app, 'google:s04-pub-stranger');
	const projectId = track(nextProjectId());
	const saved = await saveDoc(projectId, cookie);

	const status = await app.inject({
		method: 'GET',
		url: `/projects/${projectId}/publication`,
		headers: { cookie }
	});
	assert.equal(status.statusCode, 200);
	assert.deepEqual(status.json(), {
		publicationId: null,
		activeVersion: null,
		revision: 0,
		currentVersion: saved.version,
		createdAt: null,
		updatedAt: null
	});

	const other = await app.inject({
		method: 'GET',
		url: `/projects/${projectId}/publication`,
		headers: { cookie: stranger }
	});
	assert.equal(other.statusCode, 404);
});

test('Unpublish stays truthful, OCC-checked and idempotent for a retained row', async () => {
	const cookie = await sessionCookie(app, 'google:s04-pub-unpublish');
	const projectId = track(nextProjectId());
	await saveDoc(projectId, cookie);
	const publicId = randomUUID();
	await pool.query(
		`INSERT INTO publications (project_id, public_id, active_version, revision)
		 VALUES ($1, $2, 1, 2)`,
		[projectId, publicId]
	);

	const status = await app.inject({
		method: 'GET',
		url: `/projects/${projectId}/publication`,
		headers: { cookie }
	});
	assert.equal(status.json().publicationId, publicId);
	assert.equal(status.json().activeVersion, 1);
	assert.equal(status.json().revision, 2);

	const stale = await app.inject({
		method: 'DELETE',
		url: `/projects/${projectId}/publication`,
		headers: { cookie, 'content-type': 'application/json' },
		payload: { expectedPublicationRevision: 1 }
	});
	assert.equal(stale.statusCode, 409);
	assert.equal(stale.json().error.code, 'revision_conflict');

	const unpublished = await app.inject({
		method: 'DELETE',
		url: `/projects/${projectId}/publication`,
		headers: { cookie, 'content-type': 'application/json' },
		payload: { expectedPublicationRevision: 2 }
	});
	assert.equal(unpublished.statusCode, 200);
	assert.equal(unpublished.json().activeVersion, null);
	assert.equal(unpublished.json().revision, 3);

	const again = await app.inject({
		method: 'DELETE',
		url: `/projects/${projectId}/publication`,
		headers: { cookie, 'content-type': 'application/json' },
		payload: { expectedPublicationRevision: 3 }
	});
	assert.equal(again.statusCode, 200);
	assert.equal(again.json().revision, 3);
});

test('Unpublish of a never-published project is an honest not-found', async () => {
	const cookie = await sessionCookie(app, 'google:s04-pub-unpublish');
	const projectId = track(nextProjectId());
	await saveDoc(projectId, cookie);
	const response = await app.inject({
		method: 'DELETE',
		url: `/projects/${projectId}/publication`,
		headers: { cookie, 'content-type': 'application/json' },
		payload: { expectedPublicationRevision: 0 }
	});
	assert.equal(response.statusCode, 404);
});

test('every public read is an honest not-found, including a prior /p/ ID', async () => {
	const publicationId = randomUUID();
	const document = await app.inject({ method: 'GET', url: `/publications/${publicationId}` });
	assert.equal(document.statusCode, 404);
	assert.equal(document.headers['cache-control'], 'no-store');
	assert.deepEqual(document.json(), { error: { code: 'not_found', message: 'Not Found' } });

	const asset = await app.inject({
		method: 'GET',
		url: `/publications/${publicationId}/versions/1/assets/${randomUUID()}/content`
	});
	assert.equal(asset.statusCode, 404);
	assert.equal(asset.headers['cache-control'], 'no-store');
});
