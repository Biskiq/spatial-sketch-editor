/**
 * Experience review 1 (R5) — the World environment presets.
 *
 * One runtime-safe table shared by the Stage, its snapshots, Preview and the
 * published visit: Scene stores only the preset id (`environment.preset`), and
 * every surface reads the same sky, horizon and light from here. No editor
 * module, no Three object; the renderer component builds from these values.
 *
 * `paper` is deliberately empty: a surface keeps its own neutral look (the
 * Stage's Paper and lights), so a World that never chose an environment renders
 * exactly as it did before presets existed.
 */
import type { SceneEnvironmentPreset } from '@portfolio/project-model/units';

export const WORLD_ENVIRONMENT_GROUND_RADIUS_METERS = 400;

export type WorldEnvironmentLook = {
	readonly label: string;
	readonly sub: string;
	/** Zenith and horizon colours of the sky dome. */
	readonly sky: readonly [string, string];
	/** The ground disc's colour near the World, fading to `haze` at the horizon. */
	readonly ground: string;
	readonly haze: string;
	/** The editor Stage's bounded workspace plate under this light (it keeps Paper's grid). */
	readonly plate: string;
	/** Hemisphere fill: sky colour, ground colour, intensity. */
	readonly hemisphere: readonly [string, string, number];
	/** The one sun: a unit-ish direction it shines from, colour, intensity. */
	readonly sun: { readonly from: readonly [number, number, number]; readonly color: string; readonly intensity: number };
	/** Fog from near to far metres, in the haze colour. */
	readonly fog: readonly [number, number];
};

export const WORLD_ENVIRONMENT_LOOKS: Readonly<Record<Exclude<SceneEnvironmentPreset, 'paper'>, WorldEnvironmentLook>> = {
	daylight: {
		label: 'Daylight',
		sub: 'Soft sky, noon sun',
		sky: ['#b7cfcd', '#eef0e6'],
		ground: '#e0e4d3',
		haze: '#e8ebe1',
		plate: '#e9ebe6',
		hemisphere: ['#f4f7f2', '#b9b49c', 1.5],
		sun: { from: [0.35, 1, 0.55], color: '#fff6df', intensity: 1.9 },
		fog: [60, 220]
	},
	'golden-hour': {
		label: 'Golden hour',
		sub: 'Low warm sun',
		sky: ['#e2a676', '#f8e4c2'],
		ground: '#e2c99e',
		haze: '#f4dbb2',
		plate: '#efe5d3',
		hemisphere: ['#ffe6c4', '#a07e58', 1.2],
		sun: { from: [-1, 0.42, 0.3], color: '#ffc985', intensity: 2.1 },
		fog: [50, 200]
	},
	dusk: {
		label: 'Dusk',
		sub: 'Your lamps carry it',
		sky: ['#25313e', '#8b6e5d'],
		ground: '#45473c',
		haze: '#6e5e54',
		plate: '#9a9c96',
		hemisphere: ['#5b6884', '#3a342c', 0.7],
		sun: { from: [0.5, 0.35, -0.8], color: '#b9c3dd', intensity: 0.45 },
		fog: [40, 170]
	}
};

export const WORLD_ENVIRONMENT_CHOICES: readonly { readonly preset: SceneEnvironmentPreset; readonly label: string; readonly sub: string }[] = [
	{ preset: 'paper', label: 'Paper', sub: 'Default, as today' },
	...(Object.entries(WORLD_ENVIRONMENT_LOOKS) as [Exclude<SceneEnvironmentPreset, 'paper'>, WorldEnvironmentLook][]).map(
		([preset, look]) => ({ preset, label: look.label, sub: look.sub })
	)
];

export function worldEnvironmentLook(preset: SceneEnvironmentPreset | null | undefined): WorldEnvironmentLook | null {
	return preset === undefined || preset === null || preset === 'paper' ? null : WORLD_ENVIRONMENT_LOOKS[preset];
}
