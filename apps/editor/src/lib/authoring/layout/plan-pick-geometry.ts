/**
 * The Plan pick geometry: surfaces, screen-space distance and ray readings.
 * The provider composes these; this module owns no picker state.
 */
import { Ray, Vector3 } from 'three';
import {
	pointerRay,
	intersectWorkingPlane,
	type ViewportEvaluation,
	type ViewportEvaluationToken,
	type PointerRay,
} from '@portfolio/camera-core/viewport';
import type { Vec3 } from '@portfolio/camera-core/camera';
import {
	indexedCompiledWall,
	pointInPolygon,
	type CompiledLayoutGeometry,
	type LayoutVec2,
} from '@portfolio/layout-core/geometry';
import {
	type PlanEvaluation,
	type PlanFragment,
	type PlanFragmentGeometry,
} from '@portfolio/layout-core/world';
import type { StageAdapterContext } from '../stage/stage-facade';
import { cutWallBandsOf, type CutWallSpan } from '../stage/paper-plan';
import {
	drawnShownPlanCells,
	sliceHides,
	type DrawnResolvedSlice,
	type ResolvedSlice,
} from '../stage/slice/slice-cut';
import {
	clipRegionToHalfPlanes,
	pointOnSegment,
	ringSignedArea,
	segmentIntervalInHalfPlanes,
} from '../stage/slice/slice-clip-2d';
import { type ResolvedCutaway } from '../stage/cutaway/cutaway-resolved';

/** The aperture faces and the reveals between them are pickable, but never drawn. */
export function openingRayHit(ray: Ray, faces: readonly Vector3[][]): Vector3 | null {
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

export type LayoutPickContext = Pick<StageAdapterContext, 'snapshot' | 'evaluation' | 'pickScene'>;

export const PLAN_HIT_TOLERANCE_CSS_PX = 8;
/** The closest point on one CSS segment to a CSS point, as a `[distance, amount]` pair. */
export function closestOnCssSegment(
	point: readonly [number, number],
	start: readonly [number, number],
	end: readonly [number, number],
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
		amount,
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

export type StagePick = { readonly distanceCss: number; readonly surface: StagePickSurface };

/** The surface kinds, for the Slice-aware tests (they never need the whole type graph). */
export type { StagePickSurface };

/** A band thinner than this is not a surface a pointer can land on. */
const SLICE_EMPTY_BAND_METERS = 1e-6;

/**
 * A Wall face **clamped to what the Slice draws**.
 *
 * The face is the compiled solid's vertical extent, which is right at rest. Under a
 * cut the part above `cutY` (and, with a finite depth, the part below `lowerY`) is
 * not drawn, so it must not be selectable either: a click on the sky between two
 * cut Walls would otherwise take a Wall height the creator cannot see. An empty band
 * drops the surface entirely instead of leaving a degenerate one.
 */
export function clampFaceToSlice(
	surface: StagePickSurface,
	slice: ResolvedSlice | null,
): StagePickSurface | null {
	// A drawn cut removes a vertical side, not a horizontal band: the face's compiled
	// vertical extent is unchanged, and `clipSurfaceToSlice` keeps its shown spans.
	if (slice === null || slice.kind === 'drawn' || surface.kind !== 'face') return surface;
	const bottomMeters = Math.max(surface.bottomMeters, slice.lowerY ?? Number.NEGATIVE_INFINITY);
	const topMeters = Math.min(surface.topMeters, slice.cutY);
	return topMeters <= bottomMeters + SLICE_EMPTY_BAND_METERS
		? null
		: { ...surface, bottomMeters, topMeters };
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
 * A Wall face **clamped to its stub**.
 *
 * The face is the compiled solid's vertical extent, which is right at rest. Under
 * the cutaway the part above `stubTopY` is not drawn, so it must not be selectable
 * either: a click on the air above a stub would otherwise take a Wall the creator
 * cannot see. Composing with the Slice's own clamp lets the lower bound win per
 * Wall without a second rule.
 */
export function clampFaceToCutaway(
	surface: StagePickSurface,
	cutaway: ResolvedCutaway | null,
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
 * faces are removed; floors, objects and Opening symbols are not part of the cutaway
 * (owner ruling O-1 leaves Scene objects as built).
 */
export function clipSurfaceToCutaway(
	surface: StagePickSurface,
	cutaway: ResolvedCutaway | null,
	wallId: string | null = null,
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
	slice: DrawnResolvedSlice,
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
export function clipSurfaceToSlice(
	surface: StagePickSurface,
	slice: ResolvedSlice | null,
): StagePickSurface[] {
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
			end: pointOnSegment(surface.start, surface.end, hi) as LayoutVec2,
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
						end: pointOnSegment(start, end, hi) as LayoutVec2,
					},
				} as StagePickSurface);
			}
		}
		return pieces;
	}
	if (geometry.polygon.length < 3) return [];
	// The region clip expects its interior on the left: a Layout polygon may arrive
	// in either winding.
	const ring =
		ringSignedArea(geometry.polygon) >= 0 ? [...geometry.polygon] : [...geometry.polygon].reverse();
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
				geometry: { kind: 'polygon', polygon: piece.points as LayoutVec2[] },
			} as StagePickSurface);
		}
	}
	return pieces;
}

export function clipPlanRegionFragments(
	plan: PlanEvaluation,
	slice: ResolvedSlice | null,
): PlanEvaluation {
	if (slice === null || !plan.fragments.some((fragment) => fragment.ref.sourceKind === 'region'))
		return plan;
	const clip = (fragment: PlanFragment): PlanFragment[] => {
		if (fragment.ref.sourceKind !== 'region') return [fragment];
		return clipSurfaceToSlice(
			{
				kind: 'flat',
				elevationMeters: fragment.elevationMeters,
				geometry: fragment.geometry,
			},
			slice,
		).flatMap((surface) =>
			surface.kind === 'flat' ? [{ ...fragment, geometry: surface.geometry }] : [],
		);
	};
	return {
		...plan,
		fragments: plan.fragments.flatMap(clip),
		streams: {
			cut: plan.streams.cut.flatMap(clip),
			projected: plan.streams.projected.flatMap(clip),
			hidden: plan.streams.hidden.flatMap(clip),
			symbol: plan.streams.symbol,
		},
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
			segments.push([
				geometry.polygon[index]!,
				geometry.polygon[(index + 1) % geometry.polygon.length]!,
			]);
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
export function pickSurfacesOf(
	fragment: PlanFragment,
	geometry: CompiledLayoutGeometry,
	datumMeters: number,
	slice: ResolvedSlice | null = null,
	cutaway: ResolvedCutaway | null = null,
): readonly StagePickSurface[] {
	const flat: StagePickSurface = {
		kind: 'flat',
		elevationMeters: fragment.elevationMeters,
		geometry: fragment.geometry,
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
			topMeters: datumMeters + wall.height,
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
			sameSpanDistance(span.endDistance, interval.end),
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
		topMeters: datumMeters + span.topY,
	}));
	const stubTopY = cutaway !== null && cutaway.wallIds.has(wall.wallId) ? cutaway.stubTopY : null;
	return [
		...faces,
		...(stubTopY === null ? [] : cutawayCapSurfacesOf(wall, matching, stubTopY, datumMeters)),
		...capSurfacesOf(fragment, wall, slice, interval),
	];
}

/**
 * The stub's horizontal top as a pick surface.
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
	datumMeters: number,
): readonly StagePickSurface[] {
	const localStub = stubTopY - datumMeters;
	const spans: CutWallSpan[] = matching
		.filter((span) => span.bottomY <= localStub + 1e-6 && localStub <= span.topY - 1e-6)
		.map((span) => ({ startDistance: span.startDistance, endDistance: span.endDistance }));
	if (spans.length === 0) return [];
	return cutWallBandsOf(wall, spans).map((polygon) => ({
		kind: 'flat' as const,
		elevationMeters: stubTopY,
		geometry: { kind: 'polygon' as const, polygon },
	}));
}

/**
 * The **cap surface** a cut Wall fragment adds: a flat band at `cutY`.
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
	interval: { readonly start: number; readonly end: number } | null,
): readonly StagePickSurface[] {
	if (slice === null || slice.kind === 'drawn') return [];
	if (fragment.ref.stream !== 'cut') return [];
	if (interval === null) return [];
	const span: CutWallSpan = { startDistance: interval.start, endDistance: interval.end };
	return cutWallBandsOf(wall, [span]).map((polygon) => ({
		kind: 'flat' as const,
		elevationMeters: slice.cutY,
		geometry: { kind: 'polygon' as const, polygon },
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
export function cssDistanceToSurfaces(
	css: readonly [number, number],
	surfaces: readonly StagePickSurface[],
	project: (point: Vec3) => readonly [number, number] | null,
): StagePick | null {
	let best: StagePick | null = null;
	const consider = (distanceCss: number, surface: StagePickSurface): void => {
		if (best === null || distanceCss < best.distanceCss) best = { distanceCss, surface };
	};
	const considerSegment = (
		start: readonly [number, number] | null,
		end: readonly [number, number] | null,
		surface: StagePickSurface,
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
				project([surface.start[0], surface.topMeters, surface.start[1]]),
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
export function worldPointOnSurface(
	css: readonly [number, number],
	surface: StagePickSurface,
	fragment: PlanFragment,
	evaluation: ViewportEvaluation,
	token: ViewportEvaluationToken,
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
					supportedLocalExtent: null,
				},
				evaluation,
				token,
			);
			if (hit.kind === 'intersected') {
				// Keep the point on the span the face covers: the ray's height is already on the
				// face's plane, and clamping along the span stays on it.
				const raw =
					((hit.worldPoint[0] - surface.start[0]) * dx +
						(hit.worldPoint[2] - surface.start[1]) * dz) /
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
			supportedLocalExtent: null,
		},
		evaluation,
		token,
	);
	return hit.kind === 'intersected' ? hit.worldPoint : fallback;
}

/** Only a genuine forward intersection with the finite winning surface has a depth. */
export function surfaceDepth(ray: PointerRay | null, surface: StagePickSurface): number | null {
	if (ray === null) return null;
	const o = ray.origin,
		d = ray.direction;
	let t: number;
	if (surface.kind === 'face') {
		const dx = surface.end[0] - surface.start[0],
			dz = surface.end[1] - surface.start[1];
		const denom = -dz * d[0] + dx * d[2];
		if (Math.abs(denom) < 1e-12) return null;
		t = (dz * (o[0] - surface.start[0]) - dx * (o[2] - surface.start[1])) / denom;
		if (!Number.isFinite(t) || t < 0) return null;
		const x = o[0] + t * d[0],
			y = o[1] + t * d[1],
			z = o[2] + t * d[2];
		const length2 = dx * dx + dz * dz;
		const u =
			length2 === 0 ? -1 : ((x - surface.start[0]) * dx + (z - surface.start[1]) * dz) / length2;
		return u >= 0 && u <= 1 && y >= surface.bottomMeters && y <= surface.topMeters ? t : null;
	}
	if (Math.abs(d[1]) < 1e-12) return null;
	t = (surface.elevationMeters - o[1]) / d[1];
	if (!Number.isFinite(t) || t < 0) return null;
	const point: [number, number] = [o[0] + t * d[0], o[2] + t * d[2]];
	if (surface.geometry.kind === 'polygon' && pointInPolygon(point, surface.geometry.polygon))
		return t;
	// Include polygon boundaries and exact intersections with line-only surfaces.
	for (const [a, b] of planSegments(surface.geometry)) {
		if (closestOnCssSegment(point, a, b).distance <= 1e-8) return t;
	}
	return null;
}

/** Layout owns the retained index, exact tests and priority; Stage sees one winner. */
