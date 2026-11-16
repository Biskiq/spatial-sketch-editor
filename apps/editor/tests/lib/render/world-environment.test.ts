/**
 * Sky parity — the stored Sky resolves exactly the Sun Scene 7 drew.
 *
 * The step-0 golden records `resolveSkySun` for the three presets and Paper on
 * the visit and Stage frames. Scene 8 reads angles and colours from the stored
 * Sky, so this suite proves the new path still produces those descriptors.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
	SCENE_SKY_PRESET_STARTS,
	sceneSunFrom
} from '@portfolio/project-model/units';
import { resolveSkySun, worldEnvironmentLook } from '$lib/render/world-environment';
import { SUN_CASES, sunCaseLook } from './materials/fixtures/look-parity-cases';
import { parityMismatches } from './materials/fixtures/parity-compare';

const GOLDEN_PATH = fileURLToPath(
	new URL('./materials/__fixtures__/look-parity-golden.json', import.meta.url)
);

type Golden = {
	readonly suns: readonly { readonly case: string; readonly descriptor: unknown }[];
};

describe('Sky parity', () => {
	it('resolves the golden Sun descriptor for every preset and frame', () => {
		const golden = JSON.parse(readFileSync(GOLDEN_PATH, 'utf8')) as Golden;
		const mismatches: string[] = [];
		for (const sunCase of SUN_CASES) {
			const recorded = golden.suns.find((entry) => entry.case === sunCase.id);
			expect(recorded, sunCase.id).toBeDefined();
			parityMismatches(
				recorded?.descriptor,
				resolveSkySun(sunCaseLook(sunCase.preset), sunCase.frame),
				`$.suns[${sunCase.id}]`,
				mismatches
			);
		}
		expect(mismatches).toEqual([]);
	});

	it('keeps Paper as no look and no Sun', () => {
		expect(worldEnvironmentLook(null)).toBeNull();
		expect(worldEnvironmentLook(undefined)).toBeNull();
		expect(
			resolveSkySun(null, {
				bounds: null,
				shadowBounds: null,
				groundY: 0,
				flatGround: false
			})
		).toBeNull();
	});

	it('reads appearance from the stored Sky and not from a retuned start', () => {
		const start = SCENE_SKY_PRESET_STARTS.daylight;
		const edited = {
			...start,
			zenith: '#010203',
			horizon: '#040506',
			ground: '#070809',
			haze: { color: '#0a0b0c' },
			hemisphere: { skyColor: '#0d0e0f', groundColor: '#101112', intensity: 0.3 },
			sun: { ...start.sun, color: '#131415', intensity: 0.25, softness: 0 }
		};
		const look = worldEnvironmentLook(edited)!;
		expect(look.label).toBe('Daylight');
		expect(look.sky).toEqual(['#010203', '#040506']);
		expect(look.ground).toBe('#070809');
		expect(look.haze).toBe('#0a0b0c');
		expect(look.hemisphere).toEqual(['#0d0e0f', '#101112', 0.3]);
		expect(look.sun.color).toBe('#131415');
		expect(look.sun.intensity).toBe(0.25);
		expect(look.softness).toBe(0);

		const sun = resolveSkySun(look, {
			bounds: null,
			shadowBounds: null,
			groundY: 0,
			flatGround: false
		})!;
		expect(sun.shadow.radius).toBe(1);
		const direction = sceneSunFrom(edited.sun);
		for (const [index, value] of direction.entries()) {
			expect(sun.position[index] / 30).toBeCloseTo(value, 12);
		}
	});

	it('returns a stable look for the same Sky so effects do not rebuild', () => {
		const start = SCENE_SKY_PRESET_STARTS.dusk;
		expect(worldEnvironmentLook(start)).toBe(worldEnvironmentLook(start));
	});

	it('keeps the presentation labels and plates keyed by preset', () => {
		expect(worldEnvironmentLook(SCENE_SKY_PRESET_STARTS.daylight)?.plate).toBe('#e9ebe6');
		expect(worldEnvironmentLook(SCENE_SKY_PRESET_STARTS['golden-hour'])?.plate).toBe('#efe5d3');
		expect(worldEnvironmentLook(SCENE_SKY_PRESET_STARTS.dusk)?.plate).toBe('#9a9c96');
	});
});
