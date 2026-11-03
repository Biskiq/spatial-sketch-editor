/**
 * R217.S28 — the two marker edits on the Stage.
 *
 * A Plan marker has an eye dot and an aim handle. Moving the eye keeps the
 * authored eye height and the aim offset, so the View travels without turning;
 * aiming keeps the eye exactly still and moves only the target. Both functions
 * are pure: the route projects the pointer through the one Camera evaluation and
 * commits the result through the Experience controller, so no Stage pose math or
 * second Camera appears here.
 */
import type { Vec3 } from '@portfolio/camera-core';

export type AuthoredViewPose = {
	readonly eye: Vec3;
	readonly target: Vec3;
	readonly fov: number;
};

/** Move the eye on the Floor and carry the target by the same horizontal delta. */
export function moveViewOnFloor(pose: AuthoredViewPose, floorPoint: Vec3): AuthoredViewPose {
	const dx = floorPoint[0] - pose.eye[0];
	const dz = floorPoint[2] - pose.eye[2];
	return {
		eye: [floorPoint[0], pose.eye[1], floorPoint[2]],
		target: [pose.target[0] + dx, pose.target[1], pose.target[2] + dz],
		fov: pose.fov
	};
}

/** Whether a live edit actually moved the endpoint its gesture owns. */
export function viewEditMoved(
	kind: 'move' | 'aim',
	start: AuthoredViewPose,
	current: AuthoredViewPose
): boolean {
	const from = kind === 'move' ? start.eye : start.target;
	const to = kind === 'move' ? current.eye : current.target;
	return Math.hypot(to[0] - from[0], to[1] - from[1], to[2] - from[2]) > 1e-3;
}

/** Aim at a point while the eye and the authored lens stay exactly still. */
export function aimViewAtPoint(pose: AuthoredViewPose, point: Vec3): AuthoredViewPose {
	return {
		eye: [pose.eye[0], pose.eye[1], pose.eye[2]],
		target: [point[0], point[1], point[2]],
		fov: pose.fov
	};
}
