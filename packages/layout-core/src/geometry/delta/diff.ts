import type { CompiledLayoutGeometry, CompiledLayoutObject, CompiledLegJoin, CompiledPhysicalWall, CompiledRoom } from '../types';
import { countWork } from '../../kernel/work-observer';
import { collectJoinsForWall } from './seed';
import { COMPILE_WORLD_BY_GEOMETRY } from './snapshots';

/**
 * The compiled sources `after` replaced relative to `before`, proven by persistent roots.
 *
 * **What makes this a proof rather than a claim.** The compiler keeps every compiled
 * snapshot on its own persistent roots, so two snapshots' vectors share the subtrees
 * that did not change. `PersistentVector.diff` walks both roots and skips shared nodes,
 * so it reports exactly the slots whose **record references** differ — no caller asserts
 * which entities are dirty, and nothing is inferred from a document delta.
 *
 * `undefined` is the honest answer whenever that proof does not hold, and every caller
 * must then take the complete path: an unretained or hand-built snapshot, the same
 * snapshot twice, a membership change (a different length, or a different id at a
 * position — an insertion shifts every later slot), an Opening that moved to another
 * Wall (its ids are derived by first-host order), or a Room that stopped compiling.
 */
export type CompiledSourceDelta = {
	/** The Walls whose compiled record was replaced, after the edit. */
	readonly walls: readonly CompiledPhysicalWall[];
	/** The Rooms whose compiled record was replaced, after the edit. */
	readonly rooms: readonly CompiledRoom[];
	/** Every compiled object when the object unit was rebuilt, `null` when none changed. */
	readonly objects: readonly CompiledLayoutObject[] | null;
};


export function diffCompiledSources(
	before: CompiledLayoutGeometry,
	after: CompiledLayoutGeometry
): CompiledSourceDelta | undefined {
	const previous = COMPILE_WORLD_BY_GEOMETRY.get(before);
	const current = COMPILE_WORLD_BY_GEOMETRY.get(after);
	if (!previous || !current || previous === current) return undefined;
	if (previous.regionUnit.regions !== current.regionUnit.regions &&
		(previous.regionUnit.regions.length || current.regionUnit.regions.length)) return undefined;
	// A different length is an insertion or a removal: every later slot shifts, so the
	// roots can no longer be compared position by position.
	if (previous.sortedWalls.length !== current.sortedWalls.length) return undefined;
	if (previous.roomSlots.length !== current.roomSlots.length) return undefined;

	const walls: CompiledPhysicalWall[] = [];
	let membership = true;
	current.sortedWalls.diff(previous.sortedWalls, (_index, before, after) => {
		if (before.wallId !== after.wallId) membership = false;
		else if (!sameOpeningIds(before, after)) membership = false;
		else walls.push(after);
	});
	const rooms: CompiledRoom[] = [];
	current.roomSlots.diff(previous.roomSlots, (_index, before, after) => {
		if (before.roomId !== after.roomId) membership = false;
		else if (after.stripped === null) membership = false;
		else if (after.stripped !== before.stripped) rooms.push(after.stripped);
	});
	if (!membership) return undefined;

	// The object unit is rebuilt whenever the compile is, but its records are reused by
	// identity when nothing about them changed — so the **records**, not the unit, are the
	// evidence. Comparing the unit alone would declare every object dirty on every full
	// rebuild, which is exactly the whole-project work this delta exists to avoid.
	let objects: readonly CompiledLayoutObject[] | null = null;
	if (previous.objectUnit !== current.objectUnit) {
		const before = previous.objectUnit.compiledObjects;
		const after = current.objectUnit.compiledObjects;
		if (before.length !== after.length) return undefined;
		const changed: CompiledLayoutObject[] = [];
		for (let index = 0; index < after.length; index += 1) {
			if (before[index]!.objectId !== after[index]!.objectId) return undefined;
			if (before[index] !== after[index]) changed.push(after[index]!);
		}
		if (changed.length > 0) objects = changed;
	}
	countWork('compiled:source-delta-wall', walls.length);
	countWork('compiled:source-delta-room', rooms.length);
	return { walls, rooms, objects };
}


/** Openings are derived by first-host order, so a host change invalidates that order. */
function sameOpeningIds(before: CompiledPhysicalWall, after: CompiledPhysicalWall): boolean {
	if (before.openings.length !== after.openings.length) return false;
	for (let index = 0; index < after.openings.length; index += 1) {
		if (before.openings[index]!.openingId !== after.openings[index]!.openingId) return false;
	}
	return true;
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
