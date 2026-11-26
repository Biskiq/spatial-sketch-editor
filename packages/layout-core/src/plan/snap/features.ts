import type { LayoutVec2 } from '../../geometry/coordinates';
import type { CompiledQuerySpan } from '../../geometry/types';
import type { TopologySegment } from '../../wall/topology';
import { classifyWallIntersection } from '../../wall/topology';
import type { SnapCandidate, SnapInputContext, SnapQueryContext } from './types';
import {
	LAYOUT_PLAN_GRID_STEP,
	LAYOUT_PLAN_SNAP_RADIUS_CSS_PX,
	SEMANTIC_RANK,
	snapOwnerKey,
} from './types';

/** Convert the fixed CSS-pixel acquisition radius to world units at this zoom. */
export function snapAcquisitionRadiusWorld(context: SnapQueryContext): number {
	const cssPx = context.snapRadiusCssPx ?? LAYOUT_PLAN_SNAP_RADIUS_CSS_PX;
	const ppm = context.pixelsPerMeter;
	if (!Number.isFinite(cssPx) || cssPx <= 0) return 0;
	if (!Number.isFinite(ppm) || ppm <= 0) return 0;
	return cssPx / ppm;
}

/** Snap one free point to the centralized grid step. */
export function snapToGridStep(point: LayoutVec2, step = LAYOUT_PLAN_GRID_STEP): LayoutVec2 {
	if (!Number.isFinite(step) || step <= 0) return [...point];
	return [Math.round(point[0] / step) * step, Math.round(point[1] / step) * step];
}

function excluded(candidate: SnapCandidate, context: SnapInputContext): boolean {
	// Exclusion is by canonical typed owner (`ownerId`), falling back to the
	// raw sourceId only for hand-built candidates that predate the field.
	if (context.excludeOwners?.has(candidate.ownerId ?? candidate.sourceId)) return true;
	if (context.excludePoints) {
		for (const point of context.excludePoints) {
			if (point[0] === candidate.point[0] && point[1] === candidate.point[1]) return true;
		}
	}
	return false;
}

function stableKey(candidate: SnapCandidate): string {
	// `ownerId` participates so identical `sourceId + point` records with
	// different qualified owners (coincident junctions from distinct walls)
	// never fall back to iteration order in the tie-break.
	return `${SEMANTIC_RANK[candidate.kind]}|${candidate.kind}|${candidate.ownerId ?? candidate.sourceId}|${candidate.sourceId}|${candidate.point[0]}|${candidate.point[1]}`;
}

/**
 * Resolve the deterministic winner among candidates:
 * semantic rank → screen distance → stable identity key.
 */
export function pickSnapWinner(
	candidates: readonly SnapCandidate[],
	context: SnapInputContext = {},
): SnapCandidate | null {
	let best: SnapCandidate | null = null;
	let bestKey = '';
	for (const candidate of candidates) {
		if (excluded(candidate, context)) continue;
		if (context.allowedKinds && !context.allowedKinds.includes(candidate.kind)) continue;
		if (!best) {
			best = candidate;
			bestKey = stableKey(candidate);
			continue;
		}
		const rankDiff = SEMANTIC_RANK[candidate.kind] - SEMANTIC_RANK[best.kind];
		const distanceDiff = candidate.distance - best.distance;
		const key = stableKey(candidate);
		if (
			rankDiff < 0 ||
			(rankDiff === 0 && (distanceDiff < 0 || (distanceDiff === 0 && key < bestKey)))
		) {
			best = candidate;
			bestKey = key;
		}
	}
	return best;
}

/**
 * Build endpoint, midpoint, and nearest-span candidates for one straight span.
 * `ownerId` is the moving-target exclusion identity — for merged wall spans
 * this is the bare `segmentId`, never the composite source identity.
 */
export function spanSnapCandidates(
	span: { id: string; start: LayoutVec2; end: LayoutVec2 },
	point: LayoutVec2,
	radius: number,
	ownerId = span.id,
	wallId = span.id,
): SnapCandidate[] {
	const candidates: SnapCandidate[] = [];
	const length = Math.hypot(span.end[0] - span.start[0], span.end[1] - span.start[1]);
	const endpoints: Array<[LayoutVec2, 'start' | 'end']> = [
		[span.start, 'start'],
		[span.end, 'end'],
	];
	for (const [candidatePoint, key] of endpoints) {
		const distance = Math.hypot(candidatePoint[0] - point[0], candidatePoint[1] - point[1]);
		if (distance <= radius) {
			candidates.push({
				point: [candidatePoint[0], candidatePoint[1]],
				kind: 'junction',
				sourceId: `${span.id}#${key}`,
				ownerId,
				distance,
			});
		}
	}
	if (length > 0) {
		const midpoint: LayoutVec2 = [
			(span.start[0] + span.end[0]) / 2,
			(span.start[1] + span.end[1]) / 2,
		];
		const distance = Math.hypot(midpoint[0] - point[0], midpoint[1] - point[1]);
		if (distance <= radius) {
			candidates.push({
				point: [midpoint[0], midpoint[1]],
				kind: 'wall-midpoint',
				sourceId: span.id,
				ownerId,
				distance,
			});
		}
	}
	const dx = span.end[0] - span.start[0];
	const dz = span.end[1] - span.start[1];
	const squared = dx * dx + dz * dz;
	const rawT =
		squared > 0 ? ((point[0] - span.start[0]) * dx + (point[1] - span.start[1]) * dz) / squared : 0;
	const amount = Math.min(1, Math.max(0, rawT));
	const projected: LayoutVec2 = [span.start[0] + dx * amount, span.start[1] + dz * amount];
	const projectedDistance = Math.hypot(projected[0] - point[0], projected[1] - point[1]);
	if (projectedDistance <= radius) {
		candidates.push({
			point: [projected[0], projected[1]],
			kind: 'wall-span',
			sourceId: span.id,
			ownerId,
			wallId,
			distance: projectedDistance,
		});
	}
	return candidates;
}

/** Opening-edge candidates: the two ends of each opening span. */
export function openingEdgeSnapCandidates(
	span: { id: string; openingId: string; start: LayoutVec2; end: LayoutVec2 },
	point: LayoutVec2,
	radius: number,
): SnapCandidate[] {
	const candidates: SnapCandidate[] = [];
	const edges: Array<[LayoutVec2, 'start' | 'end']> = [
		[span.start, 'start'],
		[span.end, 'end'],
	];
	for (const [candidatePoint, key] of edges) {
		const distance = Math.hypot(candidatePoint[0] - point[0], candidatePoint[1] - point[1]);
		if (distance <= radius) {
			candidates.push({
				point: [candidatePoint[0], candidatePoint[1]],
				kind: 'opening-edge',
				sourceId: `${span.openingId}#${key}`,
				ownerId: snapOwnerKey({ kind: 'opening', id: span.openingId }),
				distance,
			});
		}
	}
	return candidates;
}

/** Rotated-object footprint bounds edge + center candidates. */
export function objectBoundsSnapCandidates(
	footprint: readonly LayoutVec2[],
	objectId: string,
	point: LayoutVec2,
	radius: number,
): SnapCandidate[] {
	if (footprint.length === 0) return [];
	const candidates: SnapCandidate[] = [];
	const seenEdges = new Set<string>();
	for (let index = 0; index < footprint.length; index += 1) {
		const start = footprint[index]!;
		const end = footprint[(index + 1) % footprint.length]!;
		const midpoint: LayoutVec2 = [(start[0] + end[0]) / 2, (start[1] + end[1]) / 2];
		const edgePoints: Array<[LayoutVec2, string]> = [
			[start, `${index}:start`],
			[end, `${index}:end`],
			[midpoint, `${index}:mid`],
		];
		for (const [candidatePoint, key] of edgePoints) {
			const distance = Math.hypot(candidatePoint[0] - point[0], candidatePoint[1] - point[1]);
			if (distance > radius) continue;
			const dedupe = `${candidatePoint[0]}|${candidatePoint[1]}`;
			if (seenEdges.has(dedupe)) continue;
			seenEdges.add(dedupe);
			candidates.push({
				point: [candidatePoint[0], candidatePoint[1]],
				kind: 'object-bounds-edge',
				sourceId: `${objectId}#${key}`,
				ownerId: snapOwnerKey({ kind: 'object', id: objectId }),
				distance,
			});
		}
	}
	let centerX = 0;
	let centerZ = 0;
	for (const [x, z] of footprint) {
		centerX += x;
		centerZ += z;
	}
	const center: LayoutVec2 = [centerX / footprint.length, centerZ / footprint.length];
	const centerDistance = Math.hypot(center[0] - point[0], center[1] - point[1]);
	if (centerDistance <= radius) {
		candidates.push({
			point: [center[0], center[1]],
			kind: 'object-bounds-center',
			sourceId: objectId,
			ownerId: snapOwnerKey({ kind: 'object', id: objectId }),
			distance: centerDistance,
		});
	}
	return candidates;
}

/**
 * Orthogonal guide candidates relative to the active draft anchor.
 *
 * `orthogonal-x` holds the anchor's **Z** for the candidate (so the leg from the
 * anchor to the candidate runs along X); `orthogonal-z` holds its **X**. Both are
 * emitted whenever the pointer is off that coordinate at all, and the acquisition
 * radius is what keeps the family from winning when the draft is nowhere near an
 * axis — the resolver filters by `distance` before ranking.
 *
 * **Locked *and* stepped (P23.13 S8 owner decision).** The candidate's free
 * coordinate is quantized to `step` — the same value the grid fallback reads, so
 * the lattice is stated once — while the held coordinate stays *exactly* the
 * anchor's. That is the point of the family: with Snap on the draft must never
 * glide, so an axis lock lands on an exact point (the anchor's axis crossed with
 * a grid line) instead of sweeping continuously with the pointer, and near-axis
 * drawing — where most drawing happens, and where the lock wins most of the time
 * — still steps through subdivisions. `distance` deliberately stays the **raw**
 * perpendicular offset to the axis line: acquisition is a property of the pointer,
 * not of the lattice, so which probe wins where is unchanged by the stepping, and
 * a winner's committed coordinate moves by at most half a step.
 *
 * A candidate is declined when it would not be a lock at all: when it **is the
 * anchor** (a "lock" that would collapse the leg to zero length and, at rank 7,
 * outrank the grid point that would have produced a real wall) or when it **is
 * the pointer** (nothing to acquire). The order is load-bearing — quantize
 * **first**, decline **second** — because rounding can collapse a short leg onto
 * the anchor, so the coincident check must see the *final* point. The
 * collinearity check is the same rule read before the stepping: a pointer already
 * on the anchor's own line has its projection *be* the anchor, and locking the
 * other axis there would drag the point off the line being drawn.
 */
export function orthogonalGuideCandidates(
	anchor: LayoutVec2,
	point: LayoutVec2,
	step = LAYOUT_PLAN_GRID_STEP,
): SnapCandidate[] {
	// Quantize the free coordinate (the lock is exact), keep the held one exactly
	// as the anchor states it.
	const stepped = snapToGridStep(point, step);
	const orthoX: LayoutVec2 = [stepped[0]!, anchor[1]];
	const orthoZ: LayoutVec2 = [anchor[0], stepped[1]!];
	// The raw perpendicular offsets: the acquisition and rank-contention measure,
	// never recomputed against the stepped point.
	const offsetX = Math.abs(point[1] - anchor[1]);
	const offsetZ = Math.abs(point[0] - anchor[0]);
	const candidates: SnapCandidate[] = [];
	// `orthoX`'s raw projection is `[point[0], anchor[1]]` and its final point is
	// `[stepped[0], anchor[1]]`; it is a lock only when the pointer is off the
	// anchor's Z line (`offsetX`), the pointer is not on the anchor's X line, and
	// stepping did not land the free coordinate back on the anchor. Symmetric for
	// `orthoZ`.
	const lockX =
		Number.isFinite(offsetX) && offsetX > 0 && point[0] !== anchor[0] && orthoX[0] !== anchor[0];
	const lockZ =
		Number.isFinite(offsetZ) && offsetZ > 0 && point[1] !== anchor[1] && orthoZ[1] !== anchor[1];
	if (lockX) {
		candidates.push({
			point: orthoX,
			kind: 'orthogonal-guide',
			sourceId: 'orthogonal-x',
			ownerId: 'orthogonal-x',
			distance: offsetX,
		});
	}
	if (lockZ) {
		candidates.push({
			point: orthoZ,
			kind: 'orthogonal-guide',
			sourceId: 'orthogonal-z',
			ownerId: 'orthogonal-z',
			distance: offsetZ,
		});
	}
	return candidates;
}

/** Nearest-point (wall-span) candidates for one sample chunk of a curved wall. */
export function curvedSpanNearestCandidates(
	sample: CompiledQuerySpan,
	wallKey: string,
	index: number,
	point: LayoutVec2,
	radius: number,
	ownerId: string,
	wallId: string,
): SnapCandidate[] {
	const dx = sample.end[0] - sample.start[0];
	const dz = sample.end[1] - sample.start[1];
	const squared = dx * dx + dz * dz;
	if (squared <= 0) return [];
	const rawT = ((point[0] - sample.start[0]) * dx + (point[1] - sample.start[1]) * dz) / squared;
	const amount = Math.min(1, Math.max(0, rawT));
	const projected: LayoutVec2 = [sample.start[0] + dx * amount, sample.start[1] + dz * amount];
	const distance = Math.hypot(projected[0] - point[0], projected[1] - point[1]);
	if (distance > radius) return [];
	return [
		{
			point: projected,
			kind: 'wall-span',
			sourceId: `${wallKey}#sample:${index}`,
			ownerId,
			wallId,
			distance,
		},
	];
}

/**
 * Valid wall-wall intersection candidates across the compiled wall spans
 * (endpoint-on-interior and proper-crossing classes only). Collinear
 * classes and shared endpoints are skipped: shared endpoints already exist
 * as junction candidates and collinear overlaps are not a single point.
 */
export function wallIntersectionSnapCandidates(
	spans: readonly { id: string; start: LayoutVec2; end: LayoutVec2 }[],
	point: LayoutVec2,
	radius: number,
): SnapCandidate[] {
	const candidates: SnapCandidate[] = [];
	for (let first = 0; first < spans.length; first += 1) {
		for (let second = first + 1; second < spans.length; second += 1) {
			const a = spans[first]!;
			const b = spans[second]!;
			const segmentA: TopologySegment = { id: a.id, start: a.start, end: a.end };
			const segmentB: TopologySegment = { id: b.id, start: b.start, end: b.end };
			const classified = classifyWallIntersection(segmentA, segmentB, []);
			if (classified.kind !== 'endpoint-on-interior' && classified.kind !== 'proper-crossing')
				continue;
			const intersectionPoint = classified.point;
			const distance = Math.hypot(intersectionPoint[0] - point[0], intersectionPoint[1] - point[1]);
			if (distance > radius) continue;
			candidates.push({
				point: [intersectionPoint[0], intersectionPoint[1]],
				kind: 'wall-intersection',
				sourceId: `${a.id}~${b.id}`,
				ownerId: snapOwnerKey({ kind: 'wall', id: `${a.id}~${b.id}` }),
				distance,
			});
		}
	}
	return candidates;
}
