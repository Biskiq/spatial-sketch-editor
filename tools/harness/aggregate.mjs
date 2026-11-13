#!/usr/bin/env node
/**
 * Turn per-suite provenance into one certifiable run — or refuse.
 *
 * Certification checks are cumulative and independent:
 *
 *   provenance  every required suite exactly once, one commit, contract command,
 *               no test-only override, no producer error or interrupt
 *   evidence    `validateRun`: real reporter/TAP artifacts, no runtime/hook
 *               failures, no collection losses, zero skipped API contracts
 *   markers     `gateFailures`: a stale or unverified known-failing marker, a
 *               failing/skipped tagged check, never reads green just because the
 *               runner exited zero
 *
 * Usage:
 *   node tools/harness/aggregate.mjs --dir artifacts --out report.json --commit <sha>
 *     [--ledger capabilities.json] [--issues open-issues.json]
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

import { validateLedger } from './ledger.mjs';
import { collectChecks, gateFailures, validateRun } from './report.mjs';
import { FOCUSED_SUITE, REQUIRED_SUITES, expectedCommand, requiredSuites, suiteFor } from './suites.mjs';

const COMMIT = /^[0-9a-f]{7,40}$/;
const STATUSES = new Set(['complete', 'failed', 'interrupted']);

/** Runner-mode verification reads the checkout the producer ran in. */
function readSource(file) {
	try {
		return readFileSync(file, 'utf8');
	} catch {
		return null;
	}
}

/**
 * @param {string} dir
 * @param {{commit?: string|null, ledger?: string|null, issues?: string|null, now?: Date}} [options]
 */
export function aggregate(dir, options = {}) {
	const problems = [];
	const profile = options.plan?.profile ?? 'full';
	const required = requiredSuites(profile);
	const names = options.plan ? [...REQUIRED_SUITES, FOCUSED_SUITE.name] : REQUIRED_SUITES;
	/** @type {Map<string, any>} */
	const bySuite = new Map();
	/** @type {string[]} */
	let files = [];
	try {
		files = readdirSync(dir).filter(
			(name) => name.endsWith('.json') && !name.endsWith('.vitest.json')
		);
	} catch (error) {
		if (required.length || error.code !== 'ENOENT') problems.push(`artifact directory unreadable: ${error.message}`);
	}

	for (const file of files) {
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
		if (!required.includes(provenance.suite)) {
			problems.push(`${file}: ${provenance.suite} is not part of the merge-gate contract`);
			continue;
		}
		if (bySuite.has(provenance.suite)) {
			problems.push(`${file}: duplicate provenance for ${provenance.suite}`);
			continue;
		}
		bySuite.set(provenance.suite, provenance);
	}

	// One record's evidence never supplies another's. Each record must stand on
	// its own: its own tested commit, its own command, its own exit status.
	for (const [name, provenance] of bySuite) {
		const suite = suiteFor(name);
		if (provenance.override === true) {
			problems.push(`${name}: a test-only command override cannot certify a run`);
		}
		if (typeof provenance.commit !== 'string' || !COMMIT.test(provenance.commit)) {
			problems.push(`${name}: provenance has no tested commit`);
		} else if (options.commit && provenance.commit !== options.commit) {
			problems.push(`${name}: provenance is for ${provenance.commit}, not ${options.commit}`);
		}
		if (typeof provenance.command !== 'string') {
			problems.push(`${name}: provenance has no recorded command`);
		} else if (!provenance.command.startsWith(expectedCommand(suite))) {
			problems.push(`${name}: command does not match the suite contract`);
		}
		if (typeof provenance.exitCode !== 'number') {
			problems.push(`${name}: provenance has no exit code`);
		}
		if (!STATUSES.has(provenance.status)) {
			problems.push(`${name}: provenance has an unknown status`);
		}
		if (provenance.error) {
			problems.push(`${name}: producer reported ${provenance.error}`);
		}
		if (provenance.signal) {
			problems.push(`${name}: runner was interrupted by ${provenance.signal}`);
		}
	}

	const commits = [...new Set([...bySuite.values()].map((entry) => entry.commit).filter(Boolean))];
	const commit = options.plan?.head ?? options.commit ?? commits[0] ?? null;
	if (commits.length > 1) {
		problems.push(`artifacts came from different commits: ${commits.join(', ')}`);
	}
	if (options.commit && commits.some((value) => value !== options.commit)) {
		problems.push(`artifacts were produced for a commit other than ${options.commit}`);
	}

	const focused = bySuite.get(FOCUSED_SUITE.name);
	if (focused) {
		const actual = focused.results?.testResults?.map(({ name }) =>
			name?.split('/apps/editor/').at(-1)).sort();
		const expected = options.testFiles;
		const command = `${expectedCommand(FOCUSED_SUITE)} ${expected.join(' ')} --reporter=json --outputFile=`;
		if (!focused.command?.startsWith(command) || JSON.stringify(actual) !== JSON.stringify(expected) ||
			focused.results?.success !== true) {
			problems.push('focused evidence does not match the selected test files and command');
		}
	}

	const suites = names.map((name) => {
		if (!required.includes(name)) return { name, status: 'not applicable' };
		const provenance = bySuite.get(name);
		if (!provenance) return { name, status: 'missing' };
		const status =
			provenance.status === 'complete' && provenance.exitCode === 0
				? 'complete'
				: provenance.status === 'interrupted' || provenance.signal
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
		if (required.includes(entry.name) && entry.status !== 'complete') {
			problems.push(`${entry.name} is ${entry.status}; the merge gate requires a complete run`);
		}
	}

	// The marker contract is part of the gate, not only of the report: a stale
	// marker or a skipped tagged check leaves the suite green, so it can only be
	// caught here.
	const checks = [];
	for (const provenance of bySuite.values()) {
		if (Array.isArray(provenance.results?.testResults)) {
			checks.push(...collectChecks(provenance.results, { readSource }));
		}
	}
	for (const failure of gateFailures(checks)) {
		problems.push(`${failure.file || 'tagged check'}: ${failure.reason}`);
	}

	const run = {
		commit,
		generatedAt: (options.now ?? new Date()).toISOString(),
		suites
	};
	if (options.plan) {
		run.profile = profile;
		run.base = options.plan.base ?? null;
		const guardRequired = options.eventName === 'merge_group' ||
			(options.eventName === 'pull_request' && profile === 'full');
		const expectedJobs = {
			prepare: 'success',
			guards: guardRequired ? 'success' : 'skipped',
			suite: profile === 'full' ? 'success' : 'skipped',
			api: profile === 'full' ? 'success' : 'skipped',
			goldens: profile === 'full' ? 'success' : 'skipped',
			focused: profile === 'focused' ? 'success' : 'skipped'
		};
		for (const [job, result] of Object.entries(expectedJobs)) {
			if (options.jobs?.[job]?.result !== result) {
				problems.push(`${job}: expected ${result}, got ${options.jobs?.[job]?.result ?? 'missing'}`);
			}
		}
		if (options.jobs?.prepare?.outputs?.profile !== profile ||
			(options.jobs?.prepare?.outputs?.base ?? '') !== (options.plan.base ?? '')) {
			problems.push('prepare output does not match the independently resolved event plan');
		}
		run.goldens = profile === 'full' ? (options.jobs?.goldens?.result ?? 'missing') : 'not applicable';
	}
	// The artifact carries the definitions and issue state that produced this
	// run. A later status scan can then compare like with like at the previous
	// commit instead of rebuilding history from today's ledger and live bugs.
	if (options.ledger) {
		try {
			const snapshot = JSON.parse(readFileSync(resolve(options.ledger), 'utf8'));
			const ledgerProblems = validateLedger(snapshot);
			if (ledgerProblems.length > 0) {
				problems.push(`ledger snapshot is invalid: ${ledgerProblems[0]}`);
			} else {
				run.ledger = snapshot;
			}
		} catch (error) {
			problems.push(`ledger snapshot is unreadable: ${error.message}`);
		}
	}
	if (options.issues) {
		try {
			const snapshot = JSON.parse(readFileSync(resolve(options.issues), 'utf8'));
			if (!Array.isArray(snapshot)) {
				problems.push('issue snapshot must be an array');
			} else {
				run.issues = snapshot;
			}
		} catch (error) {
			problems.push(`issue snapshot is unreadable: ${error.message}`);
		}
	}
	problems.push(...validateRun(run));
	return { run, problems };
}

function parseArgs(argv) {
	const options = { dir: null, out: 'report.json', commit: null, ledger: null, issues: null };
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
		else if (arg === '--ledger') options.ledger = next();
		else if (arg === '--issues') options.issues = next();
		else throw new Error(`unknown argument: ${arg}`);
	}
	if (!options.dir) throw new Error('--dir is required');
	return options;
}

async function cli() {
	const options = parseArgs(process.argv.slice(2));
	const dir = resolve(options.dir);
	let ci = {};
	if (process.env.CI_GATE_JOBS !== undefined) {
		const { eventPlan } = await import('./plan.mjs');
		const plan = eventPlan();
		const { focusedFiles } = await import('./focused.mjs');
		ci = {
			plan,
			jobs: JSON.parse(process.env.CI_GATE_JOBS),
			eventName: process.env.GITHUB_EVENT_NAME,
			testFiles: plan.profile === 'focused' ? focusedFiles(plan) : []
		};
	}
	const { run, problems } = aggregate(dir, {
		...ci,
		commit: ci.plan?.head ?? options.commit,
		ledger: options.ledger,
		issues: options.issues
	});
	if (problems.length > 0) {
		for (const problem of problems) console.error(`harness gate: ${problem}`);
		console.error(
			`harness gate: run is NOT certifiable (${problems.length} problem${problems.length === 1 ? '' : 's'})`
		);
		process.exitCode = 1;
	} else {
		console.log(
			`harness gate: ${run.profile ?? 'full'} verification complete at ${run.commit ?? 'unknown commit'}`
		);
	}
	const out = resolve(options.out);
	mkdirSync(dirname(out), { recursive: true });
	writeFileSync(out, `${JSON.stringify(run, null, 2)}\n`);
}

cli();
