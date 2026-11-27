/**
 * T2.G1a — the rigid helper probe.
 *
 * The riskiest G1a assumption is that a group Turn can compose a Scene rotation
 * without `three` and still agree with the renderer. This suite runs before any
 * planner consumes the helper and proves it on rotation matrices and forward
 * vectors — never Euler components, which are a representation and not truth.
 */
import { describe, expect, it } from 'vitest';
import {
	eulerXyzFromMatrix,
	eulerXyzToMatrix,
	multiplyRotationMatrices,
	rigidPivot,
	rigidTurnPosition,
	rigidTurnRotation,
	rigidYawAdd,
	rotationForwardVector,
	turnPointAboutPivot,
	yawMatrix,
	type RotationMatrix,
} from '../src/scene-planning/rigid';

const DEGREES = Math.PI / 180;
const TURNS = [90 * DEGREES, 37 * DEGREES, -0.8, Math.PI];

/** Deterministic pseudo-random rotations, so the property test is replayable. */
function seededRotations(count: number): Array<readonly [number, number, number]> {
	let state = 0x5eed1234;
	const next = () => {
		state = (state * 1664525 + 1013904223) >>> 0;
		return state / 0x100000000;
	};
	const rotations: Array<readonly [number, number, number]> = [];
	for (let index = 0; index < count; index += 1) {
		rotations.push([
			(next() * 2 - 1) * Math.PI,
			(next() * 2 - 1) * Math.PI,
			(next() * 2 - 1) * Math.PI,
		]);
	}
	return rotations;
}

/** Spot aims that stress the decomposition: straight down, straight up and both gimbal branches. */
const AIMED_ROTATIONS: Array<readonly [number, number, number]> = [
	[0, 0, 0],
	[-Math.PI / 2, 0, 0],
	[Math.PI / 2, 0, 0],
	[-Math.PI / 2, 0.7, 0.3],
	[Math.PI / 2, -0.4, -0.9],
	[0, Math.PI / 2, 0],
	[0.25, 1.1, -0.35],
	[-0.6, -2.2, 0.8],
];

function expectMatrixClose(actual: RotationMatrix, expected: RotationMatrix, precision = 14) {
	for (let row = 0; row < 3; row += 1) {
		for (let column = 0; column < 3; column += 1) {
			expect(actual[row]![column]!).toBeCloseTo(expected[row]![column]!, precision);
		}
	}
}

describe('rigid group pose — probe', () => {
	it('matches the renderer’s Euler XYZ matrix convention', () => {
		// Values from `three`'s Matrix4.makeRotationFromEuler(new Euler(0.3, -0.7, 1.1, 'XYZ')).
		const matrix = eulerXyzToMatrix([0.3, -0.7, 1.1]);
		expect(matrix[0][0]).toBeCloseTo(0.34692944965489897, 14);
		expect(matrix[0][1]).toBeCloseTo(-0.681632986593423, 14);
		expect(matrix[0][2]).toBeCloseTo(-0.644217687237691, 14);
		expect(matrix[1][0]).toBeCloseTo(0.7650475783754858, 14);
		expect(matrix[1][1]).toBeCloseTo(0.6030043987602139, 14);
		expect(matrix[1][2]).toBeCloseTo(-0.22602632124962302, 14);
		expect(matrix[2][0]).toBeCloseTo(0.5425330955655644, 14);
		expect(matrix[2][1]).toBeCloseTo(-0.41444199432919854, 14);
		expect(matrix[2][2]).toBeCloseTo(0.7306816499355124, 14);
	});

	it('round-trips every spot aim and property rotation through Ry·R and Euler XYZ', () => {
		const rotations = [...AIMED_ROTATIONS, ...seededRotations(64)];
		for (const rotation of rotations) {
			for (const turn of TURNS) {
				const composed = multiplyRotationMatrices(yawMatrix(turn), eulerXyzToMatrix(rotation));
				const next = rigidTurnRotation(rotation, turn);
				const roundTrip = eulerXyzToMatrix(next);
				for (let row = 0; row < 3; row += 1) {
					for (let column = 0; column < 3; column += 1) {
						expect(
							Math.abs(roundTrip[row]![column]! - composed[row]![column]!),
							`rotation ${rotation.join(',')} turn ${turn} component ${row},${column}`,
						).toBeLessThan(1e-12);
					}
				}
			}
		}
	});

	it('keeps every Euler XYZ matrix orthonormal and its forward vector rigid', () => {
		const rotations = [...AIMED_ROTATIONS, ...seededRotations(32)];
		for (const rotation of rotations) {
			for (const turn of TURNS) {
				const composed = multiplyRotationMatrices(yawMatrix(turn), eulerXyzToMatrix(rotation));
				const next = rigidTurnRotation(rotation, turn);
				const nextMatrix = eulerXyzToMatrix(next);
				const forward = rotationForwardVector(rotation);
				const turnedForward = rotationForwardVector(next);
				const rotatedForward = applyMatrix(composed, [0, 0, -1]);
				expect(Math.hypot(...forward)).toBeCloseTo(1, 12);
				expect(Math.hypot(...turnedForward)).toBeCloseTo(1, 12);
				for (let axis = 0; axis < 3; axis += 1) {
					expect(turnedForward[axis]!).toBeCloseTo(rotatedForward[axis]!, 12);
					// Each matrix row is a unit basis image.
					expect(Math.hypot(...nextMatrix[axis]!)).toBeCloseTo(1, 12);
				}
				// The forward direction is the same rigid image whether read as a
				// vector or rotated as a point at unit distance.
				const position: [number, number, number] = [2.5, 4, -1.5];
				const pivot = rigidPivot([position])!;
				const target = [
					position[0] + forward[0] * 3,
					position[1] + forward[1] * 3,
					position[2] + forward[2] * 3,
				] as const;
				const turnedPosition = rigidTurnPosition(position, pivot, turn);
				const turnedTarget = rigidTurnPosition(target, pivot, turn);
				for (let axis = 0; axis < 3; axis += 1) {
					expect(turnedTarget[axis]!).toBeCloseTo(
						turnedPosition[axis]! + turnedForward[axis]! * 3,
						10,
					);
				}
			}
		}
	});

	it('keeps an upright floor object’s yaw add exact and its pitch/roll untouched', () => {
		// A pure yaw is exactly Ry·R: the two composition rules agree when the
		// object has no pitch or roll to preserve.
		for (const rotation of [[0, 0.4, 0], [0, -3.2, 0]] as const) {
			for (const turn of TURNS) {
				const yawAdded = rigidYawAdd(rotation, turn);
				expect(yawAdded[0]).toBe(rotation[0]);
				expect(yawAdded[2]).toBe(rotation[2]);
				expectMatrixClose(
					eulerXyzToMatrix(yawAdded),
					multiplyRotationMatrices(yawMatrix(turn), eulerXyzToMatrix(rotation)),
					14,
				);
			}
		}
		// A sub-tolerance pitch/roll is carried byte-for-byte rather than rewritten.
		// Ry does not commute with Rx/Rz, so the exact-yaw rule differs from Ry·R by
		// no more than the upright tolerance it is allowed to preserve.
		const tilted: [number, number, number] = [5e-10, 2.9, -5e-10];
		const yawAdded = rigidYawAdd(tilted, 37 * DEGREES);
		expect(yawAdded).toEqual([5e-10, 2.9 + 37 * DEGREES, -5e-10]);
		const difference = multiplyRotationMatrices(
			yawMatrix(37 * DEGREES),
			eulerXyzToMatrix(tilted),
		);
		const added = eulerXyzToMatrix(yawAdded);
		for (let row = 0; row < 3; row += 1) {
			for (let column = 0; column < 3; column += 1) {
				expect(Math.abs(added[row]![column]! - difference[row]![column]!)).toBeLessThan(2e-9);
			}
		}
	});

	it('rotates positions about the centre of the XZ extent and never changes Y', () => {
		const positions: Array<readonly [number, number, number]> = [
			[0, 1, 0],
			[4, 2, 0],
			[4, 3, 2],
			[0, 4, 2],
		];
		const pivot = rigidPivot(positions);
		expect(pivot).toEqual({ x: 2, z: 1 });
		for (const turn of TURNS) {
			for (const position of positions) {
				const turned = rigidTurnPosition(position, pivot!, turn);
				expect(turned[1]).toBe(position[1]);
				// Rigidity: every pairwise distance is preserved exactly enough.
				for (const other of positions) {
					const otherTurned = rigidTurnPosition(other, pivot!, turn);
					const before = Math.hypot(
						position[0] - other[0],
						position[1] - other[1],
						position[2] - other[2],
					);
					const after = Math.hypot(
						turned[0] - otherTurned[0],
						turned[1] - otherTurned[1],
						turned[2] - otherTurned[2],
					);
					expect(after).toBeCloseTo(before, 12);
				}
			}
		}
		expect(turnPointAboutPivot([5, 1], pivot!, 0)).toEqual([5, 1]);
	});

	it('returns the stored rotation unchanged for a zero Turn', () => {
		const rotation: [number, number, number] = [0.2, -1.4, 0.9];
		expect(rigidTurnRotation(rotation, 0)).toEqual(rotation);
		expect(eulerXyzFromMatrix(eulerXyzToMatrix(rotation))).not.toBe(rotation);
	});
});

function applyMatrix(
	matrix: RotationMatrix,
	vector: readonly [number, number, number],
): [number, number, number] {
	return [
		matrix[0][0] * vector[0] + matrix[0][1] * vector[1] + matrix[0][2] * vector[2],
		matrix[1][0] * vector[0] + matrix[1][1] * vector[1] + matrix[1][2] * vector[2],
		matrix[2][0] * vector[0] + matrix[2][1] * vector[1] + matrix[2][2] * vector[2],
	];
}
