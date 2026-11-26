export type {
	EvaluatedRoomUnit,
	EvaluatedWallBaseUnit,
	ExpandedWallUnit,
	ResolvedJunctionUnit,
	CompiledObjectsUnit,
	FloorAndAabbsUnit,
	CanonicalDeltaBuilders,
	RoomSlot,
	WallSlot,
	RetainedCompileWorld,
} from './delta/units';
export {
	readPassiveCompiledGeometry,
	recordPassiveCompiledGeometry,
	recordSessionlessCompile,
} from './delta/passive';
export { buildRetainedCompileWorldFromPass } from './delta/world';
export { seedReuseFromPassiveCompile } from './delta/seed';
export { tryCompileWallFirstLayoutGeometryDelta } from './delta/retained';
export {
	restoreImmutableCompileSnapshot,
	restoreImmutableCompileBaseline,
	registerDeferredGeneratedField,
	sealCompiledLayoutSnapshot,
} from './delta/snapshots';
export {
	indexedCompiledWall,
	indexedCompiledWallQueries,
	forEachRetainedCompiledWall,
	forEachRetainedCompiledRoom,
} from './delta/lookup';
export { diffCompiledSources, diffCompiledWalls } from './delta/diff';
export type { CompiledSourceDelta, CompiledWallPatch } from './delta/diff';
