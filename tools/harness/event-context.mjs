#!/usr/bin/env node
/**
 * Resolve the merge gate's base branch and the pull requests that authorize a
 * change.
 *
 * `pull_request` carries the PR number and its base branch directly.
 *
 * `merge_group` carries neither a PR number nor a PR head: `head_sha` is the
 * synthetic integration commit and `github.base_ref` is empty. The queue builds
 * the group by merging one entry at a time onto `base_sha`, so the first-parent
 * chain from `head_sha` back to `base_sha` is the ordered batch, and each merge
 * commit's second parent is that entry's pull-request head. Those heads are
 * matched to open PRs through GitHub's own commit association, never through the
 * temporary branch name (a value the queued change can influence).
 *
 * Labels from every entry are unioned, so an owner approval on an earlier PR in
 * a stacked batch remains visible to `check guards`. Fail closed on a non-merge
 * commit in the chain, an entry with no open PR, a checked-out commit that is
 * not the event head, or a base ref other than the repository default branch.
 * Unreadable authorization is never treated as an empty approval.
 *
 * Usage:
 *   node tools/harness/event-context.mjs \
 *     --event-file "$GITHUB_EVENT_PATH" \
 *     --repo Biskiq/spatial-sketch-editor \
 *     --repo-root . \
 *     --labels-out .harness/pr-labels.json \
 *     --github-output "$GITHUB_OUTPUT"
 */
import { execFileSync } from 'node:child_process';
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const SHA = /^[0-9a-f]{7,40}$/;
const MAX_ENTRIES = 100;

function parseArgs(argv) {
	const options = {
		eventFile: null,
		repo: process.env.GITHUB_REPOSITORY ?? null,
		repoRoot: '.',
		labelsOut: '.harness/pr-labels.json',
		githubOutput: null,
		gh: 'gh'
	};
	for (let index = 0; index < argv.length; index += 1) {
		const arg = argv[index];
		const next = () => {
			index += 1;
			if (index >= argv.length) throw new Error(`${arg} needs a value`);
			return argv[index];
		};
		if (arg === '--event-file') options.eventFile = next();
		else if (arg === '--repo') options.repo = next();
		else if (arg === '--repo-root') options.repoRoot = next();
		else if (arg === '--labels-out') options.labelsOut = next();
		else if (arg === '--github-output') options.githubOutput = next();
		else if (arg === '--gh') options.gh = next();
		else throw new Error(`unknown argument: ${arg}`);
	}
	if (!options.eventFile) throw new Error('--event-file is required');
	if (!options.repo) throw new Error('--repo owner/name is required');
	return options;
}

function git(args, cwd) {
	try {
		return execFileSync('git', args, {
			cwd,
			encoding: 'utf8',
			stdio: ['ignore', 'pipe', 'pipe']
		}).trim();
	} catch (error) {
		const detail = error?.stderr?.toString().trim();
		throw new Error(`git ${args.join(' ')} failed${detail ? `: ${detail}` : ''}`);
	}
}

function ghJson(gh, args) {
	const text = execFileSync(gh, args, {
		encoding: 'utf8',
		stdio: ['ignore', 'pipe', 'pipe']
	});
	return JSON.parse(text);
}

/**
 * A branch that can safely be interpolated into a git refspec. `git
 * check-ref-format --branch` is the authority; this rejects the extra forms the
 * command still accepts for a normal branch.
 *
 * @param {unknown} value
 * @param {string} label
 */
export function validatedBaseBranch(value, label) {
	if (typeof value !== 'string' || value.length === 0) {
		throw new Error(`${label} is missing`);
	}
	const branch = value.startsWith('refs/heads/')
		? value.slice('refs/heads/'.length)
		: value;
	if (branch.length === 0) throw new Error(`${label} is empty`);
	try {
		execFileSync('git', ['check-ref-format', '--branch', branch], {
			stdio: ['ignore', 'ignore', 'ignore']
		});
	} catch {
		throw new Error(`${label} is not a valid branch name`);
	}
	return branch;
}

function eventKind(event) {
	if (event && typeof event === 'object' && event.merge_group) return 'merge_group';
	if (event && typeof event === 'object' && event.pull_request) return 'pull_request';
	return null;
}

/**
 * The base branch, preserving pull-request behavior and validating the queue's
 * base against the repository default branch.
 *
 * @param {any} event
 */
export function baseBranchFor(event) {
	const kind = eventKind(event);
	if (kind === 'pull_request') {
		return validatedBaseBranch(event.pull_request.base?.ref, 'pull_request.base.ref');
	}
	if (kind === 'merge_group') {
		const baseRef = event.merge_group.base_ref;
		if (typeof baseRef !== 'string' || !baseRef.startsWith('refs/heads/')) {
			throw new Error('merge_group.base_ref must be refs/heads/<branch>');
		}
		const defaultBranch = event.repository?.default_branch;
		if (typeof defaultBranch !== 'string' || defaultBranch.length === 0) {
			throw new Error('merge_group payload has no repository.default_branch');
		}
		const branch = validatedBaseBranch(baseRef, 'merge_group.base_ref');
		if (branch !== defaultBranch) {
			throw new Error(
				`merge_group.base_ref ${branch} is not the repository default branch ${defaultBranch}`
			);
		}
		return branch;
	}
	throw new Error('event is neither pull_request nor merge_group');
}

function parentsOf(repoRoot, sha) {
	if (!SHA.test(sha)) throw new Error(`invalid commit sha: ${sha}`);
	const output = git(['rev-list', '--parents', '-n', '1', sha], repoRoot);
	const parts = output.split(/\s+/).filter(Boolean);
	if (parts[0] !== sha) {
		throw new Error(`commit ${sha} resolved to ${parts[0] ?? 'nothing'}`);
	}
	return parts.slice(1);
}

/**
 * Every queued pull-request head, oldest first.
 *
 * The queue tip is the first parent and the entry's pull-request head is the
 * second, so walking first parents is exact for a standalone entry and for a
 * candidate built on earlier queued PRs. A different shape fails closed.
 *
 * @param {{repoRoot: string, baseSha: string, headSha: string}} input
 * @returns {string[]}
 */
export function entryHeadsFromGroup({ repoRoot, baseSha, headSha }) {
	if (!SHA.test(baseSha) || !SHA.test(headSha)) {
		throw new Error('merge group has an invalid base or head sha');
	}
	const checkedOut = git(['rev-parse', 'HEAD'], repoRoot);
	if (checkedOut !== headSha) {
		throw new Error(`checked-out ${checkedOut} is not the merge group head ${headSha}`);
	}

	let current = headSha;
	const heads = [];
	const seen = new Set();
	while (current !== baseSha) {
		if (seen.has(current)) {
			throw new Error('merge group first-parent chain contains a cycle');
		}
		seen.add(current);
		if (seen.size > MAX_ENTRIES) {
			throw new Error(`merge group has more than ${MAX_ENTRIES} entries`);
		}
		const parents = parentsOf(repoRoot, current);
		if (parents.length !== 2) {
			throw new Error(`merge group commit ${current} is not a two-parent merge`);
		}
		const [previousTip, entryHead] = parents;
		if (entryHead === baseSha) {
			throw new Error(`merge group commit ${current} has no pull-request head`);
		}
		heads.unshift(entryHead);
		current = previousTip;
	}
	if (heads.length === 0) throw new Error('merge group contains no queued entries');
	return heads;
}

function pullsForHead({ gh, repo, head }) {
	const pulls = ghJson(gh, ['api', `repos/${repo}/commits/${head}/pulls`]);
	if (!Array.isArray(pulls)) {
		throw new Error(`commit ${head} pull-request lookup did not return an array`);
	}
	return pulls.filter(
		(pull) => pull?.state === 'open' && Number.isInteger(pull.number) && pull.number > 0
	);
}

function labelsForPull({ gh, repo, number }) {
	const values = ghJson(gh, ['api', `repos/${repo}/issues/${number}/labels`]);
	if (!Array.isArray(values)) {
		throw new Error(`labels for #${number} did not return an array`);
	}
	const labels = [];
	for (const value of values) {
		const name = typeof value === 'string' ? value : value?.name;
		if (typeof name === 'string' && name.length > 0) labels.push(name);
	}
	return labels;
}

/**
 * The validated event context plus the union of authorizing labels.
 *
 * @param {{event: any, repo: string, repoRoot?: string, gh?: string}} input
 */
export function resolveEventContext({ event, repo, repoRoot = '.', gh = 'gh' }) {
	if (typeof repo !== 'string' || !/^[^/\s]+\/[^/\s]+$/.test(repo)) {
		throw new Error('--repo must be owner/name');
	}
	const kind = eventKind(event);
	const baseBranch = baseBranchFor(event);
	const numbers = new Set();

	if (kind === 'pull_request') {
		const number = event.pull_request.number;
		if (!Number.isInteger(number) || number <= 0) {
			throw new Error('pull_request.number is missing');
		}
		numbers.add(number);
	} else {
		const group = event.merge_group;
		const heads = entryHeadsFromGroup({
			repoRoot: resolve(repoRoot),
			baseSha: group.base_sha,
			headSha: group.head_sha
		});
		for (const head of heads) {
			const pulls = pullsForHead({ gh, repo, head });
			if (pulls.length === 0) {
				throw new Error(`queued head ${head} matches no open pull request`);
			}
			for (const pull of pulls) numbers.add(pull.number);
		}
	}

	const labels = new Set();
	for (const number of [...numbers].sort((left, right) => left - right)) {
		for (const label of labelsForPull({ gh, repo, number })) labels.add(label);
	}

	return {
		event: kind,
		baseBranch,
		baseSha: kind === 'merge_group' ? event.merge_group.base_sha : null,
		headSha: kind === 'merge_group' ? event.merge_group.head_sha : null,
		prNumbers: [...numbers].sort((left, right) => left - right),
		labels: [...labels].sort()
	};
}

function cli() {
	const options = parseArgs(process.argv.slice(2));
	let event;
	try {
		event = JSON.parse(readFileSync(options.eventFile, 'utf8'));
	} catch (error) {
		throw new Error(`event payload is unreadable: ${error.message}`);
	}
	const context = resolveEventContext({
		event,
		repo: options.repo,
		repoRoot: options.repoRoot,
		gh: options.gh
	});
	const labelsOut = resolve(options.labelsOut);
	mkdirSync(dirname(labelsOut), { recursive: true });
	writeFileSync(labelsOut, `${JSON.stringify(context.labels, null, 2)}\n`);
	if (options.githubOutput) {
		appendFileSync(options.githubOutput, `base_branch=${context.baseBranch}\n`);
	}
	console.log(
		`harness event context: ${context.event} base=${context.baseBranch} ` +
			`prs=${context.prNumbers.join(',') || '(none)'} labels=${context.labels.length}`
	);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	try {
		cli();
	} catch (error) {
		console.error(`harness event context: ${error.message}`);
		process.exitCode = 1;
	}
}
