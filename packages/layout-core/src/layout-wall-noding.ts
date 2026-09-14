/**
 * `layout-wall-noding.ts` — P23.8 deterministic T/X noding planning.
 *
 * Noding is an explicit semantic mutation, not a compiler repair (H3 §9).
 * These planners build the **complete candidate document** from an immutable
 * baseline; the caller validates once and commits once. Nothing here mutates
 * its inputs.
 *
 * Identity rules (P23.8 plan):
 * - Wall `W(A → B)` split at distance `d` from canonical start `A`:
 *   `A → X` retains Wall ID `W`; `X → B` receives one new deterministic
 *   Wall ID. Canonical orientation is never reversed for convenience.
 * - Opening rebasing by physical meter offset (H5 §5.2):
 *   `o + width <= d` stays; `o >= d` moves with `offset' = o - d`;
 *   `o < d < o + width` rejects the whole operation; exact start/end splits
 *   are legal and deterministic.
 * - Every Room boundary referencing the split Wall is rewritten atomically:
 *   forward `[W] → [W, W2]`; reverse `[W] → [W2, W]`.
 * - Junction X is allocated/reused exactly once per split point.
 * - Split at an existing endpoint is a no-op (rejected by callers as
 *   meaningless), never a zero-length child.
 * - X crossings split both walls against one shared new Junction, processed
 *   in stable Wall-ID order.
 */
import type {
	LayoutDocumentWallFirst,
	LayoutJunction,
	LayoutWall,
	LayoutWallOpening,
	LayoutWallFirstRoom,
	OrientedWallRef
} from './layout-wall-first-types';
import type { LayoutVec2 } from './layout-types';
import { coincidesAsJunction } from './layout-junction-identity';

/** Exact straight-segment length between two points. */
function segmentSpanLength(start: LayoutVec2, end: LayoutVec2): number {
	return Math.hypot(end[0] - start[0], end[1] - start[1]);
}

/** Exact point at meter distance `d` along the straight span start→end. */
function pointAtSpanDistance(start: LayoutVec2, end: LayoutVec2, distance: number): LayoutVec2 {
	const length = segmentSpanLength(start, end);
	if (length === 0) return [start[0], start[1]];
	const t = distance / length;
	return [start[0] + (end[0] - start[0]) * t, start[1] + (end[1] - start[1]) * t];
}

/** Rejection reason for a noding plan; machine-stable codes per H3 §12. */
export type NodingRejection = {
	code:
		| 'split_at_existing_endpoint'
		| 'split_distance_out_of_range'
		| 'split_through_opening_interior'
		| 'unknown_wall'
		| 'unknown_junction'
		/**
		 * P23.11 — the Wall carries a curved centerline. Splitting a curve is
		 * explicitly deferred: this planner measures in chords, so letting a curved
		 * Wall through would silently flatten it into straight fragments.
		 */
		| 'curved_wall_unsupported'
		| 'junction_point_mismatch';
	message: string;
	/** Involved authored IDs where available. */
	wallId?: string;
};

export type NodingPlanSuccess = {
	kind: 'success';
	document: LayoutDocumentWallFirst;
	/** The junction at the split/crossing point (existing or newly planned). */
	junctionId: string;
	/** Wall fragments created by the plan (the new-ID fragments). */
	createdWallIds: string[];
	/** IDs of walls that were subdivided. */
	splitWallIds: string[];
};

export type NodingPlan = NodingPlanSuccess | { kind: 'rejected'; rejection: NodingRejection };

/** Deterministic allocator contract supplied by the caller (P23.8: from pre-commit document, never timestamps/random). */
export type NodingIdAllocator = {
	/** Next collision-free deterministic ID for a new wall fragment. */
	nextWallId(baseDocument: LayoutDocumentWallFirst, seed: string): string;
	/** Next collision-free deterministic ID for a new junction. */
	nextJunctionId(baseDocument: LayoutDocumentWallFirst, seed: string): string;
};

/**
 * Split one wall `W(A → B)` at a new/existing junction placed at distance
 * `d` (meters from the wall's canonical start).
 *
 * `existingJunctionId` names an already-authored junction at the split point
 * (the T-junction rule: the incoming wall's endpoint junction is reused, no
 * new junction is allocated). When omitted, one is allocated deterministically.
 */
export function planWallSplit(
	document: LayoutDocumentWallFirst,
	wallId: string,
	splitDistance: number,
	allocator: NodingIdAllocator,
	options: { existingJunctionId?: string } = {}
): NodingPlan {
	return planWallSplitInternal(document, wallId, splitDistance, allocator, options, undefined);
}

/**
 * Split with an exact junction coordinate (used by X crossings: the shared
 * junction must land on the validated crossing point, not a per-wall
 * projection). Both splits pass the same crossing point.
 */
function planWallSplitWithPoint(
	document: LayoutDocumentWallFirst,
	wallId: string,
	splitDistance: number,
	point: LayoutVec2,
	allocator: NodingIdAllocator,
	options: { existingJunctionId?: string }
): NodingPlan {
	return planWallSplitInternal(document, wallId, splitDistance, allocator, options, point);
}

function planWallSplitInternal(
	document: LayoutDocumentWallFirst,
	wallId: string,
	splitDistance: number,
	allocator: NodingIdAllocator,
	options: { existingJunctionId?: string },
	overridePoint: LayoutVec2 | undefined
): NodingPlan {
	const wall = document.walls.find((candidate) => candidate.id === wallId);
	if (!wall) {
		return rejected({ code: 'unknown_wall', message: `Unknown wall '${wallId}'`, wallId });
	}
	// P23.11 — fail fast before allocating anything. This planner's whole model
	// (chord length, straight fragments) cannot represent a curve, so pinning it
	// as straight-only here is what keeps another caller from flattening one.
	if (wall.centerline.kind !== 'line') {
		return rejected({
			code: 'curved_wall_unsupported',
			message: `Wall '${wallId}' is curved; splitting a curved Wall is unsupported`,
			wallId
		});
	}
	const startJunction = document.junctions.find((junction) => junction.id === wall.startJunctionId);
	const endJunction = document.junctions.find((junction) => junction.id === wall.endJunctionId);
	if (!startJunction || !endJunction) {
		return rejected({
			code: 'unknown_junction',
			message: `Wall '${wallId}' references unknown junctions`,
			wallId
		});
	}

	const length = segmentSpanLength(startJunction.point, endJunction.point);
	if (!(splitDistance > 0) || !(splitDistance < length)) {
		return rejected({
			code:
				splitDistance === 0 || splitDistance === length
					? 'split_at_existing_endpoint'
					: 'split_distance_out_of_range',
			message: `Split distance ${splitDistance} is outside the open interval (0, ${length}) for wall '${wallId}'`,
			wallId
		});
	}

	// Opening rebasing on the baseline wall (H5 §5.2). Rejects before any
	// candidate construction when a split would pass through an opening.
	const rebased = rebaseOpenings(document.openings, wallId, splitDistance, length);
	if (typeof rebased === 'string') {
		return rejected({
			code: 'split_through_opening_interior',
			message: `Split of wall '${wallId}' at ${splitDistance} passes through opening interior: ${rebased}`,
			wallId
		});
	}

	const splitPoint = overridePoint ?? pointAtSpanDistance(startJunction.point, endJunction.point, splitDistance);
	const junctionId = options.existingJunctionId ?? allocator.nextJunctionId(document, `${wallId}-split`);
	const newWallId = allocator.nextWallId(document, `${wallId}-b`);
	// Candidate documents: replace W with [W (A→X), W2 (X→B)]. The junction
	// record is inserted when newly allocated; a supplied existing junction is
	// reused as-is when present, or inserted at the resolved point when the
	// caller names a junction that does not exist yet (X crossings: the first
	// split introduces the shared junction). Existing Junction coordinates are
	// canonical: a tolerant identity match permits reuse but never moves the
	// Junction or other authored geometry already attached to it.
	let junctions: LayoutJunction[] = document.junctions;
	if (!options.existingJunctionId) {
		junctions = [...document.junctions, { id: junctionId, point: splitPoint }];
	} else {
		const existing = document.junctions.find((junction) => junction.id === options.existingJunctionId);
		if (existing) {
			if (!coincidesAsJunction(existing.point, splitPoint)) {
				return rejected({
					code: 'junction_point_mismatch',
					message: `Junction '${junctionId}' exists at a different coordinate than the requested split point`,
					wallId
				});
			}
		} else {
			junctions = [...document.junctions, { id: junctionId, point: splitPoint }];
		}
	}
	const walls: LayoutWall[] = [];
	const openings: LayoutWallOpening[] = [];
	const retainedOpenings = rebased.retained;
	const movedOpenings = rebased.moved;
	for (const candidate of document.walls) {
		if (candidate.id !== wallId) {
			walls.push(candidate);
			continue;
		}
		// P23.11 — the split primitive stays straight-only: both fragments emit
		// the canonical straight centerline (curved Walls reject earlier).
		walls.push({ ...candidate, endJunctionId: junctionId, centerline: { kind: 'line' } });
		walls.push({
			id: newWallId,
			startJunctionId: junctionId,
			endJunctionId: candidate.endJunctionId,
			role: candidate.role,
			thickness: candidate.thickness,
			height: candidate.height,
			centerline: { kind: 'line' }
		});
	}
	for (const opening of document.openings) {
		if (opening.wallId !== wallId) {
			openings.push(opening);
			continue;
		}
		const retained = retainedOpenings.find((entry) => entry.id === opening.id);
		if (retained) {
			openings.push(opening);
			continue;
		}
		const moved = movedOpenings.find((entry) => entry.id === opening.id);
		if (moved) {
			openings.push({ ...opening, wallId: newWallId, offset: moved.offset });
		}
	}

	// Room boundary rewrites (H5 §5.2): forward [W] → [W, W2]; reverse [W] → [W2, W].
	const rooms = document.rooms.map((room) => ({
		...room,
		boundary: rewriteBoundaryForSplit(room.boundary, wallId, newWallId)
	}));

	return {
		kind: 'success',
		document: {
			...document,
			junctions,
			walls,
			rooms,
			openings
		},
		junctionId,
		createdWallIds: [newWallId],
		splitWallIds: [wallId]
	};
}

/**
 * Split with an exact junction coordinate — the migration T-node path: the
 * stem's endpoint junction already exists at a known coordinate, and the
 * host split must land on that exact coordinate (a reconstructed
 * `pointAtSpanDistance` can drift in the last ulp and trip the
 * `junction_point_mismatch` guard).
 */
export function planWallSplitAtPoint(
	document: LayoutDocumentWallFirst,
	wallId: string,
	splitDistance: number,
	point: LayoutVec2,
	allocator: NodingIdAllocator,
	options: { existingJunctionId?: string } = {}
): NodingPlan {
	return planWallSplitInternal(document, wallId, splitDistance, allocator, options, point);
}

/**
 * Node a proper X crossing: one new shared junction, both walls split
 * against it, processed in stable wall-ID order (H3 §9.2).
 */
export function planWallCrossing(
	document: LayoutDocumentWallFirst,
	wallIds: [string, string],
	crossingPoint: LayoutVec2,
	allocator: NodingIdAllocator
): NodingPlan {
	const [firstId, secondId] = wallIds;
	const first = document.walls.find((wall) => wall.id === firstId);
	const second = document.walls.find((wall) => wall.id === secondId);
	if (!first || !second) {
		return rejected({
			code: 'unknown_wall',
			message: `Unknown wall in crossing plan: ${!first ? firstId : secondId}`,
			wallId: !first ? firstId : secondId
		});
	}

	const orderedIds = [firstId, secondId].sort((a, b) => a.localeCompare(b)) as [string, string];
	// Deterministic seed from the stable Wall-ID order, not input order (H3
	// §9.2): identical crossings plan identical IDs regardless of call order.
	const junctionId = allocator.nextJunctionId(
		document,
		`${orderedIds[0]}-${orderedIds[1]}-crossing`
	);

	// Split both walls against the same junction. The first split introduces
	// the junction; the second reuses it via existingJunctionId.
	const firstSplit = planWallSplitWithPoint(
		document,
		orderedIds[0]!,
		distanceTo(document, orderedIds[0]!, crossingPoint),
		crossingPoint,
		allocator,
		{ existingJunctionId: junctionId }
	);
	if (firstSplit.kind === 'rejected') return firstSplit;

	const secondSplit = planWallSplitWithPoint(
		firstSplit.document,
		orderedIds[1]!,
		distanceTo(firstSplit.document, orderedIds[1]!, crossingPoint),
		crossingPoint,
		allocator,
		{ existingJunctionId: junctionId }
	);
	if (secondSplit.kind === 'rejected') return secondSplit;

	return {
		kind: 'success',
		document: secondSplit.document,
		junctionId,
		createdWallIds: [...firstSplit.createdWallIds, ...secondSplit.createdWallIds],
		splitWallIds: [...firstSplit.splitWallIds, ...secondSplit.splitWallIds]
	};
}

function distanceTo(
	document: LayoutDocumentWallFirst,
	wallId: string,
	point: LayoutVec2
): number {
	const wall = document.walls.find((candidate) => candidate.id === wallId)!;
	const start = document.junctions.find((junction) => junction.id === wall.startJunctionId)!;
	return Math.hypot(point[0] - start.point[0], point[1] - start.point[1]);
}

/**
 * Opening rebasing classification (P23.8). Returns retained/moved opening
 * descriptors, or the offending opening ID when the split passes through an
 * interior.
 */
function rebaseOpenings(
	openings: readonly LayoutWallOpening[],
	wallId: string,
	splitDistance: number,
	wallLength: number
):
	| { retained: Array<{ id: string }>; moved: Array<{ id: string; offset: number }> }
	| string {
	const retained: Array<{ id: string }> = [];
	const moved: Array<{ id: string; offset: number }> = [];
	for (const opening of openings) {
		if (opening.wallId !== wallId) continue;
		const start = opening.offset;
		const end = opening.offset + opening.width;
		if (start + width(opening) <= splitDistance) {
			retained.push({ id: opening.id });
		} else if (start >= splitDistance) {
			moved.push({ id: opening.id, offset: start - splitDistance });
		} else {
			return opening.id;
		}
		// Exact end split: opening remains on the retained fragment — covered
		// by `end <= d` above. Exact start split: rebases to offset 0 —
		// covered by `start >= d` above.
	}
	void wallLength;
	return { retained, moved };
}

function width(opening: LayoutWallOpening): number {
	return opening.width;
}

function rewriteBoundaryForSplit(
	boundary: readonly OrientedWallRef[],
	wallId: string,
	newWallId: string
): OrientedWallRef[] {
	const rewritten: OrientedWallRef[] = [];
	for (const ref of boundary) {
		if (ref.wallId !== wallId) {
			rewritten.push(ref);
			continue;
		}
		if (ref.direction === 'forward') {
			rewritten.push({ wallId, direction: 'forward' });
			rewritten.push({ wallId: newWallId, direction: 'forward' });
		} else {
			rewritten.push({ wallId: newWallId, direction: 'reverse' });
			rewritten.push({ wallId, direction: 'reverse' });
		}
	}
	return rewritten;
}

function rejected(rejection: NodingRejection): NodingPlan {
	return { kind: 'rejected', rejection };
}

/** Room type re-export for planner consumers (avoids widening imports). */
export type { LayoutWallFirstRoom as NodingRoom };
