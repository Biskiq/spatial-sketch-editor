/**
 * Harness-gated work ledger (T1.P02.S06).
 *
 * `@portfolio/layout-core` exposes one inert work observer: measured spans
 * (compile, validation passes, Scene resolve, admission, mesh build) and
 * deterministic work counts (compiles, entity sets, pair visits, digests,
 * serializations, F4 clones). When the measurement harness enabled the perf
 * marks, this module installs that observer once and aggregates into
 * `globalThis.__BISKIQ_PERF_WORK__`, which the harness diffs around each
 * measured window. Aggregation keeps the ledger bounded however long a run is.
 *
 * Without the harness flag `installPerfWorkObserver` returns immediately and no
 * observer exists, so the ordinary build does no counting.
 */
import { setWorkObserver } from '@portfolio/layout-core';

import { perfMarksEnabled } from './perf-marks';

export type PerfWorkSpan = { count: number; totalMs: number; maxMs: number };
export type PerfWorkLedger = {
	readonly spans: Record<string, PerfWorkSpan>;
	readonly counts: Record<string, number>;
};

type WorkGlobal = typeof globalThis & { __BISKIQ_PERF_WORK__?: PerfWorkLedger };

export function installPerfWorkObserver(): void {
	if (!perfMarksEnabled()) return;
	const target = globalThis as WorkGlobal;
	if (target.__BISKIQ_PERF_WORK__ !== undefined) return;
	const ledger: PerfWorkLedger = { spans: Object.create(null), counts: Object.create(null) };
	target.__BISKIQ_PERF_WORK__ = ledger;
	setWorkObserver({
		span(name, durationMs) {
			const span = (ledger.spans[name] ??= { count: 0, totalMs: 0, maxMs: 0 });
			span.count += 1;
			span.totalMs += durationMs;
			if (durationMs > span.maxMs) span.maxMs = durationMs;
		},
		count(name, amount) {
			ledger.counts[name] = (ledger.counts[name] ?? 0) + amount;
		}
	});
}
