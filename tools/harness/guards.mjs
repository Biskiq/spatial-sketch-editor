#!/usr/bin/env node
/**
 * Hard guards: removing reassurance needs the owner's explicit label.
 *
 * Tagged checks are read from the TypeScript/JavaScript syntax tree, not from
 * raw text: a commented-out call, a string fixture or a documentation sample is
 * never a check, while `it.fails`, `it.skip`, `it.only` and describe
 * inheritance are. Unsupported tagged syntax (for example `it.each`) is
 * recorded as an unsupported claim and therefore also fails closed when it
 * disappears.
 *
 * Check identity is `file + describe path + test title + level`, with marker
 * text normalised out so retagging remains the same check. A legitimate fix may
 * turn `it.fails` back into `it` — the tagged check itself stays.
 *
 * Two production consumers:
 *
 *   pull_request  `guards.mjs --base <ref> --head <ref> --labels-file <json>`
 *   issues event  `issue-response.mjs` (uses `evaluateIssueEvent` below) which
 *                 restores an unauthorized label/state change and fails.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

import ts from 'typescript';

import { OWNER_LABEL, evaluateIssueEvent, issueLabels } from './issue-rules.mjs';
import { parseCapabilityMarkers } from './report.mjs';

export { OWNER_LABEL, evaluateIssueEvent };

const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));

const TEST_BASES = new Set(['it', 'test']);
const SUPPORTED_MODIFIERS = new Set(['fails', 'skip', 'only', 'concurrent', 'todo']);

function calleeName(expression) {
	const members = [];
	let node = expression;
	while (ts.isPropertyAccessExpression(node)) {
		members.unshift(node.name.text);
		node = node.expression;
	}
	if (!ts.isIdentifier(node)) return null;
	return { base: node.text, members };
}

function literalTitle(node) {
	if (!node) return null;
	if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
	return null;
}

/** Marker-bearing literals inside an unsupported call, so they cannot vanish. */
function markerLiterals(node, found = []) {
	if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
		if (node.text.includes('[cap:')) found.push(node.text);
		return found;
	}
	if (ts.isTemplateExpression(node)) {
		if (node.head.text.includes('[cap:')) found.push(node.head.text);
		for (const span of node.templateSpans) {
			if (span.literal.text.includes('[cap:')) found.push(span.literal.text);
			markerLiterals(span.expression, found);
		}
		return found;
	}
	ts.forEachChild(node, (child) => markerLiterals(child, found));
	return found;
}

/**
 * Tagged check declarations in one source file.
 *
 * @param {string} source
 * @param {string} file
 * @returns {{file: string, titlePath: string, capabilityId: string, level: 'core'|'edge', knownFailing: number|null}[]}
 */
export function taggedChecksIn(source, file = '') {
	const kind = /\.(mjs|cjs|jsx?)$/.test(file) ? ts.ScriptKind.JS : ts.ScriptKind.TS;
	const sourceFile = ts.createSourceFile(
		file || 'fixture.ts',
		source,
		ts.ScriptTarget.Latest,
		true,
		kind
	);
	const checks = [];

	/**
	 * @param {import('typescript').Node} node
	 * @param {{title: string, markers: any[]}[]} context
	 */
	const visit = (node, context) => {
		if (ts.isCallExpression(node)) {
			// `it.each([...])('title', …)` and `describe.each` are a call returning
			// a call. The tagged title lives on the outer call, so record it as an
			// unsupported claim rather than letting it vanish.
			if (ts.isCallExpression(node.expression)) {
				const inner = calleeName(node.expression.expression);
				if (inner && (TEST_BASES.has(inner.base) || inner.base === 'describe')) {
					const literals = [];
					for (const argument of node.arguments) markerLiterals(argument, literals);
					for (const literal of literals) {
						for (const marker of parseCapabilityMarkers(literal)) {
							checks.push({
								file,
								titlePath: `unsupported: ${literal}`,
								capabilityId: marker.id,
								level: marker.level,
								knownFailing: marker.knownFailing
							});
						}
					}
				}
			}
			const callee = calleeName(node.expression);
			if (callee?.base === 'describe') {
				const title = literalTitle(node.arguments[0]);
				const supported =
					title !== null && callee.members.every((member) => member === 'skip' || member === 'only');
				if (supported) {
					const markers = parseCapabilityMarkers(title);
					const next = [...context, { title, markers }];
					for (const argument of node.arguments) visit(argument, next);
					return;
				}
				for (const argument of node.arguments) {
					for (const literal of markerLiterals(argument)) {
						for (const marker of parseCapabilityMarkers(literal)) {
							checks.push({
								file,
								titlePath: `unsupported: ${literal}`,
								capabilityId: marker.id,
								level: marker.level,
								knownFailing: marker.knownFailing
							});
						}
					}
				}
				for (const argument of node.arguments) visit(argument, context);
				return;
			}

			if (callee && TEST_BASES.has(callee.base)) {
				const title = literalTitle(node.arguments[0]);
				const unsupported = callee.members.some(
					(member) => !SUPPORTED_MODIFIERS.has(member)
				);
				const own = title === null ? [] : parseCapabilityMarkers(title);
				const inherited = context.flatMap((entry) => entry.markers);
				const markers = new Map();
				for (const marker of [...own, ...inherited]) {
					markers.set(`${marker.id}|${marker.level}|${marker.knownFailing}`, marker);
				}
				const unsupportedLiterals = [];
				if (unsupported || title === null) {
					for (const argument of node.arguments) markerLiterals(argument, unsupportedLiterals);
				}
				if (unsupportedLiterals.length > 0) {
					for (const literal of unsupportedLiterals) {
						for (const marker of parseCapabilityMarkers(literal)) {
							checks.push({
								file,
								titlePath: `unsupported: ${literal}`,
								capabilityId: marker.id,
								level: marker.level,
								knownFailing: marker.knownFailing
							});
						}
					}
				} else if (markers.size > 0) {
					const titlePath = [...context.map((entry) => entry.title), title].join(' > ');
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
				for (const argument of node.arguments) visit(argument, context);
				return;
			}
		}
		ts.forEachChild(node, (child) => visit(child, context));
	};

	visit(sourceFile, []);
	return checks;
}

/**
 * Tagged checks at a git ref, read from the actual declarations.
 *
 * @param {string} repoRoot
 * @param {string} ref
 */
export function checksAt(repoRoot, ref) {
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
			':(glob)**/*.test.mjs',
			':(glob)**/*.test.js'
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
		if (shown.status !== 0) throw new Error(`could not read ${path} at ${ref}`);
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
				reason: `${downgraded ? 'downgraded' : 'removed'} tagged check ${file}: ${titlePath}`,
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

function readLinkedFixes(path) {
	if (!path) return null;
	try {
		return JSON.parse(readFileSync(path, 'utf8'));
	} catch {
		return { unreadable: true };
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
		const labels = options.labels ? options.labels.split(',') : readLabels(options.labelsFile);
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

// Imported by the issue-response helper; only run as a CLI when invoked.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) cli();
