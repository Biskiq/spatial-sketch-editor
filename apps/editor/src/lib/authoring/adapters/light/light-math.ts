/**
 * X8 — the Light authoring vector and ray helpers.
 *
 * Pure, lifetime-free arithmetic shared by the Light guides, marks, gestures and
 * placement: no state, no session, no host. Moved verbatim from the former
 * monolithic adapter; the Light planners remain the only authority on what a
 * result means.
 */
import type { Vec3 } from '@portfolio/project-model';

/** A ray as the Stage host publishes it. */
export type LightRay = { readonly origin: Vec3; readonly direction: Vec3 };

export type SceneBounds = { readonly min: Vec3; readonly max: Vec3 };

export function pointOf(ray: LightRay, planeY: number): Vec3 | null {
	const denominator = ray.direction[1];
	if (Math.abs(denominator) < 1e-9) return null;
	const distance = (planeY - ray.origin[1]) / denominator;
	if (!(distance > 0) || !Number.isFinite(distance)) return null;
	return [
		ray.origin[0] + ray.direction[0] * distance,
		planeY,
		ray.origin[2] + ray.direction[2] * distance
	];
}

export function horizontalDistance(from: Vec3, to: Vec3): number {
	return Math.hypot(to[0] - from[0], to[2] - from[2]);
}

export function distance(from: Vec3, to: Vec3): number {
	return Math.hypot(to[0] - from[0], to[1] - from[1], to[2] - from[2]);
}

export function dot(left: Vec3, right: Vec3): number {
	return left[0] * right[0] + left[1] * right[1] + left[2] * right[2];
}

export function sub(left: Vec3, right: Vec3): Vec3 {
	return [left[0] - right[0], left[1] - right[1], left[2] - right[2]];
}

export function cross(left: Vec3, right: Vec3): Vec3 {
	return [
		left[1] * right[2] - left[2] * right[1],
		left[2] * right[0] - left[0] * right[2],
		left[0] * right[1] - left[1] * right[0]
	];
}

export function add(left: Vec3, right: Vec3): Vec3 {
	return [left[0] + right[0], left[1] + right[1], left[2] + right[2]];
}

export function scale(value: Vec3, amount: number): Vec3 {
	return [value[0] * amount, value[1] * amount, value[2] * amount];
}

export function normalize(value: Vec3): Vec3 {
	const length = Math.hypot(value[0], value[1], value[2]);
	if (!(length > 1e-9)) return [0, -1, 0];
	return [value[0] / length, value[1] / length, value[2] / length];
}

export function rayPlane(ray: LightRay, point: Vec3, normal: Vec3): Vec3 | null {
	const denominator = dot(ray.direction, normal);
	if (Math.abs(denominator) < 1e-9) return null;
	const t = dot(sub(point, ray.origin), normal) / denominator;
	if (!(t > 0) || !Number.isFinite(t)) return null;
	return add(ray.origin, scale(ray.direction, t));
}

/**
 * Closest point on the light's forward axis to the pointer ray.
 *
 * Reach is an axis extent. A plane through the light perpendicular to forward
 * would project to one point on that plane and can never produce a length.
 */
export function closestAxisPoint(
	ray: LightRay,
	origin: Vec3,
	axis: Vec3
): { readonly point: Vec3; readonly distanceAlongAxis: number } | null {
	const w0 = sub(origin, ray.origin);
	const a = dot(ray.direction, ray.direction);
	const b = dot(ray.direction, axis);
	const c = dot(axis, axis);
	const d = dot(ray.direction, w0);
	const e = dot(axis, w0);
	const denominator = a * c - b * b;
	if (Math.abs(denominator) < 1e-9) return null;
	const distanceAlongAxis = (b * d - a * e) / denominator;
	return {
		point: add(origin, scale(axis, distanceAlongAxis)),
		distanceAlongAxis
	};
}



export function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}

export function nearestPointInBounds(point: Vec3, bounds: SceneBounds): Vec3 {
	return [
		clamp(point[0], bounds.min[0], bounds.max[0]),
		clamp(point[1], bounds.min[1], bounds.max[1]),
		clamp(point[2], bounds.min[2], bounds.max[2])
	];
}

export function boundsCorners(bounds: SceneBounds): Vec3[] {
	return [
		[bounds.min[0], bounds.min[1], bounds.min[2]],
		[bounds.min[0], bounds.min[1], bounds.max[2]],
		[bounds.min[0], bounds.max[1], bounds.min[2]],
		[bounds.min[0], bounds.max[1], bounds.max[2]],
		[bounds.max[0], bounds.min[1], bounds.min[2]],
		[bounds.max[0], bounds.min[1], bounds.max[2]],
		[bounds.max[0], bounds.max[1], bounds.min[2]],
		[bounds.max[0], bounds.max[1], bounds.max[2]]
	];
}
