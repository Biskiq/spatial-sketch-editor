/**
 * `plan-salience.ts` — P23.13 S2: semantic-zoom regimes, per-feature gates and
 * the projections that decide *when and how much* the Plan draws.
 *
 * Three separate questions live here, and keeping them separate is the point:
 *
 * 1. **Global regime** (`far`/`normal`/`near`) selects policy — chrome detail,
 *    passive Scene ink, resting label policy — and carries hysteresis so a slow
 *    wheel does not flicker between policy sets.
 * 2. **Per-feature projection** decides visibility from the feature's own
 *    projected size at *any* regime: a 40 mm Wall may need silhouette help at
 *    near while a thick Wall still shows its band at overview (§13).
 * 3. **Freeze** holds the resolved vocabulary for the duration of a gesture.
 *
 * Every threshold here is a tuning value, never document semantics: nothing in
 * this module is persisted, serialized or written into `PlanRenderModel`, and
 * hit/snap/measurement geometry never reads it. The resolved decisions are the
 * *input* the presentation layer paints from.
 */
import type { LayoutVec2 } from '$lib/layout/layout-types';
import type { PlanPolylinePrimitive, PlanPresentationDecisions, PlanRenderModel } from '$lib/layout/plan-render-model';
import {
	architectureBandPx,
	DENSE_INK_SEPARATION_PX,
	resolveDoorCueShape,
	resolveWallInkAid,
	resolveWindowStrokeCount,
	WALL_PROFILE_INK_PX,
	WALL_SILHOUETTE_BAND_PX,
	windowStrokeLayout
} from './plan-architecture-grammar';
import {
	PLAN_GRID_MAJOR_MIN_SPACING_PX,
	PLAN_GRID_MAJOR_SPACING_M,
	PLAN_GRID_MINOR_MIN_SPACING_PX,
	PLAN_GRID_MINOR_SPACING_M,
	worldToPlanScreen,
	type PlanViewportState
} from './layout-plan-transform';

export type PlanZoomRegime = 'far' | 'normal' | 'near';

/* ── regime thresholds (spec §5) ──────────────────────────────────────────
   Initial classification: far `<24`, normal `24–79.99`, near `≥80`. Crossing a
   boundary the other way needs a lower value than entering it, so a wheel that
   hovers on a threshold settles instead of oscillating. */

/** Initial classification only — a first frame has no previous regime. */
export const PLAN_REGIME_NORMAL_MIN_PX_PER_M = 24;
export const PLAN_REGIME_NEAR_MIN_PX_PER_M = 80;
/** Hysteresis: far→normal at 28, normal→far at 20, normal→near at 88, near→normal at 72. */
export const PLAN_REGIME_FAR_TO_NORMAL_PX_PER_M = 28;
export const PLAN_REGIME_NORMAL_TO_FAR_PX_PER_M = 20;
export const PLAN_REGIME_NORMAL_TO_NEAR_PX_PER_M = 88;
export const PLAN_REGIME_NEAR_TO_NORMAL_PX_PER_M = 72;

/* ── per-feature floors ──────────────────────────────────────────────────── */

/** Junction and curve-control floor; paint and hit stay deliberately coupled. */
export const PLAN_ARCHITECTURE_CONTROLS_MIN_PX_PER_M = 6;
/** Resting Room label floor (area and text-fit tiers are S3's). */
export const PLAN_ROOM_LABELS_MIN_PX_PER_M = 6;
/** Passive Scene footprint ink: 15% far, 30% otherwise (spec §5). */
export const PLAN_SCENE_INK_FAR = 0.15;
export const PLAN_SCENE_INK_DEFAULT = 0.3;

/** Projected band below this gets the centered silhouette aid (spec §3).
 *  Owned by the grammar as a *shape* rule (a band this thin is not a band);
 *  salience decides when that shape rule applies. */
/** Window second-stroke hysteresis: enter 3.5 px separation, leave 2.5 px. */
export const PLAN_WINDOW_SECOND_LINE_ENTER_PX = 3.5;
export const PLAN_WINDOW_SECOND_LINE_LEAVE_PX = 2.5;
/** Door cue hysteresis: full cue enters at 9 px projected width, leaves at 7 px. */
export const PLAN_DOOR_CUE_FULL_ENTER_PX = 9;
export const PLAN_DOOR_CUE_FULL_LEAVE_PX = 7;

/** Screen bucket for the projected-ink neighbour pass (bounds its cost). */
const DENSE_INK_BUCKET_PX = 64;

/**
 * Initial regime for a first frame (or a jump into a new document): resolve
 * directly, with no hysteresis memory to consult.
 */
export function classifyPlanRegime(pixelsPerMeter: number): PlanZoomRegime {
	if (!Number.isFinite(pixelsPerMeter) || pixelsPerMeter <= 0) return 'far';
	if (pixelsPerMeter >= PLAN_REGIME_NEAR_MIN_PX_PER_M) return 'near';
	if (pixelsPerMeter >= PLAN_REGIME_NORMAL_MIN_PX_PER_M) return 'normal';
	return 'far';
}

/**
 * Next regime given the previous one. Independent bands overlap by design, so
 * hovering on a boundary cannot flicker; a jump (document re-frame, keyboard
 * zoom, reset) resolves straight through to the appropriate regime.
 */
export function nextPlanRegime(previous: PlanZoomRegime, pixelsPerMeter: number): PlanZoomRegime {
	const scale = Number.isFinite(pixelsPerMeter) ? pixelsPerMeter : 0;
	switch (previous) {
		case 'far':
			if (scale < PLAN_REGIME_FAR_TO_NORMAL_PX_PER_M) return 'far';
			return scale >= PLAN_REGIME_NORMAL_TO_NEAR_PX_PER_M ? 'near' : 'normal';
		case 'normal':
			if (scale < PLAN_REGIME_NORMAL_TO_FAR_PX_PER_M) return 'far';
			if (scale >= PLAN_REGIME_NORMAL_TO_NEAR_PX_PER_M) return 'near';
			return 'normal';
		case 'near':
			if (scale >= PLAN_REGIME_NEAR_TO_NORMAL_PX_PER_M) return 'near';
			return scale < PLAN_REGIME_NORMAL_TO_FAR_PX_PER_M ? 'far' : 'normal';
	}
}

export type PlanSalienceGates = {
	/** Junction and curve-control visibility (paint and hit together). */
	architectureControls: boolean;
	/** Resting Room name/reference/area labels. */
	roomLabels: boolean;
	/** Passive Scene footprint ink fraction. */
	sceneInk: number;
	/** 1 m grid lines. */
	gridMajor: boolean;
	/** 0.25 m grid lines. */
	gridMinor: boolean;
};

/** The gate table. Everything else reads these; nothing else invents a gate. */
export function planSalienceGates(
	regime: PlanZoomRegime,
	pixelsPerMeter: number
): PlanSalienceGates {
	const scale = Number.isFinite(pixelsPerMeter) ? pixelsPerMeter : 0;
	return {
		architectureControls: scale >= PLAN_ARCHITECTURE_CONTROLS_MIN_PX_PER_M,
		roomLabels: scale >= PLAN_ROOM_LABELS_MIN_PX_PER_M,
		sceneInk: regime === 'far' ? PLAN_SCENE_INK_FAR : PLAN_SCENE_INK_DEFAULT,
		gridMajor: PLAN_GRID_MAJOR_SPACING_M * scale >= PLAN_GRID_MAJOR_MIN_SPACING_PX,
		gridMinor: PLAN_GRID_MINOR_SPACING_M * scale >= PLAN_GRID_MINOR_MIN_SPACING_PX
	};
}

/**
 * Hysteresis memories for the opening gates. Keyed by canonical render-model
 * primitive key, so a decision belongs to one Opening and no shared counter can
 * drift between them. Cleared when the model drops the primitive.
 */
export type PlanSalienceMemory = {
	regime: PlanZoomRegime | null;
	/** Window symbolic strokes per Opening. */
	windowStrokes: Map<string, 1 | 2>;
	/** Door type cue shape per Opening. */
	doorCueShape: Map<string, 'full' | 'displaced'>;
};

export function createPlanSalienceMemory(): PlanSalienceMemory {
	return { regime: null, windowStrokes: new Map(), doorCueShape: new Map() };
}

/** Resolved projected-ink pass: which Walls would stack competing profiles. */
export type PlanProjectedInk = {
	/** Wall primitive keys whose exterior profiles collide with a neighbour. */
	denseKeys: ReadonlySet<string>;
	/** Nearest parallel separation in screen px per Wall key (diagnostics/tests). */
	separationPx: ReadonlyMap<string, number>;
};

export type PlanSalienceInput = {
	model: PlanRenderModel;
	/**
	 * The live view. Salience owns the world→screen projection it needs, so the
	 * viewport keeps its boundary promise of holding no transform math itself.
	 */
	view: PlanViewportState;
};

/**
 * A resolved, immutable salience snapshot. It is safe to hold (freeze) for a
 * gesture: `decisionsFor` reads only captured values plus the primitive it is
 * asked about, so geometry created mid-gesture still gets judged.
 */
export type PlanSalience = {
	regime: PlanZoomRegime;
	gates: PlanSalienceGates;
	projectedInk: PlanProjectedInk;
	decisionsFor: (primitive: PlanPolylinePrimitive) => PlanPresentationDecisions;
	/** Passive Scene ink for this regime, carried so a snapshot *is* a source. */
	sceneInk: number;
};

/**
 * Resolve one frame of salience and advance the hysteresis memory. Re-resolving
 * with the same scale is a no-op for the memory, so a re-run cannot walk the
 * regime forward twice.
 */
export function resolvePlanSalience(
	input: PlanSalienceInput,
	memory: PlanSalienceMemory = createPlanSalienceMemory()
): PlanSalience {
	const pixelsPerMeter = input.view.pixelsPerMeter;
	const regime = memory.regime === null
		? classifyPlanRegime(pixelsPerMeter)
		: nextPlanRegime(memory.regime, pixelsPerMeter);
	memory.regime = regime;
	pruneMemory(memory, input.model);

	const projectedInk = projectDenseInk(input);

	// Resolve every entity up front and advance the hysteresis memory exactly
	// once per frame. The returned snapshot then reads only captured values, so
	// holding it through a gesture freezes the vocabulary without freezing the
	// geometry: a primitive created mid-gesture is judged by the fallback below.
	const decisions = new Map<string, PlanPresentationDecisions>();
	for (const layer of input.model.layers) {
		for (const primitive of layer.primitives) {
			if (primitive.kind !== 'polyline' || !primitive.architecture) continue;
			decisions.set(
				primitive.key,
				decide(primitive, pixelsPerMeter, projectedInk, memory, true)
			);
		}
	}

	const gates = planSalienceGates(regime, pixelsPerMeter);
	return {
		regime,
		gates,
		projectedInk,
		sceneInk: gates.sceneInk,
		decisionsFor: (primitive) =>
			decisions.get(primitive.key) ?? decide(primitive, pixelsPerMeter, projectedInk, memory, false)
	};
}

/**
 * `writeMemory` is false for the fallback path (a primitive the resolved frame
 * did not carry), so a mid-gesture entity can be judged without disturbing the
 * frozen hysteresis of its neighbours.
 */
function decide(
	primitive: PlanPolylinePrimitive,
	pixelsPerMeter: number,
	projectedInk: PlanProjectedInk,
	memory: PlanSalienceMemory,
	writeMemory: boolean
): PlanPresentationDecisions {
	const architecture = primitive.architecture;
	if (!architecture) return {};

	if (architecture.kind === 'wall') {
		const bandPx = architectureBandPx(pixelsPerMeter, architecture.thicknessMeters);
		// Neighbour analysis is this frame's answer, so the aid is resolved here
		// rather than left to the grammar's structural stub.
		if (projectedInk.denseKeys.has(primitive.key)) return { wallInkAid: 'dense' };
		return {
			wallInkAid: bandPx < WALL_SILHOUETTE_BAND_PX ? 'silhouette' : 'none'
		};
	}

	if (architecture.kind === 'window') {
		const thicknessPx = architecture.wallThicknessMeters * pixelsPerMeter;
		const layout = windowStrokeLayout(thicknessPx, 2);
		// Per-Opening hysteresis on the *separation*, then the hard shape gate:
		// hysteresis decides intent, the shape gate can always refuse a second
		// stroke the ratified screen budget cannot carry.
		const previous = memory.windowStrokes.get(primitive.key) ?? 1;
		const wants = previous === 2
			? layout.separationPx >= PLAN_WINDOW_SECOND_LINE_LEAVE_PX
			: layout.separationPx >= PLAN_WINDOW_SECOND_LINE_ENTER_PX;
		const count = resolveWindowStrokeCount(wants ? 2 : 1, thicknessPx);
		if (writeMemory) memory.windowStrokes.set(primitive.key, count);
		return { windowFrameCount: count };
	}

	const widthPx = architecture.widthMeters * pixelsPerMeter;
	const previous = memory.doorCueShape.get(primitive.key);
	const shape = previous === undefined
		? resolveDoorCueShape(undefined, widthPx)
		: previous === 'full'
			? widthPx >= PLAN_DOOR_CUE_FULL_LEAVE_PX ? 'full' : 'displaced'
			: widthPx >= PLAN_DOOR_CUE_FULL_ENTER_PX ? 'full' : 'displaced';
	if (writeMemory) memory.doorCueShape.set(primitive.key, shape);
	return { doorCueShape: shape };
}

/** Drop memories for primitives the model no longer carries. */
function pruneMemory(memory: PlanSalienceMemory, model: PlanRenderModel): void {
	const keys = new Set<string>();
	for (const layer of model.layers) {
		for (const primitive of layer.primitives) {
			if (primitive.kind === 'polyline' && primitive.architecture) keys.add(primitive.key);
		}
	}
	for (const key of memory.windowStrokes.keys()) {
		if (!keys.has(key)) memory.windowStrokes.delete(key);
	}
	for (const key of memory.doorCueShape.keys()) {
		if (!keys.has(key)) memory.doorCueShape.delete(key);
	}
}

type WallSegment = {
	key: string;
	bandPx: number;
	from: LayoutVec2;
	to: LayoutVec2;
	/** World endpoints, used to tell a continuation from a stack. */
	worldFrom: LayoutVec2;
	worldTo: LayoutVec2;
};

/** Two walls only compete for ink if they run the same way (≈2.6°). */
const PARALLEL_DOT_MIN = 0.999;
/** Endpoints this close are the same junction, not a stack. */
const SHARED_ENDPOINT_EPSILON_M = 1e-6;

/**
 * Dense-ink pass: two *parallel* Walls whose projected profile edges would land
 * inside `DENSE_INK_SEPARATION_PX` of each other get the neutral single aid
 * instead of two competing exterior ink strokes (the band itself is preserved).
 * Corners and split continuations are excluded: those are joins, and a join is
 * never repaired here (P23.15 owns seam truth). Bucketed by screen cell, so the
 * cost stays ~linear in the number of Walls rather than quadratic.
 */
function projectDenseInk(input: PlanSalienceInput): PlanProjectedInk {
	const denseKeys = new Set<string>();
	const separationPx = new Map<string, number>();
	const walls: WallSegment[] = [];
	const pixelsPerMeter = input.view.pixelsPerMeter;
	for (const layer of input.model.layers) {
		for (const primitive of layer.primitives) {
			if (primitive.kind !== 'polyline') continue;
			const architecture = primitive.architecture;
			if (architecture?.kind !== 'wall') continue;
			if (primitive.points.length < 2) continue;
			const bandPx = architecture.thicknessMeters * pixelsPerMeter;
			// A band too thin to stack ink cannot collide visibly.
			if (bandPx + WALL_PROFILE_INK_PX * 2 <= DENSE_INK_SEPARATION_PX) continue;
			const worldFrom = primitive.points[0]!;
			const worldTo = primitive.points.at(-1)!;
			walls.push({
				key: primitive.key,
				bandPx,
				from: worldToPlanScreen(input.view, worldFrom),
				to: worldToPlanScreen(input.view, worldTo),
				worldFrom,
				worldTo
			});
		}
	}
	if (walls.length < 2) return { denseKeys, separationPx };

	const buckets = new Map<string, number[]>();
	const cellOf = (point: LayoutVec2): [number, number] => [
		Math.floor(point[0] / DENSE_INK_BUCKET_PX),
		Math.floor(point[1] / DENSE_INK_BUCKET_PX)
	];
	walls.forEach((wall, index) => {
		for (const point of [wall.from, wall.to]) {
			const [cx, cy] = cellOf(point);
			for (let dx = -1; dx <= 1; dx += 1) {
				for (let dy = -1; dy <= 1; dy += 1) {
					const key = `${cx + dx}:${cy + dy}`;
					const bucket = buckets.get(key);
					if (bucket) bucket.push(index);
					else buckets.set(key, [index]);
				}
			}
		}
	});

	const seen = new Set<string>();
	for (const bucket of buckets.values()) {
		for (let i = 0; i < bucket.length; i += 1) {
			for (let j = i + 1; j < bucket.length; j += 1) {
				const a = walls[bucket[i]!]!;
				const b = walls[bucket[j]!]!;
				if (a.key === b.key) continue;
				const pairKey = a.key < b.key ? `${a.key}|${b.key}` : `${b.key}|${a.key}`;
				if (seen.has(pairKey)) continue;
				seen.add(pairKey);
				// Only *parallel* profiles compete: a corner is a join, and two
				// segments of one split Wall are a continuation. Neither is a stack
				// of ink, and flagging either would erase a truthful seam.
				if (!areParallelWalls(a, b)) continue;
				if (shareEndpoint(a, b)) continue;
				const distance = segmentDistance(a.from, a.to, b.from, b.to);
				const limit = a.bandPx / 2 + b.bandPx / 2 + WALL_PROFILE_INK_PX * 2 + DENSE_INK_SEPARATION_PX;
				recordSeparation(separationPx, a.key, distance);
				recordSeparation(separationPx, b.key, distance);
				if (distance < limit) {
					denseKeys.add(a.key);
					denseKeys.add(b.key);
				}
			}
		}
	}
	return { denseKeys, separationPx };
}

function areParallelWalls(a: WallSegment, b: WallSegment): boolean {
	const direction = (wall: WallSegment): LayoutVec2 => {
		const dx = wall.worldTo[0] - wall.worldFrom[0];
		const dz = wall.worldTo[1] - wall.worldFrom[1];
		const length = Math.hypot(dx, dz);
		return length > 0 ? [dx / length, dz / length] : [1, 0];
	};
	const [ax, az] = direction(a);
	const [bx, bz] = direction(b);
	return Math.abs(ax * bx + az * bz) >= PARALLEL_DOT_MIN;
}

function shareEndpoint(a: WallSegment, b: WallSegment): boolean {
	const same = (p: LayoutVec2, q: LayoutVec2): boolean =>
		Math.hypot(p[0] - q[0], p[1] - q[1]) <= SHARED_ENDPOINT_EPSILON_M;
	return (
		same(a.worldFrom, b.worldFrom) ||
		same(a.worldFrom, b.worldTo) ||
		same(a.worldTo, b.worldFrom) ||
		same(a.worldTo, b.worldTo)
	);
}

function recordSeparation(map: Map<string, number>, key: string, distance: number): void {
	const current = map.get(key);
	if (current === undefined || distance < current) map.set(key, distance);
}

/** Minimum distance between two screen-space segments. */
function segmentDistance(a1: LayoutVec2, a2: LayoutVec2, b1: LayoutVec2, b2: LayoutVec2): number {
	if (segmentsIntersect(a1, a2, b1, b2)) return 0;
	return Math.min(
		pointSegmentDistance(a1, b1, b2),
		pointSegmentDistance(a2, b1, b2),
		pointSegmentDistance(b1, a1, a2),
		pointSegmentDistance(b2, a1, a2)
	);
}

function pointSegmentDistance(point: LayoutVec2, from: LayoutVec2, to: LayoutVec2): number {
	const dx = to[0] - from[0];
	const dz = to[1] - from[1];
	const lengthSquared = dx * dx + dz * dz;
	if (lengthSquared <= 1e-12) return Math.hypot(point[0] - from[0], point[1] - from[1]);
	const t = Math.min(1, Math.max(0, ((point[0] - from[0]) * dx + (point[1] - from[1]) * dz) / lengthSquared));
	return Math.hypot(point[0] - (from[0] + dx * t), point[1] - (from[1] + dz * t));
}

function segmentsIntersect(a1: LayoutVec2, a2: LayoutVec2, b1: LayoutVec2, b2: LayoutVec2): boolean {
	const cross = (o: LayoutVec2, p: LayoutVec2, q: LayoutVec2): number =>
		(p[0] - o[0]) * (q[1] - o[1]) - (p[1] - o[1]) * (q[0] - o[0]);
	const d1 = cross(b1, b2, a1);
	const d2 = cross(b1, b2, a2);
	const d3 = cross(a1, a2, b1);
	const d4 = cross(a1, a2, b2);
	return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}
