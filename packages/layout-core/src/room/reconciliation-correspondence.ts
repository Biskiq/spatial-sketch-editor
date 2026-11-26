import type { LayoutDocumentWallFirst, LayoutWallFirstRoom } from '../wall/types';
import type { LayoutVec2 } from '../geometry/coordinates';
import { countWork } from '../kernel/work-observer';
import { topologyComponentKeyByWallId } from './topology-components';
import type { DerivedCandidateFace } from '../geometry/face-extraction';
import { ON_RING_TOLERANCE, canonicalBoundaryCycleKey, pointStrictlyInsidePolygon, polygonsShareInteriorArea } from '../geometry/face-extraction';
import { correspondencePairClassOf, emptyCorrespondenceObservation, recordInsideCall, recordObservationPairClass, recordOverlapCall, type CorrespondenceObserver } from './reconciliation-observation';
import type { ComponentLineage } from './reconciliation-types';

/**
 * Identity authority for correspondence unions.
 *
 * A predecessor Room's key comes from its SURVIVING boundary Walls in the
 * candidate document; a candidate face's key comes from its own boundary Walls.
 * Component labels are the general Wall/Junction connectivity test's, so this
 * authority is explicit authored identity — never coordinates, never area.
 */
export type CorrespondenceAuthorization = {
	faceComponentKeyByKey: ReadonlyMap<string, string>;
	/**
	 * Every component key of a predecessor's surviving boundary Walls. A Space
	 * whose opposite Walls were erased has Walls in two components; either one
	 * may authorize its closure (SP-plan F3).
	 */
	predecessorComponentKeysByRoomId: ReadonlyMap<string, ReadonlySet<string>>;
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
	const predecessorComponentKeysByRoomId = new Map<string, ReadonlySet<string>>();
	for (const room of options.baselineRooms) {
		const keys = new Set<string>();
		for (const ref of room.boundary) {
			const key = keyByWallId.get(ref.wallId);
			if (key !== undefined) keys.add(key);
		}
		if (keys.size > 0) predecessorComponentKeysByRoomId.set(room.id, keys);
	}
	return { faceComponentKeyByKey, predecessorComponentKeysByRoomId };
}


/**
 * May this predecessor Room and this candidate face be unioned by EVIDENCE?
 *
 * THE CONTRACT (D-12 — a POSITIVE identity match or nothing):
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
	const predecessorKeys = authorization.predecessorComponentKeysByRoomId.get(predecessorRoomId);
	const faceKeyValue = authorization.faceComponentKeyByKey.get(faceKey);
	if (predecessorKeys === undefined && faceKeyValue === undefined) return true;
	if (predecessorKeys === undefined || faceKeyValue === undefined) return false;
	return predecessorKeys.has(faceKeyValue);
}


/**
 * M-1b — the coarse phase's own slack.
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
 * The pair classes the observer counts.
 *
 * `undefined` covers both D-12 branches in which a label is missing: the
 * one-sided denial AND the defensive neither-resolves branch that hands the
 * decision to geometry. The class a pair is in never changes the verdict — it is
 * `unionAuthorized`'s own label comparison, read for counting only.
 */
export type CorrespondencePairClass = 'same-group' | 'cross-group' | 'undefined';


/**
 * True correspondence components: connected components of the
 * bipartite predecessor-Room ↔ candidate-face graph. An edge exists when the
 * predecessor witness lies strictly inside the face or the predecessor
 * polygon overlaps the face with positive area — AND the two
 * sides share a connected component of authored Wall identity, so geometry
 * alone can never union two graph-independent structures. Faces with no
 * predecessor form independent 0→1 birth components. Groups are sorted
 * deterministically by their smallest face key.
 *
 * SOUNDNESS PRECONDITION OF THE M-3 IDENTITY CONDITION (below): the condition
 * compares `canonicalBoundaryCycleKey`, which is built from Wall ids and
 * directions ALONE — a surviving key proves the same boundary WALLS, never the
 * same geometry. "Key survives ⇒ the geometry is unchanged" is sound only
 * because no caller can move an existing Junction or reshape existing curve
 * geometry while keeping a boundary cycle: `planWallChain` only adds and nodes
 * Walls; the topology ops only add, remove or re-role Walls (no surviving
 * Junction moves); `planDissolveJunction` re-describes two Walls as one chain
 * through the SAME points, so the joined Wall's point set is unchanged. A caller
 * that CAN change existing geometry while keeping boundary keys must NOT reach
 * the identity condition — it would need a geometry check the condition
 * deliberately never makes.
 */
export function buildCorrespondenceComponents(options: {
	faces: readonly DerivedCandidateFace[];
	predecessorRoomIds: readonly string[];
	predecessorWitnesses: ReadonlyMap<string, LayoutVec2>;
	predecessorPolygons: ReadonlyMap<string, readonly LayoutVec2[]>;
	/**
	 * CANDIDATE Wall/Junction graph — the identity authority for AUTHORIZED
	 * unions. Required: there is deliberately no way to build
	 * correspondence from geometry alone, because spatial overlap must never be
	 * able to union two graph-independent structures on its own.
	 */
	candidateDocument: Pick<LayoutDocumentWallFirst, 'walls' | 'junctions'>;
	/** Predecessor Rooms whose surviving boundary Walls anchor their identity. */
	baselineRooms: readonly LayoutWallFirstRoom[];
	/** Optional per-pass report; production callers omit it. */
	observer?: CorrespondenceObserver;
	/**
	 * Optional exhaustive evaluation: both predicates for every pair, geometry
	 * before authorization, no pruning. Production callers omit it.
	 */
	exhaustive?: boolean;
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
	const exhaustive = options.exhaustive === true;
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
	// M-3 — THE IDENTITY CONDITION, computed ONCE per pass from authored identity alone. A
	// predecessor Room whose own boundary cycle still exists as a candidate face OWNS that
	// face: `canonicalBoundaryCycleKey` is the ONE derivation face extraction and Room
	// lineage share, so a key match is authored identity, never a coincidence of
	// coordinates. The contrapositive is what removes a connected plan's neighbour pairs:
	// a face owned by exactly one Room can match NO OTHER, so a Room with a known face
	// against another Room's known face is settled as a NON-union with no geometry.
	// An AMBIGUOUS face (two Rooms naming it — the merge shape, where both predecessors'
	// cycles became the same one) is NEVER settled: the condition cannot be established, so
	// the pass refuses it and the geometric proof decides, exactly as today. The exhaustive
	// path is today's loop verbatim and reads none of this.
	// SOUNDNESS PRECONDITION (function doc): a surviving key is Wall ids and directions,
	// never coordinates, so "key survives ⇒ geometry unchanged" holds only while no caller
	// moves an existing Junction or reshapes existing curve geometry. A caller that can do
	// either while keeping boundary keys must NOT reach this condition.
	const claimFaceKeyByRoomId = new Map<string, string>();
	if (!exhaustive) {
		const faceKeySet = new Set(faces.map((face) => face.key));
		const claimantRoomIdsByFaceKey = new Map<string, string[]>();
		for (const room of options.baselineRooms) {
			// F2 — only an ENCLOSED predecessor may claim a face by key. An open
			// Space's Wall-only cycle key says nothing about its virtual edges, so a
			// surviving key would prove the wrong geometry; it must reach the
			// geometric proof instead. (SP-plan §5, F2.)
			if (room.virtualEdges.length > 0) continue;
			const key = canonicalBoundaryCycleKey(room.boundary);
			if (!faceKeySet.has(key)) continue;
			claimFaceKeyByRoomId.set(room.id, key);
			const claimants = claimantRoomIdsByFaceKey.get(key) ?? [];
			claimants.push(room.id);
			claimantRoomIdsByFaceKey.set(key, claimants);
		}
		for (const claimants of claimantRoomIdsByFaceKey.values()) {
			if (claimants.length <= 1) continue;
			for (const roomId of claimants) claimFaceKeyByRoomId.delete(roomId);
		}
	}
	/** Keys left after the ambiguity refusal: exactly the faces owned by ONE Room. */
	const unambiguousFaceKeys = new Set(claimFaceKeyByRoomId.values());
	countWork('pairs:face-room', faces.length * predecessorRoomIds.length);
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
				// D-12 — AUTHORIZATION. Geometry is evidence, not permission: a
				// predecessor Room and a candidate face may join only when authored
				// identity puts them in the SAME connected component of the candidate Wall
				// graph. Two coincident or contained graph-INDEPENDENT Rooms therefore stay
				// two correspondence components, so overlap alone can never merge, retire or
				// reassign an unrelated Room's identity or its owned objects.
				if (!unionAuthorized(authorization, roomId, face.key)) return;
				union(predIndex, predecessorCount + faceIndex);
				return;
			}
			// M-3 IDENTITY FIRST — the cheapest exact decision there is: when BOTH sides of
			// the pair are unambiguous, authored identity already has the verdict. The Room
			// owning this face unions; a Room whose own face is a DIFFERENT one refuses.
			const claimedFaceKey = claimFaceKeyByRoomId.get(roomId);
			if (claimedFaceKey !== undefined && unambiguousFaceKeys.has(face.key)) {
				observation.identitySettled += 1;
				if (claimedFaceKey === face.key) {
					observation.identityUnions += 1;
					union(predIndex, predecessorCount + faceIndex);
				} else {
					observation.identityRefusals += 1;
				}
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
	options.observer?.(observation);
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
