/**
 * Idempotent epoch cleanup for unreferenced R2 object bytes (AM-9, T3.P01.S04).
 *
 * The reset migration removes every authored row, including `assets`. This
 * module then removes the bytes those rows pointed at, under five guards:
 *
 * 1. the store must expose listing and deletion (a read-only store refuses);
 * 2. migration 005 must be recorded as applied: the purge is a post-epoch step,
 *    and a pre-epoch database may still have rows a release manifest references;
 * 3. every listed key must sit under this deployment's configured namespace,
 *    `projects/<namespace>/<project>/assets/<uuid>/<hex32>`. A bucket shared with
 *    another deployment therefore refuses instead of deleting the other
 *    deployment's app-shaped keys;
 * 4. no `releases` row may remain: a release manifest also pins object keys, so
 *    a purge before migration 005 refuses rather than deleting live published
 *    bytes that only `releases` references;
 * 5. only keys no remaining `assets` row references are deleted, and the
 *    namespace prefix and key shape are re-checked at every delete.
 *
 * A purge that cannot prove (1)–(3) deletes nothing.
 */

import type { DatabasePool } from './database.js';
import type { ObjectStore } from './object-store.js';

/** Migration whose application activates the clean source epoch. */
export const CLEAN_SOURCE_EPOCH_MIGRATION = 5;

export const APPLICATION_OBJECT_PREFIX = 'projects/';
export const APPLICATION_OBJECT_NAMESPACE_PATTERN = /^[a-z0-9][a-z0-9-]{0,31}$/;

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
 * The only key shape this deployment writes. The namespace is not a free
 * variable: an unset or malformed namespace refuses rather than widening the
 * match to every `projects/` key.
 */
export function applicationObjectKeyPattern(namespace: string): RegExp {
	if (!APPLICATION_OBJECT_NAMESPACE_PATTERN.test(namespace)) {
		throw new R2PurgeRefusal(
			'R2 purge requires a configured object namespace of 1-32 lowercase letters, digits or hyphens'
		);
	}
	const escaped = namespace.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	return new RegExp(
		`^projects/${escaped}/[A-Za-z0-9][A-Za-z0-9._:-]*/assets/[0-9a-f-]{36}/[0-9a-f]{32}$`
	);
}

export function applicationObjectPrefix(namespace: string): string {
	applicationObjectKeyPattern(namespace);
	return `${APPLICATION_OBJECT_PREFIX}${namespace}/`;
}

/**
 * Verify that every object the credentials can see is one this deployment
 * wrote. Returns the keys unchanged so the caller lists once. An empty bucket is
 * vacuously owned. Keys that are app-shaped but belong to another namespace are
 * foreign here — that is the shared-bucket case.
 */
export async function verifyApplicationOwnedObjects(
	store: ObjectStore,
	namespace: string
): Promise<{ keys: string[] }> {
	const prefix = applicationObjectPrefix(namespace);
	const pattern = applicationObjectKeyPattern(namespace);
	if (typeof store.list !== 'function' || typeof store.delete !== 'function') {
		throw new R2PurgeRefusal('R2 purge requires a store that can list and delete objects');
	}
	const keys = await store.list();
	const foreign = keys.filter((key) => !pattern.test(key));
	if (foreign.length > 0) {
		throw new R2PurgeRefusal(
			`R2 bucket is not owned by namespace "${namespace}": ${foreign.length} object(s) fall outside ${prefix} or its key shape`
		);
	}
	return { keys };
}

/**
 * Delete every unreferenced object under the verified namespace ownership
 * guarantee. The referenced set comes from `assets.object_key` after the reset;
 * an already-clean bucket is a no-op.
 */
export async function purgeUnreferencedObjects(
	pool: Pick<DatabasePool, 'query'>,
	store: ObjectStore,
	options: { namespace: string }
): Promise<R2PurgeResult> {
	const { namespace } = options;
	const prefix = applicationObjectPrefix(namespace);
	const pattern = applicationObjectKeyPattern(namespace);

	const epoch = (await pool.query('SELECT 1 FROM schema_migrations WHERE version = $1 LIMIT 1', [
		CLEAN_SOURCE_EPOCH_MIGRATION
	])) as { rows?: unknown[] };
	if ((epoch.rows ?? []).length === 0) {
		throw new R2PurgeRefusal(
			`R2 purge requires migration ${CLEAN_SOURCE_EPOCH_MIGRATION}, which activates the clean source epoch`
		);
	}

	// AM-9 activation order: migration 005 removes every release row before this
	// runs. A release manifest also pins object keys, so refusing here keeps the
	// command safe when an operator runs it before the reset.
	const releases = (await pool.query('SELECT 1 FROM releases LIMIT 1')) as { rows?: unknown[] };
	if ((releases.rows ?? []).length > 0) {
		throw new R2PurgeRefusal(
			'R2 purge requires the clean-source reset: releases still reference object bytes'
		);
	}

	const { keys } = await verifyApplicationOwnedObjects(store, namespace);
	const result = (await pool.query(
		'SELECT object_key AS "objectKey" FROM assets WHERE object_key IS NOT NULL'
	)) as { rows?: Array<{ objectKey?: unknown }> };
	const referenced = new Set<string>();
	for (const row of result.rows ?? []) {
		if (typeof row.objectKey === 'string' && row.objectKey.length > 0) {
			// A remaining row outside this deployment's namespace means the purge is
			// pointed at the wrong storage configuration; refuse rather than skip.
			if (!pattern.test(row.objectKey)) {
				throw new R2PurgeRefusal(
					`R2 purge configuration mismatch: a remaining asset references an object outside ${prefix}`
				);
			}
			referenced.add(row.objectKey);
		}
	}
	let deleted = 0;
	for (const key of keys) {
		// Defence in depth: verifyApplicationOwnedObjects already refused any key
		// outside the namespace, and the condition repeats the guarantee at the write.
		if (!pattern.test(key) || !key.startsWith(prefix)) {
			throw new R2PurgeRefusal(`Refusing to delete unverified object key: ${key}`);
		}
		if (referenced.has(key)) continue;
		await store.delete!(key);
		deleted += 1;
	}
	return { listed: keys.length, referenced: referenced.size, deleted };
}
