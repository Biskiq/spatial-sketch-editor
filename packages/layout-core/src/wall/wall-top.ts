/**
 * `layout-wall-top.ts` — the only place a Wall top is evaluated.
 *
 * A Wall's top is `height + rise(station)`. `height` is the lowest point of the
 * top, `rise` is linear in canonical centerline **station** between the shape's
 * breakpoints, and the smallest end rise is exactly `0`, so every shape has one
 * encoding. Mitred corner vertices sit at stations outside `[0, length]`, so the
 * station is clamped: both Walls at a corner then evaluate exactly their own end
 * height and corner seams stay closed.
 *
 * ```text
 * breakpoints(wall, L):
 *   level  -> [(0, 0), (L, 0)]
 *   slope  -> [(0, startRise), (L, endRise)]
 *   gable  -> [(0, startRise), (apexOffset, apexRise), (L, endRise)]
 * wallTopAt(wall, s, L)     = height + rise at clamp(s, 0, L)
 * wallTopRange(wall, a, b)  = { min, max } over [a, b]
 * ```
 *
 * The compiled profile carries the same evaluation for compiled consumers: one
 * `{ distance, topY }` point per breakpoint, `topY` in the Wall-local frame the
 * compiled sections and Junction legs already use (0 = Floor datum), present
 * only for a non-level top. A level Wall therefore has no profile and takes the
 * pre-format-11 code path everywhere.
 */
import type { LayoutWall, LayoutWallTop, WallTopProfile } from './types';
import { WALL_HEIGHT_EPSILON } from './heights';
import { MAX_LAYOUT_DIMENSION_METERS } from '../geometry/limits';

/** Station tolerance for the apex-versus-length rule, in metres. */
export const WALL_TOP_STATION_EPSILON = 1e-9;

/** One breakpoint of a top: rise above `height` at a centerline station. */
export type WallTopBreakpoint = { distance: number; rise: number };

/** Machine codes for the Wall-top contract. */
export const WALL_TOP_RISE_INVALID_CODE = 'wall_top_rise_invalid';
export const WALL_TOP_APEX_INVALID_CODE = 'wall_top_apex_invalid';
export const WALL_TOP_APEX_OUTSIDE_CODE = 'wall_top_apex_outside';
export const CLOSED_WALL_LEVEL_ONLY_CODE = 'closed_wall_level_only';

/** A Wall top with its own `height` and shape; the result of a slice or a merge. */
export type WallTopSlice = { height: number; top: LayoutWallTop };

/** One side of a join: a top plus the canonical centerline length it spans. */
export type WallTopJoinPart = WallTopSlice & { length: number };

/**
 * A refusal that still applies outside V2b: an overhead-region Wall fit keeps
 * every point of a Wall top under the slab, which is V3's roof-form arithmetic.
 */
export const WALL_TOP_PROFILE_UNSUPPORTED_CODE = 'wall_top_profile_unsupported';
/** Two Wall tops that do not merge into one level, slope or gable. */
export const WALL_TOP_NOT_JOINABLE_CODE = 'wall_top_not_joinable';
/**
 * A split whose fragment top would fall below the P2/P3 tolerances: a cut just
 * outside the station tolerance of the apex, or a piece of top whose whole rise
 * is within the height epsilon. Refused whole, never snapped in height.
 */
export const WALL_TOP_SPLIT_DEGENERATE_CODE = 'wall_top_split_degenerate';

export type WallTopIssue = { code: string; message: string };

/** True when this top is the one shape that compiles to the pre-bump output. */
export function wallTopIsLevel(top: LayoutWallTop): boolean {
	return top.kind === 'level';
}

/** The highest rise this top reaches, in metres. */
export function wallTopMaxRise(top: LayoutWallTop): number {
	switch (top.kind) {
		case 'level':
			return 0;
		case 'slope':
			return Math.max(top.startRise, top.endRise);
		case 'gable':
			return Math.max(top.startRise, top.endRise, top.apexRise);
	}
}

/** True when this Wall is the canonical closed Wall (one Junction at both ends). */
export function wallIsClosed(wall: Pick<LayoutWall, 'startJunctionId' | 'endJunctionId'>): boolean {
	return wall.startJunctionId === wall.endJunctionId;
}

/**
 * Shape-only validation (P1–P3 values): finiteness, the exact-zero lowest end
 * rise and an apex above both ends. Length-derived rules and the closed-Wall
 * rule live in {@link wallTopIssues}.
 */
export function wallTopShapeIssues(top: LayoutWallTop): WallTopIssue[] {
	if (top.kind === 'level') return [];
	const issues: WallTopIssue[] = [];
	const ends = [top.startRise, top.endRise];
	for (const [index, rise] of ends.entries()) {
		if (!Number.isFinite(rise)) {
			issues.push({
				code: WALL_TOP_RISE_INVALID_CODE,
				message: `Wall top end rise ${index} must be finite`,
			});
		} else if (rise < 0) {
			issues.push({
				code: WALL_TOP_RISE_INVALID_CODE,
				message: 'Wall top rises must be greater than or equal to zero',
			});
		}
	}
	if (issues.length > 0) return issues;
	const lowest = Math.min(top.startRise, top.endRise);
	if (lowest !== 0) {
		issues.push({
			code: WALL_TOP_RISE_INVALID_CODE,
			message:
				'The lowest Wall top end rise must be exactly 0; height is the lowest point of the top',
		});
	}
	const highestEnd = Math.max(top.startRise, top.endRise);
	if (top.kind === 'slope' && highestEnd <= WALL_HEIGHT_EPSILON) {
		issues.push({
			code: WALL_TOP_RISE_INVALID_CODE,
			message: 'A sloped Wall top needs one end rise greater than zero',
		});
	}
	if (top.kind === 'gable') {
		if (!Number.isFinite(top.apexRise)) {
			issues.push({
				code: WALL_TOP_APEX_INVALID_CODE,
				message: 'Wall top apex rise must be finite',
			});
		} else if (top.apexRise <= highestEnd + WALL_HEIGHT_EPSILON) {
			issues.push({
				code: WALL_TOP_APEX_INVALID_CODE,
				message: 'Wall top apex rise must exceed both end rises',
			});
		}
		if (!Number.isFinite(top.apexOffset) || top.apexOffset <= 0) {
			issues.push({
				code: WALL_TOP_APEX_INVALID_CODE,
				message: 'Wall top apex offset must be finite and greater than zero',
			});
		}
	}
	return issues;
}

/**
 * Every Wall-top issue that does not need the derived centerline length
 * (P1–P2, P3 values, P5, P6). The codec refuses a payload with any of these.
 */
export function wallTopSourceIssues(
	wall: Pick<LayoutWall, 'id' | 'height' | 'top' | 'startJunctionId' | 'endJunctionId'>,
): WallTopIssue[] {
	const issues: WallTopIssue[] = [...wallTopShapeIssues(wall.top)];
	if (wallIsClosed(wall) && wall.top.kind !== 'level') {
		issues.push({
			code: CLOSED_WALL_LEVEL_ONLY_CODE,
			message: `Closed Wall '${wall.id}' must have a level top`,
		});
	}
	const peak = wall.height + wallTopMaxRise(wall.top);
	if (peak > MAX_LAYOUT_DIMENSION_METERS + WALL_TOP_STATION_EPSILON) {
		issues.push({
			code: 'dimension_out_of_range',
			message: `Wall '${wall.id}' top is limited to ${MAX_LAYOUT_DIMENSION_METERS} m`,
		});
	}
	return issues;
}

/**
 * Every Wall-top issue for one Wall at its compiled length (P1–P6), with the
 * document path of the offending field. The compiler owns the apex-versus-length
 * rule because the length is derived from the centerline.
 */
export function wallTopIssues(
	wall: Pick<LayoutWall, 'id' | 'height' | 'top' | 'startJunctionId' | 'endJunctionId'>,
	length: number,
	path = '$',
): Array<WallTopIssue & { path: string }> {
	const issues = [...wallTopSourceIssues(wall)];
	if (wall.top.kind === 'gable' && Number.isFinite(length)) {
		const apex = wall.top.apexOffset;
		if (apex <= WALL_TOP_STATION_EPSILON || apex >= length - WALL_TOP_STATION_EPSILON) {
			issues.push({
				code: WALL_TOP_APEX_OUTSIDE_CODE,
				message: `Wall '${wall.id}' apex must lie inside the Wall (0 < ${apex} < ${length} m)`,
			});
		}
	}
	return issues.map((issue) => ({ ...issue, path: `${path}.top` }));
}

/** Ordered breakpoints of one top over its canonical length. */
export function wallTopBreakpoints(top: LayoutWallTop, length: number): WallTopBreakpoint[] {
	switch (top.kind) {
		case 'level':
			return [
				{ distance: 0, rise: 0 },
				{ distance: length, rise: 0 },
			];
		case 'slope':
			return [
				{ distance: 0, rise: top.startRise },
				{ distance: length, rise: top.endRise },
			];
		case 'gable':
			return [
				{ distance: 0, rise: top.startRise },
				{ distance: top.apexOffset, rise: top.apexRise },
				{ distance: length, rise: top.endRise },
			];
	}
}

/** Rise above `height` at one station, clamped to the Wall's own extent. */
export function wallTopRiseAt(top: LayoutWallTop, station: number, length: number): number {
	if (top.kind === 'level') return 0;
	const s = Math.min(length, Math.max(0, station));
	if (top.kind === 'slope') {
		if (!(length > 0)) return top.startRise;
		// Every breakpoint returns its authored rise, so both Walls at a corner read
		// exactly their own end heights and a fragment keeps its parent's end rise.
		if (s === length) return top.endRise;
		return top.startRise + ((top.endRise - top.startRise) * s) / length;
	}
	const apex = Math.min(length, Math.max(0, top.apexOffset));
	if (s === apex) return top.apexRise;
	if (s <= apex) {
		return apex > 0 ? top.startRise + ((top.apexRise - top.startRise) * s) / apex : top.apexRise;
	}
	return length > apex
		? top.endRise + ((top.apexRise - top.endRise) * (length - s)) / (length - apex)
		: top.apexRise;
}

/** Wall-local top (`height + rise`) at one station. */
export function wallTopAt(
	wall: Pick<LayoutWall, 'height' | 'top'>,
	station: number,
	length: number,
): number {
	return wall.height + wallTopRiseAt(wall.top, station, length);
}

/** Minimum and maximum Wall-local top over `[a, b]`; breakpoints are the extrema. */
export function wallTopRange(
	wall: Pick<LayoutWall, 'height' | 'top'>,
	a: number,
	b: number,
	length: number,
): { min: number; max: number } {
	const from = Math.min(a, b);
	const to = Math.max(a, b);
	let min = Infinity;
	let max = -Infinity;
	const consider = (station: number): void => {
		const top = wallTopAt(wall, station, length);
		if (top < min) min = top;
		if (top > max) max = top;
	};
	consider(from);
	consider(to);
	if (wall.top.kind === 'gable') {
		const apex = wall.top.apexOffset;
		if (apex > from && apex < to) consider(apex);
	}
	if (!Number.isFinite(min) || !Number.isFinite(max)) {
		const top = wallTopAt(wall, from, length);
		return { min: top, max: top };
	}
	return { min, max };
}

/**
 * Re-base a top so its lowest end rise is exactly `0`, moving that rise into
 * `height` (P1).
 *
 * This is the one normalisation every writer shares: a caller may state both
 * ends above the eave (for example a top measured from a neighbour), and the
 * canonical encoding is recovered by lowering `height` to the lowest end. The
 * caller owns value validity; a non-finite or negative rise is refused before
 * this runs.
 */
export function normalizeWallTop(height: number, top: LayoutWallTop): WallTopSlice {
	if (top.kind === 'level') return { height, top: { kind: 'level' } };
	const lowest = Math.min(top.startRise, top.endRise);
	const base = height + lowest;
	if (top.kind === 'slope') {
		return {
			height: base,
			top: {
				kind: 'slope',
				startRise: top.startRise - lowest,
				endRise: top.endRise - lowest,
			},
		};
	}
	return {
		height: base,
		top: {
			kind: 'gable',
			startRise: top.startRise - lowest,
			endRise: top.endRise - lowest,
			apexRise: top.apexRise - lowest,
			apexOffset: top.apexOffset,
		},
	};
}

/**
 * The exact top of the sub-interval `[from, to]` of one Wall, re-based to its
 * own lowest end (P1).
 *
 * The parent's rise is linear in station, so a slice contains at most one
 * breakpoint: the apex. A slice through the apex is a gable; a slice on one side
 * of it is a slope; a level parent stays level. Rises are taken in the parent's
 * rise frame and only the re-basing rise is subtracted, so a fragment that keeps
 * the parent's lowest end keeps its authored rise numbers exactly.
 *
 * A slice end within the station tolerance of the apex takes the authored peak
 * rise. Other endpoints match the parent top within floating-point rounding.
 * When the resulting rise or apex falls outside the P2/P3 tolerances, the split
 * refuses atomically ({@link WALL_TOP_SPLIT_DEGENERATE_CODE}).
 */
export function sliceWallTop(
	wall: Pick<LayoutWall, 'height' | 'top'>,
	from: number,
	to: number,
	length: number,
): WallTopSlice {
	const start = Math.min(from, to);
	const end = Math.max(from, to);
	// One station rule, the P3 station tolerance: an apex within it of a slice end
	// IS that end (the rise there is the authored apex rise and the fragment is a
	// slope); an apex further inside is the fragment's own apex. Both tests read
	// the same two differences, so exactly one holds for an apex on the slice.
	const gable = wall.top.kind === 'gable' ? wall.top : null;
	const riseAt = (station: number): number =>
		gable !== null && Math.abs(gable.apexOffset - station) <= WALL_TOP_STATION_EPSILON
			? gable.apexRise
			: wallTopRiseAt(wall.top, station, length);
	const startRise = riseAt(start);
	const endRiseAtEnd = riseAt(end);
	const lowest = Math.min(startRise, endRiseAtEnd);
	const height = wall.height + lowest;
	const startOut = startRise - lowest;
	const endOut = endRiseAtEnd - lowest;
	if (
		gable !== null &&
		gable.apexOffset - start > WALL_TOP_STATION_EPSILON &&
		end - gable.apexOffset > WALL_TOP_STATION_EPSILON
	) {
		return {
			height,
			top: {
				kind: 'gable',
				startRise: startOut,
				endRise: endOut,
				apexRise: gable.apexRise - lowest,
				apexOffset: gable.apexOffset - start,
			},
		};
	}
	if (startOut === 0 && endOut === 0) return { height, top: { kind: 'level' } };
	return { height, top: { kind: 'slope', startRise: startOut, endRise: endOut } };
}

/**
 * The same top read against the opposite Wall orientation.
 *
 * Joining may traverse one side in reverse; that side's rise and apex offset are
 * mirrored in its own length, exactly as an Opening offset is mirrored.
 */
export function reverseWallTop(top: LayoutWallTop, length: number): LayoutWallTop {
	if (top.kind === 'level') return { kind: 'level' };
	if (top.kind === 'slope') {
		return { kind: 'slope', startRise: top.endRise, endRise: top.startRise };
	}
	return {
		kind: 'gable',
		startRise: top.endRise,
		endRise: top.startRise,
		apexRise: top.apexRise,
		apexOffset: length - top.apexOffset,
	};
}

/** An end rise of a shape, without evaluating its station. */
function endRise(top: LayoutWallTop, atEnd: boolean): number {
	if (top.kind === 'level') return 0;
	return atEnd ? top.endRise : top.startRise;
}

/** Top of a straight join line between two absolute samples at two stations. */
function lineTop(
	fromStation: number,
	fromTop: number,
	toStation: number,
	toTop: number,
	at: number,
): number {
	const span = toStation - fromStation;
	if (!(span > 0)) return toTop;
	return fromTop + ((toTop - fromTop) * (at - fromStation)) / span;
}

/**
 * The one top that two Walls meeting at a joint can become, or `null`.
 *
 * `first` starts at the joined Wall's canonical start; `second` ends at its
 * canonical end. The joint is continuous within {@link WALL_HEIGHT_EPSILON}, and
 * the merged rise is linear in station, so it is a level, a slope, or a gable
 * whose one peak is either an original apex or the joint itself. Anything else —
 * a valley, a kink away from the peak, two peaks, or a near-flat step that is
 * neither level nor a slope — has no encoding and refuses.
 *
 * The `height`/rise conversion keeps a fragment's authored numbers whenever that
 * fragment owns the merged lowest end. Split followed by Join encodes the same
 * geometry deterministically within the height tolerance and apex station snap.
 * Undo and Redo restore the captured bytes.
 */
export function mergeWallTops(
	first: WallTopJoinPart,
	second: WallTopJoinPart,
): WallTopSlice | null {
	const total = first.length + second.length;
	if (!(total > 0)) return null;
	const startTop = wallTopAt(first, 0, first.length);
	const jointFirst = wallTopAt(first, first.length, first.length);
	const jointSecond = wallTopAt(second, 0, second.length);
	const endTop = wallTopAt(second, second.length, second.length);
	if (![startTop, jointFirst, jointSecond, endTop].every(Number.isFinite)) return null;
	if (Math.abs(jointFirst - jointSecond) > WALL_HEIGHT_EPSILON) return null;
	const jointTop = jointFirst;
	const base = Math.min(startTop, endTop);
	const startRise = first.height === base ? endRise(first.top, false) : startTop - base;
	const endRiseOut = second.height === base ? endRise(second.top, true) : endTop - base;
	const firstApex =
		first.top.kind === 'gable'
			? {
					station: first.top.apexOffset,
					top: first.height + first.top.apexRise,
					authored: first.top.apexRise,
					height: first.height,
				}
			: null;
	const secondApex =
		second.top.kind === 'gable'
			? {
					station: first.length + second.top.apexOffset,
					top: second.height + second.top.apexRise,
					authored: second.top.apexRise,
					height: second.height,
				}
			: null;
	if (firstApex && secondApex) return null;
	const apex = firstApex ?? secondApex;
	if (apex) {
		if (!(apex.top > startTop + WALL_HEIGHT_EPSILON)) return null;
		if (!(apex.top > endTop + WALL_HEIGHT_EPSILON)) return null;
		// The joint must lie on the straight run from the apex to the far end on
		// the other side; otherwise the merged rise has a second kink.
		const jointOnLine =
			firstApex !== null
				? lineTop(apex.station, apex.top, total, endTop, first.length)
				: lineTop(0, startTop, apex.station, apex.top, first.length);
		if (Math.abs(jointTop - jointOnLine) > WALL_HEIGHT_EPSILON) return null;
		return {
			height: base,
			top: {
				kind: 'gable',
				startRise,
				endRise: endRiseOut,
				apexRise: apex.height === base ? apex.authored : apex.top - base,
				apexOffset: apex.station,
			},
		};
	}
	if (startTop === jointTop && jointTop === endTop) {
		return { height: startTop, top: { kind: 'level' } };
	}
	const onLine = total > 0 ? lineTop(0, startTop, total, endTop, first.length) : startTop;
	if (Math.abs(jointTop - onLine) <= WALL_HEIGHT_EPSILON) {
		if (!(Math.abs(endTop - startTop) > WALL_HEIGHT_EPSILON)) return null;
		return { height: base, top: { kind: 'slope', startRise, endRise: endRiseOut } };
	}
	// The joint is the one peak.
	if (!(jointTop > startTop + WALL_HEIGHT_EPSILON)) return null;
	if (!(jointTop > endTop + WALL_HEIGHT_EPSILON)) return null;
	// Preserve the authored rise when it evaluates to the joint height we validated.
	const jointRise =
		first.height === base
			? endRise(first.top, true)
			: second.height === base && jointSecond === jointTop
				? endRise(second.top, false)
				: jointTop - base;
	return {
		height: base,
		top: {
			kind: 'gable',
			startRise,
			endRise: endRiseOut,
			apexRise: jointRise,
			apexOffset: first.length,
		},
	};
}

/**
 * The compiled profile of one Wall, or `undefined` for a level top.
 *
 * `topY` is above the Floor datum, the same frame as `CompiledWallSection.topY`
 * and `CompiledJunctionLeg.topY`.
 */
export function compiledWallTopProfile(
	wall: Pick<LayoutWall, 'height' | 'top'>,
	length: number,
): WallTopProfile | undefined {
	if (wall.top.kind === 'level') return undefined;
	return wallTopBreakpoints(wall.top, length).map((point) => ({
		distance: point.distance,
		topY: wall.height + point.rise,
	}));
}

/** Wall-local top at one station from a compiled profile. */
export function compiledWallTopAt(profile: WallTopProfile, station: number): number {
	if (profile.length === 0) return 0;
	const first = profile[0]!;
	if (station <= first.distance) return first.topY;
	for (let index = 1; index < profile.length; index += 1) {
		const previous = profile[index - 1]!;
		const current = profile[index]!;
		if (station <= current.distance) {
			const span = current.distance - previous.distance;
			if (!(span > 0) || station === current.distance) return current.topY;
			const amount = (station - previous.distance) / span;
			return previous.topY + (current.topY - previous.topY) * amount;
		}
	}
	return profile.at(-1)!.topY;
}

/**
 * Lowest and highest compiled top over `[from, to]` (any order, clamped to the
 * Wall). The maximum includes a gable apex that lies inside the interval.
 */
export function compiledWallTopRange(
	profile: WallTopProfile,
	from: number,
	to: number,
): { min: number; max: number } {
	const low = Math.min(from, to);
	const high = Math.max(from, to);
	let min = Infinity;
	let max = -Infinity;
	const read = (station: number): void => {
		const top = compiledWallTopAt(profile, station);
		if (top < min) min = top;
		if (top > max) max = top;
	};
	read(low);
	read(high);
	for (const point of profile)
		if (point.distance > low && point.distance < high) read(point.distance);
	return { min, max };
}

/** Highest point of a compiled top profile. */
export function compiledWallTopPeak(profile: WallTopProfile, height: number): number {
	let peak = height;
	for (const point of profile) if (point.topY > peak) peak = point.topY;
	return peak;
}

/** The Wall-local top at one of a compiled Wall's ends. */
export function compiledWallEndTop(
	profile: WallTopProfile | undefined,
	height: number,
	atEnd: boolean,
	length: number,
): number {
	if (!profile) return height;
	return compiledWallTopAt(profile, atEnd ? length : 0);
}

/** Stations where a compiled profile changes slope, for mesh clipping. */
export function compiledWallTopKnots(profile: WallTopProfile | undefined): number[] {
	if (!profile) return [];
	return profile.slice(1, -1).map((point) => point.distance);
}
