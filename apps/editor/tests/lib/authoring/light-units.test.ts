import { describe, expect, it } from 'vitest';
import {
	brightnessStopForIntensity,
	degreesToRadians,
	formatBrightness,
	intensityForBrightnessStop,
	LIGHT_INTENSITY_REFERENCE,
	radiansToDegrees,
	spotCutoffForTargetDistance
} from '$lib/authoring/look/light-units';
import {
	aimTarget,
	cutoffForAimedSurface,
	lightForward,
	pointReachRing,
	rotationForLightDirection,
	spotConeGuide
} from '$lib/authoring/look/light-aim';

describe('S3 light units', () => {
	it('uses π as the 1× reference and round-trips the five stops', () => {
		expect(intensityForBrightnessStop(1)).toBe(LIGHT_INTENSITY_REFERENCE);
		for (const stop of [0.25, 0.5, 1, 2, 4]) {
			expect(brightnessStopForIntensity(intensityForBrightnessStop(stop))).toBe(stop);
		}
		// Directional intensity is lux; point/spot intensity is candela.
		expect(formatBrightness(Math.PI, 'directional')).toContain('lx');
		expect(formatBrightness(Math.PI, 'point')).toContain('cd');
		// Zero is a valid custom intensity, never the nearest 0.25× stop.
		expect(brightnessStopForIntensity(0)).toBeNull();
		expect(formatBrightness(0, 'point')).toBe('0.00 cd');
		expect(brightnessStopForIntensity(2.5)).toBeNull();
		expect(formatBrightness(2.5, 'directional')).toBe('2.50 lx');
		expect(brightnessStopForIntensity(Number.NaN)).toBeNull();
	});

	it('converts degrees and radians without a second angle unit', () => {
		expect(radiansToDegrees(Math.PI)).toBe(180);
		expect(degreesToRadians(30)).toBeCloseTo(Math.PI / 6, 12);
	});

	it('puts a created spot cutoff beyond the surface it was aimed at', () => {
		expect(spotCutoffForTargetDistance(3)).toBeGreaterThan(3);
		expect(cutoffForAimedSurface(3)).toBe(spotCutoffForTargetDistance(3));
	});
});

describe('S3 light aim and guides', () => {
	it('aims local −Z along the requested direction and round-trips it', () => {
		const forward = lightForward([0.4, 0.2, 0]);
		const rotation = rotationForLightDirection(forward);
		expect(lightForward(rotation)[0]).toBeCloseTo(forward[0], 10);
		expect(lightForward(rotation)[1]).toBeCloseTo(forward[1], 10);
		expect(lightForward(rotation)[2]).toBeCloseTo(forward[2], 10);
	});

	it('keeps the aim target separate from the spot cutoff', () => {
		const position: [number, number, number] = [2, 3, 2];
		const rotation = rotationForLightDirection([0, 0, -1]);
		const target = aimTarget(position, rotation, 1.5);
		expect(target[2]).toBeCloseTo(0.5, 8);
		expect(spotConeGuide({ position, rotation, halfAngle: Math.PI / 6, range: 5 }).capCenter[2]).toBeCloseTo(-3, 8);
	});

	it('draws a truthful cap at the authored range and bounds only the drawing angle', () => {
		const position: [number, number, number] = [0, 3, 0];
		const rotation = rotationForLightDirection([0, 0, -1]);
		const guide = spotConeGuide({
			position,
			rotation,
			halfAngle: Math.PI / 6,
			range: 4,
			ringSegments: 8
		});
		expect(guide.capCenter).toEqual([0, 3, -4]);
		expect(guide.capRadius).toBeCloseTo(Math.tan(Math.PI / 6) * 4, 8);
		expect(guide.capRing).toHaveLength(8);
		expect(guide.edges).toHaveLength(4);
		// π is stored and accepted; the drawn guide stops at 80°.
		const wide = spotConeGuide({ position, rotation, halfAngle: Math.PI, range: 4, ringSegments: 8 });
		expect(wide.capRadius).toBeCloseTo(Math.tan(degreesToRadians(80)) * 4, 8);
		expect(wide.halfAngle).toBe(Math.PI);
	});

	it('draws a point reach ring at the authored range', () => {
		const ring = pointReachRing({ position: [1, 2, 3], range: 2, segments: 8 });
		expect(ring).toHaveLength(8);
		for (const point of ring) {
			expect(Math.hypot(point[0] - 1, point[2] - 3)).toBeCloseTo(2, 8);
			expect(point[1]).toBe(2);
		}
	});
});
