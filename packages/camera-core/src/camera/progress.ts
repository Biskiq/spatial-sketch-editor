import { MathUtils, Vector3 } from 'three';
import type { CameraEasing } from '../scene-types';
import {
	CAMERA_FRAMING_GUARD_POLICY,
	cameraApplyEasing,
	cameraInverseEasing,
	sampleFramingEnvelopeWeight,
} from './motion';
import type {
	CameraFramingGuardCompileContext,
	CameraMotion,
	CameraMotionEdgeView,
	CameraMotionSample,
	RawCameraFramingGuardSample,
} from './types';

/** Map exact edge-local distance progress back to raw transition/playhead progress. */
export function cameraMotionProgressAtEdgeProgress(
	motion: CameraMotion,
	edgeIndex: number,
	edgeProgress: number,
) {
	if (
		!Number.isInteger(edgeIndex) ||
		edgeIndex < 0 ||
		edgeIndex >= motion.positionEdgeSpans.length
	) {
		throw new Error('Camera motion edge index is out of range');
	}
	if (!Number.isFinite(edgeProgress)) {
		throw new Error('Camera motion edge progress must be finite');
	}
	const span = motion.positionEdgeSpans[edgeIndex];
	const localProgress = MathUtils.clamp(edgeProgress, 0, 1);
	if (motion.totalPositionDistance <= Number.EPSILON) {
		return MathUtils.clamp((edgeIndex + localProgress) / motion.positionEdgeSpans.length, 0, 1);
	}
	const distance = span.startDistance + span.length * localProgress;
	return cameraInverseEasing(motion.easing, distance / motion.totalPositionDistance);
}

/** Map raw transition/playhead progress to exact edge-local distance progress. */
export function cameraMotionEdgeProgressAtProgress(
	motion: CameraMotion,
	edgeIndex: number,
	progress: number,
) {
	if (
		!Number.isInteger(edgeIndex) ||
		edgeIndex < 0 ||
		edgeIndex >= motion.positionEdgeSpans.length
	) {
		throw new Error('Camera motion edge index is out of range');
	}
	if (!Number.isFinite(progress)) {
		throw new Error('Camera motion progress must be finite');
	}
	return getEdgeLocalProgress(
		motion,
		edgeIndex,
		cameraApplyEasing(motion.easing, MathUtils.clamp(progress, 0, 1)),
	);
}

export function findActiveEdgeIndex(motion: CameraMotion, easedProgress: number) {
	const spans = motion.positionEdgeSpans;
	if (spans.length === 0) return -1;
	if (easedProgress >= 1) return spans.length - 1;

	if (motion.totalPositionDistance <= Number.EPSILON) {
		return Math.min(spans.length - 1, Math.floor(easedProgress * spans.length));
	}

	const distance = easedProgress * motion.totalPositionDistance;
	for (let index = 0; index < spans.length; index += 1) {
		const span = spans[index];
		if (span.length <= Number.EPSILON) continue;
		if (distance < span.endDistance || index === spans.length - 1) return index;
	}
	return spans.length - 1;
}

export function getEdgeLocalProgress(
	motion: CameraMotion,
	edgeIndex: number,
	easedProgress: number,
) {
	const span = motion.positionEdgeSpans[edgeIndex];
	if (!span) return easedProgress;
	if (motion.totalPositionDistance <= Number.EPSILON) {
		const scaledProgress = easedProgress * motion.positionEdgeSpans.length;
		return MathUtils.clamp(scaledProgress - edgeIndex, 0, 1);
	}
	if (span.length <= Number.EPSILON) return easedProgress >= 1 ? 1 : 0;
	const distance = easedProgress * motion.totalPositionDistance;
	return MathUtils.clamp((distance - span.startDistance) / span.length, 0, 1);
}

export function sampleAuthoredView(
	edgeView: CameraMotionEdgeView,
	localProgress: number,
	easing: CameraEasing,
	output: CameraMotionSample,
) {
	const points = edgeView.points;
	let endIndex = 1;
	while (endIndex < points.length - 1 && localProgress > points[endIndex].progress) {
		endIndex += 1;
	}
	const start = points[endIndex - 1];
	const end = points[endIndex];
	const intervalLength = end.progress - start.progress;
	const intervalProgress =
		intervalLength <= Number.EPSILON
			? 1
			: MathUtils.clamp((localProgress - start.progress) / intervalLength, 0, 1);
	const easedIntervalProgress = cameraApplyEasing(easing, intervalProgress);
	output.target.copy(start.cameraTarget).lerp(end.cameraTarget, easedIntervalProgress);
	output.fov = MathUtils.lerp(start.fov, end.fov, easedIntervalProgress);
}

function edgeGlobalDistanceProgress(context: CameraFramingGuardCompileContext, progress: number) {
	if (context.totalPositionDistance <= Number.EPSILON) return progress;
	return (
		(context.edgeSpan.startDistance + context.edgeSpan.length * progress) /
		context.totalPositionDistance
	);
}

function sampleRawCameraFraming(
	context: CameraFramingGuardCompileContext,
	progress: number,
): RawCameraFramingGuardSample {
	const globalProgress = edgeGlobalDistanceProgress(context, progress);
	const timeSeconds = cameraInverseEasing(context.easing, globalProgress) * context.durationSeconds;
	const position = context.positionPath.getPointAt(globalProgress, new Vector3());
	const target = new Vector3();
	const edgeView = context.edgeView;
	if (edgeView.automaticTargetPath) {
		edgeView.automaticTargetPath.getPointAt(progress, target);
	} else {
		context.targetPath.getPointAt(globalProgress, target);
	}

	const automaticTargetX = target.x;
	const automaticTargetY = target.y;
	const automaticTargetZ = target.z;
	const start = edgeView.points[0];
	const end = edgeView.points.at(-1)!;
	const automaticFov = MathUtils.lerp(
		start.fov,
		end.fov,
		cameraApplyEasing(context.easing, progress),
	);
	const authored = { position, target, fov: automaticFov };
	sampleAuthoredView(edgeView, progress, context.easing, authored);
	const weight = sampleFramingEnvelopeWeight(edgeView.framingEnvelope!, progress);
	target.set(
		MathUtils.lerp(automaticTargetX, target.x, weight),
		MathUtils.lerp(automaticTargetY, target.y, weight),
		MathUtils.lerp(automaticTargetZ, target.z, weight),
	);
	const direction = target.clone().sub(position);
	const distance = direction.length();
	if (distance > CAMERA_FRAMING_GUARD_POLICY.directionEpsilonMeters) {
		direction.multiplyScalar(1 / distance);
	}
	return { progress, timeSeconds, position, target, distance, direction };
}

export function collectAdaptiveFramingSamples(context: CameraFramingGuardCompileContext) {
	const progressValues = new Set<number>();
	const envelope = context.edgeView.framingEnvelope!;
	for (let segment = 0; segment <= CAMERA_FRAMING_GUARD_POLICY.baseSampleSegments; segment += 1) {
		progressValues.add(segment / CAMERA_FRAMING_GUARD_POLICY.baseSampleSegments);
	}
	for (const progress of [
		envelope.enterStart,
		envelope.enterEnd,
		envelope.exitStart,
		envelope.exitEnd,
		...context.edgeView.points.map((point) => point.progress),
	]) {
		progressValues.add(MathUtils.clamp(progress, 0, 1));
	}

	const initial = [...progressValues]
		.sort((left, right) => left - right)
		.map((progress) => sampleRawCameraFraming(context, progress));
	const refined: RawCameraFramingGuardSample[] = [initial[0]];

	function refine(
		start: RawCameraFramingGuardSample,
		end: RawCameraFramingGuardSample,
		depth: number,
	) {
		const midpointProgress = (start.progress + end.progress) / 2;
		const midpoint = sampleRawCameraFraming(context, midpointProgress);
		const endpointsHaveDirection =
			start.distance > CAMERA_FRAMING_GUARD_POLICY.directionEpsilonMeters &&
			end.distance > CAMERA_FRAMING_GUARD_POLICY.directionEpsilonMeters;
		const angularDelta = endpointsHaveDirection ? start.direction.angleTo(end.direction) : Math.PI;
		const distanceCurvature = Math.abs(midpoint.distance - (start.distance + end.distance) / 2);
		const shouldRefine =
			depth < CAMERA_FRAMING_GUARD_POLICY.maxAdaptiveDepth &&
			(angularDelta > CAMERA_FRAMING_GUARD_POLICY.maxSampleAngularDeltaRadians ||
				distanceCurvature > CAMERA_FRAMING_GUARD_POLICY.maxTargetDistanceCurvatureMeters ||
				midpoint.distance < CAMERA_FRAMING_GUARD_POLICY.targetStandoffShoulderMeters);
		if (shouldRefine) {
			refine(start, midpoint, depth + 1);
			refine(midpoint, end, depth + 1);
		} else {
			refined.push(end);
		}
	}

	for (let index = 1; index < initial.length; index += 1) {
		refine(initial[index - 1], initial[index], 0);
	}
	return refined;
}
