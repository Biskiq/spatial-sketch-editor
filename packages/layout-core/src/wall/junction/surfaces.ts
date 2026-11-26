import type { LayoutVec2 } from '../../geometry/coordinates';
import type {
	CompiledJunctionInterface,
	CompiledJunctionLeg,
	CompiledJunctionSurface,
	CompiledLegJoin,
} from '../../geometry/types';
import { JUNCTION_BAND_EPSILON, JUNCTION_DET_EPSILON, outwardTangent } from './geometry';
import { compareLegs, unionBands } from './joins';

/**
 * A branch leg at a degree >= 3 Junction, **trimmed against the resolved core
 * material** rather than left to interpenetration. The leg's material begins at
 * `clipDistance`; its end cross-section is an internal interface, with the parts
 * no core material covers emitted as explicit `branch-trim` surfaces owned by
 * this leg, and the coincident parts suppressing the core's own face per band.
 */
export function trimJoin(
	leg: CompiledJunctionLeg,
	bands: Array<{ bottomY: number; topY: number }>,
	point: LayoutVec2,
	coverers: readonly CompiledJunctionLeg[],
	allBands: Array<{ bottomY: number; topY: number }>,
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
		interfaces: trim.interfaces,
	};
}

/**
 * Does a tangent-continuation pair at a degree >= 3 Junction still expose a
 * thickness/height step? The step lies in the Junction plane, on the sides of the
 * thicker leg; if some other incident leg's footprint covers every sample of it,
 * the surface is buried inside that leg's body and stays suppressed.
 */
/** Is `point` inside the leg's own solid footprint (half-thickness band)? */
function pointInLegFootprint(
	point: LayoutVec2,
	junction: LayoutVec2,
	leg: CompiledJunctionLeg,
): boolean {
	const t = outwardTangent(leg);
	const n = leg.normalOut;
	const dx = point[0] - junction[0];
	const dy = point[1] - junction[1];
	const along = dx * t[0] + dy * t[1];
	const lateral = dx * n[0] + dy * n[1];
	return (
		along >= -JUNCTION_BAND_EPSILON &&
		Math.abs(lateral) <= leg.halfThickness + JUNCTION_BAND_EPSILON
	);
}

/**
 * Is the leg's endpoint cross-section solid across the whole band `[lo, hi]`?
 * Endpoint Opening bands answer it — the already-compiled fact (Decision 10), so
 * an Opening void is handled per band exactly like any other void band.
 */
export function legSolidInBand(leg: CompiledJunctionLeg, lo: number, hi: number): boolean {
	for (const band of leg.endpointSolidBands) {
		if (!band.solid) continue;
		if (lo >= band.bottomY - JUNCTION_BAND_EPSILON && hi <= band.topY + JUNCTION_BAND_EPSILON)
			return true;
	}
	return false;
}

/** Does the leg have physical material at `point` for the whole band `[lo, hi]`? */
function legMaterialAt(
	point: LayoutVec2,
	junction: LayoutVec2,
	leg: CompiledJunctionLeg,
	lo: number,
	hi: number,
): boolean {
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
export function continuationSurfaces(
	junction: LayoutVec2,
	a: CompiledJunctionLeg,
	b: CompiledJunctionLeg,
	coverers: readonly CompiledJunctionLeg[],
): {
	surfaces: CompiledJunctionSurface[];
	forA: CompiledJunctionSurface[];
	forB: CompiledJunctionSurface[];
} {
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
	lateral: LayoutVec2,
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
				const midpoint = atOffset(
					junction,
					lateral,
					(sign * (thinner.halfThickness + thicker.halfThickness)) / 2,
				);
				if (buriedBy(midpoint, junction, coverers, band)) continue;
				surfaces.push({
					ownerWallId: thicker.wallId,
					end: thicker.end,
					kind: 'continuation-thickness-step',
					from,
					to,
					normal: outwardTangent(thinner),
					bands: [{ bottomY: band.bottomY, topY: band.topY }],
				});
			}
			continue;
		}
		// Exactly one leg is solid: its own end cross-section is the exposed
		// surface. Attribution follows the material, never a tie-break.
		const solid = solidA ? a : b;
		const cross = [
			atOffset(junction, solid.normalOut, solid.halfThickness),
			atOffset(junction, solid.normalOut, -solid.halfThickness),
		];
		const normal: LayoutVec2 = [-outwardTangent(solid)[0], -outwardTangent(solid)[1]];
		for (const piece of exposedPieces(junction, cross[0]!, cross[1]!, band, coverers)) {
			surfaces.push({
				ownerWallId: solid.wallId,
				end: solid.end,
				kind: 'continuation-height-step',
				from: piece.from,
				to: piece.to,
				normal,
				bands: [{ bottomY: band.bottomY, topY: band.topY }],
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
	band: { bottomY: number; topY: number },
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
	segments?: CompiledJunctionInterface[],
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
		const coverer =
			coverers.find((leg) => legMaterialAt(midpoint, junction, leg, band.bottomY, band.topY)) ??
			null;
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
			(midpoint[0] - junction[0]) * run.coverer.normalOut[0] +
			(midpoint[1] - junction[1]) * run.coverer.normalOut[1];
		if (
			segments &&
			Math.abs(Math.abs(lateralMid) - run.coverer.halfThickness) <= JUNCTION_BAND_EPSILON
		) {
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
	band: { bottomY: number; topY: number },
): CompiledJunctionInterface {
	const n = coverer.normalOut;
	const t = coverer.tangentOut;
	const project = (point: LayoutVec2): number =>
		(point[0] - junction[0]) * t[0] + (point[1] - junction[1]) * t[1];
	const lateralMid =
		((from[0] + to[0]) / 2 - junction[0]) * n[0] + ((from[1] + to[1]) / 2 - junction[1]) * n[1];
	const side: LayoutVec2 = lateralMid >= 0 ? [n[0], n[1]] : [-n[0], -n[1]];
	const a = project(from);
	const b = project(to);
	return {
		wallId: coverer.wallId,
		end: coverer.end,
		normal: side,
		fromDistance: Math.min(a, b),
		toDistance: Math.max(a, b),
		bands: [{ bottomY: band.bottomY, topY: band.topY }],
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
	allBands: readonly { bottomY: number; topY: number }[],
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
				bands: [{ bottomY: band.bottomY, topY: band.topY }],
			});
		}
	}
	return {
		clipDistance,
		endBoundary: [front, back],
		surfaces,
		interfaces: mergeInterfaces(interfaces),
	};
}

/** Merge per-band interface records into one record per (face, interval). */
function mergeInterfaces(
	records: readonly CompiledJunctionInterface[],
): CompiledJunctionInterface[] {
	const merged: CompiledJunctionInterface[] = [];
	for (const record of records) {
		const existing = merged.find(
			(candidate) =>
				candidate.wallId === record.wallId &&
				candidate.end === record.end &&
				candidate.normal[0] === record.normal[0] &&
				candidate.normal[1] === record.normal[1] &&
				Math.abs(candidate.fromDistance - record.fromDistance) <= JUNCTION_BAND_EPSILON &&
				Math.abs(candidate.toDistance - record.toDistance) <= JUNCTION_BAND_EPSILON,
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
function coreTrimDistance(
	junction: LayoutVec2,
	leg: CompiledJunctionLeg,
	coverers: readonly CompiledJunctionLeg[],
): number {
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
			if (Math.abs(aAlong) <= JUNCTION_DET_EPSILON && lambda * bAlong < -JUNCTION_DET_EPSILON)
				return 0;
			const lower = Math.max(
				bandLower(lambda),
				0,
				aAlong > JUNCTION_DET_EPSILON ? (-lambda * bAlong) / aAlong : Number.NEGATIVE_INFINITY,
			);
			if (lower > JUNCTION_BAND_EPSILON) return 0;
			const upper = Math.min(
				Math.abs(aSide) <= JUNCTION_DET_EPSILON
					? Number.POSITIVE_INFINITY
					: Math.max(
							(coverer.halfThickness - lambda * bSide) / aSide,
							(-coverer.halfThickness - lambda * bSide) / aSide,
						),
				alongUpper(lambda),
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
					if (lambda >= lo - JUNCTION_BAND_EPSILON && lambda <= hi + JUNCTION_BAND_EPSILON)
						candidates.push(lambda);
				}
			}
		}
		for (const lambda of candidates) cut = Math.max(cut, prefixEnd(lambda));
	}
	return Math.max(0, cut);
}
