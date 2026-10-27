/**
 * `layout-wall-chain-policy.ts` — T1.P02.S02's bounded drawing-policy refusals.
 *
 * `planWallChain` is the semantic authority and always was: it builds the whole
 * candidate through the canonical engine and refuses what that engine refuses
 * (collinear overlap inside one component, canonical validation, compile). The
 * engine deliberately permits an *un-noded* contact between INDEPENDENT
 * components (P23B.3a S4/S5) — that is legal architecture for a document that
 * already contains such geometry, and it never becomes connectivity.
 *
 * The phase's owner-accepted drawing policy (T1.P02 README, 2026-10-22) is
 * narrower than what the document format tolerates: while a creator *draws*, a
 * crossing without a Junction, an endpoint that merely touches a Wall's
 * interior, and a closed ring nested inside a Room without sharing a Junction
 * with it all **refuse in words, with a repair, and leave no partial source**.
 * Refusing at the drawing path (rather than authoring permitted-looking overlap
 * the creator never asked for) is exactly the "connection is deliberate" rule:
 * a creator who means a join declares the Junction or the host Wall, which the
 * caller passes in `endpointJunctionSnaps` / `endpointHostSnaps`.
 *
 * This module is one bounded predicate over the SAME primitives the planner
 * uses — `classifyWallIntersection`, the sampled curve-level companion, the
 * general Wall/Junction connectivity test and the Room boundary polygon — never
 * a second compiler and never a geometry reconstruction. It answers only "would
 * this draft draw into geometry it is not connected to?"; the planner still owns
 * every identity, allocation and gate.
 *
 * Geometry is read as the document actually stores it: `classifyWallIntersection`
 * is exact between straight Walls, and a curved host is decided on its canonical
 * sampled centerline (`wallCenterlineSamples` + `sampledWallsCross`), because a
 * bow can cross a leg its endpoint chord never reaches and a chord can cross a
 * leg the drawn Wall never touches.
 */
import type { LayoutVec2 } from './layout-coordinates';
import type { LayoutDocumentWallFirst, LayoutWall } from './layout-wall-first-types';
import type {
	WallEndpointHostSnap,
	WallEndpointJunctionSnap
} from './layout-wall-chain';
import {
	CURVE_SELF_INTERSECTION_TOLERANCE,
	sampledPolylineIntersects,
	type CurveSample
} from './layout-geometry-curve';
import { coincidesAsJunction } from './layout-junction-identity';
import { wallCenterlineSamples } from './layout-wall-centerline';
import {
	classifyWallIntersection,
	sampledWallExtentsOverlap,
	sampledWallsCross,
	type SampledTopologyWall,
	type TopologySegment
} from './layout-wall-topology';
import {
	topologyComponentKeyByJunctionId,
	topologyComponentKeyByWallId,
	type JunctionTopologyComponentKey
} from './layout-topology-components';
import { roomBoundaryPolygon } from './layout-room-reconciliation';

export type WallChainPolicyRejectionCode =
	/** A drawn leg properly crosses, or collinearly overlaps, a Wall the operation does not join. */
	| 'unconnected_crossing'
	/** A drawn point lands on a Wall it did not declare as its host (nearness is never connection). */
	| 'unconnected_interior_contact'
	/** A closed ring lies inside a Room without sharing a Junction with that Room. */
	| 'nested_ring_without_shared_junction';

export type WallChainPolicyRejection = {
	readonly code: WallChainPolicyRejectionCode;
	readonly message: string;
	/** Involved authored Wall ids, when the refusal names any. */
	readonly wallIds?: readonly string[];
};

export type WallChainPolicyInput = {
	/** The pre-operation document; never mutated. */
	readonly baseline: LayoutDocumentWallFirst;
	/** Draft vertices in click order, the same array the planner is handed. */
	readonly points: readonly LayoutVec2[];
	/** Whether the chain closes back to its first vertex. */
	readonly close: boolean;
	/** The operation's DECLARED Junction anchors; a declared group may be crossed. */
	readonly endpointJunctionSnaps?: readonly WallEndpointJunctionSnap[];
	/** The operation's DECLARED host Walls; noding applies inside their groups. */
	readonly endpointHostSnaps?: readonly WallEndpointHostSnap[];
};

/**
 * The draft's straight legs in click order, with the closing leg appended when
 * the chain closes (`close`, or a final point that coincides with the first —
 * the planner treats an implicit close the same way). Zero-length legs are
 * dropped: a creator who taps the same coordinate twice names no segment, and
 * the planner's own `zero_length_leg` refusal owns that case.
 */
function chainLegs(points: readonly LayoutVec2[], close: boolean): Array<[LayoutVec2, LayoutVec2]> {
	const legs: Array<[LayoutVec2, LayoutVec2]> = [];
	for (let index = 1; index < points.length; index += 1) {
		const start = points[index - 1]!;
		const end = points[index]!;
		if (start[0] === end[0] && start[1] === end[1]) continue;
		legs.push([start, end]);
	}
	if (points.length >= 3) {
		const first = points[0]!;
		const last = points[points.length - 1]!;
		// A final point that repeats the start IS the closing leg, and the ordinary
		// loop above already captured it; an explicit `close` on an open draft
		// appends the leg back to the first vertex that the loop cannot see.
		const repeatedStart = last[0] === first[0] && last[1] === first[1];
		if (close && !repeatedStart) legs.push([last, first]);
	}
	return legs;
}

/** Whether the draft forms a closed ring (explicit close, or a repeat of the start point). */
function chainCloses(points: readonly LayoutVec2[], close: boolean): boolean {
	if (points.length < 3) return false;
	if (close) return true;
	const first = points[0]!;
	const last = points[points.length - 1]!;
	return first[0] === last[0] && first[1] === last[1];
}

/** A plain even-odd point-in-polygon test; the boundary itself counts as inside. */
function pointInsidePolygon(polygon: readonly LayoutVec2[], point: LayoutVec2): boolean {
	let inside = false;
	for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index, index += 1) {
		const current = polygon[index]!;
		const prior = polygon[previous]!;
		// On-edge counts as inside: a ring drawn exactly along a Room boundary is
		// the "ring nesting in a Room" case the policy refuses, never a silent pass.
		if (pointOnSegment(current, prior, point)) return true;
		const crossesRay = current[1] > point[1] !== prior[1] > point[1];
		if (
			crossesRay &&
			point[0] <
				((prior[0] - current[0]) * (point[1] - current[1])) / (prior[1] - current[1]) + current[0]
		) {
			inside = !inside;
		}
	}
	return inside;
}

function pointOnSegment(a: LayoutVec2, b: LayoutVec2, point: LayoutVec2): boolean {
	const cross = (b[0] - a[0]) * (point[1] - a[1]) - (b[1] - a[1]) * (point[0] - a[0]);
	if (cross !== 0) return false;
	return (
		point[0] >= Math.min(a[0], b[0]) &&
		point[0] <= Math.max(a[0], b[0]) &&
		point[1] >= Math.min(a[1], b[1]) &&
		point[1] <= Math.max(a[1], b[1])
	);
}

/**
 * One drawn leg as the canonical sampled polyline: a straight leg is two
 * stations, sampled through the same curve evaluator every centerline uses.
 * `null` only when the kernel cannot derive it, which leaves the exact chord
 * classifier as the only available reading for that pair.
 */
function legPolyline(leg: TopologySegment): readonly CurveSample[] | null {
	const sampled = wallCenterlineSamples(
		{ id: leg.id, centerline: { kind: 'line' } },
		[leg.start[0], leg.start[1]],
		[leg.end[0], leg.end[1]],
		'forward'
	);
	return sampled?.samples ?? null;
}

/**
 * Whether one drawn leg meets a **curved** host Wall's real centerline.
 *
 * The chord classifier is exact between straight Walls and blind to curvature:
 * a bow can cross a leg its endpoint chord never reaches, and a chord can cross
 * a leg the drawn Wall never touches. This answers the geometry the document
 * actually stores, through the SAME sampled authority the topology gate runs
 * (`wallCenterlineSamples` + `sampledWallsCross`) — never a second intersection
 * recipe.
 *
 * A leg endpoint coincident with one of the host's own endpoint **stations** is
 * the non-contact the chord classifier also leaves alone: an undeclared
 * coincidence between independent groups is permitted geometry, never
 * connectivity. `sampledWallsCross` ignores exactly that station — it is the
 * kernel's own shared-connectivity seam — and still reports every other
 * crossing along either curve.
 */
function curvedHostContact(input: {
	readonly wall: LayoutWall;
	readonly start: LayoutVec2;
	readonly end: LayoutVec2;
	readonly samples: readonly CurveSample[];
	readonly leg: TopologySegment;
	readonly legSamples: readonly CurveSample[];
}): boolean {
	const stationJunctionId =
		coincidesAsJunction(input.leg.start, input.start) || coincidesAsJunction(input.leg.end, input.start)
			? input.wall.startJunctionId
			: coincidesAsJunction(input.leg.start, input.end) || coincidesAsJunction(input.leg.end, input.end)
				? input.wall.endJunctionId
				: null;
	if (stationJunctionId === null) {
		return sampledPolylineIntersects(
			input.samples,
			input.legSamples,
			CURVE_SELF_INTERSECTION_TOLERANCE
		);
	}
	const station = stationJunctionId === input.wall.startJunctionId ? input.start : input.end;
	// The kernel ignores the one consecutive pair that meets at the shared station:
	// the host is oriented to end there and the leg to start there, so the leg's
	// samples are reversed when its own **end** is the coincident endpoint. The
	// leg's `endJunctionId` is a placeholder the kernel never reads.
	const leg: SampledTopologyWall = {
		id: input.leg.id,
		startJunctionId: stationJunctionId,
		endJunctionId: `${input.leg.id}:open`,
		samples: coincidesAsJunction(input.leg.end, station) ? [...input.legSamples].reverse() : input.legSamples
	};
	return sampledWallsCross(
		{ id: input.wall.id, startJunctionId: input.wall.startJunctionId, endJunctionId: input.wall.endJunctionId, samples: input.samples },
		leg,
		stationJunctionId
	);
}

/**
 * The refusal this leg earns against one host Wall, or `null` when the leg may
 * reach the planner.
 */
function legAgainstHost(input: {
	readonly wall: LayoutWall;
	readonly start: LayoutVec2;
	readonly end: LayoutVec2;
	/** The host's canonical sampled centerline; `null` for a straight (`line`) host. */
	readonly samples: readonly CurveSample[] | null;
	readonly leg: TopologySegment;
	readonly legSamples: readonly CurveSample[] | null;
}): WallChainPolicyRejection | null {
	const { wall } = input;
	if (input.samples !== null && input.legSamples !== null) {
		// Curved host: the canonical sampled authority, after the same conservative
		// extent prune the topology gate runs (a pair whose swept boxes cannot overlap
		// is one the predicate would reject anyway).
		if (!sampledWallExtentsOverlap({ samples: input.samples }, { samples: input.legSamples })) return null;
		if (
			curvedHostContact({
				wall,
				start: input.start,
				end: input.end,
				samples: input.samples,
				leg: input.leg,
				legSamples: input.legSamples
			})
		) {
			return {
				code: 'unconnected_crossing',
				message: `The chain crosses Wall "${wall.id}" without a Junction. End the chain on that Wall to split it, or draw into the existing Junction.`,
				wallIds: [wall.id]
			};
		}
		return null;
	}
	const host: TopologySegment = {
		id: wall.id,
		start: [input.start[0], input.start[1]],
		end: [input.end[0], input.end[1]]
	};
	const classified = classifyWallIntersection(input.leg, host, []);
	if (classified.kind === 'proper-crossing' || classified.kind === 'collinear-overlap') {
		return {
			code: 'unconnected_crossing',
			message: `The chain crosses Wall "${wall.id}" without a Junction. End the chain on that Wall to split it, or draw into the existing Junction.`,
			wallIds: [wall.id]
		};
	}
	if (
		classified.kind === 'endpoint-on-interior' ||
		classified.kind === 'collinear-endpoint-touch'
	) {
		// The contact is real but undeclared — a declared host's whole component was
		// already skipped above. The repair is the deliberate one: the creator
		// targets the Wall (the drawing path declares the host and the planner splits
		// it) or the Junction, never nearness.
		return {
			code: 'unconnected_interior_contact',
			message: `A chain point lands on Wall "${wall.id}" without connecting to it. Target that Wall deliberately to split it there, or land on an existing Junction.`,
			wallIds: [wall.id]
		};
	}
	return null;
}

/**
 * The first policy refusal this draft would earn, or `null` when the draft is
 * allowed to reach the planner.
 *
 * Order is deliberate and matches how a creator reads the scene: an unconnected
 * crossing of a Wall is named before a nested ring (a ring that crosses walls
 * refuses as a crossing), and both before any Room question.
 */
export function detectUnsupportedChainConnections(
	input: WallChainPolicyInput
): WallChainPolicyRejection | null {
	const legs = chainLegs(input.points, input.close);
	if (legs.length === 0) return null;

	const componentKeyByWallId = topologyComponentKeyByWallId(input.baseline);
	const componentKeyByJunctionId = topologyComponentKeyByJunctionId(input.baseline);
	// Junction keys may be the unattached-Junction sentinel; a Wall key never is.
	const declaredComponentKeys = new Set<JunctionTopologyComponentKey>();
	for (const snap of input.endpointHostSnaps ?? []) {
		const key = componentKeyByWallId.get(snap.wallId);
		if (key !== undefined) declaredComponentKeys.add(key);
	}
	for (const snap of input.endpointJunctionSnaps ?? []) {
		const key = componentKeyByJunctionId.get(snap.junctionId);
		if (key !== undefined) declaredComponentKeys.add(key);
	}
	const junctionById = new Map(input.baseline.junctions.map((junction) => [junction.id, junction]));
	// The drafted legs as canonical polylines: computed once for the whole draft,
	// the same way a Wall's centerline is read.
	const draftedLegs = legs.map(([legStart, legEnd]) => {
		const leg: TopologySegment = {
			id: `draft:${legStart.join(',')}->${legEnd.join(',')}`,
			start: legStart,
			end: legEnd
		};
		return { leg, samples: legPolyline(leg) };
	});
	for (const wall of input.baseline.walls) {
		// A declared host group may be crossed and noded: the planner owns that.
		if (declaredComponentKeys.has(componentKeyByWallId.get(wall.id) ?? '')) continue;
		const start = junctionById.get(wall.startJunctionId)?.point;
		const end = junctionById.get(wall.endJunctionId)?.point;
		if (start === undefined || end === undefined) continue;
		const hostStart: LayoutVec2 = [start[0], start[1]];
		const hostEnd: LayoutVec2 = [end[0], end[1]];
		// A curved host is read once, by the canonical sampler; a straight host has
		// no arc to sample and keeps the exact chord classifier.
		const samples =
			wall.centerline.kind === 'line'
				? null
				: wallCenterlineSamples(wall, hostStart, hostEnd, 'forward')?.samples ?? null;
		for (const drafted of draftedLegs) {
			const rejection = legAgainstHost({
				wall,
				start: hostStart,
				end: hostEnd,
				samples,
				leg: drafted.leg,
				legSamples: drafted.samples
			});
			if (rejection !== null) return rejection;
		}
	}

	if (!chainCloses(input.points, input.close)) return null;

	// Bounded ring vertices: the repeated closing vertex is dropped when the
	// creator closed the ring by re-tapping the start point.
	const ring: LayoutVec2[] = input.points.map((point) => [point[0], point[1]] as LayoutVec2);
	if (
		ring.length >= 2 &&
		ring[0]![0] === ring[ring.length - 1]![0] &&
		ring[0]![1] === ring[ring.length - 1]![1]
	) {
		ring.pop();
	}
	const declaredJunctionIds = new Set((input.endpointJunctionSnaps ?? []).map((snap) => snap.junctionId));
	for (const room of input.baseline.rooms) {
		const polygon = roomBoundaryPolygon(input.baseline, room.id);
		if (polygon === null || polygon.length < 3) continue;
		// A ring merely touching the boundary is a crossing/contact the checks above
		// already own; this refusal is for a ring strictly inside the Room.
		if (!ring.every((point) => pointInsidePolygon(polygon, point))) continue;
		const roomJunctionIds = new Set<string>();
		for (const ref of room.boundary) {
			const wall = input.baseline.walls.find((candidate) => candidate.id === ref.wallId);
			if (wall === undefined) continue;
			roomJunctionIds.add(wall.startJunctionId);
			roomJunctionIds.add(wall.endJunctionId);
		}
		const sharesJunction =
			declaredJunctionIds.size > 0 &&
			[...declaredJunctionIds].some((junctionId) => roomJunctionIds.has(junctionId));
		if (sharesJunction) continue;
		return {
			code: 'nested_ring_without_shared_junction',
			message: `The ring lies inside Room "${room.id}" without sharing a Junction with it. Connect the ring to that Room's boundary, or draw it outside the Room.`,
			wallIds: room.boundary.map((ref) => ref.wallId)
		};
	}
	return null;
}
