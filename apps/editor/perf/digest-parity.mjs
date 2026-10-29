#!/usr/bin/env node
/**
 * T5.P01.S03 — golden corpus digest parity across JavaScript engines.
 *
 * On-demand final-gate evidence, not a Vitest lane and not a benchmark. It
 * bundles the real `@portfolio/geometry-core` kernel with the pinned S01 profile
 * corpus and evaluates every valid source in Node's V8 and in the two
 * Playwright-shipped non-V8 engines (WebKit's JavaScriptCore and Firefox's
 * SpiderMonkey). Digests, refusal codes and the pinned-golden comparison must be
 * byte-identical; a difference is reported, never normalized.
 *
 *   node perf/digest-parity.mjs --out <path.json>
 *
 * `PERF_BROWSER_ENGINES` narrows the engines (default `webkit,firefox`).
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';

import { firefox, webkit } from '@playwright/test';
import { build } from 'esbuild';

const scriptDir = fileURLToPath(new URL('.', import.meta.url));
const editorRoot = resolve(scriptDir, '..');
const outIndex = process.argv.indexOf('--out');
const outPath = outIndex >= 0 ? process.argv[outIndex + 1] : null;
if (outPath === null) throw new Error('--out <path.json> is required');

const revision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: editorRoot, encoding: 'utf8' }).trim();
const dirty = execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], {
  cwd: editorRoot,
  encoding: 'utf8'
}).trim() !== '';

const entry = `
  import {
    evaluateProfile,
    extrudeProfile,
    formMeshDigest,
    validateProfile
  } from '@portfolio/geometry-core';
  import { INVALID_PROFILES, VALID_FORMS } from './tests/lib/geometry-core/__fixtures__/corpus';
  import { GOLDEN_DIGESTS } from './tests/lib/geometry-core/__fixtures__/goldens';

  const digests = {};
  for (const source of VALID_FORMS) {
    const mesh = extrudeProfile({
      profile: evaluateProfile(source.outline),
      extent: source.extent,
      scale: source.scale,
      plane: source.plane
    });
    digests[source.name] = formMeshDigest(mesh);
  }
  const refusals = {};
  for (const source of INVALID_PROFILES) {
    refusals[source.name] = validateProfile(source.outline).map((issue) => issue.code);
  }
  const mismatches = VALID_FORMS
    .filter((source) => GOLDEN_DIGESTS[source.name] !== digests[source.name])
    .map((source) => source.name);
  globalThis.__S03_DIGEST_PARITY__ = {
    digests,
    refusals,
    goldenMismatches: mismatches,
    validCount: VALID_FORMS.length,
    invalidCount: INVALID_PROFILES.length
  };
`;

const bundle = await build({
  stdin: { contents: entry, resolveDir: editorRoot, loader: 'ts' },
  bundle: true,
  write: false,
  format: 'iife',
  platform: 'browser',
  target: 'es2022',
  legalComments: 'none',
  logLevel: 'silent'
});
const code = bundle.outputFiles[0].text;
const bundleSha256 = createHash('sha256').update(code).digest('hex');

/** Sorted `name→digest` pairs so object insertion order cannot mask a difference. */
function digestPin(parity) {
  const sorted = Object.keys(parity.digests).sort().map((name) => [name, parity.digests[name]]);
  return createHash('sha256').update(JSON.stringify(sorted)).digest('hex');
}

function summarize(engine, version, runtime, parity) {
  return {
    engine,
    runtime,
    version,
    digestPin: digestPin(parity),
    goldenMismatches: parity.goldenMismatches,
    validCount: parity.validCount,
    invalidCount: parity.invalidCount
  };
}

const engines = [];

const sandbox = { globalThis: undefined };
sandbox.globalThis = sandbox;
runInNewContext(code, sandbox, { timeout: 120_000 });
const nodeParity = sandbox.__S03_DIGEST_PARITY__;
if (nodeParity === undefined) throw new Error('the bundle produced no parity payload in Node');
engines.push({ ...summarize('node', process.version, 'V8', nodeParity), parity: nodeParity });

const requested = (process.env.PERF_BROWSER_ENGINES ?? 'webkit,firefox')
  .split(',')
  .map((value) => value.trim())
  .filter((value) => value !== '');
const launchers = { webkit, firefox };

for (const name of requested) {
  const launcher = launchers[name];
  if (launcher === undefined) throw new Error(`Unsupported engine "${name}"; use webkit or firefox`);
  const browser = await launcher.launch();
  try {
    const page = await browser.newPage();
    await page.addScriptTag({ content: code });
    const parity = await page.evaluate(() => globalThis.__S03_DIGEST_PARITY__);
    if (parity === undefined) throw new Error(`${name} produced no parity payload`);
    engines.push({
      ...summarize(name, browser.version(), name === 'webkit' ? 'JavaScriptCore' : 'SpiderMonkey', parity),
      userAgent: await page.evaluate(() => navigator.userAgent),
      parity
    });
  } finally {
    await browser.close();
  }
}

const v8 = engines[0];
const comparisons = engines.slice(1).map((engine) => ({
  engine: engine.engine,
  digestPinMatchesV8: engine.digestPin === v8.digestPin,
  digestsMatchV8: JSON.stringify(engine.parity.digests) === JSON.stringify(v8.parity.digests),
  refusalsMatchV8: JSON.stringify(engine.parity.refusals) === JSON.stringify(v8.parity.refusals)
}));

const report = {
  flow: 'T5.P01.S03 native form golden digest parity',
  revision,
  tree: dirty ? 'dirty' : 'clean',
  generatedAt: new Date().toISOString(),
  bundleSha256,
  corpus: { valid: v8.parity.validCount, invalid: v8.parity.invalidCount },
  pin: 'sha256 over sorted [name, digest] pairs',
  engines,
  comparisons,
  passed:
    v8.parity.goldenMismatches.length === 0 &&
    comparisons.every(
      (entry) => entry.digestPinMatchesV8 && entry.digestsMatchV8 && entry.refusalsMatchV8
    )
};

await mkdir(dirname(resolve(outPath)), { recursive: true });
await writeFile(resolve(outPath), `${JSON.stringify(report, null, 2)}\n`);
for (const engine of engines) {
  console.log(
    `${engine.engine.padEnd(8)} ${engine.runtime.padEnd(14)} ${engine.version.padEnd(18)} pin ${engine.digestPin.slice(0, 16)} goldens ${engine.goldenMismatches.length === 0 ? 'match' : 'MISMATCH'}`
  );
}
console.log(`=> ${report.passed ? 'PASS' : 'FAIL'} · ${resolve(outPath)}`);
if (!report.passed) process.exitCode = 1;
