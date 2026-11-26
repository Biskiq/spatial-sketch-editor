#!/usr/bin/env node
/**
 * `npm run status` — the lean repository status a new agent starts from.
 *
 * Prints the checked-out commit, the merge-gate suite contract, the lane
 * budgets and the canary baseline. It reads no remote evidence and reports no
 * maturity: the gate proves a run, and the canary runner proves the corpus.
 *
 * Usage:
 *  npm run status
 *  node tools/harness/status.mjs --json
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { REQUIRED_SUITES } from './suites.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const json = process.argv.includes('--json');

function git(...args) {
	return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
}

function readJson(path) {
	return JSON.parse(readFileSync(join(ROOT, path), 'utf8'));
}

const status = {
	commit: git('rev-parse', 'HEAD'),
	branch: git('rev-parse', '--abbrev-ref', 'HEAD'),
	suites: REQUIRED_SUITES,
	lanes: {
		arch: readJson('tools/metrics/budgets.json').archFiles?.length ?? null,
		canaries: readJson('tools/canaries/baseline.json'),
	},
};

if (json) {
	console.log(JSON.stringify(status, null, 2));
} else {
	console.log(`commit ${status.commit.slice(0, 12)} on ${status.branch}`);
	console.log(`merge-gate suites (${status.suites.length}):`);
	for (const suite of status.suites) console.log(`  ${suite}`);
	const canaries = status.lanes.canaries;
	const killed = canaries?.killed ?? 0;
	const total = canaries?.total ?? canaries?.results?.length ?? 0;
	console.log(`canaries: ${killed}/${total} killed in tools/canaries/baseline.json`);
}
