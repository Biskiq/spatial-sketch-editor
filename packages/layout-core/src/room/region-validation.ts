import type { LayoutVec2 } from '../geometry/coordinates';
import { polygonsShareInteriorArea } from '../geometry/face-extraction';
import { MAX_LAYOUT_DIMENSION_METERS } from '../geometry/limits';
import { LAYOUT_GEOMETRY_EPSILON } from '../geometry/openings';
import type { LayoutDocumentIssue } from '../plan/issue';
import { orientXZ } from '../geometry/robust-orientation';
import { spaceOutlineSelfIntersects, spaceOutlineSignedArea } from './space-outline';
import type { LayoutRegion } from '../wall/types';
import { normalizeRegionAzimuth, regionFormProfile } from './region/form';

/**
 * Region admission predicates shared by the canonical reader and the compiler.
 *
 * This module deliberately imports no document codec: `layout-region.ts` owns the
 * planners and imports the codec, while the codec imports these predicates. One
 * direction keeps the module graph acyclic at runtime.
 */

export const MAX_LAYOUT_REGION_POINTS = 1024;
export const LAYOUT_SLICE_CONTACT_METERS = 1e-4;

/**
 * World-relative vertical band of one region.
 *
 * `datum` is the Floor elevation. A floor region's top is its datum face and its
 * body extends down; an overhead region's underside is its datum face and its
 * body extends up (§5.1). A sloped overhead region's band is the conservative
 * `[eave, eave + rise + thickness]` (§3.2), which is what G5 overlaps compare.
 */
export function regionVerticalBand(region: LayoutRegion, datum: number): [number, number] {
	const face = datum + region.elevation;
	if (region.role === 'floor') return [face - region.thickness, face];
	const rise = region.form.kind === 'flat' ? 0 : region.form.rise;
	return [face, face + rise + region.thickness];
}

export function regionFootprintBounds(points: readonly LayoutVec2[]) {
	const xs = points.map(([x]) => x);
	const zs = points.map(([, z]) => z);
	return {
		minX: Math.min(...xs),
		maxX: Math.max(...xs),
		minZ: Math.min(...zs),
		maxZ: Math.max(...zs),
	};
}

/** G1 and G5 for a whole region collection, in document order. */
export function regionGeometryIssues(regions: readonly LayoutRegion[]): LayoutDocumentIssue[] {
	const issues: LayoutDocumentIssue[] = [];
	const candidates: {
		region: LayoutRegion;
		index: number;
		band: [number, number];
		bounds: ReturnType<typeof regionFootprintBounds>;
	}[] = [];
	for (const [index, region] of regions.entries()) {
		const { points } = region.footprint;
		const path = `$.regions[${index}].footprint.points`;
		const reject = (code: string, message: string) => issues.push({ path, code, message });
		const form = region.form;
		const rejectForm = (code: string, message: string) =>
			issues.push({ path: `$.regions[${index}].form`, code, message });
		if (form === undefined || form === null || typeof form !== 'object') {
			rejectForm('invalid_value', 'Region form is required');
			continue;
		}
		// Read through an `unknown` view so a hand-built document with an
		// unrecognized kind is refused here as well as in the codec.
		const kind: unknown = (form as { kind?: unknown }).kind;
		if (kind !== 'flat' && kind !== 'shed' && kind !== 'gable') {
			rejectForm('invalid_value', `Unknown Region form '${String(kind)}'`);
			continue;
		}
		if (form.kind !== 'flat') {
			if (region.role !== 'overhead') {
				rejectForm(
					'region_form_requires_overhead',
					'A sloped Region form requires an overhead role',
				);
				continue;
			}
			if (!Number.isFinite(form.rise) || form.rise <= 0) {
				rejectForm(
					'region_form_rise_invalid',
					'Region form rise must be finite and greater than zero',
				);
				continue;
			}
			if (form.rise > MAX_LAYOUT_DIMENSION_METERS) {
				rejectForm('dimension_out_of_range', 'Region form rise is limited to 1000 m');
				continue;
			}
			if (!Number.isFinite(form.azimuth)) {
				rejectForm('region_form_azimuth_invalid', 'Region form azimuth must be finite');
				continue;
			}
			if (normalizeRegionAzimuth(form.azimuth) !== form.azimuth) {
				rejectForm('region_form_azimuth_invalid', 'Region form azimuth must be canonical');
				continue;
			}
			if (form.kind === 'gable' && !Number.isFinite(form.ridgeOffset)) {
				rejectForm('region_form_ridge_invalid', 'Region gable ridge offset must be finite');
				continue;
			}
			if (form.kind === 'gable') {
				const cosine = Math.cos(form.azimuth);
				const sine = Math.sin(form.azimuth);
				let min = Infinity;
				let max = -Infinity;
				for (const [x, z] of points) {
					const q = x * cosine + z * sine;
					if (q < min) min = q;
					if (q > max) max = q;
				}
				const half = (max - min) / 2;
				if (!(half > LAYOUT_GEOMETRY_EPSILON)) {
					rejectForm(
						'region_form_projection_degenerate',
						'Region form has no usable projected extent',
					);
					continue;
				}
				if (!(half - Math.abs(form.ridgeOffset) > LAYOUT_GEOMETRY_EPSILON)) {
					rejectForm(
						'region_ridge_outside',
						'Region gable ridge must lie strictly inside the footprint half extent',
					);
					continue;
				}
			}
			const profile = regionFormProfile(form, points);
			if (profile === null) {
				rejectForm(
					'region_form_projection_degenerate',
					'Region form has no usable projected extent',
				);
				continue;
			}
			if (region.elevation + form.rise + region.thickness > MAX_LAYOUT_DIMENSION_METERS) {
				rejectForm('dimension_out_of_range', 'Region form top is limited to 1000 m');
				continue;
			}
		}
		if (points.length < 3 || points.length > MAX_LAYOUT_REGION_POINTS) {
			reject('region_point_count', 'A region requires 3 to 1024 footprint points');
			continue;
		}
		if (new Set(points.map(([x, z]) => `${x},${z}`)).size !== points.length) {
			reject('region_repeated_vertex', 'Region footprint vertices must be distinct');
			continue;
		}
		const lengths = points.map(([x, z], i) => {
			const next = points[(i + 1) % points.length]!;
			return Math.hypot(next[0] - x, next[1] - z);
		});
		if (lengths.some((length) => length > MAX_LAYOUT_DIMENSION_METERS)) {
			reject('dimension_out_of_range', 'A region footprint edge exceeds 1000 m');
			continue;
		}
		if (lengths.some((length) => length <= LAYOUT_GEOMETRY_EPSILON)) {
			reject(
				'region_short_edge',
				'Region footprint edges must be longer than the geometry tolerance',
			);
			continue;
		}
		const backtracks = points.some((point, i) => {
			const before = points[(i + points.length - 1) % points.length]!;
			const after = points[(i + 1) % points.length]!;
			return (
				orientXZ(before, point, after) === 0 &&
				(before[0] - point[0]) * (after[0] - point[0]) +
					(before[1] - point[1]) * (after[1] - point[1]) >
					0
			);
		});
		if (backtracks || spaceOutlineSelfIntersects(points)) {
			reject('region_self_intersection', 'Region footprint must be a simple polygon');
			continue;
		}
		const [x, z] = points[0]!;
		if (spaceOutlineSignedArea(points.map(([px, pz]) => [px - x, pz - z])) <= 0) {
			reject('region_nonpositive_area', 'Region footprint must have positive signed area in X/Z');
			continue;
		}
		candidates.push({
			region,
			index,
			band: regionVerticalBand(region, 0),
			bounds: regionFootprintBounds(points),
		});
	}
	for (const [index, a] of candidates.entries()) {
		for (let next = index + 1; next < candidates.length; next++) {
			const b = candidates[next]!;
			if (
				a.bounds.maxX <= b.bounds.minX ||
				b.bounds.maxX <= a.bounds.minX ||
				a.bounds.maxZ <= b.bounds.minZ ||
				b.bounds.maxZ <= a.bounds.minZ ||
				Math.min(a.band[1], b.band[1]) - Math.max(a.band[0], b.band[0]) <= LAYOUT_GEOMETRY_EPSILON
			)
				continue;
			if (polygonsShareInteriorArea(a.region.footprint.points, b.region.footprint.points)) {
				issues.push({
					path: `$.regions[${b.index}].footprint`,
					code: 'region_overlap',
					message: `Regions '${a.region.id}' and '${b.region.id}' overlap in volume`,
				});
			}
		}
	}
	return issues;
}

/** Carry Wall intent through explicit planner lineage, preserving unchanged source. */
export function carryRegionWallIntents(
	regions: LayoutRegion[],
	correspondence: ReadonlyMap<string, readonly string[]>,
): LayoutRegion[] {
	if (regions.length === 0 || correspondence.size === 0) return regions;
	let changed = false;
	const result = regions.map((region) => {
		if (!region.intendedGaps.some((id) => correspondence.has(id))) return region;
		const intendedGaps = [
			...new Set(region.intendedGaps.flatMap((id) => correspondence.get(id) ?? [id])),
		].sort();
		if (
			intendedGaps.length === region.intendedGaps.length &&
			intendedGaps.every((id, index) => id === region.intendedGaps[index])
		)
			return region;
		changed = true;
		return { ...region, intendedGaps };
	});
	return changed ? result : regions;
}
