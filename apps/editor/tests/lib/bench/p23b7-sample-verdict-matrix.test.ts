/**
 * P23B.7 S4 §0.8.2 — the SAMPLE / VERDICT four-cell matrix, ONE AXIS AT A TIME.
 *
 * A single run can attribute a change to neither sample reuse nor verdict reuse,
 * so this file drives the committed ratchet fixtures through the SHIPPED
 * transient path in four cells:
 *
 *   AXIS A — sample reuse ON/OFF with the VERDICT MODE HELD FIXED:
 *     · sampling ON, verdict whole-document   (the retained pre-S4 verdict mode)
 *     · sampling ON, verdict scoped           (the shipped mode)
 *     The sampling-ENABLED cell owns `derivations`, `hits` and
 *     `preflightMissesPerMove`; the sampling-DISABLED cell owns
 *     `unscopedPreflightRequests` alone, and a scope miss is never sourced from it.
 *   AXIS B — verdict OFF/ON with the SAMPLE SCOPE HELD FIXED (ON and OFF):
 *     the oracle is verdict + code + message equality plus the rendered-attempt
 *     equality — never the ratchet's counters, which cannot see a verdict change.
 *
 * SUPPRESSED REQUESTS ARE ACCOUNTED, NOT ASSUMED AWAY. Verdict reuse changes only
 * WHICH PREDICATES are evaluated; the crossing authority still samples every Wall
 * before its pair loop, so both verdict modes issue the same per-move requests.
 * The accounting here is the per-move fresh-call series plus the store's own
 * counters, both equal — i.e. the suppressed set is EMPTY by measurement. That is
 * the approved fallback, and it is why `reuseRatchetCaseOf(scoped)` must equal the
 * committed ratchet byte-for-byte (no re-record for this slice).
 *
 * Both cells are re-derived at the S4 revision through the SAME production
 * preflight — the sampling-disabled cell is never a retained pre-S4 path.
 */
import { describe, expect, it } from 'vitest';
import ratchet from '../../../../../docs/roadmap/p23b-geometry-performance/p23b.5-caching-reuse-optimization/reuse-counter-ratchet.json';
import {
	measureReuseRatchetCase,
	reuseRatchetCaseOf,
	reuseRatchetInvariantViolations,
	type ReuseRatchetCase,
	type ReuseRatchetMeasurement
} from '$lib/bench/p23b5-reuse-ratchet';

const recordedCases = ratchet.cases as ReuseRatchetCase[];

/** One measurement per (case, verdict mode): the drags are the expensive part. */
const measurements = new Map<string, ReuseRatchetMeasurement>();
function measure(recorded: ReuseRatchetCase, verdict: 'scoped' | 'whole-document'): ReuseRatchetMeasurement {
	const key = `${recorded.id}|${verdict}`;
	const existing = measurements.get(key);
	if (existing) return existing;
	const measured = measureReuseRatchetCase(recorded, { verdict });
	measurements.set(key, measured);
	return measured;
}

type Verdict = { status: 'known-invalid' | 'pending'; code?: string; message?: string };

function verdictsOf(
	attempts: ReuseRatchetMeasurement['attempts']['scoped']
): Verdict[] {
	return attempts.map((attempt) => {
		if (!attempt) return { status: 'pending' as const };
		if (attempt.failure) {
			return { status: 'known-invalid' as const, code: attempt.failure.code, message: attempt.failure.message };
		}
		return { status: attempt.status };
	});
}

describe('P23B.7 S4 — Axis A: verdict reuse removes no sample request', () => {
	for (const recorded of recordedCases) {
		it(`${recorded.id}: the scoped verdict mode changes no sample counter`, () => {
			const verdictOn = measure(recorded, 'scoped');
			const verdictOff = measure(recorded, 'whole-document');
			// Non-vacuity: the scoped path really served this drag (one clean
			// initialization, then affected-only moves). Without this, equal counters
			// could just mean "nothing scoped ran".
			expect(verdictOn.verdictStats, 'the shipped drag runs the verdict scope').not.toBeNull();
			expect(verdictOn.verdictStats!.initializations).toBe(1);
			expect(verdictOn.verdictStats!.scoped).toBe(recorded.moves - 1);
			expect(verdictOn.verdictStats!.canonical).toBe(1);
			// With the verdict mode held fixed, EVERY absolute invariant holds on its
			// own — in both modes. A violation is a bug, never a re-record.
			expect(reuseRatchetInvariantViolations([verdictOn]), 'verdict ON').toEqual([]);
			expect(reuseRatchetInvariantViolations([verdictOff]), 'verdict OFF').toEqual([]);
			// The same requests, measured three ways: the sampling-enabled scope's
			// per-move misses, its counters, and the sampling-disabled reference.
			expect(verdictOn.preflightMissesPerMove).toEqual(verdictOff.preflightMissesPerMove);
			expect(verdictOn.counters).toEqual(verdictOff.counters);
			expect(verdictOn.unscopedPreflightRequests).toEqual(verdictOff.unscopedPreflightRequests);
			// The sampling-disabled cell owns `unscopedPreflightRequests` alone, and it
			// still reconciles against the scope's own counters.
			expect(verdictOn.counters.derivations + verdictOn.counters.hits).toBe(
				verdictOn.unscopedPreflightRequests
			);
			// Production reproduces the committed ratchet byte-for-byte through the
			// verdict-scoped path: retaining the requests is the approved fallback and
			// needs no `reuse:record`.
			expect(reuseRatchetCaseOf(verdictOn)).toEqual(recorded);
		});
	}
});

describe('P23B.7 S4 — Axis B: the verdict agrees with sampling held fixed, both ways', () => {
	for (const recorded of recordedCases) {
		it(`${recorded.id}: verdict OFF/ON and sampling ON/OFF observe the same verdicts`, () => {
			const on = measure(recorded, 'scoped');
			const off = measure(recorded, 'whole-document');
			// Sampling held fixed ON: the scoped verdict set and the whole-document
			// mode agree move by move (code and message, not just status).
			expect(verdictsOf(on.attempts.scoped)).toEqual(verdictsOf(off.attempts.scoped));
			// Sampling held fixed OFF: same.
			expect(verdictsOf(on.attempts.unscoped)).toEqual(verdictsOf(off.attempts.unscoped));
			// Verdict held fixed ON: sampling ON and OFF observe the same verdicts...
			expect(verdictsOf(on.attempts.scoped)).toEqual(verdictsOf(on.attempts.unscoped));
			// ...and render byte-identical attempts (the rendered-attempt equality).
			expect(on.attempts.scoped).toEqual(on.attempts.unscoped);
		});
	}
});

describe('P23B.7 S4 — suppressed-request accounting', () => {
	it('names the requests verdict reuse removes, move by move: none', () => {
		for (const recorded of recordedCases) {
			const on = measure(recorded, 'scoped');
			const off = measure(recorded, 'whole-document');
			// The per-move fresh-call series is the request accounting a reader can
			// check: one number per pointermove, in both verdict modes. A request the
			// scoped pass dropped would lower exactly one entry. Nothing is dropped.
			expect(on.observedPerMove, `${recorded.id}: per-move requests`).toEqual(off.observedPerMove);
		}
	});
});
