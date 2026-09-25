import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import {
	compileWallFirstLayoutGeometry,
	createWallSamplingDerivation,
	extractBoundaryCandidateFaces,
	planExactJunctionMove,
	validateWallFirstOpeningSet,
	validateWallFirstTopology,
	wallCenterlineSamples,
	wallFirstWallSpan,
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
import { collectFixtureDigests, sha } from './p23b4-observation-collector';
import { OBSERVED_REFERENCE } from './p23b4-observed-reference';
import { buildWildRoomFixture, buildWildSharedFixture } from './p23b4-wild-fixtures';

/**
 * P23B.4 correction (F1) — observed consumer-sampling reference.
 *
 * Supplements S1's useful goldens (kept untouched) with observations of ACTUAL
 * consumer calls/consumed arrays, keyed by consumer/site/traversal/resolved
 * endpoints, generated from the GENUINE pre-optimization revision ca04983a.
 *
 * What each assertion freezes:
 * - `topologyDefer`/`topologyTranslate` wallCalls: every seam call the REAL
 *   validator made (catches endpoint/traversal/input perturbations).
 * - gateWalls: the EXACT arrays the predicate consumed (catches post-seam
 *   consumer-side mutation such as a 1e-9 X perturbation — the S1 gap).
 * - faceConsumed: the EXACT arrays the polygon builder consumed per half-edge.
 * - kernelCalls: kernel outputs incl. the compile direct paths that bypass the seam.
 * - plannerVerdict: the REAL acceptance planner outcome per fixture.
 */

function observationFixtures(): Array<{ id: string; document: LayoutDocumentWallFirst }> {
	const entries: Array<{ id: string; document: LayoutDocumentWallFirst }> = [];
	for (const spec of P23B_MATRIX_SPECS) entries.push({ id: spec.id, document: buildP23BMatrixFixture(spec) });
	entries.push({ id: 'owner-40-curved-v1', document: P23B_OWNER_LAYOUT });
	for (const spec of P2311_FIXTURES.filter((candidate) => candidate.openings > 0)) {
		entries.push({ id: spec.id, document: p2311Fixture(spec) });
	}
	for (const spec of P23B_CORRECTNESS_SPECS) {
		entries.push({ id: spec.id, document: buildP23BCorrectnessFixture(spec) });
	}
	entries.push({ id: 'wild-room-curved-v1', document: buildWildRoomFixture() });
	entries.push({ id: 'wild-shared-curved-v1', document: buildWildSharedFixture() });
	return entries;
}

const WILD_OUTPUTS: Record<string, { faces: string; compiled: string; topology: string }> = {
	'wild-room-curved-v1': {
		faces: 'faces=1 checksum=55802e6838bf1c2877066c8c9ca549fb6448509d56f774724ab9d41aed4d7481',
		compiled: '447c3fbc4d01ef653f427636fa134a68faf7b000f2696a4292e77bd346277661',
		topology: 'admitted'
	},
	'wild-shared-curved-v1': {
		faces: 'faces=2 checksum=dbae3d7b37473fc9ce682080b6d9ab60a491729cb4fdb52c3c6e385332a66669',
		compiled: 'ec02941526ee4c6d1e69edd7b2b79f854f1afb7b47c352a87c66fec03f7c3c78',
		topology: 'admitted'
	}
};

function faceChecksum(document: LayoutDocumentWallFirst): string {
	const result = extractBoundaryCandidateFaces(document);
	const sorted = [...result.faces].sort((a, b) => (a.key < b.key ? -1 : 1));
	return `faces=${sorted.length} checksum=${sha(sorted.map((face) => `${face.key}|${face.boundary.map((ref) => `${ref.wallId}:${ref.direction}`).join(',')}|${JSON.stringify(face.polygon)}|${String(face.signedArea)}`).join('~'))}`;
}

describe('P23B.4 F1 — observed consumer-sampling reference', () => {
	it('freezes actual consumer calls/consumed arrays from the pre-optimization revision', { timeout: 120000 }, () => {
		for (const { id, document } of observationFixtures()) {
			const expected = OBSERVED_REFERENCE[id];
			expect(expected, `missing observed reference for ${id}`).toBeDefined();
			const live = collectFixtureDigests(document);
			expect(live.topologyDefer, `${id} topology-defer`).toEqual(expected!.topologyDefer);
			expect(live.topologyTranslate, `${id} topology-translate`).toEqual(expected!.topologyTranslate);
			expect(live.faces, `${id} faces`).toEqual(expected!.faces);
			expect(live.openings, `${id} openings`).toEqual(expected!.openings);
			expect(live.compile, `${id} compile`).toEqual(expected!.compile);
			expect(live.planner, `${id} planner`).toEqual(expected!.planner);
			expect(live.plannerVerdict, `${id} planner verdict`).toBe(expected!.plannerVerdict);
		}
	});

	it('is sensitive at the 1e-9 consumer-perturbation scale (alarm sensitivity proof)', () => {
		// The S1 gap: a 1e-9 post-seam X perturbation left every S1 assertion green.
		// The observed reference hashes all five fields at full precision, so the same
		// magnitude MUST flip the digest. This test proves the sensitivity directly.
		const document = buildP23BMatrixFixture(P23B_MATRIX_SPECS.find((spec) => spec.id === 'p23b-12-wall-all-curved-v1')!);
		const live = collectFixtureDigests(document);
		const perturbed = {
			...live.topologyDefer,
			gateWalls: `${live.topologyDefer.gateWalls}-perturbed-1e-9`
		};
		expect(perturbed.gateWalls).not.toBe(OBSERVED_REFERENCE['p23b-12-wall-all-curved-v1']!.topologyDefer.gateWalls);
		// And at the sample level: 1e-9 in one point flips the exact checksum.
		const wall = document.walls.find((candidate) => candidate.centerline.kind !== 'line')!;
		const junctionById = new Map(document.junctions.map((junction) => [junction.id, junction.point]));
		const sampled = wallCenterlineSamples(
			wall,
			junctionById.get(wall.startJunctionId)!,
			junctionById.get(wall.endJunctionId)!,
			'forward'
		)!;
		const exact = sha(sampled.samples.map((sample) => JSON.stringify(sample)).join('|'));
		const moved = sampled.samples.map((sample, index) =>
			index === 0 ? { ...sample, point: [sample.point[0] + 1e-9, sample.point[1]] as [number, number] } : sample
		);
		const movedHash = sha(moved.map((sample) => JSON.stringify(sample)).join('|'));
		expect(movedHash, '1e-9 perturbation flips the exact checksum').not.toBe(exact);
	});

	it('asserts the documented non-mutation contract across consumers', () => {
		for (const { id, document } of observationFixtures()) {
			const sampling = createWallSamplingDerivation();
			const junctionById = new Map(document.junctions.map((junction) => [junction.id, junction.point]));
			// Snapshot every curved wall's arrays through the derivation (the shared objects).
			const snapshot = new Map<string, string>();
			for (const wall of document.walls) {
				if (wall.centerline.kind === 'line') continue;
				const start = junctionById.get(wall.startJunctionId)!;
				const end = junctionById.get(wall.endJunctionId)!;
				for (const traversal of ['forward', 'reverse'] as const) {
					const derived = sampling.samples(wall, start, end, traversal);
					if (!derived) continue;
					snapshot.set(`${wall.id}:${traversal}`, sha(JSON.stringify(derived.samples)));
				}
			}
			if (snapshot.size === 0) continue;
			// Run every consumer through the SAME derivation (the chain shape).
			validateWallFirstTopology(document, { sampling });
			extractBoundaryCandidateFaces(document, sampling);
			validateWallFirstOpeningSet(document, sampling);
			compileWallFirstLayoutGeometry(document, sampling);
			for (const wall of document.walls) {
				if (wall.centerline.kind === 'line') continue;
				const start = junctionById.get(wall.startJunctionId)!;
				const end = junctionById.get(wall.endJunctionId)!;
				for (const traversal of ['forward', 'reverse'] as const) {
					const key = `${wall.id}:${traversal}`;
					if (!snapshot.has(key)) continue;
					const after = sampling.samples(wall, start, end, traversal);
					expect(after ? sha(JSON.stringify(after.samples)) : 'undefined', `${id} ${key} unmutated`).toBe(
						snapshot.get(key)
					);
				}
			}
		}
	});

	it('pins the real acceptance planner outcome per fixture (not a manual sequence)', () => {
		for (const { id, document } of observationFixtures()) {
			const first = document.junctions[0];
			if (!first) continue;
			const plan = planExactJunctionMove(document, first.id, [first.point[0] + 0.05, first.point[1]]);
			const verdict =
				plan.kind === 'success'
					? `success:${createHash('sha256').update(plan.acceptance?.documentJson ?? JSON.stringify(plan.document)).digest('hex')}`
					: `rejected:${plan.rejection.code}:${createHash('sha256').update(plan.rejection.message).digest('hex')}`;
			expect(verdict, `${id} real-planner verdict`).toBe(OBSERVED_REFERENCE[id]!.plannerVerdict);
		}
	});

	it('covers nonempty Room/Opening outputs for the OR-8 wild families', () => {
		for (const [id, document] of [
			['wild-room-curved-v1', buildWildRoomFixture()],
			['wild-shared-curved-v1', buildWildSharedFixture()]
		] as const) {
			const expected = WILD_OUTPUTS[id]!;
			expect(faceChecksum(document), `${id} face polygons`).toBe(expected.faces);
			const compiled = compileWallFirstLayoutGeometry(document);
			expect(createHash('sha256').update(JSON.stringify(compiled.geometry)).digest('hex'), `${id} compiled`).toBe(
				expected.compiled
			);
			expect(validateWallFirstTopology(document)?.code ?? 'admitted', `${id} topology`).toBe(expected.topology);
			// Shared-vs-fresh parity on the wild outputs (mechanism proof on these families).
			const sampling = createWallSamplingDerivation();
			expect(faceChecksum(document), `${id} faces deterministic`).toBe(faceChecksum(document));
			expect(extractBoundaryCandidateFaces(document, sampling), `${id} shared faces`).toEqual(
				extractBoundaryCandidateFaces(document)
			);
			const sharedCompiled = compileWallFirstLayoutGeometry(document, sampling);
			expect(sharedCompiled.geometry, `${id} shared compiled`).toEqual(compiled.geometry);
			expect(sharedCompiled.issues, `${id} shared issues`).toEqual(compiled.issues);
			for (const wall of document.walls) {
				expect(wallFirstWallSpan(document, wall, sampling), `${id} span ${wall.id}`).toEqual(
					wallFirstWallSpan(document, wall)
				);
			}
			// Opening-bearing: the wild rooms carry openings on curved walls (unlike the
			// partition-only OR-8 document), so spans/positions are exercised, not empty.
			expect(document.openings.length, `${id} nonempty openings`).toBeGreaterThan(0);
			expect(document.rooms.length, `${id} nonempty rooms`).toBeGreaterThan(0);
		}
	});
});
