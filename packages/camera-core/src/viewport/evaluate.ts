import {
	addVec3,
	invertMatrix,
	isFiniteVec3,
	lerpNumber,
	lerpVec3,
	lookAtMatrix,
	multiplyMatrices,
	normalizeVec3,
	orthographicMatrix,
	perspectiveMatrix,
	scaleVec3,
} from '../viewport-math';
import { poseDirection, poseFovIsValid, viewUpForPose } from './pose';
import {
	clamp,
	isFiniteNumber,
	isHiddenViewport,
	nearestQuarterTurn,
	smoothstep,
	transitionProgress,
	validateViewportRect,
	viewportEvaluationToken,
} from './state';
import type {
	InspectionPose,
	ViewingIntentRefusal,
	ViewingIntentResult,
	ViewportCameraState,
	ViewportDiagnostic,
	ViewportEvaluationRefusal,
	ViewportEvaluationResult,
	ViewportProjectionKind,
	ViewportReading,
	ViewportTransition,
	WorkingPlane,
	WorkingPlaneQualification,
} from './types';
import {
	HALF_PI,
	VIEWPORT_ELEVATION_LIMIT_RADIANS,
	VIEWPORT_GROUND_NEAR_FRACTION,
	VIEWPORT_GROUND_REACH_EXTENTS,
	VIEWPORT_GROUND_REACH_EYE_HEIGHTS,
	VIEWPORT_NEAR_FLOOR_METERS,
	VIEWPORT_PLAN_EYE_DISTANCE_METERS,
	VIEWPORT_READING_POSE_HOLD,
	VIEWPORT_REFERENCE_FOV_Y_RADIANS,
} from './types';

/** The perspective distance that fills the target plane with `targetPlaneHeightMeters`. */
export function perspectiveDistanceMeters(
	targetPlaneHeightMeters: number,
	fovYDegrees?: number,
): number {
	const halfFovRadians =
		fovYDegrees === undefined
			? VIEWPORT_REFERENCE_FOV_Y_RADIANS / 2
			: (fovYDegrees * Math.PI) / 360;
	return targetPlaneHeightMeters / 2 / Math.tan(halfFovRadians);
}

function depthRange(
	distanceMeters: number,
	sceneRadiusMeters: number,
): { near: number; far: number; clamped: boolean } {
	const rawNear = distanceMeters - Math.max(sceneRadiusMeters, VIEWPORT_NEAR_FLOOR_METERS);
	const near = Math.max(VIEWPORT_NEAR_FLOOR_METERS, rawNear);
	const far = Math.max(near + VIEWPORT_NEAR_FLOOR_METERS, distanceMeters + sceneRadiusMeters);
	return { near, far, clamped: rawNear < VIEWPORT_NEAR_FLOOR_METERS };
}

/**
 * The display-ground reach for a perspective evaluation, in metres:
 * `max(24 × extent, 96 × eyeHeight)` with `extent = targetPlaneHeight × max(1, aspect)`.
 * The Stage sizes its finite mat from the same function, so the mat and the clip
 * range cannot disagree.
 */
export function viewportGroundReachMeters(input: {
	readonly targetPlaneHeightMeters: number;
	readonly aspect: number;
	readonly eyeHeightMeters: number;
}): number {
	const extent = input.targetPlaneHeightMeters * Math.max(1, input.aspect);
	return Math.max(
		VIEWPORT_GROUND_REACH_EXTENTS * extent,
		VIEWPORT_GROUND_REACH_EYE_HEIGHTS * input.eyeHeightMeters,
	);
}

/**
 * The clip range that keeps a display ground visible.
 *
 * The scene-sphere range clipped the finite ground twice: the far plane cut it in
 * a straight line and, at a low orbit, the near plane cut the ground at the
 * frame's bottom. Far reaches the specified ground distance; near never
 * passes the nearest ground the frame's bottom row sees. With no ground the range
 * is exactly the scene-sphere one.
 */
function groundDepthRange(
	distanceMeters: number,
	sceneRadiusMeters: number,
	ground: {
		readonly eyeHeightMeters: number;
		readonly elevationRadians: number;
		readonly halfFovRadians: number;
		readonly reachMeters: number;
	},
): { near: number; far: number; clamped: boolean } {
	const base = depthRange(distanceMeters, sceneRadiusMeters);
	const far = Math.max(base.far, distanceMeters + ground.reachMeters);
	const bottomAngle = ground.elevationRadians + ground.halfFovRadians;
	const groundNear =
		ground.eyeHeightMeters > 0 && bottomAngle > 0
			? (ground.eyeHeightMeters * Math.cos(ground.halfFovRadians)) / Math.sin(bottomAngle)
			: Infinity;
	const near = Math.max(
		VIEWPORT_NEAR_FLOOR_METERS,
		Math.min(
			distanceMeters - Math.max(sceneRadiusMeters, VIEWPORT_NEAR_FLOOR_METERS),
			VIEWPORT_GROUND_NEAR_FRACTION * groundNear,
		),
	);
	return { near, far: Math.max(far, near + VIEWPORT_NEAR_FLOOR_METERS), clamped: base.clamped };
}

/** The pose a reading settles at. Plan snaps its azimuth and stands exactly over the target. */
export function settledPoseFor(
	reading: ViewportReading,
	pose: InspectionPose,
	lastElevationRadians: number,
): InspectionPose {
	if (reading === 'plan') {
		return {
			target: pose.target,
			azimuthRadians: nearestQuarterTurn(pose.azimuthRadians),
			elevationRadians: HALF_PI,
			targetPlaneHeightMeters: pose.targetPlaneHeightMeters,
			...(pose.fovYDegrees === undefined ? {} : { fovYDegrees: pose.fovYDegrees }),
		};
	}
	return {
		target: pose.target,
		azimuthRadians: pose.azimuthRadians,
		elevationRadians: clamp(
			lastElevationRadians,
			-VIEWPORT_ELEVATION_LIMIT_RADIANS,
			VIEWPORT_ELEVATION_LIMIT_RADIANS,
		),
		targetPlaneHeightMeters: pose.targetPlaneHeightMeters,
		...(pose.fovYDegrees === undefined ? {} : { fovYDegrees: pose.fovYDegrees }),
	};
}

/** The interpolated pose and orthographic weight at a transition progress. */
function transitionFrame(
	transition: ViewportTransition,
	progress: number,
): { pose: InspectionPose; orthographicWeight: number } {
	const eased = smoothstep(progress);
	// A face entry and its return run in 3D at both ends. The
	// orthographic weight is therefore zero throughout, and the pose eases over
	// the whole duration instead of reserving the flip's Paper pose-hold share.
	const inPlace3d = transition.from === '3d' && transition.to === '3d';
	const orthographicWeight = inPlace3d ? 0 : transition.from === 'plan' ? 1 - eased : eased;
	// The pose is overhead for the Plan end of the flip while the projection keeps
	// flattening, so Paper's reveal has time on the ground it will register with.
	const poseEased = inPlace3d
		? eased
		: smoothstep(
				transition.from === 'plan'
					? Math.max(0, (progress - VIEWPORT_READING_POSE_HOLD) / (1 - VIEWPORT_READING_POSE_HOLD))
					: Math.min(1, progress / (1 - VIEWPORT_READING_POSE_HOLD)),
			);
	// Azimuth takes the shortest path so a flip rotates the way a reading change implies.
	const rawDelta = transition.toPose.azimuthRadians - transition.fromPose.azimuthRadians;
	const wrapped = Math.atan2(Math.sin(rawDelta), Math.cos(rawDelta));
	return {
		pose: {
			target: lerpVec3(transition.fromPose.target, transition.toPose.target, poseEased),
			azimuthRadians: transition.fromPose.azimuthRadians + wrapped * poseEased,
			elevationRadians: lerpNumber(
				transition.fromPose.elevationRadians,
				transition.toPose.elevationRadians,
				poseEased,
			),
			targetPlaneHeightMeters: lerpNumber(
				transition.fromPose.targetPlaneHeightMeters,
				transition.toPose.targetPlaneHeightMeters,
				poseEased,
			),
			...(transition.fromPose.fovYDegrees !== undefined &&
			transition.toPose.fovYDegrees !== undefined
				? {
						fovYDegrees: lerpNumber(
							transition.fromPose.fovYDegrees,
							transition.toPose.fovYDegrees,
							poseEased,
						),
					}
				: transition.toPose.fovYDegrees === undefined
					? {}
					: { fovYDegrees: transition.toPose.fovYDegrees }),
		},
		orthographicWeight,
	};
}

function unavailable(
	reason: ViewportEvaluationRefusal,
	path: string,
	code: string,
	message: string,
): ViewportEvaluationResult {
	return { kind: 'unavailable', reason, issues: [{ path, code, message }] };
}

function qualifyWorkingPlane(plane: WorkingPlane | null | undefined): WorkingPlaneQualification {
	if (plane === null || plane === undefined)
		return { kind: 'unavailable', reason: 'no-plane-supplied' };
	if (
		!isFiniteVec3(plane.originMeters) ||
		!isFiniteVec3(plane.normal) ||
		!isFiniteNumber(plane.yawRadians)
	) {
		return { kind: 'unavailable', reason: 'invalid-plane' };
	}
	if (normalizeVec3(plane.normal) === null) return { kind: 'unavailable', reason: 'invalid-plane' };
	return { kind: 'qualified', plane };
}

/**
 * Evaluate the viewport: the one place pose and projection become matrices.
 *
 * Pure, and a refusal rather than a partial result for a viewport that cannot be
 * evaluated: a hidden or zero-size viewport, a degenerate view, or a singular
 * projection returns `unavailable` with its reason, so no caller ever divides by a
 * zero extent or consumes a NaN matrix.
 */
export function evaluateViewport(
	state: ViewportCameraState,
	rectInput: unknown,
	clockSeconds: number,
	evaluationGeneration: number,
	workingPlane?: WorkingPlane | null,
): ViewportEvaluationResult {
	const validation = validateViewportRect(rectInput);
	if (!validation.valid || validation.rect === undefined) {
		return unavailable(
			'invalid-viewport',
			'$.rect',
			'invalid-viewport',
			validation.issues[0]?.message ?? 'the viewport rectangle is not valid',
		);
	}
	const rect = validation.rect;
	if (isHiddenViewport(rect)) {
		return unavailable(
			'hidden-viewport',
			'$.rect',
			'hidden-viewport',
			'a viewport with no drawable area has no output; it is not projected and never divides by a zero extent',
		);
	}

	const transition = state.transition;
	const progress = transition === null ? 1 : transitionProgress(transition, clockSeconds);
	const frame =
		transition === null
			? {
					pose: state.pose,
					orthographicWeight: state.reading === 'plan' ? 1 : 0,
				}
			: transitionFrame(transition, progress);
	const pose = frame.pose;
	const orthographicWeight = frame.orthographicWeight;

	// The realized reading is derived from the family weight alone, so a settled
	// endpoint is the same thing at a clock past the transition as at its exact end.
	const realizedReading: ViewportReading | null =
		orthographicWeight >= 1 ? 'plan' : orthographicWeight <= 0 ? '3d' : null;
	const up = viewUpForPose(pose);
	const direction = poseDirection(pose);

	// The projective family: the camera retreats along the interpolated view direction
	// while the perspective half-angle is recomputed from that distance, so the visible
	// extent at the target plane stays exactly `targetPlaneHeightMeters` for every weight.
	// `w = 1` is the exact orthographic matrix at the plan eye distance.
	if (!poseFovIsValid(pose)) {
		return unavailable(
			'degenerate-view',
			'$.pose.fovYDegrees',
			'degenerate-view',
			'an authored vertical field of view must be finite and strictly between 0 and 180 degrees',
		);
	}
	const orthographic = orthographicWeight >= 1;
	const displayGroundY = state.displayGroundYMeters ?? null;
	const groundAboveTarget = displayGroundY === null ? 0 : displayGroundY - pose.target[1];
	const halfHeightMeters = pose.targetPlaneHeightMeters / 2;
	const distanceMeters = orthographic
		? Math.max(
				VIEWPORT_PLAN_EYE_DISTANCE_METERS,
				groundAboveTarget + VIEWPORT_NEAR_FLOOR_METERS * 2,
			)
		: perspectiveDistanceMeters(pose.targetPlaneHeightMeters, pose.fovYDegrees) /
			(1 - orthographicWeight);
	if (!Number.isFinite(distanceMeters) || distanceMeters <= 0) {
		return unavailable(
			'singular-projection',
			'$.pose',
			'singular-projection',
			'the pose has no finite view distance',
		);
	}
	const tanHalfFov = halfHeightMeters / distanceMeters;
	const eye = addVec3(pose.target, scaleVec3(direction, distanceMeters));

	const viewMatrix = lookAtMatrix(eye, pose.target, up);
	if (viewMatrix === null) {
		return unavailable(
			'degenerate-view',
			'$.pose',
			'degenerate-view',
			'the pose has no non-degenerate view basis: the target plane and the view direction are parallel',
		);
	}

	const aspect = rect.width / rect.height;
	// A sparse scene's sphere may omit the datum after a 3D pan. Keep the
	// display grid and the ink just above it inside the orthographic depth range.
	const planRadius =
		displayGroundY === null
			? state.sceneRadiusMeters
			: Math.max(state.sceneRadiusMeters, Math.abs(groundAboveTarget) + VIEWPORT_NEAR_FLOOR_METERS);
	const depth = orthographic
		? depthRange(distanceMeters, planRadius)
		: displayGroundY === null
			? depthRange(distanceMeters, state.sceneRadiusMeters)
			: groundDepthRange(distanceMeters, state.sceneRadiusMeters, {
					eyeHeightMeters: eye[1] - displayGroundY,
					elevationRadians: pose.elevationRadians,
					halfFovRadians: Math.atan(tanHalfFov),
					reachMeters: Math.max(
						state.minimumGroundReachMeters ?? 0,
						viewportGroundReachMeters({
							targetPlaneHeightMeters: pose.targetPlaneHeightMeters,
							aspect,
							eyeHeightMeters: eye[1] - displayGroundY,
						}),
					),
				});
	const projectionMatrix = orthographic
		? orthographicMatrix(halfHeightMeters, aspect, depth.near, depth.far)
		: perspectiveMatrix(tanHalfFov, aspect, depth.near, depth.far);

	const inverseViewMatrix = invertMatrix(viewMatrix);
	const inverseProjectionMatrix = invertMatrix(projectionMatrix);
	const viewProjectionMatrix = multiplyMatrices(projectionMatrix, viewMatrix);
	const inverseViewProjectionMatrix = invertMatrix(viewProjectionMatrix);
	if (
		inverseViewMatrix === null ||
		inverseProjectionMatrix === null ||
		inverseViewProjectionMatrix === null
	) {
		return unavailable(
			'singular-projection',
			'$.projection',
			'singular-projection',
			'the view or projection matrix is singular, so no inverse exists for rays or overlays',
		);
	}

	const projectionKind: ViewportProjectionKind = orthographic
		? 'plan-orthographic'
		: orthographicWeight <= 0
			? 'perspective-3d'
			: 'projective-transition';

	const diagnostics: ViewportDiagnostic[] = [];
	if (depth.clamped) {
		diagnostics.push({
			code: 'depth-range-clamped',
			message:
				'the near plane was clamped to the near floor because the scene radius reaches the camera',
		});
	}
	if (transition !== null && progress < 1) {
		diagnostics.push({
			code: 'reading-transition-in-flight',
			message: `the ${transition.from}→${transition.to} reading transition is in flight and settles at its own clock`,
		});
	}

	return {
		kind: 'evaluated',
		evaluation: {
			token: viewportEvaluationToken(state, evaluationGeneration),
			rect,
			settledReading: state.reading,
			renderedReading:
				transition !== null && progress < 1 ? 'transition' : (realizedReading ?? state.reading),
			projectionKind,
			orthographicWeight,
			progress,
			pose,
			eye,
			target: pose.target,
			up,
			near: depth.near,
			far: depth.far,
			viewMatrix,
			projectionMatrix,
			inverseViewMatrix,
			inverseProjectionMatrix,
			viewProjectionMatrix,
			inverseViewProjectionMatrix,
			targetPlaneMetersPerCssPixel: pose.targetPlaneHeightMeters / rect.height,
			workingPlane: qualifyWorkingPlane(workingPlane),
			diagnostics,
		},
	};
}

export function reject(
	state: ViewportCameraState,
	code: ViewingIntentRefusal,
	message: string,
): ViewingIntentResult {
	return { kind: 'rejected', state, code, message };
}

export function accept(state: ViewportCameraState): ViewingIntentResult {
	return { kind: 'accepted', state };
}

/**
 * Apply a new pose to the session, keeping an in-flight flip coherent with it.
 *
 * A pose-changing intent submitted during a flip is applied to **both** ends of the
 * flip, so the flip's declared endpoint carries the new target and scale instead of
 * silently reverting them when it settles. The flip keeps its own clock: applying an
 * intent never restarts or shortens it.
 */
export function withPose(state: ViewportCameraState, pose: InspectionPose): ViewportCameraState {
	const lastReadingElevationRadians =
		state.reading === '3d'
			? clamp(
					pose.elevationRadians,
					-VIEWPORT_ELEVATION_LIMIT_RADIANS,
					VIEWPORT_ELEVATION_LIMIT_RADIANS,
				)
			: state.lastReadingElevationRadians;
	const transition = state.transition;
	return {
		...state,
		pose,
		lastReadingElevationRadians,
		transition:
			transition === null
				? null
				: {
						...transition,
						fromPose: settledPoseFor(transition.from, pose, lastReadingElevationRadians),
						toPose: settledPoseFor(transition.to, pose, lastReadingElevationRadians),
					},
	};
}
