/**
 * E7/R4 — primitive geometry parity.
 *
 * R4 replaces "build this primitive at its authored size" with "share one unit
 * buffer and scale the mesh". The drawn geometry must be the same, vertex for
 * vertex: positions, normals, UVs and indices. A uniform scale is compared
 * against the geometry the retired components built at size; a nonuniform scale
 * is compared against the correct normal transform (inverse transpose), which is
 * what Three applies to a scaled mesh.
 */
import { describe, expect, it } from 'vitest';
import {
	BoxGeometry,
	CylinderGeometry,
	Matrix3,
	Matrix4,
	PlaneGeometry,
	SphereGeometry,
	Vector3,
	type BufferGeometry
} from 'three';

type Drawn = { positions: number[]; normals: number[]; uvs: number[]; index: number[] };

function drawn(geometry: BufferGeometry, matrix: Matrix4, normalMatrix: Matrix3): Drawn {
	const position = geometry.getAttribute('position');
	const normal = geometry.getAttribute('normal');
	const uv = geometry.getAttribute('uv');
	const point = new Vector3();
	const direction = new Vector3();
	const positions: number[] = [];
	const normals: number[] = [];
	for (let index = 0; index < position.count; index += 1) {
		point.fromBufferAttribute(position, index).applyMatrix4(matrix);
		positions.push(point.x, point.y, point.z);
		direction.fromBufferAttribute(normal, index).applyMatrix3(normalMatrix).normalize();
		normals.push(direction.x, direction.y, direction.z);
	}
	return {
		positions,
		normals,
		uvs: Array.from(uv.array as Float32Array),
		index: Array.from(geometry.index?.array ?? [])
	};
}

function expectClose(actual: number[], expected: number[], precision = 5): void {
	expect(actual).toHaveLength(expected.length);
	for (let i = 0; i < actual.length; i += 1) expect(actual[i]!).toBeCloseTo(expected[i]!, precision);
}

/** The world transform a retained mesh applies: the authored scale, nothing else. */
function scaleMatrix(scale: readonly [number, number, number]): Matrix4 {
	return new Matrix4().makeScale(scale[0], scale[1], scale[2]);
}

describe('E7/R4 — unit geometry × scale draws the authored geometry', () => {
	it('box: 0.6 × 0.8 × 0.6 is the box the component built at size', () => {
		const scale = [0.6, 0.8, 0.6] as const;
		const matrix = scaleMatrix(scale);
		const parity = drawn(new BoxGeometry(1, 1, 1), matrix, new Matrix3().getNormalMatrix(matrix));
		const atSize = drawn(
			new BoxGeometry(scale[0], scale[1], scale[2]),
			new Matrix4(),
			new Matrix3().getNormalMatrix(new Matrix4())
		);
		expectClose(parity.positions, atSize.positions);
		expectClose(parity.normals, atSize.normals);
		expect(parity.uvs).toEqual(atSize.uvs);
		expect(parity.index).toEqual(atSize.index);
	});

	it('plane: 0.6 × 0.6 is the plane the component built at size', () => {
		const matrix = scaleMatrix([0.6, 0.6, 1]);
		const parity = drawn(new PlaneGeometry(1, 1), matrix, new Matrix3().getNormalMatrix(matrix));
		const atSize = drawn(new PlaneGeometry(0.6, 0.6), new Matrix4(), new Matrix3());
		expectClose(parity.positions, atSize.positions);
		expectClose(parity.normals, atSize.normals);
		expect(parity.uvs).toEqual(atSize.uvs);
		expect(parity.index).toEqual(atSize.index);
	});

	it('cylinder: r 0.25 × h 0.9 is the cylinder the component built at size', () => {
		const radius = 0.25;
		const height = 0.9;
		const matrix = scaleMatrix([radius * 2, height, radius * 2]);
		const parity = drawn(
			new CylinderGeometry(0.5, 0.5, 1, 32, 1),
			matrix,
			new Matrix3().getNormalMatrix(matrix)
		);
		const atSize = drawn(new CylinderGeometry(radius, radius, height, 32, 1), new Matrix4(), new Matrix3());
		expectClose(parity.positions, atSize.positions);
		expectClose(parity.normals, atSize.normals);
		expect(parity.uvs).toEqual(atSize.uvs);
		expect(parity.index).toEqual(atSize.index);
	});

	it('sphere: r 0.3 is the sphere the component built at size', () => {
		const radius = 0.3;
		const matrix = scaleMatrix([radius * 2, radius * 2, radius * 2]);
		const parity = drawn(
			new SphereGeometry(0.5, 32, 24),
			matrix,
			new Matrix3().getNormalMatrix(matrix)
		);
		const atSize = drawn(new SphereGeometry(radius, 32, 24), new Matrix4(), new Matrix3());
		expectClose(parity.positions, atSize.positions);
		expectClose(parity.normals, atSize.normals);
		expect(parity.uvs).toEqual(atSize.uvs);
		expect(parity.index).toEqual(atSize.index);
	});

	it('a nonuniform box keeps its six exact face normals', () => {
		const scale = [2, 0.25, 0.75] as const;
		const matrix = scaleMatrix(scale);
		const parity = drawn(new BoxGeometry(1, 1, 1), matrix, new Matrix3().getNormalMatrix(matrix));
		const normals = new Set<string>();
		for (let i = 0; i < parity.normals.length; i += 3) {
			normals.add(`${parity.normals[i]!.toFixed(5)},${parity.normals[i + 1]!.toFixed(5)},${parity.normals[i + 2]!.toFixed(5)}`);
		}
		// Scaling a box does not tilt a face: each normal stays an axis unit vector.
		expect(normals).toEqual(new Set(['1.00000,0.00000,0.00000', '-1.00000,0.00000,0.00000', '0.00000,1.00000,0.00000', '0.00000,-1.00000,0.00000', '0.00000,0.00000,1.00000', '0.00000,0.00000,-1.00000']));
		const positions = parity.positions;
		for (let i = 0; i < positions.length; i += 3) {
			expect(Math.abs(positions[i]!)).toBeCloseTo(1, 9);
			expect(Math.abs(positions[i + 1]!)).toBeCloseTo(0.125, 9);
			expect(Math.abs(positions[i + 2]!)).toBeCloseTo(0.375, 9);
		}
	});

	it('a nonuniform sphere transforms normals by the inverse transpose, not by the scale', () => {
		const scale = [2, 1, 0.5] as const;
		const matrix = scaleMatrix(scale);
		const geometry = new SphereGeometry(0.5, 8, 6);
		const parity = drawn(geometry, matrix, new Matrix3().getNormalMatrix(matrix));
		const normal = geometry.getAttribute('normal');
		const source = new Vector3();
		const expected = new Vector3();
		for (let vertex = 0; vertex < normal.count; vertex += 1) {
			source.fromBufferAttribute(normal, vertex);
			expected.set(source.x / scale[0], source.y / scale[1], source.z / scale[2]).normalize();
			expect(parity.normals[vertex * 3]!).toBeCloseTo(expected.x, 6);
			expect(parity.normals[vertex * 3 + 1]!).toBeCloseTo(expected.y, 6);
			expect(parity.normals[vertex * 3 + 2]!).toBeCloseTo(expected.z, 6);
			// Unit length: a mesh with a nonuniform scale must not shade with a
			// stretched normal.
			expect(Math.hypot(parity.normals[vertex * 3]!, parity.normals[vertex * 3 + 1]!, parity.normals[vertex * 3 + 2]!)).toBeCloseTo(1, 6);
		}
	});
});
