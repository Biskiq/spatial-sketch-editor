#!/usr/bin/env node
/**
 * Resolve the labels that authorize a change for the `check guards` job.
 *
 * A `pull_request` event carries the PR number directly. A `merge_group` event
 * does not carry a pull_request object; its `head_sha` is the head commit of the
 * last pull request in the group, and GitHub associates that commit with its
 * open pull request(s) through `/repos/{repo}/commits/{sha}/pulls`. Labels from
 * every associated open PR are unioned, so an owner-approved guard change stays
 * authorized on the queue commit.
 *
 * A native batch does not expose the lower PRs' labels in its payload. If an
 * owner-approved check removal appears in a lower PR, the conservative result
 * is a red `check guards` (the removal looks unapproved), never a silent pass.
 * The owner can re-run that PR alone or merge it directly.
 *
 * Failure to resolve any pull request is an error: the guards job must fail
 * closed, never treat unreadable authorization as approval.
 *
 * Usage:
 *   node tools/harness/event-labels.mjs \
 *     --event-file "$GITHUB_EVENT_PATH" --repo Biskiq/spatial-sketch-editor \
 *     --out .harness/pr-labels.json
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const SHA = /^[0-9a-f]{7,40}$/;

function parseArgs(argv) {
	const options = { eventFile: null, repo: process.env.GITHUB_REPOSITORY ?? null, out: null, gh: 'gh' };
	for (let index = 0; index < argv.length; index += 1) {
		const arg = argv[index];
		const next = () => {
			index += 1;
			if (index >= argv.length) throw new Error(`${arg} needs a value`);
			return argv[index];
		};
		if (arg === '--event-file') options.eventFile = next();
		else if (arg === '--repo') options.repo = next();
		else if (arg === '--out') options.out = next();
		else if (arg === '--gh') options.gh = next();
		else throw new Error(`unknown argument: ${arg}`);
	}
	if (!options.eventFile) throw new Error('--event-file is required');
	if (!options.repo) throw new Error('--repo owner/name is required');
	if (!options.out) throw new Error('--out is required');
	return options;
}

/**
 * What identifies the authorizing pull request(s) for an event.
 *
 * @param {any} event
 * @returns {{numbers: number[], headSha: string|null}|null}
 */
export function eventTarget(event) {
	const pull = event?.pull_request;
	if (Number.isInteger(pull?.number) && pull.number > 0) {
		return { numbers: [pull.number], headSha: null };
	}
	const group = event?.merge_group;
	if (typeof group?.head_sha === 'string' && SHA.test(group.head_sha)) {
		return { numbers: [], headSha: group.head_sha };
	}
	return null;
}

function ghJson(gh, args) {
	const text = execFileSync(gh, args, {
		encoding: 'utf8',
		stdio: ['ignore', 'pipe', 'pipe']
	});
	return JSON.parse(text);
}

/**
 * The union of labels on every pull request that authorizes this event.
 *
 * @param {{event: any, repo: string, gh?: string}} input
 * @returns {string[]}
 */
export function resolveLabels({ event, repo, gh = 'gh' }) {
	if (typeof repo !== 'string' || !/^[^/\s]+\/[^/\s]+$/.test(repo)) {
		throw new Error('--repo must be owner/name');
	}
	const target = eventTarget(event);
	if (target === null) {
		throw new Error('event is neither pull_request nor merge_group');
	}
	const numbers = new Set(target.numbers);
	if (target.headSha !== null) {
		const pulls = ghJson(gh, ['api', `repos/${repo}/commits/${target.headSha}/pulls`]);
		if (!Array.isArray(pulls)) {
			throw new Error('commit pull-request lookup did not return an array');
		}
		for (const pull of pulls) {
			if (pull?.state === 'open' && Number.isInteger(pull.number) && pull.number > 0) {
				numbers.add(pull.number);
			}
		}
	}
	if (numbers.size === 0) {
		throw new Error('no open pull request is associated with this event');
	}
	const labels = new Set();
	for (const number of [...numbers].sort((left, right) => left - right)) {
		const values = ghJson(gh, ['api', `repos/${repo}/issues/${number}/labels`]);
		if (!Array.isArray(values)) {
			throw new Error(`labels for #${number} did not return an array`);
		}
		for (const value of values) {
			const name = typeof value === 'string' ? value : value?.name;
			if (typeof name === 'string' && name.length > 0) labels.add(name);
		}
	}
	return [...labels].sort();
}

function cli() {
	const options = parseArgs(process.argv.slice(2));
	let event;
	try {
		event = JSON.parse(readFileSync(options.eventFile, 'utf8'));
	} catch (error) {
		throw new Error(`event payload is unreadable: ${error.message}`);
	}
	const labels = resolveLabels({ event, repo: options.repo, gh: options.gh });
	const out = resolve(options.out);
	mkdirSync(dirname(out), { recursive: true });
	writeFileSync(out, `${JSON.stringify(labels, null, 2)}\n`);
	console.log(`harness event labels: ${labels.length} label(s) -> ${out}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	try {
		cli();
	} catch (error) {
		console.error(`harness event labels: ${error.message}`);
		process.exitCode = 1;
	}
}
