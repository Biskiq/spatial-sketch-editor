/**
 * API contract: the migration runner applies a migration once and reapplying is
 * a no-op. Split out of `api.test.mjs` by WP3T.
 *
 * Drives `runMigrations` against a scripted client, so no Postgres is required.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import { runMigrations } from '../dist/migrate.js';

test('migration runner records a migration once and reapplying is a no-op', async () => {
	const applied = new Set();
	const transactions = [];
	const client = {
		async query(text, values = []) {
			transactions.push({ text, values });
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
});
