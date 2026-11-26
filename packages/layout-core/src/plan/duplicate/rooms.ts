import { translateWallCenterline } from '../../wall/centerline';
import { buildRoundRoomGeometryFromCertified, certifyRoundRoom } from '../../room/round-room';
import type { LayoutIdCapture } from '../id-capture';
import { layoutWorkingLevelIssue } from '../id-capture';
import type { RoomCopyDroppedRelation } from '../../room/isolation';
import { resolveIsolatedRoomSubgraph, resolveRoomCopyEnclosure } from '../../room/isolation';
import type {
	LayoutDocumentWallFirst,
	LayoutJunction,
	LayoutObject,
	LayoutWall,
	LayoutWallFirstRoom,
	LayoutWallOpening,
} from '../../wall/types';
import type { LayoutVec2 } from '../../geometry/coordinates';
import type { LayoutSurfaceLineage } from '../surface-reference';
import { duplicateRoomSurfaceLineage } from '../surface-reference';
import type { DuplicatePlan, RoomCopyCorrespondence, RoomDuplicateIntent } from './contracts';
import { cloneObject, finalizeCandidate } from './objects';
import { allocateId, guardedDuplicatePlan, reject } from './shared';

type ClonedRoomEnclosure = {
	readonly candidate: LayoutDocumentWallFirst;
	readonly createdObjectIds: readonly string[];
	readonly createdOpeningIds: readonly string[];
	readonly createdJunctionIds: readonly string[];
	readonly createdWallIds: readonly string[];
	readonly createdRoomId: string;
	readonly surfaceLineage: LayoutSurfaceLineage;
	readonly droppedRoomRelations: readonly RoomCopyDroppedRelation[];
	readonly roomCopyCorrespondence: RoomCopyCorrespondence;
};

/**
 * Clone one Room enclosure from an already-resolved boundary Wall set.
 *
 * The source is copied, never shared:
 *
 * - every boundary Junction gets `<source>-copy.<nonce>` at `point + delta`;
 * - every boundary Wall keeps thickness, height and authored name, gets its
 *  own id, remapped ends and a deep centerline translated by the same delta;
 * - every hosted Opening keeps kind, authored name, offset, size, sill and
 *  profile, gets its own id and its clone host, and never carries
 *  `connectsRoomIds` (the Rooms it names do not copy); the dropped relation is
 *  reported;
 * - the Room keeps thicknesses and gets `<name> copy` (or the next free
 *  suffix), a new id and boundary references remapped to the cloned Walls;
 * - explicitly associated objects copy once with the same translation and the
 *  new Room association.
 *
 * This is the ONE clone/remap implementation for both Room planners, so the
 * isolated A4 path and the general A5 path cannot drift in what they copy.
 */
function cloneRoomEnclosure(
	document: LayoutDocumentWallFirst,
	source: LayoutWallFirstRoom,
	boundaryWallIds: readonly string[],
	delta: LayoutVec2,
	capture: LayoutIdCapture,
): ClonedRoomEnclosure {
	const [dx, dz] = delta;
	const wallById = new Map(document.walls.map((wall) => [wall.id, wall]));
	const boundaryWallSet = new Set(boundaryWallIds);
	const hostedOpenings = document.openings.filter((opening) => boundaryWallSet.has(opening.wallId));
	const junctionById = new Map(document.junctions.map((junction) => [junction.id, junction]));

	// Round Rooms rebuild copied geometry from the certified centre-local
	// template + destination centre (one add per point) and copy `round` with
	// the translated centre and exact radius.
	const roundRebuild = (() => {
		if (!source.round) return undefined;
		const cert = certifyRoundRoom(document, source);
		if (cert.kind !== 'certified') return undefined;
		const newCenter: LayoutVec2 = [cert.certified.center[0] + dx, cert.certified.center[1] + dz];
		return buildRoundRoomGeometryFromCertified({
			document,
			certified: cert.certified,
			center: newCenter,
			radius: cert.certified.radius,
			seamDirection: cert.certified.seamDirection,
		});
	})();

	// Pass 2: allocate all new IDs, build old→new maps, then clone once.
	const junctionIdMap = new Map<string, string>();
	const clonedJunctions: LayoutJunction[] = [];
	const junctionTaken = new Set(document.junctions.map((junction) => junction.id));
	for (const wallId of boundaryWallIds) {
		const wall = wallById.get(wallId)!;
		for (const oldJunctionId of [wall.startJunctionId, wall.endJunctionId]) {
			if (junctionIdMap.has(oldJunctionId)) continue;
			const oldJunction = junctionById.get(oldJunctionId)!;
			const newId = allocateId(junctionTaken, `${oldJunctionId}-copy`, capture);
			junctionTaken.add(newId);
			junctionIdMap.set(oldJunctionId, newId);
			const rebuiltPoint = roundRebuild?.junctionPoints.get(oldJunctionId);
			clonedJunctions.push({
				id: newId,
				point: rebuiltPoint ?? [oldJunction.point[0] + dx, oldJunction.point[1] + dz],
			});
		}
	}

	const wallIdMap = new Map<string, string>();
	const clonedWalls: LayoutWall[] = [];
	const wallTaken = new Set(document.walls.map((wall) => wall.id));
	for (const wallId of boundaryWallIds) {
		const wall = wallById.get(wallId)!;
		const newId = allocateId(wallTaken, `${wallId}-copy`, capture);
		wallTaken.add(newId);
		wallIdMap.set(wallId, newId);
		const rebuiltCenterline = roundRebuild?.wallCenterlines.get(wallId);
		clonedWalls.push({
			id: newId,
			startJunctionId: junctionIdMap.get(wall.startJunctionId)!,
			endJunctionId: junctionIdMap.get(wall.endJunctionId)!,
			thickness: wall.thickness,
			height: wall.height,
			// Explicit duplicate copies the optional authored name
			// unchanged (new references are minted at the install seam).
			...(wall.name !== undefined ? { name: wall.name } : {}),
			// The cloned Wall keeps its centerline shape with a deep
			// anchor copy so the copy never shares arrays/points with the source,
			// translated by the same delta as its Junctions. Anchors are absolute
			// document X/Z: leaving them at the source position would not
			// preserve the shape (the curve would swing across the untranslated
			// anchors and can cross a sibling Wall of the copy).
			centerline: rebuiltCenterline ?? translateWallCenterline(wall.centerline, [dx, dz]),
		});
	}

	const openingIdMap = new Map<string, string>();
	const clonedOpenings: LayoutWallOpening[] = [];
	const droppedRoomRelations: RoomCopyDroppedRelation[] = [];
	const openingTaken = new Set(document.openings.map((opening) => opening.id));
	for (const opening of hostedOpenings) {
		const newId = allocateId(openingTaken, `${opening.id}-copy`, capture);
		openingTaken.add(newId);
		openingIdMap.set(opening.id, newId);
		if (opening.connectsRoomIds !== undefined) {
			droppedRoomRelations.push({
				openingId: opening.id,
				roomIds: [opening.connectsRoomIds[0], opening.connectsRoomIds[1]],
			});
		}
		clonedOpenings.push({
			id: newId,
			wallId: wallIdMap.get(opening.wallId)!,
			kind: opening.kind,
			// The optional authored name copies unchanged.
			...(opening.name !== undefined ? { name: opening.name } : {}),
			// Cloned wall geometry moves with the copy: offsets stay unchanged.
			offset: opening.offset,
			width: opening.width,
			height: opening.height,
			sillHeight: opening.sillHeight,
			profile: opening.profile,
		});
	}

	const roomTaken = new Set(document.rooms.map((room) => room.id));
	const newRoomId = allocateId(roomTaken, `${source.id}-copy`, capture);
	const nameTaken = new Set(document.rooms.map((room) => room.name));
	let nameIndex = 1;
	let newRoomName = `${source.name} copy`;
	while (nameTaken.has(newRoomName)) {
		nameIndex += 1;
		newRoomName = `${source.name} copy ${nameIndex}`;
	}
	const clonedRoom: LayoutWallFirstRoom = {
		id: newRoomId,
		name: newRoomName,
		boundary: source.boundary.map((ref) => ({
			wallId: wallIdMap.get(ref.wallId)!,
			direction: ref.direction,
		})),
		virtualEdges: source.virtualEdges.map((edge) => ({
			startJunctionId: junctionIdMap.get(edge.startJunctionId)!,
			endJunctionId: junctionIdMap.get(edge.endJunctionId)!,
		})),
		overhead: source.overhead,
		...(roundRebuild
			? { round: roundRebuild.round }
			: source.round
				? {
						round: {
							center: [source.round.center[0] + dx, source.round.center[1] + dz] as LayoutVec2,
							radius: source.round.radius,
						},
					}
				: {}),
	};

	// Associated Layout objects only: explicit roomId equals the source Room.
	// Unassociated objects inside the face never copy; Floor ownership is
	// never inferred from coordinates. A read-only/profile associated object
	// rejects the whole Room batch before this clone runs.
	const objectTaken = new Set(document.objects.map((object) => object.id));
	const clonedObjects: LayoutObject[] = [];
	const createdObjectIds: string[] = [];
	const objectIdMap = new Map<string, string>();
	for (const object of document.objects) {
		if (object.roomId !== source.id) continue;
		const newId = allocateId(objectTaken, `${object.id}-copy`, capture);
		objectTaken.add(newId);
		createdObjectIds.push(newId);
		objectIdMap.set(object.id, newId);
		clonedObjects.push({
			...cloneObject(object),
			id: newId,
			roomId: newRoomId,
			position: [object.position[0] + dx, object.position[1], object.position[2] + dz],
		});
	}

	return {
		candidate: {
			...document,
			junctions: [...document.junctions, ...clonedJunctions],
			walls: [...document.walls, ...clonedWalls],
			rooms: [...document.rooms, clonedRoom],
			openings: [...document.openings, ...clonedOpenings],
			objects: [...document.objects, ...clonedObjects],
		},
		createdObjectIds,
		createdOpeningIds: clonedOpenings.map((opening) => opening.id),
		createdJunctionIds: clonedJunctions.map((junction) => junction.id),
		createdWallIds: clonedWalls.map((wall) => wall.id),
		createdRoomId: newRoomId,
		surfaceLineage: duplicateRoomSurfaceLineage(wallIdMap, source.id, newRoomId),
		droppedRoomRelations,
		roomCopyCorrespondence: {
			room: { sourceId: source.id, copyId: newRoomId },
			junctions: Array.from(junctionIdMap, ([sourceId, copyId]) => ({ sourceId, copyId })),
			walls: Array.from(wallIdMap, ([sourceId, copyId]) => ({ sourceId, copyId })),
			openings: Array.from(openingIdMap, ([sourceId, copyId]) => ({ sourceId, copyId })),
			objects: Array.from(objectIdMap, ([sourceId, copyId]) => ({ sourceId, copyId })),
		},
	};
}

/**
 * Duplicate one **isolated** Room: its boundary Junctions, boundary Walls and
 * Wall-hosted Openings clone exactly once, the Room record gets a new
 * deterministic ID/name with its boundary references remapped to the cloned
 * Walls, and supported document-level Layout objects whose explicit `roomId`
 * equals the source Room ID copy with the same per-copy X/Z delta and the
 * remapped association. Unassociated objects inside the face never copy, and
 * Scene/Camera documents are not touched at all (non-goal).
 *
 * Rejections: shared boundary Walls or subgraph junctions shared with
 * non-cloned walls (`room_not_isolated`), any external portal relation on a
 * hosted Opening (`external_portal_relation`), any read-only/profile
 * associated object (`profile_object_read_only`), and a candidate that
 * violates the CANONICAL topology bar inside one connected component
 * (`topology_invalid`). A clone can overlap or cross independent geometry without
 * joining it.
 */
export function planDuplicateIsolatedRoom(
	document: LayoutDocumentWallFirst,
	intent: RoomDuplicateIntent,
	capture: LayoutIdCapture,
	levelId: string,
): DuplicatePlan {
	const levelIssue = layoutWorkingLevelIssue(document, levelId);
	if (levelIssue !== null) return reject('invalid_value', levelIssue, [intent.roomId]);
	return guardedDuplicatePlan(() => planDuplicateIsolatedRoomInternal(document, intent, capture));
}

function planDuplicateIsolatedRoomInternal(
	document: LayoutDocumentWallFirst,
	intent: RoomDuplicateIntent,
	capture: LayoutIdCapture,
): DuplicatePlan {
	const [dx, dz] = intent.delta;
	if (document.rooms.some((candidate) => candidate.id === intent.roomId)) {
		if (!Number.isFinite(dx) || !Number.isFinite(dz)) {
			return reject('invalid_value', 'Room duplicate delta must be finite', [intent.roomId]);
		}
	}

	// S1 — one shared isolation policy for duplicate and move.
	const isolation = resolveIsolatedRoomSubgraph(document, intent.roomId);
	if (isolation.kind === 'rejected') {
		return reject(
			isolation.rejection.code,
			isolation.rejection.message,
			isolation.rejection.targetIds,
		);
	}
	// The shared policy already rejected any read-only profile object.
	const { room: source, subgraph } = isolation;
	const cloned = cloneRoomEnclosure(document, source, subgraph.wallIds, [dx, dz], capture);
	return finalizeCandidate(cloned.candidate, 'room-duplicate', {
		createdObjectIds: cloned.createdObjectIds,
		createdOpeningIds: cloned.createdOpeningIds,
		createdJunctionIds: cloned.createdJunctionIds,
		createdWallIds: cloned.createdWallIds,
		createdRoomId: cloned.createdRoomId,
		surfaceLineage: cloned.surfaceLineage,
		droppedRoomRelations: cloned.droppedRoomRelations,
		roomCopyCorrespondence: cloned.roomCopyCorrespondence,
	});
}

/**
 * Duplicate **any** Room as a free island (A5): the Room's complete boundary
 * enclosure clones privately even when a boundary Wall is shared with another
 * Room or a stationary Wall meets one of its Junctions.
 *
 * The copy is a new connected component: every cloned Wall, Junction, Opening,
 * Room and explicitly associated object gets a captured new id derived from its
 * source; the source architecture is untouched. A copied Door keeps its kind,
 * position and size but not its `connectsRoomIds` — the Rooms that relation
 * names do not copy — and every dropped relation is reported in
 * `droppedRoomRelations` so the calling surface can name it before commit.
 *
 * Rejections: an unknown Room (`unknown_room`), an unresolved boundary Wall
 * (`invalid_reference`), a read-only/profile associated object
 * (`profile_object_read_only`), a non-finite delta (`invalid_value`), a captured
 * id collision (`captured_id_in_use`), and the canonical candidate gates
 * (`invalid_candidate_document`, `topology_invalid`, `opening_set_invalid`,
 * `portal_relation_invalid`, `candidate_does_not_compile`).
 *
 * Overlap between independent components is permitted
 * placement: a copy placed across another group's Walls commits, joins nothing
 * and is reported by the derived overlap cue, never refused here.
 */
export function planDuplicateRoom(
	document: LayoutDocumentWallFirst,
	intent: RoomDuplicateIntent,
	capture: LayoutIdCapture,
	levelId: string,
): DuplicatePlan {
	const levelIssue = layoutWorkingLevelIssue(document, levelId);
	if (levelIssue !== null) return reject('invalid_value', levelIssue, [intent.roomId]);
	return guardedDuplicatePlan(() => planDuplicateRoomInternal(document, intent, capture));
}

function planDuplicateRoomInternal(
	document: LayoutDocumentWallFirst,
	intent: RoomDuplicateIntent,
	capture: LayoutIdCapture,
): DuplicatePlan {
	const [dx, dz] = intent.delta;
	if (document.rooms.some((candidate) => candidate.id === intent.roomId)) {
		if (!Number.isFinite(dx) || !Number.isFinite(dz)) {
			return reject('invalid_value', 'Room duplicate delta must be finite', [intent.roomId]);
		}
	}

	// A5 — the copy enclosure: boundary architecture only, shared or not.
	const resolved = resolveRoomCopyEnclosure(document, intent.roomId);
	if (resolved.kind === 'rejected') {
		return reject(
			resolved.rejection.code,
			resolved.rejection.message,
			resolved.rejection.targetIds,
		);
	}
	const { enclosure } = resolved;
	const cloned = cloneRoomEnclosure(document, enclosure.room, enclosure.wallIds, [dx, dz], capture);
	return finalizeCandidate(cloned.candidate, 'room-duplicate', {
		createdObjectIds: cloned.createdObjectIds,
		createdOpeningIds: cloned.createdOpeningIds,
		createdJunctionIds: cloned.createdJunctionIds,
		createdWallIds: cloned.createdWallIds,
		createdRoomId: cloned.createdRoomId,
		surfaceLineage: cloned.surfaceLineage,
		droppedRoomRelations: cloned.droppedRoomRelations,
		roomCopyCorrespondence: cloned.roomCopyCorrespondence,
	});
}
