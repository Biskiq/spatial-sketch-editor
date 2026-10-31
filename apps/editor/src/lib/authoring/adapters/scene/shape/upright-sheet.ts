/**
 * The upright Sheet arithmetic an elevation form is drawn against.
 *
 * R217.S17A removed upright drawing from the Stage. The model keeps elevation
 * forms, so this frame arithmetic stays for T5's future face-frame reading; no
 * Stage control reaches it.
 */
import type { Vec3, WorkingPlane } from '@portfolio/camera-core';
import { datumWorkingPlane } from '$lib/authoring/stage/stage-facade';
import type { ShapeOutlineAnchor, ShapePoint } from './outline';

export type ShapeSheet = { readonly x: number; readonly z: number; readonly yaw: number };
export type ShapeReadingPlane = 'plan' | 'elevation';

/** The plane a stroke is drawn on. The owner supplies the frame; Camera intersects it. */
export function shapeWorkingPlane(
	plane: ShapeReadingPlane,
	sheet: ShapeSheet,
	datumMeters: number
): WorkingPlane {
	if (plane === 'plan') return datumWorkingPlane(datumMeters);
	return {
		originMeters: [sheet.x, datumMeters, sheet.z],
		// Local +Z is the extrusion direction, exactly as an elevation form stores it.
		normal: [Math.sin(sheet.yaw), 0, Math.cos(sheet.yaw)],
		yawRadians: sheet.yaw + Math.PI / 2,
		datumMeters,
		supportedLocalExtent: null
	};
}

/** The sheet's local U axis in world space (the elevation form's local +X). */
export function shapeSheetRight(sheet: ShapeSheet): Vec3 {
	return [Math.cos(sheet.yaw), 0, -Math.sin(sheet.yaw)];
}

/** World point on the drawing plane -> sheet-local `(u, v)`. */
export function shapeLocalPoint(
	plane: ShapeReadingPlane,
	sheet: ShapeSheet,
	datumMeters: number,
	world: Vec3
): ShapePoint {
	if (plane === 'plan') return { u: world[0], v: world[2] };
	const right = shapeSheetRight(sheet);
	const dx = world[0] - sheet.x;
	const dz = world[2] - sheet.z;
	return { u: dx * right[0] + dz * right[2], v: world[1] - datumMeters };
}

/**
 * Mirror an outline across the profile plane's local Y axis.
 *
 * Flipping an upright outline keeps the drawn profile where it is and turns the
 * extrusion to the other side of the sheet: the frame yaw rotates by π and local U
 * is mirrored, so every world point is unchanged while local +Z points the other
 * way. Winding is canonicalized again by the planner, so no order surgery is needed.
 */
export function flipUprightOutline(
	outline: readonly ShapeOutlineAnchor[]
): readonly ShapeOutlineAnchor[] {
	return outline.map((anchor) => ({ ...anchor, u: -anchor.u }));
}
