/**
 * The epoch R2 purge (AM-9). The purge may only delete unreferenced keys inside
 * the deployment's configured namespace after migration 005 is active. These
 * tests use a scripted store, so no R2 credentials or network are involved.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import { purgeUnreferencedObjects, R2PurgeRefusal } from '../dist/r2-purge.js';

const NAMESPACE = 'preview';
const KEY_A = `projects/preview/project:one/assets/11111111-1111-4111-8111-111111111111/${'a'.repeat(32)}`;
const KEY_B = `projects/preview/project:one/assets/22222222-2222-4222-8222-222222222222/${'b'.repeat(32)}`;

function store(keys) {
	const deleted = [];
	return {
		deleted,
		async list() {
			return [...keys];
		},
		async delete(key) {
			deleted.push(key);
			keys.splice(keys.indexOf(key), 1);
		}
	};
}

function pool(referenced, { releases = [], migrations = [5] } = {}) {
	return {
		async query(text, params) {
			if (text.includes('FROM schema_migrations')) {
				return { rows: migrations.map((version) => ({ version, present: version === params?.[0] })) };
			}
			if (text.includes('FROM releases')) return { rows: releases };
			return { rows: referenced.map((objectKey) => ({ objectKey })) };
		}
	};
}

const options = { namespace: NAMESPACE };

test('deletes only unreferenced namespaced keys and is idempotent', async () => {
	const keys = [KEY_A, KEY_B];
	const r2 = store(keys);
	const first = await purgeUnreferencedObjects(pool([KEY_A]), r2, options);
	assert.deepEqual(first, { listed: 2, referenced: 1, deleted: 1 });
	assert.deepEqual(r2.deleted, [KEY_B]);
	const second = await purgeUnreferencedObjects(pool([KEY_A]), r2, options);
	assert.deepEqual(second, { listed: 1, referenced: 1, deleted: 0 });
	assert.deepEqual(r2.deleted, [KEY_B]);
});

test('refuses before migration 005 is active and deletes nothing', async () => {
	const r2 = store([KEY_A, KEY_B]);
	await assert.rejects(
		() => purgeUnreferencedObjects(pool([], { migrations: [] }), r2, options),
		(error) => error instanceof R2PurgeRefusal && /migration 5/.test(error.message)
	);
	assert.deepEqual(r2.deleted, []);
});

test('refuses while a release still pins object bytes and deletes nothing', async () => {
	const r2 = store([KEY_A, KEY_B]);
	await assert.rejects(
		() => purgeUnreferencedObjects(pool([], { releases: [{ exists: true }] }), r2, options),
		(error) => error instanceof R2PurgeRefusal && /releases still reference/.test(error.message)
	);
	assert.deepEqual(r2.deleted, []);
});

test('refuses a shared bucket holding another deployment namespace and deletes nothing', async () => {
	const productionKey = KEY_A.replace('projects/preview/', 'projects/production/');
	const r2 = store([KEY_A, productionKey]);
	await assert.rejects(
		() => purgeUnreferencedObjects(pool([]), r2, options),
		(error) => error instanceof R2PurgeRefusal && /not owned by namespace "preview"/.test(error.message)
	);
	assert.deepEqual(r2.deleted, []);
});

test('refuses pre-namespace legacy keys and deletes nothing', async () => {
	// Keys written before the namespace cutover keep the old shape. Migration 005
	// clears the rows that named them, but the purge still cannot prove the bucket
	// belongs to this deployment, so it must refuse the whole bucket.
	const legacyKey = `projects/project:one/assets/33333333-3333-4333-8333-333333333333/${'d'.repeat(32)}`;
	const r2 = store([legacyKey]);
	await assert.rejects(
		() => purgeUnreferencedObjects(pool([]), r2, options),
		(error) => error instanceof R2PurgeRefusal && /not owned by namespace "preview"/.test(error.message)
	);
	assert.deepEqual(r2.deleted, []);
});

test('refuses a bucket holding any foreign object and deletes nothing', async () => {
	const r2 = store([KEY_A, 'other-app/secret.bin']);
	await assert.rejects(
		() => purgeUnreferencedObjects(pool([]), r2, options),
		(error) => error instanceof R2PurgeRefusal && /not owned by namespace/.test(error.message)
	);
	assert.deepEqual(r2.deleted, []);
});

test('refuses a key outside the written shape even if the store lists it', async () => {
	const r2 = store([`projects/preview/project:one/assets/not-a-uuid/${'c'.repeat(32)}`]);
	await assert.rejects(
		() => purgeUnreferencedObjects(pool([]), r2, options),
		(error) => error instanceof R2PurgeRefusal
	);
	assert.deepEqual(r2.deleted, []);
});

test('refuses when a remaining asset row points outside the namespace', async () => {
	const r2 = store([KEY_A]);
	const foreignReference = KEY_A.replace('projects/preview/', 'projects/production/');
	await assert.rejects(
		() => purgeUnreferencedObjects(pool([foreignReference]), r2, options),
		(error) => error instanceof R2PurgeRefusal && /configuration mismatch/.test(error.message)
	);
	assert.deepEqual(r2.deleted, []);
});

test('refuses an unset or malformed namespace', async () => {
	for (const namespace of ['', 'Preview', '../preview', 'preview/bucket']) {
		const r2 = store([KEY_A]);
		await assert.rejects(
			() => purgeUnreferencedObjects(pool([]), r2, { namespace }),
			(error) => error instanceof R2PurgeRefusal && /object namespace/.test(error.message)
		);
		assert.deepEqual(r2.deleted, []);
	}
});

test('refuses a store that cannot list and delete', async () => {
	await assert.rejects(
		() => purgeUnreferencedObjects(pool([]), { async get() {}, async put() {} }, options),
		(error) => error instanceof R2PurgeRefusal
	);
});
