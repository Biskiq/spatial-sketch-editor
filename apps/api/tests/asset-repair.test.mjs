/**
 * PR C — project-image verification and exact-byte repair.
 *
 * These are DB-backed contracts: a mock cannot prove the owner-scoped ready row,
 * the saved-base token, the project-then-asset lock order, the conditional key
 * swap, the idempotent healthy answer or the 24-hour staging sweep. The object
 * store is the shared in-memory double because the bytes are what the repair
 * verifies.
 */
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';
import { Pool } from 'pg';
import test, { after, before } from 'node:test';

import { createEmptyWallFirstLayoutDocument } from '@portfolio/project-model';
import { SAVE_CONTENT_IDENTITY_SCHEME } from '@portfolio/project-model/save';
import {
	CAMERA_UNIT_FORMAT_VERSION,
	EXPERIENCE_UNIT_FORMAT_VERSION,
	RESOURCE_UNIT_FORMAT_VERSION,
	SCENE_UNIT_FORMAT_VERSION,
	UNIT_ENVELOPE_SOURCE_VERSION,
	captureUnitSave,
	computeEnvelopeSourceContentId,
	createProjectEnvelope
} from '@portfolio/project-model/units';

import { createApp } from '../dist/app.js';
import { registerAsset, uploadAsset } from '../dist/asset-persistence.js';
import { prepareProjectImagePins } from '../dist/artwork-persistence.js';
import { runMigrations } from '../dist/migrate.js';
import { loadProject } from '../dist/project-persistence.js';
import { saveAcceptedSource } from '../dist/save-persistence.js';
import {
	memoryObjectStore,
	SESSION_COOKIE,
	SESSION_KEY,
	sessionCookie
} from './test-support.mjs';

const DATABASE_URL = process.env.DATABASE_URL ?? 'postgresql://localhost:5432/biskiq';
const PNG = Buffer.from(
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=',
	'base64'
);
const PNG_SHA = `sha256-${createHash('sha256').update(PNG).digest('hex')}`;

let pool;
let store;
const storeOptions = {};
let app;
const createdProjects = [];
let counter = 0;

function nextProjectId() {
	counter += 1;
	return `s8repair${Date.now().toString(36)}${counter}${randomUUID().slice(0, 8)}`;
}

async function envelopeFor(projectId, label, { textures = [], materials = [], resources = [], artworkLibrary = [], entities = [] } = {}) {
	return createProjectEnvelope({
		id: projectId,
		name: label,
		acceptedRevision: { projectId, revisionId: `revision-${randomUUID()}` },
		dependencyLock: { formatVersion: 1, entries: [] },
		layout: { unitId: 'unit-layout', data: createEmptyWallFirstLayoutDocument() },
		scene: {
			unitId: 'unit-scene',
			data: {
				formatVersion: SCENE_UNIT_FORMAT_VERSION,
				textures,
				materials,
				entities,
				...(artworkLibrary.length ? { artworkLibrary } : {})
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
			data: { formatVersion: RESOURCE_UNIT_FORMAT_VERSION, resources }
		}
	});
}

async function requestFor(envelopeInput, precondition) {
	const envelope = await envelopeInput;
	const sourceContentId = await computeEnvelopeSourceContentId(envelope);
	const captured = await captureUnitSave({
		snapshot: {
			acceptedRevision: envelope.acceptedRevision,
			sourceContentId,
			sourceKind: 'unit-envelope',
			sourceVersion: UNIT_ENVELOPE_SOURCE_VERSION,
			domain: { identity: { acceptedRevision: envelope.acceptedRevision, sourceContentId }, source: envelope }
		},
		operationId: `op-${randomUUID()}`,
		precondition: precondition ?? { kind: 'create-only' }
	});
	assert.equal(captured.kind, 'captured', JSON.stringify(captured));
	return { contentIdentityScheme: SAVE_CONTENT_IDENTITY_SCHEME, capture: captured.capture };
}

function textureRecord(assetId) {
	return { id: assetId, name: 'Brick', uri: `/project-assets/${assetId}` };
}

function finishMaterial(assetId) {
	return {
		id: 'finish', name: 'Finish', base: { catalogue: 'plaster-warm' },
		overrides: { color: '#ffffff', maps: { color: { image: { textureId: assetId } } } }
	};
}

async function createProjectWithFinishImage(owner = `google:${randomUUID()}`) {
	const projectId = nextProjectId();
	createdProjects.push(projectId);
	const first = await saveAcceptedSource(pool, owner, await requestFor(envelopeFor(projectId, 'Empty')));
	const pending = await registerAsset(pool, owner, projectId, 'Brick.png', 'test');
	const ready = await uploadAsset(
		pool, owner, projectId, pending.id, PNG.length, Readable.from([PNG]), store, 'test'
	);
	const pin = {
		hash: ready.sha256,
		mime: ready.mime,
		size: ready.byteSize,
		locator: `/project-assets/${ready.id}`
	};
	const envelope = envelopeFor(projectId, 'Finish image', {
		textures: [textureRecord(ready.id)],
		materials: [finishMaterial(ready.id)],
		resources: [{ kind: 'texture', id: ready.id, contentRevision: pin.hash, pin, unresolved: null }]
	});
	const saved = await saveAcceptedSource(
		pool, owner, await requestFor(envelope, { kind: 'expected-saved-base', token: first.savedBaseToken }), store
	);
	const row = await pool.query(
		'SELECT object_key AS "objectKey" FROM assets WHERE id = $1 AND project_id = $2',
		[ready.id, projectId]
	);
	return { projectId, owner, ready, pin, saved, first, envelope, objectKey: row.rows[0].objectKey };
}

async function objectKeyOf(projectId, assetId) {
	const row = await pool.query(
		'SELECT object_key AS "objectKey" FROM assets WHERE id = $1 AND project_id = $2',
		[assetId, projectId]
	);
	return row.rows[0].objectKey;
}

function repair(cookie, projectId, assetId, bytes, { expectedPin, savedBaseToken } = {}) {
	const query = new URLSearchParams({
		expectedPin: expectedPin ?? PNG_SHA,
		savedBase: savedBaseToken ?? ''
	});
	return app.inject({
		method: 'PUT',
		url: `/projects/${projectId}/assets/${assetId}/repair?${query.toString()}`,
		headers: {
			cookie,
			'content-type': 'application/octet-stream',
			'content-length': String(bytes.length)
		},
		payload: Readable.from([bytes])
	});
}

function within(promise, ms, label) {
	let timer;
	const deadline = new Promise((_, reject) => {
		timer = setTimeout(() => reject(new Error(`timed out after ${ms} ms: ${label}`)), ms);
	});
	return Promise.race([promise, deadline]).finally(() => clearTimeout(timer));
}

async function attemptCount(projectId) {
	const result = await pool.query(
		'SELECT count(*)::int AS count FROM image_repair_attempts WHERE project_id = $1',
		[projectId]
	);
	return result.rows[0].count;
}

before(async () => {
	pool = new Pool({ connectionString: DATABASE_URL, connectionTimeoutMillis: 3000 });
	await pool.query('SELECT 1');
	await runMigrations(pool);
	store = memoryObjectStore(storeOptions);
	app = createApp({
		pool,
		objectStore: store,
		objectNamespace: 'test',
		sessionKey: SESSION_KEY,
		logger: false
	});
});

after(async () => {
	for (const projectId of createdProjects) {
		await pool.query('DELETE FROM image_repair_attempts WHERE project_id = $1', [projectId]);
		await pool.query('DELETE FROM assets WHERE project_id = $1', [projectId]);
		await pool.query('DELETE FROM save_receipts WHERE project_id = $1', [projectId]);
		await pool.query('DELETE FROM project_versions WHERE project_id = $1', [projectId]);
		await pool.query('DELETE FROM projects WHERE id = $1', [projectId]);
	}
	if (app) await app.close();
});

test('a missing Finish image refuses a cold closure, then exact-byte repair restores the saved head and is idempotent', async () => {
	const fixture = await createProjectWithFinishImage();
	const cookie = await sessionCookie(app, fixture.owner);
	const loaded = await loadProject(pool, fixture.owner, fixture.projectId);
	store.objects.delete(fixture.objectKey);

	await assert.rejects(
		prepareProjectImagePins(pool, store, fixture.owner, fixture.projectId, loaded.document, 'private-load'),
		(error) => error.code === 'image-missing' && error.assetId === fixture.ready.id
	);

	const repaired = await repair(cookie, fixture.projectId, fixture.ready.id, PNG, {
		expectedPin: fixture.ready.sha256,
		savedBaseToken: fixture.saved.savedBaseToken
	});
	assert.equal(repaired.statusCode, 200, repaired.body);
	assert.deepEqual(repaired.json(), {
		projectId: fixture.projectId,
		assetId: fixture.ready.id,
		pin: { hash: fixture.ready.sha256, mime: fixture.ready.mime, size: fixture.ready.byteSize },
		replaced: true
	});
	const newKey = await objectKeyOf(fixture.projectId, fixture.ready.id);
	assert.notEqual(newKey, fixture.objectKey);
	assert.equal(store.objects.has(fixture.objectKey), false);
	assert.deepEqual(store.objects.get(newKey).bytes, PNG);
	await prepareProjectImagePins(pool, store, fixture.owner, fixture.projectId, loaded.document, 'private-load');

	const puts = store.puts.length;
	const repeated = await repair(cookie, fixture.projectId, fixture.ready.id, PNG, {
		expectedPin: fixture.ready.sha256,
		savedBaseToken: fixture.saved.savedBaseToken
	});
	assert.equal(repeated.statusCode, 200, repeated.body);
	assert.equal(repeated.json().replaced, false);
	assert.equal(await objectKeyOf(fixture.projectId, fixture.ready.id), newKey);
	assert.equal(store.puts.length, puts);
	assert.equal(await attemptCount(fixture.projectId), 0);
});

test('a wrong file refuses with 422 and preserves the old key and open saved base, then the original repairs', async () => {
	const fixture = await createProjectWithFinishImage();
	const cookie = await sessionCookie(app, fixture.owner);
	store.objects.delete(fixture.objectKey);
	const oldKey = await objectKeyOf(fixture.projectId, fixture.ready.id);
	const wrong = Buffer.from(PNG);
	wrong[wrong.length - 1] ^= 0xff;

	const refused = await repair(cookie, fixture.projectId, fixture.ready.id, wrong, {
		expectedPin: fixture.ready.sha256,
		savedBaseToken: fixture.saved.savedBaseToken
	});
	assert.equal(refused.statusCode, 422, refused.body);
	assert.equal(refused.json().error.code, 'image_mismatch');
	assert.equal(await objectKeyOf(fixture.projectId, fixture.ready.id), oldKey);
	assert.equal(store.objects.has(oldKey), false);
	assert.equal(await attemptCount(fixture.projectId), 0);

	const repaired = await repair(cookie, fixture.projectId, fixture.ready.id, PNG, {
		expectedPin: fixture.ready.sha256,
		savedBaseToken: fixture.saved.savedBaseToken
	});
	assert.equal(repaired.statusCode, 200, repaired.body);
	assert.equal(repaired.json().replaced, true);
	const loaded = await loadProject(pool, fixture.owner, fixture.projectId);
	assert.deepEqual(loaded.document.units.scene.data.textures, [textureRecord(fixture.ready.id)]);
	assert.equal(loaded.savedBaseToken, fixture.saved.savedBaseToken);
	await prepareProjectImagePins(pool, store, fixture.owner, fixture.projectId, loaded.document, 'private-load');
});

test('corrupt bytes are a corrupt refusal, and repair restores a healthy object', async () => {
	const fixture = await createProjectWithFinishImage();
	const cookie = await sessionCookie(app, fixture.owner);
	store.objects.set(fixture.objectKey, {
		bytes: Buffer.alloc(PNG.length),
		options: { contentType: 'image/png' }
	});
	const loaded = await loadProject(pool, fixture.owner, fixture.projectId);
	await assert.rejects(
		prepareProjectImagePins(pool, store, fixture.owner, fixture.projectId, loaded.document, 'private-load'),
		(error) => error.code === 'image-corrupt'
	);

	const repaired = await repair(cookie, fixture.projectId, fixture.ready.id, PNG, {
		expectedPin: fixture.ready.sha256,
		savedBaseToken: fixture.saved.savedBaseToken
	});
	assert.equal(repaired.statusCode, 200, repaired.body);
	await prepareProjectImagePins(pool, store, fixture.owner, fixture.projectId, loaded.document, 'private-load');
});

test('a stale base, a changed pin and a cross-owner request refuse before any staging write', async () => {
	const fixture = await createProjectWithFinishImage();
	const cookie = await sessionCookie(app, fixture.owner);
	const puts = store.puts.length;

	const stale = await repair(cookie, fixture.projectId, fixture.ready.id, PNG, {
		expectedPin: fixture.ready.sha256,
		savedBaseToken: fixture.first.savedBaseToken
	});
	assert.equal(stale.statusCode, 409, stale.body);
	assert.equal(stale.json().error.code, 'conflict');

	const changed = await repair(cookie, fixture.projectId, fixture.ready.id, PNG, {
		expectedPin: `sha256-${'0'.repeat(64)}`,
		savedBaseToken: fixture.saved.savedBaseToken
	});
	assert.equal(changed.statusCode, 409, changed.body);
	assert.equal(changed.json().error.code, 'image_pin_changed');

	const foreign = await sessionCookie(app, `google:${randomUUID()}`);
	const forbidden = await repair(foreign, fixture.projectId, fixture.ready.id, PNG, {
		expectedPin: fixture.ready.sha256,
		savedBaseToken: fixture.saved.savedBaseToken
	});
	assert.equal(forbidden.statusCode, 404, forbidden.body);
	assert.equal(store.puts.length, puts);
	assert.equal(await attemptCount(fixture.projectId), 0);
});

test('two concurrent repairs of the same image both answer, one swaps and the loser verifies the winner', async () => {
	const fixture = await createProjectWithFinishImage();
	const cookie = await sessionCookie(app, fixture.owner);
	store.objects.delete(fixture.objectKey);
	const beforePuts = store.puts.length;

	const [left, right] = await Promise.all([
		repair(cookie, fixture.projectId, fixture.ready.id, PNG, {
			expectedPin: fixture.ready.sha256,
			savedBaseToken: fixture.saved.savedBaseToken
		}),
		repair(cookie, fixture.projectId, fixture.ready.id, PNG, {
			expectedPin: fixture.ready.sha256,
			savedBaseToken: fixture.saved.savedBaseToken
		})
	]);
	assert.equal(left.statusCode, 200, left.body);
	assert.equal(right.statusCode, 200, right.body);
	assert.equal([left.json().replaced, right.json().replaced].filter(Boolean).length, 1);
	const key = await objectKeyOf(fixture.projectId, fixture.ready.id);
	assert.deepEqual(store.objects.get(key).bytes, PNG);
	// The adopted staging key is the live key; every other staged key is gone.
	const stagingKeys = store.puts
		.slice(beforePuts)
		.map((entry) => entry.key)
		.filter((candidate) => candidate.includes('/repair-'));
	assert.ok(stagingKeys.includes(key));
	assert.equal(stagingKeys.filter((candidate) => store.objects.has(candidate)).length, 1);
	assert.equal(await attemptCount(fixture.projectId), 0);
});

test('an unknown image and an unauthenticated request cannot reach repair', async () => {
	const fixture = await createProjectWithFinishImage();
	const cookie = await sessionCookie(app, fixture.owner);
	const unknown = await repair(cookie, fixture.projectId, randomUUID(), PNG, {
		expectedPin: fixture.ready.sha256,
		savedBaseToken: fixture.saved.savedBaseToken
	});
	assert.equal(unknown.statusCode, 404, unknown.body);

	const anonymous = await app.inject({
		method: 'PUT',
		url: `/projects/${fixture.projectId}/assets/${fixture.ready.id}/repair?expectedPin=${fixture.ready.sha256}&savedBase=${encodeURIComponent(fixture.saved.savedBaseToken)}`,
		headers: {
			'content-type': 'application/octet-stream',
			'content-length': String(PNG.length)
		},
		payload: Readable.from([PNG])
	});
	assert.equal(anonymous.statusCode, 401, anonymous.body);
});

test('the scoped asset access collects expired repair attempts and keeps a referenced key', async () => {
	const fixture = await createProjectWithFinishImage();
	const cookie = await sessionCookie(app, fixture.owner);
	const abandoned = `projects/test/${fixture.projectId}/assets/${fixture.ready.id}/repair-${randomUUID()}`;
	const referenced = fixture.objectKey;
	store.objects.set(abandoned, { bytes: Buffer.from('abandoned'), options: {} });
	await pool.query(
		`INSERT INTO image_repair_attempts
(id, project_id, owner_id, asset_id, expected_pin, saved_base_token, staging_key, created_at, expires_at)
VALUES ($1::uuid, $2, $3, $4::uuid, $5, $6, $7, now() - interval '2 hours', now() - interval '1 hour')`,
		[randomUUID(), fixture.projectId, fixture.owner, fixture.ready.id, fixture.ready.sha256, fixture.saved.savedBaseToken, abandoned]
	);
	await pool.query(
		`INSERT INTO image_repair_attempts
(id, project_id, owner_id, asset_id, expected_pin, saved_base_token, staging_key, created_at, expires_at)
VALUES ($1::uuid, $2, $3, $4::uuid, $5, $6, $7, now() - interval '2 hours', now() - interval '1 hour')`,
		[randomUUID(), fixture.projectId, fixture.owner, fixture.ready.id, fixture.ready.sha256, fixture.saved.savedBaseToken, referenced]
	);

	const listed = await app.inject({
		method: 'GET',
		url: `/projects/${fixture.projectId}/assets`,
		headers: { cookie }
	});
	assert.equal(listed.statusCode, 200, listed.body);
	assert.equal(store.objects.has(abandoned), false);
	assert.equal(store.objects.has(referenced), true);
	assert.equal(await attemptCount(fixture.projectId), 0);
});

test('the repair request reader requires the exact two facts and a canonical image id', async () => {
	const fixture = await createProjectWithFinishImage();
	const cookie = await sessionCookie(app, fixture.owner);
	const puts = store.puts.length;
	const missing = await app.inject({
		method: 'PUT',
		url: `/projects/${fixture.projectId}/assets/${fixture.ready.id}/repair`,
		headers: {
			cookie,
			'content-type': 'application/octet-stream',
			'content-length': String(PNG.length)
		},
		payload: Readable.from([PNG])
	});
	assert.equal(missing.statusCode, 400, missing.body);
	assert.equal(missing.json().error.code, 'invalid_repair');
	assert.equal(store.puts.length, puts);
	assert.equal(await attemptCount(fixture.projectId), 0);
});

test('a stalled object-store read while accepting a concurrent winner does not hold the project lock', async () => {
	const fixture = await createProjectWithFinishImage();
	const cookie = await sessionCookie(app, fixture.owner);
	store.objects.delete(fixture.objectKey);

	let releasePut;
	let putEntered;
	const putStarted = new Promise((resolve) => (putEntered = resolve));
	const putGate = new Promise((resolve) => (releasePut = resolve));
	let stallPut = true;
	storeOptions.onPut = async (key) => {
		if (!stallPut || !key.includes('/repair-')) return;
		stallPut = false;
		putEntered();
		await putGate;
	};

	let getEntered;
	let releaseGet;
	const getStarted = new Promise((resolve) => (getEntered = resolve));
	const getGate = new Promise((resolve) => (releaseGet = resolve));
	let stallGet = false;
	let getHeld = false;

	// This attempt reads phase 1 and its pre-check before the winner commits.
	const delayed = repair(cookie, fixture.projectId, fixture.ready.id, PNG, {
		expectedPin: fixture.ready.sha256,
		savedBaseToken: fixture.saved.savedBaseToken
	});

	try {
		await within(putStarted, 5_000, 'the delayed repair never began staging');

		// A competing repair commits a verified key while the first is streaming.
		const winner = await repair(cookie, fixture.projectId, fixture.ready.id, PNG, {
			expectedPin: fixture.ready.sha256,
			savedBaseToken: fixture.saved.savedBaseToken
		});
		assert.equal(winner.statusCode, 200, winner.body);
		assert.equal(winner.json().replaced, true);
		const winnerKey = await objectKeyOf(fixture.projectId, fixture.ready.id);
		assert.notEqual(winnerKey, fixture.objectKey);

		// The loser can only observe the winner once its stream ends, and verifying
		// those bytes is the read that must happen outside the locks.
		storeOptions.onGet = async (key) => {
			if (!stallGet || key !== winnerKey) return;
			stallGet = false;
			getHeld = true;
			getEntered();
			await getGate;
		};
		stallGet = true;
		releasePut();
		await within(getStarted, 5_000, 'the losing repair never verified the winner');

		const saveRequest = await requestFor(
			envelopeFor(fixture.projectId, 'Finish image saved', {
				textures: [textureRecord(fixture.ready.id)],
				materials: [finishMaterial(fixture.ready.id)],
				resources: [
					{
						kind: 'texture',
						id: fixture.ready.id,
						contentRevision: fixture.pin.hash,
						pin: fixture.pin,
						unresolved: null
					}
				]
			}),
			{ kind: 'expected-saved-base', token: fixture.saved.savedBaseToken }
		);
		const saved = await within(
			saveAcceptedSource(pool, fixture.owner, saveRequest, store),
			2_000,
			'a Save waited on the object-store read held by a repair transaction'
		);
		assert.ok(saved.savedBaseToken.startsWith('saved-base:'));
		assert.equal(getHeld, true, 'the winner verification must still be stalled');

		releaseGet();
		const loser = await within(delayed, 10_000, 'the delayed repair never answered');
		// The Save moved the head, so the loser re-proves its base after verifying
		// the winner and refuses rather than acknowledging a stale repair.
		assert.equal(loser.statusCode, 409, loser.body);
		assert.equal(loser.json().error.code, 'conflict');
		assert.equal(await objectKeyOf(fixture.projectId, fixture.ready.id), winnerKey);
		assert.deepEqual(store.objects.get(winnerKey).bytes, PNG);
		assert.equal(await attemptCount(fixture.projectId), 0);
	} finally {
		storeOptions.onPut = undefined;
		storeOptions.onGet = undefined;
		releasePut();
		releaseGet();
		await delayed.catch(() => {});
	}
});

test('an expired attempt cannot adopt its staging key after the sweep claims it', async () => {
	const fixture = await createProjectWithFinishImage();
	const cookie = await sessionCookie(app, fixture.owner);
	// Corruption, not a missing object: the sweep must never remove this live key.
	store.objects.set(fixture.objectKey, {
		bytes: Buffer.alloc(PNG.length),
		options: { contentType: 'image/png' }
	});

	let releasePut;
	let putEntered;
	const putStarted = new Promise((resolve) => (putEntered = resolve));
	const putGate = new Promise((resolve) => (releasePut = resolve));
	let stallPut = true;
	storeOptions.onPut = async (key) => {
		if (!stallPut || !key.includes('/repair-')) return;
		stallPut = false;
		putEntered();
		await putGate;
	};

	const delayed = repair(cookie, fixture.projectId, fixture.ready.id, PNG, {
		expectedPin: fixture.ready.sha256,
		savedBaseToken: fixture.saved.savedBaseToken
	});

	try {
		await within(putStarted, 5_000, 'the delayed repair never began staging');
		const expired = await pool.query(
			`UPDATE image_repair_attempts
SET created_at = now() - interval '2 hours', expires_at = now() - interval '1 hour'
WHERE project_id = $1 AND asset_id = $2
RETURNING staging_key AS "stagingKey"`,
			[fixture.projectId, fixture.ready.id]
		);
		assert.equal(expired.rowCount, 1, 'the delayed repair records exactly one attempt');
		const stagingKey = expired.rows[0].stagingKey;

		// The scoped asset access claims the expired attempt before any delete.
		const listed = await app.inject({
			method: 'GET',
			url: `/projects/${fixture.projectId}/assets`,
			headers: { cookie }
		});
		assert.equal(listed.statusCode, 200, listed.body);
		assert.equal(await attemptCount(fixture.projectId), 0, 'the sweep claims the expired attempt');

		// The claim is committed while the stream is still held; the delayed commit
		// must refuse instead of adopting the claimed key.
		releasePut();
		const refused = await within(delayed, 10_000, 'the delayed repair never answered');
		assert.equal(refused.statusCode, 409, refused.body);
		assert.equal(refused.json().error.code, 'conflict');
		assert.equal(await objectKeyOf(fixture.projectId, fixture.ready.id), fixture.objectKey);
		assert.equal(store.objects.has(fixture.objectKey), true, 'the live key is never deleted');
		assert.equal(store.objects.has(stagingKey), false, 'the fenced attempt leaves no staged bytes');
		assert.equal(await attemptCount(fixture.projectId), 0);

		// Recovery stays available: the same original still repairs the image.
		const repaired = await repair(cookie, fixture.projectId, fixture.ready.id, PNG, {
			expectedPin: fixture.ready.sha256,
			savedBaseToken: fixture.saved.savedBaseToken
		});
		assert.equal(repaired.statusCode, 200, repaired.body);
		assert.equal(repaired.json().replaced, true);
		const loaded = await loadProject(pool, fixture.owner, fixture.projectId);
		await prepareProjectImagePins(pool, store, fixture.owner, fixture.projectId, loaded.document, 'private-load');
	} finally {
		storeOptions.onPut = undefined;
		releasePut();
		await delayed.catch(() => {});
	}
});
