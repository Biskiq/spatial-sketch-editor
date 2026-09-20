/**
 * P23 Junction dissolve / Wall join — curved-wall contract.
 *
 * Curve joins concatenate chains with the Junction demoted to one fresh
 * interior knot: zero control-point math, byte-identical spans. Pinned here:
 *
 * - unrelated curve fragments join exactly (spans/knots preserved verbatim);
 * - the traversal-mirror pin: a reverse-traversed side contributes mirrored
 *   spans in reversed order, so `wallCenterlineCubics(joined)` equals the
 *   concatenated per-side traversal cubics (the review blocker — raw stored
 *   order would trace a different curve);
 * - knot-promoted subdivision inverts to the identical cubic list;
 * - mid-span subdivision inverts to sample-identical geometry;
 * - a curved split → dissolve round trip through a real Room preserves Room
 *   identity and hosted Opening offsets.
 */
import { describe, expect, it } from 'vitest';
import {
	cubicBezierPoint,
	deriveChainSpans,
	planConvertWallToCurve,
	planDissolveJunction,
	planWallSplit,
	wallCenterlineCubics,
	wallCurveChainLength,
	wallCurveKnotArcDistance,
	LAYOUT_WALL_FIRST_FORMAT_VERSION,
	type CubicBezierShape,
	type LayoutDocumentWallFirst,
	type LayoutVec2,
	type LayoutWallCenterline,
	type LayoutWallCurveKnot,
	type NodingIdAllocator
} from '@portfolio/layout-core';

const allocator: NodingIdAllocator = {
	nextWallId: (_document, seed) => `${seed}-frag`,
	nextJunctionId: (_document, seed) => `${seed}-j`
};

function point(x: number, z: number): LayoutVec2 {
	return [x, z];
}

/** A curved wall with an explicit knot chain; spans from the canonical rule. */
function curvedWall(
	id: string,
	start: string,
	end: string,
	knotSeeds: Array<[string, LayoutVec2]>
): LayoutDocumentWallFirst['walls'][number] {
	const knots: LayoutWallCurveKnot[] = knotSeeds.map(([knotId, knotPoint]) => ({
		id: knotId,
		point: [knotPoint[0], knotPoint[1]]
	}));
	return {
		id,
		startJunctionId: start,
		endJunctionId: end,
		role: 'boundary',
		thickness: 0.2,
		height: 3,
		// Spans are derived here only to author the fixture; the dissolve
		// planner never re-derives them.
		centerline: {
			kind: 'cubic-chain',
			knots,
			spans: deriveChainSpans([junctionPoint(start), ...knots.map((knot) => knot.point), junctionPoint(end)])
		}
	};
}

// Fixture junction coordinates, shared with curvedWall above.
const POINTS: Record<string, LayoutVec2> = {
	J: point(0, 0),
	E1: point(-3, 0.5),
	E2: point(3, -0.5)
};

function junctionPoint(id: string): LayoutVec2 {
	const found = POINTS[id];
	if (!found) throw new Error(`unknown fixture junction ${id}`);
	return [found[0], found[1]];
}

function roomlessDocument(
	junctions: Record<string, LayoutVec2>,
	walls: LayoutDocumentWallFirst['walls']
): LayoutDocumentWallFirst {
	return {
		units: 'meters',
		formatVersion: LAYOUT_WALL_FIRST_FORMAT_VERSION,
		floor: { id: 'floor-1', name: 'Floor 1', elevation: 0 },
		junctions: Object.entries(junctions).map(([id, junctionPoint]) => ({
			id,
			point: [junctionPoint[0], junctionPoint[1]] as LayoutVec2
		})),
		walls,
		rooms: [],
		openings: [],
		objects: [] as LayoutDocumentWallFirst['objects']
	};
}

/** Dense sample polyline: 400 points per cubic. */
function denseSamples(cubics: CubicBezierShape[]): Array<[number, number]> {
	const samples: Array<[number, number]> = [];
	for (const cubic of cubics) {
		for (let step = 0; step <= 400; step += 1) {
			const at = cubicBezierPoint(cubic, step / 400);
			samples.push([at[0], at[1]]);
		}
	}
	return samples;
}

/** Distance from a point to one polyline segment. */
function segmentDistance(
	sample: [number, number],
	a: [number, number],
	b: [number, number]
): number {
	const dx = b[0] - a[0];
	const dz = b[1] - a[1];
	const lengthSquared = dx * dx + dz * dz;
	if (!(lengthSquared > 0)) return Math.hypot(sample[0] - a[0], sample[1] - a[1]);
	const t = Math.min(
		1,
		Math.max(0, ((sample[0] - a[0]) * dx + (sample[1] - a[1]) * dz) / lengthSquared)
	);
	return Math.hypot(sample[0] - (a[0] + t * dx), sample[1] - (a[1] + t * dz));
}

/**
 * Same sampled point set in both directions (symmetric polyline Hausdorff).
 * Used where span counts differ (a subdivided-then-joined chain holds more
 * spans than the original single cubic), so per-index comparison cannot
 * apply. Point-to-segment measurement keeps dense-grid chord error far below
 * the tolerance; 1e-6 is orders of magnitude under any real geometric change.
 */
function expectSameSampledCurve(a: CubicBezierShape[], b: CubicBezierShape[]) {
	const denseA = denseSamples(a);
	const denseB = denseSamples(b);
	for (const [samples, others] of [
		[denseA, denseB],
		[denseB, denseA]
	] as const) {
		for (const sample of samples) {
			let best = Infinity;
			for (let index = 0; index + 1 < others.length; index += 1) {
				const distance = segmentDistance(sample, others[index]!, others[index + 1]!);
				if (distance < best) best = distance;
			}
			expect(best).toBeLessThanOrEqual(1e-6);
		}
	}
}

describe('curve dissolve', () => {
	it('concatenates unrelated chains with byte-identical spans', () => {
		const wallA = curvedWall('wa', 'J', 'E1', [['ka', point(-1, 0.8)]]);
		const wallB = curvedWall('wb', 'J', 'E2', [['kb', point(1, -0.8)]]);
		const document = roomlessDocument(POINTS, [wallA, wallB]);

		const plan = planDissolveJunction(document, 'J');
		expect(plan.kind).toBe('success');
		if (plan.kind !== 'success') throw new Error('unreachable');
		// Both-start configuration: lexicographic survivor is wa, joined E1→E2.
		// Each single-knot side contributes two spans; the knot counter starts
		// past the combined existing knots.
		expect(plan.survivorWallId).toBe('wa');
		expect(plan.createdKnotId).toBe('wa:knot:3');

		const joined = plan.document.walls.find((wall) => wall.id === 'wa')!;
		expect([joined.startJunctionId, joined.endJunctionId]).toEqual(['E1', 'E2']);
		if (joined.centerline.kind !== 'cubic-chain') throw new Error('expected chain');
		// wa is traversed in reverse: its single knot survives, spans mirrored.
		expect(joined.centerline.knots.map((knot) => knot.id)).toEqual(['ka', 'wa:knot:3', 'kb']);
		expect(joined.centerline.spans).toHaveLength(4);
		expect(joined.centerline.knots[1]!.point).toEqual([0, 0]);
	});

	it('pins the traversal mirror: joined cubics equal concatenated traversal cubics', () => {
		// Two knots per side so knot ORDER is observable, not just controls.
		const wallA = curvedWall('wa', 'J', 'E1', [
			['ka1', point(-1, 0.9)],
			['ka2', point(-2, 0.2)]
		]);
		const wallB = curvedWall('wb', 'J', 'E2', [
			['kb1', point(1, -0.9)],
			['kb2', point(2, -0.2)]
		]);
		const document = roomlessDocument(POINTS, [wallA, wallB]);

		const plan = planDissolveJunction(document, 'J');
		expect(plan.kind).toBe('success');
		if (plan.kind !== 'success') throw new Error('unreachable');
		const joined = plan.document.walls.find((wall) => wall.id === 'wa')!;
		if (joined.centerline.kind !== 'cubic-chain') throw new Error('expected chain');

		// Knot order proves the reverse side was reoriented, not concatenated raw.
		expect(joined.centerline.knots.map((knot) => knot.id)).toEqual([
			'ka2',
			'ka1',
			plan.createdKnotId,
			'kb1',
			'kb2'
		]);

		const joinedCubics = wallCenterlineCubics(joined.centerline, POINTS.E1!, POINTS.E2!, 'forward');
		const expectedCubics = [
			...wallCenterlineCubics(wallA.centerline, POINTS.J!, POINTS.E1!, 'reverse'),
			...wallCenterlineCubics(wallB.centerline, POINTS.J!, POINTS.E2!, 'forward')
		];
		expect(joinedCubics).toEqual(expectedCubics);
	});

	it('inverts a knot-promoted subdivision to the identical cubic list', () => {
		const wall = curvedWall('w', 'J', 'E2', [['kk', point(1.2, 0.6)]]);
		const base = roomlessDocument(
			{ J: POINTS.J!, E2: POINTS.E2! },
			[{ ...wall, startJunctionId: 'J', endJunctionId: 'E2' }]
		);
		const chain = {
			startPoint: POINTS.J!,
			endPoint: POINTS.E2!,
			knots: wall.centerline.kind === 'cubic-chain' ? wall.centerline.knots : [],
			spans: wall.centerline.kind === 'cubic-chain' ? wall.centerline.spans : []
		};
		const atKnot = wallCurveKnotArcDistance(chain, 'kk')!;
		const split = planWallSplit(base, 'w', atKnot, allocator);
		expect(split.kind).toBe('success');
		if (split.kind !== 'success') throw new Error('unreachable');

		const plan = planDissolveJunction(split.document, split.junctionId);
		expect(plan.kind).toBe('success');
		if (plan.kind !== 'success') throw new Error('unreachable');
		expect(plan.survivorWallId).toBe('w');
		const joined = plan.document.walls.find((entry) => entry.id === 'w')!;
		if (joined.centerline.kind !== 'cubic-chain') throw new Error('expected chain');
		// Same span count restored, same geometry point-for-point.
		expect(joined.centerline.spans).toHaveLength(2);
		expect(
			wallCenterlineCubics(joined.centerline, POINTS.J!, POINTS.E2!, 'forward')
		).toEqual(wallCenterlineCubics(wall.centerline, POINTS.J!, POINTS.E2!, 'forward'));
	});

	it('inverts a mid-span subdivision to sample-identical geometry', () => {
		const wall = curvedWall('w', 'J', 'E2', []);
		const hollow = wall.centerline.kind === 'cubic-chain' ? wall.centerline : null;
		if (!hollow) throw new Error('expected chain');
		const base = roomlessDocument({ J: POINTS.J!, E2: POINTS.E2! }, [wall]);
		const total = wallCurveChainLength({
			startPoint: POINTS.J!,
			endPoint: POINTS.E2!,
			knots: hollow.knots,
			spans: hollow.spans
		});
		const split = planWallSplit(base, 'w', total / 2, allocator);
		expect(split.kind).toBe('success');
		if (split.kind !== 'success') throw new Error('unreachable');

		const plan = planDissolveJunction(split.document, split.junctionId);
		expect(plan.kind).toBe('success');
		if (plan.kind !== 'success') throw new Error('unreachable');
		const joined = plan.document.walls.find((entry) => entry.id === 'w')!;
		if (joined.centerline.kind !== 'cubic-chain') throw new Error('expected chain');
		// The de Casteljau halves are preserved as two spans around one knot.
		expect(joined.centerline.spans).toHaveLength(2);
		expect(joined.centerline.knots).toHaveLength(1);
		expectSameSampledCurve(
			wallCenterlineCubics(joined.centerline, POINTS.J!, POINTS.E2!, 'forward'),
			wallCenterlineCubics(wall.centerline, POINTS.J!, POINTS.E2!, 'forward')
		);
	});

	it('round-trips a curved wall through a real room with its opening', () => {
		const document: LayoutDocumentWallFirst = {
			units: 'meters',
			formatVersion: LAYOUT_WALL_FIRST_FORMAT_VERSION,
			floor: { id: 'floor-1', name: 'Floor 1', elevation: 0 },
			junctions: [
				{ id: 'A', point: [0, 0] },
				{ id: 'B', point: [4, 0] },
				{ id: 'C', point: [4, 3] },
				{ id: 'D', point: [0, 3] }
			],
			walls: [
				{ id: 'w1', startJunctionId: 'A', endJunctionId: 'B', role: 'boundary', thickness: 0.2, height: 3, centerline: { kind: 'line' } },
				{ id: 'w2', startJunctionId: 'B', endJunctionId: 'C', role: 'boundary', thickness: 0.2, height: 3, centerline: { kind: 'line' } },
				{ id: 'w3', startJunctionId: 'C', endJunctionId: 'D', role: 'boundary', thickness: 0.2, height: 3, centerline: { kind: 'line' } },
				{ id: 'w4', startJunctionId: 'D', endJunctionId: 'A', role: 'boundary', thickness: 0.2, height: 3, centerline: { kind: 'line' } }
			],
			rooms: [
				{
					id: 'room',
					name: 'Room',
					boundary: [
						{ wallId: 'w1', direction: 'forward' },
						{ wallId: 'w2', direction: 'forward' },
						{ wallId: 'w3', direction: 'forward' },
						{ wallId: 'w4', direction: 'forward' }
					],
					floorThickness: 0.1,
					ceilingThickness: 0.1
				}
			],
			openings: [
				{ id: 'door', wallId: 'w1', kind: 'door', offset: 2.6, width: 0.9, height: 2, sillHeight: 0, profile: 'rectangular' }
			],
			objects: [] as LayoutDocumentWallFirst['objects']
		};
		const curved = planConvertWallToCurve(document, 'w1');
		expect(curved.kind).toBe('success');
		if (curved.kind !== 'success') throw new Error(`convert rejected: ${curved}`);
		const split = planWallSplit(curved.document, 'w1', 1.1, allocator);
		expect(split.kind).toBe('success');
		if (split.kind !== 'success') throw new Error('unreachable');

		const plan = planDissolveJunction(split.document, split.junctionId);
		expect(plan.kind).toBe('success');
		if (plan.kind !== 'success') throw new Error(`dissolve rejected: ${JSON.stringify(plan)}`);
		expect(plan.survivorWallId).toBe('w1');
		expect(plan.createdKnotId).toBeDefined();
		expect(plan.document.rooms.map((room) => room.id)).toEqual(['room']);
		const door = plan.document.openings.find((opening) => opening.id === 'door')!;
		expect(door.wallId).toBe('w1');
		expect(door.offset).toBeCloseTo(2.6, 9);
		const joined = plan.document.walls.find((wall) => wall.id === 'w1')!;
		if (joined.centerline.kind !== 'cubic-chain') throw new Error('expected chain');
		const curvedBefore = curved.document.walls.find((wall) => wall.id === 'w1')!;
		if (curvedBefore.centerline.kind !== 'cubic-chain') throw new Error('expected chain');
		expectSameSampledCurve(
			wallCenterlineCubics(joined.centerline, [0, 0], [4, 0], 'forward'),
			wallCenterlineCubics(curvedBefore.centerline, [0, 0], [4, 0], 'forward')
		);
	});

	it('rejects straight-plus-curved pairs without converting kind', () => {
		const wallA = curvedWall('wa', 'J', 'E1', [['ka', point(-1, 0.8)]]);
		const document = roomlessDocument(POINTS, [
			wallA,
			{
				id: 'wb',
				startJunctionId: 'J',
				endJunctionId: 'E2',
				role: 'boundary',
				thickness: 0.2,
				height: 3,
				centerline: { kind: 'line' }
			}
		]);
		const plan = planDissolveJunction(document, 'J');
		expect(plan.kind).toBe('rejected');
		if (plan.kind !== 'rejected') throw new Error('unreachable');
		expect(plan.rejection.code).toBe('incompatible_wall_pair');
		expect(JSON.stringify(document)).toBe(
			JSON.stringify(roomlessDocument(POINTS, [wallA, document.walls[1]!]))
		);
	});

	it('rejects curved-plus-straight pairs in the reverse wall order', () => {
		// Same-kind-only holds regardless of which incident wall comes first:
		// a straight wall leading into a curved one still rejects.
		const wallB = curvedWall('wb', 'J', 'E2', [['kb', point(1, -0.8)]]);
		const document = roomlessDocument(POINTS, [
			{
				id: 'wa',
				startJunctionId: 'E1',
				endJunctionId: 'J',
				role: 'boundary',
				thickness: 0.2,
				height: 3,
				centerline: { kind: 'line' }
			},
			wallB
		]);
		const plan = planDissolveJunction(document, 'J');
		expect(plan.kind).toBe('rejected');
		if (plan.kind !== 'rejected') throw new Error('unreachable');
		expect(plan.rejection.code).toBe('incompatible_wall_pair');
	});
});

describe('oriented chain helper', () => {
	it('exposes the single reverse-orientation implementation', async () => {
		const { orientedWallChainKnotsAndSpans } = await import('@portfolio/layout-core');
		const wall = curvedWall('w', 'J', 'E2', [
			['k1', point(1, 0.5)],
			['k2', point(2, 0.2)]
		]);
		if (wall.centerline.kind !== 'cubic-chain') throw new Error('expected chain');
		const forward = orientedWallChainKnotsAndSpans(wall.centerline, 'forward');
		expect(forward.knots.map((knot) => knot.id)).toEqual(['k1', 'k2']);
		const reverse = orientedWallChainKnotsAndSpans(wall.centerline, 'reverse');
		expect(reverse.knots.map((knot) => knot.id)).toEqual(['k2', 'k1']);
		// Mirrored spans: reversed span 0 is the mirror of stored span 2
		// (a two-knot chain holds three spans).
		expect(reverse.spans[0]!.handleOut).toEqual(wall.centerline.spans[2]!.handleIn);
		expect(reverse.spans[0]!.handleIn).toEqual(wall.centerline.spans[2]!.handleOut);
		// Deep clones: mutating the result cannot alias the baseline.
		reverse.knots[0]!.point[0] = 999;
		expect(wall.centerline.knots[1]!.point[0]).not.toBe(999);
	});

	it('yields empty chains for straight walls', async () => {
		const { orientedWallChainKnotsAndSpans } = await import('@portfolio/layout-core');
		const line: LayoutWallCenterline = { kind: 'line' };
		expect(orientedWallChainKnotsAndSpans(line, 'forward')).toEqual({ knots: [], spans: [] });
		expect(orientedWallChainKnotsAndSpans(line, 'reverse')).toEqual({ knots: [], spans: [] });
	});
});
