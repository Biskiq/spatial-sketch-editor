import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

import { ConfigError, readConfig } from './config.js';
import { createPool, sanitizeDatabaseError, type DatabasePool } from './database.js';
import { createR2ObjectStore, type ObjectStore } from './object-store.js';
import { purgeUnreferencedObjects, R2PurgeRefusal } from './r2-purge.js';

/**
 * Owner-run activation step: purge object bytes left unreferenced by migration
 * 005. It refuses unless the bucket is application-owned, no release row remains
 * and every key sits outside the API's own prefix.
 */
export async function main(): Promise<void> {
	let pool: DatabasePool | undefined;
	let store: ObjectStore | undefined;
	try {
		const config = readConfig();
		pool = createPool(config);
		store = createR2ObjectStore(config);
		const result = await purgeUnreferencedObjects(pool, store);
		console.log(
			`[api] r2 purge complete (listed ${result.listed}, referenced ${result.referenced}, deleted ${result.deleted})`
		);
	} catch (error) {
		if (error instanceof ConfigError || error instanceof R2PurgeRefusal) {
			console.error(`[api] ${error.message}`);
		} else {
			const safe = sanitizeDatabaseError(error);
			console.error(`[api] r2 purge failed (${safe.name})`);
		}
		process.exitCode = 1;
	} finally {
		// Cleanup must never mask the logged purge result.
		try {
			await store?.close?.();
		} catch {}
		try {
			await pool?.end();
		} catch {}
	}
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
	void main();
}
