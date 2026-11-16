/**
 * The three Sky starts and the two readings every surface shares.
 *
 * A preset is provenance, not the stored look: choosing one copies its start
 * into the World, so retuning a start never changes a saved World and *Edited*
 * is an exact comparison against this table. The sun angles are converted from
 * the pre-Scene-8 direction tuples (`atan2(x, z)` and `asin(y)` of the unit
 * vector), and the colours and intensities are copied unchanged.
 *
 * Runtime-safe pure data: no editor, renderer, Svelte or Three import.
 */
import type { SceneSky, SceneSkyPreset } from '../scene';

/** Daylight, Golden hour and Dusk, converted from the Scene 7 look table. */
export const SCENE_SKY_PRESET_STARTS: Readonly<Record<SceneSkyPreset, SceneSky>> = {
	daylight: {
		preset: 'daylight',
		sun: {
			azimuth: 0.56672921752350625,
			elevation: 0.9930723849798229,
			color: '#fff6df',
			intensity: 1.9,
			softness: 0.5
		},
		zenith: '#b7cfcd',
		horizon: '#eef0e6',
		ground: '#e0e4d3',
		haze: { color: '#e8ebe1' },
		hemisphere: { skyColor: '#f4f7f2', groundColor: '#b9b49c', intensity: 1.5 }
	},
	'golden-hour': {
		preset: 'golden-hour',
		sun: {
			azimuth: 5.003845774862556,
			elevation: 0.38247640695679874,
			color: '#ffc985',
			intensity: 2.1,
			softness: 0.5
		},
		zenith: '#e2a676',
		horizon: '#f8e4c2',
		ground: '#e2c99e',
		haze: { color: '#f4dbb2' },
		hemisphere: { skyColor: '#ffe6c4', groundColor: '#a07e58', intensity: 1.2 }
	},
	dusk: {
		preset: 'dusk',
		sun: {
			azimuth: 2.582993338246231,
			elevation: 0.35525856534315686,
			color: '#b9c3dd',
			intensity: 0.45,
			softness: 0.5
		},
		zenith: '#25313e',
		horizon: '#8b6e5d',
		ground: '#45473c',
		haze: { color: '#6e5e54' },
		hemisphere: { skyColor: '#5b6884', groundColor: '#3a342c', intensity: 0.7 }
	}
};

/**
 * The Sun's direction: the unit vector it shines **from**, from the stored
 * azimuth and elevation. `from = [sin(az)·cos(el), sin(el), cos(az)·cos(el)]`.
 */
export function sceneSunFrom(
	sun: Pick<SceneSky['sun'], 'azimuth' | 'elevation'>
): [number, number, number] {
	return [
		Math.sin(sun.azimuth) * Math.cos(sun.elevation),
		Math.sin(sun.elevation),
		Math.cos(sun.azimuth) * Math.cos(sun.elevation)
	];
}

/**
 * The Sun's shadow blur radius in shadow-map texels. Preset starts use `0.5`,
 * which is the radius every Scene 7 World rendered (`3`).
 */
export function sunShadowRadius(softness: number): number {
	return 1 + 4 * softness;
}
