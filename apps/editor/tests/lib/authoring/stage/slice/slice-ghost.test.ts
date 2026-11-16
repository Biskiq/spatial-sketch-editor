/**
 * SL1 tests 2, 9 and 11 — the reading, the snapshot seam and the selection ink — plus
 * the ghost rule's own catalogue (test 15).
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { describe, expect, it, vi } from 'vitest';
import type { LineMaterial, Material } from 'three';
import { createStageClip, materialUsesClip } from '$lib/authoring/stage/slice/stage-clip';
import { subjectWhollyHidden, type SliceGhostSubject } from '$lib/authoring/stage/slice/slice-ghost';

function path(...segments: string[]): string {
	const require = createRequire(import.meta.url);
	return require.resolve(segments.join('/'));
}

describe('snapshot seam (test 9)', () => {
	it('is a no-op inside the callback and restores afterwards', () => {
		const clip = createStageClip();
		clip.apply({ kind: 'level', cutY: 1.2, lowerY: 0.5 });
		const captured = clip.planes.map((plane) => plane.clone());
		const inside = clip.asBuilt(() => clip.planes.map((plane) => plane.clone()));
		// Every plane is a no-op: a point far above the cut is kept by all of them.
		for (const plane of inside) expect(plane.distanceToPoint({ x: 0, y: 400, z: 0 } as never)).toBeGreaterThan(0);
		clip.planes.forEach((plane, index) => {
			expect(plane.normal.toArray()).toEqual(captured[index]!.normal.toArray());
			expect(plane.constant).toBe(captured[index]!.constant);
		});
	});

	it('is re-entrant and restores only at the outermost level', () => {
		const clip = createStageClip();
		clip.apply({ kind: 'level', cutY: 2, lowerY: null });
		const outer = clip.asBuilt(() => {
			const middle = clip.asBuilt(() => clip.planes[0]!.constant);
			// Still no-op after the inner call returned.
			expect(clip.planes[0]!.distanceToPoint({ x: 0, y: 500, z: 0 } as never)).toBeGreaterThan(0);
			return middle;
		});
		expect(outer).toBeGreaterThan(0);
		expect(clip.planes[0]!.distanceToPoint({ x: 0, y: 500, z: 0 } as never)).toBeLessThan(0);
	});

	it('restores and rethrows when the render throws, and passes values through', () => {
		const clip = createStageClip();
		clip.apply({ kind: 'level', cutY: 1.2, lowerY: 0.5 });
		const before = clip.planes.map((plane) => plane.constant);
		expect(clip.asBuilt(() => 'frame')).toBe('frame');
		expect(() =>
			clip.asBuilt(() => {
				throw new Error('readback failed');
			})
		).toThrow('readback failed');
		expect(clip.planes.map((plane) => plane.constant)).toEqual(before);
	});

	it('lets an apply during the render win on exit', () => {
		const clip = createStageClip();
		clip.apply({ kind: 'level', cutY: 1.2, lowerY: null });
		clip.asBuilt(() => {
			clip.apply({ kind: 'level', cutY: 0.8, lowerY: null });
		});
		expect(clip.planes[0]!.constant).toBeCloseTo(0.8, 9);
	});

	it('never replaces the plane array or its instances', () => {
		const clip = createStageClip();
		const array = clip.planes;
		const instances = [...clip.planes];
		clip.apply({ kind: 'level', cutY: 1.2, lowerY: 0.5 });
		clip.apply(null);
		clip.asBuilt(() => undefined);
		expect(clip.planes).toBe(array);
		expect(clip.planes.every((plane, index) => plane === instances[index])).toBe(true);
	});

	it('is reachable from a material only by reference', () => {
		const clip = createStageClip();
		const material = { clippingPlanes: clip.planes } as unknown as Material;
		expect(materialUsesClip(material, clip)).toBe(true);
		const detached = { clippingPlanes: clip.planes.map((plane) => plane.clone()) } as unknown as Material;
		expect(materialUsesClip(detached, clip)).toBe(false);
	});
});

describe('ghost rule (test 15)', () => {
	const resolved = { kind: 'level' as const, cutY: 1.2, lowerY: 0.5 };

	function triangle(a: readonly [number, number, number], b: readonly [number, number, number], c: readonly [number, number, number]): SliceGhostSubject {
		return {
			triangles: [{ positions: new Float32Array([...a, ...b, ...c]) }]
		};
	}

	it('keeps a Wall spanning the whole band visible, even with only end vertices', () => {
		// Seven metres tall both ways: every vertex is hidden (some above, some below),
		// yet the face crosses the visible band, so it is visible — the very case a
		// per-vertex test gets wrong.
		const wall = triangle([0, -1, 0], [1, 2.2, 0], [1, -1, 0]);
		expect(subjectWhollyHidden(resolved, wall)).toBe(false);
	});

	it('ghosts geometry wholly above the cut or wholly below the bound', () => {
		expect(subjectWhollyHidden(resolved, triangle([0, 2, 0], [1, 2, 0], [1, 2.2, 0]))).toBe(true);
		expect(subjectWhollyHidden(resolved, triangle([0, 0, 0], [1, 0, 0], [1, 0.2, 0]))).toBe(true);
	});

	it('keeps a triangle that straddles the cut or the lower bound', () => {
		expect(subjectWhollyHidden(resolved, triangle([0, 1.1, 0], [1, 1.3, 0], [1, 1.1, 0]))).toBe(false);
		expect(subjectWhollyHidden(resolved, triangle([0, 0.4, 0], [1, 0.6, 0], [1, 0.4, 0]))).toBe(false);
	});

	it('keeps a triangle with one vertex above and two below', () => {
		expect(subjectWhollyHidden(resolved, triangle([0, 2.4, 0], [1, 0.8, 0], [1, 1.0, 0]))).toBe(false);
	});

	it('reads a finite approximate subject from its bounds, erring toward hidden', () => {
		const skinned: SliceGhostSubject = {
			triangles: [{ positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]) }],
			roughBounds: undefined,
			bounds: { min: [0, 1.3, 0], max: [1, 2, 0] },
			approximate: true
		} as SliceGhostSubject;
		expect(subjectWhollyHidden(resolved, skinned)).toBe(true);
		const banded: SliceGhostSubject = {
			triangles: [{ positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]) }],
			bounds: { min: [0, 0.9, 0], max: [1, 5, 0] },
			approximate: true
		};
		expect(subjectWhollyHidden(resolved, banded)).toBe(true);
		const visible: SliceGhostSubject = {
			triangles: [{ positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]) }],
			bounds: { min: [0, 0.8, 0], max: [1, 1.0, 0] },
			approximate: true
		};
		expect(subjectWhollyHidden(resolved, visible)).toBe(false);
	});

	it('does not ghost a subject with no drawable triangle', () => {
		expect(subjectWhollyHidden(resolved, { triangles: [] })).toBe(false);
		expect(
			subjectWhollyHidden(resolved, { triangles: [{ positions: new Float32Array([0, 0, 0]) }] })
		).toBe(false);
	});

	it('agrees between the AABB fast path and the triangle test', () => {
		const above = triangle([0, 2, 0], [1, 2, 0], [1, 2.2, 0]);
		const withBounds: SliceGhostSubject = {
			...above,
			bounds: { min: [0, 2, 0], max: [1, 2.2, 0] }
		};
		expect(subjectWhollyHidden(resolved, withBounds)).toBe(subjectWhollyHidden(resolved, above));
		const banded = triangle([0, -1, 0], [1, 2.2, 0], [1, -1, 0]);
		const bandedBounds: SliceGhostSubject = {
			...banded,
			bounds: { min: [0, -1, 0], max: [1, 2.2, 0] }
		};
		expect(subjectWhollyHidden(resolved, bandedBounds)).toBe(false);
	});
});
