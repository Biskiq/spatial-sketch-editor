/**
 * E9/R5 — the retained Artwork handler: counts, fidelity and lease lifetimes.
 *
 * The "baseline" numbers are the inventory of the removed `EntityArtwork.svelte`
 * on the same fixture: per mounted Artwork it built one image `PlaneGeometry`,
 * an `ExtrudeGeometry` frame when it had a face and a colour, a `ShapeGeometry`
 * Mat when it had a Mat, and a backing `PlaneGeometry` when it had a backing
 * colour — each with its own `MeshLambertMaterial` — plus a `MeshDepthMaterial`
 * and a `MeshDistanceMaterial` for an image with transparent texels.
 * `baselineInventory` restates those template conditions on the description.
 */
import { describe, expect, it, vi } from 'vitest';
import {
	ExtrudeGeometry,
	Mesh,
	MeshDepthMaterial,
	MeshDistanceMaterial,
	MeshLambertMaterial,
	PlaneGeometry,
	RGBADepthPacking,
	ShapeGeometry,
	Texture,
	Vector3,
	type Object3D
} from 'three';
import type { ArtworkFrame, RuntimeScene, SceneArtworkEntity } from '@portfolio/project-model';
import { createMaterialStore } from '$lib/render/resources/material-store';
import { createGeometryStore } from '$lib/render/resources/geometry-store';
import type { SceneArtworkImage, SceneArtworkItem } from '$lib/render/resources/scene-render-item';
import {
	createSceneArtworkRepresentation,
	type ArtworkImageLoad,
	type ArtworkImageSource
} from '$lib/render/scene-artwork-representation';
import { createSceneEntityRepresentation } from '$lib/render/scene-entity-representation';
import { describeSceneArtwork, describeSceneRender } from '$lib/render/scene-render-description';
import { artworkRingShape } from '$lib/render/artwork/artwork-geometry';
import { COUNTING_ARTWORKS, COUNTING_ARTWORK_SIZES } from '../authoring/__fixtures__/counting-scene';

const ASSET = '00000000-0000-4000-8000-000000000001';
const OTHER_ASSET = '00000000-0000-4000-8000-000000000002';
const GALLERY_MAT: ArtworkFrame = { style: 'gallery', mat: true, color: 'walnut' };

function artwork(index: number, overrides: Partial<SceneArtworkEntity> = {}): SceneArtworkEntity {
	return {
		kind: 'artwork',
		id: `artwork-${String(index).padStart(2, '0')}`,
		name: `Artwork ${index + 1}`,
		position: [index * 1.5, 1.4, 2.4],
		rotation: [0, 0, 0],
		source: { kind: 'image', assetId: ASSET, pixelWidth: 800, pixelHeight: 600 },
		widthMeters: COUNTING_ARTWORK_SIZES[index % COUNTING_ARTWORK_SIZES.length]!,
		...overrides
	};
}

/** The counting fixture's 20 Artworks of 4 sizes, framed (gallery + Mat). */
function framedFixture(): SceneArtworkItem[] {
	return Array.from({ length: COUNTING_ARTWORKS }, (_, index) =>
		describeSceneArtwork(artwork(index, { frame: GALLERY_MAT }))
	);
}

function baselineInventory(item: SceneArtworkItem, transparent: boolean): { geometries: number; materials: number } {
	const parts = 1 + (item.frame ? 1 : 0) + (item.mat ? 1 : 0) + (item.backing ? 1 : 0);
	return { geometries: parts, materials: parts + (transparent ? 2 : 0) };
}

type Deferred = { resolve(load: ArtworkImageLoad): void; reject(error: unknown): void };

/** A controllable artwork scope with the real scope's per-image sharing. */
function scope() {
	const textures = new Map<string, Texture>();
	const waiting = new Map<string, Deferred[]>();
	const leases: { key: string; released: boolean }[] = [];
	const source: ArtworkImageSource = {
		acquire(image: SceneArtworkImage) {
			const key = `${image.assetId}/${image.pixelWidth}/${image.pixelHeight}`;
			const record = { key, released: false };
			leases.push(record);
			const ready = new Promise<ArtworkImageLoad>((resolve, reject) => {
				const list = waiting.get(key) ?? [];
				list.push({ resolve, reject });
				waiting.set(key, list);
			});
			return { ready, release: () => { record.released = true; } };
		}
	};
	return {
		source,
		leases,
		live: () => leases.filter((lease) => !lease.released).length,
		arrive(assetId: string, transparent = false) {
			for (const [key, list] of waiting) {
				if (!key.startsWith(`${assetId}/`)) continue;
				let texture = textures.get(key);
				if (texture === undefined) {
					texture = new Texture();
					textures.set(key, texture);
				}
				for (const deferred of list) deferred.resolve({ texture, transparent });
				waiting.delete(key);
			}
		},
		fail(assetId: string, message: string) {
			for (const [key, list] of waiting) {
				if (!key.startsWith(`${assetId}/`)) continue;
				for (const deferred of list) deferred.reject(new Error(message));
				waiting.delete(key);
			}
		},
		texture: (assetId: string) => [...textures].find(([key]) => key.startsWith(`${assetId}/`))?.[1]
	};
}

function setup(ghost = false) {
	const store = createMaterialStore();
	const geometry = createGeometryStore();
	const onArrival = vi.fn();
	const onError = vi.fn();
	const representation = createSceneArtworkRepresentation({ store, geometry, ghost, onArrival, onError });
	return { store, geometry, representation, onArrival, onError };
}

function meshes(root: Object3D | null): Mesh[] {
	if (root === null) throw new Error('no root');
	return root.children.filter((child): child is Mesh => child instanceof Mesh);
}

function named(root: Object3D | null, prefix: string): Mesh {
	const mesh = meshes(root).find((child) => child.name.startsWith(`${prefix}:`));
	if (mesh === undefined) throw new Error(`no ${prefix}`);
	return mesh;
}

function worldPositions(mesh: Mesh): number[] {
	mesh.updateMatrixWorld(true);
	const position = mesh.geometry.getAttribute('position');
	const out: number[] = [];
	const vertex = new Vector3();
	for (let index = 0; index < position.count; index += 1) {
		vertex.fromBufferAttribute(position, index).applyMatrix4(mesh.matrixWorld);
		out.push(vertex.x, vertex.y, vertex.z);
	}
	return out;
}

function localPositions(geometry: { getAttribute(name: string): { array: ArrayLike<number> } }): number[] {
	return Array.from(geometry.getAttribute('position').array);
}

describe('E9/R5 — Artwork sharing counts (identical fixture)', () => {
	it('20 framed Artworks of 4 sizes hold 1 + 3·4 = 13 buffers (baseline 80)', async () => {
		const images = scope();
		const { store, geometry, representation, onArrival } = setup();
		const items = framedFixture();
		representation.update(items, images.source);
		images.arrive(ASSET);
		await representation.idle();

		const sizes = new Set(items.map((item) => item.imageSize.join('x'))).size;
		expect(sizes).toBe(4);
		expect(geometry.stats().live).toBe(1 + 3 * sizes);
		expect(items.reduce((sum, item) => sum + baselineInventory(item, false).geometries, 0)).toBe(80);
		// One image material, one frame colour, and the Mat and gallery backing
		// share one Lambert colour (both are the Mat colour): 3 (baseline 80).
		expect(store.stats().live).toBe(3);
		expect(items.reduce((sum, item) => sum + baselineInventory(item, false).materials, 0)).toBe(80);
		expect(onArrival).toHaveBeenCalledTimes(COUNTING_ARTWORKS);
		expect(images.leases).toHaveLength(COUNTING_ARTWORKS);
		representation.dispose();
	});

	it('the unframed counting fixture holds 1 buffer and 1 material (baseline 20 and 20)', async () => {
		const images = scope();
		const { store, geometry, representation } = setup();
		const items = Array.from({ length: COUNTING_ARTWORKS }, (_, index) => describeSceneArtwork(artwork(index)));
		representation.update(items, images.source);
		images.arrive(ASSET);
		await representation.idle();
		expect(geometry.stats().live).toBe(1);
		expect(store.stats().live).toBe(1);
		expect(items.reduce((sum, item) => sum + baselineInventory(item, false).geometries, 0)).toBe(20);
		representation.dispose();
	});

	it('a frame colour is not part of the buffer key', () => {
		const walnut = describeSceneArtwork(artwork(0, { frame: GALLERY_MAT }));
		const black = describeSceneArtwork(artwork(0, { frame: { ...GALLERY_MAT, color: 'black' } }));
		expect(black.frame!.geometry).toEqual(walnut.frame!.geometry);
		expect(black.frame!.color).not.toBe(walnut.frame!.color);
	});

	it('keys each frame profile by the numbers it is built from', async () => {
		const images = scope();
		const { geometry, representation } = setup();
		const profiles: (ArtworkFrame | undefined)[] = [
			undefined,
			{ style: 'none', mat: true, color: 'black' },
			{ style: 'thin', mat: false, color: 'black' },
			{ style: 'thin', mat: true, color: 'ivory' },
			{ style: 'gallery', mat: false, color: 'walnut' },
			GALLERY_MAT,
			{ style: 'float', mat: false, color: 'black' },
			{ style: 'float', mat: true, color: 'black' }
		];
		const items = profiles.map((frame, index) =>
			describeSceneArtwork(artwork(index, { widthMeters: 0.8, ...(frame ? { frame } : {}) }))
		);
		representation.update(items, images.source);
		images.arrive(ASSET);
		await representation.idle();
		const keys = new Set<string>(['unit:plane']);
		for (const item of items) {
			for (const part of [item.frame, item.mat, item.backing]) {
				if (part !== null) keys.add(part.geometry.kind + JSON.stringify(part.geometry));
			}
		}
		expect(geometry.stats().live).toBe(keys.size);
		// Every drawn Artwork matches its baseline mesh inventory exactly.
		for (const item of items) {
			expect(meshes(representation.objectOf(item.id))).toHaveLength(baselineInventory(item, false).geometries);
		}
		representation.dispose();
	});
});

describe('E9/R5 — Artwork fidelity against the removed component', () => {
	it('draws the image, frame, Mat and backing with the component’s geometry and materials', async () => {
		const images = scope();
		const { representation } = setup();
		const entity = artwork(1, { frame: { style: 'float', mat: true, color: 'black' }, rotation: [0, Math.PI / 2, 0] });
		const item = describeSceneArtwork(entity);
		representation.update([item], images.source);
		images.arrive(ASSET);
		await representation.idle();
		const root = representation.objectOf(entity.id)!;
		expect(root.position.toArray()).toEqual(entity.position);
		expect(root.rotation.toArray().slice(0, 3)).toEqual(entity.rotation);
		// Child order is the component's: image, frame, Mat, backing.
		expect(meshes(root).map((mesh) => mesh.name.split(':')[0])).toEqual([
			'SceneArtworkImage',
			'SceneArtworkFrame',
			'SceneArtworkMat',
			'SceneArtworkBacking'
		]);

		const [width, height] = item.imageSize;
		const image = named(root, 'SceneArtworkImage');
		// `unit:plane` scaled by (w, h, 1) is `PlaneGeometry(w, h)` vertex for vertex
		// in the float32 the GPU sees (halving is exact, so ±0.5·w = ±w/2).
		const scaled = worldPositions(new Mesh(image.geometry)).map((value, index) =>
			Math.fround(value * Math.fround([width, height, 1][index % 3]!))
		);
		expect(scaled).toEqual(localPositions(new PlaneGeometry(width, height)));
		expect(image.scale.toArray()).toEqual([width, height, 1]);
		const surface = image.material as MeshLambertMaterial;
		expect(surface).toBeInstanceOf(MeshLambertMaterial);
		expect(surface.map).toBe(images.texture(ASSET));
		expect(surface.color.getHexString()).toBe('ffffff');
		expect([surface.transparent, surface.depthWrite, surface.opacity]).toEqual([false, true, 1]);
		expect([image.castShadow, image.receiveShadow]).toEqual([true, true]);
		expect(image.customDepthMaterial).toBeUndefined();
		expect(image.customDistanceMaterial).toBeUndefined();

		const frame = named(root, 'SceneArtworkFrame');
		const f = item.frame!.geometry;
		expect(frame.geometry).toBeInstanceOf(ExtrudeGeometry);
		expect(localPositions(frame.geometry)).toEqual(
			localPositions(
				new ExtrudeGeometry(artworkRingShape(f.outerWidth, f.outerHeight, f.outerWidth - 2 * f.faceMeters, f.outerHeight - 2 * f.faceMeters), {
					depth: f.depth,
					bevelEnabled: false,
					steps: 1
				})
			)
		);
		expect((frame.material as MeshLambertMaterial).color.getHexString()).toBe('1b1b1b');
		expect([frame.position.z, frame.castShadow, frame.receiveShadow]).toEqual([0, true, true]);

		const mat = named(root, 'SceneArtworkMat');
		const m = item.mat!.geometry;
		expect(mat.geometry).toBeInstanceOf(ShapeGeometry);
		expect(localPositions(mat.geometry)).toEqual(
			localPositions(new ShapeGeometry(artworkRingShape(m.width, m.height, m.innerWidth, m.innerHeight)))
		);
		expect((mat.material as MeshLambertMaterial).color.getHexString()).toBe('f6f3ec');
		expect([mat.position.z, mat.castShadow, mat.receiveShadow]).toEqual([0.002, false, true]);

		const backing = named(root, 'SceneArtworkBacking');
		const b = item.backing!.geometry;
		expect(localPositions(backing.geometry)).toEqual(localPositions(new PlaneGeometry(b.width, b.height)));
		// Float frames back the opening in the dark float colour.
		expect((backing.material as MeshLambertMaterial).color.getHexString()).toBe('2a2420');
		expect([backing.position.z, backing.castShadow, backing.receiveShadow]).toEqual([-0.004, false, true]);
		for (const part of [frame, mat, backing]) {
			const material = part.material as MeshLambertMaterial;
			expect([material.transparent, material.depthWrite, material.opacity]).toEqual([false, true, 1]);
		}
		representation.dispose();
	});

	it('keeps the alpha exception for transparent images: blended surface, alpha-tested shadow passes', async () => {
		const images = scope();
		const { store, representation } = setup();
		const items = [describeSceneArtwork(artwork(0)), describeSceneArtwork(artwork(1))];
		representation.update(items, images.source);
		images.arrive(ASSET, true);
		await representation.idle();
		const image = named(representation.objectOf(items[0]!.id), 'SceneArtworkImage');
		const surface = image.material as MeshLambertMaterial;
		expect([surface.transparent, surface.depthWrite, surface.opacity, surface.alphaTest]).toEqual([true, false, 1, 0]);
		const depth = image.customDepthMaterial as MeshDepthMaterial;
		expect(depth).toBeInstanceOf(MeshDepthMaterial);
		expect([depth.map, depth.alphaTest, depth.depthPacking]).toEqual([images.texture(ASSET), 0.5, RGBADepthPacking]);
		const distance = image.customDistanceMaterial as MeshDistanceMaterial;
		expect(distance).toBeInstanceOf(MeshDistanceMaterial);
		expect([distance.map, distance.alphaTest]).toEqual([images.texture(ASSET), 0.5]);
		// Two Artworks of one image share all three: surface, depth and distance.
		const other = named(representation.objectOf(items[1]!.id), 'SceneArtworkImage');
		expect(other.material).toBe(image.material);
		expect(other.customDepthMaterial).toBe(depth);
		expect(other.customDistanceMaterial).toBe(distance);
		expect(store.stats().live).toBe(3);
		// Baseline: 1 surface + 1 depth + 1 distance per Artwork.
		expect(items.reduce((sum, item) => sum + baselineInventory(item, true).materials, 0)).toBe(6);
		representation.dispose();
	});

	it('draws the ghost translucent, without shadows or the alpha exception', async () => {
		const images = scope();
		const { representation } = setup(true);
		const item = describeSceneArtwork(artwork(0, { frame: GALLERY_MAT }));
		representation.update([item], images.source);
		images.arrive(ASSET, true);
		await representation.idle();
		const root = representation.objectOf(item.id);
		for (const mesh of meshes(root)) {
			const material = mesh.material as MeshLambertMaterial;
			expect([material.transparent, material.depthWrite, material.opacity]).toEqual([true, false, 0.65]);
			expect([mesh.castShadow, mesh.receiveShadow]).toEqual([false, false]);
		}
		expect(named(root, 'SceneArtworkImage').customDepthMaterial).toBeUndefined();
		representation.dispose();
	});

	it('a ghost and the Scene on one Canvas share buffers but never a material', async () => {
		const images = scope();
		const store = createMaterialStore();
		const geometry = createGeometryStore();
		const scene = createSceneArtworkRepresentation({ store, geometry });
		const ghost = createSceneArtworkRepresentation({ store, geometry, ghost: true });
		const item = describeSceneArtwork(artwork(0, { frame: GALLERY_MAT }));
		scene.update([item], images.source);
		ghost.update([item], images.source);
		images.arrive(ASSET);
		await Promise.all([scene.idle(), ghost.idle()]);
		const a = named(scene.objectOf(item.id), 'SceneArtworkImage');
		const b = named(ghost.objectOf(item.id), 'SceneArtworkImage');
		expect(a.geometry).toBe(b.geometry);
		expect(a.material).not.toBe(b.material);
		scene.dispose();
		ghost.dispose();
		expect(store.stats().live).toBe(0);
		expect(geometry.stats().live).toBe(0);
	});
});

describe('E9/R5 — image leases and arrivals', () => {
	it('draws nothing until the image arrives, then reports the arrival once', async () => {
		const images = scope();
		const { store, geometry, representation, onArrival } = setup();
		const item = describeSceneArtwork(artwork(0));
		representation.update([item], images.source);
		expect(representation.object3d.children).toHaveLength(0);
		expect(store.stats().live).toBe(0);
		expect(geometry.stats().live).toBe(0);
		images.arrive(ASSET);
		await representation.idle();
		expect(representation.object3d.children).toHaveLength(1);
		expect(onArrival).toHaveBeenCalledTimes(1);
		expect(onArrival).toHaveBeenCalledWith(item.id);
		representation.dispose();
	});

	it('draws nothing without a scope, and leases once one is given', async () => {
		const images = scope();
		const { representation } = setup();
		const items = [describeSceneArtwork(artwork(0))];
		representation.update(items, null);
		expect(images.leases).toHaveLength(0);
		representation.update(items, images.source);
		expect(images.leases).toHaveLength(1);
		images.arrive(ASSET);
		await representation.idle();
		expect(representation.object3d.children).toHaveLength(1);
		representation.dispose();
	});

	it('rejects a stale arrival after the source was replaced', async () => {
		const images = scope();
		const { store, representation, onArrival } = setup();
		const first = describeSceneArtwork(artwork(0));
		representation.update([first], images.source);
		const replaced = describeSceneArtwork(
			artwork(0, { source: { kind: 'image', assetId: OTHER_ASSET, pixelWidth: 800, pixelHeight: 600 } })
		);
		representation.update([replaced], images.source);
		expect(images.leases.map((lease) => lease.released)).toEqual([true, false]);
		images.arrive(ASSET);
		await Promise.resolve();
		expect(representation.object3d.children).toHaveLength(0);
		expect(onArrival).not.toHaveBeenCalled();
		images.arrive(OTHER_ASSET);
		await representation.idle();
		const image = named(representation.objectOf(replaced.id), 'SceneArtworkImage');
		expect((image.material as MeshLambertMaterial).map).toBe(images.texture(OTHER_ASSET));
		expect(store.stats().live).toBe(1);
		representation.dispose();
	});

	it('a replaced drawn source releases its image and its material, and the new image reappears', async () => {
		const images = scope();
		const { store, representation } = setup();
		const first = describeSceneArtwork(artwork(0));
		representation.update([first], images.source);
		images.arrive(ASSET);
		await representation.idle();
		const old = named(representation.objectOf(first.id), 'SceneArtworkImage').material;
		const replaced = describeSceneArtwork(
			artwork(0, { source: { kind: 'image', assetId: OTHER_ASSET, pixelWidth: 800, pixelHeight: 600 } })
		);
		representation.update([replaced], images.source);
		// Hidden until the new image arrives, as the component's `texture = null`.
		expect(representation.object3d.children).toHaveLength(0);
		expect(images.live()).toBe(1);
		expect(store.stats()).toMatchObject({ live: 0, disposed: 1 });
		images.arrive(OTHER_ASSET);
		await representation.idle();
		const next = named(representation.objectOf(replaced.id), 'SceneArtworkImage').material;
		expect(next).not.toBe(old);
		expect((next as MeshLambertMaterial).map).toBe(images.texture(OTHER_ASSET));
		representation.dispose();
	});

	it('a replaced scope re-leases every Artwork from the new scope', async () => {
		const first = scope();
		const second = scope();
		const { representation } = setup();
		const items = [describeSceneArtwork(artwork(0)), describeSceneArtwork(artwork(1))];
		representation.update(items, first.source);
		first.arrive(ASSET);
		await representation.idle();
		// Both drawn groups leave the frame: the consumer must invalidate.
		expect(representation.update(items, second.source).detached).toBe(2);
		expect(first.live()).toBe(0);
		expect(second.live()).toBe(2);
		// A null scope with nothing drawn detaches nothing.
		expect(representation.update(items, null).detached).toBe(0);
		representation.update(items, second.source);
		second.arrive(ASSET);
		await representation.idle();
		const image = named(representation.objectOf(items[0]!.id), 'SceneArtworkImage');
		expect((image.material as MeshLambertMaterial).map).toBe(second.texture(ASSET));
		representation.dispose();
	});

	it('reports a failed image and draws nothing', async () => {
		const images = scope();
		const { store, representation, onError, onArrival } = setup();
		representation.update([describeSceneArtwork(artwork(0))], images.source);
		images.fail(ASSET, 'Artwork image differs from the saved source.');
		await representation.idle();
		expect(onError).toHaveBeenCalledWith('Artwork image differs from the saved source.');
		expect(onArrival).not.toHaveBeenCalled();
		expect(representation.object3d.children).toHaveLength(0);
		expect(store.stats().live).toBe(0);
		representation.dispose();
	});

	it('an arrival after dispose draws nothing and every lease is back', async () => {
		const images = scope();
		const { store, geometry, representation, onArrival } = setup();
		representation.update(framedFixture(), images.source);
		representation.dispose();
		expect(images.live()).toBe(0);
		images.arrive(ASSET);
		await Promise.resolve();
		await Promise.resolve();
		expect(onArrival).not.toHaveBeenCalled();
		expect(store.stats().live).toBe(0);
		expect(geometry.stats().live).toBe(0);
	});
});

describe('E9/R5 — retained edits', () => {
	it('a placement edit moves the group and acquires nothing', async () => {
		const images = scope();
		const { store, geometry, representation } = setup();
		const item = describeSceneArtwork(artwork(0, { frame: GALLERY_MAT }));
		representation.update([item], images.source);
		images.arrive(ASSET);
		await representation.idle();
		const root = representation.objectOf(item.id);
		const before = { materials: store.stats().acquired, geometries: geometry.stats().acquired };
		const moved = describeSceneArtwork(artwork(0, { frame: GALLERY_MAT, position: [4, 1.2, 3] }));
		const stats = representation.update([moved], images.source);
		expect(stats).toMatchObject({ sourced: 0, rebodied: 0, moved: 1, released: 0 });
		expect(representation.objectOf(item.id)).toBe(root);
		expect(root!.position.toArray()).toEqual([4, 1.2, 3]);
		expect({ materials: store.stats().acquired, geometries: geometry.stats().acquired }).toEqual(before);
		expect(images.leases).toHaveLength(1);
		representation.dispose();
	});

	it('a resize keeps the image lease and every material, and swaps only the sized buffers', async () => {
		const images = scope();
		const { store, geometry, representation } = setup();
		const item = describeSceneArtwork(artwork(0, { frame: GALLERY_MAT }));
		representation.update([item], images.source);
		images.arrive(ASSET);
		await representation.idle();
		const createdMaterials = store.stats().created;
		const resized = describeSceneArtwork(artwork(0, { frame: GALLERY_MAT, widthMeters: 1.2 }));
		const stats = representation.update([resized], images.source);
		expect(stats).toMatchObject({ sourced: 0, rebodied: 1 });
		expect(images.leases).toHaveLength(1);
		expect(store.stats().created).toBe(createdMaterials);
		// The unit plane stays; the three sized buffers are replaced.
		expect(geometry.stats()).toMatchObject({ live: 4, created: 7, disposed: 3 });
		expect(named(representation.objectOf(item.id), 'SceneArtworkImage').scale.x).toBe(1.2);
		representation.dispose();
	});

	it('removing an Artwork releases exactly its leases', async () => {
		const images = scope();
		const { store, geometry, representation } = setup();
		const items = framedFixture();
		representation.update(items, images.source);
		images.arrive(ASSET);
		await representation.idle();
		const stats = representation.update(items.slice(1), images.source);
		expect(stats.released).toBe(1);
		expect(images.live()).toBe(COUNTING_ARTWORKS - 1);
		// Artwork 0 has size 0.4, which artwork 4, 8… still use: nothing is disposed.
		expect(geometry.stats().disposed).toBe(0);
		expect(store.stats().disposed).toBe(0);
		representation.dispose();
		expect(store.stats().live).toBe(0);
		expect(geometry.stats().live).toBe(0);
	});
});

describe('E9 — Artwork in the Scene family dispatch', () => {
	function runtimeScene(entities: SceneArtworkEntity[]): RuntimeScene {
		return { entities, materials: [], textures: [] } as unknown as RuntimeScene;
	}

	it('the Scene description carries Artworks and the root draws them once, unregistered for picking', async () => {
		const images = scope();
		const store = createMaterialStore();
		const geometry = createGeometryStore();
		const onRoot = vi.fn();
		const representation = createSceneEntityRepresentation({
			store,
			geometry,
			onRoot,
			artworkScope: () => images.source
		});
		const scene = runtimeScene(Array.from({ length: COUNTING_ARTWORKS }, (_, index) => artwork(index, { frame: GALLERY_MAT })));
		const description = describeSceneRender(scene);
		expect(description.items).toHaveLength(0);
		expect(description.artworks.map((item) => item.id)).toEqual(scene.entities.map((entity) => entity.id));
		const stats = representation.update(description);
		expect(stats.artworks).toMatchObject({ items: COUNTING_ARTWORKS, sourced: COUNTING_ARTWORKS });
		images.arrive(ASSET);
		await representation.idle();
		expect(geometry.stats().live).toBe(13);
		// Artwork was never in the Stage pick index; it still is not.
		expect(onRoot).not.toHaveBeenCalled();
		const first = representation.objectOf(scene.entities[0]!.id);
		expect(first?.name).toBe(`SceneArtwork:${scene.entities[0]!.id}`);
		// One draw per Artwork: exactly one group under the root per id.
		const groups: string[] = [];
		representation.object3d.traverse((node) => {
			if (node.name.startsWith('SceneArtwork:')) groups.push(node.name);
		});
		expect(groups).toHaveLength(COUNTING_ARTWORKS);
		// The same description is a no-op for the artwork handler too.
		expect(representation.update(description).artworks).toMatchObject({ sourced: 0, moved: 0, rebodied: 0 });
		representation.dispose();
		expect(images.live()).toBe(0);
		expect(store.stats().live).toBe(0);
		expect(geometry.stats().live).toBe(0);
	});

	it('a scope change without a new description re-leases through the root', () => {
		let current: ArtworkImageSource | null = null;
		const images = scope();
		const representation = createSceneEntityRepresentation({
			store: createMaterialStore(),
			geometry: createGeometryStore(),
			artworkScope: () => current
		});
		const description = describeSceneRender(runtimeScene([artwork(0)]));
		representation.update(description);
		expect(images.leases).toHaveLength(0);
		current = images.source;
		expect(representation.update(description).artworks.sourced).toBe(1);
		representation.dispose();
	});
});
