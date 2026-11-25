/**
 * `layout-round-ops.ts` — C2 Round Room planners: Release round and whole-radius resize.
 *
 * Both planners consume C1's `certifyRoundRoom` and `buildRoundRoomGeometryFromCertified`,
 * preserve exact authored IDs / captures, emit S5a `LayoutSurfaceLineage` and V1
 * `carryRegionWallIntents`, and run the full canonical validation + compile gates.
 */
import type { LayoutVec2 } from './layout-coordinates';
import { isClosedWall } from './layout-closed-wall';
import { canonicalBoundaryCycleKey, extractBoundaryCandidateFaces } from './layout-face-extraction';
import { compileWallFirstLayoutGeometry } from './layout-geometry';
import { CURVE_ARC_LENGTH_TOLERANCE, cubicBezierPoint } from './layout-geometry-curve';
import { exceedsLayoutDimension, LAYOUT_DIMENSION_LIMIT_MESSAGE } from './layout-geometry-limits';
import type { LayoutGeometryIssue } from './layout-geometry-types';
import { hasBlockingLayoutIssues } from './layout-geometry-validation';
import {
	allocateCapturedId,
	isLayoutIdCapture,
	LayoutIdCollisionError,
	layoutWorkingLevelIssue,
	type LayoutIdCapture
} from './layout-id-capture';
import type { LayoutDocumentIssue } from './layout-issue';
import { coincidesAsJunction } from './layout-junction-identity';
import { validateWallFirstOpeningSet } from './layout-opening-set';
import { carryRegionWallIntents } from './layout-region-validation';
import {
	reconcileRooms,
	type ComponentLineage,
	type RoomIdAllocator
} from './layout-room-reconciliation';
import {
	buildRoundRoomGeometryFromCertified,
	certifyRoundRoom,
	enumerateClosedWallSafeCutStations,
	partitionClosedWallChainAtStations,
	roundRoomSeamJunctionId,
	type RoundOperationCorrespondence,
	type RoundOperationJunctionCorrespondence,
	type RoundOperationOpeningCorrespondence
} from './layout-round-room';
import { spacePlacementIssues } from './layout-space-placement';
import {
	normalizeLayoutSurfaceLineage,
	splitWallSurfaceLineage,
	type LayoutSurfaceLineage
} from './layout-surface-reference';
import { wallCenterlineCubics, wallCubicChain } from './layout-wall-centerline';
import {
	resolveWallCurveSplit,
	wallCurveChainLength,
} from './layout-wall-curve-algebra';
import { validateWallFirstLayoutDocument } from './layout-wall-first-codec';
import { validateWallFirstTopology } from './layout-wall-first-precision';
import type {
	LayoutDocumentWallFirst,
	LayoutJunction,
	LayoutWall,
	LayoutWallOpening
} from './layout-wall-first-types';
import { validateWallFirstPortalRelations } from './layout-wall-portals';

// ---------------------------------------------------------------------------
// Release round
// ---------------------------------------------------------------------------

export type ReleaseRoundRoomRejectionCode =
	| 'unknown_room'
	| 'not_round_room'
	| 'invalid_value'
	| 'seam_junction_referenced'
	| 'no_admissible_release_cuts'
	| 'captured_id_in_use'
	| 'invalid_candidate_document'
	| 'candidate_does_not_compile';

export type ReleaseRoundRoomRejection = {
	readonly code: ReleaseRoundRoomRejectionCode;
	readonly message: string;
	readonly roomIds?: readonly string[];
	readonly wallIds?: readonly string[];
	readonly junctionIds?: readonly string[];
	readonly openingIds?: readonly string[];
};

export type ReleaseRoundRoomPlan =
	| {
			readonly kind: 'success';
			readonly document: LayoutDocumentWallFirst;
			readonly roomId: string;
			readonly mode: 'cleared-ring' | 'split-closed-circle';
			readonly createdWallIds: readonly string[];
			readonly createdJunctionIds: readonly string[];
			readonly retiredJunctionIds: readonly string[];
			readonly createdSeamKnotId?: string;
			readonly surfaceLineage: LayoutSurfaceLineage;
			readonly correspondence: RoundOperationCorrespondence;
	  }
	| {
			readonly kind: 'rejected';
			readonly rejection: ReleaseRoundRoomRejection;
	  };

function rejectRelease(
	code: ReleaseRoundRoomRejectionCode,
	message: string,
	extra: Omit<ReleaseRoundRoomRejection, 'code' | 'message'> = {}
): ReleaseRoundRoomPlan {
	return { kind: 'rejected', rejection: { code, message, ...extra } };
}

function coordUlp(x: number): number {
	return Math.max(1, Math.abs(x)) * Number.EPSILON;
}

function pointAtWallDistance(
	wall: LayoutWall,
	startPoint: LayoutVec2,
	endPoint: LayoutVec2,
	distance: number
): LayoutVec2 | null {
	if (wall.centerline.kind === 'line') {
		const len = Math.hypot(endPoint[0] - startPoint[0], endPoint[1] - startPoint[1]);
		if (!(len > 0)) return null;
		const t = distance / len;
		return [startPoint[0] + (endPoint[0] - startPoint[0]) * t, startPoint[1] + (endPoint[1] - startPoint[1]) * t];
	}
	const cubics = wallCenterlineCubics(wall.centerline, startPoint, endPoint, 'forward');
	if (distance <= 0) return [startPoint[0], startPoint[1]];
	const total = wallCurveChainLength({
		startPoint,
		endPoint,
		knots: wall.centerline.knots,
		spans: wall.centerline.spans
	});
	if (distance >= total) return [endPoint[0], endPoint[1]];
	const res = resolveWallCurveSplit(
		{ startPoint, endPoint, knots: wall.centerline.knots, spans: wall.centerline.spans },
		distance
	);
	if (res.kind === 'resolved') return res.result.point;
	return cubicBezierPoint(cubics[0]!, 0);
}

/**
 * Release a Round Room into ordinary open-arc Walls (or clear `round` on an
 * already-split open-arc ring).
 *
 * - Multi-Wall ring: clears `room.round` only.
 * - Isolated closed circle: converts to two ordinary open arcs of the same
 *   locus and clears `room.round`, keeping the seam Junction when unoccupied or
 *   choosing two deterministic solid-gap cuts and retiring the old seam Junction
 *   explicitly when a periodic Opening spans the seam.
 */
export function planReleaseRoundRoom(options: {
	readonly document: LayoutDocumentWallFirst;
	readonly roomId: string;
	readonly capture: LayoutIdCapture;
	readonly levelId: string;
}): ReleaseRoundRoomPlan {
	const { document, roomId, capture, levelId } = options;
	const levelIssue = layoutWorkingLevelIssue(document, levelId);
	if (levelIssue !== null) {
		return rejectRelease('invalid_value', levelIssue, { roomIds: [roomId] });
	}
	if (!isLayoutIdCapture(capture)) {
		return rejectRelease('invalid_value', 'Release round requires a valid identity capture', {
			roomIds: [roomId]
		});
	}
	const room = document.rooms.find((candidate) => candidate.id === roomId);
	if (!room) {
		return rejectRelease('unknown_room', `Unknown room '${roomId}'`, { roomIds: [roomId] });
	}
	if (room.round === undefined) {
		return rejectRelease('not_round_room', `Room '${roomId}' is not a Round Room`, {
			roomIds: [roomId]
		});
	}

	const wallById = new Map(document.walls.map((w) => [w.id, w] as const));
	const seamJunctionId = roundRoomSeamJunctionId(room, wallById);
	if (!seamJunctionId) {
		return rejectRelease(
			'invalid_candidate_document',
			`Round Room '${roomId}' has an unresolvable seam Junction`,
			{ roomIds: [roomId] }
		);
	}

	// Multi-Wall open-arc ring: clear the Room field only.
	if (room.boundary.length > 1 || !isClosedWall(wallById.get(room.boundary[0]!.wallId)!)) {
		const candidate: LayoutDocumentWallFirst = {
			...document,
			rooms: document.rooms.map((entry) => {
				if (entry.id !== roomId) return entry;
				const { round: _cleared, ...rest } = entry;
				return rest;
			})
		};
		const validated = validateWallFirstLayoutDocument(candidate);
		if (!validated.success) {
			return rejectRelease(
				'invalid_candidate_document',
				validated.issues[0]?.message ?? 'Candidate document failed validation',
				{ roomIds: [roomId] }
			);
		}
		const compiled = compileWallFirstLayoutGeometry(validated.document);
		if (hasBlockingLayoutIssues(compiled.issues)) {
			return rejectRelease(
				'candidate_does_not_compile',
				compiled.issues[0]?.message ?? 'Candidate document does not compile',
				{ roomIds: [roomId] }
			);
		}
		const junctionIds = new Set<string>();
		for (const ref of room.boundary) {
			const w = wallById.get(ref.wallId);
			if (w) {
				junctionIds.add(w.startJunctionId);
				junctionIds.add(w.endJunctionId);
			}
		}
		return {
			kind: 'success',
			document: validated.document,
			roomId,
			mode: 'cleared-ring',
			createdWallIds: [],
			createdJunctionIds: [],
			retiredJunctionIds: [],
			surfaceLineage: [],
			correspondence: {
				rooms: [{ roomId, status: 'cleared-round' }],
				walls: [],
				junctions: [...junctionIds].map((id) => ({ kind: 'preserved', junctionId: id })),
				openings: []
			}
		};
	}

	// Isolated closed circle: certify first, then split into two open arcs.
	const cert = certifyRoundRoom(document, room);
	if (cert.kind === 'invalid') {
		return rejectRelease('invalid_candidate_document', cert.issue.message, { roomIds: [roomId] });
	}
	const closedWall = wallById.get(room.boundary[0]!.wallId)!;
	if (closedWall.centerline.kind !== 'cubic-chain') {
		return rejectRelease('invalid_candidate_document', `Closed Wall '${closedWall.id}' must be a cubic-chain`, {
			roomIds: [roomId],
			wallIds: [closedWall.id]
		});
	}
	const seamPoint = cert.certified.seamPoint;
	const closedChain = {
		startPoint: seamPoint,
		endPoint: seamPoint,
		knots: closedWall.centerline.knots,
		spans: closedWall.centerline.spans
	};
	const totalLength = wallCurveChainLength(closedChain);
	const search = enumerateClosedWallSafeCutStations(document.openings, closedWall.id, totalLength);

	const takenWallIds = new Set(document.walls.map((w) => w.id));
	const takenJunctionIds = new Set(document.junctions.map((j) => j.id));
	const existingKnotIds = new Set(closedWall.centerline.knots.map((k) => k.id));

	let secondWallId: string;
	try {
		secondWallId = allocateCapturedId(takenWallIds, `${closedWall.id}:release-wall:1`, capture);
	} catch (error) {
		if (error instanceof LayoutIdCollisionError) {
			return rejectRelease('captured_id_in_use', error.message, { roomIds: [roomId], wallIds: [closedWall.id] });
		}
		throw error;
	}

	const hostOpenings = document.openings.filter((o) => o.wallId === closedWall.id);

	// Helper to validate a candidate document through all canonical gates.
	const tryValidateCandidate = (candidate: LayoutDocumentWallFirst): LayoutDocumentWallFirst | null => {
		if (validateWallFirstOpeningSet(candidate).length > 0) return null;
		if (validateWallFirstPortalRelations(candidate).length > 0) return null;
		if (validateWallFirstTopology(candidate, { openingSet: 'defer' }) !== undefined) return null;
		const validated = validateWallFirstLayoutDocument(candidate);
		if (!validated.success) return null;
		const compiled = compileWallFirstLayoutGeometry(validated.document);
		if (hasBlockingLayoutIssues(compiled.issues)) return null;
		return validated.document;
	};

	const normalizeLineage = (afterLayout: LayoutDocumentWallFirst): LayoutSurfaceLineage | null => {
		const norm = normalizeLayoutSurfaceLineage({
			beforeLayout: document,
			afterLayout,
			lineage: splitWallSurfaceLineage(closedWall.id, secondWallId)
		});
		return norm.kind === 'ready' ? norm.lineage : null;
	};

	// Path A: seam unoccupied -> keep seamJunctionId, find one admissible opposite/solid cut.
	if (!search.seamOccupied) {
		let cutJunctionId: string;
		try {
			cutJunctionId = allocateCapturedId(takenJunctionIds, `${closedWall.id}:release-junction:1`, capture);
		} catch (error) {
			if (error instanceof LayoutIdCollisionError) {
				return rejectRelease('captured_id_in_use', error.message, {
					roomIds: [roomId],
					wallIds: [closedWall.id]
				});
			}
			throw error;
		}

		for (const candidateStation of search.candidates) {
			const resolved = resolveWallCurveSplit(closedChain, candidateStation);
			if (resolved.kind !== 'resolved') continue;
			const split = resolved.result;
			if (coincidesAsJunction(split.point, seamPoint)) continue;

			const segments = partitionClosedWallChainAtStations({
				closedWall,
				seamPoint,
				totalLength,
				stations: [split]
			});
			if (segments.length !== 2) continue;
			const [segA, segB] = segments as [typeof segments[0], typeof segments[1]];

			let openingBlocked = false;
			const rehostedOpenings: LayoutWallOpening[] = [];
			const openingCorr: RoundOperationOpeningCorrespondence[] = [];
			for (const opening of document.openings) {
				if (opening.wallId !== closedWall.id) {
					rehostedOpenings.push(opening);
					continue;
				}
				const rawStart = ((opening.offset % totalLength) + totalLength) % totalLength;
				const start = totalLength - rawStart <= CURVE_ARC_LENGTH_TOLERANCE ? 0 : rawStart;
				const end = start + opening.width;
				if (end <= split.distance + CURVE_ARC_LENGTH_TOLERANCE) {
					rehostedOpenings.push({ ...opening, wallId: closedWall.id, offset: start });
					openingCorr.push({ openingId: opening.id, beforeWallId: closedWall.id, afterWallId: closedWall.id });
				} else if (start >= split.distance - CURVE_ARC_LENGTH_TOLERANCE) {
					const offset = Math.max(0, start - split.distance);
					rehostedOpenings.push({ ...opening, wallId: secondWallId, offset });
					openingCorr.push({ openingId: opening.id, beforeWallId: closedWall.id, afterWallId: secondWallId });
				} else {
					openingBlocked = true;
					break;
				}
			}
			if (openingBlocked) continue;

			const wallA: LayoutWall = {
				...closedWall,
				startJunctionId: seamJunctionId,
				endJunctionId: cutJunctionId,
				centerline: wallCubicChain(segA.knots, segA.spans)
			};
			const wallB: LayoutWall = {
				id: secondWallId,
				startJunctionId: cutJunctionId,
				endJunctionId: seamJunctionId,
				thickness: closedWall.thickness,
				height: closedWall.height,
				centerline: wallCubicChain(segB.knots, segB.spans),
				...(closedWall.name !== undefined ? { name: closedWall.name } : {})
			};
			const candidate: LayoutDocumentWallFirst = {
				...document,
				junctions: [...document.junctions, { id: cutJunctionId, point: [split.point[0], split.point[1]] }],
				walls: document.walls.flatMap((w) => (w.id === closedWall.id ? [wallA, wallB] : [w])),
				rooms: document.rooms.map((r) => {
					if (r.id !== roomId) return r;
					const { round: _cleared, ...rest } = r;
					return {
						...rest,
						boundary: [
							{ wallId: closedWall.id, direction: 'forward' },
							{ wallId: secondWallId, direction: 'forward' }
						]
					};
				}),
				regions: carryRegionWallIntents(
					document.regions,
					new Map([[closedWall.id, [closedWall.id, secondWallId]]])
				),
				openings: rehostedOpenings
			};
			const committed = tryValidateCandidate(candidate);
			if (!committed) continue;
			const surfaceLineage = normalizeLineage(committed);
			if (!surfaceLineage) continue;

			return {
				kind: 'success',
				document: committed,
				roomId,
				mode: 'split-closed-circle',
				createdWallIds: [secondWallId],
				createdJunctionIds: [cutJunctionId],
				retiredJunctionIds: [],
				surfaceLineage,
				correspondence: {
					rooms: [{ roomId, status: 'cleared-round' }],
					walls: [{ kind: 'subdivision', sourceWallId: closedWall.id, fragmentWallIds: [closedWall.id, secondWallId] }],
					junctions: [
						{ kind: 'preserved', junctionId: seamJunctionId },
						{ kind: 'born', junctionId: cutJunctionId, sourceWallId: closedWall.id, station: split.distance }
					],
					openings: openingCorr
				}
			};
		}
	}

	// Path B: seam occupied (or single-cut found none) -> check external references to old seam Junction,
	// then choose two solid cuts away from periodic Openings.
	const externalWall = document.walls.find(
		(w) =>
			w.id !== closedWall.id &&
			(w.startJunctionId === seamJunctionId || w.endJunctionId === seamJunctionId)
	);
	if (externalWall) {
		return rejectRelease(
			'seam_junction_referenced',
			`Cannot retire seam Junction '${seamJunctionId}' because Wall '${externalWall.id}' still references it`,
			{ roomIds: [roomId], wallIds: [externalWall.id], junctionIds: [seamJunctionId] }
		);
	}
	const externalSpace = document.rooms.find((r) =>
		r.virtualEdges.some((e) => e.startJunctionId === seamJunctionId || e.endJunctionId === seamJunctionId)
	);
	if (externalSpace) {
		return rejectRelease(
			'seam_junction_referenced',
			`Cannot retire seam Junction '${seamJunctionId}' because Space '${externalSpace.id}' virtual edge still references it`,
			{ roomIds: [roomId, externalSpace.id], junctionIds: [seamJunctionId] }
		);
	}

	let junction1Id: string;
	let junction2Id: string;
	let seamKnotId: string;
	try {
		junction1Id = allocateCapturedId(takenJunctionIds, `${closedWall.id}:release-junction:1`, capture);
		junction2Id = allocateCapturedId(takenJunctionIds, `${closedWall.id}:release-junction:2`, capture);
		seamKnotId = allocateCapturedId(existingKnotIds, `${closedWall.id}:seam-knot`, capture);
	} catch (error) {
		if (error instanceof LayoutIdCollisionError) {
			return rejectRelease('captured_id_in_use', error.message, {
				roomIds: [roomId],
				wallIds: [closedWall.id]
			});
		}
		throw error;
	}

	for (let i = 0; i < search.candidates.length; i += 1) {
		for (let j = i + 1; j < search.candidates.length; j += 1) {
			const rawA = search.candidates[i]!;
			const rawB = search.candidates[j]!;
			const [sA, sB] = rawA < rawB ? [rawA, rawB] : [rawB, rawA];
			const res1 = resolveWallCurveSplit(closedChain, sA);
			const res2 = resolveWallCurveSplit(closedChain, sB);
			if (res1.kind !== 'resolved' || res2.kind !== 'resolved') continue;
			const split1 = res1.result;
			const split2 = res2.result;
			if (!(split1.distance < split2.distance - CURVE_ARC_LENGTH_TOLERANCE)) continue;
			if (
				coincidesAsJunction(split1.point, split2.point) ||
				coincidesAsJunction(split1.point, seamPoint) ||
				coincidesAsJunction(split2.point, seamPoint)
			) {
				continue;
			}

			const segments = partitionClosedWallChainAtStations({
				closedWall,
				seamPoint,
				totalLength,
				stations: [split1, split2]
			});
			if (segments.length !== 3) continue;
			const [seg0, seg1, seg2] = segments as [
				typeof segments[0],
				typeof segments[1],
				typeof segments[2]
			];

			// Fragment W_2: J_1 -> J_2 (seg1).
			// Fragment W:   J_2 -> J_1 (seg2 + seamKnot + seg0), crossing old station 0.
			const wall2Len = split2.distance - split1.distance;
			const wall1Len = (totalLength - split2.distance) + split1.distance;
			const wall1: LayoutWall = {
				...closedWall,
				startJunctionId: junction2Id,
				endJunctionId: junction1Id,
				centerline: wallCubicChain(
					[...seg2.knots, { id: seamKnotId, point: [seamPoint[0], seamPoint[1]] }, ...seg0.knots],
					[...seg2.spans, ...seg0.spans]
				)
			};
			const wall2: LayoutWall = {
				id: secondWallId,
				startJunctionId: junction1Id,
				endJunctionId: junction2Id,
				thickness: closedWall.thickness,
				height: closedWall.height,
				centerline: wallCubicChain(seg1.knots, seg1.spans),
				...(closedWall.name !== undefined ? { name: closedWall.name } : {})
			};

			let openingFailed = false;
			const rehostedOpenings: LayoutWallOpening[] = [];
			const openingCorr: RoundOperationOpeningCorrespondence[] = [];

			const cutStrictlyInPeriodicInterval = (cut: number, oStart: number, oWidth: number): boolean => {
				const d = ((cut - oStart) % totalLength + totalLength) % totalLength;
				return d > CURVE_ARC_LENGTH_TOLERANCE && d < oWidth - CURVE_ARC_LENGTH_TOLERANCE;
			};

			for (const opening of document.openings) {
				if (opening.wallId !== closedWall.id) {
					rehostedOpenings.push(opening);
					continue;
				}
				const rawStart = ((opening.offset % totalLength) + totalLength) % totalLength;
				const oStart = totalLength - rawStart <= CURVE_ARC_LENGTH_TOLERANCE ? 0 : rawStart;
				if (
					cutStrictlyInPeriodicInterval(split1.distance, oStart, opening.width) ||
					cutStrictlyInPeriodicInterval(split2.distance, oStart, opening.width)
				) {
					openingFailed = true;
					break;
				}
				const mid = (oStart + opening.width * 0.5) % totalLength;
				const onWall2 = mid > split1.distance && mid < split2.distance;
				if (onWall2) {
					const rawOffset = ((oStart - split1.distance) % totalLength + totalLength) % totalLength;
					const offset = totalLength - rawOffset <= CURVE_ARC_LENGTH_TOLERANCE ? 0 : rawOffset;
					if (offset + opening.width > wall2Len + CURVE_ARC_LENGTH_TOLERANCE) {
						openingFailed = true;
						break;
					}
					const origPt = pointAtWallDistance(closedWall, seamPoint, seamPoint, oStart);
					const newPt = pointAtWallDistance(wall2, split1.point, split2.point, offset);
					if (
						!origPt ||
						!newPt ||
						Math.hypot(origPt[0] - newPt[0], origPt[1] - newPt[1]) >
							Math.max(CURVE_ARC_LENGTH_TOLERANCE, 32 * coordUlp(origPt[0]), 32 * coordUlp(origPt[1]))
					) {
						openingFailed = true;
						break;
					}
					rehostedOpenings.push({ ...opening, wallId: secondWallId, offset });
					openingCorr.push({ openingId: opening.id, beforeWallId: closedWall.id, afterWallId: secondWallId });
				} else {
					const rawOffset = ((oStart - split2.distance) % totalLength + totalLength) % totalLength;
					const offset = totalLength - rawOffset <= CURVE_ARC_LENGTH_TOLERANCE ? 0 : rawOffset;
					if (offset + opening.width > wall1Len + CURVE_ARC_LENGTH_TOLERANCE) {
						openingFailed = true;
						break;
					}
					const origPt = pointAtWallDistance(closedWall, seamPoint, seamPoint, oStart);
					const newPt = pointAtWallDistance(wall1, split2.point, split1.point, offset);
					if (
						!origPt ||
						!newPt ||
						Math.hypot(origPt[0] - newPt[0], origPt[1] - newPt[1]) >
							Math.max(CURVE_ARC_LENGTH_TOLERANCE, 32 * coordUlp(origPt[0]), 32 * coordUlp(origPt[1]))
					) {
						openingFailed = true;
						break;
					}
					rehostedOpenings.push({ ...opening, wallId: closedWall.id, offset });
					openingCorr.push({ openingId: opening.id, beforeWallId: closedWall.id, afterWallId: closedWall.id });
				}
			}
			if (openingFailed) continue;

			const candidate: LayoutDocumentWallFirst = {
				...document,
				junctions: [
					...document.junctions.filter((entry) => entry.id !== seamJunctionId),
					{ id: junction1Id, point: [split1.point[0], split1.point[1]] },
					{ id: junction2Id, point: [split2.point[0], split2.point[1]] }
				],
				walls: document.walls.flatMap((w) => (w.id === closedWall.id ? [wall1, wall2] : [w])),
				rooms: document.rooms.map((r) => {
					if (r.id !== roomId) return r;
					const { round: _cleared, ...rest } = r;
					return {
						...rest,
						boundary: [
							{ wallId: closedWall.id, direction: 'forward' },
							{ wallId: secondWallId, direction: 'forward' }
						]
					};
				}),
				regions: carryRegionWallIntents(
					document.regions,
					new Map([[closedWall.id, [closedWall.id, secondWallId]]])
				),
				openings: rehostedOpenings
			};
			const committed = tryValidateCandidate(candidate);
			if (!committed) continue;
			const surfaceLineage = normalizeLineage(committed);
			if (!surfaceLineage) continue;

			const junctionCorr: RoundOperationJunctionCorrespondence[] = [
				{ kind: 'retired', junctionId: seamJunctionId, after: null },
				{ kind: 'born', junctionId: junction1Id, sourceWallId: closedWall.id, station: split1.distance },
				{ kind: 'born', junctionId: junction2Id, sourceWallId: closedWall.id, station: split2.distance }
			];

			return {
				kind: 'success',
				document: committed,
				roomId,
				mode: 'split-closed-circle',
				createdWallIds: [secondWallId],
				createdJunctionIds: [junction1Id, junction2Id],
				retiredJunctionIds: [seamJunctionId],
				createdSeamKnotId: seamKnotId,
				surfaceLineage,
				correspondence: {
					rooms: [{ roomId, status: 'cleared-round' }],
					walls: [{ kind: 'subdivision', sourceWallId: closedWall.id, fragmentWallIds: [closedWall.id, secondWallId] }],
					junctions: junctionCorr,
					openings: openingCorr
				}
			};
		}
	}

	return rejectRelease(
		'no_admissible_release_cuts',
		`No admissible cut pair can release Round Room '${roomId}' without intersecting hosted Openings`,
		{
			roomIds: [roomId],
			wallIds: [closedWall.id],
			openingIds: hostOpenings.map((o) => o.id)
		}
	);
}

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
