import { describe, expect, it } from 'vitest';

import {
	compileWallFirstLayoutGeometry,
	createWallSamplingDerivation,
	extractBoundaryCandidateFaces,
	validateWallFirstTopology,
	wallCenterlineSamples,
	type LayoutDocumentWallFirst
} from '@portfolio/layout-core';
import {
	buildP23BCorrectnessFixture,
	buildP23BMatrixFixture,
	P23B_CORRECTNESS_SPECS,
	P23B_MATRIX_SPECS,
	P23B_OWNER_LAYOUT
} from '$lib/bench/p23b-fixtures';
import { p2311Fixture, P2311_FIXTURES } from '$lib/bench/p2311-bend-fixtures';

/**
 * P23B.4 S2 — thread the derivation through face extraction (OR-1/OR-2 for this consumer).
 *
 * OR-1 (this consumer): faces derived through the shared derivation are array-equal to
 * faces derived by today's per-call sampling. S1 pins today's sampling to committed
 * expectations, so shared == fresh + fresh == S1 gives shared == S1 by transitivity.
 * OR-2 (traversal): the key keeps traversal (conservative form) — forward and reverse
 * are independently derived, never reverse-on-read; recorded by the assertions below.
 */

function s2Fixtures(): Array<{ id: string; document: LayoutDocumentWallFirst }> {
	const entries: Array<{ id: string; document: LayoutDocumentWallFirst }> = [];
	for (const spec of P23B_MATRIX_SPECS) entries.push({ id: spec.id, document: buildP23BMatrixFixture(spec) });
	entries.push({ id: 'owner-40-curved-v1', document: P23B_OWNER_LAYOUT });
	for (const spec of P2311_FIXTURES.filter((candidate) => candidate.openings > 0)) {
		entries.push({ id: spec.id, document: p2311Fixture(spec) });
	}
	for (const spec of P23B_CORRECTNESS_SPECS) {
		entries.push({ id: spec.id, document: buildP23BCorrectnessFixture(spec) });
	}
	return entries;
}

function curvedBoundaryWalls(document: LayoutDocumentWallFirst): number {
	return document.walls.filter((wall) => wall.role === 'boundary' && wall.centerline.kind !== 'line').length;
}

describe('P23B.4 S2 — shared derivation through face extraction', () => {
	it('OR-1: shared-derivation faces are array-equal to fresh-sampling faces', () => {
		for (const { id, document } of s2Fixtures()) {
			const sampling = createWallSamplingDerivation();
			const shared = extractBoundaryCandidateFaces(document, sampling);
			const fresh = extractBoundaryCandidateFaces(document);
			expect(shared, `${id} shared vs fresh`).toEqual(fresh);
			if (curvedBoundaryWalls(document) > 0) {
				expect(sampling.stats.derivations, `${id} derivations`).toBeGreaterThan(0);
			}
		}
	});

	it('shares across repeated passes with stable keys (the pre/post analogue)', () => {
		for (const { id, document } of s2Fixtures()) {
			const sampling = createWallSamplingDerivation();
			const first = extractBoundaryCandidateFaces(document, sampling);
			const derivationsAfterFirst = sampling.stats.derivations;
			const hitsAfterFirst = sampling.stats.hits;
			const second = extractBoundaryCandidateFaces(document, sampling);
			expect(second, `${id} second pass`).toEqual(first);
			expect(sampling.stats.derivations, `${id} no new derivations on repeat`).toBe(derivationsAfterFirst);
			if (derivationsAfterFirst > 0) {
				expect(sampling.stats.hits, `${id} repeat pass is all hits`).toBeGreaterThan(hitsAfterFirst);
			}
		}
	});

	it('OR-2: traversal stays in the key — reverse is independently derived', () => {		const document = buildP23BMatrixFixture(P23B_MATRIX_SPECS.find((spec) => spec.id === 'p23b-12-wall-all-curved-v1')!);
		const junctionById = new Map(document.junctions.map((junction) => [junction.id, junction.point]));
		const sampling = createWallSamplingDerivation();
		for (const wall of document.walls) {
			if (wall.centerline.kind === 'line') continue;
			const start = junctionById.get(wall.startJunctionId)!;
			const end = junctionById.get(wall.endJunctionId)!;
			const forward = sampling.samples(wall, start, end, 'forward')!;
			const reverse = sampling.samples(wall, start, end, 'reverse')!;
			// Same-traversal repeat returns THE SAME array object (the sharing proof).
			expect(sampling.samples(wall, start, end, 'forward'), `${wall.id} forward identity`).toBe(forward);
			// Conservative form: reverse is its own derivation, array-equal to fresh reverse…
			expect(reverse, `${wall.id} reverse equals fresh`).toEqual(wallCenterlineSamples(wall, start, end, 'reverse'));
			// …and NOT servable by reversing the forward array (recorded either way: it is not).
			expect(reverse, `${wall.id} reverse is not reversed-forward`).not.toEqual(forward);
			expect(reverse, `${wall.id} reverse is a distinct object`).not.toBe(forward);
		}
		expect(sampling.stats.derivations).toBe(document.walls.filter((wall) => wall.centerline.kind !== 'line').length * 2);
	});
});

describe('P23B.4 S3 — shared derivation through topology pre/post', () => {
	it('EQ-1: one context is correct for two documents sharing wall IDs (N-2 admitted, N-2i rejected)', () => {
		const admitted = buildP23BCorrectnessFixture(
			P23B_CORRECTNESS_SPECS.find((spec) => spec.id === 'N-2')!
		);
		const rejected = buildP23BCorrectnessFixture(
			P23B_CORRECTNESS_SPECS.find((spec) => spec.id === 'N-2i')!
		);
		// Same wall IDs, different centerline objects and geometry: a wall-id-keyed
		// cache would serve one document's samples to the other and flip a verdict.
		expect(admitted.walls.map((wall) => wall.id).sort()).toEqual(
			rejected.walls.map((wall) => wall.id).sort()
		);
		const sampling = createWallSamplingDerivation();
		const sharedAdmitted = validateWallFirstTopology(admitted, { sampling });
		const sharedRejected = validateWallFirstTopology(rejected, { sampling });
		expect(sharedAdmitted, 'N-2 stays admitted under sharing').toBeUndefined();
		expect(sharedRejected?.code, 'N-2i stays rejected under sharing').toBe('unsupported_wall_topology');
		// Each equals its own fresh path (OR-1 for this consumer, both inputs).
		expect(sharedAdmitted, 'N-2 shared equals fresh').toEqual(validateWallFirstTopology(admitted));
		expect(sharedRejected, 'N-2i shared equals fresh').toEqual(validateWallFirstTopology(rejected));
		// Both documents derived independently (no cross-document key collision).
		expect(sampling.stats.derivations).toBeGreaterThanOrEqual(2);
	});

	it('OR-1: shared topology verdicts equal fresh verdicts on every S1 fixture', () => {
		for (const { id, document } of s2Fixtures()) {
			const sampling = createWallSamplingDerivation();
			expect(validateWallFirstTopology(document, { sampling }), `${id} defer`).toEqual(
				validateWallFirstTopology(document, { openingSet: 'defer' })
			);
			// Translate path (Opening spans through the derivation) on all fixtures.
			const samplingTranslate = createWallSamplingDerivation();
			expect(validateWallFirstTopology(document, { sampling: samplingTranslate }), `${id} translate`).toEqual(
				validateWallFirstTopology(document)
			);
		}
	});

	it('opening-bearing fixtures exercise spans through the derivation', () => {
		for (const spec of P2311_FIXTURES.filter((candidate) => candidate.openings > 0)) {
			const document = p2311Fixture(spec);
			const sampling = createWallSamplingDerivation();
			expect(validateWallFirstTopology(document, { sampling }), spec.id).toEqual(
				validateWallFirstTopology(document)
			);
			expect(sampling.stats.derivations, `${spec.id} spans derived`).toBeGreaterThan(0);
		}
	});
});

describe('P23B.4 S4 — shared derivation through the compile sites', () => {
	it("OR-1: shared compile output is array-equal to fresh output (arc, physical, validation sites)", () => {
		for (const { id, document } of s2Fixtures()) {
			const sampling = createWallSamplingDerivation();
			const shared = compileWallFirstLayoutGeometry(document, sampling);
			const fresh = compileWallFirstLayoutGeometry(document);
			expect(shared.geometry, `${id} shared geometry`).toEqual(fresh.geometry);
			expect(shared.issues, `${id} shared issues`).toEqual(fresh.issues);
			expect(sampling.stats.derivations, `${id} derivations serve all three sites`).toBeGreaterThan(0);
		}
	});

	it('shares across rooms and sites: one context serves repeated compiles', () => {
		for (const { id, document } of s2Fixtures()) {
			const sampling = createWallSamplingDerivation();
			const first = compileWallFirstLayoutGeometry(document, sampling);
			const derivationsAfterFirst = sampling.stats.derivations;
			const second = compileWallFirstLayoutGeometry(document, sampling);
			expect(second.geometry, `${id} second compile`).toEqual(first.geometry);
			expect(sampling.stats.derivations, `${id} no new derivations on repeat`).toBe(derivationsAfterFirst);
		}
	});
});
