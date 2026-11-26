import type { LayoutVec2 } from '../geometry/coordinates';
import type { CurveSample } from '../geometry/curve';
import { canonicalBoundaryCycleKey } from '../geometry/face-extraction';
import { OPENING_SET_EPSILON, validateWallFirstOpeningSet } from '../wall/opening-set';
import { orientXZ } from '../geometry/robust-orientation';
import type { WallSamplingDerivation } from '../wall/centerline';
import { wallCenterlineSamples } from '../wall/centerline';
import type { LayoutDocumentWallFirst, LayoutWall, LayoutWallOpening } from '../wall/types';
import { isOpenSpace } from '../room/space-placement';
import type { TopologySegment } from '../wall/topology';
import { layoutItem, layoutLength } from '../kernel/source-collections';

export type HalfEdgeDesc = {
	readonly fromId: string;
	readonly toId: string;
	readonly wallId: string;
	readonly direction: 'forward' | 'reverse';
};

export type WalkSummary = {
	readonly twiceSignedArea: number;
	readonly wasPositive: boolean;
	readonly termCount: number;
	readonly magnitude: number;
	readonly accumulatedError: number;
};

export type HalfEdgeWalkLink = {
	readonly walkIndex: number;
	readonly twiceEdgeContrib: number;
	readonly termCount: number;
};

/**
 * Guard band around zero twice-signed-area for Green's-theorem differential
 * updates; any walk within this band delegates to the cold face extractor so
 * exact IEEE-754 summation order decides `zero_area_face`.
 */
export const WALK_AREA_GUARD_EPSILON = 1e-5;

export function buildPlanarCombinatorialMap(
	document: LayoutDocumentWallFirst,
	pointById: ReadonlyMap<string, LayoutVec2>,
	wallById: ReadonlyMap<string, LayoutWall>,
):
	| {
			faceGraphWallIdSet: ReadonlySet<string>;
			starOrderByJunctionId: ReadonlyMap<string, readonly HalfEdgeDesc[]>;
			walks: readonly WalkSummary[];
			halfEdgeWalkByKey: ReadonlyMap<string, HalfEdgeWalkLink>;
	  }
	| undefined {
	const faceGraphWalls = stripDanglesForIndex(document.walls);
	const faceGraphWallIdSet = new Set(faceGraphWalls.map((w) => w.id));

	const halfEdges: HalfEdgeDesc[] = [];
	for (const w of faceGraphWalls) {
		halfEdges.push({
			fromId: w.startJunctionId,
			toId: w.endJunctionId,
			wallId: w.id,
			direction: 'forward',
		});
		halfEdges.push({
			fromId: w.endJunctionId,
			toId: w.startJunctionId,
			wallId: w.id,
			direction: 'reverse',
		});
	}

	const outgoing = new Map<string, HalfEdgeDesc[]>();
	for (const edge of halfEdges) {
		const list = outgoing.get(edge.fromId);
		if (list) list.push(edge);
		else outgoing.set(edge.fromId, [edge]);
	}
	const pointOf = (id: string): LayoutVec2 | undefined => pointById.get(id);
	for (const [jId, edges] of outgoing) {
		edges.sort((a, b) => compareHalfEdgesWithPoints(pointOf, jId, a, b));
	}

	const visited = new Set<HalfEdgeDesc>();
	const walks: WalkSummary[] = [];
	const halfEdgeWalkByKey = new Map<string, HalfEdgeWalkLink>();
	const positiveFaceBoundaryByKey = new Map<
		string,
		ReadonlyArray<{ wallId: string; direction: 'forward' | 'reverse' }>
	>();

	let walkGuards = 0;
	const maxGuards = halfEdges.length * 2 + 16;

	for (const edge of halfEdges) {
		if (visited.has(edge)) continue;
		const ring: HalfEdgeDesc[] = [];
		let current: HalfEdgeDesc = edge;
		let closed = false;
		while (walkGuards < maxGuards) {
			walkGuards += 1;
			if (visited.has(current)) {
				if (ring[0] === current) closed = true;
				break;
			}
			visited.add(current);
			ring.push(current);
			const star = outgoing.get(current.toId);
			if (!star || star.length === 0) break;
			const twinIdx = star.findIndex(
				(cand) => cand.toId === current.fromId && cand.wallId === current.wallId,
			);
			if (twinIdx === -1) break;
			const next = star[(twinIdx - 1 + star.length) % star.length]!;
			if (next === edge) {
				closed = true;
				break;
			}
			if (visited.has(next)) break;
			current = next;
		}
		if (!closed) return undefined;

		const walkIndex = walks.length;
		let twiceArea = 0,
			termCount = 0,
			magnitude = 0;
		for (const half of ring) {
			const w = wallById.get(half.wallId)!;
			const start = pointById.get(w.startJunctionId)!;
			const end = pointById.get(w.endJunctionId)!;
			const contrib = computeHalfEdgeTwiceAreaContrib(w, start, end, half.direction);
			if (contrib === null || !Number.isFinite(contrib.value)) return undefined;
			twiceArea += contrib.value;
			termCount += contrib.termCount;
			magnitude = Math.max(magnitude, contrib.magnitude);
			halfEdgeWalkByKey.set(`${half.wallId}:${half.direction}`, {
				walkIndex,
				twiceEdgeContrib: contrib.value,
				termCount: contrib.termCount,
			});
		}
		const accumulatedError = areaRoundingBound(termCount, magnitude);
		if (
			!Number.isFinite(twiceArea) ||
			!Number.isFinite(accumulatedError) ||
			Math.abs(twiceArea) <= upperErrorSum(WALK_AREA_GUARD_EPSILON, 2 * accumulatedError)
		) {
			return undefined;
		}
		const wasPositive = twiceArea > 0;
		walks.push({ twiceSignedArea: twiceArea, wasPositive, termCount, magnitude, accumulatedError });
		if (wasPositive) {
			const boundary = ring.map((h) => ({ wallId: h.wallId, direction: h.direction }));
			const faceKey = canonicalBoundaryCycleKey(boundary);
			if (positiveFaceBoundaryByKey.has(faceKey)) return undefined;
			positiveFaceBoundaryByKey.set(faceKey, boundary);
		}
	}

	// Every positive bounded face must map 1-to-1 to an ENCLOSED Space (I5),
	// and each enclosed Space's stored `boundary` must already match the
	// canonical walk sequence element-for-element (so `reconcileRooms` produces
	// the exact same `boundary` array without rotating elements). An open Space
	// is not a face and is certified by its composer outline above.
	const enclosedRooms = document.rooms.filter((room) => !isOpenSpace(room));
	if (positiveFaceBoundaryByKey.size !== enclosedRooms.length) {
		return undefined;
	}
	const claimedFaceKeys = new Set<string>();
	for (const room of enclosedRooms) {
		const roomKey = canonicalBoundaryCycleKey(room.boundary);
		if (claimedFaceKeys.has(roomKey)) return undefined;
		const canonicalBoundary = positiveFaceBoundaryByKey.get(roomKey);
		if (!canonicalBoundary || canonicalBoundary.length !== room.boundary.length) {
			return undefined;
		}
		for (let i = 0; i < room.boundary.length; i += 1) {
			if (
				room.boundary[i]!.wallId !== canonicalBoundary[i]!.wallId ||
				room.boundary[i]!.direction !== canonicalBoundary[i]!.direction
			) {
				return undefined;
			}
		}
		claimedFaceKeys.add(roomKey);
	}

	return {
		faceGraphWallIdSet,
		starOrderByJunctionId: outgoing,
		walks,
		halfEdgeWalkByKey,
	};
}

function stripDanglesForIndex(walls: readonly LayoutWall[]): LayoutWall[] {
	let current = [...walls];
	while (current.length > 0) {
		const degree = new Map<string, number>();
		for (const w of current) {
			degree.set(w.startJunctionId, (degree.get(w.startJunctionId) ?? 0) + 1);
			degree.set(w.endJunctionId, (degree.get(w.endJunctionId) ?? 0) + 1);
		}
		const kept = current.filter(
			(w) => (degree.get(w.startJunctionId) ?? 0) > 1 && (degree.get(w.endJunctionId) ?? 0) > 1,
		);
		if (kept.length === current.length) return current;
		current = kept;
	}
	return [];
}

export function compareHalfEdgesWithPoints(
	pointOf: (id: string) => LayoutVec2 | undefined,
	fromId: string,
	a: HalfEdgeDesc,
	b: HalfEdgeDesc,
): number {
	if (a.wallId === b.wallId && a.direction === b.direction) return 0;
	const origin = pointOf(fromId)!;
	const aTarget = pointOf(a.toId)!;
	const bTarget = pointOf(b.toId)!;
	const qA = quadrantOf(aTarget[0] - origin[0], aTarget[1] - origin[1]);
	const qB = quadrantOf(bTarget[0] - origin[0], bTarget[1] - origin[1]);
	if (qA !== qB) return qA - qB;
	const sign = orientXZ(origin, aTarget, bTarget);
	if (sign > 0) return -1;
	if (sign < 0) return 1;
	if (a.wallId === b.wallId) return a.direction < b.direction ? -1 : 1;
	return a.wallId < b.wallId ? -1 : a.wallId > b.wallId ? 1 : 0;
}

function quadrantOf(dx: number, dz: number): number {
	if (dx > 0 && dz >= 0) return 0;
	if (dx <= 0 && dz > 0) return 1;
	if (dx < 0 && dz <= 0) return 2;
	return 3;
}

export function sameCyclicHalfEdgeOrder(
	a: readonly HalfEdgeDesc[],
	b: readonly HalfEdgeDesc[],
): boolean {
	if (a.length !== b.length) return false;
	if (a.length <= 2) {
		// Any two distinct elements have only one cyclic order of length <= 2,
		// provided neither became collinear/degenerate (orientXZ == 0).
		return true;
	}
	const first = a[0]!;
	const offset = b.findIndex(
		(cand) => cand.wallId === first.wallId && cand.direction === first.direction,
	);
	if (offset === -1) return false;
	for (let i = 0; i < a.length; i += 1) {
		const left = a[i]!;
		const right = b[(offset + i) % b.length]!;
		if (left.wallId !== right.wallId || left.direction !== right.direction) {
			return false;
		}
	}
	return true;
}

export type EdgeAreaContribution = { value: number; termCount: number; magnitude: number };

/** Conservative forward-error envelope for <=2n sequential/grouped additions
 * of n shoelace terms and their products/subtractions. EPSILON is twice the
 * unit roundoff; 64 n² EPS M² also covers grouping, with subnormal slack.
 * This proves only a sign, never substitutes a canonical face/area value. */
export function areaRoundingBound(terms: number, magnitude: number): number {
	if (!(terms > 0) || terms * Number.EPSILON > 1 / 1024) return Infinity;
	return (
		64 * Number.EPSILON * terms * terms * magnitude * magnitude +
		64 * Number.MIN_VALUE * terms * terms
	);
}

export function roundingAllowance(a: number, b: number): number {
	return 4 * Number.EPSILON * (Math.abs(a) + Math.abs(b)) + 4 * Number.MIN_VALUE;
}

export function upperErrorSum(...values: number[]): number {
	let total = 0;
	for (const value of values)
		total = (total + value) * (1 + 8 * Number.EPSILON) + 4 * Number.MIN_VALUE;
	return total;
}

export function computeHalfEdgeTwiceAreaContrib(
	wall: LayoutWall,
	canonicalStart: LayoutVec2,
	canonicalEnd: LayoutVec2,
	direction: 'forward' | 'reverse',
	sampling?: WallSamplingDerivation,
): EdgeAreaContribution | null {
	const fromPt = direction === 'forward' ? canonicalStart : canonicalEnd;
	const toPt = direction === 'forward' ? canonicalEnd : canonicalStart;
	if (wall.centerline.kind === 'line') {
		return {
			value: fromPt[0] * toPt[1] - toPt[0] * fromPt[1],
			termCount: 1,
			magnitude: Math.max(...fromPt.map(Math.abs), ...toPt.map(Math.abs)),
		};
	}
	const sampled = sampling
		? sampling.samples(wall, canonicalStart, canonicalEnd, direction)
		: sampleSegmentQuietly(wall, canonicalStart, canonicalEnd, direction);
	if (!sampled) return null;
	const samples = sampled.samples;
	let sum = 0,
		magnitude = Math.max(...fromPt.map(Math.abs), ...toPt.map(Math.abs));
	let prev = fromPt;
	for (let i = 1; i < samples.length - 1; i += 1) {
		const curr = samples[i]!.point;
		magnitude = Math.max(magnitude, Math.abs(curr[0]), Math.abs(curr[1]));
		sum += prev[0] * curr[1] - curr[0] * prev[1];
		prev = curr;
	}
	sum += prev[0] * toPt[1] - toPt[0] * prev[1];
	return { value: sum, termCount: Math.max(1, samples.length - 1), magnitude };
}

export function sampleSegmentQuietly(
	wall: LayoutWall,
	start: LayoutVec2,
	end: LayoutVec2,
	direction: 'forward' | 'reverse',
) {
	return wallCenterlineSamples(wall, start, end, direction);
}

export function certifyOpeningsQuietly(
	document: LayoutDocumentWallFirst,
	wallById: ReadonlyMap<string, LayoutWall>,
	pointById: ReadonlyMap<string, LayoutVec2>,
): boolean {
	// Validate baseline openings without emitting per-edit lookup work counts.
	const openingsByWall = new Map<string, LayoutWallOpening[]>();
	for (let i = 0; i < layoutLength(document, 'openings'); i += 1) {
		const opening = layoutItem(document, 'openings', i)!;
		const wall = wallById.get(opening.wallId);
		if (!wall) return false;
		const start = pointById.get(wall.startJunctionId);
		const end = pointById.get(wall.endJunctionId);
		if (!start || !end) return false;
		let spanLength: number;
		if (wall.centerline.kind === 'line') {
			spanLength = Math.hypot(end[0] - start[0], end[1] - start[1]);
		} else {
			const sampled = sampleSegmentQuietly(wall, start, end, 'forward');
			if (!sampled) return false;
			spanLength = sampled.length;
		}
		if (!(spanLength > OPENING_SET_EPSILON)) return false;
		if (!Number.isFinite(opening.offset) || opening.offset < 0) return false;
		if (
			!Number.isFinite(opening.width) ||
			opening.width <= 0 ||
			!Number.isFinite(opening.height) ||
			opening.height <= 0 ||
			!Number.isFinite(opening.sillHeight) ||
			opening.sillHeight < 0
		) {
			return false;
		}
		if (opening.offset + opening.width > spanLength + OPENING_SET_EPSILON) return false;
		if (opening.sillHeight + opening.height > wall.height + OPENING_SET_EPSILON) return false;
		if (opening.profile !== undefined) {
			// Rare arched profile — delegate to canonical validator on just this opening.
			const miniDoc: LayoutDocumentWallFirst = {
				...document,
				walls: [wall],
				junctions: [
					{ id: wall.startJunctionId, point: start },
					{ id: wall.endJunctionId, point: end },
				],
				openings: [opening],
			};
			if (validateWallFirstOpeningSet(miniDoc).length > 0) return false;
		}
		const group = openingsByWall.get(opening.wallId) ?? [];
		group.push(opening);
		openingsByWall.set(opening.wallId, group);
	}
	for (const openings of openingsByWall.values()) {
		if (openings.length <= 1) continue;
		const sorted = [...openings].sort((a, b) => a.offset - b.offset || a.id.localeCompare(b.id));
		for (let i = 1; i < sorted.length; i += 1) {
			const prev = sorted[i - 1]!;
			const curr = sorted[i]!;
			if (curr.offset < prev.offset + prev.width - OPENING_SET_EPSILON) return false;
		}
	}
	return true;
}

export function chordSamples(segment: TopologySegment, length: number): CurveSample[] {
	return [
		{ point: segment.start, distance: 0, tangent: [1, 0], normal: [0, 1], t: 0 },
		{ point: segment.end, distance: length, tangent: [1, 0], normal: [0, 1], t: 1 },
	];
}
