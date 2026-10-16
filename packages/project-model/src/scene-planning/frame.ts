/**
 * T2.P01.S01 — the explicit yaw-only local input frame.
 *
 * Scene storage stays world-local; a creator that offers a local input frame
 * gets exactly the contract's conversion applied **once** at the domain
 * boundary:
 *
 * ```text
 * world.x = ox + local.x*cos(a) + local.z*sin(a)
 * world.y = oy + local.y
 * world.z = oz - local.x*sin(a) + local.z*cos(a)
 * ```
 *
 * Every function here is pure and total on finite input. Directions omit the
 * origin; yaw composes the frame once. Contact elevation is deliberately **not**
 * a frame concern: a support comes from Layout, so the planner that uses these
 * helpers takes the resulting Y from the support, never from the frame's
 * incidental origin (see `place-object.ts`).
 */
import { normalizeLayoutRoomYaw } from '@portfolio/layout-core';
import type { Vec3 } from '../scene';
import type { LocalInputFrame } from './types';

/** True for a frame the conversion math is defined on. */
export function isFinitePlacementFrame(frame: LocalInputFrame): boolean {
	return (
		Array.isArray(frame.origin) &&
		frame.origin.length === 3 &&
		frame.origin.every((value) => Number.isFinite(value)) &&
		Number.isFinite(frame.yaw)
	);
}

export function framePointToWorld(frame: LocalInputFrame, local: Vec3): Vec3 {
	const cos = Math.cos(frame.yaw);
	const sin = Math.sin(frame.yaw);
	const [x, y, z] = local;
	return [
		frame.origin[0] + x * cos + z * sin,
		frame.origin[1] + y,
		frame.origin[2] - x * sin + z * cos
	];
}

export function framePointFromWorld(frame: LocalInputFrame, world: Vec3): Vec3 {
	const deltaX = world[0] - frame.origin[0];
	const deltaZ = world[2] - frame.origin[2];
	const cos = Math.cos(frame.yaw);
	const sin = Math.sin(frame.yaw);
	return [
		deltaX * cos - deltaZ * sin,
		world[1] - frame.origin[1],
		deltaX * sin + deltaZ * cos
	];
}

/** Direction conversion: translation is excluded by construction. */
export function frameDirectionToWorld(frame: LocalInputFrame, direction: Vec3): Vec3 {
	const cos = Math.cos(frame.yaw);
	const sin = Math.sin(frame.yaw);
	const [x, y, z] = direction;
	return [x * cos + z * sin, y, -x * sin + z * cos];
}

export function frameDirectionFromWorld(frame: LocalInputFrame, direction: Vec3): Vec3 {
	const cos = Math.cos(frame.yaw);
	const sin = Math.sin(frame.yaw);
	const [x, y, z] = direction;
	return [x * cos - z * sin, y, x * sin + z * cos];
}

/**
 * Compose the supplied frame's yaw with a local yaw exactly once, in the
 * renderer's normalized `(-pi, pi]` range.
 */
export function frameYawToWorld(frame: LocalInputFrame, yaw: number): number {
	return normalizeLayoutRoomYaw(frame.yaw + yaw);
}

export function frameYawFromWorld(frame: LocalInputFrame, yaw: number): number {
	return normalizeLayoutRoomYaw(yaw - frame.yaw);
}
