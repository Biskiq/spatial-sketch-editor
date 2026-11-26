/**
 * S5b — the retained Region representation resolves Scene-owned Region faces.
 *
 * One material factory, one mesh per slab, three groups: top, underside, edge.
 * An unpainted face keeps today's default (a floor top, a dark plaster
 * underside/edge); a painted face replaces only its own group, and a Scene
 * change re-leases without rebuilding the slab's geometry.
 */
import { describe, expect, it } from 'vitest';
import type { RuntimeScene } from '@portfolio/project-model/scene';
import { Mesh, MeshBasicMaterial, MeshStandardMaterial, type Material } from 'three';
import { compileWallFirstLayoutGeometry } from '@portfolio/layout-core/geometry';
import type { LayoutDocumentWallFirst } from '@portfolio/layout-core/wall';
import { g1DocumentWithRooms, g1RoomPolygon } from '../../../../../packages/layout-core/tests/__fixtures__/layout-g1-fixtures';
import { createRegionRepresentation } from '$lib/render/layout-region-representation';
import { resolveSceneSurfaceLook } from '$lib/render/layout/scene-surface-look';
import { createMaterialStore } from '$lib/render/resources/material-store';
import { renderIdentityOf } from '$lib/render/render-identity';
import { getMaterial } from '$lib/content/materials';
import { CLAY_COLOR } from '$lib/render/materials/treatment';
import { DEFAULT_FLOOR_COLOR } from '$lib/visitor/room-presentation';

function regionDocument(): LayoutDocumentWallFirst {
	const document = g1DocumentWithRooms([
		g1RoomPolygon('room', [[0, 0], [8, 0], [8, 6], [0, 6]])
	]);
	document.regions.push({
		id: 'terrace',
		role: 'floor',
		footprint: { kind: 'polygon', points: [[1, 1], [7, 1], [7, 5], [1, 5]] },
		elevation: 0.2,
		thickness: 0.2,
		form: { kind: 'flat' },
		intendedGaps: []
	});
	return document;
}

/** A floor slab, a datum-aligned floor slab and an overhead slab in one Room. */
function slabsDocument(): LayoutDocumentWallFirst {
	const document = regionDocument();
	document.regions.push(
		{
			id: 'mat',
			role: 'floor',
			footprint: { kind: 'polygon', points: [[1, 1], [3, 1], [3, 2], [1, 2]] },
			elevation: 0,
			thickness: 0.05,
			form: { kind: 'flat' },
			intendedGaps: []
		},
		{
			id: 'canopy',
			role: 'overhead',
			footprint: { kind: 'polygon', points: [[1, 1], [7, 1], [7, 5], [1, 5]] },
			elevation: 2.6,
			thickness: 0.15,
			form: { kind: 'flat' },
			intendedGaps: []
		}
	);
	return document;
}

function oneMesh(representation: ReturnType<typeof createRegionRepresentation>): Mesh {
	const mesh = representation.objectOf('terrace');
	if (mesh === null) throw new Error('the terrace was not built');
	return mesh;
}

function faceMaterials(mesh: Mesh): [Material, Material, Material] {
	const materials = mesh.material;
	if (!Array.isArray(materials)) throw new Error('the slab must carry three face materials');
	return [materials[0]!, materials[1]!, materials[2]!];
}

function colorOf(material: Material): string {
	return (material as MeshStandardMaterial | MeshBasicMaterial).color.getHexString();
}

function paintedScene(): RuntimeScene {
	return {
		textures: [],
		materials: [],
		entities: [],
		objects: [],
		surfaceFinishes: [
			{ surface: { kind: 'region-face', regionId: 'terrace', face: 'top' }, finish: { materialId: 'marble-light' } },
			{ surface: { kind: 'region-face', regionId: 'terrace', face: 'underside' }, finish: { materialId: 'velvet-dark' } }
		]
	};
}

describe('S5b — retained Region face materials', () => {
	it('keeps the floor-top and dark underside/edge defaults unpainted, with three groups', () => {
		const geometry = compileWallFirstLayoutGeometry(regionDocument()).geometry;
		const store = createMaterialStore();
		const representation = createRegionRepresentation(store);
		expect(representation.update(geometry)).toBe(true);
		const mesh = oneMesh(representation);
		const [top, underside, edge] = faceMaterials(mesh);
		expect(top).toBeInstanceOf(MeshStandardMaterial);
		expect(underside).toBeInstanceOf(MeshStandardMaterial);
		expect(edge).toBe(underside);
		expect(colorOf(top)).toBe(DEFAULT_FLOOR_COLOR.slice(1));
		expect(colorOf(underside)).toBe('111018');
		expect(renderIdentityOf(mesh)).toEqual({ kind: 'region', id: 'terrace' });
		const surfaces = mesh.geometry.userData.regionSurfaces as readonly string[];
		const expected = ['top', 'underside', 'edge'] as const;
		for (const group of mesh.geometry.groups) {
			expect(surfaces[group.start / 3]).toBe(expected[group.materialIndex!]);
		}
		expect(new Set(mesh.geometry.groups.map((group) => group.materialIndex))).toEqual(new Set([0, 1, 2]));
		expect(store.stats().created).toBe(3);
		representation.dispose();
		store.dispose();
		expect(store.stats().live).toBe(0);
	});

	it('resolves top and underside through the one Scene material resolver', () => {
		const geometry = compileWallFirstLayoutGeometry(regionDocument()).geometry;
		const scene = paintedScene();
		const store = createMaterialStore();
		const representation = createRegionRepresentation(
			store,
			null,
			() => {},
			(surface) => resolveSceneSurfaceLook(scene, surface, undefined)
		);
		representation.update(geometry);
		const mesh = oneMesh(representation);
		const [top, underside, edge] = faceMaterials(mesh);
		expect(top).toBeInstanceOf(MeshStandardMaterial);
		expect(colorOf(top)).toBe(getMaterial('marble-light').fallbackColor.slice(1));
		expect(colorOf(underside)).toBe(getMaterial('velvet-dark').fallbackColor.slice(1));
		expect(colorOf(edge)).toBe('111018');
		expect(top).not.toBe(underside);
		expect(edge).not.toBe(underside);
		representation.dispose();
		store.dispose();
	});

	it('re-resolves only the materials on a Scene change and releases the superseded leases', () => {
		const geometry = compileWallFirstLayoutGeometry(regionDocument()).geometry;
		let scene: RuntimeScene = paintedScene();
		const store = createMaterialStore();
		const representation = createRegionRepresentation(
			store,
			null,
			() => {},
			(surface) => resolveSceneSurfaceLook(scene, surface, undefined)
		);
		representation.update(geometry);
		const mesh = oneMesh(representation);
		const painted = faceMaterials(mesh);
		const beforeGeometry = mesh.geometry;

		scene = { ...scene, surfaceFinishes: [] };
		expect(representation.setScene(scene, null)).toBe(true);
		expect(mesh.geometry).toBe(beforeGeometry);
		const defaults = faceMaterials(mesh);
		expect(defaults[0]).not.toBe(painted[0]);
		expect(defaults[1]).not.toBe(painted[1]);
		expect(colorOf(defaults[0]!)).not.toBe(getMaterial('marble-light').fallbackColor.slice(1));
		// Three defaults remain; the two painted leases were released.
		expect(store.stats().live).toBe(3);
		expect(representation.setScene(scene, null)).toBe(false);

		representation.dispose();
		store.dispose();
	});

	it('restores role-specific defaults after a Scene change for floor, datum and overhead slabs', () => {
		const geometry = compileWallFirstLayoutGeometry(slabsDocument()).geometry;
		let scene: RuntimeScene = paintedScene();
		const store = createMaterialStore();
		const representation = createRegionRepresentation(
			store,
			null,
			() => {},
			(surface) => resolveSceneSurfaceLook(scene, surface, undefined)
		);
		representation.update(geometry);

		scene = { ...scene, surfaceFinishes: [] };
		expect(representation.setScene(scene, null)).toBe(true);

		const terrace = representation.objectOf('terrace') as Mesh;
		const [terraceTop, terraceUnderside, terraceEdge] = faceMaterials(terrace);
		expect(colorOf(terraceTop)).toBe(DEFAULT_FLOOR_COLOR.slice(1));
		expect(colorOf(terraceUnderside)).toBe('111018');
		expect(terraceEdge).toBe(terraceUnderside);

		// A floor Region on the datum keeps its polygon-offset top and draw order.
		const mat = representation.objectOf('mat') as Mesh;
		const [matTop, matUnderside, matEdge] = faceMaterials(mat);
		expect(mat.renderOrder).toBe(1);
		expect((matTop as MeshStandardMaterial).polygonOffset).toBe(true);
		expect(colorOf(matTop)).toBe(DEFAULT_FLOOR_COLOR.slice(1));
		expect(matEdge).toBe(matUnderside);

		// An overhead Region's unpainted top stays the dark slab, never the floor.
		const canopy = representation.objectOf('canopy') as Mesh;
		const [canopyTop, canopyUnderside, canopyEdge] = faceMaterials(canopy);
		expect(colorOf(canopyTop)).toBe('111018');
		expect(colorOf(canopyUnderside)).toBe('111018');
		expect(canopyEdge).toBe(canopyUnderside);

		representation.dispose();
		store.dispose();
	});

	it('re-leases unpainted Region defaults under a Treatment', () => {
		const geometry = compileWallFirstLayoutGeometry(regionDocument()).geometry;
		const store = createMaterialStore();
		const representation = createRegionRepresentation(store);
		representation.update(geometry);
		const mesh = oneMesh(representation);
		expect(colorOf(faceMaterials(mesh)[0]!)).toBe(DEFAULT_FLOOR_COLOR.slice(1));

		expect(representation.setTreatment('clay')).toBe(true);
		expect(colorOf(faceMaterials(mesh)[0]!)).toBe(CLAY_COLOR.slice(1));
		expect(colorOf(faceMaterials(mesh)[1]!)).toBe(CLAY_COLOR.slice(1));
		expect(representation.setTreatment('clay')).toBe(false);

		expect(representation.setTreatment(undefined)).toBe(true);
		expect(colorOf(faceMaterials(mesh)[0]!)).toBe(DEFAULT_FLOOR_COLOR.slice(1));
		expect(colorOf(faceMaterials(mesh)[1]!)).toBe('111018');

		representation.dispose();
		store.dispose();
		expect(store.stats().live).toBe(0);
	});
});
