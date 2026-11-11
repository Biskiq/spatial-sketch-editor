/**
 * The merge-gate contract, in one place.
 *
 * The workflow, the artifact producer, the aggregator and the report engine all
 * read this list, so a suite cannot be required by one and invented by another.
 * Adding a suite here makes it required: a run that misses its provenance is
 * rejected instead of reading green.
 *
 * The editor Vitest population is split into three disjoint lanes and CI runs
 * those lanes instead of `npm test` plus the lanes again. Their union is the
 * complete `npm test` population, proved by
 * `apps/editor/tests/config/lane-membership.test.ts`; `npm test` stays the
 * complete local suite and is never narrowed. Running the full suite in the
 * matrix as well would execute every arch and heavy test a second time without
 * adding coverage.
 *
 * `kind` decides how completion is proven:
 *
 *   command  exits 0; no artifact beyond the recorded exit code
 *   vitest   a real Vitest JSON reporter artifact with assertions
 *   tap      node:test TAP output (the DB-backed API contract), zero skips
 */

export const SUITES = [
	{ name: 'npm run check', kind: 'command', script: 'check', slug: 'check' },
	{
		name: 'npm run test:arch',
		kind: 'vitest',
		cwd: 'apps/editor',
		args: ['npx', 'vitest', 'run', '--config', 'vitest.arch.config.ts'],
		slug: 'test-arch'
	},
	{
		name: 'npm run test:fast',
		kind: 'vitest',
		cwd: 'apps/editor',
		args: ['npx', 'vitest', 'run', '--config', 'vitest.fast.config.ts'],
		slug: 'test-fast'
	},
	{
		name: 'npm run test:heavy',
		kind: 'vitest',
		cwd: 'apps/editor',
		args: ['npx', 'vitest', 'run', '--config', 'vitest.heavy.config.ts'],
		slug: 'test-heavy'
	},
	{ name: 'npm run build', kind: 'command', script: 'build', slug: 'build' },
	{ name: 'npm run check:api', kind: 'command', script: 'check:api', slug: 'check-api' },
	{
		name: 'npm run test:api',
		kind: 'tap',
		script: 'test:api',
		slug: 'test-api',
		needsDb: true
	},
	{
		name: 'npm run check:camera-core',
		kind: 'command',
		script: 'check:camera-core',
		slug: 'check-camera-core',
		group: 'package checks',
		groupSlug: 'package-checks'
	},
	{
		name: 'npm run check:layout-core',
		kind: 'command',
		script: 'check:layout-core',
		slug: 'check-layout-core',
		group: 'package checks',
		groupSlug: 'package-checks'
	},
	{
		name: 'npm run check:geometry-core',
		kind: 'command',
		script: 'check:geometry-core',
		slug: 'check-geometry-core',
		group: 'package checks',
		groupSlug: 'package-checks'
	},
	{
		name: 'npm run check:project-model',
		kind: 'command',
		script: 'check:project-model',
		slug: 'check-project-model',
		group: 'package checks',
		groupSlug: 'package-checks'
	}
];

/** Every suite the gate and the report require. */
export const REQUIRED_SUITES = SUITES.map((suite) => suite.name);

export const VITEST_SUITES = SUITES.filter((suite) => suite.kind === 'vitest').map(
	(suite) => suite.name
);

export const TAP_SUITES = SUITES.filter((suite) => suite.kind === 'tap').map(
	(suite) => suite.name
);

export const COMMAND_SUITES = SUITES.filter((suite) => suite.kind === 'command').map(
	(suite) => suite.name
);

/** How a production provenance record's command must start. */
export function expectedCommand(suite) {
	if (suite.kind === 'vitest') return suite.args.join(' ');
	return `npm run ${suite.script}`;
}

/** @param {string} name */
export function suiteFor(name) {
	const suite = SUITES.find((entry) => entry.name === name);
	if (!suite) throw new Error(`${name} is not part of the merge-gate contract`);
	return suite;
}
