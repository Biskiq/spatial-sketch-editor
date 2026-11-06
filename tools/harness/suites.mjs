/**
 * The merge-gate contract, in one place.
 *
 * The workflow, the artifact producer, the aggregator and the report engine all
 * read this list, so a suite cannot be required by one and invented by another.
 * Adding a suite here makes it required: a run that misses its provenance is
 * rejected instead of reading green.
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
		name: 'npm test',
		kind: 'vitest',
		cwd: 'apps/editor',
		args: ['npx', 'vitest', 'run'],
		slug: 'test'
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
		slug: 'check-camera-core'
	},
	{
		name: 'npm run check:layout-core',
		kind: 'command',
		script: 'check:layout-core',
		slug: 'check-layout-core'
	},
	{
		name: 'npm run check:geometry-core',
		kind: 'command',
		script: 'check:geometry-core',
		slug: 'check-geometry-core'
	},
	{
		name: 'npm run check:project-model',
		kind: 'command',
		script: 'check:project-model',
		slug: 'check-project-model'
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

/** @param {string} name */
export function suiteFor(name) {
	const suite = SUITES.find((entry) => entry.name === name);
	if (!suite) throw new Error(`${name} is not part of the merge-gate contract`);
	return suite;
}
