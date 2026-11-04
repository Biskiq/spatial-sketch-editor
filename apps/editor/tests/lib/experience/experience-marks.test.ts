/**
 * R217.S28 — Experience View marks are one projection of the authored Camera
 * Views through the current evaluation, with the plan's label and frustum caps.
 */
import { describe, expect, it } from 'vitest';
import {
	createViewportCameraState,
	evaluateViewport,
	inspectionPoseFromView,
	projectWorld,
	type InspectionPose,
	type ViewportEvaluation
} from '@portfolio/camera-core';
import type { CameraView, Experience } from '@portfolio/project-model/units';
import { EXPERIENCE_MARK_CAPS, experienceMarkModel, relatedToSelection } from '$lib/authoring/experience/experience-marks';

function evaluate(pose: InspectionPose, reading: '3d' | 'plan'): ViewportEvaluation {
	const state = createViewportCameraState({
		outputId: 'marks',
		sessionEpoch: 'marks',
		sourceRevision: 'marks',
		pose,
		sceneRadiusMeters: 50,
		reading
	});
	const result = evaluateViewport(state, { left: 0, top: 0, width: 1280, height: 800, devicePixelRatio: 1 }, 0, 1);
	if (result.kind !== 'evaluated') throw new Error(result.reason);
	return result.evaluation;
}

function perspective(): ViewportEvaluation {
	const pose = inspectionPoseFromView({ eye: [0, 2, 7], target: [0, 1, 0], fovYDegrees: 54 });
	if (pose === null) throw new Error('pose');
	return evaluate(pose, '3d');
}

function plan(): ViewportEvaluation {
	return evaluate(
		{
			target: [0, 1, 0],
			azimuthRadians: 0,
			elevationRadians: Math.PI / 2,
			targetPlaneHeightMeters: 12
		},
		'plan'
	);
}

function view(id: string, x: number, z = 2): CameraView {
	return { id, label: id.toUpperCase(), eye: [x, 2, z], target: [x, 1, 0], fov: 54, connectedViewIds: [] };
}

function experience(viewIds: readonly string[], guided: readonly string[]): Experience {
	return {
		id: 'exp',
		label: 'Experience',
		entryGuideId: 'guide',
		welcome: null,
		presentations: [
			{
				id: 'pres',
				label: 'Presentation',
				viewIds,
				defaultViewId: viewIds[0] ?? null,
				subject: null,
				text: null,
				explorable: true
			}
		],
		stops: [{ id: 'stop', presentationId: 'pres', views: guided.map((viewId) => ({ viewId })) }],
		guides: [{ id: 'guide', label: 'Guide', stopIds: ['stop'], entryStopId: 'stop' }],
		gates: [],
		detours: []
	};
}

it('relates the Views and Camera paths owned by each selection', () => {
	const base = experience(['a', 'b', 'c'], ['a', 'b']);
	const exp: Experience = {
		...base,
		stops: [
			{ id: 'stop', presentationId: 'pres', views: [{ viewId: 'a' }, { viewId: 'b', transition: 'travel' }] },
			{ id: 'next', presentationId: 'pres', views: [{ viewId: 'c' }] }
		]
	};
	const guide = { ...base.guides[0]!, stopIds: ['stop', 'next'] };
	const step = 'step:stop:b';
	const transition = 'transition:stop';
	expect(relatedToSelection({ presentationId: 'pres' }, exp, guide)).toEqual({ views: new Set(['a', 'b', 'c']), paths: new Set() });
	expect(relatedToSelection({ viewId: 'b' }, exp, guide)).toEqual({ views: new Set(['b']), paths: new Set([step, transition]) });
	expect(relatedToSelection({ stopId: 'next' }, exp, guide)).toEqual({ views: new Set(['c']), paths: new Set([transition]) });
	expect(relatedToSelection({ path: { kind: 'transition', stopId: 'stop' } }, exp, guide)).toEqual({
		views: new Set(['b', 'c']), paths: new Set([transition])
	});
	expect(relatedToSelection({ path: { kind: 'step', stopId: 'stop', toViewId: 'b' } }, exp, guide)).toEqual({
		views: new Set(['a', 'b']), paths: new Set([step])
	});
});

describe('R217.S28 — Experience marks', () => {
	it('marks one glyph per View in 3D and no frustums', () => {
		const model = experienceMarkModel({
			experience: experience(['a', 'b'], ['a']),
			guide: null,
			views: [view('a', -0.3), view('b', 0.3)],
			evaluation: perspective(),
			selection: { stopId: 'stop' }
		});
		expect(model.marks.filter((mark) => mark.kind === 'glyph')).toHaveLength(2);
		expect(model.frustums).toHaveLength(0);
		expect(model.marks.find((mark) => mark.viewId === 'a')?.state).toBe('strong');
		expect(model.marks.find((mark) => mark.viewId === 'a')?.label).toBe('A');
		expect(model.marks.find((mark) => mark.viewId === 'b')?.state).toBe('dim');
	});

	it('projects Stage SVG marks into Stage-local CSS, not absolute viewport CSS', () => {
		const evaluation = perspective();
		const offset = {
			...evaluation,
			rect: { ...evaluation.rect, left: 352, top: 73 }
		};
		const model = experienceMarkModel({
			experience: experience(['a'], []),
			guide: null,
			views: [view('a', 0)],
			evaluation: offset,
			selection: {}
		});
		const mark = model.marks.find((entry) => entry.kind === 'glyph');
		const projected = projectWorld([0, 2, 2], offset, offset.token);
		if (mark === undefined || projected.kind !== 'projected') throw new Error('mark projection');
		expect(mark.css[0]).toBeCloseTo(projected.css[0] - 352, 1);
		expect(mark.css[1]).toBeCloseTo(projected.css[1] - 73, 1);
	});

	it('caps frustums and labels, prioritising the selected View', () => {
		const views = Array.from({ length: 30 }, (_, index) => view(`v${index}`, -2 + index * 0.14));
		const exp = experience(views.map((entry) => entry.id), []);
		const unselected = experienceMarkModel({
			experience: exp,
			guide: null,
			views,
			evaluation: plan(),
			selection: {}
		});
		expect(unselected.frustums).toHaveLength(EXPERIENCE_MARK_CAPS.frustums);
		// `normal` Views carry no label; only selected/strong labels are capped.
		expect(unselected.marks.every((mark) => mark.label === '')).toBe(true);

		const selected = experienceMarkModel({
			experience: exp,
			guide: null,
			views,
			evaluation: plan(),
			selection: { viewId: 'v29', presentationId: 'pres' }
		});
		const selectedMark = selected.marks.find((mark) => mark.viewId === 'v29');
		expect(selectedMark?.state).toBe('selected');
		expect(selectedMark?.label).toBe('V29');
		const labelled = selected.marks.filter((mark) => mark.label !== '');
		expect(labelled.length).toBeLessThanOrEqual(EXPERIENCE_MARK_CAPS.labels);
		// The selected View is never dropped by the label cap.
		expect(labelled.some((mark) => mark.viewId === 'v29')).toBe(true);
		// The selected View also leads the ordered marks.
		expect(selected.marks[0]?.viewId).toBe('v29');
	});
});
