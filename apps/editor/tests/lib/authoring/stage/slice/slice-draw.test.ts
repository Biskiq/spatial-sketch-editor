/**
 * The drawn gesture's command lifecycle: a press commits one finite segment,
 * a second replaces it, the endpoint and line grips edit in place, and cancel
 * leaves the last committed reading untouched. The real projection/snap path is
 * faked at the one facade boundary the controller uses.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { STAGE_DRAFTING_DEFAULTS } from '$lib/authoring/stage/stage-drafting';
import type { StageFacade } from '$lib/authoring/stage/stage-facade';
import { createSliceDraw } from '$lib/authoring/stage/slice/slice-draw.svelte';
import { sliceReading } from '$lib/authoring/stage/slice/slice-reading.svelte';

function fakeFacade(scale = 1): StageFacade {
	return {
		hostToolTarget: (query: { css: readonly [number, number] }) => ({
			kind: 'hit',
			refusal: null,
			hit: { worldPoint: [query.css[0] / scale, 0, query.css[1] / scale] },
			adapterId: 'test',
			datumPoint: [query.css[0] / scale, 0, query.css[1] / scale]
		}),
		drafting: () => STAGE_DRAFTING_DEFAULTS,
		acquireGesture: () => ({
			kind: 'granted',
			lease: { active: true, release: () => {} }
		}),
		projectWorld: (point: readonly [number, number, number]) => ({
			kind: 'projected',
			css: [point[0] * scale, point[2] * scale]
		}),
		evaluation: () => ({ rect: { left: 0, top: 0, width: 100, height: 100 } })
	} as unknown as StageFacade;
}

const input = (css: readonly [number, number]) => ({
	css,
	evaluationId: 'evaluation-1',
	coarse: false
});

describe('drawn slice gesture', () => {
	beforeEach(() => sliceReading.clear());

	function controller(
		bounds: { min: [number, number, number]; max: [number, number, number] } | null = null,
		scale = 1
	) {
		return createSliceDraw({
			facade: () => fakeFacade(scale),
			evaluationId: () => 'evaluation-1',
			renderedReading: () => 'plan',
			eye: () => null,
			bounds: () => bounds,
			datumMeters: () => 0,
			notice: () => {}
		});
	}

	it('commits one finite segment and a second press replaces it', () => {
		const draw = controller();
		draw.arm();
		expect(draw.down(input([0, 0]))).toBe(true);
		draw.move(input([40, 0]));
		draw.up(input([40, 0]));
		const first = sliceReading.reading;
		expect(first).toMatchObject({ kind: 'drawn', start: [0, 0], end: [40, 0], hidden: 'right', depthMeters: 0.1 });

		expect(draw.down(input([10, 20]))).toBe(true);
		draw.move(input([50, 20]));
		draw.up(input([50, 20]));
		const second = sliceReading.reading;
		expect(second).toMatchObject({ kind: 'drawn', start: [10, 20], end: [50, 20] });
		expect(second).not.toEqual(first);
	});

	it('resizes an endpoint and moves the line without authoring', () => {
		const draw = controller();
		draw.arm();
		draw.down(input([0, 0]));
		draw.move(input([40, 40]));
		draw.up(input([40, 40]));

		// The start grip projects to (0, 0); drag it to (10, 0).
		expect(draw.down(input([0, 0]))).toBe(true);
		draw.move(input([10, 0]));
		draw.up(input([10, 0]));
		const resized = sliceReading.reading;
		if (resized?.kind !== 'drawn') throw new Error('expected a drawn reading');
		expect(resized.start[0]).toBeCloseTo(10, 9);
		expect(resized.start[1]).toBeCloseTo(0, 9);
		expect(resized.end[0]).toBeCloseTo(40, 9);
		expect(resized.end[1]).toBeCloseTo(40, 9);

		// The line midpoint projects to (25, 20): translate by (+5, +5).
		expect(draw.down(input([25, 20]))).toBe(true);
		draw.move(input([30, 25]));
		draw.up(input([30, 25]));
		const moved = sliceReading.reading;
		if (moved?.kind !== 'drawn') throw new Error('expected a drawn reading');
		expect(moved.start[0]).toBeCloseTo(15, 9);
		expect(moved.start[1]).toBeCloseTo(5, 9);
		expect(moved.end[0]).toBeCloseTo(45, 9);
		expect(moved.end[1]).toBeCloseTo(45, 9);
	});

	it('deepens along the shown-side ray and clamps at the far side', () => {
		const draw = controller({ min: [-100, 0, -100], max: [100, 10, 100] }, 20);
		draw.arm();
		draw.down(input([0, 0]));
		draw.move(input([800, 0]));
		draw.up(input([800, 0]));
		draw.setDepth(20);

		// At 20 px/m the grip is 400 px out on the visible (−z) side; drag it
		// another 200 px (10 m) away from the cut.
		expect(draw.down(input([400, -400]))).toBe(true);
		draw.move(input([400, -600]));
		draw.up(input([400, -600]));
		expect(sliceReading.reading).toMatchObject({ depthMeters: 30 });

		// The far side of the bounds is 100 m: a drag past it stops there.
		expect(draw.down(input([400, -600]))).toBe(true);
		draw.move(input([400, -6000]));
		draw.up(input([400, -6000]));
		expect(sliceReading.reading).toMatchObject({ depthMeters: 100 });
	});

	it('Flip reverses the side, and cancel leaves the reading alone', () => {
		const draw = controller();
		draw.arm();
		draw.down(input([0, 0]));
		draw.move(input([40, 0]));
		draw.up(input([40, 0]));
		draw.flip();
		expect(sliceReading.reading).toMatchObject({ hidden: 'left' });

		const before = sliceReading.reading;
		draw.down(input([0, 0]));
		draw.move(input([3, 3]));
		expect(draw.cancelDraft()).toBe(true);
		expect(sliceReading.reading).toEqual(before);
	});

	it('refuses a tap that is not a cut', () => {
		const draw = controller();
		draw.arm();
		expect(draw.down(input([1, 1]))).toBe(true);
		draw.up(input([1, 1]));
		expect(sliceReading.reading).toBeNull();
		expect(draw.hasDraft()).toBe(false);
	});
});
