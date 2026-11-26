import { pointInPolygon } from '../../geometry/objects';
import type {
	CompiledLayoutGeometry,
	CompiledLayoutObject,
	CompiledOpening,
	CompiledPhysicalWall,
	CompiledRegion,
	CompiledRoom,
	LayoutBounds2,
} from '../../geometry/types';
import { LAYOUT_SLICE_CONTACT_METERS } from '../../room/region-validation';
import type { LayoutVec2 } from '../../geometry/coordinates';
import { finiteVec2, isFiniteNumber } from './membership';
import type { Candidate, PlanFragment, PlanSourceKind, PlanStream, SourcePlan } from './types';
import { PLAN_SOURCE_KINDS } from './types';

function distanceToSegment(point: LayoutVec2, start: LayoutVec2, end: LayoutVec2): number {
	const dx = end[0] - start[0];
	const dz = end[1] - start[1];
	const squared = dx * dx + dz * dz;
	if (squared === 0) return Math.hypot(point[0] - start[0], point[1] - start[1]);
	const raw = ((point[0] - start[0]) * dx + (point[1] - start[1]) * dz) / squared;
	const amount = Math.min(1, Math.max(0, raw));
	return Math.hypot(point[0] - (start[0] + dx * amount), point[1] - (start[1] + dz * amount));
}

/** Minimum plan distance from the target to a source's extent; `null` when it has none. */
export function planDistance(target: LayoutVec2, plan: SourcePlan): number | null {
	switch (plan.kind) {
		case 'span':
			return distanceToSegment(target, plan.start, plan.end);
		case 'polyline': {
			if (plan.polyline.length === 0) return null;
			if (plan.polyline.length === 1) {
				const only = plan.polyline[0]!;
				return Math.hypot(target[0] - only[0], target[1] - only[1]);
			}
			let best = Infinity;
			for (let index = 1; index < plan.polyline.length; index += 1) {
				best = Math.min(
					best,
					distanceToSegment(target, plan.polyline[index - 1]!, plan.polyline[index]!),
				);
			}
			return best;
		}
		case 'polygon': {
			if (plan.polygon.length === 0) return null;
			// Inside the footprint is zero distance: the target is inside this source's extent.
			if (pointInPolygon(target, plan.polygon)) return 0;
			let best = Infinity;
			for (let index = 0; index < plan.polygon.length; index += 1) {
				const start = plan.polygon[index]!;
				const end = plan.polygon[(index + 1) % plan.polygon.length]!;
				best = Math.min(best, distanceToSegment(target, start, end));
			}
			return best;
		}
	}
}

function planPoints(plan: SourcePlan): readonly LayoutVec2[] {
	switch (plan.kind) {
		case 'span':
			return [plan.start, plan.end];
		case 'polyline':
			return plan.polyline;
		case 'polygon':
			return plan.polygon;
	}
}

/**
 * Whether a source's plan extent can produce a fragment at all.
 *
 * A span always has two endpoints; a polyline needs two points to be a line; a
 * polygon needs three to enclose an area. The check is deliberately about the
 * *extent*, not about a rendered subdivision: a Wall whose compiled solids are
 * empty has nothing to place in a plan, and saying so is `no-meaningful-projection`
 * rather than emitting an empty stroke a consumer would have to defend against.
 */
export function hasPlanGeometry(plan: SourcePlan): boolean {
	switch (plan.kind) {
		case 'span':
			return finiteVec2(plan.start) && finiteVec2(plan.end);
		case 'polyline':
			return plan.polyline.length >= 2 && plan.polyline.every((point) => finiteVec2(point));
		case 'polygon':
			return plan.polygon.length >= 3 && plan.polygon.every((point) => finiteVec2(point));
	}
}

/** Running plan bound; the one place a fragment's points are folded into `bounds`. */
type BoundsAccumulator = {
	minX: number;
	minZ: number;
	maxX: number;
	maxZ: number;
	seen: boolean;
};

export function emptyBounds(): BoundsAccumulator {
	return { minX: Infinity, minZ: Infinity, maxX: -Infinity, maxZ: -Infinity, seen: false };
}

export function accumulateBounds(state: BoundsAccumulator, plan: SourcePlan): void {
	for (const point of planPoints(plan)) {
		if (!isFiniteNumber(point[0]) || !isFiniteNumber(point[1])) continue;
		state.seen = true;
		state.minX = Math.min(state.minX, point[0]);
		state.minZ = Math.min(state.minZ, point[1]);
		state.maxX = Math.max(state.maxX, point[0]);
		state.maxZ = Math.max(state.maxZ, point[1]);
	}
}

export function finishedBounds(state: BoundsAccumulator): LayoutBounds2 | null {
	if (!state.seen) return null;
	return { min: [state.minX, state.minZ], max: [state.maxX, state.maxZ] };
}

export function boundsOf(fragments: readonly PlanFragment[]): LayoutBounds2 | null {
	const state = emptyBounds();
	for (const fragment of fragments) accumulateBounds(state, fragment.geometry);
	return finishedBounds(state);
}

/**
 * Stream placement of one source, from its vertical extent against the cut plane.
 *
 * - `cut`: the cut plane passes through the solid (`minY < cutElevation <= maxY`) —
 *   the wall/solid the section actually cuts.
 * - `projected`: the solid is shown by projection onto the Plan. Every `room-floor`
 *   is projected whatever its datum: a floor is the surface the Plan looks at, never
 *   overhead geometry hidden behind the cut plane. Remaining sources are projected
 *   when their whole extent sits at or above the cut (a lintel, a high object).
 * - `hidden`: the whole extent is below the cut plane and is drawn hidden.
 */
export function streamFor(
	candidate: Candidate,
	cutElevation: number,
): Exclude<PlanStream, 'symbol'> {
	if (candidate.sourceKind === 'room-floor') return 'projected';
	if (candidate.regionRole) {
		const { minY, maxY } = candidate.extent;
		const tolerance = LAYOUT_SLICE_CONTACT_METERS;
		if (minY > cutElevation + tolerance) return 'hidden';
		if (minY < cutElevation - tolerance && maxY > cutElevation + tolerance) return 'cut';
		return 'projected';
	}
	const extent = candidate.extent;
	if (extent.minY < cutElevation && cutElevation <= extent.maxY) return 'cut';
	return extent.minY >= cutElevation ? 'projected' : 'hidden';
}

/**
 * One compiled Wall's candidates, in the order its placements are declared.
 *
 * Shared by the reference evaluator and the incremental retainer, so a Wall's
 * candidate set has exactly one definition. Compiled spans are ordered by distance
 * along the Wall, so a Wall's placements are deterministic without depending on the
 * order the compiler happened to emit them.
 */
export function wallCandidatesOf(wall: CompiledPhysicalWall, datumMeters: number): Candidate[] {
	if (wall.solidSpans.length === 0) {
		return [
			{
				sourceKind: 'wall',
				sourceId: wall.wallId,
				extent: { minY: datumMeters, maxY: datumMeters + wall.height },
				plan: { kind: 'polyline', polyline: [] },
				subRef: null,
				symbolOnly: false,
			},
		];
	}
	const spans = [...wall.solidSpans].sort(
		(left, right) => left.startDistance - right.startDistance,
	);
	const candidates: Candidate[] = [];
	for (const span of spans) {
		candidates.push({
			sourceKind: 'wall',
			sourceId: wall.wallId,
			extent: { minY: datumMeters + span.bottomY, maxY: datumMeters + span.topY },
			plan: { kind: 'span', start: span.start, end: span.end },
			subRef: { kind: 'interval', start: span.startDistance, end: span.endDistance },
			symbolOnly: false,
		});
	}
	return candidates;
}

export function openingCandidate(opening: CompiledOpening, datumMeters: number): Candidate {
	return {
		sourceKind: 'opening',
		sourceId: opening.openingId,
		extent: {
			minY: datumMeters + opening.sillHeight,
			maxY: datumMeters + opening.sillHeight + opening.height,
		},
		plan: { kind: 'polyline', polyline: opening.centerPolyline },
		subRef: { kind: 'interval', start: opening.offset, end: opening.offset + opening.width },
		// An Opening is a void with a plan symbol: it never becomes a cut stroke.
		symbolOnly: true,
	};
}

export function objectCandidate(object: CompiledLayoutObject): Candidate {
	return {
		sourceKind: 'object',
		sourceId: object.objectId,
		extent: { minY: object.worldAabb.min[1], maxY: object.worldAabb.max[1] },
		plan: { kind: 'polygon', polygon: object.planFootprint },
		subRef: null,
		symbolOnly: false,
	};
}

export function roomFloorCandidate(room: CompiledRoom): Candidate {
	return {
		sourceKind: 'room-floor',
		sourceId: room.roomId,
		// A floor polygon is planar at the Room's compiled datum; it is never cut.
		extent: { minY: room.floorElevation, maxY: room.floorElevation },
		plan: { kind: 'polygon', polygon: room.floorPolygon },
		subRef: null,
		symbolOnly: false,
	};
}

export function regionCandidate(region: CompiledRegion): Candidate {
	return {
		sourceKind: 'region',
		sourceId: region.regionId,
		extent: { minY: region.bottomY, maxY: region.topY },
		plan: { kind: 'polygon', polygon: region.footprint },
		subRef: null,
		symbolOnly: false,
		regionRole: region.role,
		regionKey: region.cacheKey,
	};
}

export function wallCandidates(geometry: CompiledLayoutGeometry, datumMeters: number): Candidate[] {
	const walls: readonly CompiledPhysicalWall[] = [...geometry.walls].sort(
		compareSourceIds((wall) => wall.wallId),
	);
	const candidates: Candidate[] = [];
	for (const wall of walls)
		for (const candidate of wallCandidatesOf(wall, datumMeters)) candidates.push(candidate);
	return candidates;
}

export function openingCandidates(
	geometry: CompiledLayoutGeometry,
	datumMeters: number,
): Candidate[] {
	const byId = new Map<string, CompiledOpening>();
	for (const wall of geometry.walls) {
		for (const opening of wall.openings) {
			if (!byId.has(opening.openingId)) byId.set(opening.openingId, opening);
		}
	}
	return [...byId.values()]
		.sort(compareSourceIds((opening) => opening.openingId))
		.map((opening) => openingCandidate(opening, datumMeters));
}

export function objectCandidates(geometry: CompiledLayoutGeometry): Candidate[] {
	const objects: readonly CompiledLayoutObject[] = [...geometry.objects].sort(
		compareSourceIds((object) => object.objectId),
	);
	return objects.map((object) => objectCandidate(object));
}

export function roomFloorCandidates(geometry: CompiledLayoutGeometry): Candidate[] {
	const rooms: readonly CompiledRoom[] = [...geometry.rooms].sort(
		compareSourceIds((room) => room.roomId),
	);
	return rooms.map((room) => roomFloorCandidate(room));
}

/** Ascending code-unit order on a source id — the only order a Plan may depend on. */
export function compareSourceIds<T>(id: (record: T) => string): (left: T, right: T) => number {
	return (left, right) => {
		const leftId = id(left);
		const rightId = id(right);
		return leftId < rightId ? -1 : leftId > rightId ? 1 : 0;
	};
}

/**
 * The declared source order, **derived** from `PLAN_SOURCE_KINDS` rather than restated.
 *
 * The fragment comparator, the membership order and the incremental retainer's assembly
 * order all have to agree about where a kind sits; deriving it here is what makes that
 * agreement structural instead of a convention three places must remember.
 */
const SOURCE_KIND_ORDER: Readonly<Record<PlanSourceKind, number>> = Object.fromEntries(
	PLAN_SOURCE_KINDS.map((kind, index) => [kind, index]),
) as Record<PlanSourceKind, number>;

export function compareFragments(left: PlanFragment, right: PlanFragment): number {
	const leftKind = SOURCE_KIND_ORDER[left.ref.sourceKind];
	const rightKind = SOURCE_KIND_ORDER[right.ref.sourceKind];
	if (leftKind !== rightKind) return leftKind - rightKind;
	if (left.ref.sourceId !== right.ref.sourceId)
		return left.ref.sourceId < right.ref.sourceId ? -1 : 1;
	const leftStart = left.ref.subRef?.kind === 'interval' ? left.ref.subRef.start : 0;
	const rightStart = right.ref.subRef?.kind === 'interval' ? right.ref.subRef.start : 0;
	if (leftStart !== rightStart) return leftStart - rightStart;
	const leftEnd = left.ref.subRef?.kind === 'interval' ? left.ref.subRef.end : 0;
	const rightEnd = right.ref.subRef?.kind === 'interval' ? right.ref.subRef.end : 0;
	return leftEnd - rightEnd;
}
