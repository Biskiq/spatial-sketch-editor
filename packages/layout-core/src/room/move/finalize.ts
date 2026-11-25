import { registerCowDocumentDelta } from '../../world/cow';
import { extractBoundaryCandidateFaces } from '../../geometry/face-extraction';
import { activeLayoutCompileSession } from '../../geometry/session';
import { compileWallFirstLayoutGeometry } from '../../geometry/compiler';
import { hasBlockingLayoutIssues } from '../../geometry/validation';
import { validateWallFirstOpeningSet } from '../../wall/opening-set';
import { validateWallFirstPortalRelations } from '../../wall/portals';
import { reconcileRooms } from '../reconciliation';
import type { ComponentLineage } from '../reconciliation-types';
import { validateWallFirstLayoutDocument } from '../../wall/codec';
import { validateWallFirstTopology } from '../../topology/wall-first';
import type { LayoutDocumentWallFirst } from '../../wall/types';
import type { RoomUnitMoveSubgraph } from './candidate';
import type { RoomMovePlan, RoomMoveRejectionCode } from './contracts';
import { guardedAllocator, isReconciliationFailure, reject, roomBoundaryCycleKey } from './shared';

/**
 * THE SHARED MOTION PIPELINE. Both rigid Room-unit motions — translation and
 * rotation — build their candidate from the same moving set and then run through
 * THIS function, so correspondence, global identity preservation and the
 * canonical gates cannot be told apart by which motion was asked for. A rotation
 * is the same operation with a different candidate; that is the whole of the
 * difference, and a copy here would be a second rule set.
 *
 * The baseline is never mutated, and exactly one candidate document (or one
 * rejection) comes back.
 */
export function finalizeRoomUnitMotion(
	document: LayoutDocumentWallFirst,
	roomId: string,
	/**
	 * The resolved moving set. `roomIds` is required here (the isolation policy
	 * always returns it) because the committed plan reports which Rooms travelled.
	 */
	subgraph: RoomUnitMoveSubgraph & { roomIds: readonly string[] },
	candidateDocument: LayoutDocumentWallFirst,
	operation: 'room-move' | 'room-rotate'
): RoomMovePlan {
	// Wall records carry no moved field, so every authored `height`
	// survives verbatim and no Floor-level quantity is ever consulted.

	// --- explicit boundary-lineage correspondence ---------------------
	// A rigid motion with unchanged wall IDs and directions leaves the canonical
	// boundary-cycle key invariant, so correspondence is exact key equality over
	// every predecessor Room — no overlap ground truth, so arbitrarily long moves
	// resolve identically. That the key is DIRECTION-only is what makes it hold for
	// a rotation too: a rotation is orientation-preserving, so no Wall flips.
	const extraction = extractBoundaryCandidateFaces(candidateDocument as LayoutDocumentWallFirst);
	// An open Space has no candidate face to claim; it is carried through the
	// move and asserted separately below.
	const components: ComponentLineage[] = document.rooms
		.filter((room) => room.virtualEdges.length === 0)
		.map((room) => ({
			candidateFaceKeys: [roomBoundaryCycleKey(document, room)],
			predecessorRoomIds: [room.id]
		}));
	const attemptedAllocation = { value: false };
	const reconciliation = reconcileRooms({
		baseline: document,
		candidateDocument,
		extraction,
		components,
		// A rigid move preserves every existing Space.
		candidateRooms: candidateDocument.rooms,
		allocator: guardedAllocator(attemptedAllocation)
	});
	// `RoomReconciliation` has no `kind`, so narrow through an explicit
	// predicate rather than a discriminated-union switch (P23.8 result shape).
	if (isReconciliationFailure(reconciliation)) {
		const { rejection } = reconciliation;
		if (rejection.code === 'ambiguous_room_correspondence') {
			return reject(
				'ambiguous_room_correspondence',
				rejection.message,
				rejection.roomIds
			);
		}
		if (rejection.code === 'unresolved_portal_remap') {
			return reject('portal_relation_invalid', rejection.message, rejection.roomIds);
		}
		return reject('room_identity_lost', rejection.message, rejection.roomIds);
	}

	// --- global identity preservation, asserted ------------------------
	const identityIssue = assertRoomIdentityPreserved(document, reconciliation, {
		roomId,
		allocationAttempted: attemptedAllocation.value
	});
	if (identityIssue) {
		return reject(identityIssue.code, identityIssue.message, identityIssue.targetIds);
	}

	const reconciled = reconciliation.document;

	// --- canonical gates ----------------------------------------------
	const structural = validateWallFirstLayoutDocument(reconciled);
	if (!structural.success) {
		return reject(
			'invalid_candidate_document',
			`Candidate failed wall-first validation: ${structural.issues[0]?.message ?? 'unknown issue'}`,
			undefined,
			structural.issues
		);
	}
	const topologyIssue = validateWallFirstTopology(structural.document, {
		openingSet: 'defer', closedContactWallIds: new Set(subgraph.wallIds)
	});
	if (topologyIssue) {
		// A rigid translation changes no Opening metric and no Wall height, so
		// an Opening-fit failure here means an unrelated invariant broke; it
		// keeps its canonical Opening-set code rather than a move-specific one.
		return reject(
			topologyIssue.code === 'wall_height_below_opening'
				? 'opening_set_invalid'
				: 'topology_invalid',
			topologyIssue.message,
			topologyIssue.targetId ? [topologyIssue.targetId] : undefined,
			[topologyIssue]
		);
	}
	const setIssues = validateWallFirstOpeningSet(structural.document);
	if (setIssues.length > 0) {
		const first = setIssues[0]!;
		return reject(
			first.code === 'opening_exceeds_wall_height' ? 'opening_set_invalid' : 'topology_invalid',
			first.message,
			[first.openingId, first.wallId],
			setIssues
		);
	}
	const relationIssues = validateWallFirstPortalRelations(structural.document);
	if (relationIssues.length > 0) {
		const first = relationIssues[0]!;
		return reject('portal_relation_invalid', first.message, [first.openingId], relationIssues);
	}
	const accepted = structural.document;
	const sameRoomRecords = accepted.rooms.length === document.rooms.length && accepted.rooms.every(
		(room, index) => JSON.stringify(room) === JSON.stringify(document.rooms[index])
	);
	if (sameRoomRecords) {
		registerCowDocumentDelta(accepted, {
			baseline: document,
			changedJunctionIds: subgraph.junctionIds,
			changedWallIds: subgraph.wallIds,
			changedOpeningIds: [],
			changedRoomIds: [],
			changedObjectIds: subgraph.associatedObjectIds ?? []
		});
	}
	const session = activeLayoutCompileSession();
	const compiled = session ? session.compile(accepted) : compileWallFirstLayoutGeometry(accepted);
	if (hasBlockingLayoutIssues(compiled.issues)) {
		return reject(
			'candidate_does_not_compile',
			`Candidate document does not compile: ${compiled.issues[0]?.message ?? 'unknown geometry issue'}`,
			undefined,
			compiled.issues
		);
	}

	return {
		kind: 'success',
		document: structural.document,
		operation,
		movedRoomId: roomId,
		movedRoomIds: [...subgraph.roomIds],
		changedJunctionIds: [...subgraph.junctionIds],
		changedWallIds: [...subgraph.wallIds],
		changedObjectIds: [...(subgraph.associatedObjectIds ?? [])]
	};
}


/**
 * Prove the move preserved **global** Room identity: every predecessor Room
 * survives with the same ID and an identical boundary-cycle key, no Room was
 * born, retired, split or merged, and reconciliation never reached an
 * allocating branch.
 */
function assertRoomIdentityPreserved(
	baseline: LayoutDocumentWallFirst,
	reconciliation: {
		document: LayoutDocumentWallFirst;
		lineage: readonly {
			faceKey: string;
			roomId: string;
			predecessorRoomIds: readonly string[];
			kind: 'preserved' | 'split-survivor' | 'merge-survivor' | 'created';
		}[];
		retiredRoomIds: readonly string[];
		carriedRoomIds: readonly string[];
		spaceRetirements: readonly { roomId: string }[];
	},
	options: { roomId: string; allocationAttempted: boolean }
): { code: RoomMoveRejectionCode; message: string; targetIds?: readonly string[] } | null {
	if (options.allocationAttempted) {
		return {
			code: 'room_identity_lost',
			message: 'Room move reached a Room allocation branch; a rigid move preserves identity',
			targetIds: [options.roomId]
		};
	}
	if (reconciliation.retiredRoomIds.length > 0) {
		return {
			code: 'room_identity_lost',
			message: `Room move retired Room(s) ${reconciliation.retiredRoomIds.join(', ')}`,
			targetIds: [...reconciliation.retiredRoomIds]
		};
	}
	const carriedRoomIds = new Set(reconciliation.carriedRoomIds);
	if (reconciliation.lineage.length + carriedRoomIds.size !== baseline.rooms.length) {
		return {
			code: 'room_identity_lost',
			message: `Room move produced ${reconciliation.lineage.length} lineage record(s) and ${carriedRoomIds.size} carried Space(s) for ${baseline.rooms.length} Room(s)`,
			targetIds: [options.roomId]
		};
	}
	for (const room of baseline.rooms) {
		if (room.virtualEdges.length > 0 && !carriedRoomIds.has(room.id)) {
			return {
				code: 'room_identity_lost',
				message: `Open Space '${room.id}' was not carried by the move`,
				targetIds: [room.id]
			};
		}
	}
	const finalByRoomId = new Map(reconciliation.document.rooms.map((room) => [room.id, room]));
	for (const record of reconciliation.lineage) {
		if (record.kind !== 'preserved' || record.predecessorRoomIds.length !== 1) {
			return {
				code: 'room_identity_lost',
				message: `Room move produced a '${record.kind}' lineage record for Room '${record.roomId}'`,
				targetIds: [record.roomId]
			};
		}
	}
	for (const room of baseline.rooms) {
		const finalRoom = finalByRoomId.get(room.id);
		if (!finalRoom) {
			return {
				code: 'room_identity_lost',
				message: `Room '${room.id}' did not survive the move`,
				targetIds: [room.id]
			};
		}
		const expectedKey = roomBoundaryCycleKey(baseline, room);
		const actualKey = roomBoundaryCycleKey(reconciliation.document, finalRoom);
		if (expectedKey !== actualKey) {
			return {
				code: 'room_identity_lost',
				message: `Room '${room.id}' boundary lineage changed during the move`,
				targetIds: [room.id]
			};
		}
		if (finalRoom.name !== room.name) {
			return {
				code: 'room_identity_lost',
				message: `Room '${room.id}' name changed during the move`,
				targetIds: [room.id]
			};
		}
	}
	if (reconciliation.document.rooms.length !== baseline.rooms.length) {
		return {
			code: 'room_identity_lost',
			message: `Room count changed during the move (${baseline.rooms.length} → ${reconciliation.document.rooms.length})`,
			targetIds: [options.roomId]
		};
	}
	return null;
}
