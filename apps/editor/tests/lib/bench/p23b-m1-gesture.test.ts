/**
 * Pre-P23B.8 follow-up M1 — the drag gestures the protocol's classes perform.
 *
 * The M1 run reaches "25 accepted actions" only if each attempt is a gesture the
 * APP calls a drag: the release-time gate is `EDITOR_DRAG_THRESHOLD_PX` of screen
 * travel, and below it the release is committed as the click the press also was.
 * The driver's gesture rules therefore have to produce at least one grid
 * increment of POINTER travel — not one grid increment of WORLD offset from some
 * other origin, which is what the bend class's first shape did.
 *
 * This is the regression guard for the case that shape broke: the generated
 * connected case's knots are off-grid on both axes, so measuring the bend's step
 * from the SNAPPED knot left 3.5 px of travel, every release was a click, and the
 * class never reached an accepted bend.
 *
 * Measured in screen px exactly as the app measures it: world distance × the
 * protocol's shared px/m ladder. No fixture, no document and no timer is needed,
 * so the guard cannot be broken by fixture drift.
 */
import { describe, expect, it } from 'vitest';

import { EDITOR_DRAG_THRESHOLD_PX } from '$lib/editor/interaction-constants';
import {
	p23bBendReleasePoint,
	p23bRoomMoveReleasePoint
} from '../../../src/routes/dev/perf/p23b/drive';

/** The one shared px/m ladder every M1 fixture is put on (2 * 1.12^20). */
const LADDER_PX_PER_M = 2 * Math.pow(1.12, 20);
const GRID_STEP_M = 0.25;

const screenPx = (a: readonly [number, number], b: readonly [number, number]): number =>
	Math.hypot(b[0] - a[0], b[1] - a[1]) * LADDER_PX_PER_M;

/**
 * The bends the fixtures actually present: a knot on a grid line (the matrix
 * fixtures and the owner layout bow ±0.35 m on one axis) and a knot off-grid on
 * BOTH axes (the connected case's diagonal bow), plus the degenerate on-grid knot
 * no protocol fixture has today. Every one of them must still produce a drag.
 */
const BENDS: [number, number][] = [
	[6, -0.35],
	[-4.46, -5.99],
	[6.35, 0.35],
	[12, 5],
	[0, 0]
];

/** Whole-Room grab points: interior targets, generally off-grid by construction. */
const ROOM_CENTERS: [number, number][] = [
	[4, 6.67],
	[-4.87, -1.19],
	[8 / 3, 20 / 3],
	[3.14159, 2.71828]
];

describe('M1 drag gestures cross the app drag threshold', () => {
	it('steps the bend exactly one grid increment from the PRESS point', () => {
		for (const press of BENDS) {
			const release = p23bBendReleasePoint(press);
			expect(release).toEqual([press[0], press[1] + GRID_STEP_M]);
		}
	});

	it('steps the whole-Room move exactly one grid increment from the snapped grab', () => {
		for (const center of ROOM_CENTERS) {
			const release = p23bRoomMoveReleasePoint(center);
			const snapped: [number, number] = [
				Math.round(center[0] / GRID_STEP_M) * GRID_STEP_M,
				Math.round(center[1] / GRID_STEP_M) * GRID_STEP_M
			];
			expect(release).toEqual([snapped[0] + GRID_STEP_M, snapped[1]]);
			expect(release[0] - snapped[0]).toBeCloseTo(GRID_STEP_M, 9);
		}
	});

	it('clears EDITOR_DRAG_THRESHOLD_PX on the protocol ladder for every bend the fixtures present', () => {
		expect(EDITOR_DRAG_THRESHOLD_PX).toBeGreaterThan(0);
		for (const press of BENDS) {
			expect(screenPx(press, p23bBendReleasePoint(press))).toBeGreaterThan(EDITOR_DRAG_THRESHOLD_PX);
		}
	});

	it('clears EDITOR_DRAG_THRESHOLD_PX on the protocol ladder for every whole-Room grab', () => {
		for (const center of ROOM_CENTERS) {
			expect(screenPx(center, p23bRoomMoveReleasePoint(center))).toBeGreaterThan(
				EDITOR_DRAG_THRESHOLD_PX
			);
		}
	});

	it('would have caught the snapped-knot shape: one grid step from the snapped knot is not the same travel', () => {
		// The retired shape — release = one step past the SNAPPED press — for the
		// connected case's knot. Its travel is under the threshold while the
		// shipped rule's is over it: the guard has teeth on the real numbers.
		const knot: [number, number] = [6.35, 0.35];
		const retired: [number, number] = [
			Math.round(knot[0] / GRID_STEP_M) * GRID_STEP_M,
			Math.round(knot[1] / GRID_STEP_M) * GRID_STEP_M + GRID_STEP_M
		];
		expect(screenPx(knot, retired)).toBeLessThan(EDITOR_DRAG_THRESHOLD_PX);
		expect(screenPx(knot, p23bBendReleasePoint(knot))).toBeGreaterThan(EDITOR_DRAG_THRESHOLD_PX);
	});
});
