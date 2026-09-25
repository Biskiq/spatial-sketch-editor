/**
 * P23B.5 S0 — reachability / identity proof (EVIDENCE ONLY).
 *
 * These are bounded diagnostic probes over the REAL preflight, release and
 * restore entry points on committed fixtures. They implement NOTHING: no new
 * owner, no retained store, no key change. Every assertion below either
 * (a) states a landed identity/equality fact, or (b) simulates a *prospective*
 * owner by replaying observed real requests through the landed
 * `createWallSamplingDerivation`, clearly labelled as a simulation.
 *
 * What is proved here (mapped to the plan's S0 questions):
 *
 * - P1  source → parsed → compiled identities: every validation re-parses fresh
 *       centerline objects and every compile mints a fresh geometry object, so
 *       an OBJECT-IDENTITY key cannot carry a hit across validation stages,
 *       releases, undo/redo or replacement.
 * - P2  release: the same sample requests recur across repeated releases while
 *       identity is refreshed, and a rejected release leaves the baseline
 *       intact (OR-5 second half / atomicity direction).
 * - P3  preflight: repeated calls on a frozen baseline genuinely re-present the
 *       SAME centerline objects (in-place mutation of an untouched Wall is
 *       observed by the next preflight) → cross-call identity is reachable.
 * - P4  prospective gesture-scoped owner simulation over those real shared
 *       objects: counts would-be hits and proves full-result equality (including
 *       `segmentId`) against the observed fresh results.
 * - P5  metadata hazard: the landed key omits the Wall id, so two Walls sharing
 *       one centerline object + endpoints receive the first Wall's `segmentId`.
 *       Committed fixtures never construct that alias.
 * - P6  mutation hazard: the landed grammar has no in-place mutation refusal and
 *       serves the stale array/result to a second call.
 * - P7  restore (the undo/redo layout mechanism): reuses the same compiled
 *       geometry object and issues ZERO sampling requests — N/A, not a 0% hit.
 *
 * The disposition these probes support is recorded in the P23B.5 plan.
 */
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import {
	clearWallSamplingObserverForTest,
	compileWallFirstLayoutGeometry,
	createWallSamplingDerivation,
	planExactJunctionMove,
	preflightWallFirstArchitectureCandidate,
	serializeWallFirstLayoutDocument,
	setWallSamplingObserverForTest,
	validateWallFirstLayoutDocument,
	wallCenterlineSamples,
	type LayoutDocumentWallFirst,
	type LayoutVec2,
	type LayoutWall,
	type WallCenterlineTraversal
} from '@portfolio/layout-core';
import { buildP23BMatrixFixture, P23B_MATRIX_SPECS, P23B_OWNER_LAYOUT } from '$lib/bench/p23b-fixtures';
import {
	captureLayoutPreviewSnapshot,
	createEmptyWallFirstLayoutPreviewState,
	importLayoutPreviewJson,
	restoreLayoutPreviewSnapshot
} from '$lib/editor/layout/layout-preview-state.svelte';

function matrixFixture(id: string): LayoutDocumentWallFirst {
	return buildP23BMatrixFixture(P23B_MATRIX_SPECS.find((spec) => spec.id === id)!);
}

/** The committed curved-40 timing target and its straight control. */
const curvedForty = (): LayoutDocumentWallFirst => matrixFixture('p23b-40-wall-all-curved-v1');
const straightForty = (): LayoutDocumentWallFirst => matrixFixture('p23b-40-wall-straight-v1');

type SampleShape = {
	readonly point: readonly number[];
	readonly distance: number;
	readonly tangent: readonly number[];
	readonly normal: readonly number[];
	readonly t: number;
};

function sha(value: string): string {
	return createHash('sha256').update(value).digest('hex').slice(0, 16);
}

function hashSamples(samples: readonly SampleShape[] | undefined): string {
	if (!samples) return 'undefined';
	return sha(
		samples
			.map((sample) =>
				JSON.stringify({
					p: sample.point,
					d: sample.distance,
					tan: sample.tangent,
					nor: sample.normal,
					u: sample.t
				})
			)
			.join('|')
	);
}

type RecordedCall = {
	wallId: string;
	segmentId: string;
	traversal: WallCenterlineTraversal;
	start: LayoutVec2;
	end: LayoutVec2;
	ok: boolean;
	hash: string;
	count: number;
};

/** One real consumer/preflight invocation, observed through the test-only hook. */
function record(work: () => void): RecordedCall[] {
	const calls: RecordedCall[] = [];
	setWallSamplingObserverForTest((observation, result) => {
		calls.push({
			wallId: observation.wallId,
			segmentId: result?.segmentId ?? 'undefined',
			traversal: observation.traversal,
			start: [observation.start[0], observation.start[1]] as LayoutVec2,
			end: [observation.end[0], observation.end[1]] as LayoutVec2,
			ok: observation.ok,
			hash: hashSamples(result?.samples),
			count: result?.samples.length ?? 0
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

function junctionMove(doc: LayoutDocumentWallFirst, junctionId: string, dx: number, dz = 0) {
	const point = doc.junctions.find((junction) => junction.id === junctionId)!.point;
	return {
		kind: 'junction-move' as const,
		junctionId,
		point: [point[0] + dx, point[1] + dz] as LayoutVec2
	};
}

function incidentWallIds(doc: LayoutDocumentWallFirst, junctionId: string): Set<string> {
	return new Set(
		doc.walls
			.filter((wall) => wall.startJunctionId === junctionId || wall.endJunctionId === junctionId)
			.map((wall) => wall.id)
	);
}

function endpointsOf(doc: LayoutDocumentWallFirst, wall: LayoutWall): [LayoutVec2, LayoutVec2] {
	const start = doc.junctions.find((junction) => junction.id === wall.startJunctionId)!.point;
	const end = doc.junctions.find((junction) => junction.id === wall.endJunctionId)!.point;
	return [start, end];
}

describe('P23B.5 S0 — identity at each boundary', () => {
	it('P1 every validation re-parses fresh centerlines and every compile mints a fresh geometry object', () => {
		const doc = curvedForty();
		const first = validateWallFirstLayoutDocument(doc);
		const second = validateWallFirstLayoutDocument(doc);
		expect(first.success && second.success).toBe(true);
		if (!first.success || !second.success) return;
		expect(first.document.walls).toHaveLength(doc.walls.length);
		for (let index = 0; index < doc.walls.length; index += 1) {
			const source = doc.walls[index]!;
			const parsedFirst = first.document.walls[index]!;
			const parsedSecond = second.document.walls[index]!;
			// Value-preserving …
			expect(parsedFirst.centerline, `${source.id} value`).toEqual(source.centerline);
			// … identity-refreshing: never the source object, never the previous parse.
			expect(parsedFirst.centerline, `${source.id} fresh vs source`).not.toBe(source.centerline);
			expect(parsedSecond.centerline, `${source.id} fresh vs previous parse`).not.toBe(parsedFirst.centerline);
		}
		// One document → one compiled geometry truth, but a NEW object per compile:
		// the geometry-keyed WeakMaps can only hit for the SAME geometry object.
		const compileA = compileWallFirstLayoutGeometry(doc);
		const compileB = compileWallFirstLayoutGeometry(doc);
		expect(compileA.geometry).toEqual(compileB.geometry);
		expect(compileA.geometry).not.toBe(compileB.geometry);
	});

	it('P2 release: identical requests recur across releases and a rejected release leaves the baseline intact', () => {
		const doc = curvedForty();
		const json = serializeWallFirstLayoutDocument(doc);
		const junctionId = doc.junctions[0]!.id;

		const accepted = planExactJunctionMove(doc, junctionId, junctionMove(doc, junctionId, 0.05).point);
		expect(accepted.kind, 'curved-40 junction move is accepted').toBe('success');

		const firstRequests = record(() => planExactJunctionMove(doc, junctionId, junctionMove(doc, junctionId, 0.05).point));
		const secondRequests = record(() => planExactJunctionMove(doc, junctionId, junctionMove(doc, junctionId, 0.05).point));
		expect(firstRequests.length, 'curved-40 release samples its walls').toBeGreaterThan(0);
		// Same value inputs, same results — but P1 proves each release ran them on
		// freshly parsed centerline objects, so no cross-release identity exists.
		expect(secondRequests).toEqual(firstRequests);
		const curvedRequests = firstRequests.filter((call) => call.ok);
		expect(curvedRequests.length, 'curved walls actually derive samples').toBeGreaterThan(0);
		const traversals = firstRequests.reduce<Record<string, number>>((counts, call) => {
			const bucket = `${call.ok ? 'ok' : 'undefined'}:${call.traversal}`;
			counts[bucket] = (counts[bucket] ?? 0) + 1;
			return counts;
		}, {});
		const distinct = new Set(firstRequests.map((call) => keyOf(call)));
		// 120 requests, only 80 distinct (wall, traversal, endpoints) VALUE keys: the
		// pre/post stages re-request value-identical inputs, so object identity alone
		// is what refuses a cross-stage hit (this is the P2 evidence claim).
		expect(distinct.size, 'value keys recur across the pre/post stages').toBe(80);
		console.log(
			`S0 P2 release requests/call (curved-40)=${firstRequests.length} distinctKeys=${distinct.size} derived=${curvedRequests.length} byTraversal=${JSON.stringify(traversals)}`
		);

		// A rejected release still exercises the chain and must not mutate the baseline:
		// collapsing an incident Wall onto its other endpoint is a zero-length reject.
		const incidentWall = doc.walls.find(
			(wall) => wall.startJunctionId === junctionId || wall.endJunctionId === junctionId
		)!;
		const otherEndId = incidentWall.startJunctionId === junctionId ? incidentWall.endJunctionId : incidentWall.startJunctionId;
		const otherEnd = doc.junctions.find((junction) => junction.id === otherEndId)!;
		const rejected = planExactJunctionMove(doc, junctionId, [otherEnd.point[0], otherEnd.point[1]] as LayoutVec2);
		expect(rejected.kind, 'zero-length junction move is rejected').toBe('rejected');
		expect(serializeWallFirstLayoutDocument(doc), 'baseline unchanged after rejection').toBe(json);
	});

	it('P3 preflight: repeated calls re-present the SAME frozen-baseline centerline objects (reachable cross-call identity)', () => {
		const doc = curvedForty();
		const junctionId = doc.junctions[0]!.id;
		const incident = incidentWallIds(doc, junctionId);
		const untouched = doc.walls.filter(
			(wall) => !incident.has(wall.id) && wall.centerline.kind === 'cubic-chain'
		);
		expect(untouched.length).toBeGreaterThan(0);

		const first = record(() =>
			preflightWallFirstArchitectureCandidate(doc, junctionMove(doc, junctionId, 0.05))
		);
		const second = record(() =>
			preflightWallFirstArchitectureCandidate(doc, junctionMove(doc, junctionId, 0.1))
		);
		expect(first.length, 'preflight samples the document walls').toBeGreaterThan(0);
		console.log(`S0 P3 preflight requests/call (curved-40)=${first.length} untouched curved walls=${untouched.length}`);

		// Every UNTOUCHED Wall's request tuple and derived samples are identical
		// across the two pointermoves.
		const untouchedFirst = new Map(
			first.filter((call) => untouched.some((wall) => wall.id === call.wallId)).map((call) => [keyOf(call), call])
		);
		for (const call of second.filter((entry) => untouched.some((wall) => wall.id === entry.wallId))) {
			const prior = untouchedFirst.get(keyOf(call));
			expect(prior, `untouched request recurs: ${keyOf(call)}`).toBeDefined();
			expect(call.hash, `untouched samples identical: ${call.wallId}`).toBe(prior!.hash);
		}

		// ALIAS PROOF: mutate one untouched Wall's centerline IN PLACE. If the
		// preflight (or the frozen baseline it splices) deep-cloned, the next
		// preflight would be unaffected; it is affected, so the same object is read.
		const probeWall = untouched[0]!;
		expect(probeWall.centerline.kind).toBe('cubic-chain');
		if (probeWall.centerline.kind !== 'cubic-chain') return;
		const before = second.filter((call) => call.wallId === probeWall.id);
		expect(before.length, 'probe wall sampled by the preflight').toBeGreaterThan(0);
		probeWall.centerline.knots[0]!.point[1] += 0.5;
		const after = record(() =>
			preflightWallFirstArchitectureCandidate(doc, junctionMove(doc, junctionId, 0.1))
		).filter((call) => call.wallId === probeWall.id);
		expect(after[0]?.ok, 'mutated wall still derives samples').toBe(true);
		expect(after[0]?.hash, 'in-place mutation reaches the preflight → shared object').not.toBe(before[0]?.hash);
	});

	it('P4 prospective gesture-scoped owner (SIMULATION): real shared objects yield hits with full-result equality', () => {
		const doc = curvedForty();
		const junctionId = doc.junctions[0]!.id;
		// A three-pointermove drag over the frozen baseline, exactly as the
		// transient gesture calls the preflight.
		const steps = [0.05, 0.1, 0.15].map((dx) =>
			record(() => preflightWallFirstArchitectureCandidate(doc, junctionMove(doc, junctionId, dx)))
		);
		expect(steps[0]!.length).toBeGreaterThan(0);

		// Replay the OBSERVED requests through the LANDED derivation, using the
		// fixture's own Wall objects — which P3 proved are the objects the
		// preflight read. This mirrors a gesture-scoped owner without adding one.
		const retained = createWallSamplingDerivation();
		let replayed = 0;
		for (const step of steps) {
			for (const call of step) {
				const wall = doc.walls.find((entry) => entry.id === call.wallId);
				if (!wall) continue;
				const derived = retained.samples(wall, call.start, call.end, call.traversal);
				replayed += 1;
				// Full-result equality against the observed fresh result, metadata included.
				expect(hashSamples(derived?.samples), `replay equals observed: ${keyOf(call)}`).toBe(call.hash);
				expect(derived?.segmentId, `segmentId matches: ${call.wallId}`).toBe(call.wallId);
			}
		}
		expect(replayed).toBe(steps.reduce((total, step) => total + step.length, 0));
		// The signal: a gesture-scoped owner WOULD hit, but only preflight→preflight.
		expect(retained.stats.hits, 'prospective preflight hits exist').toBeGreaterThan(0);
		expect(retained.stats.derivations, 'prospective preflight misses exist').toBeGreaterThan(0);
		console.log(
			`S0 P4 prospective preflight owner (curved-40): requests=${replayed} derivations=${retained.stats.derivations} hits=${retained.stats.hits}`
		);
	});
});

describe('P23B.5 S0 — equality, mutation and metadata hazards', () => {
	it('P5 the key omits the Wall id: two Walls sharing a centerline object receive the first segmentId', () => {
		const doc = curvedForty();
		const [firstWall, secondWall] = doc.walls;
		expect(firstWall).toBeDefined();
		expect(secondWall).toBeDefined();
		if (!firstWall || !secondWall) return;
		const aliased = { ...secondWall, centerline: firstWall.centerline } satisfies LayoutWall;
		const [start, end] = endpointsOf(doc, firstWall);
		const derivation = createWallSamplingDerivation();
		const first = derivation.samples(firstWall, start, end, 'forward');
		const second = derivation.samples(aliased, start, end, 'forward');
		expect(first, 'first wall derives').toBeDefined();
		expect(second, 'aliased wall is served the cached result').toBe(first);
		expect(second!.segmentId, 'hazard: wrong Wall identity in the metadata').toBe(firstWall.id);
		expect(second!.segmentId, 'the aliased Wall id never appears').not.toBe(secondWall.id);
		// Landed documents never construct that alias: one centerline object per Wall.
		const distinct = new Set(doc.walls.map((wall) => wall.centerline));
		expect(distinct.size, 'committed fixture has no shared centerline objects').toBe(doc.walls.length);
	});

	it('P6 the landed grammar has no in-place mutation refusal and shares the returned arrays', () => {
		const doc = curvedForty();
		const wall = doc.walls.find((entry) => entry.centerline.kind === 'cubic-chain')!;
		const [start, end] = endpointsOf(doc, wall);
		const derivation = createWallSamplingDerivation();
		const first = derivation.samples(wall, start, end, 'forward');
		expect(first, 'wall derives').toBeDefined();
		expect(first).toEqual(wallCenterlineSamples(wall, start, end, 'forward'));

		if (wall.centerline.kind !== 'cubic-chain') return;
		wall.centerline.knots[0]!.point[0] += 0.75;
		const second = derivation.samples(wall, start, end, 'forward');
		// Same object identity key → same entry → stale serve, no refusal.
		expect(second, 'stale serve under identity').toBe(first);
		expect(second!.samples, 'the returned arrays are shared, not copied').toBe(first!.samples);
		// A fresh derivation DOES see the mutated geometry: the staleness is the store's.
		expect(wallCenterlineSamples(wall, start, end, 'forward')).not.toEqual(second);
	});
});

describe('P23B.5 S0 — restore / undo-redo is N/A for sampling', () => {
	it('P7 restore reuses the same compiled geometry object and issues zero sampling requests', () => {
		const state = createEmptyWallFirstLayoutPreviewState();
		expect(importLayoutPreviewJson(state, serializeWallFirstLayoutDocument(curvedForty()))).toBe(true);
		const snapshot = captureLayoutPreviewSnapshot(state);
		const calls = record(() => restoreLayoutPreviewSnapshot(state, snapshot));
		// Undo/redo route through this exact capture/replace pair, so the count
		// applies to them too. No document is re-parsed → no sampling is requested.
		expect(calls, 'restore issues no sampling requests (N/A, not a 0% hit rate)').toEqual([]);
		expect(state.geometry, 'restore reinstates the snapshot geometry object').toBe(snapshot.geometry);
		expect(record(() => restoreLayoutPreviewSnapshot(state, snapshot))).toEqual([]);
	});

	it('P8 the prospective preflight opportunity is curvature-scaled, not cardinality-scaled', () => {
		const junctionIdOf = (doc: LayoutDocumentWallFirst) => doc.junctions[0]!.id;
		const curved = curvedForty();
		const straight = straightForty();
		const curvedCalls = record(() =>
			preflightWallFirstArchitectureCandidate(curved, junctionMove(curved, junctionIdOf(curved), 0.05))
		);
		const straightCalls = record(() =>
			preflightWallFirstArchitectureCandidate(straight, junctionMove(straight, junctionIdOf(straight), 0.05))
		);
		const samples = (calls: RecordedCall[]) => calls.reduce((total, call) => total + call.count, 0);
		// A line centreline yields its two endpoint samples; every cubic wall yields many.
		expect(straightCalls.every((call) => call.count <= 2), 'straight walls stay two-sample lines').toBe(true);
		expect(samples(curvedCalls), 'curved preflight samples ≫ straight control').toBeGreaterThan(samples(straightCalls));
		console.log(
			`S0 P8 preflight requests curved=${curvedCalls.length}/samples=${samples(curvedCalls)} straight=${straightCalls.length}/samples=${samples(straightCalls)}`
		);
	});
});
