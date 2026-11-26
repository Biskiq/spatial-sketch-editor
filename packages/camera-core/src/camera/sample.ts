import { MathUtils } from 'three';
import { applyCameraFramingGuard } from './framing-guard';
import { cameraApplyEasing, sampleFramingEnvelopeWeight } from './motion';
import { findActiveEdgeIndex, getEdgeLocalProgress, sampleAuthoredView } from './progress';
import type { CameraMotion, CameraMotionSample } from './types';

export function sampleCameraMotion(
	motion: CameraMotion,
	progress: number,
	output: CameraMotionSample,
): void {
	if (!Number.isFinite(progress)) {
		throw new Error('Camera motion progress must be finite');
	}

	const clampedProgress = MathUtils.clamp(progress, 0, 1);
	const easedProgress = cameraApplyEasing(motion.easing, clampedProgress);

	motion.positionPath.getPointAt(easedProgress, output.position);

	const edgeIndex = findActiveEdgeIndex(motion, easedProgress);
	const edgeView = edgeIndex < 0 ? null : motion.edgeViews[edgeIndex];
	const localProgress = getEdgeLocalProgress(motion, edgeIndex, easedProgress);

	if (motion.usesLegacyTargetPath || !edgeView) {
		motion.targetPath.getPointAt(easedProgress, output.target);
	} else if (edgeView.hasAuthoredKeyframes) {
		if (!edgeView.framingEnvelope) {
			sampleAuthoredView(edgeView, localProgress, motion.easing, output);
			return;
		}
		if (edgeView.automaticTargetPath) {
			edgeView.automaticTargetPath.getPointAt(localProgress, output.target);
		} else {
			motion.targetPath.getPointAt(easedProgress, output.target);
		}
		const automaticTargetX = output.target.x;
		const automaticTargetY = output.target.y;
		const automaticTargetZ = output.target.z;
		const start = edgeView.points[0];
		const end = edgeView.points.at(-1)!;
		const automaticFov = MathUtils.lerp(
			start.fov,
			end.fov,
			cameraApplyEasing(motion.easing, localProgress),
		);
		sampleAuthoredView(edgeView, localProgress, motion.easing, output);
		const weight = sampleFramingEnvelopeWeight(edgeView.framingEnvelope, localProgress);
		output.target.set(
			MathUtils.lerp(automaticTargetX, output.target.x, weight),
			MathUtils.lerp(automaticTargetY, output.target.y, weight),
			MathUtils.lerp(automaticTargetZ, output.target.z, weight),
		);
		output.fov = MathUtils.lerp(automaticFov, output.fov, weight);
		if (edgeView.guard) {
			applyCameraFramingGuard(edgeView.guard, localProgress, output);
		}
		return;
	} else if (edgeView.automaticTargetPath) {
		edgeView.automaticTargetPath.getPointAt(localProgress, output.target);
	} else {
		motion.targetPath.getPointAt(easedProgress, output.target);
	}

	if (edgeView) {
		const start = edgeView.points[0];
		const end = edgeView.points.at(-1)!;
		output.fov = MathUtils.lerp(
			start.fov,
			end.fov,
			cameraApplyEasing(motion.easing, localProgress),
		);
	} else {
		output.fov = MathUtils.lerp(
			motion.startFov,
			motion.endFov,
			cameraApplyEasing(motion.easing, easedProgress),
		);
	}
}
