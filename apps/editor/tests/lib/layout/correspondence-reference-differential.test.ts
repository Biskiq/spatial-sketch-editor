/**
 * P23B.11 S3 — the M-1 pair short-circuits, proved against the S2 freeze.
 *
 * WHAT THIS FILE IS. S3 landed M-1 in `buildCorrespondenceComponents`: the pairs
 * that can never union are now removed BEFORE their geometry is evaluated —
 * (a) `unionAuthorized` first (a pure component-label comparison, the same
 * decision today's loop reaches only after paying for the predicates), then
 * (b) an inflated-box prune that fires only when BOTH merge conditions are
 * impossible, then (c) containment before the overlap predicate, with the
 * containment CALL itself skipped when the witness's own box proves it cannot be
 * strictly inside the face. Each saving is EXACT: every skip is justified by the
 * predicate it removes, so the component output and the reconciliation outcome
 * must be untouched. This file is the whole-table half of that proof, and it
 * reads the plan's three obligations together:
 *
 *   OR-1  the frozen rows (`p23b11-correspondence-reference.ts`) re-derived on
 *         the SHIPPED path — including the CONNECTED rows (h), mandatory here;
 *   OR-2  filter neutrality: the SAME rows re-derived with the test-only bypass
 *         that restores today's evaluation order (geometry before authorization,
 *         both predicates for every pair);
 *   OR-6  the count oracle: cross-group geometry evaluations ZERO for EVERY case
 *         and operation, same-group counts bounded by the frozen reference, and
 *         the exact accounting that says WHERE each avoided call went.
 *
 * WHY IT IS IN THE HEAVY LANE (plan §7.6 area 1). The `beforeAll` below runs the
 * whole 44-case table TWICE — once per mode — so this file costs about 6.2 s of
 * the fast lane's 13.8 s. It is whole-table correctness, not iteration
 * feedback: `correspondence-prune-neutrality.test.ts` holds the cheap,
 * self-contained adversarial rows that need no table at all, and the two halves
 * read the same freeze.
 *
 * WHY THE GLOBAL FLAG IS SAFE HERE. `disableCorrespondenceShortCircuitsForTest`
 * and the observer are the P23B.4 pattern: opt-in, test-only, never persisted,
 * and unset changes nothing at all. Vitest isolates test files, so the module
 * state below is this file's own; `afterEach` clears it anyway.
 *
 * WHAT "EQUAL" MEANS, and why the frozen counts still match. The freeze carries
 * `insideEvaluations`/`overlapEvaluations` = pairs — the number TODAY's loop
 * performed — and those fields are a property of the case (both predicates ran
 * for every pair), not a live measurement. The optimized path is therefore
 * compared on the whole frozen row (components, ordering, lineage, retired ids,
 * Rooms, document digest) with those baseline fields UNCHANGED, and the counts
 * that actually moved are asserted separately from the observer. That is why the
 * S2 test stays green after S3: it is one half of this differential.
 */
import { afterEach, beforeAll, describe, expect, it } from 'vitest';

import {
	clearCorrespondenceObserverForTest,
	disableCorrespondenceShortCircuitsForTest,
	setCorrespondenceObserverForTest,
	type ComponentLineage,
	type CorrespondenceObservation
} from '@portfolio/layout-core';

import {
	analyzeCorrespondenceCase,
	freezeAnalysis,
	P23B11_CORRESPONDENCE_CASES,
	type P23B11FrozenCase
} from './p23b11-correspondence-cases';
import { P23B11_OR1_REFERENCE } from './p23b11-correspondence-reference';

const frozenById = new Map(P23B11_OR1_REFERENCE.map((row) => [row.id, row]));

/** One whole-table run in one mode, with the observer's per-case reports. */
type TableRun = {
	mode: CorrespondenceObservation['mode'];
	rows: P23B11FrozenCase[];
	/** The pass observations per case, in table order (planner pass + rebuilt pass). */
	observations: CorrespondenceObservation[][];
	rowsByCase: Map<string, P23B11FrozenCase>;
};

function runTable(mode: CorrespondenceObservation['mode']): TableRun {
	const rows: P23B11FrozenCase[] = [];
	const observations: CorrespondenceObservation[][] = [];
	disableCorrespondenceShortCircuitsForTest(mode === 'exhaustive');
	try {
		for (const entry of P23B11_CORRESPONDENCE_CASES) {
			const collected: CorrespondenceObservation[] = [];
			setCorrespondenceObserverForTest((observation) => collected.push(observation));
			try {
				rows.push(freezeAnalysis(analyzeCorrespondenceCase(entry)));
			} finally {
				clearCorrespondenceObserverForTest();
			}
			observations.push(collected);
		}
	} finally {
		disableCorrespondenceShortCircuitsForTest(false);
	}
	return {
		mode,
		rows,
		observations,
		rowsByCase: new Map(rows.map((row) => [row.id, row]))
	};
}

let shipped: TableRun;
let exhaustive: TableRun;

beforeAll(() => {
	shipped = runTable('short-circuit');
	exhaustive = runTable('exhaustive');
}, 300000);

afterEach(() => {
	clearCorrespondenceObserverForTest();
	disableCorrespondenceShortCircuitsForTest(false);
});

/** Component membership only — the pair decisions, independent of ordering. */
function componentKeyset(components: readonly ComponentLineage[]): string[] {
	return components
		.map(
			(component) =>
				`${[...component.candidateFaceKeys].sort().join('|')}=>${[
					...component.predecessorRoomIds
				]
					.sort()
					.join('|')}`
		)
		.sort();
}

/**
 * The accounting identities every observation must obey, per mode. In
 * short-circuit mode the reduction identity names WHERE the avoided calls went:
 * `2*pairs` is today's evaluation count, and every call the pass did not make is
 * exactly a denied pair, a pruned pair, an absent-evidence pair (two calls each),
 * a bounds-skipped containment call (one), or a containment admission that made
 * the overlap call unnecessary (one). Exhaustive mode pays for everything instead,
 * and its admission counters are what prove a D-12 denial was preceded by real
 * geometry.
 */
function expectAccounting(observation: CorrespondenceObservation): void {
	expect(
		observation.sameGroupPairs + observation.crossGroupPairs + observation.undefinedPairs
	).toBe(observation.pairs);
	expect(
		observation.identitySettled +
			observation.authorizationSkips +
			observation.absentEvidenceSkips +
			observation.boundsSkips +
			observation.insideSkipsByBounds +
			observation.insideCalls
	).toBe(observation.pairs);
	if (observation.mode === 'short-circuit') {
		expect(observation.identityUnions + observation.identityRefusals).toBe(
			observation.identitySettled
		);
		expect(observation.insideCalls + observation.insideSkipsByBounds).toBe(
			observation.insideDecisions + observation.overlapCalls
		);
		expect(observation.insideDecisions).toBeLessThanOrEqual(observation.insideCalls);
		expect(2 * observation.pairs - (observation.insideCalls + observation.overlapCalls)).toBe(
			2 *
				(observation.identitySettled +
					observation.authorizationSkips +
					observation.absentEvidenceSkips +
					observation.boundsSkips) +
				observation.insideSkipsByBounds +
				observation.insideDecisions
		);
	} else {
		expect(observation.insideSkipsByBounds).toBe(0);
		expect(observation.insideDecisions + observation.overlapDecisions).toBeLessThanOrEqual(
			observation.pairs
		);
	}
}

/** Rows that actually ran a correspondence pass, with the frozen subject counts. */
function passRows(run: TableRun): Array<{ row: P23B11FrozenCase; observations: CorrespondenceObservation[] }> {
	return run.rows
		.map((row, index) => ({ row, observations: run.observations[index]! }))
		.filter((entry) => entry.row.counts.pairs > 0);
}

describe('P23B.11 S3 — OR-1: the shipped short-circuits reproduce the frozen reference', () => {
	it('every case, including the CONNECTED rows (h), re-derives its frozen row on today’s SHIPPED path', () => {
		expect(shipped.rows.map((row) => row.id)).toEqual(P23B11_OR1_REFERENCE.map((row) => row.id));
		for (const row of shipped.rows) {
			expect(row, row.id).toEqual(frozenById.get(row.id));
		}
		// OR-1(h) is MANDATORY at S3, and the exclusion is deliberate: the five
		// CONNECTED rows with a pass (authoring inside, division, shared-wall merge,
		// outer-wall retire, corner dissolve) are compared above like every other row.
		const connected = passRows(shipped).filter((entry) => entry.row.covers.includes('OR-1(h)'));
		expect(connected.map((entry) => entry.row.id).sort()).toEqual([
			'd-connected-outer-wall-retire',
			'd-connected-shared-wall-merge',
			'h-connected-authoring-inside',
			'h-connected-corner-dissolve',
			'h-connected-room-division'
		]);
	});

	it('no row differs anywhere: not a component, not a lineage record, not a document digest', () => {
		// Named projections, so a drift names the field instead of the blob: the
		// component sets, the lineage, the retirements and the diffed counts.
		for (const row of shipped.rows) {
			const frozen = frozenById.get(row.id)!;
			expect(componentKeyset(row.components), row.id).toEqual(componentKeyset(frozen.components));
			expect(row.faceKeys, row.id).toEqual(frozen.faceKeys);
			expect(row.fidelity, row.id).toBe(frozen.fidelity);
			expect(row.operation, row.id).toEqual(frozen.operation);
			expect(row.reconciliation.kind, row.id).toBe(frozen.reconciliation.kind);
			if (row.reconciliation.kind === 'ok' && frozen.reconciliation.kind === 'ok') {
				expect(row.reconciliation.lineage, row.id).toEqual(frozen.reconciliation.lineage);
				expect(row.reconciliation.retiredRoomIds, row.id).toEqual(
					frozen.reconciliation.retiredRoomIds
				);
				expect(row.reconciliation.rooms, row.id).toEqual(frozen.reconciliation.rooms);
				expect(row.reconciliation.documentSha256, row.id).toBe(
					frozen.reconciliation.documentSha256
				);
			}
		}
	});
});

describe('P23B.11 S3 — OR-2: filter neutrality, with today’s order restored', () => {
	it('the exhaustive bypass reproduces the frozen reference on every OR-1 case', () => {
		// This is the freeze's own validity check FROM THE OTHER SIDE: the reference
		// was made from today's code, and the bypass is today's loop verbatim.
		expect(exhaustive.rows).toEqual(P23B11_OR1_REFERENCE);
	});

	it('the two modes agree case-for-case and pair-for-pair', () => {
		expect(shipped.rows.map((row) => row.id)).toEqual(exhaustive.rows.map((row) => row.id));
		for (const index of shipped.rows.keys()) {
			const optimized = shipped.rows[index]!;
			const reference = exhaustive.rows[index]!;
			expect(optimized, optimized.id).toEqual(reference);
			expect(componentKeyset(optimized.components), optimized.id).toEqual(
				componentKeyset(reference.components)
			);
		}
	});

	it('the exhaustive mode is today’s evaluation order: both predicates, every pair, no skip', () => {
		for (const { row, observations } of passRows(exhaustive)) {
			expect(observations.length, row.id).toBeGreaterThanOrEqual(1);
			for (const observation of observations) {
				expect(observation.mode, row.id).toBe('exhaustive');
				expect(observation.pairs, row.id).toBe(row.counts.pairs);
				expect(observation.insideCalls, row.id).toBe(row.counts.pairs);
				expect(observation.overlapCalls, row.id).toBe(row.counts.pairs);
				expect(
					observation.authorizationSkips +
						observation.absentEvidenceSkips +
						observation.boundsSkips +
						observation.insideSkipsByBounds,
					row.id
				).toBe(0);
				expectAccounting(observation);
			}
		}
	});

	it('a refused or operation-only row runs no pass; an empty document runs a zero-subject one', () => {
		// Deterministic (iii): a refused row does not silently run a partial pass,
		// and an operation-only row has no geometric correspondence at all. The
		// empty-extraction controls (g) DO run the pass — with zero subjects, every
		// counter zero — which is exactly how today behaves.
		for (const index of P23B11_CORRESPONDENCE_CASES.keys()) {
			const entry = P23B11_CORRESPONDENCE_CASES[index]!;
			const row = shipped.rows[index]!;
			const observations = shipped.observations[index]!;
			if (row.operation.verdict === 'rejected' || entry.kind === 'operation-only') {
				expect(observations, row.id).toEqual([]);
				expect(exhaustive.observations[index]!, row.id).toEqual([]);
				expect(row.counts.pairs, row.id).toBe(0);
				continue;
			}
			for (const observation of observations) {
				expect(observation.pairs, row.id).toBe(row.counts.pairs);
				if (row.counts.pairs > 0) continue;
				expect(observation.insideCalls + observation.overlapCalls, row.id).toBe(0);
				expect(
					observation.authorizationSkips +
						observation.absentEvidenceSkips +
						observation.boundsSkips +
						observation.insideSkipsByBounds,
					row.id
				).toBe(0);
			}
		}
	});
});

describe('P23B.11 S3 — OR-6: the count oracle', () => {
	it('cross-group geometry evaluations are ZERO for every case and operation', () => {
		// Unconditional: the group check runs FIRST for every pair, so this is a
		// claim about every shipped operation, not only the clear-gap case.
		for (const index of P23B11_CORRESPONDENCE_CASES.keys()) {
			const row = shipped.rows[index]!;
			for (const observation of shipped.observations[index]!) {
				expect(observation.mode, row.id).toBe('short-circuit');
				expect(observation.insideCallsCrossGroup, row.id).toBe(0);
				expect(observation.overlapCallsCrossGroup, row.id).toBe(0);
				expect(observation.crossGroupPairs, row.id).toBe(row.counts.crossGroupPairs);
				if (row.counts.pairs > 0) {
					// A cross-group pair is settled either by the identity condition (both sides
					// owned and different) or by the D-12 labels; EITHER way it costs no geometry,
					// and the two counters together must cover every cross-group pair.
					expect(
						observation.identityRefusals + observation.authorizationSkips,
						`${row.id}: every cross-group pair is settled or denied without geometry`
					).toBeGreaterThanOrEqual(row.counts.crossGroupPairs);
				}
			}
		}
	});

	it('the subject counts the observer sees are the frozen row’s own counts', () => {
		for (const { row, observations } of passRows(shipped)) {
			expect(observations.length, row.id).toBeGreaterThanOrEqual(1);
			const last = observations[observations.length - 1]!;
			expect(last.mode, row.id).toBe('short-circuit');
			expect(last.pairs, row.id).toBe(row.counts.pairs);
			expect(last.sameGroupPairs, row.id).toBe(row.counts.sameGroupPairs);
			expect(last.crossGroupPairs, row.id).toBe(row.counts.crossGroupPairs);
			expect(last.undefinedPairs, row.id).toBe(row.counts.undefinedPairs);
		}
	});

	it('same-group geometry stays bounded by the frozen reference on every case, CONNECTED included', () => {
		for (const { row, observations } of passRows(shipped)) {
			for (const observation of observations) {
				// Today's loop paid two evaluations per same-group pair; the optimized
				// path can pay at most that, and never more than the frozen baseline in
				// total.
				expect(
					observation.insideCallsSameGroup + observation.overlapCallsSameGroup,
					row.id
				).toBeLessThanOrEqual(2 * observation.sameGroupPairs);
				expect(
					observation.insideCalls + observation.overlapCalls,
					row.id
				).toBeLessThanOrEqual(row.counts.insideEvaluations + row.counts.overlapEvaluations);
				expectAccounting(observation);
			}
		}
	});

	it('the island rows shed their cross-group evaluations (the main lever, measured)', () => {
		// On the size-40 island fixtures ≥90% of pairs cross groups (the freeze's own
		// property row), so the shipped path must be STRICTLY cheaper than today:
		// each cross-group pair contributes zero calls instead of two.
		const islands = passRows(shipped).filter(
			(entry) =>
				entry.row.counts.pairs > 0 &&
				entry.row.counts.crossGroupPairs / entry.row.counts.pairs >= 0.9
		);
		expect(islands.length).toBeGreaterThanOrEqual(3);
		for (const { row, observations } of islands) {
			for (const observation of observations) {
				expect(
					observation.insideCalls + observation.overlapCalls,
					`${row.id}: cross-group pairs must cost nothing`
				).toBeLessThan(2 * observation.pairs);
			}
		}
	});

	it('the CONNECTED rows keep zero cross-group work, zero undefined pairs and a full accounting', () => {
		// The S4 gate reads this row family: on one Wall group the group check has
		// nothing to skip, so whatever the optimized path saves there comes from the
		// box prune, the containment skip or the identity condition — all proven
		// neutral above. Five rows since the review fix added the dissolve caller's.
		const connected = passRows(shipped).filter((entry) => entry.row.covers.includes('OR-1(h)'));
		expect(connected).toHaveLength(5);
		for (const { row, observations } of connected) {
			expect(row.counts.crossGroupPairs, row.id).toBe(0);
			expect(row.counts.undefinedPairs, row.id).toBe(0);
			for (const observation of observations) {
				expect(observation.crossGroupPairs, row.id).toBe(0);
				expect(observation.authorizationSkips, row.id).toBe(0);
				expect(observation.absentEvidenceSkips, row.id).toBe(0);
				expectAccounting(observation);
			}
		}
	});
});
