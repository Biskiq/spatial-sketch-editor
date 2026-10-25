import { normalizeTraceClock, type ClockAnchor, type TraceEvent } from './trace-proof';
import { resolveTracePresentation } from './trace-presentation';

export type SaveOperationBoundaries = {
	clickMs: number;
	submitMs: number;
	receiptMs: number;
};

type TaskSlice = {
	thread: string;
	startMs: number;
	endMs: number;
	runTaskMs: number;
};

export type SaveTraceAttribution = {
	clockOffsetMs: number;
	clockSpreadMs: number;
	operationMs: number;
	clickToSubmitMs: number;
	submitToReceiptMs: number;
	mainThread: {
		workMs: number;
		taskCount: number;
		clickToSubmitWorkMs: number;
		submitToReceiptWorkMs: number;
		blockingWorkMs: number;
		blockingTaskCount: number;
		maxTaskMs: number;
	};
	backgroundRenderer: {
		workMs: number;
		taskCount: number;
	};
};

export type SaveFeedbackPresentation = {
	status: 'trace-reported-presented';
	feedbackMs: number;
	screenshotEventPageMs: number;
	presentedPageMs: number;
	sourceId: number;
	frameSequence: number;
	screenshot: TraceEvent;
};

function unionDuration(intervals: readonly { startMs: number; endMs: number }[]): number {
	const ordered = [...intervals].sort((left, right) => left.startMs - right.startMs || left.endMs - right.endMs);
	let duration = 0;
	let start: number | undefined;
	let end: number | undefined;
	for (const interval of ordered) {
		if (end === undefined || interval.startMs > end) {
			if (start !== undefined && end !== undefined) duration += end - start;
			start = interval.startMs;
			end = interval.endMs;
		} else {
			end = Math.max(end, interval.endMs);
		}
	}
	if (start !== undefined && end !== undefined) duration += end - start;
	return duration;
}

function workForWindow(tasks: readonly TaskSlice[], startMs: number, endMs: number): number {
	return unionDuration(tasks.flatMap((task) => {
		const start = Math.max(startMs, task.startMs);
		const end = Math.min(endMs, task.endMs);
		return end > start ? [{ startMs: start, endMs: end }] : [];
	}));
}

/** Attribute trace tasks only to the measured click → receipt interval. */
export function attributeSaveTrace(
	events: readonly TraceEvent[],
	anchors: readonly ClockAnchor[],
	boundaries: SaveOperationBoundaries
): SaveTraceAttribution {
	const { clickMs, submitMs, receiptMs } = boundaries;
	if (![clickMs, submitMs, receiptMs].every(Number.isFinite) || clickMs > submitMs || submitMs > receiptMs) {
		throw new Error('Save click, submit, and receipt boundaries must be finite and ordered');
	}
	const clock = normalizeTraceClock(events, anchors);
	const threadNames = new Map<string, string>();
	for (const event of events) {
		if (event.name === 'thread_name' && typeof event.pid === 'number' && typeof event.tid === 'number' && typeof event.args?.name === 'string') {
			threadNames.set(`${event.pid}:${event.tid}`, event.args.name);
		}
	}
	const mainThreads = new Set([...threadNames]
		.filter(([, name]) => name === 'CrRendererMain')
		.map(([thread]) => thread));
	const mainProcesses = new Set([...mainThreads].map((thread) => Number(thread.split(':', 1)[0])));
	const tasksById = new Map<string, TaskSlice & { isMain: boolean }>;
	for (const event of events) {
		if (event.name !== 'RunTask' || event.ph !== 'X' || typeof event.dur !== 'number' || event.dur < 0 ||
			typeof event.pid !== 'number' || typeof event.tid !== 'number') continue;
		const thread = `${event.pid}:${event.tid}`;
		const startMs = clock.toPageMs(event.ts / 1);
		const endMs = clock.toPageMs(event.ts + event.dur);
		const clippedStart = Math.max(clickMs, startMs);
		const clippedEnd = Math.min(receiptMs, endMs);
		if (clippedEnd <= clippedStart) continue;
		const id = `${thread}:${event.ts}:${event.dur}`;
		tasksById.set(id, {
			thread,
			startMs: clippedStart,
			endMs: clippedEnd,
			runTaskMs: event.dur / 1000,
			isMain: mainThreads.has(thread)
		});
	}
	const tasks = [...tasksById.values()];
	const mainTasks = tasks.filter((task) => task.isMain);
	const backgroundTasks = tasks.filter((task) => !task.isMain && mainProcesses.has(Number(task.thread.split(':', 1)[0])));
	const blockingTasks = mainTasks.filter((task) => task.runTaskMs > 50);
	return {
		clockOffsetMs: clock.offsetMs,
		clockSpreadMs: clock.spreadMs,
		operationMs: receiptMs - clickMs,
		clickToSubmitMs: submitMs - clickMs,
		submitToReceiptMs: receiptMs - submitMs,
		mainThread: {
			workMs: workForWindow(mainTasks, clickMs, receiptMs),
			taskCount: mainTasks.length,
			clickToSubmitWorkMs: workForWindow(mainTasks, clickMs, submitMs),
			submitToReceiptWorkMs: workForWindow(mainTasks, submitMs, receiptMs),
			blockingWorkMs: unionDuration(blockingTasks),
			blockingTaskCount: blockingTasks.length,
			maxTaskMs: Math.max(0, ...mainTasks.map((task) => task.endMs - task.startMs))
		},
		backgroundRenderer: {
			workMs: unionDuration(backgroundTasks),
			taskCount: backgroundTasks.length
		}
	};
}

/** Find the first screenshot/frame pair after the Saving state survives a render opportunity. */
export function findSaveFeedbackPresentation(
	events: readonly TraceEvent[],
	clockOffsetMs: number,
	clickMs: number,
	mutationMs: number,
	paintBoundaryMs: number,
	receiptMs: number
): SaveFeedbackPresentation | null {
	const visibleFeedbackBoundaryMs = Math.max(mutationMs, paintBoundaryMs);
	const candidates = events.flatMap((screenshot) => {
		const sourceId = screenshot.args?.source_id;
		const frameSequence = screenshot.args?.frame_sequence;
		if (screenshot.name !== 'Screenshot' || typeof screenshot.args?.snapshot !== 'string' ||
			typeof sourceId !== 'number' || typeof frameSequence !== 'number') return [];
		const screenshotEventPageMs = screenshot.ts / 1000 - clockOffsetMs;
		if (screenshotEventPageMs < visibleFeedbackBoundaryMs) return [];
		const presentation = resolveTracePresentation(screenshot, events);
		if (presentation.traceTimeUs === null) return [];
		const presentedPageMs = presentation.traceTimeUs / 1000 - clockOffsetMs;
		if (presentedPageMs < visibleFeedbackBoundaryMs || presentedPageMs > receiptMs) return [];
		return [{
			status: 'trace-reported-presented' as const,
			feedbackMs: presentedPageMs - clickMs,
			screenshotEventPageMs,
			presentedPageMs,
			sourceId,
			frameSequence,
			screenshot
		}];
	});
	return candidates.sort((left, right) => left.presentedPageMs - right.presentedPageMs)[0] ?? null;
}
