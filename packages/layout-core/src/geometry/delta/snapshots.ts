import { hasImmutableJsonProof, rememberImmutableJsonNode } from '../../kernel/immutable-json';
import type { CompiledLayoutGeometry, CompiledLayoutGeometryResult } from '../types';
import type { LayoutCompileReuse } from '../reuse';
import type { LayoutDocumentWallFirst } from '../../wall/types';
import { getCowDocumentDelta } from '../../world/cow';
import { countWork } from '../../kernel/work-observer';
import { recordPassiveCompiledGeometry } from './passive';
import type { CanonicalDeltaBuilders, RetainedCompileWorld } from './units';
import type { LazySealState } from './world';
import { LAZY_GEOMETRY_SEAL, collectChunks, lazyArray, mergeBounds3Into } from './world';

export function compileSnapshot(document: LayoutDocumentWallFirst, world: RetainedCompileWorld, reuse: LayoutCompileReuse, builders: CanonicalDeltaBuilders): CompiledLayoutGeometryResult {
 let floorBounds = mergeBounds3Into(null, world.roomSlots.summary.bounds3);
 floorBounds = mergeBounds3Into(floorBounds, world.objectUnit.floorRoomBounds3);
 floorBounds = mergeBounds3Into(floorBounds, world.wallSlots.summary.bounds3);
 floorBounds = mergeBounds3Into(floorBounds, world.sortedJunctions.summary.bounds3);
 floorBounds = mergeBounds3Into(floorBounds, world.regionUnit.bounds3);
 let bounds = mergeBounds3Into(null, world.roomSlots.summary.bounds3);
 bounds = mergeBounds3Into(bounds, world.objectUnit.bounds3);
 bounds = mergeBounds3Into(bounds, world.wallSlots.summary.bounds3);
 bounds = mergeBounds3Into(bounds, world.sortedJunctions.summary.bounds3);
 bounds = mergeBounds3Into(bounds, world.regionUnit.bounds3);
 const floorRoomIds = reuse.retainedFloor?.roomIds ?? collectChunks(world.roomSlots, (c) => c.stripped ? [c.roomId] : []);
 const { floor, floorAabb, docAabb } = builders.buildFloorAndAabbs(document.floor, floorRoomIds, floorBounds, bounds, reuse);
 const sealState: LazySealState = { sealed: false, sealers: [] };
 const rooms = lazyArray('compiled-rooms', () => collectChunks(world.roomSlots, (c) => c.stripped ? [c.stripped] : []), sealState);
 const walls = lazyArray('compiled-walls', () => world.sortedWalls.toArray(null), sealState);
 const junctions = lazyArray('compiled-junctions', () => world.sortedJunctions.toArray(null), sealState);
 const points = lazyArray('query-points', () => collectChunks(world.wallSlots, (c) => c.baseRecords.points), sealState);
 const spans = lazyArray('query-spans', () => collectChunks(world.wallSlots, (c) => c.baseRecords.spans), sealState);
 const polygons = lazyArray('query-polygons', () => [...world.objectUnit.polygons, ...collectChunks(world.roomSlots, (c) => c.polygons), ...world.regionUnit.polygons], sealState);
 const aabbs = lazyArray('query-aabbs', () => [...world.objectUnit.aabbs, ...collectChunks(world.roomSlots, (c) => c.aabbs), ...collectChunks(world.wallSlots, (c) => [...c.baseRecords.aabbs, ...(c.wallAabb ? [c.wallAabb] : [])]), ...world.regionUnit.aabbs, ...(floorAabb ? [floorAabb] : []), ...(docAabb ? [docAabb] : [])], sealState);
 const issues = lazyArray('issues', () => {
  const out = [...world.objectUnit.issues, ...collectChunks(world.roomSlots, (c) => c.issues), ...collectChunks(world.wallSlots, (c) => c.issues)];
  for (const list of world.junctionIssuesByOrder.values()) out.push(...list);
  return out;
 }, sealState);
 const geometry: CompiledLayoutGeometry = {
  regions: world.regionUnit.regions,
  floors: [floor], get rooms() { return rooms(); }, get walls() { return walls(); },
  objects: world.objectUnit.compiledObjects,
  queries: { get points() { return points(); }, get spans() { return spans(); }, get polygons() { return polygons(); }, get aabbs() { return aabbs(); } },
  bounds, get junctions() { return junctions(); }
 };
 LAZY_GEOMETRY_SEAL.set(geometry, () => {
  freezeGeneratedGraph(floor); freezeGeneratedGraph(floorAabb); freezeGeneratedGraph(docAabb);
  freezeGeneratedGraph(geometry.floors); freezeGeneratedGraph(geometry.objects); freezeGeneratedGraph(world.regionUnit); freezeGeneratedGraph(bounds);
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
export const COMPILE_WORLD_BY_GEOMETRY = new WeakMap<CompiledLayoutGeometry, RetainedCompileWorld>();

type CompileSnapshot = { immutable: boolean; world: RetainedCompileWorld; result: CompiledLayoutGeometryResult; floor: LayoutCompileReuse['retainedFloor']; docAabb: LayoutCompileReuse['retainedDocAabb'] };

export function verifiedFrozenSource(value: unknown): boolean {
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

export function registerCompileSnapshot(document: LayoutDocumentWallFirst, world: RetainedCompileWorld, result: CompiledLayoutGeometryResult, reuse: LayoutCompileReuse): void {
 COMPILE_WORLD_BY_GEOMETRY.set(result.geometry, world);
 reuse.snapshots.set(document, { immutable: verifiedFrozenSource(document), world, result, floor: reuse.retainedFloor, docAabb: reuse.retainedDocAabb });
}

/** Only proven immutable sources may restore a cached root without inspection. */
export function restoreImmutableCompileSnapshot(document: LayoutDocumentWallFirst, reuse: LayoutCompileReuse): CompiledLayoutGeometryResult | null {
 if (!Object.isFrozen(document)) return null;
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
