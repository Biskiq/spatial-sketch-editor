/**
 * `layout-snap.ts` — P23.2 centralized, deterministic Plan snapping resolver.
 *
 * Snap truth derives from the canonical compiled query geometry
 * (`CompiledLayoutGeometry.queries`) plus transient gesture context — Plan/SVG
 * code never reconstructs authored geometry for snapping. There are no
 * persistent snap points in the `LayoutDocument`, no persistent constraints,
 * and a snap result never mutates anything by itself.
 *
 * Deterministic winner order (P23.2 plan §Deterministic winner order):
 *
 * ```text
 * tool/context validity
 * → semantic feature priority
 * → screen distance
 * → stable ID/key
 * ```
 *
 * Source-array/render order is never a hidden tie-break: equal-priority,
 * equal-distance candidates resolve by comparing stable identity keys.
 *
 * Pointer acquisition tolerance is not geometry/topology tolerance — the
 * acquisition radius is a fixed CSS-pixel value converted by the current Plan
 * scale, so acquisition stays zoom-stable (50%/100%/200% acquire the same
 * world features at the same screen distances).
 */
import type { LayoutVec2 } from './layout-types';
import type { CompiledLayoutGeometry, CompiledQuerySpan } from './layout-geometry-types';
import { geometryId } from './layout-geometry-types';
import { classifyWallIntersection, type TopologySegment } from './layout-wall-topology';
import { p2311Measure } from './p2311-perf';

/** Centralized default Plan grid step in meters (P23.2 §Grid step). */
export const LAYOUT_PLAN_GRID_STEP = 0.25;

/** Centralized pointer acquisition radius in CSS pixels (P23.2 H2 default). */
export const LAYOUT_PLAN_SNAP_RADIUS_CSS_PX = 8;

/** Semantic rank per candidate family — lower wins (P23.2 §winner order). */
export type SnapFeatureKind =
	| 'junction'
	| 'wall-midpoint'
	| 'wall-intersection'
	| 'opening-edge'
	| 'wall-span'
	| 'object-bounds-edge'
	| 'object-bounds-center'
	| 'grid'
	| 'orthogonal-guide'
	| 'extension-guide';

const SEMANTIC_RANK: Record<SnapFeatureKind, number> = {
	junction: 0,
	'wall-intersection': 1,
	'wall-midpoint': 2,
	'opening-edge': 3,
	'wall-span': 4,
	'object-bounds-edge': 5,
	'object-bounds-center': 6,
	'orthogonal-guide': 7,
	'extension-guide': 8,
	grid: 9
};

export type SnapOwnerKind = 'object' | 'wall' | 'opening';

/**
 * Typed owner of a snap candidate, used for moving-target exclusion.
 * Collision-safe across entity kinds AND across scopes: an object `foo`, a
 * wall `foo`, and an opening `foo` are all legal and never suppress each
 * other, and legacy wall owners carry their room-qualified `wallKey`, so
 * moving room A's `wall-1` never suppresses room B's independent `wall-1`.
 */
export type SnapOwner = {
	kind: SnapOwnerKind;
	/** Object/opening id, or the qualified wall identity (`wallKey`). */
	id: string;
};

/**
 * Collision-safe serialized owner identity (length-prefixed tuple). All
 * exclusion sets and candidate `ownerId`s use this encoding — plain
 * delimiter joining would collide because ids may contain the delimiter.
 */
export function snapOwnerKey(owner: SnapOwner): string {
	return geometryId([owner.kind, owner.id]);
}

/**
 * Resolve the owner key of one wall segment from the compiled geometry.
 * Wall-first wall ids are document-global (`wallKey === segmentId`); legacy
 * segment ids are only unique inside their room, so the moving wall must be
 * qualified by its room. Falls back to the bare segment id for empty or
 * hand-built geometry.
 */
export function wallOwnerKey(
	geometry: CompiledLayoutGeometry,
	roomId: string,
	segmentId: string
): string {
	for (const span of geometry.queries.spans) {
		if (span.kind !== 'wall' || span.segmentId !== segmentId) continue;
		const roomScoped = span.wallKey !== undefined && span.wallKey !== span.segmentId;
		if (roomScoped && span.roomId !== roomId) continue;
		return snapOwnerKey({ kind: 'wall', id: span.wallKey ?? span.segmentId });
	}
	return snapOwnerKey({ kind: 'wall', id: segmentId });
}

/** Identity of a resolved snap candidate — stable across frames. */
export type SnapCandidate = {
	/** Snapped world point. */
	point: LayoutVec2;
	/** Semantic family. */
	kind: SnapFeatureKind;
	/** Canonical source identity for the winning candidate. */
	sourceId: string;
	/**
	 * Canonical typed owner identity for moving-target exclusion — the
	 * `snapOwnerKey({ kind, id })` of the object, wall, or opening that owns
	 * this candidate. `sourceId` is a composite key
	 * (`${ownerId}#start`, `${ownerId}#0:mid`, ...) so it must never be used
	 * for exclusion; exclusion matches this field exactly. Hand-built
	 * candidates may predate the field and fall back to `sourceId`.
	 */
	ownerId?: string;
	/**
	 * Canonical Wall identity for a `wall-span` candidate. This is carried
	 * through authoring so a snapped endpoint can establish a host relationship
	 * without asking topology to infer one from sampler proximity.
	 */
	wallId?: string;
	/** Distance from the raw pointer, in world units. */
	distance: number;
};

export type SnapInputContext = {
	/**
	 * Exclude candidates owned by these serialized owner keys
	 * (`snapOwnerKey(...)`) — the moving targets.
	 */
	excludeOwners?: ReadonlySet<string>;
	/** Exclude candidates at these exact world points (self-snapping loops). */
	excludePoints?: readonly LayoutVec2[];
	/** Only candidates from these families (tool/context validity filter). */
	allowedKinds?: readonly SnapFeatureKind[];
};

export type SnapQueryContext = {
	/** Plan scale in pixels per world unit (CSS px per meter). */
	pixelsPerMeter: number;
	/** Acquisition radius override in CSS pixels (default 8). */
	snapRadiusCssPx?: number;
	/** Grid step override in meters (default 0.25). */
	gridStep?: number;
};

export type SnapResolution =
	| {
			kind: 'snap';
			candidate: SnapCandidate;
			/** Guides to render for the winning candidate (transient, session-only). */
			guides: SnapGuide[];
	  }
	| { kind: 'none' };

/**
 * One transient guide line. Session state only — never written to the
 * document, cleared by the editor on cancel/tool/authority changes.
 */
export type SnapGuide = {
	kind: 'orthogonal-x' | 'orthogonal-z' | 'extension' | 'segment';
	/** Guide segment endpoints in world space. */
	start: LayoutVec2;
	end: LayoutVec2;
};

/** Convert the fixed CSS-pixel acquisition radius to world units at this zoom. */
export function snapAcquisitionRadiusWorld(context: SnapQueryContext): number {
	const cssPx = context.snapRadiusCssPx ?? LAYOUT_PLAN_SNAP_RADIUS_CSS_PX;
	const ppm = context.pixelsPerMeter;
	if (!Number.isFinite(cssPx) || cssPx <= 0) return 0;
	if (!Number.isFinite(ppm) || ppm <= 0) return 0;
	return cssPx / ppm;
}

/** Snap one free point to the centralized grid step. */
export function snapToGridStep(point: LayoutVec2, step = LAYOUT_PLAN_GRID_STEP): LayoutVec2 {
	if (!Number.isFinite(step) || step <= 0) return [...point];
	return [Math.round(point[0] / step) * step, Math.round(point[1] / step) * step];
}

function excluded(candidate: SnapCandidate, context: SnapInputContext): boolean {
	// Exclusion is by canonical typed owner (`ownerId`), falling back to the
	// raw sourceId only for hand-built candidates that predate the field.
	if (context.excludeOwners?.has(candidate.ownerId ?? candidate.sourceId)) return true;
	if (context.excludePoints) {
		for (const point of context.excludePoints) {
			if (point[0] === candidate.point[0] && point[1] === candidate.point[1]) return true;
		}
	}
	return false;
}

function stableKey(candidate: SnapCandidate): string {
	// `ownerId` participates so identical `sourceId + point` records with
	// different qualified owners (coincident junctions from distinct walls)
	// never fall back to iteration order in the tie-break.
	return `${SEMANTIC_RANK[candidate.kind]}|${candidate.kind}|${candidate.ownerId ?? candidate.sourceId}|${candidate.sourceId}|${candidate.point[0]}|${candidate.point[1]}`;
}

/**
 * Resolve the deterministic winner among candidates:
 * semantic rank → screen distance → stable identity key.
 */
export function pickSnapWinner(
	candidates: readonly SnapCandidate[],
	context: SnapInputContext = {}
): SnapCandidate | null {
	let best: SnapCandidate | null = null;
	let bestKey = '';
	for (const candidate of candidates) {
		if (excluded(candidate, context)) continue;
		if (context.allowedKinds && !context.allowedKinds.includes(candidate.kind)) continue;
		if (!best) {
			best = candidate;
			bestKey = stableKey(candidate);
			continue;
		}
		const rankDiff = SEMANTIC_RANK[candidate.kind] - SEMANTIC_RANK[best.kind];
		const distanceDiff = candidate.distance - best.distance;
		const key = stableKey(candidate);
		if (
			rankDiff < 0 ||
			(rankDiff === 0 && (distanceDiff < 0 || (distanceDiff === 0 && key < bestKey)))
		) {
			best = candidate;
			bestKey = key;
		}
	}
	return best;
}

/**
 * Build endpoint, midpoint, and nearest-span candidates for one straight span.
 * `ownerId` is the moving-target exclusion identity — for merged wall spans
 * this is the bare `segmentId`, never the composite source identity.
 */
export function spanSnapCandidates(
	span: { id: string; start: LayoutVec2; end: LayoutVec2 },
	point: LayoutVec2,
	radius: number,
	ownerId = span.id,
	wallId = span.id
): SnapCandidate[] {
	const candidates: SnapCandidate[] = [];
	const length = Math.hypot(span.end[0] - span.start[0], span.end[1] - span.start[1]);
	const endpoints: Array<[LayoutVec2, 'start' | 'end']> = [
		[span.start, 'start'],
		[span.end, 'end']
	];
	for (const [candidatePoint, key] of endpoints) {
		const distance = Math.hypot(candidatePoint[0] - point[0], candidatePoint[1] - point[1]);
		if (distance <= radius) {
			candidates.push({
				point: [candidatePoint[0], candidatePoint[1]],
				kind: 'junction',
				sourceId: `${span.id}#${key}`,
				ownerId,
				distance
			});
		}
	}
	if (length > 0) {
		const midpoint: LayoutVec2 = [
			(span.start[0] + span.end[0]) / 2,
			(span.start[1] + span.end[1]) / 2
		];
		const distance = Math.hypot(midpoint[0] - point[0], midpoint[1] - point[1]);
		if (distance <= radius) {
			candidates.push({
				point: [midpoint[0], midpoint[1]],
				kind: 'wall-midpoint',
				sourceId: span.id,
				ownerId,
				distance
			});
		}
	}
	const dx = span.end[0] - span.start[0];
	const dz = span.end[1] - span.start[1];
	const squared = dx * dx + dz * dz;
	const rawT = squared > 0 ? ((point[0] - span.start[0]) * dx + (point[1] - span.start[1]) * dz) / squared : 0;
	const amount = Math.min(1, Math.max(0, rawT));
	const projected: LayoutVec2 = [span.start[0] + dx * amount, span.start[1] + dz * amount];
	const projectedDistance = Math.hypot(projected[0] - point[0], projected[1] - point[1]);
	if (projectedDistance <= radius) {
		candidates.push({
			point: [projected[0], projected[1]],
			kind: 'wall-span',
			sourceId: span.id,
			ownerId,
			wallId,
			distance: projectedDistance
		});
	}
	return candidates;
}

/** Opening-edge candidates: the two ends of each opening span. */
export function openingEdgeSnapCandidates(
	span: { id: string; openingId: string; start: LayoutVec2; end: LayoutVec2 },
	point: LayoutVec2,
	radius: number
): SnapCandidate[] {
	const candidates: SnapCandidate[] = [];
	const edges: Array<[LayoutVec2, 'start' | 'end']> = [
		[span.start, 'start'],
		[span.end, 'end']
	];
	for (const [candidatePoint, key] of edges) {
		const distance = Math.hypot(candidatePoint[0] - point[0], candidatePoint[1] - point[1]);
		if (distance <= radius) {
			candidates.push({
				point: [candidatePoint[0], candidatePoint[1]],
				kind: 'opening-edge',
				sourceId: `${span.openingId}#${key}`,
				ownerId: snapOwnerKey({ kind: 'opening', id: span.openingId }),
				distance
			});
		}
	}
	return candidates;
}

/** Rotated-object footprint bounds edge + center candidates. */
export function objectBoundsSnapCandidates(
	footprint: readonly LayoutVec2[],
	objectId: string,
	point: LayoutVec2,
	radius: number
): SnapCandidate[] {
	if (footprint.length === 0) return [];
	const candidates: SnapCandidate[] = [];
	const seenEdges = new Set<string>();
	for (let index = 0; index < footprint.length; index += 1) {
		const start = footprint[index]!;
		const end = footprint[(index + 1) % footprint.length]!;
		const midpoint: LayoutVec2 = [(start[0] + end[0]) / 2, (start[1] + end[1]) / 2];
		const edgePoints: Array<[LayoutVec2, string]> = [
			[start, `${index}:start`],
			[end, `${index}:end`],
			[midpoint, `${index}:mid`]
		];
		for (const [candidatePoint, key] of edgePoints) {
			const distance = Math.hypot(candidatePoint[0] - point[0], candidatePoint[1] - point[1]);
			if (distance > radius) continue;
			const dedupe = `${candidatePoint[0]}|${candidatePoint[1]}`;
			if (seenEdges.has(dedupe)) continue;
			seenEdges.add(dedupe);
			candidates.push({
				point: [candidatePoint[0], candidatePoint[1]],
				kind: 'object-bounds-edge',
				sourceId: `${objectId}#${key}`,
				ownerId: snapOwnerKey({ kind: 'object', id: objectId }),
				distance
			});
		}
	}
	let centerX = 0;
	let centerZ = 0;
	for (const [x, z] of footprint) {
		centerX += x;
		centerZ += z;
	}
	const center: LayoutVec2 = [centerX / footprint.length, centerZ / footprint.length];
	const centerDistance = Math.hypot(center[0] - point[0], center[1] - point[1]);
	if (centerDistance <= radius) {
		candidates.push({
			point: [center[0], center[1]],
			kind: 'object-bounds-center',
			sourceId: objectId,
			ownerId: snapOwnerKey({ kind: 'object', id: objectId }),
			distance: centerDistance
		});
	}
	return candidates;
}

/** Orthogonal guide candidates relative to the active draft anchor. */
export function orthogonalGuideCandidates(
	anchor: LayoutVec2,
	point: LayoutVec2
): SnapCandidate[] {
	const orthoX: LayoutVec2 = [point[0], anchor[1]];
	const orthoZ: LayoutVec2 = [anchor[0], point[1]];
	const distanceX = Math.hypot(orthoX[0] - point[0], orthoX[1] - point[1]);
	const distanceZ = Math.hypot(orthoZ[0] - point[0], orthoZ[1] - point[1]);
	const candidates: SnapCandidate[] = [];
	if (Number.isFinite(distanceX) && distanceX > 0) {			candidates.push({
				point: orthoX,
				kind: 'orthogonal-guide',
				sourceId: 'orthogonal-x',
				ownerId: 'orthogonal-x',
				distance: distanceX
			});
	}
	if (Number.isFinite(distanceZ) && distanceZ > 0) {			candidates.push({
				point: orthoZ,
				kind: 'orthogonal-guide',
				sourceId: 'orthogonal-z',
				ownerId: 'orthogonal-z',
				distance: distanceZ
			});
	}
	return candidates;
}

/** Nearest-point (wall-span) candidates for one sample chunk of a curved wall. */
function curvedSpanNearestCandidates(
	sample: CompiledQuerySpan,
	wallKey: string,
	index: number,
	point: LayoutVec2,
	radius: number,
	ownerId: string,
	wallId: string
): SnapCandidate[] {
	const dx = sample.end[0] - sample.start[0];
	const dz = sample.end[1] - sample.start[1];
	const squared = dx * dx + dz * dz;
	if (squared <= 0) return [];
	const rawT = ((point[0] - sample.start[0]) * dx + (point[1] - sample.start[1]) * dz) / squared;
	const amount = Math.min(1, Math.max(0, rawT));
	const projected: LayoutVec2 = [sample.start[0] + dx * amount, sample.start[1] + dz * amount];
	const distance = Math.hypot(projected[0] - point[0], projected[1] - point[1]);
	if (distance > radius) return [];
	return [
		{
			point: projected,
			kind: 'wall-span',
			sourceId: `${wallKey}#sample:${index}`,
			ownerId,
			wallId,
			distance
		}
	];
}

/**
 * Valid wall-wall intersection candidates across the compiled wall spans
 * (endpoint-on-interior and proper-crossing classes only). Collinear
 * classes and shared endpoints are skipped: shared endpoints already exist
 * as junction candidates and collinear overlaps are not a single point.
 */
export function wallIntersectionSnapCandidates(
	spans: readonly { id: string; start: LayoutVec2; end: LayoutVec2 }[],
	point: LayoutVec2,
	radius: number
): SnapCandidate[] {
	const candidates: SnapCandidate[] = [];
	for (let first = 0; first < spans.length; first += 1) {
		for (let second = first + 1; second < spans.length; second += 1) {
			const a = spans[first]!;
			const b = spans[second]!;
			const segmentA: TopologySegment = { id: a.id, start: a.start, end: a.end };
			const segmentB: TopologySegment = { id: b.id, start: b.start, end: b.end };
			const classified = classifyWallIntersection(segmentA, segmentB, []);
			if (classified.kind !== 'endpoint-on-interior' && classified.kind !== 'proper-crossing') continue;
			const intersectionPoint = classified.point;
			const distance = Math.hypot(intersectionPoint[0] - point[0], intersectionPoint[1] - point[1]);
			if (distance > radius) continue;
			candidates.push({
				point: [intersectionPoint[0], intersectionPoint[1]],
				kind: 'wall-intersection',
				sourceId: `${a.id}~${b.id}`,
				ownerId: snapOwnerKey({ kind: 'wall', id: `${a.id}~${b.id}` }),
				distance
			});
		}
	}
	return candidates;
}

/**
 * Derived Wall snap index — the merged Wall extents of one compiled geometry.
 *
 * Every field is a **pure function of the compiled geometry** — no pointer
 * position, no acquisition radius, no moving-target exclusions, no enabled
 * candidate families — so it is memoized by geometry object identity, exactly
 * like the editor's derived Wall-mesh bundle. A compile always produces a new
 * geometry object, so an entry can never be read for a different document, and
 * it is released with the geometry that owns it. A direct-edit gesture resolves
 * every snap against the *same* frozen baseline geometry between moves, so the
 * merge cost is paid once per geometry instead of once per pointermove.
 *
 * Keying on the geometry (never on `geometry.queries.spans.filter(...)`, which
 * creates a fresh array every call) is what makes the cache hit at all. Only
 * invariant structure is cached: candidates, exclusions and winners stay
 * per-call, so no pointer-dependent result can go stale.
 */
export type DerivedWallSnapIndex = {
	/** Merged authored-Wall extents (straight) and sample sets (curved). */
	walls: readonly MergedWallSpan[];
};

const derivedWallSnapIndex = new WeakMap<CompiledLayoutGeometry, DerivedWallSnapIndex>();

/** The memoized Wall snap index of one compiled geometry. */
export function wallSnapIndex(geometry: CompiledLayoutGeometry): DerivedWallSnapIndex {
	const cached = derivedWallSnapIndex.get(geometry);
	if (cached) return cached;
	const derived: DerivedWallSnapIndex = {
		walls: p2311Measure('snap-wall-index', () =>
			dedupeWallSpans(geometry.queries.spans.filter((span) => span.kind === 'wall'))
		)
	};
	derivedWallSnapIndex.set(geometry, derived);
	return derived;
}

/**
 * Full resolution over the compiled query geometry: collect candidate
 * families from `geometry.queries`, run the deterministic winner order, and
 * derive the transient guides for the winner. Pure — no mutation, no history.
 */
export function resolveLayoutSnap(
	geometry: CompiledLayoutGeometry,
	point: LayoutVec2,
	context: SnapQueryContext,
	input: SnapInputContext = {}
): SnapResolution {
	const radius = snapAcquisitionRadiusWorld(context);
	if (radius <= 0) return { kind: 'none' };
	const candidates: SnapCandidate[] = [];

	// Junction candidates from compiled query points, deduplicated by exact
	// position AND qualified owner: coincident junctions from distinct walls
	// are distinct candidates (each may survive its own exclusion), while
	// identical position+owner records (shared junctions compile once per
	// incident room boundary under one wall identity) collapse to one.
	// Deduping by position alone would let whichever wall the compiler
	// happened to emit first shadow the other's exclusion — query-array
	// order must never decide the winner (P23.2 deterministic contract).
	const seenPointOwners = new Set<string>();
	for (const queryPoint of geometry.queries.points) {
		const ownerId = snapOwnerKey({ kind: 'wall', id: queryPoint.wallKey ?? queryPoint.segmentId });
		const key = `${queryPoint.point[0]}|${queryPoint.point[1]}|${ownerId}`;
		if (seenPointOwners.has(key)) continue;
		seenPointOwners.add(key);
		const distance = Math.hypot(queryPoint.point[0] - point[0], queryPoint.point[1] - point[1]);
		if (distance > radius) continue;
		candidates.push({
			point: [queryPoint.point[0], queryPoint.point[1]],
			kind: 'junction',
			sourceId: queryPoint.sourceId,
			ownerId,
			distance
		});
	}

	// Wall endpoint/midpoint/nearest-span candidates. Per-sample spans of one
	// wall merge to the full-length span so candidates reflect authored
	// walls, not sample boundaries. Straight walls get the full family
	// (endpoints/midpoint/nearest-point); curved walls keep their per-sample
	// spans and only provide nearest-point candidates — a chord through a
	// curve must never masquerade as the wall, and P23.2 midpoint semantics
	// are straight-wall-scoped.
	const wallMerges = wallSnapIndex(geometry).walls;
	const wallOwner = (key: string): string => snapOwnerKey({ kind: 'wall', id: key });
	for (const merge of wallMerges) {
		if (merge.straight) {
			candidates.push(
				...spanSnapCandidates(
					{ id: merge.key, start: merge.start, end: merge.end },
					point,
					radius,
					wallOwner(merge.key),
					merge.key
				)
			);
			continue;
		}
		for (const [index, sample] of merge.samples.entries()) {
			candidates.push(
				...curvedSpanNearestCandidates(
					sample,
					merge.key,
					index,
					point,
					radius,
					wallOwner(merge.key),
					merge.key
				)
			);
		}
	}
	// Wall-wall intersections involve straight walls only. Intersection
	// owners are composite (`a~b`), so an exact owner-key match can never
	// exclude them: walls owned by the moving target are removed before
	// classifying instead.
	const excludedOwners = input.excludeOwners;
	const intersectionSpans = wallMerges
		.filter((merge) => merge.straight && !excludedOwners?.has(wallOwner(merge.key)))
		.map((merge) => ({ id: merge.key, start: merge.start, end: merge.end }));
	candidates.push(...wallIntersectionSnapCandidates(intersectionSpans, point, radius));

	for (const span of geometry.queries.spans) {
		if (span.kind !== 'opening' || !span.openingId) continue;
		candidates.push(
			...openingEdgeSnapCandidates(
				{ id: span.id, openingId: span.openingId, start: span.start, end: span.end },
				point,
				radius
			)
		);
	}

	const footprintsById = new Map<string, LayoutVec2[]>();
	for (const polygon of geometry.queries.polygons) {
		if (polygon.kind !== 'object-footprint' || !polygon.objectId) continue;
		footprintsById.set(
			polygon.objectId,
			polygon.polygon.map((vertex) => [vertex[0], vertex[1]] as LayoutVec2)
		);
	}
	for (const [objectId, footprint] of footprintsById) {
		candidates.push(...objectBoundsSnapCandidates(footprint, objectId, point, radius));
	}

	// Grid fallback — always allowed to win only if nothing semantic is in
	// range, because semantic rank beats it in the winner order.
	const step = context.gridStep ?? LAYOUT_PLAN_GRID_STEP;
	const gridPoint = snapToGridStep(point, step);
	const gridDistance = Math.hypot(gridPoint[0] - point[0], gridPoint[1] - point[1]);
	const gridRadius = Math.max(radius, step / 2);
	if (gridDistance <= gridRadius) {
		candidates.push({
			point: gridPoint,
			kind: 'grid',
			sourceId: 'grid',
			ownerId: 'grid',
			distance: gridDistance
		});
	}

	const winner = pickSnapWinner(candidates, input);
	if (!winner) return { kind: 'none' };
	return { kind: 'snap', candidate: winner, guides: guidesForCandidate(winner) };
}

function guidesForCandidate(candidate: SnapCandidate): SnapGuide[] {
	if (candidate.kind === 'orthogonal-guide') {
		return [
			candidate.sourceId === 'orthogonal-x'
				? { kind: 'orthogonal-z', start: [...candidate.point] as LayoutVec2, end: [...candidate.point] as LayoutVec2 }
				: { kind: 'orthogonal-x', start: [...candidate.point] as LayoutVec2, end: [...candidate.point] as LayoutVec2 }
		];
	}
	return [];
}

/** Semantic rank per candidate family in the opening-drag context — lower wins. */
const OPENING_DRAG_SEMANTIC_RANK: Record<OpeningDragSnapCandidate['kind'], number> = {
	junction: 0,
	'opening-edge': 1,
	'wall-midpoint': 2,
	grid: 9
};

export type OpeningDragSnapCandidate = {
	/**
	 * The coordinate this candidate commits for the drag's anchor, already
	 * clamped into the anchor's legal range and expressed in the caller's
	 * authored-segment frame (same frame as `pointerOffset`): the Opening
	 * **start edge** in `[0, length - width]` for a `center` anchor, the
	 * **moving edge** in `[0, length]` for an `edge` anchor.
	 */
	offset: number;
	/** Semantic family in the opening-drag context. */
	kind: 'junction' | 'opening-edge' | 'wall-midpoint' | 'grid';
	/** Canonical source identity (`${openingId}#start` / `#end` for opening edges). */
	sourceId: string;
	/** Distance from the pointer offset to the implied opening center, in meters. */
	distance: number;
};

export type OpeningDragSnapResolution =
	| { kind: 'snap'; candidate: OpeningDragSnapCandidate }
	| { kind: 'none' };

/**
 * P23.3 — which authored Opening coordinate the pointer drives.
 *
 * `center` (body drag): the pointer projects onto the Opening **center**, so
 * candidates resolve in center space and are emitted as start-edge offsets
 * (the P23.2 semantics, unchanged).
 *
 * `edge` (width-handle drag): the pointer projects onto the **moving edge**
 * itself, so candidates resolve in edge space and are emitted as that edge's
 * own offset. No surrogate width is involved, and an alignment target reached
 * from either side resolves to exactly the same coordinate.
 */
export type OpeningDragAnchor = { kind: 'center'; width: number } | { kind: 'edge' };

/**
 * P23.2/P23.3 — resolve one opening drag along its host wall in offset space
 * (meters from the authored segment start) for an explicit
 * {@link OpeningDragAnchor}. The public `resolveOpeningDragSnap` (center) and
 * `resolveOpeningDragEdgeSnap` (edge) both funnel through here, so body and
 * width-handle drags can never drift apart.
 *
 * The opening is confined to its host wall, so candidates are the host
 * wall's features projected onto the authored span direction: the wall's
 * junction endpoints, its midpoint, other openings' edges on the same wall,
 * and the grid fallback. The dragged opening's own spans are skipped
 * entirely, so its own edges can never act as external reference candidates
 * (the moving self-snap loop — P23.2 §Moving-target exclusion). Grid
 * candidates snap the dragged anchor (the opening **center** for body drags,
 * the moving **edge** for width handles) to the step exactly like opening
 * creation (`createDefaultOpening`), so drag and create share one grid
 * semantic.
 *
 * `hostSpan.roomId` disambiguates same-named legacy segments: an opening on
 * another room's same-named segment is a different wall and never becomes a
 * candidate (wall-first wall ids are document-global, so room scoping does
 * not apply there).
 *
 * `hostSpan` must be the host wall span in the caller's frame (the room
 * boundary segment the opening lives on): offsets are measured from its
 * start, so shared walls traversed in reverse resolve correctly without
 * mirroring. Deterministic winner order is the same pipeline as
 * `resolveLayoutSnap`: context rank → offset distance → stable key. Pure —
 * no mutation, no history.
 */
function resolveOpeningDragAnchoredSnap(
	geometry: CompiledLayoutGeometry,
	hostSpan: { segmentId: string; roomId?: string; start: LayoutVec2; end: LayoutVec2 },
	draggedOpeningId: string,
	pointerOffset: number,
	anchor: OpeningDragAnchor,
	context: SnapQueryContext
): OpeningDragSnapResolution {
	const radius = snapAcquisitionRadiusWorld(context);
	if (radius <= 0) return { kind: 'none' };
	if (!Number.isFinite(pointerOffset)) return { kind: 'none' };
	if (anchor.kind === 'center' && (!Number.isFinite(anchor.width) || anchor.width <= 0)) {
		return { kind: 'none' };
	}
	const dx = hostSpan.end[0] - hostSpan.start[0];
	const dz = hostSpan.end[1] - hostSpan.start[1];
	const length = Math.hypot(dx, dz);
	if (length <= 0) return { kind: 'none' };
	const dirX = dx / length;
	const dirZ = dz / length;
	const step = context.gridStep ?? LAYOUT_PLAN_GRID_STEP;
	// The anchor's own legal range: a body drag keeps the whole Opening on the
	// Wall (`[0, length - width]`); a width handle moves one edge, which is
	// bounded only by the Wall itself (`[0, length]`).
	const maxAnchorOffset = anchor.kind === 'center' ? Math.max(0, length - anchor.width) : length;
	const anchorOffset = (target: number): number => {
		const raw = anchor.kind === 'center' ? target - anchor.width / 2 : target;
		return Math.min(maxAnchorOffset, Math.max(0, raw));
	};

	const candidates: OpeningDragSnapCandidate[] = [];
	/**
	 * Add one anchor-space target. `target` is the coordinate the pointer is
	 * approaching (the opening center for `center` anchors, the moving edge for
	 * `edge` anchors); clamping only happens when the candidate is emitted.
	 */
	const addAnchorCandidate = (
		target: number,
		kind: OpeningDragSnapCandidate['kind'],
		sourceId: string,
		acquisition = radius
	): void => {
		const distance = Math.abs(pointerOffset - target);
		if (distance > acquisition) return;
		candidates.push({ offset: anchorOffset(target), kind, sourceId, distance });
	};

	// Junction candidates: the host wall's two endpoints. Clamping resolves the
	// anchor onto the junction, which makes the opening flush with the wall end
	// (a body drag centers the opening there; a width handle lands the moving
	// edge exactly on it).
	addAnchorCandidate(0, 'junction', `${hostSpan.segmentId}#start`);
	addAnchorCandidate(length, 'junction', `${hostSpan.segmentId}#end`);

	// Host wall midpoint (anchor-aligned).
	addAnchorCandidate(length / 2, 'wall-midpoint', hostSpan.segmentId);

	// Other openings' edges on the same wall. Body drags use nearest-edge
	// alignment (the dragged opening's approaching edge lands on the reference
	// edge); width handles land the moving edge on the reference edge itself,
	// which is therefore the same coordinate from either approach side.
	// Legacy segment ids are only unique inside their room, so an opening on
	// a same-named segment of another room belongs to a different wall.
	for (const other of geometry.queries.spans) {
		if (other.kind !== 'opening' || !other.openingId) continue;
		if (other.segmentId !== hostSpan.segmentId || other.openingId === draggedOpeningId) continue;
		const roomScoped = other.wallKey !== undefined && other.wallKey !== other.segmentId;
		if (roomScoped && other.roomId !== hostSpan.roomId) continue;
		const edges: Array<[LayoutVec2, 'start' | 'end']> = [
			[other.start, 'start'],
			[other.end, 'end']
		];
		for (const [edgePoint, key] of edges) {
			const edgeOffset = (edgePoint[0] - hostSpan.start[0]) * dirX + (edgePoint[1] - hostSpan.start[1]) * dirZ;
			if (edgeOffset < -1e-9 || edgeOffset > length + 1e-9) continue;
			const target =
				anchor.kind === 'edge'
					? edgeOffset
					: pointerOffset < edgeOffset
						? edgeOffset - anchor.width / 2
						: edgeOffset + anchor.width / 2;
			addAnchorCandidate(target, 'opening-edge', `${other.openingId}#${key}`);
		}
	}

	// Grid fallback — always in range within max(radius, step / 2) exactly
	// like `resolveLayoutSnap`, and lower-ranked than every semantic family.
	const gridCenter = snapToGridStep([pointerOffset, 0], step)[0]!;
	addAnchorCandidate(gridCenter, 'grid', 'grid', Math.max(radius, step / 2));

	let best: OpeningDragSnapCandidate | null = null;
	let bestKey = '';
	for (const candidate of candidates) {
		const key = `${OPENING_DRAG_SEMANTIC_RANK[candidate.kind]}|${candidate.kind}|${candidate.sourceId}|${candidate.offset}`;
		if (!best) {
			best = candidate;
			bestKey = key;
			continue;
		}
		const rankDiff = OPENING_DRAG_SEMANTIC_RANK[candidate.kind] - OPENING_DRAG_SEMANTIC_RANK[best.kind];
		const distanceDiff = candidate.distance - best.distance;
		if (
			rankDiff < 0 ||
			(rankDiff === 0 && (distanceDiff < 0 || (distanceDiff === 0 && key < bestKey)))
		) {
			best = candidate;
			bestKey = key;
		}
	}
	return best ? { kind: 'snap', candidate: best } : { kind: 'none' };
}

/**
 * Body drag: resolve one Opening's drag position in **center** space, emitting
 * start-edge offsets clamped into `[0, length - width]` (P23.2 semantics).
 */
export function resolveOpeningDragSnap(
	geometry: CompiledLayoutGeometry,
	hostSpan: { segmentId: string; roomId?: string; start: LayoutVec2; end: LayoutVec2 },
	draggedOpeningId: string,
	pointerOffset: number,
	openingWidth: number,
	context: SnapQueryContext
): OpeningDragSnapResolution {
	return resolveOpeningDragAnchoredSnap(
		geometry,
		hostSpan,
		draggedOpeningId,
		pointerOffset,
		{ kind: 'center', width: openingWidth },
		context
	);
}

/**
 * Width-handle drag: resolve the **moving edge** directly in edge space,
 * emitting that edge's own offset clamped into `[0, length]`.
 *
 * Deliberately not a surrogate-width center drag: resolving an edge against a
 * fake ~0 m width shifts every candidate by half of it, so a width handle
 * could never reach the Wall end flush and same-target alignments would differ
 * by approach side. Here the candidate **is** the edge coordinate.
 */
export function resolveOpeningDragEdgeSnap(
	geometry: CompiledLayoutGeometry,
	hostSpan: { segmentId: string; roomId?: string; start: LayoutVec2; end: LayoutVec2 },
	draggedOpeningId: string,
	pointerEdgeOffset: number,
	context: SnapQueryContext
): OpeningDragSnapResolution {
	return resolveOpeningDragAnchoredSnap(
		geometry,
		hostSpan,
		draggedOpeningId,
		pointerEdgeOffset,
		{ kind: 'edge' },
		context
	);
}

/** Fit tolerance for raw drag validity (matches the compiler epsilon order). */
const OPENING_DRAG_EPSILON = 1e-6;

/**
 * P23.3 — raw drag candidate validity, kept **separate** from the bounded
 * P23.2 snap result.
 *
 * The snap resolvers clamp every candidate into the anchor's legal range,
 * which is correct as a *suggestion* but must never be laundered into
 * validity: a drag 2 m past the Wall end would otherwise commit as an
 * end-flush placement. This use-mode therefore returns the unclamped raw
 * candidate (and its own fit result) next to an optional **honored** snap win:
 *
 * ```text
 * raw candidate outside fit bounds        → rawValid false, candidate invalid
 *                                            (transient invalid preview, reject)
 * snap win inside the acquisition radius  → committable snapped candidate
 * snap win only reachable by clamping far → NOT honored (raw candidate stands)
 * ```
 *
 * The anchor decides where the raw candidate comes from: a `center` anchor
 * treats `pointerOffset` as the opening center (raw start edge
 * `pointerOffset - width / 2`, fit width = the authored opening width), while
 * an `edge` anchor treats `pointerOffset` as the moving edge itself (raw edge
 * offset = `pointerOffset`, fit width = `0`). Neither value is clamped or
 * repaired.
 */
export type OpeningDragRawResolution = {
	/** Raw pointer projection in the caller's frame (unclamped). */
	rawPointerOffset: number;
	/** Raw candidate start/edge offset derived from the pointer (unclamped). */
	rawOffset: number;
	/** Raw candidate fit against the host Wall — never snap-derived. */
	rawValid: boolean;
	/** Honored in-fit snap win's offset, or `null` when the raw candidate stands. */
	snappedOffset: number | null;
	snappedKind: OpeningDragSnapCandidate['kind'] | null;
	snappedSourceId: string | null;
	/** The candidate a commit would use (`snappedOffset ?? rawOffset`). */
	candidateOffset: number;
	/** Whether that candidate may commit (one history entry) or must reject. */
	candidateValid: boolean;
};

export function resolveOpeningDragSnapUseMode(
	geometry: CompiledLayoutGeometry,
	hostSpan: { segmentId: string; roomId?: string; start: LayoutVec2; end: LayoutVec2 },
	draggedOpeningId: string,
	pointerOffset: number,
	options: { anchor: OpeningDragAnchor; context: SnapQueryContext }
): OpeningDragRawResolution {
	const resolution =
		options.anchor.kind === 'center'
			? resolveOpeningDragSnap(
					geometry,
					hostSpan,
					draggedOpeningId,
					pointerOffset,
					options.anchor.width,
					options.context
				)
			: resolveOpeningDragEdgeSnap(geometry, hostSpan, draggedOpeningId, pointerOffset, options.context);
	return resolveOpeningDragRawValidity(resolution, {
		hostSpan,
		pointerOffset,
		anchor: options.anchor,
		context: options.context
	});
}

/**
 * Pure projection of a (already resolved) snap result into the P23.3 raw
 * validity pair. Splitting this from `resolveOpeningDragSnapUseMode` keeps the
 * contract unit-testable without geometry fixtures.
 */
export function resolveOpeningDragRawValidity(
	resolution: OpeningDragSnapResolution,
	options: {
		hostSpan: { start: LayoutVec2; end: LayoutVec2 };
		pointerOffset: number;
		anchor: OpeningDragAnchor;
		context: SnapQueryContext;
	}
): OpeningDragRawResolution {
	const { hostSpan, pointerOffset, anchor, context } = options;
	const length = Math.hypot(
		hostSpan.end[0] - hostSpan.start[0],
		hostSpan.end[1] - hostSpan.start[1]
	);
	const rawOffset = anchor.kind === 'center' ? pointerOffset - anchor.width / 2 : pointerOffset;
	const fitWidth = anchor.kind === 'center' ? anchor.width : 0;
	const fits = (offset: number): boolean =>
		offset >= -OPENING_DRAG_EPSILON &&
		offset + fitWidth <= length + OPENING_DRAG_EPSILON;
	const rawValid = fits(rawOffset);

	const radius = snapAcquisitionRadiusWorld(context);
	// Mirror the candidate emission exactly (see `resolveOpeningDragAnchoredSnap`):
	// a body drag's anchor range is `[0, length - width]`, an edge's `[0, length]`.
	const maxSnapOffset = anchor.kind === 'center' ? Math.max(0, length - anchor.width) : length;
	// A candidate strictly inside the fit range cannot have been produced by
	// the endpoint clamp; one sitting exactly on a clamp boundary may have
	// been. Only the `junction` family is *meant* to be flushed to a Wall end
	// (that is the endpoint-clearance snap the plan ratifies), and only while
	// the pointer is inside its own acquisition radius.
	const strictlyInside =
		resolution.kind === 'snap' &&
		resolution.candidate.offset > OPENING_DRAG_EPSILON &&
		resolution.candidate.offset < maxSnapOffset - OPENING_DRAG_EPSILON;
	const snapHonored =
		resolution.kind === 'snap' &&
		radius > 0 &&
		resolution.candidate.distance <= radius &&
		fits(resolution.candidate.offset) &&
		(resolution.candidate.kind === 'junction' || strictlyInside);

	const snappedOffset = snapHonored ? resolution.candidate.offset : null;
	return {
		rawPointerOffset: pointerOffset,
		rawOffset,
		rawValid,
		snappedOffset,
		snappedKind: snappedOffset === null ? null : resolution.kind === 'snap' ? resolution.candidate.kind : null,
		snappedSourceId:
			snappedOffset === null ? null : resolution.kind === 'snap' ? resolution.candidate.sourceId : null,
		candidateOffset: snappedOffset ?? rawOffset,
		candidateValid: snappedOffset === null ? rawValid : true
	};
}

/**
 * One wall's span set after per-wall deduplication. `straight` gates which
 * semantics consumers may use: midpoint/endpoint families are straight-wall
 * only, curved walls snap via per-sample nearest-point candidates.
 */
export type MergedWallSpan = {
	/**
	 * Collision-safe wall identity: the document-global wall id (wall-first)
	 * or a room-qualified key for legacy segments (unique only per room).
	 */
	key: string;
	/** Bare segment id — the owner identity for moving-target exclusion. */
	segmentId: string;
	/** Farthest endpoint pair over every span endpoint (true extent for straight walls). */
	start: LayoutVec2;
	end: LayoutVec2;
	/**
	 * False for curved walls: consumers must not invent straight midpoint or
	 * endpoint semantics from the chord, and must use `samples` for
	 * nearest-point candidates.
	 */
	straight: boolean;
	/** Per-sample compiled spans (the nearest-point candidate source for curved walls). */
	samples: readonly CompiledQuerySpan[];
};

/**
 * Merge per-sample wall spans of one wall into the full-length span so
 * candidate generation works on authored walls, not sample boundaries.
 *
 * The compiler emits one `wall` query span per sample interval (0.25 m for
 * straight lines), and a shared wall compiles spans per incident room —
 * reversed room refs traverse the wall the other way, so `startDistance` is
 * measured from each room's own segment start and cannot be compared across
 * rooms. Spans are grouped by the compiled `wallKey` (wall-first: the
 * document-global segment id; legacy: floor+room+segment), so same-named
 * segments of different legacy rooms can never collapse into one fake wall.
 *
 * For straight walls the merged extent is the **farthest true endpoint pair**
 * among every span endpoint — exactly the authored wall start/end for any
 * slope or traversal direction. A bounding-box merge would be wrong here — a
 * negative-slope wall `(0,4) → (4,0)` would collapse to the anti-diagonal
 * `(0,0) → (4,4)`.
 *
 * The extent is recovered in **O(k)** from the compiled distances whenever the
 * spans prove a traversal ({@link provenTraversalExtent}): among collinear
 * endpoints the farthest pair is only ever attained by the outermost endpoint
 * of each traversal frame, so scanning every pair re-derives a result the
 * distances already state — and on the editor's `$state`-proxied geometry that
 * scan made Snap the dominant cost of a Plan drag (P23.11 live Snap gate).
 * Straightness is still the same relative-tolerance collinearity test, just
 * against the traversed chord. Curved walls, and any group whose metadata
 * cannot prove a traversal, resolve through the same exact farthest-pair scan
 * as before — nothing is inferred from a guess.
 *
 * Curved walls (auto-bezier) are detected geometrically — the sample path
 * is longer than the endpoint chord — and keep their per-sample spans:
 * snapping to a curved wall means nearest-point on the actual curve, never
 * a straight chord through its interior.
 */
export function dedupeWallSpans(
	spans: readonly CompiledQuerySpan[]
): MergedWallSpan[] {
	const byWall = new Map<string, CompiledQuerySpan[]>();
	for (const span of spans) {
		const key = span.wallKey ?? span.segmentId;
		const list = byWall.get(key) ?? [];
		list.push(span);
		byWall.set(key, list);
	}
	const merged: MergedWallSpan[] = [];
	for (const [key, list] of byWall) {
		merged.push(mergeWallGroup(key, list[0]!.segmentId, list));
	}
	return merged;
}

/** Merge one wall group — already grouped by `wallKey ?? segmentId` — to its extent. */
function mergeWallGroup(
	key: string,
	segmentId: string,
	list: readonly CompiledQuerySpan[]
): MergedWallSpan {
	const endpoints: LayoutVec2[] = [];
	for (const span of list) endpoints.push(span.start, span.end);

	// O(k): the extent the compiled distances already prove, when they prove one.
	const proven = provenTraversalExtent(list);
	if (proven && withinChordTolerance(endpoints, proven)) {
		return mergedWall(key, segmentId, proven, true, list);
	}

	// Exact: farthest true endpoint pair over every span endpoint. Curved walls
	// keep this pair, and any chord the collinearity test rejects resolves
	// through this same result — so curved output is unchanged by the fast path.
	const exact = farthestEndpointPair(endpoints);
	return mergedWall(key, segmentId, exact, withinChordTolerance(endpoints, exact), list);
}

function mergedWall(
	key: string,
	segmentId: string,
	pair: [LayoutVec2, LayoutVec2],
	straight: boolean,
	samples: readonly CompiledQuerySpan[]
): MergedWallSpan {
	const ordered = lexicographicallySmaller(pair[0], pair[1], pair[1], pair[0])
		? [pair[0], pair[1]]
		: [pair[1], pair[0]];
	return {
		key,
		segmentId,
		start: [...ordered[0]],
		end: [...ordered[1]],
		straight,
		samples
	};
}

/** One traversal frame's proven extent: the outermost endpoint on each side. */
type TraversalFrameExtent = {
	minStartDistance: number;
	origin: LayoutVec2;
	maxEndDistance: number;
	destination: LayoutVec2;
};

/**
 * Recover a wall group's authored extent in O(k) from the compiled distances,
 * or `null` when the spans cannot prove they form a traversal.
 *
 * A **frame** is one traversal of the Wall: the physical Wall record (no owning
 * room) or one incident Room's boundary record. `startDistance`/`endDistance`
 * are measured from that frame's own segment start, so distances are never
 * compared across frames — each frame contributes its own origin and
 * destination, and the extent is the farthest pair among those outermost
 * endpoints. On a straight wall the outermost endpoint of every frame is an
 * extreme of the whole endpoint set, so this reproduces the exact scan.
 *
 * The metadata must *prove* a traversal before it is trusted: finite forward
 * distances (`endDistance >= startDistance`), and one single position per
 * outermost distance — two distinct positions at the same distance are not a
 * traversal, which is exactly what hand-built spans with placeholder distances
 * look like. Anything else returns `null` and falls back to the exact scan.
 */
function provenTraversalExtent(list: readonly CompiledQuerySpan[]): [LayoutVec2, LayoutVec2] | null {
	const frames = new Map<string, TraversalFrameExtent>();
	for (const span of list) {
		const { startDistance, endDistance } = span;
		if (!Number.isFinite(startDistance) || !Number.isFinite(endDistance)) return null;
		if (endDistance < startDistance) return null;
		const frameKey = `${span.floorId}\u0000${span.roomId ?? ''}`;
		const frame = frames.get(frameKey);
		if (!frame) {
			frames.set(frameKey, {
				minStartDistance: startDistance,
				origin: span.start,
				maxEndDistance: endDistance,
				destination: span.end
			});
			continue;
		}
		if (startDistance < frame.minStartDistance) {
			frame.minStartDistance = startDistance;
			frame.origin = span.start;
		} else if (startDistance === frame.minStartDistance && !samePoint(frame.origin, span.start)) {
			return null;
		}
		if (endDistance > frame.maxEndDistance) {
			frame.maxEndDistance = endDistance;
			frame.destination = span.end;
		} else if (endDistance === frame.maxEndDistance && !samePoint(frame.destination, span.end)) {
			return null;
		}
	}
	if (frames.size === 0) return null;
	const outermost: LayoutVec2[] = [];
	for (const frame of frames.values()) outermost.push(frame.origin, frame.destination);
	return farthestEndpointPair(outermost);
}

/**
 * Farthest endpoint pair, ties broken by lexicographic point order so the
 * result is a pure function of the geometry (never array order). Called with
 * every span endpoint for the exact path and with the frames' outermost
 * endpoints for the O(k) path — one implementation, one tie-break.
 */
function farthestEndpointPair(points: readonly LayoutVec2[]): [LayoutVec2, LayoutVec2] {
	let best: [LayoutVec2, LayoutVec2] = [points[0]!, points[1] ?? points[0]!];
	let bestSquared = -1;
	for (let first = 0; first < points.length; first += 1) {
		for (let second = first + 1; second < points.length; second += 1) {
			const a = points[first]!;
			const b = points[second]!;
			const dx = a[0] - b[0];
			const dz = a[1] - b[1];
			const squared = dx * dx + dz * dz;
			if (squared > bestSquared || (squared === bestSquared && lexicographicallySmaller(a, b, best[0], best[1]))) {
				bestSquared = squared;
				best = [a, b];
			}
		}
	}
	return best;
}

/**
 * Collinearity against the endpoint chord. Path-length comparison
 * would be wrong for shared walls (every room re-samples the full
 * wall, so the summed path exceeds the chord even for straight
 * walls); every sample endpoint must instead lie on the chord line.
 * The 2D cross product equals chord × perpendicular deviation, so
 * comparing it against chord² × 1e-6 enforces a RELATIVE
 * perpendicular tolerance of 1e-6 × wall length (plus a 1e-12 m²
 * floor that only absorbs float noise on degenerate chords).
 */
function withinChordTolerance(
	points: readonly LayoutVec2[],
	chord: readonly [LayoutVec2, LayoutVec2]
): boolean {
	const chordX = chord[1][0] - chord[0][0];
	const chordZ = chord[1][1] - chord[0][1];
	const chordLength = Math.hypot(chordX, chordZ);
	const tolerance = Math.max(1e-12, chordLength * chordLength * 1e-6);
	for (const [x, z] of points) {
		if (Math.abs(chordX * (z - chord[0][1]) - chordZ * (x - chord[0][0])) > tolerance) return false;
	}
	return true;
}

function samePoint(a: LayoutVec2, b: LayoutVec2): boolean {
	return a[0] === b[0] && a[1] === b[1];
}

function lexicographicallySmaller(a: LayoutVec2, b: LayoutVec2, c: LayoutVec2, d: LayoutVec2): boolean {
	if (a[0] !== c[0]) return a[0] < c[0];
	if (a[1] !== c[1]) return a[1] < c[1];
	if (b[0] !== d[0]) return b[0] < d[0];
	return b[1] < d[1];
}

/**
 * Footprint vertex-average center in world X/Z — used by alignment actions
 * for the canonical compiled object bounds reference (not a snap mutation).
 */
export function objectFootprintCenter(footprint: readonly LayoutVec2[]): LayoutVec2 | null {
	if (footprint.length === 0) return null;
	let x = 0;
	let z = 0;
	for (const vertex of footprint) {
		x += vertex[0];
		z += vertex[1];
	}
	return [x / footprint.length, z / footprint.length];
}
