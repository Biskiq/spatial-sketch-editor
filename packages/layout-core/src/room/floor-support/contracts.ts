import type { Vec3 } from '../../kernel/types';
import type { LayoutVec2 } from '../../geometry/coordinates';
import type {
	CompiledFloor,
	CompiledLayoutGeometry,
	CompiledQueryPolygon,
	CompiledRegion,
	CompiledRoom,
} from '../../geometry/types';

/**
 * Operation/query tolerances, not compiler epsilon.
 *
 * They never round a canonical value and never
 * change `layout-core`'s compiler tolerances. `boundaryMeters` is the declared
 * boundary-membership tolerance, `coplanarElevationMeters` decides when two
 * compiled elevations denote the same support, and `upNormalComponent` is the
 * per-component tolerance for up-normal equivalence.
 */
export type FloorSupportTolerances = {
	boundaryMeters: number;
	coplanarElevationMeters: number;
	upNormalComponent: number;
};

export const FLOOR_SUPPORT_TOLERANCES: Readonly<FloorSupportTolerances> = Object.freeze({
	boundaryMeters: 1e-6,
	coplanarElevationMeters: 1e-6,
	upNormalComponent: 1e-9,
});

/** A compiled Room floor or floor-region top faces up; candidates carry it. */
export const FLOOR_SUPPORT_UP_NORMAL: Readonly<Vec3> = Object.freeze([0, 1, 0]);

/** A closed-Space lid or overhead-region underside faces down. */
export const OVERHEAD_SUPPORT_DOWN_NORMAL: Readonly<Vec3> = Object.freeze([0, -1, 0]);

/**
 * One compiled support face record, narrowed to the fields the query reads.
 */
export type FloorSupportQueryPolygon = Pick<
	CompiledQueryPolygon,
	'id' | 'cacheKey' | 'kind' | 'polygon' | 'sourceId' | 'floorId' | 'roomId' | 'elevation'
>;

/** The compiled region facts an upward region witness is verified against. */
export type FloorSupportRegionFacts = Pick<
	CompiledRegion,
	'regionId' | 'role' | 'topY' | 'bottomY' | 'id' | 'cacheKey'
>;

/**
 * The compiled facts the upward query is a read-only function of.
 *
 * `floorSupportSnapshotOf(compiled)` adapts canonical compiler output; a caller
 * that already holds the records may pass them directly. A consumer that must
 * keep today's Room-only behavior (Scene placement before V1d) narrows
 * `queryPolygons` to `kind: 'room-floor'` and passes `regions: []`.
 */
export type FloorSupportSnapshot = {
	floors: readonly Pick<CompiledFloor, 'floorId' | 'elevation'>[];
	rooms: readonly Pick<CompiledRoom, 'roomId' | 'floorElevation'>[];
	regions: readonly FloorSupportRegionFacts[];
	queryPolygons: readonly FloorSupportQueryPolygon[];
};

export function floorSupportSnapshotOf(compiled: CompiledLayoutGeometry): FloorSupportSnapshot {
	return {
		floors: compiled.floors,
		rooms: compiled.rooms,
		regions: compiled.regions,
		queryPolygons: compiled.queries.polygons,
	};
}

export type FloorSupportScope = {
	/**
	 * An explicitly chosen Layout floor source id. It is a filter, never an
	 * inferred nearest-level heuristic. A chosen *level* is resolved to its
	 * floor id above this package (F.1 maps the current floor id to level
	 * qualification), because a level is not a Layout-core concept.
	 */
	floorId?: string;
};

export type FloorSupportQueryInput = {
	/** The caller's compile generation for the snapshot it is querying. */
	generationId: string;
	/**
	 * The generation the captured evidence (a mesh hit, a previous frame's
	 * point) was taken against. A mismatch refuses as `stale-generation`
	 * instead of resolving support from evidence the current snapshot cannot
	 * vouch for. Absent means "the caller already qualified its evidence".
	 */
	evidenceGenerationId?: string;
	x: number;
	z: number;
	scope?: FloorSupportScope;
};

/** One compiled support face that supports the queried point. */
export type FloorSupportWitnessSource =
	| { readonly kind: 'room'; readonly roomId: string }
	| { readonly kind: 'region'; readonly regionId: string };

export type FloorSupportWitness = {
	/** The typed source of this witness: a Room floor or a floor-role region top. */
	source: FloorSupportWitnessSource;
	floorId: string;
	/** Compiled record identity of the containing support polygon. */
	recordId: string;
	/** Compiled identity of the authored inputs that produced the record. */
	cacheKey: string;
	sourceId: string;
	/** Collision-safe choice identity derived from Layout-native IDs; not a lexical comparator. */
	orderKey: string;
	/** World elevation this witness establishes. */
	elevation: number;
};

export type FloorSupportCandidate = {
	/** World X/Z at which these witnesses were queried. */
	queryPoint: LayoutVec2;
	elevation: number;
	upNormal: Vec3;
	/** The caller's generation, echoed so acceptance can recheck it. */
	generationId: string;
	/** Every equivalent source witness, ordered lexically by source, floor and record. */
	witnesses: readonly FloorSupportWitness[];
	/** First source-ordered witness identity: stable and unique, never an elevation pick. */
	orderKey: string;
	/** Stable diagnostic/display label; never an identity and never a float readout. */
	label: string;
};

/** The stable choice identity of datum support; it can never equal a source witness key. */
export const DATUM_SUPPORT_ORDER_KEY = 'stage-datum';

export type FloorSupportQueryResult =
	| { kind: 'candidates'; candidates: readonly FloorSupportCandidate[] }
	| { kind: 'none' }
	| {
			kind: 'invalid-input';
			code: 'non-finite-point' | 'missing-generation-id';
			message: string;
	  }
	| {
			kind: 'stale-generation';
			generationId: string;
			evidenceGenerationId: string;
			message: string;
	  }
	| {
			kind: 'unsupported';
			code: 'unknown-scope-floor' | 'missing-support-facts' | 'contradictory-support-facts';
			message: string;
	  };
