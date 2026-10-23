/**
 * Conditional Save conformance at the route (T3.P01.S04 activation).
 *
 * Real Postgres, **no skip guards**: these are the HTTP admission, OCC,
 * collision, receipt and atomicity contracts over the live F.2 unit path, and a
 * mock cannot prove them. `npm run test:api` is the owning lane.
 */
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import test, { after, before } from 'node:test';

import { createApp } from '../dist/app.js';
import { runMigrations } from '../dist/migrate.js';
import { mintLayoutIdCapture, planWallChain } from '@portfolio/layout-core';
import { canonicalUnitJson } from '@portfolio/project-model/units';

import { SESSION_KEY, projectDocument, saveRequestBody, sessionCookie } from './test-support.mjs';

const DATABASE_URL = process.env.DATABASE_URL ?? 'postgresql://localhost:5432/biskiq';

let pool;
let app;
const createdProjects = [];
let counter = 0;

function nextProjectId() {
	counter += 1;
	return `s04save${Date.now().toString(36)}${counter}${randomUUID().slice(0, 8)}`;
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

async function createProject(cookie, envelope) {
	const projectId = track(envelope.id);
	const request = await saveRequestBody(envelope);
	const response = await save(projectId, cookie, request);
	assert.equal(response.statusCode, 200, JSON.stringify(response.json()));
	return { projectId, request, acknowledgement: response.json() };
}

/**
 * The F.2 envelope for `id` with one real format-6 Wall in its Layout, so a
 * refusal test can mutate a Wall the capture already carries.
 */
function envelopeWithWall(name, id) {
	const envelope = projectDocument(name, { id });
	const empty = envelope.units.layout.data;
	const planned = planWallChain({
		baseline: { ...empty, floor: { ...empty.floor, id: 'floor-1', name: 'Floor 1', elevation: 0 } },
		points: [[0, 0], [4, 0]],
		close: false,
		capture: mintLayoutIdCapture(),
		levelId: 'floor-1'
	});
	assert.equal(planned.kind, 'success');
	envelope.units.layout.data = planned.document;
	envelope.units.layout.header.contentRevision = `sha256-${createHash('sha256')
		.update(canonicalUnitJson(planned.document))
		.digest('hex')}`;
	return envelope;
}

async function receiptOperations(projectId) {
	const result = await pool.query(
		'SELECT operation_id FROM save_receipts WHERE project_id = $1 ORDER BY operation_id',
		[projectId]
	);
	return result.rows.map((row) => row.operation_id);
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

test('the live Save path stores the envelope and its source_format fence value', async () => {
	const cookie = await sessionCookie(app, 'google:s04-save-1');
	const envelope = projectDocument('Epoch save', { id: nextProjectId() });
	const { projectId, request } = await createProject(cookie, envelope);
	const stored = await pool.query(
		'SELECT source_format AS "sourceFormat", document FROM project_versions WHERE project_id = $1 AND version = 1',
		[projectId]
	);
	assert.equal(stored.rows[0].sourceFormat, 'unit-envelope-v1');
	assert.deepEqual(stored.rows[0].document, JSON.parse(request.capture.canonicalJson));
});

test('same-base writers: exactly one winner, the loser gets a conflict and no version', async () => {
	const cookie = await sessionCookie(app, 'google:s04-save-1');
	const projectId = track(nextProjectId());
	const createOperation = `create-${randomUUID()}`;
	const first = await save(
		projectId,
		cookie,
		await saveRequestBody(projectDocument('Base', { id: projectId }), { operationId: createOperation })
	);
	assert.equal(first.statusCode, 200, JSON.stringify(first.json()));
	const token = first.json().savedBaseToken;

	const leftOperation = `left-${randomUUID()}`;
	const rightOperation = `right-${randomUUID()}`;
	const [left, right] = await Promise.all([
		save(
			projectId,
			cookie,
			await saveRequestBody(projectDocument('Left', { id: projectId }), {
				precondition: { kind: 'expected-saved-base', token },
				operationId: leftOperation
			})
		),
		save(
			projectId,
			cookie,
			await saveRequestBody(projectDocument('Right', { id: projectId }), {
				precondition: { kind: 'expected-saved-base', token },
				operationId: rightOperation
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
	assert.deepEqual(
		(await receiptOperations(projectId)).sort(),
		[createOperation, left.statusCode === 200 ? leftOperation : rightOperation].sort()
	);
});

test('concurrent identical retries both replay the winner receipt without a second version', async () => {
	const cookie = await sessionCookie(app, 'google:s04-save-1');
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
	const cookie = await sessionCookie(app, 'google:s04-save-1');
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

test('concurrent create-only under one operation ID with different bytes refuses the loser', async () => {
	const cookie = await sessionCookie(app, 'google:s04-save-1');
	const projectId = track(nextProjectId());
	const operationId = `create-race-${randomUUID()}`;
	const [left, right] = await Promise.all([
		save(projectId, cookie, await saveRequestBody(projectDocument('Left create', { id: projectId }), { operationId })),
		save(projectId, cookie, await saveRequestBody(projectDocument('Right create', { id: projectId }), { operationId }))
	]);
	const responses = [left, right];
	assert.equal(responses.filter((response) => response.statusCode === 200).length, 1);
	const refused = responses.filter((response) => response.statusCode === 400);
	assert.equal(refused.length, 1, JSON.stringify(responses.map((response) => response.json())));
	assert.equal(refused[0].json().error.code, 'retry-payload-mismatch');
	const state = await counts(projectId);
	assert.equal(state.versions, 1);
	assert.equal(state.receipts, 1);
	assert.deepEqual(await receiptOperations(projectId), [operationId]);
});

test('create-only collision is owner-blind and another owner is not-found', async () => {
	const owner = await sessionCookie(app, 'google:s04-save-1');
	const stranger = await sessionCookie(app, 'google:s04-save-2');
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

	// TD-7: ownership is proved before any row lock, so a foreign expected-base
	// Save is not-found rather than a lock on another owner's row.
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
	const cookie = await sessionCookie(app, 'google:s04-save-1');
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
	const cookie = await sessionCookie(app, 'google:s04-save-1');
	const { projectId, acknowledgement } = await createProject(
		cookie,
		projectDocument('Atomic', { id: nextProjectId() })
	);
	const triggerId = `s04_fail_${projectId.replace(/[^A-Za-z0-9_]/g, '_')}`;
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

test('a non-F2 envelope is refused as invalid_project and writes nothing', async () => {
	const cookie = await sessionCookie(app, 'google:s04-save-1');
	const projectId = track(nextProjectId());
	const request = await saveRequestBody(projectDocument('Invalid', { id: projectId }));
	const envelope = JSON.parse(request.capture.canonicalJson);
	envelope.units.scene.data.formatVersion = 99;
	const invalid = await save(projectId, cookie, {
		...request,
		capture: { ...request.capture, canonicalJson: JSON.stringify(envelope) }
	});
	assert.equal(invalid.statusCode, 400);
	assert.equal(invalid.json().error.code, 'invalid_project');
	assert.ok(invalid.json().issues.length > 0);

	const state = await counts(projectId);
	assert.equal(state.versions, 0);
	assert.equal(state.receipts, 0);
});

test('a format-5 Layout is refused as invalid_project and writes nothing', async () => {
	const cookie = await sessionCookie(app, 'google:s04-save-1');
	const projectId = track(nextProjectId());
	const request = await saveRequestBody(projectDocument('Format five Layout', { id: projectId }));
	const envelope = JSON.parse(request.capture.canonicalJson);
	envelope.units.layout.data.formatVersion = 5;
	const invalid = await save(projectId, cookie, {
		...request,
		capture: { ...request.capture, canonicalJson: JSON.stringify(envelope) }
	});
	assert.equal(invalid.statusCode, 400);
	assert.equal(invalid.json().error.code, 'invalid_project');
	assert.ok(invalid.json().issues.some((issue) => issue.code === 'unsupported_format_version'));

	const state = await counts(projectId);
	assert.equal(state.versions, 0);
	assert.equal(state.receipts, 0);
});

test('a format-6 Wall carrying a role key is refused as invalid_project and writes nothing', async () => {
	const cookie = await sessionCookie(app, 'google:s04-save-1');
	const projectId = track(nextProjectId());
	const request = await saveRequestBody(envelopeWithWall('Boundary role Wall', projectId));
	const envelope = JSON.parse(request.capture.canonicalJson);
	envelope.units.layout.data.walls[0].role = 'boundary';
	const invalid = await save(projectId, cookie, {
		...request,
		capture: { ...request.capture, canonicalJson: JSON.stringify(envelope) }
	});
	assert.equal(invalid.statusCode, 400);
	assert.equal(invalid.json().error.code, 'invalid_project');
	assert.ok(invalid.json().issues.some((issue) => issue.code === 'unknown_key'));

	const state = await counts(projectId);
	assert.equal(state.versions, 0);
	assert.equal(state.receipts, 0);
});

test('scheme, source version, digest and canonical-bytes mismatches refuse as themselves', async () => {
	const cookie = await sessionCookie(app, 'google:s04-save-1');
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

	assert.equal((await counts(projectId)).versions, 1);
});

test('a saved revision identity cannot be reused for different contents', async () => {
	const cookie = await sessionCookie(app, 'google:s04-save-1');
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

test('an older saved revision identity also cannot be reused for different contents', async () => {
	const cookie = await sessionCookie(app, 'google:s04-save-1');
	const { projectId, request, acknowledgement } = await createProject(
		cookie,
		projectDocument('Revision A', { id: nextProjectId() })
	);
	const revisionA = request.capture.acceptedRevision.revisionId;
	const revisionB = `revision-${randomUUID()}`;
	const second = await save(
		projectId,
		cookie,
		await saveRequestBody(projectDocument('Revision B', { id: projectId }), {
			precondition: { kind: 'expected-saved-base', token: acknowledgement.savedBaseToken },
			revisionId: revisionB
		})
	);
	assert.equal(second.statusCode, 200, JSON.stringify(second.json()));

	const reused = await save(
		projectId,
		cookie,
		await saveRequestBody(projectDocument('Revision A with new contents', { id: projectId }), {
			precondition: { kind: 'expected-saved-base', token: second.json().savedBaseToken },
			revisionId: revisionA
		})
	);
	assert.equal(reused.statusCode, 400);
	assert.equal(reused.json().error.code, 'revision-reuse');
	assert.equal((await counts(projectId)).versions, 2);
});

test('a pre-epoch writer is refused structurally by the schema fence', async () => {
	const owner = 'google:s04-save-pre-epoch';
	await pool.query('INSERT INTO users (id) VALUES ($1) ON CONFLICT (id) DO NOTHING', [owner]);
	const projectId = track(nextProjectId());
	await pool.query('INSERT INTO projects (id, owner_id, name) VALUES ($1, $2, $3)', [
		projectId,
		owner,
		'Pre-epoch'
	]);
	await assert.rejects(
		() =>
			pool.query('INSERT INTO project_versions (project_id, version, document) VALUES ($1, 1, $2)', [
				projectId,
				projectDocument('Pre-epoch')
			]),
		(error) => error.code === '23502'
	);

	// The owned row still exists and carries no F.2 version. An old reader must
	// not fall back to it: the project is absent from the list and the load is a
	// 404 because the version join finds nothing, not because the row was deleted.
	const cookie = await sessionCookie(app, owner);
	const existing = await pool.query('SELECT 1 FROM projects WHERE id = $1', [projectId]);
	assert.equal(existing.rows.length, 1);
	const missing = await app.inject({ method: 'GET', url: `/projects/${projectId}`, headers: { cookie } });
	assert.equal(missing.statusCode, 404);
	const listed = await app.inject({ method: 'GET', url: '/projects', headers: { cookie } });
	assert.equal(listed.statusCode, 200);
	assert.equal(listed.json().projects.some((project) => project.id === projectId), false);
});

test('the unconditioned old-client body refuses with no write', async () => {
	const cookie = await sessionCookie(app, 'google:s04-save-1');
	const projectId = track(nextProjectId());
	const unconditioned = await save(projectId, cookie, {
		document: projectDocument('Old client', { id: projectId })
	});
	assert.equal(unconditioned.statusCode, 400);
	assert.equal(unconditioned.json().error.code, 'precondition_required');
	const exists = await pool.query('SELECT 1 FROM projects WHERE id = $1', [projectId]);
	assert.equal(exists.rows.length, 0);
});
