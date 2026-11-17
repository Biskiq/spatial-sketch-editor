/**
 * The section of a drawn cut.
 *
 * `mesh-plane-section.ts` knows how to section any solid with any plane. SL2 adds
 * two things on top, both pure:
 *
 * - the plane a drawn reading implies (the vertical plane through the segment,
 *   offset toward what is shown), and
 * - a clipping of the returned loops/chains to the segment's **finite** extent.
 *
 * The depth boundary is deliberately not capped: it is a display limit, not a
 * second cut, and SL3's analytic Section is out of scope. The primary cut plane is
 * capped exactly once, from the same drawn meshes SL1 uses.
 */
import {
	sectionMeshes,
	type CapAssemblyIssue,
	type SectionBasis,
	type SectionChain,
	type SectionGroupResult,
	type SectionInput,
	type SectionLoop,
	type SectionResult
} from './mesh-plane-section';
import type { DrawnResolvedSlice, ResolvedSlice } from './slice-cut';
import {
	clipRegionToHalfPlanes,
	pointOnSegment,
	ringSignedArea,
	segmentIntervalInHalfPlanes,
	type ClipHalfPlane
} from './slice-clip-2d';

export type SliceSection = {
	readonly result: SectionResult;
	/** The plane's frame, already at its world origin. */
	readonly basis: SectionBasis;
	/** The segment extent in the basis' `u` axis, or null for a Level cut. */
	readonly extent: { readonly min: number; readonly max: number } | null;
};

/** The `u` coordinate of a world point in a section basis. */
function basisUOf(basis: SectionBasis, point: readonly [number, number, number]): number {
	return (
		(point[0] - basis.origin[0]) * basis.u[0] +
		(point[1] - basis.origin[1]) * basis.u[1] +
		(point[2] - basis.origin[2]) * basis.u[2]
	);
}

/** The two half-planes of a segment extent, in the section's `(u, v)` frame. */
function extentHalfPlanes(uMin: number, uMax: number): readonly ClipHalfPlane[] {
	return [
		{ nx: -1, ny: 0, c: -uMin },
		{ nx: 1, ny: 0, c: uMax }
	];
}

/**
 * A group's loops cropped to `uMin ≤ u ≤ uMax` **as a region**.
 *
 * A concave outer can meet the extent in several disjoint islands, and a hole that
 * crosses the crop opens into its outer; both come out as valid, separate contours
 * (outers counter-clockwise, holes clockwise) that `capFillsOf` can fill. Edge
 * identities travel with their edges; an edge along the crop line takes the identity
 * of the edge that left the extent there.
 *
 * `null` means the loops were not a valid region (they crossed each other), which
 * the caller reports rather than filling something wrong.
 */
export function clipLoopsToExtent(
	loops: readonly SectionLoop[],
	uMin: number,
	uMax: number
): SectionLoop[] | null {
	if (!(uMax > uMin)) return [];
	const result = clipRegionToHalfPlanes(
		loops.map((loop) => ({ points: loop.points, tags: loop.edgeIdentities })),
		extentHalfPlanes(uMin, uMax)
	);
	if (result.kind === 'invalid') return null;
	return result.rings.map((ring) => {
		const area = ringSignedArea(ring.points);
		return {
			role: area > 0 ? 'outer' : 'hole',
			points: ring.points,
			edgeIdentities: ring.tags,
			signedArea: area
		};
	});
}

/**
 * An open chain clipped to the same extent, as independent two-point runs.
 *
 * Inclusive, and parallel-safe: a segment along the crop direction (constant `u`)
 * inside the extent is kept whole. An open chain is a warning, and a warning edge
 * that silently disappears hides the very defect it reports.
 */
export function clipChainToExtent(
	chain: SectionChain,
	uMin: number,
	uMax: number
): SectionChain[] {
	const halves = extentHalfPlanes(uMin, uMax);
	const out: SectionChain[] = [];
	for (let index = 0; index + 1 < chain.points.length; index += 1) {
		const a = chain.points[index]!;
		const b = chain.points[index + 1]!;
		const interval = segmentIntervalInHalfPlanes(a, b, halves);
		if (interval === null) continue;
		const p0 = pointOnSegment(a, b, interval[0]);
		const p1 = pointOnSegment(a, b, interval[1]);
		if (Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) <= 1e-9) continue;
		out.push({
			points: [p0, p1],
			edgeIdentities: [chain.edgeIdentities[index] ?? '']
		});
	}
	return out;
}

/** A group's loops as open chains, for a group whose crop could not be filled. */
function loopsAsChains(loops: readonly SectionLoop[]): SectionChain[] {
	return loops.map((loop) => ({
		points: [...loop.points, loop.points[0]!],
		edgeIdentities: [...loop.edgeIdentities]
	}));
}

/** The kept half-space is what is shown: `b ≤ 0` in the cut's own coordinates. */
function drawnPlane(resolved: DrawnResolvedSlice): {
	normal: readonly [number, number, number];
	constant: number;
	sectionOffsetMeters: number;
} {
	const normal: readonly [number, number, number] = [
		-resolved.hiddenNormal[0],
		-resolved.hiddenNormal[1],
		-resolved.hiddenNormal[2]
	];
	return {
		normal,
		constant: -(
			normal[0] * resolved.origin[0] +
			normal[1] * resolved.origin[1] +
			normal[2] * resolved.origin[2]
		),
		sectionOffsetMeters: 1e-4
	};
}

/**
 * Section what the Slice shows.
 *
 * A Level reading uses SL1's horizontal plane unchanged. A drawn reading sections
 * the vertical plane through the segment and clips the result to the segment's
 * finite extent, so the caps stop exactly where the GPU predicate stops hiding.
 */
export function sectionForSlice(
	inputs: readonly SectionInput[],
	resolved: ResolvedSlice
): SliceSection {
	if (resolved.kind === 'level') {
		const result = sectionMeshes(inputs, { normal: [0, -1, 0], constant: resolved.cutY });
		return { result, basis: result.basis, extent: null };
	}
	const result = sectionMeshes(inputs, drawnPlane(resolved));
	const uStart = basisUOf(result.basis, resolved.start);
	const uEnd = basisUOf(result.basis, resolved.end);
	const uMin = Math.min(uStart, uEnd);
	const uMax = Math.max(uStart, uEnd);
	const issues: CapAssemblyIssue[] = [...result.issues];
	const groups = result.groups.map((group): SectionGroupResult => {
		const chains = group.chains.flatMap((chain) => clipChainToExtent(chain, uMin, uMax));
		const loops = clipLoopsToExtent(group.loops, uMin, uMax);
		if (loops !== null) return { ...group, loops, chains };
		// Not a valid region: draw its cropped edges as warning ink, fill nothing, and
		// say so — exactly how an unbalanced group is treated.
		const issue: CapAssemblyIssue = group.issue ?? {
			group: group.group,
			identity: group.identities[0] ?? group.group,
			unmatchedVertices: 0
		};
		if (group.issue === null) issues.push(issue);
		return {
			...group,
			loops: [],
			chains: [
				...chains,
				...loopsAsChains(group.loops).flatMap((chain) => clipChainToExtent(chain, uMin, uMax))
			],
			issue
		};
	});
	return {
		result: { ...result, groups, issues },
		basis: result.basis,
		extent: { min: uMin, max: uMax }
	};
}
