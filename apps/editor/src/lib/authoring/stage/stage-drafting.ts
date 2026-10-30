/**
 * R217.S05 — the **drafting state** and its arithmetic.
 *
 * PLATE's drafting cluster is one view-state fact, not a second document, a
 * Camera mode or a source writer:
 *
 * - **Grid** is on or off and names the minor interval it draws.
 * - **Snap** is on or off, may be temporarily **held** by Alt/Option, and uses
 *   the same minor interval as its increment.
 * - **Scale** is a reading of the current Camera evaluation and opens framing
 *   requests; it never writes a pose of its own.
 *
 * Everything here is pure. The session owns the one state value; the adapter
 * context publishes it read-only; the shell renders it; Layout Ink and free
 * Scene placement consume the increment. Nothing in this module reads a project
 * source, history or Save.
 */
import type { ViewingIntent } from '@portfolio/camera-core';

/** The one Grid/Snap view state. Grid and Snap are independent facts. */
export type StageDraftingState = {
	readonly grid: boolean;
	readonly snap: boolean;
	/** Follows a held Alt/Option key; released on keyup, blur and teardown. */
	readonly snapSuspended: boolean;
	/** Configured minor interval used when scale is unavailable. */
	readonly gridMinorMeters: number;
};

/** Grid on and Snap on at the 1 m reference scale. */
export const STAGE_DRAFTING_DEFAULTS: StageDraftingState = Object.freeze({
	grid: true,
	snap: true,
	snapSuspended: false,
	gridMinorMeters: 1
});

/**
 * The intervals the configuration popover offers. The approved ladder is
 * `1, 2, 5 × 10^n`; 0.5 m is `5 × 10^-1`, and the coarser values keep the
 * reference scale recognisable at architectural zooms.
 */
export const GRID_MINOR_CHOICES = [0.5, 1, 2, 5, 10] as const;

export const GRID_MINOR_MIN_METERS = 0.01;
export const GRID_MINOR_MAX_METERS = 1000;

/** A partial change the shell, the app menu or a key may request. */
export type StageDraftingPatch = Partial<StageDraftingState>;

/**
 * Whether a number is a `1, 2, 5 × 10^n` ladder value, not an arbitrary
 * interval. A configured override is validated against the approved ladder so
 * the grid can never invent a spacing the design contract does not name.
 */
export function isGridMinorMeters(value: unknown): value is number {
	if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return false;
	if (value < GRID_MINOR_MIN_METERS || value > GRID_MINOR_MAX_METERS) return false;
	const exponent = Math.floor(Math.log10(value) + 1e-9);
	const mantissa = value / 10 ** exponent;
	return [1, 2, 5].some((candidate) => Math.abs(mantissa - candidate) < 1e-9);
}

export function sameDraftingState(a: StageDraftingState, b: StageDraftingState): boolean {
	return (
		a.grid === b.grid &&
		a.snap === b.snap &&
		a.snapSuspended === b.snapSuspended &&
		a.gridMinorMeters === b.gridMinorMeters
	);
}

/**
 * Apply one patch, ignoring anything that is not a declared fact or a supported
 * ladder interval. The previous object is returned when nothing changed, so a
 * reactive reader is not invalidated by a no-op.
 */
export function applyDraftingPatch(
	current: StageDraftingState,
	patch: StageDraftingPatch
): StageDraftingState {
	const next: StageDraftingState = {
		grid: typeof patch.grid === 'boolean' ? patch.grid : current.grid,
		snap: typeof patch.snap === 'boolean' ? patch.snap : current.snap,
		snapSuspended:
			typeof patch.snapSuspended === 'boolean' ? patch.snapSuspended : current.snapSuspended,
		gridMinorMeters: isGridMinorMeters(patch.gridMinorMeters)
			? patch.gridMinorMeters
			: current.gridMinorMeters
	};
	return sameDraftingState(current, next) ? current : next;
}

/**
 * The increment a free point rounds to, or `null` when Snap is off or held.
 *
 * Snap uses the minor interval even while Grid is off: the two controls are
 * independent facts, and turning the drawing off must not silently change where
 * the next point lands.
 */
export function draftingSnapIncrementMeters(
	state: StageDraftingState,
	currentMinorMeters = state.gridMinorMeters
): number | null {
	if (!state.snap || state.snapSuspended) return null;
	return isGridMinorMeters(currentMinorMeters) ? currentMinorMeters : null;
}

/**
 * The cleaned result of snapping one datum-plane coordinate.
 *
 * `1.4000000000000001` and `-0` are not poses: both the Layout Ink chain and a
 * Scene placement compare and print these values, so one shared cleaning rule
 * keeps them from disagreeing by a float. A negative half rounds away from zero
 * (`Math.round(-1.5) === -1` is asymmetric); a grid that mirrors about the origin
 * must not.
 */
export function snapDraftingCoordinate(value: number, step: number): number {
	const quotient = value / step;
	// Rounds a half away from zero in both directions, so a grid mirrors about
	// the origin instead of inheriting Math.round's asymmetry at negative halves.
	const snapped = (Math.sign(quotient) * Math.round(Math.abs(quotient))) * step;
	const cleaned = Math.round(snapped * 1e9) / 1e9;
	return Object.is(cleaned, -0) ? 0 : cleaned;
}

/** Canonicalize pointer arithmetic without applying a grid interval. */
function cleanDraftingCoordinate(value: number): number {
	if (!Number.isFinite(value)) return value;
	const cleaned = Math.round(value * 1e9) / 1e9;
	return Object.is(cleaned, -0) ? 0 : cleaned;
}

/** A snapped datum-plane placement, with the increment that was applied. */
export type DraftingPlacement = {
	readonly x: number;
	readonly z: number;
	readonly snappedStep: number | null;
};

/**
 * Snap one **free** datum-plane placement. This is the only rounding the shared
 * fact exposes: Layout Ink, free Scene Place, Scene Move and Scene typed entry
 * all call it, so there is no second epsilon, cleaning rule or tie behaviour.
 *
 * A null, zero or non-positive increment is off rather than a zero step.
 */
export function snapDraftingPlacement(
	point: readonly [number, number],
	incrementMeters: number | null
): DraftingPlacement {
	if (
		incrementMeters === null ||
		!Number.isFinite(incrementMeters) ||
		incrementMeters <= 0 ||
		!Number.isFinite(point[0]) ||
		!Number.isFinite(point[1])
	) {
		return {
			x: cleanDraftingCoordinate(point[0]),
			z: cleanDraftingCoordinate(point[1]),
			snappedStep: null
		};
	}
	return {
		x: snapDraftingCoordinate(point[0], incrementMeters),
		z: snapDraftingCoordinate(point[1], incrementMeters),
		snappedStep: incrementMeters
	};
}

/** Round a datum-plane point to the shared increment; identity when Snap is off. */
export function snapDraftingPoint(
	point: readonly [number, number],
	state: StageDraftingState
): readonly [number, number] {
	const snapped = snapDraftingPlacement(point, draftingSnapIncrementMeters(state));
	return [snapped.x, snapped.z];
}

/** A compact, exact-enough interval label: `1 m`, `0.5 m`, `20 m`. */
export function formatMeters(meters: number): string {
	if (!Number.isFinite(meters) || meters <= 0) return '—';
	const rounded = Math.round(meters * 1000) / 1000;
	return `${rounded} m`;
}

/** The Grid word. Off is a word, never colour alone. */
export function gridWord(state: StageDraftingState, drawnMinorMeters = state.gridMinorMeters): string {
	return state.grid ? `Grid ${formatMeters(drawnMinorMeters)}` : 'Grid off';
}

/** The Snap word: off, held, or the increment in force. */
export function snapWord(state: StageDraftingState, currentMinorMeters = state.gridMinorMeters): string {
	if (!state.snap) return 'Snap off';
	if (state.snapSuspended) return 'Snap held';
	return `Snap ${formatMeters(currentMinorMeters)}`;
}

/** PLATE's stated reference for the ratio: one CSS pixel is 1/96 in. */
export const SCALE_REFERENCE_DPI = 96;
/** Meters represented by one CSS pixel at a 1:1 scale on the reference display. */
export const METERS_PER_CSS_PIXEL_AT_UNITY_SCALE = 0.0254 / SCALE_REFERENCE_DPI;

/** The scale ratio (`1:N`) a target-plane pixel size represents. */
export function scaleRatioForMetersPerCssPixel(metersPerCssPixel: number): number | null {
	if (!Number.isFinite(metersPerCssPixel) || metersPerCssPixel <= 0) return null;
	return metersPerCssPixel / METERS_PER_CSS_PIXEL_AT_UNITY_SCALE;
}

/**
 * `1:100`, `—` when no evaluation supplies a scale, or `N:1` past unity.
 *
 * The Stage can zoom closer than the 96 dpi reference; clamping those readings
 * to `1:1` would make the word disagree with the drawing it describes.
 */
export function formatScaleRatio(metersPerCssPixel: number | null): string {
	if (metersPerCssPixel === null) return '—';
	const ratio = scaleRatioForMetersPerCssPixel(metersPerCssPixel);
	if (ratio === null) return '—';
	if (ratio < 1) return `${Math.max(1, Math.round(1 / ratio))}:1`;
	return `1:${Math.round(ratio)}`;
}

/** The target-plane meters per CSS pixel a detent asks for. */
export function metersPerCssPixelForScaleRatio(ratio: number): number | null {
	if (!Number.isFinite(ratio) || ratio <= 0) return null;
	return ratio * METERS_PER_CSS_PIXEL_AT_UNITY_SCALE;
}

/**
 * A Scale detent as the **existing** Camera zoom intent.
 *
 * Zoom's multiplier is expressed in the settled target-plane size, so one
 * relative zoom lands exactly on the requested ratio. No pose is composed here,
 * and no new intent kind is introduced: the request goes through the same
 * `requestIntent` path as every other viewing intent.
 */
export function scaleDetentIntent(
	ratio: number,
	currentMetersPerCssPixel: number
): ViewingIntent | null {
	const target = metersPerCssPixelForScaleRatio(ratio);
	if (target === null || !Number.isFinite(currentMetersPerCssPixel) || currentMetersPerCssPixel <= 0) {
		return null;
	}
	return { kind: 'zoom', scale: target / currentMetersPerCssPixel };
}

/** The five PLATE scale detents. */
export const SCALE_DETENTS = [20, 50, 100, 200, 500] as const;

/**
 * A round scale-bar length at the target plane.
 *
 * The bar prefers a length between roughly 40 and 140 CSS pixels, so it stays
 * readable without spanning the Stage. The returned `cssPx` is the exact
 * projected length of the round meter value.
 */
export function roundScaleBarLength(
	metersPerCssPixel: number,
	maxCssPx = 140
): { readonly meters: number; readonly cssPx: number } | null {
	if (!Number.isFinite(metersPerCssPixel) || metersPerCssPixel <= 0) return null;
	const candidates: number[] = [];
	for (let exponent = -5; exponent <= 6; exponent += 1) {
		for (const mantissa of [1, 2, 5]) {
			const value = mantissa * 10 ** exponent;
			if (value / metersPerCssPixel <= maxCssPx) candidates.push(value);
		}
	}
	if (candidates.length === 0) return null;
	const meters = Math.max(...candidates);
	return { meters, cssPx: meters / metersPerCssPixel };
}
