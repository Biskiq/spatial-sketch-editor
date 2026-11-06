/**
 * Merge-gate production, not just the report rulebook.
 *
 * The gate is only real if a failing suite's provenance reaches the aggregate,
 * if missing or unreadable evidence cannot be certified, and if the hard guards
 * refuse an unapproved check removal. These cases drive the shipped CLIs on
 * fixture provenance and a temporary git repository, so the exit contract is
 * exercised rather than described.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';

import { REPO_ROOT } from '../helpers/docs-references';

const PRODUCE = join(REPO_ROOT, 'tools/harness/produce.mjs');
const AGGREGATE = join(REPO_ROOT, 'tools/harness/aggregate.mjs');
const GUARDS = join(REPO_ROOT, 'tools/harness/guards.mjs');
const WORKFLOW = join(REPO_ROOT, '.github/workflows/merge-gate.yml');
const TEMP = mkdtempSync(join(tmpdir(), 'harness-gate-'));
const COMMIT = 'c'.repeat(40);

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
const VITEST_SUITES = ['npm test', 'npm run test:arch', 'npm run test:heavy'];
const TAP_SUITE = 'npm run test:api';

afterAll(() => rmSync(TEMP, { recursive: true, force: true }));

let counter = 0;
function tempDir(name: string) {
	counter += 1;
	return join(TEMP, `${counter}-${name}`);
}

function run(script: string, args: string[], cwd = REPO_ROOT) {
	return spawnSync(process.execPath, [script, ...args], { cwd, encoding: 'utf8' });
}

function provenance(name: string, overrides: Record<string, unknown> = {}) {
	return {
		suite: name,
		command: `fixture ${name}`,
		commit: COMMIT,
		exitCode: 0,
		status: 'complete',
		results: VITEST_SUITES.includes(name)
			? {
					numTotalTests: 1,
					testResults: [
						{
							name: 'fixture.test.ts',
							assertionResults: [
								{ fullName: '[cap:cap.a core] works', status: 'passed' }
							]
						}
					]
				}
			: name === TAP_SUITE
				? { tests: 4, passed: 4, failed: 0, skipped: 0 }
				: null,
		...overrides
	};
}

function writeProvenance(dir: string, entries: any[]) {
	mkdirSync(dir, { recursive: true });
	for (const entry of entries) {
		const slug = entry.suite.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
		writeFileSync(join(dir, `${slug}.json`), `${JSON.stringify(entry, null, 2)}\n`);
	}
}

function aggregate(dir: string, out: string) {
	return run(AGGREGATE, ['--dir', dir, '--out', out, '--commit', COMMIT]);
}

describe('provenance production', () => {
	it('records a failing command suite with its own exit code', () => {
		const dir = tempDir('producer-fail');
		const result = run(PRODUCE, [
			'--suite',
			'npm run check',
			'--artifact-dir',
			dir,
			'--commit',
			COMMIT,
			'--',
			'node',
			'-e',
			'process.exit(3)'
		]);
		expect(result.status).toBe(3);
		const record = JSON.parse(readFileSync(join(dir, 'check.json'), 'utf8'));
		expect(record).toMatchObject({
			suite: 'npm run check',
			commit: COMMIT,
			exitCode: 3,
			status: 'failed'
		});
	});

	it('records the runner artifact for a vitest suite', () => {
		const dir = tempDir('producer-vitest');
		const writer = join(dir, 'write-vitest-json.mjs');
		mkdirSync(dir, { recursive: true });
		writeFileSync(
			writer,
			[
				"import { writeFileSync } from 'node:fs';",
				"const arg = process.argv.find((value) => value.startsWith('--outputFile='));",
				"writeFileSync(arg.slice('--outputFile='.length), JSON.stringify({",
				'\tnumTotalTests: 1,',
				"\ttestResults: [{ name: 'fixture.test.ts', assertionResults: [{ fullName: '[cap:cap.a core] works', status: 'passed' }] }]",
				'}));',
				''
			].join('\n')
		);
		const result = run(PRODUCE, [
			'--suite',
			'npm test',
			'--artifact-dir',
			dir,
			'--commit',
			COMMIT,
			'--',
			process.execPath,
			writer
		]);
		expect(result.status).toBe(0);
		const record = JSON.parse(readFileSync(join(dir, 'test.json'), 'utf8'));
		expect(record.status).toBe('complete');
		expect(record.results.numTotalTests).toBe(1);
	});
});

describe('gate aggregation', () => {
	it('certifies a complete run of every required suite', () => {
		const dir = tempDir('aggregate-complete');
		writeProvenance(dir, REQUIRED_SUITES.map((name) => provenance(name)));
		const result = aggregate(dir, join(TEMP, 'complete-report.json'));
		expect(result.stderr).toBe('');
		expect(result.status).toBe(0);
		const report = JSON.parse(readFileSync(join(TEMP, 'complete-report.json'), 'utf8'));
		expect(report.commit).toBe(COMMIT);
		expect(report.suites).toHaveLength(REQUIRED_SUITES.length);
		expect(report.suites.every((suite: any) => suite.status === 'complete')).toBe(true);
	});

	it('refuses a run with a missing suite', () => {
		const dir = tempDir('aggregate-missing');
		writeProvenance(
			dir,
			REQUIRED_SUITES.filter((name) => name !== 'npm run build').map((name) =>
				provenance(name)
			)
		);
		const result = aggregate(dir, join(TEMP, 'missing-report.json'));
		expect(result.status).toBe(1);
		expect(result.stderr).toContain('npm run build is missing');
	});

	it('refuses a failed suite even when the rest are complete', () => {
		const dir = tempDir('aggregate-failed');
		writeProvenance(
			dir,
			REQUIRED_SUITES.map((name) =>
				name === 'npm run build'
					? provenance(name, { status: 'failed', exitCode: 2 })
					: provenance(name)
			)
		);
		expect(aggregate(dir, join(TEMP, 'failed-report.json')).status).toBe(1);
	});

	it('refuses a runtime failure that the reporter flattened', () => {
		const dir = tempDir('aggregate-runtime');
		writeProvenance(
			dir,
			REQUIRED_SUITES.map((name) =>
				name === 'npm test'
					? provenance(name, {
							results: {
								success: false,
								numFailedTestSuites: 1,
								numFailedTests: 0,
								numTotalTests: 1,
								testResults: [
									{
										name: 'teardown.test.ts',
										status: 'failed',
										message: 'teardown failed',
										assertionResults: [{ fullName: 'passes', status: 'passed' }]
									}
								]
							}
						})
					: provenance(name)
			)
		);
		const result = aggregate(dir, join(TEMP, 'runtime-report.json'));
		expect(result.status).toBe(1);
		expect(result.stderr).toContain('unhandled or hook error');
	});

	it('refuses an API run with skipped contracts', () => {
		const dir = tempDir('aggregate-skips');
		writeProvenance(
			dir,
			REQUIRED_SUITES.map((name) =>
				name === TAP_SUITE
					? provenance(name, { results: { tests: 4, passed: 3, failed: 0, skipped: 1 } })
					: provenance(name)
			)
		);
		const result = aggregate(dir, join(TEMP, 'skips-report.json'));
		expect(result.status).toBe(1);
		expect(result.stderr).toContain('requires zero skips');
	});

	it('keeps a producer failure out of a certified run', () => {
		const produced = tempDir('producer-to-gate');
		run(PRODUCE, [
			'--suite',
			'npm run check',
			'--artifact-dir',
			produced,
			'--commit',
			COMMIT,
			'--',
			'node',
			'-e',
			'process.exit(1)'
		]);
		writeProvenance(
			produced,
			REQUIRED_SUITES.filter((name) => name !== 'npm run check').map((name) =>
				provenance(name)
			)
		);
		expect(aggregate(produced, join(TEMP, 'mixed-report.json')).status).toBe(1);
	});
});

describe('hard guards', () => {
	function git(repo: string, ...args: string[]) {
		return execFileSync('git', args, { cwd: repo, encoding: 'utf8' }).trim();
	}

	function fixtureRepo(name: string, base: string, head: string) {
		const repo = tempDir(name);
		mkdirSync(join(repo, 'apps/editor/tests'), { recursive: true });
		git(repo, 'init', '-q');
		git(repo, 'config', 'user.email', 'fixture@example.com');
		git(repo, 'config', 'user.name', 'Fixture');
		writeFileSync(join(repo, 'apps/editor/tests/a.test.ts'), base);
		git(repo, 'add', '.');
		git(repo, 'commit', '-qm', 'base');
		const baseSha = git(repo, 'rev-parse', 'HEAD');
		writeFileSync(join(repo, 'apps/editor/tests/a.test.ts'), head);
		git(repo, 'add', '.');
		git(repo, 'commit', '-qm', 'head');
		return { repo, baseSha, headSha: git(repo, 'rev-parse', 'HEAD') };
	}

	function guardArgs(fixture: { repo: string; baseSha: string; headSha: string }) {
		return [
			'--repo-root',
			fixture.repo,
			'--base',
			fixture.baseSha,
			'--head',
			fixture.headSha
		];
	}

	it('refuses an unapproved tagged-check removal', () => {
		const fixture = fixtureRepo(
			'guard-remove',
			"it('[cap:cap.a core] works', () => {});\n",
			"it('works', () => {});\n"
		);
		const result = run(GUARDS, guardArgs(fixture));
		expect(result.status).toBe(1);
		expect(result.stderr).toContain('removed or downgraded tagged check: [cap:cap.a core]');
	});

	it('allows a removal the owner labelled', () => {
		const fixture = fixtureRepo(
			'guard-approved',
			"it('[cap:cap.a core] works', () => {});\n",
			"it('works', () => {});\n"
		);
		const result = run(GUARDS, [...guardArgs(fixture), '--labels', 'owner-approved-guard-change']);
		expect(result.status).toBe(0);
	});

	it('refuses retagging core to edge', () => {
		const fixture = fixtureRepo(
			'guard-downgrade',
			"it('[cap:cap.a core] works', () => {});\n",
			"it('[cap:cap.a edge] works', () => {});\n"
		);
		const result = run(GUARDS, guardArgs(fixture));
		expect(result.status).toBe(1);
		expect(result.stderr).toContain('[cap:cap.a core] 1 -> 0');
	});

	it('refuses dropping blocks-core or closing it without a linked fix', () => {
		const markerFile = join(TEMP, 'empty-markers.json');
		writeFileSync(markerFile, '[]\n');
		const baseIssues = join(TEMP, 'base-issues.json');
		const dropped = join(TEMP, 'head-issues-dropped.json');
		const closed = join(TEMP, 'head-issues-closed.json');
		writeFileSync(
			baseIssues,
			JSON.stringify([{ number: 7, labels: ['bug', 'blocks-core'], state: 'open' }])
		);
		writeFileSync(dropped, JSON.stringify([{ number: 7, labels: ['bug'], state: 'open' }]));
		writeFileSync(closed, JSON.stringify([{ number: 7, labels: ['bug', 'blocks-core'], state: 'closed' }]));
		const args = [
			'--base-markers',
			markerFile,
			'--head-markers',
			markerFile,
			'--base-issues',
			baseIssues
		];

		const labelDrop = run(GUARDS, [...args, '--head-issues', dropped]);
		expect(labelDrop.status).toBe(1);
		expect(labelDrop.stderr).toContain('dropped blocks-core from confirmed bug #7');

		const closedWithoutFix = run(GUARDS, [...args, '--head-issues', closed]);
		expect(closedWithoutFix.status).toBe(1);
		expect(closedWithoutFix.stderr).toContain('without a linked fix');

		const approved = run(GUARDS, [
			...args,
			'--head-issues',
			dropped,
			'--labels',
			'owner-approved-guard-change'
		]);
		expect(approved.status).toBe(0);
	});
});

describe('workflow contract', () => {
	it('runs every required suite unconditionally and requires the aggregate', () => {
		const workflow = readFileSync(WORKFLOW, 'utf8');
		for (const name of REQUIRED_SUITES) expect(workflow).toContain(name);
		expect(workflow).toContain('name: merge gate');
		expect(workflow).toContain('name: check guards');
		expect(workflow).toContain('postgres:16');
		expect(workflow).toContain('produce.mjs');
		expect(workflow).toContain('aggregate.mjs');
		// A path filter would let a docs-only change skip the architecture lane.
		expect(workflow).toMatch(/\non:\n  pull_request:\n/);
		expect(workflow).not.toMatch(/\n    paths:/);
	});
});
