import { sameAuthored, type LayoutCompileReuse } from '../geometry/reuse';
import type { Vec3 } from '../kernel/types';
import { cacheKeyOf } from '../geometry/keys';
import { polygonBounds2 } from '../geometry/queries';
import {
	geometryId,
	type CompiledQueryAabb,
	type CompiledQueryPolygon,
	type CompiledRegion,
	type LayoutBounds3,
	type LayoutGeometryIssue,
} from '../geometry/types';
import { regionGeometryIssues, regionVerticalBand } from './region-validation';
import { compileRegionFormFaces } from './region/form-geometry';
import type { LayoutDocumentWallFirst, LayoutRegion } from '../wall/types';

export type RetainedRegion = {
	authored: readonly unknown[];
	compiled: CompiledRegion;
	polygon: CompiledQueryPolygon;
	aabb: CompiledQueryAabb;
};

export type CompiledRegionUnit = {
	regions: CompiledRegion[];
	polygons: CompiledQueryPolygon[];
	aabbs: CompiledQueryAabb[];
	bounds3: LayoutBounds3 | null;
	issues: LayoutGeometryIssue[];
};

export function regionUnitBounds(regions: readonly CompiledRegion[]): LayoutBounds3 | null {
	if (!regions.length) return null;
	const min: Vec3 = [Infinity, Infinity, Infinity];
	const max: Vec3 = [-Infinity, -Infinity, -Infinity];
	for (const { bounds3 } of regions) {
		for (const axis of [0, 1, 2] as const) {
			min[axis] = Math.min(min[axis], bounds3.min[axis]);
			max[axis] = Math.max(max[axis], bounds3.max[axis]);
		}
	}
	return { min, max };
}

/**
 * The flat faces are deliberately built here, in the format-11 order and
 * winding, rather than through the form compiler. T-R1 requires every flat
 * fixture to compile to the same faces before and after V3a: a flat Region is
 * never a zero-rise shed.
 */
function flatRegionFaces(
	region: LayoutRegion,
	floor: LayoutDocumentWallFirst['floor'],
): { faces: CompiledRegion['faces']; bottomY: number; topY: number } {
	const footprint = region.footprint.points;
	const [bottomY, topY] = regionVerticalBand(region, floor.elevation);
	const top = footprint.map(([x, z]): Vec3 => [x, topY, z]);
	const bottom = footprint.map(([x, z]): Vec3 => [x, bottomY, z]);
	const faces: CompiledRegion['faces'] = [
		{ surface: 'top', polygon: [...top].reverse(), normal: [0, 1, 0] },
		{ surface: 'underside', polygon: bottom, normal: [0, -1, 0] },
	];
	for (let i = 0; i < footprint.length; i++) {
		const j = (i + 1) % footprint.length;
		const dx = footprint[j]![0] - footprint[i]![0];
		const dz = footprint[j]![1] - footprint[i]![1];
		const length = Math.hypot(dx, dz);
		faces.push({
			surface: 'edge',
			polygon: [bottom[i]!, top[i]!, top[j]!, bottom[j]!],
			normal: [dz / length, 0, -dx / length],
		});
	}
	return { faces, bottomY, topY };
}

function compileRegion(
	region: LayoutRegion,
	floor: LayoutDocumentWallFirst['floor'],
	authored: readonly unknown[],
	index: number,
): RetainedRegion | { readonly issue: LayoutGeometryIssue } {
	const { id: regionId, role } = region;
	const footprint = region.footprint.points.map(([x, z]): [number, number] => [x, z]);
	const datumY = floor.elevation + region.elevation;
	const compiledForm =
		region.form.kind === 'flat'
			? { kind: 'flat' as const, ...flatRegionFaces(region, floor) }
			: compileRegionFormFaces(
					{
						role,
						form: region.form,
						thickness: region.thickness,
						footprint: region.footprint.points,
					},
					datumY,
				);
	if (compiledForm.kind === 'failed') {
		return {
			issue: {
				path: `$.regions[${index}].form`,
				code: 'region_form_geometry_failed',
				message: `Region '${regionId}' could not be compiled: ${compiledForm.message}`,
				targetId: regionId,
			},
		};
	}
	const { faces, bottomY, topY } = compiledForm;
	const bounds2 = polygonBounds2(footprint)!;
	const bounds3: LayoutBounds3 = {
		min: [bounds2.min[0], bottomY, bounds2.min[1]],
		max: [bounds2.max[0], topY, bounds2.max[1]],
	};
	const parts = ['region', floor.id, regionId];
	const cacheKey = cacheKeyOf([...parts, ...authored]);
	const compiled: CompiledRegion = {
		id: geometryId(parts),
		cacheKey,
		regionId,
		role,
		footprint,
		form: region.form,
		datumY,
		thickness: region.thickness,
		bottomY,
		topY,
		faces,
		bounds2,
		bounds3,
	};
	const kind = role === 'floor' ? 'region-top' : 'region-underside';
	return {
		authored,
		compiled,
		polygon: {
			id: geometryId([kind, floor.id, regionId]),
			cacheKey,
			kind,
			polygon: footprint,
			aabb: bounds2,
			sourceId: regionId,
			floorId: floor.id,
			elevation: role === 'floor' ? topY : bottomY,
		},
		aabb: {
			id: compiled.id,
			cacheKey,
			kind: 'region',
			aabb: bounds2,
			bounds3,
			sourceId: regionId,
			floorId: floor.id,
		},
	};
}

export function compileRegions(
	document: LayoutDocumentWallFirst,
	reuse?: LayoutCompileReuse,
): CompiledRegionUnit {
	const regions: CompiledRegion[] = [];
	const polygons: CompiledQueryPolygon[] = [];
	const aabbs: CompiledQueryAabb[] = [];
	if (document.regions.length === 0) {
		reuse?.regions.clear();
		return { regions, polygons, aabbs, bounds3: null, issues: [] };
	}
	const issues = regionGeometryIssues(document.regions);
	if (issues.length) return { regions, polygons, aabbs, bounds3: null, issues };
	const live = new Set<string>();
	for (const [index, region] of document.regions.entries()) {
		const authored = [
			document.floor.id,
			document.floor.elevation,
			region.role,
			region.footprint,
			region.elevation,
			region.thickness,
			region.form,
		];
		let retained = reuse?.regions.get(region.id);
		if (retained && sameAuthored(retained.authored, authored)) {
			reuse!.counters.regionsReused++;
		} else {
			const compiled = compileRegion(region, document.floor, authored, index);
			if ('issue' in compiled) {
				return { regions: [], polygons: [], aabbs: [], bounds3: null, issues: [compiled.issue] };
			}
			retained = compiled;
			if (reuse) {
				reuse.regions.set(region.id, retained);
				reuse.counters.regionsEvaluated++;
				reuse.counters.entities++;
			}
		}
		live.add(region.id);
		regions.push(retained.compiled);
		polygons.push(retained.polygon);
		aabbs.push(retained.aabb);
	}
	if (reuse) for (const id of reuse.regions.keys()) if (!live.has(id)) reuse.regions.delete(id);
	return { regions, polygons, aabbs, bounds3: regionUnitBounds(regions), issues };
}
