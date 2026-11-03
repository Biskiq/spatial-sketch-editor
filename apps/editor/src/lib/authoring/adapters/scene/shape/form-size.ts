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
import { sizeDeltaLabel } from '$lib/authoring/stage/gesture-values';
import {
	planSetFormSize,
	type SceneOperationResult
} from '@portfolio/project-model/scene-planning';
import type { SceneFormEntity } from '@portfolio/project-model';
import type { Vec3 } from '@portfolio/camera-core';
import { evaluateFormMesh } from '$lib/content/form-evaluation';
import type { StageHandleDescriptor } from '$lib/authoring/stage/stage-handles';
import { axisTravelFromRay } from '$lib/authoring/stage/stage-axis-travel';

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
	/** Lowest local Y of the evaluated body; the floor contact Move is drawn on. */
	readonly contactMinY: number;
	/** Evaluated local X/Z extent, the footprint Move and Turn are drawn around. */
	readonly footprint: { readonly width: number; readonly depth: number };
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
	if (mesh === null) {
		return { handles: [], bounds: null, contactMinY: 0, footprint: { width: 0, depth: 0 } };
	}
	const min: Vec3 = [mesh.bounds.min[0], mesh.bounds.min[1], mesh.bounds.min[2]];
	const max: Vec3 = [mesh.bounds.max[0], mesh.bounds.max[1], mesh.bounds.max[2]];
	const handles: FormSizeHandle[] = FORM_SIZE_AXES.map(({ axis, label }) => {
		const local: Vec3 = [0, 0, 0];
		local[axis] = max[axis];
		const centred = Math.abs(min[axis] + max[axis]) < 1e-9 && max[axis] > 0;
		// `evaluateFormMesh` already applies the form scale, so the evaluated
		// extent is the current dimension and the authored outline extent is that
		// divided back out. Using the scaled extent as the baseline would make the
		// second resize on an axis wrong by the first scale factor.
		const dimension = max[axis] - min[axis];
		const baseDimension = dimension / entity.form.scale[axis];
		return {
			axis,
			label,
			local,
			world: formWorldPoint(entity, local),
			factor: centred ? 2 : 1,
			dimension,
			baseDimension
		};
	});
	return {
		handles,
		bounds: { min, max },
		contactMinY: min[1],
		footprint: { width: max[0] - min[0], depth: max[2] - min[2] }
	};
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
 * The full per-axis scale a knob travel names, or `null` when it is a no-op.
 * The planner owns the admitted range: returning the raw scale lets a mark show
 * the same refusal and write the same fact as the Card instead of silently
 * clamping an out-of-range drag.
 */
export function formSizeScaleFromTravel(input: {
	readonly entity: SceneFormEntity;
	readonly handle: FormSizeHandle;
	readonly travelMeters: number;
}): readonly [number, number, number] | null {
	if (!Number.isFinite(input.travelMeters) || input.travelMeters <= 0) return null;
	const dimension = input.travelMeters * input.handle.factor;
	if (!(input.handle.baseDimension > 0)) return null;
	const raw = dimension / input.handle.baseDimension;
	if (!Number.isFinite(raw)) return null;
	const scale: [number, number, number] = [
		input.entity.form.scale[0],
		input.entity.form.scale[1],
		input.entity.form.scale[2]
	];
	scale[input.handle.axis] = raw;
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
 * The per-axis size rays a selected form adds to the shared Scene object marks.
 * Move, Turn, the W·D·H chip and Lift are the object marks' own ids: a form is
 * a Scene object whose only different capability is per-axis sizing.
 */
export const SCENE_FORM_MARK = {
	width: 'scene-form-mark-width',
	height: 'scene-form-mark-height',
	depth: 'scene-form-mark-depth'
} as const;

export type SceneFormRayMarkId = (typeof SCENE_FORM_MARK)[keyof typeof SCENE_FORM_MARK];

export function isSceneFormRayMarkId(id: string | undefined): id is SceneFormRayMarkId {
	return id === SCENE_FORM_MARK.width || id === SCENE_FORM_MARK.height || id === SCENE_FORM_MARK.depth;
}

/**
 * The Plan-only screen fallback for the edge-on Height ray.
 *
 * Plan looks down world Y, so Height's world axis projects to nothing. The
 * adapter derives a CSS offset from the live measurement and the evaluation's
 * metres-per-pixel; the host uses it to draw and hit the same real Height fact.
 */
export type FormMarkScreenHeight = {
	readonly offset: readonly [number, number];
	readonly axis: readonly [number, number];
};

/**
 * Separation offset for the Move grip.
 *
 * Move's contact anchor and the Width ray's centre share an origin and axis for
 * upright forms, so their hit areas overlap in both Plan and 3D. Offset Move
 * perpendicular to its own projected axis and away from the Depth ray: a fixed
 * downward offset would land back on the ray when the form is turned a quarter
 * turn. The sign is chosen so yaw 0 keeps the existing downward grip. The offset
 * changes drawing and hit area only; the gesture still drives the form's real
 * floor position.
 */
export function formMoveScreenOffset(input: {
	readonly entity: SceneFormEntity;
	readonly reading?: 'plan' | '3d';
	readonly measurement: FormSizeMeasurement;
	readonly project: (point: Vec3) => readonly [number, number] | null;
	readonly gapPx?: number;
}): { readonly offset: readonly [number, number] } {
	const gap =
		input.gapPx !== undefined && Number.isFinite(input.gapPx) && input.gapPx > 0
			? input.gapPx
			: 24;
	const yaw = input.entity.rotation[1];
	const base: Vec3 = [
		input.entity.position[0],
		input.entity.position[1] + input.measurement.contactMinY,
		input.entity.position[2]
	];
	const axis: Vec3 = [Math.cos(yaw), 0, -Math.sin(yaw)];
	const start = input.project(base);
	const end = input.project([
		base[0] + axis[0] * 0.5,
		base[1],
		base[2] + axis[2] * 0.5
	]);
	if (start === null || end === null) return { offset: [0, gap] };
	const dx = end[0] - start[0];
	const dy = end[1] - start[1];
	const length = Math.hypot(dx, dy);
	if (!(length > 1e-6)) return { offset: [0, gap] };
	let offset: [number, number] = [(dy / length) * gap, -(dx / length) * gap];
	// Pick the side opposite the projected Depth ray, so the separated Move grip
	// cannot land on the other perpendicular ray either.
	const depthEnd = input.project([
		base[0] + Math.sin(yaw) * 0.5,
		base[1],
		base[2] + Math.cos(yaw) * 0.5
	]);
	if (depthEnd !== null) {
		const depthX = depthEnd[0] - start[0];
		const depthY = depthEnd[1] - start[1];
		const depthLength = Math.hypot(depthX, depthY);
		if (
			depthLength > 1e-6 &&
			offset[0] * (depthX / depthLength) + offset[1] * (depthY / depthLength) > 0
		) {
			offset = [-offset[0], -offset[1]];
		}
	}
	return { offset };
}

/** The three size rays in the domain's overlap order: Height, Width, Depth. */
const FORM_SIZE_RAY_ORDER: readonly {
	readonly axis: FormSizeAxis;
	readonly id:
		| typeof SCENE_FORM_MARK.width | typeof SCENE_FORM_MARK.height | typeof SCENE_FORM_MARK.depth;
	readonly label: string;
	readonly note: string;
}[] = [
	{ axis: 1, id: SCENE_FORM_MARK.height, label: 'Height', note: ' · base stays' },
	{ axis: 0, id: SCENE_FORM_MARK.width, label: 'Width', note: '' },
	{ axis: 2, id: SCENE_FORM_MARK.depth, label: 'Depth', note: '' }
];

/** The rays the chip discloses in a reading: Plan cannot show Height. */
export function formSizeRayIds(reading: 'plan' | '3d' | undefined): readonly SceneFormRayMarkId[] {
	return reading === 'plan'
		? [SCENE_FORM_MARK.width, SCENE_FORM_MARK.depth]
		: [SCENE_FORM_MARK.height, SCENE_FORM_MARK.width, SCENE_FORM_MARK.depth];
}

/**
 * The per-axis size rays for one selected form, drawn on its live pose.
 *
 * Every ray names the fact and planner the Card writes (`set-form-size`). The
 * shared object marks publish Move, Turn, the chip that discloses these and
 * the Lift knob; this module never writes source.
 */
export function formSizeRayDescriptors(input: {
	/** The form at its live pose and live size. */
	readonly pose: SceneFormEntity;
	readonly reading?: 'plan' | '3d';
	readonly measurement: FormSizeMeasurement;
	/** The accepted measurement a delta label is read against. */
	readonly baseline: FormSizeMeasurement;
	readonly disclosedBy: string;
	readonly refusal: (id: SceneFormRayMarkId) => string | null;
	/**
	 * The Plan legibility fallback for Height. Only the Height ray carries it;
	 * Width and Depth keep their real world axes in every reading.
	 */
	readonly screenHeight?: FormMarkScreenHeight | null;
}): readonly StageHandleDescriptor[] | null {
	const { pose, measurement } = input;
	const bounds = measurement.bounds;
	if (bounds === null || measurement.handles.length !== 3) return null;
	const descriptors: StageHandleDescriptor[] = [];
	for (const ray of FORM_SIZE_RAY_ORDER) {
		if (input.reading === 'plan' && ray.axis === 1) continue;
		const handle = measurement.handles.find((entry) => entry.axis === ray.axis);
		if (handle === undefined) return null;
		// Height is the stem's top knob at the chip's side (review pass 2 §6): its
		// drag travels the same vertical axis from the form's origin, so moving
		// the drawn anchor off the top face changes nothing it plans.
		const top = ray.axis === 1;
		descriptors.push({
			id: ray.id,
			draw: top ? { ray: 8, glyph: 'top-knob' } : { ray: 26 },
			kind: 'ray',
			role: 'edit',
			anchor: top ? formWorldPoint(pose, bounds.max) : formWorldPoint(pose, handle.local),
			...(top
				? {
						stem: formWorldPoint(pose, [bounds.max[0], bounds.min[1], bounds.max[2]]),
						screen: { offset: [26, 0] as const }
					}
				: {}),
			axis: formWorldAxis(pose, ray.axis),
			extent: Math.max(0.2, Math.abs(handle.local[ray.axis])),
			label: ray.label,
			fact: `scale[${ray.axis}]`,
			verb: ray.label,
			planner: 'set-form-size',
			disclosedBy: input.disclosedBy,
			value: sizeDeltaLabel(
				handle.dimension,
				input.baseline.handles.find((entry) => entry.axis === ray.axis)?.dimension ?? handle.dimension
			),
			...(top && input.screenHeight != null ? { screen: input.screenHeight } : {}),
			refusal: input.refusal(ray.id)
		});
	}
	return descriptors;
}

/** Re-exported so a sizing caller need not know the shared ray module. */
export { axisTravelFromRay };
