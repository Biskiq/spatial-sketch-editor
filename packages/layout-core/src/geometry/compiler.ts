import type { WallSamplingDerivation } from '../wall/centerline';
import { isCanonicalWallSampling } from '../wall/centerline';
import { readPassiveCompiledGeometry, recordPassiveCompiledGeometry, recordSessionlessCompile, seedReuseFromPassiveCompile, tryCompileWallFirstLayoutGeometryDelta } from './delta';
import { layoutItem, layoutLength } from '../kernel/source-collections';
import type { Vec3 } from '../kernel/types';
import type { LayoutDocumentWallFirst } from '../wall/types';
import type { CompiledFloor, CompiledLayoutGeometry, CompiledLayoutGeometryResult, CompiledRoom, CompilerRoomSource, CompilerSource, LayoutGeometryIssue } from './types';
import { geometryId } from './types';
import { countWork, p2311Measure } from '../kernel/work-observer';
import { cacheKeyOf } from './keys';
import type { LayoutCompileReuse } from './reuse';
import { beginLayoutCompile, finishLayoutCompile, noQueryRecords, sameAuthored } from './reuse';
import type { SampleableSegment, SampledSegment } from './curve';
import { hasBlockingLayoutIssues, prepareLayoutRoomSegments, validatePreparedLayoutRoomGeometry } from './validation';
import { createQueryGeometryBuilder } from './queries';
import { DELTA_BUILDERS } from './delta-builders';
import { compileWallFirstWithPhysicalWalls, floorElevationOf } from './physical-walls';
import { aabbRecord, emitBoundsAabb, finiteBounds3, includeBounds3, pushRetainedRecords } from './query-records';
import { buildWallFirstRoomSource, compileRoom, openingsGroupedByWallId, spacePreflight } from './rooms'
import { compileObjects } from './room-objects';
import type { LayoutGeometryCompileOptions } from './session';

function compileSessionlessOnce(document: LayoutDocumentWallFirst, sampling?: WallSamplingDerivation): CompiledLayoutGeometryResult {
	countWork('compile:walls', layoutLength(document, 'walls'));
	countWork('compile:junctions', layoutLength(document, 'junctions'));
	countWork('compile:openings', layoutLength(document, 'openings'));
	countWork('compile:rooms', layoutLength(document, 'rooms'));
	return p2311Measure('compile', () => compileWallFirstLayoutGeometryOnce(document, sampling));
}


/**
 * The cold oracle. Always compiles from the document, never reads nor
 * writes a recorded result, so a differential can never compare a session's
 * compile with that session's own record.
 */
export function compileWallFirstLayoutGeometryFresh(
	document: LayoutDocumentWallFirst,
	sampling?: WallSamplingDerivation
): CompiledLayoutGeometryResult {
	countWork('compile');
	return compileSessionlessOnce(document, sampling);
}


/**
 * Compile the authored Layout once into render-neutral geometry consumed by
 * Plan, editor 3D, and visitor 3D. Pure, deterministic, non-mutating,
 * visitor-safe. Every document is wall-first
 * and this is the one compiler entry.
 *
 * Document-global Walls become the boundary segments (identity: `wallId` — the
 * compiler source sets `segmentId = wallId`),
 * Room-hosted openings rebase onto their Wall, Room boundaries map to the
 * Wall segments each Room references, and Wall-owned thickness flows through
 * the per-wall override. Query/selection identities for physical walls carry
 * the `wallId`; Room-derived semantic records retain `roomId`.
 */
export function compileWallFirstLayoutGeometry(
	document: LayoutDocumentWallFirst,
	sampling?: WallSamplingDerivation,
	reuse?: LayoutCompileReuse
): CompiledLayoutGeometryResult {
	// Only the canonical derivation factory proves process-constant sampling.
	// An injected wrapper stays on the cold authority and cannot seed caches
	// which a later default derivation might accidentally inherit.
	if (reuse && !isCanonicalWallSampling(sampling)) {
		countWork('compile:custom-sampling-global-reset', reuse.walls.size + reuse.junctions.size + reuse.roomSources.size + reuse.objects.size);
		reuse.walls.clear(); reuse.junctions.clear(); reuse.roomSources.clear(); reuse.objects.clear(); reuse.regions.clear();
		reuse.world = null; reuse.retainedFloor = null; reuse.retainedDocAabb = null;
		beginLayoutCompile(reuse);
		const result = compileWallFirstLayoutGeometry(document, sampling);
		reuse.counters.wallsEvaluated = result.geometry.walls.length;
		reuse.counters.junctionsEvaluated = result.geometry.junctions?.length ?? 0;
		reuse.counters.roomsEvaluated = result.geometry.rooms.length;
		reuse.counters.objectsEvaluated = result.geometry.objects.length;
		reuse.counters.regionsEvaluated = result.geometry.regions.length;
		reuse.counters.openingsEvaluated = layoutLength(document, 'openings');
		finishLayoutCompile(reuse, true);
		return result;
	}
	countWork('compile');
	if (!reuse) {
		// The one session-less read. A document that was already frozen
		// when its result was recorded cannot have changed since, so that record
		// is its compile; an unfrozen document always compiles.
		const canonical = isCanonicalWallSampling(sampling);
		if (canonical) {
			const record = readPassiveCompiledGeometry(document);
			if (record?.sealed === true) {
				countWork('compile:passive-read');
				return { geometry: record.geometry, issues: [...record.issues] };
			}
		}
		const result = compileSessionlessOnce(document, sampling);
		if (canonical) recordSessionlessCompile(document, result.geometry, result.issues);
		return result;
	}
	// An incremental compile reports its own work: how many
	// entities the canonical builders ran for, how many retained values were
	// installed by reference, and how many structural comparisons that took.
	// "Cold" means the store held no unit of any class when this compile began, so
	// nothing could have been reused.
	const cold =
		reuse.walls.size === 0 &&
		reuse.junctions.size === 0 &&
		reuse.roomSources.size === 0 &&
		reuse.objects.size === 0 &&
		reuse.regions.size === 0 &&
		reuse.world === null;
	beginLayoutCompile(reuse);
	const deltaResult = !cold
		? p2311Measure('compile-delta', () =>
				tryCompileWallFirstLayoutGeometryDelta(document, sampling, reuse, DELTA_BUILDERS)
			)
		: null;
	let result: CompiledLayoutGeometryResult;
	if (deltaResult !== null) {
		result = deltaResult;
	} else {
		if (!cold) beginLayoutCompile(reuse);
		result = p2311Measure('compile', () => compileWallFirstLayoutGeometryOnce(document, sampling, reuse));
		if (isCanonicalWallSampling(sampling) && result.issues.length === 0) {
			recordPassiveCompiledGeometry(document, result.geometry, result.issues);
			reuse.world = null;
			seedReuseFromPassiveCompile(document, reuse, DELTA_BUILDERS, true);
		} else {
			reuse.world = null;
		}
	}
	const stats = finishLayoutCompile(reuse, cold);
	if (cold) {
		countWork('compile:walls', layoutLength(document, 'walls'));
		countWork('compile:junctions', layoutLength(document, 'junctions'));
		countWork('compile:openings', layoutLength(document, 'openings'));
		countWork('compile:rooms', layoutLength(document, 'rooms'));
	} else {
		countWork('compile:walls', stats.wallsEvaluated);
		countWork('compile:junctions', stats.junctionsEvaluated);
		countWork('compile:openings', stats.openingsEvaluated);
		countWork('compile:rooms', stats.roomsEvaluated);
	}
	countWork('reuse:walls-evaluated', stats.wallsEvaluated);
	countWork('reuse:walls-reused', stats.wallsReused);
	countWork('reuse:junctions-evaluated', stats.junctionsEvaluated);
	countWork('reuse:junctions-reused', stats.junctionsReused);
	countWork('reuse:rooms-evaluated', stats.roomsEvaluated);
	countWork('reuse:rooms-reused', stats.roomsReused);
	countWork('reuse:objects-evaluated', stats.objectsEvaluated);
	countWork('reuse:objects-reused', stats.objectsReused);
	countWork('reuse:signature-visits', stats.signatureVisits);
	return result;
}


function compileWallFirstLayoutGeometryOnce(
	document: LayoutDocumentWallFirst,
	sampling?: WallSamplingDerivation,
	reuse?: LayoutCompileReuse
): CompiledLayoutGeometryResult {
	const pointById = new Map(document.junctions.map((junction) => [junction.id, junction.point]));
	const junctionById = new Map(document.junctions.map((junction) => [junction.id, junction]));
	const wallById = new Map(document.walls.map((wall) => [wall.id, wall]));
	// Open-Space outline and placement gates run before any Room geometry is
	// built: a failing Space is skipped whole, never compiled partially.
	const preflight = spacePreflight(document);

	const wallThicknessBySegmentId: Record<string, number> = {};
	// The same canonical per-Wall loop also supplies the Opening
	// vertical limit, so Wall-owned thickness and Wall-owned height reach the
	// compiler through one adapter.
	const openingHeightLimitBySegmentId: Record<string, number> = {};
	for (const wall of document.walls) {
		wallThicknessBySegmentId[wall.id] = wall.thickness;
		openingHeightLimitBySegmentId[wall.id] = wall.height;
	}

	// A wall-first Room's ceiling is the derived flat plane
	// `floor.elevation + max(boundary Wall heights)`, computed once here and fed
	// into the shared Room compile path. The Floor no longer supplies it.
	// An unresolvable boundary is invalid state, not an architecture
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
			// issue — never a manufactured ceiling.
			continue;
		}
		ceilingElevationByRoomId.set(room.id, document.floor.elevation + Math.max(...heights));
	}

	// Segment-identity map serving the shared-core room validation
	// from the chain derivation. One map for all rooms is sound: segment objects
	// are created fresh per room above, so identity lookup can never alias rooms.
	const preSampled = new Map<SampleableSegment, SampledSegment>();
	// The Room × Opening join is an id index, not a scan:
	// `document.openings` is grouped once and each Room reads only its own
	// boundary Walls' openings. That read is boundary-ordered, so the compiled
	// Room's Opening list is restored to document order below; together the two
	// keep every compiled Opening list unchanged.
	const openingsByHostWallId = openingsGroupedByWallId(document.openings);
	// Position of each Opening in `document.openings`. The
	// join below reads the boundary (so it only visits this Room's own Openings),
	// which is boundary order, not document order; the compiled Room's Opening
	// list is document-ordered, so it is restored by this index rather than by a
	// second scan of every Opening for every Room.
	const openingOrderById = new Map(document.openings.map((opening, index) => [opening.id, index]));
	// The Room-input pass is its own span, because in an
	// incremental compile it is the O(R) comparison term rather than the O(k)
	// evaluation term, and the two must stay separable in an attribution.
	const rooms: CompilerRoomSource[] = p2311Measure('incremental:room-inputs', () => document.rooms.filter((room) => !preflight.invalidRoomIds.has(room.id)).map((room) => {
		// The retained Room **input** is compared before it
		// is rebuilt. Everything below derives from the Room's own authored
		// fields, its boundary Walls' authored centerlines and endpoint
		// coordinates, those Walls' thickness/height (they reach the source as
		// per-segment overrides) and the Openings those Walls host. When none of
		// that moved, the previous source is still exactly what this loop would
		// produce, so the segment construction, sampling and miroring are skipped.
		const retentionKey = reuse
			? [
					room,
					ceilingElevationByRoomId.get(room.id) ?? null,
					floorElevationOf(document),
					// The Floor datum is part of the Room's *compiled identity*
					// (`geometryId(['room', floor.id, room.id])`), and the shared core
					// derives the Floor's room list from these rooms, so a renamed Floor
					// must re-evaluate every Room.
					document.floor.id,
					// The Room source carries the document's first Wall thickness as its
					// fallback (`wallThickness: layoutItem(document, 'walls', 0)?.thickness ?? 0.1`),
					// which lands in the compiled Room's own `wallThickness` and key.
					// Editing that Wall therefore moves every Room's output, even when
					// the edited Wall is not on this Room's boundary.
					layoutItem(document, 'walls', 0)?.thickness ?? 0.1,
					// A different sampling derivation is a different input: the retained
					// source embeds `preSampled` only when one is supplied.
					sampling !== undefined,
					...room.boundary.map((ref) => {
						const wall = wallById.get(ref.wallId);
						return [
							ref,
							wall ?? null,
							wall ? pointById.get(wall.startJunctionId) ?? null : null,
							wall ? pointById.get(wall.endJunctionId) ?? null : null,
							openingsByHostWallId.get(ref.wallId) ?? null
						];
					}),
					// A virtual endpoint can move without changing a Wall record, so
					// its resolved point is part of the Room's authored input too.
					...room.virtualEdges.map((edge) => [
						edge,
						pointById.get(edge.startJunctionId) ?? null,
						pointById.get(edge.endJunctionId) ?? null
					])
				]
			: undefined;
		if (reuse && retentionKey) {
			reuse.counters.signatureVisits += 1;
			reuse.counters.entities += 1;
			const retained = reuse.roomSources.get(room.id);
			if (retained && sameAuthored(retained.authored, retentionKey)) {
				// No counter here: the shared core reports the Room's compile, which
				// is the work this reuse removes. Counting the source build as well
				// would report every Room twice.
				return retained.source;
			}
		}
		// One source builder serves the full and delta compiles, so a virtual
		// edge can never reach one path and not the other. The composer owns the
		// mixed order; this adapter only realizes it as sampleable segments.
		const built = buildWallFirstRoomSource(document, room, {
			junctionById,
			pointById,
			wallById,
			openingsByHostWallId,
			openingOrderById,
			wallThicknessBySegmentId,
			openingHeightLimitBySegmentId,
			defaultWallThickness: layoutItem(document, 'walls', 0)?.thickness ?? 0.1,
			...(sampling ? { sampling, preSampled } : {})
		});
		if ('issue' in built) {
			// Unreachable: `spacePreflight` applied the same composer and removed
			// this Room. Returning an empty source keeps the map total without
			// inventing geometry; the preflight issue is already recorded.
			return {
				room: {
					id: room.id,
					wallThickness: layoutItem(document, 'walls', 0)?.thickness ?? 0.1,

					overhead: room.overhead
				},
				boundary: { closed: true, segments: [] },
				openings: []
			};
		}
		const source = built.source;
		if (reuse && retentionKey) reuse.roomSources.set(room.id, { authored: retentionKey, source });
		return source;
	}));

	// Ceiling resolution is enforced inside the shared core: a Room with no derived ceiling is
	// skipped there with a blocking `room_ceiling_undefined` issue, so no
	// post-hoc issue append is needed here.
	const result = compileWallFirstWithPhysicalWalls(document, {
		floors: [{ floor: document.floor, rooms }],
		objects: document.objects
	}, sampling, reuse);
	if (preflight.issues.length === 0) return result;
	return { geometry: result.geometry, issues: [...preflight.issues, ...result.issues] };
}


export function compileLayoutGeometrySource(
	source: CompilerSource,
	options: LayoutGeometryCompileOptions = {},
	reuse?: LayoutCompileReuse
): CompiledLayoutGeometryResult {
	const recordMode = options.queryRecords ?? 'room';
	const issues: LayoutGeometryIssue[] = [];
	const floors: CompiledFloor[] = [];
	const rooms: CompiledRoom[] = [];
	const queryBuilder = createQueryGeometryBuilder();

	const objects = compileObjects(source.objects, issues, queryBuilder, reuse);

	// Per-floor loop (P23 review round 1 / B1): every floor is compiled, not
	// only the first. Each floor compiles its own rooms with its own elevation
	// frame, and issue paths use the `floors[i].rooms[j]` form.
	for (const [floorIndex, floorEntry] of source.floors.entries()) {
		const floor = floorEntry.floor;
		const floorRoomIds: string[] = [];
		// The Floor no longer carries a vertical extent, so a storey
		// scalar is kept only as a *cache-key dependency* where a source supplies
		// one (wall-first supplies each Room's derived ceiling instead). Keys for
		// sources without a storey height are therefore unchanged.
		const floorCeilingDependencies: number[] = [];
		let floorMin: Vec3 = [Infinity, Infinity, Infinity];
		let floorMax: Vec3 = [-Infinity, -Infinity, -Infinity];

		for (const [roomIndex, roomSource] of floorEntry.rooms.entries()) {
			const path = `floors[${floorIndex}].rooms[${roomIndex}]`;
			// P23.6I D7 (review closeout) — a Room with no vertical datum
			// (neither a derived ceiling nor a supplied Floor height) never acquires
			// an invented ceiling: skip it and block by name instead of compiling a
			// fake zero-height Room at the elevation. No current source supplies a
			// Floor height, so this is the only branch a format-6 Room can reach.
			if (roomSource.ceilingElevation === undefined && floor.height === undefined) {
				issues.push({
					path: `${path}.boundary`,
					code: 'room_ceiling_undefined',
					message: `Room '${roomSource.room.id}' has no resolvable boundary Wall to derive a ceiling from`,
					targetId: roomSource.room.id
				});
				continue;
			}
			// The core's Room compile is keyed by the identity
			// of the `CompilerRoomSource` it was handed. That value IS the complete
			// input of `prepareLayoutRoomSegments` + validation + `compileRoom`, so
			// an identical source object proves an identical result without
			// re-deriving a second signature: the caller's own retention (the
			// wall-first adapter's room-source store) decides whether the source
			// object is the one this compile built last time.
			const retainedRoom = reuse?.roomCompiles.get(roomSource);
			if (reuse && retainedRoom) {
				reuse.counters.roomsReused += 1;
				pushRetainedRecords(queryBuilder, retainedRoom.records);
				for (const issue of retainedRoom.issues) issues.push(issue);
				const compiled = retainedRoom.compiled;
				if (!compiled) continue;
				rooms.push(compiled);
				floorRoomIds.push(roomSource.room.id);
				floorCeilingDependencies.push(compiled.ceilingElevation);
				includeBounds3(floorMin, floorMax, compiled.bounds3.min, compiled.bounds3.max);
				continue;
			}
			if (reuse) reuse.counters.roomsEvaluated += 1;
			const prepared = prepareLayoutRoomSegments(
				{ id: roomSource.room.id, boundary: roomSource.boundary },
				path,
				roomSource.preSampled
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
			if (hasBlockingLayoutIssues(roomIssues)) {
				if (reuse) {
					reuse.roomCompiles.set(roomSource, {
						source: roomSource,
						compiled: null,
						stripped: null,
						records: noQueryRecords(),
						issues: roomIssues
					});
				}
				continue;
			}

			// The Room's records go to their own builder so they can be retained and
			// spliced back into `queryBuilder` in the same position next time.
			const roomQueryBuilder = createQueryGeometryBuilder();
			const compiledRoom = compileRoom(
				roomSource,
				floor,
				prepared.segments as SampledSegment[],
				roomQueryBuilder,
				recordMode
			);
			pushRetainedRecords(queryBuilder, roomQueryBuilder);
			if (reuse) {
				reuse.roomCompiles.set(roomSource, {
					source: roomSource,
					compiled: compiledRoom,
					stripped: { ...compiledRoom, walls: [], openings: [] },
					records: roomQueryBuilder,
					issues: roomIssues
				});
			}
			rooms.push(compiledRoom);
			floorRoomIds.push(roomSource.room.id);
			floorCeilingDependencies.push(compiledRoom.ceilingElevation);
			includeBounds3(floorMin, floorMax, compiledRoom.bounds3.min, compiledRoom.bounds3.max);
		}

		// The object × Room join is an id-set membership test,
		// not a scan over the floor's Rooms per object.
		const floorRoomIdSet = new Set(floorEntry.rooms.map((roomSource) => roomSource.room.id));
		for (const object of objects) {
			if (!object.roomId) continue;
			countWork('pairs:object-room', 1);
			if (floorRoomIdSet.has(object.roomId)) includeBounds3(floorMin, floorMax, object.worldAabb.min, object.worldAabb.max);
		}

		const compiledFloorBounds = finiteBounds3(floorMin, floorMax);
		floors.push({
			id: geometryId(['floor', floor.id]),
			// `physical-wall` callers replace this floor record after expanding
			// bounds with physical Walls and Junctions; skipping the intermediate
			// key and AABB avoids serializing `floorRoomIds` twice per compile.
			cacheKey:
				recordMode === 'physical-wall'
					? ''
					: cacheKeyOf([
							'floor',
							floor.id,
							floor.elevation,
							floor.height ?? floorCeilingDependencies,
							floorRoomIds,
							compiledFloorBounds
						]),
			floorId: floor.id,
			elevation: floor.elevation,
			roomIds: floorRoomIds,
			bounds3: compiledFloorBounds
		});
		if (recordMode !== 'physical-wall') {
			emitBoundsAabb(queryBuilder, 'floor', floor.id, ['floor', floor.id], floorMin, floorMax);
		}
	}

	let documentMin: Vec3 = [Infinity, Infinity, Infinity];
	let documentMax: Vec3 = [-Infinity, -Infinity, -Infinity];
	for (const room of rooms) includeBounds3(documentMin, documentMax, room.bounds3.min, room.bounds3.max);
	for (const object of objects) includeBounds3(documentMin, documentMax, object.worldAabb.min, object.worldAabb.max);
	const documentBounds = finiteBounds3(documentMin, documentMax);
	if (documentBounds && recordMode !== 'physical-wall') {
		queryBuilder.aabbs.push(aabbRecord('document', 'document', ['document'], documentBounds.min, documentBounds.max));
	}

	const geometry: CompiledLayoutGeometry = {
		regions: [],
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
