/**
 * Station coverage: which centerline stations of one compiled Wall a region
 * footprint actually covers, and the Wall top read over exactly those stations.
 *
 * A concave footprint can cover separated stretches of one Wall. Each covered
 * interval is read on its own; their continuous hull is never read, so a gable
 * apex lying between two covered stretches (outside the footprint) never sets
 * the reading or the roof fit.
 */
import type { LayoutVec2 } from '../geometry/coordinates';
import { pointStrictlyInsidePolygon } from '../geometry/face-extraction';
import type { CompiledPhysicalWall } from '../geometry/types';
import { compiledWallTopRange } from '../wall/wall-top';

/** A closed centerline station interval, `from <= to`. */
export type RegionWallStationInterval = readonly [from: number, to: number];

export type ProjectedPoint = { point: LayoutVec2; station: number };

/** Mirrors `RegionWallPlanClass`; declared here so coverage never imports relations. */
type CoveragePlanClass = 'through' | 'edge' | 'near' | 'none';

const STATION_EPSILON = 1e-9;

/**
 * The one Wall-top evaluator region relations and fits read over one interval.
 *
 * A level Wall has the same top at every station. A profiled Wall reads its
 * compiled top profile over `[fromStation, toStation]` (clamped to the Wall, any
 * order), and the maximum includes a gable apex that lies inside the interval.
 * Omitting both stations reads the whole Wall.
 */
export function regionWallTopRangeY(
	wall: Pick<CompiledPhysicalWall, 'height' | 'topProfile'>,
	floorElevation: number,
	fromStation = 0,
	toStation = Infinity,
): { minY: number; maxY: number } {
	const profile = wall.topProfile;
	if (profile === undefined || profile.length === 0) {
		const topY = floorElevation + wall.height;
		return { minY: topY, maxY: topY };
	}
	const range = compiledWallTopRange(profile, fromStation, toStation);
	return { minY: floorElevation + range.min, maxY: floorElevation + range.max };
}

/** Lowest and highest top over every covered interval, each read on its own. */
export function regionWallTopOverStations(
	wall: Pick<CompiledPhysicalWall, 'height' | 'topProfile'>,
	floorElevation: number,
	intervals: readonly RegionWallStationInterval[],
): { minY: number; maxY: number } {
	if (intervals.length === 0) return regionWallTopRangeY(wall, floorElevation);
	let minY = Infinity;
	let maxY = -Infinity;
	for (const [from, to] of intervals) {
		const range = regionWallTopRangeY(wall, floorElevation, from, to);
		minY = Math.min(minY, range.minY);
		maxY = Math.max(maxY, range.maxY);
	}
	return { minY, maxY };
}

/**
 * The disjoint station intervals a footprint covers on one Wall.
 *
 * - `through`: every interval over which both faces lie strictly inside.
 * - `edge`: every interval over which either face lies inside or on the
 *   footprint (a boundary running along a face covers that whole run). A
 *   footprint lying inside the body strip covers the stations of its vertices.
 * - Otherwise, or when nothing above applies, the station of `contact` (the
 *   nearest Wall-body point), else the whole Wall.
 */
export function regionWallCoveredStations(
	footprint: readonly LayoutVec2[],
	wall: Pick<CompiledPhysicalWall, 'samples' | 'thickness' | 'length'>,
	left: readonly ProjectedPoint[],
	right: readonly ProjectedPoint[],
	planClass: CoveragePlanClass,
	contact: LayoutVec2 | null,
): RegionWallStationInterval[] {
	if (planClass === 'through') {
		const common = commonIntervals(
			insideIntervals(footprint, left),
			insideIntervals(footprint, right),
		);
		if (common.length > 0) return common;
	} else if (planClass === 'edge') {
		const touched = [
			...insideIntervals(footprint, left, true),
			...insideIntervals(footprint, right, true),
		];
		const inStrip = footprint
			.filter(
				(point) => distanceToSamples(point, wall.samples) <= wall.thickness / 2 + STATION_EPSILON,
			)
			.map((point) => stationOfPoint(wall.samples, point));
		if (touched.length > 0) {
			return mergeIntervals([...touched, ...inStrip.map((s): [number, number] => [s, s])]);
		}
		if (inStrip.length > 0) return [[Math.min(...inStrip), Math.max(...inStrip)]];
	}
	if (contact !== null) {
		const station = stationOfPoint(wall.samples, contact);
		return [[station, station]];
	}
	return [[0, wall.length]];
}

export function facePolyline(
	wall: Pick<CompiledPhysicalWall, 'samples' | 'thickness'>,
	offset: number,
): ProjectedPoint[] {
	return wall.samples.map((sample) => ({
		point: [
			sample.point[0] + sample.normal[0] * offset,
			sample.point[1] + sample.normal[1] * offset,
		] as LayoutVec2,
		station: sample.distance,
	}));
}

/**
 * Merged station intervals over which `face` lies strictly inside the footprint,
 * or inside or on its boundary when `closed`.
 */
export function insideIntervals(
	footprint: readonly LayoutVec2[],
	face: readonly ProjectedPoint[],
	closed = false,
): Array<[number, number]> {
	const intervals: Array<[number, number]> = [];
	for (let index = 0; index + 1 < face.length; index++) {
		const start = face[index]!;
		const end = face[index + 1]!;
		const splits = [0, 1];
		for (let edge = 0; edge < footprint.length; edge++) {
			const a = footprint[edge]!;
			const b = footprint[(edge + 1) % footprint.length]!;
			splits.push(...segmentParameters(start.point, end.point, a, b));
		}
		splits.sort((left, right) => left - right);
		for (let split = 0; split + 1 < splits.length; split++) {
			const t0 = Math.max(0, splits[split]!);
			const t1 = Math.min(1, splits[split + 1]!);
			if (t1 - t0 <= 1e-12) continue;
			const midT = (t0 + t1) / 2;
			const midpoint: LayoutVec2 = [
				start.point[0] + (end.point[0] - start.point[0]) * midT,
				start.point[1] + (end.point[1] - start.point[1]) * midT,
			];
			const onBoundary = pointNearBoundary(footprint, midpoint, STATION_EPSILON);
			const inside = closed
				? onBoundary || pointStrictlyInsidePolygon(footprint, midpoint)
				: !onBoundary && pointStrictlyInsidePolygon(footprint, midpoint);
			if (!inside) continue;
			const s0 = start.station + (end.station - start.station) * t0;
			const s1 = start.station + (end.station - start.station) * t1;
			intervals.push([Math.min(s0, s1), Math.max(s0, s1)]);
		}
	}
	return mergeIntervals(intervals);
}

function mergeIntervals(intervals: Array<[number, number]>): Array<[number, number]> {
	intervals.sort((left, right) => left[0] - right[0] || left[1] - right[1]);
	const merged: Array<[number, number]> = [];
	for (const interval of intervals) {
		const previous = merged.at(-1);
		if (previous !== undefined && interval[0] <= previous[1] + STATION_EPSILON) {
			previous[1] = Math.max(previous[1], interval[1]);
		} else {
			merged.push([interval[0], interval[1]]);
		}
	}
	return merged;
}

/** Pairwise intersections of two merged interval lists, positive length only. */
function commonIntervals(
	left: readonly [number, number][],
	right: readonly [number, number][],
): Array<[number, number]> {
	const common: Array<[number, number]> = [];
	for (const [a0, a1] of left) {
		for (const [b0, b1] of right) {
			const start = Math.max(a0, b0);
			const end = Math.min(a1, b1);
			if (end - start > STATION_EPSILON) common.push([start, end]);
		}
	}
	return mergeIntervals(common);
}

/** Centerline station of the sampled point nearest to `point`. */
function stationOfPoint(samples: CompiledPhysicalWall['samples'], point: LayoutVec2): number {
	let best = Infinity;
	let station = 0;
	for (let index = 0; index + 1 < samples.length; index++) {
		const a = samples[index]!;
		const b = samples[index + 1]!;
		const projected = projectPointOnSegment(point, a.point, b.point);
		const distance = distanceBetween(point, projected);
		if (distance < best) {
			best = distance;
			const span = distanceBetween(a.point, b.point);
			const along = span > 0 ? distanceBetween(a.point, projected) / span : 0;
			station = a.distance + (b.distance - a.distance) * along;
		}
	}
	return station;
}

function distanceToSamples(point: LayoutVec2, samples: CompiledPhysicalWall['samples']): number {
	let nearest = Infinity;
	for (let index = 0; index + 1 < samples.length; index++) {
		nearest = Math.min(
			nearest,
			distancePointSegment(point, samples[index]!.point, samples[index + 1]!.point),
		);
	}
	return nearest;
}

export function segmentParameters(
	a: LayoutVec2,
	b: LayoutVec2,
	c: LayoutVec2,
	d: LayoutVec2,
): number[] {
	const r: LayoutVec2 = [b[0] - a[0], b[1] - a[1]];
	const s: LayoutVec2 = [d[0] - c[0], d[1] - c[1]];
	const denominator = cross(r, s);
	const difference: LayoutVec2 = [c[0] - a[0], c[1] - a[1]];
	if (Math.abs(denominator) <= 1e-12) {
		if (Math.abs(cross(difference, r)) > 1e-12) return [];
		const rr = r[0] * r[0] + r[1] * r[1];
		if (rr <= 0) return [];
		return [c, d]
			.map((point) => ((point[0] - a[0]) * r[0] + (point[1] - a[1]) * r[1]) / rr)
			.filter((t) => t > 0 && t < 1);
	}
	const t = cross(difference, s) / denominator;
	const u = cross(difference, r) / denominator;
	return t >= -1e-12 && t <= 1 + 1e-12 && u >= -1e-12 && u <= 1 + 1e-12
		? [Math.min(1, Math.max(0, t))]
		: [];
}

export function pointNearBoundary(
	footprint: readonly LayoutVec2[],
	point: LayoutVec2,
	tolerance: number,
): boolean {
	for (let index = 0; index < footprint.length; index++) {
		const a = footprint[index]!;
		const b = footprint[(index + 1) % footprint.length]!;
		if (distancePointSegment(point, a, b) <= tolerance) return true;
	}
	return false;
}

export function projectPointOnSegment(
	point: LayoutVec2,
	start: LayoutVec2,
	end: LayoutVec2,
): LayoutVec2 {
	const dx = end[0] - start[0];
	const dz = end[1] - start[1];
	const squared = dx * dx + dz * dz;
	if (!(squared > 0)) return [start[0], start[1]];
	const t = Math.min(
		1,
		Math.max(0, ((point[0] - start[0]) * dx + (point[1] - start[1]) * dz) / squared),
	);
	return [start[0] + dx * t, start[1] + dz * t];
}

export function distanceBetween(a: LayoutVec2, b: LayoutVec2): number {
	return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

export function distancePointSegment(
	point: LayoutVec2,
	start: LayoutVec2,
	end: LayoutVec2,
): number {
	return distanceBetween(point, projectPointOnSegment(point, start, end));
}

export function cross(left: LayoutVec2, right: LayoutVec2): number {
	return left[0] * right[1] - left[1] * right[0];
}
