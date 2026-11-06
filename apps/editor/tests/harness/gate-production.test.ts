/**
 * Merge-gate production, not just the report rulebook.
 *
 * The gate is only real if a failing suite's provenance reaches the aggregate,
 * if missing or unreadable evidence cannot be certified, if the tagged-check
 * gate rules apply in the certifying path, and if the hard guards refuse an
 * unapproved check removal or blocking-bug change. These cases drive the shipped
 * CLIs on fixture provenance, a temporary git repository and real GitHub event
 * payloads.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';

import { REPO_ROOT } from '../helpers/docs-references';

const PRODUCE = join(REPO_ROOT, 'tools/harness/produce.mjs');
const AGGREGATE = join(REPO_ROOT, 'tools/harness/aggregate.mjs');
const MATRIX = join(REPO_ROOT, 'tools/harness/matrix.mjs');
const GUARDS = join(REPO_ROOT, 'tools/harness/guards.mjs');
const LINKED_FIXES = join(REPO_ROOT, 'tools/harness/linked-fixes.mjs');
const ISSUE_RESPONSE = join(REPO_ROOT, 'tools/harness/issue-response.mjs');
const STATUS = join(REPO_ROOT, 'tools/harness/status.mjs');
const MERGE_GATE = join(REPO_ROOT, '.github/workflows/merge-gate.yml');
const ISSUE_GUARDS = join(REPO_ROOT, '.github/workflows/issue-guards.yml');
const GOLDENS = join(REPO_ROOT, '.github/workflows/native-form-goldens.yml');
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

/** The production command prefix each suite's provenance must match. */
const COMMANDS: Record<string, string> = {
	'npm test': 'npx vitest run',
	'npm run test:arch': 'npx vitest run --config vitest.arch.config.ts',
	'npm run test:heavy': 'npx vitest run --config vitest.heavy.config.ts',
	'npm run test:api': 'npm run test:api',
	'npm run check': 'npm run check',
	'npm run build': 'npm run build',
	'npm run check:api': 'npm run check:api',
	'npm run check:camera-core': 'npm run check:camera-core',
	'npm run check:layout-core': 'npm run check:layout-core',
	'npm run check:geometry-core': 'npm run check:geometry-core',
	'npm run check:project-model': 'npm run check:project-model'
};

afterAll(() => rmSync(TEMP, { recursive: true, force: true }));

let counter = 0;
function tempDir(name: string) {
	counter += 1;
	return join(TEMP, `${counter}-${name}`);
}

function run(script: string, args: string[], cwd = REPO_ROOT, env: Record<string, string> = {}) {
	return spawnSync(process.execPath, [script, ...args], {
		cwd,
		encoding: 'utf8',
		env: { ...process.env, ...env }
	});
}

function provenance(name: string, overrides: Record<string, unknown> = {}) {
	return {
		suite: name,
		command: COMMANDS[name],
		commit: COMMIT,
		exitCode: 0,
		status: 'complete',
		override: false,
		error: null,
		signal: null,
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

function statusRun() {
	return {
		commit: COMMIT,
		generatedAt: '2026-11-06T10:00:00.000Z',
		suites: REQUIRED_SUITES.map((name) => {
			const entry = provenance(name);
			return entry.results
				? { name, status: 'complete', results: entry.results }
				: { name, status: 'complete', exitCode: 0 };
		})
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

function fullRun(overrides: (name: string) => Record<string, unknown> = () => ({})) {
	return REQUIRED_SUITES.map((name) => provenance(name, overrides(name)));
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
			status: 'failed',
			override: true
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
		expect(record.override).toBe(true);
		expect(record.results.numTotalTests).toBe(1);
	});
});

describe('gate aggregation', () => {
	it('certifies a complete run of every required suite', () => {
		const dir = tempDir('aggregate-complete');
		writeProvenance(dir, fullRun());
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
			fullRun().filter((entry) => entry.suite !== 'npm run build')
		);
		const result = aggregate(dir, join(TEMP, 'missing-report.json'));
		expect(result.status).toBe(1);
		expect(result.stderr).toContain('npm run build is missing');
	});

	it('refuses a failed suite even when the rest are complete', () => {
		const dir = tempDir('aggregate-failed');
		writeProvenance(
			dir,
			fullRun((name) =>
				name === 'npm run build' ? { status: 'failed', exitCode: 2 } : {}
			)
		);
		expect(aggregate(dir, join(TEMP, 'failed-report.json')).status).toBe(1);
	});

	it('refuses a runtime failure that the reporter flattened', () => {
		const dir = tempDir('aggregate-runtime');
		writeProvenance(
			dir,
			fullRun((name) =>
				name === 'npm test'
					? {
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
						}
					: {}
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
			fullRun((name) =>
				name === TAP_SUITE
					? { results: { tests: 4, passed: 3, failed: 0, skipped: 1 } }
					: {}
			)
		);
		const result = aggregate(dir, join(TEMP, 'skips-report.json'));
		expect(result.status).toBe(1);
		expect(result.stderr).toContain('requires zero skips');
	});

	it('refuses a stale known-failing marker that the runner accepted', () => {
		const dir = tempDir('aggregate-stale');
		const source = join(dir, 'plain.test.ts');
		mkdirSync(dir, { recursive: true });
		writeFileSync(source, "it('[cap:cap.a core known-failing:#42] works', () => {});\n");
		writeProvenance(
			dir,
			fullRun((name) =>
				name === 'npm test'
					? {
							results: {
								numTotalTests: 1,
								testResults: [
									{
										name: source,
										assertionResults: [
											{
												fullName: '[cap:cap.a core known-failing:#42] works',
												title: '[cap:cap.a core known-failing:#42] works',
												status: 'passed'
											}
										]
									}
								]
							}
						}
					: {}
			)
		);
		const result = aggregate(dir, join(TEMP, 'stale-report.json'));
		expect(result.status).toBe(1);
		expect(result.stderr).toContain('no longer reproduces');
	});

	it('refuses a skipped tagged check', () => {
		const dir = tempDir('aggregate-tagged-skip');
		writeProvenance(
			dir,
			fullRun((name) =>
				name === 'npm test'
					? {
							results: {
								numTotalTests: 1,
								testResults: [
									{
										name: 'skipped.test.ts',
										assertionResults: [
											{
												fullName: '[cap:cap.b core] skipped check',
												title: '[cap:cap.b core] skipped check',
												status: 'skipped'
											}
										]
									}
								]
							}
						}
					: {}
			)
		);
		const result = aggregate(dir, join(TEMP, 'tagged-skip-report.json'));
		expect(result.status).toBe(1);
		expect(result.stderr).toContain('skipped');
	});

	it('refuses an unverified known-failing marker', () => {
		const dir = tempDir('aggregate-unverified');
		writeProvenance(
			dir,
			fullRun((name) =>
				name === 'npm test'
					? {
							results: {
								numTotalTests: 1,
								testResults: [
									{
										name: join(dir, 'missing-source.test.ts'),
										assertionResults: [
											{
												fullName: '[cap:cap.c core known-failing:#7] still fails',
												title: '[cap:cap.c core known-failing:#7] still fails',
												status: 'passed'
											}
										]
									}
								]
							}
						}
					: {}
			)
		);
		const result = aggregate(dir, join(TEMP, 'unverified-report.json'));
		expect(result.status).toBe(1);
		expect(result.stderr).toContain('not backed by it.fails');
	});

	it('certifies a valid it.fails reproducer while still leaving health failing', () => {
		const dir = tempDir('aggregate-reproducer');
		const source = join(dir, 'reproducer.test.ts');
		mkdirSync(dir, { recursive: true });
		writeFileSync(
			source,
			"it.fails('[cap:cap.c core known-failing:#7] still fails', () => { expect(1).toBe(2); });\n"
		);
		writeProvenance(
			dir,
			fullRun((name) =>
				name === 'npm test'
					? {
							results: {
								numTotalTests: 1,
								testResults: [
									{
										name: source,
										assertionResults: [
											{
												fullName: '[cap:cap.c core known-failing:#7] still fails',
												title: '[cap:cap.c core known-failing:#7] still fails',
												status: 'passed'
											}
										]
									}
								]
							}
						}
					: {}
			)
		);
		expect(aggregate(dir, join(TEMP, 'reproducer-report.json')).status).toBe(0);
	});

	it('refuses a record with no tested commit', () => {
		const dir = tempDir('aggregate-null-commit');
		writeProvenance(dir, fullRun((name) => (name === 'npm test' ? { commit: null } : {})));
		const result = aggregate(dir, join(TEMP, 'null-commit-report.json'));
		expect(result.status).toBe(1);
		expect(result.stderr).toContain('no tested commit');
	});

	it('refuses a record whose producer reported an error', () => {
		const dir = tempDir('aggregate-producer-error');
		writeProvenance(
			dir,
			fullRun((name) =>
				name === 'npm test' ? { error: 'runner evidence missing' } : {}
			)
		);
		const result = aggregate(dir, join(TEMP, 'producer-error-report.json'));
		expect(result.status).toBe(1);
		expect(result.stderr).toContain('runner evidence missing');
	});

	it('refuses a test-only command override or a command outside the contract', () => {
		const overrideDir = tempDir('aggregate-override');
		writeProvenance(overrideDir, fullRun((name) => (name === 'npm test' ? { override: true } : {})));
		expect(aggregate(overrideDir, join(TEMP, 'override-report.json')).status).toBe(1);

		const commandDir = tempDir('aggregate-command');
		writeProvenance(
			commandDir,
			fullRun((name) => (name === 'npm test' ? { command: 'npm run something-else' } : {}))
		);
		const result = aggregate(commandDir, join(TEMP, 'command-report.json'));
		expect(result.status).toBe(1);
		expect(result.stderr).toContain('does not match the suite contract');
	});
});

describe('hard guards', () => {
	function git(repo: string, ...args: string[]) {
		return execFileSync('git', args, { cwd: repo, encoding: 'utf8' }).trim();
	}

	function fixtureRepo(
		name: string,
		base: string,
		head: string,
		file = 'apps/editor/tests/a.test.ts'
	) {
		const repo = tempDir(name);
		mkdirSync(join(repo, 'apps/editor/tests'), { recursive: true });
		git(repo, 'init', '-q');
		git(repo, 'config', 'user.email', 'fixture@example.com');
		git(repo, 'config', 'user.name', 'Fixture');
		writeFileSync(join(repo, file), base);
		git(repo, 'add', '.');
		git(repo, 'commit', '-qm', 'base');
		const baseSha = git(repo, 'rev-parse', 'HEAD');
		writeFileSync(join(repo, file), head);
		git(repo, 'add', '.');
		git(repo, 'commit', '-q', '--allow-empty', '-m', 'head');
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

	it('refuses a removal when the whole declaration is commented out', () => {
		const fixture = fixtureRepo(
			'guard-commented-call',
			"it('[cap:cap.a core] proves critical path', () => {});\n",
			"// it('[cap:cap.a core] proves critical path', () => {});\n"
		);
		const result = run(GUARDS, guardArgs(fixture));
		expect(result.status).toBe(1);
		expect(result.stderr).toContain('removed tagged check');
	});

	it('refuses removing an it.fails reproducer', () => {
		const fixture = fixtureRepo(
			'guard-fails-removal',
			"it.fails('[cap:cap.a core known-failing:#42] critical', () => {});\n",
			'// removed\n'
		);
		const result = run(GUARDS, guardArgs(fixture));
		expect(result.status).toBe(1);
		expect(result.stderr).toContain('removed tagged check');
	});

	it('refuses removing an unsupported tagged declaration', () => {
		const unsupported = "it.each([1])('[cap:cap.a core] case', () => {});\n";
		const removed = fixtureRepo('guard-each-removal', unsupported, '// removed\n');
		expect(run(GUARDS, guardArgs(removed)).status).toBe(1);
		const unchanged = fixtureRepo('guard-each-unchanged', unsupported, unsupported);
		expect(run(GUARDS, guardArgs(unchanged)).status).toBe(0);
	});

	it('guards tagged declarations in spec files too', () => {
		const fixture = fixtureRepo(
			'guard-spec',
			"it('[cap:cap.a core] spec works', () => {});\n",
			'// removed\n',
			'apps/editor/tests/a.spec.ts'
		);
		const result = run(GUARDS, guardArgs(fixture));
		expect(result.status).toBe(1);
		expect(result.stderr).toContain('removed tagged check');
	});

	it('never invents checks from fixture strings', () => {
		const source = "const sample = \"it('[cap:cap.a core] critical', () => {});\";\n";
		const fixture = fixtureRepo('guard-fixture-string', source, `${source}// moved\n`);
		expect(run(GUARDS, guardArgs(fixture)).status).toBe(0);
	});

	it('refuses replacing a check with a different same-capability test', () => {
		const fixture = fixtureRepo(
			'guard-replacement',
			"it('[cap:cap.a core] first check', () => {});\n",
			"it('[cap:cap.a core] second check', () => {});\n"
		);
		const result = run(GUARDS, guardArgs(fixture));
		expect(result.status).toBe(1);
		expect(result.stderr).toContain('first check');
	});

	it('counts a check inherited from its describe', () => {
		const source = "describe('[cap:cap.a core] group', () => { it('works', () => {}); });\n";
		const fixture = fixtureRepo('guard-inherited', source, source);
		expect(run(GUARDS, guardArgs(fixture)).status).toBe(0);
	});

	it('refuses retagging core to edge', () => {
		const fixture = fixtureRepo(
			'guard-downgrade',
			"it('[cap:cap.a core] works', () => {});\n",
			"it('[cap:cap.a edge] works', () => {});\n"
		);
		const result = run(GUARDS, guardArgs(fixture));
		expect(result.status).toBe(1);
		expect(result.stderr).toContain('downgraded tagged check');
	});

	it('allows a change the owner labelled', () => {
		const fixture = fixtureRepo(
			'guard-approved',
			"it('[cap:cap.a core] works', () => {});\n",
			"it('works', () => {});\n"
		);
		const result = run(GUARDS, [...guardArgs(fixture), '--labels', 'owner-approved-guard-change']);
		expect(result.status).toBe(0);
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
		writeFileSync(
			closed,
			JSON.stringify([{ number: 7, labels: ['bug', 'blocks-core'], state: 'closed' }])
		);
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

	function eventFile(name: string, payload: unknown) {
		const path = join(TEMP, `${name}.json`);
		writeFileSync(path, JSON.stringify(payload));
		return path;
	}

	it('refuses dropping blocks-core on an issue event, including bug relabelling', () => {
		const blocksCore = eventFile('evt-blocks-core', {
			action: 'unlabeled',
			label: { name: 'blocks-core' },
			issue: { number: 9, labels: ['bug'], state: 'open' }
		});
		const result = run(GUARDS, ['--event-file', blocksCore]);
		expect(result.status).toBe(1);
		expect(result.stderr).toContain('dropped blocks-core');

		const bug = eventFile('evt-bug', {
			action: 'unlabeled',
			label: { name: 'bug' },
			issue: { number: 9, labels: ['blocks-core'], state: 'open' }
		});
		const relabelled = run(GUARDS, ['--event-file', bug]);
		expect(relabelled.status).toBe(1);
		expect(relabelled.stderr).toContain('still claims blocks-core');
	});

	it('requires a readable linked fix for a closed blocks-core issue', () => {
		const closed = eventFile('evt-closed', {
			action: 'closed',
			issue: { number: 9, labels: ['bug', 'blocks-core'], state: 'closed' }
		});
		const missing = run(GUARDS, ['--event-file', closed, '--linked-fixes', join(TEMP, 'nope.json')]);
		expect(missing.status).toBe(1);
		expect(missing.stderr).toContain('could not be read');

		const empty = join(TEMP, 'no-links.json');
		writeFileSync(empty, '[]\n');
		const none = run(GUARDS, ['--event-file', closed, '--linked-fixes', empty]);
		expect(none.status).toBe(1);
		expect(none.stderr).toContain('no linked fixing change');

		const linked = join(TEMP, 'linked.json');
		writeFileSync(linked, '[12]\n');
		expect(run(GUARDS, ['--event-file', closed, '--linked-fixes', linked]).status).toBe(0);
	});

	it('respects the issue owner approval label', () => {
		const approved = eventFile('evt-approved', {
			action: 'closed',
			issue: {
				number: 9,
				labels: ['bug', 'blocks-core', 'owner-approved-guard-change'],
				state: 'closed'
			}
		});
		expect(run(GUARDS, ['--event-file', approved]).status).toBe(0);
	});
});

describe('blocking-bug event response', () => {
	/** A fake `gh` over a JSON state file: REST issue reads/writes plus GraphQL. */
	const FAKE_GH = [
		'#!/usr/bin/env node',
		"import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';",
		'const statePath = process.env.FAKE_STATE;',
		'const logPath = process.env.FAKE_LOG;',
		'const args = process.argv.slice(2);',
		"if (logPath) appendFileSync(logPath, args.join(' ') + '\\n');",
		"const state = JSON.parse(readFileSync(statePath, 'utf8'));",
		'state.reads = state.reads || 0;',
		'const save = () => writeFileSync(statePath, JSON.stringify(state));',
		'const issue = () => ({ number: 7, state: state.state, labels: state.labels.map((name) => ({ name })) });',
		"const graphql = args[0] === 'api' && args[1] === 'graphql';",
		"const path = args[1] || '';",
		"const labelPost = path.endsWith('/labels') && args.includes('-f');",
		"const patch = path.includes('/issues/') && args.includes('PATCH');",
		"const get = path.includes('/issues/') && !labelPost && !patch && !graphql;",
		"const fail = process.env.FAKE_FAIL || '';",
		'if (graphql) {',
		"  if (fail === 'graphql') { console.error('graphql 502'); process.exit(1); }",
		'  const fixture = process.env.FAKE_GRAPHQL;',
		"  if (!fixture || !existsSync(fixture)) { console.error('graphql unavailable'); process.exit(1); }",
		"  process.stdout.write(readFileSync(fixture, 'utf8'));",
		'  process.exit(0);',
		'}',
		"if (fail === 'all-writes' && (labelPost || patch)) { console.error('write 403'); process.exit(1); }",
		'if (labelPost) {',
		"  const index = args.indexOf('-f');",
		"  const label = String(args[index + 1]).slice('labels[]='.length);",
		'  if (!state.labels.includes(label)) state.labels.push(label);',
		'  save();',
		'  console.log(JSON.stringify(issue()));',
		'  process.exit(0);',
		'}',
		"if (patch) { state.state = 'open'; save(); console.log(JSON.stringify(issue())); process.exit(0); }",
		'if (get) {',
		'  state.reads += 1;',
		'  save();',
		"  const approveOn = Number(process.env.FAKE_APPROVE_ON_READ || 0);",
		"  if (approveOn && state.reads >= approveOn && !state.labels.includes('owner-approved-guard-change')) { state.labels.push('owner-approved-guard-change'); save(); }",
		"  if (fail === 'readback' && state.reads >= 4) { console.error('readback 500'); process.exit(1); }",
		'  console.log(JSON.stringify(issue()));',
		'  process.exit(0);',
		'}',
		"console.log('{}');",
		''
	].join('\n');

	function fakeGh(dir: string) {
		const statePath = join(dir, 'state.json');
		const script = join(dir, 'fake-gh.mjs');
		writeFileSync(script, FAKE_GH);
		chmodSync(script, 0o755);
		return { statePath, script };
	}

	function stateOf(path: string) {
		return JSON.parse(readFileSync(path, 'utf8'));
	}

	function eventFile(dir: string, payload: unknown) {
		const path = join(dir, 'event.json');
		writeFileSync(path, JSON.stringify(payload));
		return path;
	}

	function responseArgs(dir: string, eventPath: string, script: string, linked?: string) {
		return [
			'--event-file',
			eventPath,
			...(linked ? ['--linked-fixes', linked] : []),
			'--out',
			join(dir, 'result.json'),
			'--gh',
			script,
			'--repo',
			'o/r'
		];
	}

	function calls(dir: string) {
		const path = join(dir, 'calls.log');
		return () => (existsSync(path) ? readFileSync(path, 'utf8').trim().split('\n') : []);
	}

	/** GraphQL closure fixture: ClosedEvent nodes as GitHub returns them. */
	function closure(dir: string, nodes: unknown[], issueState = 'CLOSED') {
		const path = join(dir, 'graphql.json');
		writeFileSync(
			path,
			JSON.stringify({
				data: {
					repository: { issue: { state: issueState, timelineItems: { nodes } } }
				}
			})
		);
		return path;
	}

	function resolveFixes(
		dir: string,
		script: string,
		statePath: string,
		graphqlFixture: string,
		env: Record<string, string> = {}
	) {
		const linked = join(dir, 'linked.json');
		const result = run(
			LINKED_FIXES,
			['--issue', '7', '--repo', 'o/r', '--out', linked, '--gh', script],
			REPO_ROOT,
			{ FAKE_STATE: statePath, FAKE_GRAPHQL: graphqlFixture, ...env }
		);
		return { result, linked, payload: JSON.parse(readFileSync(linked, 'utf8')) };
	}

	it('restores an unauthorized blocks-core removal and health stays broken', () => {
		const dir = tempDir('issue-response-remove');
		mkdirSync(dir, { recursive: true });
		const { statePath, script } = fakeGh(dir);
		// GitHub has already applied the removal when the workflow starts.
		writeFileSync(statePath, JSON.stringify({ state: 'open', labels: ['bug', 'cap:cap.x'] }));
		const eventPath = eventFile(dir, {
			action: 'unlabeled',
			label: { name: 'blocks-core' },
			issue: { number: 7, labels: ['bug', 'cap:cap.x'], state: 'open' },
			repository: { full_name: 'o/r' }
		});
		const logPath = join(dir, 'calls.log');
		const result = run(ISSUE_RESPONSE, responseArgs(dir, eventPath, script), REPO_ROOT, {
			FAKE_STATE: statePath,
			FAKE_LOG: logPath
		});
		expect(result.status).toBe(1);
		const record = JSON.parse(readFileSync(join(dir, 'result.json'), 'utf8'));
		expect(record.restored).toBe(true);
		expect(record.superseded).toBe(null);
		expect(stateOf(statePath).labels).toContain('blocks-core');

		// Every write follows a live read.
		const logged = calls(dir)();
		const firstRead = logged.findIndex(
			(line) => line.includes('/issues/7') && !line.includes('/labels') && !line.includes('PATCH')
		);
		const firstWrite = logged.findIndex(
			(line) => line.includes('/labels') || line.includes('PATCH')
		);
		expect(firstRead).toBeGreaterThanOrEqual(0);
		expect(firstWrite).toBeGreaterThan(firstRead);

		// status reads the restored state: the capability stays broken.
		const ledgerPath = join(dir, 'ledger.json');
		writeFileSync(
			ledgerPath,
			JSON.stringify({
				schemaVersion: 1,
				capabilities: [
					{
						id: 'cap.x',
						area: 'T1',
						summary: 'x',
						northStar: 'north-star.md#sacred-contracts',
						surface: ['apps/editor/src/**'],
						design: null,
						review: null
					}
				]
			})
		);
		const reportPath = join(dir, 'run.json');
		writeFileSync(reportPath, JSON.stringify(statusRun()));
		const githubPath = join(dir, 'github.json');
		writeFileSync(
			githubPath,
			JSON.stringify({
				issues: [
					{
						number: 7,
						title: 'blocking',
						labels: stateOf(statePath).labels.map((name: string) => ({ name })),
						assignees: []
					}
				],
				pulls: []
			})
		);
		const status = run(STATUS, [
			'--ledger',
			ledgerPath,
			'--report',
			reportPath,
			'--github',
			githubPath,
			'--main-head',
			COMMIT,
			'--json'
		]);
		expect(status.status).toBe(0);
		const report = JSON.parse(status.stdout);
		expect(report.complete).toBe(true);
		expect(report.capabilities[0].health).toBe('broken');
	});

	it('respects owner approval already present when the queued event runs', () => {
		const dir = tempDir('issue-response-approved');
		mkdirSync(dir, { recursive: true });
		const { statePath, script } = fakeGh(dir);
		writeFileSync(
			statePath,
			JSON.stringify({ state: 'open', labels: ['bug', 'owner-approved-guard-change'] })
		);
		const eventPath = eventFile(dir, {
			action: 'unlabeled',
			label: { name: 'blocks-core' },
			issue: { number: 7, labels: ['bug'], state: 'open' },
			repository: { full_name: 'o/r' }
		});
		const result = run(ISSUE_RESPONSE, responseArgs(dir, eventPath, script), REPO_ROOT, {
			FAKE_STATE: statePath,
			FAKE_LOG: join(dir, 'calls.log')
		});
		expect(result.status).toBe(0);
		const record = JSON.parse(readFileSync(join(dir, 'result.json'), 'utf8'));
		expect(record.superseded).toBe('owner-approved');
		expect(record.restored).toBe(null);
		const logged = calls(dir)();
		expect(logged.some((line) => line.includes('/labels') || line.includes('PATCH'))).toBe(false);
	});

	it('respects owner approval that arrives between the guard reads', () => {
		const dir = tempDir('issue-response-approved-late');
		mkdirSync(dir, { recursive: true });
		const { statePath, script } = fakeGh(dir);
		writeFileSync(statePath, JSON.stringify({ state: 'open', labels: ['bug'] }));
		const eventPath = eventFile(dir, {
			action: 'unlabeled',
			label: { name: 'blocks-core' },
			issue: { number: 7, labels: ['bug'], state: 'open' },
			repository: { full_name: 'o/r' }
		});
		const result = run(ISSUE_RESPONSE, responseArgs(dir, eventPath, script), REPO_ROOT, {
			FAKE_STATE: statePath,
			FAKE_LOG: join(dir, 'calls.log'),
			FAKE_APPROVE_ON_READ: '2'
		});
		expect(result.status).toBe(0);
		const record = JSON.parse(readFileSync(join(dir, 'result.json'), 'utf8'));
		expect(record.superseded).toBe('owner-approved');
		const logged = calls(dir)();
		expect(logged.filter((line) => line.includes('/issues/7') && !line.includes('/labels'))).toHaveLength(2);
		expect(logged.some((line) => line.includes('/labels') || line.includes('PATCH'))).toBe(false);
	});

	it('accepts a closure whose closer is a merged fixing PR', () => {
		const dir = tempDir('issue-response-fixing-pr');
		mkdirSync(dir, { recursive: true });
		const { statePath, script } = fakeGh(dir);
		writeFileSync(statePath, JSON.stringify({ state: 'closed', labels: ['blocks-core', 'bug'] }));
		const graphqlFixture = closure(dir, [
			{
				createdAt: '2026-11-06T00:00:00Z',
				closer: { __typename: 'PullRequest', number: 13, mergedAt: '2026-11-06T01:00:00Z' }
			}
		]);
		const { linked, payload } = resolveFixes(dir, script, statePath, graphqlFixture);
		expect(payload.pullRequests).toHaveLength(1);
		expect(payload.commits).toHaveLength(0);

		const eventPath = eventFile(dir, {
			action: 'closed',
			issue: { number: 7, labels: ['blocks-core', 'bug'], state: 'closed' },
			repository: { full_name: 'o/r' }
		});
		const result = run(ISSUE_RESPONSE, responseArgs(dir, eventPath, script, linked), REPO_ROOT, {
			FAKE_STATE: statePath,
			FAKE_LOG: join(dir, 'calls.log')
		});
		expect(result.status).toBe(0);
		const record = JSON.parse(readFileSync(join(dir, 'result.json'), 'utf8'));
		expect(record.superseded).toBe('fixing-closure');
		expect(stateOf(statePath).state).toBe('closed');
		expect(calls(dir)().some((line) => line.includes('PATCH'))).toBe(false);
	});

	it('accepts a closure whose closer is a fixing commit', () => {
		const dir = tempDir('issue-response-fixing-commit');
		mkdirSync(dir, { recursive: true });
		const { statePath, script } = fakeGh(dir);
		writeFileSync(statePath, JSON.stringify({ state: 'closed', labels: ['blocks-core'] }));
		const graphqlFixture = closure(dir, [
			{ createdAt: '2026-11-06T00:00:00Z', closer: { __typename: 'Commit', oid: 'deadbeef' } }
		]);
		const { linked, payload } = resolveFixes(dir, script, statePath, graphqlFixture);
		expect(payload.commits).toEqual(['deadbeef']);

		const eventPath = eventFile(dir, {
			action: 'closed',
			issue: { number: 7, labels: ['blocks-core'], state: 'closed' },
			repository: { full_name: 'o/r' }
		});
		expect(
			run(ISSUE_RESPONSE, responseArgs(dir, eventPath, script, linked), REPO_ROOT, {
				FAKE_STATE: statePath
			}).status
		).toBe(0);
		expect(stateOf(statePath).state).toBe('closed');
	});

	it('rejects a merged unrelated mention of the issue', () => {
		const dir = tempDir('issue-response-unrelated-mention');
		mkdirSync(dir, { recursive: true });
		const { statePath, script } = fakeGh(dir);
		writeFileSync(statePath, JSON.stringify({ state: 'closed', labels: ['blocks-core', 'bug'] }));
		// A merged PR mentioned the issue, but this closure has no closer.
		const graphqlFixture = closure(dir, [{ createdAt: '2026-11-06T00:00:00Z', closer: null }]);
		const { linked, payload } = resolveFixes(dir, script, statePath, graphqlFixture);
		expect(payload).toEqual({ pullRequests: [], commits: [], closedAt: '2026-11-06T00:00:00Z' });

		const eventPath = eventFile(dir, {
			action: 'closed',
			issue: { number: 7, labels: ['blocks-core', 'bug'], state: 'closed' },
			repository: { full_name: 'o/r' }
		});
		const result = run(ISSUE_RESPONSE, responseArgs(dir, eventPath, script, linked), REPO_ROOT, {
			FAKE_STATE: statePath
		});
		expect(result.status).toBe(1);
		expect(stateOf(statePath).state).toBe('open');
		const record = JSON.parse(readFileSync(join(dir, 'result.json'), 'utf8'));
		expect(record.violations[0].reason).toContain('no linked fixing change');
	});

	it('does not let an earlier fix certify a later manual close', () => {
		const dir = tempDir('issue-response-old-fix');
		mkdirSync(dir, { recursive: true });
		const { statePath, script } = fakeGh(dir);
		writeFileSync(statePath, JSON.stringify({ state: 'closed', labels: ['blocks-core'] }));
		const graphqlFixture = closure(dir, [
			{ createdAt: '2026-01-01T00:00:00Z', closer: { __typename: 'PullRequest', number: 9, mergedAt: '2026-01-01T00:00:00Z' } },
			{ createdAt: '2026-02-01T00:00:00Z', closer: null }
		]);
		const { linked, payload } = resolveFixes(dir, script, statePath, graphqlFixture);
		expect(payload).toEqual({ pullRequests: [], commits: [], closedAt: '2026-02-01T00:00:00Z' });

		const eventPath = eventFile(dir, {
			action: 'closed',
			issue: { number: 7, labels: ['blocks-core'], state: 'closed' },
			repository: { full_name: 'o/r' }
		});
		expect(
			run(ISSUE_RESPONSE, responseArgs(dir, eventPath, script, linked), REPO_ROOT, {
				FAKE_STATE: statePath
			}).status
		).toBe(1);
		expect(stateOf(statePath).state).toBe('open');
	});

	it('treats a failed closure read as unreadable and still restores', () => {
		const dir = tempDir('issue-response-failed-read');
		mkdirSync(dir, { recursive: true });
		const { statePath, script } = fakeGh(dir);
		writeFileSync(statePath, JSON.stringify({ state: 'closed', labels: ['blocks-core', 'bug'] }));
		const graphqlFixture = closure(dir, []);
		const { linked, payload } = resolveFixes(dir, script, statePath, graphqlFixture, {
			FAKE_FAIL: 'graphql'
		});
		expect(payload.unreadable).toBe(true);

		const eventPath = eventFile(dir, {
			action: 'closed',
			issue: { number: 7, labels: ['blocks-core', 'bug'], state: 'closed' },
			repository: { full_name: 'o/r' }
		});
		const result = run(ISSUE_RESPONSE, responseArgs(dir, eventPath, script, linked), REPO_ROOT, {
			FAKE_STATE: statePath
		});
		expect(result.status).toBe(1);
		expect(stateOf(statePath).state).toBe('open');
		const record = JSON.parse(readFileSync(join(dir, 'result.json'), 'utf8'));
		expect(record.fixEvidence).toBe('unreadable');
		expect(record.violations[0].reason).toContain('could not be read');
		expect(record.restored).toBe(true);
	});

	it('treats an unreadable closure payload as unknown, never as fixed', () => {
		const dir = tempDir('issue-response-unreadable');
		mkdirSync(dir, { recursive: true });
		const { statePath, script } = fakeGh(dir);
		writeFileSync(statePath, JSON.stringify({ state: 'closed', labels: ['blocks-core'] }));
		const broken = join(dir, 'broken.json');
		writeFileSync(broken, 'not json');
		const { linked, payload } = resolveFixes(dir, script, statePath, broken);
		expect(payload.unreadable).toBe(true);
		expect(linked.length).toBeGreaterThan(0);
	});

	it('leaves an already-restored issue untouched on duplicate delivery', () => {
		const dir = tempDir('issue-response-duplicate');
		mkdirSync(dir, { recursive: true });
		const { statePath, script } = fakeGh(dir);
		writeFileSync(statePath, JSON.stringify({ state: 'open', labels: ['blocks-core', 'bug'] }));
		const eventPath = eventFile(dir, {
			action: 'unlabeled',
			label: { name: 'blocks-core' },
			issue: { number: 7, labels: ['bug'], state: 'open' },
			repository: { full_name: 'o/r' }
		});
		const result = run(ISSUE_RESPONSE, responseArgs(dir, eventPath, script), REPO_ROOT, {
			FAKE_STATE: statePath,
			FAKE_LOG: join(dir, 'calls.log')
		});
		expect(result.status).toBe(0);
		const record = JSON.parse(readFileSync(join(dir, 'result.json'), 'utf8'));
		expect(record.superseded).toBe('already-restored');
		const logged = calls(dir)();
		expect(logged).toHaveLength(1);
		expect(logged[0]).not.toContain('/labels');
	});

	it('does not reopen an issue that a later event already reopened', () => {
		const dir = tempDir('issue-response-reopened');
		mkdirSync(dir, { recursive: true });
		const { statePath, script } = fakeGh(dir);
		writeFileSync(statePath, JSON.stringify({ state: 'open', labels: ['blocks-core', 'bug'] }));
		const eventPath = eventFile(dir, {
			action: 'closed',
			issue: { number: 7, labels: ['blocks-core', 'bug'], state: 'closed' },
			repository: { full_name: 'o/r' }
		});
		const result = run(ISSUE_RESPONSE, responseArgs(dir, eventPath, script), REPO_ROOT, {
			FAKE_STATE: statePath,
			FAKE_LOG: join(dir, 'calls.log')
		});
		expect(result.status).toBe(0);
		expect(JSON.parse(readFileSync(join(dir, 'result.json'), 'utf8')).superseded).toBe('not-closed');
		expect(calls(dir)().some((line) => line.includes('PATCH'))).toBe(false);
	});

	it('fails honestly when the restoration write fails', () => {
		const dir = tempDir('issue-response-write-fail');
		mkdirSync(dir, { recursive: true });
		const { statePath, script } = fakeGh(dir);
		writeFileSync(statePath, JSON.stringify({ state: 'open', labels: ['bug'] }));
		const eventPath = eventFile(dir, {
			action: 'unlabeled',
			label: { name: 'blocks-core' },
			issue: { number: 7, labels: ['bug'], state: 'open' },
			repository: { full_name: 'o/r' }
		});
		const result = run(ISSUE_RESPONSE, responseArgs(dir, eventPath, script), REPO_ROOT, {
			FAKE_STATE: statePath,
			FAKE_FAIL: 'all-writes'
		});
		expect(result.status).toBe(2);
		const record = JSON.parse(readFileSync(join(dir, 'result.json'), 'utf8'));
		expect(record.restored).toBe(false);
		expect(record.error).toContain('403');
		expect(stateOf(statePath).labels).not.toContain('blocks-core');
	});

	it('fails honestly when the readback cannot confirm restoration', () => {
		const dir = tempDir('issue-response-readback-fail');
		mkdirSync(dir, { recursive: true });
		const { statePath, script } = fakeGh(dir);
		writeFileSync(statePath, JSON.stringify({ state: 'open', labels: ['bug'] }));
		const eventPath = eventFile(dir, {
			action: 'unlabeled',
			label: { name: 'blocks-core' },
			issue: { number: 7, labels: ['bug'], state: 'open' },
			repository: { full_name: 'o/r' }
		});
		const result = run(ISSUE_RESPONSE, responseArgs(dir, eventPath, script), REPO_ROOT, {
			FAKE_STATE: statePath,
			FAKE_FAIL: 'readback'
		});
		expect(result.status).toBe(2);
		const record = JSON.parse(readFileSync(join(dir, 'result.json'), 'utf8'));
		expect(record.restored).toBe(false);
		expect(record.error).toContain('500');
	});
});

describe('workflow contract', () => {
	it('derives its matrix from the suite contract and runs unconditionally', () => {
		const workflow = readFileSync(MERGE_GATE, 'utf8');
		expect(workflow).toContain('matrix: ${{ fromJSON(needs.prepare.outputs.matrix) }}');
		expect(workflow).toContain('name: merge gate');
		expect(workflow).toContain('name: check guards');
		expect(workflow).toContain('postgres:16');
		expect(workflow).toMatch(/\non:\n  pull_request:\n  push:\n/);
		expect(workflow).not.toMatch(/\n    paths:/);

		const matrix = JSON.parse(run(MATRIX, []).stdout);
		const expected = REQUIRED_SUITES.filter((name) => name !== TAP_SUITE);
		expect(matrix.include.map((entry: any) => entry.suite)).toEqual(expected);
		for (const entry of matrix.include) expect(entry.slug.length).toBeGreaterThan(0);
	});

	it('makes the retained goldens check start on every pull request', () => {
		const goldens = readFileSync(GOLDENS, 'utf8');
		expect(goldens).toMatch(/\non:\n  pull_request:\n/);
		expect(goldens).not.toMatch(/\n    paths:/);
	});

	it('runs issue-event guards with write access and closure-specific evidence', () => {
		const workflow = readFileSync(ISSUE_GUARDS, 'utf8');
		expect(workflow).toContain('types: [labeled, unlabeled, closed]');
		expect(workflow).toContain('issues: write');
		expect(workflow).toContain('continue-on-error: true');
		expect(workflow).toContain('linked-fixes.mjs');
		expect(workflow).toContain('--issue');
		expect(workflow).not.toContain('--paginate');
		expect(workflow).toMatch(/name: Refuse and restore[^]*?\n\s+if: always\(\)/);
		expect(workflow).toContain('--event-file "$GITHUB_EVENT_PATH"');
		expect(workflow).toContain('issue-response.mjs');
	});
});
