import { describe, expect, it } from 'vitest';
import { SCENE_SKY_PRESETS, sameSky, skyFromPreset, skyIsEdited } from '@portfolio/project-model/units';

describe('Scene 9 Sky presets', () => {
	it.each([
		['studio', 13, 0, 0, 0.25, 0.5],
		['daylight', 13, 15, 0, 0.25, 0.3],
		['golden-hour', 220 / 12, 35, 0, 0.25, 0.45],
		['dusk', 243 / 12, 40, 0.5, 0.25, 0.6],
		['overcast', 13, 85, 0.3, 0.25, 0.9],
		['moonlit', 23, 20, 1, 0.35, 0.4]
	] as const)('%s starts with the accepted settings', (preset, time, haze, exposure, strength, softness) => {
		expect(skyFromPreset(preset, 137)).toMatchObject({
			preset, time, heading: 137, arcHeight: 62, haze, exposure, softness, sunShadows: true,
			moon: { color: '#c9d6ff', strength }, skyColor: '#b7cfcd', groundColor: '#e0e4d3'
		});
	});

	it.each(SCENE_SKY_PRESETS)('compares %s by value and ignores heading for edited', (preset) => {
		const sky = skyFromPreset(preset, 42);
		expect(sameSky(sky, { ...sky, skyColor: sky.skyColor.toUpperCase() })).toBe(true);
		expect(skyIsEdited({ ...sky, heading: 0 })).toBe(false);
		expect(skyIsEdited({ ...sky, sunShadows: false })).toBe(true);
	});
});
