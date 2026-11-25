import type { Vec3 } from '../scene-types';
import { addVec3, dotVec3, isFiniteVec3, scaleVec3, subtractVec3, viewScreenBasis } from '../viewport-math';
import { accept, perspectiveDistanceMeters, reject, settledPoseFor, withPose } from './evaluate';
import { aimPoseAtTarget, eyeOfInspectionPose, facePoseFromBounds, inspectionPoseFromView, liftPose, poseDirection, setPoseLens, stepPose, truckPose, turnPose, viewUpForPose } from './pose';
import { advanceViewport, clamp, isFiniteNumber, isFinitePair, isHiddenViewport, validateViewportRect } from './state';
import type { ViewingIntent, ViewingIntentResult, ViewportCameraState } from './types';
import { VIEWPORT_ELEVATION_LIMIT_RADIANS, VIEWPORT_FIT_PADDING_FRACTION, VIEWPORT_READINGS, VIEWPORT_READING_TRANSITION_SECONDS, VIEWPORT_TARGET_PLANE_MAX_METERS, VIEWPORT_TARGET_PLANE_MIN_METERS } from './types';

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
			if (intent.anchor !== undefined && settled.reading === '3d' && settled.transition === null) {
				if (!isFiniteVec3(intent.anchor)) return reject(settled, 'invalid-intent', 'Zoom anchor must be finite.');
				const eye = eyeOfInspectionPose(settled.pose);
				const backward = poseDirection(settled.pose);
				const depth = dotVec3(subtractVec3(eye, intent.anchor), backward);
				const hitExtent = depth / perspectiveDistanceMeters(1, settled.pose.fovYDegrees);
				if (hitExtent > 0 && Number.isFinite(hitExtent)) {
					// An off-plane hit can already be outside the framing bounds.
					// Allow movement back toward the range without snapping the eye to it.
					const nextHitExtent = clamp(
						hitExtent * intent.scale,
						Math.min(hitExtent, VIEWPORT_TARGET_PLANE_MIN_METERS),
						Math.max(hitExtent, VIEWPORT_TARGET_PLANE_MAX_METERS)
					);
					if (nextHitExtent === hitExtent) return accept(settled);
					const extent = clamp(nextHitExtent, VIEWPORT_TARGET_PLANE_MIN_METERS, VIEWPORT_TARGET_PLANE_MAX_METERS);
					const nextEye = addVec3(intent.anchor, scaleVec3(subtractVec3(eye, intent.anchor), nextHitExtent / hitExtent));
					const target = subtractVec3(nextEye, scaleVec3(backward, perspectiveDistanceMeters(extent, settled.pose.fovYDegrees)));
					return accept(withPose(settled, { ...settled.pose, target, targetPlaneHeightMeters: extent }));
				}
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
			// The framed extent is the declared endpoint reading's own: Plan frames X/Z, 3D frames
			// height plus the horizontal diagonal, which is the extent a perspective view can bring into frame.
			const reading = settled.transition?.to ?? settled.reading;
			const horizontal = reading === 'plan' ? width : Math.hypot(width, depth);
			const vertical = reading === 'plan' ? depth : height;
			const aspect = rect.width / rect.height;
			const targetPlaneHeightMeters = clamp(
				Math.max(vertical / usable, horizontal / aspect / usable, VIEWPORT_TARGET_PLANE_MIN_METERS),
				VIEWPORT_TARGET_PLANE_MIN_METERS,
				VIEWPORT_TARGET_PLANE_MAX_METERS
			);
			const target: Vec3 = [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2];
			return accept(withPose(settled, { ...settled.pose, target, targetPlaneHeightMeters }));
		}
		case 'face': {
			const rectValidation = validateViewportRect(intent.rect);
			if (!rectValidation.valid || rectValidation.rect === undefined || isHiddenViewport(rectValidation.rect)) {
				return reject(settled, 'invalid-viewport', 'Face needs a drawable viewport rectangle');
			}
			const pose = facePoseFromBounds({
				bounds: intent.bounds,
				look: intent.look,
				rect: rectValidation.rect,
				paddingFraction: intent.paddingFraction,
				fovYDegrees: settled.pose.fovYDegrees
			});
			if (pose === null) {
				return reject(
					settled,
					'invalid-intent',
					'Face needs finite ordered bounds, a non-vertical look direction and a supported lens'
				);
			}
			// A face is always an **animated** posture change ending in 3D. Starting
			// from Plan reuses the reading flip's projective family; starting in 3D
			// uses the generalised in-place transition (orthographic weight 0). The
			// pose is camera-core's, never a pose supplied by the UI.
			return accept({
				...settled,
				transition: {
					from: settled.reading,
					to: '3d',
					fromPose: settled.pose,
					toPose: pose,
					startSeconds: clockSeconds,
					durationSeconds: VIEWPORT_READING_TRANSITION_SECONDS
				}
			});
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
		case 'aim': {
			if (!isFiniteVec3(intent.target)) {
				return reject(settled, 'invalid-intent', 'Aim needs a finite project-world target');
			}
			if (settled.reading === 'plan') {
				return reject(
					settled,
					'unsupported-in-plan-reading',
					'the Plan reading is orthographic and has no eye to hold; re-aim in 3D'
				);
			}
			const aimed = aimPoseAtTarget(settled.pose, intent.target);
			if (aimed === null) {
				return reject(settled, 'invalid-intent', 'That aim point is too close to the eye to place a view');
			}
			return accept(withPose(settled, aimed));
		}
		case 'set-view': {
			const pose = inspectionPoseFromView(intent);
			if (pose === null) {
				return reject(
					settled,
					'invalid-intent',
					'An exact View needs a finite eye and target, distinct from each other, and a supported vertical field of view'
				);
			}
			// Installing an authored View is a posture, not a reading flip: the
			// through-camera is the exact perspective the View authored.
			const lastReadingElevationRadians = clamp(
				pose.elevationRadians,
				-VIEWPORT_ELEVATION_LIMIT_RADIANS,
				VIEWPORT_ELEVATION_LIMIT_RADIANS
			);
			if (intent.transition === true) {
				// The unfolded context's return. The endpoint is exactly the
				// authored pose; only the route to it is animated, through the same
				// generalised in-place transition as `face`.
				return accept({
					...settled,
					lastReadingElevationRadians,
					transition: {
						from: settled.reading,
						to: '3d',
						fromPose: settled.pose,
						toPose: pose,
						startSeconds: clockSeconds,
						durationSeconds: VIEWPORT_READING_TRANSITION_SECONDS
					}
				});
			}
			return accept({
				...settled,
				reading: '3d',
				pose,
				lastReadingElevationRadians,
				transition: null
			});
		}
		case 'lift': {
			if (!isFiniteNumber(intent.deltaMeters)) {
				return reject(settled, 'invalid-intent', 'A height change must be a finite number of meters');
			}
			const lifted = liftPose(settled.pose, intent.deltaMeters);
			if (lifted === null) {
				return reject(settled, 'invalid-intent', 'That height change leaves the view degenerate');
			}
			return accept(withPose(settled, lifted));
		}
		case 'lens': {
			if (!isFiniteNumber(intent.fovYDegrees) || intent.fovYDegrees <= 0 || intent.fovYDegrees >= 180) {
				return reject(settled, 'invalid-intent', 'A lens must be a finite vertical field of view between 0 and 180 degrees');
			}
			if (settled.reading === 'plan') {
				return reject(
					settled,
					'unsupported-in-plan-reading',
					'the Plan reading is orthographic and has no lens; choose a lens in 3D'
				);
			}
			const lensed = setPoseLens(settled.pose, intent.fovYDegrees);
			if (lensed === null) {
				return reject(settled, 'invalid-intent', 'That lens cannot be placed at this eye and target');
			}
			return accept(withPose(settled, lensed));
		}
		case 'turn':
		case 'step':
		case 'truck': {
			if (settled.reading === 'plan') {
				return reject(
					settled,
					'unsupported-in-plan-reading',
					'the Plan reading is orthographic and has no perspective eye to move; look through in 3D'
				);
			}
			const moved =
				intent.kind === 'turn'
					? turnPose(settled.pose, intent.deltaYawRadians, intent.deltaPitchRadians)
					: intent.kind === 'step'
						? stepPose(settled.pose, intent.deltaMeters)
						: truckPose(settled.pose, intent.deltaRightMeters, intent.deltaUpMeters);
			if (moved === null) {
				return reject(settled, 'invalid-intent', 'Camera movement needs a finite delta within its supported range');
			}
			return accept(withPose(settled, moved));
		}
		default: {
			return reject(settled, 'invalid-intent', 'the intent is not a declared viewing intent');
		}
	}
}
