/**
 * P23.11 Slice 5 — canonical mutation planners, curved split, Openings and rigid
 * movement.
 *
 * Every case goes through a real planner on a real wall-first document and
 * asserts the canonical result: identities, stored cubic data and the samples
 * the renderers read. Two properties are worth stating up front:
 *
 * - **exact split** — the two fragments' sampled geometry is the pre-split Wall,
 *   with no flatten and no refit, so `A → X` plus `X → B` is the original curve;
 * - **one authority** — a curved split resolves its distance once, and the
 *   junction, the partitions, the Opening rebasing and the diagnostics all read
 *   that same result, so they cannot disagree about where the cut landed.
 */
import { describe, expect, it } from 'vitest';

import {
	compileWallFirstLayoutGeometry,
	createEmptyWallFirstLayoutDocument,
	deriveChainSpans,
	planBendWallCurveKnot,
	planConvertWallToCurve,
	planConvertWallToLine,
	planDeleteWallCurveKnot,
	planExactWallAngle,
	planExactWallLength,
	planInsertWallCurveKnot,
	planMoveWallCurveKnot,
	planRigidWallMove,
	planWallCrossing,
	planWallSplit,
	planWallSubdivision,
	sampleSegment,
	wallCubicChain,
	wallCurveChainLength,
	wallCurveKnotArcDistance,
	wallFirstWallSpan,
	type LayoutDocumentWallFirst,
	type LayoutVec2,
	type LayoutWall,
	type LayoutWallCenterline,
	type LayoutWallCubicSpan,
	type LayoutWallCurveKnot,
	type NodingIdAllocator
} from '@portfolio/layout-core';

const LINE = { kind: 'line' } as const;
const CHORD = 12;

// ---------------------------------------------------------------------------
// fixtures
// ---------------------------------------------------------------------------

function knotsOf(...points: LayoutVec2[]): LayoutWallCurveKnot[] {
	return points.map((point, index) => ({
		id: `wall-a:knot:${index + 1}`,
		point: [point[0], point[1]] as LayoutVec2
	}));
}

/** A canonical chain from a point list, using the write-path smoothness rule. */
function chainOf(start: LayoutVec2, end: LayoutVec2, ...interior: LayoutVec2[]): LayoutWallCenterline {
	const points: LayoutVec2[] = [start, ...interior, end];
	return wallCubicChain(knotsOf(...interior), deriveChainSpans(points));
}

/**
 * One 12 m Wall `j-a → j-b` with an optional Room around it, so boundary
 * rewriting and Opening hosting run through the real paths.
 */
function documentOf(
	centerline: LayoutWall['centerline'] = LINE,
	options: {
		withRoom?: boolean;
		openings?: ReadonlyArray<{ id: string; offset: number; width: number }>;
	} = {}
): LayoutDocumentWallFirst {
	const document = createEmptyWallFirstLayoutDocument();
	document.junctions = [
		{ id: 'j-a', point: [0, 0] },
		{ id: 'j-b', point: [CHORD, 0] },
		{ id: 'j-c', point: [CHORD, 4] },
		{ id: 'j-d', point: [0, 4] }
	];
	// `wall-a` is the target; `wall-x` is an open neighbour so the default
	// document encloses no face. A closed loop with no Room is an unclaimed
	// face and would correctly reject, so the enclosure exists only withRoom.
	document.walls = [
		{
			id: 'wall-a',
			startJunctionId: 'j-a',
			endJunctionId: 'j-b',
			role: 'boundary',
			thickness: 0.2,
			height: 3,
			centerline
		},
		{ id: 'wall-x', startJunctionId: 'j-c', endJunctionId: 'j-d', role: 'partition', thickness: 0.2, height: 3, centerline: LINE }
	];
	if (options.withRoom) {
		document.walls = [
			document.walls[0]!,
			{ id: 'wall-b', startJunctionId: 'j-b', endJunctionId: 'j-c', role: 'boundary', thickness: 0.2, height: 3, centerline: LINE },
			{ id: 'wall-c', startJunctionId: 'j-c', endJunctionId: 'j-d', role: 'boundary', thickness: 0.2, height: 3, centerline: LINE },
			{ id: 'wall-d', startJunctionId: 'j-d', endJunctionId: 'j-a', role: 'boundary', thickness: 0.2, height: 3, centerline: LINE }
		];
		document.rooms = [
			{
				id: 'room-a',
				name: 'Room A',
				boundary: [
					{ wallId: 'wall-a', direction: 'forward' },
					{ wallId: 'wall-b', direction: 'forward' },
					{ wallId: 'wall-c', direction: 'forward' },
					{ wallId: 'wall-d', direction: 'forward' }
				],
				floorThickness: 0.1,
				ceilingThickness: 0.1
			}
		];
	}
	document.openings = (options.openings ?? []).map((opening) => ({
		id: opening.id,
		wallId: 'wall-a',
		kind: 'window' as const,
		offset: opening.offset,
		width: opening.width,
		height: 1.2,
		sillHeight: 0.9,
		profile: 'rectangular' as const
	}));
	return document;
}

/** A 12 m Wall bowed to z = 2 then back through z = −1: two bend points. */
function curvedDocument(options: Parameters<typeof documentOf>[1] = {}): LayoutDocumentWallFirst {
	return documentOf(chainOf([0, 0], [CHORD, 0], [3, 2], [8, -1]), options);
}

/**
 * Three bend points, so a local edit can be shown to leave a span that is two
 * knots away from the grab exact (with only two knots every span touches the
 * moved knot's own tangent).
 */
function fourKnotDocument(): LayoutDocumentWallFirst {
	return documentOf(chainOf([0, 0], [CHORD, 0], [2.5, 1.5], [5, -1], [8, 1.5]));
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

function wallOf(document: LayoutDocumentWallFirst, wallId: string): LayoutWall {
	return document.walls.find((wall) => wall.id === wallId)!;
}

function endpointsOf(
	document: LayoutDocumentWallFirst,
	wall: LayoutWall
): { start: LayoutVec2; end: LayoutVec2 } {
	return {
		start: document.junctions.find((junction) => junction.id === wall.startJunctionId)!.point,
		end: document.junctions.find((junction) => junction.id === wall.endJunctionId)!.point
	};
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
	const { start, end } = endpointsOf(document, wall);
	return { startPoint: start, endPoint: end, knots: wall.centerline.knots, spans: wall.centerline.spans };
}

/** Arc distance of one knot, read through the canonical chain authority. */
function knotDistanceOf(document: LayoutDocumentWallFirst, knotId: string): number {
	const distance = wallCurveKnotArcDistance(chainViewOf(document, 'wall-a'), knotId);
	if (distance === undefined) throw new Error(`no knot '${knotId}'`);
	return distance;
}

/** A Wall's canonical centerline as a sourceable segment (line or chain). */
function segmentOf(
	document: LayoutDocumentWallFirst,
	wallId: string
):
	| { id: string; kind: 'line'; start: LayoutVec2; end: LayoutVec2 }
	| {
			id: string;
			kind: 'cubic-chain';
			cubics: { start: LayoutVec2; handleOut: LayoutVec2; handleIn: LayoutVec2; end: LayoutVec2 }[];
	  } {
	const wall = wallOf(document, wallId);
	if (wall.centerline.kind === 'line') {
		const { start, end } = endpointsOf(document, wall);
		return { id: wallId, kind: 'line', start, end };
	}
	const view = chainViewOf(document, wallId);
	const points: LayoutVec2[] = [view.startPoint, ...view.knots.map((knot) => knot.point), view.endPoint];
	return {
		id: wallId,
		kind: 'cubic-chain',
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

/** Distance from a point to the nearest segment of a polyline. */
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

function worstDeviation(points: readonly LayoutVec2[], polyline: readonly LayoutVec2[]): number {
	return Math.max(...points.map((point) => deviationFrom(point, polyline)));
}

function wallLengthOf(document: LayoutDocumentWallFirst, wallId: string): number {
	return wallFirstWallSpan(document, wallOf(document, wallId))!.length;
}

/**
 * Narrow any plan union (the noding plan or the P23.1 precision plan) to its
 * success branch. Both carry `kind: 'success'` and a complete candidate
 * document, so one helper covers every planner this file exercises.
 */
function expectSuccess<T extends { kind: string }>(plan: T): Extract<T, { kind: 'success' }> {
	if (plan.kind !== 'success') throw new Error(`expected success, got ${JSON.stringify(plan)}`);
	return plan as Extract<T, { kind: 'success' }>;
}

// ---------------------------------------------------------------------------
// convert
// ---------------------------------------------------------------------------

describe('P23.11 slice 5 — straight ↔ curve conversion', () => {
	it('converts a straight Wall to a chain with no geometric change', () => {
		const document = documentOf();
		const plan = expectSuccess(planConvertWallToCurve(document, 'wall-a'));
		expect(plan.operation).toBe('wall-convert-to-curve');
		const chain = wallOf(plan.document, 'wall-a').centerline;
		expect(chain.kind).toBe('cubic-chain');
		if (chain.kind !== 'cubic-chain') return;
		// One bend point on the exact midpoint, so the spline is
		// degenerate-straight until it is dragged.
		expect(chain.knots).toHaveLength(1);
		expect(chain.knots[0]!.point).toEqual([CHORD / 2, 0]);
		expect(chain.spans).toHaveLength(2);
		// The converted Wall is genuinely straight: chord length, collinear samples.
		expect(wallLengthOf(plan.document, 'wall-a')).toBeCloseTo(wallLengthOf(document, 'wall-a'), 9);
		for (const sample of samplePointsOf(plan.document, 'wall-a')) {
			expect(Math.abs(sample[1])).toBeLessThan(1e-9);
		}
	});

	it('converts back to a line and rejects either no-op', () => {
		const document = documentOf();
		expect(planConvertWallToLine(document, 'wall-a')).toMatchObject({
			kind: 'rejected',
			rejection: { code: 'no_op' }
		});
		const converted = expectSuccess(planConvertWallToCurve(document, 'wall-a'));
		expect(planConvertWallToCurve(converted.document, 'wall-a')).toMatchObject({
			kind: 'rejected',
			rejection: { code: 'no_op' }
		});
		const back = expectSuccess(planConvertWallToLine(converted.document, 'wall-a'));
		expect(wallOf(back.document, 'wall-a').centerline).toEqual({ kind: 'line' });
	});
});

// ---------------------------------------------------------------------------
// insert / move / delete
// ---------------------------------------------------------------------------

describe('P23.11 slice 5 — bend point planners', () => {
	it('inserts a bend point at a physical arc distance without moving the Wall', () => {
		const document = curvedDocument();
		const baseline = samplePointsOf(document, 'wall-a');
		const total = wallLengthOf(document, 'wall-a');
		const baselineKnotIds = new Set(chainViewOf(document, 'wall-a').knots.map((knot) => knot.id));
		for (const fraction of [0.15, 0.4, 0.5, 0.75, 0.9]) {
			const plan = expectSuccess(planInsertWallCurveKnot(document, 'wall-a', total * fraction));
			const chain = chainViewOf(plan.document, 'wall-a');
			expect(chain.knots, `fraction ${fraction}`).toHaveLength(3);
			const inserted = chain.knots.find((knot) => !baselineKnotIds.has(knot.id))!;
			// The new bend point sits ON the pre-existing curve.
			expect(deviationFrom(inserted.point, baseline), `fraction ${fraction}`).toBeLessThan(0.01);
			// …and the Wall's sampled shape and length are unchanged.
			const after = samplePointsOf(plan.document, 'wall-a');
			expect(worstDeviation(after, baseline), `fraction ${fraction}`).toBeLessThan(0.01);
			expect(worstDeviation(baseline, after), `fraction ${fraction}`).toBeLessThan(0.01);
			// The compiled length is the sampled polyline, re-sampled around the
			// new knot: it tracks the unchanged true arc to the sampler's tolerance.
			expect(wallLengthOf(plan.document, 'wall-a')).toBeCloseTo(total, 3);
		}
	});

	it('names a new bend point deterministically', () => {
		const document = curvedDocument();
		const first = expectSuccess(planInsertWallCurveKnot(document, 'wall-a', 4));
		expect(first).toEqual(planInsertWallCurveKnot(document, 'wall-a', 4));
		// The insert lands inside the first span, so its ID sorts after knot 1 and
		// the persisted order stays the arc order: 1, 3, 2.
		expect(chainViewOf(first.document, 'wall-a').knots.map((knot) => knot.id)).toEqual([
			'wall-a:knot:1',
			'wall-a:knot:3',
			'wall-a:knot:2'
		]);
	});

	it('rejects an insert that is out of range, on a straight Wall, or on a knot', () => {
		const document = curvedDocument();
		const total = wallLengthOf(document, 'wall-a');
		expect(planInsertWallCurveKnot(document, 'wall-a', 0)).toMatchObject({
			kind: 'rejected',
			rejection: { code: 'split_at_existing_endpoint' }
		});
		expect(planInsertWallCurveKnot(document, 'wall-a', total + 1)).toMatchObject({
			kind: 'rejected',
			rejection: { code: 'split_distance_out_of_range' }
		});
		// A straight Wall has no bend points to edit until it is converted.
		expect(planInsertWallCurveKnot(documentOf(), 'wall-a', 3)).toMatchObject({
			kind: 'rejected',
			rejection: { code: 'unsupported_geometry' }
		});
		expect(planInsertWallCurveKnot(document, 'wall-a', knotDistanceOf(document, 'wall-a:knot:1'))).toMatchObject({
			kind: 'rejected',
			rejection: { code: 'no_op' }
		});
	});

	it('moves exactly one bend point and leaves the far spans byte-identical', () => {
		const document = fourKnotDocument();
		const before = chainViewOf(document, 'wall-a');
		const plan = expectSuccess(planMoveWallCurveKnot(document, 'wall-a', 'wall-a:knot:1', [2.5, 3.5]));
		expect(plan.operation).toBe('wall-curve-knot-move');
		const after = chainViewOf(plan.document, 'wall-a');
		expect(after.knots.map((knot) => knot.id)).toEqual([
			'wall-a:knot:1',
			'wall-a:knot:2',
			'wall-a:knot:3'
		]);
		expect(after.knots[0]!.point).toEqual([2.5, 3.5]);
		// Every other bend point stays exactly where it was.
		expect(after.knots.slice(1).map((knot) => knot.point)).toEqual([
			[5, -1],
			[8, 1.5]
		]);
		// Only the spans around the grab are re-derived; a span two knots away
		// keeps its stored controls.
		expect(after.spans[0]).not.toEqual(before.spans[0]);
		expect(after.spans.at(-1)).toEqual(before.spans.at(-1));
	});

	it('rejects moving an unknown bend point or a no-op move', () => {
		const document = curvedDocument();
		expect(planMoveWallCurveKnot(document, 'wall-a', 'nope', [1, 1])).toMatchObject({
			kind: 'rejected',
			rejection: { code: 'unknown_curve_anchor' }
		});
		expect(planMoveWallCurveKnot(document, 'wall-a', 'wall-a:knot:1', [3, 2])).toMatchObject({
			kind: 'rejected',
			rejection: { code: 'no_op' }
		});
	});

	it('deletes a bend point by merging its two cubics, never by flattening', () => {
		const document = curvedDocument();
		const before = chainViewOf(document, 'wall-a');
		const plan = expectSuccess(planDeleteWallCurveKnot(document, 'wall-a', 'wall-a:knot:1'));
		const after = chainViewOf(plan.document, 'wall-a');
		expect(after.knots.map((knot) => knot.id)).toEqual(['wall-a:knot:2']);
		expect(after.spans).toHaveLength(2);
		// The surviving outer handles are kept verbatim; only the facing pair is
		// dropped, so the delete is a rule rather than a refit.
		expect(after.spans[0]).toEqual({
			handleOut: before.spans[0]!.handleOut,
			handleIn: before.spans[1]!.handleIn
		});
		expect(after.spans[1]).toEqual(before.spans[2]);
		// Deleting the LAST bend point leaves a knot-less chain — still a chain,
		// never collapsed to `line`.
		const last = expectSuccess(planDeleteWallCurveKnot(plan.document, 'wall-a', 'wall-a:knot:2'));
		const finalChain = wallOf(last.document, 'wall-a').centerline;
		expect(finalChain.kind).toBe('cubic-chain');
		if (finalChain.kind !== 'cubic-chain') return;
		expect(finalChain.knots).toEqual([]);
		expect(finalChain.spans).toHaveLength(1);
		expect(planDeleteWallCurveKnot(last.document, 'wall-a', 'wall-a:knot:2')).toMatchObject({
			kind: 'rejected',
			rejection: { code: 'unknown_curve_anchor' }
		});
	});

	it('is deterministic for repeated plan application', () => {
		const document = curvedDocument();
		expect(planMoveWallCurveKnot(document, 'wall-a', 'wall-a:knot:2', [7, -3])).toEqual(
			planMoveWallCurveKnot(document, 'wall-a', 'wall-a:knot:2', [7, -3])
		);
		expect(planDeleteWallCurveKnot(document, 'wall-a', 'wall-a:knot:2')).toEqual(
			planDeleteWallCurveKnot(document, 'wall-a', 'wall-a:knot:2')
		);
	});
});

// ---------------------------------------------------------------------------
// the Bend gesture planner
// ---------------------------------------------------------------------------

describe('P23.11 slice 5 — the composite Bend planner', () => {
	it('curves a straight Wall in one candidate, one operation', () => {
		const document = documentOf();
		const plan = expectSuccess(planBendWallCurveKnot(document, 'wall-a', { distance: 4, point: [4, 1.5] }));
		expect(plan.operation).toBe('wall-curve-knot-bend');
		const chain = wallOf(plan.document, 'wall-a').centerline;
		if (chain.kind !== 'cubic-chain') throw new Error('expected a chain');
		expect(chain.knots).toHaveLength(1);
		expect(chain.knots[0]!.id).toBe('wall-a:knot:1');
		expect(chain.knots[0]!.point).toEqual([4, 1.5]);
		// Endpoint positions stay Junction-owned and unmoved.
		expect(plan.document.junctions.find((junction) => junction.id === 'j-a')!.point).toEqual([0, 0]);
		expect(plan.document.junctions.find((junction) => junction.id === 'j-b')!.point).toEqual([CHORD, 0]);
		// One grab produced one candidate document, not a convert plus a move.
		expect(plan.changedWallIds).toEqual(['wall-a']);
	});

	it('is identity-preserving when the bend is released at the grabbed arc position', () => {
		const document = documentOf();
		const baseline = samplePointsOf(document, 'wall-a');
		const plan = expectSuccess(planBendWallCurveKnot(document, 'wall-a', { distance: 4, point: [4, 0] }));
		expect(worstDeviation(samplePointsOf(plan.document, 'wall-a'), baseline)).toBeLessThan(1e-9);
	});

	it('starts a straight Wall curve with a bend point at the requested arc distance', () => {
		const document = documentOf();
		// The knot is placed at the release point, so releasing exactly on the
		// Wall's own position at that distance leaves the curve straight and the
		// knot at that distance.
		const plan = expectSuccess(planBendWallCurveKnot(document, 'wall-a', { distance: 4, point: [4, 0] }));
		const chain = chainViewOf(plan.document, 'wall-a');
		// Placement is exact to the documented arc-length inversion tolerance:
		// the bisection resolves the straight chord's parameter to 1e-12, so the
		// knot lands on the requested distance rather than on a byte-equal one.
		expect(chain.knots[0]!.point[0]).toBeCloseTo(4, 9);
		expect(chain.knots[0]!.point[1]).toBeCloseTo(0, 9);
		const distance = wallCurveKnotArcDistance(chain, chain.knots[0]!.id);
		expect(distance).toBeCloseTo(4, 6);
	});

	it('inserts at the grabbed arc position on an already-curved Wall', () => {
		const document = curvedDocument();
		const before = chainViewOf(document, 'wall-a');
		const plan = expectSuccess(planBendWallCurveKnot(document, 'wall-a', { distance: 3, point: [2.2, 2.6] }));
		const after = chainViewOf(plan.document, 'wall-a');
		expect(after.knots).toHaveLength(3);
		// Pre-existing bend points keep their IDs and positions.
		expect(
			after.knots.filter((knot) => knot.id !== 'wall-a:knot:3').map((knot) => knot.point)
		).toEqual([
			[3, 2],
			[8, -1]
		]);
		// The new bend point sits where it was dragged.
		expect(after.knots.find((knot) => knot.id === 'wall-a:knot:3')!.point).toEqual([2.2, 2.6]);
		expect(after.spans[0]).not.toEqual(before.spans[0]);
	});

	it('drags an existing bend point instead of inserting a duplicate on top of it', () => {
		const document = curvedDocument();
		const plan = expectSuccess(
			planBendWallCurveKnot(document, 'wall-a', { distance: knotDistanceOf(document, 'wall-a:knot:2'), point: [8.5, -2] })
		);
		const chain = chainViewOf(plan.document, 'wall-a');
		expect(chain.knots.map((knot) => knot.id)).toEqual(['wall-a:knot:1', 'wall-a:knot:2']);
		expect(chain.knots[1]!.point).toEqual([8.5, -2]);
	});

	it('rejects a bend out of range or with a non-finite release point', () => {
		const document = curvedDocument();
		const total = wallLengthOf(document, 'wall-a');
		expect(planBendWallCurveKnot(document, 'wall-a', { distance: total + 2, point: [1, 1] })).toMatchObject({
			kind: 'rejected',
			rejection: { code: 'split_distance_out_of_range' }
		});
		expect(planBendWallCurveKnot(document, 'wall-a', { distance: Number.NaN, point: [1, 1] })).toMatchObject({
			kind: 'rejected',
			rejection: { code: 'invalid_value' }
		});
		expect(planBendWallCurveKnot(document, 'wall-a', { distance: 5, point: [Number.NaN, 1] })).toMatchObject({
			kind: 'rejected',
			rejection: { code: 'invalid_value' }
		});
	});
});

// ---------------------------------------------------------------------------
// curved split
// ---------------------------------------------------------------------------

describe('P23.11 slice 5 — exact curved-Wall split', () => {
	it('splits a curved Wall into two Walls whose sampled geometry is the original', () => {
		const document = curvedDocument();
		const baseline = samplePointsOf(document, 'wall-a');
		const baselineLength = wallLengthOf(document, 'wall-a');
		const plan = expectSuccess(planWallSplit(document, 'wall-a', baselineLength * 0.45, allocator()));
		const next = plan.document;
		// Identity rules: the original ID keeps `A → X`, the new ID carries
		// `X → B`, and one Junction is created at the resolved point.
		const first = wallOf(next, 'wall-a');
		const second = wallOf(next, plan.createdWallIds[0]!);
		expect(plan.createdWallIds).toEqual(['wall-a-b-1']);
		expect(first.endJunctionId).toBe(plan.junctionId);
		expect(second.startJunctionId).toBe(plan.junctionId);
		expect(second.endJunctionId).toBe('j-b');
		expect(second.role).toBe(first.role);
		expect(second.thickness).toBe(first.thickness);
		expect(second.height).toBe(first.height);
		expect(first.centerline.kind).toBe('cubic-chain');
		expect(second.centerline.kind).toBe('cubic-chain');
		if (first.centerline.kind !== 'cubic-chain' || second.centerline.kind !== 'cubic-chain') return;
		// Each fragment keeps its own side of the chain, and both stay cubic
		// chains rather than collapsing to `line`.
		expect(first.centerline.knots.map((knot) => knot.id)).toEqual(['wall-a:knot:1']);
		expect(second.centerline.knots.map((knot) => knot.id)).toEqual(['wall-a:knot:2']);
		// Exactness, first in canonical space: each fragment's true cubic arc
		// length is its own, and the two rejoin the pre-split chain exactly — a
		// flatten or an approximate refit could not do this.
		expect(
			wallCurveChainLength(chainViewOf(next, 'wall-a')) +
				wallCurveChainLength(chainViewOf(next, second.id))
		).toBeCloseTo(wallCurveChainLength(chainViewOf(document, 'wall-a')), 9);
		// Exactness in the read path: every sample of either fragment lies on the
		// original curve. The compiled length is a sampled polyline, so it
		// approximates the true arc within the canonical evaluator's flatness
		// tolerance (the wavy fixture is ~1.3e-3 short of its own true arc) — the
		// exact claim is the canonical one above.
		const worst = worstDeviation(
			[...samplePointsOf(next, 'wall-a'), ...samplePointsOf(next, second.id)],
			baseline
		);
		expect(worst).toBeLessThan(0.01);
		expect(wallLengthOf(next, 'wall-a') + wallLengthOf(next, second.id)).toBeCloseTo(baselineLength, 2);
		// The Junction sits on the original curve, not on the chord. `baseline` is
		// the pre-split sampled polyline, so "on the curve" reads at the
		// evaluator's flatness tolerance; the Junction point itself is the cubic's
		// own evaluated point (see `resolveWallCurveSplit`).
		const junction = next.junctions.find((candidate) => candidate.id === plan.junctionId)!;
		expect(deviationFrom(junction.point, baseline)).toBeLessThan(0.01);
		expect(Math.abs(junction.point[1])).toBeGreaterThan(0.5);
	});

	it('preserves Room identity and rewrites a forward ref as [W, W2]', () => {
		const document = curvedDocument({ withRoom: true });
		const plan = expectSuccess(planWallSplit(document, 'wall-a', 5, allocator()));
		const room = plan.document.rooms.find((candidate) => candidate.id === 'room-a')!;
		expect(room.boundary.map((ref) => ref.wallId)).toEqual([
			'wall-a',
			'wall-a-b-1',
			'wall-b',
			'wall-c',
			'wall-d'
		]);
		expect(room.boundary.every((ref) => ref.direction === 'forward')).toBe(true);
	});

	it('rewrites a reverse ref as [W2, W]', () => {
		const document = curvedDocument({ withRoom: true });
		document.rooms[0]!.boundary = [
			{ wallId: 'wall-c', direction: 'reverse' },
			{ wallId: 'wall-b', direction: 'reverse' },
			{ wallId: 'wall-a', direction: 'reverse' },
			{ wallId: 'wall-d', direction: 'reverse' }
		];
		const plan = expectSuccess(planWallSplit(document, 'wall-a', 5, allocator()));
		expect(plan.document.rooms[0]!.boundary.map((ref) => `${ref.wallId}:${ref.direction}`)).toEqual([
			'wall-c:reverse',
			'wall-b:reverse',
			'wall-a-b-1:reverse',
			'wall-a:reverse',
			'wall-d:reverse'
		]);
	});

	it('keeps Openings by identity and physical placement on either side of the cut', () => {
		const document = curvedDocument({
			openings: [
				{ id: 'near', offset: 1, width: 1 },
				{ id: 'far', offset: 8, width: 1.5 }
			]
		});
		const plan = expectSuccess(planWallSplit(document, 'wall-a', 5, allocator()));
		const near = plan.document.openings.find((opening) => opening.id === 'near')!;
		const far = plan.document.openings.find((opening) => opening.id === 'far')!;
		// The rebasing itself is exact canonical data: the moved Opening's own
		// offset is `8 − resolvedDistance`, and the resolved distance is the
		// requested one to the resolver's tolerance.
		expect(far.wallId).toBe('wall-a-b-1');
		expect(far.offset).toBeCloseTo(3, 9);
		expect(far.width).toBe(1.5);
		// The rebased Opening lands on the same physical point. Both readings come
		// from the compiled read path, whose center is interpolated along the
		// sampled polyline, so the placement is asserted at the canonical
		// evaluator's tolerance rather than at machine precision.
		const beforeAndAfter = [document, plan.document].map((target) => {
			const compiled = compileWallFirstLayoutGeometry(target);
			return compiled.geometry.walls.flatMap((wall) => wall.openings).find(
				(opening) => opening.openingId === 'far'
			)!.center.point;
		});
		expect(beforeAndAfter[1]![0]).toBeCloseTo(beforeAndAfter[0]![0], 2);
		expect(beforeAndAfter[1]![1]).toBeCloseTo(beforeAndAfter[0]![1], 2);
	});

	it('rejects a split that passes through an Opening interior', () => {
		const document = curvedDocument({ openings: [{ id: 'straddle', offset: 4, width: 2 }] });
		expect(planWallSplit(document, 'wall-a', 5, allocator())).toMatchObject({
			kind: 'rejected',
			rejection: { code: 'split_through_opening_interior' }
		});
		// An exact-edge split stays legal: the Opening remains on the retained
		// fragment when the cut meets its end.
		expect(planWallSplit(document, 'wall-a', 6, allocator()).kind).toBe('success');
	});

	it('promotes an existing bend point to the new Junction without moving the curve', () => {
		const document = curvedDocument();
		const baseline = samplePointsOf(document, 'wall-a');
		const plan = expectSuccess(
			planWallSplit(document, 'wall-a', knotDistanceOf(document, 'wall-a:knot:1'), allocator())
		);
		const junction = plan.document.junctions.find((candidate) => candidate.id === plan.junctionId)!;
		expect(junction.point).toEqual([3, 2]);
		const first = wallOf(plan.document, 'wall-a');
		const second = wallOf(plan.document, plan.createdWallIds[0]!);
		if (first.centerline.kind !== 'cubic-chain' || second.centerline.kind !== 'cubic-chain') {
			throw new Error('expected chains');
		}
		// The promoted bend point becomes Junction-owned: it is no fragment's
		// interior knot, and no near-zero span is created.
		expect(first.centerline.knots).toEqual([]);
		expect(first.centerline.spans).toHaveLength(1);
		expect(second.centerline.knots.map((knot) => knot.id)).toEqual(['wall-a:knot:2']);
		expect(second.centerline.spans).toHaveLength(2);
		expect(worstDeviation(samplePointsOf(plan.document, 'wall-a'), baseline)).toBeLessThan(0.01);
	});

	it('never mutates the baseline document', () => {
		const document = curvedDocument({ withRoom: true });
		const before = JSON.stringify(document);
		const plan = expectSuccess(planWallSplit(document, 'wall-a', 5, allocator()));
		// Planning is pure over the baseline, so Undo restores the exact
		// pre-split canonical data and a rejected attempt restores the exact
		// post-split data by construction.
		expect(JSON.stringify(document)).toBe(before);
		expect(JSON.stringify(plan.document)).not.toBe(before);
		// The split result itself is a complete, independently valid document.
		expect(plan.document.walls).toHaveLength(5);
		expect(plan.document.junctions).toHaveLength(5);
	});

	it('splits through Add Junction now that the planner accepts curves', () => {
		const document = curvedDocument();
		const plan = expectSuccess(planWallSubdivision(document, 'wall-a', 5, allocator()));
		expect(plan.operation).toBe('wall-subdivision');
		// Add Junction returns the P23.1 precision plan, which folds the created
		// fragment into `changedWallIds`; the fragment's own ID stays the
		// allocator's deterministic `X → B` name, read from the candidate.
		expect(plan.changedWallIds).toContain('wall-a-b-1');
		expect(plan.document.walls.some((wall) => wall.id === 'wall-a-b-1')).toBe(true);
		expect(wallOf(plan.document, 'wall-a').centerline.kind).toBe('cubic-chain');
	});

	it('rejects a crossing plan that would have to measure a curve in chords', () => {
		const document = curvedDocument();
		document.walls.push({
			id: 'wall-e',
			startJunctionId: 'j-d',
			endJunctionId: 'j-c',
			role: 'boundary',
			thickness: 0.2,
			height: 3,
			centerline: LINE
		});
		expect(planWallCrossing(document, ['wall-a', 'wall-e'], [5, 0], allocator())).toMatchObject({
			kind: 'rejected',
			rejection: { code: 'curved_wall_unsupported' }
		});
	});
});

// ---------------------------------------------------------------------------
// rigid movement
// ---------------------------------------------------------------------------

describe('P23.11 slice 5 — rigid movement carries the whole chain', () => {
	it('translates a curved Wall without changing its shape', () => {
		const document = curvedDocument();
		const before = chainViewOf(document, 'wall-a');
		const sampled = samplePointsOf(document, 'wall-a');
		const delta: LayoutVec2 = [2, -1.5];
		const plan = expectSuccess(planRigidWallMove(document, 'wall-a', delta));
		const after = chainViewOf(plan.document, 'wall-a');
		// Knots AND span controls receive the identical delta: moving a control
		// without its knot would change the shape.
		expect(after.knots.map((knot) => knot.point)).toEqual(
			before.knots.map((knot) => [knot.point[0] + delta[0], knot.point[1] + delta[1]])
		);
		expect(after.spans[0]).toEqual({
			handleOut: [
				before.spans[0]!.handleOut[0] + delta[0],
				before.spans[0]!.handleOut[1] + delta[1]
			],
			handleIn: [before.spans[0]!.handleIn[0] + delta[0], before.spans[0]!.handleIn[1] + delta[1]]
		});
		// Sampled geometry is the original translated exactly: same sample count
		// from the same cubics, each point shifted by the identical delta.
		const moved = samplePointsOf(plan.document, 'wall-a');
		expect(moved).toHaveLength(sampled.length);
		for (let index = 0; index < moved.length; index += 1) {
			expect(moved[index]![0] - sampled[index]![0]).toBeCloseTo(delta[0], 9);
			expect(moved[index]![1] - sampled[index]![1]).toBeCloseTo(delta[1], 9);
		}
		expect(wallLengthOf(plan.document, 'wall-a')).toBeCloseTo(wallLengthOf(document, 'wall-a'), 9);
	});

	it('keeps a rigid move of a straight Wall a line', () => {
		const document = documentOf();
		const plan = expectSuccess(planRigidWallMove(document, 'wall-a', [1, 0]));
		expect(wallOf(plan.document, 'wall-a').centerline).toEqual({ kind: 'line' });
	});

	it('keeps exact length and angle rejecting a curved Wall', () => {
		const document = curvedDocument();
		const length = wallLengthOf(document, 'wall-a');
		expect(planExactWallLength(document, 'wall-a', length + 1)).toMatchObject({
			kind: 'rejected',
			rejection: { code: 'curved_wall_unsupported' }
		});
		expect(planExactWallAngle(document, 'wall-a', 0.4)).toMatchObject({
			kind: 'rejected',
			rejection: { code: 'curved_wall_unsupported' }
		});
	});

	it('measures a curved chain length from the arc, not the chord', () => {
		const document = curvedDocument();
		const view = chainViewOf(document, 'wall-a');
		const arc = wallCurveChainLength(view);
		expect(arc).toBeGreaterThan(CHORD);
		// The compiled length is the sampled polyline of the same chain, so it
		// tracks the true arc to within the sampler's flatness tolerance.
		expect(wallLengthOf(document, 'wall-a')).toBeCloseTo(arc, 2);
	});
});
