import type { StageAdapterContext } from '$lib/authoring/stage/stage-adapter-host';
import { datumWorkingPlane, stageScene } from '$lib/authoring/stage/stage-adapter-host';
import type { SceneFormEntity, Vec3 } from '@portfolio/project-model/scene';
import { markCandidate, type SceneObjectBounds } from './object-marks';
import { sizePlannerContext } from './object-readings';
import type { SceneCandidate } from './placement';
import {
	SCENE_FORM_MARK,
	axisTravelFromRay,
	formSizeScaleFromTravel,
	formWorldAxis,
	formWorldPoint,
	previewFormSize,
	type FormSizeHandle,
	type FormSizeMeasurement
} from './shape/form-size';

type FormRayTarget = {
	formSize: {
		readonly entity: SceneFormEntity;
		readonly measurement: FormSizeMeasurement;
		readonly handle: FormSizeHandle;
		readonly planHeightTravel: { readonly startY: number; readonly metersPerCssPixel: number } | null;
		readonly startTravelMeters: number | null;
		scale: readonly [number, number, number] | null;
	} | null;
	candidate: SceneCandidate | null;
	refusal: string | null;
};

	/** The pointer ray's angle around the entity's vertical axis. */
	export function turnAngleAt(
		adapterContext: StageAdapterContext,
		entityId: string,
		css: readonly [number, number],
		planeY: number
	): number | null {
		const entity = stageScene(adapterContext.snapshot).entities.find((entry) => entry.id === entityId);
		if (entity === undefined) return null;
		const ray = adapterContext.ray([
			css[0] + adapterContext.evaluation.rect.left,
			css[1] + adapterContext.evaluation.rect.top
		]);
		if (ray === null || Math.abs(ray.direction[1]) < 1e-6) return null;
		const hit = adapterContext.intersect(ray, datumWorkingPlane(planeY));
		if (hit.kind !== 'intersected' || !Number.isFinite(hit.distanceMeters) || hit.distanceMeters <= 0) return null;
		const [x, , z] = hit.worldPoint;
		const angle = Math.atan2(-(z - entity.position[2]), x - entity.position[0]);
		return Number.isFinite(angle) ? angle : null;
	}

	/**
	 * The pointer's travel outward from the bounds centre through the chip
	 * corner. Scale is the ratio of this travel to the press's, so the corner
	 * stays under the pointer whichever way the object faces.
	 */
	export function sizeTravelAt(
	adapterContext: StageAdapterContext,
	bounds: SceneObjectBounds,
	css: readonly [number, number]
	): number | null {
	const ray = adapterContext.ray([
		css[0] + adapterContext.evaluation.rect.left,
		css[1] + adapterContext.evaluation.rect.top
	]);
	if (ray === null) return null;
	const centre: [number, number, number] = [
		(bounds.min[0] + bounds.max[0]) / 2,
		(bounds.min[1] + bounds.max[1]) / 2,
		(bounds.min[2] + bounds.max[2]) / 2
	];
	const out = [bounds.max[0] - centre[0], bounds.max[1] - centre[1], bounds.max[2] - centre[2]];
	const length = Math.hypot(out[0], out[1], out[2]);
	if (!Number.isFinite(length) || length === 0) return null;
	return axisTravelFromRay({
		origin: centre,
		direction: [out[0] / length, out[1] / length, out[2] / length],
		rayOrigin: ray.origin,
		rayDirection: ray.direction
	});
	}

	/** The pointer's vertical travel on the lift knob's stem. */
	export function liftTravelAt(
	adapterContext: StageAdapterContext,
	origin: Vec3,
	css: readonly [number, number]
	): number | null {
	const ray = adapterContext.ray([
		css[0] + adapterContext.evaluation.rect.left,
		css[1] + adapterContext.evaluation.rect.top
	]);
	if (ray === null) return null;
	return axisTravelFromRay({
		origin,
		direction: [0, 1, 0],
		rayOrigin: ray.origin,
		rayDirection: ray.direction
	});
	}


	/** One move of a form's per-axis size ray, previewed through `set-form-size`. */
export function previewFormRay(
		adapterContext: StageAdapterContext,
		gesture: FormRayTarget,
		formSize: NonNullable<FormRayTarget['formSize']>,
		css: readonly [number, number]
	): void {
		const { entity, measurement, handle } = formSize;
		let travel: number | null;
		if (formSize.planHeightTravel !== null) {
			travel =
				handle.dimension / handle.factor +
				((formSize.planHeightTravel.startY - css[1]) * formSize.planHeightTravel.metersPerCssPixel) /
					handle.factor;
		} else {
			const ray = adapterContext.ray([
				css[0] + adapterContext.evaluation.rect.left,
				css[1] + adapterContext.evaluation.rect.top
			]);
			const currentTravel =
				ray === null
					? null
					: axisTravelFromRay({
							origin: formTravelOrigin(entity, measurement, handle.axis),
							direction: formWorldAxis(entity, handle.axis),
							rayOrigin: ray.origin,
							rayDirection: ray.direction
						});
			travel =
				formSize.startTravelMeters === null || currentTravel === null
					? null
					: handle.dimension / handle.factor + currentTravel - formSize.startTravelMeters;
		}
		const scale =
			travel === null ? null : formSizeScaleFromTravel({ entity, handle, travelMeters: travel });
		if (scale === null) {
			formSize.scale = null;
			gesture.candidate = null;
			gesture.refusal = 'Move the handle to name a new size.';
			return;
		}
		const preview = previewFormSize({
			context: sizePlannerContext(adapterContext),
			entityId: entity.id,
			scale
		});
		if ('candidate' in preview) {
			formSize.scale = scale;
			gesture.candidate = markCandidate(preview.candidate);
			gesture.refusal = gesture.candidate === null ? 'The form body could not be evaluated.' : null;
		} else {
			formSize.scale = null;
			gesture.candidate = null;
			gesture.refusal = preview.refusal;
		}
	}

export function formRayHandle(
		measurement: FormSizeMeasurement,
		markId: string
	): FormSizeHandle | null {
		const axis =
			markId === SCENE_FORM_MARK.width
				? 0
				: markId === SCENE_FORM_MARK.height
					? 1
					: markId === SCENE_FORM_MARK.depth
						? 2
						: -1;
		return axis === -1 ? null : measurement.handles.find((handle) => handle.axis === axis) ?? null;
	}

	/** One press, one preview, one commit through the form's own planners. */
	/**
	 * Where a size drag measures its travel. Height is the top knob at the
	 * chip's corner, so its vertical axis runs through that corner; Width and
	 * Depth stay on the form's own centre axes.
	 */
export function formTravelOrigin(
		entity: SceneFormEntity,
		measurement: FormSizeMeasurement,
		axis: number
	): [number, number, number] {
		return axis === 1 && measurement.bounds !== null
			? formWorldPoint(entity, measurement.bounds.max)
			: formWorldPoint(entity, [0, 0, 0]);
	}


