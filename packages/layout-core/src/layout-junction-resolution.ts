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
import { p2311Measure } from './p2311-perf';
import {
	geometryId,
	type CompiledCornerSide,
	type CompiledEndCorner,
	type CompiledJunction,
	type CompiledEndpointBand,
	type CompiledJunctionInterface,
	type CompiledJunctionLeg,
	type CompiledJunctionNeighbor,
	type CompiledJunctionResolution,
	type CompiledJunctionSurface,
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
			joins.push(suppressedJoin(a, bands, undefined, undefined, true), suppressedJoin(b, bands, undefined, undefined, true));
			return { resolution: { junctionId, legOrder, joins, bounds2: joinsBounds2(point, joins) }, issues };
		}
		if (isTangentContinuation(a, b)) {
			// Straight continuation: suppress the common interface. The difference
			// surfaces (thickness / height / Opening-profile) are solved **here**, per
			// vertical band, and attached to the leg that owns the material — the
			// consumer only triangulates them (no builder-side solve).
			const step = p2311Measure('junction-step', () => continuationSurfaces(point, a, b, []));
			// Each resolved surface is attached to its owner once: the difference
			// step ownership (`forA`/`forB`) is what makes Wall attribution follow
			// the material, and re-pushing `surfaces` would double-paint it.
			joins.push(
				suppressedJoin(a, bands, neighborFacts(b), step.forA),
				suppressedJoin(b, bands, neighborFacts(a), step.forB)
			);
			return { resolution: { junctionId, legOrder, joins, bounds2: joinsBounds2(point, joins) }, issues };
		}
		// Canonical roles: prefer the departing (start) leg as `cur`.
		const swap = a.end === 'start' && b.end === 'end';
		const prev = swap ? b : a;
		const cur = swap ? a : b;
		const resolved = resolveLegPairCorner(point, prev, cur, miterLimit);
		if ('fold' in resolved) {
			issues.push(foldIssue(junctionId));
			joins.push(suppressedJoin(prev, bands, undefined, undefined, true), suppressedJoin(cur, bands, undefined, undefined, true));
			return { resolution: { junctionId, legOrder, joins, bounds2: joinsBounds2(point, joins) }, issues };
		}
		// One owner per seam, decided **after** the sector is identified and never
		// from an angle: the start leg (the bridge builder is start-oriented),
		// falling back to the smaller `wallId` when both or neither qualify.
		// `atan2`'s branch cut can then never move physical ownership.
		const owner =
			cur.end === 'start' && prev.end !== 'start'
				? cur
				: prev.end === 'start' && cur.end !== 'start'
					? prev
					: prev.wallId <= cur.wallId
						? prev
						: cur;
		const ownerWallId = owner.wallId;
		// `sector` is the index of the wedge's departing leg in the Junction's
		// cyclic leg order, so a Junction-level validator can map join → sector
		// without a second convention.
		const seam = { sector: legs.indexOf(cur), polygon: wedgePolygon(point, prev, cur) };
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

	// degree >= 3 — resolve across ALL incident legs, then partition the local
	// physical material so no two Wall-owned bodies occupy the same volume.
	//
	// 1. Continuation partners first: a collinear antiparallel pair is one through
	//    Wall split at this Junction, so it suppresses its shared interface (and
	//    still exposes its thickness/height/Opening difference, per band).
	// 2. One **core** is selected deterministically: the continuation pair
	//    containing the smallest `wallId`, else the most nearly antiparallel pair.
	//    The core keeps its own material, exactly as for a plain continuation.
	// 3. Every other leg is **trimmed** at the distance where it leaves the
	//    resolved core material. Its end cross-section is an internal interface
	//    (never a buried cap): the still-exposed parts are emitted as explicit,
	//    Wall-attributed trim surfaces, and the parts that rest on a core face
	//    suppress that face region per vertical band.
	// 4. With **no** continuation pair (Y / star) the Junction is partitioned by
	//    its own beams instead: every cyclically adjacent pair of legs gets one
	//    equal-clearance beam, each leg's material is cut by the two beams that
	//    bound its sector, and the sector wedge a Wall-owned strip cannot express
	//    is published as an explicit Wall-attributed keel. Nothing is left to
	//    interpenetration: a Junction this rule cannot partition fails closed.
	return p2311Measure('junction-partition', () => resolveDegreeThreePlus(junctionId, point, legs, bands, issues, miterLimit));
}

/**
 * Deterministic core selection: which incident legs own the Junction material
 * that every other leg trims against. Rotation-invariant (it never reads an
 * absolute angle zero — only `wallId` order and relative ray geometry).
 */
function selectCore(legs: readonly CompiledJunctionLeg[]): [CompiledJunctionLeg, CompiledJunctionLeg | null] {
	const pairs: Array<[CompiledJunctionLeg, CompiledJunctionLeg]> = [];
	const paired = new Set<string>();
	for (let i = 0; i < legs.length; i += 1) {
		if (paired.has(legs[i]!.wallId)) continue;
		for (let j = i + 1; j < legs.length; j += 1) {
			if (paired.has(legs[j]!.wallId)) continue;
			if (!isTangentContinuation(legs[i]!, legs[j]!)) continue;
			pairs.push([legs[i]!, legs[j]!]);
			paired.add(legs[i]!.wallId);
			paired.add(legs[j]!.wallId);
			break;
		}
	}
	if (pairs.length > 0) {
		pairs.sort((a, b) => compareLegs(a[0], b[0]) || compareLegs(a[1], b[1]));
		return pairs[0]!;
	}
	// No continuation pair: the two legs whose outward rays are most nearly
	// antiparallel span the through region. Ties fall back to `wallId` order, so
	// the choice is stable and rotation-invariant.
	let best: [CompiledJunctionLeg, CompiledJunctionLeg] | null = null;
	let bestScore = Infinity;
	for (let i = 0; i < legs.length; i += 1) {
		for (let j = i + 1; j < legs.length; j += 1) {
			const score = dot(outwardTangent(legs[i]!), outwardTangent(legs[j]!)) + 1;
			if (score < bestScore - JUNCTION_BAND_EPSILON) {
				bestScore = score;
				best = [legs[i]!, legs[j]!];
			}
		}
	}
	if (!best) return [legs[0]!, null];
	return compareLegs(best[0], best[1]) <= 0 ? best : [best[1], best[0]];
}

function compareLegs(a: CompiledJunctionLeg, b: CompiledJunctionLeg): number {
	return a.wallId < b.wallId ? -1 : a.wallId > b.wallId ? 1 : a.end < b.end ? -1 : a.end > b.end ? 1 : 0;
}

/**
 * Partition a degree >= 3 Junction: core material + deterministic Wall-attributed
 * trims for every other leg. No interpenetration is relied on for correctness.
 */
function resolveDegreeThreePlus(
	junctionId: string,
	point: LayoutVec2,
	legs: readonly CompiledJunctionLeg[],
	bands: Array<{ bottomY: number; topY: number }>,
	issues: LayoutGeometryIssue[],
	miterLimit: number
): { resolution: CompiledJunctionResolution; issues: LayoutGeometryIssue[] } {
	const legOrder = legs.map((leg) => ({ wallId: leg.wallId, end: leg.end }));
	const joins: CompiledLegJoin[] = [];
	const [coreA, coreB] = selectCore(legs);
	const core = coreB ? [coreA, coreB] : [coreA];
	const coreIds = new Set(core.map((leg) => leg.wallId));
	// The partition trims every branch against the **core's own material**. That
	// is exact when a straight-through continuation pair is present: a T/X-style
	// core owns a through strip, so trimming against it cannot open a void. A
	// degree >= 3 Junction with no continuation pair has no through material to
	// trim against, so it keeps the previous behaviour and **records** that its
	// local material is not partitioned yet, instead of passing silently.
	const partitioned = coreB !== null && isTangentContinuation(coreA, coreB);
	if (!partitioned) {
		// No through continuation pair: partition the local material with the
		// Junction's own sector beams (Y / star). `null` means the rule refused the
		// configuration; every leg then carries an unresolved join, which the
		// shared seam rule reports as blocking — never overlapping Wall bodies.
		const star = resolveStarPartition(junctionId, point, legs, bands, issues);
		const starJoins = star?.resolution.joins ?? legs.map((leg) => unresolvedJoin(leg, bands));
		return { resolution: { junctionId, legOrder, joins: starJoins, bounds2: joinsBounds2(point, starJoins) }, issues };
	}

	for (let index = 0; index < legs.length; index += 1) {
		const leg = legs[index]!;
		const previous = legs[(index - 1 + legs.length) % legs.length]!;
		if (isFoldPair(previous, leg)) {
			issues.push(foldIssue(junctionId));
			joins[index] = suppressedJoin(leg, bands, undefined, undefined, true);
			continue;
		}
		if (coreIds.has(leg.wallId)) continue; // emitted below, in core order
		joins[index] = trimJoin(leg, bands, point, core, bands);
	}

	// The core material owns the Junction: a continuation pair suppresses its
	// shared interface and exposes its per-band difference.
	const coreThrough = coreB!;
	const step = continuationSurfaces(point, coreA, coreThrough, legs.filter((leg) => !coreIds.has(leg.wallId)));
	const indexA = legs.indexOf(coreA);
	const indexB = legs.indexOf(coreThrough);
	joins[indexA] = suppressedJoin(coreA, bands, neighborFacts(coreThrough));
	joins[indexB] = suppressedJoin(coreThrough, bands, neighborFacts(coreA));
	for (const surface of step.surfaces) {
		(joins[surface.ownerWallId === coreA.wallId ? indexA : indexB]!.surfaces ??= []).push(surface);
	}
	for (let index = 0; index < legs.length; index += 1) {
		if (!joins[index]) joins[index] = suppressedJoin(legs[index]!, bands);
	}
	void miterLimit;
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

/**
 * The join a leg carries when the Junction's partition rule refuses a
 * configuration. It is deliberately **not** buildable: the shared seam rule
 * (`joinSeamFailure`) reports `junction_seam_uncovered` for it, so the compile
 * gate blocks and no builder emits overlapping Wall bodies. Failing closed is
 * the only alternative to rendering interpenetration.
 */
function unresolvedJoin(leg: CompiledJunctionLeg, bands: Array<{ bottomY: number; topY: number }>): CompiledLegJoin {
	return {
		wallId: leg.wallId,
		end: leg.end,
		kind: 'suppressed',
		endBoundary: [],
		interfaceSuppressed: false,
		ownedSeam: null,
		bands: bands.map((band) => ({ bottomY: band.bottomY, topY: band.topY })),
		corner: null
	};
}

/**
 * A Junction-local **partition beam**: the line separating the material of two
 * cyclically adjacent legs at a degree >= 3 Junction with no continuation pair.
 *
 * It is their equal-clearance bisector — the line through the two *facing* offset
 * lines' intersection, parallel to the sum of the two outward rays — the cyclic
 * generalisation of a corner's inner miter line. Equal *clearance*
 * (`|lateral| - halfThickness`), not equal angle, is what makes mixed thickness
 * fall out of one rule instead of a second special case.
 */
type PartitionBeam = {
	prev: CompiledJunctionLeg;
	next: CompiledJunctionLeg;
	origin: LayoutVec2;
	/** Unit direction of the line. */
	dir: LayoutVec2;
	/** Unit normal of the line. */
	normal: LayoutVec2;
	/** Sign of `normal · p` on `prev`'s material side. */
	prevSide: 1 | -1;
};

function signOf(value: number): 1 | -1 {
	return value >= 0 ? 1 : -1;
}

/** Intersection of two lines given as a point plus a direction, or `null`. */
function lineIntersection(p1: LayoutVec2, d1: LayoutVec2, p2: LayoutVec2, d2: LayoutVec2): LayoutVec2 | null {
	const det = cross(d1, d2);
	if (Math.abs(det) < JUNCTION_DET_EPSILON) return null;
	const dx = p2[0] - p1[0];
	const dy = p2[1] - p1[1];
	const u = (dx * d2[1] - dy * d2[0]) / det;
	return [p1[0] + u * d1[0], p1[1] + u * d1[1]];
}

/** A point on the leg's `sign`-sided offset line (whose own direction is `tangentOut`). */
function offsetLinePoint(junction: LayoutVec2, leg: CompiledJunctionLeg, sign: 1 | -1): LayoutVec2 {
	return [
		junction[0] + sign * leg.halfThickness * leg.normalOut[0],
		junction[1] + sign * leg.halfThickness * leg.normalOut[1]
	];
}

/** Where a leg's `sign`-sided offset line crosses a beam line, or `null`. */
function beamOffsetCrossing(
	junction: LayoutVec2,
	leg: CompiledJunctionLeg,
	sign: 1 | -1,
	beam: PartitionBeam
): LayoutVec2 | null {
	return lineIntersection(offsetLinePoint(junction, leg, sign), outwardTangent(leg), beam.origin, beam.dir);
}

/** The equal-clearance beam separating `a` from `b`, or `null` when unresolvable. */
function partitionBeam(junction: LayoutVec2, a: CompiledJunctionLeg, b: CompiledJunctionLeg): PartitionBeam | null {
	const ta = outwardTangent(a);
	const tb = outwardTangent(b);
	const sx = ta[0] + tb[0];
	const sy = ta[1] + tb[1];
	const magnitude = Math.hypot(sx, sy);
	if (magnitude < JUNCTION_DET_EPSILON) return null; // exact fold: no separating direction
	const dir: LayoutVec2 = [sx / magnitude, sy / magnitude];
	const normal: LayoutVec2 = [-dir[1], dir[0]];
	const sideA = dot(a.normalOut, tb);
	const sideB = dot(b.normalOut, ta);
	// A neighbour lying *on* this leg's centreline has no facing offset line, so no
	// clearance bisector exists: fail closed rather than guess a beam.
	if (Math.abs(sideA) < JUNCTION_DET_EPSILON || Math.abs(sideB) < JUNCTION_DET_EPSILON) return null;
	const origin = lineIntersection(
		offsetLinePoint(junction, a, signOf(sideA)),
		ta,
		offsetLinePoint(junction, b, signOf(sideB)),
		tb
	);
	if (!origin) return null;
	return { prev: a, next: b, origin, dir, normal, prevSide: signOf(dot(ta, normal)) };
}

/** Twice the signed plan area of a triangle. */
function triangleArea2(a: LayoutVec2, b: LayoutVec2, c: LayoutVec2): number {
	return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
}

/** Clip a convex plan polygon by the half-plane `{p : sign · (p - anchor) · normal ≥ 0}`. */
function clipHalfPlane(
	polygon: readonly LayoutVec2[],
	anchor: LayoutVec2,
	normal: LayoutVec2,
	sign: 1 | -1
): LayoutVec2[] {
	const side = (p: LayoutVec2): number =>
		sign * ((p[0] - anchor[0]) * normal[0] + (p[1] - anchor[1]) * normal[1]);
	const output: LayoutVec2[] = [];
	for (let index = 0; index < polygon.length; index += 1) {
		const current = polygon[index]!;
		const next = polygon[(index + 1) % polygon.length]!;
		const currentSide = side(current);
		const nextSide = side(next);
		if (currentSide >= 0) output.push(current);
		if ((currentSide > 0 && nextSide < 0) || (currentSide < 0 && nextSide > 0)) {
			const amount = currentSide / (currentSide - nextSide);
			output.push([
				current[0] + (next[0] - current[0]) * amount,
				current[1] + (next[1] - current[1]) * amount
			]);
		}
	}
	return output;
}

/** Signed plan area of a convex polygon. */
function polygonArea(polygon: readonly LayoutVec2[]): number {
	let total = 0;
	for (let index = 0; index < polygon.length; index += 1) {
		const a = polygon[index]!;
		const b = polygon[(index + 1) % polygon.length]!;
		total += a[0] * b[1] - b[0] * a[1];
	}
	return total / 2;
}

/** Outward plan normal of a polygon edge, pointing away from the polygon's centroid. */
function edgeOutwardNormal(polygon: readonly LayoutVec2[], from: LayoutVec2, to: LayoutVec2): LayoutVec2 {
	let cx = 0;
	let cy = 0;
	for (const point of polygon) {
		cx += point[0];
		cy += point[1];
	}
	cx /= Math.max(1, polygon.length);
	cy /= Math.max(1, polygon.length);
	const dx = to[0] - from[0];
	const dy = to[1] - from[1];
	const length = Math.hypot(dx, dy) || 1;
	let normal: LayoutVec2 = [dy / length, -dx / length];
	const midX = (from[0] + to[0]) / 2;
	const midY = (from[1] + to[1]) / 2;
	if (normal[0] * (midX - cx) + normal[1] * (midY - cy) < 0) normal = [-normal[0], -normal[1]];
	return normal;
}

/**
 * Expose one keel side face over the bands the abutting neighbour is void in.
 * Where the neighbour *is* solid the face stays interior — its material rests
 * against this one, exactly as a continuation suppresses its shared interface.
 */
function pushKeelSide(
	surfaces: CompiledJunctionSurface[],
	leg: CompiledJunctionLeg,
	neighbour: CompiledJunctionLeg,
	polygon: readonly LayoutVec2[],
	from: LayoutVec2,
	to: LayoutVec2,
	bands: readonly { bottomY: number; topY: number }[]
): void {
	const exposed = bands
		.filter((band) => !legSolidInBand(neighbour, band.bottomY, band.topY))
		.map((band) => ({ bottomY: band.bottomY, topY: band.topY }));
	if (exposed.length === 0) return;
	surfaces.push({
		ownerWallId: leg.wallId,
		end: leg.end,
		kind: 'junction-keel',
		from,
		to,
		normal: edgeOutwardNormal(polygon, from, to),
		bands: exposed
	});
}

/**
 * A degree >= 3 Junction whose partition **cannot be defined at all**: two
 * cyclically adjacent legs share a direction (an exact fold), or a neighbour
 * lies on another leg's own centreline so there is no facing offset line and
 * therefore no equal-clearance beam between them. There is no rule to apply, so
 * the Junction fails **closed** — a blocking issue plus an unresolved join per
 * leg — rather than emitting anything a consumer could render as overlapping
 * Wall bodies.
 */
function starFailure(junctionId: string, reason: string, issues: LayoutGeometryIssue[]): null {
	issues.push({
		path: `junctions.${junctionId}`,
		code: 'junction_partition_failed',
		message: `Junction material cannot be partitioned across its incident Walls (${reason}); the Junction fails closed.`,
		targetId: junctionId,
		severity: 'error'
	});
	return null;
}

/**
 * The owner of a Junction-local plan point, when some **other** leg's own body
 * (its strip, in front of its own Junction plane) covers it: the leg with the
 * smallest face clearance there. `null` means the point lies outside every other
 * leg's material, so the face it belongs to is exposed.
 *
 * This is a single point query used to classify an already-resolved keel edge
 * against the neighbours' compiled bodies. It is the same physical rule the
 * partition itself uses (equal clearance), so no second convention is defined
 * here, and nothing is sampled or rasterised in production.
 */
function junctionPointOwner(
	junction: LayoutVec2,
	query: LayoutVec2,
	self: CompiledJunctionLeg,
	legs: readonly CompiledJunctionLeg[]
): CompiledJunctionLeg | null {
	let best: CompiledJunctionLeg | null = null;
	let bestClearance = Infinity;
	for (const leg of legs) {
		if (leg.wallId === self.wallId) continue;
		const t = outwardTangent(leg);
		const dx = query[0] - junction[0];
		const dy = query[1] - junction[1];
		const along = dx * t[0] + dy * t[1];
		if (along < -JUNCTION_PROBE_TOLERANCE) continue;
		const lateral = dx * leg.normalOut[0] + dy * leg.normalOut[1];
		if (Math.abs(lateral) > leg.halfThickness + JUNCTION_PROBE_TOLERANCE) continue;
		const clearance = Math.abs(lateral) - leg.halfThickness;
		if (clearance < bestClearance - JUNCTION_BAND_EPSILON) {
			bestClearance = clearance;
			best = leg;
		}
	}
	return best;
}

/**
 * The convex pieces of `polygon \ cutter` (both convex and wound CCW).
 *
 * Each piece is an intersection of surviving half-planes, so the difference of
 * two convex polygons is emitted as convex polygons rather than one polygon with
 * a hole — the shape a Wall-owned band can actually be extruded from. Order is
 * stable: the cutter's own edges are walked in order.
 */
function subtractConvexPolygon(polygon: readonly LayoutVec2[], cutter: readonly LayoutVec2[]): LayoutVec2[][] {
	if (polygon.length < 3) return [];
	if (cutter.length < 3) return [[...polygon]];
	const outward = polygonArea(cutter) > 0 ? cutter : [...cutter].reverse();
	const pieces: LayoutVec2[][] = [];
	let remaining: LayoutVec2[] = [...polygon];
	for (let index = 0; index < outward.length && remaining.length >= 3; index += 1) {
		const from = outward[index]!;
		const to = outward[(index + 1) % outward.length]!;
		const normal = edgeOutwardNormal(outward, from, to);
		const outside = clipHalfPlane(remaining, from, normal, 1);
		if (outside.length >= 3) pieces.push(outside);
		remaining = clipHalfPlane(remaining, from, normal, -1);
	}
	return pieces;
}

/**
 * Clean a solved sector region in the owning Wall's own frame: clamp every
 * vertex back inside the Wall's strip (`|lateral| <= halfThickness`) and merge
 * vertices closer than `JUNCTION_SECTOR_SNAP`.
 *
 * Clipping a convex band by a beam line that grazes one of the band's own offset
 * faces routinely leaves a sub-micron sliver instead of an exact corner, and such
 * a sliver is emitted geometry (a degenerate face) rather than a harmless
 * rounding error. Solving in the Wall's own `(along, lateral)` frame first makes
 * both the clamp and the merge exact in the coordinates that matter, so the
 * region a builder extrudes is the region this solver reasoned about.
 */
function cleanSectorRegion(junction: LayoutVec2, leg: CompiledJunctionLeg, polygon: readonly LayoutVec2[]): LayoutVec2[] {
	const t = outwardTangent(leg);
	const n = leg.normalOut;
	const half = leg.halfThickness;
	const solved: Array<[number, number]> = polygon.map((p) => {
		const dx = p[0] - junction[0];
		const dy = p[1] - junction[1];
		const along = dx * t[0] + dy * t[1];
		const lateral = dx * n[0] + dy * n[1];
		return [along, Math.max(-half, Math.min(half, lateral))];
	});
	const merged: Array<[number, number]> = [];
	for (const point of solved) {
		const last = merged[merged.length - 1];
		if (last && Math.abs(last[0] - point[0]) <= JUNCTION_SECTOR_SNAP && Math.abs(last[1] - point[1]) <= JUNCTION_SECTOR_SNAP) {
			continue;
		}
		merged.push(point);
	}
	while (merged.length > 1) {
		const first = merged[0]!;
		const last = merged[merged.length - 1]!;
		if (Math.abs(last[0] - first[0]) > JUNCTION_SECTOR_SNAP || Math.abs(last[1] - first[1]) > JUNCTION_SECTOR_SNAP) break;
		merged.pop();
	}
	return merged.map(([along, lateral]): LayoutVec2 => [
		junction[0] + along * t[0] + lateral * n[0],
		junction[1] + along * t[1] + lateral * n[1]
	]);
}

/**
 * Partition a degree >= 3 Junction that has **no** continuation pair (Y, star)
 * across all of its incident legs:
 *
 * ```text
 * cyclic leg pairs          → one equal-clearance beam each
 * leg band + its two beams  → this leg's Junction-local cell (a half-plane
 *                             intersection, never a wedge sign test)
 * cell cut at capDistance   → the keel this Wall owns near the Junction
 * cell beyond capDistance   → the Wall's own body (a plain strip, nothing to solve)
 * ```
 *
 * A leg's Junction-local material is the part of its own band that lies in front
 * of its Junction plane and on **its own** side of its two beams. Every
 * constraint is a half-plane, so the cell is convex and the rule needs no
 * "neighbours on opposite sides" precondition: clustered legs (a Y whose two
 * branches leave almost together) resolve with the same code as a symmetric Y.
 *
 * The band is cut at `capDistance` — the farthest station at which a beam still
 * crosses the strip — because beyond it the strip lies wholly inside the cell.
 * So the Wall keeps a plain swept strip from `capDistance` outward and this solver
 * owns only the Junction-local piece, published as an explicit Wall-attributed
 * keel (plus its exposed, per-band vertical surfaces). Nothing is left to
 * interpenetration.
 *
 * A neighbour thinner than the sector it faces leaves a **wrap**: part of this
 * leg's own band sits on the neighbour's side of the shared beam but beyond the
 * neighbour's far face, where no neighbour material reaches. That region is
 * material this Wall owns, so it is resolved as a second keel region instead of
 * being left uncovered or hidden behind an overlap.
 *
 * Returns `null` when the configuration cannot be partitioned at all (no
 * separating beam); the caller then fails closed with a blocking issue rather
 * than emitting interpenetrating Wall bodies.
 */
function resolveStarPartition(
	junctionId: string,
	point: LayoutVec2,
	legs: readonly CompiledJunctionLeg[],
	bands: Array<{ bottomY: number; topY: number }>,
	issues: LayoutGeometryIssue[]
): { resolution: CompiledJunctionResolution; issues: LayoutGeometryIssue[] } | null {
	const count = legs.length;
	if (count < 3) return null;
	const legOrder = legs.map((leg) => ({ wallId: leg.wallId, end: leg.end }));
	const beams: PartitionBeam[] = [];
	for (let index = 0; index < count; index += 1) {
		const a = legs[index]!;
		const b = legs[(index + 1) % count]!;
		const beam = partitionBeam(point, a, b);
		if (!beam) return starFailure(junctionId, `no separating beam for ${a.wallId} and ${b.wallId}`, issues);
		beams.push(beam);
	}
	// Two forms of the same rule. A leg whose two neighbours leave on **opposite**
	// sides of its own centreline has a convex wedge between its two beams: its
	// sector is a triangle plus the strip beyond the cap, and that is emitted
	// directly. A leg whose neighbours leave on the *same* side (a Y whose two
	// branches almost coincide, a star with a near-antiparallel pair) has no such
	// wedge at all — its sector is the leg's band minus what the neighbours own —
	// so it is solved as a difference of convex regions instead of by guessing a
	// wedge apex. Both forms are the equal-clearance partition; neither leaves any
	// material to interpenetration.
	const wedged = legs.every((leg, index) => {
		const prev = legs[(index - 1 + count) % count]!;
		const next = legs[(index + 1) % count]!;
		return (
			signOf(dot(leg.normalOut, outwardTangent(prev))) !== signOf(dot(leg.normalOut, outwardTangent(next)))
		);
	});
	// The wedge form is the closed form of this rule and solves the symmetric Y in
	// one step. It **declines** (returns `null`, emitting nothing) whenever it
	// cannot express the sector — a beam crossing that is degenerate, a collapsed
	// cap, a thin neighbour's wrap — and the difference form then solves the very
	// same Junction exactly, because it is the definition rather than a case. A
	// Junction is only unresolved when no separating beam exists at all, which is
	// reported once above and fails closed here.
	const joins = (wedged ? resolveStarWedges(point, legs, beams, bands) : null) ?? resolveStarSectors(point, legs, beams, bands);
	return { resolution: { junctionId, legOrder, joins, bounds2: joinsBounds2(point, joins) }, issues };
}

/**
 * Which side of `beam` the **owner's** material lies on (`beam.normal` terms).
 *
 * The beam is built through the intersection of the two *facing* offset faces, so
 * it passes exactly through a point of the owner's own face. Stepping from there
 * into the owner's strip (away from the other leg) lands on the owner's side of
 * the beam, and reading that step's sign analytically keeps the answer independent
 * of thickness, angle and Junction scale — unlike probing along a leg's centreline,
 * which sits inside the *other* leg's material when that leg is thick enough to
 * swallow the overlap.
 */
function sideAtOrigin(owner: CompiledJunctionLeg, other: CompiledJunctionLeg, beam: PartitionBeam): 1 | -1 {
	return signOf(-dot(owner.normalOut, outwardTangent(other)) * dot(owner.normalOut, beam.normal));
}

/**
 * The wedge form of the sector partition: for every leg whose two neighbours
 * leave on opposite sides, one equal-clearance cap (the beam crossings on the
 * leg's two faces) plus the sector triangle behind it. It **declines** rather
 * than approximates — a neighbour too thin to cover the sector it faces, a
 * degenerate crossing, or beams that cross in front of the cap all return `null`
 * so the difference form below resolves that same Junction exactly; declining is
 * never a silent approximation of the geometry.
 */
function resolveStarWedges(
	point: LayoutVec2,
	legs: readonly CompiledJunctionLeg[],
	beams: readonly PartitionBeam[],
	bands: Array<{ bottomY: number; topY: number }>
): CompiledLegJoin[] | null {
	const count = legs.length;
	const joins: CompiledLegJoin[] = [];
	for (let index = 0; index < count; index += 1) {
		const leg = legs[index]!;
		const prev = legs[(index - 1 + count) % count]!;
		const next = legs[(index + 1) % count]!;
		const prevBeam = beams[(index - 1 + count) % count]!;
		const nextBeam = beams[index]!;
		const t = outwardTangent(leg);
		const prevSide = signOf(dot(leg.normalOut, outwardTangent(prev)));
		const nextSide = signOf(dot(leg.normalOut, outwardTangent(next)));
		const capPrev = beamOffsetCrossing(point, leg, prevSide, prevBeam);
		const capNext = beamOffsetCrossing(point, leg, nextSide, nextBeam);
		const apex = lineIntersection(prevBeam.origin, prevBeam.dir, nextBeam.origin, nextBeam.dir);
		if (!capPrev || !capNext || !apex) return null; // degenerate crossing: difference form solves it
		const capSpan = Math.hypot(capNext[0] - capPrev[0], capNext[1] - capPrev[1]);
		if (capSpan <= JUNCTION_BAND_EPSILON) return null; // collapsed cap: difference form solves it
		// A neighbour thinner than the sector it faces leaves material of this leg's
		// own band outside the neighbour's reach: it can neither be handed over nor
		// left uncovered without an overlap or a hole, so the Junction fails closed
		// rather than rendering either. The difference form resolves it; this form
		// only runs for legs that do have a wedge.
		for (const [neighbour, beam] of [
			[prev, prevBeam] as const,
			[next, nextBeam] as const
		]) {
			let region: LayoutVec2[] = [
				[point[0] + leg.halfThickness * leg.normalOut[0], point[1] + leg.halfThickness * leg.normalOut[1]],
				[point[0] - leg.halfThickness * leg.normalOut[0], point[1] - leg.halfThickness * leg.normalOut[1]],
				prevSide > 0 ? capNext : capPrev,
				prevSide > 0 ? capPrev : capNext
			];
			region = clipHalfPlane(region, beam.origin, beam.normal, sideAtOrigin(neighbour, leg, beam));
			const farSide = signOf(-dot(neighbour.normalOut, t));
			region = clipHalfPlane(
				region,
				[
					point[0] + farSide * neighbour.halfThickness * neighbour.normalOut[0],
					point[1] + farSide * neighbour.halfThickness * neighbour.normalOut[1]
				],
				neighbour.normalOut,
				farSide
			);
			if (region.length >= 3 && Math.abs(polygonArea(region)) > JUNCTION_BAND_EPSILON * leg.halfThickness) {
				return null; // thin neighbour leaves a wrap: difference form owns it
			}
		}
		const plusCap = prevSide > 0 ? capPrev : capNext;
		const minusCap = prevSide > 0 ? capNext : capPrev;
		const keelBands = bands.filter((band) => legSolidInBand(leg, band.bottomY, band.topY));
		const surfaces: CompiledJunctionSurface[] = [];
		let keel: CompiledLegJoin['keel'];
		const capMid: LayoutVec2 = [(capPrev[0] + capNext[0]) / 2, (capPrev[1] + capNext[1]) / 2];
		const apexDepth = (apex[0] - capMid[0]) * t[0] + (apex[1] - capMid[1]) * t[1];
		const keelArea2 = triangleArea2(capPrev, apex, capNext);
		const regions: LayoutVec2[][] = [];
		if (Math.abs(keelArea2) > JUNCTION_BAND_EPSILON * Math.max(JUNCTION_BAND_EPSILON, capSpan)) {
			if (apexDepth > JUNCTION_BAND_EPSILON) return null; // beams cross in front of the cap: difference form
			const polygon: LayoutVec2[] = keelArea2 > 0 ? [capPrev, apex, capNext] : [capNext, apex, capPrev];
			regions.push(polygon);
			pushKeelSide(surfaces, leg, prev, polygon, capPrev, apex, keelBands);
			pushKeelSide(surfaces, leg, next, polygon, apex, capNext, keelBands);
		}
		if (regions.length > 0 && keelBands.length > 0) {
			keel = { regions, bands: keelBands.map((band) => ({ bottomY: band.bottomY, topY: band.topY })) };
		}
		joins.push({
			wallId: leg.wallId,
			end: leg.end,
			kind: 'miter',
			endBoundary: [capPrev, capNext],
			interfaceSuppressed: true,
			ownedSeam: null,
			bands: bands.map((band) => ({ bottomY: band.bottomY, topY: band.topY })),
			corner: {
				front: { kind: 'miter', apex: leg.end === 'start' ? plusCap : minusCap },
				back: { kind: 'miter', apex: leg.end === 'start' ? minusCap : plusCap }
			},
			...(keel ? { keel } : {}),
			...(surfaces.length > 0 ? { surfaces } : {})
		});
	}
	return joins;
}

/**
 * The **difference** form of the sector partition, for a Junction whose legs have
 * no wedge form at all (two neighbours leaving on the same side of a leg). Same
 * rule — a leg owns the material of its band that no neighbour's own body reaches
 * — solved by subtracting each neighbour's claim from the leg's band: the
 * neighbour's side of their shared equal-clearance beam, limited to the
 * neighbour's own strip and to the material in front of its own Junction plane,
 * keeping the convex pieces. Limiting the claim to the neighbour's body is what
 * makes the solve total: a neighbour with no material at a point cannot own it, so
 * the point stays this leg's — the wrap a thin neighbour leaves, and the material
 * across the beam that the neighbour has already ended before — and the difference
 * of two convex polygons is emitted as convex polygons rather than one region with
 * a hole.
 * This form needs no precondition beyond the beams themselves, so it is the
 * **total** solve: wherever the wedge form declines, this one answers.
 */
function resolveStarSectors(
	point: LayoutVec2,
	legs: readonly CompiledJunctionLeg[],
	beams: readonly PartitionBeam[],
	bands: Array<{ bottomY: number; topY: number }>
): CompiledLegJoin[] {
	const count = legs.length;
	const joins: CompiledLegJoin[] = [];
	for (let index = 0; index < count; index += 1) {
		const leg = legs[index]!;
		const prev = legs[(index - 1 + count) % count]!;
		const next = legs[(index + 1) % count]!;
		const prevBeam = beams[(index - 1 + count) % count]!;
		const nextBeam = beams[index]!;
		const t = outwardTangent(leg);
		const half = leg.halfThickness;
		/** Along-distance from the Junction plane, in this leg's own outward frame. */
		const along = (p: LayoutVec2): number => (p[0] - point[0]) * t[0] + (p[1] - point[1]) * t[1];
		/** This leg's own band between its Junction plane and `distance` along `t`. */
		const bandQuad = (distance: number): LayoutVec2[] => [
			[point[0] + half * leg.normalOut[0], point[1] + half * leg.normalOut[1]],
			[
				point[0] + distance * t[0] + half * leg.normalOut[0],
				point[1] + distance * t[1] + half * leg.normalOut[1]
			],
			[
				point[0] + distance * t[0] - half * leg.normalOut[0],
				point[1] + distance * t[1] - half * leg.normalOut[1]
			],
			[point[0] - half * leg.normalOut[0], point[1] - half * leg.normalOut[1]]
		];
		// Farthest station at which a beam still cuts this leg's strip: beyond it the
		// whole strip lies inside the cell, so the Wall's own body can start there.
		let capDistance = 0;
		for (const beam of [prevBeam, nextBeam]) {
			for (const sign of [1, -1] as const) {
				const crossing = lineIntersection(offsetLinePoint(point, leg, sign), t, beam.origin, beam.dir);
				if (crossing) capDistance = Math.max(capDistance, along(crossing));
			}
		}
		capDistance = Math.max(0, capDistance);
		const capPlus: LayoutVec2 = [
			point[0] + capDistance * t[0] + half * leg.normalOut[0],
			point[1] + capDistance * t[1] + half * leg.normalOut[1]
		];
		const capMinus: LayoutVec2 = [
			point[0] + capDistance * t[0] - half * leg.normalOut[0],
			point[1] + capDistance * t[1] - half * leg.normalOut[1]
		];
		const regions: LayoutVec2[][] = [];
		const pushRegion = (polygon: readonly LayoutVec2[]): void => {
			const cleaned = cleanSectorRegion(point, leg, polygon);
			const area = polygonArea(cleaned);
			if (cleaned.length < 3 || Math.abs(area) <= JUNCTION_BAND_EPSILON * Math.max(JUNCTION_BAND_EPSILON, half)) return;
			regions.push(area > 0 ? cleaned : [...cleaned].reverse());
		};
		// This leg's Junction-local material: its own band, in front of its Junction
		// plane, on its own side of both beams. Convex, because every constraint is a
		// half-plane, and solved without any "neighbours on opposite sides" premise.
		let cell = clipHalfPlane(bandQuad(capDistance), point, t, 1);
		cell = clipHalfPlane(cell, prevBeam.origin, prevBeam.normal, sideAtOrigin(leg, prev, prevBeam));
		cell = clipHalfPlane(cell, nextBeam.origin, nextBeam.normal, sideAtOrigin(leg, next, nextBeam));
		pushRegion(cell);
		// A neighbour thinner than the sector it faces leaves a **wrap**: part of this
		// leg's own band lies on the neighbour's side of the shared beam but beyond the
		// neighbour's far face, where no neighbour material reaches. No neighbour can
		// own it, so this leg does — resolved as its own convex region instead of being
		// left uncovered or hidden behind an overlap.
		for (const [neighbour, beam, otherBeam] of [
			[prev, prevBeam, nextBeam] as const,
			[next, nextBeam, prevBeam] as const
		]) {
			const farSide = signOf(-dot(neighbour.normalOut, t));
			let wrap = clipHalfPlane(bandQuad(capDistance), point, t, 1);
			wrap = clipHalfPlane(wrap, beam.origin, beam.normal, sideAtOrigin(neighbour, leg, beam));
			wrap = clipHalfPlane(
				wrap,
				[
					point[0] + farSide * neighbour.halfThickness * neighbour.normalOut[0],
					point[1] + farSide * neighbour.halfThickness * neighbour.normalOut[1]
				],
				neighbour.normalOut,
				farSide
			);
			// Only the shared beam is relaxed; the other beam still bounds this leg.
			wrap = clipHalfPlane(wrap, otherBeam.origin, otherBeam.normal, sideAtOrigin(leg, neighbour, otherBeam));
			pushRegion(wrap);
		}

		// Exposed, Wall-attributed boundary surfaces: every keel edge no other leg's
		// body abuts, evaluated per vertical band, so an Opening void (or a shorter
		// covering Wall) exposes the band a thickness step would otherwise bury.
		const keelBands = bands.filter((band) => legSolidInBand(leg, band.bottomY, band.topY));
		const surfaces: CompiledJunctionSurface[] = [];
		for (const region of regions) {
			for (let edge = 0; edge < region.length; edge += 1) {
				const from = region[edge]!;
				const to = region[(edge + 1) % region.length]!;
				// The cap edge is the seam with this Wall's own body: always interior.
				if (along(from) >= capDistance - JUNCTION_SECTOR_SNAP && along(to) >= capDistance - JUNCTION_SECTOR_SNAP) {
					continue;
				}
				if (Math.hypot(to[0] - from[0], to[1] - from[1]) <= JUNCTION_BAND_EPSILON) continue;
				const normal = edgeOutwardNormal(region, from, to);
				const exposed = keelBands.filter((band) => {
					const coverer = junctionPointOwner(
						point,
						[
							(from[0] + to[0]) / 2 + JUNCTION_SURFACE_PROBE * normal[0],
							(from[1] + to[1]) / 2 + JUNCTION_SURFACE_PROBE * normal[1]
						],
						leg,
						legs
					);
					if (!coverer) return true;
					return !legSolidInBand(coverer, band.bottomY, band.topY);
				});
				if (exposed.length === 0) continue;
				surfaces.push({
					ownerWallId: leg.wallId,
					end: leg.end,
					kind: 'junction-keel',
					from,
					to,
					normal,
					bands: exposed.map((band) => ({ bottomY: band.bottomY, topY: band.topY }))
				});
			}
		}
		const keel =
			regions.length > 0 && keelBands.length > 0
				? { regions, bands: keelBands.map((band) => ({ bottomY: band.bottomY, topY: band.topY })) }
				: undefined;
		joins.push({
			wallId: leg.wallId,
			end: leg.end,
			kind: 'miter',
			endBoundary: capDistance > JUNCTION_BAND_EPSILON ? [capPlus, capMinus] : [],
			interfaceSuppressed: true,
			ownedSeam: null,
			bands: bands.map((band) => ({ bottomY: band.bottomY, topY: band.topY })),
			// The body keeps its own full section: the cut is the cap, which is where
			// the solved cell hands the strip back. Orientation follows the Wall's own
			// end normal, so the builder needs no convention of its own.
			corner: {
				front: { kind: 'miter', apex: leg.end === 'start' ? capPlus : capMinus },
				back: { kind: 'miter', apex: leg.end === 'start' ? capMinus : capPlus }
			},
			...(keel ? { keel } : {}),
			...(surfaces.length > 0 ? { surfaces } : {})
		});
	}
	return joins;
}

/**
 * A branch leg at a degree >= 3 Junction, **trimmed against the resolved core
 * material** rather than left to interpenetration. The leg's material begins at
 * `clipDistance`; its end cross-section is an internal interface, with the parts
 * no core material covers emitted as explicit `branch-trim` surfaces owned by
 * this leg, and the coincident parts suppressing the core's own face per band.
 */
function trimJoin(
	leg: CompiledJunctionLeg,
	bands: Array<{ bottomY: number; topY: number }>,
	point: LayoutVec2,
	coverers: readonly CompiledJunctionLeg[],
	allBands: Array<{ bottomY: number; topY: number }>
): CompiledLegJoin {
	const trim = branchTrim(point, leg, coverers, allBands);
	return {
		wallId: leg.wallId,
		end: leg.end,
		kind: 'trim',
		endBoundary: trim.endBoundary,
		interfaceSuppressed: true,
		ownedSeam: null,
		bands: bands.map((band) => ({ bottomY: band.bottomY, topY: band.topY })),
		corner: null,
		...(trim.clipDistance > JUNCTION_BAND_EPSILON ? { clipDistance: trim.clipDistance } : {}),
		surfaces: trim.surfaces,
		interfaces: trim.interfaces
	};
}

function suppressedJoin(
	leg: CompiledJunctionLeg,
	bands: Array<{ bottomY: number; topY: number }>,
	neighbor?: CompiledJunctionNeighbor,
	surfaces?: readonly CompiledJunctionSurface[],
	fold = false
): CompiledLegJoin {
	return {
		wallId: leg.wallId,
		end: leg.end,
		kind: 'suppressed',
		endBoundary: [],
		interfaceSuppressed: !fold,
		ownedSeam: null,
		bands: bands.map((band) => ({ bottomY: band.bottomY, topY: band.topY })),
		corner: null,
		...(neighbor ? { neighbor } : {}),
		...(surfaces && surfaces.length > 0 ? { surfaces: [...surfaces] } : {}),
		...(fold ? { fold: true as const } : {})
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

/**
 * Does a tangent-continuation pair at a degree >= 3 Junction still expose a
 * thickness/height step? The step lies in the Junction plane, on the sides of the
 * thicker leg; if some other incident leg's footprint covers every sample of it,
 * the surface is buried inside that leg's body and stays suppressed.
 */
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

/**
 * Is the leg's endpoint cross-section solid across the whole band `[lo, hi]`?
 * Endpoint Opening bands answer it — the already-compiled fact (Decision 10), so
 * an Opening void is handled per band exactly like any other void band.
 */
export function legSolidInBand(leg: CompiledJunctionLeg, lo: number, hi: number): boolean {
	for (const band of leg.endpointSolidBands) {
		if (!band.solid) continue;
		if (lo >= band.bottomY - JUNCTION_BAND_EPSILON && hi <= band.topY + JUNCTION_BAND_EPSILON) return true;
	}
	return false;
}

/** Does the leg have physical material at `point` for the whole band `[lo, hi]`? */
function legMaterialAt(point: LayoutVec2, junction: LayoutVec2, leg: CompiledJunctionLeg, lo: number, hi: number): boolean {
	return legSolidInBand(leg, lo, hi) && pointInLegFootprint(point, junction, leg);
}

/**
 * The resolved difference surfaces of a tangent continuation, **solved here**.
 *
 * A continuation suppresses only the overlapping/common interface; a thickness,
 * height or Opening-profile difference is real material, so its exposed surface
 * is emitted per vertical band and attributed to the leg that owns the material
 * (the thicker leg for a thickness step; the solid leg for a sole-solid band).
 * A covering leg's *material* — plan footprint **and** solid band — buries a
 * surface; a covering leg that is void in the band (an Opening, or a shorter
 * branch) does not.
 */
function continuationSurfaces(
	junction: LayoutVec2,
	a: CompiledJunctionLeg,
	b: CompiledJunctionLeg,
	coverers: readonly CompiledJunctionLeg[]
): { surfaces: CompiledJunctionSurface[]; forA: CompiledJunctionSurface[]; forB: CompiledJunctionSurface[] } {
	const surfaces: CompiledJunctionSurface[] = [];
	const bands = unionBands([a, b, ...coverers]);
	const reference = compareLegs(a, b) <= 0 ? a : b;
	const lateral = reference.normalOut;
	surfaceBands(surfaces, junction, a, b, coverers, bands, lateral);
	const forA: CompiledJunctionSurface[] = [];
	const forB: CompiledJunctionSurface[] = [];
	for (const surface of surfaces) (surface.ownerWallId === a.wallId ? forA : forB).push(surface);
	return { surfaces, forA, forB };
}

function surfaceBands(
	surfaces: CompiledJunctionSurface[],
	junction: LayoutVec2,
	a: CompiledJunctionLeg,
	b: CompiledJunctionLeg,
	coverers: readonly CompiledJunctionLeg[],
	bands: readonly { bottomY: number; topY: number }[],
	lateral: LayoutVec2
): void {
	const thicknessStep = Math.abs(a.halfThickness - b.halfThickness) > JUNCTION_BAND_EPSILON;
	const thicker = a.halfThickness >= b.halfThickness ? a : b;
	const thinner = thicker === a ? b : a;
	for (const band of bands) {
		const solidA = legSolidInBand(a, band.bottomY, band.topY);
		const solidB = legSolidInBand(b, band.bottomY, band.topY);
		if (!solidA && !solidB) continue;
		if (solidA && solidB) {
			if (!thicknessStep) continue;
			for (const sign of [1, -1] as const) {
				const from = atOffset(junction, lateral, sign * thinner.halfThickness);
				const to = atOffset(junction, lateral, sign * thicker.halfThickness);
				const midpoint = atOffset(junction, lateral, sign * (thinner.halfThickness + thicker.halfThickness) / 2);
				if (buriedBy(midpoint, junction, coverers, band)) continue;
				surfaces.push({
					ownerWallId: thicker.wallId,
					end: thicker.end,
					kind: 'continuation-thickness-step',
					from,
					to,
					normal: [sign * lateral[0], sign * lateral[1]],
					bands: [{ bottomY: band.bottomY, topY: band.topY }]
				});
			}
			continue;
		}
		// Exactly one leg is solid: its own end cross-section is the exposed
		// surface. Attribution follows the material, never a tie-break.
		const solid = solidA ? a : b;
		const cross = [atOffset(junction, solid.normalOut, solid.halfThickness), atOffset(junction, solid.normalOut, -solid.halfThickness)];
		const normal: LayoutVec2 = [-outwardTangent(solid)[0], -outwardTangent(solid)[1]];
		for (const piece of exposedPieces(junction, cross[0]!, cross[1]!, band, coverers)) {
			surfaces.push({
				ownerWallId: solid.wallId,
				end: solid.end,
				kind: 'continuation-height-step',
				from: piece.from,
				to: piece.to,
				normal,
				bands: [{ bottomY: band.bottomY, topY: band.topY }]
			});
		}
	}
}

function atOffset(junction: LayoutVec2, normal: LayoutVec2, distance: number): LayoutVec2 {
	return [junction[0] + distance * normal[0], junction[1] + distance * normal[1]];
}

/** Does any covering leg's *material* occupy `point` for the whole band? */
function buriedBy(
	point: LayoutVec2,
	junction: LayoutVec2,
	coverers: readonly CompiledJunctionLeg[],
	band: { bottomY: number; topY: number }
): boolean {
	return coverers.some((leg) => legMaterialAt(point, junction, leg, band.bottomY, band.topY));
}

/**
 * Split a plan segment into the sub-intervals no covering leg's material spans,
 * so a difference surface is never emitted across a region that is interior to
 * the resolved Junction material. Sub-intervals are bounded by every coverer's
 * band boundary and start plane crossing the segment, so the split is exact.
 */
function exposedPieces(
	junction: LayoutVec2,
	start: LayoutVec2,
	end: LayoutVec2,
	band: { bottomY: number; topY: number },
	coverers: readonly CompiledJunctionLeg[],
	segments?: CompiledJunctionInterface[]
): Array<{ from: LayoutVec2; to: LayoutVec2 }> {
	const dx = end[0] - start[0];
	const dz = end[1] - start[1];
	const cuts = new Set<number>([0, 1]);
	for (const coverer of coverers) {
		const n = coverer.normalOut;
		const t = coverer.tangentOut;
		const aSide = (start[0] - junction[0]) * n[0] + (start[1] - junction[1]) * n[1];
		const bSide = dx * n[0] + dz * n[1];
		if (Math.abs(bSide) > JUNCTION_DET_EPSILON) {
			for (const sign of [1, -1] as const) {
				const value = (sign * coverer.halfThickness - aSide) / bSide;
				if (value > 0 && value < 1) cuts.add(value);
			}
		}
		const aAlong = (start[0] - junction[0]) * t[0] + (start[1] - junction[1]) * t[1];
		const bAlong = dx * t[0] + dz * t[1];
		if (Math.abs(bAlong) > JUNCTION_DET_EPSILON) {
			const value = -aAlong / bAlong;
			if (value > 0 && value < 1) cuts.add(value);
		}
	}
	const sorted = [...cuts].sort((left, right) => left - right);
	const point = (amount: number): LayoutVec2 => [start[0] + amount * dx, start[1] + amount * dz];
	// Adjacent sub-intervals with the same exposure are merged, so no spurious
	// shared edge is introduced where a coverer's plane crosses without changing
	// whether the surface is interior (that would split one surface in two).
	const runs: Array<{ from: number; to: number; coverer: CompiledJunctionLeg | null }> = [];
	for (let index = 1; index < sorted.length; index += 1) {
		const lo = sorted[index - 1]!;
		const hi = sorted[index]!;
		if (hi - lo <= JUNCTION_BAND_EPSILON) continue;
		const midpoint = point((lo + hi) / 2);
		const coverer = coverers.find((leg) => legMaterialAt(midpoint, junction, leg, band.bottomY, band.topY)) ?? null;
		const last = runs.at(-1);
		if (last && last.coverer === coverer) last.to = hi;
		else runs.push({ from: lo, to: hi, coverer });
	}
	const pieces: Array<{ from: LayoutVec2; to: LayoutVec2 }> = [];
	for (const run of runs) {
		const from = point(run.from);
		const to = point(run.to);
		if (!run.coverer) {
			pieces.push({ from, to });
			continue;
		}
		// The run is interior to the coverer's material. Where the surface is
		// *coincident* with the coverer's own offset face, that face region is an
		// internal interface and must be suppressed there — per band.
		const midpoint = point((run.from + run.to) / 2);
		const lateralMid =
			(midpoint[0] - junction[0]) * run.coverer.normalOut[0] + (midpoint[1] - junction[1]) * run.coverer.normalOut[1];
		if (segments && Math.abs(Math.abs(lateralMid) - run.coverer.halfThickness) <= JUNCTION_BAND_EPSILON) {
			segments.push(interfaceOn(run.coverer, from, to, junction, band));
		}
	}
	return pieces;
}

/** An interface record for the coverer's own face the segment rests on (or `null`). */
function interfaceOn(
	coverer: CompiledJunctionLeg,
	from: LayoutVec2,
	to: LayoutVec2,
	junction: LayoutVec2,
	band: { bottomY: number; topY: number }
): CompiledJunctionInterface {
	const n = coverer.normalOut;
	const t = coverer.tangentOut;
	const project = (point: LayoutVec2): number => (point[0] - junction[0]) * t[0] + (point[1] - junction[1]) * t[1];
	const lateralMid = ((from[0] + to[0]) / 2 - junction[0]) * n[0] + ((from[1] + to[1]) / 2 - junction[1]) * n[1];
	const side: LayoutVec2 = lateralMid >= 0 ? [n[0], n[1]] : [-n[0], -n[1]];
	const a = project(from);
	const b = project(to);
	return {
		wallId: coverer.wallId,
		end: coverer.end,
		normal: side,
		fromDistance: Math.min(a, b),
		toDistance: Math.max(a, b),
		bands: [{ bottomY: band.bottomY, topY: band.topY }]
	};
}

/**
 * Trim one branch leg against the resolved core material.
 *
 * The cut is the farthest along-distance at which any core leg still has
 * material on the branch's own cross-section, so no two Wall-owned bodies can
 * occupy the same volume. The branch's end cross-section is then an internal
 * interface; the parts no core material covers are emitted as explicit
 * Wall-attributed trim surfaces and the coincident parts suppress the core's own
 * face per band. Nothing is left to interpenetration and nothing is buried.
 */
function branchTrim(
	junction: LayoutVec2,
	leg: CompiledJunctionLeg,
	coverers: readonly CompiledJunctionLeg[],
	allBands: readonly { bottomY: number; topY: number }[]
): {
	clipDistance: number;
	endBoundary: LayoutVec2[];
	surfaces: CompiledJunctionSurface[];
	interfaces: CompiledJunctionInterface[];
} {
	const clipDistance = coreTrimDistance(junction, leg, coverers);
	const t = outwardTangent(leg);
	const cut: LayoutVec2 = [junction[0] + clipDistance * t[0], junction[1] + clipDistance * t[1]];
	const front = atOffset(cut, leg.normalOut, leg.halfThickness);
	const back = atOffset(cut, leg.normalOut, -leg.halfThickness);
	const surfaces: CompiledJunctionSurface[] = [];
	const interfaces: CompiledJunctionInterface[] = [];
	const normal: LayoutVec2 = [-t[0], -t[1]];
	const bands = allBands.filter((band) => legSolidInBand(leg, band.bottomY, band.topY));
	for (const band of bands) {
		for (const piece of exposedPieces(junction, front, back, band, coverers, interfaces)) {
			surfaces.push({
				ownerWallId: leg.wallId,
				end: leg.end,
				kind: 'branch-trim',
				from: piece.from,
				to: piece.to,
				normal,
				bands: [{ bottomY: band.bottomY, topY: band.topY }]
			});
		}
	}
	return { clipDistance, endBoundary: [front, back], surfaces, interfaces: mergeInterfaces(interfaces) };
}

/** Merge per-band interface records into one record per (face, interval). */
function mergeInterfaces(records: readonly CompiledJunctionInterface[]): CompiledJunctionInterface[] {
	const merged: CompiledJunctionInterface[] = [];
	for (const record of records) {
		const existing = merged.find(
			(candidate) =>
				candidate.wallId === record.wallId &&
				candidate.end === record.end &&
				candidate.normal[0] === record.normal[0] &&
				candidate.normal[1] === record.normal[1] &&
				Math.abs(candidate.fromDistance - record.fromDistance) <= JUNCTION_BAND_EPSILON &&
				Math.abs(candidate.toDistance - record.toDistance) <= JUNCTION_BAND_EPSILON
		);
		if (existing) existing.bands.push(...record.bands);
		else merged.push({ ...record, bands: [...record.bands] });
	}
	return merged;
}

/**
 * The farthest along-distance the covering legs' material still reaches across
 * the branch's own cross-section. Computed analytically: each coverer's band
 * window exit is linear in the cross-section parameter, so its maximum over the
 * valid window is at a window endpoint — never sampled, never iteration-order
 * dependent.
 */
function coreTrimDistance(junction: LayoutVec2, leg: CompiledJunctionLeg, coverers: readonly CompiledJunctionLeg[]): number {
	void junction;
	const t = outwardTangent(leg);
	const n = leg.normalOut;
	const h = leg.halfThickness;
	let cut = 0;
	for (const coverer of coverers) {
		if (coverer.wallId === leg.wallId) continue;
		const cn = coverer.normalOut;
		const ct = coverer.tangentOut;
		const aSide = t[0] * cn[0] + t[1] * cn[1];
		const bSide = n[0] * cn[0] + n[1] * cn[1];
		const aAlong = t[0] * ct[0] + t[1] * ct[1];
		const bAlong = n[0] * ct[0] + n[1] * ct[1];
		// Window of cross-section offsets at which the branch's own start sits
		// inside the coverer's band.
		let lo = -h;
		let hi = h;
		if (Math.abs(bSide) > JUNCTION_DET_EPSILON) {
			const bound = coverer.halfThickness / Math.abs(bSide);
			lo = Math.max(lo, -bound);
			hi = Math.min(hi, bound);
		}
		if (hi < lo) continue;
		const bandLower = (lambda: number): number => {
			if (Math.abs(aSide) <= JUNCTION_DET_EPSILON) return Number.NEGATIVE_INFINITY;
			const first = (coverer.halfThickness - lambda * bSide) / aSide;
			const second = (-coverer.halfThickness - lambda * bSide) / aSide;
			return Math.min(first, second);
		};
		const alongUpper = (lambda: number): number => {
			if (Math.abs(aAlong) <= JUNCTION_DET_EPSILON) return Number.POSITIVE_INFINITY;
			return aAlong > 0 ? Number.POSITIVE_INFINITY : (-lambda * bAlong) / aAlong;
		};
		// End of the coverage interval that contains the branch's own start: the
		// coverer's material is `band ∩ along ≥ 0`, so both windows bound it.
		const prefixEnd = (lambda: number): number => {
			if (Math.abs(aAlong) <= JUNCTION_DET_EPSILON && lambda * bAlong < -JUNCTION_DET_EPSILON) return 0;
			const lower = Math.max(bandLower(lambda), 0, aAlong > JUNCTION_DET_EPSILON ? (-lambda * bAlong) / aAlong : Number.NEGATIVE_INFINITY);
			if (lower > JUNCTION_BAND_EPSILON) return 0;
			const upper = Math.min(
				Math.abs(aSide) <= JUNCTION_DET_EPSILON ? Number.POSITIVE_INFINITY : Math.max((coverer.halfThickness - lambda * bSide) / aSide, (-coverer.halfThickness - lambda * bSide) / aSide),
				alongUpper(lambda)
			);
			return Number.isFinite(upper) ? Math.max(0, upper) : 0;
		};
		const candidates = [lo, hi, 0];
		// `min(band upper, along upper)` is concave in λ, so its maximum can sit at
		// the crossing of the two linear bounds — solved analytically, never
		// sampled, so the cut is exact and iteration-order independent.
		if (Math.abs(aSide) > JUNCTION_DET_EPSILON && aAlong < 0) {
			const denominator = aAlong * bSide - aSide * bAlong;
			if (Math.abs(denominator) > JUNCTION_DET_EPSILON) {
				for (const sign of [1, -1] as const) {
					const lambda = (aAlong * sign * coverer.halfThickness) / denominator;
					if (lambda >= lo - JUNCTION_BAND_EPSILON && lambda <= hi + JUNCTION_BAND_EPSILON) candidates.push(lambda);
				}
			}
		}
		for (const lambda of candidates) cut = Math.max(cut, prefixEnd(lambda));
	}
	return Math.max(0, cut);
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
		// A resolved keel is emitted material too, so the Junction region bounds
		// must contain the sector wedge this Wall owns near the Junction.
		if (join.keel) {
			for (const region of join.keel.regions) for (const p of region) consider(p);
		}
		// Resolved Wall-attributed difference/trim surfaces are emitted geometry
		// too, so the Junction region bounds must contain them.
		for (const surface of join.surfaces ?? []) {
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
