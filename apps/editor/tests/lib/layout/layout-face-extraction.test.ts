import { describe, expect, it } from 'vitest';

import type { LayoutVec2 } from '$lib/layout/layout-types';
import {
	extractBoundaryCandidateFaces,
	faceArea,
	polygonIntersectionArea,
	type DerivedCandidateFace
} from '$lib/layout/layout-face-extraction';
import {
	LAYOUT_WALL_FIRST_FORMAT_VERSION,
	type LayoutDocumentWallFirst
} from '$lib/layout/layout-wall-first-codec';

type WallSeed = {
	id: string;
	start: string;
	end: string;
	role?: 'boundary' | 'partition';
};	/** Document from junction coordinates + wall seeds (all boundary unless told otherwise). */
	function document(
		junctions: Array<[string, number, number]>,
		walls: WallSeed[]
	): LayoutDocumentWallFirst {
		return {
			units: 'meters',
			formatVersion: LAYOUT_WALL_FIRST_FORMAT_VERSION,
			floor: { id: 'floor-1', name: 'Floor 1', elevation: 0 },
			junctions: junctions.map(([id, x, z]) => ({ id, point: [x, z] as LayoutVec2 })),
		walls: walls.map((wall) => ({
			id: wall.id,
			startJunctionId: wall.start,
			endJunctionId: wall.end,
			role: wall.role ?? 'boundary',
			thickness: 0.2,
			height: 3
		})),
		rooms: [],
		openings: [],
		objects: []
	};
}

const RECT = document(
	[
		['j-a', 0, 0],
		['j-b', 6, 0],
		['j-c', 6, 4],
		['j-d', 0, 4]
	],
	[
		{ id: 'wall-a', start: 'j-a', end: 'j-b' },
		{ id: 'wall-b', start: 'j-b', end: 'j-c' },
		{ id: 'wall-c', start: 'j-c', end: 'j-d' },
		{ id: 'wall-d', start: 'j-d', end: 'j-a' }
	]
);

/** 6x4 rectangle noded at x=3 with an interior boundary wall → two rooms. */
function nodedTwoRoomDocument(): LayoutDocumentWallFirst {
	return document(
		[
			['j-a', 0, 0],
			['j-m', 3, 0],
			['j-b', 6, 0],
			['j-c', 6, 4],
			['j-n', 3, 4],
			['j-d', 0, 4]
		],
		[
			{ id: 'wall-a1', start: 'j-a', end: 'j-m' },
			{ id: 'wall-a2', start: 'j-m', end: 'j-b' },
			{ id: 'wall-b', start: 'j-b', end: 'j-c' },
			{ id: 'wall-c1', start: 'j-c', end: 'j-n' },
			{ id: 'wall-c2', start: 'j-n', end: 'j-d' },
			{ id: 'wall-d', start: 'j-d', end: 'j-a' },
			{ id: 'wall-e', start: 'j-m', end: 'j-n' }
		]
	);
}

function refString(face: DerivedCandidateFace): string {
	return face.boundary.map((ref) => `${ref.wallId}:${ref.direction}`).join(' ');
}

describe('candidate-face extraction (P23.8 / H3 §10)', () => {
	it('extracts one bounded face for a single closed rectangle', () => {
		const result = extractBoundaryCandidateFaces(RECT);
		expect(result.diagnostics).toEqual([]);
		expect(result.faces).toHaveLength(1);
		const face = result.faces[0]!;
		expect(refString(face)).toBe(
			'wall-a:forward wall-b:forward wall-c:forward wall-d:forward'
		);
		expect(face.signedArea).toBeCloseTo(24, 9);
		expect(face.polygon).toEqual([
			[0, 0],
			[6, 0],
			[6, 4],
			[0, 4]
		]);
	});

	it('derives deterministic face keys independent of wall array order', () => {
		const first = extractBoundaryCandidateFaces(RECT).faces.map((face) => face.key);
		const rotated = document(
			[
				['j-a', 0, 0],
				['j-b', 6, 0],
				['j-c', 6, 4],
				['j-d', 0, 4]
			],
			[
				{ id: 'wall-c', start: 'j-c', end: 'j-d' },
				{ id: 'wall-a', start: 'j-a', end: 'j-b' },
				{ id: 'wall-d', start: 'j-d', end: 'j-a' },
				{ id: 'wall-b', start: 'j-b', end: 'j-c' }
			]
		);
		const second = extractBoundaryCandidateFaces(rotated).faces.map((face) => face.key);
		expect(first).toEqual(second);
	});

	it('extracts two faces around a shared boundary wall with opposite orientations', () => {
		const result = extractBoundaryCandidateFaces(nodedTwoRoomDocument());
		expect(result.diagnostics).toEqual([]);
		expect(result.faces).toHaveLength(2);
		const [left, right] = result.faces;
		// Faces are key-sorted; identify by area (both 12) then refs.
		const byRefs = result.faces.map(refString);
		expect(byRefs).toContain('wall-a1:forward wall-e:forward wall-c2:forward wall-d:forward');
		expect(byRefs).toContain('wall-a2:forward wall-b:forward wall-c1:forward wall-e:reverse');
		for (const face of result.faces) {
			expect(face.signedArea).toBeCloseTo(12, 9);
		}
		expect(left!.key).not.toBe(right!.key);
	});

	it('excludes partition walls from face extraction entirely', () => {
		const doc = document(
			[
				['j-a', 0, 0],
				['j-b', 6, 0],
				['j-c', 6, 4],
				['j-d', 0, 4],
				['j-x', 1, 1],
				['j-y', 1, 3]
			],
			[
				{ id: 'wall-a', start: 'j-a', end: 'j-b' },
				{ id: 'wall-b', start: 'j-b', end: 'j-c' },
				{ id: 'wall-c', start: 'j-c', end: 'j-d' },
				{ id: 'wall-d', start: 'j-d', end: 'j-a' },
				{ id: 'wall-partition', start: 'j-x', end: 'j-y', role: 'partition' }
			]
		);
		const result = extractBoundaryCandidateFaces(doc);
		expect(result.faces).toHaveLength(1);
		expect(result.diagnostics).toEqual([]);
	});

	it('diagnoses dangling boundary walls and keeps them out of the face graph', () => {
		const doc = document(
			[
				['j-a', 0, 0],
				['j-b', 6, 0],
				['j-c', 6, 4],
				['j-d', 0, 4],
				['j-x', 1, 1],
				['j-y', 1, 3]
			],
			[
				{ id: 'wall-a', start: 'j-a', end: 'j-b' },
				{ id: 'wall-b', start: 'j-b', end: 'j-c' },
				{ id: 'wall-c', start: 'j-c', end: 'j-d' },
				{ id: 'wall-d', start: 'j-d', end: 'j-a' },
				{ id: 'wall-stub', start: 'j-x', end: 'j-y' }
			]
		);
		const result = extractBoundaryCandidateFaces(doc);
		expect(result.faces).toHaveLength(1);
		expect(result.danglingWallIds).toEqual(['wall-stub']);
		expect(result.diagnostics).toContainEqual(
			expect.objectContaining({ code: 'boundary_dangle', wallId: 'wall-stub' })
		);
	});

	it('diagnoses bridge walls as cut edges and still extracts the faces on both sides', () => {
		const doc = document(
			[
				['j-a', 0, 0],
				['j-b', 2, 0],
				['j-c', 2, 2],
				['j-d', 0, 2],
				['j-e', 4, 0],
				['j-f', 6, 0],
				['j-g', 6, 2],
				['j-h', 4, 2]
			],
			[
				{ id: 'w-a', start: 'j-a', end: 'j-b' },
				{ id: 'w-b', start: 'j-b', end: 'j-c' },
				{ id: 'w-c', start: 'j-c', end: 'j-d' },
				{ id: 'w-d', start: 'j-d', end: 'j-a' },
				{ id: 'w-bridge', start: 'j-c', end: 'j-e' },
				{ id: 'w-e', start: 'j-e', end: 'j-f' },
				{ id: 'w-f', start: 'j-f', end: 'j-g' },
				{ id: 'w-g', start: 'j-g', end: 'j-h' },
				{ id: 'w-h', start: 'j-h', end: 'j-e' }
			]
		);
		const result = extractBoundaryCandidateFaces(doc);
		expect(result.faces).toHaveLength(2);
		expect(result.cutEdgeWallIds).toEqual(['w-bridge']);
		expect(result.diagnostics).toContainEqual(
			expect.objectContaining({ code: 'boundary_cut_edge', wallId: 'w-bridge' })
		);
	});

	it('reports a fully nested boundary loop as a diagnostic without dropping faces', () => {
		const doc = document(
			[
				['j-a', 0, 0],
				['j-b', 20, 0],
				['j-c', 20, 20],
				['j-d', 0, 20],
				['j-e', 6, 6],
				['j-f', 10, 6],
				['j-g', 10, 10],
				['j-h', 6, 10]
			],
			[
				{ id: 'o-a', start: 'j-a', end: 'j-b' },
				{ id: 'o-b', start: 'j-b', end: 'j-c' },
				{ id: 'o-c', start: 'j-c', end: 'j-d' },
				{ id: 'o-d', start: 'j-d', end: 'j-a' },
				{ id: 'i-a', start: 'j-e', end: 'j-f' },
				{ id: 'i-b', start: 'j-f', end: 'j-g' },
				{ id: 'i-c', start: 'j-g', end: 'j-h' },
				{ id: 'i-d', start: 'j-h', end: 'j-e' }
			]
		);
		const result = extractBoundaryCandidateFaces(doc);
		expect(result.faces).toHaveLength(2);
		expect(result.diagnostics).toContainEqual(
			expect.objectContaining({ code: 'nested_boundary_loop' })
		);
	});
});

describe('face geometry helpers', () => {
	it('faceArea returns the absolute polygon area', () => {
		const face = {
			polygon: [
				[0, 0],
				[2, 0],
				[2, 3],
				[0, 3]
			] as LayoutVec2[]
		};
		expect(faceArea(face)).toBeCloseTo(6, 9);
	});

	it('polygonIntersectionArea measures exact overlap for axis-aligned rectangles', () => {
		const a: LayoutVec2[] = [
			[0, 0],
			[4, 0],
			[4, 4],
			[0, 4]
		];
		const b: LayoutVec2[] = [
			[2, 2],
			[6, 2],
			[6, 6],
			[2, 6]
		];
		expect(polygonIntersectionArea(a, b)).toBeCloseTo(4, 1);
	});

	it('polygonIntersectionArea returns 0 for disjoint polygons', () => {
		const a: LayoutVec2[] = [
			[0, 0],
			[1, 0],
			[1, 1],
			[0, 1]
		];
		const b: LayoutVec2[] = [
			[5, 5],
			[6, 5],
			[6, 6],
			[5, 6]
		];
		expect(polygonIntersectionArea(a, b)).toBe(0);
	});

	// P23 review round 1: a fully-degenerate boundary graph (every wall is a
	// dangle) previously kept the unstripped walls as the face graph, so the
	// walk emitted bogus `zero_area_face` + `boundary_cut_edge` diagnostics
	// alongside the correct dangle set.
	it('emits only dangle diagnostics for an all-dangle boundary graph', () => {
		const allDangle = document(
			[
				['j-a', 0, 0],
				['j-b', 4, 0],
				['j-c', 8, 0],
				['j-d', 8, 4],
				['j-e', 12, 4]
			],
			[
				{ id: 'wall-a', start: 'j-a', end: 'j-b' },
				{ id: 'wall-b', start: 'j-b', end: 'j-c' },
				{ id: 'wall-c', start: 'j-c', end: 'j-d' },
				{ id: 'wall-d', start: 'j-d', end: 'j-e' }
			]
		);

		const result = extractBoundaryCandidateFaces(allDangle);
		expect(result.faces).toEqual([]);
		expect(new Set(result.danglingWallIds)).toEqual(new Set(['wall-a', 'wall-b', 'wall-c', 'wall-d']));
		expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
			'boundary_dangle',
			'boundary_dangle',
			'boundary_dangle',
			'boundary_dangle'
		]);
	});
});
