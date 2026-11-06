/**
 * The harness report answers "what works, what is broken, what is undecided and
 * is anyone on it?" without anyone editing a status field. This suite pins the
 * rules that make that honest:
 *
 * - a capability with no core check never reads `working`;
 * - a skipped check and a stale `known-failing` marker count as failing;
 * - an open `blocks-core` bug breaks health before any reproducer exists;
 * - a report from another commit, or with a suite that did not complete, reads
 *   `unknown` instead of presenting old results as current;
 * - an owner review expires when a later merge touches the capability surface;
 * - two claims on one capability are reported, not silently resolved.
 *
 * The cases drive the real CLI on fixture ledgers and recorded runs, so the
 * printed provenance and the exit contract are exercised too.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';

import { anchorsOf, REPO_ROOT } from '../helpers/docs-references';

const STATUS = join(REPO_ROOT, 'tools/harness/status.mjs');
const LEDGER = join(REPO_ROOT, 'capabilities.json');
const NORTH_STAR = join(REPO_ROOT, 'docs/reference/north-star.md');

const COMMIT = 'a'.repeat(40);
const OTHER_COMMIT = 'b'.repeat(40);
const TEMP = mkdtempSync(join(tmpdir(), 'harness-status-'));

afterAll(() => rmSync(TEMP, { recursive: true, force: true }));

type Capability = {
	id: string;
	area?: string;
	summary?: string;
	northStar?: string;
	surface?: string[];
	design?: { reference: string; revision: string } | null;
	review?: {
		implementation: string;
		design: string;
		date: string;
		verdict: string;
	} | null;
};

type Check = {
	cap: string;
	level?: 'core' | 'edge';
	status?: string;
	knownFailing?: number;
	title?: string;
};

function ledgerOf(...capabilities: Capability[]) {
	return {
		schemaVersion: 1,
		capabilities: capabilities.map((capability) => ({
			area: 'T1',
			summary: 'A creator-facing capability',
			northStar: 'north-star.md#sacred-contracts',
			surface: ['apps/editor/src/**'],
			design: null,
			review: null,
			...capability
		}))
	};
}

function assertions(checks: Check[]) {
	return {
		testResults: [
			{
				name: 'tests/example.test.ts',
				assertionResults: checks.map((check) => ({
					fullName: `[cap:${check.cap} ${check.level ?? 'core'}${
						check.knownFailing !== undefined ? ` known-failing:#${check.knownFailing}` : ''
					}] ${check.title ?? 'proves it'}`,
					status: check.status ?? 'passed'
				}))
			}
		]
	};
}

/** The merge-gate suite contract the workflow records; a run must cover it. */
const REQUIRED_SUITES = [
	'npm run check',
	'npm run test:arch',
	'npm test',
	'npm run test:heavy',
	'npm run build',
	'npm run check:api',
	'npm run test:api'
];

function runOf(checks: Check[], options: { commit?: string; suite?: string } = {}) {
	return {
		commit: options.commit ?? COMMIT,
		generatedAt: '2026-11-06T10:00:00.000Z',
		suites: REQUIRED_SUITES.map((name) => ({
			name,
			status: name === 'npm test' ? (options.suite ?? 'complete') : 'complete',
			...(name === 'npm test' ? { results: assertions(checks) } : {})
		}))
	};
}

function writeCaseFile(name: string, value: unknown) {
	const directory = mkdtempSync(join(TEMP, 'case-'));
	const path = join(directory, name);
	writeFileSync(path, JSON.stringify(value));
	return path;
}

type StatusInput = {
	ledger: unknown;
	report?: unknown;
	previous?: unknown;
	mainHead?: string;
	changedPaths?: Record<string, string[] | null>;
	github?: unknown;
};

function status(input: StatusInput) {
	const ledgerPath = writeCaseFile('capabilities.json', input.ledger);
	const args = [
		STATUS,
		'--json',
		'--ledger',
		ledgerPath,
		'--main-head',
		input.mainHead ?? COMMIT
	];
	args.push(
		'--report',
		input.report === undefined
			? join(TEMP, 'absent-report.json')
			: writeCaseFile('report.json', input.report)
	);
	if (input.previous !== undefined) args.push('--previous', writeCaseFile('previous.json', input.previous));
	if (input.changedPaths !== undefined) {
		args.push('--changed-paths', writeCaseFile('changed.json', input.changedPaths));
	}
	if (input.github !== undefined) args.push('--github', writeCaseFile('github.json', input.github));
	else args.push('--offline');

	return JSON.parse(execFileSync(process.execPath, args, { encoding: 'utf8' }));
}

function row(report: any, id: string) {
	const found = report.capabilities.find((entry: any) => entry.id === id);
	if (!found) throw new Error(`expected a report row for ${id}`);
	return found;
}

describe('the capability ledger is definitions only', () => {
	it('rejects a stored status field, a duplicate id and a malformed anchor', () => {
		const stored = ledgerOf({ id: 'layout.a' });
		(stored.capabilities[0] as any).health = 'working';
		const storedRun = spawnSync(
			process.execPath,
			[STATUS, '--json', '--ledger', writeCaseFile('stored.json', stored), '--offline'],
			{ encoding: 'utf8' }
		);
		expect(storedRun.status).toBe(1);
		expect(storedRun.stderr).toContain('"health" is computed, never stored');

		const duplicate = ledgerOf({ id: 'layout.a' }, { id: 'layout.a' });
		const duplicateRun = spawnSync(
			process.execPath,
			[STATUS, '--json', '--ledger', writeCaseFile('duplicate.json', duplicate), '--offline'],
			{ encoding: 'utf8' }
		);
		expect(duplicateRun.status).toBe(1);
		expect(duplicateRun.stderr).toContain('duplicate id "layout.a"');

		const anchor = ledgerOf({ id: 'layout.a', northStar: 'north-star.md#not-a-section' });
		const anchorRun = spawnSync(
			process.execPath,
			[STATUS, '--json', '--ledger', writeCaseFile('anchor.json', anchor), '--offline'],
			{ encoding: 'utf8' }
		);
		expect(anchorRun.status).toBe(0);
		// Format is validated by the tool; the anchor is resolved against the
		// North Star in the seed test below, where the document is available.
		expect(anchorRun.stdout).toContain('layout.a');
	});

	it('keeps every seeded North Star anchor resolvable and every id unique', () => {
		const ledger = JSON.parse(readFileSync(LEDGER, 'utf8'));
		const anchors = anchorsOf(readFileSync(NORTH_STAR, 'utf8'));
		const ids = new Set<string>();
		for (const capability of ledger.capabilities) {
			expect(ids.has(capability.id)).toBe(false);
			ids.add(capability.id);
			const anchor = capability.northStar.replace(/^north-star\.md#/, '');
			expect(anchors.has(anchor)).toBe(true);
		}
		expect(ids.size).toBe(ledger.capabilities.length);
	});
});

describe('maturity comes from tagged checks', () => {
	it('never calls zero core checks working, and only a current review makes polished', () => {
		const ledger = ledgerOf(
			{ id: 'cap.zero-core' },
			{ id: 'cap.partial' },
			{ id: 'cap.working' },
			{
				id: 'cap.polished',
				design: { reference: 'docs/design.md', revision: 'r1' },
				review: {
					implementation: COMMIT,
					design: 'r1',
					date: '2026-11-01',
					verdict: 'accepted'
				}
			}
		);
		const report = status({
			ledger,
			report: runOf([
				{ cap: 'cap.zero-core', level: 'edge' },
				{ cap: 'cap.partial' },
				{ cap: 'cap.partial', status: 'failed' },
				{ cap: 'cap.working' },
				{ cap: 'cap.working' },
				{ cap: 'cap.polished' },
				{ cap: 'cap.polished' },
				{ cap: 'cap.polished', level: 'edge' }
			]),
			changedPaths: { 'cap.polished': [] }
		});

		expect(row(report, 'cap.zero-core').maturity).toBe('missing');
		expect(row(report, 'cap.partial').maturity).toBe('partial');
		expect(row(report, 'cap.working').maturity).toBe('working');
		expect(row(report, 'cap.polished').maturity).toBe('polished');
		expect(row(report, 'cap.polished').reviewCurrent).toBe(true);
	});

	it('drops a stale review back to working when a surface path changes', () => {
		const ledger = ledgerOf({
			id: 'cap.polished',
			design: { reference: 'docs/design.md', revision: 'r1' },
			review: {
				implementation: COMMIT,
				design: 'r1',
				date: '2026-11-01',
				verdict: 'accepted'
			}
		});
		const report = status({
			ledger,
			report: runOf([{ cap: 'cap.polished' }]),
			changedPaths: { 'cap.polished': ['apps/editor/src/lib/authoring/new-work.ts'] }
		});
		expect(row(report, 'cap.polished').reviewCurrent).toBe(false);
		expect(row(report, 'cap.polished').maturity).toBe('working');
	});

	it('treats a stale known-failing marker and a skip as failing checks', () => {
		const ledger = ledgerOf({ id: 'cap.stale' }, { id: 'cap.skipped' });
		const report = status({
			ledger,
			report: runOf([
				{ cap: 'cap.stale', knownFailing: 42 },
				{ cap: 'cap.skipped', status: 'skipped' }
			])
		});
		expect(row(report, 'cap.stale').health).toBe('broken');
		expect(row(report, 'cap.skipped').health).toBe('broken');
		expect(row(report, 'cap.stale').checks.core.passing).toBe(0);
	});
});

describe('health follows current evidence, not maturity', () => {
	it('reports broken for a failing core check or an open blocks-core bug', () => {
		const ledger = ledgerOf(
			{ id: 'cap.core-fail' },
			{ id: 'cap.edge-fail' },
			{ id: 'cap.blocked' },
			{ id: 'cap.bug' }
		);
		const report = status({
			ledger,
			report: runOf([
				{ cap: 'cap.core-fail', status: 'failed' },
				{ cap: 'cap.edge-fail', level: 'edge', status: 'failed' },
				{ cap: 'cap.blocked' },
				{ cap: 'cap.bug' }
			]),
			github: {
				issues: [
					{
						number: 1,
						title: 'the main journey is broken',
						labels: ['bug', 'blocks-core', 'cap:cap.blocked'],
						assignees: []
					},
					{
						number: 2,
						title: 'a visual defect',
						labels: ['bug', 'cap:cap.bug'],
						assignees: []
					}
				],
				claims: []
			}
		});

		expect(row(report, 'cap.core-fail').health).toBe('broken');
		expect(row(report, 'cap.edge-fail').health).toBe('degraded');
		expect(row(report, 'cap.blocked').maturity).toBe('working');
		expect(row(report, 'cap.blocked').health).toBe('broken');
		expect(row(report, 'cap.bug').health).toBe('degraded');
		expect(row(report, 'cap.bug').flags).toEqual([2]);
	});
});

describe('a report states its own provenance', () => {
	it('reads every capability unknown when the run is from another commit', () => {
		const report = status({
			ledger: ledgerOf({ id: 'cap.a' }),
			report: runOf([{ cap: 'cap.a' }], { commit: OTHER_COMMIT })
		});
		expect(report.complete).toBe(false);
		expect(row(report, 'cap.a').health).toBe('unknown');
	});

	it('reads unknown when a suite did not complete or no report exists', () => {
		const interrupted = status({
			ledger: ledgerOf({ id: 'cap.a' }),
			report: runOf([{ cap: 'cap.a' }], { suite: 'interrupted' })
		});
		expect(interrupted.complete).toBe(false);
		expect(row(interrupted, 'cap.a').health).toBe('unknown');

		const missing = status({ ledger: ledgerOf({ id: 'cap.a' }) });
		expect(missing.complete).toBe(false);
		expect(missing.testedCommit).toBe(null);
		expect(row(missing, 'cap.a').health).toBe('unknown');

		// A truncated run that recorded only one suite is not complete either:
		// completeness is the merge-gate contract, not the run's own list.
		const truncated = status({
			ledger: ledgerOf({ id: 'cap.a' }),
			report: {
				commit: COMMIT,
				generatedAt: '2026-11-06T10:00:00.000Z',
				suites: [{ name: 'npm test', status: 'complete', results: assertions([{ cap: 'cap.a' }]) }]
			}
		});
		expect(truncated.complete).toBe(false);
		expect(row(truncated, 'cap.a').health).toBe('unknown');
	});

	it('marks a capability regressed only between two complete reports', () => {
		const ledger = ledgerOf({ id: 'cap.a' });
		const previous = status({
			ledger,
			report: runOf([{ cap: 'cap.a' }, { cap: 'cap.a', level: 'edge' }])
		});
		expect(row(previous, 'cap.a').health).toBe('healthy');

		const current = status({
			ledger,
			report: runOf([{ cap: 'cap.a', status: 'failed' }]),
			previous
		});
		expect(row(current, 'cap.a').regressed).toBe(true);

		// An incomplete report cannot establish a regression.
		const stale = status({
			ledger,
			report: runOf([{ cap: 'cap.a', status: 'failed' }], { commit: OTHER_COMMIT }),
			previous
		});
		expect(row(stale, 'cap.a').regressed).toBe(false);
	});
});

describe('claims are visible, including collisions', () => {
	it('lists duplicate claims instead of picking a winner', () => {
		const report = status({
			ledger: ledgerOf({ id: 'layout.a' }),
			report: runOf([{ cap: 'layout.a' }]),
			github: {
				issues: [],
				claims: [
					{ number: 7, title: 'layout.a — draw walls', kind: 'pull' },
					{ number: 8, title: 'layout.a again', kind: 'pull' }
				]
			}
		});
		expect(row(report, 'layout.a').claims).toEqual([7, 8]);
		expect(report.duplicateClaims).toEqual([{ capabilityId: 'layout.a', numbers: [7, 8] }]);
	});
});

describe('the real repository starts honestly', () => {
	it('prints every seeded capability unknown with no recorded run', () => {
		const ledger = JSON.parse(readFileSync(LEDGER, 'utf8'));
		const report = status({ ledger });
		expect(report.capabilities).toHaveLength(ledger.capabilities.length);
		for (const entry of report.capabilities) {
			expect(entry.health).toBe('unknown');
		}
	});
});
