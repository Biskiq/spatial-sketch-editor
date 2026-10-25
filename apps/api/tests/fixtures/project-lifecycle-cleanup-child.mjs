import { Pool } from 'pg';

import { listProjectDeletionIds, runProjectDeletionCleanup } from '../../dist/project-lifecycle.js';
import { DEFAULT_PROJECT_LIFECYCLE_POLICY } from '../../dist/project-write-lease.js';
import { persistentObjectStore } from './persistent-object-store.mjs';

const [projectId, storeDirectory, nowArgument, ...flags] = process.argv.slice(2);
if (!projectId || !storeDirectory || !Number.isFinite(Number(nowArgument))) {
	throw new Error('usage: cleanup-child <projectId> <storeDirectory> <clockMs> [--verify-completed]');
}
const includeCompleted = flags.length === 1 && flags[0] === '--verify-completed';
const pool = new Pool({
	connectionString: process.env.DATABASE_URL,
	application_name: 'p04s01-restarted-cleanup-child',
	connectionTimeoutMillis: 3_000
});
const store = persistentObjectStore(storeDirectory);
try {
	await pool.query('SELECT 1');
	const candidates = await listProjectDeletionIds(pool, includeCompleted);
	if (!candidates.includes(projectId)) throw new Error(`cleanup selector omitted ${projectId}`);
	const cleanup = await runProjectDeletionCleanup(pool, store, projectId, {
		...DEFAULT_PROJECT_LIFECYCLE_POLICY,
		clock: () => new Date(Number(nowArgument))
	});
	const tombstone = await pool.query(
		'SELECT status, key_inventory, first_empty_at, attempt_count FROM project_deletions WHERE project_id = $1',
		[projectId]
	);
	process.stdout.write(JSON.stringify({
		pid: process.pid,
		includeCompleted,
		candidates,
		cleanup,
		tombstone: tombstone.rows[0],
		remainingKeys: await store.list()
	}));
} finally {
	await store.close();
	await pool.end();
}
