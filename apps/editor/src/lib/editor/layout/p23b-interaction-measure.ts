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
 * One press whose path is not yet known. A select-tool press on a Wall both
 * selects it and arms a possible move, so the press cannot say whether it is a
 * selection or the first half of a drag: its three boundaries are timed here and
 * named once {@link p23bResolvePress} is told what the interaction became. One
 * interaction therefore stays one path — the press of a drag is never also
 * counted as the selection it started from, and the press of a selection click
 * is never counted as a drag.
 */
export type P23BPress = {
	intent: BenchInteractionPath;
	path: BenchInteractionPath | null;
	pointerId: number;
	startTime: number;
	endTime: number | null;
	flushTime: number | null;
	frameTime: number | null;
	run: number;
	written: Set<BenchInteractionBoundary>;
};

/** The one press still waiting for its release to say which interaction it was. */
let awaitingPress: P23BPress | null = null;

/**
 * Open the press boundary of one interaction. Returns `null` while the marks are
 * disabled, which keeps the disabled path as cheap as the plain handler call.
 */
export function p23bOpenPress(intent: BenchInteractionPath, pointerId: number): P23BPress | null {
	if (!p23bInteractionPerfEnabled()) return null;
	const run = ++sequence;
	(globalThis as P23BPerfGlobals).__P23B_ACTIVE_INTERACTION__ = { path: intent, run };
	return {
		intent,
		path: null,
		pointerId,
		startTime: performance.now(),
		endTime: null,
		flushTime: null,
		frameTime: null,
		run,
		written: new Set()
	};
}

/**
 * Close the synchronous half of a press and schedule its deferred boundaries.
 * They are recorded under whatever path the press is resolved to, so the flush
 * and frame of a click follow the selection and the flush and frame of a drag
 * follow its gesture.
 */
export function p23bClosePress(press: P23BPress | null): void {
	if (!press) return;
	press.endTime = performance.now();
	writePressBoundaries(press);
	void tick().then(() => {
		press.flushTime = performance.now();
		writePressBoundaries(press);
	});
	requestAnimationFrame(() => {
		press.frameTime = performance.now();
		writePressBoundaries(press);
		if ((globalThis as P23BPerfGlobals).__P23B_ACTIVE_INTERACTION__?.run === press.run) {
			delete (globalThis as P23BPerfGlobals).__P23B_ACTIVE_INTERACTION__;
		}
	});
}

/** Hold a press open until its release reports the path it actually became. */
export function p23bDeferPress(press: P23BPress | null): void {
	if (press) awaitingPress = press;
}

/** Name a press whose outcome is known, and write the boundaries that are ready. */
export function p23bResolvePress(press: P23BPress | null, path: BenchInteractionPath): void {
	if (!press) return;
	if (awaitingPress === press) awaitingPress = null;
	if (press.path === null) press.path = path;
	writePressBoundaries(press);
}

/**
 * Resolve the press still awaiting its outcome. Only the pointer that opened it
 * may resolve it, so a second contact can never name someone else's press.
 */
export function p23bResolveAwaitingPress(pointerId: number, path: BenchInteractionPath): void {
	const press = awaitingPress;
	if (!press || press.pointerId !== pointerId) return;
	p23bResolvePress(press, path);
}

/**
 * Write whichever of a press's three boundaries are ready, each exactly once.
 * Nothing can be written before the path is known, so no boundary is ever
 * recorded under a path the interaction did not turn out to be.
 */
function writePressBoundaries(press: P23BPress): void {
	const path = press.path;
	if (path === null) return;
	writePressBoundary(press, path, 'input', press.endTime);
	writePressBoundary(press, path, 'svelte-flush', press.flushTime);
	writePressBoundary(press, path, 'browser-frame', press.frameTime);
}

function writePressBoundary(
	press: P23BPress,
	path: BenchInteractionPath,
	boundary: BenchInteractionBoundary,
	endTime: number | null
): void {
	if (endTime === null || press.written.has(boundary)) return;
	press.written.add(boundary);
	recordBoundary(path, boundary, press.startTime, ++sequence, endTime);
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
	recordBoundary(path, boundary, startTime, run);
}

function recordBoundary(
	path: BenchInteractionPath,
	boundary: BenchInteractionBoundary,
	startTime: number,
	run: number,
	endTime = performance.now()
): void {
	const start = `p2311:p23b:${run}:${boundary}:start`;
	const end = `p2311:p23b:${run}:${boundary}:end`;
	performance.mark(start, { startTime });
	performance.mark(end, { startTime: endTime });
	performance.measure(`p2311:p23b:${path}:${boundary}`, start, end);
	performance.clearMarks(start);
	performance.clearMarks(end);
}
