/**
 * Per-stage trace summaries (T1.P02.S06 C).
 *
 * One Chrome trace per window, reduced to what the characterization reads next
 * to the work ledger's stage spans: main-thread busy and idle time, garbage
 * collection, script, style/layout, paint and GPU-process time, and the
 * longest main-thread tasks. Raw traces stay outside Git with the results.
 */
import type { CDPSession } from '@playwright/test';

type TraceEvent = { name: string; cat?: string; ph: string; ts: number; dur?: number; pid: number; tid: number; args?: Record<string, unknown> };

const CATEGORIES = [
	'devtools.timeline',
	'disabled-by-default-devtools.timeline',
	'v8',
	'disabled-by-default-v8.gc',
	'blink.user_timing',
	'gpu'
].join(',');

export async function startStageTrace(cdp: CDPSession): Promise<() => Promise<TraceEvent[]>> {
	const events: TraceEvent[] = [];
	const onData = (event: { value: object[] }) => {
		for (const entry of event.value as TraceEvent[]) events.push(entry);
	};
	cdp.on('Tracing.dataCollected', onData);
	await cdp.send('Tracing.start', { categories: CATEGORIES, transferMode: 'ReportEvents' });
	return async () => {
		try {
			const complete = new Promise<{ dataLossOccurred?: boolean }>((resolve) => cdp.once('Tracing.tracingComplete', resolve));
			await cdp.send('Tracing.end');
			if ((await complete).dataLossOccurred) throw new Error('Chrome trace buffer lost data');
			return events;
		} finally {
			cdp.off('Tracing.dataCollected', onData);
		}
	};
}

export type StageTraceSummary = {
	readonly windowMs: number;
	readonly mainBusyMs: number;
	readonly mainIdleMs: number;
	readonly gcMs: number;
	readonly scriptMs: number;
	readonly styleLayoutMs: number;
	readonly paintMs: number;
	readonly gpuProcessMs: number;
	readonly longestTasksMs: readonly number[];
};

/** Reduce a trace to the renderer main thread's time budget over its traced span. */
export function summarizeStageTrace(events: readonly TraceEvent[]): StageTraceSummary {
	const threadNames = events.filter((event) => event.ph === 'M' && event.name === 'thread_name');
	const main = threadNames.find((event) => event.args?.name === 'CrRendererMain');
	const gpuPids = new Set(events.filter((event) => event.ph === 'M' && event.name === 'process_name' && event.args?.name === 'GPU Process').map((event) => event.pid));
	const complete = events.filter((event) => event.ph === 'X' && typeof event.dur === 'number');
	const onMain = complete.filter((event) => main !== undefined && event.pid === main.pid && event.tid === main.tid);
	const tasks = onMain.filter((event) => event.name === 'RunTask' || event.name === 'ThreadControllerImpl::RunTask');
	const sum = (list: readonly TraceEvent[]) => list.reduce((total, event) => total + event.dur! / 1000, 0);
	// Reduce, not spread: a multi-second trace exceeds the argument limit.
	const first = onMain.reduce((min, event) => Math.min(min, event.ts), Number.POSITIVE_INFINITY);
	const last = onMain.reduce((max, event) => Math.max(max, event.ts + event.dur!), Number.NEGATIVE_INFINITY);
	const span = onMain.length === 0 ? 0 : (last - first) / 1000;
	const mainBusyMs = sum(tasks);
	return {
		windowMs: span,
		mainBusyMs,
		mainIdleMs: Math.max(0, span - mainBusyMs),
		gcMs: sum(onMain.filter((event) => event.name === 'MinorGC' || event.name === 'MajorGC')),
		scriptMs: sum(onMain.filter((event) => event.name === 'FunctionCall' || event.name === 'EvaluateScript' || event.name === 'v8.compile')),
		styleLayoutMs: sum(onMain.filter((event) => event.name === 'UpdateLayoutTree' || event.name === 'Layout')),
		paintMs: sum(onMain.filter((event) => event.name === 'Paint' || event.name === 'PrePaint' || event.name === 'Layerize')),
		gpuProcessMs: sum(complete.filter((event) => gpuPids.has(event.pid) && (event.name === 'RunTask' || event.name === 'ThreadControllerImpl::RunTask'))),
		longestTasksMs: tasks.map((event) => event.dur! / 1000).sort((a, b) => b - a).slice(0, 5)
	};
}
