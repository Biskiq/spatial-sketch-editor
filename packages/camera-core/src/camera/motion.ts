import { CurvePath, MathUtils, Vector3 } from 'three';
import type { CameraEasing, CameraFramingEnvelope } from '../scene-types';
import { CAMERA_FOV } from '../scene-types';
import { compileCameraFramingGuard } from './framing-guard';
import {
	clonePoints,
	compilePreparedPositionPath,
	countOrderedPositionPoints,
	createRoundedPath,
	preparePositionParts,
	prepareRouteEdge,
	readFov,
	readVector3,
	replacePreparedStartPosition,
} from './paths';
import type {
	CameraFramingGuardStatus,
	CameraMotion,
	CameraMotionEdgeView,
	CameraMotionOptions,
	CameraMotionSample,
	CameraMotionViewPoint,
	CameraPose,
	CameraPositionEdgeDistanceSpan,
	CameraRoute,
	PreparedCameraRouteEdge,
} from './types';

export const VISITOR_CAMERA_PROJECTION = {
	fov: CAMERA_FOV.default,
	near: 0.1,
	far: 90,
} as const;

export const CAMERA_FOV_UPDATE_EPSILON = 1e-4;

export const CAMERA_POSE_EPSILON = 1e-6;

export const CAMERA_MOTION_TIMING = {
	unitsPerSecond: 6.2,
	minDurationSeconds: 1.25,
	maxDurationSeconds: 4.8,
} as const;

/** Default easing used when a motion has no authored override. */
export const CAMERA_MOTION_DEFAULT_EASING: CameraEasing = 'smootherstep';

export const CAMERA_MOTION_PATH = {
	positionCornerRadius: 0.42,
	targetCornerRadius: 0.65,
	cornerTrimRatio: 0.2,
	autoBezierAlpha: 0.5,
} as const;

/**
 * Read the compiled oriented-edge guard status for one edge view.
 * Returns null when no authored framing envelope or guard is compiled for
 * the requested edge.
 */
export function readCameraFramingGuardStatus(
	motion: CameraMotion,
	edgeIndex: number,
): CameraFramingGuardStatus | null {
	if (!Number.isInteger(edgeIndex) || edgeIndex < 0 || edgeIndex >= motion.edgeViews.length) {
		return null;
	}
	const edgeView = motion.edgeViews[edgeIndex];
	if (!edgeView?.guard) return null;
	const guard = edgeView.guard;
	return {
		limitsAngularRate: guard.limitsAngularRate,
		hasBypass: guard.bypass !== null,
		hasStandoff: guard.hasStandoffDanger,
	};
}

export const CAMERA_FRAMING_GUARD_POLICY = {
	minTargetStandoffMeters: VISITOR_CAMERA_PROJECTION.near,
	targetStandoffShoulderMeters: VISITOR_CAMERA_PROJECTION.near * 2,
	directionEpsilonMeters: CAMERA_POSE_EPSILON,
	maxAngularRateRadiansPerSecond: Math.PI * 1.5,
	angularInterpolationPeakRateFactor: 1.875,
	maxSampleAngularDeltaRadians: Math.PI / 36,
	maxTargetDistanceCurvatureMeters: VISITOR_CAMERA_PROJECTION.near / 2,
	baseSampleSegments: 24,
	maxAdaptiveDepth: 8,
	doubleWhipOffAxisRadians: Math.PI / 12,
	doubleWhipPathExcessRadians: Math.PI / 18,
	sphericalLerpLinearDotThreshold: 1 - CAMERA_POSE_EPSILON,
} as const;

function createMotionEdgeView(edge: PreparedCameraRouteEdge): CameraMotionEdgeView | null {
	const track = edge.viewTrack;
	if (!track) return null;

	const points: CameraMotionViewPoint[] = [
		{
			progress: 0,
			cameraTarget: track.start.cameraTarget.clone(),
			fov: track.start.fov,
		},
		...track.keyframes.map((keyframe) => ({
			progress: keyframe.progress,
			cameraTarget: keyframe.cameraTarget.clone(),
			fov: keyframe.fov,
		})),
		{
			progress: 1,
			cameraTarget: track.end.cameraTarget.clone(),
			fov: track.end.fov,
		},
	];
	const automaticTargetPath = edge.automaticTargetPoints
		? createRoundedPath(edge.automaticTargetPoints, CAMERA_MOTION_PATH.targetCornerRadius)
		: null;
	if (automaticTargetPath) {
		automaticTargetPath.getLength();
		automaticTargetPath.getLengths();
	}

	return {
		points,
		automaticTargetPath,
		hasAuthoredKeyframes: track.keyframes.length > 0,
		guard: null,
		...(track.framingEnvelope === undefined
			? {}
			: { framingEnvelope: { ...track.framingEnvelope } }),
	};
}

function validateAuthoredViewPoses(
	positionPath: CurvePath<Vector3>,
	totalPositionDistance: number,
	positionEdgeSpans: readonly CameraPositionEdgeDistanceSpan[],
	edges: readonly PreparedCameraRouteEdge[],
) {
	const sampledPosition = new Vector3();

	for (const [edgeIndex, edge] of edges.entries()) {
		const track = edge.viewTrack;
		const span = positionEdgeSpans[edgeIndex];
		if (!track || !span) continue;

		for (const [keyframeIndex, keyframe] of track.keyframes.entries()) {
			const distance = span.startDistance + span.length * keyframe.progress;
			const globalProgress =
				totalPositionDistance <= Number.EPSILON
					? keyframe.progress
					: distance / totalPositionDistance;
			positionPath.getPointAt(globalProgress, sampledPosition);
			if (sampledPosition.distanceTo(keyframe.cameraTarget) <= CAMERA_POSE_EPSILON) {
				throw new Error(
					`Camera route edge[${edgeIndex}] view keyframe[${keyframeIndex}] target must be farther than ${CAMERA_POSE_EPSILON} from its sampled position`,
				);
			}
		}
	}
}

export function createCameraMotion(
	route: CameraRoute,
	optionalStartPose?: CameraPose,
	options?: CameraMotionOptions,
): CameraMotion {
	const positionParts = preparePositionParts(route.positionParts);
	const positionPointCount = countOrderedPositionPoints(positionParts);
	const targets = clonePoints(route.targetPoints, 'Camera route target');
	const edges = (route.edges ?? []).map((edge, edgeIndex) => prepareRouteEdge(edge, edgeIndex));
	let startFov = readFov(
		route.startFov ?? edges[0]?.viewTrack?.start.fov ?? CAMERA_FOV.default,
		'Camera route start fov',
	);
	const endFov = readFov(
		route.endFov ?? edges.at(-1)?.viewTrack?.end.fov ?? CAMERA_FOV.default,
		'Camera route end fov',
	);

	if (targets.length !== positionPointCount) {
		throw new Error(
			'Camera route ordered position points and target points must have the same length',
		);
	}

	if (optionalStartPose && positionPointCount > 1) {
		const livePosition = readVector3(optionalStartPose.position, 'Camera start position');
		const liveTarget = readVector3(optionalStartPose.target, 'Camera start target');
		if (livePosition.distanceTo(liveTarget) <= CAMERA_POSE_EPSILON) {
			throw new Error(
				`Camera start target must be farther than ${CAMERA_POSE_EPSILON} from its position`,
			);
		}
		replacePreparedStartPosition(positionParts, livePosition);
		startFov = readFov(optionalStartPose.fov, 'Camera start fov');
		targets[0] = liveTarget.clone();

		const firstEdge = edges[0];
		if (firstEdge?.viewTrack) {
			firstEdge.viewTrack.start.cameraTarget.copy(liveTarget);
			firstEdge.viewTrack.start.fov = startFov;
		}
		if (firstEdge?.automaticTargetPoints?.[0]) {
			firstEdge.automaticTargetPoints[0].copy(liveTarget);
		}
	}

	const compiledPosition = compilePreparedPositionPath(
		positionParts,
		edges.map((edge) => edge.positionSpan),
	);
	const positionPath = compiledPosition.positionPath;
	const targetPath = createRoundedPath(targets, CAMERA_MOTION_PATH.targetCornerRadius);
	const positionLength = compiledPosition.totalDistance;
	const positionEdgeSpans = edges.map(
		(edge, index): CameraPositionEdgeDistanceSpan => ({
			...edge,
			positionSpan: {
				start: { ...edge.positionSpan.start },
				end: { ...edge.positionSpan.end },
			},
			...compiledPosition.spans[index],
		}),
	);
	validateAuthoredViewPoses(positionPath, positionLength, positionEdgeSpans, edges);
	const edgeViews = edges.map(createMotionEdgeView);
	const usesLegacyTargetPath = !edgeViews.some((edgeView) => edgeView?.hasAuthoredKeyframes);

	// Curve.getPointAt() lazily builds arc-length tables. Prime both paths here so
	// frame-by-frame sampling only writes into the caller's reusable vectors.
	positionPath.getLengths();
	targetPath.getLength();
	targetPath.getLengths();

	const durationSeconds = resolveCameraMotionDuration(
		options?.durationSeconds,
		positionLength,
		positionPointCount,
	);
	const easing = resolveCameraMotionEasing(options?.easing);

	for (const [edgeIndex, edgeView] of edgeViews.entries()) {
		if (!edgeView?.hasAuthoredKeyframes || !edgeView.framingEnvelope) continue;
		edgeView.guard = compileCameraFramingGuard({
			edgeView,
			edgeSpan: positionEdgeSpans[edgeIndex],
			positionPath,
			targetPath,
			totalPositionDistance: positionLength,
			durationSeconds,
			easing,
		});
	}

	return {
		positionPath,
		targetPath,
		positionEdgeSpans,
		edgeViews,
		totalPositionDistance: positionLength,
		usesLegacyTargetPath,
		startFov,
		endFov,
		durationSeconds,
		easing,
	};
}

export function createCameraMotionSample(): CameraMotionSample {
	return {
		position: new Vector3(),
		target: new Vector3(),
		fov: CAMERA_FOV.default,
	};
}

export function smootherstep01(progress: number) {
	return progress * progress * progress * (progress * (progress * 6 - 15) + 10);
}

export function smootherstepRamp(progress: number, start: number, end: number, rising: boolean) {
	if (![progress, start, end].every(Number.isFinite)) return rising ? 0 : 1;
	if (end <= start) {
		if (rising) return progress < start ? 0 : 1;
		return progress <= start ? 1 : 0;
	}
	const rampProgress = MathUtils.clamp((progress - start) / (end - start), 0, 1);
	const weight = smootherstep01(rampProgress);
	return rising ? weight : 1 - weight;
}

export function sampleFramingEnvelopeWeight(envelope: CameraFramingEnvelope, progress: number) {
	const enterWeight = smootherstepRamp(progress, envelope.enterStart, envelope.enterEnd, true);
	const exitWeight = smootherstepRamp(progress, envelope.exitStart, envelope.exitEnd, false);
	return MathUtils.clamp(enterWeight * exitWeight, 0, 1);
}

function inverseSmootherstep01(progress: number) {
	const target = MathUtils.clamp(progress, 0, 1);
	if (target === 0 || target === 1) return target;
	let lower = 0;
	let upper = 1;
	for (let iteration = 0; iteration < 40; iteration += 1) {
		const midpoint = (lower + upper) / 2;
		if (smootherstep01(midpoint) < target) lower = midpoint;
		else upper = midpoint;
	}
	return (lower + upper) / 2;
}

function smoothstep(progress: number) {
	return progress * progress * (3 - 2 * progress);
}

function inverseSmoothstep(progress: number) {
	const target = MathUtils.clamp(progress, 0, 1);
	if (target === 0 || target === 1) return target;
	let lower = 0;
	let upper = 1;
	for (let iteration = 0; iteration < 40; iteration += 1) {
		const midpoint = (lower + upper) / 2;
		if (smoothstep(midpoint) < target) lower = midpoint;
		else upper = midpoint;
	}
	return (lower + upper) / 2;
}

/** Phase 3.7 easing helpers. Linear-affine and polynomial forms use closed-form inverses; smoothstep relies on bisection. */
export function cameraApplyEasing(easing: CameraEasing, progress: number): number {
	const clamped = MathUtils.clamp(progress, 0, 1);
	switch (easing) {
		case 'linear':
			return clamped;
		case 'smoothstep':
		case 'ease-in-out':
			return smoothstep(clamped);
		case 'smootherstep':
			return smootherstep01(clamped);
		case 'ease-in':
			return clamped * clamped;
		case 'ease-out':
			return 1 - (1 - clamped) * (1 - clamped);
	}
}

export function cameraInverseEasing(easing: CameraEasing, progress: number): number {
	const clamped = MathUtils.clamp(progress, 0, 1);
	switch (easing) {
		case 'linear':
			return clamped;
		case 'smoothstep':
		case 'ease-in-out':
			return inverseSmoothstep(clamped);
		case 'smootherstep':
			return inverseSmootherstep01(clamped);
		case 'ease-in':
			return Math.sqrt(clamped);
		case 'ease-out':
			return 1 - Math.sqrt(1 - clamped);
	}
}

export function resolveCameraMotionEasing(easing: CameraEasing | undefined): CameraEasing {
	if (easing === undefined) return CAMERA_MOTION_DEFAULT_EASING;
	return easing === 'ease-in-out' ? 'smoothstep' : easing;
}

export function resolveCameraMotionDuration(
	overridingDuration: number | undefined,
	positionLength: number,
	positionPointCount: number,
): number {
	if (
		typeof overridingDuration === 'number' &&
		Number.isFinite(overridingDuration) &&
		overridingDuration > 0
	) {
		return overridingDuration;
	}
	if (positionPointCount === 1) return 0;
	return MathUtils.clamp(
		positionLength / CAMERA_MOTION_TIMING.unitsPerSecond,
		CAMERA_MOTION_TIMING.minDurationSeconds,
		CAMERA_MOTION_TIMING.maxDurationSeconds,
	);
}
