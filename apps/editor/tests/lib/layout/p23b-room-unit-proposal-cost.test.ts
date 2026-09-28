/**
 * P23B pre-P23B.8 follow-up — the whole-Room drag slice's **P0.4 cost gate**.
 *
 * The gesture change removes a per-pointermove planner call, a whole-document
 * compile and a whole-generation mesh preparation, and adds one unit-sized
 * overlay proposal. The change is only worth making if the added side is an order
 * of magnitude cheaper than the removed side — that ratio, not an absolute
 * millisecond budget, is the assertion here (absolute timings are machine- and
 * session-conditioned; see the M1 records).
 *
 * `removed` mirrors what `previewWallFirstRoomMove` actually does per move:
 * `planWallFirstRoomMove` (whose own gates compile the candidate) followed by the
 * install's compile and `prepareWallMeshes` of the accepted generation.
 *
 * Reported raw (one `console.log` line per arm) so a record can quote the
 * measurement; asserted at a 5× margin so the gate fails only when the premise
 * genuinely breaks.
 */
import { describe, expect, it } from 'vitest';

import {
	compileWallFirstLayoutGeometry,
	planWallFirstRoomMove,
	proposeWallFirstRoomUnitGeometry,
	resolveIsolatedRoomGroupSubgraph,
	type LayoutDocumentWallFirst,
	type LayoutVec2
} from '@portfolio/layout-core';

import { P23B_MATRIX_SPECS, buildP23BMatrixFixture } from '$lib/bench/p23b-fixtures';
import { prepareWallMeshes } from '$lib/editor/layout/prepared-wall-meshes';

const COST_TIMEOUT_MS = 180_000;
const REPS = 15;
const WARMUPS = 3;
const REQUIRED_MARGIN = 5;

const DELTAS: readonly LayoutVec2[] = [
	[1.5, 2.25],
	[-2.5, -1.75],
	[0.75, -3.25]
];

function median(values: number[]): number {
	const sorted = [...values].sort((a, b) => a - b);
	const middle = Math.floor(sorted.length / 2);
	return sorted.length % 2 === 0 ? (sorted[middle - 1]! + sorted[middle]!) / 2 : sorted[middle]!;
}

function measure(run: () => void): number {
	for (let index = 0; index < WARMUPS; index += 1) run();
	const samples: number[] = [];
	for (let index = 0; index < REPS; index += 1) {
		const start = performance.now();
		run();
		samples.push(performance.now() - start);
	}
	return median(samples);
}

function allCurvedFixture(): LayoutDocumentWallFirst {
	const spec = P23B_MATRIX_SPECS.find(
		(entry) => entry.size === '40-wall' && entry.curvature === 'all-curved'
	);
	if (!spec) throw new Error('the committed all-curved 40-wall matrix cell is missing');
	return buildP23BMatrixFixture(spec);
}

describe('P0.4 — the added per-move work is an order of magnitude below what it removes', () => {
	it(
		'proposal ≪ planner + compile + prepare on the committed all-curved 40-Wall fixture',
		() => {
			const document = allCurvedFixture();
			let checked = 0;
			for (const room of document.rooms.slice(0, 3)) {
				const isolation = resolveIsolatedRoomGroupSubgraph(document, room.id);
				if (isolation.kind !== 'success') continue;
				const { subgraph } = isolation;
				const delta = DELTAS[checked % DELTAS.length]!;

				const added = measure(() => {
					proposeWallFirstRoomUnitGeometry(document, subgraph, delta);
				});

				const plan = planWallFirstRoomMove(document, room.id, delta);
				if (plan.kind !== 'success') continue;
				// The accepted generation, compiled exactly as the install path does.
				const acceptedGeometry = compileWallFirstLayoutGeometry(plan.document).geometry;
				const removed = measure(() => {
					const candidate = planWallFirstRoomMove(document, room.id, delta);
					if (candidate.kind !== 'success') throw new Error('planner refused a gated delta');
					compileWallFirstLayoutGeometry(candidate.document);
					prepareWallMeshes(acceptedGeometry);
				});

				const margin = removed / Math.max(added, 1e-6);
				// eslint-disable-next-line no-console
				console.log(
					`P0.4 ${room.id} Δ${delta[0]},${delta[1]}: added ${added.toFixed(3)} ms · ` +
						`removed ${removed.toFixed(3)} ms · margin ${margin.toFixed(1)}× ` +
						`(${subgraph.wallIds.length} Walls moved)`
				);
				expect(added, `${room.id}: the proposal must produce geometry`).toBeGreaterThan(0);
				expect(
					margin,
					`${room.id}: added side must stay ${REQUIRED_MARGIN}× below the removed side`
				).toBeGreaterThanOrEqual(REQUIRED_MARGIN);
				checked += 1;
			}
			expect(checked, 'cost arms exercised').toBeGreaterThanOrEqual(2);
		},
		COST_TIMEOUT_MS
	);
});
