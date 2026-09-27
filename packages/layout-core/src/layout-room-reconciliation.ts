/**
 * `layout-room-reconciliation.ts` — P23.8 Room correspondence and
 * reconciliation (H5 evidence, product-owned identity).
 *
 * Geometry derives candidate faces; **this module owns persistent Room
 * identity** (H3/H5 hard boundary). Reconciliation runs per affected
 * correspondence component with the H5 evidence order:
 *
 * ```text
 * 1. explicit authoring-operation Wall/Junction lineage
 * 2. candidate-face boundary lineage
 * 3. predecessor/candidate overlap area
 * 4. predecessor interior witness (secondary tie signal only)
 * 5. canonical candidate face key
 * ```
 *
 * Safe automatic components for initial P23:
 *
 * ```text
 * 0 old Rooms → new independent candidate faces (Room birth)
 * 1 old Room  → 1 candidate   (preserved / subdivision 1→1)
 * 1 old Room  → 2 candidates  (simple split)
 * 2 old Rooms → 1 candidate   (simple merge)
 * ```
 *
 * Anything else — `2→3`, `3+→1`, simultaneous split+merge, multiple plausible
 * predecessor assignments, ambiguous lineage — rejects the whole command
 * before state installation. One user operation may contain several
 * independent safe components; every component must reconcile or the entire
 * command rejects.
 *
 * Transaction shape (P23.8): invalid/cancel/no-op → no history. A committed
 * snapshot contains the exact new Junction/Wall/Opening/Room IDs; undo/redo
 * restores snapshots and never reruns matching.
 */
import type {
	LayoutDocumentWallFirst,
	LayoutWallFirstRoom,
	LayoutWallOpening,
	OrientedWallRef
} from './layout-wall-first-types';
import type { LayoutVec2 } from './layout-types';
import { wallCenterlineSamples } from './layout-wall-centerline';
import { topologyComponentKeyByWallId } from './layout-topology-components';
import {
	type DerivedCandidateFace,
	type FaceExtractionResult,
	faceArea,
	ON_RING_TOLERANCE,
	polygonIntersectionArea,
	polygonsShareInteriorArea,
	pointStrictlyInsidePolygon
} from './layout-face-extraction';

/** Why reconciliation rejected; stable machine codes per P23.8 diagnostics. */
export type ReconciliationRejection = {
	code:
		| 'ambiguous_room_correspondence'
		| 'unsupported_component'
		| 'metadata_merge_conflict'
		| 'unresolved_portal_remap'
		| 'unresolved_room_reference';
	message: string;
	faceKey?: string;
	roomIds?: string[];
};

export type RoomLineageRecord = {
	faceKey: string;
	roomId: string;
	predecessorRoomIds: readonly string[];
	kind: 'preserved' | 'split-survivor' | 'merge-survivor' | 'created';
};

export type RoomReconciliation = {
	document: LayoutDocumentWallFirst;
	lineage: readonly RoomLineageRecord[];
	retiredRoomIds: readonly string[];
};

export type ReconciliationFailure = {
	kind: 'rejected';
	rejection: ReconciliationRejection;
};

export type ReconciliationResult = RoomReconciliation | ReconciliationFailure;

/**
 * Declared lineage for one topology-changing operation: which candidate
 * faces descend from which predecessor rooms. Derived from the operation's
 * wall/junction lineage (never from face traversal or room count).
 */
export type ComponentLineage = {
	/** Candidate face keys claimed by this component. */
	candidateFaceKeys: readonly string[];
	/** Predecessor room IDs involved in this component (may be empty for births). */
	predecessorRoomIds: readonly string[];
};

/** Deterministic allocator for new Room IDs/names against the complete candidate document. */
export type RoomIdAllocator = {
	nextRoomId(baseDocument: LayoutDocumentWallFirst, faceKey: string): string;
	/** Deterministic default room name; `existingNames` holds all taken names. */
	nextRoomName(existingNames: readonly string[]): string;
};

/** Current Room creation defaults (P23.8: 0.1 m floor/ceiling). */
export const ROOM_CREATION_DEFAULTS = {
	floorThickness: 0.1,
	ceilingThickness: 0.1
} as const;

/**
 * Predecessor Room boundary as an ordered X/Z polygon, resolved against a
 * complete document (P23.6: shared with the wall role-change planner, which
 * runs the same correspondence as the chain engine). `null` when the
 * boundary is unresolvable — callers reject rather than guess. Curved Walls
 * contribute their oriented sampled centerline, matching candidate faces.
 */
export function roomBoundaryPolygon(
	document: LayoutDocumentWallFirst,
	roomId: string
): readonly LayoutVec2[] | null {
	const room = document.rooms.find((candidate) => candidate.id === roomId);
	if (!room || room.boundary.length < 3) return null;
	const junctionById = new Map(document.junctions.map((junction) => [junction.id, junction]));
	const wallById = new Map(document.walls.map((wall) => [wall.id, wall]));
	const polygon: LayoutVec2[] = [];
	for (const ref of room.boundary) {
		const wall = wallById.get(ref.wallId);
		if (!wall) return null;
		const start = junctionById.get(ref.direction === 'forward' ? wall.startJunctionId : wall.endJunctionId);
		const end = junctionById.get(ref.direction === 'forward' ? wall.endJunctionId : wall.startJunctionId);
		if (!start || !end) return null;
		polygon.push([...start.point] as LayoutVec2);
		if (wall.centerline.kind === 'line') continue;
		const canonicalStart = junctionById.get(wall.startJunctionId)?.point;
		const canonicalEnd = junctionById.get(wall.endJunctionId)?.point;
		if (!canonicalStart || !canonicalEnd) return null;
		const sampled = wallCenterlineSamples(
			wall,
			canonicalStart,
			canonicalEnd,
			ref.direction
		);
		if (!sampled) return null;
		for (const sample of sampled.samples.slice(1, -1)) {
			polygon.push([...sample.point] as LayoutVec2);
		}
	}
	return polygon;
}

/**
 * Deterministic interior witness for a predecessor room. The raw centroid can
 * land exactly ON a candidate divider (symmetric splits), where strict
 * containment is false for both faces and the correspondence degenerates.
 * Nudge by an infinitesimal diagonal from the centroid toward the polygon's
 * first vertex — order-independent enough for correspondence, and only used
 * as evidence (never persisted).
 */
export function interiorWitness(polygon: readonly LayoutVec2[]): LayoutVec2 {
	const centroid = polygonCentroid(polygon);
	for (const epsilon of [1e-9, 1e-7, 1e-5, 1e-3]) {
		for (const [dx, dz] of [
			[epsilon, epsilon],
			[-epsilon, epsilon],
			[epsilon, -epsilon],
			[-epsilon, -epsilon]
		] as const) {
			const candidate: LayoutVec2 = [centroid[0] + dx, centroid[1] + dz];
			if (pointStrictlyInsidePolygon(polygon, candidate)) return candidate;
		}
	}
	return centroid;
}

/** Signed-area polygon centroid (falls back to the vertex mean when degenerate). */
function polygonCentroid(points: readonly LayoutVec2[]): LayoutVec2 {
	let twiceArea = 0;
	let x = 0;
	let z = 0;
	for (let index = 0; index < points.length; index += 1) {
		const current = points[index]!;
		const next = points[(index + 1) % points.length]!;
		const cross = current[0] * next[1] - next[0] * current[1];
		twiceArea += cross;
		x += (current[0] + next[0]) * cross;
		z += (current[1] + next[1]) * cross;
	}
	if (Math.abs(twiceArea) <= 1e-12) {
		return [
			points.reduce((sum, point) => sum + point[0], 0) / points.length,
			points.reduce((sum, point) => sum + point[1], 0) / points.length
		];
	}
	return [x / (3 * twiceArea), z / (3 * twiceArea)];
}

/**
 * Identity authority for correspondence unions (P23B.3a D-12).
 *
 * A predecessor Room's key comes from its SURVIVING boundary Walls in the
 * candidate document; a candidate face's key comes from its own boundary Walls.
 * Component labels are the general Wall/Junction connectivity test's, so this
 * authority is explicit authored identity — never coordinates, never area.
 */
export type CorrespondenceAuthorization = {
	faceComponentKeyByKey: ReadonlyMap<string, string>;
	predecessorComponentKeyByRoomId: ReadonlyMap<string, string>;
};

/**
 * Derive the D-12 authorization for one reconciliation pass.
 *
 * A PREDECESSOR Room with no resolvable component (the operation removed every
 * Wall its boundary referenced, so no authored identity survives) is left
 * UNDEFINED. Where BOTH sides resolve, the component labels must MATCH for a
 * union to be authorized at all.
 *
 * A CANDIDATE FACE extracted from the candidate Wall graph always resolves:
 * `topologyComponentKeyByWallId` labels every Wall in the document, and an
 * extracted face's boundary references that same document's Walls. So the
 * undefined-face case below exists only for a caller that hands faces which do
 * not belong to `candidateDocument` (the geometric callers never do); the
 * ordinary asymmetric case is an undefined PREDECESSOR beside a resolved face.
 */
export function correspondenceAuthorization(options: {
	baselineRooms: readonly LayoutWallFirstRoom[];
	candidateDocument: Pick<LayoutDocumentWallFirst, 'walls' | 'junctions'>;
	faces: readonly DerivedCandidateFace[];
}): CorrespondenceAuthorization {
	const keyByWallId = topologyComponentKeyByWallId(options.candidateDocument);
	const faceComponentKeyByKey = new Map<string, string>();
	for (const face of options.faces) {
		for (const ref of face.boundary) {
			const key = keyByWallId.get(ref.wallId);
			if (key !== undefined) {
				faceComponentKeyByKey.set(face.key, key);
				break;
			}
		}
	}
	const predecessorComponentKeyByRoomId = new Map<string, string>();
	for (const room of options.baselineRooms) {
		for (const ref of room.boundary) {
			const key = keyByWallId.get(ref.wallId);
			if (key !== undefined) {
				predecessorComponentKeyByRoomId.set(room.id, key);
				break;
			}
		}
	}
	return { faceComponentKeyByKey, predecessorComponentKeyByRoomId };
}

/**
 * May this predecessor Room and this candidate face be unioned by EVIDENCE?
 *
 * THE CONTRACT (P23B.3a D-12 — a POSITIVE identity match or nothing):
 *
 * 1. BOTH sides resolve -> the component labels must MATCH. This is the rule that
 *    keeps two coincident or contained graph-independent Rooms apart.
 * 2. NEITHER side resolves -> geometry is the only evidence that exists, so it
 *    decides. This is a DEFENSIVE branch, not a path a shipped planner travels:
 *    a candidate face extracted from the candidate Wall graph always resolves
 *    (see `correspondenceAuthorization`), so "neither side" requires faces that do
 *    not belong to the candidate document. The predicate stays total rather than
 *    silently reversing for that malformed input.
 * 3. EXACTLY ONE side resolves -> DENIED. No match can be established, and
 *    geometry alone must never union an attributed structure with an
 *    unattributed one: without this, a Room that lost its own boundary identity
 *    could be handed an unrelated overlapping Room's face — and, symmetrically,
 *    a surviving Room could claim an identity-less structure that is not its
 *    successor merely because the two overlap. This is the branch a Room whose
 *    whole boundary disappeared actually takes (`planRemoveRoom`), and the
 *    documented outcome there is retirement of that Room (its enclosure is gone),
 *    never a merge into the unrelated Room it happened to overlap.
 */
function unionAuthorized(
	authorization: CorrespondenceAuthorization,
	predecessorRoomId: string,
	faceKey: string
): boolean {
	const predecessorKey = authorization.predecessorComponentKeyByRoomId.get(predecessorRoomId);
	const faceKeyValue = authorization.faceComponentKeyByKey.get(faceKey);
	if (predecessorKey === undefined && faceKeyValue === undefined) return true;
	if (predecessorKey === undefined || faceKeyValue === undefined) return false;
	return predecessorKey === faceKeyValue;
}

/**
 * P23B.11 S3 (M-1b) — the coarse phase's own slack.
 *
 * M-1b prunes a pair only when BOTH merge conditions are PROVEN impossible, and
 * each impossibility is proved by the exact predicate it removes:
 *
 * ```text
 * inside impossible   `pointStrictlyInsidePolygon` is a plain even-odd cast, so a
 *                     point outside the face's INFLATED box can never be counted
 *                     inside it (every crossing it counts needs an edge to the
 *                     point's right and to the point's vertical side);
 * overlap impossible  `polygonsShareInteriorArea` returns true only through a
 *                     probe, an ear-triangle interior point, or a proper edge
 *                     crossing — and every one of those is a point inside BOTH
 *                     polygons' closed boxes (the probes are points OF one
 *                     polygon). Two boxes farther apart than the slack therefore
 *                     admit no shared point at all.
 * ```
 *
 * `ON_RING_TOLERANCE` is the predicates' own slack (one owner, imported — never a
 * second copy), and the relative term covers a few thousand ulps of the pair's
 * own size so the crossing arithmetic's rounding can never reach past the box.
 * A pair whose boxes are undefined (non-finite or empty geometry) is NEVER pruned,
 * and a pair whose gap is inside the slack is never pruned either: the pruning can
 * only remove pairs the exact predicates refuse, which is the property OR-2
 * tests with touching, collinear, zero-area, tolerance-boundary and non-finite
 * rows.
 */
const CORRESPONDENCE_BOUNDS_RELATIVE_SLACK = 1e-12;

type CorrespondenceBounds = { minX: number; maxX: number; minZ: number; maxZ: number };

/** `null` when any coordinate is non-finite or the polygon is empty: never pruned. */
function correspondenceBounds(polygon: readonly LayoutVec2[]): CorrespondenceBounds | null {
	let minX = Infinity;
	let maxX = -Infinity;
	let minZ = Infinity;
	let maxZ = -Infinity;
	for (const point of polygon) {
		if (!Number.isFinite(point[0]) || !Number.isFinite(point[1])) return null;
		if (point[0] < minX) minX = point[0];
		if (point[0] > maxX) maxX = point[0];
		if (point[1] < minZ) minZ = point[1];
		if (point[1] > maxZ) maxZ = point[1];
	}
	if (!(maxX >= minX && maxZ >= minZ)) return null;
	return { minX, maxX, minZ, maxZ };
}

function correspondenceBoundsSlack(bounds: CorrespondenceBounds): number {
	const extent = Math.max(bounds.maxX - bounds.minX, bounds.maxZ - bounds.minZ);
	return ON_RING_TOLERANCE + extent * CORRESPONDENCE_BOUNDS_RELATIVE_SLACK;
}

/** True only when NO point the inflated box contains can be strictly inside the face. */
function pointProvablyOutsideBounds(bounds: CorrespondenceBounds, point: LayoutVec2): boolean {
	if (!Number.isFinite(point[0]) || !Number.isFinite(point[1])) return false;
	const slack = correspondenceBoundsSlack(bounds);
	return (
		point[0] < bounds.minX - slack ||
		point[0] > bounds.maxX + slack ||
		point[1] < bounds.minZ - slack ||
		point[1] > bounds.maxZ + slack
	);
}

/** True only when the two inflated boxes are disjoint, so no shared point exists. */
function boundsProvablyDisjoint(a: CorrespondenceBounds, b: CorrespondenceBounds): boolean {
	const slack = correspondenceBoundsSlack(a) + correspondenceBoundsSlack(b);
	return (
		a.maxX + slack < b.minX ||
		b.maxX + slack < a.minX ||
		a.maxZ + slack < b.minZ ||
		b.maxZ + slack < a.minZ
	);
}

/**
 * P23B.11 S3 (OR-6) — the pair classes the observer counts.
 *
 * `undefined` covers both D-12 branches in which a label is missing: the
 * one-sided denial AND the defensive neither-resolves branch that hands the
 * decision to geometry. The class a pair is in never changes the verdict — it is
 * `unionAuthorized`'s own label comparison, read for counting only.
 */
export type CorrespondencePairClass = 'same-group' | 'cross-group' | 'undefined';

/**
 * P23B.11 S3 — one `buildCorrespondenceComponents` pass, as the test-only observer
 * sees it (P23B.4 observer precedent: opt-in, never retains, unset changes
 * nothing at all).
 *
 * ACCOUNTING, per mode:
 *
 * ```text
 * short-circuit  pairs = authorizationSkips + absentEvidenceSkips + boundsSkips
 *                       + insideCalls + insideSkipsByBounds
 *                (every pair is accounted exactly once: denied by identity, skipped
 *                 for absent evidence, pruned by the inflated boxes, skipped only
 *                 for the containment CALL, or VISITED by the containment step);
 *                insideCalls + insideSkipsByBounds = insideDecisions + overlapCalls
 *                (each pair that reached containment either decided the merge — and
 *                 never paid the overlap predicate — or fell through to it, as did
 *                 every pair whose containment CALL was bounds-skipped);
 *                insideDecisions <= insideCalls,
 * exhaustive     insideCalls = overlapCalls = pairs, both predicate STEPS run for
 *                 every pair exactly as the pre-M-1 loop did, and every skip
 *                 counter is zero — this is OR-2's comparison side, not a shipped
 *                 path. `insideDecisions`/`overlapDecisions` record the predicates'
 *                 own ADMISSIONS here (a pair inside-or-overlapping BEYOND the
 *                 authorization test this order runs afterwards), which is what
 *                 makes a D-12 denial checkable: geometry admits, identity denies.
 * ```
 *
 * "CALL" IS A PAIR VISIT TO THE STEP: the step's own guard (`witness !== undefined` /
 * `polygon !== undefined`) may have no evidence to hand the predicate, and today's
 * loop visits such a pair too — the visit is what the frozen `insideEvaluations`
 * counts, so both sides count the same thing.
 *
 * A cross-group pair therefore contributes NO geometry call in short-circuit mode,
 * which is OR-6's deterministic assertion: the group check is unconditional, so
 * the number is zero for EVERY operation, not only for the clear-gap case.
 */
export type CorrespondenceObservation = {
	/** The evaluation order this pass used. */
	mode: 'short-circuit' | 'exhaustive';
	pairs: number;
	sameGroupPairs: number;
	crossGroupPairs: number;
	undefinedPairs: number;
	/** (a) pairs denied by `unionAuthorized` before any geometry. */
	authorizationSkips: number;
	/**
	 * (b0) pairs with NEITHER piece of evidence (no witness and no polygon): both
	 * conditions are false by definition, so today's exhaustive loop walks them and
	 * discards them — the skip saves the walk, never a verdict.
	 */
	absentEvidenceSkips: number;
	/** (b) pairs pruned by the inflated boxes: BOTH conditions proven impossible. */
	boundsSkips: number;
	/**
	 * Pairs that passed (b) with `inside` PROVEN false from the witness's own box, so
	 * the strict-containment predicate was not called and they went straight to the
	 * overlap predicate. A call saving, never a verdict change.
	 */
	insideSkipsByBounds: number;
	insideCalls: number;
	insideCallsSameGroup: number;
	insideCallsCrossGroup: number;
	insideCallsUndefined: number;
	/**
	 * Pairs the containment predicate ADMITTED: in short-circuit mode that IS the
	 * union (c), with the overlap predicate skipped; in exhaustive mode it is the
	 * predicate's own result, recorded before the authorization test that today's
	 * order runs next.
	 */
	insideDecisions: number;
	overlapCalls: number;
	overlapCallsSameGroup: number;
	overlapCallsCrossGroup: number;
	overlapCallsUndefined: number;
	/**
	 * Pairs the overlap predicate ADMITTED — the union in short-circuit mode, the
	 * admission alone in exhaustive mode (see `insideDecisions`).
	 */
	overlapDecisions: number;
};

let correspondenceObserverForTest: ((observation: CorrespondenceObservation) => void) | undefined;
let correspondenceShortCircuitsDisabledForTest = false;

/** Report every correspondence pass to `observer` until cleared. Unset is zero change. */
export function setCorrespondenceObserverForTest(
	observer: ((observation: CorrespondenceObservation) => void) | undefined
): void {
	correspondenceObserverForTest = observer;
}

export function clearCorrespondenceObserverForTest(): void {
	correspondenceObserverForTest = undefined;
}

/**
 * OR-2's exhaustive side: while disabled, `buildCorrespondenceComponents` runs the
 * PRE-M-1 loop verbatim — both predicates for every pair, geometry before
 * authorization, no pruning — so the differential always has today's evaluation
 * order to compare against. Test-only; never set in production.
 */
export function disableCorrespondenceShortCircuitsForTest(disabled: boolean): void {
	correspondenceShortCircuitsDisabledForTest = disabled;
}

function emptyCorrespondenceObservation(
	mode: CorrespondenceObservation['mode']
): CorrespondenceObservation {
	return {
		mode,
		pairs: 0,
		sameGroupPairs: 0,
		crossGroupPairs: 0,
		undefinedPairs: 0,
		authorizationSkips: 0,
		absentEvidenceSkips: 0,
		boundsSkips: 0,
		insideSkipsByBounds: 0,
		insideCalls: 0,
		insideCallsSameGroup: 0,
		insideCallsCrossGroup: 0,
		insideCallsUndefined: 0,
		insideDecisions: 0,
		overlapCalls: 0,
		overlapCallsSameGroup: 0,
		overlapCallsCrossGroup: 0,
		overlapCallsUndefined: 0,
		overlapDecisions: 0
	};
}

/** The pair's D-12 class as `unionAuthorized` reads it; counting only. */
function correspondencePairClassOf(
	authorization: CorrespondenceAuthorization,
	predecessorRoomId: string,
	faceKey: string
): CorrespondencePairClass {
	const predecessorKey = authorization.predecessorComponentKeyByRoomId.get(predecessorRoomId);
	const faceKeyValue = authorization.faceComponentKeyByKey.get(faceKey);
	if (predecessorKey === undefined || faceKeyValue === undefined) return 'undefined';
	return predecessorKey === faceKeyValue ? 'same-group' : 'cross-group';
}

function recordObservationPairClass(
	observation: CorrespondenceObservation,
	pairClass: CorrespondencePairClass
): void {
	observation.pairs += 1;
	if (pairClass === 'same-group') observation.sameGroupPairs += 1;
	else if (pairClass === 'cross-group') observation.crossGroupPairs += 1;
	else observation.undefinedPairs += 1;
}

function recordInsideCall(
	observation: CorrespondenceObservation,
	pairClass: CorrespondencePairClass
): void {
	observation.insideCalls += 1;
	if (pairClass === 'same-group') observation.insideCallsSameGroup += 1;
	else if (pairClass === 'cross-group') observation.insideCallsCrossGroup += 1;
	else observation.insideCallsUndefined += 1;
}

function recordOverlapCall(
	observation: CorrespondenceObservation,
	pairClass: CorrespondencePairClass
): void {
	observation.overlapCalls += 1;
	if (pairClass === 'same-group') observation.overlapCallsSameGroup += 1;
	else if (pairClass === 'cross-group') observation.overlapCallsCrossGroup += 1;
	else observation.overlapCallsUndefined += 1;
}

/**
 * True P23.8 correspondence components: connected components of the
 * bipartite predecessor-Room ↔ candidate-face graph. An edge exists when the
 * predecessor witness lies strictly inside the face or the predecessor
 * polygon overlaps the face with positive area — AND (P23B.3a D-12) the two
 * sides share a connected component of authored Wall identity, so geometry
 * alone can never union two graph-independent structures. Faces with no
 * predecessor form independent 0→1 birth components. Groups are sorted
 * deterministically by their smallest face key.
 */
export function buildCorrespondenceComponents(options: {
	faces: readonly DerivedCandidateFace[];
	predecessorRoomIds: readonly string[];
	predecessorWitnesses: ReadonlyMap<string, LayoutVec2>;
	predecessorPolygons: ReadonlyMap<string, readonly LayoutVec2[]>;
	/**
	 * CANDIDATE Wall/Junction graph — the identity authority for AUTHORIZED
	 * unions (P23B.3a D-12). Required: there is deliberately no way to build
	 * correspondence from geometry alone, because spatial overlap must never be
	 * able to union two graph-independent structures on its own.
	 */
	candidateDocument: Pick<LayoutDocumentWallFirst, 'walls' | 'junctions'>;
	/** Predecessor Rooms whose surviving boundary Walls anchor their identity. */
	baselineRooms: readonly LayoutWallFirstRoom[];
}): ComponentLineage[] {
	const { faces, predecessorRoomIds, predecessorWitnesses, predecessorPolygons } = options;
	const authorization = correspondenceAuthorization({
		baselineRooms: options.baselineRooms,
		candidateDocument: options.candidateDocument,
		faces
	});
	const faceCount = faces.length;
	const predecessorCount = predecessorRoomIds.length;
	const parent = Array.from({ length: predecessorCount + faceCount }, (_, index) => index);
	const find = (value: number): number => {
		let root = value;
		while (parent[root] !== root) root = parent[root]!;
		while (parent[value] !== root) {
			const next = parent[value]!;
			parent[value] = root;
			value = next;
		}
		return root;
	};
	const union = (a: number, b: number): void => {
		const rootA = find(a);
		const rootB = find(b);
		if (rootA !== rootB) parent[rootB] = rootA;
	};
	const exhaustive = correspondenceShortCircuitsDisabledForTest;
	const observation = emptyCorrespondenceObservation(exhaustive ? 'exhaustive' : 'short-circuit');
	// M-1(b): the coarse phase's boxes, computed ONCE per pass — never per pair — and
	// only while the short-circuits are live: the exhaustive path is today's loop
	// verbatim and neither pays for nor reads them.
	const faceBoxes = exhaustive ? [] : faces.map((face) => correspondenceBounds(face.polygon));
	const predecessorBoxes = exhaustive
		? []
		: predecessorRoomIds.map((roomId) => {
				const polygon = predecessorPolygons.get(roomId);
				return polygon === undefined ? null : correspondenceBounds(polygon);
			});
	faces.forEach((face, faceIndex) => {
		const faceBox = faceBoxes[faceIndex] ?? null;
		predecessorRoomIds.forEach((roomId, predIndex) => {
			const witness = predecessorWitnesses.get(roomId);
			const polygon = predecessorPolygons.get(roomId);
			// Read-only classification: exactly the label comparison `unionAuthorized`
			// makes, counted so OR-6 can assert what each class costs in geometry.
			const pairClass = correspondencePairClassOf(authorization, roomId, face.key);
			recordObservationPairClass(observation, pairClass);
			if (exhaustive) {
				// THE PRE-M-1 LOOP, VERBATIM (OR-2's comparison side): both predicate
				// steps for EVERY pair, geometry before authorization, no skip at all.
				recordInsideCall(observation, pairClass);
				const inside = witness !== undefined && pointStrictlyInsidePolygon(face.polygon, witness);
				// Exact adjacency-aware overlap: Rooms that merely share a Wall (any
				// angle) are neighbours, never one component. The sampled
				// `polygonIntersectionArea` (still used below for survivor ranking)
				// reported a phantom sliver for oblique shared edges.
				recordOverlapCall(observation, pairClass);
				const overlap = polygon !== undefined && polygonsShareInteriorArea(polygon, face.polygon);
				// The predicates' own ADMISSION, recorded in this mode too so the two
				// sides of OR-2 compare like with like: today's loop unions only after
				// the authorization test below, so an admission here is not yet a union.
				if (inside) observation.insideDecisions += 1;
				else if (overlap) observation.overlapDecisions += 1;
				if (!inside && !overlap) return;
				// P23B.3a D-12 — AUTHORIZATION. Geometry is evidence, not permission: a
				// predecessor Room and a candidate face may join only when authored
				// identity puts them in the SAME connected component of the candidate Wall
				// graph. Two coincident or contained graph-INDEPENDENT Rooms therefore stay
				// two correspondence components, so overlap alone can never merge, retire or
				// reassign an unrelated Room's identity or its owned objects.
				if (!unionAuthorized(authorization, roomId, face.key)) return;
				union(predIndex, predecessorCount + faceIndex);
				return;
			}
			// M-1(a) GROUP CHECK FIRST. `unionAuthorized` is a pure component-label
			// comparison — the same decision the exhaustive loop reaches only after
			// paying for the geometry — so a pair it refuses is skipped before any
			// geometric work. Unconditional: this is why OR-6's cross-group count is
			// zero for EVERY operation, not only for the clear-gap case.
			if (!unionAuthorized(authorization, roomId, face.key)) {
				observation.authorizationSkips += 1;
				return;
			}
			// M-1(b) THE COARSE PHASE. Skip only a pair whose merge gate is PROVEN
			// closed: neither piece of evidence exists (both conditions are false by
			// definition), or the inflated boxes cannot hold the one point either
			// condition needs. Each skip is proved by the predicate it removes: an
			// even-odd cast cannot count a point outside the face's box, and every
			// overlap witness is a shared point, so it lies in both boxes.
			const insideImpossible =
				witness === undefined || (faceBox !== null && pointProvablyOutsideBounds(faceBox, witness));
			const polygonBox = predecessorBoxes[predIndex] ?? null;
			const overlapImpossible =
				polygon === undefined ||
				(faceBox !== null && polygonBox !== null && boundsProvablyDisjoint(polygonBox, faceBox));
			if (insideImpossible && overlapImpossible) {
				if (witness === undefined && polygon === undefined) observation.absentEvidenceSkips += 1;
				else observation.boundsSkips += 1;
				return;
			}
			// M-1(c) INSIDE, THEN OVERLAP ONLY IF NEEDED. The merge gate is
			// `inside || overlap`, so an `inside` that decides the pair ends it, and the
			// containment CALL is itself skipped when the witness's own box proves it
			// cannot be strictly inside the face. Same gate, same verdict, less work.
			let inside = false;
			if (
				witness !== undefined &&
				faceBox !== null &&
				pointProvablyOutsideBounds(faceBox, witness)
			) {
				observation.insideSkipsByBounds += 1;
			} else {
				recordInsideCall(observation, pairClass);
				inside = witness !== undefined && pointStrictlyInsidePolygon(face.polygon, witness);
			}
			if (inside) {
				observation.insideDecisions += 1;
				union(predIndex, predecessorCount + faceIndex);
				return;
			}
			recordOverlapCall(observation, pairClass);
			// M-1(d): the overlap predicate itself is UNCHANGED.
			const overlap = polygon !== undefined && polygonsShareInteriorArea(polygon, face.polygon);
			if (!overlap) return;
			// Authorization was granted at (a): geometry is the evidence, identity the
			// permission. The exhaustive branch above still asks `unionAuthorized` here.
			observation.overlapDecisions += 1;
			union(predIndex, predecessorCount + faceIndex);
		});
	});
	// OR-6: the pass is over — report it ONCE, to a test-only observer if one is set.
	correspondenceObserverForTest?.(observation);
	const groups = new Map<number, { faces: string[]; predecessors: string[] }>();
	faces.forEach((face, faceIndex) => {
		const root = find(predecessorCount + faceIndex);
		let group = groups.get(root);
		if (!group) {
			group = { faces: [], predecessors: [] };
			groups.set(root, group);
		}
		group.faces.push(face.key);
	});
	predecessorRoomIds.forEach((roomId, predIndex) => {
		const root = find(predIndex);
		const group = groups.get(root);
		if (!group) return;
		group.predecessors.push(roomId);
	});
	return [...groups.values()]
		.map((group) => ({
			candidateFaceKeys: [...group.faces].sort(),
			predecessorRoomIds: [...group.predecessors].sort()
		}))
		.sort((a, b) => (a.candidateFaceKeys[0]! < b.candidateFaceKeys[0]! ? -1 : 1));
}

/**
 * Reconcile candidate faces against predecessor rooms for one topology
 * operation. `baseline` is the pre-operation document (its rooms are the
 * predecessor rooms); `extraction` is the candidate face output.
 */
export function reconcileRooms(options: {
	baseline: LayoutDocumentWallFirst;
	candidateDocument: Omit<LayoutDocumentWallFirst, 'rooms'>;
	extraction: FaceExtractionResult;
	/** Declared lineage components for this operation. */
	components: readonly ComponentLineage[];
	/** Pre-operation room polygon witnesses by roomId (temporary, never persisted). */
	predecessorWitnesses?: ReadonlyMap<string, LayoutVec2>;
	/** Predecessor boundary polygons by roomId (temporary overlap evidence). */
	predecessorPolygons?: ReadonlyMap<string, readonly LayoutVec2[]>;
	allocator: RoomIdAllocator;
}): ReconciliationResult {
	const { baseline, candidateDocument, extraction, components, allocator } = options;
	const predecessorWitnesses = options.predecessorWitnesses ?? new Map<string, LayoutVec2>();
	const predecessorPolygons =
		options.predecessorPolygons ?? new Map<string, readonly LayoutVec2[]>();
	const predecessorRooms = new Map(baseline.rooms.map((room) => [room.id, room]));
	const facesByKey = new Map(extraction.faces.map((face) => [face.key, face]));

	const claimedFaces = new Set<string>();
	const claimedPredecessors = new Set<string>();
	const lineage: RoomLineageRecord[] = [];
	const retiredRoomIds: string[] = [];
	const finalRooms: LayoutWallFirstRoom[] = [];
	// Baseline names seed the allocator namespace (review round 1): births
	// during multi-component operations must never reuse a pre-existing name.
	const takenNames = new Set(baseline.rooms.map((room) => room.name));

	for (const component of components) {
		for (const faceKey of component.candidateFaceKeys) {
			if (!facesByKey.has(faceKey)) {
				return failure({
					code: 'unsupported_component',
					message: `Component claims unknown candidate face '${faceKey}'`
				});
			}
			if (claimedFaces.has(faceKey)) {
				return failure({
					code: 'ambiguous_room_correspondence',
					message: `Candidate face '${faceKey}' is claimed by multiple components`,
					faceKey
				});
			}
			claimedFaces.add(faceKey);
		}
		for (const predecessorId of component.predecessorRoomIds) {
			if (!predecessorRooms.has(predecessorId)) {
				return failure({
					code: 'unsupported_component',
					message: `Component references unknown predecessor room '${predecessorId}'`
				});
			}
			if (claimedPredecessors.has(predecessorId)) {
				return failure({
					code: 'ambiguous_room_correspondence',
					message: `Predecessor room '${predecessorId}' is claimed by multiple components`,
					roomIds: [predecessorId]
				});
			}
			claimedPredecessors.add(predecessorId);
		}
	}

	// Every candidate face must be claimed by exactly one component (review
	// round 1): an unclaimed face would otherwise silently vanish from the
	// correspondence — the mirror hazard of a double-claimed face.
	for (const face of extraction.faces) {
		if (!claimedFaces.has(face.key)) {
			return failure({
				code: 'unsupported_component',
				message: `Candidate face '${face.key}' is not claimed by any lineage component`,
				faceKey: face.key
			});
		}
	}

	for (const component of components) {
		const predecessorCount = component.predecessorRoomIds.length;
		const candidateCount = component.candidateFaceKeys.length;

		if (predecessorCount === 0 && candidateCount >= 1) {
			// Zero-predecessor birth. Prove each face has no predecessor in this
			// component (a failed match is not permission to create a Room).
			const sortedKeys = [...component.candidateFaceKeys].sort();
			for (const faceKey of sortedKeys) {
				const face = facesByKey.get(faceKey)!;
				const roomId = allocator.nextRoomId(
					{ ...candidateDocument, rooms: [...baseline.rooms, ...finalRooms] },
					faceKey
				);
				const name = allocator.nextRoomName([...takenNames]);
				takenNames.add(name);
				finalRooms.push({
					id: roomId,
					name,
					boundary: [...face.boundary],
					floorThickness: ROOM_CREATION_DEFAULTS.floorThickness,
					ceilingThickness: ROOM_CREATION_DEFAULTS.ceilingThickness
				});
				lineage.push({ faceKey, roomId, predecessorRoomIds: [], kind: 'created' });
			}
			continue;
		}

		if (predecessorCount === 1 && candidateCount === 1) {
			// 1→1 preservation: predecessor boundary lineage maps the
			// predecessor to exactly one candidate face.
			const predecessor = predecessorRooms.get(component.predecessorRoomIds[0]!)!;
			const face = facesByKey.get(component.candidateFaceKeys[0]!)!;
			finalRooms.push({
				...predecessor,
				boundary: [...face.boundary]
			});
			lineage.push({
				faceKey: face.key,
				roomId: predecessor.id,
				predecessorRoomIds: [predecessor.id],
				kind: 'preserved'
			});
			continue;
		}

		if (predecessorCount === 1 && candidateCount === 2) {
			const predecessor = predecessorRooms.get(component.predecessorRoomIds[0]!)!;
			const candidates = component.candidateFaceKeys.map((key) => facesByKey.get(key)!);
			const winner = chooseSplitSurvivor({
				predecessor,
				candidates,
				witness: predecessorWitnesses.get(predecessor.id),
				overlapPolygons: predecessorPolygons
			});
			if (!winner) {
				return failure({
					code: 'ambiguous_room_correspondence',
					message: `Split of room '${predecessor.id}' has no deterministic survivor`,
					roomIds: [predecessor.id]
				});
			}
			const loser = candidates.find((face) => face !== winner)!;
			const newRoomId = allocator.nextRoomId(
				{ ...candidateDocument, rooms: [...baseline.rooms, ...finalRooms] },
				loser.key
			);
			const newName = allocator.nextRoomName([...takenNames]);
			takenNames.add(newName);
			finalRooms.push({
				...predecessor,
				boundary: [...winner.boundary]
			});
			finalRooms.push({
				id: newRoomId,
				name: newName,
				boundary: [...loser.boundary],
				floorThickness: predecessor.floorThickness,
				ceilingThickness: predecessor.ceilingThickness
			});
			lineage.push({
				faceKey: winner.key,
				roomId: predecessor.id,
				predecessorRoomIds: [predecessor.id],
				kind: 'split-survivor'
			});
			lineage.push({
				faceKey: loser.key,
				roomId: newRoomId,
				predecessorRoomIds: [predecessor.id],
				kind: 'created'
			});
			continue;
		}

		if (predecessorCount === 2 && candidateCount === 1) {
			const face = facesByKey.get(component.candidateFaceKeys[0]!)!;
			const predecessors = component.predecessorRoomIds.map((id) => predecessorRooms.get(id)!);
			const winner = chooseMergeSurvivor({
				predecessors,
				face,
				overlapPolygons: predecessorPolygons
			});
			if (!winner) {
				return failure({
					code: 'ambiguous_room_correspondence',
					message: `Merge into face '${face.key}' has no deterministic survivor`,
					faceKey: face.key,
					roomIds: predecessors.map((room) => room.id)
				});
			}
			const retired = predecessors.find((room) => room.id !== winner.id)!;
			// Field-level metadata policy: conflicting authored surface fields
			// reject rather than silently choosing (H5 §6.4).
			if (predecessors[0]!.floorThickness !== predecessors[1]!.floorThickness) {
				return failure({
					code: 'metadata_merge_conflict',
					message: `Merged rooms disagree on floorThickness (${predecessors[0]!.id}: ${predecessors[0]!.floorThickness}, ${predecessors[1]!.id}: ${predecessors[1]!.floorThickness})`,
					roomIds: [predecessors[0]!.id, predecessors[1]!.id]
				});
			}
			if (predecessors[0]!.ceilingThickness !== predecessors[1]!.ceilingThickness) {
				return failure({
					code: 'metadata_merge_conflict',
					message: `Merged rooms disagree on ceilingThickness (${predecessors[0]!.id}: ${predecessors[0]!.ceilingThickness}, ${predecessors[1]!.id}: ${predecessors[1]!.ceilingThickness})`,
					roomIds: [predecessors[0]!.id, predecessors[1]!.id]
				});
			}
		finalRooms.push({
			...winner,
			boundary: [...face.boundary]
		});
		lineage.push({
			faceKey: face.key,
			roomId: winner.id,
				predecessorRoomIds: [predecessors[0]!.id, predecessors[1]!.id],
				kind: 'merge-survivor'
			});
			retiredRoomIds.push(retired.id);
			continue;
		}

		return failure({
			code: 'unsupported_component',
			message: `Unsupported correspondence component ${predecessorCount}→${candidateCount}`,
			roomIds: [...component.predecessorRoomIds]
		});
	}

	// --- room disappearance -------------------------------------------------
	const survivingPredecessors = new Set<string>();
	for (const component of components) {
		for (const id of component.predecessorRoomIds) survivingPredecessors.add(id);
	}
	for (const room of baseline.rooms) {
		if (!survivingPredecessors.has(room.id)) {
			retiredRoomIds.push(room.id);
		}
	}

	// --- layout-object semantic associations (P23.8) ------------------------
	const roomIdMap = new Map<string, string>();
	for (const record of lineage) {
		for (const predecessorId of record.predecessorRoomIds) {
			roomIdMap.set(predecessorId, record.roomId);
		}
	}
	const objects = candidateDocument.objects.map((object) => {
		if (!object.roomId) return object;
		if (retiredRoomIds.includes(object.roomId)) {
			// Association maps to the surviving room on merge; cleared on
			// disappearance. Transforms never change.
			const remapped = roomIdMap.get(object.roomId);
			return remapped ? { ...object, roomId: remapped } : { ...object, roomId: undefined };
		}
		return object;
	});

	// --- portal semantic remapping ------------------------------------------
	// Retired-room successors derive from lineage records only (merge
	// survivors); a disappeared room has no successor and its portal relation
	// is cleared rather than guessed.
	const successorOf = new Map<string, string>();
	for (const record of lineage) {
		for (const predecessorId of record.predecessorRoomIds) {
			if (retiredRoomIds.includes(predecessorId)) {
				successorOf.set(predecessorId, record.roomId);
			}
		}
	}
	// Split descendants derive from lineage records only as well: a 1→2
	// component emits one `split-survivor` (the predecessor ID) plus one
	// `created` record carrying the predecessor as its single lineage source.
	// The survivor is NOT retired, so a relation endpoint on it must still be
	// resolved through wall-side adjacency (P23.8 portal split rule) instead
	// of silently keeping the ID survivor.
	const splitDescendants = new Map<string, string[]>();
	for (const record of lineage) {
		const isSplitRecord =
			record.kind === 'split-survivor' ||
			(record.kind === 'created' && record.predecessorRoomIds.length === 1);
		if (!isSplitRecord) continue;
		for (const predecessorId of record.predecessorRoomIds) {
			const descendants = splitDescendants.get(predecessorId) ?? [];
			descendants.push(record.roomId);
			splitDescendants.set(predecessorId, descendants);
		}
	}
	const portalResult = remapPortalRelations({
		successorOf,
		retiredRoomIds,
		splitDescendants,
		rooms: finalRooms,
		openings: candidateDocument.openings
	});
	if (portalResult.kind === 'rejected') return portalResult;

	return {
		document: {
			...candidateDocument,
			rooms: finalRooms,
			objects: objects as LayoutDocumentWallFirst['objects'],
			openings: portalResult.openings
		},
		lineage,
		retiredRoomIds
	};
}

/** Greatest-overlap split survivor with witness and faceKey ties (H5 §6.2). */
function chooseSplitSurvivor(options: {
	predecessor: LayoutWallFirstRoom;
	candidates: DerivedCandidateFace[];
	witness: LayoutVec2 | undefined;
	overlapPolygons: ReadonlyMap<string, readonly LayoutVec2[]>;
}): DerivedCandidateFace | undefined {
	const { predecessor, candidates, witness } = options;
	if (candidates.length !== 2) return undefined;
	// Overlap requires the predecessor's polygon; derive it from its
	// boundary cycle when possible. With world-local candidate geometry the
	// predecessor polygon is the baseline face — supplied by the caller via
	// witness/overlap below. Here we rely on caller-provided overlap areas
	// computed against the baseline room boundary polygon.
	const overlaps = candidates.map((face) => ({
		face,
		area: predecessorPolygonOverlap(predecessor, face, options.overlapPolygons)
	}));
	const [first, second] = overlaps;
	if (!first || !second) return undefined;
	if (first.area > second.area) return first.face;
	if (second.area > first.area) return second.face;
	// Exact tie: witness strictly inside exactly one candidate.
	if (witness) {
		const inFirst = pointStrictlyInsidePolygon(first.face.polygon, witness);
		const inSecond = pointStrictlyInsidePolygon(second.face.polygon, witness);
		if (inFirst && !inSecond) return first.face;
		if (inSecond && !inFirst) return second.face;
	}
	// Otherwise smallest canonical faceKey survives.
	return first.face.key < second.face.key ? first.face : second.face;
}

/**
 * Predecessor/candidate overlap. The caller supplies baseline room polygons
 * through `predecessorPolygons`; when absent (no geometry overlap evidence
 * available) this returns 0 and the witness/faceKey ties decide — never
 * guessed geometry.
 */
function predecessorPolygonOverlap(
	predecessor: LayoutWallFirstRoom,
	face: DerivedCandidateFace,
	overlapPolygons: ReadonlyMap<string, readonly LayoutVec2[]>
): number {
	const polygon = overlapPolygons.get(predecessor.id);
	if (!polygon) return 0;
	return polygonIntersectionArea(polygon, face.polygon);
}

/** Greatest-contributor merge survivor with room-ID tie (H5 §6.4). */
function chooseMergeSurvivor(options: {
	predecessors: LayoutWallFirstRoom[];
	face: DerivedCandidateFace;
	overlapPolygons: ReadonlyMap<string, readonly LayoutVec2[]>;
}): LayoutWallFirstRoom | undefined {
	const { predecessors, face } = options;
	if (predecessors.length !== 2) return undefined;
	const areas = predecessors.map((room) => ({
		room,
		area: predecessorPolygonOverlap(room, face, options.overlapPolygons)
	}));
	const [first, second] = areas;
	if (!first || !second) return undefined;
	if (first.area > second.area) return first.room;
	if (second.area > first.area) return second.room;
	// Exact tie: stable existing Room ID lexical ordering.
	return first.room.id < second.room.id ? first.room : second.room;
}

/** Outcome of resolving one relation endpoint through the topology edit. */
type PortalSideResolution =
	| { kind: 'room'; roomId: string }
	| { kind: 'cleared' }
	| { kind: 'unresolved'; reason: string };

/**
 * Portal semantic remapping for topology edits (P23.8). New-schema doors on
 * boundary walls derive physical adjacency from the wall; the explicit
 * `connectsRoomIds` relation is remapped only when lineage makes the result
 * unambiguous, cleared on planned semantic collapse, and rejected otherwise.
 *
 * Split sides are resolved through **wall-side adjacency**: when a relation
 * endpoint is the predecessor of a 1→2 split, the successor is the descendant
 * whose reconciled boundary references the opening's hosting Wall — never
 * merely the descendant that kept the predecessor ID. Zero or multiple
 * adjacent descendants is an ambiguous remap and rejects the whole topology
 * edit (`unresolved_portal_remap`), per the P23.8 portal split rule.
 */
function remapPortalRelations(options: {
	successorOf: ReadonlyMap<string, string>;
	retiredRoomIds: readonly string[];
	/** Predecessor Room ID → descendant Room IDs of a 1→2 split component. */
	splitDescendants: ReadonlyMap<string, readonly string[]>;
	/** Reconciled surviving Rooms (boundaries already rewritten/reconciled). */
	rooms: readonly LayoutWallFirstRoom[];
	openings: readonly LayoutWallOpening[];
}): { kind: 'ok'; openings: LayoutWallOpening[] } | ReconciliationFailure {
	const { successorOf, retiredRoomIds, splitDescendants, rooms, openings } = options;
	if (retiredRoomIds.length === 0 && splitDescendants.size === 0) {
		return { kind: 'ok', openings: [...openings] };
	}
	const boundaryByRoomId = new Map(rooms.map((room) => [room.id, room.boundary]));
	const referencesWall = (roomId: string, wallId: string): boolean =>
		(boundaryByRoomId.get(roomId) ?? []).some((ref) => ref.wallId === wallId);

	/** Resolve one relation endpoint for one opening's hosting Wall. */
	const resolveSide = (roomId: string, hostWallId: string): PortalSideResolution => {
		const descendants = splitDescendants.get(roomId);
		if (descendants && descendants.length > 0) {
			if (descendants.length !== 2) {
				return {
					kind: 'unresolved',
					reason: `split of room '${roomId}' has ${descendants.length} descendants`
				};
			}
			const adjacent = descendants.filter((id) => referencesWall(id, hostWallId));
			if (adjacent.length !== 1) {
				return {
					kind: 'unresolved',
					reason:
						adjacent.length === 0
							? `no descendant of split room '${roomId}' is adjacent to the hosting wall '${hostWallId}'`
							: `descendants ${adjacent.join(', ')} of room '${roomId}' are both adjacent to the hosting wall '${hostWallId}'`
				};
			}
			return { kind: 'room', roomId: adjacent[0]! };
		}
		if (retiredRoomIds.includes(roomId)) {
			const successor = successorOf.get(roomId);
			return successor ? { kind: 'room', roomId: successor } : { kind: 'cleared' };
		}
		return { kind: 'room', roomId };
	};

	const remapped: LayoutWallOpening[] = [];
	for (const opening of openings) {
		const relation = opening.connectsRoomIds;
		if (!relation) {
			remapped.push(opening);
			continue;
		}
		const [a, b] = relation;
		const nextA = resolveSide(a, opening.wallId);
		const nextB = resolveSide(b, opening.wallId);
		const unresolved = [nextA, nextB].find((side) => side.kind === 'unresolved');
		if (unresolved && unresolved.kind === 'unresolved') {
			return failure({
				code: 'unresolved_portal_remap',
				message: `Opening '${opening.id}' portal relation cannot be remapped unambiguously (${unresolved.reason})`,
				roomIds: [a, b]
			});
		}
		const aCleared = nextA.kind !== 'room';
		const bCleared = nextB.kind !== 'room';
		if (aCleared && bCleared) {
			// Unambiguous disappearance clears the relation while preserving
			// the physical door (P23.8 portal disappearance rule).
			const cleared = { ...opening };
			delete (cleared as Partial<LayoutWallOpening>).connectsRoomIds;
			remapped.push(cleared as LayoutWallOpening);
			continue;
		}
		if (aCleared || bCleared) {
			// One side vanished while the other resolved: the surviving
			// semantic pairing is unknown → reject rather than guess.
			return failure({
				code: 'unresolved_portal_remap',
				message: `Opening '${opening.id}' relation has one unresolvable endpoint (${aCleared ? a : b} disappeared)`,
				roomIds: [a, b]
			});
		}
		const nextAId = (nextA as { kind: 'room'; roomId: string }).roomId;
		const nextBId = (nextB as { kind: 'room'; roomId: string }).roomId;
		if (nextAId === nextBId) {
			// Both tuple members collapsed into the same room: planned semantic
			// collapse, physical door preserved.
			const collapsed = { ...opening };
			delete (collapsed as Partial<LayoutWallOpening>).connectsRoomIds;
			remapped.push(collapsed as LayoutWallOpening);
			continue;
		}
		remapped.push({ ...opening, connectsRoomIds: [nextAId, nextBId] });
	}
	// Validate no unresolved relations to retired rooms remain.
	for (const opening of remapped) {
		const relation = opening.connectsRoomIds;
		if (!relation) continue;
		if (retiredRoomIds.includes(relation[0]) || retiredRoomIds.includes(relation[1])) {
			return failure({
				code: 'unresolved_portal_remap',
				message: `Opening '${opening.id}' retains a relation to retired room`,
				roomIds: [relation[0], relation[1]]
			});
		}
	}
	return { kind: 'ok', openings: remapped };
}

function failure(rejection: ReconciliationRejection): ReconciliationFailure {
	return { kind: 'rejected', rejection };
}

/**
 * Alias kept for call-site readability: reconciliation with explicit baseline
 * room polygons (temporary overlap evidence derived from pre-edit compiled
 * geometry; never persisted).
 */
export const reconcileRoomsWithGeometry = reconcileRooms;

/** Oriented wall refs helper used by tests/fixtures to build room boundaries. */
export function wallRef(wallId: string, direction: 'forward' | 'reverse'): OrientedWallRef {
	return { wallId, direction };
}
