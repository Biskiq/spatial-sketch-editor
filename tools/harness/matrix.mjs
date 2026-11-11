#!/usr/bin/env node
/**
 * The workflow matrix, derived from the suite contract.
 *
 * The merge-gate workflow feeds this output to `fromJSON`, so the jobs and the
 * suites the aggregate requires cannot drift apart. The DB-backed API lane is
 * its own job (it needs a Postgres service), so it is not in the matrix.
 *
 * A suite may name a `group` when several homogeneous checks should share one
 * checkout/install. The group is still a list of suites: the job runs each
 * producer separately, and the aggregate still requires every suite's own
 * provenance, so grouping removes setup cost without weakening the contract.
 * Ungrouped suites keep their own job and their stable check name.
 */
import { SUITES } from './suites.mjs';

/** @type {{job: string, slug: string, suites: string[]}[]} */
const include = [];
const byJob = new Map();

for (const suite of SUITES) {
	if (suite.kind === 'tap') continue;
	const job = suite.group ?? suite.name;
	let entry = byJob.get(job);
	if (!entry) {
		entry = { job, slug: suite.groupSlug ?? suite.slug, suites: [] };
		byJob.set(job, entry);
		include.push(entry);
	}
	entry.suites.push(suite.name);
}

console.log(JSON.stringify({ include }));
