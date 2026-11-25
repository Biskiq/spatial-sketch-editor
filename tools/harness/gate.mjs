#!/usr/bin/env node
/**
 * Fail-closed merge gate.
 *
 * The gate re-derives the job set from the classifier profile and requires a
 * `success` result from every expected job. A missing, skipped, cancelled or
 * failed job fails the gate, as does an unknown event or profile. It reads no
 * artifacts: the job results are the evidence, so an upload failure cannot
 * turn an unverified run green.
 *
 * Pull requests stay on Full until the queue has run cleanly (D2); the
 * classifier upgrades Focused to Full, and the gate refuses a merge group that
 * is not Full.
 */
const EVENTS = new Set(['pull_request', 'merge_group', 'workflow_dispatch', 'schedule']);
const EXPECTED = {
	minimal: ['prepare'],
	focused: ['prepare', 'lint', 'focused'],
	full: ['prepare', 'lint', 'suite', 'api', 'goldens']
};

function fail(message) {
	console.error(`merge gate: ${message}`);
	process.exit(1);
}

const event = process.env.EVENT_NAME ?? '';
if (!EVENTS.has(event)) fail(`unknown event ${JSON.stringify(event)}`);

let jobs;
try {
	jobs = JSON.parse(process.env.CI_GATE_JOBS ?? '');
} catch {
	fail('CI_GATE_JOBS is not valid JSON');
}
if (jobs === null || typeof jobs !== 'object') fail('CI_GATE_JOBS is not an object');

const profile = jobs?.prepare?.outputs?.profile ?? process.env.PROFILE ?? '';
if (!(profile in EXPECTED)) fail(`unknown profile ${JSON.stringify(profile)}`);
if (event === 'merge_group' && profile !== 'full') fail('a merge group must run the Full profile');

const expected = EXPECTED[profile];
for (const id of expected) {
	const job = jobs[id];
	if (!job) fail(`expected job ${id} is missing`);
	if (job.result !== 'success') fail(`expected job ${id} is ${job.result}`);
}

console.log(`merge gate: ${event} ${profile} passed (${expected.join(', ')})`);
