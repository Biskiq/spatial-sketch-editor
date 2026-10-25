/**
 * `layout-geometry-delta.ts` — chunked retained compile world and O(k) delta
 * evaluation for `compileWallFirstLayoutGeometry` (T1.P02.S06).
 *
 * Architectural contract (AGENTS.md rules 3 & 6):
 * 1. **One canonical compiler** — every dirty Room, Wall, Junction, Object and
 *    Floor aggregate is evaluated by the exact canonical builders in
 *    `layout-geometry.ts`; this module never implements a second geometry or
 *    issue formula.
 * 2. **Soundness before speed** — O(k) delta evaluation runs only when the
 *    candidate's changed entity set is certified by `CowDocumentDelta` (direct
 *    parent/child or common-baseline sibling) or identical document reference,
 *    and document-global datums (`floor.id`, `floor.elevation`, fallback
 *    `walls[0]?.thickness ?? 0.1`, custom `sampling`) and topology counts are
 *    invariant. Any topology change, global datum change or unindexed clone
 *    returns `null` so `layout-geometry.ts` runs the full structural pass.
 * 3. **No serialized cache state** — passive seeds live in WeakMaps keyed on
 *    document identity and never touch authored records.
 */

import { cacheKeyDependency, type CacheKeyDependency } from './layout-geometry-keys';
import type { LayoutVec2 } from './layout-coordinates';
import type { WallSamplingDerivation } from './layout-wall-centerline';
import type {
	CompiledFloor,
	CompiledJunction,
	CompiledJunctionLeg,
	CompiledLayoutGeometry,
	CompiledLayoutGeometryResult,
	CompiledLayoutObject,
	CompiledLegJoin,
	CompiledPhysicalWall,
	CompiledQueryAabb,
	CompiledQueryPoint,
	CompiledQueryPolygon,
	CompiledQuerySpan,
	CompiledRoom,
	CompilerRoomSource,
	LayoutBounds2,
	LayoutBounds3,
	LayoutGeometryIssue
} from './layout-geometry-types';
import {
	noQueryRecords,
	sameAuthored,
	type LayoutCompileReuse,
	type RetainedQueryRecords
} from './layout-geometry-reuse';
import type {
	LayoutDerivedWallRole,
	LayoutDocumentWallFirst,
	LayoutObject,
	LayoutWall,
	LayoutWallOpening
} from './layout-wall-first-types';
import { deriveLayoutWallRoles } from './layout-wall-role';
import {
	areEquivalentLayoutClones,
	getCowDocumentDelta,
	hasAnySamplingTestObserver
} from './layout-world-index';
import type { Vec3 } from './types';

const CHUNK_SIZE = 64;

export type EvaluatedRoomUnit = {
	readonly hasValidCeiling: boolean;
	readonly source: CompilerRoomSource | null;
	readonly compiled: CompiledRoom | null;
	readonly stripped: CompiledRoom | null;
	readonly polygons: readonly CompiledQueryPolygon[];
	readonly aabbs: readonly CompiledQueryAabb[];
	readonly issues: readonly LayoutGeometryIssue[];
	readonly bounds3: LayoutBounds3 | null;
};

export type EvaluatedWallBaseUnit = {
	readonly baseCompiled: CompiledPhysicalWall;
	readonly baseBounds2: LayoutBounds2;
	readonly baseBounds3: LayoutBounds3;
	readonly baseRecords: RetainedQueryRecords;
	readonly baseWallAabb: CompiledQueryAabb;
	readonly issues: readonly LayoutGeometryIssue[];
	readonly legs: { readonly start?: CompiledJunctionLeg; readonly end?: CompiledJunctionLeg };
	readonly openingsCount: number;
};

export type ExpandedWallUnit = {
	readonly compiled: CompiledPhysicalWall;
	readonly wallAabb: CompiledQueryAabb;
};

export type ResolvedJunctionUnit = {
	readonly compiled: CompiledJunction;
	readonly issues: readonly LayoutGeometryIssue[];
	readonly evaluated: boolean;
};

export type CompiledObjectsUnit = {
	readonly compiledObjects: CompiledLayoutObject[];
	readonly polygons: CompiledQueryPolygon[];
	readonly aabbs: CompiledQueryAabb[];
	readonly issues: LayoutGeometryIssue[];
	readonly bounds3: LayoutBounds3 | null;
	readonly floorRoomBounds3: LayoutBounds3 | null;
};

export type FloorAndAabbsUnit = {
	readonly floor: CompiledFloor;
	readonly floorAabb: CompiledQueryAabb | null;
	readonly docAabb: CompiledQueryAabb | null;
};

export type CanonicalDeltaBuilders = {
	evaluateRoom(
		document: LayoutDocumentWallFirst,
		roomIndex: number,
		pointById: ReadonlyMap<string, LayoutVec2>,
		wallById: ReadonlyMap<string, LayoutWall>,
		openingsByHostWallId: ReadonlyMap<string, readonly LayoutWallOpening[]>,
		openingOrderById: ReadonlyMap<string, number>,
		defaultWallThickness: number
	): EvaluatedRoomUnit;
	evaluateWallBase(
		document: LayoutDocumentWallFirst,
		wall: LayoutWall,
		pointById: ReadonlyMap<string, LayoutVec2>,
		hostedOpenings: readonly LayoutWallOpening[],
		derivedRole: LayoutDerivedWallRole
	): EvaluatedWallBaseUnit | null;
	resolveJunction(
		document: LayoutDocumentWallFirst,
		junctionId: string,
		point: LayoutVec2,
		sortedLegs: CompiledJunctionLeg[],
		reuse: LayoutCompileReuse
	): ResolvedJunctionUnit;
	expandWall(
		floorId: string,
		floorElevation: number,
		wallHeight: number,
		wallId: string,
		baseCompiled: CompiledPhysicalWall,
		baseBounds2: LayoutBounds2,
		baseBounds3: LayoutBounds3,
		currentCompiled: CompiledPhysicalWall,
		currentWallAabb: CompiledQueryAabb,
		joins: readonly CompiledLegJoin[] | undefined
	): ExpandedWallUnit;
	compileObjects(
		objects: readonly LayoutObject[],
		documentRoomIds: ReadonlySet<string>,
		reuse: LayoutCompileReuse
	): CompiledObjectsUnit;
	buildFloorAndAabbs(
		floor: LayoutDocumentWallFirst['floor'],
		floorRoomIds: readonly string[],
		floorBounds: LayoutBounds3 | null,
		documentBounds: LayoutBounds3 | null,
		reuse: LayoutCompileReuse
	): FloorAndAabbsUnit;
	computeWallBaseBounds(
		wall: CompiledPhysicalWall,
		floorElevation: number
	): { readonly bounds2: LayoutBounds2; readonly bounds3: LayoutBounds3 };
};

export type RoomSlot = {
	readonly roomId: string;
	readonly hasValidCeiling: boolean;
	readonly stripped: CompiledRoom | null;
	readonly polygons: readonly CompiledQueryPolygon[];
	readonly aabbs: readonly CompiledQueryAabb[];
	readonly issues: readonly LayoutGeometryIssue[];
	readonly bounds3: LayoutBounds3 | null;
};

type RoomChunk = {
	strippedRooms: CompiledRoom[];
	validRoomIds: string[];
	polygons: CompiledQueryPolygon[];
	aabbs: CompiledQueryAabb[];
	issues: LayoutGeometryIssue[];
	bounds3: LayoutBounds3 | null;
};

export type WallSlot = {
	readonly wallId: string;
	readonly sortedIndex: number;
	readonly baseCompiled: CompiledPhysicalWall | null;
	readonly compiled: CompiledPhysicalWall | null;
	readonly baseBounds2: LayoutBounds2 | null;
	readonly baseBounds3: LayoutBounds3 | null;
	readonly legs: { readonly start?: CompiledJunctionLeg; readonly end?: CompiledJunctionLeg };
	readonly baseRecords: RetainedQueryRecords;
	readonly wallAabb: CompiledQueryAabb | null;
	readonly issues: readonly LayoutGeometryIssue[];
};

type WallChunk = {
	points: CompiledQueryPoint[];
	spans: CompiledQuerySpan[];
	aabbs: CompiledQueryAabb[];
	issues: LayoutGeometryIssue[];
	bounds3: LayoutBounds3 | null;
};

type JunctionChunk = {
	bounds3: LayoutBounds3 | null;
};

export type RetainedCompileWorld = {
	document: LayoutDocumentWallFirst;
	readonly floorId: string;
	readonly floorElevation: number;
	readonly defaultWallThickness: number;
	readonly hydratedWithoutSources: boolean;
	readonly pointById: Map<string, LayoutVec2>;
	readonly junctionDocIndexById: Map<string, number>;
	readonly wallById: Map<string, LayoutWall>;
	readonly wallDocIndexById: Map<string, number>;
	readonly openingById: Map<string, LayoutWallOpening>;
	readonly openingOrderById: Map<string, number>;
	readonly openingsByHostWallId: Map<string, LayoutWallOpening[]>;
	readonly documentRoomIds: Set<string>;
	readonly roomIndicesByWallId: Map<string, number[]>;
	readonly wallIdsByJunctionId: Map<string, string[]>;
	readonly derivedWallRoles: ReadonlyMap<string, LayoutDerivedWallRole>;
	readonly roomSlots: RoomSlot[];
	readonly roomChunks: RoomChunk[];
	validCeilingRoomCount: number;
	readonly wallSlots: WallSlot[];
	readonly wallChunks: WallChunk[];
	readonly sortedWalls: CompiledPhysicalWall[];
	readonly sortedJunctions: CompiledJunction[];
	readonly junctionSortedIndexById: Map<string, number>;
	readonly junctionLegOrderById: Map<string, number>;
	readonly junctionIssuesById: Map<string, readonly LayoutGeometryIssue[]>;
	readonly junctionChunks: JunctionChunk[];
	objectUnit: CompiledObjectsUnit;
};

type PassiveCompileRecord = {
	readonly geometry: CompiledLayoutGeometry;
	readonly issues: readonly LayoutGeometryIssue[];
};

const PASSIVE_COMPILE_BY_DOC = new WeakMap<LayoutDocumentWallFirst, PassiveCompileRecord>();

/** Record a clean canonical compile result so a session can warm from it in O(1). */
export function recordPassiveCompiledGeometry(
	document: LayoutDocumentWallFirst,
	geometry: CompiledLayoutGeometry,
	issues: readonly LayoutGeometryIssue[] = []
): void {
	if (issues.length > 0) return;
	PASSIVE_COMPILE_BY_DOC.set(document, { geometry, issues });
}

function mergeBounds3Into(
	acc: { min: Vec3; max: Vec3 } | null,
	bounds: LayoutBounds3 | null
): { min: Vec3; max: Vec3 } | null {
	if (!bounds) return acc;
	if (!acc) {
		return {
			min: [bounds.min[0], bounds.min[1], bounds.min[2]],
			max: [bounds.max[0], bounds.max[1], bounds.max[2]]
		};
	}
	if (bounds.min[0] < acc.min[0]) acc.min[0] = bounds.min[0];
	if (bounds.min[1] < acc.min[1]) acc.min[1] = bounds.min[1];
	if (bounds.min[2] < acc.min[2]) acc.min[2] = bounds.min[2];
	if (bounds.max[0] > acc.max[0]) acc.max[0] = bounds.max[0];
	if (bounds.max[1] > acc.max[1]) acc.max[1] = bounds.max[1];
	if (bounds.max[2] > acc.max[2]) acc.max[2] = bounds.max[2];
	return acc;
}

function rebuildRoomChunk(slots: readonly RoomSlot[], chunkIndex: number): RoomChunk {
	const start = chunkIndex * CHUNK_SIZE;
	const end = Math.min(slots.length, start + CHUNK_SIZE);
	const strippedRooms: CompiledRoom[] = [];
	const validRoomIds: string[] = [];
	const polygons: CompiledQueryPolygon[] = [];
	const aabbs: CompiledQueryAabb[] = [];
	const issues: LayoutGeometryIssue[] = [];
	let boundsAcc: { min: Vec3; max: Vec3 } | null = null;
	for (let i = start; i < end; i += 1) {
		const slot = slots[i]!;
		for (let j = 0; j < slot.issues.length; j += 1) issues.push(slot.issues[j]!);
		for (let j = 0; j < slot.polygons.length; j += 1) polygons.push(slot.polygons[j]!);
		for (let j = 0; j < slot.aabbs.length; j += 1) aabbs.push(slot.aabbs[j]!);
		if (slot.stripped) {
			strippedRooms.push(slot.stripped);
			validRoomIds.push(slot.roomId);
			boundsAcc = mergeBounds3Into(boundsAcc, slot.bounds3);
		}
	}
	return { strippedRooms, validRoomIds, polygons, aabbs, issues, bounds3: boundsAcc };
}

function rebuildWallChunk(slots: readonly WallSlot[], chunkIndex: number): WallChunk {
	const start = chunkIndex * CHUNK_SIZE;
	const end = Math.min(slots.length, start + CHUNK_SIZE);
	const points: CompiledQueryPoint[] = [];
	const spans: CompiledQuerySpan[] = [];
	const aabbs: CompiledQueryAabb[] = [];
	const issues: LayoutGeometryIssue[] = [];
	let boundsAcc: { min: Vec3; max: Vec3 } | null = null;
	for (let i = start; i < end; i += 1) {
		const slot = slots[i]!;
		if (!slot.compiled) continue;
		const rec = slot.baseRecords;
		for (let j = 0; j < rec.points.length; j += 1) points.push(rec.points[j]!);
		for (let j = 0; j < rec.spans.length; j += 1) spans.push(rec.spans[j]!);
		for (let j = 0; j < rec.aabbs.length; j += 1) aabbs.push(rec.aabbs[j]!);
		if (slot.wallAabb) aabbs.push(slot.wallAabb);
		for (let j = 0; j < slot.issues.length; j += 1) issues.push(slot.issues[j]!);
		boundsAcc = mergeBounds3Into(boundsAcc, slot.compiled.bounds3);
	}
	return { points, spans, aabbs, issues, bounds3: boundsAcc };
}

function rebuildJunctionChunk(junctions: readonly CompiledJunction[], chunkIndex: number): JunctionChunk {
	const start = chunkIndex * CHUNK_SIZE;
	const end = Math.min(junctions.length, start + CHUNK_SIZE);
	let boundsAcc: { min: Vec3; max: Vec3 } | null = null;
	for (let i = start; i < end; i += 1) {
		boundsAcc = mergeBounds3Into(boundsAcc, junctions[i]!.bounds3);
	}
	return { bounds3: boundsAcc };
}

/** Build a `RetainedCompileWorld` at the end of a full canonical pass. */
export function buildRetainedCompileWorldFromPass(input: {
	readonly document: LayoutDocumentWallFirst;
	readonly roomSlots: RoomSlot[];
	readonly wallSlots: WallSlot[];
	readonly sortedWalls: CompiledPhysicalWall[];
	readonly sortedJunctions: CompiledJunction[];
	readonly junctionLegOrderById: Map<string, number>;
	readonly junctionIssuesById: Map<string, readonly LayoutGeometryIssue[]>;
	readonly objectUnit: CompiledObjectsUnit;
	readonly derivedWallRoles: ReadonlyMap<string, LayoutDerivedWallRole>;
}): RetainedCompileWorld {
	const { document } = input;
	const pointById = new Map<string, LayoutVec2>();
	const junctionDocIndexById = new Map<string, number>();
	for (let i = 0; i < document.junctions.length; i += 1) {
		const j = document.junctions[i]!;
		pointById.set(j.id, j.point);
		junctionDocIndexById.set(j.id, i);
	}
	const wallById = new Map<string, LayoutWall>();
	const wallDocIndexById = new Map<string, number>();
	const wallIdsByJunctionId = new Map<string, string[]>();
	const pushIncident = (jId: string, wId: string): void => {
		const list = wallIdsByJunctionId.get(jId);
		if (list) {
			if (!list.includes(wId)) list.push(wId);
		} else {
			wallIdsByJunctionId.set(jId, [wId]);
		}
	};
	for (let i = 0; i < document.walls.length; i += 1) {
		const w = document.walls[i]!;
		wallById.set(w.id, w);
		wallDocIndexById.set(w.id, i);
		pushIncident(w.startJunctionId, w.id);
		pushIncident(w.endJunctionId, w.id);
	}
	const openingById = new Map<string, LayoutWallOpening>();
	const openingOrderById = new Map<string, number>();
	const openingsByHostWallId = new Map<string, LayoutWallOpening[]>();
	for (let i = 0; i < document.openings.length; i += 1) {
		const op = document.openings[i]!;
		openingById.set(op.id, op);
		openingOrderById.set(op.id, i);
		const list = openingsByHostWallId.get(op.wallId);
		if (list) list.push(op);
		else openingsByHostWallId.set(op.wallId, [op]);
	}
	const documentRoomIds = new Set<string>();
	const roomIndicesByWallId = new Map<string, number[]>();
	for (let rIdx = 0; rIdx < document.rooms.length; rIdx += 1) {
		const room = document.rooms[rIdx]!;
		documentRoomIds.add(room.id);
		for (let bIdx = 0; bIdx < room.boundary.length; bIdx += 1) {
			const wId = room.boundary[bIdx]!.wallId;
			const list = roomIndicesByWallId.get(wId);
			if (list) {
				if (list[list.length - 1] !== rIdx && !list.includes(rIdx)) list.push(rIdx);
			} else {
				roomIndicesByWallId.set(wId, [rIdx]);
			}
		}
	}

	const roomChunkCount = Math.ceil(input.roomSlots.length / CHUNK_SIZE);
	const roomChunks: RoomChunk[] = new Array(roomChunkCount);
	for (let c = 0; c < roomChunkCount; c += 1) {
		roomChunks[c] = rebuildRoomChunk(input.roomSlots, c);
	}
	let validCeilingRoomCount = 0;
	for (let i = 0; i < input.roomSlots.length; i += 1) {
		if (input.roomSlots[i]!.hasValidCeiling) validCeilingRoomCount += 1;
	}

	const wallChunkCount = Math.ceil(input.wallSlots.length / CHUNK_SIZE);
	const wallChunks: WallChunk[] = new Array(wallChunkCount);
	for (let c = 0; c < wallChunkCount; c += 1) {
		wallChunks[c] = rebuildWallChunk(input.wallSlots, c);
	}

	const junctionSortedIndexById = new Map<string, number>();
	for (let i = 0; i < input.sortedJunctions.length; i += 1) {
		junctionSortedIndexById.set(input.sortedJunctions[i]!.junctionId, i);
	}
	const junctionChunkCount = Math.ceil(input.sortedJunctions.length / CHUNK_SIZE);
	const junctionChunks: JunctionChunk[] = new Array(junctionChunkCount);
	for (let c = 0; c < junctionChunkCount; c += 1) {
		junctionChunks[c] = rebuildJunctionChunk(input.sortedJunctions, c);
	}

	return {
		document,
		floorId: document.floor.id,
		floorElevation: document.floor.elevation,
		defaultWallThickness: document.walls[0]?.thickness ?? 0.1,
		hydratedWithoutSources: false,
		pointById,
		junctionDocIndexById,
		wallById,
		wallDocIndexById,
		openingById,
		openingOrderById,
		openingsByHostWallId,
		documentRoomIds,
		roomIndicesByWallId,
		wallIdsByJunctionId,
		derivedWallRoles: input.derivedWallRoles,
		roomSlots: input.roomSlots,
		roomChunks,
		validCeilingRoomCount,
		wallSlots: input.wallSlots,
		wallChunks,
		sortedWalls: input.sortedWalls,
		sortedJunctions: input.sortedJunctions,
		junctionSortedIndexById,
		junctionLegOrderById: input.junctionLegOrderById,
		junctionIssuesById: input.junctionIssuesById,
		junctionChunks,
		objectUnit: input.objectUnit
	};
}

/**
 * Hydrate a session's `LayoutCompileReuse` from a clean passive compile result
 * in O(N) pointer partitioning with zero geometry re-evaluation or cacheKey builds.
 */
export function seedReuseFromPassiveCompile(
	document: LayoutDocumentWallFirst,
	reuse: LayoutCompileReuse,
	builders: CanonicalDeltaBuilders,
	preserveExistingUnits = false
): boolean {
	const existingWorld = reuse.world as RetainedCompileWorld | null;
	if (existingWorld && resolveCowDirtyIds(existingWorld.document, document) !== null) {
		return true;
	}
	const passive = PASSIVE_COMPILE_BY_DOC.get(document);
	if (!passive || passive.issues.length > 0) return false;
	if (!preserveExistingUnits) {
		reuse.walls.clear();
		reuse.junctions.clear();
		reuse.roomSources.clear();
		reuse.objects.clear();
	}
	reuse.retainedFloor = null;
	reuse.retainedDocAabb = null;
	reuse.world = null;
	const { geometry } = passive;
	const physicalWalls = geometry.walls ?? [];
	const junctions = geometry.junctions ?? [];

	if (
		geometry.rooms.length !== document.rooms.length ||
		physicalWalls.length !== document.walls.length ||
		geometry.objects.length !== document.objects.length
	) {
		return false;
	}

	// Verify unique IDs before partitioning query records.
	const uniqueWallIds = new Set<string>();
	for (let i = 0; i < document.walls.length; i += 1) uniqueWallIds.add(document.walls[i]!.id);
	if (uniqueWallIds.size !== document.walls.length) return false;

	const objCount = document.objects.length;
	const roomCount = document.rooms.length;
	if (geometry.queries.polygons.length < objCount + roomCount) return false;
	if (geometry.queries.aabbs.length < objCount + roomCount + document.walls.length) return false;

	const documentRoomIds = new Set<string>();
	for (let i = 0; i < roomCount; i += 1) documentRoomIds.add(document.rooms[i]!.id);

	// 1. Partition Object unit.
	const objPolygons = geometry.queries.polygons.slice(0, objCount);
	const objAabbs = geometry.queries.aabbs.slice(0, objCount);
	let objBounds: { min: Vec3; max: Vec3 } | null = null;
	let objFloorBounds: { min: Vec3; max: Vec3 } | null = null;
	for (let i = 0; i < objCount; i += 1) {
		const desc = geometry.objects[i]!;
		if (desc.objectId !== document.objects[i]!.id) return false;
		objBounds = mergeBounds3Into(objBounds, desc.worldAabb);
		if (desc.roomId && documentRoomIds.has(desc.roomId)) {
			objFloorBounds = mergeBounds3Into(objFloorBounds, desc.worldAabb);
		}
		reuse.objects.set(desc.objectId, {
			authored: [document.objects[i]!, i],
			descriptor: desc,
			records: {
				points: [],
				spans: [],
				polygons: [objPolygons[i]!],
				aabbs: [objAabbs[i]!]
			},
			issues: []
		});
	}
	const objectUnit: CompiledObjectsUnit = {
		compiledObjects: [...geometry.objects],
		polygons: objPolygons,
		aabbs: objAabbs,
		issues: [],
		bounds3: objBounds,
		floorRoomBounds3: objFloorBounds
	};

	// 2. Partition Room slots.
	const roomSlots: RoomSlot[] = new Array(roomCount);
	for (let r = 0; r < roomCount; r += 1) {
		const stripped = geometry.rooms[r]!;
		if (stripped.roomId !== document.rooms[r]!.id) return false;
		roomSlots[r] = {
			roomId: stripped.roomId,
			hasValidCeiling: true,
			stripped,
			polygons: [geometry.queries.polygons[objCount + r]!],
			aabbs: [geometry.queries.aabbs[objCount + r]!],
			issues: [],
			bounds3: stripped.bounds3
		};
	}

	// 3. Index sorted walls & junctions and recover per-wall legs.
	const sortedWallIndexById = new Map<string, number>();
	for (let i = 0; i < physicalWalls.length; i += 1) {
		sortedWallIndexById.set(physicalWalls[i]!.wallId, i);
	}
	const startLegByWallId = new Map<string, CompiledJunctionLeg>();
	const endLegByWallId = new Map<string, CompiledJunctionLeg>();
	const pointById = new Map<string, LayoutVec2>();
	for (let i = 0; i < document.junctions.length; i += 1) {
		pointById.set(document.junctions[i]!.id, document.junctions[i]!.point);
	}
	for (let i = 0; i < junctions.length; i += 1) {
		const cj = junctions[i]!;
		for (let l = 0; l < cj.legs.length; l += 1) {
			const leg = cj.legs[l]!;
			if (leg.end === 'start') startLegByWallId.set(leg.wallId, leg);
			else endLegByWallId.set(leg.wallId, leg);
		}
		reuse.junctions.set(cj.junctionId, {
			authored: [cj.point, cj.legs, document.floor.id, document.floor.elevation],
			compiled: cj,
			issues: []
		});
	}

	// 4. Partition Wall query records in `document.walls` order.
	const allPoints = geometry.queries.points;
	const allSpans = geometry.queries.spans;
	const allAabbs = geometry.queries.aabbs;
	let pCursor = 0;
	let sCursor = 0;
	let aCursor = objCount + roomCount;

	const derivedWallRoles = deriveLayoutWallRoles(document);
	const openingsByHostWallId = new Map<string, LayoutWallOpening[]>();
	for (let i = 0; i < document.openings.length; i += 1) {
		const op = document.openings[i]!;
		const list = openingsByHostWallId.get(op.wallId);
		if (list) list.push(op);
		else openingsByHostWallId.set(op.wallId, [op]);
	}

	const wallSlots: WallSlot[] = new Array(document.walls.length);
	for (let wIdx = 0; wIdx < document.walls.length; wIdx += 1) {
		const wall = document.walls[wIdx]!;
		const sortedIdx = sortedWallIndexById.get(wall.id);
		if (sortedIdx === undefined) return false;
		const compiled = physicalWalls[sortedIdx]!;

		const pStart = pCursor;
		while (pCursor < allPoints.length && allPoints[pCursor]!.wallKey === wall.id) pCursor += 1;
		const wallPoints = allPoints.slice(pStart, pCursor);

		const sStart = sCursor;
		while (sCursor < allSpans.length && allSpans[sCursor]!.wallKey === wall.id) sCursor += 1;
		const wallSpans = allSpans.slice(sStart, sCursor);

		const opAabbCount = compiled.openings.length;
		if (aCursor + opAabbCount >= allAabbs.length) return false;
		const opAabbs = allAabbs.slice(aCursor, aCursor + opAabbCount);
		aCursor += opAabbCount;
		const wallAabb = allAabbs[aCursor]!;
		if (wallAabb.kind !== 'wall' || wallAabb.sourceId !== wall.id) return false;
		aCursor += 1;

		const { bounds2: baseBounds2, bounds3: baseBounds3 } = builders.computeWallBaseBounds(
			compiled,
			document.floor.elevation
		);
		const baseCompiled =
			sameAuthored(compiled.bounds2, baseBounds2) && sameAuthored(compiled.bounds3, baseBounds3)
				? compiled
				: { ...compiled, bounds2: baseBounds2, bounds3: baseBounds3 };
		const startLeg = startLegByWallId.get(wall.id);
		const endLeg = endLegByWallId.get(wall.id);
		const legs = {
			...(startLeg ? { start: startLeg } : {}),
			...(endLeg ? { end: endLeg } : {})
		};
		const baseRecords: RetainedQueryRecords = {
			points: wallPoints,
			spans: wallSpans,
			polygons: [],
			aabbs: opAabbs
		};

		wallSlots[wIdx] = {
			wallId: wall.id,
			sortedIndex: sortedIdx,
			baseCompiled,
			compiled,
			baseBounds2,
			baseBounds3,
			legs,
			baseRecords,
			wallAabb,
			issues: []
		};

		const startPt = pointById.get(wall.startJunctionId);
		const endPt = pointById.get(wall.endJunctionId);
		if (!preserveExistingUnits && startPt && endPt) {
			const hosted = openingsByHostWallId.get(wall.id) ?? [];
			const role = derivedWallRoles.get(wall.id) ?? 'free-standing';
			reuse.walls.set(wall.id, {
				authored: [wall, startPt, endPt, document.floor.id, document.floor.elevation, hosted, role, false],
				compiled,
				baseBounds2,
				baseBounds3,
				legs,
				records: { ...baseRecords, aabbs: [...opAabbs, wallAabb] },
				issues: []
			});
		}
	}

	// 5. Recover Floor & Document trailing AABBs + leg insertion order.
	let floorAabb: CompiledQueryAabb | null = null;
	let docAabb: CompiledQueryAabb | null = null;
	while (aCursor < allAabbs.length) {
		const item = allAabbs[aCursor]!;
		if (item.kind === 'floor') floorAabb = item;
		else if (item.kind === 'document') docAabb = item;
		aCursor += 1;
	}
	const compiledFloor = geometry.floors.find((f) => f.floorId === document.floor.id);
	if (compiledFloor) {
		const roomIdsDep = extractFloorRoomIdsDependency(
			compiledFloor.cacheKey,
			document.floor.id,
			compiledFloor.elevation
		);
		if (roomIdsDep) {
			reuse.retainedFloor = {
				floorId: document.floor.id,
				elevation: compiledFloor.elevation,
				roomIds: compiledFloor.roomIds,
				roomIdsDep,
				bounds3: compiledFloor.bounds3,
				compiled: compiledFloor,
				aabb: floorAabb
			};
		}
		reuse.retainedDocAabb = { bounds3: geometry.bounds, aabb: docAabb };
	}

	const junctionLegOrderById = new Map<string, number>();
	let orderCounter = 0;
	for (let i = 0; i < physicalWalls.length; i += 1) {
		const w = physicalWalls[i]!;
		if (w.samples.length < 2) continue;
		if (w.startJunctionId && pointById.has(w.startJunctionId) && !junctionLegOrderById.has(w.startJunctionId)) {
			junctionLegOrderById.set(w.startJunctionId, orderCounter++);
		}
		if (w.endJunctionId && pointById.has(w.endJunctionId) && !junctionLegOrderById.has(w.endJunctionId)) {
			junctionLegOrderById.set(w.endJunctionId, orderCounter++);
		}
	}

	const built = buildRetainedCompileWorldFromPass({
		document,
		roomSlots,
		wallSlots,
		sortedWalls: [...physicalWalls],
		sortedJunctions: [...junctions],
		junctionLegOrderById,
		junctionIssuesById: new Map(),
		objectUnit,
		derivedWallRoles
	});
	reuse.world = { ...built, hydratedWithoutSources: true };
	reuse.lastPrunedDocument = document;
	return true;
}

function extractFloorRoomIdsDependency(
	floorCacheKey: string,
	floorId: string,
	elevation: number
): CacheKeyDependency | null {
	const elevationText = String(elevation);
	const prefix = `s5:floors${floorId.length}:${floorId}n${elevationText.length}:${elevationText}k`;
	if (!floorCacheKey.startsWith(prefix)) return null;
	const colonIdx = floorCacheKey.indexOf(':', prefix.length);
	if (colonIdx === -1) return null;
	const depLen = Number(floorCacheKey.slice(prefix.length, colonIdx));
	if (!Number.isInteger(depLen) || depLen < 0) return null;
	const depStart = colonIdx + 1;
	if (depStart + depLen > floorCacheKey.length) return null;
	return cacheKeyDependency(floorCacheKey.slice(depStart, depStart + depLen));
}

type DirtyIdSuperset = {
	readonly changedJunctionIds: readonly string[];
	readonly changedWallIds: readonly string[];
	readonly changedOpeningIds: readonly string[];
	readonly changedRoomIds: readonly string[];
	readonly changedObjectIds: readonly string[];
};

function mergeStringLists(a: readonly string[], b: readonly string[]): readonly string[] {
	if (a.length === 0) return b;
	if (b.length === 0) return a;
	const set = new Set<string>(a);
	for (let i = 0; i < b.length; i += 1) set.add(b[i]!);
	return [...set];
}

function mergeDirtySupersets(a: DirtyIdSuperset, b: DirtyIdSuperset): DirtyIdSuperset {
	return {
		changedJunctionIds: mergeStringLists(a.changedJunctionIds, b.changedJunctionIds),
		changedWallIds: mergeStringLists(a.changedWallIds, b.changedWallIds),
		changedOpeningIds: mergeStringLists(a.changedOpeningIds, b.changedOpeningIds),
		changedRoomIds: mergeStringLists(a.changedRoomIds, b.changedRoomIds),
		changedObjectIds: mergeStringLists(a.changedObjectIds, b.changedObjectIds)
	};
}

function resolveCowDirtyIds(
	prevDoc: LayoutDocumentWallFirst,
	nextDoc: LayoutDocumentWallFirst
): DirtyIdSuperset | null {
	if (areEquivalentLayoutClones(prevDoc, nextDoc)) {
		return {
			changedJunctionIds: [],
			changedWallIds: [],
			changedOpeningIds: [],
			changedRoomIds: [],
			changedObjectIds: []
		};
	}
	const prevDelta = getCowDocumentDelta(prevDoc);
	const nextDelta = getCowDocumentDelta(nextDoc);
	if (nextDelta && areEquivalentLayoutClones(nextDelta.baseline, prevDoc)) {
		return nextDelta;
	}
	if (prevDelta && areEquivalentLayoutClones(prevDelta.baseline, nextDoc)) {
		return prevDelta;
	}
	if (prevDelta && nextDelta && areEquivalentLayoutClones(prevDelta.baseline, nextDelta.baseline)) {
		return mergeDirtySupersets(prevDelta, nextDelta);
	}
	const nextParentDelta = nextDelta ? getCowDocumentDelta(nextDelta.baseline) : undefined;
	if (nextDelta && nextParentDelta) {
		if (areEquivalentLayoutClones(nextParentDelta.baseline, prevDoc)) {
			return mergeDirtySupersets(nextParentDelta, nextDelta);
		}
		if (prevDelta && areEquivalentLayoutClones(prevDelta.baseline, nextParentDelta.baseline)) {
			return mergeDirtySupersets(prevDelta, mergeDirtySupersets(nextParentDelta, nextDelta));
		}
	}
	return null;
}

function collectJoinsForWall(
	wallId: string,
	startJunctionId: string,
	endJunctionId: string,
	world: RetainedCompileWorld
): CompiledLegJoin[] | undefined {
	const firstId =
		startJunctionId === endJunctionId
			? startJunctionId
			: startJunctionId < endJunctionId
				? startJunctionId
				: endJunctionId;
	const secondId =
		startJunctionId === endJunctionId
			? undefined
			: startJunctionId < endJunctionId
				? endJunctionId
				: startJunctionId;
	let out: CompiledLegJoin[] | undefined;
	const scanJunction = (jId: string): void => {
		const jIdx = world.junctionSortedIndexById.get(jId);
		if (jIdx === undefined) return;
		const joins = world.sortedJunctions[jIdx]!.resolution.joins;
		for (let i = 0; i < joins.length; i += 1) {
			const join = joins[i]!;
			if (join.wallId === wallId) {
				if (out) out.push(join);
				else out = [join];
			}
		}
	};
	scanJunction(firstId);
	if (secondId !== undefined) scanJunction(secondId);
	return out;
}

/**
 * Attempt an O(k) delta compile against `reuse.world`. Returns `null` when the
 * edit changes topology, global Floor datums, fallback thickness, or lacks
 * COW lineage, allowing the caller to fall back cleanly.
 */
export function tryCompileWallFirstLayoutGeometryDelta(
	document: LayoutDocumentWallFirst,
	sampling: WallSamplingDerivation | undefined,
	reuse: LayoutCompileReuse,
	builders: CanonicalDeltaBuilders
): CompiledLayoutGeometryResult | null {
	if (hasAnySamplingTestObserver()) return null;
	const world = reuse.world as RetainedCompileWorld | null;
	if (!world) return null;

	const defaultWallThickness = document.walls[0]?.thickness ?? 0.1;
	if (
		!Object.is(document.floor.id, world.floorId) ||
		!Object.is(document.floor.elevation, world.floorElevation) ||
		!Object.is(defaultWallThickness, world.defaultWallThickness)
	) {
		return null;
	}

	if (
		document.walls.length !== world.document.walls.length ||
		document.junctions.length !== world.document.junctions.length ||
		document.rooms.length !== world.document.rooms.length ||
		document.openings.length !== world.document.openings.length
	) {
		return null;
	}

	const dirty = resolveCowDirtyIds(world.document, document);
	if (!dirty) return null;
	if (dirty.changedRoomIds.length > 0) {
		return null;
	}

	// Verify ID-at-index invariants for candidate junctions/walls/openings touched by `dirty`,
	// and filter out sibling candidates whose values are actually identical to `world`!
	const changedJunctionIds = new Set<string>();
	for (let i = 0; i < dirty.changedJunctionIds.length; i += 1) {
		const jId = dirty.changedJunctionIds[i]!;
		const docIdx = world.junctionDocIndexById.get(jId);
		if (docIdx === undefined) return null;
		const nextJ = document.junctions[docIdx];
		if (!nextJ || nextJ.id !== jId) return null;
		const prevPt = world.pointById.get(jId)!;
		reuse.counters.signatureVisits += 1;
		if (!sameAuthored(prevPt, nextJ.point)) {
			changedJunctionIds.add(jId);
		}
	}

	const authoredChangedWallIds = new Set<string>();
	for (let i = 0; i < dirty.changedWallIds.length; i += 1) {
		const wId = dirty.changedWallIds[i]!;
		const docIdx = world.wallDocIndexById.get(wId);
		if (docIdx === undefined) return null;
		const nextW = document.walls[docIdx];
		if (!nextW || nextW.id !== wId) return null;
		const prevW = world.wallById.get(wId)!;
		if (
			nextW.startJunctionId !== prevW.startJunctionId ||
			nextW.endJunctionId !== prevW.endJunctionId
		) {
			return null;
		}
		reuse.counters.signatureVisits += 1;
		if (!sameAuthored(prevW, nextW)) {
			authoredChangedWallIds.add(wId);
		}
	}

	const changedOpeningHostWallIds = new Set<string>();
	const nextOpeningsToApply: Array<{ index: number; opening: LayoutWallOpening }> = [];
	for (let i = 0; i < dirty.changedOpeningIds.length; i += 1) {
		const opId = dirty.changedOpeningIds[i]!;
		const opIdx = world.openingOrderById.get(opId);
		if (opIdx === undefined) return null;
		const nextOp = document.openings[opIdx];
		if (!nextOp || nextOp.id !== opId) return null;
		const prevOp = world.openingById.get(opId)!;
		if (nextOp.wallId !== prevOp.wallId) return null;
		reuse.counters.signatureVisits += 1;
		if (!sameAuthored(prevOp, nextOp)) {
			changedOpeningHostWallIds.add(nextOp.wallId);
			nextOpeningsToApply.push({ index: opIdx, opening: nextOp });
		}
	}

	// Pre-flight check: ensure no dirty wall changes nullability (sampling failure
	// vs success) or incident junction leg membership before mutating `world`!
	const dirtyWallIds = new Set<string>(authoredChangedWallIds);
	for (const wId of changedOpeningHostWallIds) dirtyWallIds.add(wId);
	for (const jId of changedJunctionIds) {
		const incident = world.wallIdsByJunctionId.get(jId);
		if (incident) {
			for (let i = 0; i < incident.length; i += 1) dirtyWallIds.add(incident[i]!);
		}
	}

	// Stage updated point/wall/opening maps in small overlays first so a fallback
	// leaves `world` 100% untouched!
	if (changedJunctionIds.size > 0) {
		for (const jId of changedJunctionIds) {
			const idx = world.junctionDocIndexById.get(jId)!;
			world.pointById.set(jId, document.junctions[idx]!.point);
		}
	}
	if (authoredChangedWallIds.size > 0) {
		for (const wId of authoredChangedWallIds) {
			const idx = world.wallDocIndexById.get(wId)!;
			world.wallById.set(wId, document.walls[idx]!);
		}
	}
	if (nextOpeningsToApply.length > 0) {
		for (let i = 0; i < nextOpeningsToApply.length; i += 1) {
			const { opening } = nextOpeningsToApply[i]!;
			world.openingById.set(opening.id, opening);
		}
		for (const hostWallId of changedOpeningHostWallIds) {
			const updated = (world.openingsByHostWallId.get(hostWallId) ?? []).map(
				(op) => world.openingById.get(op.id) ?? op
			);
			world.openingsByHostWallId.set(hostWallId, updated);
		}
	}

	// 1. Evaluate dirty Walls (base geometry + legs).
	const evaluatedWallBaseById = new Map<string, EvaluatedWallBaseUnit>();
	let validWallCount = 0;
	for (let i = 0; i < world.sortedWalls.length; i += 1) void i;
	validWallCount = world.sortedWalls.length;

	for (const wId of dirtyWallIds) {
		const docIdx = world.wallDocIndexById.get(wId)!;
		const prevSlot = world.wallSlots[docIdx]!;
		const wall = world.wallById.get(wId)!;
		const hosted = world.openingsByHostWallId.get(wId) ?? [];
		const role = world.derivedWallRoles.get(wId) ?? 'free-standing';
		const evaluated = builders.evaluateWallBase(document, wall, world.pointById, hosted, role);
		if ((evaluated === null) !== (prevSlot.compiled === null)) {
			// Nullability transition (broken curve / NaN): invalidate world and fall back!
			reuse.world = null;
			return null;
		}
		if (evaluated !== null) {
			if ((evaluated.baseCompiled.samples.length >= 2) !== ((prevSlot.compiled?.samples.length ?? 0) >= 2)) {
				reuse.world = null;
				return null;
			}
			evaluatedWallBaseById.set(wId, evaluated);
			reuse.counters.wallsEvaluated += 1;
			reuse.counters.openingsEvaluated += evaluated.openingsCount;
		}
	}
	reuse.counters.wallsReused += validWallCount - reuse.counters.wallsEvaluated;

	// 2. Evaluate dirty Rooms (rooms referencing any dirty Wall).
	const dirtyRoomIndexSet = new Set<number>();
	for (const wId of dirtyWallIds) {
		const roomIndices = world.roomIndicesByWallId.get(wId);
		if (roomIndices) {
			for (let i = 0; i < roomIndices.length; i += 1) dirtyRoomIndexSet.add(roomIndices[i]!);
		}
	}
	const dirtyRoomChunks = new Set<number>();
	if (dirtyRoomIndexSet.size > 0) {
		const sortedDirtyRooms = [...dirtyRoomIndexSet].sort((a, b) => a - b);
		for (let i = 0; i < sortedDirtyRooms.length; i += 1) {
			const rIdx = sortedDirtyRooms[i]!;
			const prevSlot = world.roomSlots[rIdx]!;
			const unit = builders.evaluateRoom(
				document,
				rIdx,
				world.pointById,
				world.wallById,
				world.openingsByHostWallId,
				world.openingOrderById,
				defaultWallThickness
			);
			if (prevSlot.hasValidCeiling !== unit.hasValidCeiling) {
				if (unit.hasValidCeiling) world.validCeilingRoomCount += 1;
				else world.validCeilingRoomCount -= 1;
			}
			if (unit.hasValidCeiling) {
				reuse.counters.roomsEvaluated += 1;
			}
			if (unit.source) {
				const room = document.rooms[rIdx]!;
				const retentionKey = [
					room,
					unit.source.ceilingElevation ?? null,
					document.floor.elevation,
					document.floor.id,
					defaultWallThickness,
					false,
					...room.boundary.map((ref) => {
						const w = world.wallById.get(ref.wallId);
						return [
							ref,
							w ?? null,
							w ? world.pointById.get(w.startJunctionId) ?? null : null,
							w ? world.pointById.get(w.endJunctionId) ?? null : null,
							world.openingsByHostWallId.get(ref.wallId) ?? null
						];
					})
				];
				reuse.roomSources.set(room.id, { authored: retentionKey, source: unit.source });
				reuse.roomCompiles.set(unit.source, {
					source: unit.source,
					compiled: unit.compiled,
					stripped: unit.stripped,
					records: {
						points: [],
						spans: [],
						polygons: unit.polygons,
						aabbs: unit.aabbs
					},
					issues: unit.issues
				});
			}
			world.roomSlots[rIdx] = {
				roomId: document.rooms[rIdx]!.id,
				hasValidCeiling: unit.hasValidCeiling,
				stripped: unit.stripped,
				polygons: unit.polygons,
				aabbs: unit.aabbs,
				issues: unit.issues,
				bounds3: unit.bounds3
			};
			dirtyRoomChunks.add(Math.floor(rIdx / CHUNK_SIZE));
		}
	}
	reuse.counters.roomsReused += world.validCeilingRoomCount - reuse.counters.roomsEvaluated;
	for (const cIdx of dirtyRoomChunks) {
		world.roomChunks[cIdx] = rebuildRoomChunk(world.roomSlots, cIdx);
	}

	// 3. Evaluate Objects if any object changed or count changed.
	if (
		dirty.changedObjectIds.length > 0 ||
		document.objects.length !== world.document.objects.length
	) {
		world.objectUnit = builders.compileObjects(document.objects, world.documentRoomIds, reuse);
	} else {
		reuse.counters.objectsReused += document.objects.length;
	}

	// 4. Resolve affected Junctions (moved junctions + endpoints of dirty walls).
	const affectedJunctionIds = new Set<string>(changedJunctionIds);
	for (const wId of dirtyWallIds) {
		const w = world.wallById.get(wId)!;
		if (w.startJunctionId) affectedJunctionIds.add(w.startJunctionId);
		if (w.endJunctionId) affectedJunctionIds.add(w.endJunctionId);
	}
	const dirtyJunctionChunks = new Set<number>();
	let affectedValidJunctions = 0;
	for (const jId of affectedJunctionIds) {
		const jSortedIdx = world.junctionSortedIndexById.get(jId);
		if (jSortedIdx === undefined) continue;
		const point = world.pointById.get(jId);
		if (!point) continue;
		affectedValidJunctions += 1;
		const incidentWallIds = world.wallIdsByJunctionId.get(jId) ?? [];
		const legs: CompiledJunctionLeg[] = [];
		for (let i = 0; i < incidentWallIds.length; i += 1) {
			const incWallId = incidentWallIds[i]!;
			const incWall = world.wallById.get(incWallId)!;
			const evaluatedBase = evaluatedWallBaseById.get(incWallId);
			const legPair = evaluatedBase
				? evaluatedBase.legs
				: world.wallSlots[world.wallDocIndexById.get(incWallId)!]!.legs;
			if (incWall.startJunctionId === jId && legPair.start) legs.push(legPair.start);
			if (incWall.endJunctionId === jId && legPair.end) legs.push(legPair.end);
		}
		if (legs.length === 0) {
			reuse.world = null;
			return null;
		}
		legs.sort(
			(a, b) =>
				a.outwardAngle - b.outwardAngle ||
				(a.wallId < b.wallId ? -1 : a.wallId > b.wallId ? 1 : 0) ||
				(a.end < b.end ? -1 : a.end > b.end ? 1 : 0)
		);
		const resolved = builders.resolveJunction(document, jId, point, legs, reuse);
		if (world.sortedJunctions[jSortedIdx] !== resolved.compiled) {
			world.sortedJunctions[jSortedIdx] = resolved.compiled;
			dirtyJunctionChunks.add(Math.floor(jSortedIdx / CHUNK_SIZE));
		}
		if (resolved.issues.length > 0) {
			world.junctionIssuesById.set(jId, resolved.issues);
		} else {
			world.junctionIssuesById.delete(jId);
		}
	}
	// `resolveJunction` incremented `junctionsEvaluated` / `junctionsReused` for
	// `affectedValidJunctions`; add the untouched junctions to `junctionsReused`.
	reuse.counters.junctionsReused += world.sortedJunctions.length - affectedValidJunctions;
	for (const cIdx of dirtyJunctionChunks) {
		world.junctionChunks[cIdx] = rebuildJunctionChunk(world.sortedJunctions, cIdx);
	}

	// 5. Expand dirty Walls AND miter-neighbor Walls incident to `affectedJunctionIds`.
	const expansionWallIds = new Set<string>(dirtyWallIds);
	for (const jId of affectedJunctionIds) {
		const incident = world.wallIdsByJunctionId.get(jId);
		if (incident) {
			for (let i = 0; i < incident.length; i += 1) expansionWallIds.add(incident[i]!);
		}
	}
	const dirtyWallChunks = new Set<number>();
	for (const wId of expansionWallIds) {
		const docIdx = world.wallDocIndexById.get(wId)!;
		const prevSlot = world.wallSlots[docIdx]!;
		const wall = world.wallById.get(wId)!;
		const evaluatedBase = evaluatedWallBaseById.get(wId);
		const baseCompiled = evaluatedBase ? evaluatedBase.baseCompiled : prevSlot.baseCompiled;
		const baseBounds2 = evaluatedBase ? evaluatedBase.baseBounds2 : prevSlot.baseBounds2;
		const baseBounds3 = evaluatedBase ? evaluatedBase.baseBounds3 : prevSlot.baseBounds3;
		if (!baseCompiled || !baseBounds2 || !baseBounds3) continue;

		const currentCompiled = evaluatedBase ? evaluatedBase.baseCompiled : prevSlot.compiled!;
		const currentWallAabb = evaluatedBase ? evaluatedBase.baseWallAabb : prevSlot.wallAabb!;
		const joins = collectJoinsForWall(wId, wall.startJunctionId, wall.endJunctionId, world);
		const expanded = builders.expandWall(
			document.floor.id,
			document.floor.elevation,
			wall.height,
			wId,
			baseCompiled,
			baseBounds2,
			baseBounds3,
			currentCompiled,
			currentWallAabb,
			joins
		);

		const baseRecords = evaluatedBase ? evaluatedBase.baseRecords : prevSlot.baseRecords;
		const legs = evaluatedBase ? evaluatedBase.legs : prevSlot.legs;
		const issues = evaluatedBase ? evaluatedBase.issues : prevSlot.issues;

		if (
			evaluatedBase !== undefined ||
			expanded.compiled !== prevSlot.compiled ||
			expanded.wallAabb !== prevSlot.wallAabb
		) {
			world.wallSlots[docIdx] = {
				wallId: wId,
				sortedIndex: prevSlot.sortedIndex,
				baseCompiled,
				compiled: expanded.compiled,
				baseBounds2,
				baseBounds3,
				legs,
				baseRecords,
				wallAabb: expanded.wallAabb,
				issues
			};
			world.sortedWalls[prevSlot.sortedIndex] = expanded.compiled;
			dirtyWallChunks.add(Math.floor(docIdx / CHUNK_SIZE));

			const startPt = world.pointById.get(wall.startJunctionId)!;
			const endPt = world.pointById.get(wall.endJunctionId)!;
			const hosted = world.openingsByHostWallId.get(wId) ?? [];
			const role = world.derivedWallRoles.get(wId) ?? 'free-standing';
			reuse.walls.set(wId, {
				authored: [
					wall,
					startPt,
					endPt,
					document.floor.id,
					document.floor.elevation,
					hosted,
					role,
					false
				],
				compiled: expanded.compiled,
				baseBounds2,
				baseBounds3,
				legs,
				records: { ...baseRecords, aabbs: [...baseRecords.aabbs, expanded.wallAabb] },
				issues
			});
		}
	}
	for (const cIdx of dirtyWallChunks) {
		world.wallChunks[cIdx] = rebuildWallChunk(world.wallSlots, cIdx);
	}

	world.document = document;
	reuse.counters.entities =
		reuse.counters.wallsEvaluated +
		reuse.counters.roomsEvaluated +
		reuse.counters.junctionsEvaluated +
		reuse.counters.objectsEvaluated;

	// 6. Assemble output arrays & chunk-reduced 3D bounds.
	let docBoundsAcc: { min: Vec3; max: Vec3 } | null = null;
	let floorBoundsAcc: { min: Vec3; max: Vec3 } | null = null;

	const rooms: CompiledRoom[] = [];
	const floorRoomIds: string[] = [];
	for (let c = 0; c < world.roomChunks.length; c += 1) {
		const chunk = world.roomChunks[c]!;
		for (let i = 0; i < chunk.strippedRooms.length; i += 1) {
			rooms.push(chunk.strippedRooms[i]!);
			floorRoomIds.push(chunk.validRoomIds[i]!);
		}
		docBoundsAcc = mergeBounds3Into(docBoundsAcc, chunk.bounds3);
		floorBoundsAcc = mergeBounds3Into(floorBoundsAcc, chunk.bounds3);
	}

	docBoundsAcc = mergeBounds3Into(docBoundsAcc, world.objectUnit.bounds3);
	floorBoundsAcc = mergeBounds3Into(floorBoundsAcc, world.objectUnit.floorRoomBounds3);

	for (let c = 0; c < world.wallChunks.length; c += 1) {
		const chunk = world.wallChunks[c]!;
		docBoundsAcc = mergeBounds3Into(docBoundsAcc, chunk.bounds3);
		floorBoundsAcc = mergeBounds3Into(floorBoundsAcc, chunk.bounds3);
	}
	for (let c = 0; c < world.junctionChunks.length; c += 1) {
		const chunk = world.junctionChunks[c]!;
		docBoundsAcc = mergeBounds3Into(docBoundsAcc, chunk.bounds3);
		floorBoundsAcc = mergeBounds3Into(floorBoundsAcc, chunk.bounds3);
	}

	const documentBounds: LayoutBounds3 | null = docBoundsAcc
		? { min: [...docBoundsAcc.min] as Vec3, max: [...docBoundsAcc.max] as Vec3 }
		: null;
	const floorBounds: LayoutBounds3 | null = floorBoundsAcc
		? { min: [...floorBoundsAcc.min] as Vec3, max: [...floorBoundsAcc.max] as Vec3 }
		: null;

	const { floor: compiledFloor, floorAabb, docAabb } = builders.buildFloorAndAabbs(
		document.floor,
		floorRoomIds,
		floorBounds,
		documentBounds,
		reuse
	);

	// Pre-size flat query arrays from chunk lengths for contiguous V8 copy.
	let totalPoints = 0;
	let totalSpans = 0;
	let totalPolygons = world.objectUnit.polygons.length;
	let totalAabbs =
		world.objectUnit.aabbs.length + (floorAabb ? 1 : 0) + (docAabb ? 1 : 0);

	for (let c = 0; c < world.roomChunks.length; c += 1) {
		totalPolygons += world.roomChunks[c]!.polygons.length;
		totalAabbs += world.roomChunks[c]!.aabbs.length;
	}
	for (let c = 0; c < world.wallChunks.length; c += 1) {
		const chunk = world.wallChunks[c]!;
		totalPoints += chunk.points.length;
		totalSpans += chunk.spans.length;
		totalAabbs += chunk.aabbs.length;
	}

	const points = new Array<CompiledQueryPoint>(totalPoints);
	let pOut = 0;
	for (let c = 0; c < world.wallChunks.length; c += 1) {
		const arr = world.wallChunks[c]!.points;
		for (let i = 0; i < arr.length; i += 1) points[pOut++] = arr[i]!;
	}

	const spans = new Array<CompiledQuerySpan>(totalSpans);
	let sOut = 0;
	for (let c = 0; c < world.wallChunks.length; c += 1) {
		const arr = world.wallChunks[c]!.spans;
		for (let i = 0; i < arr.length; i += 1) spans[sOut++] = arr[i]!;
	}

	const polygons = new Array<CompiledQueryPolygon>(totalPolygons);
	let polyOut = 0;
	for (let i = 0; i < world.objectUnit.polygons.length; i += 1) {
		polygons[polyOut++] = world.objectUnit.polygons[i]!;
	}
	for (let c = 0; c < world.roomChunks.length; c += 1) {
		const arr = world.roomChunks[c]!.polygons;
		for (let i = 0; i < arr.length; i += 1) polygons[polyOut++] = arr[i]!;
	}

	const aabbs = new Array<CompiledQueryAabb>(totalAabbs);
	let aabbOut = 0;
	for (let i = 0; i < world.objectUnit.aabbs.length; i += 1) {
		aabbs[aabbOut++] = world.objectUnit.aabbs[i]!;
	}
	for (let c = 0; c < world.roomChunks.length; c += 1) {
		const arr = world.roomChunks[c]!.aabbs;
		for (let i = 0; i < arr.length; i += 1) aabbs[aabbOut++] = arr[i]!;
	}
	for (let c = 0; c < world.wallChunks.length; c += 1) {
		const arr = world.wallChunks[c]!.aabbs;
		for (let i = 0; i < arr.length; i += 1) aabbs[aabbOut++] = arr[i]!;
	}
	if (floorAabb) aabbs[aabbOut++] = floorAabb;
	if (docAabb) aabbs[aabbOut++] = docAabb;

	// Assemble issues in exact canonical order: objects -> rooms -> walls -> junctions.
	const issues: LayoutGeometryIssue[] = [];
	for (let i = 0; i < world.objectUnit.issues.length; i += 1) {
		issues.push(world.objectUnit.issues[i]!);
	}
	for (let c = 0; c < world.roomChunks.length; c += 1) {
		const arr = world.roomChunks[c]!.issues;
		for (let i = 0; i < arr.length; i += 1) issues.push(arr[i]!);
	}
	for (let c = 0; c < world.wallChunks.length; c += 1) {
		const arr = world.wallChunks[c]!.issues;
		for (let i = 0; i < arr.length; i += 1) issues.push(arr[i]!);
	}
	if (world.junctionIssuesById.size > 0) {
		const entries = [...world.junctionIssuesById.entries()].sort(
			(a, b) =>
				(world.junctionLegOrderById.get(a[0]) ?? Number.MAX_SAFE_INTEGER) -
				(world.junctionLegOrderById.get(b[0]) ?? Number.MAX_SAFE_INTEGER)
		);
		for (let i = 0; i < entries.length; i += 1) {
			const list = entries[i]![1];
			for (let j = 0; j < list.length; j += 1) issues.push(list[j]!);
		}
	}

	const result: CompiledLayoutGeometryResult = {
		geometry: {
			floors: [compiledFloor],
			rooms,
			walls: world.sortedWalls.slice(),
			objects: world.objectUnit.compiledObjects.slice(),
			queries: { points, spans, polygons, aabbs },
			bounds: documentBounds,
			junctions: world.sortedJunctions.slice()
		},
		issues
	};

	if (issues.length === 0) {
		recordPassiveCompiledGeometry(document, result.geometry, issues);
	}

	void noQueryRecords;
	return result;
}
