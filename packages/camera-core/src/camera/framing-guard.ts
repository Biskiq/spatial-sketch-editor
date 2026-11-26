import { MathUtils, Vector3 } from 'three';
import type { CameraFramingEnvelope } from '../scene-types';
import { CAMERA_FRAMING_GUARD_POLICY, createCameraMotionSample, smootherstep01 } from './motion';
import { collectAdaptiveFramingSamples, sampleAuthoredView } from './progress';
import type {
	CameraFramingBypass,
	CameraFramingGuard,
	CameraFramingGuardCompileContext,
	CameraMotionSample,
	RawCameraFramingGuardSample,
} from './types';

function normalizedDirectionLerp(start: Vector3, end: Vector3, progress: number) {
	const direction = start.clone().lerp(end, progress);
	if (direction.lengthSq() <= CAMERA_FRAMING_GUARD_POLICY.directionEpsilonMeters ** 2) {
		return start.clone();
	}
	return direction.normalize();
}

function orthogonalDirectionReference(direction: Vector3) {
	const absX = Math.abs(direction.x);
	const absY = Math.abs(direction.y);
	const absZ = Math.abs(direction.z);
	if (absX <= absY && absX <= absZ) return new Vector3(1, 0, 0);
	if (absY <= absZ) return new Vector3(0, 1, 0);
	return new Vector3(0, 0, 1);
}

/**
 * Deterministic great-circle path for antipodal directions where both slerp
 * and normalized linear interpolation degenerate (their midpoint is the zero
 * vector). Sweeps from `start` through a fixed orthogonal reference to
 * `-start`, which is within the linear-dot threshold of `end`.
 */
function antipodalDirectionInterpolate(start: Vector3, progress: number, output: Vector3) {
	const orth = start.clone().cross(orthogonalDirectionReference(start)).normalize();
	const angle = Math.PI * progress;
	output.copy(start).multiplyScalar(Math.cos(angle)).addScaledVector(orth, Math.sin(angle));
}

/**
 * Great-circle direction interpolation with deterministic degenerate handling:
 * near-parallel inputs collapse to normalized lerp, antipodal inputs sweep a
 * fixed orthogonal reference (all branches return unit vectors). Shared by the
 * framing guard and the P3B.4 cardinal snap sampler.
 */
export function sphericalDirectionLerp(start: Vector3, end: Vector3, progress: number) {
	const dot = MathUtils.clamp(start.dot(end), -1, 1);
	if (dot < -CAMERA_FRAMING_GUARD_POLICY.sphericalLerpLinearDotThreshold) {
		const output = new Vector3();
		antipodalDirectionInterpolate(start, progress, output);
		return output;
	}
	if (dot > CAMERA_FRAMING_GUARD_POLICY.sphericalLerpLinearDotThreshold) {
		return normalizedDirectionLerp(start, end, progress);
	}
	const angle = Math.acos(dot);
	const sinAngle = Math.sin(angle);
	return start
		.clone()
		.multiplyScalar(Math.sin((1 - progress) * angle) / sinAngle)
		.addScaledVector(end, Math.sin(progress * angle) / sinAngle)
		.normalize();
}

function continueSingularDirections(samples: RawCameraFramingGuardSample[]) {
	for (let index = 0; index < samples.length; index += 1) {
		const sample = samples[index];
		if (sample.distance > CAMERA_FRAMING_GUARD_POLICY.directionEpsilonMeters) {
			continue;
		}
		let previousIndex = index - 1;
		while (
			previousIndex >= 0 &&
			samples[previousIndex].distance <= CAMERA_FRAMING_GUARD_POLICY.directionEpsilonMeters
		) {
			previousIndex -= 1;
		}
		let nextIndex = index + 1;
		while (
			nextIndex < samples.length &&
			samples[nextIndex].distance <= CAMERA_FRAMING_GUARD_POLICY.directionEpsilonMeters
		) {
			nextIndex += 1;
		}
		if (previousIndex >= 0 && nextIndex < samples.length) {
			const interval = samples[nextIndex].progress - samples[previousIndex].progress;
			const progress =
				interval <= Number.EPSILON
					? 0
					: (sample.progress - samples[previousIndex].progress) / interval;
			sample.direction.copy(
				normalizedDirectionLerp(
					samples[previousIndex].direction,
					samples[nextIndex].direction,
					progress,
				),
			);
		} else if (previousIndex >= 0) {
			sample.direction.copy(samples[previousIndex].direction);
		} else if (nextIndex < samples.length) {
			sample.direction.copy(samples[nextIndex].direction);
		}
	}
}

function limitFramingAngularRate(
	samples: RawCameraFramingGuardSample[],
	envelope: CameraFramingEnvelope,
) {
	const cumulativeAngles = [0];
	for (let index = 1; index < samples.length; index += 1) {
		cumulativeAngles.push(
			cumulativeAngles[index - 1] + samples[index - 1].direction.angleTo(samples[index].direction),
		);
	}

	// The guard may only correct gaze where the envelope weight is positive.
	// Outside the active interval raw directions are pinned so automatic
	// framing is preserved exactly.
	const activeStart = MathUtils.clamp(envelope.enterStart, 0, 1);
	const activeEnd = MathUtils.clamp(envelope.exitEnd, 0, 1);
	let activeStartIndex = 0;
	while (
		activeStartIndex < samples.length - 1 &&
		samples[activeStartIndex].progress < activeStart
	) {
		activeStartIndex += 1;
	}
	let activeEndIndex = samples.length - 1;
	while (activeEndIndex > 0 && samples[activeEndIndex].progress > activeEnd) {
		activeEndIndex -= 1;
	}
	if (activeEndIndex <= activeStartIndex) {
		return {
			directions: samples.map((sample) => sample.direction),
			changed: false,
		};
	}

	const startDirection = samples[activeStartIndex].direction;
	const endDirection = samples[activeEndIndex].direction;
	const intervalAngle = cumulativeAngles[activeEndIndex] - cumulativeAngles[activeStartIndex];
	const intervalStartTimeSeconds = samples[activeStartIndex].timeSeconds;
	const intervalEndTimeSeconds = samples[activeEndIndex].timeSeconds;
	const intervalCapacity =
		(CAMERA_FRAMING_GUARD_POLICY.maxAngularRateRadiansPerSecond *
			(intervalEndTimeSeconds - intervalStartTimeSeconds)) /
		CAMERA_FRAMING_GUARD_POLICY.angularInterpolationPeakRateFactor;
	if (intervalAngle > intervalCapacity) {
		return {
			directions: samples.map((sample, index) => {
				if (index <= activeStartIndex || index >= activeEndIndex) {
					return sample.direction;
				}
				const intervalProgress = (sample.progress - activeStart) / (activeEnd - activeStart);
				return sphericalDirectionLerp(
					startDirection,
					endDirection,
					smootherstep01(intervalProgress),
				);
			}),
			changed: true,
		};
	}

	const correctedAngles = cumulativeAngles.slice();
	let changed = false;
	for (let index = activeStartIndex + 1; index < activeEndIndex; index += 1) {
		const stepCapacity =
			(CAMERA_FRAMING_GUARD_POLICY.maxAngularRateRadiansPerSecond *
				(samples[index].timeSeconds - samples[index - 1].timeSeconds)) /
			CAMERA_FRAMING_GUARD_POLICY.angularInterpolationPeakRateFactor;
		const remainingCapacity =
			(CAMERA_FRAMING_GUARD_POLICY.maxAngularRateRadiansPerSecond *
				(intervalEndTimeSeconds - samples[index].timeSeconds)) /
			CAMERA_FRAMING_GUARD_POLICY.angularInterpolationPeakRateFactor;
		const relativeRawAngle = cumulativeAngles[index] - cumulativeAngles[activeStartIndex];
		const lowerBound = Math.max(
			correctedAngles[index - 1] - cumulativeAngles[activeStartIndex],
			intervalAngle - remainingCapacity,
		);
		const upperBound =
			correctedAngles[index - 1] - cumulativeAngles[activeStartIndex] + stepCapacity;
		const correctedRelativeAngle = MathUtils.clamp(relativeRawAngle, lowerBound, upperBound);
		correctedAngles[index] = cumulativeAngles[activeStartIndex] + correctedRelativeAngle;
		if (Math.abs(correctedAngles[index] - cumulativeAngles[index]) > Number.EPSILON) {
			changed = true;
		}
	}

	const corrected = correctedAngles.map((correctedAngle, index) => {
		if (index <= activeStartIndex || index >= activeEndIndex) {
			return samples[index].direction;
		}
		let endIndex = 1;
		while (endIndex < cumulativeAngles.length - 1 && correctedAngle > cumulativeAngles[endIndex]) {
			endIndex += 1;
		}
		const startAngle = cumulativeAngles[endIndex - 1];
		const endAngle = cumulativeAngles[endIndex];
		const intervalAngle = endAngle - startAngle;
		const intervalProgress =
			intervalAngle <= Number.EPSILON ? 1 : (correctedAngle - startAngle) / intervalAngle;
		return sphericalDirectionLerp(
			samples[endIndex - 1].direction,
			samples[endIndex].direction,
			intervalProgress,
		);
	});
	return { directions: corrected, changed };
}

function compileDoubleWhipBypass(
	context: CameraFramingGuardCompileContext,
	samples: RawCameraFramingGuardSample[],
): CameraFramingBypass | null {
	const envelope = context.edgeView.framingEnvelope!;
	if (envelope.exitEnd >= 1) return null;
	const exitSamples = samples.filter((sample) => sample.progress >= envelope.exitStart);
	if (exitSamples.length < 2) return null;
	const startDirection = exitSamples[0].direction;
	const endDirection = exitSamples.at(-1)!.direction;
	let angularPath = 0;
	let maxOffAxis = 0;
	for (let index = 0; index < exitSamples.length; index += 1) {
		if (index > 0) {
			angularPath += exitSamples[index - 1].direction.angleTo(exitSamples[index].direction);
		}
		const directProgress =
			(exitSamples[index].progress - envelope.exitStart) / (1 - envelope.exitStart);
		const directDirection = normalizedDirectionLerp(startDirection, endDirection, directProgress);
		maxOffAxis = Math.max(maxOffAxis, directDirection.angleTo(exitSamples[index].direction));
	}
	const directAngle = startDirection.angleTo(endDirection);
	const remainingSeconds = exitSamples.at(-1)!.timeSeconds - exitSamples[0].timeSeconds;
	const angularRate =
		remainingSeconds <= Number.EPSILON ? Number.POSITIVE_INFINITY : angularPath / remainingSeconds;
	if (
		maxOffAxis <= CAMERA_FRAMING_GUARD_POLICY.doubleWhipOffAxisRadians ||
		angularPath - directAngle <= CAMERA_FRAMING_GUARD_POLICY.doubleWhipPathExcessRadians ||
		angularRate <= CAMERA_FRAMING_GUARD_POLICY.maxAngularRateRadiansPerSecond
	) {
		return null;
	}

	const authored = createCameraMotionSample();
	sampleAuthoredView(context.edgeView, envelope.exitStart, context.easing, authored);
	return {
		startProgress: envelope.exitStart,
		startTarget: authored.target.clone(),
		endTarget: context.edgeView.points.at(-1)!.cameraTarget.clone(),
	};
}

export function compileCameraFramingGuard(
	context: CameraFramingGuardCompileContext,
): CameraFramingGuard | null {
	const samples = collectAdaptiveFramingSamples(context);
	const hasStandoffDanger = samples.some(
		(sample) => sample.distance < CAMERA_FRAMING_GUARD_POLICY.targetStandoffShoulderMeters,
	);
	continueSingularDirections(samples);
	const limited = limitFramingAngularRate(samples, context.edgeView.framingEnvelope!);
	const bypass = compileDoubleWhipBypass(context, samples);
	if (!hasStandoffDanger && !limited.changed && !bypass) return null;
	return {
		directions: samples.map((sample, index) => ({
			progress: sample.progress,
			directionX: limited.directions[index].x,
			directionY: limited.directions[index].y,
			directionZ: limited.directions[index].z,
		})),
		limitsAngularRate: limited.changed,
		hasStandoffDanger,
		bypass,
	};
}

function sampleCompiledGuardDirection(
	guard: CameraFramingGuard,
	progress: number,
	output: Vector3,
) {
	const samples = guard.directions;
	let endIndex = 1;
	while (endIndex < samples.length - 1 && progress > samples[endIndex].progress) {
		endIndex += 1;
	}
	const start = samples[endIndex - 1];
	const end = samples[endIndex];
	const interval = end.progress - start.progress;
	const intervalProgress =
		interval <= Number.EPSILON ? 1 : MathUtils.clamp((progress - start.progress) / interval, 0, 1);
	const easedIntervalProgress = smootherstep01(intervalProgress);
	const dot = MathUtils.clamp(
		start.directionX * end.directionX +
			start.directionY * end.directionY +
			start.directionZ * end.directionZ,
		-1,
		1,
	);
	if (dot < -CAMERA_FRAMING_GUARD_POLICY.sphericalLerpLinearDotThreshold) {
		antipodalDirectionInterpolate(
			new Vector3(start.directionX, start.directionY, start.directionZ),
			easedIntervalProgress,
			output,
		);
	} else if (dot > CAMERA_FRAMING_GUARD_POLICY.sphericalLerpLinearDotThreshold) {
		output.set(
			MathUtils.lerp(start.directionX, end.directionX, easedIntervalProgress),
			MathUtils.lerp(start.directionY, end.directionY, easedIntervalProgress),
			MathUtils.lerp(start.directionZ, end.directionZ, easedIntervalProgress),
		);
	} else {
		const angle = Math.acos(dot);
		const sinAngle = Math.sin(angle);
		const startWeight = Math.sin((1 - easedIntervalProgress) * angle) / sinAngle;
		const endWeight = Math.sin(easedIntervalProgress * angle) / sinAngle;
		output.set(
			start.directionX * startWeight + end.directionX * endWeight,
			start.directionY * startWeight + end.directionY * endWeight,
			start.directionZ * startWeight + end.directionZ * endWeight,
		);
	}
	const lengthSquared = output.lengthSq();
	if (lengthSquared > CAMERA_FRAMING_GUARD_POLICY.directionEpsilonMeters ** 2) {
		output.multiplyScalar(1 / Math.sqrt(lengthSquared));
	}
}

export function applyCameraFramingGuard(
	guard: CameraFramingGuard,
	progress: number,
	output: CameraMotionSample,
) {
	if (progress <= 0 || progress >= 1) return;
	const bypass = guard.bypass;
	const bypassApplied = bypass !== null && progress >= bypass.startProgress;
	if (bypass && bypassApplied) {
		const interval = 1 - bypass.startProgress;
		const bypassProgress =
			interval <= Number.EPSILON
				? 1
				: smootherstep01(MathUtils.clamp((progress - bypass.startProgress) / interval, 0, 1));
		output.target.copy(bypass.startTarget).lerp(bypass.endTarget, bypassProgress);
	}

	const targetX = output.target.x - output.position.x;
	const targetY = output.target.y - output.position.y;
	const targetZ = output.target.z - output.position.z;
	const rawDistance = Math.hypot(targetX, targetY, targetZ);
	const needsStandoff = rawDistance < CAMERA_FRAMING_GUARD_POLICY.targetStandoffShoulderMeters;
	if ((!guard.limitsAngularRate || bypassApplied) && !needsStandoff) return;

	if (
		(guard.limitsAngularRate && !bypassApplied) ||
		rawDistance <= CAMERA_FRAMING_GUARD_POLICY.directionEpsilonMeters
	) {
		sampleCompiledGuardDirection(guard, progress, output.target);
	} else {
		output.target.set(targetX / rawDistance, targetY / rawDistance, targetZ / rawDistance);
	}
	const minDistance = CAMERA_FRAMING_GUARD_POLICY.minTargetStandoffMeters;
	const shoulderDistance = CAMERA_FRAMING_GUARD_POLICY.targetStandoffShoulderMeters;
	let correctedDistance = rawDistance;
	if (rawDistance <= minDistance) {
		correctedDistance = minDistance;
	} else if (rawDistance < shoulderDistance) {
		const shoulderProgress = (rawDistance - minDistance) / (shoulderDistance - minDistance);
		correctedDistance = MathUtils.lerp(minDistance, rawDistance, smootherstep01(shoulderProgress));
	}
	output.target.multiplyScalar(correctedDistance).add(output.position);
}
