/**
 * T1 SL1 — the typed Level cut.
 *
 * The cut's arithmetic is the one place the Slice can be wrong before anything
 * is drawn: a datum offset, a normalised depth, or an off-by-epsilon boundary
 * would put the GPU plane, Plan's membership and picking on different meanings.
 * These tests pin the resolve rule, the hidden pieces, the predicate's inclusive
 * band, Plan's mapping and the depth menu's exclusions.
 */
import { describe, expect, it } from 'vitest';

import { PLAN_DEFAULT_DEPTH_METERS } from '$lib/authoring/stage/plan-parameters';
import {
	SLICE_HIDE_EPSILON_METERS,
	depthMatches,
	depthMenuItems,
	hiddenPiecesOf,
	planOverridesOf,
	resolveSlice,
	sliceHides,
	type LevelDepth,
	type SliceReading
} from '$lib/authoring/stage/slice/slice-cut';

const level = (depth: LevelDepth): SliceReading => ({ kind: 'level', depth });
const toFloor = level({ kind: 'to-floor' });
const below = (meters: number): SliceReading => level({ kind: 'below', meters });

describe('T1 SL1 — resolving a Level reading', () => {
	it('puts the cut at the Sheet height above the datum', () => {
		expect(resolveSlice(toFloor, { sheetHeight: 1.2, datumMeters: 0 })).toEqual({
			kind: 'level',
			cutY: 1.2,
			lowerY: null
		});
		expect(resolveSlice(toFloor, { sheetHeight: 1.2, datumMeters: 3 })).toEqual({
			kind: 'level',
			cutY: 4.2,
			lowerY: null
		});
	});

	it('measures a below depth down from the cut, and follows the Sheet', () => {
		expect(resolveSlice(below(0.5), { sheetHeight: 1.2, datumMeters: 0 })).toEqual({
			kind: 'level',
			cutY: 1.2,
			lowerY: 0.7
		});
		expect(resolveSlice(below(0.5), { sheetHeight: 2.2, datumMeters: 0.5 })).toEqual({
			kind: 'level',
			cutY: 2.7,
			lowerY: 2.2
		});
	});

	it('normalises a lower bound at or below the datum to to-floor', () => {
		for (const meters of [1.2, 2, 10]) {
			expect(resolveSlice(below(meters), { sheetHeight: 1.2, datumMeters: 0 })).toEqual({
				kind: 'level',
				cutY: 1.2,
				lowerY: null
			});
		}
		expect(resolveSlice(below(1.1), { sheetHeight: 1, datumMeters: 0.75 })).toEqual({
			kind: 'level',
			cutY: 1.75,
			lowerY: null
		});
	});

	it('treats a non-positive or non-finite below depth as to-floor', () => {
		for (const meters of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
			expect(resolveSlice(below(meters), { sheetHeight: 1.2, datumMeters: 0 }).lowerY).toBeNull();
		}
	});
});

describe('T1 SL1 — hidden pieces and the predicate', () => {
	it('names one piece for to-floor and two for a finite depth', () => {
		const shallow = resolveSlice(toFloor, { sheetHeight: 1.2, datumMeters: 0 });
		expect(hiddenPiecesOf(shallow)).toEqual([{ kind: 'above', cutY: 1.2 }]);

		const band = resolveSlice(below(0.5), { sheetHeight: 1.2, datumMeters: 0 });
		expect(hiddenPiecesOf(band)).toEqual([
			{ kind: 'above', cutY: 1.2 },
			{ kind: 'below', lowerY: 0.7 }
		]);
	});

	it('keeps the band inclusive and discards only beyond the epsilon', () => {
		const resolved = resolveSlice(below(0.5), { sheetHeight: 1.2, datumMeters: 0 });
		const eps = SLICE_HIDE_EPSILON_METERS;
		const hiddenAt = (y: number): boolean => sliceHides(resolved, 4, y, -2);

		expect(hiddenAt(1.21)).toBe(true);
		expect(hiddenAt(1.2 + eps)).toBe(false);
		expect(hiddenAt(1.2)).toBe(false);
		expect(hiddenAt(1.0)).toBe(false);
		expect(hiddenAt(0.7)).toBe(false);
		expect(hiddenAt(0.7 - eps)).toBe(false);
		expect(hiddenAt(0.69)).toBe(true);
		expect(hiddenAt(0.49)).toBe(true);
	});

	it('ignores plan position: a Level cut is purely vertical', () => {
		const resolved = resolveSlice(toFloor, { sheetHeight: 1.2, datumMeters: 0 });
		for (const [x, z] of [
			[0, 0],
			[100, -100],
			[-5, 12]
		] as const) {
			expect(sliceHides(resolved, x, 2, z)).toBe(true);
			expect(sliceHides(resolved, x, 1, z)).toBe(false);
		}
	});
});

describe('T1 SL1 — Plan mapping', () => {
	it('keeps Plan’s calibrated depth for to-floor', () => {
		const resolved = resolveSlice(toFloor, { sheetHeight: 1.2, datumMeters: 0 });
		expect(planOverridesOf(resolved)).toEqual({ depthMeters: PLAN_DEFAULT_DEPTH_METERS });
	});

	it('maps a finite depth to the drawn band', () => {
		const resolved = resolveSlice(below(0.5), { sheetHeight: 1.2, datumMeters: 0 });
		expect(planOverridesOf(resolved).depthMeters).toBeCloseTo(0.5, 12);
	});
});

describe('T1 SL1 — the depth menu', () => {
	const ticks = [
		{ heightMeters: 0, label: 'Floor' },
		{ heightMeters: 0.1, label: 'Sill' },
		{ heightMeters: 0.5, label: 'Pin' },
		{ heightMeters: 1.2, label: 'Wall top' },
		{ heightMeters: 1.5, label: 'Ceiling' }
	];

	it('offers To the floor and only ticks strictly between the datum and the cut', () => {
		const resolved = resolveSlice(toFloor, { sheetHeight: 1.2, datumMeters: 0 });
		const items = depthMenuItems(resolved, ticks);
		expect(items.map((item) => item.label)).toEqual(['To the floor', 'Sill', 'Pin']);
		expect(items.map((item) => item.depth)).toEqual([
			{ kind: 'to-floor' },
			{ kind: 'below', meters: 1.1 },
			{ kind: 'below', meters: 0.7 }
		]);
	});

	it('compares ticks against the same datum the cut uses', () => {
		const resolved = resolveSlice(toFloor, { sheetHeight: 1.2, datumMeters: 2 });
		const items = depthMenuItems(resolved, ticks, 2);
		expect(items.map((item) => item.label)).toEqual(['To the floor', 'Sill', 'Pin']);
		expect(items[1]!.depth).toEqual({ kind: 'below', meters: 1.1 });
	});

	it('collapses duplicate heights to one item', () => {
		const resolved = resolveSlice(toFloor, { sheetHeight: 1.2, datumMeters: 0 });
		const items = depthMenuItems(
			resolved,
			[...ticks, { heightMeters: 0.5, label: 'Pin again' }]
		);
		expect(items.filter((item) => item.label.startsWith('Pin'))).toHaveLength(1);
	});

	it('marks the item the slice is currently showing', () => {
		const resolved = resolveSlice(below(0.5), { sheetHeight: 1.2, datumMeters: 0 });
		expect(depthMatches(resolved, { kind: 'below', meters: 0.5 })).toBe(true);
		expect(depthMatches(resolved, { kind: 'below', meters: 0.6 })).toBe(false);
		expect(depthMatches(resolved, { kind: 'to-floor' })).toBe(false);
		expect(
			depthMatches(resolveSlice(toFloor, { sheetHeight: 1.2, datumMeters: 0 }), {
				kind: 'to-floor'
			})
		).toBe(true);
	});
});
