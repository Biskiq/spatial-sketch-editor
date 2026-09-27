/**
 * Pre-P23B.8 follow-up — M1 frame timing (DEV only).
 *
 * TWO SEPARABLE INSTRUMENTATION ITEMS live here, both inert in production and
 * both page-side (no product module is touched, and nothing is persisted):
 *
 * (a) GESTURE FRAMES. A drag is bracketed and the requestAnimationFrame callback
 *     interval is recorded for every frame inside it, so the row is what it says:
 *     the frame cadence of the preview while dragging. The series is attributed
 *     by the marks the product already emits — `p2311:pointermove-rigid` /
 *     `p2311:pointermove-bend` — and its COVERAGE is reported (how many frames
 *     fall inside a pointermove window, out of how many frames and how many
 *     drags were bracketed), never assumed.
 *
 *     This is a PROXY for what a person sees, and it is labelled one: an rAF
 *     callback interval is a callback interval, not presented-frame latency or
 *     GPU work. The plan's release-side row is the one that may be called
 *     presented-frame latency, and only when a presentation-grade signal exists.
 *
 * (b) LONG-FRAME INCIDENCE. `long-animation-frame` reports only frames over
 *     50 ms, and its `startTime` / `duration` / `renderStart` /
 *     `styleAndLayoutStart` are not presentation times, so it is its OWN row and
 *     is never the latency row. It is kept because it speaks to the
 *     owner-noticed lag; its incidence is reported against releases (the
 *     denominator this observer can actually support) with coverage stated.
 *
 * ROW LABELS ARE PART OF THE CONTRACT. `definition` travels with every series so
 * a reader cannot mistake the proxy for a measurement it is not, and `coverage`
 * travels with every row so a thin sample is visible instead of being read as a
 * small number.
 */
import { percentile } from '$lib/bench/p23b-containment';

/** The frame budget the incidence is counted against; 60 Hz. */
export const P23B_M1_FRAME_BUDGET_MS = 16.7;
/** Long-animation-frame's own threshold; a frame at or above it is reported by the observer. */
export const P23B_M1_LONG_FRAME_MS = 50;
/** The product's own drag-preview marks, which the gesture series correlates with. */
export const P23B_M1_POINTERMOVE_MARKS = ['p2311:pointermove-rigid', 'p2311:pointermove-bend'] as const;

export const P23B_M1_GESTURE_FRAME_DEFINITION =
	'requestAnimationFrame callback interval during a real Plan drag (pointerdown → the action resolving), correlated with the product marks p2311:pointermove-rigid / p2311:pointermove-bend. A callback interval is a PROXY: it is not presented-frame latency, not paint time and not GPU work.';
export const P23B_M1_LONG_FRAME_DEFINITION =
	'PerformanceObserver long-animation-frame entries (frames at or over 50 ms only). startTime/duration/renderStart/styleAndLayoutStart are not presentation times, so this is an INCIDENCE row and never a latency row.';
export const P23B_M1_PRESENTED_FRAME_DEFINITION =
	'presentation-grade: the next presented frame strictly after the synchronous release ended, on a correlated presentation clock (CDP display/trace events), never an rAF callback.';
export const P23B_M1_RELEASE_PROXY_DEFINITION =
	'the existing browser-frame boundary = [synchronous release end, next requestAnimationFrame callback]. A PROXY: it encloses the flush of that input and is not presented-frame latency.';

/** Nearest-rank upper percentile, the repo's rule. */
export type P23BM1IntervalSeries = {
	count: number;
	p50: number;
	p95: number;
	max: number;
	mean: number;
};

/** One sampled frame: the callback's own clock read and the gap it closed. */
export type P23BM1FrameSample = { end: number; interval: number };

/** One drag's frame series, with the product-mark correlation beside it. */
export type P23BM1GestureFrameSeries = {
	/** What was bracketed, e.g. `plan-drag-edit` or `bend-knot-edit`. */
	label: string;
	definition: string;
	startedAt: number;
	endedAt: number;
	spanMs: number;
	frames: number;
	/** Every sampled frame, in order; the distribution is over this population. */
	samples: P23BM1FrameSample[];
	distribution: P23BM1IntervalSeries;
	/** Frames whose interval exceeded the 60 Hz budget, and 50 ms. */
	overFrameBudget: number;
	over50Ms: number;
	/** The product's own drag-preview marks observed inside the bracket. */
	pointermove: { name: string; count: number; p50: number; p95: number; totalMs: number }[];
	coverage: {
		/** Drags this series came from; one drag produces one series. */
		drags: number;
		frames: number;
		/** Frames whose own clock read falls inside one `pointermove` mark window. */
		framesInsidePointermoveWindows: number;
		pointermoveMarks: number;
		/** `framesInsidePointermoveWindows / frames`, 0 when no frame was sampled. */
		pointermoveShare: number;
	};
};

export type P23BM1LongFrameEntry = {
	startTime: number;
	duration: number;
	renderStart: number;
	styleAndLayoutStart: number;
	blockingDuration: number;
	firstScriptStart: number | null;
};

export type P23BM1LongFrameSummary = {
	definition: string;
	/** Long frames observed in the class window (over 50 ms by construction). */
	frames: number;
	over100Ms: number;
	distribution: P23BM1IntervalSeries;
	/** `renderStart - startTime` and `styleAndLayoutStart - startTime`, per frame. */
	renderStartDelay: P23BM1IntervalSeries;
	styleAndLayoutDelay: P23BM1IntervalSeries;
	blockingDuration: P23BM1IntervalSeries;
	/** Releases whose span intersects a long frame, out of the releases in the window. */
	coverage: { releases: number; releasesTouched: number; releasesTouchedShare: number };
	/** False when the runtime does not report long-animation-frame entries at all. */
	supported: boolean;
	/** Set (with a reason) when this row is NOT MEASURED, so a zero is never read as "none happened". */
	notMeasuredReason: string | null;
};

/** One drag's series, keyed to the class it was measured in. */
export type P23BM1GestureFrameEntry = {
	key: string;
	fixtureId: string;
	actionClass: string;
	path: string;
	series: P23BM1GestureFrameSeries;
};

/** The class-keyed registry the M1 run fills and the M1 record reads. */
export type P23BM1LongFrameEntryGroup = {
	key: string;
	fixtureId: string;
	actionClass: string;
	/** Raw entries, so the summary can be taken over the class's own release population. */
	entries: P23BM1LongFrameEntry[];
	supported: boolean;
};

export type P23BM1FrameTiming = {
	gestureFrames: P23BM1GestureFrameEntry[];
	longFrames: P23BM1LongFrameEntryGroup[];
};

/** The gesture series of one fixture+class, merged into the single row that class reports. */
export function p23bM1GestureFramesFor(
	registry: P23BM1FrameTiming,
	fixtureId: string,
	actionClass: string
): P23BM1GestureFrameSeries | null {
	return mergeGestureFrameSeries(
		registry.gestureFrames
			.filter((entry) => entry.fixtureId === fixtureId && entry.actionClass === actionClass)
			.map((entry) => entry.series)
	);
}

/** One class's raw long-frame entries, or `null` when the class never reported a window. */
export function p23bM1LongFramesFor(
	registry: P23BM1FrameTiming,
	fixtureId: string,
	actionClass: string
): { entries: P23BM1LongFrameEntry[]; supported: boolean } | null {
	const entry = registry.longFrames.find(
		(candidate) => candidate.fixtureId === fixtureId && candidate.actionClass === actionClass
	);
	return entry ? { entries: entry.entries, supported: entry.supported } : null;
}

type PerfGlobals = typeof globalThis & { __P2311_PERF__?: boolean };

/**
 * The M1 instruments ride the existing DEV measurement switch: the DEV build
 * plus `__P2311_PERF__`, exactly like every other capture-side instrument. A
 * production build does one early return.
 */
export function p23bM1FrameTimingEnabled(): boolean {
	return import.meta.env.DEV && Boolean((globalThis as PerfGlobals).__P2311_PERF__);
}

// ---------------------------------------------------------------------------
// (a) gesture frames
// ---------------------------------------------------------------------------

type GestureFrameSamplerOptions = {
	/** Injected for tests; defaults to the real clock and rAF. */
	now?: () => number;
	requestFrame?: (callback: () => void) => number;
	cancelFrame?: (handle: number) => void;
	/** Injected for tests; defaults to `performance.getEntriesByType('measure')`. */
	measures?: () => readonly { name: string; startTime: number; duration: number }[];
	enabled?: () => boolean;
};

/**
 * One drag's frame series. `start(label)` clears and begins sampling; `stop()`
 * returns the series (or `null` when the instrument is off or was never
 * started). Nothing is emitted while the measurement switch is off, so an
 * ordinary drag pays one boolean check.
 */
export function createP23BGestureFrameSampler(options: GestureFrameSamplerOptions = {}) {
	const now = options.now ?? (() => performance.now());
	const requestFrame =
		options.requestFrame ?? ((callback: () => void) => requestAnimationFrame(() => callback()));
	const cancelFrame = options.cancelFrame ?? ((handle: number) => cancelAnimationFrame(handle));
	const measures =
		options.measures ??
		(() =>
			performance.getEntriesByType('measure').map((entry) => ({
				name: entry.name,
				startTime: entry.startTime,
				duration: entry.duration
			})));
	const enabled = options.enabled ?? p23bM1FrameTimingEnabled;

	let handle: number | null = null;
	let label = '';
	let startedAt = 0;
	let previous = 0;
	let samples: P23BM1FrameSample[] = [];

	function tick(): void {
		const at = now();
		samples.push({ end: at, interval: Math.max(0, at - previous) });
		previous = at;
		handle = requestFrame(tick);
	}

	function start(nextLabel: string): void {
		if (!enabled()) return;
		if (handle !== null) stop();
		label = nextLabel;
		startedAt = now();
		previous = startedAt;
		samples = [];
		handle = requestFrame(tick);
	}

	function stop(): P23BM1GestureFrameSeries | null {
		if (handle === null) return null;
		cancelFrame(handle);
		handle = null;
		const endedAt = now();
		const marks = measures().filter(
			(entry) =>
				P23B_M1_POINTERMOVE_MARKS.includes(entry.name as (typeof P23B_M1_POINTERMOVE_MARKS)[number]) &&
				entry.startTime >= startedAt &&
				entry.startTime + entry.duration <= endedAt
		);
		const series = buildGestureFrameSeries({ label, startedAt, endedAt, samples, pointermoveMarks: marks });
		samples = [];
		return series;
	}

	return { start, stop, sampling: () => handle !== null };
}

/** The pure half: one bracket's frames + the product's marks → one reported series. */
export function buildGestureFrameSeries(input: {
	label: string;
	startedAt: number;
	endedAt: number;
	samples: readonly P23BM1FrameSample[];
	pointermoveMarks: readonly { name: string; startTime: number; duration: number }[];
}): P23BM1GestureFrameSeries {
	const windows = input.pointermoveMarks.map((mark) => ({
		start: mark.startTime,
		end: mark.startTime + mark.duration
	}));
	// A frame is "inside" a pointermove window when the mark's own interval covers
	// the frame's clock read — the correlation the plan asks for, measured from the
	// frame's real timestamp rather than from an assumed cadence.
	const inside = input.samples.filter((sample) =>
		windows.some((window) => window.start <= sample.end && sample.end <= window.end)
	).length;
	return {
		label: input.label,
		definition: P23B_M1_GESTURE_FRAME_DEFINITION,
		startedAt: input.startedAt,
		endedAt: input.endedAt,
		spanMs: Math.max(0, input.endedAt - input.startedAt),
		frames: input.samples.length,
		samples: input.samples.map((sample) => ({ ...sample })),
		distribution: summarizeIntervals(input.samples.map((sample) => sample.interval)),
		overFrameBudget: input.samples.filter((sample) => sample.interval > P23B_M1_FRAME_BUDGET_MS).length,
		over50Ms: input.samples.filter((sample) => sample.interval >= P23B_M1_LONG_FRAME_MS).length,
		pointermove: summarizePointermoveMarks(input.pointermoveMarks),
		coverage: {
			drags: 1,
			frames: input.samples.length,
			framesInsidePointermoveWindows: inside,
			pointermoveMarks: input.pointermoveMarks.length,
			pointermoveShare: input.samples.length > 0 ? inside / input.samples.length : 0
		}
	};
}

/** Fold many drags' series into the one row a class reports, keeping coverage visible. */
export function mergeGestureFrameSeries(
	series: readonly P23BM1GestureFrameSeries[]
): P23BM1GestureFrameSeries | null {
	if (series.length === 0) return null;
	const samples = series.flatMap((entry) => entry.samples);
	const startedAt = Math.min(...series.map((entry) => entry.startedAt));
	const endedAt = Math.max(...series.map((entry) => entry.endedAt));
	const inside = series.reduce((sum, entry) => sum + entry.coverage.framesInsidePointermoveWindows, 0);
	// Mark occurrences are pooled from the per-drag summaries: the count is the sum
	// of the drags' counts and the distribution is reported over those occurrences.
	const pooled = new Map<string, { values: number[]; count: number }>();
	for (const entry of series) {
		for (const mark of entry.pointermove) {
			const current = pooled.get(mark.name) ?? { values: [], count: 0 };
			// A per-drag row keeps p50/p95 only, so its occurrences are re-expanded at
			// their own reported p50 — stated here rather than silently inflating a
			// distribution the drag already summarized.
			for (let index = 0; index < mark.count; index += 1) current.values.push(mark.p50);
			current.count += mark.count;
			pooled.set(mark.name, current);
		}
	}
	return {
		label: series[0]!.label,
		definition: P23B_M1_GESTURE_FRAME_DEFINITION,
		startedAt,
		endedAt,
		spanMs: Math.max(0, endedAt - startedAt),
		frames: samples.length,
		samples,
		distribution: summarizeIntervals(samples.map((sample) => sample.interval)),
		overFrameBudget: samples.filter((sample) => sample.interval > P23B_M1_FRAME_BUDGET_MS).length,
		over50Ms: samples.filter((sample) => sample.interval >= P23B_M1_LONG_FRAME_MS).length,
		pointermove: [...pooled].map(([name, entry]) => ({
			name,
			count: entry.count,
			p50: percentile(entry.values, 0.5),
			p95: percentile(entry.values, 0.95),
			totalMs: entry.values.reduce((sum, value) => sum + value, 0)
		})),
		coverage: {
			drags: series.length,
			frames: samples.length,
			framesInsidePointermoveWindows: inside,
			pointermoveMarks: series.reduce((sum, entry) => sum + entry.coverage.pointermoveMarks, 0),
			pointermoveShare: samples.length > 0 ? inside / samples.length : 0
		}
	};
}

function summarizePointermoveMarks(
	marks: readonly { name: string; startTime: number; duration: number }[]
): { name: string; count: number; p50: number; p95: number; totalMs: number }[] {
	const byName = new Map<string, number[]>();
	for (const mark of marks) {
		const values = byName.get(mark.name) ?? [];
		values.push(mark.duration);
		byName.set(mark.name, values);
	}
	return [...byName].map(([name, values]) => ({
		name,
		count: values.length,
		p50: percentile(values, 0.5),
		p95: percentile(values, 0.95),
		totalMs: values.reduce((sum, value) => sum + value, 0)
	}));
}

// ---------------------------------------------------------------------------
// (b2) long-frame observer
// ---------------------------------------------------------------------------

type LongFrameObserverOptions = {
	enabled?: () => boolean;
	/** Injected for tests; defaults to a real PerformanceObserver. */
	observe?: (onEntries: (entries: readonly P23BM1LongFrameEntry[]) => void) => { disconnect: () => void };
	supported?: boolean;
};

function longFrameSupported(): boolean {
	return (
		typeof PerformanceObserver !== 'undefined' &&
		(PerformanceObserver.supportedEntryTypes ?? []).includes('long-animation-frame')
	);
}

function realObserve(onEntries: (entries: readonly P23BM1LongFrameEntry[]) => void) {
	const observer = new PerformanceObserver((list) => {
		onEntries(
			list.getEntries().map((entry) => {
				const long = entry as PerformanceEntry & {
					renderStart?: number;
					styleAndLayoutStart?: number;
					blockingDuration?: number;
					scripts?: { startTime: number }[];
				};
				return {
					startTime: long.startTime,
					duration: long.duration,
					renderStart: long.renderStart ?? long.startTime,
					styleAndLayoutStart: long.styleAndLayoutStart ?? long.startTime,
					blockingDuration: long.blockingDuration ?? 0,
					firstScriptStart: long.scripts?.[0]?.startTime ?? null
				};
			})
		);
	});
	observer.observe({ type: 'long-animation-frame', buffered: false });
	return { disconnect: () => observer.disconnect() };
}

/**
 * The long-frame observer. `supported()` reports whether the runtime reports the
 * entry type at all, so an unsupported runtime records NOT MEASURED instead of a
 * zero that would read as "no long frames happened".
 */
export function createP23BLongFrameObserver(options: LongFrameObserverOptions = {}) {
	const enabled = options.enabled ?? p23bM1FrameTimingEnabled;
	const supportedProbe = options.supported ?? longFrameSupported();
	const observe = options.observe ?? realObserve;

	let subscription: { disconnect: () => void } | null = null;
	let entries: P23BM1LongFrameEntry[] = [];

	function start(): void {
		if (!enabled() || !supportedProbe || subscription) return;
		entries = [];
		try {
			subscription = observe((next) => {
				entries.push(...next);
			});
		} catch {
			// A runtime that advertises the entry type but refuses the observer is
			// reported as unsupported rather than silently reporting zero.
			subscription = null;
		}
	}

	function stop(): P23BM1LongFrameEntry[] {
		subscription?.disconnect();
		subscription = null;
		const collected = entries;
		entries = [];
		return collected;
	}

	return { start, stop, observing: () => subscription !== null, supported: () => supportedProbe };
}

/** The pure half: long frames + the class's releases → the incidence row. */
export function summarizeLongFrames(
	entries: readonly P23BM1LongFrameEntry[],
	releaseSpans: readonly { start: number; end: number }[],
	supported = true,
	notMeasuredReason: string | null = null
): P23BM1LongFrameSummary {
	let touched = 0;
	for (const release of releaseSpans) {
		if (
			entries.some(
				(entry) => entry.startTime < release.end && entry.startTime + entry.duration > release.start
			)
		) {
			touched += 1;
		}
	}
	return {
		definition: P23B_M1_LONG_FRAME_DEFINITION,
		frames: entries.length,
		over100Ms: entries.filter((entry) => entry.duration >= 100).length,
		distribution: summarizeIntervals(entries.map((entry) => entry.duration)),
		renderStartDelay: summarizeIntervals(entries.map((entry) => entry.renderStart - entry.startTime)),
		styleAndLayoutDelay: summarizeIntervals(entries.map((entry) => entry.styleAndLayoutStart - entry.startTime)),
		blockingDuration: summarizeIntervals(entries.map((entry) => entry.blockingDuration)),
		coverage: {
			releases: releaseSpans.length,
			releasesTouched: touched,
			releasesTouchedShare: releaseSpans.length > 0 ? touched / releaseSpans.length : 0
		},
		supported,
		notMeasuredReason
	};
}

// ---------------------------------------------------------------------------
// (b1) presented-frame correlation
// ---------------------------------------------------------------------------

export type P23BM1PresentedFrameInput = {
	/** Presentation timestamps on the recording tool's clock, ascending. */
	presented: readonly number[];
	/** One accepted release per row; `end` is the page-clock end of the synchronous release. */
	releaseSpans: readonly { actionIndex: number; path: string; outcome: string; start: number; end: number }[];
	/** Added to a page-clock value to reach the tool clock. */
	offsetMs: number;
	/** A release with no presented frame inside this budget is reported as unmeasured. */
	budgetMs: number;
};

export type P23BM1PresentedFrameRow = {
	signal: 'presented-frame';
	definition: string;
	distribution: P23BM1IntervalSeries;
	coverage: {
		releases: number;
		measuredReleases: number;
		unmeasuredReleases: number;
		measuredShare: number;
	};
	/** Per-release latency in page-clock ms, in release order. */
	samples: { actionIndex: number; path: string; latencyMs: number }[];
	/** Per-path distributions, never summed across paths. */
	byPath: Record<string, P23BM1IntervalSeries>;
	offsetMs: number;
	budgetMs: number;
};

/**
 * The first presented frame strictly after each release end; a release with no
 * presented frame inside the budget is COUNTED as unmeasured, never guessed. The
 * caller measures the clock offset and its residual, so the correlation's own
 * uncertainty is visible beside the number it produces.
 */
export function correlatePresentedFrames(input: P23BM1PresentedFrameInput): P23BM1PresentedFrameRow {
	const samples: { actionIndex: number; path: string; latencyMs: number }[] = [];
	const byPath = new Map<string, number[]>();
	let unmeasured = 0;
	for (const release of input.releaseSpans) {
		const releaseEnd = release.end + input.offsetMs;
		const next = firstAfter(input.presented, releaseEnd);
		const latency = next === null ? null : next - releaseEnd;
		if (latency === null || latency > input.budgetMs) {
			unmeasured += 1;
			continue;
		}
		samples.push({ actionIndex: release.actionIndex, path: release.path, latencyMs: latency });
		const values = byPath.get(release.path) ?? [];
		values.push(latency);
		byPath.set(release.path, values);
	}
	return {
		signal: 'presented-frame',
		definition: P23B_M1_PRESENTED_FRAME_DEFINITION,
		distribution: summarizeIntervals(samples.map((sample) => sample.latencyMs)),
		coverage: {
			releases: input.releaseSpans.length,
			measuredReleases: samples.length,
			unmeasuredReleases: unmeasured,
			measuredShare: input.releaseSpans.length > 0 ? samples.length / input.releaseSpans.length : 0
		},
		samples,
		byPath: Object.fromEntries([...byPath].map(([path, values]) => [path, summarizeIntervals(values)])),
		offsetMs: input.offsetMs,
		budgetMs: input.budgetMs
	};
}

function firstAfter(values: readonly number[], target: number): number | null {
	for (const value of values) if (value > target) return value;
	return null;
}

// ---------------------------------------------------------------------------
// class-keyed registry
// ---------------------------------------------------------------------------

let registry: P23BM1FrameTiming = { gestureFrames: [], longFrames: [] };

/** Drop everything the M1 run has collected so far. */
export function p23bM1ResetFrameTiming(): void {
	registry = { gestureFrames: [], longFrames: [] };
}

/** Append one class's long-frame window. One entry per fixture+class. */
export function p23bM1RecordLongFrames(
	fixtureId: string,
	actionClass: string,
	entries: readonly P23BM1LongFrameEntry[],
	supported: boolean
): void {
	registry = {
		...registry,
		longFrames: [
			...registry.longFrames,
			{ key: `${fixtureId}/${actionClass}`, fixtureId, actionClass, entries: [...entries], supported }
		]
	};
}

/** Append one drag's gesture series, keyed to the class it was measured in. */
export function p23bM1RecordGestureFrames(
	fixtureId: string,
	actionClass: string,
	path: string,
	series: P23BM1GestureFrameSeries
): void {
	registry = {
		...registry,
		gestureFrames: [
			...registry.gestureFrames,
			{ key: `${fixtureId}/${actionClass}/${path}`, fixtureId, actionClass, path, series }
		]
	};
}

/** A fixed copy, so a reader can never mutate the registry. */
export function p23bM1FrameTiming(): P23BM1FrameTiming {
	return {
		gestureFrames: registry.gestureFrames.map((entry) => ({
			...entry,
			series: {
				...entry.series,
				samples: entry.series.samples.map((sample) => ({ ...sample })),
				pointermove: entry.series.pointermove.map((mark) => ({ ...mark })),
				coverage: { ...entry.series.coverage }
			}
		})),
		longFrames: registry.longFrames.map((entry) => ({ ...entry, entries: entry.entries.map((frame) => ({ ...frame })) }))
	};
}

export function summarizeIntervals(values: readonly number[]): P23BM1IntervalSeries {
	return {
		count: values.length,
		p50: percentile(values, 0.5),
		p95: percentile(values, 0.95),
		max: values.length > 0 ? Math.max(...values) : 0,
		mean: values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : 0
	};
}
