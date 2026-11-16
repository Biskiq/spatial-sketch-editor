/**
 * The typed SL1 Level cut: one contract for display, picking, ghosts and tests.
 *
 * Pure and editor-only — no Svelte, no Three. A `SliceReading` is what the
 * creator asked for (a Level cut at the Height Sheet, and how far below it stays
 * shown); a `ResolvedSlice` is that reading measured against live view state, in
 * world metres. Every consumer — GPU planes, picking, the ghost test, caps and
 * tests — reads the resolved value, so none of them can disagree about where the
 * cut is.
 *
 * **A Level reading stores no elevation.** Its elevation *is* the Height Sheet
 * (Approved: "the plane appears at the Sheet height; dragging the Sheet moves
 * it"). Only the depth travels with the reading, and a `below` depth is a
 * distance, so it follows the cut as the Sheet moves.
 *
 * **Three depths, three meanings.** SL1's depth is the vertical extent below the
 * horizontal cut. `to-floor` is not a distance at all: it means "no lower bound
 * of the Slice's own", so the GPU lower plane is a no-op and Plan keeps its
 * calibrated default depth. SL2's horizontal inspection distance and SL3's
 * projection depth are different types with different rules.
 */
import { PLAN_DEFAULT_DEPTH_METERS, type PlanParameterOverrides } from '../plan-parameters';

/** SL1: how far *below* a horizontal cut stays shown. Vertical. */
export type LevelDepth =
	| { readonly kind: 'to-floor' }
	| { readonly kind: 'below'; readonly meters: number };

/**
 * The one live reading.
 *
 * SL2 adds a `drawn` arm here without changing the level arm; this module
 * deliberately defines only the arm SL1 implements.
 */
export type SliceReading = {
	readonly kind: 'level';
	readonly depth: LevelDepth;
};

/** A reading resolved against live view state, in world metres. */
export type ResolvedSlice = {
	readonly kind: 'level';
	/** The world elevation of the cut plane. */
	readonly cutY: number;
	/** The world elevation below which content is hidden, or `null` for to-floor. */
	readonly lowerY: number | null;
};

/** The two live values a Level reading resolves against. */
export type SliceViewState = {
	/** The Height Sheet's height above the level datum, in metres. */
	readonly sheetHeight: number;
	/** The level datum, in world metres. */
	readonly datumMeters: number;
};

/**
 * How far outside the visible band a point must be to count as hidden.
 *
 * The band is inclusive: content exactly on the cut is still drawn, so the
 * predicate needs a tolerance rather than a bare comparison. The same value is
 * the cap section's plane offset in `mesh-plane-section.ts`.
 */
export const SLICE_HIDE_EPSILON_METERS = 1e-4;

/** The default depth a new Level reading starts with (Approved). */
export const SLICE_DEFAULT_DEPTH: LevelDepth = { kind: 'to-floor' };

/**
 * Resolve a Level reading against the Sheet and the datum.
 *
 * A computed `lowerY` at or below the datum is normalised to `to-floor`: the
 * Slice's own lower bound can never reach past the floor it is measuring from,
 * and Plan never receives a depth that could hide the floor itself.
 */
export function resolveSlice(reading: SliceReading, view: SliceViewState): ResolvedSlice {
	const cutY = view.datumMeters + view.sheetHeight;
	if (reading.depth.kind === 'to-floor') return { kind: 'level', cutY, lowerY: null };
	const meters = reading.depth.meters;
	if (!Number.isFinite(meters) || meters <= 0) return { kind: 'level', cutY, lowerY: null };
	const lowerY = cutY - meters;
	return { kind: 'level', cutY, lowerY: lowerY <= view.datumMeters ? null : lowerY };
}

/**
 * One convex region of the hidden set.
 *
 * The pieces are convex and pairwise separated by the visible band, which is
 * what makes the ghost rule exact: a triangle lies inside a convex piece iff its
 * three vertices do, and a triangle with vertices in two pieces necessarily
 * crosses the visible space between them.
 */
export type HiddenPiece =
	| { readonly kind: 'above'; readonly cutY: number }
	| { readonly kind: 'below'; readonly lowerY: number };

/** The hidden regions of a resolved Level slice, in a stable order. */
export function hiddenPiecesOf(resolved: ResolvedSlice): readonly HiddenPiece[] {
	const pieces: HiddenPiece[] = [{ kind: 'above', cutY: resolved.cutY }];
	if (resolved.lowerY !== null) pieces.push({ kind: 'below', lowerY: resolved.lowerY });
	return pieces;
}

/**
 * Which hidden piece a world height lies in, or `null` when it is in the visible
 * band. `eps` widens the band: a point within `eps` of a boundary is visible.
 */
export function hiddenPieceIndexAt(
	resolved: ResolvedSlice,
	y: number,
	eps = 0
): number | null {
	if (!Number.isFinite(y)) return null;
	if (y > resolved.cutY + eps) return 0;
	if (resolved.lowerY !== null && y < resolved.lowerY - eps) return 1;
	return null;
}

/**
 * **The single truth** for "is this point hidden by the Slice".
 *
 * Display, picking, ghost choice, cap trimming and tests all derive from this
 * predicate or from the same `ResolvedSlice`; the GPU realization is
 * replaceable without touching any consumer. A Level cut is purely vertical, so
 * `x` and `z` are part of the signature only so every Slice kind answers the
 * same question.
 */
export function sliceHides(
	resolved: ResolvedSlice,
	_x: number,
	y: number,
	_z: number,
	eps = SLICE_HIDE_EPSILON_METERS
): boolean {
	return hiddenPieceIndexAt(resolved, y, eps) !== null;
}

/**
 * Plan's existing parameters for this reading.
 *
 * The cut height is already the Sheet's (the Plan cut follows it), so only depth
 * is mapped. `to-floor` keeps Plan's calibrated default exactly as Plan reads
 * without a Slice, and a finite depth narrows it to the same band the GPU draws.
 */
export function planOverridesOf(resolved: ResolvedSlice): PlanParameterOverrides {
	return {
		depthMeters:
			resolved.lowerY === null ? PLAN_DEFAULT_DEPTH_METERS : resolved.cutY - resolved.lowerY
	};
}

/** One height the depth menu can offer, as the Height Sheet names it. */
export type SliceDepthTick = {
	readonly heightMeters: number;
	readonly label: string;
};

/** One depth-menu item. The first item is always `to-floor`. */
export type SliceDepthItem = {
	readonly id: string;
	readonly label: string;
	readonly depth: LevelDepth;
};

/**
 * The depth menu's items: **To the floor** and each Sheet tick strictly below
 * the cut and above the datum.
 *
 * A tick that would not be below the cut is never offered (there are no disabled
 * items), and a datum tick is not a bound. Duplicate heights collapse to their
 * first label, exactly as the Sheet merges ticks.
 */
export function depthMenuItems(
	resolved: ResolvedSlice,
	ticks: readonly SliceDepthTick[],
	datumMeters = 0
): readonly SliceDepthItem[] {
	const items: SliceDepthItem[] = [
		{ id: 'to-floor', label: 'To the floor', depth: { kind: 'to-floor' } }
	];
	const seen = new Set<number>();
	for (const tick of [...ticks].sort((a, b) => a.heightMeters - b.heightMeters)) {
		if (!Number.isFinite(tick.heightMeters)) continue;
		const worldY = datumMeters + tick.heightMeters;
		if (worldY <= datumMeters) continue;
		if (worldY >= resolved.cutY) continue;
		const key = Math.round(worldY * 1e6);
		if (seen.has(key)) continue;
		seen.add(key);
		items.push({
			id: `below:${key}`,
			label: tick.label,
			// Rounded so a Sheet tick produces the metre value it names, not its
			// binary round-off (`1.0999999999999999`).
			depth: { kind: 'below', meters: Math.round((resolved.cutY - worldY) * 1e9) / 1e9 }
		});
	}
	return items;
}

/** Whether a depth is the one a resolved slice is currently showing. */
export function depthMatches(
	resolved: ResolvedSlice,
	depth: LevelDepth,
	eps = 1e-6
): boolean {
	if (depth.kind === 'to-floor') return resolved.lowerY === null;
	if (resolved.lowerY === null) return false;
	return Math.abs(resolved.cutY - resolved.lowerY - depth.meters) <= eps;
}
