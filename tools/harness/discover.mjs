/**
 * Discover the report the merge gate actually published for main.
 *
 * A fresh checkout has no `.harness/report.json`; the only certifying evidence
 * lives in the `harness-report` artifact of a successful `Merge gate` push run.
 * Discovery is deliberately narrower than "latest successful run":
 *
 * - the workflow must be `merge-gate.yml` and the run a completed `push` on main;
 * - its `headSha` must be the current main head for current evidence, or an
 *   ancestor of it for the previous report;
 * - the `harness-report` artifact must exist and be unexpired;
 * - the artifact must contain a complete required-suite run whose recorded
 *   commit is exactly the run's `headSha`.
 *
 * A pull-request run is never eligible, even when its synthetic merge commit is
 * green: it is not main's history. Missing, stale, malformed or incomplete
 * evidence is returned as absent with a reason, never upgraded to a green run.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { REQUIRED_SUITES, validateRun } from './report.mjs';

const WORKFLOW = 'merge-gate.yml';
const WORKFLOW_NAME = 'Merge gate';
const REPORT_ARTIFACT = 'harness-report';
const SHA = /^[0-9a-f]{7,40}$/;

function gh(args, cwd) {
	return execFileSync('gh', args, {
		cwd,
		encoding: 'utf8',
		stdio: ['ignore', 'pipe', 'pipe']
	}).trim();
}

function ghJson(args, cwd) {
	return JSON.parse(gh(args, cwd));
}

function isMainRun(run) {
	return (
		typeof run === 'object' &&
		run !== null &&
		run.workflowName === WORKFLOW_NAME &&
		run.event === 'push' &&
		run.headBranch === 'main' &&
		run.status === 'completed' &&
		run.conclusion === 'success' &&
		typeof run.databaseId === 'number' &&
		typeof run.headSha === 'string' &&
		SHA.test(run.headSha)
	);
}

function isCompleteRun(run) {
	if (validateRun(run).length > 0) return false;
	const suites = Array.isArray(run.suites) ? run.suites : [];
	return REQUIRED_SUITES.every((name) =>
		suites.some((suite) => suite?.name === name && suite?.status === 'complete')
	);
}

function isAncestor(commit, head, cwd) {
	try {
		execFileSync('git', ['merge-base', '--is-ancestor', commit, head], {
			cwd,
			stdio: ['ignore', 'pipe', 'pipe']
		});
		return true;
	} catch {
		return false;
	}
}

function findReport(dir) {
	const direct = join(dir, 'report.json');
	try {
		return { path: direct, text: readFileSync(direct, 'utf8') };
	} catch {
		// The artifact may be extracted under a nested directory.
	}
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		if (!entry.isDirectory()) continue;
		const nested = findReport(join(dir, entry.name));
		if (nested !== null) return nested;
	}
	return null;
}

/** Fetch and independently validate one run's report artifact. */
function fetchReport(run, repoRoot, tempRoot) {
	let artifacts;
	try {
		artifacts = ghJson(
			['api', `repos/{owner}/{repo}/actions/runs/${run.databaseId}/artifacts`],
			repoRoot
		);
	} catch (error) {
		return { run: null, reason: `artifact list failed: ${error.message.split('\n')[0]}` };
	}
	const artifact = (Array.isArray(artifacts?.artifacts) ? artifacts.artifacts : []).find(
		(entry) => entry?.name === REPORT_ARTIFACT && entry?.expired !== true
	);
	if (!artifact) return { run: null, reason: `${REPORT_ARTIFACT} artifact is missing or expired` };

	const dir = mkdtempSync(join(tempRoot, 'harness-report-'));
	try {
		gh(
			['run', 'download', String(run.databaseId), '--name', REPORT_ARTIFACT, '--dir', dir],
			repoRoot
		);
		const found = findReport(dir);
		if (found === null) return { run: null, reason: `${REPORT_ARTIFACT} artifact has no report.json` };
		let report;
		try {
			report = JSON.parse(found.text);
		} catch (error) {
			return { run: null, reason: `report.json is not valid JSON: ${error.message}` };
		}
		const problems = validateRun(report);
		if (problems.length > 0) {
			return { run: null, reason: `report is not certifiable: ${problems[0]}` };
		}
		if (!isCompleteRun(report)) {
			return { run: null, reason: 'report does not contain every required complete suite' };
		}
		if (report.commit !== run.headSha) {
			return {
				run: null,
				reason: `report commit ${report.commit} does not match run head ${run.headSha}`
			};
		}
		return {
			run: report,
			runId: run.databaseId,
			url: typeof run.url === 'string' ? run.url : null,
			artifactId: artifact.id ?? null
		};
	} catch (error) {
		return { run: null, reason: `artifact download failed: ${error.message.split('\n')[0]}` };
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
}

/**
 * @param {{repoRoot: string, mainHead: string, tempRoot?: string}} input
 * @returns {{
 *   current: any|null,
 *   previous: any|null,
 *   reason: string|null
 * }}
 */
export function discoverMainEvidence({ repoRoot, mainHead, tempRoot = tmpdir() }) {
	if (typeof mainHead !== 'string' || !SHA.test(mainHead)) {
		return { current: null, previous: null, reason: 'main head is unknown; cannot discover main evidence' };
	}

	let runs;
	try {
		runs = ghJson(
			[
				'run',
				'list',
				'--workflow',
				WORKFLOW,
				'--branch',
				'main',
				'--event',
				'push',
				'--limit',
				'30',
				'--json',
				'databaseId,workflowName,event,status,conclusion,headSha,headBranch,createdAt,url'
			],
			repoRoot
		);
	} catch (error) {
		return { current: null, previous: null, reason: `gh run discovery failed: ${error.message.split('\n')[0]}` };
	}
	if (!Array.isArray(runs)) {
		return { current: null, previous: null, reason: 'gh returned no run list' };
	}

	const candidates = runs
		.filter(isMainRun)
		.sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));

	let current = null;
	let reason = `no successful ${WORKFLOW_NAME} push run for main head ${mainHead}`;
	for (const run of candidates.filter((entry) => entry.headSha === mainHead)) {
		const fetched = fetchReport(run, repoRoot, tempRoot);
		if (fetched.run !== null) {
			current = fetched;
			reason = null;
			break;
		}
		reason = fetched.reason;
	}

	let previous = null;
	for (const run of candidates) {
		// The current head is not "previous", even when a re-run exists for it.
		if (run.headSha === mainHead) continue;
		if (!isAncestor(run.headSha, mainHead, repoRoot)) continue;
		const fetched = fetchReport(run, repoRoot, tempRoot);
		if (fetched.run !== null) {
			previous = fetched;
			break;
		}
	}

	return { current, previous, reason };
}
