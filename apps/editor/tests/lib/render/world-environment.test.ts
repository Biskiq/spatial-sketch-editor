import { describe, expect, it } from 'vitest';
import { SCENE_SKY_DEFAULT, skyFromPreset } from '@portfolio/project-model/units';
import { colorHex, resolveSkySun, sunShadowKey, worldEnvironmentLook } from '$lib/render/world-environment';

const frame = { bounds: null, shadowBounds: null, groundY: 0, flatGround: false };

describe('shared Scene 9 environment', () => {
	it('keeps Studio on neutral lighting even with a stored bearing', () => {
		expect(worldEnvironmentLook(null)).toBeNull();
		expect(worldEnvironmentLook({ ...SCENE_SKY_DEFAULT, heading: 90 })).toBeNull();
	});

	it('keeps one light and the same fog shape through all phases', () => {
		const day = skyFromPreset('daylight', 0);
		for (let index = 0; index < 96; index++) {
			const look = worldEnvironmentLook({ ...day, time: index / 4 })!;
			const sun = resolveSkySun(look, frame)!;
			expect(sun).toMatchObject({ kind: 'sun', castShadow: true });
			expect(sun.position.every(Number.isFinite)).toBe(true);
			expect(look.fog.density).toBeGreaterThan(0);
		}
	});

	it('shares the shadow switch with the Moon', () => {
		const night = skyFromPreset('moonlit', 90);
		const look = worldEnvironmentLook(night)!;
		expect(look.body.body).toBe('moon');
		expect(colorHex(look.lightColor)).toBe(night.moon.color);
		expect(resolveSkySun(worldEnvironmentLook({ ...night, sunShadows: false }), frame)?.castShadow).toBe(false);
	});

	it('keeps non-spatial changes and a twilight sweep out of the shadow key', () => {
		const key = (time: number, exposure = 0) =>
			sunShadowKey(worldEnvironmentLook({ ...skyFromPreset('dusk', 90), time, exposure }), frame);
		expect(key(19.5)).toBe(key(20, 2));
		expect(key(20)).toBe(key(20.5));
		expect(key(20)).not.toBe(key(21));
	});

	it('keeps the midday S1 colours and scales lights with exposure', () => {
		const sky = skyFromPreset('daylight', 0);
		const look = worldEnvironmentLook(sky)!;
		const brighter = worldEnvironmentLook({ ...sky, exposure: 1 })!;
		expect([look.zenith, look.horizon, look.ground].map(colorHex)).toEqual(['#b7cfcd', '#eef0e6', '#e0e4d3']);
		expect(brighter.zenith).toEqual(look.zenith);
		expect(brighter.lightIntensity).toBe(look.lightIntensity * 2);
	});
});
