/**
 * `layout-room-isolation.ts` — P23.6a S1: the **single** isolated-Room
 * subgraph policy shared by the P23.4 isolated-Room duplicate and the P23.6a
 * wall-first Room move.
 *
 * A wall-first Room is persistent semantic identity reconciled from topology,
 * so an operation that relocates or clones a whole Room must first prove that
 * the Room's canonical boundary graph can move (or clone) without detaching or
 * deforming architecture that must stay put. That policy is stated **once**
 * here; `planDuplicateIsolatedRoom()` and `planWallFirstRoomMove()` consume it
 * and can therefore never drift semantically.
 *
 * Rejection codes/messages keep the P23.4 wording (`unknown_room`,
 * `invalid_reference`, `room_not_isolated`, `external_portal_relation`,
 * `profile_object_read_only`) so duplicate behavior is unchanged by the
 * extraction.
 *
 * Pure and read-only: no allocation, no document mutation, no persistence.
 */
import type { LayoutObject } from './layout-types';
import type {
	LayoutDocumentWallFirst,
	LayoutWallFirstRoom
} from './layout-wall-first-types';

/**
 * Shared supported-object predicate (single source of truth for duplicate and
 * move): `profile` objects are read-only compatibility placeholders and reject
 * explicitly — never silently stripped or partially relocated.
 */
export function isSupportedLayoutObject(object: Pick<LayoutObject, 'kind'>): boolean {
	return object.kind !== 'profile';
}

export type RoomIsolationRejectionCode =
	| 'unknown_room'
	| 'invalid_reference'
	| 'room_not_isolated'
	| 'external_portal_relation'
	| 'profile_object_read_only';

export type RoomIsolationRejection = {
	code: RoomIsolationRejectionCode;
	message: string;
	/** Involved authored IDs where available. */
	targetIds?: readonly string[];
};

export type IsolatedRoomSubgraph = {
	roomId: string;
	/** Boundary Wall IDs in canonical Room-boundary order (deduped). */
	wallIds: string[];
	/** Boundary Junction IDs (deduped, deterministic document order). */
	junctionIds: string[];
	/** Openings hosted by those Walls, document order. */
	openingIds: string[];
	/** Objects explicitly associated with the Room, document order. */
	associatedObjectIds: string[];
	/** Associated read-only profile objects, if any (rejection evidence). */
	profileObjectIds: string[];
};

export type IsolatedRoomSubgraphResult =
	| { kind: 'success'; subgraph: IsolatedRoomSubgraph; room: LayoutWallFirstRoom }
	| { kind: 'rejected'; rejection: RoomIsolationRejection };

function reject(
	code: RoomIsolationRejectionCode,
	message: string,
	targetIds?: readonly string[]
): IsolatedRoomSubgraphResult {
	return { kind: 'rejected', rejection: { code, message, ...(targetIds ? { targetIds } : {}) } };
}

/**
 * Resolve one Room's isolated subgraph, or the exact P23.4 reason it is not
 * isolated. Cell order (stable, and identical to the pre-extraction duplicate
 * behavior):
 *
 * 1. the Room exists;
 * 2. every boundary Wall resolves;
 * 3. no boundary Wall is referenced by another Room (shared Wall);
 * 4. no Wall outside the subgraph is incident to a boundary Junction
 *    (including a corner-only single-Wall connection);
 * 5. no hosted Opening carries a `connectsRoomIds` portal relation;
 * 6. no explicitly associated object is a read-only `profile`.
 */
export function resolveIsolatedRoomSubgraph(
	document: LayoutDocumentWallFirst,
	roomId: string
): IsolatedRoomSubgraphResult {
	const room = document.rooms.find((candidate) => candidate.id === roomId);
	if (!room) {
		return reject('unknown_room', `Unknown room '${roomId}'`, [roomId]);
	}

	const wallById = new Map(document.walls.map((wall) => [wall.id, wall]));
	const boundaryWallIds = [...new Set(room.boundary.map((ref) => ref.wallId))];
	const missing = boundaryWallIds.filter((wallId) => !wallById.has(wallId));
	if (missing.length > 0) {
		return reject('invalid_reference', `Room '${roomId}' has unresolved boundary Walls`, [
			roomId,
			...missing
		]);
	}
	const boundaryWallSet = new Set(boundaryWallIds);

	// Gate 1: no boundary Wall may be shared with another Room — moving or
	// cloning it would force detaching/copy-on-write semantics (rejected with
	// a clear diagnostic, never silently).
	for (const other of document.rooms) {
		if (other.id === roomId) continue;
		const shared = other.boundary
			.map((ref) => ref.wallId)
			.filter((wallId) => boundaryWallSet.has(wallId));
		if (shared.length > 0) {
			return reject(
				'room_not_isolated',
				`Room '${roomId}' shares Wall(s) ${shared.join(', ')} with Room '${other.id}'; shared-boundary Room duplicate is unsupported`,
				[roomId, other.id, ...shared]
			);
		}
	}

	// Gate 2: the subgraph must own every Wall incident to its Junctions — an
	// outside Wall attached to a boundary Junction would otherwise be detached
	// (or duplicated one-sided) by the operation.
	const boundaryJunctionIds = new Set<string>();
	const junctionOrder: string[] = [];
	for (const wallId of boundaryWallIds) {
		const wall = wallById.get(wallId)!;
		for (const junctionId of [wall.startJunctionId, wall.endJunctionId]) {
			if (boundaryJunctionIds.has(junctionId)) continue;
			boundaryJunctionIds.add(junctionId);
			junctionOrder.push(junctionId);
		}
	}
	const attachedOutsideWallIds = document.walls
		.filter(
			(wall) =>
				!boundaryWallSet.has(wall.id) &&
				(boundaryJunctionIds.has(wall.startJunctionId) ||
					boundaryJunctionIds.has(wall.endJunctionId))
		)
		.map((wall) => wall.id);
	if (attachedOutsideWallIds.length > 0) {
		return reject(
			'room_not_isolated',
			`Room '${roomId}' boundary junctions carry non-cloned wall(s) ${attachedOutsideWallIds.join(', ')}; the bounded subgraph is not isolated`,
			[roomId, ...attachedOutsideWallIds]
		);
	}

	// Gate 3: a hosted Opening portal relation references Rooms outside the
	// subgraph and cannot be remapped safely.
	const hostedOpenings = document.openings.filter((opening) =>
		boundaryWallSet.has(opening.wallId)
	);
	const relationOpeningIds = hostedOpenings
		.filter((opening) => opening.connectsRoomIds !== undefined)
		.map((opening) => opening.id);
	if (relationOpeningIds.length > 0) {
		return reject(
			'external_portal_relation',
			`Room '${roomId}' opening(s) ${relationOpeningIds.join(', ')} carry portal relations into non-cloned Rooms; resolve or remove them before duplicating`,
			[roomId, ...relationOpeningIds]
		);
	}

	// Gate 4: explicitly associated objects. Profile objects are read-only
	// compatibility placeholders and reject the whole operation up front —
	// neither clone nor move may silently strip or partially relocate one.
	const associatedObjects = document.objects.filter((object) => object.roomId === roomId);
	const profileObjectIds = associatedObjects
		.filter((object) => !isSupportedLayoutObject(object))
		.map((object) => object.id);
	if (profileObjectIds.length > 0) {
		return reject(
			'profile_object_read_only',
			`Room '${roomId}' contains read-only profile object(s) ${profileObjectIds.join(', ')}; resolve or remove them before duplicating or moving`,
			[roomId, ...profileObjectIds]
		);
	}

	return {
		kind: 'success',
		room,
		subgraph: {
			roomId,
			wallIds: boundaryWallIds,
			junctionIds: junctionOrder,
			openingIds: hostedOpenings.map((opening) => opening.id),
			associatedObjectIds: associatedObjects.map((object) => object.id),
			profileObjectIds
		}
	};
}
