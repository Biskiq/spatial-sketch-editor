import { describe, expect, it } from 'vitest';

import {
	buildGestureFrameSeries,
	correlatePresentedFrames,
	createP23BGestureFrameSampler,
	createP23BLongFrameObserver,
	mergeGestureFrameSeries,
	summarizeLongFrames,
	P23B_M1_GESTURE_FRAME_DEFINITION,
	P23B_M1_LONG_FRAME_DEFINITION
} from '$lib/bench/p23b-m1-frame-timing';

/**
 * The M1 instruments are two rows the plan authorizes separately, so these tests
 * pin exactly the properties that make those rows readable: the gesture series is
 * correlated from the frames' own timestamps (not from an assumed cadence), the
 * long-frame row is an incidence row whose unsupported case is NOT MEASURED
 * rather than zero, and the presented-frame row is the only thing allowed to be
 * called a presented frame.
 */

function dragSeries(input: {
	label: string;
	startedAt: number;
	frames: { end: number; interval: number }[];
	marks: { name: string; startTime: number; duration: number }[];
}) {
	return buildGestureFrameSeries({
		label: input.label,
		startedAt: input.startedAt,
		endedAt: input.startedAt + 1000,
		samples: input.frames,
		pointermoveMarks: input.marks
	});
}

describe('M1 (a) gesture frames', () => {
	it('counts a frame as correlated only when the pointermove mark covers its own timestamp', () => {
		const series = dragSeries({
			label: 'plan-drag-edit',
			startedAt: 100,
			frames: [
				{ end: 110, interval: 10 },
				{ end: 200, interval: 90 },
				{ end: 215, interval: 15 }
			],
			marks: [{ name: 'p2311:pointermove-rigid', startTime: 195, duration: 25 }]
		});
		// One of three frames is inside the mark's window; the row says so instead of
		// implying the whole series was measured under the product's own preview work.
		expect(series.coverage).toEqual({
			drags: 1,
			frames: 3,
			framesInsidePointermoveWindows: 2,
			pointermoveMarks: 1,
			pointermoveShare: 2 / 3
		});
		expect(series.definition).toBe(P23B_M1_GESTURE_FRAME_DEFINITION);
		expect(series.pointermove[0]).toMatchObject({ name: 'p2311:pointermove-rigid', count: 1, p50: 25 });
		// The incidence is counted against the frame budget and the long-frame line:
		// intervals 10 / 90 / 15, so only the 90 ms frame breaks either.
		expect(series.overFrameBudget).toBe(1);
		expect(series.over50Ms).toBe(1);
		expect(series.distribution.count).toBe(3);
	});

	it('merges many drags into one class row without hiding the drag count', () => {
		const first = dragSeries({
			label: 'bend-knot-edit',
			startedAt: 0,
			frames: [
				{ end: 16, interval: 16 },
				{ end: 33, interval: 17 }
			],
			marks: [{ name: 'p2311:pointermove-bend', startTime: 10, duration: 20 }]
		});
		const second = dragSeries({
			label: 'bend-knot-edit',
			startedAt: 500,
			frames: [{ end: 520, interval: 20 }],
			marks: [{ name: 'p2311:pointermove-bend', startTime: 515, duration: 8 }]
		});
		const merged = mergeGestureFrameSeries([first, second])!;
		expect(merged.coverage.drags).toBe(2);
		expect(merged.coverage.frames).toBe(3);
		expect(merged.coverage.framesInsidePointermoveWindows).toBe(2);
		expect(merged.samples).toHaveLength(3);
		expect(merged.pointermove[0]?.count).toBe(2);
		expect(mergeGestureFrameSeries([])).toBeNull();
	});

	it('samples rAF callbacks from an injected clock and reports null when the instrument is off', () => {
		let now = 1000;
		const queued: (() => void)[] = [];
		const enabled = true;
		const sampler = createP23BGestureFrameSampler({
			now: () => now,
			requestFrame: (callback) => {
				queued.push(callback);
				return queued.length;
			},
			cancelFrame: () => {},
			measures: () => [{ name: 'p2311:pointermove-rigid', startTime: 1000, duration: 30 }],
			enabled: () => enabled
		});
		sampler.start('plan-drag-edit');
		now = 1016;
		queued.shift()!();
		now = 1033;
		queued.shift()!();
		const series = sampler.stop()!;
		expect(series.frames).toBe(2);
		expect(series.distribution.p50).toBe(16);
		expect(series.coverage.framesInsidePointermoveWindows).toBe(1);
		// A stopped sampler reports nothing twice.
		expect(sampler.stop()).toBeNull();

		const off = createP23BGestureFrameSampler({ enabled: () => false, now: () => now });
		off.start('plan-drag-edit');
		expect(off.sampling()).toBe(false);
		expect(off.stop()).toBeNull();
	});
});

describe('M1 (b2) long-frame incidence', () => {
	it('is its own incidence row and never a latency row', () => {
		const summary = summarizeLongFrames(
			[
				{ startTime: 10, duration: 60, renderStart: 12, styleAndLayoutStart: 40, blockingDuration: 30, firstScriptStart: 10 },
				{ startTime: 200, duration: 130, renderStart: 205, styleAndLayoutStart: 210, blockingDuration: 100, firstScriptStart: 200 }
			],
			[
				{ start: 0, end: 50 },
				{ start: 180, end: 260 }
			]
		);
		expect(summary.definition).toBe(P23B_M1_LONG_FRAME_DEFINITION);
		expect(summary.frames).toBe(2);
		expect(summary.over100Ms).toBe(1);
		expect(summary.distribution.p50).toBe(60);
		// Both releases are touched by a long frame, and the row says out of how many.
		expect(summary.coverage).toEqual({ releases: 2, releasesTouched: 2, releasesTouchedShare: 1 });
		expect(summary.notMeasuredReason).toBeNull();
	});

	it('reports NOT MEASURED with a reason when the runtime has no observer', () => {
		const unsupported = createP23BLongFrameObserver({ supported: false, enabled: () => true });
		unsupported.start();
		expect(unsupported.observing()).toBe(false);
		expect(unsupported.stop()).toEqual([]);
		const explicit = summarizeLongFrames([], [], false, 'NOT MEASURED — runtime has no observer');
		expect(explicit.supported).toBe(false);
		expect(explicit.notMeasuredReason).toBe('NOT MEASURED — runtime has no observer');
	});

	it('collects what an injected observer delivers, and stops collecting after stop()', () => {
		let emit: ((entries: readonly any[]) => void) | null = null;
		const observer = createP23BLongFrameObserver({
			enabled: () => true,
			supported: true,
			observe: (onEntries) => {
				emit = onEntries;
				return { disconnect: () => {} };
			}
		});
		observer.start();
		expect(observer.observing()).toBe(true);
		emit!([
			{ startTime: 5, duration: 55, renderStart: 6, styleAndLayoutStart: 7, blockingDuration: 5, firstScriptStart: null }
		]);
		expect(observer.stop()).toHaveLength(1);
		expect(observer.observing()).toBe(false);
		expect(observer.stop()).toEqual([]);
	});
});

describe('M1 (b1) presented frames', () => {
	it('takes the first presented frame strictly after the release end and counts the rest unmeasured', () => {
		const row = correlatePresentedFrames({
			presented: [1000, 1016, 1032, 1048, 2000],
			releaseSpans: [
				{ actionIndex: 0, path: 'plan-drag-edit', outcome: 'accepted', start: 900, end: 1000 },
				{ actionIndex: 1, path: 'plan-drag-edit', outcome: 'accepted', start: 1040, end: 1048 }
			],
			offsetMs: 0,
			budgetMs: 100
		});
		expect(row.signal).toBe('presented-frame');
		expect(row.distribution.count).toBe(1);
		expect(row.samples).toEqual([{ actionIndex: 0, path: 'plan-drag-edit', latencyMs: 16 }]);
		// The release ending exactly on a presented frame takes the NEXT one, and a
		// release with no frame inside the budget is counted, never filled in.
		expect(row.coverage).toEqual({
			releases: 2,
			measuredReleases: 1,
			unmeasuredReleases: 1,
			measuredShare: 0.5
		});
		expect(row.byPath['plan-drag-edit']!.p50).toBe(16);
	});

	it('applies the calibration offset to the release side once', () => {
		const row = correlatePresentedFrames({
			presented: [5000, 5016],
			releaseSpans: [
				{ actionIndex: 0, path: 'wall-authoring', outcome: 'accepted', start: 900, end: 1000 }
			],
			// page clock + 4000 ms = trace clock, so the release end is 5000 in trace
			// time and the next presented frame is 5016.
			offsetMs: 4000,
			budgetMs: 100
		});
		expect(row.samples[0]?.latencyMs).toBe(16);
		expect(row.offsetMs).toBe(4000);
	});
});
