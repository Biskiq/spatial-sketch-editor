/**
 * T2 gallery UX recovery §5.5 — the Directional dial's placement and the
 * shelf's creation direction. Both are presentation values derived from the
 * camera and the scene bounds, never stored.
 */
import { describe, expect, it } from 'vitest';
import {
	directionalDialBearingPoint,
	directionalDialCompanions,
	directionalDialFrame,
	directionalDialName,
	directionalDialTick,
	directionalDialTickHalfLength,
	directionalShelfRotation,
	DIRECTIONAL_DIAL_MIN_RADIUS_METERS,
	DIRECTIONAL_DIAL_NAME_LIMIT
} from '$lib/authoring/look/directional-dial';
import { rotationForLightDirection } from '$lib/authoring/look/light-aim';
import {
	directionForPresentationAngles,
	presentationAngles
} from '$lib/authoring/look/light-presentation';

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

describe('Directional dial companions', () => {
	const aimedAt = (from: number, height: number) =>
		rotationForLightDirection(directionForPresentationAngles(from, height));

	it('lists every other Directional light by bearing, never the selected one', () => {
		const companions = directionalDialCompanions(
			[
				{ id: 'sun', name: 'Sun', rotation: aimedAt(225, 50) },
				{ id: 'fill', name: 'North fill', rotation: aimedAt(20, 30) }
			],
			'sun'
		);
		expect(companions.map((companion) => companion.id)).toEqual(['fill']);
		expect(companions[0]!.from).toBeCloseTo(20, 6);
	});

	it('truncates the centre name to 18 characters including the ellipsis', () => {
		expect(directionalDialName('Sun')).toBe('Sun');
		const long = directionalDialName('Afternoon fill from the north window');
		expect(long).toHaveLength(DIRECTIONAL_DIAL_NAME_LIMIT);
		expect(long.endsWith('…')).toBe(true);
	});

	it('draws a short radial tick centred on the bearing ring', () => {
		const point = directionalDialBearingPoint([0, 0, 0], 2, 90);
		expect(point[0]).toBeCloseTo(2, 9);
		expect(point[1]).toBe(0);
		expect(point[2]).toBeCloseTo(0, 9);
		const [start, end] = directionalDialTick({
			center: [0, 0, 0],
			radius: 2,
			from: 90,
			halfLength: 0.05
		});
		expect(start[0]).toBeCloseTo(1.95, 9);
		expect(end[0]).toBeCloseTo(2.05, 9);
		expect(start[2]).toBeCloseTo(0, 9);
	});

	it('keeps the tick at six CSS pixels whatever the ring scale', () => {
		// 100 CSS px per metre: a 6 px tick is 0.03 m on each side.
		expect(directionalDialTickHalfLength(100)).toBeCloseTo(0.03, 9);
		expect(directionalDialTickHalfLength(0)).toBe(0.01);
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
