/**
 * Idempotent epoch cleanup for unreferenced R2 object bytes (AM-9, T3.P01.S04).
 *
 * The reset migration removes every authored row, including `assets`. This
 * module then removes the bytes those rows pointed at, under three guards:
 *
 * 1. the store must expose listing and deletion (a read-only store refuses);
 * 2. the configured bucket must hold **only** keys this API writes
 *    (`projects/<project>/assets/<uuid>/<hex32>`), so a shared or foreign bucket
 *    refuses instead of deleting someone else's object;
 * 3. no `releases` row may remain: a release manifest also pins object keys, so
 *    a purge before migration 005 refuses rather than deleting live published
 *    bytes that only `releases` references;
 * 4. only keys no remaining `assets` row references are deleted, and only under
 *    the verified application prefix.
 *
 * A purge that cannot prove (1) and (2) deletes nothing.
 */

import type { DatabasePool } from './database.js';
import type { ObjectStore } from './object-store.js';

export const APPLICATION_OBJECT_PREFIX = 'projects/';
export const APPLICATION_OBJECT_KEY_PATTERN =
	/^projects\/[A-Za-z0-9][A-Za-z0-9._:-]*\/assets\/[0-9a-f-]{36}\/[0-9a-f]{32}$/;

export class R2PurgeRefusal extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'R2PurgeRefusal';
	}
}

export type R2PurgeResult = {
	/** Keys the purge inspected. */
	listed: number;
	/** Keys a remaining row still references. */
	referenced: number;
	/** Keys deleted by this run. */
	deleted: number;
};

/**
 * Verify that every object the credentials can see is one this API wrote.
 * Returns the keys unchanged so the caller lists once.
 */
export async function verifyApplicationOwnedObjects(store: ObjectStore): Promise<{ keys: string[] }> {
	if (typeof store.list !== 'function' || typeof store.delete !== 'function') {
		throw new R2PurgeRefusal('R2 purge requires a store that can list and delete objects');
	}
	const keys = await store.list();
	const foreign = keys.filter((key) => !APPLICATION_OBJECT_KEY_PATTERN.test(key));
	if (foreign.length > 0) {
		throw new R2PurgeRefusal(
			`R2 bucket is not application-owned: ${foreign.length} object(s) fall outside ${APPLICATION_OBJECT_PREFIX} or its key shape`
		);
	}
	return { keys };
}

/**
 * Delete every unreferenced object under the verified application ownership
 * guarantee. The referenced set comes from `assets.object_key` after the reset;
 * an already-clean bucket is a no-op.
 */
export async function purgeUnreferencedObjects(
	pool: Pick<DatabasePool, 'query'>,
	store: ObjectStore
): Promise<R2PurgeResult> {
	const { keys } = await verifyApplicationOwnedObjects(store);
	// AM-9 activation order: migration 005 removes every release row before this
	// runs. A release manifest also pins object keys, so refusing here keeps the
	// command safe when an operator runs it before the reset.
	const releases = (await pool.query('SELECT 1 FROM releases LIMIT 1')) as { rows?: unknown[] };
	if ((releases.rows ?? []).length > 0) {
		throw new R2PurgeRefusal(
			'R2 purge requires the clean-source reset: releases still reference object bytes'
		);
	}
	const result = (await pool.query(
		'SELECT object_key AS "objectKey" FROM assets WHERE object_key IS NOT NULL'
	)) as { rows?: Array<{ objectKey?: unknown }> };
	const referenced = new Set<string>();
	for (const row of result.rows ?? []) {
		if (typeof row.objectKey === 'string' && row.objectKey.length > 0) {
			referenced.add(row.objectKey);
		}
	}
	let deleted = 0;
	for (const key of keys) {
		// Defence in depth: verifyApplicationOwnedObjects already refused any key
		// outside the prefix, and the condition repeats the guarantee at the write.
		if (!APPLICATION_OBJECT_KEY_PATTERN.test(key) || !key.startsWith(APPLICATION_OBJECT_PREFIX)) {
			throw new R2PurgeRefusal(`Refusing to delete unverified object key: ${key}`);
		}
		if (referenced.has(key)) continue;
		await store.delete!(key);
		deleted += 1;
	}
	return { listed: keys.length, referenced: referenced.size, deleted };
}
