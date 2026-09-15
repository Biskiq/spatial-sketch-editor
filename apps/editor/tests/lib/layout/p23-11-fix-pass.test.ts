/**
 * P23.11 fix pass — blockers 1/3/4/6.
 *
 * Three properties this file pins:
 *
 * - **local reshape authority** — moving one bend point never re-derives the
 *   whole chain, so spans created by an exact de Casteljau split (or an
 *   identity-preserving insertion) survive byte-identically;
 * - **curved-crossing gate** — a new straight Wall that bows across an existing
 *   curved Wall whose endpoint chord is clear rejects through the canonical
 *   sampled authority, with no partial mutation;
 * - **visible Add Bend Point** — a straight Wall converts and inserts in one
 *   atomic candidate, geometry unchanged.
 *
 * Plus the finite-thickness clearance audit: the guard is decided from the same
 * samples both mesh builders consume, so anything core accepts must build.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
	compileWallFirstLayoutGeometry,
	CURVE_SELF_INTERSECTION_TOLERANCE,
	createEmptyWallFirstLayoutDocument,
	deriveChainSpans,
	LAYOUT_GEOMETRY_EPSILON,
	moveWallCurveKnot,
	planBendWallCurveKnot,
	planConvertWallToCurve,
	planDeleteWallCurveKnot,
	planInsertWallCurveKnot,
	planMoveWallCurveKnot,
	planWallChain,
	planWallSegment,
	proposeWallCurveShape,
	planWallSplit,
	sampleSegment,
	wallCurveKnotArcDistance,
	wallCenterlineSegment,
	wallCubicChain,
	wallCurveChainLength,
	wallOffsetClearanceFailure,
	wallFirstWallSpan,
	LAYOUT_WALL_FIRST_FORMAT_VERSION,
	type LayoutDocumentWallFirst,
	type LayoutVec2,
	type LayoutWall,
	type LayoutWallCenterline,
	type LayoutWallCubicSpan,
	type LayoutWallCurveKnot,
	type NodingIdAllocator,
	type CurveSample
} from '@portfolio/layout-core';
import { buildStandaloneWallMesh as buildMuseumStandaloneWallMesh } from '../../../../museum/src/lib/layout/wall-mesh-builder';
import { buildStandaloneWallMesh as buildEditorStandaloneWallMesh } from '$lib/layout/wall-mesh-builder';

const LINE = { kind: 'line' } as const;
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
			role: 'partition',
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

function worstDeviation(points: readonly LayoutVec2[], baseline: readonly LayoutVec2[]): number {
	return Math.max(...points.map((point) => deviationFrom(point, baseline)));
}

/** Pure C1 geometric assertion used by every local-edit regression below. */
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

// ===========================================================================
// Fix 2 — unified Wall arc-distance authority
// ===========================================================================

describe('P23.11 fix 2 — one authored Wall-distance metric', () => {
	const curve = () => documentOf(chainOf([0, 0], [CHORD, 0], [3, 2], [8, -1]));

	it('measures the compiled arc and the canonical Wall span with one length', () => {
		const document = curve();
		const compiled = compileWallFirstLayoutGeometry(document).geometry.walls.find(
			(wall) => wall.wallId === 'wall-a'
		)!;
		const span = wallFirstWallSpan(document, wallOf(document, 'wall-a'))!;
		const arc = wallCurveChainLength(chainViewOf(document, 'wall-a'));
		// Compiled samples, the authored Wall span and the exact chain arc all
		// report the same metres — no chord-summed reading survives.
		expect(compiled.length).toBeCloseTo(arc, 9);
		expect(span.length).toBeCloseTo(arc, 9);
	});

	it('inserts a bend point at the compiled Wall-hit distance within inversion tolerance', () => {
		const document = curve();
		const compiled = compileWallFirstLayoutGeometry(document).geometry.walls.find(
			(wall) => wall.wallId === 'wall-a'
		)!;
		// The editor authors the grabbed distance straight off the compiled
		// samples (Plan hit `projection.offset`).
		for (const fraction of [0.12, 0.37, 0.62]) {
			const index = Math.floor(fraction * (compiled.samples.length - 1));
			const authoredDistance = compiled.samples[index]!.distance;
			const plan = planBendWallCurveKnot(document, 'wall-a', {
				distance: authoredDistance,
				point: compiled.samples[index]!.point
			});
			if (plan.kind !== 'success') throw new Error('expected the bend to succeed');
			const after = chainViewOf(plan.document, 'wall-a');
			const inserted = after.knots.find((knot) => knot.id === 'wall-a:knot:3') ?? after.knots.at(-1)!;
			const arc = requireArcDistance(after, inserted.id);
			// The inserted bend point's own arc distance equals the authored hit
			// distance to the resolver's inversion tolerance — not off by the
			// sampled-vs-cubic gap that used to be ~1e-3 m.
			expect(Math.abs(arc - authoredDistance)).toBeLessThan(1e-6);
		}
	});

	it('keeps split legs legal exactly on an Opening start/end and rejects the interior', () => {
		const document = documentOf(chainOf([0, 0], [CHORD, 0], [3, 2]));
		const span = wallFirstWallSpan(document, wallOf(document, 'wall-a'))!;
		const start = span.length * 0.3;
		const width = 1.2;
		const opened: LayoutDocumentWallFirst = {
			...document,
			openings: [
				{
					id: 'opening-a',
					wallId: 'wall-a',
					kind: 'window',
					offset: start,
					width,
					height: 1.2,
					sillHeight: 0.9,
					profile: 'rectangular'
				}
			]
		};
		// Split exactly on the start edge: legal, and the Opening rebases to 0 on
		// the new fragment.
		const atStart = planWallSplit(opened, 'wall-a', start, allocator());
		expect(atStart.kind).toBe('success');
		if (atStart.kind === 'success') {
			const moved = atStart.document.openings.find((opening) => opening.id === 'opening-a')!;
			expect(moved.wallId).toBe(atStart.createdWallIds[0]);
			expect(moved.offset).toBeCloseTo(0, 9);
		}
		// Split exactly on the end edge: legal, Opening retained on the first Wall.
		const atEnd = planWallSplit(opened, 'wall-a', start + width, allocator());
		expect(atEnd.kind).toBe('success');
		if (atEnd.kind === 'success') {
			const retained = atEnd.document.openings.find((opening) => opening.id === 'opening-a')!;
			expect(retained.wallId).toBe('wall-a');
			expect(retained.offset).toBeCloseTo(start, 9);
		}
		// Split through the interior: the whole command rejects.
		const through = planWallSplit(opened, 'wall-a', start + width / 2, allocator());
		expect(through.kind).toBe('rejected');
	});
});

function requireArcDistance(view: ChainView, knotId: string): number {
	const distance = wallCurveKnotArcDistance(view, knotId);
	if (distance === undefined) throw new Error(`no knot '${knotId}'`);
	return distance;
}

// ===========================================================================
// Fix 3 — Wall authoring rejects crossings against curved Walls
// ===========================================================================

function curvedWallDocument(): LayoutDocumentWallFirst {
	const document = createEmptyWallFirstLayoutDocument();
	document.formatVersion = LAYOUT_WALL_FIRST_FORMAT_VERSION;
	document.junctions = [
		{ id: 'c-a', point: [0, 0] },
		{ id: 'c-b', point: [6, 0] }
	];
	document.walls = [
		{
			id: 'curved',
			startJunctionId: 'c-a',
			endJunctionId: 'c-b',
			role: 'partition',
			thickness: 0.2,
			height: 3,
			centerline: chainOf([0, 0], [6, 0], [3, 3])
		} as LayoutWall
	];
	return document;
}

function curvedBoundaryHostDocument(
	openings: ReadonlyArray<{ id: string; offset: number; width: number }> = []
): LayoutDocumentWallFirst {
	const document = curvedWallDocument();
	document.walls[0]!.role = 'boundary';
	document.junctions.push(
		{ id: 'c-c', point: [6, 4] },
		{ id: 'c-d', point: [0, 4] }
	);
	document.walls.push(
		{ id: 'wall-right', startJunctionId: 'c-b', endJunctionId: 'c-c', role: 'boundary', thickness: 0.2, height: 3, centerline: LINE },
		{ id: 'wall-top', startJunctionId: 'c-c', endJunctionId: 'c-d', role: 'boundary', thickness: 0.2, height: 3, centerline: LINE },
		{ id: 'wall-left', startJunctionId: 'c-d', endJunctionId: 'c-a', role: 'boundary', thickness: 0.2, height: 3, centerline: LINE }
	);
	document.rooms = [
		{
			id: 'room-curved-host',
			name: 'Curved host room',
			boundary: [
				{ wallId: 'curved', direction: 'forward' },
				{ wallId: 'wall-right', direction: 'forward' },
				{ wallId: 'wall-top', direction: 'forward' },
				{ wallId: 'wall-left', direction: 'forward' }
			],
			floorThickness: 0.1,
			ceilingThickness: 0.1
		}
	];
	document.openings = openings.map((opening) => ({
		id: opening.id,
		wallId: 'curved',
		kind: 'window' as const,
		offset: opening.offset,
		width: opening.width,
		height: 1.2,
		sillHeight: 0.9,
		profile: 'rectangular' as const
	}));
	return document;
}

function compiledWallSample(
	document: LayoutDocumentWallFirst,
	wallId: string,
	fraction: number
): { point: LayoutVec2; distance: number } {
	const wall = compileWallFirstLayoutGeometry(document).geometry.walls.find((candidate) => candidate.wallId === wallId);
	if (!wall) throw new Error(`missing compiled wall '${wallId}'`);
	const index = Math.floor(fraction * (wall.samples.length - 1));
	return {
		point: [...wall.samples[index]!.point] as LayoutVec2,
		distance: wall.samples[index]!.distance
	};
}

function compiledOpeningCenter(document: LayoutDocumentWallFirst, openingId: string): LayoutVec2 {
	const opening = compileWallFirstLayoutGeometry(document).geometry.walls
		.flatMap((wall) => wall.openings)
		.find((candidate) => candidate.openingId === openingId);
	if (!opening) throw new Error(`missing compiled opening '${openingId}'`);
	return [...opening.center.point] as LayoutVec2;
}

describe('P23.11 fix 3 — authoring rejects a crossing against a curved Wall', () => {
	it('rejects a straight Wall that crosses the bow while the chord stays clear', () => {
		const baseline = curvedWallDocument();
		const snapshot = JSON.stringify(baseline);
		// The curved Wall's endpoint chord is z = 0 from x = 0…6. This straight
		// Wall runs at z = 2, so the chord classifier sees nothing — but it
		// crosses the bowed centerline twice.
		const plan = planWallChain({
			baseline,
			points: [
				[1, 2],
				[5, 2]
			],
			close: false,
			role: 'partition'
		});
		expect(plan.kind).toBe('rejected');
		if (plan.kind !== 'rejected') return;
		// Rejected by the canonical topology gate, not a bespoke crossing check.
		expect(plan.rejection.code).toBe('self_intersecting_chain');
		expect(plan.rejection.wallIds).toContain('curved');
		// No partial Wall/Junction/Room mutation.
		expect(JSON.stringify(baseline)).toBe(snapshot);
	});

	it('accepts a valid straight Wall near but not crossing the curved Wall', () => {
		const baseline = curvedWallDocument();
		const plan = planWallChain({
			baseline,
			points: [
				[-1, 1],
				[-1, 3]
			],
			close: false,
			role: 'partition'
		});
		expect(plan.kind).toBe('success');
	});

	it('accepts explicit shared-Junction contact with the curved Wall', () => {
		const baseline = curvedWallDocument();
		const plan = planWallChain({
			baseline,
			points: [
				[6, 0],
				[9, 0]
			],
			close: false,
			role: 'partition'
		});
		expect(plan.kind).toBe('success');
	});

	it('keeps straight/straight noding regressions green', () => {
		const document = createEmptyWallFirstLayoutDocument();
		document.formatVersion = LAYOUT_WALL_FIRST_FORMAT_VERSION;
		document.junctions = [
			{ id: 's-a', point: [0, 0] },
			{ id: 's-b', point: [8, 0] }
		];
		document.walls = [
			{ id: 'host', startJunctionId: 's-a', endJunctionId: 's-b', role: 'partition', thickness: 0.2, height: 3, centerline: LINE }
		];
		const plan = planWallChain({
			baseline: document,
			points: [
				[4, -3],
				[4, 3]
			],
			close: false,
			role: 'partition'
		});
		expect(plan.kind).toBe('success');
		if (plan.kind !== 'success') return;
		// The X crossing is noded, not rejected.
		expect(plan.document.walls.length).toBeGreaterThan(2);
	});
});

// ===========================================================================
// Fix 2 — authored endpoint T onto a curved host
// ===========================================================================

describe('P23.11 blocker 2 — authored endpoint T onto a curved host', () => {
	it('projects the normal Wall segment endpoint to true host arc distance and splits atomically', () => {
		const baseline = curvedBoundaryHostDocument();
		const hit = compiledWallSample(baseline, 'curved', 0.25);
		const plan = planWallSegment({
			baseline,
			start: [hit.point[0], hit.point[1] - 2],
			end: hit.point,
			role: 'partition'
		});
		if (plan.kind !== 'success') throw new Error(`expected curved T success, got ${JSON.stringify(plan.rejection)}`);

		const authored = wallOf(plan.document, plan.authoredWallIds[0]!);
		const hostA = wallOf(plan.document, 'curved');
		const hostB = plan.document.walls.find(
			(wall) => wall.id !== 'curved' && wall.startJunctionId === authored.endJunctionId && wall.endJunctionId === 'c-b'
		);
		if (!hostB) throw new Error('expected the curved host continuation');
		const splitJunctionId = authored.endJunctionId;
		expect(hostA.endJunctionId).toBe(splitJunctionId);
		expect(hostB.startJunctionId).toBe(splitJunctionId);
		expect(plan.splitWallIds).toContain('curved');
		// The authored endpoint is the one canonical X identity; no duplicate
		// Junction record is allowed at the normalized curved projection.
		expect(
			plan.document.junctions.filter((junction) => junction.id === splitJunctionId)
		).toHaveLength(1);
		expect(
			plan.document.junctions.filter(
				(junction) => Math.hypot(junction.point[0] - hit.point[0], junction.point[1] - hit.point[1]) < 0.01
			)
		).toHaveLength(1);

		const before = samplePointsOf(baseline, 'curved');
		const after = [...samplePointsOf(plan.document, 'curved'), ...samplePointsOf(plan.document, hostB.id)];
		expect(worstDeviation(after, before)).toBeLessThan(0.01);
		expect(
			wallCurveChainLength(chainViewOf(plan.document, 'curved')) +
				wallCurveChainLength(chainViewOf(plan.document, hostB.id))
		).toBeCloseTo(wallCurveChainLength(chainViewOf(baseline, 'curved')), 8);
	});

	it('preserves Room identity and Opening placement while splitting a boundary host', () => {
		const seed = curvedBoundaryHostDocument([
			{ id: 'near', offset: 0.5, width: 0.5 },
			{ id: 'far', offset: 5, width: 0.5 }
		]);
		const hit = compiledWallSample(seed, 'curved', 0.4);
		const beforeNear = compiledOpeningCenter(seed, 'near');
		const beforeFar = compiledOpeningCenter(seed, 'far');
		const plan = planWallChain({
			baseline: seed,
			points: [[hit.point[0], hit.point[1] - 2], hit.point],
			close: false,
			role: 'partition'
		});
		if (plan.kind !== 'success') throw new Error(`expected boundary-host T success, got ${JSON.stringify(plan.rejection)}`);
		const authored = wallOf(plan.document, plan.authoredWallIds[0]!);
		const hostB = plan.document.walls.find(
			(wall) => wall.id !== 'curved' && wall.startJunctionId === authored.endJunctionId && wall.endJunctionId === 'c-b'
		)!;

		expect(plan.document.rooms.map((room) => room.id)).toEqual(['room-curved-host']);
		expect(plan.document.rooms[0]!.boundary.map((ref) => ref.wallId)).toContain('curved');
		expect(plan.document.rooms[0]!.boundary.map((ref) => ref.wallId)).toContain(hostB.id);
		const near = plan.document.openings.find((opening) => opening.id === 'near')!;
		const far = plan.document.openings.find((opening) => opening.id === 'far')!;
		expect(near.wallId).toBe('curved');
		expect(far.wallId).toBe(hostB.id);
		expect(compiledOpeningCenter(plan.document, 'near')[0]).toBeCloseTo(beforeNear[0], 2);
		expect(compiledOpeningCenter(plan.document, 'near')[1]).toBeCloseTo(beforeNear[1], 2);
		expect(compiledOpeningCenter(plan.document, 'far')[0]).toBeCloseTo(beforeFar[0], 2);
		expect(compiledOpeningCenter(plan.document, 'far')[1]).toBeCloseTo(beforeFar[1], 2);
	});

	it('rejects a straddling Opening atomically through the existing split gate', () => {
		const seed = curvedBoundaryHostDocument();
		const hit = compiledWallSample(seed, 'curved', 0.4);
		seed.openings = [
			{
				id: 'straddle',
				wallId: 'curved',
				kind: 'window',
				offset: hit.distance - 0.25,
				width: 0.5,
				height: 1.2,
				sillHeight: 0.9,
				profile: 'rectangular'
			}
		];
		const snapshot = JSON.stringify(seed);
		const plan = planWallSegment({
			baseline: seed,
			start: [hit.point[0], hit.point[1] - 2],
			end: hit.point,
			role: 'partition'
		});
		expect(plan.kind).toBe('rejected');
		if (plan.kind !== 'rejected') return;
		expect(plan.rejection.code).toBe('noding_rejected');
		expect(plan.rejection.message).toMatch(/opening interior/i);
		expect(JSON.stringify(seed)).toBe(snapshot);
	});

	it('leaves an endpoint just outside the curved-host tolerance disconnected', () => {
		const baseline = curvedWallDocument();
		const hit = compiledWallSample(baseline, 'curved', 0.25);
		const outside: LayoutVec2 = [hit.point[0], hit.point[1] + 0.02];
		const plan = planWallSegment({
			baseline,
			start: [outside[0] - 0.2, outside[1]],
			end: outside,
			role: 'partition'
		});
		if (plan.kind !== 'success') throw new Error(`expected disconnected near-miss success, got ${JSON.stringify(plan.rejection)}`);
		expect(plan.splitWallIds).not.toContain('curved');
		expect(plan.document.walls.filter((wall) => wall.id === 'curved')).toHaveLength(1);
		const authored = wallOf(plan.document, plan.authoredWallIds[0]!);
		expect(authored.endJunctionId).not.toBe('c-a');
		expect(authored.endJunctionId).not.toBe('c-b');
	});

	it('reuses an authored endpoint that resolves at an existing host Junction', () => {
		const baseline = curvedWallDocument();
		const plan = planWallSegment({
			baseline,
			start: [-2, 0],
			end: [5e-10, -5e-10],
			role: 'partition'
		});
		if (plan.kind !== 'success') throw new Error(`expected endpoint adoption, got ${JSON.stringify(plan.rejection)}`);
		const authored = wallOf(plan.document, plan.authoredWallIds[0]!);
		expect(authored.endJunctionId).toBe('c-a');
		expect(plan.document.walls.filter((wall) => wall.id === 'curved')).toHaveLength(1);
		expect(plan.document.junctions.filter((junction) => junction.id === 'c-a')).toHaveLength(1);
	});
});

// ===========================================================================
// Fix 4 — visible "Add bend point here" works on a straight Wall
// ===========================================================================

describe('P23.11 fix 4 — Add Bend Point on a straight Wall', () => {
	it('converts and inserts atomically with the geometry visually unchanged', () => {
		const baseline = documentOf(LINE);
		const before = wallFirstWallSpan(baseline, wallOf(baseline, 'wall-a'))!;
		const plan = planInsertWallCurveKnot(baseline, 'wall-a', 4);
		if (plan.kind !== 'success') throw new Error('expected the insert to succeed');
		const after = wallFirstWallSpan(plan.document, wallOf(plan.document, 'wall-a'))!;
		expect(plan.operation).toBe('wall-curve-knot-insert');
		expect(after.length).toBeCloseTo(before.length, 9);
		const chain = chainViewOf(plan.document, 'wall-a');
		expect(chain.knots).toHaveLength(1);
		expect(chain.knots[0]!.point[0]).toBeCloseTo(4, 9);
		expect(chain.knots[0]!.point[1]).toBeCloseTo(0, 9);
		expect(samplePointsOf(plan.document, 'wall-a').every((point) => Math.abs(point[1]) < 1e-9)).toBe(true);
		// The baseline stays a straight line → one history entry.
		expect(wallOf(baseline, 'wall-a').centerline).toEqual({ kind: 'line' });
	});

	it('keeps the Inspector Add action visible without an existing bend point', () => {
		const inspector = readFileSync(
			resolve(process.cwd(), 'src/lib/editor/EditorInspector.svelte'),
			'utf8'
		);
		// The Add button is NOT inside the `knots.length > 0` gate: a knot-less
		// cubic chain and a straight Wall both keep a visible Add Bend Point.
		const gateIndex = inspector.indexOf('{#if selectedWallFirstWallKnots.length > 0}');
		const addIndex = inspector.indexOf('onclick={addSelectedWallCurveKnot}');
		expect(gateIndex).toBeGreaterThan(-1);
		expect(addIndex).toBeGreaterThan(-1);
		const gateEnd = inspector.indexOf('{/if}', gateIndex);
		expect(gateEnd).toBeGreaterThan(gateIndex);
		expect(addIndex).toBeGreaterThan(gateEnd);
	});

	it('uses the same canonical insertion authority as an existing curve', () => {
		// A knot-less cubic chain (what deleting the last bend point leaves) still
		// hosts a bend point: the chain form is the authority, not a knot count.
		const converted = planConvertWallToCurve(documentOf(LINE), 'wall-a');
		if (converted.kind !== 'success') throw new Error('expected the conversion to succeed');
		const deleted = planDeleteWallCurveKnot(converted.document, 'wall-a', 'wall-a:knot:1');
		if (deleted.kind !== 'success') throw new Error('expected the delete to succeed');
		const knotless = wallOf(deleted.document, 'wall-a').centerline;
		expect(knotless.kind).toBe('cubic-chain');
		if (knotless.kind !== 'cubic-chain') return;
		expect(knotless.knots).toEqual([]);
		const inserted = planInsertWallCurveKnot(deleted.document, 'wall-a', 5);
		expect(inserted.kind).toBe('success');
	});
});

// ===========================================================================
// Fix 5 — the pure curve proposal seam (invalid drag keeps following)
// ===========================================================================

describe('P23.11 fix 5 — the proposal is separate from acceptance', () => {
	it('proposes the attempted Wall shape while the canonical planner rejects it', () => {
		// Thick Wall whose bend would fold the offset: acceptance refuses it, but
		// the transient proposal still describes the attempted geometry so the
		// drag can keep tracking the cursor instead of snapping back.
		const document = documentOf(chainOf([0, 0], [CHORD, 0], [3, 0.5]));
		document.walls[0]!.thickness = 8;
		const rejected = planMoveWallCurveKnot(document, 'wall-a', 'wall-a:knot:1', [3, 3]);
		expect(rejected.kind).toBe('rejected');

		const proposed = proposeWallCurveShape(document, 'wall-a', {
			kind: 'knot-move',
			knotId: 'wall-a:knot:1',
			point: [3, 3]
		});
		expect(proposed).toBeDefined();
		expect(proposed!.length).toBeGreaterThan(2);
		// The attempted shape actually leaves the base line (it is not the
		// baseline), and its peak reaches the dragged bend point.
		expect(Math.max(...proposed!.map((point) => point[1]))).toBeGreaterThan(2);
	});

	it('follows the current raw pointer and never mutates the baseline', () => {
		const document = documentOf(chainOf([0, 0], [CHORD, 0], [3, 2]));
		const snapshot = JSON.stringify(document);
		const first = proposeWallCurveShape(document, 'wall-a', {
			kind: 'knot-move',
			knotId: 'wall-a:knot:1',
			point: [3, 4]
		})!;
		const second = proposeWallCurveShape(document, 'wall-a', {
			kind: 'knot-move',
			knotId: 'wall-a:knot:1',
			point: [3, -2]
		})!;
		// Each proposal describes its own pointer position.
		expect(Math.max(...first.map((point) => point[1]))).toBeGreaterThan(2);
		expect(Math.min(...second.map((point) => point[1]))).toBeLessThan(0);
		// Pure: the baseline document is untouched.
		expect(JSON.stringify(document)).toBe(snapshot);
	});

	it('proposes a bend attempt on a straight Wall without installing it', () => {
		const document = documentOf(LINE);
		const proposed = proposeWallCurveShape(document, 'wall-a', {
			kind: 'bend',
			distance: 4,
			point: [4, 2]
		});
		expect(proposed).toBeDefined();
		expect(wallOf(document, 'wall-a').centerline).toEqual({ kind: 'line' });
	});

	it('returns undefined for an unproposable intent', () => {
		const document = documentOf(chainOf([0, 0], [CHORD, 0], [3, 2]));
		expect(
			proposeWallCurveShape(document, 'wall-a', {
				kind: 'knot-move',
				knotId: 'missing',
				point: [1, 1]
			})
		).toBeUndefined();
		expect(
			proposeWallCurveShape(document, 'wall-a', {
				kind: 'knot-move',
				knotId: 'wall-a:knot:1',
				point: [Number.NaN, 1]
			})
		).toBeUndefined();
		// Out-of-range bend distance cannot even be proposed.
		expect(
			proposeWallCurveShape(document, 'wall-a', {
				kind: 'bend',
				distance: -1,
				point: [1, 1]
			})
		).toBeUndefined();
	});
});

// ===========================================================================
// Fix 6 — finite-thickness clearance audit
// ===========================================================================

describe('P23.11 fix 6 — clearance predicate audit', () => {
	function wallDocument(anchor: LayoutVec2, thickness: number): LayoutDocumentWallFirst {
		const document = createEmptyWallFirstLayoutDocument();
		document.formatVersion = LAYOUT_WALL_FIRST_FORMAT_VERSION;
		document.junctions = [
			{ id: 'j-p1', point: [0, 0] },
			{ id: 'j-p2', point: [6, 0] }
		];
		const knot: LayoutWallCurveKnot = { id: 'anchor:1', point: [anchor[0], anchor[1]] };
		document.walls = [
			{
				id: 'wall-p',
				startJunctionId: 'j-p1',
				endJunctionId: 'j-p2',
				role: 'partition',
				thickness,
				height: 3,
				centerline: wallCubicChain([knot], deriveChainSpans([[0, 0], knot.point, [6, 0]]))
			} as LayoutWall
		];
		return document;
	}

	function blockingCodes(document: LayoutDocumentWallFirst): string[] {
		return compileWallFirstLayoutGeometry(document)
			.issues.filter((issue) => issue.severity !== 'warning')
			.map((issue) => issue.code);
	}

	function clearanceOf(document: LayoutDocumentWallFirst) {
		const wall = document.walls[0]!;
		const sampled = sampleSegment(wallCenterlineSegment(wall, [0, 0], [6, 0], 'forward'));
		return wallOffsetClearanceFailure(sampled.samples, wall.thickness);
	}

	function unevenHandleDocument(thickness: number): LayoutDocumentWallFirst {
		const document = createEmptyWallFirstLayoutDocument();
		document.formatVersion = LAYOUT_WALL_FIRST_FORMAT_VERSION;
		document.junctions = [
			{ id: 'j-u1', point: [0, 0] },
			{ id: 'j-u2', point: [8, 0] }
		];
		document.walls = [
			{
				id: 'wall-uneven',
				startJunctionId: 'j-u1',
				endJunctionId: 'j-u2',
				role: 'partition',
				thickness,
				height: 3,
				centerline: wallCubicChain([], [
					{ handleOut: [0.2, 5], handleIn: [7.2, 1] } satisfies LayoutWallCubicSpan
				])
			} as LayoutWall
		];
		return document;
	}

	/** Exact circular U-turn samples with straight arms, at caller-chosen density. */
	function uTurnSamples(radius: number, arcSteps: number): CurveSample[] {
		const armLength = 6;
		const armSteps = Math.max(4, Math.round(arcSteps / 4));
		const samples: CurveSample[] = [];
		let distance = 0;
		const totalSteps = armSteps * 2 + arcSteps;
		const push = (point: LayoutVec2, tangent: LayoutVec2): void => {
			if (samples.length > 0) {
				const previous = samples.at(-1)!.point;
				distance += Math.hypot(point[0] - previous[0], point[1] - previous[1]);
			}
			samples.push({
				point,
				distance,
				tangent,
				normal: [-tangent[1], tangent[0]],
				t: samples.length / totalSteps
			});
		};
		for (let index = 0; index <= armSteps; index += 1) {
			push([-armLength + (armLength * index) / armSteps, 0], [1, 0]);
		}
		for (let index = 1; index <= arcSteps; index += 1) {
			const theta = -Math.PI / 2 + (Math.PI * index) / arcSteps;
			push([radius * Math.cos(theta), radius + radius * Math.sin(theta)], [-Math.sin(theta), Math.cos(theta)]);
		}
		for (let index = 1; index <= armSteps; index += 1) {
			push([-(armLength * index) / armSteps, 2 * radius], [-1, 0]);
		}
		return samples;
	}

	/**
	 * The invariant: anything canonical validation accepts must be renderable, so
	 * core's verdict and both mesh builders' verdict cannot disagree. The
	 * predicate is one pure function, so this asserts the compile path applies it
	 * exactly where the mesh builders do — never a stricter or looser copy.
	 */
	it('agrees with the mesh path on every accepted/rejected fixture', () => {
		const anchors: LayoutVec2[] = [
			[3, 0.02],
			[3, 0.1],
			[3, 0.4],
			[3, 0.9],
			[3, 1.5],
			[3, 2.5],
			[3, 4]
		];
		for (const anchor of anchors) {
			for (const thickness of [0.2, 1, 3, 6]) {
				const document = wallDocument(anchor, thickness);
				const clearance = clearanceOf(document);
				const codes = blockingCodes(document).filter((code) => code.startsWith('wall_offset') || code === 'wall_clearance_insufficient');
				if (clearance) {
					expect(codes.length, `anchor ${anchor[1]} / thickness ${thickness}`).toBeGreaterThan(0);
				} else {
					expect(codes, `anchor ${anchor[1]} / thickness ${thickness}`).toEqual([]);
				}
			}
		}
	});

	it('keeps a straight Wall unconditionally clear at any thickness', () => {
		const document = wallDocument([3, 0.5], 40);
		document.walls[0]!.centerline = LINE;
		expect(clearanceOf(document)).toBeUndefined();
		expect(blockingCodes(document)).toEqual([]);
	});

	it('classifies a near-parallel return run exactly at the thickness boundary', () => {
		// Adversarial fixture for the neck predicate: two anti-parallel straight
		// runs separated by `gap`, with the connecting pair outside the
		// self-intersection scan. This isolates the `spacing < thickness` rule from
		// the fold rule, so the boundary can be pinned exactly.
		const runs = (gap: number): Parameters<typeof wallOffsetClearanceFailure>[0] => [
			{ point: [0, 0], distance: 0, tangent: [1, 0], normal: [0, 1], t: 0 },
			{ point: [10, 0], distance: 10, tangent: [1, 0], normal: [0, 1], t: 0.4 },
			{ point: [10, gap], distance: 10 + gap, tangent: [-1, 0], normal: [0, -1], t: 0.6 },
			{ point: [0, gap], distance: 20 + gap, tangent: [-1, 0], normal: [0, -1], t: 1 }
		];
		const thickness = 0.4;
		const epsilon = LAYOUT_GEOMETRY_EPSILON;
		// The predicate's strict boundary is `spacing < thickness - ε`.
		// Pin both sides of that intentional numerical policy, not a coarse sample.
		expect(wallOffsetClearanceFailure(runs(thickness - 2 * epsilon), thickness)).toBe('neck');
		expect(wallOffsetClearanceFailure(runs(thickness - epsilon), thickness)).toBeUndefined();
		// Exactly thickness: the offset faces touch but do not overlap → clear.
		expect(wallOffsetClearanceFailure(runs(thickness), thickness)).toBeUndefined();
		// Above thickness by the same epsilon: clear.
		expect(wallOffsetClearanceFailure(runs(thickness + epsilon), thickness)).toBeUndefined();
	});

	it('classifies a tight U-turn at the radius boundary across two sampling densities', () => {
		const thickness = 1;
		const halfThickness = thickness / 2;
		// 0.01 m is small relative to the fixture but safely above the
		// self-intersection predicate's 1e-4 m segment tolerance.
		const delta = Math.max(0.01, 20 * CURVE_SELF_INTERSECTION_TOLERANCE);
		for (const density of [24, 96]) {
			expect(wallOffsetClearanceFailure(uTurnSamples(halfThickness - delta, density), thickness)).toBe('fold');
			expect(wallOffsetClearanceFailure(uTurnSamples(halfThickness, density), thickness)).toBe('fold');
			// The local offset is open above half-thickness, but this tight U-turn
			// still brings opposing centerline portions within one thickness, so the
			// separate global-clearance policy correctly reports a neck.
			expect(wallOffsetClearanceFailure(uTurnSamples(halfThickness + delta, density), thickness), `radius above boundary, density ${density}`).toBe('neck');
		}
	});

	it('keeps an uneven-handle and visually severe non-overlapping curve valid', () => {
		const document = unevenHandleDocument(0.4);
		const wall = wallOf(document, 'wall-uneven');
		const segment = wallCenterlineSegment(wall, [0, 0], [8, 0], 'forward');
		const sparse = sampleSegment(segment, { flatnessTolerance: 0.25, maxSampleSpan: 1 });
		const dense = sampleSegment(segment, { flatnessTolerance: 0.001, maxSampleSpan: 0.05 });
		expect(wallOffsetClearanceFailure(sparse.samples, wall.thickness)).toBeUndefined();
		expect(wallOffsetClearanceFailure(dense.samples, wall.thickness)).toBeUndefined();

		// These are the actual compiled Wall samples passed to the standalone
		// editor and museum mesh builders, not a second predicate-only verdict.
		const compiled = compileWallFirstLayoutGeometry(document).geometry.walls.find(
			(candidate) => candidate.wallId === 'wall-uneven'
		)!;
		const editorMesh = buildEditorStandaloneWallMesh(compiled, 0);
		const museumMesh = buildMuseumStandaloneWallMesh(compiled, 0);
		expect(editorMesh.issues).toEqual([]);
		expect(editorMesh.mesh).toBeDefined();
		expect(museumMesh.issues).toEqual([]);
		expect(museumMesh.mesh).toBeDefined();
	});

	it('keeps a severe but non-overlapping canonical bend buildable', () => {
		// Radius ≈ 2 m, thickness 0.4 m: the offset radius (1.8 m) is far above
		// the fold boundary (half thickness = 0.2 m), so this must be accepted.
		const document = wallDocument([3, 2], 0.4);
		expect(clearanceOf(document)).toBeUndefined();
		expect(blockingCodes(document)).toEqual([]);
		const compiled = compileWallFirstLayoutGeometry(document).geometry.walls.find(
			(candidate) => candidate.wallId === 'wall-p'
		)!;
		const editorMesh = buildEditorStandaloneWallMesh(compiled, 0);
		const museumMesh = buildMuseumStandaloneWallMesh(compiled, 0);
		expect(editorMesh.issues).toEqual([]);
		expect(editorMesh.mesh).toBeDefined();
		expect(museumMesh.issues).toEqual([]);
		expect(museumMesh.mesh).toBeDefined();
	});
});
