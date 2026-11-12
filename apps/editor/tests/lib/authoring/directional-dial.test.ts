/**
 * T2 gallery UX recovery §5.5 — the Directional dial's placement and the
 * shelf's creation direction. Both are presentation values derived from the
 * camera and the scene bounds, never stored.
 */
import { describe, expect, it } from 'vitest';
import {
	directionalDialFrame,
	directionalShelfRotation,
	DIRECTIONAL_DIAL_MIN_RADIUS_METERS
} from '$lib/authoring/look/directional-dial';
import { presentationAngles } from '$lib/authoring/look/light-presentation';

const viewport = { width: 1000, height: 800 };
/** Plan-like projection: 100 px per metre, y ignored. */
const project = (point: readonly [number, number, number]): [number, number] => [
	500 + point[0] * 100,
	400 + point[2] * 100
];

describe('Directional dial frame', () => {
	it('uses the bounds centre on the datum when it projects inside the Stage', () => {
		const frame = directionalDialFrame({
			datumMeters: 0,
			boundsCenter: [1, 2, 1],
			project,
			centerRay: null,
			viewport,
			cameraRight: [1, 0, 0]
		});
		expect(frame.center).toEqual([1, 0, 1]);
		expect(frame.radius).toBeCloseTo(0.72, 9);
	});

	it('falls back to the viewport-centre datum hit when the bounds are off-stage', () => {
		const frame = directionalDialFrame({
			datumMeters: 0.2,
			boundsCenter: [20, 2, 20],
			project,
			centerRay: { origin: [0, 3, 0], direction: [0, -1, 0.01] },
			viewport,
			cameraRight: [1, 0, 0]
		});
		expect(frame.center[1]).toBeCloseTo(0.2, 9);
		expect(frame.center[0]).not.toBe(20);
		expect(frame.radius).toBeCloseTo(0.72, 9);
	});

	it('never draws a dial smaller than half a metre', () => {
		const dense = (point: readonly [number, number, number]): [number, number] => [
			500 + point[0] * 1000,
			400 + point[2] * 1000
		];
		const frame = directionalDialFrame({
			datumMeters: 0,
			boundsCenter: [0, 0, 0],
			project: dense,
			centerRay: null,
			viewport: { width: 10000, height: 8000 },
			cameraRight: [1, 0, 0]
		});
		expect(frame.radius).toBe(DIRECTIONAL_DIAL_MIN_RADIUS_METERS);
	});
});

describe('Directional shelf creation', () => {
	it('comes from behind the viewer left shoulder at 50 degrees', () => {
		const rotation = directionalShelfRotation([0, 0, -1]);
		const angles = presentationAngles(rotation);
		expect(angles.heightInSky).toBeCloseTo(50, 6);
		// Behind the viewer (+Z) and to their left (−X) reads 225°.
		expect(angles.from).toBeCloseTo(225, 6);
	});

	it('turns with the camera and never produces a zero direction', () => {
		const rotation = directionalShelfRotation([0, 0, 0]);
		const angles = presentationAngles(rotation);
		expect(Number.isFinite(angles.from)).toBe(true);
		expect(angles.heightInSky).toBeCloseTo(50, 6);
	});
});
