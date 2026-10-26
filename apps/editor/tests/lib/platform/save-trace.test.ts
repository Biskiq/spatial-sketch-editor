import { describe, expect, it } from 'vitest';

import { attributeSaveOwnedWork, attributeSaveTrace, findSaveFeedbackPresentation } from '../../../perf/lib/save-trace';
import type { TraceEvent } from '../../../perf/lib/trace-proof';

describe('F9 trace attribution', () => {
	it('clips, deduplicates, and separates main-thread from background renderer tasks', () => {
		const events: TraceEvent[] = [
			{ name: 'before', ts: 1_000_000 },
			{ name: 'after', ts: 2_000_000 },
			{ name: 'thread_name', ts: 0, pid: 1, tid: 10, args: { name: 'CrRendererMain' } },
			{ name: 'thread_name', ts: 0, pid: 1, tid: 11, args: { name: 'ThreadPoolForegroundWorker' } },
			{ name: 'RunTask', ts: 900_000, dur: 500_000, ph: 'X', pid: 1, tid: 10 }, // overlaps click by 300 ms
			{ name: 'RunTask', ts: 1_100_000, dur: 20_000, ph: 'X', pid: 1, tid: 10 },
			{ name: 'RunTask', ts: 1_100_000, dur: 20_000, ph: 'X', pid: 1, tid: 10 }, // duplicate trace row
			{ name: 'RunTask', ts: 1_140_000, dur: 100_000, ph: 'X', pid: 1, tid: 10 }, // clipped at receipt
			{ name: 'RunTask', ts: 1_120_000, dur: 50_000, ph: 'X', pid: 1, tid: 11 },
			{ name: 'RunTask', ts: 1_210_000, dur: 500_000, ph: 'X', pid: 1, tid: 10 } // after receipt
		];
		const result = attributeSaveTrace(events, [
			{ name: 'before', pageTimeMs: 0 },
			{ name: 'after', pageTimeMs: 1_000 }
		], { clickMs: 100, commandMs: 150, requestMs: 160, receiptMs: 200 });

		expect(result.operationMs).toBe(100);
		expect(result.clickToCommandMs).toBe(50);
		expect(result.commandToRequestMs).toBe(10);
		expect(result.requestToReceiptMs).toBe(40);
		expect(result.mainThread).toEqual({
			workMs: 100,
			taskCount: 3,
			clickToCommandWorkMs: 50,
			commandToRequestWorkMs: 10,
			requestToReceiptWorkMs: 40,
			blockingWorkMs: 100,
			blockingTaskCount: 2,
			maxTaskMs: 100
		});
		expect(result.backgroundRenderer).toEqual({ workMs: 50, taskCount: 1 });
	});

	it('unions Save sync scopes with only the tasks that perform the two Save DOM updates', () => {
		const events: TraceEvent[] = [
			{ name: 'thread_name', ts: 0, pid: 1, tid: 10, args: { name: 'CrRendererMain' } },
			{ name: 'RunTask', ts: 1_000_000, dur: 10_000, ph: 'X', pid: 1, tid: 10 },
			{ name: 'RunTask', ts: 1_100_000, dur: 10_000, ph: 'X', pid: 1, tid: 10 },
			{ name: 'save:ui:saving', ts: 1_005_000 },
			{ name: 'save:ui:saved', ts: 1_105_000 }
		];
		const result = attributeSaveOwnedWork(events, 1_000, [
			{ kind: 'mark', name: 'save:work', time: 6, detail: { phase: 'capture', elapsedMs: 4 } },
			{ kind: 'mark', name: 'save:work', time: 55, detail: { phase: 'request', elapsedMs: 10 } },
			{ kind: 'mark', name: 'save:async-wall', time: 75, detail: { phase: 'hash', elapsedMs: 20 } }
		], ['save:ui:saving', 'save:ui:saved']);

		expect(result).toEqual({
			workMs: 30,
			syncScopeUnionMs: 14,
			feedbackTaskWorkMs: 20,
			overlapMs: 4,
			feedbackTaskCount: 2,
			syncPhases: [
				{ phase: 'capture', elapsedMs: 4 },
				{ phase: 'request', elapsedMs: 10 }
			],
			asyncWallPhases: [{ phase: 'hash', elapsedMs: 20 }]
		});
	});

	it('requires a post-mutation screenshot joined to exact Chrome presentation feedback', () => {
		const screenshot: TraceEvent = {
			name: 'Screenshot', ts: 1_300_000, args: { snapshot: 'base64', source_id: 7, frame_sequence: 9 }
		};
		const reporter: TraceEvent = {
			name: 'PipelineReporter', ts: 1_295_000, dur: 5_000, ph: 'X', args: {
				frame_reporter: { frame_source: 7, frame_sequence: 9, state: 'STATE_PRESENTED_ALL', layer_tree_host_id: 2 }
			}
		};
		const offsetMs = 1_000;
		const result = findSaveFeedbackPresentation([screenshot, reporter], offsetMs, 100, 250, 275, 400);
		expect(result).toMatchObject({
			status: 'trace-reported-presented',
			feedbackMs: 200,
			screenshotEventPageMs: 300,
			presentedPageMs: 300,
			sourceId: 7,
			frameSequence: 9
		});
		expect(findSaveFeedbackPresentation([screenshot, reporter], offsetMs, 100, 301, 301, 400)).toBeNull();
		expect(findSaveFeedbackPresentation([screenshot, reporter], offsetMs, 100, 250, 301, 400)).toBeNull();
		expect(findSaveFeedbackPresentation([screenshot], offsetMs, 100, 250, 275, 400)).toBeNull();
	});
});
