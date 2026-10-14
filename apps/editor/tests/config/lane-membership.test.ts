/**
 * Lane membership is executable configuration, so it gets an executable proof.
 *
 * `test-lanes.ts` curates `ARCH_FILES` and `HEAVY_FILES` by filename. Nothing
 * type-checks a filename string and nothing notices when a suite is renamed,
 * deleted or curated twice, so four failures were silent before this file:
 *
 * - a curated entry that no longer exists — the lane runs fewer files than its
 *   contract claims while still reporting green;
 * - the same file in both lanes — it runs twice, and `test:fast` excludes it once;
 * - a curated entry outside the include population — it can never run at all;
 * - the lane union no longer equalling the curated set — a file that runs in no
 *   lane (not fast, not arch, not heavy), which no lane report can reveal.
 *
 * The controls below mutate copies of the real lists, so a checker that stopped
 * detecting one of those four fails here instead of passing vacuously. This is
 * configuration proof, not a second test registry: the population is read from
 * the tree and the lanes from `test-lanes.ts`, and nothing is stored.
 */
import { readdirSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { ARCH_FILES, HEAVY_FILES, NON_FAST_FILES } from '../../test-lanes';
import { ALL_TESTS_INCLUDE } from '../../vitest.shared';

const APP_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

/** The lane configs' own include population, as this proof understands it. */
const INCLUDE_PATTERN = 'tests/**/*.{test,spec}.{js,ts}';
const TEST_FILE_PATTERN = /\.(test|spec)\.(js|ts)$/;

export type LaneConfig = {
	arch: readonly string[];
	heavy: readonly string[];
	/** The curated non-fast set — `test:fast` excludes exactly these. */
	curated: readonly string[];
	/** Every file the full suite collects. */
	population: readonly string[];
};

/** Every problem that would make a lane silently run the wrong set. */
export function laneProblems(config: LaneConfig): string[] {
	const problems: string[] = [];
	const population = new Set(config.population);
	const archSet = new Set(config.arch);

	for (const lane of ['arch', 'heavy'] as const) {
		const files = config[lane];
		for (const [index, name] of files.entries()) {
			if (files.indexOf(name) !== index) problems.push(`${lane}: duplicate entry ${name}`);
			if (!population.has(name)) {
				problems.push(`${lane}: ${name} is outside the include population`);
			}
		}
	}
	for (const name of config.heavy) {
		if (archSet.has(name)) problems.push(`both lanes: ${name}`);
	}

	// The union identity is the whole point: every collected file runs in exactly
	// one lane, so the two curated lanes must equal the curated set exactly.
	const curated = new Set(config.curated);
	const union = new Set([...config.arch, ...config.heavy]);
	for (const name of curated) {
		if (!union.has(name)) problems.push(`runs in no lane: ${name}`);
	}
	for (const name of union) {
		if (!curated.has(name)) problems.push(`not in the curated set: ${name}`);
	}
	return problems;
}

/** Every collected test file, relative to `apps/editor`, in compare form. */
function collectedTestFiles(directory = join(APP_ROOT, 'tests')): string[] {
	const files: string[] = [];
	for (const entry of readdirSync(directory, { withFileTypes: true })) {
		const full = join(directory, entry.name);
		if (entry.isDirectory()) files.push(...collectedTestFiles(full));
		else if (TEST_FILE_PATTERN.test(entry.name)) {
			files.push(relative(APP_ROOT, full).split(sep).join('/'));
		}
	}
	return files.sort();
}

const population = collectedTestFiles();
const real: LaneConfig = {
	arch: ARCH_FILES,
	heavy: HEAVY_FILES,
	curated: NON_FAST_FILES,
	population
};

describe('lane configuration is provable from the tree', () => {
	it('collects the full suite from the documented include pattern', () => {
		expect(ALL_TESTS_INCLUDE).toEqual([INCLUDE_PATTERN]);
		// A walk that matched nothing would make every check below vacuous.
		expect(population.length).toBeGreaterThan(100);
		expect(population).toContain('tests/config/lane-membership.test.ts');
	});

	it('has unique, existing, disjoint lanes whose union is the curated set', () => {
		expect(laneProblems(real)).toEqual([]);
		expect(ARCH_FILES.length).toBeGreaterThanOrEqual(13);
		expect(HEAVY_FILES.length).toBeGreaterThanOrEqual(6);
	});

	it('fails a missing or renamed entry, an overlap, a duplicate, and a dropped file', () => {
		const missing = laneProblems({
			...real,
			arch: [...ARCH_FILES, 'tests/lib/layout/renamed-away.test.ts']
		});
		expect(missing.join('\n')).toContain('outside the include population');

		const overlap = laneProblems({ ...real, heavy: [...HEAVY_FILES, ARCH_FILES[0]!] });
		expect(overlap.join('\n')).toContain('both lanes');

		const duplicate = laneProblems({ ...real, arch: [...ARCH_FILES, ARCH_FILES[0]!] });
		expect(duplicate.join('\n')).toContain('duplicate entry');

		// A curated entry that no lane lists: the file is excluded from `test:fast`
		// but collected by no lane config, so it runs nowhere at all.
		const dropped = laneProblems({
			...real,
			arch: ARCH_FILES.filter((file) => file !== ARCH_FILES[0])
		});
		expect(dropped.join('\n')).toContain('runs in no lane');

		// A fast-lane file curated into a lane it was never excluded for: the lane
		// would run it while `test:fast` still does too.
		const fastFile = population.find((file) => !NON_FAST_FILES.includes(file));
		if (fastFile === undefined) throw new Error('expected at least one fast-lane test file');
		const stray = laneProblems({ ...real, heavy: [...HEAVY_FILES, fastFile] });
		expect(stray.join('\n')).toContain('not in the curated set');

		// Every control must be non-empty, or the checks above prove nothing.
		for (const problems of [missing, overlap, duplicate, dropped, stray]) {
			expect(problems.length).toBeGreaterThan(0);
		}
	});
});
