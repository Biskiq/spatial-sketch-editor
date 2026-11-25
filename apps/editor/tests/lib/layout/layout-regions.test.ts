import { describe, expect, it } from 'vitest';
import { compileWallFirstLayoutGeometryFresh, createLayoutCompileSession, type LayoutVec2 } from '@portfolio/layout-core/geometry';
import { createEmptyWallFirstLayoutDocument, planDeleteWall, planDissolveJunction, planExactJunctionMove, planWallChain, planWallSplit, validateWallFirstLayoutDocument, type LayoutRegion } from '@portfolio/layout-core/wall';
import { createPlanRetainer, evaluateLayoutPlan, type PlanParameters } from '@portfolio/layout-core/world';
import { withLayoutIdentity } from '@portfolio/layout-core/plan';
import outgoingLayout from './fixtures/layout-8-outgoing.json';
import { buildStarterEnclosureLayout } from '$lib/authoring/stage/starter-gallery';
import { buildRegionMeshGeometry, regionSurfaceOf } from '$lib/render/layout/region-mesh-builder';
import { Mesh, MeshBasicMaterial, Raycaster, Vector3 } from 'three';

const rectangle: LayoutVec2[] = [[1, -3], [3, -3], [3, -1], [1, -1]];
function slab(id: string, elevation: number, role: LayoutRegion['role'] = 'floor'): LayoutRegion {
	return {
		id, role, elevation, thickness: 0.2, footprint: { kind: 'polygon', points: structuredClone(rectangle) },
		form: { kind: 'flat' }, intendedGaps: []
	};
}

const parameters: PlanParameters = {
	cutHeightMeters: 1.2, depthMeters: 4, lateralSpanHalfWidthMeters: null,
	sourceKindFilter: null, reveal: []
};
const context = { generationId: 'current', datumMeters: 0, target: [0, 0] as LayoutVec2 };

describe('Layout 9 horizontal regions', () => {
	it.each([
		['region_self_intersection', [[0, 0], [2, 2], [0, 2], [2, 0]]],
		['region_nonpositive_area', [[0, 0], [0, 2], [2, 0]]],
		['region_repeated_vertex', [[0, 0], [2, 0], [2, 2], [2, 0]]],
		['dimension_out_of_range', [[0, 0], [1001, 0], [1, 1]]]
	] as const)('reports %s on both admission and cold compile', (code, points) => {
		const region = slab('platform', 0);
		region.footprint.points = points.map(([x, z]) => [x, z]);
		const document = { ...createEmptyWallFirstLayoutDocument(), regions: [region] };
		expect(validateWallFirstLayoutDocument(document)).toMatchObject({ success: false, issues: [{ code }] });
		expect(compileWallFirstLayoutGeometryFresh(document).issues).toMatchObject([{ code }]);
	});

	it('admits stacked and touching slabs, refuses interior volume overlap, and assigns H references', () => {
		const translated = slab('touching', 0);
		translated.footprint.points = rectangle.map(([x, z]) => [x + 2, z]);
		const document = withLayoutIdentity({
			...createEmptyWallFirstLayoutDocument(),
			regions: [slab('lower', 0), slab('upper', 0.2), translated]
		});
		expect(document.identity?.regions.lower).toMatch(/^H-/);
		expect(validateWallFirstLayoutDocument(document).success).toBe(true);
		const overlapping = { ...document, regions: [slab('lower', 0), slab('upper', 0.19)] };
		expect(validateWallFirstLayoutDocument(overlapping)).toMatchObject({
			success: false, issues: [{ code: 'region_overlap' }]
		});
	});

	it('strictly refuses the outgoing format and both retired Room keys', () => {
		const document = buildStarterEnclosureLayout();
		expect(validateWallFirstLayoutDocument(outgoingLayout)).toMatchObject({
			success: false, issues: [{ path: '$.formatVersion', code: 'unsupported_format_version' }]
		});
		for (const key of ['floorThickness', 'ceilingThickness']) {
			expect(validateWallFirstLayoutDocument({ ...document, rooms: [{ ...document.rooms[0], [key]: 0.2 }] })).toMatchObject({
				success: false, issues: [{ path: `$.rooms[0].${key}`, code: 'unknown_key' }]
			});
		}
	});

	it('retains per-slab geometry and carries the slab unit through a certified Junction move', () => {
		const baseline = buildStarterEnclosureLayout();
		const source = { ...baseline, regions: [slab('floor', 0), slab('canopy', 3.4, 'overhead')] };
		source.regions[0]!.id = 'terrace';
		const session = createLayoutCompileSession();
		const initial = session.compile(source).geometry;
		expect(initial.bounds!.min[1]).toBe(-0.2);
		expect(initial.bounds!.max[1]).toBeCloseTo(3.6);
		expect(initial.queries.polygons.slice(-2).map(({ kind }) => kind)).toEqual(['region-top', 'region-underside']);
		expect(initial.queries.aabbs.slice(-4).map(({ kind }) => kind)).toEqual(['region', 'region', 'floor', 'document']);

		const moved = { ...source, regions: [{ ...source.regions[0]!, elevation: 0.6 }, source.regions[1]!] };
		const retained = session.compile(moved).geometry;
		expect(session.stats()).toMatchObject({ regionsEvaluated: 1, regionsReused: 1, wallsEvaluated: 0, roomsEvaluated: 0 });
		expect(retained.regions[1]).toBe(initial.regions[1]);
		expect(retained.regions[0]!.id).toBe(initial.regions[0]!.id);
		expect(retained).toEqual(compileWallFirstLayoutGeometryFresh(moved).geometry);
		const plan = planExactJunctionMove(moved, moved.junctions[0]!.id, [-0.1, -4]);
		expect(plan.kind).toBe('success');
		if (plan.kind !== 'success') return;
		const delta = session.compile(plan.document).geometry;
		expect(session.stats()).toMatchObject({ regionsEvaluated: 0, regionsReused: 2 });
		expect(delta.regions).toBe(retained.regions);
		expect(delta).toEqual(compileWallFirstLayoutGeometryFresh(plan.document).geometry);
		const retainer = createPlanRetainer();
		retainer.evaluate(retained, parameters, context);
		expect(retainer.evaluate(delta, parameters, context)).toEqual(evaluateLayoutPlan(delta, parameters, context));
	});

	it('gives Plan section ink and outline picks the same stable face identities', () => {
		const source = { ...createEmptyWallFirstLayoutDocument(), regions: [slab('platform', 1.4), slab('canopy', 2.4, 'overhead')] };
		const geometry = compileWallFirstLayoutGeometryFresh(source).geometry;
		const output = evaluateLayoutPlan(geometry, { ...parameters, cutHeightMeters: 1.3 }, context);
		expect(output.kind).toBe('evaluated');
		if (output.kind !== 'evaluated') return;
		expect(output.plan.streams.cut).toMatchObject([{
			ref: { sourceId: 'platform', subRef: { kind: 'component', componentId: 'edge' } },
			geometry: { kind: 'polygon' }, elevationMeters: 1.3
		}]);
		expect(output.plan.streams.hidden).toMatchObject([{
			ref: { sourceId: 'canopy', subRef: { kind: 'component', componentId: 'underside' } },
			geometry: { kind: 'polyline' }, elevationMeters: 2.4
		}]);
		const tangent = evaluateLayoutPlan(geometry, { ...parameters, cutHeightMeters: 1.4 }, context);
		expect(tangent.kind === 'evaluated' && tangent.plan.streams.cut).toEqual([]);
	});

	it('builds both pickable sides of a concave solid with face attribution', () => {
		const region = slab('platform', 1);
		region.footprint.points = [[0, 0], [3, 0], [3, 1], [1, 1], [1, 3], [0, 3]];
		const { geometry } = compileWallFirstLayoutGeometryFresh({ ...createEmptyWallFirstLayoutDocument(), regions: [region] });
		const geometryBuffer = buildRegionMeshGeometry(geometry.regions[0]!);
		const material = new MeshBasicMaterial();
		const mesh = new Mesh(geometryBuffer, [material, material, material]);
		for (const [origin, direction, face] of [
			[[0.5, 2, 2], [0, -1, 0], 'top'],
			[[0.5, 0, 2], [0, 1, 0], 'underside'],
			[[-1, 0.9, 2], [1, 0, 0], 'edge']
		] as const) {
			const hit = new Raycaster(new Vector3(...origin), new Vector3(...direction)).intersectObject(mesh)[0];
			expect(hit?.faceIndex).not.toBeUndefined();
			expect(regionSurfaceOf(geometryBuffer, hit!.faceIndex!)).toBe(face);
		}
		expect(new Raycaster(new Vector3(2, 2, 2), new Vector3(0, -1, 0)).intersectObject(mesh)).toEqual([]);
		geometryBuffer.dispose();
		material.dispose();
	});

	it('fans out splits, unions a dissolve and drops retired Wall intent', () => {
		const baseline = createEmptyWallFirstLayoutDocument();
		const chain = planWallChain({
			baseline, points: [[0, 0], [6, 0]], close: false, capture: { nonce: 'region-lineage' }, levelId: baseline.floor.id
		});
		if (chain.kind !== 'success') throw new Error(chain.rejection.message);
		const wall = chain.document.walls[0]!;
		const source = { ...chain.document, regions: [{ ...slab('canopy', 2, 'overhead'), intendedGaps: [wall.id] }] };
		const split = planWallSplit(source, wall.id, 3, {
			nextWallId: () => 'wall-split', nextJunctionId: () => 'junction-split'
		});
		if (split.kind !== 'success') throw new Error('Split refused');
		expect(split.document.regions[0]!.intendedGaps).toEqual([wall.id, 'wall-split'].sort());
		const join = planDissolveJunction(split.document, split.junctionId, { nonce: 'region-join' }, source.floor.id);
		if (join.kind !== 'success') throw new Error(join.rejection.message);
		expect(join.document.regions[0]!.intendedGaps).toEqual([join.document.walls[0]!.id]);
		const removal = planDeleteWall(join.document, join.document.walls[0]!.id, { nonce: 'region-erase' }, source.floor.id);
		if (removal.kind !== 'success') throw new Error(removal.rejection.message);
		expect(removal.document.regions[0]!.intendedGaps).toEqual([]);
		expect(validateWallFirstLayoutDocument(removal.document).success).toBe(true);
	});
});
