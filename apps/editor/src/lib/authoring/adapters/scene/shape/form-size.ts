/**
 * T5.P01.S02 — per-axis size rays on a selected native form.
 *
 * A form is sized by its own `form.scale`, never by the entity-level uniform
 * scale. Three rays name the form's local X (Width), Y (Height) and Z (Depth)
 * extents; dragging one computes a full per-axis scale and previews it through
 * the same `set-form-size` planner the Card writes through. Release commits one
 * intent, so a drag is one history entry and the Card remains the one writer for
 * exact typed values.
 *
 * The geometry here is session arithmetic. The canonical source stays the
 * authored outline plus `form.scale`; nothing generated is stored.
 */
import { Euler, Vector3 } from 'three';
import { PROFILE_LIMITS } from '@portfolio/geometry-core';
import {
	planSetFormSize,
	type SceneOperationResult
} from '@portfolio/project-model/scene-planning';
import type { SceneFormEntity } from '@portfolio/project-model';
import type { Vec3 } from '@portfolio/camera-core';
import { evaluateFormMesh } from '$lib/content/form-evaluation';

/** Local mesh axis: 0 = Width (X), 1 = Height (Y), 2 = Depth (Z). */
export type FormSizeAxis = 0 | 1 | 2;

export const FORM_SIZE_AXES: readonly {
	readonly axis: FormSizeAxis;
	readonly label: string;
}[] = [
	{ axis: 0, label: 'Width' },
	{ axis: 1, label: 'Height' },
	{ axis: 2, label: 'Depth' }
];

export type FormSizeHandle = {
	readonly axis: FormSizeAxis;
	readonly label: string;
	/** Local endpoint of the axis ray, in the form's own frame. */
	readonly local: Vec3;
	/** World position of the knob. */
	readonly world: Vec3;
	/** Metres on the axis for one local metre of knob travel (1 or 2). */
	readonly factor: number;
	/** Current evaluated dimension in metres. */
	readonly dimension: number;
	/** Unscaled evaluated dimension: `form.scale[axis] × baseDimension`. */
	readonly baseDimension: number;
};

export type FormSizeMeasurement = {
	readonly handles: readonly FormSizeHandle[];
	/** Evaluated local bounds of the accepted source, or `null`. */
	readonly bounds: { readonly min: Vec3; readonly max: Vec3 } | null;
};

/**
 * The three knobs of one accepted form.
 *
 * A centred profile axis (the form's local origin is its centre) measures two
 * local metres per dimension metre; a base-anchored axis measures one. The
 * factor is derived from the evaluated bounds, not guessed per plane.
 */
export function formSizeMeasurement(entity: SceneFormEntity): FormSizeMeasurement {
	const mesh = evaluateFormMesh(entity.form);
	if (mesh === null) return { handles: [], bounds: null };
	const min: Vec3 = [mesh.bounds.min[0], mesh.bounds.min[1], mesh.bounds.min[2]];
	const max: Vec3 = [mesh.bounds.max[0], mesh.bounds.max[1], mesh.bounds.max[2]];
	const handles: FormSizeHandle[] = FORM_SIZE_AXES.map(({ axis, label }) => {
		const local: Vec3 = [0, 0, 0];
		local[axis] = max[axis];
		const centred = Math.abs(min[axis] + max[axis]) < 1e-9 && max[axis] > 0;
		const baseDimension = max[axis] - min[axis];
		return {
			axis,
			label,
			local,
			world: formWorldPoint(entity, local),
			factor: centred ? 2 : 1,
			dimension: baseDimension * entity.form.scale[axis],
			baseDimension
		};
	});
	return { handles, bounds: { min, max } };
}

/** One local point of a form in world space through its authored pose. */
export function formWorldPoint(entity: SceneFormEntity, local: Vec3): Vec3 {
	return new Vector3(local[0], local[1], local[2])
		.applyEuler(new Euler(entity.rotation[0], entity.rotation[1], entity.rotation[2]))
		.add(new Vector3(entity.position[0], entity.position[1], entity.position[2]))
		.toArray() as Vec3;
}

/** The form's world axis direction for one local axis. */
export function formWorldAxis(entity: SceneFormEntity, axis: FormSizeAxis): Vec3 {
	const local: Vec3 = [0, 0, 0];
	local[axis] = 1;
	const origin = formWorldPoint(entity, [0, 0, 0]);
	const tip = formWorldPoint(entity, local);
	return [tip[0] - origin[0], tip[1] - origin[1], tip[2] - origin[2]];
}

/**
 * The full per-axis scale a knob travel names, or `null` when it is a no-op or
 * outside the admitted limits. The planner still owns validity; this only keeps
 * a preview from naming an impossible scale.
 */
export function formSizeScaleFromTravel(input: {
	readonly entity: SceneFormEntity;
	readonly handle: FormSizeHandle;
	readonly travelMeters: number;
}): readonly [number, number, number] | null {
	if (!Number.isFinite(input.travelMeters)) return null;
	const dimension = Math.max(0, input.travelMeters * input.handle.factor);
	if (!(input.handle.baseDimension > 0)) return null;
	const raw = dimension / input.handle.baseDimension;
	if (!Number.isFinite(raw)) return null;
	const scale: [number, number, number] = [
		input.entity.form.scale[0],
		input.entity.form.scale[1],
		input.entity.form.scale[2]
	];
	scale[input.handle.axis] = Math.min(
		PROFILE_LIMITS.maxScale,
		Math.max(PROFILE_LIMITS.minScale, raw)
	);
	if (scale.every((value, index) => value === input.entity.form.scale[index])) return null;
	return scale;
}

type Candidate = Extract<SceneOperationResult, { kind: 'candidate' }>;

/** The one planner preview for a candidate scale, or the planner's refusal words. */
export function previewFormSize(input: {
	readonly context: Parameters<typeof planSetFormSize>[0]['context'];
	readonly entityId: string;
	readonly scale: readonly [number, number, number];
}): { readonly candidate: Candidate } | { readonly refusal: string } {
	const result = planSetFormSize({
		context: input.context,
		entityId: input.entityId,
		scale: input.scale
	});
	return result.kind === 'candidate'
		? { candidate: result }
		: { refusal: result.message };
}

/**
 * The distance along an axis from the form's local origin that a pointer ray
 * names. `null` when the ray is parallel to the axis or points behind it.
 */
export function axisTravelFromRay(input: {
	readonly origin: Vec3;
	readonly direction: Vec3;
	readonly rayOrigin: Vec3;
	readonly rayDirection: Vec3;
}): number | null {
	const direction = input.direction;
	const rayDirection = input.rayDirection;
	const b =
		direction[0] * rayDirection[0] +
		direction[1] * rayDirection[1] +
		direction[2] * rayDirection[2];
	const denominator = 1 - b * b;
	if (Math.abs(denominator) < 1e-9) return null;
	const w0: Vec3 = [
		input.origin[0] - input.rayOrigin[0],
		input.origin[1] - input.rayOrigin[1],
		input.origin[2] - input.rayOrigin[2]
	];
	const d =
		direction[0] * w0[0] + direction[1] * w0[1] + direction[2] * w0[2];
	const e =
		rayDirection[0] * w0[0] + rayDirection[1] * w0[1] + rayDirection[2] * w0[2];
	const travel = (b * e - d) / denominator;
	return Number.isFinite(travel) ? travel : null;
}
