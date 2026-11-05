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
				views: viewIds.map((viewId, index) => (index === 0 ? { viewId } : { viewId, transition: 'cut' as const })),
				subject: null,
				text: null,
				explorable: true
			}
		],
		stops: [{ id: 'stop', presentationId: 'pres', entryViewId: guided[0] === viewIds[0] ? null : (guided[0] ?? null), staySeconds: 5, invitation: null }],
		guides: [{ id: 'guide', label: 'Guide', stopIds: ['stop'], entryStopId: 'stop', pacing: 'automatic' as const }],
		detours: []
	};
}

it('relates the Views and Camera paths owned by each selection', () => {
	const base = experience(['a', 'b', 'c'], ['a', 'b']);
	const exp: Experience = {
		...base,
		presentations: [{ ...base.presentations[0]!, views: [{ viewId: 'a' }, { viewId: 'b', transition: 'travel' }, { viewId: 'c', transition: 'cut' }] }],
		stops: [
			{ id: 'stop', presentationId: 'pres', entryViewId: null, staySeconds: 5, invitation: null },
			{ id: 'next', presentationId: 'pres', entryViewId: 'c', staySeconds: 5, invitation: null }
		]
	};
	const guide = { ...base.guides[0]!, stopIds: ['stop', 'next'] };
	const step = 'step:pres:b';
	const transition = 'transition:stop';
	expect(relatedToSelection({ presentationId: 'pres' }, exp, guide)).toEqual({ views: new Set(['a', 'b', 'c']), paths: new Set() });
	expect(relatedToSelection({ viewId: 'b' }, exp, guide)).toEqual({ views: new Set(['b']), paths: new Set([step, 'step:pres:c']) });
	expect(relatedToSelection({ stopId: 'next' }, exp, guide)).toEqual({ views: new Set(['c']), paths: new Set([transition]) });
	expect(relatedToSelection({ path: { kind: 'transition', stopId: 'stop' } }, exp, guide)).toEqual({
		views: new Set(['a', 'c']), paths: new Set([transition])
	});
	expect(relatedToSelection({ path: { kind: 'step', presentationId: 'pres', toViewId: 'b' } }, exp, guide)).toEqual({
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

describe('Review round 3 — Plan marks survive panning and an empty scene', () => {
	// Owner report: with no objects the Plan showed no cameras, and some pans hid them.
	it('keeps a View whose look target lies outside the Plan frame', () => {
		const far: CameraView = { ...view('a', 0), target: [500, 1, 0] };
		const model = experienceMarkModel({
			experience: experience(['a'], []),
			guide: null,
			views: [far],
			evaluation: plan(),
			selection: { viewId: 'a' }
		});
		expect(model.marks.some((mark) => mark.viewId === 'a' && mark.kind === 'eye')).toBe(true);
		expect(model.frustums.map((wedge) => wedge.viewId)).toEqual(['a']);
	});

	it('keeps a View the Plan depth range clips (an eye above the Plan camera)', () => {
		const evaluation = plan();
		const high: CameraView = { ...view('a', 0), eye: [0, 400, 2], target: [0, 399, 0] };
		const clipped = projectWorld(high.eye, evaluation, evaluation.token);
		expect(clipped.kind === 'projected' && clipped.visibility).toBe('clipped');
		const model = experienceMarkModel({
			experience: experience(['a'], []),
			guide: null,
			views: [high],
			evaluation,
			selection: {}
		});
		expect(model.marks.filter((mark) => mark.viewId === 'a')).toHaveLength(1);
	});
});

describe('Review round 3 — a live marker drag draws the camera at its provisional pose', () => {
	it('moves the dragged View in the model and leaves the others where they are', () => {
		const input = {
			experience: experience(['a', 'b'], []),
			guide: null,
			views: [view('a', -1), view('b', 1)],
			evaluation: plan(),
			selection: { viewId: 'a' }
		};
		const still = experienceMarkModel(input);
		const live = experienceMarkModel({ ...input, livePose: { viewId: 'a', eye: [-3, 2, 2], target: [-3, 1, 0], fov: input.views[0]!.fov } });
		const eyeOf = (model: typeof still, id: string) => model.marks.find((mark) => mark.viewId === id && mark.kind === 'eye')!.css;
		expect(eyeOf(live, 'a')[0]).toBeLessThan(eyeOf(still, 'a')[0]);
		expect(eyeOf(live, 'b')).toEqual(eyeOf(still, 'b'));
		// The Plan mark carries the heading the Plan camera glyph turns to.
		expect(typeof live.marks.find((mark) => mark.viewId === 'a' && mark.kind === 'eye')!.heading).toBe('number');
	});

	it('uses the provisional lens for the selected Plan wedge only', () => {
		const a = view('a', -1);
		const input = { experience: experience(['a', 'b'], []), guide: null,
			views: [a, view('b', 1)], evaluation: plan(), selection: { viewId: 'a' } };
		const still = experienceMarkModel(input);
		const live = experienceMarkModel({
			...input, livePose: { viewId: 'a', eye: a.eye, target: a.target, fov: 90 }
		});
		const wedge = (model: typeof still, id: string) => model.frustums.find(item => item.viewId === id);
		expect(wedge(live, 'a')?.left).not.toEqual(wedge(still, 'a')?.left);
		expect(wedge(live, 'a')?.eye).toEqual(wedge(still, 'a')?.eye);
		expect(wedge(live, 'b')).toEqual(wedge(still, 'b'));
	});

});
