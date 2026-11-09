/**
 * C2 product — Circle Walls from the creator's centre → rim gesture through
 * radius/diameter editing and periodic Openings.
 *
 * These are product-path tests: they call the same retained planners the
 * editor intents call, and they read the persisted document rather than a
 * parallel circle model.
 */
import { describe, expect, it } from 'vitest';

import {
	compileWallFirstLayoutGeometry,
	hasBlockingLayoutIssues,
	mintLayoutIdCapture,
	parseWallFirstLayoutDocumentJson,
	planBendWallCurveKnot,
	planCreateCircularRoom,
	planCreateWallFirstOpening,
	planResizeClosedWallRadius,
	planTranslateClosedWall,
	planUpdateWallFirstOpening,
	planWallChain,
	readClosedWallCircle,
	serializeWallFirstLayoutDocument,
	validateWallFirstLayoutDocument,
	validateWallFirstOpeningSet,
	wallFirstWallLength,
	type LayoutDocumentWallFirst
} from '@portfolio/layout-core';

const CENTER = [0, 0] as const;
const RIM = [5, 0] as const;

function circleDocument(): LayoutDocumentWallFirst {
	const plan = planCreateCircularRoom({
		baseline: {
			...(awaitEmptyDocument()),
			rooms: []
		},
		center: [CENTER[0], CENTER[1]],
		rim: [RIM[0], RIM[1]],
		capture: mintLayoutIdCapture(() => 'c2-product'),
		levelId: 'floor',
		roomNamePrefix: 'Room'
	});
	if (plan.kind !== 'success') throw new Error(JSON.stringify(plan.rejection));
	return plan.document;
}

function awaitEmptyDocument(): LayoutDocumentWallFirst {
	// A zero-Wall current-format document: the same shape the editor boots.
	return {
		units: 'meters',
		formatVersion: 7,
		floor: { id: 'floor', name: 'Floor', elevation: 0 },
		junctions: [],
		walls: [],
		rooms: [],
		openings: [],
		objects: [],
		identity: { cursor: 0, rooms: {}, junctions: {}, walls: {}, openings: {} }
	};
}

function withOpening(document: LayoutDocumentWallFirst, offset: number, width = 1.2): LayoutDocumentWallFirst {
	const wallId = document.walls[0]!.id;
	const plan = planCreateWallFirstOpening(
		document,
		{ wallId, kind: 'window', offset, width, height: 1.2, sillHeight: 1 },
		mintLayoutIdCapture(() => 'c2-opening'),
		document.floor.id
	);
	if (plan.kind !== 'success') throw new Error(JSON.stringify(plan.rejection));
	return plan.document;
}

describe('C2 product — Circle creation and radius semantics', () => {
	it('creates exactly one closed Wall and one Room with the seam at the authored rim', () => {
		const document = circleDocument();
		expect(document.walls).toHaveLength(1);
		expect(document.rooms).toHaveLength(1);
		const wall = document.walls[0]!;
		expect(wall.startJunctionId).toBe(wall.endJunctionId);
		expect(document.junctions).toHaveLength(1);
		expect(document.junctions[0]!.point).toEqual([5, 0]);
		expect(document.rooms[0]!.boundary).toEqual([{ wallId: wall.id, direction: 'forward' }]);
		const facts = readClosedWallCircle(document, wall.id);
		expect(facts).not.toBeNull();
		expect(facts!.seam).toEqual([5, 0]);
		expect(facts!.radius).toBeCloseTo(5, 12);
	});

	it('preserves Opening angular stations and widths through a radius edit', () => {
		const base = circleDocument();
		const wallId = base.walls[0]!.id;
		const oldLength = wallFirstWallLength(base, wallId)!;
		const opening = withOpening(base, oldLength * 0.25).openings[0]!;
		const oldRatio = opening.offset / oldLength;
		const resized = planResizeClosedWallRadius({ document: withOpening(base, oldLength * 0.25), wallId, radius: 7.5 });
		expect(resized.kind).toBe('success');
		if (resized.kind !== 'success') return;
		const newLength = wallFirstWallLength(resized.document, wallId)!;
		const next = resized.document.openings[0]!;
		expect(next.width).toBe(opening.width);
		expect(next.offset / newLength).toBeCloseTo(oldRatio, 12);
		expect(resized.document.rooms).toHaveLength(1);
		expect(compileWallFirstLayoutGeometry(resized.document).issues.filter((issue) => issue.severity !== 'warning')).toEqual([]);
	});

	it('creates a second Room in a populated document without changing the first', () => {
		const rectangle = planWallChain({
			baseline: awaitEmptyDocument(),
			points: [
				[10, 0],
				[16, 0],
				[16, 4],
				[10, 4]
			],
			close: true,
			capture: mintLayoutIdCapture(() => 'c2-existing-room'),
			levelId: 'floor'
		});
		if (rectangle.kind !== 'success') throw new Error(JSON.stringify(rectangle.rejection));
		const beforeRoom = rectangle.document.rooms[0]!;
		const plan = planCreateCircularRoom({
			baseline: rectangle.document,
			center: [0, 0],
			rim: [3, 0],
			capture: mintLayoutIdCapture(() => 'c2-populated'),
			levelId: 'floor'
		});
		if (plan.kind !== 'success') throw new Error(JSON.stringify(plan.rejection));
		expect(plan.document.rooms).toHaveLength(2);
		expect(plan.document.rooms.find((room) => room.id === beforeRoom.id)).toEqual(beforeRoom);
		expect(plan.createdRoomIds).toHaveLength(1);
	});

	it('refuses a radius that is not physically valid', () => {
		const document = circleDocument();
		const wallId = document.walls[0]!.id;
		const tooSmall = planResizeClosedWallRadius({ document, wallId, radius: 0.05 });
		expect(tooSmall.kind).toBe('rejected');
		if (tooSmall.kind === 'rejected') expect(tooSmall.rejection.code).toBe('invalid_radius');
		const negative = planResizeClosedWallRadius({ document, wallId, radius: -2 });
		expect(negative.kind).toBe('rejected');
	});

	it('refuses a radius that leaves an Opening wider than the circumference', () => {
		const base = circleDocument();
		const wallId = base.walls[0]!.id;
		const withDoor = withOpening(base, 0, 5);
		const result = planResizeClosedWallRadius({ document: withDoor, wallId, radius: 0.5 });
		expect(result.kind).toBe('rejected');
		if (result.kind === 'rejected') expect(result.rejection.code).toBe('opening_does_not_fit');
	});

	it('refuses bending a circular Wall explicitly', () => {
		const document = circleDocument();
		const wallId = document.walls[0]!.id;
		const length = wallFirstWallLength(document, wallId)!;
		const bend = planBendWallCurveKnot(
			document,
			wallId,
			{ distance: length / 4, point: [0, 5] },
			{ knotId: 'captured-knot' }
		);
		expect(bend.kind).toBe('rejected');
		if (bend.kind === 'rejected') expect(bend.rejection.code).toBe('closed_wall_not_bendable');
	});

	it('supports periodic Openings that cross the canonical seam', () => {
		const base = circleDocument();
		const wallId = base.walls[0]!.id;
		const length = wallFirstWallLength(base, wallId)!;
		const document = withOpening(base, length - 0.2, 0.4);
		expect(validateWallFirstOpeningSet(document)).toEqual([]);
		const compiled = compileWallFirstLayoutGeometry(document);
		expect(hasBlockingLayoutIssues(compiled.issues)).toBe(false);
		const opening = compiled.geometry.walls[0]!.openings[0]!;
		// The wrapped centreline is the two physical arcs, not a chord across the
		// Room or a point clamped to the seam.
		expect(opening.centerPolyline.length).toBeGreaterThan(1);
		expect(opening.centerPolyline[0]![0]).toBeGreaterThan(4);
		expect(opening.centerPolyline[0]![1]).toBeLessThan(1);
	});

	it('translates a circular Wall rigidly without changing its shape or Openings', () => {
		const base = withOpening(circleDocument(), 3);
		const wallId = base.walls[0]!.id;
		const beforeLength = wallFirstWallLength(base, wallId)!;
		const before = readClosedWallCircle(base, wallId)!;
		const beforeOpening = base.openings[0]!;
		const beforeKnots =
			base.walls[0]!.centerline.kind === 'cubic-chain'
				? base.walls[0]!.centerline.knots.map((knot) => knot.id)
				: [];
		const moved = planTranslateClosedWall({ document: base, wallId, delta: [2, -3] });
		expect(moved.kind).toBe('success');
		if (moved.kind !== 'success') return;
		const after = readClosedWallCircle(moved.document, wallId)!;
		expect(after.center[0]).toBeCloseTo(before.center[0] + 2, 9);
		expect(after.center[1]).toBeCloseTo(before.center[1] - 3, 9);
		expect(after.seam[0]).toBeCloseTo(7, 9);
		expect(after.seam[1]).toBeCloseTo(-3, 9);
		expect(after.radius).toBeCloseTo(before.radius, 9);
		expect(wallFirstWallLength(moved.document, wallId)!).toBeCloseTo(beforeLength, 9);
		expect(moved.document.junctions[0]!.point).toEqual([7, -3]);
		expect(moved.document.walls[0]!.centerline.kind).toBe('cubic-chain');
		if (moved.document.walls[0]!.centerline.kind === 'cubic-chain') {
			expect(moved.document.walls[0]!.centerline.knots.map((knot) => knot.id)).toEqual(beforeKnots);
		}
		expect(moved.document.openings[0]!.offset).toBe(beforeOpening.offset);
		expect(moved.document.openings[0]!.width).toBe(beforeOpening.width);
		expect(moved.document.rooms).toHaveLength(1);
		expect(hasBlockingLayoutIssues(compileWallFirstLayoutGeometry(moved.document).issues)).toBe(false);
		// A zero drag is refused rather than installed as a no-op history entry.
		expect(planTranslateClosedWall({ document: base, wallId, delta: [0, 0] }).kind).toBe('rejected');
	});

	it('places and edits an Opening across the periodic seam, refusing an over-wide edit', () => {
		const base = circleDocument();
		const wallId = base.walls[0]!.id;
		const length = wallFirstWallLength(base, wallId)!;
		const placed = planCreateWallFirstOpening(
			base,
			{ wallId, kind: 'window', offset: length - 0.6, width: 0.8, height: 1.2, sillHeight: 1 },
			mintLayoutIdCapture(() => 'c2-seam-opening'),
			base.floor.id
		);
		if (placed.kind === 'rejected') throw new Error(JSON.stringify(placed.rejection));
		const openingId = placed.changedOpeningIds[0]!;
		const moved = planUpdateWallFirstOpening(placed.document, openingId, {
			offset: length - 0.3
		});
		expect(moved.kind).toBe('success');
		if (moved.kind !== 'success') return;
		expect(
			moved.document.openings.find((opening) => opening.id === openingId)!.offset
		).toBeCloseTo(length - 0.3, 12);
		const compiled = compileWallFirstLayoutGeometry(moved.document);
		expect(hasBlockingLayoutIssues(compiled.issues)).toBe(false);
		const compiledOpening = compiled.geometry.walls[0]!.openings[0]!;
		// The wrapped interval compiles as two physical arcs joined at the seam,
		// not a chord through the Room or a point clamped onto the seam.
		expect(compiledOpening.centerPolyline.length).toBeGreaterThan(1);
		expect(compiledOpening.centerPolyline[0]![0]).toBeGreaterThan(4);
		// An Opening wider than the circumference, and the seam aliased as the
		// circumference, both refuse instead of being clamped.
		const tooWide = planUpdateWallFirstOpening(moved.document, openingId, { width: length + 0.1 });
		expect(tooWide.kind).toBe('rejected');
		const seamAlias = planUpdateWallFirstOpening(moved.document, openingId, { offset: length });
		expect(seamAlias.kind).toBe('rejected');
	});

	it('keeps the seam and knot chain byte-stable through Save/Load after an edit', () => {
		const base = circleDocument();
		const wallId = base.walls[0]!.id;
		const length = wallFirstWallLength(base, wallId)!;
		const edited = withOpening(base, length * 0.4);
		const resized = planResizeClosedWallRadius({ document: edited, wallId, radius: 8 });
		if (resized.kind !== 'success') throw new Error(JSON.stringify(resized.rejection));
		const json = serializeWallFirstLayoutDocument(resized.document);
		const parsed = parseWallFirstLayoutDocumentJson(json);
		expect(parsed.success).toBe(true);
		if (!parsed.success) return;
		expect(JSON.stringify(parsed.document)).toBe(JSON.stringify(resized.document));
		expect(parsed.document.walls[0]!.centerline).toEqual(resized.document.walls[0]!.centerline);
		expect(parsed.document.junctions[0]!.point).toEqual(resized.document.junctions[0]!.point);
		expect(parsed.document.openings).toEqual(resized.document.openings);
	});

	it('keeps the created document canonically valid', () => {
		expect(validateWallFirstLayoutDocument(circleDocument()).success).toBe(true);
	});
});
