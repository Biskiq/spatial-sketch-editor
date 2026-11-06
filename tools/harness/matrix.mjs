#!/usr/bin/env node
/**
 * The workflow matrix, derived from the suite contract.
 *
 * The merge-gate workflow feeds this output to `fromJSON`, so the jobs and the
 * suites the aggregate requires cannot drift apart. The DB-backed API lane is
 * its own job (it needs a Postgres service), so it is not in the matrix.
 */
import { SUITES } from './suites.mjs';

const include = SUITES.filter((suite) => suite.kind !== 'tap').map((suite) => ({
	suite: suite.name,
	slug: suite.slug
}));

console.log(JSON.stringify({ include }));
