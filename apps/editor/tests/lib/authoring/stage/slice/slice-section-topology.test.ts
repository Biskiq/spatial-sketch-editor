/**
 * SL2 — the finite cap crop keeps the section's topology.
 *
 * The crop is a region operation, not a per-ring one: a concave contour can meet the
 * extent in disjoint islands, and a hole crossing the crop must open into its outer.
 * Every case asserts what the renderer consumes — `capFillsOf` polygons that are
 * simple, correctly oriented and triangulate to the right area.
 */
import { describe, expect, it } from 'vitest';
import { ShapeUtils, Vector2 } from 'three';
import type { SectionInput, SectionLoop } from '$lib/authoring/stage/slice/mesh-plane-section';
import { capFillsOf } from '$lib/authoring/stage/slice/slice-cap-shapes';
import {
	clipRegionToHalfPlane,
	clipRegionToHalfPlanes,
	ringSignedArea,
	type ClipPoint,
	type ClipRing
} from '$lib/authoring/stage/slice/slice-clip-2d';
import {
	clipChainToExtent,
	clipLoopsToExtent,
	sectionForSlice
} from '$lib/authoring/stage/slice/slice-section';
import { resolveSlice } from '$lib/authoring/stage/slice/slice-cut';

function loop(points: readonly ClipPoint[], prefix: string): SectionLoop {
	const area = ringSignedArea(points);
	return {
		role: area > 0 ? 'outer' : 'hole',
		points,
		edgeIdentities: points.map((_, index) => `${prefix}${index}`),
		signedArea: area
	};
}

/** The reviewer's reproducer: a C opening toward +u. */
const C_SHAPE: readonly ClipPoint[] = [
	[-2, -2],
	[2, -2],
	[2, -1],
	[-1, -1],
	[-1, 1],
	[2, 1],
	[2, 2],
	[-2, 2]
];

function square(cx: number, cy: number, half: number, clockwise = false): ClipPoint[] {
	const ring: ClipPoint[] = [
		[cx - half, cy - half],
		[cx + half, cy - half],
		[cx + half, cy + half],
		[cx - half, cy + half]
	];
	return clockwise ? ring.reverse() : ring;
}

function segmentsCross(a: ClipPoint, b: ClipPoint, c: ClipPoint, d: ClipPoint): boolean {
	const orient = (p: ClipPoint, q: ClipPoint, r: ClipPoint) =>
		(q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
	const o1 = orient(a, b, c);
	const o2 = orient(a, b, d);
	const o3 = orient(c, d, a);
	const o4 = orient(c, d, b);
	return o1 * o2 < -1e-18 && o3 * o4 < -1e-18;
}

/** No two edges of the ring cross, and no vertex repeats (no self-touching). */
function isSimple(points: readonly ClipPoint[]): boolean {
	const keys = new Set(points.map(([x, y]) => `${x.toFixed(9)}:${y.toFixed(9)}`));
	if (keys.size !== points.length) return false;
	for (let i = 0; i < points.length; i += 1) {
		for (let j = i + 1; j < points.length; j += 1) {
			const a = points[i]!;
			const b = points[(i + 1) % points.length]!;
			const c = points[j]!;
			const d = points[(j + 1) % points.length]!;
			if (segmentsCross(a, b, c, d)) return false;
		}
	}
	return true;
}

/** The area earcut actually fills for the renderer's polygons. */
function triangulatedArea(loops: readonly SectionLoop[]): number {
	let total = 0;
	for (const fill of capFillsOf(loops)) {
		const contour = fill.outer.map(([x, y]) => new Vector2(x, y));
		const holes = fill.holes.map((hole) => hole.map(([x, y]) => new Vector2(x, y)));
		const all = [...contour, ...holes.flat()];
		for (const [a, b, c] of ShapeUtils.triangulateShape(contour, holes)) {
			const p = all[a]!;
			const q = all[b]!;
			const r = all[c]!;
			total += Math.abs((q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x)) / 2;
		}
	}
	return total;
}

describe('clipLoopsToExtent: disconnected islands', () => {
	it('splits the C reproducer into two disjoint rectangles', () => {
		const clipped = clipLoopsToExtent([loop(C_SHAPE, 'c')], 0, 1);
		expect(clipped).not.toBeNull();
		expect(clipped).toHaveLength(2);
		for (const ring of clipped!) {
			expect(ring.role).toBe('outer');
			expect(ring.signedArea).toBeCloseTo(1, 9);
			expect(isSimple(ring.points)).toBe(true);
			expect(ring.points.every(([u]) => u >= 0 && u <= 1)).toBe(true);
			expect(ring.edgeIdentities).toHaveLength(ring.points.length);
			expect(ring.edgeIdentities.every((id) => id.startsWith('c'))).toBe(true);
		}
		const vs = clipped!.map((ring) => Math.min(...ring.points.map(([, v]) => v))).sort((a, b) => a - b);
		expect(vs[0]).toBeCloseTo(-2, 9);
		expect(vs[1]).toBeCloseTo(1, 9);
		expect(capFillsOf(clipped!)).toHaveLength(2);
		expect(triangulatedArea(clipped!)).toBeCloseTo(2, 9);
	});

	it('keeps the C whole when the extent spans it, and joins it when the crop crosses the spine', () => {
		const whole = clipLoopsToExtent([loop(C_SHAPE, 'c')], -5, 5)!;
		expect(whole).toHaveLength(1);
		expect(whole[0]!.signedArea).toBeCloseTo(ringSignedArea(C_SHAPE), 9);
		const spine = clipLoopsToExtent([loop(C_SHAPE, 'c')], -1.5, 1.5)!;
		expect(spine).toHaveLength(1);
		expect(isSimple(spine[0]!.points)).toBe(true);
		// The spine (u in −1.5…−1, full height) plus both arms out to 1.5.
		expect(spine[0]!.signedArea).toBeCloseTo(0.5 * 4 + 2 * 2.5 * 1, 9);
	});

	it('crop-line edges take the identity of the edge that left the extent', () => {
		const clipped = clipLoopsToExtent([loop(C_SHAPE, 'c')], 0, 1)!;
		for (const ring of clipped) {
			ring.points.forEach((point, index) => {
				const next = ring.points[(index + 1) % ring.points.length]!;
				if (Math.abs(point[0] - next[0]) < 1e-12) {
					// A crop edge at u = 0 or u = 1 still names a source edge.
					expect(ring.edgeIdentities[index]).toMatch(/^c\d$/);
				}
			});
		}
	});
});

describe('clipLoopsToExtent: holes', () => {
	const outer = loop(square(0, 0, 2), 'o');
	const hole = loop(square(0, 0, 0.5, true), 'h');

	it('keeps a hole wholly inside the extent as its outer’s hole', () => {
		const clipped = clipLoopsToExtent([outer, hole], -1, 1)!;
		expect(clipped.filter((ring) => ring.role === 'outer')).toHaveLength(1);
		expect(clipped.filter((ring) => ring.role === 'hole')).toHaveLength(1);
		const fills = capFillsOf(clipped);
		expect(fills).toHaveLength(1);
		expect(fills[0]!.holes).toHaveLength(1);
		expect(triangulatedArea(clipped)).toBeCloseTo(2 * 4 - 1, 9);
	});

	it('opens a hole that crosses the crop into its outer, never a hole touching the boundary', () => {
		const clipped = clipLoopsToExtent([outer, hole], 0, 3)!;
		expect(clipped).toHaveLength(1);
		expect(clipped[0]!.role).toBe('outer');
		expect(isSimple(clipped[0]!.points)).toBe(true);
		expect(clipped[0]!.signedArea).toBeCloseTo(2 * 4 - 0.5 * 1, 9);
		expect(capFillsOf(clipped)[0]!.holes).toHaveLength(0);
		expect(triangulatedArea(clipped)).toBeCloseTo(7.5, 9);
		// The hole's own edges survive with their identity.
		expect(clipped[0]!.edgeIdentities.some((id) => id.startsWith('h'))).toBe(true);
	});

	it('splits an outer into two islands when a hole spans the whole extent', () => {
		const wide = loop(square(0, 0, 1, true).map(([u, v]) => [u * 3, v * 0.5] as const), 'h');
		const clipped = clipLoopsToExtent([outer, wide], -1, 1)!;
		expect(clipped).toHaveLength(2);
		expect(clipped.every((ring) => ring.role === 'outer' && isSimple(ring.points))).toBe(true);
		expect(triangulatedArea(clipped)).toBeCloseTo(2 * 4 - 2 * 1, 9);
	});

	it('drops a hole wholly outside the extent', () => {
		const clipped = clipLoopsToExtent([outer, hole], 1, 2)!;
		expect(clipped).toHaveLength(1);
		expect(clipped[0]!.signedArea).toBeCloseTo(4, 9);
	});

	it('keeps two disjoint solids and their own holes apart', () => {
		const left = loop(square(-3, 0, 1), 'l');
		const leftHole = loop(square(-3, 0, 0.25, true), 'lh');
		const right = loop(square(3, 0, 1), 'r');
		const clipped = clipLoopsToExtent([left, leftHole, right], -3.5, 2.5)!;
		const fills = capFillsOf(clipped);
		expect(fills).toHaveLength(2);
		expect(fills.map((fill) => fill.holes.length).sort()).toEqual([0, 1]);
	});
});

describe('clipLoopsToExtent: degenerate and invalid input', () => {
	it('returns nothing for an empty extent', () => {
		expect(clipLoopsToExtent([loop(C_SHAPE, 'c')], 1, 1)).toEqual([]);
	});

	it('keeps a ring whose vertex lies exactly on the crop line', () => {
		const diamond = loop([[0, -1], [1, 0], [0, 1], [-1, 0]], 'd');
		const clipped = clipLoopsToExtent([diamond], -1, 1)!;
		expect(clipped).toHaveLength(1);
		expect(clipped[0]!.signedArea).toBeCloseTo(2, 9);
		const half = clipLoopsToExtent([diamond], 0, 1)!;
		expect(half).toHaveLength(1);
		expect(half[0]!.signedArea).toBeCloseTo(1, 9);
		expect(isSimple(half[0]!.points)).toBe(true);
	});

	it('reports crossing rings instead of filling something wrong', () => {
		const a = loop(square(0, 0, 1), 'a');
		const b = loop(square(0, 0.5, 1), 'b');
		expect(clipLoopsToExtent([a, b], 0, 3)).toBeNull();
	});
});

describe('clipRegionToHalfPlane: area matches the convex-clip area on combs', () => {
	/** A comb: `teeth` vertical teeth on a spine, a stress case for islands. */
	function comb(teeth: number): ClipPoint[] {
		const points: ClipPoint[] = [[0, 0], [2 * teeth - 1, 0]];
		for (let tooth = teeth - 1; tooth >= 0; tooth -= 1) {
			const x = 2 * tooth;
			points.push([x + 1, 3], [x, 3]);
			if (tooth > 0) points.push([x, 1], [x - 1, 1]);
		}
		return points;
	}

	/** Sutherland–Hodgman's area is exact for a half-plane even when its topology is not. */
	function shArea(points: readonly ClipPoint[], nx: number, ny: number, c: number): number {
		const out: ClipPoint[] = [];
		for (let i = 0; i < points.length; i += 1) {
			const a = points[i]!;
			const b = points[(i + 1) % points.length]!;
			const fa = c - (nx * a[0] + ny * a[1]);
			const fb = c - (nx * b[0] + ny * b[1]);
			if (fa >= 0) out.push(a);
			if (fa >= 0 !== fb >= 0) {
				const t = fa / (fa - fb);
				out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
			}
		}
		return out.length < 3 ? 0 : ringSignedArea(out);
	}

	it('agrees on area, and every ring is simple, across many lines', () => {
		const shape = comb(5);
		const ring: ClipRing = { points: shape, tags: shape.map(() => 'e') };
		for (let step = 0; step < 60; step += 1) {
			const angle = (step / 60) * Math.PI * 2 + 0.013;
			const nx = Math.cos(angle);
			const ny = Math.sin(angle);
			const c = nx * 4.3 + ny * 1.7 + ((step % 7) - 3) * 0.37;
			const result = clipRegionToHalfPlane([ring], { nx, ny, c });
			expect(result.kind).toBe('clipped');
			if (result.kind !== 'clipped') continue;
			const area = result.rings.reduce((sum, r) => sum + ringSignedArea(r.points), 0);
			expect(area).toBeCloseTo(shArea(shape, nx, ny, c), 8);
			for (const r of result.rings) {
				expect(ringSignedArea(r.points)).toBeGreaterThan(0);
				expect(isSimple(r.points)).toBe(true);
			}
		}
	});

	it('a horizontal crop through the teeth yields one island per tooth', () => {
		const shape = comb(5);
		const result = clipRegionToHalfPlanes(
			[{ points: shape, tags: shape.map(() => 'e') }],
			[{ nx: 0, ny: -1, c: -2 }]
		);
		expect(result.kind === 'clipped' && result.rings.length).toBe(5);
	});
});

describe('clipChainToExtent: warning edges survive', () => {
	it('keeps a vertical chain inside the extent', () => {
		const chains = clipChainToExtent({ points: [[0, 0], [0, 1]], edgeIdentities: ['w'] }, -1, 1);
		expect(chains).toEqual([{ points: [[0, 0], [0, 1]], edgeIdentities: ['w'] }]);
	});

	it('keeps a vertical chain lying exactly on the crop line, and drops one outside', () => {
		expect(clipChainToExtent({ points: [[1, 0], [1, 2]], edgeIdentities: ['w'] }, -1, 1)).toHaveLength(1);
		expect(clipChainToExtent({ points: [[1.5, 0], [1.5, 2]], edgeIdentities: ['w'] }, -1, 1)).toEqual([]);
	});

	it('clips a crossing chain and keeps per-edge identities', () => {
		const chains = clipChainToExtent(
			{ points: [[-2, 0], [0, 0], [0, 1], [2, 1]], edgeIdentities: ['a', 'b', 'c'] },
			-1,
			1
		);
		expect(chains.map((chain) => chain.edgeIdentities[0])).toEqual(['a', 'b', 'c']);
		expect(chains[0]!.points).toEqual([[-1, 0], [0, 0]]);
		expect(chains[2]!.points).toEqual([[0, 1], [1, 1]]);
	});
});

describe('sectionForSlice: a concave solid under a finite drawn cut', () => {
	/** The C reproducer in (x, y), lifted 3 m and extruded along z ∈ [−1, 1]. */
	function cPrism(): SectionInput {
		const outline = C_SHAPE.map(([x, y]) => new Vector2(x, y + 3));
		expect(ShapeUtils.area(outline)).toBeGreaterThan(0);
		const positions: number[] = [];
		const push = (x: number, y: number, z: number) => positions.push(x, y, z);
		for (const [a, b, c] of ShapeUtils.triangulateShape(outline, [])) {
			const [p, q, r] = [outline[a]!, outline[b]!, outline[c]!];
			push(p.x, p.y, 1); push(q.x, q.y, 1); push(r.x, r.y, 1);
			push(p.x, p.y, -1); push(r.x, r.y, -1); push(q.x, q.y, -1);
		}
		outline.forEach((a, index) => {
			const b = outline[(index + 1) % outline.length]!;
			push(a.x, a.y, -1); push(b.x, b.y, -1); push(b.x, b.y, 1);
			push(a.x, a.y, -1); push(b.x, b.y, 1); push(a.x, a.y, 1);
		});
		return { identity: 'object:c', positions };
	}

	it('fills two separate caps inside the segment extent, each of area 1', () => {
		const cut = resolveSlice(
			{ kind: 'drawn', start: [0, 0], end: [1, 0], hidden: 'right', depthMeters: 2 },
			{ sheetHeight: 0, datumMeters: 0 }
		);
		const section = sectionForSlice([cPrism()], cut);
		expect(section.result.issues).toEqual([]);
		const loops = section.result.groups.flatMap((group) => group.loops);
		expect(loops).toHaveLength(2);
		expect(loops.every((ring) => isSimple(ring.points))).toBe(true);
		expect(capFillsOf(loops)).toHaveLength(2);
		expect(triangulatedArea(loops)).toBeCloseTo(2, 3);
		expect(section.result.groups.every((group) => group.chains.length === 0)).toBe(true);
	});
});
