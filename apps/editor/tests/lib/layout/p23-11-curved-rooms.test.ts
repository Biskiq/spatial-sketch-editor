/**
 * P23.11 Slice 3 — curved Room geometry and curve-level topology.
 *
 * Face extraction keeps graph connectivity on Junction/Wall IDs and expands
 * each oriented boundary Wall into its canonical **sampled centerline**
 * vertices only for the geometric polygon (area, centroid, containment). Those
 * sampled vertices are evidence, never persisted Room vertices, and a straight
 * Wall still contributes exactly its start Junction so straight polygons are
 * unchanged.
 *
 * Two consequences are pinned here:
 * - a reverse-oriented half-edge walks the same curve backwards, so the
 *   adapter must reverse the persisted anchor order; swapping endpoints alone
 *   chains the anchors wrong and traces a different, self-swallowing curve
 *   (visible as a different face area);
 * - the chord-level `classifyWallIntersection` is blind to curvature, so the
 *   topology gate adds a sampled seam: a Wall whose centerline crosses itself,
 *   or two Walls whose chords miss but whose curves cross, both reject.
 */
import { describe, expect, it } from 'vitest';

import {
	extractBoundaryCandidateFaces,
	validateWallFirstTopology,
	wallCenterlineSamples,
	validateWallFirstLayoutDocument,
	type LayoutWall
} from '@portfolio/layout-core';
import type { LayoutDocumentWallFirst } from '$lib/layout/layout-wall-first-types';
import type { LayoutVec2 } from '$lib/layout/layout-types';
import { createEmptyWallFirstLayoutDocument } from '$lib/layout/layout-wall-first-codec';
import { LAYOUT_WALL_FIRST_FORMAT_VERSION } from '$lib/layout/layout-compat';

const LINE = { kind: 'line' } as const;

function bezier(...points: LayoutVec2[]): LayoutWall['centerline'] {
	return {
		kind: 'auto-bezier',
		interiorAnchors: points.map((point, index) => ({
			id: `anchor:${index + 1}`,
			point: [point[0], point[1]]
		}))
	};
}

function documentOf(
	junctions: Record<string, LayoutVec2>,
	walls: ReadonlyArray<{ id: string; start: string; end: string; centerline?: LayoutWall['centerline'] }>,
	rooms: LayoutDocumentWallFirst['rooms'] = []
): LayoutDocumentWallFirst {
	const document = createEmptyWallFirstLayoutDocument();
	document.formatVersion = LAYOUT_WALL_FIRST_FORMAT_VERSION;
	document.junctions = Object.entries(junctions).map(([id, point]) => ({
		id,
		point: [point[0], point[1]] as LayoutVec2
	}));
	document.walls = walls.map((wall) => ({
		id: wall.id,
		startJunctionId: wall.start,
		endJunctionId: wall.end,
		role: 'boundary',
		thickness: 0.2,
		height: 3,
		centerline: wall.centerline ?? LINE
	}));
	document.rooms = rooms;
	return document;
}

/** 6 × 4 rectangular Room whose bottom Wall `wall-a` may be curved. */
function rectangularRoom(centerline: LayoutWall['centerline'] = LINE): LayoutDocumentWallFirst {
	return documentOf(
		{ 'j-a': [0, 0], 'j-b': [6, 0], 'j-c': [6, 4], 'j-d': [0, 4] },
		[
			{ id: 'wall-a', start: 'j-a', end: 'j-b', centerline },
			{ id: 'wall-b', start: 'j-b', end: 'j-c' },
			{ id: 'wall-c', start: 'j-c', end: 'j-d' },
			{ id: 'wall-d', start: 'j-d', end: 'j-a' }
		],
		[
			{
				id: 'room-a',
				name: 'Room A',
				boundary: [
					{ wallId: 'wall-a', direction: 'forward' },
					{ wallId: 'wall-b', direction: 'forward' },
					{ wallId: 'wall-c', direction: 'forward' },
					{ wallId: 'wall-d', direction: 'forward' }
				],
				floorThickness: 0.1,
				ceilingThickness: 0.1
			}
		]
	);
}

/** The bowed Wall used throughout: 6 m chord, arc peaking at z = 2. */
const BOW = bezier([3, 2]);

describe('P23.11 slice 3 — curved Room face polygons', () => {
	it('keeps a straight Room polygon at exactly its Junction vertices', () => {
		const result = extractBoundaryCandidateFaces(rectangularRoom());
		expect(result.faces).toHaveLength(1);
		const face = result.faces[0]!;
		expect(face.boundary).toEqual([
			{ wallId: 'wall-a', direction: 'forward' },
			{ wallId: 'wall-b', direction: 'forward' },
			{ wallId: 'wall-c', direction: 'forward' },
			{ wallId: 'wall-d', direction: 'forward' }
		]);
		expect(face.polygon).toEqual([
			[0, 0],
			[6, 0],
			[6, 4],
			[0, 4]
		]);
		expect(face.signedArea).toBeCloseTo(24, 9);
	});

	it('expands a curved Wall into sampled vertices between its endpoints', () => {
		const result = extractBoundaryCandidateFaces(rectangularRoom(BOW));
		expect(result.faces).toHaveLength(1);
		const face = result.faces[0]!;
		// The boundary record still carries only Wall identity + direction.
		expect(face.boundary[0]).toEqual({ wallId: 'wall-a', direction: 'forward' });
		// Junction vertices survive as the polygon's corner anchors, with the
		// curve's interior samples inserted after the Wall's start Junction.
		expect(face.polygon.length).toBeGreaterThan(4);
		expect(face.polygon[0]).toEqual([0, 0]);
		const curveVertices = face.polygon.filter(
			(vertex) => vertex[1] > 0.01 && vertex[0] > 0.01 && vertex[0] < 5.99 && vertex[1] < 3.99
		);
		expect(curveVertices.length).toBeGreaterThan(4);
		// The polygon genuinely follows the bow (peak z = 2), not the chord.
		expect(Math.max(...face.polygon.map((vertex) => vertex[1]))).toBeGreaterThan(1.5);
	});

	it('measures curved face area from the sampled polygon, not the chord', () => {
		const straight = extractBoundaryCandidateFaces(rectangularRoom()).faces[0]!;
		// A bow bending AWAY from the Room (down to z = -2) adds the arc/chord
		// segment to the enclosed area; the identical bow bending INTO the Room
		// removes it. A chord-derived area would report a flat 24 m² for all three.
		const outward = extractBoundaryCandidateFaces(rectangularRoom(bezier([3, -2]))).faces[0]!;
		const inward = extractBoundaryCandidateFaces(rectangularRoom(BOW)).faces[0]!;
		expect(straight.signedArea).toBeCloseTo(24, 9);
		expect(outward.signedArea).toBeGreaterThan(24.5);
		expect(inward.signedArea).toBeLessThan(23.5);
		// Mirror-image bows, so the gain and the loss cancel exactly.
		expect(outward.signedArea + inward.signedArea).toBeCloseTo(2 * straight.signedArea, 6);
	});

	it('walks a reverse-oriented curved boundary along the same curve', () => {
		// Two Rooms share the curved Wall `wall-a`; the lower Room's ring
		// necessarily traverses it reverse. Both faces see the same curve, so
		// their sampled areas must match — a reverse traversal that chained the
		// two anchors in persisted order would trace a different curve.
		const twoAnchors = bezier([2, -2], [4, -2]);
		const document = documentOf(
			{
				'j-a': [0, 0],
				'j-b': [6, 0],
				'j-u1': [6, 4],
				'j-u2': [0, 4],
				'j-l1': [6, -4],
				'j-l2': [0, -4]
			},
			[
				{ id: 'wall-a', start: 'j-a', end: 'j-b', centerline: twoAnchors },
				{ id: 'wall-u1', start: 'j-b', end: 'j-u1' },
				{ id: 'wall-u2', start: 'j-u1', end: 'j-u2' },
				{ id: 'wall-u3', start: 'j-u2', end: 'j-a' },
				{ id: 'wall-l1', start: 'j-b', end: 'j-l1' },
				{ id: 'wall-l2', start: 'j-l1', end: 'j-l2' },
				{ id: 'wall-l3', start: 'j-l2', end: 'j-a' }
			]
		);
		expect(validateWallFirstLayoutDocument(document).success).toBe(true);
		const result = extractBoundaryCandidateFaces(document);
		expect(result.faces).toHaveLength(2);
		const directions = result.faces.map(
			(face) => face.boundary.find((ref) => ref.wallId === 'wall-a')!.direction
		);
		expect(directions.sort()).toEqual(['forward', 'reverse']);
		const [first, second] = result.faces;
		// The two Rooms tile the 6 × 8 enclosure, so the sampled faces must sum
		// to 48 m² however the shared bow redistributes area between them. That
		// holds only if the reverse traversal walks the SAME curve: a traversal
		// that chained the anchors in persisted order would trace a different,
		// self-swallowing loop and break the sum.
		expect(first!.signedArea + second!.signedArea).toBeCloseTo(6 * 8, 6);
		expect(Math.abs(first!.signedArea - second!.signedArea)).toBeGreaterThan(1);
		// Both faces include the bow's sampled vertices, and both arcs bottom out
		// at the same depth: same curve, read in opposite directions. (Adaptive
		// subdivision may land a slightly different sample count per direction,
		// so the depth — not the vertex count — is what must agree.)
		// The bow's own interior vertices: x strictly inside the 6 m span. The
		// lower Room's corners sit at x = 0 / 6 and z = -4, so they are excluded.
		const arcOf = (face: (typeof result.faces)[number]) =>
			face.polygon.filter((vertex) => vertex[0] > 0.01 && vertex[0] < 5.99 && vertex[1] < -0.5);
		const deepest = (face: (typeof result.faces)[number]) =>
			Math.min(...arcOf(face).map((vertex) => vertex[1]));
		expect(arcOf(first!).length).toBeGreaterThan(4);
		expect(arcOf(second!).length).toBeGreaterThan(4);
		// The interpolating spline overshoots its anchors, so the arc reaches past
		// z = -2; what matters is that both directions reach the same depth.
		expect(deepest(first!)).toBeLessThan(-1.5);
		expect(deepest(second!)).toBeCloseTo(deepest(first!), 2);
	});

	it('keeps the reverse traversal of a multi-anchor Wall on the same curve', () => {
		const wall: LayoutWall = {
			id: 'wall-a',
			startJunctionId: 'j-a',
			endJunctionId: 'j-b',
			role: 'boundary',
			thickness: 0.2,
			height: 3,
			centerline: bezier([2, 2], [4, 2])
		};
		const forward = wallCenterlineSamples(wall, [0, 0], [6, 0], 'forward')!;
		const reverse = wallCenterlineSamples(wall, [6, 0], [0, 0], 'reverse')!;
		// Same curve, opposite direction: arc length matches and the samples
		// coincide point-for-point with the forward run read backwards.
		expect(reverse.length).toBeCloseTo(forward.length, 9);
		expect(reverse.samples).toHaveLength(forward.samples.length);
		const reversed = [...forward.samples].reverse();
		for (let index = 0; index < reversed.length; index += 1) {
			expect(reverse.samples[index]!.point[0]).toBeCloseTo(reversed[index]!.point[0], 6);
			expect(reverse.samples[index]!.point[1]).toBeCloseTo(reversed[index]!.point[1], 6);
		}
		// Anchor order is reversed, not merely re-pointed at the other end.
		expect(reverse.samples[0]!.point).toEqual([6, 0]);
		expect(reverse.samples.at(-1)!.point).toEqual([0, 0]);
	});
});

describe('P23.11 slice 3 — curve-level crossing validation', () => {
	it('rejects a curved Wall whose centerline intersects itself', () => {
		// Endpoints one metre apart with the single anchor swept far past them:
		// the curve runs out and doubles back over its own path.
		const document = documentOf(
			{ 'j-a': [0, 0], 'j-b': [1, 0] },
			[{ id: 'wall-a', start: 'j-a', end: 'j-b', centerline: bezier([5, 0]) }]
		);
		const issue = validateWallFirstTopology(document);
		expect(issue?.code).toBe('unsupported_wall_topology');
		expect(issue?.message).toContain('intersects itself');
	});

	it('rejects a straight/curve crossing whose chords miss each other', () => {
		// Chords are the parallel lines z = 0 and z = 4, so the chord-level
		// classifier sees `none`; the curve dips through the straight Wall.
		const document = documentOf(
			{ 'j-a': [0, 0], 'j-b': [8, 0], 'j-c': [0, 4], 'j-d': [8, 4] },
			[
				{ id: 'wall-straight', start: 'j-a', end: 'j-b' },
				{ id: 'wall-curved', start: 'j-c', end: 'j-d', centerline: bezier([4, -4]) }
			]
		);
		const issue = validateWallFirstTopology(document);
		expect(issue?.code).toBe('unsupported_wall_topology');
		expect(issue?.message).toContain('centerline crossing');
	});

	it('rejects a curve/curve crossing whose chords miss each other', () => {
		// Chords z = 0 and z = 4 are parallel and never meet. The curves are
		// forced to cross: `wall-a` rises past 3 while `wall-b` dips to ~1, so
		// their order swaps between x = 0 and x = 4.
		const document = documentOf(
			{ 'j-a': [0, 0], 'j-b': [8, 0], 'j-c': [0, 4], 'j-d': [8, 4] },
			[
				{ id: 'wall-a', start: 'j-a', end: 'j-b', centerline: bezier([4, 4]) },
				{ id: 'wall-b', start: 'j-c', end: 'j-d', centerline: bezier([4, 0]) }
			]
		);
		const issue = validateWallFirstTopology(document);
		expect(issue?.code).toBe('unsupported_wall_topology');
	});

	it('keeps explicit shared-Junction endpoint contact valid', () => {
		// A curved Wall leaving a straight Wall at a shared Junction is ordinary
		// connectivity, not a crossing: only contact at that Junction is legal.
		const document = documentOf(
			{ 'j-a': [0, 0], 'j-m': [3, 0], 'j-b': [4, 3] },
			[
				{ id: 'wall-straight', start: 'j-a', end: 'j-m' },
				{ id: 'wall-curved', start: 'j-m', end: 'j-b', centerline: bezier([6, 1]) }
			]
		);
		expect(validateWallFirstTopology(document)).toBeUndefined();
	});

	it('keeps a smooth collinear continuation across a shared Junction valid', () => {
		// The curve leaves the shared Junction along the straight Wall's own
		// direction, the worst case for a proximity-based crossing test.
		const document = documentOf(
			{ 'j-a': [0, 0], 'j-m': [3, 0], 'j-b': [9, 0] },
			[
				{ id: 'wall-straight', start: 'j-a', end: 'j-m' },
				{ id: 'wall-curved', start: 'j-m', end: 'j-b', centerline: bezier([6, 0.4]) }
			]
		);
		expect(validateWallFirstTopology(document)).toBeUndefined();
	});

	it('leaves two straight Walls on the chord fast path', () => {
		const crossing = documentOf(
			{ 'j-a': [0, 0], 'j-b': [4, 0], 'j-c': [2, -2], 'j-d': [2, 2] },
			[
				{ id: 'wall-h', start: 'j-a', end: 'j-b' },
				{ id: 'wall-v', start: 'j-c', end: 'j-d' }
			]
		);
		expect(validateWallFirstTopology(crossing)?.code).toBe('unsupported_wall_topology');
		const disjoint = documentOf(
			{ 'j-a': [0, 0], 'j-b': [4, 0], 'j-c': [0, 3], 'j-d': [4, 3] },
			[
				{ id: 'wall-h', start: 'j-a', end: 'j-b' },
				{ id: 'wall-v', start: 'j-c', end: 'j-d' }
			]
		);
		expect(validateWallFirstTopology(disjoint)).toBeUndefined();
	});
});
