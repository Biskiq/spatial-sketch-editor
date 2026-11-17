/**
 * A section's outline as **independent segments**, one per loop edge.
 *
 * The shape matters because of the renderer: `LineGeometry` (drawn by `Line2`) treats
 * its positions as one connected polyline, so two disconnected loops — two Walls
 * across a gap — pick up a diagonal between the last point of one and the first of
 * the next. `LineSegmentsGeometry` (drawn by `LineSegments2`) takes independent pairs,
 * which is what an outline made of islands actually is.
 *
 * Keeping the construction pure means the pairing can be tested without a GPU: eight
 * edges over two disjoint boxes must come out as eight pairs, never seven-plus-a-link.
 */
import type { SectionLoop } from './mesh-plane-section';

export type SectionEdgeSegment = {
	/** The drawn identity that owns this edge. */
	readonly identity: string;
	/** Six numbers: the segment's two endpoints in world space. */
	readonly positions: readonly number[];
};

export type SectionBasis = {
	readonly u: readonly [number, number, number];
	readonly v: readonly [number, number, number];
};

/** A basis that also knows the world point its `(0, 0)` names. */
export type SectionWorldBasis = SectionBasis & {
	readonly origin: readonly [number, number, number];
};

function worldInBasis(basis: SectionWorldBasis, [u, v]: readonly [number, number]): [number, number, number] {
	return [
		basis.origin[0] + u * basis.u[0] + v * basis.v[0],
		basis.origin[1] + u * basis.u[1] + v * basis.v[1],
		basis.origin[2] + u * basis.u[2] + v * basis.v[2]
	];
}

/** Independent world-space edge pairs through a full section basis (SL2). */
export function sectionEdgeSegmentsWorld(
	loops: readonly SectionLoop[],
	basis: SectionWorldBasis
): SectionEdgeSegment[] {
	const segments: SectionEdgeSegment[] = [];
	for (const loop of loops) {
		loop.points.forEach((point, index) => {
			const next = loop.points[(index + 1) % loop.points.length]!;
			segments.push({
				identity: loop.edgeIdentities[index] ?? '',
				positions: [...worldInBasis(basis, point), ...worldInBasis(basis, next)]
			});
		});
	}
	return segments;
}

/** Open chain pairs through a full section basis (SL2). */
export function openChainSegmentsWorld(
	chains: readonly { readonly points: readonly (readonly [number, number])[] }[],
	basis: SectionWorldBasis
): number[] {
	const positions: number[] = [];
	for (const chain of chains) {
		for (let index = 0; index + 1 < chain.points.length; index += 1) {
			positions.push(...worldInBasis(basis, chain.points[index]!), ...worldInBasis(basis, chain.points[index + 1]!));
		}
	}
	return positions;
}

export function sectionEdgeSegments(
	loops: readonly SectionLoop[],
	basis: SectionBasis,
	y: number,
	originXZ: readonly [number, number]
): SectionEdgeSegment[] {
	const world = ([u, v]: readonly [number, number]): [number, number, number] => [
		originXZ[0] + u * basis.u[0] + v * basis.v[0],
		y,
		originXZ[1] + u * basis.u[2] + v * basis.v[2]
	];
	const segments: SectionEdgeSegment[] = [];
	for (const loop of loops) {
		loop.points.forEach((point, index) => {
			const next = loop.points[(index + 1) % loop.points.length]!;
			segments.push({
				identity: loop.edgeIdentities[index] ?? '',
				positions: [...world(point), ...world(next)]
			});
		});
	}
	return segments;
}

/** One group's open (unclosed) chain positions, as independent pairs. */
export function openChainSegments(
	chains: readonly { readonly points: readonly (readonly [number, number])[] }[],
	basis: SectionBasis,
	y: number,
	originXZ: readonly [number, number]
): number[] {
	const world = ([u, v]: readonly [number, number]): [number, number, number] => [
		originXZ[0] + u * basis.u[0] + v * basis.v[0],
		y,
		originXZ[1] + u * basis.u[2] + v * basis.v[2]
	];
	const positions: number[] = [];
	for (const chain of chains) {
		for (let index = 0; index + 1 < chain.points.length; index += 1) {
			positions.push(...world(chain.points[index]!), ...world(chain.points[index + 1]!));
		}
	}
	return positions;
}

/**
 * Add **one group's** edges to a collection that spans every cap group.
 *
 * The section has one group per independent solid: the Wall structure union and one
 * per Layout object. Each group fills its own cap, and each group's outline must
 * survive the next group's collection — replacing the collection instead of appending
 * left only the last group's outline (and dropped an earlier group's open warning
 * edges with it).
 */
/** Append one group's edges through a full basis: the SL2 renderer path. */
export function appendSectionEdgesWorld(
	collection: { readonly segments: SectionEdgeSegment[]; readonly open: number[] },
	loops: readonly SectionLoop[],
	chains: readonly { readonly points: readonly (readonly [number, number])[] }[],
	basis: SectionWorldBasis
): void {
	collection.segments.push(...sectionEdgeSegmentsWorld(loops, basis));
	collection.open.push(...openChainSegmentsWorld(chains, basis));
}

export function appendSectionEdges(
	collection: { readonly segments: SectionEdgeSegment[]; readonly open: number[] },
	loops: readonly SectionLoop[],
	chains: readonly { readonly points: readonly (readonly [number, number])[] }[],
	basis: SectionBasis,
	y: number,
	originXZ: readonly [number, number]
): void {
	collection.segments.push(...sectionEdgeSegments(loops, basis, y, originXZ));
	collection.open.push(...openChainSegments(chains, basis, y, originXZ));
}
