import { hasImmutableJsonProof, rememberImmutableJsonNode } from './immutable-json';
/**
 * `layout-geometry-delta.ts` — persistent retained compile roots and local delta
 * evaluation for `compileWallFirstLayoutGeometry` (T1.P02.S06).
 *
 * Architectural contract (AGENTS.md rules 3 & 6):
 * 1. **One canonical compiler** — every dirty Room, Wall, Junction, Object and
 *    Floor aggregate is evaluated by the exact canonical builders in
 *    `layout-geometry.ts`; this module never implements a second geometry or
 *    issue formula.
 * 2. **Soundness before speed** — local delta evaluation runs only when the
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
import { isCanonicalWallSampling, type WallSamplingDerivation } from './layout-wall-centerline';
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
import { PersistentMap, PersistentVector } from './persistent-store';
import { layoutItem, layoutLength, mappedReadonlyMap } from './layout-source-collections';
import { countWork } from './p2311-perf';


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

export type RetainedCompileWorld = {
	document: LayoutDocumentWallFirst;
	readonly floorId: string;
	readonly floorElevation: number;
	readonly defaultWallThickness: number;
	readonly hydratedWithoutSources: boolean;
	pointById: ReadonlyMap<string, LayoutVec2>;
	readonly junctionDocIndexById: Map<string, number>;
	wallById: ReadonlyMap<string, LayoutWall>;
	readonly wallDocIndexById: Map<string, number>;
	openingById: ReadonlyMap<string, LayoutWallOpening>;
	readonly openingOrderById: Map<string, number>;
	openingsByHostWallId: ReadonlyMap<string, LayoutWallOpening[]>;
	readonly openingIndicesByHostWallId: ReadonlyMap<string, readonly number[]>;
	readonly documentRoomIds: Set<string>;
	readonly roomIndicesByWallId: Map<string, number[]>;
	readonly wallIdsByJunctionId: Map<string, string[]>;
	readonly derivedWallRoles: ReadonlyMap<string, LayoutDerivedWallRole>;
	roomSlots: PersistentVector<RoomSlot, ChunkSummary>;
	validCeilingRoomCount: number;
	wallSlots: PersistentVector<WallSlot, ChunkSummary>;
	sortedWalls: PersistentVector<CompiledPhysicalWall>;
	sortedJunctions: PersistentVector<CompiledJunction, ChunkSummary>;
	readonly junctionSortedIndexById: Map<string, number>;
	readonly junctionLegOrderById: Map<string, number>;
	junctionIssuesByOrder: PersistentMap<number, readonly LayoutGeometryIssue[]>;
	objectUnit: CompiledObjectsUnit;
};

type PassiveCompileRecord = {
	readonly geometry: CompiledLayoutGeometry;
	readonly issues: readonly LayoutGeometryIssue[];
};

const PASSIVE_COMPILE_BY_DOC = new WeakMap<LayoutDocumentWallFirst, PassiveCompileRecord>();

/** Record a clean result in O(1). Warming can restore a proven retained root in
 * O(1), or build retained indexes in O(N) when this is only a passive result. */
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

function compileSourceViews(document: LayoutDocumentWallFirst, indexes: Pick<RetainedCompileWorld, 'junctionDocIndexById' | 'wallDocIndexById' | 'openingOrderById' | 'openingIndicesByHostWallId'>) {
 const { junctionDocIndexById, wallDocIndexById, openingOrderById, openingIndicesByHostWallId } = indexes;
 const hosted = new Map<string, LayoutWallOpening[]>();
 return {
  pointById: mappedReadonlyMap(junctionDocIndexById, (index) => layoutItem(document, 'junctions', index)!.point),
  wallById: mappedReadonlyMap(wallDocIndexById, (index) => layoutItem(document, 'walls', index)!),
  openingById: mappedReadonlyMap(openingOrderById, (index) => layoutItem(document, 'openings', index)!),
  openingsByHostWallId: mappedReadonlyMap(openingIndicesByHostWallId, (indices, id) => {
   let list = hosted.get(id);
   if (!list) { list = indices.map((index) => layoutItem(document, 'openings', index)!); hosted.set(id, list); countWork('compile:hosted-opening-record', list.length); }
   return list;
  })
 };
}

type ChunkSummary = { bounds3: LayoutBounds3 | null; issues: number; rooms: number };
function summarizedVector<T>(items: readonly T[], summarize: (item: T) => ChunkSummary): PersistentVector<T, ChunkSummary> {
 const merge = (a: ChunkSummary, b: ChunkSummary): ChunkSummary => {
  countWork('compile:aggregate-merge');
  return { bounds3: mergeBounds3Into(mergeBounds3Into(null, a.bounds3), b.bounds3), issues: a.issues + b.issues, rooms: a.rooms + b.rooms };
 };
 return PersistentVector.from(items, {
  leaf(block) {
   let total: ChunkSummary = { bounds3: null, issues: 0, rooms: 0 };
   for (const item of block) { countWork('compile:aggregate-child-read'); total = merge(total, summarize(item)); }
   return total;
  }, branch: merge
 });
}
type LazySealState = { sealed: boolean; sealers: (() => void)[] };
const LAZY_GEOMETRY_SEAL = new WeakMap<CompiledLayoutGeometry, () => void>();
function lazyArray<T>(label: string, build: () => T[], state?: LazySealState): () => T[] {
 let cached: T[] | undefined;
 const seal = () => { if (cached && !Object.isFrozen(cached)) { countWork('snapshot:flat-array-freeze-slots', cached.length); Object.freeze(cached); } };
 state?.sealers.push(seal);
 return () => { if (!cached) { cached = build(); countWork(`materialize:${label}:slots`, cached.length); } if (state?.sealed) seal(); return cached; };
}
function collectChunks<T, C>(chunks: PersistentVector<C, ChunkSummary>, values: (chunk: C) => readonly T[]): T[] {
 const out: T[] = [];
 for (const chunk of chunks.values()) { countWork('materialize:chunk-read'); for (const item of values(chunk)) out.push(item); }
 return out;
}

/** Build a `RetainedCompileWorld` at the end of a full canonical pass. */
export function buildRetainedCompileWorldFromPass(input: {
	readonly document: LayoutDocumentWallFirst;
	readonly roomSlots: RoomSlot[];
	readonly wallSlots: WallSlot[];
	readonly sortedWalls: CompiledPhysicalWall[];
	readonly sortedJunctions: CompiledJunction[];
	readonly junctionLegOrderById: Map<string, number>;
	junctionIssuesById: Map<string, readonly LayoutGeometryIssue[]>;
	readonly objectUnit: CompiledObjectsUnit;
	readonly derivedWallRoles: ReadonlyMap<string, LayoutDerivedWallRole>;
}): RetainedCompileWorld {
	const { document } = input;
	const pointById = new Map<string, LayoutVec2>();
	const junctionDocIndexById = new Map<string, number>();
	for (let i = 0; i < layoutLength(document, 'junctions'); i += 1) {
		const j = layoutItem(document, 'junctions', i)!;
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
	for (let i = 0; i < layoutLength(document, 'walls'); i += 1) {
		const w = layoutItem(document, 'walls', i)!;
		wallById.set(w.id, w);
		wallDocIndexById.set(w.id, i);
		pushIncident(w.startJunctionId, w.id);
		pushIncident(w.endJunctionId, w.id);
	}
	const openingById = new Map<string, LayoutWallOpening>();
	const openingOrderById = new Map<string, number>();
	const openingsByHostWallId = new Map<string, LayoutWallOpening[]>();
	for (let i = 0; i < layoutLength(document, 'openings'); i += 1) {
		const op = layoutItem(document, 'openings', i)!;
		openingById.set(op.id, op);
		openingOrderById.set(op.id, i);
		const list = openingsByHostWallId.get(op.wallId);
		if (list) list.push(op);
		else openingsByHostWallId.set(op.wallId, [op]);
	}
	const documentRoomIds = new Set<string>();
	const roomIndicesByWallId = new Map<string, number[]>();
	for (let rIdx = 0; rIdx < layoutLength(document, 'rooms'); rIdx += 1) {
		const room = layoutItem(document, 'rooms', rIdx)!;
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

	let validCeilingRoomCount = 0;
	for (let i = 0; i < input.roomSlots.length; i += 1) {
		if (input.roomSlots[i]!.hasValidCeiling) validCeilingRoomCount += 1;
	}

	const junctionSortedIndexById = new Map<string, number>();
	for (let i = 0; i < input.sortedJunctions.length; i += 1) {
		junctionSortedIndexById.set(input.sortedJunctions[i]!.junctionId, i);
	}

 const openingIndicesByHostWallId = new Map<string, readonly number[]>();
 for (const [id, openings] of openingsByHostWallId) openingIndicesByHostWallId.set(id, openings.map((opening) => openingOrderById.get(opening.id)!));

	return {
		document,
		...compileSourceViews(document, { junctionDocIndexById, wallDocIndexById, openingOrderById, openingIndicesByHostWallId }),
		openingIndicesByHostWallId,
		floorId: document.floor.id,
		floorElevation: document.floor.elevation,
		defaultWallThickness: layoutItem(document, 'walls', 0)?.thickness ?? 0.1,
		hydratedWithoutSources: false,
		junctionDocIndexById,
		wallDocIndexById,
		openingOrderById,
		documentRoomIds,
		roomIndicesByWallId,
		wallIdsByJunctionId,
		derivedWallRoles: input.derivedWallRoles,
		roomSlots: summarizedVector(input.roomSlots, (slot) => ({ bounds3: slot.stripped ? slot.bounds3 : null, issues: slot.issues.length, rooms: slot.stripped ? 1 : 0 })),
		validCeilingRoomCount,
		wallSlots: summarizedVector(input.wallSlots, (slot) => ({ bounds3: slot.compiled?.bounds3 ?? null, issues: slot.compiled ? slot.issues.length : 0, rooms: 0 })),
		sortedWalls: PersistentVector.from(input.sortedWalls),
		sortedJunctions: summarizedVector(input.sortedJunctions, (junction) => ({ bounds3: junction.bounds3, issues: 0, rooms: 0 })),
		junctionSortedIndexById,
		junctionLegOrderById: input.junctionLegOrderById,
		junctionIssuesByOrder: PersistentMap.from([...input.junctionIssuesById].map(([id, issues]) => [input.junctionLegOrderById.get(id)!, issues] as const)),
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
	if (restoreImmutableCompileSnapshot(document, reuse)) return true;
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
		geometry.rooms.length !== layoutLength(document, 'rooms') ||
		physicalWalls.length !== layoutLength(document, 'walls') ||
		geometry.objects.length !== layoutLength(document, 'objects')
	) {
		return false;
	}

	// Verify unique IDs before partitioning query records.
	const uniqueWallIds = new Set<string>();
	for (let i = 0; i < layoutLength(document, 'walls'); i += 1) uniqueWallIds.add(layoutItem(document, 'walls', i)!.id);
	if (uniqueWallIds.size !== layoutLength(document, 'walls')) return false;

	const objCount = layoutLength(document, 'objects');
	const roomCount = layoutLength(document, 'rooms');
	if (geometry.queries.polygons.length < objCount + roomCount) return false;
	if (geometry.queries.aabbs.length < objCount + roomCount + layoutLength(document, 'walls')) return false;

	const documentRoomIds = new Set<string>();
	for (let i = 0; i < roomCount; i += 1) documentRoomIds.add(layoutItem(document, 'rooms', i)!.id);

	// 1. Partition Object unit.
	const objPolygons = geometry.queries.polygons.slice(0, objCount);
	const objAabbs = geometry.queries.aabbs.slice(0, objCount);
	let objBounds: { min: Vec3; max: Vec3 } | null = null;
	let objFloorBounds: { min: Vec3; max: Vec3 } | null = null;
	for (let i = 0; i < objCount; i += 1) {
		const desc = geometry.objects[i]!;
		if (desc.objectId !== layoutItem(document, 'objects', i)!.id) return false;
		objBounds = mergeBounds3Into(objBounds, desc.worldAabb);
		if (desc.roomId && documentRoomIds.has(desc.roomId)) {
			objFloorBounds = mergeBounds3Into(objFloorBounds, desc.worldAabb);
		}
		reuse.objects.set(desc.objectId, {
			authored: [layoutItem(document, 'objects', i)!, i],
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
		compiledObjects: geometry.objects,
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
		if (stripped.roomId !== layoutItem(document, 'rooms', r)!.id) return false;
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
	for (let i = 0; i < layoutLength(document, 'junctions'); i += 1) {
		pointById.set(layoutItem(document, 'junctions', i)!.id, layoutItem(document, 'junctions', i)!.point);
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
	for (let i = 0; i < layoutLength(document, 'openings'); i += 1) {
		const op = layoutItem(document, 'openings', i)!;
		const list = openingsByHostWallId.get(op.wallId);
		if (list) list.push(op);
		else openingsByHostWallId.set(op.wallId, [op]);
	}

	const wallSlots: WallSlot[] = new Array(layoutLength(document, 'walls'));
	for (let wIdx = 0; wIdx < layoutLength(document, 'walls'); wIdx += 1) {
		const wall = layoutItem(document, 'walls', wIdx)!;
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
	registerCompileSnapshot(document, reuse.world as RetainedCompileWorld, { geometry, issues: [] }, reuse);
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
		const joins = world.sortedJunctions.get(jIdx)!.resolution.joins;
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
 * Attempt a persistent delta compile against `reuse.world`. Returns `null` when the
 * edit changes topology, global Floor datums, fallback thickness, or lacks
 * COW lineage, allowing the caller to fall back cleanly.
 */
export function tryCompileWallFirstLayoutGeometryDelta(
	document: LayoutDocumentWallFirst,
	sampling: WallSamplingDerivation | undefined,
	reuse: LayoutCompileReuse,
	builders: CanonicalDeltaBuilders
): CompiledLayoutGeometryResult | null {
	if (hasAnySamplingTestObserver() || !isCanonicalWallSampling(sampling)) return null;
	let world = reuse.world as RetainedCompileWorld | null;
	if (!world) return null;

	const defaultWallThickness = layoutItem(document, 'walls', 0)?.thickness ?? 0.1;
	if (
		!Object.is(document.floor.id, world.floorId) ||
		!Object.is(document.floor.elevation, world.floorElevation) ||
		!Object.is(defaultWallThickness, world.defaultWallThickness)
	) {
		return null;
	}

	if (
		layoutLength(document, 'walls') !== layoutLength(world.document, 'walls') ||
		layoutLength(document, 'junctions') !== layoutLength(world.document, 'junctions') ||
		layoutLength(document, 'rooms') !== layoutLength(world.document, 'rooms') ||
		layoutLength(document, 'openings') !== layoutLength(world.document, 'openings')
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
		const nextJ = layoutItem(document, 'junctions', docIdx);
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
		const nextW = layoutItem(document, 'walls', docIdx);
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
		const nextOp = layoutItem(document, 'openings', opIdx);
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

	world = { ...world, ...compileSourceViews(document, world), junctionIssuesByOrder: world.junctionIssuesByOrder.fork() };
	reuse.world = world;
	// 1. Evaluate dirty Walls (base geometry + legs).
	const evaluatedWallBaseById = new Map<string, EvaluatedWallBaseUnit>();
	let validWallCount = 0;
	validWallCount = world.sortedWalls.length;

	for (const wId of dirtyWallIds) {
		const docIdx = world.wallDocIndexById.get(wId)!;
		const prevSlot = world.wallSlots.get(docIdx)!;
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
	if (dirtyRoomIndexSet.size > 0) {
		const sortedDirtyRooms = [...dirtyRoomIndexSet].sort((a, b) => a - b);
		for (let i = 0; i < sortedDirtyRooms.length; i += 1) {
			const rIdx = sortedDirtyRooms[i]!;
			const prevSlot = world.roomSlots.get(rIdx)!;
			const unit = builders.evaluateRoom(
				document,
				rIdx,
				world.pointById,
				world.wallById,
				world.openingsByHostWallId,
				world.openingOrderById,
				defaultWallThickness
			);
			if ((prevSlot.stripped === null) !== (unit.stripped === null)) { reuse.world = null; return null; }
			if (prevSlot.hasValidCeiling !== unit.hasValidCeiling) {
				if (unit.hasValidCeiling) world.validCeilingRoomCount += 1;
				else world.validCeilingRoomCount -= 1;
			}
			if (unit.hasValidCeiling) {
				reuse.counters.roomsEvaluated += 1;
			}
			if (unit.source) {
				const room = layoutItem(document, 'rooms', rIdx)!;
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
			world.roomSlots = world.roomSlots.set(rIdx, {
				roomId: layoutItem(document, 'rooms', rIdx)!.id,
				hasValidCeiling: unit.hasValidCeiling,
				stripped: unit.stripped,
				polygons: unit.polygons,
				aabbs: unit.aabbs,
				issues: unit.issues,
				bounds3: unit.bounds3
			});
		}
	}
	reuse.counters.roomsReused += world.validCeilingRoomCount - reuse.counters.roomsEvaluated;

	// 3. Evaluate Objects if any object changed or count changed.
	if (
		dirty.changedObjectIds.length > 0 ||
		layoutLength(document, 'objects') !== layoutLength(world.document, 'objects')
	) {
		world.objectUnit = builders.compileObjects(document.objects, world.documentRoomIds, reuse);
	} else {
		reuse.counters.objectsReused += layoutLength(document, 'objects');
	}

	// 4. Resolve affected Junctions (moved junctions + endpoints of dirty walls).
	const affectedJunctionIds = new Set<string>(changedJunctionIds);
	for (const wId of dirtyWallIds) {
		const w = world.wallById.get(wId)!;
		if (w.startJunctionId) affectedJunctionIds.add(w.startJunctionId);
		if (w.endJunctionId) affectedJunctionIds.add(w.endJunctionId);
	}
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
				: world.wallSlots.get(world.wallDocIndexById.get(incWallId)!)!.legs;
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
		if (world.sortedJunctions.get(jSortedIdx) !== resolved.compiled) {
			world.sortedJunctions = world.sortedJunctions.set(jSortedIdx, resolved.compiled);
		}
		const issueOrder = world.junctionLegOrderById.get(jId);
		if (issueOrder === undefined) { reuse.world = null; return null; }
		if (resolved.issues.length > 0) {
			world.junctionIssuesByOrder.set(issueOrder, resolved.issues);
		} else {
			world.junctionIssuesByOrder.delete(issueOrder);
		}
	}
	// `resolveJunction` incremented `junctionsEvaluated` / `junctionsReused` for
	// `affectedValidJunctions`; add the untouched junctions to `junctionsReused`.
	reuse.counters.junctionsReused += world.sortedJunctions.length - affectedValidJunctions;

	// 5. Expand dirty Walls AND miter-neighbor Walls incident to `affectedJunctionIds`.
	const expansionWallIds = new Set<string>(dirtyWallIds);
	for (const jId of affectedJunctionIds) {
		const incident = world.wallIdsByJunctionId.get(jId);
		if (incident) {
			for (let i = 0; i < incident.length; i += 1) expansionWallIds.add(incident[i]!);
		}
	}
	for (const wId of expansionWallIds) {
		const docIdx = world.wallDocIndexById.get(wId)!;
		const prevSlot = world.wallSlots.get(docIdx)!;
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
			world.wallSlots = world.wallSlots.set(docIdx, {
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
			});
			world.sortedWalls = world.sortedWalls.set(prevSlot.sortedIndex, expanded.compiled);

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

	world.document = document;
	reuse.counters.entities =
		reuse.counters.wallsEvaluated +
		reuse.counters.roomsEvaluated +
		reuse.counters.junctionsEvaluated +
		reuse.counters.objectsEvaluated;

	// Snapshot roots are immutable. Legacy array properties materialize only when
	// actually consumed; bounds/counts come from cached tree summaries.
	return compileSnapshot(document, world, reuse, builders);
}

function compileSnapshot(document: LayoutDocumentWallFirst, world: RetainedCompileWorld, reuse: LayoutCompileReuse, builders: CanonicalDeltaBuilders): CompiledLayoutGeometryResult {
 let floorBounds = mergeBounds3Into(null, world.roomSlots.summary.bounds3);
 floorBounds = mergeBounds3Into(floorBounds, world.objectUnit.floorRoomBounds3);
 floorBounds = mergeBounds3Into(floorBounds, world.wallSlots.summary.bounds3);
 floorBounds = mergeBounds3Into(floorBounds, world.sortedJunctions.summary.bounds3);
 let bounds = mergeBounds3Into(null, world.roomSlots.summary.bounds3);
 bounds = mergeBounds3Into(bounds, world.objectUnit.bounds3);
 bounds = mergeBounds3Into(bounds, world.wallSlots.summary.bounds3);
 bounds = mergeBounds3Into(bounds, world.sortedJunctions.summary.bounds3);
 const floorRoomIds = reuse.retainedFloor?.roomIds ?? collectChunks(world.roomSlots, (c) => c.stripped ? [c.roomId] : []);
 const { floor, floorAabb, docAabb } = builders.buildFloorAndAabbs(document.floor, floorRoomIds, floorBounds, bounds, reuse);
 const sealState: LazySealState = { sealed: false, sealers: [] };
 const rooms = lazyArray('compiled-rooms', () => collectChunks(world.roomSlots, (c) => c.stripped ? [c.stripped] : []), sealState);
 const walls = lazyArray('compiled-walls', () => world.sortedWalls.toArray(null), sealState);
 const junctions = lazyArray('compiled-junctions', () => world.sortedJunctions.toArray(null), sealState);
 const points = lazyArray('query-points', () => collectChunks(world.wallSlots, (c) => c.baseRecords.points), sealState);
 const spans = lazyArray('query-spans', () => collectChunks(world.wallSlots, (c) => c.baseRecords.spans), sealState);
 const polygons = lazyArray('query-polygons', () => [...world.objectUnit.polygons, ...collectChunks(world.roomSlots, (c) => c.polygons)], sealState);
 const aabbs = lazyArray('query-aabbs', () => [...world.objectUnit.aabbs, ...collectChunks(world.roomSlots, (c) => c.aabbs), ...collectChunks(world.wallSlots, (c) => [...c.baseRecords.aabbs, ...(c.wallAabb ? [c.wallAabb] : [])]), ...(floorAabb ? [floorAabb] : []), ...(docAabb ? [docAabb] : [])], sealState);
 const issues = lazyArray('issues', () => {
  const out = [...world.objectUnit.issues, ...collectChunks(world.roomSlots, (c) => c.issues), ...collectChunks(world.wallSlots, (c) => c.issues)];
  for (const list of world.junctionIssuesByOrder.values()) out.push(...list);
  return out;
 }, sealState);
 const geometry: CompiledLayoutGeometry = {
  floors: [floor], get rooms() { return rooms(); }, get walls() { return walls(); },
  objects: world.objectUnit.compiledObjects,
  queries: { get points() { return points(); }, get spans() { return spans(); }, get polygons() { return polygons(); }, get aabbs() { return aabbs(); } },
  bounds, get junctions() { return junctions(); }
 };
 LAZY_GEOMETRY_SEAL.set(geometry, () => {
  freezeGeneratedGraph(floor); freezeGeneratedGraph(floorAabb); freezeGeneratedGraph(docAabb);
  freezeGeneratedGraph(geometry.floors); freezeGeneratedGraph(geometry.objects); freezeGeneratedGraph(bounds);
  sealState.sealed = true; for (const seal of sealState.sealers) seal();
  Object.freeze(geometry.queries); Object.freeze(geometry);
 });
 const issueCount = world.objectUnit.issues.length + world.roomSlots.summary.issues + world.wallSlots.summary.issues + world.junctionIssuesByOrder.size;
 const result: CompiledLayoutGeometryResult = { geometry, get issues() { return issueCount === 0 ? [] : issues(); } };
 if (issueCount === 0) recordPassiveCompiledGeometry(document, geometry, []);
 registerCompileSnapshot(document, world, result, reuse);
 return result;
}

/** Runtime-safe indexed consumers. No authored state or renderer enters here. */
const COMPILE_WORLD_BY_GEOMETRY = new WeakMap<CompiledLayoutGeometry, RetainedCompileWorld>();
type CompileSnapshot = { immutable: boolean; world: RetainedCompileWorld; result: CompiledLayoutGeometryResult; floor: LayoutCompileReuse['retainedFloor']; docAabb: LayoutCompileReuse['retainedDocAabb'] };
function verifiedFrozenSource(value: unknown): boolean {
 if (value === null || typeof value !== 'object') return typeof value !== 'function' && typeof value !== 'symbol' && typeof value !== 'bigint';
 if (hasImmutableJsonProof(value)) return true;
 if (!Object.isFrozen(value)) return false;
 const prototype = Object.getPrototypeOf(value);
 if (!Array.isArray(value) && prototype !== Object.prototype && prototype !== null) return false;
 const descriptors = Object.values(Object.getOwnPropertyDescriptors(value));
 if (descriptors.some((descriptor) => !('value' in descriptor))) return false;
 const values = descriptors.map((descriptor) => descriptor.value);
 countWork('snapshot:frozen-validation-properties', values.length);
 for (const child of values) if (!verifiedFrozenSource(child)) return false;
 return rememberImmutableJsonNode(value);
}
function registerCompileSnapshot(document: LayoutDocumentWallFirst, world: RetainedCompileWorld, result: CompiledLayoutGeometryResult, reuse: LayoutCompileReuse): void {
 COMPILE_WORLD_BY_GEOMETRY.set(result.geometry, world);
 reuse.snapshots.set(document, { immutable: verifiedFrozenSource(document), world, result, floor: reuse.retainedFloor, docAabb: reuse.retainedDocAabb });
}
/** Only proven immutable sources may restore a cached root without inspection. */
export function restoreImmutableCompileSnapshot(document: LayoutDocumentWallFirst, reuse: LayoutCompileReuse): CompiledLayoutGeometryResult | null {
 if (!Object.isFrozen(document) || hasAnySamplingTestObserver()) return null;
 const snapshot = reuse.snapshots.get(document) as CompileSnapshot | undefined;
 const current = reuse.world as RetainedCompileWorld | null;
 if (!snapshot?.immutable || !current) return null;
 if (current !== snapshot.world) {
  // Working memo tables are disposable accelerators, not snapshot state.
  // Retire their roots without walking old membership; the persistent world
  // already contains every unchanged compiled unit and all dependency indexes.
  reuse.walls = new Map(); reuse.junctions = new Map(); reuse.roomSources = new Map();
  reuse.roomCompiles = new WeakMap(); reuse.objects = new Map();
  countWork('compile:working-cache-root-reset', 5);
 }
 reuse.world = snapshot.world; reuse.retainedFloor = snapshot.floor; reuse.retainedDocAabb = snapshot.docAabb;
 reuse.lastPrunedDocument = document;
 countWork('compile:historical-root-restore');
 return snapshot.result;
}
export function restoreImmutableCompileBaseline(document: LayoutDocumentWallFirst, reuse: LayoutCompileReuse): void {
 const delta = getCowDocumentDelta(document);
 if (delta) restoreImmutableCompileSnapshot(delta.baseline, reuse);
}
export function indexedCompiledWall(geometry: CompiledLayoutGeometry, wallId: string): CompiledPhysicalWall | undefined {
 const world = COMPILE_WORLD_BY_GEOMETRY.get(geometry);
 if (!world) return geometry.walls.find((wall) => wall.wallId === wallId);
 const index = world.wallDocIndexById.get(wallId);
 return index === undefined ? undefined : world.wallSlots.get(index)?.compiled ?? undefined;
}
export function indexedCompiledWallQueries(geometry: CompiledLayoutGeometry, wallId: string): RetainedQueryRecords | undefined {
 const world = COMPILE_WORLD_BY_GEOMETRY.get(geometry);
 const index = world?.wallDocIndexById.get(wallId);
 if (!world || index === undefined) return undefined;
 const slot = world.wallSlots.get(index)!;
 return { ...slot.baseRecords, aabbs: [...slot.baseRecords.aabbs, ...(slot.wallAabb ? [slot.wallAabb] : [])] };
}
export type CompiledWallPatch = { wall: CompiledPhysicalWall; index: number; endKey: string; joins: readonly CompiledLegJoin[]; elevation: number };
/** Undefined means a cold/membership-changing transition: use the complete path. */
export function diffCompiledWalls(before: CompiledLayoutGeometry, after: CompiledLayoutGeometry): readonly CompiledWallPatch[] | undefined {
 const a = COMPILE_WORLD_BY_GEOMETRY.get(before), b = COMPILE_WORLD_BY_GEOMETRY.get(after);
 if (!a || !b || a.wallDocIndexById !== b.wallDocIndexById) return undefined;
 const dirty = new Set<string>();
 b.sortedWalls.diff(a.sortedWalls, (_index, prev, next) => { dirty.add(prev.wallId); dirty.add(next.wallId); });
 b.sortedJunctions.diff(a.sortedJunctions, (_index, prev, next) => { for (const junction of [prev, next]) for (const leg of junction.legs) dirty.add(leg.wallId); });
 const patches: CompiledWallPatch[] = [];
 for (const id of dirty) {
  const slot = b.wallSlots.get(b.wallDocIndexById.get(id)!)!;
  if (!slot.compiled) continue;
  const source = b.wallById.get(id)!;
  const junctionIds = source.startJunctionId === source.endJunctionId ? [source.startJunctionId] : [source.startJunctionId, source.endJunctionId].sort();
  const keys: string[] = [];
  for (const jId of junctionIds) {
   const index = b.junctionSortedIndexById.get(jId);
   if (index !== undefined) keys.push(b.sortedJunctions.get(index)!.cacheKey);
  }
  patches.push({ wall: slot.compiled, index: slot.sortedIndex, endKey: keys.join('|'), joins: collectJoinsForWall(id, source.startJunctionId, source.endJunctionId, b) ?? [], elevation: b.floorElevation });
 }
 countWork('representation:wall-patch-record', patches.length);
 return patches;
}

// A generated snapshot is sealed at the same owning Stage boundary as before.
// Persistent roots prove untouched generated records are already sealed. A full
// array requested later is frozen on materialization; Stage never forces it.
const SEALED_COMPILE_WORLDS = new WeakSet<RetainedCompileWorld>();
const SEALED_GENERATED_VECTOR_NODES = new WeakSet<object>();
const SEALED_GENERATED_OBJECTS = new WeakSet<object>();
const DEFERRED_GENERATED_FIELDS = new WeakMap<object, ReadonlySet<string>>();
/** Only canonical builders register immutable primitive-valued lazy fields. */
export function registerDeferredGeneratedField(value: object, field: string): void {
 DEFERRED_GENERATED_FIELDS.set(value, new Set([...(DEFERRED_GENERATED_FIELDS.get(value) ?? []), field]));
}
function freezeGeneratedGraph(value: unknown): void {
 if (value === null || typeof value !== 'object' || SEALED_GENERATED_OBJECTS.has(value)) return;
 const deferred = DEFERRED_GENERATED_FIELDS.get(value);
 const children = deferred ? Object.keys(value).filter((key) => !deferred.has(key)).map((key) => (value as Record<string, unknown>)[key]) : Object.values(value);
 countWork('snapshot:generated-property-read', children.length);
 for (const child of children) freezeGeneratedGraph(child);
 if (!Object.isFrozen(value)) { Object.freeze(value); countWork('snapshot:generated-object-freeze'); }
 SEALED_GENERATED_OBJECTS.add(value);
}
/** Returns false for non-retained/hand-built geometry, which keeps generic
 * full freezing. This creates no acceptance or source-validation certificate. */
export function sealCompiledLayoutSnapshot(geometry: CompiledLayoutGeometry): boolean {
 const world = COMPILE_WORLD_BY_GEOMETRY.get(geometry);
 if (!world) return false;
 if (Object.isFrozen(geometry) && SEALED_COMPILE_WORLDS.has(world)) return true;
 world.roomSlots.visitUnseen(SEALED_GENERATED_VECTOR_NODES, freezeGeneratedGraph);
 world.wallSlots.visitUnseen(SEALED_GENERATED_VECTOR_NODES, freezeGeneratedGraph);
 world.sortedJunctions.visitUnseen(SEALED_GENERATED_VECTOR_NODES, freezeGeneratedGraph);
 freezeGeneratedGraph(world.objectUnit);
 const sealLazy = LAZY_GEOMETRY_SEAL.get(geometry);
 if (sealLazy) sealLazy(); else freezeGeneratedGraph(geometry);
 SEALED_COMPILE_WORLDS.add(world);
 countWork('snapshot:generated-root-seal');
 return true;
}
