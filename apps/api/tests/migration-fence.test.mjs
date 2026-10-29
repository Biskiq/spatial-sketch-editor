/**
 * API contract: migration 005's clean-source-epoch fence.
 *
 * Runs against real Postgres in a throwaway schema so the destructive reset
 * cannot touch the surrounding test database. Proves the fence is structural:
 * a pre-epoch writer and a pre-epoch document are refused by the schema itself,
 * whatever the deployment order, and a declared F.2 envelope is admitted.
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import test, { after, before } from 'node:test';

import { runMigrations } from '../dist/migrate.js';

const DATABASE_URL = process.env.DATABASE_URL ?? 'postgresql://localhost:5432/biskiq';
const SCHEMA = `s04_fence_${randomUUID().replaceAll('-', '')}`;

let admin;
let pool;

const envelope = {
	formatVersion: 1,
	id: 'fence-project',
	name: 'Fence project',
	acceptedRevision: { projectId: 'fence-project', revisionId: 'revision-fence' },
	dependencyLock: { formatVersion: 1, entries: [] },
	units: { layout: {}, scene: {}, camera: {}, experience: {}, resources: {} }
};

before(async () => {
	admin = new Pool({ connectionString: DATABASE_URL, connectionTimeoutMillis: 3000 });
	await admin.query(`CREATE SCHEMA ${SCHEMA}`);
	pool = new Pool({
		connectionString: DATABASE_URL,
		connectionTimeoutMillis: 3000,
		options: `-c search_path=${SCHEMA}`
	});
	await runMigrations(pool);
	await pool.query("INSERT INTO users (id) VALUES ('google:fence-owner')");
	await pool.query(
		"INSERT INTO projects (id, owner_id, name) VALUES ('fence-project', 'google:fence-owner', 'Fence project')"
	);
});

after(async () => {
	if (pool) await pool.end();
	if (admin) {
		await admin.query(`DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE`);
		await admin.end();
	}
});

test('a pre-epoch writer is refused before the column is known to it', async () => {
	await assert.rejects(
		pool.query(
			'INSERT INTO project_versions (project_id, version, document) VALUES ($1, $2, $3)',
			['fence-project', 1, { formatVersion: 1 }]
		),
		{ code: '23502' }
	);
});

test('a writer that knows the column still cannot claim a non-F.2 source', async () => {
	await assert.rejects(
		pool.query(
			'INSERT INTO project_versions (project_id, version, source_format, document) VALUES ($1, $2, $3, $4)',
			['fence-project', 2, 'legacy-v1', { formatVersion: 1 }]
		),
		{ code: '23514' }
	);
});

test('a pre-epoch document is refused even under the F.2 fence value', async () => {
	await assert.rejects(
		pool.query(
			'INSERT INTO project_versions (project_id, version, source_format, document) VALUES ($1, $2, $3, $4)',
			['fence-project', 3, 'unit-envelope-v1', { formatVersion: 1, old: true }]
		),
		{ code: '23514' }
	);
	// A document missing `units` must also fail: `jsonb_typeof` on a missing key
	// is NULL, and a CHECK constraint accepts NULL unless presence is asserted.
	await assert.rejects(
		pool.query(
			'INSERT INTO project_versions (project_id, version, source_format, document) VALUES ($1, $2, $3, $4)',
			[
				'fence-project',
				4,
				'unit-envelope-v1',
				{ ...envelope, units: undefined }
			]
		),
		{ code: '23514' }
	);
});

test('a missing, null, or non-number formatVersion is refused', async () => {
	for (const [version, document] of [
		[6, { ...envelope, formatVersion: undefined }],
		[7, { ...envelope, formatVersion: null }],
		[8, { ...envelope, formatVersion: '1' }]
	]) {
		await assert.rejects(
			pool.query(
				'INSERT INTO project_versions (project_id, version, source_format, document) VALUES ($1, $2, $3, $4)',
				['fence-project', version, 'unit-envelope-v1', document]
			),
			{ code: '23514' }
		);
	}
});

test('two concurrent migration runners serialize and both finish cleanly', async () => {
	const schema = `s04_race_${randomUUID().replaceAll('-', '')}`;
	await admin.query(`CREATE SCHEMA ${schema}`);
	const options = { connectionString: DATABASE_URL, connectionTimeoutMillis: 3000, options: `-c search_path=${schema}` };
	const left = new Pool(options);
	const right = new Pool(options);
	try {
		const results = await Promise.allSettled([runMigrations(left), runMigrations(right)]);
		assert.deepEqual(
			results.map((result) => (result.status === 'rejected' ? result.reason : 'fulfilled')),
			['fulfilled', 'fulfilled']
		);
		const versions = await left.query('SELECT version FROM schema_migrations ORDER BY version');
		assert.deepEqual(versions.rows.map((row) => row.version), [1, 2, 3, 4, 5, 6, 7, 8]);
		const fence = await left.query(
			"SELECT is_nullable FROM information_schema.columns WHERE table_schema = $1 AND table_name = 'project_versions' AND column_name = 'source_format'",
			[schema]
		);
		assert.deepEqual(fence.rows, [{ is_nullable: 'NO' }]);
	} finally {
		await left.end();
		await right.end();
		await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
	}
});

test('a declared F.2 envelope is admitted', async () => {
	await pool.query(
		'INSERT INTO project_versions (project_id, version, source_format, document) VALUES ($1, $2, $3, $4)',
		['fence-project', 5, 'unit-envelope-v1', envelope]
	);
	const { rows } = await pool.query(
		"SELECT source_format FROM project_versions WHERE project_id = 'fence-project' AND version = 5"
	);
	assert.deepEqual(rows, [{ source_format: 'unit-envelope-v1' }]);
});
