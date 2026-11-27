/**
 * `form-geometry.ts` — the compiled faces of one shed or gable Region.
 *
 * The form is a profile extruded across the footprint and clipped by it. The
 * exact plan partition at the ridge comes from `form-partition.ts`, which the
 * Plan section shares; this module turns its pieces into faces:
 *
 * - the pieces of each side merge into maximal planar loops (the profile is
 *   affine on each side), emitted as underside and as a top offset by
 *   `thickness`, so the slab has a constant vertical thickness;
 * - the vertical perimeter faces are split at the same cached ridge crossings.
 *
 * Top, underside and edge faces therefore share identical vertex values: no
 * cracks, no T-junctions and an exact ridge. Heights come only from
 * `regionUndersideAtStation`; this is a bounded derivation, not a second model.
 */
import type { LayoutVec2 } from '../../geometry/coordinates';
import type { Vec3 } from '../../kernel/types';
import type { CompiledRegion } from '../../geometry/types';
import type { LayoutRegion } from '../../wall/types';
import { regionUndersideAtStation } from './form';
import {
	boundaryLoops,
	edgeKeysAtLevel,
	partitionRegionForm,
	vertexKey,
	type PointKey,
} from './form-partition';

type Face = CompiledRegion['faces'][number];

/** The input facts the compiler holds for one authored region. */
export type RegionFormSource = Pick<LayoutRegion, 'role' | 'form' | 'thickness'> & {
	readonly footprint: readonly LayoutVec2[];
};

export type RegionFormCompilation =
	| {
			readonly kind: 'compiled';
			readonly faces: Face[];
			/** Lowest underside over the footprint (the eave). */
			readonly bottomY: number;
			/** Highest top over the footprint. */
			readonly topY: number;
	  }
	| { readonly kind: 'failed'; readonly message: string };

function normalized(vector: Vec3): Vec3 {
	const length = Math.hypot(vector[0], vector[1], vector[2]);
	return length > 0 ? [vector[0] / length, vector[1] / length, vector[2] / length] : [0, 1, 0];
}

/**
 * Append the vertical perimeter faces, split at the same cached ridge crossings
 * the top and underside use: bottom→top at the start vertex, top→bottom at the
 * end vertex, reversed relative to the plan ring.
 */
function appendPerimeterFaces(
	ringLength: number,
	partition: Extract<ReturnType<typeof partitionRegionForm>, { kind: 'partitioned' }>,
	underside: (key: PointKey) => number,
	thickness: number,
	faces: Face[],
): void {
	const { field, profile } = partition;
	for (let index = 0; index < ringLength; index++) {
		const keys = edgeKeysAtLevel(
			field,
			vertexKey(index),
			vertexKey((index + 1) % ringLength),
			profile.qRidge,
			'r',
		);
		for (let edge = 0; edge + 1 < keys.length; edge++) {
			const from = keys[edge]!;
			const to = keys[edge + 1]!;
			const fromPoint = field.point.get(from)!;
			const toPoint = field.point.get(to)!;
			const dx = toPoint[0] - fromPoint[0];
			const dz = toPoint[1] - fromPoint[1];
			const length = Math.hypot(dx, dz);
			// A crossing is strictly inside its edge, so a segment is never empty;
			// this guards the normal only and never drops a face the loops use.
			if (!(length > 0)) continue;
			faces.push({
				surface: 'edge',
				polygon: [
					[fromPoint[0], underside(from), fromPoint[1]],
					[fromPoint[0], underside(from) + thickness, fromPoint[1]],
					[toPoint[0], underside(to) + thickness, toPoint[1]],
					[toPoint[0], underside(to), toPoint[1]],
				],
				normal: [dz / length, 0, -dx / length],
			});
		}
	}
}

/**
 * Compile the faces of one non-flat Region. The caller has already refused a
 * missing ridge, a non-overhead role and invalid envelope values; a `failed`
 * result is a genuine triangulation failure and blocks the whole compile.
 */
export function compileRegionFormFaces(
	region: RegionFormSource,
	datumY: number,
): RegionFormCompilation {
	const { form, thickness } = region;
	if (form.kind === 'flat') {
		return { kind: 'failed', message: 'A flat Region has no form geometry' };
	}
	if (region.role !== 'overhead') {
		return { kind: 'failed', message: 'Only an overhead Region may carry a sloped form' };
	}
	if (!(thickness > 0) || !Number.isFinite(thickness)) {
		return { kind: 'failed', message: 'Region thickness must be positive and finite' };
	}
	const partition = partitionRegionForm(form, region.footprint);
	if (partition.kind === 'failed') return partition;
	const { profile, field } = partition;
	const cos = Math.cos(profile.azimuth);
	const sin = Math.sin(profile.azimuth);
	const heights = new Map<PointKey, number>();
	const underside = (key: PointKey): number => {
		let height = heights.get(key);
		if (height === undefined) {
			// Both sides read one cached ridge value: the shared ridge edge is exact.
			height = regionUndersideAtStation(form, profile, datumY, field.value.get(key)!);
			heights.set(key, height);
		}
		return height;
	};
	const belowLoops = boundaryLoops(partition.below);
	const aboveLoops = boundaryLoops(partition.above);
	if (belowLoops === null || aboveLoops === null) {
		return { kind: 'failed', message: 'Region form split did not close' };
	}
	if (belowLoops.length === 0 && aboveLoops.length === 0) {
		return { kind: 'failed', message: 'Region form split produced no faces' };
	}

	// The side a loop came from fixes its slope; a loop's vertices may all lie
	// on the ridge when it is a rounding-thin sliver.
	const sideSlope = (below: boolean): number =>
		form.kind === 'shed' || below ? form.rise / profile.runBelow : -form.rise / profile.runAbove;
	const topNormal = (slope: number): Vec3 => normalized([-slope * cos, 1, -slope * sin]);
	const undersideNormal = (slope: number): Vec3 => normalized([slope * cos, -1, slope * sin]);

	const faces: Face[] = [];
	const addSide = (loops: readonly (readonly PointKey[])[], below: boolean, top: boolean): void => {
		const slope = sideSlope(below);
		for (const loop of loops) {
			if (top) {
				faces.push({
					surface: 'top',
					polygon: loop
						.map((key): Vec3 => {
							const point = field.point.get(key)!;
							return [point[0], underside(key) + thickness, point[1]];
						})
						.reverse(),
					normal: topNormal(slope),
				});
			} else {
				faces.push({
					surface: 'underside',
					polygon: loop.map((key): Vec3 => {
						const point = field.point.get(key)!;
						return [point[0], underside(key), point[1]];
					}),
					normal: undersideNormal(slope),
				});
			}
		}
	};
	// Top first, then underside, matching the flat path's face order. Both are
	// emitted per planar piece, and every top vertex is exactly `thickness` above
	// its underside vertex.
	addSide(belowLoops, true, true);
	addSide(aboveLoops, false, true);
	addSide(belowLoops, true, false);
	addSide(aboveLoops, false, false);

	appendPerimeterFaces(partition.ring.length, partition, underside, thickness, faces);

	let bottomY = Infinity;
	let topOfUnderside = -Infinity;
	for (const height of heights.values()) {
		if (height < bottomY) bottomY = height;
		if (height > topOfUnderside) topOfUnderside = height;
	}
	if (!Number.isFinite(bottomY) || !Number.isFinite(topOfUnderside)) {
		return { kind: 'failed', message: 'Region form produced no finite vertical extent' };
	}
	return {
		kind: 'compiled',
		faces,
		bottomY,
		topY: topOfUnderside + thickness,
	};
}
