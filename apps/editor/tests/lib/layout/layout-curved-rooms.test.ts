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
 * - a reverse-oriented half-edge walks the same curve backwards, so the adapter
 *   mirrors the chain; feeding it swapped endpoints instead chains the knots in
 *   the wrong order and traces a different, self-swallowing curve (visible as a
 *   different face area);
 * - the chord-level `classifyWallIntersection` is blind to curvature, so the
 *   topology gate adds a sampled seam: a Wall whose centerline crosses itself,
 *   or two Walls whose chords miss but whose curves cross, both reject.
 */
import { describe, expect, it } from 'vitest';

import {
	buildCorrespondenceComponents,
	createEmptyWallFirstLayoutDocument,
	deriveChainSpans,
	extractBoundaryCandidateFaces,
	interiorWitness,
	planConvertWallToCurve,
	roomBoundaryPolygon,
	validateWallFirstLayoutDocument,
	validateWallFirstTopology,
	wallCenterlineSamples,
	wallCubicChain,
	type LayoutDocumentWallFirst,
	type LayoutVec2,
	type LayoutWall,
	type LayoutWallCurveKnot
} from '@portfolio/layout-core';

const LINE = { kind: 'line' } as const;

/**
 * A canonical cubic chain from a Wall's endpoint positions plus its interior
 * bend points: knots carry identity, spans come from the write-path rule.
 */
function curve(
	start: LayoutVec2,
	end: LayoutVec2,
	...interior: LayoutVec2[]
): LayoutWall['centerline'] {
	const points: LayoutVec2[] = [start, ...interior, end];
	const knots: LayoutWallCurveKnot[] = interior.map((point, index) => ({
		id: `wall-a:knot:${index + 1}`,
		point: [point[0], point[1]] as LayoutVec2
	}));
	return wallCubicChain(knots, deriveChainSpans(points));
}

function documentOf(
	junctions: Record<string, LayoutVec2>,
	walls: ReadonlyArray<{
		id: string;
		start: string;
		end: string;
		centerline?: LayoutWall['centerline'];
	}>,
	rooms: LayoutDocumentWallFirst['rooms'] = []
): LayoutDocumentWallFirst {
	const document = createEmptyWallFirstLayoutDocument();
	document.junctions = Object.entries(junctions).map(([id, point]) => ({
		id,
		point: [point[0], point[1]] as LayoutVec2
	}));
	document.walls = walls.map((wall) => ({
		id: wall.id,
		startJunctionId: wall.start,
		endJunctionId: wall.end,
		role: 'boundary' as const,
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

/** Room ↔ face correspondence of a document against its own faces. */
function roomCorrespondence(document: LayoutDocumentWallFirst): string[] {
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
	return buildCorrespondenceComponents({
		faces,
		predecessorRoomIds: document.rooms.map((room) => room.id),
		predecessorWitnesses: witnesses,
		predecessorPolygons: polygons,
		candidateDocument: document,
		baselineRooms: document.rooms
	}).map(
		(component) =>
			`${component.predecessorRoomIds.length}→${component.candidateFaceKeys.length}`
	);
}

/** The bowed Wall used throughout: 6 m chord, arc peaking at z = 2. */
const BOW = curve([0, 0], [6, 0], [3, 2]);
/** The mirror bow, bending away from the Room down to z = -2. */
const BOW_OUT = curve([0, 0], [6, 0], [3, -2]);

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
		// chain's interior samples inserted after the Wall's start Junction.
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
		// A bow bending AWAY from the Room adds the arc/chord segment to the
		// enclosed area; the identical bow bending INTO the Room removes it. A
		// chord-derived area would report a flat 24 m² for all three.
		const outward = extractBoundaryCandidateFaces(rectangularRoom(BOW_OUT)).faces[0]!;
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
		// knots in persisted order would trace a different curve.
		const twoKnots = curve([0, 0], [6, 0], [2, -2], [4, -2]);
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
				{ id: 'wall-a', start: 'j-a', end: 'j-b', centerline: twoKnots },
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
		// holds only if the reverse traversal walks the SAME curve.
		expect(first!.signedArea + second!.signedArea).toBeCloseTo(6 * 8, 6);
		expect(Math.abs(first!.signedArea - second!.signedArea)).toBeGreaterThan(1);
		// Both faces include the bow's sampled vertices, and both arcs bottom out
		// at the same depth: same curve, read in opposite directions.
		const arcOf = (face: (typeof result.faces)[number]) =>
			face.polygon.filter((vertex) => vertex[0] > 0.01 && vertex[0] < 5.99 && vertex[1] < -0.5);
		const deepest = (face: (typeof result.faces)[number]) =>
			Math.min(...arcOf(face).map((vertex) => vertex[1]));
		expect(arcOf(first!).length).toBeGreaterThan(4);
		expect(arcOf(second!).length).toBeGreaterThan(4);
		// The interpolating spline overshoots its knots, so the arc reaches past
		// z = -2; what matters is that both directions reach the same depth.
		expect(deepest(first!)).toBeLessThan(-1.5);
		expect(deepest(second!)).toBeCloseTo(deepest(first!), 2);
	});

	it('keeps the reverse traversal of a multi-knot Wall on the same curve', () => {
		const wall: LayoutWall = {
			id: 'wall-a',
			startJunctionId: 'j-a',
			endJunctionId: 'j-b',
			role: 'boundary',
			thickness: 0.2,
			height: 3,
			centerline: curve([0, 0], [6, 0], [2, 2], [4, 2])
		};
		// Canonical endpoints + traversal flag: the flag alone is the direction
		// authority, so the two can never disagree.
		const forward = wallCenterlineSamples(wall, [0, 0], [6, 0], 'forward')!;
		const reverse = wallCenterlineSamples(wall, [0, 0], [6, 0], 'reverse')!;
		// Same curve, opposite direction: arc length matches and the samples
		// coincide point-for-point with the forward run read backwards.
		expect(reverse.length).toBeCloseTo(forward.length, 9);
		expect(reverse.samples).toHaveLength(forward.samples.length);
		const mirrored = [...forward.samples].reverse();
		for (let index = 0; index < mirrored.length; index += 1) {
			expect(reverse.samples[index]!.point[0]).toBeCloseTo(mirrored[index]!.point[0], 6);
			expect(reverse.samples[index]!.point[1]).toBeCloseTo(mirrored[index]!.point[1], 6);
		}
		// Knot order is reversed, not merely re-pointed at the other end.
		expect(reverse.samples[0]!.point).toEqual([6, 0]);
		expect(reverse.samples.at(-1)!.point).toEqual([0, 0]);
	});

	it('preserves the Room through a straight-to-curve conversion', () => {
		const document = rectangularRoom();
		const plan = planConvertWallToCurve(document, 'wall-a');
		expect(plan.kind).toBe('success');
		if (plan.kind !== 'success') return;
		expect(validateWallFirstLayoutDocument(plan.document).success).toBe(true);
		const before = extractBoundaryCandidateFaces(document).faces;
		const after = extractBoundaryCandidateFaces(plan.document).faces;
		expect(after).toHaveLength(before.length);
		// Room identity survives the representation change: the face still
		// corresponds 1→1 to the predecessor Room, and the conversion is a
		// geometric no-op.
		expect(roomCorrespondence(plan.document)).toEqual(['1→1']);
		expect(after[0]!.signedArea).toBeCloseTo(before[0]!.signedArea, 6);
	});

	it('keeps a Room with a curved boundary corresponding 1→1', () => {
		// Room identity is decided by correspondence, so the curved Room must
		// still match its predecessor face even though its ring now carries
		// sampled curve vertices between the junction corners.
		expect(roomCorrespondence(rectangularRoom(BOW))).toEqual(['1→1']);
	});
});

describe('P23.11 slice 3 — curve-level crossing validation', () => {
	it('rejects a curved Wall whose centerline intersects itself', () => {
		// Endpoints one metre apart with the single knot swept far past them:
		// the curve runs out and doubles back over its own path.
		const document = documentOf(
			{ 'j-a': [0, 0], 'j-b': [1, 0] },
			[{ id: 'wall-a', start: 'j-a', end: 'j-b', centerline: curve([0, 0], [1, 0], [5, 0]) }]
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
				{ id: 'wall-curved', start: 'j-c', end: 'j-d', centerline: curve([0, 4], [8, 4], [4, -4]) }
			]
		);
		const issue = validateWallFirstTopology(document);
		expect(issue?.code).toBe('unsupported_wall_topology');
		expect(issue?.message).toContain('centerline crossing');
	});

	it('rejects a curve/curve crossing whose chords miss each other', () => {
		// Chords z = 0 and z = 4 are parallel and never meet. The curves are
		// forced to cross: `wall-a` rises to 4 while `wall-b` dips to 0, so
		// their order swaps between x = 0 and x = 4.
		const document = documentOf(
			{ 'j-a': [0, 0], 'j-b': [8, 0], 'j-c': [0, 4], 'j-d': [8, 4] },
			[
				{ id: 'wall-a', start: 'j-a', end: 'j-b', centerline: curve([0, 0], [8, 0], [4, 4]) },
				{ id: 'wall-b', start: 'j-c', end: 'j-d', centerline: curve([0, 4], [8, 4], [4, 0]) }
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
				{ id: 'wall-curved', start: 'j-m', end: 'j-b', centerline: curve([3, 0], [4, 3], [6, 1]) }
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
				{ id: 'wall-curved', start: 'j-m', end: 'j-b', centerline: curve([3, 0], [9, 0], [6, 0.4]) }
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
