/**
 * `conditional-save-units-v1` conformance (T3.P01.S05). Real Postgres, **no skip
 * guards**: this is the conditional Save transaction over an F.2 envelope, and a
 * mock cannot prove the row-lock, receipt, rollback or pointer-update contracts.
 *
 * `T3.P01.S04` activated this handler on the live Save route. These tests still
 * inject it directly so they exercise the transaction rather than HTTP framing;
 * `save.test.mjs` owns the route-level admission contract.
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { Pool } from 'pg';
import test, { after, before } from 'node:test';

import { createEmptyWallFirstLayoutDocument } from '@portfolio/project-model';
import { SAVE_CONTENT_IDENTITY_SCHEME, readSaveRequest } from '@portfolio/project-model/save';
import {
	CAMERA_UNIT_FORMAT_VERSION,
	EXPERIENCE_UNIT_FORMAT_VERSION,
	RESOURCE_UNIT_FORMAT_VERSION,
	SCENE_UNIT_FORMAT_VERSION,
	UNIT_ENVELOPE_SOURCE_KIND,
	UNIT_ENVELOPE_SOURCE_VERSION,
	captureUnitSave,
	computeEnvelopeSourceContentId,
	createProjectEnvelope,
	createUnitSaveHandler,
	readUnitEnvelopeForSave,
	serializeProjectEnvelope
} from '@portfolio/project-model/units';

import { runMigrations } from '../dist/migrate.js';
import { ProjectNotFoundError } from '../dist/project-persistence.js';
import { saveAcceptedSource, saveAcceptedSourceWithHandler } from '../dist/save-persistence.js';

const DATABASE_URL = process.env.DATABASE_URL ?? 'postgresql://localhost:5432/biskiq';

let pool;
const createdProjects = [];
let counter = 0;

function nextProjectId() {
	counter += 1;
	return `s05unit${Date.now().toString(36)}${counter}${randomUUID().slice(0, 8)}`;
}

async function cleanupProject(projectId) {
	await pool.query('DELETE FROM save_receipts WHERE project_id = $1', [projectId]);
	await pool.query('DELETE FROM project_versions WHERE project_id = $1', [projectId]);
	await pool.query('DELETE FROM projects WHERE id = $1', [projectId]);
}

async function unitEnvelope(projectId, label = 'S05 unit', options = {}) {
	const revision = options.acceptedRevision ?? { projectId, revisionId: `revision-${randomUUID()}` };
	return createProjectEnvelope({
		id: projectId,
		name: label,
		acceptedRevision: revision,
		dependencyLock: { formatVersion: 1, entries: options.lockEntries ?? [] },
		layout: { unitId: 'unit-layout', data: createEmptyWallFirstLayoutDocument() },
		scene: {
			unitId: 'unit-scene',
			data: { formatVersion: SCENE_UNIT_FORMAT_VERSION, textures: [], materials: [], entities: [] }
		},
		camera: {
			unitId: 'unit-camera',
			data: {
				formatVersion: CAMERA_UNIT_FORMAT_VERSION,
				views: [{ id: 'view-entry', label: 'Entry', eye: [0, 1.6, 0], target: [0, 1.6, -1], fov: 60, connectedViewIds: [] }],
				connections: []
			}
		},
		experience: {
			unitId: 'unit-experience',
			data: { formatVersion: EXPERIENCE_UNIT_FORMAT_VERSION, experiences: [] }
		},
		resources: {
			unitId: 'unit-resources',
			data: { formatVersion: RESOURCE_UNIT_FORMAT_VERSION, resources: options.resources ?? [] }
		}
	});
}

async function sourceFiles(directory) {
	const entries = await readdir(directory, { withFileTypes: true });
	const files = [];
	for (const entry of entries) {
		if (entry.isDirectory()) {
			files.push(...(await sourceFiles(new URL(`${entry.name}/`, directory))));
		} else if (entry.name.endsWith('.ts')) {
			files.push(new URL(entry.name, directory));
		}
	}
	return files;
}

async function requestFor(envelope, { operationId, precondition, acceptedRevision = envelope.acceptedRevision } = {}) {
	const sourceContentId = await computeEnvelopeSourceContentId(envelope);
	const captured = await captureUnitSave({
		snapshot: {
			acceptedRevision,
			sourceContentId,
			sourceKind: 'unit-envelope',
			sourceVersion: UNIT_ENVELOPE_SOURCE_VERSION,
			domain: { identity: { acceptedRevision, sourceContentId }, source: { ...envelope, acceptedRevision } }
		},
		operationId: operationId ?? `op-${randomUUID()}`,
		precondition: precondition ?? { kind: 'create-only' }
	});
	assert.equal(captured.kind, 'captured', JSON.stringify(captured));
	return { contentIdentityScheme: SAVE_CONTENT_IDENTITY_SCHEME, capture: captured.capture };
}

function save(pool, ownerId, request) {
	return saveAcceptedSourceWithHandler(pool, ownerId, request, createUnitSaveHandler());
}

before(async () => {
	pool = new Pool({ connectionString: DATABASE_URL, connectionTimeoutMillis: 3000 });
	await pool.query('SELECT 1');
	await runMigrations(pool);
});

after(async () => {
	for (const projectId of createdProjects) await cleanupProject(projectId);
	if (pool) await pool.end();
});

test('a unit envelope saves create-only and the stored version is its canonical bytes', async () => {
	const projectId = nextProjectId();
	createdProjects.push(projectId);
	const owner = `owner:${randomUUID()}`;
	const envelope = await unitEnvelope(projectId);
	const request = await requestFor(envelope);
	const acknowledgement = await save(pool, owner, request);
	assert.equal(acknowledgement.version, 1);
	assert.equal(acknowledgement.name, envelope.name);
	assert.deepEqual(acknowledgement.savedRevision, envelope.acceptedRevision);
	const stored = await pool.query('SELECT document FROM project_versions WHERE project_id = $1 AND version = 1', [projectId]);
	assert.deepEqual(stored.rows[0].document, JSON.parse(request.capture.canonicalJson));
});

test('the live Save entry admits the F.2 unit capture directly', async () => {
	const projectId = nextProjectId();
	createdProjects.push(projectId);
	const owner = `owner:${randomUUID()}`;
	const request = await requestFor(await unitEnvelope(projectId));
	// S04 activated the unit handler: the entry the route imports is the F.2 one.
	const acknowledgement = await saveAcceptedSource(pool, owner, request);
	assert.equal(acknowledgement.version, 1);
	const stored = await pool.query(
		'SELECT source_format AS "sourceFormat" FROM project_versions WHERE project_id = $1 AND version = 1',
		[projectId]
	);
	assert.equal(stored.rows[0].sourceFormat, 'unit-envelope-v1');
});

test('same-base unit writers: exactly one wins, the loser gets a conflict and writes nothing', async () => {
	const projectId = nextProjectId();
	createdProjects.push(projectId);
	const owner = `owner:${randomUUID()}`;
	const first = await save(pool, owner, await requestFor(await unitEnvelope(projectId, 'Base')));
	const token = first.savedBaseToken;
	const left = await requestFor(await unitEnvelope(projectId, 'Left'), {
		precondition: { kind: 'expected-saved-base', token }
	});
	const right = await requestFor(await unitEnvelope(projectId, 'Right'), {
		precondition: { kind: 'expected-saved-base', token }
	});
	const settled = await Promise.allSettled([save(pool, owner, left), save(pool, owner, right)]);
	const winners = settled.filter((entry) => entry.status === 'fulfilled');
	const losers = settled.filter((entry) => entry.status === 'rejected');
	assert.equal(winners.length, 1);
	assert.equal(losers.length, 1);
	assert.equal(losers[0].reason.code, 'conflict');
	const versions = await pool.query('SELECT count(*)::int AS count FROM project_versions WHERE project_id = $1', [projectId]);
	assert.equal(versions.rows[0].count, 2);
	const receipts = await pool.query('SELECT count(*)::int AS count FROM save_receipts WHERE project_id = $1', [projectId]);
	assert.equal(receipts.rows[0].count, 2);
});

test('an identical unit retry replays its receipt without another version', async () => {
	const projectId = nextProjectId();
	createdProjects.push(projectId);
	const owner = `owner:${randomUUID()}`;
	const request = await requestFor(await unitEnvelope(projectId), { operationId: 'op-retry' });
	const first = await save(pool, owner, request);
	const second = await save(pool, owner, request);
	assert.deepEqual(second, first);
	const versions = await pool.query('SELECT count(*)::int AS count FROM project_versions WHERE project_id = $1', [projectId]);
	assert.equal(versions.rows[0].count, 1);
});

test('a changed unit payload under the same operation id refuses', async () => {
	const projectId = nextProjectId();
	createdProjects.push(projectId);
	const owner = `owner:${randomUUID()}`;
	const first = await save(pool, owner, await requestFor(await unitEnvelope(projectId, 'First'), { operationId: 'op-changed' }));
	const changed = await requestFor(await unitEnvelope(projectId, 'Changed'), {
		operationId: 'op-changed',
		precondition: { kind: 'expected-saved-base', token: first.savedBaseToken }
	});
	await assert.rejects(() => save(pool, owner, changed), (error) => error.code === 'retry-payload-mismatch');
	const versions = await pool.query('SELECT count(*)::int AS count FROM project_versions WHERE project_id = $1', [projectId]);
	assert.equal(versions.rows[0].count, 1);
});

test('a tampered unit revision and an unresolvable lock entry refuse before any write', async () => {
	const projectId = nextProjectId();
	createdProjects.push(projectId);
	const owner = `owner:${randomUUID()}`;
	const good = await requestFor(await unitEnvelope(projectId));
	const tampered = JSON.parse(good.capture.canonicalJson);
	tampered.units.camera.header.contentRevision = `sha256-${'0'.repeat(64)}`;
	const tamperedText = `${JSON.stringify(tampered, null, 2)}\n`;
	const read = await readUnitEnvelopeForSave(tamperedText);
	assert.equal(read.kind, 'refused');
	assert.equal(read.code, 'content-identity-mismatch');

	const envelope = await unitEnvelope(projectId);
	const locked = {
		...envelope,
		dependencyLock: {
			formatVersion: 1,
			entries: [
				{
					domain: 'camera',
					subjectKind: 'view',
					subjectId: 'view-absent',
					instancePath: [],
					contentRevision: envelope.units.camera.header.contentRevision,
					requiredCapabilities: [],
					pin: null
				}
			]
		}
	};
	const lockedRead = await readUnitEnvelopeForSave(serializeProjectEnvelope(locked));
	assert.equal(lockedRead.kind, 'refused');
	const refused = await captureUnitSave({
		snapshot: {
			acceptedRevision: locked.acceptedRevision,
			sourceContentId: await computeEnvelopeSourceContentId(locked),
			sourceKind: 'unit-envelope',
			sourceVersion: UNIT_ENVELOPE_SOURCE_VERSION,
			domain: { identity: { acceptedRevision: locked.acceptedRevision, sourceContentId: 'unused' }, source: locked }
		},
		operationId: 'op-locked',
		precondition: { kind: 'create-only' }
	});
	assert.equal(refused.kind, 'refused');
	assert.equal(refused.code, 'invalid-project');
	const exists = await pool.query('SELECT 1 FROM projects WHERE id = $1', [projectId]);
	assert.equal(exists.rows.length, 0);
});

test('the live entry selects the unit handler and no current-source handler survives', async () => {
	const files = await sourceFiles(new URL('../src/', import.meta.url));
	assert.ok(files.length > 0, 'the source scan found no API TypeScript files');
	const offenders = [];
	for (const file of files) {
		const text = await readFile(file, 'utf8');
		if (/CURRENT_SOURCE_SAVE_HANDLER|admitCurrentSourceContent|canonicalSourceJson/.test(text)) {
			offenders.push(file.pathname);
		}
	}
	assert.deepEqual(offenders, [], 'no API source may reach the retired current-source admission');
	const persistence = await readFile(new URL('../src/save-persistence.ts', import.meta.url), 'utf8');
	assert.match(persistence, /createUnitSaveHandler\(\)/);
	assert.match(persistence, /\[UNIT_SAVE_HANDLER\]/);
	const app = await readFile(new URL('../src/app.ts', import.meta.url), 'utf8');
	assert.match(app, /saveAcceptedSource\b/);
	assert.doesNotMatch(app, /saveAcceptedSourceWithHandler|saveAcceptedSourceWithHandlers/);
	assert.equal(UNIT_ENVELOPE_SOURCE_KIND, 'unit-envelope');
});

test('a capture with no precondition is refused by the request reader', async () => {
	const projectId = nextProjectId();
	const request = await requestFor(await unitEnvelope(projectId));
	const capture = JSON.parse(JSON.stringify(request.capture));
	delete capture.precondition;
	const validation = readSaveRequest({ ...request, capture });
	assert.equal(validation.kind, 'invalid');
	assert.ok(validation.issues.some((issue) => issue.path === '$.capture.precondition'));
});

test('a resource lock whose pin disagrees with the registry refuses before any write', async () => {
	const projectId = nextProjectId();
	createdProjects.push(projectId);
	const pin = { hash: `sha256-${'b'.repeat(64)}`, mime: 'image/png', size: 10, locator: 'r2://paper.png' };
	const envelope = await unitEnvelope(projectId, 'Mismatched pin', {
		resources: [{ kind: 'texture', id: 'paper', contentRevision: 'rev-paper', pin, unresolved: null }],
		lockEntries: [
			{
				domain: 'resource:texture',
				subjectKind: 'resource',
				subjectId: 'paper',
				instancePath: [],
				contentRevision: 'rev-paper',
				requiredCapabilities: [],
				pin: { ...pin, size: 11 }
			}
		]
	});
	const read = await readUnitEnvelopeForSave(serializeProjectEnvelope(envelope));
	assert.equal(read.kind, 'refused');
	assert.equal(read.code, 'invalid-project');
	const exists = await pool.query('SELECT 1 FROM projects WHERE id = $1', [projectId]);
	assert.equal(exists.rows.length, 0);
});

test('a resource carrying both a revision and a pin round-trips with both identities', async () => {
	const projectId = nextProjectId();
	createdProjects.push(projectId);
	const owner = `owner:${randomUUID()}`;
	const pin = { hash: `sha256-${'c'.repeat(64)}`, mime: 'image/png', size: 12, locator: 'r2://both.png' };
	const envelope = await unitEnvelope(projectId, 'Both identities', {
		resources: [{ kind: 'texture', id: 'paper', contentRevision: 'rev-paper', pin, unresolved: null }],
		lockEntries: [
			{
				domain: 'resource:texture',
				subjectKind: 'resource',
				subjectId: 'paper',
				instancePath: [],
				contentRevision: 'rev-paper',
				requiredCapabilities: [{ id: 'cap.texture', version: '1' }],
				pin
			}
		]
	});
	const request = await requestFor(envelope);
	const acknowledgement = await save(pool, owner, request);
	assert.equal(acknowledgement.version, 1);
	const stored = await pool.query('SELECT document FROM project_versions WHERE project_id = $1 AND version = 1', [projectId]);
	const document = stored.rows[0].document;
	assert.deepEqual(document.units.resources.data.resources[0], {
		kind: 'texture',
		id: 'paper',
		contentRevision: 'rev-paper',
		pin,
		unresolved: null
	});
	assert.deepEqual(document.dependencyLock.entries[0].pin, pin);
	assert.deepEqual(document.dependencyLock.entries[0].requiredCapabilities, [{ id: 'cap.texture', version: '1' }]);
});

test('a captured envelope whose accepted revision belongs to another project refuses', async () => {
	const projectId = nextProjectId();
	const envelope = await unitEnvelope(projectId, 'Wrong project', {
		acceptedRevision: { projectId: 'some-other-project', revisionId: 'revision-other' }
	});
	const sourceContentId = await computeEnvelopeSourceContentId(envelope);
	const captured = await captureUnitSave({
		snapshot: {
			acceptedRevision: envelope.acceptedRevision,
			sourceContentId,
			sourceKind: 'unit-envelope',
			sourceVersion: UNIT_ENVELOPE_SOURCE_VERSION,
			domain: { identity: { acceptedRevision: envelope.acceptedRevision, sourceContentId }, source: envelope }
		},
		operationId: 'op-wrong-project',
		precondition: { kind: 'create-only' }
	});
	assert.equal(captured.kind, 'refused');
	assert.equal(captured.code, 'invalid-project');
});

test('a foreign expected-saved-base Save is not-found and never locks the owner row', async () => {
	const projectId = nextProjectId();
	createdProjects.push(projectId);
	const owner = `owner:${randomUUID()}`;
	const stranger = `owner:${randomUUID()}`;
	const first = await save(pool, owner, await requestFor(await unitEnvelope(projectId, 'Owned')));
	const token = first.savedBaseToken;

	// Hold the row lock the pre-TD-7 path would have waited on. The foreign
	// request must answer not-found while this lock is still held.
	const holder = await pool.connect();
	try {
		await holder.query('BEGIN');
		await holder.query('SELECT id FROM projects WHERE id = $1 FOR UPDATE', [projectId]);
		const foreign = await requestFor(await unitEnvelope(projectId, 'Stolen'), {
			precondition: { kind: 'expected-saved-base', token }
		});
		const outcome = await Promise.race([
			save(pool, stranger, foreign).then(
				() => ({ kind: 'saved' }),
				(error) => ({ kind: 'refused', error })
			),
			new Promise((resolve) => setTimeout(() => resolve({ kind: 'blocked' }), 2_000))
		]);
		assert.equal(outcome.kind, 'refused', 'the foreign Save must not wait on the owner row lock');
		assert.ok(outcome.error instanceof ProjectNotFoundError);
	} finally {
		await holder.query('ROLLBACK');
		holder.release();
	}

	const state = await pool.query(
		'SELECT latest_version AS "latestVersion", saved_base_token AS "savedBaseToken" FROM projects WHERE id = $1',
		[projectId]
	);
	assert.equal(state.rows[0].latestVersion, 1);
	assert.equal(state.rows[0].savedBaseToken, token);
	const versions = await pool.query('SELECT count(*)::int AS count FROM project_versions WHERE project_id = $1', [projectId]);
	assert.equal(versions.rows[0].count, 1);

	// The owner's own Save is then free to take the lock and advance the base.
	const ownerNext = await save(
		pool,
		owner,
		await requestFor(await unitEnvelope(projectId, 'Owner next'), {
			precondition: { kind: 'expected-saved-base', token }
		})
	);
	assert.equal(ownerNext.version, 2);
});

test('a failure after version staging but before the pointer update leaves the prior version and base intact', async () => {
	const projectId = nextProjectId();
	createdProjects.push(projectId);
	const owner = `owner:${randomUUID()}`;
	const first = await save(pool, owner, await requestFor(await unitEnvelope(projectId, 'Prior')));
	const token = first.savedBaseToken;
	const functionName = `s05_fail_pointer_${counter}`;
	await pool.query(
		`CREATE OR REPLACE FUNCTION ${functionName}() RETURNS trigger AS $$
		BEGIN
			IF NEW.id = '${projectId}' THEN RAISE EXCEPTION 'injected pointer failure'; END IF;
			RETURN NEW;
		END $$ LANGUAGE plpgsql`
	);
	await pool.query(`CREATE TRIGGER ${functionName} BEFORE UPDATE ON projects FOR EACH ROW EXECUTE FUNCTION ${functionName}()`);
	try {
		const next = await requestFor(await unitEnvelope(projectId, 'Next'), {
			precondition: { kind: 'expected-saved-base', token }
		});
		await assert.rejects(() => save(pool, owner, next), /injected pointer failure/);
	} finally {
		await pool.query(`DROP TRIGGER IF EXISTS ${functionName} ON projects`);
		await pool.query(`DROP FUNCTION IF EXISTS ${functionName}()`);
	}
	const state = await pool.query(
		`SELECT latest_version AS "latestVersion", saved_base_token AS "savedBaseToken"
		 FROM projects WHERE id = $1`,
		[projectId]
	);
	assert.equal(state.rows[0].latestVersion, 1);
	assert.equal(state.rows[0].savedBaseToken, token);
	const versions = await pool.query('SELECT count(*)::int AS count FROM project_versions WHERE project_id = $1', [projectId]);
	assert.equal(versions.rows[0].count, 1);
});
