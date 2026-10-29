/** Browser-local shell preferences. They are never part of project source. */
export type AppPreferences = {
	readonly planAppearance: 'paper' | 'shaded';
	readonly reducedMotion: boolean | null;
	readonly motionSpeed: 'slow' | 'normal' | 'fast';
};

export const DEFAULT_APP_PREFERENCES: AppPreferences = {
	planAppearance: 'paper',
	reducedMotion: null,
	motionSpeed: 'normal'
};

const KEY = 'biskiq.editor.preferences.v1';

/** Access to localStorage itself can throw, as can its read and write methods. */
export function readAppPreferences(): AppPreferences {
	try {
		const raw = globalThis.localStorage.getItem(KEY);
		if (raw === null) return { ...DEFAULT_APP_PREFERENCES };
		const value: unknown = JSON.parse(raw);
		if (typeof value !== 'object' || value === null) return { ...DEFAULT_APP_PREFERENCES };
		const record = value as Record<string, unknown>;
		return {
			planAppearance: record.planAppearance === 'shaded' ? 'shaded' : 'paper',
			reducedMotion: typeof record.reducedMotion === 'boolean' ? record.reducedMotion : null,
			motionSpeed: record.motionSpeed === 'slow' || record.motionSpeed === 'fast' ? record.motionSpeed : 'normal'
		};
	} catch {
		return { ...DEFAULT_APP_PREFERENCES };
	}
}

export function writeAppPreferences(preferences: AppPreferences): void {
	try {
		globalThis.localStorage.setItem(KEY, JSON.stringify(preferences));
	} catch {
		// The editor remains usable when storage is disabled or full.
	}
}
