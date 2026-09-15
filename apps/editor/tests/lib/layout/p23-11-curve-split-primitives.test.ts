/**
 * P23.11 Slice 4 — exact subdivision and chain-algebra primitives.
 *
 * Pure geometry, no planners and no history. The representation change exists
 * so this slice can be exact, so this is where "exact" is proven:
 *
 * - de Casteljau subdivision reproduces the original cubic point for point, so
 *   the two halves of a split are the same curve read twice;
 * - inserting a knot without moving it leaves the sampled centerline and every
 *   untouched span unchanged;
 * - one resolver owns arc-length inversion, so `spanIndex`, `t`, `point` and
 *   `distance` cannot disagree, and the fragment partitions it returns are the
 *   sole partition authority;
 * - a request landing on an existing knot promotes it instead of subdividing,
 *   and one landing on an endpoint Junction rejects;
 * - no primitive ever flattens a chain to `line` or refits it approximately.
 */
import { describe, expect, it } from 'vitest';

import {
	CURVE_ARC_LENGTH_TOLERANCE,
	cubicBezierArcLengthAt,
	cubicBezierPoint,
	deleteWallCurveKnot,
	deriveChainSpans,
	insertWallCurveKnot,
	resolveWallCurveSplit,
	resolveWallCurveSplitAtKnot,
	sampleSegment,
	subdivideWallCubicSpan,
	wallCurveChainCubics,
	wallCurveChainLength,
	wallCurveChainSatisfiesInvariant,
	wallCurveKnotArcDistance,
	wallCubicChain,
	type LayoutVec2,
	type LayoutWallCubicSpan,
	type LayoutWallCurveKnot,
	type WallCurveChain
} from '@portfolio/layout-core';

const LINE = { kind: 'line' } as const;

function knotsOf(...points: LayoutVec2[]): LayoutWallCurveKnot[] {
	return points.map((point, index) => ({
		id: `wall-a:knot:${index + 1}`,
		point: [point[0], point[1]] as LayoutVec2
	}));
}

function chainOf(start: LayoutVec2, end: LayoutVec2, ...interior: LayoutVec2[]): WallCurveChain {
	const points: LayoutVec2[] = [start, ...interior, end];
	return { startPoint: start, endPoint: end, knots: knotsOf(...interior), spans: deriveChainSpans(points) };
}

/** Convert an algebra chain back into the canonical centerline for sampling. */
function centerlineOf(chain: { knots: readonly LayoutWallCurveKnot[]; spans: readonly LayoutWallCubicSpan[] }) {
	return wallCubicChain(chain.knots, chain.spans);
}

function sampledPolyline(chain: WallCurveChain): LayoutVec2[] {
	const segment = {
		id: 'wall-a',
		kind: 'cubic-chain' as const,
		cubics: wallCurveChainCubics(chain)
	};
	return sampleSegment(segment).samples.map((sample) => [...sample.point] as LayoutVec2);
}

/** Distance from a point to the nearest segment of a polyline. */
function deviationFromPolyline(point: LayoutVec2, polyline: readonly LayoutVec2[]): number {
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

/**
 * Single-cubic chain: 6 m chord bowed to z = 3, no interior knot. A knot-less
 * chain is legal and is the shape a one-cubic fragment must keep, so the
 * primitives are exercised against it directly rather than through a knot.
 */
const ONE_SPAN: WallCurveChain = {
	startPoint: [0, 0],
	endPoint: [6, 0],
	knots: [],
	spans: [{ handleOut: [0, 3], handleIn: [6, 3] }]
};
/** Three-span chain: two knots, so splits exist in a first/middle/last span. */
const THREE_SPAN = chainOf([0, 0], [10, 0], [3, 2], [7, -2]);
/** Two short knots used for the promotion cases. */
const PROMOTABLE = chainOf([0, 0], [10, 0], [3, 1.5], [6.5, -1]);

const PARAMETER_GRID = [0, 0.05, 0.17, 0.25, 0.33, 0.5, 0.66, 0.75, 0.9, 0.99, 1];

describe('P23.11 slice 4 — de Casteljau subdivision is exact', () => {
	it('reproduces the original cubic point for point', () => {
		const cubics = wallCurveChainCubics(THREE_SPAN);
		for (const [spanIndex, cut] of [
			[0, 0.1],
			[1, 0.5],
			[2, 0.9]
		] as const) {
			const cubic = cubics[spanIndex]!;
			const { left, right, point } = subdivideWallCubicSpan(
				THREE_SPAN.spans[spanIndex]!,
				cubic.start,
				cubic.end,
				cut
			);
			// The split point is the curve at the cut parameter.
			const expected = cubicBezierPoint(cubic, cut);
			expect(point[0]).toBeCloseTo(expected[0], 12);
			expect(point[1]).toBeCloseTo(expected[1], 12);
			// Left half: `u` maps to the original parameter `u · t`.
			const leftCubic = {
				start: cubic.start,
				handleOut: left.handleOut,
				handleIn: left.handleIn,
				end: point
			};
			const rightCubic = {
				start: point,
				handleOut: right.handleOut,
				handleIn: right.handleIn,
				end: cubic.end
			};
			for (const u of PARAMETER_GRID) {
				const onLeft = cubicBezierPoint(leftCubic, u);
				const fromOriginalLeft = cubicBezierPoint(cubic, u * cut);
				expect(onLeft[0]).toBeCloseTo(fromOriginalLeft[0], 12);
				expect(onLeft[1]).toBeCloseTo(fromOriginalLeft[1], 12);
				const onRight = cubicBezierPoint(rightCubic, u);
				const fromOriginalRight = cubicBezierPoint(cubic, cut + u * (1 - cut));
				expect(onRight[0]).toBeCloseTo(fromOriginalRight[0], 12);
				expect(onRight[1]).toBeCloseTo(fromOriginalRight[1], 12);
			}
		}
	});

	it('leaves the halves jointed at the split point with a shared parameter', () => {
		const { left, right, point } = subdivideWallCubicSpan(
			ONE_SPAN.spans[0]!,
			ONE_SPAN.startPoint,
			ONE_SPAN.endPoint,
			0.4
		);
		expect(ONE_SPAN.knots).toEqual([]);
		const leftCubic = {
			start: ONE_SPAN.startPoint,
			handleOut: left.handleOut,
			handleIn: left.handleIn,
			end: point
		};
		const rightCubic = { start: point, handleOut: right.handleOut, handleIn: right.handleIn, end: ONE_SPAN.endPoint };
		expect(cubicBezierPoint(leftCubic, 1)).toEqual(cubicBezierPoint(rightCubic, 0));
		// Arc length partitions exactly: the halves sum to the original length.
		const original = wallCurveChainLength(ONE_SPAN);
		const leftLength = wallCurveChainLength({
			startPoint: ONE_SPAN.startPoint,
			endPoint: point,
			knots: [],
			spans: [left]
		});
		const rightLength = wallCurveChainLength({
			startPoint: point,
			endPoint: ONE_SPAN.endPoint,
			knots: [],
			spans: [right]
		});
		expect(leftLength + rightLength).toBeCloseTo(original, 9);
	});
});

describe('P23.11 slice 4 — the resolver is one split-distance authority', () => {
	it('returns span, parameter, point and distance that agree with each other', () => {
		const cubics = wallCurveChainCubics(THREE_SPAN);
		const total = wallCurveChainLength(THREE_SPAN);
		// Walk the resolved distance across the whole chain, hitting every span.
		for (const fraction of [0.03, 0.2, 0.35, 0.5, 0.62, 0.8, 0.97]) {
			const request = total * fraction;
			const resolution = resolveWallCurveSplit(THREE_SPAN, request);
			expect(resolution.kind, `fraction ${fraction}`).toBe('resolved');
			if (resolution.kind !== 'resolved') continue;
			const { result } = resolution;
			// The point IS the curve at (spanIndex, t).
			const onCurve = cubicBezierPoint(cubics[result.spanIndex]!, result.t);
			expect(result.point[0]).toBeCloseTo(onCurve[0], 12);
			expect(result.point[1]).toBeCloseTo(onCurve[1], 12);
			// …and `distance` IS the cumulative arc length at that point: the exact
			// knot distance of the span's start plus the span's own partial arc.
			const cumulative =
				result.spanIndex === 0
					? 0
					: wallCurveKnotArcDistance(THREE_SPAN, THREE_SPAN.knots[result.spanIndex - 1]!.id)!;
			const expected = cumulative + cubicBezierArcLengthAt(cubics[result.spanIndex]!, result.t);
			expect(result.distance).toBeCloseTo(expected, 9);
			// The fragments partition the resolved distance, and cover the chain.
			expect(result.fragments.a.length).toBeCloseTo(result.distance, 9);
			expect(result.fragments.b.length).toBeCloseTo(result.totalLength - result.distance, 9);
			expect(result.totalLength).toBeCloseTo(total, 9);
			expect(result.promotedKnotId).toBeUndefined();
		}
	});

	it('is deterministic: the same request resolves identically', () => {
		const first = resolveWallCurveSplit(THREE_SPAN, 4.321);
		const second = resolveWallCurveSplit(THREE_SPAN, 4.321);
		expect(first).toEqual(second);
	});

	it('rejects a distance outside the open interval', () => {
		const total = wallCurveChainLength(THREE_SPAN);
		for (const distance of [-1, total + 0.5, Number.NaN]) {
			const resolution = resolveWallCurveSplit(THREE_SPAN, distance);
			expect(resolution.kind, `distance ${distance}`).toBe('rejected');
			if (resolution.kind === 'rejected') {
				expect(resolution.code).toBe('split_out_of_range');
			}
		}
		// A distance exactly at either end is not a range error: it names an
		// existing endpoint, which the noding planner reports as the P23.8
		// `split_at_existing_endpoint` code.
		for (const distance of [0, total]) {
			const resolution = resolveWallCurveSplit(THREE_SPAN, distance);
			expect(resolution.kind, `distance ${distance}`).toBe('rejected');
			if (resolution.kind === 'rejected') {
				expect(resolution.code).toBe('split_at_endpoint');
			}
		}
	});

	it('rejects a request that resolves onto either endpoint Junction', () => {
		const total = wallCurveChainLength(THREE_SPAN);
		for (const distance of [1e-12, total - 1e-12]) {
			const resolution = resolveWallCurveSplit(THREE_SPAN, distance);
			expect(resolution.kind, `distance ${distance}`).toBe('rejected');
			if (resolution.kind === 'rejected') {
				expect(resolution.code).toBe('split_at_endpoint');
			}
		}
	});
});

describe('P23.11 slice 4 — knot promotion', () => {
	it('promotes an existing knot instead of subdividing it', () => {
		const total = wallCurveChainLength(PROMOTABLE);
		const knotDistance = wallCurveKnotArcDistance(PROMOTABLE, 'wall-a:knot:1')!;
		expect(knotDistance).toBeGreaterThan(0);
		expect(knotDistance).toBeLessThan(total);
		const resolution = resolveWallCurveSplit(PROMOTABLE, knotDistance);
		expect(resolution.kind).toBe('resolved');
		if (resolution.kind !== 'resolved') return;
		const { result } = resolution;
		expect(result.promotedKnotId).toBe('wall-a:knot:1');
		expect(result.point).toEqual([3, 1.5]);
		expect(result.distance).toBeCloseTo(knotDistance, 12);
		// The knot leaves both fragments' interior knot arrays.
		expect(result.fragments.a.knots).toEqual([]);
		expect(result.fragments.b.knots.map((knot) => knot.id)).toEqual(['wall-a:knot:2']);
		// Spans partition verbatim: no subdivision, no near-zero span.
		expect(result.fragments.a.spans).toEqual([PROMOTABLE.spans[0]]);
		expect(result.fragments.b.spans).toEqual([PROMOTABLE.spans[1], PROMOTABLE.spans[2]]);
		for (const fragment of [result.fragments.a, result.fragments.b]) {
			expect(wallCurveChainSatisfiesInvariant(fragment)).toBe(true);
		}
	});

	it('resolves a split at a named knot with no tolerance involved', () => {
		const byDistance = resolveWallCurveSplit(
			PROMOTABLE,
			wallCurveKnotArcDistance(PROMOTABLE, 'wall-a:knot:2')!
		);
		const byId = resolveWallCurveSplitAtKnot(PROMOTABLE, 'wall-a:knot:2');
		expect(byId).toEqual(byDistance);
		if (byId.kind === 'resolved') {
			expect(byId.result.promotedKnotId).toBe('wall-a:knot:2');
			expect(byId.result.point).toEqual([6.5, -1]);
		}
		expect(resolveWallCurveSplitAtKnot(PROMOTABLE, 'nope').kind).toBe('rejected');
	});

	it('leaves the geometry untouched across a promoted split', () => {
		const resolution = resolveWallCurveSplitAtKnot(PROMOTABLE, 'wall-a:knot:1');
		expect(resolution.kind).toBe('resolved');
		if (resolution.kind !== 'resolved') return;
		const { fragments } = resolution.result;
		// Reassembling the two partitions reproduces the original spans exactly.
		expect([...fragments.a.spans, ...fragments.b.spans]).toEqual([...PROMOTABLE.spans]);
		// A promoted knot is Junction-owned, so it is no fragment's interior knot.
		expect(fragments.a.knots.concat(fragments.b.knots).map((knot) => knot.id)).not.toContain(
			'wall-a:knot:1'
		);
	});
});

describe('P23.11 slice 4 — insertion is identity-preserving', () => {
	it('inserts a knot without moving the sampled centerline', () => {
		const baseline = sampledPolyline(THREE_SPAN);
		const baselineLength = wallCurveChainLength(THREE_SPAN);
		const total = baselineLength;
		for (const fraction of [0.05, 0.2, 0.34, 0.5, 0.66, 0.8, 0.95]) {
			const insertion = insertWallCurveKnot(THREE_SPAN, total * fraction, 'new-knot');
			expect(insertion.kind, `fraction ${fraction}`).toBe('inserted');
			if (insertion.kind !== 'inserted') continue;
			const chain: WallCurveChain = {
				startPoint: THREE_SPAN.startPoint,
				endPoint: THREE_SPAN.endPoint,
				knots: insertion.knots,
				spans: insertion.spans
			};
			expect(wallCurveChainSatisfiesInvariant(chain)).toBe(true);
			expect(chain.knots).toHaveLength(THREE_SPAN.knots.length + 1);
			// Length is unchanged to the arc-length tolerance.
			expect(wallCurveChainLength(chain)).toBeCloseTo(baselineLength, 6);
			// Every sample still lies on the baseline curve, within the sampler's
			// own flatness tolerance (the samples themselves are re-placed).
			const after = sampledPolyline(chain);
			const worst = Math.max(...after.map((point) => deviationFromPolyline(point, baseline)));
			expect(worst, `fraction ${fraction}`).toBeLessThan(0.01);
			const worstBack = Math.max(...baseline.map((point) => deviationFromPolyline(point, after)));
			expect(worstBack, `fraction ${fraction}`).toBeLessThan(0.01);
		}
	});

	it('touches only the span it cuts', () => {
		const insertion = insertWallCurveKnot(THREE_SPAN, wallCurveChainLength(THREE_SPAN) * 0.5, 'new-knot');
		expect(insertion.kind).toBe('inserted');
		if (insertion.kind !== 'inserted') return;
		const { fragments } = insertion.resolution;
		// Middle-span split: the outer spans are byte-identical copies.
		expect(fragments.a.spans[0]).toEqual(THREE_SPAN.spans[0]);
		expect(fragments.b.spans.at(-1)).toEqual(THREE_SPAN.spans[2]);
		expect(fragments.b.spans[0]).not.toEqual(THREE_SPAN.spans[1]);
	});

	it('rejects inserting a second knot at an existing knot position', () => {
		const knotDistance = wallCurveKnotArcDistance(PROMOTABLE, 'wall-a:knot:1')!;
		const insertion = insertWallCurveKnot(PROMOTABLE, knotDistance, 'duplicate');
		expect(insertion.kind).toBe('rejected');
		if (insertion.kind === 'rejected') expect(insertion.code).toBe('knot_already_exists');
	});

	it('is deterministic for repeated insertion', () => {
		const first = insertWallCurveKnot(THREE_SPAN, 3.75, 'n1');
		const second = insertWallCurveKnot(THREE_SPAN, 3.75, 'n1');
		expect(first).toEqual(second);
	});
});

describe('P23.11 slice 4 — chain invariants and deletion', () => {
	it('keeps a knot-less fragment a real cubic rather than collapsing to line', () => {
		const total = wallCurveChainLength(THREE_SPAN);
		// Inside the first span, then inside the last span.
		for (const fraction of [0.05, 0.95]) {
			const resolution = resolveWallCurveSplit(THREE_SPAN, total * fraction);
			expect(resolution.kind).toBe('resolved');
			if (resolution.kind !== 'resolved') continue;
			const knotless = fraction < 0.5 ? resolution.result.fragments.a : resolution.result.fragments.b;
			expect(knotless.knots).toEqual([]);
			expect(knotless.spans).toHaveLength(1);
			expect(wallCurveChainSatisfiesInvariant(knotless)).toBe(true);
			// A single cubic, not a `line` centerline: the fragment keeps a
			// handle pair and its own curvature.
			expect(knotless.spans[0]!.handleOut).not.toEqual(knotless.spans[0]!.handleIn);
			expect(LINE.kind).toBe('line');
			expect(centerlineOf(knotless).kind).toBe('cubic-chain');
		}
	});

	it('preserves the invariant through every primitive', () => {
		const total = wallCurveChainLength(THREE_SPAN);
		for (const fraction of [0.1, 0.3, 0.5, 0.7, 0.9]) {
			const resolution = resolveWallCurveSplit(THREE_SPAN, total * fraction);
			if (resolution.kind !== 'resolved') throw new Error('expected a resolved split');
			expect(wallCurveChainSatisfiesInvariant(resolution.result.fragments.a)).toBe(true);
			expect(wallCurveChainSatisfiesInvariant(resolution.result.fragments.b)).toBe(true);
			const insertion = insertWallCurveKnot(THREE_SPAN, total * fraction, `k-${fraction}`);
			if (insertion.kind !== 'inserted') throw new Error('expected an insertion');
			expect(wallCurveChainSatisfiesInvariant(insertion)).toBe(true);
		}
		for (const knotId of THREE_SPAN.knots.map((knot) => knot.id)) {
			const deletion = deleteWallCurveKnot(THREE_SPAN, knotId);
			if (deletion.kind !== 'deleted') throw new Error('expected a deletion');
			expect(wallCurveChainSatisfiesInvariant(deletion)).toBe(true);
		}
	});

	it('merges on deletion without refitting or flattening', () => {
		const deletion = deleteWallCurveKnot(THREE_SPAN, 'wall-a:knot:1');
		expect(deletion.kind).toBe('deleted');
		if (deletion.kind !== 'deleted') return;
		expect(deletion.knots.map((knot) => knot.id)).toEqual(['wall-a:knot:2']);
		expect(deletion.spans).toHaveLength(2);
		// The merged span keeps the surviving outer handles verbatim.
		expect(deletion.spans[0]).toEqual({
			handleOut: THREE_SPAN.spans[0]!.handleOut,
			handleIn: THREE_SPAN.spans[1]!.handleIn
		});
		expect(deletion.spans[1]).toEqual(THREE_SPAN.spans[2]);
		// Deleting the last knot leaves a knot-less chain, still a cubic chain.
		const last = deleteWallCurveKnot(THREE_SPAN, 'wall-a:knot:2');
		if (last.kind !== 'deleted') throw new Error('expected a deletion');
		expect(last.knots).toHaveLength(1);
		expect(last.spans).toHaveLength(2);
		expect(deleteWallCurveKnot(THREE_SPAN, 'missing').kind).toBe('rejected');
	});

	it('is deterministic for repeated deletion', () => {
		const first = deleteWallCurveKnot(THREE_SPAN, 'wall-a:knot:2');
		const second = deleteWallCurveKnot(THREE_SPAN, 'wall-a:knot:2');
		expect(first).toEqual(second);
	});

	it('survives a full insert → split → delete round trip on one chain', () => {
		const total = wallCurveChainLength(THREE_SPAN);
		const insertion = insertWallCurveKnot(THREE_SPAN, total * 0.4, 'k-new');
		if (insertion.kind !== 'inserted') throw new Error('expected an insertion');
		const grown: WallCurveChain = {
			startPoint: THREE_SPAN.startPoint,
			endPoint: THREE_SPAN.endPoint,
			knots: insertion.knots,
			spans: insertion.spans
		};
		const grownLength = wallCurveChainLength(grown);
		const resolution = resolveWallCurveSplit(grown, grownLength * 0.75);
		if (resolution.kind !== 'resolved') throw new Error('expected a resolved split');
		expect(wallCurveChainSatisfiesInvariant(resolution.result.fragments.a)).toBe(true);
		expect(wallCurveChainSatisfiesInvariant(resolution.result.fragments.b)).toBe(true);
		// Removing the knot we added returns the original span count. The merge is
		// the sanctioned knot-delete rule — outer handles kept, inner pair dropped
		// and no refit — so the shape comes back close rather than byte-identical:
		// de Casteljau splits one cubic into two and the merge cannot recover the
		// pair it discarded.
		const restored = deleteWallCurveKnot(grown, 'k-new');
		if (restored.kind !== 'deleted') throw new Error('expected a deletion');
		expect(restored.spans).toHaveLength(THREE_SPAN.spans.length);
		const restoredChain: WallCurveChain = {
			startPoint: THREE_SPAN.startPoint,
			endPoint: THREE_SPAN.endPoint,
			knots: restored.knots,
			spans: restored.spans
		};
		expect(Math.abs(wallCurveChainLength(restoredChain) - total)).toBeLessThan(0.35);
		const baseline = sampledPolyline(THREE_SPAN);
		const worst = Math.max(
			...sampledPolyline(restoredChain).map((point) => deviationFromPolyline(point, baseline))
		);
		expect(worst).toBeLessThan(0.25);
		expect(CURVE_ARC_LENGTH_TOLERANCE).toBeGreaterThan(0);
	});
});
