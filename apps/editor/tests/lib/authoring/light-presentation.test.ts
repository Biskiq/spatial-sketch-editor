/**
 * T2 gallery UX recovery — the light presentation rules.
 *
 * These cases pin the derived quantities the Stage and the Card share: the
 * Spot target that is independent of Reach, the renderer-matched soft-edge ring, the Point reach
 * ring and the approved placement stand-off table.
 */
import { describe, expect, it } from 'vitest';
import type { Vec3 } from '@portfolio/project-model';
import { rotationForLightDirection } from '$lib/authoring/look/light-aim';
import {
	formatDegrees,
	formatExactIntensity,
	formatMeters,
	formatMultiplier,
	LIGHT_POINT_STANDOFF_METERS,
	LIGHT_SPOT_STANDOFF_METERS,
	LIGHT_WORKING_HEIGHT_METERS,
	lightDropStem,
	lightPlacementBody,
	penumbraForInnerRadius,
	pointReachRingRadius,
	spotFootprintRadius,
	spotInnerRadius,
	spotTarget
} from '$lib/authoring/look/light-presentation';

const DEGREES = (value: number): number => (value * Math.PI) / 180;

function close(actual: number, expected: number, digits = 6): void {
	expect(actual).toBeCloseTo(expected, digits);
}

describe('spot target distance', () => {
	it('uses the forward ray surface hit and marks it surface-bound', () => {
		const target = spotTarget({
			position: [0, 2, 0],
			rotation: rotationForLightDirection([0, 0, -1]),
			pick: () => ({ distanceMeters: 2.5, worldPoint: [0, 2, -2.5] })
		});
		close(target.distance, 2.5);
		expect(target.target).toEqual([0, 2, -2.5]);
		expect(target.surfaceBound).toBe(true);
	});

	it('falls back to 3 m in empty space', () => {
		const target = spotTarget({
			position: [0, 2, 0],
			rotation: rotationForLightDirection([0, 0, -1]),
			pick: () => null
		});
		close(target.distance, 3);
		close(target.target[2], -3);
		expect(target.surfaceBound).toBe(false);
	});

	it('has no range input, so the authored Reach cannot change the target', () => {
		const surface = spotTarget({
			position: [0, 2, 0],
			rotation: rotationForLightDirection([0, -1, 0]),
			pick: () => ({ distanceMeters: 2, worldPoint: [0, 0, 0] })
		});
		const far = spotTarget({
			position: [0, 2, 0],
			rotation: rotationForLightDirection([0, -1, 0]),
			pick: () => ({ distanceMeters: 2, worldPoint: [0, 0, 0] })
		});
		close(surface.distance, far.distance);
	});
});

describe('spot soft-edge ring', () => {
	it('puts a hard beam’s inner ring on the footprint ring', () => {
		close(spotInnerRadius(4, DEGREES(30), 0), spotFootprintRadius(4, DEGREES(30)));
	});

	it('matches the renderer formula angle × (1 − penumbra)', () => {
		close(
			spotInnerRadius(4, DEGREES(30), 0.25),
			spotFootprintRadius(4, DEGREES(30) * 0.75)
		);
	});

	it('inverts the inner radius back to penumbra', () => {
		for (const penumbra of [0, 0.1, 0.5, 0.9, 1]) {
			const radius = spotInnerRadius(5, DEGREES(40), penumbra);
			close(penumbraForInnerRadius(5, DEGREES(40), radius), penumbra, 5);
		}
	});
});

describe('point reach ring', () => {
	it('uses the sphere/datum intersection rather than the authored range', () => {
		const ring = pointReachRingRadius(5, 3);
		expect(ring.onDatum).toBe(true);
		close(ring.radius, 4);
	});

	it('reports no floor ring when the sphere does not reach the datum', () => {
		expect(pointReachRingRadius(2, 3).onDatum).toBe(false);
	});
});

describe('Point drop stem', () => {
	it('ends at the first surface below the body', () => {
		const end = lightDropStem([1, 2, 1], 0, () => ({
			distanceMeters: 0.9,
			worldPoint: [1.4, 1.1, 1.2]
		}));
		expect(end).toEqual([1, 1.1, 1]);
	});

	it('falls back to the datum with no surface below', () => {
		expect(lightDropStem([1, 2, 1], 0.2, () => null)).toEqual([1, 0.2, 1]);
		// A hit above the body is not "below" and cannot end the stem.
		expect(
			lightDropStem([1, 2, 1], 0.2, () => ({ distanceMeters: 1, worldPoint: [1, 3, 1] }))
		).toEqual([1, 0.2, 1]);
	});
});

describe('placement stand-off table', () => {
	const datum = 0.4;
	it('hangs a floor-like placement at the working height', () => {
		const body = lightPlacementBody({
			kind: 'spot',
			hit: { point: [1, datum, 2], normal: [0, 1, 0] },
			datumMeters: datum,
			ray: { origin: [1, 10, 2], direction: [0, -1, 0] }
		});
		expect(body).toEqual([1, datum + LIGHT_WORKING_HEIGHT_METERS, 2]);
	});

	it('stands Point and Spot off a wall by their own constants', () => {
		const point = lightPlacementBody({
			kind: 'point',
			hit: { point: [1, 1, 0], normal: [0, 0, 1] },
			datumMeters: datum,
			ray: { origin: [1, 1, 5], direction: [0, 0, -1] }
		});
		const spot = lightPlacementBody({
			kind: 'spot',
			hit: { point: [1, 1, 0], normal: [0, 0, 1] },
			datumMeters: datum,
			ray: { origin: [1, 1, 5], direction: [0, 0, -1] }
		});
		close(point![2], LIGHT_POINT_STANDOFF_METERS);
		close(spot![2], LIGHT_SPOT_STANDOFF_METERS);
	});

	it('drops a ceiling placement along the ceiling normal', () => {
		const body = lightPlacementBody({
			kind: 'point',
			hit: { point: [0, 3, 0], normal: [0, -1, 0] },
			datumMeters: datum,
			ray: { origin: [0, 1, 0], direction: [0, 1, 0] }
		});
		close(body![1], 3 - LIGHT_POINT_STANDOFF_METERS);
	});

	it('falls back to the working height over the datum, and refuses a parallel miss', () => {
		const body = lightPlacementBody({
			kind: 'point',
			hit: null,
			datumMeters: datum,
			ray: { origin: [0, 5, 0], direction: [0, -1, 0] }
		});
		close(body![1], datum + LIGHT_WORKING_HEIGHT_METERS);
		expect(
			lightPlacementBody({
				kind: 'point',
				hit: null,
				datumMeters: datum,
				ray: { origin: [0, 5, 0], direction: [1, 0, 0] }
			})
		).toBeNull();
	});
});

describe('light number formats', () => {
	it('formats metres, degrees, multipliers and exact intensity', () => {
		expect(formatMeters(2)).toBe('2.00 m');
		expect(formatDegrees(30.25)).toBe('30.3°');
		expect(formatDegrees(30.25, 0)).toBe('30°');
		expect(formatMultiplier(Math.PI)).toBe('1×');
		expect(formatMultiplier(Math.PI * 1.41)).toBe('1.41×');
		expect(formatExactIntensity(Math.PI)).toBe('3.142 cd');
	});
});
