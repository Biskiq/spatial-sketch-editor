/**
 * R217.S28 — marker Move and aim are pure pose edits.
 *
 * Move keeps the eye's height and the target offset; aim holds the eye and the
 * authored lens still. The route commits either result as one View update.
 */
import { describe, expect, it } from 'vitest';
import { aimViewAtPoint, moveViewOnFloor, turnViewAboutEye, viewEditMoved, type AuthoredViewPose } from '$lib/authoring/experience/experience-view-edit';

describe('R217.S28 — marker Move and aim', () => {
	it('moves the eye on the Floor and carries the aim by the same horizontal delta', () => {
		const moved = moveViewOnFloor(
			{ eye: [1, 1.65, 2], target: [1, 1.25, 0], fov: 42 },
			[3.5, 0, -1]
		);
		expect(moved.eye).toEqual([3.5, 1.65, -1]);
		expect(moved.target).toEqual([3.5, 1.25, -3]);
		expect(moved.fov).toBe(42);
	});

	it('aims at the pointer while the eye and lens stay exactly still', () => {
		const aimed = aimViewAtPoint(
			{ eye: [1, 1.65, 2], target: [1, 1.25, 0], fov: 42 },
			[-2, 0.8, 5]
		);
		expect(aimed.eye).toEqual([1, 1.65, 2]);
		expect(aimed.target).toEqual([-2, 0.8, 5]);
		expect(aimed.fov).toBe(42);
	});

	it('turns around the eye and keeps the heights, focal distance and lens', () => {
		const start: AuthoredViewPose = { eye: [1, 1.65, 2], target: [1, 1.25, 0], fov: 42 };
		const turned = turnViewAboutEye(start, Math.PI / 2);
		expect(turned.eye).toEqual(start.eye);
		expect(turned.target[0]).toBeCloseTo(3);
		expect(turned.target[1]).toBe(start.target[1]);
		expect(turned.target[2]).toBeCloseTo(2);
		expect(turned.fov).toBe(start.fov);
	});

	it('detects movement against the endpoint the gesture edits', () => {
		const start = {
			eye: [1, 1.65, 2] as [number, number, number],
			target: [1, 1.25, 0] as [number, number, number],
			fov: 42
		};
		const aimed = aimViewAtPoint(start, [1.2, 1.25, 0]);
		expect(viewEditMoved('turn', start, aimed)).toBe(true);
		expect(viewEditMoved('move', start, aimed)).toBe(false);
		const moved = moveViewOnFloor(start, [1.4, 0, 2]);
		expect(viewEditMoved('move', start, moved)).toBe(true);
		expect(viewEditMoved('move', start, start)).toBe(false);
		expect(viewEditMoved('turn', start, aimViewAtPoint(start, start.target))).toBe(false);
	});
});
