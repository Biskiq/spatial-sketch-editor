/**
 * R217.S28 — exact authored View evaluation in the one Camera path.
 *
 * The bounded extension is not a second evaluator: it adds an authored FOV to
 * the existing inspection pose, so a View's eye, target and vertical FOV all come
 * back out of `evaluateViewport`. These assertions pin that agreement, plus the
 * fixed-eye operations the Stage gestures use.
 */
import { describe, expect, it } from 'vitest';
import {
	aimPoseAlongRay,
	aimPoseAtTarget,
	createViewportCameraState,
	evaluateViewport,
	eyeOfInspectionPose,
	fovYDegreesOf,
	inspectionPoseFromView,
	liftPose,
	requestViewingIntent,
	setPoseLens,
	viewPlacementPose,
	type InspectionPose,
	type PointerRay
} from '@portfolio/camera-core';

const RECT = { left: 0, top: 0, width: 1280, height: 800, devicePixelRatio: 1 } as const;

function stateFor(pose: InspectionPose, reading: '3d' | 'plan' = '3d') {
	return createViewportCameraState({
		outputId: 's28-test',
		sessionEpoch: 's28-epoch',
		sourceRevision: 's28-revision',
		pose,
		sceneRadiusMeters: 50,
		reading
	});
}

function evaluate(pose: InspectionPose, reading: '3d' | 'plan' = '3d') {
	const result = evaluateViewport(stateFor(pose, reading), RECT, 0, 1);
	if (result.kind !== 'evaluated') throw new Error(`expected an evaluation, got ${result.reason}`);
	return result.evaluation;
}

function fovOfProjection(projectionMatrix: readonly number[]): number {
	return (2 * Math.atan(1 / projectionMatrix[5]!) * 180) / Math.PI;
}

function viewPose(eye: [number, number, number], target: [number, number, number], fovYDegrees = 30) {
	const pose = inspectionPoseFromView({ eye, target, fovYDegrees });
	if (pose === null) throw new Error('expected a representable authored View');
	return pose;
}

describe('R217.S28 — exact authored View evaluation', () => {
	it('evaluates the exact authored eye, target and a non-reference FOV', () => {
		const eye: [number, number, number] = [4, 3.25, 6];
		const target: [number, number, number] = [0.5, 1, -1];
		const evaluation = evaluate(viewPose(eye, target, 30));
		expect(evaluation.projectionKind).toBe('perspective-3d');
		expect(evaluation.eye[0]).toBeCloseTo(eye[0], 9);
		expect(evaluation.eye[1]).toBeCloseTo(eye[1], 9);
		expect(evaluation.eye[2]).toBeCloseTo(eye[2], 9);
		expect(evaluation.target[0]).toBeCloseTo(target[0], 9);
		expect(evaluation.target[1]).toBeCloseTo(target[1], 9);
		expect(evaluation.target[2]).toBeCloseTo(target[2], 9);
		// The projection matrix really carries 30°, not the Stage's 54° reference.
		expect(fovOfProjection(evaluation.projectionMatrix)).toBeCloseTo(30, 6);
		expect(fovYDegreesOf(evaluation.pose)).toBeCloseTo(30, 9);
	});

	it('keeps the ordinary inspection pose at the 54° reference when no FOV is authored', () => {
		const pose: InspectionPose = {
			target: [0, 1, 0],
			azimuthRadians: 0.4,
			elevationRadians: 0.5,
			targetPlaneHeightMeters: 8
		};
		const evaluation = evaluate(pose);
		expect(fovOfProjection(evaluation.projectionMatrix)).toBeCloseTo(54, 6);
		expect(eyeOfInspectionPose(pose)).toEqual(evaluation.eye);
	});

	it('refuses degenerate and unsupported authored views instead of clamping a different camera', () => {
		expect(inspectionPoseFromView({ eye: [1, 1, 1], target: [1, 1, 1], fovYDegrees: 54 })).toBeNull();
		expect(inspectionPoseFromView({ eye: [0, 1, 2], target: [0, 1, 0], fovYDegrees: 0 })).toBeNull();
		expect(inspectionPoseFromView({ eye: [0, 1, 2], target: [0, 1, 0], fovYDegrees: 180 })).toBeNull();
	});

	it('re-aims at a fixed eye through the one intent path', () => {
		const pose = viewPose([2, 2, 5], [0, 1, 0], 42);
		const before = evaluate(pose);
		const result = requestViewingIntent(stateFor(pose), { kind: 'aim', target: [1.5, 1.25, -2] }, 0);
		if (result.kind !== 'accepted') throw new Error(result.message);
		const after = evaluateViewport(result.state, RECT, 0, 1);
		if (after.kind !== 'evaluated') throw new Error(after.reason);
		expect(after.evaluation.eye[0]).toBeCloseTo(before.eye[0], 9);
		expect(after.evaluation.eye[1]).toBeCloseTo(before.eye[1], 9);
		expect(after.evaluation.eye[2]).toBeCloseTo(before.eye[2], 9);
		expect(after.evaluation.target[0]).toBeCloseTo(1.5, 9);
		expect(after.evaluation.target[1]).toBeCloseTo(1.25, 9);
		expect(after.evaluation.target[2]).toBeCloseTo(-2, 9);
		expect(fovOfProjection(after.evaluation.projectionMatrix)).toBeCloseTo(42, 6);
	});

	it('re-aims along a Camera ray at a fixed eye, including level and upward rays', () => {
		const pose = viewPose([2, 1.65, 5], [2, 1.65, 2], 54);
		const level: PointerRay = { origin: [2, 1.65, 5], direction: [0, 0, -1] };
		const levelAim = aimPoseAlongRay(pose, level);
		if (levelAim === null) throw new Error('level aim refused');
		expect(levelAim.target[0]).toBeCloseTo(2, 9);
		expect(levelAim.target[1]).toBeCloseTo(1.65, 9);
		expect(levelAim.target[2]).toBeCloseTo(2, 9);
		const upAim = aimPoseAlongRay(pose, { origin: [2, 1.65, 5], direction: [0, 1, 0] });
		if (upAim === null) throw new Error('upward aim refused');
		expect(upAim.target[0]).toBeCloseTo(2, 9);
		expect(upAim.target[1]).toBeCloseTo(4.65, 9);
		expect(upAim.target[2]).toBeCloseTo(5, 9);
		const eye = eyeOfInspectionPose(upAim);
		expect(eye[0]).toBeCloseTo(2, 9);
		expect(eye[1]).toBeCloseTo(1.65, 9);
		expect(eye[2]).toBeCloseTo(5, 6);
	});

	it('constructs placement inside Camera and refuses a pre-aimed drag under 0.5 m', () => {
		const input = {
			startFloorPoint: [1, 0, 2] as [number, number, number],
			currentFloorPoint: [1, 0, 2.2] as [number, number, number],
			floorDatumMeters: 0,
			fovYDegrees: 54
		};
		expect(viewPlacementPose(input)).toBeNull();
		const placed = viewPlacementPose({ ...input, currentFloorPoint: [1, 0, 2.5] });
		if (placed === null) throw new Error('placement refused');
		expect(placed.eye).toEqual([1, 1.65, 2]);
		expect(placed.target[0]).toBeCloseTo(1, 9);
		expect(placed.target[1]).toBeCloseTo(1.25, 9);
		expect(placed.target[2]).toBeCloseTo(3.25, 9);
		const preAimed = viewPlacementPose({ ...input, currentFloorPoint: [1, 0, 2.6], aimPoint: [0, 1.2, 0] });
		if (preAimed === null) throw new Error('pre-aimed placement refused');
		expect(preAimed.target).toEqual([0, 1.2, 0]);
	});

	it('steps the lens at a fixed eye and target', () => {
		const pose = viewPose([2, 2, 5], [0, 1.25, 0], 63.4);
		const eyeBefore = eyeOfInspectionPose(pose);
		const result = requestViewingIntent(stateFor(pose), { kind: 'lens', fovYDegrees: 16.1 }, 0);
		if (result.kind !== 'accepted') throw new Error(result.message);
		const eyeAfter = eyeOfInspectionPose(result.state.pose);
		expect(eyeAfter[0]).toBeCloseTo(eyeBefore[0], 9);
		expect(eyeAfter[1]).toBeCloseTo(eyeBefore[1], 9);
		expect(eyeAfter[2]).toBeCloseTo(eyeBefore[2], 9);
		expect(fovYDegreesOf(result.state.pose)).toBeCloseTo(16.1, 9);
		expect(result.state.pose.target).toEqual(pose.target);
	});

	it('lifts eye and target together by the floor-relative delta', () => {
		const pose = viewPose([2, 1.65, 5], [2, 1.25, 2], 54);
		const result = requestViewingIntent(stateFor(pose), { kind: 'lift', deltaMeters: 0.85 }, 0);
		if (result.kind !== 'accepted') throw new Error(result.message);
		const eye = eyeOfInspectionPose(result.state.pose);
		expect(eye[1]).toBeCloseTo(2.5, 9);
		expect(result.state.pose.target[1]).toBeCloseTo(2.1, 9);
	});

	it('installs an exact View from Plan as the through posture', () => {
		const planPose: InspectionPose = {
			target: [0, 1, 0],
			azimuthRadians: 0,
			elevationRadians: Math.PI / 2,
			targetPlaneHeightMeters: 12
		};
		const result = requestViewingIntent(
			stateFor(planPose, 'plan'),
			{ kind: 'set-view', eye: [3, 2.2, 4], target: [0, 1.2, 0], fovYDegrees: 36 },
			0
		);
		if (result.kind !== 'accepted') throw new Error(result.message);
		expect(result.state.reading).toBe('3d');
		expect(result.state.transition).toBeNull();
		const evaluated = evaluateViewport(result.state, RECT, 0, 1);
		if (evaluated.kind !== 'evaluated') throw new Error(evaluated.reason);
		expect(evaluated.evaluation.eye[0]).toBeCloseTo(3, 9);
		expect(fovOfProjection(evaluated.evaluation.projectionMatrix)).toBeCloseTo(36, 6);
	});

	it('refuses a lens or aim in the orthographic Plan reading', () => {
		const planPose: InspectionPose = {
			target: [0, 1, 0],
			azimuthRadians: 0,
			elevationRadians: Math.PI / 2,
			targetPlaneHeightMeters: 12
		};
		const lens = requestViewingIntent(stateFor(planPose, 'plan'), { kind: 'lens', fovYDegrees: 30 }, 0);
		expect(lens.kind).toBe('rejected');
		if (lens.kind === 'rejected') expect(lens.code).toBe('unsupported-in-plan-reading');
		const aim = requestViewingIntent(stateFor(planPose, 'plan'), { kind: 'aim', target: [1, 0, 0] }, 0);
		expect(aim.kind).toBe('rejected');
	});

	it('keeps the pure pose operations agreeing with their intents', () => {
		const pose = viewPose([2, 2, 5], [0, 1, 0], 50);
		const aimed = aimPoseAtTarget(pose, [1, 1, -1]);
		if (aimed === null) throw new Error('aim refused');
		const aimedEye = eyeOfInspectionPose(aimed);
		const beforeEye = eyeOfInspectionPose(pose);
		for (const axis of [0, 1, 2] as const) expect(aimedEye[axis]).toBeCloseTo(beforeEye[axis], 9);
		const lensed = setPoseLens(pose, 24);
		if (lensed === null) throw new Error('lens refused');
		const lensedEye = eyeOfInspectionPose(lensed);
		for (const axis of [0, 1, 2] as const) expect(lensedEye[axis]).toBeCloseTo(beforeEye[axis], 9);
		const lifted = liftPose(pose, 0.5);
		if (lifted === null) throw new Error('lift refused');
		expect(eyeOfInspectionPose(lifted)[1]).toBeCloseTo(eyeOfInspectionPose(pose)[1] + 0.5, 9);
	});
});
