/**
 * `status` must work from a fresh checkout: discover the report a successful
 * main push actually published, never a pull-request synthetic merge, and use
 * the previous complete main report only for a real regression.
 *
 * These cases drive the shipped CLI with a temporary git repository and a fake
 * `gh` that implements run listing, artifact listing and artifact download.
 * The downloaded reports are the same shape the workflow's aggregate emits.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';

import { REPO_ROOT } from '../helpers/docs-references';

const STATUS = join(REPO_ROOT, 'tools/harness/status.mjs');
const TEMP = mkdtempSync(join(tmpdir(), 'harness-discovery-'));
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
const CI_SOURCE =
	'/home/runner/work/spatial-sketch-editor/spatial-sketch-editor/apps/editor/tests/probe.test.ts';

const FAKE_GH = [
	'#!/usr/bin/env node',
	"import { copyFileSync, mkdirSync, readFileSync } from 'node:fs';",
	"import { join } from 'node:path';",
	'const args = process.argv.slice(2);',
	'const runs = JSON.parse(readFileSync(process.env.FAKE_GH_RUNS, "utf8"));',
	'const reports = JSON.parse(readFileSync(process.env.FAKE_GH_REPORTS, "utf8"));',
	'if (args[0] === "run" && args[1] === "list") { console.log(JSON.stringify(runs)); process.exit(0); }',
	'if (args[0] === "run" && args[1] === "download") {',
	'  const runId = args[2];',
	'  const dir = args[args.indexOf("--dir") + 1];',
	'  mkdirSync(dir, { recursive: true });',
	'  copyFileSync(reports[runId], join(dir, "report.json"));',
	'  process.exit(0);',
	'}',
	'if (args[0] === "api" && args[1].includes("/artifacts")) {',
	'  console.log(JSON.stringify({ artifacts: [{ id: 1, name: "harness-report", expired: false }] }));',
	'  process.exit(0);',
	'}',
	'if (args[0] === "issue" || args[0] === "pr") { console.log("[]"); process.exit(0); }',
	'console.error("unexpected gh invocation: " + args.join(" "));',
	'process.exit(1);',
	''
].join('\n');

const fakeBin = join(TEMP, 'bin');
mkdirSync(fakeBin, { recursive: true });
writeFileSync(join(fakeBin, 'gh'), FAKE_GH);
chmodSync(join(fakeBin, 'gh'), 0o755);

afterAll(() => rmSync(TEMP, { recursive: true, force: true }));

function git(repo: string, ...args: string[]) {
	return execFileSync(
		'git',
		['-c', 'user.name=Harness', '-c', 'user.email=harness@example.test', ...args],
		{ cwd: repo, encoding: 'utf8' }
	).trim();
}

function makeRepo() {
	const repo = mkdtempSync(join(TEMP, 'repo-'));
	git(repo, 'init', '-q');
	mkdirSync(join(repo, 'apps/editor/tests'), { recursive: true });
	const source = join(repo, 'apps/editor/tests/probe.test.ts');
	writeFileSync(source, "it('[cap:cap.a core known-failing:#7] works', () => {});\n");
	git(repo, 'add', '-A');
	git(repo, 'commit', '-qm', 'previous');
	const previous = git(repo, 'rev-parse', 'HEAD');
	writeFileSync(source, "it.fails('[cap:cap.a core known-failing:#7] works', () => {});\n");
	git(repo, 'add', '-A');
	git(repo, 'commit', '-qm', 'main');
	const main = git(repo, 'rev-parse', 'HEAD');
	return { repo, source, previous, main };
}

function reportFor(
	commit: string,
	options: { status?: 'passed' | 'failed'; title?: string; source?: string } = {}
) {
	const title = options.title ?? '[cap:cap.a core] works';
	const testResults = [
		{
			name: options.source ?? CI_SOURCE,
			assertionResults: [
				{
					fullName: title,
					title,
					status: options.status ?? 'passed'
				}
			]
		}
	];
	return {
		commit,
		generatedAt: '2026-11-06T10:00:00.000Z',
		suites: REQUIRED_SUITES.map((name) => {
			if (name === 'npm test') {
				return { name, status: 'complete', results: { numTotalTests: 1, testResults } };
			}
			if (name === 'npm run test:arch' || name === 'npm run test:heavy') {
				return {
					name,
					status: 'complete',
					results: {
						numTotalTests: 1,
						testResults: [
							{
								name: 'smoke.test.ts',
								assertionResults: [{ fullName: 'smoke', title: 'smoke', status: 'passed' }]
							}
						]
					}
				};
			}
			if (name === 'npm run test:api') {
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

function writeJson(name: string, value: unknown) {
	const path = join(TEMP, name);
	writeFileSync(path, JSON.stringify(value));
	return path;
}

function runStatus(
	repo: string,
	mainHead: string,
	options: {
		report?: string;
		offline?: boolean;
		runs?: unknown[];
		reports?: Record<string, string>;
	} = {}
) {
	const ledger = {
		schemaVersion: 1,
		capabilities: [
			{
				id: 'cap.a',
				area: 'T1',
				summary: 'A',
				northStar: 'north-star.md#sacred-contracts',
				surface: ['apps/editor/src/**'],
				design: null,
				review: null
			}
		]
	};
	const args = [
		STATUS,
		'--json',
		'--ledger',
		writeJson('ledger.json', ledger),
		'--main-head',
		mainHead,
		'--repo-root',
		repo
	];
	if (options.report) args.push('--report', options.report);
	if (options.offline) args.push('--offline');
	return spawnSync(process.execPath, args, {
		encoding: 'utf8',
		env: {
			...process.env,
			PATH: `${fakeBin}:${process.env.PATH ?? ''}`,
			FAKE_GH_RUNS: writeJson('runs.json', options.runs ?? []),
			FAKE_GH_REPORTS: writeJson('reports.json', options.reports ?? {})
		}
	});
}

function statusJson(result: ReturnType<typeof spawnSync>) {
	expect(result.status).toBe(0);
	return JSON.parse(String(result.stdout));
}

describe('fresh main report discovery', () => {
	it('reads unknown when no successful main-head run exists, without inventing green', () => {
		const { repo, main } = makeRepo();
		const report = statusJson(runStatus(repo, main));
		expect(report.complete).toBe(false);
		expect(report.testedCommit).toBe(null);
		expect(report.capabilities[0].health).toBe('unknown');
		expect(report.evidence.source).toBe('github-main');
		expect(report.evidence.reason).toContain('no successful Merge gate push run');
	});

	it('rejects a successful pull-request run even when its head is the main commit', () => {
		const { repo, main } = makeRepo();
		const reportPath = writeJson('pr-report.json', reportFor(main));
		const report = statusJson(
			runStatus(repo, main, {
				runs: [
					{
						databaseId: 1,
						workflowName: 'Merge gate',
						event: 'pull_request',
						status: 'completed',
						conclusion: 'success',
						headSha: main,
						headBranch: 'claude/lean-harness-proposal',
						createdAt: '2026-11-06T10:00:00Z',
						url: 'https://example.test/run/1'
					}
				],
				reports: { '1': reportPath }
			})
		);
		expect(report.complete).toBe(false);
		expect(report.evidence.current).toBe(null);
	});

	it('rejects an artifact whose report commit does not match the run head', () => {
		const { repo, main } = makeRepo();
		const reportPath = writeJson('mismatch-report.json', reportFor('f'.repeat(40)));
		const report = statusJson(
			runStatus(repo, main, {
				runs: [
					{
						databaseId: 2,
						workflowName: 'Merge gate',
						event: 'push',
						status: 'completed',
						conclusion: 'success',
						headSha: main,
						headBranch: 'main',
						createdAt: '2026-11-06T10:00:00Z',
						url: 'https://example.test/run/2'
					}
				],
				reports: { '2': reportPath }
			})
		);
		expect(report.complete).toBe(false);
		expect(report.evidence.reason).toContain('does not match run head');
	});

	it('uses only a complete ancestor report for regression, not the current run', () => {
		const { repo, previous, main } = makeRepo();
		const previousReport = writeJson('previous-report.json', reportFor(previous));
		const currentReport = writeJson(
			'current-report.json',
			reportFor(main, { status: 'failed' })
		);
		const report = statusJson(
			runStatus(repo, main, {
				runs: [
					{
						databaseId: 20,
						workflowName: 'Merge gate',
						event: 'push',
						status: 'completed',
						conclusion: 'success',
						headSha: previous,
						headBranch: 'main',
						createdAt: '2026-11-06T09:00:00Z',
						url: 'https://example.test/run/20'
					},
					{
						databaseId: 21,
						workflowName: 'Merge gate',
						event: 'push',
						status: 'completed',
						conclusion: 'success',
						headSha: main,
						headBranch: 'main',
						createdAt: '2026-11-06T10:00:00Z',
						url: 'https://example.test/run/21'
					}
				],
				reports: { '20': previousReport, '21': currentReport }
			})
		);
		expect(report.complete).toBe(true);
		expect(report.testedCommit).toBe(main);
		expect(report.capabilities[0].health).toBe('broken');
		expect(report.capabilities[0].regressed).toBe(true);
		expect(report.evidence.current.runId).toBe(21);
		expect(report.evidence.previous.runId).toBe(20);
	});

	it('ignores an incomplete previous artifact instead of using it for regression', () => {
		const { repo, previous, main } = makeRepo();
		const incomplete = reportFor(previous);
		incomplete.suites = incomplete.suites.filter((suite) => suite.name !== 'npm run build');
		const previousReport = writeJson('incomplete-previous.json', incomplete);
		const currentReport = writeJson('current-after-incomplete.json', reportFor(main));
		const report = statusJson(
			runStatus(repo, main, {
				runs: [
					{
						databaseId: 30,
						workflowName: 'Merge gate',
						event: 'push',
						status: 'completed',
						conclusion: 'success',
						headSha: previous,
						headBranch: 'main',
						createdAt: '2026-11-06T09:00:00Z',
						url: 'https://example.test/run/30'
					},
					{
						databaseId: 31,
						workflowName: 'Merge gate',
						event: 'push',
						status: 'completed',
						conclusion: 'success',
						headSha: main,
						headBranch: 'main',
						createdAt: '2026-11-06T10:00:00Z',
						url: 'https://example.test/run/31'
					}
				],
				reports: { '30': previousReport, '31': currentReport }
			})
		);
		expect(report.complete).toBe(true);
		expect(report.evidence.previous).toBe(null);
		expect(report.capabilities[0].regressed).toBe(false);
	});

	it('resolves a CI reporter path through the tested commit, not the working tree', () => {
		const { repo, source, main } = makeRepo();
		const reportPath = writeJson(
			'known-failing-report.json',
			reportFor(main, {
				title: '[cap:cap.a core known-failing:#7] works',
				status: 'passed'
			})
		);
		// The checkout has drifted since the tested commit. Marker verification
		// must read the committed `it.fails`, not this plain `it`.
		writeFileSync(source, "it('[cap:cap.a core known-failing:#7] works', () => {});\n");
		const report = statusJson(
			runStatus(repo, main, {
				report: reportPath,
				offline: true
			})
		);
		expect(report.complete).toBe(true);
		expect(report.capabilities[0].failingChecks[0].status).toBe('expected-failing');
		expect(report.gate.failures).toEqual([]);
	});
});
