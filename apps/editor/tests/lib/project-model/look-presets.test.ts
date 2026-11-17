/**
 * T2.S6 — the curated Look catalogue is append-only data.
 *
 * A Look is identity, not storage: the exact `(sky, treatment)` pair a World
 * matches, with the noon heading ignored because apply keeps the World's own.
 */
import { describe, expect, it } from 'vitest';
import {
	SCENE_LOOK_STARTS,
	sceneLookOf,
	sceneLookPaletteSlots,
	sceneLookStart,
	sameSkyIgnoringHeading,
	skyFromPreset,
	type SceneEnvironment
} from '@portfolio/project-model/units';

describe('T2.S6 — Look catalogue', () => {
	it('pins Riso and Clay exactly', () => {
		expect(SCENE_LOOK_STARTS.map((look) => look.id)).toEqual(['riso', 'clay']);
		expect(SCENE_LOOK_STARTS[0]).toMatchObject({
			id: 'riso',
			label: 'Riso',
			treatment: 'flat-colour',
			atmosphere: {
				preset: 'daylight',
				time: 13,
				heading: 0,
				arcHeight: 55,
				haze: 5,
				exposure: 0.15,
				softness: 0.05,
				sunShadows: true,
				skyColor: '#f4d35e',
				groundColor: '#3d5a80'
			}
		});
		expect(SCENE_LOOK_STARTS[0]!.palette).toEqual([
			{ name: 'Coral', color: '#ee6c4d' },
			{ name: 'Ink', color: '#293241' },
			{ name: 'Gold', color: '#f4d35e' }
		]);
		expect(SCENE_LOOK_STARTS[1]).toMatchObject({
			id: 'clay',
			label: 'Clay',
			treatment: 'clay',
			atmosphere: {
				preset: 'overcast',
				time: 13,
				haze: 85,
				exposure: 0.3,
				softness: 0.9,
				skyColor: '#e6e2da',
				groundColor: '#d4cec2'
			}
		});
		expect(SCENE_LOOK_STARTS[1]!.palette).toEqual([]);
	});

	it('seeds a deterministic palette from a Look', () => {
		expect(sceneLookPaletteSlots(sceneLookStart('riso')!)).toEqual([
			{ id: 'look-riso-1', name: 'Coral', color: '#ee6c4d' },
			{ id: 'look-riso-2', name: 'Ink', color: '#293241' },
			{ id: 'look-riso-3', name: 'Gold', color: '#f4d35e' }
		]);
	});

	it('matches a World only on an exact Sky and Treatment, ignoring the heading', () => {
		const riso = sceneLookStart('riso')!;
		const environment: SceneEnvironment = {
			sky: { ...riso.atmosphere, heading: 217 },
			treatment: 'flat-colour'
		};
		expect(sceneLookOf(environment)?.id).toBe('riso');
		expect(sceneLookOf({ ...environment, treatment: 'clay' })).toBeNull();
		expect(sceneLookOf({ sky: { ...riso.atmosphere, haze: 6 }, treatment: 'flat-colour' })).toBeNull();
		expect(sceneLookOf(undefined)).toBeNull();

		// The heading is the one field a Look never pins.
		expect(sameSkyIgnoringHeading({ ...riso.atmosphere, heading: 90 }, riso.atmosphere)).toBe(true);
		expect(
			sameSkyIgnoringHeading(
				{ ...riso.atmosphere, heading: 90, moon: { ...riso.atmosphere.moon, strength: 0.5 } },
				riso.atmosphere
			)
		).toBe(false);
	});

	it('does not mistake a plain preset Sky for a Look', () => {
		expect(sceneLookOf({ sky: skyFromPreset('daylight', 0) })).toBeNull();
		expect(sceneLookOf({ sky: skyFromPreset('overcast', 0) })).toBeNull();
	});
});
