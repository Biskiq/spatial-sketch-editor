import type { Vec3 } from './types';
import type { LayoutVec2 } from './layout-coordinates';
import type { LayoutDocumentWallFirst, LayoutObject } from './layout-wall-first-types';
import type {
	CompilerFloorEntry,
	CompilerFloorSource,
	CompilerOpening,
	CompilerRoomSource,
	CompilerSource,
	CompiledCurveSample,
	CompiledFloor,
	CompiledJunction,
	CompiledJunctionLeg,
	CompiledLegJoin,
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
	CompilerBoundarySource,
	LayoutBounds2,
	LayoutBounds3,
	LayoutGeometryIssue
} from './layout-geometry-types';
import { geometryId } from './layout-geometry-types';
import { junctionSeamFailureOf } from './layout-junction-clearance';
import {
	compiledJunctionId,
	endpointSolidBands,
	JUNCTION_BAND_EPSILON,
	resolveJunctionGeometry
} from './layout-junction-resolution';
import { countWork, p2311Measure } from './p2311-perf';
import { cacheKeyDependency, cacheKeyOf, type CacheKeyDependency } from './layout-geometry-keys';
import {
	beginLayoutCompile,
	createLayoutCompileReuse,
	finishLayoutCompile,
	noQueryRecords,
	pruneLayoutCompileReuse,
	sameAuthored,
	type LayoutCompileReuse,
	type LayoutCompileStats,
	type RetainedJunction,
	type RetainedObject,
	type RetainedQueryRecords,
	type RetainedRoom,
	type RetainedWall
} from './layout-geometry-reuse';
import {
	pointAlongSamples,
	sampleSegment,
	segmentVertexPoints,
	type SampleableSegment,
	type SampledSegment
} from './layout-geometry-curve';
import { wallCenterlineSegment, wallCenterlineSamples, type WallSamplingDerivation } from './layout-wall-centerline';
import { deriveLayoutWallRoles } from './layout-wall-role';
import {
	WALL_OFFSET_FOLD_CODE,
	WALL_OFFSET_FOLD_MESSAGE,
	WALL_OFFSET_OVERLAP_CODE,
	WALL_OFFSET_OVERLAP_MESSAGE,
	wallOffsetClearanceFailure
} from './layout-wall-offset-clearance';
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
 * Compile the authored Layout once into render-neutral geometry consumed by
 * Plan, editor 3D, and visitor 3D. Pure, deterministic, non-mutating,
 * visitor-safe. T1.P02.S05 retired the legacy adapter: every document is wall-first
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
	// Work observation (inert without an observer): one compile evaluates every
	// authored entity, which is what the S06 count oracles compare against.
	// The per-entity evaluation counts below it are the incremental compiler's
	// own oracle: `compile:walls` counts the document, `reuse:*` counts what was
	// actually rebuilt.
	countWork('compile');
	countWork('compile:walls', document.walls.length);
	countWork('compile:junctions', document.junctions.length);
	countWork('compile:openings', document.openings.length);
	countWork('compile:rooms', document.rooms.length);
	if (!reuse) return p2311Measure('compile', () => compileWallFirstLayoutGeometryOnce(document, sampling));
	// T1.P02.S06 D.3 (H1) — an incremental compile reports its own work: how many
	// entities the canonical builders ran for, how many retained values were
	// installed by reference, and how many structural comparisons that took.
	const cold = reuse.walls.size === 0 && reuse.roomSources.size === 0;
	beginLayoutCompile(reuse);
	const result = p2311Measure('compile', () => compileWallFirstLayoutGeometryOnce(document, sampling, reuse));
	const stats = finishLayoutCompile(reuse, cold);
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

	// P23B.4 M-1: segment-identity map serving the shared-core room validation
	// from the chain derivation. One map for all rooms is sound: segment objects
	// are created fresh per room above, so identity lookup can never alias rooms.
	const preSampled = new Map<SampleableSegment, SampledSegment>();
	// T1.P02.S06 D.1 (H3) — the Room × Opening join is an id index, not a scan:
	// `document.openings` is grouped once and each Room reads only its own
	// boundary Walls' openings. That read is boundary-ordered, so the compiled
	// Room's Opening list is restored to document order below; together the two
	// keep every compiled Opening list unchanged.
	const openingsByHostWallId = openingsGroupedByWallId(document.openings);
	// T1.P02.S06 D.1 (H3) — position of each Opening in `document.openings`. The
	// join below reads the boundary (so it only visits this Room's own Openings),
	// which is boundary order, not document order; the compiled Room's Opening
	// list is document-ordered, so it is restored by this index rather than by a
	// second scan of every Opening for every Room.
	const openingOrderById = new Map(document.openings.map((opening, index) => [opening.id, index]));
	// T1.P02.S06 D.3 (H1) — the Room-input pass is its own span, because in an
	// incremental compile it is the O(R) comparison term rather than the O(k)
	// evaluation term, and the two must stay separable in an attribution.
	const rooms: CompilerRoomSource[] = p2311Measure('incremental:room-inputs', () => document.rooms.map((room) => {
		// T1.P02.S06 D.3 (H1) — the retained Room **input** is compared before it
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
					// fallback (`wallThickness: document.walls[0]?.thickness ?? 0.1`),
					// which lands in the compiled Room's own `wallThickness` and key.
					// Editing that Wall therefore moves every Room's output, even when
					// the edited Wall is not on this Room's boundary.
					document.walls[0]?.thickness ?? 0.1,
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
					})
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
		const segments: SampleableSegment[] = [];
		const roomOpenings: CompilerOpening[] = [];
		// P23.11 — reverse-ref Opening offsets mirror by the **sampled arc
		// length** of the host Wall's canonical centerline, never the Euclidean
		// chord (straight Walls keep the identical chord value).
		const arcLengthByWallId = new Map<string, number>();
		// First reference per Wall, which is the reference the Opening join used
		// when it scanned the boundary per Opening.
		const traversalByWallId = new Map<string, 'forward' | 'reverse'>();
		for (const ref of room.boundary) {
			const wall = wallById.get(ref.wallId);
			if (!wall) continue; // reference integrity is the codec's job
			const start = pointById.get(wall.startJunctionId);
			const end = pointById.get(wall.endJunctionId);
			if (!start || !end) continue;
			// The Room boundary chain must connect ref-to-ref, so the segment
			// follows the ref's traversal direction (reverse swaps endpoints).
			// The shared compiler core measures opening offsets from each
			// boundary segment's start, so reverse refs also mirror offsets
			// (o' = L − (o + w)) to keep them measured from the canonical
			// Wall start downstream. P23.11: the centerline adapter supplies
			// the segment, so curved Walls flow through the curve kernel
			// unchanged (no second sampling path).
			const reversed = ref.direction === 'reverse';
			// Canonical endpoints + traversal flag: the adapter alone decides the
			// walk direction, so a reversed ref cannot pair the chain with the
			// wrong knot order (P23.11 slice 2).
			const segment = wallCenterlineSegment(wall, start, end, reversed ? 'reverse' : 'forward');
			segments.push(segment);
			if (sampling) {
				// P23B.4 M-1: serve the room-validation sampling below from the
				// shared derivation (same key the face/topology gates use). Omitted
				// from the map when the seam yields undefined so the core keeps its
				// sampling-failed issue path exactly.
				const pre = sampling.samples(wall, start, end, reversed ? 'reverse' : 'forward');
				if (pre) preSampled.set(segment, pre);
			}
			if (!arcLengthByWallId.has(wall.id)) {
				// Mirroring always measures along the CANONICAL traversal: an
				// Opening offset is authored from the Wall's own start Junction.
				// P23B.4 M-1: `:260` keeps 'forward' — a change here is a behaviour
				// change, so the shared derivation is keyed forward like the seam.
				const sampled = sampling
					? sampling.samples(wall, start, end, 'forward')
					: wallCenterlineSamples(wall, start, end, 'forward');
				if (sampled) arcLengthByWallId.set(wall.id, sampled.length);
				traversalByWallId.set(wall.id, reversed ? 'reverse' : 'forward');
			}
		}
		// The join visits exactly the pairs it reads: this Room's own Openings.
		for (const ref of room.boundary) {
			const hosted = openingsByHostWallId.get(ref.wallId);
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
					offset: length - (opening.offset + opening.width)
				});
			}
		}
		// Document order, with a repeated boundary Wall keeping both appearances
		// exactly as the per-Opening scan did. `sort` is stable, so openings the
		// index does not know (it cannot happen for a validated document) keep
		// their relative order instead of moving to the front.
		roomOpenings.sort(
			(left, right) => (openingOrderById.get(left.id) ?? Number.MAX_SAFE_INTEGER) - (openingOrderById.get(right.id) ?? Number.MAX_SAFE_INTEGER)
		);
		const derivedCeiling = ceilingElevationByRoomId.get(room.id);
		const source: CompilerRoomSource = {
			room: {
				id: room.id,
				wallThickness: document.walls[0]?.thickness ?? 0.1,
				floorThickness: room.floorThickness,
				ceilingThickness: room.ceilingThickness
			},
			boundary: { closed: true, segments },
			openings: roomOpenings,
			...(sampling ? { preSampled } : {}),
			wallThicknessBySegmentId,
			openingHeightLimitBySegmentId,
			...(derivedCeiling !== undefined ? { ceilingElevation: derivedCeiling } : {})
		};
		if (reuse && retentionKey) reuse.roomSources.set(room.id, { authored: retentionKey, source });
		return source;
	}));

	// D7 is enforced inside the shared core: a Room with no derived ceiling is
	// skipped there with a blocking `room_ceiling_undefined` issue, so no
	// post-hoc issue append is needed here.
	return compileWallFirstWithPhysicalWalls(document, {
		floors: [{ floor: document.floor, rooms }],
		objects: document.objects
	}, sampling, reuse);
}

/** The Floor datum of a wall-first document (one Floor by format contract). */
function floorElevationOf(document: LayoutDocumentWallFirst): number {
	return document.floor.elevation;
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
 * geometry system. It is the single wall-first adapter: only wall-first
 * documents reach it, and direct `compileLayoutGeometrySource` callers keep
 * the historical defaults for any absent optional field.
 */
function compileWallFirstWithPhysicalWalls(
	document: LayoutDocumentWallFirst,
	source: CompilerSource,
	sampling?: WallSamplingDerivation,
	reuse?: LayoutCompileReuse
): CompiledLayoutGeometryResult {
	// T1.P02.S06 D.1 (H3) — the room-derived point, span and Wall/Opening AABB
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
	// T1.P02.S06 D.1 (H3) — one grouping serves every Wall's Opening join below.
	const openingsByHostWallId = openingsGroupedByWallId(document.openings);
	// Where each Wall's query AABB landed, so the Junction-resolution pass below
	// replaces it in place instead of scanning the AABB list per Wall.
	const wallAabbIndexByWallId = new Map<string, number>();
	// T1.P02.S06 D.3 (H1) — per-Wall retention. A Wall unit keeps the authored
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
		// T1.P02.S06 D.3 (H1) — the retained Wall is compared on exactly the
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
		if (reuse) reuse.counters.wallsEvaluated += 1;
		// P23.11 — the canonical centerline adapter maps every Wall (line or
		// auto-bezier) onto the existing curve kernel; no second sampling path.
		const segment = wallCenterlineSegment(wall, start, end, 'forward');
		let sampled: SampledSegment;
		// P23B.4 M-1: the physical loop serves the same forward key the arc-length
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
		// T1.P02.S06 D.1 (H3) — Wall × Opening through the same id index the Room
		// join uses, instead of a full `document.openings` scan per Wall. The
		// index preserves document order, so each Wall's Opening list is unchanged.
		countWork('pairs:wall-opening', hostedOpenings.length);
		const wallOpenings: CompilerOpening[] = hostedOpenings.map((opening) => ({ ...opening, segmentId: opening.wallId }));
		// The host Wall's **geometry** dependency: built once and embedded by
		// reference in every Opening key rather than re-encoded per Opening.
		//
		// T1.P02.S06 (H4 prerequisite) — this used to name the Wall's *identity*
		// (`['physical-wall-geometry', floorId, wallId]`), so an Opening's key did
		// not change when the Wall it sits on moved, even though `compileOpening`
		// reads the sampled centerline to derive the Opening's point, tangent,
		// yaw and center polyline. A `cacheKey` is a retention proof, so it must
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
		// P23.6H — the Wall's own authoritative height decides its physical
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
		// P23.11 / Issue #6 — render-safe acceptance. A curved Wall whose local
		// bend is tighter than half its thickness renders as a folded or
		// overlapping solid. That is a property of the compile output, so it is
		// decided HERE, from the very samples the renderers consume, and reported
		// as a blocking issue before any document or history commit. Straight
		// Walls are skipped: their offsets are two parallel polylines with
		// identical tangents, so neither branch of the predicate can fire.
		// The gate's results are collected per Wall so they can be retained with it
		// and replayed in document order by a reused Wall (H1).
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
	// P23.15 — compile canonical Junction topology: canonical incidence + the
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
	// T1.P02.S06 D.3 (H1) — the final extent is computed **from the retained
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
			// record; T1.P02.S06 D.1 (H3) recorded its position, so this is one
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
	const bounds = documentMin && documentMax ? finiteBounds3(documentMin, documentMax) : null;
	// Strip room-path wall detail for wall-first documents: rooms keep
	// identity, floor/ceiling semantics, floor polygons and bounds, but their
	// `walls`/`openings` are views the canonical collection now owns. Every
	// physical Wall therefore has exactly one compiled + query representation.
	// T1.P02.S06 D.3 (H1) — an unchanged Room's stripped view is retained too, so
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
			junctions,
			queries: {
				points: queryBuilder.points,
				spans: queryBuilder.spans,
				polygons: queryBuilder.polygons,
				aabbs
			},
			bounds
		},
		issues: [...result.issues, ...wallIssues]
	};
}

/**
 * P23.15 Task 1/2 — build the compiled Junction records from canonical
 * incidence and resolve each Junction locally. `bottomY`/`topY` on a leg are
 * wall-local (0 = Wall base), matching compiled section coordinates; bounds3
 * adds `floorElevation`.
 */
function compileWallFirstJunctions(
	document: LayoutDocumentWallFirst,
	walls: readonly CompiledPhysicalWall[],
	floorElevation: number,
	issues: LayoutGeometryIssue[],
	reuse?: LayoutCompileReuse,
	legsByWallId?: ReadonlyMap<string, { start?: CompiledJunctionLeg; end?: CompiledJunctionLeg }>
): CompiledJunction[] {
	const pointById = new Map(document.junctions.map((junction) => [junction.id, junction.point]));
	const legsByJunction = new Map<string, CompiledJunctionLeg[]>();
	const pushLeg = (junctionId: string, leg: CompiledJunctionLeg): void => {
		const list = legsByJunction.get(junctionId);
		if (list) list.push(leg);
		else legsByJunction.set(junctionId, [leg]);
	};
	for (const wall of walls) {
		if (wall.samples.length < 2) continue;
		// T1.P02.S06 D.3 (H1) — a retained Wall already carries its endpoint legs,
		// derived when the Wall was compiled, so the Junction pass never re-derives
		// one per Wall per compile.
		const retainedLegs = legsByWallId?.get(wall.wallId);
		if (retainedLegs) {
			const startId = wall.startJunctionId;
			const endId = wall.endJunctionId;
			if (retainedLegs.start && startId && pointById.has(startId)) pushLeg(startId, retainedLegs.start);
			if (retainedLegs.end && endId && pointById.has(endId)) pushLeg(endId, retainedLegs.end);
			continue;
		}
		if (wall.startJunctionId && pointById.has(wall.startJunctionId)) {
			pushLeg(wall.startJunctionId, junctionLeg(wall, 'start'));
		}
		if (wall.endJunctionId && pointById.has(wall.endJunctionId)) {
			pushLeg(wall.endJunctionId, junctionLeg(wall, 'end'));
		}
	}
	const junctions: CompiledJunction[] = [];
	for (const [junctionId, legs] of legsByJunction) {
		const point = pointById.get(junctionId);
		if (!point) continue;
		// Cyclic adjacency order only — never physical ownership (Decision 4).
		legs.sort(
			(a, b) =>
				a.outwardAngle - b.outwardAngle ||
				(a.wallId < b.wallId ? -1 : a.wallId > b.wallId ? 1 : 0) ||
				(a.end < b.end ? -1 : a.end > b.end ? 1 : 0)
		);
		// T1.P02.S06 D.3 (H1) — a Junction's resolved geometry is a function of its
		// point, the endpoint facts of every incident Wall leg, the Floor id (its
		// compiled id is `compiledJunctionId(floor.id, junctionId)`) and the Floor
		// elevation (its `bounds3` vertical extent). All four are in hand here, so
		// an unchanged set reuses the retained resolution (and its issues,
		// replayed in the same order).
		const junctionAuthored = [point, legs, document.floor.id, floorElevationOf(document)];
		if (reuse) reuse.counters.signatureVisits += 1;
		const retainedJunction = reuse?.junctions.get(junctionId);
		if (reuse && retainedJunction && sameAuthored(retainedJunction.authored, junctionAuthored)) {
			reuse.counters.junctionsReused += 1;
			junctions.push(retainedJunction.compiled);
			for (const issue of retainedJunction.issues) issues.push(issue);
			continue;
		}
		if (reuse) reuse.counters.junctionsEvaluated += 1;
		const junctionIssues: LayoutGeometryIssue[] = [];
		const resolved = resolveJunctionGeometry(junctionId, point, legs);
		junctionIssues.push(...resolved.issues);
		// P23.15 — canonical seam acceptance. Validity is decided HERE, from the
		// resolved geometry the renderers consume, so a mesh builder is never the
		// first place a seam failure is discovered. The resolution already reports
		// a fold (it needs that fact for control flow); this de-duplicates by code
		// so one Junction never produces the same issue twice.
		const seam = junctionSeamFailureOf({ junctionId, point, legs, resolution: resolved.resolution });
		if (seam && !resolved.issues.some((issue) => issue.code === seam.code)) {
			junctionIssues.push({ path: `junctions.${junctionId}`, code: seam.code, message: seam.message, targetId: junctionId });
		}
		for (const issue of junctionIssues) issues.push(issue);
		const minBand = Math.min(...legs.map((leg) => leg.bottomY));
		const maxBand = Math.max(...legs.map((leg) => leg.topY));
		const resolvedJunction: CompiledJunction = {
			id: compiledJunctionId(document.floor.id, junctionId),
			cacheKey: cacheKeyOf([
				'compiled-junction',
				document.floor.id,
				junctionId,
				point,
				// Every resolution-affecting endpoint fact: thickness, frame, extent,
				// role and the compiled Opening facts (solid bands). A changed endpoint
				// Opening height/sill therefore changes the key even when
				// `endpointOpen` stays `true`, which is exactly when the resolved
				// Junction geometry changes. `legs` is already in deterministic
				// (adjacency-angle, wallId) order, so the serialization is stable.
				legs.map((leg) => ({
					wallId: leg.wallId,
					end: leg.end,
					tangentOut: leg.tangentOut,
					normalOut: leg.normalOut,
					thickness: leg.thickness,
					bottomY: leg.bottomY,
					topY: leg.topY,
					role: leg.role,
					endpointOpen: leg.endpointOpen,
					endpointSolidBands: leg.endpointSolidBands.map((band) => [band.bottomY, band.topY, band.solid, band.openingId ?? null])
				}))
			]),
			junctionId,
			point,
			legs,
			resolution: resolved.resolution,
			bounds3: {
				min: [resolved.resolution.bounds2.min[0], floorElevation + minBand, resolved.resolution.bounds2.min[1]],				max: [resolved.resolution.bounds2.max[0], floorElevation + maxBand, resolved.resolution.bounds2.max[1]]
				}
			};
		junctions.push(resolvedJunction);
		if (reuse) reuse.junctions.set(junctionId, { authored: junctionAuthored, compiled: resolvedJunction, issues: junctionIssues });
	}
	junctions.sort((a, b) => (a.junctionId < b.junctionId ? -1 : a.junctionId > b.junctionId ? 1 : 0));
	return junctions;
}

/** One compiled Junction leg: outward frame + endpoint solid/Opening facts. */
function junctionLeg(wall: CompiledPhysicalWall, end: 'start' | 'end'): CompiledJunctionLeg {
	const first = wall.samples[0]!;
	const last = wall.samples.at(-1)!;
	const sign = end === 'start' ? 1 : -1;
	const tangent = end === 'start' ? first.tangent : last.tangent;
	const normal = end === 'start' ? first.normal : last.normal;
	const tangentOut: LayoutVec2 = [sign * tangent[0], sign * tangent[1]];
	const normalOut: LayoutVec2 = [sign * normal[0], sign * normal[1]];
	const atDistance = end === 'start' ? 0 : (last.distance ?? 0);
	const length = last.distance ?? 0;
	const endpointOpen =
		end === 'start'
			? wall.openings.some((opening) => opening.offset <= JUNCTION_BAND_EPSILON)
			: wall.openings.some((opening) => opening.offset + opening.width >= length - JUNCTION_BAND_EPSILON);
	return {
		wallId: wall.wallId,
		end,
		tangentOut,
		normalOut,
		outwardAngle: Math.atan2(tangentOut[1], tangentOut[0]),
		thickness: wall.thickness,
		halfThickness: wall.thickness / 2,
		bottomY: 0,
		topY: wall.height,
		role: wall.role,
		endpointOpen,
		endpointSolidBands: endpointSolidBands(wall.sections, atDistance, wall.height)
	};
}

/** Wall id → its resolved Junction joins (at most one per end). */
function junctionJoinsByWall(junctions: readonly CompiledJunction[]): Map<string, CompiledLegJoin[]> {
	const map = new Map<string, CompiledLegJoin[]>();
	for (const junction of junctions) {
		for (const join of junction.resolution.joins) {
			const list = map.get(join.wallId);
			if (list) list.push(join);
			else map.set(join.wallId, [join]);
		}
	}
	return map;
}

/** Plan extent of a Wall's resolved end geometry (miters/bevels can exceed the sampled band). */
function wallEndExpansion(joins: readonly CompiledLegJoin[] | undefined): { min: LayoutVec2; max: LayoutVec2 } | undefined {
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
function includeBounds2(bounds: LayoutBounds2, min: LayoutVec2, max: LayoutVec2): void {
	bounds.min[0] = Math.min(bounds.min[0], min[0]);
	bounds.min[1] = Math.min(bounds.min[1], min[1]);
	bounds.max[0] = Math.max(bounds.max[0], max[0]);
	bounds.max[1] = Math.max(bounds.max[1], max[1]);
}

/**
 * Query records for one canonical physical Wall — no fake `roomId`.
 *
 * Returns the records instead of pushing them into the shared builder so the
 * incremental compile (H1) can retain them with the Wall and splice them back in
 * document order without rebuilding; the shared builder receives exactly those
 * records in the same order.
 */
function emitPhysicalWallQueryRecords(
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
function pushRetainedRecords(builder: QueryGeometryBuilder, records: RetainedQueryRecords): void {
	for (const record of records.points) builder.points.push(record);
	for (const record of records.spans) builder.spans.push(record);
	for (const record of records.polygons) builder.polygons.push(record);
	for (const record of records.aabbs) builder.aabbs.push(record);
}

/** A Wall's own extent expanded by its resolved end geometry (plan). */
function expandBounds2(base: LayoutBounds2, expansion: { min: LayoutVec2; max: LayoutVec2 }): LayoutBounds2 {
	return {
		min: [Math.min(base.min[0], expansion.min[0]), Math.min(base.min[1], expansion.min[1])],
		max: [Math.max(base.max[0], expansion.max[0]), Math.max(base.max[1], expansion.max[1])]
	};
}

/** A Wall's own extent expanded by its resolved end geometry (world). */
function expandBounds3(
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

/**
 * An incremental compile session (T1.P02.S06 D.3 / H1).
 *
 * The session owns one retained store and feeds it the documents it compiles.
 * Each `compile` is the **canonical compiler** — same builders, same assembly,
 * same ordering — consulting retained per-entity units at each entity boundary:
 * an entity whose authored inputs are unchanged returns its previous value by
 * reference, and one whose inputs moved is rebuilt by the same code as always.
 * There is no second algorithm and no second output shape, so a session result
 * and a cold-compile result of the same document are equal by construction;
 * the heavy differential proves it over an exhaustive edit sweep.
 *
 * Work: the traversal and comparison are O(N) per compile and cheap (authored
 * scalars); the *evaluation* — sampling, section splitting, Opening compilation,
 * Room validation, Junction resolution, query records — is O(k) in the entities
 * the edit touched. `stats()` reports both sides, and `prune` keeps the store
 * bounded by the current document so a long session cannot accumulate units for
 * entities that no longer exist.
 *
 * Callers that cannot hold state (`admitSource`, a one-shot script) keep calling
 * `compileWallFirstLayoutGeometry` without a store and get exactly today's
 * cold compile.
 */
export type LayoutCompileSession = {
	/** Compile `document`, reusing every entity whose authored inputs are unchanged. */
	compile(document: LayoutDocumentWallFirst, sampling?: WallSamplingDerivation): CompiledLayoutGeometryResult;
	/** Work counts from the most recent compile. */
	stats(): LayoutCompileStats;
	/** Units released because their entity left the document, on the last compile. */
	released(): number;
	/** Drop every retained unit: the next compile is a cold compile. */
	reset(): void;
	/** How many retained units the store currently holds, per entity class. */
	retained(): { walls: number; junctions: number; rooms: number; objects: number };
};

/** Create one incremental session; it compiles once per call and never throws on reuse. */
export function createLayoutCompileSession(): LayoutCompileSession {
	let store = createLayoutCompileReuse();
	let releasedUnits = 0;
	return {
		compile(document, sampling) {
			releasedUnits = pruneLayoutCompileReuse(store, document);
			return compileWallFirstLayoutGeometry(document, sampling, store);
		},
		stats: () => store.stats,
		released: () => releasedUnits,
		reset() {
			store = createLayoutCompileReuse();
			releasedUnits = 0;
		},
		retained: () => ({
			walls: store.walls.size,
			junctions: store.junctions.size,
			rooms: store.roomSources.size,
			objects: store.objects.size
		})
	};
}

/**
 * The session bound for the current synchronous authoring step, if any.
 *
 * The precision planners are the compiler's other hot caller: one plan per
 * pointer sample, each of which compiles its candidate. They are a library of
 * individually exported, synchronous functions with positional signatures, so
 * the session reaches them through this one documented binding rather than an
 * extra parameter on seventeen entry points and every test that calls one.
 *
 * It is deliberately **not** ambient across events: {@link withLayoutCompileSession}
 * binds it, runs a synchronous body and clears it in `finally`. A nested bind is
 * refused instead of shadowing, so a plan can never inherit another surface's
 * store. Planners return values, never promises, so nothing can observe the
 * binding across an `await`.
 */
let boundCompileSession: LayoutCompileSession | null = null;

/** The session bound to this synchronous step, or `undefined` outside one. */
export function activeLayoutCompileSession(): LayoutCompileSession | undefined {
	return boundCompileSession ?? undefined;
}

/**
 * Run one synchronous authoring step with `session` bound to the canonical
 * compiler. Without a session the body simply runs (today's cold compile).
 */
export function withLayoutCompileSession<T>(session: LayoutCompileSession | undefined, body: () => T): T {
	if (!session) return body();
	if (boundCompileSession) {
		throw new Error('a layout compile session is already bound to this synchronous step');
	}
	boundCompileSession = session;
	try {
		return body();
	} finally {
		boundCompileSession = null;
	}
}

/**
 * Shared compile core (P23.0 compiler cutover): one geometry compiler/output
 * model. `compileWallFirstLayoutGeometry` is its only adapter since T1.P02.S05;
 * a direct caller may still supply any `CompilerSource` shape, whose optional
 * fields keep their historical defaults. Diagnostics paths remain room-indexed
 * (`rooms[i]`) so existing issue expectations are unchanged.
 */
/**
 * Which query-record set the shared core emits for Room boundary walls.
 *
 * - `room` (default) is the historical room-indexed set: points, spans and
 *   Wall/Opening AABBs carrying `roomId`.
 * - `physical-wall` emits only what the wall-first adapter keeps — Room floor
 *   polygons and Room AABBs — because that adapter replaces every room-derived
 *   point, span and Wall/Opening AABB with the canonical physical-Wall set.
 *
 * T1.P02.S06 D.1 (H3): the wall-first adapter used to build the discarded set
 * and then drop it, which Bench 1 counted as most of a grid-L compile's
 * cache-key characters and geometry work.
 */
export type LayoutGeometryCompileOptions = {
	readonly queryRecords?: 'room' | 'physical-wall';
};

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
		// P23.6I — the Floor no longer carries a vertical extent, so a storey
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
			// T1.P02.S06 D.3 (H1) — the core's Room compile is keyed by the identity
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

		// T1.P02.S06 D.1 (H3) — the object × Room join is an id-set membership test,
		// not a scan over the floor's Rooms per object.
		const floorRoomIdSet = new Set(floorEntry.rooms.map((roomSource) => roomSource.room.id));
		for (const object of objects) {
			if (!object.roomId) continue;
			countWork('pairs:object-room', 1);
			if (floorRoomIdSet.has(object.roomId)) includeBounds3(floorMin, floorMax, object.worldAabb.min, object.worldAabb.max);
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

/**
 * Group authored Openings by hosting Wall id, preserving document order inside
 * each group. T1.P02.S06 D.1 (H3): one grouping replaces the Room × Opening and
 * Wall × Opening scans (`find` / `filter` per Room and per Wall).
 */
function openingsGroupedByWallId<TOpening extends { readonly wallId: string }>(
	openings: readonly TOpening[]
): Map<string, TOpening[]> {
	const byWallId = new Map<string, TOpening[]>();
	for (const opening of openings) {
		const list = byWallId.get(opening.wallId);
		if (list) list.push(opening);
		else byWallId.set(opening.wallId, [opening]);
	}
	return byWallId;
}

function compileRoom(
	roomSource: CompilerRoomSource,
	floor: CompilerFloorSource,
	sampledSegments: SampledSegment[],
	queryBuilder: QueryGeometryBuilder,
	recordMode: 'room' | 'physical-wall'
): CompiledRoom {
	const room = roomSource.room;
	const floorElevation = floor.elevation;
	// P23.6I — a wall-first Room carries its derived ceiling (`floor.elevation +
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
		// T1.P02.S06 D.1 (H3) — the segment's dependency key is built once and
		// embedded by reference in this Wall's key and in every hosted Opening's
		// key, instead of being re-serialized and re-escaped at each level.
		const segmentDependency = cacheKeyDependency(cacheKeyOf([
			'segment-geometry',
			floor.id,
			room.id,
			segment
		]));
		const sections = splitSampledWallAroundOpenings(sampled, segment, openings, roomVerticalExtent);
		const compiledOpenings = openings.map((opening) =>
			compileOpening(opening, sampled, floor.id, room.id, segmentDependency)
		);
		const solidSpans = buildSolidSpans(sampled.samples, sections);
		const solidCenterlinePolylines = wallPolylinesAroundOpenings(sampled.samples, openings);
		const wallBounds2Value = wallBounds2(sampled.samples, wallThickness);
		const wallBounds3Value = wallBounds3(sampled.samples, wallThickness, floorElevation, ceilingElevation);
		return {
			id: geometryId(['wall', floor.id, room.id, segment.id]),
			cacheKey: cacheKeyOf([
				'wall',
				segmentDependency,
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
		recordMode
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
			// T1.P02.S06 D.1 (H3) — only the thicknesses this Room's own segments
			// read. The whole-document per-Wall thickness map used to be embedded
			// in every Room key, which made one key O(document walls) and a compile
			// O(rooms × walls) characters: at grid-L, 12.8 M of the compile's 97 M
			// key characters came from 196 Room keys. The pairs are ordered by
			// boundary, so the key stays a deterministic function of the Room's own
			// inputs (equal iff equal).
			...(roomSource.wallThicknessBySegmentId
				? [roomSource.boundary.segments.map((segment) => [segment.id, roomSource.wallThicknessBySegmentId?.[segment.id] ?? null] as const)]
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
	opening: CompilerOpening,
	sampled: SampledSegment,
	floorId: string,
	roomId: string,
	segmentDependency: CacheKeyDependency
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

function emitRoomQueryRecords(
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
