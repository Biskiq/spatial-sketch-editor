/**
 * P23.6e review — unchanged concave Room keeps its identity.
 *
 * `polygonsShareInteriorArea` answers "do these two rings share interior
 * area?" — the right question for adjacency, but it answers "no" for a
 * predecessor Room and a candidate face that are the *same* concave region:
 * every vertex/edge probe lies on the shared ring and no edges cross. When
 * the Room is concave enough that `interiorWitness` (a centroid nudge) also
 * lands outside, the bipartite correspondence loses its only edge, the Room
 * falls out of every component, and an unrelated boundary-Wall edit retires
 * the existing Room ID and mints a replacement — clearing associations and
 * metadata. Pinned here: containment evidence for near-identical rings, plus
 * the end-to-end `reconcileRooms` path keeping the predecessor's ID.
 */
import { describe, expect, it } from 'vitest';

import {
	planWallSegment,
	polygonsShareInteriorArea,
	roomBoundaryPolygon,
	type LayoutDocumentWallFirst,
	type LayoutVec2
} from '@portfolio/layout-core';

const p = (x: number, z: number): LayoutVec2 => [x, z];

/**
 * A C-shaped Room: an 8×6 enclosure with a 3×2 bite taken from the top edge
 * (from x=2.5 to x=5.5, down to z=2). The centroid is (4, 3.13…): inside the
 * ring in pure geometry terms but within the bite's shadow of the top wall —
 * the witness nudges land on the ring or in the bite, so containment via
 * witness fails and the two identical rings must match through direct
 * containment evidence instead.
 */
function cRoomPolygon(): LayoutVec2[] {
	return [
		p(0, 0),
		p(8, 0),
		p(8, 6),
		p(5.5, 6),
		p(5.5, 2),
		p(2.5, 2),
		p(2.5, 6),
		p(0, 6)
	];
}

/** A deliberately narrow L: both one-metre arms miss a 12-step box lattice. */
function narrowLRoomPolygon(): LayoutVec2[] {
	return [p(0, 0), p(12, 0), p(12, 1), p(1, 1), p(1, 12), p(0, 12)];
}

function interiorWitnessOf(polygon: readonly LayoutVec2[]): LayoutVec2 {
	// Mirror the reconciliation entry contract: unresolvable boundary → the
	// caller rejects; here it always resolves.
	const resolved = polygon;
	return resolved[0]!;
}

describe('P23.6e review — near-identical concave rings share interior area', () => {
	it('polygonsShareInteriorArea agrees when both rings are the same concave region (both orders)', () => {
		const c = cRoomPolygon();
		expect(polygonsShareInteriorArea(c, [...c])).toBe(true);
		expect(polygonsShareInteriorArea([...c], c)).toBe(true);
	});

	it('finds interior evidence in a narrow L arm without fixed-grid luck', () => {
		const l = narrowLRoomPolygon();
		expect(polygonsShareInteriorArea(l, [...l])).toBe(true);
		expect(polygonsShareInteriorArea([...l], l)).toBe(true);
	});

	it('polygonsShareInteriorArea stays adjacency-safe: shared edge only, mirrored orientation', () => {
		const left = [p(0, 0), p(3, 0), p(3, 4), p(0, 4)];
		const right = [p(3, 4), p(3, 0), p(6, 0), p(6, 4)];
		expect(polygonsShareInteriorArea(left, right)).toBe(false);
		expect(polygonsShareInteriorArea(right, left)).toBe(false);
	});

	it('keeps a narrow L separate from a Room sharing its long outer edge', () => {
		const l = narrowLRoomPolygon();
		const neighbor = [p(0, 0), p(12, 0), p(12, -4), p(0, -4)];
		expect(polygonsShareInteriorArea(l, neighbor)).toBe(false);
		expect(polygonsShareInteriorArea(neighbor, l)).toBe(false);
	});

	it('distinguishes endpoint dust from positive-area edge crossings at the ring tolerance', () => {
		const room = [p(0, 0), p(2, 0), p(2, 2), p(0, 2)];
		const crossingStrip = (overlap: number): LayoutVec2[] => [
			p(2 - overlap, -1),
			p(3, -1),
			p(3, 1),
			p(2 - overlap, 1)
		];

		expect(polygonsShareInteriorArea(room, crossingStrip(5e-10))).toBe(false);
		expect(polygonsShareInteriorArea(room, crossingStrip(2e-9))).toBe(true);
	});
});

describe('P23.6e review — unchanged concave Room keeps its ID end-to-end', () => {
	it('an unrelated boundary-Wall draw preserves a narrow concave Room and its metadata/association', () => {
		// Build the document through real face extraction so the Room boundary
		// is a genuine reconciled cycle, exactly as the editor produces it.
		const shell = {
			units: 'meters' as const,
			formatVersion: 5 as const,
			floor: { id: 'floor-1', name: 'Floor 1', elevation: 0 },
			junctions: [
				{ id: 'j1', point: p(0, 0) },
				{ id: 'j2', point: p(12, 0) },
				{ id: 'j3', point: p(12, 1) },
				{ id: 'j4', point: p(1, 1) },
				{ id: 'j5', point: p(1, 12) },
				{ id: 'j6', point: p(0, 12) }
			],
			walls: [
				{ id: 'w1', startJunctionId: 'j1', endJunctionId: 'j2', role: 'boundary', thickness: 0.2, height: 3 },
				{ id: 'w2', startJunctionId: 'j2', endJunctionId: 'j3', role: 'boundary', thickness: 0.2, height: 3 },
				{ id: 'w3', startJunctionId: 'j3', endJunctionId: 'j4', role: 'boundary', thickness: 0.2, height: 3 },
				{ id: 'w4', startJunctionId: 'j4', endJunctionId: 'j5', role: 'boundary', thickness: 0.2, height: 3 },
				{ id: 'w5', startJunctionId: 'j5', endJunctionId: 'j6', role: 'boundary', thickness: 0.2, height: 3 },
				{ id: 'w6', startJunctionId: 'j6', endJunctionId: 'j1', role: 'boundary', thickness: 0.2, height: 3 }
			],
			openings: [],
			objects: [
				{
					id: 'object-l',
					kind: 'box',
					position: [0.5, 0, 0.5],
					rotation: [0, 0, 0],
					dimensions: [0.5, 0.5, 0.5],
					roomId: 'room-l'
				}
			]
		} satisfies Omit<LayoutDocumentWallFirst, 'rooms'>;

		const polygon = narrowLRoomPolygon();
		const baseline: LayoutDocumentWallFirst = {
			...shell,
			rooms: [
				{
					id: 'room-l',
					name: 'Narrow L Gallery',
					// Boundary must be the reconciled cycle: w1 w2 w3 w4 w5 w6
					// in document order around the ring.
					boundary: shell.walls.map((wall) => ({
						wallId: wall.id,
						direction: 'forward' as const
					})),
					floorThickness: 0.23,
					ceilingThickness: 0.37
				}
			]
		};
		// Sanity: the boundary resolves to the narrow L ring we are pinning.
		expect(roomBoundaryPolygon(baseline, 'room-l')).toEqual(polygon);
		void interiorWitnessOf;

		// The unrelated edit: a boundary Wall drawn far outside the L Room
		// (its own closed shape at x∈[20,22], z∈[0,2] — no shared geometry).
		const withWall = planWallSegment({
			baseline,
			start: p(20, 0),
			end: p(22, 0),
			role: 'boundary'
		});
		if (withWall.kind !== 'success') {
			throw new Error(`wall draw should succeed: ${JSON.stringify(withWall.rejection)}`);
		}
		const candidate = planWallSegment({
			baseline: withWall.document,
			start: p(22, 0),
			end: p(22, 2),
			role: 'boundary'
		});
		if (candidate.kind !== 'success') {
			throw new Error(`second wall draw should succeed: ${JSON.stringify(candidate.rejection)}`);
		}
		const final = planWallSegment({
			baseline: candidate.document,
			start: p(22, 2),
			end: p(20, 2),
			role: 'boundary'
		});
		if (final.kind !== 'success') {
			throw new Error(`third wall draw should succeed: ${JSON.stringify(final.rejection)}`);
		}
		const closed = planWallSegment({
			baseline: final.document,
			start: p(20, 2),
			end: p(20, 0),
			role: 'boundary'
		});
		if (closed.kind !== 'success') {
			throw new Error(`closing wall draw should succeed: ${JSON.stringify(closed.rejection)}`);
		}
		const room = closed.document.rooms.find((candidate) => candidate.id === 'room-l');
		expect(room).toMatchObject({
			id: 'room-l',
			name: 'Narrow L Gallery',
			floorThickness: 0.23,
			ceilingThickness: 0.37
		});
		expect(closed.document.objects).toEqual(baseline.objects);
		// No retirement of the untouched Room in the plan result.
		expect(closed.retiredRoomIds).not.toContain('room-l');
	});
});
