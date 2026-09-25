/**
 * P23B.5 S0 — reachability / identity proof (EVIDENCE ONLY, correction round 1).
 *
 * These are bounded diagnostic probes over the REAL preflight, release and
 * restore/replacement entry points on committed fixtures. They implement
 * NOTHING: no new owner, no retained store, no key change. Every assertion
 * either states a landed identity/equality fact or simulates a *prospective*
 * owner by replaying the CAPTURED real sampler inputs through the landed
 * `createWallSamplingDerivation`.
 *
 * Corrections from review of the first revision (`4a33c23d`):
 *
 * - The cross-call sharing proof no longer infers identity from "a mutation is
 *   observed by the next call" — a deep-clone-per-call preflight would also
 *   observe it. The test-only observation now carries the actual centerline
 *   reference, and P3 asserts cross-call REFERENCE equality directly.
 * - P4 replays those captured references (not fixture lookups) and compares the
 *   COMPLETE `SampledSegment` (segmentId, length, every sample field), so
 *   "full-result equality" includes `length`.
 * - Replacement is separated from snapshot restore: restore/undo/redo issue zero
 *   sampling requests (P7), while replacement decodes and re-derives (P9) and
 *   therefore mints fresh centerline objects.
 *
 * Probes:
 *   P1 source → parsed → compiled identities      P6 mutation hazard
 *   P2 release identity refresh + rejection       P7 restore/undo/redo (N/A)
 *   P3 preflight cross-call reference equality    P8 straight control
 *   P4 prospective gesture-scoped owner (sim)     P9 replacement (re-decode)
 *   P5 segmentId metadata hazard
 *
 * The disposition these probes support is recorded in the P23B.5 plan §0.
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
	type LayoutWallCenterline,
	type SampledSegment,
	type WallCenterlineTraversal
} from '@portfolio/layout-core';
import { buildP23BMatrixFixture, P23B_MATRIX_SPECS } from '$lib/bench/p23b-fixtures';
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

function sha(value: string): string {
	return createHash('sha256').update(value).digest('hex').slice(0, 16);
}

/** Digest the COMPLETE returned artefact: id, length and every sample field. */
function hashSegment(segment: SampledSegment | undefined): string {
	if (!segment) return 'undefined';
	return sha(
		JSON.stringify({
			id: segment.segmentId,
			len: segment.length,
			samples: segment.samples.map((sample) => ({
				p: sample.point,
				d: sample.distance,
				tan: sample.tangent,
				nor: sample.normal,
				u: sample.t
			}))
		})
	);
}

type RecordedCall = {
	wallId: string;
	segmentId: string;
	/** The actual key input: the centerline OBJECT the sampler read. */
	centerline: LayoutWallCenterline;
	traversal: WallCenterlineTraversal;
	start: LayoutVec2;
	end: LayoutVec2;
	ok: boolean;
	/** Full-artefact digest (segmentId + length + all sample fields). */
	hash: string;
	length: number | null;
	count: number;
};

/** One real consumer/preflight invocation, observed through the test-only hook. */
function record(work: () => void): RecordedCall[] {
	const calls: RecordedCall[] = [];
	setWallSamplingObserverForTest((observation, result) => {
		calls.push({
			wallId: observation.wallId,
			segmentId: result?.segmentId ?? 'undefined',
			centerline: observation.centerline,
			traversal: observation.traversal,
			start: [observation.start[0], observation.start[1]] as LayoutVec2,
			end: [observation.end[0], observation.end[1]] as LayoutVec2,
			ok: observation.ok,
			hash: hashSegment(result),
			length: result ? result.length : null,
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

/** Every wall id → the set of distinct centerline OBJECTS observed for it. */
function centerlineRefsByWallId(calls: readonly RecordedCall[]): Map<string, Set<LayoutWallCenterline>> {
	const refs = new Map<string, Set<LayoutWallCenterline>>();
	for (const call of calls) {
		let set = refs.get(call.wallId);
		if (!set) {
			set = new Set<LayoutWallCenterline>();
			refs.set(call.wallId, set);
		}
		set.add(call.centerline);
	}
	return refs;
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
		expect(secondRequests.map((call) => keyOf(call))).toEqual(firstRequests.map((call) => keyOf(call)));
		const derived = firstRequests.filter((call) => call.ok);
		expect(derived.length, 'curved walls actually derive samples').toBeGreaterThan(0);

		const distinctKeys = new Set(firstRequests.map((call) => keyOf(call)));
		// 120 requests, only 80 distinct (wall, traversal, endpoints) VALUE keys: the
		// pre/post stages re-request value-identical inputs, so object identity alone
		// is what refuses a cross-stage hit (this is the P2 evidence claim).
		expect(distinctKeys.size, 'value keys recur across the pre/post stages').toBe(80);
		const traversals = firstRequests.reduce<Record<string, number>>((counts, call) => {
			const bucket = `${call.ok ? 'ok' : 'undefined'}:${call.traversal}`;
			counts[bucket] = (counts[bucket] ?? 0) + 1;
			return counts;
		}, {});
		console.log(
			`S0 P2 release requests/call (curved-40)=${firstRequests.length} distinctValueKeys=${distinctKeys.size} derived=${derived.length} byTraversal=${JSON.stringify(traversals)}`
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

	it('P3 preflight: repeated calls re-present the SAME baseline centerline OBJECTS (cross-call reference equality)', () => {
		const doc = curvedForty();
		const junctionId = doc.junctions[0]!.id;
		const incident = incidentWallIds(doc, junctionId);
		const untouched = doc.walls.filter((wall) => !incident.has(wall.id) && wall.centerline.kind === 'cubic-chain');
		expect(untouched.length).toBeGreaterThan(0);

		// Two pointermoves over ONE frozen baseline, exactly as the gesture calls it.
		const first = record(() => preflightWallFirstArchitectureCandidate(doc, junctionMove(doc, junctionId, 0.05)));
		const second = record(() => preflightWallFirstArchitectureCandidate(doc, junctionMove(doc, junctionId, 0.1)));
		expect(first.length, 'preflight samples the document walls').toBeGreaterThan(0);

		// DIRECT PROOF: the actual sampler input (`wall.centerline`) is ONE object per
		// Wall across the two calls, and it is the frozen baseline's own object. A
		// deep-clone-per-call preflight would show two distinct equal objects here.
		const docWallById = new Map(doc.walls.map((wall) => [wall.id, wall] as const));
		const refs = centerlineRefsByWallId([...first, ...second]);
		expect(refs.size, 'every sampled Wall observed').toBeGreaterThan(0);
		for (const [wallId, set] of refs) {
			expect(set.size, `${wallId} exactly one centerline object across calls`).toBe(1);
			const docWall = docWallById.get(wallId);
			expect(docWall, `${wallId} belongs to the baseline`).toBeDefined();
			expect([...set][0], `${wallId} is the baseline's centerline object`).toBe(docWall!.centerline);
		}
		// Every untouched curved Wall is sampled at least once (the P4 population).
		for (const wall of untouched) {
			expect(refs.get(wall.id)?.size, `${wall.id} sampled by the preflight`).toBe(1);
		}
		// Values are stable across the two calls for every untouched Wall.
		const byKey = new Map(first.map((call) => [keyOf(call), call]));
		for (const call of second) {
			const prior = byKey.get(keyOf(call));
			if (!prior) continue;
			expect(call.hash, `untouched samples identical: ${call.wallId}`).toBe(prior.hash);
		}
		console.log(`S0 P3 preflight requests/call (curved-40)=${first.length} untouchedCurvedWalls=${untouched.length}`);
	});

	it('P4 prospective gesture-scoped owner (SIMULATION): captured real inputs repeat, so the landed store would hit', () => {
		const doc = curvedForty();
		const junctionId = doc.junctions[0]!.id;
		const steps = [0.05, 0.1, 0.15].map((dx) =>
			record(() => preflightWallFirstArchitectureCandidate(doc, junctionMove(doc, junctionId, dx)))
		);
		expect(steps[0]!.length).toBeGreaterThan(0);

		// Replay the CAPTURED inputs — the exact centerline objects P3 proved the
		// preflight read — through the LANDED derivation. This mirrors a
		// gesture-scoped owner without adding one.
		const retained = createWallSamplingDerivation();
		let replayed = 0;
		for (const step of steps) {
			for (const call of step) {
				const derived = retained.samples(
					{ id: call.wallId, centerline: call.centerline },
					call.start,
					call.end,
					call.traversal
				);
				replayed += 1;
				// COMPLETE-result equality against the observed fresh result, including
				// `segmentId` and `length`.
				expect(hashSegment(derived), `full result equals observed: ${call.wallId}`).toBe(call.hash);
				expect(derived?.segmentId, `segmentId matches: ${call.wallId}`).toBe(call.segmentId);
				expect(derived?.length, `length matches: ${call.wallId}`).toBe(call.length);
				expect(derived?.samples.length, `sample count matches: ${call.wallId}`).toBe(call.count);
			}
		}
		expect(replayed).toBe(steps.reduce((total, step) => total + step.length, 0));
		// A store keyed on centerline identity cannot hit twice for two DISTINCT
		// objects, so hits here ARE cross-call reference repetition over real inputs.
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

describe('P23B.5 S0 — restore and replacement are different paths', () => {
	it('P7 restore / undo / redo reinstates an existing snapshot: same geometry object, zero sampling requests (N/A)', () => {
		const state = createEmptyWallFirstLayoutPreviewState();
		expect(importLayoutPreviewJson(state, serializeWallFirstLayoutDocument(curvedForty()))).toBe(true);
		const snapshot = captureLayoutPreviewSnapshot(state);
		const calls = record(() => restoreLayoutPreviewSnapshot(state, snapshot));
		// Undo/redo and cancel route through this exact capture/replace host pair, so
		// the count applies to them too. No document is re-parsed → no sampling.
		expect(calls, 'restore issues no sampling requests (N/A, not a 0% hit rate)').toEqual([]);
		expect(state.geometry, 'restore reinstates the snapshot geometry object').toBe(snapshot.geometry);
		expect(record(() => restoreLayoutPreviewSnapshot(state, snapshot))).toEqual([]);
	});

	it('P9 replacement is NOT the restore path: it decodes and re-derives, minting fresh centerlines', () => {
		const state = createEmptyWallFirstLayoutPreviewState();
		const json = serializeWallFirstLayoutDocument(curvedForty());
		const first = record(() => importLayoutPreviewJson(state, json));
		const second = record(() => importLayoutPreviewJson(state, json));
		expect(first.length, 'replacement decodes + derives → it samples').toBeGreaterThan(0);
		expect(second.length, 'a second replacement samples again').toBeGreaterThan(0);

		const refsByWallId = new Map<string, LayoutWallCenterline>();
		for (const call of first) refsByWallId.set(call.wallId, call.centerline);
		let compared = 0;
		for (const call of second) {
			const prior = refsByWallId.get(call.wallId);
			if (!prior) continue;
			// Same content, fresh object per decode: an identity-keyed store cannot
			// carry a hit across a replacement.
			expect(call.centerline, `${call.wallId} fresh identity after re-decode`).not.toBe(prior);
			compared += 1;
		}
		expect(compared, 'walls compared across the two replacements').toBeGreaterThan(0);
		console.log(`S0 P9 replacement requests first=${first.length} second=${second.length} compared=${compared}`);
	});
});

describe('P23B.5 S0 — controls', () => {
	it('P8 the prospective preflight opportunity is curvature-scaled, not cardinality-scaled', () => {
		const curved = curvedForty();
		const straight = straightForty();
		const curvedCalls = record(() =>
			preflightWallFirstArchitectureCandidate(curved, junctionMove(curved, curved.junctions[0]!.id, 0.05))
		);
		const straightCalls = record(() =>
			preflightWallFirstArchitectureCandidate(straight, junctionMove(straight, straight.junctions[0]!.id, 0.05))
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
