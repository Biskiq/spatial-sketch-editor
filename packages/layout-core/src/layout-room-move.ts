/**
 * `layout-room-move.ts` — P23.6a: rigid whole-Room translation for wall-first
 * Layout documents ([P23.6a plan](../../../../docs/plans/2026-09-12-P23.6a-wall-first-room-unit-move.md)).
 *
 * In wall-first Layout a Room is persistent semantic identity reconciled from
 * topology, not an authored polygon, so a whole-Room move translates the
 * Room's canonical boundary **Junctions** and lets the existing reconciliation
 * engine re-derive the committed Room:
 *
 * ```text
 * validate intent
 * → resolve persisted Room
 * → shared isolated-subgraph policy (P23.6a S1)
 * → clone candidate; translate boundary Junctions + associated objects
 * → exact boundary-lineage correspondence (key equality, no geometry)
 * → reconcileRooms() (existing engine, 1→1 branch only)
 * → assert global identity preservation
 * → canonical validation gates (codec → topology → opening set → portals → compile)
 * → exactly one candidate document (or a rejection; the caller keeps history)
 * ```
 *
 * Guarantees (P23.6a D3/D4/D5/D7):
 * - Wall `id`/`role`/`thickness`/`height`, Opening identity and semantics,
 *   Room identity and metadata are preserved exactly — only Junction points and
 *   explicitly associated object X/Z change;
 * - `object.roomId === movedRoomId` non-profile objects follow by the same
 *   delta; no other object moves and containment never decides;
 * - zero Room births/retirements/splits/merges, asserted (not assumed);
 * - the input document is never mutated, and no face key or Room position is
 *   ever persisted.
 *
 * Pure and deterministic: no timestamps, no randomness, no traversal-order
 * dependence, no allocation.
 */
import type { LayoutDocumentIssue } from './layout-codec';
import { canonicalBoundaryCycleKey, extractBoundaryCandidateFaces } from './layout-face-extraction';
import { compileWallFirstLayoutGeometry } from './layout-geometry';
import type { LayoutGeometryIssue } from './layout-geometry-types';
import { hasBlockingLayoutIssues } from './layout-geometry-validation';
import { validateWallFirstOpeningSet, type OpeningSetIssue } from './layout-opening-set';
import { validateWallFirstPortalRelations } from './layout-portals';
import { resolveIsolatedRoomSubgraph } from './layout-room-isolation';
import {
	reconcileRooms,
	type ComponentLineage,
	type ReconciliationFailure,
	type ReconciliationResult,
	type RoomIdAllocator
} from './layout-room-reconciliation';
import { validateWallFirstLayoutDocument } from './layout-wall-first-codec';
import { validateWallFirstTopology } from './layout-wall-first-precision';
import type { LayoutDocumentWallFirst, LayoutWallFirstRoom } from './layout-wall-first-types';
import type { LayoutVec2 } from './layout-types';

/** Why a wall-first Room move rejected; stable machine codes. */
export type RoomMoveRejectionCode =
	| 'unknown_room'
	| 'invalid_value'
	| 'no_op'
	| 'invalid_reference'
	| 'room_not_isolated'
	| 'external_portal_relation'
	| 'profile_object_read_only'
	| 'room_identity_lost'
	| 'ambiguous_room_correspondence'
	| 'topology_invalid'
	| 'opening_set_invalid'
	| 'portal_relation_invalid'
	| 'invalid_candidate_document'
	| 'candidate_does_not_compile';

export type RoomMoveRejection = {
	code: RoomMoveRejectionCode;
	message: string;
	/** Involved authored IDs where available. */
	targetIds?: readonly string[];
	/** Canonical-gate issues, when validation rejected the candidate. */
	issues?: readonly (LayoutDocumentIssue | LayoutGeometryIssue | OpeningSetIssue)[];
};

export type RoomMovePlan =
	| {
			kind: 'success';
			/** Exact committed document — same IDs, moved Junction points. */
			document: LayoutDocumentWallFirst;
			operation: 'room-move';
			movedRoomId: string;
			/** Boundary Junctions translated by the delta, deterministic order. */
			changedJunctionIds: readonly string[];
			/** Boundary Walls that moved (their Junctions moved; fields did not). */
			changedWallIds: readonly string[];
			/** Explicitly associated objects translated by the delta. */
			changedObjectIds: readonly string[];
	  }
	| { kind: 'rejected'; rejection: RoomMoveRejection };

/** P23.8 result narrowing: `RoomReconciliation` carries no `kind` discriminant. */
function isReconciliationFailure(
	result: ReconciliationResult
): result is ReconciliationFailure {
	return 'kind' in result && result.kind === 'rejected';
}

function reject(
	code: RoomMoveRejectionCode,
	message: string,
	targetIds?: readonly string[],
	issues?: readonly (LayoutDocumentIssue | LayoutGeometryIssue | OpeningSetIssue)[]
): RoomMovePlan {
	return {
		kind: 'rejected',
		rejection: { code, message, ...(targetIds ? { targetIds } : {}), ...(issues ? { issues } : {}) }
	};
}

/** Boundary-cycle key of a persisted Room (its canonical `boundary` cycle). */
export function roomBoundaryCycleKey(room: Pick<LayoutWallFirstRoom, 'boundary'>): string {
	return canonicalBoundaryCycleKey(room.boundary);
}

/**
 * An allocator that must never be reached: a rigid move preserves global Room
 * identity, so a reconciliation branch that allocates a Room ID/name is proof
 * that the operation is not a move. It records the attempt instead of throwing
 * so the planner can reject through its ordinary result contract.
 */
function guardedAllocator(attempted: { value: boolean }): RoomIdAllocator {
	return {
		nextRoomId(_document, faceKey) {
			attempted.value = true;
			return `unreachable-room-move.${faceKey}`;
		},
		nextRoomName() {
			attempted.value = true;
			return 'Unreachable Room Move';
		}
	};
}

/**
 * Plan one rigid X/Z move of a wall-first Room. Rejects with the existing
 * canonical gates' reasons — never a bespoke Room-move rule set.
 */
export function planWallFirstRoomMove(
	document: LayoutDocumentWallFirst,
	roomId: string,
	delta: LayoutVec2
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

	// Shared isolation policy (P23.6a S1) — identical to the duplicate path.
	const isolation = resolveIsolatedRoomSubgraph(document, roomId);
	if (isolation.kind === 'rejected') {
		return reject(
			isolation.rejection.code,
			isolation.rejection.message,
			isolation.rejection.targetIds
		);
	}
	const { subgraph } = isolation;

	// --- candidate: translate boundary Junctions + associated objects only ---
	const movedJunctionIds = new Set(subgraph.junctionIds);
	const movedWallIds = new Set(subgraph.wallIds);
	const associatedObjectIds = new Set(subgraph.associatedObjectIds);
	const candidateDocument = {
		...document,
		junctions: document.junctions.map((junction) =>
			movedJunctionIds.has(junction.id)
				? {
						...junction,
						point: [junction.point[0] + dx, junction.point[1] + dz] as LayoutVec2
					}
				: junction
		),
		objects: document.objects.map((object) =>
			associatedObjectIds.has(object.id)
				? {
						...object,
						position: [
							object.position[0] + dx,
							object.position[1],
							object.position[2] + dz
						] as typeof object.position
					}
				: object
		)
	};
	// P23.6H/P23.6I — Wall records are untouched, so every authored `height`
	// survives verbatim and no Floor-level quantity is ever consulted.

	// --- explicit boundary-lineage correspondence (D6) ---------------------
	// A pure translation with unchanged wall IDs and directions leaves the
	// canonical boundary-cycle key invariant, so correspondence is exact key
	// equality over every predecessor Room — no overlap ground truth, so
	// arbitrarily long moves resolve identically.
	const extraction = extractBoundaryCandidateFaces(candidateDocument as LayoutDocumentWallFirst);
	const components: ComponentLineage[] = document.rooms.map((room) => ({
		candidateFaceKeys: [roomBoundaryCycleKey(room)],
		predecessorRoomIds: [room.id]
	}));
	const attemptedAllocation = { value: false };
	const reconciliation = reconcileRooms({
		baseline: document,
		candidateDocument,
		extraction,
		components,
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

	// --- global identity preservation, asserted (D7) ------------------------
	const identityIssue = assertRoomIdentityPreserved(document, reconciliation, {
		roomId,
		allocationAttempted: attemptedAllocation.value
	});
	if (identityIssue) {
		return reject(identityIssue.code, identityIssue.message, identityIssue.targetIds);
	}

	const reconciled = reconciliation.document;

	// --- canonical gates (D9) ----------------------------------------------
	const structural = validateWallFirstLayoutDocument(reconciled);
	if (!structural.success) {
		return reject(
			'invalid_candidate_document',
			`Candidate failed wall-first validation: ${structural.issues[0]?.message ?? 'unknown issue'}`,
			undefined,
			structural.issues
		);
	}
	const topologyIssue = validateWallFirstTopology(structural.document);
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
			'opening_set_invalid',
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
	const compiled = compileWallFirstLayoutGeometry(structural.document);
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
		operation: 'room-move',
		movedRoomId: roomId,
		changedJunctionIds: [...subgraph.junctionIds],
		changedWallIds: [...movedWallIds],
		changedObjectIds: [...subgraph.associatedObjectIds]
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
	if (reconciliation.lineage.length !== baseline.rooms.length) {
		return {
			code: 'room_identity_lost',
			message: `Room move produced ${reconciliation.lineage.length} lineage record(s) for ${baseline.rooms.length} Room(s)`,
			targetIds: [options.roomId]
		};
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
		const expectedKey = roomBoundaryCycleKey(room);
		const actualKey = roomBoundaryCycleKey(finalRoom);
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
