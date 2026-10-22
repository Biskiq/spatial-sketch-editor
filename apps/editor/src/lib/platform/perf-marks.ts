/**
 * Runtime-gated performance marks (T3.P03.S02).
 *
 * The on-demand Playwright/CDP harness measures complete presented results, not
 * isolated kernel time. To correlate a continuous input with the frame that
 * presents its result, the product carries a monotonic sequence from the input
 * that started the work through preview installation and result installation.
 * The harness reads those records and pairs each one with the first presented
 * frame at or after it.
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
	__BISKIQ_PERF__?: { readonly enabled?: unknown };
	__BISKIQ_PERF_RECORDS__?: PerfRecord[];
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
	detail?: Readonly<Record<string, unknown>>
): PerfRecord | null {
	if (!perfMarksEnabled()) return null;
	const entry: PerfRecord = {
		kind,
		name,
		time: performance.now(),
		sequence: latestSequence,
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
 * Installation is not presentation: the harness pairs this timestamp with the
 * next presented frame, which is what the latency budgets describe.
 */
export function perfInstall(name: string, detail?: Readonly<Record<string, unknown>>): void {
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
