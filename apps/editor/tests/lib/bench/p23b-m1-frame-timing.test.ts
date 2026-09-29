import { describe, expect, it } from 'vitest';

import {
	buildGestureFrameSeries,
	correlatePresentedFrames,
	createP23BGestureFrameSampler,
	createP23BLongFrameObserver,
	mergeGestureFrameSeries,
	p23bM1PricesTraceSpan,
	summarizeLongFrames,
	summarizePresentedWindowArms,
	summarizePresentedWindowPhases,
	P23B_M1_GESTURE_FRAME_DEFINITION,
	P23B_M1_GESTURE_POPULATION_RULE,
	P23B_M1_LABEL_ARM_WINDOW_RULE,
	P23B_M1_LONG_FRAME_DEFINITION,
	P23B_M1_WINDOW_ARM_NOTE
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
			populationActions: 1,
			drags: 1,
			registeredDrags: 1,
			excludedDrags: 0,
			frames: 3,
			framesInsidePointermoveWindows: 2,
			pointermoveMarks: 1,
			pointermoveShare: 2 / 3
		});
		expect(series.populationRule).toBe(P23B_M1_GESTURE_POPULATION_RULE);
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

	it('reports which brackets it left out instead of averaging them in', () => {
		// The measured population is what may be merged. Every other bracket the
		// class made — warm-up drags, retried attempts — is counted, because a
		// series that silently pools them describes a population the class does not
		// report (the Electron all-curved rigid drag reported 26 drags where 20
		// accepted actions remained).
		const measured = [
			dragSeries({ label: 'plan-drag-edit', startedAt: 0, frames: [{ end: 16, interval: 16 }], marks: [] }),
			dragSeries({ label: 'plan-drag-edit', startedAt: 100, frames: [{ end: 116, interval: 16 }], marks: [] })
		];
		const merged = mergeGestureFrameSeries(measured, 26, 20)!;
		expect(merged.coverage).toMatchObject({
			populationActions: 20,
			drags: 2,
			registeredDrags: 26,
			excludedDrags: 24,
			frames: 2
		});
		// A registered count below the merged count cannot happen, so the row never
		// reports a negative exclusion.
		expect(mergeGestureFrameSeries(measured, 1, 20)!.coverage).toMatchObject({
			registeredDrags: 2,
			excludedDrags: 0
		});
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
		expect(row.samples).toEqual([
			// `presentedMs` is the same sample's presented instant on the TRACE clock —
			// the clock the window-phase split has to compare against.
			{ actionIndex: 0, path: 'plan-drag-edit', latencyMs: 16, presentedMs: 1016 }
		]);
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

/**
 * (b2) — the window-phase split. What is pinned here: the retention filter, the
 * clipping of spans that cross the window boundary, the ONE partition (frame
 * occupancy versus the rest) and the refusal to sum phases.
 */
describe('M1 (b2) post-release window, priced by trace durations', () => {
	it('retains only the span families the split prices', () => {
		expect(p23bM1PricesTraceSpan('AnimationFrame')).toBe(true);
		expect(p23bM1PricesTraceSpan('AnimationFrame::Render')).toBe(true);
		expect(p23bM1PricesTraceSpan('Paint')).toBe(true);
		expect(p23bM1PricesTraceSpan('UpdateLayoutTree')).toBe(true);
		expect(p23bM1PricesTraceSpan('V8.GC_SCAVENGER_SWEEP_ARRAY_BUFFERS')).toBe(true);
		// Instants and unrelated events are not retained: a capture that never asks
		// the window question must not grow because of it.
		expect(p23bM1PricesTraceSpan('AnimationFrame::Presentation')).toBe(false);
		expect(p23bM1PricesTraceSpan('TimeStamp')).toBe(false);
		expect(p23bM1PricesTraceSpan('ResourceSendRequest')).toBe(false);
	});

	it('splits the window into frame occupancy and the remainder, clipping each span', () => {
		const rows = summarizePresentedWindowPhases({
			windows: [{ key: 'f/room-creation-commit', actionIndex: 0, startMs: 1000, endMs: 1100 }],
			spans: [
				{ name: 'AnimationFrame', startMs: 1000, durMs: 20 },
				{ name: 'AnimationFrame', startMs: 1030, durMs: 50 },
				{ name: 'Paint', startMs: 1002, durMs: 8 },
				// Crosses the window's end: only the inside part may be counted.
				{ name: 'Paint', startMs: 1095, durMs: 20 },
				{ name: 'FunctionCall', startMs: 1000, durMs: 5 },
				// Outside the window entirely: retained by the runner, priced nowhere.
				{ name: 'Layout', startMs: 900, durMs: 40 }
			]
		});
		const row = rows['f/room-creation-commit']!;
		expect(row.windows).toBe(1);
		expect(row.windowMs.p50).toBe(100);
		expect(row.framesPerWindow.p50).toBe(2);
		// 20 + 50, never the two Paint spans added on top of them.
		expect(row.frameOccupiedMs.p50).toBe(70);
		expect(row.outsideFramesMs.p50).toBe(30);
		const phase = (name: string) => row.phases.find((entry) => entry.phase === name)!;
		expect(phase('paint').occurrences).toBe(2);
		expect(phase('paint').windowsPresentShare).toBe(1);
		// 8 inside, plus the 5 ms of the second span that fell inside the window.
		expect(phase('paint').occupiedMs.p50).toBe(13);
		expect(phase('script').occurrences).toBe(1);
		expect(phase('layout').occurrences).toBe(0);
		expect(phase('layout').occupiedMs.count).toBe(0);
	});

	it('unions nested spans of one phase instead of adding them', () => {
		// THE DEFECT THIS ROW WAS BORN WITH: `FunctionCall` nests inside
		// `FunctionCall`, so a SUM read a 235 ms window as 228 ms of JavaScript.
		const rows = summarizePresentedWindowPhases({
			windows: [{ key: 'f/room-creation-commit', actionIndex: 0, startMs: 0, endMs: 100 }],
			spans: [
				{ name: 'FunctionCall', startMs: 0, durMs: 40, functionName: 'outer', url: 'http://x/a/b.ts' },
				{ name: 'FunctionCall', startMs: 10, durMs: 20, functionName: 'inner', url: 'http://x/a/b.ts' },
				{ name: 'FunctionCall', startMs: 15, durMs: 5, functionName: 'inner', url: 'http://x/a/b.ts' }
			]
		});
		const row = rows['f/room-creation-commit']!;
		const script = row.phases.find((entry) => entry.phase === 'script')!;
		expect(script.occurrences).toBe(3);
		// 40 ms of stack, not 65 ms of spans.
		expect(script.occupiedMs.p50).toBe(40);
		// …and the row NAMES the JavaScript: the outer call leads, its union is itself.
		expect(row.scriptFunctions.map((entry) => entry.functionName)).toEqual(['outer', 'inner']);
		expect(row.scriptFunctions[0]!.totalOccupiedMs).toBe(40);
		expect(row.scriptFunctions[0]!.script).toBe('a/b.ts');
		// The two `inner` calls union to 20 ms ([10,30] with [15,20] inside it).
		expect(row.scriptFunctions[1]!.totalOccupiedMs).toBe(20);
	});

	it('keys a script row by definition site, not by name and file alone', () => {
		// WHY THE SITE IS PART OF THE KEY, from the run this row was added for: the
		// largest row in every class was `(anonymous)` in a pre-bundled dependency
		// chunk, and a name + file key merges every anonymous function in that chunk
		// into ONE row. The line is what maps back to source; without it the row says
		// "some anonymous function in chunk so-and-so", which cannot be acted on.
		const rows = summarizePresentedWindowPhases({
			windows: [{ key: 'f/rigid', actionIndex: 0, startMs: 0, endMs: 100 }],
			spans: [
				{ name: 'FunctionCall', startMs: 0, durMs: 60, url: 'http://x/deps/chunk-A.js', lineNumber: 120, columnNumber: 4 },
				{ name: 'FunctionCall', startMs: 10, durMs: 20, url: 'http://x/deps/chunk-A.js', lineNumber: 900, columnNumber: 12 },
				// The SAME site as the first span: it must join that row, not open a new one.
				{ name: 'FunctionCall', startMs: 70, durMs: 10, url: 'http://x/deps/chunk-A.js', lineNumber: 120, columnNumber: 4 }
			]
		});
		const row = rows['f/rigid']!;
		expect(row.scriptFunctions).toHaveLength(2);
		const [first, second] = row.scriptFunctions as [
			(typeof row.scriptFunctions)[number],
			(typeof row.scriptFunctions)[number]
		];
		expect(first.functionName).toBe('(anonymous)');
		expect(first.lineNumber).toBe(120);
		expect(first.columnNumber).toBe(4);
		// Both calls at that one site, unioned: [0,60] ∪ [70,80] = 70 ms.
		expect(first.occurrences).toBe(2);
		expect(first.totalOccupiedMs).toBe(70);
		expect(second.lineNumber).toBe(900);
	});

	it('unions overlapping frame spans instead of adding them', () => {
		const rows = summarizePresentedWindowPhases({
			windows: [{ key: 'f/whole-room', actionIndex: 3, startMs: 0, endMs: 100 }],
			spans: [
				{ name: 'AnimationFrame', startMs: 0, durMs: 30 },
				{ name: 'AnimationFrame', startMs: 10, durMs: 10 }
			]
		});
		expect(rows['f/whole-room']!.frameOccupiedMs.p50).toBe(30);
	});

	it('splits a class by the arm its action index was recorded against, and counts what it cannot place', () => {
		// THE ARM SPLIT. The placer's cost lives inside these windows, and the whole
		// reason the split exists is that the two arms can be measured in ONE session
		// instead of across three: the arm is chosen per attempt, the window is per
		// measured action, and the action index is what joins them.
		const windows = [
			{ key: 'f/whole-room', actionIndex: 0, startMs: 0, endMs: 100 },
			{ key: 'f/whole-room', actionIndex: 1, startMs: 0, endMs: 200 },
			// The action that never resolved: it has no arm, and it is NOT handed to
			// either side — an unattributed window in an arm cell would be invented.
			{ key: 'f/whole-room', actionIndex: 2, startMs: 0, endMs: 300 }
		];
		const split = summarizePresentedWindowArms({
			windows,
			spans: [
				{ name: 'FunctionCall', startMs: 0, durMs: 50, functionName: 'grid', url: 'http://x/plan-room-labels.ts', lineNumber: 7 },
				{ name: 'FunctionCall', startMs: 0, durMs: 50, functionName: 'grid', url: 'http://x/plan-room-labels.ts', lineNumber: 7 }
			],
			byAction: new Map([
				[0, 'per-cell-grid'],
				[1, 'pruned-grid']
			]),
			arms: ['pruned-grid', 'per-cell-grid'],
			afterArm: 'pruned-grid',
			beforeArm: 'per-cell-grid'
		});
		expect(split.unassignedWindows).toBe(1);
		const before = split.rows.find((row) => row.arm === 'per-cell-grid')!;
		const after = split.rows.find((row) => row.arm === 'pruned-grid')!;
		expect(before.assignedActions).toBe(1);
		expect(before.windows).toBe(1);
		// Each arm's row is the CLASS's own summary function over its own window, so a
		// single-window arm reads its own window back verbatim.
		expect(before.summary.windowMs.p50).toBe(100);
		expect(after.summary.windowMs.p50).toBe(200);
		const comparison = (label: string) => split.comparison.find((row) => row.label === label)!;
		// Signed AFTER − BEFORE: the shipped grid is the AFTER side, so a negative delta
		// is the change being faster.
		expect(comparison('window p50')).toMatchObject({ beforeMs: 100, afterMs: 200, deltaMs: 100, ratio: 2 });
		expect(comparison('script union p50')).toMatchObject({ beforeMs: 50, afterMs: 50, deltaMs: 0 });
		// The biggest AFTER frame is named back on the BEFORE side by name + file, so
		// the table names the work the arm moved and not only its total.
		expect(comparison('script x/plan-room-labels.ts grid p50')).toMatchObject({ beforeMs: 50, afterMs: 50 });
	});

	it('leaves an arm with no covered window null, so a thin arm is never read as zero', () => {
		const split = summarizePresentedWindowArms({
			windows: [{ key: 'f/bend', actionIndex: 0, startMs: 0, endMs: 100 }],
			spans: [],
			byAction: new Map([[0, 'pruned-grid']]),
			arms: ['pruned-grid', 'per-cell-grid'],
			afterArm: 'pruned-grid',
			beforeArm: 'per-cell-grid'
		});
		const before = split.rows.find((row) => row.arm === 'per-cell-grid')!;
		expect(before.windows).toBe(0);
		expect(before.assignedActions).toBe(0);
		expect(before.summary.windowMs.p50).toBe(0);
		expect(before.summary.windowMs.count).toBe(0);
		// …and the comparison refuses the cell rather than reporting a 0 ms change.
		expect(split.comparison.find((row) => row.label === 'window p50')!.deltaMs).toBeNull();
		expect(split.comparison.find((row) => row.label === 'window p50')!.ratio).toBeNull();
		expect(split.unassignedWindows).toBe(0);
	});

	it('states the one-session rule the split runs under', () => {
		expect(P23B_M1_LABEL_ARM_WINDOW_RULE).toContain('DROPPED');
		expect(P23B_M1_LABEL_ARM_WINDOW_RULE).toContain('INSIDE ONE SESSION');
		expect(P23B_M1_LABEL_ARM_WINDOW_RULE).toContain('MIXED population');
		// The release row is deliberately outside the split: both arms are released by
		// the same click, so it is the control and not a second comparison.
		expect(P23B_M1_LABEL_ARM_WINDOW_RULE).toContain('NOT split');
		expect(P23B_M1_WINDOW_ARM_NOTE).toContain('AFTER − BEFORE');
	});

	it('reports a window with no spans as a window, and keeps classes apart', () => {
		const rows = summarizePresentedWindowPhases({
			windows: [
				// No span touches this one: the whole wait is outside any frame.
				{ key: 'a/tap', actionIndex: 0, startMs: 500, endMs: 540 },
				{ key: 'b/drag', actionIndex: 0, startMs: 0, endMs: 200 },
				{ key: 'b/drag', actionIndex: 1, startMs: 1000, endMs: 1120 }
			],
			spans: [{ name: 'AnimationFrame', startMs: 0, durMs: 16 }]
		});
		expect(rows['a/tap']!.windows).toBe(1);
		// An empty window is the finding, not a missing measurement: the whole wait
		// is outside any frame.
		expect(rows['a/tap']!.outsideFramesMs.p50).toBe(40);
		expect(rows['a/tap']!.frameOccupiedMs.p50).toBe(0);
		expect(rows['a/tap']!.framesPerWindow.p50).toBe(0);
		expect(rows['b/drag']!.windows).toBe(2);
		expect(rows['b/drag']!.frameOccupiedMs.count).toBe(2);
		expect(rows['b/drag']!.frameOccupiedMs.max).toBe(16);
	});
});
