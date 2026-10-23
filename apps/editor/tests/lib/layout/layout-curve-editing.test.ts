/**
 * P23.11 fix 1 — local reshape authority for a curved Wall.
 *
 * The property pinned here: moving (or inserting) one bend point never
 * re-derives the whole chain, so spans created by an exact de Casteljau split
 * (or an identity-preserving insertion) survive byte-identically, and a Bend
 * drag is ONE canonical operation rather than an insert plus an unrelated move.
 *
 * Split by behavioural seam out of `layout-curve-regressions.test.ts`
 * (PR #115 WP3T, plan §7.6 area 2): the distance/crossing, proposal and
 * clearance contracts live in their own sibling suites.
 */
import { describe, expect, it } from 'vitest';

import {
	createEmptyWallFirstLayoutDocument,
	deriveChainSpans,
	LAYOUT_WALL_FIRST_FORMAT_VERSION,
	moveWallCurveKnot,
	planBendWallCurveKnot,
	planInsertWallCurveKnot,
	planMoveWallCurveKnot,
	planWallSplit,
	sampleSegment,
	wallCubicChain,
	wallCurveChainLength,
	type LayoutDocumentWallFirst,
	type LayoutVec2,
	type LayoutWall,
	type LayoutWallCenterline,
	type LayoutWallCubicSpan,
	type LayoutWallCurveKnot,
	type NodingIdAllocator
} from '@portfolio/layout-core';

const CHORD = 12;

function knotsOf(...points: LayoutVec2[]): LayoutWallCurveKnot[] {
	return points.map((point, index) => ({
		id: `wall-a:knot:${index + 1}`,
		point: [point[0], point[1]] as LayoutVec2
	}));
}

function chainOf(start: LayoutVec2, end: LayoutVec2, ...interior: LayoutVec2[]): LayoutWallCenterline {
	return wallCubicChain(knotsOf(...interior), deriveChainSpans([start, ...interior, end]));
}

function allocator(): NodingIdAllocator {
	return {
		nextWallId(base, seed) {
			let candidate = `${seed}-1`;
			let counter = 1;
			while (base.walls.some((wall) => wall.id === candidate)) {
				counter += 1;
				candidate = `${seed}-${counter}`;
			}
			return candidate;
		},
		nextJunctionId(base, seed) {
			let candidate = `j-${seed}-1`;
			let counter = 1;
			while (base.junctions.some((junction) => junction.id === candidate)) {
				counter += 1;
				candidate = `j-${seed}-${counter}`;
			}
			return candidate;
		}
	};
}

function documentOf(centerline: LayoutWallCenterline): LayoutDocumentWallFirst {
	const document = createEmptyWallFirstLayoutDocument();
	document.formatVersion = LAYOUT_WALL_FIRST_FORMAT_VERSION;
	document.junctions = [
		{ id: 'j-a', point: [0, 0] },
		{ id: 'j-b', point: [CHORD, 0] }
	];
	document.walls = [
		{
			id: 'wall-a',
			startJunctionId: 'j-a',
			endJunctionId: 'j-b',
			thickness: 0.2,
			height: 3,
			centerline
		} as LayoutWall
	];
	return document;
}

function wallOf(document: LayoutDocumentWallFirst, wallId: string): LayoutWall {
	return document.walls.find((wall) => wall.id === wallId)!;
}

type ChainView = {
	startPoint: LayoutVec2;
	endPoint: LayoutVec2;
	knots: readonly LayoutWallCurveKnot[];
	spans: readonly LayoutWallCubicSpan[];
};

function chainViewOf(document: LayoutDocumentWallFirst, wallId: string): ChainView {
	const wall = wallOf(document, wallId);
	if (wall.centerline.kind !== 'cubic-chain') throw new Error(`Wall '${wallId}' is not a chain`);
	const start = document.junctions.find((junction) => junction.id === wall.startJunctionId)!.point;
	const end = document.junctions.find((junction) => junction.id === wall.endJunctionId)!.point;
	return { startPoint: start, endPoint: end, knots: wall.centerline.knots, spans: wall.centerline.spans };
}

function segmentOf(document: LayoutDocumentWallFirst, wallId: string) {
	const view = chainViewOf(document, wallId);
	const points: LayoutVec2[] = [view.startPoint, ...view.knots.map((knot) => knot.point), view.endPoint];
	return {
		id: wallId,
		kind: 'cubic-chain' as const,
		cubics: view.spans.map((span, index) => ({
			start: points[index]!,
			handleOut: span.handleOut,
			handleIn: span.handleIn,
			end: points[index + 1]!
		}))
	};
}

function samplePointsOf(document: LayoutDocumentWallFirst, wallId: string): LayoutVec2[] {
	return sampleSegment(segmentOf(document, wallId)).samples.map((sample) => [...sample.point] as LayoutVec2);
}

/** Pure G1/tangent-direction assertion used by every local-edit regression below. */
function hasTangentContinuity(
	left: LayoutWallCubicSpan,
	right: LayoutWallCubicSpan,
	point: LayoutVec2
): boolean {
	const incoming: LayoutVec2 = [point[0] - left.handleIn[0], point[1] - left.handleIn[1]];
	const outgoing: LayoutVec2 = [right.handleOut[0] - point[0], right.handleOut[1] - point[1]];
	const cross = incoming[0] * outgoing[1] - incoming[1] * outgoing[0];
	const incomingLength = Math.hypot(incoming[0], incoming[1]);
	const outgoingLength = Math.hypot(outgoing[0], outgoing[1]);
	const dot = incoming[0] * outgoing[0] + incoming[1] * outgoing[1];
	return Math.abs(cross) <= 1e-9 * Math.max(1, incomingLength * outgoingLength) && dot > 0;
}

function expectSmoothInteriorJoins(chain: ChainView): void {
	const points: LayoutVec2[] = [chain.startPoint, ...chain.knots.map((knot) => knot.point), chain.endPoint];
	for (let join = 1; join < points.length - 1; join += 1) {
		expect(
			hasTangentContinuity(chain.spans[join - 1]!, chain.spans[join]!, points[join]!),
			`interior join ${join} must keep geometric tangent continuity`
		).toBe(true);
	}
}

function expectSmoothSeam(left: ChainView, right: ChainView, point: LayoutVec2): void {
	expect(
		hasTangentContinuity(left.spans.at(-1)!, right.spans[0]!, point),
		'fragment seam must keep geometric tangent continuity'
	).toBe(true);
}

function deviationFrom(point: LayoutVec2, polyline: readonly LayoutVec2[]): number {
	let best = Number.POSITIVE_INFINITY;
	for (let index = 1; index < polyline.length; index += 1) {
		const start = polyline[index - 1]!;
		const end = polyline[index]!;
		const dx = end[0] - start[0];
		const dz = end[1] - start[1];
		const squared = dx * dx + dz * dz;
		const raw = squared > 0 ? ((point[0] - start[0]) * dx + (point[1] - start[1]) * dz) / squared : 0;
		const amount = Math.min(1, Math.max(0, raw));
		const projected: LayoutVec2 = [start[0] + dx * amount, start[1] + dz * amount];
		best = Math.min(best, Math.hypot(point[0] - projected[0], point[1] - projected[1]));
	}
	return best;
}

/** 3 bend points, so a local move can leave a span two knots away untouched. */
function fourKnotDocument(): LayoutDocumentWallFirst {
	return documentOf(chainOf([0, 0], [CHORD, 0], [2.5, 1.5], [5, -1], [8, 1.5]));
}

// ===========================================================================
// Fix 1 — a knot move must preserve stored split-derived spans
// ===========================================================================

describe('P23.11 fix 1 — local knot move preserves persisted spans', () => {
	it('keeps every interior join smooth when the middle knot moves', () => {
		const baseline = fourKnotDocument();
		const before = chainViewOf(baseline, 'wall-a');
		const plan = planMoveWallCurveKnot(baseline, 'wall-a', 'wall-a:knot:2', [6, 2]);
		if (plan.kind !== 'success') throw new Error('expected the move to succeed');
		const after = chainViewOf(plan.document, 'wall-a');

		expectSmoothInteriorJoins(before);
		expectSmoothInteriorJoins(after);
		// The neighbour-facing controls stay fixed. Only both controls facing the
		// moved knot may change, so no adjacent join acquires a one-sided tangent.
		expect(after.spans[0]).toEqual(before.spans[0]);
		expect(after.spans[1]!.handleOut).toEqual(before.spans[1]!.handleOut);
		expect(after.spans[2]!.handleIn).toEqual(before.spans[2]!.handleIn);
		expect(after.spans[3]).toEqual(before.spans[3]);
	});

	it('keeps joins smooth after moving a knot on an exact split fragment', () => {
		const baseline = fourKnotDocument();
		const total = wallCurveChainLength(chainViewOf(baseline, 'wall-a'));
		const split = planWallSplit(baseline, 'wall-a', total * 0.86, allocator());
		if (split.kind !== 'success') throw new Error('expected the split to succeed');
		const beforeA = chainViewOf(split.document, 'wall-a');
		const beforeB = chainViewOf(split.document, split.createdWallIds[0]!);
		const moved = planMoveWallCurveKnot(split.document, 'wall-a', beforeA.knots[1]!.id, [6, 2]);
		if (moved.kind !== 'success') throw new Error('expected the fragment move to succeed');
		const afterA = chainViewOf(moved.document, 'wall-a');

		expectSmoothInteriorJoins(afterA);
		expectSmoothSeam(afterA, beforeB, afterA.endPoint);
		// The split's opposite fragment is outside the local influence region.
		expect(chainViewOf(moved.document, split.createdWallIds[0]!)).toEqual(beforeB);
	});

	it('leaves every span away from the moved knot byte-identical after a split', () => {
		const baseline = fourKnotDocument();
		const total = wallCurveChainLength(chainViewOf(baseline, 'wall-a'));
		// Split near the far end so the retained fragment keeps all three knots
		// and its LAST span is a de Casteljau half — geometry the smoothness
		// rule would never reproduce from the remaining points.
		const split = planWallSplit(baseline, 'wall-a', total * 0.86, allocator());
		if (split.kind !== 'success') throw new Error('expected the split to succeed');
		const fragmentA = chainViewOf(split.document, 'wall-a');
		const fragmentB = chainViewOf(split.document, split.createdWallIds[0]!);
		expect(fragmentA.knots.length).toBeGreaterThanOrEqual(3);

		const plan = planMoveWallCurveKnot(split.document, 'wall-a', fragmentA.knots[0]!.id, [1, 3]);
		expect(plan.kind).toBe('success');
		if (plan.kind !== 'success') return;
		const after = chainViewOf(plan.document, 'wall-a');

		// Only the two spans incident to the moved knot reshape; the split-derived
		// far span (and every other untouched span) is byte-identical.
		expect(after.spans.slice(2)).toEqual(fragmentA.spans.slice(2));
		expect(after.spans[0]).not.toEqual(fragmentA.spans[0]);
		expect(after.spans[1]).not.toEqual(fragmentA.spans[1]);
		expect(after.knots[0]!.point).toEqual([1, 3]);

		// The opposite split fragment is untouched by an edit of its sibling.
		expect(chainViewOf(plan.document, split.createdWallIds[0]!)).toEqual(fragmentB);
		// And the baseline itself is never mutated.
		expect(chainViewOf(baseline, 'wall-a').knots[0]!.point).toEqual([2.5, 1.5]);
	});

	it('does not re-derive the whole chain: a full refit would differ', () => {
		const baseline = fourKnotDocument();
		const total = wallCurveChainLength(chainViewOf(baseline, 'wall-a'));
		const split = planWallSplit(baseline, 'wall-a', total * 0.86, allocator());
		if (split.kind !== 'success') throw new Error('expected the split to succeed');
		const fragmentA = chainViewOf(split.document, 'wall-a');

		const plan = planMoveWallCurveKnot(split.document, 'wall-a', fragmentA.knots[0]!.id, [1, 3]);
		if (plan.kind !== 'success') throw new Error('expected the move to succeed');
		const after = chainViewOf(plan.document, 'wall-a');

		// What the superseded whole-chain re-derivation would have produced.
		const movedPoints: LayoutVec2[] = [
			after.startPoint,
			...after.knots.map((knot) => knot.point),
			after.endPoint
		];
		const refit = deriveChainSpans(movedPoints);
		// The persisted far span survived verbatim instead of being refit.
		expect(after.spans.at(-1)).toEqual(fragmentA.spans.at(-1));
		expect(after.spans.at(-1)).not.toEqual(refit.at(-1));
	});

	it('is deterministic and preserves the chain invariant under repeated application', () => {
		const document = fourKnotDocument();
		const first = moveWallCurveKnot(chainViewOf(document, 'wall-a'), 'wall-a:knot:1', [1, 3]);
		const second = moveWallCurveKnot(chainViewOf(document, 'wall-a'), 'wall-a:knot:1', [1, 3]);
		expect(first).toEqual(second);
		if (first.kind !== 'moved') throw new Error('expected a move');
		expect(first.knots.length + 1).toBe(first.spans.length);
		expect(first.knots.map((knot) => knot.id)).toEqual([
			'wall-a:knot:1',
			'wall-a:knot:2',
			'wall-a:knot:3'
		]);
	});

	it('rejects a missing knot or a non-finite point normally', () => {
		const chain = chainViewOf(fourKnotDocument(), 'wall-a');
		expect(moveWallCurveKnot(chain, 'nope', [1, 1])).toMatchObject({
			kind: 'rejected',
			code: 'knot_not_found'
		});
		expect(moveWallCurveKnot(chain, 'wall-a:knot:1', [Number.NaN, 1])).toMatchObject({
			kind: 'rejected',
			code: 'invalid_point'
		});
	});
});

describe('P23.11 fix 1 — insertion followed by movement', () => {
	it('keeps every interior join smooth after identity-preserving knot insertion', () => {
		const baseline = fourKnotDocument();
		const total = wallCurveChainLength(chainViewOf(baseline, 'wall-a'));
		const inserted = planInsertWallCurveKnot(baseline, 'wall-a', total * 0.55);
		if (inserted.kind !== 'success') throw new Error('expected the insertion to succeed');
		const before = chainViewOf(inserted.document, 'wall-a');
		expectSmoothInteriorJoins(before);
		const insertedKnot = before.knots.find((knot) => !chainViewOf(baseline, 'wall-a').knots.some((original) => original.id === knot.id))!;
		const moved = planMoveWallCurveKnot(inserted.document, 'wall-a', insertedKnot.id, [6, 2]);
		if (moved.kind !== 'success') throw new Error('expected the inserted-knot move to succeed');
		expectSmoothInteriorJoins(chainViewOf(moved.document, 'wall-a'));
	});

	it('keeps the pre-existing spans byte-identical across insert-then-move', () => {
		const baseline = documentOf(chainOf([0, 0], [CHORD, 0], [3, 2]));
		const total = wallCurveChainLength(chainViewOf(baseline, 'wall-a'));
		const inserted = planInsertWallCurveKnot(baseline, 'wall-a', total * 0.55);
		if (inserted.kind !== 'success') throw new Error('expected the insertion to succeed');
		const before = chainViewOf(inserted.document, 'wall-a');
		expect(before.knots).toHaveLength(2);
		// The insertion is identity-preserving: the sampled shape is unchanged.
		expect(
			Math.max(
				...samplePointsOf(inserted.document, 'wall-a').map((point) =>
					deviationFrom(point, samplePointsOf(baseline, 'wall-a'))
				)
			)
		).toBeLessThan(0.01);

		// Move the inserted knot (the one whose ID is not in the baseline).
		const insertedKnot = before.knots.find((knot) => knot.id !== 'wall-a:knot:1')!;
		const moved = planMoveWallCurveKnot(inserted.document, 'wall-a', insertedKnot.id, [6.5, 3]);
		if (moved.kind !== 'success') throw new Error('expected the move to succeed');
		const after = chainViewOf(moved.document, 'wall-a');
		// The pre-existing span far from the grab is untouched.
		expect(after.spans[0]).toEqual(before.spans[0]);
		expect(after.knots.find((knot) => knot.id === 'wall-a:knot:1')!.point).toEqual([3, 2]);
	});
});

describe('P23.11 fix 1 — one Bend drag is one canonical operation', () => {
	it('plans one candidate with one operation on an existing curve', () => {
		const document = documentOf(chainOf([0, 0], [CHORD, 0], [3, 2], [8, -1]));
		const total = wallCurveChainLength(chainViewOf(document, 'wall-a'));
		const plan = planBendWallCurveKnot(document, 'wall-a', { distance: total * 0.2, point: [2, 4] });
		if (plan.kind !== 'success') throw new Error('expected the bend to succeed');
		expect(plan.operation).toBe('wall-curve-knot-bend');
		expect(plan.changedWallIds).toEqual(['wall-a']);
		expect(plan.changedJunctionIds).toEqual([]);
		expectSmoothInteriorJoins(chainViewOf(plan.document, 'wall-a'));
	});

	it('preserves pre-existing spans away from the grab when bending a curve', () => {
		const baseline = fourKnotDocument();
		const total = wallCurveChainLength(chainViewOf(baseline, 'wall-a'));
		// Grab near the start: the insert lands in the first span and moves there,
		// so the last two spans must survive.
		const plan = planBendWallCurveKnot(baseline, 'wall-a', { distance: total * 0.08, point: [0.5, 2.5] });
		if (plan.kind !== 'success') throw new Error('expected the bend to succeed');
		const after = chainViewOf(plan.document, 'wall-a');
		const before = chainViewOf(baseline, 'wall-a');
		// Spans beyond the inserted knot's two incident spans are byte-identical.
		expect(after.spans.slice(2)).toEqual(before.spans.slice(1));
	});

	it('uses the same insertion-plus-local-move result as the explicit planners', () => {
		const baseline = documentOf(chainOf([0, 0], [CHORD, 0], [3, 2], [8, -1]));
		const distance = wallCurveChainLength(chainViewOf(baseline, 'wall-a')) * 0.2;
		const point: LayoutVec2 = [2, 4];
		const bend = planBendWallCurveKnot(baseline, 'wall-a', { distance, point });
		const inserted = planInsertWallCurveKnot(baseline, 'wall-a', distance);
		if (bend.kind !== 'success' || inserted.kind !== 'success') throw new Error('expected Bend insertion to succeed');
		const insertedView = chainViewOf(inserted.document, 'wall-a');
		const insertedKnot = insertedView.knots.find((knot) => !chainViewOf(baseline, 'wall-a').knots.some((original) => original.id === knot.id))!;
		const explicitMove = planMoveWallCurveKnot(inserted.document, 'wall-a', insertedKnot.id, point);
		if (explicitMove.kind !== 'success') throw new Error('expected explicit local move to succeed');
		expect(wallOf(bend.document, 'wall-a').centerline).toEqual(wallOf(explicitMove.document, 'wall-a').centerline);
	});
});
