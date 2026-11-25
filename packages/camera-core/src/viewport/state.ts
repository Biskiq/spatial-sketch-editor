import type { ViewportCameraInput, ViewportCameraState, ViewportEvaluationToken, ViewportIssue, ViewportRect, ViewportTransition } from './types';
import { HALF_PI, VIEWPORT_ELEVATION_LIMIT_RADIANS } from './types';

export function isFiniteNumber(value: number): boolean {
	return typeof value === 'number' && Number.isFinite(value);
}


export function isFinitePair(value: readonly [number, number] | undefined): boolean {
	return value !== undefined && isFiniteNumber(value[0]) && isFiniteNumber(value[1]);
}


export function clamp(value: number, minimum: number, maximum: number): number {
	return Math.min(maximum, Math.max(minimum, value));
}


export function smoothstep(value: number): number {
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
