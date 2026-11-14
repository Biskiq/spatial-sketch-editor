/**
 * C3 checkpoint 5 — the Camera `face` intent (D14).
 *
 * A face is a posture change, not a second camera authority: the owning domain
 * supplies a surface's bounds and the direction to look along, camera-core
 * derives the pose, and the transition ends in the 3D reading. These tests pin
 * the three properties the checkpoint relies on:
 *
 * 1. the eye really sits on the `−look` side and every bounds corner frames;
 * 2. entering and returning animate through the one evaluator (in-place 3D
 *    transitions keep orthographic weight 0), settling exactly at the endpoint;
 * 3. invalid bounds, a vertical look or a hidden rect refuse rather than
 *    inventing a pose.
 */
import { describe, expect, it } from 'vitest';
import {
	advanceViewport,
	createViewportCameraState,
	evaluateViewport,
	facePoseFromBounds,
	projectWorld,
	requestViewingIntent,
	VIEWPORT_READING_TRANSITION_SECONDS,
	type InspectionPose,
	type Vec3,
	type ViewportCameraState,
	type ViewportRect
} from '@portfolio/camera-core';

const RECT: ViewportRect = { left: 0, top: 0, width: 900, height: 600, devicePixelRatio: 1 };
const IDENTITY = { outputId: 'output-face', sessionEpoch: 'session-face', sourceRevision: 'content-face' };

/** A 6 m by 3 m wall face lying in the X/Y plane at z = 0. */
const BOUNDS = { min: [-3, 0, 0] as Vec3, max: [3, 3, 0] as Vec3 };
/** Looking from the wall's +Z side toward it. */
const LOOK: Vec3 = [0, 0, -1];

function state(pose?: Partial<InspectionPose>): ViewportCameraState {
	return createViewportCameraState({
		...IDENTITY,
		pose: {
			target: [0, 1.5, 0],
			azimuthRadians: 0,
			elevationRadians: 0.35,
			targetPlaneHeightMeters: 12,
			...(pose ?? {})
		},
		sceneRadiusMeters: 8
	});
}

function evaluateAt(camera: ViewportCameraState, clockSeconds: number) {
	const result = evaluateViewport(camera, RECT, clockSeconds, 1);
	if (result.kind !== 'evaluated') throw new Error(result.reason);
	return result.evaluation;
}

describe('camera-core face intent', () => {
	it('frames the face from the −look side and settles exactly on its bounds centre', () => {
		const accepted = requestViewingIntent(state(), { kind: 'face', bounds: BOUNDS, look: LOOK, rect: RECT }, 0);
		expect(accepted.kind).toBe('accepted');
		if (accepted.kind !== 'accepted') return;
		expect(accepted.state.transition?.to).toBe('3d');
		expect(accepted.state.transition?.from).toBe('3d');

		const settled = advanceViewport(accepted.state, VIEWPORT_READING_TRANSITION_SECONDS + 1);
		const evaluation = evaluateAt(settled, VIEWPORT_READING_TRANSITION_SECONDS + 1);
		expect(evaluation.target[0]).toBeCloseTo(0, 9);
		expect(evaluation.target[1]).toBeCloseTo(1.5, 9);
		expect(evaluation.target[2]).toBeCloseTo(0, 9);
		// The eye is on the surface's +Z side, looking toward −Z.
		expect(evaluation.eye[2]).toBeGreaterThan(0);
		expect(evaluation.eye[0]).toBeCloseTo(0, 9);
		expect(evaluation.eye[1]).toBeCloseTo(1.5, 9);
		// Azimuth names the eye direction (target → eye), which is +Z here; the
		// look direction is its opposite, −Z.
		expect(evaluation.pose.azimuthRadians).toBeCloseTo(0, 9);
		expect(evaluation.projectionKind).toBe('perspective-3d');

		// Every bounds corner is inside the frame, with the declared padding.
		for (const x of [-3, 3]) {
			for (const y of [0, 3]) {
				const projected = projectWorld([x, y, 0] as Vec3, evaluation, evaluation.token);
				expect(projected.kind).toBe('projected');
				if (projected.kind !== 'projected') continue;
				expect(projected.visibility).toBe('visible');
				expect(projected.css[0]).toBeGreaterThanOrEqual(RECT.left);
				expect(projected.css[0]).toBeLessThanOrEqual(RECT.left + RECT.width);
				expect(projected.css[1]).toBeGreaterThanOrEqual(RECT.top);
				expect(projected.css[1]).toBeLessThanOrEqual(RECT.top + RECT.height);
			}
		}
	});

	it('does not move on the first frame and eases to the endpoint over the declared duration', () => {
		const initial = state();
		const accepted = requestViewingIntent(initial, { kind: 'face', bounds: BOUNDS, look: LOOK, rect: RECT }, 10);
		if (accepted.kind !== 'accepted') throw new Error(accepted.message);
		const atStart = evaluateAt(accepted.state, 10);
		expect(atStart.eye[2]).toBeCloseTo(evaluateAt(initial, 10).eye[2], 9);
		expect(atStart.orthographicWeight).toBe(0);

		const halfway = evaluateAt(accepted.state, 10 + VIEWPORT_READING_TRANSITION_SECONDS / 2);
		expect(halfway.orthographicWeight).toBe(0);
		expect(halfway.renderedReading).toBe('transition');
		expect(halfway.eye[2]).not.toBeCloseTo(atStart.eye[2], 3);

		const end = evaluateAt(accepted.state, 10 + VIEWPORT_READING_TRANSITION_SECONDS);
		expect(end.renderedReading).toBe('3d');
		expect(end.progress).toBe(1);
	});

	it('starts from Plan and ends in the 3D reading', () => {
		const plan = { ...state(), reading: 'plan' as const, pose: { ...state().pose, elevationRadians: Math.PI / 2 } };
		const accepted = requestViewingIntent(plan, { kind: 'face', bounds: BOUNDS, look: LOOK, rect: RECT }, 0);
		if (accepted.kind !== 'accepted') throw new Error(accepted.message);
		expect(accepted.state.transition?.from).toBe('plan');
		const halfway = evaluateAt(accepted.state, VIEWPORT_READING_TRANSITION_SECONDS / 2);
		expect(halfway.orthographicWeight).toBeGreaterThan(0);
		expect(halfway.orthographicWeight).toBeLessThan(1);
		const settled = advanceViewport(accepted.state, VIEWPORT_READING_TRANSITION_SECONDS + 1);
		expect(settled.reading).toBe('3d');
		const end = evaluateAt(settled, VIEWPORT_READING_TRANSITION_SECONDS + 1);
		expect(end.projectionKind).toBe('perspective-3d');
	});

	it('refuses invalid bounds, a degenerate look and a hidden rect', () => {
		const base = state();
		const reversed = requestViewingIntent(
			base,
			{ kind: 'face', bounds: { min: [3, 0, 0], max: [-3, 3, 0] }, look: LOOK, rect: RECT },
			0
		);
		expect(reversed.kind).toBe('rejected');
		const vertical = requestViewingIntent(
			base,
			{ kind: 'face', bounds: BOUNDS, look: [0, -1, 0], rect: RECT },
			0
		);
		expect(vertical.kind).toBe('rejected');
		const zero = requestViewingIntent(base, { kind: 'face', bounds: BOUNDS, look: [0, 0, 0], rect: RECT }, 0);
		expect(zero.kind).toBe('rejected');
		const hidden = requestViewingIntent(
			base,
			{ kind: 'face', bounds: BOUNDS, look: LOOK, rect: { ...RECT, width: 0 } },
			0
		);
		expect(hidden.kind).toBe('rejected');
		if (hidden.kind === 'rejected') expect(hidden.code).toBe('invalid-viewport');
		// A direct call has the same refusals: no UI can obtain a pose this way.
		expect(facePoseFromBounds({ bounds: BOUNDS, look: [0, 0, 0], rect: RECT })).toBeNull();
		expect(facePoseFromBounds({ bounds: BOUNDS, look: [0, -1, 0], rect: RECT })).toBeNull();
	});

	it('returns to the exact entry pose through set-view with transition', () => {
		const initial = state();
		const entryEvaluation = evaluateAt(initial, 0);
		const accepted = requestViewingIntent(initial, { kind: 'face', bounds: BOUNDS, look: LOOK, rect: RECT }, 0);
		if (accepted.kind !== 'accepted') throw new Error(accepted.message);
		const faced = advanceViewport(accepted.state, VIEWPORT_READING_TRANSITION_SECONDS + 1);

		const returned = requestViewingIntent(
			faced,
			{
				kind: 'set-view',
				eye: entryEvaluation.eye,
				target: entryEvaluation.target,
				fovYDegrees: (entryEvaluation.pose.fovYDegrees ?? 54) as number,
				transition: true
			},
			VIEWPORT_READING_TRANSITION_SECONDS + 1
		);
		if (returned.kind !== 'accepted') throw new Error(returned.message);
		expect(returned.state.transition?.to).toBe('3d');
		expect(returned.state.transition?.from).toBe('3d');
		const settled = advanceViewport(returned.state, VIEWPORT_READING_TRANSITION_SECONDS * 2 + 2);
		const evaluation = evaluateAt(settled, VIEWPORT_READING_TRANSITION_SECONDS * 2 + 2);
		expect(evaluation.eye[0]).toBeCloseTo(entryEvaluation.eye[0], 6);
		expect(evaluation.eye[1]).toBeCloseTo(entryEvaluation.eye[1], 6);
		expect(evaluation.eye[2]).toBeCloseTo(entryEvaluation.eye[2], 6);
		expect(evaluation.target[0]).toBeCloseTo(entryEvaluation.target[0], 6);
		expect(evaluation.target[1]).toBeCloseTo(entryEvaluation.target[1], 6);
		expect(evaluation.target[2]).toBeCloseTo(entryEvaluation.target[2], 6);
	});
});
