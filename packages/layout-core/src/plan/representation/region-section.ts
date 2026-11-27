/**
 * `region-section.ts` — Plan candidates of a shed or gable Region at a cut.
 *
 * A flat Region is one slab at one level, so its one footprint candidate is
 * exact. A sloped Region has no single level: a horizontal plane at `cutY`
 * splits its footprint into three parts by the underside height `u`:
 *
 * ```text
 * below   u + thickness <= cutY        the slab is under the cut     projected top
 * band    u <= cutY <= u + thickness   the cut passes through it     cut edge
 * above   u >= cutY                    the slab is over the cut      hidden underside
 * ```
 *
 * The parts come from the same exact partition the face compiler uses
 * (`form-partition.ts`): the ridge pieces, on each of which `u` is affine, split
 * at the two levels `cutY` and `cutY - thickness`, then merged per part into
 * maximal loops. A concave footprint whose band falls apart yields several
 * disjoint loops, never one ring with a seam. Each loop is one candidate with
 * its own extent, so the shared stream rule places it; a tangent part reads
 * `projected` exactly as a flat slab does.
 *
 * Nothing falls back to the footprint: an empty part has no candidate, and a
 * partition that cannot be built leaves the Region with no Plan geometry.
 */
import type { LayoutVec2 } from '../../geometry/coordinates';
import type { CompiledRegion } from '../../geometry/types';
import { regionUndersideAtStation } from '../../room/region/form';
import {
	boundaryLoops,
	partitionRegionForm,
	splitAtLevel,
	type LevelField,
	type PointKey,
} from '../../room/region/form-partition';
import type { Candidate } from './types';

/** A sloped Region's cut-independent partition: ridge pieces and their underside heights. */
export type RegionSlabPartition = {
	readonly point: ReadonlyMap<PointKey, LayoutVec2>;
	readonly underside: ReadonlyMap<PointKey, number>;
	readonly pieces: readonly (readonly PointKey[])[];
	readonly thickness: number;
};

const partitions = new WeakMap<CompiledRegion, RegionSlabPartition | null>();

function slabPartitionOf(region: CompiledRegion): RegionSlabPartition | null {
	if (partitions.has(region)) return partitions.get(region)!;
	let result: RegionSlabPartition | null = null;
	const form = region.form;
	const thickness = region.thickness;
	if (form !== undefined && form.kind !== 'flat' && thickness !== undefined && thickness > 0) {
		const partition = partitionRegionForm(form, region.footprint);
		if (partition.kind === 'partitioned') {
			const datumY = region.datumY ?? region.bottomY;
			const underside = new Map<PointKey, number>();
			for (const [key, station] of partition.field.value) {
				underside.set(key, regionUndersideAtStation(form, partition.profile, datumY, station));
			}
			result = {
				point: partition.field.point,
				underside,
				pieces: [...partition.below, ...partition.above],
				thickness,
			};
		}
	}
	partitions.set(region, result);
	return result;
}

/**
 * One compiled Region's cut-independent candidate. A sloped Region carries its
 * partition; `regionCandidatesAt` turns it into the parts of one cut.
 */
export function regionCandidatesOf(region: CompiledRegion): Candidate[] {
	const base: Candidate = {
		sourceKind: 'region',
		sourceId: region.regionId,
		extent: { minY: region.bottomY, maxY: region.topY },
		plan: { kind: 'polygon', polygon: region.footprint },
		subRef: null,
		symbolOnly: false,
		regionRole: region.role,
		regionKey: region.cacheKey,
	};
	if (region.form === undefined || region.form.kind === 'flat') return [base];
	const slab = slabPartitionOf(region);
	return [
		slab === null
			? { ...base, plan: { kind: 'polyline', polyline: [] } }
			: { ...base, regionSlab: slab },
	];
}

/** The parts of a sloped Region at `cutY`; any other candidate is returned as is. */
export function regionCandidatesAt(candidate: Candidate, cutY: number): Candidate[] {
	const slab = candidate.regionSlab;
	if (slab === undefined) return [candidate];
	const { regionSlab: _slab, ...base } = candidate;
	const field: LevelField = { point: new Map(slab.point), value: new Map(slab.underside) };
	const underCut = splitAtLevel(field, slab.pieces, cutY, 'cut');
	const lower = splitAtLevel(field, underCut.below, cutY - slab.thickness, 'base');
	const parts = [lower.below, lower.above, underCut.above].map(boundaryLoops);
	if (parts.some((loops) => loops === null)) {
		return [{ ...base, plan: { kind: 'polyline', polyline: [] } }];
	}
	const candidates: Candidate[] = [];
	for (const loops of parts as PointKey[][][]) {
		for (const loop of loops) {
			let minY = Infinity;
			let maxY = -Infinity;
			for (const key of loop) {
				const height = field.value.get(key)!;
				if (height < minY) minY = height;
				if (height > maxY) maxY = height;
			}
			candidates.push({
				...base,
				extent: { minY, maxY: maxY + slab.thickness },
				plan: { kind: 'polygon', polygon: loop.map((key) => field.point.get(key)!) },
			});
		}
	}
	return candidates;
}
