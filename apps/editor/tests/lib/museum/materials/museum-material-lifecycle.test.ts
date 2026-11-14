// @vitest-environment jsdom
/**
 * R2b — the material component's mounted lifecycle.
 *
 * These mount the real component inside the real Threlte `<T>` with the
 * contexts a Canvas provides (created by `@threlte/core`'s own factories), so
 * what is measured is the library's attachment and disposal behaviour, not a
 * mock of it. Two regressions are pinned:
 *
 * - the effect reads only descriptor inputs. A lease it owns is plain state, so
 *   publishing a lease cannot re-run the effect (an update loop would show as a
 *   growing acquire count, or hang the test);
 * - `dispose={false}` keeps the shared instance out of Threlte's disposal
 *   registry, so the reference-counted store remains the only disposal
 *   authority. Unmounting one consumer must not dispose a material another one
 *   still draws, and the last release must dispose exactly once.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

// `@threlte/core` reads `devicePixelRatio` at import time, which needs matchMedia.
vi.hoisted(() => {
	Object.defineProperty(window, 'matchMedia', {
		configurable: true,
		value: () => ({ matches: false, addEventListener() {}, removeEventListener() {} })
	});
});

import { flushSync, mount, tick, unmount } from 'svelte';
import { MeshStandardMaterial, Texture } from 'three';
import Harness, {
	type MaterialLifecycleHandle,
	type SurfaceSpec
} from './fixtures/material-lifecycle-harness.svelte';
import { getMaterial } from '$lib/content/materials';
import {
	__resetDefaultSourceLoaderForTests,
	deferredTextureReleaseCount,
	flushDeferredTextureReleases,
	resetTextureCachesForTests,
	setDefaultTextureSourceLoader
} from '$lib/render/resources/texture-store';

const PLAIN: SurfaceSpec = { materialId: 'plaster-warm', surfaceSize: [1, 1], textures: 'off' };

type Mounted = { handle: MaterialLifecycleHandle; component: ReturnType<typeof mount> };

let open: Mounted | null = null;

function mountSurfaces(surfaces: SurfaceSpec[]): Mounted {
	const handle = {} as MaterialLifecycleHandle;
	const target = document.createElement('div');
	document.body.append(target);
	const component = mount(Harness, { target, props: { surfaces, handle } });
	flushSync();
	open = { handle, component };
	return open;
}

afterEach(async () => {
	if (open !== null) {
		await unmount(open.component);
		open = null;
	}
	flushDeferredTextureReleases();
	resetTextureCachesForTests();
	__resetDefaultSourceLoaderForTests();
	document.body.replaceChildren();
});

describe('R2b — MuseumMaterial mounted lifecycle', () => {
	it('acquires once on mount and its own publication does not re-run the effect', async () => {
		open = mountSurfaces([PLAIN]);
		const store = open.handle.resources.materials;
		expect(store.stats()).toMatchObject({ created: 1, acquired: 1, live: 1 });

		const material = open.handle.meshes[0]!.material;
		expect(material).toBeInstanceOf(MeshStandardMaterial);

		// Several flushes would expose a self-triggered effect as more acquires.
		for (let pass = 0; pass < 4; pass += 1) {
			await tick();
			flushSync();
		}
		expect(store.stats().acquired).toBe(1);
		expect(open.handle.meshes[0]!.material).toBe(material);
	});

	it('replaces the lease when a descriptor input changes and releases the previous one', async () => {
		open = mountSurfaces([PLAIN]);
		const store = open.handle.resources.materials;
		const first = open.handle.meshes[0]!.material as MeshStandardMaterial;
		const dispose = vi.spyOn(first, 'dispose');

		open.handle.setSurface(0, { ...PLAIN, tint: '#112233' });
		flushSync();
		await tick();

		const second = open.handle.meshes[0]!.material as MeshStandardMaterial;
		expect(second).not.toBe(first);
		expect(second.color.getHexString()).toBe('112233');
		expect(dispose).toHaveBeenCalledTimes(1);
		expect(store.stats()).toMatchObject({ created: 2, disposed: 1, live: 1 });
	});

	it('shares one instance between two consumers and keeps it when one unmounts', async () => {
		open = mountSurfaces([PLAIN, { ...PLAIN }]);
		const store = open.handle.resources.materials;
		expect(store.stats()).toMatchObject({ created: 1, acquired: 2, live: 1 });

		const shared = open.handle.meshes[0]!.material as MeshStandardMaterial;
		expect(open.handle.meshes[1]!.material).toBe(shared);
		const dispose = vi.spyOn(shared, 'dispose');

		open.handle.unmountSurface(1);
		flushSync();
		await tick();

		// Threlte would have disposed the shared instance here without `dispose={false}`.
		expect(dispose).not.toHaveBeenCalled();
		expect(store.stats()).toMatchObject({ live: 1, disposed: 0 });
		expect(open.handle.meshes[0]!.material).toBe(shared);

		open.handle.unmountSurface(0);
		flushSync();
		await tick();

		// The store, not Threlte, performs the one disposal of the final release.
		expect(dispose).toHaveBeenCalledTimes(1);
		expect(store.stats()).toMatchObject({ live: 0, disposed: 1 });
	});

	it('an unmounting consumer cannot dispose a material another lease still holds', async () => {
		open = mountSurfaces([PLAIN]);
		const store = open.handle.resources.materials;
		const material = open.handle.meshes[0]!.material as MeshStandardMaterial;
		const dispose = vi.spyOn(material, 'dispose');

		// A non-`<T>` consumer — the retained Scene representation — leases the same
		// instance directly. Threlte's registry only counts `<T>` mounts, so without
		// `dispose={false}` this unmount would free a material the store still holds.
		const definition = getMaterial('plaster-warm');
		const other = store.acquire({
			kind: 'standard',
			color: definition.fallbackColor,
			roughness: definition.roughness,
			metalness: definition.metalness,
			toneMapped: true
		});
		expect(other.material).toBe(material);
		expect(store.stats()).toMatchObject({ live: 1, acquired: 2 });

		const released = unmount(open.component);
		open = null;
		await released;
		flushSync();

		expect(dispose).not.toHaveBeenCalled();
		expect(store.stats()).toMatchObject({ live: 1, disposed: 0 });
		other.release();
		expect(dispose).toHaveBeenCalledTimes(1);
	});

	it('disposes a single consumer exactly once when the whole mount is released', async () => {
		open = mountSurfaces([PLAIN]);
		const store = open.handle.resources.materials;
		const material = open.handle.meshes[0]!.material as MeshStandardMaterial;
		const dispose = vi.spyOn(material, 'dispose');

		await unmount(open.component);
		open = null;
		flushSync();

		expect(dispose).toHaveBeenCalledTimes(1);
		expect(store.stats()).toMatchObject({ live: 0, disposed: 1 });
	});

	it('replaces the untextured surface when maps arrive, then disposes each lease exactly once', async () => {
		setDefaultTextureSourceLoader(async () => new Texture());
		open = mountSurfaces([{ materialId: 'plaster-warm', surfaceSize: [2, 2] }]);
		const store = open.handle.resources.materials;
		const untextured = open.handle.meshes[0]!.material as MeshStandardMaterial;
		expect(untextured.map).toBeNull();
		const untexturedDispose = vi.spyOn(untextured, 'dispose');
		// The base is drawn while the maps load: exactly the old component's behaviour.
		expect(store.stats()).toMatchObject({ created: 1, acquired: 1, live: 1 });

		await vi.waitFor(() => {
			flushSync();
			const current = open!.handle.meshes[0]!.material as MeshStandardMaterial;
			expect(current).not.toBe(untextured);
			expect(current.map).toBeInstanceOf(Texture);
		});

		const textured = open.handle.meshes[0]!.material as MeshStandardMaterial;
		const map = textured.map!;
		const texturedDispose = vi.spyOn(textured, 'dispose');
		const mapDispose = vi.spyOn(map, 'dispose');
		expect(untexturedDispose).toHaveBeenCalledTimes(1);
		expect(store.stats()).toMatchObject({ created: 2, disposed: 1, live: 1 });

		const released = unmount(open.component);
		open = null;
		await released;
		flushSync();

		// Material disposal is immediate and exact. The variant release is deferred
		// to the idle microtask (unit-tested deterministically in
		// scene-entity-representation.test.ts), and disposing it there is once.
		expect(texturedDispose).toHaveBeenCalledTimes(1);
		expect(mapDispose).toHaveBeenCalledTimes(1);
		flushDeferredTextureReleases();
		expect(mapDispose).toHaveBeenCalledTimes(1);
		expect(deferredTextureReleaseCount()).toBe(0);
	});
});
