/**
 * Heavy lane (T4): the two oblique-host projection sweeps.
 *
 * Moved verbatim out of `p23-6e-extra-angled-plan-integrity.test.ts`, which
 * keeps every single-case regression in `test:fast` — including the other three
 * `it`s that used to share this `describe` (shared-Junction identity, baseline
 * Junction immobility, out-of-tolerance endpoints). Only these two plan the
 * same host 591 times: `step` walks 100…690 by hundredths and each step
 * re-plans and re-asserts the whole Wall/Room correspondence. The sweep is the
 * invariant — it is what makes the rounded-projection dust reproducible — and
 * that density is why the section belongs in `test:heavy`.
 */
/**
 * P23.6e — extra finding: wall-engine integrity on dense, angled plans.
 *
 * Manual smoke testing of the P23.6e Navigator surfaced two authoring failures
 * that are not part of that slice's semantics but block it end to end:
 *
 * 1. **Oblique-adjacent Rooms fused.** Correspondence evidence used the
 *    sampled `polygonIntersectionArea`, whose lattice counts samples lying on a
 *    shared **oblique** edge as inside both polygons. Two Rooms divided by an
 *    angled Wall therefore reported a phantom sliver of overlap, their
 *    component fused, and every later boundary Wall gesture was rejected as
 *    `Unsupported correspondence component 2→2` — even a Wall touching no Room.
 *    Axis-aligned neighbours returned a degenerate intersection box (zero), so
 *    only angled plans broke. The union predicate is now the exact,
 *    adjacency-aware `polygonsShareInteriorArea`.
 *
 * 2. **Degenerate T-split at an existing Junction.** A chain Wall that crosses
 *    another Wall at (or within floating-point dust of) an existing Junction was
 *    classified as a proper crossing at that Junction. Splitting the Wall that
 *    already *ends* there has a degenerate distance, so the planner rejected the
 *    whole gesture with `Split distance 0 is outside the open interval …`
 *    (also seen as the wall's own length). The planner now nodes through the
 *    existing Junction, and adopts one Junction identity when two records
 *    describe one physical node.
 */
import { describe, expect, it } from 'vitest';

import { planWallChain, type LayoutDocumentWallFirst } from '@portfolio/layout-core';
import {
	p,
	baseDocument,
	plan,
	commit,
	projectToSpan,
	bottomStart,
	bottomEnd,
	twoRoomsWithOneObliqueDivider
} from '../../helpers/angled-plan-fixtures';

describe('P23.6e regression — projected Wall endpoints node oblique hosts', () => {
	const topStart = p(0, -3.3142857142857145);
	const topEnd = p(7, -3.2);

	function stackedObliqueRooms(): LayoutDocumentWallFirst {
		const enclosure = planWallChain({
			baseline: baseDocument(),
			points: [p(0, -4), p(7, -4), p(7, 2), p(0, 2)],
			close: true,
			role: 'boundary'
		});
		if (enclosure.kind !== 'success') throw new Error('enclosure failed');
		let document = commit(enclosure.document, topStart, topEnd);
		document = commit(document, bottomStart, bottomEnd);
		expect(document.rooms).toHaveLength(3);
		return document;
	}

	it('stress-splits one oblique host without false 2→3 correspondence', () => {
		const document = twoRoomsWithOneObliqueDivider();
		for (let step = 100; step <= 690; step += 1) {
			const rawX = step / 100;
			const start = p(rawX, -4);
			const end = projectToSpan(p(rawX, -0.92), bottomStart, bottomEnd);
			const result = plan(document, start, end);
			expect(
				result.kind,
				`projected 2→3 regression at x=${rawX}: ${result.kind === 'rejected' ? JSON.stringify(result.rejection) : 'unexpected result'}`
			).toBe('success');
			if (result.kind !== 'success') continue;
			expect(result.splitWallIds, `host splits at x=${rawX}`).toHaveLength(2);
			expect(result.document.walls, `wall count at x=${rawX}`).toHaveLength(10);
			expect(result.document.rooms, `Room split at x=${rawX}`).toHaveLength(3);
		}
	});

	it('stress-splits both projected hosts without intermittent 3→4 or missed faces', () => {
		const document = stackedObliqueRooms();
		// 591 independently planned divider positions exercise both signs of the
		// rounded projection dust. Before this fix the same sweep alternated among
		// success-with-no-split, numeric `invalid`, and false 3→4 rejection.
		for (let step = 100; step <= 690; step += 1) {
			const rawX = step / 100;
			const start = projectToSpan(p(rawX, -3.25), topStart, topEnd);
			const end = projectToSpan(p(start[0], -0.92), bottomStart, bottomEnd);
			const result = plan(document, start, end);
			expect(
				result.kind,
				`projected divider at x=${rawX}: ${result.kind === 'rejected' ? JSON.stringify(result.rejection) : 'unexpected result'}`
			).toBe('success');
			if (result.kind !== 'success') continue;
			expect(result.splitWallIds, `host splits at x=${rawX}`).toHaveLength(2);
			expect(result.document.walls, `wall count at x=${rawX}`).toHaveLength(13);
			expect(result.document.rooms, `Room split at x=${rawX}`).toHaveLength(4);
		}
	});
});
