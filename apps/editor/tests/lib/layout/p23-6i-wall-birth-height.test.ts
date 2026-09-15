/**
 * P23.6I — deterministic Wall **birth** height (I3).
 *
 * `WALL_AUTHORING_DEFAULT_HEIGHT` is a creation default only: not an envelope,
 * not a validation cap, not a Floor value. It is also never chosen by the editor,
 * because the first segment of an authoring gesture derives its height from
 * **canonical document topology** in the pure planner — so a headless caller and
 * the human Plan interaction execute the same semantic operation.
 *
 * Rules pinned here (P23.6I D5):
 *
 * ```text
 * explicit height                                    → that height
 * start Junction with one unique incident Wall height → inherit it
 * start Junction with several incident Walls, all equal → inherit it
 * start Junction with differing incident Wall heights → WALL_AUTHORING_DEFAULT_HEIGHT
 * start point not on a Junction (isolated start)      → WALL_AUTHORING_DEFAULT_HEIGHT
 * ```
 *
 * Deliberately **not** this rule:
 * - continuation inside one active draw run — the editor carries that as
 *   transient state and passes it explicitly (`p23-6i-wall-run-height.test.ts`);
 * - Rectangle/Polygon, which are bounded compound commands and take one uniform
 *   height for the whole generated chain, never a per-leg inheritance.
 */
import { describe, expect, it } from 'vitest';

import {
	LAYOUT_WALL_FIRST_FORMAT_VERSION,
	planDuplicateIsolatedRoom,
	planWallChain,
	planWallSegment,
	resolveWallBirthHeight,
	uniqueIncidentWallHeight,
	WALL_AUTHORING_DEFAULT_HEIGHT,
	type LayoutDocumentWallFirst,
	type LayoutVec2
} from '@portfolio/layout-core';

type WallSpec = { id: string; start: string; end: string; height: number };

/** Minimal wall-first document: named junction points plus explicit Wall heights. */
function documentWith(
	points: Record<string, LayoutVec2>,
	walls: WallSpec[],
	role: 'boundary' | 'partition' = 'partition'
): LayoutDocumentWallFirst {
	return {
		units: 'meters',
		formatVersion: LAYOUT_WALL_FIRST_FORMAT_VERSION,
		floor: { id: 'floor-1', name: 'Floor 1', elevation: 0 },
		junctions: Object.entries(points).map(([id, point]) => ({ id, point })),
		walls: walls.map((wall) => ({
			id: wall.id,
			startJunctionId: wall.start,
			endJunctionId: wall.end,
			role,
			thickness: 0.2,
			height: wall.height,
			centerline: { kind: 'line' } as const,
		})),
		rooms: [],
		openings: [],
		objects: []
	};
}

/** One closed 4×3 m Room with four boundary Walls at a per-Wall height. */
function roomDocument(wallHeights: [number, number, number, number]): LayoutDocumentWallFirst {
	const document = documentWith(
		{ j1: [0, 0], j2: [4, 0], j3: [4, 3], j4: [0, 3] },
		[
			{ id: 'w1', start: 'j1', end: 'j2', height: wallHeights[0] },
			{ id: 'w2', start: 'j2', end: 'j3', height: wallHeights[1] },
			{ id: 'w3', start: 'j3', end: 'j4', height: wallHeights[2] },
			{ id: 'w4', start: 'j4', end: 'j1', height: wallHeights[3] }
		],
		'boundary'
	);
	return {
		...document,
		rooms: [
			{
				id: 'room-a',
				name: 'Room A',
				boundary: [
					{ wallId: 'w1', direction: 'forward' },
					{ wallId: 'w2', direction: 'forward' },
					{ wallId: 'w3', direction: 'forward' },
					{ wallId: 'w4', direction: 'forward' }
				],
				floorThickness: 0.1,
				ceilingThickness: 0.1
			}
		]
	};
}

/** The height a plan actually committed for its authored segment. */
function authoredHeight(document: LayoutDocumentWallFirst, authoredWallIds: string[]): number {
	const authoredId = authoredWallIds[0]!;
	const wall = document.walls.find((candidate) => candidate.id === authoredId);
	if (!wall) throw new Error(`missing authored wall ${authoredId}`);
	return wall.height;
}

describe('P23.6I Wall birth height — resolveWallBirthHeight() is the one durable rule', () => {
	it('returns the explicit height verbatim, ignoring topology', () => {
		const document = documentWith({ a: [0, 0], b: [4, 0] }, [
			{ id: 'w1', start: 'a', end: 'b', height: 4 }
		]);
		expect(resolveWallBirthHeight(document, 'a', 1.2)).toBe(1.2);
	});

	it('inherits the unique incident height of an existing start Junction', () => {
		const document = documentWith({ a: [0, 0], b: [4, 0], c: [0, 3] }, [
			{ id: 'w1', start: 'a', end: 'b', height: 4 },
			{ id: 'w2', start: 'c', end: 'a', height: 4 }
		]);
		expect(resolveWallBirthHeight(document, 'a')).toBe(4);
	});

	it('falls back to the named default at a mixed-height Junction', () => {
		// A Junction legitimately carries several incident Walls with different
		// heights. Choosing one would make creation depend on Wall order or on
		// which Wall happened to be authored first, so the rule refuses to guess.
		const document = documentWith({ a: [0, 0], b: [4, 0], c: [0, 3] }, [
			{ id: 'w1', start: 'a', end: 'b', height: 4 },
			{ id: 'w2', start: 'c', end: 'a', height: 2 }
		]);
		expect(resolveWallBirthHeight(document, 'a')).toBe(WALL_AUTHORING_DEFAULT_HEIGHT);
	});

	it('falls back to the named default for an isolated start', () => {
		const document = documentWith({ a: [0, 0], b: [4, 0] }, [
			{ id: 'w1', start: 'a', end: 'b', height: 4 }
		]);
		expect(resolveWallBirthHeight(document, null)).toBe(WALL_AUTHORING_DEFAULT_HEIGHT);
	});

	it('is independent of Wall document order', () => {
		const walls: WallSpec[] = [
			{ id: 'w1', start: 'a', end: 'b', height: 4 },
			{ id: 'w2', start: 'c', end: 'a', height: 4 }
		];
		const points = { a: [0, 0] as LayoutVec2, b: [4, 0] as LayoutVec2, c: [0, 3] as LayoutVec2 };
		expect(resolveWallBirthHeight(documentWith(points, walls), 'a')).toBe(4);
		expect(resolveWallBirthHeight(documentWith(points, [...walls].reverse()), 'a')).toBe(4);
	});

	it('reports adjacency through uniqueIncidentWallHeight() itself', () => {
		const document = documentWith({ a: [0, 0], b: [4, 0], c: [0, 3] }, [
			{ id: 'w1', start: 'a', end: 'b', height: 4 },
			{ id: 'w2', start: 'c', end: 'a', height: 2 }
		]);
		expect(uniqueIncidentWallHeight(document, 'b')).toBe(4);
		expect(uniqueIncidentWallHeight(document, 'a')).toBeUndefined();
		expect(uniqueIncidentWallHeight(document, 'missing')).toBeUndefined();
	});
});

describe('P23.6I Wall birth height — the segment-first planner applies the rule', () => {
	it('inherits the incident height of the start Junction', () => {
		const baseline = documentWith({ a: [0, 0], b: [4, 0] }, [
			{ id: 'w1', start: 'a', end: 'b', height: 4 }
		]);
		const plan = planWallSegment({ baseline, start: [0, 0], end: [0, 3], role: 'partition' });
		if (plan.kind !== 'success') throw new Error(`expected success: ${JSON.stringify(plan)}`);
		expect(authoredHeight(plan.document, plan.authoredWallIds)).toBe(4);
	});

	it('inherits when several incident Walls agree, and defaults when they disagree', () => {
		const agreeing = documentWith({ a: [0, 0], b: [4, 0], c: [0, 3] }, [
			{ id: 'w1', start: 'a', end: 'b', height: 4 },
			{ id: 'w2', start: 'c', end: 'a', height: 4 }
		]);
		const inherited = planWallSegment({
			baseline: agreeing,
			start: [0, 0],
			end: [0, -3],
			role: 'partition'
		});
		if (inherited.kind !== 'success') throw new Error('expected success');
		expect(authoredHeight(inherited.document, inherited.authoredWallIds)).toBe(4);

		const mixed = documentWith({ a: [0, 0], b: [4, 0], c: [0, 3] }, [
			{ id: 'w1', start: 'a', end: 'b', height: 4 },
			{ id: 'w2', start: 'c', end: 'a', height: 2 }
		]);
		const defaulted = planWallSegment({
			baseline: mixed,
			start: [0, 0],
			end: [0, -3],
			role: 'partition'
		});
		if (defaulted.kind !== 'success') throw new Error('expected success');
		expect(authoredHeight(defaulted.document, defaulted.authoredWallIds)).toBe(
			WALL_AUTHORING_DEFAULT_HEIGHT
		);
	});

	it('resolves the start Junction by exact coordinate, never by proximity', () => {
		// Snapping is an editor suggestion; the planner's own junction reuse is exact
		// coordinate equality. A near miss must therefore take the default rather
		// than silently inheriting a neighbour's height.
		const baseline = documentWith({ a: [0, 0], b: [4, 0] }, [
			{ id: 'w1', start: 'a', end: 'b', height: 4 }
		]);
		const nearMiss = planWallSegment({
			baseline,
			start: [0, 0.0001],
			end: [0, 3],
			role: 'partition'
		});
		if (nearMiss.kind !== 'success') throw new Error('expected success');
		expect(authoredHeight(nearMiss.document, nearMiss.authoredWallIds)).toBe(
			WALL_AUTHORING_DEFAULT_HEIGHT
		);
	});

	it('lets an explicit height override inheritance', () => {
		const baseline = documentWith({ a: [0, 0], b: [4, 0] }, [
			{ id: 'w1', start: 'a', end: 'b', height: 4 }
		]);
		const plan = planWallSegment({
			baseline,
			start: [0, 0],
			end: [0, 3],
			role: 'partition',
			height: 1.2
		});
		if (plan.kind !== 'success') throw new Error('expected success');
		expect(authoredHeight(plan.document, plan.authoredWallIds)).toBe(1.2);
	});
});

describe('P23.6I Wall birth height — bounded compound gestures stay uniform', () => {
	it('gives a Rectangle/Polygon a uniform default even when a vertex is on a tall Wall', () => {
		// Rectangle/Polygon are one bounded command: inheriting per leg would make
		// one gesture produce several heights, which the compound tools must not do.
		// The 4 m Wall runs away from the rectangle's first vertex, so the gesture
		// starts ON a tall Wall's Junction without overlapping it.
		const baseline = documentWith({ a: [0, 0], b: [0, 3] }, [
			{ id: 'w1', start: 'a', end: 'b', height: 4 }
		]);
		const plan = planWallChain({
			baseline,
			points: [
				[0, 0],
				[0, -3],
				[4, -3],
				[4, 0]
			],
			close: true,
			role: 'partition'
		});
		if (plan.kind !== 'success') throw new Error(`expected success: ${JSON.stringify(plan)}`);
		const authored = plan.document.walls.filter((wall) => plan.authoredWallIds.includes(wall.id));
		expect(authored.length).toBeGreaterThan(0);
		expect(new Set(authored.map((wall) => wall.height))).toEqual(
			new Set([WALL_AUTHORING_DEFAULT_HEIGHT])
		);
	});

	it('gives a Rectangle/Polygon one uniform explicit height', () => {
		const baseline = documentWith({}, []);
		const plan = planWallChain({
			baseline,
			points: [
				[0, 0],
				[3, 0],
				[3, 3],
				[0, 3]
			],
			close: true,
			role: 'partition',
			height: 1.2
		});
		if (plan.kind !== 'success') throw new Error('expected success');
		expect(new Set(plan.document.walls.map((wall) => wall.height))).toEqual(new Set([1.2]));
	});
});

describe('P23.6I Wall birth height — existing Walls keep their authored height', () => {
	it('never rewrites the heights already in the baseline', () => {
		const baseline = roomDocument([4, 2, 2, 2]);
		const plan = planWallSegment({
			baseline,
			start: [0, 0],
			end: [-3, 0],
			role: 'partition'
		});
		if (plan.kind !== 'success') throw new Error('expected success');
		const heights = new Map(plan.document.walls.map((wall) => [wall.id, wall.height]));
		expect([heights.get('w1'), heights.get('w2'), heights.get('w3'), heights.get('w4')]).toEqual([
			4, 2, 2, 2
		]);
	});

	it('clones Room-duplicate Walls at their source heights exactly', () => {
		const plan = planDuplicateIsolatedRoom(roomDocument([4, 2, 2, 2]), {
			roomId: 'room-a',
			delta: [10, 0]
		});
		if (plan.kind !== 'success') throw new Error(`expected success: ${JSON.stringify(plan)}`);
		const clones = plan.document.walls.filter((wall) => !['w1', 'w2', 'w3', 'w4'].includes(wall.id));
		expect(clones.map((wall) => wall.height)).toEqual([4, 2, 2, 2]);
	});
});
