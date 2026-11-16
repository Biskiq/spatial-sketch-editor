/**
 * Experience review 1 — the World environment's resolved look.
 *
 * One runtime-safe table shared by the Stage, its snapshots, Preview and the
 * published visit. The Scene stores the whole Sky (angles, colours, scalars);
 * this module reads it into the values the renderer needs and supplies the
 * presentation — label, subtitle and the Stage's plate — keyed by the Sky's
 * `preset`. A preset is provenance, so an edited Sky keeps its preset's plate.
 *
 * No editor module, no Three object; the renderer component builds from these
 * values. An absent Sky is Paper: a surface keeps its own neutral look (the
 * Stage's Paper and lights), so a World that never chose a Sky renders exactly
 * as it did before presets existed.
 */
import {
	sceneSunFrom,
	sunShadowRadius,
	type SceneEnvironmentChoice,
	type SceneSky,
	type SceneSkyPreset
} from '@portfolio/project-model/units';
import type { SunLightDescriptor } from './resources/light-descriptor';

export const WORLD_ENVIRONMENT_GROUND_RADIUS_METERS = 400;

/** The editor-facing identity of one preset: never a stored value. */
export type WorldEnvironmentPresentation = {
	readonly label: string;
	readonly sub: string;
	/** The editor Stage's bounded workspace plate under this light (it keeps Paper's grid). */
	readonly plate: string;
};

/** Presentation only. Colours and light come from the stored Sky. */
export const WORLD_ENVIRONMENT_PRESENTATIONS: Readonly<
	Record<SceneSkyPreset, WorldEnvironmentPresentation>
> = {
	daylight: { label: 'Daylight', sub: 'Soft sky, noon sun', plate: '#e9ebe6' },
	'golden-hour': { label: 'Golden hour', sub: 'Low warm sun', plate: '#efe5d3' },
	dusk: { label: 'Dusk', sub: 'Your lamps carry it', plate: '#9a9c96' }
};

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
	/** Shadow blur, in [0, 1]; the shadow camera's radius is derived from it. */
	readonly softness: number;
};

/**
 * A Sky is immutable stored data, so its resolved look is cached by identity.
 * The renderer's effects depend on the returned value; a stable object means an
 * unchanged Sky prop never rebuilds the background or updates the Sun.
 */
const LOOK_CACHE = new WeakMap<SceneSky, WorldEnvironmentLook>();

/**
 * The one resolved look for a stored Sky, or `null` for Paper. The presentation
 * is read by `preset`; every appearance value is read from the Sky itself, so a
 * retuned preset never changes a saved World.
 */
export function worldEnvironmentLook(
	sky: SceneSky | null | undefined
): WorldEnvironmentLook | null {
	if (sky === null || sky === undefined) return null;
	const cached = LOOK_CACHE.get(sky);
	if (cached !== undefined) return cached;
	const presentation = WORLD_ENVIRONMENT_PRESENTATIONS[sky.preset];
	const look: WorldEnvironmentLook = {
		label: presentation.label,
		sub: presentation.sub,
		plate: presentation.plate,
		sky: [sky.zenith, sky.horizon],
		ground: sky.ground,
		haze: sky.haze.color,
		hemisphere: [sky.hemisphere.skyColor, sky.hemisphere.groundColor, sky.hemisphere.intensity],
		sun: {
			from: sceneSunFrom(sky.sun),
			color: sky.sun.color,
			intensity: sky.sun.intensity
		},
		softness: sky.sun.softness
	};
	LOOK_CACHE.set(sky, look);
	return look;
}

/** The tiles one environment control offers: Paper, then the three presets. */
export const WORLD_ENVIRONMENT_CHOICES: readonly {
	readonly preset: SceneEnvironmentChoice;
	readonly label: string;
	readonly sub: string;
}[] = [
	{ preset: 'paper', label: 'Paper', sub: 'Default, as today' },
	...(Object.entries(WORLD_ENVIRONMENT_PRESENTATIONS) as [
		SceneSkyPreset,
		WorldEnvironmentPresentation
	][]).map(([preset, presentation]) => ({
		preset,
		label: presentation.label,
		sub: presentation.sub
	}))
];

/** An axis-aligned World extent in metres. */
export type WorldEnvironmentBounds = {
	readonly min: readonly [number, number, number];
	readonly max: readonly [number, number, number];
};

/** Where a Sky's light lands: the World it shines on and the ground datum. */
export type WorldEnvironmentFrame = {
	readonly bounds: WorldEnvironmentBounds | null;
	/** The caster extent the Sun's shadow camera must cover; the World bounds when absent. */
	readonly shadowBounds: WorldEnvironmentBounds | null;
	readonly groundY: number;
	/** The editor Stage's unlit ground: a larger normal bias against acne on its plate. */
	readonly flatGround: boolean;
};

/** The ground disc's centre: the World's plan centre at the datum. */
export function worldEnvironmentCenter(frame: Pick<WorldEnvironmentFrame, 'bounds' | 'groundY'>): [number, number, number] {
	const { bounds, groundY } = frame;
	if (bounds === null) return [0, groundY, 0];
	return [(bounds.min[0] + bounds.max[0]) / 2, groundY, (bounds.min[2] + bounds.max[2]) / 2];
}

/**
 * The Sky's one Sun, resolved: a pure descriptor the Canvas light store
 * realizes. The Sun aims at the caster centre (the shadow bounds' centre, else
 * the ground centre), sits 2.5 reaches back along the Sky's sun direction, and
 * its orthographic shadow camera is a square of half-size `reach` (half the
 * extent's diagonal plus 2 m, at least 4 m) reaching 6 reaches deep. Paper has
 * no Sky and so no Sun.
 */
export function resolveSkySun(
	look: WorldEnvironmentLook | null,
	frame: WorldEnvironmentFrame
): SunLightDescriptor | null {
	if (look === null) return null;
	const { bounds, shadowBounds } = frame;
	const center = worldEnvironmentCenter(frame);
	const target: [number, number, number] =
		shadowBounds === null
			? center
			: [
					(shadowBounds.min[0] + shadowBounds.max[0]) / 2,
					(shadowBounds.min[1] + shadowBounds.max[1]) / 2,
					(shadowBounds.min[2] + shadowBounds.max[2]) / 2
				];
	const extent = shadowBounds ?? bounds;
	const reach =
		extent === null
			? 12
			: Math.max(
					4,
					Math.hypot(
						extent.max[0] - extent.min[0],
						shadowBounds === null ? 0 : extent.max[1] - extent.min[1],
						extent.max[2] - extent.min[2]
					) /
						2 +
						2
				);
	const [x, y, z] = look.sun.from;
	const length = Math.hypot(x, y, z) || 1;
	const distance = reach * 2.5;
	return {
		kind: 'sun',
		color: look.sun.color,
		intensity: look.sun.intensity,
		position: [target[0] + (x / length) * distance, target[1] + (y / length) * distance, target[2] + (z / length) * distance],
		target,
		shadow: {
			mapSize: 2048,
			bias: -0.0004,
			normalBias: frame.flatGround ? 0.05 : 0.02,
			radius: sunShadowRadius(look.softness),
			camera: { left: -reach, right: reach, top: reach, bottom: -reach, near: 0.5, far: reach * 6 }
		}
	};
}
