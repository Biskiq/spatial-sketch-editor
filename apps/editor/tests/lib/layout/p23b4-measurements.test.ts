/**
 * P23B.4 F3 — shared-derivation output equivalence on the acceptance chain.
 *
 * PR #115 (§7.2 category A″) deleted the measurement half of this file: the
 * advisory wall-clock p50/p95 report, the kernel-evaluation observation counts
 * and the `bench-harness` timing helper all measured work rather than output,
 * and the PERF/P23B apparatus went with the editor shell.
 *
 * What is kept is the equivalence claim the measurement sat beside — the
 * validation/compile chain produces identical output with and without a shared
 * sampling derivation, on the committed matrix and bend fixtures. "Identical"
 * means the completed validators, the extracted faces, the Opening-set issues
 * and the compiled geometry, compared by value.
 */
import { describe, expect, it } from 'vitest';

import {
	compileWallFirstLayoutGeometry,
	createWallSamplingDerivation,
	extractBoundaryCandidateFaces,
	validateWallFirstOpeningSet,
	validateWallFirstTopology,
	type LayoutDocumentWallFirst
} from '@portfolio/layout-core';
import { buildP23BMatrixFixture, P23B_MATRIX_SPECS } from './__fixtures__/p23b-fixtures';
import { p2311Fixture, P2311_FIXTURES } from './__fixtures__/p2311-bend-fixtures';

function fixtureById(id: string): LayoutDocumentWallFirst {
	const matrixSpec = P23B_MATRIX_SPECS.find((spec) => spec.id === id);
	if (matrixSpec) return buildP23BMatrixFixture(matrixSpec);
	const bendSpec = P2311_FIXTURES.find((spec) => spec.id === id);
	if (bendSpec) return p2311Fixture(bendSpec);
	throw new Error(`unknown fixture ${id}`);
}

function chainFixtures(): Array<{ id: string; document: LayoutDocumentWallFirst }> {
	return [
		{ id: 'p23b-40-wall-straight-v1', document: fixtureById('p23b-40-wall-straight-v1') },
		{ id: 'p23b-40-wall-all-curved-v1', document: fixtureById('p23b-40-wall-all-curved-v1') },
		{ id: 'bend-3-room-openings', document: fixtureById('bend-3-room-openings') }
	];
}

/** The manual acceptance sequence, on a JSON round-trip copy, with the shared derivation optional. */
function chain(document: LayoutDocumentWallFirst, shared: boolean) {
	const sampling = shared ? createWallSamplingDerivation() : undefined;
	const postDoc = JSON.parse(JSON.stringify(document)) as LayoutDocumentWallFirst;
	const topologyPre = validateWallFirstTopology(
		document,
		shared ? { openingSet: 'defer', sampling } : { openingSet: 'defer' }
	);
	const faces = extractBoundaryCandidateFaces(postDoc, sampling);
	const topologyPost = validateWallFirstTopology(
		postDoc,
		shared ? { openingSet: 'defer', sampling } : { openingSet: 'defer' }
	);
	const openingIssues = validateWallFirstOpeningSet(postDoc, sampling);
	const compiled = compileWallFirstLayoutGeometry(postDoc, sampling);
	return { topologyPre, faces, topologyPost, openingIssues, compiled };
}

describe('P23B.4 F3 — shared-derivation output equivalence on the acceptance chain', () => {
	it('validates every chain fixture before comparing it', () => {
		for (const { id, document } of chainFixtures()) {
			expect(validateWallFirstTopology(document), `${id} baseline topology`).toBeUndefined();
		}
	});

	it('produces identical validator verdicts with and without a shared derivation', () => {
		for (const { id, document } of chainFixtures()) {
			const shared = chain(document, true);
			const fresh = chain(document, false);
			expect(shared.topologyPre ?? null, `${id} pre-topology`).toEqual(fresh.topologyPre ?? null);
			expect(shared.topologyPost ?? null, `${id} post-topology`).toEqual(fresh.topologyPost ?? null);
			expect(shared.openingIssues, `${id} opening issues`).toEqual(fresh.openingIssues);
		}
	});

	it('produces identical extracted faces with and without a shared derivation', () => {
		for (const { id, document } of chainFixtures()) {
			expect(chain(document, true).faces, `${id} faces`).toEqual(chain(document, false).faces);
		}
	});

	it('produces identical compiled geometry with and without a shared derivation', () => {
		for (const { id, document } of chainFixtures()) {
			const shared = chain(document, true).compiled;
			const fresh = chain(document, false).compiled;
			expect(shared.geometry, `${id} compiled geometry`).toEqual(fresh.geometry);
			expect(shared.issues, `${id} compile issues`).toEqual(fresh.issues);
		}
	});
});
