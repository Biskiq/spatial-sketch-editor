import type { CompiledRegionUnit } from '../../room/region-compile';
import type { LayoutVec2 } from '../coordinates';
import type { CompiledJunction, CompiledLayoutGeometry, CompiledPhysicalWall, LayoutBounds3, LayoutGeometryIssue } from '../types';
import type { LayoutDerivedWallRole, LayoutDocumentWallFirst, LayoutWall, LayoutWallOpening } from '../../wall/types';
import type { Vec3 } from '../../kernel/types';
import { PersistentMap, PersistentVector } from '../../kernel/persistent-store';
import { layoutItem, layoutLength, mappedReadonlyMap } from '../../kernel/source-collections';
import { countWork } from '../../kernel/work-observer';
import type { CompiledObjectsUnit, RetainedCompileWorld, RoomSlot, WallSlot } from './units';

export function mergeBounds3Into(
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


export function compileSourceViews(document: LayoutDocumentWallFirst, indexes: Pick<RetainedCompileWorld, 'junctionDocIndexById' | 'wallDocIndexById' | 'openingOrderById' | 'openingIndicesByHostWallId'>) {
 const { junctionDocIndexById, wallDocIndexById, openingOrderById, openingIndicesByHostWallId } = indexes;
 const hosted = new Map<string, LayoutWallOpening[]>();
 return {
  pointById: mappedReadonlyMap(junctionDocIndexById, (index) => layoutItem(document, 'junctions', index)!.point),
  junctionById: mappedReadonlyMap(junctionDocIndexById, (index) => layoutItem(document, 'junctions', index)!),
  wallById: mappedReadonlyMap(wallDocIndexById, (index) => layoutItem(document, 'walls', index)!),
  openingById: mappedReadonlyMap(openingOrderById, (index) => layoutItem(document, 'openings', index)!),
  openingsByHostWallId: mappedReadonlyMap(openingIndicesByHostWallId, (indices, id) => {
   let list = hosted.get(id);
   if (!list) { list = indices.map((index) => layoutItem(document, 'openings', index)!); hosted.set(id, list); countWork('compile:hosted-opening-record', list.length); }
   return list;
  })
 };
}


export type ChunkSummary = { bounds3: LayoutBounds3 | null; issues: number; rooms: number };

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

export type LazySealState = { sealed: boolean; sealers: (() => void)[] };

export const LAZY_GEOMETRY_SEAL = new WeakMap<CompiledLayoutGeometry, () => void>();

export function lazyArray<T>(label: string, build: () => T[], state?: LazySealState): () => T[] {
 let cached: T[] | undefined;
 const seal = () => { if (cached && !Object.isFrozen(cached)) { countWork('snapshot:flat-array-freeze-slots', cached.length); Object.freeze(cached); } };
 state?.sealers.push(seal);
 return () => { if (!cached) { cached = build(); countWork(`materialize:${label}:slots`, cached.length); } if (state?.sealed) seal(); return cached; };
}

export function collectChunks<T, C>(chunks: PersistentVector<C, ChunkSummary>, values: (chunk: C) => readonly T[]): T[] {
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
	readonly regionUnit: CompiledRegionUnit;
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
	const roomIndicesByJunctionId = new Map<string, number[]>();
	const pushRoomIndex = (map: Map<string, number[]>, key: string, rIdx: number): void => {
		const list = map.get(key);
		if (list) {
			if (list[list.length - 1] !== rIdx && !list.includes(rIdx)) list.push(rIdx);
		} else {
			map.set(key, [rIdx]);
		}
	};
	for (let rIdx = 0; rIdx < layoutLength(document, 'rooms'); rIdx += 1) {
		const room = layoutItem(document, 'rooms', rIdx)!;
		documentRoomIds.add(room.id);
		for (let bIdx = 0; bIdx < room.boundary.length; bIdx += 1) {
			pushRoomIndex(roomIndicesByWallId, room.boundary[bIdx]!.wallId, rIdx);
		}
		for (let eIdx = 0; eIdx < room.virtualEdges.length; eIdx += 1) {
			const edge = room.virtualEdges[eIdx]!;
			pushRoomIndex(roomIndicesByJunctionId, edge.startJunctionId, rIdx);
			pushRoomIndex(roomIndicesByJunctionId, edge.endJunctionId, rIdx);
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
		roomIndicesByJunctionId,
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
		objectUnit: input.objectUnit,
		regionUnit: input.regionUnit
	};
}
