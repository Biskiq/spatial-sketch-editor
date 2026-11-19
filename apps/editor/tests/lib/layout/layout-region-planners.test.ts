/**
 * T1 V1b — §5.3 region planners, §5.4 relations and §5.5 one-shot fits.
 *
 * T-V4, T-V5 and T-V6 live here: every row of the relation table, the
 * independence of the two fit subjects, and G5 across every planner that can
 * move a region. The queries and the open-to-sky/overhead association cases live
 * beside their owning contracts in `layout-region-queries.test.ts`.
 */
import { describe, expect, it } from 'vitest';
import {
	compileWallFirstLayoutGeometryFresh,
	createEmptyWallFirstLayoutDocument,
	planCreateCircularRoom,
	planCreateRegion,
	planCreateWallFirstOpening,
	planDuplicateRegion,
	planExactWallHeight,
	planFitRegionEdgeToWall,
	planFitRegionToSpace,
	planFitRegionToWalls,
	planFitWallsToRegion,
	planMoveRegion,
	planRemoveRegion,
	planRenameRegion,
	planRotateRegion,
	planSetRegionElevation,
	planSetRegionFootprint,
	planSetRegionIntendedGap,
	planSetRegionThickness,
	planWallChain,
	regionWallPlanClass,
	regionWallRelations,
	validateWallFirstLayoutDocument,
	type LayoutDocumentWallFirst,
	type LayoutVec2,
	type LayoutWall,
	type RegionPlan
} from '@portfolio/layout-core';
import { captureFor, freshCapture } from './__fixtures__/layout-id-capture';

const RECT: LayoutVec2[] = [[0, 0], [8, 0], [8, 6], [0, 6]];

function enclosure(height = 3): LayoutDocumentWallFirst {
	const baseline = createEmptyWallFirstLayoutDocument();
	const plan = planWallChain({
		baseline,
		points: RECT,
		close: true,
		capture: freshCapture(),
		levelId: baseline.floor.id,
		height
	});
	if (plan.kind !== 'success') throw new Error(`enclosure failed: ${plan.rejection.message}`);
	return plan.document;
}

function compile(document: LayoutDocumentWallFirst) {
	const result = compileWallFirstLayoutGeometryFresh(document);
	expect(result.issues.filter((issue) => issue.severity !== 'warning')).toEqual([]);
	return result.geometry;
}

function junctionPoint(document: LayoutDocumentWallFirst, id: string): LayoutVec2 {
	const junction = document.junctions.find((candidate) => candidate.id === id);
	if (junction === undefined) throw new Error(`unknown junction ${id}`);
	return junction.point;
}

function closeTo(left: LayoutVec2, right: LayoutVec2): boolean {
	return Math.hypot(left[0] - right[0], left[1] - right[1]) <= 1e-9;
}

function wallBetween(document: LayoutDocumentWallFirst, a: LayoutVec2, b: LayoutVec2): LayoutWall {
	const wall = document.walls.find((candidate) => {
		const start = junctionPoint(document, candidate.startJunctionId);
		const end = junctionPoint(document, candidate.endJunctionId);
		return (closeTo(start, a) && closeTo(end, b)) || (closeTo(start, b) && closeTo(end, a));
	});
	if (wall === undefined) throw new Error(`no wall between ${String(a)} and ${String(b)}`);
	return wall;
}

function added(
	document: LayoutDocumentWallFirst,
	intent: {
		role: 'floor' | 'overhead';
		footprint: readonly LayoutVec2[];
		elevation: number;
		thickness?: number;
		name?: string;
	},
	nonce = 'region-a'
): { document: LayoutDocumentWallFirst; regionId: string; region: ReturnType<typeof regionOf> } {
	const plan = planCreateRegion({
		baseline: document,
		capture: captureFor(nonce),
		intent: { thickness: 0.2, ...intent }
	});
	if (plan.kind !== 'success') throw new Error(`region create failed: ${plan.rejection.message}`);
	return {
		document: plan.document,
		regionId: plan.regionId,
		region: regionOf(plan.document, plan.regionId)
	};
}

function regionOf(document: LayoutDocumentWallFirst, regionId: string) {
	const region = document.regions.find((candidate) => candidate.id === regionId);
	if (region === undefined) throw new Error(`unknown region ${regionId}`);
	return region;
}

function expectRejected(plan: RegionPlan, code: string): void {
	expect(plan.kind).toBe('rejected');
	if (plan.kind !== 'rejected') return;
	expect(plan.rejection.code).toBe(code);
}

function relationFor(
	geometry: ReturnType<typeof compile>,
	document: LayoutDocumentWallFirst,
	regionId: string,
	wallId: string
) {
	const result = regionWallRelations(geometry, regionOf(document, regionId));
	expect(result.kind).toBe('relations');
	if (result.kind !== 'relations') throw new Error(result.message);
	const relation = result.relations.find((entry) => entry.wallId === wallId);
	if (relation === undefined) throw new Error(`no relation for ${wallId}`);
	return relation;
}

describe('T-V4 — region Wall relations', () => {
	it('reads a footprint drawn to the Wall centerline as meets, not a crossing', () => {
		const base = enclosure();
		const wall = wallBetween(base, [0, 0], [8, 0]);
		const { document, regionId } = added(base, {
			role: 'floor',
			footprint: [[2, 0], [6, 0], [6, 1], [2, 1]],
			elevation: 0.2
		});
		const relation = relationFor(compile(document), document, regionId, wall.id);
		expect(relation).toMatchObject({ planClass: 'edge', reading: 'meets', measureMeters: null });
	});

	it('reads a Wall rising through a canopy as crosses', () => {
		const base = enclosure();
		const wall = wallBetween(base, [0, 0], [8, 0]);
		const { document, regionId } = added(base, {
			role: 'overhead',
			footprint: [[2, -1], [6, -1], [6, 1], [2, 1]],
			elevation: 2.5
		});
		expect(relationFor(compile(document), document, regionId, wall.id)).toMatchObject({
			planClass: 'through',
			reading: 'crosses',
			measureMeters: null
		});
	});

	it('reads a vertical gap with its measured height and the roof fit', () => {
		const base = enclosure();
		const wall = wallBetween(base, [0, 0], [8, 0]);
		const { document, regionId } = added(base, {
			role: 'overhead',
			footprint: [[2, -1], [6, -1], [6, 1], [2, 1]],
			elevation: 3.2
		});
		const relation = relationFor(compile(document), document, regionId, wall.id);
		expect(relation).toMatchObject({
			planClass: 'through',
			reading: 'gap',
			measureAxis: 'vertical',
			intended: false,
			fit: 'fit-roof-to-walls'
		});
		expect(relation.measureMeters).toBeCloseTo(0.2, 9);
	});

	it('reads an edge touching a slab below its top as meets, never crosses', () => {
		const base = enclosure();
		const wall = wallBetween(base, [0, 0], [8, 0]);
		const { document, regionId } = added(base, {
			role: 'overhead',
			footprint: [[2, 0.1], [6, 0.1], [6, 1], [2, 1]],
			elevation: 2.5
		});
		expect(relationFor(compile(document), document, regionId, wall.id)).toMatchObject({
			planClass: 'edge',
			reading: 'meets'
		});
	});

	it('reads a horizontal gap with its plan reach and the meet-wall fit', () => {
		const base = enclosure();
		const wall = wallBetween(base, [0, 0], [8, 0]);
		const { document, regionId } = added(base, {
			role: 'floor',
			footprint: [[2, 0.3], [6, 0.3], [6, 1], [2, 1]],
			elevation: 0.2
		});
		const relation = relationFor(compile(document), document, regionId, wall.id);
		expect(relation).toMatchObject({
			planClass: 'near',
			reading: 'gap',
			measureAxis: 'horizontal',
			fit: 'meet-wall'
		});
		expect(relation.measureMeters).toBeCloseTo(0.2, 9);
	});

	it('reports no relation when a near Wall top sits wholly below the slab', () => {
		const base = enclosure();
		const { document, regionId } = added(base, {
			role: 'floor',
			footprint: [[2, 0.3], [6, 0.3], [6, 1], [2, 1]],
			elevation: 4
		});
		const geometry = compile(document);
		const result = regionWallRelations(geometry, regionOf(document, regionId));
		expect(result.kind === 'relations' && result.relations).toEqual([]);
	});

	it('classifies plan classes independently of the vertical reading', () => {
		const base = enclosure();
		const wall = wallBetween(base, [0, 0], [8, 0]);
		const through = compile(
			added(base, {
				role: 'overhead',
				footprint: [[2, -1], [6, -1], [6, 1], [2, 1]],
				elevation: 3.2
			}).document
		);
		const throughWall = through.walls.find((candidate) => candidate.wallId === wall.id)!;
		expect(regionWallPlanClass([[2, -1], [6, -1], [6, 1], [2, 1]], throughWall).planClass).toBe('through');
	});

	it('marks and clears an intended gap, refuses a Wall with no gap, and sorts by Wall id', () => {
		const base = enclosure();
		const wall = wallBetween(base, [0, 0], [8, 0]);
		const other = wallBetween(base, [0, 6], [8, 6]);
		const { document, regionId } = added(base, {
			role: 'floor',
			footprint: [[2, 0.3], [6, 0.3], [6, 1], [2, 1]],
			elevation: 0.2
		});
		const geometry = compile(document);
		expectRejected(planSetRegionIntendedGap(document, geometry, regionId, other.id, true), 'no_gap_to_mark');
		const marked = planSetRegionIntendedGap(document, geometry, regionId, wall.id, true);
		expect(marked.kind).toBe('success');
		if (marked.kind !== 'success') return;
		expect(regionOf(marked.document, regionId).intendedGaps).toEqual([wall.id]);
		const relation = relationFor(compile(marked.document), marked.document, regionId, wall.id);
		expect(relation).toMatchObject({ intended: true, fit: null, reading: 'gap' });

		const cleared = planSetRegionIntendedGap(marked.document, compile(marked.document), regionId, wall.id, false);
		expect(cleared.kind).toBe('success');
		if (cleared.kind !== 'success') return;
		expect(regionOf(cleared.document, regionId).intendedGaps).toEqual([]);

		// A region within reach of two Walls reports both, ordered by Wall id.
		const corner = added(base, {
			role: 'floor',
			footprint: [[0.2, 0.2], [0.6, 0.2], [0.6, 0.6], [0.2, 0.6]],
			elevation: 0.2
		});
		const cornerRelations = regionWallRelations(compile(corner.document), corner.region);
		expect(cornerRelations.kind).toBe('relations');
		if (cornerRelations.kind !== 'relations') return;
		const ids = cornerRelations.relations.map((entry) => entry.wallId);
		expect(ids).toEqual([...ids].sort());
		expect(ids.length).toBeGreaterThanOrEqual(2);
	});
});

describe('T-V5 — fits are one-shot and store no link', () => {
	it('Meet wall changes the region only, and moving either subject reads a gap again', () => {
		const base = enclosure();
		const wall = wallBetween(base, [0, 0], [8, 0]);
		const { document, regionId } = added(base, {
			role: 'floor',
			footprint: [[2, 0.3], [6, 0.3], [6, 1], [2, 1]],
			elevation: 0.2
		});
		const wallsBefore = JSON.stringify(document.walls);
		const fitted = planFitRegionEdgeToWall(document, compile(document), regionId, wall.id);
		expect(fitted.kind).toBe('success');
		if (fitted.kind !== 'success') return;
		expect(JSON.stringify(fitted.document.walls)).toBe(wallsBefore);
		expect(relationFor(compile(fitted.document), fitted.document, regionId, wall.id)).toMatchObject({
			reading: 'meets'
		});

		const regionBefore = JSON.stringify(regionOf(fitted.document, regionId));
		const moved = planMoveRegion(fitted.document, regionId, [0, 0.5]);
		expect(moved.kind).toBe('success');
		if (moved.kind !== 'success') return;
		expect(JSON.stringify(regionOf(fitted.document, regionId))).toBe(regionBefore);
		expect(relationFor(compile(moved.document), moved.document, regionId, wall.id)).toMatchObject({
			reading: 'gap',
			measureAxis: 'horizontal'
		});
	});

	it('Fit roof reaches first contact, and a Wall height edit leaves the region byte-identical', () => {
		const base = enclosure();
		const wall = wallBetween(base, [0, 0], [8, 0]);
		const { document, regionId } = added(base, {
			role: 'overhead',
			footprint: [[2, -1], [6, -1], [6, 1], [2, 1]],
			elevation: 3.4
		});
		const fitted = planFitRegionToWalls(document, compile(document), regionId, [wall.id]);
		expect(fitted.kind).toBe('success');
		if (fitted.kind !== 'success') return;
		expect(regionOf(fitted.document, regionId).elevation).toBeCloseTo(3, 9);
		expect(relationFor(compile(fitted.document), fitted.document, regionId, wall.id)).toMatchObject({
			reading: 'meets'
		});

		const regionBefore = JSON.stringify(regionOf(fitted.document, regionId));
		const lowered = planExactWallHeight(fitted.document, wall.id, 2.8);
		expect(lowered.kind).toBe('success');
		if (lowered.kind !== 'success') return;
		expect(JSON.stringify(regionOf(lowered.document, regionId))).toBe(regionBefore);
		const relation = relationFor(compile(lowered.document), lowered.document, regionId, wall.id);
		expect(relation.reading).toBe('gap');
		expect(relation.measureMeters).toBeCloseTo(0.2, 9);
	});

	it('Fit walls to roof writes one height per eligible Wall and skips a partly covered Wall', () => {
		const base = enclosure();
		const nearWall = wallBetween(base, [0, 0], [8, 0]);
		const farWall = wallBetween(base, [0, 6], [8, 6]);
		const { document, regionId } = added(base, {
			role: 'overhead',
			footprint: [[-1, -1], [9, -1], [9, 1], [-1, 1]],
			elevation: 3.5
		});
		const fitted = planFitWallsToRegion(document, compile(document), regionId, [nearWall.id, farWall.id]);
		expect(fitted.kind).toBe('success');
		if (fitted.kind !== 'success') return;
		expect(fitted.changedWallIds).toEqual([nearWall.id]);
		expect(fitted.skippedWallIds).toEqual([farWall.id]);
		expect(fitted.document.walls.find((wall) => wall.id === nearWall.id)!.height).toBeCloseTo(3.5, 9);
		expect(fitted.document.walls.find((wall) => wall.id === farWall.id)!.height).toBeCloseTo(3, 9);
		expect(relationFor(compile(fitted.document), fitted.document, regionId, nearWall.id)).toMatchObject({
			reading: 'meets'
		});
	});

	it('Fit walls refuses atomically when a new top would cut a hosted Opening', () => {
		const base = enclosure();
		const wall = wallBetween(base, [0, 0], [8, 0]);
		const opening = planCreateWallFirstOpening(
			base,
			{ wallId: wall.id, kind: 'window', offset: 2, width: 1, height: 2.5, sillHeight: 0 },
			freshCapture(),
			base.floor.id
		);
		expect(opening.kind).toBe('success');
		if (opening.kind !== 'success') return;
		const { document, regionId } = added(opening.document, {
			role: 'overhead',
			footprint: [[-1, -1], [9, -1], [9, 1], [-1, 1]],
			elevation: 2
		});
		const before = JSON.stringify(document);
		const plan = planFitWallsToRegion(document, compile(document), regionId, [wall.id]);
		expectRejected(plan, 'opening_set_invalid');
		expect(JSON.stringify(document)).toBe(before);
	});

	it('Fit walls refuses when no chosen Wall is wholly under the roof', () => {
		const base = enclosure();
		const farWall = wallBetween(base, [0, 6], [8, 6]);
		const { document, regionId } = added(base, {
			role: 'overhead',
			footprint: [[-1, -1], [9, -1], [9, 1], [-1, 1]],
			elevation: 3.5
		});
		expectRejected(planFitWallsToRegion(document, compile(document), regionId, [farWall.id]), 'no_eligible_walls');
	});

	it('Fit roof refuses when no chosen Wall touches the footprint', () => {
		const base = enclosure();
		const farWall = wallBetween(base, [0, 6], [8, 6]);
		const { document, regionId } = added(base, {
			role: 'overhead',
			footprint: [[-1, -1], [9, -1], [9, 1], [-1, 1]],
			elevation: 3.5
		});
		expectRejected(planFitRegionToWalls(document, compile(document), regionId, [farWall.id]), 'no_covered_walls');
	});
});

describe('T-V5 / §5.3 — Fit to space', () => {
	it('uses the compiled Space outline, including a curved Space', () => {
		const baseline = createEmptyWallFirstLayoutDocument();
		const circular = planCreateCircularRoom({
			baseline,
			center: [0, 0],
			rim: [4, 0],
			capture: freshCapture(),
			levelId: baseline.floor.id
		});
		expect(circular.kind).toBe('success');
		if (circular.kind !== 'success') return;
		const roomId = circular.createdRoomIds[0]!;
		const { document, regionId } = added(circular.document, {
			role: 'floor',
			footprint: [[-1, -1], [1, -1], [1, 1], [-1, 1]],
			elevation: 0.4
		});
		const compiled = compile(document);
		const outline = compiled.rooms.find((room) => room.roomId === roomId)!.floorPolygon;
		expect(outline.length).toBeGreaterThan(4);
		const fitted = planFitRegionToSpace(document, compiled, regionId, roomId);
		expect(fitted.kind).toBe('success');
		if (fitted.kind !== 'success') return;
		expect(regionOf(fitted.document, regionId).footprint.points).toEqual(outline);
		expect(validateWallFirstLayoutDocument(fitted.document).success).toBe(true);
	});

	it('refuses an unknown Space and an outline it cannot store', () => {
		const base = enclosure();
		const { document, regionId } = added(base, {
			role: 'floor',
			footprint: [[1, 1], [2, 1], [2, 2], [1, 2]],
			elevation: 0
		});
		const compiled = compile(document);
		expectRejected(planFitRegionToSpace(document, compiled, regionId, 'no-such-room'), 'unknown_room');
		const oversized = {
			...compiled,
			rooms: compiled.rooms.map((room) => ({
				...room,
				floorPolygon: Array.from({ length: 1025 }, (_, index): [number, number] => [index, 0])
			}))
		};
		expectRejected(planFitRegionToSpace(document, oversized, regionId, compiled.rooms[0]!.roomId), 'region_point_count');
	});
});

describe('T-V6 — G5 is checked by every planner that edits a region', () => {
	function twoSlabs() {
		const base = enclosure();
		const lower = added(base, { role: 'floor', footprint: [[1, 1], [4, 1], [4, 4], [1, 4]], elevation: 0.2 });
		const upper = added(
			lower.document,
			{ role: 'overhead', footprint: [[1, 1], [4, 1], [4, 4], [1, 4]], elevation: 0.4 },
			'region-b'
		);
		const side = added(
			upper.document,
			{ role: 'floor', footprint: [[4, 1], [7, 1], [7, 4], [4, 4]], elevation: 0.2 },
			'region-c'
		);
		const top = added(
			side.document,
			{ role: 'overhead', footprint: [[1, 1], [4, 1], [4, 4], [1, 4]], elevation: 0.8 },
			'region-d'
		);
		return {
			base,
			lower,
			upper: { ...upper, document: top.document },
			ids: { lower: lower.regionId, upper: upper.regionId, side: side.regionId }
		};
	}

	it('accepts exact stacking and edge contact', () => {
		const { upper } = twoSlabs();
		expect(validateWallFirstLayoutDocument(upper.document).success).toBe(true);
	});

	it.each([
		['create', (document: LayoutDocumentWallFirst) => planCreateRegion({
			baseline: document,
			capture: captureFor('region-overlap'),
			intent: {
				role: 'floor',
				footprint: [[1, 1], [4, 1], [4, 4], [1, 4]],
				elevation: 0.3,
				thickness: 0.2
			}
		})],
		['move', (document: LayoutDocumentWallFirst, ids: { side: string }) => planMoveRegion(document, ids.side, [-3, 0])],
		['rotate', (document: LayoutDocumentWallFirst, ids: { side: string }) => planRotateRegion(document, ids.side, Math.PI / 4)],
		['footprint', (document: LayoutDocumentWallFirst, ids: { side: string }) => planSetRegionFootprint(document, ids.side, [[1, 1], [4, 1], [4, 4], [1, 4]])],
		['elevation', (document: LayoutDocumentWallFirst, ids: { upper: string }) => planSetRegionElevation(document, ids.upper, 0.1)],
		['thickness', (document: LayoutDocumentWallFirst, ids: { upper: string }) => planSetRegionThickness(document, ids.upper, 0.5)]
	] as const)('refuses %s into interior volume and writes nothing', (_name, run) => {
		const { upper, ids } = twoSlabs();
		const before = JSON.stringify(upper.document);
		expectRejected(run(upper.document, ids), 'region_overlap');
		expect(JSON.stringify(upper.document)).toBe(before);
	});

	it('refuses a duplicate on top of its source', () => {
		const { lower } = twoSlabs();
		expectRejected(
			planDuplicateRegion(lower.document, { regionId: lower.regionId, delta: [0, 0] }, captureFor('region-copy')),
			'region_overlap'
		);
	});

	it('refuses Fit roof when first contact would enter another region', () => {
		const base = enclosure(1.2);
		const lower = added(base, { role: 'overhead', footprint: [[1, 0], [4, 0], [4, 4], [1, 4]], elevation: 0.4 });
		const upper = added(lower.document, {
			role: 'overhead',
			footprint: [[1, 0], [4, 0], [4, 4], [1, 4]],
			elevation: 1.1
		}, 'region-b');
		const wall = wallBetween(base, [0, 0], [8, 0]);
		expectRejected(
			planFitRegionToWalls(upper.document, compile(upper.document), lower.regionId, [wall.id]),
			'region_overlap'
		);
	});

	it('refuses Fit to space when the compiled outline crosses a settled region', () => {
		const base = enclosure();
		const settled = added(base, { role: 'floor', footprint: [[1, 1], [6, 1], [6, 5], [1, 5]], elevation: 0.4 });
		const small = added(settled.document, {
			role: 'floor',
			footprint: [[6.2, 0.2], [6.6, 0.2], [6.6, 0.8], [6.2, 0.8]],
			elevation: 0.4
		}, 'region-b');
		const roomId = compile(small.document).rooms[0]!.roomId;
		expectRejected(
			planFitRegionToSpace(small.document, compile(small.document), small.regionId, roomId),
			'region_overlap'
		);
	});
});

describe('§5.3 — identity, order and metadata', () => {
	it('keeps ids, source order and flags across geometry-neutral edits', () => {
		const base = enclosure();
		const first = added(base, { role: 'floor', footprint: [[1, 1], [2, 1], [2, 2], [1, 2]], elevation: 0.2 });
		const second = added(first.document, {
			role: 'overhead',
			footprint: [[4, 1], [5, 1], [5, 2], [4, 2]],
			elevation: 2.5,
			name: 'Canopy'
		}, 'region-b');
		const renamed = planRenameRegion(second.document, second.regionId, { name: '  Roof  ' });
		expect(renamed.kind).toBe('success');
		if (renamed.kind !== 'success') return;
		expect(renamed.document.regions.map((region) => region.id)).toEqual([
			first.regionId,
			second.regionId
		]);
		expect(regionOf(renamed.document, second.regionId).name).toBe('Roof');
		const cleared = planRenameRegion(renamed.document, second.regionId, { name: null });
		expect(cleared.kind).toBe('success');
		if (cleared.kind !== 'success') return;
		expect(regionOf(cleared.document, second.regionId).name).toBeUndefined();
	});

	it('duplicates with a captured id, translated points and no intended gaps', () => {
		const base = enclosure();
		const source = added(base, { role: 'floor', footprint: [[1, 1], [2, 1], [2, 2], [1, 2]], elevation: 0.2 });
		const withGap = planSetRegionIntendedGap(
			source.document,
			compile(source.document),
			source.regionId,
			wallBetween(base, [0, 0], [8, 0]).id,
			true
		);
		const document = withGap.kind === 'success' ? withGap.document : source.document;
		if (withGap.kind === 'success') {
			// The floor slab 0..0.2 is below the Wall top, which is a gap.
			expect(regionOf(document, source.regionId).intendedGaps).toHaveLength(1);
		}
		const duplicate = planDuplicateRegion(document, { regionId: source.regionId, delta: [3, 0] }, captureFor('region-copy'));
		expect(duplicate.kind).toBe('success');
		if (duplicate.kind !== 'success') return;
		const copy = regionOf(duplicate.document, duplicate.regionId);
		expect(copy.id).not.toBe(source.regionId);
		expect(copy.intendedGaps).toEqual([]);
		expect(copy.footprint.points).toEqual([[4, 1], [5, 1], [5, 2], [4, 2]]);
	});

	it('removes a region without touching Walls, Rooms or intent', () => {
		const base = enclosure();
		const placed = added(base, { role: 'floor', footprint: [[1, 1], [2, 1], [2, 2], [1, 2]], elevation: 0.2 });
		const removed = planRemoveRegion(placed.document, placed.regionId);
		expect(removed.kind).toBe('success');
		if (removed.kind !== 'success') return;
		expect(removed.document.regions).toEqual([]);
		expect(removed.document.walls).toEqual(placed.document.walls);
		expect(removed.document.rooms).toEqual(placed.document.rooms);
	});

	it('refuses a curved Wall for Meet wall and a non-parallel nearest edge', () => {
		const circularBase = createEmptyWallFirstLayoutDocument();
		const circular = planCreateCircularRoom({
			baseline: circularBase,
			center: [0, 0],
			rim: [4, 0],
			capture: freshCapture(),
			levelId: circularBase.floor.id
		});
		expect(circular.kind).toBe('success');
		if (circular.kind !== 'success') return;
		const curvedWall = circular.document.walls.find((wall) => wall.centerline.kind === 'cubic-chain');
		expect(curvedWall).toBeDefined();
		if (curvedWall !== undefined) {
			const { document, regionId } = added(circular.document, {
				role: 'floor',
				footprint: [[0, 0], [1, 0], [1, 1], [0, 1]],
				elevation: 0.2
			});
			expectRejected(
				planFitRegionEdgeToWall(document, compile(document), regionId, curvedWall.id),
				'curved_wall_unsupported'
			);
		}
		const base = enclosure();
		const wall = wallBetween(base, [0, 0], [8, 0]);
		const { document, regionId } = added(base, {
			role: 'floor',
			footprint: [[2, 0.3], [3, 1.3], [2, 2.3], [1, 1.3]],
			elevation: 0.2
		});
		expectRejected(planFitRegionEdgeToWall(document, compile(document), regionId, wall.id), 'edge_not_parallel');
	});
});
