import type { SceneSky, SceneSkyPreset } from '../scene';

const shared = {
	arcHeight: 62,
	sunShadows: true,
	skyColor: '#b7cfcd',
	groundColor: '#e0e4d3',
	moon: { color: '#c9d6ff', strength: 0.25 }
} as const;

export const SCENE_SKY_PRESET_STARTS: Readonly<Record<SceneSkyPreset, Omit<SceneSky, 'heading'>>> = {
	studio: { ...shared, preset: 'studio', time: 13, haze: 0, exposure: 0, softness: 0.5 },
	daylight: { ...shared, preset: 'daylight', time: 13, haze: 15, exposure: 0, softness: 0.3 },
	'golden-hour': { ...shared, preset: 'golden-hour', time: 220 / 12, haze: 35, exposure: 0, softness: 0.45 },
	dusk: { ...shared, preset: 'dusk', time: 243 / 12, haze: 40, exposure: 0.5, softness: 0.6 },
	overcast: { ...shared, preset: 'overcast', time: 13, haze: 85, exposure: 0.3, softness: 0.9 },
	moonlit: {
		...shared, preset: 'moonlit', time: 23, haze: 20, exposure: 1, softness: 0.4,
		moon: { ...shared.moon, strength: 0.35 }
	}
};

export function skyFromPreset(preset: SceneSkyPreset, heading: number): SceneSky {
	const start = SCENE_SKY_PRESET_STARTS[preset];
	return { ...start, heading, moon: { ...start.moon } };
}

export const SCENE_SKY_DEFAULT: SceneSky = Object.freeze({
	...SCENE_SKY_PRESET_STARTS.studio,
	heading: 0,
	moon: Object.freeze({ ...shared.moon })
});

export function sameSky(a: SceneSky, b: SceneSky): boolean {
	return a.preset === b.preset && a.heading === b.heading && a.time === b.time &&
		a.arcHeight === b.arcHeight && a.haze === b.haze && a.exposure === b.exposure &&
		a.softness === b.softness && a.sunShadows === b.sunShadows &&
		a.skyColor.toLowerCase() === b.skyColor.toLowerCase() &&
		a.groundColor.toLowerCase() === b.groundColor.toLowerCase() &&
		a.moon.color.toLowerCase() === b.moon.color.toLowerCase() &&
		a.moon.strength === b.moon.strength;
}

export function skyIsEdited(sky: SceneSky): boolean {
	return !sameSky(sky, skyFromPreset(sky.preset, sky.heading));
}

export function sunShadowRadius(softness: number): number {
	return 1 + 4 * softness;
}
