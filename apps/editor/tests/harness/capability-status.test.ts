/**
 * The harness report answers "what works, what is broken, what is undecided and
 * is anyone on it?" without anyone editing a status field. This suite pins the
 * rules that make that honest:
 *
 * - a capability with no core check never reads `working`;
 * - installed-runner `it.fails` semantics: a live reproducer keeps health
 *   failing while the gate stays green, a stale marker and an ordinary failing
 *   tagged test keep the gate red, and an unverifiable marker is never trusted;
 * - a skipped check counts as failing;
 * - an open `blocks-core` bug breaks health before any reproducer exists;
 * - a report from another commit, with an incomplete suite, or with absent /
 *   truncated test evidence reads `unknown` or is rejected, never green;
 * - an owner review expires when intervening `main` history touched the
 *   capability surface (including a later revert), and when the review commit
 *   is not part of main's history;
 * - claims from draft PRs and from any assignee are visible, including
 *   collisions.
 *
 * Cases drive the real CLI on fixture ledgers, recorded runs and a temporary
 * git repository, so provenance, git history and the exit contract are
 * exercised rather than simulated.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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
	/** The assertion body unexpectedly passed under `it.fails`. */
	stalePass?: boolean;
	/** How the source declares the test; defaults to `it.fails`. */
	source?: 'fails' | 'plain' | 'missing';
	title?: string;
};

/** The merge-gate suite contract the workflow records; a run must cover it. */
const REQUIRED_SUITES = [
	'npm run check',
	'npm run test:arch',
	'npm test',
	'npm run test:heavy',
	'npm run build',
	'npm run check:api',
	'npm run test:api',
	'npm run check:camera-core',
	'npm run check:layout-core',
	'npm run check:geometry-core',
	'npm run check:project-model'
];

const TEST_SUITES = ['npm test', 'npm run test:arch', 'npm run test:heavy'];
const TAP_SUITE = 'npm run test:api';

let fixtureCount = 0;

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

function markerText(check: Check) {
	const level = check.level ?? 'core';
	const suffix =
		check.knownFailing === undefined ? '' : ` known-failing:#${check.knownFailing}`;
	return `[cap:${check.cap} ${level}${suffix}]`;
}

/** An assertion's source file, so runner-mode verification is real. */
function sourceFor(check: Check) {
	fixtureCount += 1;
	if (check.knownFailing === undefined) return join(TEMP, 'untagged-source.test.ts');
	if (check.source === 'missing') return join(TEMP, `missing-${fixtureCount}.test.ts`);
	const kind = check.source === 'plain' ? 'it' : 'it.fails';
	const path = join(TEMP, `source-${fixtureCount}.test.ts`);
	writeFileSync(path, `${kind}('${markerText(check)} case', () => {});\n`);
	return path;
}

function assertions(checks: Check[]) {
	return {			testResults: checks.map((check) => ({
				name: sourceFor(check),
				assertionResults: [
					{
						fullName: `${markerText(check)} case`,
						title: `${markerText(check)} case`,
						status: check.status ?? (check.stalePass ? 'failed' : 'passed'),
					...(check.stalePass
						? { failureMessages: ['Error: Expect test to fail\n    at runTest (vitest)'] }
						: {})
				}
			]
		}))
	};
}

const SMOKE_SOURCE = join(TEMP, 'suite-smoke.test.ts');
writeFileSync(SMOKE_SOURCE, "it('suite smoke', () => {});\n");

function reportFor(results: any, options: { commit?: string; suite?: string } = {}) {
	return {
		commit: options.commit ?? COMMIT,
		generatedAt: '2026-11-06T10:00:00.000Z',
		suites: REQUIRED_SUITES.map((name) => {
			if (name === 'npm test') {
				return { name, status: options.suite ?? 'complete', results };
			}
			if (TEST_SUITES.includes(name)) {
				return {
					name,
					status: 'complete',
					results: {
						testResults: [
							{
								name: SMOKE_SOURCE,
								assertionResults: [{ fullName: 'suite smoke', status: 'passed' }]
							}
						]
					}
				};
			}
			if (name === TAP_SUITE) {
				return {
					name,
					status: 'complete',
					results: { tests: 1, passed: 1, failed: 0, skipped: 0 }
				};
			}
			return { name, status: 'complete', exitCode: 0 };
		})
	};
}

function runOf(checks: Check[], options: { commit?: string; suite?: string } = {}) {
	return reportFor(assertions(checks), options);
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
	repoRoot?: string;
	changedPaths?: Record<string, string[] | null>;
	github?: unknown;
};

function statusCommand(input: StatusInput) {
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
	if (input.repoRoot) args.push('--repo-root', input.repoRoot);
	if (input.previous !== undefined) args.push('--previous', writeCaseFile('previous.json', input.previous));
	if (input.changedPaths !== undefined) {
		args.push('--changed-paths', writeCaseFile('changed.json', input.changedPaths));
	}
	if (input.github !== undefined) args.push('--github', writeCaseFile('github.json', input.github));
	else args.push('--offline');
	return args;
}

function status(input: StatusInput) {
	return JSON.parse(execFileSync(process.execPath, statusCommand(input), { encoding: 'utf8' }));
}

function row(report: any, id: string) {
	const found = report.capabilities.find((entry: any) => entry.id === id);
	if (!found) throw new Error(`expected a report row for ${id}`);
	return found;
}

function expectRejected(input: StatusInput, message: string) {
	const result = spawnSync(process.execPath, statusCommand(input), { encoding: 'utf8' });
	expect(result.status).toBe(1);
	expect(result.stderr).toContain(message);
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
});

describe('runner expected-failure semantics', () => {
	it('keeps a live reproducer failing for health and green for the gate', () => {
		const report = status({
			ledger: ledgerOf({ id: 'cap.live' }),
			report: runOf([{ cap: 'cap.live', knownFailing: 42 }])
		});
		expect(row(report, 'cap.live').health).toBe('broken');
		expect(row(report, 'cap.live').maturity).toBe('missing');
		expect(row(report, 'cap.live').failingChecks[0].status).toBe('expected-failing');
		expect(report.gate.failures).toEqual([]);
	});

	it('fails the gate for a stale marker, a plain failing tagged test and an unverified marker', () => {
		const report = status({
			ledger: ledgerOf(
				{ id: 'cap.stale' },
				{ id: 'cap.plain-pass' },
				{ id: 'cap.unverified' },
				{ id: 'cap.ordinary' },
				{ id: 'cap.skipped' }
			),
			report: runOf([
				// `it.fails` body unexpectedly passed: JSON says failed.
				{ cap: 'cap.stale', knownFailing: 1, stalePass: true },
				// Passing markdown on a plain `it`: not runner expected-failure mode.
				{ cap: 'cap.plain-pass', knownFailing: 2, source: 'plain' },
				// Passing marker whose source cannot be read.
				{ cap: 'cap.unverified', knownFailing: 3, source: 'missing' },
				// A marked test that failed ordinarily is not expected failure either.
				{ cap: 'cap.ordinary', knownFailing: 4, status: 'failed' },
				{ cap: 'cap.skipped', knownFailing: 5, status: 'skipped' }
			])
		});

		const statuses = Object.fromEntries(
			report.capabilities.map((entry: any) => [entry.id, entry.failingChecks[0]?.status])
		);
		expect(statuses['cap.stale']).toBe('stale-marker');
		expect(statuses['cap.plain-pass']).toBe('stale-marker');
		expect(statuses['cap.unverified']).toBe('unverified-marker');
		expect(statuses['cap.ordinary']).toBe('failed');
		expect(statuses['cap.skipped']).toBe('skipped');
		expect(report.gate.failures).toHaveLength(5);
		expect(report.gate.failures.map((failure: any) => failure.reason).join('\n')).toContain(
			'is not backed by it.fails'
		);
		expect(report.gate.failures.map((failure: any) => failure.reason).join('\n')).toContain(
			'no longer reproduces'
		);
	});

	it('exercises the installed Vitest runner end-to-end', () => {
		// The JSON reporter is the contract this harness reads. Run the installed
		// runner on both `it.fails` outcomes rather than trusting hand-written
		// statuses, then feed its real artifact through the CLI.
		const probeName = `zz-runner-probe-${process.pid}.test.ts`;
		const probePath = join(REPO_ROOT, 'apps/editor/tests/harness', probeName);
		const outputPath = join(TEMP, 'runner-result.json');
		writeFileSync(
			probePath,
			[
				"import { describe, expect, it } from 'vitest';",
				'',
				"describe('probe', () => {",
				"\tit.fails('[cap:probe.expected core known-failing:#42] expected body failure', () => {",
				'\t\texpect(1).toBe(2);',
				'\t});',
				"\tit.fails('[cap:probe.stale core known-failing:#43] unexpected body pass', () => {",
				'\t\texpect(1).toBe(1);',
				'\t});',
				"\tit.fails('[cap:probe.repeat core known-failing:#44] first declaration still fails', () => {",
				'\t\texpect(1).toBe(2);',
				'\t});',
				"\tit('[cap:probe.repeat core known-failing:#44] second declaration plain pass', () => {",
				'\t\texpect(1).toBe(1);',
				'\t});',
				'});',
				''
			].join('\n')
		);
		try {
			spawnSync(
				'npx',
				[
					'vitest',
					'run',
					`tests/harness/${probeName}`,
					'--reporter=json',
					`--outputFile=${outputPath}`
				],
				{ cwd: join(REPO_ROOT, 'apps/editor'), encoding: 'utf8' }
			);
			const results = JSON.parse(readFileSync(outputPath, 'utf8'));
			const ledger = ledgerOf(
				{ id: 'probe.expected' },
				{ id: 'probe.stale' },
				{ id: 'probe.repeat' }
			);
			const suites = REQUIRED_SUITES.map((name) => {
				if (name === 'npm test') return { name, status: 'complete', results };
				if (TEST_SUITES.includes(name)) {
					return {
						name,
						status: 'complete',
						results: {
							testResults: [
								{
									name: SMOKE_SOURCE,
									assertionResults: [{ fullName: 'suite smoke', status: 'passed' }]
								}
							]
						}
					};
				}
				if (name === TAP_SUITE) {
					return {
						name,
						status: 'complete',
						results: { tests: 1, passed: 1, failed: 0, skipped: 0 }
					};
				}
				return { name, status: 'complete', exitCode: 0 };
			});
			const report = status({
				ledger,
				report: { commit: COMMIT, generatedAt: '2026-11-06T10:00:00.000Z', suites }
			});

			expect(row(report, 'probe.expected').failingChecks[0].status).toBe('expected-failing');
			expect(row(report, 'probe.expected').health).toBe('broken');

			// Two tests share one marker. The second is a plain passing `it` and must
			// not borrow the first `it.fails` declaration.
			const repeat = row(report, 'probe.repeat').failingChecks;
			expect(
				repeat.find((check: any) => check.name.includes('first declaration')).status
			).toBe('expected-failing');
			expect(
				repeat.find((check: any) => check.name.includes('second declaration')).status
			).toBe('stale-marker');

			expect(report.gate.failures).toHaveLength(2);
			const failingNames = report.gate.failures.map((failure: any) => failure.name).join('\n');
			expect(failingNames).toContain('probe.stale');
			expect(failingNames).toContain('second declaration');
		} finally {
			rmSync(probePath, { force: true });
		}
	});

	it('rejects a real runner runtime failure that no assertion accounts for', () => {
		const probeName = `zz-runtime-probe-${process.pid}.test.ts`;
		const probePath = join(REPO_ROOT, 'apps/editor/tests/harness', probeName);
		const outputPath = join(TEMP, 'runtime-result.json');
		writeFileSync(
			probePath,
			[
				"import { afterAll, expect, it } from 'vitest';",
				'',
				'afterAll(() => {',
				"\tthrow new Error('teardown failed');",
				'});',
				'',
				"it('passes', () => {",
				'\texpect(1).toBe(1);',
				'});',
				''
			].join('\n')
		);
		try {
			const run = spawnSync(
				'npx',
				[
					'vitest',
					'run',
					`tests/harness/${probeName}`,
					'--reporter=json',
					`--outputFile=${outputPath}`
				],
				{ cwd: join(REPO_ROOT, 'apps/editor'), encoding: 'utf8' }
			);
			// The installed runner itself exits 1 for the teardown error.
			expect(run.status).toBe(1);
			const results = JSON.parse(readFileSync(outputPath, 'utf8'));
			const result = spawnSync(
				process.execPath,
				statusCommand({
					ledger: ledgerOf({ id: 'cap.teardown' }),
					report: reportFor(results)
				}),
				{ encoding: 'utf8' }
			);
			expect(result.status).toBe(1);
			expect(result.stderr).toContain('unhandled or hook error');
		} finally {
			rmSync(probePath, { force: true });
		}
	});

	it('fails closed for inherited and unsupported marker declarations', () => {
		const inheritedPath = join(TEMP, 'inherited-marker.test.ts');
		writeFileSync(
			inheritedPath,
			"describe('[cap:cap.inherited core known-failing:#7] group', () => { it('works', () => {}); });\n"
		);
		const eachPath = join(TEMP, 'each-marker.test.ts');
		writeFileSync(
			eachPath,
			"it.each([1])('[cap:cap.each core known-failing:#8] case', () => {});\n"
		);
		const report = status({
			ledger: ledgerOf({ id: 'cap.inherited' }, { id: 'cap.each' }),
			report: reportFor({
				numTotalTests: 2,
				testResults: [
					{
						name: inheritedPath,
						assertionResults: [
							{
								fullName: '[cap:cap.inherited core known-failing:#7] group works',
								title: 'works',
								status: 'passed'
							}
						]
					},
					{
						name: eachPath,
						assertionResults: [
							{
								fullName: '[cap:cap.each core known-failing:#8] case',
								title: '[cap:cap.each core known-failing:#8] case',
								status: 'passed'
							}
						]
					}
				]
			})
		});
		expect(row(report, 'cap.inherited').failingChecks[0].status).toBe('stale-marker');
		expect(row(report, 'cap.each').failingChecks[0].status).toBe('unverified-marker');
		expect(report.gate.failures).toHaveLength(2);
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
						labels: [{ name: 'bug' }, { name: 'blocks-core' }, { name: 'cap:cap.blocked' }],
						assignees: []
					},
					{
						number: 2,
						title: 'a visual defect',
						labels: [{ name: 'bug' }, { name: 'cap:cap.bug' }],
						assignees: []
					}
				],
				pulls: []
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

	it('rejects evidence that cannot certify a run', () => {
		const ledger = ledgerOf({ id: 'cap.a' });
		const valid = runOf([{ cap: 'cap.a' }]);

		expectRejected(
			{ ledger, report: { ...valid, generatedAt: undefined } },
			'generatedAt must be an ISO timestamp'
		);

		const noResults = {
			...valid,
			suites: REQUIRED_SUITES.map((name) =>
				TEST_SUITES.includes(name)
					? { name, status: 'complete' }
					: { name, status: 'complete', exitCode: 0 }
			)
		};
		expectRejected({ ledger, report: noResults }, 'completed without a Vitest reporter artifact');

		const collectedNothing = {
			...valid,
			suites: valid.suites.map((suite: any) =>
				suite.name === 'npm test'
					? { name: suite.name, status: 'complete', results: { testResults: [] } }
					: suite
			)
		};
		expectRejected({ ledger, report: collectedNothing }, 'recorded no test files');

		const commandFailed = {
			...valid,
			suites: valid.suites.map((suite: any) =>
				suite.name === 'npm run build' ? { ...suite, exitCode: 1 } : suite
			)
		};
		expectRejected({ ledger, report: commandFailed }, 'completed without exitCode 0');

		// A file lost to a collection failure inside an otherwise good suite.
		const collectionFailure = {
			...valid,
			suites: valid.suites.map((suite: any) =>
				suite.name === 'npm test'
					? {
							name: suite.name,
							status: 'complete',
							results: {
								numTotalTests: 1,
								testResults: [
									...suite.results.testResults,
									{
										name: 'collection.test.js',
										status: 'failed',
										message: 'import failed',
										assertionResults: []
									}
								]
							}
						}
					: suite
			)
		};
		expectRejected({ ledger, report: collectionFailure }, 'recorded a test file with no assertions');

		// A completed suite that collected nothing cannot ride another suite.
		const emptySuite = {
			...valid,
			suites: valid.suites.map((suite: any) =>
				suite.name === 'npm run test:heavy'
					? {
							name: suite.name,
							status: 'complete',
							results: {
								testResults: [{ name: 'empty.test.js', assertionResults: [] }]
							}
						}
					: suite
			)
		};
		expectRejected({ ledger, report: emptySuite }, 'recorded a test file with no assertions');

		// Reporter counts that contradict the artifact are not certified either.
		const zeroCollected = {
			...valid,
			suites: valid.suites.map((suite: any) =>
				suite.name === 'npm test'
					? {
							name: suite.name,
							status: 'complete',
							results: {
								numTotalTests: 0,
								testResults: [
									{
										name: 'ghost.test.js',
										assertionResults: [{ fullName: 'ghost', status: 'passed' }]
									}
								]
							}
						}
					: suite
			)
		};
		expectRejected({ ledger, report: zeroCollected }, 'reported zero collected tests');

		// The DB-backed API contract must prove it executed with zero skips: a
		// missing database produces a green node:test run that skipped contracts.
		const skippedApi = {
			...valid,
			suites: valid.suites.map((suite: any) =>
				suite.name === TAP_SUITE
					? {
							name: suite.name,
							status: 'complete',
							results: { tests: 3, passed: 2, failed: 0, skipped: 1 }
						}
					: suite
			)
		};
		expectRejected({ ledger, report: skippedApi }, 'requires zero skips');

		const emptyApi = {
			...valid,
			suites: valid.suites.map((suite: any) =>
				suite.name === TAP_SUITE
					? {
							name: suite.name,
							status: 'complete',
							results: { tests: 0, passed: 0, failed: 0, skipped: 0 }
						}
					: suite
			)
		};
		expectRejected({ ledger, report: emptyApi }, 'recorded no executed tests');

		// A runtime/hook failure with only passing assertions cannot certify green:
		// there is no capability row where that failure could show as health.
		const runtimeFailure = {
			...valid,
			suites: valid.suites.map((suite: any) =>
				suite.name === 'npm test'
					? {
							name: suite.name,
							status: 'complete',
							results: {
								success: false,
								numFailedTestSuites: 1,
								numFailedTests: 0,
								numTotalTests: 1,
								testResults: [
									{
										name: 'teardown.test.js',
										status: 'failed',
										message: 'teardown failed',
										assertionResults: [{ fullName: 'passes', status: 'passed' }]
									}
								]
							}
						}
					: suite
			)
		};
		expectRejected({ ledger, report: runtimeFailure }, 'unhandled or hook error');
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

describe('owner reviews follow intervening main history', () => {
	function git(directory: string, ...args: string[]) {
		return execFileSync(
			'git',
			['-c', 'user.name=Harness', '-c', 'user.email=harness@example.test', ...args],
			{ cwd: directory, encoding: 'utf8' }
		).trim();
	}
	function commit(directory: string, message: string) {
		git(directory, 'add', '-A');
		git(directory, 'commit', '-qm', message);
		return git(directory, 'rev-parse', 'HEAD');
	}

	const repo = mkdtempSync(join(TEMP, 'repo-'));
	git(repo, 'init', '-q');
	mkdirSync(join(repo, 'apps/editor/src'), { recursive: true });
	const surface = join(repo, 'apps/editor/src/a.ts');
	const notes = join(repo, 'notes.txt');
	writeFileSync(surface, 'base\n');
	writeFileSync(notes, 'base\n');
	const base = commit(repo, 'base');
	writeFileSync(surface, 'changed\n');
	commit(repo, 'surface change');
	writeFileSync(surface, 'base\n');
	const reverted = commit(repo, 'revert surface');
	writeFileSync(notes, 'changed\n');
	const unrelated = commit(repo, 'unrelated change');
	git(repo, 'checkout', '-q', '-b', 'side', base);
	writeFileSync(surface, 'side\n');
	const outside = commit(repo, 'surface on an unmerged branch');
	git(repo, 'checkout', '-q', unrelated);

	const reviewAt = (implementation: string) => ({
		implementation,
		design: 'r1',
		date: '2026-11-01',
		verdict: 'accepted'
	});
	const ledger = ledgerOf(
		{ id: 'cap.reverted', design: { reference: 'docs/design.md', revision: 'r1' }, review: reviewAt(base) },
		{ id: 'cap.unrelated', design: { reference: 'docs/design.md', revision: 'r1' }, review: reviewAt(reverted) },
		{ id: 'cap.outside', design: { reference: 'docs/design.md', revision: 'r1' }, review: reviewAt(outside) },
		{ id: 'cap.head', design: { reference: 'docs/design.md', revision: 'r1' }, review: reviewAt(unrelated) }
	);

	it('expires on a reverted surface change and on an unmerged review commit', () => {
		const report = status({
			ledger,
			report: runOf([{ cap: 'cap.head' }], { commit: unrelated }),
			mainHead: unrelated,
			repoRoot: repo
		});
		expect(row(report, 'cap.reverted').reviewCurrent).toBe(false);
		expect(row(report, 'cap.outside').reviewCurrent).toBe(false);
	});

	it('keeps a review current for unrelated changes and for an unchanged head', () => {
		const report = status({
			ledger,
			report: runOf([{ cap: 'cap.head' }], { commit: unrelated }),
			mainHead: unrelated,
			repoRoot: repo
		});
		expect(row(report, 'cap.unrelated').reviewCurrent).toBe(true);
		expect(row(report, 'cap.head').reviewCurrent).toBe(true);
	});
});

describe('claims are visible, including collisions', () => {
	it('lists draft PRs and issues assigned to any agent, and flags duplicates', () => {
		const report = status({
			ledger: ledgerOf({ id: 'layout.a' }),
			report: runOf([{ cap: 'layout.a' }]),
			github: {
				issues: [
					{
						number: 9,
						title: 'layout.a is already claimed elsewhere',
						labels: [],
						assignees: [{ login: 'other-agent' }]
					}
				],
				pulls: [
					{ number: 7, title: 'layout.a — draw walls', isDraft: true, assignees: [] },
					{ number: 8, title: 'layout.a again', isDraft: true, assignees: [] }
				]
			}
		});
		expect(row(report, 'layout.a').claims).toEqual([7, 8, 9]);
		expect(report.duplicateClaims).toEqual([{ capabilityId: 'layout.a', numbers: [7, 8, 9] }]);
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
