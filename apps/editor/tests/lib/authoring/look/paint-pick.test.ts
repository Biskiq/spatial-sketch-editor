import { describe, expect, it } from 'vitest';
import {
	PAINT_FAVOURITES_LIMIT,
	PAINT_RECENTS_LIMIT,
	colourKey,
	hexToHsl,
	hslToHex,
	normaliseHex,
	paintRow,
	parseColourKey,
	samePick,
	toggleFavourite,
	touchRecent
} from '$lib/authoring/look/paint-pick';
import {
	EMPTY_PAINT_PREFERENCES,
	createDevicePaintPreferences,
	createMemoryPaintPreferences,
	sanitisePaintPreferences
} from '$lib/authoring/look/paint-preferences';

describe('T2.S8 U2 — Paint pick vocabulary', () => {
	it('normalises hex and round-trips colour keys', () => {
		expect(normaliseHex('#ABC')).toBe('#aabbcc');
		expect(normaliseHex(' #A1B2C3 ')).toBe('#a1b2c3');
		expect(normaliseHex('blue')).toBeNull();
		expect(parseColourKey('slot:sage')).toEqual({ kind: 'slot', slotId: 'sage' });
		expect(parseColourKey('#A1B2C3')).toEqual({ kind: 'literal', hex: '#a1b2c3' });
		expect(parseColourKey('slot:')).toBeNull();
		expect(colourKey({ kind: 'slot', slotId: 'sage' })).toBe('slot:sage');
		expect(colourKey({ kind: 'literal', hex: '#A1B2C3' })).toBe('#a1b2c3');
	});

	it('compares picks by kind and key', () => {
		expect(samePick({ kind: 'finish', key: 'curated:a' }, { kind: 'finish', key: 'curated:a' })).toBe(true);
		expect(samePick({ kind: 'finish', key: '#aabbcc' }, { kind: 'colour', colour: { kind: 'literal', hex: '#aabbcc' } })).toBe(false);
		expect(samePick(null, null)).toBe(true);
		expect(samePick(null, { kind: 'finish', key: 'x' })).toBe(false);
	});

	it('keeps recents most-recent-first, unique and bounded', () => {
		expect(touchRecent(['a', 'b', 'c'], 'b')).toEqual(['b', 'a', 'c']);
		const many = Array.from({ length: 20 }, (_, index) => `k${index}`);
		expect(touchRecent(many, 'new')).toHaveLength(PAINT_RECENTS_LIMIT);
		expect(touchRecent(many, 'new')[0]).toBe('new');
	});

	it('toggles favourites and bounds them', () => {
		expect(toggleFavourite(['a'], 'b')).toEqual(['a', 'b']);
		expect(toggleFavourite(['a', 'b'], 'a')).toEqual(['b']);
		const full = Array.from({ length: PAINT_FAVOURITES_LIMIT }, (_, index) => `k${index}`);
		expect(toggleFavourite(full, 'extra')).toHaveLength(PAINT_FAVOURITES_LIMIT);
	});

	it('builds the row: favourites first, recents without duplicates, unresolved left out', () => {
		const resolves = (key: string) => key !== 'gone';
		const row = paintRow(['fav', 'gone'], ['r1', 'fav', 'gone', 'r2'], resolves, 2);
		expect(row).toEqual([
			{ key: 'fav', favourite: true },
			{ key: 'r1', favourite: false },
			{ key: 'r2', favourite: false }
		]);
		expect(paintRow([], ['a', 'b', 'c'], () => true, 2).map((entry) => entry.key)).toEqual(['a', 'b']);
	});

	it('converts between HSL and hex', () => {
		expect(hslToHex({ h: 0, s: 100, l: 50 })).toBe('#ff0000');
		expect(hslToHex({ h: 120, s: 100, l: 50 })).toBe('#00ff00');
		expect(hslToHex({ h: 240, s: 0, l: 100 })).toBe('#ffffff');
		const round = hslToHex(hexToHsl('#3a7bd5'));
		expect(round).toBe('#3a7bd5');
		expect(hexToHsl('#808080').s).toBe(0);
	});
});

describe('T2.S8 U2 — Paint preferences', () => {
	it('reads unrecognised shapes as empty and caps lists', () => {
		expect(sanitisePaintPreferences(null)).toBe(EMPTY_PAINT_PREFERENCES);
		expect(sanitisePaintPreferences('nope')).toBe(EMPTY_PAINT_PREFERENCES);
		const raw = { favouriteColours: ['#aabbcc', 3, '#aabbcc', ''], recentMaterials: Array.from({ length: 40 }, (_, index) => `m${index}`) };
		const read = sanitisePaintPreferences(raw);
		expect(read.favouriteColours).toEqual(['#aabbcc']);
		expect(read.recentMaterials).toHaveLength(PAINT_RECENTS_LIMIT);
		expect(read.recentColours).toEqual([]);
	});

	it('persists through the device store and survives corrupt or blocked storage', () => {
		const data = new Map<string, string>();
		const storage = {
			getItem: (key: string) => data.get(key) ?? null,
			setItem: (key: string, value: string) => void data.set(key, value)
		} as unknown as Storage;
		const store = createDevicePaintPreferences(storage, 'k');
		expect(store.load()).toEqual(EMPTY_PAINT_PREFERENCES);
		store.save({ ...EMPTY_PAINT_PREFERENCES, recentColours: ['#aabbcc'] });
		expect(createDevicePaintPreferences(storage, 'k').load().recentColours).toEqual(['#aabbcc']);

		data.set('k', '{not json');
		expect(createDevicePaintPreferences(storage, 'k').load()).toEqual(EMPTY_PAINT_PREFERENCES);

		const blocked = {
			getItem: () => {
				throw new Error('blocked');
			},
			setItem: () => {
				throw new Error('full');
			}
		} as unknown as Storage;
		const guarded = createDevicePaintPreferences(blocked, 'k');
		expect(guarded.load()).toEqual(EMPTY_PAINT_PREFERENCES);
		expect(() => guarded.save(EMPTY_PAINT_PREFERENCES)).not.toThrow();
		expect(createDevicePaintPreferences(null).load()).toEqual(EMPTY_PAINT_PREFERENCES);
	});

	it('keeps the memory store for tests', () => {
		const store = createMemoryPaintPreferences();
		store.save({ ...EMPTY_PAINT_PREFERENCES, favouriteMaterials: ['curated:x'] });
		expect(store.saved().favouriteMaterials).toEqual(['curated:x']);
	});
});
