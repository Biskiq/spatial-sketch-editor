/**
 * `plan-architecture-grammar.ts` — P23.13 S1: the static architectural grammar.
 *
 * One place owns the *shapes* the Plan paints for Walls and Openings — the
 * canonical-width band projection, jambs and cut terminations, the perpendicular
 * Door type cue, the Window stroke shapes and the small-opening displaced cue —
 * so the resting, preview, selected/edit and zoom paths can never drift apart.
 *
 * Everything here is presentation ink. Nothing in this module is an input to hit
 * resolution, snapping, measurement or validation, and no cue geometry is ever
 * emitted into `PlanRenderModel`. Projected-size *decisions* (with hysteresis)
 * belong to transient salience (S2) and arrive as injected
 * `PlanPresentationDecisions`. The thresholds that remain here are *shape*
 * rules — a band below 2 px is not a band, two frames 3 px apart are one frame
 * — so they stay with the shapes; S2 owns when they apply, and its `decide`
 * reads them rather than restating the numbers.
 *
 * The band is a stroke projection from the compiled centerline, not a
 * junction-correct polygon: joins are left truthful for P23.15, never repaired
 * here by inventing a union, bevel, bridge or extension.
 */
import type { LayoutVec2 } from '$lib/layout/layout-types';
import type { PlanPresentationDecisions } from '$lib/layout/plan-render-model';
import { worldToPlanScreen, type PlanViewportState } from './layout-plan-transform';

/** Projected band below this reads as a silhouette aid, not as a band. */
export const WALL_SILHOUETTE_BAND_PX = 2;
/** Parallel edges closer than this collapse into one neutral aid line. */
export const DENSE_INK_SEPARATION_PX = 1.5;
/** Exterior profile ink around the band (1 px, one per side). */
export const WALL_PROFILE_INK_PX = 1;

/** Total screen-space Door type cue length: long enough for three dashes. */
export const DOOR_TYPE_CUE_LENGTH_PX = 12;
export const DOOR_TYPE_CUE_DASH_PX = 2;
export const DOOR_TYPE_CUE_GAP_PX = 2;
export const DOOR_TYPE_CUE_DASHARRAY = `${DOOR_TYPE_CUE_DASH_PX} ${DOOR_TYPE_CUE_GAP_PX}`;
/** Small-opening fallback: a single short dash displaced outside the host. */
export const DOOR_TYPE_CUE_DISPLACED_LENGTH_PX = 4;
export const DOOR_TYPE_CUE_DISPLACED_GAP_PX = 5;
/** A cut this narrow keeps the actual gap and uses the displaced cue instead. */
export const DOOR_TYPE_CUE_MIN_WIDTH_PX = 8;

/** Window stroke shape budget (screen px). */
export const WINDOW_STROKE_SEPARATION_MAX_PX = 4;
export const WINDOW_STROKE_SEPARATION_RATIO = 0.36;
export const WINDOW_STROKE_MIN_SEPARATION_PX = 3;
export const WINDOW_STROKE_MIN_EDGE_MARGIN_PX = 1;

/**
 * Exact canonical physical-width projection in screen pixels. Never clamped and
 * never widened for legibility: the band is a measurement, the ink is a mark.
 * Takes the scale alone so callers that only project a thickness (salience,
 * tests) do not have to invent a viewport.
 */
export function architectureBandPx(pixelsPerMeter: number, thicknessMeters: number): number {
	if (!Number.isFinite(thicknessMeters) || !Number.isFinite(pixelsPerMeter)) return 0;
	return Math.max(0, thicknessMeters * pixelsPerMeter);
}

/**
 * Resolve the wall ink aid. `decision` is the S2 salience answer; when it is
 * absent the adapter uses the ratified structural thresholds as a stub.
 * `nearestParallelSeparationPx` is optional because neighbour analysis is S2's.
 */
export function resolveWallInkAid(
	decision: PlanPresentationDecisions['wallInkAid'],
	bandPx: number,
	nearestParallelSeparationPx?: number
): 'none' | 'silhouette' | 'dense' {
	if (decision) return decision;
	if (
		nearestParallelSeparationPx !== undefined &&
		nearestParallelSeparationPx < DENSE_INK_SEPARATION_PX
	) {
		return 'dense';
	}
	return bandPx < WALL_SILHOUETTE_BAND_PX ? 'silhouette' : 'none';
}

/**
 * A jamb termination: the cut edge spanning the host thickness, world-based so
 * the authored cut coordinates are never re-derived from screen ink.
 */
export function wallJambWorldPoints(
	point: LayoutVec2,
	normal: LayoutVec2,
	thicknessMeters: number
): [LayoutVec2, LayoutVec2] {
	const half = thicknessMeters / 2;
	return [
		[point[0] - normal[0] * half, point[1] - normal[1] * half],
		[point[0] + normal[0] * half, point[1] + normal[1] * half]
	];
}

/**
 * The one Door type cue: a dashed line centered on the authored Opening and
 * perpendicular to the host tangent, symmetric about the Wall centerline.
 *
 * Its length is screen pixels, so it never varies with authored width or Wall
 * thickness and may protrude beyond the projected band; that protrusion is
 * presentation only. The cue follows the canonical tangent at the opening
 * center, so a curved host keeps a locally correct perpendicular instead of a
 * constant-normal offset.
 */
export function doorTypeCueScreenPoints(
	planView: PlanViewportState,
	center: LayoutVec2,
	tangent: LayoutVec2,
	lengthPx = DOOR_TYPE_CUE_LENGTH_PX
): [LayoutVec2, LayoutVec2] {
	const [cx, cy] = worldToPlanScreen(planView, center);
	const magnitude = Math.hypot(tangent[0], tangent[1]);
	// The Plan transform is a uniform scale plus a translate, so the world
	// perpendicular and the screen perpendicular are the same rotation.
	const tx = magnitude > 0 ? tangent[0] / magnitude : 1;
	const tz = magnitude > 0 ? tangent[1] / magnitude : 0;
	const half = Math.max(0, lengthPx) / 2;
	return [
		[cx + tz * half, cy - tx * half],
		[cx - tz * half, cy + tx * half]
	];
}

/**
 * Small-opening fallback shape: one short dash displaced to a stable host side,
 * outside the projected band. Never a compressed three-dash cue.
 */
export function doorTypeCueDisplacedScreenPoints(
	planView: PlanViewportState,
	center: LayoutVec2,
	tangent: LayoutVec2,
	bandPx: number,
	lengthPx = DOOR_TYPE_CUE_DISPLACED_LENGTH_PX,
	gapPx = DOOR_TYPE_CUE_DISPLACED_GAP_PX
): [LayoutVec2, LayoutVec2] {
	const [cx, cy] = worldToPlanScreen(planView, center);
	const magnitude = Math.hypot(tangent[0], tangent[1]);
	const tx = magnitude > 0 ? tangent[0] / magnitude : 1;
	const tz = magnitude > 0 ? tangent[1] / magnitude : 0;
	const start = Math.max(0, bandPx) / 2 + Math.max(0, gapPx);
	const end = start + Math.max(0, lengthPx);
	return [
		[cx - tz * start, cy + tx * start],
		[cx - tz * end, cy + tx * end]
	];
}

/**
 * Resolve the Door cue shape. `decision` is the S2 salience answer with its
 * hysteresis; the stub applies the ratified width gate without memory.
 */
export function resolveDoorCueShape(
	decision: PlanPresentationDecisions['doorCueShape'],
	projectedWidthPx: number
): 'full' | 'displaced' {
	if (decision) return decision;
	return projectedWidthPx >= DOOR_TYPE_CUE_MIN_WIDTH_PX ? 'full' : 'displaced';
}

/** Painted dashes for a dashed span (every dash needs its gap, bar the last). */
export function dashedSegmentCount(lengthPx: number, dashPx: number, gapPx: number): number {
	const period = dashPx + gapPx;
	if (!(period > 0) || !(lengthPx > 0)) return 0;
	return Math.floor((lengthPx + gapPx) / period);
}

export type WindowStrokeLayout = {
	/** Screen-px offsets from the void centerline, in paint order. */
	offsetsPx: number[];
	/** Projected separation between the two strokes (0 when collapsed to one). */
	separationPx: number;
	/** Clearance from each stroke to the cut edge. */
	edgeMarginPx: number;
};

/**
 * Window stroke shape for an *injected* count: `min(4px, 0.36 · t)` separation,
 * symmetric about the host centerline.
 */
export function windowStrokeLayout(
	projectedThicknessPx: number,
	strokeCount: 1 | 2
): WindowStrokeLayout {
	const half = Math.max(0, projectedThicknessPx) / 2;
	if (strokeCount === 1) return { offsetsPx: [0], separationPx: 0, edgeMarginPx: half };
	const separationPx = Math.min(
		WINDOW_STROKE_SEPARATION_MAX_PX,
		WINDOW_STROKE_SEPARATION_RATIO * projectedThicknessPx
	);
	return {
		offsetsPx: [-separationPx / 2, separationPx / 2],
		separationPx,
		edgeMarginPx: half - separationPx / 2
	};
}

/** Two strokes need ≥3px separation and ≥1px to each cut edge. */
export function windowStrokeShapeAllowed(layout: WindowStrokeLayout): boolean {
	if (layout.offsetsPx.length === 1) return true;
	return (
		layout.separationPx >= WINDOW_STROKE_MIN_SEPARATION_PX &&
		layout.edgeMarginPx >= WINDOW_STROKE_MIN_EDGE_MARGIN_PX
	);
}

/**
 * The hard `≤2` rule plus the shape gate. Count *resolution* (with hysteresis)
 * is S2's; this refuses a second stroke the shape budget cannot carry.
 */
export function resolveWindowStrokeCount(
	injected: 1 | 2,
	projectedThicknessPx: number
): 1 | 2 {
	return windowStrokeShapeAllowed(windowStrokeLayout(projectedThicknessPx, injected)) ? injected : 1;
}

/**
 * Parallel offset of a projected polyline in screen pixels, using per-vertex
 * normals so a curved host's frame strokes stay parallel to its own tangent.
 */
export function offsetScreenPolyline(
	screen: readonly LayoutVec2[],
	offsetPx: number
): LayoutVec2[] {
	if (offsetPx === 0) return screen.map((point) => [...point] as LayoutVec2);
	const normals = screenNormals(screen);
	return screen.map((point, index) => [
		point[0] + normals[index]![0] * offsetPx,
		point[1] + normals[index]![1] * offsetPx
	]);
}

function screenNormals(screen: readonly LayoutVec2[]): LayoutVec2[] {
	if (screen.length === 0) return [];
	if (screen.length === 1) return [[0, 1]];
	return screen.map((_point, index) => {
		const previous = screen[index - 1];
		const next = screen[index + 1];
		const incoming = previous && index > 0 ? unit([screen[index]![0] - previous[0], screen[index]![1] - previous[1]]) : null;
		const outgoing = next ? unit([next[0] - screen[index]![0], next[1] - screen[index]![1]]) : null;
		const direction = incoming && outgoing
			? unit([incoming[0] + outgoing[0], incoming[1] + outgoing[1]]) ?? outgoing
			: outgoing ?? incoming;
		const [dx, dz] = direction ?? [1, 0];
		return [dz, -dx] as LayoutVec2;
	});
}

function unit(vector: LayoutVec2): LayoutVec2 | null {
	const magnitude = Math.hypot(vector[0], vector[1]);
	if (!(magnitude > 1e-9)) return null;
	return [vector[0] / magnitude, vector[1] / magnitude];
}
