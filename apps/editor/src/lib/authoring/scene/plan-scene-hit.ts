import type { LayoutVec2 } from '@portfolio/layout-core';
import type { PlanSceneFootprint } from './plan-scene-footprint';

/** CSS-pixel tolerance used by Scene Plan's footprint edge hit target. */
export const PLAN_SCENE_HIT_HALO_PX = 6;

export type PlanSceneHitReason = 'containment' | 'edge-halo';

export type PlanSceneHit = {
	entityId: string;
	footprint: PlanSceneFootprint;
	reason: PlanSceneHitReason;
};

/**
 * Resolve one Scene footprint at a Plan-world point.
 *
 * Containment is resolved for every footprint before the edge halo is
 * considered. Within either pass, reverse projection order wins, matching
 * SVG's last-rendered-is-topmost rule. `edgeHaloMeters` is already converted
 * from CSS pixels by the caller, so zoom cannot change the visual tolerance.
 */
export function resolvePlanSceneHit(
	footprints: readonly PlanSceneFootprint[],
	point: LayoutVec2,
	edgeHaloMeters = 0
): PlanSceneHit | null {
	for (let index = footprints.length - 1; index >= 0; index -= 1) {
		const footprint = footprints[index]!;
		if ((footprint.polygons ?? [footprint.points]).some((polygon) => pointInPlanPolygon(point, polygon))) {
			return { entityId: footprint.entityId, footprint, reason: 'containment' };
		}
	}

	if (!Number.isFinite(edgeHaloMeters) || edgeHaloMeters < 0) return null;
	for (let index = footprints.length - 1; index >= 0; index -= 1) {
		const footprint = footprints[index]!;
		if ((footprint.polygons ?? [footprint.points]).some((polygon) => distanceToPlanPolygonEdge(point, polygon) <= edgeHaloMeters)) {
			return { entityId: footprint.entityId, footprint, reason: 'edge-halo' };
		}
	}
	return null;
}

/** Resolve six CSS pixels at current Plan zoom. */
export function resolvePlanSceneHitAtZoom(
	footprints: readonly PlanSceneFootprint[],
	point: LayoutVec2,
	pixelsPerMeter: number,
	haloPixels = PLAN_SCENE_HIT_HALO_PX
): PlanSceneHit | null {
	if (!Number.isFinite(pixelsPerMeter) || pixelsPerMeter <= 0) return null;
	return resolvePlanSceneHit(footprints, point, haloPixels / pixelsPerMeter);
}

export function pointInPlanPolygon(point: LayoutVec2, polygon: readonly LayoutVec2[]): boolean {
	if (polygon.length < 3 || !finitePoint(point) || polygon.some((candidate) => !finitePoint(candidate))) {
		return false;
	}

	let inside = false;
	for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index++) {
		const current = polygon[index]!;
		const prior = polygon[previous]!;
		if (pointOnPlanSegment(point, prior, current)) return true;
		const crosses =
			(current[1] > point[1]) !== (prior[1] > point[1]) &&
			point[0] < ((prior[0] - current[0]) * (point[1] - current[1])) / (prior[1] - current[1]) + current[0];
		if (crosses) inside = !inside;
	}
	return inside;
}

export function distanceToPlanPolygonEdge(point: LayoutVec2, polygon: readonly LayoutVec2[]): number {
	if (polygon.length < 2 || !finitePoint(point) || polygon.some((candidate) => !finitePoint(candidate))) {
		return Number.POSITIVE_INFINITY;
	}
	let minimum = Number.POSITIVE_INFINITY;
	for (let index = 0; index < polygon.length; index += 1) {
		const start = polygon[index]!;
		const end = polygon[(index + 1) % polygon.length]!;
		minimum = Math.min(minimum, distanceToPlanSegment(point, start, end));
	}
	return minimum;
}

function finitePoint(point: LayoutVec2): boolean {
	return point.length === 2 && point.every((value) => Number.isFinite(value));
}

function pointOnPlanSegment(point: LayoutVec2, start: LayoutVec2, end: LayoutVec2): boolean {
	const dx = end[0] - start[0];
	const dz = end[1] - start[1];
	const lengthSquared = dx * dx + dz * dz;
	if (lengthSquared <= Number.EPSILON) return Math.hypot(point[0] - start[0], point[1] - start[1]) <= 1e-9;
	const cross = (point[0] - start[0]) * dz - (point[1] - start[1]) * dx;
	if (Math.abs(cross) > 1e-9) return false;
	const dot = (point[0] - start[0]) * dx + (point[1] - start[1]) * dz;
	return dot >= -1e-9 && dot <= lengthSquared + 1e-9;
}

function distanceToPlanSegment(point: LayoutVec2, start: LayoutVec2, end: LayoutVec2): number {
	const dx = end[0] - start[0];
	const dz = end[1] - start[1];
	const lengthSquared = dx * dx + dz * dz;
	if (lengthSquared <= Number.EPSILON) return Math.hypot(point[0] - start[0], point[1] - start[1]);
	const t = Math.max(
		0,
		Math.min(1, ((point[0] - start[0]) * dx + (point[1] - start[1]) * dz) / lengthSquared)
	);
	return Math.hypot(point[0] - (start[0] + t * dx), point[1] - (start[1] + t * dz));
}

/** A point just inside the nearest footprint edge, for rendered visibility of a halo hit. */
export function planSceneHaloProbe(footprint: PlanSceneFootprint, point: LayoutVec2): LayoutVec2 | null {
	let nearest: { distance: number; point: LayoutVec2 } | null = null;
	for (const polygon of footprint.polygons ?? [footprint.points]) {
		let area = 0;
		for (let i = 0; i < polygon.length; i++) {
			const a = polygon[i]!, b = polygon[(i + 1) % polygon.length]!;
			area += a[0] * b[1] - b[0] * a[1];
		}
		if (Math.abs(area) < 1e-12) continue;
		for (let i = 0; i < polygon.length; i++) {
			const a = polygon[i]!, b = polygon[(i + 1) % polygon.length]!;
			const dx = b[0] - a[0], dz = b[1] - a[1], length = Math.hypot(dx, dz);
			if (length < 1e-9) continue;
			const t = Math.max(0.00001, Math.min(0.99999, ((point[0] - a[0]) * dx + (point[1] - a[1]) * dz) / (length * length)));
			const x = a[0] + t * dx, z = a[1] + t * dz;
			const distance = Math.hypot(point[0] - x, point[1] - z);
			const epsilon = Math.min(length * 0.000001, 0.000001) * Math.sign(area);
			const inside: LayoutVec2 = [x - dz / length * epsilon, z + dx / length * epsilon];
			if ((nearest === null || distance < nearest.distance) && pointInPlanPolygon(inside, polygon)) nearest = { distance, point: inside };
		}
	}
	return nearest?.point ?? null;
}
