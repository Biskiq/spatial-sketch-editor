import type { WallSamplingDerivation } from '../wall/centerline';
import { isCanonicalWallSampling } from '../wall/centerline';
import { restoreImmutableCompileBaseline, restoreImmutableCompileSnapshot, seedReuseFromPassiveCompile } from './delta';
import { layoutLength } from '../kernel/source-collections';
import type { LayoutDocumentWallFirst } from '../wall/types';
import type { CompiledLayoutGeometryResult } from './types';
import type { LayoutCompileStats } from './reuse';
import { beginLayoutCompile, createLayoutCompileReuse, finishLayoutCompile, pruneLayoutCompileReuse } from './reuse';
import { compileWallFirstLayoutGeometry } from './compiler';
import { DELTA_BUILDERS } from './delta-builders';

/**
 * An incremental compile session (T1.P02.S06 D.3 / H1).
 *
 * The session owns one retained store and feeds it the documents it compiles.
 * Each `compile` is the **canonical compiler** — same builders, same assembly,
 * same ordering — consulting retained per-entity units at each entity boundary:
 * an entity whose authored inputs are unchanged returns its previous value by
 * reference, and one whose inputs moved is rebuilt by the same code as always.
 * There is no second algorithm and no second output shape, so a session result
 * and a cold-compile result of the same document are equal by construction;
 * the heavy differential proves it over an exhaustive edit sweep.
 *
 * Work: certified local edits update persistent paths and affected output.
 * Missing lineage, changed membership and global datums use the canonical full
 * fallback. Known immutable historical roots restore in constant root work,
 * including across membership changes; their transient memo tables are retired
 * by root replacement. Stats count evaluations separately from storage/output.
 *
 * Callers that cannot hold state call `compileWallFirstLayoutGeometry` with no
 * session bound: the canonical read returns the result recorded for that exact
 * frozen document object, or compiles once and records it.
 * `compileWallFirstLayoutGeometryFresh` is the cold oracle for differentials.
 */
export type LayoutCompileSession = {
	/** Compile `document`, reusing every entity whose authored inputs are unchanged. */
	compile(document: LayoutDocumentWallFirst, sampling?: WallSamplingDerivation): CompiledLayoutGeometryResult;
	/**
	 * Prime this session from a clean passive compile result already recorded for
	 * `document` (zero geometry sampling or cache-key construction).
	 */
	seedFromCompiled(document: LayoutDocumentWallFirst): boolean;
	/** Work counts from the most recent compile. */
	stats(): LayoutCompileStats;
	/** Units released because their entity left the document, on the last compile. */
	released(): number;
	/** Drop every retained unit: the next compile is a cold compile. */
	reset(): void;
	/** How many retained units the store currently holds, per entity class. */
	retained(): { walls: number; junctions: number; rooms: number; objects: number };
};


/** Create one incremental session; it compiles once per call and never throws on reuse. */
export function createLayoutCompileSession(): LayoutCompileSession {
	let store = createLayoutCompileReuse();
	let releasedUnits = 0;
	return {
		compile(document, sampling) {
			const restored = isCanonicalWallSampling(sampling) ? restoreImmutableCompileSnapshot(document, store) : null;
			if (restored) {
				beginLayoutCompile(store);
				const world = store.world as import('./delta').RetainedCompileWorld;
				store.counters.wallsReused = world.sortedWalls.length;
				store.counters.junctionsReused = world.sortedJunctions.length;
				store.counters.roomsReused = world.validCeilingRoomCount;
				store.counters.objectsReused = world.objectUnit.compiledObjects.length;
				store.counters.regionsReused = world.regionUnit.regions.length;
				finishLayoutCompile(store, false); releasedUnits = 0; return restored;
			}
			if (isCanonicalWallSampling(sampling)) restoreImmutableCompileBaseline(document, store);
			releasedUnits = pruneLayoutCompileReuse(store, document);
			return compileWallFirstLayoutGeometry(document, sampling, store);
		},
		seedFromCompiled(document) {
			return seedReuseFromPassiveCompile(document, store, DELTA_BUILDERS);
		},
		stats: () => store.stats,
		released: () => releasedUnits,
		reset() {
			store = createLayoutCompileReuse();
			releasedUnits = 0;
		},
		retained: () => {
			// "Retained" means units the store can serve, not values that compiled
			// cleanly. A delta may retain a unit whose value is invalid — an
			// `object_invalid` descriptor has no compiled object, and the map branch
			// below still counts its unit — so the world branch reports slot and
			// authored counts. Counting `objectUnit.compiledObjects` here would make
			// the same document report one fewer object only because the last compile
			// went through a delta.
			const world = store.world as import('./delta').RetainedCompileWorld | null;
			return world ? {
				walls: world.wallSlots.length, junctions: world.sortedJunctions.length,
				rooms: world.roomSlots.length, objects: layoutLength(world.document, 'objects')
			} : { walls: store.walls.size, junctions: store.junctions.size, rooms: store.roomSources.size, objects: store.objects.size };
		}
	};
}


/**
 * The session bound for the current synchronous authoring step, if any.
 *
 * The precision planners are the compiler's other hot caller: one plan per
 * pointer sample, each of which compiles its candidate. They are a library of
 * individually exported, synchronous functions with positional signatures, so
 * the session reaches them through this one documented binding rather than an
 * extra parameter on seventeen entry points and every test that calls one.
 *
 * It is deliberately **not** ambient across events: {@link withLayoutCompileSession}
 * binds it, runs a synchronous body and clears it in `finally`. A nested bind is
 * refused instead of shadowing, so a plan can never inherit another surface's
 * store. Planners return values, never promises, so nothing can observe the
 * binding across an `await`.
 */
let boundCompileSession: LayoutCompileSession | null = null;


/** The session bound to this synchronous step, or `undefined` outside one. */
export function activeLayoutCompileSession(): LayoutCompileSession | undefined {
	return boundCompileSession ?? undefined;
}


/**
 * Run one synchronous authoring step with `session` bound to the canonical
 * compiler. Without a session the body simply runs (today's cold compile).
 */
export function withLayoutCompileSession<T>(session: LayoutCompileSession | undefined, body: () => T): T {
	if (!session) return body();
	if (boundCompileSession) {
		throw new Error('a layout compile session is already bound to this synchronous step');
	}
	boundCompileSession = session;
	try {
		return body();
	} finally {
		boundCompileSession = null;
	}
}


/**
 * Shared compile core (P23.0 compiler cutover): one geometry compiler/output
 * model. `compileWallFirstLayoutGeometry` is its only adapter since T1.P02.S05;
 * a direct caller may still supply any `CompilerSource` shape, whose optional
 * fields keep their historical defaults. Diagnostics paths remain room-indexed
 * (`rooms[i]`) so existing issue expectations are unchanged.
 */
/**
 * Which query-record set the shared core emits for Room boundary walls.
 *
 * - `room` (default) is the historical room-indexed set: points, spans and
 *   Wall/Opening AABBs carrying `roomId`.
 * - `physical-wall` emits only what the wall-first adapter keeps — Room floor
 *   polygons and Room AABBs — because that adapter replaces every room-derived
 *   point, span and Wall/Opening AABB with the canonical physical-Wall set.
 *
 * The wall-first adapter used to build the discarded set
 * and then drop it, which Bench 1 counted as most of a grid-L compile's
 * cache-key characters and geometry work.
 */
export type LayoutGeometryCompileOptions = {
	readonly queryRecords?: 'room' | 'physical-wall';
};
