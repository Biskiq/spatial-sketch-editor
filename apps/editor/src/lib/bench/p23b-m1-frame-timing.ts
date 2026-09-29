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
 *     ONE POPULATION, like every other M1 row. A bracket is per ATTEMPT, and an
 *     attempt is not an action: warm-up drags are drags, and a retried attempt is
 *     a drag whose action the class does not report. The reported row is merged
 *     over the class's measured actions only, and the brackets left out are
 *     counted (`coverage.registeredDrags`, `coverage.excludedDrags`) instead of
 *     being averaged in — see `P23B_M1_GESTURE_POPULATION_RULE`.
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
import type { BenchInteractionOutcome } from '$lib/bench/bench-types';

/** The frame budget the incidence is counted against; 60 Hz. */
export const P23B_M1_FRAME_BUDGET_MS = 16.7;
/** Long-animation-frame's own threshold; a frame at or above it is reported by the observer. */
export const P23B_M1_LONG_FRAME_MS = 50;
/** The product's own drag-preview marks, which the gesture series correlates with. */
export const P23B_M1_POINTERMOVE_MARKS = ['p2311:pointermove-rigid', 'p2311:pointermove-bend'] as const;

export const P23B_M1_GESTURE_FRAME_DEFINITION =
	'requestAnimationFrame callback interval during a real Plan drag (pointerdown → the action resolving), correlated with the product marks p2311:pointermove-rigid / p2311:pointermove-bend. A callback interval is a PROXY: it is not presented-frame latency, not paint time and not GPU work.';
/**
 * ONE POPULATION, stated on every reported gesture series. A drag is bracketed
 * per ATTEMPT, and an attempt is not an action: the leading warm-up drags are
 * still drags, and a retried attempt produced a drag whose action the class does
 * not report. Merging every bracket would therefore average warm-up and retry
 * frames into a row that claims to describe the class's measured actions.
 */
export const P23B_M1_GESTURE_POPULATION_RULE =
	'The merged series is taken over the class\'s MEASURED actions only: completed drags with a resolved path, the leading warm-up actions excluded per path, accepted outcomes only — the same population the class\'s mark and release rows describe. Every registered bracket outside it (warm-up drags, retried attempts, attempts whose action never resolved) is counted in `coverage.registeredDrags` / `coverage.excludedDrags`, never merged into the distribution.';
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
	/** The population rule that produced `samples`; part of the row's contract. */
	populationRule: string;
	coverage: {
		/** The class's measured actions the merged series is taken over. */
		populationActions: number;
		/** Drags actually merged: measured actions that had a registered bracket. */
		drags: number;
		/** Every bracket registered for this class, warm-up and retries included. */
		registeredDrags: number;
		/** `registeredDrags - drags`: warm-up drags, retries and unresolved attempts. */
		excludedDrags: number;
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

/** One drag's series, keyed to the class it was measured in AND to its action. */
export type P23BM1GestureFrameEntry = {
	key: string;
	fixtureId: string;
	actionClass: string;
	path: string;
	/**
	 * The ledger index of the action this bracket resolved to, so the series can
	 * be matched to the class's measured population. `null` when the attempt threw
	 * or never resolved: such a drag can never be a measured action.
	 */
	actionIndex: number | null;
	/** That action's outcome, so an excluded drag can be attributed to warm-up, a
	 * retry or an unresolved attempt instead of silently disappearing. */
	outcome: BenchInteractionOutcome | null;
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

/**
 * The gesture series of one fixture+class, merged over the class's MEASURED
 * action population and nothing else.
 *
 * The population is a required argument, not a default: the caller must have
 * already decided which actions the class reports (the same decision that
 * produced its mark and release rows), and only brackets whose resolved action
 * index is in that population may enter the distribution. A class with no
 * measured drag at all reports `null` — even when warm-up and retry brackets
 * were registered — so an empty population can never be read as a small sample.
 */
export function p23bM1GestureFramesFor(
	registry: P23BM1FrameTiming,
	fixtureId: string,
	actionClass: string,
	measuredActionIndices: ReadonlySet<number>
): P23BM1GestureFrameSeries | null {
	const registered = registry.gestureFrames.filter(
		(entry) => entry.fixtureId === fixtureId && entry.actionClass === actionClass
	);
	const measured = registered.filter(
		(entry) => entry.actionIndex !== null && measuredActionIndices.has(entry.actionIndex)
	);
	if (measured.length === 0) return null;
	return mergeGestureFrameSeries(
		measured.map((entry) => entry.series),
		registered.length,
		measuredActionIndices.size
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
		populationRule: P23B_M1_GESTURE_POPULATION_RULE,
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
			populationActions: 1,
			drags: 1,
			registeredDrags: 1,
			excludedDrags: 0,
			frames: input.samples.length,
			framesInsidePointermoveWindows: inside,
			pointermoveMarks: input.pointermoveMarks.length,
			pointermoveShare: input.samples.length > 0 ? inside / input.samples.length : 0
		}
	};
}

/**
 * Fold the MEASURED drags' series into the one row a class reports, keeping the
 * exclusions visible.
 *
 * `series` is the measured population and must already have been filtered;
 * `registeredDrags` says how many brackets the class bracketed in total, so the
 * row can state how many drags it left out and the population it left them out
 * for. `populationActions` is the class's measured action count, which may exceed
 * `series.length` when a measured action produced no bracket at all.
 */
export function mergeGestureFrameSeries(
	series: readonly P23BM1GestureFrameSeries[],
	registeredDrags = series.length,
	populationActions = series.length
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
		populationRule: P23B_M1_GESTURE_POPULATION_RULE,
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
			populationActions,
			drags: series.length,
			registeredDrags: Math.max(registeredDrags, series.length),
			excludedDrags: Math.max(registeredDrags, series.length) - series.length,
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
	/**
	 * Per-release latency in page-clock ms, in release order. `presentedMs` is the
	 * same sample's presented instant on the TRACE clock, which is what a trace
	 * span's own timestamps can be compared against; the window summarizer below
	 * needs it, and reporting it keeps the correlation's two clocks visible.
	 */
	samples: { actionIndex: number; path: string; latencyMs: number; presentedMs: number }[];
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
	const samples: { actionIndex: number; path: string; latencyMs: number; presentedMs: number }[] = [];
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
		samples.push({ actionIndex: release.actionIndex, path: release.path, latencyMs: latency, presentedMs: next! });
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
// (b2) the post-release window, priced by trace-event DURATION
// ---------------------------------------------------------------------------

/**
 * WHAT THIS ROW ANSWERS. Every other row in the slice says how LONG the wait after
 * a release is; none of them says what is inside it. The release row's own
 * page-side buckets (`insideRelease` / `afterRelease`) are PAGE marks, so the part
 * of the wait that happens after the page's LAST attributed mark — measured at
 * 43–59 % (Chrome) / 47–78 % (Electron) of it — has no page-side owner at all. The
 * trace does carry DURATIONS for the frame work the renderer performs in that
 * window, so the window can be split without a new page instrument.
 *
 * WHAT IT DELIBERATELY DOES NOT DO. It never sums phases: the trace's frame events
 * NEST (`AnimationFrame` contains `AnimationFrame::Render`, which contains
 * `Paint`; `FunctionCall` nests inside the rAF callbacks), so adding phases would
 * count the same microseconds several times. Every phase is reported on its own —
 * occurrences, the share of windows it appears in, and the distribution of its
 * per-window summed duration, with every span CLIPPED to the window — and the ONE
 * partition this row states is `frameOccupiedMs` (the union of `AnimationFrame`
 * spans, which do not overlap) against `outsideFramesMs` (the window minus that
 * union): frame work versus the scheduling and presentation latency the trace
 * shows no frame for.
 */
export const P23B_M1_WINDOW_PHASE_DEFINITION =
	'post-release window = the page-clock end of an accepted action\'s synchronous release → the first presented frame strictly after it, mapped into the trace clock through the run\'s own calibration. Inside it every named trace phase is reported SEPARATELY (occurrences · share of windows it appears in · distribution of the UNION of its intervals, clipped to the window) and no phase is ever added to another. A union, not a sum: the trace\'s spans nest (`FunctionCall` inside `FunctionCall`, `Paint` inside `Render`), so a sum would count the same microsecond several times. The one partition stated is `frameOccupiedMs` (the union of `AnimationFrame` spans) against `outsideFramesMs` (the window minus that union), and `scriptFunctions` names the JavaScript inside the window by function, script and DEFINITION SITE (name + file + line + column), because a name alone cannot be acted on when the script is a pre-bundled dependency chunk.';

/**
 * One trace span, in the trace clock (ms). `functionName`/`url` are carried for
 * `FunctionCall` only, because the honest version of "the tail is JavaScript" is
 * naming WHICH JavaScript: a function name and the script it came from.
 */
export type P23BM1TraceSpan = {
	name: string;
	startMs: number;
	durMs: number;
	functionName?: string | null;
	url?: string | null;
	/**
	 * `FunctionCall` only: the position CDP reports for the CALLEE, which is the
	 * function's DEFINITION site in its own script. A name alone is not enough to
	 * act on when the script is a pre-bundled dependency chunk (`deps/chunk-*.js`)
	 * and the function is anonymous: the line is what maps back to the source file
	 * through the chunk's own sourcemap, and what separates two identically named
	 * functions defined in two places.
	 */
	lineNumber?: number | null;
	columnNumber?: number | null;
};

/** The window one accepted release opened, both sides on the trace clock. */
export type P23BM1PresentedWindow = {
	/** `fixtureId/actionClass`, the key every class row is read under. */
	key: string;
	actionIndex: number;
	/** The release's page-clock end, mapped into the trace clock. */
	startMs: number;
	/** The presented instant that release correlated to, trace clock. */
	endMs: number;
};

type P23BM1WindowPhaseMatcher = { phase: string; names: readonly string[]; prefixes: readonly string[] };

/**
 * The phases this row prices, using the names Chrome 152's `devtools.timeline`
 * actually emits on this surface (checked against a capture's own name histogram,
 * not assumed). `AnimationFrame` is handled separately as the frame span, because
 * it is the one span family whose members do not overlap.
 */
export const P23B_M1_WINDOW_PHASES: readonly P23BM1WindowPhaseMatcher[] = [
	{ phase: 'script', names: ['FunctionCall'], prefixes: [] },
	{ phase: 'raf-callback', names: ['FireAnimationFrame'], prefixes: [] },
	{ phase: 'frame-script', names: ['AnimationFrame::Script::Execute'], prefixes: [] },
	{ phase: 'style-and-layout', names: ['AnimationFrame::StyleAndLayout'], prefixes: [] },
	{ phase: 'style-recalc', names: ['UpdateLayoutTree'], prefixes: [] },
	{ phase: 'layout', names: ['Layout'], prefixes: [] },
	{ phase: 'prepaint', names: ['PrePaint'], prefixes: [] },
	{ phase: 'paint', names: ['Paint'], prefixes: [] },
	{ phase: 'render', names: ['AnimationFrame::Render'], prefixes: [] },
	{ phase: 'event-dispatch', names: ['EventDispatch'], prefixes: [] },
	{ phase: 'gc', names: [], prefixes: ['V8.GC_'] }
];

/** The frame span whose union the `outsideFramesMs` partition is taken against. */
export const P23B_M1_FRAME_SPAN_NAME = 'AnimationFrame';

/**
 * Whether a trace event is worth RETAINING at all. The runner keeps only the
 * spans this row prices, so a capture that never asks the question still costs
 * nothing in memory.
 */
export function p23bM1PricesTraceSpan(name: string): boolean {
	if (name === P23B_M1_FRAME_SPAN_NAME) return true;
	return P23B_M1_WINDOW_PHASES.some(
		(matcher) => matcher.names.includes(name) || matcher.prefixes.some((prefix) => name.startsWith(prefix))
	);
}

export type P23BM1WindowPhaseRow = {
	phase: string;
	/** Span occurrences inside any window of this class. */
	occurrences: number;
	/** Windows this phase appeared in at least once. */
	windowsPresent: number;
	windowsPresentShare: number;
	/**
	 * Per window, the UNION of this phase's clipped intervals: the time at least one
	 * span of this phase was on the stack. A UNION, not a sum, because the trace's
	 * spans NEST — `FunctionCall` inside `FunctionCall`, `Paint` inside `Render` — so
	 * summing them would count the same microsecond several times. The first version
	 * of this row did sum, and read a 235 ms window as 228 ms of JavaScript; the
	 * union says what the window can actually support.
	 */
	occupiedMs: P23BM1IntervalSeries;
};

/** One JavaScript function seen in the windows, by name and script. */
export type P23BM1WindowScriptFunctionRow = {
	functionName: string;
	/** The script the function came from, shortened to its last two path segments. */
	script: string;
	/**
	 * The function's definition site in that script (`null` when the trace did not
	 * carry it). Rows are keyed by name + script + site, so two functions that
	 * share a name and a file are never merged into one row and one line can be
	 * mapped back to source. For a pre-bundled dependency chunk this is the only
	 * way to say WHICH function a row names.
	 */
	lineNumber: number | null;
	columnNumber: number | null;
	occurrences: number;
	windowsPresent: number;
	windowsPresentShare: number;
	/** Union of this function's clipped intervals, per window. */
	occupiedMs: P23BM1IntervalSeries;
	/** Union across the class's windows, the row's ordering key. */
	totalOccupiedMs: number;
};

export type P23BM1PresentedWindowSummary = {
	definition: string;
	/** Accepted releases this class has both sides of. */
	windows: number;
	/** The window itself: release end → presented instant. */
	windowMs: P23BM1IntervalSeries;
	/** The union of `AnimationFrame` spans inside each window. */
	frameOccupiedMs: P23BM1IntervalSeries;
	/** `windowMs − frameOccupiedMs`: scheduling and presentation latency, no frame named. */
	outsideFramesMs: P23BM1IntervalSeries;
	framesPerWindow: P23BM1IntervalSeries;
	/** Every phase, each on its own — never summed with another phase. */
	phases: P23BM1WindowPhaseRow[];
	/**
	 * The largest JavaScript functions inside the windows, by union time. The
	 * question "is the tail JavaScript?" is only answerable usefully as "which
	 * JavaScript", and a `FunctionCall` span carries both the function name and the
	 * script that defined it.
	 */
	scriptFunctions: P23BM1WindowScriptFunctionRow[];
};

function clippedOverlapMs(span: P23BM1TraceSpan, window: P23BM1PresentedWindow): number {
	const start = Math.max(span.startMs, window.startMs);
	const end = Math.min(span.startMs + span.durMs, window.endMs);
	return end > start ? end - start : 0;
}

function matchWindowPhase(name: string): P23BM1WindowPhaseMatcher | undefined {
	return P23B_M1_WINDOW_PHASES.find(
		(matcher) => matcher.names.includes(name) || matcher.prefixes.some((prefix) => name.startsWith(prefix))
	);
}

/** Union length of possibly-overlapping intervals, in ms. */
function unionMs(intervals: readonly { start: number; end: number }[]): number {
	if (intervals.length === 0) return 0;
	const sorted = [...intervals].sort((a, b) => a.start - b.start);
	let total = 0;
	let currentStart = sorted[0]!.start;
	let currentEnd = sorted[0]!.end;
	for (const interval of sorted.slice(1)) {
		if (interval.start > currentEnd) {
			total += currentEnd - currentStart;
			currentStart = interval.start;
			currentEnd = interval.end;
			continue;
		}
		currentEnd = Math.max(currentEnd, interval.end);
	}
	return total + (currentEnd - currentStart);
}

/** The last two path segments of a script URL, so a row stays readable. */
function shortScript(url: string): string {
	if (!url) return '(no script — inline or evaluated)';
	const withoutQuery = url.split(/[?#]/)[0]!;
	const parts = withoutQuery.split('/').filter((part) => part.length > 0);
	return parts.slice(-2).join('/') || withoutQuery;
}

/** How many JavaScript functions a class row names; the tail is long, the row is not. */
export const P23B_M1_WINDOW_FUNCTION_LIMIT = 12;

/**
 * One arm's window rows, over that arm's OWN actions. `summary` is the same
 * `summarizePresentedWindowPhases` row the class reports, so an arm that holds the
 * whole population reports the class's own numbers rather than a parallel set.
 */
export type P23BM1WindowArmRow = {
	arm: string;
	/**
	 * Action indices the driver assigned to this arm in this class — warm-up attempts
	 * and retries INCLUDED, because the arm alternates per attempt. It is therefore an
	 * upper bound of `windows`, not a coverage denominator: `windows` counts only the
	 * measured accepted actions whose release was paired with a presented instant.
	 */
	assignedActions: number;
	/** Measured accepted actions of this arm whose release correlated to a frame. */
	windows: number;
	summary: P23BM1PresentedWindowSummary;
};

/** One row of the within-session before/after table, signed `after − before`. */
export type P23BM1WindowArmComparisonRow = {
	label: string;
	beforeMs: number | null;
	afterMs: number | null;
	deltaMs: number | null;
	/** `afterMs / beforeMs`; `null` when the before arm reported no such row. */
	ratio: number | null;
};

export const P23B_M1_WINDOW_ARM_NOTE =
	'Same-session before/after over the post-release windows: each arm is summarized over its OWN actions only, with the arm chosen per attempt and recorded against the resolved action index, so session drift moves every arm. The delta is signed AFTER − BEFORE — a negative value is the change being faster — and is taken between the two signed arms\' p50s, not paired per action: the arm action counts are stated beside it, and an arm with no covered window leaves its cells null rather than zero. An arm that is summarized but not signed is still measured: its own rows stand beside the delta, and the pair the delta was signed from is stated with it.';

/**
 * The rule the per-arm window split runs under, stated where the split is made.
 */
export const P23B_M1_LABEL_ARM_WINDOW_RULE =
	'Each arm\'s rows are the CLASS\'s own post-release windows restricted to the actions that ran under that arm: the split key is the action index the driver recorded the arm against, so no window can be assigned to an arm it did not run under, and a window whose action recorded no arm is DROPPED and counted in `unassignedWindows` rather than assigned to a side. Every arm — the two the delta is signed between and any arm interleaved beside them — is summarized by the same function that produces the class row beside them, so a per-arm cell can never drift from the class it was split out of. The arms alternate per attempt INSIDE ONE SESSION, so the difference between them is the change and not the machine; the class\'s own rows above the split span every arm and are a MIXED population, and the per-arm rows here are the ones to read. The release row is NOT split — every arm is released by the same click — and stands beside the split as the unchanged control.';

/**
 * Split the post-release windows by the arm each action ran under and summarize
 * each arm with the class's own window summarizer.
 *
 * WHY THE SPLIT LIVES HERE. A window is `(key, actionIndex, startMs, endMs)` and the
 * arm map is keyed by action index, so the split is exact and needs no heuristics;
 * what matters is that both arms are summarized by the SAME function that produces
 * the class row, so the before/after table cannot drift from the row beside it.
 * Windows whose action has no arm recorded are DROPPED, not assigned: an
 * unattributed window in an arm cell would be a fabricated measurement.
 */
export function summarizePresentedWindowArms(input: {
	windows: readonly P23BM1PresentedWindow[];
	spans: readonly P23BM1TraceSpan[];
	byAction: ReadonlyMap<number, string>;
	arms: readonly string[];
	/** The arm treated as the AFTER (shipped) side of the signed delta. */
	afterArm: string;
	/** The arm treated as the BEFORE (pre-change) side of the signed delta. */
	beforeArm: string;
}): {
	rows: P23BM1WindowArmRow[];
	comparison: P23BM1WindowArmComparisonRow[];
	/** Windows whose action recorded no arm: in no arm, and counted here. */
	unassignedWindows: number;
} {
	const rows: P23BM1WindowArmRow[] = [];
	const byArm = new Map<string, P23BM1PresentedWindowSummary>();
	const assignedActions = new Map<string, number>();
	for (const arm of input.byAction.values()) {
		assignedActions.set(arm, (assignedActions.get(arm) ?? 0) + 1);
	}
	const unassignedWindows = input.windows.filter(
		(window) => input.byAction.get(window.actionIndex) === undefined
	).length;
	for (const arm of input.arms) {
		const own = input.windows.filter((window) => input.byAction.get(window.actionIndex) === arm);
		const key = own[0]?.key ?? input.windows[0]?.key ?? 'unkeyed';
		// Every window in one call carries one key (the class), so summarizing the arm's
		// own windows under that key is the class row restricted to the arm.
		const summary = own.length === 0 ? null : summarizePresentedWindowPhases({ windows: own, spans: input.spans })[key];
		if (summary) {
			byArm.set(arm, summary);
			rows.push({ arm, assignedActions: assignedActions.get(arm) ?? 0, windows: own.length, summary });
			continue;
		}
		rows.push({
			arm,
			assignedActions: assignedActions.get(arm) ?? 0,
			windows: 0,
			summary: {
				definition: P23B_M1_WINDOW_PHASE_DEFINITION,
				windows: 0,
				windowMs: summarizeIntervals([]),
				frameOccupiedMs: summarizeIntervals([]),
				outsideFramesMs: summarizeIntervals([]),
				framesPerWindow: summarizeIntervals([]),
				phases: P23B_M1_WINDOW_PHASES.map((matcher) => ({
					phase: matcher.phase,
					occurrences: 0,
					windowsPresent: 0,
					windowsPresentShare: 0,
					occupiedMs: summarizeIntervals([])
				})),
				scriptFunctions: []
			}
		});
	}
	const scriptP50 = (summary: P23BM1PresentedWindowSummary | undefined): number | null =>
		summary?.phases.find((phase) => phase.phase === 'script')?.occupiedMs.p50 ?? null;
	const before = byArm.get(input.beforeArm);
	const after = byArm.get(input.afterArm);
	const comparison: P23BM1WindowArmComparisonRow[] = [];
	const compare = (label: string, beforeMs: number | null, afterMs: number | null): void => {
		comparison.push({
			label,
			beforeMs,
			afterMs,
			deltaMs: beforeMs === null || afterMs === null ? null : Math.round((afterMs - beforeMs) * 1000) / 1000,
			ratio: beforeMs === null || afterMs === null || beforeMs === 0 ? null : Math.round((afterMs / beforeMs) * 1000) / 1000
		});
	};
	compare('window p50', before?.windowMs.p50 ?? null, after?.windowMs.p50 ?? null);
	compare('window p95', before?.windowMs.p95 ?? null, after?.windowMs.p95 ?? null);
	compare('script union p50', scriptP50(before), scriptP50(after));
	// The largest function inside the window, by the AFTER arm's own ordering, so the
	// table names the work the arm moved rather than only its total.
	const biggest = after?.scriptFunctions[0];
	if (biggest) {
		const beforeRow = before?.scriptFunctions.find(
			(row) => row.script === biggest.script && row.functionName === biggest.functionName
		);
		compare(
			`script ${biggest.script} ${biggest.functionName} p50`,
			beforeRow?.occupiedMs.p50 ?? null,
			biggest.occupiedMs.p50
		);
	}
	return { rows, comparison, unassignedWindows };
}

/**
 * Split every window by the trace's own durations, per class. Windows with no spans
 * at all are still reported: an empty window is the strongest form of the finding
 * this row exists to make, not a missing measurement.
 *
 * THE ONE SUMMARIZER. Every per-arm and per-class-window row in the record is this
 * function, called over a different set of windows — the arm split restricts the
 * windows and hands them back here — so a per-arm cell can never drift from the
 * class row it was split out of.
 */
export function summarizePresentedWindowPhases(input: {
	windows: readonly P23BM1PresentedWindow[];
	spans: readonly P23BM1TraceSpan[];
}): Record<string, P23BM1PresentedWindowSummary> {
	const byKey = new Map<string, P23BM1PresentedWindow[]>();
	for (const window of input.windows) {
		const list = byKey.get(window.key) ?? [];
		list.push(window);
		byKey.set(window.key, list);
	}
	// Spans arrive once per run and are reused by every class: sort a copy by start
	// so a class's own range can be sliced cheaply, and clip inside the loop.
	const spans = [...input.spans].sort((a, b) => a.startMs - b.startMs);
	const out: Record<string, P23BM1PresentedWindowSummary> = {};
	for (const [key, windows] of byKey) {
		const windowMs: number[] = [];
		const frameOccupiedMs: number[] = [];
		const outsideFramesMs: number[] = [];
		const framesPerWindow: number[] = [];
		const buckets = new Map<string, { occurrences: number; present: number; values: number[] }>(
			P23B_M1_WINDOW_PHASES.map((matcher) => [matcher.phase, { occurrences: 0, present: 0, values: [] }])
		);
		const functions = new Map<
			string,
			{
				functionName: string;
				script: string;
				lineNumber: number | null;
				columnNumber: number | null;
				occurrences: number;
				present: number;
				values: number[];
				total: number;
			}
		>();
		const rangeStart = Math.min(...windows.map((window) => window.startMs));
		const rangeEnd = Math.max(...windows.map((window) => window.endMs));
		const inRange = spans.filter((span) => span.startMs <= rangeEnd && span.startMs + span.durMs >= rangeStart);
		for (const window of windows) {
			const duration = Math.max(0, window.endMs - window.startMs);
			windowMs.push(duration);
			const frameIntervals: { start: number; end: number }[] = [];
			/** Per phase, this window's clipped intervals — unioned below, never summed. */
			const perWindow = new Map<string, { start: number; end: number }[]>();
			const perFunction = new Map<string, { start: number; end: number }[]>();
			let frames = 0;
			for (const span of inRange) {
				const clipped = {
					start: Math.max(span.startMs, window.startMs),
					end: Math.min(span.startMs + span.durMs, window.endMs)
				};
				if (clipped.end <= clipped.start) continue;
				if (span.name === P23B_M1_FRAME_SPAN_NAME) {
					frames += 1;
					frameIntervals.push(clipped);
					continue;
				}
				const matcher = matchWindowPhase(span.name);
				if (!matcher) continue;
				buckets.get(matcher.phase)!.occurrences += 1;
				const phaseIntervals = perWindow.get(matcher.phase) ?? [];
				phaseIntervals.push(clipped);
				perWindow.set(matcher.phase, phaseIntervals);
				if (matcher.phase !== 'script') continue;
				const functionName = span.functionName ?? '(anonymous)';
				const script = shortScript(span.url ?? '');
				const lineNumber = span.lineNumber ?? null;
				const columnNumber = span.columnNumber ?? null;
				// The definition site is part of a function's identity here: a bare name is
				// not enough to act on, and two functions can share one.
				const functionKey = `${functionName}|${script}|${lineNumber ?? '-'}|${columnNumber ?? '-'}`;
				const bucket =
					functions.get(functionKey) ??
					(functions.set(functionKey, {
						functionName,
						script,
						lineNumber,
						columnNumber,
						occurrences: 0,
						present: 0,
						values: [],
						total: 0
					}),
					functions.get(functionKey)!);
				bucket.occurrences += 1;
				const intervals = perFunction.get(functionKey) ?? [];
				intervals.push(clipped);
				perFunction.set(functionKey, intervals);
			}
			for (const [phase, intervals] of perWindow) {
				const bucket = buckets.get(phase)!;
				bucket.present += 1;
				bucket.values.push(unionMs(intervals));
			}
			for (const [functionKey, intervals] of perFunction) {
				const bucket = functions.get(functionKey)!;
				const occupied = unionMs(intervals);
				bucket.present += 1;
				bucket.values.push(occupied);
				bucket.total += occupied;
			}
			const occupied = unionMs(frameIntervals);
			frameOccupiedMs.push(occupied);
			outsideFramesMs.push(Math.max(0, duration - occupied));
			framesPerWindow.push(frames);
		}
		out[key] = {
			definition: P23B_M1_WINDOW_PHASE_DEFINITION,
			windows: windows.length,
			windowMs: summarizeIntervals(windowMs),
			frameOccupiedMs: summarizeIntervals(frameOccupiedMs),
			outsideFramesMs: summarizeIntervals(outsideFramesMs),
			framesPerWindow: summarizeIntervals(framesPerWindow),
			phases: P23B_M1_WINDOW_PHASES.map((matcher) => {
				const bucket = buckets.get(matcher.phase)!;
				return {
					phase: matcher.phase,
					occurrences: bucket.occurrences,
					windowsPresent: bucket.present,
					windowsPresentShare: windows.length > 0 ? bucket.present / windows.length : 0,
					occupiedMs: summarizeIntervals(bucket.values)
				};
			}),
			scriptFunctions: [...functions.values()]
				.sort((a, b) => b.total - a.total)
				.slice(0, P23B_M1_WINDOW_FUNCTION_LIMIT)
				.map((bucket) => ({
					functionName: bucket.functionName,
					script: bucket.script,
					lineNumber: bucket.lineNumber,
					columnNumber: bucket.columnNumber,
					occurrences: bucket.occurrences,
					windowsPresent: bucket.present,
					windowsPresentShare: windows.length > 0 ? bucket.present / windows.length : 0,
					occupiedMs: summarizeIntervals(bucket.values),
					totalOccupiedMs: Math.round(bucket.total * 1000) / 1000
				}))
		};
	}
	return out;
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

/**
 * Append one drag's gesture series, keyed to the class it was measured in AND to
 * the action it resolved to.
 *
 * `action` is that identity. It is recorded because the row that reports the
 * series is taken over the class's measured actions: without it, the merge could
 * only pool every bracket the class happened to make — warm-up drags and retried
 * attempts included — which is exactly the averaging the protocol forbids.
 */
export function p23bM1RecordGestureFrames(
	fixtureId: string,
	actionClass: string,
	path: string,
	series: P23BM1GestureFrameSeries,
	action: { index: number; outcome: BenchInteractionOutcome | null } | null
): void {
	registry = {
		...registry,
		gestureFrames: [
			...registry.gestureFrames,
			{
				key: `${fixtureId}/${actionClass}/${path}`,
				fixtureId,
				actionClass,
				path,
				actionIndex: action?.index ?? null,
				outcome: action?.outcome ?? null,
				series
			}
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
