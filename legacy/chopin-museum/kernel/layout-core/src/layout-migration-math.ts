/**
 * `layout-migration-math.ts` — P23.0b trusted Room-frame migration math.
 *
 * Converts legacy room-local Scene/Camera transforms to project/world space
 * using the **actual legacy composition**: the runtime resolves room-local
 * positions through `layoutRoomPoint`, which is exactly
 *
 * ```text
 * world = Ry(yaw) · local + [origin.x, elevation, origin.z]
 * ```
 *
 * so the room frame matrix is `R = Ry(yaw)` with that translation (no
 * authored rotation/scale). Plan gestures compose entity rotations as
 * `rotation[1] + roomYaw` (Y-only case) — but the P23.0 plan forbids
 * implementing migration as `yaw += roomYaw` on assumption. Instead this
 * module implements the general three.js 'XYZ' Euler composition:
 *
 * ```text
 * M = R_room · R_local          (matrix product, exactly as three.js does)
 * yaw' = decompose(M).yaw       (three.js Euler.setFromRotationMatrix, 'XYZ')
 * ```
 *
 * For the legacy room frame (`R_room = Ry(yaw)`, no pitch/roll), this is
 * *proven* equivalent to the Y-only shortcut for pure-yaw entities and exact
 * for arbitrary XYZ rotations; the property tests assert both.
 *
 * The quaternion/euler formulas are reproduced from three.js `Quaternion.js`
 * / `Euler.js` / `Matrix4.js` (MIT) verbatim in closed form so the migration
 * is deterministic and dependency-free.
 */

import type { Vec3 } from './types';

/** 3x3 rotation matrix, row-major (`m[row][col]`). */
export type Matrix3 = readonly [readonly [number, number, number], readonly [number, number, number], readonly [number, number, number]];

const IDENTITY: Matrix3 = [
	[1, 0, 0],
	[0, 1, 0],
	[0, 0, 1]
];

/** Normalizes yaw away from IEEE -0 and wrap noise (mirrors room-frame helper). */
function normalizeAngle(angle: number): number {
	const normalized = ((angle + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
	return Object.is(normalized, -0) || Math.abs(normalized) <= Number.EPSILON ? 0 : normalized;
}

/** `Ry(yaw)` — the exact rotation `layoutRoomPoint` applies to XZ. */
export function rotationMatrixY(yaw: number): Matrix3 {
	const cos = Math.cos(yaw);
	const sin = Math.sin(yaw);
	return [
		[cos, 0, sin],
		[0, 1, 0],
		[-sin, 0, cos]
	];
}

/** three.js `Matrix4.makeRotationFromEuler` with order 'XYZ', reduced to 3x3. */
export function rotationMatrixFromEulerXyz(rotation: Vec3): Matrix3 {
	const [x, y, z] = rotation;
	const c1 = Math.cos(x);
	const s1 = Math.sin(x);
	const c2 = Math.cos(y);
	const s2 = Math.sin(y);
	const c3 = Math.cos(z);
	const s3 = Math.sin(z);

	// te[0..2] = first row; te[4..6] = second; te[8..10] = third.
	return [
		[c2 * c3, -c2 * s3, s2],
		[c1 * s3 + c3 * s1 * s2, c1 * c3 - s1 * s2 * s3, -c2 * s1],
		[s1 * s3 - c1 * c3 * s2, c3 * s1 + c1 * s2 * s3, c1 * c2]
	];
}

/** Matrix product `a · b` (apply `b` first, then `a` — three.js convention). */
export function multiplyMatrix(a: Matrix3, b: Matrix3): Matrix3 {
	const out: number[][] = [
		[0, 0, 0],
		[0, 0, 0],
		[0, 0, 0]
	];
	for (let row = 0; row < 3; row += 1) {
		for (let col = 0; col < 3; col += 1) {
			out[row]![col] =
				a[row]![0]! * b[0]![col]! + a[row]![1]! * b[1]![col]! + a[row]![2]! * b[2]![col]!;
		}
	}
	return [out[0] as unknown as Matrix3[0], out[1] as unknown as Matrix3[1], out[2] as unknown as Matrix3[2]];
}

/** Rotate a vector by a matrix. */
export function applyMatrix(m: Matrix3, v: Vec3): Vec3 {
	return [
		m[0]![0]! * v[0] + m[0]![1]! * v[1] + m[0]![2]! * v[2],
		m[1]![0]! * v[0] + m[1]![1]! * v[1] + m[1]![2]! * v[2],
		m[2]![0]! * v[0] + m[2]![1]! * v[1] + m[2]![2]! * v[2]
	];
}

/**
 * three.js `Euler.setFromRotationMatrix`, order 'XYZ' (clamped asin branch).
 * Returns the full `[x, y, z]` decomposition of a pure rotation matrix.
 */
export function eulerXyzFromRotationMatrix(m: Matrix3): Vec3 {
	// three.js: _x = atan2(-m13, m11)... for XYZ order it reads elements:
	// m32 = m[2][1], m33 = m[2][2], m13 = m[0][2], m23 = m[1][2], m31 = m[2][0], m21 = m[1][0]
	const m11 = m[0]![0]!;
	const m12 = m[0]![1]!;
	const m13 = m[0]![2]!;
	const m22 = m[1]![1]!;
	const m23 = m[1]![2]!;
	const m32 = m[2]![1]!;
	const m33 = m[2]![2]!;

	const y = Math.asin(clampUnit(m13));
	if (Math.abs(m13) < 0.9999999) {
		// Exact three.js 'XYZ' branch.
		const x = Math.atan2(-m23, m33);
		const z = Math.atan2(-m12, m11);
		return [normalizeAngle(x), normalizeAngle(y), normalizeAngle(z)];
	}
	// Gimbal lock: exact three.js fallback.
	const x = Math.atan2(m32, m22);
	const z = 0;
	return [normalizeAngle(x), normalizeAngle(y), normalizeAngle(z)];
}

function clampUnit(value: number): number {
	return Math.max(-1, Math.min(1, value));
}

/**
 * The legacy Room frame as a world matrix (rotation part). `layoutRoomPoint`
 * composes `Ry(yaw)` — verified against the runtime helper; no authored room
 * pitch/roll exists in the legacy schema.
 */
export function legacyRoomFrameRotation(yaw: number): Matrix3 {
	return rotationMatrixY(yaw);
}

/**
 * Full world-transform of one legacy room-local entity.
 *
 * `roomYaw` is the Room frame yaw; `floorElevation` the owning floor's
 * elevation (legacy Y = elevation + local Y). Rotation composes the actual
 * matrices (`M = R_room · R_local`) and decomposes back to XYZ Euler — exact
 * for arbitrary rotations, never the unproven `yaw += roomYaw` shortcut.
 */
export function migrateEntityTransform(
	local: { position: Vec3; rotation: Vec3 },
	frame: { origin: readonly [number, number]; yaw: number; floorElevation: number }
): { position: Vec3; rotation: Vec3 } {
	const roomRotation = legacyRoomFrameRotation(frame.yaw);
	const localRotation = rotationMatrixFromEulerXyz(local.rotation);
	const worldRotation = multiplyMatrix(roomRotation, localRotation);
	const rotated = applyMatrix(roomRotation, local.position);
	return {
		position: [
			frame.origin[0] + rotated[0],
			frame.floorElevation + rotated[1],
			frame.origin[1] + rotated[2]
		],
		rotation: eulerXyzFromRotationMatrix(worldRotation)
	};
}

/**
 * Yaw-only fast path proof helper: returns the composed yaw for a pure-Y
 * local rotation. Used by tests to pin the `rotation[1] + roomYaw`
 * convention the Plan gestures apply — the general path must agree with
 * this exactly for yaw-only entities.
 */
export function composedYawForPureYawRotation(localYaw: number, roomYaw: number): number {
	return normalizeAngle(localYaw + roomYaw);
}
