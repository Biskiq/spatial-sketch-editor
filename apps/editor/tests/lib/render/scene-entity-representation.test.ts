/**
 * E7/R4 — the retained primitive/Form representation.
 *
 * Everything here is a count or an identity, because that is the packet's
 * contract: one root for the Canvas lifetime, one group/mesh per drawable, a
 * rebuild only for a changed item, leases on the Canvas stores, a pick root per
 * entity, and nothing shared across Canvases.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	Mesh,
	MeshStandardMaterial,
	Texture,
	type Object3D
} from 'three';
import type { RuntimeScene } from '$lib/content/scene';
import { createScenePickSource } from '$lib/authoring/scene/scene-pick-source';
import { createMaterialStore } from '$lib/render/resources/material-store';
import { createGeometryStore } from '$lib/render/resources/geometry-store';
import {
	createSceneEntityRepresentation,
	type SceneEntityRepresentation
} from '$lib/render/scene-entity-representation';
import type { SceneRenderDescription, SceneRenderItem } from '$lib/render/resources/scene-render-item';
import {
	__resetDefaultSourceLoaderForTests,
	acquireEffectiveVariant,
	deferredTextureReleaseCount,
	flushDeferredTextureReleases,
	loadEffectiveTextures,
	releaseEffectiveVariant,
	resetTextureCachesForTests,
	setDefaultTextureSourceLoader
} from '$lib/render/resources/texture-store';

afterEach(() => {
	resetTextureCachesForTests();
	__resetDefaultSourceLoaderForTests();
	flushDeferredTextureReleases();
});

const SURFACE = { kind: 'standard', color: '#c4b4a0', roughness: 0.5, metalness: 0, toneMapped: true } as const;

function item(id: string, overrides: Partial<SceneRenderItem> = {}): SceneRenderItem {
	return {
		id,
		key: id,
		geometry: { kind: 'unit', shape: 'box' },
		geometryScale: [1, 1, 1],
		material: SURFACE,
		textures: null,
		transform: { position: [0, 0.5, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
		castShadow: true,
		receiveShadow: true,
		...overrides
	};
}

function description(...items: SceneRenderItem[]): SceneRenderDescription {
	return { items };
}

function bodyOf(representation: SceneEntityRepresentation, id: string): Mesh {
	const root = representation.objectOf(id);
	if (root === null) throw new Error(`no root for ${id}`);
	const mesh = root.children.find((child) => child instanceof Mesh);
	if (mesh === undefined) throw new Error(`no mesh for ${id}`);
	return mesh as Mesh;
}

function setup(onRoot?: (id: string, root: Object3D) => (() => void) | void) {
	const store = createMaterialStore();
	const geometry = createGeometryStore();
	const representation = createSceneEntityRepresentation({ store, geometry, onRoot });
	return { store, geometry, representation };
}

describe('E7/R4 — retained Scene entities', () => {
	it('builds one root and body per item and shares equal materials and buffers', () => {
		const { store, geometry, representation } = setup();
		const stats = representation.update(
			description(item('box-a'), item('box-b'), item('sphere-c', {
				geometry: { kind: 'unit', shape: 'sphere', widthSegments: 32, heightSegments: 24 },
				geometryScale: [0.6, 0.6, 0.6]
			}))
		);
		expect(stats).toMatchObject({ items: 3, built: 3, retained: 0, released: 0, textured: 0 });
		expect(representation.object3d.children).toHaveLength(3);

		const a = bodyOf(representation, 'box-a');
		const b = bodyOf(representation, 'box-b');
		const c = bodyOf(representation, 'sphere-c');
		expect(a.material).toBe(b.material);
		expect(a.geometry).toBe(b.geometry);
		expect(c.geometry).not.toBe(a.geometry);
		expect(store.stats()).toMatchObject({ live: 1, created: 1 });
		expect(geometry.stats()).toMatchObject({ live: 2, created: 2 });
		representation.dispose();
	});

	it('does nothing for an unchanged description', () => {
		const { store, geometry, representation } = setup();
		const stable = description(item('box-a'), item('box-b'));
		representation.update(stable);
		const before = ['box-a', 'box-b'].map((id) => ({
			root: representation.objectOf(id)!,
			body: bodyOf(representation, id)
		}));
		const acquired = { materials: store.stats().acquired, geometry: geometry.stats().acquired };

		const stats = representation.update(stable);
		expect(stats).toMatchObject({ built: 0, retained: 2, released: 0 });
		for (const [index, id] of ['box-a', 'box-b'].entries()) {
			expect(representation.objectOf(id)).toBe(before[index]!.root);
			expect(bodyOf(representation, id)).toBe(before[index]!.body);
		}
		// No lease, construction or patch happened on the unchanged pass.
		expect(store.stats().acquired).toBe(acquired.materials);
		expect(geometry.stats().acquired).toBe(acquired.geometry);
		representation.dispose();
	});

	it('rebuilds only a changed item and keeps every other root and lease', () => {
		const { store, representation } = setup();
		representation.update(description(item('box-a'), item('box-b')));
		const keptRoot = representation.objectOf('box-b');
		const keptBody = bodyOf(representation, 'box-b');
		const keptMaterial = keptBody.material;
		const oldRoot = representation.objectOf('box-a');

		const stats = representation.update(
			description(
				item('box-a', { key: 'box-a-moved', transform: { position: [2, 0.5, 0], rotation: [0, 0, 0], scale: [1, 1, 1] } }),
				item('box-b')
			)
		);
		expect(stats).toMatchObject({ built: 1, retained: 1, released: 0 });
		expect(representation.objectOf('box-a')).not.toBe(oldRoot);
		expect(oldRoot!.parent).toBeNull();
		expect(representation.objectOf('box-b')).toBe(keptRoot);
		expect(bodyOf(representation, 'box-b')).toBe(keptBody);
		expect(keptBody.material).toBe(keptMaterial);
		expect(store.stats()).toMatchObject({ live: 1, created: 1 });
		representation.dispose();
	});

	it('releases a removed item and its pick registration in the same update', () => {
		const unregisterA = vi.fn();
		const unregisterB = vi.fn();
		const { representation } = setup((id) => (id === 'box-a' ? unregisterA : unregisterB));
		representation.update(description(item('box-a'), item('box-b')));
		expect(representation.objectOf('box-a')).not.toBeNull();

		const stats = representation.update(description(item('box-b')));
		expect(stats).toMatchObject({ built: 0, retained: 1, released: 1 });
		expect(representation.objectOf('box-a')).toBeNull();
		expect(unregisterA).toHaveBeenCalledTimes(1);
		expect(unregisterB).not.toHaveBeenCalled();
		expect(representation.objectOf('box-b')).not.toBeNull();
		representation.dispose();
		expect(unregisterB).toHaveBeenCalledTimes(1);
	});

	it('tears down every item, lease and buffer, once', () => {
		const { store, geometry, representation } = setup();
		representation.update(description(item('box-a'), item('box-b')));
		representation.dispose();
		expect(representation.object3d.children).toHaveLength(0);
		expect(store.stats()).toMatchObject({ live: 0, disposed: 1 });
		expect(geometry.stats()).toMatchObject({ live: 0, disposed: 1 });
		representation.dispose();
		expect(store.stats().disposed).toBe(1);
		expect(geometry.stats().disposed).toBe(1);
		expect(() => representation.update(description(item('box-a')))).toThrow(/disposed/);
	});

	it('keeps two Canvases’ materials and buffers separate', () => {
		const first = setup();
		const second = setup();
		first.representation.update(description(item('box-a')));
		second.representation.update(description(item('box-a')));
		expect(bodyOf(first.representation, 'box-a').material).not.toBe(
			bodyOf(second.representation, 'box-a').material
		);
		expect(bodyOf(first.representation, 'box-a').geometry).not.toBe(
			bodyOf(second.representation, 'box-a').geometry
		);
		first.representation.dispose();
		expect(bodyOf(second.representation, 'box-a').material).toBeInstanceOf(MeshStandardMaterial);
		expect(second.store.stats().live).toBe(1);
		second.representation.dispose();
	});

	it('registers a pick root that resolves the entity and stops once released', () => {
		const scenePick = createScenePickSource();
		const scene = { entities: [{ id: 'box-a' }, { id: 'box-b' }] } as unknown as RuntimeScene;
		const { representation } = setup((id, root) => scenePick.register(id, root));
		representation.update(description(item('box-a'), item('box-b', { transform: { position: [5, 0.5, 0], rotation: [0, 0, 0], scale: [1, 1, 1] } })));
		scenePick.setSource(scene);
		expect(scenePick.entityObject('box-a')).toBe(representation.objectOf('box-a'));

		const hit = scenePick.pick({ origin: [0, 5, 0], direction: [0, -1, 0] }, scene);
		expect(hit?.entityId).toBe('box-a');
		expect(scenePick.bounds('box-a', scene)).toEqual({
			min: [-0.5, 0, -0.5],
			max: [0.5, 1, 0.5]
		});

		representation.dispose();
		expect(scenePick.entityObject('box-a')).toBeNull();
		expect(scenePick.pick({ origin: [0, 5, 0], direction: [0, -1, 0] }, scene)).toBeNull();
	});
});

describe('E7/R2b — texture variants on a retained Scene item', () => {
	it('binds the loaded maps and shares one material between equal textured looks', async () => {
		setDefaultTextureSourceLoader(async () => new Texture());
		const { store, representation } = setup();
		const textured = item('box-a', {
			textures: { variantSeed: 'seed-1', slotUris: { map: '/textures/one.png' }, repeat: [0.6, 0.6] }
		});
		const stats = representation.update(description(textured, { ...textured, id: 'box-b', key: 'box-b' }));
		expect(stats.textured).toBe(2);
		await representation.idle();

		const a = bodyOf(representation, 'box-a');
		const b = bodyOf(representation, 'box-b');
		expect(a.material).toBe(b.material);
		expect(a.material).toBeInstanceOf(MeshStandardMaterial);
		expect((a.material as MeshStandardMaterial).map).toBeInstanceOf(Texture);
		expect((a.material as MeshStandardMaterial).map).toBe((b.material as MeshStandardMaterial).map);
		expect(deferredTextureReleaseCount()).toBe(0);
		// The untextured leases were handed back: a textured look holds one instance.
		expect(store.stats()).toMatchObject({ live: 1, disposed: 1 });
		representation.dispose();
	});

	it('keeps the untextured surface when a map fails to load', async () => {
		setDefaultTextureSourceLoader(async () => {
			throw new Error('offline');
		});
		const { representation } = setup();
		representation.update(
			description(
				item('box-a', {
					textures: { variantSeed: 'seed-1', slotUris: { map: '/textures/missing.png' }, repeat: [1, 1] }
				})
			)
		);
		await representation.idle();
		expect((bodyOf(representation, 'box-a').material as MeshStandardMaterial).map).toBeNull();
		representation.dispose();
	});

	it('re-acquires a released variant inside one update instead of re-uploading it', async () => {
		setDefaultTextureSourceLoader(async () => new Texture());
		const source = { variantSeed: 'seed-deferred', slotUris: { map: '/textures/one.png' } };
		await loadEffectiveTextures(source);
		const maps = acquireEffectiveVariant(source, 1, 1);
		expect(maps.map).toBeInstanceOf(Texture);
		expect(deferredTextureReleaseCount()).toBe(0);
		releaseEffectiveVariant(source.variantSeed, 1, 1);
		expect(deferredTextureReleaseCount()).toBe(1);
		// The same maps come back and the deferred disposal is cancelled.
		expect(acquireEffectiveVariant(source, 1, 1)).toBe(maps);
		expect(deferredTextureReleaseCount()).toBe(0);
		flushDeferredTextureReleases();
		expect(deferredTextureReleaseCount()).toBe(0);
	});

	it('disposes a released variant at the idle point exactly once', async () => {
		setDefaultTextureSourceLoader(async () => new Texture());
		const source = { variantSeed: 'seed-flush', slotUris: { map: '/textures/one.png' } };
		await loadEffectiveTextures(source);
		const maps = acquireEffectiveVariant(source, 2, 3);
		const texture = maps.map!;
		const dispose = vi.spyOn(texture, 'dispose');
		releaseEffectiveVariant(source.variantSeed, 2, 3);
		expect(dispose).not.toHaveBeenCalled();
		flushDeferredTextureReleases();
		expect(dispose).toHaveBeenCalledTimes(1);
		flushDeferredTextureReleases();
		expect(dispose).toHaveBeenCalledTimes(1);
	});
});
