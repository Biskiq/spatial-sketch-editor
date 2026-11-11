import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, expect, it } from 'vitest';

import { REPO_ROOT } from '../helpers/docs-references';

const PLAN = join(REPO_ROOT, 'tools/harness/plan.mjs');
const AGGREGATE = join(REPO_ROOT, 'tools/harness/aggregate.mjs');
const temp: string[] = [];

afterEach(() => {
	for (const path of temp.splice(0)) rmSync(path, { recursive: true, force: true });
});

function repo() {
	const root = mkdtempSync(join(tmpdir(), 'verification-profile-'));
	temp.push(root);
	const git = (...args: string[]) => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
	git('init', '-q');
	git('config', 'user.name', 'Profile fixture');
	git('config', 'user.email', 'profile@example.test');
	function commit(files: Record<string, string>) {
		for (const [path, text] of Object.entries(files)) {
			const file = join(root, path);
			mkdirSync(dirname(file), { recursive: true });
			writeFileSync(file, text);
		}
		git('add', '.');
		git('commit', '-qm', 'fixture');
		return git('rev-parse', 'HEAD');
	}
	const base = commit({ 'README.md': 'baseline' });
	function run(script: string, options: { event?: string; baseSha?: string; args?: string[]; jobs?: object } = {}) {
		const head = git('rev-parse', 'HEAD');
		const baseSha = options.baseSha ?? base;
		const eventFile = join(root, '.git', 'event.json');
		writeFileSync(eventFile, JSON.stringify({
			pull_request: { base: { sha: baseSha } },
			merge_group: { base_sha: baseSha, head_sha: head }
		}));
		return spawnSync(process.execPath, [script, ...(options.args ?? [])], {
			cwd: root,
			encoding: 'utf8',
			env: {
				...process.env,
				GITHUB_SHA: head,
				GITHUB_EVENT_NAME: options.event ?? 'pull_request',
				GITHUB_EVENT_PATH: eventFile,
				GITHUB_OUTPUT: join(root, '.git', 'output'),
				...(options.jobs ? { CI_GATE_JOBS: JSON.stringify(options.jobs) } : {})
			}
		});
	}
	return { root, base, commit, run };
}

it.each([
	['docs/design/example.md', 'minimal'],
	['broad-research/notes.md', 'minimal'],
	['apps/editor/src/lib/design/layout.css', 'minimal'],
	['apps/editor/src/lib/authoring/Panel.svelte', 'focused'],
	['apps/editor/src/lib/authoring/camera/dial.ts', 'focused'],
	['apps/editor/src/lib/unknown.extension', 'focused'],
	['apps/editor/src/lib/layout/new-kernel.ts', 'full'],
	['packages/geometry-core/src/core.ts', 'full'],
	['apps/editor/src/routes/p/[id]/+page.ts', 'full'],
	['apps/editor/src/lib/authoring/save/payload.ts', 'full'],
	['apps/editor/src/contract.json', 'full'],
	['apps/editor/tests/lib/changed.test.ts', 'full'],
	['.github/workflows/merge-gate.yml', 'full'],
	['tools/harness/new.extension', 'full'],
	['apps/editor/vitest.config.ts', 'full'],
	['broad-research/probe.json', 'full']
])('classifies %s as %s', (path, profile) => {
	const fixture = repo();
	fixture.commit({ [path]: 'fixture' });
	const result = fixture.run(PLAN);
	expect(result.stderr).toBe('');
	expect(JSON.parse(result.stdout).profile).toBe(profile);
});

it('keeps ordinary CSS edits Minimal when existing resource references are unchanged', () => {
	const fixture = repo();
	const path = 'apps/editor/src/lib/design/tokens.css';
	const css = '@font-face { src: url(/fonts/ui.ttf); }\n:root { --accent: blue; }\n';
	const baseSha = fixture.commit({ [path]: css });
	fixture.commit({ [path]: css.replace('blue', 'red') });
	expect(JSON.parse(fixture.run(PLAN, { baseSha }).stdout).profile).toBe('minimal');
	fixture.commit({ [path]: css.replace('/fonts/ui.ttf', '/fonts/new.ttf') });
	expect(JSON.parse(fixture.run(PLAN, { baseSha }).stdout).profile).toBe('focused');
});

it('requires identical non-CSS bytes and a plain terminal Svelte style block', () => {
	const component = '<button>Close</button>\n<style>button { color: blue; }</style>\n';
	const fixture = repo();
	const path = 'apps/editor/src/lib/authoring/Panel.svelte';
	const baseSha = fixture.commit({ [path]: component });
	fixture.commit({ [path]: component.replace('blue', 'red') });
	expect(JSON.parse(fixture.run(PLAN, { baseSha }).stdout).profile).toBe('minimal');
	fixture.commit({ [path]: component.replace('Close', 'Open') });
	expect(JSON.parse(fixture.run(PLAN, { baseSha }).stdout).profile).toBe('focused');
	fixture.commit({ [path]: component.replace('<style>', '<style lang="scss">') });
	expect(JSON.parse(fixture.run(PLAN, { baseSha }).stdout).profile).toBe('focused');
	fixture.commit({ [path]: component.replace('color: blue;', 'background: url(foo);') });
	expect(JSON.parse(fixture.run(PLAN, { baseSha }).stdout).profile).toBe('focused');
});

it('takes the highest profile across the complete queue delta, including earlier entries', () => {
	const fixture = repo();
	fixture.commit({ 'docs/note.md': 'notes', 'apps/editor/src/new.css': 'body {}' });
	expect(JSON.parse(fixture.run(PLAN, { event: 'merge_group' }).stdout).profile).toBe('minimal');
	fixture.commit({ 'apps/editor/src/lib/authoring/Panel.svelte': '<button>Close</button>' });
	expect(JSON.parse(fixture.run(PLAN, { event: 'merge_group' }).stdout).profile).toBe('focused');
	fixture.commit({ 'packages/geometry-core/src/core.ts': 'kernel' });
	fixture.commit({ 'docs/note.md': 'later entry' });
	expect(JSON.parse(fixture.run(PLAN, { event: 'merge_group' }).stdout).profile).toBe('full');
});

it('fails closed on an unavailable comparison', () => {
	const fixture = repo();
	expect(fixture.run(PLAN, { baseSha: 'b'.repeat(40) }).status).not.toBe(0);
	expect(fixture.run(AGGREGATE, { baseSha: 'b'.repeat(40), args: ['--dir', 'missing'], jobs: {} }).status).not.toBe(0);
});

it('certifies Minimal only with successful static checks and skipped test jobs', () => {
	const fixture = repo();
	fixture.commit({ 'docs/note.md': 'notes' });
	const jobs = {
		prepare: { result: 'success', outputs: { profile: 'minimal', base: fixture.base } },
		suite: { result: 'skipped' },
		api: { result: 'skipped' },
		focused: { result: 'skipped' },
		guards: { result: 'skipped' },
		goldens: { result: 'skipped' }
	};
	const args = ['--dir', 'missing', '--out', '.git/report.json'];
	expect(fixture.run(AGGREGATE, { args, jobs }).status).toBe(0);
	expect(fixture.run(AGGREGATE, { args, jobs: { ...jobs, prepare: { ...jobs.prepare, result: 'failure' } } }).status).toBe(1);
	expect(fixture.run(AGGREGATE, { args, jobs: { ...jobs, goldens: { result: 'success' } } }).status).toBe(1);
	expect(fixture.run(AGGREGATE, { args, jobs, event: 'merge_group' }).status).toBe(1);
});

it('rejects missing, mismatched or failed focused evidence', () => {
	const fixture = repo();
	const head = fixture.commit({ 'apps/editor/src/lib/authoring/camera/dial.ts': 'fixture' });
	const plan = JSON.parse(fixture.run(PLAN).stdout);
	const focusedModule = pathToFileURL(join(REPO_ROOT, 'tools/harness/focused.mjs')).href;
	const files: string[] = JSON.parse(execFileSync(process.execPath, [
		'--input-type=module', '--eval',
		'import { focusedFiles } from ' + JSON.stringify(focusedModule) + '; ' +
		'console.log(JSON.stringify(focusedFiles(JSON.parse(process.argv[1]))))',
		JSON.stringify(plan)
	], { cwd: fixture.root, encoding: 'utf8' }));
	const jobs = {
		prepare: { result: 'success', outputs: { profile: 'focused', base: fixture.base } },
		suite: { result: 'skipped' },
		api: { result: 'skipped' },
		focused: { result: 'success' },
		guards: { result: 'skipped' },
		goldens: { result: 'skipped' }
	};
	const args = ['--dir', 'artifacts', '--out', '.git/report.json'];
	const aggregate = () => fixture.run(AGGREGATE, { args, jobs });
	expect(aggregate().status).toBe(1);
	mkdirSync(join(fixture.root, 'artifacts'));
	const provenance = { commit: head, status: 'complete', exitCode: 0 };
	writeFileSync(join(fixture.root, 'artifacts/check.json'), JSON.stringify({
		...provenance, suite: 'npm run check', command: 'npm run check'
	}));
	const selected = {
		...provenance,
		suite: 'editor focused tests',
		command: `npx vitest run ${files.join(' ')} --reporter=json --outputFile=artifacts/editor-focused.vitest.json`,
		results: {
			success: true,
			testResults: files.map((name: string) => ({
				name: `/checkout/apps/editor/${name}`,
				assertionResults: [{ status: 'passed', fullName: 'works' }]
			}))
		}
	};
	const write = (entry: object) => writeFileSync(join(fixture.root, 'artifacts/editor-focused.json'), JSON.stringify(entry));
	write(selected);
	expect(aggregate().stderr).toBe('');
	write({ ...selected, results: { ...selected.results, testResults: selected.results.testResults.slice(1) } });
	expect(aggregate().status).toBe(1);
	write({ ...selected, exitCode: 1, status: 'failed' });
	expect(aggregate().status).toBe(1);
});
