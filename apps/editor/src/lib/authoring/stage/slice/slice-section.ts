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
	type SectionBasis,
	type SectionChain,
	type SectionInput,
	type SectionLoop,
	type SectionResult
} from './mesh-plane-section';
import type { DrawnResolvedSlice, ResolvedSlice } from './slice-cut';

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

function signedArea(points: readonly (readonly [number, number])[]): number {
	let sum = 0;
	for (let index = 0; index < points.length; index += 1) {
		const [ax, ay] = points[index]!;
		const [bx, by] = points[(index + 1) % points.length]!;
		sum += ax * by - bx * ay;
	}
	return sum / 2;
}

function clipHalf(
	points: readonly (readonly [number, number])[],
	identities: readonly string[],
	inside: (point: readonly [number, number]) => boolean,
	intersect: (
		a: readonly [number, number],
		b: readonly [number, number]
	) => readonly [number, number]
): { points: (readonly [number, number])[]; identities: string[] } {
	const outPoints: (readonly [number, number])[] = [];
	const outIdentities: string[] = [];
	for (let index = 0; index < points.length; index += 1) {
		const current = points[index]!;
		const next = points[(index + 1) % points.length]!;
		const id = identities[index] ?? '';
		const currentIn = inside(current);
		const nextIn = inside(next);
		if (currentIn) {
			outPoints.push(current);
			outIdentities.push(id);
		}
		if (currentIn !== nextIn) {
			outPoints.push(intersect(current, next));
			outIdentities.push(id);
		}
	}
	return { points: outPoints, identities: outIdentities };
}

/** A polygon clipped to `uMin ≤ u ≤ uMax`; edge identities travel with their edges. */
export function clipLoopToExtent(
	loop: SectionLoop,
	uMin: number,
	uMax: number
): SectionLoop | null {
	const atMin = (
		a: readonly [number, number],
		b: readonly [number, number]
	): readonly [number, number] => {
		const t = (uMin - a[0]) / (b[0] - a[0]);
		return [uMin, a[1] + (b[1] - a[1]) * t];
	};
	const atMax = (
		a: readonly [number, number],
		b: readonly [number, number]
	): readonly [number, number] => {
		const t = (uMax - a[0]) / (b[0] - a[0]);
		return [uMax, a[1] + (b[1] - a[1]) * t];
	};
	let clipped = clipHalf(loop.points, loop.edgeIdentities, (point) => point[0] >= uMin, atMin);
	clipped = clipHalf(clipped.points, clipped.identities, (point) => point[0] <= uMax, atMax);
	if (clipped.points.length < 3) return null;
	const area = signedArea(clipped.points);
	if (!Number.isFinite(area) || Math.abs(area) <= 1e-12) return null;
	return {
		role: area >= 0 ? 'outer' : 'hole',
		points: clipped.points,
		edgeIdentities: clipped.identities,
		signedArea: area
	};
}

/** An open chain clipped to the same extent, as independent two-point runs. */
export function clipChainToExtent(
	chain: SectionChain,
	uMin: number,
	uMax: number
): SectionChain[] {
	const out: SectionChain[] = [];
	for (let index = 0; index + 1 < chain.points.length; index += 1) {
		const a = chain.points[index]!;
		const b = chain.points[index + 1]!;
		if (a[0] === b[0]) continue;
		const low = Math.max(uMin, Math.min(a[0], b[0]));
		const high = Math.min(uMax, Math.max(a[0], b[0]));
		if (!(high > low)) continue;
		const t0 = (low - a[0]) / (b[0] - a[0]);
		const t1 = (high - a[0]) / (b[0] - a[0]);
		const p0: readonly [number, number] = [a[0] + (b[0] - a[0]) * t0, a[1] + (b[1] - a[1]) * t0];
		const p1: readonly [number, number] = [a[0] + (b[0] - a[0]) * t1, a[1] + (b[1] - a[1]) * t1];
		if (Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) <= 1e-9) continue;
		out.push({
			points: [p0, p1],
			edgeIdentities: [chain.edgeIdentities[index] ?? '']
		});
	}
	return out;
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
	const groups = result.groups.map((group) => ({
		...group,
		loops: group.loops
			.map((loop) => clipLoopToExtent(loop, uMin, uMax))
			.filter((loop): loop is SectionLoop => loop !== null),
		chains: group.chains.flatMap((chain) => clipChainToExtent(chain, uMin, uMax))
	}));
	return {
		result: { ...result, groups },
		basis: result.basis,
		extent: { min: uMin, max: uMax }
	};
}
