/**
 * P23B.8 follow-up S2 — D8 bounded heap-retention comparison.
 *
 * COMPARISON ONLY, no redesign. Bounded comparison — repeated edits · history
 * eviction · clearing — reporting the H-7 deltas (advisory). REPORT-ONLY: fails
 * only on error/OOM, never on size; no threshold, no budget, no redesign.
 *
 * Provenance: H-7 advisory deltas ~4.45 MB straight / ~7.09 MB all-curved per
 * generation (P23B.6 S6 final-evidence §routing); this test re-reads the same
 * two fixtures with a bounded edit/evict/clear sweep and reports what it finds.
 */
import { describe, expect, it } from 'vitest';

import { buildP23BMatrixFixture, P23B_MATRIX_SPECS } from '$lib/bench/p23b-fixtures';
import { compileWallFirstLayoutGeometry } from '@portfolio/layout-core';

const FIXTURES = ['p23b-40-wall-straight-v1', 'p23b-40-wall-all-curved-v1'] as const;
const EDITS = 12;

function fixtureSpec(id: (typeof FIXTURES)[number]) {
	const spec = P23B_MATRIX_SPECS.find((entry) => entry.id === id);
	if (!spec) throw new Error(`unknown fixture ${id}`);
	return spec;
}

function gcIfAvailable(): boolean {
	const gc = (globalThis as { gc?: () => void }).gc;
	if (typeof gc === 'function') {
		gc();
		return true;
	}
	return false;
}

function heapBytes(): number {
	return process.memoryUsage().heapUsed;
}

describe('p23b.8 S2 — D8 bounded heap-retention comparison (report-only)', () => {
	for (const id of FIXTURES) {
		it(`${id}: repeated edits · eviction · clearing report deltas, fail only on error`, async () => {
			const document = buildP23BMatrixFixture(fixtureSpec(id));
			const collectedGc = gcIfAvailable();
			gcIfAvailable();
			await new Promise<void>((resolve) => setTimeout(resolve, 0));
			const start = heapBytes();

			// Repeated edits: compile the same document EDITS times (bounded).
			const generations: unknown[] = [];
			for (let index = 0; index < EDITS; index += 1) {
				generations.push(compileWallFirstLayoutGeometry(document));
			}
			gcIfAvailable();
			const afterEdits = heapBytes();

			// History eviction: keep only the newest 4 (bounded cap), drop the rest.
			const retained = generations.slice(-4);
			generations.length = 0;
			gcIfAvailable();
			const afterEviction = heapBytes();

			// Clearing: release everything.
			retained.length = 0;
			gcIfAvailable();
			const afterClear = heapBytes();

			const delta = (value: number): number => value - start;
			console.info(
				`P23B.8 S2 D8 bounded comparison — ${id} (EDITS=${EDITS}, Node ${process.version}, gc=${collectedGc}): ` +
					`afterEdits=${delta(afterEdits)}B afterEviction=${delta(afterEviction)}B afterClear=${delta(afterClear)}B ` +
					`(advisory; H-7 reference ~4.45MB straight / ~7.09MB all-curved per full-stack generation)`
			);
			// REPORT-ONLY: assert only that the sweep completed with finite
			// numbers. No size assertion, no threshold, no budget.
			for (const value of [afterEdits, afterEviction, afterClear, start]) {
				expect(Number.isFinite(value), `${id}: heap reading is finite`).toBe(true);
			}
		}, 120_000);
	}
});
