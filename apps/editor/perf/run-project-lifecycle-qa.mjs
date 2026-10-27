#!/usr/bin/env node
/**
 * One foreground supervisor for the T3.P04.S01 browser pass. Run it from
 * apps/editor with `vite-node --script perf/run-project-lifecycle-qa.mjs` so
 * workspace TypeScript package exports resolve as they do in the API test lane.
 *
 * The API and Vite preview are in-process and close in finally. Playwright is
 * a child of this supervisor; the DB is a task-private database supplied by
 * the caller. Object bytes stay in this process's memory.
 */
import { randomBytes } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createServer } from 'node:net';
import { resolve } from 'node:path';
import { execFileSync, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';

import { Pool } from 'pg';
import { preview } from 'vite';

import { createApp } from '../../api/dist/app.js';
import { runMigrations } from '../../api/dist/migrate.js';
import {
  runProjectDeletionCleanup
} from '../../api/dist/project-lifecycle.js';
import { SESSION_KEY, memoryObjectStore } from '../../api/tests/test-support.mjs';

const scriptDir = fileURLToPath(new URL('.', import.meta.url));
const editorRoot = resolve(scriptDir, '..');
const repoRoot = resolve(editorRoot, '../..');
const resultsDir = process.env.PERF_RESULTS_DIR;
const databaseUrl = process.env.DATABASE_URL;

if (!resultsDir) throw new Error('PERF_RESULTS_DIR is required');
if (!databaseUrl) throw new Error('DATABASE_URL must name the private browser QA database');
await mkdir(resultsDir, { recursive: true });

const storeControlPath = resolve(resultsDir, 'project-lifecycle-store-control.json');
const storeManifestPath = resolve(resultsDir, 'project-lifecycle-store-manifest.json');
const cleanupQueuePath = resolve(resultsDir, 'project-lifecycle-cleanup-retry.json');
const apiTimingPath = resolve(resultsDir, 'project-lifecycle-api-timings.json');
const machineFactsPath = resolve(resultsDir, 'project-lifecycle-machine-facts.json');
await writeFile(storeControlPath, JSON.stringify({ blockedProjectIds: [] }, null, 2));
await writeFile(cleanupQueuePath, JSON.stringify({ jobs: [] }, null, 2));

function readMachineFacts() {
  const command = (file, args) => {
    try { return execFileSync(file, args, { encoding: 'utf8', timeout: 5_000 }).trim(); }
    catch (error) { return `unavailable: ${error instanceof Error ? error.message : String(error)}`; }
  };
  const battery = command('/usr/bin/pmset', ['-g', 'batt']);
  const lowPower = command('/usr/bin/pmset', ['-g']);
  const powerMatch = /Now drawing from '([^']+)'/.exec(battery);
  const lowPowerMatch = /^\s*lowpowermode\s+(\d+)\s*$/m.exec(lowPower);
  const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  return {
    capturedAt: new Date().toISOString(),
    machineModel: command('/usr/sbin/sysctl', ['-n', 'hw.model']),
    macOSVersion: command('/usr/bin/sw_vers', ['-productVersion']),
    powerSource: powerMatch?.[1] ?? 'unavailable',
    batteryPowerDetails: battery,
    lowPowerMode: lowPowerMatch ? lowPowerMatch[1] === '1' : 'unavailable',
    lowPowerModeDetails: lowPower,
    chromeExecutable: chrome,
    chromeCliVersion: command(chrome, ['--version'])
  };
}

const machineFactsAtStart = readMachineFacts();
process.env.PERF_MACHINE_FACTS = JSON.stringify(machineFactsAtStart);

async function freePort(except = new Set()) {
  for (;;) {
    const server = createServer();
    await new Promise((resolveListen, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolveListen);
    });
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Could not allocate a loopback port');
    await new Promise((resolveClose, reject) => server.close((error) => error ? reject(error) : resolveClose()));
    if (!except.has(address.port)) return address.port;
  }
}

async function readControl() {
  try {
    return JSON.parse(await readFile(storeControlPath, 'utf8'));
  } catch {
    return { blockedProjectIds: [] };
  }
}

async function writeStoreManifest(objects) {
  await writeFile(storeManifestPath, JSON.stringify({
    kind: 'process-local memory object store',
    keyCount: objects.size,
    keys: [...objects.keys()].sort()
  }, null, 2));
}

function projectIdForObjectKey(key) {
  const match = /^projects\/[^/]+\/([^/]+)\//.exec(key);
  return match?.[1] ?? null;
}

const baseStore = memoryObjectStore();
const objectStore = {
  ...baseStore,
  async put(key, body, options) {
    await baseStore.put(key, body, options);
    await writeStoreManifest(baseStore.objects);
  },
  async delete(key, signal) {
    if (signal?.aborted) throw signal.reason;
    const projectId = projectIdForObjectKey(key);
    const control = await readControl();
    if (projectId && control.blockedProjectIds.includes(projectId)) {
      throw new Error('injected local cleanup retry condition');
    }
    await baseStore.delete(key, signal);
    await writeStoreManifest(baseStore.objects);
  },
  async list(signal) {
    if (signal?.aborted) throw signal.reason;
    return baseStore.list();
  }
};

let pool;
let app;
let previewServer;
let playwrightChild;
let signalRequested = false;
const apiTimings = [];
const requestStarts = new WeakMap();
let browserFacts = null;
let cleanupResult = null;

async function runCleanupRetryJobs() {
  let queue;
  try {
    queue = JSON.parse(await readFile(cleanupQueuePath, 'utf8'));
  } catch {
    queue = { jobs: [] };
  }
  if (!Array.isArray(queue.jobs) || queue.jobs.length === 0) return;

  const results = [];
  for (const job of queue.jobs) {
    const attempts = [];
    const waitUntil = async (timestamp) => {
      const remainingMs = Math.max(0, timestamp - Date.now());
      if (remainingMs > 0) await new Promise((resolveWait) => setTimeout(resolveWait, remainingMs + 2));
    };
    let state = await pool.query(
      'SELECT status, fenced_at AS "fencedAt", cleanup_bound_ms AS "cleanupBoundMs", first_empty_at AS "firstEmptyAt" FROM project_deletions WHERE project_id = $1',
      [job.projectId]
    );
    let tombstoneState = state.rows[0];
    if (!tombstoneState || tombstoneState.status !== 'pending') throw new Error('Cleanup retry did not start from a pending tombstone');
    const bound = Number(tombstoneState.cleanupBoundMs ?? job.cleanupBoundMs);

    // A failed HTTP cleanup may already have committed the first empty listing.
    // Wait from that durable timestamp; if bytes were still present, wait from
    // the fence and let this retry delete them before it establishes that proof.
    const firstEmptyAt = tombstoneState.firstEmptyAt
      ? new Date(tombstoneState.firstEmptyAt).getTime()
      : new Date(tombstoneState.fencedAt ?? job.fencedAt).getTime();
    await waitUntil(firstEmptyAt + bound);
    let cleanup = await runProjectDeletionCleanup(pool, objectStore, job.projectId);
    attempts.push(cleanup);
    state = await pool.query(
      'SELECT status, fenced_at AS "fencedAt", cleanup_bound_ms AS "cleanupBoundMs", first_empty_at AS "firstEmptyAt", last_attempt_at AS "lastAttemptAt" FROM project_deletions WHERE project_id = $1',
      [job.projectId]
    );
    tombstoneState = state.rows[0];
    if (cleanup.status === 'pending') {
      const spacingStart = tombstoneState?.firstEmptyAt
        ? new Date(tombstoneState.firstEmptyAt).getTime()
        : new Date(tombstoneState?.lastAttemptAt ?? Date.now()).getTime();
      await waitUntil(spacingStart + bound);
      cleanup = await runProjectDeletionCleanup(pool, objectStore, job.projectId);
      attempts.push(cleanup);
    }
    if (cleanup.status !== 'complete') throw new Error('Cleanup retry did not complete after two spaced empty proofs');
    const idempotent = await runProjectDeletionCleanup(pool, objectStore, job.projectId);
    if (idempotent.status !== 'complete') throw new Error('Completed cleanup retry was not idempotent');

    const tombstone = await pool.query(
      'SELECT status, key_inventory, sweep_dependent, attempt_count, completed_at FROM project_deletions WHERE project_id = $1',
      [job.projectId]
    );
    const row = tombstone.rows[0];
    if (!row || row.status !== 'complete') throw new Error('Completed deletion tombstone is missing');
    for (const key of job.expectedKeys) {
      if (baseStore.objects.has(key)) throw new Error('An owned object remains after cleanup: ' + key);
    }
    for (const key of job.siblingKeys) {
      if (!baseStore.objects.has(key)) throw new Error('A sibling project object was removed: ' + key);
    }
    results.push({
      projectId: job.projectId,
      attempts,
      idempotent,
      tombstone: {
        status: row.status,
        keyInventory: row.key_inventory,
        sweepDependent: row.sweep_dependent,
        attemptCount: row.attempt_count,
        completedAt: row.completed_at
      },
      deletedOwnedKeys: job.expectedKeys,
      survivingSiblingKeys: job.siblingKeys
    });
  }
  cleanupResult = { jobs: results };
  await writeFile(resolve(resultsDir, 'project-lifecycle-cleanup-retry-result.json'), JSON.stringify(cleanupResult, null, 2));
}

async function stopChild() {
  if (!playwrightChild || playwrightChild.exitCode !== null) return;
  playwrightChild.kill('SIGTERM');
  await new Promise((resolveExit) => playwrightChild.once('exit', resolveExit));
}

function stopForSignal(signal) {
	signalRequested = true;
	process.exitCode = signal === 'SIGINT' ? 130 : 143;
	void stopChild();
}

process.once('SIGINT', stopForSignal);
process.once('SIGTERM', stopForSignal);

try {
  pool = new Pool({ connectionString: databaseUrl, max: 8, connectionTimeoutMillis: 3000 });
  await pool.query('SELECT 1');
  await runMigrations(pool);

  const apiPort = await freePort();
  const editorPort = await freePort(new Set([apiPort]));
  const apiOrigin = 'http://127.0.0.1:' + apiPort;
  const editorOrigin = 'http://127.0.0.1:' + editorPort;
  const testAuthSecret = randomBytes(32).toString('hex');
  const policy = {
    handlerTimeoutMs: 5_000,
    leaseDeadlineMs: 4_000,
    renewalIntervalMs: 500,
    abortMarginMs: 250
  };

  app = createApp({
    pool,
    apiOrigin,
    editorOrigin,
    sessionKey: SESSION_KEY,
    objectStore,
    objectNamespace: 't3p04s01qa',
    testAuth: { secret: testAuthSecret },
    projectLifecyclePolicy: policy,
    logger: false
  });
  app.addHook('onRequest', async (request) => {
    if (/^\/projects\/[^/]+$/.test(request.url) && ['PUT', 'PATCH', 'DELETE'].includes(request.method)) {
      requestStarts.set(request, performance.now());
    }
  });
  app.addHook('onResponse', async (request, reply) => {
    const start = requestStarts.get(request);
    if (start === undefined) return;
    apiTimings.push({
      method: request.method,
      path: request.url,
      statusCode: reply.statusCode,
      handlerMs: performance.now() - start
    });
  });
  app.addHook('onSend', async (request, reply, payload) => {
    if (/^\/projects\/[^/]+$/.test(request.url) && ['PUT', 'PATCH', 'DELETE'].includes(request.method)) {
      reply.header('Timing-Allow-Origin', editorOrigin);
      reply.header('Server-Timing', `lifecycle;dur=${Math.max(0, performance.now() - (requestStarts.get(request) ?? performance.now())).toFixed(2)}`);
    }
    return payload;
  });
  await app.listen({ host: '127.0.0.1', port: apiPort });

  process.env.PUBLIC_API_ORIGIN = apiOrigin;
  process.env.PERF_API_ORIGIN = apiOrigin;
  process.env.E2E_TEST_AUTH_SECRET = testAuthSecret;
  process.env.PERF_BASE_URL = editorOrigin;
  process.env.PERF_RESULTS_DIR = resultsDir;
  previewServer = await preview({
    root: editorRoot,
    configFile: resolve(editorRoot, 'vite.config.ts'),
    preview: { host: '127.0.0.1', port: editorPort, strictPort: true }
  });

  const cliPath = resolve(repoRoot, 'node_modules/@playwright/test/cli.js');
  const grep = process.env.PROJECT_LIFECYCLE_QA_GREP;
  const project = process.env.PROJECT_LIFECYCLE_QA_PROJECT ?? 'chromium';
  if (!['chromium', 'chrome'].includes(project)) throw new Error(`Unsupported QA Playwright project: ${project}`);
  playwrightChild = spawn(process.execPath, [
    cliPath,
    'test',
    '--config',
    'perf/playwright.config.ts',
    `--project=${project}`,
    '--workers=1',
    ...(process.env.PROJECT_LIFECYCLE_QA_HEADED === '1' ? ['--headed'] : []),
    ...(grep ? ['--grep', grep] : []),
    'perf/flows/project-lifecycle.spec.ts'
  ], {
    cwd: editorRoot,
    env: process.env,
    stdio: 'inherit'
  });
  const code = await new Promise((resolveExit, reject) => {
    playwrightChild.once('error', reject);
    playwrightChild.once('exit', (exitCode, signal) => {
      if (signal) resolveExit(1);
      else resolveExit(exitCode ?? 1);
    });
  });
  playwrightChild = null;

  if (code === 0) {
    await runCleanupRetryJobs();
  }
  if (!signalRequested && code !== 0) process.exitCode = code;
} catch (error) {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
} finally {
  process.off('SIGINT', stopForSignal);
  process.off('SIGTERM', stopForSignal);
  await stopChild().catch(() => undefined);
  try {
    browserFacts = JSON.parse(await readFile(resolve(resultsDir, 'project-lifecycle-browser-facts.json'), 'utf8'));
  } catch {
    browserFacts = null;
  }
  const machineFactsAtEnd = readMachineFacts();
  await writeFile(machineFactsPath, JSON.stringify({
    start: machineFactsAtStart,
    end: machineFactsAtEnd,
    powerSourceStable: machineFactsAtStart.powerSource === machineFactsAtEnd.powerSource,
    lowPowerModeStable: machineFactsAtStart.lowPowerMode === machineFactsAtEnd.lowPowerMode
  }, null, 2)).catch(() => undefined);
  await writeFile(apiTimingPath, JSON.stringify(apiTimings, null, 2)).catch(() => undefined);
  await writeStoreManifest(baseStore.objects).catch(() => undefined);
  if (previewServer) await previewServer.close().catch(() => undefined);
  if (app) await app.close().catch(() => undefined);
  else if (pool) await pool.end().catch(() => undefined);
  await writeFile(resolve(resultsDir, 'project-lifecycle-supervisor-result.json'), JSON.stringify({
    browserFacts,
    machineFacts: { start: machineFactsAtStart, end: machineFactsAtEnd },
    cleanupResult,
    apiTimingCount: apiTimings.length,
    objectCountAtShutdown: baseStore.objects.size,
    processesClosed: true,
    networkStore: 'private in-memory ObjectStore; no R2 connection'
  }, null, 2)).catch(() => undefined);
}
