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
import type { StageHandleDescriptor } from '$lib/authoring/stage/stage-handles';
import { axisTravelFromRay } from './ray';

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
 * The full per-axis scale a knob travel names, or `null` when it is a no-op or
 * outside the admitted limits. The planner still owns validity; this only keeps
 * a preview from naming an impossible scale.
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

/** The stable ids a selected native form publishes. The host owns disclosure state. */
export const SCENE_FORM_MARK = {
	move: 'scene-form-mark-move',
	turn: 'scene-form-mark-turn',
	scalePoint: 'scene-form-mark-scale',
	width: 'scene-form-mark-width',
	height: 'scene-form-mark-height',
	depth: 'scene-form-mark-depth'
} as const;

export type SceneFormMarkId = (typeof SCENE_FORM_MARK)[keyof typeof SCENE_FORM_MARK];

/** Editing marks; the scale point is a disclosure and never claims a gesture. */
export type SceneFormEditMarkId =
	| typeof SCENE_FORM_MARK.move
	| typeof SCENE_FORM_MARK.turn
	| typeof SCENE_FORM_MARK.width
	| typeof SCENE_FORM_MARK.height
	| typeof SCENE_FORM_MARK.depth;

export function isSceneFormEditMarkId(id: string | undefined): id is SceneFormEditMarkId {
	return (
		id === SCENE_FORM_MARK.move ||
		id === SCENE_FORM_MARK.turn ||
		id === SCENE_FORM_MARK.width ||
		id === SCENE_FORM_MARK.height ||
		id === SCENE_FORM_MARK.depth
	);
}

/** The live values a gesture or refusal shows on its mark. */
export type SceneFormMarkLive = {
	readonly markId: SceneFormMarkId;
	readonly position: Vec3;
	readonly yaw: number;
	readonly scale: readonly [number, number, number];
	readonly refusal: string | null;
};

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

/** The three size rays in the domain's overlap order: Height, Width, Depth. */
const FORM_SIZE_RAY_ORDER: readonly {
	readonly axis: FormSizeAxis;
	readonly id: typeof SCENE_FORM_MARK.width | typeof SCENE_FORM_MARK.height | typeof SCENE_FORM_MARK.depth;
	readonly label: string;
	readonly note: string;
}[] = [
	{ axis: 1, id: SCENE_FORM_MARK.height, label: 'Height', note: ' · base stays' },
	{ axis: 0, id: SCENE_FORM_MARK.width, label: 'Width', note: '' },
	{ axis: 2, id: SCENE_FORM_MARK.depth, label: 'Depth', note: '' }
];

/**
 * Publish the six descriptors for one selected native form.
 *
 * A form sizes per axis, so its scale point discloses three size rays rather
 * than the object marks' one uniform size ray. Every descriptor names the fact
 * and planner the Card already writes; the host admits, draws and hit-tests
 * them, and this module never writes source.
 */
export function formMarkDescriptors(input: {
	readonly entity: SceneFormEntity;
	readonly measurement: FormSizeMeasurement;
	readonly live?: SceneFormMarkLive | null;
	/**
	 * The Plan legibility fallback for Height. Only the Height ray carries it;
	 * Width and Depth keep their real world axes in every reading.
	 */
	readonly screenHeight?: FormMarkScreenHeight | null;
}): readonly StageHandleDescriptor[] {
	const { entity, measurement } = input;
	const live = input.live ?? null;
	if (measurement.bounds === null || measurement.handles.length !== 3) return [];
	// The live pose lets every mark follow a Move or Turn preview without a
	// second measurement; the accepted source remains the only authored truth.
	const pose: SceneFormEntity =
		live === null
			? entity
			: {
					...entity,
					position: [...live.position] as Vec3,
					rotation: [entity.rotation[0], live.yaw, entity.rotation[2]]
				};
	const position = pose.position;
	const yaw = pose.rotation[1];
	const baseY = position[1] + measurement.contactMinY;
	const { width, depth } = measurement.footprint;
	const refusal = (id: SceneFormMarkId): string | null =>
		live !== null && live.markId === id ? live.refusal : null;
	const centre = formWorldPoint(pose, [0, 0, 0]);
	const descriptors: StageHandleDescriptor[] = [
		{
			id: SCENE_FORM_MARK.move,
			kind: 'track',
			role: 'edit',
			anchor: [position[0], baseY, position[2]],
			axis: [Math.cos(yaw), 0, -Math.sin(yaw)],
			extent: Math.max(0.2, width / 2),
			label: 'Move',
			fact: 'position',
			verb: 'Position',
			planner: 'place-on-floor',
			value: `X ${position[0].toFixed(3)} · Z ${position[2].toFixed(3)} m`,
			refusal: refusal(SCENE_FORM_MARK.move)
		},
		{
			id: SCENE_FORM_MARK.scalePoint,
			kind: 'point',
			role: 'disclose',
			anchor: formWorldPoint(pose, measurement.bounds.max),
			label: 'Scale',
			reveals: [SCENE_FORM_MARK.height, SCENE_FORM_MARK.width, SCENE_FORM_MARK.depth]
		}
	];
	for (const ray of FORM_SIZE_RAY_ORDER) {
		const handle = measurement.handles.find((entry) => entry.axis === ray.axis);
		if (handle === undefined) return [];
		descriptors.push({
			id: ray.id,
			kind: 'ray',
			role: 'edit',
			anchor: centre,
			axis: formWorldAxis(pose, ray.axis),
			extent: Math.max(0.2, Math.abs(handle.local[ray.axis])),
			label: ray.label,
			fact: `scale[${ray.axis}]`,
			verb: ray.label,
			planner: 'set-form-size',
			disclosedBy: SCENE_FORM_MARK.scalePoint,
			value: `${ray.label} ${handle.dimension.toFixed(3)} m${ray.note}`,
			...(ray.axis === 1 && input.screenHeight != null
				? { screen: input.screenHeight }
				: {}),
			refusal: refusal(ray.id)
		});
	}
	// The turn ring is drawn at the shared 30 px calibration, so the three rays
	// would be unreachable if a ring hit won first. The ring is therefore last:
	// its free arc stays pressable and the same-class ray order is unchanged.
	descriptors.push({
		id: SCENE_FORM_MARK.turn,
		kind: 'ring',
		role: 'edit',
		anchor: [position[0], baseY, position[2]],
		axis: [0, 1, 0],
		extent: Math.max(0.2, Math.max(width, depth) / 2),
		label: 'Turn',
		fact: 'yaw',
		verb: 'Yaw',
		planner: 'set-yaw',
		value: `Yaw ${((yaw * 180) / Math.PI).toFixed(1)}°`,
		refusal: refusal(SCENE_FORM_MARK.turn)
	});
	return descriptors;
}

/** Re-exported so a sizing caller need not know the shared ray module. */
export { axisTravelFromRay };
