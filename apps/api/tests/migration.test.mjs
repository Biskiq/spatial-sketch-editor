/**
 * API contract: the migration runner applies a migration once and reapplying is
 * a no-op. Split out of `api.test.mjs` by WP3T.
 *
 * Drives `runMigrations` against a scripted client, so no Postgres is required.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import { MIGRATION_LOCK_KEY, runMigrations } from '../dist/migrate.js';

test('migration runner records a migration once and reapplying is a no-op', async () => {
	const applied = new Set();
	const transactions = [];
	const client = {
		async query(text, values = []) {
			transactions.push({ text, values });
			if (text.startsWith('SELECT pg_try_advisory_lock')) return { rows: [{ locked: true }] };
			if (text.startsWith('SELECT version')) return { rows: applied.has(values[0]) ? [{ version: values[0] }] : [] };
			if (text.startsWith('INSERT INTO schema_migrations')) applied.add(values[0]);
			return { rows: [] };
		},
		release() {}
	};
	const pool = { connect: async () => client, end: async () => {} };
	await runMigrations(pool);
	const firstSqlCount = transactions.filter(({ text }) => text.includes('CREATE TABLE IF NOT EXISTS users')).length;
	const firstAssetSqlCount = transactions.filter(({ text }) => text.includes('CREATE TABLE IF NOT EXISTS assets')).length;
	await runMigrations(pool);
	assert.equal(firstSqlCount, 1);
	assert.equal(firstAssetSqlCount, 1);
	assert.equal(transactions.filter(({ text }) => text.includes('CREATE TABLE IF NOT EXISTS users')).length, 1);
	assert.equal(transactions.filter(({ text }) => text.includes('CREATE TABLE IF NOT EXISTS assets')).length, 1);
	// TD-6: the advisory lock is taken before `schema_migrations` is read and
	// released on the same session, so two runners cannot race.
	const lockIndex = transactions.findIndex(({ text }) => text.startsWith('SELECT pg_try_advisory_lock'));
	const readIndex = transactions.findIndex(({ text }) => text.startsWith('SELECT version'));
	assert.ok(lockIndex >= 0 && lockIndex < readIndex);
	assert.deepEqual(transactions[lockIndex].values, [MIGRATION_LOCK_KEY]);
	assert.ok(transactions.some(({ text }) => text.startsWith('SELECT pg_advisory_unlock')));
});

test('the lock is the runner\'s first query and is released on the same session', async () => {
	const events = [];
	let lockHeld = false;
	const client = {
		async query(text, values = []) {
			events.push(text.split('\n', 1)[0]);
			if (text.startsWith('SELECT pg_try_advisory_lock')) {
				if (lockHeld) return { rows: [{ locked: false }] };
				lockHeld = true;
				return { rows: [{ locked: true }] };
			}
			if (text.startsWith('SELECT pg_advisory_unlock')) {
				lockHeld = false;
				return { rows: [] };
			}
			if (text.startsWith('SELECT version')) return { rows: [] };
			return { rows: [] };
		},
		release() {}
	};
	const pool = { connect: async () => client, end: async () => {} };
	await runMigrations(pool);
	assert.equal(events[0], 'SELECT pg_try_advisory_lock($1) AS locked');
	assert.equal(lockHeld, false);
});
