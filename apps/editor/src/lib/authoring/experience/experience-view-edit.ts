/** Pure Camera View edit candidates for the Stage gesture and the Card. */
import { CAMERA_FOV, VIEWPORT_ELEVATION_LIMIT_RADIANS, type Vec3 } from '@portfolio/camera-core';
import { EYE_HEIGHT_STEPS, LENS_STEPS } from './look-through';

export type AuthoredViewPose = {
	readonly eye: readonly [number, number, number];
	readonly target: readonly [number, number, number];
	readonly fov: number;
};

/** Move the eye on the Floor and carry the target by the same horizontal delta. */
export function moveViewOnFloor(pose: AuthoredViewPose, floorPoint: Vec3): AuthoredViewPose {
	const dx = floorPoint[0] - pose.eye[0];
	const dz = floorPoint[2] - pose.eye[2];
	return {
		eye: [floorPoint[0], pose.eye[1], floorPoint[2]],
		target: [pose.target[0] + dx, pose.target[1], pose.target[2] + dz],
		fov: pose.fov
	};
}

export type ViewEditKind = 'move' | 'turn' | 'lift' | 'tilt' | 'lens';
export type AdvancedViewFraming = { readonly kind: 'lift' | 'tilt' | 'lens'; readonly value: number };

/** Whether a live edit changed the part of the pose its gesture owns. */
export function viewEditMoved(
	kind: ViewEditKind,
	start: AuthoredViewPose,
	current: AuthoredViewPose
): boolean {
	if (kind === 'lens') return Math.abs(current.fov - start.fov) > 1e-3;
	const position = kind === 'move' || kind === 'lift';
	const from = position ? start.eye : start.target;
	const to = position ? current.eye : current.target;
	return Math.hypot(to[0] - from[0], to[1] - from[1], to[2] - from[2]) > 1e-3;
}

/** Aim at a point while the eye and the authored lens stay exactly still. */
export function aimViewAtPoint(pose: AuthoredViewPose, point: Vec3): AuthoredViewPose {
	return {
		eye: [pose.eye[0], pose.eye[1], pose.eye[2]],
		target: [point[0], point[1], point[2]],
		fov: pose.fov
	};
}

/**
 * Experience review round 2 (G1): turn a View about its eye by `deltaYaw`
 * radians. The eye, the target's height, its horizontal distance from the eye and
 * the lens all stay; only the direction the View faces changes.
 */
export function turnViewAboutEye(pose: AuthoredViewPose, deltaYaw: number): AuthoredViewPose {
	const dx = pose.target[0] - pose.eye[0];
	const dz = pose.target[2] - pose.eye[2];
	const cos = Math.cos(deltaYaw);
	const sin = Math.sin(deltaYaw);
	return {
		eye: [pose.eye[0], pose.eye[1], pose.eye[2]],
		target: [pose.eye[0] + dx * cos - dz * sin, pose.target[1], pose.eye[2] + dx * sin + dz * cos],
		fov: pose.fov
	};
}

/** The yaw (radians, X→Z) from the eye toward a floor point, or null on the eye itself. */
export function yawFromEye(pose: AuthoredViewPose, point: readonly [number, number, number]): number | null {
	const dx = point[0] - pose.eye[0];
	const dz = point[2] - pose.eye[2];
	return Math.hypot(dx, dz) < 1e-6 ? null : Math.atan2(dz, dx);
}

const DEGREES = 180 / Math.PI;

export function viewTilt(pose: AuthoredViewPose): number {
	const [x, y, z] = pose.eye;
	return Math.atan2(pose.target[1] - y, Math.hypot(pose.target[0] - x, pose.target[2] - z)) * DEGREES;
}

/** A candidate for the existing Camera View writer. Each control owns one degree of freedom. */
export function frameView(
	pose: AuthoredViewPose,
	edit: AdvancedViewFraming,
	datum: number
): AuthoredViewPose {
	if (!Number.isFinite(edit.value)) return pose;
	if (edit.kind === 'lens') {
		return { ...pose, fov: Math.min(CAMERA_FOV.max, Math.max(CAMERA_FOV.min, edit.value)) };
	}
	if (edit.kind === 'lift') {
		const eyeY = datum + edit.value;
		return { ...pose, eye: [pose.eye[0], eyeY, pose.eye[2]], target: [
			pose.target[0], pose.target[1] + (eyeY - pose.eye[1]), pose.target[2]
		] };
	}
	const [x, y, z] = pose.eye;
	const distance = Math.hypot(pose.target[0] - x, pose.target[1] - y, pose.target[2] - z);
	if (distance <= 1e-6 || Math.abs(edit.value - viewTilt(pose)) < 1e-6) return pose;
	const yaw = yawFromEye(pose, pose.target) ?? -Math.PI / 2;
	const limit = VIEWPORT_ELEVATION_LIMIT_RADIANS;
	const pitch = Math.min(limit, Math.max(-limit, edit.value / DEGREES));
	const horizontal = distance * Math.cos(pitch);
	return { ...pose, target: [
		x + horizontal * Math.cos(yaw), y + distance * Math.sin(pitch), z + horizontal * Math.sin(yaw)
	] };
}

export function snapViewDrag(kind: ViewEditKind, value: number, modifiers: {
	readonly altKey: boolean; readonly shiftKey: boolean;
}): number {
	if (modifiers.altKey) return value;
	if (modifiers.shiftKey) {
		const increment = kind === 'move' ? 0.25 : kind === 'turn' ? 15 : kind === 'tilt' ? 5 : 0;
		if (increment !== 0) return Math.round(value / increment) * increment;
	}
	if (kind === 'lift') return EYE_HEIGHT_STEPS.find(step => Math.abs(step.metres - value) <= 0.06)?.metres ?? value;
	if (kind === 'lens') return LENS_STEPS.find(step => Math.abs(step.fovYDegrees - value) <= 2.5)?.fovYDegrees ?? value;
	return kind === 'tilt' && Math.abs(value) <= 2.5 ? 0 : value;
}

export function angleDelta(angle: number, start: number): number {
	const delta = angle - start;
	return Math.atan2(Math.sin(delta), Math.cos(delta));
}

export function planLensFromDrag(
	fov: number, startAngle: number, angle: number, side: -1 | 1
): number {
	return fov + side * 2 * angleDelta(angle, startAngle) * DEGREES;
}

export function viewEditTag(kind: ViewEditKind, pose: AuthoredViewPose, datum: number, start?: AuthoredViewPose): string {
	const signed = (n: number, digits: number) => `${n < 0 ? '−' : '+'}${Math.abs(n).toFixed(digits)}`;
	if (kind === 'move') {
		if (start === undefined) return 'Move';
		return `Δx ${signed(pose.eye[0] - start.eye[0], 2)} · Δz ${signed(pose.eye[2] - start.eye[2], 2)} m`;
	}
	if (kind === 'turn') {
		if (start === undefined) return 'Turn';
		return `Δθ ${signed(angleDelta(yawFromEye(pose, pose.target) ?? 0, yawFromEye(start, start.target) ?? 0) * DEGREES, 1)}°`;
	}
	const value = kind === 'lift' ? pose.eye[1] - datum : kind === 'tilt' ? viewTilt(pose) : pose.fov;
	const unit = kind === 'lift' ? ' m' : '°';
	const digits = kind === 'lift' ? 2 : 1;
	if (start === undefined) return `${value.toFixed(digits)}${unit}`;
	const previous = kind === 'lift' ? start.eye[1] - datum : kind === 'tilt' ? viewTilt(start) : start.fov;
	return `Δ ${signed(value - previous, digits)}${unit}`;
}
