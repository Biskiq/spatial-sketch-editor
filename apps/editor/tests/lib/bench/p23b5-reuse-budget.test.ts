/**
 * P23B.5 — the reuse budget gate (owner-approved extra scope, plan §0.6).
 *
 * The DEV live readout (`$lib/editor/layout/p23b-gesture-sampling-report.ts`)
 * makes reuse visible while a drag is happening. This file makes it a GATE:
 * every time the suite runs, the shipped transient path is driven on the
 * committed fixtures and its reuse counters are compared against a committed
 * record (`…/p23b.5-caching-reuse-optimization/reuse-counter-ratchet.json`).
 *
 * WHY IT EXISTS. Reuse is proven today by bounded proofs (S2–S5) and by a
 * call-site source contract; nothing noticed a regression whose only symptom is a
 * BIGGER derivation count — e.g. a key change that raises refusals while the
 * request total stays flat, so the live readout still looks healthy.
 *
 * TWO KINDS OF CLAIM, DELIBERATELY SEPARATED:
 *
 * - INVARIANTS (below): structural properties of the store and of the shipped
 *   wiring. A violation is ALWAYS a bug and is never re-recordable. The load-
 *   bearing one is `Σ preflight misses === scope derivations`: it pins that the
 *   scope owns exactly the preflight requests and nothing else, so threading the
 *   scope into the unscoped proposal stage (which would only grow the store)
 *   fails here even though it would leave every request total unchanged.
 * - The RATCHET: the recorded per-case counts. Those numbers MAY move, but only
 *   by editing the record in the same commit with a reason, so a change is a
 *   reviewable diff rather than silent drift.
 *
 * DETERMINISTIC ONLY. No wall-clock threshold is asserted anywhere here: P23B.0
 * governs timing, its baseline carries no targets, and interaction timing is
 * advisory. The numbers below are machine-independent counts.
 *
 * NO NEW BUDGET METRIC. `BUDGETS` / `ENFORCED_BUDGET_METRICS` are untouched and
 * the checked-in `g3-baseline.json` is neither read nor re-recorded.
 *
 * The test-only observer fires inside `wallCenterlineSamples`, i.e. on a FRESH
 * DERIVE only — a hit is invisible to it by construction — so the observed
 * counts are reconciled against the store's own counters, never substituted for
 * them.
 */
import { describe, expect, it } from 'vitest';

import {
	clearWallSamplingObserverForTest,
	createWallSamplingDerivation,
	proposeWallFirstArchitectureGeometry,
	setWallSamplingObserverForTest,
	type LayoutDocumentWallFirst,
	type LayoutVec2,
	type WallSamplingDerivation
} from '@portfolio/layout-core';
import { buildP23BMatrixFixture, P23B_MATRIX_SPECS } from '$lib/bench/p23b-fixtures';
import type { LayoutArchitectureEditGesture } from '$lib/editor/layout/layout-interaction';
import {
	architectureEditProposalIntent,
	transientArchitectureEdit,
	type LayoutTransientArchitectureEdit
} from '$lib/editor/layout/layout-transient-edit';
import ratchet from '../../../../../docs/roadmap/p23b-geometry-performance/p23b.5-caching-reuse-optimization/reuse-counter-ratchet.json';

/** The fixed drag every case uses: the first Junction, three pointermoves. */
const MOVES = [0.05, 0.1, 0.15] as const;

type RatchetCase = (typeof ratchet)['cases'][number];
type Counters = RatchetCase['counters'];

/** Fresh `wallCenterlineSamples` calls made while `work` runs. */
function freshCalls(work: () => void): number {
	let calls = 0;
	setWallSamplingObserverForTest(() => {
		calls += 1;
	});
	try {
		work();
	} finally {
		clearWallSamplingObserverForTest();
	}
	return calls;
}

function matrixFixture(id: string): LayoutDocumentWallFirst {
	return buildP23BMatrixFixture(P23B_MATRIX_SPECS.find((spec) => spec.id === id)!);
}

/** The narrowed junction-move member: the one direct gesture this gate drives. */
type JunctionMoveGesture = Extract<LayoutArchitectureEditGesture, { kind: 'junction-move' }>;

/** One junction gesture, as the viewport builds it, minus the viewport. */
function junctionGesture(doc: LayoutDocumentWallFirst): JunctionMoveGesture {
	const junctionId = doc.junctions[0]!.id;
	const point = doc.junctions[0]!.point;
	return {
		kind: 'junction-move',
		pointerId: 1,
		junctionId,
		startPointer: [point[0], point[1]] as LayoutVec2,
		baselinePoint: [point[0], point[1]] as LayoutVec2,
		junctionExcludePoints: doc.junctions.map(
			(junction) => [junction.point[0], junction.point[1]] as LayoutVec2
		),
		affectedWallIds: doc.walls
			.filter((wall) => wall.startJunctionId === junctionId || wall.endJunctionId === junctionId)
			.map((wall) => wall.id),
		candidatePoint: [point[0], point[1]] as LayoutVec2,
		valid: false
	};
}

type DragRun = {
	/** Fresh sampling calls per pointermove, as the SHIPPED transient path makes them. */
	observedPerMove: number[];
	/** Fresh calls of the always-unscoped proposal stage, per pointermove. */
	proposalPerMove: number[];
	/** The rendered attempt per pointermove — the scope must not change it. */
	attempts: Array<LayoutTransientArchitectureEdit | null>;
};

/**
 * Drive one real gesture. With `sampling`, that is the shipped scoped path; with
 * no scope, it is the per-call reference the scope is measured against.
 */
function drag(doc: LayoutDocumentWallFirst, sampling?: WallSamplingDerivation): DragRun {
	const gesture = junctionGesture(doc);
	const start = [...gesture.baselinePoint] as LayoutVec2;
	const observedPerMove: number[] = [];
	const proposalPerMove: number[] = [];
	const attempts: Array<LayoutTransientArchitectureEdit | null> = [];
	for (const dx of MOVES) {
		gesture.candidatePoint = [start[0] + dx, start[1]];
		const intent = architectureEditProposalIntent(gesture);
		// The proposal is unscoped BY DESIGN (fresh centrelines per intent, whose
		// inputs never repeat), so its share is measured on its own call.
		proposalPerMove.push(freshCalls(() => void proposeWallFirstArchitectureGeometry(doc, intent)));
		let attempt: LayoutTransientArchitectureEdit | null = null;
		observedPerMove.push(
			freshCalls(() => {
				attempt = transientArchitectureEdit({ gesture, baseline: doc, moved: true, sampling });
			})
		);
		attempts.push(attempt);
	}
	return { observedPerMove, proposalPerMove, attempts };
}

/** The observed-preflight share: every fresh call the always-unscoped proposal did not make. */
function preflightMisses(run: DragRun): number[] {
	return run.observedPerMove.map((count, index) => count - run.proposalPerMove[index]!);
}

function sum(values: readonly number[]): number {
	return values.reduce((total, value) => total + value, 0);
}

/** The scope's counters, flattened to the recorded shape. */
function countersOf(scope: WallSamplingDerivation): Counters {
	const stats = scope.stats;
	return {
		requests: stats.derivations + stats.hits,
		derivations: stats.derivations,
		coldMisses: stats.coldMisses,
		refusals: stats.refusals,
		hits: stats.hits,
		entries: stats.entries,
		failedDerivations: stats.failedDerivations,
		cachedUndefined: stats.cachedUndefined
	};
}

type CaseRun = {
	scoped: DragRun;
	unscoped: DragRun;
	counters: Counters;
};

/** Run one case once: the scoped drag, the unscoped reference, and the counters. */
function runCase(fixtureId: string): CaseRun {
	const doc = matrixFixture(fixtureId);
	const scope = createWallSamplingDerivation();
	const scoped = drag(doc, scope);
	const unscoped = drag(doc);
	return { scoped, unscoped, counters: countersOf(scope) };
}

const RECORD_PATH =
	'docs/roadmap/p23b-geometry-performance/p23b.5-caching-reuse-optimization/reuse-counter-ratchet.json';

function recordedCase(id: string): RatchetCase {
	const found = (ratchet.cases as RatchetCase[]).find((entry) => entry.id === id);
	if (!found) throw new Error(`reuse ratchet has no case ${id}`);
	return found;
}

function curvedCase(): CaseRun {
	return runCase(recordedCase('curved-40-junction-drag').fixture);
}

describe('P23B.5 reuse budget gate — invariants (a violation is a bug, never re-recordable)', () => {
	it('the scope owns exactly the preflight requests and nothing else', () => {
		const { scoped, unscoped, counters } = curvedCase();
		const misses = preflightMisses(scoped);
		// The proposal stage is deliberately unscoped. If the scope were threaded
		// into it, its fresh derives would be counted here and this fails — while
		// every request total below would stay flat, which is why this assertion
		// is the load-bearing half of the gate.
		expect(
			scoped.proposalPerMove,
			'the proposal stage stays unscoped: the scope owns no proposal request'
		).toEqual(unscoped.proposalPerMove);
		expect(
			sum(misses),
			'the scope derivations are exactly the preflight misses'
		).toBe(counters.derivations);
		expect(counters.derivations, 'the scope derives the fixture, not nothing').toBeGreaterThan(0);
	});

	it('a scope changes how often an artefact is derived, never what the gate renders', () => {
		const { scoped, unscoped } = curvedCase();
		expect(scoped.attempts, 'the rendered attempt is unchanged by reuse').toEqual(unscoped.attempts);
	});

	it('the scope serves every preflight request: misses + hits equal the unscoped total', () => {
		const { scoped, unscoped, counters } = curvedCase();
		expect(
			counters.derivations + counters.hits,
			'the scope answers every preflight request the unscoped path makes'
		).toBe(sum(preflightMisses(unscoped)));
	});

	it('a derivation is always a cold miss or a refusal, and always adds exactly one key', () => {
		const { counters } = curvedCase();
		expect(
			counters.coldMisses + counters.refusals,
			'every derivation is attributed to a cold miss or a changed-input refusal'
		).toBe(counters.derivations);
		// A fresh derive only happens for an ABSENT key and inserts it, so the
		// store never grows by anything other than one entry per derivation.
		expect(counters.entries, 'entries are exactly the distinct derived keys').toBe(
			counters.derivations
		);
		expect(counters.failedDerivations, 'no failed derive on a valid fixture').toBe(0);
		expect(counters.cachedUndefined, 'no cached undefined is served as reuse').toBe(0);
	});

	it('the curved fixture is the reusing case: reuse is real, not a zero-hit control', () => {
		const { counters } = curvedCase();
		expect(counters.hits, 'the gesture reuses untouched Walls').toBeGreaterThan(0);
		expect(counters.coldMisses, 'every sampled Wall is derived once, cold').toBeGreaterThan(0);
	});

	it('the straight control\'s preflight samples nothing: the opportunity is curvature-scaled', () => {
		const run = runCase(recordedCase('straight-40-junction-drag').fixture);
		// The PROPOSAL still samples the Walls it rebuilds, on a straight fixture
		// too; it is the PREFLIGHT that short-circuits every line centerline, which
		// is why the scope has nothing to reuse here. Stated on the preflight share
		// rather than the raw observed total so the two cannot be conflated.
		expect(sum(preflightMisses(run.scoped)), 'a line centerline short-circuits the gate').toBe(0);
		expect(run.counters.requests, 'no request, no entry, no hit on straight walls').toBe(0);
	});

	it('a reset scope is a new gesture: it reproduces the cold-start counts exactly', () => {
		const doc = matrixFixture(recordedCase('curved-40-junction-drag').fixture);
		const scope = createWallSamplingDerivation();
		drag(doc, scope);
		const first = countersOf(scope);
		scope.reset();
		expect(scope.stats.entries, 'reset() empties the store').toBe(0);
		drag(doc, scope);
		expect(
			countersOf(scope),
			'a gesture cannot inherit another gesture\'s reuse'
		).toEqual(first);
	});
});

describe('P23B.5 reuse budget gate — the recorded ratchet (change it only by recording a reason)', () => {
	for (const recorded of ratchet.cases as RatchetCase[]) {
		it(`${recorded.id} holds its recorded request/miss/hit split`, () => {
			const run = runCase(recorded.fixture);
			const actual: RatchetCase = {
				...recorded,
				proposalRequestsPerMove: run.scoped.proposalPerMove,
				preflightMissesPerMove: preflightMisses(run.scoped),
				unscopedPreflightRequests: sum(preflightMisses(run.unscoped)),
				// The unscoped total is what the scope must reproduce; recorded above
				// so the two can never drift apart silently.
				counters: run.counters
			};
			expect(
				actual,
				`reuse counts drifted for ${recorded.id}. If the change is intended, update ${RECORD_PATH} in this commit and record why in recordedReason. If it is not, this is a reuse regression.`
			).toEqual(recorded);
		});
	}
});
