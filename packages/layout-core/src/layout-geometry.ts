import type { Vec3 } from './types';
import type {
	DraftPath,
	DraftSegment,
	LayoutDocument,
	LayoutFloor,
	LayoutObject,
	LayoutOpening,
	LayoutRoom,
	LayoutVec2
} from './layout-types';
import type { LayoutDocumentWallFirst } from './layout-wall-first-types';
import type {
	CompiledCurveSample,
	CompiledFloor,
	CompiledLayoutGeometry,
	CompiledLayoutGeometryResult,
	CompiledLayoutObject,
	CompiledOpening,
	CompiledPhysicalWall,
	CompiledQueryAabb,
	CompiledRoom,
	CompiledSolidSpan,
	CompiledWall,
	CompiledWallSection,
	LayoutBounds2,
	LayoutBounds3,
	LayoutGeometryIssue
} from './layout-geometry-types';
import { geometryId } from './layout-geometry-types';
import { pointAlongSamples, sampleSegment, type SampledSegment } from './layout-geometry-curve';
import { wallCenterlineSegment, wallCenterlineSamples } from './layout-wall-centerline';
import {
	archProfileTopAt,
	buildArchProfile,
	splitSampledWallAroundOpenings,
	wallPolylinesAroundOpenings
} from './layout-geometry-openings';
import { describeLayoutObject } from './layout-geometry-objects';
import {
	hasBlockingLayoutIssues,
	prepareLayoutRoomSegments,
	validatePreparedLayoutRoomGeometry
} from './layout-geometry-validation';
import { bounds2, createQueryGeometryBuilder, polygonBounds2, type QueryGeometryBuilder } from './layout-geometry-queries';

const OPENING_CENTER_EPSILON = 0.01;

/**
 * Opening shape accepted by the compiler source: the legacy segment-hosted
 * opening. Wall-first openings are mapped onto it with `segmentId = wallId`
 * (see `compileWallFirstLayoutGeometry`) so exactly one compiler consumes
 * both generations (P23.0: one geometry compiler/output model remains
 * authoritative).
 */
export type CompilerOpening = LayoutOpening;

/**
 * Internal compiler-source room: everything the shared compile core reads
 * from a room. The legacy document maps 1:1; the wall-first document maps
 * Walls to line segments and Wall-hosted openings to segment-hosted ones.
 */
export type CompilerRoomSource = {
	room: Pick<LayoutRoom, 'id' | 'wallThickness' | 'floorThickness' | 'ceilingThickness'>;
	boundary: DraftPath;
	openings: readonly CompilerOpening[];
	/**
	 * Per-wall thickness override keyed by boundary segment id (P23.0b: wall
	 * thickness is Wall-owned in the wall-first schema; the legacy schema is
	 * room-uniform and leaves this absent). Absent keeps legacy behavior and
	 * legacy cache keys byte-identical.
	 */
	wallThicknessBySegmentId?: Readonly<Record<string, number>>;
	/**
	 * P23.6H/P23.6I Per-wall Opening vertical limit keyed by boundary segment id
	 * (the wall-first adapter supplies each Wall's authoritative `height`; the
	 * legacy schema is floor-envelope and leaves this absent). Absent keeps the
	 * historical `floor.height` rule and byte-identical legacy behavior.
	 */
	openingHeightLimitBySegmentId?: Readonly<Record<string, number>>;
	/**
	 * P23.6I — explicit derived Room ceiling elevation (wall-first), computed once
	 * by the adapter as `floor.elevation + max(boundary Wall heights)`. Absent on
	 * the legacy path, where the ceiling stays Floor-derived and output stays
	 * byte-identical. This is the same optional-override pattern as
	 * `wallThicknessBySegmentId`/`openingHeightLimitBySegmentId`: exactly one Room
	 * compile path, no second compiler.
	 */
	ceilingElevation?: number;
};

/**
 * Internal compiler-source floor frame.
 *
 * Legacy floors map 1:1 and still carry the storey `height` (which drives their
 * Room ceilings and cache keys byte-identically). P23.6I removed the canonical
 * wall-first Floor scalar, so a wall-first frame supplies only `id`/`elevation`
 * and each Room carries its own derived `ceilingElevation`.
 */
export type CompilerFloorSource = Pick<LayoutFloor, 'id' | 'elevation'> & {
	height?: number;
};

/**
 * Internal compiler-source accepted by `compileLayoutGeometrySource`. The
 * public `compileLayoutGeometry` is a thin adapter over this, so every
 * generation compiles through the same code path.
 */
export type CompilerSource = {
	/** One entry per floor, in document order (P23 review round 1 / B1). */
	floors: readonly CompilerFloorEntry[];
	objects: readonly LayoutObject[];
	/**
	 * Whether wall segment ids are document-global (wall-first: `'document'`)
	 * or only unique inside their room (legacy: `'room'`). Snap/align wall
	 * identity derives from this via the per-span `wallKey`; legacy segments
	 * are qualified by floor+room so same-named segments of different rooms
	 * never collapse into one wall.
	 */
	wallIdScope?: 'document' | 'room';
};

/** One floor's worth of compiler input: the floor frame plus its rooms. */
export type CompilerFloorEntry = {
	floor: CompilerFloorSource;
	rooms: readonly CompilerRoomSource[];
};

/** Legacy compiler source: identity mapping onto the shared core. */
export function legacyCompilerSource(document: LayoutDocument): CompilerSource {
	// Identity mapping with no placeholder: an empty-floors document compiles
	// to zero floors, exactly as the pre-cutover per-floor loop did (review
	// round 1 nit).
	const floors: CompilerFloorEntry[] = document.floors.map((floor) => ({
		floor,
		rooms: floor.rooms.map((room) => ({
			room,
			boundary: room.boundary,
			openings: room.openings
		}))
	}));
	return { floors, objects: document.objects, wallIdScope: 'room' };
}

/**
 * Compile a LayoutDocument once into render-neutral geometry consumed by Plan,
 * editor 3D, and visitor 3D. Pure, deterministic, non-mutating, visitor-safe.
 */
export function compileLayoutGeometry(document: LayoutDocument): CompiledLayoutGeometryResult {
	return compileLayoutGeometrySource(legacyCompilerSource(document));
}

/**
 * Compile a wall-first Layout through the same shared core (P23.0 compiler
 * cutover): document-global Walls become the boundary segments (identity:
 * `wallId` — the wall-first compiler source sets `segmentId = wallId`),
 * Room-hosted openings rebase onto their Wall, Room boundaries map to the
 * Wall segments each Room references, and Wall-owned thickness flows through
 * the per-wall override. Query/selection identities for physical walls carry
 * the `wallId`; Room-derived semantic records retain `roomId`.
 */
export function compileWallFirstLayoutGeometry(
	document: LayoutDocumentWallFirst
): CompiledLayoutGeometryResult {
	const pointById = new Map(document.junctions.map((junction) => [junction.id, junction.point]));
	const wallById = new Map(document.walls.map((wall) => [wall.id, wall]));

	const wallThicknessBySegmentId: Record<string, number> = {};
	// P23.6H — the same canonical per-Wall loop also supplies the Opening
	// vertical limit, so Wall-owned thickness and Wall-owned height reach the
	// compiler through one adapter.
	const openingHeightLimitBySegmentId: Record<string, number> = {};
	for (const wall of document.walls) {
		wallThicknessBySegmentId[wall.id] = wall.thickness;
		openingHeightLimitBySegmentId[wall.id] = wall.height;
	}

	// P23.6I (D6) — a wall-first Room's ceiling is the derived flat plane
	// `floor.elevation + max(boundary Wall heights)`, computed once here and fed
	// into the shared Room compile path. The Floor no longer supplies it.
	// D7 applies: an unresolvable boundary is invalid state, not an architecture
	// to invent a ceiling for — the shared core skips such a Room with a blocking
	// `room_ceiling_undefined` issue and no fallback.
	const ceilingElevationByRoomId = new Map<string, number>();
	for (const room of document.rooms) {
		const heights: number[] = [];
		let resolved = room.boundary.length > 0;
		for (const ref of room.boundary) {
			const wall = wallById.get(ref.wallId);
			if (!wall || !Number.isFinite(wall.height)) {
				resolved = false;
				break;
			}
			heights.push(wall.height);
		}
		if (!resolved || heights.length === 0) {
			// No derived ceiling: the shared core owns the skip + blocking
			// issue (D7) — never a manufactured ceiling.
			continue;
		}
		ceilingElevationByRoomId.set(room.id, document.floor.elevation + Math.max(...heights));
	}

	const rooms: CompilerRoomSource[] = document.rooms.map((room) => {
		const segments: DraftSegment[] = [];
		const roomOpenings: CompilerOpening[] = [];
		// P23.11 — reverse-ref Opening offsets mirror by the **sampled arc
		// length** of the host Wall's canonical centerline, never the Euclidean
		// chord (straight Walls keep the identical chord value).
		const arcLengthByWallId = new Map<string, number>();
		for (const ref of room.boundary) {
			const wall = wallById.get(ref.wallId);
			if (!wall) continue; // reference integrity is the codec's job
			const start = pointById.get(wall.startJunctionId);
			const end = pointById.get(wall.endJunctionId);
			if (!start || !end) continue;
			// The Room boundary chain must connect ref-to-ref, so the segment
			// follows the ref's traversal direction (reverse swaps endpoints).
			// The legacy compiler core measures opening offsets from each
			// boundary segment's start, so reverse refs also mirror offsets
			// (o' = L − (o + w)) to keep them measured from the canonical
			// Wall start downstream. P23.11: the centerline adapter supplies
			// the segment, so curved Walls flow through the curve kernel
			// unchanged (no second sampling path).
			const reversed = ref.direction === 'reverse';
			segments.push(
				wallCenterlineSegment(wall, reversed ? end : start, reversed ? start : end)
			);
			if (!arcLengthByWallId.has(wall.id)) {
				const sampled = wallCenterlineSamples(wall, start, end);
				if (sampled) arcLengthByWallId.set(wall.id, sampled.length);
			}
		}
		for (const opening of document.openings) {
			const ref = room.boundary.find((candidate) => candidate.wallId === opening.wallId);
			if (!ref) continue;
			if (ref.direction === 'reverse') {
				const length = arcLengthByWallId.get(opening.wallId);
				if (length === undefined) continue;
				roomOpenings.push({
					...opening,
					segmentId: opening.wallId,
					offset: length - (opening.offset + opening.width)
				});
				continue;
			}
			roomOpenings.push({ ...opening, segmentId: opening.wallId });
		}
		const derivedCeiling = ceilingElevationByRoomId.get(room.id);
		return {
			room: {
				id: room.id,
				wallThickness: document.walls[0]?.thickness ?? 0.1,
				floorThickness: room.floorThickness,
				ceilingThickness: room.ceilingThickness
			},
			boundary: { closed: true, segments },
			openings: roomOpenings,
			wallThicknessBySegmentId,
			openingHeightLimitBySegmentId,
			...(derivedCeiling !== undefined ? { ceilingElevation: derivedCeiling } : {})
		};
	});

	// D7 is enforced inside the shared core: a Room with no derived ceiling is
	// skipped there with a blocking `room_ceiling_undefined` issue, so no
	// post-hoc issue append is needed here.
	return compileWallFirstWithPhysicalWalls(document, {
		floors: [{ floor: document.floor, rooms }],
		objects: document.objects,
		wallIdScope: 'document'
	});
}

/**
 * Wall-first compile with canonical physical-Wall output (P23.9 compiler
 * prerequisite, acceptance-blocking). Every document Wall compiles exactly
 * once into top-level `geometry.walls` (canonical, wall-start frame, keyed
 * by document-global Wall ID, no fake `roomId`). Room-derived walls are NOT
 * re-emitted: wall-first `CompiledRoom` records keep identity + floor/ceiling
 * semantics + floor polygons (fills, containment, room hits) with empty
 * `walls`/`openings`, and wall/opening span+point+AABB query records come
 * solely from the canonical path. Room-floor polygons, room AABBs, and all
 * validation/issues/floor logic are unchanged, except the aggregate
 * `floors[].bounds3` and `floor`/`document` query AABBs expand to include
 * canonical physical Walls (roomless Walls otherwise leave them stale). One compiler, not a second
 * geometry system. Legacy documents never enter this function, so the legacy
 * contract stays byte-identical.
 */
function compileWallFirstWithPhysicalWalls(
	document: LayoutDocumentWallFirst,
	source: CompilerSource
): CompiledLayoutGeometryResult {
	const result = compileLayoutGeometrySource(source);
	const geometry = result.geometry;
	const floor = document.floor;
	const floorElevation = floor.elevation;

	const pointById = new Map(document.junctions.map((junction) => [junction.id, junction.point]));
	const queryBuilder: QueryGeometryBuilder = {
		// Room path keeps floor polygons + room/floor/object/document AABBs
		// only; wall/opening span+point and wall/opening AABB records are
		// dropped below so each physical Wall has exactly one query
		// representation (canonical, no roomId).
		points: [],
		spans: [],
		polygons: [...geometry.queries.polygons],
		aabbs: geometry.queries.aabbs.filter(
			(aabb) => aabb.kind !== 'wall' && aabb.kind !== 'opening'
		)
	};
	const physicalWalls: CompiledPhysicalWall[] = [];
	let documentMin: Vec3 | null = geometry.bounds ? [...geometry.bounds.min] as Vec3 : null;
	let documentMax: Vec3 | null = geometry.bounds ? [...geometry.bounds.max] as Vec3 : null;
	const includePhysicalBounds = (min: Vec3, max: Vec3): void => {
		if (!documentMin || !documentMax) {
			documentMin = [...min] as Vec3;
			documentMax = [...max] as Vec3;
			return;
		}
		includeBounds3(documentMin, documentMax, min, max);
	};

	for (const wall of document.walls) {
		const start = pointById.get(wall.startJunctionId);
		const end = pointById.get(wall.endJunctionId);
		if (!start || !end) continue;
		// P23.11 — the canonical centerline adapter maps every Wall (line or
		// auto-bezier) onto the existing curve kernel; no second sampling path.
		const segment = wallCenterlineSegment(wall, start, end);
		let sampled: SampledSegment;
		try {
			sampled = sampleSegment(segment);
		} catch {
			continue;
		}
		const wallOpenings: CompilerOpening[] = document.openings
			.filter((opening) => opening.wallId === wall.id)
			.map((opening) => ({ ...opening, segmentId: opening.wallId }));
		// P23.6H — the Wall's own authoritative height decides its physical
		// vertical extent (`topY = floor.elevation + wall.height`). Room/Floor
		// envelopes stay Floor-derived; a partial-height Wall never lowers them.
		const wallTop = floorElevation + wall.height;
		const sections = splitSampledWallAroundOpenings(sampled, segment, wallOpenings, wall.height);
		const compiledOpenings = wallOpenings.map((opening) =>
			compileOpening(opening, sampled, floor.id, wall.id, cacheKeyOf(['physical-wall-geometry', floor.id, wall.id]))
		);
		const solidSpans = buildSolidSpans(sampled.samples, sections);
		const solidCenterlinePolylines = wallPolylinesAroundOpenings(sampled.samples, wallOpenings);
		const wallBounds2Value = wallBounds2(sampled.samples, wall.thickness);
		const wallBounds3Value = wallBounds3(sampled.samples, wall.thickness, floorElevation, wallTop);
		const compiled: CompiledPhysicalWall = {
			id: geometryId(['physical-wall', floor.id, wall.id]),
			cacheKey: cacheKeyOf(['physical-wall', floor.id, wall.id, segment, wallOpenings, wall.thickness, floor.elevation, wall.height]),
			wallId: wall.id,
			role: wall.role,
			floorId: floor.id,
			thickness: wall.thickness,
			height: wall.height,
			length: sampled.length,
			samples: sampled.samples,
			sections,
			solidSpans,
			openings: compiledOpenings,
			solidCenterlinePolylines,
			bounds2: wallBounds2Value,
			bounds3: wallBounds3Value
		};
		physicalWalls.push(compiled);
		emitPhysicalWallQueryRecords(queryBuilder, floor, wall, sampled, compiledOpenings, solidSpans);
		queryBuilder.aabbs.push(aabbRecord('wall', wall.id, ['wall', floor.id, wall.id], wallBounds3Value.min, wallBounds3Value.max));
		includePhysicalBounds(wallBounds3Value.min, wallBounds3Value.max);
	}

	physicalWalls.sort((a, b) => (a.wallId < b.wallId ? -1 : a.wallId > b.wallId ? 1 : 0));
	const bounds = documentMin && documentMax ? finiteBounds3(documentMin, documentMax) : null;
	// Strip room-path wall detail for wall-first documents: rooms keep
	// identity, floor/ceiling semantics, floor polygons and bounds, but their
	// `walls`/`openings` are views the canonical collection now owns. Every
	// physical Wall therefore has exactly one compiled + query representation.
	const rooms = geometry.rooms.map((room) => ({ ...room, walls: [], openings: [] }));
	// Aggregate bounds must include canonical physical Walls too: the shared
	// core derives `floors[].bounds3` and the `floor`/`document` query AABBs
	// from Rooms + objects only, so a roomless open Wall would otherwise
	// leave them null/stale while top-level `bounds` already includes it.
	// Seed from the compiled floor bounds (rooms + objects carry over), then
	// expand by every physical Wall; rebuild the floor record (bounds +
	// cacheKey, same components as the core) and the two aggregate AABBs.
	let floorMin: Vec3 | null = null;
	let floorMax: Vec3 | null = null;
	const existingFloor = geometry.floors.find((candidate) => candidate.floorId === floor.id);
	if (existingFloor?.bounds3) {
		floorMin = [...existingFloor.bounds3.min] as Vec3;
		floorMax = [...existingFloor.bounds3.max] as Vec3;
	}
	const includeFloorBounds = (min: Vec3, max: Vec3): void => {
		if (!floorMin || !floorMax) {
			floorMin = [...min] as Vec3;
			floorMax = [...max] as Vec3;
			return;
		}
		includeBounds3(floorMin, floorMax, min, max);
	};
	for (const wall of physicalWalls) includeFloorBounds(wall.bounds3.min, wall.bounds3.max);
	const floorBounds = floorMin && floorMax ? finiteBounds3(floorMin, floorMax) : null;
	const floors =
		geometry.floors.some((candidate) => candidate.floorId === floor.id)
			? geometry.floors.map((candidate) =>
					candidate.floorId !== floor.id
						? candidate
						: {
								...candidate,
								bounds3: floorBounds,
								cacheKey: cacheKeyOf([
									'floor',
									floor.id,
									candidate.elevation,
									candidate.roomIds,
									floorBounds
								])
							}
				)
			: [
					...geometry.floors,
					{
						id: geometryId(['floor', floor.id]),
						cacheKey: cacheKeyOf(['floor', floor.id, floorElevation, [], floorBounds]),
						floorId: floor.id,
						elevation: floorElevation,
						roomIds: [],
						bounds3: floorBounds
					}
				];
	const aabbs = queryBuilder.aabbs.filter((aabb) => aabb.kind !== 'floor' && aabb.kind !== 'document');
	if (floorBounds) {
		aabbs.push(aabbRecord('floor', floor.id, ['floor', floor.id], floorBounds.min, floorBounds.max));
	}
	if (bounds) {
		aabbs.push(aabbRecord('document', 'document', ['document'], bounds.min, bounds.max));
	}
	return {
		geometry: {
			...geometry,
			floors,
			rooms,
			walls: physicalWalls,
			queries: {
				points: queryBuilder.points,
				spans: queryBuilder.spans,
				polygons: queryBuilder.polygons,
				aabbs
			},
			bounds
		},
		issues: result.issues
	};
}

/** Query records for one canonical physical Wall — no fake `roomId`. */
function emitPhysicalWallQueryRecords(
	queryBuilder: QueryGeometryBuilder,
	floor: CompilerFloorSource,
	wall: LayoutDocumentWallFirst['walls'][number],
	sampled: SampledSegment,
	openings: readonly CompiledOpening[],
	solidSpans: readonly CompiledSolidSpan[]
): void {
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

/**
 * Shared compile core (P23.0 compiler cutover): one geometry compiler/output
 * model for every document generation. Legacy and wall-first callers differ
 * only in the `CompilerSource` adapter they supply. Diagnostics paths remain
 * room-indexed (`rooms[i]`) so legacy consumers see identical issue paths.
 */
export function compileLayoutGeometrySource(source: CompilerSource): CompiledLayoutGeometryResult {
	const issues: LayoutGeometryIssue[] = [];
	const floors: CompiledFloor[] = [];
	const rooms: CompiledRoom[] = [];
	const queryBuilder = createQueryGeometryBuilder();
	const wallIdScope = source.wallIdScope ?? 'document';

	const objects = compileObjects(source.objects, issues, queryBuilder);

	// Per-floor loop (P23 review round 1 / B1): the pre-cutover legacy
	// compiler iterated every floor; the cutover must not regress that. Each
	// floor compiles its own rooms with its own elevation frame, and issue
	// paths stay legacy-identical (`floors[i].rooms[j]`).
	for (const [floorIndex, floorEntry] of source.floors.entries()) {
		const floor = floorEntry.floor;
		const floorRoomIds: string[] = [];
		// P23.6I — the Floor no longer carries a vertical extent, so the legacy
		// storey scalar is kept only as a *cache-key dependency* where it exists
		// (wall-first supplies each Room's derived ceiling instead). Legacy keys
		// therefore stay byte-identical.
		const floorCeilingDependencies: number[] = [];
		let floorMin: Vec3 = [Infinity, Infinity, Infinity];
		let floorMax: Vec3 = [-Infinity, -Infinity, -Infinity];

		for (const [roomIndex, roomSource] of floorEntry.rooms.entries()) {
			const path = `floors[${floorIndex}].rooms[${roomIndex}]`;
			// P23.6I D7 (review closeout) — a Room with no vertical datum
			// (neither a wall-first derived ceiling nor a legacy Floor height)
			// never acquires an invented ceiling: skip it and block by name
			// instead of compiling a fake zero-height Room at the elevation.
			// Legacy frames always carry `height`, so legacy output is unchanged.
			if (roomSource.ceilingElevation === undefined && floor.height === undefined) {
				issues.push({
					path: `${path}.boundary`,
					code: 'room_ceiling_undefined',
					message: `Room '${roomSource.room.id}' has no resolvable boundary Wall to derive a ceiling from`,
					targetId: roomSource.room.id
				});
				continue;
			}
			const prepared = prepareLayoutRoomSegments(
				{ id: roomSource.room.id, boundary: roomSource.boundary },
				path
			);
			const roomIssues = [
				...prepared.issues,
				...validatePreparedLayoutRoomGeometry(
					{
						id: roomSource.room.id,
						boundary: roomSource.boundary,
						openings: roomSource.openings
					},
					floor,
					prepared.segments,
					path,
					roomSource.openingHeightLimitBySegmentId
				)
			];
			issues.push(...roomIssues);
			if (hasBlockingLayoutIssues(roomIssues)) continue;

			const compiledRoom = compileRoom(
				roomSource,
				floor,
				prepared.segments as SampledSegment[],
				queryBuilder,
				wallIdScope
			);
			rooms.push(compiledRoom);
			floorRoomIds.push(roomSource.room.id);
			floorCeilingDependencies.push(compiledRoom.ceilingElevation);
			includeBounds3(floorMin, floorMax, compiledRoom.bounds3.min, compiledRoom.bounds3.max);
		}

		for (const object of objects) {
			if (!object.roomId) continue;
			const owned = floorEntry.rooms.some((roomSource) => roomSource.room.id === object.roomId);
			if (owned) includeBounds3(floorMin, floorMax, object.worldAabb.min, object.worldAabb.max);
		}

		floors.push({
			id: geometryId(['floor', floor.id]),
			cacheKey: cacheKeyOf([
				'floor',
				floor.id,
				floor.elevation,
				floor.height ?? floorCeilingDependencies,
				floorRoomIds,
				finiteBounds3(floorMin, floorMax)
			]),
			floorId: floor.id,
			elevation: floor.elevation,
			roomIds: floorRoomIds,
			bounds3: finiteBounds3(floorMin, floorMax)
		});
		emitBoundsAabb(queryBuilder, 'floor', floor.id, ['floor', floor.id], floorMin, floorMax);
	}

	let documentMin: Vec3 = [Infinity, Infinity, Infinity];
	let documentMax: Vec3 = [-Infinity, -Infinity, -Infinity];
	for (const room of rooms) includeBounds3(documentMin, documentMax, room.bounds3.min, room.bounds3.max);
	for (const object of objects) includeBounds3(documentMin, documentMax, object.worldAabb.min, object.worldAabb.max);
	const documentBounds = finiteBounds3(documentMin, documentMax);
	if (documentBounds) {
		queryBuilder.aabbs.push(aabbRecord('document', 'document', ['document'], documentBounds.min, documentBounds.max));
	}

	const geometry: CompiledLayoutGeometry = {
		floors,
		rooms,
		walls: [],
		objects,
		queries: {
			points: queryBuilder.points,
			spans: queryBuilder.spans,
			polygons: queryBuilder.polygons,
			aabbs: queryBuilder.aabbs
		},
		bounds: documentBounds
	};

	return { geometry, issues };
}

function compileRoom(
	roomSource: CompilerRoomSource,
	floor: CompilerFloorSource,
	sampledSegments: SampledSegment[],
	queryBuilder: QueryGeometryBuilder,
	wallIdScope: 'document' | 'room'
): CompiledRoom {
	const room = roomSource.room;
	const floorElevation = floor.elevation;
	// P23.6I — a wall-first Room carries its derived ceiling (`floor.elevation +
	// max(boundary Wall heights)`); the legacy path supplies nothing and keeps the
	// storey-derived ceiling, so legacy output stays byte-identical.
	const ceilingElevation = roomSource.ceilingElevation ?? floor.elevation + (floor.height ?? 0);
	// Vertical extent handed to the shared Opening-splitting helper. Legacy equals
	// `floor.height` exactly; wall-first uses its derived ceiling.
	const roomVerticalExtent = ceilingElevation - floorElevation;

	const floorPolygon: LayoutVec2[] = roomSource.boundary.segments.flatMap((segment, index) => {
		const samples = sampledSegments[index]!.samples;
		if (segment.kind === 'line') return [[...segment.start] as LayoutVec2];
		return samples.slice(0, -1).map((sample) => [...sample.point] as LayoutVec2);
	});
	const ceilingPolygon = floorPolygon.map(([x, z]) => [x, z] as LayoutVec2);

	const openingsBySegment = new Map<string, CompilerOpening[]>();
	for (const opening of roomSource.openings) {
		const openings = openingsBySegment.get(opening.segmentId) ?? [];
		openings.push(opening);
		openingsBySegment.set(opening.segmentId, openings);
	}

	const walls: CompiledWall[] = roomSource.boundary.segments.map((segment, index) => {
		const sampled = sampledSegments[index]!;
		const openings = openingsBySegment.get(segment.id) ?? [];
		// P23.0b: wall thickness is Wall-owned in the wall-first schema. The
		// per-wall override keeps every downstream record identical in shape;
		// only the thickness value may differ per wall. Cache keys remain
		// structural (`thickness` participates where it always did).
		const wallThickness = roomSource.wallThicknessBySegmentId?.[segment.id] ?? room.wallThickness;
		const segmentDependencyKey = cacheKeyOf([
			'segment-geometry',
			floor.id,
			room.id,
			segment
		]);
		const sections = splitSampledWallAroundOpenings(sampled, segment, openings, roomVerticalExtent);
		const compiledOpenings = openings.map((opening) =>
			compileOpening(opening, sampled, floor.id, room.id, segmentDependencyKey)
		);
		const solidSpans = buildSolidSpans(sampled.samples, sections);
		const solidCenterlinePolylines = wallPolylinesAroundOpenings(sampled.samples, openings);
		const wallBounds2Value = wallBounds2(sampled.samples, wallThickness);
		const wallBounds3Value = wallBounds3(sampled.samples, wallThickness, floorElevation, ceilingElevation);
		return {
			id: geometryId(['wall', floor.id, room.id, segment.id]),
			cacheKey: cacheKeyOf([
				'wall',
				segmentDependencyKey,
				openings,
				wallThickness,
				floor.elevation,
				floor.height ?? roomSource.ceilingElevation
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
			bounds3: wallBounds3Value
		};
	});

	const roomOpenings = walls.flatMap((wall) => wall.openings);
	const roomBounds2 = roomBounds2FromWalls(walls, floorPolygon);
	const roomBounds3 = roomBounds3FromParts(floorPolygon, walls, floorElevation, ceilingElevation, room.floorThickness, room.ceilingThickness);

	emitRoomQueryRecords(
		queryBuilder,
		floor,
		{ id: room.id, boundary: roomSource.boundary },
		walls,
		floorPolygon,
		roomBounds3,
		wallIdScope
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
			room.floorThickness,
			room.ceilingThickness,
			roomSource.openings,
			// Legacy callers never supply per-wall thickness, so their cache
			// keys stay byte-identical to the pre-cutover compiler.
			...(roomSource.wallThicknessBySegmentId
				? [roomSource.wallThicknessBySegmentId]
				: [])
		]),
		roomId: room.id,
		floorElevation,
		ceilingElevation,
		floorThickness: room.floorThickness,
		ceilingThickness: room.ceilingThickness,
		wallThickness: room.wallThickness,
		floorPolygon,
		ceilingPolygon,
		walls,
		openings: roomOpenings,
		bounds2: roomBounds2,
		bounds3: roomBounds3
	};
}

function compileOpening(
	opening: LayoutOpening,
	sampled: SampledSegment,
	floorId: string,
	roomId: string,
	segmentDependencyKey: string
): CompiledOpening {
	const centerDistance = opening.offset + opening.width / 2;
	const point = pointAlongSamples(sampled.samples, centerDistance);
	const before = pointAlongSamples(sampled.samples, Math.max(0, centerDistance - OPENING_CENTER_EPSILON));
	const after = pointAlongSamples(sampled.samples, Math.min(sampled.length, centerDistance + OPENING_CENTER_EPSILON));
	const tangentX = after[0] - before[0];
	const tangentZ = after[1] - before[1];
	const magnitude = Math.hypot(tangentX, tangentZ) || 1;
	const tangent: LayoutVec2 = [tangentX / magnitude, tangentZ / magnitude];
	const profileShape = opening.profile === 'rectangular'
		? undefined
		: buildArchProfile(opening.profile, opening.width, opening.height).profile ?? undefined;
	const centerPolyline = openingCenterPolyline(sampled, opening.offset, opening.offset + opening.width);
	return {
		id: geometryId(['opening', floorId, roomId, opening.id]),
		cacheKey: cacheKeyOf(['opening', segmentDependencyKey, opening]),
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
			yaw: -Math.atan2(tangentZ, tangentX)
		},
		centerPolyline,
		bounds2: polygonBounds2(centerPolyline) ?? bounds2(point[0], point[1], point[0], point[1]),
		...(opening.connectsRoomIds ? { connectsRoomIds: opening.connectsRoomIds } : {})
	};
}

function openingCenterPolyline(sampled: SampledSegment, start: number, end: number): LayoutVec2[] {
	const points: LayoutVec2[] = [pointAlongSamples(sampled.samples, start)];
	for (const sample of sampled.samples) {
		if (sample.distance > start + 1e-6 && sample.distance < end - 1e-6) points.push([...sample.point] as LayoutVec2);
	}
	points.push(pointAlongSamples(sampled.samples, end));
	return points;
}

function buildSolidSpans(samples: readonly CompiledCurveSample[], sections: readonly CompiledWallSection[]): CompiledSolidSpan[] {
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
			const bottomY = section.kind === 'lintel' ? archBottom(section, (clippedStart + clippedEnd) / 2) : section.bottomY;
			if (section.topY <= bottomY + 1e-6) continue;
			spans.push({ sectionIndex, startDistance: clippedStart, endDistance: clippedEnd, start, end, bottomY, topY: section.topY });
		}
	}
	return spans;
}

function archBottom(section: CompiledWallSection, distance: number): number {
	if (!section.profile || section.profile.kind === 'rectangular') return section.bottomY;
	const localDistance = Math.max(0, Math.min(section.profile.width, distance - section.startDistance));
	const profileTop = archProfileTopAt(section.profile, localDistance);
	const profileBaseY = section.profileBaseY ?? 0;
	return Math.min(section.topY, profileBaseY + profileTop);
}

function compileObjects(
	objects: readonly LayoutObject[],
	issues: LayoutGeometryIssue[],
	queryBuilder: QueryGeometryBuilder
): CompiledLayoutObject[] {
	const compiled: CompiledLayoutObject[] = [];
	for (const [index, object] of objects.entries()) {
		if (!isValidObject(object)) {
			issues.push({
				path: `objects[${index}]`,
				code: 'object_invalid',
				message: 'Layout object position and rotation must be finite and dimensions must be finite and greater than zero.',
				targetId: object.id
			});
			continue;
		}
		const descriptor = describeLayoutObject(object);
		compiled.push(descriptor);
		queryBuilder.polygons.push(
			polygonRecord(
				'object-footprint',
				['object-footprint', object.id],
				descriptor.planFootprint,
				object.id,
				{ objectId: object.id }
			)
		);
		queryBuilder.aabbs.push(aabbRecord('object', object.id, ['object', object.id], descriptor.worldAabb.min, descriptor.worldAabb.max));
	}
	return compiled;
}

function isValidObject(object: LayoutObject): boolean {
	const vectors = [object.position, object.rotation, object.dimensions];
	if (vectors.some((vector) => !vector.every((value) => Number.isFinite(value)))) return false;
	return object.dimensions.every((value) => value > 0);
}

function emitRoomQueryRecords(
	queryBuilder: QueryGeometryBuilder,
	floor: CompilerFloorSource,
	room: Pick<LayoutRoom, 'id' | 'boundary'>,
	walls: readonly CompiledWall[],
	floorPolygon: readonly LayoutVec2[],
	roomBounds3: LayoutBounds3,
	wallIdScope: 'document' | 'room'
): void {
	const roomIdParts = ['room', floor.id, room.id];

	for (const [segmentIndex, segment] of room.boundary.segments.entries()) {
		const wallKey =
			wallIdScope === 'room' ? geometryId([floor.id, room.id, segment.id]) : segment.id;
		queryBuilder.points.push(
			pointRecord(
				floor.id,
				room.id,
				segment.id,
				'vertex',
				segment.id,
				segmentIndex,
				[...segment.start] as LayoutVec2,
				wallKey
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
						wallKey
					)
				);
			}
		}
	}

	for (const wall of walls) {
		const wallKey =
			wallIdScope === 'room' ? geometryId([floor.id, room.id, wall.segmentId]) : wall.segmentId;
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
					wallKey
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
					wallKey
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

function wallBounds2(samples: readonly CompiledCurveSample[], thickness: number): LayoutBounds2 {
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

function wallBounds3(samples: readonly CompiledCurveSample[], thickness: number, floorElevation: number, ceilingElevation: number): LayoutBounds3 {
	const bounds2 = wallBounds2(samples, thickness);
	return { min: [bounds2.min[0], floorElevation, bounds2.min[1]], max: [bounds2.max[0], ceilingElevation, bounds2.max[1]] };
}

function roomBounds2FromWalls(walls: readonly CompiledWall[], floorPolygon: readonly LayoutVec2[]): LayoutBounds2 {
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

function roomBounds3FromParts(
	floorPolygon: readonly LayoutVec2[],
	walls: readonly CompiledWall[],
	floorElevation: number,
	ceilingElevation: number,
	floorThickness: number,
	ceilingThickness: number
): LayoutBounds3 {
	const min: Vec3 = [Infinity, Infinity, Infinity];
	const max: Vec3 = [-Infinity, -Infinity, -Infinity];
	for (const [x, z] of floorPolygon) includeBounds3(min, max, [x, floorElevation - floorThickness, z]);
	for (const [x, z] of floorPolygon) includeBounds3(min, max, [x, ceilingElevation + ceilingThickness, z]);
	for (const wall of walls) includeBounds3(min, max, wall.bounds3.min, wall.bounds3.max);
	return finiteBounds3(min, max) ?? { min: [0, floorElevation, 0], max: [0, ceilingElevation, 0] };
}

function includeBounds3(min: Vec3, max: Vec3, ...points: readonly Vec3[]): void {
	for (const point of points) {
		min[0] = Math.min(min[0], point[0]);
		min[1] = Math.min(min[1], point[1]);
		min[2] = Math.min(min[2], point[2]);
		max[0] = Math.max(max[0], point[0]);
		max[1] = Math.max(max[1], point[1]);
		max[2] = Math.max(max[2], point[2]);
	}
}

function finiteBounds3(min: Vec3, max: Vec3): LayoutBounds3 | null {
	if (![...min, ...max].every(Number.isFinite)) return null;
	return { min: [...min] as Vec3, max: [...max] as Vec3 };
}

function cacheKeyOf(parts: readonly unknown[]): string {
	return JSON.stringify(parts);
}

function pointRecord(
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

function spanRecord(
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
	// legacy cache keys stay byte-identical to the pre-cutover compiler.
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

function polygonRecord(
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

function aabbRecord(kind: CompiledQueryAabb['kind'], sourceId: string, parts: readonly string[], min: Vec3, max: Vec3): CompiledQueryAabb {
	return aabb2Record(kind, sourceId, parts, bounds2(min[0], min[2], max[0], max[2]));
}

function aabb2Record(kind: CompiledQueryAabb['kind'], sourceId: string, parts: readonly string[], aabb: LayoutBounds2): CompiledQueryAabb {
	return {
		id: geometryId(parts),
		cacheKey: cacheKeyOf([...parts, aabb.min, aabb.max]),
		kind,
		aabb,
		sourceId
	};
}

function emitBoundsAabb(
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
