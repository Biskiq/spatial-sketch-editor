import { tick } from 'svelte';
import type { BenchInteractionBoundary, BenchInteractionPath } from '$lib/bench/bench-types';
import { p2311Measure } from '$lib/layout/layout-wall-first-precision';

type P23BPerfGlobals = typeof globalThis & {
	__P2311_PERF__?: boolean;
	__P23B_ACTIVE_INTERACTION__?: { path: BenchInteractionPath; run: number };
};

let sequence = 0;

/** P23B marks share the existing DEV + `__P2311_PERF__` switch. */
export function p23bInteractionPerfEnabled(): boolean {
	return import.meta.env.DEV && Boolean((globalThis as P23BPerfGlobals).__P2311_PERF__);
}

/** Measure one synchronous boundary without changing its result or control flow. */
export function p23bMeasureInteraction<T>(
	path: BenchInteractionPath,
	boundary: BenchInteractionBoundary,
	work: () => T
): T {
	if (!p23bInteractionPerfEnabled()) return work();
	return p2311Measure(`p23b:${path}:${boundary}`, work);
}

/** Mark the active synchronous interaction so its scheduled Svelte effects can be attributed. */
export function p23bActivateInteraction(path: BenchInteractionPath): void {
	if (p23bInteractionPerfEnabled()) {
		(globalThis as P23BPerfGlobals).__P23B_ACTIVE_INTERACTION__ = { path, run: ++sequence };
	}
}

/**
 * Mark the Svelte flush and next browser frame after a synchronous input. The
 * frame is only a requestAnimationFrame boundary: it does not assert GPU upload
 * or presentation.
 */
export function p23bAfterInteraction(path: BenchInteractionPath): void {
	if (!p23bInteractionPerfEnabled()) return;
	const globals = globalThis as P23BPerfGlobals;
	const run = ++sequence;
	const startTime = performance.now();
	globals.__P23B_ACTIVE_INTERACTION__ = { path, run };
	void tick().then(() => recordAsyncBoundary(path, 'svelte-flush', startTime, run));
	requestAnimationFrame(() => {
		recordAsyncBoundary(path, 'browser-frame', startTime, run);
		if (globals.__P23B_ACTIVE_INTERACTION__?.run === run) delete globals.__P23B_ACTIVE_INTERACTION__;
	});
}

/** Attribute a Svelte/Three adapter effect to the input that scheduled it. */
export function p23bMeasureActiveAdapter<T>(work: () => T): T {
	if (!p23bInteractionPerfEnabled()) return work();
	const path = (globalThis as P23BPerfGlobals).__P23B_ACTIVE_INTERACTION__?.path;
	return path ? p23bMeasureInteraction(path, 'adapter', work) : work();
}

/** Attribute a preview derive/install effect to the input that scheduled it. */
export function p23bMeasureActiveReactive<T>(work: () => T): T {
	if (!p23bInteractionPerfEnabled()) return work();
	const path = (globalThis as P23BPerfGlobals).__P23B_ACTIVE_INTERACTION__?.path;
	return path ? p23bMeasureInteraction(path, 'reactive', work) : work();
}

function recordAsyncBoundary(
	path: BenchInteractionPath,
	boundary: 'svelte-flush' | 'browser-frame',
	startTime: number,
	run: number
): void {
	if (!p23bInteractionPerfEnabled()) return;
	const start = `p2311:p23b:${run}:${boundary}:start`;
	const end = `p2311:p23b:${run}:${boundary}:end`;
	performance.mark(start, { startTime });
	performance.mark(end);
	performance.measure(`p2311:p23b:${path}:${boundary}`, start, end);
	performance.clearMarks(start);
	performance.clearMarks(end);
}
