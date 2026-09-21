/**
 * `layout-junction-resolution.ts` — P23.15 Junction-local resolution.
 *
 * The durable model is a pure, renderer-neutral **network-aware** solve:
 *
 * ```text
 * CompiledJunction + incident compiled Wall endpoint facts
 *         ↓
 * CompiledJunctionResolution
 *         ↓
 * resolved Wall-end geometry for every incident Wall
 * ```
 *
 * A Junction resolver inspects every canonical incident leg together before any
 * Wall endpoint geometry is determined. Per-Wall meshes may stay the packaging
 * unit, but per-Wall geometry solving does not happen here or in the renderer.
 *
 * Three conventions make this unambiguous:
 *
 * 1. **Outward frames.** Every leg's `tangentOut`/`normalOut` point from the
 *    Junction into the Wall, so canonical Wall orientation never leaks into the
 *    classification.
 * 2. **Continuity is a centerline relationship.** Degree-2 with outward rays
 *    ≈180° is a straight continuation (suppress the common interface); a real
 *    tangent break is a bend; outward rays ≈0° is a fold (invalid).
 * 3. **Ownership is branch-cut-independent.** Angular order is used for cyclic
 *    adjacency, never for physical ownership.
 *
 * No renderer, no Three.js, no editor/museum state, no second curve abstraction:
 * leg facts come from the incident `CompiledPhysicalWall` samples the P23.11
 * evaluator already produced.
 */
import type { LayoutVec2 } from './layout-types';
import {
	geometryId,
	type CompiledCornerSide,
	type CompiledEndCorner,
	type CompiledJunction,
	type CompiledEndpointBand,
	type CompiledJunctionLeg,
	type CompiledJunctionNeighbor,
	type CompiledJunctionResolution,
	type CompiledLegJoin,
	type CompiledWallSection,
	type LayoutBounds2,
	type LayoutGeometryIssue
} from './layout-geometry-types';

/** Parallel rays closer than this `|det|` are treated as collinear. */
export const JUNCTION_DET_EPSILON = 1e-9;
/** A miter apex beyond `miterLimit × thickness` becomes a bevel. */
export const JUNCTION_MITER_LIMIT = 4;
/** Arcs shorter than this are zero-span and not emitted. */
export const JUNCTION_BAND_EPSILON = 1e-6;

export function negateVec2(v: LayoutVec2): LayoutVec2 {
	return [-v[0], -v[1]];
}

/** The outward ray of a leg (from the Junction into the Wall), normalised. */
export function outwardTangent(leg: CompiledJunctionLeg): LayoutVec2 {
	const length = Math.hypot(leg.tangentOut[0], leg.tangentOut[1]) || 1;
	return [leg.tangentOut[0] / length, leg.tangentOut[1] / length];
}

/** Cross product of two plan vectors (`a × b`). */
function cross(a: LayoutVec2, b: LayoutVec2): number {
	return a[0] * b[1] - a[1] * b[0];
}

function dot(a: LayoutVec2, b: LayoutVec2): number {
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

function swapCorner(corner: CompiledEndCorner): CompiledEndCorner {
	return { front: swapCornerSide(corner.front), back: swapCornerSide(corner.back) };
}

/**
 * Adapt a canonical `(prev, cur)` corner to a specific leg. `canonical === 'prev'`
 * means the leg owns the `a0` slot; `'cur'` owns `b0`. A leg whose Junction end
 * is `end` reads `a0`, a leg whose end is `start` reads `b0`, so a role/label
 * mismatch swaps the offset slots (miters are unaffected).
 */
function cornerForEnd(corner: CompiledEndCorner, canonical: 'prev' | 'cur', end: 'start' | 'end'): CompiledEndCorner {
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

/**
 * Solid/void vertical bands at a Wall endpoint, from its compiled sections —
 * the already-compiled Opening endpoint fact the solve needs (Decision 10).
 * Never re-reads `LayoutDocument`.
 */
export function endpointSolidBands(
	sections: readonly CompiledWallSection[],
	atDistance: number,
	height: number,
	epsilon = JUNCTION_BAND_EPSILON
): CompiledEndpointBand[] {
	const intervals: Array<{ lo: number; hi: number; openingId?: string }> = [];
	const openingIds: string[] = [];
	for (const section of sections) {
		if (atDistance < section.startDistance - epsilon || atDistance > section.endDistance + epsilon) continue;
		if (section.openingId && !openingIds.includes(section.openingId)) openingIds.push(section.openingId);
		const lo = Math.max(0, section.bottomY);
		const hi = Math.min(height, section.topY);
		if (hi <= lo + epsilon) continue;
		intervals.push(section.openingId ? { lo, hi, openingId: section.openingId } : { lo, hi });
	}
	if (intervals.length === 0) return [{ bottomY: 0, topY: height, solid: true }];
	intervals.sort((a, b) => a.lo - b.lo || a.hi - b.hi);
	const bands: CompiledEndpointBand[] = [];
	const voidBand = (bottomY: number, topY: number): CompiledEndpointBand => {
		const band: CompiledEndpointBand = { bottomY, topY, solid: false };
		if (openingIds[0]) band.openingId = openingIds[0];
		return band;
	};
	let cursor = 0;
	for (const interval of intervals) {
		const lo = Math.max(interval.lo, cursor);
		if (lo > cursor + epsilon) bands.push(voidBand(cursor, lo));
		const hi = Math.max(lo, interval.hi);
		if (hi > lo + epsilon) {
			const band: CompiledEndpointBand = { bottomY: lo, topY: hi, solid: true };
			if (interval.openingId) band.openingId = interval.openingId;
			bands.push(band);
		}
		cursor = Math.max(cursor, hi);
	}
	if (cursor < height - epsilon) bands.push(voidBand(cursor, height));
	return bands;
}

/** Union of every leg's vertical extent and endpoint bands, as ordered intervals. */
function unionBands(legs: readonly CompiledJunctionLeg[]): Array<{ bottomY: number; topY: number }> {
	const edges = new Set<number>();
	for (const leg of legs) {
		edges.add(leg.bottomY);
		edges.add(leg.topY);
		for (const band of leg.endpointSolidBands) {
			edges.add(band.bottomY);
			edges.add(band.topY);
		}
	}
	const sorted = [...edges].sort((a, b) => a - b);
	const bands: Array<{ bottomY: number; topY: number }> = [];
	for (let i = 1; i < sorted.length; i += 1) {
		const lo = sorted[i - 1]!;
		const hi = sorted[i]!;
		if (hi - lo <= JUNCTION_BAND_EPSILON) continue;
		bands.push({ bottomY: lo, topY: hi });
	}
	return bands;
}

/**
 * Resolve one canonical Junction into Wall-attributed end geometry.
 *
 * The Junction does **not** become a physical owner: every emitted join carries
 * its Wall's `wallId` and Junction `end`, and any wedge is attributed to one
 * incident Wall by a branch-cut-independent rule.
 */
export function resolveJunctionGeometry(
	junctionId: string,
	point: LayoutVec2,
	legs: readonly CompiledJunctionLeg[],
	options: { miterLimit?: number } = {}
): { resolution: CompiledJunctionResolution; issues: LayoutGeometryIssue[] } {
	const miterLimit = options.miterLimit ?? JUNCTION_MITER_LIMIT;
	const issues: LayoutGeometryIssue[] = [];
	const legOrder = legs.map((leg) => ({ wallId: leg.wallId, end: leg.end }));
	const bands = unionBands(legs);
	const joins: CompiledLegJoin[] = [];

	if (legs.length === 0) {
		return { resolution: { junctionId, legOrder, joins, bounds2: { min: [...point] as LayoutVec2, max: [...point] as LayoutVec2 } }, issues };
	}

	if (legs.length === 1) {
		joins.push(terminalJoin(legs[0]!, bands));
		return { resolution: { junctionId, legOrder, joins, bounds2: joinsBounds2(point, joins) }, issues };
	}

	if (legs.length === 2) {
		const [a, b] = legs as [CompiledJunctionLeg, CompiledJunctionLeg];
		if (isFoldPair(a, b)) {
			issues.push(foldIssue(junctionId));
			joins.push(suppressedJoin(a, bands), suppressedJoin(b, bands));
			return { resolution: { junctionId, legOrder, joins, bounds2: joinsBounds2(point, joins) }, issues };
		}
		if (isTangentContinuation(a, b)) {
			// Straight continuation: suppress the common interface. Any thickness /
			// height / opening-profile difference is emitted as an exposed step by
			// the consumer from the two legs' bands.
			joins.push(suppressedJoin(a, bands, neighborFacts(b)), suppressedJoin(b, bands, neighborFacts(a)));
			return { resolution: { junctionId, legOrder, joins, bounds2: joinsBounds2(point, joins) }, issues };
		}
		// Canonical roles: prefer the departing (start) leg as `cur`.
		const swap = a.end === 'start' && b.end === 'end';
		const prev = swap ? b : a;
		const cur = swap ? a : b;
		const resolved = resolveLegPairCorner(point, prev, cur, miterLimit);
		if ('fold' in resolved) {
			issues.push(foldIssue(junctionId));
			joins.push(suppressedJoin(prev, bands), suppressedJoin(cur, bands));
			return { resolution: { junctionId, legOrder, joins, bounds2: joinsBounds2(point, joins) }, issues };
		}
		// One owner per seam. Prefer the start leg (the bridge builder is
		// start-oriented); otherwise the smaller wallId — never an angle.
		const ownerWallId =
			cur.end === 'start' ? cur.wallId : prev.end === 'start' ? prev.wallId : prev.wallId <= cur.wallId ? prev.wallId : cur.wallId;
		const seam = { sector: 0, polygon: wedgePolygon(point, prev, cur) };
		joins.push(
			cornerJoin(prev, bands, cornerForEnd(resolved.corner, 'prev', prev.end), ownerWallId === prev.wallId ? seam : null, {
				canonicalRole: 'prev',
				canonicalCorner: resolved.corner,
				neighbor: neighborFacts(cur)
			}),
			cornerJoin(cur, bands, cornerForEnd(resolved.corner, 'cur', cur.end), ownerWallId === cur.wallId ? seam : null, {
				canonicalRole: 'cur',
				canonicalCorner: resolved.corner,
				neighbor: neighborFacts(prev)
			})
		);
		return { resolution: { junctionId, legOrder, joins, bounds2: joinsBounds2(point, joins) }, issues };
	}

	// degree >= 3 — resolve across all incident legs. Each leg is paired with its
	// angular predecessor; a tangent pair suppresses both, a real corner is
	// emitted, and a wedge already covered by another leg is suppressed so the
	// region is partitioned instead of re-painted.
	for (let i = 0; i < legs.length; i += 1) {
		const leg = legs[i]!;
		const prev = legs[(i - 1 + legs.length) % legs.length]!;
		if (isFoldPair(prev, leg)) {
			issues.push(foldIssue(junctionId));
			joins.push(suppressedJoin(leg, bands));
			continue;
		}
		if (isTangentContinuation(prev, leg)) {
			joins.push(suppressedJoin(leg, bands));
			continue;
		}
		const resolved = resolveLegPairCorner(point, prev, leg, miterLimit);
		if ('fold' in resolved) {
			issues.push(foldIssue(junctionId));
			joins.push(suppressedJoin(leg, bands));
			continue;
		}
		const covered = wedgeCoveredByOthers(point, prev, leg, legs);
		const seam = covered ? null : { sector: i, polygon: wedgePolygon(point, prev, leg) };
		joins.push(
			cornerJoin(leg, bands, cornerForEnd(resolved.corner, 'cur', leg.end), seam, {
				canonicalRole: 'cur',
				canonicalCorner: resolved.corner,
				neighbor: neighborFacts(prev)
			})
		);
	}

	return { resolution: { junctionId, legOrder, joins, bounds2: joinsBounds2(point, joins) }, issues };
}

function terminalJoin(leg: CompiledJunctionLeg, bands: Array<{ bottomY: number; topY: number }>): CompiledLegJoin {
	return {
		wallId: leg.wallId,
		end: leg.end,
		kind: 'terminal',
		endBoundary: [],
		interfaceSuppressed: false,
		ownedSeam: null,
		bands: bands.map((band) => ({ bottomY: band.bottomY, topY: band.topY })),
		corner: null
	};
}

function neighborFacts(leg: CompiledJunctionLeg): CompiledJunctionNeighbor {
	return {
		wallId: leg.wallId,
		tangentOut: leg.tangentOut,
		normalOut: leg.normalOut,
		halfThickness: leg.halfThickness,
		endpointOpen: leg.endpointOpen,
		endpointSolidBands: leg.endpointSolidBands
	};
}

function suppressedJoin(
	leg: CompiledJunctionLeg,
	bands: Array<{ bottomY: number; topY: number }>,
	neighbor?: CompiledJunctionNeighbor
): CompiledLegJoin {
	return {
		wallId: leg.wallId,
		end: leg.end,
		kind: 'suppressed',
		endBoundary: [],
		interfaceSuppressed: true,
		ownedSeam: null,
		bands: bands.map((band) => ({ bottomY: band.bottomY, topY: band.topY })),
		corner: null,
		...(neighbor ? { neighbor } : {})
	};
}

function cornerJoin(
	leg: CompiledJunctionLeg,
	bands: Array<{ bottomY: number; topY: number }>,
	corner: CompiledEndCorner,
	ownedSeam: { sector: number; polygon: LayoutVec2[] } | null,
	meta: { canonicalRole: 'prev' | 'cur'; canonicalCorner: CompiledEndCorner; neighbor: CompiledJunctionNeighbor }
): CompiledLegJoin {
	const kind: CompiledLegJoin['kind'] =
		corner.front.kind === 'bevel' || corner.back.kind === 'bevel' ? 'bevel' : 'miter';
	return {
		wallId: leg.wallId,
		end: leg.end,
		kind,
		endBoundary: [],
		interfaceSuppressed: false,
		ownedSeam,
		bands: bands.map((band) => ({ bottomY: band.bottomY, topY: band.topY })),
		corner,
		canonicalRole: meta.canonicalRole,
		canonicalCorner: meta.canonicalCorner,
		neighbor: meta.neighbor
	};
}

function foldIssue(junctionId: string): LayoutGeometryIssue {
	return {
		path: `junctions.${junctionId}`,
		code: 'junction_seam_fold',
		message: 'Junction has two legs pointing the same direction (fold); offset regions would overlap.',
		targetId: junctionId
	};
}

/** The plan polygon of the material wedge between two incident legs. */
function wedgePolygon(junction: LayoutVec2, prev: CompiledJunctionLeg, cur: CompiledJunctionLeg): LayoutVec2[] {
	const a0: LayoutVec2 = [junction[0] - prev.halfThickness * prev.normalOut[0], junction[1] - prev.halfThickness * prev.normalOut[1]];
	const b0: LayoutVec2 = [junction[0] + cur.halfThickness * cur.normalOut[0], junction[1] + cur.halfThickness * cur.normalOut[1]];
	return [[...junction] as LayoutVec2, a0, b0];
}

/** Is the wedge between two adjacent legs already covered by a third leg? */
function wedgeCoveredByOthers(
	junction: LayoutVec2,
	prev: CompiledJunctionLeg,
	cur: CompiledJunctionLeg,
	legs: readonly CompiledJunctionLeg[]
): boolean {
	const polygon = wedgePolygon(junction, prev, cur);
	const centroid: LayoutVec2 = [
		(polygon[0]![0] + polygon[1]![0] + polygon[2]![0]) / 3,
		(polygon[0]![1] + polygon[1]![1] + polygon[2]![1]) / 3
	];
	if (Math.hypot(centroid[0] - junction[0], centroid[1] - junction[1]) <= JUNCTION_BAND_EPSILON) return true;
	return legs.some((leg) => {
		if (leg === prev || leg === cur) return false;
		return pointInLegFootprint(centroid, junction, leg);
	});
}

/** Is `point` inside the leg's own solid footprint (half-thickness band)? */
function pointInLegFootprint(point: LayoutVec2, junction: LayoutVec2, leg: CompiledJunctionLeg): boolean {
	const t = outwardTangent(leg);
	const n = leg.normalOut;
	const dx = point[0] - junction[0];
	const dy = point[1] - junction[1];
	const along = dx * t[0] + dy * t[1];
	const lateral = dx * n[0] + dy * n[1];
	return along >= -JUNCTION_BAND_EPSILON && Math.abs(lateral) <= leg.halfThickness + JUNCTION_BAND_EPSILON;
}

function joinsBounds2(junction: LayoutVec2, joins: readonly CompiledLegJoin[]): LayoutBounds2 {
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

/** Stable compiled identity for a Junction (logical identity only). */
export function compiledJunctionId(floorId: string, junctionId: string): string {
	return geometryId(['compiled-junction', floorId, junctionId]);
}

/** One Wall's resolved Junction ends — the shape a Wall-level builder consumes. */
export type CompiledWallEnds = {
	start: CompiledLegJoin | null;
	end: CompiledLegJoin | null;
};

/**
 * `wallId` → its resolved end record, for consumers that package geometry
 * per Wall. A **pure lookup** over already-compiled Junction facts: it never
 * re-reads `LayoutDocument` and never solves topology. A Wall end with no
 * compiled Junction leaves that slot `null` (a free/terminal end); an end bound
 * to a Junction that resolved without a join for it is also `null`, which a
 * consumer must treat as an invariant failure rather than a square-cap
 * fallback.
 */
export function legJoinsByWall(junctions: readonly CompiledJunction[] | undefined): Map<string, CompiledWallEnds> {
	const ends = new Map<string, CompiledWallEnds>();
	for (const junction of junctions ?? []) {
		for (const join of junction.resolution.joins) {
			const entry = ends.get(join.wallId) ?? { start: null, end: null };
			entry[join.end] = join;
			ends.set(join.wallId, entry);
		}
	}
	return ends;
}
