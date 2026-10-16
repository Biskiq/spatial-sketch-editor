/**
 * The viewport's pure linear-algebra kernel.
 *
 * One small, dependency-free set of vector/matrix primitives so the projection
 * authority (`./viewport`) has no renderer, Svelte or Three dependency — the
 * Stage realises these matrices, it never computes its own.
 *
 * **Convention, stated once.** Matrices are 16-number **column-major** arrays
 * (`m[column * 4 + row]`), applied to column vectors (`m · v`), in a
 * **right-handed** project convention with **+Y up** and **X/Z horizontal**,
 * meters throughout. The camera looks down its own **−Z**. `lookAtMatrix` and the
 * two projection builders follow that convention exactly, so
 * `projectionMatrix · viewMatrix · point` is the whole chain.
 */

import type { Vec3 } from './scene-types';

export const MATRIX_ELEMENTS = 16;

export function addVec3(left: Vec3, right: Vec3): Vec3 {
	return [left[0] + right[0], left[1] + right[1], left[2] + right[2]];
}

export function subtractVec3(left: Vec3, right: Vec3): Vec3 {
	return [left[0] - right[0], left[1] - right[1], left[2] - right[2]];
}

export function scaleVec3(vector: Vec3, factor: number): Vec3 {
	return [vector[0] * factor, vector[1] * factor, vector[2] * factor];
}

export function dotVec3(left: Vec3, right: Vec3): number {
	return left[0] * right[0] + left[1] * right[1] + left[2] * right[2];
}

export function crossVec3(left: Vec3, right: Vec3): Vec3 {
	return [
		left[1] * right[2] - left[2] * right[1],
		left[2] * right[0] - left[0] * right[2],
		left[0] * right[1] - left[1] * right[0]
	];
}

export function lengthVec3(vector: Vec3): number {
	return Math.hypot(vector[0], vector[1], vector[2]);
}

/** Normalize, or `null` when the vector has no direction (never return a silent zero). */
export function normalizeVec3(vector: Vec3): Vec3 | null {
	const length = lengthVec3(vector);
	if (!Number.isFinite(length) || length === 0) return null;
	return [vector[0] / length, vector[1] / length, vector[2] / length];
}

export function lerpVec3(from: Vec3, to: Vec3, amount: number): Vec3 {
	return [
		from[0] + (to[0] - from[0]) * amount,
		from[1] + (to[1] - from[1]) * amount,
		from[2] + (to[2] - from[2]) * amount
	];
}

export function lerpNumber(from: number, to: number, amount: number): number {
	return from + (to - from) * amount;
}

/** `true` for a finite three-number vector. */
export function isFiniteVec3(value: unknown): value is Vec3 {
	return (
		Array.isArray(value) &&
		value.length === 3 &&
		value.every((entry) => typeof entry === 'number' && Number.isFinite(entry))
	);
}

/** `true` for a finite 16-number matrix. */
export function isFiniteMatrix(value: unknown): value is readonly number[] {
	return (
		Array.isArray(value) &&
		value.length === MATRIX_ELEMENTS &&
		value.every((entry) => typeof entry === 'number' && Number.isFinite(entry))
	);
}

/**
 * Right-handed look-at, column-major.
 *
 * Returns `null` for a degenerate basis (eye == target, or `up` parallel to the
 * view direction): a caller that would divide by zero gets an explicit refusal
 * instead of a matrix full of NaN.
 */
export function lookAtMatrix(eye: Vec3, target: Vec3, up: Vec3): number[] | null {
	const backward = normalizeVec3(subtractVec3(eye, target));
	if (backward === null) return null;
	const right = normalizeVec3(crossVec3(up, backward));
	if (right === null) return null;
	const trueUp = crossVec3(backward, right);
	return [
		right[0], trueUp[0], backward[0], 0,
		right[1], trueUp[1], backward[1], 0,
		right[2], trueUp[2], backward[2], 0,
		-dotVec3(right, eye), -dotVec3(trueUp, eye), -dotVec3(backward, eye), 1
	];
}

/** Right-handed perspective, column-major. `tanHalfFovY` is `tan(fovY / 2)`. */
export function perspectiveMatrix(tanHalfFovY: number, aspect: number, near: number, far: number): number[] {
	const f = 1 / tanHalfFovY;
	return [
		f / aspect, 0, 0, 0,
		0, f, 0, 0,
		0, 0, (far + near) / (near - far), -1,
		0, 0, (2 * far * near) / (near - far), 0
	];
}

/** Right-handed orthographic, column-major, from the target-plane half extents. */
export function orthographicMatrix(halfHeight: number, aspect: number, near: number, far: number): number[] {
	const halfWidth = halfHeight * aspect;
	return [
		1 / halfWidth, 0, 0, 0,
		0, 1 / halfHeight, 0, 0,
		0, 0, -2 / (far - near), 0,
		0, 0, -(far + near) / (far - near), 1
	];
}

/** `left · right`, column-major: applying the product to a vector applies `right` first. */
export function multiplyMatrices(left: readonly number[], right: readonly number[]): number[] {
	const out = new Array<number>(MATRIX_ELEMENTS).fill(0);
	for (let column = 0; column < 4; column += 1) {
		for (let row = 0; row < 4; row += 1) {
			let sum = 0;
			for (let index = 0; index < 4; index += 1) {
				sum += left[index * 4 + row]! * right[column * 4 + index]!;
			}
			out[column * 4 + row] = sum;
		}
	}
	return out;
}

/**
 * General 4x4 inverse, column-major. Returns `null` for a singular matrix rather
 * than a matrix of infinities: a singular projection is a provider defect the
 * caller must see.
 */
export function invertMatrix(matrix: readonly number[]): number[] | null {
	const a00 = matrix[0]!;
	const a01 = matrix[1]!;
	const a02 = matrix[2]!;
	const a03 = matrix[3]!;
	const a10 = matrix[4]!;
	const a11 = matrix[5]!;
	const a12 = matrix[6]!;
	const a13 = matrix[7]!;
	const a20 = matrix[8]!;
	const a21 = matrix[9]!;
	const a22 = matrix[10]!;
	const a23 = matrix[11]!;
	const a30 = matrix[12]!;
	const a31 = matrix[13]!;
	const a32 = matrix[14]!;
	const a33 = matrix[15]!;

	const b00 = a00 * a11 - a01 * a10;
	const b01 = a00 * a12 - a02 * a10;
	const b02 = a00 * a13 - a03 * a10;
	const b03 = a01 * a12 - a02 * a11;
	const b04 = a01 * a13 - a03 * a11;
	const b05 = a02 * a13 - a03 * a12;
	const b06 = a20 * a31 - a21 * a30;
	const b07 = a20 * a32 - a22 * a30;
	const b08 = a20 * a33 - a23 * a30;
	const b09 = a21 * a32 - a22 * a31;
	const b10 = a21 * a33 - a23 * a31;
	const b11 = a22 * a33 - a23 * a32;

	let determinant = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
	if (!Number.isFinite(determinant) || determinant === 0) return null;
	determinant = 1 / determinant;

	return [
		(a11 * b11 - a12 * b10 + a13 * b09) * determinant,
		(a02 * b10 - a01 * b11 - a03 * b09) * determinant,
		(a31 * b05 - a32 * b04 + a33 * b03) * determinant,
		(a22 * b04 - a21 * b05 - a23 * b03) * determinant,
		(a12 * b08 - a10 * b11 - a13 * b07) * determinant,
		(a00 * b11 - a02 * b08 + a03 * b07) * determinant,
		(a32 * b02 - a30 * b05 - a33 * b01) * determinant,
		(a20 * b05 - a22 * b02 + a23 * b01) * determinant,
		(a10 * b10 - a11 * b08 + a13 * b06) * determinant,
		(a01 * b08 - a00 * b10 - a03 * b06) * determinant,
		(a30 * b04 - a31 * b02 + a33 * b00) * determinant,
		(a21 * b02 - a20 * b04 - a23 * b00) * determinant,
		(a11 * b07 - a10 * b09 - a12 * b06) * determinant,
		(a00 * b09 - a01 * b07 + a02 * b06) * determinant,
		(a31 * b01 - a30 * b03 - a32 * b00) * determinant,
		(a20 * b03 - a21 * b01 + a22 * b00) * determinant
	];
}

/** Apply a column-major matrix to a point (implicit `w = 1`) and return all four components. */
export function transformPoint(matrix: readonly number[], point: Vec3): [number, number, number, number] {
	const [x, y, z] = point;
	return [
		matrix[0]! * x + matrix[4]! * y + matrix[8]! * z + matrix[12]!,
		matrix[1]! * x + matrix[5]! * y + matrix[9]! * z + matrix[13]!,
		matrix[2]! * x + matrix[6]! * y + matrix[10]! * z + matrix[14]!,
		matrix[3]! * x + matrix[7]! * y + matrix[11]! * z + matrix[15]!
	];
}

/** Minimal orthonormal screen basis for the current view: screen right and screen up in project world. */
export function viewScreenBasis(eye: Vec3, target: Vec3, up: Vec3): { right: Vec3; up: Vec3 } | null {
	const backward = normalizeVec3(subtractVec3(eye, target));
	if (backward === null) return null;
	const right = normalizeVec3(crossVec3(up, backward));
	if (right === null) return null;
	return { right, up: crossVec3(backward, right) };
}
