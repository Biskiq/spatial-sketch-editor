import type { Vec3 } from '../scene-types';
import { CAMERA_FOV } from '../scene-types';

export const VIEWPORT_READINGS = ['3d', 'plan'] as const;

export type ViewportReading = (typeof VIEWPORT_READINGS)[number];

export const VIEWPORT_PROJECTION_KINDS = [
	'perspective-3d',
	'projective-transition',
	'plan-orthographic',
] as const;

export type ViewportProjectionKind = (typeof VIEWPORT_PROJECTION_KINDS)[number];

/** Declared duration of a reading flip. The evaluator uses an explicit clock, never a shell tween. */
export const VIEWPORT_READING_TRANSITION_SECONDS = 1.0;

/** The share of a flip, at its Plan end, where the pose is already overhead. */
export const VIEWPORT_READING_POSE_HOLD = 0.25;

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

export const HALF_PI = Math.PI / 2;

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
	/**
	 * An authored vertical field of view in degrees. When absent the
	 * Stage keeps its fixed 54° reference FOV and `targetPlaneHeightMeters` alone
	 * selects the dolly distance. When present the eye is placed at
	 * `targetPlaneHeightMeters / 2 / tan(fov / 2)`, so an authored View's exact
	 * eye, target and FOV evaluate through this one path. The authored value is
	 * the source of truth; nothing here derives a different FOV for the shell.
	 */
	readonly fovYDegrees?: number;
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
	readonly supportedLocalExtent: {
		readonly min: readonly [number, number];
		readonly max: readonly [number, number];
	} | null;
};

export type WorkingPlaneQualification =
	| { readonly kind: 'qualified'; readonly plane: WorkingPlane }
	| { readonly kind: 'unavailable'; readonly reason: 'no-plane-supplied' | 'invalid-plane' };

export type ViewportIssue = {
	readonly path: string;
	readonly code: string;
	readonly message: string;
};

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
	| {
			readonly kind: 'unavailable';
			readonly reason: ViewportEvaluationRefusal;
			readonly issues: readonly ViewportIssue[];
	  }
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
	 * The session's display-ground height, or `null` for none. It only
	 * widens the perspective clip range to the visible ground; it never enters scene
	 * bounds, Fit or the pose.
	 */
	readonly displayGroundYMeters?: number | null;
	/** The renderer’s finite environment ground, when it extends beyond the display mat. */
	readonly minimumGroundReachMeters?: number;
	readonly transition: ViewportTransition | null;
};

export type ViewportCameraInput = {
	readonly outputId: string;
	readonly sessionEpoch: string;
	readonly sourceRevision: string;
	readonly pose: InspectionPose;
	readonly sceneRadiusMeters: number;
	readonly reading?: ViewportReading;
	/** Optional session display ground; defaults to `null`. */
	readonly displayGroundYMeters?: number | null;
};

export type ViewingIntent =
	/** A CSS-pixel pan in the settled reading's target plane. */
	| {
			readonly kind: 'pan';
			readonly deltaCss: readonly [number, number];
			readonly rect: ViewportRect;
	  }
	| {
			readonly kind: 'orbit';
			readonly deltaAzimuthRadians: number;
			readonly deltaElevationRadians: number;
	  }
	| { readonly kind: 'zoom'; readonly scale: number; readonly anchor?: Vec3 }
	| { readonly kind: 'set-reading'; readonly reading: ViewportReading }
	| {
			readonly kind: 'fit';
			readonly bounds: { readonly min: Vec3; readonly max: Vec3 };
			readonly rect: ViewportRect;
			readonly paddingFraction?: number;
	  }
	/**
	 * Face a surface: place the eye directly outside it along `−look`
	 * and frame its bounds, ending in the 3D reading. `look` is the direction the
	 * camera looks (from the eye toward the surface), so the eye sits on the
	 * negative side of it. Layout supplies the frame; only camera-core builds a
	 * pose, so no UI component writes the camera.
	 */
	| {
			readonly kind: 'face';
			readonly bounds: { readonly min: Vec3; readonly max: Vec3 };
			readonly look: Vec3;
			readonly rect: ViewportRect;
			readonly paddingFraction?: number;
	  }
	| {
			readonly kind: 'bring-into-view';
			readonly target: Vec3;
			readonly targetPlaneHeightMeters?: number;
	  }
	/** Re-aim at a new target with the eye held exactly still. */
	| { readonly kind: 'aim'; readonly target: Vec3 }
	/** Install one exact authored View pose (eye, target, FOV). */
	| {
			readonly kind: 'set-view';
			readonly eye: Vec3;
			readonly target: Vec3;
			readonly fovYDegrees: number;
			/**
			 * Animate to the pose instead of installing it. The unfolded
			 * context returns to its exact entry pose through this flag, so the return
			 * uses the same generalised transition as `face` rather than a second
			 * interpolation path.
			 */
			readonly transition?: boolean;
	  }
	/** Move eye and target together, keeping aim and FOV. */
	| { readonly kind: 'lift'; readonly deltaMeters: number }
	/** Change the authored lens at a fixed eye and target. */
	| { readonly kind: 'lens'; readonly fovYDegrees: number }
	/**
	 * Experience review 1 — turn the view in place: the eye holds still while the
	 * aim yaws and pitches by bounded deltas (Look through drag).
	 */
	| { readonly kind: 'turn'; readonly deltaYawRadians: number; readonly deltaPitchRadians: number }
	/** Experience review 1 — step the eye and target together along the level aim (Look through scroll). */
	| { readonly kind: 'step'; readonly deltaMeters: number }
	| { readonly kind: 'truck'; readonly deltaRightMeters: number; readonly deltaUpMeters: number };

export const VIEWING_INTENT_REFUSALS = [
	'invalid-intent',
	'already-settled',
	'unsupported-in-plan-reading',
	'invalid-viewport',
] as const;

export type ViewingIntentRefusal = (typeof VIEWING_INTENT_REFUSALS)[number];

export type ViewingIntentResult =
	| { readonly kind: 'accepted'; readonly state: ViewportCameraState }
	| {
			readonly kind: 'rejected';
			readonly state: ViewportCameraState;
			readonly code: ViewingIntentRefusal;
			readonly message: string;
	  };

export type ViewportSourceRebase =
	| { readonly kind: 'unchanged'; readonly state: ViewportCameraState }
	| {
			readonly kind: 'rebased';
			readonly state: ViewportCameraState;
			readonly previousSourceRevision: string;
			/** The settled reading and pose were carried over: an install never moves or refits the view. */
			readonly posePreserved: true;
	  }
	| {
			readonly kind: 'refused';
			readonly state: ViewportCameraState;
			readonly reason: 'invalid-source-revision';
			readonly message: string;
	  };

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
	| {
			readonly kind: 'failed';
			readonly code:
				| 'invalid-css-point'
				| 'invalid-viewport'
				| 'stale-evaluation'
				| 'degenerate-ray';
			readonly message: string;
	  };

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
			readonly code:
				| 'parallel'
				| 'behind'
				| 'outside-supported-domain'
				| 'invalid-frame'
				| 'stale-evaluation';
			readonly message: string;
	  };

/** The largest single turn a `turn` intent accepts; a drag sends many small ones. */
export const VIEWPORT_TURN_STEP_LIMIT_RADIANS = Math.PI / 2;

/** The display ground reaches this many target-plane extents. */
export const VIEWPORT_GROUND_REACH_EXTENTS = 24;

/**
 * And at least this many eye heights above the display ground. The
 * plan's 64 left a 13–15 CSS px band below the horizon at the 54° reference FOV;
 * 96 keeps it within 12 px at 900 px (amended plan §3a row 2).
 */
export const VIEWPORT_GROUND_REACH_EYE_HEIGHTS = 96;

/** The near plane sits this fraction of the nearest visible ground depth. */
export const VIEWPORT_GROUND_NEAR_FRACTION = 0.9;
