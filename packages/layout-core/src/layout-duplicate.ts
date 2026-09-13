/**
 * `layout-duplicate.ts` — P23.4 duplicate and linear repeat.
 *
 * Deterministic two-pass clone/remap planners over an immutable wall-first
 * document ([P23.4 plan](../../../../docs/plans/2026-09-08-P23.4-duplicate-and-linear-repeat.md)):
 *
 * ```text
 * collect source graph in stable order
 * → allocate all new IDs
 * → build old→new maps
 * → clone
 * → remap internal references
 * → apply per-copy transform/offset from the ORIGINAL source
 * → validate complete batch
 * → commit once
 * ```
 *
 * Copies are never generated from the preceding copy — every position is
 * `index × delta` from the original source so no accumulated drift can enter.
 * No timestamps, no random IDs. Any invalid copy rejects the whole batch and
 * the caller commits nothing (invalid/no-op → no history).
 *
 * Supported targets (P23.4 initial minimum):
 * - one supported document-level Layout object;
 * - one Wall-hosted Opening on its current Wall;
 * - one **isolated** Room whose bounded Wall/Junction/Opening subgraph can be
 *   cloned without detaching shared architecture.
 */
import type { LayoutDocumentIssue } from './layout-codec';
import { compileWallFirstLayoutGeometry } from './layout-geometry';
import { hasBlockingLayoutIssues } from './layout-geometry-validation';
import { validateWallFirstOpeningSet, type OpeningSetIssue } from './layout-opening-set';
import { validateWallFirstPortalRelations } from './layout-portals';
import { classifyWallIntersection, type TopologySegment } from './layout-wall-topology';
import { validateWallFirstLayoutDocument } from './layout-wall-first-codec';
import {
	isSupportedLayoutObject,
	resolveIsolatedRoomSubgraph
} from './layout-room-isolation';
import type {
	LayoutDocumentWallFirst,
	LayoutJunction,
	LayoutWall,
	LayoutWallFirstRoom,
	LayoutWallOpening
} from './layout-wall-first-types';
import type { LayoutObject, LayoutVec2 } from './layout-types';

/** Repeat-count cap (P23.4: `1..50` unless measured evidence justifies more). */
export const LAYOUT_DUPLICATE_MAX_COPIES = 50 as const;

export type DuplicateOperation =
	| 'layout-object-repeat'
	| 'wall-opening-repeat'
	| 'room-duplicate';

export type DuplicateRejectionCode =
	| 'unknown_object'
	| 'unknown_opening'
	| 'unknown_room'
	| 'invalid_reference'
	| 'invalid_value'
	| 'count_out_of_range'
	| 'profile_object_read_only'
	| 'room_not_isolated'
	| 'external_portal_relation'
	| 'invalid_candidate_document'
	| 'topology_invalid'
	| 'opening_set_invalid'
	| 'portal_relation_invalid'
	| 'candidate_does_not_compile';

export type DuplicateRejection = {
	code: DuplicateRejectionCode;
	message: string;
	/** Involved authored IDs where available. */
	targetIds?: readonly string[];
	/** Canonical-gate issues, when validation rejected the batch. */
	issues?: readonly (LayoutDocumentIssue | OpeningSetIssue)[];
};

export type DuplicatePlan =
	| {
			kind: 'success';
			/** Exact committed document — allocated IDs included. */
			document: LayoutDocumentWallFirst;
			operation: DuplicateOperation;
			createdObjectIds: readonly string[];
			createdOpeningIds: readonly string[];
			createdJunctionIds: readonly string[];
			createdWallIds: readonly string[];
			/** Set only by `planDuplicateIsolatedRoom`. */
			createdRoomId?: string;
	  }
	| { kind: 'rejected'; rejection: DuplicateRejection };

/** Deterministic collision-free ID from a seed (same policy as the noding/room allocators). */
function allocateId(taken: ReadonlySet<string>, seed: string): string {
	if (!taken.has(seed)) return seed;
	let index = 2;
	while (taken.has(`${seed}.${index}`)) index += 1;
	return `${seed}.${index}`;
}

function reject(
	code: DuplicateRejectionCode,
	message: string,
	targetIds?: readonly string[],
	issues?: readonly (LayoutDocumentIssue | OpeningSetIssue)[]
): DuplicatePlan {
	return {
		kind: 'rejected',
		rejection: {
			code,
			message,
			...(targetIds ? { targetIds } : {}),
			...(issues ? { issues } : {})
		}
	};
}

/** Is `count` a valid copy count (integer, `1..50`)? */
function isValidCopyCount(count: number): boolean {
	return (
		Number.isInteger(count) &&
		count >= 1 &&
		count <= LAYOUT_DUPLICATE_MAX_COPIES
	);
}

/**
 * Shared final gates for every duplicate/repeat batch: codec → wall topology
 * (only when walls changed) → whole-document opening set → portal relations →
 * canonical compile. One batch validates once — never per copy.
 */
function finalizeCandidate(
	candidate: LayoutDocumentWallFirst,
	operation: DuplicateOperation,
	created: {
		createdObjectIds?: readonly string[];
		createdOpeningIds?: readonly string[];
		createdJunctionIds?: readonly string[];
		createdWallIds?: readonly string[];
		createdRoomId?: string;
	}
): DuplicatePlan {
	const structural = validateWallFirstLayoutDocument(candidate);
	if (!structural.success) {
		return reject(
			'invalid_candidate_document',
			`Candidate failed wall-first validation: ${structural.issues[0]?.message ?? 'unknown issue'}`,
			undefined,
			structural.issues
		);
	}
	if ((created.createdWallIds?.length ?? 0) > 0) {
		const topologyIssue = validateBatchWallTopology(structural.document);
		if (topologyIssue) {
			return reject('topology_invalid', topologyIssue.message, [topologyIssue.wallId]);
		}
	}
	const setIssues = validateWallFirstOpeningSet(structural.document);
	if (setIssues.length > 0) {
		const first = setIssues[0]!;
		return reject('opening_set_invalid', first.message, [first.openingId, first.wallId], setIssues);
	}
	const relationIssues = validateWallFirstPortalRelations(structural.document);
	if (relationIssues.length > 0) {
		const first = relationIssues[0]!;
		return reject('portal_relation_invalid', first.message, [first.openingId]);
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
		createdObjectIds: created.createdObjectIds ?? [],
		createdOpeningIds: created.createdOpeningIds ?? [],
		createdJunctionIds: created.createdJunctionIds ?? [],
		createdWallIds: created.createdWallIds ?? [],
		...(created.createdRoomId !== undefined ? { createdRoomId: created.createdRoomId } : {})
	};
}

/**
 * Whole-document wall-pair gate for batches that introduce walls (Room
 * duplicate): every wall pair must relate only through explicit shared
 * junctions (or be disjoint). Same bar the P23.9 chain and P23.1 precision
 * candidates hold — a cloned subgraph translated into an existing wall would
 * otherwise silently cross/overlap it.
 */
function validateBatchWallTopology(
	document: LayoutDocumentWallFirst
): { wallId: string; message: string } | null {
	const junctionById = new Map(document.junctions.map((junction) => [junction.id, junction]));
	const entries: Array<{ wall: LayoutWall; segment: TopologySegment }> = [];
	for (const wall of document.walls) {
		const start = junctionById.get(wall.startJunctionId);
		const end = junctionById.get(wall.endJunctionId);
		if (!start || !end) continue;
		entries.push({ wall, segment: { id: wall.id, start: start.point, end: end.point } });
	}
	for (let first = 0; first < entries.length; first += 1) {
		for (let second = first + 1; second < entries.length; second += 1) {
			const a = entries[first]!.wall;
			const b = entries[second]!.wall;
			const shared =
				a.startJunctionId === b.startJunctionId || a.startJunctionId === b.endJunctionId
					? [a.startJunctionId]
					: a.endJunctionId === b.startJunctionId || a.endJunctionId === b.endJunctionId
						? [a.endJunctionId]
						: [];
			const classified = classifyWallIntersection(
				entries[first]!.segment,
				entries[second]!.segment,
				shared
			);
			if (classified.kind === 'shared-explicit-junction') {
				const geometric = classifyWallIntersection(
					entries[first]!.segment,
					entries[second]!.segment,
					[]
				);
				if (geometric.kind === 'collinear-overlap') {
					return {
						wallId: b.id,
						message: `Walls '${a.id}' and '${b.id}' overlap beyond their explicit shared junction`
					};
				}
				continue;
			}
			if (classified.kind !== 'none') {
				return {
					wallId: b.id,
					message: `Walls '${a.id}' and '${b.id}' have unsupported ${classified.kind}`
				};
			}
		}
	}
	return null;
}

function cloneObject(object: LayoutObject): LayoutObject {
	return {
		...object,
		position: [...object.position] as typeof object.position,
		rotation: [...object.rotation] as typeof object.rotation,
		dimensions: [...object.dimensions] as typeof object.dimensions
	};
}

/**
 * Shared supported-object predicate for the P23.4 duplicate paths. The one
 * implementation lives in `layout-room-isolation.ts` (P23.6a shares the whole
 * isolation policy, including this predicate, with the Room-move planner);
 * this alias keeps the duplicate-facing name for its callers.
 */
export const isSupportedDuplicateLayoutObject = isSupportedLayoutObject;

// ---------------------------------------------------------------------------
// Layout object duplicate / linear repeat
// ---------------------------------------------------------------------------

export type LayoutObjectRepeatIntent = {
	/** Source document-level object. */
	objectId: string;
	/** Number of copies to add; `1` is a plain duplicate. Bounded `1..50`. */
	count: number;
	/** X/Z translation delta per copy index (meters). Y is preserved. */
	delta: LayoutVec2;
};

/**
 * Repeat one supported document-level Layout object: `count` copies at exact
 * `index × delta` positions from the original source. Document-level and
 * project/world-local ownership is unchanged; the optional semantic `roomId`
 * is preserved on each copy (P23.8 owns later remapping, never this
 * operation). Profile/read-only objects reject explicitly.
 */
export function planRepeatLayoutObject(
	document: LayoutDocumentWallFirst,
	intent: LayoutObjectRepeatIntent
): DuplicatePlan {
	const source = document.objects.find((candidate) => candidate.id === intent.objectId);
	if (!source) {
		return reject('unknown_object', `Unknown layout object '${intent.objectId}'`, [intent.objectId]);
	}
	if (!isSupportedDuplicateLayoutObject(source)) {
		return reject(
			'profile_object_read_only',
			`Profile object '${intent.objectId}' is read-only and cannot be duplicated`,
			[intent.objectId]
		);
	}
	if (!isValidCopyCount(intent.count)) {
		return reject(
			'count_out_of_range',
			`Copy count must be an integer between 1 and ${LAYOUT_DUPLICATE_MAX_COPIES}`,
			[intent.objectId]
		);
	}
	const [dx, dz] = intent.delta;
	if (!Number.isFinite(dx) || !Number.isFinite(dz)) {
		return reject('invalid_value', 'Object repeat delta must be finite', [intent.objectId]);
	}

	// Pass 2: allocate every ID up front, then clone from the ORIGINAL source.
	const taken = new Set(document.objects.map((object) => object.id));
	const createdObjectIds: string[] = [];
	const copies: LayoutObject[] = [];
	for (let index = 1; index <= intent.count; index += 1) {
		const id = allocateId(taken, `${source.id}-copy`);
		taken.add(id);
		createdObjectIds.push(id);
		copies.push({
			...cloneObject(source),
			id,
			position: [source.position[0] + index * dx, source.position[1], source.position[2] + index * dz]
		});
	}
	const candidate: LayoutDocumentWallFirst = {
		...document,
		objects: [...document.objects, ...copies]
	};
	return finalizeCandidate(candidate, 'layout-object-repeat', { createdObjectIds });
}

// ---------------------------------------------------------------------------
// Opening duplicate / linear repeat
// ---------------------------------------------------------------------------

export type WallOpeningRepeatIntent = {
	/** Source Wall-hosted Opening. */
	openingId: string;
	/** Number of copies to add; `1` is a plain duplicate. Bounded `1..50`. */
	count: number;
	/**
	 * Physical spacing in meters along the canonical Wall direction. Negative
	 * spacing is allowed when the complete final opening set still validates;
	 * anything else rejects the whole batch (never normalized silently).
	 */
	spacing: number;
};

/**
 * Repeat one Wall-hosted Opening along its current canonical Wall:
 * `newOffset = source.offset + i × spacing` from the ORIGINAL source.
 * Kind/width/height/sill/profile are preserved; the host stays the same Wall;
 * the complete final opening set on the Wall validates as one batch.
 */
export function planRepeatWallOpening(
	document: LayoutDocumentWallFirst,
	intent: WallOpeningRepeatIntent
): DuplicatePlan {
	const source = document.openings.find((candidate) => candidate.id === intent.openingId);
	if (!source) {
		return reject('unknown_opening', `Unknown Opening '${intent.openingId}'`, [intent.openingId]);
	}
	if (!isValidCopyCount(intent.count)) {
		return reject(
			'count_out_of_range',
			`Copy count must be an integer between 1 and ${LAYOUT_DUPLICATE_MAX_COPIES}`,
			[intent.openingId]
		);
	}
	if (!Number.isFinite(intent.spacing)) {
		return reject('invalid_value', 'Opening repeat spacing must be finite', [intent.openingId]);
	}
	if (!document.walls.some((wall) => wall.id === source.wallId)) {
		return reject('invalid_reference', `Opening '${source.id}' has an unresolved hosting Wall`, [
			source.id,
			source.wallId
		]);
	}

	// Pass 2: allocate every ID up front, then clone from the ORIGINAL source.
	const taken = new Set(document.openings.map((opening) => opening.id));
	const createdOpeningIds: string[] = [];
	const copies: LayoutWallOpening[] = [];
	for (let index = 1; index <= intent.count; index += 1) {
		const id = allocateId(taken, `${source.id}-copy`);
		taken.add(id);
		createdOpeningIds.push(id);
		copies.push({
			...source,
			id,
			offset: source.offset + index * intent.spacing,
			// A portal relation is preserved only because the copy stays on the
			// same hosting Wall with the same adjacent Rooms; the shared portal
			// gate below re-proves the new-schema contract for every copy.
			...(source.connectsRoomIds
				? { connectsRoomIds: [...source.connectsRoomIds] as [string, string] }
				: {})
		});
	}
	const candidate: LayoutDocumentWallFirst = {
		...document,
		openings: [...document.openings, ...copies]
	};
	return finalizeCandidate(candidate, 'wall-opening-repeat', { createdOpeningIds });
}

// ---------------------------------------------------------------------------
// Isolated Room duplicate
// ---------------------------------------------------------------------------

export type RoomDuplicateIntent = {
	/** Source Room whose bounded subgraph is cloned. */
	roomId: string;
	/** Project/world X/Z translation applied to every cloned Junction. */
	delta: LayoutVec2;
};

/**
 * Duplicate one **isolated** Room: its boundary Junctions, boundary Walls and
 * Wall-hosted Openings clone exactly once, the Room record gets a new
 * deterministic ID/name with its boundary references remapped to the cloned
 * Walls, and supported document-level Layout objects whose explicit `roomId`
 * equals the source Room ID copy with the same per-copy X/Z delta and the
 * remapped association. Unassociated objects inside the face never copy, and
 * Scene/Camera documents are not touched at all (P23.4 non-goal).
 *
 * Rejections: shared boundary Walls or subgraph junctions shared with
 * non-cloned walls (`room_not_isolated`), any external portal relation on a
 * hosted Opening (`external_portal_relation`), any read-only/profile
 * associated object (`profile_object_read_only`), and a cloned subgraph that
 * would cross/overlap existing walls (`topology_invalid`).
 */
export function planDuplicateIsolatedRoom(
	document: LayoutDocumentWallFirst,
	intent: RoomDuplicateIntent
): DuplicatePlan {
	const [dx, dz] = intent.delta;
	if (document.rooms.some((candidate) => candidate.id === intent.roomId)) {
		if (!Number.isFinite(dx) || !Number.isFinite(dz)) {
			return reject('invalid_value', 'Room duplicate delta must be finite', [intent.roomId]);
		}
	}

	// S1 (P23.6a) — one shared isolation policy for duplicate and move.
	const isolation = resolveIsolatedRoomSubgraph(document, intent.roomId);
	if (isolation.kind === 'rejected') {
		return reject(
			isolation.rejection.code,
			isolation.rejection.message,
			isolation.rejection.targetIds
		);
	}
	// The shared policy already rejected any read-only profile object.
	const { room: source, subgraph } = isolation;

	const wallById = new Map(document.walls.map((wall) => [wall.id, wall]));
	const boundaryWallIds = subgraph.wallIds;
	const boundaryWallSet = new Set(boundaryWallIds);
	const hostedOpenings = document.openings.filter((opening) =>
		boundaryWallSet.has(opening.wallId)
	);
	const junctionById = new Map(document.junctions.map((junction) => [junction.id, junction]));

	// Pass 2: allocate all new IDs, build old→new maps, then clone once.
	const junctionIdMap = new Map<string, string>();
	const clonedJunctions: LayoutJunction[] = [];
	const junctionTaken = new Set(document.junctions.map((junction) => junction.id));
	for (const wallId of boundaryWallIds) {
		const wall = wallById.get(wallId)!;
		for (const oldJunctionId of [wall.startJunctionId, wall.endJunctionId]) {
			if (junctionIdMap.has(oldJunctionId)) continue;
			const oldJunction = junctionById.get(oldJunctionId)!;
			const newId = allocateId(junctionTaken, `${oldJunctionId}-copy`);
			junctionTaken.add(newId);
			junctionIdMap.set(oldJunctionId, newId);
			clonedJunctions.push({
				id: newId,
				point: [oldJunction.point[0] + dx, oldJunction.point[1] + dz]
			});
		}
	}

	const wallIdMap = new Map<string, string>();
	const clonedWalls: LayoutWall[] = [];
	const wallTaken = new Set(document.walls.map((wall) => wall.id));
	for (const wallId of boundaryWallIds) {
		const wall = wallById.get(wallId)!;
		const newId = allocateId(wallTaken, `${wallId}-copy`);
		wallTaken.add(newId);
		wallIdMap.set(wallId, newId);
		clonedWalls.push({
			id: newId,
			startJunctionId: junctionIdMap.get(wall.startJunctionId)!,
			endJunctionId: junctionIdMap.get(wall.endJunctionId)!,
			role: wall.role,
			thickness: wall.thickness,
			height: wall.height
		});
	}

	const openingIdMap = new Map<string, string>();
	const clonedOpenings: LayoutWallOpening[] = [];
	const openingTaken = new Set(document.openings.map((opening) => opening.id));
	for (const opening of hostedOpenings) {
		const newId = allocateId(openingTaken, `${opening.id}-copy`);
		openingTaken.add(newId);
		openingIdMap.set(opening.id, newId);
		clonedOpenings.push({
			id: newId,
			wallId: wallIdMap.get(opening.wallId)!,
			kind: opening.kind,
			// Cloned wall geometry moves with the copy: offsets stay unchanged.
			offset: opening.offset,
			width: opening.width,
			height: opening.height,
			sillHeight: opening.sillHeight,
			profile: opening.profile
		});
	}

	const roomTaken = new Set(document.rooms.map((room) => room.id));
	const newRoomId = allocateId(roomTaken, `${intent.roomId}-copy`);
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
			direction: ref.direction
		})),
		floorThickness: source.floorThickness,
		ceilingThickness: source.ceilingThickness
	};

	// Associated Layout objects only: explicit roomId equals the source Room.
	// Unassociated objects inside the face never copy; Floor ownership is
	// never inferred from coordinates. A read-only/profile associated object
	// rejects the whole Room batch (never silently stripped) — proven above by
	// the shared isolation policy before any allocation.
	const objectTaken = new Set(document.objects.map((object) => object.id));
	const clonedObjects: LayoutObject[] = [];
	const createdObjectIds: string[] = [];
	for (const object of document.objects) {
		if (object.roomId !== intent.roomId) continue;
		const newId = allocateId(objectTaken, `${object.id}-copy`);
		objectTaken.add(newId);
		createdObjectIds.push(newId);
		clonedObjects.push({
			...cloneObject(object),
			id: newId,
			roomId: newRoomId,
			position: [object.position[0] + dx, object.position[1], object.position[2] + dz]
		});
	}

	const candidate: LayoutDocumentWallFirst = {
		...document,
		junctions: [...document.junctions, ...clonedJunctions],
		walls: [...document.walls, ...clonedWalls],
		rooms: [...document.rooms, clonedRoom],
		openings: [...document.openings, ...clonedOpenings],
		objects: [...document.objects, ...clonedObjects]
	};
	return finalizeCandidate(candidate, 'room-duplicate', {
		createdObjectIds,
		createdOpeningIds: clonedOpenings.map((opening) => opening.id),
		createdJunctionIds: clonedJunctions.map((junction) => junction.id),
		createdWallIds: clonedWalls.map((wall) => wall.id),
		createdRoomId: newRoomId
	});
}
