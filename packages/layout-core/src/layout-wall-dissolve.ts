/**
 * `layout-wall-dissolve.ts` — P23 Junction dissolve / Wall join planning.
 *
 * Delete-Junction means exactly one thing: a degree-2 Junction whose two
 * incident canonical Walls join without inventing or losing geometry or
 * semantics dissolves into one joined Wall (the exact inverse of
 * `planWallSplit`). Same-kind pairs only: collinear straight Walls rejoin to
 * one `line` Wall, curved Walls concatenate to one chain with the Junction
 * demoted to a fresh interior knot. Everything else rejects atomically.
 *
 * The planner builds the complete candidate Walls/Junctions/Openings graph
 * and rides the shared topology acceptance path — geometric correspondence
 * via `reconcileRooms` (Room boundaries stay reconciliation-owned; nothing
 * here rewrites `rooms[].boundary`), the shared Opening-set/portal gates, and
 * the shared generic `validateAndCompile` codec→compile gate. No gate logic
 * is copied here. Nothing mutates its inputs.
 *
 * Identity: the candidate carries the baseline ledger untouched. Commit-time
 * identity promotion (the existing seam) keeps the survivor's assignment,
 * prunes the retired Wall/Junction assignments as no-longer-live, and mints
 * nothing — curve knots are not ledger entities.
 */
import type {
	LayoutDocumentWallFirst,
	LayoutWall,
	LayoutWallCenterline,
	LayoutWallCurveKnot
} from './layout-wall-first-types';
import type { LayoutVec2 } from './layout-types';
import {
	nextWallCurveKnotId,
	orientedWallChainKnotsAndSpans,
	wallCubicChain,
	type WallCenterlineTraversal
} from './layout-wall-centerline';
import { wallCurveChainLength } from './layout-wall-curve-algebra';
import { extractBoundaryCandidateFaces } from './layout-face-extraction';
import {
	buildCorrespondenceComponents,
	interiorWitness,
	reconcileRooms,
	roomBoundaryPolygon,
	type RoomLineageRecord
} from './layout-room-reconciliation';
import {
	createAuthoringRoomAllocator,
	validateAndCompile,
	type WallFirstOpRejection
} from './layout-wall-topology-ops';
import { validateWallFirstOpeningSet } from './layout-opening-set';
import { validateWallFirstPortalRelations } from './layout-portals';

/** Dissolve-only rejection codes; stable machine codes per operation. */
export type DissolveSpecificRejectionCode =
	| 'unknown_junction'
	| 'junction_degree_not_two'
	| 'degenerate_wall_pair'
	| 'duplicate_joined_wall'
	| 'incompatible_wall_pair'
	| 'non_collinear_straight_pair'
	| 'room_reconciliation_rejected'
	| 'room_identity_lost'
	| 'opening_set_invalid'
	| 'portal_relation_invalid'
	| 'wall_height_below_opening'
	| 'invalid_candidate_document';

/**
 * Dissolve rejection: the shared topology rejection shape plus the
 * dissolve-only codes, in the same field shape, so the shared generic
 * `validateAndCompile<T>` passes existing `WallFirstOpRejection` objects
 * through with no casts.
 */
export type DissolveSpecificRejection = {
	code: DissolveSpecificRejectionCode;
	message: string;
	wallIds?: string[];
	junctionIds?: string[];
	roomIds?: string[];
	faceKey?: string;
};

export type DissolveRejection = WallFirstOpRejection | DissolveSpecificRejection;

export type DissolvePlan =
	| {
			kind: 'success';
			/** Exact committed document — survivor rewritten, other Wall and Junction retired. */
			document: LayoutDocumentWallFirst;
			/** The incident Wall that kept its ID (deterministic survivor policy). */
			survivorWallId: string;
			/** The incident Wall whose record was dropped. */
			retiredWallId: string;
			/** The dissolved Junction. */
			retiredJunctionId: string;
			/** Fresh interior knot at the former Junction (curve joins only). */
			createdKnotId?: string;
	  }
	| {
			kind: 'rejected';
			rejection: DissolveRejection;
	  };

/**
 * Dissolve one degree-2 Junction into a single joined Wall.
 *
 * Preconditions run in compatibility-matrix order (first failure wins), then
 * candidate construction (survivor policy → centerline join → Opening rebase),
 * then Room correspondence against baseline Rooms with a no-birth/no-retire
 * assert, then the shared Opening-set/portal/codec/compile gates.
 */
export function planDissolveJunction(
	document: LayoutDocumentWallFirst,
	junctionId: string
): DissolvePlan {
	const reject = (rejection: DissolveSpecificRejection): DissolvePlan => ({
		kind: 'rejected',
		rejection
	});

	const junction = document.junctions.find((candidate) => candidate.id === junctionId);
	if (!junction) {
		return reject({
			code: 'unknown_junction',
			message: `Unknown junction '${junctionId}'`,
			junctionIds: [junctionId]
		});
	}
	const junctionPoint: LayoutVec2 = [junction.point[0], junction.point[1]];

	const incident = document.walls.filter(
		(wall) => wall.startJunctionId === junctionId || wall.endJunctionId === junctionId
	);
	if (incident.length !== 2) {
		return reject({
			code: 'junction_degree_not_two',
			message: `Junction '${junctionId}' has ${incident.length} incident walls; only a degree-2 junction can dissolve`,
			junctionIds: [junctionId],
			wallIds: incident.map((wall) => wall.id)
		});
	}
	const [first, second] = incident as [LayoutWall, LayoutWall];

	// Degenerate pairs: a self-loop is not a degree-2 path, and walls sharing
	// both endpoints would join into a zero-span loop (the codec requires two
	// distinct endpoint Junctions per Wall).
	const firstIsLoop =
		first.startJunctionId === junctionId && first.endJunctionId === junctionId;
	const secondIsLoop =
		second.startJunctionId === junctionId && second.endJunctionId === junctionId;
	if (firstIsLoop || secondIsLoop) {
		return reject({
			code: 'degenerate_wall_pair',
			message: `Junction '${junctionId}' is incident to a self-loop wall; a loop cannot dissolve`,
			junctionIds: [junctionId],
			wallIds: [first.id, second.id]
		});
	}
	const firstFarId = first.startJunctionId === junctionId ? first.endJunctionId : first.startJunctionId;
	const secondFarId =
		second.startJunctionId === junctionId ? second.endJunctionId : second.startJunctionId;
	if (firstFarId === secondFarId) {
		return reject({
			code: 'degenerate_wall_pair',
			message: `Walls '${first.id}' and '${second.id}' share both endpoints; joining them would form a loop`,
			junctionIds: [junctionId],
			wallIds: [first.id, second.id]
		});
	}

	// A third wall already spanning the joined endpoints would collide with the
	// joined Wall (the codec forbids duplicate walls between one junction pair).
	const pairIds = new Set([first.id, second.id]);
	const duplicate = document.walls.find(
		(wall) =>
			!pairIds.has(wall.id) &&
			((wall.startJunctionId === firstFarId && wall.endJunctionId === secondFarId) ||
				(wall.startJunctionId === secondFarId && wall.endJunctionId === firstFarId))
	);
	if (duplicate) {
		return reject({
			code: 'duplicate_joined_wall',
			message: `Wall '${duplicate.id}' already spans the joined endpoints; dissolving '${junctionId}' would duplicate it`,
			junctionIds: [junctionId],
			wallIds: [first.id, second.id, duplicate.id]
		});
	}

	// Compatibility: role, dimensions and naming must agree (exact equality —
	// merging across a mismatch would invent or drop authored data).
	if (
		first.role !== second.role ||
		first.thickness !== second.thickness ||
		first.height !== second.height
	) {
		return reject({
			code: 'incompatible_wall_pair',
			message: `Walls '${first.id}' and '${second.id}' disagree on role, thickness or height and cannot join`,
			junctionIds: [junctionId],
			wallIds: [first.id, second.id]
		});
	}
	if (first.name !== second.name && first.name !== undefined && second.name !== undefined) {
		return reject({
			code: 'incompatible_wall_pair',
			message: `Walls '${first.id}' and '${second.id}' carry different authored names and cannot join`,
			junctionIds: [junctionId],
			wallIds: [first.id, second.id]
		});
	}
	const firstKind = first.centerline.kind;
	const secondKind = second.centerline.kind;
	if (firstKind !== secondKind) {
		return reject({
			code: 'incompatible_wall_pair',
			message: `Walls '${first.id}' (${firstKind}) and '${second.id}' (${secondKind}) mix straight and curved centerlines and cannot join`,
			junctionIds: [junctionId],
			wallIds: [first.id, second.id]
		});
	}

	// Survivor policy (no geometry input): the through-configuration survivor
	// is the wall ending at the Junction — the exact split inverse, where the
	// `A → X` fragment kept the Wall ID. Otherwise the lexicographically
	// smaller Wall ID survives. The joined wall always starts at the
	// survivor's non-Junction endpoint.
	const firstEndsAtJunction = first.endJunctionId === junctionId;
	const secondEndsAtJunction = second.endJunctionId === junctionId;
	let survivor: LayoutWall;
	let other: LayoutWall;
	if (firstEndsAtJunction !== secondEndsAtJunction) {
		survivor = firstEndsAtJunction ? first : second;
		other = firstEndsAtJunction ? second : first;
	} else {
		[survivor, other] = first.id < second.id ? [first, second] : [second, first];
	}
	const survivorFarId = survivor.startJunctionId === junctionId ? survivor.endJunctionId : survivor.startJunctionId;
	const otherFarId = other.startJunctionId === junctionId ? other.endJunctionId : other.startJunctionId;
	const joinedStartId = survivorFarId;
	const joinedEndId = otherFarId;

	const junctionById = new Map(document.junctions.map((entry) => [entry.id, entry.point]));
	const startPoint = junctionById.get(joinedStartId);
	const endPoint = junctionById.get(joinedEndId);
	if (!startPoint || !endPoint) {
		return reject({
			code: 'invalid_candidate_document',
			message: `Joined wall endpoints reference unknown junctions`,
			junctionIds: [junctionId],
			wallIds: [first.id, second.id]
		});
	}

	// Centerline join. Straight pairs must be collinear within dissolve-local
	// floating-point noise (never an authored angle); curve pairs concatenate
	// with the Junction demoted to one fresh interior knot.
	// Traversal of each side toward the joined direction: the survivor always
	// occupies [joinedStart … J], the other wall [J … joinedEnd]. Forward
	// means the wall's canonical start is the interval start.
	const survivorForward = survivor.startJunctionId === joinedStartId;
	const otherForward = other.startJunctionId === junctionId;
	let joinedCenterline: LayoutWallCenterline;
	let createdKnotId: string | undefined;
	if (firstKind === 'line') {
		if (!linePairJoinsWithinNoise(startPoint, junctionPoint, endPoint)) {
			return reject({
				code: 'non_collinear_straight_pair',
				message: `Walls '${first.id}' and '${second.id}' meet at an angle at junction '${junctionId}'; only collinear straight walls can join`,
				junctionIds: [junctionId],
				wallIds: [first.id, second.id]
			});
		}
		joinedCenterline = { kind: 'line' };
	} else {
		// Each side walks toward the joined direction through the single
		// traversal-orientation owner — a reverse-traversed side contributes
		// mirrored spans in reversed order, never raw stored order.
		const survivorTraversal: WallCenterlineTraversal = survivorForward ? 'forward' : 'reverse';
		const otherTraversal: WallCenterlineTraversal = otherForward ? 'forward' : 'reverse';
		const orientedSurvivor = orientedWallChainKnotsAndSpans(survivor.centerline, survivorTraversal);
		const orientedOther = orientedWallChainKnotsAndSpans(other.centerline, otherTraversal);
		createdKnotId = nextWallCurveKnotId(survivor.id, [
			...(survivor.centerline.kind === 'cubic-chain' ? survivor.centerline.knots : []),
			...(other.centerline.kind === 'cubic-chain' ? other.centerline.knots : [])
		]);
		const demoted: LayoutWallCurveKnot = {
			id: createdKnotId,
			point: [junctionPoint[0], junctionPoint[1]]
		};
		joinedCenterline = wallCubicChain(
			[...orientedSurvivor.knots, demoted, ...orientedOther.knots],
			[...orientedSurvivor.spans, ...orientedOther.spans]
		);
	}

	// Opening rebase by exact arc-offset arithmetic (inverse of split
	// rebasing). The survivor always occupies [0, lenA]; the other wall
	// occupies [lenA, lenA + lenB]. Forward-traversed openings shift by the
	// interval start; reverse-traversed openings mirror within their interval.
	const survivorLength = wallArcLength(document, survivor);
	const otherLength = wallArcLength(document, other);
	if (survivorLength === undefined || otherLength === undefined) {
		return reject({
			code: 'invalid_candidate_document',
			message: `Joined wall endpoints reference unknown junctions`,
			junctionIds: [junctionId],
			wallIds: [first.id, second.id]
		});
	}
	const openings = document.openings.map((opening) => {
		// Copy-on-write for every record: the candidate never aliases the
		// baseline, mirroring wallCubicChain's clone discipline for chains.
		if (opening.wallId !== survivor.id && opening.wallId !== other.id) return { ...opening };
		const onSurvivor = opening.wallId === survivor.id;
		const intervalStart = onSurvivor ? 0 : survivorLength;
		const intervalLength = onSurvivor ? survivorLength : otherLength;
		const forward = onSurvivor ? survivorForward : otherForward;
		const offset = forward
			? intervalStart + opening.offset
			: intervalStart + intervalLength - opening.offset - opening.width;
		return { ...opening, wallId: survivor.id, offset };
	});

	const joinedName = survivor.name ?? other.name;
	const joinedWall: LayoutWall = {
		id: survivor.id,
		startJunctionId: joinedStartId,
		endJunctionId: joinedEndId,
		role: survivor.role,
		thickness: survivor.thickness,
		height: survivor.height,
		centerline: joinedCenterline,
		...(joinedName !== undefined ? { name: joinedName } : {})
	};
	const candidate: LayoutDocumentWallFirst = {
		...document,
		junctions: document.junctions.filter((entry) => entry.id !== junctionId),
		walls: document.walls.flatMap((wall) => {
			if (wall.id === other.id) return [];
			if (wall.id === survivor.id) return [joinedWall];
			return [wall];
		}),
		openings
	};

	// Room correspondence: predecessor evidence comes from the BASELINE rooms,
	// faces extract from the joined graph, and reconcileRooms owns the final
	// boundaries (candidate rooms are not an input — nothing here rewrites
	// `rooms[].boundary`). Mirrors the removal preamble.
	const extraction = extractBoundaryCandidateFaces(candidate);
	if (extraction.faces.length > 0 || document.rooms.length > 0) {
		const predecessorPolygons = new Map<string, readonly LayoutVec2[]>();
		const predecessorWitnesses = new Map<string, LayoutVec2>();
		for (const room of document.rooms) {
			const polygon = roomBoundaryPolygon(document, room.id);
			if (!polygon) {
				return reject({
					code: 'room_reconciliation_rejected',
					message: `Predecessor room '${room.id}' has an unresolvable boundary`,
					roomIds: [room.id]
				});
			}
			predecessorPolygons.set(room.id, polygon);
			predecessorWitnesses.set(room.id, interiorWitness(polygon));
		}
		const result = reconcileRooms({
			baseline: document,
			candidateDocument: candidate,
			extraction,
			components: buildCorrespondenceComponents(
				extraction.faces,
				document.rooms.map((room) => room.id),
				predecessorWitnesses,
				predecessorPolygons
			),
			predecessorWitnesses,
			predecessorPolygons,
			allocator: createAuthoringRoomAllocator()
		});
		if ('rejection' in result) {
			return reject({
				code: 'room_reconciliation_rejected',
				message: result.rejection.message,
				...(result.rejection.roomIds ? { roomIds: result.rejection.roomIds } : {}),
				...(result.rejection.faceKey ? { faceKey: result.rejection.faceKey } : {})
			});
		}
		// Dissolve preserves the face set geometrically, so any birth or
		// retirement proves a non-topology-preserving join.
		const created = result.lineage.filter((record: RoomLineageRecord) => record.kind === 'created');
		if (result.retiredRoomIds.length > 0 || created.length > 0) {
			return reject({
				code: 'room_identity_lost',
				message: `Dissolving junction '${junctionId}' would retire or create rooms; the join is not topology-preserving`,
				junctionIds: [junctionId],
				wallIds: [first.id, second.id],
				roomIds: [...result.retiredRoomIds, ...created.map((record: RoomLineageRecord) => record.roomId)]
			});
		}
		candidate.rooms = result.document.rooms;
		candidate.objects = result.document.objects;
		candidate.openings = result.document.openings;
	}

	// Rebased Openings survive (unlike wall-delete), so the shared
	// Opening-set and portal gates run on the reconciled candidate with the
	// same codes as the precision path — shared calls, not a new authority.
	const setIssues = validateWallFirstOpeningSet(candidate);
	if (setIssues.length > 0) {
		const problem = setIssues[0]!;
		return reject({
			code: problem.code === 'opening_exceeds_wall_height' ? 'wall_height_below_opening' : 'opening_set_invalid',
			message: problem.message,
			wallIds: [problem.wallId]
		});
	}
	const relationIssues = validateWallFirstPortalRelations(candidate);
	if (relationIssues.length > 0) {
		const problem = relationIssues[0]!;
		return reject({
			code: 'portal_relation_invalid',
			message: problem.message,
			wallIds: [survivor.id]
		});
	}

	return validateAndCompile<DissolvePlan>(
		candidate,
		(rejection) => ({ kind: 'rejected', rejection }),
		(committed) => ({
			kind: 'success',
			document: committed,
			survivorWallId: survivor.id,
			retiredWallId: other.id,
			retiredJunctionId: junctionId,
			...(createdKnotId !== undefined ? { createdKnotId } : {})
		})
	);
}

/** True arc length of one Wall (chord for straight, chain sum for curved). */
function wallArcLength(
	document: LayoutDocumentWallFirst,
	wall: LayoutWall
): number | undefined {
	const start = document.junctions.find((entry) => entry.id === wall.startJunctionId);
	const end = document.junctions.find((entry) => entry.id === wall.endJunctionId);
	if (!start || !end) return undefined;
	if (wall.centerline.kind === 'line') {
		return Math.hypot(end.point[0] - start.point[0], end.point[1] - start.point[1]);
	}
	return wallCurveChainLength({
		startPoint: start.point,
		endPoint: end.point,
		knots: wall.centerline.knots,
		spans: wall.centerline.spans
	});
}

/**
 * Dissolve-local numerical straightness test for collapsing two straight
 * fragments.
 *
 * This tolerance only decides whether collapsing two line fragments changes
 * authored geometry beyond floating-point noise (straight subdivision places
 * its Junction through `distance / length` interpolation, so a mathematically
 * straight split can carry double-rounding residue). It never establishes
 * Junction identity, connectivity, intersection, snapping, or Room topology —
 * exact robust orientation stays the authority for all of those.
 */
function linePairJoinsWithinNoise(
	e1: LayoutVec2,
	j: LayoutVec2,
	e2: LayoutVec2
): boolean {
	const ux = e2[0] - e1[0];
	const uz = e2[1] - e1[1];
	const length = Math.hypot(ux, uz);
	if (!(length > 0)) return false;
	// Strictly between: J projects onto the open segment E1—E2.
	if ((j[0] - e1[0]) * ux + (j[1] - e1[1]) * uz <= 0) return false;
	if ((j[0] - e2[0]) * -ux + (j[1] - e2[1]) * -uz <= 0) return false;
	const perpendicular = Math.abs(ux * (j[1] - e1[1]) - uz * (j[0] - e1[0])) / length;
	const scale = Math.max(
		1,
		Math.abs(e1[0]),
		Math.abs(e1[1]),
		Math.abs(e2[0]),
		Math.abs(e2[1]),
		Math.abs(j[0]),
		Math.abs(j[1]),
		length
	);
	return perpendicular <= 64 * Number.EPSILON * scale;
}
