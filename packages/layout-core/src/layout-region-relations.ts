/**
 * `layout-region-relations.ts` — the derived Wall relations of one region and
 * the Wall-top evaluator seam every region fit reads.
 *
 * A relation is a pure function of compiled output, computed on demand for one
 * region. It is never stored, never compiled per edit and never writes a
 * document. The only authored relation fact is the region's `intendedGaps` list.
 *
 * This module is V1's **flat** reading. Walls are level today, so the evaluator
 * seam below returns one world top for any station; V2 replaces that body with
 * `wallTopAt`/`wallTopRange` from `layout-wall-top.ts` and no caller changes.
 */
import type { LayoutVec2 } from './layout-coordinates';
import { pointStrictlyInsidePolygon } from './layout-face-extraction';
import type {
	CompiledLayoutGeometry,
	CompiledPhysicalWall,
	CompiledRegion
} from './layout-geometry-types';
import type { LayoutRegion } from './layout-wall-first-types';

/** The support query's coplanar tolerance, shared by every relation comparison. */
export const REGION_WALL_RELATION_EPSILON = 1e-6;

/** The named plan reach at which a Wall still reads as related to a region. */
export const REGION_WALL_RELATION_REACH_METERS = 1;

export type RegionWallPlanClass = 'through' | 'edge' | 'near' | 'none';
export type RegionWallReading = 'gap' | 'meets' | 'crosses';

export type RegionWallPlanReading = {
	planClass: RegionWallPlanClass;
	/** Distance from the footprint boundary to the Wall body strip, in metres. */
	distanceMeters: number;
};

/**
 * The one Wall-top evaluator region relations and fits read.
 *
 * V1 Walls are level, so every station has the same top. `fromStation` and
 * `toStation` are accepted now so V2's profiled evaluator can replace this body
 * without changing a caller.
 */
export function regionWallTopRangeY(
	wall: Pick<CompiledPhysicalWall, 'height'>,
	floorElevation: number,
	_fromStation = 0,
	_toStation = 0
): { minY: number; maxY: number } {
	const topY = floorElevation + wall.height;
	return { minY: topY, maxY: topY };
}

export type RegionWallRelation = {
	readonly wallId: string;
	readonly planClass: Exclude<RegionWallPlanClass, 'none'>;
	readonly reading: RegionWallReading;
	/** The gap size in metres; `null` unless the reading is a gap. */
	readonly measureMeters: number | null;
	/** Which dimension a gap measures; `null` unless the reading is a gap. */
	readonly measureAxis: 'vertical' | 'horizontal' | null;
	/** True when the authored region marks this Wall's gap as intended. */
	readonly intended: boolean;
	/** The one-shot fit this gap offers, or `null` (including every intended gap). */
	readonly fit: 'meet-wall' | 'fit-roof-to-walls' | null;
};

export type RegionWallRelationsResult =
	| {
			readonly kind: 'relations';
			readonly regionId: string;
			readonly slabBottomY: number;
			readonly slabTopY: number;
			readonly relations: readonly RegionWallRelation[];
	  }
	| {
			readonly kind: 'unavailable';
			readonly code: 'unknown-region' | 'missing-floor' | 'contradictory-region';
			readonly message: string;
	  };

/**
 * Plan class of one region against one compiled Wall body.
 *
 * `through` means both offset faces lie strictly inside the footprint over a
 * common station interval. `edge` means the footprint boundary touches or lies
 * inside the body strip. `near` means the boundary is within the named reach.
 */
export function regionWallPlanClass(
	footprint: readonly LayoutVec2[],
	wall: Pick<CompiledPhysicalWall, 'samples' | 'thickness' | 'startJunctionId' | 'endJunctionId'>
): RegionWallPlanReading {
	if (footprint.length < 3 || wall.samples.length < 2) {
		return { planClass: 'none', distanceMeters: Infinity };
	}
	const half = wall.thickness / 2;
	const left = facePolyline(wall, half);
	const right = facePolyline(wall, -half);
	if (intersectsCommonInterval(footprint, left, right)) {
		return { planClass: 'through', distanceMeters: 0 };
	}
	if (footprintWithinBodyStrip(footprint, wall, left, right, half)) {
		return { planClass: 'edge', distanceMeters: 0 };
	}
	const distance = bodyStripDistance(footprint, left, right, wall);
	if (distance <= REGION_WALL_RELATION_EPSILON) return { planClass: 'edge', distanceMeters: distance };
	if (distance <= REGION_WALL_RELATION_REACH_METERS) return { planClass: 'near', distanceMeters: distance };
	return { planClass: 'none', distanceMeters: distance };
}

/**
 * Every Wall relation of one region, ordered by Wall id (ordinal string order).
 * A gap the region marks intended still carries its measure and offers no fit.
 */
export function regionWallRelations(
	compiled: CompiledLayoutGeometry,
	region: LayoutRegion
): RegionWallRelationsResult {
	const compiledRegion = compiled.regions.find((candidate) => candidate.regionId === region.id);
	const floor = compiled.floors[0];
	if (compiledRegion === undefined) {
		return {
			kind: 'unavailable',
			code: 'unknown-region',
			message: `Region '${region.id}' is not part of this compiled Layout.`
		};
	}
	if (floor === undefined) {
		return {
			kind: 'unavailable',
			code: 'missing-floor',
			message: `Layout has no compiled Floor to read region '${region.id}' against.`
		};
	}
	if (compiledRegion.role !== region.role || compiledRegion.footprint.length < 3) {
		return {
			kind: 'unavailable',
			code: 'contradictory-region',
			message: `Region '${region.id}' has contradictory compiled facts.`
		};
	}

	const relations: RegionWallRelation[] = [];
	for (const wall of compiled.walls) {
		const plan = regionWallPlanClass(compiledRegion.footprint, wall);
		if (plan.planClass === 'none') continue;
		const reading = regionWallReading(
			plan,
			regionWallTopRangeY(wall, floor.elevation),
			compiledRegion,
			region.role
		);
		if (reading === null) continue;
		const intended = reading.reading === 'gap' && region.intendedGaps.includes(wall.wallId);
		relations.push({
			wallId: wall.wallId,
			planClass: plan.planClass,
			reading: reading.reading,
			measureMeters: reading.measureMeters,
			measureAxis: reading.measureAxis,
			intended,
			fit: intended ? null : reading.fit
		});
	}
	relations.sort((left, right) => (left.wallId < right.wallId ? -1 : left.wallId > right.wallId ? 1 : 0));
	return {
		kind: 'relations',
		regionId: region.id,
		slabBottomY: compiledRegion.bottomY,
		slabTopY: compiledRegion.topY,
		relations
	};
}

type Reading = {
	reading: RegionWallReading;
	measureMeters: number | null;
	measureAxis: 'vertical' | 'horizontal' | null;
	fit: 'meet-wall' | 'fit-roof-to-walls' | null;
};

function regionWallReading(
	plan: RegionWallPlanReading,
	top: { minY: number; maxY: number },
	region: Pick<CompiledRegion, 'bottomY' | 'topY'>,
	role: LayoutRegion['role']
): Reading | null {
	const slabBottom = region.bottomY;
	const slabTop = region.topY;
	const wallTop = top.maxY;
	if (plan.planClass === 'through' || plan.planClass === 'edge') {
		if (wallTop < slabBottom - REGION_WALL_RELATION_EPSILON) {
			return {
				reading: 'gap',
				measureMeters: slabBottom - wallTop,
				measureAxis: 'vertical',
				fit: role === 'overhead' ? 'fit-roof-to-walls' : null
			};
		}
		if (wallTop <= slabTop + REGION_WALL_RELATION_EPSILON) {
			return { reading: 'meets', measureMeters: null, measureAxis: null, fit: null };
		}
		return plan.planClass === 'through'
			? { reading: 'crosses', measureMeters: null, measureAxis: null, fit: null }
			: { reading: 'meets', measureMeters: null, measureAxis: null, fit: null };
	}
	if (wallTop < slabBottom - REGION_WALL_RELATION_EPSILON) return null;
	return {
		reading: 'gap',
		measureMeters: plan.distanceMeters,
		measureAxis: 'horizontal',
		fit: 'meet-wall'
	};
}

type ProjectedPoint = { point: LayoutVec2; station: number };

function facePolyline(
	wall: Pick<CompiledPhysicalWall, 'samples' | 'thickness'>,
	offset: number
): ProjectedPoint[] {
	return wall.samples.map((sample) => ({
		point: [
			sample.point[0] + sample.normal[0] * offset,
			sample.point[1] + sample.normal[1] * offset
		] as LayoutVec2,
		station: sample.distance
	}));
}

function intersectsCommonInterval(
	footprint: readonly LayoutVec2[],
	left: readonly ProjectedPoint[],
	right: readonly ProjectedPoint[]
): boolean {
	const leftIntervals = insideIntervals(footprint, left);
	if (leftIntervals.length === 0) return false;
	const rightIntervals = insideIntervals(footprint, right);
	for (const [a0, a1] of leftIntervals) {
		for (const [b0, b1] of rightIntervals) {
			if (Math.min(a1, b1) - Math.max(a0, b0) > 1e-9) return true;
		}
	}
	return false;
}

function insideIntervals(
	footprint: readonly LayoutVec2[],
	face: readonly ProjectedPoint[]
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
				start.point[1] + (end.point[1] - start.point[1]) * midT
			];
			if (!pointStrictlyInsidePolygon(footprint, midpoint)) continue;
			if (pointNearBoundary(footprint, midpoint, 1e-9)) continue;
			const s0 = start.station + (end.station - start.station) * t0;
			const s1 = start.station + (end.station - start.station) * t1;
			intervals.push([Math.min(s0, s1), Math.max(s0, s1)]);
		}
	}
	intervals.sort((left, right) => left[0] - right[0] || left[1] - right[1]);
	const merged: Array<[number, number]> = [];
	for (const interval of intervals) {
		const previous = merged.at(-1);
		if (previous !== undefined && interval[0] <= previous[1] + 1e-9) {
			previous[1] = Math.max(previous[1], interval[1]);
		} else {
			merged.push([interval[0], interval[1]]);
		}
	}
	return merged;
}

/**
 * True when the whole footprint lies inside or on the Wall body strip.
 *
 * Every vertex must sit within half the thickness of the centerline over the
 * Wall's own station span, and no footprint edge may leave the strip through a
 * face or an end cap. Without this a small footprint drawn wholly inside a thick
 * Wall measures its distance to the strip's outer boundary and reads `near`,
 * even though the Wall body contains it.
 */
function footprintWithinBodyStrip(
	footprint: readonly LayoutVec2[],
	wall: Pick<CompiledPhysicalWall, 'samples' | 'startJunctionId' | 'endJunctionId'>,
	left: readonly ProjectedPoint[],
	right: readonly ProjectedPoint[],
	half: number
): boolean {
	for (const point of footprint) {
		if (!pointWithinBodyStrip(point, wall, half)) return false;
	}
	const boundary: Array<[LayoutVec2, LayoutVec2]> = [];
	for (const face of [left, right]) {
		for (let index = 0; index + 1 < face.length; index++) {
			boundary.push([face[index]!.point, face[index + 1]!.point]);
		}
	}
	if (!isClosedWall(wall) && left.length > 0 && right.length > 0) {
		boundary.push([left[0]!.point, right[0]!.point]);
		boundary.push([left.at(-1)!.point, right.at(-1)!.point]);
	}
	for (let index = 0; index < footprint.length; index++) {
		const start = footprint[index]!;
		const end = footprint[(index + 1) % footprint.length]!;
		for (const [a, b] of boundary) {
			if (segmentsProperlyCross(start, end, a, b)) return false;
		}
	}
	return true;
}

/** Half-thickness membership over the Wall's station span, end caps included. */
function pointWithinBodyStrip(
	point: LayoutVec2,
	wall: Pick<CompiledPhysicalWall, 'samples' | 'startJunctionId' | 'endJunctionId'>,
	half: number
): boolean {
	let nearestDistance = Infinity;
	let nearestStation = 0;
	for (let index = 0; index + 1 < wall.samples.length; index++) {
		const start = wall.samples[index]!;
		const end = wall.samples[index + 1]!;
		const dx = end.point[0] - start.point[0];
		const dz = end.point[1] - start.point[1];
		const squared = dx * dx + dz * dz;
		const t =
			squared > 0
				? Math.min(
						1,
						Math.max(
							0,
							((point[0] - start.point[0]) * dx + (point[1] - start.point[1]) * dz) / squared
						)
					)
				: 0;
		const distance = Math.hypot(point[0] - (start.point[0] + dx * t), point[1] - (start.point[1] + dz * t));
		if (distance < nearestDistance) {
			nearestDistance = distance;
			nearestStation = start.distance + (end.distance - start.distance) * t;
		}
	}
	if (nearestDistance > half + REGION_WALL_RELATION_EPSILON) return false;
	if (isClosedWall(wall)) return true;
	return (
		nearestStation >= wall.samples[0]!.distance - REGION_WALL_RELATION_EPSILON &&
		nearestStation <= wall.samples.at(-1)!.distance + REGION_WALL_RELATION_EPSILON
	);
}

function isClosedWall(
	wall: Pick<CompiledPhysicalWall, 'startJunctionId' | 'endJunctionId'>
): boolean {
	return wall.startJunctionId !== undefined && wall.startJunctionId === wall.endJunctionId;
}

/** Strict crossing: each segment's endpoints lie on opposite sides of the other. */
function segmentsProperlyCross(a: LayoutVec2, b: LayoutVec2, c: LayoutVec2, d: LayoutVec2): boolean {
	const ab: LayoutVec2 = [b[0] - a[0], b[1] - a[1]];
	const cd: LayoutVec2 = [d[0] - c[0], d[1] - c[1]];
	return (
		oppositeSigns(cross(ab, [c[0] - a[0], c[1] - a[1]]), cross(ab, [d[0] - a[0], d[1] - a[1]])) &&
		oppositeSigns(cross(cd, [a[0] - c[0], a[1] - c[1]]), cross(cd, [b[0] - c[0], b[1] - c[1]]))
	);
}

function oppositeSigns(left: number, right: number): boolean {
	return (left > 1e-12 && right < -1e-12) || (left < -1e-12 && right > 1e-12);
}

function bodyStripDistance(
	footprint: readonly LayoutVec2[],
	left: readonly ProjectedPoint[],
	right: readonly ProjectedPoint[],
	wall: Pick<CompiledPhysicalWall, 'samples' | 'startJunctionId' | 'endJunctionId'>
): number {
	const stripSegments: Array<[LayoutVec2, LayoutVec2]> = [];
	for (const face of [left, right]) {
		for (let index = 0; index + 1 < face.length; index++) {
			stripSegments.push([face[index]!.point, face[index + 1]!.point]);
		}
	}
	if (!isClosedWall(wall) && left.length > 0 && right.length > 0) {
		stripSegments.push([left[0]!.point, right[0]!.point]);
		stripSegments.push([left.at(-1)!.point, right.at(-1)!.point]);
	}
	let minimum = Infinity;
	for (let index = 0; index < footprint.length; index++) {
		const a = footprint[index]!;
		const b = footprint[(index + 1) % footprint.length]!;
		for (const [c, d] of stripSegments) {
			minimum = Math.min(minimum, segmentDistance(a, b, c, d));
			if (minimum === 0) return 0;
		}
	}
	return minimum;
}

function pointNearBoundary(footprint: readonly LayoutVec2[], point: LayoutVec2, tolerance: number): boolean {
	for (let index = 0; index < footprint.length; index++) {
		const a = footprint[index]!;
		const b = footprint[(index + 1) % footprint.length]!;
		if (distancePointSegment(point, a, b) <= tolerance) return true;
	}
	return false;
}

function segmentDistance(a: LayoutVec2, b: LayoutVec2, c: LayoutVec2, d: LayoutVec2): number {
	if (segmentsIntersect(a, b, c, d)) return 0;
	return Math.min(
		distancePointSegment(a, c, d),
		distancePointSegment(b, c, d),
		distancePointSegment(c, a, b),
		distancePointSegment(d, a, b)
	);
}

function segmentsIntersect(a: LayoutVec2, b: LayoutVec2, c: LayoutVec2, d: LayoutVec2): boolean {
	const r: LayoutVec2 = [b[0] - a[0], b[1] - a[1]];
	const s: LayoutVec2 = [d[0] - c[0], d[1] - c[1]];
	const denominator = cross(r, s);
	const difference: LayoutVec2 = [c[0] - a[0], c[1] - a[1]];
	if (Math.abs(denominator) <= 1e-12) {
		if (Math.abs(cross(difference, r)) > 1e-12) return false;
		return collinearOverlap(a, b, c, d);
	}
	const t = cross(difference, s) / denominator;
	const u = cross(difference, r) / denominator;
	return t >= 0 && t <= 1 && u >= 0 && u <= 1;
}

function collinearOverlap(a: LayoutVec2, b: LayoutVec2, c: LayoutVec2, d: LayoutVec2): boolean {
	const useX = Math.abs(b[0] - a[0]) >= Math.abs(b[1] - a[1]);
	const coordinate = (point: LayoutVec2) => (useX ? point[0] : point[1]);
	const [a0, a1] = [coordinate(a), coordinate(b)].sort((left, right) => left - right);
	const [c0, c1] = [coordinate(c), coordinate(d)].sort((left, right) => left - right);
	return Math.min(a1, c1) - Math.max(a0, c0) >= -1e-12;
}

function segmentParameters(
	a: LayoutVec2,
	b: LayoutVec2,
	c: LayoutVec2,
	d: LayoutVec2
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

function distancePointSegment(point: LayoutVec2, start: LayoutVec2, end: LayoutVec2): number {
	const dx = end[0] - start[0];
	const dz = end[1] - start[1];
	const squared = dx * dx + dz * dz;
	if (!(squared > 0)) return Math.hypot(point[0] - start[0], point[1] - start[1]);
	const t = Math.min(
		1,
		Math.max(0, ((point[0] - start[0]) * dx + (point[1] - start[1]) * dz) / squared)
	);
	return Math.hypot(point[0] - (start[0] + dx * t), point[1] - (start[1] + dz * t));
}

function cross(left: LayoutVec2, right: LayoutVec2): number {
	return left[0] * right[1] - left[1] * right[0];
}
