#!/usr/bin/env node
/**
 * Hard guards: removing reassurance needs the owner's explicit label.
 *
 * Two production consumers, both event driven:
 *
 *   pull_request  `guards.mjs --base <ref> --head <ref> --labels-file <json>`
 *                 protects tagged checks by identity (file + describe path +
 *                 test title + level), so deleting a test while leaving its
 *                 marker in a comment, or replacing it with another
 *                 same-capability test, still counts as a removal. Inherited
 *                 describe tags belong to the tests they enclose.
 *
 *   issues event  `guards.mjs --event-file <payload> --linked-fixes <json>`
 *                 runs on `issues: [labeled, unlabeled, closed]`. Dropping
 *                 `blocks-core`, dropping `bug` from a `blocks-core` issue, or
 *                 closing one without a linked fix needs the issue's own
 *                 `owner-approved-guard-change` label.
 *
 * A failed or unavailable issue read is a violation, never a pass. The issue
 * workflow only takes effect from the default branch, i.e. after #259 merges.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { parseCapabilityMarkers } from './report.mjs';

const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));
export const OWNER_LABEL = 'owner-approved-guard-change';

const DECLARATION =
	/\b(describe|it|test)\s*\(\s*(?:'((?:\\.|[^'])*)'|"((?:\\.|[^"])*)"|`((?:\\.|[^`])*)`)/g;

function skipString(source, start) {
	const quote = source[start];
	for (let index = start + 1; index < source.length; index += 1) {
		if (source[index] === '\\') {
			index += 1;
			continue;
		}
		if (source[index] === quote) return index;
	}
	return source.length;
}

/** Index of the `}` matching the `{` at `open`, or the end of the file. */
function matchingBrace(source, open) {
	let depth = 0;
	for (let index = open; index < source.length; index += 1) {
		const char = source[index];
		if (char === "'" || char === '"' || char === '`') {
			index = skipString(source, index);
			continue;
		}
		if (char === '/' && source[index + 1] === '/') {
			while (index < source.length && source[index] !== '\n') index += 1;
			continue;
		}
		if (char === '/' && source[index + 1] === '*') {
			const end = source.indexOf('*/', index + 2);
			index = end === -1 ? source.length : end + 1;
			continue;
		}
		if (char === '{') depth += 1;
		else if (char === '}') {
			depth -= 1;
			if (depth === 0) return index;
		}
	}
	return source.length;
}

/**
 * Tagged check declarations in one source file.
 *
 * A check's identity is its file, its describe path and its test title. The
 * marker level comes from the test's own title or from an enclosing describe
 * (the installed reporter includes both in the full name). Comments and
 * documentation are never declarations.
 *
 * @param {string} source
 * @param {string} file
 * @returns {{file: string, titlePath: string, capabilityId: string, level: 'core'|'edge', knownFailing: number|null}[]}
 */
export function taggedChecksIn(source, file = '') {
	const describes = [];
	const tests = [];
	for (const match of source.matchAll(DECLARATION)) {
		const title = match[2] ?? match[3] ?? match[4] ?? '';
		const start = /** @type {number} */ (match.index);
		if (match[1] === 'describe') {
			const open = source.indexOf('{', start + match[0].length);
			if (open === -1) continue;
			describes.push({
				title,
				start,
				end: matchingBrace(source, open),
				markers: parseCapabilityMarkers(title)
			});
		} else {
			tests.push({ title, start, markers: parseCapabilityMarkers(title) });
		}
	}

	const checks = [];
	for (const test of tests) {
		const ancestors = describes.filter(
			(describe) => describe.start < test.start && test.start < describe.end
		);
		const titlePath = [...ancestors.map((describe) => describe.title), test.title].join(' > ');
		const markers = new Map();
		for (const marker of [...test.markers, ...ancestors.flatMap((describe) => describe.markers)]) {
			markers.set(`${marker.id}|${marker.level}|${marker.knownFailing}`, marker);
		}
		for (const marker of markers.values()) {
			checks.push({
				file,
				titlePath,
				capabilityId: marker.id,
				level: marker.level,
				knownFailing: marker.knownFailing
			});
		}
	}
	return checks;
}

/**
 * Tagged checks at a git ref, read from the actual declarations.
 *
 * @param {string} repoRoot
 * @param {string} ref
 */
export function checksAt(repoRoot, ref) {
	// Only test files can declare a check; documentation, comments and fixture
	// strings elsewhere are not checks.
	const listed = spawnSync(
		'git',
		[
			'grep',
			'-l',
			'-F',
			'[cap:',
			ref,
			'--',
			':(glob)**/*.test.ts',
			':(glob)**/*.test.mjs'
		],
		{ cwd: repoRoot, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 }
	);
	if (listed.status === 1 && listed.stdout.trim().length === 0) return [];
	if (listed.status !== 0) {
		throw new Error(`git grep failed: ${listed.stderr || listed.error?.message || listed.status}`);
	}
	const paths = [
		...new Set(
			listed.stdout
				.split('\n')
				.filter(Boolean)
				.map((line) => line.slice(line.indexOf(':') + 1))
		)
	];
	const checks = [];
	for (const path of paths) {
		const shown = spawnSync('git', ['show', `${ref}:${path}`], {
			cwd: repoRoot,
			encoding: 'utf8',
			maxBuffer: 32 * 1024 * 1024
		});
		if (shown.status !== 0) {
			throw new Error(`could not read ${path} at ${ref}`);
		}
		checks.push(...taggedChecksIn(shown.stdout, path));
	}
	return checks;
}

const KEY = '\u0000';

/** Marker text is level metadata, not identity: retagging core→edge keeps the title. */
function normalizedTitlePath(check) {
	return String(check.titlePath ?? '')
		.split(' > ')
		.map((part) => part.replace(/\[cap:[^\]]*\]/g, '').replace(/\s+/g, ' ').trim())
		.join(' > ');
}

function identityOf(check) {
	return `${check.file}${KEY}${normalizedTitlePath(check)}${KEY}${check.level}`;
}

function countByIdentity(checks) {
	const counts = new Map();
	for (const check of checks) {
		const key = identityOf(check);
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
 *   base: {file: string, titlePath: string, level: 'core'|'edge'}[],
 *   head: {file: string, titlePath: string, level: 'core'|'edge'}[],
 *   labels?: string[],
 *   baseIssues?: {number: number, labels: string[], state?: string, fixedBy?: string|number|null}[]|null,
 *   headIssues?: {number: number, labels: string[], state?: string, fixedBy?: string|number|null}[]|null
 * }} input
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
		const before = countByIdentity(base);
		const after = countByIdentity(head);
		for (const [key, count] of before) {
			if ((after.get(key) ?? 0) >= count) continue;
			const [file, titlePath, level] = key.split(KEY);
			const downgraded =
				level === 'core' && (after.get(`${file}${KEY}${titlePath}${KEY}edge`) ?? 0) > 0;
			violations.push({
				reason: `${downgraded ? 'downgraded' : 'removed'} tagged check ${file}: ${titlePath}`.trim(),
				detail: `${level} check identity no longer exists at head; the owner-approved-guard-change label is required`
			});
		}
	}

	if (baseIssues && headIssues) {
		const headByNumber = new Map(headIssues.map((issue) => [issue.number, issue]));
		for (const issue of baseIssues) {
			const before = issueLabels(issue);
			if (!before.includes('blocks-core')) continue;
			const current = headByNumber.get(issue.number);
			if (!current) continue;
			const now = issueLabels(current);
			if (!now.includes('blocks-core') && !approved) {
				violations.push({
					reason: `dropped blocks-core from confirmed bug #${issue.number}`,
					detail: 'the owner-approved-guard-change label is required'
				});
			}
			if (current.state === 'closed' && !current.fixedBy && !approved) {
				violations.push({
					reason: `closed blocks-core bug #${issue.number} without a linked fix`,
					detail: 'link the fixing pull request/commit or add the owner-approved-guard-change label'
				});
			}
		}
	}

	return violations;
}

/**
 * One GitHub `issues` event. Returns violations rather than throwing, so the
 * workflow fails with the reason and a missing readback is visible.
 *
 * @param {{event: any, linkedFixes?: number[]|null}} input
 */
export function evaluateIssueEvent({ event, linkedFixes = null }) {
	const violations = [];
	const issue = event?.issue ?? {};
	const labels = issueLabels(issue);
	const approved = labels.includes(OWNER_LABEL);
	const action = event?.action;
	const removed = event?.label?.name;

	if (action === 'unlabeled' && removed === 'blocks-core' && !approved) {
		violations.push({
			reason: `issue #${issue.number} dropped blocks-core without owner approval`,
			detail: 'add the owner-approved-guard-change label to the issue before removing blocks-core'
		});
	}
	if (action === 'unlabeled' && removed === 'bug' && labels.includes('blocks-core') && !approved) {
		violations.push({
			reason: `issue #${issue.number} dropped bug while it still claims blocks-core`,
			detail: 'relabelling must not erase a confirmed blocking bug; the owner-approved-guard-change label is required'
		});
	}
	if (action === 'closed' && labels.includes('blocks-core') && !approved) {
		if (linkedFixes === null || linkedFixes === undefined) {
			violations.push({
				reason: `issue #${issue.number} closed with blocks-core but fix linkage could not be read`,
				detail: 'the timeline readback failed; refusing to treat an unreadable close as fixed'
			});
		} else if (linkedFixes.length === 0) {
			violations.push({
				reason: `issue #${issue.number} closed with blocks-core and no linked fix`,
				detail: 'link the fixing pull request/commit or add the owner-approved-guard-change label'
			});
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
		labels: null,
		labelsFile: null,
		baseIssues: null,
		headIssues: null,
		baseMarkers: null,
		headMarkers: null,
		eventFile: null,
		linkedFixes: null,
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
		else if (arg === '--labels') options.labels = next();
		else if (arg === '--labels-file') options.labelsFile = next();
		else if (arg === '--base-issues') options.baseIssues = next();
		else if (arg === '--head-issues') options.headIssues = next();
		else if (arg === '--base-markers') options.baseMarkers = next();
		else if (arg === '--head-markers') options.headMarkers = next();
		else if (arg === '--event-file') options.eventFile = next();
		else if (arg === '--linked-fixes') options.linkedFixes = next();
		else if (arg === '--json') options.json = true;
		else throw new Error(`unknown argument: ${arg}`);
	}
	return options;
}

/** A missing linked-fixes file is unknown, not "no links". */
function readLinkedFixes(path) {
	if (!path) return null;
	try {
		const parsed = JSON.parse(readFileSync(path, 'utf8'));
		return Array.isArray(parsed) ? parsed : null;
	} catch {
		return null;
	}
}

function cli() {
	const options = parseArgs(process.argv.slice(2));
	const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));

	let violations;
	if (options.eventFile) {
		violations = evaluateIssueEvent({
			event: readJson(options.eventFile),
			linkedFixes: readLinkedFixes(options.linkedFixes)
		});
	} else {
		const labels = options.labels
			? options.labels.split(',')
			: readLabels(options.labelsFile);
		violations = evaluateGuards({
			base: options.baseMarkers
				? readJson(options.baseMarkers)
				: checksAt(options.repoRoot, options.base),
			head: options.headMarkers
				? readJson(options.headMarkers)
				: checksAt(options.repoRoot, options.head),
			labels,
			baseIssues: options.baseIssues ? readJson(options.baseIssues) : null,
			headIssues: options.headIssues ? readJson(options.headIssues) : null
		});
	}

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
