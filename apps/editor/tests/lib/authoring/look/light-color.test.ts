/**
 * T2 gallery UX recovery — Warmth, Colour and Brightness presentation.
 *
 * Warmth is an sRGB white ramp, never kelvin; Colour is HSV with value fixed at
 * 1; Brightness is π × 2^s so the accepted chips are exact slider stops.
 */
import { describe, expect, it } from 'vitest';
import {
	brightnessForSlider,
	brightnessSliderValue,
	colourAmount,
	hexToHsv,
	hsvToHex,
	nearestWarmth,
	snapBrightnessSlider,
	warmthColorAt,
	warmthName,
	warmthReading
} from '$lib/authoring/look/light-color';
import { LIGHT_INTENSITY_REFERENCE } from '$lib/authoring/look/light-units';

describe('Warmth ramp', () => {
	it('hits the five approved stops', () => {
		expect(warmthColorAt(-100)).toBe('#ffb46b');
		expect(warmthColorAt(-50)).toBe('#ffd6a5');
		expect(warmthColorAt(0)).toBe('#ffffff');
		expect(warmthColorAt(50)).toBe('#dbe9ff');
		expect(warmthColorAt(100)).toBe('#b8d0ff');
	});

	it('interpolates per channel between stops and clamps outside', () => {
		expect(warmthColorAt(-75)).toBe('#ffc588');
		expect(warmthColorAt(-200)).toBe('#ffb46b');
		expect(warmthColorAt(200)).toBe('#b8d0ff');
	});

	it('names the ramp with the approved boundaries', () => {
		expect(warmthName(-100)).toBe('Candle');
		expect(warmthName(-75)).toBe('Candle');
		expect(warmthName(-74)).toBe('Warm');
		expect(warmthName(-25)).toBe('Warm');
		expect(warmthName(-24)).toBe('Neutral');
		expect(warmthName(24)).toBe('Neutral');
		expect(warmthName(25)).toBe('Cool');
		expect(warmthName(74)).toBe('Cool');
		expect(warmthName(75)).toBe('Sky');
	});
});

describe('reading a stored colour', () => {
	it('reports a white-ramp colour in White mode at its nearest w', () => {
		expect(warmthReading('#ffffff')).toMatchObject({ white: true, w: 0, label: 'Neutral' });
		expect(nearestWarmth('#ffd6a5').exact).toBe(true);
		expect(nearestWarmth('#ffd6a5').w).toBe(-50);
	});

	it('reports an off-ramp colour as Custom', () => {
		expect(warmthReading('#ff0000')).toMatchObject({ white: false, label: 'Custom' });
	});

	it('round-trips every ramp colour', () => {
		for (const w of [-100, -50, 0, 50, 100]) {
			const reading = nearestWarmth(warmthColorAt(w));
			expect(reading.exact).toBe(true);
			expect(reading.w).toBe(w);
		}
	});
});

describe('Colour dial', () => {
	it('maps hue and amount to HSV with value 1', () => {
		expect(hsvToHex(0, 1)).toBe('#ff0000');
		expect(hsvToHex(120, 1)).toBe('#00ff00');
		expect(hsvToHex(0, 0)).toBe('#ffffff');
		const hsv = hexToHsv('#ff8000');
		expect(hsv.hue).toBeCloseTo(30.1, 1);
		expect(hsv.saturation).toBeCloseTo(1, 4);
		expect(hsv.value).toBeCloseTo(1, 4);
	});

	it('round-trips hue and amount', () => {
		for (const hue of [0, 45, 180, 300]) {
			for (const amount of [0.2, 0.6, 1]) {
				const colour = hsvToHex(hue, amount);
				const hsv = hexToHsv(colour);
				expect(hsv.hue).toBeCloseTo(hue, 0);
				expect(hsv.saturation).toBeCloseTo(amount, 1);
			}
		}
		expect(colourAmount('#ff0000')).toBe(100);
		expect(colourAmount('#ffffff')).toBe(0);
	});
});

describe('Brightness slider', () => {
	it('maps π × 2^s and the five chips exactly', () => {
		expect(brightnessForSlider(0)).toBe(LIGHT_INTENSITY_REFERENCE);
		expect(brightnessForSlider(-2)).toBeCloseTo(LIGHT_INTENSITY_REFERENCE * 0.25, 9);
		expect(brightnessForSlider(2)).toBeCloseTo(LIGHT_INTENSITY_REFERENCE * 4, 9);
		expect(brightnessSliderValue(LIGHT_INTENSITY_REFERENCE)).toBeCloseTo(0, 9);
		expect(brightnessSliderValue(LIGHT_INTENSITY_REFERENCE * 4)).toBeCloseTo(2, 9);
	});

	it('snaps within ±0.05 of a chip and keeps other values', () => {
		expect(snapBrightnessSlider(0.04)).toBe(0);
		expect(snapBrightnessSlider(-0.96)).toBe(-1);
		expect(snapBrightnessSlider(0.12)).toBe(0.1);
		expect(snapBrightnessSlider(2.04)).toBe(2);
	});
});
