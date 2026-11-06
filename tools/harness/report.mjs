/**
 * Capability report — status is computed, never claimed.
 *
 * Inputs: the ledger's definitions, the latest complete test run (`run`),
 * current `main`, open issues (flags), open claims, the previous report and the
 * paths main history touched since each owner review.
 *
 * Two axes are reported separately:
 *
 *   maturity  what has been proven by tagged checks
 *   health    whether it works right now, including confirmed open bugs
 *
 * A report states its own provenance, and the evidence contract is explicit
 * (`validateRun`): the tested commit, an ISO timestamp, every merge-gate suite,
 * an exit code for completed non-test commands, and a real Vitest reporter
 * artifact with at least one assertion for every completed test suite. A run
 * against an older commit, a suite that did not complete, or missing/empty test
 * evidence marks every capability `unknown` — an interrupted or truncated run
 * can never read green.
 *
 * Check tags live in test titles: `[cap:<id> core|edge]`, optionally
 * `known-failing:#<issue>` for a confirmed-defect reproducer. Expected failures
 * follow the installed runner's contract (`it.fails`):
 *
 *   body still fails        → assertion `passed`  → health failing, gate green
 *   body unexpectedly passes → assertion `failed`  → stale marker, gate red
 *
 * The JSON reporter does not record the `it.fails` mode, so a passing marked
 * check is only credible when its source declares the call as `.fails(`. When
 * that cannot be established the marker is `unverified` and the gate stays red
 * rather than silently tolerating an ordinary tagged test or a stale marker.
 */

const MARKER = /\[cap:([a-z0-9.-]+)\s+(core|edge)(?:\s+known-failing:#(\d+))?\]/g;

/** Maturity ranks; a drop between complete reports is a regression. */
const MATURITY_RANK = { missing: 0, partial: 1, working: 2, polished: 3 };

/** Health ranks from worst to best; `unknown` is worse than `degraded`. */
const HEALTH_RANK = { broken: 0, degraded: 1, unknown: 2, healthy: 3 };

/** The merge gate: every suite must complete for a report to be current. */
export const REQUIRED_SUITES = [
	'npm run check',
	'npm run test:arch',
	'npm test',
	'npm run test:heavy',
	'npm run build',
	'npm run check:api',
	'npm run test:api'
];

/** Suites that complete by producing a Vitest JSON reporter artifact. */
export const TEST_SUITES = ['npm test', 'npm run test:arch', 'npm run test:heavy', 'npm run test:api'];

/** Suites that complete by exiting zero with no reporter artifact. */
export const COMMAND_SUITES = ['npm run check', 'npm run build', 'npm run check:api'];

const COMMIT = /^[0-9a-f]{7,40}$/;

/** Vitest's `it.fails` failure message when the body unexpectedly passes. */
const UNEXPECTED_PASS = /Expect test to fail/;

/**
 * Every capability marker in a test title (describe names included).
 *
 * @param {string} text
 * @returns {{id: string, level: 'core'|'edge', knownFailing: number|null}[]}
 */
export function parseCapabilityMarkers(text) {
	if (typeof text !== 'string') return [];
	const markers = [];
	for (const match of text.matchAll(MARKER)) {
		markers.push({
			id: match[1],
			level: /** @type {'core'|'edge'} */ (match[2]),
			knownFailing: match[3] ? Number(match[3]) : null
		});
	}
	return markers;
}

/** The raw outcome of one assertion, before the marker contract applies. */
function assertionOutcome(assertion) {
	if (assertion?.status === 'passed') return 'passed';
	if (assertion?.status === 'failed') {
		const messages = Array.isArray(assertion.failureMessages)
			? assertion.failureMessages.join('\n')
			: '';
		return UNEXPECTED_PASS.test(messages) ? 'unexpected-pass' : 'failed';
	}
	return 'skipped';
}

const TEST_CALL = /\b(it|test)(\.fails)?\s*\(/g;

/**
 * Is a passing `known-failing` assertion backed by runner expected-failure mode?
 *
 * The JSON reporter records `it.fails` only as `status: passed`, so the marker
 * is credible only when the nearest `it(`/`test(` call before it is `.fails(`.
 * Returns `null` when the source (or the marker inside it) is unavailable;
 * callers treat that as unverified rather than passing.
 *
 * @param {string} file
 * @param {string} markerText the canonical marker, e.g. `[cap:x core known-failing:#1]`
 * @param {(file: string) => string|null} readSource
 * @returns {boolean|null}
 */
export function declaresExpectedFailure(file, markerText, readSource) {
	if (typeof readSource !== 'function' || typeof file !== 'string' || file.length === 0) return null;
	const source = readSource(file);
	if (typeof source !== 'string') return null;
	const index = source.indexOf(markerText);
	if (index < 0) return null;
	let call = null;
	for (const match of source.slice(0, index).matchAll(TEST_CALL)) call = match;
	// No call, or the marker sits on a describe/other call: not runner mode.
	if (call === null) return false;
	return call[2] === '.fails';
}

/**
 * Flatten one Vitest JSON result into tagged checks.
 *
 * @param {any} results parsed `--reporter=json` output
 * @param {{readSource?: ((file: string) => string|null)|null}} [options]
 * @returns {{capabilityId: string, level: 'core'|'edge', knownFailing: number|null, status: string, name: string, file: string}[]}
 */
export function collectChecks(results, options = {}) {
	const { readSource = null } = options;
	const checks = [];
	const testResults = Array.isArray(results?.testResults) ? results.testResults : [];
	for (const fileResult of testResults) {
		const file = typeof fileResult?.name === 'string' ? fileResult.name : '';
		const assertions = Array.isArray(fileResult?.assertionResults)
			? fileResult.assertionResults
			: [];
		for (const assertion of assertions) {
			const name =
				typeof assertion?.fullName === 'string' && assertion.fullName.length > 0
					? assertion.fullName
					: [assertion?.ancestorTitles ?? [], assertion?.title ?? ''].flat().join(' ');
			for (const marker of parseCapabilityMarkers(name)) {
				const outcome = assertionOutcome(assertion);
				/** @type {string} */
				let status;
				if (marker.knownFailing === null) {
					status = outcome === 'passed' ? 'passed' : outcome === 'skipped' ? 'skipped' : 'failed';
				} else if (outcome === 'unexpected-pass') {
					// Body passed unexpectedly: the defect is gone, remove the marker.
					status = 'stale-marker';
				} else if (outcome === 'skipped') {
					status = 'skipped';
				} else if (outcome === 'failed') {
					// An ordinary failing test with a marker is not runner mode.
					status = 'failed';
				} else {
					const markerText = `[cap:${marker.id} ${marker.level} known-failing:#${marker.knownFailing}]`;
					const backed = declaresExpectedFailure(file, markerText, readSource);
					status =
						backed === true
							? 'expected-failing'
							: backed === false
								? 'stale-marker'
								: 'unverified-marker';
				}
				checks.push({
					capabilityId: marker.id,
					level: marker.level,
					knownFailing: marker.knownFailing,
					status,
					name,
					file
				});
			}
		}
	}
	return checks;
}

/** True when the check proves its claim right now. */
export function checkPassed(check) {
	return check.status === 'passed';
}

/** Statuses that keep the merge gate green. */
const GATE_OK = new Set(['passed', 'expected-failing']);

/**
 * Gate-facing failures, with the reason a run is not green. A valid
 * expected-failure reproducer is green; a stale or unverifiable marker is not.
 */
export function gateFailures(checks) {
	return checks
		.filter((check) => !GATE_OK.has(check.status))
		.map((check) => ({
			name: check.name,
			file: check.file,
			reason:
				check.status === 'stale-marker'
					? `known-failing marker #${check.knownFailing} no longer reproduces as runner-expected failure; remove it`
					: check.status === 'unverified-marker'
						? `known-failing marker #${check.knownFailing} is not backed by it.fails(...)`
						: check.status
		}));
}

/**
 * The minimum actual evidence a report may rest on.
 *
 * Structural problems are rejected by the CLI; a recorded `interrupted` or
 * `failed` suite is valid evidence of an incomplete run and reads `unknown`.
 *
 * @param {any} run
 * @returns {string[]}
 */
export function validateRun(run) {
	if (typeof run !== 'object' || run === null || Array.isArray(run)) {
		return ['report must be a JSON object'];
	}
	const problems = [];
	if (typeof run.commit !== 'string' || !COMMIT.test(run.commit)) {
		problems.push('commit must be a git sha');
	}
	if (typeof run.generatedAt !== 'string' || Number.isNaN(Date.parse(run.generatedAt))) {
		problems.push('generatedAt must be an ISO timestamp');
	}
	if (!Array.isArray(run.suites) || run.suites.length === 0) {
		problems.push('suites must be a non-empty array');
		return problems;
	}

	let assertions = 0;
	for (const [index, suite] of run.suites.entries()) {
		const where = `suites[${index}]`;
		if (typeof suite !== 'object' || suite === null || Array.isArray(suite)) {
			problems.push(`${where} must be an object`);
			continue;
		}
		if (typeof suite.name !== 'string' || suite.name.length === 0) {
			problems.push(`${where}.name must be a string`);
			continue;
		}
		if (!['complete', 'interrupted', 'failed', 'missing'].includes(suite.status)) {
			problems.push(`${where}.status is not a known state`);
		}
		if (!REQUIRED_SUITES.includes(suite.name)) {
			problems.push(`${where}: ${suite.name} is not part of the merge-gate contract`);
			continue;
		}
		if (suite.status !== 'complete') continue;

		if (TEST_SUITES.includes(suite.name)) {
			const results = suite.results;
			if (typeof results !== 'object' || results === null || !Array.isArray(results.testResults)) {
				problems.push(`${where} (${suite.name}) completed without a Vitest reporter artifact`);
				continue;
			}
			if (results.testResults.length === 0) {
				problems.push(
					`${where} (${suite.name}) recorded no test files; a collection failure cannot certify a run`
				);
				continue;
			}
			for (const fileResult of results.testResults) {
				if (!Array.isArray(fileResult?.assertionResults)) {
					problems.push(`${where} (${suite.name}) has a test file without assertions`);
					continue;
				}
				assertions += fileResult.assertionResults.length;
			}
		} else if (COMMAND_SUITES.includes(suite.name)) {
			if (suite.exitCode !== 0) {
				problems.push(`${where} (${suite.name}) completed without exitCode 0`);
			}
		}
	}

	if (assertions === 0) {
		problems.push('no test assertions were recorded; a run cannot be certified complete');
	}
	return problems;
}

/**
 * Convert a path glob to an anchored regular expression.
 * Supports `**`, `*` and `?`; everything else is literal.
 *
 * @param {string} glob
 * @returns {RegExp}
 */
export function surfacePattern(glob) {
	let source = '';
	for (let index = 0; index < glob.length; index += 1) {
		const char = glob[index];
		if (char === '*') {
			if (glob[index + 1] === '*') {
				// `**/` may match zero directories; a trailing `**` matches anything.
				if (glob[index + 2] === '/') {
					source += '(?:.*/)?';
					index += 2;
				} else {
					source += '.*';
					index += 1;
				}
			} else {
				source += '[^/]*';
			}
		} else if (char === '?') {
			source += '[^/]';
		} else {
			source += char.replace(/[.+^${}()|[\]\\]/g, '\\$&');
		}
	}
	return new RegExp(`^${source}$`);
}

/**
 * @param {string} glob
 * @param {string} path repository-relative path
 */
export function surfaceMatches(glob, path) {
	return surfacePattern(glob).test(path.split('\\').join('/'));
}

/**
 * An owner review is current only while its design revision still holds and
 * intervening `main` history touched no path on the capability's surface.
 *
 * `changedPaths === null` means the history could not be established; that is
 * treated as stale rather than assumed innocent.
 *
 * @param {any} review
 * @param {string[]} surface
 * @param {string|null} designRevision
 * @param {string[]|null} changedPaths
 */
export function reviewIsCurrent(review, surface, designRevision, changedPaths) {
	if (!review || review.verdict !== 'accepted') return false;
	if (review.design !== designRevision) return false;
	if (changedPaths === null) return false;
	return !changedPaths.some((path) => surface.some((glob) => surfaceMatches(glob, path)));
}

/**
 * @param {any[]} core
 * @param {any[]} edge
 * @param {boolean} reviewCurrent
 */
function maturityOf(core, edge, reviewCurrent) {
	if (core.length === 0) return 'missing';
	const passing = core.filter(checkPassed).length;
	if (passing === 0) return 'missing';
	if (passing < core.length) return 'partial';
	if (edge.every(checkPassed) && reviewCurrent) return 'polished';
	return 'working';
}

/**
 * @param {any[]} checks
 * @param {{blocking: boolean, confirmed: boolean}} bug
 */
function healthOf(checks, bug) {
	const coreFailing = checks.some((check) => check.level === 'core' && !checkPassed(check));
	if (coreFailing || bug.blocking) return 'broken';
	const edgeFailing = checks.some((check) => check.level === 'edge' && !checkPassed(check));
	if (edgeFailing || bug.confirmed) return 'degraded';
	return 'healthy';
}

function byId(items) {
	const map = new Map();
	for (const item of items) {
		const list = map.get(item.capabilityId) ?? [];
		list.push(item);
		map.set(item.capabilityId, list);
	}
	return map;
}

/**
 * Build the report.
 *
 * @param {{
 *   ledger: any,
 *   run: any,
 *   mainHead: string|null,
 *   issues?: any[],
 *   claims?: any[],
 *   previous?: any,
 *   changedPaths?: Map<string, string[]|null>|Record<string, string[]|null>,
 *   readSource?: ((file: string) => string|null)|null,
 *   live?: {flags: boolean, claims: boolean},
 *   now?: Date
 * }} input
 */
export function buildReport({
	ledger,
	run,
	mainHead,
	issues = [],
	claims = [],
	previous = null,
	changedPaths = null,
	readSource = null,
	live = { flags: true, claims: true },
	now = new Date()
}) {
	const capabilities = Array.isArray(ledger?.capabilities) ? ledger.capabilities : [];
	const suites = Array.isArray(run?.suites) ? run.suites : [];
	const checks = [];
	for (const suite of suites) {
		if (suite?.results) checks.push(...collectChecks(suite.results, { readSource }));
	}

	// Completeness is not "the suites I recorded finished": the merge-gate
	// contract names every required suite, the evidence must exist, and the
	// report must be for the current main head.
	const complete =
		validateRun(run).length === 0 &&
		typeof mainHead === 'string' &&
		run.commit === mainHead &&
		REQUIRED_SUITES.every((name) =>
			suites.some((suite) => suite?.name === name && suite.status === 'complete')
		);

	const checksById = byId(checks);
	// A claim names its capability in its title; one claim may name several.
	const linkedClaims = [];
	for (const claim of claims) {
		if (typeof claim?.title !== 'string') continue;
		for (const entry of capabilities) {
			if (claim.title.includes(entry.id)) linkedClaims.push({ ...claim, capabilityId: entry.id });
		}
	}
	const claimsById = byId(linkedClaims);
	const previousById = new Map(
		(Array.isArray(previous?.capabilities) ? previous.capabilities : []).map((entry) => [
			entry.id,
			entry
		])
	);
	const previousComplete = previous?.complete === true;
	const changesFor = (id) => {
		if (changedPaths instanceof Map) return changedPaths.get(id) ?? null;
		if (changedPaths && typeof changedPaths === 'object') return changedPaths[id] ?? null;
		return null;
	};

	const rows = capabilities.map((entry) => {
		const entryChecks = checksById.get(entry.id) ?? [];
		const core = entryChecks.filter((check) => check.level === 'core');
		const edge = entryChecks.filter((check) => check.level === 'edge');
		const entryClaims = claimsById.get(entry.id) ?? [];
		const linkedIssues = issues.filter(
			(issue) => Array.isArray(issue?.labels) && issue.labels.includes(`cap:${entry.id}`)
		);
		const blocking = linkedIssues.some(
			(issue) => issue.labels.includes('bug') && issue.labels.includes('blocks-core')
		);
		const confirmed = linkedIssues.some((issue) => issue.labels.includes('bug'));

		const reviewCurrent = reviewIsCurrent(
			entry.review,
			entry.surface ?? [],
			entry.design?.revision ?? null,
			changesFor(entry.id)
		);
		const maturity = maturityOf(core, edge, reviewCurrent);
		const health = complete ? healthOf(entryChecks, { blocking, confirmed }) : 'unknown';

		const prior = previousById.get(entry.id);
		const regressed =
			complete &&
			previousComplete &&
			Boolean(prior) &&
			(MATURITY_RANK[maturity] < MATURITY_RANK[prior.maturity] ||
				HEALTH_RANK[health] < HEALTH_RANK[prior.health]);

		return {
			id: entry.id,
			maturity,
			health,
			regressed,
			reviewCurrent,
			checks: {
				core: { total: core.length, passing: core.filter(checkPassed).length },
				edge: { total: edge.length, passing: edge.filter(checkPassed).length }
			},
			failingChecks: entryChecks
				.filter((check) => !checkPassed(check))
				.map((check) => ({
					name: check.name,
					file: check.file,
					level: check.level,
					status: check.status
				})),
			flags: linkedIssues.map((issue) => issue.number),
			claims: entryClaims.map((claim) => claim.number)
		};
	});

	const duplicateClaims = [...claimsById.entries()]
		.filter(([, list]) => new Set(list.map((claim) => claim.number)).size > 1)
		.map(([capabilityId, list]) => ({
			capabilityId,
			numbers: [...new Set(list.map((claim) => claim.number))].sort((a, b) => a - b)
		}));

	return {
		schemaVersion: 1,
		testedCommit: run?.commit ?? null,
		generatedAt: run?.generatedAt ?? null,
		mainHead: mainHead ?? null,
		complete,
		suites: suites.map((suite) => ({
			name: typeof suite?.name === 'string' ? suite.name : 'unknown',
			status: typeof suite?.status === 'string' ? suite.status : 'missing'
		})),
		live: { flags: live.flags !== false, claims: live.claims !== false },
		readAt: now.toISOString(),
		gate: { failures: gateFailures(checks) },
		capabilities: rows,
		duplicateClaims
	};
}
