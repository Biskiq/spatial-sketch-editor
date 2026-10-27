import { layoutLength } from './layout-source-collections';
/**
 * `layout-geometry-reuse.ts` — retained compile units for the incremental Layout
 * compile (T1.P02.S06 D.3 / H1).
 *
 * The canonical compiler stays the only compiler. What changes is that it may be
 * handed a store it wrote last time: each entity (Wall, Junction, Room, object)
 * keeps the compiled value it produced together with the **authored inputs** that
 * value was computed from. On the next compile an entity whose inputs are
 * unchanged returns the retained value by reference instead of rebuilding it.
 *
 * That is the whole proof obligation, stated once:
 *
 * > a reused unit is the value the canonical builder would produce now, because
 * > every input the builder reads is compared before the reuse is taken.
 *
 * When a candidate carries a certified copy-on-write delta (`CowDocumentDelta`)
 * or shares collection references with the retained world, unchanged entities are
 * proven identical by reference without an O(N) comparison pass; otherwise
 * `sameAuthored` provides the total structural fallback.
 */

import type { CacheKeyDependency } from './layout-geometry-keys';
import type {
	CompiledCurveSample,
	CompiledFloor,
	CompiledJunction,
	CompiledJunctionLeg,
	CompiledLayoutObject,
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
import type { LayoutDocumentWallFirst } from './layout-wall-first-types';
import { areEquivalentLayoutClones, getCowDocumentDelta } from './layout-world-index';

/**
 * Whether two authored values are indistinguishable to a compiled builder.
 *
 * Handles exactly the shapes an authored Layout contains: numbers, strings,
 * booleans, `null`/`undefined`, arrays (including nested coordinate pairs) and
 * plain records. Anything else falls back to `Object.is`, which is the safe
 * answer: unequal means "evaluate again", never "reuse something stale".
 *
 * `Object.is` is used instead of `===` on purpose: `NaN === NaN` is false, and
 * two authored `NaN`s describe the same compiled output (an issue), so treating
 * them as equal is both correct and cheap — while `+0`/`-0` stay distinct.
 */
export function sameAuthored(left: unknown, right: unknown): boolean {
	if (Object.is(left, right)) return true;
	if (Array.isArray(left)) {
		if (!Array.isArray(right) || left.length !== right.length) return false;
		for (let index = 0; index < left.length; index += 1) {
			if (!sameAuthored(left[index], right[index])) return false;
		}
		return true;
	}
	if (typeof left !== 'object' || left === null || typeof right !== 'object' || right === null) {
		return false;
	}
	if (Array.isArray(right)) return false;
	const leftKeys = Object.keys(left);
	const rightKeys = Object.keys(right);
	if (leftKeys.length !== rightKeys.length) return false;
	for (const key of leftKeys) {
		if (!Object.prototype.hasOwnProperty.call(right, key)) return false;
		if (!sameAuthored((left as Record<string, unknown>)[key], (right as Record<string, unknown>)[key])) return false;
	}
	return true;
}

/** The query records one entity contributed, so they can be spliced back in order. */
export type RetainedQueryRecords = {
	readonly points: readonly CompiledQueryPoint[];
	readonly spans: readonly CompiledQuerySpan[];
	readonly polygons: readonly CompiledQueryPolygon[];
	readonly aabbs: readonly CompiledQueryAabb[];
};

const NO_QUERY_RECORDS: RetainedQueryRecords = { points: [], spans: [], polygons: [], aabbs: [] };

/** Empty records, shared so an entity with none costs no allocation. */
export function noQueryRecords(): RetainedQueryRecords {
	return NO_QUERY_RECORDS;
}

/**
 * One retained physical Wall.
 *
 * `compiled` is the value the compiler last produced **including** the Junction
 * expansion applied after resolution, and `baseBounds` is the Wall's own
 * unresolved extent. Keeping both lets a re-resolved Junction rebuild the final
 * extent without ever mutating a retained object (a re-resolved miter can shrink
 * as well as grow).
 */
export type RetainedWall = {
	readonly authored: readonly unknown[];
	readonly compiled: CompiledPhysicalWall;
	readonly baseBounds2: LayoutBounds2;
	readonly baseBounds3: LayoutBounds3;
	readonly legs: { readonly start?: CompiledJunctionLeg; readonly end?: CompiledJunctionLeg };
	readonly records: RetainedQueryRecords;
	readonly issues: readonly LayoutGeometryIssue[];
};

/** One retained Junction resolution, with the legs and point it was resolved from. */
export type RetainedJunction = {
	readonly authored: readonly unknown[];
	readonly compiled: CompiledJunction;
	readonly issues: readonly LayoutGeometryIssue[];
};

/**
 * One retained Room.
 *
 * `source` is the adapter-built compiler input (boundary segments, mirrored
 * openings, arc lengths); `compiled` is the shared core's result and `stripped`
 * the wall-first view of it (`walls`/`openings` emptied because the canonical
 * physical-Wall collection owns them). `compiled === null` records a Room the
 * core skipped — the issue list then explains why, and both arrays get the same
 * entry on every compile.
 */
export type RetainedRoomSource = {
	readonly authored: readonly unknown[];
	readonly source: CompilerRoomSource;
};

export type RetainedRoom = {
	readonly source: CompilerRoomSource;
	readonly compiled: CompiledRoom | null;
	readonly stripped: CompiledRoom | null;
	readonly records: RetainedQueryRecords;
	readonly issues: readonly LayoutGeometryIssue[];
};

/** One retained Layout object descriptor and the query records it contributed. */
export type RetainedObject = {
	readonly authored: readonly unknown[];
	readonly descriptor: CompiledLayoutObject | null;
	readonly records: RetainedQueryRecords;
	readonly issues: readonly LayoutGeometryIssue[];
};

/** Retained Floor aggregate and room-id key dependency, avoiding O(R) JSON re-serialization. */
export type RetainedCompiledFloor = {
	readonly floorId: string;
	readonly elevation: number;
	readonly roomIds: readonly string[];
	readonly roomIdsDep: CacheKeyDependency;
	readonly bounds3: LayoutBounds3 | null;
	readonly compiled: CompiledFloor;
	readonly aabb: CompiledQueryAabb | null;
};

/** Retained document-level query AABB when aggregate world bounds are unchanged. */
export type RetainedDocumentAabb = {
	readonly bounds3: LayoutBounds3 | null;
	readonly aabb: CompiledQueryAabb | null;
};

/**
 * Work counters for one incremental compile.
 *
 * `evaluated` counts entities the canonical builders ran for; `reused` counts
 * entities whose retained value was installed by reference; `signatureVisits`
 * counts the structural comparisons that had to run.
 */
export type LayoutCompileStats = {
	readonly wallsEvaluated: number;
	readonly wallsReused: number;
	readonly openingsEvaluated: number;
	readonly junctionsEvaluated: number;
	readonly junctionsReused: number;
	readonly roomsEvaluated: number;
	readonly roomsReused: number;
	readonly objectsEvaluated: number;
	readonly objectsReused: number;
	/** Structural authored-input comparisons taken to decide the above. */
	readonly signatureVisits: number;
	/**
	 * True when the store held no retained unit of any class when this compile
	 * began, so every entity had to be evaluated (a cold compile).
	 */
	readonly cold: boolean;
	/** Authored entities the document indexes saw, regardless of reuse. */
	readonly entities: number;
};

const EMPTY_STATS: LayoutCompileStats = {
	wallsEvaluated: 0,
	wallsReused: 0,
	openingsEvaluated: 0,
	junctionsEvaluated: 0,
	junctionsReused: 0,
	roomsEvaluated: 0,
	roomsReused: 0,
	objectsEvaluated: 0,
	objectsReused: 0,
	signatureVisits: 0,
	cold: true,
	entities: 0
};

export type PrunableLayoutCollections = {
	readonly walls: readonly { readonly id: string }[];
	readonly junctions: readonly { readonly id: string }[];
	readonly rooms: readonly { readonly id: string }[];
	readonly objects: readonly { readonly id: string }[];
};

/**
 * The retained store. Created empty by {@link createLayoutCompileReuse} and kept
 * by the caller for the lifetime of one editing surface; the compiler fills it
 * and consults it, and never writes to a value it handed out.
 */
export type LayoutCompileReuse = {
	walls: Map<string, RetainedWall>;
	junctions: Map<string, RetainedJunction>;
	/** Adapter-level Room inputs, keyed by Room id. */
	roomSources: Map<string, RetainedRoomSource>;
	/** Core-level Room compiles, keyed by the identity of a retained `source`. */
	roomCompiles: WeakMap<CompilerRoomSource, RetainedRoom>;
	objects: Map<string, RetainedObject>;
	/** Per-session historical roots; reset discards the entire weak directory. */
	readonly snapshots: WeakMap<LayoutDocumentWallFirst, unknown>;
	retainedFloor: RetainedCompiledFloor | null;
	retainedDocAabb: RetainedDocumentAabb | null;
	/** Persistent compile roots; local updates copy O(k log N) nodes plus affected output. */
	world: unknown;
	lastPrunedDocument: PrunableLayoutCollections | null;
	/** Counters for the compile that just ran; replaced, never mutated in place. */
	stats: LayoutCompileStats;
	readonly counters: MutableStats;
};

/** Mutable counters the compile increments; frozen into `stats` when it returns. */
export type MutableStats = {
	wallsEvaluated: number;
	wallsReused: number;
	openingsEvaluated: number;
	junctionsEvaluated: number;
	junctionsReused: number;
	roomsEvaluated: number;
	roomsReused: number;
	objectsEvaluated: number;
	objectsReused: number;
	signatureVisits: number;
	entities: number;
};

function freshCounters(): MutableStats {
	return {
		wallsEvaluated: 0,
		wallsReused: 0,
		openingsEvaluated: 0,
		junctionsEvaluated: 0,
		junctionsReused: 0,
		roomsEvaluated: 0,
		roomsReused: 0,
		objectsEvaluated: 0,
		objectsReused: 0,
		signatureVisits: 0,
		entities: 0
	};
}

/** An empty retained store; the first compile against it is a cold compile. */
export function createLayoutCompileReuse(): LayoutCompileReuse {
	return {
		walls: new Map(),
		junctions: new Map(),
		roomSources: new Map(),
		roomCompiles: new WeakMap(),
		objects: new Map(),
		snapshots: new WeakMap(),
		retainedFloor: null,
		retainedDocAabb: null,
		world: null,
		lastPrunedDocument: null,
		stats: EMPTY_STATS,
		counters: freshCounters()
	};
}

/**
 * Reset the per-compile counters. Called by the compiler entry, so one store can
 * serve a whole session and each compile reports its own work.
 */
export function beginLayoutCompile(reuse: LayoutCompileReuse): void {
	const counters = reuse.counters as MutableStats;
	counters.wallsEvaluated = 0;
	counters.wallsReused = 0;
	counters.openingsEvaluated = 0;
	counters.junctionsEvaluated = 0;
	counters.junctionsReused = 0;
	counters.roomsEvaluated = 0;
	counters.roomsReused = 0;
	counters.objectsEvaluated = 0;
	counters.objectsReused = 0;
	counters.signatureVisits = 0;
	counters.entities = 0;
}

/** Freeze this compile's counters into `stats`. Called once, on the way out. */
export function finishLayoutCompile(reuse: LayoutCompileReuse, cold: boolean): LayoutCompileStats {
	const counters = reuse.counters;
	reuse.stats = {
		wallsEvaluated: counters.wallsEvaluated,
		wallsReused: counters.wallsReused,
		openingsEvaluated: counters.openingsEvaluated,
		junctionsEvaluated: counters.junctionsEvaluated,
		junctionsReused: counters.junctionsReused,
		roomsEvaluated: counters.roomsEvaluated,
		roomsReused: counters.roomsReused,
		objectsEvaluated: counters.objectsEvaluated,
		objectsReused: counters.objectsReused,
		signatureVisits: counters.signatureVisits,
		cold,
		entities: counters.entities
	};
	return reuse.stats;
}

/**
 * Whether `prev` and `next` are COW relatives whose Wall/Junction/Room id sets
 * are guaranteed identical (geometry moves, centerline edits, Wall scalars, and
 * Object CRUD never add or remove Walls, Junctions or Rooms).
 */
function sameArchitectureIdMembership(
	prev: PrunableLayoutCollections,
	next: PrunableLayoutCollections
): { arch: boolean; objects: boolean } {
	const countsMatch =
		layoutLength(prev as LayoutDocumentWallFirst, 'walls') === layoutLength(next as LayoutDocumentWallFirst, 'walls') &&
		layoutLength(prev as LayoutDocumentWallFirst, 'junctions') === layoutLength(next as LayoutDocumentWallFirst, 'junctions') &&
		layoutLength(prev as LayoutDocumentWallFirst, 'rooms') === layoutLength(next as LayoutDocumentWallFirst, 'rooms');
	if (!countsMatch) return { arch: false, objects: false };
	const objCountsMatch = layoutLength(prev as LayoutDocumentWallFirst, 'objects') === layoutLength(next as LayoutDocumentWallFirst, 'objects');
	const prevDoc = prev as LayoutDocumentWallFirst;
	const nextDoc = next as LayoutDocumentWallFirst;
	if (areEquivalentLayoutClones(prevDoc, nextDoc)) {
		return { arch: true, objects: objCountsMatch };
	}
	const prevDelta = getCowDocumentDelta(prevDoc);
	const nextDelta = getCowDocumentDelta(nextDoc);
	if (nextDelta && areEquivalentLayoutClones(nextDelta.baseline, prevDoc)) {
		const arch = nextDelta.changedRoomIds.length === 0;
		return { arch, objects: arch && objCountsMatch && nextDelta.changedObjectIds.length === 0 };
	}
	if (prevDelta && areEquivalentLayoutClones(prevDelta.baseline, nextDoc)) {
		const arch = prevDelta.changedRoomIds.length === 0;
		return { arch, objects: arch && objCountsMatch && prevDelta.changedObjectIds.length === 0 };
	}
	if (prevDelta && nextDelta && areEquivalentLayoutClones(prevDelta.baseline, nextDelta.baseline)) {
		const arch = prevDelta.changedRoomIds.length === 0 && nextDelta.changedRoomIds.length === 0;
		return {
			arch,
			objects:
				arch &&
				objCountsMatch &&
				prevDelta.changedObjectIds.length === 0 &&
				nextDelta.changedObjectIds.length === 0
		};
	}
	const nextParentDelta = nextDelta ? getCowDocumentDelta(nextDelta.baseline) : undefined;
	if (nextDelta && nextParentDelta) {
		if (areEquivalentLayoutClones(nextParentDelta.baseline, prevDoc)) {
			const arch =
				nextParentDelta.changedRoomIds.length === 0 && nextDelta.changedRoomIds.length === 0;
			return {
				arch,
				objects:
					arch &&
					objCountsMatch &&
					nextParentDelta.changedObjectIds.length === 0 &&
					nextDelta.changedObjectIds.length === 0
			};
		}
		if (prevDelta && areEquivalentLayoutClones(prevDelta.baseline, nextParentDelta.baseline)) {
			const arch =
				prevDelta.changedRoomIds.length === 0 &&
				nextParentDelta.changedRoomIds.length === 0 &&
				nextDelta.changedRoomIds.length === 0;
			return {
				arch,
				objects:
					arch &&
					objCountsMatch &&
					prevDelta.changedObjectIds.length === 0 &&
					nextParentDelta.changedObjectIds.length === 0 &&
					nextDelta.changedObjectIds.length === 0
			};
		}
	}
	return { arch: false, objects: false };
}

/**
 * Drop retained entries for entities the current document no longer contains.
 * Without this a long editing session keeps every Wall it ever saw; with it the
 * store is bounded by the document, which is what F13's resource rows need.
 *
 * Returns how many units were released, so a test can assert the store shrinks.
 */
export function pruneLayoutCompileReuse(
	reuse: LayoutCompileReuse,
	document: PrunableLayoutCollections
): number {
	if (
		reuse.walls.size === 0 &&
		reuse.junctions.size === 0 &&
		reuse.roomSources.size === 0 &&
		reuse.objects.size === 0
	) {
		reuse.lastPrunedDocument = document;
		return 0;
	}
	const prev = reuse.lastPrunedDocument;
	if (prev === document) return 0;

	const skip = prev !== null ? sameArchitectureIdMembership(prev, document) : { arch: false, objects: false };
	const skipArchPrune = skip.arch;
	let released = 0;

	if (!skipArchPrune && (!prev || prev.walls !== document.walls)) {
		const wallIds = new Set(document.walls.map((wall) => wall.id));
		for (const id of reuse.walls.keys()) {
			if (wallIds.has(id)) continue;
			reuse.walls.delete(id);
			released += 1;
		}
	}
	if (!skipArchPrune && (!prev || prev.junctions !== document.junctions)) {
		const junctionIds = new Set(document.junctions.map((junction) => junction.id));
		for (const id of reuse.junctions.keys()) {
			if (junctionIds.has(id)) continue;
			reuse.junctions.delete(id);
			released += 1;
		}
	}
	if (!skipArchPrune && (!prev || prev.rooms !== document.rooms)) {
		const roomIds = new Set(document.rooms.map((room) => room.id));
		for (const id of reuse.roomSources.keys()) {
			if (roomIds.has(id)) continue;
			reuse.roomSources.delete(id);
			released += 1;
		}
	}
	if (!skip.objects && (!prev || prev.objects !== document.objects)) {
		if (reuse.objects.size > 0) {
			const objectIds = new Set(document.objects.map((object) => object.id));
			for (const id of reuse.objects.keys()) {
				if (objectIds.has(id)) continue;
				reuse.objects.delete(id);
				released += 1;
			}
		}
	}
	reuse.lastPrunedDocument = document;
	return released;
}

/** Sample identity used by a caller that has no cached derivation to compare. */
export type { CompiledCurveSample };
