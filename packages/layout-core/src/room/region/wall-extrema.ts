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
 * the shared `regionUndersideAt` evaluator. Floating-point evaluation error is
 * bounded by {@link REGION_WALL_EXTREMA_TOLERANCE_METERS}; a non-finite value or
 * a folded cell, where the strip is not a valid body, refuses certification.
 */
import type { LayoutVec2 } from '../../geometry/coordinates';
import { pointStrictlyInsidePolygon } from '../../geometry/face-extraction';
import { LAYOUT_GEOMETRY_EPSILON } from '../../geometry/openings';
import { pointNearBoundary } from '../region-wall-coverage';
import { regionFormProfile, regionUndersideAt, type RegionFormFacts } from './form';
import type { CompiledRegion } from '../../geometry/types';
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
 * Absolute bound, in metres, on the floating-point error of a certified extremum
 * for coordinates within the 1000 m Layout envelope. It is three orders below
 * the 1e-6 m relation tolerance every reading and fit compares against.
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

type Line = { readonly normal: LayoutVec2; readonly offset: number };
type Segment = { readonly a: LayoutVec2; readonly b: LayoutVec2 };
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
	readonly bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
};

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
	const context = extremaContext(facts, membership);
	if (context === null) {
		return { kind: 'uncertified', message: `Region form cannot be read over Wall '${wallId}'.` };
	}
	let contact: RegionWallVerticalPoint | null = null;
	let gap: RegionWallVerticalPoint | null = null;
	for (const piece of pieces) {
		const candidates =
			piece.kind === 'cell' ? cellCandidates(context, piece) : patchCandidates(context, piece);
		if (candidates === null) {
			return {
				kind: 'uncertified',
				message: `Wall '${wallId}' has a folded strip cell, so its clearance under the roof cannot be certified.`,
			};
		}
		for (const candidate of candidates) {
			if (
				!Number.isFinite(candidate.clearance) ||
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
		}
	}
	if (contact === null || gap === null) return { kind: 'uncovered' };
	return { kind: 'certified', contact, gap, overrun: -contact.clearance - facts.thickness };
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

function extremaContext(facts: RegionFormFacts, membership: number): Context | null {
	const footprint = facts.footprint;
	if (footprint.length < 3 || facts.form.kind === 'flat') return null;
	const profile = regionFormProfile(facts.form, footprint);
	if (profile === null) return null;
	const d: [number, number] = [Math.cos(profile.azimuth), Math.sin(profile.azimuth)];
	const rise = facts.form.rise;
	const sides: Side[] =
		facts.form.kind === 'shed'
			? [
					{
						gradient: [(rise / profile.runBelow) * d[0], (rise / profile.runBelow) * d[1]],
						sign: 0,
					},
				]
			: [
					{
						gradient: [(rise / profile.runBelow) * d[0], (rise / profile.runBelow) * d[1]],
						sign: -1,
					},
					{
						gradient: [(-rise / profile.runAbove) * d[0], (-rise / profile.runAbove) * d[1]],
						sign: 1,
					},
				];
	const edges: Segment[] = footprint.map((a, index) => ({
		a,
		b: footprint[(index + 1) % footprint.length]!,
	}));
	let minX = Infinity;
	let maxX = -Infinity;
	let minZ = Infinity;
	let maxZ = -Infinity;
	for (const [x, z] of footprint) {
		minX = Math.min(minX, x);
		maxX = Math.max(maxX, x);
		minZ = Math.min(minZ, z);
		maxZ = Math.max(maxZ, z);
	}
	return {
		facts,
		footprint,
		edges,
		ridge: facts.form.kind === 'gable' ? { normal: d, offset: profile.qRidge } : null,
		sides,
		azimuth: d,
		qRidge: profile.qRidge,
		tolerance: membership,
		bounds: {
			minX: minX - membership,
			maxX: maxX + membership,
			minZ: minZ - membership,
			maxZ: maxZ + membership,
		},
	};
}

// --- cells -----------------------------------------------------------------

type CellFrame = {
	readonly cell: WallStripCell;
	readonly dF: LayoutVec2;
	readonly ea: LayoutVec2;
	readonly dE: LayoutVec2;
};

function cellFrame(cell: WallStripCell): CellFrame {
	const ea: LayoutVec2 = [cell.ba[0] - cell.fa[0], cell.ba[1] - cell.fa[1]];
	const eb: LayoutVec2 = [cell.bb[0] - cell.fb[0], cell.bb[1] - cell.fb[1]];
	return {
		cell,
		dF: [cell.fb[0] - cell.fa[0], cell.fb[1] - cell.fa[1]],
		ea,
		dE: [eb[0] - ea[0], eb[1] - ea[1]],
	};
}

function cellPoint(frame: CellFrame, u: number, v: number): LayoutVec2 {
	const { cell, dF, ea, dE } = frame;
	return [
		cell.fa[0] + u * dF[0] + v * (ea[0] + u * dE[0]),
		cell.fa[1] + u * dF[1] + v * (ea[1] + u * dE[1]),
	];
}

/**
 * The Jacobian `cross(∂X/∂u, ∂X/∂v)` is affine in `(u, v)` (its `uv` term is
 * `cross(dE, dE) = 0`), so one strict sign at the four corners is one sign
 * over the whole cell: the cell is an injective, unfolded quad.
 */
function cellUnfolded(frame: CellFrame): boolean {
	let sign = 0;
	for (const [u, v] of [
		[0, 0],
		[1, 0],
		[0, 1],
		[1, 1],
	] as const) {
		const xu: LayoutVec2 = [frame.dF[0] + v * frame.dE[0], frame.dF[1] + v * frame.dE[1]];
		const xv: LayoutVec2 = [frame.ea[0] + u * frame.dE[0], frame.ea[1] + u * frame.dE[1]];
		const jacobian = cross(xu, xv);
		const current = jacobian > 0 ? 1 : jacobian < 0 ? -1 : 0;
		// A face collapsed to one point (a cross-section ending at a mitre
		// corner) makes the cell a triangle: its Jacobian vanishes only at that
		// corner, and the map stays one-to-one everywhere else.
		if (current === 0 && Math.hypot(xu[0], xu[1]) <= LAYOUT_GEOMETRY_EPSILON) continue;
		if (current === 0 || (sign !== 0 && current !== sign)) return false;
		sign = current;
	}
	return sign !== 0;
}

function cellCandidates(context: Context, cell: WallStripCell): RegionWallVerticalPoint[] | null {
	const frame = cellFrame(cell);
	const corners = [cell.fa, cell.fb, cell.bb, cell.ba];
	const box = boundsOf(corners, context.tolerance);
	if (!boxesOverlap(box, context.bounds)) return [];
	if (!cellUnfolded(frame)) return null;
	const params: Array<readonly [number, number]> = [
		[0, 0],
		[1, 0],
		[1, 1],
		[0, 1],
	];
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
		if (pointInBox(vertex, box)) params.push(...inverseCell(frame, vertex, context.tolerance));
	}
	for (const { segment, at } of cellEdges) {
		for (const edge of nearEdges) {
			const t = segmentCrossing(segment, edge);
			if (t !== null) params.push(at(t));
		}
		if (context.ridge !== null) {
			const t = lineCrossing(segment, context.ridge);
			if (t !== null) params.push(at(t));
		}
	}
	if (context.ridge !== null) {
		for (const edge of nearEdges) {
			const t = lineCrossing(edge, context.ridge);
			if (t === null) continue;
			const point = lerp(edge.a, edge.b, t);
			if (pointInBox(point, box)) params.push(...inverseCell(frame, point, context.tolerance));
		}
	}
	for (const edge of nearEdges) params.push(...stationaryOnEdge(context, frame, edge));
	const candidates: RegionWallVerticalPoint[] = [];
	for (const [u, v] of params) {
		const point = cellPoint(frame, u, v);
		if (!footprintContains(context, point)) continue;
		candidates.push(evaluate(context, point, cell.topA + (cell.topB - cell.topA) * u));
	}
	return candidates;
}

/**
 * Every `(u, v)` in the cell that maps to `point`. `cross(p - F(u), E(u)) = 0`
 * is quadratic in `u`; a root is kept when the clamped parameter maps back to
 * within `tolerance` of the point.
 */
function inverseCell(
	frame: CellFrame,
	point: LayoutVec2,
	tolerance: number,
): Array<readonly [number, number]> {
	const w: LayoutVec2 = [point[0] - frame.cell.fa[0], point[1] - frame.cell.fa[1]];
	const a2 = -cross(frame.dF, frame.dE);
	const a1 = cross(w, frame.dE) - cross(frame.dF, frame.ea);
	const a0 = cross(w, frame.ea);
	const found: Array<readonly [number, number]> = [];
	for (const root of quadraticRoots(a2, a1, a0)) {
		if (root < -1e-6 || root > 1 + 1e-6) continue;
		const u = clamp01(root);
		const e: LayoutVec2 = [frame.ea[0] + u * frame.dE[0], frame.ea[1] + u * frame.dE[1]];
		const f: LayoutVec2 = [frame.cell.fa[0] + u * frame.dF[0], frame.cell.fa[1] + u * frame.dF[1]];
		const squared = e[0] * e[0] + e[1] * e[1];
		if (!(squared > 0)) continue;
		const v = clamp01(((point[0] - f[0]) * e[0] + (point[1] - f[1]) * e[1]) / squared);
		const mapped = cellPoint(frame, u, v);
		if (Math.hypot(mapped[0] - point[0], mapped[1] - point[1]) <= tolerance) found.push([u, v]);
	}
	return found;
}

/**
 * Stationary points of D along the preimage of one footprint edge, one ridge
 * side at a time; each is kept only on its own side and on the edge itself.
 */
function stationaryOnEdge(
	context: Context,
	frame: CellFrame,
	edge: Segment,
): Array<readonly [number, number]> {
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
	const found: Array<readonly [number, number]> = [];
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
			found.push([u, v]);
		}
	}
	return found;
}

// --- patches ---------------------------------------------------------------

function patchCandidates(context: Context, patch: WallStripPatch): RegionWallVerticalPoint[] {
	const polygon = patch.polygon;
	const box = boundsOf(polygon, context.tolerance);
	if (!boxesOverlap(box, context.bounds)) return [];
	const points: LayoutVec2[] = [...polygon];
	const sides: Segment[] = polygon.map((a, index) => ({
		a,
		b: polygon[(index + 1) % polygon.length]!,
	}));
	for (const vertex of context.footprint) {
		if (pointInBox(vertex, box) && convexContains(polygon, vertex, context.tolerance))
			points.push(vertex);
	}
	for (const side of sides) {
		for (const edge of context.edges) {
			const t = segmentCrossing(side, edge);
			if (t !== null) points.push(lerp(side.a, side.b, t));
		}
		if (context.ridge !== null) {
			const t = lineCrossing(side, context.ridge);
			if (t !== null) points.push(lerp(side.a, side.b, t));
		}
	}
	if (context.ridge !== null) {
		for (const edge of context.edges) {
			const t = lineCrossing(edge, context.ridge);
			if (t === null) continue;
			const point = lerp(edge.a, edge.b, t);
			if (convexContains(polygon, point, context.tolerance)) points.push(point);
		}
	}
	return points
		.filter((point) => footprintContains(context, point))
		.map((point) => evaluate(context, point, patch.topY));
}

// --- shared geometry -------------------------------------------------------

function evaluate(context: Context, point: LayoutVec2, wallTopY: number): RegionWallVerticalPoint {
	const undersideY = regionUndersideAt(context.facts, point);
	return { point, undersideY, wallTopY, clearance: undersideY - wallTopY };
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

/** Parameter on `segment` where it meets `other`, or `null` when they miss. */
function segmentCrossing(segment: Segment, other: Segment): number | null {
	const r: LayoutVec2 = [segment.b[0] - segment.a[0], segment.b[1] - segment.a[1]];
	const s: LayoutVec2 = [other.b[0] - other.a[0], other.b[1] - other.a[1]];
	const denominator = cross(r, s);
	if (Math.abs(denominator) <= 1e-15 * (Math.hypot(...r) * Math.hypot(...s) || 1)) return null;
	const difference: LayoutVec2 = [other.a[0] - segment.a[0], other.a[1] - segment.a[1]];
	const t = cross(difference, s) / denominator;
	const u = cross(difference, r) / denominator;
	if (t < 0 || t > 1 || u < 0 || u > 1) return null;
	return t;
}

/** Parameter on `segment` where it meets the infinite `line`, or `null`. */
function lineCrossing(segment: Segment, line: Line): number | null {
	const da = dot(line.normal, segment.a) - line.offset;
	const db = dot(line.normal, segment.b) - line.offset;
	if (da === db) return null;
	const t = da / (da - db);
	return t >= 0 && t <= 1 ? t : null;
}

/**
 * Real roots of `a x² + b x + c = 0` in a cancellation-safe form. A leading
 * coefficient negligible against the others degrades to the linear root; an
 * identically zero polynomial has no isolated stationary point.
 */
function quadraticRoots(a: number, b: number, c: number): number[] {
	const scale = Math.max(Math.abs(a), Math.abs(b), Math.abs(c));
	if (!(scale > 0)) return [];
	if (Math.abs(a) <= 1e-14 * scale) return Math.abs(b) > 0 ? [-c / b] : [];
	const discriminant = b * b - 4 * a * c;
	if (discriminant < 0) {
		if (discriminant >= -1e-14 * b * b) return [-b / (2 * a)];
		return [];
	}
	const root = Math.sqrt(discriminant);
	const q = -0.5 * (b + (b >= 0 ? root : -root));
	const roots = [q / a];
	if (q !== 0) roots.push(c / q);
	return roots;
}

function boundsOf(points: readonly LayoutVec2[], pad: number) {
	let minX = Infinity;
	let maxX = -Infinity;
	let minZ = Infinity;
	let maxZ = -Infinity;
	for (const [x, z] of points) {
		minX = Math.min(minX, x);
		maxX = Math.max(maxX, x);
		minZ = Math.min(minZ, z);
		maxZ = Math.max(maxZ, z);
	}
	return { minX: minX - pad, maxX: maxX + pad, minZ: minZ - pad, maxZ: maxZ + pad };
}

type Box = ReturnType<typeof boundsOf>;

function boxesOverlap(left: Box, right: Box): boolean {
	return (
		left.minX <= right.maxX &&
		right.minX <= left.maxX &&
		left.minZ <= right.maxZ &&
		right.minZ <= left.maxZ
	);
}

function pointInBox(point: LayoutVec2, box: Box): boolean {
	return (
		point[0] >= box.minX && point[0] <= box.maxX && point[1] >= box.minZ && point[1] <= box.maxZ
	);
}

function lerp(a: LayoutVec2, b: LayoutVec2, t: number): LayoutVec2 {
	return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

function clamp01(value: number): number {
	return value < 0 ? 0 : value > 1 ? 1 : value;
}

function dot(left: LayoutVec2 | readonly [number, number], right: LayoutVec2): number {
	return left[0] * right[0] + left[1] * right[1];
}

function cross(left: LayoutVec2, right: LayoutVec2): number {
	return left[0] * right[1] - left[1] * right[0];
}
