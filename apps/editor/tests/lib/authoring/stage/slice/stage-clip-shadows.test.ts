/**
 * SL1 test 6: the shadow contract.
 *
 * A Slice must not change a shadow. Three renders the shadow map from the unclipped
 * world only while `clipShadows` is false, so this suite pins three things: the rule
 * still exists in the installed three, no material ever raises the flag, and a Slice
 * leaves every light, caster and receiver exactly as built.
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { Mesh, Plane, BoxGeometry, MeshStandardMaterial } from 'three';
import { createStageClip, materialUsesClip } from '$lib/authoring/stage/slice/stage-clip';
import { createMaterialStore } from '$lib/render/resources/material-store';
import { createLightStore } from '$lib/render/resources/light-store';
import type { SunLightDescriptor, SpotLightDescriptor } from '$lib/render/resources/light-descriptor';

const SUN: SunLightDescriptor = {
	kind: 'sun',
	castShadow: true,
	color: '#fff6df',
	intensity: 1.9,
	position: [5, 20, 8],
	target: [1, 0, 0.5],
	shadow: {
		mapSize: 2048,
		bias: -0.0004,
		normalBias: 0.02,
		radius: 3,
		camera: { left: -9, right: 9, top: 9, bottom: -9, near: 0.5, far: 54 }
	}
};

const SPOT: SpotLightDescriptor = {
	kind: 'spot',
	color: '#dbe9ff',
	intensity: 2 * Math.PI,
	distance: 0,
	decay: 2,
	angle: 0.4,
	penumbra: 0.25,
	castShadow: true
};

describe('test 6 — a Slice does not change a shadow', () => {
	it('still finds the unclipped-shadow rule in the installed three', () => {
		const require = createRequire(import.meta.url);
		const path = require.resolve('three/src/renderers/webgl/WebGLClipping.js');
		const source = readFileSync(path, 'utf8').replace(/\s+/g, ' ');
		// `renderingShadows && ! clipShadows` is what makes a clipped Plan read as built
		// in the shadow pass; a three upgrade that drops it must fail here, not in QA.
		expect(source).toContain('renderingShadows && ! clipShadows');
		expect(source).toContain('clippingPlanes');
	});

	it('keeps every material, light and caster identical across enter, move and put back', () => {
		const clip = createStageClip();
		const planes = clip.planes as Plane[];
		const materials = createMaterialStore({ clippingPlanes: planes });
		const lights = createLightStore();

		const wall = materials.acquire({ kind: 'lambert', color: '#e8e2d8' }).material;
		const floor = materials.acquire({ kind: 'lambert', color: '#cfc9bf', clip: false }).material;
		const artwork = materials.acquire({
			kind: 'standard',
			color: '#ffffff',
			roughness: 0.6,
			metalness: 0
		}).material;
		const surface = new Mesh(new BoxGeometry(1, 1, 1), new MeshStandardMaterial());
		const sun = lights.acquire(SUN).light;
		const spot = lights.acquire(SPOT).light;
		surface.castShadow = true;
		surface.receiveShadow = true;
		surface.layers.set(2);
		spot.target.layers.set(1);

		const snapshot = () => ({
			castShadow: [sun.castShadow, spot.castShadow, surface.castShadow],
			receiveShadow: surface.receiveShadow,
			layers: [surface.layers.mask, spot.layers.mask, spot.target.layers.mask, sun.layers.mask],
			sun: {
				position: sun.position.toArray(),
				target: sun.target.position.toArray(),
				intensity: sun.intensity,
				mapSize: [sun.shadow.mapSize.x, sun.shadow.mapSize.y],
				camera: [sun.shadow.camera.left, sun.shadow.camera.right, sun.shadow.camera.top],
				bias: [sun.shadow.bias, sun.shadow.normalBias, sun.shadow.radius]
			},
			spot: {
				angle: spot.angle,
				penumbra: spot.penumbra,
				intensity: spot.intensity,
				target: spot.target.position.toArray()
			},
			materials: [wall.clippingPlanes === planes, floor.clippingPlanes, artwork.clippingPlanes === planes],
			clipShadows: [wall.clipShadows, floor.clipShadows, artwork.clipShadows],
			lightStats: lights.stats(),
			materialStats: materials.stats()
		});

		const before = snapshot();
		clip.apply({ kind: 'level', cutY: 1.2, lowerY: null });
		expect(snapshot()).toEqual(before);
		clip.apply({ kind: 'level', cutY: 1.2, lowerY: 0.5 });
		expect(snapshot()).toEqual(before);
		// The planes really are live, so the equality above is not vacuous.
		expect(clip.planes[0]!.constant).toBeCloseTo(1.2, 12);
		expect(clip.isActive()).toBe(true);
		clip.apply(null);
		expect(snapshot()).toEqual(before);

		for (const material of [wall, floor, artwork]) {
			expect(material.clipShadows).toBe(false);
			expect(material.shadowSide).toBeNull();
		}
		expect(materialUsesClip(wall, clip)).toBe(true);
		expect(materialUsesClip(floor, clip)).toBe(false);
		materials.dispose();
		lights.dispose();
	});

	it('does not touch clipShadows even when a reading is applied during a snapshot', () => {
		const clip = createStageClip();
		const store = createMaterialStore({ clippingPlanes: clip.planes as Plane[] });
		const material = store.acquire({ kind: 'basic', color: '#ffffff' }).material;
		clip.asBuilt(() => {
			clip.apply({ kind: 'level', cutY: 2, lowerY: null });
			expect(material.clipShadows).toBe(false);
		});
		expect(material.clipShadows).toBe(false);
		store.dispose();
	});
});
