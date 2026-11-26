import type { LayoutVec2 } from '../../geometry/coordinates';
import { p2311Measure } from '../../kernel/work-observer';
import type {
	CompiledEndCorner,
	CompiledEndpointBand,
	CompiledJunction,
	CompiledJunctionLeg,
	CompiledJunctionNeighbor,
	CompiledJunctionResolution,
	CompiledJunctionSurface,
	CompiledLegJoin,
	CompiledWallSection,
	LayoutGeometryIssue,
} from '../../geometry/types';
import { geometryId } from '../../geometry/types';
import {
	JUNCTION_BAND_EPSILON,
	JUNCTION_MITER_LIMIT,
	cornerForEnd,
	dot,
	isFoldPair,
	isTangentContinuation,
	joinsBounds2,
	legEndBoundary,
	outwardTangent,
	resolveLegPairCorner,
} from './geometry';
import { resolveStarPartition } from './sectors';
import { continuationSurfaces, legSolidInBand, trimJoin } from './surfaces';

/**
 * Solid/void vertical bands at a Wall endpoint, from its compiled sections —
 * the already-compiled Opening endpoint fact the solve needs (Decision 10).
 * Never re-reads `LayoutDocument`.
 */
export function endpointSolidBands(
	sections: readonly CompiledWallSection[],
	atDistance: number,
	height: number,
	epsilon = JUNCTION_BAND_EPSILON,
): CompiledEndpointBand[] {
	const intervals: Array<{ lo: number; hi: number; openingId?: string }> = [];
	const openingIds: string[] = [];
	for (const section of sections) {
		if (atDistance < section.startDistance - epsilon || atDistance > section.endDistance + epsilon)
			continue;
		if (section.openingId && !openingIds.includes(section.openingId))
			openingIds.push(section.openingId);
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
export function unionBands(
	legs: readonly CompiledJunctionLeg[],
): Array<{ bottomY: number; topY: number }> {
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
	options: { miterLimit?: number; roundedContinuation?: boolean } = {},
): { resolution: CompiledJunctionResolution; issues: LayoutGeometryIssue[] } {
	const miterLimit = options.miterLimit ?? JUNCTION_MITER_LIMIT;
	const issues: LayoutGeometryIssue[] = [];
	const legOrder = legs.map((leg) => ({ wallId: leg.wallId, end: leg.end }));
	const bands = unionBands(legs);
	const joins: CompiledLegJoin[] = [];

	if (legs.length === 0) {
		return {
			resolution: {
				junctionId,
				legOrder,
				joins,
				bounds2: { min: [...point] as LayoutVec2, max: [...point] as LayoutVec2 },
			},
			issues,
		};
	}

	if (legs.length === 1) {
		joins.push(terminalJoin(point, legs[0]!, bands));
		return {
			resolution: { junctionId, legOrder, joins, bounds2: joinsBounds2(point, joins) },
			issues,
		};
	}

	if (legs.length === 2) {
		const [a, b] = legs as [CompiledJunctionLeg, CompiledJunctionLeg];
		if (isFoldPair(a, b)) {
			issues.push(foldIssue(junctionId));
			joins.push(
				suppressedJoin(a, bands, undefined, undefined, true),
				suppressedJoin(b, bands, undefined, undefined, true),
			);
			return {
				resolution: { junctionId, legOrder, joins, bounds2: joinsBounds2(point, joins) },
				issues,
			};
		}
		if (isTangentContinuation(a, b) || options.roundedContinuation) {
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
				suppressedJoin(b, bands, neighborFacts(a), step.forB),
			);
			return {
				resolution: { junctionId, legOrder, joins, bounds2: joinsBounds2(point, joins) },
				issues,
			};
		}
		// Canonical roles: prefer the departing (start) leg as `cur`.
		const swap = a.end === 'start' && b.end === 'end';
		const prev = swap ? b : a;
		const cur = swap ? a : b;
		const resolved = resolveLegPairCorner(point, prev, cur, miterLimit);
		if ('fold' in resolved) {
			issues.push(foldIssue(junctionId));
			joins.push(
				suppressedJoin(prev, bands, undefined, undefined, true),
				suppressedJoin(cur, bands, undefined, undefined, true),
			);
			return {
				resolution: { junctionId, legOrder, joins, bounds2: joinsBounds2(point, joins) },
				issues,
			};
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
		const prevJoin = cornerJoin(
			prev,
			bands,
			cornerForEnd(resolved.corner, 'prev', prev.end),
			ownerWallId === prev.wallId ? seam : null,
			{
				canonicalRole: 'prev',
				canonicalCorner: resolved.corner,
				neighbor: neighborFacts(cur),
			},
		);
		const curJoin = cornerJoin(
			cur,
			bands,
			cornerForEnd(resolved.corner, 'cur', cur.end),
			ownerWallId === cur.wallId ? seam : null,
			{
				canonicalRole: 'cur',
				canonicalCorner: resolved.corner,
				neighbor: neighborFacts(prev),
			},
		);
		attachCornerExposedEnd(prevJoin, resolved.corner, prev, cur, bands);
		attachCornerExposedEnd(curJoin, resolved.corner, cur, prev, bands);
		joins.push(prevJoin, curJoin);
		return {
			resolution: { junctionId, legOrder, joins, bounds2: joinsBounds2(point, joins) },
			issues,
		};
	}

	// degree >= 3 — resolve across ALL incident legs, then partition the local
	// physical material so no two Wall-owned bodies occupy the same volume.
	//
	// 1. Continuation partners first: a collinear antiparallel pair is one through
	//  Wall split at this Junction, so it suppresses its shared interface (and
	//  still exposes its thickness/height/Opening difference, per band).
	// 2. One **core** is selected deterministically: the continuation pair
	//  containing the smallest `wallId`, else the most nearly antiparallel pair.
	//  The core keeps its own material, exactly as for a plain continuation.
	// 3. Every other leg is **trimmed** at the distance where it leaves the
	//  resolved core material. Its end cross-section is an internal interface
	//  (never a buried cap): the still-exposed parts are emitted as explicit,
	//  Wall-attributed trim surfaces, and the parts that rest on a core face
	//  suppress that face region per vertical band.
	// 4. With **no** continuation pair (Y / star) the Junction is partitioned by
	//  its own beams instead: every cyclically adjacent pair of legs gets one
	//  equal-clearance beam, each leg's material is cut by the two beams that
	//  bound its sector, and the sector wedge a Wall-owned strip cannot express
	//  is published as an explicit Wall-attributed keel. Nothing is left to
	//  interpenetration: a Junction this rule cannot partition fails closed.
	return p2311Measure('junction-partition', () =>
		resolveDegreeThreePlus(junctionId, point, legs, bands, issues, miterLimit),
	);
}

/**
 * Deterministic core selection: which incident legs own the Junction material
 * that every other leg trims against. Rotation-invariant (it never reads an
 * absolute angle zero — only `wallId` order and relative ray geometry).
 */
function selectCore(
	legs: readonly CompiledJunctionLeg[],
): [CompiledJunctionLeg, CompiledJunctionLeg | null] {
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

export function compareLegs(a: CompiledJunctionLeg, b: CompiledJunctionLeg): number {
	return a.wallId < b.wallId
		? -1
		: a.wallId > b.wallId
			? 1
			: a.end < b.end
				? -1
				: a.end > b.end
					? 1
					: 0;
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
	miterLimit: number,
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
		return {
			resolution: {
				junctionId,
				legOrder,
				joins: starJoins,
				bounds2: joinsBounds2(point, starJoins),
			},
			issues,
		};
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
	const step = continuationSurfaces(
		point,
		coreA,
		coreThrough,
		legs.filter((leg) => !coreIds.has(leg.wallId)),
	);
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
	return {
		resolution: { junctionId, legOrder, joins, bounds2: joinsBounds2(point, joins) },
		issues,
	};
}

/**
 * A free end is exposed across its whole solid profile, so `layout-core` publishes
 * the square cap as a resolved surface: one per solid endpoint band, leaving any
 * Opening that reaches the end as a void.
 */
function terminalJoin(
	point: LayoutVec2,
	leg: CompiledJunctionLeg,
	bands: Array<{ bottomY: number; topY: number }>,
): CompiledLegJoin {
	const [from, to] = legEndBoundary(point, leg) as [LayoutVec2, LayoutVec2];
	const outward = outwardTangent(leg);
	const surfaces: CompiledJunctionSurface[] = leg.endpointSolidBands
		.filter((band) => band.solid && band.topY - band.bottomY > JUNCTION_BAND_EPSILON)
		.map((band) => ({
			ownerWallId: leg.wallId,
			end: leg.end,
			kind: 'terminal-cap',
			from,
			to,
			normal: [-outward[0], -outward[1]],
			bands: [{ bottomY: band.bottomY, topY: band.topY }],
		}));
	return {
		wallId: leg.wallId,
		end: leg.end,
		kind: 'terminal',
		endBoundary: [],
		interfaceSuppressed: false,
		ownedSeam: null,
		bands: bands.map((band) => ({ bottomY: band.bottomY, topY: band.topY })),
		corner: null,
		...(surfaces.length > 0 ? { surfaces } : {}),
	};
}

/**
 * Above or beside a shorter neighbour a mitred Wall's end is exposed: the corner
 * plane is only interior where both legs are solid. The bevel and both-open seams
 * already close these bands through the owner's bridge, so only a pure miter with
 * no shared endpoint void needs the surface.
 */
function attachCornerExposedEnd(
	join: CompiledLegJoin,
	corner: CompiledEndCorner,
	leg: CompiledJunctionLeg,
	neighbor: CompiledJunctionLeg,
	bands: Array<{ bottomY: number; topY: number }>,
): void {
	if (corner.front.kind !== 'miter' || corner.back.kind !== 'miter') return;
	if (leg.endpointOpen && neighbor.endpointOpen) return;
	const from = corner.front.apex;
	const to = corner.back.apex;
	const outward = outwardTangent(leg);
	const lateral: LayoutVec2 = [-(to[1] - from[1]), to[0] - from[0]];
	const length = Math.hypot(lateral[0], lateral[1]);
	if (length <= JUNCTION_BAND_EPSILON) return;
	const sign = dot(lateral, outward) > 0 ? -1 : 1;
	const normal: LayoutVec2 = [(sign * lateral[0]) / length, (sign * lateral[1]) / length];
	for (const band of bands) {
		if (
			!legSolidInBand(leg, band.bottomY, band.topY) ||
			legSolidInBand(neighbor, band.bottomY, band.topY)
		)
			continue;
		(join.surfaces ??= []).push({
			ownerWallId: leg.wallId,
			end: leg.end,
			kind: 'corner-exposed-end',
			from,
			to,
			normal,
			bands: [{ bottomY: band.bottomY, topY: band.topY }],
		});
	}
}

function neighborFacts(leg: CompiledJunctionLeg): CompiledJunctionNeighbor {
	return {
		wallId: leg.wallId,
		tangentOut: leg.tangentOut,
		normalOut: leg.normalOut,
		halfThickness: leg.halfThickness,
		endpointOpen: leg.endpointOpen,
		endpointSolidBands: leg.endpointSolidBands,
	};
}

/**
 * The join a leg carries when the Junction's partition rule refuses a
 * configuration. It is deliberately **not** buildable: the shared seam rule
 * (`joinSeamFailure`) reports `junction_seam_uncovered` for it, so the compile
 * gate blocks and no builder emits overlapping Wall bodies. Failing closed is
 * the only alternative to rendering interpenetration.
 */
function unresolvedJoin(
	leg: CompiledJunctionLeg,
	bands: Array<{ bottomY: number; topY: number }>,
): CompiledLegJoin {
	return {
		wallId: leg.wallId,
		end: leg.end,
		kind: 'suppressed',
		endBoundary: [],
		interfaceSuppressed: false,
		ownedSeam: null,
		bands: bands.map((band) => ({ bottomY: band.bottomY, topY: band.topY })),
		corner: null,
	};
}

function suppressedJoin(
	leg: CompiledJunctionLeg,
	bands: Array<{ bottomY: number; topY: number }>,
	neighbor?: CompiledJunctionNeighbor,
	surfaces?: readonly CompiledJunctionSurface[],
	fold = false,
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
		...(fold ? { fold: true as const } : {}),
	};
}

function cornerJoin(
	leg: CompiledJunctionLeg,
	bands: Array<{ bottomY: number; topY: number }>,
	corner: CompiledEndCorner,
	ownedSeam: { sector: number; polygon: LayoutVec2[] } | null,
	meta: {
		canonicalRole: 'prev' | 'cur';
		canonicalCorner: CompiledEndCorner;
		neighbor: CompiledJunctionNeighbor;
	},
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
		neighbor: meta.neighbor,
	};
}

function foldIssue(junctionId: string): LayoutGeometryIssue {
	return {
		path: `junctions.${junctionId}`,
		code: 'junction_seam_fold',
		message:
			'Junction has two legs pointing the same direction (fold); offset regions would overlap.',
		targetId: junctionId,
	};
}

/** The plan polygon of the material wedge between two incident legs. */
function wedgePolygon(
	junction: LayoutVec2,
	prev: CompiledJunctionLeg,
	cur: CompiledJunctionLeg,
): LayoutVec2[] {
	const a0: LayoutVec2 = [
		junction[0] - prev.halfThickness * prev.normalOut[0],
		junction[1] - prev.halfThickness * prev.normalOut[1],
	];
	const b0: LayoutVec2 = [
		junction[0] + cur.halfThickness * cur.normalOut[0],
		junction[1] + cur.halfThickness * cur.normalOut[1],
	];
	return [[...junction] as LayoutVec2, a0, b0];
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
export function legJoinsByWall(
	junctions: readonly CompiledJunction[] | undefined,
): Map<string, CompiledWallEnds> {
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
