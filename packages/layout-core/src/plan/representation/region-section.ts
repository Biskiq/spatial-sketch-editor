/**
 * `region-section.ts` — Plan candidates and the cut section of a shed or gable Region.
 *
 * A flat Region is one slab at one level, so one candidate with its footprint is exact.
 * A sloped Region has no single level: a horizontal cut through it crosses only the
 * band of the footprint where `underside(p) <= cutY <= underside(p) + thickness`.
 * Drawing the whole footprint as `cut` would claim a section the solid does not have.
 *
 * The compiled underside is already split into planar pieces (one per side of the
 * ridge, from the shared form compiler), and the underside is affine on each piece.
 * So each piece is one candidate with its own vertical extent — the same stream rule
 * then classifies each side on its own — and a cut piece's polygon is the piece
 * clipped by the two half-planes `underside <= cutY` and `underside >= cutY - thickness`.
 * Both are linear in plan over a piece, so clipping by vertex value is exact.
 *
 * A non-convex piece whose band falls apart is clipped as one ring, so it can carry a
 * zero-area seam on a clip line; the area and every true edge are exact.
 */
import type { LayoutVec2 } from '../../geometry/coordinates';
import type { CompiledRegion } from '../../geometry/types';
import type { Candidate, SourcePlan } from './types';

/** Per-vertex underside Y of a sloped piece, aligned with its polygon, and its thickness. */
export type RegionSlabPiece = {
	readonly undersideY: readonly number[];
	readonly thickness: number;
};

type Vertex = { readonly point: LayoutVec2; readonly y: number };

/** Keep the vertices with `y <= limit` (or `>=`), interpolating exactly on crossing edges. */
function clipRing(ring: readonly Vertex[], limit: number, keepBelow: boolean): Vertex[] {
	const inside = (vertex: Vertex): boolean => (keepBelow ? vertex.y <= limit : vertex.y >= limit);
	const out: Vertex[] = [];
	for (let index = 0; index < ring.length; index++) {
		const current = ring[index]!;
		const next = ring[(index + 1) % ring.length]!;
		const currentIn = inside(current);
		const nextIn = inside(next);
		if (currentIn) out.push(current);
		if (currentIn !== nextIn) {
			const t = (limit - current.y) / (next.y - current.y);
			out.push({
				point: [
					current.point[0] + (next.point[0] - current.point[0]) * t,
					current.point[1] + (next.point[1] - current.point[1]) * t,
				],
				y: limit,
			});
		}
	}
	return out;
}

/**
 * The cut section of one sloped piece at `cutY`, or the piece's own plan when the
 * candidate is not a sloped piece or the band is degenerate.
 */
export function regionSectionPlan(candidate: Candidate, cutY: number): SourcePlan {
	const slab = candidate.regionSlab;
	const plan = candidate.plan;
	if (slab === undefined || plan.kind !== 'polygon') return plan;
	let ring: Vertex[] = plan.polygon.map((point, index) => ({
		point,
		y: slab.undersideY[index]!,
	}));
	ring = clipRing(ring, cutY, true);
	ring = clipRing(ring, cutY - slab.thickness, false);
	const polygon: LayoutVec2[] = [];
	for (const { point } of ring) {
		const last = polygon[polygon.length - 1];
		if (last === undefined || last[0] !== point[0] || last[1] !== point[1]) polygon.push(point);
	}
	const first = polygon[0];
	const last = polygon[polygon.length - 1];
	if (polygon.length > 1 && first![0] === last![0] && first![1] === last![1]) polygon.pop();
	return polygon.length >= 3 ? { kind: 'polygon', polygon } : plan;
}

/** One compiled Region's Plan candidates: the footprint when flat, one per planar piece when sloped. */
export function regionCandidatesOf(region: CompiledRegion): Candidate[] {
	const flat: Candidate = {
		sourceKind: 'region',
		sourceId: region.regionId,
		extent: { minY: region.bottomY, maxY: region.topY },
		plan: { kind: 'polygon', polygon: region.footprint },
		subRef: null,
		symbolOnly: false,
		regionRole: region.role,
		regionKey: region.cacheKey,
	};
	if (region.form === undefined || region.form.kind === 'flat') return [flat];
	const thickness = region.thickness ?? 0;
	const pieces: Candidate[] = [];
	for (const face of region.faces) {
		if (face.surface !== 'underside' || face.polygon.length < 3) continue;
		const undersideY = face.polygon.map((vertex) => vertex[1]);
		pieces.push({
			...flat,
			extent: { minY: Math.min(...undersideY), maxY: Math.max(...undersideY) + thickness },
			plan: {
				kind: 'polygon',
				polygon: face.polygon.map((vertex): LayoutVec2 => [vertex[0], vertex[2]]),
			},
			regionSlab: { undersideY, thickness },
		});
	}
	return pieces.length > 0 ? pieces : [flat];
}
