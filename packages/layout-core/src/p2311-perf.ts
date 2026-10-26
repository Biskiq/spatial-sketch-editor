/**
 * Opt-in work observation.
 *
 * Two inert-by-default consumers share these call sites:
 *
 * - the P23.11 diagnostic marks, which the editor enables only in dev builds
 *   through `__P2311_PERF__`;
 * - a {@link WorkObserver} (T1.P02.S06), installed only by a measurement
 *   harness or a deterministic census. It receives every measured span's
 *   duration and every named work count, so per-stage time and count oracles
 *   read the same boundaries. It works in production builds, because the
 *   owner-run benches measure the production build.
 *
 * With no observer and no dev flag, `p2311Measure` is one null check plus the
 * work itself and `countWork` is one null check. An observer never changes a
 * result: it only receives names and numbers.
 */

/** Receives measured spans and deterministic work counts. */
export type WorkObserver = {
	/** One completed span; nested spans each report their own inclusive time. */
	span(name: string, durationMs: number): void;
	/** A deterministic amount in the name's stated unit. Each counter covers its
	 * instrumented sites only: calls do not measure their payload, accepted index
	 * nodes exclude rejected tests, and entity evaluations exclude storage/output.
	 * Node/slot counts are logical work, never a JavaScript engine byte estimate. */
	count(name: string, amount: number): void;
};

let observer: WorkObserver | null = null;
let sequence = 0;

/** Install (or with `null`, remove) the one observer; returns the previous one. */
export function setWorkObserver(next: WorkObserver | null): WorkObserver | null {
	const previous = observer;
	observer = next;
	return previous;
}

/** Count named work for the installed observer; inert without one. */
export function countWork(name: string, amount = 1): void {
	if (observer !== null) observer.count(name, amount);
}

export function p2311Measure<T>(name: string, work: () => T): T {
	const active = observer;
	if (active !== null) {
		const begin = performance.now();
		try {
			return work();
		} finally {
			active.span(name, performance.now() - begin);
		}
	}
	const viteDev = (import.meta as ImportMeta & { env?: { DEV?: boolean } }).env?.DEV;
	if (viteDev === false || !(globalThis as { __P2311_PERF__?: boolean }).__P2311_PERF__) return work();
	const start = `p2311:${name}:start:${sequence++}`;
	const end = `${start}:end`;
	performance.mark(start);
	try {
		return work();
	} finally {
		performance.mark(end);
		performance.measure(`p2311:${name}`, start, end);
		performance.clearMarks(start);
		performance.clearMarks(end);
	}
}

/**
 * The asynchronous form, for the observer only (the admission digest awaits Web
 * Crypto). The span is wall time from start to settlement, so it includes any
 * task that ran while the work was suspended.
 */
export async function measureWorkAsync<T>(name: string, work: () => Promise<T>): Promise<T> {
	const active = observer;
	if (active === null) return work();
	const begin = performance.now();
	try {
		return await work();
	} finally {
		active.span(name, performance.now() - begin);
	}
}
