/**
 * Pre-P23B.8 follow-up M1 — the CPU-profile half of the post-release split.
 *
 * WHY THIS EXISTS, in the terms of the question it was written for. The trace
 * split (`p23b-m1-frame-timing.ts`) prices the post-release window by named phase
 * and names the JavaScript by function, script and definition site. That answered
 * "which function" — one anonymous function in a pre-bundled dependency chunk, whose
 * union is 96–98 % of the window's script time — and it cannot answer what is
 * INSIDE it: a `FunctionCall` span's duration includes everything it calls, and
 * V8 emits no span for a frame it inlined. A CPU PROFILE does: it attributes each
 * sample to the top frame on the stack, so a function's SELF time is separated
 * from the work it merely contains, and the built-in sample frames (`(program)`,
 * `(garbage collector)`, `(idle)`) make native and GC time visible where the
 * timeline shows nothing.
 *
 * THE TWO CLOCKS. A profile's samples carry no absolute timestamp: sample `i`
 * happens `timeDeltas[i]` after sample `i − 1`, and the first delta is counted
 * from `startTime`. `startTime` is on the renderer's monotonic clock, the same
 * clock trace events use, so a sample maps into the trace clock by adding nothing
 * — but that is a CLAIM, and this module refuses to make it silently. The caller
 * passes the trace instant of a marker taken a few milliseconds after profiling
 * started (`clockRelation`), and the summary reports the difference: a shared
 * clock shows up as a difference the size of one CDP round trip, a different
 * clock domain as a difference orders of magnitude larger. The difference is
 * carried into the record as the alignment uncertainty rather than rounded away.
 *
 * WHAT A ROW IS KEYED BY. Exactly the trace row's key — function name, script,
 * line and column — so the two instruments can be read side by side: the trace
 * says how much of the window the function CONTAINS, the profile says how much of
 * it the function itself RAN.
 */
import type { P23BM1PresentedWindow } from './p23b-m1-frame-timing';

/** The subset of `Profiler.stop`'s payload this instrument reads. */
export type P23BM1CpuProfile = {
	startTime: number;
	endTime: number;
	nodes: {
		id: number;
		callFrame: { functionName?: string; url?: string; lineNumber?: number; columnNumber?: number };
	}[];
	samples: number[];
	/** `timeDeltas[i]` is the gap between sample `i − 1` and sample `i`, in µs. */
	timeDeltas: number[];
};

/** One function, keyed the way the trace window rows key theirs. */
export type P23BM1CpuSelfTimeRow = {
	functionName: string;
	script: string;
	lineNumber: number | null;
	columnNumber: number | null;
	/** Samples attributed to this frame as the TOP frame on the stack. */
	samples: number;
	/** The same samples priced by their own deltas. */
	selfMs: number;
	/** `selfMs` as a share of the class's (or run's) sampled time. */
	share: number;
};

/**
 * One bucket of windows' self time. The same shape the per-arm slice returns, so a
 * class row and an arm row are read by the same code and cannot diverge.
 */
export type P23BM1CpuProfileClassRow = P23BM1CpuWindowRow;

export type P23BM1CpuProfileSummary = {
	definition: string;
	samplingIntervalUs: number | null;
	totalSamples: number;
	/** `endTime − startTime`, the profile's own span. */
	profileMs: number;
	clockRelation: {
		profileStartMs: number;
		/** The trace instant of the marker the runner took just after starting. */
		markerTraceMs: number | null;
		deltaMs: number | null;
		verdict: string;
	};
	/** Whole-run self time, largest first — the profile's own answer. */
	topSelfTime: P23BM1CpuSelfTimeRow[];
	/** The same, but only the samples inside each class's post-release windows. */
	classes: P23BM1CpuProfileClassRow[];
};


export const P23B_M1_CPU_PROFILE_DEFINITION =
	'a V8 CPU profile taken over the whole M1 protocol. Each sample is attributed to the TOP frame on the stack at that instant and priced by its own delta, so a row is SELF time — the work that function itself ran — never the work it merely contains; `(program)`, `(garbage collector)` and `(idle)` are V8\'s own frame names and are kept as rows rather than filtered, because native and idle time that the timeline cannot see is exactly what this instrument is for. Sample instants are mapped into the trace clock by adding nothing and the difference against the trace marker taken when profiling started is reported as the alignment uncertainty, never assumed away. Frames that V8 inlined do not appear as samples at all: an inlined callee\'s time stays on its inliner, which is a limit of the method and is stated here rather than discovered later.';

/** Same shortening rule as the window rows, so the two sets of rows line up. */
function shortScript(url: string): string {
	if (!url) return '(no script — inline or evaluated)';
	const withoutQuery = url.split(/[?#]/)[0]!;
	const parts = withoutQuery.split('/').filter((part) => part.length > 0);
	return parts.slice(-2).join('/') || withoutQuery;
}

function frameKey(row: {
	functionName: string;
	script: string;
	lineNumber: number | null;
	columnNumber: number | null;
}): string {
	return `${row.functionName}|${row.script}|${row.lineNumber ?? '-'}|${row.columnNumber ?? '-'}`;
}

/** How many rows a summary carries; a profile has thousands and a record is read. */
export const P23B_M1_CPU_PROFILE_ROW_LIMIT = 15;

type Frame = { functionName: string; script: string; lineNumber: number | null; columnNumber: number | null };

/**
 * The CPU slice of one bucket of windows, keyed by that bucket. `key` is the
 * caller's own key — a class, or `arm::class` for the per-arm split — so the same
 * walk serves both without either summary learning about the other.
 */
export type P23BM1CpuWindowRow = {
	key: string;
	windows: number;
	/** Sampled time whose instant falls inside one of this key's windows. */
	sampledInWindowMs: number;
	/** Self time of the frames that ran in those windows, largest first. */
	topSelfTime: P23BM1CpuSelfTimeRow[];
};

/**
 * The one walk over a profile's samples. Every summarizer here goes through it, so
 * the window-slitting rule (and the `break` that makes a sample belong to exactly
 * one bucket) exists once.
 */
function walkSamples(input: {
	profile: P23BM1CpuProfile;
	byWindowKey: Map<string, P23BM1PresentedWindow[]>;
	frames: Map<number, Frame>;
	rowLimit: number;
}): { rows: P23BM1CpuWindowRow[]; runSelfMs: number; runTotals: Map<string, { row: P23BM1CpuSelfTimeRow }> } {
	const classTotals = new Map<string, Map<string, { row: P23BM1CpuSelfTimeRow }>>();
	const classSampledMs = new Map<string, number>();
	const runTotals = new Map<string, { row: P23BM1CpuSelfTimeRow }>();
	const bump = (
		map: Map<string, { row: P23BM1CpuSelfTimeRow }>,
		key: string,
		frame: Frame,
		selfMs: number
	): void => {
		const existing = map.get(key);
		if (existing) {
			existing.row.samples += 1;
			existing.row.selfMs += selfMs;
			return;
		}
		map.set(key, { row: { ...frame, samples: 1, selfMs, share: 0 } });
	};
	let runSelfMs = 0;
	// The sample instants are cumulative: sample 0 sits `timeDeltas[0]` after
	// `startTime`, and each later sample its own delta later. Walking the series
	// once keeps the memory flat — a ten-minute profile is millions of samples.
	let atUs = input.profile.startTime;
	for (let index = 0; index < input.profile.samples.length; index += 1) {
		const deltaUs = input.profile.timeDeltas[index] ?? 0;
		atUs += deltaUs;
		const nodeId = input.profile.samples[index]!;
		const frame = input.frames.get(nodeId);
		if (!frame || deltaUs <= 0) continue;
		const selfMs = deltaUs / 1000;
		const traceMs = atUs / 1000;
		runSelfMs += selfMs;
		bump(runTotals, frameKey(frame), frame, selfMs);
		for (const [key, windows] of input.byWindowKey) {
			const inside = windows.some((window) => traceMs >= window.startMs && traceMs < window.endMs);
			if (!inside) continue;
			const totals = classTotals.get(key) ?? new Map<string, { row: P23BM1CpuSelfTimeRow }>();
			classTotals.set(key, totals);
			bump(totals, frameKey(frame), frame, selfMs);
			classSampledMs.set(key, (classSampledMs.get(key) ?? 0) + selfMs);
			break;
		}
	}
	const finish = (map: Map<string, { row: P23BM1CpuSelfTimeRow }>, denominator: number): P23BM1CpuSelfTimeRow[] =>
		[...map.values()]
			.map((bucket) => ({
				...bucket.row,
				selfMs: Math.round(bucket.row.selfMs * 1000) / 1000,
				share: denominator > 0 ? Math.round((bucket.row.selfMs / denominator) * 10000) / 10000 : 0
			}))
			.sort((a, b) => b.selfMs - a.selfMs)
			.slice(0, input.rowLimit);
	return {
		runSelfMs,
		runTotals,
		rows: [...input.byWindowKey.keys()]
			.map((key) => ({
				key,
				windows: input.byWindowKey.get(key)!.length,
				sampledInWindowMs: Math.round((classSampledMs.get(key) ?? 0) * 1000) / 1000,
				topSelfTime: finish(classTotals.get(key) ?? new Map(), classSampledMs.get(key) ?? 0)
			}))
			.sort((a, b) => b.sampledInWindowMs - a.sampledInWindowMs)
	};
}

function framesOf(profile: P23BM1CpuProfile): Map<number, Frame> {
	const frames = new Map<number, Frame>();
	for (const node of profile.nodes) {
		frames.set(node.id, {
			functionName: node.callFrame.functionName && node.callFrame.functionName.length > 0 ? node.callFrame.functionName : '(anonymous)',
			script: shortScript(node.callFrame.url ?? ''),
			lineNumber: node.callFrame.lineNumber ?? null,
			columnNumber: node.callFrame.columnNumber ?? null
		});
	}
	return frames;
}

/**
 * Group windows by their own key — the one rule every slice shares, so a caller
 * cannot group them one way and read them another. Windows whose `key` is empty are
 * grouped under `unkeyed` rather than dropped, because a window that reached here
 * was measured and a silent loss is the one thing this instrument must not do.
 */
function byWindowKeyOf(windows: readonly P23BM1PresentedWindow[]): Map<string, P23BM1PresentedWindow[]> {
	const byWindowKey = new Map<string, P23BM1PresentedWindow[]>();
	for (const window of windows) {
		const key = window.key.length > 0 ? window.key : 'unkeyed';
		const list = byWindowKey.get(key) ?? [];
		list.push(window);
		byWindowKey.set(key, list);
	}
	return byWindowKey;
}

/**
 * The window slice alone — the class rows without the whole-run answer beside them.
 * Used where a caller wants its own bucket key (the per-arm split, which keys
 * `arm::class`) and has no use for a second whole-run summary computed through it.
 */
export function summarizeCpuProfileWindows(input: {
	profile: P23BM1CpuProfile;
	windows: readonly P23BM1PresentedWindow[];
	rowLimit?: number;
}): P23BM1CpuWindowRow[] {
	return walkSamples({
		profile: input.profile,
		byWindowKey: byWindowKeyOf(input.windows),
		frames: framesOf(input.profile),
		rowLimit: input.rowLimit ?? P23B_M1_CPU_PROFILE_ROW_LIMIT
	}).rows;
}

export function summarizeCpuProfile(input: {
	profile: P23BM1CpuProfile;
	windows?: readonly P23BM1PresentedWindow[];
	/** The trace instant of the marker taken when profiling started. */
	markerTraceMs: number | null;
	samplingIntervalUs: number | null;
	rowLimit?: number;
}): P23BM1CpuProfileSummary {
	const walked = walkSamples({
		profile: input.profile,
		byWindowKey: byWindowKeyOf(input.windows ?? []),
		frames: framesOf(input.profile),
		rowLimit: input.rowLimit ?? P23B_M1_CPU_PROFILE_ROW_LIMIT
	});
	const runSelfMs = walked.runSelfMs;
	const rowLimit = input.rowLimit ?? P23B_M1_CPU_PROFILE_ROW_LIMIT;
	const runTotals = walked.runTotals;
	const classes = walked.rows;
	const finish = (map: Map<string, { row: P23BM1CpuSelfTimeRow }>, denominator: number): P23BM1CpuSelfTimeRow[] =>
		[...map.values()]
			.map((bucket) => ({
				...bucket.row,
				selfMs: Math.round(bucket.row.selfMs * 1000) / 1000,
				share: denominator > 0 ? Math.round((bucket.row.selfMs / denominator) * 10000) / 10000 : 0
			}))
			.sort((a, b) => b.selfMs - a.selfMs)
			.slice(0, rowLimit);
	const profileStartMs = input.profile.startTime / 1000;
	const deltaMs = input.markerTraceMs === null ? null : Math.round((profileStartMs - input.markerTraceMs) * 1000) / 1000;
	return {
		definition: P23B_M1_CPU_PROFILE_DEFINITION,
		samplingIntervalUs: input.samplingIntervalUs,
		totalSamples: input.profile.samples.length,
		profileMs: Math.round((input.profile.endTime - input.profile.startTime) / 1000),
		clockRelation: {
			profileStartMs: Math.round(profileStartMs * 1000) / 1000,
			markerTraceMs: input.markerTraceMs,
			deltaMs,
			verdict:
				deltaMs === null
					? 'NOT CHECKED — the trace marker taken when profiling started was not found, so the sample instants are reported in the profile\'s own clock and the window slice is NOT to be read as exact.'
					: Math.abs(deltaMs) < 500
						? `SAME CLOCK DOMAIN — the profile starts ${deltaMs} ms from the trace marker, and that gap is the elapsed time between the two anchors (a CDP round trip plus the page's own work at start-up), NOT an offset to correct for: both anchors are true instants on one monotonic clock, so a sample maps into the trace clock by adding nothing. A different domain would show a difference in days. ${Math.abs(deltaMs)} ms is how much of the run the profile covers before the trace's own calibration marker.`
						: `NOT THE SAME CLOCK — the profile starts ${deltaMs} ms from the trace marker, orders of magnitude more than the time between those two anchors can be, so the window slice below is INVALID and only the whole-run rows may be read.`
		},
		topSelfTime: finish(runTotals, runSelfMs),
		classes
	};
}
