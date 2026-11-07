#!/usr/bin/env node
/**
 * Run one merge-gate suite and persist its provenance.
 *
 * The gate must not depend on a reporter summary surviving someone's log
 * slicing. For every suite the producer records the command, the tested commit,
 * start/completion times, the child's exit code and signal, stdout/stderr tails
 * and — for test suites — the runner's own artifact. A suite that fails still
 * writes its artifact, so the aggregate can tell "failed" from "never ran"
 * instead of silently dropping a red job.
 *
 * Usage:
 *   node tools/harness/produce.mjs --suite "npm test" --artifact-dir .harness/artifacts
 *   node tools/harness/produce.mjs --suite "npm run check" -- node -e "process.exit(2)"
 *
 * Exit code: the suite's own exit code (1 when it could not be started), so the
 * job is red while the provenance file remains available to the gate.
 */
import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { suiteFor } from './suites.mjs';

const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));
const OUTPUT_LIMIT = 200_000;

function parseArgs(argv) {
	const options = { artifactDir: '.harness/artifacts', commit: null, suite: null };
	const separator = argv.indexOf('--');
	const own = separator === -1 ? argv : argv.slice(0, separator);
	options.override = separator === -1 ? [] : argv.slice(separator + 1);
	for (let index = 0; index < own.length; index += 1) {
		const arg = own[index];
		const next = () => {
			index += 1;
			if (index >= own.length) throw new Error(`${arg} needs a value`);
			return own[index];
		};
		if (arg === '--suite') options.suite = next();
		else if (arg === '--artifact-dir') options.artifactDir = next();
		else if (arg === '--commit') options.commit = next();
		else throw new Error(`unknown argument: ${arg}`);
	}
	if (!options.suite) throw new Error('--suite is required');
	return options;
}

function headCommit() {
	if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA;
	try {
		return execFileSync('git', ['rev-parse', 'HEAD'], {
			cwd: REPO_ROOT,
			encoding: 'utf8'
		}).trim();
	} catch {
		return null;
	}
}

function appendTail(previous, chunk) {
	const next = previous + chunk;
	return next.length > OUTPUT_LIMIT ? next.slice(-OUTPUT_LIMIT) : next;
}

/**
 * Count node:test TAP results. Top-level results start at column 0; subtest
 * lines are indented and must not inflate the contract's test count.
 *
 * @param {string} text
 */
export function parseTap(text) {
	let tests = 0;
	let passed = 0;
	let failed = 0;
	let skipped = 0;
	for (const line of text.split('\n')) {
		const match = /^\s*(not )?ok\s+\d+/.exec(line);
		if (!match) continue;
		// A nested subtest skip still means a contract did not execute; count the
		// skip, but keep the test total to top-level contracts.
		if (/#\s*SKIP\b/i.test(line)) {
			skipped += 1;
			if (/^\s/.test(line)) continue;
			tests += 1;
			continue;
		}
		if (/^\s/.test(line)) continue;
		tests += 1;
		if (match[1]) failed += 1;
		else passed += 1;
	}
	return { tests, passed, failed, skipped };
}

/** @param {string} path */
function readResults(path) {
	try {
		return JSON.parse(readFileSync(path, 'utf8'));
	} catch {
		return null;
	}
}

async function main() {
	const options = parseArgs(process.argv.slice(2));
	const suite = suiteFor(options.suite);
	const artifactDir = resolve(REPO_ROOT, options.artifactDir);
	mkdirSync(artifactDir, { recursive: true });
	const resultsPath = join(artifactDir, `${suite.slug}.vitest.json`);

	/** @type {string[]} */
	let command;
	let args;
	if (options.override.length > 0) {
		[command, ...args] = options.override;
	} else if (suite.kind === 'vitest') {
		[command, ...args] = suite.args;
	} else {
		command = 'npm';
		args = ['run', suite.script];
	}
	if (suite.kind === 'vitest') {
		args = [...args, '--reporter=json', `--outputFile=${resultsPath}`];
	}

	const startedAt = new Date();
	const startedMs = Date.now();
	let stdout = '';
	let stderr = '';
	let spawnError = null;

	const child = spawn(command, args, {
		cwd: resolve(REPO_ROOT, suite.cwd ?? '.'),
		env: process.env,
		stdio: ['ignore', 'pipe', 'pipe']
	});
	child.stdout.on('data', (chunk) => {
		stdout = appendTail(stdout, chunk.toString());
		process.stdout.write(chunk);
	});
	child.stderr.on('data', (chunk) => {
		stderr = appendTail(stderr, chunk.toString());
		process.stderr.write(chunk);
	});
	child.on('error', (error) => {
		spawnError = error;
	});

	const { code, signal } = await new Promise((resolveExit) => {
		child.on('close', (exitCode, exitSignal) => resolveExit({ code: exitCode, signal: exitSignal }));
	});

	const completedAt = new Date();
	const exitCode = typeof code === 'number' ? code : 1;
	const status = spawnError || signal ? 'interrupted' : exitCode === 0 ? 'complete' : 'failed';

	/** @type {any} */
	let results;
	let error = spawnError ? `could not start ${command}: ${spawnError.message}` : null;
	if (!error && suite.kind === 'vitest') {
		results = readResults(resultsPath);
		if (!results) error = `vitest reporter artifact missing or unreadable: ${resultsPath}`;
	} else if (!error && suite.kind === 'tap') {
		results = parseTap(stdout);
	}

	const provenance = {
		suite: suite.name,
		command: [command, ...args].join(' '),
		// Test-only command overrides remain visible, and the aggregate refuses
		// to certify a run whose evidence came from one.
		override: options.override.length > 0,
		commit: options.commit ?? headCommit(),
		startedAt: startedAt.toISOString(),
		completedAt: completedAt.toISOString(),
		durationMs: Date.now() - startedMs,
		exitCode,
		signal: signal ?? null,
		status,
		error,
		results: results ?? null,
		output: { stdoutTail: stdout.slice(-2000), stderrTail: stderr.slice(-2000) }
	};
	const outputPath = join(artifactDir, `${suite.slug}.json`);
	writeFileSync(outputPath, `${JSON.stringify(provenance, null, 2)}\n`);
	console.log(`harness: ${suite.name} ${status} (exit ${exitCode}) -> ${outputPath}`);
	process.exitCode = exitCode;
}

main().catch((error) => {
	console.error(`harness producer: ${error.message}`);
	process.exitCode = 1;
});
