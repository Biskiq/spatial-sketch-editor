import { resolveIsolatedRoomGroupSubgraph } from '../isolation';
import { certifyRoundRoom } from '../round-room';
import type { LayoutDocumentWallFirst } from '../../wall/types';
import type { LayoutVec2 } from '../../geometry/coordinates';
import { roomUnitMoveCandidate, rotateRoomUnitMoveCandidate } from './candidate';
import type { RoomMovePlan } from './contracts';
import { finalizeRoomUnitMotion } from './finalize';
import { reject } from './shared';

/**
 * The Room move scope: the complete attached physical component, including a
 * dangling or branched attachment. The planner gates it on the Room stating
 * Round, so an ordinary Room keeps the existing group isolation policy. The
 * editor's drag preflight reads this same constant, so what the preview shows
 * and what the accepted plan moves cannot disagree.
 */
export const ROOM_MOVE_SCOPE = { includePhysicalAttachments: true } as const;

/**
 * Plan one rigid X/Z move of a wall-first Room. Rejects with the existing
 * canonical gates' reasons — never a bespoke Room-move rule set.
 */
export function planWallFirstRoomMove(
	document: LayoutDocumentWallFirst,
	roomId: string,
	delta: LayoutVec2,
): RoomMovePlan {
	const [dx, dz] = delta;
	if (!Number.isFinite(dx) || !Number.isFinite(dz)) {
		return reject('invalid_value', 'Room move delta must be finite', [roomId]);
	}
	if (dx === 0 && dz === 0) {
		return reject('no_op', 'Room move delta must be non-zero', [roomId]);
	}
	if (!document.rooms.some((room) => room.id === roomId)) {
		return reject('unknown_room', `Unknown room '${roomId}'`, [roomId]);
	}

	// Round translation carries the complete attached physical component;
	// ordinary Rooms retain the existing group isolation policy.
	const isolation = resolveIsolatedRoomGroupSubgraph(document, roomId, ROOM_MOVE_SCOPE);
	if (isolation.kind === 'rejected') {
		return reject(
			isolation.rejection.code,
			isolation.rejection.message,
			isolation.rejection.targetIds,
		);
	}
	const { subgraph } = isolation;

	// --- candidate: translate boundary Junctions + associated objects only ---
	const candidate = roomUnitMoveCandidate(document, subgraph, delta);

	// A shared Junction was reconstructed by more than one Round owner. The
	// deterministic choice must satisfy every owner's existing C1/C2 numerical
	// certificate before reconciliation can install anything. This is deliberately
	// a validation, not a solver: if the chosen reconstruction is not jointly
	// certifiable, reject the entire motion rather than picking the last owner.
	const wallById = new Map(document.walls.map((wall) => [wall.id, wall]));
	const ownersByJunction = new Map<string, string[]>();
	const movedWallIds = new Set(subgraph.wallIds);
	for (const room of document.rooms) {
		if (!room.round || !room.boundary.every((ref) => movedWallIds.has(ref.wallId))) continue;
		const junctions = new Set<string>();
		for (const ref of room.boundary) {
			const wall = wallById.get(ref.wallId);
			if (wall) {
				junctions.add(wall.startJunctionId);
				junctions.add(wall.endJunctionId);
			}
		}
		for (const id of junctions) {
			const owners = ownersByJunction.get(id) ?? [];
			owners.push(room.id);
			ownersByJunction.set(id, owners);
		}
	}
	const shared = document.rooms.find((room) => room.id === roomId)?.round
		? [...ownersByJunction].filter(([, owners]) => owners.length > 1)
		: [];
	const sharedOwners = new Set(shared.flatMap(([, owners]) => owners));
	for (const room of [...candidate.rooms]
		.filter((entry) => sharedOwners.has(entry.id))
		.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))) {
		const certification = certifyRoundRoom(candidate, room);
		if (certification.kind === 'invalid') {
			const junctionIds = shared
				.filter(([, owners]) => owners.includes(room.id))
				.map(([id]) => id)
				.sort();
			return reject(
				'invalid_candidate_document',
				`Chosen shared Round Junction reconstruction cannot be certified for Room '${room.id}': ${certification.issue.message}`,
				[room.id, ...junctionIds],
				[certification.issue],
			);
		}
	}

	return finalizeRoomUnitMotion(document, roomId, subgraph, candidate, 'room-move');
}

/**
 * Plan one rigid rotation of a wall-first Room unit about `pivot`.
 *
 * THIS IS THE RELEASE RE-DERIVE the transient rotation preview needs: the same
 * isolation policy, the same candidate mapping (`rotateRoomUnitMoveCandidate`)
 * and the same canonical gates as the translation above, called once at the
 * release angle against the frozen baseline. Nothing about what commits is
 * invented here — a rotation resolves exactly as a translation does, with the
 * moving set rigidly rotated instead of translated.
 *
 * `yaw` is radians, counter-clockwise in the document X/Z plane (`atan2`
 * convention, matching the shipped rotation gesture). A zero angle is `no_op`,
 * like a zero translation.
 */
export function planWallFirstRoomRotation(
	document: LayoutDocumentWallFirst,
	roomId: string,
	pivot: LayoutVec2,
	yaw: number,
): RoomMovePlan {
	if (!Number.isFinite(pivot[0]) || !Number.isFinite(pivot[1]) || !Number.isFinite(yaw)) {
		return reject('invalid_value', 'Room rotation pivot and angle must be finite', [roomId]);
	}
	if (yaw === 0) {
		return reject('no_op', 'Room rotation must be non-zero', [roomId]);
	}
	if (!document.rooms.some((room) => room.id === roomId)) {
		return reject('unknown_room', `Unknown room '${roomId}'`, [roomId]);
	}

	// Shared isolation policy in its group scope: the rotatable unit is
	// the connected Room group containing this Room, exactly as for translation.
	const isolation = resolveIsolatedRoomGroupSubgraph(document, roomId);
	if (isolation.kind === 'rejected') {
		return reject(
			isolation.rejection.code,
			isolation.rejection.message,
			isolation.rejection.targetIds,
		);
	}
	const { subgraph } = isolation;

	return finalizeRoomUnitMotion(
		document,
		roomId,
		subgraph,
		rotateRoomUnitMoveCandidate(document, subgraph, pivot, yaw),
		'room-rotate',
	);
}
