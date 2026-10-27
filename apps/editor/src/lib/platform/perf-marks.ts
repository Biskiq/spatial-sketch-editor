/**
 * Runtime-gated performance marks (T3.P03.S02).
 *
 * The product carries a monotonic sequence from continuous input through
 * preview installation and result installation. The ordinary timing harness
 * pairs overlay marks with rAF scheduling opportunities: that is an estimate,
 * not proof of presentation. A separate traceProof diagnostic matches captured
 * image identity and reports screenshot-event latency for supported trace clocks,
 * plus trace-reported presentation when exact compositor span evidence exists.
 * Physical display presentation remains unproved by either path.
 *
 * **Inert unless the harness enables it.** Playwright sets
 * `window.__BISKIQ_PERF__ = { enabled: true }` through an init script before any
 * application module evaluates. Without that flag every export here returns
 * immediately: no mark, no record, no allocation. The measured build is
 * therefore the ordinary production build, not a special instrumented bundle
 * (T3.P03.S02 plan; the performance contract's correlation rule).
 *
 * Records live on `globalThis.__BISKIQ_PERF_RECORDS__` rather than only in the
 * browser's user-timing buffer, which is small and drops entries once a drag
 * emits more than a couple of hundred marks. `performance.mark` is still
 * emitted so a trace carries the same names.
 *
 * This module must stay dependency-free and framework-free (no Svelte, host or
 * renderer import): the route, the authoring adapters and the Save controller
 * all call it.
 */

export type PerfRecordKind = 'input' | 'install' | 'result' | 'mark';

/** One correlation record, as the harness reads it. */
export type PerfRecord = {
	readonly kind: PerfRecordKind;
	readonly name: string;
	/** `performance.now()` of the call. */
	readonly time: number;
	/** The latest input sequence at the call (0 before any input). */
	readonly sequence: number;
	readonly detail?: Readonly<Record<string, unknown>>;
};

type PerfGlobal = typeof globalThis & {
	__BISKIQ_PERF__?: { readonly enabled?: unknown; readonly traceProof?: unknown };
	__BISKIQ_PERF_RECORDS__?: PerfRecord[];
	/** Installed by the harness's init script; receives each surface's renderer. */
	__BISKIQ_PERF_ON_RENDERER__?: (renderer: object, surface: string) => void;
};

/**
 * Bounded so a long repeat-use cycle cannot grow the page's heap without limit.
 * The harness reads the ledger after every measured run, so the bound is far
 * above one run's record count.
 */
export const PERF_RECORD_LIMIT = 4096;

let nextSequence = 0;
let latestSequence = 0;

function perfGlobal(): PerfGlobal {
	return globalThis as PerfGlobal;
}

/** Whether the measurement harness enabled the marks for this page. */
export function perfMarksEnabled(): boolean {
	return perfGlobal().__BISKIQ_PERF__?.enabled === true;
}

function record(
	kind: PerfRecordKind,
	name: string,
	detail?: Readonly<Record<string, unknown>>,
	sequence = latestSequence
): PerfRecord | null {
	if (!perfMarksEnabled()) return null;
	const entry: PerfRecord = {
		kind,
		name,
		time: performance.now(),
		sequence,
		...(detail === undefined ? {} : { detail })
	};
	const target = perfGlobal();
	const records = (target.__BISKIQ_PERF_RECORDS__ ??= []);
	records.push(entry);
	if (records.length > PERF_RECORD_LIMIT) records.splice(0, records.length - PERF_RECORD_LIMIT);
	try {
		performance.mark(`biskiq:${kind}:${name}`, {
			detail: { sequence: entry.sequence, ...detail }
		});
	} catch {
		// User timing is a convenience copy of the ledger, never its authority.
	}
	return entry;
}

/**
 * Record one continuous input and return its monotonic sequence.
 *
 * The Stage's pointer move handler calls this before it hands the sample to the
 * adapter, so the adapter's preview installation inherits this sequence.
 */
export function perfInput(name: string, detail?: Readonly<Record<string, unknown>>): number {
	if (!perfMarksEnabled()) return latestSequence;
	nextSequence += 1;
	latestSequence = nextSequence;
	record('input', name, detail);
	return latestSequence;
}

/** The latest input sequence (0 when no input was recorded). */
export function perfSequence(): number {
	return latestSequence;
}

/**
 * Record that a preview for the latest input was installed.
 *
 * Installation is not presentation. The baseline uses the later overlay mark
 * with an rAF scheduling proxy. The separate trace diagnostic requires a matching
 * preview image and supported screenshot-event clock; neither proves physical scanout.
 */
export function perfInstall(name: string, detail?: Readonly<Record<string, unknown>>): void {
	// Check before building the sequence-carrying detail object: spreading the
	// caller's detail allocates (and evaluates its getters) even when `record`
	// would immediately discard the result, which would make the helper observable
	// in the ordinary build.
	if (!perfMarksEnabled()) return;
	record('install', name, { sequence: latestSequence, ...detail });
}

/** Record that an accepted/final result was installed (not yet presented). */
export function perfResult(name: string, detail?: Readonly<Record<string, unknown>>): void {
	record('result', name, detail);
}

/** Record a general milestone (command start, admission, refusal, release). */
export function perfMark(name: string, detail?: Readonly<Record<string, unknown>>): void {
	record('mark', name, detail);
}

/**
 * Hand one surface's renderer to the harness and return it unchanged.
 *
 * The harness reads `renderer.info` and counts shadow passes itself (T1.P02.S06
 * render counters); this helper only passes the object over. Without the
 * harness flag, or without the harness's hook, it does nothing.
 */
export function perfRenderer<T extends object>(renderer: T, surface: 'stage' | 'preview'): T {
	if (!perfMarksEnabled()) return renderer;
	perfGlobal().__BISKIQ_PERF_ON_RENDERER__?.(renderer, surface);
	return renderer;
}

/**
 * Time one synchronous operation on the page's main thread. Save uses this
 * only around named work it directly invokes; the enclosing async operation
 * and unrelated renderer frames are deliberately not included.
 */
export function perfMeasureSync<T>(phase: string, work: () => T): T {
	if (!perfMarksEnabled()) return work();
	const start = performance.now();
	try {
		return work();
	} finally {
		const end = performance.now();
		perfMark('save:work', { phase, startMs: start, endMs: end, elapsedMs: end - start });
	}
}

/** Measure a Save-owned async step's elapsed time, separately from main-thread work. */
export async function perfMeasureAsync<T>(phase: string, work: () => Promise<T>): Promise<T> {
	if (!perfMarksEnabled()) return work();
	const start = performance.now();
	try {
		return await work();
	} finally {
		const end = performance.now();
		perfMark('save:async-wall', { phase, startMs: start, endMs: end, elapsedMs: end - start });
	}
}

/** Diagnostic only: never enabled in untraced timing runs or ordinary UI. */
export type PerfTracePreview = {
	readonly sequence: number;
	readonly signature: number;
	readonly bits: readonly number[];
	readonly css: readonly [number, number];
};

export function perfTracePreview(
	markers: readonly { id: string; css: readonly [number, number]; label: string }[]
): PerfTracePreview | null {
	if (!perfMarksEnabled() || perfGlobal().__BISKIQ_PERF__?.traceProof !== true) return null;
	// Svelte may proxy $state arrays: user-timing detail must be structured-cloneable.
	const serialized = JSON.stringify(markers);
	const snapshot = JSON.parse(serialized) as typeof markers;
	const preview = snapshot.find((marker) => marker.id === 'layout-wall-preview');
	if (!preview) return null;
	const install = perfGlobal().__BISKIQ_PERF_RECORDS__?.findLast(
		(entry) => entry.kind === 'install' && entry.name === 'wall-preview'
	);
	if (!install || install.sequence < 1 || install.sequence > 65535) return null;
	// Hash the actual overlay snapshot, not a separately scheduled token. The
	// full geometry remains in the ledger; the image also checks the marker pixel.
	let signature = 0;
	for (const character of serialized) signature = (signature * 31 + character.charCodeAt(0)) & 65535;
	const words = [0xb17e, install.sequence, signature, 0xb17e ^ install.sequence ^ signature];
	const bits = words.flatMap((word) => Array.from({ length: 16 }, (_, index) => (word >>> (15 - index)) & 1));
	const result = { sequence: install.sequence, signature, bits, css: preview.css };
	record('mark', `trace:overlay:${install.sequence}:${signature}`, { ...result, markers: snapshot }, install.sequence);
	return result;
}
