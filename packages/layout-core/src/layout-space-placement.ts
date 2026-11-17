/**
 * `layout-space-placement.ts` — the one placement gate between Spaces.
 *
 * I7 in words: two Spaces of which at least one is open share no interior
 * area, unless the open one lies wholly inside an enclosed one. Enclosed /
 * enclosed pairs keep today's permissive rule. Touching along an edge is not
 * sharing interior area.
 *
 * The compiler calls this as blocking issues and the certified world index
 * calls it as a certification predicate, so a Wall stroke, a Room move or a
 * duplicate can never commit an overlap through a path that skipped the gate.
 */
import type { LayoutVec2 } from './layout-coordinates';
import { pointStrictlyInsidePolygon, polygonsShareInteriorArea } from './layout-face-extraction';
import { orientXZ } from './layout-robust-orientation';
import { roomBoundaryPolygon } from './layout-room-reconciliation';
import type { LayoutDocumentWallFirst, LayoutWallFirstRoom } from './layout-wall-first-types';

export type SpacePlacementIssue = {
	code: 'space_overlap' | 'space_contains_space';
	message: string;
	roomIds: readonly [string, string];
};

/** Signed shoelace area of a composed outline in X/Z (positive = face orientation). */
export function spaceOutlineSignedArea(polygon: readonly LayoutVec2[]): number {
	let sum = 0;
	for (let index = 0; index < polygon.length; index += 1) {
		const current = polygon[index]!;
		const next = polygon[(index + 1) % polygon.length]!;
		sum += current[0] * next[1] - next[0] * current[1];
	}
	return sum / 2;
}

/** Point lies exactly on the closed ring (robust collinearity). */
function pointOnRing(polygon: readonly LayoutVec2[], point: LayoutVec2): boolean {
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
function segmentsCrossProperly(a: LayoutVec2, b: LayoutVec2, c: LayoutVec2, d: LayoutVec2): boolean {
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
	inner: readonly LayoutVec2[]
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
 * Every I7 violation between the document's Spaces.
 *
 * Only a pair with at least one open Space is examined, and a composed outline
 * that cannot resolve is skipped here: the codec and the compiler report that
 * boundary failure with its own code, never as a placement conflict.
 */
export function spacePlacementIssues(document: LayoutDocumentWallFirst): SpacePlacementIssue[] {
	const openRooms = document.rooms.filter((room) => room.virtualEdges.length > 0);
	if (openRooms.length === 0) return [];
	const polygons = new Map<string, readonly LayoutVec2[]>();
	for (const room of document.rooms) {
		const polygon = roomBoundaryPolygon(document, room.id);
		if (polygon) polygons.set(room.id, polygon);
	}
	const issues: SpacePlacementIssue[] = [];
	for (let first = 0; first < document.rooms.length; first += 1) {
		const a = document.rooms[first]!;
		const polygonA = polygons.get(a.id);
		if (!polygonA) continue;
		for (let second = first + 1; second < document.rooms.length; second += 1) {
			const b = document.rooms[second]!;
			const polygonB = polygons.get(b.id);
			if (!polygonB) continue;
			const aOpen = isOpenSpace(a);
			const bOpen = isOpenSpace(b);
			if (!aOpen && !bOpen) continue;
			if (!polygonsShareInteriorArea(polygonA, polygonB)) continue;
			const aContainsB = polygonContainsPolygon(polygonA, polygonB);
			const bContainsA = polygonContainsPolygon(polygonB, polygonA);
			// The one admitted nesting: an open Space wholly inside an enclosed Room.
			if (aOpen && !bOpen && bContainsA) continue;
			if (bOpen && !aOpen && aContainsB) continue;
			if (aContainsB || bContainsA) {
				issues.push({
					code: 'space_contains_space',
					message: `Space '${a.name}' and Space '${b.name}' contain one another`,
					roomIds: [a.id, b.id]
				});
				continue;
			}
			issues.push({
				code: 'space_overlap',
				message: `Space '${a.name}' overlaps Space '${b.name}'`,
				roomIds: [a.id, b.id]
			});
		}
	}
	return issues;
}

/** A Space is open when it states virtual edges; `open-to-sky` is an overhead reading, not topology. */
export function isOpenSpace(room: Pick<LayoutWallFirstRoom, 'virtualEdges'>): boolean {
	return room.virtualEdges.length > 0;
}
