/**
 * Harness run configuration (T3.P03.S02).
 *
 * Defaults follow the performance contract: one discarded warm-up, at least ten
 * measured runs per flow × workload × cache state, and at least 60 input samples
 * per continuous run. Environment overrides exist for iteration and for a
 * deliberately reduced pre-flight pass; a reduced pass is never reported as
 * acceptance evidence.
 */

import type { NetworkProfile } from './browser';

function positiveInteger(value: string | undefined, fallback: number): number {
	const parsed = Number(value);
	return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

export const RUNS = positiveInteger(process.env.PERF_RUNS, 10);
export const WARMUP_RUNS = positiveInteger(process.env.PERF_WARMUP, 1);
export const INPUT_SAMPLES = positiveInteger(process.env.PERF_SAMPLES, 60);
export const NETWORK = (process.env.PERF_NETWORK ?? 'N1') as NetworkProfile;

/** A-equivalence viewport: 1920×1080 CSS at DPR 1. */
export const VIEWPORT = { width: 1920, height: 1080 } as const;
export const DEVICE_SCALE_FACTOR = 1;

export const REDUCED_PASS = RUNS < 10 || INPUT_SAMPLES < 60;

export function passLimitations(): string[] {
	return REDUCED_PASS
		? [
				`reduced pre-flight pass (runs=${RUNS}, samples=${INPUT_SAMPLES}) — not acceptance evidence`,
				'hard budgets require the designated reference machine and the owner as operator'
			]
		: [
				'pre-flight on a developer machine: hard budgets are accepted only from the reference machine',
				'presentation is attributed to the rendering-opportunity frame, not a traced image'
			];
}
