/**
 * R217.S05 — the drafting fact's arithmetic.
 *
 * Grid, Snap and Scale are one view state: they must never become a source
 * writer, a second Camera or a hidden commit correction. These are the pure
 * facts the shell, Layout Ink and Scene placement share.
 */
import { describe, expect, it } from 'vitest';
import {
	GRID_MINOR_CHOICES,
	METERS_PER_CSS_PIXEL_AT_UNITY_SCALE,
	SCALE_DETENTS,
	STAGE_DRAFTING_DEFAULTS,
	applyDraftingPatch,
	draftingSnapIncrementMeters,
	formatMeters,
	formatScaleRatio,
	gridWord,
	isGridMinorMeters,
	metersPerCssPixelForScaleRatio,
	roundScaleBarLength,
	scaleDetentIntent,
	scaleRatioForMetersPerCssPixel,
	snapDraftingCoordinate,
	snapDraftingPlacement,
	snapDraftingPoint,
	snapWord
} from '$lib/authoring/stage/stage-drafting';

describe('R217.S05 — the one Grid/Snap view state', () => {
	it('starts with Grid and Snap on at the 1 m reference interval', () => {
		expect(STAGE_DRAFTING_DEFAULTS).toEqual({
			grid: true,
			snap: true,
			snapSuspended: false,
			gridMinorMeters: 1
		});
	});

	it('accepts only the approved 1, 2, 5 ladder as a configured interval', () => {
		for (const value of [0.5, 1, 2, 5, 10, 0.02, 200, 1000]) {
			expect(isGridMinorMeters(value)).toBe(true);
		}
		for (const value of [0, -1, 0.3, 3, 7, 5000, Number.NaN, Number.POSITIVE_INFINITY, '1', null]) {
			expect(isGridMinorMeters(value)).toBe(false);
		}
		expect(GRID_MINOR_CHOICES.every(isGridMinorMeters)).toBe(true);
	});

	it('applies a patch as one value and keeps identity for a no-op', () => {
		const next = applyDraftingPatch(STAGE_DRAFTING_DEFAULTS, { grid: false, gridMinorMeters: 2 });
		expect(next).toEqual({ ...STAGE_DRAFTING_DEFAULTS, grid: false, gridMinorMeters: 2 });
		expect(applyDraftingPatch(next, { grid: false })).toBe(next);
		// An unsupported interval is ignored rather than inventing spacing.
		expect(applyDraftingPatch(next, { gridMinorMeters: 3 }).gridMinorMeters).toBe(2);
	});

	it('gives Snap the one minor interval and honours off and held independently of Grid', () => {
		expect(draftingSnapIncrementMeters(STAGE_DRAFTING_DEFAULTS)).toBe(1);
		expect(draftingSnapIncrementMeters({ ...STAGE_DRAFTING_DEFAULTS, snap: false })).toBeNull();
		expect(draftingSnapIncrementMeters({ ...STAGE_DRAFTING_DEFAULTS, snapSuspended: true })).toBeNull();
		// The two controls are independent facts: Grid off must not silently move
		// where the next free point lands.
		expect(draftingSnapIncrementMeters({ ...STAGE_DRAFTING_DEFAULTS, grid: false })).toBe(1);
	});

	it('rounds a datum point to the shared increment, or passes it through when held', () => {
		expect(snapDraftingPoint([1.37, 2.81], STAGE_DRAFTING_DEFAULTS)).toEqual([1, 3]);
		expect(
			snapDraftingPoint([1.37, 2.81], { ...STAGE_DRAFTING_DEFAULTS, gridMinorMeters: 0.5 })
		).toEqual([1.5, 3]);
		expect(
			snapDraftingPoint([1.37, 2.81], { ...STAGE_DRAFTING_DEFAULTS, snapSuspended: true })
		).toEqual([1.37, 2.81]);
	});

	it('exposes one placement rounding with one cleaning and tie rule', () => {
		// Layout Ink and Scene placement both call this function, so a mirrored
		// coordinate must not differ by a float or by the sign of the half step.
		expect(snapDraftingPlacement([1.37, 2.81], 0.2)).toEqual({
			x: 1.4,
			z: 2.8,
			snappedStep: 0.2
		});
		expect(snapDraftingCoordinate(1.37, 0.2)).toBe(1.4);
		expect(snapDraftingCoordinate(-1.37, 0.2)).toBe(-1.4);
		expect(snapDraftingCoordinate(-1.5, 1)).toBe(-2);
		expect(snapDraftingCoordinate(1.5, 1)).toBe(2);
		expect(Object.is(snapDraftingCoordinate(-0.0000001, 1), -0)).toBe(false);
		expect(snapDraftingPlacement([1.37, 2.81], null)).toEqual({
			x: 1.37,
			z: 2.81,
			snappedStep: null
		});
		expect(snapDraftingPlacement([1.37, 2.81], 0)).toEqual({
			x: 1.37,
			z: 2.81,
			snappedStep: null
		});
	});

	it('says each state in words, never colour alone', () => {
		expect(gridWord(STAGE_DRAFTING_DEFAULTS)).toBe('Grid 1 m');
		expect(gridWord({ ...STAGE_DRAFTING_DEFAULTS, grid: false })).toBe('Grid off');
		expect(gridWord(STAGE_DRAFTING_DEFAULTS, 2)).toBe('Grid 2 m');
		expect(snapWord(STAGE_DRAFTING_DEFAULTS)).toBe('Snap 1 m');
		expect(snapWord({ ...STAGE_DRAFTING_DEFAULTS, snapSuspended: true })).toBe('Snap held');
		expect(snapWord({ ...STAGE_DRAFTING_DEFAULTS, snap: false })).toBe('Snap off');
		expect(formatMeters(0.5)).toBe('0.5 m');
	});
});

describe('R217.S05 — Scale, detents and the bar', () => {
	it('reads the settled target-plane scale at the 96 dpi reference', () => {
		expect(METERS_PER_CSS_PIXEL_AT_UNITY_SCALE).toBeCloseTo(0.0002645833, 9);
		expect(formatScaleRatio(0.0254 / 96)).toBe('1:1');
		expect(formatScaleRatio((0.0254 / 96) * 100)).toBe('1:100');
		// Past unity the Stage must say N:1 instead of claiming a false 1:1.
		expect(formatScaleRatio((0.0254 / 96) * 0.2)).toBe('5:1');
		expect(formatScaleRatio((0.0254 / 96) * 2)).toBe('1:2');
		expect(formatScaleRatio(null)).toBe('—');
		expect(scaleRatioForMetersPerCssPixel(0)).toBeNull();
	});

	it('turns a detent into the existing zoom intent without composing a pose', () => {
		const current = 0.01;
		const target = metersPerCssPixelForScaleRatio(100)!;
		const intent = scaleDetentIntent(100, current);
		expect(intent).toEqual({ kind: 'zoom', scale: target / current });
		// Applying zoom's own multiplier lands exactly on the requested ratio.
		expect(current * (intent as { scale: number }).scale).toBeCloseTo(target, 12);
		expect(scaleDetentIntent(100, 0)).toBeNull();
		expect(scaleDetentIntent(0, current)).toBeNull();
	});

	it('offers PLATE’s five detents in ascending order', () => {
		expect(SCALE_DETENTS).toEqual([20, 50, 100, 200, 500]);
	});

	it('picks a round scale-bar length that stays readable and never overruns', () => {
		const bar = roundScaleBarLength(0.01)!;
		expect(bar.meters).toBe(1);
		expect(bar.cssPx).toBeCloseTo(100, 9);
		for (let exponent = -4; exponent <= 3; exponent += 1) {
			for (const mantissa of [1, 2, 5]) {
				const metersPerCssPixel = mantissa * 10 ** exponent;
				const picked = roundScaleBarLength(metersPerCssPixel);
				if (picked === null) continue;
				expect(picked.cssPx).toBeLessThanOrEqual(140 + 1e-9);
				expect(picked.cssPx).toBeGreaterThan(0);
				// The label is a round ladder value, not the raw projected distance.
				const barMantissa = picked.meters / 10 ** Math.floor(Math.log10(picked.meters) + 1e-9);
				expect([1, 2, 5].some((value) => Math.abs(value - barMantissa) < 1e-9)).toBe(true);
			}
		}
		expect(roundScaleBarLength(0)).toBeNull();
	});
});
