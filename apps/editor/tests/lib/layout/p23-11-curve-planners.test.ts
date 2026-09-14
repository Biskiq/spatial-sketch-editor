/**
 * P23.11 Slice 4 — canonical curve planners and Opening semantics.
 *
 * Every planner builds its candidate from the immutable baseline, mutates only
 * canonical Layout data, allocates deterministic anchor IDs, and returns either
 * one accepted document or a stable rejection that leaves the baseline intact.
 * Wall, Junction, Opening and Room identities survive a curve edit; Openings
 * keep their authored `offset` — physical metres from the Wall's canonical
 * start — through any valid reshape, because offset means "distance along the
 * centerline", never "world position". A reshape that can no longer host an
 * Opening rejects the whole edit instead of rewriting it.
 *
 * The straight-only boundary is explicit in both directions: exact length,
 * exact angle and subdivision reject a curved target, and `planWallSplit`
 * itself refuses any non-`line` Wall before allocating fragments, so no other
 * caller can quietly flatten a curve.
 */
import { describe, expect, it } from 'vitest';

import {
	compileWallFirstLayoutGeometry,
	planConvertWallToCurve,
	planConvertWallToLine,
	planDeleteWallCurveAnchor,
	planExactJunctionMove,
	planExactWallAngle,
	planExactWallLength,
	planInsertWallCurveAnchor,
	planMoveWallCurveAnchor,
	planRigidWallMove,
	planWallFirstRoomMove,
	planWallSplit,
	planWallSubdivision,
	validateWallFirstLayoutDocument,
	validateWallFirstOpeningSet,
	wallFirstWallSpan,
	type LayoutDocumentWallFirst,
	type LayoutWall,
	type LayoutWallOpening
} from '@portfolio/layout-core';
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

/** The bow used throughout: a 6 m chord with its arc peaking at z = 2. */
const BOW = bezier([3, 2]);

const nodingAllocator = {
	nextWallId(base: LayoutDocumentWallFirst, seed: string) {
		return allocate(new Set(base.walls.map((wall) => wall.id)), seed);
	},
	nextJunctionId(base: LayoutDocumentWallFirst, seed: string) {
		return allocate(new Set(base.junctions.map((junction) => junction.id)), seed);
	}
};

function allocate(taken: ReadonlySet<string>, seed: string): string {
	if (!taken.has(seed)) return seed;
	let index = 2;
	while (taken.has(`${seed}.${index}`)) index += 1;
	return `${seed}.${index}`;
}

function documentOf(
	junctions: Record<string, LayoutVec2>,
	walls: ReadonlyArray<{
		id: string;
		start: string;
		end: string;
		centerline?: LayoutWall['centerline'];
		role?: LayoutWall['role'];
	}>,
	rooms: LayoutDocumentWallFirst['rooms'] = [],
	openings: LayoutWallOpening[] = []
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
		role: wall.role ?? 'boundary',
		thickness: 0.2,
		height: 3,
		centerline: wall.centerline ?? LINE
	}));
	document.rooms = rooms;
	document.openings = openings;
	return document;
}

/** 6 × 4 Room whose `wall-a` carries the given centerline. */
function roomDocument(
	bottomWall: LayoutWall['centerline'] = LINE,
	openings: LayoutWallOpening[] = []
): LayoutDocumentWallFirst {
	return documentOf(
		{ 'j-a': [0, 0], 'j-b': [6, 0], 'j-c': [6, 4], 'j-d': [0, 4] },
		[
			{ id: 'wall-a', start: 'j-a', end: 'j-b', centerline: bottomWall },
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
		],
		openings
	);
}

/** Roomless curved partition Wall, for operations that must not disturb a Room. */
function standaloneCurvedWall(): LayoutDocumentWallFirst {
	return documentOf(
		{ 'j-p1': [0, 0], 'j-p2': [6, 0] },
		[{ id: 'wall-p', start: 'j-p1', end: 'j-p2', centerline: BOW, role: 'partition' }]
	);
}

function windowOpening(offset: number, width = 1): LayoutWallOpening {
	return {
		id: 'opening-a',
		wallId: 'wall-a',
		kind: 'window',
		offset,
		width,
		height: 1.2,
		sillHeight: 0.9,
		profile: 'rectangular'
	};
}

function wallOf(document: LayoutDocumentWallFirst, wallId: string): LayoutWall {
	return document.walls.find((wall) => wall.id === wallId)!;
}

function anchorsOf(document: LayoutDocumentWallFirst, wallId: string) {
	const centerline = wallOf(document, wallId).centerline;
	expect(centerline.kind).toBe('auto-bezier');
	return centerline.kind === 'auto-bezier' ? centerline.interiorAnchors : [];
}

describe('P23.11 slice 4 — convert straight Wall ↔ curved Wall', () => {
	it('adds one midpoint control and leaves the Wall visually straight', () => {
		const baseline = roomDocument(LINE);
		const plan = planConvertWallToCurve(baseline, 'wall-a');
		expect(plan.kind).toBe('success');
		if (plan.kind !== 'success') return;
		expect(anchorsOf(plan.document, 'wall-a')).toEqual([
			{ id: 'wall-a:anchor:1', point: [3, 0] }
		]);
		// A control planted on the exact midpoint makes the interpolating spline
		// degenerate-straight, so nothing moves and the Wall keeps its length.
		const span = wallFirstWallSpan(plan.document, wallOf(plan.document, 'wall-a'))!;
		expect(span.length).toBeCloseTo(6, 6);
		const { wall } = compiledWall(plan.document, 'wall-a');
		for (const sample of wall.samples) expect(Math.abs(sample.point[1])).toBeLessThan(1e-9);
	});

	it('preserves every authored Wall, Junction, Opening and Room identity', () => {
		const baseline = roomDocument(LINE, [windowOpening(1)]);
		const plan = planConvertWallToCurve(baseline, 'wall-a');
		expect(plan.kind).toBe('success');
		if (plan.kind !== 'success') return;
		expect(plan.document.junctions).toEqual(baseline.junctions);
		expect(plan.document.walls.map((wall) => wall.id)).toEqual(
			baseline.walls.map((wall) => wall.id)
		);
		expect(plan.document.rooms).toEqual(baseline.rooms);
		expect(plan.document.openings).toEqual(baseline.openings);
	});

	it('round-trips straight → curve → straight back to the baseline', () => {
		const baseline = roomDocument(LINE, [windowOpening(1)]);
		const curved = planConvertWallToCurve(baseline, 'wall-a');
		expect(curved.kind).toBe('success');
		if (curved.kind !== 'success') return;
		expect(validateWallFirstLayoutDocument(curved.document).success).toBe(true);
		const straight = planConvertWallToLine(curved.document, 'wall-a');
		expect(straight.kind).toBe('success');
		if (straight.kind !== 'success') return;
		expect(wallOf(straight.document, 'wall-a').centerline).toEqual({ kind: 'line' });
		// Restoring the converted centerline reproduces the curved document
		// exactly: nothing else was reallocated on the way back to straight.
		const curvedCenterline = wallOf(curved.document, 'wall-a').centerline;
		expect({
			...straight.document,
			walls: straight.document.walls.map((wall) =>
				wall.id === 'wall-a' ? { ...wall, centerline: curvedCenterline } : wall
			)
		}).toEqual(curved.document);
		expect(straight.document.junctions).toEqual(baseline.junctions);
		expect(straight.document.openings).toEqual(baseline.openings);
	});

	it('rejects converting a Wall that is already in the requested form', () => {
		const straight = planConvertWallToCurve(roomDocument(BOW), 'wall-a');
		expect(straight.kind === 'rejected' && straight.rejection.code).toBe('no_op');
		const curved = planConvertWallToLine(roomDocument(LINE), 'wall-a');
		expect(curved.kind === 'rejected' && curved.rejection.code).toBe('no_op');
	});
});

describe('P23.11 slice 4 — deterministic anchor insertion, move and deletion', () => {
	it('projects an inserted control onto the Wall and orders it by arc distance', () => {
		// The baseline control sits at the arc midpoint; the projected insert
		// lands in the first half, so it must come FIRST in persisted order.
		const baseline = roomDocument(BOW);
		const plan = planInsertWallCurveAnchor(baseline, 'wall-a', [1.2, 1]);
		expect(plan.kind).toBe('success');
		if (plan.kind !== 'success') return;
		const anchors = anchorsOf(plan.document, 'wall-a');
		expect(anchors).toHaveLength(2);
		expect(anchors.map((anchor) => anchor.id)).toEqual(['wall-a:anchor:2', 'anchor:1']);
		// The control landed ON the baseline curve, not at the raw pointer.
		expect(anchors[0]!.point[1]).toBeGreaterThan(0);
		expect(anchors[0]!.point[1]).toBeLessThan(2);
	});

	it('allocates deterministic IDs and repeats identically from one baseline', () => {
		const baseline = roomDocument(BOW);
		const once = planInsertWallCurveAnchor(baseline, 'wall-a', [1.2, 1]);
		const twice = planInsertWallCurveAnchor(baseline, 'wall-a', [1.2, 1]);
		expect(once.kind).toBe('success');
		expect(twice.kind).toBe('success');
		if (once.kind !== 'success' || twice.kind !== 'success') return;
		expect(once.document).toEqual(twice.document);
		const second = planInsertWallCurveAnchor(once.document, 'wall-a', [4.8, 1]);
		expect(second.kind).toBe('success');
		if (second.kind !== 'success') return;
		expect(anchorsOf(second.document, 'wall-a').map((anchor) => anchor.id)).toEqual([
			'wall-a:anchor:2',
			'anchor:1',
			'wall-a:anchor:3'
		]);
	});

	it('rejects an insertion that would land on an endpoint', () => {
		const plan = planInsertWallCurveAnchor(roomDocument(BOW), 'wall-a', [-4, 0]);
		expect(plan.kind === 'rejected' && plan.rejection.code).toBe('invalid_value');
	});

	it('moves exactly one control and leaves the others alone', () => {
		const baseline = roomDocument(bezier([1, 1], [5, 1]));
		const plan = planMoveWallCurveAnchor(baseline, 'wall-a', 'anchor:2', [5, 3]);
		expect(plan.kind).toBe('success');
		if (plan.kind !== 'success') return;
		expect(anchorsOf(plan.document, 'wall-a')).toEqual([
			{ id: 'anchor:1', point: [1, 1] },
			{ id: 'anchor:2', point: [5, 3] }
		]);
		// Baseline isolation: the source document still owns the original point.
		expect(anchorsOf(baseline, 'wall-a')[1]!.point).toEqual([5, 1]);
	});

	it('deletes controls, converting the Wall to a line on the last one', () => {
		const two = roomDocument(bezier([1, 1], [5, 1]));
		const first = planDeleteWallCurveAnchor(two, 'wall-a', 'anchor:1');
		expect(first.kind).toBe('success');
		if (first.kind !== 'success') return;
		expect(anchorsOf(first.document, 'wall-a')).toEqual([{ id: 'anchor:2', point: [5, 1] }]);
		const last = planDeleteWallCurveAnchor(first.document, 'wall-a', 'anchor:2');
		expect(last.kind).toBe('success');
		if (last.kind !== 'success') return;
		expect(wallOf(last.document, 'wall-a').centerline).toEqual({ kind: 'line' });
	});

	it('rejects an unknown or misnamed curve control', () => {
		const plan = planMoveWallCurveAnchor(roomDocument(BOW), 'wall-a', 'anchor:9', [1, 1]);
		expect(plan.kind === 'rejected' && plan.rejection.code).toBe('unknown_curve_anchor');
		const del = planDeleteWallCurveAnchor(roomDocument(BOW), 'wall-a', 'anchor:9');
		expect(del.kind === 'rejected' && del.rejection.code).toBe('unknown_curve_anchor');
	});

	it('refuses anchor edits on a straight Wall until it is converted', () => {
		const plan = planInsertWallCurveAnchor(roomDocument(LINE), 'wall-a', [3, 1]);
		expect(plan.kind === 'rejected' && plan.rejection.code).toBe('unsupported_geometry');
	});
});

describe('P23.11 slice 4 — rigid translation carries curved anchors', () => {
	it('translates a rigidly moved Wall’s endpoint Junctions and anchors together', () => {
		const baseline = standaloneCurvedWall();
		const plan = planRigidWallMove(baseline, 'wall-p', [10, 5]);
		expect(plan.kind).toBe('success');
		if (plan.kind !== 'success') return;
		const junctions = plan.document.junctions.map((junction) => junction.point);
		expect(junctions).toContainEqual([10, 5]);
		expect(junctions).toContainEqual([16, 5]);
		// The anchor receives the identical delta: the Wall keeps its SHAPE.
		expect(anchorsOf(plan.document, 'wall-p')).toEqual([
			{ id: 'anchor:1', point: [13, 7] }
		]);
		expect(anchorsOf(baseline, 'wall-p')).toEqual([{ id: 'anchor:1', point: [3, 2] }]);
		// Same curve, moved: arc length is a shape invariant.
		expect(arcLength(plan.document, 'wall-p')).toBeCloseTo(arcLength(baseline, 'wall-p'), 9);
	});

	it('does not leave a curved Room boundary’s anchors behind', () => {
		const baseline = roomDocument(BOW);
		const plan = planWallFirstRoomMove(baseline, 'room-a', [0, 10]);
		expect(plan.kind).toBe('success');
		if (plan.kind !== 'success') return;
		expect(anchorsOf(plan.document, 'wall-a')).toEqual([
			{ id: 'anchor:1', point: [3, 12] }
		]);
		expect(anchorsOf(baseline, 'wall-a')).toEqual([{ id: 'anchor:1', point: [3, 2] }]);
		// The moved Room keeps its exact curved boundary length.
		expect(arcLength(plan.document, 'wall-a')).toBeCloseTo(arcLength(baseline, 'wall-a'), 9);
	});

	it('reshapes the curve without moving its anchors when an endpoint Junction moves', () => {
		const baseline = roomDocument(BOW);
		const plan = planExactJunctionMove(baseline, 'j-b', [7, 0]);
		expect(plan.kind).toBe('success');
		if (plan.kind !== 'success') return;
		// Endpoint-owned connectivity moved; the control is untouched, so the
		// curve reshapes rather than translating.
		expect(anchorsOf(plan.document, 'wall-a')).toEqual([{ id: 'anchor:1', point: [3, 2] }]);
		expect(plan.document.junctions.find((j) => j.id === 'j-b')!.point).toEqual([7, 0]);
	});
});

describe('P23.11 slice 4 — Opening semantics under curve edits', () => {
	it('keeps the authored Opening offset through a valid reshape', () => {
		const baseline = roomDocument(BOW, [windowOpening(1)]);
		const plan = planMoveWallCurveAnchor(baseline, 'wall-a', 'anchor:1', [3, 1.5]);
		expect(plan.kind).toBe('success');
		if (plan.kind !== 'success') return;
		// A curve edit never rewrites an Opening merely to hold world position.
		expect(plan.document.openings[0]!.offset).toBe(1);
		expect(validateWallFirstOpeningSet(plan.document)).toEqual([]);
		// The arc shrank toward the chord, and the Opening still fits.
		const span = wallFirstWallSpan(plan.document, wallOf(plan.document, 'wall-a'))!;
		expect(span.length).toBeGreaterThan(2);
		expect(span.length).toBeLessThan(7);
	});

	it('rejects the whole edit when the reshaped Wall can no longer host the Opening', () => {
		// The big outward bow gives ~9 m of arc, so an Opening spanning
		// [6.5, 7.5] fits; straightening the Wall leaves a 6 m chord and it
		// cannot. The edit must reject rather than clamp or move the Opening.
		const bowed = roomDocument(bezier([3, -4]), [windowOpening(6.5)]);
		expect(validateWallFirstOpeningSet(bowed)).toEqual([]);
		const span = wallFirstWallSpan(bowed, wallOf(bowed, 'wall-a'))!;
		expect(span.length).toBeGreaterThan(7.5);
		const snapshot = JSON.stringify(bowed);

		const plan = planConvertWallToLine(bowed, 'wall-a');
		expect(plan.kind).toBe('rejected');
		if (plan.kind !== 'rejected') return;
		expect(plan.rejection.code).toBe('opening_set_invalid');
		// The rejection names the Opening and its host, rather than reporting a
		// generic geometry failure the editor could not act on.
		expect(plan.rejection.targetIds).toContain('opening-a');
		expect(plan.rejection.message).toContain('opening-a');
		expect(JSON.stringify(bowed)).toBe(snapshot);
	});
});

describe('P23.11 slice 4 — the straight-only boundary stays explicit', () => {
	it('rejects exact length, exact angle and subdivision on a curved Wall', () => {
		const baseline = roomDocument(BOW);
		const length = planExactWallLength(baseline, 'wall-a', 8);
		expect(length.kind === 'rejected' && length.rejection.code).toBe('curved_wall_unsupported');
		const angle = planExactWallAngle(baseline, 'wall-a', 0.5);
		expect(angle.kind === 'rejected' && angle.rejection.code).toBe('curved_wall_unsupported');
		const subdivision = planWallSubdivision(baseline, 'wall-a', 3, nodingAllocator);
		expect(subdivision.kind === 'rejected' && subdivision.rejection.code).toBe(
			'curved_wall_unsupported'
		);
	});

	it('rejects a curved target at planWallSplit itself, before any allocation', () => {
		const baseline = standaloneCurvedWall();
		const plan = planWallSplit(baseline, 'wall-p', 3, nodingAllocator);
		expect(plan.kind).toBe('rejected');
		if (plan.kind !== 'rejected') return;
		expect(plan.rejection.code).toBe('curved_wall_unsupported');
	});

	it('still splits a straight Wall into straight fragments', () => {
		const baseline = roomDocument(LINE);
		const plan = planWallSplit(baseline, 'wall-a', 3, nodingAllocator);
		expect(plan.kind).toBe('success');
		if (plan.kind !== 'success') return;
		const fragments = plan.document.walls.filter((wall) =>
			['wall-a', ...plan.createdWallIds].includes(wall.id)
		);
		expect(fragments).toHaveLength(2);
		for (const fragment of fragments) expect(fragment.centerline).toEqual({ kind: 'line' });
	});

	it('leaves the baseline untouched on every rejection', () => {
		const baseline = roomDocument(BOW, [windowOpening(1)]);
		const snapshot = JSON.stringify(baseline);
		planExactWallLength(baseline, 'wall-a', 8);
		planExactWallAngle(baseline, 'wall-a', 0.5);
		planWallSubdivision(baseline, 'wall-a', 3, nodingAllocator);
		planMoveWallCurveAnchor(baseline, 'wall-a', 'anchor:9', [1, 1]);
		planConvertWallToLine(baseline, 'wall-a');
		expect(JSON.stringify(baseline)).toBe(snapshot);
	});
});

/** Arc length of one Wall straight from the canonical span helper. */
function arcLength(document: LayoutDocumentWallFirst, wallId: string): number {
	return wallFirstWallSpan(document, wallOf(document, wallId))!.length;
}

function compiledWall(document: LayoutDocumentWallFirst, wallId: string) {
	const { geometry } = compileWallFirstLayoutGeometry(document);
	return { wall: geometry.walls.find((candidate) => candidate.wallId === wallId)! };
}
