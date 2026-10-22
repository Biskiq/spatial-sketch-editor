#!/usr/bin/env node
// Disposable cold-process compile probe (convergence 2026-10-21, performance packet).
// 1. Bundles make-fixtures-entry.ts and cold-entry.ts with the repo's installed
//    esbuild into the OS temp dir (nothing is written to the repo except results).
// 2. Writes the synthetic fixtures (public planners only) as Layout JSON.
// 3. Spawns RUNS fresh `node` processes per fixture; each reports parse, first
//    (JIT-cold) compile, second compile, tenth compile and first Plan evaluation.
// Usage from the repo root:
//   node broad-research/post-p01-roadmaps/convergence-2026-10-21/probes/performance/cold-compile.mjs [runs]
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync, readFileSync, statSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '../../../../..');
const esbuild = createRequire(path.join(repo, 'package.json'))('esbuild');
const runs = Number(process.argv[2] ?? 7);
const tmp = mkdtempSync(path.join(os.tmpdir(), 'convergence-perf-cold-'));

for (const name of ['make-fixtures-entry', 'cold-entry']) {
	esbuild.buildSync({
		entryPoints: [path.join(here, `${name}.ts`)],
		outfile: path.join(tmp, `${name}.mjs`),
		bundle: true,
		platform: 'node',
		format: 'esm',
		target: 'node20',
		absWorkingDir: repo,
		logLevel: 'error'
	});
}
const t0 = performance.now();
execFileSync(process.execPath, [path.join(tmp, 'make-fixtures-entry.mjs'), tmp], { stdio: 'inherit' });
const fixtureBuildMs = Math.round(performance.now() - t0);

const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
const max = (xs) => Math.max(...xs);
const r = (x) => Math.round(x * 100) / 100;
const rows = [];
for (const f of ['grid-3', 'grid-7', 'grid-14', 'grid-20-walls']) {
	const file = path.join(tmp, `${f}.json`);
	const samples = [];
	for (let i = 0; i < runs; i++) {
		const s = performance.now();
		const out = execFileSync(process.execPath, [path.join(tmp, 'cold-entry.mjs'), file], { encoding: 'utf8' });
		samples.push({ ...JSON.parse(out.trim().split('\n').pop()), processWallMs: performance.now() - s });
	}
	const col = (k) => ({ median: r(median(samples.map((x) => x[k]))), max: r(max(samples.map((x) => x[k]))) });
	const doc = JSON.parse(readFileSync(file, 'utf8'));
	const row = {
		fixture: f,
		walls: doc.walls.length,
		openings: doc.openings.length,
		rooms: doc.rooms.length,
		jsonBytes: statSync(file).size,
		runs,
		parseValidateMs: col('parseMs'),
		compileFirstColdMs: col('compile1'),
		compileSecondMs: col('compile2'),
		compileTenthMs: col('compile10'),
		planFirstMs: col('plan1'),
		processWallMs: col('processWallMs')
	};
	rows.push(row);
	console.log(JSON.stringify(row));
}
const bundleBytes = statSync(path.join(tmp, 'cold-entry.mjs')).size;
mkdirSync(path.join(here, 'results'), { recursive: true });
writeFileSync(
	path.join(here, 'results', 'compile-cold.json'),
	JSON.stringify({ probe: 'cold-compile.mjs (fresh node process per run)', date: new Date().toISOString(), node: process.version, v8: process.versions.v8, platform: `${os.platform()} ${os.release()} ${os.arch()}`, cpu: os.cpus()[0]?.model, cpus: os.cpus().length, memGiB: Math.round(os.totalmem() / 2 ** 30), fixtureBuildMs, coldEntryBundleBytes: bundleBytes, rows }, null, 1) + '\n'
);
