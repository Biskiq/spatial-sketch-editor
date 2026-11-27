/**
 * T1 V3a — Region shed and gable forms.
 *
 * The geometric oracles here are independent of the compiler's construction:
 * planarity is measured from each emitted face, watertightness is exact directed
 * edge matching, thickness is a vertex-pair check, and ridge continuity is the
 * exact shared edge between opposite-side top faces. The flat golden pins the
 * pre-V3a face order and winding so a sloped-form change cannot silently move it.
 */
import { describe, expect, it } from 'vitest';
import {
	compileWallFirstLayoutGeometry,
	compileWallFirstLayoutGeometryFresh,
	createLayoutCompileReuse,
	type LayoutVec2
} from '@portfolio/layout-core/geometry';
import {
	createEmptyWallFirstLayoutDocument,
	parseWallFirstLayoutDocumentJson,
	serializeWallFirstLayoutDocument,
	validateWallFirstLayoutDocument,
	type LayoutDocumentWallFirst,
	type LayoutRegionForm
} from '@portfolio/layout-core/wall';
import {
	normalizeRegionAzimuth,
	overheadSupportSnapshotOf,
	planCreateRegion,
	queryOverheadSupports,
	regionFormProfile,
	regionTopAt,
	regionUndersideAt,
	regionUndersideNormalAt,
	type RegionFormFacts
} from '@portfolio/layout-core/room';
import { captureFor } from './__fixtures__/layout-id-capture';

type Geometry = ReturnType<typeof compileWallFirstLayoutGeometryFresh>['geometry'];
type CompiledRegion = Geometry['regions'][number];
type Face = CompiledRegion['faces'][number];
type Vec3 = readonly [number, number, number];

const RECT: LayoutVec2[] = [[0, 0], [8, 0], [8, 6], [0, 6]];
const L: LayoutVec2[] = [[0, 0], [8, 0], [8, 3], [3, 3], [3, 7], [0, 7]];
const U: LayoutVec2[] = [
	[0, 0],
	[10, 0],
	[10, 8],
	[6, 8],
	[6, 3],
	[4, 3],
	[4, 8],
	[0, 8]
];

let nonce = 0;

function roofDocument(
	footprint: readonly LayoutVec2[],
	form: LayoutRegionForm,
	options: { elevation?: number; thickness?: number; role?: 'floor' | 'overhead' } = {}
): { document: LayoutDocumentWallFirst; regionId: string } {
	const role = options.role ?? 'overhead';
	const plan = planCreateRegion({
		baseline: createEmptyWallFirstLayoutDocument(),
		capture: captureFor(`v3a-form-${nonce++}`),
		intent: {
			role,
			footprint,
			elevation: options.elevation ?? (role === 'overhead' ? 3 : 0.2),
			thickness: options.thickness ?? 0.2
		}
	});
	if (plan.kind !== 'success') throw new Error(`region create failed: ${plan.rejection.message}`);
	const region = plan.document.regions.find((candidate) => candidate.id === plan.regionId)!;
	region.form = form;
	return { document: plan.document, regionId: plan.regionId };
}

function compile(document: LayoutDocumentWallFirst): Geometry {
	const result = compileWallFirstLayoutGeometryFresh(document);
	expect(result.issues).toEqual([]);
	return result.geometry;
}

function regionOf(geometry: Geometry, regionId: string): CompiledRegion {
	const region = geometry.regions.find((candidate) => candidate.regionId === regionId);
	if (region === undefined) throw new Error(`unknown compiled region ${regionId}`);
	return region;
}

function exact(value: number): string {
	return Object.is(value, -0) ? '0' : String(value);
}

function pointKey(point: Vec3): string {
	return `${exact(point[0])},${exact(point[1])},${exact(point[2])}`;
}

function planKey(point: Vec3): string {
	return `${exact(point[0])},${exact(point[2])}`;
}

function vector(a: Vec3, b: Vec3): Vec3 {
	return [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
}

function cross(a: Vec3, b: Vec3): Vec3 {
	return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

function dot(a: Vec3, b: Vec3): number {
	return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function length(a: Vec3): number {
	return Math.hypot(a[0], a[1], a[2]);
}

/** Maximum distance of any face vertex from the face's own plane. */
function planarityError(points: readonly Vec3[]): number {
	const origin = points[0]!;
	let normal: Vec3 = [0, 0, 0];
	for (let index = 1; index + 1 < points.length; index++) {
		normal = cross(vector(origin, points[index]!), vector(origin, points[index + 1]!));
		if (length(normal) > 1e-12) break;
	}
	const magnitude = length(normal);
	if (!(magnitude > 1e-12)) return Infinity;
	normal = [normal[0] / magnitude, normal[1] / magnitude, normal[2] / magnitude];
	let worst = 0;
	for (const point of points) worst = Math.max(worst, Math.abs(dot(vector(origin, point), normal)));
	return worst;
}

/**
 * Exact watertightness: every directed face edge has its reverse exactly once,
 * and every undirected edge belongs to exactly two face edges. This is stronger
 * than a distance test and catches a T-junction or a duplicated ridge.
 */
function expectWatertight(faces: readonly Face[]): void {
	const directed = new Map<string, number>();
	const undirected = new Map<string, number>();
	for (const face of faces) {
		for (let index = 0; index < face.polygon.length; index++) {
			const from = face.polygon[index]!;
			const to = face.polygon[(index + 1) % face.polygon.length]!;
			const key = `${pointKey(from)}|${pointKey(to)}`;
			directed.set(key, (directed.get(key) ?? 0) + 1);
			const pair = [pointKey(from), pointKey(to)].sort().join('|');
			undirected.set(pair, (undirected.get(pair) ?? 0) + 1);
		}
	}
	for (const [key, count] of directed) {
		const [from, to] = key.split('|') as [string, string];
		expect(directed.get(`${to}|${from}`), `reverse of ${key}`).toBe(count);
	}
	for (const [key, count] of undirected) expect(count, `undirected ${key}`).toBe(2);
}

function expectConstantThickness(faces: readonly Face[], thickness: number): void {
	const heightsByPlan = new Map<string, number[]>();
	for (const face of faces) {
		for (const point of face.polygon) {
			if (face.surface === 'top' || face.surface === 'underside' || face.surface === 'edge') {
				const key = planKey(point);
				const heights = heightsByPlan.get(key) ?? [];
				if (!heights.includes(point[1])) heights.push(point[1]);
				heightsByPlan.set(key, heights);
			}
		}
	}
	let compared = 0;
	for (const [key, heights] of heightsByPlan) {
		heights.sort((left, right) => left - right);
		expect(heights.length, `two vertical values at ${key}`).toBe(2);
		expect(heights[1]! - heights[0]!, `thickness at ${key}`).toBeCloseTo(thickness, 12);
		compared++;
	}
	expect(compared).toBeGreaterThan(3);
}

function expectPlanar(faces: readonly Face[]): void {
	for (const face of faces) {
		expect(planarityError(face.polygon), face.surface).toBeLessThan(1e-9);
		expect(Math.abs(length([...face.normal]) - 1), `${face.surface} normal`).toBeLessThan(1e-12);
		if (face.surface === 'top') expect(face.normal[1]).toBeGreaterThan(0);
		if (face.surface === 'underside') expect(face.normal[1]).toBeLessThan(0);
		if (face.surface === 'edge') expect(Math.abs(face.normal[1])).toBeLessThan(1e-15);
	}
}

/**
 * The ridge as it is actually emitted: a top edge shared by two top faces whose
 * normals differ. Its endpoints must lie on the analytic ridge station.
 */
function expectRidge(
	faces: readonly Face[],
	ridgeStation: number,
	ridgeTopY: number,
	axis: 'x' | 'z'
): number {
	const topFaces = faces.filter((face) => face.surface === 'top');
	const stationIndex = axis === 'x' ? 0 : 2;
	let shared = 0;
	for (let left = 0; left < topFaces.length; left++) {
		for (let right = left + 1; right < topFaces.length; right++) {
			const a = topFaces[left]!;
			const b = topFaces[right]!;
			if (dot(a.normal, b.normal) > 0.999) continue;
			for (let index = 0; index < a.polygon.length; index++) {
				const a0 = a.polygon[index]!;
				const a1 = a.polygon[(index + 1) % a.polygon.length]!;
				for (let other = 0; other < b.polygon.length; other++) {
					const b0 = b.polygon[other]!;
					const b1 = b.polygon[(other + 1) % b.polygon.length]!;
					if (pointKey(a0) !== pointKey(b1) || pointKey(a1) !== pointKey(b0)) continue;
					for (const point of [a0, a1]) {
						expect(point[stationIndex], `ridge station on ${axis}`).toBeCloseTo(ridgeStation, 9);
						expect(point[1], 'ridge top height').toBeCloseTo(ridgeTopY, 9);
					}
					shared += Math.hypot(a1[0] - a0[0], a1[2] - a0[2]);
				}
			}
		}
	}
	expect(shared).toBeGreaterThan(0);
	return shared;
}

describe('V3a — Layout format 12 form admission', () => {
	it('round-trips shed and gable forms with only canonical keys', () => {
		const shed = roofDocument(RECT, { kind: 'shed', rise: 2, azimuth: 0.25 });
		const gable = roofDocument(RECT, {
			kind: 'gable',
			rise: 2,
			azimuth: -0.4,
			ridgeOffset: 0.5
		});
		for (const made of [shed, gable]) {
			const canonical = serializeWallFirstLayoutDocument(made.document);
			const parsed = parseWallFirstLayoutDocumentJson(canonical);
			expect(parsed.success).toBe(true);
			if (!parsed.success) continue;
			expect(parsed.document.regions[0]!.form).toEqual(made.document.regions[0]!.form);
			expect(serializeWallFirstLayoutDocument(parsed.document)).toBe(canonical);
		}
	});

	it('normalizes a source azimuth to (-pi, pi] and -0 to 0', () => {
		const { document } = roofDocument(RECT, { kind: 'shed', rise: 2, azimuth: 0 });
		const raw = JSON.parse(serializeWallFirstLayoutDocument(document));
		raw.regions[0].form.azimuth = (3 * Math.PI) / 2;
		const wrapped = parseWallFirstLayoutDocumentJson(JSON.stringify(raw));
		expect(wrapped.success).toBe(true);
		if (wrapped.success) {
			expect(wrapped.document.regions[0]!.form).toMatchObject({ azimuth: -Math.PI / 2 });
		}
		raw.regions[0].form.azimuth = -0;
		const zero = parseWallFirstLayoutDocumentJson(JSON.stringify(raw));
		expect(zero.success).toBe(true);
		if (zero.success) {
			const form = zero.document.regions[0]!.form;
			if (form.kind === 'flat') throw new Error('expected a sloped form');
			expect(Object.is(form.azimuth, -0)).toBe(false);
			expect(form.azimuth).toBe(0);
		}
		expect(normalizeRegionAzimuth(-Math.PI)).toBe(Math.PI);
	});

	it('refuses unknown, missing and non-canonical form parameters', () => {
		const { document } = roofDocument(RECT, {
			kind: 'gable',
			rise: 2,
			azimuth: 0,
			ridgeOffset: 0
		});
		const base = JSON.parse(serializeWallFirstLayoutDocument(document));

		const extra = structuredClone(base);
		extra.regions[0].form.hip = 1;
		const extraResult = parseWallFirstLayoutDocumentJson(JSON.stringify(extra));
		expect(extraResult.success).toBe(false);
		if (!extraResult.success) {
			expect(extraResult.issues.map((issue) => issue.code)).toContain('unknown_key');
		}

		const missingRidge = structuredClone(base);
		delete missingRidge.regions[0].form.ridgeOffset;
		const missing = parseWallFirstLayoutDocumentJson(JSON.stringify(missingRidge));
		expect(missing.success).toBe(false);

		const shedWithRidge = structuredClone(base);
		shedWithRidge.regions[0].form = { kind: 'shed', rise: 2, azimuth: 0, ridgeOffset: 0 };
		expect(parseWallFirstLayoutDocumentJson(JSON.stringify(shedWithRidge)).success).toBe(false);

		const flatWithRise = structuredClone(base);
		flatWithRise.regions[0].form = { kind: 'flat', rise: 2 };
		expect(parseWallFirstLayoutDocumentJson(JSON.stringify(flatWithRise)).success).toBe(false);

		const zeroRise = structuredClone(base);
		zeroRise.regions[0].form.rise = 0;
		expect(parseWallFirstLayoutDocumentJson(JSON.stringify(zeroRise)).success).toBe(false);

		const unknownKind = structuredClone(base);
		unknownKind.regions[0].form = { kind: 'dome', rise: 2, azimuth: 0 };
		expect(parseWallFirstLayoutDocumentJson(JSON.stringify(unknownKind)).success).toBe(false);
	});

	it('refuses a floor form and a gable ridge outside the projected half extent', () => {
		const floor = roofDocument(RECT, { kind: 'shed', rise: 2, azimuth: 0 }, { role: 'floor' });
		const floorIssues = validateWallFirstLayoutDocument(floor.document);
		expect(floorIssues.success).toBe(false);
		if (!floorIssues.success) {
			expect(floorIssues.issues.map((issue) => issue.code)).toContain(
				'region_form_requires_overhead'
			);
		}

		for (const ridgeOffset of [4, 8, -8]) {
			const { document } = roofDocument(RECT, {
				kind: 'gable',
				rise: 2,
				azimuth: 0,
				ridgeOffset
			});
			const result = validateWallFirstLayoutDocument(document);
			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.issues.map((issue) => issue.code)).toContain('region_ridge_outside');
			}
		}
	});

	it('normalizes an in-memory azimuth on validation and refuses it in the compiler', () => {
		const { document } = roofDocument(RECT, { kind: 'shed', rise: 2, azimuth: 0 });
		document.regions[0]!.form = { kind: 'shed', rise: 2, azimuth: -Math.PI };
		const validated = validateWallFirstLayoutDocument(document);
		expect(validated.success).toBe(true);
		if (validated.success) {
			expect(validated.document.regions[0]!.form).toMatchObject({ azimuth: Math.PI });
		}
		const compiled = compileWallFirstLayoutGeometryFresh(document);
		expect(compiled.issues.map((issue) => issue.code)).toContain('region_form_azimuth_invalid');
	});
});

describe('V3a — shared Region evaluators', () => {
	const facts = (form: LayoutRegionForm, footprint: readonly LayoutVec2[] = RECT) =>
		({
			role: 'overhead',
			form,
			footprint,
			datumY: 3,
			thickness: 0.2
		}) satisfies RegionFormFacts;

	it('evaluates a shed from the eave and reports its true normal', () => {
		const form: LayoutRegionForm = { kind: 'shed', rise: 2, azimuth: 0 };
		const factsValue = facts(form);
		expect(regionUndersideAt(factsValue, [0, 3])).toBeCloseTo(3, 12);
		expect(regionUndersideAt(factsValue, [8, 3])).toBeCloseTo(5, 12);
		expect(regionTopAt(factsValue, [4, 3])).toBeCloseTo(4.2, 12);
		const normal = regionUndersideNormalAt(factsValue, [4, 3]);
		const expected = [0.25 / Math.hypot(0.25, 1), -1 / Math.hypot(0.25, 1), 0];
		expect(normal[0]).toBeCloseTo(expected[0]!, 12);
		expect(normal[1]).toBeCloseTo(expected[1]!, 12);
		expect(normal[2]).toBeCloseTo(0, 12);
	});

	it('keeps an off-centre gable ridge exact and flips the normal side', () => {
		const form: LayoutRegionForm = {
			kind: 'gable',
			rise: 2,
			azimuth: 0,
			ridgeOffset: 1
		};
		const factsValue = facts(form);
		const profile = regionFormProfile(form, RECT);
		expect(profile).not.toBeNull();
		expect(profile!.qRidge).toBeCloseTo(5, 12);
		expect(regionUndersideAt(factsValue, [0, 3])).toBeCloseTo(3, 12);
		expect(regionUndersideAt(factsValue, [8, 3])).toBeCloseTo(3, 12);
		expect(regionUndersideAt(factsValue, [5, 3])).toBeCloseTo(5, 12);
		expect(regionTopAt(factsValue, [5, 3])).toBeCloseTo(5.2, 12);
		const below = regionUndersideNormalAt(factsValue, [5, 3]);
		const above = regionUndersideNormalAt(factsValue, [5.0001, 3]);
		expect(below[0]).toBeGreaterThan(0);
		expect(above[0]).toBeLessThan(0);
		expect(below[1]).toBeLessThan(0);
		expect(above[1]).toBeLessThan(0);
	});

	it('returns the exact flat normal and the flat datum everywhere', () => {
		const factsValue = facts({ kind: 'flat' });
		expect(regionUndersideAt(factsValue, [3, 3])).toBe(3);
		expect(regionTopAt(factsValue, [3, 3])).toBe(3.2);
		expect(regionUndersideNormalAt(factsValue, [3, 3])).toEqual([0, -1, 0]);
		expect(regionFormProfile({ kind: 'flat' }, RECT)).toBeNull();
	});
});

describe('V3a — planar, watertight compiled forms', () => {
	it('compiles a shed with a planar face, vertical perimeter and conservative bounds', () => {
		const { document, regionId } = roofDocument(RECT, { kind: 'shed', rise: 2, azimuth: 0 });
		const region = regionOf(compile(document), regionId);
		expectPlanar(region.faces);
		expectWatertight(region.faces);
		expectConstantThickness(region.faces, 0.2);
		expect(region.form).toEqual({ kind: 'shed', rise: 2, azimuth: 0 });
		expect(region.datumY).toBe(3);
		expect(region.thickness).toBe(0.2);
		expect(region.bottomY).toBe(3);
		expect(region.topY).toBeCloseTo(5.2, 12);
		expect(region.bounds3.min[1]).toBe(region.bottomY);
		expect(region.bounds3.max[1]).toBe(region.topY);
		const underside = region.faces.find((face) => face.surface === 'underside')!;
		for (const point of underside.polygon) {
			expect(point[1]).toBeGreaterThanOrEqual(region.bottomY);
			expect(point[1]).toBeLessThanOrEqual(region.topY);
			expect(regionUndersideAt(
				{ role: 'overhead', form: region.form!, footprint: region.footprint, datumY: region.datumY!, thickness: region.thickness! },
				[point[0], point[2]]
			)).toBeCloseTo(point[1], 9);
		}
	});

	it('compiles an off-centre gable rectangle with one exact ridge edge', () => {
		const { document, regionId } = roofDocument(RECT, {
			kind: 'gable',
			rise: 2,
			azimuth: 0,
			ridgeOffset: 1
		});
		const region = regionOf(compile(document), regionId);
		expectPlanar(region.faces);
		expectWatertight(region.faces);
		expectConstantThickness(region.faces, 0.2);
		const ridgeTop = 3 + 2 + 0.2;
		const topFaces = region.faces.filter((face) => face.surface === 'top');
		expect(topFaces).toHaveLength(2);
		const shared = expectRidge(region.faces, 5, ridgeTop, 'x');
		expect(shared).toBeCloseTo(6, 12);
		for (const face of topFaces) {
			const stations = face.polygon.map((point) => point[0]);
			const below = stations.every((station) => station <= 5 + 1e-12);
			const above = stations.every((station) => station >= 5 - 1e-12);
			expect(below || above).toBe(true);
		}
		// The ridge is a single top edge at x = qRidge, shared with its mirror.
		const ridgeVertices = topFaces.flatMap((face) => face.polygon).filter((point) => Math.abs(point[0] - 5) < 1e-12);
		expect(ridgeVertices.length).toBeGreaterThanOrEqual(4);
		for (const point of ridgeVertices) expect(point[1]).toBeCloseTo(ridgeTop, 12);
	});

	it('compiles shed and gable over an L footprint', () => {
		for (const form of [
			{ kind: 'shed', rise: 2, azimuth: 0 } as const,
			{ kind: 'gable', rise: 2, azimuth: Math.PI / 2, ridgeOffset: 0 } as const
		]) {
			const { document, regionId } = roofDocument(L, form);
			const region = regionOf(compile(document), regionId);
			expectPlanar(region.faces);
			expectWatertight(region.faces);
			expectConstantThickness(region.faces, 0.2);
			expect(region.bottomY).toBe(3);
			expect(region.topY).toBeCloseTo(5.2, 12);
		}
	});

	it('splits a concave U into multiple planar loops across a ridge through the notch', () => {
		const { document, regionId } = roofDocument(U, {
			kind: 'gable',
			rise: 2,
			azimuth: Math.PI / 2,
			ridgeOffset: 0
		});
		const region = regionOf(compile(document), regionId);
		expectPlanar(region.faces);
		expectWatertight(region.faces);
		expectConstantThickness(region.faces, 0.2);
		const topFaces = region.faces.filter((face) => face.surface === 'top');
		expect(topFaces.length).toBeGreaterThanOrEqual(3);
		// z > 4 is two disconnected arms; z < 4 is one connected base.
		const above = topFaces.filter((face) => face.polygon.every((point) => point[2] >= 4 - 1e-12));
		expect(above.length).toBe(2);
		const shared = expectRidge(region.faces, 4, 5.2, 'z');
		expect(shared).toBeCloseTo(8, 12);
	});

	it('keeps a rotated oblique ridge planar and watertight', () => {
		const { document, regionId } = roofDocument(RECT, {
			kind: 'gable',
			rise: 1.5,
			azimuth: 0.6,
			ridgeOffset: 0.4
		});
		const region = regionOf(compile(document), regionId);
		expectPlanar(region.faces);
		expectWatertight(region.faces);
		expectConstantThickness(region.faces, 0.2);
		expect(region.faces.filter((face) => face.surface === 'top')).toHaveLength(2);
	});

	it('compiles a gable over a triangular footprint', () => {
		const triangle: LayoutVec2[] = [[0, 0], [10, 0], [3, 7]];
		const { document, regionId } = roofDocument(triangle, {
			kind: 'gable',
			rise: 2.5,
			azimuth: 0,
			ridgeOffset: -0.3
		});
		const region = regionOf(compile(document), regionId);
		expectPlanar(region.faces);
		expectWatertight(region.faces);
		expectConstantThickness(region.faces, 0.2);
		expect(region.topY).toBeCloseTo(3 + 2.5 + 0.2, 12);
	});
});

describe('V3a — exact closure where footprint vertices sit on or near the ridge', () => {
	const triangle: LayoutVec2[] = [[0, 0], [4, 0], [2, 3]];
	const hexagon: LayoutVec2[] = [[0, 0], [4, 0], [5, 1], [4, 2], [0, 2], [-1, 1]];
	const chevron: LayoutVec2[] = [[0, 0], [2, 1], [4, 0], [4, 3], [0, 3]];
	const notch: LayoutVec2[] = [[0, 0], [6, 0], [6, 4], [4, 4], [4, 2], [2, 2], [2, 4], [0, 4]];
	const shift = (points: LayoutVec2[], dx: number, dz: number): LayoutVec2[] =>
		points.map(([x, z]) => [x + dx, z + dz]);
	const cases: [string, LayoutVec2[], LayoutRegionForm][] = [
		...[1e-7, -1e-7, 1e-9, 1e-12, 1e-15, 0].map(
			(offset): [string, LayoutVec2[], LayoutRegionForm] => [
				`triangle apex ${offset} off the ridge`,
				triangle,
				{ kind: 'gable', rise: 1, azimuth: 0, ridgeOffset: offset }
			]
		),
		['hexagon vertices on a pi/2 ridge', hexagon, { kind: 'gable', rise: 1, azimuth: Math.PI / 2, ridgeOffset: 0 }],
		[
			'translated hexagon on a pi/2 ridge',
			shift(hexagon, 1e5, 3e5),
			{ kind: 'gable', rise: 1, azimuth: Math.PI / 2, ridgeOffset: 0 }
		],
		['chevron pinch on the ridge', chevron, { kind: 'gable', rise: 1, azimuth: Math.PI / 2, ridgeOffset: -0.5 }],
		[
			'chevron pinch 1e-9 off the ridge',
			chevron,
			{ kind: 'gable', rise: 1, azimuth: Math.PI / 2, ridgeOffset: -0.5 + 1e-9 }
		],
		['notch edge on the ridge', notch, { kind: 'gable', rise: 1, azimuth: Math.PI / 2, ridgeOffset: 0 }],
		['notch under an oblique ridge', notch, { kind: 'gable', rise: 1, azimuth: (3 * Math.PI) / 4, ridgeOffset: 0 }]
	];
	for (const [name, footprint, form] of cases) {
		it(`stays on the evaluator and exactly watertight: ${name}`, () => {
			const { document, regionId } = roofDocument(footprint, form);
			const region = regionOf(compile(document), regionId);
			expectWatertight(region.faces);
			// A sliver face 1e-7 wide makes a plane fit ill-conditioned, so each
			// vertex is checked against the shared evaluator instead.
			const factsValue: RegionFormFacts = { role: 'overhead', form, footprint, datumY: 3, thickness: 0.2 };
			for (const face of region.faces) {
				if (face.surface === 'edge') continue;
				for (const [x, y, z] of face.polygon) {
					const expected =
						face.surface === 'top' ? regionTopAt(factsValue, [x, z]) : regionUndersideAt(factsValue, [x, z]);
					expect(Math.abs(y - expected), `${face.surface} at ${x},${z}`).toBeLessThan(1e-9);
				}
			}
		});
	}
});

describe('V3a — flat compilation is unchanged', () => {
	it('emits the exact pre-V3a top, underside and edge faces in order', () => {
		const { document, regionId } = roofDocument(
			RECT,
			{ kind: 'flat' },
			{ role: 'floor', elevation: 0.4, thickness: 0.2 }
		);
		const region = regionOf(compile(document), regionId);
		expect(region.bottomY).toBe(0.2);
		expect(region.topY).toBe(0.4);
		expect(region.datumY).toBe(0.4);
		expect(region.thickness).toBe(0.2);
		expect(region.faces.map((face) => face.surface)).toEqual([
			'top',
			'underside',
			'edge',
			'edge',
			'edge',
			'edge'
		]);
		expect(region.faces[0]).toEqual({
			surface: 'top',
			polygon: [
				[0, 0.4, 6],
				[8, 0.4, 6],
				[8, 0.4, 0],
				[0, 0.4, 0]
			],
			normal: [0, 1, 0]
		});
		expect(region.faces[1]).toEqual({
			surface: 'underside',
			polygon: [
				[0, 0.2, 0],
				[8, 0.2, 0],
				[8, 0.2, 6],
				[0, 0.2, 6]
			],
			normal: [0, -1, 0]
		});
		expect(region.faces[2]).toEqual({
			surface: 'edge',
			polygon: [
				[0, 0.2, 0],
				[0, 0.4, 0],
				[8, 0.4, 0],
				[8, 0.2, 0]
			],
			normal: [0, 0, -1]
		});
		expectWatertight(region.faces);
	});

	it('keeps a flat U-shaped region byte-identical in face count and normals', () => {
		const { document, regionId } = roofDocument(U, { kind: 'flat' }, { role: 'floor', elevation: 0.2 });
		const region = regionOf(compile(document), regionId);
		expect(region.faces).toHaveLength(2 + U.length);
		expect(region.faces[0]!.normal).toEqual([0, 1, 0]);
		expect(region.faces[1]!.normal).toEqual([0, -1, 0]);
		expect(region.faces.slice(2).every((face) => face.normal[1] === 0)).toBe(true);
	});
});

describe('V3a — compiler retention and overhead support', () => {
	it('reuses and recomputes a sloped Region with the same cold result', () => {
		const { document, regionId } = roofDocument(RECT, {
			kind: 'gable',
			rise: 2,
			azimuth: 0,
			ridgeOffset: 0.5
		});
		const reuse = createLayoutCompileReuse();
		const cold = compileWallFirstLayoutGeometry(document, undefined, reuse);
		expect(cold.issues).toEqual([]);
		expect(reuse.counters.regionsEvaluated).toBe(1);
		const retained = compileWallFirstLayoutGeometry(document, undefined, reuse);
		expect(retained.issues).toEqual([]);
		expect(reuse.counters.regionsReused).toBe(1);
		expect(regionOf(retained.geometry, regionId)).toEqual(regionOf(cold.geometry, regionId));

		const changed = roofDocument(RECT, {
			kind: 'gable',
			rise: 3,
			azimuth: 0,
			ridgeOffset: 0.5
		});
		// The document object is new, but the retained unit is keyed by its
		// authored form; a changed rise must re-evaluate.
		const recomputed = compileWallFirstLayoutGeometry(changed.document, undefined, reuse);
		expect(recomputed.issues).toEqual([]);
		expect(reuse.counters.regionsEvaluated).toBe(1);
		expect(regionOf(recomputed.geometry, changed.regionId).topY).toBeCloseTo(6.2, 12);
	});

	it('reports the evaluated underside and true normal at each queried point', () => {
		const { document, regionId } = roofDocument(RECT, {
			kind: 'gable',
			rise: 2,
			azimuth: 0,
			ridgeOffset: 0
		});
		const geometry = compile(document);
		const snapshot = overheadSupportSnapshotOf(geometry);
		for (const [x, expected] of [
			[1, 3.5],
			[4, 5],
			[7, 3.5]
		] as const) {
			const result = queryOverheadSupports(snapshot, {
				generationId: 'v3a-generation',
				x,
				z: 3
			});
			expect(result.kind).toBe('candidates');
			if (result.kind !== 'candidates') continue;
			const regionCandidate = result.candidates.find((candidate) =>
				candidate.witnesses.some((witness) => witness.source.kind === 'region')
			)!;
			expect(regionCandidate.elevation).toBeCloseTo(expected, 12);
			const witness = regionCandidate.witnesses.find((entry) => entry.source.kind === 'region')!;
			expect(witness.source).toEqual({ kind: 'region', regionId });
			expect(witness.elevation).toBeCloseTo(expected, 12);
			expect(regionCandidate.downNormal[1]).toBeLessThan(0);
			if (x < 4) expect(regionCandidate.downNormal[0]).toBeGreaterThan(0);
			if (x > 4) expect(regionCandidate.downNormal[0]).toBeLessThan(0);
		}

		const above = queryOverheadSupports(snapshot, {
			generationId: 'v3a-generation',
			x: 1,
			z: 3,
			aboveElevation: 3.6
		});
		expect(above).toEqual({ kind: 'none' });
	});

	it('uses the conservative rise band for G5 overlap', () => {
		const roof = roofDocument(RECT, { kind: 'shed', rise: 2, azimuth: 0 });
		const low = planCreateRegion({
			baseline: roof.document,
			capture: captureFor('v3a-low-region'),
			intent: {
				role: 'floor',
				footprint: RECT,
				elevation: 2.9,
				thickness: 0.1
			}
		});
		expect(low.kind).toBe('success');
		const inside = planCreateRegion({
			baseline: roof.document,
			capture: captureFor('v3a-inside-region'),
			intent: {
				role: 'floor',
				footprint: RECT,
				elevation: 3.5,
				thickness: 0.1
			}
		});
		expect(inside.kind).toBe('rejected');
		if (inside.kind === 'rejected') expect(inside.rejection.code).toBe('region_overlap');
	});
});
