import { projectWorld, pointerRay, intersectWorkingPlane, type Vec3, type ViewportEvaluation, type ViewportEvaluationToken, type PointerRay } from '@portfolio/camera-core';
import { indexedCompiledWall, eligiblePlanFragments, pointInPolygon, type CompiledLayoutGeometry, type LayoutVec2, type PlanEvaluation, type PlanFragment, type PlanFragmentGeometry } from '@portfolio/layout-core';
import { createPlanPickIndex, type PlanPickBox, type PlanPickIndex } from './plan-pick-index';
import type { StageAdapterContext, StageDomainPick, StagePickQuery } from '../stage/stage-facade';
import type { PlanEvaluationResult } from '@portfolio/layout-core';

const PLAN_HIT_TOLERANCE_CSS_PX = 8;
/** The closest point on one CSS segment to a CSS point, as a `[distance, amount]` pair. */
function closestOnCssSegment(
	point: readonly [number, number],
	start: readonly [number, number],
	end: readonly [number, number]
): { readonly distance: number; readonly amount: number } {
	const dx = end[0] - start[0];
	const dy = end[1] - start[1];
	const squared = dx * dx + dy * dy;
	if (squared === 0) {
		return { distance: Math.hypot(point[0] - start[0], point[1] - start[1]), amount: 0 };
	}
	const raw = ((point[0] - start[0]) * dx + (point[1] - start[1]) * dy) / squared;
	const amount = Math.min(1, Math.max(0, raw));
	return {
		distance: Math.hypot(point[0] - (start[0] + dx * amount), point[1] - (start[1] + dy * amount)),
		amount
	};
}

/**
 * One surface the pointer can actually land on, expressed in the coordinates it is
 * **drawn** in and projected through the one live evaluation.
 *
 * `face` is a vertical Wall surface between two plan points, with the vertical extent
 * the compiler draws. `flat` is a fragment drawn in plan only — a floor, an object
 * footprint, an Opening symbol — at its own elevation.
 */
type StagePickSurface =
	| {
			readonly kind: 'face';
			readonly start: LayoutVec2;
			readonly end: LayoutVec2;
			readonly bottomMeters: number;
			readonly topMeters: number;
		}
	| {
			readonly kind: 'flat';
			readonly elevationMeters: number;
			readonly geometry: PlanFragmentGeometry;
		};

type StagePick = { readonly distanceCss: number; readonly surface: StagePickSurface };

function planSegments(geometry: PlanFragmentGeometry): (readonly [LayoutVec2, LayoutVec2])[] {
	const segments: (readonly [LayoutVec2, LayoutVec2])[] = [];
	if (geometry.kind === 'span') {
		segments.push([geometry.start, geometry.end]);
	} else if (geometry.kind === 'polyline') {
		for (let index = 1; index < geometry.polyline.length; index += 1) {
			segments.push([geometry.polyline[index - 1]!, geometry.polyline[index]!]);
		}
	} else {
		for (let index = 0; index < geometry.polygon.length; index += 1) {
			segments.push([geometry.polygon[index]!, geometry.polygon[(index + 1) % geometry.polygon.length]!]);
		}
	}
	return segments;
}

/** Two compiled distances that name the same place, allowing for float round-off. */
const SPAN_INTERVAL_EPSILON_METERS = 1e-6;

function sameSpanDistance(left: number, right: number): boolean {
	return Math.abs(left - right) <= SPAN_INTERVAL_EPSILON_METERS;
}

/**
 * The surfaces one fragment is **drawn** as.
 *
 * A Plan fragment is Layout's cut placement: a Wall cut at 1.2 m yields a fragment at
 * 1.2 m even when the Wall is drawn to 3 m. Building the pickable face from the
 * fragment's own elevation therefore shortened every Wall above the cut, so a click
 * high on the visible Wall missed it — the Plan cut quietly decided 3D picking. The
 * compiled Wall's own solid spans (the same records the mesh builders draw, including
 * their `bottomY`/`topY`) carry the real extent, so the surface tested is the surface
 * on screen. Layout remains the one geometry authority: this reads compiled Layout,
 * never the renderer or a second compiler, and it does not change what is drawn.
 */
function pickSurfacesOf(
	fragment: PlanFragment,
	geometry: CompiledLayoutGeometry,
	datumMeters: number
): readonly StagePickSurface[] {
	const flat: StagePickSurface = {
		kind: 'flat',
		elevationMeters: fragment.elevationMeters,
		geometry: fragment.geometry
	};
	if (fragment.ref.sourceKind !== 'wall') return [flat];
	const wall = indexedCompiledWall(geometry, fragment.ref.sourceId);
	if (wall === undefined) return [flat];
	const faceAtWallHeight = (): readonly StagePickSurface[] =>
		planSegments(fragment.geometry).map(([start, end]) => ({
			kind: 'face' as const,
			start,
			end,
			bottomMeters: datumMeters,
			topMeters: datumMeters + wall.height
		}));

	// **Correspondence first.** A Wall fragment names one compiled span through its
	// `interval` subRef, and a Wall split by an Opening has several. Testing the whole
	// Wall from every fragment let an earlier fragment answer for a later span and
	// report *its* interval, and made a span the Plan excluded reachable through a
	// sibling that was still eligible. Only the named span becomes this fragment's
	// pick surface, at that span's own drawn height (a lintel starts where the Opening
	// ends, not at the datum).
	const interval = fragment.ref.subRef?.kind === 'interval' ? fragment.ref.subRef : null;
	if (interval === null) return faceAtWallHeight();
	const matching = wall.solidSpans.filter(
		(span) =>
			sameSpanDistance(span.startDistance, interval.start) &&
			sameSpanDistance(span.endDistance, interval.end)
	);
	if (matching.length === 0) {
		// A fragment whose interval the compiled snapshot no longer emits is tested at its
		// own line and full Wall height — never at a neighbour's span, which would answer
		// for a place this fragment does not name.
		return faceAtWallHeight();
	}
	return matching.map((span) => ({
		kind: 'face' as const,
		start: span.start,
		end: span.end,
		bottomMeters: datumMeters + span.bottomY,
		topMeters: datumMeters + span.topY
	}));
}

/**
 * The distance, in **CSS pixels**, from a pointer position to the surfaces a fragment
 * is drawn as — the surface the creator is actually pointing at.
 *
 * This replaces a datum-plane-only pick, which measured plan metres from a point that
 * the ray reached at floor level: in the 3D reading that point sits metres behind the
 * surface under the pointer, so a visible Wall could not be selected at all. Proximity
 * is a screen question and the drawing is where the creator looks, so the test is made
 * where both agree, through the one live evaluation.
 */
function cssDistanceToSurfaces(
	css: readonly [number, number],
	surfaces: readonly StagePickSurface[],
	project: (point: Vec3) => readonly [number, number] | null
): StagePick | null {
	let best: StagePick | null = null;
	const consider = (distanceCss: number, surface: StagePickSurface): void => {
		if (best === null || distanceCss < best.distanceCss) best = { distanceCss, surface };
	};
	const considerSegment = (
		start: readonly [number, number] | null,
		end: readonly [number, number] | null,
		surface: StagePickSurface
	): void => {
		// A segment with an endpoint behind the camera is not something the pointer can be
		// over; skipping it also keeps a mirrored projection out of the test.
		if (start === null || end === null) return;
		consider(closestOnCssSegment(css, start, end).distance, surface);
	};

	for (const surface of surfaces) {
		if (surface.kind === 'face') {
			// A Wall is a **face**, not a line: the quad between its footprint and its top
			// edge, at the extent the compiler draws.
			const corners = [
				project([surface.start[0], surface.bottomMeters, surface.start[1]]),
				project([surface.end[0], surface.bottomMeters, surface.end[1]]),
				project([surface.end[0], surface.topMeters, surface.end[1]]),
				project([surface.start[0], surface.topMeters, surface.start[1]])
			];
			for (let index = 0; index < 4; index += 1) {
				considerSegment(corners[index] ?? null, corners[(index + 1) % 4] ?? null, surface);
			}
			const polygon: [number, number][] = [];
			for (const corner of corners) {
				if (corner !== null) polygon.push([corner[0], corner[1]]);
			}
			if (polygon.length === 4 && pointInPolygon([css[0], css[1]], polygon)) consider(0, surface);
			continue;
		}

		const elevation = surface.elevationMeters;
		const projectAt = (point: LayoutVec2): readonly [number, number] | null =>
			project([point[0], elevation, point[1]]);
		for (const [start, end] of planSegments(surface.geometry)) {
			considerSegment(projectAt(start), projectAt(end), surface);
		}
		if (surface.geometry.kind === 'polygon') {
			// Inside the drawn footprint the pointer is on the surface itself.
			const projected: [number, number][] = [];
			for (const point of surface.geometry.polygon) {
				const cssPoint = projectAt(point);
				if (cssPoint !== null) projected.push([cssPoint[0], cssPoint[1]]);
			}
			if (
				projected.length === surface.geometry.polygon.length &&
				pointInPolygon([css[0], css[1]], projected)
			) {
				consider(0, surface);
			}
		}
	}
	return best;
}

/**
 * The world point a resolved hit reports, **on the surface that was picked**.
 *
 * A Wall is a vertical plane, so a horizontal plane at the fragment's elevation would
 * report a point that is not on the surface the creator pointed at — the Plan cut
 * height again, in world coordinates. A face hit therefore intersects the face's own
 * plane (the plane of its span, clamped to the span) and keeps the ray's height; a flat
 * fragment keeps the horizontal-plane answer. When the ray never meets the plane (a
 * nearly parallel view), the fragment's first drawn point is the honest fallback rather
 * than an invented position.
 */
function worldPointOnSurface(
	css: readonly [number, number],
	surface: StagePickSurface,
	fragment: PlanFragment,
	evaluation: ViewportEvaluation,
	token: ViewportEvaluationToken
): Vec3 {
	const geometry = fragment.geometry;
	const first: LayoutVec2 =
		geometry.kind === 'span'
			? geometry.start
			: geometry.kind === 'polyline'
				? (geometry.polyline[0] ?? [0, 0])
				: (geometry.polygon[0] ?? [0, 0]);
	const fallback: Vec3 = [first[0], fragment.elevationMeters, first[1]];
	const ray = pointerRay(css, evaluation, token);
	if (ray.kind !== 'ray') return fallback;

	if (surface.kind === 'face') {
		const dx = surface.end[0] - surface.start[0];
		const dz = surface.end[1] - surface.start[1];
		const length = Math.hypot(dx, dz);
		if (length > 0) {
			const hit = intersectWorkingPlane(
				ray.ray,
				{
					originMeters: [surface.start[0], surface.bottomMeters, surface.start[1]],
					// The horizontal normal of the face: perpendicular to its span, in the plane
					// the Wall is drawn in. The yaw is the span's own direction, so the frame's
					// local up axis is the span rather than a second horizontal axis that could
					// collapse onto the normal (a wall parallel to the default axis).
					normal: [-dz / length, 0, dx / length],
					yawRadians: Math.atan2(dx, dz),
					datumMeters: surface.bottomMeters,
					supportedLocalExtent: null
				},
				evaluation,
				token
			);
			if (hit.kind === 'intersected') {
				// Keep the point on the span the face covers: the ray's height is already on the
				// face's plane, and clamping along the span stays on it.
				const raw =
					((hit.worldPoint[0] - surface.start[0]) * dx + (hit.worldPoint[2] - surface.start[1]) * dz) /
					(length * length);
				const amount = Math.min(1, Math.max(0, raw));
				return [surface.start[0] + dx * amount, hit.worldPoint[1], surface.start[1] + dz * amount];
			}
		}
	}

	const elevation = surface.kind === 'flat' ? surface.elevationMeters : fragment.elevationMeters;
	const hit = intersectWorkingPlane(
		ray.ray,
		{
			originMeters: [0, elevation, 0],
			normal: [0, 1, 0],
			yawRadians: 0,
			datumMeters: elevation,
			supportedLocalExtent: null
		},
		evaluation,
		token
	);
	return hit.kind === 'intersected' ? hit.worldPoint : fallback;
}


/** Only a genuine forward intersection with the finite winning surface has a depth. */
function surfaceDepth(ray: PointerRay | null, surface: StagePickSurface): number | null {
	if (ray === null) return null;
	const o = ray.origin, d = ray.direction;
	let t: number;
	if (surface.kind === 'face') {
		const dx = surface.end[0] - surface.start[0], dz = surface.end[1] - surface.start[1];
		const denom = -dz * d[0] + dx * d[2];
		if (Math.abs(denom) < 1e-12) return null;
		t = (dz * (o[0] - surface.start[0]) - dx * (o[2] - surface.start[1])) / denom;
		if (!Number.isFinite(t) || t < 0) return null;
		const x = o[0] + t * d[0], y = o[1] + t * d[1], z = o[2] + t * d[2];
		const length2 = dx * dx + dz * dz;
		const u = length2 === 0 ? -1 : ((x - surface.start[0]) * dx + (z - surface.start[1]) * dz) / length2;
		return u >= 0 && u <= 1 && y >= surface.bottomMeters && y <= surface.topMeters ? t : null;
	}
	if (Math.abs(d[1]) < 1e-12) return null;
	t = (surface.elevationMeters - o[1]) / d[1];
	if (!Number.isFinite(t) || t < 0) return null;
	const point: [number, number] = [o[0] + t * d[0], o[2] + t * d[2]];
	if (surface.geometry.kind === 'polygon' && pointInPolygon(point, surface.geometry.polygon)) return t;
	// Include polygon boundaries and exact intersections with line-only surfaces.
	for (const [a, b] of planSegments(surface.geometry)) {
		if (closestOnCssSegment(point, a, b).distance <= 1e-8) return t;
	}
	return null;
}

/** Layout owns the retained index, exact tests and priority; Stage sees one winner. */
export function createPlanPickProvider(planFor: () => PlanEvaluationResult) {
	/**
	 * The retained pick index for one Plan evaluation.
	 *
	 * Built lazily on the first hit that needs it and kept with the evaluation, so a
	 * second click in the same view — or the same evaluation after a pan, which no
	 * longer produces a new one — costs no build. The Plan is the only key: its
	 * `fragments` array identity already names the compiled geometry and datum it
	 * was evaluated from, so a recompile or a parameter change retires the index
	 * with the evaluation.
	 */
	type RetainedPickIndex = {
		readonly index: PlanPickIndex;
		/** The fragments the index's entries address, in the hit path's priority order. */
		readonly fragments: readonly PlanFragment[];
	};
	const pickIndexes = new WeakMap<PlanEvaluation, RetainedPickIndex>();

	function pickIndexFor(plan: PlanEvaluation, context: StageAdapterContext): RetainedPickIndex {
		const existing = pickIndexes.get(plan);
		if (existing !== undefined) return existing;
		const geometry = context.snapshot.domain.geometry;
		// The fragments are indexed in the **hit path's own priority order**, so a
		// candidate index is also its rank: the caller never re-sorts to decide.
		//
		// That order is already `plan.fragments`': the evaluator emits Wall before
		// Opening before object before floor, then source identity, then interval, and
		// eligibility is a **per-source** fact, so a source's fragments are contiguous
		// and filtering out ineligible sources is order-preserving. Sorting here again
		// was an `O(F log F)` pass that could not change the array it sorted.
		const fragments = eligiblePlanFragments(plan);
		const boxes = fragments.map((fragment) => pickBoxOf(fragment, geometry, plan.datumMeters));
		const retained: RetainedPickIndex = { index: createPlanPickIndex(boxes), fragments };
		pickIndexes.set(plan, retained);
		return retained;
	}

	/**
	 * The world box that contains everything one fragment's exact test projects.
	 *
	 * **Conservative on purpose, and never the Plan cut.** A Wall fragment is drawn
	 * as faces at the compiled Wall's own extent (a lintel starts where the Opening
	 * ends), so the compiled Wall's bounds are the box. A flat fragment is tested at
	 * its own elevation only, so its plan extent at that elevation is exact. Deriving
	 * the box from the cut elevation would prune precisely the Walls above it — the
	 * defect the face surfaces were introduced to fix, moved into a broad phase.
	 */
	function pickBoxOf(
		fragment: PlanFragment,
		geometry: CompiledLayoutGeometry,
		datumMeters: number
	): PlanPickBox {
		const planBounds = planExtentOf(fragment.geometry);
		const elevation = Number.isFinite(fragment.elevationMeters)
			? fragment.elevationMeters
			: datumMeters;
		if (fragment.ref.sourceKind === 'wall') {
			const wall = indexedCompiledWall(geometry, fragment.ref.sourceId);
			if (wall !== undefined) {
				// The compiled Wall's own bounds plus its declared vertical extent. The
				// union is deliberate: `pickSurfacesOf` may fall back to the fragment's
				// whole line at full Wall height, and a box narrowed to the solid spans
				// would prune a hit the exact test would have made.
				return {
					minX: Math.min(wall.bounds3.min[0], planBounds.minX),
					minY: Math.min(wall.bounds3.min[1], datumMeters),
					minZ: Math.min(wall.bounds3.min[2], planBounds.minZ),
					maxX: Math.max(wall.bounds3.max[0], planBounds.maxX),
					maxY: Math.max(wall.bounds3.max[1], datumMeters + wall.height, elevation),
					maxZ: Math.max(wall.bounds3.max[2], planBounds.maxZ)
				};
			}
		}
		// A flat fragment is tested at its own elevation, and only there.
		return {
			minX: planBounds.minX,
			minY: elevation,
			minZ: planBounds.minZ,
			maxX: planBounds.maxX,
			maxY: elevation,
			maxZ: planBounds.maxZ
		};
	}

	function planExtentOf(geometry: PlanFragmentGeometry): {
		readonly minX: number;
		readonly minZ: number;
		readonly maxX: number;
		readonly maxZ: number;
	} {
		const points =
			geometry.kind === 'span'
				? [geometry.start, geometry.end]
				: geometry.kind === 'polyline'
					? geometry.polyline
					: geometry.polygon;
		let minX = Infinity;
		let minZ = Infinity;
		let maxX = -Infinity;
		let maxZ = -Infinity;
		for (const point of points) {
			if (point[0] < minX) minX = point[0];
			if (point[1] < minZ) minZ = point[1];
			if (point[0] > maxX) maxX = point[0];
			if (point[1] > maxZ) maxZ = point[1];
		}
		// An empty or non-finite plan gives a box the box test cannot prune, rather
		// than an empty one it would prune every time.
		if (!(minX <= maxX && minZ <= maxZ)) {
			return { minX: -Infinity, minZ: -Infinity, maxX: Infinity, maxZ: Infinity };
		}
		return { minX, minZ, maxX, maxZ };
	}

	return (query: StagePickQuery, context: StageAdapterContext): StageDomainPick | null => {
		const evaluation = context.evaluation;
		const css: [number, number] = [query.css[0] + evaluation.rect.left, query.css[1] + evaluation.rect.top];
		if (!css.every(Number.isFinite)) return null;
		const token = evaluation.token;
		const result = planFor();
		if (result.kind !== 'evaluated') return null;
		const project = (point: readonly [number, number, number]): readonly [number, number] | null => {
			const projected = projectWorld(point as Vec3, evaluation, token);
			return projected.kind === 'projected' && projected.visibility !== 'behind' ? projected.css : null;
		};
		const retained = pickIndexFor(result.plan, context);
		for (const index of retained.index.candidates(css, PLAN_HIT_TOLERANCE_CSS_PX, project)) {
			const fragment = retained.fragments[index];
			if (fragment === undefined) continue;
			const surfaces = pickSurfacesOf(fragment, context.snapshot.domain.geometry, context.snapshot.domain.datumMeters);
			const pick = cssDistanceToSurfaces(css, surfaces, project);
			if (pick === null || pick.distanceCss > PLAN_HIT_TOLERANCE_CSS_PX) continue;
			const rayResult = pointerRay(css, evaluation, token);
			let worldPoint = worldPointOnSurface(css, pick.surface, fragment, evaluation, token);
			if (query.purpose === 'tool' && query.tool?.kind === 'measure') {
				const candidates: Vec3[] = [];
				const wall = fragment.ref.sourceKind === 'wall' ? indexedCompiledWall(context.snapshot.domain.geometry, fragment.ref.sourceId) : undefined;
				if (wall !== undefined && wall.samples.length) {
					for (const sample of [wall.samples[0]!, wall.samples[wall.samples.length - 1]!]) candidates.push([sample.point[0], context.snapshot.domain.datumMeters, sample.point[1]]);
				}
				for (const junction of context.snapshot.domain.geometry.junctions ?? []) candidates.push([junction.point[0], context.snapshot.domain.datumMeters, junction.point[1]]);
				let nearest = PLAN_HIT_TOLERANCE_CSS_PX;
				for (const point of candidates) {
					const projected = project(point);
					if (projected === null) continue;
					const d = Math.hypot(projected[0] - css[0], projected[1] - css[1]);
					if (d <= nearest) { nearest = d; worldPoint = point; }
				}
			}
			return {
				hit: { sourceId: fragment.ref.sourceId, sourceKind: fragment.ref.sourceKind,
					generationId: fragment.ref.generationId, stream: fragment.ref.stream, subRef: fragment.ref.subRef,
					worldPoint },
				refusal: query.purpose === 'tool' && query.tool?.kind === 'erase' && fragment.ref.sourceKind === 'room-floor' ? 'A Room floor cannot be erased.' : null, depthMeters: surfaceDepth(rayResult.kind === 'ray' ? rayResult.ray : null, pick.surface),
				planLayer: 40, cssDistance: pick.distanceCss
			};
		}
		return null;
	};
}
