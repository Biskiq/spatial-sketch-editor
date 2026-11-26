import type { LayoutVec2 } from '../../geometry/coordinates';
import { isClosedWall } from '../../wall/closed-wall';
import { compileWallFirstLayoutGeometry } from '../../geometry/compiler';
import { CURVE_ARC_LENGTH_TOLERANCE, cubicBezierPoint } from '../../geometry/curve';
import { hasBlockingLayoutIssues } from '../../geometry/validation';
import type { LayoutIdCapture } from '../../plan/id-capture';
import {
	LayoutIdCollisionError,
	allocateCapturedId,
	isLayoutIdCapture,
	layoutWorkingLevelIssue,
} from '../../plan/id-capture';
import { coincidesAsJunction } from '../../wall/junction-identity';
import { validateWallFirstOpeningSet } from '../../wall/opening-set';
import { carryRegionWallIntents } from '../region-validation';
import type {
	RoundOperationCorrespondence,
	RoundOperationJunctionCorrespondence,
	RoundOperationOpeningCorrespondence,
} from '../round-room';
import {
	certifyRoundRoom,
	enumerateClosedWallSafeCutStations,
	partitionClosedWallChainAtStations,
	roundRoomSeamJunctionId,
} from '../round-room';
import type { LayoutSurfaceLineage } from '../../plan/surface-reference';
import {
	normalizeLayoutSurfaceLineage,
	splitWallSurfaceLineage,
} from '../../plan/surface-reference';
import { wallCenterlineCubics, wallCubicChain } from '../../wall/centerline';
import { resolveWallCurveSplit, wallCurveChainLength } from '../../wall/curve-algebra';
import { validateWallFirstLayoutDocument } from '../../wall/codec';
import { validateWallFirstTopology } from '../../topology/wall-first';
import type { LayoutDocumentWallFirst, LayoutWall, LayoutWallOpening } from '../../wall/types';
import { validateWallFirstPortalRelations } from '../../wall/portals';

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
	extra: Omit<ReleaseRoundRoomRejection, 'code' | 'message'> = {},
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
	distance: number,
): LayoutVec2 | null {
	if (wall.centerline.kind === 'line') {
		const len = Math.hypot(endPoint[0] - startPoint[0], endPoint[1] - startPoint[1]);
		if (!(len > 0)) return null;
		const t = distance / len;
		return [
			startPoint[0] + (endPoint[0] - startPoint[0]) * t,
			startPoint[1] + (endPoint[1] - startPoint[1]) * t,
		];
	}
	const cubics = wallCenterlineCubics(wall.centerline, startPoint, endPoint, 'forward');
	if (distance <= 0) return [startPoint[0], startPoint[1]];
	const total = wallCurveChainLength({
		startPoint,
		endPoint,
		knots: wall.centerline.knots,
		spans: wall.centerline.spans,
	});
	if (distance >= total) return [endPoint[0], endPoint[1]];
	const res = resolveWallCurveSplit(
		{ startPoint, endPoint, knots: wall.centerline.knots, spans: wall.centerline.spans },
		distance,
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
 *  locus and clears `room.round`, keeping the seam Junction when unoccupied or
 *  choosing two deterministic solid-gap cuts and retiring the old seam Junction
 *  explicitly when a periodic Opening spans the seam.
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
			roomIds: [roomId],
		});
	}
	const room = document.rooms.find((candidate) => candidate.id === roomId);
	if (!room) {
		return rejectRelease('unknown_room', `Unknown room '${roomId}'`, { roomIds: [roomId] });
	}
	if (room.round === undefined) {
		return rejectRelease('not_round_room', `Room '${roomId}' is not a Round Room`, {
			roomIds: [roomId],
		});
	}

	const wallById = new Map(document.walls.map((w) => [w.id, w] as const));
	const seamJunctionId = roundRoomSeamJunctionId(room, wallById);
	if (!seamJunctionId) {
		return rejectRelease(
			'invalid_candidate_document',
			`Round Room '${roomId}' has an unresolvable seam Junction`,
			{ roomIds: [roomId] },
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
			}),
		};
		const validated = validateWallFirstLayoutDocument(candidate);
		if (!validated.success) {
			return rejectRelease(
				'invalid_candidate_document',
				validated.issues[0]?.message ?? 'Candidate document failed validation',
				{ roomIds: [roomId] },
			);
		}
		const compiled = compileWallFirstLayoutGeometry(validated.document);
		if (hasBlockingLayoutIssues(compiled.issues)) {
			return rejectRelease(
				'candidate_does_not_compile',
				compiled.issues[0]?.message ?? 'Candidate document does not compile',
				{ roomIds: [roomId] },
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
				openings: [],
			},
		};
	}

	// Isolated closed circle: certify first, then split into two open arcs.
	const cert = certifyRoundRoom(document, room);
	if (cert.kind === 'invalid') {
		return rejectRelease('invalid_candidate_document', cert.issue.message, { roomIds: [roomId] });
	}
	const closedWall = wallById.get(room.boundary[0]!.wallId)!;
	if (closedWall.centerline.kind !== 'cubic-chain') {
		return rejectRelease(
			'invalid_candidate_document',
			`Closed Wall '${closedWall.id}' must be a cubic-chain`,
			{
				roomIds: [roomId],
				wallIds: [closedWall.id],
			},
		);
	}
	const seamPoint = cert.certified.seamPoint;
	const closedChain = {
		startPoint: seamPoint,
		endPoint: seamPoint,
		knots: closedWall.centerline.knots,
		spans: closedWall.centerline.spans,
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
			return rejectRelease('captured_id_in_use', error.message, {
				roomIds: [roomId],
				wallIds: [closedWall.id],
			});
		}
		throw error;
	}

	const hostOpenings = document.openings.filter((o) => o.wallId === closedWall.id);

	// Helper to validate a candidate document through all canonical gates.
	const tryValidateCandidate = (
		candidate: LayoutDocumentWallFirst,
	): LayoutDocumentWallFirst | null => {
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
			lineage: splitWallSurfaceLineage(closedWall.id, secondWallId),
		});
		return norm.kind === 'ready' ? norm.lineage : null;
	};

	// Path A: seam unoccupied -> keep seamJunctionId, find one admissible opposite/solid cut.
	if (!search.seamOccupied) {
		let cutJunctionId: string;
		try {
			cutJunctionId = allocateCapturedId(
				takenJunctionIds,
				`${closedWall.id}:release-junction:1`,
				capture,
			);
		} catch (error) {
			if (error instanceof LayoutIdCollisionError) {
				return rejectRelease('captured_id_in_use', error.message, {
					roomIds: [roomId],
					wallIds: [closedWall.id],
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
				stations: [split],
			});
			if (segments.length !== 2) continue;
			const [segA, segB] = segments as [(typeof segments)[0], (typeof segments)[1]];

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
					openingCorr.push({
						openingId: opening.id,
						beforeWallId: closedWall.id,
						afterWallId: closedWall.id,
					});
				} else if (start >= split.distance - CURVE_ARC_LENGTH_TOLERANCE) {
					const offset = Math.max(0, start - split.distance);
					rehostedOpenings.push({ ...opening, wallId: secondWallId, offset });
					openingCorr.push({
						openingId: opening.id,
						beforeWallId: closedWall.id,
						afterWallId: secondWallId,
					});
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
				centerline: wallCubicChain(segA.knots, segA.spans),
			};
			const wallB: LayoutWall = {
				id: secondWallId,
				startJunctionId: cutJunctionId,
				endJunctionId: seamJunctionId,
				thickness: closedWall.thickness,
				height: closedWall.height,
				centerline: wallCubicChain(segB.knots, segB.spans),
				...(closedWall.name !== undefined ? { name: closedWall.name } : {}),
			};
			const candidate: LayoutDocumentWallFirst = {
				...document,
				junctions: [
					...document.junctions,
					{ id: cutJunctionId, point: [split.point[0], split.point[1]] },
				],
				walls: document.walls.flatMap((w) => (w.id === closedWall.id ? [wallA, wallB] : [w])),
				rooms: document.rooms.map((r) => {
					if (r.id !== roomId) return r;
					const { round: _cleared, ...rest } = r;
					return {
						...rest,
						boundary: [
							{ wallId: closedWall.id, direction: 'forward' },
							{ wallId: secondWallId, direction: 'forward' },
						],
					};
				}),
				regions: carryRegionWallIntents(
					document.regions,
					new Map([[closedWall.id, [closedWall.id, secondWallId]]]),
				),
				openings: rehostedOpenings,
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
					walls: [
						{
							kind: 'subdivision',
							sourceWallId: closedWall.id,
							fragmentWallIds: [closedWall.id, secondWallId],
						},
					],
					junctions: [
						{ kind: 'preserved', junctionId: seamJunctionId },
						{
							kind: 'born',
							junctionId: cutJunctionId,
							sourceWallId: closedWall.id,
							station: split.distance,
						},
					],
					openings: openingCorr,
				},
			};
		}
	}

	// Path B: seam occupied (or single-cut found none) -> check external references to old seam Junction,
	// then choose two solid cuts away from periodic Openings.
	const externalWall = document.walls.find(
		(w) =>
			w.id !== closedWall.id &&
			(w.startJunctionId === seamJunctionId || w.endJunctionId === seamJunctionId),
	);
	if (externalWall) {
		return rejectRelease(
			'seam_junction_referenced',
			`Cannot retire seam Junction '${seamJunctionId}' because Wall '${externalWall.id}' still references it`,
			{ roomIds: [roomId], wallIds: [externalWall.id], junctionIds: [seamJunctionId] },
		);
	}
	const externalSpace = document.rooms.find((r) =>
		r.virtualEdges.some(
			(e) => e.startJunctionId === seamJunctionId || e.endJunctionId === seamJunctionId,
		),
	);
	if (externalSpace) {
		return rejectRelease(
			'seam_junction_referenced',
			`Cannot retire seam Junction '${seamJunctionId}' because Space '${externalSpace.id}' virtual edge still references it`,
			{ roomIds: [roomId, externalSpace.id], junctionIds: [seamJunctionId] },
		);
	}

	let junction1Id: string;
	let junction2Id: string;
	let seamKnotId: string;
	try {
		junction1Id = allocateCapturedId(
			takenJunctionIds,
			`${closedWall.id}:release-junction:1`,
			capture,
		);
		junction2Id = allocateCapturedId(
			takenJunctionIds,
			`${closedWall.id}:release-junction:2`,
			capture,
		);
		seamKnotId = allocateCapturedId(existingKnotIds, `${closedWall.id}:seam-knot`, capture);
	} catch (error) {
		if (error instanceof LayoutIdCollisionError) {
			return rejectRelease('captured_id_in_use', error.message, {
				roomIds: [roomId],
				wallIds: [closedWall.id],
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
				stations: [split1, split2],
			});
			if (segments.length !== 3) continue;
			const [seg0, seg1, seg2] = segments as [
				(typeof segments)[0],
				(typeof segments)[1],
				(typeof segments)[2],
			];

			// Fragment W_2: J_1 -> J_2 (seg1).
			// Fragment W: J_2 -> J_1 (seg2 + seamKnot + seg0), crossing old station 0.
			const wall2Len = split2.distance - split1.distance;
			const wall1Len = totalLength - split2.distance + split1.distance;
			const wall1: LayoutWall = {
				...closedWall,
				startJunctionId: junction2Id,
				endJunctionId: junction1Id,
				centerline: wallCubicChain(
					[...seg2.knots, { id: seamKnotId, point: [seamPoint[0], seamPoint[1]] }, ...seg0.knots],
					[...seg2.spans, ...seg0.spans],
				),
			};
			const wall2: LayoutWall = {
				id: secondWallId,
				startJunctionId: junction1Id,
				endJunctionId: junction2Id,
				thickness: closedWall.thickness,
				height: closedWall.height,
				centerline: wallCubicChain(seg1.knots, seg1.spans),
				...(closedWall.name !== undefined ? { name: closedWall.name } : {}),
			};

			let openingFailed = false;
			const rehostedOpenings: LayoutWallOpening[] = [];
			const openingCorr: RoundOperationOpeningCorrespondence[] = [];

			const cutStrictlyInPeriodicInterval = (
				cut: number,
				oStart: number,
				oWidth: number,
			): boolean => {
				const d = (((cut - oStart) % totalLength) + totalLength) % totalLength;
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
					const rawOffset =
						(((oStart - split1.distance) % totalLength) + totalLength) % totalLength;
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
							Math.max(
								CURVE_ARC_LENGTH_TOLERANCE,
								32 * coordUlp(origPt[0]),
								32 * coordUlp(origPt[1]),
							)
					) {
						openingFailed = true;
						break;
					}
					rehostedOpenings.push({ ...opening, wallId: secondWallId, offset });
					openingCorr.push({
						openingId: opening.id,
						beforeWallId: closedWall.id,
						afterWallId: secondWallId,
					});
				} else {
					const rawOffset =
						(((oStart - split2.distance) % totalLength) + totalLength) % totalLength;
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
							Math.max(
								CURVE_ARC_LENGTH_TOLERANCE,
								32 * coordUlp(origPt[0]),
								32 * coordUlp(origPt[1]),
							)
					) {
						openingFailed = true;
						break;
					}
					rehostedOpenings.push({ ...opening, wallId: closedWall.id, offset });
					openingCorr.push({
						openingId: opening.id,
						beforeWallId: closedWall.id,
						afterWallId: closedWall.id,
					});
				}
			}
			if (openingFailed) continue;

			const candidate: LayoutDocumentWallFirst = {
				...document,
				junctions: [
					...document.junctions.filter((entry) => entry.id !== seamJunctionId),
					{ id: junction1Id, point: [split1.point[0], split1.point[1]] },
					{ id: junction2Id, point: [split2.point[0], split2.point[1]] },
				],
				walls: document.walls.flatMap((w) => (w.id === closedWall.id ? [wall1, wall2] : [w])),
				rooms: document.rooms.map((r) => {
					if (r.id !== roomId) return r;
					const { round: _cleared, ...rest } = r;
					return {
						...rest,
						boundary: [
							{ wallId: closedWall.id, direction: 'forward' },
							{ wallId: secondWallId, direction: 'forward' },
						],
					};
				}),
				regions: carryRegionWallIntents(
					document.regions,
					new Map([[closedWall.id, [closedWall.id, secondWallId]]]),
				),
				openings: rehostedOpenings,
			};
			const committed = tryValidateCandidate(candidate);
			if (!committed) continue;
			const surfaceLineage = normalizeLineage(committed);
			if (!surfaceLineage) continue;

			const junctionCorr: RoundOperationJunctionCorrespondence[] = [
				{ kind: 'retired', junctionId: seamJunctionId, after: null },
				{
					kind: 'born',
					junctionId: junction1Id,
					sourceWallId: closedWall.id,
					station: split1.distance,
				},
				{
					kind: 'born',
					junctionId: junction2Id,
					sourceWallId: closedWall.id,
					station: split2.distance,
				},
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
					walls: [
						{
							kind: 'subdivision',
							sourceWallId: closedWall.id,
							fragmentWallIds: [closedWall.id, secondWallId],
						},
					],
					junctions: junctionCorr,
					openings: openingCorr,
				},
			};
		}
	}

	return rejectRelease(
		'no_admissible_release_cuts',
		`No admissible cut pair can release Round Room '${roomId}' without intersecting hosted Openings`,
		{
			roomIds: [roomId],
			wallIds: [closedWall.id],
			openingIds: hostOpenings.map((o) => o.id),
		},
	);
}
