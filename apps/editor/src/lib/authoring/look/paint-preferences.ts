/**
 * Creator Paint preferences (T2.S8 U2): favourites and recents, behind one
 * small interface so the device store can become an account store later.
 *
 * Preferences are not project data. They are never serialized into a project,
 * never enter history, and hold references only (see `paint-pick.ts`). The
 * device store keeps them in `localStorage`; a missing, blocked or corrupt store
 * reads as empty and a failed write is dropped, because losing a convenience
 * must never block painting.
 */
import { PAINT_FAVOURITES_LIMIT, PAINT_RECENTS_LIMIT } from './paint-pick';

export type PaintPreferences = {
	readonly favouriteColours: readonly string[];
	readonly recentColours: readonly string[];
	readonly favouriteMaterials: readonly string[];
	readonly recentMaterials: readonly string[];
};

export interface PaintPreferenceStore {
	load(): PaintPreferences;
	save(preferences: PaintPreferences): void;
}

export const EMPTY_PAINT_PREFERENCES: PaintPreferences = Object.freeze({
	favouriteColours: [],
	recentColours: [],
	favouriteMaterials: [],
	recentMaterials: []
});

export const PAINT_PREFERENCES_STORAGE_KEY = 'biskiq.paint-preferences';

function keys(value: unknown, limit: number): readonly string[] {
	if (!Array.isArray(value)) return [];
	const seen = new Set<string>();
	for (const entry of value) {
		if (typeof entry === 'string' && entry.length > 0 && entry.length <= 200) seen.add(entry);
		if (seen.size >= limit) break;
	}
	return [...seen];
}

/** Read whatever shape arrived; anything unrecognised is an empty list. */
export function sanitisePaintPreferences(raw: unknown): PaintPreferences {
	if (typeof raw !== 'object' || raw === null) return EMPTY_PAINT_PREFERENCES;
	const record = raw as Record<string, unknown>;
	return {
		favouriteColours: keys(record.favouriteColours, PAINT_FAVOURITES_LIMIT),
		recentColours: keys(record.recentColours, PAINT_RECENTS_LIMIT),
		favouriteMaterials: keys(record.favouriteMaterials, PAINT_FAVOURITES_LIMIT),
		recentMaterials: keys(record.recentMaterials, PAINT_RECENTS_LIMIT)
	};
}

export function createMemoryPaintPreferences(
	initial: PaintPreferences = EMPTY_PAINT_PREFERENCES
): PaintPreferenceStore & { readonly saved: () => PaintPreferences } {
	let current = initial;
	return {
		load: () => current,
		save: (next) => {
			current = next;
		},
		saved: () => current
	};
}

function deviceStorage(): Storage | null {
	try {
		return typeof localStorage === 'undefined' ? null : localStorage;
	} catch {
		return null;
	}
}

export function createDevicePaintPreferences(
	storage: Storage | null = deviceStorage(),
	storageKey: string = PAINT_PREFERENCES_STORAGE_KEY
): PaintPreferenceStore {
	return {
		load() {
			if (storage === null) return EMPTY_PAINT_PREFERENCES;
			try {
				const text = storage.getItem(storageKey);
				return text === null ? EMPTY_PAINT_PREFERENCES : sanitisePaintPreferences(JSON.parse(text));
			} catch {
				return EMPTY_PAINT_PREFERENCES;
			}
		},
		save(preferences) {
			if (storage === null) return;
			try {
				storage.setItem(storageKey, JSON.stringify(preferences));
			} catch {
				/* a full or blocked store loses a convenience, never a paint */
			}
		}
	};
}
