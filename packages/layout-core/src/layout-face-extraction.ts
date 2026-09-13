/**
 * `layout-face-extraction.ts` — P23.8 boundary-Wall candidate-face
 * extraction (H3 §10).
 *
 * Runs over `role: 'boundary'` walls only; partitions are excluded entirely
 * from semantic face extraction. Emits deterministic **candidate faces**
 * only — this module never allocates, retires or otherwise owns persistent
 * `LayoutRoom` identity (hard H3/H5 boundary). Room correspondence happens
 * in `layout-room-reconciliation.ts` on top of these candidates.
 *
 * Pipeline (H3 §10.1):
 *
 * ```text
 * validated boundary wall graph
 * → exclude dangles from the face working graph (diagnose, never delete)
 * → directed half-edges
 * → robust outgoing-edge ordering (quadrant + orientXZ, never atan2 alone)
 * → oriented ring traversal (face kept on the left of each traversed edge)
 * → bounded faces kept (positive area), unbounded outer walk discarded
 * → cut-edge / invalid-ring / nested-loop diagnostics
 * ```
 *
 * Face keys are deterministic temporary keys derived from the oriented
 * boundary cycle (rotation-normalized `wallId:direction` tokens through the
 * collision-safe `geometryId()` helper). They are NOT room IDs and are never
 * persisted as product identity.
 */
import { geometryId } from './layout-geometry-types';
import type { LayoutVec2 } from './layout-types';
import type { LayoutDocumentWallFirst, LayoutJunction, LayoutWall } from './layout-wall-first-types';
import { orientXZ } from './layout-robust-orientation';

export type TopologyDiagnostic = {
	code:
		| 'boundary_dangle'
		| 'boundary_cut_edge'
		| 'invalid_face_ring'
		| 'zero_area_face'
		| 'nested_boundary_loop'
		| 'touching_nested_loop';
	message: string;
	/** Involved authored IDs where available. */
	wallId?: string;
	faceKey?: string;
};

export type DerivedCandidateFace = {
	/** Deterministic ephemeral topology key; never a Room ID. */
	key: string;
	boundary: ReadonlyArray<{ wallId: string; direction: 'forward' | 'reverse' }>;
	/** Ordered vertices of the oriented cycle (interior on the left). */
	polygon: readonly LayoutVec2[];
	signedArea: number;
};

export type FaceExtractionResult = {
	faces: DerivedCandidateFace[];
	diagnostics: TopologyDiagnostic[];
	/** Boundary wall IDs excluded from the face graph as dangles. */
	danglingWallIds: string[];
	/** Boundary wall IDs that form no bounded face (cut edges / bridges). */
	cutEdgeWallIds: string[];
};

type HalfEdge = {
	/** Directed edge: from junction `fromId` to junction `toId`. */
	fromId: string;
	toId: string;
	wallId: string;
	direction: 'forward' | 'reverse';
};

export function extractBoundaryCandidateFaces(
	document: LayoutDocumentWallFirst
): FaceExtractionResult {
	const diagnostics: TopologyDiagnostic[] = [];
	const junctionById = new Map(document.junctions.map((junction) => [junction.id, junction]));
	const boundaryWalls = document.walls.filter((wall) => wall.role === 'boundary');

	// --- dangle detection (recursive degree-1 boundary edges) -------------
	const { faceGraphWalls, danglingWallIds } = stripDangles(boundaryWalls, junctionById);
	for (const wallId of danglingWallIds) {
		diagnostics.push({
			code: 'boundary_dangle',
			message: `Boundary wall '${wallId}' has a degree-1 endpoint and is excluded from face extraction`,
			wallId
		});
	}

	// --- directed half-edges ----------------------------------------------
	const halfEdges: HalfEdge[] = [];
	for (const wall of faceGraphWalls) {
		halfEdges.push({
			fromId: wall.startJunctionId,
			toId: wall.endJunctionId,
			wallId: wall.id,
			direction: 'forward'
		});
		halfEdges.push({
			fromId: wall.endJunctionId,
			toId: wall.startJunctionId,
			wallId: wall.id,
			direction: 'reverse'
		});
	}

	// Outgoing half-edges by junction, robustly ordered.
	const outgoing = new Map<string, HalfEdge[]>();
	for (const edge of halfEdges) {
		const list = outgoing.get(edge.fromId);
		if (list) list.push(edge);
		else outgoing.set(edge.fromId, [edge]);
	}
	for (const [junctionId, edges] of outgoing) {
		edges.sort((a, b) => compareOutgoingEdges(junctionById, junctionId, a, b));
	}

	// --- face walk ---------------------------------------------------------
	const visited = new Set<HalfEdge>();
	const faces: DerivedCandidateFace[] = [];
	const faceIncidence = new Map<string, Set<string>>();
	let walkCount = 0;
	const maxWalks = halfEdges.length * 2 + 16;

	for (const edge of halfEdges) {
		if (visited.has(edge)) continue;
		const ring: HalfEdge[] = [];
		let current: HalfEdge = edge;
		let closed = false;
		while (walkCount++ < maxWalks) {
			if (visited.has(current)) {
				if (ring[0] === current) closed = true;
				break;
			}
			visited.add(current);
			ring.push(current);
			const next = nextCounterClockwiseFaceEdge(outgoing, current);
			if (!next) break;
			if (next === edge) {
				closed = true;
				break;
			}
			if (visited.has(next)) break;
			current = next;
		}

		if (!closed) {
			diagnostics.push({
				code: 'invalid_face_ring',
				message: 'Face walk repeated a directed edge before closure',
				wallId: ring[0]?.wallId
			});
			continue;
		}

		const boundaryRefs = ring.map((half) => ({
			wallId: half.wallId,
			direction: half.direction
		}));
		const polygon = ring.map((half) => {
			const junction = junctionById.get(half.fromId)!;
			return junction.point;
		});
		const signedArea = polygonSignedArea(polygon);

		if (!Number.isFinite(signedArea)) {
			diagnostics.push({
				code: 'invalid_face_ring',
				message: 'Face walk produced non-finite area',
				wallId: boundaryRefs[0]?.wallId
			});
			continue;
		}
		if (signedArea === 0) {
			diagnostics.push({
				code: 'zero_area_face',
				message: 'Face walk produced a zero-area ring',
				wallId: boundaryRefs[0]?.wallId
			});
			continue;
		}
		// Convention: bounded faces traverse with interior on the left
		// (positive signed area under the Museum X/Z convention). The
		// unbounded outer component walks the opposite way and is discarded.
		if (signedArea < 0) continue;

		const key = canonicalFaceKey(keyFloorlessTokens(boundaryRefs));
		for (const ref of boundaryRefs) {
			const set = faceIncidence.get(ref.wallId);
			if (set) set.add(key);
			else faceIncidence.set(ref.wallId, new Set([key]));
		}
		faces.push({ key, boundary: boundaryRefs, polygon, signedArea });
	}

	// --- cut edges: boundary walls with no bounded-face incidence ----------
	const faceWallIds = new Set(faces.flatMap((face) => face.boundary.map((ref) => ref.wallId)));
	const cutEdgeWallIds: string[] = [];
	for (const wall of faceGraphWalls) {
		if (!faceWallIds.has(wall.id)) {
			cutEdgeWallIds.push(wall.id);
			diagnostics.push({
				code: 'boundary_cut_edge',
				message: `Boundary wall '${wall.id}' has no bounded-face incidence`,
				wallId: wall.id
			});
		}
	}

	// --- nesting: bounded faces fully contained in another bounded face ----
	reportNestedLoops(faces, diagnostics);

	faces.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));

	return { faces, diagnostics, danglingWallIds, cutEdgeWallIds };
}

/**
 * Recursively strip degree-1 boundary walls from the face working graph.
 * Authored walls are diagnosed and retained in the document; only the face
 * working graph excludes them (H3 §10.5).
 */
function stripDangles(
	walls: readonly LayoutWall[],
	junctionById: Map<string, LayoutJunction>
): { faceGraphWalls: LayoutWall[]; danglingWallIds: string[] } {
	const degree = new Map<string, number>();
	for (const wall of walls) {
		degree.set(wall.startJunctionId, (degree.get(wall.startJunctionId) ?? 0) + 1);
		degree.set(wall.endJunctionId, (degree.get(wall.endJunctionId) ?? 0) + 1);
	}
	const dangling: string[] = [];
	const kept = walls.filter((wall) => {
		const startDegree = degree.get(wall.startJunctionId) ?? 0;
		const endDegree = degree.get(wall.endJunctionId) ?? 0;
		if (startDegree === 1 || endDegree === 1) {
			dangling.push(wall.id);
			return false;
		}
		return true;
	});
	if (dangling.length === 0) {
		return { faceGraphWalls: [...walls], danglingWallIds: dangling };
	}
	if (kept.length === 0) {
		// Fully degenerate: every boundary wall was stripped, so the working
		// graph is empty. A tree carries no bounded faces — returning the
		// unstripped walls here made the face walk emit spurious
		// `zero_area_face` / `boundary_cut_edge` noise alongside the correct
		// dangle diagnostics (review round 1).
		return { faceGraphWalls: [], danglingWallIds: dangling };
	}
	// Recurse: stripping a dangle may expose another.
	const nested = stripDangles(kept, junctionById);
	return {
		faceGraphWalls: nested.faceGraphWalls,
		danglingWallIds: [...dangling, ...nested.danglingWallIds]
	};
}

/**
 * Quadrant-then-orientation comparison of two outgoing rays at a junction
 * (JTS DirectedEdge.compareDirection pattern via robust orientation; H3
 * §10.2). Returns < 0 when `a` comes before `b` in clockwise radial order.
 */
function compareOutgoingEdges(
	junctionById: Map<string, LayoutJunction>,
	fromId: string,
	a: HalfEdge,
	b: HalfEdge
): number {
	if (a.wallId === b.wallId && a.direction === b.direction) return 0;
	const origin = junctionById.get(fromId)!.point;
	const aTarget = junctionById.get(a.toId)!.point;
	const bTarget = junctionById.get(b.toId)!.point;

	const quadrantA = quadrantOf(aTarget[0] - origin[0], aTarget[1] - origin[1]);
	const quadrantB = quadrantOf(bTarget[0] - origin[0], bTarget[1] - origin[1]);
	if (quadrantA !== quadrantB) return quadrantA - quadrantB;

	// Same quadrant: robust orientation of the two rays from the origin.
	// Rays are (origin→aTarget) and (origin→bTarget); orientXZ(origin, a, b)
	// > 0 means b is left of a→b... careful: we compare rays from origin, so
	// orientXZ(origin, aTarget, bTarget) > 0 ⇒ bTarget is counter-clockwise
	// (left) of ray a ⇒ a comes first in clockwise order.
	const sign = orientXZ(origin, aTarget, bTarget);
	if (sign > 0) return -1;
	if (sign < 0) return 1;
	// Exactly collinear same-direction rays cannot occur in valid minimum
	// topology (duplicate/overlapping walls rejected upstream); fall back to
	// stable wall ID as a diagnostic tie-break (H3 §10.2).
	if (a.wallId === b.wallId) return a.direction < b.direction ? -1 : 1;
	return a.wallId < b.wallId ? -1 : a.wallId > b.wallId ? 1 : 0;
}

function quadrantOf(dx: number, dy: number): number {
	// Deterministic quadrants for the half-plane classification:
	// 0: NE (dx>0, dy>=0) · 1: NW (dx<=0, dy>0) · 2: SW (dx<0, dy<=0) · 3: SE (dx>=0, dy<0)
	if (dx > 0 && dy >= 0) return 0;
	if (dx <= 0 && dy > 0) return 1;
	if (dx < 0 && dy <= 0) return 2;
	return 3;
}

/**
 * Next half-edge around the face: at the current edge's target junction,
 * take the outgoing edge immediately clockwise from the twin (reverse of
 * the current edge), keeping the face on the left (H3 §10.3).
 */
function nextCounterClockwiseFaceEdge(
	outgoing: Map<string, HalfEdge[]>,
	current: HalfEdge
): HalfEdge | undefined {
	const star = outgoing.get(current.toId);
	if (!star || star.length === 0) return undefined;
	const twinIndex = star.findIndex(
		(edge) => edge.toId === current.fromId && edge.wallId === current.wallId
	);
	if (twinIndex === -1) {
		// Dangling target (non-manifold in the working graph): no twin.
		return undefined;
	}
	// Star is sorted in clockwise radial order; the face keeps the interior
	// on the left, so the next edge is the one immediately *after* the twin
	// in clockwise order (i.e. the first edge counter-clockwise from the
	// incoming direction... concretely: index twinIndex - 1, wrapping).
	const nextIndex = (twinIndex - 1 + star.length) % star.length;
	return star[nextIndex];
}

/**
 * Canonical **boundary-cycle key** for one oriented wall-reference cycle
 * (P23.6a S2). This is the single derivation used both by candidate-face
 * extraction (a face key) and by explicit boundary-lineage correspondence (a
 * persisted Room's `boundary` cycle): the token format and the
 * rotation-normalization live in exactly one place, so a face key and a Room
 * lineage key can never diverge.
 *
 * The key is temporarily-scoped evidence only — never persisted as Room
 * identity, and never a Room ID.
 */
export function canonicalBoundaryCycleKey(
	refs: ReadonlyArray<{ wallId: string; direction: 'forward' | 'reverse' }>
): string {
	return canonicalFaceKey(keyFloorlessTokens(refs));
}

function keyFloorlessTokens(
	boundary: ReadonlyArray<{ wallId: string; direction: 'forward' | 'reverse' }>
): string[] {
	return boundary.map((ref) => `${ref.wallId}~${ref.direction === 'forward' ? 'F' : 'R'}`);
}

/**
 * Canonical face key from the oriented cycle: rotate so the
 * lexicographically smallest token sequence comes first, then serialize with
 * the collision-safe `geometryId()` helper (H5 §4.2). The reversed cycle is
 * NOT considered — bounded traversal orientation is already canonical.
 */
function canonicalFaceKey(tokens: readonly string[]): string {
	let smallest: string[] = [...tokens];
	for (let rotation = 1; rotation < tokens.length; rotation += 1) {
		const candidate = [...tokens.slice(rotation), ...tokens.slice(0, rotation)];
		if (candidate.join('|') < smallest.join('|')) {
			smallest = candidate;
		}
	}
	return geometryId(['face', ...smallest]);
}

/** Signed area of a simple polygon (Museum X/Z convention). */
function polygonSignedArea(polygon: readonly LayoutVec2[]): number {
	let sum = 0;
	for (let index = 0; index < polygon.length; index += 1) {
		const current = polygon[index]!;
		const next = polygon[(index + 1) % polygon.length]!;
		sum += current[0] * next[1] - next[0] * current[1];
	}
	return sum / 2;
}

/**
 * Deterministic nesting detection (H3 §10.6): a bounded face whose polygon
 * is strictly inside another bounded face is a nested loop diagnostic; one
 * touching the outer face's boundary is reported as a touching nested loop.
 * No hole/Room semantics are synthesized in the P23 minimum.
 */
function reportNestedLoops(
	faces: readonly DerivedCandidateFace[],
	diagnostics: TopologyDiagnostic[]
): void {
	for (const outer of faces) {
		for (const inner of faces) {
			if (outer === inner || outer.signedArea <= inner.signedArea) continue;
			const witness = inner.polygon[0];
			if (!witness) continue;
			if (pointStrictlyInsidePolygon(outer.polygon, witness)) {
				diagnostics.push({
					code: 'nested_boundary_loop',
					message: `Face '${inner.key}' lies inside face '${outer.key}'`,
					faceKey: inner.key
				});
			} else if (pointOnPolygonBoundary(outer.polygon, witness)) {
				diagnostics.push({
					code: 'touching_nested_loop',
					message: `Face '${inner.key}' touches the boundary of face '${outer.key}'`,
					faceKey: inner.key
				});
			}
		}
	}
}

/** Point lies exactly on the polygon's boundary ring (robust collinearity). */
function pointOnPolygonBoundary(
	polygon: readonly LayoutVec2[],
	point: LayoutVec2
): boolean {
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

function pointStrictlyInsidePolygon(polygon: readonly LayoutVec2[], point: LayoutVec2): boolean {
	let inside = false;
	for (let index = 0; index < polygon.length; index += 1) {
		const a = polygon[index]!;
		const b = polygon[(index + 1) % polygon.length]!;
		const intersects =
			a[1] > point[1] !== b[1] > point[1] &&
			point[0] < ((b[0] - a[0]) * (point[1] - a[1])) / (b[1] - a[1]) + a[0];
		if (intersects) inside = !inside;
	}
	return inside;
}

/** Polygon area of a candidate face (exposed for reconciliation overlap math). */
export function faceArea(face: { polygon: readonly LayoutVec2[] }): number {
	return Math.abs(polygonSignedArea(face.polygon));
}

/** Area of the overlap between the face polygons of a predecessor region and a candidate. */
export function polygonIntersectionArea(
	a: readonly LayoutVec2[],
	b: readonly LayoutVec2[]
): number {
	// Exact polygon clipping is out of scope for the P23 minimum; H5 uses
	// overlap only as secondary evidence between classified candidates, where
	// a sampling-based measure on a shared grid is deterministic and adequate
	// for ranking. Use a lattice over the bounding box of the intersection.
	const minX = Math.max(
		Math.min(...a.map((p) => p[0])),
		Math.min(...b.map((p) => p[0]))
	);
	const maxX = Math.min(
		Math.max(...a.map((p) => p[0])),
		Math.max(...b.map((p) => p[0]))
	);
	const minY = Math.max(
		Math.min(...a.map((p) => p[1])),
		Math.min(...b.map((p) => p[1]))
	);
	const maxY = Math.min(
		Math.max(...a.map((p) => p[1])),
		Math.max(...b.map((p) => p[1]))
	);
	if (!(maxX > minX) || !(maxY > minY)) return 0;
	const steps = 64;
	const dx = (maxX - minX) / steps;
	const dy = (maxY - minY) / steps;
	let hits = 0;
	for (let ix = 0; ix < steps; ix += 1) {
		for (let iy = 0; iy < steps; iy += 1) {
			const px = minX + (ix + 0.5) * dx;
			const py = minY + (iy + 0.5) * dy;
			if (pointStrictlyInsidePolygon(a, [px, py]) && pointStrictlyInsidePolygon(b, [px, py])) {
				hits += 1;
			}
		}
	}
	return hits * dx * dy;
}

export { pointStrictlyInsidePolygon };
