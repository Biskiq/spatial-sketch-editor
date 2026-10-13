/**
 * P23B.5 S2–S3 — the bounded gesture-scoped sample owner for the transient preflight.
 *
 * The owner is `createWallSamplingDerivation()`, held by the Plan viewport for
 * exactly one direct-architecture gesture and threaded into
 * `preflightWallFirstArchitectureCandidate`. The scope changes only HOW MANY
 * TIMES an identical artefact is derived; it never changes which artefact the
 * canonical gate sees, and it never touches release, validation or history.
 *
 * Oracles kept here:
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
 *            baseline untouched.
 * - S5 (control) a straight-only fixture short-circuits the gate and issues zero
 *            sampling requests, so the scope holds nothing to reuse.
 *
 * REMOVED BY PR #115 (§7.2 categories C/D — editor wiring and measurement):
 *
 * - **S4, "the scope on the real transient preflight path"**, drove
 *   `transientArchitectureEdit` / `architectureEditProposalIntent` from the
 *   removed `lib/editor` shell, so it tested the deleted editor wiring. Its
 *   request-count reconciliation was an observation-count assertion besides.
 *   The obligation it carried — the scope changes how often an artefact is
 *   derived and nothing else — is what the kept S2 OR-1/OR-5 equivalence proves.
 * - **S5 direct measurement** (`timeOp` over a six-move drag, and the
 *   derivation/attribution reconciliation) was PERF-lane measurement; §5.1
 *   removes the bench apparatus and §7.3 the PERF lane. The only part of S5
 *   that stated a kernel invariant rather than a count is the straight control,
 *   which is kept below.
 *
 * The test-only observer fires inside `wallCenterlineSamples`, so an observation
 * is a FRESH derive: a hit is invisible to it by construction. Every count below
 * therefore reconciles (proposal calls + preflight misses) against the scope's own
 * `derivations`/`hits`, never against the observer alone.
 */
import { describe, expect, it } from 'vitest';

import {
	clearWallSamplingObserverForTest,
	createWallSamplingDerivation,
	preflightWallFirstArchitectureCandidate,
	serializeWallFirstLayoutDocument,
	setWallSamplingObserverForTest,
	wallCenterlineSamples,
	type LayoutDocumentWallFirst,
	type LayoutVec2,
	type SampledSegment,
	type WallFirstArchitectureProposalIntent
} from '@portfolio/layout-core';
import {
	buildP23BCorrectnessFixture,
	buildP23BMatrixFixture,
	P23B_CORRECTNESS_SPECS,
	P23B_MATRIX_SPECS
} from './__fixtures__/p23b-fixtures';

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
		{ id: 'N-2 (admitted)', document: curvatureFixture('N-2') },
		{ id: 'N-2i (already refused)', document: curvatureFixture('N-2i') },
		{ id: 'class4-self-intersection-v1', document: curvatureFixture('class4-self-intersection-v1') }
	];
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

describe('P23B.5 S5 — the straight control', () => {
	it('a straight-only fixture short-circuits the gate: zero sampling requests, nothing to reuse', () => {
		const straight = matrixFixture('p23b-40-wall-straight-v1');
		const straightScope = createWallSamplingDerivation();
		const straightCalls = record(() =>
			preflightWallFirstArchitectureCandidate(straight, junctionMoveIntent(straight, 0.05), straightScope)
		).length;
		// The straight control has nothing to reuse: a line short-circuits the gate.
		expect(straightCalls, 'no sampling on straight-only fixtures').toBe(0);
		expect(straightScope.stats.derivations + straightScope.stats.hits).toBe(0);
	});
});
