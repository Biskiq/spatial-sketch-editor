/**
 * T1 V3b — certified vertical extrema of a Wall strip under a sloped Region
 * (§7.3, T-R9).
 *
 * The certifier enumerates a finite candidate set that is complete for the
 * ruled compiled strip. These tests hold it against an independent dense
 * forward reference over the same strip — a `(u, v)` grid per cell evaluated
 * through the public evaluators and an inclusive point-in-footprint test — and
 * show that compiled-vertex sampling alone misses the interior extremum a
 * curved Wall produces where a footprint edge crosses it obliquely.
 */
import { describe, expect, it } from 'vitest';
import {
	compileWallFirstLayoutGeometryFresh,
	type CompiledLayoutGeometry,
	type LayoutVec2
} from '@portfolio/layout-core/geometry';
import {
	createEmptyWallFirstLayoutDocument,
	type LayoutDocumentWallFirst,
	type LayoutRegionForm,
	type LayoutWall,
	type LayoutWallTop
} from '@portfolio/layout-core/wall';
import {
	compiledWallStrip,
	planCreateRegion,
	planFitRegionToWalls,
	regionWallRelations,
	REGION_WALL_EXTREMA_TOLERANCE_METERS,
	REGION_WALL_RELATION_EPSILON,
	regionUndersideAt,
	regionWallVerticalExtrema,
	type RegionFormFacts,
	type WallStripPiece
} from '@portfolio/layout-core/room';
import { legJoinsByWall } from '../src/wall/junction/joins';
import { captureFor } from './__fixtures__/layout-id-capture';

const LEVEL: LayoutWallTop = { kind: 'level' };

function wall(id: string, start: string, end: string, overrides: Partial<LayoutWall> = {}): LayoutWall {
	return {
		id,
		startJunctionId: start,
		endJunctionId: end,
		thickness: 0.4,
		height: 2.4,
		top: LEVEL,
		centerline: { kind: 'line' },
		...overrides
	};
}

function documentOf(points: Record<string, LayoutVec2>, walls: readonly LayoutWall[]): LayoutDocumentWallFirst {
	const document = createEmptyWallFirstLayoutDocument();
	for (const [id, point] of Object.entries(points)) document.junctions.push({ id, point });
	document.walls.push(...walls);
	return document;
}

function compile(document: LayoutDocumentWallFirst): CompiledLayoutGeometry {
	const result = compileWallFirstLayoutGeometryFresh(document);
	expect(result.issues.filter((issue) => issue.severity !== 'warning')).toEqual([]);
	return result.geometry;
}

function facts(form: LayoutRegionForm, footprint: LayoutVec2[], eave: number, thickness: number): RegionFormFacts {
	return { role: 'overhead', form, footprint, datumY: eave, thickness };
}

function stripOf(geometry: CompiledLayoutGeometry, wallId: string): WallStripPiece[] {
	const compiledWall = geometry.walls.find((entry) => entry.wallId === wallId)!;
	const ends = legJoinsByWall(geometry.junctions).get(wallId);
	return compiledWallStrip(compiledWall, ends, geometry.floors[0]!.elevation);
}

function insideInclusive(polygon: readonly LayoutVec2[], point: LayoutVec2, tolerance: number): boolean {
	let inside = false;
	for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
		const [xi, zi] = polygon[i]!;
		const [xj, zj] = polygon[j]!;
		const dx = xi - xj;
		const dz = zi - zj;
		const squared = dx * dx + dz * dz;
		const t = squared > 0 ? Math.max(0, Math.min(1, ((point[0] - xj) * dx + (point[1] - zj) * dz) / squared)) : 0;
		if (Math.hypot(point[0] - (xj + dx * t), point[1] - (zj + dz * t)) <= tolerance) return true;
		if (zi > point[1] !== zj > point[1] && point[0] < ((xj - xi) * (point[1] - zi)) / (zj - zi) + xi) inside = !inside;
	}
	return inside;
}

/** Independent dense forward reference: a `(u, v)` grid per cell, filtered by footprint. */
function denseReference(roof: RegionFormFacts, pieces: readonly WallStripPiece[], per = 240) {
	let min = Infinity;
	let max = -Infinity;
	const visit = (point: LayoutVec2, top: number) => {
		if (!insideInclusive(roof.footprint, point, 0)) return;
		const clearance = regionUndersideAt(roof, point) - top;
		min = Math.min(min, clearance);
		max = Math.max(max, clearance);
	};
	for (const piece of pieces) {
		if (piece.kind === 'patch') {
			// Fan-triangulate the convex patch and sample barycentrically.
			const [origin, ...rest] = piece.polygon;
			for (let t = 0; t + 1 < rest.length; t += 1) {
				const b = rest[t]!;
				const c = rest[t + 1]!;
				for (let i = 0; i <= 60; i += 1) {
					for (let j = 0; i + j <= 60; j += 1) {
						const wb = i / 60;
						const wc = j / 60;
						const wa = 1 - wb - wc;
						visit([origin![0] * wa + b[0] * wb + c[0] * wc, origin![1] * wa + b[1] * wb + c[1] * wc], piece.topY);
					}
				}
			}
			continue;
		}
		for (let i = 0; i <= per; i += 1) {
			const u = i / per;
			const front: LayoutVec2 = [piece.fa[0] + (piece.fb[0] - piece.fa[0]) * u, piece.fa[1] + (piece.fb[1] - piece.fa[1]) * u];
			const back: LayoutVec2 = [piece.ba[0] + (piece.bb[0] - piece.ba[0]) * u, piece.ba[1] + (piece.bb[1] - piece.ba[1]) * u];
			const top = piece.topA + (piece.topB - piece.topA) * u;
			for (let k = 0; k <= 24; k += 1) {
				const v = k / 24;
				visit([front[0] + (back[0] - front[0]) * v, front[1] + (back[1] - front[1]) * v], top);
			}
		}
	}
	return { min, max };
}

/** Compiled-vertex sampling: strip corners inside the footprint only. */
function vertexOnly(roof: RegionFormFacts, pieces: readonly WallStripPiece[]) {
	let min = Infinity;
	let max = -Infinity;
	for (const piece of pieces) {
		if (piece.kind !== 'cell') continue;
		for (const [point, top] of [
			[piece.fa, piece.topA],
			[piece.ba, piece.topA],
			[piece.fb, piece.topB],
			[piece.bb, piece.topB]
		] as const) {
			if (!insideInclusive(roof.footprint, point, 0)) continue;
			const clearance = regionUndersideAt(roof, point) - top;
			min = Math.min(min, clearance);
			max = Math.max(max, clearance);
		}
	}
	return { min, max };
}

/** A sloped arc: a cubic chain bulging toward +Z with a 0.8 m end-to-end top rise. */
function curvedSlopeDocument(): LayoutDocumentWallFirst {
	return documentOf({ a: [0, 0], b: [10, 0] }, [
		wall('w', 'a', 'b', {
			top: { kind: 'slope', startRise: 0, endRise: 0.8 },
			centerline: {
				kind: 'cubic-chain',
				knots: [{ id: 'k1', point: [5, 3] }],
				spans: [
					{ handleOut: [2, 0], handleIn: [3, 3] },
					{ handleOut: [7, 3], handleIn: [8, 0] }
				]
			}
		})
	]);
}

describe('T-R9 — certified extrema on a curved sloped Wall', () => {
	// The footprint's left edge crosses the arc obliquely between samples.
	const footprint: LayoutVec2[] = [[1.3, -2], [12, -2], [12, 6], [-0.4, 6]];
	const shed: LayoutRegionForm = { kind: 'shed', rise: 2, azimuth: 0.35 };
	const roof = facts(shed, footprint, 2.6, 0.3);

	it('agrees with a dense independent reference within the stated tolerance', () => {
		const pieces = stripOf(compile(curvedSlopeDocument()), 'w');
		const certified = regionWallVerticalExtrema(roof, pieces, 'w', REGION_WALL_RELATION_EPSILON);
		expect(certified.kind).toBe('certified');
		if (certified.kind !== 'certified') return;
		const reference = denseReference(roof, pieces);
		const vertices = vertexOnly(roof, pieces);
		// Conservative: no reference point lies outside the certified bounds.
		expect(reference.min).toBeGreaterThanOrEqual(certified.contact.clearance - REGION_WALL_EXTREMA_TOLERANCE_METERS);
		expect(reference.max).toBeLessThanOrEqual(certified.gap.clearance + REGION_WALL_EXTREMA_TOLERANCE_METERS);
		// Tight: the dense reference approaches the certified values.
		expect(certified.gap.clearance - reference.max).toBeLessThan(2e-3);
		expect(reference.min - certified.contact.clearance).toBeLessThan(2e-3);
		// Vertex-only sampling misses the interior contact by millimetres.
		expect(vertices.min - certified.contact.clearance).toBeGreaterThan(5e-3);
	});
});

describe('T-R9 — a crossing only the certified extrema see', () => {
	// Certified contact on this strip is 0.18940 m at eave 2.6 and vertex-only
	// 0.19720 m. Lowering the eave by 0.4933 m makes the certified overrun
	// +3.9 mm, while vertex-only sampling would read −3.9 mm and no crossing.
	const footprint: LayoutVec2[] = [[1.3, -2], [12, -2], [12, 6], [-0.4, 6]];
	const shed: LayoutRegionForm = { kind: 'shed', rise: 2, azimuth: 0.35 };

	function covered(eave: number) {
		const created = planCreateRegion({
			baseline: curvedSlopeDocument(),
			capture: captureFor('v3b-extrema-crossing'),
			intent: { role: 'overhead', footprint, elevation: eave, thickness: 0.3 }
		});
		if (created.kind !== 'success') throw new Error(created.rejection.message);
		const document = structuredClone(created.document) as LayoutDocumentWallFirst;
		document.regions[0]!.form = shed;
		return { document, regionId: created.regionId };
	}

	it('reads crosses where vertex-only sampling would not', () => {
		const eave = 2.6 - 0.4933;
		const { document } = covered(eave);
		const geometry = compile(document);
		const pieces = stripOf(geometry, 'w');
		const roof = facts(shed, footprint, eave, 0.3);
		const vertices = vertexOnly(roof, pieces);
		expect(-vertices.min - 0.3).toBeLessThan(-1e-3);
		const relations = regionWallRelations(geometry, document.regions[0]!);
		if (relations.kind !== 'relations') throw new Error(JSON.stringify(relations));
		expect(relations.relations).toHaveLength(1);
		expect(relations.relations[0]).toMatchObject({ wallId: 'w', planClass: 'through', reading: 'crosses' });
	});

	it('fits the roof to the certified first contact, so the Wall no longer crosses', () => {
		const { document, regionId } = covered(2.6 - 0.4933);
		const plan = planFitRegionToWalls(document, compile(document), regionId, ['w']);
		if (plan.kind !== 'success') throw new Error(plan.rejection.message);
		expect(plan.document.regions[0]!.elevation).toBeCloseTo(2.6 - 0.1894008527, 9);
		const geometry = compile(plan.document);
		const extrema = regionWallVerticalExtrema(
			facts(shed, footprint, plan.document.regions[0]!.elevation, 0.3),
			stripOf(geometry, 'w'),
			'w',
			REGION_WALL_RELATION_EPSILON
		);
		expect(extrema.kind).toBe('certified');
		if (extrema.kind === 'certified') expect(Math.abs(extrema.contact.clearance)).toBeLessThan(1e-9);
		const relations = regionWallRelations(geometry, plan.document.regions[0]!);
		if (relations.kind !== 'relations') throw new Error(JSON.stringify(relations));
		expect(relations.relations[0]!.reading).toBe('gap');
	});
});

describe('T-R9 — resolved ends, mitres and bevels', () => {
	const shed: LayoutRegionForm = { kind: 'shed', rise: 3, azimuth: -0.6 };
	const footprint: LayoutVec2[] = [[-3, -3], [12, -3], [12, 9], [-3, 9]];
	const roof = facts(shed, footprint, 3.2, 0.3);

	const corners: [string, Record<string, LayoutVec2>][] = [
		['a right-angle mitre', { a: [0, 0], b: [6, 0], c: [6, 5] }],
		['an acute bevel', { a: [0, 0], b: [8, 0], c: [1, 1.6] }]
	];
	for (const [name, points] of corners) {
		it(`agrees with the dense reference on ${name}, including its junction pieces`, () => {
			const document = documentOf(points, [
				wall('ab', 'a', 'b', { top: { kind: 'slope', startRise: 0, endRise: 0.5 } }),
				wall('bc', 'b', 'c', { height: 2.9 })
			]);
			const geometry = compile(document);
			let patches = 0;
			for (const wallId of ['ab', 'bc']) {
				const pieces = stripOf(geometry, wallId);
				patches += pieces.filter((piece) => piece.kind === 'patch').length;
				const certified = regionWallVerticalExtrema(roof, pieces, wallId, REGION_WALL_RELATION_EPSILON);
				expect(certified.kind).toBe('certified');
				if (certified.kind !== 'certified') continue;
				const reference = denseReference(roof, pieces);
				expect(reference.min).toBeGreaterThanOrEqual(certified.contact.clearance - REGION_WALL_EXTREMA_TOLERANCE_METERS);
				expect(reference.max).toBeLessThanOrEqual(certified.gap.clearance + REGION_WALL_EXTREMA_TOLERANCE_METERS);
				expect(certified.gap.clearance - reference.max).toBeLessThan(1e-6);
				expect(reference.min - certified.contact.clearance).toBeLessThan(1e-6);
			}
			// The mitre resolves into its cells; the bevel adds junction wedges.
			expect(patches > 0).toBe(name.includes('bevel'));
		});
	}
});

describe('T-R9 — a Wall-top knot inside the mitre reach', () => {
	it('certifies an apex 0.05 m from a right-angle corner against the dense reference', () => {
		const document = documentOf({ a: [0, 0], b: [6, 0], c: [6, 5] }, [
			wall('ab', 'a', 'b', {
				thickness: 0.2,
				top: { kind: 'gable', startRise: 0, endRise: 0, apexRise: 0.6, apexOffset: 5.95 }
			}),
			wall('bc', 'b', 'c', { thickness: 0.2 })
		]);
		const roof = facts({ kind: 'shed', rise: 2, azimuth: 0.4 }, [[-2, -2], [9, -2], [9, 8], [-2, 8]], 3.4, 0.3);
		const pieces = stripOf(compile(document), 'ab');
		const certified = regionWallVerticalExtrema(roof, pieces, 'ab', REGION_WALL_RELATION_EPSILON);
		expect(certified.kind).toBe('certified');
		if (certified.kind !== 'certified') return;
		const reference = denseReference(roof, pieces);
		expect(reference.min).toBeGreaterThanOrEqual(certified.contact.clearance - REGION_WALL_EXTREMA_TOLERANCE_METERS);
		expect(reference.max).toBeLessThanOrEqual(certified.gap.clearance + REGION_WALL_EXTREMA_TOLERANCE_METERS);
		expect(reference.min - certified.contact.clearance).toBeLessThan(1e-6);
		expect(certified.gap.clearance - reference.max).toBeLessThan(1e-6);
	});
});

describe('T-R9 — no proof, no reading', () => {
	it('refuses to certify a folded cell', () => {
		const roof = facts({ kind: 'shed', rise: 1, azimuth: 0 }, [[-5, -5], [5, -5], [5, 5], [-5, 5]], 3, 0.3);
		const folded: WallStripPiece = {
			kind: 'cell',
			fa: [0, 0],
			fb: [1, 1],
			ba: [1, 0],
			bb: [0, 1],
			topA: 2.4,
			topB: 2.4,
			stationA: 0,
			stationB: 1
		};
		expect(regionWallVerticalExtrema(roof, [folded], 'w', REGION_WALL_RELATION_EPSILON).kind).toBe('uncertified');
	});
});
