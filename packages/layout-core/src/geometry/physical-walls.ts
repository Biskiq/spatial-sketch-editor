import { compileRegions } from '../room/region-compile';
import type { WallSamplingDerivation } from '../wall/centerline';
import { wallCenterlineSegment } from '../wall/centerline';
import type { Vec3 } from '../kernel/types';
import type { LayoutVec2 } from './coordinates';
import type { LayoutDocumentWallFirst } from '../wall/types';
import type { CompiledFloor, CompiledJunctionLeg, CompiledLayoutGeometryResult, CompiledLegJoin, CompiledPhysicalWall, CompiledRoom, CompilerOpening, CompilerSource, LayoutBounds2, LayoutBounds3, LayoutGeometryIssue } from './types';
import { geometryId } from './types';
import { countWork, p2311Measure } from '../kernel/work-observer';
import { cacheKeyDependency, cacheKeyOf } from './keys';
import type { LayoutCompileReuse, RetainedQueryRecords } from './reuse';
import { sameAuthored } from './reuse';
import type { SampledSegment } from './curve';
import { sampleSegment } from './curve';
import { deriveLayoutWallRoles } from '../wall/role';
import { WALL_OFFSET_FOLD_CODE, WALL_OFFSET_FOLD_MESSAGE, WALL_OFFSET_OVERLAP_CODE, WALL_OFFSET_OVERLAP_MESSAGE, wallOffsetClearanceFailure } from '../wall/offset-clearance';
import { splitSampledWallAroundOpenings, wallPolylinesAroundOpenings } from './openings';
import type { QueryGeometryBuilder } from './queries';
import { compileLayoutGeometrySource } from './compiler';
import { compileWallFirstJunctions, junctionJoinsByWall, junctionLeg } from './junctions';
import { aabbRecord, buildWallFirstFloorAndAggregateAabbs, emitPhysicalWallQueryRecords, expandBounds2, expandBounds3, finiteBounds3, includeBounds3, pushRetainedRecords, wallBounds2, wallBounds3 } from './query-records';
import { buildSolidSpans, compileOpening, openingsGroupedByWallId } from './rooms';

/**
 * Wall-first compile with canonical physical-Wall output. Every document Wall compiles exactly
 * once into top-level `geometry.walls` (canonical, wall-start frame, keyed
 * by document-global Wall ID, no fake `roomId`). Room-derived walls are NOT
 * re-emitted: wall-first `CompiledRoom` records keep identity + floor/ceiling
 * semantics + floor polygons (fills, containment, room hits) with empty
 * `walls`/`openings`, and wall/opening span+point+AABB query records come
 * solely from the canonical path. Room-floor polygons, room AABBs, and all
 * validation/issues/floor logic are unchanged, except the aggregate
 * `floors[].bounds3` and `floor`/`document` query AABBs expand to include
 * canonical physical Walls (roomless Walls otherwise leave them stale). One compiler, not a second
 * geometry system. It is the single wall-first adapter: only wall-first
 * documents reach it, and direct `compileLayoutGeometrySource` callers keep
 * the historical defaults for any absent optional field.
 */
export function compileWallFirstWithPhysicalWalls(
	document: LayoutDocumentWallFirst,
	source: CompilerSource,
	sampling?: WallSamplingDerivation,
	reuse?: LayoutCompileReuse
): CompiledLayoutGeometryResult {
	// The room-derived point, span and Wall/Opening AABB
	// records are dropped below in favour of the canonical physical-Wall set, so
	// this adapter asks the shared core not to build them. Bench 1 counted them
	// as 76 M of a grid-L compile's 97 M cache-key characters plus their whole
	// geometry: work whose output never reached a consumer.
	const result = p2311Measure('room-geometry-compile', () =>
		compileLayoutGeometrySource(source, { queryRecords: 'physical-wall' }, reuse)
	);
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
	// Format 6 — the compiled Wall role is DERIVED from Room boundary membership by
	// the one authority that owns the derivation, so compiled facts and the Card
	// fact cannot disagree: `bounding` (one Room), `dividing` (two or more Rooms),
	// `free-standing` (none). Nothing here reads an authored field.
	const derivedWallRoles = deriveLayoutWallRoles(document);
	const physicalWalls: CompiledPhysicalWall[] = [];
	// One grouping serves every Wall's Opening join below.
	const openingsByHostWallId = openingsGroupedByWallId(document.openings);
	// Where each Wall's query AABB landed, so the Junction-resolution pass below
	// replaces it in place instead of scanning the AABB list per Wall.
	const wallAabbIndexByWallId = new Map<string, number>();
	// Per-Wall retention. A Wall unit keeps the authored
	// inputs it was compiled from, its own *unresolved* extent (a re-resolved
	// miter can shrink as well as grow, so the base is what re-expansion starts
	// from), the query records it contributed and its endpoint legs. The legs are
	// what let the Junction pass run from retained facts instead of re-deriving a
	// leg per Wall on every compile.
	const baseBoundsByWallId = new Map<string, { bounds2: LayoutBounds2; bounds3: LayoutBounds3 }>();
	const legsByWallId = new Map<string, { start?: CompiledJunctionLeg; end?: CompiledJunctionLeg }>();
	const authoredByWallId = new Map<string, readonly unknown[]>();
	const recordsByWallId = new Map<string, RetainedQueryRecords>();
	const issuesByWallId = new Map<string, readonly LayoutGeometryIssue[]>();
	// Render-safe acceptance issues (see the per-Wall clearance gate below),
	// appended to the shared compile result so every caller's existing
	// blocking-issue check rejects without a second acceptance path.
	const wallIssues: LayoutGeometryIssue[] = [];
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

	p2311Measure('incremental:wall-pass', () => {
	for (const wall of document.walls) {
		const start = pointById.get(wall.startJunctionId);
		const end = pointById.get(wall.endJunctionId);
		if (!start || !end) continue;
		// The retained Wall is compared on exactly the
		// inputs its compiled output is a function of: the authored Wall, its two
		// endpoint coordinates, the Floor datum, the Openings it hosts, the derived
		// role (a Room boundary change re-roles a Wall) and whether this compile
		// runs on a shared sampling derivation. When all are unchanged the body
		// below — centerline construction, sampling, section splitting, Opening
		// compilation, polylines, bounds and the clearance gate — is skipped.
		const hostedOpenings = openingsByHostWallId.get(wall.id) ?? [];
		const derivedRole = derivedWallRoles.get(wall.id) ?? 'free-standing';
		// The comparison array is built only for a session compile: a cold
		// `compileWallFirstLayoutGeometry` (admission, scripts, tests without a
		// session) must pay nothing for retention it is not using.
		let retentionKey: readonly unknown[] | undefined;
		const retained = reuse?.walls.get(wall.id);
		if (reuse) {
			retentionKey = [wall, start, end, floor.id, floorElevation, hostedOpenings, derivedRole, sampling !== undefined];
			reuse.counters.signatureVisits += 1;
			reuse.counters.entities += 1;
		}
		if (reuse && retained && retentionKey && sameAuthored(retained.authored, retentionKey)) {
			reuse.counters.wallsReused += 1;
			physicalWalls.push(retained.compiled);
			pushRetainedRecords(queryBuilder, retained.records);
			wallAabbIndexByWallId.set(wall.id, queryBuilder.aabbs.length - 1);
			baseBoundsByWallId.set(wall.id, { bounds2: retained.baseBounds2, bounds3: retained.baseBounds3 });
			legsByWallId.set(wall.id, retained.legs);
			authoredByWallId.set(wall.id, retained.authored);
			recordsByWallId.set(wall.id, retained.records);
			issuesByWallId.set(wall.id, retained.issues);
			for (const issue of retained.issues) wallIssues.push(issue);
			continue;
		}
		if (reuse) {
			reuse.counters.wallsEvaluated += 1;
			reuse.counters.openingsEvaluated += hostedOpenings.length;
		}
		// The canonical centerline adapter maps every Wall (line or
		// auto-bezier) onto the existing curve kernel; no second sampling path.
		const segment = wallCenterlineSegment(wall, start, end, 'forward');
		let sampled: SampledSegment;
		// The physical loop serves the same forward key the arc-length
		// site uses. `undefined` keeps the historical skip exactly.
		if (sampling) {
			const shared = sampling.samples(wall, start, end, 'forward');
			if (!shared) continue;
			sampled = shared;
		} else {
			try {
				sampled = sampleSegment(segment);
			} catch {
				continue;
			}
		}
		// Wall × Opening through the same id index the Room
		// join uses, instead of a full `document.openings` scan per Wall. The
		// index preserves document order, so each Wall's Opening list is unchanged.
		countWork('pairs:wall-opening', hostedOpenings.length);
		const wallOpenings: CompilerOpening[] = hostedOpenings.map((opening) => ({ ...opening, segmentId: opening.wallId }));
		// The host Wall's **geometry** dependency: built once and embedded by
		// reference in every Opening key rather than re-encoded per Opening.
		//
		// It names the Wall's geometry, not only its identity
		// (`['physical-wall-geometry', floorId, wallId]`): `compileOpening` reads
		// the sampled centerline to derive the Opening's point, tangent, yaw and
		// center polyline, so an Opening's key must change when the Wall it sits
		// on moves. A `cacheKey` is a retention proof, so it must
		// name every input the Opening's compiled output depends on: the segment
		// (authored centerline plus endpoint coordinates), the Floor datum and
		// the Wall's thickness/height. It costs one key per Wall, not one per
		// Opening, because the result is embedded by reference below.
		const wallGeometryDependency = cacheKeyDependency(cacheKeyOf([
			'physical-wall-geometry',
			floor.id,
			wall.id,
			segment,
			wall.thickness,
			wall.height,
			floor.elevation
		]));
		// The Wall's own authoritative height decides its physical
		// vertical extent (`topY = floor.elevation + wall.height`). Room/Floor
		// envelopes stay Floor-derived; a partial-height Wall never lowers them.
		const wallTop = floorElevation + wall.height;
		const sections = splitSampledWallAroundOpenings(sampled, segment, wallOpenings, wall.height);
		const compiledOpenings = wallOpenings.map((opening) =>
			compileOpening(opening, sampled, floor.id, wall.id, wallGeometryDependency)
		);
		const solidSpans = buildSolidSpans(sampled.samples, sections);
		const solidCenterlinePolylines = wallPolylinesAroundOpenings(sampled.samples, wallOpenings);
		const wallBounds2Value = wallBounds2(sampled.samples, wall.thickness);
		const wallBounds3Value = wallBounds3(sampled.samples, wall.thickness, floorElevation, wallTop);
		const compiled: CompiledPhysicalWall = {
			id: geometryId(['physical-wall', floor.id, wall.id]),
			cacheKey: cacheKeyOf(['physical-wall', floor.id, wall.id, segment, wallOpenings, wall.thickness, floor.elevation, wall.height]),
			wallId: wall.id,
			role: derivedRole,
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
			bounds3: wallBounds3Value,
			startJunctionId: wall.startJunctionId,
			endJunctionId: wall.endJunctionId
		};
		// Render-safe acceptance. A curved Wall whose local
		// bend is tighter than half its thickness renders as a folded or
		// overlapping solid. That is a property of the compile output, so it is
		// decided HERE, from the very samples the renderers consume, and reported
		// as a blocking issue before any document or history commit. Straight
		// Walls are skipped: their offsets are two parallel polylines with
		// identical tangents, so neither branch of the predicate can fire.
		// The gate's results are collected per Wall so they can be retained with it
		// and replayed in document order by a reused Wall.
		const wallClearanceIssues: LayoutGeometryIssue[] = [];
		if (wall.centerline.kind !== 'line') {
			const clearance = p2311Measure('finite-thickness', () => wallOffsetClearanceFailure(compiled.samples, wall.thickness));
			if (clearance) {
				wallClearanceIssues.push({
					path: `walls.${wall.id}`,
					code: clearance === 'fold' ? WALL_OFFSET_FOLD_CODE : WALL_OFFSET_OVERLAP_CODE,
					message: clearance === 'fold' ? WALL_OFFSET_FOLD_MESSAGE : WALL_OFFSET_OVERLAP_MESSAGE,
					targetId: wall.id
				});
			}
		}
		physicalWalls.push(compiled);
		const wallRecords = emitPhysicalWallQueryRecords(
			queryBuilder,
			floor,
			wall,
			sampled,
			compiledOpenings,
			solidSpans,
			reuse !== undefined
		);
		const baseBounds2: LayoutBounds2 = { min: [...wallBounds2Value.min] as LayoutVec2, max: [...wallBounds2Value.max] as LayoutVec2 };
		const baseBounds3: LayoutBounds3 = { min: [...wallBounds3Value.min] as Vec3, max: [...wallBounds3Value.max] as Vec3 };
		const wallAabb = aabbRecord('wall', wall.id, ['wall', floor.id, wall.id], baseBounds3.min, baseBounds3.max);
		queryBuilder.aabbs.push(wallAabb);
		wallAabbIndexByWallId.set(wall.id, queryBuilder.aabbs.length - 1);
		baseBoundsByWallId.set(wall.id, { bounds2: baseBounds2, bounds3: baseBounds3 });
		if (retentionKey) authoredByWallId.set(wall.id, retentionKey);
		if (wallRecords) recordsByWallId.set(wall.id, { ...wallRecords, aabbs: [...wallRecords.aabbs, wallAabb] });
		for (const issue of wallClearanceIssues) wallIssues.push(issue);
		issuesByWallId.set(wall.id, wallClearanceIssues);
		// Endpoint legs are the Junction pass's input; deriving them here means a
		// reused Wall hands over retained facts instead of being re-derived.
		legsByWallId.set(
			wall.id,
			compiled.samples.length < 2
				? {}
				: {
						...(wall.startJunctionId && pointById.has(wall.startJunctionId) ? { start: junctionLeg(compiled, 'start') } : {}),
						...(wall.endJunctionId && pointById.has(wall.endJunctionId) ? { end: junctionLeg(compiled, 'end') } : {})
					}
		);
	}
	});

	physicalWalls.sort((a, b) => (a.wallId < b.wallId ? -1 : a.wallId > b.wallId ? 1 : 0));
	// Compile canonical Junction topology: canonical incidence + the
	// Junction-local resolution. Renderers/visitors consume these facts and never
	// receive the document or solve topology themselves.
	const junctions = p2311Measure('junction-resolution', () =>
		compileWallFirstJunctions(document, physicalWalls, floorElevation, wallIssues, reuse, legsByWallId)
	);
	const joinsByWall = junctionJoinsByWall(junctions);
	// Decision 12 — resolved Junction geometry (miters/bevels, difference steps,
	// trim surfaces, trimmed footprints) expands the **owner Wall's** `bounds2`
	// *and* `bounds3`. The planar expansion used to land without its vertical
	// counterpart, which left `bounds3` — and therefore the Floor aggregate and
	// the wall query AABB — covering less than the emitted mesh.
	//
	// The final extent is computed **from the retained
	// base** rather than by including into the value already held, so reusing a
	// Wall never accumulates an earlier expansion and a miter that shrinks is
	// reflected. When nothing moved the computed extent equals the held one and
	// no object is rebuilt.
	for (const [wallIndex, wall] of physicalWalls.entries()) {
		const base = baseBoundsByWallId.get(wall.wallId);
		if (!base) continue;
		const expansion = wallEndExpansion(joinsByWall.get(wall.wallId));
		const bounds2 = expansion ? expandBounds2(base.bounds2, expansion) : base.bounds2;
		const bounds3 = expansion
			? expandBounds3(base.bounds3, expansion, floorElevation, wall.height)
			: base.bounds3;
		if (!sameAuthored(wall.bounds2, bounds2) || !sameAuthored(wall.bounds3, bounds3)) {
			physicalWalls[wallIndex] = { ...wall, bounds2, bounds3 };
			// The Wall query AABB was created before the Junction resolve, so it is
			// stale by construction once resolved geometry extends the Wall.
			// Reconcile it from the final bounds instead of leaving a pre-resolution
			// record; T1.P02.S06 D.1 recorded its position, so this is one
			// lookup instead of an AABB-list scan per Wall.
			const index = wallAabbIndexByWallId.get(wall.wallId);
			countWork('pairs:wall-aabb', index === undefined ? 0 : 1);
			if (index !== undefined) {
				const wallAabb = aabbRecord('wall', wall.wallId, ['wall', floor.id, wall.wallId], bounds3.min, bounds3.max);
				// Patch the emitted record in place. This is not a session-only
				// path: a cold compile's Wall AABB is created before Junction
				// resolution, so it is stale by construction whenever a miter/bevel
				// extends the Wall, and this is what corrects it.
				queryBuilder.aabbs[index] = wallAabb;
				const records = recordsByWallId.get(wall.wallId);
				if (records) {
					// A retained Wall's own AABB is the last record it contributed.
					recordsByWallId.set(wall.wallId, { ...records, aabbs: [...records.aabbs.slice(0, -1), wallAabb] });
				}
			}
		}
		includePhysicalBounds(bounds3.min, bounds3.max);
	}
	for (const junction of junctions) {
		includePhysicalBounds(junction.bounds3.min, junction.bounds3.max);
	}
	// Retain every Wall this compile resolved: evaluated Walls store their fresh
	// unit; a reused Wall stores only when its final extent moved (its records
	// above were rebuilt, so the retained value must follow).
	if (reuse) {
		for (const wall of physicalWalls) {
			const authored = authoredByWallId.get(wall.wallId);
			const records = recordsByWallId.get(wall.wallId);
			const base = baseBoundsByWallId.get(wall.wallId);
			if (!authored || !records || !base) continue;
			const previous = reuse.walls.get(wall.wallId);
			if (previous && previous.compiled === wall && previous.records === records) continue;
			reuse.walls.set(wall.wallId, {
				authored,
				compiled: wall,
				baseBounds2: base.bounds2,
				baseBounds3: base.bounds3,
				legs: legsByWallId.get(wall.wallId) ?? {},
				records,
				issues: issuesByWallId.get(wall.wallId) ?? []
			});
		}
	}
	const regionUnit = compileRegions(document, reuse);
	queryBuilder.polygons.push(...regionUnit.polygons);
	queryBuilder.aabbs.push(...regionUnit.aabbs);
	if (regionUnit.bounds3) includePhysicalBounds(regionUnit.bounds3.min, regionUnit.bounds3.max);
	const bounds = documentMin && documentMax ? finiteBounds3(documentMin, documentMax) : null;
	// Strip room-path wall detail for wall-first documents: rooms keep
	// identity, floor/ceiling semantics, floor polygons and bounds, but their
	// `walls`/`openings` are views the canonical collection now owns. Every
	// physical Wall therefore has exactly one compiled + query representation.
	// An unchanged Room's stripped view is retained too, so
	// the whole output graph keeps its identity across compiles (the rendering
	// layer's retention proof then compares references rather than rebuilding).
	const strippedByRoomId = new Map<string, CompiledRoom>();
	if (reuse) {
		for (const [roomId, retainedSource] of reuse.roomSources) {
			const retained = reuse.roomCompiles.get(retainedSource.source);
			if (retained?.stripped) strippedByRoomId.set(roomId, retained.stripped);
		}
	}
	const rooms = geometry.rooms.map((room) => strippedByRoomId.get(room.roomId) ?? { ...room, walls: [], openings: [] });
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
	for (const junction of junctions) includeFloorBounds(junction.bounds3.min, junction.bounds3.max);
	if (regionUnit.bounds3) includeFloorBounds(regionUnit.bounds3.min, regionUnit.bounds3.max);
	const floorBounds = floorMin && floorMax ? finiteBounds3(floorMin, floorMax) : null;
	const aabbs = queryBuilder.aabbs.filter((aabb) => aabb.kind !== 'floor' && aabb.kind !== 'document');
	let floors: CompiledFloor[];
	if (geometry.floors.length <= 1 && (!existingFloor || existingFloor.floorId === floor.id)) {
		const built = buildWallFirstFloorAndAggregateAabbs(
			floor,
			existingFloor?.roomIds ?? [],
			floorBounds,
			bounds,
			reuse
		);
		floors = [built.floor];
		if (built.floorAabb) aabbs.push(built.floorAabb);
		if (built.docAabb) aabbs.push(built.docAabb);
	} else {
		const roomIdsDep = cacheKeyDependency(
			cacheKeyOf(['floor-room-ids', existingFloor?.roomIds ?? []])
		);
		floors = geometry.floors.some((candidate) => candidate.floorId === floor.id)
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
									roomIdsDep,
									floorBounds
								])
							}
				)
			: [
					...geometry.floors,
					{
						id: geometryId(['floor', floor.id]),
						cacheKey: cacheKeyOf(['floor', floor.id, floorElevation, roomIdsDep, floorBounds]),
						floorId: floor.id,
						elevation: floorElevation,
						roomIds: [],
						bounds3: floorBounds
					}
				];
		if (floorBounds) {
			aabbs.push(aabbRecord('floor', floor.id, ['floor', floor.id], floorBounds.min, floorBounds.max));
		}
		if (bounds) {
			aabbs.push(aabbRecord('document', 'document', ['document'], bounds.min, bounds.max));
		}
	}
	return {
		geometry: {
			...geometry,
			regions: regionUnit.regions,
			floors,
			rooms,
			walls: physicalWalls,
			junctions,
			queries: {
				points: queryBuilder.points,
				spans: queryBuilder.spans,
				polygons: queryBuilder.polygons,
				aabbs
			},
			bounds
		},
		issues: [...result.issues, ...wallIssues, ...regionUnit.issues]
	};
}


/** Plan extent of a Wall's resolved end geometry (miters/bevels can exceed the sampled band). */
export function wallEndExpansion(joins: readonly CompiledLegJoin[] | undefined): { min: LayoutVec2; max: LayoutVec2 } | undefined {
	if (!joins || joins.length === 0) return undefined;
	let minX = Infinity;
	let minZ = Infinity;
	let maxX = -Infinity;
	let maxZ = -Infinity;
	const consider = (p: LayoutVec2): void => {
		minX = Math.min(minX, p[0]);
		minZ = Math.min(minZ, p[1]);
		maxX = Math.max(maxX, p[0]);
		maxZ = Math.max(maxZ, p[1]);
	};
	for (const join of joins) {
		if (join.corner) {
			for (const side of [join.corner.front, join.corner.back]) {
				if (side.kind === 'miter') consider(side.apex);
				else {
					consider(side.a0);
					consider(side.b0);
				}
			}
		}
		for (const p of join.endBoundary) consider(p);
		if (join.ownedSeam) for (const p of join.ownedSeam.polygon) consider(p);
		for (const surface of join.surfaces ?? []) {
			consider(surface.from);
			consider(surface.to);
		}
	}
	if (!Number.isFinite(minX) || !Number.isFinite(maxX)) return undefined;
	return { min: [minX, minZ], max: [maxX, maxZ] };
}


/** Expand a compiled `LayoutBounds2` in place. */
function _includeBounds2(bounds: LayoutBounds2, min: LayoutVec2, max: LayoutVec2): void {
	bounds.min[0] = Math.min(bounds.min[0], min[0]);
	bounds.min[1] = Math.min(bounds.min[1], min[1]);
	bounds.max[0] = Math.max(bounds.max[0], max[0]);
	bounds.max[1] = Math.max(bounds.max[1], max[1]);
}


/** The Floor datum of a wall-first document (one Floor by format contract). */
export function floorElevationOf(document: LayoutDocumentWallFirst): number {
	return document.floor.elevation;
}
