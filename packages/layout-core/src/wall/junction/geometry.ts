import type { LayoutVec2 } from '../../geometry/coordinates';
import { ivAdd, ivEncloseWorld, ivMul, ivSub } from '../../geometry/binary64-interval';
import type { CompiledCornerSide, CompiledEndCorner, CompiledJunctionLeg, CompiledLegJoin, LayoutBounds2 } from '../../geometry/types';

/** Parallel rays closer than this `|det|` are treated as collinear. */
export const JUNCTION_DET_EPSILON = 1e-9;

/** A miter apex beyond `miterLimit × thickness` becomes a bevel. */
export const JUNCTION_MITER_LIMIT = 4;

/** Arcs shorter than this are zero-span and not emitted. */
export const JUNCTION_BAND_EPSILON = 1e-6;

/** How far a keel-edge probe steps out of the resolved region to classify it. */
export const JUNCTION_SURFACE_PROBE = 1e-4;

/**
 * Tolerance for cleaning a solved sector region: a vertex this close to the
 * Wall's own offset face is the face (clipping a convex band by a line that
 * nearly grazes the band otherwise leaves sub-micron slivers), and two vertices
 * this close are one.
 */
export const JUNCTION_SECTOR_SNAP = 1e-5;

/** Slop when asking whether a probe is inside a leg's own compiled body. */
export const JUNCTION_PROBE_TOLERANCE = 1e-9;


export function negateVec2(v: LayoutVec2): LayoutVec2 {
	return [-v[0], -v[1]];
}


/** The outward ray of a leg (from the Junction into the Wall), normalised. */
export function outwardTangent(leg: CompiledJunctionLeg): LayoutVec2 {
	const length = Math.hypot(leg.tangentOut[0], leg.tangentOut[1]) || 1;
	return [leg.tangentOut[0] / length, leg.tangentOut[1] / length];
}


/** Cross product of two plan vectors (`a × b`). */
export function cross(a: LayoutVec2, b: LayoutVec2): number {
	return a[0] * b[1] - a[1] * b[0];
}


export function dot(a: LayoutVec2, b: LayoutVec2): number {
	return a[0] * b[0] + a[1] * b[1];
}


export type CornerSideResolution =
	| { kind: 'side'; side: CompiledCornerSide }
	| { kind: 'fold' };


/**
 * Resolve one side (`sign = +1` front, `-1` back) of a corner between an
 * arriving wall (`dirA`/`nA`/`halfA`) and a departing wall (`dirB`/`nB`/`halfB`).
 * This is the **one** implementation of the offset-intersection / miter-limit
 * arithmetic; the room-loop path calls it too rather than keeping a copy.
 *
 * Generalised over per-wall half-thickness so mixed-thickness Junctions resolve
 * without a second rule.
 */
export function resolveSharedCornerSide(
	junction: LayoutVec2,
	dirA: LayoutVec2,
	nA: LayoutVec2,
	halfA: number,
	dirB: LayoutVec2,
	nB: LayoutVec2,
	halfB: number,
	sign: 1 | -1,
	miterLimit = JUNCTION_MITER_LIMIT
): CornerSideResolution {
	const a0: LayoutVec2 = [junction[0] + sign * halfA * nA[0], junction[1] + sign * halfA * nA[1]];
	const b0: LayoutVec2 = [junction[0] + sign * halfB * nB[0], junction[1] + sign * halfB * nB[1]];
	const determinant = cross(dirA, dirB);
	const direction = dot(dirA, dirB);
	if (Math.abs(determinant) < JUNCTION_DET_EPSILON) {
		// Antiparallel travel directions are a fold; parallel is a continuation.
		if (direction < 0) return { kind: 'fold' };
		return { kind: 'side', side: { kind: 'miter', apex: a0 } };
	}
	const dx = b0[0] - a0[0];
	const dy = b0[1] - a0[1];
	const u = (dx * dirB[1] - dy * dirB[0]) / determinant;
	const point: LayoutVec2 = [a0[0] + u * dirA[0], a0[1] + u * dirA[1]];
	const reach = Math.max(Math.abs(halfA), Math.abs(halfB));
	if (reach > 0 && Math.hypot(point[0] - junction[0], point[1] - junction[1]) > miterLimit * reach) {
		return { kind: 'side', side: { kind: 'bevel', a0, b0 } };
	}
	return { kind: 'side', side: { kind: 'miter', apex: point } };
}


/**
 * The canonical corner between a **predecessor** leg `prev` (a0 side) and a
 * **successor** leg `cur` (b0 side), in the outward convention: `a0` sits on
 * `prev`'s offset line and `b0` on `cur`'s. The renderer reads `a0` for a leg
 * whose Junction end is `end` and `b0` for one whose Junction end is `start`, so
 * `cornerForEnd` below adapts the roles when a leg's canonical role and its
 * end label differ (common with arbitrary canonical Wall orientation).
 */
export function resolveLegPairCorner(
	junction: LayoutVec2,
	prev: CompiledJunctionLeg,
	cur: CompiledJunctionLeg,
	miterLimit = JUNCTION_MITER_LIMIT
): { corner: CompiledEndCorner } | { fold: true } {
	// prev arrives (`-tangentOut`), cur departs (`tangentOut`).
	const dirA = negateVec2(outwardTangent(prev));
	const nA = negateVec2(prev.normalOut);
	const dirB = outwardTangent(cur);
	const nB = cur.normalOut;
	const front = resolveSharedCornerSide(junction, dirA, nA, prev.halfThickness, dirB, nB, cur.halfThickness, 1, miterLimit);
	const back = resolveSharedCornerSide(junction, dirA, nA, prev.halfThickness, dirB, nB, cur.halfThickness, -1, miterLimit);
	if (front.kind === 'fold' || back.kind === 'fold') return { fold: true };
	return { corner: { front: front.side, back: back.side } };
}


function swapCornerSide(side: CompiledCornerSide): CompiledCornerSide {
	return side.kind === 'miter' ? side : { kind: 'bevel', a0: side.b0, b0: side.a0 };
}


/**
 * The corner as the other role reads it. The canonical front is `-prev.normalOut`
 * and `cur.normalOut`, so a leg in the opposite role has its own front on the
 * canonical back, and its own offset line in the other slot.
 */
function swapCorner(corner: CompiledEndCorner): CompiledEndCorner {
	return { front: swapCornerSide(corner.back), back: swapCornerSide(corner.front) };
}


/**
 * Adapt a canonical `(prev, cur)` corner to a specific leg. `canonical === 'prev'`
 * means the leg owns the `a0` slot; `'cur'` owns `b0`. A leg whose Junction end
 * is `end` reads `a0`, a leg whose end is `start` reads `b0`, so a role/label
 * mismatch exchanges the sides and swaps the offset slots.
 */
export function cornerForEnd(corner: CompiledEndCorner, canonical: 'prev' | 'cur', end: 'start' | 'end'): CompiledEndCorner {
	const wantsA0 = end === 'end';
	const isA0 = canonical === 'prev';
	return wantsA0 === isA0 ? corner : swapCorner(corner);
}


/** Is the outward-ray pair a tangent (straight) continuation? */
export function isTangentContinuation(a: CompiledJunctionLeg, b: CompiledJunctionLeg): boolean {
	const ta = outwardTangent(a);
	const tb = outwardTangent(b);
	return Math.abs(cross(ta, tb)) < JUNCTION_DET_EPSILON && dot(ta, tb) < 0;
}


/** Can the stored derivative anchors represent antiparallel rays at their shared Junction? */
export function tangentAnchorsAllowContinuation(point: LayoutVec2, [a, b]: readonly [LayoutVec2, LayoutVec2]): boolean {
	const ox = ivEncloseWorld(point[0]);
	const oz = ivEncloseWorld(point[1]);
	const ax = ivSub(ivEncloseWorld(a[0]), ox);
	const az = ivSub(ivEncloseWorld(a[1]), oz);
	const bx = ivSub(ivEncloseWorld(b[0]), ox);
	const bz = ivSub(ivEncloseWorld(b[1]), oz);
	const determinant = ivSub(ivMul(ax, bz), ivMul(az, bx));
	return determinant.lo <= 0 && determinant.hi >= 0 && ivAdd(ivMul(ax, bx), ivMul(az, bz)).hi < 0;
}


/** Is the outward-ray pair a fold (≈0°, walls overlap)? */
export function isFoldPair(a: CompiledJunctionLeg, b: CompiledJunctionLeg): boolean {
	const ta = outwardTangent(a);
	const tb = outwardTangent(b);
	return Math.abs(cross(ta, tb)) < JUNCTION_DET_EPSILON && dot(ta, tb) > 0;
}


/** The leg's own end cross-section, front → back, in plan. */
export function legEndBoundary(junction: LayoutVec2, leg: CompiledJunctionLeg): LayoutVec2[] {
	const h = leg.halfThickness;
	const n = leg.normalOut;
	return [
		[junction[0] + h * n[0], junction[1] + h * n[1]],
		[junction[0] - h * n[0], junction[1] - h * n[1]]
	];
}


export function joinsBounds2(junction: LayoutVec2, joins: readonly CompiledLegJoin[]): LayoutBounds2 {
	let minX = junction[0];
	let minY = junction[1];
	let maxX = junction[0];
	let maxY = junction[1];
	const consider = (p: LayoutVec2): void => {
		minX = Math.min(minX, p[0]);
		minY = Math.min(minY, p[1]);
		maxX = Math.max(maxX, p[0]);
		maxY = Math.max(maxY, p[1]);
	};
	for (const join of joins) {
		for (const p of join.endBoundary) consider(p);
		if (join.ownedSeam) for (const p of join.ownedSeam.polygon) consider(p);
		// A resolved keel is emitted material too, so the Junction region bounds
		// must contain the sector wedge this Wall owns near the Junction.
		if (join.keel) {
			for (const region of join.keel.regions) for (const p of region) consider(p);
		}
		// Resolved Wall-attributed difference/trim surfaces are emitted geometry
		// too, so the Junction region bounds must contain them.
		for (const surface of join.surfaces ?? []) {
			// A free end's cap lies on the Wall's own footprint; it adds no Junction region.
			if (surface.kind === 'terminal-cap') continue;
			consider(surface.from);
			consider(surface.to);
		}
		if (join.corner) {
			for (const side of [join.corner.front, join.corner.back]) {
				if (side.kind === 'miter') consider(side.apex);
				else {
					consider(side.a0);
					consider(side.b0);
				}
			}
		}
	}
	return { min: [minX, minY], max: [maxX, maxY] };
}
