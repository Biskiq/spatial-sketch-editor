/**
 * SL1 test 10 — a click reaches what is visible behind a cut.
 *
 * A Slice changes nothing in the document: the point under the pointer is still in
 * the world. It is simply not drawn, so the hit must be skipped rather than
 * selected. Absent the filter the source behaves exactly as today, which is the
 * other half of the contract (Preview and every non-Slice caller).
 */
import { describe, expect, it } from 'vitest';
import { BoxGeometry, Mesh, MeshBasicMaterial } from 'three';
import { createScenePickSource } from '$lib/authoring/scene/scene-pick-source';
import type { PointerRay } from '@portfolio/camera-core';

function scene() {
	const source = createScenePickSource();
	const data = { entities: [{ id: 'near' }, { id: 'far' }] } as never;
	const geometry = new BoxGeometry(1, 1, 1);
	const material = new MeshBasicMaterial();
	const near = new Mesh(geometry, material);
	near.position.set(0, 0, 0);
	const far = new Mesh(geometry, material);
	far.position.set(0, 0, -3);
	source.register('near', near);
	source.register('far', far);
	source.setSource(data);
	return { source, data, dispose: () => {
		geometry.dispose();
		material.dispose();
	} };
}

const RAY: PointerRay = { origin: [0, 0, 5], direction: [0, 0, -1] };

describe('scene pick — a hidden hit is skipped', () => {
	it('picks the nearest body as today when no filter is given', () => {
		const { source, data, dispose } = scene();
		expect(source.pick(RAY, data)?.entityId).toBe('near');
		dispose();
	});

	it('reaches the body behind a hidden one, and only that one', () => {
		const { source, data, dispose } = scene();
		// The near box sits at z = 0; a cut that hides z > -1.5 hides only it.
		const hidden = (point: readonly [number, number, number]): boolean => point[2] > -1.5;
		const hit = source.pick(RAY, data, { hiddenAt: hidden });
		expect(hit?.entityId).toBe('far');
		expect(hit?.distanceMeters).toBeGreaterThan(2.5);

		// Everything hidden: no hit at all, rather than a silent nearest.
		expect(source.pick(RAY, data, { hiddenAt: () => true })).toBeNull();
		dispose();
	});
});
