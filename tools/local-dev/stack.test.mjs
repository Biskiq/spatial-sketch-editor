/**
 * Local stack identity and environment contract.
 *
 * These are pure checks: no Docker, database or network is touched. They pin the
 * isolation that makes parallel worktrees safe and the value sweep that keeps a
 * developer's deployed R2/database configuration out of a local child process.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import { removeProjectVolumes, stopProjectContainers } from './docker.mjs';
import {
	allocatePorts,
	authorizeCleanupState,
	buildComposeEnv,
	buildStackEnv,
	createState,
	preferredPorts,
	stackIdentity,
	validateState
} from './stack.mjs';

test('identity is stable per worktree and distinct between worktrees', () => {
	const first = stackIdentity('/tmp/worktrees/alpha');
	const again = stackIdentity('/tmp/worktrees/alpha/');
	const second = stackIdentity('/tmp/worktrees/beta');

	assert.deepEqual(first, again);
	assert.notEqual(first.hash, second.hash);
	assert.notEqual(first.stack, second.stack);
	assert.notEqual(first.namespace, second.namespace);
	assert.notEqual(first.bucket, second.bucket);
	assert.match(first.stack, /^biskiq-dev-[0-9a-f]{8}$/);
	assert.match(first.namespace, /^local-[0-9a-f]{8}$/);
	assert.match(first.bucket, /^biskiq-[0-9a-f]{8}-assets$/);
});

test('preferred ports are unique and live in the worktree port block', () => {
	const { hash } = stackIdentity('/tmp/worktrees/alpha');
	const ports = preferredPorts(hash);
	const values = Object.values(ports);
	assert.equal(new Set(values).size, values.length);
	for (const port of values) {
		assert.ok(Number.isInteger(port) && port > 40_999 && port < 54_000, String(port));
	}
});

test('the allocator skips used and occupied ports and keeps all four distinct', async () => {
	const ports = await allocatePorts(
		{ db: 50_000, storage: 50_001, api: 50_002, editor: 50_003 },
		async (port) => port !== 50_001 && port !== 50_004
	);
	assert.deepEqual(ports, { db: 50_000, storage: 50_002, api: 50_003, editor: 50_005 });
});

test('state validation rejects another worktree, stale identity and duplicate ports', () => {
	const identity = stackIdentity('/tmp/worktrees/alpha');
	const state = createState(identity, { db: 50_000, storage: 50_001, api: 50_002, editor: 50_003 });
	validateState(state, identity);

	assert.throws(
		() => validateState({ ...state, worktree: '/tmp/worktrees/beta' }, identity),
		/belongs to/
	);
	assert.throws(() => validateState({ ...state, stack: 'biskiq-dev-deadbeef' }, identity), /stale stack/);
	assert.throws(
		() => validateState({ ...state, ports: { ...state.ports, editor: state.ports.api } }, identity),
		/reuses a port/
	);
	assert.throws(
		() =>
			validateState(
				{ ...state, credentials: { ...state.credentials, sessionKey: 'short' } },
				identity
			),
		/invalid sessionKey|invalid session key/
	);
});

test('cleanup never trusts another worktree state and refuses a mismatched reset target', () => {
	const identity = stackIdentity('/tmp/worktrees/alpha');
	const ports = { db: 50_000, storage: 50_001, api: 50_002, editor: 50_003 };
	const own = createState(identity, ports);
	const foreign = createState(stackIdentity('/tmp/worktrees/beta'), ports);

	assert.equal(authorizeCleanupState(null, identity).state, null);
	assert.equal(authorizeCleanupState(own, identity).state, own);

	const denied = authorizeCleanupState(foreign, identity);
	assert.equal(denied.state, null);
	assert.match(denied.mismatch, /belongs to/);
	assert.doesNotMatch(denied.mismatch, /biskiq-dev-/);
});

test('cleanup reports a Docker failure instead of treating the stack as gone', () => {
	const calls = [];
	const run = (args) => {
		calls.push(args);
		if (args[0] === 'volume' && args[1] === 'ls') {
			return { status: 0, stdout: 'local_pgdata\nlocal_s3data\n' };
		}
		if (args[0] === 'volume' && args[1] === 'rm') {
			return { status: 1, stderr: 'volume is in use' };
		}
		return { status: 0, stdout: '' };
	};

	assert.throws(() => removeProjectVolumes('local', run), /docker volume rm failed.*in use/);
	assert.deepEqual(calls, [
		['volume', 'ls', '-q'],
		['volume', 'rm', 'local_pgdata', 'local_s3data']
	]);
});

test('container stop failure is reported rather than logged as a clean stop', () => {
	const run = (args) =>
		args[0] === 'ps'
			? { status: 0, stdout: 'container-id\n' }
			: { status: 1, stderr: 'cannot stop container' };

	assert.throws(() => stopProjectContainers('local', run), /docker stop failed.*cannot stop/);
});

test('stack environment replaces inherited production values with loopback ones', () => {
	const identity = stackIdentity('/tmp/worktrees/alpha');
	const state = createState(identity, { db: 50_000, storage: 50_001, api: 50_002, editor: 50_003 });
	const env = buildStackEnv(state, {
		PATH: '/bin',
		HOME: '/tmp',
		NODE_ENV: 'production',
		DATABASE_URL: 'postgresql://prod.example/db',
		SESSION_KEY: 'production-session',
		E2E_TEST_AUTH_SECRET: 'production-test-secret',
		PUBLIC_API_ORIGIN: 'https://editor.example',
		API_ORIGIN: 'https://api.example',
		EDITOR_ORIGIN: 'https://editor.example',
		RENDER_EXTERNAL_URL: 'https://render.example',
		R2_ENDPOINT: 'https://account.r2.cloudflarestorage.com',
		R2_BUCKET: 'production-bucket',
		R2_OBJECT_NAMESPACE: 'production',
		R2_ACCESS_KEY_ID: 'production-key',
		R2_SECRET_ACCESS_KEY: 'production-secret',
		BISKIQ_STACK: 'production-stack',
		TRUST_PROXY: '10.0.0.0/8'
	});

	assert.equal(env.PATH, '/bin');
	assert.equal(env.HOME, '/tmp');
	assert.equal(env.NODE_ENV, 'development');
	assert.equal(env.DATABASE_URL, `postgresql://biskiq:${state.credentials.dbPassword}@127.0.0.1:50000/biskiq`);
	assert.equal(env.PORT, '50002');
	assert.equal(env.API_ORIGIN, 'http://localhost:50002');
	assert.equal(env.EDITOR_ORIGIN, 'http://localhost:50003');
	assert.equal(env.PUBLIC_API_ORIGIN, 'http://localhost:50002');
	assert.equal(env.SESSION_KEY, state.credentials.sessionKey);
	assert.equal(env.R2_ENDPOINT, 'http://127.0.0.1:50001');
	assert.equal(env.R2_BUCKET, state.bucket);
	assert.equal(env.R2_OBJECT_NAMESPACE, state.namespace);
	assert.equal(env.R2_ACCESS_KEY_ID, state.credentials.s3AccessKeyId);
	assert.equal(env.R2_SECRET_ACCESS_KEY, state.credentials.s3SecretAccessKey);
	assert.equal(env.LOCAL_OBJECT_STORE, '1');
	assert.equal('E2E_TEST_AUTH_SECRET' in env, false);
	assert.equal('RENDER_EXTERNAL_URL' in env, false);
	assert.equal('BISKIQ_STACK' in env, false);
	assert.equal('TRUST_PROXY' in env, false);
});

test('compose environment carries the worktree stack, ports and credentials only', () => {
	const identity = stackIdentity('/tmp/worktrees/alpha');
	const state = createState(identity, { db: 50_000, storage: 50_001, api: 50_002, editor: 50_003 });
	const env = buildComposeEnv(state, {
		PATH: '/bin',
		R2_SECRET_ACCESS_KEY: 'production-secret',
		BISKIQ_STACK: 'production-stack'
	});
	assert.equal(env.BISKIQ_LOCAL_STACK, state.stack);
	assert.equal(env.BISKIQ_LOCAL_DB_PORT, '50000');
	assert.equal(env.BISKIQ_LOCAL_STORAGE_PORT, '50001');
	assert.equal(env.BISKIQ_LOCAL_DB_PASSWORD, state.credentials.dbPassword);
	assert.equal(env.BISKIQ_LOCAL_S3_ACCESS_KEY, state.credentials.s3AccessKeyId);
	assert.equal(env.BISKIQ_LOCAL_S3_SECRET_KEY, state.credentials.s3SecretAccessKey);
	assert.equal(env.BISKIQ_LOCAL_S3_BUCKET, state.bucket);
	assert.equal('R2_SECRET_ACCESS_KEY' in env, false);
	assert.equal('BISKIQ_STACK' in env, false);
});
