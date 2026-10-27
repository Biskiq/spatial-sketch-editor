/**
 * `layout-wall-role.ts` — format 6 derived Wall role.
 *
 * A Wall has no authored `role`. Bounding, dividing and free-standing Walls are
 * derived from **face membership**: the persistent Rooms whose reconciled
 * boundary references the Wall. That is the same membership face extraction
 * produced, so the derived role can never disagree with the Rooms the creator
 * sees.
 *
 * Nothing here is persisted and nothing allocates: the derivation is a pure
 * read over the current document.
 */
import type {
	LayoutDerivedWallRole,
	LayoutDocumentWallFirst
} from './layout-wall-first-types';
import { deriveIndexedWallRole } from './layout-world-index';

/**
 * How many Room boundaries reference each Wall. A Wall referenced twice by the
 * *same* Room is still one Room membership, so the count is per Room.
 */
export function layoutWallRoomMemberships(
	document: LayoutDocumentWallFirst
): ReadonlyMap<string, readonly string[]> {
	const roomsByWall = new Map<string, string[]>();
	for (const room of document.rooms) {
		const seen = new Set<string>();
		for (const ref of room.boundary) {
			if (seen.has(ref.wallId)) continue;
			seen.add(ref.wallId);
			const rooms = roomsByWall.get(ref.wallId);
			if (rooms) rooms.push(room.id);
			else roomsByWall.set(ref.wallId, [room.id]);
		}
	}
	return roomsByWall;
}

/**
 * The derived role of one Wall, or `undefined` when the document has no such
 * Wall. `bounding` = one Room boundary, `dividing` = more than one,
 * `free-standing` = none.
 */
export function deriveLayoutWallRole(
	document: LayoutDocumentWallFirst,
	wallId: string
): LayoutDerivedWallRole | undefined {
	const indexed = deriveIndexedWallRole(document, wallId);
	if (indexed !== undefined) {
		return indexed === 'missing-wall' ? undefined : indexed;
	}
	if (!document.walls.some((wall) => wall.id === wallId)) return undefined;
	const memberships = layoutWallRoomMemberships(document).get(wallId)?.length ?? 0;
	if (memberships === 0) return 'free-standing';
	return memberships === 1 ? 'bounding' : 'dividing';
}

/** Every Wall's derived role, keyed by Wall id, in document order. */
export function deriveLayoutWallRoles(
	document: LayoutDocumentWallFirst
): ReadonlyMap<string, LayoutDerivedWallRole> {
	const memberships = layoutWallRoomMemberships(document);
	const roles = new Map<string, LayoutDerivedWallRole>();
	for (const wall of document.walls) {
		const count = memberships.get(wall.id)?.length ?? 0;
		roles.set(wall.id, count === 0 ? 'free-standing' : count === 1 ? 'bounding' : 'dividing');
	}
	return roles;
}
