import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { afterEach, expect, it } from 'vitest';

const REPO_ROOT = resolve(import.meta.dirname, '../../..');
const PLAN = join(REPO_ROOT, 'tools/harness/plan.mjs');
const GATE = join(REPO_ROOT, 'tools/harness/gate.mjs');
const temp: string[] = [];

afterEach(() => {
	for (const path of temp.splice(0)) rmSync(path, { recursive: true, force: true });
});

function repo() {
	const root = mkdtempSync(join(tmpdir(), 'verification-profile-'));
	temp.push(root);
	const git = (...args: string[]) =>
		execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
	git('init', '-q');
	git('config', 'user.name', 'Profile fixture');
	git('config', 'user.email', 'profile@example.test');
	const commit = (files: Record<string, string>) => {
		for (const [path, text] of Object.entries(files)) {
			const file = join(root, path);
			mkdirSync(dirname(file), { recursive: true });
			writeFileSync(file, text);
		}
		git('add', '.');
		git('commit', '-qm', 'fixture');
		return git('rev-parse', 'HEAD');
	};
	const base = commit({ 'README.md': 'baseline' });
	const run = (script: string, options: { event?: string; baseSha?: string; jobs?: object } = {}) => {
		const head = git('rev-parse', 'HEAD');
		const baseSha = options.baseSha ?? base;
		const eventFile = join(root, '.git', 'event.json');
		writeFileSync(
			eventFile,
			JSON.stringify({
				pull_request: { base: { sha: baseSha } },
				merge_group: { base_sha: baseSha, head_sha: head }
			})
		);
		return spawnSync(process.execPath, [script], {
			cwd: root,
			encoding: 'utf8',
			env: {
				...process.env,
				GITHUB_SHA: head,
				GITHUB_EVENT_NAME: options.event ?? 'pull_request',
				EVENT_NAME: options.event ?? 'pull_request',
				GITHUB_EVENT_PATH: eventFile,
				GITHUB_OUTPUT: join(root, '.git', 'output'),
				...(options.jobs ? { CI_GATE_JOBS: JSON.stringify(options.jobs) } : {})
			}
		});
	};
	return { root, base, commit, run };
}

it.each([
	['docs/design/example.md', 'minimal'],
	['broad-research/notes.md', 'minimal'],
	['apps/editor/src/lib/design/layout.css', 'minimal'],
	['apps/editor/src/lib/authoring/Panel.svelte', 'full'],
	['apps/editor/src/lib/authoring/camera/dial.ts', 'full'],
	['apps/editor/src/lib/unknown.extension', 'full'],
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
	expect(JSON.parse(fixture.run(PLAN, { baseSha }).stdout).profile).toBe('full');
});

it('requires identical non-CSS bytes and a plain terminal Svelte style block', () => {
	const component = '<button>Close</button>\n<style>button { color: blue; }</style>\n';
	const fixture = repo();
	const path = 'apps/editor/src/lib/authoring/Panel.svelte';
	const baseSha = fixture.commit({ [path]: component });
	fixture.commit({ [path]: component.replace('blue', 'red') });
	expect(JSON.parse(fixture.run(PLAN, { baseSha }).stdout).profile).toBe('minimal');
	fixture.commit({ [path]: component.replace('Close', 'Open') });
	expect(JSON.parse(fixture.run(PLAN, { baseSha }).stdout).profile).toBe('full');
});

it('fails closed on an unavailable comparison', () => {
	const fixture = repo();
	expect(fixture.run(PLAN, { baseSha: 'b'.repeat(40) }).status).not.toBe(0);
});

it('certifies Minimal only with a successful prepare job', () => {
	const fixture = repo();
	fixture.commit({ 'docs/note.md': 'notes' });
	const jobs = {
		prepare: { result: 'success', outputs: { profile: 'minimal' } },
		lint: { result: 'skipped' },
		suite: { result: 'skipped' },
		api: { result: 'skipped' },
		goldens: { result: 'skipped' }
	};
	expect(fixture.run(GATE, { jobs }).status).toBe(0);
	expect(fixture.run(GATE, { jobs: { ...jobs, prepare: { result: 'failure' } } }).status).toBe(1);
	expect(fixture.run(GATE, { jobs: { ...jobs, lint: { result: 'success' } } }).status).toBe(0);
});

it('requires every Full job and refuses a non-Full merge group', () => {
	const fixture = repo();
	const full = {
		prepare: { result: 'success' },
		lint: { result: 'success' },
		suite: { result: 'success' },
		api: { result: 'success' },
		goldens: { result: 'success' }
	};
	expect(fixture.run(GATE, { jobs: full }).status).toBe(1);
	expect(
		fixture.run(GATE, {
			jobs: {
				...full,
				prepare: { result: 'success', outputs: { profile: 'full' } }
			}
		}).status
	).toBe(0);
	expect(
		fixture.run(GATE, {
			jobs: { ...full, prepare: { result: 'success', outputs: { profile: 'full' } }, api: { result: 'skipped' } },
			event: 'merge_group'
		}).status
	).toBe(1);
	expect(fixture.run(GATE, { jobs: full, event: 'push' }).status).toBe(1);
});
