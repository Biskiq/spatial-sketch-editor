import { describe, expect, it } from 'vitest';

import {
	EARLY_STOP_MARGIN,
	EARLY_STOP_MIN_RUNS,
	decisiveHardFailure,
	earlyStopEnabled
} from '../../../perf/lib/early-stop';

describe('decisive hard-budget early stop', () => {
	it('never stops before the minimum number of measured runs', () => {
		expect(decisiveHardFailure('F4-grid-L-warm', [900, 950], 200)).toBeNull();
		expect(decisiveHardFailure('F4-grid-L-warm', [], 200)).toBeNull();
	});

	it('never stops while any observed run is within the margin', () => {
		// 210 ms is over the 200 ms budget, but inside the 25 % margin: noise could
		// still put the row near the budget, so the series continues.
		expect(decisiveHardFailure('F4-grid-L-warm', [900, 600, 210], 200)).toBeNull();
		expect(decisiveHardFailure('F4-grid-L-warm', [900, 600, 200 * EARLY_STOP_MARGIN], 200)).toBeNull();
	});

	it('never stops on a row without a hard budget', () => {
		expect(decisiveHardFailure('F2-grid-L-warm', [9_000, 8_000, 7_000], undefined)).toBeNull();
		expect(decisiveHardFailure('F4-grid-L-warm', [900, 900, 900], Number.NaN)).toBeNull();
	});

	it('stops when every measured run is decisively beyond the budget', () => {
		const decision = decisiveHardFailure('F4-grid-L-warm', [900, 850, 800], 200);
		expect(decision).not.toBeNull();
		expect(decision!.samples).toBe(3);
		expect(decision!.statisticMs).toBe(800);
		expect(decision!.budgetMs).toBe(200);
		expect(decision!.rule).toContain('demonstrated failure');
		expect(decision!.rule).toContain('never a pass');
		// The decision is taken at the first run count that can decide, not later.
		expect(EARLY_STOP_MIN_RUNS).toBe(3);
	});

	it('ignores non-finite observations instead of treating them as runs', () => {
		// A missing mark or a refusal contributes no measurement; with only two
		// usable values the rule must not decide.
		expect(decisiveHardFailure('F4-grid-L-warm', [Number.NaN, 900], 200)).toBeNull();
		expect(decisiveHardFailure('F4-grid-L-warm', [Number.NaN, 900, Number.POSITIVE_INFINITY], 200)).toBeNull();
		const decision = decisiveHardFailure('F8-grid-M-warm', [Number.NaN, 700, 650, 600], 100);
		expect(decision?.samples).toBe(3);
		expect(decision?.statisticMs).toBe(600);
	});

	it('is inert unless explicitly enabled and never in smoke mode', () => {
		expect(earlyStopEnabled({})).toBe(false);
		expect(earlyStopEnabled({ PERF_EARLY_STOP: '1' })).toBe(true);
		expect(earlyStopEnabled({ PERF_EARLY_STOP: '1', PERF_SMOKE: '1' })).toBe(false);
	});
});
