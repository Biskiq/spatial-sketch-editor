#!/usr/bin/env node
/**
 * Hard guards: removing reassurance needs the owner's explicit label.
 *
 * Checked on every pull request:
 *
 *   - a tagged check that existed on the base branch was removed, or retagged
 *     from `core` to `edge` (the check count for that level dropped);
 *   - a confirmed `blocks-core` bug lost its label, or was closed without a
 *     linked fix (issue snapshots; the live readback that supplies them is a
 *     repository-admin/CI follow-up, not something a PR diff can prove).
 *
 * A pull request (or issue snapshot) labelled `owner-approved-guard-change`
 * passes. Nothing else does; the guard never infers approval from a green run,
 * a changed title or a fix that "looks obvious".
 *
 * Usage:
 *   node tools/harness/guards.mjs --base origin/main --head HEAD --labels-file labels.json
 *   node tools/harness/guards.mjs --base-markers base.json --head-markers head.json --labels owner-approved-guard-change
 */
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { parseCapabilityMarkers } from './report.mjs';

const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));
export const OWNER_LABEL = 'owner-approved-guard-change';

/**
 * @param {string} repoRoot
 * @param {string} ref
 * @returns {{id: string, level: 'core'|'edge', knownFailing: number|null, file: string}[]}
 */
export function markersAt(repoRoot, ref) {
	const result = spawnSync(
		'git',
		[
			'grep',
			'-o',
			'-E',
			'\\[cap:[a-z0-9.-]+ (core|edge)( known-failing:#[0-9]+)?\\]',
			ref,
			'--',
			'.'
		],
		{ cwd: repoRoot, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 }
	);
	// git grep exits 1 when the tree has no matches; that is an empty set, not
	// a failed guard. Any other non-zero status is a real error.
	if (result.status === 1 && result.stdout.trim().length === 0) return [];
	if (result.status !== 0) {
		throw new Error(`git grep failed: ${result.stderr || result.error?.message || result.status}`);
	}
	const markers = [];
	for (const line of result.stdout.split('\n')) {
		const match = /^([^:]+):(.*)$/.exec(line);
		if (!match) continue;
		for (const marker of parseCapabilityMarkers(match[2])) {
			markers.push({ ...marker, file: match[1] });
		}
	}
	return markers;
}

function countByCheck(markers) {
	const counts = new Map();
	for (const marker of markers) {
		const key = `${marker.id}|${marker.level}`;
		counts.set(key, (counts.get(key) ?? 0) + 1);
	}
	return counts;
}

function issueLabels(issue) {
	return Array.isArray(issue?.labels)
		? issue.labels.map((label) => (typeof label === 'string' ? label : label?.name))
		: [];
}

/**
 * @param {{
 *   base: {id: string, level: 'core'|'edge'}[],
 *   head: {id: string, level: 'core'|'edge'}[],
 *   labels?: string[],
 *   baseIssues?: {number: number, labels: string[], state?: string, fixedBy?: string|number|null}[]|null,
 *   headIssues?: {number: number, labels: string[], state?: string, fixedBy?: string|number|null}[]|null
 * }} input
 * @returns {{reason: string, detail: string}[]}
 */
export function evaluateGuards({
	base,
	head,
	labels = [],
	baseIssues = null,
	headIssues = null
}) {
	const violations = [];
	const approved = labels.includes(OWNER_LABEL);
	if (!approved) {
		const before = countByCheck(base);
		const after = countByCheck(head);
		for (const [key, count] of before) {
			const [id, level] = key.split('|');
			const remaining = after.get(key) ?? 0;
			if (remaining < count) {
				violations.push({
					reason: `removed or downgraded tagged check: [cap:${id} ${level}] ${count} -> ${remaining}`,
					detail: 'checks may only be removed or downgraded with the owner-approved-guard-change label'
				});
			}
		}
	}

	if (baseIssues && headIssues) {
		const headByNumber = new Map(headIssues.map((issue) => [issue.number, issue]));
		for (const issue of baseIssues) {
			const before = issueLabels(issue);
			if (!before.includes('bug') || !before.includes('blocks-core')) continue;
			const current = headByNumber.get(issue.number);
			if (!current) continue;
			const now = issueLabels(current);
			if (!now.includes('blocks-core') && !approved) {
				violations.push({
					reason: `dropped blocks-core from confirmed bug #${issue.number}`,
					detail: 'the owner-approved-guard-change label is required'
				});
			}
			if (
				current.state === 'closed' &&
				!current.fixedBy &&
				!approved
			) {
				violations.push({
					reason: `closed blocks-core bug #${issue.number} without a linked fix`,
					detail: 'link the fixing pull request/commit or add the owner-approved-guard-change label'
				});
			}
		}
	}

	return violations;
}

function readLabels(value) {
	if (!value) return [];
	const text = readFileSync(value, 'utf8');
	let parsed;
	try {
		parsed = JSON.parse(text);
	} catch {
		return value.split(',').map((label) => label.trim()).filter(Boolean);
	}
	if (Array.isArray(parsed)) return parsed.map(String);
	if (Array.isArray(parsed?.labels)) {
		return parsed.labels.map((label) => (typeof label === 'string' ? label : label?.name));
	}
	return [];
}

function parseArgs(argv) {
	const options = {
		repoRoot: REPO_ROOT,
		base: null,
		head: 'HEAD',
		baseMarkers: null,
		headMarkers: null,
		labels: null,
		baseIssues: null,
		headIssues: null,
		json: false
	};
	for (let index = 0; index < argv.length; index += 1) {
		const arg = argv[index];
		const next = () => {
			index += 1;
			if (index >= argv.length) throw new Error(`${arg} needs a value`);
			return argv[index];
		};
		if (arg === '--repo-root') options.repoRoot = next();
		else if (arg === '--base') options.base = next();
		else if (arg === '--head') options.head = next();
		else if (arg === '--base-markers') options.baseMarkers = next();
		else if (arg === '--head-markers') options.headMarkers = next();
		else if (arg === '--labels') options.labels = next();
		else if (arg === '--labels-file') options.labelsFile = next();
		else if (arg === '--base-issues') options.baseIssues = next();
		else if (arg === '--head-issues') options.headIssues = next();
		else if (arg === '--json') options.json = true;
		else throw new Error(`unknown argument: ${arg}`);
	}
	return options;
}

function cli() {
	const options = parseArgs(process.argv.slice(2));
	const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));
	const base = options.baseMarkers
		? readJson(options.baseMarkers)
		: markersAt(options.repoRoot, options.base);
	const head = options.headMarkers
		? readJson(options.headMarkers)
		: markersAt(options.repoRoot, options.head);
	const labels = options.labels ? options.labels.split(',') : readLabels(options.labelsFile);
	const violations = evaluateGuards({
		base,
		head,
		labels,
		baseIssues: options.baseIssues ? readJson(options.baseIssues) : null,
		headIssues: options.headIssues ? readJson(options.headIssues) : null
	});
	if (options.json) console.log(JSON.stringify({ violations }, null, 2));
	if (violations.length > 0) {
		for (const violation of violations) {
			console.error(`guard: ${violation.reason}`);
			console.error(`guard: ${violation.detail}`);
		}
		process.exitCode = 1;
	} else {
		console.log('guard: no unapproved check or bug-state change');
	}
}

cli();
