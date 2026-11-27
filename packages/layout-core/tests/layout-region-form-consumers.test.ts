/**
 * T1 V3a — flat-era consumers fed admitted shed and gable Regions.
 *
 * Each oracle is the §7.1 profile and §7.3 reading written independently of the
 * production evaluator: a dense walk along the Wall for the relation, and a grid
 * over the footprint for the Plan section.
 */
import { describe, expect, it } from 'vitest';
import { compileWallFirstLayoutGeometryFresh, type LayoutVec2 } from '@portfolio/layout-core/geometry';
import {
	createEmptyWallFirstLayoutDocument,
	planExactWallHeight,
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
	REGION_FORM_FIT_UNSUPPORTED_CODE,
	regionTopAt,
	regionUndersideAt,
	regionWallRelations
} from '@portfolio/layout-core/room';
import { createPlanRetainer, evaluateLayoutPlan } from '@portfolio/layout-core/world';
import { captureFor, freshCapture } from './__fixtures__/layout-id-capture';

const RECT: LayoutVec2[] = [[0, 0], [8, 0], [8, 6], [0, 6]];
const COVER: LayoutVec2[] = [[-1, -1], [9, -1], [9, 7], [-1, 7]];
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

function withRoof(document: LayoutDocumentWallFirst, form: LayoutRegionForm, elevation: number) {
	const plan = planCreateRegion({
		baseline: document,
		capture: captureFor(`v3a-consumer-${nonce++}`),
		intent: { role: 'overhead', footprint: COVER, elevation, thickness: THICKNESS }
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

function withWallHeights(document: LayoutDocumentWallFirst, height: number) {
	let next = document;
	for (const wall of document.walls) {
		const plan = planExactWallHeight(next, wall.id, height);
		if (plan.kind !== 'success') throw new Error(plan.rejection.message);
		next = plan.document;
	}
	return next;
}

/** §7.1 written out: the profile over the authored footprint, from the eave. */
function oracleUnderside(form: LayoutRegionForm, eave: number, point: LayoutVec2): number {
	if (form.kind === 'flat') return eave;
	const direction = [Math.cos(form.azimuth), Math.sin(form.azimuth)] as const;
	const stations = COVER.map(([x, z]) => x * direction[0] + z * direction[1]);
	const qMin = Math.min(...stations);
	const qMax = Math.max(...stations);
	const q = point[0] * direction[0] + point[1] * direction[1];
	if (form.kind === 'shed') return eave + (form.rise * (q - qMin)) / (qMax - qMin);
	const ridge = (qMin + qMax) / 2 + form.ridgeOffset;
	return q <= ridge
		? eave + (form.rise * (q - qMin)) / (ridge - qMin)
		: eave + (form.rise * (qMax - q)) / (qMax - ridge);
}

/** §7.3 written out on a level Wall's centerline and both faces. */
function oracleReading(
	form: LayoutRegionForm,
	eave: number,
	start: LayoutVec2,
	end: LayoutVec2,
	wallTop: number,
	wallThickness: number
): { reading: string; gap: number } {
	const along = [end[0] - start[0], end[1] - start[1]] as const;
	const span = Math.hypot(along[0], along[1]);
	const normal = [-along[1] / span, along[0] / span] as const;
	let gap = -Infinity;
	let overrun = -Infinity;
	for (const offset of [0, wallThickness / 2, -wallThickness / 2]) {
		for (let index = 0; index <= 2000; index++) {
			const t = index / 2000;
			const point: LayoutVec2 = [
				start[0] + along[0] * t + normal[0] * offset,
				start[1] + along[1] * t + normal[1] * offset
			];
			const underside = oracleUnderside(form, eave, point);
			gap = Math.max(gap, underside - wallTop);
			overrun = Math.max(overrun, wallTop - (underside + THICKNESS));
		}
	}
	return { reading: overrun > 1e-6 ? 'crosses' : gap > 1e-6 ? 'gap' : 'meets', gap };
}

function relationsAgainstOracle(document: LayoutDocumentWallFirst, regionId: string, form: LayoutRegionForm, eave: number) {
	const result = regionWallRelations(compile(document), document.regions.find((region) => region.id === regionId)!);
	if (result.kind !== 'relations') throw new Error(JSON.stringify(result));
	const point = (id: string) => document.junctions.find((junction) => junction.id === id)!.point;
	return result.relations.map((relation) => {
		const wall = document.walls.find((candidate) => candidate.id === relation.wallId)!;
		const oracle = oracleReading(
			form,
			eave,
			point(wall.startJunctionId),
			point(wall.endJunctionId),
			wall.height,
			wall.thickness
		);
		return { relation, oracle };
	});
}

describe('V3a — Wall relations under a sloped Region read the §7.3 quantities', () => {
	it('reads the eave-side gap of level Walls under a shed', () => {
		const { document, regionId } = withRoof(enclosure(3), SHED, 3);
		const rows = relationsAgainstOracle(document, regionId, SHED, 3);
		expect(rows).toHaveLength(4);
		for (const { relation, oracle } of rows) {
			expect(relation.reading).toBe(oracle.reading);
			expect(relation.reading).toBe('gap');
			expect(relation.measureMeters!).toBeCloseTo(oracle.gap, 6);
			expect(relation.measureSegment).not.toBeNull();
		}
	});

	it('reads crosses where the low side pokes through and gap where it does not', () => {
		const { document, regionId } = withRoof(withWallHeights(enclosure(3), 3.5), SHED, 3);
		const rows = relationsAgainstOracle(document, regionId, SHED, 3);
		const readings = rows.map(({ relation }) => relation.reading).sort();
		expect(readings).toEqual(['crosses', 'crosses', 'crosses', 'gap']);
		for (const { relation, oracle } of rows) {
			expect(relation.reading).toBe(oracle.reading);
			if (relation.reading === 'gap') expect(relation.measureMeters!).toBeCloseTo(oracle.gap, 6);
		}
	});
});

describe('V3a — flat-only fits refuse a sloped Region atomically', () => {
	for (const form of [SHED, GABLE]) {
		it(`refuses both fits under a ${form.kind} and leaves the document unchanged`, () => {
			const { document, regionId } = withRoof(enclosure(2.5), form, 3);
			const before = serializeWallFirstLayoutDocument(document);
			const geometry = compile(document);
			const ids = document.walls.map((wall) => wall.id);
			for (const plan of [
				planFitRegionToWalls(document, geometry, regionId, ids),
				planFitWallsToRegion(document, geometry, regionId, ids)
			]) {
				expect(plan.kind).not.toBe('success');
				if (plan.kind === 'success') continue;
				expect(plan.rejection.code).toBe(REGION_FORM_FIT_UNSUPPORTED_CODE);
				expect(plan.rejection.message).toContain(form.kind);
			}
			expect(serializeWallFirstLayoutDocument(document)).toBe(before);
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

describe('V3a — Plan cuts a sloped Region only where the slab is', () => {
	function regionFragments(document: LayoutDocumentWallFirst, cut: number) {
		const result = evaluateLayoutPlan(
			compile(document),
			{ cutHeightMeters: cut, depthMeters: 100, lateralSpanHalfWidthMeters: null, sourceKindFilter: null, reveal: [] },
			{ generationId: 'v3a-plan', target: [4, 3], datumMeters: 0 }
		);
		if (result.kind !== 'evaluated') throw new Error(JSON.stringify(result));
		const pick = (stream: 'cut' | 'projected' | 'hidden') =>
			result.plan.streams[stream].filter((fragment) => fragment.ref.sourceKind === 'region');
		return { cut: pick('cut'), projected: pick('projected'), hidden: pick('hidden') };
	}

	function area(polygon: readonly LayoutVec2[]): number {
		let sum = 0;
		for (let index = 0; index < polygon.length; index++) {
			const [x0, z0] = polygon[index]!;
			const [x1, z1] = polygon[(index + 1) % polygon.length]!;
			sum += x0 * z1 - x1 * z0;
		}
		return Math.abs(sum) / 2;
	}

	/**
	 * The true section area under the pi/2 gable: the slope runs along Z only, so the
	 * band is the Z measure where the slab spans `cut`, times the 10 m X extent.
	 */
	function oracleSectionArea(form: LayoutRegionForm, eave: number, cut: number): number {
		const steps = 200_000;
		let inside = 0;
		for (let k = 0; k < steps; k++) {
			const underside = oracleUnderside(form, eave, [4, -1 + (8 * (k + 0.5)) / steps]);
			if (underside <= cut && cut <= underside + THICKNESS) inside++;
		}
		return (10 * 8 * inside) / steps;
	}

	for (const cut of [3.1, 4.0, 4.6]) {
		it(`draws the gable section bands at cut ${cut}`, () => {
			const { document } = withRoof(enclosure(2.5), GABLE, 3);
			const { cut: fragments } = regionFragments(document, cut);
			expect(fragments).toHaveLength(2);
			let total = 0;
			for (const fragment of fragments) {
				expect(fragment.ref.subRef).toEqual({ kind: 'component', componentId: 'edge' });
				expect(fragment.elevationMeters).toBe(cut);
				if (fragment.geometry.kind !== 'polygon') throw new Error('expected a polygon');
				total += area(fragment.geometry.polygon);
			}
			expect(total).toBeCloseTo(oracleSectionArea(GABLE, 3, cut), 2);
			expect(total).toBeLessThan(80 * 0.2);
		});
	}

	it('keeps a wholly-above sloped Region a hidden underside outline', () => {
		const { document } = withRoof(enclosure(2.5), GABLE, 3);
		const { cut, hidden } = regionFragments(document, 1.2);
		expect(cut).toHaveLength(0);
		expect(hidden.length).toBeGreaterThan(0);
		for (const fragment of hidden)
			expect(fragment.ref.subRef).toEqual({ kind: 'component', componentId: 'underside' });
	});

	it('gives the retained evaluator the same sloped sections as the cold one', () => {
		const { document } = withRoof(enclosure(2.5), GABLE, 3);
		const geometry = compile(document);
		const retainer = createPlanRetainer();
		for (const cut of [1.2, 3.1, 4.0, 4.6, 6]) {
			const parameters = {
				cutHeightMeters: cut,
				depthMeters: 100,
				lateralSpanHalfWidthMeters: null,
				sourceKindFilter: null,
				reveal: []
			};
			const context = { generationId: 'v3a-plan', target: [4, 3] as LayoutVec2, datumMeters: 0 };
			expect(retainer.evaluate(geometry, parameters, context)).toEqual(
				evaluateLayoutPlan(geometry, parameters, context)
			);
		}
	});

	it('keeps a flat Region one full-footprint cut', () => {
		const { document } = withRoof(enclosure(2.5), { kind: 'flat' }, 3);
		const { cut } = regionFragments(document, 3.1);
		expect(cut).toHaveLength(1);
		if (cut[0]!.geometry.kind !== 'polygon') throw new Error('expected a polygon');
		expect(area(cut[0]!.geometry.polygon)).toBeCloseTo(80, 12);
	});
});
