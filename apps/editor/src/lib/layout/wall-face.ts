/**
 * The **Face** frame of a Wall.
 *
 * A6 gives the Card's one Look action a face to square to. This module owns the
 * two things Layout is allowed to supply — a world **bounds** and a horizontal
 * **look** direction — and nothing else. It never builds an eye, a target, a
 * distance or a lens: `camera-core`'s `face` intent derives the pose, and its
 * evaluator realises it, so no UI component writes the Camera.
 *
 * Two sources, one rule:
 *
 * - a **folded Wall** is faced at the station nearest the view centre, on the
 *   side the creator is already looking at (the Plan reading has no eye, so it
 *   faces the Wall's left/Room face);
 * - an **unrolled sheet** is faced as the sheet is displayed right now — its
 *   displayed positions at the current peel amount and side angle, and the
 *   displayed face normal at the pin.
 *
 * Bounds are the subject's whole extent as a **face footprint**: the axis-aligned
 * extent moved so the side facing the eye lies on the target plane. That keeps a
 * curved Wall's near station inside the same padding as its far one. It is still
 * a conservative frame, not an exact elevation: an exact developed elevation is
 * Section's job, not Face's.
 */
import type { CompiledPhysicalWall } from '@portfolio/layout-core';
import { eyeOfInspectionPose, type Vec3, type ViewportCameraState } from '@portfolio/camera-core';

import {
	buildWallUnfoldDisplay,
	unfoldDisplayPointAtStation,
	type WallUnfoldDisplay
} from './wall-unfold-pick';
import {
	wallUnfoldSideTowardCamera,
	wallUnfoldViewCentreStation,
	type WallUnfoldSide,
	type WallUnfoldState
} from './wall-unfold';

/**
 * A face as the Camera's `face` intent consumes it: finite ordered bounds and
 * the direction the Camera looks (eye → face). The eye therefore sits on the
 * negative side of `look`; camera-core owns that derivation.
 */
export type WallFaceFrame = {
	readonly bounds: { readonly min: Vec3; readonly max: Vec3 };
	readonly look: Vec3;
};

/** The horizontal unit vector `(x, z)`, or `null` when it names no direction. */
function unitHorizontal(x: number, z: number): Vec3 | null {
	const length = Math.hypot(x, z);
	if (!(length > 1e-9)) return null;
	return [x / length, 0, z / length];
}

/**
 * A framed subject needs a real face: positive width and depth in plan and a
 * positive height. A degenerate compiled Wall refuses rather than asking the
 * Camera to frame a line or a point.
 */
function orderedBounds(min: readonly [number, number, number], max: readonly [number, number, number]): {
	readonly min: Vec3;
	readonly max: Vec3;
} | null {
	if (!(max[0] > min[0]) || !(max[2] > min[2]) || !(max[1] > min[1])) return null;
	return { min: [min[0], min[1], min[2]], max: [max[0], max[1], max[2]] };
}

/**
 * The subject's **face footprint**: the same extent, moved along `look` so the
 * subject's eye-side face lies on the target plane.
 *
 * `face` frames the box's extent *at the target plane*. A subject with depth
 * behind that plane would put its near parts beyond the frame: with a curved
 * Wall's whole box, the near station was magnified until the view was flush with
 * the edges. Moving the extent toward the eye by its own eye-side depth puts the
 * face on the target plane and everything else behind it, so the near station
 * and the far one are framed by the same padding. The target therefore moves to
 * the face, not the box's middle — which is the face being faced.
 */
function facePlaneBounds(bounds: { readonly min: Vec3; readonly max: Vec3 }, look: Vec3): {
	readonly min: Vec3;
	readonly max: Vec3;
} {
	const halfX = (bounds.max[0] - bounds.min[0]) / 2;
	const halfZ = (bounds.max[2] - bounds.min[2]) / 2;
	const eyeSideDepth = Math.abs(halfX * look[0]) + Math.abs(halfZ * look[2]);
	const shift: Vec3 = [-look[0] * eyeSideDepth, 0, -look[2] * eyeSideDepth];
	return {
		min: [bounds.min[0] + shift[0], bounds.min[1], bounds.min[2] + shift[2]],
		max: [bounds.max[0] + shift[0], bounds.max[1], bounds.max[2] + shift[2]]
	};
}

/** The canonical station nearest the view centre, or the middle of the Wall. */
function faceStation(wall: CompiledPhysicalWall, target: readonly [number, number, number]): number {
	const nearest = wallUnfoldViewCentreStation(wall, target);
	if (nearest !== null) return nearest;
	const middle = wall.samples[Math.floor(wall.samples.length / 2)];
	return middle?.distance ?? 0;
}

/**
 * The face the creator is looking at: the side the settled eye is on in 3D, the
 * Wall's left/Room face in Plan. This is inspection evidence, never a choice the
 * Unroll session inherits.
 */
export function wallFaceSide(
	wall: CompiledPhysicalWall,
	camera: Pick<ViewportCameraState, 'pose' | 'reading'>
): WallUnfoldSide {
	return wallUnfoldSideTowardCamera({
		wall,
		eye: eyeOfInspectionPose(camera.pose),
		reading: camera.reading,
		anchorStation: faceStation(wall, camera.pose.target)
	});
}

/**
 * The folded Wall's face frame: the compiled Wall's own bounds, square to the
 * face at the view-centre station. A Wall with no resolvable station, a
 * degenerate tangent or unordered bounds refuses with `null`.
 */
export function wallFaceFrame(
	wall: CompiledPhysicalWall,
	camera: Pick<ViewportCameraState, 'pose' | 'reading'>
): WallFaceFrame | null {
	const samples = wall.samples;
	if (samples.length === 0) return null;
	const station = faceStation(wall, camera.pose.target);
	let nearest = samples[0]!;
	let nearestDistance = Math.abs(nearest.distance - station);
	for (const sample of samples) {
		const distance = Math.abs(sample.distance - station);
		if (distance < nearestDistance) {
			nearest = sample;
			nearestDistance = distance;
		}
	}
	// The left normal of the canonical centerline, exactly as the Unroll side
	// rule reads it, so the chosen side and the look direction cannot disagree.
	const normal = unitHorizontal(-nearest.tangent[1], nearest.tangent[0]);
	if (normal === null) return null;
	const bounds = orderedBounds(wall.bounds3.min, wall.bounds3.max);
	if (bounds === null) return null;
	const side = wallFaceSide(wall, camera);
	const look: Vec3 = [-side * normal[0], 0, -side * normal[2]];
	return { bounds: facePlaneBounds(bounds, look), look };
}

/**
 * Exact face frame for an explicit straight wall side (`'left' | 'right'`),
 * taken from the Card target's surface ref rather than the camera's side.
 */
export function wallSideFaceFrame(
	wall: CompiledPhysicalWall,
	surfaceSide: 'left' | 'right'
): WallFaceFrame | null {
	const samples = wall.samples;
	if (samples.length === 0) return null;
	const mid = samples[Math.floor(samples.length / 2)]!;
	const normal = unitHorizontal(-mid.tangent[1], mid.tangent[0]);
	if (normal === null) return null;
	const bounds = orderedBounds(wall.bounds3.min, wall.bounds3.max);
	if (bounds === null) return null;
	const side = surfaceSide === 'left' ? 1 : -1;
	const look: Vec3 = [-side * normal[0], 0, -side * normal[2]];
	return { bounds: facePlaneBounds(bounds, look), look };
}

/** The displayed sheet's own extent and the face normal at its pin. */
function sheetFaceFrame(display: WallUnfoldDisplay, anchorStation: number): WallFaceFrame | null {
	const positions = display.positions;
	if (positions.length < 3) return null;
	const min: [number, number, number] = [Infinity, Infinity, Infinity];
	const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
	for (let index = 0; index + 2 < positions.length; index += 3) {
		for (let axis = 0; axis < 3; axis += 1) {
			const value = positions[index + axis]!;
			if (value < min[axis]!) min[axis] = value;
			if (value > max[axis]!) max[axis] = value;
		}
	}
	const bounds = orderedBounds(min, max);
	if (bounds === null) return null;
	const atPin = unfoldDisplayPointAtStation(display, anchorStation);
	const normal = unitHorizontal(atPin.normal[0], atPin.normal[1]);
	if (normal === null) return null;
	// The displayed sheet's front face is the one its normals point from; the eye
	// sits on that side and looks back at the sheet.
	const look: Vec3 = [-normal[0], 0, -normal[2]];
	return { bounds: facePlaneBounds(bounds, look), look };
}

/**
 * The unrolled sheet's face frame at the current peel amount and presentation
 * angle. A development refusal, an empty sheet or a degenerate pin normal
 * refuses with `null`.
 */
export function wallSheetFaceFrame(input: {
	readonly wall: CompiledPhysicalWall;
	readonly state: WallUnfoldState;
	readonly sideAngle: number;
	readonly floorY: number;
}): WallFaceFrame | null {
	const display = buildWallUnfoldDisplay(input.wall, input.state, {
		floorY: input.floorY,
		sideAngle: input.sideAngle
	});
	if (display === null) return null;
	return sheetFaceFrame(display, input.state.anchorStation);
}
