/**
 * P23.13 S8 — the draft-anchor axis family and its guide.
 *
 * §7 names the orthogonal relation and allows one guide; P23.2 ratified the
 * family's rank and shipped a generator with no caller. This suite pins what
 * *wiring* it means, which is narrower than "make the glyph reachable":
 *
 * - the family exists only when a caller names a draft anchor, so no other
 *   caller's resolution changes at all;
 * - inside the acquisition radius it competes through the ratified rank order
 *   rather than being special-cased: rank 7 wins the order *lower is better*,
 *   so it sits below every geometry family and above the grid — wiring it can
 *   take an outcome that used to grid-snap, and can never displace a join to
 *   real geometry (the review's precondition, pinned below);
 * - the winner carries **one** guide with real extent on the held axis, because
 *   a zero-length guide is invisible and therefore not a guide;
 * - the family's free coordinate is **quantized to the grid step** while the held
 *   coordinate stays exactly the anchor's, so a snap-on winner is always an exact
 *   point (the anchor's axis crossed with a grid line) rather than a glide — the
 *   owner's "locked *and* stepped" ruling, pinned below;
 * - resolution is pure in (geometry, point, context), which is what lets the
 *   commit re-resolve at the click point and land exactly where the guide said.
 */
import { describe, expect, it } from 'vitest';
import {
	LAYOUT_PLAN_GRID_STEP,
	resolveLayoutSnap,
	type CompiledLayoutGeometry,
	type CompiledQuerySpan,
	type LayoutVec2,
	type SnapResolution
} from '@portfolio/layout-core';

/** 20 px/m puts the 8 px acquisition radius at 0.4 m — a readable tolerance band. */
const PIXELS_PER_METER = 20;
const RADIUS = 8 / PIXELS_PER_METER;

function emptyGeometry(): CompiledLayoutGeometry {
	return {
		floors: [],
		rooms: [],
		walls: [],
		objects: [],
		queries: { points: [], spans: [], polygons: [], aabbs: [] },
		bounds: null
	};
}

function wallSpan(
	segmentId: string,
	start: [number, number],
	end: [number, number],
	roomId = 'r'
): CompiledQuerySpan {
	const length = Math.hypot(end[0] - start[0], end[1] - start[1]);
	return {
		id: `s:${segmentId}`,
		cacheKey: `k:${segmentId}`,
		kind: 'wall',
		start,
		end,
		startDistance: 0,
		endDistance: length,
		aabb: {
			min: [Math.min(start[0], end[0]), Math.min(start[1], end[1])],
			max: [Math.max(start[0], end[0]), Math.max(start[1], end[1])]
		},
		sourceId: segmentId,
		floorId: 'f',
		roomId,
		segmentId
	};
}

function geometryWith(spans: CompiledQuerySpan[]): CompiledLayoutGeometry {
	const geometry = emptyGeometry();
	geometry.queries.spans = spans;
	return geometry;
}

function resolveFrom(source: CompiledLayoutGeometry, point: LayoutVec2, anchor?: LayoutVec2): SnapResolution {
	return resolveLayoutSnap(
		source,
		point,
		{ pixelsPerMeter: PIXELS_PER_METER, gridStep: LAYOUT_PLAN_GRID_STEP, ...(anchor ? { anchor } : {}) },
		{}
	);
}

/** A wall whose nearest point is 0.2 m from the probe below — geometry in range. */
const geometryNear: CompiledLayoutGeometry = geometryWith([
	wallSpan('w-1', [2, 0.5], [6, 0.5]),
	wallSpan('w-2', [0, 4], [0, 8])
]);

/** The same document with nothing within reach of the probe: grid is the fallback. */
const geometryOpen: CompiledLayoutGeometry = geometryWith([wallSpan('w-2', [0, 4], [0, 8])]);

/** Inside the band on Z, 0.2 m from a wall span. */
const PROBE: LayoutVec2 = [3, 0.3];
const ORIGIN: LayoutVec2 = [0, 0];

describe('P23.13 S8 — the axis family needs a draft anchor', () => {
	it('does not exist for a caller with no anchor', () => {
		// Inside the band, but no anchor was named, so the candidate set is
		// exactly what it was before this slice: the nearer wall span wins.
		const resolution = resolveFrom(geometryNear, PROBE);
		expect(resolution.kind).toBe('snap');
		if (resolution.kind !== 'snap') return;
		expect(resolution.candidate.kind).toBe('wall-span');
		expect(resolution.candidate.point).toEqual([3, 0.5]);
		expect(resolution.guides).toEqual([]);
	});

	it('falls back to the grid with no anchor, and locks the axis with one', () => {
		// The same probe, the same document: the anchor is the entire difference.
		const without = resolveFrom(geometryOpen, PROBE);
		const withAnchor = resolveFrom(geometryOpen, PROBE, ORIGIN);
		expect(without.kind === 'snap' && without.candidate.kind).toBe('grid');
		expect(withAnchor.kind === 'snap' && withAnchor.candidate.kind).toBe('orthogonal-guide');
	});

	it('ignores an anchor that is not a finite point', () => {
		for (const anchor of [
			[Number.NaN, 0],
			[0, Number.POSITIVE_INFINITY]
		] as LayoutVec2[]) {
			const resolution = resolveFrom(geometryOpen, PROBE, anchor);
			expect(resolution.kind).toBe('snap');
			if (resolution.kind !== 'snap') return;
			expect(resolution.candidate.kind).not.toBe('orthogonal-guide');
		}
	});
});

describe('P23.13 S8 — rank 7 replaces the grid, never a join', () => {
	it('locks the axis only where the grid used to win', () => {
		const resolution = resolveFrom(geometryOpen, PROBE, ORIGIN);
		expect(resolution.kind).toBe('snap');
		if (resolution.kind !== 'snap') return;
		expect(resolution.candidate.kind).toBe('orthogonal-guide');
		expect(resolution.candidate.sourceId).toBe('orthogonal-x');
		expect(resolution.candidate.point).toEqual([3, 0]);
	});

	it('leaves a geometry winner exactly where it was', () => {
		// The review's precondition, as a pin: with a wall span 0.2 m away the
		// anchor changes nothing, because rank 7 is below every geometry family.
		// A new winner therefore cannot alter a committed outcome that geometry
		// already decided — only one the grid was deciding.
		const without = resolveFrom(geometryNear, PROBE);
		const withAnchor = resolveFrom(geometryNear, PROBE, ORIGIN);
		expect(without).toEqual(withAnchor);
		expect(withAnchor.kind === 'snap' && withAnchor.candidate.kind).toBe('wall-span');
	});

	it('loses to the grid, and to nothing else, once the pointer leaves the band', () => {
		const resolution = resolveFrom(geometryOpen, [3.02, 1.6], ORIGIN);
		expect(resolution.kind).toBe('snap');
		if (resolution.kind !== 'snap') return;
		expect(resolution.candidate.kind).toBe('grid');
	});

	it('adds no candidate at all when the pointer is collinear with the anchor', () => {
		// On the anchor's own X line the axis family has nothing to acquire (its
		// projections either *are* the anchor or leave the line being drawn), so a
		// real wall 0.1 m away resolves identically with and without the anchor.
		const near = geometryWith([wallSpan('w-3', [2, 0.1], [6, 0.1])]);
		const without = resolveFrom(near, [3, 0]);
		const withAnchor = resolveFrom(near, [3, 0], ORIGIN);
		expect(without).toEqual(withAnchor);
		expect(withAnchor.kind === 'snap' && withAnchor.candidate.kind).toBe('wall-span');
		expect(withAnchor.kind === 'snap' && withAnchor.candidate.point).toEqual([3, 0.1]);
	});

	it('holds the other axis symmetrically', () => {
		const resolution = resolveFrom(geometryOpen, [0.3, 3], ORIGIN);
		expect(resolution.kind).toBe('snap');
		if (resolution.kind !== 'snap') return;
		expect(resolution.candidate.kind).toBe('orthogonal-guide');
		expect(resolution.candidate.sourceId).toBe('orthogonal-z');
		expect(resolution.candidate.point).toEqual([0, 3]);
	});

	it('declines a lock that would collapse the leg onto the anchor', () => {
		// Dragging straight up from the start: the pointer already shares the
		// anchor's X, so that projection *is* the anchor. At rank 7 it would beat
		// the grid and commit a zero-length wall where a 0.25 m one was promised.
		const resolution = resolveFrom(geometryOpen, [0, 0.3], ORIGIN);
		expect(resolution.kind).toBe('snap');
		if (resolution.kind !== 'snap') return;
		expect(resolution.candidate.kind).toBe('grid');
		expect(resolution.candidate.point).toEqual([0, 0.25]);
	});

	it('declines the lock rounding collapses onto the anchor, and steps the other one', () => {
		// Quantize *first*, decline *second* (the load-bearing order): the pointer
		// is off the anchor's X line, but stepping its free coordinate lands that
		// projection back on the anchor, so the candidate must be declined on its
		// **final** point. The surviving lock is the nearer axis — 0.1 m away
		// against 0.3 m — and it steps to a subdivision instead of collapsing.
		const resolution = resolveFrom(geometryOpen, [0.1, 0.3], ORIGIN);
		expect(resolution.kind).toBe('snap');
		if (resolution.kind !== 'snap') return;
		expect(resolution.candidate.kind).toBe('orthogonal-guide');
		expect(resolution.candidate.sourceId).toBe('orthogonal-z');
		expect(resolution.candidate.point).toEqual([0, 0.25]);
	});

	it('quantizes the free coordinate onto the nearest subdivision', () => {
		// The lock is "the anchor's axis crossed with a grid line", never the raw
		// pointer projection — otherwise the endpoint glides and the subdivisions
		// the grid promises are unreachable for the whole length of a run.
		const below = resolveFrom(geometryOpen, [2.6, 0.3], ORIGIN);
		const above = resolveFrom(geometryOpen, [2.7, 0.3], ORIGIN);
		expect(below.kind === 'snap' && below.candidate.point).toEqual([2.5, 0]);
		expect(above.kind === 'snap' && above.candidate.point).toEqual([2.75, 0]);
		expect(below.kind === 'snap' && below.candidate.point).not.toEqual([2.6, 0]);
	});

	it('measures acquisition against the raw offset, not the stepped point', () => {
		// 0.395 m off the axis at a 0.4 m radius: inside, although the *stepped*
		// point is 0.407 m away. Acquisition is a property of the pointer, so
		// stepping must not shrink the band it is acquired in.
		const resolution = resolveFrom(geometryOpen, [2.6, 0.395], ORIGIN);
		expect(Math.hypot(2.5 - 2.6, 0 - 0.395)).toBeGreaterThan(RADIUS);
		expect(resolution.kind).toBe('snap');
		if (resolution.kind !== 'snap') return;
		expect(resolution.candidate.kind).toBe('orthogonal-guide');
		expect(resolution.candidate.point).toEqual([2.5, 0]);
	});

	it('keeps respecting the explicit exclusion the caller passed', () => {
		// The family carries its own synthetic owner ids, so a set naming real
		// owners never suppresses it by accident — and excluding the grid owner
		// must not take the axis lock down with the grid.
		const resolution = resolveLayoutSnap(
			geometryOpen,
			PROBE,
			{ pixelsPerMeter: PIXELS_PER_METER, gridStep: LAYOUT_PLAN_GRID_STEP, anchor: ORIGIN },
			{ excludeOwners: new Set(['grid']) }
		);
		expect(resolution.kind).toBe('snap');
		if (resolution.kind !== 'snap') return;
		expect(resolution.candidate.kind).toBe('orthogonal-guide');
	});
});

describe('P23.13 S8 — the guide is one line, with extent, on the held axis', () => {
	it('spans the anchor to the locked point and stays exactly on the held coordinate', () => {
		const resolution = resolveFrom(geometryOpen, PROBE, ORIGIN);
		expect(resolution.kind).toBe('snap');
		if (resolution.kind !== 'snap') return;
		expect(resolution.guides).toHaveLength(1);
		const [guide] = resolution.guides;
		expect(guide.kind).toBe('orthogonal-z');
		// The held coordinate is the anchor's Z, so both ends share it.
		expect(guide.start).toEqual([0, 0]);
		expect(guide.end[1]).toBe(0);
		expect(guide.end[0]).toBeCloseTo(3, 9);
		expect(guide.start).not.toEqual(guide.end);
	});

	it('extends a short stepped leg to the pointer offset so the guide is never a dot', () => {
		// The stepped leg is 0.25 m while the pointer is 0.3 m off the axis: the
		// guide takes the longer of the two, so the line still reads as a line.
		const resolution = resolveFrom(geometryOpen, [0.3, 0.35], ORIGIN);
		expect(resolution.kind).toBe('snap');
		if (resolution.kind !== 'snap') return;
		expect(resolution.candidate.kind).toBe('orthogonal-guide');
		const [guide] = resolution.guides;
		expect(guide.kind).toBe('orthogonal-x');
		const extent = Math.hypot(guide.end[0] - guide.start[0], guide.end[1] - guide.start[1]);
		expect(extent).toBeCloseTo(0.3, 9);
		expect(extent).toBeGreaterThan(0.25);
		expect(extent).toBeGreaterThan(RADIUS / 2);
	});

	it('still draws that line when the pointer sits a hair off the nearer axis', () => {
		// 2 mm from the anchor's X line and 0.3 m up it: the collapsed candidate is
		// gone, and the surviving one is a full 0.25 m leg with a visible guide.
		const resolution = resolveFrom(geometryOpen, [0.002, 0.3], ORIGIN);
		expect(resolution.kind).toBe('snap');
		if (resolution.kind !== 'snap') return;
		expect(resolution.candidate.kind).toBe('orthogonal-guide');
		expect(resolution.candidate.point).toEqual([0, 0.25]);
		const [guide] = resolution.guides;
		const extent = Math.hypot(guide.end[0] - guide.start[0], guide.end[1] - guide.start[1]);
		expect(extent).toBeCloseTo(0.25, 9);
		expect(extent).toBeGreaterThan(RADIUS / 2);
	});

	it('orients the guide along the axis that is actually held', () => {
		const resolution = resolveFrom(geometryOpen, [0.3, 3], ORIGIN);
		expect(resolution.kind).toBe('snap');
		if (resolution.kind !== 'snap') return;
		const [guide] = resolution.guides;
		expect(guide.kind).toBe('orthogonal-x');
		expect(guide.start).toEqual([0, 0]);
		expect(guide.end[0]).toBe(0);
		expect(guide.end[1]).toBeCloseTo(3, 9);
	});

	it('draws no guide for a winner the family does not own', () => {
		const resolution = resolveFrom(geometryOpen, [3.02, 1.6], ORIGIN);
		expect(resolution.kind).toBe('snap');
		if (resolution.kind !== 'snap') return;
		expect(resolution.candidate.kind).toBe('grid');
		expect(resolution.guides).toEqual([]);
	});
});

describe('P23.13 S8 — release truth: the release point alone decides', () => {
	it('resolves identically however many times the same input is asked for', () => {
		expect(resolveFrom(geometryOpen, PROBE, ORIGIN)).toEqual(resolveFrom(geometryOpen, PROBE, ORIGIN));
	});

	it('takes the axis lock at a covered release and the grid outside the band', () => {
		// Preview and commit both call this with the same anchor and nothing about
		// the previewed candidate is passed in, so a remembered preview cannot
		// become the committed point — the release point alone decides.
		const inside = resolveFrom(geometryOpen, PROBE, ORIGIN);
		const outside = resolveFrom(geometryOpen, [3, 1.6], ORIGIN);
		expect(inside.kind === 'snap' && inside.candidate.kind).toBe('orthogonal-guide');
		expect(outside.kind === 'snap' && outside.candidate.kind).toBe('grid');
	});
});
