import type {
	LayoutDocumentWallFirst,
	LayoutSpaceVirtualEdge,
	LayoutWall,
	LayoutWallFirstRoom,
	LayoutWallOpening,
	OrientedWallRef,
} from '../wall/types';
import type { LayoutVec2 } from '../geometry/coordinates';
import type { DerivedCandidateFace } from '../geometry/face-extraction';
import { pointStrictlyInsidePolygon, polygonIntersectionArea } from '../geometry/face-extraction';
import { composeSpaceBoundary, spaceBoundaryPolygonFromEdges } from './reconciliation-boundary';
import type { ReconciliationFailure, ReconciliationRejection } from './reconciliation-types';

/**
 * Reconcile candidate faces against predecessor rooms for one topology
 * operation. `baseline` is the pre-operation document (its rooms are the
 * predecessor rooms); `extraction` is the candidate face output.
 */
/** One mixed boundary edge while the carry rule assembles a Space. */
export type CarriedSpaceEdge =
	| { kind: 'wall'; wallId: string; direction: 'forward' | 'reverse' }
	| {
			kind: 'virtual';
			startJunctionId: string;
			endJunctionId: string;
			/**
			 * The removed Wall this edge replaced, when the carry rule created it.
			 * Authored virtual edges never set it: two Spaces may legitimately have
			 * coincident open sides, so endpoint positions alone can never prove that
			 * an edge came from a deleted Wall.
			 */
			replacedWallId?: string;
	  };

/**
 * Compose a predecessor's boundary and replace every erased Wall edge with the
 * stated straight segment between that ref's oriented ends. Existing virtual
 * edges keep their gap order, so adjacent erasures retain the intermediate
 * Junction (SP-plan §5, and R0's regression is refused).
 */
export function carriedBoundaryEdges(
	document: Pick<LayoutDocumentWallFirst, 'junctions' | 'walls'>,
	room: Pick<LayoutWallFirstRoom, 'id' | 'boundary' | 'virtualEdges'>,
	removedWallIds: ReadonlySet<string>,
): { kind: 'ok'; edges: CarriedSpaceEdge[] } | { kind: 'failed'; message: string } {
	const composed = composeSpaceBoundary(document, room);
	if (composed.kind === 'failed') return { kind: 'failed', message: composed.issue.message };
	const edges: CarriedSpaceEdge[] = [];
	for (const edge of composed.edges) {
		if (edge.kind === 'virtual') {
			edges.push({
				kind: 'virtual',
				startJunctionId: edge.startJunctionId,
				endJunctionId: edge.endJunctionId,
			});
			continue;
		}
		if (removedWallIds.has(edge.wallId)) {
			edges.push({
				kind: 'virtual',
				startJunctionId: edge.startJunctionId,
				endJunctionId: edge.endJunctionId,
				replacedWallId: edge.wallId,
			});
			continue;
		}
		edges.push({ kind: 'wall', wallId: edge.wallId, direction: edge.direction });
	}
	return { kind: 'ok', edges };
}

/**
 * Drop a reverse virtual-edge pair created by carry: the two sides of one
 * already-spliced shared Wall. Only replacement edges qualify — an authored
 * open side that merely coincides with one is a real boundary of its own Space
 * and must survive (the provenance rule the merge owners use).
 */
export function normalizeCarriedEdges(edges: readonly CarriedSpaceEdge[]): CarriedSpaceEdge[] {
	const dropped = new Set<number>();
	for (let first = 0; first < edges.length; first += 1) {
		const a = edges[first]!;
		if (a.kind !== 'virtual' || a.replacedWallId === undefined || dropped.has(first)) continue;
		for (let second = first + 1; second < edges.length; second += 1) {
			const b = edges[second]!;
			if (b.kind !== 'virtual' || b.replacedWallId === undefined || dropped.has(second)) continue;
			if (a.startJunctionId === b.endJunctionId && a.endJunctionId === b.startJunctionId) {
				dropped.add(first);
				dropped.add(second);
				break;
			}
		}
	}
	return edges.filter((_, index) => !dropped.has(index));
}

export function carriedBoundaryParts(edges: readonly CarriedSpaceEdge[]): {
	boundary: OrientedWallRef[];
	virtualEdges: LayoutSpaceVirtualEdge[];
} {
	// `composeSpaceBoundary` starts at a boundary Wall and consumes virtual
	// edges only in the gaps AFTER it. If the first Wall was erased, the cycle
	// now starts with that virtual edge; rotate to a surviving Wall so the two
	// arrays describe the same cycle instead of an unconsumed leading gap.
	const firstWall = edges.findIndex((edge) => edge.kind === 'wall');
	const ordered =
		firstWall < 0 ? [] : edges.map((_, offset) => edges[(firstWall + offset) % edges.length]!);
	const boundary: OrientedWallRef[] = [];
	const virtualEdges: LayoutSpaceVirtualEdge[] = [];
	for (const edge of ordered) {
		if (edge.kind === 'wall') {
			boundary.push({ wallId: edge.wallId, direction: edge.direction });
		} else {
			virtualEdges.push({
				startJunctionId: edge.startJunctionId,
				endJunctionId: edge.endJunctionId,
			});
		}
	}
	return { boundary, virtualEdges };
}

/**
 * Splice two carried cycles at one removed Wall's ends. A traverses the Wall
 * `p→q`; B traverses it `q→p`. A's surviving chain from `q` back to `p`, then
 * B's from `p` back to `q`, form one closed cycle with no stated edge where the
 * Wall was (SP-plan §5.3).
 */
export function spliceCarriedEdges(
	first: readonly CarriedSpaceEdge[],
	second: readonly CarriedSpaceEdge[],
	wall: LayoutWall,
): CarriedSpaceEdge[] | null {
	const matches = (edge: CarriedSpaceEdge, start: string, end: string): boolean =>
		edge.kind === 'virtual' &&
		edge.replacedWallId === wall.id &&
		edge.startJunctionId === start &&
		edge.endJunctionId === end;
	let firstIndex = first.findIndex((edge) =>
		matches(edge, wall.startJunctionId, wall.endJunctionId),
	);
	let secondIndex = second.findIndex((edge) =>
		matches(edge, wall.endJunctionId, wall.startJunctionId),
	);
	if (firstIndex < 0 || secondIndex < 0) {
		firstIndex = first.findIndex((edge) => matches(edge, wall.endJunctionId, wall.startJunctionId));
		secondIndex = second.findIndex((edge) =>
			matches(edge, wall.startJunctionId, wall.endJunctionId),
		);
	}
	if (firstIndex < 0 || secondIndex < 0) return null;
	const rotate = (edges: readonly CarriedSpaceEdge[], start: number): CarriedSpaceEdge[] =>
		edges.map((_, offset) => edges[(start + offset) % edges.length]!);
	// Everything except the removed Wall, starting at the edge after it.
	const firstChain = rotate(first, firstIndex + 1).slice(0, first.length - 1);
	const secondChain = rotate(second, secondIndex + 1).slice(0, second.length - 1);
	return [...firstChain, ...secondChain];
}

/** Composed outline of an assembled carried boundary; `null` when it cannot compose. */
export function carriedCyclePolygon(
	document: Pick<LayoutDocumentWallFirst, 'junctions' | 'walls'>,
	roomId: string,
	edges: readonly CarriedSpaceEdge[],
): readonly LayoutVec2[] | null {
	const composed = composeSpaceBoundary(document, { id: roomId, ...carriedBoundaryParts(edges) });
	if (composed.kind === 'failed') return null;
	return spaceBoundaryPolygonFromEdges(composed.edges, document);
}

/** Composed outline of a Room record, for the provisional placement gate. */
export function roomOutlinePolygon(
	document: Pick<LayoutDocumentWallFirst, 'junctions' | 'walls'>,
	room: Pick<LayoutWallFirstRoom, 'id' | 'boundary' | 'virtualEdges'>,
): readonly LayoutVec2[] | null {
	const composed = composeSpaceBoundary(document, room);
	if (composed.kind === 'failed') return null;
	return spaceBoundaryPolygonFromEdges(composed.edges, document);
}

/** Greatest-overlap split survivor with witness and faceKey ties. */
export function chooseSplitSurvivor(options: {
	predecessor: LayoutWallFirstRoom;
	candidates: DerivedCandidateFace[];
	witness: LayoutVec2 | undefined;
	overlapPolygons: ReadonlyMap<string, readonly LayoutVec2[]>;
}): DerivedCandidateFace | undefined {
	const { predecessor, candidates, witness } = options;
	if (candidates.length !== 2) return undefined;
	// Overlap requires the predecessor's polygon; derive it from its
	// boundary cycle when possible. With world-local candidate geometry the
	// predecessor polygon is the baseline face — supplied by the caller via
	// witness/overlap below. Here we rely on caller-provided overlap areas
	// computed against the baseline room boundary polygon.
	const overlaps = candidates.map((face) => ({
		face,
		area: predecessorPolygonOverlap(predecessor, face, options.overlapPolygons),
	}));
	const [first, second] = overlaps;
	if (!first || !second) return undefined;
	if (first.area > second.area) return first.face;
	if (second.area > first.area) return second.face;
	// Exact tie: witness strictly inside exactly one candidate.
	if (witness) {
		const inFirst = pointStrictlyInsidePolygon(first.face.polygon, witness);
		const inSecond = pointStrictlyInsidePolygon(second.face.polygon, witness);
		if (inFirst && !inSecond) return first.face;
		if (inSecond && !inFirst) return second.face;
	}
	// Otherwise smallest canonical faceKey survives.
	return first.face.key < second.face.key ? first.face : second.face;
}

/**
 * Predecessor/candidate overlap. The caller supplies baseline room polygons
 * through `predecessorPolygons`; when absent (no geometry overlap evidence
 * available) this returns 0 and the witness/faceKey ties decide — never
 * guessed geometry.
 */
function predecessorPolygonOverlap(
	predecessor: LayoutWallFirstRoom,
	face: { polygon: readonly LayoutVec2[] },
	overlapPolygons: ReadonlyMap<string, readonly LayoutVec2[]>,
): number {
	const polygon = overlapPolygons.get(predecessor.id);
	if (!polygon) return 0;
	return polygonIntersectionArea(polygon, face.polygon);
}

/** Greatest-contributor merge survivor with room-ID tie. */
export function chooseMergeSurvivor(options: {
	predecessors: LayoutWallFirstRoom[];
	face: { polygon: readonly LayoutVec2[] };
	overlapPolygons: ReadonlyMap<string, readonly LayoutVec2[]>;
}): LayoutWallFirstRoom | undefined {
	const { predecessors, face } = options;
	if (predecessors.length !== 2) return undefined;
	const areas = predecessors.map((room) => ({
		room,
		area: predecessorPolygonOverlap(room, face, options.overlapPolygons),
	}));
	const [first, second] = areas;
	if (!first || !second) return undefined;
	if (first.area > second.area) return first.room;
	if (second.area > first.area) return second.room;
	// Exact tie: stable existing Room ID lexical ordering.
	return first.room.id < second.room.id ? first.room : second.room;
}

/** Outcome of resolving one relation endpoint through the topology edit. */
type PortalSideResolution =
	| { kind: 'room'; roomId: string }
	| { kind: 'cleared' }
	| { kind: 'unresolved'; reason: string };

/**
 * Portal semantic remapping for topology edits. New-schema doors on
 * boundary walls derive physical adjacency from the wall; the explicit
 * `connectsRoomIds` relation is remapped only when lineage makes the result
 * unambiguous, cleared on planned semantic collapse, and rejected otherwise.
 *
 * Split sides are resolved through **wall-side adjacency**: when a relation
 * endpoint is the predecessor of a 1→2 split, the successor is the descendant
 * whose reconciled boundary references the opening's hosting Wall — never
 * merely the descendant that kept the predecessor ID. Zero or multiple
 * adjacent descendants is an ambiguous remap and rejects the whole topology
 * edit (`unresolved_portal_remap`), per the portal split rule.
 */
export function remapPortalRelations(options: {
	successorOf: ReadonlyMap<string, string>;
	retiredRoomIds: readonly string[];
	/** Predecessor Room ID → descendant Room IDs of a 1→2 split component. */
	splitDescendants: ReadonlyMap<string, readonly string[]>;
	/** Reconciled surviving Rooms (boundaries already rewritten/reconciled). */
	rooms: readonly LayoutWallFirstRoom[];
	openings: readonly LayoutWallOpening[];
}): { kind: 'ok'; openings: LayoutWallOpening[] } | ReconciliationFailure {
	const { successorOf, retiredRoomIds, splitDescendants, rooms, openings } = options;
	if (retiredRoomIds.length === 0 && splitDescendants.size === 0) {
		return { kind: 'ok', openings: [...openings] };
	}
	const boundaryByRoomId = new Map(rooms.map((room) => [room.id, room.boundary]));
	const referencesWall = (roomId: string, wallId: string): boolean =>
		(boundaryByRoomId.get(roomId) ?? []).some((ref) => ref.wallId === wallId);

	/** Resolve one relation endpoint for one opening's hosting Wall. */
	const resolveSide = (roomId: string, hostWallId: string): PortalSideResolution => {
		const descendants = splitDescendants.get(roomId);
		if (descendants && descendants.length > 0) {
			if (descendants.length !== 2) {
				return {
					kind: 'unresolved',
					reason: `split of room '${roomId}' has ${descendants.length} descendants`,
				};
			}
			const adjacent = descendants.filter((id) => referencesWall(id, hostWallId));
			if (adjacent.length !== 1) {
				return {
					kind: 'unresolved',
					reason:
						adjacent.length === 0
							? `no descendant of split room '${roomId}' is adjacent to the hosting wall '${hostWallId}'`
							: `descendants ${adjacent.join(', ')} of room '${roomId}' are both adjacent to the hosting wall '${hostWallId}'`,
				};
			}
			return { kind: 'room', roomId: adjacent[0]! };
		}
		if (retiredRoomIds.includes(roomId)) {
			const successor = successorOf.get(roomId);
			return successor ? { kind: 'room', roomId: successor } : { kind: 'cleared' };
		}
		return { kind: 'room', roomId };
	};

	const remapped: LayoutWallOpening[] = [];
	for (const opening of openings) {
		const relation = opening.connectsRoomIds;
		if (!relation) {
			remapped.push(opening);
			continue;
		}
		const [a, b] = relation;
		const nextA = resolveSide(a, opening.wallId);
		const nextB = resolveSide(b, opening.wallId);
		const unresolved = [nextA, nextB].find((side) => side.kind === 'unresolved');
		if (unresolved && unresolved.kind === 'unresolved') {
			return failure({
				code: 'unresolved_portal_remap',
				message: `Opening '${opening.id}' portal relation cannot be remapped unambiguously (${unresolved.reason})`,
				roomIds: [a, b],
			});
		}
		const aCleared = nextA.kind !== 'room';
		const bCleared = nextB.kind !== 'room';
		if (aCleared && bCleared) {
			// Unambiguous disappearance clears the relation while preserving
			// the physical door (portal disappearance rule).
			const cleared = { ...opening };
			delete (cleared as Partial<LayoutWallOpening>).connectsRoomIds;
			remapped.push(cleared as LayoutWallOpening);
			continue;
		}
		if (aCleared || bCleared) {
			// One side vanished while the other resolved: the surviving
			// semantic pairing is unknown → reject rather than guess.
			return failure({
				code: 'unresolved_portal_remap',
				message: `Opening '${opening.id}' relation has one unresolvable endpoint (${aCleared ? a : b} disappeared)`,
				roomIds: [a, b],
			});
		}
		const nextAId = (nextA as { kind: 'room'; roomId: string }).roomId;
		const nextBId = (nextB as { kind: 'room'; roomId: string }).roomId;
		if (nextAId === nextBId) {
			// Both tuple members collapsed into the same room: planned semantic
			// collapse, physical door preserved.
			const collapsed = { ...opening };
			delete (collapsed as Partial<LayoutWallOpening>).connectsRoomIds;
			remapped.push(collapsed as LayoutWallOpening);
			continue;
		}
		remapped.push({ ...opening, connectsRoomIds: [nextAId, nextBId] });
	}
	// Validate no unresolved relations to retired rooms remain.
	for (const opening of remapped) {
		const relation = opening.connectsRoomIds;
		if (!relation) continue;
		if (retiredRoomIds.includes(relation[0]) || retiredRoomIds.includes(relation[1])) {
			return failure({
				code: 'unresolved_portal_remap',
				message: `Opening '${opening.id}' retains a relation to retired room`,
				roomIds: [relation[0], relation[1]],
			});
		}
	}
	return { kind: 'ok', openings: remapped };
}

export function failure(rejection: ReconciliationRejection): ReconciliationFailure {
	return { kind: 'rejected', rejection };
}

/** Oriented wall refs helper used by tests/fixtures to build room boundaries. */
export function wallRef(wallId: string, direction: 'forward' | 'reverse'): OrientedWallRef {
	return { wallId, direction };
}
