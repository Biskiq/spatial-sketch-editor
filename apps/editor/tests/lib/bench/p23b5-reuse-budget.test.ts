/**
 * P23B.5 — the reuse budget gate (owner-approved extra scope, plan §0.6).
 *
 * The DEV live readout (`$lib/editor/layout/p23b-gesture-sampling-report.ts`)
 * makes reuse visible while a drag is happening. This file makes it a GATE:
 * every run drives the shipped transient path on the committed fixtures and
 * compares it against a committed record
 * (`…/p23b.5-caching-reuse-optimization/reuse-counter-ratchet.json`).
 *
 * WHY IT EXISTS. Reuse was proven by bounded proofs (S2–S5) and by a call-site
 * source contract, but nothing failed when it DRIFTED — e.g. a key change that
 * raises refusals while the request total stays flat, leaving the live readout
 * looking healthy.
 *
 * THE MEASUREMENT IS SHARED. The runner and the invariant checker live in
 * `$lib/bench/p23b5-reuse-ratchet.ts`, which the `reuse:record` CLI also uses, so
 * a re-record can never bless a different measurement than the one checked here.
 * The checker is the same list the recorder refuses to write against.
 *
 * TWO KINDS OF CLAIM, DELIBERATELY SEPARATED:
 *
 * - INVARIANTS: structural properties of the store and of the shipped wiring. A
 *   violation is ALWAYS a bug and is never re-recordable. The load-bearing one is
 *   `Σ preflight misses === scope derivations`: it pins that the scope owns
 *   exactly the preflight requests and nothing else, so threading the scope into
 *   the unscoped proposal stage (which would only grow the store) fails here even
 *   though it would leave every request total unchanged.
 * - The RATCHET: the recorded per-case counts. Those numbers MAY move, but only
 *   through `npm run reuse:record` with a recorded reason, so a change is a
 *   reviewable diff rather than silent drift.
 *
 * DETERMINISTIC ONLY. No wall-clock threshold is asserted anywhere here: P23B.0
 * governs timing, its baseline carries no targets, and interaction timing is
 * advisory. Every number below is machine-independent.
 *
 * NO NEW BUDGET METRIC. `BUDGETS` / `ENFORCED_BUDGET_METRICS` are untouched and
 * the checked-in `g3-baseline.json` is neither read nor re-recorded.
 */
import { describe, expect, it } from 'vitest';
import ratchet from '../../../../../docs/roadmap/p23b-geometry-performance/p23b.5-caching-reuse-optimization/reuse-counter-ratchet.json';
import { createWallSamplingDerivation } from '@portfolio/layout-core';
import {
	REUSE_RATCHET_MOVES,
	measureReuseRatchetCase,
	reuseRatchetCaseOf,
	reuseRatchetInvariantViolations,
	type ReuseRatchetCase,
	type ReuseRatchetMeasurement
} from '$lib/bench/p23b5-reuse-ratchet';

const RECORD_PATH =
	'docs/roadmap/p23b-geometry-performance/p23b.5-caching-reuse-optimization/reuse-counter-ratchet.json';

const recordedCases = ratchet.cases as ReuseRatchetCase[];

/** One measurement per case, shared by every test in this file. */
const measurements = new Map<string, ReuseRatchetMeasurement>();
function measure(recorded: ReuseRatchetCase): ReuseRatchetMeasurement {
	const existing = measurements.get(recorded.id);
	if (existing) return existing;
	const measured = measureReuseRatchetCase(recorded);
	measurements.set(recorded.id, measured);
	return measured;
}

function recordedCase(id: string): ReuseRatchetCase {
	const found = recordedCases.find((entry) => entry.id === id);
	if (!found) throw new Error(`reuse ratchet has no case ${id}`);
	return found;
}

describe('P23B.5 reuse budget gate — invariants (a violation is a bug, never re-recordable)', () => {
	it('violates no absolute invariant on any recorded case', () => {
		// Each problem string names the claim that broke, so a failure reads like
		// "the scope owns exactly the preflight requests and nothing else — 44
		// preflight misses vs 50 scope derivations" rather than a bare diff.
		expect(reuseRatchetInvariantViolations(recordedCases.map(measure))).toEqual([]);
	});

	it('measures the reusing case rather than a vacuous one', () => {
		const { counters } = measure(recordedCase('curved-40-junction-drag'));
		expect(counters.hits, 'the gesture reuses untouched Walls').toBeGreaterThan(0);
		expect(counters.coldMisses, 'every sampled Wall is derived once, cold').toBeGreaterThan(0);
	});

	it('a reset scope is a new gesture: it reproduces the cold-start counts exactly', () => {
		const recorded = recordedCase('curved-40-junction-drag');
		const scope = createWallSamplingDerivation();
		const first = measureReuseRatchetCase(recorded, { sampling: scope });
		scope.reset();
		expect(scope.stats.entries, 'reset() empties the store').toBe(0);
		const second = measureReuseRatchetCase(recorded, { sampling: scope });
		expect(
			second.counters,
			"a gesture cannot inherit another gesture's reuse"
		).toEqual(first.counters);
	});
});

describe('P23B.5 reuse budget gate — the recorded ratchet (change it only with a recorded reason)', () => {
	for (const recorded of recordedCases) {
		it(`${recorded.id} holds its recorded request/miss/hit split`, () => {
			expect(
				reuseRatchetCaseOf(measure(recorded)),
				`reuse counts drifted for ${recorded.id}. If the change is intended, run \`npm run reuse:record -w @portfolio/editor -- --reason "…"\` (after committing the change, so the tree is clean). If it is not, this is a reuse regression. Record: ${RECORD_PATH}.`
			).toEqual(recorded);
		});
	}

	it('records the drag the gate actually drives', () => {
		for (const recorded of recordedCases) {
			expect(recorded.moves, `${recorded.id} moves`).toBe(REUSE_RATCHET_MOVES.length);
			expect(recorded.preflightMissesPerMove.length, `${recorded.id} miss series`).toBe(
				REUSE_RATCHET_MOVES.length
			);
		}
	});
});
