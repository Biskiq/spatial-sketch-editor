import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import {
	clearSampleSegmentObserverForTest,
	compileWallFirstLayoutGeometry,
	createWallSamplingDerivation,
	extractBoundaryCandidateFaces,
	setSampleSegmentObserverForTest,
	topologyComponentKeyByWallId,
	validateWallFirstOpeningSet,
	validateWallFirstTopology,
	type LayoutDocumentWallFirst
} from '@portfolio/layout-core';
import { buildP23BMatrixFixture, P23B_MATRIX_SPECS } from '$lib/bench/p23b-fixtures';
import { P23B_OWNER_LAYOUT } from '$lib/bench/p23b-fixtures';
import { p2311Fixture, P2311_FIXTURES } from '$lib/bench/p2311-bend-fixtures';
import { timeOp } from '$lib/bench/bench-harness';

/**
 * P23B.4 correction (F3) — reproducible mechanism-level measurement.
 *
 * Scope (explicitly narrowed, see evidence findings X-3): CONTROLLED NODE
 * measurements of the validation/compile chain on committed fixtures. Kept
 * EXPLICITLY SEPARATE from method-v5 browser results; no browser-interaction,
 * settlement, flush or frame improvement is claimed. Post-release flush/frame
 * pairs do not exist in the accepted baseline and are not compared against.
 *
 * - Deterministic kernel-evaluation and pair counts are asserted (exact).
 * - Wall-clock is REPORTED as p50/p95 with explicit warmup/samples/fixture
 *   hashes/environment, never asserted as a threshold (advisory, no enforced
 *   budget proposed). A loss or inconclusive result is recorded as-is.
 * - M-2a is measured SEPARATELY against the post-policy pre-prune behavior with
 *   M-1 held fixed (same shared derivation setting, prune on/off via the
 *   test-only flag), extent overhead included. Attribution is 60→40 evaluated
 *   pairs on curved-40 (component policy already scopes 780→60), not 780→40.
 */

const WARMUP = 5;
const SAMPLES = 15;

function fixtureHash(document: LayoutDocumentWallFirst): string {
	return createHash('sha256').update(JSON.stringify(document)).digest('hex').slice(0, 16);
}

function countKernelEvals(work: () => void): number {
	let count = 0;
	setSampleSegmentObserverForTest(() => {
		count += 1;
	});
	try {
		work();
	} finally {
		clearSampleSegmentObserverForTest();
	}
	return count;
}

function chainRound(document: LayoutDocumentWallFirst, postDoc: LayoutDocumentWallFirst, shared: boolean): void {
	const sampling = shared ? createWallSamplingDerivation() : undefined;
	validateWallFirstTopology(document, shared ? { openingSet: 'defer', sampling } : { openingSet: 'defer' });
	extractBoundaryCandidateFaces(document, sampling);
	validateWallFirstTopology(postDoc, shared ? { openingSet: 'defer', sampling } : { openingSet: 'defer' });
	validateWallFirstOpeningSet(postDoc, sampling);
	compileWallFirstLayoutGeometry(postDoc, sampling);
}

function measurementFixtures(): Array<{ id: string; document: LayoutDocumentWallFirst }> {
	return [
		{ id: 'p23b-40-wall-straight-v1', document: buildP23BMatrixFixture(P23B_MATRIX_SPECS.find((s) => s.id === 'p23b-40-wall-straight-v1')!) },
		{ id: 'p23b-40-wall-all-curved-v1', document: buildP23BMatrixFixture(P23B_MATRIX_SPECS.find((s) => s.id === 'p23b-40-wall-all-curved-v1')!) },
		{ id: 'owner-40-curved-v1', document: P23B_OWNER_LAYOUT },
		{ id: 'bend-3-room-openings', document: p2311Fixture(P2311_FIXTURES.find((s) => s.id === 'bend-3-room-openings')!) }
	];
}

describe('P23B.4 F3 — mechanism-level measurement (repeatable, advisory wall-clock)', () => {
	it('records M-1 chain counts and p50/p95 with provenance', { timeout: 120000 }, () => {
		console.log(`provenance: node=${process.version} platform=${process.platform}/${process.arch} warmup=${WARMUP} samples=${SAMPLES} date=${new Date().toISOString()}`);
		console.log('method: manual acceptance sequence (topology-pre, faces, topology-post, opening-set, compile); post on JSON round-trip copy; marks nested, containment only, never summed');
		for (const { id, document } of measurementFixtures()) {
			const postDoc = JSON.parse(JSON.stringify(document)) as LayoutDocumentWallFirst;
			const beforeEvals = countKernelEvals(() => chainRound(document, postDoc, false));
			const afterEvals = countKernelEvals(() => chainRound(document, postDoc, true));
			const before = timeOp(() => chainRound(document, JSON.parse(JSON.stringify(document)) as LayoutDocumentWallFirst, false), { warmup: WARMUP, samples: SAMPLES });
			const after = timeOp(() => chainRound(document, JSON.parse(JSON.stringify(document)) as LayoutDocumentWallFirst, true), { warmup: WARMUP, samples: SAMPLES });
			console.log(`${id} fixtureHash=${fixtureHash(document)} kernelEvals before=${beforeEvals} after=${afterEvals} msBefore p50=${before.p50.toFixed(2)} p95=${before.p95.toFixed(2)} msAfter p50=${after.p50.toFixed(2)} p95=${after.p95.toFixed(2)}`);
			// Deterministic assertions only (no wall-clock threshold).
			expect(afterEvals, `${id} shared evals below default`).toBeLessThanOrEqual(beforeEvals);
			if (id === 'p23b-40-wall-all-curved-v1' || id === 'owner-40-curved-v1') {
				expect(beforeEvals, `${id} default evals`).toBe(280);
				expect(afterEvals, `${id} shared evals`).toBe(120);
			}
			if (id === 'p23b-40-wall-straight-v1') {
				expect(beforeEvals, `${id} default evals`).toBe(120);
				expect(afterEvals, `${id} shared evals`).toBe(40);
			}
		}
	});

	it('records M-2a net economics with M-1 held fixed (prune on/off, overhead included)', { timeout: 120000 }, () => {
		for (const { id, document } of measurementFixtures()) {
			// M-1 held fixed: both runs use a fresh shared derivation per call.
			const run = (disablePrune: boolean) => {
				const sampling = createWallSamplingDerivation();
				return validateWallFirstTopology(document, { sampling, disableExtentPruneForTest: disablePrune || undefined });
			};
			run(false);
			run(true);
			const pruned = timeOp(() => run(false), { warmup: WARMUP, samples: SAMPLES });
			const exhaustive = timeOp(() => run(true), { warmup: WARMUP, samples: SAMPLES });
			// Deterministic pair tiers (same-component scoping is P23B.3a policy, not this PR).
			const keyByWallId = topologyComponentKeyByWallId(document);
			const walls = document.walls;
			let total = 0;
			let sameComponent = 0;
			for (let a = 0; a < walls.length; a += 1) {
				for (let b = a + 1; b < walls.length; b += 1) {
					total += 1;
					if (keyByWallId.get(walls[a]!.id) === keyByWallId.get(walls[b]!.id)) sameComponent += 1;
				}
			}
			console.log(`${id} pairs total=${total} sameComponent=${sameComponent} topologyMs pruned p50=${pruned.p50.toFixed(3)} p95=${pruned.p95.toFixed(3)} exhaustive p50=${exhaustive.p50.toFixed(3)} p95=${exhaustive.p95.toFixed(3)}`);
			// Straight-only documents never reach the sampled-pair predicate (chord
			// short-circuit), so their pruned/exhaustive delta is run-to-run noise and
			// MUST NOT be read as extent-scan overhead — the gate never executes there.
			if (id === 'p23b-40-wall-straight-v1' || id === 'bend-3-room-openings') {
				console.log(`${id} note: straight-only pairs bypass the extent gate; delta is noise, not overhead`);
			}
			if (id === 'p23b-40-wall-all-curved-v1' || id === 'owner-40-curved-v1') {
				expect(total, `${id} all pairs`).toBe(780);
				expect(sameComponent, `${id} same-component (P23B.3a policy)`).toBe(60);
			}
			// Verdict parity under both settings is proven in F2; here only the timing
			// distribution is recorded (no threshold asserted — report honestly).
		}
	});
});
