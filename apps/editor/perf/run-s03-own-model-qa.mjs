#!/usr/bin/env node
/**
 * T2.P02.S03 — one foreground supervisor for the integrated own-model acceptance pass.
 *
 * The phase final gate needs the shipped import journey against a real API, a real
 * database and a real object store, not a mocked client. The API and the Vite
 * preview are in-process and close in `finally`; Playwright is a child of this
 * supervisor. Object bytes stay in this process's memory
 * (`apps/api/tests/test-support.mjs`), so no R2 credentials or bucket are touched.
 *
 * Run it from apps/editor with `vite-node --script perf/run-s03-own-model-qa.mjs`
 * so workspace TypeScript package exports resolve as they do in the API lane.
 * It serves the ordinary production build (`.svelte-kit/output`) through
 * `vite preview` and never builds: run `npm run build` at the repository root
 * immediately before a pass, so the measured bundle is the code under review.
 *
 *   DATABASE_URL      a task-private Postgres database (this supervisor runs the
 *                     migrations); create an empty database for the pass and never
 *                     point it at the development database or the Compose stack
 *   PERF_RESULTS_DIR  where the evidence JSON and screenshots are written
 *   S03_QA_PROJECT    `chrome` for the branded browser the contract gates on
 *                     (default `chromium` is Playwright's build, not that row)
 *   S03_QA_SPEC       the spec to run (acceptance by default; diagnostics on demand)
 *
 * The API origin is not baked into the build: the SPA reads
 * `$env/dynamic/public`, so `PUBLIC_API_ORIGIN` is set here at preview start and
 * the ports below only have to be free.
 */
import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { resolve } from 'node:path';
import { execFileSync, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { Pool } from 'pg';
import { preview } from 'vite';

const scriptDir = fileURLToPath(new URL('.', import.meta.url));
const editorRoot = resolve(scriptDir, '..');
const repoRoot = resolve(editorRoot, '../..');
const resultsDir = process.env.PERF_RESULTS_DIR;
const databaseUrl = process.env.DATABASE_URL;

if (!resultsDir) throw new Error('PERF_RESULTS_DIR is required');
if (!databaseUrl) throw new Error('DATABASE_URL must name the private acceptance database');
if (!existsSync(resolve(scriptDir, '../.svelte-kit/output/client'))) {
  throw new Error(
    'No production build to serve: run `npm run build` at the repository root first ' +
      '(the supervisor previews .svelte-kit/output and never builds).'
  );
}
if (
  !existsSync(resolve(repoRoot, 'apps/api/dist/app.js')) ||
  !existsSync(resolve(repoRoot, 'apps/api/dist/migrate.js'))
) {
  throw new Error(
    'No built API to import: run `npm run build:api` at the repository root first ' +
      '(the supervisor imports apps/api/dist and never builds).'
  );
}

// The API build is gitignored, so import it only after the preflight above:
// a static import would fail with ERR_MODULE_NOT_FOUND before this guard runs.
const { createApp } = await import('../../api/dist/app.js');
const { runMigrations } = await import('../../api/dist/migrate.js');
const { SESSION_KEY, memoryObjectStore } = await import('../../api/tests/test-support.mjs');

await mkdir(resultsDir, { recursive: true });

const apiPort = Number(process.env.S03_API_PORT ?? 8791);
const editorPort = Number(process.env.S03_EDITOR_PORT ?? 4179);
const apiOrigin = `http://127.0.0.1:${apiPort}`;
const editorOrigin = `http://127.0.0.1:${editorPort}`;

function readMachineFacts() {
  const command = (file, args) => {
    try {
      return execFileSync(file, args, { encoding: 'utf8', timeout: 5_000 }).trim();
    } catch (error) {
      return `unavailable: ${error instanceof Error ? error.message : String(error)}`;
    }
  };
  const battery = command('/usr/bin/pmset', ['-g', 'batt']);
  const lowPower = command('/usr/bin/pmset', ['-g']);
  const powerMatch = /Now drawing from '([^']+)'/.exec(battery);
  const lowPowerMatch = /^\s*lowpowermode\s+(\d+)\s*$/m.exec(lowPower);
  const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  return {
    capturedAt: new Date().toISOString(),
    machineModel: command('/usr/sbin/sysctl', ['-n', 'hw.model']),
    cpu: command('/usr/sbin/sysctl', ['-n', 'machdep.cpu.brand_string']),
    memoryBytes: command('/usr/sbin/sysctl', ['-n', 'hw.memsize']),
    macOSVersion: command('/usr/bin/sw_vers', ['-productVersion']),
    powerSource: powerMatch?.[1] ?? 'unavailable',
    lowPowerMode: lowPowerMatch?.[1] === '1' ? 'on' : lowPowerMatch?.[1] === '0' ? 'off' : 'unavailable',
    chromeCliVersion: command(chrome, ['--version']),
    nodeVersion: process.version
  };
}

async function assertFreePort(port) {
  await new Promise((resolveCheck, reject) => {
    const server = createServer();
    server.once('error', (error) => reject(new Error(`Port ${port} is not free: ${error.message}`)));
    server.listen(port, '127.0.0.1', () => server.close(() => resolveCheck()));
  });
}

const machineFactsAtStart = readMachineFacts();
let pool;
let app;
let previewServer;
let playwrightChild;
let signalRequested = false;

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
  await assertFreePort(apiPort);
  await assertFreePort(editorPort);

  pool = new Pool({ connectionString: databaseUrl, max: 8, connectionTimeoutMillis: 3_000 });
  await pool.query('SELECT 1');
  await runMigrations(pool);

  const testAuthSecret = randomBytes(32).toString('hex');
  const baseStore = memoryObjectStore();

  app = createApp({
    pool,
    apiOrigin,
    editorOrigin,
    sessionKey: SESSION_KEY,
    objectStore: baseStore,
    objectNamespace: 't2p02s03qa',
    testAuth: { secret: testAuthSecret },
    logger: false
  });
  await app.listen({ host: '127.0.0.1', port: apiPort });

  process.env.PUBLIC_API_ORIGIN = apiOrigin;
  process.env.PERF_API_ORIGIN = apiOrigin;
  process.env.E2E_TEST_AUTH_SECRET = testAuthSecret;
  process.env.PERF_BASE_URL = editorOrigin;
  process.env.PERF_RESULTS_DIR = resultsDir;
  process.env.PERF_MACHINE_FACTS = JSON.stringify(machineFactsAtStart);

  previewServer = await preview({
    root: editorRoot,
    configFile: resolve(editorRoot, 'vite.config.ts'),
    preview: { host: '127.0.0.1', port: editorPort, strictPort: true }
  });

  const cliPath = resolve(repoRoot, 'node_modules/@playwright/test/cli.js');
  const project = process.env.S03_QA_PROJECT ?? 'chromium';
  if (!['chromium', 'chrome'].includes(project)) throw new Error(`Unsupported QA Playwright project: ${project}`);
  playwrightChild = spawn(process.execPath, [
    cliPath,
    'test',
    '--config',
    'perf/playwright.config.ts',
    `--project=${project}`,
    '--workers=1',
    ...(process.env.S03_QA_HEADED === '1' ? ['--headed'] : []),
    process.env.S03_QA_SPEC ?? 'perf/flows/s03-own-model-acceptance.spec.ts'
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
  if (!signalRequested && code !== 0) process.exitCode = code;
} catch (error) {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
} finally {
  process.off('SIGINT', stopForSignal);
  process.off('SIGTERM', stopForSignal);
  await stopChild().catch(() => undefined);
  await writeFile(
    resolve(resultsDir, 's03-machine-facts.json'),
    JSON.stringify({ start: machineFactsAtStart, end: readMachineFacts() }, null, 2)
  ).catch(() => undefined);
  if (previewServer) await previewServer.close().catch(() => undefined);
  if (app) await app.close().catch(() => undefined);
  else if (pool) await pool.end().catch(() => undefined);
}
