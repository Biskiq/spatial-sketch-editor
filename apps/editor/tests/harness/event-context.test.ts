/**
 * Merge-gate event context against realistic queue shapes.
 *
 * A `merge_group` payload has no PR number and its `head_sha` is the synthetic
 * integration commit, not a PR head. These fixtures build the real commit shape:
 * one merge commit per queued entry, the queue tip as first parent and the
 * entry's PR head as second parent. That makes a standalone group and a
 * candidate built on an earlier PR testable without a live queue.
 *
 * The stacked case is the authorization proof: the lower PR removes a tagged
 * check and carries the owner approval, while the top PR does not. The union of
 * the batch's PR labels must authorize the removal; a top-PR-only view must not.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import {
	chmodSync,
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';

import { REPO_ROOT } from '../helpers/docs-references';

const EVENT_CONTEXT = join(REPO_ROOT, 'tools/harness/event-context.mjs');
const GUARDS = join(REPO_ROOT, 'tools/harness/guards.mjs');
const TEMP = mkdtempSync(join(tmpdir(), 'harness-event-context-'));
let counter = 0;

afterAll(() => rmSync(TEMP, { recursive: true, force: true }));

const FAKE_GH = [
	'#!/usr/bin/env node',
	"import { readFileSync } from 'node:fs';",
	'const args = process.argv.slice(2);',
	'const map = JSON.parse(readFileSync(process.env.FAKE_GH_MAP, "utf8"));',
	"if (args[0] !== 'api') { console.error('unexpected gh call: ' + args.join(' ')); process.exit(1); }",
	'const path = args[1];',
	'let match = path.match(/\\/commits\\/([0-9a-f]+)\\/pulls$/);',
	'if (match) { console.log(JSON.stringify(map[match[1]] ?? [])); process.exit(0); }',
	'match = path.match(/\\/issues\\/(\\d+)\\/labels$/);',
	'if (match) { console.log(JSON.stringify(map["labels:" + match[1]] ?? [])); process.exit(0); }',
	"console.error('unexpected gh path: ' + path);",
	'process.exit(1);',
	''
].join('\n');

const fakeGh = join(TEMP, 'fake-gh.mjs');
writeFileSync(fakeGh, FAKE_GH);
chmodSync(fakeGh, 0o755);

function git(repo: string, ...args: string[]) {
	return execFileSync(
		'git',
		['-c', 'user.name=Harness', '-c', 'user.email=harness@example.test', ...args],
		{ cwd: repo, encoding: 'utf8' }
	).trim();
}

/**
 * Base has the tagged check. PR A removes it and is the lower entry. PR B is
 * built on A and adds an unrelated file. The queue commits merge each entry in
 * order, giving the real first-parent / second-parent shape.
 */
function makeRepo() {
	counter += 1;
	const repo = join(TEMP, `repo-${counter}`);
	const tests = join(repo, 'apps/editor/tests');
	mkdirSync(tests, { recursive: true });
	git(repo, 'init', '-q');
	git(repo, 'symbolic-ref', 'HEAD', 'refs/heads/main');
	writeFileSync(
		join(tests, 'a.test.ts'),
		"it('[cap:cap.a core] works', () => {});\n"
	);
	git(repo, 'add', '-A');
	git(repo, 'commit', '-qm', 'base');
	const base = git(repo, 'rev-parse', 'HEAD');

	git(repo, 'checkout', '-q', '-b', 'pr-a', 'main');
	writeFileSync(join(tests, 'a.test.ts'), '// removed by PR A\n');
	git(repo, 'add', '-A');
	git(repo, 'commit', '-qm', 'remove the check');
	const prA = git(repo, 'rev-parse', 'HEAD');

	git(repo, 'checkout', '-q', '-b', 'queue-a', 'main');
	git(repo, 'merge', '--no-ff', '-q', '-m', 'queue A', 'pr-a');
	const queueA = git(repo, 'rev-parse', 'HEAD');

	git(repo, 'checkout', '-q', '-b', 'pr-b', 'pr-a');
	writeFileSync(join(repo, 'b.txt'), 'b\n');
	git(repo, 'add', '-A');
	git(repo, 'commit', '-qm', 'PR B');
	const prB = git(repo, 'rev-parse', 'HEAD');

	git(repo, 'checkout', '-q', '-b', 'queue-b', 'queue-a');
	git(repo, 'merge', '--no-ff', '-q', '-m', 'queue B', 'pr-b');
	const queueB = git(repo, 'rev-parse', 'HEAD');

	return { repo, base, prA, queueA, prB, queueB };
}

function mapFor(prA: string, prB: string, overrides: Record<string, unknown> = {}) {
	return {
		[prA]: [{ number: 101, state: 'open' }],
		[prB]: [{ number: 102, state: 'open' }],
		'labels:101': [
			{ name: 'bug' },
			{ name: 'owner-approved-guard-change' }
		],
		'labels:102': [{ name: 'bug' }],
		...overrides
	};
}

/** A payload with a deliberately misleading branch PR number. */
function mergeEvent({
	base,
	head,
	baseRef = 'refs/heads/main',
	defaultBranch = 'main'
}: {
	base: string;
	head: string;
	baseRef?: string;
	defaultBranch?: string;
}) {
	return {
		action: 'checks_requested',
		merge_group: {
			base_ref: baseRef,
			base_sha: base,
			head_sha: head,
			head_ref: `refs/heads/gh-readonly-queue/main/pr-999-${'0'.repeat(40)}`
		},
		repository: { full_name: 'o/r', default_branch: defaultBranch }
	};
}

function runContext({
	repo,
	event,
	map
}: {
	repo: string;
	event: unknown;
	map: Record<string, unknown>;
}) {
	counter += 1;
	const eventPath = join(repo, `event-${counter}.json`);
	const mapPath = join(repo, `gh-map-${counter}.json`);
	const out = join(repo, `labels-${counter}.json`);
	const output = join(repo, `github-output-${counter}.txt`);
	writeFileSync(eventPath, JSON.stringify(event));
	writeFileSync(mapPath, JSON.stringify(map));
	writeFileSync(output, '');
	const result = spawnSync(
		process.execPath,
		[
			EVENT_CONTEXT,
			'--event-file',
			eventPath,
			'--repo',
			'o/r',
			'--repo-root',
			repo,
			'--labels-out',
			out,
			'--github-output',
			output,
			'--gh',
			fakeGh
		],
		{
			cwd: REPO_ROOT,
			encoding: 'utf8',
			env: { ...process.env, FAKE_GH_MAP: mapPath }
		}
	);
	return { result, out, output };
}

function labelsOf(path: string): string[] {
	return JSON.parse(readFileSync(path, 'utf8'));
}

describe('pull-request event context', () => {
	it('keeps the PR base branch and labels', () => {
		const { repo, queueB } = makeRepo();
		git(repo, 'checkout', '-q', queueB);
		const { result, out, output } = runContext({
			repo,
			event: { pull_request: { number: 101, base: { ref: 'release/x' } } },
			map: mapFor('a'.repeat(40), 'b'.repeat(40))
		});
		expect(result.status).toBe(0);
		expect(labelsOf(out)).toEqual(['bug', 'owner-approved-guard-change']);
		expect(readFileSync(output, 'utf8')).toContain('base_branch=release/x');
	});
});

describe('merge-group event context', () => {
	it('resolves a standalone queued PR from the synthetic commit', () => {
		const { repo, base, queueA, prA, prB } = makeRepo();
		git(repo, 'checkout', '-q', queueA);
		const { result, out, output } = runContext({
			repo,
			event: mergeEvent({ base, head: queueA }),
			map: mapFor(prA, prB)
		});
		expect(result.status).toBe(0);
		// The branch name says pr-999; the labels come from GitHub's association
		// for the synthetic commit's second parent.
		expect(labelsOf(out)).toEqual(['bug', 'owner-approved-guard-change']);
		expect(readFileSync(output, 'utf8')).toContain('base_branch=main');
	});

	it('unions labels across a queue candidate built on an earlier PR', () => {
		const { repo, base, queueB, prA, prB } = makeRepo();
		git(repo, 'checkout', '-q', queueB);
		const { result, out } = runContext({
			repo,
			event: mergeEvent({ base, head: queueB }),
			map: mapFor(prA, prB)
		});
		expect(result.status).toBe(0);
		// PR B is the top entry and has no approval. PR A is the lower entry and
		// does; the batch must see both.
		expect(labelsOf(out)).toEqual(['bug', 'owner-approved-guard-change']);
	});

	it('authorizes a lower entry removal through the batch, not the top PR alone', () => {
		const { repo, base, queueB, prA, prB } = makeRepo();
		git(repo, 'checkout', '-q', queueB);
		const { out } = runContext({
			repo,
			event: mergeEvent({ base, head: queueB }),
			map: mapFor(prA, prB)
		});

		const authorized = spawnSync(
			process.execPath,
			[
				GUARDS,
				'--repo-root',
				repo,
				'--base',
				base,
				'--head',
				queueB,
				'--labels-file',
				out
			],
			{ encoding: 'utf8' }
		);
		expect(authorized.status).toBe(0);

		const topOnly = spawnSync(
			process.execPath,
			[GUARDS, '--repo-root', repo, '--base', base, '--head', queueB, '--labels', 'bug'],
			{ encoding: 'utf8' }
		);
		expect(topOnly.status).toBe(1);
		expect(topOnly.stderr).toContain('removed tagged check');
	});

	it('fails closed when a queued head has no open PR', () => {
		const { repo, base, queueA, prA, prB } = makeRepo();
		git(repo, 'checkout', '-q', queueA);
		const { result, out } = runContext({
			repo,
			event: mergeEvent({ base, head: queueA }),
			map: mapFor(prA, prB, { [prA]: [{ number: 101, state: 'closed' }] })
		});
		expect(result.status).toBe(1);
		expect(result.stderr).toContain('matches no open pull request');
		expect(existsSync(out)).toBe(false);
	});

	it('fails closed when an entry is not a two-parent merge', () => {
		const { repo, base } = makeRepo();
		git(repo, 'checkout', '-q', '-b', 'linear', 'main');
		writeFileSync(join(repo, 'linear.txt'), 'linear\n');
		git(repo, 'add', '-A');
		git(repo, 'commit', '-qm', 'linear');
		const linear = git(repo, 'rev-parse', 'HEAD');
		git(repo, 'checkout', '-q', linear);

		const { result } = runContext({
			repo,
			event: mergeEvent({ base, head: linear }),
			map: {}
		});
		expect(result.status).toBe(1);
		expect(result.stderr).toContain('is not a two-parent merge');
	});

	it('fails closed when the checkout is not the event head', () => {
		const { repo, base, queueA, queueB } = makeRepo();
		git(repo, 'checkout', '-q', queueA);
		const { result } = runContext({
			repo,
			event: mergeEvent({ base, head: queueB }),
			map: {}
		});
		expect(result.status).toBe(1);
		expect(result.stderr).toContain('is not the merge group head');
	});

	it('fails closed when merge_group.base_ref is not the default branch', () => {
		const { repo, base, queueA } = makeRepo();
		git(repo, 'checkout', '-q', queueA);
		const { result } = runContext({
			repo,
			event: mergeEvent({ base, head: queueA, baseRef: 'refs/heads/release' }),
			map: {}
		});
		expect(result.status).toBe(1);
		expect(result.stderr).toContain('is not the repository default branch');
	});

	it('fails closed on a malformed head sha and on a non-queue event', () => {
		const { repo, base } = makeRepo();
		const malformed = runContext({
			repo,
			event: mergeEvent({ base, head: 'not-a-sha' }),
			map: {}
		});
		expect(malformed.result.status).toBe(1);
		expect(malformed.result.stderr).toContain('invalid base or head sha');

		const other = runContext({ repo, event: { push: {} }, map: {} });
		expect(other.result.status).toBe(1);
		expect(other.result.stderr).toContain('neither pull_request nor merge_group');
	});
});
