import type { LayoutDocumentWallFirst, LayoutWallFirstRoom } from '../../wall/types';
import { roundRoomSeamJunctionId } from './certify';

// ---------------------------------------------------------------------------
// C2 — Member edit guard, operation correspondence, safe-cut search & split
// ---------------------------------------------------------------------------

export const ROUND_ROOM_MEMBER_EDIT_MESSAGE =
	'This wall is part of a round room. Change Radius, or release round.' as const;

export type RoundRoomMemberGuardHit = {
	readonly code: 'round_room_member_locked';
	readonly message: typeof ROUND_ROOM_MEMBER_EDIT_MESSAGE;
	readonly roomId: string;
	readonly wallIds: readonly string[];
	readonly junctionIds: readonly string[];
};

/**
 * Guard geometry-changing member edits on any Round Room boundary Wall or rim
 * Junction (including neighbour edits that would drag a rim Junction).
 */
export function guardRoundRoomMemberGeometryEdit(
	document: Pick<LayoutDocumentWallFirst, 'walls' | 'rooms'>,
	target: {
		readonly wallIds?: readonly string[];
		readonly junctionIds?: readonly string[];
	},
): RoundRoomMemberGuardHit | null {
	const roundRooms = document.rooms.filter((room) => room.round !== undefined);
	if (roundRooms.length === 0) return null;
	const targetWalls = new Set(target.wallIds ?? []);
	const targetJunctions = new Set(target.junctionIds ?? []);
	if (targetWalls.size === 0 && targetJunctions.size === 0) return null;
	const wallById = new Map(document.walls.map((wall) => [wall.id, wall] as const));

	for (const room of roundRooms) {
		const hitWalls: string[] = [];
		const hitJunctions: string[] = [];
		for (const ref of room.boundary) {
			const wall = wallById.get(ref.wallId);
			if (!wall) continue;
			if (targetWalls.has(wall.id) && !hitWalls.includes(wall.id)) {
				hitWalls.push(wall.id);
			}
			for (const jId of [wall.startJunctionId, wall.endJunctionId]) {
				if (targetJunctions.has(jId) && !hitJunctions.includes(jId)) {
					hitJunctions.push(jId);
				}
			}
		}
		if (hitWalls.length > 0 || hitJunctions.length > 0) {
			return {
				code: 'round_room_member_locked',
				message: ROUND_ROOM_MEMBER_EDIT_MESSAGE,
				roomId: room.id,
				wallIds: hitWalls,
				junctionIds: hitJunctions,
			};
		}
	}
	return null;
}

/** Find a Round Room whose canonical seam Junction equals `junctionId`. */
export function findRoundRoomSeamOwner(
	document: Pick<LayoutDocumentWallFirst, 'walls' | 'rooms'>,
	junctionId: string,
): { readonly room: LayoutWallFirstRoom; readonly wallIds: readonly string[] } | null {
	const wallById = new Map(document.walls.map((wall) => [wall.id, wall] as const));
	for (const room of document.rooms) {
		if (room.round === undefined) continue;
		const seamId = roundRoomSeamJunctionId(room, wallById);
		if (seamId === junctionId) {
			return {
				room,
				wallIds: room.boundary.map((ref) => ref.wallId),
			};
		}
	}
	return null;
}
