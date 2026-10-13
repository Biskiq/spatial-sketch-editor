/**
 * P23B.5 M-3 — live gesture sampling-reuse readout (DEV only).
 *
 * The bounded gesture-scoped sample store already reports its own counters, but
 * nothing read them outside a test: reuse could only be inspected by re-running
 * the suite. This module is the read path. During a real drag the viewport
 * publishes the store's counters here once per pointermove, and this module
 * turns them into one running report per gesture:
 *
 *   requests = derivations + hits,  derivations = coldMisses + refusals
 *
 * WHY THIS IS NOT PRODUCTION TELEMETRY. Every entry point is inert unless
 * `p23bInteractionPerfEnabled()` (the DEV build plus the existing `__P2311_PERF__`
 * measurement switch) is true, so a production build does nothing beyond one
 * early return. Nothing here is persisted, sent anywhere, or read by product
 * code: the reports live in this module and on a DEV global for the DEV harness
 * page, exactly like `__P23B_PLAN_VIEW__` and `__P23B_LAST_ACTION__`.
 *
 * WHY IT IS NOT PART OF THE CAPTURE LEDGER. The capture ledger and its recorded
 * baseline are the ratified P23B.0 measurement contract; a counter of interest to
 * one slice does not belong in it. Keeping the readout separate also lets it be
 * watched WITHOUT opening a capture session, which is the point of a live view.
 *
 * GESTURE BOUNDARIES. `p23bOpenGestureSampling` is called where the viewport
 * resets the store and `p23bCloseGestureSampling` where it releases it. Two
 * properties keep the readout honest when a call site is missed:
 *
 * - the store's request total only ever grows inside one gesture, so a DROP means
 *   the store was reset between two reports: the open report is closed as
 *   `reset-detected` and a new one starts, rather than two gestures being
 *   averaged into one;
 * - a report recorded with no open gesture opens one, so a missed `open` loses a
 *   boundary label but never silently discards a gesture's reuse.
 *
 * The wiring itself is pinned by the viewport's call-site source contract, not by
 * these fallbacks.
 */
import type { BenchInteractionPath } from '$lib/bench/bench-types';

import { p23bActiveInteraction, p23bInteractionPerfEnabled } from './p23b-interaction-measure';

/**
 * The sample-store counters this readout consumes. Structural, so the probe never
 * depends on the store's module: any derivation that reports these fields can be
 * watched.
 */
export type P23BGestureSamplingCounters = {
	/** Requests served fresh (key absent). */
	derivations: number;
	/** Requests served from an existing entry. */
	hits: number;
	/** Derivations for a Wall this store had not served before. */
	coldMisses: number;
	/** Derivations for a Wall whose traced input changed since it was served. */
	refusals: number;
	/** Fresh derivations whose result was `undefined`. */
	failedDerivations: number;
	/** Hits whose cached artefact is `undefined`. */
	cachedUndefined: number;
	/** Distinct keys retained. */
	entries: number;
};

/** Why an open gesture report stopped being open. */
export type P23BGestureSamplingRelease =
	/** The owner released the store at gesture finish or cancel. */
	| 'released'
	/** A later report arrived with a smaller request total: the store was reset. */
	| 'reset-detected'
	/** The DEV switch went off while the gesture was still open (no claim it ended). */
	| 'watch-stopped';

/** One gesture's sampling reuse, live while it is open and fixed once released. */
export type P23BGestureSamplingReport = P23BGestureSamplingCounters & {
	/** 1-based index of the gesture, in the order this module first saw it. */
	gesture: number;
	/** The interaction the viewport was measuring (from the DEV ambient record). */
	path: BenchInteractionPath | null;
	/** The interaction action (ledger id) that was active, when one was. */
	actionId: number | null;
	/** Reports folded into this gesture — one per recorded pointermove. */
	reports: number;
	/** `derivations + hits`. */
	requests: number;
	/** `hits / requests`, and 0 for a gesture that made no request. */
	reuseRatio: number;
	startedAt: number;
	releasedAt: number | null;
	release: P23BGestureSamplingRelease | null;
	phase: 'dragging' | 'released';
};

/** What a subscriber sees: the open gesture, and the released ones behind it. */
export type P23BGestureSamplingState = {
	live: P23BGestureSamplingReport | null;
	history: readonly P23BGestureSamplingReport[];
};

export type P23BGestureSamplingListener = (state: P23BGestureSamplingState) => void;

/** Released gestures kept for the harness page; the oldest is dropped first. */
const HISTORY_LIMIT = 24;

let liveReport: P23BGestureSamplingReport | null = null;
let releasedReports: P23BGestureSamplingReport[] = [];
let gestureIndex = 0;
/**
 * The open report's request total. The store never forgets an entry within one
 * gesture, so this can only fall when the store was reset underneath us.
 */
let openRequests = 0;
const listeners = new Set<P23BGestureSamplingListener>();

/** True while the DEV build is in its measurement mode (the live readout's gate). */
export function p23bGestureSamplingEnabled(): boolean {
	return p23bInteractionPerfEnabled();
}

/** A fixed copy of one report, so a reader can never mutate the readout. */
function copyReport(report: P23BGestureSamplingReport): P23BGestureSamplingReport {
	return { ...report };
}

/** The current readout: the open gesture and the released ones behind it. */
export function p23bGestureSamplingState(): P23BGestureSamplingState {
	return { live: liveReport ? copyReport(liveReport) : null, history: releasedReports.map(copyReport) };
}

/** The open gesture's report, or `null` when no gesture is being watched. */
export function p23bGestureSamplingLive(): P23BGestureSamplingReport | null {
	return liveReport ? copyReport(liveReport) : null;
}

/** Released gestures, oldest first. */
export function p23bGestureSamplingHistory(): readonly P23BGestureSamplingReport[] {
	return releasedReports.map(copyReport);
}

/**
 * Watch the readout. The listener is called with a fixed copy on every change;
 * the returned function stops it. Used by the DEV harness page.
 */
export function p23bSubscribeGestureSampling(listener: P23BGestureSamplingListener): () => void {
	listeners.add(listener);
	return () => {
		listeners.delete(listener);
	};
}

/** Drop every report (the harness page's reset button and test hygiene). */
export function p23bResetGestureSampling(): void {
	liveReport = null;
	releasedReports = [];
	openRequests = 0;
	gestureIndex = 0;
	publish();
}

/**
 * Start watching one gesture. The viewport calls this where it resets the store.
 * An already-open report means a boundary was missed, so it is released as
 * `reset-detected` rather than merged into the new gesture.
 */
export function p23bOpenGestureSampling(startedAt = performance.now()): void {
	if (!p23bGestureSamplingEnabled()) return;
	release('reset-detected');
	gestureIndex += 1;
	liveReport = {
		gesture: gestureIndex,
		path: null,
		actionId: null,
		reports: 0,
		derivations: 0,
		hits: 0,
		coldMisses: 0,
		refusals: 0,
		failedDerivations: 0,
		cachedUndefined: 0,
		entries: 0,
		requests: 0,
		reuseRatio: 0,
		startedAt,
		releasedAt: null,
		release: null,
		phase: 'dragging'
	};
	openRequests = 0;
	publish();
}

/**
 * Fold one store snapshot into the open gesture — one call per pointermove.
 *
 * The counters are read as the store's running totals for the gesture (the store
 * is reset at gesture start), never as deltas to add: a total is what the store
 * actually holds, so a missed report costs one data point rather than corrupting
 * every later figure.
 */
export function p23bRecordGestureSampling(
	counters: P23BGestureSamplingCounters,
	at = performance.now()
): void {
	if (!p23bGestureSamplingEnabled()) return;
	const requests = counters.derivations + counters.hits;
	if (liveReport && requests < openRequests) {
		// The store was reset between two reports without a reported gesture
		// boundary: close what we have and start the next gesture here.
		release('reset-detected', at);
	}
	if (!liveReport) {
		gestureIndex += 1;
		liveReport = {
			gesture: gestureIndex,
			path: null,
			actionId: null,
			reports: 0,
			derivations: 0,
			hits: 0,
			coldMisses: 0,
			refusals: 0,
			failedDerivations: 0,
			cachedUndefined: 0,
			entries: 0,
			requests: 0,
			reuseRatio: 0,
			startedAt: at,
			releasedAt: null,
			release: null,
			phase: 'dragging'
		};
		openRequests = 0;
	}
	const active = p23bActiveInteraction();
	liveReport = {
		...liveReport,
		// The ambient DEV record names the interaction the viewport is measuring,
		// so the readout can attribute reuse to a path without a second call-site
		// parameter that product code would have to carry.
		path: active?.path ?? liveReport.path,
		actionId: active?.actionId ?? liveReport.actionId,
		reports: liveReport.reports + 1,
		derivations: counters.derivations,
		hits: counters.hits,
		coldMisses: counters.coldMisses,
		refusals: counters.refusals,
		failedDerivations: counters.failedDerivations,
		cachedUndefined: counters.cachedUndefined,
		entries: counters.entries,
		requests,
		reuseRatio: requests > 0 ? counters.hits / requests : 0
	};
	openRequests = requests;
	publish();
}

/**
 * Stop watching the gesture: the viewport calls this where it releases the store
 * (gesture finish, cancel, or the snapshot-clearing bypass). Closing works even
 * with the measurement switch off, so a gesture opened while it was on can never
 * stay `dragging` forever.
 */
export function p23bCloseGestureSampling(at = performance.now()): void {
	release('released', at);
}

/**
 * Stop watching without claiming the gesture ended: the DEV switch was turned
 * off mid-drag. The store the operator was watching is still in use; only the
 * readout stops, so the report is not labelled as a release.
 */
export function p23bStopGestureSampling(at = performance.now()): void {
	release('watch-stopped', at);
}

function release(reason: P23BGestureSamplingRelease, at = performance.now()): void {
	const report = liveReport;
	if (!report) return;
	liveReport = null;
	openRequests = 0;
	const released: P23BGestureSamplingReport = {
		...report,
		releasedAt: at,
		release: reason,
		phase: 'released'
	};
	releasedReports = [...releasedReports, released].slice(-HISTORY_LIMIT);
	publish();
}

function publish(): void {
	const state = p23bGestureSamplingState();
	if (import.meta.env.DEV) {
		(globalThis as typeof globalThis & { __P23B_GESTURE_SAMPLING__?: unknown }).__P23B_GESTURE_SAMPLING__ =
			state;
	}
	for (const listener of [...listeners]) {
		try {
			listener(state);
		} catch {
			// A DEV listener must never break the sampler that feeds it.
		}
	}
}
