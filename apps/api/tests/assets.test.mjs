/**
 * API contract: project-asset registration, streaming upload, byte reads,
 * storage failures and concurrent upload races. Split out of `api.test.mjs` by
 * WP3T.
 *
 * The pool and object store are in-memory doubles with injected failure modes,
 * so every failure branch is deterministic and no Postgres or R2 is required.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { Readable } from 'node:stream';
import test from 'node:test';

import { createApp } from '../dist/app.js';

import { assetMemoryPool, memoryObjectStore, SESSION_COOKIE, SESSION_KEY, sessionCookie } from './test-support.mjs';

test('asset routes authenticate before parsing or touching storage', async () => {
	const pool = assetMemoryPool();
	const store = memoryObjectStore();
	const app = createApp({ pool, objectStore: store, objectNamespace: 'test', sessionKey: SESSION_KEY, logger: false });
	try {
		const headers = {
			'content-type': 'application/octet-stream',
			'content-length': '8'
		};
		const missing = await app.inject({
			method: 'PUT',
			url: '/projects/project:test/assets/00000000-0000-4000-8000-000000000001/content',
			headers,
			payload: Buffer.from('ignored')
		});
		const invalid = await app.inject({
			method: 'POST',
			url: '/projects/project:test/assets',
			headers: { cookie: `${SESSION_COOKIE}=invalid` },
			payload: '{"name":"ignored"}'
		});
		assert.equal(missing.statusCode, 401);
		assert.equal(invalid.statusCode, 401);
		assert.equal(pool.calls.length, 0);
		assert.equal(store.puts.length, 0);
	} finally {
		await app.close();
	}
});

test('owned asset registration, streaming upload, metadata, bytes, and isolation work', async () => {
	const pool = assetMemoryPool();
	const store = memoryObjectStore();
	const app = createApp({ pool, objectStore: store, objectNamespace: 'test', sessionKey: SESSION_KEY, logger: false });
	try {
		const owner = await sessionCookie(app, 'google:user-1');
		const other = await sessionCookie(app, 'google:user-2');
		const registered = await app.inject({
			method: 'POST',
			url: '/projects/project:test/assets',
			headers: { cookie: owner },
			payload: { name: 'Cafe\u0301.png' }
		});
		assert.equal(registered.statusCode, 201);
		const pending = registered.json();
		assert.equal(pending.name, 'Café.png');
		assert.equal(pending.importState, 'pending');
		assert.equal('objectKey' in pending, false);
		assert.match(pending.id, /^[0-9a-f-]{36}$/);

		const assetId = pending.id;
		const pendingBytes = await app.inject({
			method: 'GET',
			url: `/projects/project:test/assets/${assetId}/content`,
			headers: { cookie: owner }
		});
		assert.equal(pendingBytes.statusCode, 409);
		assert.equal(store.gets.length, 0);

		const bytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);
		const uploaded = await app.inject({
			method: 'PUT',
			url: `/projects/project:test/assets/${assetId}/content`,
			headers: {
				cookie: owner,
				'content-type': 'application/octet-stream',
				'content-length': String(bytes.length)
			},
			payload: Readable.from([bytes.subarray(0, 3), bytes.subarray(3, 8), bytes.subarray(8)])
		});
		assert.equal(uploaded.statusCode, 200);
		const ready = uploaded.json();
		assert.equal(ready.importState, 'ready');
		assert.equal(ready.mime, 'image/png');
		assert.equal(ready.byteSize, bytes.length);
		assert.match(ready.sha256, /^sha256-[0-9a-f]{64}$/);
		assert.equal('objectKey' in ready, false);
		assert.equal(store.puts.length, 1);
		assert.match(store.puts[0].key, new RegExp(`^projects/test/project:test/assets/${assetId}/[0-9a-f]{32}$`));
		assert.deepEqual(store.puts[0].bytes, bytes);

		const listed = await app.inject({ method: 'GET', url: '/projects/project:test/assets', headers: { cookie: owner } });
		const read = await app.inject({ method: 'GET', url: `/projects/project:test/assets/${assetId}`, headers: { cookie: owner } });
		assert.equal(listed.statusCode, 200);
		assert.equal(listed.json().assets[0].id, assetId);
		assert.deepEqual(read.json(), ready);

		const fetched = await app.inject({
			method: 'GET',
			url: `/projects/project:test/assets/${assetId}/content`,
			headers: { cookie: owner }
		});
		assert.equal(fetched.statusCode, 200);
		assert.equal(fetched.headers['content-type'], 'image/png');
		assert.equal(fetched.headers['content-length'], String(bytes.length));
		assert.equal(fetched.headers['cache-control'], 'private, no-store');
		assert.deepEqual(fetched.rawPayload, bytes);

		for (const request of [
			{ method: 'GET', url: `/projects/project:test/assets/${assetId}` },
			{ method: 'PUT', url: `/projects/project:test/assets/${assetId}/content`, payload: bytes },
			{ method: 'GET', url: `/projects/project:test/assets/${assetId}/content` }
		]) {
			const response = await app.inject({ ...request, headers: { cookie: other, 'content-type': 'application/octet-stream', 'content-length': String(bytes.length) } });
			assert.equal(response.statusCode, 404);
		}
		assert.equal(store.gets.length, 1);
	} finally {
		await app.close();
		assert.equal(store.closes, 1);
	}
});

test('asset upload validation and storage failure never produce ready metadata', async () => {
	const pool = assetMemoryPool();
	const storeOptions = { failPut: true };
	const store = memoryObjectStore(storeOptions);
	const app = createApp({ pool, objectStore: store, objectNamespace: 'test', sessionKey: SESSION_KEY, logger: false });
	try {
		const cookie = await sessionCookie(app, 'google:user-1');
		const registered = await app.inject({
			method: 'POST',
			url: '/projects/project:test/assets',
			headers: { cookie },
			payload: { name: 'texture.png' }
		});
		const assetId = registered.json().id;
		const bytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
		const base = {
			method: 'PUT',
			url: `/projects/project:test/assets/${assetId}/content`,
			headers: { cookie, 'content-type': 'application/octet-stream' }
		};
		const missingLength = await app.inject({
			...base,
			headers: { ...base.headers, 'transfer-encoding': 'chunked' },
			payload: Readable.from([bytes])
		});
		const wrongType = await app.inject({ ...base, headers: { cookie, 'content-type': 'text/plain', 'content-length': String(bytes.length) }, payload: bytes });
		const badMagic = await app.inject({ ...base, headers: { ...base.headers, 'content-length': '4' }, payload: Buffer.from('nope') });
		const mismatchedLength = await app.inject({ ...base, headers: { ...base.headers, 'content-length': String(bytes.length + 1) }, payload: bytes });
		const oversized = await app.inject({ ...base, headers: { ...base.headers, 'content-length': String(25 * 1024 * 1024 + 1) }, payload: bytes });
		const failedStore = await app.inject({ ...base, headers: { ...base.headers, 'content-length': String(bytes.length) }, payload: bytes });
		assert.equal(missingLength.statusCode, 411);
		assert.equal(wrongType.statusCode, 415);
		assert.equal(badMagic.statusCode, 415);
		assert.equal(mismatchedLength.statusCode, 400);
		assert.equal(oversized.statusCode, 413);
		assert.equal(failedStore.statusCode, 503);
		assert.equal(pool.assets.get(assetId).importState, 'failed');
		assert.notEqual(pool.assets.get(assetId).importState, 'ready');

		storeOptions.failPut = false;
		const retried = await app.inject({ ...base, headers: { ...base.headers, 'content-length': String(bytes.length) }, payload: bytes });
		assert.equal(retried.statusCode, 200);
		assert.equal(retried.json().id, assetId);
		assert.equal(retried.json().importState, 'ready');
	} finally {
		await app.close();
	}
});

test('finalize failure leaves pending metadata and compensates the uploaded object', async () => {
	const poolOptions = { failFinalize: true };
	const pool = assetMemoryPool(poolOptions);
	const store = memoryObjectStore();
	const app = createApp({ pool, objectStore: store, objectNamespace: 'test', sessionKey: SESSION_KEY, logger: false });
	try {
		const cookie = await sessionCookie(app, 'google:user-1');
		const registered = await app.inject({
			method: 'POST',
			url: '/projects/project:test/assets',
			headers: { cookie },
			payload: { name: 'pending.png' }
		});
		const assetId = registered.json().id;
		const bytes = Buffer.from([0xff, 0xd8, 0xff, 1, 2, 3]);
		const response = await app.inject({
			method: 'PUT',
			url: `/projects/project:test/assets/${assetId}/content`,
			headers: { cookie, 'content-type': 'application/octet-stream', 'content-length': String(bytes.length) },
			payload: bytes
		});
		assert.equal(response.statusCode, 503);
		assert.equal(pool.assets.get(assetId).importState, 'pending');
		assert.equal(store.objects.size, 0);
		assert.equal(store.puts[0].bytes.equals(bytes), true);

		poolOptions.failFinalize = false;
		const retried = await app.inject({
			method: 'PUT',
			url: `/projects/project:test/assets/${assetId}/content`,
			headers: { cookie, 'content-type': 'application/octet-stream', 'content-length': String(bytes.length) },
			payload: bytes
		});
		assert.equal(retried.statusCode, 200);
		assert.equal(retried.json().id, assetId);
		assert.equal(store.objects.size, 1);
	} finally {
		await app.close();
	}
});

test('multi-chunk PNG, WebP, and JPEG uploads record exact metadata and hashes', async () => {
	const pool = assetMemoryPool();
	const store = memoryObjectStore();
	const app = createApp({ pool, objectStore: store, objectNamespace: 'test', sessionKey: SESSION_KEY, logger: false });
	try {
		const cookie = await sessionCookie(app, 'google:user-1');
		const fixtures = [
			{ name: 'split.png', mime: 'image/png', bytes: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2]) },
			{ name: 'split.webp', mime: 'image/webp', bytes: Buffer.from('RIFF1234WEBPpayload') },
			{ name: 'split.jpg', mime: 'image/jpeg', bytes: Buffer.from([0xff, 0xd8, 0xff, 3, 4, 5]) }
		];
		for (const fixture of fixtures) {
			const registered = await app.inject({
				method: 'POST',
				url: '/projects/project:test/assets',
				headers: { cookie },
				payload: { name: fixture.name }
			});
			const assetId = registered.json().id;
			const response = await app.inject({
				method: 'PUT',
				url: `/projects/project:test/assets/${assetId}/content`,
				headers: {
					cookie,
					'content-type': 'application/octet-stream',
					'content-length': String(fixture.bytes.length)
				},
				payload: Readable.from([
					fixture.bytes.subarray(0, 1),
					fixture.bytes.subarray(1, 4),
					fixture.bytes.subarray(4)
				])
			});
			const asset = response.json();
			assert.equal(response.statusCode, 200);
			assert.equal(asset.mime, fixture.mime);
			assert.equal(asset.byteSize, fixture.bytes.length);
			assert.equal(asset.sha256, `sha256-${createHash('sha256').update(fixture.bytes).digest('hex')}`);
		}
	} finally {
		await app.close();
	}
});

test('storage-less asset metadata remains readable without an object key', async () => {
	const pool = assetMemoryPool();
	const store = memoryObjectStore();
	const app = createApp({ pool, objectStore: store, objectNamespace: 'test', sessionKey: SESSION_KEY, logger: false });
	const assetId = '00000000-0000-4000-8000-000000000010';
	pool.assets.set(assetId, {
		id: assetId,
		projectId: 'project:test',
		name: 'Built-in texture',
		kind: 'texture',
		storageKind: 'none',
		sourceKind: 'builtin',
		sourceRef: 'builtin:texture',
		mime: null,
		byteSize: null,
		sha256: null,
		objectKey: null,
		importState: 'ready',
		createdAt: '2026-09-03T00:00:00.000Z',
		updatedAt: '2026-09-03T00:00:00.000Z'
	});
	try {
		const cookie = await sessionCookie(app, 'google:user-1');
		const metadata = await app.inject({
			method: 'GET',
			url: `/projects/project:test/assets/${assetId}`,
			headers: { cookie }
		});
		const content = await app.inject({
			method: 'GET',
			url: `/projects/project:test/assets/${assetId}/content`,
			headers: { cookie }
		});
		assert.equal(metadata.statusCode, 200);
		assert.equal(metadata.json().storageKind, 'none');
		assert.equal('objectKey' in metadata.json(), false);
		assert.equal(content.statusCode, 409);
		assert.equal(store.gets.length, 0);
	} finally {
		await app.close();
	}
});

test('asset byte reads fail closed for missing, mismatched, and broken objects', async () => {
	const pool = assetMemoryPool();
	const store = memoryObjectStore();
	const app = createApp({ pool, objectStore: store, objectNamespace: 'test', sessionKey: SESSION_KEY, logger: false });
	try {
		const cookie = await sessionCookie(app, 'google:user-1');
		const registered = await app.inject({
			method: 'POST',
			url: '/projects/project:test/assets',
			headers: { cookie },
			payload: { name: 'read.png' }
		});
		const assetId = registered.json().id;
		const bytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
		await app.inject({
			method: 'PUT',
			url: `/projects/project:test/assets/${assetId}/content`,
			headers: { cookie, 'content-type': 'application/octet-stream', 'content-length': String(bytes.length) },
			payload: bytes
		});
		const key = pool.assets.get(assetId).objectKey;
		const object = store.objects.get(key);
		store.objects.delete(key);
		const missing = await app.inject({ method: 'GET', url: `/projects/project:test/assets/${assetId}/content`, headers: { cookie } });
		store.objects.set(key, { ...object, bytes: Buffer.concat([object.bytes, Buffer.from([0])]) });
		const mismatched = await app.inject({ method: 'GET', url: `/projects/project:test/assets/${assetId}/content`, headers: { cookie } });
		assert.equal(missing.statusCode, 503);
		assert.equal(mismatched.statusCode, 503);

		store.get = async () => ({
			body: Readable.from((async function* () {
				yield bytes.subarray(0, 4);
				throw new Error('injected read failure');
			})()),
			contentLength: bytes.length
		});
		await assert.rejects(
			app.inject({ method: 'GET', url: `/projects/project:test/assets/${assetId}/content`, headers: { cookie } }),
			/response destroyed before completion/
		);
	} finally {
		await app.close();
	}
});

test('concurrent uploads use distinct claims and only latest claim finalizes', async () => {
	const pool = assetMemoryPool();
	const store = memoryObjectStore();
	const originalPut = store.put.bind(store);
	const releases = [];
	store.put = async (...args) => {
		await new Promise((resolve) => releases.push(resolve));
		return originalPut(...args);
	};
	const app = createApp({ pool, objectStore: store, objectNamespace: 'test', sessionKey: SESSION_KEY, logger: false });
	try {
		const cookie = await sessionCookie(app, 'google:user-1');
		const registered = await app.inject({
			method: 'POST',
			url: '/projects/project:test/assets',
			headers: { cookie },
			payload: { name: 'race.jpg' }
		});
		const assetId = registered.json().id;
		const bytes = Buffer.from([0xff, 0xd8, 0xff, 1]);
		const request = () => app.inject({
			method: 'PUT',
			url: `/projects/project:test/assets/${assetId}/content`,
			headers: { cookie, 'content-type': 'application/octet-stream', 'content-length': String(bytes.length) },
			payload: bytes
		});
		const first = request();
		while (releases.length < 1) await new Promise((resolve) => setImmediate(resolve));
		const second = request();
		while (releases.length < 2) await new Promise((resolve) => setImmediate(resolve));
		releases[0]();
		const firstResponse = await first;
		releases[1]();
		const secondResponse = await second;
		assert.equal(firstResponse.statusCode, 409);
		assert.equal(secondResponse.statusCode, 200);
		assert.notEqual(store.puts[0].key, store.puts[1].key);
		assert.equal(pool.calls.some(({ text }) => text === 'BEGIN'), true);
	} finally {
		await app.close();
	}
});
