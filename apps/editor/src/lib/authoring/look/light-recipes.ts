/**
 * T2.S7 — *Light it* recipe geometry.
 *
 * A recipe is a plan for one ordinary S3 spot light: where its body goes, how it
 * is aimed, and the cone that covers the subject's evaluated rectangle (Artwork)
 * or bounds (objects). The recipe writes no source; the adapter submits its
 * values through the existing `create-light` planner, so the created entity is an
 * ordinary editable light with no special-case rendering.
 *
 * The approved starting geometry is the review study's Picture spot: 1.4 m in
 * front of the artwork and 30° above its centre, aimed at the centre, with the
 * beam fitted to the artwork rectangle plus a small margin. A2 owns the final
 * frame contract; until it lands the fit uses the artwork's own rectangle. That
 * substitution is deliberately one function (`artworkLightRectangle`), not a
 * competing frame representation.
 *
 * A Wash uses one union of the selected subjects' evaluated bounds, so a
 * multi-selection produces one shared light rather than one light per object.
 */
import { Euler, Vector3 } from 'three';
import { artworkHeight, type SceneArtworkEntity, type Vec3 } from '@portfolio/project-model';
import { rotationForLightDirection } from './light-aim';
import { LIGHT_INTENSITY_REFERENCE, spotCutoffForTargetDistance } from './light-units';

/** The review study's Picture spot stand-off: 1.4 m in front of the artwork. */
export const LIGHT_IT_PICTURE_SPOT_FRONT_METERS = 1.4;
/** The review study's Picture spot elevation: 30° above the artwork centre. */
export const LIGHT_IT_PICTURE_SPOT_ELEVATION_DEGREES = 30;
/** The beam fits the subject with a 10% angular margin before it is written. */
export const LIGHT_IT_BEAM_MARGIN_RATIO = 1.1;
/** A Wash sits above and in front of the bounds at 45°. */
export const LIGHT_IT_WASH_ELEVATION_DEGREES = 45;
/** Wash stand-off is proportional to the bounds radius, within practical limits. */
export const LIGHT_IT_WASH_STANDOFF_RATIO = 1.5;
export const LIGHT_IT_WASH_STANDOFF_MIN_METERS = 0.9;
/** Large enough that a spread-out multi-selection still fits inside one cone. */
export const LIGHT_IT_WASH_STANDOFF_MAX_METERS = 200;
/** The smallest stored half-angle; a tiny subject still gets a usable cone. */
export const LIGHT_IT_MIN_HALF_ANGLE_RADIANS = (2 * Math.PI) / 180;
/** The largest stored half-angle; the renderer accepts more, but a recipe should not. */
export const LIGHT_IT_MAX_HALF_ANGLE_RADIANS = (80 * Math.PI) / 180;

export const LIGHT_IT_PICTURE_SPOT_NAME = 'Picture spot';
export const LIGHT_IT_WASH_NAME = 'Wash';

export type LightItRecipeKind = 'picture-spot' | 'wash';

export type LightItBounds = {
	readonly min: Vec3;
	readonly max: Vec3;
};

/**
 * One ordinary S3 spot's authored values. `name` is the recipe's shelf name;
 * the adapter de-duplicates it against the accepted Scene.
 */
export type LightItRecipe = {
	readonly recipe: LightItRecipeKind;
	readonly name: string;
	readonly position: Vec3;
	readonly rotation: Vec3;
	readonly angle: number;
	readonly range: number;
	readonly color: string;
	readonly intensity: number;
	readonly castShadow: boolean;
};

type ArtworkRectangle = {
	readonly center: Vec3;
	readonly halfWidth: number;
	readonly halfHeight: number;
	readonly corners: readonly Vec3[];
};

/**
 * The rectangle a Picture spot must cover for one Artwork.
 *
 * A2's frame contract exposes the generated outer rectangle through
 * `artworkFrameLayout(...).outerWidth/outerHeight` (and the border through
 * `artworkFrameBorderMeters`). Reading only `widthMeters` and the source aspect
 * here keeps S7 independent of that shape and leaves exactly one seam: after A2
 * lands, add its border to both half extents in this function.
 */
export function artworkLightRectangle(entity: SceneArtworkEntity): ArtworkRectangle {
	const halfWidth = entity.widthMeters / 2;
	const halfHeight = artworkHeight(entity.widthMeters, entity.source) / 2;
	const rotation = new Euler(entity.rotation[0], entity.rotation[1], entity.rotation[2], 'XYZ');
	const center = new Vector3(...entity.position);
	const corners: Vec3[] = [
		[-halfWidth, -halfHeight, 0],
		[halfWidth, -halfHeight, 0],
		[halfWidth, halfHeight, 0],
		[-halfWidth, halfHeight, 0]
	].map(([x, y, z]) => new Vector3(x, y, z).applyEuler(rotation).add(center).toArray() as Vec3);
	return { center: center.toArray() as Vec3, halfWidth, halfHeight, corners };
}

/** The artwork's world-space axis-aligned bounds; the multi-selection Wash input. */
export function artworkLightBounds(entity: SceneArtworkEntity): LightItBounds {
	const { corners } = artworkLightRectangle(entity);
	return {
		min: [
			Math.min(...corners.map((corner) => corner[0])),
			Math.min(...corners.map((corner) => corner[1])),
			Math.min(...corners.map((corner) => corner[2]))
		] as Vec3,
		max: [
			Math.max(...corners.map((corner) => corner[0])),
			Math.max(...corners.map((corner) => corner[1])),
			Math.max(...corners.map((corner) => corner[2]))
		] as Vec3
	};
}

/**
 * A Picture spot in front of and above one Artwork.
 *
 * The body is offset along the artwork's own front (+Z) and world up, so the
 * light follows a turned artwork instead of assuming a room axis. The target is
 * the artwork centre; the beam is the smallest cone containing all four
 * corners, times the margin. The cutoff is the S3 target distance plus its
 * established margin, so the artwork is inside the lit reach rather than on the
 * attenuation boundary.
 */
export function pictureSpotRecipe(entity: SceneArtworkEntity): LightItRecipe {
	const rectangle = artworkLightRectangle(entity);
	const front = rotateDirection(entity.rotation, [0, 0, 1]);
	const elevation = degreesToRadians(LIGHT_IT_PICTURE_SPOT_ELEVATION_DEGREES);
	const position = add(
		rectangle.center,
		add(scale(front, LIGHT_IT_PICTURE_SPOT_FRONT_METERS), [
			0,
			LIGHT_IT_PICTURE_SPOT_FRONT_METERS * Math.tan(elevation),
			0
		])
	);
	const direction = normalize(sub(rectangle.center, position));
	return {
		recipe: 'picture-spot',
		name: LIGHT_IT_PICTURE_SPOT_NAME,
		position,
		rotation: rotationForLightDirection(direction),
		angle: fittedHalfAngle(position, direction, rectangle.corners),
		range: spotCutoffForTargetDistance(distance(position, rectangle.center)),
		color: '#ffffff',
		intensity: LIGHT_INTENSITY_REFERENCE,
		castShadow: false
	};
}

/**
 * A Wash fitted to one evaluated bounds union.
 *
 * `front` is the primary subject's horizontal forward. The body sits above and
 * in front on a 45° line, far enough that the fitted cone is not cramped for a
 * tall or wide subject, and the target is the bounds centre. Every one of the
 * eight corners participates, so a multi-selection's one light covers the
 * selected subjects rather than only their centres.
 */
export function washRecipe(input: {
	readonly bounds: LightItBounds;
	readonly front?: Vec3;
}): LightItRecipe {
	const { bounds } = input;
	const center: Vec3 = [
		(bounds.min[0] + bounds.max[0]) / 2,
		(bounds.min[1] + bounds.max[1]) / 2,
		(bounds.min[2] + bounds.max[2]) / 2
	];
	const halfExtents: Vec3 = [
		Math.max(0, (bounds.max[0] - bounds.min[0]) / 2),
		Math.max(0, (bounds.max[1] - bounds.min[1]) / 2),
		Math.max(0, (bounds.max[2] - bounds.min[2]) / 2)
	];
	const radius = Math.hypot(...halfExtents);
	const standoff = clamp(
		radius * LIGHT_IT_WASH_STANDOFF_RATIO,
		LIGHT_IT_WASH_STANDOFF_MIN_METERS,
		LIGHT_IT_WASH_STANDOFF_MAX_METERS
	);
	const front = horizontalFront(input.front);
	const position = add(center, add(scale(front, standoff), [0, standoff, 0]));
	const direction = normalize(sub(center, position));
	return {
		recipe: 'wash',
		name: LIGHT_IT_WASH_NAME,
		position,
		rotation: rotationForLightDirection(direction),
		angle: fittedHalfAngle(position, direction, boundsCorners(bounds)),
		range: spotCutoffForTargetDistance(distance(position, center)),
		color: '#ffffff',
		intensity: LIGHT_INTENSITY_REFERENCE,
		castShadow: false
	};
}

export function unionLightItBounds(
	bounds: readonly LightItBounds[]
): LightItBounds | null {
	if (bounds.length === 0) return null;
	return bounds.reduce<LightItBounds>(
		(union, entry) => ({
			min: [
				Math.min(union.min[0], entry.min[0]),
				Math.min(union.min[1], entry.min[1]),
				Math.min(union.min[2], entry.min[2])
			],
			max: [
				Math.max(union.max[0], entry.max[0]),
				Math.max(union.max[1], entry.max[1]),
				Math.max(union.max[2], entry.max[2])
			]
		}),
		{ min: [...bounds[0]!.min] as Vec3, max: [...bounds[0]!.max] as Vec3 }
	);
}

/** The horizontal forward of a stored Euler, for a Wash's front. */
export function horizontalFront(rotation: Vec3 | undefined): Vec3 {
	if (rotation === undefined) return [0, 0, 1];
	const front = rotateDirection(rotation, [0, 0, 1]);
	const horizontal = normalize([front[0], 0, front[2]]);
	return horizontal[0] === 0 && horizontal[2] === 0 ? [0, 0, 1] : horizontal;
}

export function boundsCorners(bounds: LightItBounds): Vec3[] {
	return [
		[bounds.min[0], bounds.min[1], bounds.min[2]],
		[bounds.min[0], bounds.min[1], bounds.max[2]],
		[bounds.min[0], bounds.max[1], bounds.min[2]],
		[bounds.min[0], bounds.max[1], bounds.max[2]],
		[bounds.max[0], bounds.min[1], bounds.min[2]],
		[bounds.max[0], bounds.min[1], bounds.max[2]],
		[bounds.max[0], bounds.max[1], bounds.min[2]],
		[bounds.max[0], bounds.max[1], bounds.max[2]]
	];
}

/**
 * The smallest stored half-angle containing every point around `direction`,
 * expanded by the recipe margin.
 *
 * A point behind the light cannot be covered by a cone at any admitted angle;
 * the clamp is a refusal boundary in values, not a silent re-aim.
 */
function fittedHalfAngle(
	origin: Vec3,
	direction: Vec3,
	points: readonly Vec3[]
): number {
	let widest = 0;
	for (const point of points) {
		const offset = sub(point, origin);
		const length = Math.hypot(...offset);
		if (!(length > 1e-9)) continue;
		const cosine = clamp(dot(direction, scale(offset, 1 / length)), -1, 1);
		widest = Math.max(widest, Math.acos(cosine));
	}
	return clamp(
		widest * LIGHT_IT_BEAM_MARGIN_RATIO,
		LIGHT_IT_MIN_HALF_ANGLE_RADIANS,
		LIGHT_IT_MAX_HALF_ANGLE_RADIANS
	);
}

function rotateDirection(rotation: Vec3, direction: Vec3): Vec3 {
	const vector = new Vector3(...direction)
		.applyEuler(new Euler(rotation[0], rotation[1], rotation[2], 'XYZ'))
		.normalize();
	return [vector.x, vector.y, vector.z];
}

function degreesToRadians(degrees: number): number {
	return (degrees * Math.PI) / 180;
}

function distance(left: Vec3, right: Vec3): number {
	return Math.hypot(right[0] - left[0], right[1] - left[1], right[2] - left[2]);
}

function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}

function dot(left: Vec3, right: Vec3): number {
	return left[0] * right[0] + left[1] * right[1] + left[2] * right[2];
}

function normalize(value: Vec3): Vec3 {
	const length = Math.hypot(value[0], value[1], value[2]);
	if (!(length > 1e-12)) return [0, 0, 1];
	return [value[0] / length, value[1] / length, value[2] / length];
}

function scale(value: Vec3, amount: number): Vec3 {
	return [value[0] * amount, value[1] * amount, value[2] * amount];
}

function add(left: Vec3, right: Vec3): Vec3 {
	return [left[0] + right[0], left[1] + right[1], left[2] + right[2]];
}

function sub(left: Vec3, right: Vec3): Vec3 {
	return [left[0] - right[0], left[1] - right[1], left[2] - right[2]];
}
