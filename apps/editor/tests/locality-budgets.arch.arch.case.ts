/**
 * The locality budget ratchet (LOC-0).
 *
 * One reader (`tools/metrics/metrics.ts`) measures file and function sizes,
 * `export *` statements, cross-package re-exports, exported test seams and
 * family entry-point cycles. `tools/metrics/budgets.json` records the current
 * exceptions; this test fails on a new offender, on growth of an existing one,
 * and on a stale entry or count that a packet reduced but did not lower.
 *
 * Shrink-only is the point: the allowlist cannot absorb a new 700-line module,
 * and removing one of its entries is part of the change that removes the code.
 */
import { describe, expect, it } from 'vitest';

import { check, measure, readBudgets } from '../../../tools/metrics/metrics';

describe('locality budgets', () => {
	it('holds the shrink-only file, function, barrel, seam and cycle budget', () => {
		const failures = check(measure(), readBudgets()).map((failure) => `[${failure.rule}] ${failure.detail}`);
		expect(failures).toEqual([]);
	}, 30_000);
});
