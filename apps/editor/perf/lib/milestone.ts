/**
 * S06 milestone decision policy (owner direction, 2026-10-26).
 *
 * Bench 2 showed that the S06 question — are the measured interactions fast
 * enough to advance Biskiq production? — is answered long before a laboratory
 * sample plan finishes. This module is the smallest decision rule that turns
 * independent runs into a verdict, and it spends samples only while the answer
 * is genuinely open.
 *
 * ## What one sample is
 *
 * A **run** is one independent measured repetition of a flow: a fresh cold
 * context, or one more run in the warm/repeat-use context. A pointer event
 * inside a run is not an independent experiment, so a row's decision values are
 * **one statistic per run** (the run's p95), never pooled pointer events. The
 * rule cannot satisfy its run floor with several samples of one run.
 *
 * ## The three verdicts
 *
 * With `budgetMs` the contract's hard budget and `p95(run)` each run's own p95:
 *
 * - **pass** — at least {@link MILESTONE_MIN_RUNS} runs exist and every run's
 *   p95 is at or below {@link MILESTONE_HEADROOM} × budget (25 % headroom).
 *   The row is decided; further runs cannot change the decision band, so they
 *   are not spent.
 * - **fail** — at least the minimum runs exist and every run's p95 exceeds the
 *   budget. A demonstrated violation; further runs cannot turn it into a pass,
 *   so they are not spent.
 * - **borderline** — anything else: the runs disagree, or the pass is real but
 *   the margin is thin. Exactly one more independent run is requested at a time,
 *   up to `maxRuns`. At the bound the row is adjudicated on the contract's own
 *   pooled p95 (`pooledP95Ms <= budgetMs` passes, and the instability is
 *   recorded); no invented margin decides it.
 *
 * A single-run difference from either band is never enough to stop early: the
 * pass band requires **every** run inside it, so one run anywhere near the
 * budget keeps the row open until the escalation bound.
 *
 * Frame-interval rows (F7) pass `headroom: 1`. Their budget is the display's
 * refresh interval (16.7 ms at 60 Hz), so a 25 % band below it is a band no
 * observed frame can enter; the contract's own ≤ budget test is the right one
 * there. Interaction and commit rows use the 25 % band because their budgets
 * are work bounds, not display floors.
 *
 * ## Why 25 % and why not more machinery
 *
 * The 25 % margin is the one this harness already ratified for decisive failure
 * (`EARLY_STOP_MARGIN`), and the historical variance says it is the right size:
 * Bench 1's clear rows sat 3–5 % apart run to run (L F4 636–670 ms, F8
 * 519–536 ms), while the near miss (M F8 95–111 ms against 100 ms) is exactly
 * the case a zero-margin rule would mislabel. No confidence level, sequential
 * test, or alpha-spending scheme is invented here: with three to ten runs a p95
 * is a coarse tail estimate, and the rule says so in every row.
 *
 * A contaminated or aborted pass is never interpreted by this module at all;
 * the bench manifest marks it and no decision may be read from it.
 */

export type MilestoneVerdict = 'pass' | 'fail' | 'borderline';

export type MilestoneRowDecision = {
	readonly row: string;
	readonly budgetMs: number;
	readonly verdict: MilestoneVerdict;
	/** Independent measured runs that produced the decision. */
	readonly runs: number;
	/** One p95 per measured run, in run order. */
	readonly perRunP95Ms: readonly number[];
	/** The contract row's p95 over every observation of every measured run. */
	readonly pooledP95Ms: number;
	readonly worstRunP95Ms: number;
	readonly bestRunP95Ms: number;
	/** Fraction of the budget that the slowest run left unused; negative = breach. */
	readonly headroom: number;
	/** The recorded rule, as it appears in the row's limitations. */
	readonly rule: string;
};

/** Independent runs required before any verdict (never several samples of one run). */
export const MILESTONE_MIN_RUNS = 3;
/** Bound on adaptive escalation for the interaction rows. */
export const MILESTONE_MAX_RUNS: Readonly<Record<'f2' | 'f3' | 'f7' | 'f13', number>> = {
	f2: 10,
	f3: 10,
	f7: 5,
	f13: 1
};
/** A pass needs every run at or below this fraction of the budget. */
export const MILESTONE_HEADROOM = 0.75;
/**
 * Sub-millisecond tolerance for frame-interval rows, whose budget is one 60 Hz
 * refresh interval (16.7 ms). A measured interval of 16.700000000000003 ms is
 * the same frame; comparing raw doubles would fail on arithmetic noise. The
 * tolerance is 0.3 % of a frame and is stated in every such row's rule.
 */
export const FRAME_INTERVAL_TOLERANCE_MS = 0.05;

export type MilestoneRowInput = {
	readonly row: string;
	readonly budgetMs: number;
	/** One value per measured run: that run's p95, never a pooled pointer sample. */
	readonly perRunP95Ms: readonly number[];
	/** The row's p95 over all observations (the contract's own statistic). */
	readonly pooledP95Ms: number;
	readonly maxRuns?: number;
	/**
	 * Measured runs completed, including runs whose statistic was unusable. The
	 * escalation bound is a property of the series, not of the finite subset: a
	 * row at its bound must be adjudicated even if a mark went missing, and
	 * missing evidence can only fail it, never leave it undecided.
	 */
	readonly completedRuns?: number;
	/**
	 * The fraction of the budget a pass must stay below. The interaction rows use
	 * the 25 % band. Frame-interval rows pass `1`: their budget **is** the display
	 * refresh floor (16.7 ms at 60 Hz), so no sample can hold 25 % headroom, and a
	 * band below the budget would be a band no observed frame could enter.
	 */
	readonly headroom?: number;
};

/**
 * Decide one hard row from its independent runs, or return `null` while there
 * are fewer than {@link MILESTONE_MIN_RUNS} usable runs (keep collecting).
 *
 * Non-finite values (a refusal, a missing mark) are not evidence and never
 * contribute a run.
 */
export function decideMilestoneRow(input: MilestoneRowInput): MilestoneRowDecision | null {
	const { row, budgetMs } = input;
	if (!Number.isFinite(budgetMs) || budgetMs <= 0) return null;
	const usable = input.perRunP95Ms.filter((value) => Number.isFinite(value) && value >= 0);
	const maxRuns = Math.max(MILESTONE_MIN_RUNS, input.maxRuns ?? MILESTONE_MAX_RUNS.f3);
	const completedRuns = Math.max(usable.length, input.completedRuns ?? usable.length);
	const atBound = completedRuns >= maxRuns;
	if (usable.length < MILESTONE_MIN_RUNS) {
		if (!atBound) return null;
		return {
			row,
			budgetMs,
			verdict: 'fail',
			runs: usable.length,
			perRunP95Ms: usable,
			pooledP95Ms: input.pooledP95Ms,
			worstRunP95Ms: Number.NaN,
			bestRunP95Ms: Number.NaN,
			headroom: Number.NaN,
			rule:
				`milestone decision at the ${maxRuns}-run bound: only ${usable.length} of ${completedRuns} measured runs produced a usable p95, ` +
				`below the ${MILESTONE_MIN_RUNS}-run floor; the row is a failure of evidence, never a pass`
		};
	}
	const headroom = input.headroom ?? MILESTONE_HEADROOM;
	const tolerance = headroom >= 1 ? FRAME_INTERVAL_TOLERANCE_MS : 0;
	const best = Math.min(...usable);
	const worst = Math.max(...usable);
	const pooled = input.pooledP95Ms;
	const base = {
		row,
		budgetMs,
		runs: usable.length,
		perRunP95Ms: usable,
		pooledP95Ms: pooled,
		worstRunP95Ms: worst,
		bestRunP95Ms: best,
		headroom: round((budgetMs - worst) / budgetMs, 4)
	};
	const passBound = round(budgetMs * headroom, 4);

	if (best > budgetMs + tolerance) {
		return {
			...base,
			verdict: 'fail',
			rule:
				`milestone decision: every one of ${usable.length} independent run${usable.length === 1 ? '' : 's'} exceeds the ${budgetMs} ms hard budget ` +
				`(fastest run p95 ${round(best)} ms); a demonstrated violation, so no further runs were spent`
		};
	}
	if (worst <= passBound + tolerance) {
		return {
			...base,
			verdict: 'pass',
			rule:
				(headroom < 1
					? `milestone decision: all ${usable.length} independent runs are at or below ${passBound} ms (${Math.round((1 - headroom) * 100)} % headroom) ` +
						`against the ${budgetMs} ms hard budget; slowest run p95 ${round(worst)} ms`
					: `milestone decision: all ${usable.length} independent runs are at or below the ${budgetMs} ms budget ` +
						`(±${FRAME_INTERVAL_TOLERANCE_MS} ms display-clock tolerance); slowest run p95 ${round(worst)} ms. ` +
						`This is a frame-interval row tied to the display refresh, so no extra headroom band applies`) +
				(pooled <= budgetMs ? `, pooled p95 ${round(pooled)} ms` : '') +
				`; a small-sample p95 is not a rare-tail estimate`
		};
	}
	if (atBound) {
		// The escalation bound is reached: use the contract's own statistic, not a
		// new margin. A pooled pass with a run outside the headroom band is
		// accepted with the instability recorded, never presented as a stable row.
		const passed = Number.isFinite(pooled) && pooled <= budgetMs + tolerance;
		return {
			...base,
			verdict: passed ? 'pass' : 'fail',
			rule:
				`milestone decision at the ${maxRuns}-run bound: pooled p95 ${round(pooled)} ms ` +
				`${passed ? '≤' : '>'} the ${budgetMs} ms hard budget, but ` +
				(headroom < 1
					? `not every run held ${Math.round((1 - headroom) * 100)} % headroom`
					: 'not every run was inside the display-floor budget beyond the clock tolerance') +
				` (worst ${round(worst)} ms, best ${round(best)} ms); ` +
				(passed
					? 'accepted with the run-to-run instability recorded; the row is not certified as a stable or rare-tail result'
					: 'a demonstrated failure of the contract statistic')
		};
	}
	return {
		...base,
		verdict: 'borderline',
		rule:
			`milestone decision pending: ${usable.length} independent runs are not unanimous — ` +
			`slowest p95 ${round(worst)} ms against the ${budgetMs} ms hard budget, fastest ${round(best)} ms, pooled ${round(pooled)} ms; ` +
			`one more independent run is requested (bound ${maxRuns})`
	};
}

/** Whether the row is still open and may spend one more independent run. */
export function milestoneNeedsOneMore(decision: MilestoneRowDecision | null): boolean {
	return decision !== null && decision.verdict === 'borderline';
}

export type MilestoneRowOutcome = {
	/** `F3`, `F4`, `F8`, … */
	readonly name: string;
	readonly decision: MilestoneRowDecision | null;
	readonly runs: number;
};

/**
 * Metrics for one phase that owns several decision rows. A row without a
 * verdict is recorded as `undecided`, never dropped: an omitted measurement is
 * visible to the adjudication and cannot be read as a pass.
 */
export function milestoneOutcomesMetrics(outcomes: readonly MilestoneRowOutcome[]): Record<string, number | string> {
	if (outcomes.length === 0) return {};
	const decided = outcomes.flatMap((outcome) => (outcome.decision === null ? [] : [outcome.decision]));
	return {
		'milestone:verdicts': outcomes.map((outcome) => `${outcome.name}=${outcome.decision?.verdict ?? 'undecided'}`).join(','),
		'milestone:runs': outcomes.map((outcome) => `${outcome.name}=${outcome.runs}`).join(','),
		...(decided.length === 0
			? {}
			: {
					'milestone:worstRunP95Ms': Math.max(...decided.map((decision) => decision.worstRunP95Ms)),
					'milestone:minHeadroom': Math.min(...decided.map((decision) => decision.headroom))
				})
	};
}

/** The recorded rules for every decided row, plus an explicit undecided note. */
export function milestoneOutcomeRules(outcomes: readonly MilestoneRowOutcome[]): string[] {
	return outcomes.map((outcome) =>
		outcome.decision === null
			? `milestone: ${outcome.name} is undecided after ${outcome.runs} measured run${outcome.runs === 1 ? '' : 's'}; it is not a pass`
			: outcome.decision.rule
	);
}

/** Metrics every decided row records beside its statistics. */
export function milestoneMetrics(decision: MilestoneRowDecision): Record<string, number | string> {
	return {
		'milestone:verdict': decision.verdict,
		'milestone:runs': decision.runs,
		'milestone:worstRunP95Ms': round(decision.worstRunP95Ms),
		'milestone:bestRunP95Ms': round(decision.bestRunP95Ms),
		'milestone:pooledP95Ms': round(decision.pooledP95Ms),
		'milestone:headroom': decision.headroom,
		'milestone:perRunP95Ms': decision.perRunP95Ms.map((value) => round(value)).join(',')
	};
}

export type LeakDecision = {
	readonly row: string;
	readonly verdict: 'pass' | 'fail';
	/** Steady-state growth over the measured intervals (cold's first cycle excluded). */
	readonly growthMiB: number;
	/** The same growth normalised to the budget's ten-cycle basis. */
	readonly normalizedGrowthMiB: number;
	readonly intervals: number;
	readonly budgetMiB: number;
	readonly geometriesBackToBaseline: boolean;
	readonly texturesBackToBaseline: boolean;
	readonly rule: string;
};

export type LeakInput = {
	readonly row: string;
	readonly budgetMiB: number;
	/**
	 * The baseline sample followed by the post-GC heap after each measured
	 * cycle: for a cold row the baseline is the virgin hub entry (before the
	 * first open); for a warm row it is taken after the discarded warm-up.
	 */
	readonly heapMiB: readonly number[];
	/** The series starts with the cold entry sample (index 0) rather than the post-warm-up baseline. */
	readonly skipFirst: boolean;
	/** Geometry counts at the end of each measured cycle. */
	readonly geometries: readonly number[];
	readonly textures: readonly number[];
};

/**
 * Decide F13's hard leak row: growth over the measured cycles and GPU resources
 * back to baseline. The first measured cycle carries a one-time first-load step
 * (the Stage's first load at cold, and still the first open after a one-cycle
 * warm-up at repeat-use), so steady growth starts at the second measured cycle
 * for both. The measured growth is normalised to the contract's ten-cycle basis.
 * This is timing-free evidence and is kept separate from the interaction rows'
 * statistics.
 */
export function decideLeakRow(input: LeakInput): LeakDecision | null {
	// The index alignment is part of the evidence (series[0] is the baseline), so
	// a missing measurement is undecided rather than silently dropped.
	if (input.heapMiB.some((value) => !Number.isFinite(value))) return null;
	const series = input.heapMiB;
	// The series is [baseline, cycle 1, cycle 2, …]. Cycle 1 contains the
	// one-time first-load step (cold: the Stage's first load; repeat-use: the
	// first open after the discarded warm-up), so the steady baseline is cycle 2:
	// index 2 when the baseline sample is the cold entry (skipFirst), index 1
	// when it is the post-warm-up sample. At least two steady intervals are
	// needed before a ten-cycle row is decided.
	const baselineIndex = input.skipFirst ? 2 : 1;
	if (series.length - 1 - baselineIndex < 2) return null;
	const growth = series[series.length - 1]! - series[baselineIndex]!;
	const intervals = series.length - 1 - baselineIndex;
	// A resource level is "back to baseline" when the cycles after the first end
	// at the same value. The first measured cycle is a first-load sample: Bench 2
	// recorded a one-time texture/program step (3 → 6 textures, 2 → 4 programs)
	// that stays for every later cycle and is not a leak. A level that keeps
	// moving, or that differs after the first cycle, still fails.
	const steady = (values: readonly number[]): { back: boolean; baseline: number } => {
		if (values.length === 0) return { back: false, baseline: Number.NaN };
		if (values.length === 1) return { back: true, baseline: values[0]! };
		const baseline = values[1]!;
		return { back: values.slice(1).every((value) => value === baseline), baseline };
	};
	const geometries = input.geometries;
	const textures = input.textures;
	const geometrySteady = steady(geometries);
	const textureSteady = steady(textures);
	const geometriesBack = geometrySteady.back;
	const texturesBack = textureSteady.back;
	// Every row's steady series starts after its first-load cycle, so it has
	// fewer intervals than the contract's ten cycles; the growth is normalised to
	// the ten-cycle basis before it is compared with the same MiB budget. A leak
	// is a rate, and comparing a shorter series to a ten-interval budget would
	// flatter it.
	const normalizedGrowth = intervals === 10 ? growth : (growth * 10) / intervals;
	const withinBudget = Number.isFinite(normalizedGrowth) && normalizedGrowth <= input.budgetMiB;
	const verdict = withinBudget && geometriesBack && texturesBack ? 'pass' : 'fail';
	const parts: string[] = [
		`steady heap growth ${round(growth)} MiB over ${intervals} cycle interval${intervals === 1 ? '' : 's'} ` +
			`(normalised ${round(normalizedGrowth)} MiB per ten cycles) against the ${input.budgetMiB} MiB budget`,
		`geometries ${geometriesBack ? `at the steady baseline ${geometrySteady.baseline}` : `not back to baseline (${geometries.join(',')})`}`,
		`textures ${texturesBack ? `at the steady baseline ${textureSteady.baseline}` : `not back to baseline (${textures.join(',')})`}`
	];
	return {
		row: input.row,
		verdict,
		growthMiB: growth,
		normalizedGrowthMiB: normalizedGrowth,
		intervals,
		budgetMiB: input.budgetMiB,
		geometriesBackToBaseline: geometriesBack,
		texturesBackToBaseline: texturesBack,
		rule:
			`milestone leak decision: ${parts.join('; ')}. ` +
			`The first measured cycle is a first-load sample, so steady growth starts at the second measured cycle. ` +
			'Live WebGL contexts are not captured by this harness (recorded limitation); this is deterministic count/heap evidence, not a timing row'
	};
}

export function leakMetrics(decision: LeakDecision): Record<string, number | string> {
	return {
		'milestone:verdict': decision.verdict,
		'milestone:steadyGrowthMiB': round(decision.growthMiB),
		'milestone:normalizedGrowthPer10CyclesMiB': round(decision.normalizedGrowthMiB),
		'milestone:growthBudgetMiB': decision.budgetMiB,
		'milestone:geometriesBackToBaseline': decision.geometriesBackToBaseline ? 1 : 0,
		'milestone:texturesBackToBaseline': decision.texturesBackToBaseline ? 1 : 0
	};
}

/** F13's hard growth budget per tier (performance contract: ≤5 MiB S/M, ≤10 MiB L). */
export const LEAK_BUDGETS_MIB: Readonly<Record<string, number>> = {
	'grid-S': 5,
	'grid-M': 5,
	'grid-L': 10
};

/**
 * F7's frame-interval budget. S and M are hard rows; L is a Target row, so L is
 * recorded (with its long-task gate) but never adjudicated as a milestone gate.
 */
export const FRAME_BUDGETS_MS: Readonly<Record<string, { readonly p95: number; readonly p99: number; readonly longTask: number }>> = {
	'grid-S': { p95: 16.7, p99: 25, longTask: 50 },
	'grid-M': { p95: 16.7, p99: 33, longTask: 50 },
	'grid-L': { p95: 33, p99: 50, longTask: 50 }
};

/**
 * F3's frame-time row (performance contract): its own budgets, not F7's. S is
 * 16.7/33 ms; M is 20/33 ms; L is a Target row and gets no verdict.
 */
export const DRAG_FRAME_BUDGETS_MS: Readonly<Record<string, { readonly p95: number; readonly p99: number; readonly longTask: number }>> = {
	'grid-S': { p95: 16.7, p99: 33, longTask: 50 },
	'grid-M': { p95: 20, p99: 33, longTask: 50 }
};

function round(value: number, digits = 2): number {
	if (!Number.isFinite(value)) return value;
	const factor = 10 ** digits;
	return Math.round(value * factor) / factor;
}
