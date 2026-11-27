/**
 * Rigid group pose math.
 *
 * A group is rigid: a Move translates every member, a Turn rotates every member
 * about one pivot, and nothing is re-grounded. This module is pure and
 * runtime-safe — it imports no `three` — but its Euler convention is the
 * renderer's own: a Scene `rotation` is Euler XYZ, evaluated exactly as
 * `three`'s `Euler(x, y, z, 'XYZ')`, and a Turn pre-multiplies that rotation by
 * `Ry(θ)`.
 *
 * Two composition rules are deliberately separate:
 *
 * - An **upright floor object** adds the Turn angle to its stored yaw and keeps
 *   its sub-tolerance pitch and roll byte-for-byte, exactly as `set-yaw` does.
 * - A **light or Artwork** rotates by `Ry(θ)·R` and decomposes back to Euler
 *   XYZ. The decomposition stays on the stable branch through the near-singular
 *   band, where the third column still determines pitch and aim; inside the last
 *   `1e-8` of the singularity a declared branch reconstructs the rotation to the
 *   same tolerance, because there the recovered roll is cancellation-dominated.
 *
 * Tests compare matrices and forward vectors, never Euler components: two
 * Euler triples may describe the same rotation, and only the rotation is truth.
 */
import type { Vec3 } from '../scene';

export type RotationMatrix = readonly [
	readonly [number, number, number],
	readonly [number, number, number],
	readonly [number, number, number],
];

/** A rotation or position the rigid helper reads; it never mutates its input. */
export type RigidVec3 = readonly [number, number, number];

/**
 * The third-column pair length below which the recovered roll is dominated by
 * cancellation in the composed entries. The declared singular branch's
 * `O(cos y)` error and the stable branch's `1 / cos y` conditioning are both
 * under 1e-8 at this boundary, so every pose stays far inside the rigid-pose
 * tolerance.
 */
const NEAR_SINGULAR_COS_Y = 1e-8;

/** The XZ centre of the members' horizontal extent: the group Turn pivot (G-5). */
export function rigidPivot(
	positions: readonly RigidVec3[],
): { readonly x: number; readonly z: number } | null {
	let minX = Infinity;
	let maxX = -Infinity;
	let minZ = Infinity;
	let maxZ = -Infinity;
	for (const position of positions) {
		if (!position.every(Number.isFinite)) return null;
		minX = Math.min(minX, position[0]);
		maxX = Math.max(maxX, position[0]);
		minZ = Math.min(minZ, position[2]);
		maxZ = Math.max(maxZ, position[2]);
	}
	if (!Number.isFinite(minX) || !Number.isFinite(minZ)) return null;
	return { x: (minX + maxX) / 2, z: (minZ + maxZ) / 2 };
}

/** Rotate one world X/Z point about the pivot by `yaw` radians about world +Y. */
export function turnPointAboutPivot(
	point: readonly [number, number],
	pivot: { readonly x: number; readonly z: number },
	yaw: number,
): [number, number] {
	const cos = Math.cos(yaw);
	const sin = Math.sin(yaw);
	const x = point[0] - pivot.x;
	const z = point[1] - pivot.z;
	return [pivot.x + cos * x + sin * z, pivot.z - sin * x + cos * z];
}

/**
 * The rigid image of one member's position under a group Move: a pure
 * translation with Y preserved.
 */
export function rigidMovePosition(position: RigidVec3, delta: readonly [number, number]): Vec3 {
	return [position[0] + delta[0], position[1], position[2] + delta[1]];
}

/**
 * The rigid image of one member's position under a group Turn: rotate X/Z about
 * the pivot, keep Y exactly.
 */
export function rigidTurnPosition(
	position: RigidVec3,
	pivot: { readonly x: number; readonly z: number },
	yaw: number,
): Vec3 {
	const [x, z] = turnPointAboutPivot([position[0], position[2]], pivot, yaw);
	return [x, position[1], z];
}

/** The exact yaw add an upright floor object uses; pitch and roll are carried unchanged. */
export function rigidYawAdd(rotation: RigidVec3, yaw: number): Vec3 {
	return [rotation[0], rotation[1] + yaw, rotation[2]];
}

/**
 * `Ry(θ)·R` for a light or Artwork, decomposed back to Euler XYZ.
 *
 * `yaw === 0` returns the stored rotation unchanged, so a no-op Turn cannot
 * introduce a floating-point rewrite that F4 would treat as an edit.
 */
export function rigidTurnRotation(rotation: RigidVec3, yaw: number): Vec3 {
	if (yaw === 0) return [rotation[0], rotation[1], rotation[2]];
	if (!rotation.every(Number.isFinite) || !Number.isFinite(yaw)) {
		return [rotation[0], rotation[1], rotation[2]];
	}
	const composed = multiplyRotationMatrices(yawMatrix(yaw), eulerXyzToMatrix(rotation));
	return eulerXyzFromMatrix(composed);
}

/** `R` for Euler XYZ, matching `three`'s `Matrix4.makeRotationFromEuler(order: 'XYZ')`. */
export function eulerXyzToMatrix(rotation: RigidVec3): RotationMatrix {
	const a = Math.cos(rotation[0]);
	const b = Math.sin(rotation[0]);
	const c = Math.cos(rotation[1]);
	const d = Math.sin(rotation[1]);
	const e = Math.cos(rotation[2]);
	const f = Math.sin(rotation[2]);
	const ae = a * e;
	const af = a * f;
	const be = b * e;
	const bf = b * f;
	return [
		[c * e, -c * f, d],
		[af + be * d, ae - bf * d, -b * c],
		[bf - ae * d, be + af * d, a * c],
	];
}

/**
 * Euler XYZ for a rotation matrix, on the stable branch everywhere except the
 * exact gimbal singularity.
 *
 * For a rotation, `cos(y)` is the length of the third column pair
 * `(m₁₂, m₂₂)`, so `atan2(m₀₂, cos y)` recovers pitch without the saturation
 * `asin(m₀₂)` suffers near ±1. The third column then fixes `x` and `y`, and the
 * first two columns fix `z`: a near-gimbal rotation is recovered rather than
 * flattened to a declared roll of zero, so a light keeps its aim and an Artwork
 * its orientation. Once `cos y` is small enough that the recovered roll is
 * dominated by the cancellation of those entries, the declared `|m₀₂| ≈ 1`
 * branch is used instead: `z` is zero and `x` comes from the remaining column
 * pair, which reconstructs the rotation to `O(cos y)`. The returned matrix is
 * the same rotation in both cases.
 */
export function eulerXyzFromMatrix(matrix: RotationMatrix): Vec3 {
	const m02 = matrix[0][2];
	const cosY = Math.hypot(matrix[1][2], matrix[2][2]);
	const y = Math.atan2(m02, cosY);
	if (cosY > NEAR_SINGULAR_COS_Y) {
		return [Math.atan2(-matrix[1][2], matrix[2][2]), y, Math.atan2(-matrix[0][1], matrix[0][0])];
	}
	return [Math.atan2(matrix[2][1], matrix[1][1]), y, 0];
}

/** The one world-Y rotation matrix used by Turn. */
export function yawMatrix(yaw: number): RotationMatrix {
	const cos = Math.cos(yaw);
	const sin = Math.sin(yaw);
	return [
		[cos, 0, sin],
		[0, 1, 0],
		[-sin, 0, cos],
	];
}

export function multiplyRotationMatrices(
	left: RotationMatrix,
	right: RotationMatrix,
): RotationMatrix {
	return [
		[
			left[0][0] * right[0][0] + left[0][1] * right[1][0] + left[0][2] * right[2][0],
			left[0][0] * right[0][1] + left[0][1] * right[1][1] + left[0][2] * right[2][1],
			left[0][0] * right[0][2] + left[0][1] * right[1][2] + left[0][2] * right[2][2],
		],
		[
			left[1][0] * right[0][0] + left[1][1] * right[1][0] + left[1][2] * right[2][0],
			left[1][0] * right[0][1] + left[1][1] * right[1][1] + left[1][2] * right[2][1],
			left[1][0] * right[0][2] + left[1][1] * right[1][2] + left[1][2] * right[2][2],
		],
		[
			left[2][0] * right[0][0] + left[2][1] * right[1][0] + left[2][2] * right[2][0],
			left[2][0] * right[0][1] + left[2][1] * right[1][1] + left[2][2] * right[2][1],
			left[2][0] * right[0][2] + left[2][1] * right[1][2] + left[2][2] * right[2][2],
		],
	];
}

/**
 * The direction a Spot light emits: local −Z through Euler XYZ.
 *
 * A Spot aims down its local −Z, exactly as the renderer places it; this helper
 * exists so a Turn's rigid target can be checked against the same convention.
 */
export function rotationForwardVector(rotation: RigidVec3): Vec3 {
	const matrix = eulerXyzToMatrix(rotation);
	return [-matrix[0][2], -matrix[1][2], -matrix[2][2]];
}
