/**
 * T2 gallery UX recovery §5.5 — where the Directional dial sits and how large
 * it is. The dial is a screen-sized instrument placed in the world: its centre
 * follows the scene bounds when they project inside the Stage, otherwise the
 * viewport centre's datum hit, and its radius is the world radius that projects
 * 72 CSS px to the camera's right. Both are presentation values, frozen by the
 * gesture that reads them.
 */
import type { Vec3 } from '@portfolio/project-model';
import { rotationForLightDirection } from './light-aim';
import { directionForPresentationAngles } from './light-presentation';

export const DIRECTIONAL_DIAL_INSET_PX = 96;
export const DIRECTIONAL_DIAL_RADIUS_PX = 72;
export const DIRECTIONAL_DIAL_MIN_RADIUS_METERS = 0.5;

export type DirectionalDialFrame = {
	readonly center: Vec3;
	readonly radius: number;
};

function normalize(value: Vec3): Vec3 | null {
	const length = Math.hypot(value[0], value[1], value[2]);
	if (!(length > 1e-9)) return null;
	return [value[0] / length, value[1] / length, value[2] / length];
}

function pointOnDatum(
	ray: { readonly origin: Vec3; readonly direction: Vec3 },
	datum: number
): Vec3 | null {
	const denominator = ray.direction[1];
	if (Math.abs(denominator) < 1e-9) return null;
	const distance = (datum - ray.origin[1]) / denominator;
	if (!(distance > 0) || !Number.isFinite(distance)) return null;
	return [
		ray.origin[0] + ray.direction[0] * distance,
		datum,
		ray.origin[2] + ray.direction[2] * distance
	];
}

/**
 * A new Directional light comes from behind the viewer's left shoulder, 50° in
 * the sky: the camera's forward projected on the datum, turned left by 45°.
 */
export function directionalShelfRotation(cameraForward: Vec3, heightInSky = 50): Vec3 {
	const view = normalize([cameraForward[0], 0, cameraForward[2]]) ?? ([0, 0, -1] as Vec3);
	// left = cross(up, view)
	const left: Vec3 = [view[2], 0, -view[0]];
	const horizontal = normalize([left[0] - view[0], 0, left[2] - view[2]]) ?? ([-1, 0, 0] as Vec3);
	const from = ((Math.atan2(horizontal[0], -horizontal[2]) * 180) / Math.PI + 360) % 360;
	return rotationForLightDirection(directionForPresentationAngles(from, heightInSky));
}

export function directionalDialFrame(input: {
	readonly datumMeters: number;
	/** Centre of `sceneBoundsUnion` in world space, or `null` when empty. */
	readonly boundsCenter: Vec3 | null;
	readonly project: (point: Vec3) => readonly [number, number] | null;
	/** Ray through the viewport centre, used when the bounds centre is off-stage. */
	readonly centerRay: { readonly origin: Vec3; readonly direction: Vec3 } | null;
	readonly viewport: { readonly width: number; readonly height: number };
	readonly cameraRight: Vec3;
	readonly insetPx?: number;
	readonly radiusPx?: number;
}): DirectionalDialFrame {
	const datum = input.datumMeters;
	const anchor: Vec3 = input.boundsCenter === null
		? [0, datum, 0]
		: [input.boundsCenter[0], datum, input.boundsCenter[2]];
	const inset = input.insetPx ?? DIRECTIONAL_DIAL_INSET_PX;
	const projected = input.project(anchor);
	const inside = projected !== null &&
		projected[0] >= inset &&
		projected[0] <= input.viewport.width - inset &&
		projected[1] >= inset &&
		projected[1] <= input.viewport.height - inset;
	let center = anchor;
	if (!inside && input.centerRay !== null) {
		const hit = pointOnDatum(input.centerRay, datum);
		if (hit !== null) center = hit;
	}
	const projectedCenter = input.project(center);
	const right = normalize(input.cameraRight);
	const targetPixels = input.radiusPx ?? DIRECTIONAL_DIAL_RADIUS_PX;
	let radius = DIRECTIONAL_DIAL_MIN_RADIUS_METERS;
	if (projectedCenter !== null && right !== null) {
		const sample = input.project([
			center[0] + right[0],
			center[1] + right[1],
			center[2] + right[2]
		]);
		if (sample !== null) {
			const cssPerMeter = Math.hypot(
				sample[0] - projectedCenter[0],
				sample[1] - projectedCenter[1]
			);
			if (cssPerMeter > 0.5) {
				radius = Math.max(DIRECTIONAL_DIAL_MIN_RADIUS_METERS, targetPixels / cssPerMeter);
			}
		}
	}
	return { center, radius };
}
