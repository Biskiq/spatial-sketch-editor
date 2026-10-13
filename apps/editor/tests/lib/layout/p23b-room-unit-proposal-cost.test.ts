/**
 * P23B pre-P23B.8 follow-up — the whole-Room drag slice's committed-fixture
 * premise, after PR #115 removed the PERF lane.
 *
 * This file was the P0.4 **cost gate**: it timed the added per-pointermove
 * overlay proposal against the per-move work the gesture removes (a planner
 * call, a whole-document compile and a mesh preparation) and required a 5×
 * margin. §5.1 of the #115 plan removes the bench/P23B measurement apparatus
 * and §7.3 removes the PERF lane, so the timing arms, the median/`timeOp`
 * machinery and the margin assertion are gone from the product suite; the
 * measured numbers remain in the P23B plan evidence (`lib/bench` is recoverable
 * at the baseline SHA).
 *
 * What is kept is the structural premise the gate ran on, unchanged: on the
 * committed **all-curved 40-Wall** matrix cell the gesture is admissible at all
 * — the isolated Room-unit subgraph resolves and `planWallFirstRoomMove` accepts
 * each gated delta — for at least two Room groups. That is a correctness claim
 * about the committed fixture and the planners, not a timing claim.
 */
import { describe, expect, it } from 'vitest';

import {
	planWallFirstRoomMove,
	resolveIsolatedRoomGroupSubgraph,
	type LayoutDocumentWallFirst,
	type LayoutVec2
} from '@portfolio/layout-core';

import { P23B_MATRIX_SPECS, buildP23BMatrixFixture } from './__fixtures__/p23b-fixtures';

const DIFFERENTIAL_TIMEOUT_MS = 300_000;

const DELTAS: readonly LayoutVec2[] = [
	[1.5, 2.25],
	[-2.5, -1.75],
	[0.75, -3.25]
];

function allCurvedFixture(): LayoutDocumentWallFirst {
	const spec = P23B_MATRIX_SPECS.find(
		(entry) => entry.size === '40-wall' && entry.curvature === 'all-curved'
	);
	if (!spec) throw new Error('the committed all-curved 40-wall matrix cell is missing');
	return buildP23BMatrixFixture(spec);
}

describe('P0.4 — the committed gesture premise: the all-curved 40-Wall cell is draggable', () => {
	it(
		'resolves the isolated Room-unit subgraph and accepts each gated delta for at least two Rooms',
		() => {
			const document = allCurvedFixture();
			let accepted = 0;
			for (const room of document.rooms) {
				const isolation = resolveIsolatedRoomGroupSubgraph(document, room.id);
				if (isolation.kind !== 'success') continue;
				// A resolved subgraph must name the Walls it would move.
				expect(
					isolation.subgraph.wallIds.length,
					`${room.id}: an isolated group names its Walls`
				).toBeGreaterThan(0);

				const delta = DELTAS[accepted % DELTAS.length]!;
				const plan = planWallFirstRoomMove(document, room.id, delta);
				if (plan.kind !== 'success') continue;
				expect(
					plan.document.rooms.map((entry) => entry.id),
					`${room.id}: the moved document keeps its Rooms`
				).toContain(room.id);
				accepted += 1;
			}
			expect(accepted, 'gated Room-unit deltas accepted on the committed cell').toBeGreaterThanOrEqual(2);
		},
		DIFFERENTIAL_TIMEOUT_MS
	);
});
