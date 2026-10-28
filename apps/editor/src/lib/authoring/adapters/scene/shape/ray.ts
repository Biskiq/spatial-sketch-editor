/**
 * T5.P01.S02 — one ray/axis measurement shared by depth and sizing.
 *
 * Both the depth handle and a per-axis size knob name one point on a world
 * axis. The pointer ray rarely intersects that axis exactly, so the value is
 * the closest approach between the two lines, not an intersection with a
 * plane through the axis (which would always collapse to the plane itself).
 *
 * This is session arithmetic, never stored geometry.
 */
import type { Vec3 } from '@portfolio/camera-core';

/**
 * The signed distance along `direction` from `origin` to the point closest to
 * the pointer ray. `null` when the lines are parallel or the result is not
 * finite.
 */
export function axisTravelFromRay(input: {
	readonly origin: Vec3;
	readonly direction: Vec3;
	readonly rayOrigin: Vec3;
	readonly rayDirection: Vec3;
}): number | null {
	const direction = input.direction;
	const rayDirection = input.rayDirection;
	const b =
		direction[0] * rayDirection[0] +
		direction[1] * rayDirection[1] +
		direction[2] * rayDirection[2];
	const denominator = 1 - b * b;
	if (Math.abs(denominator) < 1e-9) return null;
	const w0: Vec3 = [
		input.origin[0] - input.rayOrigin[0],
		input.origin[1] - input.rayOrigin[1],
		input.origin[2] - input.rayOrigin[2]
	];
	const dot = direction[0] * w0[0] + direction[1] * w0[1] + direction[2] * w0[2];
	const e = rayDirection[0] * w0[0] + rayDirection[1] * w0[1] + rayDirection[2] * w0[2];
	const travel = (b * e - dot) / denominator;
	return Number.isFinite(travel) ? travel : null;
}
