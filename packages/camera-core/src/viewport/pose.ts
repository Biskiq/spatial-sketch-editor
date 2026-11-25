import type { Vec3 } from '../scene-types';
import { addVec3, crossVec3, dotVec3, isFiniteVec3, lengthVec3, normalizeVec3, scaleVec3, subtractVec3, viewScreenBasis } from '../viewport-math';
import { perspectiveDistanceMeters } from './evaluate';
import { clamp, isFiniteNumber } from './state';
import type { InspectionPose, PointerRay, ViewportReading, ViewportRect } from './types';
import { VIEWPORT_ELEVATION_LIMIT_RADIANS, VIEWPORT_FIT_PADDING_FRACTION, VIEWPORT_REFERENCE_FOV_Y_RADIANS, VIEWPORT_TARGET_PLANE_MAX_METERS, VIEWPORT_TARGET_PLANE_MIN_METERS, VIEWPORT_TURN_STEP_LIMIT_RADIANS } from './types';

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
export function viewUpForPose(pose: InspectionPose): Vec3 {
	return pose.elevationRadians >= VIEWPORT_ELEVATION_LIMIT_RADIANS
		? upForReading('plan', pose.azimuthRadians)
		: upForReading('3d', pose.azimuthRadians);
}


/** Target → eye direction from the pose. Positive elevation puts the camera above the target plane. */
export function poseDirection(pose: InspectionPose): Vec3 {
	const cosElevation = Math.cos(pose.elevationRadians);
	return [Math.sin(pose.azimuthRadians) * cosElevation, Math.sin(pose.elevationRadians), Math.cos(pose.azimuthRadians) * cosElevation];
}


/** The half-FOV an authored pose evaluates at; the reference FOV when it authored none. */
function _poseHalfFovRadians(pose: InspectionPose): number {
	return pose.fovYDegrees === undefined
		? VIEWPORT_REFERENCE_FOV_Y_RADIANS / 2
		: (pose.fovYDegrees * Math.PI) / 360;
}


export function poseFovIsValid(pose: InspectionPose): boolean {
	return (
		pose.fovYDegrees === undefined ||
		(isFiniteNumber(pose.fovYDegrees) && pose.fovYDegrees > 0 && pose.fovYDegrees < 180)
	);
}


/**
 * The authored vertical FOV a pose evaluates at, in degrees. A pose that
 * authored none reads the Stage's reference FOV.
 */
export function fovYDegreesOf(pose: InspectionPose): number {
	return pose.fovYDegrees ?? (VIEWPORT_REFERENCE_FOV_Y_RADIANS * 180) / Math.PI;
}


/**
 * The exact eye a perspective pose evaluates at. This is the same derivation
 * `evaluateViewport` uses; it is exported so a session can read the camera it
 * is looking through without re-implementing the projection.
 */
export function eyeOfInspectionPose(pose: InspectionPose): Vec3 {
	return addVec3(pose.target, scaleVec3(poseDirection(pose), perspectiveDistanceMeters(pose.targetPlaneHeightMeters, pose.fovYDegrees)));
}


/**
 * An exact authored View as an inspection pose.
 *
 * `eye` and `target` place the view direction and distance; `fovDegrees` is the
 * authored source of truth and sets the target-plane height so the evaluator
 * recovers exactly that eye. A degenerate view, an invalid FOV or a view whose
 * target-plane extent leaves the supported range refuses with `null` rather
 * than clamping a different camera into place.
 */
export function inspectionPoseFromView(input: {
	readonly eye: Vec3;
	readonly target: Vec3;
	readonly fovYDegrees: number;
}): InspectionPose | null {
	if (!isFiniteVec3(input.eye) || !isFiniteVec3(input.target)) return null;
	if (!isFiniteNumber(input.fovYDegrees) || input.fovYDegrees <= 0 || input.fovYDegrees >= 180) return null;
	const offset = subtractVec3(input.eye, input.target);
	const distance = lengthVec3(offset);
	if (!(distance > 1e-6)) return null;
	const direction = scaleVec3(offset, 1 / distance);
	const targetPlaneHeightMeters = 2 * distance * Math.tan((input.fovYDegrees * Math.PI) / 360);
	if (targetPlaneHeightMeters < VIEWPORT_TARGET_PLANE_MIN_METERS || targetPlaneHeightMeters > VIEWPORT_TARGET_PLANE_MAX_METERS) {
		return null;
	}
	return {
		target: [input.target[0], input.target[1], input.target[2]],
		azimuthRadians: Math.atan2(direction[0], direction[2]),
		elevationRadians: Math.asin(clamp(direction[1], -1, 1)),
		targetPlaneHeightMeters,
		fovYDegrees: input.fovYDegrees
	};
}


/**
 * Re-aim at a new target while the eye stays exactly where it is.
 * The authored FOV and the eye are preserved; only the direction and the
 * target-plane extent change. The Plan reading is orthographic and has no
 * eye to hold, so callers present a 3D pose.
 */
export function aimPoseAtTarget(pose: InspectionPose, target: Vec3): InspectionPose | null {
	if (!isFiniteVec3(target)) return null;
	const eye = eyeOfInspectionPose(pose);
	const offset = subtractVec3(eye, target);
	const distance = lengthVec3(offset);
	if (!(distance > 1e-6)) return null;
	const fovYDegrees = fovYDegreesOf(pose);
	const targetPlaneHeightMeters = 2 * distance * Math.tan((fovYDegrees * Math.PI) / 360);
	if (targetPlaneHeightMeters < VIEWPORT_TARGET_PLANE_MIN_METERS || targetPlaneHeightMeters > VIEWPORT_TARGET_PLANE_MAX_METERS) {
		return null;
	}
	const direction = scaleVec3(offset, 1 / distance);
	return {
		target: [target[0], target[1], target[2]],
		azimuthRadians: Math.atan2(direction[0], direction[2]),
		elevationRadians: Math.asin(clamp(direction[1], -1, 1)),
		targetPlaneHeightMeters,
		fovYDegrees
	};
}


/**
 * Re-aim at the direction of a Camera-owned pointer ray while the eye stays
 * exactly still and the existing focal distance is kept. Unlike a horizontal
 * target-plane intersection this works for level views and rays that point up.
 */
export function aimPoseAlongRay(pose: InspectionPose, ray: PointerRay): InspectionPose | null {
	const direction = normalizeVec3(ray.direction);
	if (direction === null) return null;
	const eye = eyeOfInspectionPose(pose);
	const distance = lengthVec3(subtractVec3(pose.target, eye));
	if (!(distance > 1e-6)) return null;
	return aimPoseAtTarget(pose, addVec3(eye, scaleVec3(direction, distance)));
}


/**
 * Construct an authored View at the clicked Floor point. An explicit subject
 * takes priority. Otherwise aim along the drag, or use the inspection heading
 * for a click or small pointer movement.
 */
export function viewPlacementPose(input: {
	readonly startFloorPoint: Vec3;
	readonly currentFloorPoint: Vec3;
	readonly aimPoint?: Vec3 | null;
	readonly floorDatumMeters: number;
	readonly fovYDegrees: number;
	readonly minimumDragMeters?: number;
	readonly defaultAzimuthRadians?: number;
	readonly eyeHeightMeters?: number;
	readonly targetHeightMeters?: number;
}): { readonly eye: Vec3; readonly target: Vec3; readonly fovYDegrees: number } | null {
	if (!isFiniteVec3(input.startFloorPoint) || !isFiniteVec3(input.currentFloorPoint)) return null;
	if (!isFiniteNumber(input.floorDatumMeters) || !isFiniteNumber(input.fovYDegrees)) return null;
	if (!(input.fovYDegrees > 0 && input.fovYDegrees < 180)) return null;
	const minimum = input.minimumDragMeters ?? 0.5;
	const azimuth = input.defaultAzimuthRadians ?? 0;
	const eyeHeight = input.eyeHeightMeters ?? 1.65;
	const targetHeight = input.targetHeightMeters ?? 1.25;
	if (!isFiniteNumber(minimum) || minimum < 0 || !isFiniteNumber(azimuth) || !isFiniteNumber(eyeHeight) || !isFiniteNumber(targetHeight)) return null;
	const dx = input.currentFloorPoint[0] - input.startFloorPoint[0];
	const dz = input.currentFloorPoint[2] - input.startFloorPoint[2];
	const drag = Math.hypot(dx, dz);
	const eye: Vec3 = [
		input.startFloorPoint[0],
		input.floorDatumMeters + eyeHeight,
		input.startFloorPoint[2]
	];
	let target: Vec3;
	if (input.aimPoint !== undefined && input.aimPoint !== null) {
		if (!isFiniteVec3(input.aimPoint)) return null;
		target = [input.aimPoint[0], input.aimPoint[1], input.aimPoint[2]];
	} else {
		const aimedByDrag = drag >= minimum && drag > 1e-9;
		const forwardX = aimedByDrag ? dx / drag : -Math.sin(azimuth);
		const forwardZ = aimedByDrag ? dz / drag : -Math.cos(azimuth);
		target = [
			input.startFloorPoint[0] + forwardX * 1.25,
			input.floorDatumMeters + targetHeight,
			input.startFloorPoint[2] + forwardZ * 1.25
		];
	}
	if (lengthVec3(subtractVec3(target, eye)) <= 1e-6) return null;
	return { eye, target, fovYDegrees: input.fovYDegrees };
}


/** Frame the subject's bounding sphere from the viewer's side at a fixed eye height. */
export function frameSubjectPose(input: {
	readonly bounds: { readonly min: Vec3; readonly max: Vec3 };
	readonly viewerEye: Vec3;
	readonly eyeYMeters: number;
	readonly fovYDegrees: number;
	readonly aspect: number;
}): { readonly eye: Vec3; readonly target: Vec3; readonly fovYDegrees: number } | null {
	const { min, max } = input.bounds;
	const { viewerEye, eyeYMeters, fovYDegrees, aspect } = input;
	if (!isFiniteVec3(min) || !isFiniteVec3(max) || !isFiniteVec3(viewerEye) ||
		min.some((value, index) => value > max[index]!) ||
		!Number.isFinite(eyeYMeters) || !(fovYDegrees > 0 && fovYDegrees < 180) ||
		!Number.isFinite(aspect) || aspect <= 0) return null;
	const target = scaleVec3(addVec3(min, max), 0.5);
	const radius = lengthVec3(subtractVec3(max, min)) / 2;
	const usable = 1 - 2 * VIEWPORT_FIT_PADDING_FRACTION;
	const halfAngle = Math.atan(Math.tan(fovYDegrees * Math.PI / 360) * Math.min(1, aspect) * usable);
	const distance = radius / Math.sin(halfAngle);
	const vertical = Math.abs(eyeYMeters - target[1]);
	const horizontal = Math.max(0.5, Math.sqrt(Math.max(0, distance ** 2 - vertical ** 2)));
	const side = normalizeVec3([viewerEye[0] - target[0], 0, viewerEye[2] - target[2]]) ?? [0, 0, 1];
	const eye: Vec3 = [target[0] + side[0] * horizontal, eyeYMeters, target[2] + side[2] * horizontal];
	const framed = { eye, target, fovYDegrees };
	return inspectionPoseFromView(framed) === null ? null : framed;
}


/**
 * The inspection pose that **faces** a surface.
 *
 * `look` is the camera's look direction (eye → surface), so the eye is placed
 * along `−look` from the bounds centre. The framed extent is measured by
 * projecting the eight bounds corners onto the face's own screen basis, then
 * applying the same padding rule and current lens as `fit`. This keeps the
 * pose derivation in camera-core: an owning domain supplies the bounds and the
 * face direction, never an eye, target or distance.
 *
 * A vertical look is refused rather than rolled: `up` would be degenerate and
 * the reading would silently invent a heading.
 */
export function facePoseFromBounds(input: {
	readonly bounds: { readonly min: Vec3; readonly max: Vec3 };
	readonly look: Vec3;
	readonly rect: ViewportRect;
	readonly paddingFraction?: number;
	readonly fovYDegrees?: number;
}): InspectionPose | null {
	if (!isFiniteVec3(input.bounds?.min) || !isFiniteVec3(input.bounds?.max)) return null;
	const { min, max } = input.bounds;
	if (min[0] > max[0] || min[1] > max[1] || min[2] > max[2]) return null;
	if (!isFiniteVec3(input.look)) return null;
	if (
		!isFiniteNumber(input.rect?.width) ||
		!isFiniteNumber(input.rect?.height) ||
		!(input.rect.width > 0) ||
		!(input.rect.height > 0)
	) return null;
	const look = normalizeVec3(input.look);
	if (look === null) return null;
	// `backward` is eye − target, the direction the pose's eye sits on.
	const backward = scaleVec3(look, -1);
	if (Math.abs(backward[1]) > Math.sin(VIEWPORT_ELEVATION_LIMIT_RADIANS)) return null;
	const right = normalizeVec3(crossVec3([0, 1, 0], backward));
	if (right === null) return null;
	const screenUp = crossVec3(backward, right);
	const target = scaleVec3(addVec3(min, max), 0.5);
	let horizontal = 0;
	let vertical = 0;
	for (let corner = 0; corner < 8; corner += 1) {
		const offset: Vec3 = [
			(corner & 1) === 0 ? min[0] - target[0] : max[0] - target[0],
			(corner & 2) === 0 ? min[1] - target[1] : max[1] - target[1],
			(corner & 4) === 0 ? min[2] - target[2] : max[2] - target[2]
		];
		horizontal = Math.max(horizontal, Math.abs(dotVec3(offset, right)));
		vertical = Math.max(vertical, Math.abs(dotVec3(offset, screenUp)));
	}
	const padding = clamp(input.paddingFraction ?? VIEWPORT_FIT_PADDING_FRACTION, 0, 0.45);
	const usable = 1 - 2 * padding;
	const aspect = input.rect.width / input.rect.height;
	const targetPlaneHeightMeters = clamp(
		Math.max((2 * vertical) / usable, (2 * horizontal) / aspect / usable, VIEWPORT_TARGET_PLANE_MIN_METERS),
		VIEWPORT_TARGET_PLANE_MIN_METERS,
		VIEWPORT_TARGET_PLANE_MAX_METERS
	);
	const fovYDegrees = input.fovYDegrees ?? (VIEWPORT_REFERENCE_FOV_Y_RADIANS * 180) / Math.PI;
	if (!(fovYDegrees > 0 && fovYDegrees < 180)) return null;
	const distance = perspectiveDistanceMeters(targetPlaneHeightMeters, fovYDegrees);
	return inspectionPoseFromView({
		eye: addVec3(target, scaleVec3(backward, distance)),
		target,
		fovYDegrees
	});
}


/** Move eye and target together by a floor-relative delta, keeping aim and FOV. */
export function liftPose(pose: InspectionPose, deltaMeters: number): InspectionPose | null {
	if (!isFiniteNumber(deltaMeters)) return null;
	const target: Vec3 = [pose.target[0], pose.target[1] + deltaMeters, pose.target[2]];
	if (!isFiniteVec3(target)) return null;
	return {
		...pose,
		target
	};
}


/** Turn the aim about a fixed eye; the focal distance and lens are kept. */
export function turnPose(pose: InspectionPose, deltaYawRadians: number, deltaPitchRadians: number): InspectionPose | null {
	if (!isFiniteNumber(deltaYawRadians) || !isFiniteNumber(deltaPitchRadians)) return null;
	if (Math.abs(deltaYawRadians) > VIEWPORT_TURN_STEP_LIMIT_RADIANS || Math.abs(deltaPitchRadians) > VIEWPORT_TURN_STEP_LIMIT_RADIANS) {
		return null;
	}
	const eye = eyeOfInspectionPose(pose);
	const distance = lengthVec3(subtractVec3(eye, pose.target));
	if (!(distance > 1e-6)) return null;
	const azimuthRadians = pose.azimuthRadians + deltaYawRadians;
	// Looking up lowers the eye's elevation above the target.
	const elevationRadians = clamp(
		pose.elevationRadians - deltaPitchRadians,
		-VIEWPORT_ELEVATION_LIMIT_RADIANS,
		VIEWPORT_ELEVATION_LIMIT_RADIANS
	);
	const cosine = Math.cos(elevationRadians);
	const target: Vec3 = [
		eye[0] - Math.sin(azimuthRadians) * cosine * distance,
		eye[1] - Math.sin(elevationRadians) * distance,
		eye[2] - Math.cos(azimuthRadians) * cosine * distance
	];
	if (!isFiniteVec3(target)) return null;
	return { ...pose, target, azimuthRadians, elevationRadians };
}


/** Move the eye and target together along the level aim, keeping aim and lens. */
export function stepPose(pose: InspectionPose, deltaMeters: number): InspectionPose | null {
	if (!isFiniteNumber(deltaMeters)) return null;
	const target: Vec3 = [
		pose.target[0] - Math.sin(pose.azimuthRadians) * deltaMeters,
		pose.target[1],
		pose.target[2] - Math.cos(pose.azimuthRadians) * deltaMeters
	];
	if (!isFiniteVec3(target)) return null;
	return { ...pose, target };
}


/** Move the camera in its image plane, keeping its orientation, lens and focal distance. */
export function truckPose(pose: InspectionPose, deltaRightMeters: number, deltaUpMeters: number): InspectionPose | null {
	if (!isFiniteNumber(deltaRightMeters) || !isFiniteNumber(deltaUpMeters) ||
		Math.hypot(deltaRightMeters, deltaUpMeters) > VIEWPORT_TARGET_PLANE_MAX_METERS) return null;
	const eye = eyeOfInspectionPose(pose);
	const basis = viewScreenBasis(eye, pose.target, viewUpForPose(pose));
	if (basis === null) return null;
	const target = addVec3(pose.target, addVec3(scaleVec3(basis.right, deltaRightMeters), scaleVec3(basis.up, deltaUpMeters)));
	return isFiniteVec3(target) ? { ...pose, target } : null;
}


/** Change the authored lens at a fixed eye and target. */
export function setPoseLens(pose: InspectionPose, fovYDegrees: number): InspectionPose | null {
	if (!isFiniteNumber(fovYDegrees) || fovYDegrees <= 0 || fovYDegrees >= 180) return null;
	const distance = perspectiveDistanceMeters(pose.targetPlaneHeightMeters, pose.fovYDegrees);
	const targetPlaneHeightMeters = 2 * distance * Math.tan((fovYDegrees * Math.PI) / 360);
	if (targetPlaneHeightMeters < VIEWPORT_TARGET_PLANE_MIN_METERS || targetPlaneHeightMeters > VIEWPORT_TARGET_PLANE_MAX_METERS) {
		return null;
	}
	return {
		...pose,
		targetPlaneHeightMeters,
		fovYDegrees
	};
}
