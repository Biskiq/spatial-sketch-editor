#!/usr/bin/env node
/**
 * Canary runner.
 *
 * A canary is one realistic defect, recorded as a literal mutation of a
 * production file, plus the tests that must fail because of it. The runner
 * applies one canary at a time, runs only its named tests, restores the file,
 * and reports `killed` (the tests failed) or `survived` (they stayed green).
 *
 * The corpus is evidence for the verification contract, never a replacement
 * for it: a deletion still follows the test contract, and a canary
 * that survives at baseline gets a test before any test is deleted.
 *
 * Usage:
 *  node tools/canaries/run.mjs # editor and package Vitest canaries
 *  node tools/canaries/run.mjs --all # complete corpus, including Postgres
 *  node tools/canaries/run.mjs --only 01-envelope-version
 *  node tools/canaries/run.mjs --kind api # DB-backed API canaries
 *  node tools/canaries/run.mjs --list
 *  node tools/canaries/run.mjs --json .harness/canaries.json
 *
 * The runner never runs in CI. It refuses to touch a dirty target file, and it
 * restores every file it mutates from HEAD even when the test run throws.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));
const PATCH_DIR = resolve(REPO_ROOT, 'tools/canaries/patches');
const EDITOR_ROOT = resolve(REPO_ROOT, 'apps/editor');
const API_ROOT = resolve(REPO_ROOT, 'apps/api');

function parseArgs(argv) {
	const options = { only: null, kind: 'vitest', list: false, json: null };
	for (let index = 0; index < argv.length; index += 1) {
		const arg = argv[index];
		if (arg === '--list') options.list = true;
		else if (arg === '--only') options.only = argv[++index];
		else if (arg === '--kind') options.kind = argv[++index];
		else if (arg === '--json') options.json = argv[++index];
		else if (arg === '--all') options.kind = 'all';
		else throw new Error(`unknown argument: ${arg}`);
	}
	return options;
}

function git(...args) {
	return execFileSync('git', args, { cwd: REPO_ROOT, encoding: 'utf8' });
}

function loadCanaries() {
	return readdirSync(PATCH_DIR)
		.filter((name) => name.endsWith('.json'))
		.sort()
		.map((name) => JSON.parse(readFileSync(resolve(PATCH_DIR, name), 'utf8')));
}

function assertClean(file) {
	const changed = git('status', '--porcelain', '--', file).trim();
	if (changed !== '')
		throw new Error(`${file} has uncommitted changes; canaries need a clean target`);
}

function apply(canary) {
	const path = resolve(REPO_ROOT, canary.file);
	const before = readFileSync(path, 'utf8');
	const occurrences = before.split(canary.find).length - 1;
	if (occurrences !== 1) {
		throw new Error(`${canary.file}: expected exactly one match, found ${occurrences}`);
	}
	writeFileSync(path, before.replace(canary.find, canary.replace));
}

function restore(canary) {
	git('checkout', '--', canary.file);
}

function runVitest(canary) {
	// Package-pure suites live outside the editor project; the root workspace
	// configuration collects them without the Svelte plugin.
	const cwd = canary.root === 'repo' ? REPO_ROOT : EDITOR_ROOT;
	const result = spawnSync('npx', ['vitest', 'run', ...canary.tests], {
		cwd,
		encoding: 'utf8',
		env: { ...process.env, CI: '1', NO_COLOR: '1' },
		timeout: 180_000,
	});
	if (result.error) throw result.error;
	const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
	return {
		status: typeof result.status === 'number' ? result.status : 1,
		// The Tests total excludes files that failed before executing a test.
		failures: Number(/^\s*Tests\s+(\d+) failed\b/m.exec(output)?.[1] ?? 0),
	};
}

function runApi(canary) {
	const build = spawnSync('npm', ['run', 'build'], {
		cwd: API_ROOT,
		encoding: 'utf8',
		timeout: 180_000,
	});
	if (build.status !== 0) throw new Error(build.stderr || 'API canary build failed');
	const database = process.env.DATABASE_URL ?? 'postgresql://localhost:5432/biskiq';
	const result = spawnSync('npx', ['vite-node', `tests/${canary.tests[0]}`], {
		cwd: API_ROOT,
		encoding: 'utf8',
		env: { ...process.env, DATABASE_URL: database, NODE_ENV: 'test' },
		timeout: 300_000,
	});
	if (result.error) throw result.error;
	const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
	return {
		status: typeof result.status === 'number' ? result.status : 1,
		// Node can report assertion error codes as TAP fields or inspected properties.
		failures: output.match(/^[ \t]+code: 'ERR_ASSERTION',?\r?$/gm)?.length ?? 0,
	};
}

function main() {
	const options = parseArgs(process.argv.slice(2));
	let canaries = loadCanaries();
	if (options.only) {
		const requested = new Set(options.only.split(','));
		canaries = canaries.filter((canary) => requested.has(canary.id));
		if (canaries.length === 0) throw new Error(`no canary matches ${options.only}`);
	}
	canaries = canaries.filter((canary) => {
		const kind = canary.kind ?? 'vitest';
		return options.kind === 'all' || kind === options.kind;
	});
	if (options.list) {
		for (const canary of canaries) console.log(`${canary.id}\t${canary.title}`);
		return;
	}
	if (options.kind === 'api' || options.kind === 'all') {
		console.log('canaries: building the API once for the DB-backed canaries');
		const build = spawnSync('npm', ['run', 'build'], { cwd: API_ROOT, stdio: 'inherit' });
		if (build.status !== 0) throw new Error('API build failed; API canaries cannot run');
	}

	const startedAt = new Date();
	const results = [];
	for (const canary of canaries) {
		const begin = Date.now();
		let outcome;
		try {
			assertClean(canary.file);
			apply(canary);
			try {
				const run = (canary.kind ?? 'vitest') === 'api' ? runApi(canary) : runVitest(canary);
				outcome =
					run.status === 0
						? { status: 'survived', detail: 'tests passed' }
						: run.failures > 0
							? { status: 'killed', detail: `${run.failures} failing tests` }
							: { status: 'error', detail: `exit ${run.status} without a test failure` };
			} finally {
				restore(canary);
			}
		} catch (error) {
			outcome = { status: 'error', detail: error instanceof Error ? error.message : String(error) };
		}
		const result = {
			...outcome,
			id: canary.id,
			title: canary.title,
			durationMs: Date.now() - begin,
		};
		results.push(result);
		const mark =
			result.status === 'killed'
				? 'KILLED  '
				: result.status === 'survived'
					? 'SURVIVED'
					: 'ERROR   ';
		console.log(`${mark} ${canary.id} (${result.durationMs} ms) — ${result.detail}`);
	}

	const killed = results.filter((result) => result.status === 'killed').length;
	const survived = results.filter((result) => result.status === 'survived');
	const errors = results.filter((result) => result.status === 'error');
	const report = {
		generatedAt: new Date().toISOString(),
		commit: git('rev-parse', 'HEAD').trim(),
		total: results.length,
		killed,
		survived: survived.map((result) => result.id),
		errors: errors.map((result) => result.id),
		results,
	};
	if (options.json) {
		const path = resolve(REPO_ROOT, options.json);
		mkdirSync(resolve(path, '..'), { recursive: true });
		writeFileSync(path, `${JSON.stringify(report, null, 2)}\n`);
	}
	console.log(
		`\ncanaries: ${killed}/${results.length} killed in ${Math.round((Date.now() - startedAt.getTime()) / 1000)} s`,
	);
	if (survived.length > 0)
		console.log(`survived: ${survived.map((result) => result.id).join(', ')}`);
	if (errors.length > 0) console.log(`errors: ${errors.map((result) => result.id).join(', ')}`);
	process.exitCode = survived.length === 0 && errors.length === 0 ? 0 : 1;
}

main();
