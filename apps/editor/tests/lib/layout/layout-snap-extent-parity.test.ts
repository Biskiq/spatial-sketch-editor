import { describe, expect, it } from 'vitest';
import { P2311_FIXTURES, p2311Fixture } from '$lib/bench/p2311-bend-fixtures';
import {
	compileWallFirstLayoutGeometry,
	dedupeWallSpans,
	geometryId,
	pickSnapWinner,
	resolveLayoutSnap,
	snapOwnerKey,
	spanSnapCandidates,
	type CompiledLayoutGeometry,
	type CompiledQuerySpan,
	type LayoutVec2,
	type MergedWallSpan,
	type SnapFeatureKind,
	type SnapInputContext,
	type SnapQueryContext,
	wallSnapIndex
} from '@portfolio/layout-core';

/**
 * P23.11 live Snap gate — the Wall extent merge was made O(k) and memoized per
 * compiled geometry because `dedupeWallSpans`'s all-pairs farthest-endpoint scan
 * was the dominant cost of a Bend pointermove on the real 10 Room / 40 Wall
 * document (91.7 ms proxied vs 3.4 ms raw for the same geometry).
 *
 * These tests pin the equivalence, not the speed:
 *
 * - the merge output is byte-identical to the pre-optimization implementation
 *   (`referenceDedupeWallSpans`, copied verbatim below) across every shape the
 *   resolver can meet — slopes, frames, curvature, shuffles, duplicates and
 *   hand-built spans — plus a seeded differential sweep;
 * - `resolveLayoutSnap` resolves identically against the reference merge output,
 *   compared candidate-for-candidate (`kind`, `point`, `sourceId`, `ownerId`,
 *   `wallId`, distance, guides);
 * - the O(k²) scan is gone by construction: a proxy read-count guard proves the
 *   optimized merge touches each endpoint a bounded number of times while the
 *   reference implementation still reads a quadratic number of times.
 */

// ---------------------------------------------------------------------------
// the pre-optimization implementation, verbatim
// ---------------------------------------------------------------------------

/**
 * The shipped implementation before this pass: farthest true endpoint pair over
 * every span endpoint, ties broken lexicographically. Kept verbatim as the
 * reference the optimized path must reproduce.
 */
function referenceDedupeWallSpans(spans: readonly CompiledQuerySpan[]): MergedWallSpan[] {
	const byWall = new Map<string, CompiledQuerySpan[]>();
	for (const span of spans) {
		const key = span.wallKey ?? span.segmentId;
		const list = byWall.get(key) ?? [];
		list.push(span);
		byWall.set(key, list);
	}
	const merged: MergedWallSpan[] = [];
	for (const [key, list] of byWall) {
		const segmentId = list[0]!.segmentId;
		const points: LayoutVec2[] = [];
		for (const span of list) {
			points.push(span.start, span.end);
		}
		let best: [LayoutVec2, LayoutVec2] = [points[0]!, points[1] ?? points[0]!];
		let bestSquared = -1;
		for (let first = 0; first < points.length; first += 1) {
			for (let second = first + 1; second < points.length; second += 1) {
				const a = points[first]!;
				const b = points[second]!;
				const dx = a[0] - b[0];
				const dz = a[1] - b[1];
				const squared = dx * dx + dz * dz;
				if (
					squared > bestSquared ||
					(squared === bestSquared && referenceLexicographicallySmaller(a, b, best[0], best[1]))
				) {
					bestSquared = squared;
					best = [a, b];
				}
			}
		}
		const chordX = best[1][0] - best[0][0];
		const chordZ = best[1][1] - best[0][1];
		const chordLength = Math.hypot(chordX, chordZ);
		const tolerance = Math.max(1e-12, chordLength * chordLength * 1e-6);
		const straight = points.every(
			([x, z]) => Math.abs(chordX * (z - best[0][1]) - chordZ * (x - best[0][0])) <= tolerance
		);
		const ordered = referenceLexicographicallySmaller(best[0], best[1], best[1], best[0])
			? [best[0], best[1]]
			: [best[1], best[0]];
		merged.push({
			key,
			segmentId,
			start: [...ordered[0]],
			end: [...ordered[1]],
			straight,
			samples: list
		});
	}
	return merged;
}

function referenceLexicographicallySmaller(a: LayoutVec2, b: LayoutVec2, c: LayoutVec2, d: LayoutVec2): boolean {
	if (a[0] !== c[0]) return a[0] < c[0];
	if (a[1] !== c[1]) return a[1] < c[1];
	if (b[0] !== d[0]) return b[0] < d[0];
	return b[1] < d[1];
}

// ---------------------------------------------------------------------------
// span builders
// ---------------------------------------------------------------------------

type Frame = {
	/** Owning Room of this traversal; omitted for a roomless physical Wall. */
	roomId?: string;
	floorId?: string;
	/** Collision-safe grouping key; defaults to a document-global `segmentId`. */
	wallKey?: string;
	/** Walk the points in reverse, as a room boundary that traverses backwards does. */
	reverse?: boolean;
	/**
	 * `frame` (default) measures distances cumulatively from this frame's own
	 * start. `placeholder` mimics hand-built spans whose distances carry no
	 * traversal information (every span starting at 0) — the case that must fall
	 * back to the exact scan instead of trusting the metadata.
	 */
	distances?: 'frame' | 'placeholder';
};

/** Consecutive sample spans of one wall along one traversal frame. */
function chain(segmentId: string, points: LayoutVec2[], frame: Frame = {}): CompiledQuerySpan[] {
	const ordered = frame.reverse ? [...points].reverse() : points;
	const spans: CompiledQuerySpan[] = [];
	let walked = 0;
	for (let index = 1; index < ordered.length; index += 1) {
		const start = ordered[index - 1]!;
		const end = ordered[index]!;
		const length = Math.hypot(end[0] - start[0], end[1] - start[1]);
		const startDistance = frame.distances === 'placeholder' ? 0 : walked;
		const endDistance = frame.distances === 'placeholder' ? length : walked + length;
		walked += length;
		spans.push(
			record(segmentId, start, end, startDistance, endDistance, {
				roomId: frame.roomId,
				floorId: frame.floorId ?? 'f',
				wallKey: frame.wallKey ?? segmentId
			})
		);
	}
	return spans;
}

function record(
	segmentId: string,
	start: LayoutVec2,
	end: LayoutVec2,
	startDistance: number,
	endDistance: number,
	identity: { roomId?: string; floorId: string; wallKey: string }
): CompiledQuerySpan {
	const id = `s:${identity.wallKey}:${identity.roomId ?? ''}:${startDistance}`;
	return {
		id,
		cacheKey: id,
		kind: 'wall',
		start,
		end,
		startDistance,
		endDistance,
		aabb: {
			min: [Math.min(start[0], end[0]), Math.min(start[1], end[1])],
			max: [Math.max(start[0], end[0]), Math.max(start[1], end[1])]
		},
		sourceId: segmentId,
		floorId: identity.floorId,
		...(identity.roomId ? { roomId: identity.roomId } : {}),
		segmentId,
		wallKey: identity.wallKey
	};
}

/** Evenly sampled points of a straight run, so a wall compiles like the real one. */
function sampled(a: LayoutVec2, b: LayoutVec2, steps: number): LayoutVec2[] {
	const points: LayoutVec2[] = [];
	for (let index = 0; index <= steps; index += 1) {
		const t = index / steps;
		points.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
	}
	return points;
}

/** A quadratic arc bowed by `bow` metres at its midpoint. */
function bowed(a: LayoutVec2, b: LayoutVec2, steps: number, bow: number): LayoutVec2[] {
	const mid: LayoutVec2 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
	const dx = b[0] - a[0];
	const dz = b[1] - a[1];
	const length = Math.hypot(dx, dz);
	const normal: LayoutVec2 = [-dz / length, dx / length];
	const points: LayoutVec2[] = [];
	for (let index = 0; index <= steps; index += 1) {
		const t = index / steps;
		const offset = 4 * bow * t * (1 - t);
		points.push([
			a[0] + dx * t + normal[0] * offset,
			a[1] + dz * t + normal[1] * offset
		]);
	}
	return points;
}

function geometryOf(spans: CompiledQuerySpan[], points: CompiledLayoutGeometry['queries']['points'] = []): CompiledLayoutGeometry {
	return {
		floors: [],
		rooms: [],
		walls: [],
		objects: [],
		queries: { points, spans, polygons: [], aabbs: [] },
		bounds: null
	};
}

function mergedSummary(merged: readonly MergedWallSpan[]): unknown {
	return merged.map((merge) => ({
		key: merge.key,
		segmentId: merge.segmentId,
		start: merge.start,
		end: merge.end,
		straight: merge.straight,
		samples: merge.samples
	}));
}

/** Assert the optimized merge reproduces the reference output exactly. */
function expectMergeParity(spans: readonly CompiledQuerySpan[]): void {
	const optimized = dedupeWallSpans(spans);
	const reference = referenceDedupeWallSpans(spans);
	expect(mergedSummary(optimized)).toEqual(mergedSummary(reference));
	// The per-sample spans themselves are the nearest-point candidate source for
	// curved walls, so the sample sets must be the same records, not just equal.
	expect(optimized.map((merge) => merge.samples.map((span) => span.id))).toEqual(
		reference.map((merge) => merge.samples.map((span) => span.id))
	);
}

// ---------------------------------------------------------------------------
// case matrix
// ---------------------------------------------------------------------------

type SnapCase = {
	id: string;
	spans: CompiledQuerySpan[];
	/** Probe points exercised for this case. */
	probes: LayoutVec2[];
	description: string;
};

const HORIZONTAL = sampled([0, 0], [12, 0], 24);
const VERTICAL = sampled([0, 0], [0, 9], 18);
/** Authored (0,4) → (4,0): a bounding-box merge would fabricate the anti-diagonal. */
const NEGATIVE_SLOPE = sampled([0, 4], [4, 0], 8);
const ARC = bowed([0, 0], [10, 0], 24, 1.5);
/** Below the relative tolerance (chord 10 m ⇒ 1e-4 m² cross floor): still straight. */
const SHALLOW_INSIDE = bowed([0, 0], [10, 0], 24, 5e-6);
/** Above it: curved, and must keep per-sample nearest-point snapping. */
const SHALLOW_OUTSIDE = bowed([0, 0], [10, 0], 24, 5e-4);

function cases(): SnapCase[] {
	const sharedKey = 'w-shared';
	const sharedPhysical = chain(sharedKey, sampled([0, 0], [12, 0], 12), {});
	const sharedForward = chain(sharedKey, sampled([0, 0], [12, 0], 12), { roomId: 'room-a' });
	const sharedReversed = chain(sharedKey, sampled([0, 0], [12, 0], 12), { roomId: 'room-b', reverse: true });
	const legacyKey = geometryId(['f', 'room-a', 'wall-1']);

	return [
		{
			id: 'straight-horizontal',
			description: 'straight horizontal wall, physical record plus one room frame',
			spans: [...chain('w0', HORIZONTAL, {}), ...chain('w0', HORIZONTAL, { roomId: 'room-a' })],
			probes: [[6, 0], [6, 0.3], [0, 0], [11.9, 0], [6, 0.02], [40, 40]]
		},
		{
			id: 'straight-vertical',
			description: 'straight vertical wall — the same merge with the axes swapped',
			spans: [...chain('w0', VERTICAL, {}), ...chain('w0', VERTICAL, { roomId: 'room-a' })],
			probes: [[0, 4.5], [0.3, 4.5], [0, 0], [0, 9], [0, 4.505], [40, 40]]
		},
		{
			id: 'negative-slope',
			description: 'negative-slope wall keeps its true endpoint pair, never the box diagonal',
			spans: chain('diag', NEGATIVE_SLOPE, {}),
			probes: [[2, 2], [2.2, 2], [0, 4], [4, 0], [4, 4], [40, 40]]
		},
		{
			id: 'reversed-traversal',
			description: 'one frame walks the wall backwards, so distances are measured from its own start',
			spans: [...chain('w0', HORIZONTAL, {}), ...chain('w0', HORIZONTAL, { roomId: 'room-b', reverse: true })],
			probes: [[6, 0], [0, 0], [12, 0], [6, 0.3], [40, 40]]
		},
		{
			id: 'shared-wall-multiple-rooms',
			description: 'shared wall emitted by two Rooms plus the physical record',
			spans: [...sharedPhysical, ...sharedForward, ...sharedReversed],
			probes: [[6, 0], [3, 0], [6, 0.3], [12, 0], [40, 40]]
		},
		{
			id: 'shuffled-span-order',
			description: 'query-span order is never a hidden input',
			spans: [
				...sharedReversed.slice(4),
				...sharedPhysical.slice(2),
				...sharedForward,
				...sharedPhysical.slice(0, 2),
				...sharedReversed.slice(0, 4)
			],
			probes: [[6, 0], [6, 0.3], [12, 0], [40, 40]]
		},
		{
			id: 'curved-wall',
			description: 'curved wall keeps per-sample spans and nearest-point snapping',
			spans: [...chain('arc', ARC, {}), ...chain('arc', ARC, { roomId: 'room-a' })],
			probes: [[5, 1.5], [5, 1.8], [0, 0], [10, 0], [5, 0], [40, 40]]
		},
		{
			id: 'shallow-curve-inside-tolerance',
			description: 'a bow below the straightness tolerance still merges straight',
			spans: chain('w0', SHALLOW_INSIDE, {}),
			probes: [[5, 0], [5, 0.3], [0, 0], [10, 0], [40, 40]]
		},
		{
			id: 'shallow-curve-outside-tolerance',
			description: 'a bow above the tolerance stays curved',
			spans: chain('w0', SHALLOW_OUTSIDE, {}),
			probes: [[5, 0], [5, 5e-4], [5, 0.3], [0, 0], [10, 0], [40, 40]]
		},
		{
			id: 'duplicate-spans',
			description: 'the same span repeated — duplicates never change the extent or the winner',
			spans: [...chain('w0', HORIZONTAL, {}), ...chain('w0', HORIZONTAL, { roomId: 'room-a' })].concat(
				chain('w0', HORIZONTAL, { roomId: 'room-a' })
			),
			probes: [[6, 0], [6, 0.3], [12, 0], [40, 40]]
		},
		{
			id: 'roomless-wall',
			description: 'a physical Wall that bounds no Room has no roomId at all',
			spans: chain('w-roomless', sampled([2, 2], [14, 2], 12), {}),
			probes: [[8, 2], [8, 2.3], [2, 2], [14, 2], [40, 40]]
		},
		{
			id: 'legacy-room-qualified',
			description: 'legacy segments group by the length-prefixed room-qualified wallKey',
			spans: [
				...chain('wall-1', sampled([0, 0], [8, 0], 8), { roomId: 'room-a', wallKey: legacyKey }),
				...chain('wall-1', sampled([20, 0], [28, 0], 8), {
					roomId: 'room-b',
					wallKey: geometryId(['f', 'room-b', 'wall-1'])
				})
			],
			probes: [[4, 0], [24, 0], [4, 0.3], [40, 40]]
		},
		{
			id: 'placeholder-distances',
			description: 'hand-built spans without a proven traversal fall back to the exact scan',
			spans: chain('w0', sampled([0, 0], [10, 0], 10), { distances: 'placeholder' }),
			probes: [[5, 0], [5, 0.3], [0, 0], [10, 0], [40, 40]]
		},
		{
			id: 'partial-frames',
			description: 'one frame covers only part of the wall; the union still spans the whole wall',
			spans: [
				...chain('w0', HORIZONTAL, {}),
				...chain('w0', sampled([4, 0], [12, 0], 8), { roomId: 'room-a' })
			],
			probes: [[6, 0], [6, 0.3], [12, 0], [40, 40]]
		}
	];
}

describe('P23.11 — Wall extent merge is equivalent to the pre-optimization scan', () => {
	for (const spec of cases()) {
		it(`merges ${spec.id} identically (${spec.description})`, () => {
			expectMergeParity(spec.spans);
		});
	}

	it('never merges same-named legacy segments of different rooms into one wall', () => {
		const legacy = cases().find((spec) => spec.id === 'legacy-room-qualified')!;
		const merged = dedupeWallSpans(legacy.spans);
		expect(merged).toHaveLength(2);
		expectMergeParity(legacy.spans);
	});

	it('keeps a curved wall curved and a shallow bow inside tolerance straight', () => {
		const curved = dedupeWallSpans(cases().find((spec) => spec.id === 'curved-wall')!.spans);
		expect(curved[0]!.straight).toBe(false);
		const inside = dedupeWallSpans(cases().find((spec) => spec.id === 'shallow-curve-inside-tolerance')!.spans);
		expect(inside[0]!.straight).toBe(true);
		const outside = dedupeWallSpans(cases().find((spec) => spec.id === 'shallow-curve-outside-tolerance')!.spans);
		expect(outside[0]!.straight).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// resolution parity: optimized geometry vs the same geometry shaped by the
// reference merge
// ---------------------------------------------------------------------------

/**
 * Re-shape a geometry so its Wall candidates come from the **reference** merge
 * output: every wall the reference merged straight is replaced (in first-seen
 * order) by one span carrying that exact chord, and curved walls keep their
 * spans verbatim. Resolving against this geometry is resolving against the
 * reference implementation's view of the document, so equality of the two
 * resolutions is equality of candidate identity and winner — nothing about the
 * comparison depends on this pass's code.
 */
function referenceShapedGeometry(geometry: CompiledLayoutGeometry): CompiledLayoutGeometry {
	const wallSpans = geometry.queries.spans.filter((span) => span.kind === 'wall');
	const reference = new Map(referenceDedupeWallSpans(wallSpans).map((merge) => [merge.key, merge]));
	const seen = new Set<string>();
	const spans: CompiledQuerySpan[] = [];
	for (const span of geometry.queries.spans) {
		if (span.kind !== 'wall') {
			spans.push(span);
			continue;
		}
		const key = span.wallKey ?? span.segmentId;
		const merge = reference.get(key)!;
		if (!merge.straight) {
			spans.push(span);
			continue;
		}
		if (seen.has(key)) continue;
		seen.add(key);
		const chord = Math.hypot(merge.end[0] - merge.start[0], merge.end[1] - merge.start[1]);
		spans.push({
			...span,
			id: `reference:${key}`,
			cacheKey: `reference:${key}`,
			start: [...merge.start],
			end: [...merge.end],
			startDistance: 0,
			endDistance: chord,
			aabb: {
				min: [Math.min(merge.start[0], merge.end[0]), Math.min(merge.start[1], merge.end[1])],
				max: [Math.max(merge.start[0], merge.end[0]), Math.max(merge.start[1], merge.end[1])]
			}
		});
	}
	return { ...geometry, queries: { ...geometry.queries, spans } };
}

const CONTEXTS: SnapQueryContext[] = [
	{ pixelsPerMeter: 0.5, gridStep: 0.25 },
	{ pixelsPerMeter: 2.4, gridStep: 0.25 },
	{ pixelsPerMeter: 32, gridStep: 0.25 }
];

const ALLOWED_KIND_SETS: (readonly SnapFeatureKind[] | undefined)[] = [
	undefined,
	['wall-span', 'wall-midpoint', 'junction'],
	['wall-span'],
	['wall-midpoint'],
	['junction'],
	['wall-intersection', 'grid']
];

function exclusionSets(spans: readonly CompiledQuerySpan[]): SnapInputContext[] {
	const keys = [...new Set(spans.map((span) => span.wallKey ?? span.segmentId))];
	return [
		{},
		{ excludeOwners: new Set(keys.map((key) => snapOwnerKey({ kind: 'wall', id: key }))) },
		{ excludePoints: spans.map((span) => span.start) },
		{ excludeOwners: new Set(keys.slice(0, 1).map((key) => snapOwnerKey({ kind: 'wall', id: key }))), excludePoints: spans.map((span) => span.end) }
	];
}

describe('P23.11 — resolveLayoutSnap resolves identically against the reference merge', () => {
	for (const spec of cases()) {
		it(`resolves ${spec.id} identically across radii, families and exclusions`, () => {
			const geometry = geometryOf(spec.spans);
			const reference = referenceShapedGeometry(geometry);
			const exclusions = exclusionSets(spec.spans);
			let compared = 0;
			for (const context of CONTEXTS) {
				for (const allowedKinds of ALLOWED_KIND_SETS) {
					for (const input of exclusions) {
						const options: SnapInputContext = { ...input };
						if (allowedKinds) options.allowedKinds = [...allowedKinds];
						for (const probe of spec.probes) {
							expect(resolveLayoutSnap(geometry, probe, context, options)).toEqual(
								resolveLayoutSnap(reference, probe, context, options)
							);
							compared += 1;
						}
					}
				}
			}
			expect(compared).toBeGreaterThan(100);
		});
	}
});

describe('P23.11 — snap semantics the merge feeds', () => {
	const geometry = geometryOf(cases().find((spec) => spec.id === 'shared-wall-multiple-rooms')!.spans);
	const reference = referenceShapedGeometry(geometry);
	const context: SnapQueryContext = { pixelsPerMeter: 2.4, gridStep: 0.25 };

	it('picks the same wall-span candidate, with the same stable identity', () => {
		const resolved = resolveLayoutSnap(geometry, [6, 0.2], context, { allowedKinds: ['wall-span'] });
		const expected = resolveLayoutSnap(reference, [6, 0.2], context, { allowedKinds: ['wall-span'] });
		expect(resolved).toEqual(expected);
		expect(resolved.kind).toBe('snap');
		if (resolved.kind !== 'snap') return;
		expect(resolved.candidate.kind).toBe('wall-span');
		expect(resolved.candidate.ownerId).toBe(snapOwnerKey({ kind: 'wall', id: 'w-shared' }));
		expect(resolved.candidate.wallId).toBe('w-shared');
		expect(resolved.candidate.point).toEqual([6, 0]);
	});

	it('picks the same midpoint candidate identity', () => {
		// 0.1 m off the wall's 6 m midpoint at 2.4 px/m keeps every outer feature
		// beyond the acquisition radius, so the midpoint family is what resolves.
		const resolved = resolveLayoutSnap(geometry, [6, 0.1], { pixelsPerMeter: 0.5, gridStep: 0.25 }, {
			allowedKinds: ['wall-midpoint']
		});
		const expected = resolveLayoutSnap(reference, [6, 0.1], { pixelsPerMeter: 0.5, gridStep: 0.25 }, {
			allowedKinds: ['wall-midpoint']
		});
		expect(resolved).toEqual(expected);
		expect(resolved.kind).toBe('snap');
		if (resolved.kind !== 'snap') return;
		expect(resolved.candidate.kind).toBe('wall-midpoint');
		expect(resolved.candidate.point).toEqual([6, 0]);
	});

	it('keeps junction priority above the Wall families', () => {
		const junctions: CompiledLayoutGeometry['queries']['points'] = [
			{
				id: 'q:junction',
				cacheKey: 'q:junction',
				kind: 'vertex',
				point: [0, 0],
				aabb: { min: [0, 0], max: [0, 0] },
				sourceId: 'w-shared',
				floorId: 'f',
				segmentId: 'w-shared',
				sourceIndex: 0,
				wallKey: 'w-shared'
			}
		];
		const withJunction = geometryOf(
			cases().find((spec) => spec.id === 'shared-wall-multiple-rooms')!.spans,
			junctions
		);
		const resolved = resolveLayoutSnap(withJunction, [0.05, 0.05], context, {});
		expect(resolved).toEqual(resolveLayoutSnap(referenceShapedGeometry(withJunction), [0.05, 0.05], context, {}));
		expect(resolved.kind).toBe('snap');
		if (resolved.kind !== 'snap') return;
		expect(resolved.candidate.kind).toBe('junction');
	});

	it('keeps a moving-target exclusion biting the same candidate', () => {
		const excluded = { excludeOwners: new Set([snapOwnerKey({ kind: 'wall', id: 'w-shared' })]) };
		const resolved = resolveLayoutSnap(geometry, [6, 0.2], context, {
			...excluded,
			allowedKinds: ['wall-span', 'wall-midpoint']
		});
		expect(resolved).toEqual(
			resolveLayoutSnap(reference, [6, 0.2], context, {
				...excluded,
				allowedKinds: ['wall-span', 'wall-midpoint']
			})
		);
		expect(resolved.kind).toBe('none');
	});

	it('snaps a curved wall by nearest point on the curve, never on its chord', () => {
		const curved = geometryOf(cases().find((spec) => spec.id === 'curved-wall')!.spans);
		const resolved = resolveLayoutSnap(curved, [5, 1.55], { pixelsPerMeter: 8, gridStep: 0.25 }, {
			allowedKinds: ['wall-span']
		});
		expect(resolved).toEqual(
			resolveLayoutSnap(referenceShapedGeometry(curved), [5, 1.55], { pixelsPerMeter: 8, gridStep: 0.25 }, {
				allowedKinds: ['wall-span']
			})
		);
		expect(resolved.kind).toBe('snap');
		if (resolved.kind !== 'snap') return;
		// The bow's midpoint is 1.5 m off the chord: a chord snap would land near
		// y = 0 and would also have to beat the grid fallback.
		expect(Math.abs(resolved.candidate.point[1] - 1.5)).toBeLessThan(0.02);
	});
});

// ---------------------------------------------------------------------------
// deterministic proof that the quadratic scan is gone
// ---------------------------------------------------------------------------

type ReadCounter = { reads: number };

function countingPoint(point: LayoutVec2, counter: ReadCounter): LayoutVec2 {
	return new Proxy(point as unknown as number[], {
		get: (target, property, receiver) => {
			counter.reads += 1;
			return Reflect.get(target, property, receiver);
		}
	}) as unknown as LayoutVec2;
}

function countingSpans(spans: readonly CompiledQuerySpan[], counter: ReadCounter): CompiledQuerySpan[] {
	return spans.map((span) => ({
		...span,
		start: countingPoint(span.start, counter),
		end: countingPoint(span.end, counter)
	}));
}

describe('P23.11 — real compiler output', () => {
	/** The live gate's document shape: 10 Rooms / 40 Walls, compiled for real. */
	const geometry = compileWallFirstLayoutGeometry(
		p2311Fixture(P2311_FIXTURES.find((spec) => spec.id === 'bend-10-room')!)
	).geometry;
	const wallSpans = geometry.queries.spans.filter((span) => span.kind === 'wall');

	it('merges identically to the reference implementation', () => {
		expect(wallSpans.length).toBeGreaterThan(1000);
		expectMergeParity(wallSpans);
	});

	it('resolves identically to the reference merge for every wall midpoint', () => {
		const reference = referenceShapedGeometry(geometry);
		const context: SnapQueryContext = { pixelsPerMeter: 2.4, gridStep: 0.25 };
		const merged = dedupeWallSpans(wallSpans);
		let compared = 0;
		for (const merge of merged) {
			const probe: LayoutVec2 = [(merge.start[0] + merge.end[0]) / 2, (merge.start[1] + merge.end[1]) / 2];
			expect(resolveLayoutSnap(geometry, probe, context, {})).toEqual(
				resolveLayoutSnap(reference, probe, context, {})
			);
			compared += 1;
		}
		expect(compared).toBe(merged.length);
	});

	it('reads the compiled endpoints a bounded number of times', () => {
		const counter: ReadCounter = { reads: 0 };
		const merged = dedupeWallSpans(countingSpans(wallSpans, counter));
		expect(merged.length).toBeGreaterThan(0);
		expect(counter.reads).toBeLessThan(wallSpans.length * 20);
	});
});

describe('P23.11 — the O(k²) Wall extent scan is gone', () => {
	const spans = chain('w0', sampled([0, 0], [12, 0], 48), {});
	const endpoints = spans.length * 2;

	it('reads every endpoint a bounded number of times', () => {
		const counter: ReadCounter = { reads: 0 };
		const merged = dedupeWallSpans(countingSpans(spans, counter));
		expect(merged).toHaveLength(1);
		expect(merged[0]!.straight).toBe(true);
		expect(merged[0]!.start).toEqual([0, 0]);
		expect(merged[0]!.end).toEqual([12, 0]);
		// O(k): the per-pair scan of the reference implementation costs ~4 reads
		// per pair (≈ 4 · (2k)² / 2). This bound is 10× above the linear path and
		// ~80× below the quadratic one, so it cannot pass by accident.
		expect(counter.reads).toBeLessThan(endpoints * 8);
	});

	it('still detects the quadratic scan in the reference implementation', () => {
		const counter: ReadCounter = { reads: 0 };
		const merged = referenceDedupeWallSpans(countingSpans(spans, counter));
		expect(merged[0]!.start).toEqual([0, 0]);
		// The guard above is only meaningful if it would catch the old shape.
		expect(counter.reads).toBeGreaterThan(endpoints * endpoints);
	});
});

// ---------------------------------------------------------------------------
// seeded differential sweep
// ---------------------------------------------------------------------------

/** Deterministic LCG — the sweep must be reproducible, never random. */
function lcg(seed: number): () => number {
	let state = seed >>> 0;
	return () => {
		state = (state * 1664525 + 1013904223) >>> 0;
		return state / 0x100000000;
	};
}

function shuffle<T>(items: T[], next: () => number): T[] {
	const copy = [...items];
	for (let index = copy.length - 1; index > 0; index -= 1) {
		const swap = Math.floor(next() * (index + 1));
		const held = copy[index]!;
		copy[index] = copy[swap]!;
		copy[swap] = held;
	}
	return copy;
}

describe('P23.11 — seeded differential sweep against the reference merge', () => {
	it('matches on every generated wall shape', () => {
		const next = lcg(0x2311);
		let straight = 0;
		let curved = 0;
		for (let iteration = 0; iteration < 300; iteration += 1) {
			const angle = next() * Math.PI * 2;
			const length = 1 + next() * 20;
			const steps = 2 + Math.floor(next() * 30);
			const a: LayoutVec2 = [(next() - 0.5) * 40, (next() - 0.5) * 40];
			const b: LayoutVec2 = [a[0] + Math.cos(angle) * length, a[1] + Math.sin(angle) * length];
			// Bows sized around the relative tolerance keep both branches live.
			const bow = next() < 0.35 ? (next() - 0.5) * 2 * Math.max(1e-7, length * 2e-6) : next() * length * 0.05;
			const points = Math.abs(bow) > 0 ? bowed(a, b, steps, bow) : sampled(a, b, steps);
			const wallKey = next() < 0.5 ? `w${iteration}` : geometryId(['f', `room${Math.floor(next() * 3)}`, `w${iteration}`]);
			const spans: CompiledQuerySpan[] = [];
			const frames = 1 + Math.floor(next() * 3);
			for (let frame = 0; frame < frames; frame += 1) {
				const roomless = next() < 0.25;
				spans.push(
					...chain(`w${iteration}`, points, {
						...(roomless ? {} : { roomId: `room${frame}` }),
						wallKey,
						reverse: next() < 0.5,
						distances: next() < 0.1 ? 'placeholder' : 'frame'
					})
				);
			}
			if (next() < 0.15) spans.push(...spans.slice(0, 3).map((span) => ({ ...span })));
			expectMergeParity(shuffle(spans, next));
			const merged = dedupeWallSpans(spans);
			if (merged[0]!.straight) straight += 1;
			else curved += 1;
		}
		// The sweep is only useful if it exercised both branches.
		expect(straight).toBeGreaterThan(50);
		expect(curved).toBeGreaterThan(20);
	});
});

// ---------------------------------------------------------------------------
// the index seam itself
// ---------------------------------------------------------------------------

describe('P23.11 — the derived Wall snap index', () => {
	it('is memoized per compiled geometry and reused by the resolver', () => {
		const geometry = geometryOf(cases().find((spec) => spec.id === 'straight-horizontal')!.spans);
		expect(wallSnapIndex(geometry)).toBe(wallSnapIndex(geometry));
		const other = geometryOf(cases().find((spec) => spec.id === 'straight-vertical')!.spans);
		expect(wallSnapIndex(other)).not.toBe(wallSnapIndex(geometry));
	});

	it('carries no pointer-, radius- or exclusion-dependent data', () => {
		const geometry = geometryOf(cases().find((spec) => spec.id === 'shared-wall-multiple-rooms')!.spans);
		const before = JSON.stringify(mergedSummary(wallSnapIndex(geometry).walls));
		resolveLayoutSnap(geometry, [6, 0.2], { pixelsPerMeter: 2.4, gridStep: 0.25 }, {});
		resolveLayoutSnap(geometry, [3, 0.4], { pixelsPerMeter: 0.5, gridStep: 0.25 }, {
			excludeOwners: new Set([snapOwnerKey({ kind: 'wall', id: 'w-shared' })])
		});
		expect(JSON.stringify(mergedSummary(wallSnapIndex(geometry).walls))).toBe(before);
	});
});

describe('P23.11 — the candidate builder the merge feeds', () => {
	it('produces the same straight-wall candidate family from the same chord', () => {
		const merge = dedupeWallSpans(cases().find((spec) => spec.id === 'straight-horizontal')!.spans)[0]!;
		const reference = referenceDedupeWallSpans(cases().find((spec) => spec.id === 'straight-horizontal')!.spans)[0]!;
		const optimized = spanSnapCandidates(
			{ id: merge.key, start: merge.start, end: merge.end },
			[6, 0.2],
			8,
			snapOwnerKey({ kind: 'wall', id: merge.key }),
			merge.key
		);
		const expected = spanSnapCandidates(
			{ id: reference.key, start: reference.start, end: reference.end },
			[6, 0.2],
			8,
			snapOwnerKey({ kind: 'wall', id: reference.key }),
			reference.key
		);
		expect(optimized).toEqual(expected);
		expect(pickSnapWinner(optimized, {})).toEqual(pickSnapWinner(expected, {}));
	});
});
