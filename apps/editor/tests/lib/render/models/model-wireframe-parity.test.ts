/**
 * E8/R5 — wireframe parity for imported materials. An explicit false overrides a
 * source material that draws wireframe, the cached template is never mutated, and a
 * wireframe look and a solid look of one source are distinct store materials.
 */
import { describe, expect, it } from 'vitest';
import { BoxGeometry, Group, Mesh, MeshStandardMaterial, type Object3D } from 'three';
import { meshesOf, realizeModel } from '$lib/render/models/model-realization';
import { createMaterialStore } from '$lib/render/resources/material-store';

const SHADOWS = { castShadow: true, receiveShadow: true } as const;

function wireTemplate(): Group {
	const group = new Group();
	group.add(new Mesh(new BoxGeometry(1, 1, 1), new MeshStandardMaterial({ color: 0x808080, wireframe: true })));
	return group;
}

function wireOf(root: Object3D): boolean {
	return (meshesOf(root)[0]!.material as MeshStandardMaterial).wireframe;
}

describe('imported wireframe parity (E8/R5)', () => {
	it('false → true → false overrides the source wireframe and never mutates the template', () => {
		const template = wireTemplate();
		const store = createMaterialStore();
		const instance = realizeModel(template, { asset: 'wire', store, look: null, wireframe: false, ...SHADOWS });
		expect(wireOf(instance.root)).toBe(false);

		instance.restyle({ look: null, wireframe: true, ...SHADOWS });
		expect(wireOf(instance.root)).toBe(true);

		instance.restyle({ look: null, wireframe: false, ...SHADOWS });
		expect(wireOf(instance.root)).toBe(false);
		expect(wireOf(template)).toBe(true);

		// Only the current look is held: the wireframe material was given back.
		expect(store.stats().live).toBe(1);
		instance.release();
		expect(store.stats().live).toBe(0);
	});

	it('a wireframe look and a solid look of one source are distinct materials', () => {
		const template = wireTemplate();
		const store = createMaterialStore();
		const solid = realizeModel(template, { asset: 'wire', store, look: null, wireframe: false, ...SHADOWS });
		const wire = realizeModel(template, { asset: 'wire', store, look: null, wireframe: true, ...SHADOWS });
		expect(meshesOf(solid.root)[0]!.material).not.toBe(meshesOf(wire.root)[0]!.material);
		expect(wireOf(solid.root)).toBe(false);
		expect(wireOf(wire.root)).toBe(true);
		expect(wireOf(template)).toBe(true);
		solid.release();
		wire.release();
		expect(store.stats().live).toBe(0);
	});
});
