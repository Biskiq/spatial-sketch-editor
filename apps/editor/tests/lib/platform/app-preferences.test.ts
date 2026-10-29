import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_APP_PREFERENCES, readAppPreferences, writeAppPreferences } from '$lib/platform/app-preferences';

afterEach(() => vi.unstubAllGlobals());

describe('browser-local app preferences', () => {
	it('round trips preferences without project state', () => {
		const values = new Map<string, string>();
		vi.stubGlobal('localStorage', {
			getItem: (key: string) => values.get(key) ?? null,
			setItem: (key: string, value: string) => values.set(key, value)
		});
		const preferences = { planAppearance: 'shaded', reducedMotion: true, motionSpeed: 'slow' } as const;
		writeAppPreferences(preferences);
		expect(readAppPreferences()).toEqual(preferences);
	});

	it('falls back on inaccessible, malformed and invalid storage', () => {
		vi.stubGlobal('localStorage', { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } });
		expect(readAppPreferences()).toEqual(DEFAULT_APP_PREFERENCES);
		expect(() => writeAppPreferences(DEFAULT_APP_PREFERENCES)).not.toThrow();
		vi.stubGlobal('localStorage', { getItem: () => '{invalid' });
		expect(readAppPreferences()).toEqual(DEFAULT_APP_PREFERENCES);
		vi.stubGlobal('localStorage', { getItem: () => '{"planAppearance":"bad","reducedMotion":"true","motionSpeed":"bad"}' });
		expect(readAppPreferences()).toEqual(DEFAULT_APP_PREFERENCES);
	});
});
