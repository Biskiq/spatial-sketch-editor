/**
 * P23.6e — extra finding: wall-engine integrity on dense, angled plans.
 *
 * Manual smoke testing of the P23.6e Navigator surfaced two authoring failures
 * that are not part of that slice's semantics but block it end to end:
 *
 * 1. **Oblique-adjacent Rooms fused.** Correspondence evidence used the
 *    sampled `polygonIntersectionArea`, whose lattice counts samples lying on a
 *    shared **oblique** edge as inside both polygons. Two Rooms divided by an
 *    angled Wall therefore reported a phantom sliver of overlap, their
 *    component fused, and every later boundary Wall gesture was rejected as
 *    `Unsupported correspondence component 2→2` — even a Wall touching no Room.
 *    Axis-aligned neighbours returned a degenerate intersection box (zero), so
 *    only angled plans broke. The union predicate is now the exact,
 *    adjacency-aware `polygonsShareInteriorArea`.
 *
 * 2. **Degenerate T-split at an existing Junction.** A chain Wall that crosses
 *    another Wall at (or within floating-point dust of) an existing Junction was
 *    classified as a proper crossing at that Junction. Splitting the Wall that
 *    already *ends* there has a degenerate distance, so the planner rejected the
 *    whole gesture with `Split distance 0 is outside the open interval …`
 *    (also seen as the wall's own length). The planner now nodes through the
 *    existing Junction, and adopts one Junction identity when two records
 *    describe one physical node.
 */
import { describe, expect, it } from 'vitest';

import {
	buildCorrespondenceComponents,
	createEmptyWallFirstLayoutDocument,
	extractBoundaryCandidateFaces,
	interiorWitness,
	planWallChain,
	planWallSegment,
	roomBoundaryPolygon,
	type LayoutDocumentWallFirst,
	type LayoutVec2
} from '@portfolio/layout-core';

const p = (x: number, z: number): LayoutVec2 => [x, z];

function baseDocument(): LayoutDocumentWallFirst {
	const document = createEmptyWallFirstLayoutDocument();
	return {
		...document,
		floor: { ...document.floor, id: 'floor-1', name: 'Floor 1', elevation: 0 }
	};
}

function plan(
	baseline: LayoutDocumentWallFirst,
	start: LayoutVec2,
	end: LayoutVec2
): ReturnType<typeof planWallSegment> {
	return planWallSegment({ baseline, start, end, role: 'boundary' });
}

function commit(
	baseline: LayoutDocumentWallFirst,
	start: LayoutVec2,
	end: LayoutVec2
): LayoutDocumentWallFirst {
	const result = plan(baseline, start, end);
	if (result.kind !== 'success') throw new Error(`expected success: ${JSON.stringify(result)}`);
	return result.document;
}

/** Room ↔ face correspondence of a document against its own faces. */
function selfComponents(document: LayoutDocumentWallFirst): string[] {
	const faces = extractBoundaryCandidateFaces(document).faces;
	const polygons = new Map(
		document.rooms.map((room) => [room.id, roomBoundaryPolygon(document, room.id)!])
	);
	const witnesses = new Map(
		document.rooms.map((room) => [
			room.id,
			interiorWitness(roomBoundaryPolygon(document, room.id)!)
		])
	);
	return buildCorrespondenceComponents(
		faces,
		document.rooms.map((room) => room.id),
		witnesses,
		polygons
	).map((component) => `${component.predecessorRoomIds.length}→${component.candidateFaceKeys.length}`);
}

describe('P23.6e extra — angled neighbours stay distinct Rooms', () => {
	/** Room split by an oblique Wall: the exact shape that used to fuse. */
	function angledTwoRoomPlan(): LayoutDocumentWallFirst {
		const room = planWallChain({
			baseline: baseDocument(),
			points: [p(0, -4), p(3.5, -4), p(3.5, 1.5), p(0, 1.5)],
			close: true,
			role: 'boundary'
		});
		if (room.kind !== 'success') throw new Error('room birth failed');
		return commit(room.document, p(0, 0.13), p(0.88, -4));
	}

	it('keeps Rooms separated by an oblique Wall 1→1 with their own faces', () => {
		const document = angledTwoRoomPlan();
		expect(document.rooms).toHaveLength(2);
		expect(selfComponents(document)).toEqual(['1→1', '1→1']);
	});

	it('still accepts a boundary Wall after an oblique split (the reported freeze)', () => {
		const document = angledTwoRoomPlan();
		// The wall from the report: drawn in open space, touching no Room.
		const result = plan(document, p(5, -3), p(5, 1));
		expect(result.kind).toBe('success');
	});

	it('accepts a further split of one oblique half (1→2)', () => {
		const document = angledTwoRoomPlan();
		expect(selfComponents(document)).toEqual(['1→1', '1→1']);
		const again = plan(document, p(1.75, -4), p(0.02, 1.5));
		expect(again.kind).toBe('success');
	});
});

describe('P23.6e extra — noding never asks for a degenerate split', () => {
	/** Two Walls crossing at one Junction: the crossing point is computed, not snapped. */
	function crossedPlan(): LayoutDocumentWallFirst {
		let document = baseDocument();
		document = commit(document, p(-0.5, 2.34), p(-3.5, 6));
		document = commit(document, p(-0.5, 4.88), p(-4.5, 2.63));
		return document;
	}

	it('nodes a Wall through the crossing Junction instead of rejecting the gesture', () => {
		const document = crossedPlan();
		const crossing = document.junctions.find(
			(junction) => Math.abs(junction.point[0] + 1.9249649368863955) < 1e-9
		);
		expect(crossing).toBeDefined();

		// A Wall drawn exactly along one crossed arm: it passes through the
		// crossing Junction and ends on existing Junctions.
		const result = plan(document, p(-3.5, 6), p(-0.5, 2.34));
		expect(result.kind).toBe('rejected');
		if (result.kind !== 'rejected') return;
		// Truthful, actionable rejection — never the degenerate split message
		// and never a bare `noding_rejected` for the existing Junction.
		expect(result.rejection.code).toBe('collinear_overlap');
		expect(result.rejection.message).not.toMatch(/Split distance/);
	});

	it('extends an existing arm through the crossing Junction', () => {
		const document = crossedPlan();
		const extended = plan(document, p(-4.5, 2.63), p(-6, 1.79));
		expect(extended.kind).toBe('success');
	});
});

describe('P23.6e extra — one Junction identity per physical node', () => {
	it('reuses an existing Junction instead of minting a coincident one', () => {
		const baseline: LayoutDocumentWallFirst = {
			...baseDocument(),
			junctions: [
				{ id: 'junction-a', point: p(0, 0) },
				{ id: 'junction-b', point: p(4, 0) },
				{ id: 'junction-c', point: p(0, 4) }
			],
			walls: [
				{
					id: 'wall-a',
					startJunctionId: 'junction-a',
					endJunctionId: 'junction-b',
					role: 'boundary',
					thickness: 0.2,
					height: 3
				},
				{
					id: 'wall-b',
					startJunctionId: 'junction-a',
					endJunctionId: 'junction-c',
					role: 'boundary',
					thickness: 0.2,
					height: 3
				}
			]
		};

		// The chain passes straight through the existing corner at the origin.
		const result = plan(baseline, p(-2, -2), p(2, 2));
		expect(result.kind).toBe('success');
		if (result.kind !== 'success') return;

		const atOrigin = result.document.junctions.filter(
			(junction) =>
				Math.abs(junction.point[0]) < 1e-9 && Math.abs(junction.point[1]) < 1e-9
		);
		expect(atOrigin).toHaveLength(1);
		expect(atOrigin[0]!.id).toBe('junction-a');
		// The chain is noded through that Junction: two arms, no coincident node.
		const arms = result.document.walls.filter(
			(wall) =>
				wall.startJunctionId === 'junction-a' || wall.endJunctionId === 'junction-a'
		);
		expect(arms.map((wall) => wall.id).sort()).toEqual([
			'wall-a',
			'wall-b',
			'wall-chain-1',
			'wall-chain-1-b'
		]);
		expect(result.document.junctions.filter((junction) => junction.id.includes('chain'))).toHaveLength(2);
	});
});
