/**
 * `layout-room-isolation.ts` — P23.6a: the **single** shared isolation policy
 * for whole-Room operations.
 *
 * A wall-first Room is persistent semantic identity reconciled from topology,
 * so an operation that relocates or clones a Room must first prove what may
 * travel with it. Two scopes are stated here, once each, and shared by their
 * callers:
 *
 * - `resolveIsolatedRoomSubgraph()` — **one** Room whose boundary graph is
 *   isolated from every other Room and Wall. P23.4 duplication and the
 *   single-Room move path.
 * - `resolveIsolatedRoomGroupSubgraph()` — the **connected Room group** that
 *   contains a Room: every Room transitively joined to it through shared
 *   boundary Junctions. Moving any member alone would detach the others, so
 *   the group is the smallest unit a rigid translation can move. Interior
 *   shared Walls travel once with the group.
 *
 * The two scopes differ deliberately, not by drift: duplication must reject a
 * shared Wall (the clone would need a private copy of it and its Junctions),
 * while a translation keeps the shared Wall and simply moves it once with the
 * group. Both share every rule helper below, so neither can silently diverge
 * from the other's outside-architecture, portal-relation or read-only-object
 * policy.
 *
 * Rejection codes keep the P23.4 vocabulary (`unknown_room`,
 * `invalid_reference`, `room_not_isolated`, `external_portal_relation`,
 * `profile_object_read_only`).
 *
 * Pure and read-only: no allocation, no document mutation, no persistence.
 */
import type { LayoutObject } from './layout-types';
import type {
	LayoutDocumentWallFirst,
	LayoutWallFirstRoom,
	LayoutWallOpening
} from './layout-wall-first-types';

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

export type IsolatedRoomGroupSubgraph = {
	/**
	 * Member Room IDs — the anchor (requested) Room first, then the remaining
	 * connected members in document order.
	 */
	roomIds: string[];
	/** Union of member boundary Wall IDs, canonical Room order, deduped. */
	wallIds: string[];
	/** Union of member boundary Junction IDs, deduped, deterministic. */
	junctionIds: string[];
	/** Openings hosted by those Walls, document order. */
	openingIds: string[];
	/** Objects explicitly associated with any member, document order. */
	associatedObjectIds: string[];
	/** Associated read-only profile objects, if any (rejection evidence). */
	profileObjectIds: string[];
};

export type IsolatedRoomSubgraphResult =
	| { kind: 'success'; subgraph: IsolatedRoomSubgraph; room: LayoutWallFirstRoom }
	| { kind: 'rejected'; rejection: RoomIsolationRejection };

export type IsolatedRoomGroupSubgraphResult =
	| { kind: 'success'; subgraph: IsolatedRoomGroupSubgraph }
	| { kind: 'rejected'; rejection: RoomIsolationRejection };

/**
 * Shared supported-object predicate (single source of truth for duplicate and
 * move): `profile` objects are read-only compatibility placeholders and reject
 * explicitly — never silently stripped or partially relocated.
 */
export function isSupportedLayoutObject(object: Pick<LayoutObject, 'kind'>): boolean {
	return object.kind !== 'profile';
}

function reject(
	code: RoomIsolationRejectionCode,
	message: string,
	targetIds?: readonly string[]
): { kind: 'rejected'; rejection: RoomIsolationRejection } {
	return { kind: 'rejected', rejection: { code, message, ...(targetIds ? { targetIds } : {}) } };
}

type BoundaryGraph = {
	/** Boundary Wall IDs in canonical Room-boundary order (deduped). */
	wallIds: string[];
	wallIdSet: Set<string>;
	/** Boundary Junction IDs (deduped, deterministic). */
	junctionIds: string[];
	junctionIdSet: Set<string>;
	/** Openings hosted by those Walls, document order. */
	hostedOpenings: LayoutWallOpening[];
	/** Objects explicitly associated with the member Room(s), document order. */
	associatedObjects: LayoutObject[];
};

/**
 * Collect the boundary graph of one or more Rooms. Every referenced Wall must
 * resolve (`invalid_reference`) — a Room with an unresolved boundary cannot be
 * moved or cloned by any scope.
 */
function collectBoundaryGraph(
	document: LayoutDocumentWallFirst,
	rooms: readonly LayoutWallFirstRoom[]
): { kind: 'success'; graph: BoundaryGraph } | { kind: 'rejected'; rejection: RoomIsolationRejection } {
	const wallById = new Map(document.walls.map((wall) => [wall.id, wall]));
	const wallIds: string[] = [];
	const wallIdSet = new Set<string>();
	const junctionIds: string[] = [];
	const junctionIdSet = new Set<string>();
	for (const room of rooms) {
		const missing = room.boundary
			.map((ref) => ref.wallId)
			.filter((wallId) => !wallById.has(wallId));
		if (missing.length > 0) {
			return reject('invalid_reference', `Room '${room.id}' has unresolved boundary Walls`, [
				room.id,
				...missing
			]);
		}
		for (const ref of room.boundary) {
			if (!wallIdSet.has(ref.wallId)) {
				wallIdSet.add(ref.wallId);
				wallIds.push(ref.wallId);
			}
			const wall = wallById.get(ref.wallId)!;
			for (const junctionId of [wall.startJunctionId, wall.endJunctionId]) {
				if (junctionIdSet.has(junctionId)) continue;
				junctionIdSet.add(junctionId);
				junctionIds.push(junctionId);
			}
		}
	}
	return {
		kind: 'success',
		graph: {
			wallIds,
			wallIdSet,
			junctionIds,
			junctionIdSet,
			hostedOpenings: document.openings.filter((opening) => wallIdSet.has(opening.wallId)),
			associatedObjects: document.objects.filter(
				(object) => object.roomId !== undefined && rooms.some((room) => room.id === object.roomId)
			)
		}
	};
}

/**
 * Every Wall outside the moving/cloned set that touches one of its Junctions.
 * A stationary Wall attached to a moving Junction would be detached (or
 * duplicated one-sided) by the operation, so this is the core isolation rule.
 */
function outsideIncidentWallIds(
	document: LayoutDocumentWallFirst,
	graph: Pick<BoundaryGraph, 'wallIdSet' | 'junctionIdSet'>
): string[] {
	return document.walls
		.filter(
			(wall) =>
				!graph.wallIdSet.has(wall.id) &&
				(graph.junctionIdSet.has(wall.startJunctionId) ||
					graph.junctionIdSet.has(wall.endJunctionId))
		)
		.map((wall) => wall.id);
}

/**
 * Hosted Opening portal relations that would leave the set: a relation stays
 * valid only when **every** endpoint is a member. (For the single-Room scope
 * the only member is that Room, which is the P23.4 external-relation rule.)
 */
function externalPortalOpeningIds(
	hostedOpenings: readonly LayoutWallOpening[],
	memberRoomIds: ReadonlySet<string>
): string[] {
	return hostedOpenings
		.filter(
			(opening) =>
				opening.connectsRoomIds !== undefined &&
				opening.connectsRoomIds.some((roomId) => !memberRoomIds.has(roomId))
		)
		.map((opening) => opening.id);
}

function readOnlyProfileObjectIds(objects: readonly LayoutObject[]): string[] {
	return objects.filter((object) => !isSupportedLayoutObject(object)).map((object) => object.id);
}

/**
 * Rooms transitively joined to `roomId` through shared boundary **Junctions**
 * (which subsumes shared Walls, since a shared Wall shares its endpoints).
 * This is the rigid-connectivity graph: any of these Rooms cannot be
 * translated without detaching the others.
 *
 * Deterministic: the anchor first, then members in document order.
 */
export function connectedRoomIds(
	document: LayoutDocumentWallFirst,
	roomId: string
): string[] {
	const junctionToRooms = new Map<string, string[]>();
	const wallById = new Map(document.walls.map((wall) => [wall.id, wall]));
	for (const room of document.rooms) {
		const junctions = new Set<string>();
		for (const ref of room.boundary) {
			const wall = wallById.get(ref.wallId);
			if (!wall) continue;
			junctions.add(wall.startJunctionId);
			junctions.add(wall.endJunctionId);
		}
		for (const junctionId of junctions) {
			const members = junctionToRooms.get(junctionId);
			if (members) members.push(room.id);
			else junctionToRooms.set(junctionId, [room.id]);
		}
	}
	const roomById = new Map(document.rooms.map((room) => [room.id, room]));
	const seen = new Set<string>([roomId]);
	const queue = [roomId];
	while (queue.length > 0) {
		const current = queue.shift()!;
		const room = roomById.get(current);
		if (!room) continue;
		for (const ref of room.boundary) {
			const wall = wallById.get(ref.wallId);
			if (!wall) continue;
			for (const junctionId of [wall.startJunctionId, wall.endJunctionId]) {
				for (const neighbour of junctionToRooms.get(junctionId) ?? []) {
					if (seen.has(neighbour)) continue;
					seen.add(neighbour);
					queue.push(neighbour);
				}
			}
		}
	}
	// Anchor first, then the rest in document order.
	return [roomId, ...document.rooms.map((room) => room.id).filter((id) => id !== roomId && seen.has(id))];
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

	const collected = collectBoundaryGraph(document, [room]);
	if (collected.kind === 'rejected') return collected;
	const { graph } = collected;

	// Gate 1: no boundary Wall may be shared with another Room — moving or
	// cloning it would force detaching/copy-on-write semantics (rejected with a
	// clear diagnostic, never silently).
	for (const other of document.rooms) {
		if (other.id === roomId) continue;
		const shared = other.boundary
			.map((ref) => ref.wallId)
			.filter((wallId) => graph.wallIdSet.has(wallId));
		if (shared.length > 0) {
			return reject(
				'room_not_isolated',
				`Room '${roomId}' shares Wall(s) ${shared.join(', ')} with Room '${other.id}'; shared-boundary Room duplicate is unsupported`,
				[roomId, other.id, ...shared]
			);
		}
	}

	// Gate 2: the subgraph must own every Wall incident to its Junctions.
	const attachedOutsideWallIds = outsideIncidentWallIds(document, graph);
	if (attachedOutsideWallIds.length > 0) {
		return reject(
			'room_not_isolated',
			`Room '${roomId}' boundary junctions carry non-cloned wall(s) ${attachedOutsideWallIds.join(', ')}; the bounded subgraph is not isolated`,
			[roomId, ...attachedOutsideWallIds]
		);
	}

	// Gate 3: a hosted Opening portal relation references Rooms outside the
	// subgraph and cannot be remapped safely.
	const relationOpeningIds = externalPortalOpeningIds(graph.hostedOpenings, new Set([roomId]));
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
	const profileObjectIds = readOnlyProfileObjectIds(graph.associatedObjects);
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
			wallIds: graph.wallIds,
			junctionIds: graph.junctionIds,
			openingIds: graph.hostedOpenings.map((opening) => opening.id),
			associatedObjectIds: graph.associatedObjects.map((object) => object.id),
			profileObjectIds
		}
	};
}

/**
 * Resolve the **connected Room group** containing `roomId` as one rigidly
 * movable unit (P23.6a amendment A).
 *
 * The group is the smallest set that can translate without detaching
 * architecture: members are joined through shared boundary Junctions, so an
 * interior shared Wall moves exactly once and the group's Rooms keep their
 * identity, boundaries and metadata.
 *
 * Rejections: an unknown Room (`unknown_room`), an unresolved boundary Wall
 * (`invalid_reference`), a stationary Wall attached to a group Junction — a
 * partition stub, or a Room outside the group for any reason
 * (`room_not_isolated`), a hosted Opening whose portal relation has an endpoint
 * outside the group (`external_portal_relation`), and a read-only profile
 * object associated with any member (`profile_object_read_only`).
 */
export function resolveIsolatedRoomGroupSubgraph(
	document: LayoutDocumentWallFirst,
	roomId: string
): IsolatedRoomGroupSubgraphResult {
	const anchor = document.rooms.find((candidate) => candidate.id === roomId);
	if (!anchor) {
		return reject('unknown_room', `Unknown room '${roomId}'`, [roomId]);
	}

	const memberIds = connectedRoomIds(document, roomId);
	const memberIdSet = new Set(memberIds);
	const memberRooms = memberIds
		.map((id) => document.rooms.find((room) => room.id === id))
		.filter((room): room is LayoutWallFirstRoom => room !== undefined);

	const collected = collectBoundaryGraph(document, memberRooms);
	if (collected.kind === 'rejected') return collected;
	const { graph } = collected;

	// Defensive invariant: by construction every Room sharing a group
	// boundary Wall shares its Junctions and is therefore already a member.
	// Kept explicit so a future connectivity change cannot silently start
	// detaching a Room's shared architecture.
	for (const other of document.rooms) {
		if (memberIdSet.has(other.id)) continue;
		const shared = other.boundary
			.map((ref) => ref.wallId)
			.filter((wallId) => graph.wallIdSet.has(wallId));
		if (shared.length > 0) {
			return reject(
				'room_not_isolated',
				`Room '${other.id}' shares Wall(s) ${shared.join(', ')} with the moving group; the group is not isolated`,
				[roomId, other.id, ...shared]
			);
		}
	}

	// The group must own every Wall incident to its Junctions: a partition
	// stub or any other stationary Wall reaching a group Junction would be
	// torn off by the move.
	const attachedOutsideWallIds = outsideIncidentWallIds(document, graph);
	if (attachedOutsideWallIds.length > 0) {
		return reject(
			'room_not_isolated',
			`Room group (${memberIds.join(', ')}) touches stationary wall(s) ${attachedOutsideWallIds.join(', ')}; the group is not isolated`,
			[roomId, ...attachedOutsideWallIds]
		);
	}

	// A portal relation is preserved only when both endpoints move with the
	// group; a relation leaving the group cannot be remapped safely.
	const relationOpeningIds = externalPortalOpeningIds(graph.hostedOpenings, memberIdSet);
	if (relationOpeningIds.length > 0) {
		return reject(
			'external_portal_relation',
			`Room group (${memberIds.join(', ')}) opening(s) ${relationOpeningIds.join(', ')} carry portal relations outside the group; resolve or remove them before moving`,
			[roomId, ...relationOpeningIds]
		);
	}

	const profileObjectIds = readOnlyProfileObjectIds(graph.associatedObjects);
	if (profileObjectIds.length > 0) {
		return reject(
			'profile_object_read_only',
			`Room group (${memberIds.join(', ')}) contains read-only profile object(s) ${profileObjectIds.join(', ')}; resolve or remove them before duplicating or moving`,
			[roomId, ...profileObjectIds]
		);
	}

	return {
		kind: 'success',
		subgraph: {
			roomIds: memberIds,
			wallIds: graph.wallIds,
			junctionIds: graph.junctionIds,
			openingIds: graph.hostedOpenings.map((opening) => opening.id),
			associatedObjectIds: graph.associatedObjects.map((object) => object.id),
			profileObjectIds
		}
	};
}
