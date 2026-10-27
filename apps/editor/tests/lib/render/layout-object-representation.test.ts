/**
 * T1.P02.S06 D.3 (H4) — the retained Stage Layout-object representation.
 *
 * Same obligations as the Wall representation, as counts: nothing built when
 * nothing changed, only the changed object rebuilt, a departed object released in
 * the same update, a retained mesh identical to a from-scratch one, and one
 * material for the representation's whole lifetime.
 */
import { describe, expect, it, vi } from 'vitest';
import { BufferGeometry, Mesh } from 'three';
import {
	compileWallFirstLayoutGeometry,
	type CompiledLayoutGeometry,
	type LayoutDocumentWallFirst
} from '@portfolio/layout-core';

import { buildScaleFixture, SCALE_FIXTURE_SEEDS } from '../layout/__fixtures__/layout-scale-fixtures';
import { createObjectRepresentation } from '$lib/render/layout-object-representation';

function compiled(document: LayoutDocumentWallFirst): CompiledLayoutGeometry {
	return compileWallFirstLayoutGeometry(document).geometry;
}

function moveOneObject(document: LayoutDocumentWallFirst): LayoutDocumentWallFirst {
	const next = JSON.parse(JSON.stringify(document)) as LayoutDocumentWallFirst;
	const object = next.objects[0]!;
	object.position = [object.position[0] + 0.4, object.position[1], object.position[2] + 0.2] as typeof object.position;
	return next;
}

function meshes(representation: ReturnType<typeof createObjectRepresentation>) {
	const found = new Map<string, Mesh>();
	representation.object3d.traverse((object) => {
		if ((object as { isMesh?: boolean }).isMesh) found.set(object.name, object as Mesh);
	});
	return found;
}

describe('T1.P02.S06 H4 — retained Layout object representation', () => {
	it('builds one mesh per object on the first update, shares one material, and nothing on the second', () => {
		const document = buildScaleFixture(SCALE_FIXTURE_SEEDS.small);
		const geometry = compiled(document);
		const representation = createObjectRepresentation();

		const first = representation.update(geometry);
		expect(first.objects).toBe(geometry.objects.length);
		expect(first.built).toBe(geometry.objects.length);
		expect(first.retained).toBe(0);
		expect(representation.object3d.children).toHaveLength(geometry.objects.length);

		const before = meshes(representation);
		const materials = new Set([...before.values()].map((mesh) => mesh.material));
		expect(materials.size).toBe(1);

		const second = representation.update(geometry);
		expect(second).toMatchObject({ built: 0, released: 0, retained: geometry.objects.length });
		for (const [name, mesh] of meshes(representation)) expect(mesh).toBe(before.get(name));
		// Same material object: no material is created by a compile.
		for (const mesh of meshes(representation).values()) expect(mesh.material).toBe([...materials][0]);

		representation.dispose();
	});

	it('rebuilds only the object that moved and keeps every other mesh', () => {
		const document = buildScaleFixture(SCALE_FIXTURE_SEEDS.small);
		const representation = createObjectRepresentation();
		const base = compiled(document);
		representation.update(base);
		const before = meshes(representation);

		const next = compiled(moveOneObject(document));
		const stats = representation.update(next);
		expect(stats.built).toBe(1);
		expect(stats.released).toBe(0);
		expect(stats.retained).toBe(next.objects.length - 1);

		const after = meshes(representation);
		let kept = 0;
		for (const [name, mesh] of after) if (before.get(name) === mesh) kept += 1;
		expect(kept).toBe(stats.retained);
		// A rebuilt mesh must be attached through `add()`, so `removeFromParent()`
		// can release it; a bare `children[index] = mesh` would leak it.
		for (const child of representation.object3d.children) expect(child.parent).toBe(representation.object3d);
		expect(representation.object3d.children).toHaveLength(next.objects.length);

		representation.dispose();
	});

	it('releases a departed object in the same update', () => {
		const document = buildScaleFixture(SCALE_FIXTURE_SEEDS.small);
		const representation = createObjectRepresentation();
		const base = compiled(document);
		representation.update(base);

		const removed = base.objects.at(-1)!;
		const pruned = { ...base, objects: base.objects.filter((object) => object.objectId !== removed.objectId) };
		const disposeSpy = vi.spyOn(BufferGeometry.prototype, 'dispose');
		const stats = representation.update(pruned);
		expect(stats.released).toBe(1);
		expect(stats.built).toBe(0);
		expect(disposeSpy).toHaveBeenCalled();
		disposeSpy.mockRestore();
		expect(meshes(representation).has(`VisitorLayoutObject:${removed.objectId}`)).toBe(false);

		representation.dispose();
	});

	it('a retained rebuild equals a from-scratch build buffer for buffer', () => {
		const document = buildScaleFixture(SCALE_FIXTURE_SEEDS.small);
		const edited = moveOneObject(document);

		const incremental = createObjectRepresentation();
		const base = compiled(document);
		incremental.update(base);
		incremental.update(compiled(edited));

		const fresh = createObjectRepresentation();
		fresh.update(compiled(edited));

		const delivered = meshes(incremental);
		const scratch = meshes(fresh);
		expect([...delivered.keys()].sort()).toEqual([...scratch.keys()].sort());
		for (const [name, mesh] of scratch) {
			const other = delivered.get(name)!;
			expect(other.position.toArray(), name).toEqual(mesh.position.toArray());
			expect(other.scale.toArray(), name).toEqual(mesh.scale.toArray());
			expect(Array.from(other.geometry.getAttribute('position').array as Float32Array), name).toEqual(
				Array.from(mesh.geometry.getAttribute('position').array as Float32Array)
			);
		}

		incremental.dispose();
		fresh.dispose();
	});

	it('disposes every mesh and material exactly once', () => {
		const document = buildScaleFixture(SCALE_FIXTURE_SEEDS.small);
		const representation = createObjectRepresentation();
		representation.update(compiled(document));
		const mesh = [...meshes(representation).values()][0]!;
		const disposeSpy = vi.spyOn(BufferGeometry.prototype, 'dispose');
		const materialSpy = vi.spyOn(mesh.material as { dispose: () => void }, 'dispose');

		representation.dispose();
		expect(disposeSpy.mock.calls.length).toBeGreaterThanOrEqual(document.objects.length);
		expect(materialSpy).toHaveBeenCalledTimes(1);
		expect(representation.object3d.children).toHaveLength(0);

		disposeSpy.mockClear();
		representation.dispose();
		expect(disposeSpy).not.toHaveBeenCalled();
		disposeSpy.mockRestore();
		materialSpy.mockRestore();
	});
});
