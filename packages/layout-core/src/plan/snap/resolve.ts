import type { LayoutVec2 } from '../../geometry/coordinates';
import type { CompiledLayoutGeometry, CompiledQuerySpan } from '../../geometry/types';
import { p2311Measure } from '../../kernel/work-observer';
import {
	curvedSpanNearestCandidates,
	objectBoundsSnapCandidates,
	openingEdgeSnapCandidates,
	orthogonalGuideCandidates,
	pickSnapWinner,
	snapAcquisitionRadiusWorld,
	snapToGridStep,
	spanSnapCandidates,
	wallIntersectionSnapCandidates,
} from './features';
import type {
	SnapCandidate,
	SnapGuide,
	SnapInputContext,
	SnapQueryContext,
	SnapResolution,
} from './types';
import { LAYOUT_PLAN_GRID_STEP, snapOwnerKey } from './types';
import type { MergedWallSpan } from './walls';
import { dedupeWallSpans } from './walls';

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

/**
 * DEV-only input probe for the snap derivation: WHAT the derivation is handed,
 * beside what it costs.
 *
 * THE QUESTION IT EXISTS FOR. The `snap-wall-index` mark reports a duration and
 * nothing else, so the same mark reading cannot say whether a large number is
 * large work on a large input or a small input read through something slow. The
 * editor resolves snaps against a frozen baseline geometry that is a Svelte
 * `$state` proxy, and every field read inside the merge then pays a trap — a
 * multiplier the P23B.6 S1a probe already measured for the Plan model. This probe
 * records the input shape (spans, walls, endpoints per wall) and runs the SAME
 * merge twice: once on the geometry as handed in, once on a JSON copy of the same
 * spans (plain objects, identical values). The difference between the two is the
 * container's own read cost, measured on identical data.
 *
 * INERT BY DEFAULT, and deliberately NOT the same switch as `p2311Measure`: it
 * runs only when Vite says DEV and `globalThis.__P2311_SNAP_INPUT_PROBE__` is
 * `true`, so no recorded capture can enable it by turning measurement on. It
 * writes nothing but the capped ring on `globalThis.__P2311_SNAP_INPUT_LOG__`.
 */
export type P23B1SnapInputEntry = {
	/** Wall query spans the derivation was handed. */
	spans: number;
	walls: number;
	/** Span endpoints of the largest wall group — the k of the per-wall pair scan. */
	maxEndpointsPerWall: number;
	endpointsP50: number;
	/** The real merge's own duration, including the `p2311Measure` mark pair. */
	givenMs: number;
	/** The same merge on a JSON copy of the same spans; `null` if that arm failed. */
	plainMs: number | null;
};

const SNAP_INPUT_LOG_LIMIT = 512;

function snapInputProbeEnabled(): boolean {
	const viteDev = (import.meta as ImportMeta & { env?: { DEV?: boolean } }).env?.DEV;
	return (
		viteDev !== false &&
		(globalThis as { __P2311_SNAP_INPUT_PROBE__?: boolean }).__P2311_SNAP_INPUT_PROBE__ === true
	);
}

function recordSnapInputProbe(spans: readonly CompiledQuerySpan[], givenMs: number): void {
	const host = globalThis as { __P2311_SNAP_INPUT_LOG__?: P23B1SnapInputEntry[] };
	const log = (host.__P2311_SNAP_INPUT_LOG__ ??= []);
	if (log.length >= SNAP_INPUT_LOG_LIMIT) return;
	const byWall = new Map<string, number>();
	for (const span of spans) {
		const key = span.wallKey ?? span.segmentId;
		byWall.set(key, (byWall.get(key) ?? 0) + 2);
	}
	const endpoints = [...byWall.values()].sort((a, b) => a - b);
	let plainMs: number | null = null;
	try {
		const plain = JSON.parse(JSON.stringify(spans)) as CompiledQuerySpan[];
		const started = performance.now();
		dedupeWallSpans(plain);
		plainMs = performance.now() - started;
	} catch {
		plainMs = null;
	}
	log.push({
		spans: spans.length,
		walls: byWall.size,
		maxEndpointsPerWall: endpoints[endpoints.length - 1] ?? 0,
		endpointsP50: endpoints.length > 0 ? endpoints[Math.floor((endpoints.length - 1) / 2)]! : 0,
		givenMs,
		plainMs,
	});
}

/** The memoized Wall snap index of one compiled geometry. */
export function wallSnapIndex(geometry: CompiledLayoutGeometry): DerivedWallSnapIndex {
	const cached = derivedWallSnapIndex.get(geometry);
	if (cached) return cached;
	const probing = snapInputProbeEnabled();
	const probeStarted = probing ? performance.now() : 0;
	const derived: DerivedWallSnapIndex = {
		walls: p2311Measure('snap-wall-index', () =>
			dedupeWallSpans(geometry.queries.spans.filter((span) => span.kind === 'wall')),
		),
	};
	if (probing) {
		recordSnapInputProbe(
			geometry.queries.spans.filter((span) => span.kind === 'wall'),
			performance.now() - probeStarted,
		);
	}
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
	input: SnapInputContext = {},
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
			distance,
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
					merge.key,
				),
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
					merge.key,
				),
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
				radius,
			),
		);
	}

	const footprintsById = new Map<string, LayoutVec2[]>();
	for (const polygon of geometry.queries.polygons) {
		if (polygon.kind !== 'object-footprint' || !polygon.objectId) continue;
		footprintsById.set(
			polygon.objectId,
			polygon.polygon.map((vertex) => [vertex[0], vertex[1]] as LayoutVec2),
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
			distance: gridDistance,
		});
	}

	// The draft-anchor axis family (rank 7, ratified in P23.2 and
	// dormant until now because nothing produced it). It is emitted *after* the
	// geometry candidates and *before* the winner is picked, so the family
	// competes through the ratified rank order rather than being special-cased.
	// Read that order carefully, because it *is* the behaviour decision: lower
	// rank wins, so rank 7 sits **below every geometry family** (junction 0 …
	// object-bounds-center 6) and **above the grid fallback** (9). Wiring the
	// family therefore cannot displace a join to real geometry — it can only take
	// an outcome that used to be "snapped to the grid", which is exactly the
	// draft the axis lock is for. Distance is the perpendicular offset to the axis
	// line, so the family enters contention only inside the acquisition radius.
	// The free coordinate is quantized to the *same* `step` the grid fallback
	// above used, so the axis lock is exact rather than a glide.
	const anchor = context.anchor;
	if (anchor && Number.isFinite(anchor[0]) && Number.isFinite(anchor[1])) {
		for (const candidate of orthogonalGuideCandidates(anchor, point, step)) {
			if (candidate.distance > radius) continue;
			candidates.push(candidate);
		}
	}

	const winner = pickSnapWinner(candidates, input);
	if (!winner) return { kind: 'none' };
	return { kind: 'snap', candidate: winner, guides: guidesForCandidate(winner, anchor ?? null) };
}

/**
 * The alignment line the winner is *about*: at most one, and never degenerate.
 *
 * The orthogonal guide is the alignment through the draft anchor whose
 * coordinate the candidate holds, so its extent is the anchor-to-locked-point
 * span, overshot by the candidate's own perpendicular offset so a short leg — the
 * stepped leg is one grid subdivision or more, while the pointer may be further
 * off the axis than that — still reads as a line rather than a dot. The previous
 * answer was start === end at the candidate point, which is invisible: a guide
 * nobody can see satisfies "at most one guide" in the letter and fails it in fact.
 *
 * The `kind` names the **held** coordinate (`orthogonal-z` for a candidate that
 * holds Z and therefore runs its leg along X), matching the convention the
 * family has carried since P23.2. The paint layer draws `start`/`end` and does
 * not branch on `kind`; it is kept accurate for identification.
 */
function guidesForCandidate(candidate: SnapCandidate, anchor: LayoutVec2 | null): SnapGuide[] {
	if (candidate.kind !== 'orthogonal-guide' || !anchor) return [];
	const holdsZ = candidate.sourceId === 'orthogonal-x';
	const leg = holdsZ ? candidate.point[0] - anchor[0] : candidate.point[1] - anchor[1];
	// A candidate coincident with the anchor is never produced (see the
	// generator's guard), so the leg always has a direction. The overshoot is
	// what keeps a millimetre leg from drawing as an invisible dot.
	const direction = leg < 0 ? -1 : 1;
	const reach = Math.max(Math.abs(leg), candidate.distance);
	const end: LayoutVec2 = holdsZ
		? [anchor[0] + reach * direction, anchor[1]]
		: [anchor[0], anchor[1] + reach * direction];
	return [{ kind: holdsZ ? 'orthogonal-z' : 'orthogonal-x', start: [...anchor], end }];
}
