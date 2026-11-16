/**
 * The three Sky preset starts.
 *
 * A preset is provenance: the start is copied into a World, so retuning a start
 * never changes a saved World. The Sun angles must rebuild exactly the direction
 * Scene 7 stored as a literal vector, and every colour and scalar must keep the
 * old table's value.
 */
import { describe, expect, it } from 'vitest';
import {
	SCENE_SKY_PRESETS,
	SCENE_SKY_PRESET_STARTS,
	sceneSunFrom,
	sunShadowRadius,
	type SceneSkyPreset
} from '@portfolio/project-model/units';

/** Scene 7's literal Sun vectors, before the angles were stored. */
const SCENE_7_SUN: Record<SceneSkyPreset, readonly [number, number, number]> = {
	daylight: [0.35, 1, 0.55],
	'golden-hour': [-1, 0.42, 0.3],
	dusk: [0.5, 0.35, -0.8]
};

/** Scene 7's resolved appearance, field for field. */
const SCENE_7_LOOK: Record<
	SceneSkyPreset,
	{
		readonly zenith: string;
		readonly horizon: string;
		readonly ground: string;
		readonly haze: string;
		readonly hemisphere: readonly [string, string, number];
		readonly sunColor: string;
		readonly sunIntensity: number;
	}
> = {
	daylight: {
		zenith: '#b7cfcd',
		horizon: '#eef0e6',
		ground: '#e0e4d3',
		haze: '#e8ebe1',
		hemisphere: ['#f4f7f2', '#b9b49c', 1.5],
		sunColor: '#fff6df',
		sunIntensity: 1.9
	},
	'golden-hour': {
		zenith: '#e2a676',
		horizon: '#f8e4c2',
		ground: '#e2c99e',
		haze: '#f4dbb2',
		hemisphere: ['#ffe6c4', '#a07e58', 1.2],
		sunColor: '#ffc985',
		sunIntensity: 2.1
	},
	dusk: {
		zenith: '#25313e',
		horizon: '#8b6e5d',
		ground: '#45473c',
		haze: '#6e5e54',
		hemisphere: ['#5b6884', '#3a342c', 0.7],
		sunColor: '#b9c3dd',
		sunIntensity: 0.45
	}
};

function normalized(vector: readonly [number, number, number]): [number, number, number] {
	const length = Math.hypot(...vector);
	return [vector[0] / length, vector[1] / length, vector[2] / length];
}

describe('SCENE_SKY_PRESET_STARTS', () => {
	it('offers Daylight, Golden hour and Dusk in that order', () => {
		expect(SCENE_SKY_PRESETS).toEqual(['daylight', 'golden-hour', 'dusk']);
	});

	for (const preset of SCENE_SKY_PRESETS) {
		it(`${preset} rebuilds Scene 7's Sun direction within 1e-9`, () => {
			const from = sceneSunFrom(SCENE_SKY_PRESET_STARTS[preset].sun);
			const expected = normalized(SCENE_7_SUN[preset]);
			for (const [index, value] of from.entries()) {
				expect(Math.abs(value - expected[index]!)).toBeLessThanOrEqual(1e-9);
			}
			expect(Math.hypot(...from)).toBeCloseTo(1, 12);
		});

		it(`${preset} keeps Scene 7's colours, intensities and provenance`, () => {
			const start = SCENE_SKY_PRESET_STARTS[preset];
			const look = SCENE_7_LOOK[preset];
			expect(start.preset).toBe(preset);
			expect(start.zenith).toBe(look.zenith);
			expect(start.horizon).toBe(look.horizon);
			expect(start.ground).toBe(look.ground);
			expect(start.haze).toEqual({ color: look.haze });
			expect(start.hemisphere).toEqual({
				skyColor: look.hemisphere[0],
				groundColor: look.hemisphere[1],
				intensity: look.hemisphere[2]
			});
			expect(start.sun.color).toBe(look.sunColor);
			expect(start.sun.intensity).toBe(look.sunIntensity);
		});

		it(`${preset} starts at the old fixed shadow softness`, () => {
			expect(SCENE_SKY_PRESET_STARTS[preset].sun.softness).toBe(0.5);
			expect(sunShadowRadius(SCENE_SKY_PRESET_STARTS[preset].sun.softness)).toBe(3);
		});
	}

	it('maps softness to 1 + 4·softness shadow-map texels', () => {
		expect(sunShadowRadius(0)).toBe(1);
		expect(sunShadowRadius(0.5)).toBe(3);
		expect(sunShadowRadius(1)).toBe(5);
	});
});
