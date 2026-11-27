import { wallCenterlineSamples, wallCenterlineSegment } from '../wall/centerline';
import type { LayoutVec2 } from './coordinates';
import type { LayoutDocumentWallFirst } from '../wall/types';
import type { LayoutWall } from '../wall/types';
import type { LayoutWallFirstRoom } from '../wall/types';
import {
	composeSpaceBoundary,
	spaceBoundaryPolygonFromEdges,
} from '../room/reconciliation-boundary';
import {
	spaceOutlineSelfIntersects,
	spaceOutlineSignedArea,
	spacePlacementIssues,
} from '../room/space-placement';
import type {
	CompiledCurveSample,
	CompiledOpening,
	CompiledRoom,
	CompiledSolidSpan,
	CompiledSpaceEdge,
	CompiledWall,
	CompiledWallSection,
	CompilerBoundarySource,
	CompilerFloorSource,
	CompilerOpening,
	CompilerOpeningHeightLimit,
	CompilerRoomSource,
	LayoutBounds2,
	LayoutBounds3,
	LayoutGeometryIssue,
} from './types';
import { geometryId } from './types';
import { countWork } from '../kernel/work-observer';
import type { CacheKeyDependency } from './keys';
import { cacheKeyDependency, cacheKeyOf } from './keys';
import type { SampleableSegment, SampledSegment } from './curve';
import { openingCenterFrame, openingCenterPolyline, pointAlongSamples } from './curve';
import {
	LAYOUT_GEOMETRY_EPSILON,
	archProfileTopAt,
	buildArchProfile,
	splitSampledWallAroundOpenings,
	wallPolylinesAroundOpenings,
} from './openings';
import type { QueryGeometryBuilder } from './queries';
import { bounds2, polygonBounds2 } from './queries';
import {
	roomBounds2FromWalls,
	roomBounds3FromParts,
	wallBounds2,
	wallBounds3,
} from './query-records';
import type { WallFirstRoomSourceMaps } from './room-objects';
import { emitRoomQueryRecords, virtualBoundarySegmentId } from './room-objects';

/**
 * Assemble one Room's compiler source from its **composed** boundary.
 *
 * Wall edges keep their authored Wall id as the segment id, so every compiled
 * Wall record, Opening join and Wall query record is unchanged. Virtual edges
 * become plain line segments with a reserved id, marked in
 * `virtualSegmentIds`, so the shared core can keep them in the outline and
 * floor polygon while excluding them from `walls`, Wall bounds and Openings.
 */
export function buildWallFirstRoomSource(
	document: LayoutDocumentWallFirst,
	room: LayoutWallFirstRoom,
	maps: WallFirstRoomSourceMaps,
): { source: CompilerRoomSource } | { issue: LayoutGeometryIssue } {
	const composed = composeSpaceBoundary(document, room, {
		junctionById: maps.junctionById,
		wallById: maps.wallById,
	});
	if (composed.kind === 'failed') {
		return {
			issue: {
				path: `rooms.${room.id}.${composed.issue.code === 'space_virtual_edge_unconsumed' || composed.issue.code === 'duplicate_virtual_edge_origin' ? 'virtualEdges' : 'boundary'}`,
				code: composed.issue.code,
				message: composed.issue.message,
				targetId: room.id,
			},
		};
	}

	const segments: SampleableSegment[] = [];
	const virtualSegmentIds: string[] = [];
	const roomOpenings: CompilerOpening[] = [];
	// Reverse-ref Opening offsets mirror by the **sampled arc length** of the
	// host Wall's canonical centerline, never the Euclidean chord.
	const arcLengthByWallId = new Map<string, number>();
	const traversalByWallId = new Map<string, 'forward' | 'reverse'>();
	for (const edge of composed.edges) {
		if (edge.kind === 'virtual') {
			const start = maps.pointById.get(edge.startJunctionId);
			const end = maps.pointById.get(edge.endJunctionId);
			if (!start || !end) continue; // reference integrity is the codec's job
			const id = virtualBoundarySegmentId(room.id, edge.index);
			segments.push({
				id,
				kind: 'line',
				start: [...start] as LayoutVec2,
				end: [...end] as LayoutVec2,
			});
			virtualSegmentIds.push(id);
			continue;
		}
		const wall = maps.wallById.get(edge.wallId);
		if (!wall) continue; // reference integrity is the codec's job
		const start = maps.pointById.get(wall.startJunctionId);
		const end = maps.pointById.get(wall.endJunctionId);
		if (!start || !end) continue;
		const reversed = edge.direction === 'reverse';
		const segment = wallCenterlineSegment(wall, start, end, reversed ? 'reverse' : 'forward');
		segments.push(segment);
		if (maps.sampling) {
			const pre = maps.sampling.samples(wall, start, end, reversed ? 'reverse' : 'forward');
			if (pre) maps.preSampled?.set(segment, pre);
		}
		if (!arcLengthByWallId.has(wall.id)) {
			const sampled = maps.sampling
				? maps.sampling.samples(wall, start, end, 'forward')
				: wallCenterlineSamples(wall, start, end, 'forward');
			if (sampled) arcLengthByWallId.set(wall.id, sampled.length);
			traversalByWallId.set(wall.id, reversed ? 'reverse' : 'forward');
		}
	}
	// The Opening join visits exactly this Room's own boundary Walls.
	for (const ref of room.boundary) {
		const hosted = maps.openingsByHostWallId.get(ref.wallId);
		const traversal = traversalByWallId.get(ref.wallId);
		if (!hosted || traversal === undefined) continue;
		countWork('pairs:room-opening', hosted.length);
		if (traversal === 'forward') {
			for (const opening of hosted) roomOpenings.push({ ...opening, segmentId: opening.wallId });
			continue;
		}
		const length = arcLengthByWallId.get(ref.wallId);
		if (length === undefined) continue;
		for (const opening of hosted) {
			roomOpenings.push({
				...opening,
				segmentId: opening.wallId,
				offset: length - (opening.offset + opening.width),
			});
		}
	}
	roomOpenings.sort(
		(left, right) =>
			(maps.openingOrderById.get(left.id) ?? Number.MAX_SAFE_INTEGER) -
			(maps.openingOrderById.get(right.id) ?? Number.MAX_SAFE_INTEGER),
	);

	// A profiled Wall's Opening limit is its top over the Opening's own interval,
	// which depends on this Room's traversal direction; level Walls keep the
	// shared scalar record untouched.
	let openingHeightLimits: Readonly<Record<string, CompilerOpeningHeightLimit>> =
		maps.openingHeightLimitBySegmentId;
	for (const ref of room.boundary) {
		const wall = maps.wallById.get(ref.wallId);
		if (!wall || wall.top.kind === 'level') continue;
		if (openingHeightLimits === maps.openingHeightLimitBySegmentId) {
			openingHeightLimits = { ...maps.openingHeightLimitBySegmentId };
		}
		(openingHeightLimits as Record<string, CompilerOpeningHeightLimit>)[wall.id] = {
			height: wall.height,
			top: wall.top,
			reversed: ref.direction === 'reverse',
		};
	}

	const heights: number[] = [];
	let resolved = room.boundary.length > 0;
	for (const ref of room.boundary) {
		const wall = maps.wallById.get(ref.wallId);
		if (!wall || !Number.isFinite(wall.height)) {
			resolved = false;
			break;
		}
		heights.push(wall.height);
	}
	const derivedCeiling =
		resolved && heights.length > 0 ? document.floor.elevation + Math.max(...heights) : undefined;

	return {
		source: {
			room: {
				id: room.id,
				wallThickness: maps.defaultWallThickness,

				overhead: room.overhead,
			},
			boundary: { closed: true, segments },
			openings: roomOpenings,
			...(virtualSegmentIds.length > 0 ? { virtualSegmentIds } : {}),
			...(maps.sampling && maps.preSampled ? { preSampled: maps.preSampled } : {}),
			wallThicknessBySegmentId: maps.wallThicknessBySegmentId,
			openingHeightLimitBySegmentId: openingHeightLimits,
			...(derivedCeiling !== undefined ? { ceilingElevation: derivedCeiling } : {}),
		},
	};
}

/** True when an enclosed Room's Wall references already form one closed chain. */
function closedRoomBoundaryChains(
	room: Pick<LayoutWallFirstRoom, 'boundary'>,
	wallById: ReadonlyMap<string, LayoutWall>,
): boolean {
	if (room.boundary.length < 2) return false;
	let firstStart: string | undefined;
	let previousEnd: string | undefined;
	for (const ref of room.boundary) {
		const wall = wallById.get(ref.wallId);
		if (!wall) return false;
		const start = ref.direction === 'forward' ? wall.startJunctionId : wall.endJunctionId;
		const end = ref.direction === 'forward' ? wall.endJunctionId : wall.startJunctionId;
		if (firstStart === undefined) firstStart = start;
		if (previousEnd !== undefined && previousEnd !== start) return false;
		previousEnd = end;
	}
	return previousEnd === firstStart;
}

/**
 * Blocking Space checks that run before the shared core: the composed outline
 * must be positive, simple, and free of I7 conflicts. A failing Room compiles
 * nothing, so an invalid Space never acquires a floor or a lid.
 */
export function spacePreflight(document: LayoutDocumentWallFirst): {
	issues: LayoutGeometryIssue[];
	invalidRoomIds: Set<string>;
} {
	const issues: LayoutGeometryIssue[] = [];
	const invalidRoomIds = new Set<string>();
	const wallById = new Map(document.walls.map((wall) => [wall.id, wall]));
	document.rooms.forEach((room, index) => {
		const path = `floors[0].rooms[${index}]`;
		// A structurally closed Room keeps the shared core's established
		// Wall-chain validation and never enters the Space composer. A closed
		// boundary that does not chain still falls through so the composer's
		// existing missing-reference/empty-boundary diagnoses are preserved.
		if (room.virtualEdges.length === 0 && closedRoomBoundaryChains(room, wallById)) return;
		const composed = composeSpaceBoundary(document, room);
		if (composed.kind === 'failed') {
			// The codec names the specific composition failure. The compiler keeps
			// its long-standing `disconnected_boundary` code for a boundary that
			// does not chain, so callers that compile authored-but-unvalidated
			// documents see the same compiler issue as before the Space format.
			const code =
				composed.issue.code === 'space_boundary_open'
					? 'disconnected_boundary'
					: composed.issue.code;
			issues.push({
				path: `${path}.${code === 'space_virtual_edge_unconsumed' || code === 'duplicate_virtual_edge_origin' ? 'virtualEdges' : 'boundary'}`,
				code,
				message: composed.issue.message,
				targetId: room.id,
			});
			invalidRoomIds.add(room.id);
			return;
		}
		if (room.virtualEdges.length === 0) return;
		const polygon = spaceBoundaryPolygonFromEdges(composed.edges, document);
		if (!polygon || spaceOutlineSignedArea(polygon) <= LAYOUT_GEOMETRY_EPSILON) {
			issues.push({
				path: `${path}.boundary`,
				code: 'space_outline_not_positive',
				message: `Space '${room.name}' must enclose positive area in the face orientation`,
				targetId: room.id,
			});
			invalidRoomIds.add(room.id);
			return;
		}
		if (spaceOutlineSelfIntersects(polygon)) {
			issues.push({
				path: `${path}.boundary`,
				code: 'space_outline_self_intersects',
				message: `Space '${room.name}' has an outline that crosses itself`,
				targetId: room.id,
			});
			invalidRoomIds.add(room.id);
			return;
		}
		for (const [edgeIndex, edge] of room.virtualEdges.entries()) {
			const start = document.junctions.find(
				(junction) => junction.id === edge.startJunctionId,
			)?.point;
			const end = document.junctions.find((junction) => junction.id === edge.endJunctionId)?.point;
			if (!start || !end) continue;
			if (Math.hypot(end[0] - start[0], end[1] - start[1]) <= LAYOUT_GEOMETRY_EPSILON) {
				issues.push({
					path: `${path}.virtualEdges[${edgeIndex}]`,
					code: 'space_virtual_edge_degenerate',
					message: `Space '${room.name}' has an open side with no length`,
					targetId: room.id,
				});
				invalidRoomIds.add(room.id);
				return;
			}
		}
	});
	for (const placement of spacePlacementIssues(document)) {
		issues.push({
			path: `rooms.${placement.roomIds[0]}`,
			code: placement.code,
			message: placement.message,
			targetId: placement.roomIds[0],
		});
		invalidRoomIds.add(placement.roomIds[0]);
		invalidRoomIds.add(placement.roomIds[1]);
	}
	return { issues, invalidRoomIds };
}

/**
 * Group authored Openings by hosting Wall id, preserving document order inside
 * each group. D.1: one grouping replaces the Room × Opening and
 * Wall × Opening scans (`find` / `filter` per Room and per Wall).
 */
export function openingsGroupedByWallId<TOpening extends { readonly wallId: string }>(
	openings: readonly TOpening[],
): Map<string, TOpening[]> {
	const byWallId = new Map<string, TOpening[]>();
	for (const opening of openings) {
		const list = byWallId.get(opening.wallId);
		if (list) list.push(opening);
		else byWallId.set(opening.wallId, [opening]);
	}
	return byWallId;
}

export function compileRoom(
	roomSource: CompilerRoomSource,
	floor: CompilerFloorSource,
	sampledSegments: SampledSegment[],
	queryBuilder: QueryGeometryBuilder,
	recordMode: 'room' | 'physical-wall',
): CompiledRoom {
	const room = roomSource.room;
	const floorElevation = floor.elevation;
	const overhead = room.overhead ?? 'closed';
	const virtualSegmentIds = new Set(roomSource.virtualSegmentIds ?? []);
	// The stated open sides keep their own compiled reading: an editor surface
	// draws them as dashed ink, while the visitor never receives them as geometry.
	const openSides: CompiledSpaceEdge[] = roomSource.boundary.segments.flatMap((segment) =>
		segment.kind === 'line' && virtualSegmentIds.has(segment.id)
			? [
					{
						start: [...segment.start] as LayoutVec2,
						end: [...segment.end] as LayoutVec2,
					},
				]
			: [],
	);
	// Physical Wall segments only: a stated open side contributes to the
	// outline, floor polygon and area, never to compiled Walls, Wall bounds,
	// Openings or Wall query records.
	const physicalBoundary: CompilerBoundarySource = {
		closed: roomSource.boundary.closed,
		segments: roomSource.boundary.segments.filter((segment) => !virtualSegmentIds.has(segment.id)),
	};
	// A wall-first Room carries its derived ceiling (`floor.elevation +
	// max(boundary Wall heights)`); a source that supplies no derived ceiling
	// keeps the storey-derived one, and no format-6 source supplies a storey
	// height, so a wall-first Room always takes the derived value here.
	const ceilingElevation = roomSource.ceilingElevation ?? floor.elevation + (floor.height ?? 0);
	// Vertical extent handed to the shared Opening-splitting helper: absent a
	// derived ceiling it equals `floor.height` exactly.
	const roomVerticalExtent = ceilingElevation - floorElevation;

	const floorPolygon: LayoutVec2[] = roomSource.boundary.segments.flatMap((segment, index) => {
		const samples = sampledSegments[index]!.samples;
		if (segment.kind === 'line') return [[...segment.start] as LayoutVec2];
		return samples.slice(0, -1).map((sample) => [...sample.point] as LayoutVec2);
	});
	// `open-to-sky` removes the generated lid and nothing else: the ceiling
	// elevation and Wall records stay, and the lid ring is empty so no consumer
	// can draw or lift it.
	const ceilingPolygon =
		overhead === 'open-to-sky' ? [] : floorPolygon.map(([x, z]) => [x, z] as LayoutVec2);

	let walls: CompiledWall[] = [];
	let roomOpenings: CompiledOpening[] = [];
	let wallBoundsOnly: Array<{ bounds2: LayoutBounds2; bounds3: LayoutBounds3 }>;

	if (recordMode === 'physical-wall') {
		// `physical-wall` strips room-derived `walls` and `openings` in favor of
		// the canonical physical-Wall collection; only segment bounds feed the
		// Room's `bounds2` and `bounds3`.
		wallBoundsOnly = physicalBoundary.segments.map((segment) => {
			const index = roomSource.boundary.segments.indexOf(segment);
			const sampled = sampledSegments[index]!;
			const wallThickness = roomSource.wallThicknessBySegmentId?.[segment.id] ?? room.wallThickness;
			return {
				bounds2: wallBounds2(sampled.samples, wallThickness),
				bounds3: wallBounds3(sampled.samples, wallThickness, floorElevation, ceilingElevation),
			};
		});
	} else {
		const openingsBySegment = new Map<string, CompilerOpening[]>();
		for (const opening of roomSource.openings) {
			const openings = openingsBySegment.get(opening.segmentId) ?? [];
			openings.push(opening);
			openingsBySegment.set(opening.segmentId, openings);
		}

		walls = physicalBoundary.segments.map((segment) => {
			const index = roomSource.boundary.segments.indexOf(segment);
			const sampled = sampledSegments[index]!;
			const openings = openingsBySegment.get(segment.id) ?? [];
			// Wall thickness is Wall-owned in the wall-first schema. The
			// per-wall override keeps every downstream record identical in shape;
			// only the thickness value may differ per wall. Cache keys remain
			// structural (`thickness` participates where it always did).
			const wallThickness = roomSource.wallThicknessBySegmentId?.[segment.id] ?? room.wallThickness;
			// The segment's dependency key is built once and
			// embedded by reference in this Wall's key and in every hosted Opening's
			// key, instead of being re-serialized and re-escaped at each level.
			const segmentDependency = cacheKeyDependency(
				cacheKeyOf(['segment-geometry', floor.id, room.id, segment]),
			);
			const sections = splitSampledWallAroundOpenings(
				sampled,
				segment,
				openings,
				roomVerticalExtent,
			);
			const compiledOpenings = openings.map((opening) =>
				compileOpening(opening, sampled, floor.id, room.id, segmentDependency),
			);
			const solidSpans = buildSolidSpans(sampled.samples, sections);
			const solidCenterlinePolylines = wallPolylinesAroundOpenings(sampled.samples, openings);
			const wallBounds2Value = wallBounds2(sampled.samples, wallThickness);
			const wallBounds3Value = wallBounds3(
				sampled.samples,
				wallThickness,
				floorElevation,
				ceilingElevation,
			);
			return {
				id: geometryId(['wall', floor.id, room.id, segment.id]),
				cacheKey: cacheKeyOf([
					'wall',
					segmentDependency,
					openings,
					wallThickness,
					floor.elevation,
					floor.height ?? roomSource.ceilingElevation,
				]),
				segmentId: segment.id,
				thickness: wallThickness,
				length: sampled.length,
				samples: sampled.samples,
				sections,
				solidSpans,
				openings: compiledOpenings,
				solidCenterlinePolylines,
				bounds2: wallBounds2Value,
				bounds3: wallBounds3Value,
			};
		});

		roomOpenings = walls.flatMap((wall) => wall.openings);
		wallBoundsOnly = walls;
	}

	const roomBounds2 = roomBounds2FromWalls(wallBoundsOnly, floorPolygon);
	const roomBounds3 = roomBounds3FromParts(
		floorPolygon,
		ceilingPolygon,
		wallBoundsOnly,
		floorElevation,
		ceilingElevation,

		overhead,
	);

	emitRoomQueryRecords(
		queryBuilder,
		floor,
		{ id: room.id, boundary: physicalBoundary },
		walls,
		floorPolygon,
		roomBounds3,
		recordMode,
	);

	return {
		id: geometryId(['room', floor.id, room.id]),
		cacheKey: cacheKeyOf([
			'room',
			floor.id,
			floor.elevation,
			floor.height ?? roomSource.ceilingElevation,
			room.id,
			roomSource.boundary,
			room.wallThickness,

			// A closed lid is format 8's default and stays out of the key, so an
			// enclosed Space's cache key is byte-identical to format 7's.
			...(overhead === 'open-to-sky' ? ['open-to-sky'] : []),
			roomSource.openings,
			// Only the thicknesses this Room's own segments
			// read. Embedding the whole-document per-Wall thickness map in every
			// Room key would make one key O(document walls) and a compile
			// O(rooms × walls) characters (at grid-L, 12.8 M of 97 M key
			// characters from 196 Room keys). The pairs are ordered by
			// boundary, so the key stays a deterministic function of the Room's own
			// inputs (equal iff equal).
			...(roomSource.wallThicknessBySegmentId
				? [
						roomSource.boundary.segments.map(
							(segment) =>
								[segment.id, roomSource.wallThicknessBySegmentId?.[segment.id] ?? null] as const,
						),
					]
				: []),
		]),
		roomId: room.id,
		overhead,
		...(openSides.length === 0 ? {} : { openSides }),
		floorElevation,
		ceilingElevation,

		wallThickness: room.wallThickness,
		floorPolygon,
		ceilingPolygon,
		walls,
		openings: roomOpenings,
		bounds2: roomBounds2,
		bounds3: roomBounds3,
	};
}

export function compileOpening(
	opening: CompilerOpening,
	sampled: SampledSegment,
	floorId: string,
	roomId: string,
	segmentDependency: CacheKeyDependency,
): CompiledOpening {
	// The centre frame and Plan polyline are the shared builders in
	// `layout-geometry-curve.ts`; a closed Wall is periodic there.
	const frame = openingCenterFrame(sampled, opening.offset, opening.width);
	const { point, tangent, closedHost } = frame;
	const centerDistance = frame.distance;
	const profileShape =
		opening.profile === 'rectangular'
			? undefined
			: (buildArchProfile(opening.profile, opening.width, opening.height).profile ?? undefined);
	const centerPolyline = openingCenterPolyline(
		sampled,
		opening.offset,
		opening.offset + opening.width,
		closedHost,
	);
	return {
		id: geometryId(['opening', floorId, roomId, opening.id]),
		cacheKey: cacheKeyOf(['opening', segmentDependency, opening]),
		openingId: opening.id,
		segmentId: opening.segmentId,
		kind: opening.kind,
		offset: opening.offset,
		width: opening.width,
		height: opening.height,
		sillHeight: opening.sillHeight,
		profile: opening.profile,
		...(profileShape ? { profileShape } : {}),
		center: {
			openingId: opening.id,
			point,
			distance: centerDistance,
			tangent,
			normal: [-tangent[1], tangent[0]],
			yaw: frame.yaw,
		},
		centerPolyline,
		bounds2: polygonBounds2(centerPolyline) ?? bounds2(point[0], point[1], point[0], point[1]),
		...(opening.connectsRoomIds ? { connectsRoomIds: opening.connectsRoomIds } : {}),
	};
}

export function buildSolidSpans(
	samples: readonly CompiledCurveSample[],
	sections: readonly CompiledWallSection[],
): CompiledSolidSpan[] {
	const spans: CompiledSolidSpan[] = [];
	for (const [sectionIndex, section] of sections.entries()) {
		for (let sampleIndex = 1; sampleIndex < samples.length; sampleIndex += 1) {
			const startSample = samples[sampleIndex - 1]!;
			const endSample = samples[sampleIndex]!;
			const clippedStart = Math.max(startSample.distance, section.startDistance);
			const clippedEnd = Math.min(endSample.distance, section.endDistance);
			if (clippedEnd <= clippedStart + 1e-6) continue;
			const start = pointAlongSamples(samples, clippedStart);
			const end = pointAlongSamples(samples, clippedEnd);
			const bottomY =
				section.kind === 'lintel'
					? archBottom(section, (clippedStart + clippedEnd) / 2)
					: section.bottomY;
			if (section.topY <= bottomY + 1e-6) continue;
			spans.push({
				sectionIndex,
				startDistance: clippedStart,
				endDistance: clippedEnd,
				start,
				end,
				bottomY,
				topY: section.topY,
			});
		}
	}
	return spans;
}

function archBottom(section: CompiledWallSection, distance: number): number {
	if (!section.profile || section.profile.kind === 'rectangular') return section.bottomY;
	const localDistance = Math.max(
		0,
		Math.min(section.profile.width, distance - section.startDistance),
	);
	const profileTop = archProfileTopAt(section.profile, localDistance);
	const profileBaseY = section.profileBaseY ?? 0;
	return Math.min(section.topY, profileBaseY + profileTop);
}
