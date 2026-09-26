/**
 * P23B.7 S4 — the gesture-scoped VERDICT SET, against the frozen reference.
 *
 * WHAT THIS PROVES. The scoped path may change WHICH predicates are evaluated,
 * never the verdict they produce. So every case in the S2 frozen table is driven
 * as a THREE-MOVE GESTURE (a no-op candidate, a midpoint, then the recorded
 * intent) and each move's scoped verdict is compared against the live
 * whole-document preflight — verdict, code, message and issue order — AND against
 * the frozen entry for the recorded intent. The gesture shape matters: a single
 * call would be served by the initialization pass and prove nothing about the
 * affected-only pass, so the defect has to arrive on move 2 or 3.
 *
 * THE FALLBACK IS THE APPROVED ONE. A gesture whose initialization is not clean
 * (a baseline that already carries a failure) is served by the canonical pass on
 * EVERY move: no request is suppressed and no failure is approximated. The tests
 * assert that shape explicitly rather than silently expecting reuse everywhere.
 *
 * DETERMINISTIC CLAUSES (§7, corrected G-4): initialization once per gesture;
 * affected candidate sets re-derived from EACH move's own patch and bounded by
 * that move's conservative extent; invariant predicate evaluations zero after the
 * initialization. Nothing here asserts wall-clock or a fixed count.
 */
import { describe, expect, it } from 'vitest';

import {
	clearTopologyGateObserverForTest,
	createWallFirstArchitectureVerdictScope,
	createWallSamplingDerivation,
	preflightWallFirstArchitectureCandidate,
	setTopologyGateObserverForTest,
	wallFirstArchitectureAffectedExtent,
	type LayoutDocumentWallFirst,
	type LayoutVec2,
	type WallFirstArchitecturePreflightFailure,
	type WallFirstArchitectureProposalIntent
} from '@portfolio/layout-core';
import {
	p23b7PreflightReferenceCases,
	type P23B7PreflightReference,
	type P23B7PreflightReferenceCase
} from './p23b7-preflight-reference-cases';

type Verdict = P23B7PreflightReference;

function verdictOf(failure: WallFirstArchitecturePreflightFailure | undefined): Verdict {
	return failure
		? { status: 'known-invalid', code: failure.code, message: failure.message }
		: { status: 'pending' };
}

const MOVE_WEIGHTS = [0, 0.5, 1] as const;

function between(from: LayoutVec2, to: LayoutVec2, weight: number): LayoutVec2 {
	return [from[0] + (to[0] - from[0]) * weight, from[1] + (to[1] - from[1]) * weight];
}

function finite(point: LayoutVec2): boolean {
	return Number.isFinite(point[0]) && Number.isFinite(point[1]);
}

/**
 * Three same-target moves that END on the case's recorded intent: the no-op
 * candidate first (so a clean baseline initializes), then the midpoint, then the
 * recorded one. The middle move exists so a defect is reached by a SCOPED move
 * rather than by the initialization itself.
 */
function gestureMoves(
	document: LayoutDocumentWallFirst,
	intent: WallFirstArchitectureProposalIntent
): WallFirstArchitectureProposalIntent[] {
	if (intent.kind === 'junction-move') {
		const current = document.junctions.find((entry) => entry.id === intent.junctionId)?.point;
		if (!current || !finite(intent.point)) return [intent, intent, intent];
		return MOVE_WEIGHTS.map((weight) => ({
			kind: 'junction-move' as const,
			junctionId: intent.junctionId,
			point: between(current, intent.point, weight)
		}));
	}
	if (intent.kind === 'curve-control-move') {
		const wall = document.walls.find((entry) => entry.id === intent.wallId);
		const current =
			wall && wall.centerline.kind === 'cubic-chain'
				? wall.centerline.knots.find((knot) => knot.id === intent.knotId)?.point
				: undefined;
		if (!current || !finite(intent.point)) return [intent, intent, intent];
		return MOVE_WEIGHTS.map((weight) => ({
			kind: 'curve-control-move' as const,
			wallId: intent.wallId,
			knotId: intent.knotId,
			point: between(current, intent.point, weight)
		}));
	}
	if (intent.kind === 'wall-move') {
		if (!finite(intent.delta)) return [intent, intent, intent];
		return MOVE_WEIGHTS.map((weight) => ({
			kind: 'wall-move' as const,
			wallId: intent.wallId,
			delta: [intent.delta[0] * weight, intent.delta[1] * weight] as LayoutVec2
		}));
	}
	// `wall-bend` needs the grab point resolved at pointer-down, which a document
	// does not carry; the frozen table contains none, so the recorded intent is
	// used as-is (a same-target gesture whose first move cannot be a no-op).
	return [intent, intent, intent];
}

function junctionMove(
	document: LayoutDocumentWallFirst,
	junctionId: string,
	delta: LayoutVec2
): WallFirstArchitectureProposalIntent {
	const junction = document.junctions.find((entry) => entry.id === junctionId);
	if (!junction) throw new Error(`unknown junction ${junctionId}`);
	return {
		kind: 'junction-move',
		junctionId,
		point: [junction.point[0] + delta[0], junction.point[1] + delta[1]]
	};
}

function referenceCase(id: string): P23B7PreflightReferenceCase {
	const row = p23b7PreflightReferenceCases().find((entry) => entry.id === id);
	if (!row) throw new Error(`unknown reference case ${id}`);
	return row;
}

describe('P23B.7 S4 — OR-3 differential against S2\'s frozen reference', () => {
	const rows = p23b7PreflightReferenceCases();

	it('returns the whole-document verdict on every move of every case', () => {
		for (const row of rows) {
			const sampling = createWallSamplingDerivation();
			const scope = createWallFirstArchitectureVerdictScope(row.document);
			const moves = gestureMoves(row.document, row.intent);
			const observed: Verdict[] = [];
			for (const intent of moves) {
				const whole = verdictOf(preflightWallFirstArchitectureCandidate(row.document, intent));
				const scoped = verdictOf(scope.verdict(row.document, intent, sampling));
				expect(scoped, `${row.id}: the scoped move differs from the whole-document verdict`).toEqual(whole);
				observed.push(scoped);
			}
			// The gesture ends on the recorded intent, so the scoped path (or its
			// canonical fallback) is what must reproduce the frozen entry — including
			// the multi-defect issue-order row.
			expect(observed.at(-1), `${row.id}: the frozen entry`).toEqual(row.expected);
			// And the freeze itself still holds on the live whole-document path, so a
			// simultaneous drift could not let both sides move together.
			expect(
				verdictOf(preflightWallFirstArchitectureCandidate(row.document, row.intent)),
				`${row.id}: the live reference`
			).toEqual(row.expected);
		}
	});

	it('scopes clean-baseline gestures and keeps the canonical fallback for the rest', () => {
		let scopedGestures = 0;
		for (const row of rows) {
			const scope = createWallFirstArchitectureVerdictScope(row.document);
			const sampling = createWallSamplingDerivation();
			const moves = gestureMoves(row.document, row.intent);
			const first = moves[0]!;
			const derivable = wallFirstArchitectureAffectedExtent(row.document, first) !== undefined;
			const firstClean =
				derivable && preflightWallFirstArchitectureCandidate(row.document, first) === undefined;
			for (const intent of moves) scope.verdict(row.document, intent, sampling);
			if (!derivable) {
				expect(scope.stats, `${row.id}: an underivable intent never enters a pass`).toMatchObject({
					initializations: 0,
					canonical: 0,
					scoped: 0
				});
				continue;
			}
			if (firstClean) {
				expect(scope.stats, `${row.id}: a clean gesture initializes once and scopes the rest`).toMatchObject({
					initializations: 1,
					canonical: 1,
					scoped: moves.length - 1
				});
				scopedGestures += 1;
			} else {
				// R-2: a baseline that already fails gets no reused verdict at all —
				// every move goes through the canonical pass, so no request is
				// suppressed and no failure is approximated.
				expect(scope.stats, `${row.id}: a non-clean baseline stays canonical`).toMatchObject({
					initializations: 0,
					canonical: moves.length,
					scoped: 0
				});
			}
		}
		expect(scopedGestures, 'the differential must actually exercise the scoped path').toBeGreaterThanOrEqual(5);
	});

	it('OR-3b (F-C3): an inter-Room crossing introduced mid-gesture is refused BY the scoped pass', () => {
		const row = referenceCase('b-crossroom-edited-into-crossing');
		const document = row.document;
		const scope = createWallFirstArchitectureVerdictScope(document);
		const sampling = createWallSamplingDerivation();
		const moves = gestureMoves(document, row.intent);
		expect(verdictOf(scope.verdict(document, moves[0]!, sampling)), 'the no-op candidate initializes').toEqual({
			status: 'pending'
		});
		expect(scope.stats).toMatchObject({ initializations: 1, canonical: 1, scoped: 0 });
		const observed = verdictOf(scope.verdict(document, moves[2]!, sampling));
		// The counter is the non-vacuity proof: the refusal came from the affected-only
		// pass, not from the canonical fallback.
		expect(scope.stats).toMatchObject({ initializations: 1, canonical: 1, scoped: 1 });
		expect(observed).toEqual(row.expected);
		expect(observed).toEqual(
			verdictOf(preflightWallFirstArchitectureCandidate(document, moves[2]!))
		);
	});

	it('OR-3 issue order: a scoped move carrying a shadowed zero-length Wall reports the Junction stage first', () => {
		const row = referenceCase('d-zero-length-wall-is-shadowed-by-the-junction-stage');
		const document = row.document;
		const moves = gestureMoves(document, row.intent);
		const move = moves.at(-1)!;
		if (move.kind !== 'junction-move') throw new Error('the ordering case must be a junction move');
		// The later defect is genuinely present: the moved Junction lands exactly on
		// a2, so w-east's effective length is zero in this candidate.
		const a2 = document.junctions.find((entry) => entry.id === 'a2')!;
		expect(move.point, 'the shadowed zero-length Wall really exists in this candidate').toEqual(a2.point);
		const extent = wallFirstArchitectureAffectedExtent(document, move)!;
		expect(extent.wallIds, 'the shadowed Wall is inside the move\'s own extent').toContain('w-east');
		const scope = createWallFirstArchitectureVerdictScope(document);
		const sampling = createWallSamplingDerivation();
		expect(verdictOf(scope.verdict(document, moves[0]!, sampling))).toEqual({ status: 'pending' });
		const observed = verdictOf(scope.verdict(document, move, sampling));
		expect(scope.stats.scoped, 'the ordered verdict came from the scoped pass').toBe(1);
		expect(observed).toEqual(row.expected);
		expect(observed).toEqual(verdictOf(preflightWallFirstArchitectureCandidate(document, move)));
	});
});

describe('P23B.7 S4 — sample-request continuity at the core (the approved fallback)', () => {
	it('retains every request: a scoped move samples every Wall the canonical pass would', () => {
		const row = referenceCase('a-matrix-12-target-curved');
		const document = row.document;
		const moves = gestureMoves(document, row.intent);
		const scope = createWallFirstArchitectureVerdictScope(document);
		const sampling = createWallSamplingDerivation();
		expect(verdictOf(scope.verdict(document, moves[0]!, sampling))).toEqual({ status: 'pending' });
		expect(scope.stats.initializations).toBe(1);
		const sampledWallsPerCall: number[] = [];
		setTopologyGateObserverForTest((walls) => {
			sampledWallsPerCall.push(walls.length);
		});
		try {
			verdictOf(preflightWallFirstArchitectureCandidate(document, moves[2]!));
			verdictOf(scope.verdict(document, moves[2]!, sampling));
		} finally {
			clearTopologyGateObserverForTest();
		}
		const [canonical, scoped] = sampledWallsPerCall;
		expect(sampledWallsPerCall, 'one crossing call per pass').toHaveLength(2);
		expect(canonical).toBeGreaterThan(0);
		// The crossing authority samples every Wall BEFORE its pair loop, so scoping
		// the pair loop removes no request: the approved fallback, asserted here
		// rather than assumed (the P23B.5 ratchet owns the end-to-end counts).
		expect(scoped, 'the scoped pass issues exactly the canonical request set').toBe(canonical);
		expect(scoped).toBe(document.walls.length);
	});
});

describe('P23B.7 S4 — OR-8 gesture lifecycle', () => {
	it('a fresh scope per gesture answers its first move from the canonical pass', () => {
		const document = referenceCase('or8-refusal').document;
		const first = createWallFirstArchitectureVerdictScope(document);
		expect(verdictOf(first.verdict(document, junctionMove(document, 'a3', [0.05, 0])))).toEqual({
			status: 'pending'
		});
		expect(first.stats).toMatchObject({ initializations: 1, canonical: 1, scoped: 0 });
		// The next gesture's scope is a NEW object, as the viewport builds it: its
		// first move re-derives canonically instead of inheriting anything.
		const second = createWallFirstArchitectureVerdictScope(document);
		const refusal = verdictOf(second.verdict(document, junctionMove(document, 'a2', [0, -8])));
		expect(second.stats).toMatchObject({ initializations: 0, canonical: 1, scoped: 0 });
		expect(refusal).toEqual(verdictOf(preflightWallFirstArchitectureCandidate(document, junctionMove(document, 'a2', [0, -8]))));
	});

	it('a leaked scope re-initializes on a different target instead of reusing a verdict', () => {
		const document = referenceCase('or8-refusal').document;
		const scope = createWallFirstArchitectureVerdictScope(document);
		expect(verdictOf(scope.verdict(document, junctionMove(document, 'a3', [0.05, 0])))).toEqual({
			status: 'pending'
		});
		// Target changes: the a3 initialization may not answer for a2.
		const refusal = junctionMove(document, 'a2', [0, -8]);
		expect(verdictOf(scope.verdict(document, refusal))).toEqual(
			verdictOf(preflightWallFirstArchitectureCandidate(document, refusal))
		);
		expect(scope.stats).toMatchObject({ initializations: 1, canonical: 2, scoped: 0 });
		// Re-initializing on a clean a2 candidate is followed by a genuinely scoped
		// refusal for the SAME target — and it equals the whole-document verdict.
		expect(verdictOf(scope.verdict(document, junctionMove(document, 'a2', [0.02, 0])))).toEqual({
			status: 'pending'
		});
		expect(scope.stats).toMatchObject({ initializations: 2, canonical: 3, scoped: 0 });
		expect(verdictOf(scope.verdict(document, refusal))).toEqual(
			verdictOf(preflightWallFirstArchitectureCandidate(document, refusal))
		);
		expect(scope.stats.scoped).toBe(1);
	});

	it('reset() forgets the initialization; the next move is canonical again', () => {
		const document = referenceCase('or8-refusal').document;
		const scope = createWallFirstArchitectureVerdictScope(document);
		scope.verdict(document, junctionMove(document, 'a3', [0.05, 0]));
		expect(scope.stats).toMatchObject({ initializations: 1, canonical: 1 });
		scope.reset();
		scope.verdict(document, junctionMove(document, 'a3', [0.05, 0]));
		expect(scope.stats).toMatchObject({ initializations: 2, canonical: 2, scoped: 0 });
	});

	it('interleaved gestures keep their own verdicts', () => {
		const document = referenceCase('or8-refusal').document;
		const left = createWallFirstArchitectureVerdictScope(document);
		const right = createWallFirstArchitectureVerdictScope(document);
		left.verdict(document, junctionMove(document, 'a3', [0.05, 0]));
		// A defect target in the other gesture: a1 lands on a2, making w-east
		// zero-length and the Junction points coincident.
		const defect = junctionMove(document, 'a1', [0, 8]);
		right.verdict(document, junctionMove(document, 'a1', [0.02, 0]));
		expect(verdictOf(left.verdict(document, junctionMove(document, 'a3', [0.1, 0])))).toEqual(
			verdictOf(preflightWallFirstArchitectureCandidate(document, junctionMove(document, 'a3', [0.1, 0])))
		);
		expect(verdictOf(right.verdict(document, defect))).toEqual(
			verdictOf(preflightWallFirstArchitectureCandidate(document, defect))
		);
		expect(left.stats).toMatchObject({ initializations: 1, scoped: 1 });
		expect(right.stats).toMatchObject({ initializations: 1, scoped: 1 });
	});

	it('no verdict survives a refusal into the next gesture', () => {
		const document = referenceCase('or8-refusal').document;
		const refused = createWallFirstArchitectureVerdictScope(document);
		refused.verdict(document, junctionMove(document, 'a3', [0.05, 0]));
		const defect = { kind: 'junction-move' as const, junctionId: 'a3', point: [0, 0] as LayoutVec2 };
		expect(verdictOf(refused.verdict(document, defect))).toEqual(
			verdictOf(preflightWallFirstArchitectureCandidate(document, defect))
		);
		expect(refused.stats.scoped).toBe(1);
		// The next gesture (fresh scope, as the viewport builds it) re-derives from
		// the frozen baseline: no scoped verdict from the refused gesture can answer.
		const next = createWallFirstArchitectureVerdictScope(document);
		expect(verdictOf(next.verdict(document, defect))).toEqual(
			verdictOf(preflightWallFirstArchitectureCandidate(document, defect))
		);
		expect(next.stats).toMatchObject({ initializations: 0, canonical: 1, scoped: 0 });
	});
});

describe('P23B.7 S4 — DETERMINISTIC: initialization once, affected-only after', () => {
	it('(i) initializes once per gesture on a small and a large fixture alike', () => {
		for (const id of ['a-matrix-12-target-curved', 'a-matrix-40-target-curved']) {
			const row = referenceCase(id);
			const scope = createWallFirstArchitectureVerdictScope(row.document);
			const sampling = createWallSamplingDerivation();
			const moves = gestureMoves(row.document, row.intent);
			for (const intent of moves) scope.verdict(row.document, intent, sampling);
			expect(scope.stats, `${id}: one initialization, then affected-only`).toMatchObject({
				initializations: 1,
				canonical: 1,
				scoped: moves.length - 1
			});
		}
	});

	it('(ii) moves 2..k evaluate exactly that move\'s affected extent, and no invariant predicate repeats', () => {
		const row = referenceCase('a-matrix-40-target-curved');
		const document = row.document;
		const scope = createWallFirstArchitectureVerdictScope(document);
		const sampling = createWallSamplingDerivation();
		const moves = gestureMoves(document, row.intent);
		for (const [index, intent] of moves.entries()) {
			const prior = { ...scope.stats, affected: { ...scope.stats.affected } };
			scope.verdict(document, intent, sampling);
			if (index === 0) {
				// The initialization is the whole-document pass: it counts no affected
				// subjects, and it must never repeat.
				expect(scope.stats).toMatchObject({ initializations: 1, canonical: 1, scoped: 0 });
				continue;
			}
			const extent = wallFirstArchitectureAffectedExtent(document, intent)!;
			expect(scope.stats.initializations, 'no second initialization').toBe(prior.initializations);
			expect(scope.stats.canonical, 'no whole-document pass after the initialization').toBe(prior.canonical);
			expect(scope.stats.scoped).toBe(prior.scoped + 1);
			// What the pass evaluated IS this move's own extent — not a remembered
			// superset, and never the whole document.
			expect(scope.stats.affected.walls - prior.affected.walls).toBe(extent.wallIds.length);
			expect(scope.stats.affected.wallPairs - prior.affected.wallPairs).toBe(extent.wallPairs.length);
			expect(scope.stats.affected.junctionPairs - prior.affected.junctionPairs).toBe(
				extent.junctionPairs.length
			);
		}
		expect(scope.stats.affected.walls, 'the moved Walls are a subset of the document').toBeLessThan(
			document.walls.length
		);
	});

	it('(iii) re-derives the affected set from each move\'s own patch, so a later move enters extents the earlier one did not', () => {
		const document = referenceCase('or8-refusal').document;
		const scope = createWallFirstArchitectureVerdictScope(document);
		const sampling = createWallSamplingDerivation();
		const onA1 = junctionMove(document, 'a1', [0.02, 0]);
		const onA3 = junctionMove(document, 'a3', [0.02, 0]);
		const a1Extent = wallFirstArchitectureAffectedExtent(document, onA1)!;
		const a3Extent = wallFirstArchitectureAffectedExtent(document, onA3)!;
		expect(a1Extent.wallIds, 'different targets admit different relationships').not.toEqual(a3Extent.wallIds);
		scope.verdict(document, onA1, sampling);
		scope.verdict(document, onA3, sampling);
		// The target change re-initializes, and each initialization was derived from
		// ITS OWN patch: both were computed, neither was reused from the other.
		expect(scope.stats).toMatchObject({ initializations: 2, canonical: 2, scoped: 0 });
		const later = junctionMove(document, 'a3', [0.04, 0]);
		const prior = { ...scope.stats.affected };
		scope.verdict(document, later, sampling);
		const laterExtent = wallFirstArchitectureAffectedExtent(document, later)!;
		expect(scope.stats.affected.walls - prior.walls).toBe(laterExtent.wallIds.length);
		expect(scope.stats.affected.wallPairs - prior.wallPairs).toBe(laterExtent.wallPairs.length);
		expect(scope.stats.affected.junctionPairs - prior.junctionPairs).toBe(laterExtent.junctionPairs.length);
	});
});
