import { describe, expect, it } from 'vitest';
import {
	BRIGHTNESS_STOPS,
	deltaE00,
	linearToSrgb,
	relativeLuminance,
	rgbToLab,
	srgbToLinear
} from '../../../src/routes/dev/render-audit/audit';

type Lab = readonly [number, number, number];

describe('S0 Gate A colour math', () => {
	it('matches the published CIEDE2000 test pairs', () => {
		const pairs: readonly (readonly [Lab, Lab, number])[] = [
			[[50, 2.6772, -79.7751], [50, 0, -82.7485], 2.0425],
			[[50, 3.1571, -77.2803], [50, 0, -82.7485], 2.8615],
			[[50, 2.8361, -74.02], [50, 0, -82.7485], 3.4412],
			[[50, -1.3802, -84.2814], [50, 0, -82.7485], 1.0],
			[[50, 0, 0], [50, -1, 2], 2.3669]
		];
		for (const [left, right, expected] of pairs) {
			expect(deltaE00(left, right)).toBeCloseTo(expected, 3);
		}
	});

	it('round-trips sRGB transfer without drift', () => {
		for (const value of [0, 1, 18, 64, 128, 192, 254, 255]) {
			expect(linearToSrgb(srgbToLinear(value))).toBeCloseTo(value, 5);
		}
	});

	it('anchors relative luminance at black and white', () => {
		expect(relativeLuminance([0, 0, 0])).toBe(0);
		expect(relativeLuminance([255, 255, 255])).toBeCloseTo(1, 6);
		expect(rgbToLab([255, 255, 255])[0]).toBeCloseTo(100, 4);
		expect(rgbToLab([255, 255, 255])[1]).toBeCloseTo(0, 4);
		expect(rgbToLab([255, 255, 255])[2]).toBeCloseTo(0, 4);
	});

	it('exposes the approved Brightness stop factors', () => {
		expect(BRIGHTNESS_STOPS.map((entry) => entry.stop)).toEqual([-2, -1, 0, 1, 2]);
		expect(BRIGHTNESS_STOPS.map((entry) => entry.factor)).toEqual([0.25, 0.5, 1, 2, 4]);
	});
});
