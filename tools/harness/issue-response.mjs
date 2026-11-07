#!/usr/bin/env node
/**
 * Bounded event response for a blocking-bug guard violation.
 *
 * A failing read-only workflow does not undo an unauthorized label removal or
 * closure, and `npm run status` would read the changed state and clear health.
 * This evaluates the live issue before touching it, so an owner approval or a
 * real fixing closure that arrived while the job was queued is respected. Fix
 * evidence is bound to the live closure: if the saved `closedAt` is not the
 * issue's current `closed_at`, the closure is re-read before evaluating, so a
 * newer manual close is never certified by an old fix and a newer fixing close
 * is never reopened on old no-fix evidence.
 *
 *   - read current issue state;
 *   - refresh evidence when the live closure changed, then evaluate it;
 *   - if no violation remains, report it superseded and write nothing;
 *   - otherwise revalidate (refreshing again if needed) immediately before
 *     writing, then restore the removed `blocks-core`/`bug` label or reopen an
 *     unauthorized close;
 *   - read back and only claim `restored` when the blocking state is confirmed.
 *
 * Exit codes: 0 no violation or superseded, 1 restored (owner approval or a real
 * fix still required), 2 event/read/write/readback failure — never a claim of
 * restoration without a confirmed readback.
 *
 * Usage:
 *   node tools/harness/issue-response.mjs --event-file event.json \
 *     --linked-fixes linked-fixes.json --out result.json [--gh gh]
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import { OWNER_LABEL, evaluateIssueEvent, hasFixEvidence, issueLabels } from './issue-rules.mjs';
import { readClosure } from './linked-fixes.mjs';

function parseArgs(argv) {
	const options = {
		eventFile: null,
		linkedFixes: null,
		out: null,
		gh: 'gh',
		repo: process.env.GITHUB_REPOSITORY ?? null
	};
	for (let index = 0; index < argv.length; index += 1) {
		const arg = argv[index];
		const next = () => {
			index += 1;
			if (index >= argv.length) throw new Error(`${arg} needs a value`);
			return argv[index];
		};
		if (arg === '--event-file') options.eventFile = next();
		else if (arg === '--linked-fixes') options.linkedFixes = next();
		else if (arg === '--out') options.out = next();
		else if (arg === '--gh') options.gh = next();
		else if (arg === '--repo') options.repo = next();
		else throw new Error(`unknown argument: ${arg}`);
	}
	if (!options.eventFile || !options.out) throw new Error('--event-file and --out are required');
	if (!options.repo) throw new Error('--repo or GITHUB_REPOSITORY is required');
	return options;
}

function readJson(path) {
	if (!path) return null;
	try {
		return JSON.parse(readFileSync(path, 'utf8'));
	} catch {
		return { unreadable: true };
	}
}

/** @param {string} gh @param {string[]} args */
function ghJson(gh, args) {
	return JSON.parse(execFileSync(gh, args, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 }));
}

function supersededReason(event, issue, linkedFixes) {
	const labels = issueLabels(issue);
	if (labels.includes(OWNER_LABEL)) return 'owner-approved';
	if (event.action === 'closed' && issue.state !== 'closed') return 'not-closed';
	if (event.action === 'unlabeled' && labels.includes(event.label?.name)) return 'already-restored';
	if (event.action === 'closed' && hasFixEvidence(linkedFixes) > 0) return 'fixing-closure';
	return 'superseded';
}

function sameClosure(evidence, issue) {
	return (
		evidence &&
		evidence.unreadable !== true &&
		typeof evidence.closedAt === 'string' &&
		typeof issue.closed_at === 'string' &&
		Date.parse(evidence.closedAt) === Date.parse(issue.closed_at)
	);
}

/**
 * Return evidence for the live closure. Saved evidence is kept only when its
 * `closedAt` is the issue's current `closed_at`; otherwise the closure is
 * re-read, and a failed refresh is explicitly unreadable (never trusted).
 */
function currentEvidence(event, issue, saved, options) {
	if (
		event.action !== 'closed' ||
		issue.state !== 'closed' ||
		sameClosure(saved, issue)
	) {
		return { evidence: saved, refreshed: false };
	}
	try {
		return {
			evidence: readClosure({ gh: options.gh, repo: options.repo, issue: event.issue.number }),
			refreshed: true
		};
	} catch (error) {
		return {
			evidence: { unreadable: true, reason: error.message.split('\n')[0] },
			refreshed: true
		};
	}
}

function main() {
	const options = parseArgs(process.argv.slice(2));
	const out = resolve(options.out);
	mkdirSync(dirname(out), { recursive: true });
	const event = readJson(options.eventFile);
	const savedEvidence = readJson(options.linkedFixes);
	const result = {
		action: event?.action ?? null,
		issue: event?.issue?.number ?? null,
		violations: [],
		superseded: null,
		restored: null,
		fixEvidence: savedEvidence?.unreadable === true ? 'unreadable' : 'readable',
		closure: { savedClosedAt: savedEvidence?.closedAt ?? null, liveClosedAt: null, refreshed: false }
	};
	const finish = (exitCode) => {
		writeFileSync(out, `${JSON.stringify(result, null, 2)}\n`);
		for (const violation of result.violations) console.error(`guard: ${violation.reason}`);
		if (result.superseded) console.error(`guard: event superseded (${result.superseded})`);
		if (result.restored) {
			console.error(
				'guard: blocking state restored; owner approval or a linked fixing change is still required'
			);
		}
		if (result.error) console.error(`guard: ${result.error}`);
		process.exitCode = exitCode;
	};

	if (!event || event.unreadable || !event.issue?.number) {
		result.error = 'issue event could not be read';
		finish(2);
		return;
	}
	if (event.action !== 'unlabeled' && event.action !== 'closed') {
		result.superseded = 'not-a-guard-event';
		finish(0);
		return;
	}

	const issuesPath = `repos/${options.repo}/issues/${event.issue.number}`;
	const readIssue = () => ghJson(options.gh, ['api', issuesPath]);

	let current;
	try {
		current = readIssue();
	} catch (error) {
		result.error = `could not read current issue state: ${error.message.split('\n')[0]}`;
		finish(2);
		return;
	}
	result.closure.liveClosedAt = current.closed_at ?? null;
	let ensured = currentEvidence(event, current, savedEvidence, options);
	result.closure.refreshed = ensured.refreshed;
	result.fixEvidence = ensured.evidence?.unreadable === true ? 'unreadable' : 'readable';
	result.violations = evaluateIssueEvent({ event: { ...event, issue: current }, linkedFixes: ensured.evidence });
	if (result.violations.length === 0) {
		result.superseded = supersededReason(event, current, ensured.evidence);
		finish(0);
		return;
	}

	// Revalidate immediately before writing: the queue delay may have delivered
	// an owner approval or a different closure.
	try {
		current = readIssue();
	} catch (error) {
		result.error = `could not revalidate before writing: ${error.message.split('\n')[0]}`;
		finish(2);
		return;
	}
	ensured = currentEvidence(event, current, ensured.evidence, options);
	result.closure.liveClosedAt = current.closed_at ?? null;
	result.closure.refreshed = result.closure.refreshed || ensured.refreshed;
	result.fixEvidence = ensured.evidence?.unreadable === true ? 'unreadable' : 'readable';
	result.violations = evaluateIssueEvent({ event: { ...event, issue: current }, linkedFixes: ensured.evidence });
	if (result.violations.length === 0) {
		result.superseded = supersededReason(event, current, ensured.evidence);
		finish(0);
		return;
	}

	try {
		if (event.action === 'unlabeled') {
			const removed = event.label?.name;
			if (removed && !issueLabels(current).includes(removed)) {
				ghJson(options.gh, ['api', `${issuesPath}/labels`, '-f', `labels[]=${removed}`]);
			}
		}
		if (event.action === 'closed') {
			ghJson(options.gh, ['api', issuesPath, '-X', 'PATCH', '-f', 'state=open']);
		}
		const afterWrite = readIssue();
		if (!issueLabels(afterWrite).includes('blocks-core')) {
			ghJson(options.gh, ['api', `${issuesPath}/labels`, '-f', 'labels[]=blocks-core']);
		}
		const confirmed = readIssue();
		result.state = { state: confirmed.state, labels: issueLabels(confirmed) };
		result.restored =
			issueLabels(confirmed).includes('blocks-core') &&
			(event.action !== 'closed' || confirmed.state === 'open');
		if (!result.restored) {
			result.error = 'readback did not confirm the blocking state';
			finish(2);
			return;
		}
		finish(1);
	} catch (error) {
		result.restored = false;
		const detail = String(error.stderr || error.message).trim().split('\n')[0];
		result.error = detail;
		finish(2);
	}
}

main();
