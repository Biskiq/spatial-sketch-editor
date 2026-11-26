import type { CompiledRegionUnit } from '../../room/region-compile';
import type { LayoutVec2 } from '../coordinates';
import type {
	CompiledFloor,
	CompiledJunction,
	CompiledJunctionLeg,
	CompiledLayoutObject,
	CompiledLegJoin,
	CompiledPhysicalWall,
	CompiledQueryAabb,
	CompiledQueryPolygon,
	CompiledRoom,
	CompilerRoomSource,
	LayoutBounds2,
	LayoutBounds3,
	LayoutGeometryIssue,
} from '../types';
import type { LayoutCompileReuse, RetainedQueryRecords } from '../reuse';
import type {
	LayoutDerivedWallRole,
	LayoutDocumentWallFirst,
	LayoutJunction,
	LayoutObject,
	LayoutWall,
	LayoutWallOpening,
} from '../../wall/types';
import { PersistentMap, PersistentVector } from '../../kernel/persistent-store';
import type { ChunkSummary } from './world';

export type EvaluatedRoomUnit = {
	readonly hasValidCeiling: boolean;
	readonly source: CompilerRoomSource | null;
	readonly compiled: CompiledRoom | null;
	readonly stripped: CompiledRoom | null;
	readonly polygons: readonly CompiledQueryPolygon[];
	readonly aabbs: readonly CompiledQueryAabb[];
	readonly issues: readonly LayoutGeometryIssue[];
	readonly bounds3: LayoutBounds3 | null;
};

export type EvaluatedWallBaseUnit = {
	readonly baseCompiled: CompiledPhysicalWall;
	readonly baseBounds2: LayoutBounds2;
	readonly baseBounds3: LayoutBounds3;
	readonly baseRecords: RetainedQueryRecords;
	readonly baseWallAabb: CompiledQueryAabb;
	readonly issues: readonly LayoutGeometryIssue[];
	readonly legs: { readonly start?: CompiledJunctionLeg; readonly end?: CompiledJunctionLeg };
	readonly openingsCount: number;
};

export type ExpandedWallUnit = {
	readonly compiled: CompiledPhysicalWall;
	readonly wallAabb: CompiledQueryAabb;
};

export type ResolvedJunctionUnit = {
	readonly compiled: CompiledJunction;
	readonly issues: readonly LayoutGeometryIssue[];
	readonly evaluated: boolean;
};

export type CompiledObjectsUnit = {
	readonly compiledObjects: CompiledLayoutObject[];
	readonly polygons: CompiledQueryPolygon[];
	readonly aabbs: CompiledQueryAabb[];
	readonly issues: LayoutGeometryIssue[];
	readonly bounds3: LayoutBounds3 | null;
	readonly floorRoomBounds3: LayoutBounds3 | null;
};

export type FloorAndAabbsUnit = {
	readonly floor: CompiledFloor;
	readonly floorAabb: CompiledQueryAabb | null;
	readonly docAabb: CompiledQueryAabb | null;
};

export type CanonicalDeltaBuilders = {
	junctionInputs(
		document: LayoutDocumentWallFirst,
		point: LayoutVec2,
		legs: readonly CompiledJunctionLeg[],
		wallById: ReadonlyMap<string, LayoutWall>,
		pointById: ReadonlyMap<string, LayoutVec2>,
	): { authored: readonly unknown[] };
	evaluateRoom(
		document: LayoutDocumentWallFirst,
		roomIndex: number,
		pointById: ReadonlyMap<string, LayoutVec2>,
		junctionById: ReadonlyMap<string, LayoutJunction>,
		wallById: ReadonlyMap<string, LayoutWall>,
		openingsByHostWallId: ReadonlyMap<string, readonly LayoutWallOpening[]>,
		openingOrderById: ReadonlyMap<string, number>,
		defaultWallThickness: number,
	): EvaluatedRoomUnit;
	evaluateWallBase(
		document: LayoutDocumentWallFirst,
		wall: LayoutWall,
		pointById: ReadonlyMap<string, LayoutVec2>,
		hostedOpenings: readonly LayoutWallOpening[],
		derivedRole: LayoutDerivedWallRole,
	): EvaluatedWallBaseUnit | null;
	resolveJunction(
		document: LayoutDocumentWallFirst,
		junctionId: string,
		point: LayoutVec2,
		sortedLegs: CompiledJunctionLeg[],
		reuse: LayoutCompileReuse,
		wallById: ReadonlyMap<string, LayoutWall>,
		pointById: ReadonlyMap<string, LayoutVec2>,
	): ResolvedJunctionUnit;
	expandWall(
		floorId: string,
		floorElevation: number,
		wallHeight: number,
		wallId: string,
		baseCompiled: CompiledPhysicalWall,
		baseBounds2: LayoutBounds2,
		baseBounds3: LayoutBounds3,
		currentCompiled: CompiledPhysicalWall,
		currentWallAabb: CompiledQueryAabb,
		joins: readonly CompiledLegJoin[] | undefined,
	): ExpandedWallUnit;
	compileObjects(
		objects: readonly LayoutObject[],
		documentRoomIds: ReadonlySet<string>,
		reuse: LayoutCompileReuse,
	): CompiledObjectsUnit;
	buildFloorAndAabbs(
		floor: LayoutDocumentWallFirst['floor'],
		floorRoomIds: readonly string[],
		floorBounds: LayoutBounds3 | null,
		documentBounds: LayoutBounds3 | null,
		reuse: LayoutCompileReuse,
	): FloorAndAabbsUnit;
	computeWallBaseBounds(
		wall: CompiledPhysicalWall,
		floorElevation: number,
	): { readonly bounds2: LayoutBounds2; readonly bounds3: LayoutBounds3 };
};

export type RoomSlot = {
	readonly roomId: string;
	readonly hasValidCeiling: boolean;
	readonly stripped: CompiledRoom | null;
	readonly polygons: readonly CompiledQueryPolygon[];
	readonly aabbs: readonly CompiledQueryAabb[];
	readonly issues: readonly LayoutGeometryIssue[];
	readonly bounds3: LayoutBounds3 | null;
};

export type WallSlot = {
	readonly wallId: string;
	readonly sortedIndex: number;
	readonly baseCompiled: CompiledPhysicalWall | null;
	readonly compiled: CompiledPhysicalWall | null;
	readonly baseBounds2: LayoutBounds2 | null;
	readonly baseBounds3: LayoutBounds3 | null;
	readonly legs: { readonly start?: CompiledJunctionLeg; readonly end?: CompiledJunctionLeg };
	readonly baseRecords: RetainedQueryRecords;
	readonly wallAabb: CompiledQueryAabb | null;
	readonly issues: readonly LayoutGeometryIssue[];
};

export type RetainedCompileWorld = {
	document: LayoutDocumentWallFirst;
	readonly floorId: string;
	readonly floorElevation: number;
	readonly defaultWallThickness: number;
	readonly hydratedWithoutSources: boolean;
	pointById: ReadonlyMap<string, LayoutVec2>;
	junctionById: ReadonlyMap<string, LayoutJunction>;
	readonly junctionDocIndexById: Map<string, number>;
	wallById: ReadonlyMap<string, LayoutWall>;
	readonly wallDocIndexById: Map<string, number>;
	openingById: ReadonlyMap<string, LayoutWallOpening>;
	readonly openingOrderById: Map<string, number>;
	openingsByHostWallId: ReadonlyMap<string, LayoutWallOpening[]>;
	readonly openingIndicesByHostWallId: ReadonlyMap<string, readonly number[]>;
	readonly documentRoomIds: Set<string>;
	readonly roomIndicesByWallId: Map<string, number[]>;
	/** Open-side Junctions can move without touching a Wall; they dirty their Space. */
	readonly roomIndicesByJunctionId: Map<string, number[]>;
	readonly wallIdsByJunctionId: Map<string, string[]>;
	readonly derivedWallRoles: ReadonlyMap<string, LayoutDerivedWallRole>;
	roomSlots: PersistentVector<RoomSlot, ChunkSummary>;
	validCeilingRoomCount: number;
	wallSlots: PersistentVector<WallSlot, ChunkSummary>;
	sortedWalls: PersistentVector<CompiledPhysicalWall>;
	sortedJunctions: PersistentVector<CompiledJunction, ChunkSummary>;
	readonly junctionSortedIndexById: Map<string, number>;
	readonly junctionLegOrderById: Map<string, number>;
	junctionIssuesByOrder: PersistentMap<number, readonly LayoutGeometryIssue[]>;
	objectUnit: CompiledObjectsUnit;
	readonly regionUnit: CompiledRegionUnit;
};
