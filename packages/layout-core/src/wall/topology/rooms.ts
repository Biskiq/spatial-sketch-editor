import type { WallFirstOpPlan, WallFirstOpRejection } from './contracts';
import type { LayoutDocumentWallFirst } from '../types';
import type { LayoutVec2 } from '../../geometry/coordinates';
import type { LayoutIdCapture } from '../../plan/id-capture';
import { LayoutIdCollisionError, layoutWorkingLevelIssue } from '../../plan/id-capture';
import { validateAndCompile } from './birth';
import { planWallRemovalSet } from './removal';

/**
 * The Room's own boundary Walls that reference **no other** Room
 * (exclusive per the baseline document's `rooms[].boundary` references, never
 * geometry). This is exactly the Wall set {@link planRemoveRoom} demolishes —
 * a shared Wall is one physical Wall the neighbour still needs, so it is kept.
 * Returned in the Room's boundary order, deduplicated; surface callers use the
 * same predicate to report removal eligibility (never a second rule).
 */
export function roomExclusiveBoundaryWallIds(
	document: LayoutDocumentWallFirst,
	roomId: string,
): string[] {
	const room = document.rooms.find((candidate) => candidate.id === roomId);
	if (!room) return [];
	const boundaryWallIds = new Set(room.boundary.map((ref) => ref.wallId));
	const sharedWallIds = new Set<string>();
	for (const other of document.rooms) {
		if (other.id === roomId) continue;
		for (const ref of other.boundary) {
			if (boundaryWallIds.has(ref.wallId)) sharedWallIds.add(ref.wallId);
		}
	}
	return [...boundaryWallIds].filter((wallId) => !sharedWallIds.has(wallId));
}

/**
 * Canonical "Remove Room": remove the Room and its exclusive
 * enclosure Walls in one atomic operation while preserving shared physical
 * Walls required by adjacent Rooms, so selecting a Room and deleting removes
 * the Room together with the Walls it owns alone (never a neighbour's Walls).
 * Rides the shared Wall-removal pipeline, so single-Wall delete and Room
 * removal stay one authority.
 *
 * Wall ownership comes from the baseline `rooms[].boundary` references, never
 * geometry:
 *
 * - every boundary Wall referenced by **no other** Room is removed — for a
 *  standalone drawn Room that is its entire boundary, so nothing (no open
 *  shell of leftover Walls) survives the command;
 * - a Wall **shared** with a neighbouring Room is kept: it is one physical
 *  Wall the neighbour still needs, and removing the Room's exclusive Walls
 *  still opens its enclosure, so it retires through normal
 *  reconciliation;
 * - a Room whose every boundary Wall is shared (a fully interior Room) owns
 *  nothing alone, so it rejects `ambiguous_room_removal` rather than silently
 *  demolishing a neighbour's Walls;
 * - a boundary reference to a missing Wall rejects `wall_not_in_room_boundary`.
 *
 * This is still never a `LayoutRoom` record splice (the Room-identity
 * invariant forbids a boundary-less Room). Hosted Openings of the removed
 * Walls go atomically, endpoint Junctions prune reference-only, and portal/
 * object associations remap/clear per the existing contract. Ambiguous
 * or unsupported topology rejects atomically with zero history; the planner is
 * input-pure.
 */
export function planRemoveRoom(
	document: LayoutDocumentWallFirst,
	roomId: string,
	capture: LayoutIdCapture,
	levelId: string,
): WallFirstOpPlan {
	const reject = (rejection: WallFirstOpRejection): WallFirstOpPlan => ({
		kind: 'rejected',
		rejection,
	});
	const levelIssue = layoutWorkingLevelIssue(document, levelId);
	if (levelIssue !== null)
		return reject({ code: 'invalid_value', message: levelIssue, roomIds: [roomId] });
	const room = document.rooms.find((candidate) => candidate.id === roomId);
	if (!room) {
		return reject({
			code: 'unknown_room',
			message: `Unknown room '${roomId}'`,
			roomIds: [roomId],
		});
	}
	if (room.boundary.length === 0) {
		return reject({
			code: 'ambiguous_room_removal',
			message: `Room '${roomId}' has no boundary Walls to remove`,
			roomIds: [roomId],
		});
	}
	const boundaryWallIds = [...new Set(room.boundary.map((ref) => ref.wallId))];
	const missing = boundaryWallIds.filter(
		(wallId) => !document.walls.some((wall) => wall.id === wallId),
	);
	if (missing.length > 0) {
		return reject({
			code: 'wall_not_in_room_boundary',
			message: `Room '${roomId}' references unknown Walls: ${missing.join(', ')}`,
			wallIds: missing,
			roomIds: [roomId],
		});
	}
	const exclusiveWallIds = roomExclusiveBoundaryWallIds(document, roomId);
	if (exclusiveWallIds.length === 0) {
		return reject({
			code: 'ambiguous_room_removal',
			message: `Every boundary Wall of room '${roomId}' is shared with a neighbouring room; delete the shared Walls explicitly`,
			roomIds: [roomId],
			wallIds: boundaryWallIds,
		});
	}
	try {
		return planWallRemovalSet(document, exclusiveWallIds, capture, {
			invalidOutline: 'reject',
			retireRoomIds: [roomId],
		});
	} catch (error) {
		if (error instanceof LayoutIdCollisionError) {
			return {
				kind: 'rejected',
				rejection: {
					code: 'captured_id_in_use',
					message: error.message,
					wallIds: exclusiveWallIds,
					roomIds: [roomId],
				},
			};
		}
		throw error;
	}
}

/**
 * Canonical **Remove space**: remove one open Space record without demolishing
 * its Walls. Objects lose the association, door relations naming it are
 * cleared, and only the anchors the operation released are pruned (I8/T16).
 * No face extraction and no reconciliation run: the candidate has no topology
 * change, so it only passes the canonical codec + compile gate.
 */
export function planRemoveSpace(
	document: LayoutDocumentWallFirst,
	roomId: string,
	levelId: string,
): WallFirstOpPlan {
	const reject = (rejection: WallFirstOpRejection): WallFirstOpPlan => ({
		kind: 'rejected',
		rejection,
	});
	const levelIssue = layoutWorkingLevelIssue(document, levelId);
	if (levelIssue !== null)
		return reject({ code: 'invalid_value', message: levelIssue, roomIds: [roomId] });
	const room = document.rooms.find((candidate) => candidate.id === roomId);
	if (!room) {
		return reject({ code: 'unknown_room', message: `Unknown room '${roomId}'`, roomIds: [roomId] });
	}
	if (room.virtualEdges.length === 0) {
		return reject({
			code: 'not_open_space',
			message: `Room '${roomId}' is enclosed; Remove space applies to open Spaces only`,
			roomIds: [roomId],
		});
	}

	const releasedJunctionIds = new Set<string>();
	for (const edge of room.virtualEdges) {
		releasedJunctionIds.add(edge.startJunctionId);
		releasedJunctionIds.add(edge.endJunctionId);
	}
	const openings = document.openings.map((opening) => {
		if (!opening.connectsRoomIds?.includes(roomId)) return opening;
		const cleared = { ...opening };
		delete cleared.connectsRoomIds;
		return cleared;
	});
	const candidate: LayoutDocumentWallFirst = {
		...document,
		rooms: document.rooms.filter((candidate) => candidate.id !== roomId),
		objects: document.objects.map((object) =>
			object.roomId === roomId ? { ...object, roomId: undefined } : object,
		),
		openings,
	};
	const referencedJunctionIds = new Set<string>();
	for (const wall of candidate.walls) {
		referencedJunctionIds.add(wall.startJunctionId);
		referencedJunctionIds.add(wall.endJunctionId);
	}
	for (const other of candidate.rooms) {
		for (const edge of other.virtualEdges) {
			referencedJunctionIds.add(edge.startJunctionId);
			referencedJunctionIds.add(edge.endJunctionId);
		}
	}
	candidate.junctions = document.junctions.filter(
		(junction) => !releasedJunctionIds.has(junction.id) || referencedJunctionIds.has(junction.id),
	);

	return validateAndCompile(candidate, reject, (committed) => ({
		kind: 'success',
		document: committed,
		lineage: [],
		surfaceLineage: [],
		retiredRoomIds: [roomId],
		spaceRetirements: [{ roomId, reason: 'explicit-remove' }],
	}));
}

/**
 * Convenience geometry helper for callers/tests: the submitted wall chain
 * as an untyped rectangle-equivalent seed list, so fixtures can build
 * closed chains without hand-writing junction arrays. Production callers
 * assemble junctions/walls through the noding plans instead.
 */
export function closedChainWalls(options: {
	junctions: ReadonlyArray<readonly [string, number, number]>;
	/** Walls as junction-ID pairs traversing the ring in one direction. */
	walls: ReadonlyArray<readonly [string, string, string]>;
	thickness?: number;
	/**
	 * Required authoritative Wall height. Fixtures pass their Floor
	 * height; no fixed default survives on this (or any) Wall-birth path.
	 */
	height: number;
}): Pick<LayoutDocumentWallFirst, 'junctions' | 'walls'> {
	const thickness = options.thickness ?? 0.2;
	const height = options.height;
	return {
		junctions: options.junctions.map(([id, x, z]) => ({ id, point: [x, z] as LayoutVec2 })),
		walls: options.walls.map(([id, start, end]) => ({
			id,
			startJunctionId: start,
			endJunctionId: end,
			thickness,
			height,
			top: { kind: 'level' } as const,
			centerline: { kind: 'line' } as const,
		})),
	};
}
