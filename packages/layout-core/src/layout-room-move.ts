/**
 * `layout-room-move.ts` — P23.6a: rigid Room-unit translation for wall-first
 * Layout documents ([P23.6a plan](../../../../docs/roadmap/p23-layout-depth/2026-09-12-P23.6a-wall-first-room-unit-move.md)).
 *
 * In wall-first Layout a Room is persistent semantic identity reconciled from
 * topology, not an authored polygon, so a whole-Room move translates canonical
 * boundary **Junctions** and lets the existing reconciliation engine re-derive
 * the committed Rooms:
 *
 * ```text
 * validate intent
 * → resolve persisted Room
 * → shared isolation policy: the CONNECTED ROOM GROUP that contains it (A)
 * → clone candidate; translate group Junctions + associated objects
 * → exact boundary-lineage correspondence (key equality, no geometry)
 * → reconcileRooms() (existing engine, 1→1 branches only)
 * → assert global identity preservation
 * → canonical validation gates (codec → topology → opening set → portals → compile)
 * → exactly one candidate document (or a rejection; the caller keeps history)
 * ```
 *
 * **Amendment A (connected group).** The movable unit is the connected Room
 * group, not a lone Room: Rooms joined through shared boundary Junctions cannot
 * be separated without detaching architecture, so dragging any member moves the
 * whole group rigidly while the shared interior Walls travel exactly once. A
 * Room with no shared boundary Junctions is a group of one — the original
 * P23.6a behaviour, discovered rather than special-cased.
 *
 * Guarantees (P23.6a D3/D4/D5/D7):
 * - Wall `id`/`role`/`thickness`/`height`, Opening identity and semantics,
 *   Room identity and metadata are preserved exactly — only Junction points and
 *   explicitly associated object X/Z change;
 * - non-profile objects explicitly associated with any Room in `movedRoomIds`
 *   follow by the same delta; no other object moves and containment never decides;
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
import { resolveIsolatedRoomGroupSubgraph } from './layout-room-isolation';
import {
	reconcileRooms,
	type ComponentLineage,
	type ReconciliationFailure,
	type ReconciliationResult,
	type RoomIdAllocator
} from './layout-room-reconciliation';
import { validateWallFirstLayoutDocument } from './layout-wall-first-codec';
import { validateWallFirstTopology } from './layout-wall-first-precision';
import { translateWallCenterline, wallCenterlineSamples } from './layout-wall-centerline';
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
			/**
			 * Which rigid motion produced it. A rotation is the same operation with a
			 * different candidate: identical correspondence, identity and gate rules.
			 */
			operation: 'room-move' | 'room-rotate';
			/** The dragged (anchor) Room — always a member of `movedRoomIds`. */
			movedRoomId: string;
			/**
			 * Every Room moved as one rigid unit: the connected group containing the
			 * anchor, anchor first then document order. A lone Room is a group of one.
			 */
			movedRoomIds: readonly string[];
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
 * The moving set one rigid Room-unit gesture transforms, as its boundary graph:
 * the connected Room group the shared isolation policy resolved at pointer-down.
 */
export type RoomUnitMoveSubgraph = {
	wallIds: readonly string[];
	junctionIds: readonly string[];
	associatedObjectIds?: readonly string[];
};

/** One moved Wall's overlay attempt: its canonical centerline, already transformed. */
export type RoomUnitMoveProposalWall = {
	wallId: string;
	/** Sampled centerline points in document X/Z. Overlay truth only. */
	points: LayoutVec2[];
};

/**
 * The **single** moving-set→candidate mapping shared by the release planner and
 * the live preview proposal below, so neither can describe geometry the other
 * does not have — the same rule the P23.11 architecture proposal follows.
 *
 * Translates the group's boundary Junctions, the centerlines of the group's
 * Walls, and the explicitly associated objects. Nothing is validated and nothing
 * is written back: the caller keeps the canonical baseline installed.
 */
export function roomUnitMoveCandidate(
	document: LayoutDocumentWallFirst,
	subgraph: RoomUnitMoveSubgraph,
	delta: LayoutVec2
): LayoutDocumentWallFirst {
	const [dx, dz] = delta;
	const movedJunctionIds = new Set(subgraph.junctionIds);
	const movedWallIds = new Set(subgraph.wallIds);
	const associatedObjectIds = new Set(subgraph.associatedObjectIds ?? []);
	return {
		...document,
		junctions: document.junctions.map((junction) =>
			movedJunctionIds.has(junction.id)
				? {
						...junction,
						point: [junction.point[0] + dx, junction.point[1] + dz] as LayoutVec2
					}
				: junction
		),
		// P23.11 — a moved Wall's curve anchors are absolute document X/Z, so
		// they translate with the same delta as its Junctions. Anchors left
		// behind would not preserve the moved shape: the curve would swing back
		// toward the baseline position and can cross a Wall outside the move
		// group. Flat `line` centerlines carry no absolute data and are shared.
		walls: document.walls.map((wall) =>
			movedWallIds.has(wall.id)
				? { ...wall, centerline: translateWallCenterline(wall.centerline, [dx, dz]) }
				: wall
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
}

/**
 * Derive the live preview of a rigid Room-unit **translation**, without
 * validating or installing a candidate document.
 *
 * Runs the planner's own moving-set→candidate mapping and samples each moved
 * Wall through the one canonical centerline sampler, so the drawn attempt IS the
 * release planner's geometry rather than a second description of it. A rigid
 * translation is shown by moving the canonical points, never by re-deriving a
 * sampling density, so the drawn curve cannot sit fractionally off the committed
 * one. `undefined` results inside the sampler are skipped exactly as the
 * architecture proposal skips them; an empty array is a truthful "nothing to
 * draw", never a rejection.
 */
export function proposeWallFirstRoomUnitGeometry(
	document: LayoutDocumentWallFirst,
	subgraph: RoomUnitMoveSubgraph,
	delta: LayoutVec2
): RoomUnitMoveProposalWall[] {
	return sampleMovedWallProposals(
		roomUnitMoveCandidate(document, subgraph, delta),
		subgraph.wallIds
	);
}

/**
 * The **rotation** partner of the candidate above: the same moving set rigidly
 * rotated about `pivot`.
 *
 * WIRED on the owner's direction (pre-P23B.8 follow-up, 2026-09-28), which
 * reversed P23.14 Decision 7 — the reason that decision gave was that a
 * canonical Room has no authored yaw so "a rotation gesture has no honest result
 * to commit", and the honest result is now this candidate, committed by
 * `planWallFirstRoomRotation` exactly as a translation is committed by
 * `planWallFirstRoomMove`. The release re-derives at the release angle against
 * the frozen baseline, so the transient attempt the Plan drag draws is this same
 * mapping (see `proposeWallFirstRoomUnitRotation` below).
 *
 * ONE CAVEAT, recorded rather than hidden: a Wall's canonical sampling density
 * is NOT rotation-invariant, so `samples(rotated)` and `rotate(samples)` do not
 * agree on their sample count. A rotation therefore cannot be drawn by moving
 * the baseline's canonical points, the way a translation is; it is drawn by
 * RESAMPLING the rotated centerline through the same sampler the release uses.
 * That makes the drawn attempt the release's own geometry — stronger than the
 * translation path needs — but the attempt's ink density can differ by a sample
 * from the baseline's. It is a redraw difference, never a geometry difference.
 */
export function rotateRoomUnitMoveCandidate(
	document: LayoutDocumentWallFirst,
	subgraph: RoomUnitMoveSubgraph,
	pivot: LayoutVec2,
	yaw: number
): LayoutDocumentWallFirst {
	const rotate = (point: LayoutVec2): LayoutVec2 => rotatePointAbout(point, pivot, yaw);
	const movedJunctionIds = new Set(subgraph.junctionIds);
	const movedWallIds = new Set(subgraph.wallIds);
	const associatedObjectIds = new Set(subgraph.associatedObjectIds ?? []);
	return {
		...document,
		junctions: document.junctions.map((junction) =>
			movedJunctionIds.has(junction.id) ? { ...junction, point: rotate(junction.point) } : junction
		),
		// A rotation is rigid about the pivot, so a moved Wall's absolute curve
		// anchors rotate with its Junctions exactly as they translate with them.
		walls: document.walls.map((wall) =>
			movedWallIds.has(wall.id)
				? { ...wall, centerline: transformWallCenterline(wall.centerline, rotate) }
				: wall
		),
		// Associated objects follow the same rigid motion as the Walls: an object
		// left in place would keep its baseline X/Z and stop being associated with
		// the Room it travelled with. Its own yaw is NOT rotated here — that is the
		// object's authored orientation, not the Room unit's position.
		objects: document.objects.map((object) => {
			if (!associatedObjectIds.has(object.id)) return object;
			const [x, z] = rotate([object.position[0], object.position[2]]);
			return {
				...object,
				position: [x, object.position[1], z] as typeof object.position
			};
		})
	};
}

/** The overlay attempt for a rigid Room-unit **rotation**. See the candidate above. */
export function proposeWallFirstRoomUnitRotation(
	document: LayoutDocumentWallFirst,
	subgraph: RoomUnitMoveSubgraph,
	pivot: LayoutVec2,
	yaw: number
): RoomUnitMoveProposalWall[] {
	return sampleMovedWallProposals(
		rotateRoomUnitMoveCandidate(document, subgraph, pivot, yaw),
		subgraph.wallIds
	);
}

/**
 * Rigid rotation of one point about `pivot`, in DOCUMENT X/Z.
 *
 * THE HANDEDNESS IS THE SHIPPED ONE. Plan X/Z has +Z DOWN the screen, and the
 * gesture's `yaw` is `atan2(dz, dx)` of the pointer about the pivot — the same
 * angle the legacy Room transform receives. This uses that transform's own
 * convention (`layout-room-transform.ts`'s `transformRoom`) rather than the
 * mathematical inverse, so ONE rotation gesture turns a Room the same way in
 * both document kinds. Flipping it here would silently make the new wall-first
 * rotation feel mirrored against the legacy one it sits beside.
 *
 * Exported (not module-private) so the transient overlay draws its outlines
 * through this same function: one handedness decision, one definition.
 */
export function rotatePointAbout(point: LayoutVec2, pivot: LayoutVec2, yaw: number): LayoutVec2 {
	const cos = Math.cos(yaw);
	const sin = Math.sin(yaw);
	const x = point[0] - pivot[0];
	const z = point[1] - pivot[1];
	return [pivot[0] + x * cos + z * sin, pivot[1] - x * sin + z * cos];
}

/**
 * Rigid-motion copy of one canonical centerline: every bend point and every span
 * control moves through `transform`. The rotation partner of
 * `translateWallCenterline`; flat `line` centerlines carry no absolute data.
 */
function transformWallCenterline(
	centerline: LayoutDocumentWallFirst['walls'][number]['centerline'],
	transform: (point: LayoutVec2) => LayoutVec2
): LayoutDocumentWallFirst['walls'][number]['centerline'] {
	if (centerline.kind === 'line') return { kind: 'line' };
	return {
		kind: 'cubic-chain',
		knots: centerline.knots.map((knot) => ({ id: knot.id, point: transform(knot.point) })),
		spans: centerline.spans.map((span) => ({
			handleOut: transform(span.handleOut),
			handleIn: transform(span.handleIn)
		}))
	};
}

/** Sample every moved Wall of a candidate through the one canonical sampler. */
function sampleMovedWallProposals(
	candidate: LayoutDocumentWallFirst,
	wallIds: readonly string[]
): RoomUnitMoveProposalWall[] {
	const pointById = new Map(candidate.junctions.map((junction) => [junction.id, junction.point]));
	const proposals: RoomUnitMoveProposalWall[] = [];
	for (const wallId of wallIds) {
		const wall = candidate.walls.find((entry) => entry.id === wallId);
		if (!wall) continue;
		const start = pointById.get(wall.startJunctionId);
		const end = pointById.get(wall.endJunctionId);
		if (!start || !end) continue;
		const sampled = wallCenterlineSamples(wall, start, end, 'forward');
		if (!sampled) continue;
		proposals.push({
			wallId,
			points: sampled.samples.map((sample) => [sample.point[0], sample.point[1]] as LayoutVec2)
		});
	}
	return proposals;
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

	// Shared isolation policy (P23.6a S1) in its group scope (amendment A): the
	// movable unit is the connected Room group containing this Room.
	const isolation = resolveIsolatedRoomGroupSubgraph(document, roomId);
	if (isolation.kind === 'rejected') {
		return reject(
			isolation.rejection.code,
			isolation.rejection.message,
			isolation.rejection.targetIds
		);
	}
	const { subgraph } = isolation;

	// --- candidate: translate boundary Junctions + associated objects only ---
	return finalizeRoomUnitMotion(
		document,
		roomId,
		subgraph,
		roomUnitMoveCandidate(document, subgraph, delta),
		'room-move'
	);
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
	yaw: number
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

	// Shared isolation policy (P23.6a S1) in its group scope: the rotatable unit is
	// the connected Room group containing this Room, exactly as for translation.
	const isolation = resolveIsolatedRoomGroupSubgraph(document, roomId);
	if (isolation.kind === 'rejected') {
		return reject(
			isolation.rejection.code,
			isolation.rejection.message,
			isolation.rejection.targetIds
		);
	}
	const { subgraph } = isolation;

	return finalizeRoomUnitMotion(
		document,
		roomId,
		subgraph,
		rotateRoomUnitMoveCandidate(document, subgraph, pivot, yaw),
		'room-rotate'
	);
}

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
function finalizeRoomUnitMotion(
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
	// P23.6H/P23.6I — Wall records carry no moved field, so every authored `height`
	// survives verbatim and no Floor-level quantity is ever consulted.

	// --- explicit boundary-lineage correspondence (D6) ---------------------
	// A rigid motion with unchanged wall IDs and directions leaves the canonical
	// boundary-cycle key invariant, so correspondence is exact key equality over
	// every predecessor Room — no overlap ground truth, so arbitrarily long moves
	// resolve identically. That the key is DIRECTION-only is what makes it hold for
	// a rotation too: a rotation is orientation-preserving, so no Wall flips.
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
