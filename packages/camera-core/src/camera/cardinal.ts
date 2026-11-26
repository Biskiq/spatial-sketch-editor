import { MathUtils, Vector3 } from 'three';
import type { CameraEasing } from '../scene-types';
import { sphericalDirectionLerp } from './framing-guard';
import { CAMERA_POSE_EPSILON, cameraApplyEasing } from './motion';
import type { CardinalSnapMotion, CardinalSnapMotionSample } from './types';

/** Approved snap flight length (0ms is handled by the instant commit path). */
export const EDITOR_CARDINAL_SNAP_DURATION_MS = 320;

/**
 * P3B.4 — pure cardinal snap motion for the Scene 3D orientation widget.
 *
 * Trajectory (all eased by `cameraApplyEasing`):
 * - eye direction: great-circle slerp from the start direction to the target
 *   cardinal normal (`sphericalDirectionLerp`, so antipodal snaps stay smooth);
 * - distance: lerp from the start eye-target distance to `targetDistance`;
 * - up: great-circle slerp from the start roll reference to the cardinal
 *   table up.
 *
 * The orbit target blends from `startTarget` to `resolvedTarget`. This extends
 * the plan's reference signature deliberately: landing-eye convergence with
 * the instant commit (`resolvedTarget + normal × distance`) requires it when
 * basis resolution replaced an invalid orbit target via fallback; in the
 * common preserved-target case the two are equal and the channel is inert.
 *
 * At progress 1 the sampled pose equals the instant commit's pre-handoff pose;
 * callers finish through the fixture-pinned sequence (controls.update() with
 * the table up, then restore global +Y) — see
 * `tests/lib/editor/camera/polar-orbit-handoff.test.ts`.
 */
export function createEditorCardinalSnapMotion(
	startEye: Vector3,
	startTarget: Vector3,
	startUp: Vector3,
	resolvedTarget: Vector3,
	targetNormal: Vector3,
	targetDistance: number,
	targetUp: Vector3,
	durationMs = EDITOR_CARDINAL_SNAP_DURATION_MS,
	easing: CameraEasing = 'ease-out',
): CardinalSnapMotion {
	const offset = startEye.clone().sub(startTarget);
	const offsetLengthSq = Number.isFinite(offset.lengthSq()) ? offset.lengthSq() : 0;
	const startDirectionUnit =
		offsetLengthSq > CAMERA_POSE_EPSILON ** 2
			? offset.normalize()
			: targetNormal.clone().normalize();
	const startDistance = Number.isFinite(offsetLengthSq) ? Math.sqrt(offsetLengthSq) : 0;
	const startUpUnit =
		Number.isFinite(startUp.lengthSq()) && startUp.lengthSq() > CAMERA_POSE_EPSILON ** 2
			? startUp.clone().normalize()
			: new Vector3(0, 1, 0);
	const targetDirectionUnit = targetNormal.clone().normalize();
	const targetUpUnit = targetUp.clone().normalize();

	return {
		durationMs,
		easing,
		sample(progress: number): CardinalSnapMotionSample {
			const eased = cameraApplyEasing(easing, progress);
			const direction = sphericalDirectionLerp(startDirectionUnit, targetDirectionUnit, eased);
			const target = startTarget.clone().lerp(resolvedTarget, eased);
			const distance = MathUtils.lerp(startDistance, targetDistance, eased);
			return {
				position: target.clone().addScaledVector(direction, distance),
				target,
				up: sphericalDirectionLerp(startUpUnit, targetUpUnit, eased),
			};
		},
	};
}
