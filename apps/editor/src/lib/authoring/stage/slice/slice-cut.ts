/**
 * The typed cut — one contract for the three Slice readings.
 *
 * Pure, editor-only: no Svelte, no Three, no Layout import. A reading stores
 * **what kind of cut** the creator asked for; `resolveSlice` resolves it against
 * live view state into world metres, and `ResolvedSlice` is the only input every
 * consumer (GPU planes, caps, ghosts, picking, tests) shares. Nothing here
 * re-derives a cut from geometry: Layout's own plan streams answer what is cut.
 *
 * **SL1 is the Level arm.** Its elevation is not stored — it *is* the Height
 * Sheet, so dragging the Sheet moves the plane and Plan and the Slice can never
 * disagree. `depth` is the vertical extent **below** the cut that stays shown:
 * `to-floor` means "no lower bound of the Slice's own" (not a distance), and a
 * finite `below` distance travels with the cut while the Sheet moves.
 *
 * SL2's drawn arm is deliberately absent: it adds a horizontal inspection depth
 * and a segment, which is a different type with no `to-floor` at all. SL3's
 * Section consumes a drawn reading and is likewise absent. Adding either must not
 * change the Level arm.
 */
import type { PlanParameterOverrides } from '../plan-parameters';
import { PLAN_DEFAULT_DEPTH_METERS } from '../plan-parameters';
import type { StageHeightTick } from '../stage-height-sheet';

/**
 * How far below a Level cut stays shown.
 *
 * `to-floor` is **not** a distance: it means no lower bound of the Slice's own,
 * so the GPU lower plane is a no-op and Plan keeps its own default depth.
 */
export type LevelDepth =
	| { readonly kind: 'to-floor' }
	| { readonly kind: 'below'; readonly meters: number };

/** The one live reading's value. SL1 can only hold a Level reading. */
export type SliceReading = { readonly kind: 'level'; readonly depth: LevelDepth };

/** A reading resolved against live view state, in world metres. */
export type ResolvedSlice = {
	readonly kind: 'level';
	/** The plane's world Y: the Height Sheet's height above the level datum. */
	readonly cutY: number;
	/** The lowest shown world Y, or `null` when the reading has no lower bound. */
	readonly lowerY: number | null;
};

/**
 * One convex region the Slice hides. Level has at most two — above the cut and,
 * with a finite depth, below the lower bound — and they are pairwise separated by
 * the visible band, which is what makes the ghost rule in `slice-ghost.ts` exact.
 */
export type HiddenPiece =
	| { readonly kind: 'above'; readonly cutY: number }
	| { readonly kind: 'below'; readonly lowerY: number };

/** The boundary tolerance every CPU predicate shares. Display stays exact. */
export const SLICE_HIDE_EPSILON_METERS = 1e-4;

/** The sheet height and the level datum a Level reading resolves against. */
export type SliceResolveInput = {
	readonly sheetHeight: number;
	readonly datumMeters: number;
};

/**
 * Resolve a reading into world metres.
 *
 * A `below` depth that is not a finite positive number is treated as `to-floor`:
 * a non-distance is never allowed to become a lower bound. A computed lower bound
 * at or under the datum is normalised to `null`, because below the floor nothing
 * is shown anyway and a plane there would be a second, invisible cut.
 */
export function resolveSlice(reading: SliceReading, input: SliceResolveInput): ResolvedSlice {
	const sheetHeight = Number.isFinite(input.sheetHeight) ? Math.max(0, input.sheetHeight) : 0;
	const datumMeters = Number.isFinite(input.datumMeters) ? input.datumMeters : 0;
	const cutY = datumMeters + sheetHeight;
	if (reading.depth.kind === 'below' && Number.isFinite(reading.depth.meters) && reading.depth.meters > 0) {
		const lowerY = cutY - reading.depth.meters;
		return { kind: 'level', cutY, lowerY: lowerY > datumMeters ? lowerY : null };
	}
	return { kind: 'level', cutY, lowerY: null };
}

/** The hidden regions of a resolved reading, in world metres. */
export function hiddenPiecesOf(resolved: ResolvedSlice): readonly HiddenPiece[] {
	const pieces: HiddenPiece[] = [{ kind: 'above', cutY: resolved.cutY }];
	if (resolved.lowerY !== null) pieces.push({ kind: 'below', lowerY: resolved.lowerY });
	return pieces;
}

/**
 * Whether `y` lies inside one hidden piece, given a tolerance.
 *
 * The band is **inclusive**: a point on the cut plane or on the lower bound is
 * shown, so a point is hidden only when it is hidden by more than `eps`. The same
 * convention as the GPU planes (kept iff `lowerY ≤ y ≤ cutY`), kept against
 * float round-off in picking.
 */
export function pieceContains(piece: HiddenPiece, y: number, eps: number = SLICE_HIDE_EPSILON_METERS): boolean {
	return piece.kind === 'above' ? y > piece.cutY + eps : y < piece.lowerY - eps;
}

/**
 * The single truth for "is this point hidden by the Slice".
 *
 * Display derives its planes from `ResolvedSlice`, picking and the ghost test
 * call this, and the tests assert both sides of every boundary. `x`/`z` are part
 * of the signature because SL2's drawn arm needs them; a Level cut is horizontal
 * and ignores them.
 */
export function sliceHides(
	resolved: ResolvedSlice,
	_x: number,
	y: number,
	_z: number,
	eps: number = SLICE_HIDE_EPSILON_METERS
): boolean {
	for (const piece of hiddenPiecesOf(resolved)) {
		if (pieceContains(piece, y, eps)) return true;
	}
	return false;
}

/**
 * The Plan parameters a Level slice implies.
 *
 * The cut height is already the Sheet's (the host subscribes Plan to it), so only
 * the depth is overridden: `to-floor` keeps Plan's own calibrated default, exactly
 * as Plan reads without a Slice, and a finite depth narrows the band Plan shows.
 */
export function planOverridesOf(resolved: ResolvedSlice): PlanParameterOverrides {
	return {
		depthMeters:
			resolved.lowerY === null ? PLAN_DEFAULT_DEPTH_METERS : resolved.cutY - resolved.lowerY
	};
}

/** One row of the pill's depth menu. There are no disabled rows. */
export type SliceDepthItem =
	| { readonly kind: 'to-floor'; readonly label: string; readonly checked: boolean }
	| {
			readonly kind: 'below';
			readonly meters: number;
			readonly label: string;
			readonly checked: boolean;
	  };

/** Two depths closer than this are the same menu row, not a stack. */
export const SLICE_DEPTH_ITEM_TOLERANCE_METERS = 1e-3;

/**
 * The depth menu: **To the floor** and every Sheet tick strictly below the cut
 * and above the datum.
 *
 * A Level reading stores no elevation — the cut *is* the Sheet — so the caller
 * passes the Sheet's height. A tick at or above the cut would ask for a depth of
 * zero or a band that inverts, and a tick at the datum is "To the floor", so
 * neither is offered: the menu has no disabled rows. Tick labels are the Sheet's
 * own words, so the menu and the rail cannot name one height two ways.
 */
export function sliceDepthItems(input: {
	readonly reading: SliceReading;
	readonly sheetHeightMeters: number;
	readonly ticks: readonly StageHeightTick[];
}): readonly SliceDepthItem[] {
	const sheetHeight = Number.isFinite(input.sheetHeightMeters)
		? Math.max(0, input.sheetHeightMeters)
		: 0;
	const current =
		input.reading.depth.kind === 'below' &&
		Number.isFinite(input.reading.depth.meters) &&
		input.reading.depth.meters > 0
			? input.reading.depth.meters
			: null;
	const items: SliceDepthItem[] = [
		{ kind: 'to-floor', label: 'To the floor', checked: current === null }
	];
	const rows: number[] = [];
	for (const tick of input.ticks) {
		if (!Number.isFinite(tick.heightMeters)) continue;
		if (tick.heightMeters <= 0) continue;
		if (tick.heightMeters >= sheetHeight) continue;
		if (rows.some((row) => Math.abs(row - tick.heightMeters) <= SLICE_DEPTH_ITEM_TOLERANCE_METERS)) continue;
		rows.push(tick.heightMeters);
	}
	rows.sort((a, b) => b - a);
	for (const height of rows) {
		const tick = input.ticks.find((candidate) => candidate.heightMeters === height);
		const meters = sheetHeight - height;
		items.push({
			kind: 'below',
			meters,
			label: tick?.label ?? `${height.toFixed(2)} m`,
			checked: current !== null && Math.abs(current - meters) <= SLICE_DEPTH_ITEM_TOLERANCE_METERS
		});
	}
	return items;
}
