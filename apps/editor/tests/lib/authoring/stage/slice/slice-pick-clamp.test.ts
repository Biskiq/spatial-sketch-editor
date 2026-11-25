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
import { createViewportCameraState, evaluateViewport, projectWorld, type ViewportEvaluation } from '@portfolio/camera-core/viewport';
import { evaluateLayoutPlan, type PlanEvaluation, type PlanEvaluationResult } from '@portfolio/layout-core/world';
import type { CompiledLayoutGeometry, LayoutVec2 } from '@portfolio/layout-core/geometry';
import {
	clampFaceToSlice,
	clipSurfaceToSlice,
	createPlanPickProvider,
	flatDrawn,
	type StagePickSurface
} from '$lib/authoring/layout/plan-pick-provider';
import type { StageAdapterContext, StageDomainPick, StagePickQuery } from '$lib/authoring/stage/stage-facade';
import { resolveSlice, sliceHides, type ResolvedSlice } from '$lib/authoring/stage/slice/slice-cut';
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

	it('clips a face that crosses the drawn slab to exactly its shown span', () => {
		// z from −2 (beyond the 1 m depth) to 2.1 (near side); the shown band −1…0
		// lies wholly between the endpoints and the midpoint.
		const crossing: StagePickSurface = { kind: 'face', start: [1, -2], end: [1, 2.1], bottomMeters: 0, topMeters: 3 };
		const shown = clipSurfaceToSlice(crossing, DRAWN);
		expect(shown).toHaveLength(1);
		const span = shown[0]! as Extract<StagePickSurface, { kind: 'face' }>;
		expect(Math.min(span.start[1], span.end[1])).toBeCloseTo(-1, 3);
		expect(Math.max(span.start[1], span.end[1])).toBeCloseTo(0, 3);
		expect(span).toMatchObject({ bottomMeters: 0, topMeters: 3 });
		// Wholly on the near side: nothing to pick.
		expect(clipSurfaceToSlice({ ...crossing, start: [1, 2], end: [1, 4] }, DRAWN)).toEqual([]);
		// Outside the finite extent both sides remain pickable, whole.
		const outside = clipSurfaceToSlice({ ...crossing, start: [3, -2], end: [3, 2] }, DRAWN);
		expect(outside).toHaveLength(1);
		expect(outside[0]).toMatchObject({ start: [3, -2], end: [3, 2] });
	});

	it('splits a face that leaves the extent into its shown pieces only', () => {
		// Along the near side at z = 0.5, from x = −4 to 4: shown beyond |x| > 2 only.
		const face: StagePickSurface = { kind: 'face', start: [-4, 0.5], end: [4, 0.5], bottomMeters: 0, topMeters: 3 };
		const shown = clipSurfaceToSlice(face, DRAWN) as Extract<StagePickSurface, { kind: 'face' }>[];
		expect(shown).toHaveLength(2);
		const xs = shown.map((piece) => [piece.start[0], piece.end[0]].sort((a, b) => a - b));
		expect(xs[0]![0]).toBeCloseTo(-4, 9);
		expect(xs[0]![1]).toBeCloseTo(-2, 3);
		expect(xs[1]![0]).toBeCloseTo(2, 3);
		expect(xs[1]![1]).toBeCloseTo(4, 9);
	});

	it('keeps a large flat fragment whose corners are hidden but whose centre is shown', () => {
		const floor: StagePickSurface = {
			kind: 'flat',
			elevationMeters: 0,
			geometry: { kind: 'polygon', polygon: [[-3, -2], [3, -2], [3, 2], [-3, 2]] }
		};
		expect(flatDrawn(floor, DRAWN)).toBe(true);
		// Three pieces: both ends beyond the extent and the shown band between.
		const pieces = clipSurfaceToSlice(floor, DRAWN);
		expect(pieces).toHaveLength(3);
	});

	it('finds a narrow shown strip that every vertex, midpoint and centroid misses', () => {
		// The reviewer's reproducer: a thin triangle crossing the shown band −1…0 with all
		// samples in hidden regions. Either winding.
		for (const polygon of [
			[[-1, 10], [1, 10], [0, -1.1]],
			[[0, -1.1], [1, 10], [-1, 10]]
		] as [number, number][][]) {
			const sliver: StagePickSurface = { kind: 'flat', elevationMeters: 0, geometry: { kind: 'polygon', polygon } };
			expect(flatDrawn(sliver, DRAWN)).toBe(true);
			const pieces = clipSurfaceToSlice(sliver, DRAWN);
			expect(pieces).toHaveLength(1);
			const points = (pieces[0]! as { geometry: { polygon: readonly (readonly [number, number])[] } }).geometry.polygon;
			for (const [x, z] of points) {
				expect(z).toBeGreaterThanOrEqual(-1 - 1e-3);
				expect(z).toBeLessThanOrEqual(1e-3);
				expect(sliceHides(DRAWN, x, 0, z, 1e-3)).toBe(false);
			}
		}
	});

	it('drops a flat fragment wholly hidden by the drawn cut, and clips a line to its shown pieces', () => {
		const near: StagePickSurface = {
			kind: 'flat',
			elevationMeters: 0,
			geometry: { kind: 'polygon', polygon: [[-1, 0.5], [1, 0.5], [1, 1.5], [-1, 1.5]] }
		};
		expect(flatDrawn(near, DRAWN)).toBe(false);
		expect(clipSurfaceToSlice(near, DRAWN)).toEqual([]);
		const line: StagePickSurface = { kind: 'flat', elevationMeters: 0, geometry: { kind: 'span', start: [0, -3], end: [0, 3] } };
		const shown = clipSurfaceToSlice(line, DRAWN);
		expect(shown).toHaveLength(1);
		expect(shown[0]).toMatchObject({ geometry: { kind: 'span' } });
	});

	it('leaves Level surfaces to SL1’s clamp and elevation rules', () => {
		const face: StagePickSurface = { kind: 'face', start: [0, 0], end: [1, 0], bottomMeters: 0, topMeters: 3 };
		expect(clipSurfaceToSlice(face, CUT)).toEqual([{ ...face, topMeters: 1.2 }]);
		expect(clipSurfaceToSlice(face, null)).toEqual([face]);
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

	function pick(
		css: readonly [number, number],
		slice: ResolvedSlice | null,
		cutaway: { readonly wallIds: ReadonlySet<string>; readonly stubTopY: number } | null = null
	): StageDomainPick | null {
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
		return createPlanPickProvider(planFor, () => [], () => slice, () => cutaway)(query, context);
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

	describe('X2 cutaway: only the cut Wall loses its upper pick quad', () => {
		const cutaway = { wallIds: new Set([wall.wallId]), stubTopY: 1 };
		const other = geometry.walls[1]!;
		const otherSample = other.samples[Math.floor(other.samples.length / 2)]!;
		const otherStation: readonly [number, number] = [otherSample.point[0], otherSample.point[1]];

		it('still selects a whole Wall above the shared stub height', () => {
			const hit = pick(cssOf([otherStation[0], 2.6, otherStation[1]]), null, cutaway);
			expect(hit?.hit.sourceId).toBe(other.wallId);
			expect(hit!.hit.worldPoint[1]).toBeGreaterThan(1);
		});

		it('removes the cut Wall above its stub and keeps it below', () => {
			const above = pick(cssOf([station[0], 2.6, station[1]]), null, cutaway);
			expect(above?.hit.sourceId).not.toBe(wall.wallId);

			const below = pick(cssOf([station[0], 0.5, station[1]]), null, cutaway);
			expect(below?.hit.sourceId).toBe(wall.wallId);
			expect(below!.hit.worldPoint[1]).toBeLessThanOrEqual(1 + 1e-6);
		});
	});
});

describe('the pick provider under a drawn cut: only what is drawn answers', () => {
	const geometry = twoRoomGeometry();
	const plan = planOf(geometry);
	const planFor = (): PlanEvaluationResult => ({ kind: 'evaluated', plan });
	const view = viewOf();
	const wall = geometry.walls[0]!;
	const sample = wall.samples[Math.floor(wall.samples.length / 2)]!;
	const station: readonly [number, number] = [sample.point[0], sample.point[1]];
	const first = wall.samples[0]!.point;
	const last = wall.samples[wall.samples.length - 1]!.point;
	const length = Math.hypot(last[0] - first[0], last[1] - first[1]);
	const along: [number, number] = [(last[0] - first[0]) / length, (last[1] - first[1]) / length];
	const across: [number, number] = [-along[1], along[0]];
	// A segment across the Wall at its midpoint; the depth leaves a 0.5 m shown strip
	// of the Wall on one side and hides the rest of it inside the extent.
	const drawn = (() => {
		const value = resolveSlice(
			{
				kind: 'drawn',
				start: [station[0] - across[0] * 1.5, station[1] - across[1] * 1.5],
				end: [station[0] + across[0] * 1.5, station[1] + across[1] * 1.5],
				hidden: 'right',
				depthMeters: 0.5
			},
			{ sheetHeight: 0, datumMeters: 0 }
		);
		if (value.kind !== 'drawn') throw new Error('expected a drawn reading');
		return value;
	})();
	const shownSign = -Math.sign(drawn.hiddenNormal[0] * along[0] + drawn.hiddenNormal[2] * along[1]);
	const onWall = (offset: number, y: number): [number, number, number] => [
		station[0] + along[0] * offset * shownSign,
		y,
		station[1] + along[1] * offset * shownSign
	];

	function cssOf(point: readonly [number, number, number]): [number, number] {
		const projected = projectWorld(point as [number, number, number], view, view.token);
		if (projected.kind !== 'projected' || projected.visibility === 'behind') throw new Error('the probe did not project');
		return [projected.css[0] - view.rect.left, projected.css[1] - view.rect.top];
	}

	function pick(css: readonly [number, number], slice: ResolvedSlice | null): StageDomainPick | null {
		const context = {
			snapshot: { domain: { geometry, datumMeters: 0 } },
			evaluation: view,
			evaluationId: 'evaluation',
			pickScene: () => null
		} as unknown as StageAdapterContext;
		const query = { evaluationId: 'evaluation', css, purpose: 'select', tool: null } as StagePickQuery;
		return createPlanPickProvider(planFor, () => [], () => slice)(query, context);
	}

	it('the probes are where the test says: one on the shown strip, one in the hidden part', () => {
		expect(sliceHides(drawn, ...onWall(0.25, 1.5))).toBe(false);
		expect(sliceHides(drawn, ...onWall(-1, 2))).toBe(true);
		expect(pick(cssOf(onWall(-1, 2)), null)?.hit.sourceId).toBe(wall.wallId);
	});

	it('still selects the Wall on its shown strip', () => {
		const hit = pick(cssOf(onWall(0.25, 1.5)), drawn);
		expect(hit?.hit.sourceId).toBe(wall.wallId);
		expect(sliceHides(drawn, ...(hit!.hit.worldPoint as [number, number, number]))).toBe(false);
	});

	it('never selects the Wall through its clipped-away part', () => {
		const hit = pick(cssOf(onWall(-1, 2)), drawn);
		expect(hit?.hit.sourceId).not.toBe(wall.wallId);
	});

	it('no direct (zero-distance) hit across the viewport lands on a hidden point', () => {
		let direct = 0;
		for (let x = 40; x < RECT.width; x += 40) {
			for (let y = 30; y < RECT.height; y += 30) {
				const hit = pick([x, y], drawn);
				if (hit === null || hit.cssDistance !== 0) continue;
				direct += 1;
				const [px, py, pz] = hit.hit.worldPoint as [number, number, number];
				expect(sliceHides(drawn, px, py, pz, 1e-3), `hit at css ${x},${y}`).toBe(false);
			}
		}
		expect(direct).toBeGreaterThan(20);
	});
});
