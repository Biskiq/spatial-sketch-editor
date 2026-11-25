import type { WallFirstOpPlan, WallFirstOpRejection } from './contracts';
import { carryRegionWallIntents } from '../../room/region';
import type { LayoutDocumentWallFirst, LayoutWall, LayoutWallFirstRoom, LayoutWallOpening } from '../types';
import { extractBoundaryCandidateFaces } from '../../geometry/face-extraction';
import { buildCorrespondenceComponents } from '../../room/reconciliation-correspondence';
import { createRoomBoundaryLookup, interiorWitness, roomBoundaryPolygon } from '../../room/reconciliation-boundary';
import { reconcileRooms } from '../../room/reconciliation';
import type { SpaceRetirement } from '../../room/reconciliation-types';
import type { LayoutVec2 } from '../../geometry/coordinates';
import { CURVE_ARC_LENGTH_TOLERANCE } from '../../geometry/curve';
import { validateWallFirstOpeningSet } from '../opening-set';
import { buildClosedWallCircleCenterlineFromRay } from '../closed-wall';
import type { RoundOperationCorrespondence, RoundOperationJunctionCorrespondence, RoundOperationOpeningCorrespondence, RoundOperationWallCorrespondence } from '../../room/round-room';
import { certifyRoundRoom } from '../../room/round-room';
import type { LayoutSurfaceLineage } from '../../plan/surface-reference';
import { normalizeLayoutSurfaceLineage, repackWallSurfaceLineage, roomSurfaceLineage } from '../../plan/surface-reference';
import { wallCurveChainLength } from '../curve-algebra';
import type { LayoutIdCapture } from '../../plan/id-capture';
import { LayoutIdCollisionError, layoutWorkingLevelIssue } from '../../plan/id-capture';
import { createAuthoringRoomAllocator, validateAndCompile } from './birth';

/**
 * Shared Wall-removal pipeline: delete a SET of physical
 * Walls atomically. `planDeleteWall` (one Wall) and `planRemoveRoom` (a
 * Room's exclusive enclosure Walls) both ride this one authority — never a
 * forked pipeline.
 *
 * Deleting a physical Wall is a topology-changing operation, never a direct
 * `walls` splice: the candidate graph (Wall removed, hosted Openings removed
 * atomically, Junction cleanup scoped to the deleted Wall's own
 * start/end Junctions — an endpoint is pruned only when no surviving Wall
 * references it, and pre-existing orphan Junctions elsewhere are untouched)
 * runs face extraction + P23.8 correspondence reconciliation + the final
 * canonical gates, exactly like the chain engine. The
 * deterministic reconciliation result is accepted as-is — deletion is not
 * intrinsically a "merge Rooms" command:
 *
 * - shared boundary Wall between two Rooms whose deletion yields one valid
 *   enclosed face → the normal 2→1 merge path;
 * - outer boundary Wall of an enclosed Room → the enclosure opens and the
 *   affected Room retires through normal reconciliation;
 * - roomless / partition Wall → clean removal with existing Room topology
 *   and identities unchanged.
 *
 * Portal relations remap/clear per the existing P23.8 portal contract inside
 * reconciliation (one vanished endpoint beside a surviving one rejects
 * rather than guessing). Ambiguous or unsupported topology rejects atomically
 * with zero history. One plan = one history entry at the caller. Post-delete
 * selection is the caller's fixed policy (canonical selection becomes
 * `none`); this planner owns document state only.
 */
export function planWallRemovalSet(
	document: LayoutDocumentWallFirst,
	wallIds: readonly string[],
	capture: LayoutIdCapture,
	options: {
		invalidOutline: 'retire' | 'reject';
		retireRoomIds?: readonly string[];
	}
): WallFirstOpPlan {
	const reject = (rejection: WallFirstOpRejection): WallFirstOpPlan => ({ kind: 'rejected', rejection });
	const removalSet = new Set(wallIds);
	const removedWalls = document.walls.filter((wall) => removalSet.has(wall.id));

	// --- candidate graph ------------------------------------------------------
	// Hosted Openings are single-host records: they go away atomically with
	// their Wall (never orphaned, never re-hosted).
	const candidate: LayoutDocumentWallFirst = {
		...document,
		walls: document.walls.filter((wall) => !removalSet.has(wall.id)),
		regions: carryRegionWallIntents(document.regions, new Map(wallIds.map((id) => [id, []]))),
		openings: document.openings.filter((opening) => !removalSet.has(opening.wallId))
	};
	// Junction cleanup is deliberately DEFERRED until after reconciliation: a
	// carried open Space keeps an erased Wall's end Junction as a virtual-edge
	// anchor, so the reference set is only complete once the final Rooms are
	// known (I8). A pre-existing unreferenced Junction elsewhere is untouched.
	const removedEndpointIds = new Set<string>();
	for (const wall of removedWalls) {
		removedEndpointIds.add(wall.startJunctionId);
		removedEndpointIds.add(wall.endJunctionId);
	}

	// --- room reconciliation -------------------------------------------------
	// Same correspondence as the chain engine and the role change: predecessor
	// polygons/witnesses come from the BASELINE rooms, components join
	// predecessor rooms with candidate faces, and reconcileRooms owns
	// preservation/merge/retirement. A roomless/partition delete reconciles
	// nothing (no faces, no rooms) and leaves Room topology untouched.
	let lineage: Array<{ faceKey: string; roomId: string; kind: 'created' }> = [];
	let retiredRoomIds: readonly string[] = [];
	let spaceRetirements: readonly SpaceRetirement[] = [];
	let surfaceLineage: LayoutSurfaceLineage = [];
	const extraction = extractBoundaryCandidateFaces(candidate);
	if (extraction.faces.length > 0 || document.rooms.length > 0) {
		const predecessorPolygons = new Map<string, readonly LayoutVec2[]>();
		const predecessorWitnesses = new Map<string, LayoutVec2>();
		const boundaryLookup = createRoomBoundaryLookup(document);
		for (const room of document.rooms) {
			const polygon = roomBoundaryPolygon(document, room.id, boundaryLookup);
			if (!polygon) {
				return reject({
					code: 'room_reconciliation_rejected',
					message: `Predecessor room '${room.id}' has an unresolvable boundary`,
					roomIds: [room.id]
				});
			}
			predecessorPolygons.set(room.id, polygon);
			predecessorWitnesses.set(room.id, interiorWitness(polygon));
		}
		const components = buildCorrespondenceComponents({
			faces: extraction.faces,
			predecessorRoomIds: document.rooms.map((room) => room.id),
			predecessorWitnesses,
			predecessorPolygons,
			candidateDocument: candidate,
			baselineRooms: document.rooms
		});
		const result = reconcileRooms({
			baseline: document,
			candidateDocument: candidate,
			extraction,
			components,
			predecessorWitnesses,
			predecessorPolygons,
			spacePolicy: {
				removedWalls: [...removalSet],
				...(options.retireRoomIds ? { retireRoomIds: options.retireRoomIds } : {}),
				invalidOutline: options.invalidOutline
			},
			allocator: createAuthoringRoomAllocator(capture)
		});
		if ('rejection' in result) {
			return reject({
				code:
					result.rejection.code === 'space_outline_invalid'
						? 'space_outline_invalid'
						: 'room_reconciliation_rejected',
				message: result.rejection.message,
				...(result.rejection.roomIds ? { roomIds: result.rejection.roomIds } : {}),
				...(result.rejection.faceKey ? { faceKey: result.rejection.faceKey } : {})
			});
		}
		candidate.rooms = result.document.rooms;
		candidate.objects = result.document.objects;
		// The reconciliation's portal remap runs over the candidate openings —
		// the deleted Wall's own hosted Openings are already gone, so only
		// surviving walls' relations participate.
		candidate.openings = result.document.openings;
		lineage = result.lineage
			.filter((record) => record.kind === 'created')
			.map((record) => ({ faceKey: record.faceKey, roomId: record.roomId, kind: 'created' as const }));
		retiredRoomIds = [...result.retiredRoomIds];
		spaceRetirements = result.spaceRetirements;
		surfaceLineage = roomSurfaceLineage(result.lineage);
	}

	// --- C2 automatic lossless repack on last external detach ----------------
	// A Round Room that was externally attached in the baseline and now has zero
	// outside Wall incidence repacks into one canonical 16-span closed Wall.
	// Detached enclosure copies (zero outside incidence in baseline) never repack.
	const repackedRoundRoomIds: string[] = [];
	const roundWallCorr: RoundOperationWallCorrespondence[] = [];
	const roundJunctionCorr: RoundOperationJunctionCorrespondence[] = [];
	const roundOpeningCorr: RoundOperationOpeningCorrespondence[] = [];
	const roundRoomOutsideWallIds = (doc: LayoutDocumentWallFirst, room: LayoutWallFirstRoom): string[] => {
		const ringWallIds = new Set(room.boundary.map((ref) => ref.wallId));
		const rimJunctionIds = new Set<string>();
		for (const wall of doc.walls) {
			if (!ringWallIds.has(wall.id)) continue;
			rimJunctionIds.add(wall.startJunctionId);
			rimJunctionIds.add(wall.endJunctionId);
		}
		return doc.walls
			.filter(
				(w) =>
					!ringWallIds.has(w.id) &&
					(rimJunctionIds.has(w.startJunctionId) || rimJunctionIds.has(w.endJunctionId))
			)
			.map((w) => w.id);
	};

	for (const baseRoom of document.rooms) {
		if (baseRoom.round === undefined || baseRoom.boundary.length <= 1) continue;
		if (roundRoomOutsideWallIds(document, baseRoom).length === 0) continue;
		const afterRoom = candidate.rooms.find((r) => r.id === baseRoom.id);
		if (
			!afterRoom ||
			afterRoom.round === undefined ||
			afterRoom.virtualEdges.length > 0 ||
			afterRoom.boundary.length <= 1
		) {
			continue;
		}
		if (roundRoomOutsideWallIds(candidate, afterRoom).length > 0) continue;

		// Trigger repack!
		const candWallById = new Map(candidate.walls.map((w) => [w.id, w] as const));
		const candJunctionById = new Map(candidate.junctions.map((j) => [j.id, j] as const));
		const members = afterRoom.boundary;
		const seamRef = members[0]!;
		const seamWall = candWallById.get(seamRef.wallId);
		if (!seamWall) {
			return reject({
				code: 'round_repack_conflict',
				message: `Round Room '${afterRoom.id}' seam Wall '${seamRef.wallId}' is missing`,
				roomIds: [afterRoom.id],
				wallIds: [seamRef.wallId]
			});
		}
		const seamJunctionId =
			seamRef.direction === 'forward' ? seamWall.startJunctionId : seamWall.endJunctionId;

		// 1. Uniform attributes check (height, thickness, optional name).
		for (const ref of members) {
			const w = candWallById.get(ref.wallId);
			if (!w) {
				return reject({
					code: 'round_repack_conflict',
					message: `Round Room '${afterRoom.id}' member Wall '${ref.wallId}' is missing`,
					roomIds: [afterRoom.id],
					wallIds: [ref.wallId]
				});
			}
			if (w.height !== seamWall.height || w.thickness !== seamWall.thickness || w.name !== seamWall.name) {
				const reason =
					w.height !== seamWall.height
						? 'height'
						: w.thickness !== seamWall.thickness
							? 'thickness'
							: 'name';
				return reject({
					code: 'round_repack_conflict',
					message: `Cannot repack Round Room '${afterRoom.id}': member Walls '${seamWall.id}' and '${w.id}' disagree on ${reason}. Equalize attributes or Release round before detaching.`,
					roomIds: [afterRoom.id],
					wallIds: [seamWall.id, w.id]
				});
			}
		}

		// 2. Discarded rim Junctions must not anchor another Space (virtual edges or boundary).
		const ringWallIdSet = new Set(members.map((m) => m.wallId));
		const retiredArcIds = members.slice(1).map((m) => m.wallId);
		const discardedJunctionIds = new Set<string>();
		for (const ref of members) {
			const w = candWallById.get(ref.wallId)!;
			if (w.startJunctionId !== seamJunctionId) discardedJunctionIds.add(w.startJunctionId);
			if (w.endJunctionId !== seamJunctionId) discardedJunctionIds.add(w.endJunctionId);
		}
		for (const other of candidate.rooms) {
			if (other.id === afterRoom.id) continue;
			const anchorHit =
				other.virtualEdges.find(
					(e) => discardedJunctionIds.has(e.startJunctionId) || discardedJunctionIds.has(e.endJunctionId)
				);
			if (anchorHit) {
				const hitJ = discardedJunctionIds.has(anchorHit.startJunctionId)
					? anchorHit.startJunctionId
					: anchorHit.endJunctionId;
				return reject({
					code: 'round_repack_conflict',
					message: `Cannot repack Round Room '${afterRoom.id}': rim Junction '${hitJ}' anchors Space '${other.id}'.`,
					roomIds: [afterRoom.id, other.id],
					junctionIds: [hitJ]
				});
			}
			const sharedBoundaryWall = other.boundary.find((ref) => ringWallIdSet.has(ref.wallId));
			if (sharedBoundaryWall) {
				return reject({
					code: 'round_repack_conflict',
					message: `Cannot repack Round Room '${afterRoom.id}': Wall '${sharedBoundaryWall.wallId}' is shared with Space '${other.id}'.`,
					roomIds: [afterRoom.id, other.id],
					wallIds: [sharedBoundaryWall.wallId]
				});
			}
		}

		// 3. Certify and rebuild canonical 16-span closed Wall.
		const cert = certifyRoundRoom(candidate, afterRoom);
		if (cert.kind === 'invalid') {
			return reject({
				code: 'round_repack_conflict',
				message: cert.issue.message,
				roomIds: [afterRoom.id]
			});
		}
		const rebuilt = buildClosedWallCircleCenterlineFromRay({
			center: cert.certified.center,
			radius: cert.certified.radius,
			seamDirection: cert.certified.seamDirection,
			wallId: seamWall.id,
			explicitSeam: cert.certified.seamPoint
		});
		if (rebuilt.kind === 'rejected') {
			return reject({
				code: 'round_repack_conflict',
				message: rebuilt.rejection.message,
				roomIds: [afterRoom.id],
				wallIds: [seamWall.id]
			});
		}
		const closedLength = wallCurveChainLength({
			startPoint: cert.certified.seamPoint,
			endPoint: cert.certified.seamPoint,
			knots: rebuilt.centerline.kind === 'cubic-chain' ? rebuilt.centerline.knots : [],
			spans: rebuilt.centerline.kind === 'cubic-chain' ? rebuilt.centerline.spans : []
		});

		// 4. Rehost Openings from all member arcs onto the canonical closed Wall.
		const memberCumulative: Array<{
			readonly wallId: string;
			readonly direction: 'forward' | 'reverse';
			readonly startDist: number;
			readonly length: number;
		}> = [];
		let accum = 0;
		for (const ref of members) {
			const w = candWallById.get(ref.wallId)!;
			const startPt = candJunctionById.get(w.startJunctionId)?.point;
			const endPt = candJunctionById.get(w.endJunctionId)?.point;
			if (!startPt || !endPt) {
				return reject({
					code: 'round_repack_conflict',
					message: `Round Room '${afterRoom.id}' Wall '${w.id}' has unresolved endpoints`,
					roomIds: [afterRoom.id],
					wallIds: [w.id]
				});
			}
			const len =
				w.centerline.kind === 'line'
					? Math.hypot(endPt[0] - startPt[0], endPt[1] - startPt[1])
					: wallCurveChainLength({
							startPoint: startPt,
							endPoint: endPt,
							knots: w.centerline.knots,
							spans: w.centerline.spans
						});
			memberCumulative.push({
				wallId: w.id,
				direction: ref.direction,
				startDist: accum,
				length: len
			});
			accum += len;
		}
		const memberByWallId = new Map(memberCumulative.map((m) => [m.wallId, m] as const));
		const nextOpenings: LayoutWallOpening[] = [];
		for (const opening of candidate.openings) {
			const m = memberByWallId.get(opening.wallId);
			if (!m) {
				nextOpenings.push(opening);
				continue;
			}
			if (opening.connectsRoomIds !== undefined) {
				return reject({
					code: 'round_repack_conflict',
					message: `Cannot repack Round Room '${afterRoom.id}': Opening '${opening.id}' still carries portal relation '${opening.connectsRoomIds.join(', ')}'.`,
					roomIds: [afterRoom.id],
					openingIds: [opening.id]
				});
			}
			const rimStart =
				m.direction === 'forward'
					? m.startDist + opening.offset
					: m.startDist + (m.length - (opening.offset + opening.width));
			const wrapped = ((rimStart % closedLength) + closedLength) % closedLength;
			const offset = closedLength - wrapped <= CURVE_ARC_LENGTH_TOLERANCE ? 0 : wrapped;
			nextOpenings.push({
				...opening,
				wallId: seamWall.id,
				offset
			});
			roundOpeningCorr.push({
				openingId: opening.id,
				beforeWallId: opening.wallId,
				afterWallId: seamWall.id
			});
		}

		const repackedWall: LayoutWall = {
			...seamWall,
			startJunctionId: seamJunctionId,
			endJunctionId: seamJunctionId,
			centerline: rebuilt.centerline
		};
		candidate.walls = candidate.walls.flatMap((w) => {
			if (w.id === seamWall.id) return [repackedWall];
			if (ringWallIdSet.has(w.id)) return [];
			return [w];
		});
		candidate.openings = nextOpenings;
		candidate.rooms = candidate.rooms.map((r) =>
			r.id === afterRoom.id
				? { ...r, boundary: [{ wallId: seamWall.id, direction: 'forward' }] }
				: r
		);
		candidate.regions = carryRegionWallIntents(
			candidate.regions,
			new Map(retiredArcIds.map((id) => [id, [seamWall.id]]))
		);

		const openingIssues = validateWallFirstOpeningSet(candidate);
		if (openingIssues.length > 0) {
			const first = openingIssues[0]!;
			return reject({
				code: 'round_repack_conflict',
				message: first.message,
				roomIds: [afterRoom.id],
				wallIds: [first.wallId],
				openingIds: [first.openingId]
			});
		}

		for (const jId of discardedJunctionIds) removedEndpointIds.add(jId);
		surfaceLineage = [
			...surfaceLineage,
			...repackWallSurfaceLineage({ survivorWallId: seamWall.id, members })
		];
		repackedRoundRoomIds.push(afterRoom.id);
		roundWallCorr.push({
			kind: 'repack',
			sourceWallIds: members.map((m) => m.wallId),
			survivorWallId: seamWall.id
		});
		roundJunctionCorr.push({ kind: 'preserved', junctionId: seamJunctionId });
		for (const jId of discardedJunctionIds) {
			roundJunctionCorr.push({ kind: 'retired', junctionId: jId, after: null });
		}
	}

	// I8 — prune Junctions the operation released. A released endpoint is kept
	// when a surviving Wall OR any final Space's virtual edge references it.
	// Anchors that were kept alive by a baseline Space's virtual edge and whose
	// Space now retires are released by that retirement, even if the Wall that
	// first exposed them was erased in an earlier operation. A never-referenced
	// stray Junction is not in this set and keeps today's rule.
	const baselineVirtualJunctionIds = new Set<string>();
	for (const room of document.rooms) {
		for (const edge of room.virtualEdges) {
			baselineVirtualJunctionIds.add(edge.startJunctionId);
			baselineVirtualJunctionIds.add(edge.endJunctionId);
		}
	}
	const survivingJunctionIds = new Set<string>();
	for (const wall of candidate.walls) {
		survivingJunctionIds.add(wall.startJunctionId);
		survivingJunctionIds.add(wall.endJunctionId);
	}
	for (const room of candidate.rooms) {
		for (const edge of room.virtualEdges) {
			survivingJunctionIds.add(edge.startJunctionId);
			survivingJunctionIds.add(edge.endJunctionId);
		}
	}
	candidate.junctions = document.junctions.filter(
		(junction) =>
			survivingJunctionIds.has(junction.id) ||
			(!removedEndpointIds.has(junction.id) && !baselineVirtualJunctionIds.has(junction.id))
	);

	return validateAndCompile(candidate, reject, (committed) => {
		const norm = normalizeLayoutSurfaceLineage({
			beforeLayout: document,
			afterLayout: committed,
			lineage: surfaceLineage
		});
		if (norm.kind === 'rejected') {
			return reject({
				code: 'invalid_candidate_document',
				message: norm.message
			});
		}
		const clearedRoundRoomIds: string[] = [];
		const roundRoomCorr: RoundOperationCorrespondence['rooms'][number][] = [];
		for (const baseRoom of document.rooms) {
			if (baseRoom.round === undefined) continue;
			const afterRoom = committed.rooms.find((r) => r.id === baseRoom.id);
			if (!afterRoom) {
				roundRoomCorr.push({ roomId: baseRoom.id, status: 'retired' });
			} else if (afterRoom.round === undefined) {
				clearedRoundRoomIds.push(baseRoom.id);
				roundRoomCorr.push({ roomId: baseRoom.id, status: 'cleared-round' });
			} else {
				roundRoomCorr.push({ roomId: baseRoom.id, status: 'preserved' });
			}
		}
		const roundCorrespondence: RoundOperationCorrespondence | undefined =
			repackedRoundRoomIds.length > 0 || clearedRoundRoomIds.length > 0
				? {
						rooms: roundRoomCorr,
						walls: roundWallCorr,
						junctions: roundJunctionCorr,
						openings: roundOpeningCorr
					}
				: undefined;
		return {
			kind: 'success',
			document: committed,
			lineage,
			surfaceLineage: norm.lineage,
			retiredRoomIds,
			spaceRetirements,
			...(repackedRoundRoomIds.length > 0 ? { repackedRoundRoomIds } : {}),
			...(clearedRoundRoomIds.length > 0 ? { clearedRoundRoomIds } : {}),
			...(roundCorrespondence ? { roundCorrespondence } : {})
		};
	});
}


/**
 * Canonical deletion of ONE physical Wall (the viewport/Inspector/
 * hierarchy Wall delete). Rides the shared removal pipeline above. One plan =
 * one history entry at the caller.
 */
export function planDeleteWall(
	document: LayoutDocumentWallFirst,
	wallId: string,
	capture: LayoutIdCapture,
	levelId: string
): WallFirstOpPlan {
	const levelIssue = layoutWorkingLevelIssue(document, levelId);
	if (levelIssue !== null) {
		return { kind: 'rejected', rejection: { code: 'invalid_value', message: levelIssue, wallIds: [wallId] } };
	}
	const wall = document.walls.find((candidate) => candidate.id === wallId);
	if (!wall) {
		return {
			kind: 'rejected',
			rejection: {
				code: 'unknown_wall',
				message: `Unknown wall '${wallId}'`,
				wallIds: [wallId]
			}
		};
	}
	try {
		return planWallRemovalSet(document, [wallId], capture, { invalidOutline: 'retire' });
	} catch (error) {
		if (error instanceof LayoutIdCollisionError) {
			return { kind: 'rejected', rejection: { code: 'captured_id_in_use', message: error.message, wallIds: [wallId] } };
		}
		throw error;
	}
}


/**
 * Canonical deletion of a SET of physical Walls through the same pipeline as
 * {@link planDeleteWall}. The set form is what can join three or more Spaces at
 * once, which the lifecycle refuses as `unsupported_component`.
 */
export function planDeleteWalls(
	document: LayoutDocumentWallFirst,
	wallIds: readonly string[],
	capture: LayoutIdCapture,
	levelId: string
): WallFirstOpPlan {
	const levelIssue = layoutWorkingLevelIssue(document, levelId);
	if (levelIssue !== null) {
		return { kind: 'rejected', rejection: { code: 'invalid_value', message: levelIssue, wallIds: [...wallIds] } };
	}
	const unique = [...new Set(wallIds)];
	if (unique.length === 0) {
		return { kind: 'rejected', rejection: { code: 'no_op', message: 'No Walls were named for deletion' } };
	}
	const known = new Set(document.walls.map((wall) => wall.id));
	const unknown = unique.filter((wallId) => !known.has(wallId));
	if (unknown.length > 0) {
		return {
			kind: 'rejected',
			rejection: {
				code: 'unknown_wall',
				message: `Unknown wall(s) ${unknown.join(', ')}`,
				wallIds: unknown
			}
		};
	}
	try {
		return planWallRemovalSet(document, unique, capture, { invalidOutline: 'retire' });
	} catch (error) {
		if (error instanceof LayoutIdCollisionError) {
			return { kind: 'rejected', rejection: { code: 'captured_id_in_use', message: error.message, wallIds: unique } };
		}
		throw error;
	}
}
