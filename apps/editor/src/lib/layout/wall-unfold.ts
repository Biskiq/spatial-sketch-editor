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
	createWallDevelopmentBuffers,
	cubicBezierArcLength,
	evaluateWallDevelopment,
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
/** A free edge's resting cue and hit band, in CSS pixels (44 on touch). */
export const WALL_UNFOLD_EDGE_HIT_CSS = 22;
export const WALL_UNFOLD_EDGE_HIT_COARSE_CSS = 44;

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
	/**
	 * Whether entry asked the Camera for a bounded fit. The exact return is
	 * conditional on this and on the creator not having navigated since.
	 */
	readonly entryAdjusted?: boolean;
	/** The settled pose entry produced, or `null` when it made no fit. */
	readonly settled?: WallUnfoldEntryRecipe | null;
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

/** One Opening's occupied arc, in canonical station metres. */
export type WallUnfoldOpeningRange = {
	readonly start: number;
	readonly end: number;
};

/**
 * The display cut opposite the anchor, moved to the nearest solid gap when that
 * half-length lands inside an Opening. The cut is display-only: the canonical
 * seam and the Opening never move.
 */
export function wallUnfoldCutStation(
	anchorStation: number,
	length: number,
	openings: readonly WallUnfoldOpeningRange[] = []
): number {
	if (!(length > 0)) return 0;
	const raw = wrap(anchorStation + length / 2, length);
	const inOpening = (station: number): boolean => openings.some((opening) => {
		const start = wrap(opening.start, length);
		const width = Math.max(0, opening.end - opening.start);
		const offset = wrap(station - start, length);
		return offset <= width + 0.08 || offset >= length - 0.08;
	});
	if (!inOpening(raw)) return raw;
	// Walk outwards in 5 cm steps and take the nearest station that is solid.
	// A cut inside the void would make the free edge a jamb and the peel lie.
	for (let step = 1; step <= Math.ceil(length / 0.05); step += 1) {
		const ahead = wrap(raw + step * 0.05, length);
		if (!inOpening(ahead)) return ahead;
		const behind = wrap(raw - step * 0.05, length);
		if (!inOpening(behind)) return behind;
	}
	return raw;
}

/** Create a settled unfold context at `u = 1` with the display cut opposite the anchor. */
export function createWallUnfoldState(input: {
	readonly wall: CompiledPhysicalWall;
	readonly anchorStation?: number;
	readonly side?: WallUnfoldSide;
	readonly entry: WallUnfoldEntryRecipe;
	readonly u?: number;
	readonly openings?: readonly WallUnfoldOpeningRange[];
}): WallUnfoldState {
	const length = input.wall.length;
	const closed = isClosedCompiledWall(input.wall);
	const rawAnchor = input.anchorStation ?? 0;
	const anchorStation = closed ? wrap(rawAnchor, length) : clamp(rawAnchor, 0, Math.max(0, length));
	return {
		wallId: input.wall.wallId,
		anchorStation,
		// D11 — the display cut is opposite the anchor. It never changes the
		// canonical seam or the Wall's Junction. A cut that falls in an Opening's
		// void moves to the nearest solid gap so the peel edge is real Wall.
		cutStation: closed ? wallUnfoldCutStation(anchorStation, length, input.openings) : null,
		side: input.side ?? 1,
		u: clamp(input.u ?? 1, 0, 1),
		entry: input.entry,
		entryAdjusted: false,
		settled: null
	};
}

/**
 * The station of the sheet's free edge: the display cut on a closed Wall, and
 * the open end farther from the entry anchor on an open Wall. The peel gesture
 * addresses this edge, never the anchored end.
 */
export function wallUnfoldFreeEdgeStation(state: WallUnfoldState, length: number): number {
	if (state.cutStation !== null) return state.cutStation;
	return state.anchorStation <= length / 2 ? length : 0;
}

/** A straight Wall has nothing to peel; it enters the sheet already flat. */
export function isStraightCompiledWall(wall: CompiledPhysicalWall): boolean {
	const samples = wall.samples;
	if (samples.length < 3) return true;
	const [ax, az] = samples[0]!.point;
	const [bx, bz] = samples[1]!.point;
	const dx = bx - ax;
	const dz = bz - az;
	const length = Math.hypot(dx, dz);
	if (!(length > 0)) return true;
	for (const sample of samples) {
		const cross = dx * (sample.point[1] - az) - dz * (sample.point[0] - ax);
		if (Math.abs(cross) > length * 1e-4) return false;
	}
	return true;
}

/**
 * The face the sheet opens on: the one toward the Camera, so the creator is
 * already looking at the reading. In Plan there is no eye-side reading, so the
 * Room side (the Wall's own left normal) is used.
 */
export function wallUnfoldSideTowardCamera(input: {
	readonly wall: CompiledPhysicalWall;
	readonly eye: readonly [number, number, number] | null;
	readonly reading: ViewportReading;
	readonly anchorStation?: number;
}): WallUnfoldSide {
	if (input.reading === 'plan' || input.eye === null) return 1;
	const samples = input.wall.samples;
	if (samples.length === 0) return 1;
	const station = input.anchorStation ?? 0;
	let nearest = samples[0]!;
	let nearestDistance = Math.abs(nearest.distance - station);
	for (const sample of samples) {
		const distance = Math.abs(sample.distance - station);
		if (distance < nearestDistance) {
			nearest = sample;
			nearestDistance = distance;
		}
	}
	const normal: LayoutVec2 = [-nearest.tangent[1], nearest.tangent[0]];
	const dot =
		(input.eye[0] - nearest.point[0]) * normal[0] +
		(input.eye[2] - nearest.point[1]) * normal[1];
	return dot >= 0 ? 1 : -1;
}

/** The canonical station nearest a world point (the view centre, not the eye). */
export function wallUnfoldViewCentreStation(
	wall: CompiledPhysicalWall,
	target: readonly [number, number, number] | null
): number | null {
	if (target === null || wall.samples.length === 0) return null;
	let nearest = wall.samples[0]!;
	let nearestDistance = Math.hypot(nearest.point[0] - target[0], nearest.point[1] - target[2]);
	for (const sample of wall.samples) {
		const distance = Math.hypot(sample.point[0] - target[0], sample.point[1] - target[2]);
		if (distance < nearestDistance) {
			nearest = sample;
			nearestDistance = distance;
		}
	}
	return nearest.distance;
}

export type WallUnfoldBounds = {
	readonly min: [number, number, number];
	readonly max: [number, number, number];
};

/**
 * One bounded fit box: the as-built Wall plus the fully developed sheet, with a
 * little air. The fit covers the whole peel range, so peeling never needs a
 * second Camera move.
 */
export function wallUnfoldFitBounds(input: {
	readonly wall: CompiledPhysicalWall;
	readonly state: WallUnfoldState;
	readonly floorY: number;
}): WallUnfoldBounds {
	const { wall, state } = input;
	const floorY = input.floorY;
	const pad = wall.thickness / 2 + 0.25;
	let minX = Number.POSITIVE_INFINITY;
	let maxX = Number.NEGATIVE_INFINITY;
	let minZ = Number.POSITIVE_INFINITY;
	let maxZ = Number.NEGATIVE_INFINITY;
	const include = (x: number, z: number): void => {
		minX = Math.min(minX, x - pad);
		maxX = Math.max(maxX, x + pad);
		minZ = Math.min(minZ, z - pad);
		maxZ = Math.max(maxZ, z + pad);
	};
	for (const sample of wall.samples) include(sample.point[0], sample.point[1]);
	const prepared = prepareWallDevelopment({
		wallId: wall.wallId,
		samples: wallUnfoldSamples(wall),
		closed: isClosedCompiledWall(wall),
		anchorStation: state.anchorStation,
		cutStation: state.cutStation
	});
	if (!('refused' in prepared)) {
		const buffers = createWallDevelopmentBuffers(prepared);
		for (const u of [0, 0.5, 1]) {
			evaluateWallDevelopment(prepared, u, buffers);
			for (let index = 0; index < prepared.sampleCount; index += 1) {
				include(buffers.points[index * 2]!, buffers.points[index * 2 + 1]!);
			}
		}
	} else {
		for (const sample of wall.samples) {
			include(sample.point[0] + sample.tangent[1] * wall.length, sample.point[1] - sample.tangent[0] * wall.length);
		}
	}
	return {
		min: [minX, floorY - 0.2, minZ],
		max: [maxX, floorY + wall.height + 0.2, maxZ]
	};
}

/** Compare two settled inspection poses; position and orientation only. */
export function sameInspectionPose(
	a: InspectionPose,
	b: InspectionPose,
	epsilon = 1e-4
): boolean {
	const near = (left: number, right: number): boolean => Math.abs(left - right) <= epsilon;
	return (
		near(a.target[0], b.target[0]) &&
		near(a.target[1], b.target[1]) &&
		near(a.target[2], b.target[2]) &&
		near(a.azimuthRadians, b.azimuthRadians) &&
		near(a.elevationRadians, b.elevationRadians) &&
		near(a.targetPlaneHeightMeters, b.targetPlaneHeightMeters) &&
		(a.fovYDegrees ?? null) === (b.fovYDegrees ?? null)
	);
}

/**
 * The Put back rule. The entry pose is restored only when entry performed a
 * bounded fit and the creator has not navigated since; deliberate pan, zoom or
 * orbit keeps the creator's viewpoint.
 */
export function wallUnfoldShouldReturn(input: {
	readonly entryAdjusted: boolean | undefined;
	readonly settled: WallUnfoldEntryRecipe | null | undefined;
	readonly current: WallUnfoldEntryRecipe;
}): boolean {
	if (input.entryAdjusted !== true) return false;
	if (input.settled === null || input.settled === undefined) return false;
	return (
		input.current.reading === input.settled.reading &&
		sameInspectionPose(input.current.pose, input.settled.pose)
	);
}

/** One sampled screen position of a free edge at a candidate unroll amount. */
export type WallUnfoldEdgeCandidate = {
	readonly u: number;
	readonly css: readonly [number, number];
};

/** The drawn length of a candidate edge path, in CSS pixels. */
export function unfoldEdgePathLength(candidates: readonly WallUnfoldEdgeCandidate[]): number {
	let total = 0;
	for (let index = 1; index < candidates.length; index += 1) {
		const previous = candidates[index - 1]!;
		const current = candidates[index]!;
		total += Math.hypot(current.css[0] - previous.css[0], current.css[1] - previous.css[1]);
	}
	return total;
}

/**
 * The pointer solve for a free-edge peel: take the candidate nearest the
 * pointer, biased toward the current amount so the sheet does not jump between
 * equal-distance samples. `null` means the screen path is too short to read (the
 * edge travels toward the Camera) and the caller should use the 260 px mapping.
 */
export function chooseUnfoldAmount(input: {
	readonly candidates: readonly WallUnfoldEdgeCandidate[];
	readonly pointer: readonly [number, number];
	readonly currentU: number;
	readonly biasPx?: number;
}): number | null {
	if (input.candidates.length < 2) return null;
	if (unfoldEdgePathLength(input.candidates) < 120) return null;
	const bias = input.biasPx ?? 30;
	let best: WallUnfoldEdgeCandidate | null = null;
	let bestScore = Number.POSITIVE_INFINITY;
	for (const candidate of input.candidates) {
		const distance = Math.hypot(
			candidate.css[0] - input.pointer[0],
			candidate.css[1] - input.pointer[1]
		);
		const score = distance + Math.abs(candidate.u - input.currentU) * bias;
		if (score < bestScore) {
			best = candidate;
			bestScore = score;
		}
	}
	return best?.u ?? null;
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
