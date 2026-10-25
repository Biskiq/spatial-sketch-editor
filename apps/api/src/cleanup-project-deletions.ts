import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

import { ConfigError, readConfig } from './config.js';
import { createPool, sanitizeDatabaseError, type DatabasePool } from './database.js';
import { createR2ObjectStore, type ObjectStore } from './object-store.js';
import { listProjectDeletionIds, runProjectDeletionCleanup } from './project-lifecycle.js';

/** Owner-run retry and repair for durable project deletion tombstones. */
export async function main(args = process.argv.slice(2)): Promise<void> {
	let pool: DatabasePool | undefined;
	let store: ObjectStore | undefined;
	let failed = false;
	const includeCompleted = args.length === 1 && args[0] === '--verify-completed';
	if (args.length > 0 && !includeCompleted) {
		console.error('Usage: cleanup-project-deletions [--verify-completed]');
		process.exitCode = 1;
		return;
	}
	try {
		const config = readConfig();
		pool = createPool(config);
		store = createR2ObjectStore(config);
		const projectIds = await listProjectDeletionIds(pool, includeCompleted);
		for (const projectId of projectIds) {
			try {
				const result = await runProjectDeletionCleanup(pool, store, projectId);
				console.log(JSON.stringify(result));
			} catch (error) {
				failed = true;
				const safe = sanitizeDatabaseError(error);
				console.error(JSON.stringify({ projectId, status: 'error', error: safe.name }));
			}
		}
	} catch (error) {
		failed = true;
		if (error instanceof ConfigError) {
			console.error(`[api] ${error.message}`);
		} else {
			const safe = sanitizeDatabaseError(error);
			console.error(`[api] project deletion cleanup failed (${safe.name})`);
		}
	} finally {
		try {
			await store?.close?.();
		} catch {}
		try {
			await pool?.end();
		} catch {}
	}
	if (failed) process.exitCode = 1;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
	void main();
}
