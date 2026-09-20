/**
 * Heavy lane (T4): the oblique-host projection and noding sweeps.
 *
 * Moved verbatim out of `p23-6e-extra-angled-plan-integrity.test.ts`, which
 * keeps the cheap representatives in `test:fast`. Every `it` here plans 591
 * independently projected divider positions (two of them walk 591 x-steps and
 * assert the resulting Wall/Room correspondence at each step), so the sweep is
 * the invariant — it is what makes the rounded-projection dust reproducible —
 * and the section belongs in `test:heavy`.
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

import {
	planWallChain,
	type LayoutDocumentWallFirst,
	type LayoutVec2
} from '@portfolio/layout-core';
import {
	p,
	baseDocument,
	plan,
	commit,
	projectToSpan
} from '../../helpers/angled-plan-fixtures';

describe('P23.6e regression — projected Wall endpoints node oblique hosts', () => {
	const topStart = p(0, -3.3142857142857145);
	const topEnd = p(7, -3.2);
	const bottomStart = p(0, -0.9142857142857137);
	const bottomEnd = p(7, -0.9333333333333336);

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

	function twoRoomsWithOneObliqueDivider(): LayoutDocumentWallFirst {
		const enclosure = planWallChain({
			baseline: baseDocument(),
			points: [p(0, -4), p(7, -4), p(7, 2), p(0, 2)],
			close: true,
			role: 'boundary'
		});
		if (enclosure.kind !== 'success') throw new Error('enclosure failed');
		const document = commit(enclosure.document, bottomStart, bottomEnd);
		expect(document.rooms).toHaveLength(2);
		return document;
	}

	it('uses one shared Junction for the projected stem and both host fragments', () => {
		const document = twoRoomsWithOneObliqueDivider();
		const start = p(3.37, -4);
		const end = projectToSpan(p(start[0], -0.92), bottomStart, bottomEnd);
		const result = plan(document, start, end);
		expect(result.kind).toBe('success');
		if (result.kind !== 'success') return;

		const sharedJunctionId = result.endJunctionId;
		const incidentWalls = result.document.walls.filter(
			(wall) =>
				wall.startJunctionId === sharedJunctionId || wall.endJunctionId === sharedJunctionId
		);
		const authoredWallIds = new Set(result.authoredWallIds);
		expect(incidentWalls.filter((wall) => authoredWallIds.has(wall.id))).toHaveLength(1);
		expect(incidentWalls.filter((wall) => !authoredWallIds.has(wall.id))).toHaveLength(2);
		expect(
			result.document.junctions.filter((junction) =>
				Math.hypot(junction.point[0] - end[0], junction.point[1] - end[1]) <= 1e-9
			)
		).toHaveLength(1);
	});

	it('does not move a reused baseline Junction while noding a near host', () => {
		const canonicalPoint = p(2, 5e-10);
		const baseline: LayoutDocumentWallFirst = {
			...baseDocument(),
			junctions: [
				{ id: 'host-a', point: p(0, 0) },
				{ id: 'host-b', point: p(4, 0) },
				{ id: 'existing', point: canonicalPoint },
				{ id: 'old-end', point: p(4, 2) }
			],
			walls: [
				{
					id: 'host',
					startJunctionId: 'host-a',
					endJunctionId: 'host-b',
					role: 'partition',
					thickness: 0.1,
					height: 3,
					centerline: { kind: 'line' } as const,
				},
				{
					id: 'old-wall',
					startJunctionId: 'existing',
					endJunctionId: 'old-end',
					role: 'partition',
					thickness: 0.1,
					height: 3,
					centerline: { kind: 'line' } as const,
				}
			]
		};
		const oldWall = structuredClone(baseline.walls[1]);
		const result = planWallChain({
			baseline,
			points: [canonicalPoint, p(2, -2)],
			close: false,
			role: 'partition'
		});
		expect(result.kind).toBe('success');
		if (result.kind !== 'success') return;
		expect(result.document.junctions.find((junction) => junction.id === 'existing')?.point).toEqual(
			canonicalPoint
		);
		expect(result.document.walls.find((wall) => wall.id === 'old-wall')).toEqual(oldWall);
		expect(result.createdJunctionIds).not.toContain('existing');
	});

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

	it('does not connect an endpoint outside Junction-identity tolerance', () => {
		const baseline: LayoutDocumentWallFirst = {
			...baseDocument(),
			junctions: [
				{ id: 'host-a', point: p(0, 0) },
				{ id: 'host-b', point: p(4, 1) }
			],
			walls: [
				{
					id: 'host',
					startJunctionId: 'host-a',
					endJunctionId: 'host-b',
					role: 'boundary',
					thickness: 0.2,
					height: 3,
					centerline: { kind: 'line' } as const,
				}
			]
		};
		const normalLength = Math.hypot(-1, 4);
		const normal = p(-1 / normalLength, 4 / normalLength);
		const midpoint = p(2, 0.5);
		const offset = (amount: number): LayoutVec2 =>
			p(midpoint[0] + normal[0] * amount, midpoint[1] + normal[1] * amount);
		const result = plan(baseline, offset(1), offset(2e-9));
		expect(result.kind).toBe('success');
		if (result.kind !== 'success') return;
		expect(result.splitWallIds).toHaveLength(0);
		expect(result.document.walls).toHaveLength(2);
	});
});
