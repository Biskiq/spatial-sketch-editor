import { layoutLength } from '../kernel/source-collections';
import {
	canonicalBoundaryCycleKey,
	extractBoundaryCandidateFaces,
} from '../geometry/face-extraction';
import { activeLayoutCompileSession } from '../geometry/session';
import { compileWallFirstLayoutGeometry } from '../geometry/compiler';
import { p2311Measure } from '../kernel/work-observer';
import { hasBlockingLayoutIssues } from '../geometry/validation';
import { LAYOUT_DIMENSION_LIMIT_MESSAGE } from '../geometry/limits';
import { serializeWallFirstLayoutDocument, validateWallFirstLayoutDocument } from '../wall/codec';
import { exceedsLayoutWallSpan } from '../world/lookups';
import { getCowDocumentDelta } from '../world/cow';
import { verifyScalarOrObjectDelta, verifySweptBoundsGeometryDelta } from '../world/verify';
import { validateWallFirstOpeningSet } from '../wall/opening-set';
import { validateWallFirstPortalRelations } from '../wall/portals';
import type {
	ComponentLineage,
	ReconciliationResult,
	RoomIdAllocator,
} from '../room/reconciliation-types';
import { reconcileRooms } from '../room/reconciliation';
import type { LayoutDocumentWallFirst } from '../wall/types';
import { createWallSamplingDerivation } from '../wall/centerline';
import type { PrecisionOperation, PrecisionPlan, PrecisionRejection } from './types';
import { validateWallFirstTopology } from '../topology/wall-first';
import { isReconciliationFailure, reject } from './rejections';

export function finalizeCandidate(
	candidate: LayoutDocumentWallFirst,
	operation: PrecisionOperation,
	changedJunctionIds: readonly string[],
	changedWallIds: readonly string[],
	changedObjectIds?: readonly string[],
	createdWallIds?: readonly string[],
): PrecisionPlan {
	const cowDelta = getCowDocumentDelta(candidate);
	if (
		cowDelta &&
		!createdWallIds?.length &&
		(operation === 'wall-thickness' ||
			operation === 'wall-height' ||
			operation === 'layout-object-preset-create' ||
			operation === 'layout-object-transform' ||
			operation === 'layout-object-delete')
	) {
		const verdict = verifyScalarOrObjectDelta({
			baseline: cowDelta.baseline,
			candidate,
			operation,
			changedWallIds,
			changedObjectIds: changedObjectIds ?? [],
		});
		if (verdict === 'certified-valid') {
			const compileSession = activeLayoutCompileSession();
			const compiled = compileSession
				? compileSession.compile(candidate)
				: compileWallFirstLayoutGeometry(candidate);
			if (hasBlockingLayoutIssues(compiled.issues)) {
				return reject(
					'geometry_invalid',
					compiled.issues[0]?.message ?? 'Candidate geometry does not compile',
					undefined,
					compiled.issues,
				);
			}
			return {
				kind: 'success',
				document: candidate,
				operation,
				changedJunctionIds: [...changedJunctionIds],
				changedWallIds: [...changedWallIds],
				...(changedObjectIds ? { changedObjectIds: [...changedObjectIds] } : {}),
			};
		}
	}

	const structural = validateWallFirstLayoutDocument(candidate);
	if (!structural.success) {
		return reject(
			'geometry_invalid',
			`Candidate failed wall-first validation: ${structural.issues[0]?.message ?? 'unknown issue'}`,
			undefined,
			structural.issues,
		);
	}
	const topologyIssue = validateWallFirstTopology(structural.document);
	if (topologyIssue) {
		// A Wall-vs-Opening vertical conflict keeps its own rejection
		// code; every other topology failure stays `topology_invalid`.
		const topologyCode: PrecisionRejection['code'] =
			topologyIssue.code === 'wall_height_below_opening'
				? 'wall_height_below_opening'
				: 'topology_invalid';
		return reject(
			topologyCode,
			topologyIssue.message,
			topologyIssue.targetId ? [topologyIssue.targetId] : undefined,
			[topologyIssue],
		);
	}
	// A candidate compiled during a session reuses every
	// entity its authored inputs did not move. The result is the canonical
	// compiler's own output (same builders, same assembly), so this is a cheaper
	// compile, not a different one.
	const compileSession = activeLayoutCompileSession();
	const compiled = compileSession
		? compileSession.compile(structural.document)
		: compileWallFirstLayoutGeometry(structural.document);
	if (hasBlockingLayoutIssues(compiled.issues)) {
		return reject(
			'geometry_invalid',
			compiled.issues[0]?.message ?? 'Candidate geometry does not compile',
			undefined,
			compiled.issues,
		);
	}
	return {
		kind: 'success',
		document: structural.document,
		operation,
		changedJunctionIds: [...changedJunctionIds],
		changedWallIds: [...new Set([...changedWallIds, ...(createdWallIds ?? [])])],
		...(changedObjectIds ? { changedObjectIds: [...changedObjectIds] } : {}),
	};
}

/**
 * The canonical **geometry-edit acceptance path**.
 *
 * Every operation that edits canonical Junction coordinates or subdivides a
 * Wall runs the same seam, so a pointer gesture and the Inspector's exact
 * fields can never reach acceptance by different routes:
 *
 * ```text
 * candidate (immutable baseline → cloned coordinate edit, or planWallSplit)
 *  → pre-reconciliation structural/topology gate (canonical rejection codes)
 *  → candidate faces (extractBoundaryCandidateFaces)
 *  → explicit 1→1 Room boundary-cycle lineage declared from authored IDs
 *  → reconcileRooms with an allocator that records — never grants — a birth
 *  → assert exact Room identity preservation (no birth/retire/split/merge)
 *  → wall-first codec → topology → Opening set → portal relations → compiler
 * ```
 *
 * Lineage is declared from the candidate document's own authored boundary
 * cycles, never from nearest-polygon geometry: a coordinate edit leaves every
 * cycle key invariant, and `planWallSplit` has already rewritten the split
 * Room's cycle to its successor fragments. Both therefore map 1→1 by key
 * equality, which is why arbitrarily large valid moves stay exact.
 *
 * The pre-reconciliation gate runs first so a malformed reference or an
 * invalid crossing/overlap keeps its canonical rejection instead of being
 * misreported as a correspondence failure. Metadata/object operations stay on
 * the generic `finalizeCandidate` path — Room reconciliation is never forced
 * onto an operation that cannot change topology.
 */
export function finalizeWallGeometryCandidate(options: {
	baseline: LayoutDocumentWallFirst;
	candidate: LayoutDocumentWallFirst;
	operation: PrecisionOperation;
	changedJunctionIds: readonly string[];
	changedWallIds: readonly string[];
	createdWallIds?: readonly string[];
}): PrecisionPlan {
	const { baseline, candidate, operation, changedJunctionIds, changedWallIds } = options;

	// One dimension gate for every geometry precision planner (length, junction
	// move, angle and rigid move). It runs before the acceptance compile, so an
	// oversized edit is refused without sampling, compiling or writing history.
	if (exceedsLayoutWallSpan(candidate, [...changedWallIds, ...(options.createdWallIds ?? [])])) {
		return reject('dimension_out_of_range', LAYOUT_DIMENSION_LIMIT_MESSAGE, [...changedWallIds]);
	}

	if (!options.createdWallIds?.length) {
		const cowDelta = getCowDocumentDelta(candidate);
		if (cowDelta && cowDelta.baseline === baseline) {
			const fastSampling = createWallSamplingDerivation();
			// The world index refuses self-connected Walls. Those baselines always
			// reach the canonical closed-contact gate below.
			const verdict = verifySweptBoundsGeometryDelta({
				baseline,
				candidate,
				changedJunctionIds,
				changedWallIds,
				sampling: fastSampling,
			});
			if (verdict === 'certified-valid') {
				const compileSession = activeLayoutCompileSession();
				const compiled = p2311Measure('acceptance-compile', () =>
					compileSession
						? compileSession.compile(candidate, fastSampling)
						: compileWallFirstLayoutGeometry(candidate, fastSampling),
				);
				if (hasBlockingLayoutIssues(compiled.issues)) {
					return reject(
						'geometry_invalid',
						compiled.issues[0]?.message ?? 'Candidate geometry does not compile',
						undefined,
						compiled.issues,
					);
				}
				let memoizedDocJson: string | undefined;
				return {
					kind: 'success',
					document: candidate,
					operation,
					changedJunctionIds: [...changedJunctionIds],
					changedWallIds: [...changedWallIds],
					acceptance: {
						get documentJson(): string {
							if (memoizedDocJson === undefined) {
								memoizedDocJson = serializeWallFirstLayoutDocument(candidate);
							}
							return memoizedDocJson;
						},
						geometry: compiled.geometry,
						issues: compiled.issues,
					},
				};
			}
		}
	}

	// One chain-scoped derivation serves every consumer below that receives it;
	// consumers without a derivation keep per-call sampling.
	const sampling = createWallSamplingDerivation();

	const preStructural = p2311Measure('structural-pre', () =>
		validateWallFirstLayoutDocument(candidate),
	);
	if (!preStructural.success) {
		return reject(
			'geometry_invalid',
			`Candidate failed wall-first validation: ${preStructural.issues[0]?.message ?? 'unknown issue'}`,
			undefined,
			preStructural.issues,
		);
	}
	// Geometry edits own the stable Opening-set rejection contract below. The
	// topology helper still validates the same canonical rules, but must defer
	// translating Opening-set issues or every non-height Opening failure would
	// be consumed as `topology_invalid` before the explicit gate can classify it.
	const movedJunctions = new Set(changedJunctionIds);
	const closedContactWallIds = new Set([...changedWallIds, ...(options.createdWallIds ?? [])]);
	for (const wall of candidate.walls) {
		if (movedJunctions.has(wall.startJunctionId) || movedJunctions.has(wall.endJunctionId)) {
			closedContactWallIds.add(wall.id);
		}
	}
	const preTopology = p2311Measure('topology-pre', () =>
		validateWallFirstTopology(preStructural.document, {
			openingSet: 'defer',
			sampling,
			closedContactWallIds,
		}),
	);
	if (preTopology) {
		return reject(
			preTopology.code === 'wall_height_below_opening'
				? 'wall_height_below_opening'
				: 'topology_invalid',
			preTopology.message,
			preTopology.targetId ? [preTopology.targetId] : undefined,
			[preTopology],
		);
	}

	const document = preStructural.document;
	const extraction = p2311Measure('face-extraction', () =>
		extractBoundaryCandidateFaces(document, sampling),
	);
	const candidateRoomById = new Map(document.rooms.map((room) => [room.id, room]));
	const components: ComponentLineage[] = [];
	for (const room of baseline.rooms) {
		const candidateRoom = candidateRoomById.get(room.id);
		if (!candidateRoom) {
			return reject('room_identity_lost', `Room '${room.id}' has no candidate boundary`, [room.id]);
		}
		// An open Space has no candidate face; it is carried and asserted below.
		if (room.virtualEdges.length > 0 || candidateRoom.virtualEdges.length > 0) continue;
		components.push({
			candidateFaceKeys: [canonicalBoundaryCycleKey(candidateRoom.boundary)],
			predecessorRoomIds: [room.id],
		});
	}

	const allocationAttempted = { value: false };
	const reconciliation: ReconciliationResult = p2311Measure('room-reconciliation', () =>
		reconcileRooms({
			baseline,
			candidateDocument: document,
			extraction,
			components,
			// Direct geometry edits never retire an open Space; it is carried from its
			// candidate record, which may already carry a split or joined boundary.
			candidateRooms: document.rooms,
			allocator: guardedRoomAllocator(allocationAttempted),
		}),
	);
	if (isReconciliationFailure(reconciliation)) {
		const { rejection } = reconciliation;
		return reject(
			rejection.code === 'space_outline_invalid' ? 'space_outline_invalid' : 'room_identity_lost',
			rejection.message,
			rejection.roomIds,
		);
	}

	const identityIssue = assertWallGeometryRoomIdentityPreserved(
		baseline,
		document,
		reconciliation,
		allocationAttempted.value,
	);
	if (identityIssue) {
		return reject('room_identity_lost', identityIssue.message, identityIssue.targetIds);
	}

	const reconciled = reconciliation.document;
	const structural = p2311Measure('structural-post', () =>
		validateWallFirstLayoutDocument(reconciled),
	);
	if (!structural.success) {
		return reject(
			'geometry_invalid',
			`Candidate failed wall-first validation: ${structural.issues[0]?.message ?? 'unknown issue'}`,
			undefined,
			structural.issues,
		);
	}
	const topologyIssue = p2311Measure('topology-post', () =>
		validateWallFirstTopology(structural.document, {
			openingSet: 'defer',
			sampling,
			closedContactWallIds,
		}),
	);
	if (topologyIssue) {
		return reject(
			topologyIssue.code === 'wall_height_below_opening'
				? 'wall_height_below_opening'
				: 'topology_invalid',
			topologyIssue.message,
			topologyIssue.targetId ? [topologyIssue.targetId] : undefined,
			[topologyIssue],
		);
	}
	const setIssues = p2311Measure('opening-set', () =>
		validateWallFirstOpeningSet(structural.document, sampling),
	);
	if (setIssues.length > 0) {
		const first = setIssues[0]!;
		return reject(
			first.code === 'opening_exceeds_wall_height'
				? 'wall_height_below_opening'
				: 'opening_set_invalid',
			first.message,
			[first.wallId, first.openingId],
			setIssues,
		);
	}
	const relationIssues = p2311Measure('portal-relations', () =>
		validateWallFirstPortalRelations(structural.document),
	);
	if (relationIssues.length > 0) {
		const first = relationIssues[0]!;
		return reject('portal_relation_invalid', first.message, [first.openingId], relationIssues);
	}
	// The same session, with the step's shared sampling
	// derivation: one pointer sample re-compiles only the entities it moved.
	const compileSession = activeLayoutCompileSession();
	const compiled = p2311Measure('acceptance-compile', () =>
		compileSession
			? compileSession.compile(structural.document, sampling)
			: compileWallFirstLayoutGeometry(structural.document, sampling),
	);
	if (hasBlockingLayoutIssues(compiled.issues)) {
		return reject(
			'geometry_invalid',
			compiled.issues[0]?.message ?? 'Candidate geometry does not compile',
			undefined,
			compiled.issues,
		);
	}
	return {
		kind: 'success',
		document: structural.document,
		operation,
		changedJunctionIds: [...changedJunctionIds],
		changedWallIds: [...new Set([...changedWallIds, ...(options.createdWallIds ?? [])])],
		acceptance: {
			documentJson: structural.canonicalJson,
			geometry: compiled.geometry,
			issues: compiled.issues,
		},
	};
}

/**
 * An allocator that must never be reached: a coordinate edit or subdivision
 * preserves global Room identity, so a reconciliation branch that allocates a
 * Room ID/name is proof the operation was not identity-preserving. It records
 * the attempt instead of throwing so the planner rejects through its ordinary
 * result contract.
 */
function guardedRoomAllocator(attempted: { value: boolean }): RoomIdAllocator {
	return {
		nextRoomId(_document, faceKey) {
			attempted.value = true;
			return `unreachable-wall-edit.${faceKey}`;
		},
		nextRoomName() {
			attempted.value = true;
			return 'Unreachable Wall Edit';
		},
	};
}

/**
 * Prove the geometry edit preserved **global** Room identity: every baseline
 * Room survives with the same ID and name, no Room was born, retired, split or
 * merged, the declared candidate boundary cycle was honored, and reconciliation
 * never reached an allocating branch.
 */
function assertWallGeometryRoomIdentityPreserved(
	baseline: LayoutDocumentWallFirst,
	candidate: LayoutDocumentWallFirst,
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
	allocationAttempted: boolean,
): { message: string; targetIds?: readonly string[] } | null {
	if (allocationAttempted) {
		return {
			message:
				'Geometry edit reached a Room allocation branch; direct Wall/Junction edits preserve Room identity',
		};
	}
	if (reconciliation.retiredRoomIds.length > 0) {
		return {
			message: `Geometry edit retired Room(s) ${reconciliation.retiredRoomIds.join(', ')}`,
			targetIds: [...reconciliation.retiredRoomIds],
		};
	}
	const carriedRoomIds = new Set(reconciliation.carriedRoomIds);
	if (reconciliation.lineage.length + carriedRoomIds.size !== baseline.rooms.length) {
		return {
			message: `Geometry edit produced ${reconciliation.lineage.length} lineage record(s) and ${carriedRoomIds.size} carried Space(s) for ${baseline.rooms.length} Room(s)`,
		};
	}
	for (const room of baseline.rooms) {
		if (room.virtualEdges.length > 0 && !carriedRoomIds.has(room.id)) {
			return {
				message: `Open Space '${room.id}' was not carried by the geometry edit`,
				targetIds: [room.id],
			};
		}
	}
	for (const record of reconciliation.lineage) {
		if (record.kind !== 'preserved' || record.predecessorRoomIds.length !== 1) {
			return {
				message: `Geometry edit produced a '${record.kind}' lineage record for Room '${record.roomId}'`,
				targetIds: [record.roomId],
			};
		}
	}
	if (layoutLength(reconciliation.document, 'rooms') !== baseline.rooms.length) {
		return {
			message: `Room count changed during the geometry edit (${baseline.rooms.length} → ${layoutLength(reconciliation.document, 'rooms')})`,
		};
	}
	const finalByRoomId = new Map(reconciliation.document.rooms.map((room) => [room.id, room]));
	const candidateById = new Map(candidate.rooms.map((room) => [room.id, room]));
	for (const room of baseline.rooms) {
		const finalRoom = finalByRoomId.get(room.id);
		if (!finalRoom) {
			return {
				message: `Room '${room.id}' did not survive the geometry edit`,
				targetIds: [room.id],
			};
		}
		if (finalRoom.name !== room.name) {
			return {
				message: `Room '${room.id}' name changed during the geometry edit`,
				targetIds: [room.id],
			};
		}
		const declared = candidateById.get(room.id);
		if (
			!declared ||
			canonicalBoundaryCycleKey(finalRoom.boundary) !==
				canonicalBoundaryCycleKey(declared.boundary) ||
			JSON.stringify(finalRoom.virtualEdges) !== JSON.stringify(declared.virtualEdges)
		) {
			return {
				message: `Room '${room.id}' boundary lineage changed during the geometry edit`,
				targetIds: [room.id],
			};
		}
	}
	return null;
}
