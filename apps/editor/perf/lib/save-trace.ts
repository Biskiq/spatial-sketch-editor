import { normalizeTraceClock, type ClockAnchor, type TraceEvent } from './trace-proof';
import { resolveTracePresentation } from './trace-presentation';

export type SaveOperationBoundaries = {
	clickMs: number;
	commandMs: number;
	requestMs: number;
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
	clickToCommandMs: number;
	commandToRequestMs: number;
	requestToReceiptMs: number;
	mainThread: {
		workMs: number;
		taskCount: number;
		clickToCommandWorkMs: number;
		commandToRequestWorkMs: number;
		requestToReceiptWorkMs: number;
		blockingWorkMs: number;
		blockingTaskCount: number;
		maxTaskMs: number;
	};
	backgroundRenderer: {
		workMs: number;
		taskCount: number;
	};
};

export type SaveWorkRecord = {
	kind: string;
	name: string;
	time: number;
	detail?: Readonly<Record<string, unknown>>;
};

export type SaveOwnedWorkAttribution = {
	workMs: number;
	syncScopeUnionMs: number;
	feedbackTaskWorkMs: number;
	overlapMs: number;
	feedbackTaskCount: number;
	syncPhases: Array<{ phase: string; elapsedMs: number }>;
	asyncWallPhases: Array<{ phase: string; elapsedMs: number }>;
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

/** Report the renderer-main RunTask union during click → receipt as a window diagnostic. */
export function attributeSaveTrace(
	events: readonly TraceEvent[],
	anchors: readonly ClockAnchor[],
	boundaries: SaveOperationBoundaries
): SaveTraceAttribution {
	const { clickMs, commandMs, requestMs, receiptMs } = boundaries;
	if (![clickMs, commandMs, requestMs, receiptMs].every(Number.isFinite) || clickMs > commandMs || commandMs > requestMs || requestMs > receiptMs) {
		throw new Error('Save click, command, request, and receipt boundaries must be finite and ordered');
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
		clickToCommandMs: commandMs - clickMs,
		commandToRequestMs: requestMs - commandMs,
		requestToReceiptMs: receiptMs - requestMs,
		mainThread: {
			workMs: workForWindow(mainTasks, clickMs, receiptMs),
			taskCount: mainTasks.length,
			clickToCommandWorkMs: workForWindow(mainTasks, clickMs, commandMs),
			commandToRequestWorkMs: workForWindow(mainTasks, commandMs, requestMs),
			requestToReceiptWorkMs: workForWindow(mainTasks, requestMs, receiptMs),
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

/**
 * Count Save-owned synchronous scopes plus the two main-thread tasks that
 * perform the Saving/Saved DOM updates. This excludes ambient renderer frames
 * during crypto and network waits; overlapping scopes are unioned once.
 */
export function attributeSaveOwnedWork(
	events: readonly TraceEvent[],
	clockOffsetMs: number,
	records: readonly SaveWorkRecord[],
	feedbackMarkers: readonly string[]
): SaveOwnedWorkAttribution {
	const threadNames = new Map<string, string>();
	for (const event of events) {
		if (event.name === 'thread_name' && typeof event.pid === 'number' && typeof event.tid === 'number' && typeof event.args?.name === 'string') {
			threadNames.set(`${event.pid}:${event.tid}`, event.args.name);
		}
	}
	const mainThreads = new Set([...threadNames]
		.filter(([, name]) => name === 'CrRendererMain')
		.map(([thread]) => thread));
	const mainTasks = events.flatMap((event) => {
		if (event.name !== 'RunTask' || event.ph !== 'X' || typeof event.dur !== 'number' || event.dur < 0 ||
			typeof event.pid !== 'number' || typeof event.tid !== 'number' || !mainThreads.has(`${event.pid}:${event.tid}`)) return [];
		const startMs = event.ts / 1000 - clockOffsetMs;
		return [{ startMs, endMs: (event.ts + event.dur) / 1000 - clockOffsetMs }];
	});
	const feedbackTasks = feedbackMarkers.map((marker) => {
		const marks = events.filter((event) => event.name === marker);
		if (marks.length !== 1) throw new Error(`Expected one trace marker ${marker}, got ${marks.length}`);
		const markMs = marks[0]!.ts / 1000 - clockOffsetMs;
		const tasks = mainTasks.filter((task) => task.startMs <= markMs && markMs <= task.endMs);
		if (tasks.length !== 1) throw new Error(`Expected one main-thread task for ${marker}, got ${tasks.length}`);
		return tasks[0]!;
	});
	const syncPhases = records.flatMap((record) => {
		if (record.kind !== 'mark' || record.name !== 'save:work' || typeof record.detail?.phase !== 'string' ||
			typeof record.detail.elapsedMs !== 'number' || !Number.isFinite(record.detail.elapsedMs) || record.detail.elapsedMs < 0) return [];
		return [{ phase: record.detail.phase, elapsedMs: record.detail.elapsedMs }];
	});
	const syncIntervals = records.flatMap((record) => {
		if (record.kind !== 'mark' || record.name !== 'save:work' || typeof record.detail?.phase !== 'string' ||
			typeof record.detail.elapsedMs !== 'number' || !Number.isFinite(record.detail.elapsedMs) || record.detail.elapsedMs < 0) return [];
		const startMs = typeof record.detail.startMs === 'number' && Number.isFinite(record.detail.startMs)
			? record.detail.startMs
			: record.time - record.detail.elapsedMs;
		const endMs = typeof record.detail.endMs === 'number' && Number.isFinite(record.detail.endMs)
			? record.detail.endMs
			: record.time;
		return endMs >= startMs ? [{ startMs, endMs }] : [];
	});
	const asyncWallPhases = records.flatMap((record) =>
		record.kind === 'mark' && record.name === 'save:async-wall' && typeof record.detail?.phase === 'string' &&
		typeof record.detail.elapsedMs === 'number' && Number.isFinite(record.detail.elapsedMs) && record.detail.elapsedMs >= 0
			? [{ phase: record.detail.phase, elapsedMs: record.detail.elapsedMs }]
			: []
	);
	const syncScopeUnionMs = unionDuration(syncIntervals);
	const feedbackTaskWorkMs = unionDuration(feedbackTasks);
	const combinedWorkMs = unionDuration([...syncIntervals, ...feedbackTasks]);
	return {
		workMs: combinedWorkMs,
		syncScopeUnionMs,
		feedbackTaskWorkMs,
		overlapMs: Math.max(0, syncScopeUnionMs + feedbackTaskWorkMs - combinedWorkMs),
		feedbackTaskCount: feedbackTasks.length,
		syncPhases,
		asyncWallPhases
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
