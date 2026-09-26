/**
 * P23B.7 S3 — the AFFECTED EXTENT of one direct-edit intent.
 *
 * S3 derives, from the intent's patch (`architectureCandidatePatch`), which Walls and
 * Junctions the move can change — conservatively (INV-2), never tightly — plus the
 * conservative candidate-pair sets the canonical gate's own order admits for that move.
 * This file pins that rule on hand-built two-component documents: the exact extent per
 * intent kind, the component scoping, the gate ordering, the underivable rows, and the
 * per-move re-derivation the plan's scaling clause needs (a LATER move entering walls an
 * earlier move's extent did not contain).
 *
 * WHAT THIS FILE DOES NOT CLAIM. It is not the equivalence oracle: the scoped gate's
 * verdict equivalence (OR-3, versus S2's frozen whole-document reference) belongs to the
 * step that introduces the scoped path (S4), in that step's own commit — the plan's
 * REFERENCE-FIRST RULE. Here the rule is proven as a rule: every Wall the intent cannot
 * move keeps the baseline's own records through the shallow splice, so its predicates
 * keep the verdict the baseline produced.
 *
 * The cases the plan names for S3 are all present: junction move, wall move, bend insert,
 * knot move — and knot delete/insert is pinned as NOT having a transient extent at all
 * (it is a command, not a pointermove), with an unknown knot refused rather than guessed.
 */
import { describe, expect, it } from 'vitest';

import {
	deriveChainSpans,
	LAYOUT_WALL_FIRST_FORMAT_VERSION,
	proposeWallFirstArchitectureGeometry,
	wallCubicChain,
	wallFirstArchitectureAffectedExtent,
	wallsShareTopologyComponent,
	type LayoutDocumentWallFirst,
	type LayoutVec2,
	type LayoutWall,
	type LayoutWallCenterline,
	type LayoutWallCurveKnot,
	type LayoutWallFirstRoom,
	type WallFirstArchitectureProposalIntent
} from '@portfolio/layout-core';

const LINE: LayoutWallCenterline = { kind: 'line' };

type SeededWall = { id: string; start: string; end: string; centerline?: LayoutWallCenterline };

function documentOf(input: {
	junctions: Array<[string, number, number]>;
	walls: SeededWall[];
	rooms?: LayoutWallFirstRoom[];
}): LayoutDocumentWallFirst {
	return {
		units: 'meters',
		formatVersion: LAYOUT_WALL_FIRST_FORMAT_VERSION,
		floor: { id: 'floor-1', name: 'Floor 1', elevation: 0 },
		junctions: input.junctions.map(([id, x, z]) => ({ id, point: [x, z] as LayoutVec2 })),
		walls: input.walls.map(
			(seed): LayoutWall => ({
				id: seed.id,
				startJunctionId: seed.start,
				endJunctionId: seed.end,
				role: 'boundary',
				thickness: 0.2,
				height: 3,
				centerline: seed.centerline ?? LINE
			})
		),
		rooms: input.rooms ?? [],
		openings: [],
		objects: []
	};
}

/** A cubic chain through the authored interior points (the endpoints stay Junctions). */
function curved(start: LayoutVec2, end: LayoutVec2, through: readonly LayoutVec2[], wallId: string): LayoutWallCenterline {
	const knots: LayoutWallCurveKnot[] = through.map((point, index) => ({
		id: `${wallId}:knot:${index + 1}`,
		point: [point[0], point[1]] as LayoutVec2
	}));
	return wallCubicChain(knots, deriveChainSpans([start, ...through, end]));
}

/**
 * Two INDEPENDENT components, so a move inside one can never reach the other:
 * component A is a 6x4 enclosure whose north Wall (`a2`) is curved; component B is a
 * 4x4 enclosure 20 m away. Wall order: a1 a2 a3 a4 | b1 b2 b3 b4.
 */
function twoComponentDocument(): LayoutDocumentWallFirst {
	const enclosureA: LayoutWallFirstRoom = {
		id: 'room-a',
		name: 'Room A',
		boundary: [
			{ wallId: 'a1', direction: 'forward' },
			{ wallId: 'a2', direction: 'forward' },
			{ wallId: 'a3', direction: 'forward' },
			{ wallId: 'a4', direction: 'forward' }
		],
		floorThickness: 0.1,
		ceilingThickness: 0.1
	};
	const enclosureB: LayoutWallFirstRoom = {
		id: 'room-b',
		name: 'Room B',
		boundary: [
			{ wallId: 'b1', direction: 'forward' },
			{ wallId: 'b2', direction: 'forward' },
			{ wallId: 'b3', direction: 'forward' },
			{ wallId: 'b4', direction: 'forward' }
		],
		floorThickness: 0.1,
		ceilingThickness: 0.1
	};
	return documentOf({
		junctions: [
			['a', 0, 0],
			['b', 6, 0],
			['c', 6, 4],
			['d', 0, 4],
			['p', 20, 0],
			['q', 24, 0],
			['r', 24, 4],
			['s', 20, 4]
		],
		walls: [
			{ id: 'a1', start: 'a', end: 'b' },
			{ id: 'a2', start: 'b', end: 'c', centerline: curved([6, 0], [6, 4], [[6, 2]], 'a2') },
			{ id: 'a3', start: 'c', end: 'd' },
			{ id: 'a4', start: 'd', end: 'a' },
			{ id: 'b1', start: 'p', end: 'q' },
			{ id: 'b2', start: 'q', end: 'r' },
			{ id: 'b3', start: 'r', end: 's' },
			{ id: 'b4', start: 's', end: 'p' }
		],
		rooms: [enclosureA, enclosureB]
	});
}

function extentOf(document: LayoutDocumentWallFirst, intent: WallFirstArchitectureProposalIntent) {
	const extent = wallFirstArchitectureAffectedExtent(document, intent);
	if (!extent) throw new Error(`no affected extent for ${intent.kind}`);
	return extent;
}

const junctionMove = (junctionId: string, point: LayoutVec2): WallFirstArchitectureProposalIntent => ({
	kind: 'junction-move',
	junctionId,
	point
});

describe('P23B.7 S3 — the extent is the Walls and Junctions the intent can move', () => {
	it('junction move: the moved Junction and its incident Walls only', () => {
		const document = twoComponentDocument();
		const extent = extentOf(document, junctionMove('b', [6, -1]));
		expect(extent.junctionIds).toEqual(['b']);
		// Document order, and only the Walls incident to the moved Junction.
		expect(extent.wallIds).toEqual(['a1', 'a2']);
		// Candidate pairs: same component, at least one affected member, gate order.
		expect(extent.wallPairs).toEqual([
			['a1', 'a2'],
			['a1', 'a3'],
			['a1', 'a4'],
			['a2', 'a3'],
			['a2', 'a4']
		]);
		expect(extent.junctionPairs).toEqual([
			['a', 'b'],
			['b', 'c'],
			['b', 'd']
		]);
	});

	it('wall move: both moved Junctions and every Wall incident to either', () => {
		const document = twoComponentDocument();
		const extent = extentOf(document, { kind: 'wall-move', wallId: 'a3', delta: [0, 1] });
		expect(extent.junctionIds).toEqual(['c', 'd']);
		expect(extent.wallIds).toEqual(['a2', 'a3', 'a4']);
		expect(extent.wallPairs).toEqual([
			['a1', 'a2'],
			['a1', 'a3'],
			['a1', 'a4'],
			['a2', 'a3'],
			['a2', 'a4'],
			['a3', 'a4']
		]);
		expect(extent.junctionPairs).toEqual([
			['a', 'c'],
			['a', 'd'],
			['b', 'c'],
			['b', 'd'],
			['c', 'd']
		]);
	});

	it('knot move on a curved Wall: that Wall alone, and no Junction at all', () => {
		const document = twoComponentDocument();
		const extent = extentOf(document, {
			kind: 'curve-control-move',
			wallId: 'a2',
			knotId: 'a2:knot:1',
			point: [6.5, 2]
		});
		expect(extent.junctionIds).toEqual([]);
		expect(extent.wallIds).toEqual(['a2']);
		expect(extent.wallPairs).toEqual([
			['a1', 'a2'],
			['a2', 'a3'],
			['a2', 'a4']
		]);
		expect(extent.junctionPairs).toEqual([]);
	});

	it('bend insert: the grabbed Wall, whether it was straight or already curved', () => {
		const document = twoComponentDocument();
		const straight = extentOf(document, { kind: 'wall-bend', wallId: 'a1', distance: 3, point: [3, 1] });
		expect(straight.junctionIds).toEqual([]);
		expect(straight.wallIds).toEqual(['a1']);
		expect(straight.wallPairs).toEqual([
			['a1', 'a2'],
			['a1', 'a3'],
			['a1', 'a4']
		]);
		const curvedWall = extentOf(document, { kind: 'wall-bend', wallId: 'a2', distance: 2, point: [7, 2] });
		expect(curvedWall.wallIds).toEqual(['a2']);
		expect(curvedWall.wallPairs).toEqual([
			['a1', 'a2'],
			['a2', 'a3'],
			['a2', 'a4']
		]);
	});
});

describe('P23B.7 S3 — the rule is conservative, scoped and ordered', () => {
	it('never admits a pair across components, and never a pair with neither member affected', () => {
		const document = twoComponentDocument();
		for (const intent of [
			junctionMove('b', [6, -1]),
			{ kind: 'wall-move', wallId: 'a3', delta: [0, 1] },
			{ kind: 'curve-control-move', wallId: 'a2', knotId: 'a2:knot:1', point: [6.5, 2] }
		] satisfies WallFirstArchitectureProposalIntent[]) {
			const extent = extentOf(document, intent);
			const affected = new Set(extent.wallIds);
			for (const [first, second] of extent.wallPairs) {
				expect(wallsShareTopologyComponent(document, first, second), `${first}/${second} share a component`).toBe(true);
				expect(
					affected.has(first) || affected.has(second),
					`${first}/${second} has an affected member`
				).toBe(true);
				expect(first).not.toBe(second);
			}
			// No duplicates, and no pair from the other component.
			const keys = extent.wallPairs.map(([first, second]) => `${first}|${second}`);
			expect(new Set(keys).size).toBe(keys.length);
			expect(keys.some((key) => key.includes('b1') || key.includes('b2'))).toBe(false);
		}
	});

	it('reports the pairs in the canonical gate order: first id, then second, by document index', () => {
		const document = twoComponentDocument();
		const wallIndex = new Map(document.walls.map((wall, index) => [wall.id, index] as const));
		const junctionIndex = new Map(document.junctions.map((junction, index) => [junction.id, index] as const));
		const extent = extentOf(document, { kind: 'wall-move', wallId: 'a3', delta: [0, 1] });
		for (const [pairs, index] of [
			[extent.wallPairs, wallIndex],
			[extent.junctionPairs, junctionIndex]
		] as const) {
			for (let at = 1; at < pairs.length; at += 1) {
				const previous = pairs[at - 1]!;
				const current = pairs[at]!;
				const previousKey = [index.get(previous[0])!, index.get(previous[1])!];
				const currentKey = [index.get(current[0])!, index.get(current[1])!];
				expect(
					previousKey[0] < currentKey[0] || (previousKey[0] === currentKey[0] && previousKey[1] < currentKey[1]),
					`${previous.join('/')} precedes ${current.join('/')}`
				).toBe(true);
			}
		}
		// Document order on the id arrays themselves.
		expect(extent.wallIds).toEqual([...extent.wallIds].sort((a, b) => wallIndex.get(a)! - wallIndex.get(b)!));
		expect(extent.junctionIds).toEqual(
			[...extent.junctionIds].sort((a, b) => junctionIndex.get(a)! - junctionIndex.get(b)!)
		);
	});

	it('covers every Wall the render proposal draws (the overlay can never show an "invariant" Wall)', () => {
		const document = twoComponentDocument();
		for (const intent of [
			junctionMove('b', [6, -1]),
			{ kind: 'wall-move', wallId: 'a1', delta: [0.5, 0.5] },
			{ kind: 'curve-control-move', wallId: 'a2', knotId: 'a2:knot:1', point: [6.5, 2] },
			{ kind: 'wall-bend', wallId: 'a1', distance: 3, point: [3, 1] }
		] satisfies WallFirstArchitectureProposalIntent[]) {
			const proposed = (proposeWallFirstArchitectureGeometry(document, intent) ?? []).map((entry) => entry.wallId);
			expect(proposed.length).toBeGreaterThan(0);
			const extent = extentOf(document, intent);
			for (const wallId of proposed) expect(extent.wallIds).toContain(wallId);
		}
	});

	it('re-derives per move: a LATER move enters walls the earlier extent did not contain', () => {
		const document = twoComponentDocument();
		const first = extentOf(document, junctionMove('a', [0, -1]));
		const second = extentOf(document, junctionMove('c', [7, 5]));
		expect(first.wallIds).toEqual(['a1', 'a4']);
		expect(second.wallIds).toEqual(['a2', 'a3']);
		// The extent is a function of THAT move's patch: neither is a subset of the other,
		// so a gesture that reuses one move's affected set for the next would skip a Wall.
		expect(first.wallIds.some((wallId) => !second.wallIds.includes(wallId))).toBe(true);
		expect(second.wallIds.some((wallId) => !first.wallIds.includes(wallId))).toBe(true);
		expect(first.wallPairs).not.toEqual(second.wallPairs);
	});
});

describe('P23B.7 S3 — the underivable rows are refused, never guessed', () => {
	it('returns undefined when the intent cannot be derived at all', () => {
		const document = twoComponentDocument();
		expect(wallFirstArchitectureAffectedExtent(document, junctionMove('nope', [0, 0]))).toBeUndefined();
		expect(wallFirstArchitectureAffectedExtent(document, { kind: 'wall-move', wallId: 'nope', delta: [0, 1] })).toBeUndefined();
		expect(
			wallFirstArchitectureAffectedExtent(document, { kind: 'curve-control-move', wallId: 'a2', knotId: 'a2:knot:nope', point: [6.5, 2] })
		).toBeUndefined();
		expect(wallFirstArchitectureAffectedExtent(document, junctionMove('b', [Number.NaN, 0]))).toBeUndefined();
		expect(wallFirstArchitectureAffectedExtent(document, { kind: 'wall-move', wallId: 'a1', delta: [0, Number.POSITIVE_INFINITY] })).toBeUndefined();
		expect(wallFirstArchitectureAffectedExtent(document, { kind: 'wall-bend', wallId: 'a1', distance: 99, point: [3, 1] })).toBeUndefined();
	});

	it('has no transient extent for a knot delete or insert: those are commands, not pointermoves', () => {
		// The transient intent union is junction-move | wall-move | curve-control-move |
		// wall-bend — a knot delete/insert is a one-shot command with no per-move gate. What
		// the rule must still do is refuse to invent an extent for a move it cannot derive:
		// a knot that does not exist, and a Knot id addressed through the wrong Wall kind.
		const document = twoComponentDocument();
		expect(
			wallFirstArchitectureAffectedExtent(document, { kind: 'curve-control-move', wallId: 'a1', knotId: 'a2:knot:1', point: [6.5, 2] })
		).toBeUndefined();
		const accepted = wallFirstArchitectureAffectedExtent(document, {
			kind: 'curve-control-move',
			wallId: 'a2',
			knotId: 'a2:knot:1',
			point: [6.5, 2]
		});
		expect(accepted?.wallIds).toEqual(['a2']);
	});

	it('a degenerate one-Wall document admits no pair at all', () => {
		const document = documentOf({
			junctions: [
				['only-a', 0, 0],
				['only-b', 2, 0]
			],
			walls: [{ id: 'only', start: 'only-a', end: 'only-b' }]
		});
		const extent = extentOf(document, { kind: 'wall-bend', wallId: 'only', distance: 1, point: [1, 0.5] });
		expect(extent.wallIds).toEqual(['only']);
		expect(extent.wallPairs).toEqual([]);
		expect(extent.junctionPairs).toEqual([]);
	});
});
