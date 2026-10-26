/**
 * Harness run configuration (T3.P03.S02).
 *
 * Defaults follow the performance contract: one discarded warm-up, at least ten
 * measured runs per flow × workload × cache state, and at least 60 input samples
 * per continuous run. Environment overrides exist for iteration and for a
 * deliberately reduced pre-flight pass; a reduced pass is never reported as
 * acceptance evidence.
 *
 * `PERF_PROFILE=diagnostic` selects the owner-approved Bench 2 pre-pass and
 * `PERF_PROFILE=milestone` the S06 decision-driven gate. Both keep the real
 * interactions, 60 pointer inputs and the full E5 matrix while reducing the
 * repetitions used to decide; their profiles are authoritative (no per-flow
 * environment overrides), and their rows are labelled for what they certify.
 * Leaving the variable unset (or `acceptance`) keeps every formal default.
 */

import type { NetworkProfile } from './browser';
import { basePlan, parseProfile, type CacheStateName, type FlowName } from './profile';
import { MILESTONE_MAX_RUNS } from './milestone';

function positiveInteger(value: string | undefined, fallback: number): number {
	const parsed = Number(value);
	return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

export const PROFILE = parseProfile(process.env.PERF_PROFILE);
export const DIAGNOSTIC = PROFILE === 'diagnostic';
export const MILESTONE = PROFILE === 'milestone';
/**
 * The lean methods (Bench 2's diagnostic pre-pass and the S06 milestone gate)
 * share Bench 2's representative interaction and cache-state coverage: no A.6
 * old-method rows, no delayed-preview proof, traces at grid-L only.
 */
export const LEAN = DIAGNOSTIC || MILESTONE;
/** A profile's own plan is authoritative; only the formal method takes env overrides. */
const PROFILE_AUTHORITATIVE = DIAGNOSTIC || MILESTONE;
const PLAN = basePlan(PROFILE);

export const RUNS = PROFILE_AUTHORITATIVE ? PLAN.runs : positiveInteger(process.env.PERF_RUNS, PLAN.runs);
export const WARMUP_RUNS = PROFILE_AUTHORITATIVE ? PLAN.warmup : positiveInteger(process.env.PERF_WARMUP, PLAN.warmup);
export const INPUT_SAMPLES = PROFILE_AUTHORITATIVE ? PLAN.inputSamples : positiveInteger(process.env.PERF_SAMPLES, PLAN.inputSamples);
export const DRAG_SAMPLES = PROFILE_AUTHORITATIVE ? PLAN.dragSamples : positiveInteger(process.env.PERF_DRAG_SAMPLES, PLAN.dragSamples);
export const UNDO_REDO_CYCLES = PROFILE_AUTHORITATIVE ? PLAN.undoRedoCycles : positiveInteger(process.env.PERF_UNDO_CYCLES, PLAN.undoRedoCycles);
export const F13_EDITS = PROFILE_AUTHORITATIVE ? PLAN.f13Edits : positiveInteger(process.env.PERF_F13_EDITS, PLAN.f13Edits);
export const F13_CYCLES: Readonly<Record<CacheStateName, number>> = PROFILE_AUTHORITATIVE
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

/**
 * A pass reduced below **its own profile's** floor is not acceptance evidence.
 * For the formal profile this is exactly the old ACCEPTANCE_PLAN comparison;
 * for the milestone plan it means fewer runs, inputs, cycles or F13 edits than
 * the ratified milestone method, which can never be read as a milestone pass.
 */
export const REDUCED_PASS =
	RUNS < PLAN.runs ||
	WARMUP_RUNS < PLAN.warmup ||
	INPUT_SAMPLES < PLAN.inputSamples ||
	DRAG_SAMPLES < PLAN.dragSamples ||
	UNDO_REDO_CYCLES < PLAN.undoRedoCycles ||
	F13_EDITS < PLAN.f13Edits ||
	F13_CYCLES.cold < PLAN.f13Cycles.cold ||
	F13_CYCLES['repeat-use'] < PLAN.f13Cycles['repeat-use'];

/** The flow's cache states in bench order; diagnostic omits the expensive repeats. */
export function cacheStatesFor(flow: FlowName): readonly CacheStateName[] {
	return PLAN.cacheStates[flow			];
}


/** Measured runs for one flow; a per-cache-state map lets the diagnostic use checks. */
export function runsFor(flow: FlowName, cacheState?: CacheStateName): number {
	if (!PROFILE_AUTHORITATIVE) return RUNS;
	const count = PLAN.runCounts[flow];
	if (typeof count === 'number') return count;
	return cacheState === undefined ? PLAN.runs : count[cacheState			];
}

/** The bound on adaptive escalation for a milestone row; 1 means no extension. */
export function maxRunsFor(flow: FlowName): number {
	return MILESTONE ? MILESTONE_MAX_RUNS[flow] : PLAN.runs;
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
	if (MILESTONE) {
		return [
			'S06 milestone method: decision rows start at 3 independent runs and extend one run at a time (to 10, F7 to 5) only while a hard row is undecided; every run must hold 25 % headroom to pass, and every run must breach the budget to fail early',
			`actual plan: F3 warm ${runsFor('f3', 'warm')} runs (+${maxRunsFor('f3') - runsFor('f3', 'warm')} bound), cold/repeat-use ${runsFor('f3', 'cold')} check each; F2 ${runsFor('f2')} runs per state; F7 ${runsFor('f7')} warm runs (+${maxRunsFor('f7') - runsFor('f7')} bound); F13 ${F13_EDITS} edits per measured cycle at cold ${F13_CYCLES.cold}, warm ${F13_CYCLES.warm}, repeat-use ${F13_CYCLES['repeat-use']} cycles; ${DRAG_SAMPLES} drag + ${DRAG_SAMPLES} precision samples and ${UNDO_REDO_CYCLES} Undo/Redo cycles per run`,
			'decision bands: warm F3/F4/F8; F2 cold+warm at S/M; F7 warm at S/M; F13 cold/repeat-use 10-cycle growth. Single-run cold/repeat-use interaction rows and Target rows (F2 L, F7 L) are recorded checks, not statistical gates',
			'not run: A.6 old-method rows and the delayed-preview proof (Bench 1 evidence), F2 repeat-use, F7 cold/repeat-use, grid-XL, realistic-L and sweep latency rows (report-only, deferred)',
			'S06 milestone acceptance only: a small-sample p95 is not a rare-tail estimate, and this is not production-scale, grid-XL, or ultimate geometry/rendering certification',
			'hard budgets require the designated reference machine and its recorded conditions',
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
