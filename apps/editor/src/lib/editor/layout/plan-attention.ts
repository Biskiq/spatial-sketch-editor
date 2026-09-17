/**
 * `plan-attention.ts` — P23.13 S8 / §1.12: the instrument zone.
 *
 * While a control is being worked, the drawing around it is carrying an
 * instrument (a handle, its annotation, live dimensions) and the surrounding
 * annotation competes with it. The ratified answer is **local and quiet**:
 *
 * ```text
 * zone      = active handle + its annotation bounds, + 64 px pad, ≤180 px from
 *             the locus, no visible border
 * inside    = Room labels drop area → reference (pair-safe), object labels
 *             are nonessential
 * outside   = nothing changes
 * restore   = 150 ms after the instrument settles
 * ```
 *
 * "No visible border" is the load-bearing part of that: the zone is a
 * *decision* input, never paint. Nothing in this module draws, and no boundary
 * is ever rendered — a visible spotlight would be a second selection language
 * for a state that already has one.
 *
 * Lifetimes are pure functions of a clock for the same reason the refusal
 * annotation's are: a caller cannot resurrect a settled zone by re-reading it,
 * and a test can walk the settle window without timers.
 *
 * **Scope note (one row wired, one still open).** §1.12's row also lists
 * `Scene → 10%` and "nonessential object labels". The Scene half **is** wired:
 * `withPlanAttentionSceneInk` answers per footprint through
 * `PlanPresentationSource.sceneInkFor`, so the zone quiets the footprints inside
 * it and leaves every other footprint at S2's regime value — the per-primitive
 * pass the row needed, rather than a page-scale dim, and `min`-guarded so a
 * regime already dimmer than the zone keeps its own ink. The object-label half
 * stays open because Plan object labels do not exist until S9 draws them; a
 * *global* label mute while the instrument is live would change surfaces
 * outside the zone, which the row forbids.
 */
import type { LayoutVec2 } from '$lib/layout/layout-types';
import type { PlanPolygonPrimitive, PlanPresentationSource } from '$lib/layout/plan-render-model';
import { worldToPlanScreen, type PlanViewportState } from './layout-plan-transform';

/** §1.12's pad around the active handle + annotation bounds. */
export const PLAN_ATTENTION_PAD_PX = 64;
/** §1.12's cap on how far the focus may reach from the locus. */
export const PLAN_ATTENTION_MAX_RADIUS_PX = 180;
/** §1.12's settle window: the zone survives this long past the last touch. */
export const PLAN_ATTENTION_RESTORE_MS = 150;
/** §1.12: passive Scene ink inside the zone (half of the normal 30%). */
export const PLAN_SCENE_INK_IN_ZONE = 0.1;

/** The tier ceiling a Room label takes inside the zone (area drops first). */
export type PlanAttentionTierCeiling = 'name-reference';

export type PlanAttentionZone = {
	/** Screen-space instrument bounds: locus + bounds, padded, then capped. */
	minX: number;
	minY: number;
	maxX: number;
	maxY: number;
	/** The pad actually applied after the cap (diagnostics + tests). */
	radiusPx: number;
	/** Wall clock of the last touch; the settle window runs from here. */
	touchedAtMs: number;
};

/**
 * The instrument's zone for one frame: the locus plus any annotation bounds the
 * caller names, all in world space, padded by `PLAN_ATTENTION_PAD_PX` in screen
 * space and then clamped to `PLAN_ATTENTION_MAX_RADIUS_PX` on each axis about
 * the locus — so the zone can grow with the annotation, but never into a
 * page-sized spotlight.
 */
export function resolvePlanAttentionZone(input: {
	view: PlanViewportState;
	/** The active handle / drag locus in world space. */
	locus: LayoutVec2;
	/** Annotation bounds to include (world points); the locus is always included. */
	bounds?: readonly LayoutVec2[];
	atMs: number;
}): PlanAttentionZone {
	const screen = [input.locus, ...(input.bounds ?? [])].map((point) =>
		worldToPlanScreen(input.view, point)
	);
	const locusPx = screen[0]!;
	let minX = locusPx[0];
	let minY = locusPx[1];
	let maxX = locusPx[0];
	let maxY = locusPx[1];
	for (const point of screen) {
		minX = Math.min(minX, point[0]);
		minY = Math.min(minY, point[1]);
		maxX = Math.max(maxX, point[0]);
		maxY = Math.max(maxY, point[1]);
	}
	const pad = PLAN_ATTENTION_PAD_PX;
	const cap = PLAN_ATTENTION_MAX_RADIUS_PX;
	const padded = {
		minX: Math.max(minX - pad, locusPx[0] - cap),
		minY: Math.max(minY - pad, locusPx[1] - cap),
		maxX: Math.min(maxX + pad, locusPx[0] + cap),
		maxY: Math.min(maxY + pad, locusPx[1] + cap)
	};
	return {
		...padded,
		radiusPx: Math.max(
			locusPx[0] - padded.minX,
			padded.maxX - locusPx[0],
			locusPx[1] - padded.minY,
			padded.maxY - locusPx[1]
		),
		touchedAtMs: input.atMs
	};
}

/**
 * The zone as it stands at `nowMs`, or `null` once it has settled: §1.12's 150 ms
 * quiet window. `null` is the *restore* signal — everything the zone suppressed
 * comes back on the next frame, which is why the caller must treat a settled
 * zone as absent rather than as an empty one.
 */
export function planAttentionZoneAt(
	zone: PlanAttentionZone | null,
	nowMs: number
): PlanAttentionZone | null {
	if (!zone) return null;
	const age = nowMs - zone.touchedAtMs;
	if (!Number.isFinite(age) || age < 0) return zone;
	return age < PLAN_ATTENTION_RESTORE_MS ? zone : null;
}

/**
 * §1.12's `Scene → 10%`, as a per-footprint override of the passive Scene ink.
 *
 * Region-scoped by construction: the zone dims the footprints inside it and
 * leaves every other footprint at its regime value, so the instrument quiets its
 * own surroundings without a page-scale dimming pass existing. The test is the
 * footprint's own center in screen space (a Scene polygon is a footprint, not a
 * stroke), which keeps the rule stateless and independent of footprint size.
 *
 * The override is a *value*, not a relative dim: §1.12 says the Scene reads 10%
 * inside the zone, so a normal/near 30% and a far 15% both land on 10%. The
 * `min` is the one guard on top of that — a future regime dimmer than the zone
 * would keep its own ink, because the zone quiets context and must never be the
 * reason anything gets brighter.
 */
export function withPlanAttentionSceneInk(
	source: PlanPresentationSource,
	planView: PlanViewportState,
	zone: PlanAttentionZone | null
): PlanPresentationSource {
	if (!zone) return source;
	return {
		...source,
		sceneInkFor: (primitive: PlanPolygonPrimitive) => {
			const base = source.sceneInkFor?.(primitive) ?? source.sceneInk;
			if (primitive.points.length === 0) return base;
			let x = 0;
			let z = 0;
			for (const point of primitive.points) {
				x += point[0];
				z += point[1];
			}
			const center = worldToPlanScreen(planView, [x / primitive.points.length, z / primitive.points.length]);
			const inside =
				center[0] >= zone.minX &&
				center[0] <= zone.maxX &&
				center[1] >= zone.minY &&
				center[1] <= zone.maxY;
			return inside ? Math.min(base, PLAN_SCENE_INK_IN_ZONE) : base;
		}
	};
}

/**
 * §1.12's in-zone suppression policy, as the S3 Room-label placer takes it: the
 * live zone's own screen bounds plus the tier a label inside it may not exceed.
 *
 * The ceiling is *pair-safe* by construction: lowering a Room's label from `full`
 * to `name-reference` drops the area line and keeps the name and the reference
 * together, which is exactly the pairing S3 protects for duplicates and for a
 * selected Room. A ceiling that could take the reference alone would split that
 * pair, so it does not exist.
 *
 * The region test itself belongs to the placer (it is the layer that knows where
 * a label actually landed), so the zone hands over its bounds and the ceiling
 * rather than pre-judging an anchor it cannot see — see `plan-room-labels`'
 * `tierDropZone`.
 */
export function planAttentionLabelTierDrop(zone: PlanAttentionZone | null): {
	minX: number;
	minY: number;
	maxX: number;
	maxY: number;
	ceiling: PlanAttentionTierCeiling;
} | null {
	if (!zone) return null;
	return {
		minX: zone.minX,
		minY: zone.minY,
		maxX: zone.maxX,
		maxY: zone.maxY,
		ceiling: 'name-reference'
	};
}
