import { describe, expect, it } from 'vitest';
import { deltaE2000, labFromLinearSrgb } from '$lib/dev/s8-colour-difference';

type Lab = readonly [number, number, number];

// Published verification pairs: Sharma, Wu and Dalal (2005), table 1.
const PAIRS: readonly (readonly [Lab, Lab, number])[] = [
	[[50, 2.6772, -79.7751], [50, 0, -82.7485], 2.0425],
	[[50, -1.3802, -84.2814], [50, 0, -82.7485], 1.0],
	[[50, 0, 0], [50, -1, 2], 2.3669],
	[[50, 2.49, -0.001], [50, -2.49, 0.0009], 7.1792],
	[[50, 2.49, -0.001], [50, -2.49, 0.0011], 7.2195],
	[[50, -0.001, 2.49], [50, 0.0009, -2.49], 4.8045],
	[[50, 2.5, 0], [50, 0, -2.5], 4.3065],
	[[50, 2.5, 0], [73, 25, -18], 27.1492],
	[[60.2574, -34.0099, 36.2677], [60.4626, -34.1751, 39.4387], 1.2644],
	[[63.0109, -31.0961, -5.8663], [62.8187, -29.7946, -4.0864], 1.263],
	[[61.2901, 3.7196, -5.3901], [61.4292, 2.248, -4.962], 1.8731],
	[[35.0831, -44.1164, 3.7933], [35.0232, -40.0716, 1.5901], 1.8645],
	[[22.7233, 20.0904, -46.694], [23.0331, 14.973, -42.5619], 2.0373],
	[[36.4612, 47.858, 18.3852], [36.2715, 50.5065, 21.2231], 1.4146],
	[[2.0776, 0.0795, -1.135], [0.9033, -0.0636, -0.5514], 0.9082]
];

describe('CIEDE2000 for the E7 gate', () => {
	it.each(PAIRS)('%j against %j is %f in both directions', (one, two, expected) => {
		expect(deltaE2000(one, two)).toBeCloseTo(expected, 4);
		expect(deltaE2000(two, one)).toBeCloseTo(expected, 4);
	});

	it('reads linear sRGB white and black as Lab 100 and 0', () => {
		const white = labFromLinearSrgb([1, 1, 1]);
		expect(white[0]).toBeCloseTo(100, 3);
		expect(white[1]).toBeCloseTo(0, 2);
		expect(white[2]).toBeCloseTo(0, 2);
		expect(labFromLinearSrgb([0, 0, 0])).toEqual([0, 0, 0]);
	});
});
