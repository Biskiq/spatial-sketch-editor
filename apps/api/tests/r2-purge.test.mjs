/**
 * The epoch R2 purge (AM-9). The purge may only delete unreferenced keys under a
 * bucket/prefix already proven application-owned. These tests use a scripted
 * store, so no R2 credentials or network are involved.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import { purgeUnreferencedObjects, R2PurgeRefusal } from '../dist/r2-purge.js';

const KEY_A = `projects/project:one/assets/11111111-1111-4111-8111-111111111111/${'a'.repeat(32)}`;
const KEY_B = `projects/project:one/assets/22222222-2222-4222-8222-222222222222/${'b'.repeat(32)}`;

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

function pool(referenced, { releases = [] } = {}) {
	return {
		async query(text) {
			if (text.includes('FROM releases')) return { rows: releases };
			return { rows: referenced.map((objectKey) => ({ objectKey })) };
		}
	};
}

test('deletes only unreferenced application-owned keys and is idempotent', async () => {
	const keys = [KEY_A, KEY_B];
	const r2 = store(keys);
	const first = await purgeUnreferencedObjects(pool([KEY_A]), r2);
	assert.deepEqual(first, { listed: 2, referenced: 1, deleted: 1 });
	assert.deepEqual(r2.deleted, [KEY_B]);
	const second = await purgeUnreferencedObjects(pool([KEY_A]), r2);
	assert.deepEqual(second, { listed: 1, referenced: 1, deleted: 0 });
	assert.deepEqual(r2.deleted, [KEY_B]);
});

test('refuses while a release still pins object bytes and deletes nothing', async () => {
	const r2 = store([KEY_A, KEY_B]);
	await assert.rejects(
		() => purgeUnreferencedObjects(pool([], { releases: [{ exists: true }] }), r2),
		(error) => error instanceof R2PurgeRefusal && /releases still reference/.test(error.message)
	);
	assert.deepEqual(r2.deleted, []);
});

test('refuses a bucket holding any foreign object and deletes nothing', async () => {
	const r2 = store([KEY_A, 'other-app/secret.bin']);
	await assert.rejects(
		() => purgeUnreferencedObjects(pool([]), r2),
		(error) => error instanceof R2PurgeRefusal && /not application-owned/.test(error.message)
	);
	assert.deepEqual(r2.deleted, []);
});

test('refuses a key outside the written prefix even if the store lists it', async () => {
	const r2 = store([`projects/project:one/assets/not-a-uuid/${'c'.repeat(32)}`]);
	await assert.rejects(
		() => purgeUnreferencedObjects(pool([]), r2),
		(error) => error instanceof R2PurgeRefusal
	);
	assert.deepEqual(r2.deleted, []);
});

test('refuses a store that cannot list and delete', async () => {
	await assert.rejects(
		() => purgeUnreferencedObjects(pool([]), { async get() {}, async put() {} }),
		(error) => error instanceof R2PurgeRefusal
	);
});
