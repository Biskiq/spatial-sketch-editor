/**
 * `T1.viewport-projection@1` — the Camera-owned **session inspection viewport**.
 *
 * One logical viewport output, one accepted controller, one evaluator. This module
 * owns viewing intent (pan / orbit / zoom / reading / Fit / Bring into view), the
 * evaluation of that intent into pose + projection, and the CSS↔world projection
 * helpers the Stage and overlays consume. It owns **no** authored Camera data:
 * nothing here writes a View, path, node, order, hold, FOV key or unit, so the
 * session inspection additions never consume the T3 authoring cutover.
 *
 * **One authority, realised elsewhere.** The Stage realises these matrices on
 * whatever Three object it likes; renderer Camera objects are realizers, not a
 * second state. There is exactly one pose here and no second controller:
 * `evaluateViewport` is a pure function of (state, rect, clock, generation) and
 * every realised matrix comes back out of it.
 *
 * **Ticket protocol boundary.** The landed F.3 Camera-output ticket protocol
 * (`@portfolio/project-model/src/channels/camera-output.ts`) is where ownership is
 * qualified, replaced, returned and cancelled — and `camera-core` sits *below*
 * `project-model`, so it cannot import it. The host therefore drives both: it
 * qualifies a ticket through the protocol and passes this module the output,
 * session and source identities the ticket was qualified for. The state's field
 * names are deliberately the protocol's (`outputId`, `sessionEpoch`,
 * `sourceRevision`) so the two compose without a translation table, and this module
 * never mints or validates a ticket of its own.
 *
 * **Readings and the projective transition.** `3d` is perspective; `plan` is an
 * **exact orthographic** top-down endpoint. Between them the evaluator runs a
 * genuine projective transition: the camera retreats along the interpolated view
 * direction while the perspective half-angle is recomputed as
 * `tanHalf = tanHalfFov3D · (1 − w)`, which holds the visible extent **at the target
 * plane** at exactly `targetPlaneHeightMeters` for every `w`, and `w = 1` is the
 * exact orthographic matrix. Perspective→parallel is a projective limit, so the
 * family is continuous, and the *Plan measurement authority is the orthographic
 * matrix itself* — not a perspective camera with a tiny FOV standing in for it,
 * and not a second affine transform or a shell tween. Because the target-plane
 * extent is invariant across the whole family, `projectWorld`, `pointerRay`, the
 * overlays and the meshes agree at every intermediate step by construction;
 * `targetPlaneMetersPerCssPixel` is `targetPlaneHeightMeters / rect.height` in both
 * readings for the same reason.
 *
 * **Aspect change is not a fit.** `evaluateViewport` takes the rect as an input:
 * resizing changes the projection aspect only. Target, orientation and vertical
 * framing scale are preserved, and Fit stays a separate explicit request.
 *
 * **Explicit frames.** Working-plane intersection takes a resolved
 * `WorkingPlane` the caller supplies: the owning domain resolves a frame (or
 * refuses), and camera-core never chooses a plane by proximity, containment or the
 * nearest Room.
 *
 * Runtime-safe: `./scene-types` and `./viewport-math` only. No project-model,
 * editor, renderer, Svelte or Three import.
 */

import { CAMERA_FOV, type Vec3 } from './scene-types';
import {
	addVec3,
	crossVec3,
	dotVec3,
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
	subtractVec3,
	transformPoint,
	viewScreenBasis
} from './viewport-math';

export const VIEWPORT_READINGS = ['3d', 'plan'] as const;

export type ViewportReading = (typeof VIEWPORT_READINGS)[number];

export const VIEWPORT_PROJECTION_KINDS = ['perspective-3d', 'projective-transition', 'plan-orthographic'] as const;

export type ViewportProjectionKind = (typeof VIEWPORT_PROJECTION_KINDS)[number];

/** Declared duration of a reading flip. The evaluator uses an explicit clock, never a shell tween. */
export const VIEWPORT_READING_TRANSITION_SECONDS = 0.6;

/** Target-plane extent bounds, in meters of visible height at the target plane. */
export const VIEWPORT_TARGET_PLANE_MIN_METERS = 0.05;
export const VIEWPORT_TARGET_PLANE_MAX_METERS = 1000;

/** Default 3D field of view, in radians. The landed camera vocabulary stays the single source of it. */
export const VIEWPORT_REFERENCE_FOV_Y_RADIANS = (CAMERA_FOV.default * Math.PI) / 180;

/** Distance from the target to the orthographic eye. Finite so the ortho depth range is real. */
export const VIEWPORT_PLAN_EYE_DISTANCE_METERS = 100;

/** Near-plane floor: a near plane at or below zero is not a depth range. */
export const VIEWPORT_NEAR_FLOOR_METERS = 0.01;

/**
 * Elevation limit in 3D. The view up vector must stay nondegenerate, and a
 * straight-down 3D pose is the Plan reading's job, not a perspective camera's.
 */
export const VIEWPORT_ELEVATION_LIMIT_RADIANS = Math.PI / 2 - 0.001;

/** Declared lateral/vertical fit padding, as a fraction of the framed extent. */
export const VIEWPORT_FIT_PADDING_FRACTION = 0.1;

const HALF_PI = Math.PI / 2;

/**
 * The inspection pose: where the camera looks, from which direction, and the
 * visible extent at the target plane. `elevationRadians` is positive **above** the
 * target plane (a normal surveillance reading), and `+π/2` is the exact top-down
 * Plan reading.
 */
export type InspectionPose = {
	readonly target: Vec3;
	readonly azimuthRadians: number;
	readonly elevationRadians: number;
	readonly targetPlaneHeightMeters: number;
};

/** The Stage's viewport rectangle. CSS pixels drive input and overlays; DPR only scales rendering. */
export type ViewportRect = {
	readonly left: number;
	readonly top: number;
	readonly width: number;
	readonly height: number;
	readonly devicePixelRatio: number;
};

/**
 * A resolved working plane. The owning domain resolves a frame to this (or
 * refuses); camera-core performs the intersection and never invents the frame.
 * `supportedLocalExtent` is the in-plane extent that domain actually supports, or
 * `null` when it supports the whole plane.
 */
export type WorkingPlane = {
	readonly originMeters: Vec3;
	readonly normal: Vec3;
	/** Yaw of the plane's local up axis in radians; the local axes are derived from it and the normal. */
	readonly yawRadians: number;
	/** The plane owner's datum in meters, or `null` when the owner authored none. */
	readonly datumMeters: number | null;
	readonly supportedLocalExtent: { readonly min: readonly [number, number]; readonly max: readonly [number, number] } | null;
};

export type WorkingPlaneQualification =
	| { readonly kind: 'qualified'; readonly plane: WorkingPlane }
	| { readonly kind: 'unavailable'; readonly reason: 'no-plane-supplied' | 'invalid-plane' };

export type ViewportIssue = { readonly path: string; readonly code: string; readonly message: string };

export type ViewportDiagnostic = { readonly code: string; readonly message: string };

/** The identity of one evaluation: which output, session, source and generation produced it. */
export type ViewportEvaluationToken = {
	readonly outputId: string;
	readonly sessionEpoch: string;
	readonly sourceRevision: string;
	readonly evaluationGeneration: number;
};

export type ViewportEvaluation = {
	readonly token: ViewportEvaluationToken;
	readonly rect: ViewportRect;
	/** The settled reading. During a flip this is still the reading being left. */
	readonly settledReading: ViewportReading;
	readonly renderedReading: ViewportReading | 'transition';
	readonly projectionKind: ViewportProjectionKind;
	/** `0` for perspective 3D, `1` for the exact orthographic Plan endpoint. */
	readonly orthographicWeight: number;
	readonly progress: number;
	readonly pose: InspectionPose;
	readonly eye: Vec3;
	readonly target: Vec3;
	readonly up: Vec3;
	readonly near: number;
	readonly far: number;
	readonly viewMatrix: readonly number[];
	readonly projectionMatrix: readonly number[];
	readonly inverseViewMatrix: readonly number[];
	readonly inverseProjectionMatrix: readonly number[];
	readonly viewProjectionMatrix: readonly number[];
	readonly inverseViewProjectionMatrix: readonly number[];
	/** Visible meters of world height per CSS pixel **at the target plane**; identical in both readings. */
	readonly targetPlaneMetersPerCssPixel: number;
	readonly workingPlane: WorkingPlaneQualification;
	readonly diagnostics: readonly ViewportDiagnostic[];
};

export type ViewportEvaluationRefusal =
	| 'invalid-viewport'
	| 'hidden-viewport'
	| 'degenerate-view'
	| 'singular-projection';

export type ViewportEvaluationResult =
	| { readonly kind: 'unavailable'; readonly reason: ViewportEvaluationRefusal; readonly issues: readonly ViewportIssue[] }
	| { readonly kind: 'evaluated'; readonly evaluation: ViewportEvaluation };

export type ViewportTransition = {
	readonly from: ViewportReading;
	readonly to: ViewportReading;
	readonly fromPose: InspectionPose;
	readonly toPose: InspectionPose;
	readonly startSeconds: number;
	readonly durationSeconds: number;
};

/**
 * One output's inspection session over one current source.
 *
 * The three identities mirror the landed ticket protocol's state. `reading` and
 * `pose` are the **settled** pair: a flip in flight is described by `transition`
 * and settles, deterministically, when its clock passes. `lastReadingElevationRadians`
 * is the last working 3D elevation a flip back to `3d` returns to, so returning
 * from Plan does not refit.
 */
export type ViewportCameraState = {
	readonly outputId: string;
	readonly sessionEpoch: string;
	readonly sourceRevision: string;
	readonly reading: ViewportReading;
	readonly pose: InspectionPose;
	readonly lastReadingElevationRadians: number;
	/** Declared scene radius in meters, used for the depth range and the Plan eye distance. */
	readonly sceneRadiusMeters: number;
	/**
	 * R217.S19 — the session's display-ground height, or `null` for none. It only
	 * widens the perspective clip range to the visible ground; it never enters scene
	 * bounds, Fit or the pose.
	 */
	readonly displayGroundYMeters?: number | null;
	readonly transition: ViewportTransition | null;
};

export type ViewportCameraInput = {
	readonly outputId: string;
	readonly sessionEpoch: string;
	readonly sourceRevision: string;
	readonly pose: InspectionPose;
	readonly sceneRadiusMeters: number;
	readonly reading?: ViewportReading;
	/** R217.S19 — optional session display ground; defaults to `null`. */
	readonly displayGroundYMeters?: number | null;
};

export type ViewingIntent =
	/** A CSS-pixel pan in the settled reading's target plane. */
	| { readonly kind: 'pan'; readonly deltaCss: readonly [number, number]; readonly rect: ViewportRect }
	| { readonly kind: 'orbit'; readonly deltaAzimuthRadians: number; readonly deltaElevationRadians: number }
	| { readonly kind: 'zoom'; readonly scale: number }
	| { readonly kind: 'set-reading'; readonly reading: ViewportReading }
	| {
			readonly kind: 'fit';
			readonly bounds: { readonly min: Vec3; readonly max: Vec3 };
			readonly rect: ViewportRect;
			readonly paddingFraction?: number;
	  }
	| { readonly kind: 'bring-into-view'; readonly target: Vec3; readonly targetPlaneHeightMeters?: number };

export const VIEWING_INTENT_REFUSALS = [
	'invalid-intent',
	'already-settled',
	'unsupported-in-plan-reading',
	'invalid-viewport'
] as const;

export type ViewingIntentRefusal = (typeof VIEWING_INTENT_REFUSALS)[number];

export type ViewingIntentResult =
	| { readonly kind: 'accepted'; readonly state: ViewportCameraState }
	| { readonly kind: 'rejected'; readonly state: ViewportCameraState; readonly code: ViewingIntentRefusal; readonly message: string };

export type ViewportSourceRebase =
	| { readonly kind: 'unchanged'; readonly state: ViewportCameraState }
	| {
			readonly kind: 'rebased';
			readonly state: ViewportCameraState;
			readonly previousSourceRevision: string;
			/** The settled reading and pose were carried over: an install never moves or refits the view. */
			readonly posePreserved: true;
	  }
	| { readonly kind: 'refused'; readonly state: ViewportCameraState; readonly reason: 'invalid-source-revision'; readonly message: string };

export type ProjectWorldResult =
	| {
			readonly kind: 'projected';
			readonly css: readonly [number, number];
			readonly ndcDepth: number;
			readonly visibility: 'visible' | 'outside-frame' | 'clipped' | 'behind';
	  }
	| {
			readonly kind: 'failed';
			readonly code: 'invalid-point' | 'stale-evaluation' | 'non-finite-projection';
			readonly message: string;
	  };

export type PointerRay = {
	/** Project-world origin: the ray's point on the near plane, so orthographic origins legitimately vary. */
	readonly origin: Vec3;
	readonly direction: Vec3;
};

export type PointerRayResult =
	| { readonly kind: 'ray'; readonly ray: PointerRay }
	| { readonly kind: 'failed'; readonly code: 'invalid-css-point' | 'invalid-viewport' | 'stale-evaluation' | 'degenerate-ray'; readonly message: string };

export type WorkingPlaneHit =
	| {
			readonly kind: 'intersected';
			readonly worldPoint: Vec3;
			/** In-plane coordinates in meters relative to the plane origin, on the plane's own axes. */
			readonly local: { readonly x: number; readonly y: number };
			readonly distanceMeters: number;
	  }
	| {
			readonly kind: 'failed';
			readonly code: 'parallel' | 'behind' | 'outside-supported-domain' | 'invalid-frame' | 'stale-evaluation';
			readonly message: string;
	  };

function isFiniteNumber(value: number): boolean {
	return typeof value === 'number' && Number.isFinite(value);
}

function isFinitePair(value: readonly [number, number] | undefined): boolean {
	return value !== undefined && isFiniteNumber(value[0]) && isFiniteNumber(value[1]);
}

function clamp(value: number, minimum: number, maximum: number): number {
	return Math.min(maximum, Math.max(minimum, value));
}

function smoothstep(value: number): number {
	const amount = clamp(value, 0, 1);
	return amount * amount * (3 - 2 * amount);
}

/** Validate a viewport rectangle: finite geometry, positive extent, positive DPR. */
export function validateViewportRect(input: unknown): { valid: boolean; issues: ViewportIssue[]; rect?: ViewportRect } {
	const issues: ViewportIssue[] = [];
	if (typeof input !== 'object' || input === null || Array.isArray(input)) {
		return {
			valid: false,
			issues: [{ path: '$', code: 'not-an-object', message: 'the viewport rectangle must be an object' }]
		};
	}
	const record = input as Record<string, unknown>;
	const numberAt = (key: string): number | null => {
		const value = record[key];
		if (typeof value !== 'number' || !Number.isFinite(value)) {
			issues.push({ path: `$.${key}`, code: 'non-finite-number', message: `$.${key} must be a finite number` });
			return null;
		}
		return value;
	};
	const left = numberAt('left');
	const top = numberAt('top');
	const width = numberAt('width');
	const height = numberAt('height');
	const devicePixelRatio = numberAt('devicePixelRatio');
	// A **zero** extent is the hidden viewport, not a malformed rectangle: the interfaces
	// contract requires an unavailable result rather than a division by zero, and that
	// branch is only reachable when zero passes the shape check (`isHiddenViewport`).
	// A **negative** extent names no drawable area at all and stays invalid.
	if (width !== null && width < 0) {
		issues.push({ path: '$.width', code: 'out-of-range', message: '$.width must not be negative' });
	}
	if (height !== null && height < 0) {
		issues.push({ path: '$.height', code: 'out-of-range', message: '$.height must not be negative' });
	}
	if (devicePixelRatio !== null && devicePixelRatio <= 0) {
		issues.push({ path: '$.devicePixelRatio', code: 'out-of-range', message: '$.devicePixelRatio must be positive' });
	}
	if (issues.length > 0 || left === null || top === null || width === null || height === null || devicePixelRatio === null) {
		return { valid: false, issues };
	}
	return { valid: true, issues: [], rect: { left, top, width, height, devicePixelRatio } };
}

/** `true` when a rectangle has no drawable area (a hidden viewport, not an invalid one). */
export function isHiddenViewport(input: ViewportRect): boolean {
	return input.width === 0 || input.height === 0;
}

/** Create a settled session state. The pose is authoritative input; nothing is derived at rest. */
export function createViewportCameraState(input: ViewportCameraInput): ViewportCameraState {
	return {
		outputId: input.outputId,
		sessionEpoch: input.sessionEpoch,
		sourceRevision: input.sourceRevision,
		reading: input.reading ?? '3d',
		pose: input.pose,
		lastReadingElevationRadians: clamp(input.pose.elevationRadians, -VIEWPORT_ELEVATION_LIMIT_RADIANS, VIEWPORT_ELEVATION_LIMIT_RADIANS),
		sceneRadiusMeters: Math.max(0, input.sceneRadiusMeters),
		displayGroundYMeters:
			typeof input.displayGroundYMeters === 'number' && Number.isFinite(input.displayGroundYMeters)
				? input.displayGroundYMeters
				: null,
		transition: null
	};
}

export function viewportEvaluationToken(state: ViewportCameraState, evaluationGeneration: number): ViewportEvaluationToken {
	return {
		outputId: state.outputId,
		sessionEpoch: state.sessionEpoch,
		sourceRevision: state.sourceRevision,
		evaluationGeneration
	};
}

export function sameEvaluationToken(left: ViewportEvaluationToken, right: ViewportEvaluationToken): boolean {
	return (
		left.outputId === right.outputId &&
		left.sessionEpoch === right.sessionEpoch &&
		left.sourceRevision === right.sourceRevision &&
		left.evaluationGeneration === right.evaluationGeneration
	);
}

/** Progress of a transition at an explicit clock, in `[0, 1]`. */
export function transitionProgress(transition: ViewportTransition, clockSeconds: number): number {
	if (!(transition.durationSeconds > 0)) return 1;
	return clamp((clockSeconds - transition.startSeconds) / transition.durationSeconds, 0, 1);
}

/**
 * Settle a finished transition. A transition that has run its clock is applied
 * exactly once: the reading becomes the transition's destination and its
 * destination pose becomes the settled pose, so a later evaluation cannot drift
 * from the declared endpoint.
 */
export function advanceViewport(state: ViewportCameraState, clockSeconds: number): ViewportCameraState {
	const transition = state.transition;
	if (transition === null) return state;
	if (transitionProgress(transition, clockSeconds) < 1) return state;
	return {
		...state,
		reading: transition.to,
		pose: transition.toPose,
		lastReadingElevationRadians:
			transition.to === '3d'
				? clamp(transition.toPose.elevationRadians, -VIEWPORT_ELEVATION_LIMIT_RADIANS, VIEWPORT_ELEVATION_LIMIT_RADIANS)
				: state.lastReadingElevationRadians,
		transition: null
	};
}

/**
 * Snap an azimuth to the nearest quarter turn, with a deterministic tie rule:
 * exactly between two detents the **lower** normalized detent wins, so the
 * settlement never depends on floating-point noise or call order.
 */
export function nearestQuarterTurn(azimuthRadians: number): number {
	const quadrant = HALF_PI;
	const raw = azimuthRadians / quadrant;
	const lower = Math.floor(raw);
	const fraction = raw - lower;
	const detent = fraction < 0.5 ? lower : fraction > 0.5 ? lower + 1 : lower;
	return detent * quadrant;
}

/**
 * The view "up" vector for a reading: project +Y in 3D, the plan's own north at the
 * top-down endpoint. Plan's up is the **limit** the projected world +Y approaches as
 * the view passes overhead, not its negation: at azimuth 0, Plan reads right +X and up
 * −Z, so flipping the reading never rolls the drawing 180°.
 */
function upForReading(reading: ViewportReading, azimuthRadians: number): Vec3 {
	if (reading === '3d') return [0, 1, 0];
	return [-Math.sin(azimuthRadians), 0, -Math.cos(azimuthRadians)];
}

/**
 * The view up for an actual pose.
 *
 * Project +Y is the 3D convention, but it is degenerate exactly at the top-down
 * endpoint, so the plan's own north carries that endpoint (and only the elevation
 * the 3D range clamps at, where a horizontal up is the stable choice anyway).
 */
function viewUpForPose(pose: InspectionPose): Vec3 {
	return pose.elevationRadians >= VIEWPORT_ELEVATION_LIMIT_RADIANS
		? upForReading('plan', pose.azimuthRadians)
		: upForReading('3d', pose.azimuthRadians);
}

/** Target → eye direction from the pose. Positive elevation puts the camera above the target plane. */
function poseDirection(pose: InspectionPose): Vec3 {
	const cosElevation = Math.cos(pose.elevationRadians);
	return [Math.sin(pose.azimuthRadians) * cosElevation, Math.sin(pose.elevationRadians), Math.cos(pose.azimuthRadians) * cosElevation];
}

/** The perspective distance that fills the target plane with `targetPlaneHeightMeters`. */
function perspectiveDistanceMeters(targetPlaneHeightMeters: number): number {
	return targetPlaneHeightMeters / 2 / Math.tan(VIEWPORT_REFERENCE_FOV_Y_RADIANS / 2);
}

function depthRange(distanceMeters: number, sceneRadiusMeters: number): { near: number; far: number; clamped: boolean } {
	const rawNear = distanceMeters - Math.max(sceneRadiusMeters, VIEWPORT_NEAR_FLOOR_METERS);
	const near = Math.max(VIEWPORT_NEAR_FLOOR_METERS, rawNear);
	const far = Math.max(near + VIEWPORT_NEAR_FLOOR_METERS, distanceMeters + sceneRadiusMeters);
	return { near, far, clamped: rawNear < VIEWPORT_NEAR_FLOOR_METERS };
}

/** R217.S19 — the display ground reaches this many target-plane extents. */
export const VIEWPORT_GROUND_REACH_EXTENTS = 24;
/**
 * R217.S19 — and at least this many eye heights above the display ground. The
 * plan's 64 left a 13–15 CSS px band below the horizon at the 54° reference FOV;
 * 96 keeps it within 12 px at 900 px (amended plan §3a row 2).
 */
export const VIEWPORT_GROUND_REACH_EYE_HEIGHTS = 96;
/** R217.S19 — the near plane sits this fraction of the nearest visible ground depth. */
export const VIEWPORT_GROUND_NEAR_FRACTION = 0.9;

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
		VIEWPORT_GROUND_REACH_EYE_HEIGHTS * input.eyeHeightMeters
	);
}

/**
 * R217.S19 — the clip range that keeps a display ground visible.
 *
 * The scene-sphere range clipped the finite ground twice: the far plane cut it in
 * a straight line (D21) and, at a low orbit, the near plane cut the ground at the
 * frame's bottom (D28). Far reaches the specified ground distance; near never
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
	}
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
		Math.min(distanceMeters - sceneRadiusMeters, VIEWPORT_GROUND_NEAR_FRACTION * groundNear)
	);
	return { near, far: Math.max(far, near + VIEWPORT_NEAR_FLOOR_METERS), clamped: base.clamped };
}

/** The pose a reading settles at. Plan snaps its azimuth and stands exactly over the target. */
function settledPoseFor(reading: ViewportReading, pose: InspectionPose, lastElevationRadians: number): InspectionPose {
	if (reading === 'plan') {
		return {
			target: pose.target,
			azimuthRadians: nearestQuarterTurn(pose.azimuthRadians),
			elevationRadians: HALF_PI,
			targetPlaneHeightMeters: pose.targetPlaneHeightMeters
		};
	}
	return {
		target: pose.target,
		azimuthRadians: pose.azimuthRadians,
		elevationRadians: clamp(lastElevationRadians, -VIEWPORT_ELEVATION_LIMIT_RADIANS, VIEWPORT_ELEVATION_LIMIT_RADIANS),
		targetPlaneHeightMeters: pose.targetPlaneHeightMeters
	};
}

/** The interpolated pose and orthographic weight at a transition progress. */
function transitionFrame(
	transition: ViewportTransition,
	progress: number
): { pose: InspectionPose; orthographicWeight: number } {
	const eased = smoothstep(progress);
	const orthographicWeight = transition.from === 'plan' ? 1 - eased : eased;
	// Azimuth takes the shortest path so a flip rotates the way a reading change implies.
	const rawDelta = transition.toPose.azimuthRadians - transition.fromPose.azimuthRadians;
	const wrapped = Math.atan2(Math.sin(rawDelta), Math.cos(rawDelta));
	return {
		pose: {
			target: lerpVec3(transition.fromPose.target, transition.toPose.target, eased),
			azimuthRadians: transition.fromPose.azimuthRadians + wrapped * eased,
			elevationRadians: lerpNumber(transition.fromPose.elevationRadians, transition.toPose.elevationRadians, eased),
			targetPlaneHeightMeters: lerpNumber(
				transition.fromPose.targetPlaneHeightMeters,
				transition.toPose.targetPlaneHeightMeters,
				eased
			)
		},
		orthographicWeight
	};
}

function unavailable(reason: ViewportEvaluationRefusal, path: string, code: string, message: string): ViewportEvaluationResult {
	return { kind: 'unavailable', reason, issues: [{ path, code, message }] };
}

function qualifyWorkingPlane(plane: WorkingPlane | null | undefined): WorkingPlaneQualification {
	if (plane === null || plane === undefined) return { kind: 'unavailable', reason: 'no-plane-supplied' };
	if (!isFiniteVec3(plane.originMeters) || !isFiniteVec3(plane.normal) || !isFiniteNumber(plane.yawRadians)) {
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
	workingPlane?: WorkingPlane | null
): ViewportEvaluationResult {
	const validation = validateViewportRect(rectInput);
	if (!validation.valid || validation.rect === undefined) {
		return unavailable(
			'invalid-viewport',
			'$.rect',
			'invalid-viewport',
			validation.issues[0]?.message ?? 'the viewport rectangle is not valid'
		);
	}
	const rect = validation.rect;
	if (isHiddenViewport(rect)) {
		return unavailable(
			'hidden-viewport',
			'$.rect',
			'hidden-viewport',
			'a viewport with no drawable area has no output; it is not projected and never divides by a zero extent'
		);
	}

	const transition = state.transition;
	const progress = transition === null ? 1 : transitionProgress(transition, clockSeconds);
	const frame =
		transition === null
			? {
					pose: state.pose,
					orthographicWeight: state.reading === 'plan' ? 1 : 0
				}
			: transitionFrame(transition, progress);
	const pose = frame.pose;
	const orthographicWeight = frame.orthographicWeight;

	// The realized reading is derived from the family weight alone, so a settled
	// endpoint is the same thing at a clock past the transition as at its exact end.
	const realizedReading: ViewportReading | null = orthographicWeight >= 1 ? 'plan' : orthographicWeight <= 0 ? '3d' : null;
	const up = viewUpForPose(pose);
	const direction = poseDirection(pose);

	// The projective family: the camera retreats along the interpolated view direction
	// while the perspective half-angle is recomputed from that distance, so the visible
	// extent at the target plane stays exactly `targetPlaneHeightMeters` for every weight.
	// `w = 1` is the exact orthographic matrix at the plan eye distance.
	const orthographic = orthographicWeight >= 1;
	const halfHeightMeters = pose.targetPlaneHeightMeters / 2;
	const distanceMeters = orthographic
		? VIEWPORT_PLAN_EYE_DISTANCE_METERS
		: perspectiveDistanceMeters(pose.targetPlaneHeightMeters) / (1 - orthographicWeight);
	if (!Number.isFinite(distanceMeters) || distanceMeters <= 0) {
		return unavailable('singular-projection', '$.pose', 'singular-projection', 'the pose has no finite view distance');
	}
	const tanHalfFov = halfHeightMeters / distanceMeters;
	const eye = addVec3(pose.target, scaleVec3(direction, distanceMeters));

	const viewMatrix = lookAtMatrix(eye, pose.target, up);
	if (viewMatrix === null) {
		return unavailable(
			'degenerate-view',
			'$.pose',
			'degenerate-view',
			'the pose has no non-degenerate view basis: the target plane and the view direction are parallel'
		);
	}

	const aspect = rect.width / rect.height;
	const displayGroundY = state.displayGroundYMeters ?? null;
	const depth =
		orthographic || displayGroundY === null
			? depthRange(distanceMeters, state.sceneRadiusMeters)
			: groundDepthRange(distanceMeters, state.sceneRadiusMeters, {
					eyeHeightMeters: eye[1] - displayGroundY,
					elevationRadians: pose.elevationRadians,
					halfFovRadians: Math.atan(tanHalfFov),
					reachMeters: viewportGroundReachMeters({
						targetPlaneHeightMeters: pose.targetPlaneHeightMeters,
						aspect,
						eyeHeightMeters: eye[1] - displayGroundY
					})
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
			'the view or projection matrix is singular, so no inverse exists for rays or overlays'
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
			message: 'the near plane was clamped to the near floor because the scene radius reaches the camera'
		});
	}
	if (transition !== null && progress < 1) {
		diagnostics.push({
			code: 'reading-transition-in-flight',
			message: `the ${transition.from}→${transition.to} reading transition is in flight and settles at its own clock`
		});
	}

	return {
		kind: 'evaluated',
		evaluation: {
			token: viewportEvaluationToken(state, evaluationGeneration),
			rect,
			settledReading: state.reading,
			renderedReading: transition !== null && progress < 1 ? 'transition' : (realizedReading ?? state.reading),
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
			diagnostics
		}
	};
}

function reject(state: ViewportCameraState, code: ViewingIntentRefusal, message: string): ViewingIntentResult {
	return { kind: 'rejected', state, code, message };
}

function accept(state: ViewportCameraState): ViewingIntentResult {
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
function withPose(state: ViewportCameraState, pose: InspectionPose): ViewportCameraState {
	const lastReadingElevationRadians =
		state.reading === '3d'
			? clamp(pose.elevationRadians, -VIEWPORT_ELEVATION_LIMIT_RADIANS, VIEWPORT_ELEVATION_LIMIT_RADIANS)
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
						toPose: settledPoseFor(transition.to, pose, lastReadingElevationRadians)
					}
	};
}

/**
 * Submit one viewing intent and get the next session state.
 *
 * The state is advanced first, so an intent submitted during a flip is applied to
 * the transition's declared endpoint rather than to a half-way pose. Every realised
 * matrix still comes from `evaluateViewport`: this function moves the pose, never a
 * shell tween pose and never a renderer Camera.
 */
export function requestViewingIntent(
	state: ViewportCameraState,
	intent: ViewingIntent,
	clockSeconds: number
): ViewingIntentResult {
	const settled = advanceViewport(state, clockSeconds);
	switch (intent.kind) {
		case 'pan': {
			if (!isFinitePair(intent.deltaCss)) {
				return reject(settled, 'invalid-intent', 'a pan delta must be a finite CSS-pixel pair');
			}
			const rectValidation = validateViewportRect(intent.rect);
			if (!rectValidation.valid || rectValidation.rect === undefined || isHiddenViewport(rectValidation.rect)) {
				return reject(settled, 'invalid-viewport', 'a pan is expressed in CSS pixels and needs the rect that produced them');
			}
			const rect = rectValidation.rect;
			// Only the direction matters for the basis, so it holds in both readings.
			const eye = addVec3(settled.pose.target, poseDirection(settled.pose));
			const basis = viewScreenBasis(eye, settled.pose.target, viewUpForPose(settled.pose));
			if (basis === null) {
				return reject(settled, 'invalid-intent', 'the settled reading has no screen basis to pan in');
			}
			const metersPerPixel = settled.pose.targetPlaneHeightMeters / rect.height;
			const delta = addVec3(
				scaleVec3(basis.right, -intent.deltaCss[0] * metersPerPixel),
				scaleVec3(basis.up, intent.deltaCss[1] * metersPerPixel)
			);
			return accept(withPose(settled, { ...settled.pose, target: addVec3(settled.pose.target, delta) }));
		}
		case 'orbit': {
			if (!isFiniteNumber(intent.deltaAzimuthRadians) || !isFiniteNumber(intent.deltaElevationRadians)) {
				return reject(settled, 'invalid-intent', 'an orbit delta must be a finite angle in radians');
			}
			if (settled.reading === 'plan' && intent.deltaElevationRadians !== 0) {
				return reject(
					settled,
					'unsupported-in-plan-reading',
					'the Plan reading is exactly orthographic and stands over its target: elevation is not a degree of freedom here'
				);
			}
			const azimuth = settled.pose.azimuthRadians + intent.deltaAzimuthRadians;
			if (settled.reading === 'plan') {
				return accept(withPose(settled, { ...settled.pose, azimuthRadians: azimuth }));
			}
			const elevation = clamp(
				settled.pose.elevationRadians + intent.deltaElevationRadians,
				-VIEWPORT_ELEVATION_LIMIT_RADIANS,
				VIEWPORT_ELEVATION_LIMIT_RADIANS
			);
			return accept(withPose(settled, { ...settled.pose, azimuthRadians: azimuth, elevationRadians: elevation }));
		}
		case 'zoom': {
			if (!isFiniteNumber(intent.scale) || intent.scale <= 0) {
				return reject(settled, 'invalid-intent', 'a zoom scale must be a finite positive multiplier');
			}
			const targetPlaneHeightMeters = clamp(
				settled.pose.targetPlaneHeightMeters * intent.scale,
				VIEWPORT_TARGET_PLANE_MIN_METERS,
				VIEWPORT_TARGET_PLANE_MAX_METERS
			);
			return accept(withPose(settled, { ...settled.pose, targetPlaneHeightMeters }));
		}
		case 'set-reading': {
			if (!VIEWPORT_READINGS.includes(intent.reading)) {
				return reject(settled, 'invalid-intent', `"${intent.reading}" is not a declared viewport reading`);
			}
			if (intent.reading === settled.reading && settled.transition === null) {
				return reject(settled, 'already-settled', `the viewport already reads ${intent.reading}`);
			}
			const toPose = settledPoseFor(intent.reading, settled.pose, settled.lastReadingElevationRadians);
			return accept({
				...settled,
				transition: {
					from: settled.reading,
					to: intent.reading,
					fromPose: settled.pose,
					toPose,
					startSeconds: clockSeconds,
					durationSeconds: VIEWPORT_READING_TRANSITION_SECONDS
				}
			});
		}
		case 'fit': {
			const rectValidation = validateViewportRect(intent.rect);
			if (!rectValidation.valid || rectValidation.rect === undefined || isHiddenViewport(rectValidation.rect)) {
				return reject(settled, 'invalid-viewport', 'Fit needs a drawable viewport rectangle');
			}
			if (!isFiniteVec3(intent.bounds?.min) || !isFiniteVec3(intent.bounds?.max)) {
				return reject(settled, 'invalid-intent', 'Fit needs finite bounds');
			}
			const { min, max } = intent.bounds;
			if (min[0] > max[0] || min[1] > max[1] || min[2] > max[2]) {
				return reject(settled, 'invalid-intent', 'Fit bounds must be ordered: min is not above max on any axis');
			}
			const padding = clamp(intent.paddingFraction ?? VIEWPORT_FIT_PADDING_FRACTION, 0, 0.45);
			const rect = rectValidation.rect;
			const usable = 1 - 2 * padding;
			const width = max[0] - min[0];
			const height = max[1] - min[1];
			const depth = max[2] - min[2];
			// The framed extent is the reading's own: Plan frames X/Z, 3D frames height plus the
			// horizontal diagonal, which is the extent a perspective view can bring into frame.
			const horizontal = settled.reading === 'plan' ? width : Math.hypot(width, depth);
			const vertical = settled.reading === 'plan' ? depth : height;
			const aspect = rect.width / rect.height;
			const targetPlaneHeightMeters = clamp(
				Math.max(vertical / usable, horizontal / aspect / usable, VIEWPORT_TARGET_PLANE_MIN_METERS),
				VIEWPORT_TARGET_PLANE_MIN_METERS,
				VIEWPORT_TARGET_PLANE_MAX_METERS
			);
			const target: Vec3 = [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2];
			return accept(withPose(settled, { ...settled.pose, target, targetPlaneHeightMeters }));
		}
		case 'bring-into-view': {
			if (!isFiniteVec3(intent.target)) {
				return reject(settled, 'invalid-intent', 'Bring into view needs a finite project-world target');
			}
			if (intent.targetPlaneHeightMeters !== undefined) {
				if (!isFiniteNumber(intent.targetPlaneHeightMeters) || intent.targetPlaneHeightMeters <= 0) {
					return reject(settled, 'invalid-intent', 'a declared target-plane height must be a finite positive number of meters');
				}
				const targetPlaneHeightMeters = clamp(
					intent.targetPlaneHeightMeters,
					VIEWPORT_TARGET_PLANE_MIN_METERS,
					VIEWPORT_TARGET_PLANE_MAX_METERS
				);
				return accept(withPose(settled, { ...settled.pose, target: intent.target, targetPlaneHeightMeters }));
			}
			return accept(withPose(settled, { ...settled.pose, target: intent.target }));
		}
		default: {
			return reject(settled, 'invalid-intent', 'the intent is not a declared viewing intent');
		}
	}
}

/**
 * Move the session to a new current source.
 *
 * An install is not a camera move. The output, session, settled reading, pose and
 * target-plane scale are carried over exactly, so the host re-acquires inspection at
 * the current pose and the view neither moves nor refits. Identical content is
 * `unchanged` (the Undo-to-identical-contents case), and an in-flight flip settles to
 * its declared endpoint first so a content change never leaves a half-flip behind.
 * Ownership itself is not rebased here: the ticket protocol owns the claim.
 */
export function rebaseViewportSource(state: ViewportCameraState, sourceRevision: unknown): ViewportSourceRebase {
	if (typeof sourceRevision !== 'string' || sourceRevision.trim() === '' || /\s/.test(sourceRevision)) {
		return {
			kind: 'refused',
			state,
			reason: 'invalid-source-revision',
			message: 'a source revision must be a nonempty opaque identity'
		};
	}
	if (sourceRevision === state.sourceRevision) return { kind: 'unchanged', state };
	// An infinite clock is how "settle it now" reads through the one settling rule.
	const settled = advanceViewport(state, Number.POSITIVE_INFINITY);
	return {
		kind: 'rebased',
		state: { ...settled, sourceRevision },
		previousSourceRevision: state.sourceRevision,
		posePreserved: true
	};
}

/**
 * Project a project-world point through the evaluation's **own** matrices.
 *
 * Projection is not a membership or selection decision: the returned visibility is
 * a framing fact (`visible`, `outside-frame`, `clipped`, `behind`), and membership
 * comes from the domain. A stale token refuses instead of projecting through a
 * superseded matrix.
 */
export function projectWorld(
	point: unknown,
	evaluation: ViewportEvaluation,
	expected: ViewportEvaluationToken
): ProjectWorldResult {
	if (!isFiniteVec3(point)) {
		return { kind: 'failed', code: 'invalid-point', message: 'the point must be a finite project-world triple in meters' };
	}
	if (!sameEvaluationToken(evaluation.token, expected)) {
		return {
			kind: 'failed',
			code: 'stale-evaluation',
			message: 'the supplied evaluation is not the expected one; evaluate the viewport again before projecting'
		};
	}
	const clip = transformPoint(evaluation.viewProjectionMatrix, point);
	if (!clip.every((component) => Number.isFinite(component))) {
		return { kind: 'failed', code: 'non-finite-projection', message: 'the projection produced a non-finite component' };
	}
	const w = clip[3];
	const rect = evaluation.rect;
	if (w === 0) {
		return { kind: 'failed', code: 'non-finite-projection', message: 'the point projects with a zero clip-space w' };
	}
	const ndcX = clip[0] / w;
	const ndcY = clip[1] / w;
	const ndcZ = clip[2] / w;
	// A point behind a perspective camera has a negative `w`; the orthographic endpoint has no
	// behind, so every point projects (which is what an orthographic Plan means).
	const behind = evaluation.orthographicWeight < 1 && w < 0;
	const visibility: 'visible' | 'outside-frame' | 'clipped' | 'behind' = behind
		? 'behind'
		: Math.abs(ndcX) > 1 || Math.abs(ndcY) > 1
			? 'outside-frame'
			: ndcZ < -1 || ndcZ > 1
				? 'clipped'
				: 'visible';
	return {
		kind: 'projected',
		css: [(ndcX * 0.5 + 0.5) * rect.width + rect.left, (0.5 - ndcY * 0.5) * rect.height + rect.top],
		ndcDepth: ndcZ,
		visibility
	};
}

/**
 * The project-world ray through one CSS point, from the **same** rendered
 * matrices the meshes were drawn with.
 *
 * The origin is the ray's point on the near plane, so an orthographic ray's origin
 * varies with the CSS point while its direction stays parallel; no separately
 * inferred FOV or pixels-per-meter transform exists to disagree with the render.
 */
export function pointerRay(
	cssPoint: unknown,
	evaluation: ViewportEvaluation,
	expected: ViewportEvaluationToken
): PointerRayResult {
	if (
		!Array.isArray(cssPoint) ||
		cssPoint.length !== 2 ||
		!isFiniteNumber(cssPoint[0] as number) ||
		!isFiniteNumber(cssPoint[1] as number)
	) {
		return { kind: 'failed', code: 'invalid-css-point', message: 'the CSS point must be a finite [x, y] pair' };
	}
	const rect = evaluation.rect;
	if (rect.width <= 0 || rect.height <= 0) {
		return { kind: 'failed', code: 'invalid-viewport', message: 'a viewport with no drawable area has no ray' };
	}
	if (!sameEvaluationToken(evaluation.token, expected)) {
		return {
			kind: 'failed',
			code: 'stale-evaluation',
			message: 'the supplied evaluation is not the expected one; evaluate the viewport again before casting a ray'
		};
	}
	const x = cssPoint[0] as number;
	const y = cssPoint[1] as number;
	const ndcX = ((x - rect.left) / rect.width) * 2 - 1;
	const ndcY = 1 - ((y - rect.top) / rect.height) * 2;
	const nearPoint = unproject(evaluation.inverseViewProjectionMatrix, ndcX, ndcY, -1);
	const farPoint = unproject(evaluation.inverseViewProjectionMatrix, ndcX, ndcY, 1);
	if (nearPoint === null || farPoint === null) {
		return { kind: 'failed', code: 'degenerate-ray', message: 'the ray could not be unprojected from the evaluation matrices' };
	}
	const direction = normalizeVec3(subtractVec3(farPoint, nearPoint));
	if (direction === null) {
		return { kind: 'failed', code: 'degenerate-ray', message: 'the unprojected ray has no direction' };
	}
	return { kind: 'ray', ray: { origin: nearPoint, direction } };
}

function unproject(inverseViewProjection: readonly number[], ndcX: number, ndcY: number, ndcZ: number): Vec3 | null {
	const clip: Vec3 = [ndcX, ndcY, ndcZ];
	const transformed = transformPoint(inverseViewProjection, clip);
	const w = transformed[3];
	if (w === 0 || !Number.isFinite(w)) return null;
	const point: Vec3 = [transformed[0] / w, transformed[1] / w, transformed[2] / w];
	return isFiniteVec3(point) ? point : null;
}

function planeAxes(plane: WorkingPlane): { right: Vec3; up: Vec3; normal: Vec3 } | null {
	const normal = normalizeVec3(plane.normal);
	if (normal === null) return null;
	const up = normalizeVec3([Math.sin(plane.yawRadians), 0, Math.cos(plane.yawRadians)]);
	if (up === null) return null;
	const right = normalizeVec3(crossVec3(up, normal));
	if (right === null) return null;
	return { right, up, normal };
}

/**
 * Intersect a ray with an explicit working plane.
 *
 * The plane is the caller's resolved frame — never the nearest Room, never inferred
 * from geometry. `parallel`, `behind` and `outside-supported-domain` are separate
 * answers, and the supported extent is supplied by the owning domain rather than
 * derived here.
 */
export function intersectWorkingPlane(
	ray: PointerRay,
	plane: WorkingPlane,
	evaluation: ViewportEvaluation,
	expected: ViewportEvaluationToken
): WorkingPlaneHit {
	if (!sameEvaluationToken(evaluation.token, expected)) {
		return {
			kind: 'failed',
			code: 'stale-evaluation',
			message: 'the supplied evaluation is not the expected one; evaluate the viewport again before intersecting a plane'
		};
	}
	if (!isFiniteVec3(ray.origin) || !isFiniteVec3(ray.direction)) {
		return { kind: 'failed', code: 'invalid-frame', message: 'the ray must have a finite origin and direction' };
	}
	const axes = planeAxes(plane);
	if (axes === null) {
		return {
			kind: 'failed',
			code: 'invalid-frame',
			message: 'the working plane has no usable basis: its normal or yaw is degenerate'
		};
	}
	const denominator = dotVec3(axes.normal, ray.direction);
	if (Math.abs(denominator) < 1e-9) {
		return { kind: 'failed', code: 'parallel', message: 'the ray is parallel to the working plane and never meets it' };
	}
	const distance = dotVec3(axes.normal, subtractVec3(plane.originMeters, ray.origin)) / denominator;
	if (distance < 0) {
		return {
			kind: 'failed',
			code: 'behind',
			message: 'the plane is behind the ray: the intersection lies at a negative distance'
		};
	}
	const worldPoint = addVec3(ray.origin, scaleVec3(ray.direction, distance));
	const offset = subtractVec3(worldPoint, plane.originMeters);
	const localX = dotVec3(offset, axes.right);
	const localY = dotVec3(offset, axes.up);
	const extent = plane.supportedLocalExtent;
	if (
		extent !== null &&
		(localX < Math.min(extent.min[0], extent.max[0]) ||
			localX > Math.max(extent.min[0], extent.max[0]) ||
			localY < Math.min(extent.min[1], extent.max[1]) ||
			localY > Math.max(extent.min[1], extent.max[1]))
	) {
		return {
			kind: 'failed',
			code: 'outside-supported-domain',
			message: 'the intersection lies outside the extent the plane owner supports'
		};
	}
	return { kind: 'intersected', worldPoint, local: { x: localX, y: localY }, distanceMeters: distance };
}
