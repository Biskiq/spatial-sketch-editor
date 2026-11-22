/**
 * T2.S8 G — owner-private material library and cross-project transfer.
 *
 * Real Postgres and the real object-store contract (an in-memory S3 double).
 * The test proves the parts a mock cannot: owner predicates, staging cleanup,
 * receipt replay under the destination lock, independent destination assets,
 * quota, and that removing the item or the source project never removes bytes a
 * destination already vendored.
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { deflateSync } from 'node:zlib';
import { Pool } from 'pg';
import test, { after, before } from 'node:test';

import {
	FORM_LIBRARY_MAX_ITEMS,
	canonicalMaterialLibraryPayload,
	materialLibraryContentId
} from '@portfolio/project-model/library';
import { readRecipe, SHIPPED_MATERIAL_IMAGES } from '@portfolio/project-model/materials';

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
let assetStore;
const owners = new Set();
const projects = new Set();

function crc32(bytes) {
	let crc = 0xffffffff;
	for (const value of bytes) {
		crc ^= value;
		for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
	}
	return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
	const name = Buffer.from(type, 'ascii');
	const length = Buffer.alloc(4);
	length.writeUInt32BE(data.length);
	const crc = Buffer.alloc(4);
	crc.writeUInt32BE(crc32(Buffer.concat([name, data])));
	return Buffer.concat([length, name, data, crc]);
}

/** A valid RGBA PNG of the given square edge size. */
function pngBytes(red = 180, green = 140, blue = 90, size = 2) {
	const header = Buffer.alloc(13);
	header.writeUInt32BE(size, 0);
	header.writeUInt32BE(size, 4);
	header[8] = 8;
	header[9] = 6;
	const raw = Buffer.alloc((size * 4 + 1) * size);
	for (let y = 0; y < size; y += 1) {
		for (let x = 0; x < size; x += 1) {
			const at = y * (size * 4 + 1) + 1 + x * 4;
			raw[at] = red;
			raw[at + 1] = green;
			raw[at + 2] = blue;
			raw[at + 3] = 255;
		}
	}
	return Buffer.concat([
		Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
		chunk('IHDR', header),
		chunk('IDAT', deflateSync(raw)),
		chunk('IEND', Buffer.alloc(0))
	]);
}

async function newOwner(label) {
	const id = `google:s8g-${label}-${randomUUID()}`;
	await pool.query('INSERT INTO users (id) VALUES ($1) ON CONFLICT DO NOTHING', [id]);
	owners.add(id);
	return { id, cookie: await sessionCookie(app, id) };
}

async function newProject(cookie, label) {
	const id = `s8g${label}${Date.now().toString(36)}${randomUUID().slice(0, 8)}`;
	projects.add(id);
	const request = await saveRequestBody(projectDocument(`S8 G ${label}`, { id }));
	const response = await app.inject({
		method: 'PUT',
		url: `/projects/${id}`,
		headers: { cookie, 'content-type': 'application/json' },
		payload: request
	});
	assert.equal(response.statusCode, 200, response.body);
	return { id, savedBaseToken: response.json().savedBaseToken };
}

async function uploadAsset(cookie, projectId, bytes, name = 'map.png') {
	const registered = await app.inject({
		method: 'POST',
		url: `/projects/${projectId}/assets`,
		headers: { cookie, 'content-type': 'application/json' },
		payload: { name }
	});
	assert.equal(registered.statusCode, 201, registered.body);
	const assetId = registered.json().id;
	const uploaded = await app.inject({
		method: 'PUT',
		url: `/projects/${projectId}/assets/${assetId}/content`,
		headers: {
			cookie,
			'content-type': 'application/octet-stream',
			'content-length': String(bytes.length)
		},
		payload: bytes
	});
	assert.equal(uploaded.statusCode, 200, uploaded.body);
	return uploaded.json();
}

function recipeFor(hashes) {
	const [color, normal, orm] = hashes;
	const read = readRecipe({
		profile: 'pbr-metallic-roughness/v1',
		color: '#c8a078',
		roughness: 0.55,
		metalness: 0.1,
		occlusionStrength: 0.9,
		normalScale: 1,
		mapping: { kind: 'uv', set: 0, repeat: [1, 1], rotation: 0, offset: [0, 0] },
		maps: {
			color: { image: color },
			normal: { image: normal, convention: '-Y' },
			roughness: { image: orm, component: 'g', invert: false },
			metalness: { image: orm, component: 'b', invert: false },
			occlusion: { image: orm, component: 'r', invert: false }
		}
	});
	assert.equal(read.success, true, JSON.stringify(read.issues));
	return read.recipe;
}

function materialPayload(hashes, name = 'Brushed oak') {
	return canonicalMaterialLibraryPayload({
		formatVersion: 1,
		kind: 'material',
		name,
		recipe: recipeFor(hashes)
	});
}

async function sourceWithImages(label) {
	const owner = await newOwner(label);
	const project = await newProject(owner.cookie, label);
	const color = await uploadAsset(owner.cookie, project.id, pngBytes(180, 140, 90), 'colour.png');
	const normal = await uploadAsset(owner.cookie, project.id, pngBytes(128, 128, 255), 'normal.png');
	const orm = await uploadAsset(owner.cookie, project.id, pngBytes(235, 84, 250), 'orm.png');
	return { owner, project, images: [color, normal, orm] };
}

function saveBody(payload, assets, projectId, operationId) {
	return {
		contentId: null,
		operationId,
		sourceProjectId: projectId,
		payload,
		images: assets.map((asset) => ({ hash: asset.sha256, source: { textureId: asset.id } }))
	};
}

async function saveMaterial(cookie, payload, assets, projectId, operationId = randomUUID()) {
	const body = saveBody(payload, assets, projectId, operationId);
	body.contentId = await materialLibraryContentId(payload);
	const response = await app.inject({
		method: 'POST',
		url: '/library/items',
		headers: { cookie, 'content-type': 'application/json' },
		payload: body
	});
	return { response, body };
}

async function transfer(cookie, itemId, destinationProjectId, contentId, operationId = randomUUID()) {
	return app.inject({
		method: 'POST',
		url: `/library/items/${itemId}/transfers`,
		headers: { cookie, 'content-type': 'application/json' },
		payload: { destinationProjectId, contentId, operationId }
	});
}

before(async () => {
	pool = new Pool({ connectionString: DATABASE_URL, connectionTimeoutMillis: 3000 });
	await pool.query('SELECT 1');
	await runMigrations(pool);
	assetStore = memoryObjectStore();
	app = createApp({
		pool,
		sessionKey: SESSION_KEY,
		logger: false,
		objectStore: assetStore,
		objectNamespace: 'material-test'
	});
	await app.ready();
});

after(async () => {
	for (const owner of owners) {
		await pool.query('DELETE FROM library_receipts WHERE owner_id = $1', [owner]);
		await pool.query('DELETE FROM library_staging WHERE owner_id = $1', [owner]);
		await pool.query('DELETE FROM form_library_items WHERE owner_id = $1', [owner]);
	}
	for (const project of projects) {
		await pool.query('DELETE FROM assets WHERE project_id = $1', [project]);
		await pool.query('DELETE FROM project_versions WHERE project_id = $1', [project]);
		await pool.query('DELETE FROM projects WHERE id = $1', [project]);
	}
	for (const owner of owners) await pool.query('DELETE FROM users WHERE id = $1', [owner]);
	if (app) await app.close();
	else if (pool) await pool.end();
});

test('material Save is private, canonical and leaves the form-only list untouched', async () => {
	const source = await sourceWithImages('save');
	const payload = materialPayload(source.images.map((asset) => asset.sha256));
	const { response } = await saveMaterial(source.owner.cookie, payload, source.images, source.project.id, 'save-one');
	assert.equal(response.statusCode, 201, response.body);
	const summary = response.json();
	assert.equal(summary.kind, 'material');
	assert.equal(summary.name, 'Brushed oak');
	assert.equal(summary.formatVersion, 1);
	assert.equal(summary.imageCount, 3);
	assert.equal(summary.hasThumbnail, false);
	assert.match(summary.recipeHash, /^sha256-[0-9a-f]{64}$/);
	assert.equal(summary.contentId, await materialLibraryContentId(payload));

	const forms = await app.inject({ method: 'GET', url: '/library/items', headers: { cookie: source.owner.cookie } });
	assert.equal(forms.statusCode, 200);
	assert.deepEqual(forms.json().items, []);
	const materials = await app.inject({ method: 'GET', url: '/library/items?kind=material', headers: { cookie: source.owner.cookie } });
	assert.equal(materials.statusCode, 200);
	assert.equal(materials.json().items.length, 1);
	const all = await app.inject({ method: 'GET', url: '/library/items?kind=all', headers: { cookie: source.owner.cookie } });
	assert.equal(all.json().items[0].kind, 'material');

	const read = await app.inject({ method: 'GET', url: `/library/items/${summary.id}`, headers: { cookie: source.owner.cookie } });
	assert.equal(read.statusCode, 200);
	assert.equal(read.headers['x-library-kind'], 'material');
	assert.equal(read.headers.etag, `"${summary.contentId}"`);
	assert.equal(read.headers['cache-control'], 'private, no-store');
	assert.deepEqual(read.json(), payload);

	const other = await newOwner('other-reader');
	for (const request of [
		{ method: 'GET', url: `/library/items/${summary.id}` },
		{ method: 'DELETE', url: `/library/items/${summary.id}` },
		{ method: 'GET', url: `/library/items/${summary.id}/thumbnail` }
	]) {
		const denied = await app.inject({ ...request, headers: { cookie: other.cookie } });
		assert.equal(denied.statusCode, 404, request.url);
	}
	const deniedTransfer = await transfer(other.cookie, summary.id, source.project.id, summary.contentId);
	assert.equal(deniedTransfer.statusCode, 404);
});

test('thumbnail upload is pinned, private and removable', async () => {
	const source = await sourceWithImages('thumb');
	const payload = materialPayload(source.images.map((asset) => asset.sha256));
	const saved = await saveMaterial(source.owner.cookie, payload, source.images, source.project.id);
	assert.equal(saved.response.statusCode, 201, saved.response.body);
	const item = saved.response.json();
	const missing = await app.inject({ method: 'GET', url: `/library/items/${item.id}/thumbnail`, headers: { cookie: source.owner.cookie } });
	assert.equal(missing.statusCode, 404);

	const stale = await app.inject({
		method: 'PUT',
		url: `/library/items/${item.id}/thumbnail?expectedContentId=${item.contentId}&recipeKey=sha256-${'0'.repeat(64)}`,
		headers: { cookie: source.owner.cookie, 'content-type': 'application/octet-stream' },
		payload: pngBytes()
	});
	assert.equal(stale.statusCode, 409, stale.body);

	const bytes = pngBytes();
	const uploaded = await app.inject({
		method: 'PUT',
		url: `/library/items/${item.id}/thumbnail?expectedContentId=${item.contentId}&recipeKey=${item.recipeHash}`,
		headers: { cookie: source.owner.cookie, 'content-type': 'application/octet-stream' },
		payload: bytes
	});
	assert.equal(uploaded.statusCode, 204, uploaded.body);
	const read = await app.inject({ method: 'GET', url: `/library/items/${item.id}/thumbnail`, headers: { cookie: source.owner.cookie } });
	assert.equal(read.statusCode, 200);
	assert.equal(read.headers['content-type'], 'image/png');
	assert.equal(read.headers['cache-control'], 'private, no-store');
	assert.deepEqual(read.rawPayload, bytes);
	const listed = await app.inject({ method: 'GET', url: '/library/items?kind=material', headers: { cookie: source.owner.cookie } });
	assert.equal(listed.json().items[0].hasThumbnail, true);

	const removed = await app.inject({ method: 'DELETE', url: `/library/items/${item.id}`, headers: { cookie: source.owner.cookie } });
	assert.equal(removed.statusCode, 204);
	const gone = await app.inject({ method: 'GET', url: `/library/items/${item.id}/thumbnail`, headers: { cookie: source.owner.cookie } });
	assert.equal(gone.statusCode, 404);
});

test('Insert vendors exact bytes, replays a lost response and refuses a changed body or revision', async () => {
	const source = await sourceWithImages('insert');
	const destination = await newProject(source.owner.cookie, 'destination');
	const payload = materialPayload(source.images.map((asset) => asset.sha256), 'Walnut');
	const saved = await saveMaterial(source.owner.cookie, payload, source.images, source.project.id, 'insert-save');
	assert.equal(saved.response.statusCode, 201, saved.response.body);
	const item = saved.response.json();

	const operationId = 'insert-op-1';
	const first = await transfer(source.owner.cookie, item.id, destination.id, item.contentId, operationId);
	assert.equal(first.statusCode, 200, first.body);
	const inserted = first.json();
	assert.equal(inserted.itemId, item.id);
	assert.equal(inserted.contentId, item.contentId);
	assert.equal(inserted.finishId, `finish-${operationId}`);
	assert.equal(inserted.name, 'Walnut');
	assert.equal(inserted.recipeHash, item.recipeHash);
	assert.equal(inserted.images.length, 3);
	assert.equal(inserted.images.filter((image) => 'textureId' in image.source).length, 3);
	const destinationBytes = new Map();
	for (const image of inserted.images) {
		const response = await app.inject({
			method: 'GET',
			url: `/projects/${destination.id}/assets/${image.source.textureId}/content`,
			headers: { cookie: source.owner.cookie }
		});
		assert.equal(response.statusCode, 200, response.body);
		destinationBytes.set(image.hash, response.rawPayload);
	}
	for (const asset of source.images) assert.equal(destinationBytes.has(asset.sha256), true);

	const replay = await transfer(source.owner.cookie, item.id, destination.id, item.contentId, operationId);
	assert.equal(replay.statusCode, 200, replay.body);
	assert.deepEqual(replay.json(), inserted);

	const conflict = await transfer(source.owner.cookie, item.id, source.project.id, item.contentId, operationId);
	assert.equal(conflict.statusCode, 409);
	assert.equal(conflict.json().error.code, 'operation_conflict');

	const savedAgain = await app.inject({
		method: 'PUT',
		url: `/projects/${destination.id}`,
		headers: { cookie: source.owner.cookie, 'content-type': 'application/json' },
		payload: await saveRequestBody(projectDocument('S8 G destination again', { id: destination.id }), {
			precondition: { kind: 'expected-saved-base', token: destination.savedBaseToken }
		})
	});
	assert.equal(savedAgain.statusCode, 200, savedAgain.body);
	const stale = await transfer(source.owner.cookie, item.id, destination.id, item.contentId, operationId);
	assert.equal(stale.statusCode, 409);
	assert.equal(stale.json().error.code, 'stale_revision');

	// The destination is independent: removing the item and then the source
	// project leaves its asset rows and bytes intact.
	const removed = await app.inject({ method: 'DELETE', url: `/library/items/${item.id}`, headers: { cookie: source.owner.cookie } });
	assert.equal(removed.statusCode, 204);
	const deleted = await app.inject({
		method: 'DELETE',
		url: `/projects/${source.project.id}`,
		headers: { cookie: source.owner.cookie, 'content-type': 'application/json' },
		payload: { precondition: { kind: 'expected-saved-base', token: source.project.savedBaseToken } }
	});
	assert.ok([200, 202].includes(deleted.statusCode), deleted.body);
	for (const image of inserted.images) {
		const response = await app.inject({
			method: 'GET',
			url: `/projects/${destination.id}/assets/${image.source.textureId}/content`,
			headers: { cookie: source.owner.cookie }
		});
		assert.equal(response.statusCode, 200, response.body);
	}
});

test('two insert operations allocate independent Finish ids while sharing destination bytes', async () => {
	const source = await sourceWithImages('double');
	const destination = await newProject(source.owner.cookie, 'double-destination');
	const payload = materialPayload(source.images.map((asset) => asset.sha256));
	const saved = await saveMaterial(source.owner.cookie, payload, source.images, source.project.id);
	const item = saved.response.json();
	const [left, right] = await Promise.all([
		transfer(source.owner.cookie, item.id, destination.id, item.contentId, 'insert-left'),
		transfer(source.owner.cookie, item.id, destination.id, item.contentId, 'insert-right')
	]);
	assert.equal(left.statusCode, 200, left.body);
	assert.equal(right.statusCode, 200, right.body);
	const first = left.json();
	const second = right.json();
	assert.equal(first.finishId, 'finish-insert-left');
	assert.equal(second.finishId, 'finish-insert-right');
	assert.notEqual(first.finishId, second.finishId);
	assert.deepEqual(
		first.images.map((image) => image.source.textureId).sort(),
		second.images.map((image) => image.source.textureId).sort()
	);
	const rows = await pool.query(
		`SELECT count(*)::int AS count FROM assets WHERE project_id = $1 AND source_kind = 'upload'`,
		[destination.id]
	);
	assert.equal(rows.rows[0].count, 3);
});

test('missing derivative, unsupported format, removal during copy and upload failure are honest refusals', async () => {
	const source = await sourceWithImages('refusals');
	const destination = await newProject(source.owner.cookie, 'refusal-destination');
	const payload = materialPayload(source.images.map((asset) => asset.sha256));
	const saved = await saveMaterial(source.owner.cookie, payload, source.images, source.project.id);
	const item = saved.response.json();

	await pool.query('UPDATE form_library_items SET format_version = 2 WHERE id = $1::uuid', [item.id]);
	const unsupported = await transfer(source.owner.cookie, item.id, destination.id, item.contentId);
	assert.equal(unsupported.statusCode, 409);
	assert.equal(unsupported.json().error.code, 'unsupported_format_version');
	await pool.query('UPDATE form_library_items SET format_version = 1 WHERE id = $1::uuid', [item.id]);

	let removed = false;
	const removalStore = {
		...assetStore,
		async get(key) {
			if (!removed && key.startsWith('library/')) {
				removed = true;
				await pool.query('DELETE FROM form_library_items WHERE id = $1::uuid', [item.id]);
			}
			return assetStore.get(key);
		}
	};
	const removalApp = createApp({
		pool,
		sessionKey: SESSION_KEY,
		logger: false,
		objectStore: removalStore,
		objectNamespace: 'material-removal-test'
	});
	const removedDuringCopy = await removalApp.inject({
		method: 'POST',
		url: `/library/items/${item.id}/transfers`,
		headers: { cookie: source.owner.cookie, 'content-type': 'application/json' },
		payload: { destinationProjectId: destination.id, contentId: item.contentId, operationId: 'removal-copy' }
	});
	assert.equal(removedDuringCopy.statusCode, 404);

	const failureStore = {
		...assetStore,
		async put() {
			throw new Error('injected R2 failure');
		}
	};
	const failureApp = createApp({
		pool,
		sessionKey: SESSION_KEY,
		logger: false,
		objectStore: failureStore,
		objectNamespace: 'material-failure-test'
	});
	const failurePayload = materialPayload(source.images.map((asset) => asset.sha256), 'Never stored');
	const body = saveBody(failurePayload, source.images, source.project.id, 'upload-failure');
	body.contentId = await materialLibraryContentId(failurePayload);
	const failed = await failureApp.inject({
		method: 'POST',
		url: '/library/items',
		headers: { cookie: source.owner.cookie, 'content-type': 'application/json' },
		payload: body
	});
	assert.equal(failed.statusCode, 422, failed.body);
	const notStored = await pool.query(
		'SELECT count(*)::int AS count FROM form_library_items WHERE owner_id = $1 AND name = $2',
		[source.owner.id, 'Never stored']
	);
	assert.equal(notStored.rows[0].count, 0);
});

test('a missing private dependency refuses transfer before any destination row', async () => {
	const source = await sourceWithImages('missing');
	const destination = await newProject(source.owner.cookie, 'missing-destination');
	const payload = materialPayload(source.images.map((asset) => asset.sha256));
	const saved = await saveMaterial(source.owner.cookie, payload, source.images, source.project.id);
	const item = saved.response.json();
	const row = await pool.query(
		`SELECT object_key AS "objectKey" FROM material_library_images
		 WHERE item_id = $1::uuid AND object_key IS NOT NULL ORDER BY hash ASC LIMIT 1`,
		[item.id]
	);
	const key = row.rows[0].objectKey;
	const stored = assetStore.objects.get(key);
	assert.ok(stored, 'the saved item has a private copy');
	assetStore.objects.delete(key);
	try {
		const denied = await transfer(source.owner.cookie, item.id, destination.id, item.contentId, 'missing-dependency');
		assert.equal(denied.statusCode, 422, denied.body);
		assert.equal(denied.json().error.code, 'image_unavailable');
		const assets = await pool.query('SELECT count(*)::int AS count FROM assets WHERE project_id = $1', [destination.id]);
		assert.equal(assets.rows[0].count, 0);
	} finally {
		assetStore.objects.set(key, stored);
	}
});

test('a full library refuses material Save in words and stores no row', async () => {
	const source = await sourceWithImages('full');
	await pool.query(
		`INSERT INTO form_library_items
			(id, owner_id, kind, name, format_version, content_id, canonical_bytes, recipe_hash)
		 SELECT gen_random_uuid(), $1, 'material', 'Bulk ' || value, 1,
			'sha256-' || repeat('b', 64), convert_to('{}', 'UTF8'),
			'sha256-' || repeat('c', 64)
		 FROM generate_series(1, $2) AS value`,
		[source.owner.id, FORM_LIBRARY_MAX_ITEMS]
	);
	const payload = materialPayload(source.images.map((asset) => asset.sha256), 'One too many');
	const saved = await saveMaterial(source.owner.cookie, payload, source.images, source.project.id);
	assert.equal(saved.response.statusCode, 409);
	assert.equal(saved.response.json().error.code, 'library_full');
	assert.match(saved.response.json().error.message, /Remove an item/i);
});

test('save receipt replays idempotently, conflicts on changed body and never resurrects a removed item', async () => {
	const source = await sourceWithImages('save-receipt');
	const payload = materialPayload(source.images.map((asset) => asset.sha256), 'Cedar');
	const operationId = 'save-receipt-op';

	const first = await saveMaterial(source.owner.cookie, payload, source.images, source.project.id, operationId);
	assert.equal(first.response.statusCode, 201, first.response.body);
	const summary = first.response.json();

	const replay = await saveMaterial(source.owner.cookie, payload, source.images, source.project.id, operationId);
	assert.equal(replay.response.statusCode, 201, replay.response.body);
	assert.deepEqual(replay.response.json(), summary);

	const changedPayload = materialPayload(source.images.map((asset) => asset.sha256), 'Cedar Renamed');
	const conflict = await saveMaterial(source.owner.cookie, changedPayload, source.images, source.project.id, operationId);
	assert.equal(conflict.response.statusCode, 409, conflict.response.body);
	assert.equal(conflict.response.json().error.code, 'operation_conflict');

	const removed = await app.inject({
		method: 'DELETE',
		url: `/library/items/${summary.id}`,
		headers: { cookie: source.owner.cookie }
	});
	assert.equal(removed.statusCode, 204);

	const afterDelete = await saveMaterial(source.owner.cookie, payload, source.images, source.project.id, operationId);
	assert.equal(afterDelete.response.statusCode, 404, afterDelete.response.body);

	const list = await app.inject({
		method: 'GET',
		url: '/library/items?kind=material',
		headers: { cookie: source.owner.cookie }
	});
	assert.equal(list.statusCode, 200);
	assert.equal(list.json().items.length, 0);
});

test('shipped-image material Save, Transfer and Remove store zero asset rows and preserve shipped sources', async () => {
	const owner = await newOwner('shipped');
	const sourceProject = await newProject(owner.cookie, 'shipped-source');
	const destinationProject = await newProject(owner.cookie, 'shipped-dest');
	const shipped = SHIPPED_MATERIAL_IMAGES.slice(0, 3);
	const payload = materialPayload(shipped.map((image) => image.hash), 'Shipped Plaster');
	const body = {
		contentId: await materialLibraryContentId(payload),
		operationId: 'shipped-save-op',
		sourceProjectId: sourceProject.id,
		payload,
		images: shipped.map((image) => ({ hash: image.hash, source: { shipped: image.uri } }))
	};

	const saved = await app.inject({
		method: 'POST',
		url: '/library/items',
		headers: { cookie: owner.cookie, 'content-type': 'application/json' },
		payload: body
	});
	assert.equal(saved.statusCode, 201, saved.body);
	const item = saved.json();
	assert.equal(item.imageCount, 3);

	const transferred = await transfer(owner.cookie, item.id, destinationProject.id, item.contentId, 'shipped-transfer-op');
	assert.equal(transferred.statusCode, 200, transferred.body);
	const result = transferred.json();
	assert.equal(result.images.length, 3);
	assert.ok(result.images.every((image) => 'shipped' in image.source && !('textureId' in image.source)));

	const destAssets = await pool.query('SELECT count(*)::int AS count FROM assets WHERE project_id = $1', [destinationProject.id]);
	assert.equal(destAssets.rows[0].count, 0);

	const removed = await app.inject({
		method: 'DELETE',
		url: `/library/items/${item.id}`,
		headers: { cookie: owner.cookie }
	});
	assert.equal(removed.statusCode, 204);
	const gone = await app.inject({
		method: 'GET',
		url: `/library/items/${item.id}`,
		headers: { cookie: owner.cookie }
	});
	assert.equal(gone.statusCode, 404);
});

test('thumbnail upload enforces PNG format, 256x256 edge cap, 256 KiB cap and owner isolation', async () => {
	const source = await sourceWithImages('thumb-validation');
	const other = await newOwner('thumb-other');
	const payload = materialPayload(source.images.map((asset) => asset.sha256));
	const saved = await saveMaterial(source.owner.cookie, payload, source.images, source.project.id);
	assert.equal(saved.response.statusCode, 201, saved.response.body);
	const item = saved.response.json();
	const url = `/library/items/${item.id}/thumbnail?expectedContentId=${item.contentId}&recipeKey=${item.recipeHash}`;

	const jpeg = await app.inject({
		method: 'PUT',
		url,
		headers: { cookie: source.owner.cookie, 'content-type': 'application/octet-stream' },
		payload: Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10])
	});
	assert.equal(jpeg.statusCode, 415, jpeg.body);

	const corrupt = await app.inject({
		method: 'PUT',
		url,
		headers: { cookie: source.owner.cookie, 'content-type': 'application/octet-stream' },
		payload: Buffer.from('not-a-valid-png')
	});
	assert.equal(corrupt.statusCode, 415, corrupt.body);

	const oversizedEdge = await app.inject({
		method: 'PUT',
		url,
		headers: { cookie: source.owner.cookie, 'content-type': 'application/octet-stream' },
		payload: pngBytes(100, 100, 100, 257)
	});
	assert.equal(oversizedEdge.statusCode, 415, oversizedEdge.body);

	// The 256 px sample-tile master and a pre-U1 192 px thumbnail are both valid.
	for (const edge of [256, 192]) {
		const accepted = await app.inject({
			method: 'PUT',
			url,
			headers: { cookie: source.owner.cookie, 'content-type': 'application/octet-stream' },
			payload: pngBytes(100, 100, 100, edge)
		});
		assert.equal(accepted.statusCode, 204, `${edge}: ${accepted.body}`);
	}

	const tooLarge = await app.inject({
		method: 'PUT',
		url,
		headers: { cookie: source.owner.cookie, 'content-type': 'application/octet-stream' },
		payload: Buffer.alloc(256 * 1024 + 1, 0)
	});
	assert.equal(tooLarge.statusCode, 413, tooLarge.body);

	const wrongOwner = await app.inject({
		method: 'PUT',
		url,
		headers: { cookie: other.cookie, 'content-type': 'application/octet-stream' },
		payload: pngBytes()
	});
	assert.equal(wrongOwner.statusCode, 404, wrongOwner.body);
});

test('abandoned staging expiry deletes unreferenced objects, keeps committed objects and fences late commits', async () => {
	const source = await sourceWithImages('staging-expiry');
	const payload = materialPayload(source.images.map((asset) => asset.sha256), 'Oak');
	const saved = await saveMaterial(source.owner.cookie, payload, source.images, source.project.id);
	assert.equal(saved.response.statusCode, 201, saved.response.body);
	const item = saved.response.json();

	const committedRow = await pool.query(
		`SELECT object_key AS "objectKey" FROM material_library_images
		 WHERE item_id = $1::uuid AND object_key IS NOT NULL ORDER BY hash ASC LIMIT 1`,
		[item.id]
	);
	const committedKey = committedRow.rows[0].objectKey;
	const orphanKey = `library/material-test/${encodeURIComponent(source.owner.id)}/orphan-${randomUUID()}`;
	assetStore.objects.set(orphanKey, { body: Buffer.from('orphan'), contentType: 'image/png' });

	await pool.query(
		`INSERT INTO library_staging (id, owner_id, object_key, created_at, expires_at)
		 VALUES ($1::uuid, $2, $3, now() - interval '25 hours', now() - interval '1 hour'),
		        ($4::uuid, $2, $5, now() - interval '25 hours', now() - interval '1 hour')`,
		[randomUUID(), source.owner.id, orphanKey, randomUUID(), committedKey]
	);

	const listed = await app.inject({
		method: 'GET',
		url: '/library/items?kind=material',
		headers: { cookie: source.owner.cookie }
	});
	assert.equal(listed.statusCode, 200);
	assert.equal(assetStore.objects.has(orphanKey), false);
	assert.equal(assetStore.objects.has(committedKey), true);
	const remainingStaging = await pool.query(
		'SELECT count(*)::int AS count FROM library_staging WHERE owner_id = $1',
		[source.owner.id]
	);
	assert.equal(remainingStaging.rows[0].count, 0);

	// Fence: if staging rows are claimed/deleted before commit, save refuses with 409 stale_revision.
	const fencedStore = {
		...assetStore,
		async put(key, body, options) {
			await assetStore.put(key, body, options);
			await pool.query('DELETE FROM library_staging WHERE owner_id = $1 AND object_key = $2', [source.owner.id, key]);
		}
	};
	const fencedApp = createApp({
		pool,
		sessionKey: SESSION_KEY,
		logger: false,
		objectStore: fencedStore,
		objectNamespace: 'material-fence-test'
	});
	await fencedApp.ready();
	const fencedPayload = materialPayload(source.images.map((asset) => asset.sha256), 'Fenced Oak');
	const fencedBody = saveBody(fencedPayload, source.images, source.project.id, 'fenced-save-op');
	fencedBody.contentId = await materialLibraryContentId(fencedPayload);
	const fenced = await fencedApp.inject({
		method: 'POST',
		url: '/library/items',
		headers: { cookie: source.owner.cookie, 'content-type': 'application/json' },
		payload: fencedBody
	});
	assert.equal(fenced.statusCode, 409, fenced.body);
	assert.equal(fenced.json().error.code, 'stale_revision');
	const notCommitted = await pool.query(
		'SELECT count(*)::int AS count FROM form_library_items WHERE owner_id = $1 AND name = $2',
		[source.owner.id, 'Fenced Oak']
	);
	assert.equal(notCommitted.rows[0].count, 0);
});

test('transfer write lease fences deleteProject with 409 project-busy while in flight', async () => {
	const source = await sourceWithImages('lease-fence');
	const destination = await newProject(source.owner.cookie, 'lease-dest');
	const payload = materialPayload(source.images.map((asset) => asset.sha256), 'Leased Maple');
	const saved = await saveMaterial(source.owner.cookie, payload, source.images, source.project.id);
	assert.equal(saved.response.statusCode, 201, saved.response.body);
	const item = saved.response.json();

	let enteredPut;
	const putEntered = new Promise((resolve) => {
		enteredPut = resolve;
	});
	let releasePut;
	const putGate = new Promise((resolve) => {
		releasePut = resolve;
	});
	let pausedOnce = false;
	const leasedStore = {
		...assetStore,
		async put(key, body, options) {
			if (!pausedOnce && key.startsWith(`projects/material-lease-test/${destination.id}/`)) {
				pausedOnce = true;
				enteredPut();
				await putGate;
			}
			return assetStore.put(key, body, options);
		}
	};
	const leasedApp = createApp({
		pool,
		sessionKey: SESSION_KEY,
		logger: false,
		objectStore: leasedStore,
		objectNamespace: 'material-lease-test'
	});
	await leasedApp.ready();
	try {
		const inFlightTransfer = leasedApp.inject({
			method: 'POST',
			url: `/library/items/${item.id}/transfers`,
			headers: { cookie: source.owner.cookie, 'content-type': 'application/json' },
			payload: {
				destinationProjectId: destination.id,
				contentId: item.contentId,
				operationId: 'leased-transfer-op'
			}
		});
		await putEntered;

		const deleteAttempt = await leasedApp.inject({
			method: 'DELETE',
			url: `/projects/${destination.id}`,
			headers: { cookie: source.owner.cookie, 'content-type': 'application/json' },
			payload: { precondition: { kind: 'expected-saved-base', token: destination.savedBaseToken } }
		});
		assert.equal(deleteAttempt.statusCode, 409, deleteAttempt.body);
		assert.equal(deleteAttempt.json().error.code, 'project-busy');

		releasePut();
		const completed = await inFlightTransfer;
		assert.equal(completed.statusCode, 200, completed.body);
	} finally {
		releasePut?.();
	}
});
