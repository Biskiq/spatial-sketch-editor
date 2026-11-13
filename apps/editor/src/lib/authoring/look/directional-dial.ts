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
import { directionForPresentationAngles, presentationAngles } from './light-presentation';

export const DIRECTIONAL_DIAL_INSET_PX = 96;
export const DIRECTIONAL_DIAL_RADIUS_PX = 72;
export const DIRECTIONAL_DIAL_MIN_RADIUS_METERS = 0.5;
/** Another Directional light's tick on the ring, in CSS pixels. */
export const DIRECTIONAL_DIAL_TICK_PX = 6;
/** The centre name chip's limit, including its ellipsis. */
export const DIRECTIONAL_DIAL_NAME_LIMIT = 18;

export type DirectionalDialFrame = {
	readonly center: Vec3;
	readonly radius: number;
};

function normalize(value: Vec3): Vec3 | null {
	const length = Math.hypot(value[0], value[1], value[2]);
	if (!(length > 1e-9)) return null;
	return [value[0] / length, value[1] / length, value[2] / length];
}

function add(left: Vec3, right: Vec3): Vec3 {
	return [left[0] + right[0], left[1] + right[1], left[2] + right[2]];
}

function scale(value: Vec3, amount: number): Vec3 {
	return [value[0] * amount, value[1] * amount, value[2] * amount];
}

function sub(left: Vec3, right: Vec3): Vec3 {
	return [left[0] - right[0], left[1] - right[1], left[2] - right[2]];
}

/** Another Directional light the dial marks on its bearing ring. */
export type DirectionalDialCompanion = {
	readonly id: string;
	readonly name: string;
	/** Bearing toward the source, in degrees. */
	readonly from: number;
};

/**
 * The other Directional lights, by bearing. The selected light is excluded: its
 * own bead and spoke already state where it comes from. Ticks never drag.
 */
export function directionalDialCompanions(
	lights: readonly { readonly id: string; readonly name: string; readonly rotation: Vec3 }[],
	selectedId: string
): readonly DirectionalDialCompanion[] {
	return lights
		.filter((light) => light.id !== selectedId)
		.map((light) => ({
			id: light.id,
			name: light.name,
			from: presentationAngles(light.rotation).from
		}));
}

/** The selected light's name chip text, truncated to the approved limit. */
export function directionalDialName(name: string): string {
	const trimmed = name.trim();
	if (trimmed.length <= DIRECTIONAL_DIAL_NAME_LIMIT) return trimmed;
	return `${trimmed.slice(0, DIRECTIONAL_DIAL_NAME_LIMIT - 1)}…`;
}

/** The bearing ring's point for a source bearing, on the datum. */
export function directionalDialBearingPoint(
	center: Vec3,
	radius: number,
	from: number
): Vec3 {
	const radians = (from * Math.PI) / 180;
	return add(center, scale([Math.sin(radians), 0, -Math.cos(radians)], radius));
}

/**
 * A short radial tick centred on the bearing ring at `from`. `halfLength` is in
 * metres, derived from the ring's own CSS scale so the tick keeps its 6 px size.
 */
export function directionalDialTick(input: {
	readonly center: Vec3;
	readonly radius: number;
	readonly from: number;
	readonly halfLength: number;
}): [Vec3, Vec3] {
	const radians = (input.from * Math.PI) / 180;
	const direction: Vec3 = [Math.sin(radians), 0, -Math.cos(radians)];
	const point = directionalDialBearingPoint(input.center, input.radius, input.from);
	return [
		sub(point, scale(direction, input.halfLength)),
		add(point, scale(direction, input.halfLength))
	];
}

/** The world half-length that projects `DIRECTIONAL_DIAL_TICK_PX`. */
export function directionalDialTickHalfLength(cssPerMeter: number): number {
	if (!(cssPerMeter > 0.5)) return 0.01;
	return Math.max(0.005, DIRECTIONAL_DIAL_TICK_PX / 2 / cssPerMeter);
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
