/**
 * T1 V3a — Plan partition of a shed or gable Region at a cut.
 *
 * The oracles are independent of the partition: the §7.1 profile written out,
 * a vertex-wise part inequality, exact area conservation over the footprint,
 * point-in-footprint containment and cold/retained equality.
 */
import { describe, expect, it } from 'vitest';
import { compileWallFirstLayoutGeometryFresh, type LayoutVec2 } from '@portfolio/layout-core/geometry';
import {
	createEmptyWallFirstLayoutDocument,
	type LayoutDocumentWallFirst,
	type LayoutRegionForm
} from '@portfolio/layout-core/wall';
import { planCreateRegion } from '@portfolio/layout-core/room';
import {
	createPlanRetainer,
	evaluateLayoutPlan,
	type PlanFragment,
	type PlanParameters
} from '@portfolio/layout-core/world';
import { captureFor } from './__fixtures__/layout-id-capture';

const EAVE = 3;
const THICKNESS = 0.2;
const BOX: LayoutVec2[] = [[-1, -1], [9, -1], [9, 7], [-1, 7]];
const U: LayoutVec2[] = [[0, 0], [10, 0], [10, 8], [6, 8], [6, 3], [4, 3], [4, 8], [0, 8]];
const GABLE: LayoutRegionForm = { kind: 'gable', rise: 1.5, azimuth: Math.PI / 2, ridgeOffset: 0 };
const OFF_GABLE: LayoutRegionForm = { kind: 'gable', rise: 2, azimuth: 0.4, ridgeOffset: 1.1 };
const SHED_Z: LayoutRegionForm = { kind: 'shed', rise: 2, azimuth: Math.PI / 2 };

let nonce = 0;

function roof(footprint: LayoutVec2[], form: LayoutRegionForm): LayoutDocumentWallFirst {
	const plan = planCreateRegion({
		baseline: createEmptyWallFirstLayoutDocument(),
		capture: captureFor(`v3a-plan-partition-${nonce++}`),
		intent: { role: 'overhead', footprint, elevation: EAVE, thickness: THICKNESS }
	});
	if (plan.kind !== 'success') throw new Error(plan.rejection.message);
	plan.document.regions.find((region) => region.id === plan.regionId)!.form = form;
	return plan.document;
}

function compile(document: LayoutDocumentWallFirst) {
	const result = compileWallFirstLayoutGeometryFresh(document);
	expect(result.issues.filter((issue) => issue.severity !== 'warning')).toEqual([]);
	return result.geometry;
}

function parameters(cut: number): PlanParameters {
	return {
		cutHeightMeters: cut,
		depthMeters: 100,
		lateralSpanHalfWidthMeters: null,
		sourceKindFilter: null,
		reveal: []
	};
}

const CONTEXT = { generationId: 'v3a-partition', target: [4, 3] as LayoutVec2, datumMeters: 0 };

function regionFragments(document: LayoutDocumentWallFirst, cut: number): PlanFragment[] {
	const result = evaluateLayoutPlan(compile(document), parameters(cut), CONTEXT);
	if (result.kind !== 'evaluated') throw new Error(JSON.stringify(result));
	return result.plan.fragments.filter((fragment) => fragment.ref.sourceKind === 'region');
}

/** A fragment's ring: a cut polygon, or an outline polyline closed on its first point. */
function ringOf(fragment: PlanFragment): readonly LayoutVec2[] {
	const geometry = fragment.geometry;
	if (geometry.kind === 'polygon') return geometry.polygon;
	if (geometry.kind === 'polyline') return geometry.polyline.slice(0, -1);
	throw new Error(`unexpected ${geometry.kind}`);
}

function signedArea(ring: readonly LayoutVec2[]): number {
	let sum = 0;
	for (let index = 0; index < ring.length; index++) {
		const [x0, z0] = ring[index]!;
		const [x1, z1] = ring[(index + 1) % ring.length]!;
		sum += x0 * z1 - x1 * z0;
	}
	return sum / 2;
}

/** §7.1 written out over the authored footprint. */
function oracleUnderside(form: LayoutRegionForm, footprint: readonly LayoutVec2[], point: LayoutVec2): number {
	if (form.kind === 'flat') return EAVE;
	const direction = [Math.cos(form.azimuth), Math.sin(form.azimuth)] as const;
	const stations = footprint.map(([x, z]) => x * direction[0] + z * direction[1]);
	const qMin = Math.min(...stations);
	const qMax = Math.max(...stations);
	const q = point[0] * direction[0] + point[1] * direction[1];
	if (form.kind === 'shed') return EAVE + (form.rise * (q - qMin)) / (qMax - qMin);
	const ridge = (qMin + qMax) / 2 + form.ridgeOffset;
	return q <= ridge
		? EAVE + (form.rise * (q - qMin)) / (ridge - qMin)
		: EAVE + (form.rise * (qMax - q)) / (qMax - ridge);
}

function onSegment(point: LayoutVec2, a: LayoutVec2, b: LayoutVec2): boolean {
	const cross = (b[0] - a[0]) * (point[1] - a[1]) - (b[1] - a[1]) * (point[0] - a[0]);
	const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
	if (Math.abs(cross) / length > 1e-9) return false;
	const dot = (point[0] - a[0]) * (b[0] - a[0]) + (point[1] - a[1]) * (b[1] - a[1]);
	return dot >= -1e-9 && dot <= length * length + 1e-9;
}

function insideOrOn(footprint: readonly LayoutVec2[], point: LayoutVec2): boolean {
	let inside = false;
	for (let index = 0, previous = footprint.length - 1; index < footprint.length; previous = index++) {
		const a = footprint[previous]!;
		const b = footprint[index]!;
		if (onSegment(point, a, b)) return true;
		if (a[1] > point[1] !== b[1] > point[1]) {
			const x = a[0] + ((point[1] - a[1]) * (b[0] - a[0])) / (b[1] - a[1]);
			if (point[0] < x) inside = !inside;
		}
	}
	return inside;
}

type Part = 'below' | 'band' | 'above';

function partOf(fragment: PlanFragment): Part {
	const face = fragment.ref.subRef?.kind === 'component' ? fragment.ref.subRef.componentId : null;
	if (face === 'edge') return 'band';
	if (face === 'top') return 'below';
	return 'above';
}

/** Every fragment vertex satisfies its part's inequality on the independent profile. */
function expectPartInequalities(
	fragments: readonly PlanFragment[],
	form: LayoutRegionForm,
	footprint: readonly LayoutVec2[],
	cut: number
): void {
	const tolerance = 1e-9;
	for (const fragment of fragments) {
		const part = partOf(fragment);
		for (const point of ringOf(fragment)) {
			const underside = oracleUnderside(form, footprint, point);
			if (part === 'band') {
				expect(underside).toBeLessThanOrEqual(cut + tolerance);
				expect(underside + THICKNESS).toBeGreaterThanOrEqual(cut - tolerance);
			} else if (part === 'below') {
				expect(underside + THICKNESS).toBeLessThanOrEqual(cut + tolerance);
			} else {
				expect(underside).toBeGreaterThanOrEqual(cut - tolerance);
			}
		}
	}
}

const CASES: [string, LayoutVec2[], LayoutRegionForm][] = [
	['gable over a box', BOX, GABLE],
	['oblique off-centre gable over a U', U, OFF_GABLE],
	['shed over a U', U, SHED_Z]
];

describe('V3a — Plan partition conserves area and stays inside the footprint', () => {
	for (const [name, footprint, form] of CASES) {
		it(`partitions the ${name} at every cut`, () => {
			const document = roof(footprint, form);
			const region = compile(document).regions[0]!;
			const footprintArea = Math.abs(signedArea(footprint));
			const cuts = [
				region.bottomY - 1,
				region.bottomY,
				region.bottomY + THICKNESS,
				region.bottomY + 0.37,
				(region.bottomY + region.topY) / 2,
				region.topY - THICKNESS,
				region.topY - 0.05,
				region.topY,
				region.topY + 1
			];
			for (const cut of cuts) {
				const fragments = regionFragments(document, cut);
				let total = 0;
				for (const fragment of fragments) {
					const ring = ringOf(fragment);
					const area = signedArea(ring);
					// Every part keeps the footprint's orientation and has real area.
					expect(area, `part area at cut ${cut}`).toBeGreaterThan(0);
					total += area;
					for (const point of ring) expect(insideOrOn(footprint, point), `${point} at ${cut}`).toBe(true);
				}
				expect(total, `area at cut ${cut}`).toBeCloseTo(footprintArea, 9);
				expectPartInequalities(fragments, form, footprint, cut);
			}
		});
	}
});

describe('V3a — Plan partition at exact cut heights', () => {
	it('reads a cut at the eave underside as a tangent projected underside, never a cut', () => {
		const document = roof(BOX, GABLE);
		const region = compile(document).regions[0]!;
		const fragments = regionFragments(document, region.bottomY);
		expect(fragments.filter((fragment) => fragment.ref.stream === 'cut')).toEqual([]);
		expect(fragments).toHaveLength(1);
		expect(fragments[0]!.ref).toMatchObject({
			stream: 'projected',
			subRef: { kind: 'component', componentId: 'underside' }
		});
	});

	it('reads a cut above the whole slab as one projected top, and below it as one hidden underside', () => {
		const document = roof(BOX, GABLE);
		const region = compile(document).regions[0]!;
		const over = regionFragments(document, region.topY + 0.5);
		expect(over.map((fragment) => [fragment.ref.stream, partOf(fragment)])).toEqual([['projected', 'below']]);
		const under = regionFragments(document, region.bottomY - 0.5);
		expect(under.map((fragment) => [fragment.ref.stream, partOf(fragment)])).toEqual([['hidden', 'above']]);
	});

	it('draws a cut through the ridge underside as one band across both sides', () => {
		const document = roof(BOX, GABLE);
		const ridgeUnderside = EAVE + 1.5;
		const fragments = regionFragments(document, ridgeUnderside + THICKNESS / 2);
		const bands = fragments.filter((fragment) => fragment.ref.stream === 'cut');
		expect(bands).toHaveLength(1);
		// The ridge band is |q - 3| <= 0.1 / slope on both sides: 10 m by 2 × 0.2667 m.
		expect(signedArea(ringOf(bands[0]!))).toBeCloseTo(10 * 2 * (0.1 / 0.375), 9);
		expect(fragments.filter((fragment) => partOf(fragment) === 'below')).toHaveLength(2);
	});

	it('meets the ridge exactly when the cut equals the ridge underside', () => {
		const document = roof(BOX, GABLE);
		const fragments = regionFragments(document, EAVE + 1.5);
		const bands = fragments.filter((fragment) => fragment.ref.stream === 'cut');
		expect(bands).toHaveLength(1);
		expect(signedArea(ringOf(bands[0]!))).toBeCloseTo(10 * 2 * (0.2 / 0.375), 9);
		expect(fragments.filter((fragment) => partOf(fragment) === 'above')).toEqual([]);
	});
});

describe('V3a — Plan partition splits a disconnected band into disjoint parts', () => {
	// The shed rises 2 m over 8 m of Z, so the band of a cut is 0.8 m of Z; at
	// cut 4.45 it is Z in [5, 5.8], which crosses both prongs of the U.
	it('draws two cut parts, one per prong, with no seam across the notch', () => {
		const document = roof(U, SHED_Z);
		const fragments = regionFragments(document, EAVE + (2 * 5.8) / 8);
		const bands = fragments.filter((fragment) => fragment.ref.stream === 'cut');
		expect(bands).toHaveLength(2);
		for (const band of bands) {
			const ring = ringOf(band);
			expect(signedArea(ring)).toBeCloseTo(4 * 0.8, 9);
			const left = ring.every(([x]) => x <= 4 + 1e-9);
			const right = ring.every(([x]) => x >= 6 - 1e-9);
			expect(left || right, JSON.stringify(ring)).toBe(true);
		}
		// Above the band, the two prong tops are separate outlines too.
		expect(fragments.filter((fragment) => partOf(fragment) === 'above')).toHaveLength(2);
		expect(fragments.filter((fragment) => partOf(fragment) === 'below')).toHaveLength(1);
	});
});

describe('V3a — retained Plan matches the cold Plan for sloped Regions', () => {
	it('gives the same evaluation through a sweep of cuts', () => {
		for (const [, footprint, form] of CASES) {
			const geometry = compile(roof(footprint, form));
			const retainer = createPlanRetainer();
			const region = geometry.regions[0]!;
			const cuts = [region.bottomY - 1, region.bottomY, 3.6, region.topY - 0.1, region.topY, 3.6, 1];
			for (const cut of cuts) {
				expect(retainer.evaluate(geometry, parameters(cut), CONTEXT)).toEqual(
					evaluateLayoutPlan(geometry, parameters(cut), CONTEXT)
				);
			}
		}
	});

	it('keeps a flat Region one full-footprint candidate', () => {
		const document = roof(BOX, { kind: 'flat' });
		const fragments = regionFragments(document, EAVE + 0.1);
		expect(fragments).toHaveLength(1);
		expect(fragments[0]!.geometry).toEqual({ kind: 'polygon', polygon: BOX });
	});
});
