/**
 * T5.P01.S01 — the native-form render derivative.
 *
 * The kernel emits positions, indices and regions only; this adapter is where
 * normals and metre-scale UVs come from, so the tests pin exactly those:
 * positions survive as Float32, every normal is unit length, caps and sides use
 * their own metre mapping, and dispose is a real lease release.
 */
import { describe, expect, it, vi } from 'vitest';
import {
	evaluateProfile,
	extrudeProfile,
	type FormMesh
} from '@portfolio/geometry-core';
import { buildFormGeometry } from '$lib/museum/entities/form-geometry';
import type { SceneFormPlane } from '$lib/content/scene';

function unitSquareMesh(plane: SceneFormPlane, extent = 1): FormMesh {
	const outline = [
		{ key: 1, u: 0, v: 0, smooth: false },
		{ key: 2, u: 1, v: 0, smooth: false },
		{ key: 3, u: 1, v: 1, smooth: false },
		{ key: 4, u: 0, v: 1, smooth: false }
	];
	return extrudeProfile({
		profile: evaluateProfile(outline),
		extent,
		scale: [1, 1, 1],
		plane
	});
}

describe('buildFormGeometry', () => {
	it('carries positions and indices from the canonical mesh', () => {
		const mesh = unitSquareMesh('plan');
		const geometry = buildFormGeometry(mesh, 'plan');
		const position = geometry.getAttribute('position');
		expect(position.count).toBe(mesh.positions.length / 3);
		expect(position.array).toBeInstanceOf(Float32Array);
		for (let index = 0; index < mesh.positions.length; index += 1) {
			expect(position.array[index]).toBeCloseTo(mesh.positions[index]!, 6);
		}
		expect(geometry.getIndex()!.count).toBe(mesh.indices.length);
		geometry.dispose();
	});

	it('computes one unit normal per vertex', () => {
		const geometry = buildFormGeometry(unitSquareMesh('plan'), 'plan');
		const normal = geometry.getAttribute('normal');
		expect(normal.count).toBe(geometry.getAttribute('position').count);
		for (let vertex = 0; vertex < normal.count; vertex += 1) {
			const length = Math.hypot(normal.getX(vertex), normal.getY(vertex), normal.getZ(vertex));
			expect(length).toBeCloseTo(1, 5);
		}
		geometry.dispose();
	});

	it('uses metre UVs on a plan form: caps (x, z), sides arclength and height', () => {
		const mesh = unitSquareMesh('plan');
		const geometry = buildFormGeometry(mesh, 'plan');
		const uv = geometry.getAttribute('uv');
		const points = mesh.segmentKeys.length;
		const position = mesh.positions;

		// Both cap rings project their own local (x, z).
		for (let vertex = 0; vertex < points * 2; vertex += 1) {
			expect(uv.getX(vertex)).toBeCloseTo(position[vertex * 3]!, 6);
			expect(uv.getY(vertex)).toBeCloseTo(position[vertex * 3 + 2]!, 6);
		}

		// The unit square's perimeter is 4 m; side UVs run along it, one metre per
		// profile edge, and the vertical axis is the extrusion height in metres.
		const sideStart = points * 2;
		const uValues = new Set<number>();
		for (let vertex = sideStart; vertex < uv.count; vertex += 1) {
			const u = uv.getX(vertex);
			const v = uv.getY(vertex);
			expect(u).toBeGreaterThanOrEqual(0);
			expect(u).toBeLessThanOrEqual(4);
			expect([0, 1]).toContain(v);
			uValues.add(Number(u.toFixed(6)));
		}
		expect([...uValues].sort((left, right) => left - right)).toEqual([0, 1, 2, 3]);
		geometry.dispose();
	});

	it('uses metre UVs on an elevation form: caps (x, y), sides arclength and depth', () => {
		const mesh = unitSquareMesh('elevation', 0.5);
		const geometry = buildFormGeometry(mesh, 'elevation');
		const uv = geometry.getAttribute('uv');
		const points = mesh.segmentKeys.length;

		for (let vertex = 0; vertex < points * 2; vertex += 1) {
			expect(uv.getX(vertex)).toBeCloseTo(mesh.positions[vertex * 3]!, 6);
			expect(uv.getY(vertex)).toBeCloseTo(mesh.positions[vertex * 3 + 1]!, 6);
		}
		for (let vertex = points * 2; vertex < uv.count; vertex += 1) {
			expect([0, 0.5]).toContain(Number(uv.getY(vertex).toFixed(6)));
		}
		geometry.dispose();
	});

	it('walks side arclength through smooth samples without leaving the perimeter', () => {
		const outline = [
			{ key: 1, u: 0, v: 0, smooth: false },
			{ key: 2, u: 1, v: 0, smooth: true },
			{ key: 3, u: 1, v: 1, smooth: false }
		];
		const mesh = extrudeProfile({
			profile: evaluateProfile(outline),
			extent: 1,
			scale: [1, 1, 1],
			plane: 'plan'
		});
		const geometry = buildFormGeometry(mesh, 'plan');
		const uv = geometry.getAttribute('uv');
		const points = mesh.segmentKeys.length;
		const perimeter = 2 + Math.SQRT2;
		const uValues: number[] = [];
		let previous = -Infinity;
		for (let vertex = points * 2; vertex < uv.count; vertex += 1) {
			const u = uv.getX(vertex);
			expect(u).toBeGreaterThanOrEqual(0);
			expect(u).toBeLessThanOrEqual(perimeter + 1e-6);
			expect(u).toBeGreaterThanOrEqual(previous - 1e-6);
			previous = u;
			uValues.push(Number(u.toFixed(6)));
		}
		// One value per profile point: the smooth run adds samples, not repeats.
		expect(new Set(uValues).size).toBeGreaterThanOrEqual(points);
		expect([...new Set(uValues)].sort((a, b) => a - b)[0]).toBe(0);
		geometry.dispose();
	});

	it('releases through dispose exactly like any other owned geometry', () => {
		const geometry = buildFormGeometry(unitSquareMesh('plan'), 'plan');
		const released = vi.fn();
		geometry.addEventListener('dispose', released);
		geometry.dispose();
		expect(released).toHaveBeenCalledTimes(1);
	});

	it('refuses a mesh with no cap layout rather than drawing garbage', () => {
		const mesh = unitSquareMesh('plan');
		const truncated = { ...mesh, positions: mesh.positions.subarray(0, 9) };
		expect(() => buildFormGeometry(truncated, 'plan')).toThrow(/base and a top cap/);
	});
});
