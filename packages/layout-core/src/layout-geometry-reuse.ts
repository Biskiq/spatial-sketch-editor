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
 * So the comparison below is deliberately structural and total rather than a
 * hash: it visits numbers and authored records, never a compiled array, and two
 * values compare equal only when they are indistinguishable to the builder.
 *
 * What this does **not** claim: the traversal itself is O(N) in the document's
 * entities (one comparison per entity). It is the *evaluation* — the section
 * splitting, opening compilation, polyline and bounds construction, junction
 * resolution, room validation and mesh-facing records — that becomes O(k) in the
 * entities an edit actually touched. `sameAuthored` is roughly four orders of
 * magnitude cheaper per entity than the compile it guards, which is the whole
 * point; `LayoutCompileStats` reports both sides so the difference stays
 * measured rather than asserted.
 */

import type {
	CompiledCurveSample,
	CompiledJunction,
	CompiledJunctionLeg,
	CompiledLayoutObject,
	CompiledOpening,
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

/**
 * Work counters for one incremental compile.
 *
 * `evaluated` counts entities the canonical builders ran for; `reused` counts
 * entities whose retained value was installed by reference; `visited` counts the
 * structural comparisons that made that decision. The S06 locality oracle reads
 * `evaluated` (it must stay bounded by the affected set), and the signature cost
 * is reported so the O(N) comparison term is visible rather than implied.
 */
export type LayoutCompileStats = {
	readonly wallsEvaluated: number;
	readonly wallsReused: number;
	readonly junctionsEvaluated: number;
	readonly junctionsReused: number;
	readonly roomsEvaluated: number;
	readonly roomsReused: number;
	readonly objectsEvaluated: number;
	readonly objectsReused: number;
	/** Structural authored-input comparisons taken to decide the above. */
	readonly signatureVisits: number;
	/** True when this compile had no retained store at all (a cold compile). */
	readonly cold: boolean;
	/** Authored entities the document indexes saw, regardless of reuse. */
	readonly entities: number;
};

const EMPTY_STATS: LayoutCompileStats = {
	wallsEvaluated: 0,
	wallsReused: 0,
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

/**
 * The retained store. Created empty by {@link createLayoutCompileReuse} and kept
 * by the caller for the lifetime of one editing surface; the compiler fills it
 * and consults it, and never writes to a value it handed out.
 */
export type LayoutCompileReuse = {
	readonly walls: Map<string, RetainedWall>;
	readonly junctions: Map<string, RetainedJunction>;
	/** Adapter-level Room inputs, keyed by Room id. */
	readonly roomSources: Map<string, RetainedRoomSource>;
	/** Core-level Room compiles, keyed by the identity of a retained `source`. */
	readonly roomCompiles: WeakMap<CompilerRoomSource, RetainedRoom>;
	readonly objects: Map<string, RetainedObject>;
	/** Counters for the compile that just ran; replaced, never mutated in place. */
	stats: LayoutCompileStats;
	readonly counters: MutableStats;
};

/** Mutable counters the compile increments; frozen into `stats` when it returns. */
export type MutableStats = {
	wallsEvaluated: number;
	wallsReused: number;
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
 * Drop retained entries for entities the current document no longer contains.
 * Without this a long editing session keeps every Wall it ever saw; with it the
 * store is bounded by the document, which is what F13's resource rows need.
 *
 * Returns how many units were released, so a test can assert the store shrinks.
 */
export function pruneLayoutCompileReuse(
	reuse: LayoutCompileReuse,
	document: {
		readonly walls: readonly { readonly id: string }[];
		readonly junctions: readonly { readonly id: string }[];
		readonly rooms: readonly { readonly id: string }[];
		readonly objects: readonly { readonly id: string }[];
	}
): number {
	let released = 0;
	const wallIds = new Set(document.walls.map((wall) => wall.id));
	for (const id of reuse.walls.keys()) {
		if (wallIds.has(id)) continue;
		reuse.walls.delete(id);
		released += 1;
	}
	const junctionIds = new Set(document.junctions.map((junction) => junction.id));
	for (const id of reuse.junctions.keys()) {
		if (junctionIds.has(id)) continue;
		reuse.junctions.delete(id);
		released += 1;
	}
	const roomIds = new Set(document.rooms.map((room) => room.id));
	for (const id of reuse.roomSources.keys()) {
		if (roomIds.has(id)) continue;
		reuse.roomSources.delete(id);
		released += 1;
	}
	const objectIds = new Set(document.objects.map((object) => object.id));
	for (const id of reuse.objects.keys()) {
		if (objectIds.has(id)) continue;
		reuse.objects.delete(id);
		released += 1;
	}
	return released;
}

/** Sample identity used by a caller that has no cached derivation to compare. */
export type { CompiledCurveSample };
