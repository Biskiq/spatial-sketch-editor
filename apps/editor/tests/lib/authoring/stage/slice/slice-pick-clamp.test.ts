/**
 * SL1 P2 — Layout picking follows the drawn cut (§2.5, test 8).
 *
 * Three rules, each pinned here:
 *
 * - A Wall face is clamped to what the Slice draws: with `cutY = 1.2`, a body from
 *   the datum to 3 m answers only inside `[0, 1.2]`, and a face entirely above the
 *   cut answers nowhere.
 * - A flat fragment whose elevation the cut hides is dropped (a room floor above the
 *   band is not a place the pointer can land).
 * - The resolved provider holds the invariant in one line: **no hit above the cut**.
 *   The same probe that picks a Wall at 2.6 m without a Slice must not return a point
 *   above 1.2 m with one.
 */
import { describe, expect, it } from 'vitest';
import {
	createViewportCameraState,
	evaluateViewport,
	projectWorld,
	type ViewportEvaluation
} from '@portfolio/camera-core';
import { evaluateLayoutPlan, type CompiledLayoutGeometry, type LayoutVec2, type PlanEvaluation, type PlanEvaluationResult } from '@portfolio/layout-core';
import {
	clampFaceToSlice,
	createPlanPickProvider,
	faceDrawn,
	flatDrawn,
	type StagePickSurface
} from '$lib/authoring/layout/plan-pick-provider';
import type { StageAdapterContext, StageDomainPick, StagePickQuery } from '$lib/authoring/stage/stage-facade';
import type { ResolvedSlice } from '$lib/authoring/stage/slice/slice-cut';
import { twoRoomGeometry, FIRST_ROOM_STANDING_POINT } from '../../../layout/__fixtures__/two-room-fixture';

const RECT = { left: 0, top: 0, width: 1280, height: 720, devicePixelRatio: 1 };
const CUT: ResolvedSlice = { kind: 'level', cutY: 1.2, lowerY: null };
const DRAWN: ResolvedSlice = {
	kind: 'drawn',
	origin: [0, 0, 0],
	along: [1, 0, 0],
	hiddenNormal: [0, 0, 1],
	halfLength: 2,
	depthMeters: 1,
	hidden: 'right',
	start: [-2, 0, 0],
	end: [2, 0, 0]
};

function planOf(geometry: CompiledLayoutGeometry): PlanEvaluation {
	const bounds = geometry.bounds!;
	const target: LayoutVec2 = [(bounds.min[0] + bounds.max[0]) / 2, (bounds.min[2] + bounds.max[2]) / 2];
	const result = evaluateLayoutPlan(
		geometry,
		{
			cutHeightMeters: 1.2,
			depthMeters: 100,
			lateralSpanHalfWidthMeters: null,
			sourceKindFilter: null,
			reveal: []
		},
		{ generationId: 'generation-slice-pick', target, datumMeters: 0 }
	);
	if (result.kind !== 'evaluated') throw new Error('the fixture Plan did not evaluate');
	return result.plan;
}

function viewOf(): ViewportEvaluation {
	const camera = createViewportCameraState({
		outputId: 'output-slice-pick',
		sessionEpoch: 'session-slice-pick',
		sourceRevision: 'content-slice-pick',
		reading: '3d',
		pose: {
			target: [FIRST_ROOM_STANDING_POINT[0], 0, FIRST_ROOM_STANDING_POINT[2]],
			azimuthRadians: Math.PI / 4,
			elevationRadians: 0.6,
			targetPlaneHeightMeters: 12
		},
		sceneRadiusMeters: 10
	} as never);
	const result = evaluateViewport(camera, RECT, 0, 1);
	if (result.kind !== 'evaluated') throw new Error(`the viewport did not evaluate: ${result.reason}`);
	return result.evaluation;
}

describe('clampFaceToSlice: a face answers only where it is drawn', () => {
	const face: StagePickSurface = { kind: 'face', start: [0, 0], end: [4, 0], bottomMeters: 0, topMeters: 3 };

	it('leaves a face untouched without a cut', () => {
		expect(clampFaceToSlice(face, null)).toBe(face);
	});

	it('clamps the top to the cut and the bottom to a finite depth', () => {
		expect(clampFaceToSlice(face, CUT)).toMatchObject({ bottomMeters: 0, topMeters: 1.2 });
		expect(clampFaceToSlice(face, { ...CUT, lowerY: 0.5 })).toMatchObject({
			bottomMeters: 0.5,
			topMeters: 1.2
		});
	});

	it('drops a face entirely above the cut, and keeps one entirely below it', () => {
		expect(clampFaceToSlice({ ...face, bottomMeters: 2, topMeters: 3 }, CUT)).toBeNull();
		expect(clampFaceToSlice({ ...face, bottomMeters: 0, topMeters: 1.2 }, CUT)).toMatchObject({
			topMeters: 1.2
		});
		expect(
			clampFaceToSlice({ ...face, bottomMeters: 0, topMeters: 0.8 }, { ...CUT, lowerY: 1 })
		).toBeNull();
	});

	it('leaves a flat surface to the elevation test', () => {
		const flat: StagePickSurface = {
			kind: 'flat',
			elevationMeters: 2,
			geometry: { kind: 'polygon', polygon: [[0, 0], [1, 0], [1, 1]] }
		};
		expect(clampFaceToSlice(flat, CUT)).toBe(flat);
	});

	it('keeps a face that crosses the drawn slab even when all three stations are hidden', () => {
		// z from −2 (beyond the 1 m depth) to 2.1 (near side); the shown band −1…0
		// lies wholly between the endpoints and the midpoint.
		const crossing: StagePickSurface = { kind: 'face', start: [1, -2], end: [1, 2.1], bottomMeters: 0, topMeters: 3 };
		expect(faceDrawn(crossing, DRAWN)).toBe(true);
		expect(faceDrawn({ ...crossing, start: [1, 2], end: [1, 4] }, DRAWN)).toBe(false);
		// Outside the finite extent both sides remain pickable.
		expect(faceDrawn({ ...crossing, start: [3, -2], end: [3, 2] }, DRAWN)).toBe(true);
	});

	it('keeps a large flat fragment whose corners are hidden but whose centre is shown', () => {
		const floor: StagePickSurface = {
			kind: 'flat',
			elevationMeters: 0,
			geometry: { kind: 'polygon', polygon: [[-3, -2], [3, -2], [3, 2], [-3, 2]] }
		};
		expect(flatDrawn(floor, DRAWN)).toBe(true);
	});

	it('drops a flat fragment whose elevation the cut hides', () => {
		const high: StagePickSurface = {
			kind: 'flat',
			elevationMeters: 2,
			geometry: { kind: 'polygon', polygon: [[0, 0], [1, 0], [1, 1]] }
		};
		const low: StagePickSurface = { ...high, elevationMeters: 0.4 };
		expect(flatDrawn(high, CUT)).toBe(false);
		expect(flatDrawn(low, CUT)).toBe(true);
		expect(flatDrawn(high, null)).toBe(true);
	});
});

describe('the pick provider under a cut: nothing above is selectable', () => {
	const geometry = twoRoomGeometry();
	const plan = planOf(geometry);
	const planFor = (): PlanEvaluationResult => ({ kind: 'evaluated', plan });
	const view = viewOf();

	function cssOf(point: readonly [number, number, number]): [number, number] {
		const projected = projectWorld(point as [number, number, number], view, view.token);
		if (projected.kind !== 'projected' || projected.visibility === 'behind') {
			throw new Error('the probe did not project');
		}
		return [projected.css[0] - view.rect.left, projected.css[1] - view.rect.top];
	}

	function pick(css: readonly [number, number], slice: ResolvedSlice | null): StageDomainPick | null {
		const context = {
			snapshot: { domain: { geometry, datumMeters: 0 } },
			evaluation: view,
			evaluationId: 'evaluation',
			pickScene: () => null
		} as unknown as StageAdapterContext;
		const query: StagePickQuery = {
			evaluationId: 'evaluation',
			css,
			purpose: 'select',
			tool: null
		} as StagePickQuery;
		return createPlanPickProvider(planFor, () => [], () => slice)(query, context);
	}

	/** A Wall's own centreline midpoint: a face the camera can see from this pose. */
	const wall = geometry.walls[0]!;
	const sample = wall.samples[Math.floor(wall.samples.length / 2)]!;
	const station: readonly [number, number] = [sample.point[0], sample.point[1]];

	it('selects the Wall above the cut when there is no Slice', () => {
		const hit = pick(cssOf([station[0], 2.6, station[1]]), null);

		expect(hit).not.toBeNull();
		expect(hit!.hit.sourceId).toBe(wall.wallId);
		expect(hit!.hit.worldPoint[1]).toBeGreaterThan(CUT.cutY);
	});

	it('returns no point above the cut once the Slice exists', () => {
		const hit = pick(cssOf([station[0], 2.6, station[1]]), CUT);

		// Either nothing is there, or what answered is inside the drawn band: a hit
		// that reports a height the creator cannot see is the defect this pins.
		if (hit !== null) expect(hit.hit.worldPoint[1]).toBeLessThanOrEqual(CUT.cutY + 1e-6);
		expect(hit?.hit.sourceId).not.toBe(wall.wallId);
	});

	it('still selects the Wall inside the visible band', () => {
		const hit = pick(cssOf([station[0], 0.5, station[1]]), CUT);

		expect(hit).not.toBeNull();
		expect(hit!.hit.sourceId).toBe(wall.wallId);
		expect(hit!.hit.worldPoint[1]).toBeLessThanOrEqual(CUT.cutY + 1e-6);
	});

	it('offers the cap band at the cut height for the same Wall', () => {
		// On the cut plane the exposed top is a surface: the pick reports a point at
		// `cutY` there rather than nothing (the band clamp alone would give a line).
		const hit = pick(cssOf([station[0], CUT.cutY, station[1]]), CUT);

		expect(hit).not.toBeNull();
		expect(hit!.hit.worldPoint[1]).toBeCloseTo(CUT.cutY, 5);
	});
});
