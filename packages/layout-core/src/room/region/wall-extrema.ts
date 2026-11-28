/**
 * `wall-extrema.ts` — certified vertical extrema of one Wall strip under one
 * sloped Region (§7.3).
 *
 * ```text
 * D(p)    = underside(p) - wallTopY(p)       over covered strip points p
 * contact = min D     gap = max D     overrun = max(wallTopY - top) = -contact - thickness
 * ```
 *
 * Why the candidate set below is complete rather than sampled:
 *
 * - On one side of the ridge the underside is affine in plan, `A(p) = A0 + g·p`.
 * - A strip cell is `X(u, v) = F(u) + v E(u)` with `F`, `E` affine in `u`, and its
 *   top is affine in `u` (cells split at Wall-top knots). So on one ridge side
 *   `D(X(u, v))` is bilinear in `(u, v)`; a bilinear function has no interior
 *   extremum (its Hessian is indefinite or zero). The station mapping is
 *   nonlinear in plan on a curved or mitred cell, which is why plan-vertex
 *   sampling alone is not proof; the parameter square makes it exact.
 * - Every extremum therefore lies on the boundary of the covered parameter set:
 *   the four cell edges (D affine along each, per ridge side), the ridge (the
 *   underside is constant there, the top affine in `u`), or the preimage of a
 *   footprint edge `n·p = c`. On that preimage `v = N(u) / M(u)` and
 *   `D = k + c1 u + K(u) / M(u)` with `K` quadratic and `M` affine, so
 *   `D'' = 2 Γ / M³` keeps one sign wherever `M ≠ 0`: at most one stationary
 *   point per branch, and it is a root of
 *   `m1 w u² + 2 m0 w u + (c1 m0² + k1 m0 - k0 m1) = 0`, `w = c1 m1 + k2`.
 * - A constant-top Junction patch is convex and D is affine on it per ridge
 *   side, so its extrema are vertices of `patch ∩ footprint ∩ side`.
 *
 * Candidates are therefore the cell or patch vertices, footprint vertices,
 * pairwise intersections of cell or patch edges, footprint edges and the ridge,
 * and the stationary points above. Each candidate is checked for membership in
 * the cell and the footprint (inclusive within the relation tolerance, which
 * only widens the set and so keeps both bounds conservative) and evaluated with
 * the shared `regionUndersideAt` evaluator.
 *
 * Numerical certification. Pieces and footprint move to a local frame at the
 * footprint (`wall-extrema-geometry.ts`), so rounding scales with the Layout's
 * dimensions, not its world position. Each candidate carries an interval
 * certain to hold its exact D: `D ± (|g| dp + |Δtop| du + roundY)` from its plan
 * error `dp`, station error `du` (inverse Jacobian) and evaluation rounding,
 * clipped to the cell's own top range. The reading certifies only when both
 * extrema are pinned within {@link REGION_WALL_EXTREMA_TOLERANCE_METERS};
 * otherwise, like a non-finite value or a folded cell, it is `uncertified`.
 */
import type { LayoutVec2 } from '../../geometry/coordinates';
import { pointStrictlyInsidePolygon } from '../../geometry/face-extraction';
import { pointNearBoundary } from '../region-wall-coverage';
import { regionFormProfile, regionUndersideAt, type RegionFormFacts } from './form';
import type { CompiledRegion } from '../../geometry/types';
import {
	boundsOf,
	boxesOverlap,
	cellFrame,
	cellPoint,
	cellUnfolded,
	clamp01,
	cross,
	dot,
	lerp,
	lineCrossing,
	pointInBox,
	quadraticRoots,
	segmentCrossing,
	stationError,
	UNIT_ROUNDOFF,
	type Box,
	type CellFrame,
	type Line,
	type Segment,
} from './wall-extrema-geometry';
import {
	compiledWallStrip,
	type WallStripCell,
	type WallStripEnds,
	type WallStripPatch,
	type WallStripPiece,
	type WallStripWall,
} from './wall-strip';

/** Refusal code when a Wall strip's vertical extrema cannot be certified. */
export const REGION_WALL_EXTREMA_UNCERTIFIED_CODE = 'region_wall_extrema_uncertified';

/**
 * Absolute bound, in metres, on the floating-point error of a certified contact
 * or gap. It is checked per reading from the candidates' own error bounds, at
 * any world position, and is three orders below the 1e-6 m relation tolerance
 * every reading and fit compares against. A reading that cannot meet it (an
 * ill-conditioned cell, a near-tangent crossing that governs the extremum, an
 * extreme world height) refuses instead.
 */
export const REGION_WALL_EXTREMA_TOLERANCE_METERS = 1e-9;

/** One extremal point: where it is, the two surfaces there and their clearance. */
export type RegionWallVerticalPoint = {
	readonly point: LayoutVec2;
	readonly undersideY: number;
	readonly wallTopY: number;
	/** `undersideY - wallTopY`. */
	readonly clearance: number;
};

export type RegionWallVerticalExtrema =
	| {
			readonly kind: 'certified';
			/** The minimum clearance and where it occurs. */
			readonly contact: RegionWallVerticalPoint;
			/** The maximum clearance and where it occurs. */
			readonly gap: RegionWallVerticalPoint;
			/** Highest rise of the Wall top above the Region's top face. */
			readonly overrun: number;
	  }
	| { readonly kind: 'uncovered' }
	| { readonly kind: 'uncertified'; readonly message: string };

type Side = { readonly gradient: LayoutVec2; readonly sign: -1 | 0 | 1 };

type Context = {
	readonly facts: RegionFormFacts;
	readonly footprint: readonly LayoutVec2[];
	readonly edges: readonly Segment[];
	readonly ridge: Line | null;
	readonly sides: readonly Side[];
	readonly azimuth: readonly [number, number];
	readonly qRidge: number;
	readonly tolerance: number;
	readonly bounds: Box;
	/** Rounding of one computed local plan point, `8 u L`. */
	readonly base: number;
	/** Largest underside gradient magnitude over the ridge sides. */
	readonly slope: number;
	/** Rounding of one evaluated clearance. */
	readonly roundY: number;
};

/** A clearance with its a-posteriori error bound, in the local frame. */
/** A reading and a closed interval certain to hold the exact value there. */
type Candidate = RegionWallVerticalPoint & { readonly low: number; readonly high: number };

/**
 * Certified contact, gap and overrun of one Wall strip under one Region.
 * `membership` is the inclusive footprint tolerance; the relation layer passes
 * its own epsilon so the extrema and the plan class read the same boundary.
 */
export function regionWallVerticalExtrema(
	facts: RegionFormFacts,
	pieces: readonly WallStripPiece[],
	wallId: string,
	membership: number,
): RegionWallVerticalExtrema {
	const local = localFrame(facts, pieces, membership);
	const context = local && extremaContext(local.facts, local.pieces, membership);
	if (!local || !context) {
		return { kind: 'uncertified', message: `Region form cannot be read over Wall '${wallId}'.` };
	}
	let contact: Candidate | null = null;
	let gap: Candidate | null = null;
	let lowMin = Infinity;
	let highMin = Infinity;
	let lowMax = -Infinity;
	let highMax = -Infinity;
	for (const piece of local.pieces) {
		const candidates =
			piece.kind === 'cell' ? cellCandidates(context, piece) : patchCandidates(context, piece);
		if (candidates === null) {
			return {
				kind: 'uncertified',
				message: `Wall '${wallId}' has a folded or degenerate strip cell, so its clearance under the roof cannot be certified.`,
			};
		}
		for (const candidate of candidates) {
			if (
				!Number.isFinite(candidate.clearance) ||
				!Number.isFinite(candidate.low) ||
				!Number.isFinite(candidate.high) ||
				!Number.isFinite(candidate.point[0]) ||
				!Number.isFinite(candidate.point[1])
			) {
				return {
					kind: 'uncertified',
					message: `Wall '${wallId}' produced a non-finite clearance under the roof.`,
				};
			}
			if (contact === null || candidate.clearance < contact.clearance) contact = candidate;
			if (gap === null || candidate.clearance > gap.clearance) gap = candidate;
			lowMin = Math.min(lowMin, candidate.low);
			highMin = Math.min(highMin, candidate.high);
			lowMax = Math.max(lowMax, candidate.low);
			highMax = Math.max(highMax, candidate.high);
		}
	}
	if (contact === null || gap === null) return { kind: 'uncovered' };
	const spread = Math.max(highMin - lowMin, highMax - lowMax);
	if (!(spread <= REGION_WALL_EXTREMA_TOLERANCE_METERS)) {
		return {
			kind: 'uncertified',
			message: `Wall '${wallId}' clearance under the roof can only be bounded to ${spread.toExponential(1)} m here, so it cannot be certified.`,
		};
	}
	return {
		kind: 'certified',
		contact: local.world(contact),
		gap: local.world(gap),
		overrun: -contact.clearance - facts.thickness,
	};
}

/** The form facts of one compiled Region, as every evaluator reads them. */
export function compiledRegionFormFacts(region: CompiledRegion): RegionFormFacts {
	return {
		role: region.role,
		form: region.form ?? { kind: 'flat' },
		footprint: region.footprint,
		datumY: region.datumY ?? region.bottomY,
		thickness: region.thickness ?? region.topY - region.bottomY,
	};
}

/** Certified extrema of one compiled Wall, with its resolved ends, under one compiled Region. */
export function compiledRegionWallExtrema(
	region: CompiledRegion,
	wall: WallStripWall,
	ends: WallStripEnds | undefined,
	floorElevation: number,
	membership: number,
): RegionWallVerticalExtrema {
	return regionWallVerticalExtrema(
		compiledRegionFormFacts(region),
		compiledWallStrip(wall, ends, floorElevation),
		wall.wallId,
		membership,
	);
}

// --- local frame -----------------------------------------------------------

type LocalFrame = {
	readonly facts: RegionFormFacts;
	/** Pieces that can meet the footprint, moved to the local frame. */
	readonly pieces: readonly WallStripPiece[];
	readonly world: (candidate: Candidate) => RegionWallVerticalPoint;
};

/** The footprint and the pieces near it, translated to the footprint's box centre. */
function localFrame(
	facts: RegionFormFacts,
	pieces: readonly WallStripPiece[],
	membership: number,
): LocalFrame | null {
	if (facts.footprint.length < 3) return null;
	const box = boundsOf(facts.footprint, 0);
	const anchor: LayoutVec2 = [(box.minX + box.maxX) / 2, (box.minZ + box.maxZ) / 2];
	if (!Number.isFinite(anchor[0]) || !Number.isFinite(anchor[1])) return null;
	const shift = (point: LayoutVec2): LayoutVec2 => [point[0] - anchor[0], point[1] - anchor[1]];
	const near = boundsOf(facts.footprint, membership);
	const moved: WallStripPiece[] = [];
	for (const piece of pieces) {
		const corners =
			piece.kind === 'cell' ? [piece.fa, piece.fb, piece.bb, piece.ba] : piece.polygon;
		if (!boxesOverlap(boundsOf(corners, membership), near)) continue;
		moved.push(
			piece.kind === 'cell'
				? {
						...piece,
						fa: shift(piece.fa),
						fb: shift(piece.fb),
						ba: shift(piece.ba),
						bb: shift(piece.bb),
					}
				: { ...piece, polygon: piece.polygon.map(shift) },
		);
	}
	return {
		facts: { ...facts, footprint: facts.footprint.map(shift) },
		pieces: moved,
		world: ({ low: _low, high: _high, point, ...rest }) => ({
			...rest,
			point: [point[0] + anchor[0], point[1] + anchor[1]],
		}),
	};
}

function extremaContext(
	facts: RegionFormFacts,
	pieces: readonly WallStripPiece[],
	membership: number,
): Context | null {
	const footprint = facts.footprint;
	if (footprint.length < 3 || facts.form.kind === 'flat') return null;
	const profile = regionFormProfile(facts.form, footprint);
	if (profile === null) return null;
	const d: [number, number] = [Math.cos(profile.azimuth), Math.sin(profile.azimuth)];
	const rise = facts.form.rise;
	const below: LayoutVec2 = [(rise / profile.runBelow) * d[0], (rise / profile.runBelow) * d[1]];
	const sides: Side[] =
		facts.form.kind === 'shed'
			? [{ gradient: below, sign: 0 }]
			: [
					{ gradient: below, sign: -1 },
					{
						gradient: [(-rise / profile.runAbove) * d[0], (-rise / profile.runAbove) * d[1]],
						sign: 1,
					},
				];
	const edges: Segment[] = footprint.map((a, index) => ({
		a,
		b: footprint[(index + 1) % footprint.length]!,
	}));
	let extent = 0;
	let topMagnitude = 0;
	const reach = (point: LayoutVec2) => {
		extent = Math.max(extent, Math.abs(point[0]), Math.abs(point[1]));
	};
	footprint.forEach(reach);
	for (const piece of pieces) {
		if (piece.kind === 'cell') {
			[piece.fa, piece.fb, piece.ba, piece.bb].forEach(reach);
			topMagnitude = Math.max(topMagnitude, Math.abs(piece.topA), Math.abs(piece.topB));
		} else {
			piece.polygon.forEach(reach);
			topMagnitude = Math.max(topMagnitude, Math.abs(piece.topY));
		}
	}
	const slope = Math.max(...sides.map((side) => Math.hypot(side.gradient[0], side.gradient[1])));
	return {
		facts,
		footprint,
		edges,
		ridge: facts.form.kind === 'gable' ? { normal: d, offset: profile.qRidge } : null,
		sides,
		azimuth: d,
		qRidge: profile.qRidge,
		tolerance: membership,
		bounds: boundsOf(footprint, membership),
		base: 8 * UNIT_ROUNDOFF * extent,
		slope,
		roundY:
			16 *
			UNIT_ROUNDOFF *
			(2 * slope * extent +
				Math.abs(facts.datumY) +
				rise +
				Math.abs(facts.thickness) +
				topMagnitude),
	};
}

// --- cells -----------------------------------------------------------------

/**
 * One parameter candidate `(u, v)`: plan error `dp`, station error `du`, and the
 * exact plan point when known (a footprint vertex) rather than mapped.
 */
type Param = {
	readonly u: number;
	readonly v: number;
	readonly dp: number;
	readonly du: number;
	readonly point?: LayoutVec2;
};

function cellCandidates(context: Context, cell: WallStripCell): Candidate[] | null {
	const frame = cellFrame(cell);
	const corners = [cell.fa, cell.fb, cell.bb, cell.ba];
	const box = boundsOf(corners, context.tolerance);
	if (!boxesOverlap(box, context.bounds)) return [];
	if (!cellUnfolded(frame)) return null;
	const { base } = context;
	const params: Param[] = (
		[
			[0, 0],
			[1, 0],
			[1, 1],
			[0, 1],
		] as const
	).map(([u, v]) => ({ u, v, dp: base, du: 0 }));
	const cellEdges: Array<{ segment: Segment; at: (t: number) => readonly [number, number] }> = [
		{ segment: { a: cell.fa, b: cell.fb }, at: (t) => [t, 0] },
		{ segment: { a: cell.ba, b: cell.bb }, at: (t) => [t, 1] },
		{ segment: { a: cell.fa, b: cell.ba }, at: (t) => [0, t] },
		{ segment: { a: cell.fb, b: cell.bb }, at: (t) => [1, t] },
	];
	const nearEdges = context.edges.filter((edge) =>
		boxesOverlap(boundsOf([edge.a, edge.b], context.tolerance), box),
	);
	for (const vertex of context.footprint) {
		if (pointInBox(vertex, box)) params.push(...inverseCell(frame, vertex, base, 0, context));
	}
	for (const [index, { segment, at }] of cellEdges.entries()) {
		const alongU = index < 2;
		const length = Math.hypot(segment.b[0] - segment.a[0], segment.b[1] - segment.a[1]);
		for (const edge of nearEdges) {
			const crossing = segmentCrossing(segment, edge, base, context.tolerance);
			if (crossing === null) continue;
			const [u, v] = at(crossing.t);
			const du = alongU ? Math.min(1, crossing.along / length) : 0;
			params.push({ u, v, dp: crossing.along + base, du });
		}
		if (context.ridge !== null) {
			const crossing = lineCrossing(segment, context.ridge, base);
			if (crossing === null) continue;
			const [u, v] = at(crossing.t);
			params.push({ u, v, dp: 3 * base, du: alongU ? crossing.dt : 0 });
		}
	}
	if (context.ridge !== null) {
		for (const edge of nearEdges) {
			const crossing = lineCrossing(edge, context.ridge, base);
			if (crossing === null) continue;
			const point = lerp(edge.a, edge.b, crossing.t);
			const along = crossing.dt * Math.hypot(edge.b[0] - edge.a[0], edge.b[1] - edge.a[1]);
			if (pointInBox(point, box))
				params.push(...inverseCell(frame, point, 3 * base, along, context));
		}
	}
	for (const edge of nearEdges) params.push(...stationaryOnEdge(context, frame, edge));
	const candidates: Candidate[] = [];
	const rise = cell.topB - cell.topA;
	const cellTops = [Math.min(cell.topA, cell.topB), Math.max(cell.topA, cell.topB)] as const;
	for (const param of params) {
		const point = param.point ?? cellPoint(frame, param.u, param.v);
		if (!footprintContains(context, point)) continue;
		const plan = context.slope * param.dp;
		const top = cell.topA + rise * param.u;
		candidates.push(
			evaluate(context, point, top, plan + Math.abs(rise) * param.du, plan, cellTops),
		);
	}
	return candidates;
}

/**
 * Every `(u, v)` in the cell that maps to `point`. `cross(p - F(u), E(u)) = 0`
 * is quadratic in `u`; a root is kept when the clamped parameter maps back to
 * within the membership tolerance of the point. `dp` is the point's own plan
 * error in the underside, `along` any further error of its position, which
 * moves the station through the inverse Jacobian.
 */
function inverseCell(
	frame: CellFrame,
	point: LayoutVec2,
	dp: number,
	along: number,
	context: Context,
): Param[] {
	const { cell } = frame;
	const w: LayoutVec2 = [point[0] - cell.fa[0], point[1] - cell.fa[1]];
	const a2 = -cross(frame.dF, frame.dE);
	const a1 = cross(w, frame.dE) - cross(frame.dF, frame.ea);
	const a0 = cross(w, frame.ea);
	const found: Param[] = [];
	for (const root of quadraticRoots(a2, a1, a0)) {
		if (root < -1e-6 || root > 1 + 1e-6) continue;
		const u = clamp01(root);
		const e: LayoutVec2 = [frame.ea[0] + u * frame.dE[0], frame.ea[1] + u * frame.dE[1]];
		const f: LayoutVec2 = [cell.fa[0] + u * frame.dF[0], cell.fa[1] + u * frame.dF[1]];
		const squared = e[0] * e[0] + e[1] * e[1];
		if (!(squared > 0)) continue;
		const v = clamp01(((point[0] - f[0]) * e[0] + (point[1] - f[1]) * e[1]) / squared);
		const mapped = cellPoint(frame, u, v);
		const residual = Math.hypot(mapped[0] - point[0], mapped[1] - point[1]);
		if (residual > context.tolerance) continue;
		const du = stationError(frame, u, v, context.base + along + residual);
		found.push({ u, v, dp, du, point });
	}
	return found;
}

/**
 * Stationary points of D along the preimage of one footprint edge, one ridge
 * side at a time; each is kept only on its own side and on the edge itself.
 */
function stationaryOnEdge(context: Context, frame: CellFrame, edge: Segment): Param[] {
	const direction: LayoutVec2 = [edge.b[0] - edge.a[0], edge.b[1] - edge.a[1]];
	const length = Math.hypot(direction[0], direction[1]);
	if (!(length > 0)) return [];
	const n: LayoutVec2 = [-direction[1] / length, direction[0] / length];
	const offset = dot(n, edge.a);
	const { cell, dF, ea, dE } = frame;
	const n0 = offset - dot(n, cell.fa);
	const n1 = -dot(n, dF);
	const m0 = dot(n, ea);
	const m1 = dot(n, dE);
	const t1 = cell.topB - cell.topA;
	const found: Param[] = [];
	for (const side of context.sides) {
		const g0 = dot(side.gradient, ea);
		const g1 = dot(side.gradient, dE);
		const k0 = n0 * g0;
		const k1 = n0 * g1 + n1 * g0;
		const k2 = n1 * g1;
		const c1 = dot(side.gradient, dF) - t1;
		const w = c1 * m1 + k2;
		for (const u of quadraticRoots(m1 * w, 2 * m0 * w, c1 * m0 * m0 + k1 * m0 - k0 * m1)) {
			if (!(u >= 0 && u <= 1)) continue;
			const m = m0 + m1 * u;
			if (Math.abs(m) <= 1e-12) continue;
			const v = (n0 + n1 * u) / m;
			if (!(v >= 0 && v <= 1)) continue;
			const point = cellPoint(frame, u, v);
			const t = dot([point[0] - edge.a[0], point[1] - edge.a[1]], direction) / (length * length);
			if (t < 0 || t > 1) continue;
			if (!onSide(context, point, side)) continue;
			found.push({ u, v, dp: context.base, du: stationError(frame, u, v, context.base) });
		}
	}
	return found;
}

// --- patches ---------------------------------------------------------------

function patchCandidates(context: Context, patch: WallStripPatch): Candidate[] {
	const polygon = patch.polygon;
	const box = boundsOf(polygon, context.tolerance);
	if (!boxesOverlap(box, context.bounds)) return [];
	const { base } = context;
	const points: Array<{ point: LayoutVec2; dp: number }> = polygon.map((point) => ({
		point,
		dp: base,
	}));
	const sides: Segment[] = polygon.map((a, index) => ({
		a,
		b: polygon[(index + 1) % polygon.length]!,
	}));
	for (const vertex of context.footprint) {
		if (pointInBox(vertex, box) && convexContains(polygon, vertex, context.tolerance))
			points.push({ point: vertex, dp: base });
	}
	for (const side of sides) {
		for (const edge of context.edges) {
			const crossing = segmentCrossing(side, edge, base, context.tolerance);
			if (crossing !== null)
				points.push({ point: lerp(side.a, side.b, crossing.t), dp: crossing.along + base });
		}
		if (context.ridge !== null) {
			const crossing = lineCrossing(side, context.ridge, base);
			if (crossing !== null) points.push({ point: lerp(side.a, side.b, crossing.t), dp: 3 * base });
		}
	}
	if (context.ridge !== null) {
		for (const edge of context.edges) {
			const crossing = lineCrossing(edge, context.ridge, base);
			if (crossing === null) continue;
			const point = lerp(edge.a, edge.b, crossing.t);
			if (convexContains(polygon, point, context.tolerance)) points.push({ point, dp: 3 * base });
		}
	}
	return points
		.filter(({ point }) => footprintContains(context, point))
		.map(({ point, dp }) => evaluate(context, point, patch.topY, context.slope * dp));
}

// --- shared evaluation -----------------------------------------------------

/**
 * The reading at `point` and its certain interval. `error` bounds the reading,
 * `planError` the underside alone; a cell top lies within `tops` at any station,
 * so an unknowable station (beside a collapsed mitre face) stays bounded.
 */
function evaluate(
	context: Context,
	point: LayoutVec2,
	wallTopY: number,
	error: number,
	planError = error,
	tops: readonly [number, number] = [wallTopY, wallTopY],
): Candidate {
	const undersideY = regionUndersideAt(context.facts, point);
	const clearance = undersideY - wallTopY;
	const reading = error + context.roundY;
	const underside = planError + context.roundY;
	return {
		point,
		undersideY,
		wallTopY,
		clearance,
		low: Math.max(clearance - reading, undersideY - tops[1] - underside),
		high: Math.min(clearance + reading, undersideY - tops[0] + underside),
	};
}

function footprintContains(context: Context, point: LayoutVec2): boolean {
	return (
		pointStrictlyInsidePolygon(context.footprint, point) ||
		pointNearBoundary(context.footprint, point, context.tolerance)
	);
}

function onSide(context: Context, point: LayoutVec2, side: Side): boolean {
	if (side.sign === 0) return true;
	const q = dot(context.azimuth, point) - context.qRidge;
	return side.sign < 0 ? q <= context.tolerance : q >= -context.tolerance;
}

function convexContains(polygon: readonly LayoutVec2[], point: LayoutVec2, tolerance: number) {
	return pointStrictlyInsidePolygon(polygon, point) || pointNearBoundary(polygon, point, tolerance);
}
