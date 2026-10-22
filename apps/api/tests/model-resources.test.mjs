/**
 * T2.P02.S01 — model resource storage and Save verification.
 *
 * Real Postgres and a real (memory) object store, **no skip guards**: the slice's
 * contract is a staged import whose declared bytes are adopted only when the
 * upload agrees with them, an approved immutable revision keyed by content, and a
 * Save that refuses a `model` resource naming bytes this project has not
 * approved. A mock would prove none of the row, transaction or byte-retention
 * behaviour.
 *
 * The format-side half (resource/Scene schemas, closure, admission and the dual
 * resource grant) is `apps/editor/tests/lib/project-model/model-resource-admission.test.ts`.
 */
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import test, { after, before } from 'node:test';

import { createEmptyWallFirstLayoutDocument } from '@portfolio/project-model';
import {
	CAMERA_UNIT_FORMAT_VERSION,
	EXPERIENCE_UNIT_FORMAT_VERSION,
	MODEL_RESOURCE_MIME,
	RESOURCE_UNIT_FORMAT_VERSION,
	SCENE_UNIT_FORMAT_VERSION,
	createProjectEnvelope
} from '@portfolio/project-model/units';

import { createApp } from '../dist/app.js';
import { runMigrations } from '../dist/migrate.js';

import { SESSION_KEY, memoryObjectStore, saveRequestBody, sessionCookie } from './test-support.mjs';

const DATABASE_URL = process.env.DATABASE_URL ?? 'postgresql://localhost:5432/biskiq';
const SOURCE_SET_MAX = 50 * 1024 * 1024;
const DERIVATIVE_MAX = 25 * 1024 * 1024;

let pool;
let app;
let objectStore;
const createdProjects = [];
let counter = 0;

const PLACEMENT = {
	metresPerSourceUnit: 0.5,
	pivot: [0, 0, 0],
	footprint: { width: 1.2, depth: 0.8 },
	contactMinY: 0,
	placement: 'floor'
};
const REPORT_DIGEST = `sha256-${'9'.repeat(64)}`;

function nextProjectId() {
	counter += 1;
	return `p02model${Date.now().toString(36)}${counter}${randomUUID().slice(0, 6)}`;
}

function track(projectId) {
	createdProjects.push(projectId);
	return projectId;
}

async function cleanupProject(projectId) {
	await pool.query('DELETE FROM model_revisions WHERE project_id = $1', [projectId]);
	await pool.query('DELETE FROM model_imports WHERE project_id = $1', [projectId]);
	await pool.query('DELETE FROM save_receipts WHERE project_id = $1', [projectId]);
	await pool.query('DELETE FROM project_versions WHERE project_id = $1', [projectId]);
	await pool.query('DELETE FROM projects WHERE id = $1', [projectId]);
}

function hashOf(bytes) {
	return `sha256-${createHash('sha256').update(bytes).digest('hex')}`;
}

/** One GLB container with a JSON chunk and (optionally) a BIN chunk. */
function glb(document, bin = null) {
	const json = Buffer.from(JSON.stringify(document), 'utf8');
	const jsonPadding = (4 - (json.length % 4)) % 4;
	const jsonChunk = Buffer.concat([json, Buffer.alloc(jsonPadding, 0x20)]);
	const binPadding = bin === null ? 0 : (4 - (bin.length % 4)) % 4;
	const binChunk = bin === null ? null : Buffer.concat([bin, Buffer.alloc(binPadding, 0)]);
	const total = 12 + 8 + jsonChunk.length + (binChunk === null ? 0 : 8 + binChunk.length);
	const header = Buffer.alloc(12);
	header.writeUInt32LE(0x46546c67, 0);
	header.writeUInt32LE(2, 4);
	header.writeUInt32LE(total, 8);
	const jsonHeader = Buffer.alloc(8);
	jsonHeader.writeUInt32LE(jsonChunk.length, 0);
	jsonHeader.writeUInt32LE(0x4e4f534a, 4);
	const parts = [header, jsonHeader, jsonChunk];
	if (binChunk !== null) {
		const binHeader = Buffer.alloc(8);
		binHeader.writeUInt32LE(binChunk.length, 0);
		binHeader.writeUInt32LE(0x004e4942, 4);
		parts.push(binHeader, binChunk);
	}
	return Buffer.concat(parts);
}

function validSourceGlb(bytes = 4) {
	return glb(
		{ asset: { version: '2.0' }, buffers: [{ byteLength: bytes }], bufferViews: [{ buffer: 0, byteLength: bytes }] },
		Buffer.alloc(bytes, 1)
	);
}

function validDerivative(bytes = 8) {
	return glb(
		{ asset: { version: '2.0' }, buffers: [{ byteLength: bytes }], bufferViews: [{ buffer: 0, byteLength: bytes }] },
		Buffer.alloc(bytes, 2)
	);
}

function gltfSourceWithBuffer() {
	return {
		document: Buffer.from(
			JSON.stringify({
				asset: { version: '2.0' },
				buffers: [{ uri: 'buffer.bin', byteLength: 4 }],
				bufferViews: [{ buffer: 0, byteLength: 4 }]
			}),
			'utf8'
		),
		buffer: Buffer.alloc(4, 3)
	};
}

function declarationFor(files) {
	return {
		files: files.map(({ role, path, bytes }) => ({ role, path, size: bytes.length, hash: hashOf(bytes) })),
		recipe: { id: 'creator-import', version: 1 }
	};
}

function fileIdOf(created, path) {
	const file = created.files.find((candidate) => candidate.path === path);
	assert.ok(file, `import should declare ${path}`);
	return file.fileId;
}

async function upload(projectId, created, cookie, path, bytes) {
	const fileId = fileIdOf(created, path);
	return app.inject({
		method: 'PUT',
		url: `/projects/${projectId}/models/imports/${created.importId}/files/${fileId}/content`,
		headers: { cookie, 'content-type': 'application/octet-stream' },
		payload: bytes
	});
}

async function stage(projectId, cookie, files) {
	const response = await app.inject({
		method: 'POST',
		url: `/projects/${projectId}/models/imports`,
		headers: { cookie, 'content-type': 'application/json' },
		payload: declarationFor(files)
	});
	return response;
}

async function approve(projectId, importId, cookie) {
	return app.inject({
		method: 'POST',
		url: `/projects/${projectId}/models/imports/${importId}/approve`,
		headers: { cookie, 'content-type': 'application/json' },
		payload: { reportDigest: REPORT_DIGEST, placement: PLACEMENT }
	});
}

async function save(projectId, cookie, request) {
	return app.inject({
		method: 'PUT',
		url: `/projects/${projectId}`,
		headers: { cookie, 'content-type': 'application/json' },
		payload: request
	});
}

async function envelopeFor(projectId, { resources = [], lockEntries = [], entities = [] } = {}) {
	return createProjectEnvelope({
		id: projectId,
		name: 'Model project',
		acceptedRevision: { projectId, revisionId: `revision-${randomUUID()}` },
		dependencyLock: { formatVersion: 1, entries: lockEntries },
		layout: { unitId: 'unit-layout', data: createEmptyWallFirstLayoutDocument() },
		scene: {
			unitId: 'unit-scene',
			data: { formatVersion: SCENE_UNIT_FORMAT_VERSION, textures: [], materials: [], entities }
		},
		camera: {
			unitId: 'unit-camera',
			data: {
				formatVersion: CAMERA_UNIT_FORMAT_VERSION,
				views: [{ id: 'view-entry', label: 'Entry', eye: [0, 1.6, 0], target: [0, 1.6, -1], fov: 60, connectedViewIds: [] }],
				connections: []
			}
		},
		experience: { unitId: 'unit-experience', data: { formatVersion: EXPERIENCE_UNIT_FORMAT_VERSION, experiences: [] } },
		resources: { unitId: 'unit-resources', data: { formatVersion: RESOURCE_UNIT_FORMAT_VERSION, resources } }
	});
}

function modelEntity(assetId) {
	return {
		kind: 'model',
		id: 'entity-model-1',
		name: 'Imported model',
		assetId,
		fallback: 'generic',
		position: [0, 0, 0],
		rotation: [0, 0, 0]
	};
}

function modelResources(revision, { id = 'creator-model-1', overrides = {} } = {}) {
	const pin = {
		hash: revision.derivative.hash,
		mime: MODEL_RESOURCE_MIME,
		size: revision.derivative.size,
		locator: revision.derivative.locator,
		...overrides
	};
	return {
		resource: {
			kind: 'model',
			id,
			contentRevision: pin.hash,
			pin,
			unresolved: null,
			model: {
				source: revision.source,
				recipe: revision.recipe,
				reportDigest: revision.reportDigest,
				placement: revision.placement
			}
		},
		lockEntry: {
			domain: 'resource:model',
			subjectKind: 'resource',
			subjectId: id,
			instancePath: [],
			contentRevision: pin.hash,
			requiredCapabilities: [{ id: 'F2.unit-envelope', version: '1' }],
			pin
		}
	};
}

/** Create the project (and its owner) through the live Save route. */
async function newProject(cookie) {
	const projectId = track(nextProjectId());
	const request = await saveRequestBody(await envelopeFor(projectId));
	const response = await save(projectId, cookie, request);
	assert.equal(response.statusCode, 200, JSON.stringify(response.json()));
	return { projectId, savedBaseToken: response.json().savedBaseToken };
}

before(async () => {
	pool = new Pool({ connectionString: DATABASE_URL, connectionTimeoutMillis: 3000 });
	await pool.query('SELECT 1');
	await runMigrations(pool);
	objectStore = memoryObjectStore();
	app = createApp({ pool, sessionKey: SESSION_KEY, logger: false, objectStore, objectNamespace: 'model-test' });
	await app.ready();
});

after(async () => {
	for (const projectId of createdProjects) await cleanupProject(projectId);
	if (app) await app.close();
	else if (pool) await pool.end();
});

test('a staged import is owner-only and adopts only bytes that match its declaration', async () => {
	const owner = await sessionCookie(app, `google:p02-owner-${randomUUID()}`);
	const stranger = await sessionCookie(app, `google:p02-stranger-${randomUUID()}`);
	const { projectId } = await newProject(owner);
	const source = validSourceGlb();
	const derivative = validDerivative();

	const unauthenticated = await app.inject({
		method: 'POST',
		url: `/projects/${projectId}/models/imports`,
		headers: { 'content-type': 'application/json' },
		payload: declarationFor([
			{ role: 'source', path: 'model.glb', bytes: source },
			{ role: 'derivative', path: 'model.glb.derivative.glb', bytes: derivative }
		])
	});
	assert.equal(unauthenticated.statusCode, 401);

	const staged = await stage(projectId, owner, [
		{ role: 'source', path: 'model.glb', bytes: source },
		{ role: 'derivative', path: 'model.glb.derivative.glb', bytes: derivative }
	]);
	assert.equal(staged.statusCode, 201, JSON.stringify(staged.json()));
	const created = staged.json();
	assert.equal(created.state, 'staging');
	assert.equal(created.source.fileCount, 1);
	assert.equal(created.derivativeBytes, derivative.length);

	const foreignStage = await stage(projectId, stranger, [
		{ role: 'source', path: 'model.glb', bytes: source },
		{ role: 'derivative', path: 'model.glb.derivative.glb', bytes: derivative }
	]);
	assert.equal(foreignStage.statusCode, 404, 'a foreign owner cannot stage into this project');

	// The bytes disagree with the declared hash: they are refused and not adopted.
	const tampered = Buffer.concat([source, Buffer.from([0])]);
	const mismatched = await upload(projectId, created, owner, 'model.glb', tampered);
	assert.equal(mismatched.statusCode, 400, JSON.stringify(mismatched.json()));
	const notReady = await approve(projectId, created.importId, owner);
	assert.equal(notReady.statusCode, 409, 'a refused upload leaves the import incomplete');

	const rejectedStranger = await upload(projectId, created, stranger, 'model.glb', source);
	assert.equal(rejectedStranger.statusCode, 404);

	const uploadedSource = await upload(projectId, created, owner, 'model.glb', source);
	assert.equal(uploadedSource.statusCode, 200, JSON.stringify(uploadedSource.json()));
	assert.equal(uploadedSource.json().uploadState, 'uploaded');
	const uploadedDerivative = await upload(projectId, created, owner, 'model.glb.derivative.glb', derivative);
	assert.equal(uploadedDerivative.statusCode, 200, JSON.stringify(uploadedDerivative.json()));

	const first = await approve(projectId, created.importId, owner);
	assert.equal(first.statusCode, 200, JSON.stringify(first.json()));
	const revision = first.json();
	assert.equal(revision.contentHash, revision.contentHash.toLowerCase());
	assert.equal(revision.derivative.hash, hashOf(derivative));
	assert.equal(revision.derivative.size, derivative.length);
	assert.equal(revision.source.manifestHash, created.source.manifestHash);
	assert.equal(revision.source.fileCount, 1);
	assert.deepEqual(revision.placement, PLACEMENT);

	const again = await approve(projectId, created.importId, owner);
	assert.equal(again.statusCode, 200);
	assert.equal(again.json().revisionId, revision.revisionId, 'approval is idempotent');

	// A second import of the identical retained content reuses the one revision
	// rather than minting another.
	const secondImport = await stage(projectId, owner, [
		{ role: 'source', path: 'model.glb', bytes: source },
		{ role: 'derivative', path: 'model.glb.derivative.glb', bytes: derivative }
	]);
	assert.equal(secondImport.statusCode, 201, JSON.stringify(secondImport.json()));
	await upload(projectId, secondImport.json(), owner, 'model.glb', source);
	await upload(projectId, secondImport.json(), owner, 'model.glb.derivative.glb', derivative);
	const reused = await approve(projectId, secondImport.json().importId, owner);
	assert.equal(reused.statusCode, 200, JSON.stringify(reused.json()));
	assert.equal(reused.json().revisionId, revision.revisionId, 'identical content reuses its revision');
	const revisions = await pool.query('SELECT count(*)::int AS count FROM model_revisions WHERE project_id = $1', [projectId]);
	assert.equal(revisions.rows[0].count, 1);

	const cancelledApproved = await app.inject({
		method: 'DELETE',
		url: `/projects/${projectId}/models/imports/${created.importId}`,
		headers: { cookie: owner }
	});
	assert.equal(cancelledApproved.statusCode, 409, 'an approved revision cannot be cancelled');

	const contentUrl = `/projects/${projectId}/models/content/${revision.derivative.hash}`;
	const content = await app.inject({ method: 'GET', url: contentUrl, headers: { cookie: owner } });
	assert.equal(content.statusCode, 200);
	assert.deepEqual(content.rawPayload, derivative);
	assert.equal(content.headers['content-type'], MODEL_RESOURCE_MIME);
	assert.match(content.headers['cache-control'], /immutable/);
	assert.equal(content.headers.etag, `"${revision.derivative.hash}"`);
	const foreignContent = await app.inject({ method: 'GET', url: contentUrl, headers: { cookie: stranger } });
	assert.equal(foreignContent.statusCode, 404);
	const anonymousContent = await app.inject({ method: 'GET', url: contentUrl });
	assert.equal(anonymousContent.statusCode, 401);

	const stagedKeysAfterApproval = [...objectStore.objects.keys()].filter((key) => key.includes(`/imports/${created.importId}/`));
	assert.deepEqual(stagedKeysAfterApproval, [], 'promotion deletes the staging copies');
	const importState = await pool.query('SELECT state FROM model_imports WHERE id = $1::uuid', [created.importId]);
	assert.equal(importState.rows[0].state, 'approved');
	const retained = await pool.query(
		`SELECT count(*)::int AS count FROM model_revisions WHERE project_id = $1 AND derivative_key IS NOT NULL`,
		[projectId]
	);
	assert.equal(retained.rows[0].count, 1);
});

test('the declaration enforces the owner-accepted 50 MiB / 25 MiB bounds', async () => {
	const owner = await sessionCookie(app, `google:p02-bounds-${randomUUID()}`);
	const { projectId } = await newProject(owner);
	const source = validSourceGlb();
	const derivative = validDerivative();

	const oversizeSource = await app.inject({
		method: 'POST',
		url: `/projects/${projectId}/models/imports`,
		headers: { cookie: owner, 'content-type': 'application/json' },
		payload: {
			files: [
				{ role: 'source', path: 'model.glb', size: SOURCE_SET_MAX + 1, hash: hashOf(source) },
				{ role: 'derivative', path: 'model.glb.derivative.glb', size: derivative.length, hash: hashOf(derivative) }
			],
			recipe: { id: 'creator-import', version: 1 }
		}
	});
	assert.equal(oversizeSource.statusCode, 413, JSON.stringify(oversizeSource.json()));

	const oversizeDerivative = await app.inject({
		method: 'POST',
		url: `/projects/${projectId}/models/imports`,
		headers: { cookie: owner, 'content-type': 'application/json' },
		payload: {
			files: [
				{ role: 'source', path: 'model.glb', size: source.length, hash: hashOf(source) },
				{ role: 'derivative', path: 'model.glb.derivative.glb', size: DERIVATIVE_MAX + 1, hash: hashOf(derivative) }
			],
			recipe: { id: 'creator-import', version: 1 }
		}
	});
	assert.equal(oversizeDerivative.statusCode, 413, JSON.stringify(oversizeDerivative.json()));

	const atBound = await app.inject({
		method: 'POST',
		url: `/projects/${projectId}/models/imports`,
		headers: { cookie: owner, 'content-type': 'application/json' },
		payload: {
			files: [
				{ role: 'source', path: 'model.glb', size: SOURCE_SET_MAX, hash: hashOf(source) },
				{ role: 'derivative', path: 'model.glb.derivative.glb', size: DERIVATIVE_MAX, hash: hashOf(derivative) }
			],
			recipe: { id: 'creator-import', version: 1 }
		}
	});
	assert.equal(atBound.statusCode, 201, 'the exact bound is admitted at declaration');
	const cancelled = await app.inject({
		method: 'DELETE',
		url: `/projects/${projectId}/models/imports/${atBound.json().importId}`,
		headers: { cookie: owner }
	});
	assert.equal(cancelled.statusCode, 204);

	const noDerivative = await app.inject({
		method: 'POST',
		url: `/projects/${projectId}/models/imports`,
		headers: { cookie: owner, 'content-type': 'application/json' },
		payload: {
			files: [{ role: 'source', path: 'model.glb', size: source.length, hash: hashOf(source) }],
			recipe: { id: 'creator-import', version: 1 }
		}
	});
	assert.equal(noDerivative.statusCode, 400);
});

test('approval refuses a non-glTF derivative and a source set missing a referenced file', async () => {
	const owner = await sessionCookie(app, `google:p02-structure-${randomUUID()}`);
	const { projectId } = await newProject(owner);
	const derivative = validDerivative();
	const source = validSourceGlb();
	const notAModel = Buffer.from('this is not a glb container at all', 'utf8');

	const refused = await stage(projectId, owner, [
		{ role: 'source', path: 'model.glb', bytes: source },
		{ role: 'derivative', path: 'audit.txt', bytes: notAModel }
	]);
	assert.equal(refused.statusCode, 201, JSON.stringify(refused.json()));
	const refusedCreated = refused.json();
	await upload(projectId, refusedCreated, owner, 'model.glb', source);
	await upload(projectId, refusedCreated, owner, 'audit.txt', notAModel);
	const refusedApproval = await approve(projectId, refusedCreated.importId, owner);
	assert.equal(refusedApproval.statusCode, 400, JSON.stringify(refusedApproval.json()));
	assert.equal(refusedApproval.json().error.code, 'model_structure_refused');
	const noRevision = await pool.query('SELECT count(*)::int AS count FROM model_revisions WHERE project_id = $1', [projectId]);
	assert.equal(noRevision.rows[0].count, 0, 'a refused structure writes no revision');

	const gltf = gltfSourceWithBuffer();
	const missing = await stage(projectId, owner, [
		{ role: 'source', path: 'model/scene.gltf', bytes: gltf.document },
		{ role: 'derivative', path: 'model/scene.derivative.glb', bytes: derivative }
	]);
	assert.equal(missing.statusCode, 201, JSON.stringify(missing.json()));
	const missingCreated = missing.json();
	await upload(projectId, missingCreated, owner, 'model/scene.gltf', gltf.document);
	await upload(projectId, missingCreated, owner, 'model/scene.derivative.glb', derivative);
	const missingApproval = await approve(projectId, missingCreated.importId, owner);
	assert.equal(missingApproval.statusCode, 400, JSON.stringify(missingApproval.json()));
	assert.equal(missingApproval.json().error.code, 'model_structure_refused');
	assert.match(missingApproval.json().error.message, /missing-referenced-file/);
});

test('a glTF source set with its referenced buffer and a self-contained derivative is approved', async () => {
	const owner = await sessionCookie(app, `google:p02-gltf-${randomUUID()}`);
	const { projectId } = await newProject(owner);
	const gltf = gltfSourceWithBuffer();
	const derivative = validDerivative(12);

	const staged = await stage(projectId, owner, [
		{ role: 'source', path: 'model/scene.gltf', bytes: gltf.document },
		{ role: 'source', path: 'model/buffer.bin', bytes: gltf.buffer },
		{ role: 'derivative', path: 'model/scene.derivative.glb', bytes: derivative }
	]);
	assert.equal(staged.statusCode, 201, JSON.stringify(staged.json()));
	const created = staged.json();
	assert.equal(created.source.fileCount, 2);
	for (const [path, bytes] of [
		['model/scene.gltf', gltf.document],
		['model/buffer.bin', gltf.buffer],
		['model/scene.derivative.glb', derivative]
	]) {
		const uploaded = await upload(projectId, created, owner, path, bytes);
		assert.equal(uploaded.statusCode, 200, JSON.stringify(uploaded.json()));
	}
	const approved = await approve(projectId, created.importId, owner);
	assert.equal(approved.statusCode, 200, JSON.stringify(approved.json()));
	assert.equal(approved.json().source.fileCount, 2);
});

test('cancelling a staging import deletes its bytes and the import', async () => {
	const owner = await sessionCookie(app, `google:p02-cancel-${randomUUID()}`);
	const { projectId } = await newProject(owner);
	const source = validSourceGlb();
	const derivative = validDerivative();

	const staged = await stage(projectId, owner, [
		{ role: 'source', path: 'model.glb', bytes: source },
		{ role: 'derivative', path: 'model.glb.derivative.glb', bytes: derivative }
	]);
	const created = staged.json();
	assert.equal((await upload(projectId, created, owner, 'model.glb', source)).statusCode, 200);
	const importKeys = (importId) => [...objectStore.objects.keys()].filter((key) => key.includes(`/imports/${importId}/`));
	assert.ok(importKeys(created.importId).length > 0);

	const cancelled = await app.inject({
		method: 'DELETE',
		url: `/projects/${projectId}/models/imports/${created.importId}`,
		headers: { cookie: owner }
	});
	assert.equal(cancelled.statusCode, 204);
	assert.deepEqual(importKeys(created.importId), [], 'staged bytes are deleted with the import');
	const gone = await pool.query('SELECT count(*)::int AS count FROM model_imports WHERE id = $1::uuid', [created.importId]);
	assert.equal(gone.rows[0].count, 0);
	const lateUpload = await upload(projectId, created, owner, 'model.glb', source);
	assert.equal(lateUpload.statusCode, 404);
});

test('staging past its 24 hour expiry is deleted, bytes included, when the owner next stages', async () => {
	const owner = await sessionCookie(app, `google:p02-expiry-${randomUUID()}`);
	const { projectId } = await newProject(owner);
	const source = validSourceGlb();
	const derivative = validDerivative();

	const staged = await stage(projectId, owner, [
		{ role: 'source', path: 'model.glb', bytes: source },
		{ role: 'derivative', path: 'model.glb.derivative.glb', bytes: derivative }
	]);
	const created = staged.json();
	await upload(projectId, created, owner, 'model.glb', source);
	const importKeys = () => [...objectStore.objects.keys()].filter((key) => key.includes(`/imports/${created.importId}/`));
	assert.ok(importKeys().length > 0);
	await pool.query(`UPDATE model_imports SET created_at = now() - interval '2 days', expires_at = now() - interval '1 day' WHERE id = $1::uuid`, [
		created.importId
	]);

	const next = await stage(projectId, owner, [
		{ role: 'source', path: 'model.glb', bytes: source },
		{ role: 'derivative', path: 'model.glb.derivative.glb', bytes: derivative }
	]);
	assert.equal(next.statusCode, 201, JSON.stringify(next.json()));
	assert.deepEqual(importKeys(), [], 'expired staging bytes are deleted');
	const expired = await pool.query('SELECT count(*)::int AS count FROM model_imports WHERE id = $1::uuid', [created.importId]);
	assert.equal(expired.rows[0].count, 0);
	const approveExpired = await approve(projectId, created.importId, owner);
	assert.equal(approveExpired.statusCode, 404);

	await app.inject({
		method: 'DELETE',
		url: `/projects/${projectId}/models/imports/${next.json().importId}`,
		headers: { cookie: owner }
	});
});

test('Save admits a model resource pinned to an approved revision and refuses every other pin', async () => {
	const owner = await sessionCookie(app, `google:p02-save-${randomUUID()}`);
	const { projectId, savedBaseToken } = await newProject(owner);
	const source = validSourceGlb(16);
	const derivative = validDerivative(16);
	const declaration = declarationFor([
		{ role: 'source', path: 'model.glb', bytes: source },
		{ role: 'derivative', path: 'model.glb.derivative.glb', bytes: derivative }
	]);

	const staged = await app.inject({
		method: 'POST',
		url: `/projects/${projectId}/models/imports`,
		headers: { cookie: owner, 'content-type': 'application/json' },
		payload: declaration
	});
	const created = staged.json();
	await upload(projectId, created, owner, 'model.glb', source);
	await upload(projectId, created, owner, 'model.glb.derivative.glb', derivative);
	const approved = await approve(projectId, created.importId, owner);
	assert.equal(approved.statusCode, 200, JSON.stringify(approved.json()));
	const revision = approved.json();
	const { resource, lockEntry } = modelResources(revision);

	const accepted = await envelopeFor(projectId, {
		resources: [resource],
		lockEntries: [lockEntry],
		entities: [modelEntity(resource.id)]
	});
	const acceptedSave = await save(projectId, owner, await saveRequestBody(accepted, { precondition: { kind: 'expected-saved-base', token: savedBaseToken } }));
	assert.equal(acceptedSave.statusCode, 200, JSON.stringify(acceptedSave.json()));
	const acceptedVersion = acceptedSave.json().version;
	assert.equal(acceptedVersion, 2);
	const base = acceptedSave.json().savedBaseToken;
	const atBase = { kind: 'expected-saved-base', token: base };
	const loaded = await app.inject({ method: 'GET', url: `/projects/${projectId}`, headers: { cookie: owner } });
	const loadedDocument = loaded.json().document;
	const storedResource = loadedDocument.units.resources.data.resources[0];
	assert.equal(storedResource.kind, 'model');
	assert.deepEqual(storedResource.pin, resource.pin);
	assert.deepEqual(storedResource.model, resource.model);

	// A model resource this project never approved, at an otherwise valid shape.
	const unknownHash = `sha256-${'e'.repeat(64)}`;
	const unknown = modelResources(revision, { overrides: { hash: unknownHash } });
	const unapproved = await envelopeFor(projectId, {
		resources: [unknown.resource],
		lockEntries: [unknown.lockEntry],
		entities: [modelEntity(resource.id)]
	});
	const refusedUnknown = await save(projectId, owner, await saveRequestBody(unapproved, { precondition: atBase }));
	assert.equal(refusedUnknown.statusCode, 400, JSON.stringify(refusedUnknown.json()));
	assert.equal(refusedUnknown.json().error.code, 'unapproved_model_resource');

	// The approved bytes, but a pin size that disagrees with the revision.
	const wrongSize = modelResources(revision, { overrides: { size: revision.derivative.size + 4 } });
	const refusedSize = await save(
		projectId,
		owner,
		await saveRequestBody(
			await envelopeFor(projectId, {
				resources: [{ ...wrongSize.resource, contentRevision: revision.derivative.hash }],
				lockEntries: [wrongSize.lockEntry],
				entities: [modelEntity(resource.id)]
			}),
			{ precondition: atBase }
		)
	);
	assert.equal(refusedSize.statusCode, 400, JSON.stringify(refusedSize.json()));
	assert.equal(refusedSize.json().error.code, 'unapproved_model_resource');

	// The approved derivative in *another* project cannot satisfy this project's Save.
	const otherOwner = await sessionCookie(app, `google:p02-save-other-${randomUUID()}`);
	const other = await newProject(otherOwner);
	const foreign = modelResources(revision);
	const refusedForeign = await save(
		other.projectId,
		otherOwner,
		await saveRequestBody(
			await envelopeFor(other.projectId, {
				resources: [foreign.resource],
				lockEntries: [foreign.lockEntry],
				entities: [modelEntity(foreign.resource.id)]
			}),
			{ precondition: { kind: 'expected-saved-base', token: other.savedBaseToken } }
		)
	);
	assert.equal(refusedForeign.statusCode, 400, JSON.stringify(refusedForeign.json()));
	assert.equal(refusedForeign.json().error.code, 'unapproved_model_resource');

	// A staging import that was never approved supplies no revision either.
	const stagedOnlyDerivative = validDerivative(20);
	const stagedOnly = await stage(projectId, owner, [
		{ role: 'source', path: 'staged.glb', bytes: validSourceGlb(4) },
		{ role: 'derivative', path: 'staged.derivative.glb', bytes: stagedOnlyDerivative }
	]);
	assert.equal(stagedOnly.statusCode, 201, JSON.stringify(stagedOnly.json()));
	const stagedHash = hashOf(stagedOnlyDerivative);
	const stagedResource = {
		kind: 'model',
		id: 'staged-model',
		contentRevision: stagedHash,
		pin: { hash: stagedHash, mime: MODEL_RESOURCE_MIME, size: stagedOnlyDerivative.length, locator: `/projects/${projectId}/models/content/${stagedHash}` },
		unresolved: null,
		model: resource.model
	};
	const refusedStaged = await save(
		projectId,
		owner,
		await saveRequestBody(
			await envelopeFor(projectId, {
				resources: [stagedResource],
				lockEntries: [{ ...lockEntry, subjectId: 'staged-model', contentRevision: stagedHash, pin: stagedResource.pin }],
				entities: [modelEntity('staged-model')]
			}),
			{ precondition: atBase }
		)
	);
	assert.equal(refusedStaged.statusCode, 400, JSON.stringify(refusedStaged.json()));
	assert.equal(refusedStaged.json().error.code, 'unapproved_model_resource');

	// Every refusal rolled back: the project is still at the accepted version.
	const versions = await pool.query('SELECT latest_version AS "latest" FROM projects WHERE id = $1', [projectId]);
	assert.equal(versions.rows[0].latest, 2);
});
