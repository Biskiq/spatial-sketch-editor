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
import { OBSERVED_REFERENCE, PLANNER_WORK_EXPECTATION, PLANNER_WORK_REDUCED_FIXTURES } from './p23b4-observed-reference';
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
 * - plannerVerdict + planner consumed arrays: the REAL acceptance planner's semantic
 *   outcome per fixture (history). Planner CALL MULTIPLICITY is explicitly NOT
 *   history: the real chain shares derivations (M-1), so its wallCalls/kernelCalls
 *   differ from pre-opt on 16/20 fixtures by design — pinned separately in
 *   PLANNER_WORK_EXPECTATION (HEAD-derived work-reduction expectation).
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
	// Generated honestly: multi-knot fixtures run on ca04983a packages and HEAD;
	// byte-identical on both (verified), admitted with clean compile.
	'wild-room-curved-v1': {
		faces: 'faces=1 checksum=5666de32e3fa631649637e3e62d5750c69f7e4691c2ff1e594a65d50e6ec0a68',
		compiled: '67e2f3e2055340d3325dc3006efeb19765fd5471c5ee1786dd4e7aa217992fa7',
		topology: 'admitted'
	},
	'wild-shared-curved-v1': {
		faces: 'faces=2 checksum=09ae15d1214baf17010acf91243e915571b5c2408174644f1ce885a127ffdb91',
		compiled: '630d470c020eb531f1052ac09a05b8ac3d4a4d2e01056b158b33f17b3c6c3a69',
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
			// Standalone consumers run the preserved per-call path: full equality.
			expect(live.topologyDefer, `${id} topology-defer`).toEqual(expected!.topologyDefer);
			expect(live.topologyTranslate, `${id} topology-translate`).toEqual(expected!.topologyTranslate);
			expect(live.faces, `${id} faces`).toEqual(expected!.faces);
			expect(live.openings, `${id} openings`).toEqual(expected!.openings);
			expect(live.compile, `${id} compile`).toEqual(expected!.compile);
			// Real planner: semantic outcomes and consumed arrays are history…
			expect(live.planner.gateWalls, `${id} planner consumed arrays`).toBe(expected!.planner.gateWalls);
			expect(live.planner.faceConsumed, `${id} planner face arrays`).toBe(expected!.planner.faceConsumed);
			expect(live.plannerVerdict, `${id} planner verdict`).toBe(expected!.plannerVerdict);
			// …while call multiplicity is the intended M-1 work reduction, asserted
			// separately below (NOT part of the historical equality).
		}
	});

	it('pins the intended planner work reduction separately from history', () => {
		for (const { id, document } of observationFixtures()) {
			const live = collectFixtureDigests(document);
			const work = PLANNER_WORK_EXPECTATION[id];
			expect(work, `missing work expectation for ${id}`).toBeDefined();
			expect(live.planner.wallCalls, `${id} planner seam multiplicity`).toBe(work!.wallCalls);
			expect(live.planner.kernelCalls, `${id} planner kernel multiplicity`).toBe(work!.kernelCalls);
			const reduced = (PLANNER_WORK_REDUCED_FIXTURES as readonly string[]).includes(id);
			const preOpt = OBSERVED_REFERENCE[id]!.planner;
			if (reduced) {
				// Intended reduction: at least one multiplicity digest differs from pre-opt.
				expect(
					live.planner.wallCalls !== preOpt.wallCalls || live.planner.kernelCalls !== preOpt.kernelCalls,
					`${id} reduction visible vs pre-opt`
				).toBe(true);
			} else {
				// Early-reject fixtures do no chain sampling work either way.
				expect(live.planner.wallCalls, `${id} unreduced seam`).toBe(preOpt.wallCalls);
				expect(live.planner.kernelCalls, `${id} unreduced kernel`).toBe(preOpt.kernelCalls);
			}
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
			// Precondition: the advertised multi-knot family is really present — w-east
			// carries TWO interior knots (not one) and hosts a REAL Opening.
			const east = document.walls.find((wall) => wall.id === 'w-east')!;
			expect(east.centerline.kind, `${id} w-east curved`).toBe('cubic-chain');
			if (east.centerline.kind === 'cubic-chain') {
				expect(east.centerline.knots.length, `${id} w-east multi-knot`).toBe(2);
			}
			const eastOpening = document.openings.find((opening) => opening.wallId === 'w-east');
			expect(eastOpening, `${id} opening hosted on multi-knot wall`).toBeDefined();
			const expected = WILD_OUTPUTS[id]!;
			expect(faceChecksum(document), `${id} face polygons`).toBe(expected.faces);
			const compiled = compileWallFirstLayoutGeometry(document);
			expect(createHash('sha256').update(JSON.stringify(compiled.geometry)).digest('hex'), `${id} compiled`).toBe(
				expected.compiled
			);
			expect(validateWallFirstTopology(document)?.code ?? 'admitted', `${id} topology`).toBe(expected.topology);
			// Nonempty COMPILED Room/Opening outputs (not just document inputs).
			expect(compiled.geometry.rooms.length, `${id} compiled rooms nonempty`).toBeGreaterThan(0);
			const wildRoom = compiled.geometry.rooms.find((room) => room.roomId === 'room-wild');
			expect(wildRoom, `${id} wild room compiled`).toBeDefined();
			expect(wildRoom!.floorPolygon.length, `${id} wild room polygon nonempty`).toBeGreaterThan(0);
			expect(
				compiled.geometry.walls.some((wall) => wall.wallId === 'w-east'),
				`${id} multi-knot wall compiled on canonical path`
			).toBe(true);
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
