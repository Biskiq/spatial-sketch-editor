import type { LayoutVec2 } from '../geometry/coordinates';
import { LAYOUT_GEOMETRY_EPSILON } from '../geometry/openings';
import type { PlanBox } from './plan-box-index';
import type { DynamicBvh } from './bvh';
import type {
	LayoutDocumentWallFirst,
	LayoutJunction,
	LayoutObject,
	LayoutWall,
	LayoutWallFirstRoom,
	LayoutWallOpening,
} from '../wall/types';
import type { SampledTopologyWall } from '../wall/topology';
import { PersistentVector } from '../kernel/persistent-store';
import type { IndexedOpeningEntry } from './cow';
import type {
	EdgeAreaContribution,
	HalfEdgeDesc,
	HalfEdgeWalkLink,
	WalkSummary,
} from './planar-map';

export type DocumentWorldIndex = {
	readonly junctionsRef: readonly LayoutJunction[] | PersistentVector<LayoutJunction>;
	readonly wallsRef: readonly LayoutWall[] | PersistentVector<LayoutWall>;
	readonly roomsRef: readonly LayoutWallFirstRoom[] | PersistentVector<LayoutWallFirstRoom>;
	readonly openingsRef: readonly LayoutWallOpening[] | PersistentVector<LayoutWallOpening>;
	readonly objectsRef: readonly LayoutObject[] | PersistentVector<LayoutObject>;
	readonly junctionById: ReadonlyMap<string, LayoutJunction>;
	readonly junctionIndexById: ReadonlyMap<string, number>;
	readonly wallById: ReadonlyMap<string, LayoutWall>;
	readonly wallIndexById: ReadonlyMap<string, number>;
	readonly roomById: ReadonlyMap<string, LayoutWallFirstRoom>;
	readonly roomIndexById: ReadonlyMap<string, number>;
	readonly objectById: ReadonlyMap<string, LayoutObject>;
	readonly objectIndexById: ReadonlyMap<string, number>;
	readonly openingIndexById: ReadonlyMap<string, number>;
	readonly pointById: ReadonlyMap<string, LayoutVec2>;
	readonly incidentWallIdsByJunctionId: ReadonlyMap<string, readonly string[]>;
	readonly roomsByWallId: ReadonlyMap<string, readonly string[]>;
	/** Walls and Junctions on an open Space's boundary. Their deltas go cold. */
	readonly openRoomWallIdSet: ReadonlySet<string>;
	readonly openRoomJunctionIdSet: ReadonlySet<string>;
	/** Walls and Junctions on a Round Room's boundary. Their deltas go cold for certification. */
	readonly roundRoomWallIdSet: ReadonlySet<string>;
	readonly roundRoomJunctionIdSet: ReadonlySet<string>;
	readonly openingsByWallId: ReadonlyMap<string, readonly IndexedOpeningEntry[]>;
	readonly openingIndicesByWallId: ReadonlyMap<string, readonly number[]>;
	readonly componentKeyByJunctionId: ReadonlyMap<string, string | symbol>;
	readonly componentKeyByWallId: ReadonlyMap<string, string>;
	readonly unattachedJunctionIds: readonly string[];
	readonly wallBvh: DynamicBvh;
	readonly sampledWallById: ReadonlyMap<string, SampledTopologyWall>;
	readonly faceGraphWallIdSet: ReadonlySet<string>;
	readonly starOrderByJunctionId: ReadonlyMap<string, readonly HalfEdgeDesc[]>;
	readonly walks: PersistentVector<WalkSummary>;
	readonly halfEdgeWalkByKey: ReadonlyMap<string, HalfEdgeWalkLink>;
};

export type CertifiedWorldPatch = {
	readonly parentDoc: LayoutDocumentWallFirst;
	readonly changedJunctionIds: readonly string[];
	readonly affectedWallIds: readonly string[];
	readonly changedObjectIds: readonly string[];
	readonly changedOpeningWallIds?: readonly string[];
	readonly nextSampledWalls?: ReadonlyMap<string, SampledTopologyWall>;
	readonly nextWallBoxes?: ReadonlyMap<string, PlanBox>;
	readonly nextWalkSummaries?: ReadonlyMap<number, WalkSummary>;
	readonly nextHalfEdgeContribs?: ReadonlyMap<string, EdgeAreaContribution>;
};

export const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/;

export const POINT_EPSILON = LAYOUT_GEOMETRY_EPSILON;

/**
 * Conservative pad applied to indexed Wall boxes and swept query bounds:
 * strictly exceeds `JUNCTION_COINCIDENCE_EPSILON` (1e-6),
 * `LAYOUT_GEOMETRY_EPSILON` (1e-6) and `CURVE_SELF_INTERSECTION_TOLERANCE` (1e-4).
 */
export const SWEPT_INDEX_PAD = 1e-3;
