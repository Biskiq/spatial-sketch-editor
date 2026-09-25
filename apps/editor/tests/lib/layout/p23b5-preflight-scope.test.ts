/**
 * P23B.5 S2–S5 — the bounded gesture-scoped sample owner for the transient preflight.
 *
 * The owner is `createWallSamplingDerivation()`, held by the Plan viewport for
 * exactly one direct-architecture gesture and threaded into
 * `preflightWallFirstArchitectureCandidate`. The scope changes only HOW MANY
 * TIMES an identical artefact is derived; it never changes which artefact the
 * canonical gate sees, and it never touches release, validation or history.
 *
 * Oracles exercised here:
 *
 * - S2 OR-1  verdict and artefact equivalence: scoped == per-call, on the
 *            committed fixtures, both admitted and refused.
 * - S2 OR-9  refusal: a changed traced input (Wall, centreline OBJECT,
 *            traversal or resolved endpoints) MISSES and re-derives; it is never
 *            served a stale entry.
 * - S3       bounded lifetime: `reset()` empties the store and zeroes the
 *            counters; a scope cannot inherit entries; every sampled input is
 *            still byte-identical after a full drag (the mutation bind the S0
 *            P6 hazard requires), and a refused preflight leaves the frozen
 *            baseline untouched. * - S4       the real transient path: a three-pointermove gesture derives each
 *            untouched Wall once and reuses the rest, and the request count the
 *            scope serves is unchanged — only its miss/hit split moves.
 *
 * The test-only observer fires inside `wallCenterlineSamples`, so an observation
 * is a FRESH derive: a hit is invisible to it by construction. Every count below
 * therefore reconciles (proposal calls + preflight misses) against the scope's own
 * `derivations`/`hits`, never against the observer alone.
 * - S5       direct measurement: per-stage requests, derivations (misses /
 *            refusals), hits, failed derives and cached-`undefined`, reconciled
 *            without double counting, with advisory scope overhead.
 *
 * On this grammar, `derivations === misses === refusals` (a refusal IS an absent
 * key: ineligible input), and a cached `undefined` is NOT useful geometry reuse —
 * so both are counted separately rather than folded into `hits`.
 */
import { describe, expect, it } from 'vitest';

import {
	clearWallSamplingObserverForTest,
	createWallSamplingDerivation,
	preflightWallFirstArchitectureCandidate,
	proposeWallFirstArchitectureGeometry,
	serializeWallFirstLayoutDocument,
	setWallSamplingObserverForTest,
	wallCenterlineSamples,
	type LayoutDocumentWallFirst,
	type LayoutVec2,
	type SampledSegment,
	type WallFirstArchitectureProposalIntent,
	type WallSamplingDerivation
} from '@portfolio/layout-core';
import {
	buildP23BCorrectnessFixture,
	buildP23BMatrixFixture,
	P23B_CORRECTNESS_SPECS,
	P23B_MATRIX_SPECS,
	P23B_OWNER_LAYOUT
} from '$lib/bench/p23b-fixtures';
import { timeOp } from '$lib/bench/bench-harness';
import type { LayoutArchitectureEditGesture } from '$lib/editor/layout/layout-interaction';
import {
	architectureEditProposalIntent,
	transientArchitectureEdit,
	type LayoutTransientArchitectureEdit
} from '$lib/editor/layout/layout-transient-edit';

const WARMUP = 3;
const SAMPLES = 9;

function matrixFixture(id: string): LayoutDocumentWallFirst {
	return buildP23BMatrixFixture(P23B_MATRIX_SPECS.find((spec) => spec.id === id)!);
}

function curvatureFixture(id: string): LayoutDocumentWallFirst {
	return buildP23BCorrectnessFixture(P23B_CORRECTNESS_SPECS.find((spec) => spec.id === id)!);
}

/** Digest the complete artefact: identity, length and every sample field. */
function digest(segment: SampledSegment | undefined): string {
	if (!segment) return 'undefined';
	return JSON.stringify({
		id: segment.segmentId,
		len: segment.length,
		samples: segment.samples.map((sample) => ({
			p: sample.point,
			d: sample.distance,
			tan: sample.tangent,
			nor: sample.normal,
			u: sample.t
		}))
	});
}

type RecordedCall = {
	wallId: string;
	traversal: string;
	start: LayoutVec2;
	end: LayoutVec2;
	ok: boolean;
	digest: string;
	/**
	 * A stable id for the centerline OBJECT the call keyed on, so a test can tell
	 * "the same input was repeated" from "an equal-valued copy replaced it". The
	 * WeakMap keeps the observation from retaining the borrowed reference.
	 */
	bucket: number;
};

const samplingBucketIds = new WeakMap<object, number>();
let nextSamplingBucketId = 1;
function samplingBucket(centerline: object): number {
	const existing = samplingBucketIds.get(centerline);
	if (existing !== undefined) return existing;
	const assigned = nextSamplingBucketId;
	nextSamplingBucketId += 1;
	samplingBucketIds.set(centerline, assigned);
	return assigned;
}

/** Observe the real `wallCenterlineSamples` calls one stage makes. */
function record(work: () => void): RecordedCall[] {
	const calls: RecordedCall[] = [];
	setWallSamplingObserverForTest((observation, result) => {
		calls.push({
			wallId: observation.wallId,
			traversal: observation.traversal,
			start: [observation.start[0], observation.start[1]] as LayoutVec2,
			end: [observation.end[0], observation.end[1]] as LayoutVec2,
			ok: observation.ok,
			digest: digest(result),
			bucket: samplingBucket(observation.centerline)
		});
	});
	try {
		work();
	} finally {
		clearWallSamplingObserverForTest();
	}
	return calls;
}

function keyOf(call: RecordedCall): string {
	return `${call.wallId}|${call.traversal}|${JSON.stringify(call.start)}|${JSON.stringify(call.end)}`;
}

function junctionPoint(doc: LayoutDocumentWallFirst, junctionId: string): LayoutVec2 {
	return doc.junctions.find((junction) => junction.id === junctionId)!.point;
}

function junctionMoveIntent(doc: LayoutDocumentWallFirst, dx: number): WallFirstArchitectureProposalIntent {
	const junctionId = doc.junctions[0]!.id;
	const point = junctionPoint(doc, junctionId);
	return { kind: 'junction-move', junctionId, point: [point[0] + dx, point[1]] as LayoutVec2 };
}

/** Collapsing an incident Wall onto its other endpoint is a zero-length refusal. */
function refusedIntent(doc: LayoutDocumentWallFirst): WallFirstArchitectureProposalIntent {
	const junctionId = doc.junctions[0]!.id;
	const incident = doc.walls.find(
		(wall) => wall.startJunctionId === junctionId || wall.endJunctionId === junctionId
	)!;
	const otherEndId =
		incident.startJunctionId === junctionId ? incident.endJunctionId : incident.startJunctionId;
	const otherEnd = junctionPoint(doc, otherEndId);
	return { kind: 'junction-move', junctionId, point: [otherEnd[0], otherEnd[1]] as LayoutVec2 };
}

function preflightCases(): Array<{ id: string; document: LayoutDocumentWallFirst }> {
	return [
		{ id: 'p23b-40-wall-all-curved-v1', document: matrixFixture('p23b-40-wall-all-curved-v1') },
		{ id: 'p23b-40-wall-straight-v1', document: matrixFixture('p23b-40-wall-straight-v1') },
		{ id: 'p23b-12-wall-all-curved-v1', document: matrixFixture('p23b-12-wall-all-curved-v1') },
		{ id: 'p23b-12-wall-target-curved-v1', document: matrixFixture('p23b-12-wall-target-curved-v1') },
		{ id: 'owner-40-curved-v1', document: P23B_OWNER_LAYOUT },
		{ id: 'N-2 (admitted)', document: curvatureFixture('N-2') },
		{ id: 'N-2i (already refused)', document: curvatureFixture('N-2i') },
		{ id: 'class4-self-intersection-v1', document: curvatureFixture('class4-self-intersection-v1') }
	];
}

/** The narrowed junction-move member: the one direct gesture these proofs drive. */
type JunctionMoveGesture = Extract<LayoutArchitectureEditGesture, { kind: 'junction-move' }>;

/** One junction gesture, as the viewport builds it, minus the viewport. */
function junctionGesture(doc: LayoutDocumentWallFirst): JunctionMoveGesture {
	const junctionId = doc.junctions[0]!.id;
	const point = junctionPoint(doc, junctionId);
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

describe('P23B.5 S2 — shared-preflight equivalence and refusal', () => {
	it('OR-1: a gesture scope changes no verdict, admitted or refused, on every committed fixture', () => {
		for (const { id, document } of preflightCases()) {
			const accepted = junctionMoveIntent(document, 0.05);
			const refused = refusedIntent(document);
			const scope = createWallSamplingDerivation();
			expect(
				preflightWallFirstArchitectureCandidate(document, accepted, scope),
				`${id} accepted verdict`
			).toEqual(preflightWallFirstArchitectureCandidate(document, accepted));
			expect(
				preflightWallFirstArchitectureCandidate(document, refused, scope),
				`${id} refused verdict`
			).toEqual(preflightWallFirstArchitectureCandidate(document, refused));
		}
	});

	it('OR-1/OR-5: repeated pointermoves under one scope keep the fresh verdicts and the exact artefact', () => {
		const doc = matrixFixture('p23b-40-wall-all-curved-v1');
		const scope = createWallSamplingDerivation();
		for (const dx of [0.05, 0.1, 0.15, -0.2]) {
			const intent = junctionMoveIntent(doc, dx);
			expect(preflightWallFirstArchitectureCandidate(doc, intent, scope), `move ${dx}`).toEqual(
				preflightWallFirstArchitectureCandidate(doc, intent)
			);
		}
		expect(scope.stats.hits, 'untouched Walls are reused across pointermoves').toBeGreaterThan(0);

		// Every artefact the scope can serve is the complete, canonical artefact:
		// the same digest a fresh derive produces, `segmentId` and `length` included.
		const junctionById = new Map(doc.junctions.map((junction) => [junction.id, junction.point] as const));
		for (const wall of doc.walls) {
			if (wall.centerline.kind === 'line') continue;
			const start = junctionById.get(wall.startJunctionId)!;
			const end = junctionById.get(wall.endJunctionId)!;
			const first = scope.samples(wall, start, end, 'forward');
			expect(first, `${wall.id} derived`).toBeDefined();
			expect(scope.samples(wall, start, end, 'forward'), `${wall.id} shared identity`).toBe(first);
			expect(digest(scope.samples(wall, start, end, 'forward')), `${wall.id} complete artefact`).toBe(
				digest(wallCenterlineSamples(wall, start, end, 'forward'))
			);
			expect(first!.segmentId, `${wall.id} metadata`).toBe(wall.id);
		}
	});

	it('OR-9: a changed traced input MISSES and re-derives; untouched Walls still hit', () => {
		const doc = matrixFixture('p23b-40-wall-all-curved-v1');
		const junctionId = doc.junctions[0]!.id;
		const incident = new Set(
			doc.walls
				.filter((wall) => wall.startJunctionId === junctionId || wall.endJunctionId === junctionId)
				.map((wall) => wall.id)
		);
		const scope = createWallSamplingDerivation();
		const firstMisses = record(() => preflightWallFirstArchitectureCandidate(doc, junctionMoveIntent(doc, 0.05), scope));
		const expectedFreshPerCall = firstMisses.length;
		expect(expectedFreshPerCall, 'a curved fixture derives its walls').toBeGreaterThan(0);
		const afterFirst = { ...scope.stats };

		const secondMisses = record(() => preflightWallFirstArchitectureCandidate(doc, junctionMoveIntent(doc, 0.1), scope));
		// Only the walls whose resolved endpoints actually moved are refused; the
		// refused set is a subset of the incident set, never empty of reuse.
		expect(secondMisses.length, 'a moved endpoint is a miss').toBeGreaterThan(0);
		expect(secondMisses.length, 'the refusal is bounded by the moved Walls').toBeLessThanOrEqual(
			incident.size
		);
		for (const call of secondMisses) {
			expect(incident.has(call.wallId), 'only a moved-wall key refuses').toBe(true);
		}
		expect(scope.stats.hits - afterFirst.hits, 'everything else is a hit').toBeGreaterThan(0);
		// The scope changes the miss/hit SPLIT, never the request count: the same
		// gate asks the same number of questions on every pointermove.
		expect(
			secondMisses.length + (scope.stats.hits - afterFirst.hits),
			'a later move makes the same number of requests'
		).toBe(firstMisses.length);
		// The store never grows for an unchanged traced input: its size is exactly
		// the number of distinct keys derived, so the second move adds one entry per
		// refused (moved) key and not a single entry more.
		expect(scope.stats.entries, 'only the refused keys add an entry').toBe(
			afterFirst.entries + secondMisses.length
		);
		expect(scope.stats.entries, 'entries are exactly the distinct derived keys').toBe(
			scope.stats.derivations
		);
	});
});

describe('P23B.5 S3 — bounded lifetime, reset and immutability', () => {
	it('reset() empties the store, zeroes the counters, and a later request re-derives', () => {
		const doc = matrixFixture('p23b-40-wall-all-curved-v1');
		const scope = createWallSamplingDerivation();
		const wall = doc.walls.find((entry) => entry.centerline.kind === 'cubic-chain')!;
		const junctionById = new Map(doc.junctions.map((junction) => [junction.id, junction.point] as const));
		const start = junctionById.get(wall.startJunctionId)!;
		const end = junctionById.get(wall.endJunctionId)!;

		const before = scope.samples(wall, start, end, 'forward');
		scope.samples(wall, start, end, 'forward');
		expect(scope.stats.entries).toBe(1);
		expect(scope.stats.hits).toBe(1);

		scope.reset();
		expect(scope.stats).toEqual({
			derivations: 0,
			hits: 0,
			coldMisses: 0,
			refusals: 0,
			failedDerivations: 0,
			cachedUndefined: 0,
			entries: 0
		});
		// Empty really means empty: the same key is derived again, not served.
		const after = scope.samples(wall, start, end, 'forward');
		expect(scope.stats.derivations).toBe(1);
		expect(scope.stats.hits).toBe(0);
		expect(digest(after)).toBe(digest(before));
	});

	it('a scope is one gesture: reset between drags, and the second drag re-derives everything', () => {
		const doc = matrixFixture('p23b-40-wall-all-curved-v1');
		const scope = createWallSamplingDerivation();
		for (const dx of [0.05, 0.1]) preflightWallFirstArchitectureCandidate(doc, junctionMoveIntent(doc, dx), scope);
		expect(scope.stats.hits, 'the first drag reused').toBeGreaterThan(0);

		scope.reset();
		const secondDrag = [0.3, 0.35].map((dx) => {
			const misses = record(() => preflightWallFirstArchitectureCandidate(doc, junctionMoveIntent(doc, dx), scope));
			return misses.length;
		});
		// Cross-gesture reuse is not the approved scope: after the reset the first
		// pointermove of the second drag derives every wall afresh.
		expect(secondDrag[0], 'a new gesture starts empty').toBeGreaterThan(0);
		expect(secondDrag[1], 'and then reuses within itself').toBeLessThan(secondDrag[0]!);
	});

	it('every sampled input is still byte-identical after a full drag (the S0 P6 mutation bind)', () => {
		const doc = matrixFixture('p23b-40-wall-all-curved-v1');
		const scope = createWallSamplingDerivation();
		const observed = new Map<string, RecordedCall>();
		for (const dx of [0.05, 0.1, 0.15, 0.2]) {
			for (const call of record(() => preflightWallFirstArchitectureCandidate(doc, junctionMoveIntent(doc, dx), scope))) {
				if (!observed.has(keyOf(call))) observed.set(keyOf(call), call);
			}
		}
		expect(observed.size).toBeGreaterThan(0);
		expect(scope.stats.hits).toBeGreaterThan(0);
		const wallById = new Map(doc.walls.map((wall) => [wall.id, wall] as const));
		for (const call of observed.values()) {
			const wall = wallById.get(call.wallId);
			expect(wall, `${call.wallId} still present`).toBeDefined();
			// If a gesture had mutated any traced input in place — the hazard S0 P6
			// demonstrated on this grammar — this fresh derive would no longer match
			// the artefact the store retained for that key.
			expect(
				digest(wallCenterlineSamples(wall!, call.start, call.end, call.traversal as 'forward' | 'reverse')),
				`${call.wallId} input unchanged over the drag`
			).toBe(call.digest);
		}
	});

	it('a refused preflight under a scope leaves the frozen baseline byte-identical', () => {
		const doc = matrixFixture('p23b-40-wall-all-curved-v1');
		const json = serializeWallFirstLayoutDocument(doc);
		const scope = createWallSamplingDerivation();
		expect(preflightWallFirstArchitectureCandidate(doc, refusedIntent(doc), scope)).toBeDefined();
		expect(serializeWallFirstLayoutDocument(doc), 'refusal changed nothing').toBe(json);
		// And the refusal did not poison the store: an ordinary move still works.
		expect(preflightWallFirstArchitectureCandidate(doc, junctionMoveIntent(doc, 0.05), scope)).toBeUndefined();
	});
});

describe('P23B.5 S4 — the scope on the real transient preflight path', () => {
	/** One pointermove's observed fresh derives, as the real transient path makes them. */
	function moveGesture(
		doc: LayoutDocumentWallFirst,
		moves: readonly number[],
		sampling?: WallSamplingDerivation
	): Array<{
		calls: RecordedCall[];
		intent: WallFirstArchitectureProposalIntent;
		attempt: LayoutTransientArchitectureEdit | null;
	}> {
		const gesture = junctionGesture(doc);
		const start = [...gesture.baselinePoint] as LayoutVec2;
		return moves.map((dx) => {
			gesture.candidatePoint = [start[0] + dx, start[1]];
			const intent = architectureEditProposalIntent(gesture);
			let attempt: LayoutTransientArchitectureEdit | null = null;
			const calls = record(() => {
				attempt = transientArchitectureEdit({ gesture, baseline: doc, moved: true, sampling });
			});
			return { calls, intent, attempt };
		});
	}

	it('a three-pointermove gesture derives each untouched Wall once and reuses the rest', () => {
		const doc = matrixFixture('p23b-40-wall-all-curved-v1');
		const moves = [0.05, 0.1, 0.15];
		const junctionId = doc.junctions[0]!.id;
		const incident = new Set(
			doc.walls
				.filter((wall) => wall.startJunctionId === junctionId || wall.endJunctionId === junctionId)
				.map((wall) => wall.id)
		);
		expect(incident.size, 'the moved Junction has incident Walls').toBeGreaterThan(0);

		const scope = createWallSamplingDerivation();
		const scoped = moveGesture(doc, moves, scope);
		// The proposal stage is deliberately unscoped, so the real proposal call for
		// the same intents gives the per-move share the scope never sees, and the
		// same three moves with NO scope give the preflight request-count reference.
		const unscoped = moveGesture(doc, moves);
		const proposal = scoped.map(
			({ intent }) => record(() => proposeWallFirstArchitectureGeometry(doc, intent)).length
		);
		const observed = (run: Array<{ calls: RecordedCall[] }>) =>
			run.reduce((total, move) => total + move.calls.length, 0);
		const preflightCalls = (run: Array<{ calls: RecordedCall[] }>) =>
			observed(run) - proposal.reduce((total, count) => total + count, 0);

		// Nothing is reused before anything is stored: the first pointermove of a
		// fresh scope derives exactly what the unscoped path derives.
		expect(observed([scoped[0]!]), 'a fresh scope suppresses nothing').toBe(observed([unscoped[0]!]));
		// After that only the moved Walls re-derive, and the request count the scope
		// serves is unchanged — 44 misses + 76 hits = the same 120 preflight requests
		// the unscoped path makes. The observer sees fresh derives only, so the
		// scope's own counters are what reconcile hits against those requests.
		expect(new Set(scoped[1]!.calls.map((call) => call.wallId))).toEqual(incident);
		expect(new Set(scoped[2]!.calls.map((call) => call.wallId))).toEqual(incident);
		expect(preflightCalls(scoped), 'the preflight misses are the scope derivations').toBe(
			scope.stats.derivations
		);
		expect(
			scope.stats.derivations + scope.stats.hits,
			'the scope serves every preflight request, hit or miss'
		).toBe(preflightCalls(unscoped));
		expect(scope.stats.hits, 'the gesture reuses').toBeGreaterThan(0);
		expect(
			preflightCalls(unscoped) - preflightCalls(scoped),
			'every suppressed derive is exactly one counted hit'
		).toBe(scope.stats.hits);
		// The real path's status and its rendered attempt are unchanged by the
		// scope: reuse changes how often an artefact is derived, nothing else.
		expect(scoped.map((move) => move.attempt)).toEqual(unscoped.map((move) => move.attempt));
	});
});

describe('P23B.5 S5 — direct measurement', () => {
	it('attributes every derivation to a cold miss or a changed-input refusal, then reconciles the requests', () => {
		const doc = matrixFixture('p23b-40-wall-all-curved-v1');
		const moves = [0.05, 0.1, 0.15];
		const firstIntent = junctionMoveIntent(doc, moves[0]!);

		// Stage 1 — the proposal. Unscoped by design: each intent builds a NEW
		// centreline, so its inputs never repeat and the scope would not hit.
		const proposalRequests = record(() => proposeWallFirstArchitectureGeometry(doc, firstIntent)).length;

		// Stage 2 — the scoped preflight over the drag.
		const scope = createWallSamplingDerivation();
		const preflight = moves.map((dx) =>
			record(() => preflightWallFirstArchitectureCandidate(doc, junctionMoveIntent(doc, dx), scope))
		);
		const observedMisses = preflight.reduce((total, calls) => total + calls.length, 0);

		// The unscoped reference fixes each pointermove's total sampling-call count
		// (the gate samples one forward derivation per curved Wall), so hits can be
		// reconciled against the true total rather than a second observer.
		const unscopedPerMove = record(() =>
			preflightWallFirstArchitectureCandidate(doc, firstIntent)
		).length;
		const totalCalls = unscopedPerMove * moves.length;

		// Attribution from the OBSERVED inputs alone — a second opinion on the
		// scope's own split, so a wrong counter cannot agree with itself. A Wall's
		// first observed request is a cold miss; a later one whose traced inputs
		// (centerline object, traversal or resolved endpoints) differ is a refusal.
		const lastObserved = new Map<string, string>();
		const attribution = { coldMisses: 0, refusals: 0 };
		for (const calls of preflight) {
			for (const call of calls) {
				const traced = `${call.traversal}|${call.bucket}|${call.digest}`;
				const previous = lastObserved.get(call.wallId);
				if (previous === undefined) attribution.coldMisses += 1;
				else if (previous !== traced) attribution.refusals += 1;
				lastObserved.set(call.wallId, traced);
			}
		}

		expect(scope.stats.derivations, 'observed misses are the derivations').toBe(observedMisses);
		expect(scope.stats.coldMisses, 'cold misses match the observed first requests').toBe(
			attribution.coldMisses
		);
		expect(scope.stats.refusals, 'refusals match the observed changed inputs').toBe(
			attribution.refusals
		);
		expect(
			scope.stats.coldMisses + scope.stats.refusals,
			'derivations are exactly cold misses plus refusals'
		).toBe(scope.stats.derivations);
		expect(scope.stats.derivations + scope.stats.hits, 'requests reconcile').toBe(totalCalls);
		expect(scope.stats.entries, 'entries are distinct keys, not requests').toBe(scope.stats.derivations);
		expect(scope.stats.failedDerivations, 'no failed derive on a valid fixture').toBe(0);
		expect(scope.stats.cachedUndefined, 'no cached undefined served').toBe(0);
		// The scale of the committed fixture, stated so a change in either the
		// fixture or the gate is visible rather than absorbed.
		expect(attribution.coldMisses, 'every sampled Wall is derived once on move 1').toBe(40);
		expect(attribution.refusals, 'the moved Junction re-derives its two incident Walls per move')
			.toBe(4);
		console.log(
			`S5 curved-40 drag: proposalRequests=${proposalRequests} preflightCalls=${totalCalls} derivations=${scope.stats.derivations} (coldMisses=${scope.stats.coldMisses} + refusals=${scope.stats.refusals}) hits=${scope.stats.hits} entries=${scope.stats.entries} failedDerives=${scope.stats.failedDerivations} cachedUndefined=${scope.stats.cachedUndefined}`
		);
	});

	it('records the straight control (no sampled Walls) and the scope overhead (advisory)', { timeout: 120000 }, () => {
		const straight = matrixFixture('p23b-40-wall-straight-v1');
		const straightScope = createWallSamplingDerivation();
		const straightCalls = record(() =>
			preflightWallFirstArchitectureCandidate(straight, junctionMoveIntent(straight, 0.05), straightScope)
		).length;
		// The straight control has nothing to reuse: a line short-circuits the gate.
		expect(straightCalls, 'no sampling on straight-only fixtures').toBe(0);
		expect(straightScope.stats.derivations + straightScope.stats.hits).toBe(0);

		const doc = matrixFixture('p23b-40-wall-all-curved-v1');
		const moves = [0.05, 0.1, 0.15, 0.2, 0.25, 0.3];
		const run = (scope: WallSamplingDerivation | undefined) => {
			for (const dx of moves) {
				preflightWallFirstArchitectureCandidate(doc, junctionMoveIntent(doc, dx), scope);
			}
		};
		run(undefined);
		run(createWallSamplingDerivation());
		const unscoped = timeOp(() => run(undefined), { warmup: WARMUP, samples: SAMPLES });
		const scoped = timeOp(() => run(createWallSamplingDerivation()), { warmup: WARMUP, samples: SAMPLES });
		console.log(
			`S5 preflight 6-move drag (curved-40, advisory): unscoped p50=${unscoped.p50.toFixed(2)} p95=${unscoped.p95.toFixed(2)} ms · scoped p50=${scoped.p50.toFixed(2)} p95=${scoped.p95.toFixed(2)} ms`
		);
		// Advisory only: no threshold is asserted (P23B.0 governs timing gates).
		expect(scoped.p50).toBeGreaterThan(0);
	});
});
