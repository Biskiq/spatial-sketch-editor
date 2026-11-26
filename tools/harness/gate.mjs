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
 * A code pull request runs the lean profile; heavy and API are then required
 * only when the classifier marked their paths. The gate refuses a merge group
 * that is not Full.
 */
const EVENTS = new Set(['pull_request', 'merge_group', 'workflow_dispatch']);
const EXPECTED = {
	minimal: ['prepare'],
	focused: ['prepare', 'lint', 'focused'],
	lean: ['prepare', 'lint', 'suite', 'checks', 'build'],
	full: ['prepare', 'lint', 'suite', 'api', 'goldens', 'checks', 'build'],
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

const outputs = jobs?.prepare?.outputs ?? {};
const expected = [...EXPECTED[profile]];
if (profile === 'lean' && (outputs.heavy ?? process.env.HEAVY) === '1') expected.push('heavy');
if (profile === 'lean' && (outputs.api ?? process.env.API) === '1') expected.push('api');
for (const id of expected) {
	const job = jobs[id];
	if (!job) fail(`expected job ${id} is missing`);
	if (job.result !== 'success') fail(`expected job ${id} is ${job.result}`);
}

console.log(`merge gate: ${event} ${profile} passed (${expected.join(', ')})`);
