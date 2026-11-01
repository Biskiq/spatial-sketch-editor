/** Batch the existing Paper polygons into renderer buffers, without changing
 * their triangulation, elevation, draw order or authored/Plan representation.
 * The one exception is `unionPaperFillPolygons`, which regroups the same region
 * of overlapping polygons into non-overlapping rings for a drawing that must not
 * be tinted twice. */
import { Path, Shape, ShapeGeometry, type BufferGeometry } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { LayoutVec2 } from '@portfolio/layout-core';
import { unionOutline } from './paper-plan';

/** The only parts of a Paper fill the renderer reads; identity stays with the caller. */
export type PaperFillPolygons = {
	readonly elevationMeters: number;
	readonly polygons: readonly (readonly LayoutVec2[])[];
	/** Hole rings cut from each polygon: `holes[i]` belongs to `polygons[i]`; omitted or empty when none. */
	readonly holes?: readonly (readonly (readonly LayoutVec2[])[])[];
};

export function createPaperFillGeometry(fills: readonly PaperFillPolygons[]): BufferGeometry | null {
	const parts: BufferGeometry[] = [];
	try {
		for (const fill of fills) {
			fill.polygons.forEach((polygon, index) => {
				if (polygon.length < 3) return;
				const shape = new Shape();
				shape.moveTo(polygon[0]![0], polygon[0]![1]);
				for (const point of polygon.slice(1)) shape.lineTo(point[0], point[1]);
				shape.closePath();
				for (const hole of fill.holes?.[index] ?? []) {
					if (hole.length < 3) continue;
					const path = new Path();
					path.moveTo(hole[0]![0], hole[0]![1]);
					for (const point of hole.slice(1)) path.lineTo(point[0], point[1]);
					shape.holes.push(path);
				}
				parts.push(new ShapeGeometry(shape).rotateX(Math.PI / 2).translate(0, fill.elevationMeters, 0));
			});
		}
		if (parts.length === 0) return null;
		const merged = mergeGeometries(parts);
		if (merged === null) throw new Error('Paper fill buffers could not be batched');
		return merged;
	} finally {
		for (const part of parts) part.dispose();
	}
}

/** Non-overlapping rings covering exactly the union of some polygons. */
export type PaperFillUnion = {
	readonly polygons: readonly (readonly LayoutVec2[])[];
	readonly holes: readonly (readonly (readonly LayoutVec2[])[])[];
};

/** Two points closer than this are one vertex; lines closer than this are collinear. */
const RING_EPSILON = 1e-6;
/** Below this area a polygon is a sliver: it has no inside to orient a boundary by. */
const AREA_EPSILON = 1e-12;
const ANGLE_EPSILON = 1e-12;
const TAU = Math.PI * 2;

/** Shoelace area in the plan (x, z) plane: positive when counter-clockwise. */
function signedArea(ring: readonly LayoutVec2[]): number {
	let twice = 0;
	for (let index = 0; index < ring.length; index += 1) {
		const a = ring[index]!;
		const b = ring[(index + 1) % ring.length]!;
		twice += a[0] * b[1] - b[0] * a[1];
	}
	return twice / 2;
}

/** Even-odd containment for a point that lies on no edge of the ring. */
function pointInRing(point: LayoutVec2, ring: readonly LayoutVec2[]): boolean {
	let inside = false;
	for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index++) {
		const current = ring[index]!;
		const prior = ring[previous]!;
		const crosses =
			(current[1] > point[1]) !== (prior[1] > point[1]) &&
			point[0] < ((prior[0] - current[0]) * (point[1] - current[1])) / (prior[1] - current[1]) + current[0];
		if (crosses) inside = !inside;
	}
	return inside;
}

/** A non-sliver input edge, with the sign of its polygon's winding. Its polygon is
 * inside the union, so the inside of any union boundary it lies on is its own side. */
type OwnerEdge = { readonly a: LayoutVec2; readonly b: LayoutVec2; readonly sign: 1 | -1 };

function ownerEdgesOf(polygons: readonly (readonly LayoutVec2[])[]): OwnerEdge[] {
	const owners: OwnerEdge[] = [];
	for (const polygon of polygons) {
		const sign: 1 | -1 = signedArea(polygon) > 0 ? 1 : -1;
		for (let index = 0; index < polygon.length; index += 1) {
			owners.push({ a: polygon[index]!, b: polygon[(index + 1) % polygon.length]!, sign });
		}
	}
	return owners;
}

/**
 * +1 when the union's inside is on the left of `start → end`, -1 when on the right.
 * Null when no owner edge lies on the piece, or when owners disagree, which is a
 * boundary piece that merges two sides of a touching point. The caller then keeps
 * the raw polygons instead of guessing an orientation.
 */
function insideSideOf(start: LayoutVec2, end: LayoutVec2, owners: readonly OwnerEdge[]): 1 | -1 | null {
	const length = Math.hypot(end[0] - start[0], end[1] - start[1]);
	if (!(length > RING_EPSILON)) return null;
	const ux = (end[0] - start[0]) / length;
	const uz = (end[1] - start[1]) / length;
	let side: 1 | -1 | null = null;
	for (const owner of owners) {
		const ax = owner.a[0] - start[0];
		const az = owner.a[1] - start[1];
		const bx = owner.b[0] - start[0];
		const bz = owner.b[1] - start[1];
		if (Math.abs(ux * az - uz * ax) > RING_EPSILON || Math.abs(ux * bz - uz * bx) > RING_EPSILON) continue;
		const ta = ax * ux + az * uz;
		const tb = bx * ux + bz * uz;
		const overlap = Math.min(Math.max(ta, tb), length) - Math.max(Math.min(ta, tb), 0);
		if (!(overlap > RING_EPSILON)) continue;
		// The owner's inside is on its left when it runs a → b, so the piece's inside
		// is on its left when the owner runs with the piece, and its right otherwise.
		const required: 1 | -1 = owner.sign * (tb > ta ? 1 : -1) === 1 ? 1 : -1;
		if (side !== null && side !== required) return null;
		side = required;
	}
	return side;
}

/**
 * The union of overlapping polygons as non-overlapping outer rings with their holes.
 *
 * The boundary comes from `unionOutline`, oriented so the union is on the left of
 * every directed edge, then stitched into closed loops. At a touching point the
 * loop turns clockwise from its way back, which keeps touching regions separate.
 * Outer rings are counter-clockwise and holes clockwise; each hole belongs to the
 * smallest outer ring that contains it.
 *
 * Returns null, and the caller keeps the raw polygons, whenever the boundary does
 * not close consistently (no positive-area input, unmatched or conflicting pieces).
 * It never throws.
 */
export function unionPaperFillPolygons(polygons: readonly (readonly LayoutVec2[])[]): PaperFillUnion | null {
	// A zero-area polygon (a vertical face's projected sliver) covers no region, so
	// dropping it cannot change the union, and its collinear vertices never reach
	// the boundary's containment probes.
	const solid = polygons.filter((polygon) => polygon.length >= 3 && Math.abs(signedArea(polygon)) > AREA_EPSILON);
	if (solid.length === 0) return null;
	const boundary = unionOutline(solid);
	if (boundary.length === 0) return null;
	const owners = ownerEdgesOf(solid);

	const nodes: LayoutVec2[] = [];
	const nodeIds = new Map<string, number>();
	const round = (value: number): number => Math.round(value * 1e6) / 1e6;
	const nodeOf = (point: LayoutVec2): number => {
		const key = `${round(point[0])},${round(point[1])}`;
		const known = nodeIds.get(key);
		if (known !== undefined) return known;
		nodes.push(point);
		nodeIds.set(key, nodes.length - 1);
		return nodes.length - 1;
	};

	const edges: { readonly from: number; readonly to: number }[] = [];
	for (const [start, end] of boundary) {
		const side = insideSideOf(start, end, owners);
		if (side === null) return null;
		const [from, to] = side === 1 ? [start, end] : [end, start];
		edges.push({ from: nodeOf(from), to: nodeOf(to) });
	}

	const outgoing: number[][] = nodes.map(() => []);
	const incoming = new Array<number>(nodes.length).fill(0);
	edges.forEach((edge, index) => {
		outgoing[edge.from]!.push(index);
		incoming[edge.to]! += 1;
	});
	// A closed boundary has as many edges leaving each point as entering it.
	if (outgoing.some((list, node) => list.length !== incoming[node])) return null;

	const nextEdge = (incomingEdge: number): number | null => {
		const { from, to } = edges[incomingEdge]!;
		const vertex = nodes[to]!;
		const back = Math.atan2(nodes[from]![1] - vertex[1], nodes[from]![0] - vertex[0]);
		let best: number | null = null;
		let bestTurn = Infinity;
		for (const candidate of outgoing[to]!) {
			const target = nodes[edges[candidate]!.to]!;
			const forward = Math.atan2(target[1] - vertex[1], target[0] - vertex[0]);
			let turn = (back - forward) % TAU;
			if (turn < 0) turn += TAU;
			if (turn <= ANGLE_EPSILON) turn = TAU;
			if (turn < bestTurn) {
				best = candidate;
				bestTurn = turn;
			}
		}
		return best;
	};

	const used = new Array<boolean>(edges.length).fill(false);
	const rings: LayoutVec2[][] = [];
	for (let first = 0; first < edges.length; first += 1) {
		if (used[first]) continue;
		const ring: LayoutVec2[] = [];
		let current = first;
		for (;;) {
			if (used[current]) return null;
			used[current] = true;
			ring.push(nodes[edges[current]!.from]!);
			const next = nextEdge(current);
			if (next === null) return null;
			if (next === first) break;
			current = next;
		}
		if (ring.length < 3) return null;
		rings.push(ring);
	}

	const outers: LayoutVec2[][] = [];
	const holeRings: LayoutVec2[][] = [];
	for (const ring of rings) {
		const area = signedArea(ring);
		if (!(Math.abs(area) > AREA_EPSILON)) return null;
		if (area > 0) outers.push(ring);
		else holeRings.push(ring);
	}
	if (outers.length === 0) return null;

	const holes: LayoutVec2[][][] = outers.map(() => []);
	for (const hole of holeRings) {
		// An edge of a hole is never on another ring's edge, so its midpoint decides containment.
		const first = hole[0]!;
		const second = hole[1]!;
		const probe: LayoutVec2 = [(first[0] + second[0]) / 2, (first[1] + second[1]) / 2];
		let parent = -1;
		let parentArea = Infinity;
		outers.forEach((outer, index) => {
			const area = signedArea(outer);
			if (area < parentArea && pointInRing(probe, outer)) {
				parent = index;
				parentArea = area;
			}
		});
		if (parent < 0) return null;
		holes[parent]!.push(hole);
	}
	return { polygons: outers, holes };
}
