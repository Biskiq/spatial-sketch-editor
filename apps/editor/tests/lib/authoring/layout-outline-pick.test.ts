/**
 * T1 X1 — a lifted overhead is reachable through the outline it is drawn as.
 *
 * A lift removes the lid from the view and from rays, so the dashed line is the
 * only thing standing for it. This suite drives the real Layout pick provider
 * against a real compiled two-Room geometry and a real 3D evaluation:
 *
 * - a click within 8 CSS px of the outline names the Room's own `room-floor` ref;
 * - a click in the room's middle falls through to the floor beneath;
 * - an outline behind a nearer drawn surface is not a hit;
 * - in Plan, and for a tool, nothing changes;
 * - without Lift the provider answers exactly as it did before the accessor existed.
 *
 * `pickScene` is the one stub: the lid's own disappearance is pinned in
 * `layout-room-representation.test.ts`, and this suite is about which Layout
 * subject the outline names.
 */
import { describe, expect, it } from 'vitest';
import { PerspectiveCamera } from 'three';
import { createViewportCameraState, evaluateViewport, eyeOfInspectionPose, projectWorld, pointerRay, type ViewportEvaluation } from '@portfolio/camera-core/viewport';
import { evaluateLayoutPlan, type PlanEvaluation, type PlanEvaluationResult } from '@portfolio/layout-core/world';
import { overheadSourcesOf, type CompiledLayoutGeometry, type LayoutVec2 } from '@portfolio/layout-core/geometry';

import { createPlanPickProvider } from '$lib/authoring/layout/plan-pick-provider';
import type { StageAdapterContext, StageDomainPick, StagePickQuery } from '$lib/authoring/stage/stage-facade';
import { twoRoomGeometry, FIRST_ROOM_STANDING_POINT } from '../layout/__fixtures__/two-room-fixture';

const RECT = { left: 0, top: 0, width: 1280, height: 720, devicePixelRatio: 1 };

function planOf(geometry: CompiledLayoutGeometry): PlanEvaluation {
	const bounds = geometry.bounds!;
	const target: LayoutVec2 = [
		(bounds.min[0] + bounds.max[0]) / 2,
		(bounds.min[2] + bounds.max[2]) / 2
	];
	const result = evaluateLayoutPlan(
		geometry,
		{
			cutHeightMeters: 1.2,
			depthMeters: 100,
			lateralSpanHalfWidthMeters: null,
			sourceKindFilter: null,
			reveal: []
		},
		{ generationId: 'generation-outline-pick', target, datumMeters: 0 }
	);
	if (result.kind !== 'evaluated') throw new Error('the fixture Plan did not evaluate');
	return result.plan;
}

function viewOf(readings: '3d' | 'plan'): ViewportEvaluation {
	const camera = createViewportCameraState({
		outputId: `output-outline-${readings}`,
		sessionEpoch: `session-outline-${readings}`,
		sourceRevision: `content-outline-${readings}`,
		reading: readings,
		pose: {
			target: [FIRST_ROOM_STANDING_POINT[0], 0, FIRST_ROOM_STANDING_POINT[2]],
			azimuthRadians: Math.PI / 4,
			// 3D cannot look straight down (its up vector collapses there); Plan can.
			elevationRadians: readings === '3d' ? 0.85 : Math.PI / 2,
			targetPlaneHeightMeters: 14
		},
		sceneRadiusMeters: 10
	} as never);
	const result = evaluateViewport(camera, RECT, 0, 1);
	if (result.kind !== 'evaluated') throw new Error(`the viewport did not evaluate: ${result.reason}`);
	expect(result.evaluation.renderedReading).toBe(readings);
	return result.evaluation;
}

function cssOf(evaluation: ViewportEvaluation, point: readonly [number, number, number]): [number, number] {
	const projected = projectWorld(point as [number, number, number], evaluation, evaluation.token);
	if (projected.kind !== 'projected' || projected.visibility === 'behind') {
		throw new Error('the probe did not project');
	}
	return [projected.css[0] - evaluation.rect.left, projected.css[1] - evaluation.rect.top];
}

describe('T1 X1 — picking a lifted overhead', () => {
	const geometry = twoRoomGeometry();
	const plan = planOf(geometry);
	const planFor = (): PlanEvaluationResult => ({ kind: 'evaluated', plan });
	const room = geometry.rooms.find((candidate) =>
		candidate.floorPolygon.some((point) => point[0] === 0)
	)!;
	/* The one authority names the lid; the test never derives an outline itself. */
	const source = overheadSourcesOf(geometry, { kind: 'space', roomId: room.roomId })[0]!;
	const sources = [source];
	/* The dashed line is drawn a centimetre under the lid it stands for. */
	const drawnAt = source.elevation - 0.01;

	function pick(
		evaluation: ViewportEvaluation,
		css: readonly [number, number],
		options: {
			readonly lifted?: boolean;
			/** The accessor supplied but answering empty: the explicit "Lift off" form. */
			readonly emptyAccessor?: boolean;
			readonly purpose?: 'select' | 'hover' | 'tool';
			readonly drawn?: { readonly distanceMeters: number } | null;
		} = {}
	): StageDomainPick | null {
		const context = {
			snapshot: { domain: { geometry, datumMeters: 0 } },
			evaluation,
			evaluationId: 'evaluation',
			pickScene: () => options.drawn ?? null
		} as unknown as StageAdapterContext;
		const query: StagePickQuery = {
			evaluationId: 'evaluation',
			css,
			purpose: options.purpose ?? 'select',
			tool: options.purpose === 'tool' ? { kind: 'erase' } : null
		} as StagePickQuery;
		const provider = options.emptyAccessor
			? createPlanPickProvider(planFor, () => [])
			: options.lifted
				? createPlanPickProvider(planFor, () => sources)
				: createPlanPickProvider(planFor);
		return provider(query, context);
	}

	const view = viewOf('3d');
	const eye = eyeOfInspectionPose(view.pose);
	/** The outline edge the camera is nearest, so the probe is on a visible boundary. */
	const edgeMidpoint = (() => {
		let best: { readonly point: LayoutVec2; readonly distance: number } | null = null;
		const outline = source.outline;
		for (let index = 0; index < outline.length; index += 1) {
			const start = outline[index]!;
			const end = outline[(index + 1) % outline.length]!;
			const point: LayoutVec2 = [(start[0] + end[0]) / 2, (start[1] + end[1]) / 2];
			const distance = Math.hypot(point[0] - eye[0], point[1] - eye[2]);
			if (best === null || distance < best.distance) best = { point, distance };
		}
		return best!.point;
	})();
	const outlinePoint: [number, number, number] = [edgeMidpoint[0], drawnAt, edgeMidpoint[1]];
	const centroid = source.outline.reduce<LayoutVec2>(
		(accumulator, point) => [
			accumulator[0] + point[0] / source.outline.length,
			accumulator[1] + point[1] / source.outline.length
		],
		[0, 0]
	);
	const outlineCss = cssOf(view, outlinePoint);

	it('names the Room through the dashed outline', () => {
		const hit = pick(view, outlineCss, { lifted: true });
		expect(hit?.hit.sourceKind).toBe('room-floor');
		expect(hit?.hit.sourceId).toBe(room.roomId);
		expect(hit?.cssDistance).toBeLessThanOrEqual(8);
		expect(hit?.depthMeters).toBeGreaterThan(0);
		expect(hit?.refusal).toBeNull();
	});

	it('is unchanged without Lift, at every probe', () => {
		const probes: [number, number][] = [
			outlineCss,
			cssOf(view, [centroid[0], 0, centroid[1]]),
			[140, 90]
		];
		for (const css of probes) {
			// An accessor that reports no lifted overheads and the provider's old
			// one-argument form answer identically: Lift off is today's pick, exactly.
			expect(pick(view, css, { emptyAccessor: true })).toEqual(pick(view, css));
		}
		// And Lift on is the one probe that differs, at the outline itself.
		expect(pick(view, outlineCss, { lifted: true })).not.toEqual(pick(view, outlineCss));
	});

	it('lets a click in the middle fall through to the floor beneath', () => {
		const css = cssOf(view, [centroid[0], 0, centroid[1]]);
		const hit = pick(view, css, { lifted: true });
		expect(hit?.hit.sourceKind).toBe('room-floor');
		expect(hit?.hit.sourceId).toBe(room.roomId);
		// The floor's own plane, not the line under the lid: the middle of a room is
		// never within 8 px of its outline.
		expect(hit?.cssDistance).toBe(0);
		const ray = pointerRay([css[0] + view.rect.left, css[1] + view.rect.top], view, view.token);
		expect(ray.kind).toBe('ray');
		if (ray.kind !== 'ray') return;
		const floorDepth = (0 - ray.ray.origin[1]) / ray.ray.direction[1];
		expect(hit?.depthMeters).toBeCloseTo(floorDepth, 6);
	});

	it('refuses an outline behind a nearer drawn surface', () => {
		const on = pick(view, outlineCss, { lifted: true });
		expect(on?.hit.sourceId).toBe(room.roomId);
		const depth = on?.depthMeters ?? 0;
		// A Wall two metres in front of the outline: the creator is looking at the Wall,
		// so the lift is not editable through it.
		const occluded = pick(view, outlineCss, { lifted: true, drawn: { distanceMeters: depth - 2 } });
		expect(occluded?.hit.sourceId).not.toBe(room.roomId);
		// A surface *behind* the outline hides nothing.
		expect(
			pick(view, outlineCss, { lifted: true, drawn: { distanceMeters: depth + 2 } })?.hit.sourceId
		).toBe(room.roomId);
	});

	it('never answers from the outline in Plan, or for a tool', () => {
		const planView = viewOf('plan');
		const planCss = cssOf(planView, outlinePoint);
		expect(pick(planView, planCss, { lifted: true })).toEqual(pick(planView, planCss));
		expect(pick(view, outlineCss, { lifted: true, purpose: 'tool' })).toEqual(
			pick(view, outlineCss, { purpose: 'tool' })
		);
	});
});
