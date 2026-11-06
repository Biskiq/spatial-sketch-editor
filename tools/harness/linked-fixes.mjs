#!/usr/bin/env node
/**
 * What actually fixed a closed issue, from its timeline.
 *
 * A `cross-referenced` event only means "mentioned": that is not a fix. This
 * helper keeps a pull request only when it is merged, keeps a closing commit
 * SHA, and records an explicit unreadable result when the readback fails.
 *
 * The timeline is read by `gh api --paginate --slurp`, so every page is a valid
 * JSON element of one array. The output shape is:
 *
 *   { pullRequests: [{number, mergedAt}], commits: [sha] }
 *   { unreadable: true }                              // a read failed
 *
 * Usage:
 *   node tools/harness/linked-fixes.mjs --timeline timeline.json \
 *     --repo Biskiq/spatial-sketch-editor --out linked-fixes.json
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

function parseArgs(argv) {
	const options = { timeline: null, repo: null, out: null, gh: 'gh' };
	for (let index = 0; index < argv.length; index += 1) {
		const arg = argv[index];
		const next = () => {
			index += 1;
			if (index >= argv.length) throw new Error(`${arg} needs a value`);
			return argv[index];
		};
		if (arg === '--timeline') options.timeline = next();
		else if (arg === '--repo') options.repo = next();
		else if (arg === '--out') options.out = next();
		else if (arg === '--gh') options.gh = next();
		else throw new Error(`unknown argument: ${arg}`);
	}
	if (!options.timeline || !options.repo || !options.out) {
		throw new Error('--timeline, --repo and --out are required');
	}
	return options;
}

/** @param {string} gh @param {string[]} args */
function ghJson(gh, args) {
	return JSON.parse(execFileSync(gh, args, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 }));
}

function main() {
	const options = parseArgs(process.argv.slice(2));
	const out = resolve(options.out);
	mkdirSync(dirname(out), { recursive: true });
	let result;
	try {
		const pages = JSON.parse(readFileSync(options.timeline, 'utf8'));
		const events = (Array.isArray(pages) ? pages : [pages]).flat();
		const mentioned = new Set();
		const commits = new Set();
		for (const event of events) {
			if (event?.event === 'cross-referenced' && event.source?.issue?.pull_request) {
				mentioned.add(event.source.issue.number);
			}
			if (event?.event === 'closed' && typeof event.commit_id === 'string') {
				commits.add(event.commit_id);
			}
		}
		const pullRequests = [];
		for (const number of mentioned) {
			const pull = ghJson(options.gh, ['api', `repos/${options.repo}/pulls/${number}`]);
			if (pull.merged_at) pullRequests.push({ number, mergedAt: pull.merged_at });
		}
		result = { pullRequests, commits: [...commits] };
	} catch (error) {
		result = { unreadable: true, reason: error.message.split('\n')[0] };
	}
	writeFileSync(out, `${JSON.stringify(result, null, 2)}\n`);
	console.log(`linked fixes: ${out}`);
}

main();
