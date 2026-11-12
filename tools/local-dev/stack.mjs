/**
 * Identity, persisted state and child environment for the local Biskiq stack.
 *
 * Every checkout gets its own Compose project, ports, volumes, database
 * password, object-storage credentials, object-key namespace, S3 bucket and
 * session key. The values are derived from the absolute worktree path and
 * persisted in `.local/dev-stack.json`, so two worktrees can run at once and a
 * restart reuses the same data.
 *
 * This module is deliberately free of process side effects: the CLI in
 * `dev-local.mjs` owns spawning, locking and signal handling.
 */
import { createHash, randomBytes } from 'node:crypto';
import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import net from 'node:net';

export const LOCAL_DIRECTORY = '.local';
export const STATE_FILENAME = 'dev-stack.json';
export const LOCK_FILENAME = 'dev-stack.lock';
export const CHILDREN_FILENAME = 'dev-children.json';

const STATE_VERSION = 1;
const PORT_RANGE_START = 41_000;
const PORT_RANGE_SPAN = 12_000;
const PORT_SEARCH_LIMIT = 1_000;

/**
 * Production values that must never reach a local child process. `.env` is not
 * read by `dev:local`, but the invoking shell may have exported values for a
 * deployed environment; the prefix sweep removes those too.
 */
const INHERITED_KEYS = [
	'API_ORIGIN',
	'DATABASE_URL',
	'EDITOR_ORIGIN',
	'E2E_TEST_AUTH_SECRET',
	'LOCAL_OBJECT_STORE',
	'NODE_ENV',
	'PORT',
	'PUBLIC_API_ORIGIN',
	'RENDER_EXTERNAL_URL',
	'SESSION_KEY',
	'TRUST_PROXY'
];
const INHERITED_PREFIXES = ['R2_', 'BISKIQ_'];

export function stateDirectory(repoRoot) {
	return join(resolve(repoRoot), LOCAL_DIRECTORY);
}

export function statePath(repoRoot) {
	return join(stateDirectory(repoRoot), STATE_FILENAME);
}

export function lockPath(repoRoot) {
	return join(stateDirectory(repoRoot), LOCK_FILENAME);
}

export function childrenPath(repoRoot) {
	return join(stateDirectory(repoRoot), CHILDREN_FILENAME);
}

/**
 * Deterministic identity for one worktree. The short hash is the only variable
 * part, which keeps Compose names valid and volume names stable.
 */
export function stackIdentity(repoRoot) {
	const worktree = resolve(repoRoot);
	const hash = createHash('sha256').update(worktree).digest('hex').slice(0, 8);
	return {
		worktree,
		hash,
		stack: `biskiq-dev-${hash}`,
		namespace: `local-${hash}`,
		bucket: `biskiq-${hash}-assets`
	};
}

/** A spread-out preferred port block, made collision-free by the allocator. */
export function preferredPorts(hash) {
	const base = PORT_RANGE_START + (Number.parseInt(hash.slice(0, 4), 16) % PORT_RANGE_SPAN);
	return {
		db: base,
		storage: base + 1,
		api: base + 2,
		editor: base + 3
	};
}

export function createState(identity, ports) {
	return {
		version: STATE_VERSION,
		worktree: identity.worktree,
		stack: identity.stack,
		namespace: identity.namespace,
		bucket: identity.bucket,
		ports: { ...ports },
		credentials: {
			dbPassword: randomBytes(24).toString('hex'),
			s3AccessKeyId: randomBytes(16).toString('hex'),
			s3SecretAccessKey: randomBytes(32).toString('hex'),
			sessionKey: randomBytes(32).toString('base64')
		},
		createdAt: new Date().toISOString()
	};
}

export function validateState(state, identity) {
	if (!state || typeof state !== 'object' || Array.isArray(state)) {
		throw new Error('Local stack state is malformed');
	}
	if (state.version !== STATE_VERSION) {
		throw new Error(`Local stack state version ${String(state.version)} is not supported`);
	}
	if (state.worktree !== identity.worktree) {
		throw new Error(`Local stack state belongs to ${String(state.worktree)}, not ${identity.worktree}`);
	}
	for (const key of ['stack', 'namespace', 'bucket']) {
		if (state[key] !== identity[key]) {
			throw new Error(`Local stack state has a stale ${key}`);
		}
	}
	const ports = state.ports;
	if (!ports || typeof ports !== 'object') throw new Error('Local stack state has no ports');
	const values = [];
	for (const name of ['db', 'storage', 'api', 'editor']) {
		const port = ports[name];
		if (!Number.isInteger(port) || port < 1 || port > 65_535) {
			throw new Error(`Local stack state has an invalid ${name} port`);
		}
		values.push(port);
	}
	if (new Set(values).size !== values.length) {
		throw new Error('Local stack state reuses a port');
	}
	const credentials = state.credentials;
	if (!credentials || typeof credentials !== 'object') {
		throw new Error('Local stack state has no credentials');
	}
	for (const key of ['dbPassword', 's3AccessKeyId', 's3SecretAccessKey', 'sessionKey']) {
		if (typeof credentials[key] !== 'string' || credentials[key].length < 16) {
			throw new Error(`Local stack state has an invalid ${key}`);
		}
	}
	if (Buffer.from(credentials.sessionKey, 'base64').length !== 32) {
		throw new Error('Local stack state has an invalid session key');
	}
	return state;
}

/**
 * Decide whether persisted state may authorize cleanup for this worktree.
 *
 * A missing state is safe: cleanup targets the identity derived from the
 * current absolute path. A state that fails validation is never returned for a
 * caller to use as a Docker project; the mismatch is exposed instead.
 */
export function authorizeCleanupState(rawState, identity) {
	if (rawState === null || rawState === undefined) {
		return { state: null, mismatch: null };
	}
	try {
		validateState(rawState, identity);
		return { state: rawState, mismatch: null };
	} catch (error) {
		return {
			state: null,
			mismatch: error instanceof Error ? error.message : 'Local stack state is invalid'
		};
	}
}

export async function readState(repoRoot) {
	try {
		const text = await readFile(statePath(repoRoot), 'utf8');
		return JSON.parse(text);
	} catch (error) {
		if (error && typeof error === 'object' && error.code === 'ENOENT') return null;
		throw new Error('Local stack state is unreadable; run npm run dev:local:reset to rebuild it');
	}
}

export async function writeState(repoRoot, state) {
	const path = statePath(repoRoot);
	await mkdir(stateDirectory(repoRoot), { recursive: true });
	await writeFile(path, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
	await chmod(path, 0o600);
}

export function databaseUrl(state) {
	return `postgresql://biskiq:${encodeURIComponent(state.credentials.dbPassword)}@127.0.0.1:${state.ports.db}/biskiq`;
}

/**
 * The environment for API, migration and editor processes. Every inherited
 * production-capable value is removed first, then the loopback values are set.
 * `LOCAL_OBJECT_STORE=1` is what lets the API accept the local HTTP endpoint.
 */
export function buildStackEnv(state, baseEnv = process.env) {
	const env = { ...baseEnv };
	for (const key of Object.keys(env)) {
		if (INHERITED_PREFIXES.some((prefix) => key.startsWith(prefix))) delete env[key];
	}
	for (const key of INHERITED_KEYS) delete env[key];

	return Object.assign(env, {
		NODE_ENV: 'development',
		DATABASE_URL: databaseUrl(state),
		PORT: String(state.ports.api),
		API_ORIGIN: `http://localhost:${state.ports.api}`,
		EDITOR_ORIGIN: `http://localhost:${state.ports.editor}`,
		PUBLIC_API_ORIGIN: `http://localhost:${state.ports.api}`,
		SESSION_KEY: state.credentials.sessionKey,
		R2_ENDPOINT: `http://127.0.0.1:${state.ports.storage}`,
		R2_BUCKET: state.bucket,
		R2_OBJECT_NAMESPACE: state.namespace,
		R2_ACCESS_KEY_ID: state.credentials.s3AccessKeyId,
		R2_SECRET_ACCESS_KEY: state.credentials.s3SecretAccessKey,
		LOCAL_OBJECT_STORE: '1'
	});
}

/** Values Compose interpolates. Kept separate so no secret reaches a file. */
export function buildComposeEnv(state, baseEnv = process.env) {
	const env = { ...baseEnv };
	for (const key of Object.keys(env)) {
		if (INHERITED_PREFIXES.some((prefix) => key.startsWith(prefix))) delete env[key];
	}
	return Object.assign(env, {
		BISKIQ_LOCAL_STACK: state.stack,
		BISKIQ_LOCAL_DB_PORT: String(state.ports.db),
		BISKIQ_LOCAL_STORAGE_PORT: String(state.ports.storage),
		BISKIQ_LOCAL_DB_PASSWORD: state.credentials.dbPassword,
		BISKIQ_LOCAL_S3_ACCESS_KEY: state.credentials.s3AccessKeyId,
		BISKIQ_LOCAL_S3_SECRET_KEY: state.credentials.s3SecretAccessKey,
		BISKIQ_LOCAL_S3_BUCKET: state.bucket
	});
}

export function isPortAvailable(port, host = '127.0.0.1') {
	return new Promise((resolvePort) => {
		const server = net.createServer();
		server.unref();
		server.once('error', () => resolvePort(false));
		server.listen({ port, host, exclusive: true }, () => {
			server.close(() => resolvePort(true));
		});
	});
}

export async function findAvailablePort(
	preferred,
	used = new Set(),
	isFree = isPortAvailable
) {
	for (let port = preferred; port <= 65_535; port++) {
		if (used.has(port)) continue;
		if (await isFree(port)) return port;
		if (port - preferred > PORT_SEARCH_LIMIT) break;
	}
	throw new Error(`No free port is available near ${preferred}`);
}

export async function allocatePorts(preferred, isFree = isPortAvailable) {
	const used = new Set();
	const ports = {};
	for (const [name, start] of Object.entries(preferred)) {
		const port = await findAvailablePort(start, used, isFree);
		ports[name] = port;
		used.add(port);
	}
	return ports;
}
