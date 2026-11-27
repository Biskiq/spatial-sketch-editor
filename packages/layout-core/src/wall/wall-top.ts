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
		return top.startRise + ((top.endRise - top.startRise) * s) / length;
	}
	const apex = Math.min(length, Math.max(0, top.apexOffset));
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
			if (!(span > 0)) return current.topY;
			const amount = (station - previous.distance) / span;
			return previous.topY + (current.topY - previous.topY) * amount;
		}
	}
	return profile.at(-1)!.topY;
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
