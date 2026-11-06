#!/usr/bin/env node
/**
 * Turn per-suite provenance into one run artifact, and refuse to certify it.
 *
 * Every required suite must be present exactly once, must come from one tested
 * commit, and must satisfy the report engine's evidence contract (`validateRun`).
 * A missing artifact, a suite that never started, a collection failure or a
 * runtime/hook error leaves that suite incomplete or absent — so the aggregate
 * fails and the required `merge gate` check is red.
 *
 * Usage:
 *   node tools/harness/aggregate.mjs --dir artifacts --out report.json [--commit <sha>]
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

import { validateRun } from './report.mjs';
import { REQUIRED_SUITES } from './suites.mjs';

/**
 * @param {string} dir
 * @param {{commit?: string|null, now?: Date}} [options]
 */
export function aggregate(dir, options = {}) {
	const problems = [];
	/** @type {Map<string, any>} */
	const bySuite = new Map();
	/** @type {string[]} */
	let files = [];
	try {
		files = readdirSync(dir).filter((name) => name.endsWith('.json'));
	} catch (error) {
		problems.push(`artifact directory unreadable: ${error.message}`);
	}
	for (const file of files) {
		if (file.endsWith('.vitest.json')) continue;
		let provenance;
		try {
			provenance = JSON.parse(readFileSync(join(dir, file), 'utf8'));
		} catch (error) {
			problems.push(`${file}: unreadable provenance (${error.message})`);
			continue;
		}
		if (typeof provenance?.suite !== 'string' || provenance.suite.length === 0) {
			problems.push(`${file}: no suite name`);
			continue;
		}
		if (!REQUIRED_SUITES.includes(provenance.suite)) {
			problems.push(`${file}: ${provenance.suite} is not part of the merge-gate contract`);
			continue;
		}
		if (bySuite.has(provenance.suite)) {
			problems.push(`${file}: duplicate provenance for ${provenance.suite}`);
			continue;
		}
		bySuite.set(provenance.suite, provenance);
	}

	const commits = [...new Set([...bySuite.values()].map((entry) => entry.commit).filter(Boolean))];
	const commit = options.commit ?? commits[0] ?? null;
	if (commits.length > 1) {
		problems.push(`artifacts came from different commits: ${commits.join(', ')}`);
	}
	if (options.commit && commits.some((value) => value !== options.commit)) {
		problems.push(`artifacts were produced for a commit other than ${options.commit}`);
	}

	const suites = REQUIRED_SUITES.map((name) => {
		const provenance = bySuite.get(name);
		if (!provenance) return { name, status: 'missing' };
		const status =
			provenance.status === 'complete' && provenance.exitCode === 0
				? 'complete'
				: provenance.status === 'interrupted'
					? 'interrupted'
					: 'failed';
		return {
			name,
			status,
			exitCode: provenance.exitCode ?? null,
			...(provenance.results ? { results: provenance.results } : {})
		};
	});

	// The aggregate is the gate's certifier: a suite that did not run, failed or
	// was interrupted cannot be certified, even though the report engine treats
	// such a run as valid evidence about capabilities.
	for (const entry of suites) {
		if (entry.status !== 'complete') {
			problems.push(
				`${entry.name} is ${entry.status}; the merge gate requires a complete run`
			);
		}
	}

	const run = {
		commit,
		generatedAt: (options.now ?? new Date()).toISOString(),
		suites
	};
	problems.push(...validateRun(run));
	return { run, problems };
}

function parseArgs(argv) {
	const options = { dir: null, out: 'report.json', commit: null };
	for (let index = 0; index < argv.length; index += 1) {
		const arg = argv[index];
		const next = () => {
			index += 1;
			if (index >= argv.length) throw new Error(`${arg} needs a value`);
			return argv[index];
		};
		if (arg === '--dir') options.dir = next();
		else if (arg === '--out') options.out = next();
		else if (arg === '--commit') options.commit = next();
		else throw new Error(`unknown argument: ${arg}`);
	}
	if (!options.dir) throw new Error('--dir is required');
	return options;
}

function cli() {
	const options = parseArgs(process.argv.slice(2));
	const dir = resolve(options.dir);
	const { run, problems } = aggregate(dir, { commit: options.commit });
	if (problems.length > 0) {
		for (const problem of problems) console.error(`harness gate: ${problem}`);
		console.error(
			`harness gate: run is NOT certifiable (${problems.length} problem${problems.length === 1 ? '' : 's'})`
		);
		process.exitCode = 1;
	} else {
		console.log(
			`harness gate: ${run.suites.length} suites complete at ${run.commit ?? 'unknown commit'}`
		);
	}
	const out = resolve(options.out);
	mkdirSync(dirname(out), { recursive: true });
	writeFileSync(out, `${JSON.stringify(run, null, 2)}\n`);
}

cli();
