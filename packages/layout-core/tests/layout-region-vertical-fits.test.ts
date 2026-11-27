/**
 * T1 V3b — sloped Region vertical fits and form defaults (§7.2–7.3, T-R3 to T-R8).
 *
 * Expected heights and clearances come from closed-form roof geometry over the
 * fixtures' known Wall bodies, never from the planners' own evaluators. Every
 * refusal is checked for atomicity against the serialized bytes.
 */
import { describe, expect, it } from 'vitest';
import { compileWallFirstLayoutGeometryFresh, type LayoutVec2 } from '@portfolio/layout-core/geometry';
import {
	createClosedWallCircleDocument,
	createEmptyWallFirstLayoutDocument,
	planExactJunctionMove,
	planWallChain,
	serializeWallFirstLayoutDocument,
	type LayoutDocumentWallFirst,
	type LayoutRegionForm,
	type LayoutWall
} from '@portfolio/layout-core/wall';
import {
	planCreateRegion,
	planFitRegionToWalls,
	planFitWallsToRegion,
	planMoveRegion,
	planRotateRegion,
	planSetRegionForm,
	planSetRegionFootprint,
	REGION_FIT_CLOSED_WALL_CODE,
	REGION_FIT_CURVED_WALL_NOT_LEVEL_CODE,
	REGION_FIT_WALL_OVERRUN_CODE,
	regionFormProfile,
	regionUndersideAt,
	regionWallRelations,
	type RegionFormInput
} from '@portfolio/layout-core/room';
import { captureFor, freshCapture } from './__fixtures__/layout-id-capture';

const EPSILON = 1e-9;
const TAN30 = Math.tan(Math.PI / 6);
let nonce = 0;

function chain(baseline: LayoutDocumentWallFirst, points: LayoutVec2[], close: boolean, height: number) {
	const plan = planWallChain({ baseline, points, close, capture: freshCapture(), levelId: baseline.floor.id, height });
	if (plan.kind !== 'success') throw new Error(plan.rejection.message);
	return plan.document;
}

function roof(
	document: LayoutDocumentWallFirst,
	footprint: LayoutVec2[],
	elevation: number,
	thickness: number,
	form: RegionFormInput
) {
	const created = planCreateRegion({
		baseline: document,
		capture: captureFor(`v3b-fit-${nonce++}`),
		intent: { role: 'overhead', footprint, elevation, thickness }
	});
	if (created.kind !== 'success') throw new Error(created.rejection.message);
	const formed = planSetRegionForm(created.document, created.regionId, form);
	if (formed.kind !== 'success') throw new Error(formed.rejection.message);
	return { document: formed.document, regionId: created.regionId };
}

function compile(document: LayoutDocumentWallFirst) {
	const result = compileWallFirstLayoutGeometryFresh(document);
	expect(result.issues.filter((issue) => issue.severity !== 'warning')).toEqual([]);
	return result.geometry;
}

function relations(document: LayoutDocumentWallFirst, regionId: string) {
	const result = regionWallRelations(compile(document), document.regions.find((entry) => entry.id === regionId)!);
	if (result.kind !== 'relations') throw new Error(JSON.stringify(result));
	return new Map(result.relations.map((relation) => [relation.wallId, relation]));
}

function success<T extends { kind: string }>(plan: T): Extract<T, { kind: 'success' }> {
	if (plan.kind !== 'success') throw new Error(JSON.stringify(plan));
	return plan as Extract<T, { kind: 'success' }>;
}

function wallAt(document: LayoutDocumentWallFirst, a: LayoutVec2, b: LayoutVec2): LayoutWall {
	const point = (id: string) => document.junctions.find((junction) => junction.id === id)!.point;
	const same = (p: LayoutVec2, q: LayoutVec2) => Math.hypot(p[0] - q[0], p[1] - q[1]) < 1e-9;
	return document.walls.find(
		(wall) =>
			(same(point(wall.startJunctionId), a) && same(point(wall.endJunctionId), b)) ||
			(same(point(wall.startJunctionId), b) && same(point(wall.endJunctionId), a))
	)!;
}

/** Kind and keys exactly, values within floating tolerance. */
function expectForm(actual: LayoutRegionForm, expected: LayoutRegionForm) {
	expect(Object.keys(actual).sort()).toEqual(Object.keys(expected).sort());
	for (const [key, value] of Object.entries(expected)) {
		const got = (actual as Record<string, unknown>)[key];
		if (typeof value === 'number') expect(got as number).toBeCloseTo(value, 12);
		else expect(got).toBe(value);
	}
}

function expectRefusedAtomically(
	document: LayoutDocumentWallFirst,
	plan: { kind: string; rejection?: { code: string } },
	code: string
) {
	const before = serializeWallFirstLayoutDocument(document);
	expect(plan.kind).toBe('rejected');
	expect(plan.rejection?.code).toBe(code);
	expect(serializeWallFirstLayoutDocument(document)).toBe(before);
}

/**
 * J8 hall: a 12 x 6 enclosure of 0.2 m Walls under a gable whose ridge runs
 * along X at z = 3 (azimuth +Z), footprint 0.5 m proud of every centerline.
 * The underside rises with slope `s` from the eave at z = -0.5 to the ridge.
 */
describe('T-R3 — J8 long hall: fit roof, then fit walls, until every Wall meets', () => {
	const HALL: LayoutVec2[] = [[0, 0], [12, 0], [12, 6], [0, 6]];
	const FOOT: LayoutVec2[] = [[-0.5, -0.5], [12.5, -0.5], [12.5, 6.5], [-0.5, 6.5]];
	const rise = 2;
	const s = rise / 3.5;
	const height = 2.5;
	const roofThickness = 0.2;

	function hall() {
		return roof(chain(createEmptyWallFirstLayoutDocument(), HALL, true, height), FOOT, 3, roofThickness, {
			kind: 'gable',
			rise,
			azimuth: Math.PI / 2,
			ridgeOffset: 0
		});
	}

	it('fits the roof down to first contact across the covered Wall width', () => {
		const { document, regionId } = hall();
		const ids = document.walls.map((wall) => wall.id);
		const fitted = success(planFitRegionToWalls(document, compile(document), regionId, ids));
		// The lowest covered strip point is an eave Wall's outer face, z = -0.1.
		const expectedEave = height - 0.4 * s;
		expect(fitted.document.regions[0]!.elevation).toBeCloseTo(expectedEave, 9);
		const read = relations(fitted.document, regionId);
		const south = wallAt(fitted.document, [0, 0], [12, 0]).id;
		const west = wallAt(fitted.document, [0, 6], [0, 0]).id;
		// Across the 0.2 m width the eave underside spreads by 0.2 s; a
		// centerline-only reading would report half of it.
		expect(read.get(south)).toMatchObject({ reading: 'gap', measureAxis: 'vertical' });
		expect(read.get(south)!.measureMeters).toBeCloseTo(0.2 * s, 9);
		// A gable end reaches from its mitred eave corner (z = -0.1) to the ridge.
		expect(read.get(west)!.measureMeters).toBeCloseTo(3.5 * s - 0.4 * s, 9);
		for (const relation of read.values()) expect(relation.reading).not.toBe('crosses');
	});

	it('fits the walls to the roof: level eaves, gable ends with the apex under the ridge', () => {
		const { document, regionId } = hall();
		const ids = document.walls.map((wall) => wall.id);
		const fittedRoof = success(planFitRegionToWalls(document, compile(document), regionId, ids));
		const fitted = success(planFitWallsToRegion(fittedRoof.document, compile(fittedRoof.document), regionId, ids));
		expect([...fitted.fittedWallIds!].sort()).toEqual([...ids].sort());
		expect(fitted.skippedWallIds).toEqual([]);
		// Closed form: centerline underside, then the uniform sealing allowance
		// δ = 0.1 s to the inner face (eaves) or the inner mitre corner (ends).
		const eaveTop = height + 0.2 * s;
		for (const [a, b] of [[[0, 0], [12, 0]], [[12, 6], [0, 6]]] as [LayoutVec2, LayoutVec2][]) {
			const wall = wallAt(fitted.document, a, b);
			expect(wall.top).toEqual({ kind: 'level' });
			expect(wall.height).toBeCloseTo(eaveTop, 9);
		}
		for (const [a, b] of [[[12, 0], [12, 6]], [[0, 6], [0, 0]]] as [LayoutVec2, LayoutVec2][]) {
			const wall = wallAt(fitted.document, a, b);
			expect(wall.top.kind).toBe('gable');
			if (wall.top.kind !== 'gable') continue;
			expect(wall.top.apexOffset).toBeCloseTo(3, 9);
			expect(wall.height + wall.top.startRise).toBeCloseTo(eaveTop, 9);
			expect(wall.height + wall.top.endRise).toBeCloseTo(eaveTop, 9);
			expect(wall.height + wall.top.apexRise).toBeCloseTo(height + 3.2 * s, 9);
		}
		for (const relation of relations(fitted.document, regionId).values()) {
			expect(relation.reading).toBe('meets');
		}
		// The roof itself is untouched by the Wall fit.
		expect(fitted.document.regions).toEqual(fittedRoof.document.regions);
	});
});

describe('T-R4 — fit walls refuses whole, naming its subject', () => {
	const FOOT: LayoutVec2[] = [[-2, -2], [14, -2], [14, 10], [-2, 10]];

	it('refuses a curved Wall that a shed would slope', () => {
		const base = chain(createEmptyWallFirstLayoutDocument(), [[0, 0], [8, 0]], false, 2.5);
		const withStraight = chain(base, [[0, 4], [8, 4]], false, 2.5);
		const curvedId = wallAt(withStraight, [0, 0], [8, 0]).id;
		const curved = structuredClone(withStraight);
		curved.walls.find((wall) => wall.id === curvedId)!.centerline = {
			kind: 'cubic-chain',
			knots: [],
			spans: [{ handleOut: [2, 1.5], handleIn: [6, 1.5] }]
		};
		const { document, regionId } = roof(curved, FOOT, 3, 0.3, { kind: 'shed', rise: 2, azimuth: 0 });
		const plan = planFitWallsToRegion(document, compile(document), regionId, document.walls.map((wall) => wall.id));
		expectRefusedAtomically(document, plan, REGION_FIT_CURVED_WALL_NOT_LEVEL_CODE);
		if (plan.kind === 'rejected') expect(plan.rejection.targetIds).toContain(curvedId);
	});

	it('refuses a closed Wall under a gable', () => {
		const closed = createClosedWallCircleDocument({
			center: [6, 4],
			rim: [6, 6],
			junctionId: 'seam',
			wallId: 'circle',
			thickness: 0.2,
			height: 2.5
		});
		if (closed.kind !== 'success') throw new Error('closed Wall fixture');
		const { document, regionId } = roof(closed.document, FOOT, 3, 0.3, { kind: 'gable' });
		const plan = planFitWallsToRegion(document, compile(document), regionId, ['circle']);
		expectRefusedAtomically(document, plan, REGION_FIT_CLOSED_WALL_CODE);
		if (plan.kind === 'rejected') expect(plan.rejection.targetIds).toContain('circle');
	});

	it('refuses an Opening that would exceed the fitted top, even beside a Wall that fits', () => {
		const base = chain(createEmptyWallFirstLayoutDocument(), [[0, 0], [8, 0]], false, 2.8);
		const withOther = chain(base, [[0, 6], [8, 6]], false, 2.8);
		const low = wallAt(withOther, [0, 0], [8, 0]);
		withOther.openings.push({
			id: 'window',
			wallId: low.id,
			kind: 'window',
			offset: 3,
			width: 1,
			height: 1.2,
			sillHeight: 1.4,
			profile: 'rectangular'
		});
		// Azimuth +Z: the z = 0 Wall sits under the low eave at 2.0 m + 0.25 m.
		const { document, regionId } = roof(withOther, FOOT, 2, 0.3, { kind: 'shed', rise: 3, azimuth: Math.PI / 2 });
		const plan = planFitWallsToRegion(document, compile(document), regionId, document.walls.map((wall) => wall.id));
		expectRefusedAtomically(document, plan, 'opening_set_invalid');
		if (plan.kind === 'rejected') expect(plan.rejection.targetIds).toContain('window');
	});
});

describe('T-R5 — partial coverage and an oblique ridge crossing', () => {
	it('leaves a half-covered Wall unchanged and names it', () => {
		const base = chain(createEmptyWallFirstLayoutDocument(), [[0, 0], [6, 0]], false, 2.5);
		const half = chain(base, [[4, 3], [10, 3]], false, 2.5);
		const { document, regionId } = roof(half, [[-1, -1], [7, -1], [7, 5], [-1, 5]], 3, 0.3, {
			kind: 'gable',
			rise: 1,
			azimuth: 0
		});
		const covered = wallAt(document, [0, 0], [6, 0]).id;
		const partial = wallAt(document, [4, 3], [10, 3]).id;
		const fitted = success(planFitWallsToRegion(document, compile(document), regionId, [covered, partial]));
		expect(fitted.fittedWallIds).toEqual([covered]);
		expect(fitted.skippedWallIds).toEqual([partial]);
		expect(fitted.document.walls.find((wall) => wall.id === partial)).toEqual(
			document.walls.find((wall) => wall.id === partial)
		);
	});

	it('gives an oblique Wall one apex at its ridge crossing station', () => {
		const base = chain(createEmptyWallFirstLayoutDocument(), [[1, 1], [7, 5]], false, 2.5);
		const { document, regionId } = roof(base, [[-1, -1], [9, -1], [9, 7], [-1, 7]], 3, 0.6, {
			kind: 'gable',
			rise: 1.5,
			azimuth: Math.PI / 2,
			ridgeOffset: 0.5
		});
		const fitted = success(planFitWallsToRegion(document, compile(document), regionId, [document.walls[0]!.id]));
		const top = fitted.document.walls[0]!.top;
		expect(top.kind).toBe('gable');
		if (top.kind !== 'gable') return;
		// Ridge at z = mid(−1, 7) + 0.5 = 3.5; the Wall meets it at t = 2.5 / 4.
		expect(top.apexOffset).toBeCloseTo((2.5 / 4) * Math.hypot(6, 4), 9);
		expect(relations(fitted.document, regionId).get(document.walls[0]!.id)!.reading).toBe('meets');
	});
});

describe('T-R6 — fits store no constraint', () => {
	it('moves the roof, changes its rise or moves a Wall without touching the other subject', () => {
		const enclosure = chain(createEmptyWallFirstLayoutDocument(), [[0, 0], [8, 0], [8, 6], [0, 6]], true, 2.5);
		const { document, regionId } = roof(enclosure, [[-1, -1], [9, -1], [9, 7], [-1, 7]], 3, 0.3, {
			kind: 'shed',
			rise: 1,
			azimuth: 0
		});
		const ids = document.walls.map((wall) => wall.id);
		const roofFit = success(planFitRegionToWalls(document, compile(document), regionId, ids));
		const both = success(planFitWallsToRegion(roofFit.document, compile(roofFit.document), regionId, ids)).document;
		const wallsBytes = JSON.stringify(both.walls);
		const regionBytes = JSON.stringify(both.regions);

		const moved = success(planMoveRegion(both, regionId, [0.5, 0])).document;
		expect(JSON.stringify(moved.walls)).toBe(wallsBytes);
		const raised = success(planSetRegionForm(both, regionId, { kind: 'shed', rise: 1.4 })).document;
		expect(JSON.stringify(raised.walls)).toBe(wallsBytes);
		expect([...relations(raised, regionId).values()].some((relation) => relation.reading !== 'meets')).toBe(true);
		const junction = both.junctions[0]!;
		const shifted = success(
			planExactJunctionMove(both, junction.id, [junction.point[0] + 0.3, junction.point[1]])
		).document;
		expect(JSON.stringify(shifted.regions)).toBe(regionBytes);
	});
});

describe('T-R7 — deterministic form defaults', () => {
	const LONG: LayoutVec2[] = [[0, 0], [10, 0], [10, 4], [0, 4]];

	function formed(points: LayoutVec2[], input: RegionFormInput) {
		const { document, regionId } = roof(createEmptyWallFirstLayoutDocument(), points, 3, 0.2, input);
		return { document, regionId, region: document.regions.find((entry) => entry.id === regionId)! };
	}

	it('turns a long rectangle’s gable ridge along its long edge and raises a shed along it', () => {
		expectForm(formed(LONG, { kind: 'gable' }).region.form, { kind: 'gable', azimuth: Math.PI / 2, rise: 2 * TAN30, ridgeOffset: 0 });
		expectForm(formed(LONG, { kind: 'shed' }).region.form, { kind: 'shed', azimuth: 0, rise: 10 * TAN30 });
	});

	it('selects the same edge of a square under every cyclic reindexing', () => {
		const square: LayoutVec2[] = [[0, 0], [4, 0], [4, 4], [0, 4]];
		// Smallest ordered endpoint pair: ((0,0),(0,4)), so θ = +π/2.
		for (let shift = 0; shift < 4; shift += 1) {
			const points = square.map((_, index) => square[(index + shift) % 4]!);
			expect(formed(points, { kind: 'shed' }).region.form).toMatchObject({ azimuth: Math.PI / 2 });
			expect(formed(points, { kind: 'gable' }).region.form).toMatchObject({ azimuth: Math.PI });
		}
	});

	it('orders a reversed longest edge by its endpoints, not its traversal', () => {
		// The longest edge is the top, traversed toward −X.
		const trapezoid: LayoutVec2[] = [[0, 0], [8, 0], [10, 4], [-2, 4]];
		expect(formed(trapezoid, { kind: 'shed' }).region.form).toMatchObject({ azimuth: 0 });
	});

	it('moves the ridge toward qMax for a positive ridgeOffset', () => {
		const { region } = formed(LONG, { kind: 'gable', ridgeOffset: 0.5 });
		const facts = { role: region.role, form: region.form, footprint: LONG, datumY: 3, thickness: 0.2 };
		expect(regionFormProfile(region.form, LONG)!.qRidge).toBeCloseTo(2.5, 12);
		// Centred 30°: the default rise spans the longer side of the ridge.
		expectForm(region.form, { kind: 'gable', azimuth: Math.PI / 2, rise: 2.5 * TAN30, ridgeOffset: 0.5 });
		expect(regionUndersideAt(facts, [5, 2.5])).toBeCloseTo(3 + 2.5 * TAN30, 12);
		expect(regionUndersideAt(facts, [5, 4])).toBeGreaterThan(regionUndersideAt(facts, [5, 0]) - EPSILON);
	});

	it('keeps an explicit azimuth through a resize and turns it with a rotation', () => {
		const { document, regionId } = formed(LONG, { kind: 'shed', azimuth: 0.3 });
		const resized = success(planSetRegionFootprint(document, regionId, [[0, 0], [4, 0], [4, 10], [0, 10]])).document;
		expect(resized.regions[0]!.form).toMatchObject({ kind: 'shed', azimuth: 0.3 });
		const rotated = success(planRotateRegion(resized, regionId, 0.4)).document;
		// The azimuth turns by exactly the angle the footprint's edges turn.
		const heading = (points: readonly LayoutVec2[]) => Math.atan2(points[1]![1] - points[0]![1], points[1]![0] - points[0]![0]);
		const turn = heading(rotated.regions[0]!.footprint.points) - heading(resized.regions[0]!.footprint.points);
		expect(Math.abs(turn)).toBeCloseTo(0.4, 12);
		expect((rotated.regions[0]!.form as { azimuth: number }).azimuth).toBeCloseTo(0.3 + turn, 12);
	});

	it('keeps current values within a kind and takes defaults on a kind change', () => {
		const { document, regionId } = formed(LONG, { kind: 'shed', azimuth: 0.3, rise: 0.9 });
		const kept = success(planSetRegionForm(document, regionId, { kind: 'shed', rise: 1.1 })).document;
		expect(kept.regions[0]!.form).toEqual({ kind: 'shed', azimuth: 0.3, rise: 1.1 });
		const changed = success(planSetRegionForm(document, regionId, { kind: 'gable' })).document;
		expectForm(changed.regions[0]!.form, { kind: 'gable', azimuth: Math.PI / 2, rise: 2 * TAN30, ridgeOffset: 0 });
		expectRefusedAtomically(document, planSetRegionForm(document, regionId, { kind: 'shed' }), 'no_op');
	});

	it('refuses a sloped form on a floor Region', () => {
		const created = success(
			planCreateRegion({
				baseline: createEmptyWallFirstLayoutDocument(),
				capture: captureFor(`v3b-floor-${nonce++}`),
				intent: { role: 'floor', footprint: LONG, elevation: 0.5, thickness: 0.2 }
			})
		);
		const plan = planSetRegionForm(created.document, created.regionId, { kind: 'shed' });
		expectRefusedAtomically(created.document, plan, 'region_form_requires_overhead');
	});
});

/**
 * A 45° shed (rise 8 over an 8 m run along +Z) over two free-standing 0.2 m
 * Walls: one parallel to the eave (0.2 m underside spread across its width) and
 * one running up the slope (no spread across its width).
 */
describe('T-R8 — the sealing allowance never projects through the roof', () => {
	function slope(thickness: number) {
		const base = chain(createEmptyWallFirstLayoutDocument(), [[1, 2], [5, 2]], false, 2.5);
		const up = chain(base, [[7, 1], [7, 5]], false, 2.5);
		return roof(up, [[-1, -1], [9, -1], [9, 7], [-1, 7]], 1, thickness, { kind: 'shed', rise: 8, azimuth: Math.PI / 2 });
	}

	it('refuses the whole fit at 0.10 m thickness, naming the blocking Wall and its overrun', () => {
		const { document, regionId } = slope(0.1);
		const eaveWall = wallAt(document, [1, 2], [5, 2]).id;
		const plan = planFitWallsToRegion(document, compile(document), regionId, document.walls.map((wall) => wall.id));
		expectRefusedAtomically(document, plan, REGION_FIT_WALL_OVERRUN_CODE);
		if (plan.kind !== 'rejected') return;
		expect(plan.rejection.targetIds).toEqual([regionId, eaveWall]);
		expect(plan.rejection.message).toContain('0.100');
		// The other Wall alone fits.
		const upWall = wallAt(document, [7, 1], [7, 5]).id;
		expect(planFitWallsToRegion(document, compile(document), regionId, [upWall]).kind).toBe('success');
	});

	it('passes as meets at 0.20 m thickness, sealing to the upper face', () => {
		const { document, regionId } = slope(0.2);
		const fitted = success(
			planFitWallsToRegion(document, compile(document), regionId, document.walls.map((wall) => wall.id))
		);
		const eaveWall = wallAt(fitted.document, [1, 2], [5, 2]);
		// Underside at the inner face z = 2.1 is 1 + 3.1; the Wall seals to it.
		expect(eaveWall.height).toBeCloseTo(4.1, 9);
		for (const relation of relations(fitted.document, regionId).values()) expect(relation.reading).toBe('meets');
	});
});

describe('T-R3 — a ridge crossing inside a mitre corner', () => {
	it('fits a diagonal gable whose ridge crosses two Walls within the mitre reach', () => {
		// The ridge meets the corner Walls about 0.057 m from their shared
		// corner, inside the 0.1 m inner mitre reach of a 0.2 m Wall.
		const room = chain(createEmptyWallFirstLayoutDocument(), [[0, 0], [6, 0], [6, 6], [0, 6]], true, 2.5);
		const { document, regionId } = roof(room, [[-0.5, -0.5], [6.5, -0.5], [6.5, 6.5], [-0.5, 6.5]], 3, 0.4, {
			kind: 'gable',
			rise: 1.5,
			azimuth: -Math.PI / 4,
			ridgeOffset: 0.04
		});
		const ids = document.walls.map((wall) => wall.id);
		const roofFit = success(planFitRegionToWalls(document, compile(document), regionId, ids));
		const fitted = success(planFitWallsToRegion(roofFit.document, compile(roofFit.document), regionId, ids));
		expect(fitted.document.walls.filter((wall) => wall.top.kind === 'gable')).toHaveLength(2);
		for (const relation of relations(fitted.document, regionId).values()) expect(relation.reading).toBe('meets');
	});
});
