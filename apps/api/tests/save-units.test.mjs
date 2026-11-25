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
import { deflateSync } from 'node:zlib';
import { readFile, readdir } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { Pool } from 'pg';
import test, { after, before } from 'node:test';

import { createEmptyWallFirstLayoutDocument } from '@portfolio/layout-core/wall';
import { collectEnvelopeImageRequirements } from '@portfolio/project-model/project-images';
import { readRecipe, recipeHash } from '@portfolio/project-model/materials';
import { SAVE_CONTENT_IDENTITY_SCHEME, readSaveRequest } from '@portfolio/project-model/save';
import {
	CAMERA_UNIT_FORMAT_VERSION,
	EXPERIENCE_UNIT_FORMAT_VERSION,
	RESOURCE_UNIT_FORMAT_VERSION,
	skyFromPreset,
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

import { registerAsset, uploadAsset } from '../dist/asset-persistence.js';
import { prepareArtworkPins, prepareProjectImagePins } from '../dist/artwork-persistence.js';
import { memoryObjectStore } from './test-support.mjs';
import { runMigrations } from '../dist/migrate.js';
import { ProjectNotFoundError, loadProject } from '../dist/project-persistence.js';
import { verifyMaterialDefinitionHashes } from '../dist/material-integrity.js';
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
	await pool.query('DELETE FROM assets WHERE project_id = $1', [projectId]);
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
			data: {
				formatVersion: SCENE_UNIT_FORMAT_VERSION,
				textures: options.textures ?? [],
				materials: options.materials ?? [],
				entities: options.sceneEntities ?? [],
				...(options.palette === undefined ? {} : { palette: options.palette }),
				...(options.environment === undefined ? {} : { environment: options.environment }),
				...(options.artworkLibrary === undefined ? {} : { artworkLibrary: options.artworkLibrary })
			}
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

/** One native form in the landed Scene format 5 source shape; T5.P01.S01 introduced this native-form shape at format 4. */
const NATIVE_FORM = {
	kind: 'form',
	id: 'entity-form',
	name: 'Drawn plinth',
	position: [1, 0, 2],
	rotation: [0, 0.5, 0],
	form: {
		generator: {
			kind: 'extrude',
			plane: 'plan',
			outline: [
				{ key: 1, u: 0, v: 0, smooth: false },
				{ key: 2, u: 1, v: 0, smooth: false },
				{ key: 3, u: 1, v: 1, smooth: false },
				{ key: 4, u: 0, v: 1, smooth: false }
			],
			extent: 0.6
		},
		scale: [1, 1, 1],
		nextKey: 5
	},
	materialId: 'plaster-warm',
	castShadow: true,
	receiveShadow: true
};

test('a Scene unit carrying a native form saves canonically and reloads identically', async () => {
	const projectId = nextProjectId();
	createdProjects.push(projectId);
	const owner = `owner:${randomUUID()}`;
	const request = await requestFor(
		await unitEnvelope(projectId, 'Native forms', { sceneEntities: [NATIVE_FORM] })
	);
	const acknowledgement = await save(pool, owner, request);
	assert.equal(acknowledgement.version, 1);
	const stored = await pool.query(
		'SELECT document FROM project_versions WHERE project_id = $1 AND version = 1',
		[projectId]
	);
	// Scene format 12 is the only admitted format now, and Save stores exactly
	// the captured canonical bytes — the form source is never re-derived.
	assert.equal(SCENE_UNIT_FORMAT_VERSION, 12);
	assert.equal(RESOURCE_UNIT_FORMAT_VERSION, 3);
	const storedScene = stored.rows[0].document.units.scene;
	const canonicalScene = JSON.parse(request.capture.canonicalJson).units.scene;
	assert.equal(storedScene.header.formatVersion, SCENE_UNIT_FORMAT_VERSION);
	assert.deepEqual(storedScene.data.entities, canonicalScene.data.entities);
	assert.deepEqual(storedScene.data.entities, [NATIVE_FORM]);
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

test('release preparation pins a P20 texture that a Finish names only through a map slot, and a full Look survives save and reopen', async () => {
	const projectId = nextProjectId();
	createdProjects.push(projectId);
	const owner = `owner:${randomUUID()}`;
	const store = memoryObjectStore();
	const first = await saveAcceptedSource(pool, owner, await requestFor(await unitEnvelope(projectId)));
	const bytes = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=', 'base64');
	const pending = await registerAsset(pool, owner, projectId, 'Normal.png', 'test');
	const ready = await uploadAsset(pool, owner, projectId, pending.id, bytes.length, Readable.from([bytes]), store, 'test');
	// Scene 8: a P20 texture record's id is its asset id, and a Finish names it by
	// that id from `maps.normal`; no Artwork places it.
	const envelope = await unitEnvelope(projectId, 'Mapped Finish', {
		textures: [{ id: ready.id, name: 'Normal', uri: `/project-assets/${ready.id}` }],
		// Every Scene 8 Look field at a non-default value, so save and reopen prove
		// none is dropped: a palette follower, maps, mapping, normal strength and
		// flip, and an environment with an edited Sky and a Treatment.
		materials: [{
			id: 'finish', name: 'Finish', base: { catalogue: 'plaster-warm' },
			overrides: {
				color: { slot: 'accent' },
				roughness: 0.4,
				metalness: 0.1,
				maps: { normal: { image: { textureId: ready.id }, convention: '-Y' } },
				mapping: { kind: 'target', metric: { tileMeters: [0.5, 2], rotation: 0.25, offset: [0.1, 0.2] } },
				normalScale: 0.5
			}
		}],
		palette: [{ id: 'accent', name: 'Accent', color: '#445566' }, { id: 'ground', name: 'Ground', color: '#ddccbb' }],
		environment: {
			sky: {
				...skyFromPreset('golden-hour', 135),
				softness: 0.8,
				haze: 50
			},
			treatment: 'clay'
		},
		resources: [{
			kind: 'texture', id: ready.id, contentRevision: 'rev-normal',
			pin: { hash: ready.sha256, mime: ready.mime, size: ready.byteSize, locator: `/project-assets/${ready.id}` },
			unresolved: null
		}],
		lockEntries: [{
			domain: 'resource:texture', subjectKind: 'resource', subjectId: ready.id, instancePath: [],
			contentRevision: 'rev-normal', requiredCapabilities: [],
			pin: { hash: ready.sha256, mime: ready.mime, size: ready.byteSize, locator: `/project-assets/${ready.id}` }
		}]
	});
	const request = await requestFor(envelope, { precondition: { kind: 'expected-saved-base', token: first.savedBaseToken } });
	const saved = await saveAcceptedSource(pool, owner, request, store);
	assert.equal(saved.version, 2);
	const stored = await pool.query('SELECT document FROM project_versions WHERE project_id = $1 AND version = 2', [projectId]);
	const storedScene = stored.rows[0].document.units.scene.data;
	const authored = envelope.units.scene.data;
	assert.deepEqual(storedScene.materials, authored.materials);
	assert.deepEqual(storedScene.palette, authored.palette);
	assert.deepEqual(storedScene.environment, authored.environment);
	// Reopen: the loaded document is admitted again with every Look field intact.
	const reopened = await loadProject(pool, owner, projectId);
	const reread = await readUnitEnvelopeForSave(serializeProjectEnvelope(reopened.document));
	assert.equal(reread.kind, 'read', JSON.stringify(reread));
	assert.deepEqual(reread.envelope.units.scene.data.materials, authored.materials);
	assert.deepEqual(reread.envelope.units.scene.data.palette, authored.palette);
	assert.deepEqual(reread.envelope.units.scene.data.environment, authored.environment);
	assert.equal(reread.envelope.units.scene.header.revision, stored.rows[0].document.units.scene.header.revision);
	const pins = await prepareArtworkPins(pool, store, owner, projectId, envelope.units.scene.data, 'release');
	assert.deepEqual(pins.map((pin) => pin.assetId), [ready.id]);
	// Without its bytes the mapped texture cannot be released.
	store.objects.delete(pins[0].objectKey);
	await assert.rejects(
		prepareArtworkPins(pool, store, owner, projectId, envelope.units.scene.data, 'release'),
		(error) => error.path === '$.units.scene.data.textures[0].uri'
	);
});

test('release preparation pins the colour image of a Finish and reopen keeps its map', async () => {
	const projectId = nextProjectId();
	createdProjects.push(projectId);
	const owner = `owner:${randomUUID()}`;
	const store = memoryObjectStore();
	const first = await saveAcceptedSource(pool, owner, await requestFor(await unitEnvelope(projectId)));
	const bytes = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=', 'base64');
	const pending = await registerAsset(pool, owner, projectId, 'Brick.png', 'test');
	const ready = await uploadAsset(pool, owner, projectId, pending.id, bytes.length, Readable.from([bytes]), store, 'test');
	// A Finish image names the P20 texture only through `maps.color`; no Artwork
	// places it, so closure and release must find the record itself.
	const finish = {
		id: 'brick', name: 'Brick wall', base: { catalogue: 'paper-aged' },
		overrides: { color: '#ffffff', maps: { color: { image: { textureId: ready.id } } } }
	};
	// The planner's shape: a real pin, the pin hash as the content revision and
	// no dependency-lock entry. Texture resources are closed by their record.
	assert.equal(ready.mime, 'image/png');
	assert.ok(ready.sha256);
	assert.ok(ready.byteSize);
	const pin = {
		hash: ready.sha256, mime: ready.mime, size: ready.byteSize,
		locator: `/project-assets/${ready.id}`
	};
	const envelope = await unitEnvelope(projectId, 'Finish colour image', {
		textures: [{ id: ready.id, name: 'Brick wall', uri: `/project-assets/${ready.id}` }],
		materials: [finish],
		resources: [{ kind: 'texture', id: ready.id, contentRevision: pin.hash, pin, unresolved: null }]
	});
	const request = await requestFor(envelope, { precondition: { kind: 'expected-saved-base', token: first.savedBaseToken } });
	const saved = await saveAcceptedSource(pool, owner, request, store);
	assert.equal(saved.version, 2);
	const reopened = await loadProject(pool, owner, projectId);
	assert.deepEqual(reopened.document.units.scene.data.materials, [finish]);
	assert.deepEqual(reopened.document.units.scene.data.textures, envelope.units.scene.data.textures);
	const pins = await prepareArtworkPins(pool, store, owner, projectId, envelope.units.scene.data, 'release');
	assert.deepEqual(pins.map((pin) => pin.assetId), [ready.id]);
	// A missing colour image is a named release refusal, not a silent fallback.
	store.objects.delete(pins[0].objectKey);
	await assert.rejects(
		prepareArtworkPins(pool, store, owner, projectId, envelope.units.scene.data, 'release'),
		(error) => error.path === '$.units.scene.data.textures[0].uri'
	);
});

async function uploadTexture(owner, projectId, store, name, bytes) {
	const pending = await registerAsset(pool, owner, projectId, name, 'test');
	return uploadAsset(pool, owner, projectId, pending.id, bytes.length, Readable.from([bytes]), store, 'test');
}

function tinyPng(r, g, b) {
	const chunk = (type, data) => {
		const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
		const length = Buffer.alloc(4);
		length.writeUInt32BE(data.length);
		const crc = Buffer.alloc(4);
		crc.writeUInt32BE(crc32(body));
		return Buffer.concat([length, body, crc]);
	};
	const header = Buffer.alloc(13);
	header.writeUInt32BE(1, 0);
	header.writeUInt32BE(1, 4);
	header[8] = 8;
	header[9] = 2;
	return Buffer.concat([
		Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
		chunk('IHDR', header),
		chunk('IDAT', deflateSync(Buffer.from([0, r, g, b]))),
		chunk('IEND', Buffer.alloc(0))
	]);
}

function crc32(bytes) {
	let crc = 0xffffffff;
	for (const byte of bytes) {
		crc ^= byte;
		for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
	}
	return (crc ^ 0xffffffff) >>> 0;
}

function texturePin(ready) {
	return {
		hash: ready.sha256, mime: ready.mime, size: ready.byteSize,
		locator: `/project-assets/${ready.id}`
	};
}

function finishEnvelope(projectId, label, ready, { artworkLibrary = [], extraTextures = [] } = {}) {
	const pin = texturePin(ready);
	return unitEnvelope(projectId, label, {
		textures: [
			{ id: ready.id, name: label, uri: `/project-assets/${ready.id}` },
			...extraTextures
		],
		materials: [{
			id: 'finish', name: label, base: { catalogue: 'plaster-warm' },
			overrides: { color: '#ffffff', maps: { color: { image: { textureId: ready.id } } } }
		}],
		artworkLibrary,
		resources: [{ kind: 'texture', id: ready.id, contentRevision: pin.hash, pin, unresolved: null }]
	});
}

test('Save and Load independently verify a material definition identity', async () => {
		const projectId = nextProjectId();
		createdProjects.push(projectId);
		const owner = `owner:${randomUUID()}`;
		const store = memoryObjectStore();
		const baseline = await saveAcceptedSource(pool, owner, await requestFor(await unitEnvelope(projectId)));
		const bytes = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=', 'base64');
		const ready = await uploadTexture(owner, projectId, store, 'Definition.png', bytes);
		const pin = texturePin(ready);
		const recipeRead = readRecipe({
			profile: 'pbr-metallic-roughness/v1',
			color: '#b8bcc0',
			roughness: 0.3,
			metalness: 1,
			occlusionStrength: 1,
			normalScale: 1,
			mapping: { kind: 'target', metric: { tileMeters: [1, 1], rotation: 0, offset: [0, 0] } },
			maps: { color: { image: ready.sha256 } }
		});
		assert.equal(recipeRead.success, true);
		const definitionHash = await recipeHash(recipeRead.recipe);
		const detail = { recipe: recipeRead.recipe, images: [{ hash: ready.sha256, source: { textureId: ready.id } }] };
		const envelope = await unitEnvelope(projectId, 'Material definition', {
			textures: [{ id: ready.id, name: 'Definition', uri: `/project-assets/${ready.id}` }],
			materials: [{ id: 'finish-definition', name: 'Definition', base: { material: definitionHash } }],
			resources: [
				{ kind: 'texture', id: ready.id, contentRevision: pin.hash, pin, unresolved: null },
				{ kind: 'material', id: definitionHash, contentRevision: definitionHash, pin: null, unresolved: null, material: detail }
			],
			lockEntries: [{
				domain: 'resource:material', subjectKind: 'resource', subjectId: definitionHash, instancePath: [],
				contentRevision: definitionHash,
				requiredCapabilities: [{ id: 'pbr-metallic-roughness', version: '1' }], pin: null
			}]
		});
		const first = await saveAcceptedSource(
			pool, owner, await requestFor(envelope, { precondition: { kind: 'expected-saved-base', token: baseline.savedBaseToken } }), store
		);
		assert.equal(first.version, 2);
		const reopened = await loadProject(pool, owner, projectId);
		assert.deepEqual(await verifyMaterialDefinitionHashes(reopened.document), []);

		const tampered = structuredClone(envelope);
		const material = tampered.units.resources.data.resources.find((resource) => resource.kind === 'material');
		material.material.recipe.color = '#000000';
		const refusal = await saveAcceptedSource(
			pool, owner, await requestFor(tampered, { precondition: { kind: 'expected-saved-base', token: first.savedBaseToken } }), store
		).then(() => null, (error) => error);
		assert.equal(refusal?.code, 'invalid-project');
		const versions = await pool.query('SELECT count(*)::int AS count FROM project_versions WHERE project_id = $1', [projectId]);
		assert.equal(versions.rows[0].count, 2);
		const receipts = await pool.query('SELECT count(*)::int AS count FROM save_receipts WHERE project_id = $1', [projectId]);
		assert.equal(receipts.rows[0].count, 2);
	});

test('a three-image brushed metal definition saves with every local image pin verified', async () => {
	const projectId = nextProjectId();
	createdProjects.push(projectId);
	const owner = `owner:${randomUUID()}`;
	const store = memoryObjectStore();
	const baseline = await saveAcceptedSource(pool, owner, await requestFor(await unitEnvelope(projectId)));
	const colorBytes = tinyPng(200, 10, 10);
	const normalBytes = tinyPng(10, 200, 10);
	const roughnessBytes = tinyPng(10, 10, 200);
	const color = await uploadTexture(owner, projectId, store, 'Color.png', colorBytes);
	const normal = await uploadTexture(owner, projectId, store, 'Normal.png', normalBytes);
	const roughness = await uploadTexture(owner, projectId, store, 'Roughness.png', roughnessBytes);
	const textures = [color, normal, roughness];
	const recipeRead = readRecipe({
		profile: 'pbr-metallic-roughness/v1',
		color: '#b8bcc0', roughness: 0.32, metalness: 1, occlusionStrength: 1, normalScale: 1,
		mapping: { kind: 'target', metric: { tileMeters: [0.4, 1.2], rotation: 0.2, offset: [0.1, 0.3] } },
		maps: {
			color: { image: color.sha256 },
			normal: { image: normal.sha256, convention: '+Y' },
			roughness: { image: roughness.sha256, component: 'g', invert: false }
		}
	});
	assert.equal(recipeRead.success, true, JSON.stringify(recipeRead));
	const hash = await recipeHash(recipeRead.recipe);
	const images = textures.map((texture) => ({
		hash: texture.sha256,
		source: { textureId: texture.id }
	}));
	const envelope = await unitEnvelope(projectId, 'Brushed metal', {
		textures: textures.map((texture) => ({
			id: texture.id,
			name: texture.id,
			uri: `/project-assets/${texture.id}`
		})),
		materials: [{ id: 'brushed-metal', name: 'Brushed metal', base: { material: hash } }],
		resources: [
			...textures.map((texture) => ({
				kind: 'texture', id: texture.id, contentRevision: texture.sha256,
				pin: texturePin(texture), unresolved: null
			})),
			{ kind: 'material', id: hash, contentRevision: hash, pin: null, unresolved: null, material: { recipe: recipeRead.recipe, images } }
		],
		lockEntries: [{
			domain: 'resource:material', subjectKind: 'resource', subjectId: hash, instancePath: [],
			contentRevision: hash, requiredCapabilities: [{ id: 'pbr-metallic-roughness', version: '1' }], pin: null
		}]
	});
	const request = await requestFor(envelope, { precondition: { kind: 'expected-saved-base', token: baseline.savedBaseToken } });
	const saved = await saveAcceptedSource(pool, owner, request, store);
	assert.equal(saved.version, 2);
	const pins = await prepareProjectImagePins(pool, store, owner, projectId, envelope, 'private-save');
	assert.deepEqual(pins.map((pin) => pin.assetId).sort(), textures.map((texture) => texture.id).sort());
	assert.deepEqual(new Set(pins.map((pin) => pin.sha256)), new Set(textures.map((texture) => texture.sha256)));
	// Every definition image is independently verified against its blob.
	const colorPin = pins.find((pin) => pin.assetId === color.id);
	store.objects.delete(colorPin.objectKey);
	await assert.rejects(
		saveAcceptedSource(
			pool, owner,
			await requestFor(envelope, { precondition: { kind: 'expected-saved-base', token: saved.savedBaseToken } }),
			store
		),
		(error) => error.code === 'image-missing' || /missing from storage/.test(String(error.message))
	);
	store.objects.set(colorPin.objectKey, { bytes: colorBytes, options: { contentType: 'image/png' } });
	const normalPin = pins.find((pin) => pin.assetId === normal.id);
	const corrupt = tinyPng(9, 9, 9);
	store.objects.set(normalPin.objectKey, { bytes: corrupt, options: { contentType: 'image/png' } });
	await assert.rejects(
		saveAcceptedSource(
			pool, owner,
			await requestFor(envelope, { precondition: { kind: 'expected-saved-base', token: saved.savedBaseToken } }),
			store
		),
		(error) => error.code === 'image-corrupt' || error.code === 'image-pin-changed' ||
			/corrupt|pin changed|differ from their registry digest/i.test(String(error.message))
	);
	const state = await pool.query('SELECT latest_version AS "latestVersion" FROM projects WHERE id = $1', [projectId]);
	assert.equal(state.rows[0].latestVersion, 2);
});

test('Save refuses a Finish override static image outside the frozen manifest', async () => {
	const projectId = nextProjectId();
	createdProjects.push(projectId);
	const owner = `owner:${randomUUID()}`;
	const store = memoryObjectStore();
	const first = await saveAcceptedSource(pool, owner, await requestFor(await unitEnvelope(projectId)));
	const envelope = await unitEnvelope(projectId, 'Bad static override', {
		materials: [{
			id: 'finish', name: 'Finish', base: { catalogue: 'plaster-warm' },
			overrides: { maps: { color: { image: { shipped: '/evil/anything.png' } } } }
		}]
	});
	await assert.rejects(
		async () => saveAcceptedSource(
			pool, owner,
			await requestFor(envelope, { precondition: { kind: 'expected-saved-base', token: first.savedBaseToken } }),
			store
		),
		(error) => error.code === 'invalid-project' || /unknown-static-image/.test(String(error.message))
	);
	const state = await pool.query('SELECT latest_version AS "latestVersion" FROM projects WHERE id = $1', [projectId]);
	assert.equal(state.rows[0].latestVersion, 1);
});

test('Finish-only Save verifies the texture closure and refuses missing bytes without advancing the head', async () => {
	const projectId = nextProjectId();
	createdProjects.push(projectId);
	const owner = `owner:${randomUUID()}`;
	const store = memoryObjectStore();
	const first = await saveAcceptedSource(pool, owner, await requestFor(await unitEnvelope(projectId)));
	const bytes = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=', 'base64');
	const ready = await uploadTexture(owner, projectId, store, 'Colour.png', bytes);
	const envelope = await finishEnvelope(projectId, 'Finish only', ready);
	const request = await requestFor(envelope, { precondition: { kind: 'expected-saved-base', token: first.savedBaseToken } });
	store.objects.delete([...store.objects.keys()][0]);
	await assert.rejects(
		() => saveAcceptedSource(pool, owner, request, store),
		(error) => error.code === 'invalid-project' &&
			error.issues.some((issue) => issue.code === 'image-missing' && issue.path === '$.units.scene.data.textures[0].uri')
	);
	const state = await pool.query('SELECT latest_version AS "latestVersion" FROM projects WHERE id = $1', [projectId]);
	assert.equal(state.rows[0].latestVersion, 1);
	// Restoring the exact bytes lets the same captured operation save.
	const objectKey = [...store.objects.keys()][0] ?? (await pool.query(
		'SELECT object_key AS "objectKey" FROM assets WHERE id = $1', [ready.id]
	)).rows[0].objectKey;
	store.objects.set(objectKey, { bytes, options: { contentType: 'image/png' } });
	const saved = await saveAcceptedSource(pool, owner, request, store);
	assert.equal(saved.version, 2);
});

test('Save verifies one image shared by a Finish and an unplaced Artwork and keeps same-name projects isolated', async () => {
	const store = memoryObjectStore();
	const bytes = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=', 'base64');
	const projectA = nextProjectId();
	const projectB = nextProjectId();
	createdProjects.push(projectA, projectB);
	const ownerA = `owner:${randomUUID()}`;
	const ownerB = `owner:${randomUUID()}`;
	const firstA = await saveAcceptedSource(pool, ownerA, await requestFor(await unitEnvelope(projectA)));
	const firstB = await saveAcceptedSource(pool, ownerB, await requestFor(await unitEnvelope(projectB)));
	const readyA = await uploadTexture(ownerA, projectA, store, 'Shared.png', bytes);
	const readyB = await uploadTexture(ownerB, projectB, store, 'Shared.png', bytes);
	const envelopeA = await finishEnvelope(projectA, 'Shared', readyA, {
		artworkLibrary: [{ assetId: readyA.id, name: 'Unplaced shared', pixelWidth: 1, pixelHeight: 1 }]
	});
	const envelopeB = await finishEnvelope(projectB, 'Shared', readyB);
	const savedA = await saveAcceptedSource(
		pool, ownerA,
		await requestFor(envelopeA, { precondition: { kind: 'expected-saved-base', token: firstA.savedBaseToken } }), store
	);
	const savedB = await saveAcceptedSource(
		pool, ownerB,
		await requestFor(envelopeB, { precondition: { kind: 'expected-saved-base', token: firstB.savedBaseToken } }), store
	);
	assert.equal(savedA.version, 2);
	assert.equal(savedB.version, 2);
	// The unplaced shelf entry stays in the private closure even though release
	// preparation would exclude it.
	const privateA = collectEnvelopeImageRequirements(envelopeA, 'private-save');
	const deliveryA = collectEnvelopeImageRequirements(envelopeA, 'delivery');
	assert.ok(privateA.requirements[0].paths.includes('$.units.scene.data.artworkLibrary[0]'));
	assert.equal(deliveryA.requirements[0].paths.includes('$.units.scene.data.artworkLibrary[0]'), false);
	await prepareProjectImagePins(pool, store, ownerA, projectA, envelopeA, 'private-load');
	await assert.rejects(
		prepareProjectImagePins(pool, store, ownerB, projectA, envelopeA, 'private-load')
	);
	assert.equal(readyA.sha256, readyB.sha256);
});

test('Save refuses a texture resource pin that differs from the ready row before any write', async () => {
	const projectId = nextProjectId();
	createdProjects.push(projectId);
	const owner = `owner:${randomUUID()}`;
	const store = memoryObjectStore();
	const first = await saveAcceptedSource(pool, owner, await requestFor(await unitEnvelope(projectId)));
	const bytes = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=', 'base64');
	const ready = await uploadTexture(owner, projectId, store, 'Changed.png', bytes);
	const envelope = await finishEnvelope(projectId, 'Changed pin', ready);
	envelope.units.resources.data.resources[0].pin = {
		...envelope.units.resources.data.resources[0].pin,
		hash: `sha256-${'0'.repeat(64)}`
	};
	const request = await requestFor(envelope, { precondition: { kind: 'expected-saved-base', token: first.savedBaseToken } });
	await assert.rejects(
		() => saveAcceptedSource(pool, owner, request, store),
		(error) => error.code === 'invalid-project' && error.issues.some((issue) => issue.code === 'image-pin-changed')
	);
	const state = await pool.query('SELECT latest_version AS "latestVersion" FROM projects WHERE id = $1', [projectId]);
	assert.equal(state.rows[0].latestVersion, 1);
});

test('two concurrent image-bearing Saves: exactly one advances and the loser preserves the image and head', async () => {
	const projectId = nextProjectId();
	createdProjects.push(projectId);
	const owner = `owner:${randomUUID()}`;
	const store = memoryObjectStore();
	const first = await saveAcceptedSource(pool, owner, await requestFor(await unitEnvelope(projectId)));
	const bytes = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=', 'base64');
	const ready = await uploadTexture(owner, projectId, store, 'Concurrent.png', bytes);
	const left = await requestFor(await finishEnvelope(projectId, 'Left', ready), {
		precondition: { kind: 'expected-saved-base', token: first.savedBaseToken }
	});
	const right = await requestFor(await finishEnvelope(projectId, 'Right', ready), {
		precondition: { kind: 'expected-saved-base', token: first.savedBaseToken }
	});
	const settled = await Promise.allSettled([
		saveAcceptedSource(pool, owner, left, store),
		saveAcceptedSource(pool, owner, right, store)
	]);
	assert.equal(settled.filter((entry) => entry.status === 'fulfilled').length, 1);
	const loser = settled.find((entry) => entry.status === 'rejected');
	assert.equal(loser.reason.code, 'conflict');
	const versions = await pool.query('SELECT count(*)::int AS count FROM project_versions WHERE project_id = $1', [projectId]);
	assert.equal(versions.rows[0].count, 2);
	const object = await pool.query('SELECT object_key AS "objectKey" FROM assets WHERE id = $1', [ready.id]);
	assert.deepEqual(store.objects.get(object.rows[0].objectKey).bytes, bytes);
});

test('Artwork Save verifies project bytes and release preparation pins each placed image once', async () => {
	const projectId = nextProjectId();
	createdProjects.push(projectId);
	const owner = `owner:${randomUUID()}`;
	const store = memoryObjectStore();
	const first = await saveAcceptedSource(pool, owner, await requestFor(await unitEnvelope(projectId)));
	const bytes = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=', 'base64');
	async function upload(name) {
		const pending = await registerAsset(pool, owner, projectId, name, 'test');
		const ready = await uploadAsset(pool, owner, projectId, pending.id, bytes.length, Readable.from([bytes]), store, 'test');
		return { assetId: ready.id, name, pixelWidth: 1, pixelHeight: 1 };
	}
	const image = await upload('Placed.png');
	const unplaced = await upload('Unplaced.png');
	const artwork = {
		id: 'artwork-a', kind: 'artwork', name: image.name, position: [0, 1, 0], rotation: [0, 0, 0],
		widthMeters: 1, source: { kind: 'image', assetId: image.assetId, pixelWidth: 1, pixelHeight: 1 }
	};
	const envelope = await unitEnvelope(projectId, 'Artwork Save', {
		artworkLibrary: [unplaced, image], sceneEntities: [artwork, { ...artwork, id: 'artwork-b' }]
	});
	const request = await requestFor(envelope, { precondition: { kind: 'expected-saved-base', token: first.savedBaseToken } });
	const pins = await prepareArtworkPins(pool, store, owner, projectId, envelope.units.scene.data, 'release');
	assert.deepEqual(pins.map((pin) => pin.assetId), [image.assetId]);
	await assert.rejects(prepareArtworkPins(pool, store, 'foreign', projectId, envelope.units.scene.data, 'release'));
	const original = store.objects.get(pins[0].objectKey);
	store.objects.set(pins[0].objectKey, { ...original, bytes: Buffer.alloc(bytes.length) });
	await assert.rejects(saveAcceptedSource(pool, owner, request, store), /registry digest/);
	const before = await pool.query('SELECT latest_version FROM projects WHERE id = $1', [projectId]);
	assert.equal(Number(before.rows[0].latest_version), 1);
	store.objects.set(pins[0].objectKey, original);
	const saved = await saveAcceptedSource(pool, owner, request, store);
	assert.equal(saved.version, 2);
	store.objects.delete(pins[0].objectKey);
	assert.deepEqual(await saveAcceptedSource(pool, owner, request, store), saved);
});
