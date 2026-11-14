// @vitest-environment jsdom
/**
 * E8/R5 + R2c — AssetModel's mounted lifecycle, through the real host and the real
 * Threlte `<T>` with the Canvas stores. Only the GLB loader and the texture source
 * are faked, so these pin three things the unit tests cannot reach:
 *
 * - two consumers of one model share its store materials and template geometry, and
 *   unmounting one never disposes what the other still draws;
 * - a superseded texture completion never mounts or restyles, and the newest look is
 *   never stranded;
 * - an unscoped model mounts at arrival and remaps asynchronously, and a scoped model
 *   mounts textured.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// `@threlte/core` reads `devicePixelRatio` at import time, which needs matchMedia.
vi.hoisted(() => {
	Object.defineProperty(window, 'matchMedia', {
		configurable: true,
		value: () => ({ matches: false, addEventListener() {}, removeEventListener() {} })
	});
});

// A stand-in for `useGltf`: each URL is a channel the test delivers into.
const fakeGltf = vi.hoisted(() => {
	type Listener = (value: unknown) => void;
	class Channel {
		value: unknown = undefined;
		private readonly listeners = new Set<Listener>();
		set(value: unknown): void {
			this.value = value;
			for (const listener of [...this.listeners]) listener(value);
		}
		subscribe(listener: Listener): () => void {
			this.listeners.add(listener);
			listener(this.value);
			return () => {
				this.listeners.delete(listener);
			};
		}
	}
	const channels = new Map<string, { model: Channel; error: Channel }>();
	function channelsFor(url: string) {
		let found = channels.get(url);
		if (found === undefined) {
			found = { model: new Channel(), error: new Channel() };
			channels.set(url, found);
		}
		return found;
	}
	return {
		loader: {
			load(url: string) {
				const found = channelsFor(url);
				return {
					subscribe: (listener: Listener) => found.model.subscribe(listener),
					error: { subscribe: (listener: Listener) => found.error.subscribe(listener) }
				};
			}
		},
		deliver(url: string, gltf: unknown): void {
			channelsFor(url).model.set(gltf);
		},
		reset(): void {
			channels.clear();
		}
	};
});

vi.mock('@threlte/extras', async (importOriginal) => ({
	...(await importOriginal<typeof import('@threlte/extras')>()),
	useGltf: () => fakeGltf.loader,
	useMeshopt: () => undefined
}));

import { flushSync, mount, unmount } from 'svelte';
import { BoxGeometry, Group, Mesh, MeshStandardMaterial, Texture, type Material } from 'three';
import Harness, {
	type AssetModelHandle,
	type ConsumerSpec
} from './fixtures/asset-model-harness.svelte';
import type { EffectiveSceneMaterial } from '$lib/museum/materials/scene-instance-material';
import {
	__resetDefaultSourceLoaderForTests,
	flushDeferredTextureReleases,
	resetTextureCachesForTests,
	setDefaultTextureSourceLoader,
	type TextureLoadScope
} from '$lib/render/resources/texture-store';

// Texture requests stay pending until the test finishes them, so completion order is
// the test's to choose.
type PendingTexture = { resolve(texture: Texture): void };
const pendingTextures = new Map<string, PendingTexture>();

function requestTexture(uri: string): Promise<Texture> {
	return new Promise((resolve) => {
		pendingTextures.set(uri, { resolve });
	});
}

function finishTexture(uri: string): void {
	const pending = pendingTextures.get(uri);
	if (pending === undefined) throw new Error(`no pending texture for ${uri}`);
	pendingTextures.delete(uri);
	pending.resolve(new Texture());
}

function look(name: string, color: string, uri: string): EffectiveSceneMaterial {
	return {
		catalogue: null,
		slotUris: { map: uri },
		roughness: 0.8,
		metalness: 0,
		color: `#${color}`,
		defaultTileSizeMeters: [1, 1],
		variantSeed: `seed-${name}`
	};
}

function scopeFor(name: string): TextureLoadScope {
	return { scopeId: `asset-model-${name}`, loader: requestTexture };
}

/** A two-mesh GLB: the template the loader hands every consumer of one URL. */
function gltfOf(name: string) {
	const scene = new Group();
	scene.name = name;
	for (let index = 0; index < 2; index += 1) {
		const mesh = new Mesh(new BoxGeometry(1, 1, 1), new MeshStandardMaterial({ color: 0x808080 }));
		mesh.name = `${name}-${index}`;
		mesh.position.set(index, 0, 0);
		scene.add(mesh);
	}
	return { scene, animations: [] as never[] };
}

type Gltf = ReturnType<typeof gltfOf>;

/** The meshes the consumers actually draw: their geometry is the template's. */
function instanceMeshes(handle: AssetModelHandle, gltf: Gltf): Mesh[] {
	const geometries = new Set(gltf.scene.children.map((child) => (child as Mesh).geometry));
	const meshes: Mesh[] = [];
	handle.root.traverse((candidate) => {
		if (candidate instanceof Mesh && geometries.has(candidate.geometry)) meshes.push(candidate);
	});
	return meshes;
}

function colorsOf(handle: AssetModelHandle, gltf: Gltf): string[] {
	return instanceMeshes(handle, gltf).map((mesh) =>
		(mesh.material as MeshStandardMaterial).color.getHexString()
	);
}

function mapsOf(handle: AssetModelHandle, gltf: Gltf): (Texture | null)[] {
	return instanceMeshes(handle, gltf).map((mesh) => (mesh.material as MeshStandardMaterial).map);
}

type Open = { handle: AssetModelHandle; component: ReturnType<typeof mount>; target: HTMLElement };
let open: Open | null = null;

function mountConsumers(consumers: ConsumerSpec[]): AssetModelHandle {
	const handle = {} as AssetModelHandle;
	const target = document.createElement('div');
	document.body.append(target);
	const component = mount(Harness, { target, props: { consumers, handle } });
	flushSync();
	open = { handle, component, target };
	return handle;
}

/** Let every queued promise and effect settle, then flush the DOM. */
async function settle(): Promise<void> {
	await new Promise<void>((resolve) => setTimeout(resolve, 0));
	flushSync();
}

function spec(id: string, patch: Partial<ConsumerSpec> = {}): ConsumerSpec {
	return {
		id,
		url: 'https://models.test/a.glb',
		effective: null,
		scope: null,
		wireframe: false,
		mounted: true,
		...patch
	};
}

afterEach(async () => {
	if (open !== null) {
		await unmount(open.component);
		open.target.remove();
		open = null;
	}
	fakeGltf.reset();
	pendingTextures.clear();
	flushDeferredTextureReleases();
	resetTextureCachesForTests();
	__resetDefaultSourceLoaderForTests();
});

describe('AssetModel mounted — two consumers, scoped teardown', () => {
	it('unmounting one consumer disposes nothing the other still draws; the last one disposes only the store copies', async () => {
		const url = 'https://models.test/teardown.glb';
		const gltf = gltfOf('teardown');
		const handle = mountConsumers([spec('a', { url }), spec('b', { url })]);
		fakeGltf.deliver(url, gltf);
		await settle();

		const store = handle.resources.materials;
		expect(instanceMeshes(handle, gltf)).toHaveLength(4);
		expect(store.stats().live).toBe(2);
		const storeMaterials = [...new Set(instanceMeshes(handle, gltf).map((mesh) => mesh.material))] as Material[];
		expect(storeMaterials).toHaveLength(2);

		const geometries = gltf.scene.children.map((child) => (child as Mesh).geometry);
		const templateMaterials = gltf.scene.children.map((child) => (child as Mesh).material) as Material[];
		let storeDisposals = 0;
		let geometryDisposals = 0;
		let templateDisposals = 0;
		for (const material of storeMaterials) material.addEventListener('dispose', () => (storeDisposals += 1));
		for (const geometry of geometries) geometry.addEventListener('dispose', () => (geometryDisposals += 1));
		for (const material of templateMaterials) material.addEventListener('dispose', () => (templateDisposals += 1));

		handle.update('a', { mounted: false });
		await settle();
		expect(instanceMeshes(handle, gltf)).toHaveLength(2);
		expect(store.stats().live).toBe(2);
		expect(storeDisposals).toBe(0);
		expect(geometryDisposals).toBe(0);
		expect(templateDisposals).toBe(0);

		handle.update('b', { mounted: false });
		await settle();
		expect(instanceMeshes(handle, gltf)).toHaveLength(0);
		expect(store.stats().live).toBe(0);
		expect(storeDisposals).toBe(2);
		expect(geometryDisposals).toBe(0);
		expect(templateDisposals).toBe(0);
	});
});

describe('AssetModel mounted — scoped looks never race', () => {
	it('a superseded look never mounts, and the newest look mounts when its own textures resolve', async () => {
		const url = 'https://models.test/race-1.glb';
		const gltf = gltfOf('race-1');
		const scope = scopeFor('race-1');
		const handle = mountConsumers([spec('a', { url, scope, effective: look('A', 'ff0000', 'race-1-a.png') })]);
		fakeGltf.deliver(url, gltf);
		await settle();
		expect(instanceMeshes(handle, gltf)).toHaveLength(0);

		handle.update('a', { effective: look('B', '00ff00', 'race-1-b.png') });
		await settle();
		finishTexture('race-1-b.png');
		await settle();
		expect(colorsOf(handle, gltf)).toEqual(['00ff00', '00ff00']);
		expect(mapsOf(handle, gltf).every((map) => map !== null)).toBe(true);

		// The superseded A completes last: it must not restyle or acquire for the mounted B.
		const acquired = handle.resources.materials.stats().acquired;
		finishTexture('race-1-a.png');
		await settle();
		expect(colorsOf(handle, gltf)).toEqual(['00ff00', '00ff00']);
		expect(handle.resources.materials.stats().acquired).toBe(acquired);
	});

	it('a superseded look that resolves first never mounts; the newest mounts afterwards', async () => {
		const url = 'https://models.test/race-2.glb';
		const gltf = gltfOf('race-2');
		const scope = scopeFor('race-2');
		const handle = mountConsumers([spec('a', { url, scope, effective: look('A', 'ff0000', 'race-2-a.png') })]);
		fakeGltf.deliver(url, gltf);
		await settle();
		handle.update('a', { effective: look('B', '00ff00', 'race-2-b.png') });
		await settle();

		const acquired = handle.resources.materials.stats().acquired;
		finishTexture('race-2-a.png');
		await settle();
		expect(instanceMeshes(handle, gltf)).toHaveLength(0);
		expect(handle.resources.materials.stats().acquired).toBe(acquired);

		finishTexture('race-2-b.png');
		await settle();
		expect(colorsOf(handle, gltf)).toEqual(['00ff00', '00ff00']);
	});

	it('unmounting while textures are pending mounts nothing when they resolve', async () => {
		const url = 'https://models.test/race-3.glb';
		const gltf = gltfOf('race-3');
		const scope = scopeFor('race-3');
		const handle = mountConsumers([spec('a', { url, scope, effective: look('A', 'ff0000', 'race-3-a.png') })]);
		fakeGltf.deliver(url, gltf);
		await settle();

		handle.update('a', { mounted: false });
		await settle();
		const acquired = handle.resources.materials.stats().acquired;
		finishTexture('race-3-a.png');
		await settle();
		expect(instanceMeshes(handle, gltf)).toHaveLength(0);
		expect(handle.resources.materials.stats()).toMatchObject({ live: 0, acquired });
	});
});

describe('AssetModel mounted — unscoped arrival is immediate', () => {
	beforeEach(() => {
		setDefaultTextureSourceLoader(requestTexture);
	});

	it('mounts at arrival untextured, then remaps when its textures resolve', async () => {
		const url = 'https://models.test/immediate.glb';
		const gltf = gltfOf('immediate');
		const handle = mountConsumers([spec('a', { url, effective: look('A', 'ff0000', 'immediate-a.png') })]);
		fakeGltf.deliver(url, gltf);
		await settle();
		expect(colorsOf(handle, gltf)).toEqual(['ff0000', 'ff0000']);
		expect(mapsOf(handle, gltf).every((map) => map === null)).toBe(true);

		finishTexture('immediate-a.png');
		await settle();
		expect(colorsOf(handle, gltf)).toEqual(['ff0000', 'ff0000']);
		expect(mapsOf(handle, gltf).every((map) => map !== null)).toBe(true);
	});

	it('a superseded unscoped texture completion never restyles the newer look', async () => {
		const url = 'https://models.test/immediate-2.glb';
		const gltf = gltfOf('immediate-2');
		const handle = mountConsumers([spec('a', { url, effective: look('A', 'ff0000', 'immediate-2-a.png') })]);
		fakeGltf.deliver(url, gltf);
		await settle();

		handle.update('a', { effective: look('B', '00ff00', 'immediate-2-b.png') });
		await settle();
		expect(colorsOf(handle, gltf)).toEqual(['00ff00', '00ff00']);
		expect(mapsOf(handle, gltf).every((map) => map === null)).toBe(true);

		finishTexture('immediate-2-a.png');
		await settle();
		expect(colorsOf(handle, gltf)).toEqual(['00ff00', '00ff00']);
		expect(mapsOf(handle, gltf).every((map) => map === null)).toBe(true);

		finishTexture('immediate-2-b.png');
		await settle();
		expect(colorsOf(handle, gltf)).toEqual(['00ff00', '00ff00']);
		expect(mapsOf(handle, gltf).every((map) => map !== null)).toBe(true);
	});
});
