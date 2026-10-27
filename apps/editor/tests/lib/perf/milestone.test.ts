import { describe, expect, it } from 'vitest';

import {
	decideLeakRow,
	decideMilestoneRow,
	LEAK_BUDGETS_MIB,
	MILESTONE_HEADROOM,
	MILESTONE_MAX_RUNS,
	MILESTONE_MIN_RUNS,
	milestoneMetrics,
	milestoneNeedsOneMore,
	milestoneOutcomeRules,
	milestoneOutcomesMetrics
} from '../../../perf/lib/milestone';

const BUDGET = 200;

describe('milestone decision policy', () => {
	it('uses the ratified minimum and bound, never a single run', () => {
		expect(MILESTONE_MIN_RUNS).toBe(3);
		expect(MILESTONE_MAX_RUNS).toEqual({ f2: 10, f3: 10, f7: 5, f13: 1 });
		expect(MILESTONE_HEADROOM).toBe(0.75);
		expect(decideMilestoneRow({ row: 'F4-x', budgetMs: BUDGET, perRunP95Ms: [1, 1], pooledP95Ms: 1 })).toBeNull();
	});

	it('passes only when every independent run holds 25 % headroom', () => {
		const decision = decideMilestoneRow({
			row: 'F4-grid-L-warm',
			budgetMs: BUDGET,
			perRunP95Ms: [90, 140, 150],
			pooledP95Ms: 140
		});
		expect(decision?.verdict).toBe('pass');
		expect(decision?.runs).toBe(3);
		expect(decision?.headroom).toBe(0.25);
		expect(milestoneNeedsOneMore(decision)).toBe(false);
		expect(decision?.rule).toContain('150 ms');
	});

	it('does not pass a single run near the budget, even when the others are healthy', () => {
		const decision = decideMilestoneRow({
			row: 'F4-grid-L-warm',
			budgetMs: BUDGET,
			perRunP95Ms: [90, 110, 151],
			pooledP95Ms: 120,
			maxRuns: 10
		});
		expect(decision?.verdict).toBe('borderline');
		expect(milestoneNeedsOneMore(decision)).toBe(true);
	});

	it('fails early only when every independent run breaches the budget', () => {
		const decision = decideMilestoneRow({
			row: 'F8-grid-M-warm',
			budgetMs: BUDGET,
			perRunP95Ms: [201, 240, 260],
			pooledP95Ms: 240
		});
		expect(decision?.verdict).toBe('fail');
		expect(decision?.rule).toContain('every one of 3 independent runs exceeds');
	});

	it('keeps a mixed pass/fail set open instead of calling it a failure', () => {
		const decision = decideMilestoneRow({
			row: 'F8-grid-M-warm',
			budgetMs: BUDGET,
			perRunP95Ms: [90, 201, 120],
			pooledP95Ms: 150,
			maxRuns: 10
		});
		expect(decision?.verdict).toBe('borderline');
	});

	it('adjudicates at the escalation bound on the contract pooled p95, recording instability', () => {
		const passing = decideMilestoneRow({
			row: 'F4-grid-L-warm',
			budgetMs: BUDGET,
			perRunP95Ms: [90, 110, 151],
			pooledP95Ms: 150,
			maxRuns: 3
		});
		expect(passing?.verdict).toBe('pass');
		expect(passing?.rule).toContain('3-run bound');
		expect(passing?.rule).toContain('not certified as a stable');

		const failing = decideMilestoneRow({
			row: 'F4-grid-L-warm',
			budgetMs: BUDGET,
			perRunP95Ms: [90, 110, 151],
			pooledP95Ms: 201,
			maxRuns: 3
		});
		expect(failing?.verdict).toBe('fail');
		expect(failing?.rule).toContain('demonstrated failure of the contract statistic');
	});

	it('never counts a refusal or a missing mark as a run', () => {
		const decision = decideMilestoneRow({
			row: 'F3-grid-S-warm',
			budgetMs: 33,
			perRunP95Ms: [20, Number.NaN, 18, Number.POSITIVE_INFINITY, 22],
			pooledP95Ms: 20
		});
		expect(decision?.runs).toBe(3);
		expect(decision?.verdict).toBe('pass');
	});

	it('does not invent a headroom band below a display-floor frame budget', () => {
		const decision = decideMilestoneRow({
			row: 'F7-grid-S-warm',
			budgetMs: 16.7,
			perRunP95Ms: [16.7, 16.7, 16.7],
			pooledP95Ms: 16.7,
			maxRuns: 5,
			headroom: 1
		});
		expect(decision?.verdict).toBe('pass');
		expect(decision?.rule).toContain('no extra headroom band applies');
	});

	it('keeps display-clock arithmetic noise from deciding a frame row', () => {
		const noise = decideMilestoneRow({
			row: 'F7-grid-S-warm',
			budgetMs: 16.7,
			perRunP95Ms: [16.700000000000003, 16.7, 16.7],
			pooledP95Ms: 16.7,
			maxRuns: 5,
			headroom: 1
		});
		expect(noise?.verdict).toBe('pass');

		const over = decideMilestoneRow({
			row: 'F7-grid-S-warm',
			budgetMs: 16.7,
			perRunP95Ms: [16.7, 16.8, 16.7],
			pooledP95Ms: 16.7,
			maxRuns: 5,
			headroom: 1
		});
		expect(over?.verdict).toBe('borderline');
	});

	it('fails a row at its bound when too few runs produced a usable statistic', () => {
		const decision = decideMilestoneRow({
			row: 'F3-grid-S-warm',
			budgetMs: BUDGET,
			perRunP95Ms: [20, Number.NaN, 18],
			pooledP95Ms: 20,
			maxRuns: 10,
			completedRuns: 10
		});
		expect(decision?.verdict).toBe('fail');
		expect(decision?.rule).toContain('failure of evidence');
	});

	it('keeps an undecided row visible instead of dropping it from the verdict set', () => {
		const outcomes = [
			{
				name: 'F4',
				decision: decideMilestoneRow({ row: 'F4', budgetMs: BUDGET, perRunP95Ms: [90, 90, 90], pooledP95Ms: 90 }),
				runs: 3
			},
			{ name: 'F3', decision: null, runs: 1 }
		];
		const metrics = milestoneOutcomesMetrics(outcomes);
		expect(metrics['milestone:verdicts']).toBe('F4=pass,F3=undecided');
		expect(milestoneOutcomeRules(outcomes).some((rule) => rule.includes('F3 is undecided'))).toBe(true);
	});

	it('records the per-run evidence with the verdict', () => {
		const decision = decideMilestoneRow({
			row: 'F3-grid-S-warm',
			budgetMs: 100,
			perRunP95Ms: [15.5, 16.2, 15.9],
			pooledP95Ms: 16
		})!;
		const metrics = milestoneMetrics(decision);
		expect(metrics['milestone:verdict']).toBe('pass');
		expect(metrics['milestone:runs']).toBe(3);
		expect(metrics['milestone:perRunP95Ms']).toBe('15.5,16.2,15.9');
	});
});

describe('milestone leak decision', () => {
	it('counts the cold row from the second cycle so first load is not a leak', () => {
		const decision = decideLeakRow({
			row: 'F13-grid-L-cold',
			budgetMiB: LEAK_BUDGETS_MIB['grid-L']!,
			// entry, first-load cycle (63), then steady cycles at 63.5.
			heapMiB: [50, 63, 63.5, 63.5, 63.5],
			skipFirst: true,
			geometries: [2339, 2339, 2339],
			textures: [34, 34, 34]
		});
		expect(decision?.growthMiB).toBe(0);
		expect(decision?.intervals).toBe(2);
		expect(decision?.verdict).toBe('pass');
		expect(decision?.rule).toContain('first-load sample');
	});

	it('does not let a cold first-load jump count as steady growth', () => {
		// The real grid-L shape: entry 1.46 MiB, first-load 55.2 MiB, then steady
		// cycles rising about 0.3 MiB per cycle. Counting from the first-load cycle
		// would report 10.9 MiB and fail a row whose steady growth is 2.1 MiB.
		const decision = decideLeakRow({
			row: 'F13-grid-L-cold',
			budgetMiB: 10,
			heapMiB: [1.46, 55.2, 63.97, 64.57, 64.86, 65.12, 65.14, 65.28, 65.3, 66.1, 66.07],
			skipFirst: true,
			geometries: [2409, 2409],
			textures: [3, 6, 6]
		});
		expect(decision?.intervals).toBe(8);
		expect(decision?.growthMiB).toBeCloseTo(2.1, 5);
		expect(decision?.normalizedGrowthMiB).toBeCloseTo(2.625, 5);
		expect(decision?.verdict).toBe('pass');
	});

	it('treats the cold first-load texture step as baseline, not as a leak', () => {
		const decision = decideLeakRow({
			row: 'F13-grid-L-cold',
			budgetMiB: 10,
			heapMiB: [50, 63, 63.4, 63.6, 63.7, 63.8, 63.9, 64, 64, 64, 64.1],
			skipFirst: true,
			geometries: [2339, 2339, 2339],
			textures: [3, 6, 6, 6, 6, 6, 6, 6, 6, 6]
		});
		expect(decision?.verdict).toBe('pass');
		expect(decision?.texturesBackToBaseline).toBe(true);
	});

	it('excludes the first-load step from the repeat-use row too', () => {
		// The real grid-L repeat-use shape: the first open after the discarded
		// warm-up still carries a 9 MiB first-load step; steady growth is 2.24 MiB
		// over the nine intervals that follow it.
		const decision = decideLeakRow({
			row: 'F13-grid-L-repeat-use',
			budgetMiB: 10,
			heapMiB: [55.19, 64.08, 64.66, 64.9, 65.18, 65.17, 65.32, 65.34, 66.15, 66.15, 66.32],
			skipFirst: false,
			geometries: [2409, 2409],
			textures: [6, 6]
		});
		expect(decision?.intervals).toBe(9);
		expect(decision?.growthMiB).toBeCloseTo(2.24, 5);
		expect(decision?.normalizedGrowthMiB).toBeCloseTo(2.49, 2);
		expect(decision?.verdict).toBe('pass');
	});

	it('fails growth beyond the budget and a resource that did not return', () => {
		const over = decideLeakRow({
			row: 'F13-grid-S-repeat-use',
			budgetMiB: 5,
			heapMiB: [40, 40, 41, 46],
			skipFirst: false,
			geometries: [100, 100, 100],
			textures: [34, 34, 34]
		});
		expect(over?.verdict).toBe('fail');

		const leaking = decideLeakRow({
			row: 'F13-grid-S-repeat-use',
			budgetMiB: 5,
			heapMiB: [40, 40, 40, 40],
			skipFirst: false,
			geometries: [100, 100, 101, 100],
			textures: [34, 34, 34, 34]
		});
		expect(leaking?.verdict).toBe('fail');
		expect(leaking?.geometriesBackToBaseline).toBe(false);
	});

	it('normalises the nine-interval cold row to the ten-cycle budget before deciding', () => {
		const passing = decideLeakRow({
			row: 'F13-grid-S-cold',
			budgetMiB: 5,
			heapMiB: [50, 60, 60.5, 60.5, 60.5, 60.5, 60.5, 60.5, 60.5, 60.5, 64.5],
			skipFirst: true,
			geometries: [100, 100],
			textures: [34, 34]
		});
		expect(passing?.intervals).toBe(8);
		expect(passing?.normalizedGrowthMiB).toBeCloseTo(5, 5);
		expect(passing?.verdict).toBe('pass');

		const failing = decideLeakRow({
			row: 'F13-grid-S-cold',
			budgetMiB: 5,
			heapMiB: [50, 60, 60.5, 60.5, 60.5, 60.5, 60.5, 60.5, 60.5, 60.5, 64.95],
			skipFirst: true,
			geometries: [100, 100],
			textures: [34, 34]
		});
		expect(failing?.growthMiB).toBeLessThan(5);
		expect(failing?.normalizedGrowthMiB).toBeCloseTo(5.5625, 5);
		expect(failing?.verdict).toBe('fail');
	});

	it('does not decide a one-cycle check as a ten-cycle row', () => {
		expect(
			decideLeakRow({
				row: 'F13-grid-S-warm',
				budgetMiB: 5,
				heapMiB: [40, 41],
				skipFirst: false,
				geometries: [100],
				textures: [34]
			})
		).toBeNull();
	});
});
