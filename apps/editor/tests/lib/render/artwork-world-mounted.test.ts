// @vitest-environment jsdom
/**
 * E9/R5 + R2c — Artwork and the world grounds mounted through the real
 * `VisitorEntityGroups`, `WorldEnvironment` and `GroundPlinth` under a real
 * Threlte `<T>` tree with the Canvas stores. Only `useThrelte` (there is no WebGL
 * Canvas) and the artwork image source are faked. These pin what the handler
 * unit tests cannot reach:
 *
 * - an Artwork is drawn only after its image arrives, the arrival invalidates and
 *   notifies, and two Artworks of one image share its material;
 * - a replaced artwork scope re-sources every Artwork without a new Scene;
 * - the grounds' materials are store leases, and unmounting the world leaves
 *   zero material, geometry and image leases behind.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
	// The sky gradient asks for a 2D context jsdom does not have; null is its handled path.
	HTMLCanvasElement.prototype.getContext = (() => null) as never;
	Object.defineProperty(window, 'matchMedia', {
		configurable: true,
		value: () => ({ matches: false, addEventListener() {}, removeEventListener() {} })
	});
});

const threlte = vi.hoisted(() => ({ scene: null as unknown, invalidate: (() => {}) as () => void }));
vi.mock('@threlte/core', async (importOriginal) => {
	const actual = await importOriginal<typeof import('@threlte/core')>();
	return { ...actual, useThrelte: () => ({ ...actual, scene: threlte.scene, invalidate: () => threlte.invalidate() }) };
});

import { flushSync, mount, unmount, tick } from 'svelte';
import { Mesh, MeshLambertMaterial, MeshStandardMaterial, Scene, Texture, type Object3D } from 'three';
import type { RuntimeScene, SceneArtworkEntity } from '@portfolio/project-model';
import type { ArtworkImage } from '@portfolio/project-model';
import type { ArtworkScope } from '$lib/render/artwork/artwork-scope';
import Harness, { type WorldHarnessHandle } from './fixtures/ArtworkWorldHarness.svelte';

const ASSET = '00000000-0000-4000-8000-000000000001';

function artwork(index: number, widthMeters: number): SceneArtworkEntity {
	return {
		kind: 'artwork',
		id: `artwork-${index}`,
		name: `Artwork ${index}`,
		position: [index * 1.5, 1.4, 2.4],
		rotation: [0, 0, 0],
		source: { kind: 'image', assetId: ASSET, pixelWidth: 800, pixelHeight: 600 },
		widthMeters,
		frame: { style: 'gallery', mat: true, color: 'walnut' }
	};
}

function runtime(entities: SceneArtworkEntity[]): RuntimeScene {
	return { textures: [], materials: [], entities, objects: [] } as RuntimeScene;
}

/** A controllable scope with the real scope's per-image sharing and lease counting. */
function fakeScope() {
	const texture = new Texture();
	let held = 0;
	const waiting: Array<() => void> = [];
	const scope: ArtworkScope = {
		acquire(_image: ArtworkImage) {
			held += 1;
			let released = false;
			const ready = new Promise<{ texture: Texture; transparent: boolean }>((resolve) => {
				waiting.push(() => resolve({ texture, transparent: false }));
			});
			return { ready, release: () => { if (!released) { released = true; held -= 1; } } };
		},
		dispose() {}
	};
	return {
		scope,
		texture,
		get held() { return held; },
		deliverAll() { for (const resolve of waiting.splice(0)) resolve(); }
	};
}

function meshes(root: Object3D, prefix: string): Mesh[] {
	const found: Mesh[] = [];
	root.traverse((node) => { if (node instanceof Mesh && node.name.startsWith(prefix)) found.push(node); });
	return found;
}

async function settle(): Promise<void> {
	for (let i = 0; i < 4; i += 1) { await Promise.resolve(); await tick(); }
	flushSync();
}

let app: ReturnType<typeof mount> | null = null;
afterEach(() => {
	if (app !== null) unmount(app);
	app = null;
});

function mountWorld(scene: RuntimeScene, scope: ArtworkScope | null, extra: { onFormRendererReady?: () => void } = {}) {
	threlte.scene = new Scene();
	const invalidate = vi.fn();
	threlte.invalidate = invalidate;
	const handle = {} as WorldHarnessHandle;
	app = mount(Harness, { target: document.body, props: { scene, artworkScope: scope, handle, ...extra } });
	flushSync();
	return { handle, invalidate };
}

describe('E9 mounted: Artwork through VisitorEntityGroups', () => {
	it('draws nothing until the image arrives, then invalidates, notifies and shares the image material', async () => {
		const source = fakeScope();
		const ready = vi.fn();
		const { handle, invalidate } = mountWorld(runtime([artwork(0, 0.6), artwork(1, 0.6), artwork(2, 1)]), source.scope, {
			onFormRendererReady: ready
		});
		expect(source.held).toBe(3);
		expect(meshes(handle.root, 'SceneArtwork')).toHaveLength(0);
		invalidate.mockClear();
		source.deliverAll();
		await settle();
		const images = meshes(handle.root, 'SceneArtworkImage');
		expect(images).toHaveLength(3);
		expect(new Set(images.map((mesh) => mesh.material)).size).toBe(1);
		expect((images[0]!.material as MeshLambertMaterial).map).toBe(source.texture);
		expect(invalidate).toHaveBeenCalled();
		expect(ready).toHaveBeenCalledTimes(3);
		// One unit plane; frame, Mat, backing keyed per size: 1 + 3·2 buffers.
		const buffers = new Set(meshes(handle.root, 'SceneArtwork').map((mesh) => mesh.geometry));
		expect(buffers.size).toBe(1 + 3 * 2);
	});

	it('re-sources every Artwork when the scope is replaced, without a new Scene', async () => {
		const first = fakeScope();
		const { handle, invalidate } = mountWorld(runtime([artwork(0, 0.6), artwork(1, 0.8)]), first.scope);
		first.deliverAll();
		await settle();
		const second = fakeScope();
		invalidate.mockClear();
		handle.set({ artworkScope: second.scope });
		flushSync();
		// The drawn Artworks left the frame imperatively; the Canvas is told.
		expect(invalidate).toHaveBeenCalled();
		expect(first.held).toBe(0);
		expect(second.held).toBe(2);
		expect(meshes(handle.root, 'SceneArtwork')).toHaveLength(0);
		second.deliverAll();
		await settle();
		const images = meshes(handle.root, 'SceneArtworkImage');
		expect(images).toHaveLength(2);
		expect((images[0]!.material as MeshLambertMaterial).map).toBe(second.texture);
	});

	it('a cold visitor with no scope draws nothing and takes no lease', () => {
		const { handle } = mountWorld(runtime([artwork(0, 0.6)]), null);
		expect(meshes(handle.root, 'SceneArtwork')).toHaveLength(0);
		expect(handle.resources.materials.stats().live).toBe(
			// Only the grounds are leased: World ground + plinth.
			2
		);
	});
});

describe('E9 mounted: world grounds through the store', () => {
	it('the World ground and plinth draw store materials, and the editor ground swaps by key', async () => {
		const { handle } = mountWorld(runtime([]), null);
		const plinth = meshes(handle.root, 'MuseumGroundPlinth')[0]!;
		expect(plinth.material).toBeInstanceOf(MeshStandardMaterial);
		const lit = handle.resources.materials.stats().live;
		expect(lit).toBe(2);
		handle.set({ flatGround: true });
		flushSync();
		expect(handle.resources.materials.stats().live).toBe(2);
		handle.set({ environment: false });
		flushSync();
		expect(handle.resources.materials.stats().live).toBe(0);
	});

	it('unmounting the world releases every material, geometry and image lease', async () => {
		const source = fakeScope();
		const { handle } = mountWorld(runtime([artwork(0, 0.6), artwork(1, 1)]), source.scope);
		source.deliverAll();
		await settle();
		const { materials, geometry } = handle.resources;
		expect(materials.stats().live).toBeGreaterThan(2);
		unmount(app!);
		app = null;
		flushSync();
		expect(source.held).toBe(0);
		expect(materials.stats().live).toBe(0);
		expect(geometry.stats().live).toBe(0);
	});
});
