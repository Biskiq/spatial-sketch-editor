/**
 * Heavy lane (T4): compiling the scale fixtures.
 *
 * Moved verbatim out of `__fixtures__/layout-scale-fixtures.test.ts`, which
 * keeps the cheap fixture-integrity assertions (determinism, seed divergence,
 * pinned mix) in `test:fast`. Compiling the small/medium tiers and the
 * 1,000-room tier is the expensive half of that file (~2.9s of its ~3.0s) and
 * is intrinsic to the invariant — the scale is the point, so it is not a tuning
 * knob. `describe` title retained so the full test names are unchanged.
 */
import { describe, expect, it } from 'vitest';
import { compileLayoutGeometry } from '$lib/layout/layout-geometry';
import { validateLayoutDocument } from '$lib/layout/layout-codec';
import { buildScaleFixture, SCALE_FIXTURE_SEEDS } from './__fixtures__/layout-scale-fixtures';

describe('layout-scale-fixtures', () => {
	it('passes the strict codec and compiles with zero blocking issues at small and medium scales', () => {
		for (const tier of ['small', 'medium'] as const) {
			const document = buildScaleFixture(SCALE_FIXTURE_SEEDS[tier]);
			const validated = validateLayoutDocument(document);
			expect(validated.success, `codec rejected ${tier}: ${JSON.stringify(validated.success ? [] : validated.issues)}`).toBe(true);

			const { issues } = compileLayoutGeometry(document);
			const blocking = issues.filter((issue) => issue.severity !== 'warning');
			expect(blocking, `blocking issues at ${tier}: ${JSON.stringify(blocking.slice(0, 3))}`).toEqual([]);
		}
	}, 30000);

	it('compiles the 1,000-room fixture with zero blocking issues', () => {
		const document = buildScaleFixture(SCALE_FIXTURE_SEEDS.large);
		const { geometry, issues } = compileLayoutGeometry(document);
		const blocking = issues.filter((issue) => issue.severity !== 'warning');
		expect(blocking, `blocking issues: ${JSON.stringify(blocking.slice(0, 3))}`).toEqual([]);
		expect(geometry.rooms).toHaveLength(SCALE_FIXTURE_SEEDS.large.roomCount);
	}, 60000);
});
