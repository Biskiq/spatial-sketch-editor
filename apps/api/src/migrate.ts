import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

import { createPool, sanitizeDatabaseError, type DatabaseClient, type DatabasePool } from './database.js';
import { ConfigError, readConfig } from './config.js';

const MIGRATION_DIRECTORY = fileURLToPath(new URL('../migrations/', import.meta.url));
const MIGRATION_FILE = /^(\d+)-[^/]+\.sql$/;

/**
 * Session advisory lock key for the whole migration run (TD-6). Two runners
 * against one database serialize here before either reads `schema_migrations`,
 * so the check-then-create and version insert cannot race. The key is a stable
 * application constant, not a hash of the database name: every deployment of
 * this API shares the same migration namespace on a database.
 */
export const MIGRATION_LOCK_KEY = 4_163_281_019;

const LOCK_POLL_INTERVAL_MS = 50;
const LOCK_WAIT_TIMEOUT_MS = 30_000;

async function acquireMigrationLock(db: DatabaseClient): Promise<void> {
	const deadline = Date.now() + LOCK_WAIT_TIMEOUT_MS;
	while (true) {
		const result = await db.query<{ locked: boolean }>('SELECT pg_try_advisory_lock($1) AS locked', [
			MIGRATION_LOCK_KEY
		]);
		if (result.rows[0]?.locked === true) return;
		if (Date.now() >= deadline) {
			throw new Error('Timed out waiting for the migration advisory lock');
		}
		await new Promise((resolve) => setTimeout(resolve, LOCK_POLL_INTERVAL_MS));
	}
}

export async function runMigrations(
	pool: DatabasePool,
	directory = MIGRATION_DIRECTORY
): Promise<void> {
	if (!pool.connect) throw new Error('Database transactions are unavailable');
	const files = (await readdir(directory))
		.map((name) => {
			const match = MIGRATION_FILE.exec(name);
			return match ? { name, version: Number(match[1]) } : null;
		})
		.filter((item): item is { name: string; version: number } => item !== null)
		.sort((a, b) => a.version - b.version);
	const db = await pool.connect();
	try {
		// Serialize the whole run before reading `schema_migrations`. The lock is
		// session-scoped and released in the finally block; a dropped connection
		// releases it too.
		await acquireMigrationLock(db);
		await db.query('BEGIN');
		await db.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
	version integer PRIMARY KEY,
	applied_at timestamptz NOT NULL DEFAULT now()
)`);
		await db.query('COMMIT');

		for (const file of files) {
			const applied = await db.query<{ version: number }>(
				'SELECT version FROM schema_migrations WHERE version = $1',
				[file.version]
			);
			if (applied.rows.length > 0) continue;
			const sql = await readFile(resolve(directory, file.name), 'utf8');
			await db.query('BEGIN');
			try {
				await db.query(sql);
				await db.query('INSERT INTO schema_migrations (version) VALUES ($1)', [file.version]);
				await db.query('COMMIT');
			} catch (error) {
				try {
					await db.query('ROLLBACK');
				} catch {
					// Keep the migration failure as the command result.
				}
				throw error;
			}
		}
	} finally {
		try {
			await db.query('SELECT pg_advisory_unlock($1)', [MIGRATION_LOCK_KEY]);
		} catch {
			// A broken connection releases a session lock itself; preserve the
			// migration result rather than masking it with an unlock error.
		}
		db.release();
	}
}

export async function main(): Promise<void> {
	let pool: DatabasePool | undefined;
	try {
		pool = createPool(readConfig());
		await runMigrations(pool);
		console.log('[api] migrations applied');
	} catch (error) {
		const safe = sanitizeDatabaseError(error);
		console.error(error instanceof ConfigError ? `[api] ${error.message}` : `[api] migration failed (${safe.name})`);
		process.exitCode = 1;
	} finally {
		await pool?.end();
	}
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
	void main();
}
