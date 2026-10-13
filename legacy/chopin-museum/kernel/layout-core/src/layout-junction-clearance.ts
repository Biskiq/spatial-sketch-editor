/**
 * `layout-junction-clearance.ts` — P23.15 canonical Junction seam validation.
 *
 * Compile canonical Walls/Junctions → resolve Junction geometry → **validate the
 * resolved geometry** → `LayoutGeometryIssue` → only valid compiled geometry
 * reaches consumers. This is the P23.11 render-safe shape: canonical compiler
 * acceptance is authoritative, and the mesh builders repeat the same pure
 * predicate as defense-in-depth instead of being the first place validity is
 * discovered.
 *
 * **Production validity is analytic, not sampled.** Every predicate reads the
 * actual resolved geometry and is deterministic, convention-free (no dependence
 * on the arbitrary canonical orientation of a Wall) and axis-independent:
 *
 * ```text
 * junction_seam_degenerate  a coordinate is not finite, or a resolved band has
 *                           no vertical span (a zero-height surface); a keel
 *                           carrying no region or band is the same failure
 * junction_seam_fold        two incident legs have exactly collinear outward
 *                           rays in the same direction: their offset solids
 *                           coincide
 * junction_seam_overlap     an owned seam polygon or keel region has no area
 *                           (collapsed past its own offset line), or a keel
 *                           region is not the declared convex CCW polygon
 * junction_seam_uncovered   an incident leg was resolved to nothing: it is
 *                           neither a terminal cap, nor a corner, nor a
 *                           suppressed interface, so its end is left open
 * ```
 *
 * `uncovered` is deliberately stated over the resolution's own completeness
 * (every leg must be terminal / cornered / suppressed) rather than over a
 * sampled or inferred area partition: a Junction is a point, so a reflex sector
 * between two walls is simply outside the union, not a hole. An *unresolved*
 * leg, by contrast, always leaves a real gap.
 *
 * The throwaway raster/coverage probe from the P23.15 investigation is
 * deliberately **not** the production predicate. It lives on as a fixture oracle
 * in the test helper, precisely because it does not share this algorithm.
 *
 * A near-parallel (but not collinear) pair of legs is deliberately **not** a
 * failure: a very acute corner is legitimate architecture, and the miter limit
 * already turns an unresolvable apex into a bevel. Only the exact fold and the
 * collapsed seam polygon are blocked.
 *
 * There is no renderer, no Three.js and no document read here: the predicate is
 * a pure function of already-compiled facts.
 */
import type { LayoutVec2 } from './layout-types';
import type {
	CompiledJunction,
	CompiledJunctionLeg,
	CompiledJunctionResolution,
	CompiledLegJoin
} from './layout-geometry-types';

/** Absolute floor for "this span/area is actually zero". */
export const JUNCTION_SEAM_EPSILON = 1e-9;
/** Parallel rays closer than this `|cross|` are treated as collinear. */
export const JUNCTION_SEAM_PARALLEL_TOLERANCE = 1e-9;

export type JunctionSeamCode =
	| 'junction_seam_uncovered'
	| 'junction_seam_overlap'
	| 'junction_seam_degenerate'
	| 'junction_seam_fold';

export type JunctionSeamFailure = { code: JunctionSeamCode; message: string };

export const JUNCTION_SEAM_MESSAGES: Readonly<Record<JunctionSeamCode, string>> = {
	junction_seam_uncovered:
		'Junction seam leaves an incident Wall end unresolved: it is neither a terminal cap, nor a resolved corner, nor a suppressed interface.',
	junction_seam_overlap:
		'Junction seam geometry overlaps illegitimately: a resolved seam surface has collapsed past its own offset line, or a keel region is collapsed or not the declared convex CCW polygon.',
	junction_seam_degenerate:
		'Junction seam geometry is degenerate: a coordinate is not finite, a resolved band has no vertical span, or a keel carries no region or band.',
	junction_seam_fold:
		'Junction has two legs pointing the same direction (fold); their offset regions would coincide.'
};

export function junctionSeamFailure(code: JunctionSeamCode): JunctionSeamFailure {
	return { code, message: JUNCTION_SEAM_MESSAGES[code] };
}

type Vec2Like = readonly [number, number];

function finite2(point: Vec2Like): boolean {
	return Number.isFinite(point[0]) && Number.isFinite(point[1]);
}

/**
 * Is a resolved seam polygon collapsed past its own offset line?
 *
 * The test is **scale-free** — the polygon's area is compared against its own
 * bounding-box diagonal squared — so a legitimately near-collinear pair of Walls
 * at any thickness is not mistaken for a collapsed seam, while a seam surface
 * whose arms are exactly collinear (area zero at its own scale) is caught.
 */
function seamPolygonCollapsed(polygon: readonly Vec2Like[]): boolean {
	if (polygon.length < 3) return true;
	let minX = Infinity;
	let minY = Infinity;
	let maxX = -Infinity;
	let maxY = -Infinity;
	for (const point of polygon) {
		minX = Math.min(minX, point[0]);
		minY = Math.min(minY, point[1]);
		maxX = Math.max(maxX, point[0]);
		maxY = Math.max(maxY, point[1]);
	}
	const diagonal = Math.hypot(maxX - minX, maxY - minY);
	if (!(diagonal > 0)) return true;
	return Math.abs(doubleSignedArea(polygon)) <= JUNCTION_SEAM_EPSILON * diagonal * diagonal;
}

/**
 * Is a resolved keel region malformed — not the convex, CCW-wound polygon
 * `CompiledLegJoin['keel']` declares? Finite vertices only (the caller checks
 * those first, so `seamPolygonCollapsed` sees real coordinates).
 *
 * The test is scale-free like `seamPolygonCollapsed`, which also covers "under
 * three vertices" and "no area at its own scale"; beyond that the declared
 * shape is pinned: the winding must be CCW (a keel's top-face normal is `+Y`)
 * and no turn may be reflex. The builders fan-triangulate each region from its
 * first vertex, which is correct for exactly this shape — any other would
 * silently drop or overlap emitted material, so it must fail closed here.
 */
function keelRegionInvalid(polygon: readonly Vec2Like[]): boolean {
	if (seamPolygonCollapsed(polygon)) return true;
	if (!(doubleSignedArea(polygon) > 0)) return true;
	const count = polygon.length;
	for (let index = 0; index < count; index += 1) {
		const a = polygon[index]!;
		const b = polygon[(index + 1) % count]!;
		const c = polygon[(index + 2) % count]!;
		const ab: Vec2Like = [b[0] - a[0], b[1] - a[1]];
		const bc: Vec2Like = [c[0] - b[0], c[1] - b[1]];
		const scale = Math.hypot(ab[0], ab[1]) * Math.hypot(bc[0], bc[1]);
		// A turn is reflex if its sine falls below the (scale-free) tolerance;
		// collinear vertices are legal, so near-zero turns pass.
		if (cross(ab, bc) < -JUNCTION_SEAM_EPSILON * scale) return true;
	}
	return false;
}

function cross(a: Vec2Like, b: Vec2Like): number {
	return a[0] * b[1] - a[1] * b[0];
}

function dot(a: Vec2Like, b: Vec2Like): number {
	return a[0] * b[0] + a[1] * b[1];
}

/** Unit outward ray of a leg (from the Junction into the Wall). */
export function junctionOutwardRay(leg: CompiledJunctionLeg): LayoutVec2 {
	const length = Math.hypot(leg.tangentOut[0], leg.tangentOut[1]) || 1;
	return [leg.tangentOut[0] / length, leg.tangentOut[1] / length];
}

/** Twice the signed area of a polygon (shoelace). */
function doubleSignedArea(polygon: readonly Vec2Like[]): number {
	let total = 0;
	for (let index = 0; index < polygon.length; index += 1) {
		const a = polygon[index]!;
		const b = polygon[(index + 1) % polygon.length]!;
		total += a[0] * b[1] - b[0] * a[1];
	}
	return total;
}

/**
 * The subset of the rule a single resolved Wall end can decide. Shared verbatim
 * by the compile gate and both mesh builders, so the three can never disagree.
 */
export function joinSeamFailure(join: CompiledLegJoin): JunctionSeamFailure | undefined {
	for (const band of join.bands) {
		if (!Number.isFinite(band.bottomY) || !Number.isFinite(band.topY)) {
			return junctionSeamFailure('junction_seam_degenerate');
		}
		if (band.topY - band.bottomY <= JUNCTION_SEAM_EPSILON) {
			return junctionSeamFailure('junction_seam_degenerate');
		}
	}
	for (const point of join.endBoundary) {
		if (!finite2(point)) return junctionSeamFailure('junction_seam_degenerate');
	}
	if (join.corner) {
		for (const side of [join.corner.front, join.corner.back]) {
			if (side.kind === 'miter') {
				if (!finite2(side.apex)) return junctionSeamFailure('junction_seam_degenerate');
			} else if (!finite2(side.a0) || !finite2(side.b0)) {
				return junctionSeamFailure('junction_seam_degenerate');
			}
		}
	}
	// P23.15 — resolved Wall-attributed surfaces are emitted geometry, so they are
	// validated here too: finite, non-zero plan span, positive vertical span, and
	// owned by the Wall whose join carries them. A zero-area or unowned surface
	// would render as a degenerate sliver or as unexplained material.
	for (const surface of join.surfaces ?? []) {
		if (!finite2(surface.from) || !finite2(surface.to) || !finite2(surface.normal)) {
			return junctionSeamFailure('junction_seam_degenerate');
		}
		if (surface.ownerWallId !== join.wallId || surface.end !== join.end) {
			return junctionSeamFailure('junction_seam_uncovered');
		}
		if (Math.hypot(surface.to[0] - surface.from[0], surface.to[1] - surface.from[1]) <= JUNCTION_SEAM_EPSILON) {
			return junctionSeamFailure('junction_seam_overlap');
		}
		for (const band of surface.bands) {
			if (!Number.isFinite(band.bottomY) || !Number.isFinite(band.topY)) {
				return junctionSeamFailure('junction_seam_degenerate');
			}
			if (band.topY - band.bottomY <= JUNCTION_SEAM_EPSILON) {
				return junctionSeamFailure('junction_seam_degenerate');
			}
		}
	}
	for (const entry of join.interfaces ?? []) {
		if (!finite2(entry.normal) || !Number.isFinite(entry.fromDistance) || !Number.isFinite(entry.toDistance)) {
			return junctionSeamFailure('junction_seam_degenerate');
		}
		if (entry.toDistance - entry.fromDistance <= JUNCTION_SEAM_EPSILON) {
			return junctionSeamFailure('junction_seam_overlap');
		}
	}
	// P23.15 — a resolved sector keel is emitted physical geometry (the builders
	// extrude its regions into top/bottom faces), so it is validated like every
	// other resolved fact. The declared shape of `CompiledLegJoin['keel']` is
	// pinned here too: each region is a convex CCW plan polygon with real area,
	// each band has a real vertical span. A malformed keel must fail closed at
	// this predicate — never reach a builder whose fan triangulation would
	// silently skip it and drop the material.
	if (join.keel) {
		if (join.keel.regions.length === 0 || join.keel.bands.length === 0) {
			return junctionSeamFailure('junction_seam_degenerate');
		}
		for (const region of join.keel.regions) {
			for (const point of region) {
				if (!finite2(point)) return junctionSeamFailure('junction_seam_degenerate');
			}
			if (keelRegionInvalid(region)) return junctionSeamFailure('junction_seam_overlap');
		}
		for (const band of join.keel.bands) {
			if (!Number.isFinite(band.bottomY) || !Number.isFinite(band.topY)) {
				return junctionSeamFailure('junction_seam_degenerate');
			}
			if (band.topY - band.bottomY <= JUNCTION_SEAM_EPSILON) {
				return junctionSeamFailure('junction_seam_degenerate');
			}
		}
	}
	if (join.clipDistance !== undefined) {
		if (!Number.isFinite(join.clipDistance) || join.clipDistance < -JUNCTION_SEAM_EPSILON) {
			return junctionSeamFailure('junction_seam_degenerate');
		}
		// A clipped (trimmed) end is resolved by the Junction material it rests on,
		// so its interface must be suppressed; an open clipped end would be a hole.
		if (join.clipDistance > JUNCTION_SEAM_EPSILON && !join.interfaceSuppressed) {
			return junctionSeamFailure('junction_seam_uncovered');
		}
	}
	if (join.fold) return junctionSeamFailure('junction_seam_fold');
	if (join.ownedSeam) {
		for (const point of join.ownedSeam.polygon) {
			if (!finite2(point)) return junctionSeamFailure('junction_seam_degenerate');
		}
		if (seamPolygonCollapsed(join.ownedSeam.polygon)) return junctionSeamFailure('junction_seam_overlap');
	}
	// Every incident leg must be resolved to *something*: a terminal cap, a
// deterministic trim at the Junction plane (`terminal`/`trim`), a resolved
// corner, or a suppressed interface. A join that is none of those leaves the
// Wall end open.
	const resolved =
		join.kind === 'terminal' || join.kind === 'trim' || join.corner !== null || join.interfaceSuppressed;
	if (!resolved) return junctionSeamFailure('junction_seam_uncovered');
	return undefined;
}

/** Two plan segments are the same physical segment (either orientation). */
function sameSegment(a0: Vec2Like, a1: Vec2Like, b0: Vec2Like, b1: Vec2Like): boolean {
	const direct =
		Math.hypot(a0[0] - b0[0], a0[1] - b0[1]) <= JUNCTION_SEAM_EPSILON &&
		Math.hypot(a1[0] - b1[0], a1[1] - b1[1]) <= JUNCTION_SEAM_EPSILON;
	const reversed =
		Math.hypot(a0[0] - b1[0], a0[1] - b1[1]) <= JUNCTION_SEAM_EPSILON &&
		Math.hypot(a1[0] - b0[0], a1[1] - b0[1]) <= JUNCTION_SEAM_EPSILON;
	return direct || reversed;
}

/** Do any two band lists share a positive vertical span? */
function bandsOverlap(
	a: readonly { bottomY: number; topY: number }[],
	b: readonly { bottomY: number; topY: number }[]
): boolean {
	for (const first of a) {
		for (const second of b) {
			const lo = Math.max(first.bottomY, second.bottomY);
			const hi = Math.min(first.topY, second.topY);
			if (hi - lo > JUNCTION_SEAM_EPSILON) return true;
		}
	}
	return false;
}

export type JunctionSeamInput = {
	junctionId: string;
	point: LayoutVec2;
	legs: readonly CompiledJunctionLeg[];
	resolution: CompiledJunctionResolution;
};

/**
 * Validate one resolved Junction. Predicates run in a fixed order so the
 * reported code is deterministic: the Junction's own coordinates, then the
 * Wall-decidable join failures, then the Junction-level ray checks (a fold
 * reported by the pair of legs, then near-parallel overlap). The first failure
 * is returned.
 */
export function junctionSeamFailureOf(junction: JunctionSeamInput): JunctionSeamFailure | undefined {
	const { point, legs, resolution } = junction;
	if (!finite2(point) || legs.some((leg) => !finite2(leg.tangentOut) || !finite2(leg.normalOut) || !Number.isFinite(leg.halfThickness))) {
		return junctionSeamFailure('junction_seam_degenerate');
	}
	if (!finite2(resolution.bounds2.min) || !finite2(resolution.bounds2.max)) {
		return junctionSeamFailure('junction_seam_degenerate');
	}

	for (const join of resolution.joins) {
		const failure = joinSeamFailure(join);
		if (failure) return failure;
	}

	// Duplicate ownership: two Walls may not own the same resolved physical
	// region. Two *different* owners with coincident surface segments whose bands
	// overlap would double-paint the same surface and split ownership of the same
	// material.
	const surfaces = resolution.joins.flatMap((join) => join.surfaces ?? []);
	for (let index = 0; index < surfaces.length; index += 1) {
		for (let other = index + 1; other < surfaces.length; other += 1) {
			const a = surfaces[index]!;
			const b = surfaces[other]!;
			if (a.ownerWallId === b.ownerWallId && a.end === b.end) continue;
			if (!sameSegment(a.from, a.to, b.from, b.to)) continue;
			if (!bandsOverlap(a.bands, b.bands)) continue;
			return junctionSeamFailure('junction_seam_overlap');
		}
	}

	// Junction-level fold: two legs leaving in exactly the same direction. The
	// resolution reports this on its joins too; this is the same rule applied to
	// the raw legs, so a resolution that somehow missed it still cannot pass.
	for (let index = 0; index < legs.length; index += 1) {
		for (let other = index + 1; other < legs.length; other += 1) {
			const a = junctionOutwardRay(legs[index]!);
			const b = junctionOutwardRay(legs[other]!);
			if (dot(a, b) <= 0) continue;
			if (Math.abs(cross(a, b)) <= JUNCTION_SEAM_PARALLEL_TOLERANCE) return junctionSeamFailure('junction_seam_fold');
		}
	}
	return undefined;
}

/** Convenience wrapper over a compiled Junction record — the compile gate entry point. */
export function junctionSeamFailureOfCompiled(
	junction: Pick<CompiledJunction, 'junctionId' | 'point' | 'legs' | 'resolution'>
): JunctionSeamFailure | undefined {
	return junctionSeamFailureOf(junction);
}

/**
 * Builder-side defense-in-depth: the same rule applied to the ends one Wall was
 * given, so a renderer never becomes the first place a seam failure is
 * discovered. Identical predicate, identical codes — no second rule.
 */
export function wallEndsSeamFailure(
	ends: { start?: CompiledLegJoin | null; end?: CompiledLegJoin | null } | null | undefined
): JunctionSeamFailure | undefined {
	if (!ends) return undefined;
	for (const join of [ends.start, ends.end]) {
		if (!join) continue;
		const failure = joinSeamFailure(join);
		if (failure) return failure;
	}
	return undefined;
}
