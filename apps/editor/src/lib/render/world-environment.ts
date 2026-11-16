import { SCENE_SKY_PRESETS, type SceneSky, type SceneSkyPreset } from '@portfolio/project-model/units';
import { resolveSkyLook, srgbByte } from './sky-atmosphere';
import type { SunLightDescriptor } from './resources/light-descriptor';

export const WORLD_ENVIRONMENT_GROUND_RADIUS_METERS = 400;

export const WORLD_ENVIRONMENT_PRESENTATIONS = {
	studio: { label: 'Studio', short: 'Studio', plate: '#e9ebe6', swatch: ['#f4f2ec', '#e4dfd0'], glyph: null },
	daylight: { label: 'Daylight', short: 'Daylight', plate: '#e9ebe6', swatch: ['#5aa6ef', '#dcecf8'], glyph: 'sun' },
	'golden-hour': { label: 'Golden hour', short: 'Golden', plate: '#efe5d3', swatch: ['#f2a35e', '#fbe1b0'], glyph: 'low' },
	dusk: { label: 'Dusk', short: 'Dusk', plate: '#9a9c96', swatch: ['#3b3d6e', '#d58a74'], glyph: 'twilight' },
	overcast: { label: 'Overcast', short: 'Overcast', plate: '#daddd9', swatch: ['#a8b0b4', '#e3e6e6'], glyph: 'overcast' },
	moonlit: { label: 'Moonlit', short: 'Moonlit', plate: '#464957', swatch: ['#0f1633', '#3a4b82'], glyph: 'moon' }
} as const satisfies Record<SceneSkyPreset, object>;

export type WorldEnvironmentLook = ReturnType<typeof resolveSkyLook> & { readonly plate: string };
const looks = new WeakMap<SceneSky, WorldEnvironmentLook>();

export function worldEnvironmentLook(sky: SceneSky | null | undefined): WorldEnvironmentLook | null {
	if (!sky || sky.preset === 'studio') return null;
	const cached = looks.get(sky);
	if (cached) return cached;
	const look = { ...resolveSkyLook(sky), plate: WORLD_ENVIRONMENT_PRESENTATIONS[sky.preset].plate };
	looks.set(sky, look);
	return look;
}

export const WORLD_ENVIRONMENT_CHOICES = SCENE_SKY_PRESETS.map((preset) => ({
	preset, ...WORLD_ENVIRONMENT_PRESENTATIONS[preset]
}));

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
	const [x, y, z] = look.direction;
	const length = Math.hypot(x, y, z) || 1;
	const distance = reach * 2.5;
	return {
		kind: 'sun',
		color: colorHex(look.lightColor),
		intensity: look.lightIntensity,
		castShadow: look.castShadow,
		position: [target[0] + (x / length) * distance, target[1] + (y / length) * distance, target[2] + (z / length) * distance],
		target,
		shadow: {
			mapSize: 2048,
			bias: -0.0004,
			normalBias: frame.flatGround ? 0.05 : 0.02,
			radius: look.shadowRadius,
			camera: { left: -reach, right: reach, top: reach, bottom: -reach, near: 0.5, far: reach * 6 }
		}
	};
}

export function colorHex(color: readonly [number, number, number]): string {
	return '#' + color.map((channel) => srgbByte(channel).toString(16).padStart(2, '0')).join('');
}

export const sunMarkAnchor = worldEnvironmentCenter;

export function sunShadowKey(look: WorldEnvironmentLook | null, frame: WorldEnvironmentFrame): string {
	const sun = resolveSkySun(look, frame);
	if (!sun?.castShadow) return 'off';
	const { camera, bias, normalBias, mapSize } = sun.shadow;
	return [...sun.position, ...sun.target, mapSize, bias, normalBias,
		camera.left, camera.right, camera.top, camera.bottom, camera.near, camera.far].join('|');
}
