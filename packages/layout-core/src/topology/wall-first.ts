import { layoutItem } from '../kernel/source-collections';
import { countWork } from '../kernel/work-observer';
import type { LayoutGeometryIssue } from '../geometry/types';
import { validateWallFirstOpeningSet } from '../wall/opening-set';
import { composeSpaceBoundary, roomBoundaryPolygon } from '../room/reconciliation-boundary';
import type { LayoutDocumentWallFirst, LayoutWall } from '../wall/types';
import type { WallSamplingDerivation } from '../wall/centerline';
import { wallCenterlineCarriesPoint, wallCenterlineSamples } from '../wall/centerline';
import { isClosedWall } from '../wall/closed-wall';
import { coincidentJunctionPairs, coincidesAsJunction } from '../wall/junction-identity';
import { createPlanBoxIndex } from '../world/plan-box-index';
import {
	topologyComponentKeyByJunctionId,
	topologyComponentKeyByWallId,
} from '../room/topology-components';
import type { SampledTopologyWall, TopologySegment } from '../wall/topology';
import {
	classifyWallIntersection,
	sampledWallExtentsOverlap,
	sampledWallsCross,
} from '../wall/topology';
import type { LayoutVec2 } from '../geometry/coordinates';
import { segmentPlanBox, sharedJunctionIds, wallEndpoints } from '../precision/document';
import type { WallFirstArchitectureCandidatePair } from '../precision/types';
import { POINT_EPSILON } from '../vec2';
import { detectWallCurveTopologyCrossings, topologyFailure } from './curve-crossings';

/**
 * The one canonical **wall-first topology gate** for wall-first candidates:
 * no duplicate Junction points, non-zero Wall lengths, explicit-junction-only
 * Wall relationships (collinear overlap rejected), Room boundary
 * connectivity/role, and translation of the first canonical Opening-set
 * issue. Shared by the precision planners (via `finalizeCandidate`) and the
 * Room-move planner — never copied.
 *
 * THE SUBJECT OF EVERY INTERSECTION CHECK IS THE CONNECTED COMPONENT, not the
 * document. The predicate, its verdict vocabulary, its messages and its
 * diagnostic order are unchanged; only which pairs reach it are scoped:
 *
 * ```text
 * COMPONENT-SCOPED  the pairwise `classifyWallIntersection` loop, the sampled
 *                   crossing authority (`detectWallCurveTopologyCrossings`) and the
 *                   `duplicate_junction_point` coincidence rule. An
 *                   intersection or a coincident node BETWEEN two components is
 *                   PERMITTED geometry — an independent Room may be moved through
 *                   another, independent curved Walls may cross, collinear overlap
 *                   between independent groups is legal, and two independent
 *                   structures may sit at identical coordinates.
 * DOCUMENT-GLOBAL   zero-length Walls, Room boundary closure/role/minimum length,
 *                   a self-intersecting centerline, and the translated Opening-set
 *                   issue. These are INTRINSIC to one structural element, not
 *                   relationships between two elements, so Option E does not relax
 *                   them.
 * ```
 *
 * CONNECTIVITY IS THE TRANSITIVE CLOSURE of explicit authored Junction identity,
 * never coordinates: two Walls with no Junction id in common can still be ONE
 * component through a third Wall, and two Walls whose endpoints merely coincide are
 * in DIFFERENT components. Labelling is the same general Wall/Junction test the
 * reconciliation authorization uses, never a second connectivity recipe, so every
 * same-component verdict this gate produced before is still produced.
 */
export type WallFirstTopologyOptions = {
	/** Only the closed-Wall pair check is scoped by an edit. */
	closedContactWallIds?: ReadonlySet<string>;
	/**
	 * Keep the Opening-set validator canonical, but let a caller that owns a
	 * later stable Opening rejection gate defer its translation. The default
	 * preserves the historical topology-gate contract.
	 */
	openingSet?: 'translate' | 'defer';
	/**
	 * Chain-scoped shared derivation. Omitted keeps per-call sampling.
	 */
	sampling?: WallSamplingDerivation;
	/**
	 * Test-only bypass of the extent prune.
	 * When true, `detectWallCurveTopologyCrossings` evaluates every candidate pair
	 * through the shipped narrow-phase predicate (the exhaustive behavior with only
	 * the extent gate absent). Absent/false is production behavior. Never set in
	 * production code.
	 */
	disableExtentPruneForTest?: boolean;
};

/**
 * The predicates ONE pass evaluates. Absent (the canonical gate) evaluates all of
 * them; a scoped pass evaluates only the listed subjects, in the gate's own order.
 *
 * A scoped pass may only run after a CLEAN initialization (see the verdict scope below): every
 * predicate it does not evaluate was already proven not to fail against the frozen baseline, and
 * no scoped pass is allowed to turn a failure into a `pending`.
 */
type TopologyPassSubject = {
	/** One move's affected Walls, in document order. */
	wallIds: readonly string[];
	/** One move's affected Wall pairs, in gate order. */
	wallPairs: readonly WallFirstArchitectureCandidatePair[];
	/** One move's affected Junction pairs, in gate order. */
	junctionPairs: readonly WallFirstArchitectureCandidatePair[];
	/** Room boundary structure is identity-only and therefore invariant under a patch. */
	evaluateRooms: boolean;
};

/** Closed-Wall contacts use the same predicates for whole-document and edit validation. */
export function validateClosedWallContacts(
	document: LayoutDocumentWallFirst,
	affectedWallIds?: ReadonlySet<string>,
	sampling?: WallSamplingDerivation,
	junctionPointById = new Map(document.junctions.map((junction) => [junction.id, junction.point])),
): LayoutGeometryIssue | undefined {
	const sample = (wall: LayoutWall): SampledTopologyWall | undefined => {
		const start = junctionPointById.get(wall.startJunctionId);
		const end = junctionPointById.get(wall.endJunctionId);
		if (!start || !end) return undefined;
		if (wall.centerline.kind === 'line') {
			const dx = end[0] - start[0];
			const dz = end[1] - start[1];
			const length = Math.hypot(dx, dz);
			if (!(length > POINT_EPSILON)) return undefined;
			const tangent: LayoutVec2 = [dx / length, dz / length];
			return {
				id: wall.id,
				startJunctionId: wall.startJunctionId,
				endJunctionId: wall.endJunctionId,
				samples: [
					{
						point: [...start] as LayoutVec2,
						distance: 0,
						tangent,
						normal: [-tangent[1], tangent[0]],
						t: 0,
					},
					{
						point: [...end] as LayoutVec2,
						distance: length,
						tangent,
						normal: [-tangent[1], tangent[0]],
						t: 1,
					},
				],
			};
		}
		const sampled = sampling
			? sampling.samples(wall, start, end, 'forward')
			: wallCenterlineSamples(wall, start, end, 'forward');
		if (!sampled) return undefined;
		return {
			id: wall.id,
			startJunctionId: wall.startJunctionId,
			endJunctionId: wall.endJunctionId,
			samples: sampled.samples,
		};
	};
	const samples = new Map<string, SampledTopologyWall | undefined>();
	const sampledWall = (wall: LayoutWall) => {
		if (!samples.has(wall.id)) samples.set(wall.id, sample(wall));
		return samples.get(wall.id);
	};
	for (const closed of document.walls) {
		if (!isClosedWall(closed)) continue;
		const seam = junctionPointById.get(closed.startJunctionId);
		if (!seam) continue;
		for (const other of document.walls) {
			if (other.id === closed.id) continue;
			if (affectedWallIds && !affectedWallIds.has(closed.id) && !affectedWallIds.has(other.id))
				continue;
			if (
				other.startJunctionId === closed.startJunctionId ||
				other.endJunctionId === closed.startJunctionId
			) {
				return topologyFailure(
					closed.id,
					other.id,
					`Closed Wall '${closed.id}' is isolated (closed_wall_isolated): Wall '${other.id}' connects at its seam Junction`,
				);
			}
			const otherStart = junctionPointById.get(other.startJunctionId);
			const otherEnd = junctionPointById.get(other.endJunctionId);
			if (
				(otherStart && wallCenterlineCarriesPoint(closed, seam, seam, otherStart)) ||
				(otherEnd && wallCenterlineCarriesPoint(closed, seam, seam, otherEnd))
			) {
				return topologyFailure(
					closed.id,
					other.id,
					`Closed Wall '${closed.id}' is isolated (closed_wall_isolated): Wall '${other.id}' attaches to its centerline`,
				);
			}
			if (otherStart && otherEnd && wallCenterlineCarriesPoint(other, otherStart, otherEnd, seam)) {
				return topologyFailure(
					closed.id,
					other.id,
					`Closed Wall '${closed.id}' is isolated (closed_wall_isolated): its seam attaches to Wall '${other.id}'`,
				);
			}
			const closedSampled = sampledWall(closed);
			const otherSampled = sampledWall(other);
			if (
				closedSampled &&
				otherSampled &&
				sampledWallExtentsOverlap(closedSampled, otherSampled) &&
				sampledWallsCross(closedSampled, otherSampled)
			) {
				return topologyFailure(
					closed.id,
					other.id,
					`Closed Wall '${closed.id}' is isolated (closed_wall_isolated): Wall '${other.id}' crosses its centerline`,
				);
			}
		}
	}
}

export function validateWallFirstTopology(
	document: LayoutDocumentWallFirst,
	options: WallFirstTopologyOptions = {},
): LayoutGeometryIssue | undefined {
	return validateWallFirstTopologyPass(document, options);
}

export function validateWallFirstTopologyPass(
	document: LayoutDocumentWallFirst,
	options: WallFirstTopologyOptions,
	subject?: TopologyPassSubject,
): LayoutGeometryIssue | undefined {
	// The coincidence rule is COMPONENT-SCOPED: a coincident node is an ACCIDENT
	// only where the two nodes describe one graph, so equal coordinates are refused
	// when the Junctions share a component and PERMITTED when they do not. The code,
	// path, message and document order below are unchanged; only which pairs reach
	// the predicate are scoped.
	//
	// UNATTACHED JUNCTIONS keep the general test's deliberate rule: a Junction no Wall
	// references carries the single `UNATTACHED_JUNCTION_COMPONENT` label, so two
	// coincident unattached Junctions are STILL invalid, while an unattached Junction
	// coinciding with a Wall's Junction is permitted. That label is a SYMBOL, never a
	// string, so no authored Wall id can collide with it — not even a Wall whose id
	// is literally `unattached-junctions`.
	const keyByJunctionId = topologyComponentKeyByJunctionId(document);
	const junctionIndexById = new Map(
		document.junctions.map((junction, index) => [junction.id, index] as const),
	);
	const junctionById = new Map(
		document.junctions.map((junction) => [junction.id, junction] as const),
	);
	// One id→point index for every Wall this pass resolves,
	// instead of two linear Junction scans per Wall.
	const junctionPointById = new Map(
		document.junctions.map((junction) => [junction.id, junction.point] as const),
	);

	const closedContact = validateClosedWallContacts(
		document,
		options.closedContactWallIds,
		options.sampling,
		junctionPointById,
	);
	if (closedContact) return closedContact;

	// The predicate itself, so a scoped pass evaluates the SAME rule with the same path, code,
	// message and target as the canonical loop.
	const coincidenceFailure = (
		firstId: string,
		secondId: string,
	): LayoutGeometryIssue | undefined => {
		const first = junctionById.get(firstId);
		const second = junctionById.get(secondId);
		if (!first || !second) return undefined;
		if (!coincidesAsJunction(first.point, second.point)) return undefined;
		return {
			path: `junctions[${junctionIndexById.get(secondId)}].point`,
			code: 'duplicate_junction_point',
			message: `Junction '${secondId}' duplicates the point of '${firstId}'`,
			targetId: secondId,
		};
	};
	if (subject) {
		for (const [firstId, secondId] of subject.junctionPairs) {
			const failure = coincidenceFailure(firstId, secondId);
			if (failure) return failure;
		}
	} else {
		// The coincidence rule is an index query, not an
		// O(J²) sweep: `coincidentJunctionPairs` hands back the pairs that CAN
		// coincide (a superset), in this loop's own order. The predicate, its
		// component scope and the first-wins rule are the shipped ones below.
		const candidates = coincidentJunctionPairs(document.junctions);
		// Work counts (inert without an observer): pairs the index leaves to the
		// rule, and the same-component pairs that reach the predicate.
		countWork('pairs:junction-junction', candidates.length);
		for (const [first, second] of candidates) {
			const firstId = layoutItem(document, 'junctions', first)!.id;
			const secondId = layoutItem(document, 'junctions', second)!.id;
			if (keyByJunctionId.get(firstId) !== keyByJunctionId.get(secondId)) continue;
			countWork('pairs:junction-junction:same-component');
			const failure = coincidenceFailure(firstId, secondId);
			if (failure) return failure;
		}
	}

	// Every Wall's segment is built either way (the pair stages need them); which Walls are
	// CHECKED for zero length is what a subject scopes.
	const wallSegments = new Map<string, TopologySegment>();
	for (const wall of document.walls) {
		const endpoints = wallEndpoints(document, wall, junctionPointById);
		if (!endpoints) continue;
		// A closed Wall's endpoint chord is a point; its effective length is the
		// canonical cubic arc. The old distinct-endpoint check would have rejected
		// every closed Wall as zero-length before face extraction ever saw it.
		let effectiveLength = endpoints.length;
		if (isClosedWall(wall) && wall.centerline.kind === 'cubic-chain') {
			const sampled = options.sampling
				? options.sampling.samples(wall, endpoints.start, endpoints.end, 'forward')
				: wallCenterlineSamples(wall, endpoints.start, endpoints.end, 'forward');
			effectiveLength = sampled?.length ?? 0;
		}
		if (!(effectiveLength > POINT_EPSILON)) continue;
		wallSegments.set(wall.id, { id: wall.id, start: endpoints.start, end: endpoints.end });
	}
	const lengthCandidates = subject
		? document.walls.filter((wall) => subject.wallIds.includes(wall.id))
		: document.walls;
	for (const wall of lengthCandidates) {
		if (wallSegments.has(wall.id)) continue;
		return {
			path: `walls.${wall.id}`,
			code: 'zero_length_wall',
			message: `Wall '${wall.id}' must have a non-zero effective length`,
			targetId: wall.id,
		};
	}

	const walls = document.walls;
	// Component-scoped SUBJECT (the transitive closure of explicit
	// Junction identity, never coordinates: two Walls with no Junction id in common
	// can still be one component through a third Wall). A pair from two different
	// components is skipped before the UNCHANGED predicate sees it, so the
	// `shared-explicit-junction` branch below is unreachable for a skipped pair and
	// no same-component verdict is dropped. The labelling is derived again inside the
	// sampled gate; that redundancy is deliberate — it keeps one public signature and
	// no way for a caller to hand in a labelling that disagrees with the document,
	// and sharing the derivation is the scoped-validation work's own concern.
	const keyByWallId = topologyComponentKeyByWallId(document);
	const wallById = new Map(walls.map((wall) => [wall.id, wall] as const));
	// The chord predicate, shared by the canonical loop and the scoped pass.
	const chordFailure = (firstId: string, secondId: string): LayoutGeometryIssue | undefined => {
		const a = wallById.get(firstId);
		const b = wallById.get(secondId);
		const segmentA = wallSegments.get(firstId);
		const segmentB = wallSegments.get(secondId);
		if (!a || !b || !segmentA || !segmentB) return undefined;
		const shared = sharedJunctionIds(a, b);
		const intersection = classifyWallIntersection(segmentA, segmentB, shared);
		if (intersection.kind === 'shared-explicit-junction') {
			// The classifier intentionally gives explicit connectivity priority;
			// still reject two collinear spans that overlap beyond the shared
			// endpoint, which is not a valid graph edge. A two-Wall lens has the
			// same chord, but a curved side is the distinct boundary edge; the
			// sampled curve gate below proves the pair only meets at both
			// endpoints. A straight side plus a curved side is the D-shaped Room.
			const twoWallLens =
				shared.length === 2 &&
				(a.centerline.kind === 'cubic-chain' || b.centerline.kind === 'cubic-chain');
			const geometric = classifyWallIntersection(segmentA, segmentB, []);
			if (geometric.kind === 'collinear-overlap' && !twoWallLens) {
				return topologyFailure(a.id, b.id, 'Walls overlap beyond their explicit shared Junction');
			}
			return undefined;
		}
		if (intersection.kind !== 'none') {
			return topologyFailure(
				a.id,
				b.id,
				`Walls '${a.id}' and '${b.id}' have unsupported ${intersection.kind}`,
			);
		}
		return undefined;
	};
	if (subject) {
		for (const [firstId, secondId] of subject.wallPairs) {
			const failure = chordFailure(firstId, secondId);
			if (failure) return failure;
		}
	} else {
		// Wall × Wall through a plan-space box index.
		// Two Wall segments whose boxes are disjoint cannot share an endpoint,
		// cross or overlap, so the chord classifier would answer `none`; the index
		// visits only the pairs whose boxes overlap, in this loop's own order.
		const indexedWalls = walls.filter((wall) => wallSegments.has(wall.id));
		const wallBoxes = indexedWalls.map((wall) => segmentPlanBox(wallSegments.get(wall.id)!));
		const wallBoxIndex = createPlanBoxIndex(wallBoxes);
		for (let first = 0; first < indexedWalls.length; first += 1) {
			const a = indexedWalls[first]!;
			const candidates = wallBoxIndex.overlaps(wallBoxes[first]!);
			for (const second of candidates) {
				if (second <= first) continue;
				// Counted per UNIQUE pair, exactly as the nested loop did, so the
				// number stays comparable with Bench 1's 10.7 M Wall × Wall visits
				// (the query returns each pair from both sides plus a self hit).
				countWork('pairs:wall-wall');
				const b = indexedWalls[second]!;
				if (keyByWallId.get(a.id) !== keyByWallId.get(b.id)) continue;
				countWork('pairs:wall-wall:same-component');
				const failure = chordFailure(a.id, b.id);
				if (failure) return failure;
			}
		}
	}

	// Canonical curve-level crossing gate (one implementation, shared
	// with the Wall-chain authoring path).
	const curveCrossing = detectWallCurveTopologyCrossings(
		document,
		wallSegments,
		options.sampling,
		options.disableExtentPruneForTest,
		subject ? { wallIds: subject.wallIds, pairs: subject.wallPairs } : undefined,
		junctionPointById,
	);
	if (curveCrossing) {
		if (curveCrossing.kind === 'self') {
			return topologyFailure(
				curveCrossing.wallId,
				curveCrossing.wallId,
				`Wall '${curveCrossing.wallId}' centerline intersects itself`,
			);
		}
		const [firstCurve, secondCurve] = curveCrossing.wallIds;
		return topologyFailure(
			firstCurve,
			secondCurve,
			curveCrossing.sharedJunctionId
				? `Walls '${firstCurve}' and '${secondCurve}' cross away from their shared Junction`
				: `Walls '${firstCurve}' and '${secondCurve}' have unsupported centerline crossing`,
		);
	}

	for (const room of subject && !subject.evaluateRooms ? [] : document.rooms) {
		// An open Space's cycle is Walls + virtual edges; its closure is proven by
		// composing that mixed sequence, not by the Wall-only chain below.
		if (room.virtualEdges.length > 0) {
			const composed = composeSpaceBoundary(document, room);
			if (composed.kind === 'failed') {
				return topologyFailure(room.id, undefined, composed.issue.message);
			}
			if (composed.edges.length < 3) {
				return topologyFailure(
					room.id,
					undefined,
					`Room '${room.id}' needs at least three boundary edges`,
				);
			}
			if (!roomBoundaryPolygon(document, room.id)) {
				return topologyFailure(room.id, undefined, `Room '${room.id}' has no resolvable outline`);
			}
			continue;
		}
		// A closed Wall contributes ONE oriented ref but many sampled vertices, and
		// a two-Wall curved lens contributes TWO refs and a bounded polygon. The
		// floor is resolved vertices, not Wall-ref count. Resolve the polygon before
		// refusing a short boundary, so only a genuinely degenerate loop fails.
		if (room.boundary.length < 3) {
			const roomPolygon = roomBoundaryPolygon(document, room.id);
			if (!roomPolygon || roomPolygon.length < 3) {
				return topologyFailure(
					room.id,
					undefined,
					`Room '${room.id}' needs at least three boundary Walls`,
				);
			}
		}
		let previousEnd: string | undefined;
		let firstStart: string | undefined;
		for (const [index, ref] of room.boundary.entries()) {
			const wall = wallById.get(ref.wallId);
			// Format 6 accepts any existing Wall as a Room boundary, so a reference to
			// a Wall the candidate does not contain is refused here rather than read as
			// if it existed.
			if (!wall) {
				return topologyFailure(
					room.id,
					ref.wallId,
					`Room '${room.id}' references unknown Wall '${ref.wallId}'`,
				);
			}
			const start = ref.direction === 'forward' ? wall.startJunctionId : wall.endJunctionId;
			const end = ref.direction === 'forward' ? wall.endJunctionId : wall.startJunctionId;
			if (index === 0) firstStart = start;
			if (previousEnd !== undefined && previousEnd !== start) {
				return topologyFailure(
					room.id,
					ref.wallId,
					`Room '${room.id}' boundary is disconnected at Wall '${ref.wallId}'`,
				);
			}
			previousEnd = end;
		}
		if (previousEnd !== firstStart)
			return topologyFailure(room.id, undefined, `Room '${room.id}' boundary is not closed`);
	}

	if (options.openingSet !== 'defer') {
		// Whole-hosting-Wall opening set: ONE canonical validator shared with the
		// opening create/edit/drag/resize paths (`layout-opening-set.ts`).
		// Do not duplicate fit/overlap/vertical checks here — this gate only
		// translates the first canonical issue.
		const openingIssue = validateWallFirstOpeningSet(document, options.sampling)[0];
		if (openingIssue) {
			// The host-Wall vertical-fit issue gets a dedicated code so a
			// Wall-height edit can report it as `wall_height_below_opening` instead of
			// a generic topology failure. The canonical Opening validator owns the
			// rule; this branch only translates its issue.
			if (openingIssue.code === 'opening_exceeds_wall_height') {
				return {
					path: `walls.${openingIssue.wallId}.height`,
					code: 'wall_height_below_opening',
					message: openingIssue.message,
					targetId: openingIssue.wallId,
				};
			}
			return topologyFailure(openingIssue.openingId, openingIssue.wallId, openingIssue.message);
		}
	}
	return undefined;
}
