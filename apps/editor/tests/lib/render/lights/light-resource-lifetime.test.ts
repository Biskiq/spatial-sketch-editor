// @vitest-environment jsdom
/**
 * E10/R6 — mounted light identity and resource lifetime.
 *
 * Through the real `VisitorEntityGroups` and `WorldEnvironment` with the Canvas
 * stores, every Light object is read by identity and every lease is counted:
 *
 * - **Camera-only edit**: the accepted Scene keeps its identity (E2), so no
 *   light is touched and the Sun is not re-applied.
 * - **Unrelated Scene edit**: a new Scene whose lights are unchanged rebuilds
 *   the description but keeps every Light object; nothing is created, updated or
 *   disposed.
 * - **Changed light**: the same Light object is updated in place.
 * - **Replacement / release**: a kind change disposes the old light and builds a
 *   new one; a removed light and an unmounted world leave zero live lights.
 * - **Per Canvas**: two mounted worlds hold disjoint stores and lights.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
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

import { flushSync, mount, unmount } from 'svelte';
import { DirectionalLight, Light, PointLight, Scene, SpotLight, type Object3D } from 'three';
import type { RuntimeScene, ScenePrimitiveEntity } from '@portfolio/project-model';
import Harness, { type LightWorldHandle, type LightWorldProps } from '../fixtures/LightWorldHarness.svelte';
import { skyFromPreset } from '@portfolio/project-model/units';
import { POINT_OPEN, POINT_RANGED, SPOT_AIMED, runtimeScene } from '../fixtures/light-parity-cases';

const BOX: ScenePrimitiveEntity = {
	kind: 'primitive',
	id: 'box',
	name: 'Box',
	primitive: 'box',
	position: [0, 0.5, 0],
	rotation: [0, 0, 0],
	dimensions: [1, 1, 1],
	materialId: 'paper-white',
	castShadow: true,
	receiveShadow: true
} as unknown as ScenePrimitiveEntity;

function withBox(scene: RuntimeScene, box: ScenePrimitiveEntity): RuntimeScene {
	return { ...scene, entities: [...scene.entities, box] } as RuntimeScene;
}

function lightsIn(world: Object3D): Light[] {
	const found: Light[] = [];
	world.traverse((node) => {
		if ((node as Light).isLight && !(node.type === 'HemisphereLight')) found.push(node as Light);
	});
	return found;
}

const mounted: ReturnType<typeof mount>[] = [];
afterEach(() => {
	for (const app of mounted.splice(0)) unmount(app);
	flushSync();
});

function mountWorld(initial: Partial<LightWorldProps> = {}) {
	const world = new Scene();
	threlte.scene = world;
	const invalidate = vi.fn();
	threlte.invalidate = invalidate;
	const handle = {} as LightWorldHandle;
	const props: LightWorldProps = {
		scene: runtimeScene([POINT_RANGED, POINT_OPEN, SPOT_AIMED]),
		sky: skyFromPreset('daylight', 0),
		bounds: { min: [-4, 0, -4], max: [4, 3, 4] },
		shadowBounds: null,
		groundY: 0,
		flatGround: false,
		includeLights: true,
		...initial
	};
	const app = mount(Harness, { target: document.body, props: { world, handle, initial: props } });
	mounted.push(app);
	flushSync();
	return { world, handle, invalidate, app, props };
}

function byType(world: Object3D): Map<string, Light[]> {
	const map = new Map<string, Light[]>();
	for (const light of lightsIn(world)) map.set(light.type, [...(map.get(light.type) ?? []), light]);
	return map;
}

describe('E10 mounted: light identity across edits', () => {
	it('acquires one lease per authored light plus the Sun', () => {
		const { world, handle } = mountWorld();
		expect(handle.resources.lights.stats()).toEqual({ live: 4, created: 4, disposed: 0, updated: 0 });
		const types = byType(world);
		expect(types.get('PointLight')).toHaveLength(2);
		expect(types.get('SpotLight')).toHaveLength(1);
		expect(types.get('DirectionalLight')).toHaveLength(1);
	});

	it('a Camera-only edit (same Scene identity) touches no light', () => {
		const { world, handle, invalidate, props } = mountWorld();
		const before = lightsIn(world);
		invalidate.mockClear();
		// The Camera unit changed; the accepted Scene and the World frame did not.
		handle.set({ scene: props.scene, bounds: props.bounds });
		flushSync();
		expect(lightsIn(world)).toEqual(before);
		expect(handle.resources.lights.stats()).toEqual({ live: 4, created: 4, disposed: 0, updated: 0 });
		expect(invalidate).not.toHaveBeenCalled();
	});

	it('an unrelated Scene edit keeps every Light object and leases nothing new', () => {
		const { world, handle, invalidate, props } = mountWorld();
		const before = lightsIn(world);
		const withA = withBox(props.scene, BOX);
		handle.set({ scene: withA });
		flushSync();
		invalidate.mockClear();
		const stats = { ...handle.resources.lights.stats() };
		// A second unrelated edit: the box moves; every light entity is the same value.
		handle.set({ scene: withBox(props.scene, { ...BOX, position: [1, 0.5, 0] }) });
		flushSync();
		expect(lightsIn(world).every((light) => before.includes(light))).toBe(true);
		expect(lightsIn(world)).toHaveLength(before.length);
		expect(handle.resources.lights.stats()).toEqual(stats);
		expect(stats).toEqual({ live: 4, created: 4, disposed: 0, updated: 0 });
	});

	it('a changed light updates the same object in place; the others are untouched', () => {
		const { world, handle, invalidate } = mountWorld();
		const spot = byType(world).get('SpotLight')![0]! as SpotLight;
		const points = byType(world).get('PointLight')!;
		invalidate.mockClear();
		handle.set({ scene: runtimeScene([POINT_RANGED, POINT_OPEN, { ...SPOT_AIMED, angle: 0.8, intensity: 1 }]) });
		flushSync();
		expect(byType(world).get('SpotLight')![0]).toBe(spot);
		expect(spot.angle).toBe(0.8);
		expect(spot.intensity).toBe(1);
		expect(byType(world).get('PointLight')).toEqual(points);
		expect(handle.resources.lights.stats()).toEqual({ live: 4, created: 4, disposed: 0, updated: 1 });
		expect(invalidate).toHaveBeenCalled();
	});

	it('a moved light keeps its Light object and moves its holder', () => {
		const { world, handle } = mountWorld();
		const point = lightsIn(world).find((light) => light.parent?.name === 'SceneLight:point-ranged')!;
		handle.set({ scene: runtimeScene([{ ...POINT_RANGED, position: [0, 4, 0] }, POINT_OPEN, SPOT_AIMED]) });
		flushSync();
		const after = lightsIn(world).find((light) => light.parent?.name === 'SceneLight:point-ranged')!;
		expect(after).toBe(point);
		expect(after.parent!.position.toArray()).toEqual([0, 4, 0]);
		expect(handle.resources.lights.stats()).toEqual({ live: 4, created: 4, disposed: 0, updated: 0 });
	});

	it('a kind change replaces: the old light is disposed and a new one built', () => {
		const { world, handle } = mountWorld();
		const old = lightsIn(world).find((light) => light.parent?.name === 'SceneLight:point-ranged')! as PointLight;
		const dispose = vi.spyOn(old, 'dispose');
		handle.set({ scene: runtimeScene([{ ...SPOT_AIMED, id: 'point-ranged' }, POINT_OPEN, SPOT_AIMED]) });
		flushSync();
		const replaced = lightsIn(world).find((light) => light.parent?.name === 'SceneLight:point-ranged')!;
		expect(replaced).toBeInstanceOf(SpotLight);
		expect(old.parent).toBeNull();
		expect(dispose).toHaveBeenCalledTimes(1);
		expect(handle.resources.lights.stats()).toEqual({ live: 4, created: 5, disposed: 1, updated: 0 });
	});

	it('the Sun updates in place on a frame change and releases on paper', () => {
		const { world, handle } = mountWorld();
		const sun = byType(world).get('DirectionalLight')![0]! as DirectionalLight;
		const target = sun.target;
		expect(target.parent).toBe(world);
		handle.set({ bounds: { min: [-9, 0, -9], max: [9, 3, 9] } });
		flushSync();
		expect(byType(world).get('DirectionalLight')![0]).toBe(sun);
		expect(handle.resources.lights.stats().updated).toBe(1);
		handle.set({ sky: null });
		flushSync();
		expect(byType(world).get('DirectionalLight')).toBeUndefined();
		expect(target.parent).toBeNull();
		expect(handle.resources.lights.stats()).toEqual({ live: 3, created: 4, disposed: 1, updated: 1 });
		handle.set({ sky: skyFromPreset('dusk', 0) });
		flushSync();
		expect(byType(world).get('DirectionalLight')![0]).not.toBe(sun);
		expect(handle.resources.lights.stats().live).toBe(4);
	});

	it('Paper releases authored lights; removing every light and unmounting leave none live', () => {
		const { world, handle, app } = mountWorld();
		handle.set({ includeLights: false });
		flushSync();
		expect(byType(world).get('PointLight')).toBeUndefined();
		expect(handle.resources.lights.stats().live).toBe(1);
		handle.set({ includeLights: true, scene: runtimeScene([]) });
		flushSync();
		expect(handle.resources.lights.stats().live).toBe(1);
		const stats = handle.resources.lights;
		unmount(app);
		mounted.splice(mounted.indexOf(app), 1);
		flushSync();
		expect(stats.stats().live).toBe(0);
		expect(lightsIn(world)).toEqual([]);
	});
});

describe('E10 mounted: per-Canvas isolation', () => {
	it('two worlds hold disjoint stores and lights; releasing one leaves the other intact', () => {
		const a = mountWorld();
		const b = mountWorld();
		expect(a.handle.resources.lights).not.toBe(b.handle.resources.lights);
		const inA = new Set(lightsIn(a.world));
		expect(lightsIn(b.world).some((light) => inA.has(light))).toBe(false);
		unmount(a.app);
		mounted.splice(mounted.indexOf(a.app), 1);
		flushSync();
		expect(a.handle.resources.lights.stats().live).toBe(0);
		expect(b.handle.resources.lights.stats()).toEqual({ live: 4, created: 4, disposed: 0, updated: 0 });
		expect(lightsIn(b.world)).toHaveLength(5);
	});
});
