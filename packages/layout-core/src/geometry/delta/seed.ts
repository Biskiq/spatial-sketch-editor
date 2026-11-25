import { regionUnitBounds } from '../../room/region-compile';
import type { CacheKeyDependency } from '../keys';
import { cacheKeyDependency } from '../keys';
import type { LayoutVec2 } from '../coordinates';
import type { CompiledJunctionLeg, CompiledLegJoin, CompiledQueryAabb } from '../types';
import type { LayoutCompileReuse, RetainedQueryRecords } from '../reuse';
import { sameAuthored } from '../reuse';
import type { LayoutDocumentWallFirst, LayoutWall, LayoutWallOpening } from '../../wall/types';
import { deriveLayoutWallRoles } from '../../wall/role';
import { areEquivalentLayoutClones, getCowDocumentDelta } from '../../world/cow';
import type { Vec3 } from '../../kernel/types';
import { layoutItem, layoutLength } from '../../kernel/source-collections';
import { PASSIVE_COMPILE_BY_DOC } from './passive';
import { registerCompileSnapshot, restoreImmutableCompileSnapshot } from './snapshots';
import type { CanonicalDeltaBuilders, CompiledObjectsUnit, RetainedCompileWorld, RoomSlot, WallSlot } from './units';
import { buildRetainedCompileWorldFromPass, mergeBounds3Into } from './world';

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
	if (!passive || !passive.clean) return false;
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
	const wallById = new Map<string, LayoutWall>();
	for (let i = 0; i < layoutLength(document, 'walls'); i += 1) {
		const wall = layoutItem(document, 'walls', i)!;
		wallById.set(wall.id, wall);
	}
	if (wallById.size !== layoutLength(document, 'walls')) return false;

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
			authored: builders.junctionInputs(document, cj.point, cj.legs, wallById, pointById).authored,
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

	const regionAabbs = allAabbs.slice(aCursor, aCursor + geometry.regions.length);
	aCursor += regionAabbs.length;
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
		regionUnit: {
			regions: geometry.regions,
			polygons: geometry.queries.polygons.slice(objCount + roomCount),
			aabbs: regionAabbs,
			bounds3: regionUnitBounds(geometry.regions),
			issues: []
		},
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


export function resolveCowDirtyIds(
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


export function collectJoinsForWall(
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
