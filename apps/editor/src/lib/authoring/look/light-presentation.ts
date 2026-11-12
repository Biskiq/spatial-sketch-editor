/**
 * T2 gallery UX recovery — the light instrument's presentation maths.
 *
 * One module owns every derived quantity the Stage marks and the Card show:
 * the Directional presentation angles (From / Height in sky), the Spot's derived
 * target distance, the soft-edge ring, the Point reach ring, the placement
 * stand-off table and the number formats. Stored fields remain the Scene's; none
 * of these values is ever authored.
 */
import type { Vec3 } from '@portfolio/project-model';
import { lightForward } from './light-aim';

/** A new Point light sits this far in front of a wall or ceiling. */
export const LIGHT_POINT_STANDOFF_METERS = 0.3;
/** A new Spot light sits this far in front of a wall or ceiling. */
export const LIGHT_SPOT_STANDOFF_METERS = 0.1;
/** A light placed on a floor-like surface hangs this far above it. */
export const LIGHT_WORKING_HEIGHT_METERS = 2.2;
/** A clamped Spot guide never draws wider than this, in degrees. */
export const LIGHT_GUIDE_MAX_ANGLE = 80;
/** The Spot's target when its forward ray hits nothing, in metres. */
export const LIGHT_SPOT_TARGET_FALLBACK_METERS = 3;
/** The smallest authored reach, in metres. */
export const LIGHT_MIN_RANGE_METERS = 0.1;

export type LightPresentationAngles = {
	/** Bearing toward the source; 0° is world −Z, 90° is world +X. */
	readonly from: number;
	/** Source elevation above the horizon; straight overhead reads 90°. */
	readonly heightInSky: number;
};

function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}

function degrees(radians: number): number {
	return (radians * 180) / Math.PI;
}

function radians(degreesValue: number): number {
	return (degreesValue * Math.PI) / 180;
}

/**
 * The stored rotation as the two presentation angles.
 *
 * `lastFrom` keeps the last displayed bearing while the source is straight
 * overhead or straight below, where the horizontal part vanishes and every
 * bearing would be equally true.
 */
export function presentationAngles(rotation: Vec3, lastFrom = 0): LightPresentationAngles {
	const forward = lightForward(rotation);
	// s points from the scene toward the source: the reverse of the travel
	// direction. This is the vocabulary fix — elevation used to be the travel
	// direction, so straight down read −90° and +20° lit from below the floor.
	const source: Vec3 = [-forward[0], -forward[1], -forward[2]];
	const heightInSky = degrees(Math.asin(clamp(source[1], -1, 1)));
	const horizontal = Math.hypot(source[0], source[2]);
	const from =
		horizontal < 1e-6 ? lastFrom : (degrees(Math.atan2(source[0], -source[2])) + 360) % 360;
	return { from, heightInSky };
}

/** The inverse of {@link presentationAngles}; `heightInSky` may be −90…90. */
export function directionForPresentationAngles(from: number, heightInSky: number): Vec3 {
	const azimuth = radians(from);
	const height = radians(clamp(heightInSky, -90, 90));
	const horizontal = Math.cos(height);
	// s = [sin(F)·cos(H), sin(H), −cos(F)·cos(H)] and f = −s.
	return [
		-Math.sin(azimuth) * horizontal,
		-Math.sin(height),
		Math.cos(azimuth) * horizontal
	];
}

/** A ray cast along the light's forward, as the pick provider reports it. */
export type LightRayHit = {
	readonly distanceMeters: number;
	readonly worldPoint: Vec3;
};

export type SpotTarget = {
	/** Distance along forward to the derived target. */
	readonly distance: number;
	/** `position + forward × distance`. */
	readonly target: Vec3;
	/** True when the forward ray landed on scene geometry. */
	readonly surfaceBound: boolean;
};

/**
 * The Spot's target, derived on every read and never stored.
 *
 * Reach is deliberately not an input: aiming must not rewrite the cutoff, and
 * a Move that keeps a surface-bound target must not depend on where the cutoff
 * happens to be.
 */
export function spotTarget(input: {
	readonly position: Vec3;
	readonly rotation: Vec3;
	readonly pick: (ray: { origin: Vec3; direction: Vec3 }) => LightRayHit | null;
}): SpotTarget {
	const forward = normalize(lightForward(input.rotation));
	const hit = input.pick({ origin: [...input.position] as Vec3, direction: forward });
	const distance =
		hit !== null && Number.isFinite(hit.distanceMeters) && hit.distanceMeters > 1e-6
			? hit.distanceMeters
			: LIGHT_SPOT_TARGET_FALLBACK_METERS;
	const target: Vec3 =
		hit !== null && distance === hit.distanceMeters
			? [...hit.worldPoint] as Vec3
			: add(input.position, scale(forward, distance));
	return { distance, target, surfaceBound: hit !== null && distance === hit.distanceMeters };
}

/** The footprint radius of a Spot at its target distance. */
export function spotFootprintRadius(distance: number, angle: number): number {
	return Math.max(distance, 0) * Math.tan(clamp(angle, 0, Math.PI / 2 - 1e-6));
}

/**
 * The radius of the edge of full brightness, matching the renderer: three.js
 * is at full brightness inside `angle × (1 − penumbra)`.
 */
export function spotInnerRadius(
	distance: number,
	angle: number,
	penumbra: number
): number {
	return spotFootprintRadius(distance, angle * (1 - clamp(penumbra, 0, 1)));
}

/** The inverse of {@link spotInnerRadius}; the Card and the mark share it. */
export function penumbraForInnerRadius(
	distance: number,
	angle: number,
	radius: number
): number {
	if (!(distance > 1e-6) || !(angle > 1e-6)) return 0;
	return clamp(1 - Math.atan2(Math.max(radius, 0), distance) / angle, 0, 1);
}

/** The authored Point reach where it meets the datum, or `null` when it does not. */
export function pointReachRingRadius(
	range: number,
	height: number
): { readonly radius: number; readonly onDatum: boolean } {
	const h = Math.max(0, height);
	if (range < h) return { radius: 0, onDatum: false };
	return { radius: Math.max(0, Math.sqrt(Math.max(0, range * range - h * h))), onDatum: true };
}

/** A Spot guide is drawn clamped without ever changing the stored angle. */
export function drawableSpotAngle(angle: number): number {
	return Math.min(Math.max(angle, 0), radians(LIGHT_GUIDE_MAX_ANGLE));
}

/** Whether a stored Spot angle is wider than the guide can draw. */
export function isWideBeam(angle: number): boolean {
	return degrees(angle) > LIGHT_GUIDE_MAX_ANGLE + 1e-9;
}

export type LightPlacementHit = {
	readonly point: Vec3;
	/** Surface normal at the hit, already flipped to face the camera. */
	readonly normal: Vec3;
};

/**
 * The approved placement stand-off table.
 *
 * Floor-like surfaces hang the body at the working height; walls and ceilings
 * sit in front of the surface by the kind's stand-off. `null` means the ray
 * missed every surface and did not meet the datum.
 */
export function lightPlacementBody(input: {
	readonly kind: 'point' | 'spot' | 'directional';
	readonly hit: LightPlacementHit | null;
	readonly datumMeters: number;
	readonly ray: { origin: Vec3; direction: Vec3 };
}): Vec3 | null {
	if (input.kind === 'directional') {
		return [0, input.datumMeters, 0];
	}
	const standoff =
		input.kind === 'point' ? LIGHT_POINT_STANDOFF_METERS : LIGHT_SPOT_STANDOFF_METERS;
	const hit = input.hit;
	if (hit === null) {
		const plane = pointOnPlane(input.ray, input.datumMeters);
		return plane === null
			? null
			: [plane[0], input.datumMeters + LIGHT_WORKING_HEIGHT_METERS, plane[2]];
	}
	const normal = normalize(hit.normal);
	if (normal[1] >= 0.5) return add(hit.point, [0, LIGHT_WORKING_HEIGHT_METERS, 0]);
	return add(hit.point, scale(normal, standoff));
}

/**
 * The end of a Point light's drop stem: the first surface below the body, or
 * the datum when nothing is under it. It is derived geometry and never a
 * stored reach.
 */
export function lightDropStem(
	position: Vec3,
	datumMeters: number,
	pick: (ray: { origin: Vec3; direction: Vec3 }) => LightRayHit | null
): Vec3 {
	const hit = pick({ origin: [...position] as Vec3, direction: [0, -1, 0] });
	const y = hit !== null && hit.worldPoint[1] < position[1] - 1e-6
		? hit.worldPoint[1]
		: datumMeters;
	return [position[0], y, position[2]];
}

/** The point where a ray meets a horizontal plane, or `null`. */
export function pointOnPlane(
	ray: { origin: Vec3; direction: Vec3 },
	planeY: number
): Vec3 | null {
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

/** Metres: two decimals, ` m`. */
export function formatMeters(value: number): string {
	return `${value.toFixed(2)} m`;
}

/** Centimetres: one decimal, ` cm`. */
export function formatCentimetres(valueMeters: number): string {
	return `${(valueMeters * 100).toFixed(1)} cm`;
}

/** Degrees: whole on the Stage, one decimal in a field. */
export function formatDegrees(value: number, decimals = 1): string {
	return `${value.toFixed(decimals)}°`;
}

/** Brightness as a multiplier: up to two decimals, trailing zeros dropped. */
export function formatMultiplier(intensity: number): string {
	const value = Number.isFinite(intensity) ? intensity / Math.PI : 0;
	const fixed = value.toFixed(2).replace(/\.?0+$/, '');
	return `${fixed === '' || fixed === '-' ? '0' : fixed}×`;
}

/** Exact intensity: three decimals and its kind's unit. */
export function formatExactIntensity(intensity: number, kind: 'point' | 'spot' | 'directional'): string {
	return `${intensity.toFixed(3)} ${kind === 'directional' ? 'lx' : 'cd'}`;
}

function normalize(value: Vec3): Vec3 {
	const length = Math.hypot(value[0], value[1], value[2]);
	if (!(length > 1e-9)) return [0, -1, 0];
	return [value[0] / length, value[1] / length, value[2] / length];
}

function add(left: Vec3, right: Vec3): Vec3 {
	return [left[0] + right[0], left[1] + right[1], left[2] + right[2]];
}

function scale(value: Vec3, amount: number): Vec3 {
	return [value[0] * amount, value[1] * amount, value[2] * amount];
}
