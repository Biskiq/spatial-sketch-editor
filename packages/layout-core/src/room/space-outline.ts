/**
 * `layout-space-outline.ts` — the pure outline predicates shared by the
 * compiler's placement gate and Room reconciliation.
 *
 * This module deliberately knows nothing about documents, Rooms or Walls: it
 * takes composed X/Z polygons and answers outline queries (positive
 * signed area, self-intersection, containment, pair conflict). Keeping it free
 * of `layout-room-reconciliation.ts` and `layout-space-placement.ts` is what
 * lets both import one authority without a circular dependency:
 *
 * ```text
 * layout-space-placement → layout-room-reconciliation → layout-space-outline
 * ```
 */
import type { LayoutVec2 } from '../geometry/coordinates';
import { pointStrictlyInsidePolygon, polygonsShareInteriorArea } from '../geometry/face-extraction';
import { orientXZ } from '../geometry/robust-orientation';
import { classifyWallIntersection } from '../wall/topology';

/** Signed shoelace area of a composed outline in X/Z (positive = face orientation). */
export function spaceOutlineSignedArea(polygon: readonly LayoutVec2[]): number {
	if (polygon.length < 3) return 0;
	const origin = polygon[0]!;
	const shift = Math.abs(origin[0]) > 1e6 || Math.abs(origin[1]) > 1e6;
	const ox = shift ? origin[0] : 0;
	const oz = shift ? origin[1] : 0;
	let sum = 0;
	for (let index = 0; index < polygon.length; index += 1) {
		const current = polygon[index]!;
		const next = polygon[(index + 1) % polygon.length]!;
		sum += (current[0] - ox) * (next[1] - oz) - (next[0] - ox) * (current[1] - oz);
	}
	return sum / 2;
}

/** Point lies exactly on the closed ring (robust collinearity). */
export function pointOnRing(polygon: readonly LayoutVec2[], point: LayoutVec2): boolean {
	for (let index = 0; index < polygon.length; index += 1) {
		const a = polygon[index]!;
		const b = polygon[(index + 1) % polygon.length]!;
		if (orientXZ(a, b, point) !== 0) continue;
		if (
			point[0] >= Math.min(a[0], b[0]) &&
			point[0] <= Math.max(a[0], b[0]) &&
			point[1] >= Math.min(a[1], b[1]) &&
			point[1] <= Math.max(a[1], b[1])
		) {
			return true;
		}
	}
	return false;
}

/** Two segments cross at a point interior to both; shared endpoints never count. */
function segmentsCrossProperly(
	a: LayoutVec2,
	b: LayoutVec2,
	c: LayoutVec2,
	d: LayoutVec2,
): boolean {
	const o1 = orientXZ(a, b, c);
	const o2 = orientXZ(a, b, d);
	const o3 = orientXZ(c, d, a);
	const o4 = orientXZ(c, d, b);
	return o1 * o2 < 0 && o3 * o4 < 0;
}

const OUTLINE_EPSILON = 1e-9;

function pointsCoincide(a: LayoutVec2, b: LayoutVec2): boolean {
	return Math.abs(a[0] - b[0]) <= OUTLINE_EPSILON && Math.abs(a[1] - b[1]) <= OUTLINE_EPSILON;
}

/** Non-adjacent edges that share a positive-length collinear run. */
function collinearOverlap(a: LayoutVec2, b: LayoutVec2, c: LayoutVec2, d: LayoutVec2): boolean {
	if (orientXZ(a, b, c) !== 0 || orientXZ(a, b, d) !== 0) return false;
	const dx = b[0] - a[0];
	const dz = b[1] - a[1];
	const lengthSquared = dx * dx + dz * dz;
	if (lengthSquared <= OUTLINE_EPSILON * OUTLINE_EPSILON) return false;
	const t0 = ((c[0] - a[0]) * dx + (c[1] - a[1]) * dz) / lengthSquared;
	const t1 = ((d[0] - a[0]) * dx + (d[1] - a[1]) * dz) / lengthSquared;
	const overlap = Math.min(1, Math.max(t0, t1)) - Math.max(0, Math.min(t0, t1));
	return overlap * Math.sqrt(lengthSquared) > OUTLINE_EPSILON;
}

/**
 * True when the composed outline crosses or pinches itself. Adjacent edges
 * legitimately share an endpoint; a repeated non-adjacent vertex is a pinch.
 */
export function spaceOutlineSelfIntersects(polygon: readonly LayoutVec2[]): boolean {
	const count = polygon.length;
	if (count < 4) return false;
	for (let first = 0; first < count; first += 1) {
		const a = polygon[first]!;
		const b = polygon[(first + 1) % count]!;
		for (let second = first + 1; second < count; second += 1) {
			if (second === first + 1 || (first === 0 && second === count - 1)) continue;
			const c = polygon[second]!;
			const d = polygon[(second + 1) % count]!;
			if (segmentsCrossProperly(a, b, c, d)) return true;
			if (collinearOverlap(a, b, c, d)) return true;
			const contact = classifyWallIntersection(
				{ id: 'first', start: a, end: b },
				{ id: 'second', start: c, end: d },
			);
			if (contact.kind === 'endpoint-on-interior') return true;
		}
	}
	for (let first = 0; first < count; first += 1) {
		for (let second = first + 1; second < count; second += 1) {
			if (second === first + 1 || (first === 0 && second === count - 1)) continue;
			if (pointsCoincide(polygon[first]!, polygon[second]!)) return true;
		}
	}
	return false;
}

/**
 * True when `inner` lies wholly inside `outer`: every vertex is inside or on
 * the ring, and no edge pair crosses properly. Shared edges and touching
 * vertices remain containment, which is what a booth inside a hall is.
 */
export function polygonContainsPolygon(
	outer: readonly LayoutVec2[],
	inner: readonly LayoutVec2[],
): boolean {
	if (inner.length < 3 || outer.length < 3) return false;
	for (const point of inner) {
		if (pointStrictlyInsidePolygon(outer, point)) continue;
		if (pointOnRing(outer, point)) continue;
		return false;
	}
	for (let a = 0; a < outer.length; a += 1) {
		const a0 = outer[a]!;
		const a1 = outer[(a + 1) % outer.length]!;
		for (let b = 0; b < inner.length; b += 1) {
			const b0 = inner[b]!;
			const b1 = inner[(b + 1) % inner.length]!;
			if (segmentsCrossProperly(a0, a1, b0, b1)) return false;
		}
	}
	return true;
}

/**
 * The I7 verdict for one ordered pair whose polygons already composed.
 * `openA`/`openB` say which sides state virtual edges. The one admitted
 * nesting is an open Space wholly inside an enclosed Room; enclosed/enclosed
 * pairs never reach this function (the caller keeps today's permissive rule).
 */
export function spacePairIssue(
	polygonA: readonly LayoutVec2[],
	polygonB: readonly LayoutVec2[],
	openA: boolean,
	openB: boolean,
): 'space_overlap' | 'space_contains_space' | null {
	if (!openA && !openB) return null;
	if (!polygonsShareInteriorArea(polygonA, polygonB)) return null;
	const aContainsB = polygonContainsPolygon(polygonA, polygonB);
	const bContainsA = polygonContainsPolygon(polygonB, polygonA);
	if (openA && !openB && bContainsA) return null;
	if (openB && !openA && aContainsB) return null;
	if (aContainsB || bContainsA) return 'space_contains_space';
	return 'space_overlap';
}
