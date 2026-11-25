/**
 * The typed cut — one contract for the Slice readings.
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
 * **SL2 is the drawn arm.** A finite segment on the ground plane cuts vertically
 * through the world. `hidden` names which side of the segment is removed at draw
 * time; `depthMeters` is how far behind that cut stays shown. Its hidden region is
 * two convex pieces — the whole near side and the far slab below the depth — which
 * `slice-ghost.ts` treats exactly. SL3's analytic Section is not part of this
 * contract.
 */
import { LAYOUT_SLICE_CONTACT_METERS } from '@portfolio/layout-core/room';
import type { PlanParameterOverrides } from '../plan-parameters';
import { PLAN_DEFAULT_DEPTH_METERS } from '../plan-parameters';
import type { StageHeightTick } from '../stage-height-sheet';
import type { ClipHalfPlane } from './slice-clip-2d';

export type SliceVec2 = readonly [number, number];
export type SliceVec3 = readonly [number, number, number];

/**
 * How far below a Level cut stays shown.
 *
 * `to-floor` is **not** a distance: it means no lower bound of the Slice's own,
 * so the GPU lower plane is a no-op and Plan keeps its own default depth.
 */
export type LevelDepth =
	| { readonly kind: 'to-floor' }
	| { readonly kind: 'below'; readonly meters: number };

/** Which side of a drawn segment is removed. */
export type SliceDrawnSide = 'left' | 'right';

/** The one live reading's value. */
export type SliceReading =
	| { readonly kind: 'level'; readonly depth: LevelDepth }
	| {
			readonly kind: 'drawn';
			readonly start: SliceVec2;
			readonly end: SliceVec2;
			readonly hidden: SliceDrawnSide;
			readonly depthMeters: number;
	  };

export type LevelResolvedSlice = {
	readonly kind: 'level';
	/** The plane's world Y: the Height Sheet's height above the level datum. */
	readonly cutY: number;
	/** The lowest shown world Y, or `null` when the reading has no lower bound. */
	readonly lowerY: number | null;
};

export type DrawnResolvedSlice = {
	readonly kind: 'drawn';
	/** Midpoint of the segment on the datum plane. */
	readonly origin: SliceVec3;
	/** Unit direction from `start` to `end`, in the ground plane. */
	readonly along: SliceVec3;
	/** Unit normal toward the removed side, in the ground plane. */
	readonly hiddenNormal: SliceVec3;
	/** Half the segment length, so `start = origin - along * halfLength`. */
	readonly halfLength: number;
	/** How far behind the cut stays shown, in metres. Always finite and > 0. */
	readonly depthMeters: number;
	readonly hidden: SliceDrawnSide;
	/** World-space endpoints at the datum plane, for handles and caps. */
	readonly start: SliceVec3;
	readonly end: SliceVec3;
};

/** A reading resolved against live view state, in world metres. */
export type ResolvedSlice = LevelResolvedSlice | DrawnResolvedSlice;

/**
 * One convex region the Slice hides. Level has at most two — above the cut and,
 * with a finite depth, below the lower bound — and they are pairwise separated by
 * the visible band. A drawn reading's near side and its far slab are likewise
 * convex and separated by the visible band plus the segment extent.
 */
export type HiddenPiece =
	| { readonly kind: 'above'; readonly cutY: number }
	| { readonly kind: 'below'; readonly lowerY: number }
	| {
			readonly kind: 'drawn-near';
			readonly origin: SliceVec3;
			readonly along: SliceVec3;
			readonly hiddenNormal: SliceVec3;
			readonly halfLength: number;
	  }
	| {
			readonly kind: 'drawn-beyond';
			readonly origin: SliceVec3;
			readonly along: SliceVec3;
			readonly hiddenNormal: SliceVec3;
			readonly halfLength: number;
			readonly depthMeters: number;
	  };

/** The boundary tolerance every CPU predicate shares. Display stays exact. */
export const SLICE_HIDE_EPSILON_METERS = LAYOUT_SLICE_CONTACT_METERS;

/** The nearest a drawn depth may come to its cut plane. */
export const SLICE_MIN_DRAWN_DEPTH_METERS = 0.1;

/** Shortest drawable segment; a tap is not a cut. */
export const SLICE_MIN_DRAWN_LENGTH_METERS = 0.1;

/** The sheet height and the level datum a reading resolves against. */
export type SliceResolveInput = {
	readonly sheetHeight: number;
	readonly datumMeters: number;
};

/** The two ground-plane normals a drawn side can name, with Y up. */
export function drawnHiddenNormal(along: SliceVec3, side: SliceDrawnSide): SliceVec3 {
	// Right of east (+x) is south (+z), matching the Plan's screen axes; left is
	// the opposite. Zero is normalised so a cardinal segment never carries `-0` into
	// a snapshot, a key or an equality check.
	const x = side === 'right' ? -along[2] : along[2];
	const z = side === 'right' ? along[0] : -along[0];
	return [x === 0 ? 0 : x, 0, z === 0 ? 0 : z];
}

/** The side a normal points to, the inverse of `drawnHiddenNormal`. */
export function drawnSideOfNormal(along: SliceVec3, normal: SliceVec3): SliceDrawnSide {
	const left = drawnHiddenNormal(along, 'left');
	return left[0] * normal[0] + left[2] * normal[2] >= 0 ? 'left' : 'right';
}

/**
 * Which side a new segment hides.
 *
 * In Plan there is no camera side to read, so the grammar's right of the segment as
 * drawn is the default and Flip is the reversible correction. In 3D the eye decides:
 * the near side is the one the creator is looking through. A missing eye falls back
 * to the Plan rule rather than guessing.
 */
export function drawnHiddenSide(input: {
	readonly start: SliceVec2;
	readonly end: SliceVec2;
	readonly eye: SliceVec3 | null;
	readonly datumMeters: number;
	readonly reading: 'plan' | '3d' | null;
}): SliceDrawnSide {
	if (input.reading === 'plan' || input.eye === null) return 'right';
	const dx = input.end[0] - input.start[0];
	const dz = input.end[1] - input.start[1];
	const length = Math.hypot(dx, dz);
	if (length <= 1e-9) return 'right';
	const along: SliceVec3 = [dx / length, 0, dz / length];
	const right = drawnHiddenNormal(along, 'right');
	const b =
		(input.eye[0] - (input.start[0] + input.end[0]) / 2) * right[0] +
		(input.eye[1] - input.datumMeters) * right[1] +
		(input.eye[2] - (input.start[1] + input.end[1]) / 2) * right[2];
	return b > 0 ? 'right' : 'left';
}

/**
 * Resolve a reading into world metres.
 *
 * A `below` depth that is not a finite positive number is treated as `to-floor`:
 * a non-distance is never allowed to become a lower bound. A computed lower bound
 * at or under the datum is normalised to `null`, because below the floor nothing
 * is shown anyway and a plane there would be a second, invisible cut.
 *
 * A drawn segment shorter than the minimum still resolves, but to a zero-extent
 * cut that hides nothing: a degenerate drag never becomes an invisible world cut.
 */
export function resolveSlice(reading: SliceReading, input: SliceResolveInput): ResolvedSlice {
	const datumMeters = Number.isFinite(input.datumMeters) ? input.datumMeters : 0;
	if (reading.kind === 'drawn') {
		const finite = (value: number): number => (Number.isFinite(value) ? value : 0);
		const x0 = finite(reading.start[0]);
		const z0 = finite(reading.start[1]);
		const x1 = finite(reading.end[0]);
		const z1 = finite(reading.end[1]);
		const dx = x1 - x0;
		const dz = z1 - z0;
		const length = Math.hypot(dx, dz);
		const drawable = length >= SLICE_MIN_DRAWN_LENGTH_METERS;
		const along: SliceVec3 = drawable ? [dx / length, 0, dz / length] : [1, 0, 0];
		const halfLength = drawable ? length / 2 : 0;
		const depthMeters =
			Number.isFinite(reading.depthMeters) && reading.depthMeters >= SLICE_MIN_DRAWN_DEPTH_METERS
				? reading.depthMeters
				: SLICE_MIN_DRAWN_DEPTH_METERS;
		const midX = (x0 + x1) / 2;
		const midZ = (z0 + z1) / 2;
		const origin: SliceVec3 = [midX, datumMeters, midZ];
		const hiddenNormal = drawnHiddenNormal(along, reading.hidden);
		return {
			kind: 'drawn',
			origin,
			along,
			hiddenNormal,
			halfLength,
			depthMeters,
			hidden: reading.hidden,
			start: [origin[0] - along[0] * halfLength, datumMeters, origin[2] - along[2] * halfLength],
			end: [origin[0] + along[0] * halfLength, datumMeters, origin[2] + along[2] * halfLength]
		};
	}
	const sheetHeight = Number.isFinite(input.sheetHeight) ? Math.max(0, input.sheetHeight) : 0;
	const cutY = datumMeters + sheetHeight;
	if (reading.depth.kind === 'below' && Number.isFinite(reading.depth.meters) && reading.depth.meters > 0) {
		const lowerY = cutY - reading.depth.meters;
		return { kind: 'level', cutY, lowerY: lowerY > datumMeters ? lowerY : null };
	}
	return { kind: 'level', cutY, lowerY: null };
}

/** The hidden regions of a resolved reading, in world metres. */
export function hiddenPiecesOf(resolved: ResolvedSlice): readonly HiddenPiece[] {
	if (resolved.kind === 'drawn') {
		if (resolved.halfLength <= 0) return [];
		const common = {
			origin: resolved.origin,
			along: resolved.along,
			hiddenNormal: resolved.hiddenNormal,
			halfLength: resolved.halfLength
		};
		return [
			{ kind: 'drawn-near', ...common },
			{ kind: 'drawn-beyond', ...common, depthMeters: resolved.depthMeters }
		];
	}
	const pieces: HiddenPiece[] = [{ kind: 'above', cutY: resolved.cutY }];
	if (resolved.lowerY !== null) pieces.push({ kind: 'below', lowerY: resolved.lowerY });
	return pieces;
}

/**
 * Whether a Level point `y` lies inside one hidden piece, given a tolerance.
 *
 * The band is **inclusive**: a point on the cut plane or on the lower bound is
 * shown, so a point is hidden only when it is hidden by more than `eps`.
 */
export function pieceContains(piece: HiddenPiece, y: number, eps: number = SLICE_HIDE_EPSILON_METERS): boolean {
	if (piece.kind === 'above') return y > piece.cutY + eps;
	if (piece.kind === 'below') return y < piece.lowerY - eps;
	return false;
}

/** Whether a world point lies inside one hidden piece, drawn arms included. */
export function pieceContainsPoint(
	piece: HiddenPiece,
	x: number,
	y: number,
	z: number,
	eps: number = SLICE_HIDE_EPSILON_METERS
): boolean {
	if (piece.kind === 'above' || piece.kind === 'below') return pieceContains(piece, y, eps);
	const px = x - piece.origin[0];
	const py = y - piece.origin[1];
	const pz = z - piece.origin[2];
	const s = px * piece.along[0] + py * piece.along[1] + pz * piece.along[2];
	if (Math.abs(s) > piece.halfLength + eps) return false;
	const b = px * piece.hiddenNormal[0] + py * piece.hiddenNormal[1] + pz * piece.hiddenNormal[2];
	return piece.kind === 'drawn-near' ? b > eps : b < -piece.depthMeters - eps;
}

/**
 * The single truth for "is this point hidden by the Slice".
 *
 * Display derives its planes and shader from `ResolvedSlice`, picking and the
 * ghost test call this, and the tests assert both sides of every boundary.
 *
 * The drawn GPU predicate is
 * `|s| <= halfLength && (b > 0.0 || b < -depth)`; the CPU adds only the shared
 * round-off tolerance, so a sample on a boundary is visible both places.
 */
export function sliceHides(
	resolved: ResolvedSlice,
	x: number,
	y: number,
	z: number,
	eps: number = SLICE_HIDE_EPSILON_METERS
): boolean {
	if (resolved.kind === 'drawn') {
		if (resolved.halfLength <= 0) return false;
		const px = x - resolved.origin[0];
		const py = y - resolved.origin[1];
		const pz = z - resolved.origin[2];
		const s = px * resolved.along[0] + py * resolved.along[1] + pz * resolved.along[2];
		if (Math.abs(s) > resolved.halfLength + eps) return false;
		const b =
			px * resolved.hiddenNormal[0] +
			py * resolved.hiddenNormal[1] +
			pz * resolved.hiddenNormal[2];
		return b > eps || b < -resolved.depthMeters - eps;
	}
	for (const piece of hiddenPiecesOf(resolved)) {
		if (pieceContains(piece, y, eps)) return true;
	}
	return false;
}

/** `kx * x + kz * z <= c` for the drawn frame's `s` or `b` coordinate bound. */
function drawnPlanBound(
	resolved: DrawnResolvedSlice,
	axis: SliceVec3,
	sense: 'max' | 'min',
	value: number
): ClipHalfPlane {
	const offset = axis[0] * resolved.origin[0] + axis[2] * resolved.origin[2];
	return sense === 'max'
		? { nx: axis[0], ny: axis[2], c: value + offset }
		: { nx: -axis[0], ny: -axis[2], c: -value - offset };
}

/**
 * The **shown** plan region of a drawn cut as convex cells, in plan `(x, z)`.
 *
 * The drawn predicate does not read `y`, so what is shown is a plan region: outside
 * the finite extent on either end, or inside it within the shown depth band. Those
 * are three convex cells whose union is exactly `!sliceHides` (with the same shared
 * tolerance), so a consumer can clip geometry to what the GPU draws instead of
 * sampling it. Picking uses this; a zero-extent cut shows everything (one empty
 * cell list, i.e. the whole plane).
 */
export function drawnShownPlanCells(
	resolved: DrawnResolvedSlice,
	eps: number = SLICE_HIDE_EPSILON_METERS
): readonly (readonly ClipHalfPlane[])[] {
	if (resolved.halfLength <= 0) return [[]];
	const extent = resolved.halfLength + eps;
	return [
		[drawnPlanBound(resolved, resolved.along, 'max', -extent)],
		[drawnPlanBound(resolved, resolved.along, 'min', extent)],
		[
			drawnPlanBound(resolved, resolved.along, 'min', -extent),
			drawnPlanBound(resolved, resolved.along, 'max', extent),
			drawnPlanBound(resolved, resolved.hiddenNormal, 'max', eps),
			drawnPlanBound(resolved, resolved.hiddenNormal, 'min', -resolved.depthMeters - eps)
		]
	];
}

/**
 * The **hidden** pieces of a drawn cut as closed convex plan cells (no tolerance).
 *
 * Closed on purpose: a consumer asking "does this touch a hidden piece?" (the ghost's
 * fully-visible shortcut) must err toward the exact test, never away from it.
 */
export function drawnHiddenPlanCells(resolved: DrawnResolvedSlice): readonly (readonly ClipHalfPlane[])[] {
	if (resolved.halfLength <= 0) return [];
	const extent = [
		drawnPlanBound(resolved, resolved.along, 'min', -resolved.halfLength),
		drawnPlanBound(resolved, resolved.along, 'max', resolved.halfLength)
	];
	return [
		[...extent, drawnPlanBound(resolved, resolved.hiddenNormal, 'min', 0)],
		[...extent, drawnPlanBound(resolved, resolved.hiddenNormal, 'max', -resolved.depthMeters)]
	];
}

/**
 * The furthest visible-side distance the current content spans from a drawn cut.
 *
 * This is the finite depth's upper clamp, measured toward the shown side, so the
 * whole remaining world can always be uncovered. With nothing on the shown side
 * the clamp is the minimum rather than an inverted interval.
 */
export function drawnFarSideDistance(
	resolved: DrawnResolvedSlice,
	bounds: { readonly min: SliceVec3; readonly max: SliceVec3 } | null
): number {
	let furthest = 0;
	if (bounds !== null) {
		for (const x of [bounds.min[0], bounds.max[0]]) {
			for (const y of [bounds.min[1], bounds.max[1]]) {
				for (const z of [bounds.min[2], bounds.max[2]]) {
					const b =
						(x - resolved.origin[0]) * resolved.hiddenNormal[0] +
						(y - resolved.origin[1]) * resolved.hiddenNormal[1] +
						(z - resolved.origin[2]) * resolved.hiddenNormal[2];
					if (-b > furthest) furthest = -b;
				}
			}
		}
	}
	return Math.max(SLICE_MIN_DRAWN_DEPTH_METERS, furthest);
}

/** Clamp a depth ray's distance to the finite, always-positive interval. */
export function clampDrawnDepth(meters: number, farSideDistance: number): number {
	const max = Math.max(SLICE_MIN_DRAWN_DEPTH_METERS, farSideDistance);
	const finite = Number.isFinite(meters) ? meters : SLICE_MIN_DRAWN_DEPTH_METERS;
	return Math.min(max, Math.max(SLICE_MIN_DRAWN_DEPTH_METERS, finite));
}

/**
 * Snap a segment's direction to the nearest 45° when it is close, keeping the
 * pointer's length. This is the Wall gesture's soft angle snap, expressed in the
 * ground plane so Plan and 3D share it.
 */
export function snapDrawnAngle(
	start: SliceVec2,
	end: SliceVec2,
	toleranceRadians = Math.PI / 32
): SliceVec2 {
	const dx = end[0] - start[0];
	const dz = end[1] - start[1];
	const length = Math.hypot(dx, dz);
	if (length < 1e-9) return end;
	const angle = Math.atan2(dz, dx);
	const step = Math.PI / 4;
	const snapped = Math.round(angle / step) * step;
	const delta = Math.atan2(Math.sin(angle - snapped), Math.cos(angle - snapped));
	if (Math.abs(delta) > toleranceRadians) return end;
	return [start[0] + Math.cos(snapped) * length, start[1] + Math.sin(snapped) * length];
}

/**
 * The Plan parameters a Level slice implies.
 *
 * The cut height is already the Sheet's (the host subscribes Plan to it), so only
 * the depth is overridden: `to-floor` keeps Plan's own calibrated default, exactly
 * as Plan reads without a Slice, and a finite depth narrows the band Plan shows.
 * A drawn cut is a 3D display clip; it does not change Plan's depth parameter.
 */
export function planOverridesOf(resolved: ResolvedSlice): PlanParameterOverrides {
	if (resolved.kind === 'drawn') return {};
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
	readonly reading: Extract<SliceReading, { kind: 'level' }>;
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
