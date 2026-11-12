#!/usr/bin/env node
/**
 * One-command local Biskiq stack.
 *
 *   npm run dev:local        start PostgreSQL + SeaweedFS, migrate, initialize
 *                            the bucket, then run the API and Vite in the
 *                            foreground with hot reload
 *   npm run dev:local:stop   stop services and keep both data volumes
 *   npm run dev:local:reset  stop and delete both data volumes and local state
 *   npm run dev:local:status show container/process readiness
 *
 * The stack is per worktree: identity, ports, credentials and object namespace
 * live in `.local/dev-stack.json`, and Compose names/volumes carry the same
 * short worktree hash. Ctrl+C stops the API, the editor and the containers; it
 * never deletes data.
 */
import { spawn, spawnSync } from 'node:child_process';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

import { removeProjectContainers, removeProjectVolumes, stopProjectContainers } from './docker.mjs';
import {
	allocatePorts,
	authorizeCleanupState,
	buildComposeEnv,
	buildStackEnv,
	childrenPath,
	createState,
	DEFAULT_EDITOR_PORT,
	findAvailablePort,
	isPortAvailable,
	lockPath,
	preferredPorts,
	readState,
	stackIdentity,
	stateDirectory,
	statePath,
	validateState,
	writeState
} from './stack.mjs';

const REPO_ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const COMPOSE_FILE = resolve(REPO_ROOT, 'docker-compose.local.yml');
const NPM = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const SIGNALS = ['SIGINT', 'SIGTERM'];
const STARTUP_TIMEOUT_MS = 90_000;

const childRecords = [];
let shuttingDown = false;
let interrupted = null;
let superviseFinish = null;
let signalHandlers = [];

function log(message) {
	console.log(`[local] ${message}`);
}

function sleep(ms) {
	return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

function run(command, args, { env = process.env, allowFailure = false, stdio = 'inherit' } = {}) {
	const result = spawnSync(command, args, { cwd: REPO_ROOT, env, stdio });
	if (result.error) throw new Error(`${command} could not run: ${result.error.message}`);
	if (!allowFailure && result.status !== 0) {
		throw new Error(`${command} ${args.join(' ')} exited with ${String(result.status)}`);
	}
	return result;
}

function dockerComposeArgs(state, args) {
	return ['compose', '-p', state.stack, '-f', COMPOSE_FILE, ...args];
}

function compose(state, args, options = {}) {
	return run('docker', dockerComposeArgs(state, args), {
		env: buildComposeEnv(state),
		allowFailure: options.allowFailure ?? false
	});
}

function assertDocker() {
	const composeVersion = spawnSync('docker', ['compose', 'version'], { stdio: 'ignore' });
	if (composeVersion.status !== 0) {
		throw new Error('Docker with Compose v2 is required. Install Docker Desktop, then rerun npm run dev:local.');
	}
	const daemon = spawnSync('docker', ['info', '--format', '{{.ServerVersion}}'], { stdio: 'ignore' });
	if (daemon.status !== 0) {
		throw new Error('The Docker daemon is not running. Start Docker Desktop, then rerun npm run dev:local.');
	}
}

function processAlive(pid) {
	try {
		process.kill(pid, 0);
		return true;
	} catch (error) {
		return error?.code === 'EPERM';
	}
}

function processCommand(pid) {
	if (process.platform === 'win32') return '';
	const result = spawnSync('ps', ['-p', String(pid), '-o', 'command='], { encoding: 'utf8' });
	return result.status === 0 ? result.stdout : '';
}

function looksLikeSupervisor(pid) {
	const command = processCommand(pid);
	// `npm run` starts this script with a relative path, so the command line
	// need not contain REPO_ROOT. The lock file is worktree-local; the script
	// name plus the start subcommand is the durable signal.
	return command.length === 0 || (command.includes('dev-local.mjs') && command.includes('start'));
}

async function readLockPid() {
	try {
		const pid = Number((await readFile(lockPath(REPO_ROOT), 'utf8')).trim());
		return Number.isInteger(pid) && pid > 0 ? pid : null;
	} catch {
		return null;
	}
}

async function acquireLock() {
	await mkdir(stateDirectory(REPO_ROOT), { recursive: true });
	const path = lockPath(REPO_ROOT);
	try {
		await writeFile(path, String(process.pid), { flag: 'wx', mode: 0o600 });
		return;
	} catch (error) {
		if (error?.code !== 'EEXIST') throw error;
	}
	const existing = await readLockPid();
	if (existing && processAlive(existing) && looksLikeSupervisor(existing)) {
		throw new Error(
			`The local stack already has a running supervisor (pid ${existing}). Use npm run dev:local:stop first.`
		);
	}
	await rm(path, { force: true });
	await writeFile(path, String(process.pid), { flag: 'wx', mode: 0o600 });
}

async function releaseLock() {
	const pid = await readLockPid();
	if (pid === process.pid) await rm(lockPath(REPO_ROOT), { force: true });
}

let childrenPersist = Promise.resolve();

function persistChildren() {
	childrenPersist = childrenPersist
		.then(async () => {
			const running = childRecords
				.filter((record) => !record.exited && record.child.pid)
				.map((record) => ({ pid: record.child.pid, label: record.label }));
			if (running.length === 0) {
				await rm(childrenPath(REPO_ROOT), { force: true });
				return;
			}
			await writeFile(childrenPath(REPO_ROOT), `${JSON.stringify(running, null, 2)}\n`, {
				mode: 0o600
			});
		})
		.catch(() => {});
	return childrenPersist;
}

function composePublishesPort(stack, port) {
	const result = spawnSync(
		'docker',
		['ps', '--filter', `label=com.docker.compose.project=${stack}`, '--format', '{{.Ports}}'],
		{ encoding: 'utf8' }
	);
	if (result.status !== 0 || typeof result.stdout !== 'string') return false;
	return result.stdout.split('\n').some((line) => line.includes(`:${port}->`));
}

async function ensurePorts(state) {
	const used = new Set();
	const next = {};
	for (const name of ['db', 'storage']) {
		const current = state.ports[name];
		const owned = composePublishesPort(state.stack, current);
		next[name] =
			!used.has(current) && (owned || (await isPortAvailable(current)))
				? current
				: await findAvailablePort(current + 1, used);
		used.add(next[name]);
	}
	const currentApi = state.ports.api;
	next.api =
		!used.has(currentApi) && (await isPortAvailable(currentApi))
			? currentApi
			: await findAvailablePort(currentApi + 1, used);
	used.add(next.api);
	const editorPortAvailable = (port) => isPortAvailable(port, 'localhost');
	const currentEditor = state.ports.editor;
	next.editor =
		!used.has(DEFAULT_EDITOR_PORT) && (await editorPortAvailable(DEFAULT_EDITOR_PORT))
			? DEFAULT_EDITOR_PORT
			: !used.has(currentEditor) && (await editorPortAvailable(currentEditor))
				? currentEditor
				: await findAvailablePort(DEFAULT_EDITOR_PORT + 1, used, editorPortAvailable);
	used.add(next.editor);
	if (Object.keys(next).some((name) => next[name] !== state.ports[name])) {
		state.ports = next;
		log(`reassigned local ports: db=${next.db} storage=${next.storage} api=${next.api} editor=${next.editor}`);
	}
}

async function loadExistingState() {
	const identity = stackIdentity(REPO_ROOT);
	const state = await readState(REPO_ROOT);
	if (!state) return null;
	try {
		validateState(state, identity);
	} catch (error) {
		throw new Error(`${error.message}. Run npm run dev:local:reset to rebuild local state.`);
	}
	return state;
}

/** Stop/reset read the record, but only use it after identity authorization. */
async function readRawState() {
	try {
		return await readState(REPO_ROOT);
	} catch {
		return null;
	}
}

async function loadCleanupState() {
	const identity = stackIdentity(REPO_ROOT);
	const raw = await readRawState();
	return { identity, ...authorizeCleanupState(raw, identity) };
}

async function ensureState() {
	const identity = stackIdentity(REPO_ROOT);
	const existing = await loadExistingState();
	if (existing) {
		await ensurePorts(existing);
		await writeState(REPO_ROOT, existing);
		return existing;
	}
	const { editor, ...servicePorts } = preferredPorts(identity.hash);
	const ports = await allocatePorts(servicePorts);
	ports.editor = await findAvailablePort(
		editor,
		new Set(Object.values(ports)),
		(port) => isPortAvailable(port, 'localhost')
	);
	const state = createState(identity, ports);
	await writeState(REPO_ROOT, state);
	return state;
}

function assertNotInterrupted() {
	if (interrupted) throw new Error(`startup interrupted by ${interrupted}`);
}

async function waitForHttp(label, url, record, timeoutMs = STARTUP_TIMEOUT_MS) {
	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		assertNotInterrupted();
		if (record?.exited) {
			throw new Error(`${label} exited before becoming ready${record.code === null ? '' : ` (${record.code})`}`);
		}
		try {
			const response = await fetch(url, { signal: AbortSignal.timeout(2_000) });
			if (response.ok) return;
		} catch {
			// Not listening yet.
		}
		await sleep(300);
	}
	throw new Error(`${label} did not become ready at ${url}`);
}

function startChild(label, args, env) {
	log(`starting ${label}...`);
	const child = spawn(NPM, args, {
		cwd: REPO_ROOT,
		env,
		stdio: 'inherit',
		detached: process.platform !== 'win32'
	});
	const record = { label, child, exited: false, code: null, signal: null };
	record.exit = new Promise((resolveExit) => {
		child.once('error', (error) => {
			if (!record.exited) {
				record.exited = true;
				record.code = 1;
				record.error = error;
			}
			resolveExit({ code: 1, signal: null });
		});
		child.once('close', (code, signal) => {
			if (!record.exited) {
				record.exited = true;
				record.code = code;
				record.signal = signal;
			}
			resolveExit({ code, signal });
		});
	});
	childRecords.push(record);
	void persistChildren();
	return record;
}

function signalProcess(pid, signal) {
	if (process.platform === 'win32') {
		spawnSync('taskkill', ['/pid', String(pid), '/t', '/f'], { stdio: 'ignore' });
		return;
	}
	try {
		process.kill(-pid, signal);
	} catch {
		try {
			process.kill(pid, signal);
		} catch {
			// Already gone.
		}
	}
}

function stopChild(record, signal) {
	if (record.exited || !record.child.pid) return;
	signalProcess(record.child.pid, signal);
}

async function stopAllChildren() {
	const running = childRecords.filter((record) => !record.exited);
	for (const record of running) stopChild(record, 'SIGTERM');
	await Promise.race([Promise.all(running.map((record) => record.exit)), sleep(8_000)]);
	for (const record of childRecords) {
		if (!record.exited) stopChild(record, 'SIGKILL');
	}
	await sleep(250);
	await rm(childrenPath(REPO_ROOT), { force: true });
}

async function killRecordedChildren() {
	let recorded = [];
	try {
		recorded = JSON.parse(await readFile(childrenPath(REPO_ROOT), 'utf8'));
	} catch {
		return;
	}
	if (!Array.isArray(recorded)) return;
	for (const entry of recorded) {
		const pid = entry?.pid;
		if (!Number.isInteger(pid) || pid <= 0 || !processAlive(pid)) continue;
		const command = processCommand(pid);
		const isOurs =
			command.length === 0 || /@biskiq\/api|@portfolio\/editor|vite|dev-local/.test(command);
		if (!isOurs) continue;
		signalProcess(pid, 'SIGTERM');
	}
	await sleep(500);
	for (const entry of recorded) {
		const pid = entry?.pid;
		if (!Number.isInteger(pid) || pid <= 0 || !processAlive(pid)) continue;
		const command = processCommand(pid);
		if (command.length > 0 && !/@biskiq\/api|@portfolio\/editor|vite|dev-local/.test(command)) continue;
		signalProcess(pid, 'SIGKILL');
	}
	await rm(childrenPath(REPO_ROOT), { force: true });
}

async function stopSupervisor() {
	const pid = await readLockPid();
	if (!pid || pid === process.pid) return false;
	if (!processAlive(pid) || !looksLikeSupervisor(pid)) {
		await rm(lockPath(REPO_ROOT), { force: true });
		return false;
	}
	log(`stopping supervisor (pid ${pid})...`);
	try {
		process.kill(pid, 'SIGTERM');
	} catch {
		// Already gone.
	}
	const deadline = Date.now() + 12_000;
	while (Date.now() < deadline && processAlive(pid)) await sleep(200);
	if (processAlive(pid)) {
		try {
			process.kill(pid, 'SIGKILL');
		} catch {
			// Already gone.
		}
	}
	return true;
}

function installSignalHandlers() {
	for (const signal of SIGNALS) {
		const handler = () => {
			interrupted = signal;
			if (superviseFinish) void superviseFinish(signal, 0);
		};
		signalHandlers.push([signal, handler]);
		process.on(signal, handler);
	}
}

function removeSignalHandlers() {
	for (const [signal, handler] of signalHandlers) process.off(signal, handler);
	signalHandlers = [];
}

async function shutdown(state, { quiet = false } = {}) {
	if (shuttingDown) return;
	shuttingDown = true;
	if (!quiet) log('stopping API and editor...');
	await stopAllChildren();
	if (state) {
		try {
			compose(state, ['stop'], { allowFailure: true });
		} catch (error) {
			log(`could not stop Compose services: ${error.message}`);
		}
	}
	await killRecordedChildren();
	await releaseLock();
	if (!quiet) log('stopped; database and object storage data are preserved.');
}

function printReady(state) {
	console.log('');
	log(`ready (stack ${state.stack})`);
	console.log(`  Editor    http://localhost:${state.ports.editor}`);
	console.log(`  API       http://localhost:${state.ports.api}`);
	console.log(`  Postgres  127.0.0.1:${state.ports.db} (user biskiq, database biskiq)`);
	console.log(`  Objects   http://127.0.0.1:${state.ports.storage} (bucket ${state.bucket})`);
	console.log(`  Namespace ${state.namespace}`);
	console.log('');
	console.log('  Stop      npm run dev:local:stop');
	console.log('  Reset     npm run dev:local:reset   (deletes local database and object bytes)');
	console.log('');
}

async function supervise(state, api, editor) {
	return new Promise((resolveDone) => {
		let settled = false;
		superviseFinish = async (reason, code) => {
			if (settled) return;
			settled = true;
			superviseFinish = null;
			removeSignalHandlers();
			if (typeof reason === 'string' && SIGNALS.includes(reason)) log(`${reason} received`);
			await shutdown(state);
			if (code) process.exitCode = code;
			resolveDone();
		};
		api.exit.then(({ code, signal }) => {
			if (settled) return;
			log(`API exited (${signal ?? code ?? 'unknown'}); stopping the rest of the stack`);
			void superviseFinish('api', code ?? 1);
		});
		editor.exit.then(({ code, signal }) => {
			if (settled) return;
			log(`editor exited (${signal ?? code ?? 'unknown'}); stopping the rest of the stack`);
			void superviseFinish('editor', code ?? 1);
		});
	});
}

async function start() {
	assertDocker();
	await mkdir(stateDirectory(REPO_ROOT), { recursive: true });
	await acquireLock();
	installSignalHandlers();
	let state;
	try {
		state = await ensureState();
		const env = buildStackEnv(state);
		assertNotInterrupted();

		log(`stack ${state.stack} (isolated for ${REPO_ROOT})`);
		log('starting PostgreSQL and SeaweedFS...');
		compose(state, ['up', '-d', '--wait', '--wait-timeout', '180', 'db', 'storage']);
		assertNotInterrupted();

		log('initializing object storage...');
		run(process.execPath, [resolve(REPO_ROOT, 'apps/api/scripts/init-local-object-store.mjs')], { env });
		assertNotInterrupted();

		log('applying database migrations...');
		run(NPM, ['run', 'migrate', '-w', '@biskiq/api'], { env });
		assertNotInterrupted();

		const api = startChild('api', ['run', 'dev', '-w', '@biskiq/api'], env);
		await waitForHttp('API', `http://127.0.0.1:${state.ports.api}/health/ready`, api);
		assertNotInterrupted();

		const editor = startChild(
			'editor',
			[
				'run',
				'dev:local',
				'-w',
				'@portfolio/editor',
				'--',
				'--port',
				String(state.ports.editor),
				'--strictPort'
			],
			env
		);
		await waitForHttp('editor', `http://localhost:${state.ports.editor}/`, editor);

		printReady(state);
		await supervise(state, api, editor);
	} catch (error) {
		await shutdown(state, { quiet: true });
		removeSignalHandlers();
		throw error;
	}
}

async function stop() {
	const { identity, state, mismatch } = await loadCleanupState();
	if (mismatch) log(`ignoring persisted state for cleanup: ${mismatch}`);
	const stoppedSupervisor = await stopSupervisor();
	if (!stoppedSupervisor) await killRecordedChildren();
	let stoppedCompose = false;
	if (state) {
		try {
			stoppedCompose = compose(state, ['stop'], { allowFailure: true }).status === 0;
		} catch {
			stoppedCompose = false;
		}
	}
	const stoppedContainers = stoppedCompose ? 0 : stopProjectContainers(identity.stack);
	await releaseLock();
	if (state || mismatch || stoppedSupervisor || stoppedContainers > 0) {
		log('local stack stopped; database and object storage data are preserved.');
	} else {
		log('no running local stack was found.');
	}
}

async function reset() {
	const { identity, state, mismatch } = await loadCleanupState();
	if (mismatch) {
		throw new Error(
			`Refusing to reset because the persisted state is not for this worktree: ${mismatch}. The state file was left in place.`
		);
	}
	await stopSupervisor();
	await killRecordedChildren();
	let removedCompose = false;
	if (state) {
		try {
			removedCompose = compose(state, ['down', '--volumes', '--remove-orphans'], {
				allowFailure: true
			}).status === 0;
		} catch {
			removedCompose = false;
		}
	}
	try {
		if (!removedCompose) removeProjectContainers(identity.stack);
		removeProjectVolumes(identity.stack);
	} catch (error) {
		throw new Error(
			`Reset could not remove the local stack; the persisted state was left in place: ${error.message}`
		);
	}
	await rm(lockPath(REPO_ROOT), { force: true });
	await rm(childrenPath(REPO_ROOT), { force: true });
	await rm(statePath(REPO_ROOT), { force: true });
	log('local database and object storage were deleted; the next start recreates them.');
}

async function logs() {
	const state = await loadExistingState();
	if (!state) {
		log('no local stack state; run npm run dev:local first.');
		return;
	}
	log(`following database and object-storage logs for ${state.stack} (Ctrl+C stops following)`);
	compose(state, ['logs', '-f', '--tail=100', 'db', 'storage'], { allowFailure: true });
}

async function status() {
	const state = await loadExistingState();
	if (!state) {
		log('no local stack state; run npm run dev:local to create one.');
		return;
	}
	log(`stack ${state.stack}`);
	compose(state, ['ps'], { allowFailure: true });
	for (const [label, url] of [
		['API', `http://127.0.0.1:${state.ports.api}/health/ready`],
		['editor', `http://localhost:${state.ports.editor}/`]
	]) {
		try {
			const response = await fetch(url, { signal: AbortSignal.timeout(2_000) });
			console.log(`${label}: ${response.ok ? 'ready' : `HTTP ${response.status}`} ${url}`);
		} catch {
			console.log(`${label}: not reachable ${url}`);
		}
	}
	console.log(`Editor http://localhost:${state.ports.editor}`);
	console.log(`API    http://localhost:${state.ports.api}`);
}

const COMMANDS = { start, stop, reset, logs, status };
const command = process.argv[2] ?? 'start';

if (!Object.hasOwn(COMMANDS, command)) {
	console.error('Usage: node tools/local-dev/dev-local.mjs [start|stop|reset|logs|status]');
	process.exitCode = 1;
} else {
	try {
		await COMMANDS[command]();
	} catch (error) {
		console.error(`[local] ${error instanceof Error ? error.message : 'local stack command failed'}`);
		process.exitCode = 1;
	}
}
