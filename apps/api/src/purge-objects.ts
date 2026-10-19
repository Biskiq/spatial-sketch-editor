import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

import { ConfigError, readConfig } from './config.js';
import { createPool, sanitizeDatabaseError } from './database.js';
import { createR2ObjectStore } from './object-store.js';
import { purgeUnreferencedObjects, R2PurgeRefusal } from './r2-purge.js';

/**
 * Owner-run activation step: purge object bytes left unreferenced by migration
 * 005. It refuses unless the bucket is application-owned and never touches a
 * key outside the API's own prefix.
 */
export async function main(): Promise<void> {
	const config = readConfig();
	const pool = createPool(config);
	const store = createR2ObjectStore(config);
	try {
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
		await store.close?.();
		await pool.end();
	}
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
	void main();
}
