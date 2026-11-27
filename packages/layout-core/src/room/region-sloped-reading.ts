/**
 * `region-sloped-reading.ts` — the vertical relation of one Wall under a shed or
 * gable Region (§7.3), read from the shared form evaluator.
 *
 * The flat reading compares a Wall's top with the slab's two levels. A sloped
 * underside has no single level, so this reads the three quantities of §7.3 over
 * the covered stations of the compiled Wall body:
 *
 * ```text
 * gap     = max over covered points p of (underside(p) - wallTopY(p))
 * overrun = max over covered points p of (wallTopY(p) - top(p))
 * ```
 *
 * The body is read on its centerline and both offset faces, at the points the
 * footprint covers (an edge Wall's outer face is not under the roof). Between two knots
 * — covered-interval ends, compiled sample stations, Wall-top profile breaks and
 * every ridge and footprint-boundary crossing of the three lines — each line is straight, the top is
 * linear in station and the underside is affine on one side of the ridge, so both
 * differences are linear and their extrema lie on the knots. That is exact for
 * the compiled sample polylines the Wall mesh is built from; V3b's certified
 * strip extrema (mitred ends, the true curve between samples) refine it.
 */
import type { LayoutVec2 } from '../geometry/coordinates';
import type { CompiledPhysicalWall, CompiledRegion } from '../geometry/types';
import { compiledWallTopAt } from '../wall/wall-top';
import {
	regionFormProfile,
	regionFormQ,
	regionUndersideAt,
	type RegionFormFacts,
} from './region/form';
import { pointStrictlyInsidePolygon } from '../geometry/face-extraction';
import { pointNearBoundary, type RegionWallStationInterval } from './region-wall-coverage';

/** A body point counts as covered inside the footprint or on its boundary. */
const COVERED_BOUNDARY_METERS = 1e-6;

export type SlopedRegionWallReading = {
	/** Largest underside-above-top clearance; positive is a gap. */
	readonly gap: number;
	/** Largest top-above-roof-top excess; positive means the Wall pokes through. */
	readonly overrun: number;
	/** Where `gap` is read, for the vertical cue. */
	readonly gapPoint: LayoutVec2;
	readonly gapWallTopY: number;
	readonly gapUndersideY: number;
};

type Line = readonly { readonly point: LayoutVec2; readonly station: number }[];

function pointOnLine(line: Line, station: number): LayoutVec2 {
	const last = line[line.length - 1]!;
	if (station >= last.station) return last.point;
	for (let index = 1; index < line.length; index++) {
		const from = line[index - 1]!;
		const to = line[index]!;
		if (station > to.station) continue;
		const span = to.station - from.station;
		const t = span <= 0 ? 0 : (station - from.station) / span;
		return [
			from.point[0] + (to.point[0] - from.point[0]) * t,
			from.point[1] + (to.point[1] - from.point[1]) * t,
		];
	}
	return line[0]!.point;
}

/** Parameter along `p0→p1` where it crosses segment `a→b`, or `null`. */
function segmentParameter(
	p0: LayoutVec2,
	p1: LayoutVec2,
	a: LayoutVec2,
	b: LayoutVec2,
): number | null {
	const r: LayoutVec2 = [p1[0] - p0[0], p1[1] - p0[1]];
	const s: LayoutVec2 = [b[0] - a[0], b[1] - a[1]];
	const denominator = r[0] * s[1] - r[1] * s[0];
	if (denominator === 0) return null;
	const d: LayoutVec2 = [a[0] - p0[0], a[1] - p0[1]];
	const t = (d[0] * s[1] - d[1] * s[0]) / denominator;
	const u = (d[0] * r[1] - d[1] * r[0]) / denominator;
	return t > 0 && t < 1 && u >= 0 && u <= 1 ? t : null;
}

function offsetLine(wall: Pick<CompiledPhysicalWall, 'samples'>, offset: number): Line {
	return wall.samples.map((sample) => ({
		point: [
			sample.point[0] + sample.normal[0] * offset,
			sample.point[1] + sample.normal[1] * offset,
		] as LayoutVec2,
		station: sample.distance,
	}));
}

/**
 * The vertical reading of one Wall under a non-flat Region, or `null` for a
 * flat Region (the caller keeps the flat rule) or an unusable profile.
 */
export function slopedRegionWallReading(
	region: Pick<
		CompiledRegion,
		'role' | 'form' | 'footprint' | 'datumY' | 'thickness' | 'bottomY' | 'topY'
	>,
	wall: Pick<CompiledPhysicalWall, 'samples' | 'thickness' | 'height' | 'topProfile'>,
	floorElevation: number,
	intervals: readonly RegionWallStationInterval[],
): SlopedRegionWallReading | null {
	const form = region.form ?? { kind: 'flat' };
	if (form.kind === 'flat' || wall.samples.length < 2 || intervals.length === 0) return null;
	const profile = regionFormProfile(form, region.footprint);
	if (profile === null) return null;
	const thickness = region.thickness ?? region.topY - region.bottomY;
	const facts: RegionFormFacts = {
		role: region.role,
		form,
		footprint: region.footprint,
		datumY: region.datumY ?? region.bottomY,
		thickness,
	};
	const lines: Line[] = [
		offsetLine(wall, 0),
		offsetLine(wall, wall.thickness / 2),
		offsetLine(wall, -wall.thickness / 2),
	];
	const knots: number[] = [];
	for (const sample of wall.samples) knots.push(sample.distance);
	for (const point of wall.topProfile ?? []) knots.push(point.distance);
	if (form.kind === 'gable') {
		for (const line of lines) {
			for (let index = 1; index < line.length; index++) {
				const from = line[index - 1]!;
				const to = line[index]!;
				const a = regionFormQ(profile.azimuth, from.point) - profile.qRidge;
				const b = regionFormQ(profile.azimuth, to.point) - profile.qRidge;
				if ((a < 0 && b > 0) || (a > 0 && b < 0)) {
					knots.push(from.station + ((to.station - from.station) * a) / (a - b));
				}
			}
		}
	}
	// Where a line enters or leaves the footprint, its covered extent changes.
	for (const line of lines) {
		for (let index = 1; index < line.length; index++) {
			const from = line[index - 1]!;
			const to = line[index]!;
			for (let edge = 0; edge < region.footprint.length; edge++) {
				const a = region.footprint[edge]!;
				const b = region.footprint[(edge + 1) % region.footprint.length]!;
				const t = segmentParameter(from.point, to.point, a, b);
				if (t !== null) knots.push(from.station + (to.station - from.station) * t);
			}
		}
	}
	const covered = (point: LayoutVec2): boolean =>
		pointStrictlyInsidePolygon(region.footprint, point) ||
		pointNearBoundary(region.footprint, point, COVERED_BOUNDARY_METERS);
	const topAt = (station: number): number =>
		floorElevation +
		(wall.topProfile && wall.topProfile.length > 0
			? compiledWallTopAt(wall.topProfile, station)
			: wall.height);

	let gap = -Infinity;
	let overrun = -Infinity;
	let gapPoint: LayoutVec2 = lines[0]![0]!.point;
	let gapWallTopY = 0;
	let gapUndersideY = 0;
	for (const [from, to] of intervals) {
		const stations = [from, to, ...knots.filter((knot) => knot > from && knot < to)];
		for (const station of stations) {
			const wallTop = topAt(station);
			for (const line of lines) {
				const point = pointOnLine(line, station);
				if (!covered(point)) continue;
				const underside = regionUndersideAt(facts, point);
				const clearance = underside - wallTop;
				if (clearance > gap) {
					gap = clearance;
					gapPoint = point;
					gapWallTopY = wallTop;
					gapUndersideY = underside;
				}
				overrun = Math.max(overrun, wallTop - (underside + thickness));
			}
		}
	}
	if (!Number.isFinite(gap) || !Number.isFinite(overrun)) return null;
	return { gap, overrun, gapPoint, gapWallTopY, gapUndersideY };
}
