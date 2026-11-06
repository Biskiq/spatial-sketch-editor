/**
 * Capability report — status is computed, never claimed.
 *
 * Inputs: the ledger's definitions, the latest complete test run (`run`),
 * current `main`, open issues (flags), open claims, the previous report and the
 * paths changed since each owner review.
 *
 * Two axes are reported separately:
 *
 *   maturity  what has been proven by tagged checks
 *   health    whether it works right now, including confirmed open bugs
 *
 * A report states its own provenance. A run against an older commit, or with a
 * suite that did not complete, marks every capability `unknown` instead of
 * presenting old results as current. That is deliberately conservative: an
 * interrupted suite cannot clear any check it would have run.
 *
 * Check tags live in test titles: `[cap:<id> core|edge]`, optionally
 * `known-failing:#<issue>` for a confirmed-defect reproducer. An
 * expected-failing test that starts passing is a stale marker, and a skipped
 * test counts as failing — both keep the gate red so nobody edits a status.
 */

const MARKER = /\[cap:([a-z0-9.-]+)\s+(core|edge)(?:\s+known-failing:#(\d+))?\]/g;

/** Maturity ranks; a drop between complete reports is a regression. */
const MATURITY_RANK = { missing: 0, partial: 1, working: 2, polished: 3 };

/** Health ranks from worst to best; `unknown` is worse than `degraded`. */
const HEALTH_RANK = { broken: 0, degraded: 1, unknown: 2, healthy: 3 };

/** Suites the merge gate must complete before a report is current. */
export const REQUIRED_SUITES = [
	'npm run check',
	'npm run test:arch',
	'npm test',
	'npm run test:heavy',
	'npm run build',
	'npm run check:api',
	'npm run test:api'
];

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

/** Vitest's JSON reporter status → the report's check status. */
function checkStatus(assertion) {
	if (assertion.status === 'passed') return 'passed';
	if (assertion.status === 'failed') return 'failed';
	return 'skipped';
}

/**
 * Flatten one Vitest JSON result into tagged checks.
 *
 * @param {any} results parsed `--reporter=json` output
 * @returns {{capabilityId: string, level: 'core'|'edge', knownFailing: number|null, status: string, name: string, file: string}[]}
 */
export function collectChecks(results) {
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
				const raw = checkStatus(assertion);
				// A reproducer that passes no longer reproduces: keep the gate red
				// and let the fix pull request remove the marker.
				const status = marker.knownFailing !== null && raw === 'passed' ? 'stale-marker' : raw;
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

/** Gate-facing failures, with the reason a run is not green. */
export function gateFailures(checks) {
	return checks
		.filter((check) => check.status !== 'passed')
		.map((check) => ({
			name: check.name,
			file: check.file,
			reason:
				check.status === 'stale-marker'
					? `known-failing marker #${check.knownFailing} no longer fails; remove it`
					: check.status
		}));
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
 * no later merge touched the capability's surface.
 *
 * `changedPaths === null` means the changes could not be determined; that is
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
	live = { flags: true, claims: true },
	now = new Date()
}) {
	const capabilities = Array.isArray(ledger?.capabilities) ? ledger.capabilities : [];
	const suites = Array.isArray(run?.suites) ? run.suites : [];
	const checks = [];
	for (const suite of suites) {
		if (suite?.results) checks.push(...collectChecks(suite.results));
	}

	// Completeness is not "the suites I recorded finished": the merge-gate
	// contract names every required suite, so a truncated run cannot read green.
	const complete =
		Boolean(run) &&
		typeof run.commit === 'string' &&
		run.commit.length > 0 &&
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
			(issue) =>
				Array.isArray(issue?.labels) &&
				issue.labels.includes(`cap:${entry.id}`)
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
				.map((check) => ({ name: check.name, file: check.file, level: check.level })),
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
		generatedAtReadAt: now.toISOString(),
		capabilities: rows,
		duplicateClaims
	};
}
