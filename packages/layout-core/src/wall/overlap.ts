/**
 * `layout-wall-overlap.ts` — derived coincidence between independent Wall
 * groups.
 *
 * This is **editor state**, not a topology rule. It answers one question for
 * the Stage: where does a Wall from one connected component rest on a Wall from
 * another? The answer is drawn as the **overlaps, not joined** cue. It is never
 * persisted, never validated against, never written to history and never
 * refuses a placement. Connectivity stays exactly what the Layout contract
 * says it is: Junction ID equality. Two coincident Walls in different
 * components remain separate ids and adopt no Junction.
 *
 * Geometry is the canonical centerline the Stage already draws: a `line` Wall
 * uses its resolved endpoints, and a `cubic-chain` uses the one canonical
 * sampler. Coincidence is a positive-length collinear stretch within
 * {@link LAYOUT_WALL_OVERLAP_EPSILON}; a crossing, a shared endpoint or a
 * near-miss is not an overlap. Pairs in the same component are excluded by
 * construction because their overlap is already a canonical topology refusal,
 * not permitted placement.
 *
 * Pure and read-only: no allocation, no document mutation, no persistence.
 */
import { topologyComponentKeyByWallId } from '../room/topology-components';
import { wallCenterlineSamples } from './centerline';
import type { LayoutDocumentWallFirst, LayoutWall } from './types';
import type { LayoutVec2 } from '../geometry/coordinates';

/** Display tolerance for coincidence, in meters. Never a topology tolerance. */
export const LAYOUT_WALL_OVERLAP_EPSILON = 1e-6;

/** One connected coincident stretch, as an ordered centerline polyline. */
export type LayoutWallOverlapStretch = readonly LayoutVec2[];

/** One overlapping pair of Walls from different connected components. */
export type LayoutIndependentWallOverlap = {
	/** The Wall that appears first in document order. */
	readonly firstWallId: string;
	/** The Wall that appears second in document order. */
	readonly secondWallId: string;
	/** Ordered coincident stretches in document X/Z, meters. */
	readonly stretches: readonly LayoutWallOverlapStretch[];
	/** Total coincident centerline length, meters. */
	readonly length: number;
	/** Midpoint of the longest stretch, for one cue tag. */
	readonly labelAt: LayoutVec2;
};

/**
 * Optional broad-phase cost characterization. Read-only diagnostics; it never
 * changes the returned overlaps and the editor does not pass it.
 */
export type LayoutWallOverlapObservation = {
	/** Walls whose canonical centerline was available to the query. */
	readonly wallCount: number;
	/** Cross-component pairs admitted by the X sweep, before Z and segment tests. */
	readonly candidatePairs: number;
};

type WallPolyline = {
	readonly wallId: string;
	readonly componentKey: string;
	readonly points: readonly LayoutVec2[];
	readonly minX: number;
	readonly maxX: number;
	readonly minZ: number;
	readonly maxZ: number;
};

/**
 * The Wall's centerline as an ordered polyline. A straight Wall is its two
 * resolved endpoints; a curved Wall is the canonical sampler's points. An
 * unresolved or unsampleable Wall yields `null` and contributes no cue.
 */
function wallPolyline(
	_document: LayoutDocumentWallFirst,
	wall: LayoutWall,
	componentKey: string,
	junctionPointById: ReadonlyMap<string, LayoutVec2>
): WallPolyline | null {
	const start = junctionPointById.get(wall.startJunctionId);
	const end = junctionPointById.get(wall.endJunctionId);
	if (start === undefined || end === undefined) return null;
	let points: readonly LayoutVec2[];
	if (wall.centerline.kind === 'line') {
		points = [start, end];
	} else {
		const sampled = wallCenterlineSamples(wall, start, end, 'forward');
		if (sampled === undefined || sampled.samples.length < 2) return null;
		points = sampled.samples.map((sample) => [sample.point[0], sample.point[1]] as LayoutVec2);
	}
	let minX = Number.POSITIVE_INFINITY;
	let maxX = Number.NEGATIVE_INFINITY;
	let minZ = Number.POSITIVE_INFINITY;
	let maxZ = Number.NEGATIVE_INFINITY;
	for (const point of points) {
		minX = Math.min(minX, point[0]);
		maxX = Math.max(maxX, point[0]);
		minZ = Math.min(minZ, point[1]);
		maxZ = Math.max(maxZ, point[1]);
	}
	return {
		wallId: wall.id,
		componentKey,
		points,
		minX,
		maxX,
		minZ,
		maxZ
	};
}

/** Squared distance, for the display tolerance only. */
function distanceSquared(first: LayoutVec2, second: LayoutVec2): number {
	const dx = first[0] - second[0];
	const dz = first[1] - second[1];
	return dx * dx + dz * dz;
}

/**
 * The collinear overlap of two centerline segments, or `null`.
 *
 * Both segment directions must be parallel within the display tolerance, both
 * of the second segment's endpoints must lie on the first segment's line, and
 * the shared length must be positive. The returned endpoints are on the first
 * segment's line.
 */
function collinearOverlap(
	firstStart: LayoutVec2,
	firstEnd: LayoutVec2,
	secondStart: LayoutVec2,
	secondEnd: LayoutVec2
): readonly [LayoutVec2, LayoutVec2] | null {
	const ux = firstEnd[0] - firstStart[0];
	const uz = firstEnd[1] - firstStart[1];
	const firstLength = Math.hypot(ux, uz);
	if (firstLength <= LAYOUT_WALL_OVERLAP_EPSILON) return null;
	const vx = secondEnd[0] - secondStart[0];
	const vz = secondEnd[1] - secondStart[1];
	const secondLength = Math.hypot(vx, vz);
	if (secondLength <= LAYOUT_WALL_OVERLAP_EPSILON) return null;
	const unitX = ux / firstLength;
	const unitZ = uz / firstLength;
	const otherUnitX = vx / secondLength;
	const otherUnitZ = vz / secondLength;
	// Parallel within the display tolerance. An anti-parallel segment is the
	// same line walked backwards; its distance test below still accepts it.
	if (Math.abs(unitX * otherUnitZ - unitZ * otherUnitX) > 1e-6) return null;
	const distance = (point: LayoutVec2): number =>
		Math.abs((point[0] - firstStart[0]) * unitZ - (point[1] - firstStart[1]) * unitX);
	if (
		distance(secondStart) > LAYOUT_WALL_OVERLAP_EPSILON ||
		distance(secondEnd) > LAYOUT_WALL_OVERLAP_EPSILON
	) {
		return null;
	}
	const project = (point: LayoutVec2): number =>
		(point[0] - firstStart[0]) * unitX + (point[1] - firstStart[1]) * unitZ;
	const secondA = project(secondStart);
	const secondB = project(secondEnd);
	const low = Math.max(0, Math.min(secondA, secondB));
	const high = Math.min(firstLength, Math.max(secondA, secondB));
	if (high - low <= LAYOUT_WALL_OVERLAP_EPSILON) return null;
	return [
		[firstStart[0] + unitX * low, firstStart[1] + unitZ * low],
		[firstStart[0] + unitX * high, firstStart[1] + unitZ * high]
	];
}

/** A tolerance comparison for chain joins. */
function samePoint(first: LayoutVec2, second: LayoutVec2): boolean {
	return distanceSquared(first, second) <= LAYOUT_WALL_OVERLAP_EPSILON ** 2;
}

/**
 * Join raw overlap pieces into ordered chains. Consecutive sampled chords meet
 * at their shared vertex, so a curved coincidence becomes one stretch instead
 * of one cue per sample.
 */
function chainOverlaps(
	pieces: readonly (readonly [LayoutVec2, LayoutVec2])[]
): readonly LayoutWallOverlapStretch[] {
	const used = new Set<number>();
	const chains: LayoutVec2[][] = [];
	for (let index = 0; index < pieces.length; index += 1) {
		if (used.has(index)) continue;
		used.add(index);
		const piece = pieces[index]!;
		const chain: LayoutVec2[] = [piece[0], piece[1]];
		let extended = true;
		while (extended) {
			extended = false;
			const tail = chain[chain.length - 1]!;
			for (let candidate = 0; candidate < pieces.length; candidate += 1) {
				if (used.has(candidate)) continue;
				const next = pieces[candidate]!;
				if (!samePoint(next[0], tail)) continue;
				chain.push(next[1]);
				used.add(candidate);
				extended = true;
				break;
			}
		}
		extended = true;
		while (extended) {
			extended = false;
			const head = chain[0]!;
			for (let candidate = 0; candidate < pieces.length; candidate += 1) {
				if (used.has(candidate)) continue;
				const previous = pieces[candidate]!;
				if (!samePoint(previous[1], head)) continue;
				chain.unshift(previous[0]);
				used.add(candidate);
				extended = true;
				break;
			}
		}
		chains.push(chain);
	}
	return chains;
}

/** Polyline length in meters. */
function polylineLength(points: readonly LayoutVec2[]): number {
	let length = 0;
	for (let index = 1; index < points.length; index += 1) {
		length += Math.hypot(
			points[index]![0] - points[index - 1]![0],
			points[index]![1] - points[index - 1]![1]
		);
	}
	return length;
}

/** Midpoint by arc length, so a curved stretch labels inside itself. */
function polylineMidpoint(points: readonly LayoutVec2[]): LayoutVec2 {
	const total = polylineLength(points);
	if (total <= 0) return [points[0]![0], points[0]![1]];
	let remaining = total / 2;
	for (let index = 1; index < points.length; index += 1) {
		const from = points[index - 1]!;
		const to = points[index]!;
		const span = Math.hypot(to[0] - from[0], to[1] - from[1]);
		if (span >= remaining) {
			const ratio = span === 0 ? 0 : remaining / span;
			return [from[0] + (to[0] - from[0]) * ratio, from[1] + (to[1] - from[1]) * ratio];
		}
		remaining -= span;
	}
	const last = points[points.length - 1]!;
	return [last[0], last[1]];
}

/**
 * Broad-phase candidate pairs for the derived query.
 *
 * The sweep orders Walls by their minimum X and keeps an active set whose
 * maximum X can still meet the current interval. Only cross-component pairs in
 * that set become candidates; the X sweep is the material spatial filter, while
 * Z extents and centerline geometry are detailed tests below. `candidatePairs`
 * counts the pairs the broad phase admitted (before the Z and segment tests), so
 * a focused test can characterize the query without a timing gate.
 */
function broadPhasePairs(polylines: readonly WallPolyline[]): {
	readonly pairs: readonly (readonly [number, number])[];
	readonly candidatePairs: number;
} {
	const ordered = polylines
		.map((wall, index) => ({ wall, index }))
		.sort((first, second) => first.wall.minX - second.wall.minX || first.index - second.index);
	const active: { readonly wall: WallPolyline; readonly index: number }[] = [];
	const pairs: [number, number][] = [];
	let candidatePairs = 0;
	for (const current of ordered) {
		// Compact expired X intervals in place; `ordered` is the sweep order, so
		// the active list stays in insertion order without another sort.
		let kept = 0;
		for (const candidate of active) {
			if (candidate.wall.maxX + LAYOUT_WALL_OVERLAP_EPSILON >= current.wall.minX) {
				active[kept] = candidate;
				kept += 1;
			}
		}
		active.length = kept;
		for (const candidate of active) {
			if (candidate.wall.componentKey === current.wall.componentKey) continue;
			candidatePairs += 1;
			if (
				candidate.wall.maxZ + LAYOUT_WALL_OVERLAP_EPSILON < current.wall.minZ ||
				current.wall.maxZ + LAYOUT_WALL_OVERLAP_EPSILON < candidate.wall.minZ
			) {
				continue;
			}
			pairs.push([
				Math.min(candidate.index, current.index),
				Math.max(candidate.index, current.index)
			]);
		}
		active.push(current);
	}
	// The sweep discovers a pair when its later interval starts; restore the
	// documented document-order pair order before the detailed pass.
	pairs.sort((first, second) => first[0] - second[0] || first[1] - second[1]);
	return { pairs, candidatePairs };
}

/**
 * Every coincident stretch between Walls of **different** connected
 * components, in document order of the Wall pair. Same-component pairs are
 * omitted: their overlap already refuses in the canonical topology gate.
 *
 * `observe` is optional read-only characterization of the broad phase; it never
 * changes the returned overlaps.
 */
export function independentWallOverlaps(
	document: LayoutDocumentWallFirst,
	observe?: (observation: LayoutWallOverlapObservation) => void
): readonly LayoutIndependentWallOverlap[] {
	const keyByWallId = topologyComponentKeyByWallId(document);
	const junctionPointById = new Map(
		document.junctions.map((junction) => [junction.id, junction.point] as const)
	);
	const polylines: WallPolyline[] = [];
	for (const wall of document.walls) {
		const key = keyByWallId.get(wall.id);
		if (key === undefined) continue;
		const polyline = wallPolyline(document, wall, key, junctionPointById);
		if (polyline !== null) polylines.push(polyline);
	}

	const { pairs, candidatePairs } = broadPhasePairs(polylines);
	const overlaps: LayoutIndependentWallOverlap[] = [];
	for (const [firstIndex, secondIndex] of pairs) {
		const first = polylines[firstIndex]!;
		const second = polylines[secondIndex]!;
		const pieces: (readonly [LayoutVec2, LayoutVec2])[] = [];
		for (let firstLeg = 1; firstLeg < first.points.length; firstLeg += 1) {
			const firstStart = first.points[firstLeg - 1]!;
			const firstEnd = first.points[firstLeg]!;
			for (let secondLeg = 1; secondLeg < second.points.length; secondLeg += 1) {
				const overlap = collinearOverlap(
					firstStart,
					firstEnd,
					second.points[secondLeg - 1]!,
					second.points[secondLeg]!
				);
				if (overlap !== null) pieces.push(overlap);
			}
		}
		if (pieces.length === 0) continue;
		const stretches = chainOverlaps(pieces);
		if (stretches.length === 0) continue;
		let length = 0;
		let longest: LayoutWallOverlapStretch | null = null;
		let longestLength = -1;
		for (const stretch of stretches) {
			const stretchLength = polylineLength(stretch);
			length += stretchLength;
			if (stretchLength > longestLength) {
				longest = stretch;
				longestLength = stretchLength;
			}
		}
		if (longest === null || length <= LAYOUT_WALL_OVERLAP_EPSILON) continue;
		overlaps.push({
			firstWallId: first.wallId,
			secondWallId: second.wallId,
			stretches,
			length,
			labelAt: polylineMidpoint(longest)
		});
	}
	observe?.({ wallCount: polylines.length, candidatePairs });
	return overlaps;
}
