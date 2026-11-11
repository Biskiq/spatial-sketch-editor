/**
 * Merge-gate event context against realistic queue shapes.
 *
 * A `merge_group` payload has no PR number and its `head_sha` is the synthetic
 * integration commit, not a PR head. These fixtures build the real commit shape:
 * one merge commit per queued entry, the queue tip as first parent and the
 * entry's PR head as second parent. That makes a standalone group and a
 * candidate built on an earlier PR testable without a live queue.
 *
 * Authorization is per entry. The lower entry removes one tagged check and
 * carries the owner approval; the top entry removes a different tagged check
 * without approval. A union of the batch's labels would authorize both, so the
 * negatives prove that neither PR's approval crosses into the other's delta.
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
 * Base has two tagged checks. PR A removes the first and is the lower entry.
 * PR B is built on A and either adds an unrelated file or removes the second
 * check (the unauthorized-cross-PR case). The queue commits merge each entry in
 * order, giving the real first-parent / second-parent shape.
 */
function makeRepo({ topRemovesCheck = false } = {}) {
	counter += 1;
	const repo = join(TEMP, `repo-${counter}`);
	const tests = join(repo, 'apps/editor/tests');
	mkdirSync(tests, { recursive: true });
	git(repo, 'init', '-q');
	git(repo, 'symbolic-ref', 'HEAD', 'refs/heads/main');
	writeFileSync(
		join(tests, 'a.test.ts'),
		"it('[cap:cap.a core] works', () => {});\n" +
			"it('[cap:cap.b core] works', () => {});\n"
	);
	git(repo, 'add', '-A');
	git(repo, 'commit', '-qm', 'base');
	const base = git(repo, 'rev-parse', 'HEAD');

	git(repo, 'checkout', '-q', '-b', 'pr-a', 'main');
	writeFileSync(join(tests, 'a.test.ts'), "it('[cap:cap.b core] works', () => {});\n");
	git(repo, 'add', '-A');
	git(repo, 'commit', '-qm', 'remove the first check');
	const prA = git(repo, 'rev-parse', 'HEAD');

	git(repo, 'checkout', '-q', '-b', 'queue-a', 'main');
	git(repo, 'merge', '--no-ff', '-q', '-m', 'queue A', 'pr-a');
	const queueA = git(repo, 'rev-parse', 'HEAD');

	git(repo, 'checkout', '-q', '-b', 'pr-b', 'pr-a');
	if (topRemovesCheck) {
		writeFileSync(join(tests, 'a.test.ts'), '// removed by PR B\n');
	} else {
		writeFileSync(join(repo, 'b.txt'), 'b\n');
	}
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
	const entriesOut = join(repo, `entries-${counter}.json`);
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
			'--entries-out',
			entriesOut,
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
	return { result, out, entriesOut, output };
}

function readArray(path: string): any[] {
	return JSON.parse(readFileSync(path, 'utf8'));
}

function runGuards(repo: string, args: string[]) {
	return spawnSync(process.execPath, [GUARDS, '--repo-root', repo, ...args], {
		encoding: 'utf8'
	});
}

describe('pull-request event context', () => {
	it('keeps the PR base branch and labels', () => {
		const { repo } = makeRepo();
		const { result, out, entriesOut, output } = runContext({
			repo,
			event: { pull_request: { number: 101, base: { ref: 'release/x' } } },
			map: mapFor('a'.repeat(40), 'b'.repeat(40))
		});
		expect(result.status).toBe(0);
		expect(readArray(out)).toEqual(['bug', 'owner-approved-guard-change']);
		expect(readFileSync(output, 'utf8')).toContain('base_branch=release/x');
		expect(existsSync(entriesOut)).toBe(false);
	});
});

describe('merge-group event context', () => {
	it('resolves a standalone queued PR to its own delta and labels', () => {
		const { repo, base, queueA, prA, prB } = makeRepo();
		git(repo, 'checkout', '-q', queueA);
		const { result, out, entriesOut, output } = runContext({
			repo,
			event: mergeEvent({ base, head: queueA }),
			map: mapFor(prA, prB)
		});
		expect(result.status).toBe(0);
		expect(readArray(entriesOut)).toEqual([
			{
				base,
				head: queueA,
				prHead: prA,
				prNumbers: [101],
				labels: ['bug', 'owner-approved-guard-change']
			}
		]);
		// A merge group must not expose a combined label file.
		expect(existsSync(out)).toBe(false);
		expect(readFileSync(output, 'utf8')).toContain('base_branch=main');
	});

	it('pins the first entry to the event base_sha even when main advanced', () => {
		const { repo, base, queueA, prA, prB } = makeRepo();
		git(repo, 'checkout', '-q', 'main');
		writeFileSync(join(repo, 'main-after-queue.txt'), 'advanced\n');
		git(repo, 'add', '-A');
		git(repo, 'commit', '-qm', 'advanced main');
		const advanced = git(repo, 'rev-parse', 'HEAD');
		git(repo, 'checkout', '-q', queueA);

		const { entriesOut } = runContext({
			repo,
			event: mergeEvent({ base, head: queueA }),
			map: mapFor(prA, prB)
		});
		const [entry] = readArray(entriesOut);
		expect(entry.base).toBe(base);
		expect(entry.base).not.toBe(advanced);
	});

	it('keeps labels and deltas separate across a stacked batch', () => {
		const { repo, base, queueA, queueB, prA, prB } = makeRepo();
		git(repo, 'checkout', '-q', queueB);
		const { result, entriesOut } = runContext({
			repo,
			event: mergeEvent({ base, head: queueB }),
			map: mapFor(prA, prB)
		});
		expect(result.status).toBe(0);
		const entries = readArray(entriesOut);
		expect(entries).toHaveLength(2);
		expect(entries[0]).toMatchObject({
			base,
			head: queueA,
			prHead: prA,
			prNumbers: [101],
			labels: ['bug', 'owner-approved-guard-change']
		});
		expect(entries[1]).toMatchObject({
			base: queueA,
			head: queueB,
			prHead: prB,
			prNumbers: [102],
			labels: ['bug']
		});
		expect(entries[0].labels).not.toEqual(entries[1].labels);
	});

	it('passes a stacked batch when each entry authorizes its own delta', () => {
		const { repo, base, queueB, prA, prB } = makeRepo();
		git(repo, 'checkout', '-q', queueB);
		const { entriesOut } = runContext({
			repo,
			event: mergeEvent({ base, head: queueB }),
			map: mapFor(prA, prB)
		});
		const guard = runGuards(repo, ['--entries-file', entriesOut]);
		expect(guard.status).toBe(0);
		expect(guard.stdout).toContain('no unapproved check or bug-state change');
	});

	it('does not let the lower PR approval authorize the top PR removal', () => {
		const { repo, base, queueB, prA, prB } = makeRepo({ topRemovesCheck: true });
		git(repo, 'checkout', '-q', queueB);
		const { entriesOut } = runContext({
			repo,
			event: mergeEvent({ base, head: queueB }),
			map: mapFor(prA, prB)
		});

		// This is the defect the per-entry check closes: a union of the batch's
		// labels would authorize both removals.
		const union = runGuards(repo, [
			'--base',
			base,
			'--head',
			queueB,
			'--labels',
			'owner-approved-guard-change'
		]);
		expect(union.status).toBe(0);

		const perEntry = runGuards(repo, ['--entries-file', entriesOut]);
		expect(perEntry.status).toBe(1);
		expect(perEntry.stderr).toContain('entry 2 (#102)');
		expect(perEntry.stderr).toContain('removed tagged check');
	});

	it('does not let the top PR approval authorize the lower PR removal', () => {
		const { repo, base, queueB, prA, prB } = makeRepo();
		git(repo, 'checkout', '-q', queueB);
		const { entriesOut } = runContext({
			repo,
			event: mergeEvent({ base, head: queueB }),
			map: mapFor(prA, prB, {
				'labels:101': [{ name: 'bug' }],
				'labels:102': [{ name: 'bug' }, { name: 'owner-approved-guard-change' }]
			})
		});

		const perEntry = runGuards(repo, ['--entries-file', entriesOut]);
		expect(perEntry.status).toBe(1);
		expect(perEntry.stderr).toContain('entry 1 (#101)');
		expect(perEntry.stderr).toContain('removed tagged check');
	});

	it('fails closed when a queued head has no open PR', () => {
		const { repo, base, queueA, prA, prB } = makeRepo();
		git(repo, 'checkout', '-q', queueA);
		const { result, out, entriesOut } = runContext({
			repo,
			event: mergeEvent({ base, head: queueA }),
			map: mapFor(prA, prB, { [prA]: [{ number: 101, state: 'closed' }] })
		});
		expect(result.status).toBe(1);
		expect(result.stderr).toContain('matches no open pull request');
		expect(existsSync(out)).toBe(false);
		expect(existsSync(entriesOut)).toBe(false);
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
