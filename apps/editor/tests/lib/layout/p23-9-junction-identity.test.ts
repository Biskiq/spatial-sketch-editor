/**
 * P23.9 — Junction identity has two bars, and this file is their contract.
 *
 * **One identity predicate, one tolerance.** `coincidesAsJunction` decides "same
 * physical node" for authoring reuse, implicit closure and noding alike, at
 * `JUNCTION_COINCIDENCE_EPSILON` (1e-9 m). The bars used to disagree — authored
 * reuse and closure compared coordinates exactly while noding measured with a
 * tolerance — and that disagreement was the angled-plan failure: noding kept
 * planning splits against walls that already ended at the node (a degenerate
 * `Split distance … outside the open interval`), and a sub-ulp near-miss could
 * mint a second record for one node and author a 1e-16-long Wall.
 *
 * The tolerance is deliberately far below anything an author can express, and
 * far below the near-miss floor the ratified manual-acceptance case treats as a
 * different node:
 *
 * - **≥ `1e-7` apart** (the case in
 *   `2026-09-09-P23.9-wall-partition-sketching.md` §Manual acceptance, "junction
 *   reuse: endpoint snaps to existing Junction → same canonical Junction ID, no
 *   duplicate" / "near-coordinates without explicit Junction reuse do not count
 *   as closure") is a **distinct node**: it mints its own Junction and does not
 *   close a chain;
 * - **within `1e-9`** is **the same node**: the existing Junction is reused and
 *   its stored coordinate adopted. That covers intersections the planner
 *   computes (`lineIntersection` can never be bit-identical to a stored
 *   coordinate) and sub-ulp float noise, which cannot carry authoring intent.
 */
import { describe, expect, it } from 'vitest';

import {
	coincidesAsJunction,
	createEmptyWallFirstLayoutDocument,
	JUNCTION_COINCIDENCE_EPSILON,
	planWallChain,
	planWallSegment,
	type LayoutDocumentWallFirst,
	type LayoutVec2
} from '@portfolio/layout-core';

const p = (x: number, z: number): LayoutVec2 => [x, z];

/** The planner's coincidence tolerance, restated here as the contract value. */
const COINCIDENCE = JUNCTION_COINCIDENCE_EPSILON;
/** The smallest near-miss the closure rule reads as "a different node". */
const NEAR_MISS = 1e-7;

function baseDocument(): LayoutDocumentWallFirst {
	const document = createEmptyWallFirstLayoutDocument();
	return {
		...document,
		floor: { ...document.floor, id: 'floor-1', name: 'Floor 1', elevation: 0 }
	};
}

function commit(
	baseline: LayoutDocumentWallFirst,
	start: LayoutVec2,
	end: LayoutVec2
): LayoutDocumentWallFirst {
	const result = planWallSegment({ baseline, start, end, role: 'boundary' });
	if (result.kind !== 'success') {
		throw new Error(`expected success, got ${JSON.stringify(result)}`);
	}
	return result.document;
}

function enclosure(): LayoutDocumentWallFirst {
	const result = planWallChain({
		baseline: baseDocument(),
		points: [p(0, 0), p(4, 0), p(4, 3), p(0, 3)],
		close: true,
		role: 'boundary'
	});
	if (result.kind !== 'success') throw new Error('enclosure failed');
	return result.document;
}

/** The enclosure plus a diagonal divider: 4 corners + 2 divider ends. */
function enclosureWithDivider(): LayoutDocumentWallFirst {
	const divider = planWallSegment({
		baseline: enclosure(),
		start: p(0, 1),
		end: p(4, 2.5),
		role: 'boundary'
	});
	if (divider.kind !== 'success') throw new Error('divider failed');
	return divider.document;
}

function junctionById(document: LayoutDocumentWallFirst, id: string) {
	return document.junctions.find((junction) => junction.id === id)!;
}

function wallLength(document: LayoutDocumentWallFirst, wallId: string): number {
	const wall = document.walls.find((candidate) => candidate.id === wallId)!;
	const start = junctionById(document, wall.startJunctionId).point;
	const end = junctionById(document, wall.endJunctionId).point;
	return Math.hypot(end[0] - start[0], end[1] - start[1]);
}

function expectReturnedJunctionIdsLive(plan: Extract<ReturnType<typeof planWallSegment>, { kind: 'success' }>) {
	const junctionIds = new Set(plan.document.junctions.map((junction) => junction.id));
	for (const junctionId of [plan.startJunctionId, plan.endJunctionId, ...plan.createdJunctionIds]) {
		expect(junctionIds.has(junctionId), `returned Junction '${junctionId}' is not in the committed document`).toBe(true);
	}
}

/** Junction records that describe one physical node to within the tolerance. */
function coincidentPairs(document: LayoutDocumentWallFirst): string[] {
	const pairs: string[] = [];
	for (const a of document.junctions) {
		for (const b of document.junctions) {
			if (a.id >= b.id) continue;
			if (coincidesAsJunction(a.point, b.point)) {
				pairs.push(`${a.id}|${b.id}`);
			}
		}
	}
	return pairs;
}

describe('P23.9 shared Junction identity predicate', () => {
	it('uses one inclusive world-space tolerance for numerical noise only', () => {
		expect(coincidesAsJunction(p(0, 0), p(0, 0))).toBe(true);
		expect(coincidesAsJunction(p(0, 0), p(COINCIDENCE / Math.sqrt(2), COINCIDENCE / Math.sqrt(2)))).toBe(true);
		expect(coincidesAsJunction(p(0, 0), p(1e-7, 0))).toBe(false);
	});
});

describe('P23.9 junction identity — bar 1: authored identity is exact', () => {
	it('reuses the Junction record for its exact coordinate', () => {
		const ab = commit(baseDocument(), p(0, 0), p(4, 0));
		const endJunction = ab.walls[0]!.endJunctionId;
		// Continuing from B's exact coordinate: same canonical Junction, one new
		// record for the far end — no duplicate node at B.
		const bc = commit(ab, p(4, 0), p(4, 3));

		expect(bc.junctions).toHaveLength(3);
		expect(bc.walls[1]!.startJunctionId).toBe(endJunction);
		expect(coincidentPairs(bc)).toEqual([]);
	});

	it('mints a distinct node for a near-miss instead of fusing it', () => {
		const ab = commit(baseDocument(), p(0, 0), p(4, 0));
		const startJunction = ab.walls[0]!.startJunctionId;
		const near = commit(ab, p(4, 0), [0 + NEAR_MISS, 0 - NEAR_MISS]);

		// Two records, each holding its own authored coordinate: the planner does
		// not silently snap a near-miss onto the Junction it missed.
		expect(near.junctions).toHaveLength(3);
		expect(near.walls[1]!.endJunctionId).not.toBe(startJunction);
		expect(junctionById(near, startJunction).point).toEqual([0, 0]);
		expect(junctionById(near, near.walls[1]!.endJunctionId).point).toEqual([
			NEAR_MISS,
			-NEAR_MISS
		]);
		expect(coincidentPairs(near)).toEqual([]);
	});

	it('closes a chain only on Junction identity, never on near-coordinates', () => {
		const exact = planWallChain({
			baseline: baseDocument(),
			points: [p(0, 0), p(4, 0), p(4, 3), p(0, 0)],
			close: false,
			role: 'boundary'
		});
		expect(exact.kind).toBe('success');
		if (exact.kind !== 'success') return;
		// Repeating the run start reuses its Junction and closes the loop: three
		// vertices, three legs, nothing new allocated.
		expect(exact.document.junctions).toHaveLength(3);
		expect(exact.document.walls).toHaveLength(3);

		const near = planWallChain({
			baseline: baseDocument(),
			points: [p(0, 0), p(4, 0), p(4, 3), [NEAR_MISS, NEAR_MISS]],
			close: false,
			role: 'boundary'
		});
		expect(near.kind).toBe('success');
		if (near.kind !== 'success') return;
		// The near-miss point is its own node, so the run stays open: a fourth
		// Junction, and the last leg does not end on the run's start Junction.
		expect(near.document.junctions).toHaveLength(4);
		expect(near.document.walls).toHaveLength(3);
		expect(near.document.walls[2]!.endJunctionId).not.toBe(
			near.document.walls[0]!.startJunctionId
		);

		// Landing *on* the first leg instead of on its Junction is a T, not a
		// closure — and a chain may not T into itself. A truthful rejection, never
		// a silently fused loop.
		const ontoLeg = planWallChain({
			baseline: baseDocument(),
			points: [p(0, 0), p(4, 0), p(4, 3), [NEAR_MISS, 0]],
			close: false,
			role: 'boundary'
		});
		expect(ontoLeg.kind).toBe('rejected');
		if (ontoLeg.kind !== 'rejected') return;
		expect(ontoLeg.rejection.code).toBe('self_intersecting_chain');
	});
});

describe('P23.9 junction identity — bar 2: computed coincidence adopts, never splits', () => {
	it('adopts an existing Junction when a chain endpoint lands within noise of it', () => {
		const baseline = enclosure();
		const corner = baseline.junctions.find(
			(junction) => junction.point[0] === 0 && junction.point[1] === 0
		)!;
		// On the bottom wall's line (y = 0), a hair inside its span: classified as
		// endpoint-on-interior at a distance of ~1e-16 from the wall's own start
		// Junction. Splitting there is degenerate; adoption is the correct noding.
		const result = planWallSegment({
			baseline,
			start: [1e-16, 0],
			end: p(6, 6),
			role: 'boundary'
		});
		expect(result.kind).toBe('success');
		if (result.kind !== 'success') return;

		// The authored wall begins on the *existing* corner Junction: the near-miss
		// coordinate is normalized onto it, and no second record is minted.
		const authored = result.document.walls.filter(
			(wall) => wall.startJunctionId === corner.id || wall.endJunctionId === corner.id
		);
		expect(authored.length).toBeGreaterThanOrEqual(3);
		const atTouchPoint = result.document.junctions.filter(
			(junction) => Math.hypot(junction.point[0] - 1e-16, junction.point[1]) < 1e-12
		);
		expect(atTouchPoint).toHaveLength(1);
		expect(atTouchPoint[0]!.id).toBe(corner.id);
		// Only the wall's far endpoint and its crossing with the enclosure wall are
		// added — the near-miss coordinate contributed no record of its own.
		expect(result.document.junctions).toHaveLength(baseline.junctions.length + 2);
		expect(coincidentPairs(result.document)).toEqual([]);
	});

	it('normalizes a sub-ulp endpoint onto the node instead of minting a second record', () => {
		const baseline = enclosure();
		const document = commit(baseline, p(1e-16, 1e-16), p(-3, -3));
		// Same predicate on both sides of the seam, so a chain point that lands
		// inside the tolerance IS the existing corner Junction: no duplicate
		// record, no coincident pair, no sliver arm.
		expect(document.junctions).toHaveLength(baseline.junctions.length + 1);
		expect(
			document.junctions.filter(
				(junction) => Math.hypot(junction.point[0] - 1e-16, junction.point[1] - 1e-16) < 1e-12
			)
		).toHaveLength(1);
		expect(coincidentPairs(document)).toEqual([]);
		for (const wall of document.walls) {
			expect(wallLength(document, wall.id)).toBeGreaterThan(COINCIDENCE);
		}
		// A gesture whose two endpoints normalize to one node is rejected outright
		// (it has no distinct leg) rather than authoring a sub-ulp Wall.
		const degenerate = planWallSegment({
			baseline,
			start: p(0, 0),
			end: p(1e-16, 1e-16),
			role: 'boundary'
		});
		expect(degenerate.kind).toBe('rejected');
		if (degenerate.kind !== 'rejected') return;
		expect(['zero_length_leg', 'insufficient_chain']).toContain(degenerate.rejection.code);
	});

	it('closes a loop for a sub-ulp offset and keeps a real near-miss open', () => {
		// 1e-10 apart: below the identity tolerance, so the run start Junction is
		// reused and the chain closes on it.
		const inside = planWallChain({
			baseline: baseDocument(),
			points: [p(0, 0), p(4, 0), p(4, 3), [1e-10, 1e-10]],
			close: false,
			role: 'boundary'
		});
		expect(inside.kind).toBe('success');
		if (inside.kind !== 'success') return;
		expect(inside.document.junctions).toHaveLength(3);
		expect(inside.document.walls).toHaveLength(3);
		expect(inside.document.junctions.some((junction) => junction.point[0] === 1e-10)).toBe(false);

		// 1e-7 apart: the ratified near-miss floor — a distinct node, an open run.
		const outside = planWallChain({
			baseline: baseDocument(),
			points: [p(0, 0), p(4, 0), p(4, 3), [NEAR_MISS, NEAR_MISS]],
			close: false,
			role: 'boundary'
		});
		expect(outside.kind).toBe('success');
		if (outside.kind !== 'success') return;
		expect(outside.document.junctions).toHaveLength(4);
		expect(outside.document.walls).toHaveLength(3);
	});

	it('never asks for a degenerate split, and never leaves a sliver wall', () => {
		const document = enclosureWithDivider();
		const corners = document.junctions.map((junction) => junction.point);
		const gestures: Array<[LayoutVec2, LayoutVec2]> = [];
		for (const corner of corners) {
			gestures.push([corner, p(6, 6)], [corner, p(-3, 6)], [corner, p(6, -3)], [corner, p(-3, -3)]);
		}
		// Along-line perturbations: a hair short of / past each corner, on the line
		// of the wall that ends there — the exact shape that used to reject.
		const alongLine: LayoutVec2[] = [
			[1e-16, 0],
			[-1e-16, 0],
			[4 - 1e-16, 0],
			[4 + 1e-16, 0],
			[0, 3 - 1e-16],
			[4, 2.5 - 1e-16],
			[0, 1 + 1e-16]
		];
		for (const point of alongLine) {
			gestures.push([point, p(6, 6)], [point, p(-3, -3)]);
		}

		let successes = 0;
		for (const [start, end] of gestures) {
			const result = planWallSegment({ baseline: document, start, end, role: 'boundary' });
			if (result.kind === 'rejected') {
				// Honest geometry rejections are fine; a noding rejection here is the
				// regression this bar exists to prevent.
				expect(result.rejection.code, `noding rejected at ${JSON.stringify(start)}`).not.toBe(
					'noding_rejected'
				);
				expect(result.rejection.message).not.toMatch(/Split distance/);
				continue;
			}
			successes += 1;
			expectReturnedJunctionIdsLive(result);
			for (const wall of result.document.walls) {
				expect(
					wallLength(result.document, wall.id),
					`sliver wall ${wall.id} at ${JSON.stringify(start)}`
				).toBeGreaterThan(COINCIDENCE);
			}
		}
		expect(successes).toBeGreaterThan(10);
	});
});
