import type { LayoutVec2 } from '../coordinates';
import { orientXZ } from '../robust-orientation';
import { createDynamicBvh } from '../../world/bvh';
import type { PlanBox } from '../../world/plan-box-index';
import type { DerivedCandidateFace, TopologyDiagnostic } from './contracts';
import { ON_RING_TOLERANCE } from './contracts';

/** Signed area of a simple polygon (Museum X/Z convention). */
export function polygonSignedArea(polygon: readonly LayoutVec2[]): number {
	if (polygon.length < 3) return 0;
	const origin = polygon[0]!;
	const shift = Math.abs(origin[0]) > 1e6 || Math.abs(origin[1]) > 1e6;
	const ox = shift ? origin[0] : 0;
	const oz = shift ? origin[1] : 0;
	let sum = 0;
	for (let index = 0; index < polygon.length; index += 1) {
		const current = polygon[index]!;
		const next = polygon[(index + 1) % polygon.length]!;
		sum += (current[0] - ox) * (next[1] - oz) - (next[0] - ox) * (current[1] - oz);
	}
	return sum / 2;
}

/**
 * Deterministic nesting detection: a bounded face whose polygon
 * is strictly inside another bounded face is a nested loop diagnostic; one
 * touching the outer face's boundary is reported as a touching nested loop.
 * No hole/Room semantics are synthesized in the P23 minimum.
 */
function polygonPlanBox(polygon: readonly LayoutVec2[]): PlanBox {
	let minX = Infinity;
	let minZ = Infinity;
	let maxX = -Infinity;
	let maxZ = -Infinity;
	for (let i = 0; i < polygon.length; i += 1) {
		const pt = polygon[i]!;
		if (pt[0] < minX) minX = pt[0];
		if (pt[1] < minZ) minZ = pt[1];
		if (pt[0] > maxX) maxX = pt[0];
		if (pt[1] > maxZ) maxZ = pt[1];
	}
	return { minX, minZ, maxX, maxZ };
}

export function reportNestedLoops(
	faces: readonly DerivedCandidateFace[],
	diagnostics: TopologyDiagnostic[],
): void {
	if (faces.length <= 1) return;
	const witnessBoxes: PlanBox[] = faces.map((face) => {
		const witness = face.polygon[0];
		if (!witness) return { minX: Infinity, minZ: Infinity, maxX: -Infinity, maxZ: -Infinity };
		return { minX: witness[0], minZ: witness[1], maxX: witness[0], maxZ: witness[1] };
	});
	const witnessBvh = createDynamicBvh(witnessBoxes);
	for (let outerIndex = 0; outerIndex < faces.length; outerIndex += 1) {
		const outer = faces[outerIndex]!;
		const outerBox = polygonPlanBox(outer.polygon);
		const candidates = witnessBvh.overlaps(outerBox, { countVisits: false });
		for (let i = 0; i < candidates.length; i += 1) {
			const innerIndex = candidates[i]!;
			if (outerIndex === innerIndex) continue;
			const inner = faces[innerIndex]!;
			if (outer.signedArea <= inner.signedArea) continue;
			const witness = inner.polygon[0];
			if (!witness) continue;
			if (pointStrictlyInsidePolygon(outer.polygon, witness)) {
				diagnostics.push({
					code: 'nested_boundary_loop',
					message: `Face '${inner.key}' lies inside face '${outer.key}'`,
					faceKey: inner.key,
				});
			} else if (pointOnPolygonBoundary(outer.polygon, witness)) {
				diagnostics.push({
					code: 'touching_nested_loop',
					message: `Face '${inner.key}' touches the boundary of face '${outer.key}'`,
					faceKey: inner.key,
				});
			}
		}
	}
}

/** Point lies exactly on the polygon's boundary ring (robust collinearity). */
function pointOnPolygonBoundary(polygon: readonly LayoutVec2[], point: LayoutVec2): boolean {
	for (let index = 0; index < polygon.length; index += 1) {
		const a = polygon[index]!;
		const b = polygon[(index + 1) % polygon.length]!;
		if (orientXZ(a, b, point) !== 0) continue;
		if (
			point[0] >= Math.min(a[0], b[0]) &&
			point[0] <= Math.max(a[0], b[0]) &&
			point[1] >= Math.min(a[1], b[1]) &&
			point[1] <= Math.max(a[1], b[1])
		) {
			return true;
		}
	}
	return false;
}

export function pointStrictlyInsidePolygon(
	polygon: readonly LayoutVec2[],
	point: LayoutVec2,
): boolean {
	let inside = false;
	for (let index = 0; index < polygon.length; index += 1) {
		const a = polygon[index]!;
		const b = polygon[(index + 1) % polygon.length]!;
		const intersects =
			a[1] > point[1] !== b[1] > point[1] &&
			point[0] < ((b[0] - a[0]) * (point[1] - a[1])) / (b[1] - a[1]) + a[0];
		if (intersects) inside = !inside;
	}
	return inside;
}

/**
 * Find a deterministic point in the strict interior of a simple polygon.
 *
 * A bounding-box lattice is not suitable evidence here: a valid narrow arm can
 * fall between every lattice line. Ear clipping gives us actual triangles of
 * the polygon instead. The centroid of every non-degenerate ear is strictly
 * inside the original ring; choosing the deepest one also keeps it away from
 * the ring tolerance used by the adjacency predicate.
 */
function polygonInteriorPoint(polygon: readonly LayoutVec2[]): LayoutVec2 | null {
	if (polygon.length < 3) return null;
	const signedArea = polygonSignedArea(polygon);
	if (signedArea === 0 || !Number.isFinite(signedArea)) return null;

	const winding = signedArea > 0 ? 1 : -1;
	const remaining = polygon.map((_, index) => index);
	const candidates: LayoutVec2[] = [];
	const addCandidate = (previous: number, current: number, next: number): void => {
		const a = polygon[previous]!;
		const b = polygon[current]!;
		const c = polygon[next]!;
		const candidate: LayoutVec2 = [(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3];
		if (pointStrictlyInsidePolygon(polygon, candidate)) candidates.push(candidate);
	};

	while (remaining.length > 3) {
		let earPosition = -1;
		for (let position = 0; position < remaining.length; position += 1) {
			const previous = remaining[(position - 1 + remaining.length) % remaining.length]!;
			const current = remaining[position]!;
			const next = remaining[(position + 1) % remaining.length]!;
			const a = polygon[previous]!;
			const b = polygon[current]!;
			const c = polygon[next]!;
			// A convex vertex in the polygon's winding is an ear candidate.
			if (winding * orientXZ(a, b, c) <= 0) continue;
			// No other active vertex may lie strictly inside the ear triangle.
			if (
				remaining.some(
					(index) =>
						index !== previous &&
						index !== current &&
						index !== next &&
						pointStrictlyInsideTriangle(polygon[index]!, a, b, c),
				)
			)
				continue;
			addCandidate(previous, current, next);
			earPosition = position;
			break;
		}
		// A malformed/self-intersecting ring may have no ear. Do not invent
		// evidence for it; the normal topology validation will reject/diagnose it.
		if (earPosition === -1) break;
		remaining.splice(earPosition, 1);
	}
	if (remaining.length === 3) {
		addCandidate(remaining[0]!, remaining[1]!, remaining[2]!);
	}
	if (candidates.length === 0) return null;

	let deepest = candidates[0]!;
	let deepestDistance = distanceToPolygonRing(polygon, deepest);
	for (const candidate of candidates.slice(1)) {
		const distance = distanceToPolygonRing(polygon, candidate);
		if (distance > deepestDistance) {
			deepest = candidate;
			deepestDistance = distance;
		}
	}
	return deepest;
}

function pointStrictlyInsideTriangle(
	point: LayoutVec2,
	a: LayoutVec2,
	b: LayoutVec2,
	c: LayoutVec2,
): boolean {
	const first = orientXZ(a, b, point);
	const second = orientXZ(b, c, point);
	const third = orientXZ(c, a, point);
	return (first > 0 && second > 0 && third > 0) || (first < 0 && second < 0 && third < 0);
}

function distanceToPolygonRing(polygon: readonly LayoutVec2[], point: LayoutVec2): number {
	let best = Infinity;
	for (let index = 0; index < polygon.length; index += 1) {
		const start = polygon[index]!;
		const end = polygon[(index + 1) % polygon.length]!;
		const dx = end[0] - start[0];
		const dz = end[1] - start[1];
		const lengthSquared = dx * dx + dz * dz;
		const t =
			lengthSquared === 0
				? 0
				: Math.max(
						0,
						Math.min(1, ((point[0] - start[0]) * dx + (point[1] - start[1]) * dz) / lengthSquared),
					);
		const offsetX = point[0] - (start[0] + dx * t);
		const offsetZ = point[1] - (start[1] + dz * t);
		best = Math.min(best, Math.hypot(offsetX, offsetZ));
	}
	return best;
}

/** Polygon area of a candidate face (exposed for reconciliation overlap math). */
export function faceArea(face: { polygon: readonly LayoutVec2[] }): number {
	return Math.abs(polygonSignedArea(face.polygon));
}

/** Area of the overlap between the face polygons of a predecessor region and a candidate. */
export function polygonIntersectionArea(
	a: readonly LayoutVec2[],
	b: readonly LayoutVec2[],
): number {
	// Exact polygon clipping is out of scope for the P23 minimum; H5 uses
	// overlap only as secondary evidence between classified candidates, where
	// a sampling-based measure on a shared grid is deterministic and adequate
	// for ranking. Use a lattice over the bounding box of the intersection.
	const minX = Math.max(Math.min(...a.map((p) => p[0])), Math.min(...b.map((p) => p[0])));
	const maxX = Math.min(Math.max(...a.map((p) => p[0])), Math.max(...b.map((p) => p[0])));
	const minY = Math.max(Math.min(...a.map((p) => p[1])), Math.min(...b.map((p) => p[1])));
	const maxY = Math.min(Math.max(...a.map((p) => p[1])), Math.max(...b.map((p) => p[1])));
	if (!(maxX > minX) || !(maxY > minY)) return 0;
	const steps = 64;
	const dx = (maxX - minX) / steps;
	const dy = (maxY - minY) / steps;
	let hits = 0;
	for (let ix = 0; ix < steps; ix += 1) {
		for (let iy = 0; iy < steps; iy += 1) {
			const px = minX + (ix + 0.5) * dx;
			const py = minY + (iy + 0.5) * dy;
			if (pointStrictlyInsidePolygon(a, [px, py]) && pointStrictlyInsidePolygon(b, [px, py])) {
				hits += 1;
			}
		}
	}
	return hits * dx * dy;
}

/**
 * Do two simple polygons share interior area?
 *
 * Adjacency-aware and tolerance-robust: polygons that merely touch along an
 * edge or at a vertex do **not** overlap. This is the correctness predicate for
 * Room correspondence evidence — two Rooms separated by a Wall are adjacent,
 * never overlapping.
 *
 * `polygonIntersectionArea` above cannot answer that question: it counts
 * lattice samples that land on a shared **oblique** edge as inside both
 * polygons, so every pair of Rooms divided by an angled Wall reported a
 * phantom sliver of overlap and their correspondence components fused into one
 * (rejected as `Unsupported correspondence component N→N`). Axis-aligned
 * neighbours happened to produce a degenerate intersection box and returned
 * zero, which is why only angled plans broke.
 */
export function polygonsShareInteriorArea(
	a: readonly LayoutVec2[],
	b: readonly LayoutVec2[],
): boolean {
	// `pointOnPolygonBoundary` is exact-collinearity (`orientXZ === 0`). Points
	// sampled along a shared **oblique** ring evaluate a hair off zero
	// (measured ~1e-16 on a reproduced plan), which is exactly how the sampled
	// `polygonIntersectionArea` came to count them as interior to both Rooms.
	// Tolerance, not exact equality, is what makes "on the ring" decidable.
	const withinRing = (polygon: readonly LayoutVec2[], point: LayoutVec2): boolean => {
		for (let index = 0; index < polygon.length; index += 1) {
			const start = polygon[index]!;
			const end = polygon[(index + 1) % polygon.length]!;
			const dx = end[0] - start[0];
			const dz = end[1] - start[1];
			const lengthSquared = dx * dx + dz * dz;
			const t =
				lengthSquared === 0
					? 0
					: Math.max(
							0,
							Math.min(
								1,
								((point[0] - start[0]) * dx + (point[1] - start[1]) * dz) / lengthSquared,
							),
						);
			const offsetX = point[0] - (start[0] + dx * t);
			const offsetZ = point[1] - (start[1] + dz * t);
			if (offsetX * offsetX + offsetZ * offsetZ <= ON_RING_TOLERANCE * ON_RING_TOLERANCE) {
				return true;
			}
		}
		return false;
	};
	const strictlyInside = (polygon: readonly LayoutVec2[], point: LayoutVec2): boolean =>
		pointStrictlyInsidePolygon(polygon, point) && !withinRing(polygon, point);
	const pointNearSegment = (point: LayoutVec2, start: LayoutVec2, end: LayoutVec2): boolean => {
		const dx = end[0] - start[0];
		const dz = end[1] - start[1];
		const lengthSquared = dx * dx + dz * dz;
		const t =
			lengthSquared === 0
				? 0
				: Math.max(
						0,
						Math.min(1, ((point[0] - start[0]) * dx + (point[1] - start[1]) * dz) / lengthSquared),
					);
		const offsetX = point[0] - (start[0] + dx * t);
		const offsetZ = point[1] - (start[1] + dz * t);
		return offsetX * offsetX + offsetZ * offsetZ <= ON_RING_TOLERANCE * ON_RING_TOLERANCE;
	};
	// Vertices *and* interior points of each edge. Vertices alone miss the
	// common case where one polygon's edge lies strictly inside the other
	// (a Room subdivided by a divider: the child's corners sit on the parent's
	// ring, yet the two polygons genuinely share area). Points on the other
	// polygon's ring are excluded by `withinRing`, so shared Walls — axis-aligned
	// or oblique — never count as overlap.
	const probes = (polygon: readonly LayoutVec2[]): LayoutVec2[] => {
		const points: LayoutVec2[] = [];
		for (let index = 0; index < polygon.length; index += 1) {
			const start = polygon[index]!;
			const end = polygon[(index + 1) % polygon.length]!;
			points.push(start);
			for (const t of [0.25, 0.5, 0.75]) {
				points.push([start[0] + (end[0] - start[0]) * t, start[1] + (end[1] - start[1]) * t]);
			}
		}
		return points;
	};
	for (const point of probes(a)) {
		if (strictlyInside(b, point)) return true;
	}
	for (const point of probes(b)) {
		if (strictlyInside(a, point)) return true;
	}
	// A proper edge crossing implies shared interior area; edge *touches* do not.
	for (let index = 0; index < a.length; index += 1) {
		const aStart = a[index]!;
		const aEnd = a[(index + 1) % a.length]!;
		for (let other = 0; other < b.length; other += 1) {
			const bStart = b[other]!;
			const bEnd = b[(other + 1) % b.length]!;
			const firstSide = orientXZ(aStart, aEnd, bStart);
			const secondSide = orientXZ(aStart, aEnd, bEnd);
			if (firstSide * secondSide >= 0) continue;
			const thirdSide = orientXZ(bStart, bEnd, aStart);
			const fourthSide = orientXZ(bStart, bEnd, aEnd);
			if (thirdSide * fourthSide < 0) {
				// A split Junction projected onto an oblique predecessor edge can be
				// a few ulps off that edge. Exact orientation then describes a tiny
				// crossing at the endpoint, but it is not positive-area Room overlap.
				// Ignore only crossings anchored within the established ring tolerance;
				// ordinary proper crossings still prove shared interior area.
				if (
					pointNearSegment(aStart, bStart, bEnd) ||
					pointNearSegment(aEnd, bStart, bEnd) ||
					pointNearSegment(bStart, aStart, aEnd) ||
					pointNearSegment(bEnd, aStart, aEnd)
				) {
					continue;
				}
				return true;
			}
		}
	}
	// Identical or nested rings — every boundary probe can lie on the shared
	// ring and no edge crosses. Ear-triangle centroids provide real interior
	// evidence without assuming a grid resolution. This remains AFTER the
	// adjacency probes: two Rooms sharing only a Wall have disjoint interiors,
	// so neither polygon's interior point can be strictly inside the other.
	const interiorA = polygonInteriorPoint(a);
	if (interiorA !== null && strictlyInside(b, interiorA)) return true;
	const interiorB = polygonInteriorPoint(b);
	if (interiorB !== null && strictlyInside(a, interiorB)) return true;
	return false;
}
