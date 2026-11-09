/**
 * C3 checkpoint 5 — the **unfold session**.
 *
 * This is display/session state, never authored data: it holds the Wall, the
 * canonical anchor station, the closed-Wall display cut, which face is being
 * read, the partial-unfold amount `u` and the exact camera recipe the context
 * will return to. It is never serialized, never enters history, and Undo never
 * changes it.
 *
 * The geometry itself comes from checkpoint 4's one development map
 * (`layout-wall-development.ts`). This module only prepares that map from a
 * compiled Wall, enforces the D12 scrub rules and states the D13 edit policy in
 * one place so the Card, the Stage and the adapter cannot disagree.
 */
import {
	cubicBezierArcLength,
	prepareWallDevelopment,
	wallCenterlineCubics,
	type CompiledPhysicalWall,
	type CurveSample,
	type LayoutDocumentWallFirst,
	type LayoutVec2,
	type WallDevelopment,
	type WallDevelopmentRefusal,
	type WallDevelopmentSourceSpan
} from '@portfolio/layout-core';
import type { InspectionPose, ViewportReading } from '@portfolio/camera-core';

/** The drag distance that reaches `u = 1`, in CSS pixels (the plan's rule). */
export const WALL_UNFOLD_DRAG_CSS = 260;
/** Below this, a released peel closes silently. */
export const WALL_UNFOLD_CLOSE_THRESHOLD = 0.04;
/** Magnetic stops at half and fully flat. */
export const WALL_UNFOLD_SNAP_TOLERANCE = 0.035;
/** The two developed faces, named by the sign of the lateral offset. */
export type WallUnfoldSide = 1 | -1;

/** Why a shape edit is refused while unfolded (D13). */
export const WALL_UNFOLD_SHAPE_REFUSAL =
	'Centerline and bend-point editing are unavailable while the Wall is unfolded. Fold it back first.';

/**
 * The exact camera recipe captured on entry. The camera authority still owns
 * every realised matrix; this is only the settled state the return intent asks
 * for, so the prior view is restored exactly.
 */
export type WallUnfoldEntryRecipe = {
	readonly pose: InspectionPose;
	readonly reading: ViewportReading;
};

/** One live unfold context. Session-only: nothing here is authored. */
export type WallUnfoldState = {
	readonly wallId: string;
	/** Canonical station the Wall opens around, modulo L for a closed Wall. */
	readonly anchorStation: number;
	/** Closed-Wall display cut opposite the anchor (D11); `null` for an open Wall. */
	readonly cutStation: number | null;
	readonly side: WallUnfoldSide;
	/** Partial-unfold parameter, `0` canonical … `1` flat. */
	readonly u: number;
	readonly entry: WallUnfoldEntryRecipe;
};

/** A compiled self-connected Wall is a closed Wall (one Junction, two legs). */
export function isClosedCompiledWall(
	wall: Pick<CompiledPhysicalWall, 'startJunctionId' | 'endJunctionId'>
): boolean {
	return wall.startJunctionId !== undefined && wall.startJunctionId === wall.endJunctionId;
}

function wrap(value: number, length: number): number {
	if (!(length > 0)) return 0;
	const result = value % length;
	return result < 0 ? result + length : result;
}

function clamp(value: number, minimum: number, maximum: number): number {
	return Math.min(maximum, Math.max(minimum, value));
}

/**
 * The canonical samples a compiled Wall already carries. The development must
 * walk the same polyline the compiler and renderer use; re-sampling here would
 * be a second geometry authority.
 */
export function wallUnfoldSamples(wall: CompiledPhysicalWall): CurveSample[] {
	return wall.samples.map((sample, index) => {
		const tangent: LayoutVec2 = [sample.tangent[0], sample.tangent[1]];
		const normal: LayoutVec2 =
			'normal' in sample && Array.isArray(sample.normal)
				? [sample.normal[0], sample.normal[1]]
				: [-tangent[1], tangent[0]];
		return {
			point: [sample.point[0], sample.point[1]] as LayoutVec2,
			distance: sample.distance,
			tangent,
			normal,
			t: index / Math.max(1, wall.samples.length - 1)
		};
	});
}

/**
 * Choose the anchor. A selected Opening on this Wall wins (its centre is the
 * place the creator is already looking at); otherwise the station nearest the
 * view-centre ray, and finally the canonical start. A closed Wall wraps its
 * anchor, so the display cut can never move the canonical seam.
 */
export function wallUnfoldAnchor(input: {
	readonly wall: CompiledPhysicalWall;
	readonly selectedOpeningCenter?: number | null;
	readonly viewCentreStation?: number | null;
}): number {
	const length = input.wall.length;
	if (!(length > 0)) return 0;
	const closed = isClosedCompiledWall(input.wall);
	const normalise = (value: number): number => (closed ? wrap(value, length) : clamp(value, 0, length));
	if (input.selectedOpeningCenter !== undefined && input.selectedOpeningCenter !== null && Number.isFinite(input.selectedOpeningCenter)) {
		return normalise(input.selectedOpeningCenter);
	}
	if (input.viewCentreStation !== undefined && input.viewCentreStation !== null && Number.isFinite(input.viewCentreStation)) {
		return normalise(input.viewCentreStation);
	}
	return 0;
}

/** Create a settled unfold context at `u = 1` with the display cut opposite the anchor. */
export function createWallUnfoldState(input: {
	readonly wall: CompiledPhysicalWall;
	readonly anchorStation?: number;
	readonly side?: WallUnfoldSide;
	readonly entry: WallUnfoldEntryRecipe;
	readonly u?: number;
}): WallUnfoldState {
	const length = input.wall.length;
	const closed = isClosedCompiledWall(input.wall);
	const rawAnchor = input.anchorStation ?? 0;
	const anchorStation = closed ? wrap(rawAnchor, length) : clamp(rawAnchor, 0, Math.max(0, length));
	return {
		wallId: input.wall.wallId,
		anchorStation,
		// D11 — the display cut is opposite the anchor. It never changes the
		// canonical seam or the Wall's Junction.
		cutStation: closed ? wrap(anchorStation + length / 2, length) : null,
		side: input.side ?? 1,
		u: clamp(input.u ?? 1, 0, 1),
		entry: input.entry
	};
}

/** The drag-to-open mapping: `u = |drag| / 260` CSS px, clamped. */
export function unfoldAmountFromDrag(deltaCss: number): number {
	if (!Number.isFinite(deltaCss)) return 0;
	return clamp(Math.abs(deltaCss) / WALL_UNFOLD_DRAG_CSS, 0, 1);
}

/**
 * The D12 release rules: below 0.04 closes silently; within ±0.035 of half or
 * flat snaps; otherwise the sheet stays where the creator left it.
 */
export function snapWallUnfoldAmount(amount: number): number {
	const value = clamp(amount, 0, 1);
	if (value < WALL_UNFOLD_CLOSE_THRESHOLD) return 0;
	if (Math.abs(value - 0.5) <= WALL_UNFOLD_SNAP_TOLERANCE) return 0.5;
	if (Math.abs(value - 1) <= WALL_UNFOLD_SNAP_TOLERANCE) return 1;
	return value;
}

/** Move the one scrub parameter. It never touches the camera or history. */
export function setWallUnfoldAmount(state: WallUnfoldState, amount: number): WallUnfoldState {
	return { ...state, u: clamp(Number.isFinite(amount) ? amount : state.u, 0, 1) };
}

/** Cancel exactly back to the canonical mesh: `u = 0` is bit-for-bit the compiled state. */
export function refoldWallUnfold(state: WallUnfoldState): WallUnfoldState {
	return { ...state, u: 0 };
}

/** Which face is displayed. Flipping is a display change, never a Wall edit. */
export function flipWallUnfoldSide(state: WallUnfoldState): WallUnfoldState {
	return { ...state, side: state.side === 1 ? -1 : 1 };
}

/** Prepare checkpoint 4's development for this session. */
export function prepareWallUnfoldDevelopment(
	state: WallUnfoldState,
	wall: CompiledPhysicalWall
): WallDevelopment | WallDevelopmentRefusal {
	if (wall.wallId !== state.wallId) {
		return { refused: 'development_invalid_input', message: 'The unfold context names a different Wall.' };
	}
	return prepareWallDevelopment({
		wallId: wall.wallId,
		samples: wallUnfoldSamples(wall),
		closed: isClosedCompiledWall(wall),
		anchorStation: state.anchorStation,
		cutStation: state.cutStation
	});
}

/**
 * The canonical span attribution for a Wall's development map.
 *
 * The compiler retains samples (and the Station they measure) but not the
 * authored knot stations, so the live inverse pick reads them from the same
 * authored Layout the compiler consumed. A straight Wall is one span from its
 * start Junction to its end Junction; a cubic chain is one span per stored
 * cubic, with interior knot IDs naming the joins. This is attribution only: it
 * never changes the centerline, the development map or the display mesh.
 */
export function wallUnfoldSourceSpans(
	layout: LayoutDocumentWallFirst,
	wallId: string,
	length: number
): WallDevelopmentSourceSpan[] {
	const wall = layout.walls.find((candidate) => candidate.id === wallId);
	if (wall === undefined) return [];
	if (wall.centerline.kind === 'line') {
		return [
			{
				index: 0,
				startKnotId: wall.startJunctionId,
				endKnotId: wall.endJunctionId,
				startStation: 0,
				endStation: length,
				arcLength: length
			}
		];
	}
	const start = layout.junctions.find((junction) => junction.id === wall.startJunctionId)?.point;
	const end = layout.junctions.find((junction) => junction.id === wall.endJunctionId)?.point;
	if (start === undefined || end === undefined) return [];
	const centerline = wall.centerline;
	const cubics = wallCenterlineCubics(centerline, start, end, 'forward');
	let station = 0;
	return cubics.map((cubic, index) => {
		const arcLength = cubicBezierArcLength(cubic);
		const span: WallDevelopmentSourceSpan = {
			index,
			startKnotId: index === 0 ? wall.startJunctionId : centerline.knots[index - 1]?.id ?? '',
			endKnotId:
				index === cubics.length - 1 ? wall.endJunctionId : centerline.knots[index]?.id ?? '',
			startStation: station,
			endStation: station + arcLength,
			arcLength
		};
		station += arcLength;
		return span;
	});
}

/**
 * The D13 policy in one place. While unfolded, Opening placement/editing and
 * Wall height stay available because they are canonical Wall facts; centerline
 * and knot shape edits are refused explicitly rather than silently accepted.
 */
export type WallUnfoldEditPolicy = {
	readonly openingPlacement: 'enabled';
	readonly openingEditing: 'enabled';
	readonly wallHeight: 'enabled';
	readonly centerline: { readonly kind: 'refused'; readonly message: string };
	readonly knots: { readonly kind: 'refused'; readonly message: string };
	readonly bodyBend: { readonly kind: 'refused'; readonly message: string };
};

export function wallUnfoldEditPolicy(state: WallUnfoldState | null): WallUnfoldEditPolicy {
	const active = state !== null && state.u >= 0;
	return {
		openingPlacement: 'enabled',
		openingEditing: 'enabled',
		wallHeight: 'enabled',
		centerline: active
			? { kind: 'refused', message: WALL_UNFOLD_SHAPE_REFUSAL }
			: { kind: 'refused', message: 'Fold the Wall back before editing its centerline.' },
		knots: active
			? { kind: 'refused', message: WALL_UNFOLD_SHAPE_REFUSAL }
			: { kind: 'refused', message: 'Fold the Wall back before editing bend points.' },
		bodyBend: active
			? { kind: 'refused', message: WALL_UNFOLD_SHAPE_REFUSAL }
			: { kind: 'refused', message: 'Fold the Wall back before bending it.' }
	};
}

/** Whether a shape edit must refuse for this session. */
export function wallUnfoldRefusesShapeEdit(
	state: WallUnfoldState | null,
	edit: 'centerline' | 'knots' | 'bodyBend' = 'centerline'
): { readonly refused: boolean; readonly message: string | null } {
	if (state === null) return { refused: false, message: null };
	return { refused: true, message: wallUnfoldEditPolicy(state)[edit].message };
}

/**
 * Canonical station for an offset entered while unfolded.
 *
 * An open Wall clamps to its own domain (the existing planner still refuses an
 * out-of-fit Opening); a closed Wall wraps modulo L. This is the only station
 * arithmetic the unfolded Card adds, and it feeds the existing planner rather
 * than a new writer.
 */
export function unfoldCanonicalStation(
	state: WallUnfoldState,
	wall: CompiledPhysicalWall,
	sheetStation: number
): number {
	if (!Number.isFinite(sheetStation)) return 0;
	if (isClosedCompiledWall(wall)) return wrap(state.anchorStation + sheetStation, wall.length);
	return clamp(state.anchorStation + sheetStation, 0, wall.length);
}

/**
 * Invalidate the context when its subject disappears or the document is
 * replaced. It never guesses a nearby Wall: invalidation returns the entry pose
 * and a reason, exactly as the plan requires.
 */
export type WallUnfoldInvalidation =
	| { readonly kind: 'valid' }
	| { readonly kind: 'invalidated'; readonly reason: 'wall-removed' | 'document-replaced' };

export function wallUnfoldInvalidation(input: {
	readonly state: WallUnfoldState | null;
	readonly wallIds: ReadonlySet<string>;
	readonly documentReplaced?: boolean;
}): WallUnfoldInvalidation {
	if (input.state === null) return { kind: 'valid' };
	if (input.documentReplaced === true) return { kind: 'invalidated', reason: 'document-replaced' };
	if (!input.wallIds.has(input.state.wallId)) return { kind: 'invalidated', reason: 'wall-removed' };
	return { kind: 'valid' };
}
