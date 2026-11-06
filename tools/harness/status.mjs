#!/usr/bin/env node
/**
 * `npm run status` — the lean scan a new agent starts from.
 *
 * Prints the report's provenance (tested commit, age, suite completeness), then
 * one row per capability: maturity, health, regressions, failing checks, open
 * flags and claims. Nothing here writes status; every value is derived.
 *
 * Usage:
 *   npm run status
 *   node tools/harness/status.mjs --json
 *   node tools/harness/status.mjs --offline            # skip live GitHub reads
 *   node tools/harness/status.mjs --report <path>      # a recorded run
 *   node tools/harness/status.mjs --main-head <sha>    # explicit compare point
 *   node tools/harness/status.mjs --repo-root <path>   # deterministic git fixtures
 *
 * Exit codes: 0 report printed (including all-unknown), 1 invalid ledger,
 * malformed report evidence, or an unreadable input. The report distinguishes
 * "no complete run" from a green one; it never upgrades missing evidence into a
 * pass.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { validateLedger } from './ledger.mjs';
import { buildReport, REQUIRED_SUITES, validateRun } from './report.mjs';

const DEFAULT_ROOT = fileURLToPath(new URL('../../', import.meta.url));

function readJson(path, label) {
	const text = readFileSync(path, 'utf8');
	try {
		return JSON.parse(text);
	} catch (error) {
		throw new Error(`${label} is not valid JSON: ${error.message}`);
	}
}

function run(command, args, cwd) {
	return execFileSync(command, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

/** Read a source file for runner-mode verification; absence is `null`. */
function readSource(file) {
	try {
		return readFileSync(file, 'utf8');
	} catch {
		return null;
	}
}

function parseArgs(argv) {
	const options = {
		repoRoot: DEFAULT_ROOT,
		ledger: null,
		report: null,
		mainRef: 'origin/main',
		mainHead: null,
		json: false,
		offline: false,
		changedPaths: null,
		github: null,
		previous: null
	};
	for (let index = 0; index < argv.length; index += 1) {
		const arg = argv[index];
		const next = () => {
			index += 1;
			if (index >= argv.length) throw new Error(`${arg} needs a value`);
			return argv[index];
		};
		if (arg === '--ledger') options.ledger = next();
		else if (arg === '--report') options.report = next();
		else if (arg === '--main-ref') options.mainRef = next();
		else if (arg === '--main-head') options.mainHead = next();
		else if (arg === '--changed-paths') options.changedPaths = next();
		else if (arg === '--github') options.github = next();
		else if (arg === '--previous') options.previous = next();
		else if (arg === '--repo-root') options.repoRoot = next();
		else if (arg === '--json') options.json = true;
		else if (arg === '--offline') options.offline = true;
		else if (arg === '--help' || arg === '-h') options.help = true;
		else throw new Error(`unknown argument: ${arg}`);
	}
	return options;
}

function mainHeadFor(options) {
	if (options.mainHead) return options.mainHead;
	try {
		return run('git', ['rev-parse', options.mainRef], options.repoRoot);
	} catch {
		return null;
	}
}

/**
 * Normalize `gh ... --json` output (issue/PR objects with `{name}` labels and
 * `{login}` assignees) into the report's shape.
 *
 * Claims are visible for every assignee and every draft PR title that names a
 * capability — the collision scan must reveal work another agent already holds,
 * not just work assigned to the current credential.
 */
export function normaliseGithub(payload) {
	const labelsOf = (labels) =>
		(labels ?? [])
			.map((label) => (typeof label === 'string' ? label : label?.name))
			.filter((name) => typeof name === 'string' && name.length > 0);
	const assigneesOf = (assignees) =>
		(assignees ?? [])
			.map((person) => (typeof person === 'string' ? person : person?.login))
			.filter((login) => typeof login === 'string' && login.length > 0);

	const issues = (Array.isArray(payload?.issues) ? payload.issues : []).map((issue) => ({
		number: issue.number,
		title: issue.title,
		labels: labelsOf(issue.labels),
		assignees: assigneesOf(issue.assignees)
	}));
	const pulls = (Array.isArray(payload?.pulls) ? payload.pulls : []).map((pull) => ({
		number: pull.number,
		title: pull.title,
		isDraft: pull.isDraft === true,
		assignees: assigneesOf(pull.assignees)
	}));

	const claims = [];
	for (const pull of pulls) {
		if (pull.isDraft) claims.push({ number: pull.number, title: pull.title, kind: 'pull' });
	}
	for (const issue of issues) {
		if (issue.assignees.length > 0) {
			claims.push({ number: issue.number, title: issue.title, kind: 'issue' });
		}
	}
	return { available: true, reason: null, issues, claims };
}

/** Live flags and claims. Absence is reported as unavailable, never as empty. */
function readGithub(options) {
	if (options.github) {
		return normaliseGithub(readJson(options.github, 'github fixture'));
	}
	if (options.offline) return { available: false, reason: '--offline', issues: [], claims: [] };
	try {
		const issues = JSON.parse(
			run(
				'gh',
				['issue', 'list', '--state', 'open', '--limit', '200', '--json', 'number,title,labels,assignees'],
				options.repoRoot
			)
		);
		const pulls = JSON.parse(
			run(
				'gh',
				['pr', 'list', '--state', 'open', '--limit', '200', '--json', 'number,title,isDraft,assignees'],
				options.repoRoot
			)
		);
		return normaliseGithub({ issues, pulls });
	} catch (error) {
		return {
			available: false,
			reason: error?.message?.split('\n')[0] ?? 'gh unavailable',
			issues: [],
			claims: []
		};
	}
}

/**
 * Paths main history touched since each review's implementation, or `null` when
 * that history cannot be established.
 *
 * This uses `git log --name-only impl..mainHead` rather than an endpoint diff:
 * a surface change that was later reverted still expired the review, and local
 * branch work outside main must not expire it. Ancestry is verified first; a
 * review commit that is not part of main's history is treated as stale.
 */
export function readChangedPaths(capabilities, { repoRoot, mainHead, changedPathsPath = null }) {
	if (changedPathsPath) {
		return new Map(Object.entries(readJson(changedPathsPath, 'changed-paths file')));
	}
	const map = new Map();
	for (const entry of capabilities) {
		const review = entry.review;
		if (!review || typeof review.implementation !== 'string') continue;
		if (!mainHead) {
			map.set(entry.id, null);
			continue;
		}
		try {
			run('git', ['merge-base', '--is-ancestor', review.implementation, mainHead], repoRoot);
		} catch {
			map.set(entry.id, null);
			continue;
		}
		try {
			const output = run(
				'git',
				['log', '--format=', '--name-only', `${review.implementation}..${mainHead}`],
				repoRoot
			);
			const paths = [...new Set(output.split('\n').map((line) => line.trim()).filter(Boolean))].sort();
			map.set(entry.id, paths);
		} catch {
			map.set(entry.id, null);
		}
	}
	return map;
}

function formatAge(generatedAt, now) {
	if (!generatedAt) return 'unknown age';
	const then = Date.parse(generatedAt);
	if (Number.isNaN(then)) return 'unknown age';
	const minutes = Math.max(0, Math.round((now.getTime() - then) / 60000));
	if (minutes < 1) return 'just now';
	if (minutes < 60) return `${minutes}m old`;
	const hours = Math.round(minutes / 60);
	if (hours < 48) return `${hours}h old`;
	return `${Math.round(hours / 24)}d old`;
}

function printReport(report, now) {
	const tested = report.testedCommit ? report.testedCommit.slice(0, 12) : '(none)';
	const head = report.mainHead ? report.mainHead.slice(0, 12) : '(unknown)';
	const lines = [];
	lines.push('harness status — PR #259');
	lines.push(
		`  tested   ${tested}  ${formatAge(report.generatedAt, now)}${report.generatedAt ? ` (${report.generatedAt})` : ''}`
	);
	lines.push(`  main     ${head}`);
	lines.push(`  complete ${report.complete ? 'yes' : 'no'}`);
	lines.push(
		`  suites   ${
			report.suites.length === 0
				? '(none recorded)'
				: report.suites.map((suite) => `${suite.name}: ${suite.status}`).join(', ')
		}`
	);
	if (!report.complete) {
		const missing = REQUIRED_SUITES.filter(
			(name) => !report.suites.some((suite) => suite.name === name && suite.status === 'complete')
		);
		lines.push(
			`  unknown  no current complete run; ${missing.length > 0 ? `missing: ${missing.join(', ')}` : 'run is not for the current main head'}`
		);
	}
	lines.push(
		`  live     flags+claims: ${
			report.live.flags && report.live.claims ? 'gh' : 'unavailable (status is limited, not clean)'
		}`
	);
	lines.push(`  gate     ${report.gate.failures.length} failing check(s)`);
	if (report.duplicateClaims.length > 0) {
		lines.push(
			`  duplicate claims: ${report.duplicateClaims
				.map((entry) => `${entry.capabilityId} (#${entry.numbers.join(', #')})`)
				.join('; ')}`
		);
	}
	lines.push('');
	lines.push(
		'capability'.padEnd(36) +
			'maturity'.padEnd(10) +
			'health'.padEnd(10) +
			'checks'.padEnd(14) +
			'flags'.padEnd(10) +
			'claims'
	);
	for (const entry of report.capabilities) {
		const checks = `c ${entry.checks.core.passing}/${entry.checks.core.total} e ${entry.checks.edge.passing}/${entry.checks.edge.total}`;
		const flags = entry.flags.length > 0 ? entry.flags.map((n) => `#${n}`).join(',') : '-';
		const claims = entry.claims.length > 0 ? entry.claims.map((n) => `#${n}`).join(',') : '-';
		lines.push(
			entry.id.padEnd(36) +
				`${entry.maturity}${entry.regressed ? '!' : ''}`.padEnd(10) +
				entry.health.padEnd(10) +
				checks.padEnd(14) +
				flags.padEnd(10) +
				claims
		);
		for (const check of entry.failingChecks) {
			lines.push(`  failing: ${check.level} ${check.name} (${check.file}) [${check.status}]`);
		}
	}
	for (const failure of report.gate.failures) {
		lines.push(`  gate: ${failure.name} — ${failure.reason}`);
	}
	lines.push('');
	lines.push('! = regressed since the previous complete report');
	return lines.join('\n');
}

function main() {
	const options = parseArgs(process.argv.slice(2));
	if (options.help) {
		process.stdout.write(
			'Usage: node tools/harness/status.mjs [--json] [--offline] [--report <path>] [--ledger <path>] [--main-ref <ref>] [--main-head <sha>] [--repo-root <path>] [--changed-paths <json>] [--github <json>] [--previous <json>]\n'
		);
		return 0;
	}

	const ledgerPath = options.ledger ?? join(options.repoRoot, 'capabilities.json');
	const reportPath = options.report ?? join(options.repoRoot, '.harness/report.json');

	let ledger;
	try {
		ledger = readJson(ledgerPath, 'capabilities ledger');
	} catch (error) {
		process.stderr.write(`status: ${error.message}\n`);
		return 1;
	}
	const problems = validateLedger(ledger);
	if (problems.length > 0) {
		process.stderr.write(`status: invalid capability ledger (${ledgerPath})\n`);
		for (const problem of problems) process.stderr.write(`  - ${problem}\n`);
		return 1;
	}

	let reportRun = null;
	try {
		reportRun = readJson(reportPath, 'harness report');
	} catch (error) {
		// A missing report is honest absence, not a failure: everything is unknown.
		if (error?.code !== 'ENOENT') {
			process.stderr.write(`status: ${error.message}\n`);
			return 1;
		}
	}
	if (reportRun !== null) {
		const evidenceProblems = validateRun(reportRun);
		if (evidenceProblems.length > 0) {
			process.stderr.write(`status: unusable harness report (${reportPath})\n`);
			for (const problem of evidenceProblems) process.stderr.write(`  - ${problem}\n`);
			return 1;
		}
	}

	const github = readGithub(options);
	const previous = options.previous ? readJson(options.previous, 'previous report') : null;
	const mainHead = mainHeadFor(options);
	const changedPaths = readChangedPaths(ledger.capabilities, {
		repoRoot: options.repoRoot,
		mainHead,
		changedPathsPath: options.changedPaths
	});
	const report = buildReport({
		ledger,
		run: reportRun,
		mainHead,
		issues: github.issues,
		claims: github.claims,
		previous,
		changedPaths,
		readSource,
		live: { flags: github.available, claims: github.available }
	});

	if (options.json) {
		process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
	} else {
		process.stdout.write(`${printReport(report, new Date())}\n`);
		if (!github.available) {
			process.stdout.write(`\nflags/claims unavailable: ${github.reason}\n`);
		}
	}
	return 0;
}

process.exitCode = main();
