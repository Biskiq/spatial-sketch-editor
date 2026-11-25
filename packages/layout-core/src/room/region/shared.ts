import type { LayoutVec2 } from '../../geometry/coordinates';
import { pointStrictlyInsidePolygon } from '../../geometry/face-extraction';
import { LAYOUT_GEOMETRY_EPSILON } from '../../geometry/openings';
import type { CompiledPhysicalWall, LayoutGeometryIssue } from '../../geometry/types';
import type { LayoutDocumentIssue } from '../../plan/issue';
import { REGION_WALL_RELATION_EPSILON } from '../region-relations';
import { MAX_LAYOUT_REGION_POINTS } from '../region-validation';
import { validateWallFirstLayoutDocument } from '../../wall/codec';
import type { LayoutDocumentWallFirst, LayoutRegion } from '../../wall/types';
import type { RegionPlan, RegionPlannerOperation, RegionPlannerRejectionCode } from './contracts';

export function reject(
	code: RegionPlannerRejectionCode,
	message: string,
	targetIds?: readonly string[],
	issues?: readonly (LayoutDocumentIssue | LayoutGeometryIssue)[]
): RegionPlan {
	return {
		kind: 'rejected',
		rejection: { code, message, ...(targetIds ? { targetIds } : {}), ...(issues ? { issues } : {}) }
	};
}


export function layoutIds(document: LayoutDocumentWallFirst): Set<string> {
	const ids = new Set<string>([document.floor.id]);
	for (const collection of [
		document.junctions,
		document.walls,
		document.rooms,
		document.openings,
		document.objects,
		document.regions
	]) {
		for (const entry of collection as readonly { id: string }[]) ids.add(entry.id);
	}
	return ids;
}


export function findRegion(document: LayoutDocumentWallFirst, regionId: string): LayoutRegion | undefined {
	return document.regions.find((region) => region.id === regionId);
}


export function finalizeRegionCandidate(
	candidate: LayoutDocumentWallFirst,
	operation: RegionPlannerOperation,
	regionId: string,
	extra: Pick<
		RegionPlan & { kind: 'success' },
		'createdRegionId' | 'changedWallIds' | 'fittedWallIds' | 'skippedWallIds'
	> = {}
): RegionPlan {
	const structural = validateWallFirstLayoutDocument(candidate);
	if (!structural.success) {
		const first = structural.issues[0]!;
		return reject(first.code, first.message, [regionId], structural.issues);
	}
	return {
		kind: 'success',
		document: structural.document,
		operation,
		regionId,
		...extra
	};
}


export function finitePoint(point: LayoutVec2): boolean {
	return Number.isFinite(point[0]) && Number.isFinite(point[1]);
}


export function copyPoints(points: readonly LayoutVec2[]): LayoutVec2[] {
	return points.map(([x, z]): LayoutVec2 => [x, z]);
}


export function samePoints(left: readonly LayoutVec2[], right: readonly LayoutVec2[]): boolean {
	return left.length === right.length &&
		left.every(([x, z], index) => x === right[index]![0] && z === right[index]![1]);
}


export function translatePoints(points: readonly LayoutVec2[], delta: LayoutVec2): LayoutVec2[] {
	return points.map(([x, z]): LayoutVec2 => [x + delta[0], z + delta[1]]);
}


/** Area centroid of a simple positive-area footprint, or `null` when degenerate. */
export function footprintCentroid(points: readonly LayoutVec2[]): LayoutVec2 | null {
	let twiceArea = 0;
	let weightedX = 0;
	let weightedZ = 0;
	for (let index = 0; index < points.length; index++) {
		const [x, z] = points[index]!;
		const [nextX, nextZ] = points[(index + 1) % points.length]!;
		const cross = x * nextZ - nextX * z;
		twiceArea += cross;
		weightedX += (x + nextX) * cross;
		weightedZ += (z + nextZ) * cross;
	}
	if (Math.abs(twiceArea) <= LAYOUT_GEOMETRY_EPSILON) return null;
	return [weightedX / (3 * twiceArea), weightedZ / (3 * twiceArea)];
}


/**
 * Rotate in the document's own X/Z handedness, matching the shipped Room-unit
 * rotation (`rotatePointAbout`): Plan X/Z has +Z down the screen, so this is the
 * direction the creator's turn gesture already turns architecture.
 */
export function rotatePoint(point: LayoutVec2, pivot: LayoutVec2, angle: number): LayoutVec2 {
	const cos = Math.cos(angle);
	const sin = Math.sin(angle);
	const x = point[0] - pivot[0];
	const z = point[1] - pivot[1];
	return [pivot[0] + x * cos + z * sin, pivot[1] - x * sin + z * cos];
}


export function validFootprintInput(points: unknown): points is readonly LayoutVec2[] {
	return Array.isArray(points) &&
		points.length >= 3 &&
		points.length <= MAX_LAYOUT_REGION_POINTS &&
		points.every((point) => Array.isArray(point) && point.length === 2 && finitePoint(point as LayoutVec2));
}


/**
 * Continuous coverage: every compiled centerline segment stays inside or on the
 * footprint. Sampling the vertices alone is not enough, because a straight Wall
 * can have both ends under a concave roof while its middle crosses the notch.
 */
export function centerlineWithinFootprint(
	footprint: readonly LayoutVec2[],
	samples: CompiledPhysicalWall['samples']
): boolean {
	for (let index = 0; index + 1 < samples.length; index++) {
		if (!segmentWithinFootprint(footprint, samples[index]!.point, samples[index + 1]!.point)) return false;
	}
	return true;
}


/** A segment is covered when its ends and interior probes are inside and it never crosses the ring. */
function segmentWithinFootprint(footprint: readonly LayoutVec2[], start: LayoutVec2, end: LayoutVec2): boolean {
	const probes: LayoutVec2[] = [start, end];
	for (const t of [0.25, 0.5, 0.75]) {
		probes.push([start[0] + (end[0] - start[0]) * t, start[1] + (end[1] - start[1]) * t]);
	}
	for (const probe of probes) {
		if (!footprintContainsInclusive(footprint, probe)) return false;
	}
	for (let index = 0; index < footprint.length; index++) {
		const a = footprint[index]!;
		const b = footprint[(index + 1) % footprint.length]!;
		if (segmentsProperlyCross(start, end, a, b)) return false;
	}
	return true;
}


/** Strict crossing: each segment's endpoints lie on opposite sides of the other. */
function segmentsProperlyCross(a: LayoutVec2, b: LayoutVec2, c: LayoutVec2, d: LayoutVec2): boolean {
	const ab: LayoutVec2 = [b[0] - a[0], b[1] - a[1]];
	const cd: LayoutVec2 = [d[0] - c[0], d[1] - c[1]];
	return (
		oppositeSigns(cross2(ab, [c[0] - a[0], c[1] - a[1]]), cross2(ab, [d[0] - a[0], d[1] - a[1]])) &&
		oppositeSigns(cross2(cd, [a[0] - c[0], a[1] - c[1]]), cross2(cd, [b[0] - c[0], b[1] - c[1]]))
	);
}


function oppositeSigns(left: number, right: number): boolean {
	return (left > 1e-12 && right < -1e-12) || (left < -1e-12 && right > 1e-12);
}


function cross2(left: LayoutVec2, right: LayoutVec2): number {
	return left[0] * right[1] - left[1] * right[0];
}


/** Inclusive footprint membership: an edge or vertex on the ring qualifies. */
function footprintContainsInclusive(footprint: readonly LayoutVec2[], point: LayoutVec2): boolean {
	if (pointStrictlyInsidePolygon(footprint, point)) return true;
	for (let index = 0; index < footprint.length; index++) {
		const start = footprint[index]!;
		const end = footprint[(index + 1) % footprint.length]!;
		if (distancePointSegment(point, start, end) <= REGION_WALL_RELATION_EPSILON) return true;
	}
	return false;
}


export function segmentDistance(a: LayoutVec2, b: LayoutVec2, c: LayoutVec2, d: LayoutVec2): number {
	return Math.min(
		distancePointSegment(a, c, d),
		distancePointSegment(b, c, d),
		distancePointSegment(c, a, b),
		distancePointSegment(d, a, b)
	);
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
