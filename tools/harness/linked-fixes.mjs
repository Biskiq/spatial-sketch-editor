#!/usr/bin/env node
/**
 * What actually closed the issue, from GitHub's closure event.
 *
 * A `cross-referenced` mention is not a fix, and a historical fix does not
 * certify a later manual close. GitHub's `ClosedEvent.closer` is closure
 * specific: a merged pull request or a commit for the closure being evaluated,
 * or null for a manual close. This queries the issue's latest ClosedEvent and
 * keeps only that closer. An open issue has no active closure, so evidence is
 * empty rather than a past fix.
 *
 * Output shape:
 *
 *   { pullRequests: [{number, mergedAt}], commits: [oid], closedAt }
 *   { unreadable: true }                              // a read failed
 *
 * Usage:
 *   node tools/harness/linked-fixes.mjs --issue 7 \
 *     --repo Biskiq/spatial-sketch-editor --out linked-fixes.json
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const QUERY = `
query ($owner: String!, $name: String!, $number: Int!) {
  repository(owner: $owner, name: $name) {
    issue(number: $number) {
      state
      timelineItems(last: 50, itemTypes: [CLOSED_EVENT]) {
        nodes {
          ... on ClosedEvent {
            createdAt
            closer {
              __typename
              ... on PullRequest { number mergedAt }
              ... on Commit { oid }
            }
          }
        }
      }
    }
  }
}
`;

function parseArgs(argv) {
	const options = { issue: null, repo: null, out: null, gh: 'gh' };
	for (let index = 0; index < argv.length; index += 1) {
		const arg = argv[index];
		const next = () => {
			index += 1;
			if (index >= argv.length) throw new Error(`${arg} needs a value`);
			return argv[index];
		};
		if (arg === '--issue') options.issue = Number(next());
		else if (arg === '--repo') options.repo = next();
		else if (arg === '--out') options.out = next();
		else if (arg === '--gh') options.gh = next();
		else throw new Error(`unknown argument: ${arg}`);
	}
	if (!Number.isInteger(options.issue) || !options.repo || !options.out) {
		throw new Error('--issue, --repo and --out are required');
	}
	return options;
}

function main() {
	const options = parseArgs(process.argv.slice(2));
	const out = resolve(options.out);
	mkdirSync(dirname(out), { recursive: true });
	let result;
	try {
		const [owner, name] = options.repo.split('/');
		const raw = execFileSync(
			options.gh,
			[
				'api',
				'graphql',
				'-f',
				`query=${QUERY}`,
				'-F',
				`owner=${owner}`,
				'-F',
				`name=${name}`,
				'-F',
				`number=${options.issue}`
			],
			{ encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 }
		);
		const issue = JSON.parse(raw)?.data?.repository?.issue;
		if (!issue || !Array.isArray(issue.timelineItems?.nodes)) {
			throw new Error('closure read returned no issue timeline');
		}
		if (issue.state !== 'CLOSED') {
			result = { pullRequests: [], commits: [], closedAt: null };
		} else {
			const closures = issue.timelineItems.nodes
				.filter((node) => node && typeof node.createdAt === 'string')
				.sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));
			const latest = closures[0] ?? null;
			const closer = latest?.closer ?? null;
			const pullRequests = [];
			const commits = [];
			if (closer?.__typename === 'PullRequest' && closer.mergedAt) {
				pullRequests.push({ number: closer.number, mergedAt: closer.mergedAt });
			}
			if (closer?.__typename === 'Commit' && typeof closer.oid === 'string') {
				commits.push(closer.oid);
			}
			result = { pullRequests, commits, closedAt: latest?.createdAt ?? null };
		}
	} catch (error) {
		result = { unreadable: true, reason: error.message.split('\n')[0] };
	}
	writeFileSync(out, `${JSON.stringify(result, null, 2)}\n`);
	console.log(`linked fixes: ${out}`);
}

main();
