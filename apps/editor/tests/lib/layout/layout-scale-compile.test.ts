/**
 * Heavy lane (T4): compiling the scale fixtures.
 *
 * Moved verbatim out of `__fixtures__/layout-scale-fixtures.test.ts`, which
 * keeps the cheap fixture-integrity assertions (determinism, seed divergence,
 * pinned mix, strict codec) in `test:fast`. Compiling the small/medium tiers and
 * the 1,000-room tier is the expensive half of that file and is intrinsic to the
 * invariant — the scale is the point, so it is not a tuning knob. `describe`
 * title retained so the full test names are unchanged.
 *
 * T1.P02.S05: the fixtures are canonical wall-first documents, so this compiles
 * through the one surviving entry (`compileWallFirstLayoutGeometry`).
 */
import { describe, expect, it } from 'vitest';
import { compileWallFirstLayoutGeometry } from '@portfolio/layout-core';
import { buildScaleFixture, SCALE_FIXTURE_SEEDS } from './__fixtures__/layout-scale-fixtures';

describe('layout-scale-fixtures', () => {
	it('compiles with zero blocking issues at small and medium scales', () => {
		for (const tier of ['small', 'medium'] as const) {
			const document = buildScaleFixture(SCALE_FIXTURE_SEEDS[tier]);
			const { issues } = compileWallFirstLayoutGeometry(document);
			const blocking = issues.filter((issue) => issue.severity !== 'warning');
			expect(blocking, `blocking issues at ${tier}: ${JSON.stringify(blocking.slice(0, 3))}`).toEqual([]);
		}
	}, 30000);

	it('compiles the 1,000-room fixture with zero blocking issues', () => {
		const document = buildScaleFixture(SCALE_FIXTURE_SEEDS.large);
		const { geometry, issues } = compileWallFirstLayoutGeometry(document);
		const blocking = issues.filter((issue) => issue.severity !== 'warning');
		expect(blocking, `blocking issues: ${JSON.stringify(blocking.slice(0, 3))}`).toEqual([]);
		expect(geometry.rooms).toHaveLength(SCALE_FIXTURE_SEEDS.large.roomCount);
		// One canonical Wall per authored Wall: no per-Room duplication.
		expect(geometry.walls).toHaveLength(SCALE_FIXTURE_SEEDS.large.roomCount * 4);
	}, 60000);
});
