#!/usr/bin/env node
/**
 * Bounded event response for a blocking-bug guard violation.
 *
 * A failing read-only workflow does not undo an unauthorized label removal or
 * closure, and `npm run status` would read the changed state and clear health.
 * On a violation this restores the blocking truth with the minimum change:
 *
 *   - re-add the removed `blocks-core`/`bug` label;
 *   - reopen a `blocks-core` issue closed without a fixing change;
 *
 * then reads the issue back and only reports success when the state actually
 * shows the blocking label / open state. Exit codes: 0 no violation, 1 restored
 * (owner approval or a real fix still required), 2 restoration/readback failed.
 *
 * Usage:
 *   node tools/harness/issue-response.mjs --event-file event.json \
 *     --linked-fixes linked-fixes.json --out result.json [--rsvp 7] [--gh gh]
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import { evaluateIssueEvent } from './issue-rules.mjs';

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

function labelsOf(issue) {
	return Array.isArray(issue?.labels)
		? issue.labels.map((label) => (typeof label === 'string' ? label : label?.name))
		: [];
}

function main() {
	const options = parseArgs(process.argv.slice(2));
	const event = readJson(options.eventFile);
	const linkedFixes = readJson(options.linkedFixes);
	const issuesPath = `repos/${options.repo}/issues/${event.issue.number}`;
	const violations = evaluateIssueEvent({ event, linkedFixes });

	const result = { action: event.action, issue: event.issue.number, violations, restored: null };
	let exitCode = 0;
	if (violations.length > 0) {
		exitCode = 1;
		try {
			const restoreLabels = [];
			if (event.action === 'unlabeled') {
				restoreLabels.push(event.label?.name === 'bug' ? 'bug' : 'blocks-core');
			}
			for (const label of restoreLabels) {
				ghJson(options.gh, ['api', `${issuesPath}/labels`, '-f', `labels[]=${label}`]);
			}
			if (event.action === 'closed') {
				ghJson(options.gh, ['api', issuesPath, '-X', 'PATCH', '-f', 'state=open']);
			}

			const current = ghJson(options.gh, ['api', issuesPath]);
			const labels = labelsOf(current);
			const needsBlocking = event.action !== 'labeled';
			if (needsBlocking && !labels.includes('blocks-core')) {
				ghJson(options.gh, ['api', `${issuesPath}/labels`, '-f', 'labels[]=blocks-core']);
			}
			const confirmed = ghJson(options.gh, ['api', issuesPath]);
			const confirmedLabels = labelsOf(confirmed);
			result.state = { state: confirmed.state, labels: confirmedLabels };
			result.restored =
				confirmedLabels.includes('blocks-core') &&
				(event.action !== 'closed' || confirmed.state === 'open');
			if (!result.restored) exitCode = 2;
		} catch (error) {
			result.restored = false;
			result.error = error.message.split('\n')[0];
			exitCode = 2;
		}
	}

	const out = resolve(options.out);
	mkdirSync(dirname(out), { recursive: true });
	writeFileSync(out, `${JSON.stringify(result, null, 2)}\n`);
	for (const violation of violations) console.error(`guard: ${violation.reason}`);
	if (result.restored) {
		console.error(
			'guard: blocking state restored; owner approval or a linked fixing change is still required'
		);
	}
	if (result.error) console.error(`guard: restoration failed: ${result.error}`);
	process.exitCode = exitCode;
}

main();
