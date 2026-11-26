import type { LayoutVec2 } from '../coordinates';
import type { LayoutDocumentWallFirst, LayoutJunction, LayoutWall } from '../../wall/types';
import { orientXZ } from '../robust-orientation';
import type { WallSamplingDerivation } from '../../wall/centerline';
import { wallCenterlineSamples } from '../../wall/centerline';
import type { SampledSegment } from '../curve';
import type {
	DerivedCandidateFace,
	FaceExtractionResult,
	HalfEdge,
	TopologyDiagnostic,
} from './contracts';
import { canonicalFaceKey, keyFloorlessTokens } from './identity';
import { polygonSignedArea, reportNestedLoops } from './polygons';

export function extractBoundaryCandidateFaces(
	document: LayoutDocumentWallFirst,
	sampling?: WallSamplingDerivation,
): FaceExtractionResult {
	const diagnostics: TopologyDiagnostic[] = [];
	const junctionById = new Map(document.junctions.map((junction) => [junction.id, junction]));
	const wallById = new Map(document.walls.map((wall) => [wall.id, wall]));
	// Format 6 — every Wall participates. There is no authored `role` to filter on:
	// a closed ring encloses whatever Walls form it, and a Wall that closes no ring
	// simply produces no face. This is the same membership the derived role reads
	// (`deriveLayoutWallRole`), so face extraction and the Card fact cannot disagree.
	const boundaryWalls = document.walls;

	// --- dangle detection (recursive degree-1 boundary edges) -------------
	const { faceGraphWalls, danglingWallIds } = stripDangles(boundaryWalls, junctionById);
	for (const wallId of danglingWallIds) {
		diagnostics.push({
			code: 'boundary_dangle',
			message: `Wall '${wallId}' has a degree-1 endpoint and is excluded from face extraction`,
			wallId,
		});
	}

	// --- directed half-edges ----------------------------------------------
	const halfEdges: HalfEdge[] = [];
	for (const wall of faceGraphWalls) {
		halfEdges.push({
			fromId: wall.startJunctionId,
			toId: wall.endJunctionId,
			wallId: wall.id,
			direction: 'forward',
		});
		halfEdges.push({
			fromId: wall.endJunctionId,
			toId: wall.startJunctionId,
			wallId: wall.id,
			direction: 'reverse',
		});
	}

	// Outgoing half-edges by junction, robustly ordered by **departure
	// direction**. A straight Wall departs along its chord (unchanged); a curved
	// Wall departs along the first canonical sample's tangent, which is the same
	// derivation Junction resolution and the mesh consume. Ordering by chord
	// merges Rooms whenever a bent Wall leaves a Junction on the other side of a
	// neighbour (B1).
	// The ordering pass derives each curved half-edge's sampled centerline once.
	// The polygon pass below reuses that same array, so departure ordering adds
	// no sampling call to the consumer count the observations pin.
	const departureByEdge = new Map<string, { ray: DepartureRay; sampled?: SampledSegment }>();
	const departureOf = (edge: HalfEdge): DepartureRay => {
		const key = `${edge.wallId}|${edge.direction}`;
		const cached = departureByEdge.get(key);
		if (cached) return cached.ray;
		const resolution = resolveDepartureRay(edge, junctionById, wallById, sampling);
		departureByEdge.set(key, resolution);
		return resolution.ray;
	};
	const outgoing = new Map<string, HalfEdge[]>();
	for (const edge of halfEdges) {
		const list = outgoing.get(edge.fromId);
		if (list) list.push(edge);
		else outgoing.set(edge.fromId, [edge]);
	}
	for (const [junctionId, edges] of outgoing) {
		const origin = junctionById.get(junctionId)!.point;
		edges.sort((a, b) => compareOutgoingEdges(origin, departureOf(a), departureOf(b), a, b));
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
				wallId: ring[0]?.wallId,
			});
			continue;
		}

		const boundaryRefs = ring.map((half) => ({
			wallId: half.wallId,
			direction: half.direction,
		}));
		// The geometric face polygon expands each curved Wall into its
		// canonical sampled centerline vertices in traversal order (samples
		// between the ring's junction endpoints; each edge's start junction is
		// the previous edge's end and is omitted). Straight walls contribute
		// exactly their start junction, matching the pre-curve polygon. These
		// sampled vertices are evidence only — never persisted as Room vertices.
		const polygon: LayoutVec2[] = [];
		for (const half of ring) {
			const junction = junctionById.get(half.fromId)!;
			polygon.push(junction.point);
			const wall = wallById.get(half.wallId);
			if (!wall || wall.centerline.kind === 'line') continue;
			// The half-edge knows its own traversal, so the adapter mirrors the
			// chain for a reverse edge (endpoint swapping alone would trace a
			// different curve). Endpoints are passed canonically — the traversal
			// flag is the only direction authority.
			const start = junctionById.get(wall.startJunctionId)?.point;
			const end = junctionById.get(wall.endJunctionId)?.point;
			if (!start || !end) continue;
			const traversal = half.direction === 'reverse' ? 'reverse' : 'forward';
			const departure = departureByEdge.get(`${wall.id}|${half.direction}`);
			const sampled = departure
				? departure.sampled
				: sampling
					? sampling.samples(wall, start, end, traversal)
					: wallCenterlineSamples(wall, start, end, traversal);
			if (!sampled) continue;
			// Sampled points strictly between the two endpoints (drop both ends:
			// fromId is this edge's start, toId is the next edge's start).
			for (const sample of sampled.samples.slice(1, -1)) {
				polygon.push([...sample.point] as LayoutVec2);
			}
		}
		const signedArea = polygonSignedArea(polygon);

		if (!Number.isFinite(signedArea)) {
			diagnostics.push({
				code: 'invalid_face_ring',
				message: 'Face walk produced non-finite area',
				wallId: boundaryRefs[0]?.wallId,
			});
			continue;
		}
		if (signedArea === 0) {
			diagnostics.push({
				code: 'zero_area_face',
				message: 'Face walk produced a zero-area ring',
				wallId: boundaryRefs[0]?.wallId,
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
				wallId: wall.id,
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
 * working graph excludes them.
 */
function stripDangles(
	walls: readonly LayoutWall[],
	junctionById: Map<string, LayoutJunction>,
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
		danglingWallIds: [...dangling, ...nested.danglingWallIds],
	};
}

/**
 * One half-edge's departure ray at its start Junction, plus the signed
 * curvature there for the degenerate collinear tie-break.
 *
 * `probe` is the point the quadrant/orientation comparison measures: the other
 * Junction for a straight Wall (its chord, exactly today's behaviour) or
 * `origin + tangent` for a curved one. `curvature` is CCW-positive
 * (cross(t0, t1) / ds).
 */
type DepartureRay = { probe: LayoutVec2; curvature: number };

function resolveDepartureRay(
	edge: HalfEdge,
	junctionById: Map<string, LayoutJunction>,
	wallById: Map<string, LayoutWall>,
	sampling?: WallSamplingDerivation,
): { ray: DepartureRay; sampled?: SampledSegment } {
	const wall = wallById.get(edge.wallId);
	const target = junctionById.get(edge.toId);
	const origin = junctionById.get(edge.fromId)?.point;
	if (!origin) return { ray: { probe: [0, 0] as LayoutVec2, curvature: 0 } };
	if (!wall || wall.centerline.kind === 'line' || !target) {
		// Straight Wall: its chord *is* its departure direction.
		return {
			ray: {
				probe: target ? target.point : ([origin[0] + 1, origin[1]] as LayoutVec2),
				curvature: 0,
			},
		};
	}
	const start = junctionById.get(wall.startJunctionId)?.point;
	const end = junctionById.get(wall.endJunctionId)?.point;
	if (!start || !end) return { ray: { probe: target.point, curvature: 0 } };
	const traversal = edge.direction === 'reverse' ? 'reverse' : 'forward';
	const sampled = sampling
		? sampling.samples(wall, start, end, traversal)
		: wallCenterlineSamples(wall, start, end, traversal);
	const first = sampled?.samples[0];
	if (!sampled || !first) return { ray: { probe: target.point, curvature: 0 }, sampled };
	const tangent = first.tangent;
	const hasDirection =
		Number.isFinite(tangent[0]) &&
		Number.isFinite(tangent[1]) &&
		Math.hypot(tangent[0], tangent[1]) > 1e-12;
	if (!hasDirection) return { ray: { probe: target.point, curvature: 0 }, sampled };
	let curvature = 0;
	const second = sampled.samples[1];
	if (second) {
		const ds = second.distance - first.distance;
		if (ds > 1e-12) {
			const cross = first.tangent[0] * second.tangent[1] - first.tangent[1] * second.tangent[0];
			curvature = cross / ds;
		}
	}
	return {
		ray: { probe: [origin[0] + tangent[0], origin[1] + tangent[1]] as LayoutVec2, curvature },
		sampled,
	};
}

/**
 * Quadrant-then-orientation comparison of two outgoing **departure** rays at a
 * junction (JTS DirectedEdge.compareDirection pattern via robust orientation;
 * H3 §10.2). Returns < 0 when `a` comes before `b` in clockwise radial order.
 *
 * Exactly collinear departures cannot occur in valid minimum topology
 * (duplicate/overlapping Walls are rejected upstream). When they do appear, the
 * Wall that turns more counter-clockwise sorts first, then the stable Wall id
 * as a diagnostic tie-break.
 */
function compareOutgoingEdges(
	origin: LayoutVec2,
	aRay: DepartureRay,
	bRay: DepartureRay,
	a: HalfEdge,
	b: HalfEdge,
): number {
	if (a.wallId === b.wallId && a.direction === b.direction) return 0;
	const aTarget = aRay.probe;
	const bTarget = bRay.probe;

	const quadrantA = quadrantOf(aTarget[0] - origin[0], aTarget[1] - origin[1]);
	const quadrantB = quadrantOf(bTarget[0] - origin[0], bTarget[1] - origin[1]);
	if (quadrantA !== quadrantB) return quadrantA - quadrantB;

	// Same quadrant: robust orientation of the two rays from the origin.
	// orientXZ(origin, a, b) > 0 ⇒ b is counter-clockwise (left) of ray a ⇒ a
	// comes first in clockwise order.
	const sign = orientXZ(origin, aTarget, bTarget);
	if (sign > 0) return -1;
	if (sign < 0) return 1;
	if (aRay.curvature !== bRay.curvature) return bRay.curvature - aRay.curvature;
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
 * the current edge), keeping the face on the left.
 */
function nextCounterClockwiseFaceEdge(
	outgoing: Map<string, HalfEdge[]>,
	current: HalfEdge,
): HalfEdge | undefined {
	const star = outgoing.get(current.toId);
	if (!star || star.length === 0) return undefined;
	// Twin by Wall and opposite direction. `(toId, wallId)` is the same result
	// for every non-loop Wall, but it is ambiguous on a self-connected Wall,
	// where both half-edges leave the same seam Junction (B2).
	const twinIndex = star.findIndex(
		(edge) => edge.wallId === current.wallId && edge.direction !== current.direction,
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
