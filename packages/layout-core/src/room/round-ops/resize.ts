import { isClosedWall } from '../../wall/closed-wall';
import { canonicalBoundaryCycleKey, extractBoundaryCandidateFaces } from '../../geometry/face-extraction';
import { compileWallFirstLayoutGeometry } from '../../geometry/compiler';
import { CURVE_ARC_LENGTH_TOLERANCE } from '../../geometry/curve';
import { LAYOUT_DIMENSION_LIMIT_MESSAGE, exceedsLayoutDimension } from '../../geometry/limits';
import type { LayoutGeometryIssue } from '../../geometry/types';
import { hasBlockingLayoutIssues } from '../../geometry/validation';
import type { LayoutDocumentIssue } from '../../plan/issue';
import { validateWallFirstOpeningSet } from '../../wall/opening-set';
import { reconcileRooms } from '../reconciliation';
import type { ComponentLineage, RoomIdAllocator } from '../reconciliation-types';
import type { RoundOperationCorrespondence } from '../round-room';
import { buildRoundRoomGeometryFromCertified, certifyRoundRoom } from '../round-room';
import { spacePlacementIssues } from '../space-placement';
import type { LayoutSurfaceLineage } from '../../plan/surface-reference';
import { wallCurveChainLength } from '../../wall/curve-algebra';
import { validateWallFirstLayoutDocument } from '../../wall/codec';
import { validateWallFirstTopology } from '../../topology/wall-first';
import type { LayoutDocumentWallFirst, LayoutJunction, LayoutWall, LayoutWallOpening } from '../../wall/types';
import { validateWallFirstPortalRelations } from '../../wall/portals';

// ---------------------------------------------------------------------------
// Whole-radius resize for isolated circles and connected Round rings
// ---------------------------------------------------------------------------

export type RoundRoomRadiusRejectionCode =
	| 'unknown_room'
	| 'not_round_room'
	| 'no_op'
	| 'invalid_radius'
	| 'dimension_out_of_range'
	| 'coupled_round_room'
	| 'opening_does_not_fit'
	| 'topology_invalid'
	| 'space_outline_invalid'
	| 'space_overlap'
	| 'space_contains_space'
	| 'room_identity_lost'
	| 'portal_relation_invalid'
	| 'invalid_candidate_document'
	| 'candidate_does_not_compile';


export type RoundRoomRadiusRejection = {
	readonly code: RoundRoomRadiusRejectionCode;
	readonly message: string;
	readonly roomIds?: readonly string[];
	readonly wallIds?: readonly string[];
	readonly junctionIds?: readonly string[];
	readonly openingIds?: readonly string[];
	readonly issues?: readonly (LayoutDocumentIssue | LayoutGeometryIssue)[];
};


export type RoundRoomRadiusPlan =
	| {
			readonly kind: 'success';
			readonly document: LayoutDocumentWallFirst;
			readonly roomId: string;
			readonly changedJunctionIds: readonly string[];
			readonly changedWallIds: readonly string[];
			readonly surfaceLineage: LayoutSurfaceLineage;
			readonly correspondence: RoundOperationCorrespondence;
	  }
	| {
			readonly kind: 'rejected';
			readonly rejection: RoundRoomRadiusRejection;
	  };


function rejectRadius(
	code: RoundRoomRadiusRejectionCode,
	message: string,
	extra: Omit<RoundRoomRadiusRejection, 'code' | 'message'> = {}
): RoundRoomRadiusPlan {
	return { kind: 'rejected', rejection: { code, message, ...extra } };
}


function guardedRadiusAllocator(attempted: { value: boolean }): RoomIdAllocator {
	return {
		nextRoomId(_doc, faceKey) {
			attempted.value = true;
			return `unreachable-round-radius.${faceKey}`;
		},
		nextRoomName() {
			attempted.value = true;
			return 'Unreachable Round Radius';
		}
	};
}


/**
 * Resize a Round Room's radius (both isolated closed circles and connected
 * multi-arc rings) atomically around its authored `round.center`.
 */
export function planResizeRoundRoomRadius(options: {
	readonly document: LayoutDocumentWallFirst;
	readonly roomId: string;
	readonly radius: number;
}): RoundRoomRadiusPlan {
	const { document, roomId, radius } = options;
	const room = document.rooms.find((candidate) => candidate.id === roomId);
	if (!room) {
		return rejectRadius('unknown_room', `Unknown room '${roomId}'`, { roomIds: [roomId] });
	}
	if (room.round === undefined) {
		return rejectRadius('not_round_room', `Room '${roomId}' is not a Round Room`, {
			roomIds: [roomId]
		});
	}
	if (!Number.isFinite(radius) || !(radius > 0)) {
		return rejectRadius('invalid_radius', 'Round Room radius must be a finite positive number of meters', {
			roomIds: [roomId]
		});
	}
	if (exceedsLayoutDimension(radius * 2)) {
		return rejectRadius('dimension_out_of_range', LAYOUT_DIMENSION_LIMIT_MESSAGE, {
			roomIds: [roomId]
		});
	}
	if (radius === room.round.radius) {
		return rejectRadius('no_op', `Round Room '${roomId}' already has radius ${radius} m`, {
			roomIds: [roomId]
		});
	}

	const cert = certifyRoundRoom(document, room);
	if (cert.kind === 'invalid') {
		return rejectRadius('invalid_candidate_document', cert.issue.message, {
			roomIds: [roomId],
			issues: [cert.issue]
		});
	}
	const { certified } = cert;

	const wallById = new Map(document.walls.map((w) => [w.id, w] as const));
	const ringWallIds = new Set(room.boundary.map((ref) => ref.wallId));
	const rimJunctionIds = new Set<string>();

	for (const wallId of ringWallIds) {
		const wall = wallById.get(wallId);
		if (!wall) {
			return rejectRadius('invalid_candidate_document', `Round Room '${roomId}' references unknown Wall '${wallId}'`, {
				roomIds: [roomId],
				wallIds: [wallId]
			});
		}
		if (!(radius > wall.thickness * 0.5 + 1e-6)) {
			return rejectRadius(
				'invalid_radius',
				`Radius ${radius} m is too small for Wall '${wall.id}' thickness ${wall.thickness} m`,
				{ roomIds: [roomId], wallIds: [wall.id] }
			);
		}
		rimJunctionIds.add(wall.startJunctionId);
		rimJunctionIds.add(wall.endJunctionId);
	}

	// Refuse if a second Round Room shares any moved rim Junction (coupled radii are out of scope).
	for (const other of document.rooms) {
		if (other.id === roomId || other.round === undefined) continue;
		const sharedRim: string[] = [];
		for (const ref of other.boundary) {
			const w = wallById.get(ref.wallId);
			if (!w) continue;
			if (rimJunctionIds.has(w.startJunctionId) && !sharedRim.includes(w.startJunctionId)) {
				sharedRim.push(w.startJunctionId);
			}
			if (rimJunctionIds.has(w.endJunctionId) && !sharedRim.includes(w.endJunctionId)) {
				sharedRim.push(w.endJunctionId);
			}
		}
		if (sharedRim.length > 0) {
			return rejectRadius(
				'coupled_round_room',
				`Resizing Round Room '${roomId}' would move rim Junction(s) shared with Round Room '${other.id}'`,
				{ roomIds: [roomId, other.id], junctionIds: sharedRim }
			);
		}
	}

	const touchedWallIds = document.walls
		.filter(
			(w) =>
				ringWallIds.has(w.id) ||
				rimJunctionIds.has(w.startJunctionId) ||
				rimJunctionIds.has(w.endJunctionId)
		)
		.map((w) => w.id);

	const rebuilt = buildRoundRoomGeometryFromCertified({
		document,
		certified,
		center: certified.center,
		radius,
		seamDirection: certified.seamDirection
	});

	const nextJunctions: LayoutJunction[] = document.junctions.map((j) => {
		const pt = rebuilt.junctionPoints.get(j.id);
		return pt ? { ...j, point: pt } : j;
	});
	const nextPointById = new Map(nextJunctions.map((j) => [j.id, j.point] as const));

	const nextWalls: LayoutWall[] = document.walls.map((w) => {
		const nextCenterline = rebuilt.wallCenterlines.get(w.id);
		return nextCenterline ? { ...w, centerline: nextCenterline } : w;
	});
	const nextWallById = new Map(nextWalls.map((w) => [w.id, w] as const));

	for (const wallId of touchedWallIds) {
		const w = nextWallById.get(wallId)!;
		const start = nextPointById.get(w.startJunctionId);
		const end = nextPointById.get(w.endJunctionId);
		if (!start || !end) {
			return rejectRadius('invalid_candidate_document', `Wall '${w.id}' has unresolved endpoints`, {
				roomIds: [roomId],
				wallIds: [w.id]
			});
		}
		const spanLength =
			w.centerline.kind === 'line'
				? Math.hypot(end[0] - start[0], end[1] - start[1])
				: wallCurveChainLength({
						startPoint: start,
						endPoint: end,
						knots: w.centerline.knots,
						spans: w.centerline.spans
					});
		if (exceedsLayoutDimension(spanLength)) {
			return rejectRadius('dimension_out_of_range', LAYOUT_DIMENSION_LIMIT_MESSAGE, {
				roomIds: [roomId],
				wallIds: [w.id]
			});
		}
	}

	const ratio = radius / certified.radius;
	const closedNewLengths = new Map<string, number>();
	for (const wallId of ringWallIds) {
		const w = nextWallById.get(wallId)!;
		if (isClosedWall(w) && w.centerline.kind === 'cubic-chain') {
			const pt = nextPointById.get(w.startJunctionId)!;
			closedNewLengths.set(
				wallId,
				wallCurveChainLength({
					startPoint: pt,
					endPoint: pt,
					knots: w.centerline.knots,
					spans: w.centerline.spans
				})
			);
		}
	}

	const nextOpenings: LayoutWallOpening[] = [];
	for (const opening of document.openings) {
		if (!ringWallIds.has(opening.wallId)) {
			nextOpenings.push(opening);
			continue;
		}
		const closedLen = closedNewLengths.get(opening.wallId);
		if (closedLen !== undefined) {
			if (opening.width >= closedLen - 1e-6) {
				return rejectRadius(
					'opening_does_not_fit',
					`Opening '${opening.id}' on Wall '${opening.wallId}' no longer fits at radius ${radius} m`,
					{ roomIds: [roomId], wallIds: [opening.wallId], openingIds: [opening.id] }
				);
			}
			const wrapped = ((opening.offset * ratio) % closedLen + closedLen) % closedLen;
			nextOpenings.push({
				...opening,
				offset: closedLen - wrapped <= CURVE_ARC_LENGTH_TOLERANCE ? 0 : wrapped
			});
		} else {
			nextOpenings.push({ ...opening, offset: opening.offset * ratio });
		}
	}

	const candidate: LayoutDocumentWallFirst = {
		...document,
		junctions: nextJunctions,
		walls: nextWalls,
		rooms: document.rooms.map((entry) =>
			entry.id === roomId ? { ...entry, round: rebuilt.round } : entry
		),
		openings: nextOpenings
	};

	// Canonical validation gates — whole-edit atomic refusal, never clamping or retiring Spaces.
	const preStructural = validateWallFirstLayoutDocument(candidate);
	if (!preStructural.success) {
		const first = preStructural.issues[0]!;
		return rejectRadius('invalid_candidate_document', first.message, {
			roomIds: [roomId],
			issues: preStructural.issues
		});
	}

	const preTopology = validateWallFirstTopology(preStructural.document, { openingSet: 'defer' });
	if (preTopology) {
		return rejectRadius('topology_invalid', preTopology.message, {
			roomIds: [roomId],
			wallIds: preTopology.targetId ? [preTopology.targetId] : undefined,
			issues: [preTopology]
		});
	}

	const openingIssues = validateWallFirstOpeningSet(preStructural.document);
	if (openingIssues.length > 0) {
		const first = openingIssues[0]!;
		return rejectRadius('opening_does_not_fit', first.message, {
			roomIds: [roomId],
			wallIds: [first.wallId],
			openingIds: [first.openingId]
		});
	}

	const portalIssues = validateWallFirstPortalRelations(preStructural.document);
	if (portalIssues.length > 0) {
		const first = portalIssues[0]!;
		return rejectRadius('portal_relation_invalid', first.message, {
			roomIds: [roomId],
			openingIds: [first.openingId]
		});
	}

	// Assert unchanged Room membership / cycles and valid open-Space outlines & SP placement.
	const extraction = extractBoundaryCandidateFaces(preStructural.document);
	const candidateRoomById = new Map(preStructural.document.rooms.map((r) => [r.id, r] as const));
	const components: ComponentLineage[] = [];
	for (const baseRoom of document.rooms) {
		const candRoom = candidateRoomById.get(baseRoom.id);
		if (!candRoom) {
			return rejectRadius('room_identity_lost', `Room '${baseRoom.id}' lost its candidate boundary`, {
				roomIds: [baseRoom.id]
			});
		}
		if (baseRoom.virtualEdges.length > 0 || candRoom.virtualEdges.length > 0) continue;
		components.push({
			candidateFaceKeys: [canonicalBoundaryCycleKey(candRoom.boundary)],
			predecessorRoomIds: [baseRoom.id]
		});
	}
	const allocationAttempted = { value: false };
	const reconciliation = reconcileRooms({
		baseline: document,
		candidateDocument: preStructural.document,
		extraction,
		components,
		candidateRooms: preStructural.document.rooms,
		allocator: guardedRadiusAllocator(allocationAttempted)
	});
	if ('rejection' in reconciliation) {
		if (
			reconciliation.rejection.code === 'space_outline_invalid' &&
			reconciliation.rejection.roomIds !== undefined &&
			reconciliation.rejection.roomIds.length === 2
		) {
			const [idA, idB] = reconciliation.rejection.roomIds;
			const matched = spacePlacementIssues(preStructural.document).find(
				(issue) =>
					(issue.roomIds[0] === idA && issue.roomIds[1] === idB) ||
					(issue.roomIds[0] === idB && issue.roomIds[1] === idA)
			);
			if (matched) {
				return rejectRadius(
					matched.code === 'space_contains_space' ? 'space_contains_space' : 'space_overlap',
					matched.message,
					{ roomIds: matched.roomIds }
				);
			}
		}
		return rejectRadius(
			reconciliation.rejection.code === 'space_outline_invalid'
				? 'space_outline_invalid'
				: 'room_identity_lost',
			reconciliation.rejection.message,
			{ roomIds: reconciliation.rejection.roomIds ?? [roomId] }
		);
	}
	if (
		allocationAttempted.value ||
		reconciliation.retiredRoomIds.length > 0 ||
		reconciliation.lineage.some((entry) => entry.kind !== 'preserved')
	) {
		return rejectRadius(
			'room_identity_lost',
			`Resizing Round Room '${roomId}' would change Room topology or membership`,
			{ roomIds: [roomId] }
		);
	}
	const placementIssues = spacePlacementIssues(reconciliation.document);
	if (placementIssues.length > 0) {
		const first = placementIssues[0]!;
		return rejectRadius(
			first.code === 'space_contains_space' ? 'space_contains_space' : 'space_overlap',
			first.message,
			{ roomIds: first.roomIds }
		);
	}

	const finalValidated = validateWallFirstLayoutDocument(reconciliation.document);
	if (!finalValidated.success) {
		return rejectRadius(
			'invalid_candidate_document',
			finalValidated.issues[0]?.message ?? 'Candidate document failed final validation',
			{ roomIds: [roomId], issues: finalValidated.issues }
		);
	}
	const compiled = compileWallFirstLayoutGeometry(finalValidated.document);
	if (hasBlockingLayoutIssues(compiled.issues)) {
		return rejectRadius(
			'candidate_does_not_compile',
			compiled.issues[0]?.message ?? 'Candidate document does not compile',
			{ roomIds: [roomId], issues: compiled.issues }
		);
	}

	return {
		kind: 'success',
		document: finalValidated.document,
		roomId,
		changedJunctionIds: [...rimJunctionIds],
		changedWallIds: touchedWallIds,
		surfaceLineage: [],
		correspondence: {
			rooms: [{ roomId, status: 'preserved' }],
			walls: [],
			junctions: [...rimJunctionIds].map((id) => ({ kind: 'preserved', junctionId: id })),
			openings: []
		}
	};
}
