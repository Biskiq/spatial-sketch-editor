/**
 * T1 V3a/V3b — flat-era consumers fed admitted shed and gable Regions.
 *
 * Each consumer reads the form exactly: the vertical Wall relation reads the
 * certified extrema of the covered Wall strip (V3b), the horizontal relation is
 * unchanged, and nothing falls back to the flat reading.
 */
import { describe, expect, it } from 'vitest';
import { compileWallFirstLayoutGeometryFresh, type LayoutVec2 } from '@portfolio/layout-core/geometry';
import {
	createEmptyWallFirstLayoutDocument,
	planWallChain,
	serializeWallFirstLayoutDocument,
	type LayoutDocumentWallFirst,
	type LayoutRegionForm
} from '@portfolio/layout-core/wall';
import {
	planCreateRegion,
	planFitRegionToWalls,
	planFitWallsToRegion,
	planRotateRegion,
	regionTopAt,
	regionUndersideAt,
	regionWallRelations
} from '@portfolio/layout-core/room';
import { captureFor, freshCapture } from './__fixtures__/layout-id-capture';

const RECT: LayoutVec2[] = [[0, 0], [8, 0], [8, 6], [0, 6]];
const COVER: LayoutVec2[] = [[-1, -1], [9, -1], [9, 7], [-1, 7]];
const INSET: LayoutVec2[] = [[1, 1], [7, 1], [7, 5], [1, 5]];
const SHED: LayoutRegionForm = { kind: 'shed', rise: 1, azimuth: 0 };
const GABLE: LayoutRegionForm = { kind: 'gable', rise: 1.5, azimuth: Math.PI / 2, ridgeOffset: 0 };
const THICKNESS = 0.2;

let nonce = 0;

function enclosure(height: number): LayoutDocumentWallFirst {
	const baseline = createEmptyWallFirstLayoutDocument();
	const plan = planWallChain({
		baseline,
		points: RECT,
		close: true,
		capture: freshCapture(),
		levelId: baseline.floor.id,
		height
	});
	if (plan.kind !== 'success') throw new Error(plan.rejection.message);
	return plan.document;
}

function withRoof(
	document: LayoutDocumentWallFirst,
	form: LayoutRegionForm,
	elevation: number,
	footprint: LayoutVec2[] = COVER
) {
	const plan = planCreateRegion({
		baseline: document,
		capture: captureFor(`v3a-consumer-${nonce++}`),
		intent: { role: 'overhead', footprint, elevation, thickness: THICKNESS }
	});
	if (plan.kind !== 'success') throw new Error(plan.rejection.message);
	const next = structuredClone(plan.document) as LayoutDocumentWallFirst;
	next.regions.find((region) => region.id === plan.regionId)!.form = form;
	return { document: next, regionId: plan.regionId };
}

function compile(document: LayoutDocumentWallFirst) {
	const result = compileWallFirstLayoutGeometryFresh(document);
	expect(result.issues.filter((issue) => issue.severity !== 'warning')).toEqual([]);
	return result.geometry;
}

function relationsOf(document: LayoutDocumentWallFirst, regionId: string) {
	const result = regionWallRelations(
		compile(document),
		document.regions.find((region) => region.id === regionId)!
	);
	if (result.kind !== 'relations') throw new Error(JSON.stringify(result));
	return result.relations;
}

/**
 * Independent expectation for the mitred 8 x 6 enclosure (0.2 m Walls) under
 * the COVER footprint: each Wall's strip spans its outer mitre corners, so its
 * plan extent along the slope is known in closed form.
 */
function expectedClearance(form: LayoutRegionForm, wallId: string, height: number, eave: number) {
	const half = 0.1;
	const along = (from: number, to: number) => ({ from, to });
	// Strip extents: index 0..3 follow RECT's edges (south, east, north, west).
	const x = [along(-half, 8 + half), along(8 - half, 8 + half), along(-half, 8 + half), along(-half, half)];
	const z = [along(-half, half), along(-half, 6 + half), along(6 - half, 6 + half), along(-half, 6 + half)];
	const index = Number(wallId.match(/(\d+)$/)?.[1] ?? 0) % 4;
	const underside = (q: number) =>
		form.kind === 'shed'
			? eave + (form.rise * (q + 1)) / 10
			: form.kind === 'gable'
				? eave + (form.rise * (q <= 3 ? q + 1 : 7 - q)) / 4
				: eave;
	const span = form.kind === 'shed' ? x[index]! : z[index]!;
	const values = [underside(span.from), underside(span.to)];
	if (form.kind === 'gable' && span.from < 3 && span.to > 3) values.push(underside(3));
	return { contact: Math.min(...values) - height, gap: Math.max(...values) - height };
}

describe('V3b — sloped vertical Wall relations read certified strip extrema', () => {
	for (const [form, height] of [
		[SHED, 3],
		[SHED, 3.5],
		[GABLE, 2.5]
	] as const) {
		it(`reads every covered Wall from its extrema under a ${form.kind} with Walls at ${height}`, () => {
			const { document, regionId } = withRoof(enclosure(height), form, 3);
			const relations = relationsOf(document, regionId);
			expect(relations).toHaveLength(4);
			const wallIds = document.walls.map((wall) => wall.id);
			for (const relation of relations) {
				expect(['through', 'edge']).toContain(relation.planClass);
				const expected = expectedClearance(form, `w${wallIds.indexOf(relation.wallId)}`, height, 3);
				const overrun = -expected.contact - THICKNESS;
				if (relation.planClass === 'through' && overrun > 1e-6) {
					expect(relation.reading).toBe('crosses');
					expect(relation.measureMeters).toBeNull();
				} else if (expected.gap > 1e-6) {
					expect(relation.reading).toBe('gap');
					expect(relation.measureAxis).toBe('vertical');
					expect(relation.measureMeters).toBeCloseTo(expected.gap, 9);
					const segment = relation.measureSegment!;
					expect(segment.to[1] - segment.from[1]).toBeCloseTo(expected.gap, 9);
					expect(relation.fit).toBe(Math.abs(expected.contact) > 1e-6 ? 'fit-roof-to-walls' : null);
				} else {
					expect(relation.reading).toBe('meets');
				}
			}
		});
	}

	it('keeps the horizontal relation of a nearby Wall exactly as flat reads it', () => {
		for (const form of [SHED, GABLE]) {
			const sloped = withRoof(enclosure(3.2), form, 3, INSET);
			const flat = withRoof(enclosure(3.2), { kind: 'flat' }, 3, INSET);
			const slopedRelations = relationsOf(sloped.document, sloped.regionId);
			const flatRelations = relationsOf(flat.document, flat.regionId);
			expect(slopedRelations.length).toBe(4);
			for (const relation of slopedRelations) {
				expect(relation.planClass).toBe('near');
				expect(relation.reading).toBe('gap');
				expect(relation.measureAxis).toBe('horizontal');
				expect(relation.fit).toBe('meet-wall');
			}
			expect(slopedRelations.map(({ wallId: _id, ...rest }) => rest)).toEqual(
				flatRelations.map(({ wallId: _id, ...rest }) => rest)
			);
		}
	});
});

describe('V3b — both fits follow a sloped Region', () => {
	for (const form of [SHED, GABLE]) {
		it(`fits the roof, then the walls, under a ${form.kind} until every Wall meets`, () => {
			const { document, regionId } = withRoof(enclosure(2.5), form, 3);
			const before = serializeWallFirstLayoutDocument(document);
			const ids = document.walls.map((wall) => wall.id);
			const roof = planFitRegionToWalls(document, compile(document), regionId, ids);
			if (roof.kind !== 'success') throw new Error(roof.rejection.message);
			expect(serializeWallFirstLayoutDocument(document)).toBe(before);
			for (const relation of relationsOf(roof.document, regionId)) {
				expect(['gap', 'meets']).toContain(relation.reading);
			}
			const walls = planFitWallsToRegion(roof.document, compile(roof.document), regionId, ids);
			if (walls.kind !== 'success') throw new Error(walls.rejection.message);
			for (const relation of relationsOf(walls.document, regionId)) {
				expect(relation.reading).toBe('meets');
			}
		});
	}
});

describe('V3a — rotating a sloped Region turns its slope with the footprint', () => {
	const forms: LayoutRegionForm[] = [SHED, { kind: 'gable', rise: 1, azimuth: 0, ridgeOffset: 2 }];
	for (const form of forms) {
		for (const angle of [Math.PI / 2, Math.PI / 4, -2.5]) {
			it(`keeps every rotated point's underside under a ${form.kind} at ${angle.toFixed(3)}`, () => {
				const { document, regionId } = withRoof(enclosure(3), form, 4);
				const plan = planRotateRegion(document, regionId, angle);
				if (plan.kind !== 'success') throw new Error(plan.rejection.message);
				const before = document.regions.find((region) => region.id === regionId)!;
				const after = plan.document.regions.find((region) => region.id === regionId)!;
				if (after.form.kind === 'gable' && form.kind === 'gable')
					expect(after.form.ridgeOffset).toBe(form.ridgeOffset);
				const facts = (region: typeof before) => ({
					role: 'overhead' as const,
					form: region.form,
					footprint: region.footprint.points,
					datumY: region.elevation,
					thickness: region.thickness
				});
				// Each authored vertex keeps its height: the slope is a property of the roof, not the world.
				before.footprint.points.forEach((point, index) => {
					const moved = after.footprint.points[index]!;
					expect(regionUndersideAt(facts(after), moved)).toBeCloseTo(
						regionUndersideAt(facts(before), point),
						9
					);
				});
			});
		}
	}
});

describe('V3a — the flat floor-role evaluator matches the compiled floor slab', () => {
	it('reads the datum as the walking top and hangs the slab below it', () => {
		const facts = {
			role: 'floor' as const,
			form: { kind: 'flat' } as const,
			footprint: RECT,
			datumY: 0.2,
			thickness: 0.2
		};
		expect(regionTopAt(facts, [3, 3])).toBeCloseTo(0.2, 12);
		expect(regionUndersideAt(facts, [3, 3])).toBeCloseTo(0, 12);
	});
});

describe('V3a — ridge snapping stays within the certified height tolerance', () => {
	function compileIssues(form: LayoutRegionForm, footprint: LayoutVec2[]) {
		const { document } = withRoof(createEmptyWallFirstLayoutDocument(), form, 3, footprint);
		return compileWallFirstLayoutGeometryFresh(document);
	}
	const shift = (points: LayoutVec2[], dx: number, dz: number): LayoutVec2[] =>
		points.map(([x, z]) => [x + dx, z + dz]);
	// A ridge 2e-6 m from the far eave over an 8 m run: a slope of 5e6.
	const STEEP: LayoutRegionForm = { kind: 'gable', rise: 10, azimuth: Math.PI / 2, ridgeOffset: 4 - 2e-6 };
	const BOX: LayoutVec2[] = [[0, 0], [10, 0], [10, 8], [0, 8]];

	it('compiles a steep form near the origin on the evaluator', () => {
		const result = compileIssues(STEEP, BOX);
		expect(result.issues.filter((issue) => issue.severity !== 'warning')).toEqual([]);
		const region = result.geometry.regions[0]!;
		const facts = { role: 'overhead' as const, form: STEEP, footprint: BOX, datumY: 3, thickness: THICKNESS };
		for (const face of region.faces) {
			if (face.surface !== 'underside') continue;
			for (const [x, y, z] of face.polygon) {
				expect(Math.abs(y - regionUndersideAt(facts, [x, z]))).toBeLessThanOrEqual(1e-6);
			}
		}
	});

	it('refuses the same steep form far from the origin instead of bending it', () => {
		const result = compileIssues(STEEP, shift(BOX, 1e6, 1e6));
		const issue = result.issues.find((entry) => entry.code === 'region_form_geometry_failed');
		expect(issue?.message).toMatch(/too steep for its position/);
	});

	it('compiles an ordinary pitch translated far from the origin', () => {
		for (const offset of [1e5, 1e6]) {
			const footprint = shift(BOX, offset, 3 * offset);
			const result = compileIssues(GABLE, footprint);
			expect(result.issues.filter((issue) => issue.severity !== 'warning')).toEqual([]);
			const facts = { role: 'overhead' as const, form: GABLE, footprint, datumY: 3, thickness: THICKNESS };
			for (const face of result.geometry.regions[0]!.faces) {
				if (face.surface !== 'underside') continue;
				for (const [x, y, z] of face.polygon) {
					expect(Math.abs(y - regionUndersideAt(facts, [x, z]))).toBeLessThanOrEqual(1e-6);
				}
			}
		}
	});
});
