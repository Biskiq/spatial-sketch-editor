import type { WallFirstOpPlan, WallFirstOpRejection } from './contracts';
import type {
	LayoutDocumentWallFirst,
	LayoutWall,
	LayoutWallFirstRoom,
	LayoutWallOpening,
} from '../types';
import { validateAndCompile } from './birth';

/**
 * Canonical Room metadata update (name, floor/ceiling thickness).
 *
 * Metadata is **not** topology: no face extraction, no reconciliation.
 * The candidate rewrites only the Room's own authored fields and runs the same
 * final canonical validation + compile gate every planner uses, so a metadata
 * edit can never smuggle in a boundary/topology change.
 *
 * - `boundary` is correspondence-owned and **not patchable** — a patch that
 *  carries it (or any unrecognized/legacy field) rejects `invalid_patch`;
 * - `name` is trimmed and must be non-empty (duplicate names are legal — `id`
 *  is identity, mirroring legacy behavior);
 *  requires), with no invented tolerance or range;
 * - a patch that changes nothing rejects `no_op`, so callers write zero
 *  history.
 */
export type RoomMetadataPatch = {
	name?: string;
	/** Authored overhead intent; `closed` generates the lid, `open-to-sky` removes it. */
	overhead?: 'closed' | 'open-to-sky';
};

export function planRoomMetadataUpdate(
	document: LayoutDocumentWallFirst,
	roomId: string,
	patch: RoomMetadataPatch,
): WallFirstOpPlan {
	const reject = (rejection: WallFirstOpRejection): WallFirstOpPlan => ({
		kind: 'rejected',
		rejection,
	});
	const room = document.rooms.find((candidate) => candidate.id === roomId);
	if (!room) {
		return reject({
			code: 'unknown_room',
			message: `Unknown room '${roomId}'`,
			roomIds: [roomId],
		});
	}
	if (patch === null || typeof patch !== 'object' || Array.isArray(patch)) {
		return reject({
			code: 'invalid_patch',
			message: 'Room metadata patch must be an object',
			roomIds: [roomId],
		});
	}
	const allowedKeys = new Set(['name', 'overhead']);
	const unknownKeys = Object.keys(patch).filter((key) => !allowedKeys.has(key));
	if (unknownKeys.length > 0) {
		return reject({
			code: 'invalid_patch',
			message: `Room metadata patch cannot change ${unknownKeys.join(', ')}; the boundary and virtual edges are correspondence-owned`,
			roomIds: [roomId],
		});
	}

	const nextRoom: LayoutWallFirstRoom = {
		...room,
		boundary: room.boundary.map((ref) => ({ ...ref })),
	};
	if (patch.name !== undefined) {
		if (typeof patch.name !== 'string' || patch.name.trim().length === 0) {
			return reject({
				code: 'invalid_value',
				message: 'Room name cannot be empty',
				roomIds: [roomId],
			});
		}
		nextRoom.name = patch.name.trim();
	}
	if (patch.overhead !== undefined) {
		if (patch.overhead !== 'closed' && patch.overhead !== 'open-to-sky') {
			return reject({
				code: 'invalid_value',
				message: "Room overhead must be 'closed' or 'open-to-sky'",
				roomIds: [roomId],
			});
		}
		nextRoom.overhead = patch.overhead;
	}
	if (nextRoom.name === room.name && nextRoom.overhead === room.overhead) {
		return reject({
			code: 'no_op',
			message: `Room '${roomId}' already has those values`,
			roomIds: [roomId],
		});
	}

	const candidate: LayoutDocumentWallFirst = {
		...document,
		rooms: document.rooms.map((entry) => (entry.id === roomId ? nextRoom : entry)),
	};
	return validateAndCompile(candidate, reject, (committed) => ({
		kind: 'success',
		document: committed,
		lineage: [],
		surfaceLineage: [],
		retiredRoomIds: [],
	}));
}

/**
 * The exact optional-name patch semantics shared by the Wall and
 * Opening metadata planners (owner-required lock):
 *
 * - `name: 'North Gallery Wall'` trims and sets;
 * - a string that trims to empty rejects `invalid_value` (blank is never a
 *  name, matching the codec and the Room planner);
 * - `name: null` **removes** the property (clear; the entity returns to
 *  reference-led presentation);
 * - the key absent means the field is not part of the patch;
 * - a patch that changes nothing — including `null` for an already-unnamed
 *  entity — rejects `no_op`, so callers write zero history.
 *
 * Duplicate names are legal (`id` is identity), and a name is never display
 * identity: the compact reference is.
 */
export type OptionalNamePatch = { name?: string | null };

/**
 * Shared name-patch applier for the Wall/Opening metadata planners. Returns
 * the rejection to surface, or `undefined` when `name` was applied cleanly.
 */
function applyOptionalNamePatch(
	entity: { name?: string },
	patch: OptionalNamePatch,
	description: string,
): WallFirstOpRejection | undefined {
	if (!('name' in patch)) return undefined;
	const value = patch.name;
	if (value === null) {
		if (entity.name === undefined) {
			return {
				code: 'no_op',
				message: `${description} is already unnamed`,
			};
		}
		delete entity.name;
		return undefined;
	}
	if (typeof value !== 'string' || value.trim().length === 0) {
		return {
			code: 'invalid_value',
			message: `${description} name cannot be empty`,
		};
	}
	const trimmed = value.trim();
	if (entity.name === trimmed) {
		return {
			code: 'no_op',
			message: `${description} already has that name`,
		};
	}
	entity.name = trimmed;
	return undefined;
}

/**
 * Canonical Wall metadata update (optional name) through the one
 * planner. A sibling of {@link planRoomMetadataUpdate}: metadata is not
 * topology, so no face extraction runs; the candidate still passes the
 * canonical validation + compile gate. See {@link OptionalNamePatch} for the
 * exact patch semantics.
 */
export function planWallMetadataUpdate(
	document: LayoutDocumentWallFirst,
	wallId: string,
	patch: OptionalNamePatch,
): WallFirstOpPlan {
	const reject = (rejection: WallFirstOpRejection): WallFirstOpPlan => ({
		kind: 'rejected',
		rejection,
	});
	const wall = document.walls.find((candidate) => candidate.id === wallId);
	if (!wall) {
		return reject({
			code: 'unknown_wall',
			message: `Unknown wall '${wallId}'`,
			wallIds: [wallId],
		});
	}
	if (patch === null || typeof patch !== 'object' || Array.isArray(patch)) {
		return reject({
			code: 'invalid_patch',
			message: 'Wall metadata patch must be an object',
			wallIds: [wallId],
		});
	}
	const allowedKeys = new Set(['name']);
	const unknownKeys = Object.keys(patch).filter((key) => !allowedKeys.has(key));
	if (unknownKeys.length > 0) {
		return reject({
			code: 'invalid_patch',
			message: `Wall metadata patch cannot change ${unknownKeys.join(', ')}; topology is owned by the topology planners`,
			wallIds: [wallId],
		});
	}

	const nextWall: LayoutWall = { ...wall };
	const nameRejection = applyOptionalNamePatch(nextWall, patch, 'Wall');
	if (nameRejection) {
		return reject({ ...nameRejection, wallIds: [wallId] });
	}
	if (nextWall.name === wall.name && 'centerline' in nextWall === 'centerline' in wall) {
		return reject({
			code: 'no_op',
			message: `Wall '${wallId}' already has those values`,
			wallIds: [wallId],
		});
	}

	const candidate: LayoutDocumentWallFirst = {
		...document,
		walls: document.walls.map((entry) => (entry.id === wallId ? nextWall : entry)),
	};
	return validateAndCompile(candidate, reject, (committed) => ({
		kind: 'success',
		document: committed,
		lineage: [],
		surfaceLineage: [],
		retiredRoomIds: [],
	}));
}

/**
 * Canonical Opening metadata update (optional name) through the one
 * planner. A sibling of {@link planRoomMetadataUpdate}; the Opening survives
 * the edit, so its reference and its host Wall are untouched. See
 * {@link OptionalNamePatch} for the exact patch semantics.
 */
export function planOpeningMetadataUpdate(
	document: LayoutDocumentWallFirst,
	openingId: string,
	patch: OptionalNamePatch,
): WallFirstOpPlan {
	const reject = (rejection: WallFirstOpRejection): WallFirstOpPlan => ({
		kind: 'rejected',
		rejection,
	});
	const opening = document.openings.find((candidate) => candidate.id === openingId);
	if (!opening) {
		return reject({
			code: 'invalid_value',
			message: `Unknown opening '${openingId}'`,
		});
	}
	if (patch === null || typeof patch !== 'object' || Array.isArray(patch)) {
		return reject({
			code: 'invalid_patch',
			message: 'Opening metadata patch must be an object',
		});
	}
	const allowedKeys = new Set(['name']);
	const unknownKeys = Object.keys(patch).filter((key) => !allowedKeys.has(key));
	if (unknownKeys.length > 0) {
		return reject({
			code: 'invalid_patch',
			message: `Opening metadata patch cannot change ${unknownKeys.join(', ')}; geometry and kind are owned by the Opening planners`,
		});
	}

	const nextOpening: LayoutWallOpening = { ...opening };
	const nameRejection = applyOptionalNamePatch(nextOpening, patch, 'Opening');
	if (nameRejection) {
		return reject(nameRejection);
	}
	if (nextOpening.name === opening.name) {
		return reject({
			code: 'no_op',
			message: `Opening '${openingId}' already has those values`,
		});
	}

	const candidate: LayoutDocumentWallFirst = {
		...document,
		openings: document.openings.map((entry) => (entry.id === openingId ? nextOpening : entry)),
	};
	return validateAndCompile(candidate, reject, (committed) => ({
		kind: 'success',
		document: committed,
		lineage: [],
		surfaceLineage: [],
		retiredRoomIds: [],
	}));
}
