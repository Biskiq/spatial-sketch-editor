/**
 * E7/R4 — the geometry store's sharing and ownership contract.
 *
 * The store is the only place a Scene or Layout buffer is constructed. The
 * obligations are counted: one buffer per key, one construction for equal keys,
 * a lease count that holds the buffer, disposal exactly at zero, and no sharing
 * across stores (a buffer belongs to one Canvas).
 */
import { describe, expect, it, vi } from 'vitest';
import {
	BoxGeometry,
	CylinderGeometry,
	PlaneGeometry,
	SphereGeometry
} from 'three';
import { createGeometryStore } from '$lib/render/resources/geometry-store';
import { evaluateFormMesh } from '$lib/content/form-evaluation';
import type { SceneFormSource } from '@portfolio/project-model';

const FORM_SOURCE: SceneFormSource = {
	generator: {
		kind: 'extrude',
		plane: 'plan',
		extent: 0.2,
		outline: [
			{ key: 1, u: 0, v: 0, smooth: false },
			{ key: 2, u: 1, v: 0, smooth: false },
			{ key: 3, u: 1, v: 0.5, smooth: false },
			{ key: 4, u: 0, v: 0.5, smooth: false }
		]
	},
	scale: [1, 1, 1],
	nextKey: 5
};

describe('E7/R4 — geometry store', () => {
	it('builds one unit buffer per key and shares it between equal specs', () => {
		const store = createGeometryStore();
		const first = store.acquire({ kind: 'unit', shape: 'box' });
		const second = store.acquire({ kind: 'unit', shape: 'box' });
		expect(first.key).toBe('unit:box');
		expect(first.geometry).toBe(second.geometry);
		expect(store.stats()).toMatchObject({ live: 1, created: 1, acquired: 2 });

		first.release();
		// One lease remains: the buffer is still drawn and must not be freed.
		expect(store.stats()).toMatchObject({ live: 1, disposed: 0 });
		second.release();
		expect(store.stats()).toMatchObject({ live: 0, disposed: 1 });
	});

	it('names each unit shape with the parameters that change its vertices', () => {
		const store = createGeometryStore();
		const box = store.acquire({ kind: 'unit', shape: 'box' });
		const plane = store.acquire({ kind: 'unit', shape: 'plane' });
		const cylinder = store.acquire({ kind: 'unit', shape: 'cylinder', radialSegments: 32 });
		const coarse = store.acquire({ kind: 'unit', shape: 'cylinder', radialSegments: 16 });
		const sphere = store.acquire({ kind: 'unit', shape: 'sphere', widthSegments: 32, heightSegments: 24 });
		const keys = [box.key, plane.key, cylinder.key, coarse.key, sphere.key];
		expect(keys).toEqual([
			'unit:box',
			'unit:plane',
			'unit:cylinder:32',
			'unit:cylinder:16',
			'unit:sphere:32x24'
		]);
		expect(new Set(keys).size).toBe(keys.length);
		expect(cylinder.geometry).not.toBe(coarse.geometry);
		// The unit shapes are the sizes the item's geometry scale expects.
		expect((box.geometry as BoxGeometry).parameters).toMatchObject({ width: 1, height: 1, depth: 1 });
		expect((plane.geometry as PlaneGeometry).parameters).toMatchObject({ width: 1, height: 1 });
		expect((cylinder.geometry as CylinderGeometry).parameters).toMatchObject({
			radiusTop: 0.5,
			radiusBottom: 0.5,
			height: 1,
			radialSegments: 32
		});
		expect((sphere.geometry as SphereGeometry).parameters).toMatchObject({
			radius: 0.5,
			widthSegments: 32,
			heightSegments: 24
		});
	});

	it('keys a Form by its canonical evaluation and shares the one buffer', () => {
		const store = createGeometryStore();
		// A real kernel evaluation: the store must build the adapter's geometry once.
		const mesh = evaluateFormMesh(FORM_SOURCE)!;
		const spec = { kind: 'form' as const, evaluationKey: 'form-abc', mesh, plane: 'plan' as const };
		const first = store.acquire(spec);
		const second = store.acquire(spec);
		expect(first.key).toBe('form:form-abc');
		expect(first.geometry).toBe(second.geometry);
		expect(store.stats()).toMatchObject({ live: 1, created: 1 });
	});

	it('disposes at the last lease, once, and refuses acquires after dispose', () => {
		const store = createGeometryStore();
		const lease = store.acquire({ kind: 'unit', shape: 'sphere', widthSegments: 8, heightSegments: 6 });
		const dispose = vi.spyOn(lease.geometry, 'dispose');
		lease.release();
		lease.release();
		expect(dispose).toHaveBeenCalledTimes(1);
		expect(store.stats()).toMatchObject({ live: 0, disposed: 1 });
		store.dispose();
		expect(() => store.acquire({ kind: 'unit', shape: 'box' })).toThrow(/disposed/);

		const other = createGeometryStore();
		const held = other.acquire({ kind: 'unit', shape: 'box' });
		const heldDispose = vi.spyOn(held.geometry, 'dispose');
		other.dispose();
		expect(heldDispose).toHaveBeenCalledTimes(1);
		// A lease released after the store disposed cannot double-free.
		held.release();
		expect(heldDispose).toHaveBeenCalledTimes(1);
		other.dispose();
		expect(heldDispose).toHaveBeenCalledTimes(1);
	});

	it('never shares a buffer between two Canvases', () => {
		const first = createGeometryStore();
		const second = createGeometryStore();
		const a = first.acquire({ kind: 'unit', shape: 'box' });
		const b = second.acquire({ kind: 'unit', shape: 'box' });
		expect(a.geometry).not.toBe(b.geometry);
		first.dispose();
		expect(b.geometry.attributes.position).toBeDefined();
		expect(second.stats().live).toBe(1);
	});
});
