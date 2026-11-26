import { cowMoveJunctions } from '../world/cow';
import { ensureLayoutWorldIndex } from '../world/lookups';
import { wallFirstWallLength } from '../wall/opening-set';
import { spacePlacementIssues } from '../room/space-placement';
import { spaceOpenSideFrame } from '../room/space-open-side';
import type { LayoutDocumentWallFirst } from '../wall/types';
import { guardRoundRoomMemberGeometryEdit } from '../room/round-room';
import type { NodingIdAllocator } from '../wall/noding';
import { planWallSplitAtPoint } from '../wall/noding';
import type { LayoutVec2 } from '../geometry/coordinates';
import type {
	PrecisionOperation,
	PrecisionPlan,
	PrecisionRejection,
	SpaceOpenSideSlidePlan,
} from './types';
import { POINT_EPSILON } from '../vec2';
import { wallEndpoints } from './document';
import { finalizeWallGeometryCandidate } from './finalization';
import { reject, rejectRoundMember } from './rejections';

/**
 * Move one stated open side square to itself.
 *
 * The virtual edge has no coordinates of its own: its two end Junctions are the
 * authority. A perpendicular offset therefore moves exactly those two
 * Junctions by the same vector, so the adjoining Walls reshape through the
 * shared ids while the Space keeps its refs and its virtual edge pair. No id is
 * allocated, so Undo/Redo and a repeated identical drag are byte-identical.
 *
 * The shared acceptance path owns every invariant: outline positivity and
 * simplicity (I4), the placement gate (I7) and Room identity. A placement
 * conflict is reclassified with both Space ids so the editor can say
 * **Stops at *name*** without re-deriving the verdict.
 */
export function planSpaceOpenSideOffset(
	document: LayoutDocumentWallFirst,
	roomId: string,
	startJunctionId: string,
	endJunctionId: string,
	offset: number,
): PrecisionPlan {
	if (!Number.isFinite(offset)) {
		return reject('invalid_value', 'An open side offset must be one finite number of meters', [
			roomId,
		]);
	}
	const frame = spaceOpenSideFrame(document, roomId, startJunctionId, endJunctionId);
	if (frame === null) {
		return reject(
			'unknown_open_side',
			`Space '${roomId}' has no open side between '${startJunctionId}' and '${endJunctionId}'`,
			[roomId],
		);
	}
	if (Math.abs(offset) <= POINT_EPSILON) {
		return reject('no_op', 'The open side is already at that position', [roomId]);
	}
	const roundHit = guardRoundRoomMemberGeometryEdit(document, {
		junctionIds: [frame.startJunctionId, frame.endJunctionId],
	});
	if (roundHit) return rejectRoundMember(roundHit);
	const worldIndex = ensureLayoutWorldIndex(document);
	const junctionById = new Map(document.junctions.map((junction) => [junction.id, junction]));
	const start = junctionById.get(frame.startJunctionId);
	const end = junctionById.get(frame.endJunctionId);
	if (!start || !end) {
		return reject('unknown_junction', 'The open side has no resolvable end Junctions', [roomId]);
	}
	const dx = frame.normal[0] * offset;
	const dz = frame.normal[1] * offset;
	const targetPoints = new Map<string, LayoutVec2>([
		[frame.startJunctionId, [start.point[0] + dx, start.point[1] + dz]],
		[frame.endJunctionId, [end.point[0] + dx, end.point[1] + dz]],
	]);
	const changedJunctionIds = [frame.startJunctionId, frame.endJunctionId];
	const changedWallIds = worldIndex
		? [
				...new Set(
					changedJunctionIds.flatMap((id) => worldIndex.incidentWallIdsByJunctionId.get(id) ?? []),
				),
			]
		: document.walls
				.filter(
					(wall) =>
						changedJunctionIds.includes(wall.startJunctionId) ||
						changedJunctionIds.includes(wall.endJunctionId),
				)
				.map((wall) => wall.id);
	const candidate = cowMoveJunctions(document, targetPoints, changedWallIds, worldIndex);
	return finalizeOpenSideCandidate({
		baseline: document,
		candidate,
		operation: 'open-side-offset',
		changedJunctionIds,
		changedWallIds,
		roomId,
	});
}

/**
 * Slide one open-side end into its adjoining Wall and split that
 * Wall at release.
 *
 * The end is always a Junction. The adjoining Wall is cut with the canonical
 * `planWallSplitAtPoint` noder; the fragment that still ends at the old corner
 * is released from this Space (it stays an ordinary free-standing Wall), and
 * the virtual edge is re-pointed at the split Junction. The other fragment
 * remains the Space's boundary. The captured allocator supplies the split
 * Junction and stub Wall ids, so a preview and its commit describe the same
 * document and Undo/Redo replays them.
 */
export function planSpaceOpenSideEndSlide(
	document: LayoutDocumentWallFirst,
	roomId: string,
	startJunctionId: string,
	endJunctionId: string,
	end: 'start' | 'end',
	wallId: string,
	station: number,
	point: LayoutVec2,
	allocator: NodingIdAllocator,
): SpaceOpenSideSlidePlan {
	if (end !== 'start' && end !== 'end') {
		return {
			kind: 'rejected',
			rejection: { code: 'invalid_value', message: "An open side end is 'start' or 'end'." },
		};
	}
	if (!Number.isFinite(station) || station <= 0) {
		return {
			kind: 'rejected',
			rejection: {
				code: 'invalid_value',
				message: 'A slide station must be one finite positive number of meters.',
				targetIds: [wallId],
			},
		};
	}
	const frame = spaceOpenSideFrame(document, roomId, startJunctionId, endJunctionId);
	if (frame === null) {
		return {
			kind: 'rejected',
			rejection: {
				code: 'unknown_open_side',
				message: `Space '${roomId}' has no open side between '${startJunctionId}' and '${endJunctionId}'`,
				targetIds: [roomId],
			},
		};
	}
	const adjoining = end === 'start' ? frame.startWall : frame.endWall;
	const endpoint = end === 'start' ? frame.startJunctionId : frame.endJunctionId;
	const slideRoundHit = guardRoundRoomMemberGeometryEdit(document, {
		wallIds: adjoining ? [adjoining.wallId] : [wallId],
		junctionIds: [endpoint],
	});
	if (slideRoundHit) {
		return {
			kind: 'rejected',
			rejection: {
				code: 'round_room_member_locked',
				message: slideRoundHit.message,
				targetIds: [slideRoundHit.roomId, ...slideRoundHit.wallIds, ...slideRoundHit.junctionIds],
			},
		};
	}
	if (
		adjoining === null ||
		adjoining.wallId !== wallId ||
		(end === 'start'
			? adjoining.orientedEndJunctionId !== endpoint
			: adjoining.orientedStartJunctionId !== endpoint)
	) {
		return {
			kind: 'rejected',
			rejection: {
				code: 'invalid_reference',
				message: `Wall '${wallId}' is not the adjoining Wall of that open-side end`,
				targetIds: [roomId, wallId],
			},
		};
	}
	const wallLength = wallFirstWallLength(document, wallId);
	if (wallLength === undefined) {
		return {
			kind: 'rejected',
			rejection: { code: 'unknown_wall', message: `Unknown Wall '${wallId}'`, targetIds: [wallId] },
		};
	}
	if (!(station < wallLength) || station <= POINT_EPSILON) {
		return {
			kind: 'rejected',
			rejection: {
				code: 'split_distance_out_of_range',
				message: `Slide station ${station} is not inside Wall '${wallId}' (0, ${wallLength})`,
				targetIds: [wallId],
			},
		};
	}
	if (
		!Array.isArray(point) ||
		point.length !== 2 ||
		!Number.isFinite(point[0]) ||
		!Number.isFinite(point[1])
	) {
		return {
			kind: 'rejected',
			rejection: {
				code: 'invalid_value',
				message: 'A slide point must be two finite coordinates.',
				targetIds: [wallId],
			},
		};
	}
	const wall = document.walls.find((candidate) => candidate.id === wallId);
	if (wall === undefined) {
		return {
			kind: 'rejected',
			rejection: { code: 'unknown_wall', message: `Unknown Wall '${wallId}'`, targetIds: [wallId] },
		};
	}
	// A straight Wall's station is authoritative. A caller-supplied coordinate
	// must never move the split off the centerline; curved Walls already ignore
	// the override in planWallSplitAtPoint.
	const endpoints = wall.centerline.kind === 'line' ? wallEndpoints(document, wall) : undefined;
	const splitPoint: LayoutVec2 =
		endpoints === undefined
			? point
			: [
					endpoints.start[0] +
						((endpoints.end[0] - endpoints.start[0]) * station) / endpoints.length,
					endpoints.start[1] +
						((endpoints.end[1] - endpoints.start[1]) * station) / endpoints.length,
				];
	const split = planWallSplitAtPoint(document, wallId, station, splitPoint, allocator);
	if (split.kind === 'rejected') {
		return {
			kind: 'rejected',
			rejection: {
				code: split.rejection.code,
				message: split.rejection.message,
				targetIds: split.rejection.wallId === undefined ? [wallId] : [split.rejection.wallId],
			},
		};
	}
	const createdWallId = split.createdWallIds[0];
	if (createdWallId === undefined) {
		return {
			kind: 'rejected',
			rejection: {
				code: 'geometry_invalid',
				message: 'The Wall split created no second fragment.',
				targetIds: [wallId],
			},
		};
	}
	const stub =
		split.document.walls.find(
			(wall) => wall.startJunctionId === split.junctionId && wall.endJunctionId === endpoint,
		) ??
		split.document.walls.find(
			(wall) => wall.endJunctionId === split.junctionId && wall.startJunctionId === endpoint,
		);
	if (stub === undefined) {
		return {
			kind: 'rejected',
			rejection: {
				code: 'geometry_invalid',
				message: 'The Wall split lost the open side corner.',
				targetIds: [wallId],
			},
		};
	}
	const releasedOpenings = split.document.openings.filter((opening) => opening.wallId === stub.id);
	if (releasedOpenings.length > 0) {
		return {
			kind: 'rejected',
			rejection: {
				code: 'opening_on_released_stub',
				message: `The released Wall fragment '${stub.id}' still hosts an Opening`,
				targetIds: [stub.id, ...releasedOpenings.map((opening) => opening.id)],
			},
		};
	}
	const keptWallId = stub.id === wallId ? createdWallId : wallId;
	const splitRoom = split.document.rooms.find((room) => room.id === roomId);
	if (splitRoom === undefined) {
		return {
			kind: 'rejected',
			rejection: {
				code: 'unknown_room',
				message: `Unknown Space '${roomId}'`,
				targetIds: [roomId],
			},
		};
	}
	const stubRefs = splitRoom.boundary.filter((ref) => ref.wallId === stub.id);
	if (stubRefs.length !== 1) {
		return {
			kind: 'rejected',
			rejection: {
				code: 'room_identity_lost',
				message: `Space '${roomId}' does not reference the split-away Wall fragment exactly once`,
				targetIds: [roomId],
			},
		};
	}
	const movedEdge = splitRoom.virtualEdges.find(
		(edge) => edge.startJunctionId === startJunctionId && edge.endJunctionId === endJunctionId,
	);
	if (movedEdge === undefined) {
		return {
			kind: 'rejected',
			rejection: {
				code: 'unknown_open_side',
				message: `Space '${roomId}' lost its open side during the split`,
				targetIds: [roomId],
			},
		};
	}
	const candidate: LayoutDocumentWallFirst = {
		...split.document,
		rooms: split.document.rooms.map((room) =>
			room.id !== roomId
				? room
				: {
						...room,
						boundary: room.boundary.filter((ref) => ref.wallId !== stub.id),
						virtualEdges: room.virtualEdges.map((edge) =>
							edge.startJunctionId === startJunctionId && edge.endJunctionId === endJunctionId
								? {
										startJunctionId: end === 'start' ? split.junctionId : edge.startJunctionId,
										endJunctionId: end === 'end' ? split.junctionId : edge.endJunctionId,
									}
								: edge,
						),
					},
		),
	};
	const finalized = finalizeWallGeometryCandidate({
		baseline: document,
		candidate,
		operation: 'open-side-end-slide',
		changedJunctionIds: [endpoint, split.junctionId],
		changedWallIds: [wallId, createdWallId],
		createdWallIds: [createdWallId],
	});
	if (finalized.kind === 'rejected') {
		return {
			kind: 'rejected',
			rejection: classifySpacePlacementRejection(finalized.rejection, candidate, roomId),
		};
	}
	return {
		kind: 'success',
		document: finalized.document,
		operation: 'open-side-end-slide',
		changedJunctionIds: finalized.changedJunctionIds,
		changedWallIds: finalized.changedWallIds,
		createdWallIds: [createdWallId],
		splitJunctionId: split.junctionId,
		keptWallId,
		stubWallId: stub.id,
		surfaceLineage: split.surfaceLineage,
		...(finalized.acceptance === undefined ? {} : { acceptance: finalized.acceptance }),
	};
}

/**
 * The shared acceptance path for a virtual-edge handle, with one addition: a
 * placement rejection names both Spaces so the editor can say **Stops at
 * *name***. The gate itself is unchanged and runs in `finalizeWallGeometryCandidate`.
 */
function finalizeOpenSideCandidate(options: {
	baseline: LayoutDocumentWallFirst;
	candidate: LayoutDocumentWallFirst;
	operation: PrecisionOperation;
	changedJunctionIds: readonly string[];
	changedWallIds: readonly string[];
	roomId: string;
}): PrecisionPlan {
	const finalized = finalizeWallGeometryCandidate({
		baseline: options.baseline,
		candidate: options.candidate,
		operation: options.operation,
		changedJunctionIds: options.changedJunctionIds,
		changedWallIds: options.changedWallIds,
	});
	if (finalized.kind === 'success') return finalized;
	return {
		kind: 'rejected',
		rejection: classifySpacePlacementRejection(
			finalized.rejection,
			options.candidate,
			options.roomId,
		),
	};
}

/** Reclassify the compiler's placement issue with the pair of Space ids it names. */
function classifySpacePlacementRejection(
	rejection: PrecisionRejection,
	candidate: LayoutDocumentWallFirst,
	roomId: string,
): PrecisionRejection {
	// The acceptance compiler reports a placement conflict as
	// `space_outline_invalid` (its one outline gate); the same issue carries the
	// pair code this planner re-exposes so the editor can name the other Space.
	if (rejection.code !== 'geometry_invalid' && rejection.code !== 'space_outline_invalid') {
		return rejection;
	}
	const placement = spacePlacementIssues(candidate).find((issue) => issue.roomIds.includes(roomId));
	if (placement === undefined) return rejection;
	return {
		code: placement.code,
		message: placement.message,
		targetIds: [...placement.roomIds],
		...(rejection.issues === undefined ? {} : { issues: rejection.issues }),
	};
}
