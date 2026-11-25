import { Box3, Ray, Vector3 } from 'three';
import { compiledOpeningFaceLoops } from './opening-faces';
import { projectWorld, pointerRay, intersectWorkingPlane, type Vec3, type ViewportEvaluation, type ViewportEvaluationToken, type PointerRay } from '@portfolio/camera-core';
import { indexedCompiledWall, eligiblePlanFragments, pointInPolygon, type CompiledLayoutGeometry, type LayoutVec2, type OverheadSource, type PlanEvaluation, type PlanFragment, type PlanFragmentGeometry, type PlanSubRef } from '@portfolio/layout-core';
import { createPlanPickIndex, type PlanPickBox, type PlanPickIndex } from './plan-pick-index';
import { LIFT_OUTLINE_DEPTH_BAND_METERS, LIFT_OUTLINE_DROP_METERS } from '../stage/lift-ink';
import type { StageAdapterContext, StageDomainPick, StageHitSourceKind, StagePickQuery } from '../stage/stage-facade';
import { cutWallBandsOf, fragmentLayer, PAPER_LAYER, type CutWallSpan } from '../stage/paper-plan';
import { drawnShownPlanCells, sliceHides, type DrawnResolvedSlice, type ResolvedSlice } from '../stage/slice/slice-cut';
import {
	clipRegionToHalfPlanes,
	pointOnSegment,
	ringSignedArea,
	segmentIntervalInHalfPlanes
} from '../stage/slice/slice-clip-2d';
import { resolvedSliceNow } from '../stage/slice/slice-resolved';
import {
	resolvedCutawayNow,
	type ResolvedCutaway
} from '../stage/cutaway/cutaway-resolved';
import type { PlanEvaluationResult } from '@portfolio/layout-core';

/** The aperture faces and the reveals between them are pickable, but never drawn. */
function openingRayHit(ray: Ray, faces: readonly Vector3[][]): Vector3 | null {
	const [front, back] = faces;
	if (front === undefined || back === undefined) return null;
	const point = new Vector3();
	let nearest: Vector3 | null = null;
	let depth = Infinity;
	function test(a: Vector3, b: Vector3, c: Vector3): void {
		if (ray.intersectTriangle(a, b, c, false, point) === null) return;
		const distance = ray.origin.distanceToSquared(point);
		if (distance >= depth) return;
		depth = distance;
		nearest = point.clone();
	}
	for (const face of faces) {
		for (let i = 1; i + 1 < face.length; i++) test(face[0]!, face[i]!, face[i + 1]!);
	}
	for (let i = 0; i < front.length; i++) {
		const j = (i + 1) % front.length;
		test(front[i]!, front[j]!, back[j]!);
		test(front[i]!, back[j]!, back[i]!);
	}
	return nearest;
}

type LayoutPickContext = Pick<StageAdapterContext, 'snapshot' | 'evaluation' | 'pickScene'>;

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

/** The surface kinds, for the Slice-aware tests (they never need the whole type graph). */
export type { StagePickSurface };

/** A band thinner than this is not a surface a pointer can land on. */
const SLICE_EMPTY_BAND_METERS = 1e-6;

/**
 * A Wall face **clamped to what the Slice draws** (§2.5).
 *
 * The face is the compiled solid's vertical extent, which is right at rest. Under a
 * cut the part above `cutY` (and, with a finite depth, the part below `lowerY`) is
 * not drawn, so it must not be selectable either: a click on the sky between two
 * cut Walls would otherwise take a Wall height the creator cannot see. An empty band
 * drops the surface entirely instead of leaving a degenerate one.
 */
export function clampFaceToSlice(surface: StagePickSurface, slice: ResolvedSlice | null): StagePickSurface | null {
	// A drawn cut removes a vertical side, not a horizontal band: the face's compiled
	// vertical extent is unchanged, and `clipSurfaceToSlice` keeps its shown spans.
	if (slice === null || slice.kind === 'drawn' || surface.kind !== 'face') return surface;
	const bottomMeters = Math.max(surface.bottomMeters, slice.lowerY ?? Number.NEGATIVE_INFINITY);
	const topMeters = Math.min(surface.topMeters, slice.cutY);
	return topMeters <= bottomMeters + SLICE_EMPTY_BAND_METERS ? null : { ...surface, bottomMeters, topMeters };
}

/** The first plan point of a flat surface, for the hidden-point question. */
function firstPlanPoint(geometry: PlanFragmentGeometry): LayoutVec2 {
	if (geometry.kind === 'span') return geometry.start;
	if (geometry.kind === 'polyline') return geometry.polyline[0] ?? [0, 0];
	return geometry.polygon[0] ?? [0, 0];
}

/**
 * Whether a flat fragment is drawn at all under the cut.
 *
 * Level keeps SL1's first-point rule: its cut hides a horizontal band, so one
 * representative point is exact for a fragment at a single elevation. A drawn cut is
 * a plan region, so the answer is whether any of the fragment survives clipping to it.
 */
export function flatDrawn(surface: StagePickSurface, slice: ResolvedSlice | null): boolean {
	if (slice === null || surface.kind !== 'flat') return true;
	if (slice.kind !== 'drawn') {
		const point = firstPlanPoint(surface.geometry);
		return !sliceHides(slice, point[0], surface.elevationMeters, point[1]);
	}
	return clipSurfaceToSlice(surface, slice).length > 0;
}

/** A plan sub-span shorter than this is not a surface a pointer can land on. */
const SLICE_EMPTY_SPAN_METERS = 1e-6;

/**
 * A Wall face **clamped to its stub** (X2, §3.6 step 4).
 *
 * The face is the compiled solid's vertical extent, which is right at rest. Under
 * the cutaway the part above `stubTopY` is not drawn, so it must not be selectable
 * either: a click on the air above a stub would otherwise take a Wall the creator
 * cannot see. Composing with the Slice's own clamp lets the lower bound win per
 * Wall without a second rule.
 */
export function clampFaceToCutaway(
	surface: StagePickSurface,
	cutaway: ResolvedCutaway | null
): StagePickSurface | null {
	if (cutaway === null || surface.kind !== 'face') return surface;
	const topMeters = Math.min(surface.topMeters, cutaway.stubTopY);
	return topMeters <= surface.bottomMeters + SLICE_EMPTY_BAND_METERS
		? null
		: { ...surface, topMeters };
}

/**
 * The surfaces a pick may test after the cutaway: a **cut** Wall stops at its stub.
 *
 * `wallId` is the fragment's own Wall. It is required: a cut near Wall must not
 * shorten the pick quad of another Wall that is still drawn in full. Only Wall
 * faces are removed; floors, objects and Opening symbols are not part of X2
 * (owner ruling O-1 leaves Scene objects as built).
 */
export function clipSurfaceToCutaway(
	surface: StagePickSurface,
	cutaway: ResolvedCutaway | null,
	wallId: string | null = null
): StagePickSurface[] {
	if (cutaway === null || wallId === null || !cutaway.wallIds.has(wallId)) return [surface];
	const clamped = clampFaceToCutaway(surface, cutaway);
	return clamped === null ? [] : [clamped];
}

/**
 * The shown parts of one plan segment under a drawn cut, as `[t0, t1]` intervals.
 *
 * Each shown cell is convex, so a segment meets it in one interval; the cells only
 * touch along their boundaries, so adjacent intervals are merged.
 */
function shownSegmentIntervals(
	start: LayoutVec2,
	end: LayoutVec2,
	slice: DrawnResolvedSlice
): (readonly [number, number])[] {
	const intervals = drawnShownPlanCells(slice)
		.map((cell) => segmentIntervalInHalfPlanes(start, end, cell))
		.filter((interval): interval is readonly [number, number] => interval !== null)
		.sort((left, right) => left[0] - right[0]);
	const merged: [number, number][] = [];
	for (const [lo, hi] of intervals) {
		const last = merged[merged.length - 1];
		if (last !== undefined && lo <= last[1] + 1e-12) last[1] = Math.max(last[1], hi);
		else merged.push([lo, hi]);
	}
	const length = Math.hypot(end[0] - start[0], end[1] - start[1]);
	return merged.filter(([lo, hi]) => (hi - lo) * length > SLICE_EMPTY_SPAN_METERS || length === 0);
}

/**
 * The surfaces a pick may test **after** the Slice: exactly what is drawn.
 *
 * Level clamps a face's vertical band and drops a flat fragment whose elevation is
 * hidden (SL1, unchanged). A drawn cut does not read `y`, so its shown region is a
 * plan region — three convex cells whose union is `!sliceHides` — and every surface
 * is **clipped** to it: a Wall face becomes its shown sub-spans, a floor or footprint
 * becomes its shown polygons (disjoint islands included), a line its shown pieces.
 * The pick then measures the pointer against geometry the GPU actually drew, so a
 * click on a clipped-away part of a Wall or floor misses it, and a narrow shown strip
 * of a large fragment is still found. No sampling: a fragment whose every vertex and
 * midpoint is hidden can still cross the shown band.
 */
export function clipSurfaceToSlice(surface: StagePickSurface, slice: ResolvedSlice | null): StagePickSurface[] {
	if (slice === null) return [surface];
	if (slice.kind !== 'drawn') {
		const clamped = clampFaceToSlice(surface, slice);
		return clamped !== null && flatDrawn(clamped, slice) ? [clamped] : [];
	}
	if (slice.halfLength <= 0) return [surface];
	if (surface.kind === 'face') {
		return shownSegmentIntervals(surface.start, surface.end, slice).map(([lo, hi]) => ({
			...surface,
			start: pointOnSegment(surface.start, surface.end, lo) as LayoutVec2,
			end: pointOnSegment(surface.start, surface.end, hi) as LayoutVec2
		}));
	}
	const geometry = surface.geometry;
	if (geometry.kind !== 'polygon') {
		const pieces: StagePickSurface[] = [];
		for (const [start, end] of planSegments(geometry)) {
			for (const [lo, hi] of shownSegmentIntervals(start, end, slice)) {
				pieces.push({
					kind: 'flat',
					elevationMeters: surface.elevationMeters,
					geometry: {
						kind: 'span',
						start: pointOnSegment(start, end, lo) as LayoutVec2,
						end: pointOnSegment(start, end, hi) as LayoutVec2
					}
				} as StagePickSurface);
			}
		}
		return pieces;
	}
	if (geometry.polygon.length < 3) return [];
	// The region clip expects its interior on the left: a Layout polygon may arrive
	// in either winding.
	const ring = ringSignedArea(geometry.polygon) >= 0 ? [...geometry.polygon] : [...geometry.polygon].reverse();
	const pieces: StagePickSurface[] = [];
	for (const cell of drawnShownPlanCells(slice)) {
		const result = clipRegionToHalfPlanes([{ points: ring, tags: ring.map(() => '') }], cell);
		// A self-crossing footprint is not a region; keep SL1's whole-surface answer for
		// it rather than invent a clip (Layout's own polygons are simple).
		if (result.kind === 'invalid') return [surface];
		for (const piece of result.rings) {
			pieces.push({
				kind: 'flat',
				elevationMeters: surface.elevationMeters,
				geometry: { kind: 'polygon', polygon: piece.points as LayoutVec2[] }
			} as StagePickSurface);
		}
	}
	return pieces;
}

export function clipPlanRegionFragments(plan: PlanEvaluation, slice: ResolvedSlice | null): PlanEvaluation {
	if (slice === null || !plan.fragments.some((fragment) => fragment.ref.sourceKind === 'region')) return plan;
	const clip = (fragment: PlanFragment): PlanFragment[] => {
		if (fragment.ref.sourceKind !== 'region') return [fragment];
		return clipSurfaceToSlice({
			kind: 'flat', elevationMeters: fragment.elevationMeters, geometry: fragment.geometry
		}, slice).flatMap((surface) => surface.kind === 'flat' ? [{ ...fragment, geometry: surface.geometry }] : []);
	};
	return {
		...plan,
		fragments: plan.fragments.flatMap(clip),
		streams: {
			cut: plan.streams.cut.flatMap(clip),
			projected: plan.streams.projected.flatMap(clip),
			hidden: plan.streams.hidden.flatMap(clip),
			symbol: plan.streams.symbol
		}
	};
}


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
	datumMeters: number,
	slice: ResolvedSlice | null = null,
	cutaway: ResolvedCutaway | null = null
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
	const faces: StagePickSurface[] = matching.map((span) => ({
		kind: 'face' as const,
		start: span.start,
		end: span.end,
		bottomMeters: datumMeters + span.bottomY,
		topMeters: datumMeters + span.topY
	}));
	const stubTopY = cutaway !== null && cutaway.wallIds.has(wall.wallId) ? cutaway.stubTopY : null;
	return [
		...faces,
		...(stubTopY === null ? [] : cutawayCapSurfacesOf(wall, matching, stubTopY, datumMeters)),
		...capSurfacesOf(fragment, wall, slice, interval)
	];
}

/**
 * The stub's horizontal top as a pick surface (X2 §3.6).
 *
 * A ray that lands on the cap from above selects the Wall, exactly like a ray on
 * the stub's face. The band is `cutWallBandsOf` — the same compiled centreline and
 * thickness Paper's cut uses — over the spans solid at the stub height; it is
 * never drawn here.
 */
function cutawayCapSurfacesOf(
	wall: NonNullable<ReturnType<typeof indexedCompiledWall>>,
	/** The fragment's own compiled spans, so a cap cannot answer for a sibling interval. */
	matching: NonNullable<ReturnType<typeof indexedCompiledWall>>['solidSpans'],
	stubTopY: number,
	datumMeters: number
): readonly StagePickSurface[] {
	const localStub = stubTopY - datumMeters;
	const spans: CutWallSpan[] = matching
		.filter((span) => span.bottomY <= localStub + 1e-6 && localStub <= span.topY - 1e-6)
		.map((span) => ({ startDistance: span.startDistance, endDistance: span.endDistance }));
	if (spans.length === 0) return [];
	return cutWallBandsOf(wall, spans).map((polygon) => ({
		kind: 'flat' as const,
		elevationMeters: stubTopY,
		geometry: { kind: 'polygon' as const, polygon }
	}));
}

/**
 * The **cap surface** a cut Wall fragment adds: a flat band at `cutY` (§2.5 step 2).
 *
 * The cut reveals a filled section, so the exposed top of the Wall is the surface the
 * creator points at. Its plan band comes from `cutWallBandsOf` — the same band Paper
 * draws with — which is accurate enough for a hit test and is never drawn here. Not a
 * second geometric derivation of the Wall: it is the compiled centreline and
 * thickness, which is what the paper cut is.
 */
function capSurfacesOf(
	fragment: PlanFragment,
	wall: NonNullable<ReturnType<typeof indexedCompiledWall>>,
	slice: ResolvedSlice | null,
	interval: { readonly start: number; readonly end: number } | null
): readonly StagePickSurface[] {
	if (slice === null || slice.kind === 'drawn') return [];
	if (fragment.ref.stream !== 'cut') return [];
	if (interval === null) return [];
	const span: CutWallSpan = { startDistance: interval.start, endDistance: interval.end };
	return cutWallBandsOf(wall, [span]).map((polygon) => ({
		kind: 'flat' as const,
		elevationMeters: slice.cutY,
		geometry: { kind: 'polygon' as const, polygon }
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
export function createPlanPickProvider(
	planFor: () => PlanEvaluationResult,
	/**
	 * The overheads the live Lift reading lifts, named by Layout for the geometry in
	 * the pick context. No accessor means Lift is off: this test adds no hit.
	 */
	liftedOutlines: (geometry: CompiledLayoutGeometry) => readonly OverheadSource[] = () => [],
	/**
	 * The live Slice, read on the pointer (§2.5). The default reads the route's own
	 * mirror — the same value the Canvas draws with — so the adapter needs no new
	 * wiring and the provider cannot hold a cut the Stage is not showing. With no
	 * reading every surface, cap and hidden-point test below is exactly today's
	 * behaviour, which is what keeps ordinary picking unchanged when Slice is off.
	 */
	sliceOf: () => ResolvedSlice | null = resolvedSliceNow,
	/**
	 * The live effective cutaway (X2), read on the pointer. Its default is the
	 * route's mirror — the same set the Canvas cuts — so the adapter needs no new
	 * wiring and the provider can never hold a cut the Stage is not showing.
	 */
	cutawayOf: () => ResolvedCutaway | null = resolvedCutawayNow
) {
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

	function pickIndexFor(plan: PlanEvaluation, context: LayoutPickContext): RetainedPickIndex {
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

	const openingTargets = new WeakMap<RetainedPickIndex, readonly {
		fragment: PlanFragment;
		/** The host Wall, so the cutaway's stub filter can answer per Opening. */
		wallId: string;
		faces: Vector3[][];
		bounds: Box3;
	}[]>();

	function openingTargetsFor(retained: RetainedPickIndex, geometry: CompiledLayoutGeometry) {
		const cached = openingTargets.get(retained);
		if (cached !== undefined) return cached;
		const fragments = new Map(retained.fragments.filter((fragment) => fragment.ref.sourceKind === 'opening')
			.map((fragment) => [fragment.ref.sourceId, fragment]));
		const elevations = new Map(geometry.floors.map((floor) => [floor.floorId, floor.elevation]));
		const targets = geometry.walls.flatMap((wall) => wall.openings.flatMap((opening) => {
			const fragment = fragments.get(opening.openingId);
			if (fragment === undefined) return [];
			const faces = compiledOpeningFaceLoops(wall, opening, elevations.get(wall.floorId) ?? 0)
				.map((face) => face.map((point) => new Vector3(...point)));
			return [{ fragment, wallId: wall.wallId, faces, bounds: new Box3().setFromPoints(faces.flat()) }];
		}));
		openingTargets.set(retained, targets);
		return targets;
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

	/**
	 * Layout's Eraser eligibility, in its own words. A Room floor derives
	 * from its Walls and a Layout object (the plinth) has no Layout delete, so the
	 * Eraser refuses them here rather than skipping to a subject behind them.
	 */
	const eraseRefusal = (sourceKind: string): string | null =>
		sourceKind === 'region'
			? null
			: sourceKind === 'room-floor'
			? 'A Room floor cannot be erased.'
			: sourceKind === 'object'
				? 'A plinth cannot be erased; Layout has no delete for its objects.'
				: null;

	/**
	 * A lifted overhead answers the pointer through the **outline it is drawn as**.
	 *
	 * A lift removes the lid from the view and from rays, so the dashed line is the
	 * only thing that stands for it. The test is in CSS pixels, where the creator
	 * aims, at the same tolerance as every other Layout hit — and at the plane the
	 * outline is drawn on, not the lid's own elevation, so the line under the
	 * pointer is the line that answers.
	 *
	 * The surface under the pointer keeps the final say: an outline behind a nearer
	 * Wall is not editable through that Wall. The hit names the subject the
	 * overhead belongs to: a Room's floor fragment for a generated lid, or the
	 * region fragment for an authored slab (V1c).
	 */
	function liftOutlinePick(
		css: readonly [number, number],
		evaluation: ViewportEvaluation,
		token: ViewportEvaluationToken,
		context: LayoutPickContext,
		retained: RetainedPickIndex,
		slice: ResolvedSlice | null
	): StageDomainPick | null {
		const sources = liftedOutlines(context.snapshot.domain.geometry);
		if (sources.length === 0) return null;
		const rayResult = pointerRay(css, evaluation, token);
		if (rayResult.kind !== 'ray') return null;
		const { origin, direction } = rayResult.ray;
		const projectPoint = (point: readonly [number, number, number]) => {
			const projected = projectWorld(point as Vec3, evaluation, token);
			return projected.kind === 'projected' && projected.visibility !== 'behind'
				? projected.css
				: null;
		};
		let best: {
			readonly fragment: PlanFragment;
			readonly worldPoint: Vec3;
			readonly depthMeters: number;
			readonly cssDistance: number;
		} | null = null;
		for (const source of sources) {
			const outline = source.outline;
			if (outline.length < 3) continue;
			const elevation = source.elevation - LIFT_OUTLINE_DROP_METERS;
			for (let index = 0; index < outline.length; index += 1) {
				const start = outline[index]!;
				const end = outline[(index + 1) % outline.length]!;
				const startCss = projectPoint([start[0], elevation, start[1]]);
				const endCss = projectPoint([end[0], elevation, end[1]]);
				// An endpoint behind the camera is not something the pointer is over.
				if (startCss === null || endCss === null) continue;
				const closest = closestOnCssSegment(css, startCss, endCss);
				if (closest.distance > PLAN_HIT_TOLERANCE_CSS_PX) continue;
				if (best !== null && closest.distance >= best.cssDistance) continue;
				const worldPoint: Vec3 = [
					start[0] + (end[0] - start[0]) * closest.amount,
					elevation,
					start[1] + (end[1] - start[1]) * closest.amount
				];
				// A lid the cut has removed is not an outline the creator can aim at.
				if (slice !== null && sliceHides(slice, worldPoint[0], worldPoint[1], worldPoint[2])) continue;
				// Depth along the pointer's own ray, so an outline and a surface are
				// compared on one axis.
				const depthMeters =
					(worldPoint[0] - origin[0]) * direction[0] +
					(worldPoint[1] - origin[1]) * direction[1] +
					(worldPoint[2] - origin[2]) * direction[2];
				if (!(depthMeters > 0)) continue;
				const fragment = retained.fragments.find((candidate) =>
					source.key.kind === 'region'
						? candidate.ref.sourceKind === 'region' &&
							candidate.ref.sourceId === source.subject.id
						: candidate.ref.sourceKind === 'room-floor' &&
							candidate.ref.sourceId === source.subject.id
				);
				if (fragment === undefined) continue;
				best = { fragment, worldPoint, depthMeters, cssDistance: closest.distance };
				break;
			}
		}
		if (best === null) return null;
		const drawn = context.pickScene(rayResult.ray);
		if (
			drawn !== null &&
			drawn.distanceMeters < best.depthMeters - LIFT_OUTLINE_DEPTH_BAND_METERS
		) {
			return null;
		}
		return {
			hit: {
				sourceId: best.fragment.ref.sourceId,
				sourceKind: best.fragment.ref.sourceKind,
				generationId: best.fragment.ref.generationId,
				stream: best.fragment.ref.stream,
				subRef: best.fragment.ref.subRef,
				worldPoint: best.worldPoint
			},
			refusal: null,
			depthMeters: best.depthMeters,
			planLayer: fragmentLayer(best.fragment),
			cssDistance: best.cssDistance
		};
	}

	return (query: StagePickQuery, context: LayoutPickContext): StageDomainPick | null => {
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
		const slice = sliceOf();
		const cutaway = cutawayOf();
		const erasing = query.purpose === 'tool' && query.tool?.kind === 'erase';
		// In the 3D reading Paint needs the exact rendered triangle: the side tag
		// distinguishes the two outward Wall faces and excludes tops, caps and
		// Opening reveals. The ordinary Plan hit remains Layout's projected pick.
		if (evaluation.renderedReading !== 'plan' && query.purpose === 'tool' && query.tool?.kind === 'paint') {
			const ray = pointerRay(css, evaluation, token);
			const drawn = ray.kind === 'ray' ? context.pickScene(ray.ray) : null;
			if (drawn === null || drawn.entityId !== null || drawn.layoutId === undefined || drawn.layoutKind === undefined) return null;
			let sourceKind: StageHitSourceKind;
			let sourceId = drawn.layoutId;
			let subRef: PlanSubRef | null = null;
			if (drawn.layoutKind === 'wall' || drawn.layoutKind === 'wall-failure') {
				sourceKind = 'wall';
				sourceId = drawn.wallId ?? drawn.layoutId;
				if (drawn.wallSide !== undefined) subRef = { kind: 'component', componentId: `side:${drawn.wallSide}` };
			} else if (drawn.layoutKind === 'floor') {
				sourceKind = 'room-floor';
			} else if (drawn.layoutKind === 'lid') {
				sourceKind = 'room-lid';
			} else if (drawn.layoutKind === 'region') {
				sourceKind = 'region';
				if (drawn.region !== undefined) subRef = { kind: 'component', componentId: drawn.region.face };
			} else {
				sourceKind = 'object';
			}
			return {
				hit: {
					sourceId, sourceKind, generationId: context.snapshot.compileGeneration,
					stream: 'projected', subRef, worldPoint: drawn.worldPoint
				},
				refusal: null,
				depthMeters: drawn.distanceMeters,
				planLayer: PAPER_LAYER.projected,
				cssDistance: 0
			};
		}
		const pickOpeningIn3D = evaluation.renderedReading !== 'plan' &&
			(query.purpose !== 'tool' || erasing) && (query.tool === null || erasing);
		if (pickOpeningIn3D) {
			const rayResult = pointerRay(css, evaluation, token);
			if (rayResult.kind === 'ray') {
				const { origin, direction } = rayResult.ray;
				const ray = new Ray(new Vector3(...origin), new Vector3(...direction));
				let nearest: StageDomainPick | null = null;
				for (const { fragment, wallId, faces, bounds } of openingTargetsFor(retained, context.snapshot.domain.geometry)) {
					if (!ray.intersectsBox(bounds)) continue;
					const point = openingRayHit(ray, faces);
					if (point === null) continue;
					// A reveal the cut removes is not a place to aim at, and it must not
					// answer for the opening's visible part either.
					if (slice !== null && sliceHides(slice, point.x, point.y, point.z)) continue;
					// An Opening above a cut Wall's stub is not selectable: its host is
					// not drawn there, and the ray must reach the interior behind it.
					if (cutaway !== null && cutaway.wallIds.has(wallId) && point.y > cutaway.stubTopY + 1e-4) continue;
					const depthMeters = ray.origin.distanceTo(point);
					if (depthMeters >= (nearest?.depthMeters ?? Infinity)) continue;
					nearest = {
						hit: { sourceId: fragment.ref.sourceId, sourceKind: 'opening',
							generationId: fragment.ref.generationId, stream: fragment.ref.stream,
							subRef: fragment.ref.subRef, worldPoint: point.toArray() },
						depthMeters, cssDistance: 0, planLayer: fragmentLayer(fragment), refusal: null
					};
				}
				if (nearest !== null) {
					const drawn = context.pickScene(rayResult.ray);
					if (drawn === null || nearest.depthMeters! <= drawn.distanceMeters + 1e-5) return nearest;
				}
			}
		}
		if (evaluation.renderedReading !== 'plan' && context.snapshot.domain.geometry.regions.length > 0) {
			const ray = pointerRay(css, evaluation, token);
			const drawn = ray.kind === 'ray' ? context.pickScene(ray.ray) : null;
			if (drawn?.region) {
				return {
					hit: {
						sourceId: drawn.region.regionId, sourceKind: 'region',
						generationId: context.snapshot.compileGeneration, stream: 'projected',
						subRef: { kind: 'component', componentId: drawn.region.face },
						worldPoint: drawn.worldPoint
					},
					refusal: query.purpose === 'tool' && query.tool?.kind === 'erase' ? eraseRefusal('region') : null,
					depthMeters: drawn.distanceMeters, planLayer: PAPER_LAYER.projected, cssDistance: 0
				};
			}
		}
		const openingOverHost = erasing || (evaluation.renderedReading === 'plan' && query.purpose === 'select' && query.tool === null);
		const roomAreaOf = (roomId: string): number | null => {
			const room = context.snapshot.domain.geometry.rooms.find((candidate) => candidate.roomId === roomId);
			if (room === undefined) return null;
			let twice = 0;
			for (let index = 0; index < room.floorPolygon.length; index += 1) {
				const current = room.floorPolygon[index]!;
				const next = room.floorPolygon[(index + 1) % room.floorPolygon.length]!;
				twice += current[0] * next[1] - next[0] * current[1];
			}
			return Math.abs(twice) / 2;
		};
		type Ranked = {
			readonly fragment: PlanFragment;
			readonly pick: NonNullable<ReturnType<typeof cssDistanceToSurfaces>>;
			/** A Room floor's compiled area, for innermost containment. */
			readonly roomArea: number | null;
		};
		let winner: Ranked | null = null;
		// A Room floor is the last source rank, so it can never outrank a Wall,
		// Opening or object. It is tracked separately: two floors that both contain
		// the pointer must be compared (innermost wins), and the first floor must
		// not end the scan before that comparison can run.
		let floorWinner: Ranked | null = null;
		const innermost = (candidate: Ranked, incumbent: Ranked): boolean => {
			if (candidate.roomArea === null || incumbent.roomArea === null) return false;
			if (candidate.pick.distanceCss > incumbent.pick.distanceCss + 1e-9) return false;
			return (
				candidate.roomArea < incumbent.roomArea - 1e-9 ||
				(Math.abs(candidate.roomArea - incumbent.roomArea) <= 1e-9 &&
					candidate.fragment.ref.sourceId < incumbent.fragment.ref.sourceId)
			);
		};
		for (const index of retained.index.candidates(css, PLAN_HIT_TOLERANCE_CSS_PX, project)) {
			const fragment = retained.fragments[index];
			if (fragment === undefined || (fragment.ref.sourceKind === 'region' && evaluation.renderedReading !== 'plan') || (pickOpeningIn3D && fragment.ref.sourceKind === 'opening')) continue;
			const surfaces = pickSurfacesOf(
				fragment,
				context.snapshot.domain.geometry,
				context.snapshot.domain.datumMeters,
				slice,
				cutaway
			)
				.flatMap((surface) =>
					clipSurfaceToCutaway(
						surface,
						cutaway,
						fragment.ref.sourceKind === 'wall' ? fragment.ref.sourceId : null
					)
				)
				.flatMap((surface) => clipSurfaceToSlice(surface, slice));
			const pick = cssDistanceToSurfaces(css, surfaces, project);
			if (pick === null || pick.distanceCss > PLAN_HIT_TOLERANCE_CSS_PX) continue;
			const roomArea =
				fragment.ref.sourceKind === 'room-floor' ? roomAreaOf(fragment.ref.sourceId) : null;
			if (roomArea !== null) {
				// Two Room floors can both contain the pointer at the same depth. The
				// innermost Space wins: a booth inside a hall selects the booth.
				const ranked = { fragment, pick, roomArea };
				if (floorWinner === null || innermost(ranked, floorWinner)) floorWinner = ranked;
				continue;
			}
			if (winner === null) {
				winner = { fragment, pick, roomArea };
				// Plan Select and Eraser name an Opening over its own host Wall.
				if (!openingOverHost || fragment.ref.sourceKind !== 'wall') break;
				continue;
			}
			if (fragment.ref.sourceKind === 'opening' && winner.fragment.ref.sourceKind === 'wall'
				&& context.snapshot.domain.geometry.walls?.some((wall) => wall.wallId === winner!.fragment.ref.sourceId
					&& wall.openings.some((opening) => opening.openingId === fragment.ref.sourceId))) {
				winner = { fragment, pick, roomArea };
				break;
			}
		}
		if (winner === null) winner = floorWinner;
		// A lifted overhead is only reachable in the 3D reading and only by the pointer's
		// own verbs: a tool (Eraser, Measure) still works on what it can see.
		if (evaluation.renderedReading !== 'plan' && query.purpose !== 'tool') {
			const outlineRay = pointerRay(css, evaluation, token);
			const winnerDepth =
				winner === null
					? null
					: surfaceDepth(outlineRay.kind === 'ray' ? outlineRay.ray : null, winner.pick.surface);
			const outline = liftOutlinePick(css, evaluation, token, context, retained, slice);
			if (
				outline !== null &&
				(winnerDepth === null ||
					(outline.depthMeters ?? Infinity) <= winnerDepth + LIFT_OUTLINE_DEPTH_BAND_METERS)
			) {
				return outline;
			}
		}
		if (winner !== null) {
			const { fragment, pick } = winner;
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
				refusal: query.purpose === 'tool' && query.tool?.kind === 'erase' ? eraseRefusal(fragment.ref.sourceKind) : null, depthMeters: surfaceDepth(rayResult.kind === 'ray' ? rayResult.ray : null, pick.surface),
				planLayer: fragmentLayer(fragment), cssDistance: pick.distanceCss
			};
		}
		return null;
	};
}
