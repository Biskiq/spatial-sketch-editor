/**
 * T2.S3 — light aim and guide geometry.
 *
 * The Scene stores an Euler rotation, and `EntityLight.svelte` aims a spot or
 * directional light down its parent's local −Z. This module is the one place
 * that converts between that stored rotation and a world direction, so the
 * handles, the guide and the created entity cannot disagree.
 *
 * The guide geometry is deliberately reusable: S3b's Look-through renders the
 * same spot cone through the one Camera, rather than treating the Camera's FOV
 * as a beam. Nothing here reads a Camera.
 */
import { Euler, Quaternion, Vector3 } from 'three';
import type { Vec3 } from '@portfolio/project-model';
import {
	drawableSpotHalfAngle,
	LIGHT_GUIDE_MAX_HALF_ANGLE_DEGREES,
	LIGHT_SPOT_TARGET_MARGIN_METERS,
	spotCutoffForTargetDistance
} from './light-units';

/** World forward of a stored Euler, using the renderer's XYZ order. */
export function lightForward(rotation: Vec3): Vec3 {
	const direction = new Vector3(0, 0, -1).applyEuler(
		new Euler(rotation[0], rotation[1], rotation[2], 'XYZ')
	);
	return [direction.x, direction.y, direction.z];
}

/**
 * The stable pitch/yaw Euler that points local −Z along `direction`.
 *
 * Yaw is the turn about +Y and pitch is the elevation; roll stays zero, so a
 * light has one authored aim and no accidental twist. A vertical direction is
 * still representable (pitch ±π/2, yaw 0).
 */
export function rotationForLightDirection(direction: Vec3): Vec3 {
	const length = Math.hypot(direction[0], direction[1], direction[2]);
	if (!(length > 1e-12)) return [0, 0, 0];
	const target = new Vector3(
		direction[0] / length,
		direction[1] / length,
		direction[2] / length
	);
	const rotation = new Quaternion().setFromUnitVectors(new Vector3(0, 0, -1), target);
	const euler = new Euler().setFromQuaternion(rotation, 'XYZ');
	return [euler.x, euler.y, euler.z];
}

/** The aim target a handle shows: a fixed reach along the light's forward. */
export const LIGHT_AIM_GUIDE_METERS = 1.5;

export type SpotConeGuide = {
	readonly direction: Vec3;
	readonly target: Vec3;
	readonly capCenter: Vec3;
	readonly capRadius: number;
	readonly capRing: readonly Vec3[];
	readonly edges: readonly (readonly [Vec3, Vec3])[];
	readonly halfAngle: number;
};

/**
 * A spot's truthful cone in world space.
 *
 * The cap sits at the authored cutoff (`range`), or at a bounded guide reach
 * when the spot is unbounded. The drawn half-angle is bounded to 80°; the
 * stored angle is returned unchanged in `halfAngle` so the Card can show π and
 * S3b can draw the exact cone.
 */
export function spotConeGuide(input: {
	readonly position: Vec3;
	readonly rotation: Vec3;
	readonly halfAngle: number;
	readonly range?: number;
	readonly ringSegments?: number;
}): SpotConeGuide {
	const direction = normalize(lightForward(input.rotation));
	const halfAngle = drawableSpotHalfAngle(input.halfAngle);
	const capDistance =
		input.range !== undefined && Number.isFinite(input.range) && input.range > 0
			? input.range
			: Math.max(3, LIGHT_AIM_GUIDE_METERS);
	const capCenter = add(input.position, scale(direction, capDistance));
	const capRadius = Math.tan(halfAngle) * capDistance;
	const basis = orthonormalBasis(direction);
	const segments = Math.max(8, Math.floor(input.ringSegments ?? 48));
	const capRing: Vec3[] = [];
	for (let index = 0; index < segments; index += 1) {
		const angle = (index / segments) * Math.PI * 2;
		capRing.push(
			add(
				capCenter,
				add(scale(basis.right, Math.cos(angle) * capRadius), scale(basis.up, Math.sin(angle) * capRadius))
			)
		);
	}
	const edges = [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2].map((angle) => {
		const rim = add(
			capCenter,
			add(scale(basis.right, Math.cos(angle) * capRadius), scale(basis.up, Math.sin(angle) * capRadius))
		);
		return [input.position, rim] as const;
	});
	return { direction, target: capCenter, capCenter, capRadius, capRing, edges, halfAngle: input.halfAngle };
}

/** A point light's reach ring in the Stage datum plane. */
export function pointReachRing(input: {
	readonly position: Vec3;
	readonly range: number;
	readonly segments?: number;
}): readonly Vec3[] {
	const segments = Math.max(8, Math.floor(input.segments ?? 64));
	const ring: Vec3[] = [];
	for (let index = 0; index < segments; index += 1) {
		const angle = (index / segments) * Math.PI * 2;
		ring.push([
			input.position[0] + Math.cos(angle) * input.range,
			input.position[1],
			input.position[2] + Math.sin(angle) * input.range
		]);
	}
	return ring;
}

/** The world point a spot's target handle shows; separate from the cutoff. */
export function aimTarget(position: Vec3, rotation: Vec3, distance = LIGHT_AIM_GUIDE_METERS): Vec3 {
	return add(position, scale(normalize(lightForward(rotation)), distance));
}

/** A new spotlight's cutoff, so the surface it was aimed at is illuminated. */
export function cutoffForAimedSurface(targetDistance: number): number {
	return spotCutoffForTargetDistance(targetDistance);
}

export const LIGHT_GUIDE_MAX_ANGLE = LIGHT_GUIDE_MAX_HALF_ANGLE_DEGREES;

function normalize(value: Vec3): Vec3 {
	const length = Math.hypot(value[0], value[1], value[2]);
	if (!(length > 1e-12)) return [0, 0, -1];
	return [value[0] / length, value[1] / length, value[2] / length];
}

function scale(value: Vec3, amount: number): Vec3 {
	return [value[0] * amount, value[1] * amount, value[2] * amount];
}

function add(left: Vec3, right: Vec3): Vec3 {
	return [left[0] + right[0], left[1] + right[1], left[2] + right[2]];
}

function orthonormalBasis(direction: Vec3): { right: Vec3; up: Vec3 } {
	const reference: Vec3 = Math.abs(direction[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
	const right = normalize(cross(direction, reference));
	const up = normalize(cross(right, direction));
	return { right, up };
}

function cross(left: Vec3, right: Vec3): Vec3 {
	return [
		left[1] * right[2] - left[2] * right[1],
		left[2] * right[0] - left[0] * right[2],
		left[0] * right[1] - left[1] * right[0]
	];
}

/** Exposed for tests and for S3b's quaternion-free guide math. */
export function lightQuaternion(rotation: Vec3): Quaternion {
	return new Quaternion().setFromEuler(new Euler(rotation[0], rotation[1], rotation[2], 'XYZ'));
}

export { LIGHT_SPOT_TARGET_MARGIN_METERS };
