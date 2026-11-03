/**
 * R217.S28 — Experience View marks on the Stage.
 *
 * Pure projection of the authored Camera Views through the **one** current
 * `ViewportEvaluation`: a mark's CSS point is produced by the same matrix the
 * meshes were drawn with, never by a second camera or a Three object. Selecting
 * a marker never moves the Camera.
 *
 * States follow the plan: selected (gold), strong (the selected Stop's guided
 * Views), normal, and dim. Labels are capped at 12 strong markers and frustums
 * at 24 Views, with the selected View first.
 */
import { projectWorld, type Vec3, type ViewportEvaluation } from '@portfolio/camera-core';
import type { CameraView, Experience, ExperienceGuide } from '@portfolio/project-model/units';

export type ExperienceMarkState = 'selected' | 'strong' | 'normal' | 'dim';
export type ExperienceMarkKind = 'eye' | 'aim' | 'glyph';

export type ExperienceMark = {
	readonly id: string;
	readonly viewId: string;
	readonly presentationId: string;
	readonly kind: ExperienceMarkKind;
	readonly css: readonly [number, number];
	readonly label: string;
	readonly number: number | null;
	readonly state: ExperienceMarkState;
};

export type ExperienceFrustum = {
	readonly viewId: string;
	readonly state: ExperienceMarkState;
	readonly eye: readonly [number, number];
	readonly left: readonly [number, number];
	readonly right: readonly [number, number];
	readonly target: readonly [number, number];
};

export type ExperienceMarkModel = {
	readonly marks: readonly ExperienceMark[];
	readonly frustums: readonly ExperienceFrustum[];
};

export const EXPERIENCE_MARK_CAPS = {
	labels: 12,
	frustums: 24
} as const;

/** The plan's short wedge: half a metre either side of the aim point. */
const FRUSTUM_HALF_WIDTH_METRES = 0.45;

type MarkSelection = {
	readonly presentationId?: string | null;
	readonly viewId?: string | null;
	readonly stopId?: string | null;
};

type MarkInput = {
	readonly experience: Experience | null;
	readonly guide: ExperienceGuide | null;
	readonly views: readonly CameraView[];
	readonly evaluation: ViewportEvaluation;
	readonly selection: MarkSelection;
};

function project(evaluation: ViewportEvaluation, point: Vec3): readonly [number, number] | null {
	const projected = projectWorld(point, evaluation, evaluation.token);
	if (projected.kind !== 'projected' || projected.visibility !== 'visible') return null;
	// projectWorld is absolute viewport CSS; Stage SVG ink is Stage-local.
	return [
		Math.round((projected.css[0] - evaluation.rect.left) * 10) / 10,
		Math.round((projected.css[1] - evaluation.rect.top) * 10) / 10
	];
}

function stateRank(state: ExperienceMarkState): number {
	return state === 'selected' ? 0 : state === 'strong' ? 1 : state === 'normal' ? 2 : 3;
}

/**
 * One mark model for the current Stage. Views the Experience does not present are
 * not marked: the Stage's Camera marks are Experience-only (D13).
 */
export function experienceMarkModel(input: MarkInput): ExperienceMarkModel {
	const { experience, guide, views, evaluation, selection } = input;
	if (experience === null) return { marks: [], frustums: [] };

	const presentationOf = new Map<string, string[]>();
	for (const presentation of experience.presentations) {
		for (const viewId of presentation.viewIds) {
			presentationOf.set(viewId, [...(presentationOf.get(viewId) ?? []), presentation.id]);
		}
	}
	const guidedStop = selection.stopId === null || selection.stopId === undefined
		? null
		: experience.stops.find((stop) => stop.id === selection.stopId) ?? null;
	const numbered = new Map<string, number>();
	guidedStop?.views.forEach((view, index) => numbered.set(view.viewId, index + 1));
	const guided = new Set(numbered.keys());
	const nothingSelected =
		(selection.presentationId ?? null) === null && (selection.viewId ?? null) === null && guidedStop === null;

	const ordered: {
		readonly view: CameraView;
		readonly presentationId: string;
		readonly state: ExperienceMarkState;
	}[] = [];
	for (const [viewId, presentationIds] of presentationOf) {
		const view = views.find((candidate) => candidate.id === viewId);
		if (view === undefined) continue;
		const presentationId = presentationIds[0]!;
		const selected = selection.viewId === view.id;
		const state: ExperienceMarkState = selected
			? 'selected'
			: guided.has(view.id)
				? 'strong'
				: nothingSelected || selection.presentationId === presentationId
					? 'normal'
					: 'dim';
		ordered.push({ view, presentationId, state });
	}
	ordered.sort((left, right) => stateRank(left.state) - stateRank(right.state));

	const labelsAvailable = new Set<string>();
	const labelCandidates = ordered
		.filter((entry) => entry.state === 'selected' || entry.state === 'strong')
		.sort((left, right) => stateRank(left.state) - stateRank(right.state));
	for (const entry of labelCandidates.slice(0, EXPERIENCE_MARK_CAPS.labels)) labelsAvailable.add(entry.view.id);

	const marks: ExperienceMark[] = [];
	const frustums: ExperienceFrustum[] = [];
	const plan = evaluation.projectionKind === 'plan-orthographic';

	for (const entry of ordered) {
		const eye = project(evaluation, entry.view.eye as Vec3);
		const target = project(evaluation, entry.view.target as Vec3);
		if (eye === null || target === null) continue;
		const label = labelsAvailable.has(entry.view.id) ? entry.view.label : '';
		const number = numbered.get(entry.view.id) ?? null;
		marks.push({
			id: `view:${entry.view.id}:${plan ? 'eye' : 'glyph'}`,
			viewId: entry.view.id,
			presentationId: entry.presentationId,
			kind: plan ? 'eye' : 'glyph',
			css: eye,
			label,
			number,
			state: entry.state
		});
		if (!plan) continue;
		marks.push({
			id: `view:${entry.view.id}:aim`,
			viewId: entry.view.id,
			presentationId: entry.presentationId,
			kind: 'aim',
			css: target,
			label: '',
			number,
			state: entry.state
		});
		if (frustums.length >= EXPERIENCE_MARK_CAPS.frustums) continue;
		const dx = entry.view.target[0] - entry.view.eye[0];
		const dz = entry.view.target[2] - entry.view.eye[2];
		const length = Math.hypot(dx, dz);
		if (length < 1e-6) continue;
		const px = (-dz / length) * FRUSTUM_HALF_WIDTH_METRES;
		const pz = (dx / length) * FRUSTUM_HALF_WIDTH_METRES;
		const left = project(evaluation, [
			entry.view.target[0] + px,
			entry.view.target[1],
			entry.view.target[2] + pz
		]);
		const right = project(evaluation, [
			entry.view.target[0] - px,
			entry.view.target[1],
			entry.view.target[2] - pz
		]);
		if (left === null || right === null) continue;
		frustums.push({ viewId: entry.view.id, state: entry.state, eye, left, right, target });
	}

	void guide;
	return { marks, frustums };
}

/** The Stage's empty-Experience invitation wording (S28 coach). */
export const EXPERIENCE_COACH = {
	title: 'Start your experience',
	body: 'Select an object and choose Present this, or place a View where the camera stands.'
} as const;
