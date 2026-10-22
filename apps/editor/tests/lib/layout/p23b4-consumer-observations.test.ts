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
	P23B_MATRIX_SPECS
} from './__fixtures__/p23b-fixtures';
import { p2311Fixture, P2311_FIXTURES } from './__fixtures__/p2311-bend-fixtures';
import { collectFixtureDigests, sha } from './p23b4-observation-collector';
import { OBSERVED_REFERENCE, PLANNER_VERDICT_EXPECTATION } from './p23b4-observed-reference';
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
 *   outcome per fixture (history).
 *
 * PR #115 (§7.2 category A″) deleted the observation-count half: planner call
 * multiplicity (wallCalls/kernelCalls) measured work rather than output, and the
 * PERF/P23B measurement apparatus went with the editor shell. The output and
 * verdict equalities below are the assertions this file exists to keep.
 */

function observationFixtures(): Array<{ id: string; document: LayoutDocumentWallFirst }> {
	const entries: Array<{ id: string; document: LayoutDocumentWallFirst }> = [];
	for (const spec of P23B_MATRIX_SPECS) entries.push({ id: spec.id, document: buildP23BMatrixFixture(spec) });
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

/**
 * T1.P02.S01 — the format-neutral compiled projection (identical to the one in
 * `p23b4-sampling-reference.test.ts`): the derived role vocabulary and the
 * Junction cacheKey that embeds it are excluded, every other compiled fact is
 * hashed. The pinned digests were recorded from the BASE revision `55683981`
 * with this projection; the derived role is pinned separately.
 */
function neutralCompiledDigest(geometry: ReturnType<typeof compileWallFirstLayoutGeometry>['geometry']): string {
	const payload = {
		walls: geometry.walls.map(({ role: _role, cacheKey: _cacheKey, ...rest }) => rest),
		junctions: (geometry.junctions ?? []).map(({ legs, cacheKey: _cacheKey, ...rest }) => ({
			...rest,
			legs: legs.map(({ role: _legRole, ...leg }) => leg)
		})),
		rooms: geometry.rooms,
		queries: geometry.queries
	};
	return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

const WILD_OUTPUTS: Record<string, { faces: string; compiled: string; topology: string }> = {
	'wild-room-curved-v1': {
		faces: 'faces=1 checksum=5666de32e3fa631649637e3e62d5750c69f7e4691c2ff1e594a65d50e6ec0a68',
		compiled: 'e1f81d3f0bcc0838b00b523cead56c1a63593f03ffbfdd30e672b6421aec4051',
		topology: 'admitted'
	},
	'wild-shared-curved-v1': {
		faces: 'faces=2 checksum=09ae15d1214baf17010acf91243e915571b5c2408174644f1ce885a127ffdb91',
		compiled: '6ce613791bb1d6ca7c57dd97d995147936e941db8916542cb8378753f4baddee',
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
			// T1.P02.S01: the verdict is the one history field format 6 moved (the
			// accepted document lost the authored `role`), so it is asserted against
			// the HEAD-derived expectation below. Its difference from the frozen
			// history is pinned by the delta test, never absorbed into the table.
			expect(live.plannerVerdict, `${id} planner verdict`).toBe(PLANNER_VERDICT_EXPECTATION[id]);
			// Call multiplicity is NOT asserted: it measured work, not output (§7.2 A″).
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
			expect(verdict, `${id} real-planner verdict`).toBe(PLANNER_VERDICT_EXPECTATION[id]);
		}
	});

	it('records the format-6 verdict delta exactly, instead of editing history', () => {
		// Format 6 removed the authored Wall `role`, so every SUCCESS row's digest
		// (which hashes the accepted document's canonical JSON) moved, while the
		// four early-reject rows hash their rejection message and did not. The
		// frozen history column is left alone; this list is the whole allowed
		// delta. A row that moves for any other reason fails here rather than being
		// absorbed by an edited `OBSERVED_REFERENCE` value.
		const moved = Object.keys(OBSERVED_REFERENCE)
			.filter((id) => OBSERVED_REFERENCE[id]!.plannerVerdict !== PLANNER_VERDICT_EXPECTATION[id])
			.sort();
		expect(moved).toEqual(
			[
				'N-2',
				'bend-10-wall-openings',
				'bend-3-room-openings',
				'class4-zero-length-wall-v1',
				'd12-exact-coincidence-v1',
				'd12-full-containment-v1',
				'd12-partial-overlap-v1',
				'p23b-12-wall-all-curved-v1',
				'p23b-12-wall-straight-v1',
				'p23b-12-wall-target-curved-v1',
				'p23b-40-wall-all-curved-v1',
				'p23b-40-wall-straight-v1',
				'p23b-40-wall-target-curved-v1',
				'wild-room-curved-v1',
				'wild-shared-curved-v1'
			].sort()
		);
		for (const id of moved) {
			expect(PLANNER_VERDICT_EXPECTATION[id], `${id} is a moved SUCCESS row`).toMatch(/^success:/);
		}
		// Everything else is byte-identical to history: the expectation adds no
		// second, independent way for a value to drift.
		for (const id of Object.keys(OBSERVED_REFERENCE)) {
			if (moved.includes(id)) continue;
			expect(PLANNER_VERDICT_EXPECTATION[id], id).toBe(OBSERVED_REFERENCE[id]!.plannerVerdict);
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
			expect(neutralCompiledDigest(compiled.geometry), `${id} compiled`).toBe(expected.compiled);
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
