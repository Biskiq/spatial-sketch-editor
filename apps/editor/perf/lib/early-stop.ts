/**
 * Decisive-result early termination (S06 Bench 2/3 method review).
 *
 * A pass exists to decide whether a hard row is met. When every observation so
 * far is already beyond the hard budget, the remaining repetitions cannot make
 * the row pass, and spending them is orchestration cost with no decision value.
 *
 * The rule is deliberately strong, because a row stopped early is **not** a
 * pass and must never be read as one:
 *
 * - the row must be a **hard** budget (Target and report-only rows never stop);
 * - at least {@link EARLY_STOP_MIN_RUNS} measured runs must exist — a single
 *   slow first sample never stops anything;
 * - the **minimum** of those per-run statistics must exceed the budget by
 *   {@link EARLY_STOP_MARGIN} (25 %) — so no observed run is near the budget
 *   and run-to-run noise cannot flip the verdict;
 * - the row records the rule, the budget, the sample count and the observed
 *   minimum, and the flow files it as a demonstrated failure.
 *
 * The mechanism is inert unless `PERF_EARLY_STOP=1` (bench `--early-stop`).
 * Activating it for an accepted pass changes the sample floor of the rows it
 * stops and therefore needs owner approval; see the review handoff.
 */

export type EarlyStopDecision = {
	/** The row the decision applies to (`F4-grid-L-warm`). */
	readonly row: string;
	readonly budgetMs: number;
	readonly samples: number;
	/** The observed minimum that made the failure decisive. */
	readonly statisticMs: number;
	/** The recorded rule, as it appears in the row's limitations. */
	readonly rule: string;
};

/** Runs required before a decision may be taken (a single sample never stops). */
export const EARLY_STOP_MIN_RUNS = 3;
/** The decisive margin: the observed minimum must be this far beyond the budget. */
export const EARLY_STOP_MARGIN = 1.25;

/** Whether the pass activated early termination. Off unless explicitly requested. */
export function earlyStopEnabled(environment: NodeJS.ProcessEnv = process.env): boolean {
	return environment.PERF_EARLY_STOP === '1' && environment.PERF_SMOKE !== '1';
}

/**
 * The hard budgets this rule may stop on, in milliseconds, from the performance
 * contract's hard rows (only those rows are eligible).
 *
 * - F2 open: hard at S/M; **Target** at L (≤ 2.0 s), so L is absent on purpose.
 * - F3 input-to-matching-preview: hard at S/M/L (the row is p95; this rule uses
 *   the minimum, which is strictly stronger).
 * - F4 commit and F8 Undo/Redo completion: hard at S/M/L.
 *
 * `grid-XL`, `museum` and the sweep workloads are report-only: never listed.
 */
export const HARD_BUDGETS_MS: Readonly<Record<string, { readonly F2?: number; readonly F3?: number; readonly F4?: number; readonly F8?: number }>> = {
	'grid-S': { F2: 300, F3: 33, F4: 100, F8: 100 },
	'grid-M': { F2: 800, F3: 50, F4: 100, F8: 100 },
	'grid-L': { F3: 100, F4: 200, F8: 200 }
};

/**
 * Decide whether the observed values already demonstrate a hard-budget failure.
 * `values` are **one per measured run** of the same statistic (F3 passes each
 * run's p95, F4/F8 each run's minimum completion); non-finite entries (a
 * refusal, a missing mark) never contribute to a decision. Passing pooled
 * observations would let two samples of one run stand in for three runs.
 */
export function decisiveHardFailure(
	row: string,
	values: readonly number[],
	budgetMs: number | undefined,
	minRuns = EARLY_STOP_MIN_RUNS,
	margin = EARLY_STOP_MARGIN
): EarlyStopDecision | null {
	if (budgetMs === undefined || !Number.isFinite(budgetMs) || budgetMs <= 0) return null;
	const usable = values.filter((value) => Number.isFinite(value) && value >= 0);
	if (usable.length < Math.max(2, minRuns)) return null;
	let minimum = Number.POSITIVE_INFINITY;
	for (const value of usable) minimum = Math.min(minimum, value);
	if (!(minimum > budgetMs * margin)) return null;
	return {
		row,
		budgetMs,
		samples: usable.length,
		statisticMs: minimum,
		rule:
			`early stop: all ${usable.length} measured runs' statistic exceeds the ${budgetMs} ms hard budget ` +
			`(minimum ${round(minimum)} ms > ${Math.round((margin - 1) * 100)} % margin); ` +
			'the row is a demonstrated failure with a partial run count, never a pass'
	};
}

function round(value: number): string {
	return Number.isInteger(value) ? String(value) : value.toFixed(1);
}
