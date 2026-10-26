/**
 * T3.P04.S01 project rename/delete contract.
 *
 * Uses real Postgres and an in-memory object store with no skip guards. The
 * assertions cover the saved-base fence, deletion tombstone, project-owned
 * object inventory, and all three revocable object writers.
 */
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';
import test, { after, before } from 'node:test';

import { createApp } from '../dist/app.js';
import { runMigrations } from '../dist/migrate.js';
import { listProjectDeletionIds, runProjectDeletionCleanup } from '../dist/project-lifecycle.js';
import { withProjectAdvisoryLock } from '../dist/project-write-lease.js';

import {
	SESSION_KEY,
	memoryObjectStore,
	projectDocument,
	saveRequestBody,
	sessionCookie
} from './test-support.mjs';
import { persistentObjectStore } from './fixtures/persistent-object-store.mjs';

const DATABASE_URL = process.env.DATABASE_URL ?? 'postgresql://localhost:5432/biskiq';
const OBJECT_NAMESPACE = 'test';
const TEST_OWNER = 'google:t3-p04-s01-owner';
const OTHER_OWNER = 'google:t3-p04-s01-other';
const PLACEMENT = {
	metresPerSourceUnit: 0.5,
	pivot: [0, 0, 0],
	footprint: { width: 1.2, depth: 0.8 },
	contactMinY: 0,
	placement: 'floor'
};
const REPORT_DIGEST = `sha256-${'9'.repeat(64)}`;
const POLICY = {
	handlerTimeoutMs: 10_000,
	leaseDeadlineMs: 2_000,
	renewalIntervalMs: 100,
	abortMarginMs: 100
};

let pool;
let app;
let storeOptions;
let store;
let fakeNow;
let ownerCookie;
let otherCookie;
let projectCounter = 0;
const createdProjects = [];

function nextProjectId() {
	projectCounter += 1;
	return `p04s01${Date.now().toString(36)}${projectCounter}${randomUUID().slice(0, 8)}`;
}

function track(projectId = nextProjectId()) {
	createdProjects.push(projectId);
	return projectId;
}

function currentPrecondition(token) {
	return { kind: 'expected-saved-base', token };
}

async function save(projectId, cookie = ownerCookie, name = 'Project', targetApp = app) {
	return targetApp.inject({
		method: 'PUT',
		url: `/projects/${projectId}`,
		headers: { cookie, 'content-type': 'application/json' },
		payload: await saveRequestBody(projectDocument(name, { id: projectId }))
	});
}

async function rename(projectId, cookie, name, token) {
	return app.inject({
		method: 'PATCH',
		url: `/projects/${projectId}`,
		headers: { cookie, 'content-type': 'application/json' },
		payload: { name, precondition: currentPrecondition(token) }
	});
}

async function removeProject(projectId, token, cookie = ownerCookie, targetApp = app) {
	return targetApp.inject({
		method: 'DELETE',
		url: `/projects/${projectId}`,
		headers: { cookie, 'content-type': 'application/json' },
		payload: { precondition: currentPrecondition(token) }
	});
}

async function registerAsset(projectId, cookie = ownerCookie, targetApp = app) {
	const registered = await targetApp.inject({
		method: 'POST',
		url: `/projects/${projectId}/assets`,
		headers: { cookie, 'content-type': 'application/json' },
		payload: { name: `asset-${randomUUID().slice(0, 8)}.png` }
	});
	assert.equal(registered.statusCode, 201, JSON.stringify(registered.json()));
	const row = await pool.query('SELECT object_key FROM assets WHERE id = $1::uuid', [registered.json().id]);
	return { id: registered.json().id, objectKey: row.rows[0].object_key };
}

function hashOf(bytes) {
	return `sha256-${createHash('sha256').update(bytes).digest('hex')}`;
}

function glb(document, bin) {
	const json = Buffer.from(JSON.stringify(document), 'utf8');
	const jsonChunk = Buffer.concat([json, Buffer.alloc((4 - (json.length % 4)) % 4, 0x20)]);
	const binChunk = Buffer.concat([bin, Buffer.alloc((4 - (bin.length % 4)) % 4, 0)]);
	const header = Buffer.alloc(12);
	header.writeUInt32LE(0x46546c67, 0);
	header.writeUInt32LE(2, 4);
	header.writeUInt32LE(12 + 8 + jsonChunk.length + 8 + binChunk.length, 8);
	const jsonHeader = Buffer.alloc(8);
	jsonHeader.writeUInt32LE(jsonChunk.length, 0);
	jsonHeader.writeUInt32LE(0x4e4f534a, 4);
	const binHeader = Buffer.alloc(8);
	binHeader.writeUInt32LE(binChunk.length, 0);
	binHeader.writeUInt32LE(0x004e4942, 4);
	return Buffer.concat([header, jsonHeader, jsonChunk, binHeader, binChunk]);
}

function validGlb(fill) {
	const bytes = Buffer.alloc(4, fill);
	return glb(
		{ asset: { version: '2.0' }, buffers: [{ byteLength: bytes.length }], bufferViews: [{ buffer: 0, byteLength: bytes.length }] },
		bytes
	);
}

function gltfWithExternalBuffer() {
	const buffer = Buffer.from([3, 5, 7, 11]);
	return {
		document: Buffer.from(JSON.stringify({
			asset: { version: '2.0' },
			buffers: [{ uri: 'buffer.bin', byteLength: buffer.length }],
			bufferViews: [{ buffer: 0, byteLength: buffer.length }]
		}), 'utf8'),
		buffer
	};
}

function declaration(files) {
	return {
		files: files.map(({ role, path, bytes }) => ({ role, path, size: bytes.length, hash: hashOf(bytes) })),
		recipe: { id: 'creator-import', version: 1 }
	};
}

async function stageModel(projectId, files) {
	const response = await app.inject({
		method: 'POST',
		url: `/projects/${projectId}/models/imports`,
		headers: { cookie: ownerCookie, 'content-type': 'application/json' },
		payload: declaration(files)
	});
	assert.equal(response.statusCode, 201, JSON.stringify(response.json()));
	return response.json();
}

async function uploadModelFile(projectId, imported, path, bytes) {
	const file = imported.files.find((candidate) => candidate.path === path);
	assert.ok(file, `model import should declare ${path}`);
	return app.inject({
		method: 'PUT',
		url: `/projects/${projectId}/models/imports/${imported.importId}/files/${file.fileId}/content`,
		headers: {
			cookie: ownerCookie,
			'content-type': 'application/octet-stream',
			'content-length': String(bytes.length)
		},
		payload: bytes
	});
}

async function approve(projectId, importId) {
	return app.inject({
		method: 'POST',
		url: `/projects/${projectId}/models/imports/${importId}/approve`,
		headers: { cookie: ownerCookie, 'content-type': 'application/json' },
		payload: { reportDigest: REPORT_DIGEST, placement: PLACEMENT }
	});
}

async function uploadAsset(projectId, assetId, targetApp = app) {
	const bytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);
	return targetApp.inject({
		method: 'PUT',
		url: `/projects/${projectId}/assets/${assetId}/content`,
		headers: {
			cookie: ownerCookie,
			'content-type': 'application/octet-stream',
			'content-length': String(bytes.length)
		},
		payload: bytes
	});
}

async function assertDeletedOnlyOwnPrefix(projectId, token, expectedInventory = []) {
	const prefix = `projects/${OBJECT_NAMESPACE}/${projectId}/`;
	const own = `${prefix}orphan-from-failed-older-write`;
	const sibling = `projects/${OBJECT_NAMESPACE}/${projectId}-sibling/orphan`;
	const otherNamespace = `projects/another/${projectId}/orphan`;
	store.objects.set(own, { bytes: Buffer.from('orphan'), options: {} });
	store.objects.set(sibling, { bytes: Buffer.from('sibling'), options: {} });
	store.objects.set(otherNamespace, { bytes: Buffer.from('namespace'), options: {} });

	const deleted = await removeProject(projectId, token);
	assert.equal(deleted.statusCode, 202, JSON.stringify(deleted.json()));
	assert.equal(deleted.json().cleanup, 'pending');
	assert.equal(store.objects.has(own), false);
	assert.equal(store.objects.has(sibling), true);
	assert.equal(store.objects.has(otherNamespace), true);

	const firstEmpty = await removeProject(projectId, token);
	assert.equal(firstEmpty.statusCode, 202, JSON.stringify(firstEmpty.json()));
	const tombstone = await pool.query(
		'SELECT first_empty_at, key_inventory FROM project_deletions WHERE project_id = $1',
		[projectId]
	);
	assert.ok(tombstone.rows[0].first_empty_at);
	for (const key of expectedInventory) assert.ok(tombstone.rows[0].key_inventory.includes(key));
	fakeNow = new Date(fakeNow.getTime() + 11_000);
	const completed = await removeProject(projectId, token);
	assert.equal(completed.statusCode, 200, JSON.stringify(completed.json()));
	assert.equal(completed.json().cleanup, 'complete');
	assert.equal(store.objects.has(sibling), true);
	assert.equal(store.objects.has(otherNamespace), true);

	const lateKey = `${prefix}late-complete-write`;
	store.objects.set(lateKey, { bytes: Buffer.from('late'), options: {} });
	const repaired = await runProjectDeletionCleanup(pool, store, projectId, {
		...POLICY,
		clock: () => new Date(fakeNow)
	});
	assert.equal(repaired.status, 'pending');
	assert.deepEqual(repaired.repairedLateKeys, [lateKey]);
	assert.equal(store.objects.has(lateKey), false);
	const reproved = await runProjectDeletionCleanup(pool, store, projectId, {
		...POLICY,
		clock: () => new Date(fakeNow)
	});
	assert.equal(reproved.status, 'pending');
	fakeNow = new Date(fakeNow.getTime() + 11_000);
	const verified = await runProjectDeletionCleanup(pool, store, projectId, {
		...POLICY,
		clock: () => new Date(fakeNow)
	});
	assert.equal(verified.status, 'complete');
	assert.ok((await listProjectDeletionIds(pool, true)).includes(projectId));
	assert.equal((await listProjectDeletionIds(pool)).includes(projectId), false);

	const recreated = await app.inject({
		method: 'PUT',
		url: `/projects/${projectId}`,
		headers: { cookie: ownerCookie, 'content-type': 'application/json' },
		payload: await saveRequestBody(projectDocument('Resurrection', { id: projectId }))
	});
	assert.equal(recreated.statusCode, 409);
	assert.equal(recreated.json().error.code, 'save_collision');
}

async function waitForLeaseRelease(projectId) {
	const deadline = Date.now() + 2_000;
	while (Date.now() < deadline) {
		const result = await pool.query(
			'SELECT count(*)::int AS count FROM project_write_leases WHERE project_id = $1 AND released_at IS NULL AND deadline_at > clock_timestamp()',
			[projectId]
		);
		if (result.rows[0].count === 0) return;
		await new Promise((resolve) => setTimeout(resolve, 10));
	}
	assert.fail('revoked writer did not release its lease');
}

async function waitForAdvisoryWait() {
	const deadline = Date.now() + 2_000;
	while (Date.now() < deadline) {
		const result = await pool.query(
			`SELECT count(*)::int AS count
FROM pg_stat_activity
WHERE datname = current_database() AND wait_event_type = 'Lock' AND wait_event = 'advisory'
		AND query ILIKE '%pg_advisory_lock%'`
		);
		if (result.rows[0].count > 0) return;
		await new Promise((resolve) => setTimeout(resolve, 10));
	}
	assert.fail('the competing operation did not reach the advisory lock');
}

async function within(promise, timeoutMs, message) {
	let timer;
	try {
		return await Promise.race([
			promise,
			new Promise((_, reject) => {
				timer = setTimeout(() => reject(new Error(message)), timeoutMs);
			})
		]);
	} finally {
		clearTimeout(timer);
	}
}

async function assertAdvisoryLockReleased(scope, key) {
	const db = await pool.connect();
	try {
		const result = await db.query('SELECT pg_try_advisory_lock(hashtext($1), hashtext($2)) AS acquired', [scope, key]);
		assert.equal(result.rows[0].acquired, true, `advisory lock ${scope}/${key} should be released`);
		await db.query('SELECT pg_advisory_unlock(hashtext($1), hashtext($2))', [scope, key]);
	} finally {
		db.release();
	}
}

function blockNextPut() {
	let enteredResolve;
	const entered = new Promise((resolve) => (enteredResolve = resolve));
	storeOptions.onPut = async (_key, signal) => {
		enteredResolve();
		await new Promise((resolve, reject) => {
			if (signal.aborted) return reject(signal.reason);
			signal.addEventListener('abort', () => reject(signal.reason), { once: true });
		});
	};
	return entered;
}

async function runCleanupChild({ projectId, storeDirectory, nowMs, verifyCompleted = false }) {
	const childPath = fileURLToPath(new URL('./fixtures/project-lifecycle-cleanup-child.mjs', import.meta.url));
	const repoRoot = fileURLToPath(new URL('../../..', import.meta.url));
	const viteNodePath = join(repoRoot, 'node_modules/vite-node/vite-node.mjs');
	return await new Promise((resolveChild, rejectChild) => {
		const child = spawn(process.execPath, [
			viteNodePath,
			childPath,
			projectId,
			storeDirectory,
			String(nowMs),
			...(verifyCompleted ? ['--verify-completed'] : [])
		], {
			cwd: repoRoot,
			env: { ...process.env, DATABASE_URL },
			stdio: ['ignore', 'pipe', 'pipe']
		});
		let stdout = '';
		let stderr = '';
		const timer = setTimeout(() => child.kill('SIGTERM'), 20_000);
		child.stdout.setEncoding('utf8').on('data', (chunk) => { stdout += chunk; });
		child.stderr.setEncoding('utf8').on('data', (chunk) => { stderr += chunk; });
		child.once('error', (error) => {
			clearTimeout(timer);
			rejectChild(error);
		});
		child.once('exit', (code, signal) => {
			clearTimeout(timer);
			if (code !== 0) {
				rejectChild(new Error(`cleanup child exited ${code ?? signal}: ${stderr}`));
				return;
			}
			try {
				resolveChild(JSON.parse(stdout));
			} catch (error) {
				rejectChild(new Error(`cleanup child returned invalid JSON: ${stderr || String(error)}; stdout=${stdout}`));
			}
		});
	});
}

async function assertWriterFenced(projectId, token, writerPromise, entered, afterStopped) {
	await entered;
	const busy = await removeProject(projectId, token);
	assert.equal(busy.statusCode, 409, JSON.stringify(busy.json()));
	assert.equal(busy.json().error.code, 'project-busy');
	const lease = await pool.query(
		'SELECT revoked_at, released_at FROM project_write_leases WHERE project_id = $1 ORDER BY started_at DESC LIMIT 1',
		[projectId]
	);
	assert.ok(lease.rows[0].revoked_at, 'delete should commit lease revocation before returning busy');
	const writer = await writerPromise;
	assert.equal(writer.statusCode, 409, JSON.stringify(writer.json()));
	assert.equal(writer.json().error.code, 'project-busy');
	await waitForLeaseRelease(projectId);
	storeOptions.onPut = undefined;
	if (afterStopped) await afterStopped();
	const deleted = await removeProject(projectId, token);
	assert.equal(deleted.statusCode, 202, JSON.stringify(deleted.json()));
}

before(async () => {
	pool = new Pool({ connectionString: DATABASE_URL, connectionTimeoutMillis: 3000 });
	await pool.query('SELECT 1');
	await runMigrations(pool);
	await runMigrations(pool);
	storeOptions = {};
	store = memoryObjectStore(storeOptions);
	fakeNow = new Date(Date.now() + 60 * 60 * 1000);
	app = createApp({
		pool,
		objectStore: store,
		objectNamespace: OBJECT_NAMESPACE,
		sessionKey: SESSION_KEY,
		projectLifecyclePolicy: { ...POLICY, clock: () => new Date(fakeNow) },
		logger: false
	});
	await app.ready();
	ownerCookie = await sessionCookie(app, TEST_OWNER);
	otherCookie = await sessionCookie(app, OTHER_OWNER);
});

after(async () => {
	if (pool && createdProjects.length > 0) {
		await pool.query('DELETE FROM project_write_leases WHERE project_id = ANY ($1::text[])', [createdProjects]);
		await pool.query('DELETE FROM project_deletions WHERE project_id = ANY ($1::text[])', [createdProjects]);
		await pool.query('DELETE FROM releases WHERE project_id = ANY ($1::text[])', [createdProjects]);
		await pool.query('DELETE FROM publications WHERE project_id = ANY ($1::text[])', [createdProjects]);
		await pool.query('DELETE FROM assets WHERE project_id = ANY ($1::text[])', [createdProjects]);
		await pool.query('DELETE FROM model_imports WHERE project_id = ANY ($1::text[])', [createdProjects]);
		await pool.query('DELETE FROM model_revisions WHERE project_id = ANY ($1::text[])', [createdProjects]);
		await pool.query('DELETE FROM save_receipts WHERE project_id = ANY ($1::text[])', [createdProjects]);
		await pool.query('DELETE FROM project_versions WHERE project_id = ANY ($1::text[])', [createdProjects]);
		await pool.query('DELETE FROM projects WHERE id = ANY ($1::text[])', [createdProjects]);
	}
	if (app) await app.close();
	else if (pool) await pool.end();
});

test('rename writes through Save, no-op appends no version, and stale or foreign owners are refused', async () => {
	const projectId = track();
	const created = await save(projectId, ownerCookie, 'Before rename');
	assert.equal(created.statusCode, 200, JSON.stringify(created.json()));
	const initial = created.json();

	const renamed = await rename(projectId, ownerCookie, 'Renamed project', initial.savedBaseToken);
	assert.equal(renamed.statusCode, 200, JSON.stringify(renamed.json()));
	assert.equal(renamed.json().name, 'Renamed project');
	assert.equal(renamed.json().version, 2);
	assert.notDeepEqual(renamed.json().savedRevision, initial.savedRevision);

	const noOp = await rename(projectId, ownerCookie, 'Renamed project', renamed.json().savedBaseToken);
	assert.equal(noOp.statusCode, 200, JSON.stringify(noOp.json()));
	assert.equal(noOp.json().version, 2);
	assert.equal(noOp.json().savedBaseToken, renamed.json().savedBaseToken);

	const stale = await rename(projectId, ownerCookie, 'Stale name', initial.savedBaseToken);
	assert.equal(stale.statusCode, 409);
	assert.equal(stale.json().error.code, 'conflict');
	const foreign = await rename(projectId, otherCookie, 'Intruder', renamed.json().savedBaseToken);
	assert.equal(foreign.statusCode, 404);

	const versions = await pool.query('SELECT version, document FROM project_versions WHERE project_id = $1 ORDER BY version', [projectId]);
	assert.deepEqual(versions.rows.map((row) => row.version), [1, 2]);
	assert.equal(versions.rows[1].document.name, 'Renamed project');
	const loaded = await app.inject({ method: 'GET', url: `/projects/${projectId}`, headers: { cookie: ownerCookie } });
	assert.equal(loaded.json().document.name, 'Renamed project');
});

test('active publication refuses deletion before fencing; unpublish then deletes only the exact project prefix', async () => {
	const projectId = track();
	const saved = await save(projectId, ownerCookie, 'Delete me');
	const token = saved.json().savedBaseToken;
	const asset = await registerAsset(projectId);
	store.objects.set(asset.objectKey, { bytes: Buffer.from('asset'), options: {} });
	await pool.query(
		'INSERT INTO publications (project_id, public_id, active_version, revision) VALUES ($1, $2::uuid, 1, 1)',
		[projectId, randomUUID()]
	);
	await pool.query('INSERT INTO releases (project_id, version, manifest) VALUES ($1, 1, $2::jsonb)', [projectId, JSON.stringify({})]);
	const leaseId = randomUUID();
	await pool.query(
		`INSERT INTO project_write_leases (id, project_id, owner_id, started_at, heartbeat_at, deadline_at)
VALUES ($1::uuid, $2, $3, clock_timestamp(), clock_timestamp(), clock_timestamp() + interval '1 minute')`,
		[leaseId, projectId, TEST_OWNER]
	);

	const foreign = await removeProject(projectId, token, otherCookie);
	assert.equal(foreign.statusCode, 404);
	const active = await removeProject(projectId, token);
	assert.equal(active.statusCode, 409);
	assert.equal(active.json().error.code, 'unpublish-first');
	const untouched = await pool.query(
		`SELECT p.active_version, l.revoked_at, d.project_id AS tombstone
FROM publications p JOIN project_write_leases l ON l.project_id = p.project_id
LEFT JOIN project_deletions d ON d.project_id = p.project_id
WHERE p.project_id = $1 AND l.id = $2::uuid`,
		[projectId, leaseId]
	);
	assert.deepEqual(untouched.rows, [{ active_version: 1, revoked_at: null, tombstone: null }]);
	assert.equal(store.objects.has(asset.objectKey), true);

	await pool.query('UPDATE publications SET active_version = NULL WHERE project_id = $1', [projectId]);
	await pool.query('DELETE FROM project_write_leases WHERE id = $1::uuid', [leaseId]);
	await assertDeletedOnlyOwnPrefix(projectId, token, [asset.objectKey]);
	const putCount = store.puts.length;
	const afterDeleteWrite = await uploadAsset(projectId, asset.id);
	assert.equal(afterDeleteWrite.statusCode, 404);
	assert.equal(store.puts.length, putCount);
	const retained = await pool.query('SELECT count(*)::int AS count FROM projects WHERE id = $1', [projectId]);
	assert.equal(retained.rows[0].count, 0);
});

test('model approval serializes identical revisions, migration replay backfills source keys, and delete inventories them', async () => {
	const projectId = track();
	const saved = await save(projectId, ownerCookie, 'Model project');
	const sourceSet = gltfWithExternalBuffer();
	const derivative = validGlb(2);
	const files = [
		{ role: 'source', path: 'model/scene.gltf', bytes: sourceSet.document },
		{ role: 'source', path: 'model/buffer.bin', bytes: sourceSet.buffer },
		{ role: 'derivative', path: 'derivative.glb', bytes: derivative }
	];
	const first = await stageModel(projectId, files);
	const second = await stageModel(projectId, files);
	for (const imported of [first, second]) {
		for (const file of files) {
			const uploaded = await uploadModelFile(projectId, imported, file.path, file.bytes);
			assert.equal(uploaded.statusCode, 200, JSON.stringify(uploaded.json()));
		}
	}

	const writesBeforeApproval = store.puts.length;
	const [approvedFirst, approvedSecond] = await Promise.all([
		approve(projectId, first.importId),
		approve(projectId, second.importId)
	]);
	assert.equal(approvedFirst.statusCode, 200, JSON.stringify(approvedFirst.json()));
	assert.equal(approvedSecond.statusCode, 200, JSON.stringify(approvedSecond.json()));
	assert.equal(approvedFirst.json().revisionId, approvedSecond.json().revisionId);

	const revisionRows = await pool.query(
		'SELECT id, derivative_key, source_keys, source_file_count FROM model_revisions WHERE project_id = $1',
		[projectId]
	);
	assert.equal(revisionRows.rows.length, 1);
	const revision = revisionRows.rows[0];
	assert.equal(revision.source_file_count, 2);
	assert.equal(revision.source_keys.length, revision.source_file_count);
	assert.ok(revision.source_keys.every((key) => store.objects.has(key)));
	const actualSourceCopies = store.puts.slice(writesBeforeApproval)
		.map((entry) => entry.key)
		.filter((key) => key.includes('/models/revisions/') && !key.endsWith('/derivative.glb'));
	assert.equal(actualSourceCopies.length, 2, 'approval wrote one source copy for each admitted source file');
	assert.deepEqual(new Set(revision.source_keys), new Set(actualSourceCopies));
	assert.ok(store.objects.has(revision.derivative_key));
	const expectedSourceKeys = [...revision.source_keys];

	await pool.query('UPDATE model_revisions SET source_keys = NULL WHERE id = $1::uuid', [revision.id]);
	const migrationSql = await readFile(new URL('../migrations/007-project-lifecycle.sql', import.meta.url), 'utf8');
	await pool.query(migrationSql);
	await pool.query(migrationSql);
	const replayed = await pool.query('SELECT source_keys FROM model_revisions WHERE id = $1::uuid', [revision.id]);
	assert.deepEqual(new Set(replayed.rows[0].source_keys), new Set(expectedSourceKeys));

	const siblingProjectId = track();
	const siblingSaved = await save(siblingProjectId, ownerCookie, 'Identical model sibling');
	assert.equal(siblingSaved.statusCode, 200, JSON.stringify(siblingSaved.json()));
	const siblingImport = await stageModel(siblingProjectId, files);
	for (const file of files) {
		const uploaded = await uploadModelFile(siblingProjectId, siblingImport, file.path, file.bytes);
		assert.equal(uploaded.statusCode, 200, JSON.stringify(uploaded.json()));
	}
	const siblingApproved = await approve(siblingProjectId, siblingImport.importId);
	assert.equal(siblingApproved.statusCode, 200, JSON.stringify(siblingApproved.json()));
	const siblingRevision = await pool.query(
		'SELECT derivative_key, source_keys FROM model_revisions WHERE project_id = $1',
		[siblingProjectId]
	);
	const siblingKeys = [siblingRevision.rows[0].derivative_key, ...siblingRevision.rows[0].source_keys];
	assert.notDeepEqual(new Set(siblingKeys), new Set([revision.derivative_key, ...expectedSourceKeys]));

	const unapprovedImport = await stageModel(projectId, files);
	for (const file of files) {
		const uploaded = await uploadModelFile(projectId, unapprovedImport, file.path, file.bytes);
		assert.equal(uploaded.statusCode, 200, JSON.stringify(uploaded.json()));
	}

	// A historical revision whose approved import record is absent stays explicit
	// about the required exact-prefix sweep.
	const legacyHash = hashOf(Buffer.from(`legacy:${projectId}`));
	await pool.query(
		`INSERT INTO model_revisions (
id, project_id, content_hash, derivative_hash, derivative_mime, derivative_bytes, derivative_key,
source_manifest_hash, source_bytes, source_file_count, recipe_id, recipe_version, report_digest, placement, source_keys
)
SELECT $1::uuid, project_id, $2, derivative_hash, derivative_mime, derivative_bytes,
		       'projects/' || $4 || '/' || project_id || '/models/revisions/legacy/derivative.glb',
       source_manifest_hash, source_bytes, source_file_count, recipe_id, recipe_version, report_digest, placement, NULL
FROM model_revisions WHERE id = $3::uuid`,
		[randomUUID(), legacyHash, revision.id, OBJECT_NAMESPACE]
	);
	const legacyDerivativeKey = `projects/${OBJECT_NAMESPACE}/${projectId}/models/revisions/legacy/derivative.glb`;
	store.objects.set(legacyDerivativeKey, { bytes: Buffer.from('legacy-derivative'), options: {} });

	const prefix = `projects/${OBJECT_NAMESPACE}/${projectId}/`;
	const expectedOwnedKeys = [...store.objects.keys()].filter((key) => key.startsWith(prefix)).sort();
	const expectedSiblingKeys = [...store.objects.keys()].filter((key) => key.startsWith(`projects/${OBJECT_NAMESPACE}/${siblingProjectId}/`)).sort();
	const expectedInventory = await pool.query(
		`SELECT object_key AS key FROM assets WHERE project_id = $1 AND object_key IS NOT NULL
		 UNION SELECT f.object_key FROM model_import_files f JOIN model_imports i ON i.id = f.import_id
		  WHERE i.project_id = $1 AND f.object_key IS NOT NULL
		 UNION SELECT derivative_key FROM model_revisions WHERE project_id = $1
		 UNION SELECT jsonb_array_elements_text(source_keys) FROM model_revisions WHERE project_id = $1`,
		[projectId]
	);
	assert.ok(expectedOwnedKeys.some((key) => key.includes(`/models/imports/${unapprovedImport.importId}/`)));
	assert.deepEqual(new Set(expectedSiblingKeys), new Set(siblingKeys));
	fakeNow = new Date();
	const deleted = await removeProject(projectId, saved.json().savedBaseToken);
	assert.equal(deleted.statusCode, 202, JSON.stringify(deleted.json()));
	for (const key of expectedOwnedKeys) assert.equal(store.objects.has(key), false, `owned key should be removed: ${key}`);
	for (const key of expectedSiblingKeys) assert.equal(store.objects.has(key), true, `identical-content sibling key should survive: ${key}`);
	const tombstone = await pool.query(
		'SELECT key_inventory, sweep_dependent, first_empty_at, fenced_at, cleanup_bound_ms FROM project_deletions WHERE project_id = $1',
		[projectId]
	);
	assert.equal(tombstone.rows[0].sweep_dependent, true);
	assert.deepEqual(tombstone.rows[0].key_inventory, expectedInventory.rows.map((row) => row.key).sort());
	assert.ok(tombstone.rows[0].key_inventory.every((key) => key.startsWith(prefix)));
	assert.equal(tombstone.rows[0].first_empty_at, null);
	const fencedAt = new Date(tombstone.rows[0].fenced_at).getTime();
	const cleanupBound = Number(tombstone.rows[0].cleanup_bound_ms);
	fakeNow = new Date(fencedAt + cleanupBound);
	const firstEmpty = await removeProject(projectId, saved.json().savedBaseToken);
	assert.equal(firstEmpty.statusCode, 202, JSON.stringify(firstEmpty.json()));
	fakeNow = new Date(fencedAt + cleanupBound * 2);
	const completed = await removeProject(projectId, saved.json().savedBaseToken);
	assert.equal(completed.statusCode, 200, JSON.stringify(completed.json()));
	assert.equal(completed.json().cleanup, 'complete');
	for (const key of expectedOwnedKeys) assert.equal(store.objects.has(key), false, `owned prefix key should be swept: ${key}`);
	for (const key of expectedSiblingKeys) assert.equal(store.objects.has(key), true);
	assert.equal((await pool.query('SELECT count(*)::int AS count FROM projects WHERE id = $1', [siblingProjectId])).rows[0].count, 1);
	assert.equal((await pool.query('SELECT count(*)::int AS count FROM projects WHERE id = $1', [projectId])).rows[0].count, 0);
});

test('approval and deletion cleanup progress with concurrent advisory waiters on a restricted pool', async () => {
	const projectId = track();
	const saved = await save(projectId, ownerCookie, 'Restricted pool approval');
	const source = validGlb(3);
	const derivative = validGlb(4);
	const files = [
		{ role: 'source', path: 'source.glb', bytes: source },
		{ role: 'derivative', path: 'derivative.glb', bytes: derivative }
	];
	const first = await stageModel(projectId, files);
	const second = await stageModel(projectId, files);
	for (const imported of [first, second]) {
		for (const file of files) {
			const uploaded = await uploadModelFile(projectId, imported, file.path, file.bytes);
			assert.equal(uploaded.statusCode, 200, JSON.stringify(uploaded.json()));
		}
	}

	const restrictedPool = new Pool({
		connectionString: DATABASE_URL,
		max: 2,
		connectionTimeoutMillis: 1_000,
		query_timeout: 3_000,
		application_name: 'p04s01-restricted-pool-regression'
	});
	const restrictedStore = {
		put: (...args) => store.put(...args),
		get: (...args) => store.get(...args),
		delete: (...args) => store.delete(...args),
		list: (...args) => store.list(...args)
	};
	const restrictedApp = createApp({
		pool: restrictedPool,
		objectStore: restrictedStore,
		objectNamespace: OBJECT_NAMESPACE,
		sessionKey: SESSION_KEY,
		projectLifecyclePolicy: { ...POLICY, clock: () => new Date(fakeNow) },
		logger: false
	});
	let releaseRevisionPut;
	let revisionPutEntered;
	const revisionPutBlocked = new Promise((resolve) => (revisionPutEntered = resolve));
	const revisionPutGate = new Promise((resolve) => (releaseRevisionPut = resolve));
	let blockOneRevisionPut = true;
	storeOptions.onPut = async (key, signal) => {
		if (!blockOneRevisionPut || !key.includes('/models/revisions/')) return;
		blockOneRevisionPut = false;
		revisionPutEntered(key);
		await new Promise((resolve, reject) => {
			const onAbort = () => reject(signal.reason instanceof Error ? signal.reason : new Error('approval aborted'));
			const finish = () => {
				signal.removeEventListener('abort', onAbort);
				resolve();
			};
			signal.addEventListener('abort', onAbort, { once: true });
			revisionPutGate.then(finish);
			if (signal.aborted) onAbort();
		});
	};
	try {
		await restrictedApp.ready();
		const approveThroughRestrictedApp = (importId) =>
			restrictedApp.inject({
				method: 'POST',
				url: `/projects/${projectId}/models/imports/${importId}/approve`,
				headers: { cookie: ownerCookie, 'content-type': 'application/json' },
				payload: { reportDigest: REPORT_DIGEST, placement: PLACEMENT }
			});
		const approvalOne = approveThroughRestrictedApp(first.importId);
		const revisionPutKey = await within(revisionPutBlocked, 2_000, 'approval never began its revision write');
		const approvalTwo = approveThroughRestrictedApp(second.importId);
		await waitForAdvisoryWait();
		releaseRevisionPut();
		const approvals = await Promise.all([approvalOne, approvalTwo]);
		assert.ok(approvals.every((response) => response.statusCode === 200), approvals.map((response) => response.body).join('\n'));
		assert.equal(approvals[0].json().revisionId, approvals[1].json().revisionId);
		const revision = await pool.query(
			'SELECT derivative_key, source_keys FROM model_revisions WHERE project_id = $1',
			[projectId]
		);
		assert.equal(revision.rows.length, 1);
		const derivativeKey = revision.rows[0].derivative_key;
		const sourceKey = revision.rows[0].source_keys[0];
		assert.deepEqual(store.objects.get(derivativeKey).bytes, derivative);
		assert.deepEqual(store.objects.get(sourceKey).bytes, source);
		assert.ok(store.objects.has(revisionPutKey), 'the winning deterministic revision bytes remain stored');
		const importStates = await pool.query(
			"SELECT state FROM model_imports WHERE id = ANY ($1::uuid[]) ORDER BY id",
			[[first.importId, second.importId]]
		);
		assert.deepEqual(importStates.rows.map((row) => row.state), ['approved', 'approved']);
		assert.equal(restrictedPool.waitingCount, 0);
		assert.equal(restrictedPool.idleCount, restrictedPool.totalCount);
		await assertAdvisoryLockReleased('model-approval', `${projectId}:${approvals[0].json().contentHash}`);

		const cleanupProjectId = track();
		const cleanupSaved = await save(cleanupProjectId, ownerCookie, 'Restricted pool cleanup');
		const deletion = await restrictedApp.inject({
			method: 'DELETE',
			url: `/projects/${cleanupProjectId}`,
			headers: { cookie: ownerCookie, 'content-type': 'application/json' },
			payload: { precondition: currentPrecondition(cleanupSaved.json().savedBaseToken) }
		});
		assert.equal(deletion.statusCode, 202, JSON.stringify(deletion.json()));
		assert.equal(deletion.json().cleanup, 'pending');

		const originalList = store.list;
		let releaseList;
		let listEntered;
		const listEnteredPromise = new Promise((resolve) => (listEntered = resolve));
		const listGate = new Promise((resolve) => (releaseList = resolve));
		let blockOneList = true;
		store.list = async (...args) => {
			if (blockOneList) {
				blockOneList = false;
				listEntered();
				await listGate;
			}
			return originalList(...args);
		};
		try {
			const cleanupPolicy = { ...POLICY, clock: () => new Date(fakeNow) };
			const cleanupOne = runProjectDeletionCleanup(restrictedPool, restrictedStore, cleanupProjectId, cleanupPolicy);
			await within(listEnteredPromise, 2_000, 'cleanup never reached its object listing');
			const cleanupTwo = runProjectDeletionCleanup(restrictedPool, restrictedStore, cleanupProjectId, cleanupPolicy);
			await waitForAdvisoryWait();
			releaseList();
			const cleanups = await Promise.all([cleanupOne, cleanupTwo]);
			assert.deepEqual(cleanups.map((result) => result.status), ['pending', 'pending']);
		} finally {
			releaseList();
			store.list = originalList;
		}
		const attempt = await pool.query('SELECT attempt_count, first_empty_at FROM project_deletions WHERE project_id = $1', [cleanupProjectId]);
		assert.equal(attempt.rows[0].attempt_count, 3, 'the delete and both serialized cleanup attempts are recorded');
		assert.ok(attempt.rows[0].first_empty_at);
		assert.equal(restrictedPool.waitingCount, 0);
		assert.equal(restrictedPool.idleCount, restrictedPool.totalCount);
		await assertAdvisoryLockReleased('project-deletion-cleanup', cleanupProjectId);

		await assert.rejects(
			withProjectAdvisoryLock(restrictedPool, 'project-deletion-test-error', cleanupProjectId, async () => {
				throw new Error('injected protected-work failure');
			}),
			/injected protected-work failure/
		);
		await assertAdvisoryLockReleased('project-deletion-test-error', cleanupProjectId);
	} finally {
		storeOptions.onPut = undefined;
		if (restrictedApp) await restrictedApp.close();
		else await restrictedPool.end();
	}
});

test('a single-connection pool can complete one approval and one deletion cleanup', async () => {
	const oneSlotPool = new Pool({
		connectionString: DATABASE_URL,
		max: 1,
		connectionTimeoutMillis: 1_000,
		query_timeout: 3_000,
		application_name: 'p04s01-single-connection-regression'
	});
	const oneSlotStore = {
		put: (...args) => store.put(...args),
		get: (...args) => store.get(...args),
		delete: (...args) => store.delete(...args),
		list: (...args) => store.list(...args)
	};
	const oneSlotApp = createApp({
		pool: oneSlotPool,
		objectStore: oneSlotStore,
		objectNamespace: OBJECT_NAMESPACE,
		sessionKey: SESSION_KEY,
		projectLifecyclePolicy: { ...POLICY, clock: () => new Date(fakeNow) },
		logger: false
	});
	try {
		await oneSlotApp.ready();
		const cleanupProjectId = track();
		const cleanupSaved = await save(cleanupProjectId, ownerCookie, 'Single-connection cleanup');
		const deleted = await oneSlotApp.inject({
			method: 'DELETE',
			url: `/projects/${cleanupProjectId}`,
			headers: { cookie: ownerCookie, 'content-type': 'application/json' },
			payload: { precondition: currentPrecondition(cleanupSaved.json().savedBaseToken) }
		});
		assert.equal(deleted.statusCode, 202, JSON.stringify(deleted.json()));
		assert.equal(deleted.json().cleanup, 'pending');
		const record = await pool.query(
			'SELECT attempt_count, first_empty_at FROM project_deletions WHERE project_id = $1',
			[cleanupProjectId]
		);
		assert.equal(record.rows[0].attempt_count, 1);
		assert.ok(record.rows[0].first_empty_at);

		const projectId = track();
		await save(projectId, ownerCookie, 'Single-connection approval');
		const source = validGlb(5);
		const derivative = validGlb(6);
		const imported = await stageModel(projectId, [
			{ role: 'source', path: 'source.glb', bytes: source },
			{ role: 'derivative', path: 'derivative.glb', bytes: derivative }
		]);
		for (const file of [
			{ path: 'source.glb', bytes: source },
			{ path: 'derivative.glb', bytes: derivative }
		]) {
			const uploaded = await uploadModelFile(projectId, imported, file.path, file.bytes);
			assert.equal(uploaded.statusCode, 200, JSON.stringify(uploaded.json()));
		}
		const approval = await oneSlotApp.inject({
			method: 'POST',
			url: `/projects/${projectId}/models/imports/${imported.importId}/approve`,
			headers: { cookie: ownerCookie, 'content-type': 'application/json' },
			payload: { reportDigest: REPORT_DIGEST, placement: PLACEMENT }
		});
		assert.equal(approval.statusCode, 200, JSON.stringify(approval.json()));
		const revision = await pool.query('SELECT derivative_key, source_keys FROM model_revisions WHERE project_id = $1', [projectId]);
		assert.deepEqual(store.objects.get(revision.rows[0].derivative_key).bytes, derivative);
		assert.deepEqual(store.objects.get(revision.rows[0].source_keys[0]).bytes, source);

		await oneSlotPool.query('SELECT 1');
		assert.equal(oneSlotPool.waitingCount, 0);
		assert.equal(oneSlotPool.idleCount, oneSlotPool.totalCount);
		await assertAdvisoryLockReleased('model-approval', `${projectId}:${approval.json().contentHash}`);
		await assertAdvisoryLockReleased('project-deletion-cleanup', cleanupProjectId);
	} finally {
		await oneSlotApp.close();
	}
});

test('failed approval finalization compensates newly written revision keys', async () => {
	const projectId = track();
	await save(projectId, ownerCookie, 'Failed approval');
	const source = validGlb(7);
	const derivative = validGlb(8);
	const imported = await stageModel(projectId, [
		{ role: 'source', path: 'source.glb', bytes: source },
		{ role: 'derivative', path: 'derivative.glb', bytes: derivative }
	]);
	for (const file of [{ path: 'source.glb', bytes: source }, { path: 'derivative.glb', bytes: derivative }]) {
		const uploaded = await uploadModelFile(projectId, imported, file.path, file.bytes);
		assert.equal(uploaded.statusCode, 200, JSON.stringify(uploaded.json()));
	}

	await pool.query(`CREATE FUNCTION p04s01_reject_revision_insert() RETURNS trigger
LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'injected revision insert failure'; END $$`);
	await pool.query(`CREATE TRIGGER p04s01_reject_revision_insert
BEFORE INSERT ON model_revisions FOR EACH ROW EXECUTE FUNCTION p04s01_reject_revision_insert()`);
	try {
		const response = await approve(projectId, imported.importId);
		assert.equal(response.statusCode, 503);
		const revisions = [...store.objects.keys()].filter((key) => key.startsWith(`projects/${OBJECT_NAMESPACE}/${projectId}/models/revisions/`));
		assert.deepEqual(revisions, []);
		const rows = await pool.query('SELECT count(*)::int AS count FROM model_revisions WHERE project_id = $1', [projectId]);
		assert.equal(rows.rows[0].count, 0);
	} finally {
		await pool.query('DROP TRIGGER IF EXISTS p04s01_reject_revision_insert ON model_revisions');
		await pool.query('DROP FUNCTION IF EXISTS p04s01_reject_revision_insert()');
	}
});

test('asset upload is aborted by a committed delete lease revocation', async () => {
	const projectId = track();
	const saved = await save(projectId, ownerCookie, 'Asset lease');
	const asset = await registerAsset(projectId);
	const entered = blockNextPut();
	const writer = uploadAsset(projectId, asset.id);
	await assertWriterFenced(projectId, saved.json().savedBaseToken, writer, entered);
});

test('model staging upload is aborted by a committed delete lease revocation', async () => {
	const projectId = track();
	const saved = await save(projectId, ownerCookie, 'Model upload lease');
	const source = validGlb(3);
	const derivative = validGlb(4);
	const imported = await stageModel(projectId, [
		{ role: 'source', path: 'source.glb', bytes: source },
		{ role: 'derivative', path: 'derivative.glb', bytes: derivative }
	]);
	const file = imported.files.find((entry) => entry.path === 'source.glb');
	const entered = blockNextPut();
	const writer = uploadModelFile(projectId, imported, 'source.glb', source);
	await assertWriterFenced(projectId, saved.json().savedBaseToken, writer, entered, async () => {
		const row = await pool.query(
			'SELECT upload_state FROM model_import_files WHERE import_id = $1::uuid AND file_id = $2::uuid',
			[imported.importId, file.fileId]
		);
		assert.equal(row.rows[0].upload_state, 'failed');
	});
});

test('model approval revision writes are aborted by a committed delete lease revocation', async () => {
	const projectId = track();
	const saved = await save(projectId, ownerCookie, 'Model approval lease');
	const source = validGlb(5);
	const derivative = validGlb(6);
	const imported = await stageModel(projectId, [
		{ role: 'source', path: 'source.glb', bytes: source },
		{ role: 'derivative', path: 'derivative.glb', bytes: derivative }
	]);
	for (const file of [{ path: 'source.glb', bytes: source }, { path: 'derivative.glb', bytes: derivative }]) {
		const uploaded = await uploadModelFile(projectId, imported, file.path, file.bytes);
		assert.equal(uploaded.statusCode, 200, JSON.stringify(uploaded.json()));
	}
	const entered = blockNextPut();
	const writer = approve(projectId, imported.importId);
	await assertWriterFenced(projectId, saved.json().savedBaseToken, writer, entered);
	const revisions = await pool.query('SELECT count(*)::int AS count FROM model_revisions WHERE project_id = $1', [projectId]);
	assert.equal(revisions.rows[0].count, 0);
});

test('a live writer is stopped at its fixed lease deadline without delete traffic', async () => {
	const projectId = track();
	const saved = await save(projectId, ownerCookie, 'Deadline lease');
	const asset = await registerAsset(projectId);
	const entered = blockNextPut();
	const startedAt = Date.now();
	const writer = uploadAsset(projectId, asset.id);
	await entered;
	const response = await writer;
	assert.equal(response.statusCode, 409, JSON.stringify(response.json()));
	assert.equal(response.json().error.code, 'project-busy');
	assert.ok(Date.now() - startedAt < POLICY.leaseDeadlineMs + 500, 'the local abort timer must stop a held PutObject before lease expiry');
	storeOptions.onPut = undefined;
	const lease = await pool.query(
		'SELECT released_at FROM project_write_leases WHERE project_id = $1 ORDER BY started_at DESC LIMIT 1',
		[projectId]
	);
	assert.ok(lease.rows[0].released_at);
	const deleted = await removeProject(projectId, saved.json().savedBaseToken);
	assert.equal(deleted.statusCode, 202, JSON.stringify(deleted.json()));
});

test('cleanup resumes from the durable tombstone and inventory in fresh cleanup processes after API shutdown', async () => {
	const projectId = track();
	const storeDirectory = await mkdtemp(join(tmpdir(), 'p04s01-restart-store-'));
	const restartPool = new Pool({ connectionString: DATABASE_URL, application_name: 'p04s01-restart-api-process' });
	let restartApp;
	let childResults = [];
	try {
		const fileStore = persistentObjectStore(storeDirectory);
		restartApp = createApp({
			pool: restartPool,
			objectStore: fileStore,
			objectNamespace: OBJECT_NAMESPACE,
			sessionKey: SESSION_KEY,
			projectLifecyclePolicy: { ...POLICY, clock: () => new Date(fakeNow) },
			logger: false
		});
		const saved = await save(projectId, ownerCookie, 'Restart cleanup', restartApp);
		assert.equal(saved.statusCode, 200, JSON.stringify(saved.json()));
		const asset = await registerAsset(projectId, ownerCookie, restartApp);
		const upload = await uploadAsset(projectId, asset.id, restartApp);
		assert.equal(upload.statusCode, 200, JSON.stringify(upload.json()));
		const actualAssetKey = (await pool.query('SELECT object_key FROM assets WHERE id = $1::uuid', [asset.id])).rows[0].object_key;
		assert.deepEqual(await fileStore.list(), [actualAssetKey]);

		await writeFile(join(storeDirectory, 'block-deletes'), 'blocked until the API process exits');
		fakeNow = new Date();
		const deleted = await removeProject(projectId, saved.json().savedBaseToken, ownerCookie, restartApp);
		assert.equal(deleted.statusCode, 202, JSON.stringify(deleted.json()));
		assert.equal(deleted.json().cleanup, 'pending');
		const durable = await restartPool.query(
			'SELECT status, key_inventory, fenced_at, cleanup_bound_ms, first_empty_at FROM project_deletions WHERE project_id = $1',
			[projectId]
		);
		assert.equal(durable.rows[0].status, 'pending');
		assert.deepEqual(durable.rows[0].key_inventory, [actualAssetKey]);
		assert.equal(durable.rows[0].first_empty_at, null);
		assert.deepEqual(await fileStore.list(), [actualAssetKey], 'the failed in-process delete leaves persistent bytes for recovery');

		await restartApp.close();
		restartApp = undefined;
		await rm(join(storeDirectory, 'block-deletes'), { force: true });

		const fencedAt = new Date(durable.rows[0].fenced_at).getTime();
		const bound = Number(durable.rows[0].cleanup_bound_ms);
		childResults.push(await runCleanupChild({ projectId, storeDirectory, nowMs: fencedAt + bound - 1 }));
		childResults.push(await runCleanupChild({ projectId, storeDirectory, nowMs: fencedAt + bound }));
		const firstEmptyAt = new Date(childResults[1].tombstone.first_empty_at).getTime();
		childResults.push(await runCleanupChild({ projectId, storeDirectory, nowMs: firstEmptyAt + bound - 1 }));
		childResults.push(await runCleanupChild({ projectId, storeDirectory, nowMs: firstEmptyAt + bound }));
		childResults.push(await runCleanupChild({ projectId, storeDirectory, nowMs: firstEmptyAt + bound, verifyCompleted: true }));

		assert.deepEqual(childResults.map((result) => result.cleanup.status), ['pending', 'pending', 'pending', 'complete', 'complete']);
		assert.deepEqual(childResults.map((result) => result.tombstone.status), ['pending', 'pending', 'pending', 'complete', 'complete']);
		assert.equal(childResults[0].cleanup.deletedKeys.includes(actualAssetKey), true);
		assert.deepEqual(childResults[0].remainingKeys, []);
		assert.equal(childResults[1].tombstone.first_empty_at, new Date(fencedAt + bound).toISOString());
		assert.equal(childResults[2].cleanup.status, 'pending', 'the second empty proof cannot precede the persisted bound');
		assert.equal(childResults[4].includeCompleted, true, 'the completed tombstone was selected by the owner verification mode');
		assert.equal(new Set(childResults.map((result) => result.pid)).size, childResults.length, 'each retry ran in a distinct fresh process');
		assert.ok(childResults.every((result) => result.pid !== process.pid), 'retries ran outside the API test process');
		assert.deepEqual(childResults[4].remainingKeys, []);
	} finally {
		if (restartApp) await restartApp.close().catch(() => undefined);
		await restartPool.end().catch(() => undefined);
		await rm(storeDirectory, { recursive: true, force: true });
	}
});

test('a hostile delayed remote commit is found after completion and forces a spaced re-proof', async () => {
	const projectId = track();
	const events = [];
	let remoteWrite;
	let enteredResolve;
	const entered = new Promise((resolveEntered) => { enteredResolve = resolveEntered; });
	const hostileStore = {
		async put(key, body, metadata) {
			if (!remoteWrite?.expectedAssetSegment || !key.includes(remoteWrite.expectedAssetSegment)) return store.put(key, body, metadata);
			if (metadata.signal.aborted) throw metadata.signal.reason;
			const chunks = [];
			for await (const chunk of body) chunks.push(Buffer.from(chunk));
			remoteWrite = { ...remoteWrite, key, bytes: Buffer.concat(chunks), clientSignal: metadata.signal, state: 'client-waiting' };
			events.push('remote-write-registered-in-flight');
			enteredResolve();
			await new Promise((resolveWrite, rejectWrite) => {
				const abort = () => {
					remoteWrite.state = 'client-aborted-remote-commit-still-pending';
					events.push('client-put-aborted');
					rejectWrite(metadata.signal.reason);
				};
				if (metadata.signal.aborted) abort();
				else metadata.signal.addEventListener('abort', abort, { once: true });
			});
		},
		get: (...args) => store.get(...args),
		async delete(key, signal) {
			await store.delete(key, signal);
		},
		async list(signal) {
			return store.list(signal);
		}
	};
	const hostilePool = new Pool({ connectionString: DATABASE_URL, application_name: 'p04s01-hostile-late-commit' });
	const hostileApp = createApp({
		pool: hostilePool,
		objectStore: hostileStore,
		objectNamespace: OBJECT_NAMESPACE,
		sessionKey: SESSION_KEY,
		projectLifecyclePolicy: { ...POLICY, clock: () => new Date(fakeNow) },
		logger: false
	});
	try {
		const saved = await save(projectId, ownerCookie, 'Hostile late commit', hostileApp);
		assert.equal(saved.statusCode, 200, JSON.stringify(saved.json()));
		const asset = await registerAsset(projectId, ownerCookie, hostileApp);
		remoteWrite = { expectedAssetSegment: `/${asset.id}/`, state: 'not-started' };
		fakeNow = new Date();
		const startedAt = Date.now();
		const writer = uploadAsset(projectId, asset.id, hostileApp);
		await within(entered, 2_000, 'hostile remote PUT never entered the in-flight state');
		const actualAssetKey = remoteWrite.key;
		assert.ok(remoteWrite.bytes.length > 0, 'fake remote commit owns the complete request bytes before its response is held');
		const busy = await removeProject(projectId, saved.json().savedBaseToken, ownerCookie, hostileApp);
		assert.equal(busy.statusCode, 409, JSON.stringify(busy.json()));
		assert.equal(busy.json().error.code, 'project-busy');
		events.push('committed-lease-revocation-refused-delete');
		const abortedWriter = await within(writer, 2_000, 'the client PUT did not abort after the committed revocation');
		assert.equal(abortedWriter.statusCode, 409, JSON.stringify(abortedWriter.json()));
		assert.equal(abortedWriter.json().error.code, 'project-busy');
		assert.ok(Date.now() - startedAt < POLICY.leaseDeadlineMs, 'the conforming handler aborts and releases before its lease deadline');
		assert.equal(remoteWrite.clientSignal.aborted, true);
		assert.equal(remoteWrite.state, 'client-aborted-remote-commit-still-pending');
		await waitForLeaseRelease(projectId);
		const lease = await pool.query(
			'SELECT revoked_at, released_at FROM project_write_leases WHERE project_id = $1 ORDER BY started_at DESC LIMIT 1',
			[projectId]
		);
		assert.ok(lease.rows[0].revoked_at);
		assert.ok(lease.rows[0].released_at);
		events.push('conforming-handler-released-lease');

		const deleted = await removeProject(projectId, saved.json().savedBaseToken, ownerCookie, hostileApp);
		assert.equal(deleted.statusCode, 202, JSON.stringify(deleted.json()));
		const tombstone = await pool.query(
			'SELECT status, key_inventory, fenced_at, cleanup_bound_ms, first_empty_at FROM project_deletions WHERE project_id = $1',
			[projectId]
		);
		assert.equal(tombstone.rows[0].status, 'pending');
		assert.ok(tombstone.rows[0].key_inventory.includes(actualAssetKey));
		assert.equal(tombstone.rows[0].first_empty_at, null);
		assert.equal(store.objects.has(actualAssetKey), false, 'client compensation and the first cleanup attempt see no committed remote object');
		const fencedAt = new Date(tombstone.rows[0].fenced_at).getTime();
		const bound = Number(tombstone.rows[0].cleanup_bound_ms);
		const cleanupObservations = [{ at: fakeNow.getTime(), status: 'pending', proof: 'delete-handler listing before bound' }];

		fakeNow = new Date(fencedAt + bound - 1);
		const beforeBound = await runProjectDeletionCleanup(pool, hostileStore, projectId, { ...POLICY, clock: () => new Date(fakeNow) });
		assert.equal(beforeBound.status, 'pending');
		cleanupObservations.push({ at: fakeNow.getTime(), status: beforeBound.status, proof: 'one millisecond before fence bound' });

		fakeNow = new Date(fencedAt + bound);
		const firstEmpty = await runProjectDeletionCleanup(pool, hostileStore, projectId, { ...POLICY, clock: () => new Date(fakeNow) });
		assert.equal(firstEmpty.status, 'pending');
		const afterFirstEmpty = await pool.query('SELECT first_empty_at FROM project_deletions WHERE project_id = $1', [projectId]);
		assert.equal(new Date(afterFirstEmpty.rows[0].first_empty_at).getTime(), fakeNow.getTime());
		cleanupObservations.push({ at: fakeNow.getTime(), status: firstEmpty.status, proof: 'first scoped empty listing at bound' });

		fakeNow = new Date(fakeNow.getTime() + bound - 1);
		const tooSoon = await runProjectDeletionCleanup(pool, hostileStore, projectId, { ...POLICY, clock: () => new Date(fakeNow) });
		assert.equal(tooSoon.status, 'pending');
		cleanupObservations.push({ at: fakeNow.getTime(), status: tooSoon.status, proof: 'one millisecond before spacing bound' });

		fakeNow = new Date(fakeNow.getTime() + 1);
		const complete = await runProjectDeletionCleanup(pool, hostileStore, projectId, { ...POLICY, clock: () => new Date(fakeNow) });
		assert.equal(complete.status, 'complete');
		cleanupObservations.push({ at: fakeNow.getTime(), status: complete.status, proof: 'second scoped empty listing at bound' });
		events.push('cleanup-completed-before-hostile-commit');

		store.objects.set(remoteWrite.key, { bytes: remoteWrite.bytes, options: { hostileLateCommit: true } });
		remoteWrite.state = 'committed-after-cleanup-complete';
		events.push('hostile-remote-commit-after-client-abort-and-completion');
		const repaired = await runProjectDeletionCleanup(pool, hostileStore, projectId, { ...POLICY, clock: () => new Date(fakeNow) });
		assert.equal(repaired.status, 'pending');
		assert.deepEqual(repaired.repairedLateKeys, [actualAssetKey]);
		assert.equal(store.objects.has(actualAssetKey), false);
		events.push('completed-record-verification-reported-and-removed-late-key');
		const secondFirstEmpty = await runProjectDeletionCleanup(pool, hostileStore, projectId, { ...POLICY, clock: () => new Date(fakeNow) });
		assert.equal(secondFirstEmpty.status, 'pending');
		const reproof = await pool.query('SELECT first_empty_at FROM project_deletions WHERE project_id = $1', [projectId]);
		const reproofStart = new Date(reproof.rows[0].first_empty_at).getTime();
		fakeNow = new Date(reproofStart + bound - 1);
		const reproofTooSoon = await runProjectDeletionCleanup(pool, hostileStore, projectId, { ...POLICY, clock: () => new Date(fakeNow) });
		assert.equal(reproofTooSoon.status, 'pending');
		fakeNow = new Date(reproofStart + bound);
		const reproved = await runProjectDeletionCleanup(pool, hostileStore, projectId, { ...POLICY, clock: () => new Date(fakeNow) });
		assert.equal(reproved.status, 'complete');
		const repeated = await runProjectDeletionCleanup(pool, hostileStore, projectId, { ...POLICY, clock: () => new Date(fakeNow) });
		assert.equal(repeated.status, 'complete');
		events.push('pending-reproved-complete-after-spaced-empty-listings');

		assert.deepEqual(cleanupObservations.map((item) => item.status), ['pending', 'pending', 'pending', 'pending', 'complete']);
		for (const event of [
			'remote-write-registered-in-flight',
			'client-put-aborted',
			'committed-lease-revocation-refused-delete',
			'conforming-handler-released-lease',
			'cleanup-completed-before-hostile-commit',
			'hostile-remote-commit-after-client-abort-and-completion',
			'completed-record-verification-reported-and-removed-late-key',
			'pending-reproved-complete-after-spaced-empty-listings'
		]) assert.ok(events.includes(event), `expected event: ${event}`);
	} finally {
		await hostileApp.close();
	}
});

test('cleanup completion retains no in-memory requirement across repeated owner verification', async () => {
	const projectId = track();
	const saved = await save(projectId, ownerCookie, 'Repeat completed cleanup');
	assert.equal(saved.statusCode, 200, JSON.stringify(saved.json()));
	const asset = await registerAsset(projectId);
	assert.equal((await uploadAsset(projectId, asset.id)).statusCode, 200);
	const actualAssetKey = (await pool.query('SELECT object_key FROM assets WHERE id = $1::uuid', [asset.id])).rows[0].object_key;
	fakeNow = new Date();
	assert.equal((await removeProject(projectId, saved.json().savedBaseToken)).statusCode, 202);
	const record = await pool.query('SELECT fenced_at, cleanup_bound_ms, first_empty_at FROM project_deletions WHERE project_id = $1', [projectId]);
	const fencedAt = new Date(record.rows[0].fenced_at).getTime();
	const bound = Number(record.rows[0].cleanup_bound_ms);
	fakeNow = new Date(fencedAt + bound);
	assert.equal((await runProjectDeletionCleanup(pool, store, projectId, { ...POLICY, clock: () => new Date(fakeNow) })).status, 'pending');
	fakeNow = new Date(fakeNow.getTime() + bound);
	assert.equal((await runProjectDeletionCleanup(pool, store, projectId, { ...POLICY, clock: () => new Date(fakeNow) })).status, 'complete');
	const verify1 = await runProjectDeletionCleanup(pool, store, projectId, { ...POLICY, clock: () => new Date(fakeNow) });
	const verify2 = await runProjectDeletionCleanup(pool, store, projectId, { ...POLICY, clock: () => new Date(fakeNow) });
	assert.deepEqual([verify1.status, verify2.status], ['complete', 'complete']);
	assert.equal(store.objects.has(actualAssetKey), false);
});
