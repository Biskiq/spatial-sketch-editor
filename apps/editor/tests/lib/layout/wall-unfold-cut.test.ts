import { describe, expect, it } from 'vitest';

import { wallUnfoldCutStation } from '$lib/layout/wall-unfold';

describe('wallUnfoldCutStation', () => {
	it('keeps the opposite-anchor cut when no Opening occupies it', () => {
		expect(wallUnfoldCutStation(0, 10, [])).toBeCloseTo(5, 9);
		expect(wallUnfoldCutStation(2, 10, [{ start: 0, end: 1 }])).toBeCloseTo(7, 9);
	});

	it('moves the cut out of an Opening void by the nearest solid gap', () => {
		const cut = wallUnfoldCutStation(0, 10, [{ start: 4.5, end: 5.5 }]);
		expect(cut).toBeGreaterThan(5.58);
		expect(cut).toBeLessThanOrEqual(5.7);
	});

	it('wraps a cut that would land on an Opening across the closed seam', () => {
		const cut = wallUnfoldCutStation(9, 10, [{ start: 0, end: 6 }]);
		expect(cut).toBeGreaterThan(6.08);
		expect(cut).toBeLessThan(7);
	});

	it('returns the raw cut when the whole Wall is occupied, never an unrenderable station', () => {
		expect(wallUnfoldCutStation(0, 4, [{ start: 0, end: 4 }])).toBeCloseTo(2, 9);
	});
});
