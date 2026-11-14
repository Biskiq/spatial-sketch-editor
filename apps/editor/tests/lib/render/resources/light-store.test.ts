/**
 * E10/R6 — the light store's explicit lifetime: acquire constructs and applies,
 * update re-applies in place, a kind change is refused (the caller replaces),
 * release detaches and disposes once, and dispose releases everything.
 */
import { describe, expect, it, vi } from 'vitest';
import { DirectionalLight, Group, PointLight, Scene, SpotLight } from 'three';
import { createLightStore } from '$lib/render/resources/light-store';
import type {
	PointLightDescriptor,
	SpotLightDescriptor,
	SunLightDescriptor
} from '$lib/render/resources/light-descriptor';
import { lightKey } from '$lib/render/resources/light-descriptor';

const POINT: PointLightDescriptor = { kind: 'point', color: '#ffd6a5', intensity: Math.PI, distance: 6, decay: 2, castShadow: true };
const SPOT: SpotLightDescriptor = {
	kind: 'spot', color: '#dbe9ff', intensity: 2 * Math.PI, distance: 0, decay: 2, angle: 0.4, penumbra: 0.25, castShadow: false
};
const SUN: SunLightDescriptor = {
	kind: 'sun',
	color: '#fff6df',
	intensity: 1.9,
	position: [5, 20, 8],
	target: [1, 0, 0.5],
	shadow: { mapSize: 2048, bias: -0.0004, normalBias: 0.02, radius: 3, camera: { left: -9, right: 9, top: 9, bottom: -9, near: 0.5, far: 54 } }
};

describe('light store: one realizer, explicit lifetime', () => {
	it('realizes each kind with exactly the descriptor values', () => {
		const store = createLightStore();
		const point = store.acquire(POINT).light;
		expect(point).toBeInstanceOf(PointLight);
		expect([point.color.getHexString(), point.intensity, point.distance, point.decay, point.castShadow]).toEqual([
			'ffd6a5', Math.PI, 6, 2, true
		]);
		expect(point.position.toArray()).toEqual([0, 0, 0]);

		const spot = store.acquire(SPOT).light;
		expect(spot).toBeInstanceOf(SpotLight);
		expect([spot.angle, spot.penumbra, spot.distance, spot.castShadow]).toEqual([0.4, 0.25, 0, false]);
		// At its holder's origin (not Three's DEFAULT_UP), aiming one metre down −Z.
		expect(spot.position.toArray()).toEqual([0, 0, 0]);
		expect(spot.target.parent).toBe(spot);
		expect(spot.target.position.toArray()).toEqual([0, 0, -1]);

		const sun = store.acquire(SUN).light;
		expect(sun).toBeInstanceOf(DirectionalLight);
		expect(sun.position.toArray()).toEqual([5, 20, 8]);
		expect(sun.target.position.toArray()).toEqual([1, 0, 0.5]);
		expect(sun.castShadow).toBe(true);
		expect([sun.shadow.mapSize.x, sun.shadow.mapSize.y, sun.shadow.bias, sun.shadow.normalBias, sun.shadow.radius]).toEqual([
			2048, 2048, -0.0004, 0.02, 3
		]);
		const camera = sun.shadow.camera;
		expect([camera.left, camera.right, camera.top, camera.bottom, camera.near, camera.far]).toEqual([-9, 9, 9, -9, 0.5, 54]);
		// The projection follows the applied frustum.
		expect(camera.projectionMatrix.elements[0]).toBeCloseTo(1 / 9, 12);
		expect(store.stats()).toEqual({ live: 3, created: 3, disposed: 0, updated: 0 });
	});

	it('updates in place: same light, same shadow, only when the key changed', () => {
		const store = createLightStore();
		const lease = store.acquire(SUN);
		const { light } = lease;
		const shadow = light.shadow;
		expect(lease.update({ ...SUN })).toBe(false);
		expect(store.stats().updated).toBe(0);
		const next = { ...SUN, intensity: 0.45, shadow: { ...SUN.shadow, camera: { ...SUN.shadow.camera, left: -4, right: 4 } } };
		expect(lease.update(next)).toBe(true);
		expect(lease.light).toBe(light);
		expect(light.shadow).toBe(shadow);
		expect(light.intensity).toBe(0.45);
		expect(light.shadow.camera.projectionMatrix.elements[0]).toBeCloseTo(1 / 4, 12);
		expect(lease.key).toBe(lightKey(next));
		expect(store.stats()).toEqual({ live: 1, created: 1, disposed: 0, updated: 1 });
	});

	it('refuses a kind change: replacement is release then acquire', () => {
		const store = createLightStore();
		const lease = store.acquire(POINT);
		expect(() => lease.update(SPOT as never)).toThrow(/replaces it/);
		lease.release();
		const replaced = store.acquire(SPOT);
		expect(replaced.light).not.toBe(lease.light);
		expect(store.stats()).toEqual({ live: 1, created: 2, disposed: 1, updated: 0 });
	});

	it('release detaches the light and the Sun target, disposes once, and is idempotent', () => {
		const store = createLightStore();
		const scene = new Scene();
		const holder = new Group();
		scene.add(holder);
		const lease = store.acquire(SUN);
		holder.add(lease.light);
		scene.add(lease.light.target);
		const dispose = vi.spyOn(lease.light, 'dispose');
		lease.release();
		lease.release();
		expect(dispose).toHaveBeenCalledTimes(1);
		expect(lease.light.parent).toBeNull();
		expect(lease.light.target.parent).toBeNull();
		expect(() => lease.update(SUN)).toThrow(/released/);
		expect(store.stats()).toEqual({ live: 0, created: 1, disposed: 1, updated: 0 });
	});

	it('dispose releases every lease and refuses further acquires', () => {
		const store = createLightStore();
		const leases = [store.acquire(POINT), store.acquire(SPOT), store.acquire(SUN)];
		const spies = leases.map((lease) => vi.spyOn(lease.light, 'dispose'));
		store.dispose();
		store.dispose();
		for (const spy of spies) expect(spy).toHaveBeenCalledTimes(1);
		expect(store.stats()).toEqual({ live: 0, created: 3, disposed: 3, updated: 0 });
		expect(() => store.acquire(POINT)).toThrow(/disposed/);
		// A lease released by the store stays released.
		leases[0]!.release();
		expect(store.stats().disposed).toBe(3);
	});

	it('two stores never share a light: one Canvas cannot free another’s', () => {
		const a = createLightStore();
		const b = createLightStore();
		const first = a.acquire(POINT);
		const second = b.acquire(POINT);
		expect(first.light).not.toBe(second.light);
		a.dispose();
		expect(b.stats().live).toBe(1);
		expect(second.update({ ...POINT, intensity: 1 })).toBe(true);
	});
});
