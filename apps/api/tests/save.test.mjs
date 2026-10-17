/**
 * Conditional Save conformance (T3.P01.S02, AM-4
 * `conditional-save-current-v1`). Real Postgres, **no skip guards**: these are
 * the OCC, collision, receipt and atomicity contracts, and a mock cannot prove
 * them. `npm run test:api` is the owning lane.
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
	return `s02save${Date.now().toString(36)}${counter}${randomUUID().slice(0, 8)}`;
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

async function createProject(cookie, document) {
	const projectId = track(document.id);
	const request = await saveRequestBody(document);
	const response = await save(projectId, cookie, request);
	assert.equal(response.statusCode, 200, JSON.stringify(response.json()));
	return { projectId, request, acknowledgement: response.json() };
}

async function counts(projectId) {
	const result = await pool.query(
		`SELECT
	(SELECT count(*)::int FROM project_versions WHERE project_id = $1) AS versions,
	(SELECT count(*)::int FROM save_receipts WHERE project_id = $1) AS receipts,
	(SELECT latest_version FROM projects WHERE id = $1) AS "latestVersion",
	(SELECT saved_base_token FROM projects WHERE id = $1) AS "savedBaseToken"`,
		[projectId]
	);
	return result.rows[0];
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

test('same-base writers: exactly one winner, the loser gets a conflict and no version', async () => {
	const cookie = await sessionCookie(app, 'google:s02-save-1');
	const projectId = track(nextProjectId());
	const first = await save(projectId, cookie, await saveRequestBody(projectDocument('Base', { id: projectId })));
	assert.equal(first.statusCode, 200);
	const token = first.json().savedBaseToken;

	const [left, right] = await Promise.all([
		save(
			projectId,
			cookie,
			await saveRequestBody(projectDocument('Left', { id: projectId }), {
				precondition: { kind: 'expected-saved-base', token }
			})
		),
		save(
			projectId,
			cookie,
			await saveRequestBody(projectDocument('Right', { id: projectId }), {
				precondition: { kind: 'expected-saved-base', token }
			})
		)
	]);
	const responses = [left, right];
	const winners = responses.filter((response) => response.statusCode === 200);
	const losers = responses.filter((response) => response.statusCode === 409);
	assert.equal(winners.length, 1);
	assert.equal(losers.length, 1);
	assert.equal(losers[0].json().error.code, 'conflict');
	assert.equal(Object.keys(losers[0].json()).sort().join(','), 'error');
	const state = await counts(projectId);
	assert.equal(state.versions, 2);
	assert.equal(state.latestVersion, 2);
	assert.equal(state.receipts, 2);
	assert.notEqual(state.savedBaseToken, token);
});

test('concurrent identical retries both replay the winner receipt without a second version', async () => {
	const cookie = await sessionCookie(app, 'google:s02-save-1');
	const { projectId, acknowledgement } = await createProject(
		cookie,
		projectDocument('Retry race', { id: nextProjectId() })
	);
	const request = await saveRequestBody(projectDocument('Retry race updated', { id: projectId }), {
		precondition: { kind: 'expected-saved-base', token: acknowledgement.savedBaseToken }
	});
	const [left, right] = await Promise.all([save(projectId, cookie, request), save(projectId, cookie, request)]);
	assert.equal(left.statusCode, 200, JSON.stringify(left.json()));
	assert.equal(right.statusCode, 200, JSON.stringify(right.json()));
	assert.deepEqual(left.json(), right.json());
	assert.equal(left.json().version, 2);
	const state = await counts(projectId);
	assert.equal(state.versions, 2);
	assert.equal(state.receipts, 2);
});

test('concurrent create-only: exactly one winner and one collision', async () => {
	const cookie = await sessionCookie(app, 'google:s02-save-1');
	const projectId = track(nextProjectId());
	const [left, right] = await Promise.all([
		save(projectId, cookie, await saveRequestBody(projectDocument('Left create', { id: projectId }))),
		save(projectId, cookie, await saveRequestBody(projectDocument('Right create', { id: projectId })))
	]);
	const responses = [left, right];
	assert.equal(responses.filter((response) => response.statusCode === 200).length, 1);
	const collisions = responses.filter((response) => response.statusCode === 409);
	assert.equal(collisions.length, 1);
	assert.equal(collisions[0].json().error.code, 'save_collision');
	const state = await counts(projectId);
	assert.equal(state.versions, 1);
	assert.equal(state.receipts, 1);
});

test('create-only collision is owner-blind and another owner is not-found', async () => {
	const owner = await sessionCookie(app, 'google:s02-save-1');
	const stranger = await sessionCookie(app, 'google:s02-save-2');
	const { projectId, acknowledgement } = await createProject(
		owner,
		projectDocument('Owned', { id: nextProjectId() })
	);

	const ownerCollision = await save(
		projectId,
		owner,
		await saveRequestBody(projectDocument('Owner retry', { id: projectId }))
	);
	const strangerCollision = await save(
		projectId,
		stranger,
		await saveRequestBody(projectDocument('Stranger retry', { id: projectId }))
	);
	assert.equal(ownerCollision.statusCode, 409);
	assert.equal(strangerCollision.statusCode, 409);
	assert.deepEqual(strangerCollision.json(), ownerCollision.json());
	assert.deepEqual(ownerCollision.json(), {
		error: { code: 'save_collision', message: 'A project with this ID already exists' }
	});

	const strangerExpected = await save(
		projectId,
		stranger,
		await saveRequestBody(projectDocument('Stranger expected', { id: projectId }), {
			precondition: { kind: 'expected-saved-base', token: acknowledgement.savedBaseToken }
		})
	);
	assert.equal(strangerExpected.statusCode, 404);
	assert.equal(strangerExpected.json().error.code, 'not_found');
});

test('retry replays the original receipt; a changed payload under the same ID refuses', async () => {
	const cookie = await sessionCookie(app, 'google:s02-save-1');
	const { projectId, request, acknowledgement } = await createProject(
		cookie,
		projectDocument('Receipt', { id: nextProjectId() })
	);

	const replay = await save(projectId, cookie, request);
	assert.equal(replay.statusCode, 200);
	assert.deepEqual(replay.json(), acknowledgement);

	const changed = await saveRequestBody(projectDocument('Changed payload', { id: projectId }), {
		precondition: request.capture.precondition,
		revisionId: request.capture.acceptedRevision.revisionId,
		operationId: request.capture.operationId
	});
	const refused = await save(projectId, cookie, changed);
	assert.equal(refused.statusCode, 400);
	assert.equal(refused.json().error.code, 'retry-payload-mismatch');

	const changedPrecondition = {
		...request,
		capture: {
			...request.capture,
			precondition: { kind: 'expected-saved-base', token: acknowledgement.savedBaseToken }
		}
	};
	const preconditionRefused = await save(projectId, cookie, changedPrecondition);
	assert.equal(preconditionRefused.statusCode, 400);
	assert.equal(preconditionRefused.json().error.code, 'retry-payload-mismatch');

	const state = await counts(projectId);
	assert.equal(state.versions, 1);
	assert.equal(state.receipts, 1);
});

test('no partial version/pointer update when the pointer write fails', async () => {
	const cookie = await sessionCookie(app, 'google:s02-save-1');
	const { projectId, acknowledgement } = await createProject(
		cookie,
		projectDocument('Atomic', { id: nextProjectId() })
	);
	const triggerId = `s02_fail_${projectId.replace(/[^A-Za-z0-9_]/g, '_')}`;
	await pool.query(
		`CREATE OR REPLACE FUNCTION ${triggerId}() RETURNS trigger AS $$
		BEGIN
			RAISE EXCEPTION 'injected pointer failure';
		END;
		$$ LANGUAGE plpgsql`
	);
	await pool.query(
		`CREATE TRIGGER ${triggerId} BEFORE UPDATE ON projects
		FOR EACH ROW WHEN (NEW.id = '${projectId}')
		EXECUTE FUNCTION ${triggerId}()`
	);
	try {
		const attempted = await save(
			projectId,
			cookie,
			await saveRequestBody(projectDocument('Should roll back', { id: projectId }), {
				precondition: { kind: 'expected-saved-base', token: acknowledgement.savedBaseToken }
			})
		);
		assert.equal(attempted.statusCode, 503);
		assert.equal(attempted.json().error.code, 'service_unavailable');
	} finally {
		await pool.query(`DROP TRIGGER IF EXISTS ${triggerId} ON projects`);
		await pool.query(`DROP FUNCTION IF EXISTS ${triggerId}()`);
	}
	const state = await counts(projectId);
	assert.equal(state.versions, 1);
	assert.equal(state.receipts, 1);
	assert.equal(state.latestVersion, 1);
	assert.equal(state.savedBaseToken, acknowledgement.savedBaseToken);

	const repaired = await save(
		projectId,
		cookie,
		await saveRequestBody(projectDocument('After rollback', { id: projectId }), {
			precondition: { kind: 'expected-saved-base', token: acknowledgement.savedBaseToken }
		})
	);
	assert.equal(repaired.statusCode, 200);
	assert.equal(repaired.json().version, 2);
});

test('admission refusals write nothing: unknown asset, unknown material, invalid document', async () => {
	const cookie = await sessionCookie(app, 'google:s02-save-1');
	const projectId = track(nextProjectId());

	const unknownAsset = projectDocument('Unknown asset', { id: projectId });
	unknownAsset.scene.entities = [
		{
			kind: 'model',
			id: 'imported',
			name: 'Imported',
			// The parity fixture id shared with the editor admission test.
			assetId: 'asset-not-in-the-host-catalogue',
			fallback: 'piano',
			position: [0, 0, 0],
			rotation: [0, 0, 0]
		}
	];
	const unknownAssetSave = await save(projectId, cookie, await saveRequestBody(unknownAsset));
	assert.equal(unknownAssetSave.statusCode, 400);
	assert.equal(unknownAssetSave.json().error.code, 'invalid_project');

	const unknownMaterial = projectDocument('Unknown material', { id: projectId });
	unknownMaterial.scene.entities = [
		{
			kind: 'primitive',
			id: 'box',
			name: 'Box',
			primitive: 'box',
			dimensions: { width: 1, height: 1, depth: 1 },
			materialId: 'not-a-material',
			castShadow: true,
			receiveShadow: false,
			position: [0, 0, 0],
			rotation: [0, 0, 0]
		}
	];
	// The fixture builder's permissive default admits the unknown material, but the
	// API's registry pass refuses it before any digest comparison.
	const unknownMaterialRequest = await saveRequestBody(projectDocument('Shape', { id: projectId }));
	const unknownMaterialSave = await save(projectId, cookie, {
		...unknownMaterialRequest,
		capture: {
			...unknownMaterialRequest.capture,
			canonicalJson: `${JSON.stringify(unknownMaterial, null, 2)}\n`,
			sourceContentId: `sha256-${'1'.repeat(64)}`
		}
	});
	assert.equal(unknownMaterialSave.statusCode, 400);
	assert.equal(unknownMaterialSave.json().error.code, 'invalid_project');

	const invalidRequest = await saveRequestBody(projectDocument('Invalid', { id: projectId }));
	const invalidDocument = await save(projectId, cookie, {
		...invalidRequest,
		capture: {
			...invalidRequest.capture,
			canonicalJson: `${JSON.stringify({ id: projectId, name: 'Missing fields' })}\n`
		}
	});
	assert.equal(invalidDocument.statusCode, 400);
	assert.equal(invalidDocument.json().error.code, 'invalid_project');

	const state = await counts(projectId);
	assert.equal(state.versions, 0);
	assert.equal(state.receipts, 0);
});

test('scheme, source version and content identity mismatches refuse as themselves', async () => {
	const cookie = await sessionCookie(app, 'google:s02-save-1');
	const { projectId, request, acknowledgement } = await createProject(
		cookie,
		projectDocument('Identity', { id: nextProjectId() })
	);
	const precondition = { kind: 'expected-saved-base', token: acknowledgement.savedBaseToken };

	const scheme = await save(projectId, cookie, { ...request, contentIdentityScheme: 'some-other-scheme@1' });
	assert.equal(scheme.statusCode, 400);
	assert.equal(scheme.json().error.code, 'identity-scheme-mismatch');

	const version = await save(projectId, cookie, {
		...request,
		capture: { ...request.capture, sourceVersion: 4, precondition }
	});
	assert.equal(version.statusCode, 400);
	assert.equal(version.json().error.code, 'source-version-mismatch');

	const digest = await save(projectId, cookie, {
		...request,
		capture: { ...request.capture, sourceContentId: `sha256-${'0'.repeat(64)}`, precondition }
	});
	assert.equal(digest.statusCode, 400);
	assert.equal(digest.json().error.code, 'content-identity-mismatch');

	// Non-canonical bytes are not the encoding of their contents.
	const nonCanonical = await save(projectId, cookie, {
		...request,
		capture: {
			...request.capture,
			canonicalJson: JSON.stringify(JSON.parse(request.capture.canonicalJson), null, 4),
			precondition
		}
	});
	assert.equal(nonCanonical.statusCode, 400);
	assert.equal(nonCanonical.json().error.code, 'content-identity-mismatch');

	const state = await counts(projectId);
	assert.equal(state.versions, 1);
});

test('a saved revision identity cannot be reused for different contents', async () => {
	const cookie = await sessionCookie(app, 'google:s02-save-1');
	const { projectId, request, acknowledgement } = await createProject(
		cookie,
		projectDocument('Revision', { id: nextProjectId() })
	);
	const reused = await saveRequestBody(projectDocument('Different contents', { id: projectId }), {
		precondition: { kind: 'expected-saved-base', token: acknowledgement.savedBaseToken },
		revisionId: request.capture.acceptedRevision.revisionId
	});
	const refused = await save(projectId, cookie, reused);
	assert.equal(refused.statusCode, 400);
	assert.equal(refused.json().error.code, 'revision-reuse');
	assert.equal((await counts(projectId)).versions, 1);
});

test('a stored base that fails registry admission does not block a valid Save', async () => {
	const cookie = await sessionCookie(app, 'google:s02-save-1');
	const owner = 'google:s02-save-1';
	const projectId = track(nextProjectId());
	const token = `saved-base:${randomUUID()}`;
	const legacy = projectDocument('Legacy permissive row', { id: projectId });
	legacy.scene.entities = [
		{
			kind: 'model',
			id: 'legacy',
			name: 'Legacy',
			assetId: 'asset-not-in-the-host-catalogue',
			fallback: 'piano',
			position: [0, 0, 0],
			rotation: [0, 0, 0]
		}
	];
	await pool.query('INSERT INTO users (id) VALUES ($1) ON CONFLICT (id) DO NOTHING', [owner]);
	await pool.query(
		`INSERT INTO projects (id, owner_id, name, latest_version, saved_base_token)
		 VALUES ($1, $2, $3, 1, $4)`,
		[projectId, owner, legacy.name, token]
	);
	await pool.query('INSERT INTO project_versions (project_id, version, document) VALUES ($1, 1, $2)', [
		projectId,
		legacy
	]);

	const repaired = await save(
		projectId,
		cookie,
		await saveRequestBody(projectDocument('Repaired', { id: projectId }), {
			precondition: { kind: 'expected-saved-base', token }
		})
	);
	assert.equal(repaired.statusCode, 200, JSON.stringify(repaired.json()));
	assert.equal(repaired.json().version, 2);
	assert.equal((await counts(projectId)).versions, 2);
});

test('the unconditioned old-client body refuses with no write', async () => {
	const cookie = await sessionCookie(app, 'google:s02-save-1');
	const projectId = track(nextProjectId());
	const unconditioned = await save(projectId, cookie, {
		document: projectDocument('Old client', { id: projectId })
	});
	assert.equal(unconditioned.statusCode, 400);
	assert.equal(unconditioned.json().error.code, 'precondition_required');
	const exists = await pool.query('SELECT 1 FROM projects WHERE id = $1', [projectId]);
	assert.equal(exists.rows.length, 0);
});
