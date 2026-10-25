/**
 * T1.P02.S06 D.1 (H3) — the plan-space box index's superset contract.
 *
 * The index only prunes: a pair it omits must be one the shipped predicate
 * rejects anyway. The case that matters is a box whose corners are inverted — a
 * caller that builds `min`/`max` from two arbitrary endpoints can produce one. An
 * index that tests only the *span* (`max - min > 0`) accepts a box inverted on
 * both axes, because the two negatives cancel; that box was silently dropped and
 * its pairs were never visited.
 */
import { describe, expect, it } from 'vitest';
import { createPlanBoxIndex, type PlanBox } from '@portfolio/layout-core';

const box = (minX: number, minZ: number, maxX: number, maxZ: number): PlanBox => ({ minX, minZ, maxX, maxZ });

describe('T1.P02.S06 H3 — plan box index', () => {
	it('returns every overlapping box, in insertion order', () => {
		const index = createPlanBoxIndex([box(0, 0, 1, 1), box(2, 2, 3, 3), box(0.5, 0.5, 2.5, 2.5), box(9, 9, 10, 10)]);
		// Box 1 (2..3) does not reach the query; boxes 0 and 2 do, in insertion order.
		expect(index.overlaps(box(0.75, 0.75, 1.25, 1.25))).toEqual([0, 2]);
		expect(index.size).toBe(4);
	});

	it('never drops a box inverted on both axes (the (-1) × (-1) = +1 case)', () => {
		// Corners authored in the opposite order: min is greater than max on both
		// axes, so the naive span is positive.
		const inverted = box(4, 4, 1, 1);
		const index = createPlanBoxIndex([inverted, box(10, 10, 11, 11)]);
		expect(index.overlaps(box(1, 1, 4, 4))).toContain(0);
		// And it still answers a query that does not reach it.
		expect(index.overlaps(box(20, 20, 21, 21))).toEqual([]);
	});

	it('answers an inverted or non-finite query without losing the entries it should return', () => {
		// The grid cannot be walked from an inverted or non-finite query, so the
		// index falls back to a scan. The contract is that the fallback still
		// returns the entries the inclusive overlap test accepts.
		const index = createPlanBoxIndex([box(0, 0, 1, 1), box(5, 5, 6, 6)]);
		expect(index.overlaps(box(6, 6, 5, 5))).toEqual([1]);
		const nan = index.overlaps(box(Number.NaN, 0, 1, 1));
		// Never a subset the scan invented: every answer is a real entry index.
		for (const entry of nan) expect(entry === 0 || entry === 1).toBe(true);
	});

	it('keeps a box larger than the cell budget in every answer it belongs to', () => {
		// A single very long Wall spans far more cells than an entry may occupy, so
		// it is held in the wide list and consulted by every query.
		const index = createPlanBoxIndex([box(-1000, -1, 1000, 1), box(0, 0, 0.5, 0.5)]);
		expect(index.overlaps(box(0, 0, 0.1, 0.1))).toEqual([0, 1]);
	});
});
