/**
 * Harness run configuration (T3.P03.S02).
 *
 * Defaults follow the performance contract: one discarded warm-up, at least ten
 * measured runs per flow × workload × cache state, and at least 60 input samples
 * per continuous run. Environment overrides exist for iteration and for a
 * deliberately reduced pre-flight pass; a reduced pass is never reported as
 * acceptance evidence.
 *
 * `PERF_PROFILE=diagnostic` selects the owner-approved Bench 2 pre-pass. It
 * keeps the real interactions, 60 pointer inputs and the full E5 matrix but
 * reduces the within-run observations and marks every row non-acceptance.
 * Leaving the variable unset (or `acceptance`) keeps every formal default.
 */

import type { NetworkProfile } from './browser';
import { ACCEPTANCE_PLAN, basePlan, parseProfile, type CacheStateName, type FlowName } from './profile';

function positiveInteger(value: string | undefined, fallback: number): number {
	const parsed = Number(value);
	return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

export const PROFILE = parseProfile(process.env.PERF_PROFILE);
export const DIAGNOSTIC = PROFILE === 'diagnostic';
const PLAN = basePlan(PROFILE);

export const RUNS = DIAGNOSTIC ? PLAN.runs : positiveInteger(process.env.PERF_RUNS, PLAN.runs);
export const WARMUP_RUNS = DIAGNOSTIC ? PLAN.warmup : positiveInteger(process.env.PERF_WARMUP, PLAN.warmup);
export const INPUT_SAMPLES = DIAGNOSTIC ? PLAN.inputSamples : positiveInteger(process.env.PERF_SAMPLES, PLAN.inputSamples);
export const DRAG_SAMPLES = DIAGNOSTIC ? PLAN.dragSamples : positiveInteger(process.env.PERF_DRAG_SAMPLES, PLAN.dragSamples);
export const UNDO_REDO_CYCLES = DIAGNOSTIC ? PLAN.undoRedoCycles : positiveInteger(process.env.PERF_UNDO_CYCLES, PLAN.undoRedoCycles);
export const F13_EDITS = DIAGNOSTIC ? PLAN.f13Edits : positiveInteger(process.env.PERF_F13_EDITS, PLAN.f13Edits);
export const F13_CYCLES: Readonly<Record<CacheStateName, number>> = DIAGNOSTIC
	? PLAN.f13Cycles
	: {
			cold: positiveInteger(process.env.PERF_F13_CYCLES, PLAN.f13Cycles.cold),
			warm: 1,
			'repeat-use': positiveInteger(process.env.PERF_F13_CYCLES, PLAN.f13Cycles['repeat-use'])
		};
export const NETWORK = (process.env.PERF_NETWORK ?? 'N1') as NetworkProfile;

/** A-equivalence viewport: 1920×1080 CSS at DPR 1. */
export const VIEWPORT = { width: 1920, height: 1080 } as const;
export const DEVICE_SCALE_FACTOR = 1;

export const REDUCED_PASS =
	RUNS < ACCEPTANCE_PLAN.runs ||
	WARMUP_RUNS < ACCEPTANCE_PLAN.warmup ||
	INPUT_SAMPLES < ACCEPTANCE_PLAN.inputSamples ||
	DRAG_SAMPLES < ACCEPTANCE_PLAN.dragSamples ||
	UNDO_REDO_CYCLES < ACCEPTANCE_PLAN.undoRedoCycles ||
	F13_EDITS < ACCEPTANCE_PLAN.f13Edits ||
	F13_CYCLES.cold < ACCEPTANCE_PLAN.f13Cycles.cold ||
	F13_CYCLES['repeat-use'] < ACCEPTANCE_PLAN.f13Cycles['repeat-use'];

/** The flow's cache states in bench order; diagnostic omits the expensive repeats. */
export function cacheStatesFor(flow: FlowName): readonly CacheStateName[] {
	return PLAN.cacheStates[flow			];
}


/** Measured runs for one flow; a per-cache-state map lets the diagnostic use checks. */
export function runsFor(flow: FlowName, cacheState?: CacheStateName): number {
	if (!DIAGNOSTIC) return RUNS;
	const count = PLAN.runCounts[flow];
	if (typeof count === 'number') return count;
	return cacheState === undefined ? PLAN.runs : count[cacheState			];
}


export function f13CyclesFor(cacheState: CacheStateName): number {
	return F13_CYCLES[cacheState			];
}


export function passLimitations(): string[] {
	if (DIAGNOSTIC) {
		return [
			'diagnostic profile: NOT acceptance evidence; decisions use medians/maxima, not p95 gates',
			`actual plan: ${RUNS} measured runs per row; F3 cold/repeat-use ${runsFor('f3', 'cold')} and warm ${runsFor('f3', 'warm')}; ${DRAG_SAMPLES} drag + ${DRAG_SAMPLES} precision samples per run; ${UNDO_REDO_CYCLES} Undo/Redo cycles per run; F13 ${F13_EDITS} edits per measured cycle at cold ${F13_CYCLES.cold}, warm ${F13_CYCLES.warm}, repeat-use ${F13_CYCLES['repeat-use']} cycles; F7 ${runsFor('f7')} warm run; traces ${PLAN.stageTraceTiers}`,
			'not run: F2 repeat-use, F7 cold/repeat-use, A.6 old-method rows and the delayed-preview proof; Bench 1 evidence stands for the method proofs',
			'incomplete gates: no formal p95, run-to-run spread, cold/repeat-use interaction distributions or hard-row verdicts; diagnostic medians/maxima guide the next step only',
			'hard budgets require the designated reference machine and the owner as operator',
			...(process.env.PERF_SMOKE === '1' ? ['smoke, not evidence'] : [])
		];
	}
	return REDUCED_PASS
		? [
				`reduced pre-flight pass (runs=${RUNS}, inputs=${INPUT_SAMPLES}, dragSamples=${DRAG_SAMPLES}, undoCycles=${UNDO_REDO_CYCLES}) — not acceptance evidence`,
				'hard budgets require the designated reference machine and the owner as operator'
			]
		: [
				'pre-flight on a developer machine: hard budgets are accepted only from the reference machine',
				'presentation is attributed to the rendering-opportunity frame, not a traced image'
						];
}
