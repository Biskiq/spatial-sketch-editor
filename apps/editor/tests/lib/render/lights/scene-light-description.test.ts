/**
 * E10/R6 — authored lights resolve to pure descriptors in the T2.S0 units, once
 * per Scene identity, and the Sky resolves its one Sun from the preset and frame.
 */
import { describe, expect, it } from 'vitest';
import type { SceneLightEntity } from '@portfolio/project-model';
import { describeSceneLights, resolveSceneLight } from '$lib/render/scene-light-description';
import { resolveSkySun, worldEnvironmentLook } from '$lib/render/world-environment';
import { POINT_OPEN, POINT_RANGED, SPOT_AIMED, SPOT_PLAIN, runtimeScene } from '../fixtures/light-parity-cases';

describe('authored light descriptors', () => {
	it('maps Point and Spot with stated defaults: unbounded range, physical decay, no penumbra', () => {
		expect(resolveSceneLight(POINT_OPEN)).toEqual({
			kind: 'point', color: '#ffffff', intensity: 0.25 * Math.PI, distance: 0, decay: 2, castShadow: false
		});
		expect(resolveSceneLight(SPOT_PLAIN)).toEqual({
			kind: 'spot', color: '#ffffff', intensity: 2 * Math.PI, distance: 0, decay: 2, angle: Math.PI / 5, penumbra: 0, castShadow: false
		});
		expect(resolveSceneLight(SPOT_AIMED)).toMatchObject({ distance: 9.5, penumbra: 0.3, castShadow: true });
	});

	it('describes once per Scene identity, frozen, with a uniform scale', () => {
		const scene = runtimeScene([POINT_RANGED, POINT_OPEN, SPOT_AIMED]);
		const description = describeSceneLights(scene);
		expect(describeSceneLights(scene)).toBe(description);
		expect(Object.isFrozen(description.items)).toBe(true);
		expect(description.items.map((item) => item.id)).toEqual(['point-ranged', 'point-open', 'spot-aimed']);
		expect(description.items[1]!.transform.scale).toEqual([2, 2, 2]);
		expect(description.items[0]!.transform.scale).toEqual([1, 1, 1]);
	});

	it('separates a light change from a placement change in the keys', () => {
		const before = describeSceneLights(runtimeScene([POINT_RANGED])).items[0]!;
		const moved = describeSceneLights(runtimeScene([{ ...POINT_RANGED, position: [0, 1, 0] }])).items[0]!;
		const brighter = describeSceneLights(runtimeScene([{ ...POINT_RANGED, intensity: 1 }])).items[0]!;
		expect(moved.key).toBe(before.key);
		expect(moved.placementKey).not.toBe(before.placementKey);
		expect(brighter.key).not.toBe(before.key);
		expect(brighter.placementKey).toBe(before.placementKey);
	});

	it('has no Directional kind: only Point and Spot are authored', () => {
		const kinds: SceneLightEntity['light'][] = ['point', 'spot'];
		const scene = runtimeScene([POINT_RANGED, SPOT_AIMED]);
		expect(describeSceneLights(scene).items.map((item) => item.light.kind)).toEqual(kinds);
	});
});

describe('the Sky’s one Sun', () => {
	it('paper has no Sun', () => {
		expect(resolveSkySun(worldEnvironmentLook('paper'), { bounds: null, shadowBounds: null, groundY: 0, flatGround: false })).toBeNull();
	});

	it('a Sky with no bounds aims at the datum with a 12 m reach', () => {
		const look = worldEnvironmentLook('daylight')!;
		const sun = resolveSkySun(look, { bounds: null, shadowBounds: null, groundY: 0.5, flatGround: false })!;
		expect(sun.target).toEqual([0, 0.5, 0]);
		expect(sun.shadow.camera).toEqual({ left: -12, right: 12, top: 12, bottom: -12, near: 0.5, far: 72 });
		expect(sun.shadow.normalBias).toBe(0.02);
		expect(Math.hypot(sun.position[0], sun.position[1] - 0.5, sun.position[2])).toBeCloseTo(30, 10);
		expect([sun.color, sun.intensity]).toEqual([look.sun.color, look.sun.intensity]);
	});

	it('the Stage’s flat ground takes the larger normal bias and the shadow bounds’ centre', () => {
		const sun = resolveSkySun(worldEnvironmentLook('dusk'), {
			bounds: { min: [-1, 0, -1], max: [1, 1, 1] },
			shadowBounds: { min: [0, 0, 0], max: [2, 4, 2] },
			groundY: 0,
			flatGround: true
		})!;
		expect(sun.target).toEqual([1, 2, 1]);
		expect(sun.shadow.normalBias).toBe(0.05);
		expect(sun.shadow.camera.right).toBe(Math.max(4, Math.hypot(2, 4, 2) / 2 + 2));
	});
});
