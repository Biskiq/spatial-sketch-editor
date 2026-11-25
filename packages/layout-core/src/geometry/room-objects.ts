import type { WallSamplingDerivation } from '../wall/centerline';
import type { LayoutVec2 } from './coordinates';
import type { LayoutJunction } from '../wall/types';
import type { LayoutObject } from '../wall/types';
import type { LayoutWall } from '../wall/types';
import type { LayoutWallOpening } from '../wall/types';
import type { CompiledLayoutObject, CompiledWall, CompilerBoundarySource, CompilerFloorSource, LayoutBounds3, LayoutGeometryIssue } from './types';
import type { LayoutCompileReuse } from './reuse';
import { sameAuthored } from './reuse';
import type { SampleableSegment, SampledSegment } from './curve';
import { pointAlongSamples, segmentVertexPoints } from './curve';
import { describeLayoutObject } from './objects';
import type { QueryGeometryBuilder } from './queries';
import { createQueryGeometryBuilder } from './queries';
import { aabb2Record, aabbRecord, pointRecord, polygonRecord, pushRetainedRecords, spanRecord } from './query-records';

/** Maps a Room source is assembled from; one shape serves full and delta compiles. */
export type WallFirstRoomSourceMaps = {
	readonly junctionById: ReadonlyMap<string, LayoutJunction>;
	readonly pointById: ReadonlyMap<string, LayoutVec2>;
	readonly wallById: ReadonlyMap<string, LayoutWall>;
	readonly openingsByHostWallId: ReadonlyMap<string, readonly LayoutWallOpening[]>;
	readonly openingOrderById: ReadonlyMap<string, number>;
	readonly wallThicknessBySegmentId: Readonly<Record<string, number>>;
	readonly openingHeightLimitBySegmentId: Readonly<Record<string, number>>;
	readonly defaultWallThickness: number;
	readonly sampling?: WallSamplingDerivation;
	readonly preSampled?: Map<SampleableSegment, SampledSegment>;
};



/** Stable, non-Wall segment id for one stated open side. */
export function virtualBoundarySegmentId(roomId: string, index: number): string {
	return `#virtual:${roomId}:${index}`;
}



export function compileObjects(
	objects: readonly LayoutObject[],
	issues: LayoutGeometryIssue[],
	queryBuilder: QueryGeometryBuilder,
	reuse?: LayoutCompileReuse
): CompiledLayoutObject[] {
	const compiled: CompiledLayoutObject[] = [];
	for (const [index, object] of objects.entries()) {
		// The authored object plus its position in the array (the issue path names
		// the index) are the whole input of `describeLayoutObject`.
		const authored = [object, index];
		const retained = reuse?.objects.get(object.id);
		if (reuse) reuse.counters.signatureVisits += 1;
		if (reuse && retained && sameAuthored(retained.authored, authored)) {
			reuse.counters.objectsReused += 1;
			for (const issue of retained.issues) issues.push(issue);
			pushRetainedRecords(queryBuilder, retained.records);
			if (retained.descriptor) compiled.push(retained.descriptor);
			continue;
		}
		if (reuse) reuse.counters.objectsEvaluated += 1;
		const objectIssues: LayoutGeometryIssue[] = [];
		const records = createQueryGeometryBuilder();
		let descriptor: CompiledLayoutObject | null = null;
		if (!isValidObject(object)) {
			objectIssues.push({
				path: `objects[${index}]`,
				code: 'object_invalid',
				message: 'Layout object position and rotation must be finite and dimensions must be finite and greater than zero.',
				targetId: object.id
			});
		} else {
			descriptor = describeLayoutObject(object);
			records.polygons.push(
				polygonRecord(
					'object-footprint',
					['object-footprint', object.id],
					descriptor.planFootprint,
					object.id,
					{ objectId: object.id }
				)
			);
			records.aabbs.push(aabbRecord('object', object.id, ['object', object.id], descriptor.worldAabb.min, descriptor.worldAabb.max));
		}
		for (const issue of objectIssues) issues.push(issue);
		pushRetainedRecords(queryBuilder, records);
		if (descriptor) compiled.push(descriptor);
		if (reuse) reuse.objects.set(object.id, { authored, descriptor, records, issues: objectIssues });
	}
	return compiled;
}



function isValidObject(object: LayoutObject): boolean {
	const vectors = [object.position, object.rotation, object.dimensions];
	if (vectors.some((vector) => !vector.every((value) => Number.isFinite(value)))) return false;
	return object.dimensions.every((value) => value > 0);
}



export function emitRoomQueryRecords(
	queryBuilder: QueryGeometryBuilder,
	floor: CompilerFloorSource,
	room: { id: string; boundary: CompilerBoundarySource },
	walls: readonly CompiledWall[],
	floorPolygon: readonly LayoutVec2[],
	roomBounds3: LayoutBounds3,
	recordMode: 'room' | 'physical-wall'
): void {
	const roomIdParts = ['room', floor.id, room.id];

	// `physical-wall` callers keep only the Room floor polygon and Room AABB
	// below; their Wall, Opening, solid and vertex records come from the
	// canonical physical-Wall set. Building the room-derived ones would be work
	// with no consumer, so it is not done.
	if (recordMode === 'physical-wall') {
		queryBuilder.polygons.push(
			polygonRecord(
				'room-floor',
				['room-floor', floor.id, room.id],
				[...floorPolygon],
				room.id,
				{ floorId: floor.id, roomId: room.id }
			)
		);
		queryBuilder.aabbs.push(aabbRecord('room', room.id, roomIdParts, roomBounds3.min, roomBounds3.max));
		return;
	}

	for (const [segmentIndex, segment] of room.boundary.segments.entries()) {
		queryBuilder.points.push(
			pointRecord(
				floor.id,
				room.id,
				segment.id,
				'vertex',
				segment.id,
				segmentIndex,
				[...segmentVertexPoints(segment)[0]!] as LayoutVec2,
				segment.id
			)
		);
		if (segment.kind === 'auto-bezier') {
			for (const [anchorIndex, anchor] of segment.interiorAnchors.entries()) {
				queryBuilder.points.push(
					pointRecord(
						floor.id,
						room.id,
						segment.id,
						'interior-anchor',
						anchor.id,
						anchorIndex,
						[...anchor.point] as LayoutVec2,
						segment.id
					)
				);
			}
		}
	}

	for (const wall of walls) {
		for (let index = 1; index < wall.samples.length; index += 1) {
			const start = wall.samples[index - 1]!;
			const end = wall.samples[index]!;
			queryBuilder.spans.push(
				spanRecord(
					'wall',
					['wall-span', floor.id, room.id, wall.segmentId, String(index - 1)],
					start.point,
					end.point,
					start.distance,
					end.distance,
					wall.segmentId,
					floor.id,
					room.id,
					wall.segmentId,
					undefined,
					start.t,
					end.t,
					wall.segmentId
				)
			);
		}
		for (const opening of wall.openings) {
			const start = pointAlongSamples(wall.samples, opening.offset);
			const end = pointAlongSamples(wall.samples, opening.offset + opening.width);
			queryBuilder.spans.push(
				spanRecord(
					'opening',
					['opening-span', floor.id, room.id, opening.openingId],
					start,
					end,
					opening.offset,
					opening.offset + opening.width,
					opening.openingId,
					floor.id,
					room.id,
					wall.segmentId,
					opening.openingId,
					undefined,
					undefined,
					wall.segmentId
				)
			);
		}
		for (const [index, span] of wall.solidSpans.entries()) {
			queryBuilder.spans.push(
				spanRecord(
					'solid',
					['solid-span', floor.id, room.id, wall.segmentId, String(index)],
					span.start,
					span.end,
					span.startDistance,
					span.endDistance,
					wall.segmentId,
					floor.id,
					room.id,
					wall.segmentId
				)
			);
		}
		queryBuilder.aabbs.push(aabbRecord('wall', wall.segmentId, ['wall', floor.id, room.id, wall.segmentId], wall.bounds3.min, wall.bounds3.max));
		for (const opening of wall.openings) {
			queryBuilder.aabbs.push(aabb2Record('opening', opening.openingId, ['opening', floor.id, room.id, opening.openingId], opening.bounds2));
		}
	}

	queryBuilder.polygons.push(
		polygonRecord(
			'room-floor',
			['room-floor', floor.id, room.id],
			[...floorPolygon],
			room.id,
			{ floorId: floor.id, roomId: room.id }
		)
	);
	queryBuilder.aabbs.push(aabbRecord('room', room.id, roomIdParts, roomBounds3.min, roomBounds3.max));
}
