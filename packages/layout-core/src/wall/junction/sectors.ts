import type { LayoutVec2 } from '../../geometry/coordinates';
import type {
	CompiledJunctionLeg,
	CompiledJunctionResolution,
	CompiledJunctionSurface,
	CompiledLegJoin,
	LayoutGeometryIssue,
} from '../../geometry/types';
import {
	JUNCTION_BAND_EPSILON,
	JUNCTION_DET_EPSILON,
	JUNCTION_PROBE_TOLERANCE,
	JUNCTION_SECTOR_SNAP,
	JUNCTION_SURFACE_PROBE,
	cross,
	dot,
	joinsBounds2,
	outwardTangent,
} from './geometry';
import { legSolidInBand } from './surfaces';

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
function lineIntersection(
	p1: LayoutVec2,
	d1: LayoutVec2,
	p2: LayoutVec2,
	d2: LayoutVec2,
): LayoutVec2 | null {
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
		junction[1] + sign * leg.halfThickness * leg.normalOut[1],
	];
}

/** Where a leg's `sign`-sided offset line crosses a beam line, or `null`. */
function beamOffsetCrossing(
	junction: LayoutVec2,
	leg: CompiledJunctionLeg,
	sign: 1 | -1,
	beam: PartitionBeam,
): LayoutVec2 | null {
	return lineIntersection(
		offsetLinePoint(junction, leg, sign),
		outwardTangent(leg),
		beam.origin,
		beam.dir,
	);
}

/** The equal-clearance beam separating `a` from `b`, or `null` when unresolvable. */
function partitionBeam(
	junction: LayoutVec2,
	a: CompiledJunctionLeg,
	b: CompiledJunctionLeg,
): PartitionBeam | null {
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
		tb,
	);
	if (!origin) return null;
	return { prev: a, next: b, origin, dir, normal, prevSide: signOf(dot(ta, normal)) };
}

/** Twice the signed plan area of a triangle. */
function triangleArea2(a: LayoutVec2, b: LayoutVec2, c: LayoutVec2): number {
	return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
}

/** Clip a convex plan polygon by the half-plane `{p: sign · (p - anchor) · normal ≥ 0}`. */
function clipHalfPlane(
	polygon: readonly LayoutVec2[],
	anchor: LayoutVec2,
	normal: LayoutVec2,
	sign: 1 | -1,
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
				current[1] + (next[1] - current[1]) * amount,
			]);
		}
	}
	return output;
}

/** Signed plan area of a convex polygon. */
function polygonArea(polygon: readonly LayoutVec2[]): number {
	if (polygon.length < 3) return 0;
	const origin = polygon[0]!;
	const shift = Math.abs(origin[0]) > 1e6 || Math.abs(origin[1]) > 1e6;
	const ox = shift ? origin[0] : 0;
	const oz = shift ? origin[1] : 0;
	let total = 0;
	for (let index = 0; index < polygon.length; index += 1) {
		const a = polygon[index]!;
		const b = polygon[(index + 1) % polygon.length]!;
		total += (a[0] - ox) * (b[1] - oz) - (b[0] - ox) * (a[1] - oz);
	}
	return total / 2;
}

/** Outward plan normal of a polygon edge, pointing away from the polygon's centroid. */
function edgeOutwardNormal(
	polygon: readonly LayoutVec2[],
	from: LayoutVec2,
	to: LayoutVec2,
): LayoutVec2 {
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
	bands: readonly { bottomY: number; topY: number }[],
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
		bands: exposed,
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
		severity: 'error',
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
	legs: readonly CompiledJunctionLeg[],
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
function _subtractConvexPolygon(
	polygon: readonly LayoutVec2[],
	cutter: readonly LayoutVec2[],
): LayoutVec2[][] {
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
function cleanSectorRegion(
	junction: LayoutVec2,
	leg: CompiledJunctionLeg,
	polygon: readonly LayoutVec2[],
): LayoutVec2[] {
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
		if (
			last &&
			Math.abs(last[0] - point[0]) <= JUNCTION_SECTOR_SNAP &&
			Math.abs(last[1] - point[1]) <= JUNCTION_SECTOR_SNAP
		) {
			continue;
		}
		merged.push(point);
	}
	while (merged.length > 1) {
		const first = merged[0]!;
		const last = merged[merged.length - 1]!;
		if (
			Math.abs(last[0] - first[0]) > JUNCTION_SECTOR_SNAP ||
			Math.abs(last[1] - first[1]) > JUNCTION_SECTOR_SNAP
		)
			break;
		merged.pop();
	}
	return merged.map(
		([along, lateral]): LayoutVec2 => [
			junction[0] + along * t[0] + lateral * n[0],
			junction[1] + along * t[1] + lateral * n[1],
		],
	);
}

/**
 * Partition a degree >= 3 Junction that has **no** continuation pair (Y, star)
 * across all of its incident legs:
 *
 * ```text
 * cyclic leg pairs → one equal-clearance beam each
 * leg band + its two beams → this leg's Junction-local cell (a half-plane
 *  intersection, never a wedge sign test)
 * cell cut at capDistance → the keel this Wall owns near the Junction
 * cell beyond capDistance → the Wall's own body (a plain strip, nothing to solve)
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
export function resolveStarPartition(
	junctionId: string,
	point: LayoutVec2,
	legs: readonly CompiledJunctionLeg[],
	bands: Array<{ bottomY: number; topY: number }>,
	issues: LayoutGeometryIssue[],
): { resolution: CompiledJunctionResolution; issues: LayoutGeometryIssue[] } | null {
	const count = legs.length;
	if (count < 3) return null;
	const legOrder = legs.map((leg) => ({ wallId: leg.wallId, end: leg.end }));
	const beams: PartitionBeam[] = [];
	for (let index = 0; index < count; index += 1) {
		const a = legs[index]!;
		const b = legs[(index + 1) % count]!;
		const beam = partitionBeam(point, a, b);
		if (!beam)
			return starFailure(junctionId, `no separating beam for ${a.wallId} and ${b.wallId}`, issues);
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
			signOf(dot(leg.normalOut, outwardTangent(prev))) !==
			signOf(dot(leg.normalOut, outwardTangent(next)))
		);
	});
	// The wedge form is the closed form of this rule and solves the symmetric Y in
	// one step. It **declines** (returns `null`, emitting nothing) whenever it
	// cannot express the sector — a beam crossing that is degenerate, a collapsed
	// cap, a thin neighbour's wrap — and the difference form then solves the very
	// same Junction exactly, because it is the definition rather than a case. A
	// Junction is only unresolved when no separating beam exists at all, which is
	// reported once above and fails closed here.
	const joins =
		(wedged ? resolveStarWedges(point, legs, beams, bands) : null) ??
		resolveStarSectors(point, legs, beams, bands);
	return {
		resolution: { junctionId, legOrder, joins, bounds2: joinsBounds2(point, joins) },
		issues,
	};
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
function sideAtOrigin(
	owner: CompiledJunctionLeg,
	other: CompiledJunctionLeg,
	beam: PartitionBeam,
): 1 | -1 {
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
	bands: Array<{ bottomY: number; topY: number }>,
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
		for (const [neighbour, beam] of [[prev, prevBeam] as const, [next, nextBeam] as const]) {
			let region: LayoutVec2[] = [
				[
					point[0] + leg.halfThickness * leg.normalOut[0],
					point[1] + leg.halfThickness * leg.normalOut[1],
				],
				[
					point[0] - leg.halfThickness * leg.normalOut[0],
					point[1] - leg.halfThickness * leg.normalOut[1],
				],
				prevSide > 0 ? capNext : capPrev,
				prevSide > 0 ? capPrev : capNext,
			];
			region = clipHalfPlane(region, beam.origin, beam.normal, sideAtOrigin(neighbour, leg, beam));
			const farSide = signOf(-dot(neighbour.normalOut, t));
			region = clipHalfPlane(
				region,
				[
					point[0] + farSide * neighbour.halfThickness * neighbour.normalOut[0],
					point[1] + farSide * neighbour.halfThickness * neighbour.normalOut[1],
				],
				neighbour.normalOut,
				farSide,
			);
			if (
				region.length >= 3 &&
				Math.abs(polygonArea(region)) > JUNCTION_BAND_EPSILON * leg.halfThickness
			) {
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
			const polygon: LayoutVec2[] =
				keelArea2 > 0 ? [capPrev, apex, capNext] : [capNext, apex, capPrev];
			regions.push(polygon);
			pushKeelSide(surfaces, leg, prev, polygon, capPrev, apex, keelBands);
			pushKeelSide(surfaces, leg, next, polygon, apex, capNext, keelBands);
		}
		if (regions.length > 0 && keelBands.length > 0) {
			keel = {
				regions,
				bands: keelBands.map((band) => ({ bottomY: band.bottomY, topY: band.topY })),
			};
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
				back: { kind: 'miter', apex: leg.end === 'start' ? minusCap : plusCap },
			},
			...(keel ? { keel } : {}),
			...(surfaces.length > 0 ? { surfaces } : {}),
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
	bands: Array<{ bottomY: number; topY: number }>,
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
				point[1] + distance * t[1] + half * leg.normalOut[1],
			],
			[
				point[0] + distance * t[0] - half * leg.normalOut[0],
				point[1] + distance * t[1] - half * leg.normalOut[1],
			],
			[point[0] - half * leg.normalOut[0], point[1] - half * leg.normalOut[1]],
		];
		// Farthest station at which a beam still cuts this leg's strip: beyond it the
		// whole strip lies inside the cell, so the Wall's own body can start there.
		let capDistance = 0;
		for (const beam of [prevBeam, nextBeam]) {
			for (const sign of [1, -1] as const) {
				const crossing = lineIntersection(
					offsetLinePoint(point, leg, sign),
					t,
					beam.origin,
					beam.dir,
				);
				if (crossing) capDistance = Math.max(capDistance, along(crossing));
			}
		}
		capDistance = Math.max(0, capDistance);
		const capPlus: LayoutVec2 = [
			point[0] + capDistance * t[0] + half * leg.normalOut[0],
			point[1] + capDistance * t[1] + half * leg.normalOut[1],
		];
		const capMinus: LayoutVec2 = [
			point[0] + capDistance * t[0] - half * leg.normalOut[0],
			point[1] + capDistance * t[1] - half * leg.normalOut[1],
		];
		const regions: LayoutVec2[][] = [];
		const pushRegion = (polygon: readonly LayoutVec2[]): void => {
			const cleaned = cleanSectorRegion(point, leg, polygon);
			const area = polygonArea(cleaned);
			if (
				cleaned.length < 3 ||
				Math.abs(area) <= JUNCTION_BAND_EPSILON * Math.max(JUNCTION_BAND_EPSILON, half)
			)
				return;
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
			[next, nextBeam, prevBeam] as const,
		]) {
			const farSide = signOf(-dot(neighbour.normalOut, t));
			let wrap = clipHalfPlane(bandQuad(capDistance), point, t, 1);
			wrap = clipHalfPlane(wrap, beam.origin, beam.normal, sideAtOrigin(neighbour, leg, beam));
			wrap = clipHalfPlane(
				wrap,
				[
					point[0] + farSide * neighbour.halfThickness * neighbour.normalOut[0],
					point[1] + farSide * neighbour.halfThickness * neighbour.normalOut[1],
				],
				neighbour.normalOut,
				farSide,
			);
			// Only the shared beam is relaxed; the other beam still bounds this leg.
			wrap = clipHalfPlane(
				wrap,
				otherBeam.origin,
				otherBeam.normal,
				sideAtOrigin(leg, neighbour, otherBeam),
			);
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
				if (
					along(from) >= capDistance - JUNCTION_SECTOR_SNAP &&
					along(to) >= capDistance - JUNCTION_SECTOR_SNAP
				) {
					continue;
				}
				if (Math.hypot(to[0] - from[0], to[1] - from[1]) <= JUNCTION_BAND_EPSILON) continue;
				const normal = edgeOutwardNormal(region, from, to);
				const exposed = keelBands.filter((band) => {
					const coverer = junctionPointOwner(
						point,
						[
							(from[0] + to[0]) / 2 + JUNCTION_SURFACE_PROBE * normal[0],
							(from[1] + to[1]) / 2 + JUNCTION_SURFACE_PROBE * normal[1],
						],
						leg,
						legs,
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
					bands: exposed.map((band) => ({ bottomY: band.bottomY, topY: band.topY })),
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
				back: { kind: 'miter', apex: leg.end === 'start' ? capMinus : capPlus },
			},
			...(keel ? { keel } : {}),
			...(surfaces.length > 0 ? { surfaces } : {}),
		});
	}
	return joins;
}
