import type { CompiledLayoutGeometry, CompiledPhysicalWall, CompiledRoom } from '../types';
import type { RetainedQueryRecords } from '../reuse';
import { COMPILE_WORLD_BY_GEOMETRY } from './snapshots';

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

/**
 * Iterate a compiled snapshot's Walls from the retained compile world, in the same
 * order as `geometry.walls`, **without flattening it into an array**.
 *
 * `CompiledLayoutGeometry.walls` is a lazily materialized legacy view of a persistent
 * vector: reading it allocates one array and copies every slot. A consumer that only
 * needs to visit each Wall should not pay that, and should not pin the array alive.
 *
 * Returns `false` when the snapshot has no retained world (hand-built or legacy
 * geometry), so the caller can fall back to the array property rather than receive an
 * empty iteration.
 */
export function forEachRetainedCompiledWall(
	geometry: CompiledLayoutGeometry,
	visit: (wall: CompiledPhysicalWall) => void
): boolean {
	const world = COMPILE_WORLD_BY_GEOMETRY.get(geometry);
	if (!world) return false;
	for (const wall of world.sortedWalls.values()) visit(wall);
	return true;
}


/** The Room counterpart of {@link forEachRetainedCompiledWall}. */
export function forEachRetainedCompiledRoom(
	geometry: CompiledLayoutGeometry,
	visit: (room: CompiledRoom) => void
): boolean {
	const world = COMPILE_WORLD_BY_GEOMETRY.get(geometry);
	if (!world) return false;
	// `compiled.rooms` is exactly the stripped slots, in slot order.
	for (const slot of world.roomSlots.values()) if (slot.stripped !== null) visit(slot.stripped);
	return true;
}
