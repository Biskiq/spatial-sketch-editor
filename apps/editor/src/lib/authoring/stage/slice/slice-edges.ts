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
