import type { FloorAndAabbsUnit } from './delta';
import { registerDeferredGeneratedField } from './delta';
import type { Vec3 } from '../kernel/types';
import type { LayoutVec2 } from './coordinates';
import type { LayoutDocumentWallFirst } from '../wall/types';
import type { CompiledCurveSample, CompiledFloor, CompiledOpening, CompiledQueryAabb, CompiledSolidSpan, CompilerFloorSource, LayoutBounds2, LayoutBounds3 } from './types';
import { geometryId } from './types';
import { countWork } from '../kernel/work-observer';
import type { CacheKeyDependency } from './keys';
import { cacheKeyDependency, cacheKeyOf } from './keys';
import type { LayoutCompileReuse, RetainedQueryRecords } from './reuse';
import { sameAuthored } from './reuse';
import type { SampledSegment } from './curve';
import { pointAlongSamples } from './curve';
import type { QueryGeometryBuilder } from './queries';
import { bounds2, polygonBounds2 } from './queries';

/**
 * Query records for one canonical physical Wall — no fake `roomId`.
 *
 * Returns the records instead of pushing them into the shared builder so the
 * incremental compile can retain them with the Wall and splice them back in
 * document order without rebuilding; the shared builder receives exactly those
 * records in the same order.
 */
export function emitPhysicalWallQueryRecords(
	queryBuilder: QueryGeometryBuilder,
	floor: CompilerFloorSource,
	wall: LayoutDocumentWallFirst['walls'][number],
	sampled: SampledSegment,
	openings: readonly CompiledOpening[],
	solidSpans: readonly CompiledSolidSpan[],
	/** Also return the records this Wall contributed (only a session needs them). */
	collect: boolean
): RetainedQueryRecords | null {
	const pointsStart = queryBuilder.points.length;
	const spansStart = queryBuilder.spans.length;
	const aabbsStart = queryBuilder.aabbs.length;
	const wallKey = wall.id;
	queryBuilder.points.push(
		pointRecordPhysical(floor.id, wall.id, 'vertex', wall.id, 0, [...sampled.samples[0]!.point] as LayoutVec2, wallKey),
		pointRecordPhysical(floor.id, wall.id, 'vertex', wall.id, 1, [...sampled.samples.at(-1)!.point] as LayoutVec2, wallKey)
	);
	for (let index = 1; index < sampled.samples.length; index += 1) {
		const start = sampled.samples[index - 1]!;
		const end = sampled.samples[index]!;
		queryBuilder.spans.push(
			spanRecordPhysical(
				'wall',
				['wall-span', floor.id, wall.id, String(index - 1)],
				start.point,
				end.point,
				start.distance,
				end.distance,
				wall.id,
				floor.id,
				wall.id,
				undefined,
				start.t,
				end.t,
				wallKey
			)
		);
	}
	for (const opening of openings) {
		const start = pointAlongSamples(sampled.samples, opening.offset);
		const end = pointAlongSamples(sampled.samples, opening.offset + opening.width);
		queryBuilder.spans.push(
			spanRecordPhysical(
				'opening',
				['opening-span', floor.id, opening.openingId],
				start,
				end,
				opening.offset,
				opening.offset + opening.width,
				opening.openingId,
				floor.id,
				wall.id,
				opening.openingId,
				undefined,
				undefined,
				// Canonical opening spans carry the document-global `wallKey`
				// (`= wallId`) exactly like legacy wall/solid spans; snap/align/hit
				// group by `wallKey ?? segmentId`, never `segmentId` alone.
				wallKey
			)
		);
		queryBuilder.aabbs.push(
			aabb2Record('opening', opening.openingId, ['opening', floor.id, opening.openingId], opening.bounds2)
		);
	}
	for (const [index, span] of solidSpans.entries()) {
		queryBuilder.spans.push(
			spanRecordPhysical(
				'solid',
				['solid-span', floor.id, wall.id, String(index)],
				span.start,
				span.end,
				span.startDistance,
				span.endDistance,
				wall.id,
				floor.id,
				wall.id,
				undefined,
				undefined,
				undefined,
				wallKey
			)
		);
	}
	if (!collect) return null;
	// Only a session retains records; a cold compile pushes into the shared builder
	// and pays no per-Wall allocation at all.
	return {
		points: queryBuilder.points.slice(pointsStart),
		spans: queryBuilder.spans.slice(spansStart),
		polygons: [],
		aabbs: queryBuilder.aabbs.slice(aabbsStart)
	};
}


/** Append one entity's retained query records, preserving their order. */
export function pushRetainedRecords(builder: QueryGeometryBuilder, records: RetainedQueryRecords): void {
	for (const record of records.points) builder.points.push(record);
	for (const record of records.spans) builder.spans.push(record);
	for (const record of records.polygons) builder.polygons.push(record);
	for (const record of records.aabbs) builder.aabbs.push(record);
}


/** A Wall's own extent expanded by its resolved end geometry (plan). */
export function expandBounds2(base: LayoutBounds2, expansion: { min: LayoutVec2; max: LayoutVec2 }): LayoutBounds2 {
	return {
		min: [Math.min(base.min[0], expansion.min[0]), Math.min(base.min[1], expansion.min[1])],
		max: [Math.max(base.max[0], expansion.max[0]), Math.max(base.max[1], expansion.max[1])]
	};
}


/** A Wall's own extent expanded by its resolved end geometry (world). */
export function expandBounds3(
	base: LayoutBounds3,
	expansion: { min: LayoutVec2; max: LayoutVec2 },
	floorElevation: number,
	height: number
): LayoutBounds3 {
	return {
		min: [
			Math.min(base.min[0], expansion.min[0]),
			Math.min(base.min[1], floorElevation),
			Math.min(base.min[2], expansion.min[1])
		],
		max: [
			Math.max(base.max[0], expansion.max[0]),
			Math.max(base.max[1], floorElevation + height),
			Math.max(base.max[2], expansion.max[1])
		]
	};
}


function pointRecordPhysical(
	floorId: string,
	segmentId: string,
	kind: 'vertex' | 'interior-anchor',
	sourceId: string,
	sourceIndex: number,
	point: LayoutVec2,
	wallKey?: string
) {
	const parts = ['query-point', floorId, segmentId, kind, sourceId];
	return {
		id: geometryId(parts),
		cacheKey: cacheKeyOf([...parts, sourceIndex, point]),
		kind,
		point,
		aabb: bounds2(point[0], point[1], point[0], point[1]),
		sourceId,
		floorId,
		segmentId,
		sourceIndex,
		...(wallKey ? { wallKey } : {})
	};
}


function spanRecordPhysical(
	kind: 'wall' | 'opening' | 'solid',
	parts: readonly string[],
	start: LayoutVec2,
	end: LayoutVec2,
	startDistance: number,
	endDistance: number,
	sourceId: string,
	floorId: string,
	segmentId: string,
	openingId?: string,
	startT?: number,
	endT?: number,
	wallKey?: string
) {
	const aabb = bounds2(Math.min(start[0], end[0]), Math.min(start[1], end[1]), Math.max(start[0], end[0]), Math.max(start[1], end[1]));
	return {
		id: geometryId(parts),
		cacheKey: cacheKeyOf([
			...parts,
			start,
			end,
			startDistance,
			endDistance,
			startT,
			endT,
			sourceId,
			floorId,
			segmentId,
			openingId
		]),
		kind,
		start,
		end,
		startDistance,
		endDistance,
		...(startT === undefined ? {} : { startT }),
		...(endT === undefined ? {} : { endT }),
		aabb,
		sourceId,
		floorId,
		segmentId,
		...(openingId ? { openingId } : {}),
		...(wallKey ? { wallKey } : {})
	};
}


export function wallBounds2(samples: readonly CompiledCurveSample[], thickness: number): LayoutBounds2 {
	let minX = Infinity;
	let minZ = Infinity;
	let maxX = -Infinity;
	let maxZ = -Infinity;
	const half = thickness / 2;
	for (const sample of samples) {
		minX = Math.min(minX, sample.point[0] - half);
		minZ = Math.min(minZ, sample.point[1] - half);
		maxX = Math.max(maxX, sample.point[0] + half);
		maxZ = Math.max(maxZ, sample.point[1] + half);
	}
	return bounds2(minX, minZ, maxX, maxZ);
}


export function wallBounds3(samples: readonly CompiledCurveSample[], thickness: number, floorElevation: number, ceilingElevation: number): LayoutBounds3 {
	const bounds2 = wallBounds2(samples, thickness);
	return { min: [bounds2.min[0], floorElevation, bounds2.min[1]], max: [bounds2.max[0], ceilingElevation, bounds2.max[1]] };
}


export function roomBounds2FromWalls(
	walls: readonly { readonly bounds2: LayoutBounds2 }[],
	floorPolygon: readonly LayoutVec2[]
): LayoutBounds2 {
	const floorBounds = polygonBounds2(floorPolygon);
	if (!floorBounds) {
		let minX = Infinity;
		let minZ = Infinity;
		let maxX = -Infinity;
		let maxZ = -Infinity;
		for (const wall of walls) {
			minX = Math.min(minX, wall.bounds2.min[0]);
			minZ = Math.min(minZ, wall.bounds2.min[1]);
			maxX = Math.max(maxX, wall.bounds2.max[0]);
			maxZ = Math.max(maxZ, wall.bounds2.max[1]);
		}
		return bounds2(minX, minZ, maxX, maxZ);
	}
	let minX = floorBounds.min[0];
	let minZ = floorBounds.min[1];
	let maxX = floorBounds.max[0];
	let maxZ = floorBounds.max[1];
	for (const wall of walls) {
		minX = Math.min(minX, wall.bounds2.min[0]);
		minZ = Math.min(minZ, wall.bounds2.min[1]);
		maxX = Math.max(maxX, wall.bounds2.max[0]);
		maxZ = Math.max(maxZ, wall.bounds2.max[1]);
	}
	return bounds2(minX, minZ, maxX, maxZ);
}


export function roomBounds3FromParts(
	floorPolygon: readonly LayoutVec2[],
	ceilingPolygon: readonly LayoutVec2[],
	walls: readonly { readonly bounds3: LayoutBounds3 }[],
	floorElevation: number,
	ceilingElevation: number,

	overhead: 'closed' | 'open-to-sky' = 'closed'
): LayoutBounds3 {
	const min: Vec3 = [Infinity, Infinity, Infinity];
	const max: Vec3 = [-Infinity, -Infinity, -Infinity];
	for (const [x, z] of floorPolygon) includeBounds3(min, max, [x, floorElevation, z]);
	if (overhead === 'closed') for (const [x, z] of ceilingPolygon) {
		includeBounds3(min, max, [x, ceilingElevation, z]);
	}
	for (const wall of walls) includeBounds3(min, max, wall.bounds3.min, wall.bounds3.max);
	return finiteBounds3(min, max) ?? { min: [0, floorElevation, 0], max: [0, ceilingElevation, 0] };
}


export function includeBounds3(min: Vec3, max: Vec3, ...points: readonly Vec3[]): void {
	for (const point of points) {
		min[0] = Math.min(min[0], point[0]);
		min[1] = Math.min(min[1], point[1]);
		min[2] = Math.min(min[2], point[2]);
		max[0] = Math.max(max[0], point[0]);
		max[1] = Math.max(max[1], point[1]);
		max[2] = Math.max(max[2], point[2]);
	}
}


export function finiteBounds3(min: Vec3, max: Vec3): LayoutBounds3 | null {
	if (![...min, ...max].every(Number.isFinite)) return null;
	return { min: [...min] as Vec3, max: [...max] as Vec3 };
}


export function pointRecord(
	floorId: string,
	roomId: string,
	segmentId: string,
	kind: 'vertex' | 'interior-anchor',
	sourceId: string,
	sourceIndex: number,
	point: LayoutVec2,
	wallKey?: string
) {
	const parts = ['query-point', floorId, roomId, segmentId, kind, sourceId];
	return {
		id: geometryId(parts),
		cacheKey: cacheKeyOf([...parts, sourceIndex, point]),
		kind,
		point,
		aabb: bounds2(point[0], point[1], point[0], point[1]),
		sourceId,
		floorId,
		roomId,
		segmentId,
		sourceIndex,
		...(wallKey ? { wallKey } : {})
	};
}


export function spanRecord(
	kind: 'wall' | 'opening' | 'solid',
	parts: readonly string[],
	start: LayoutVec2,
	end: LayoutVec2,
	startDistance: number,
	endDistance: number,
	sourceId: string,
	floorId: string,
	roomId: string,
	segmentId: string,
	openingId?: string,
	startT?: number,
	endT?: number,
	wallKey?: string
) {
	const aabb = bounds2(Math.min(start[0], end[0]), Math.min(start[1], end[1]), Math.max(start[0], end[0]), Math.max(start[1], end[1]));
	// `wallKey` derives from parts already in the cache key (floor/room/
	// segment), so it deliberately does not participate in the cache key:
	// its presence never changes a cache key.
	return {
		id: geometryId(parts),
		cacheKey: cacheKeyOf([
			...parts,
			start,
			end,
			startDistance,
			endDistance,
			startT,
			endT,
			sourceId,
			floorId,
			roomId,
			segmentId,
			openingId
		]),
		kind,
		start,
		end,
		startDistance,
		endDistance,
		...(startT === undefined ? {} : { startT }),
		...(endT === undefined ? {} : { endT }),
		aabb,
		sourceId,
		floorId,
		roomId,
		segmentId,
		...(openingId ? { openingId } : {}),
		...(wallKey ? { wallKey } : {})
	};
}


export function polygonRecord(
	kind: 'room-floor' | 'object-footprint',
	parts: readonly string[],
	polygon: readonly LayoutVec2[],
	sourceId: string,
	metadata: { floorId?: string; roomId?: string; objectId?: string }
) {
	const aabb = polygonBounds2(polygon) ?? bounds2(0, 0, 0, 0);
	return {
		id: geometryId(parts),
		cacheKey: cacheKeyOf([...parts, polygon]),
		kind,
		polygon: [...polygon] as LayoutVec2[],
		aabb,
		sourceId,
		...metadata
	};
}


export function aabbRecord(kind: CompiledQueryAabb['kind'], sourceId: string, parts: readonly string[], min: Vec3, max: Vec3): CompiledQueryAabb {
	return aabb2Record(kind, sourceId, parts, bounds2(min[0], min[2], max[0], max[2]));
}


export function aabb2Record(kind: CompiledQueryAabb['kind'], sourceId: string, parts: readonly string[], aabb: LayoutBounds2): CompiledQueryAabb {
	return {
		id: geometryId(parts),
		cacheKey: cacheKeyOf([...parts, aabb.min, aabb.max]),
		kind,
		aabb,
		sourceId
	};
}


export function emitBoundsAabb(
	queryBuilder: QueryGeometryBuilder,
	kind: CompiledQueryAabb['kind'],
	sourceId: string,
	parts: readonly string[],
	min: Vec3,
	max: Vec3
): void {
	if (![...min, ...max].every(Number.isFinite)) return;
	queryBuilder.aabbs.push(aabbRecord(kind, sourceId, parts, min, max));
}


export function buildWallFirstFloorAndAggregateAabbs(
	floor: LayoutDocumentWallFirst['floor'],
	floorRoomIds: readonly string[],
	floorBounds: LayoutBounds3 | null,
	documentBounds: LayoutBounds3 | null,
	reuse?: LayoutCompileReuse
): FloorAndAabbsUnit {
	const retainedFloor = reuse?.retainedFloor ?? null;
	const sameRoomIds =
		retainedFloor !== null &&
		(retainedFloor.roomIds === floorRoomIds || (retainedFloor.roomIds.length === floorRoomIds.length &&
		retainedFloor.roomIds.every((id, index) => id === floorRoomIds[index])));
	const roomIdsDep: CacheKeyDependency =
		sameRoomIds && retainedFloor !== null
			? retainedFloor.roomIdsDep
			: cacheKeyDependency(cacheKeyOf(['floor-room-ids', floorRoomIds]));

	let compiledFloor: CompiledFloor;
	let floorAabb: CompiledQueryAabb | null;
	if (
		retainedFloor !== null &&
		sameRoomIds &&
		retainedFloor.floorId === floor.id &&
		retainedFloor.elevation === floor.elevation &&
		sameAuthored(retainedFloor.bounds3, floorBounds)
	) {
		compiledFloor = retainedFloor.compiled;
		floorAabb = retainedFloor.aabb;
	} else {
		const keyBounds = floorBounds ? { min: [...floorBounds.min], max: [...floorBounds.max] } : null;
		const keyInputs = ['floor', floor.id, floor.elevation, roomIdsDep, keyBounds] as const;
		let floorKey: string | undefined;
		compiledFloor = {
			id: geometryId(['floor', floor.id]),
			get cacheKey() {
				if (floorKey === undefined) { countWork('cache-key:deferred-floor-built'); floorKey = cacheKeyOf(keyInputs); }
				return floorKey;
			},
			floorId: floor.id,
			elevation: floor.elevation,
			roomIds: floorRoomIds,
			bounds3: floorBounds
		};
		registerDeferredGeneratedField(compiledFloor, 'cacheKey');
		floorAabb = floorBounds
			? aabbRecord('floor', floor.id, ['floor', floor.id], floorBounds.min, floorBounds.max)
			: null;
		if (reuse) {
			reuse.retainedFloor = {
				floorId: floor.id,
				elevation: floor.elevation,
				roomIds: compiledFloor.roomIds,
				roomIdsDep,
				bounds3: floorBounds,
				compiled: compiledFloor,
				aabb: floorAabb
			};
		}
	}

	let docAabb: CompiledQueryAabb | null;
	const retainedDoc = reuse?.retainedDocAabb ?? null;
	if (retainedDoc !== null && sameAuthored(retainedDoc.bounds3, documentBounds)) {
		docAabb = retainedDoc.aabb;
	} else {
		docAabb = documentBounds
			? aabbRecord('document', 'document', ['document'], documentBounds.min, documentBounds.max)
			: null;
		if (reuse) {
			reuse.retainedDocAabb = { bounds3: documentBounds, aabb: docAabb };
		}
	}

	return { floor: compiledFloor, floorAabb, docAabb };
}
