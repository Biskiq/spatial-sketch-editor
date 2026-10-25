/**
 * `layout-world-index.ts` — Copy-on-Write (COW) candidate deltas, retained
 * document world index, and sound Swept-Bounds Geometry Delta Certificate
 * (T1.P02.S06).
 *
 * Architectural contract:
 * 1. Never serializes into authored documents (AGENTS.md hard rule 3); all
 *    indexes and COW lineage links live in WeakMaps keyed on transient or
 *    frozen document identities.
 * 2. Never invents a second predicate or error authority (AGENTS.md hard rule 6):
 *    the swept-bounds certificate only proves POSITIVE validity when a baseline
 *    was already certified clean and every local/swept-neighborhood invariant
 *    passes. Any potential failure, ambiguous near-zero ring, or uncertified
 *    defective baseline delegates to the canonical cold gate so rejection codes,
 *    target IDs, paths, messages and document-order tie-breaking remain 100%
 *    identical to cold evaluation.
 */
import type { LayoutVec2 } from './layout-coordinates';
import {
	CURVE_SELF_INTERSECTION_TOLERANCE,
	hasSampleSegmentObserverForTest,
	type CurveSample
} from './layout-geometry-curve';
import { LAYOUT_GEOMETRY_EPSILON } from './layout-geometry-openings';
import {
	canonicalBoundaryCycleKey,
	hasFaceSamplingObserverForTest
} from './layout-face-extraction';
import { coincidesAsJunction, coincidentJunctionPairs } from './layout-junction-identity';
import {
	OPENING_SET_EPSILON,
	validateWallFirstOpeningSet,
	validateWallFirstOpeningSubset,
	type WallFirstWallIndex
} from './layout-opening-set';
import type { PlanBox } from './layout-plan-box-index';
import { createDynamicBvh, expandPlanBox, mergePlanBoxes, type DynamicBvh } from './layout-bvh';
import { orientXZ } from './layout-robust-orientation';
import {
	topologyComponentKeyByJunctionId,
	topologyComponentKeyByWallId
} from './layout-topology-components';
import {
	cloneWallCenterline,
	hasWallSamplingObserverForTest,
	translateWallCenterline,
	wallCenterlineSamples,
	type WallSamplingDerivation
} from './layout-wall-centerline';
import { validateWallFirstLayoutDocument } from './layout-wall-first-codec';
import type {
	LayoutDerivedWallRole,
	LayoutDocumentWallFirst,
	LayoutJunction,
	LayoutObject,
	LayoutWall,
	LayoutWallCenterline,
	LayoutWallFirstRoom,
	LayoutWallOpening
} from './layout-wall-first-types';
import { validateWallFirstPortalRelations } from './layout-wall-portals';
import {
	classifyWallIntersection,
	sampledWallExtentsOverlap,
	sampledWallSelfIntersects,
	sampledWallsCross,
	type SampledTopologyWall,
	type TopologySegment
} from './layout-wall-topology';
import { countWork } from './p2311-perf';

const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/;
const POINT_EPSILON = LAYOUT_GEOMETRY_EPSILON;
/**
 * Conservative pad applied to indexed Wall boxes and swept query bounds:
 * strictly exceeds `JUNCTION_COINCIDENCE_EPSILON` (1e-6),
 * `LAYOUT_GEOMETRY_EPSILON` (1e-6) and `CURVE_SELF_INTERSECTION_TOLERANCE` (1e-4).
 */
const SWEPT_INDEX_PAD = 1e-3;
/**
 * Guard band around zero twice-signed-area for Green's-theorem differential
 * updates; any walk within this band delegates to the cold face extractor so
 * exact IEEE-754 summation order decides `zero_area_face`.
 */
const WALK_AREA_GUARD_EPSILON = 1e-5;

export type CowDocumentDelta = {
	readonly baseline: LayoutDocumentWallFirst;
	readonly changedJunctionIds: readonly string[];
	readonly changedWallIds: readonly string[];
	readonly changedOpeningIds: readonly string[];
	readonly changedRoomIds: readonly string[];
	readonly changedObjectIds: readonly string[];
};

export type IndexedOpeningEntry = {
	readonly opening: LayoutWallOpening;
	readonly index: number;
};

type HalfEdgeDesc = {
	readonly fromId: string;
	readonly toId: string;
	readonly wallId: string;
	readonly direction: 'forward' | 'reverse';
};

type WalkSummary = {
	readonly twiceSignedArea: number;
	readonly wasPositive: boolean;
};

type HalfEdgeWalkLink = {
	readonly walkIndex: number;
	readonly twiceEdgeContrib: number;
};

export type DocumentWorldIndex = {
	readonly junctionsRef: readonly LayoutJunction[];
	readonly wallsRef: readonly LayoutWall[];
	readonly roomsRef: readonly LayoutWallFirstRoom[];
	readonly openingsRef: readonly LayoutWallOpening[];
	readonly objectsRef: readonly LayoutObject[];
	readonly junctionById: ReadonlyMap<string, LayoutJunction>;
	readonly junctionIndexById: ReadonlyMap<string, number>;
	readonly wallById: ReadonlyMap<string, LayoutWall>;
	readonly wallIndexById: ReadonlyMap<string, number>;
	readonly roomById: ReadonlyMap<string, LayoutWallFirstRoom>;
	readonly roomIndexById: ReadonlyMap<string, number>;
	readonly objectById: ReadonlyMap<string, LayoutObject>;
	readonly objectIndexById: ReadonlyMap<string, number>;
	readonly openingIndexById: ReadonlyMap<string, number>;
	readonly pointById: ReadonlyMap<string, LayoutVec2>;
	readonly incidentWallIdsByJunctionId: ReadonlyMap<string, readonly string[]>;
	readonly roomsByWallId: ReadonlyMap<string, readonly string[]>;
	readonly openingsByWallId: ReadonlyMap<string, readonly IndexedOpeningEntry[]>;
	readonly componentKeyByJunctionId: ReadonlyMap<string, string | symbol>;
	readonly componentKeyByWallId: ReadonlyMap<string, string>;
	readonly unattachedJunctionIds: readonly string[];
	readonly wallBvh: DynamicBvh;
	readonly sampledWallById: ReadonlyMap<string, SampledTopologyWall>;
	readonly faceGraphWallIdSet: ReadonlySet<string>;
	readonly starOrderByJunctionId: ReadonlyMap<string, readonly HalfEdgeDesc[]>;
	readonly walks: readonly WalkSummary[];
	readonly halfEdgeWalkByKey: ReadonlyMap<string, HalfEdgeWalkLink>;
};

type PendingWorldPatch = {
	readonly parentDoc: LayoutDocumentWallFirst;
	readonly changedJunctionIds: readonly string[];
	readonly affectedWallIds: readonly string[];
	readonly changedObjectIds: readonly string[];
	readonly changedOpeningWallIds?: readonly string[];
	readonly nextSampledWalls?: ReadonlyMap<string, SampledTopologyWall>;
	readonly nextWallBoxes?: ReadonlyMap<string, PlanBox>;
	readonly nextWalkTwiceAreas?: ReadonlyMap<number, number>;
	readonly nextHalfEdgeContribs?: ReadonlyMap<string, number>;
};

const COW_DELTA_BY_DOC = new WeakMap<LayoutDocumentWallFirst, CowDocumentDelta>();
const WORLD_INDEX_BY_DOC = new WeakMap<LayoutDocumentWallFirst, DocumentWorldIndex | 'invalid'>();
const PENDING_PATCH_BY_DOC = new WeakMap<LayoutDocumentWallFirst, PendingWorldPatch>();
const EQUIVALENT_ROOT_BY_DOC = new WeakMap<LayoutDocumentWallFirst, LayoutDocumentWallFirst>();
const PREPARED_COW_BY_OP_ID = new Map<string, LayoutDocumentWallFirst>();
const MAX_PREPARED_COW_OPS = 16;

function canonicalCloneRoot(document: LayoutDocumentWallFirst): LayoutDocumentWallFirst {
	return EQUIVALENT_ROOT_BY_DOC.get(document) ?? document;
}

export function areEquivalentLayoutClones(
	left: LayoutDocumentWallFirst,
	right: LayoutDocumentWallFirst
): boolean {
	return left === right || canonicalCloneRoot(left) === canonicalCloneRoot(right);
}

export function getCowDocumentDelta(
	document: LayoutDocumentWallFirst
): CowDocumentDelta | undefined {
	return COW_DELTA_BY_DOC.get(document);
}

export function registerCowDocumentDelta(
	document: LayoutDocumentWallFirst,
	delta: CowDocumentDelta
): void {
	COW_DELTA_BY_DOC.set(document, delta);
}

/**
 * Propagate verified COW lineage and pending world-index patch from a planner
 * candidate onto an immutable `structuredClone` or validated parse copy.
 */
export function linkClonedCowCandidate(
	originalCandidate: LayoutDocumentWallFirst,
	clonedCandidate: LayoutDocumentWallFirst
): void {
	if (originalCandidate === clonedCandidate) return;
	const root = canonicalCloneRoot(originalCandidate);
	EQUIVALENT_ROOT_BY_DOC.set(originalCandidate, root);
	EQUIVALENT_ROOT_BY_DOC.set(clonedCandidate, root);
	const delta = COW_DELTA_BY_DOC.get(originalCandidate);
	if (delta) COW_DELTA_BY_DOC.set(clonedCandidate, delta);
	const patch = PENDING_PATCH_BY_DOC.get(originalCandidate);
	if (patch) PENDING_PATCH_BY_DOC.set(clonedCandidate, patch);
	const existingIndex = peekLayoutWorldIndex(originalCandidate);
	if (existingIndex && !WORLD_INDEX_BY_DOC.has(clonedCandidate)) {
		WORLD_INDEX_BY_DOC.set(clonedCandidate, {
			...existingIndex,
			junctionsRef: clonedCandidate.junctions,
			wallsRef: clonedCandidate.walls,
			roomsRef: clonedCandidate.rooms,
			openingsRef: clonedCandidate.openings,
			objectsRef: clonedCandidate.objects
		});
	}
}

/** True when any test-only curve/face/wall sampling observer is installed. */
export function hasAnySamplingTestObserver(): boolean {
	return (
		hasWallSamplingObserverForTest() ||
		hasFaceSamplingObserverForTest() ||
		hasSampleSegmentObserverForTest()
	);
}

/** Peek an already-materialized clean world index without triggering a build. */
export function peekLayoutWorldIndex(
	document: LayoutDocumentWallFirst
): DocumentWorldIndex | undefined {
	const existing = WORLD_INDEX_BY_DOC.get(document);
	if (!existing || existing === 'invalid') return undefined;
	if (!matchesArrayRefs(document, existing)) return undefined;
	return existing;
}

/**
 * Record a prepared COW Layout candidate by `operationId` so the Stage host can
 * link F4's `structuredClone`d accepted copy back to its COW lineage in O(1).
 */
export function recordPreparedCowCandidate(
	operationId: string,
	document: LayoutDocumentWallFirst
): void {
	if (!operationId || !COW_DELTA_BY_DOC.has(document)) return;
	if (PREPARED_COW_BY_OP_ID.size >= MAX_PREPARED_COW_OPS) {
		const oldestKey = PREPARED_COW_BY_OP_ID.keys().next().value;
		if (oldestKey !== undefined) PREPARED_COW_BY_OP_ID.delete(oldestKey);
	}
	PREPARED_COW_BY_OP_ID.set(operationId, document);
}

/** Consume and clear a prepared COW candidate recorded for `operationId`. */
export function consumePreparedCowCandidate(
	operationId: string
): LayoutDocumentWallFirst | undefined {
	const found = PREPARED_COW_BY_OP_ID.get(operationId);
	if (found !== undefined) PREPARED_COW_BY_OP_ID.delete(operationId);
	return found;
}

function peekOrParentWorldIndex(document: LayoutDocumentWallFirst): DocumentWorldIndex | undefined {
	const direct = peekLayoutWorldIndex(document);
	if (direct) return direct;
	const cow = COW_DELTA_BY_DOC.get(document);
	if (cow) {
		const baseIdx = peekLayoutWorldIndex(cow.baseline);
		if (baseIdx) return baseIdx;
	}
	const pending = PENDING_PATCH_BY_DOC.get(document);
	if (pending) return peekLayoutWorldIndex(pending.parentDoc);
	return undefined;
}

/** O(1) Wall lookup on indexed or COW-derived documents, with exact linear fallback. */
export function lookupIndexedWall(
	document: LayoutDocumentWallFirst,
	wallId: string
): LayoutWall | undefined {
	const idx = peekOrParentWorldIndex(document);
	if (idx && idx.wallsRef.length === document.walls.length) {
		const wIdx = idx.wallIndexById.get(wallId);
		if (wIdx === undefined) return undefined;
		const cand = document.walls[wIdx];
		if (cand && cand.id === wallId) return cand;
	}
	return document.walls.find((entry) => entry.id === wallId);
}

/** O(1) Junction lookup on indexed or COW-derived documents, with exact linear fallback. */
export function lookupIndexedJunction(
	document: LayoutDocumentWallFirst,
	junctionId: string
): LayoutJunction | undefined {
	const idx = peekOrParentWorldIndex(document);
	if (idx && idx.junctionsRef.length === document.junctions.length) {
		const jIdx = idx.junctionIndexById.get(junctionId);
		if (jIdx === undefined) return undefined;
		const cand = document.junctions[jIdx];
		if (cand && cand.id === junctionId) return cand;
	}
	return document.junctions.find((entry) => entry.id === junctionId);
}

/** O(1) Opening lookup on indexed or COW-derived documents, with exact linear fallback. */
export function lookupIndexedOpening(
	document: LayoutDocumentWallFirst,
	openingId: string
): LayoutWallOpening | undefined {
	const idx = peekOrParentWorldIndex(document);
	if (idx && idx.openingsRef.length === document.openings.length) {
		const oIdx = idx.openingIndexById.get(openingId);
		if (oIdx === undefined) return undefined;
		const cand = document.openings[oIdx];
		if (cand && cand.id === openingId) return cand;
	}
	return document.openings.find((entry) => entry.id === openingId);
}

/** O(1) Object lookup on indexed or COW-derived documents, with exact linear fallback. */
export function lookupIndexedObject(
	document: LayoutDocumentWallFirst,
	objectId: string
): LayoutObject | undefined {
	const idx = peekOrParentWorldIndex(document);
	if (idx && idx.objectsRef.length === document.objects.length) {
		const oIdx = idx.objectIndexById.get(objectId);
		if (oIdx === undefined) return undefined;
		const cand = document.objects[oIdx];
		if (cand && cand.id === objectId) return cand;
	}
	return document.objects.find((entry) => entry.id === objectId);
}

/**
 * O(deg) incident Wall lookup in exact `document.walls` array order when indexed
 * (or COW-derived with unchanged topology); returns `undefined` when unindexed so
 * callers can fall back to scanning `document.walls`.
 */
export function lookupIncidentWallsOrdered(
	document: LayoutDocumentWallFirst,
	junctionIds: readonly string[]
): readonly LayoutWall[] | undefined {
	const idx = peekOrParentWorldIndex(document);
	if (!idx || idx.wallsRef.length !== document.walls.length) return undefined;
	if (junctionIds.length === 0) return [];
	const wallIndices = new Set<number>();
	for (let i = 0; i < junctionIds.length; i += 1) {
		const incident = idx.incidentWallIdsByJunctionId.get(junctionIds[i]!);
		if (!incident) continue;
		for (let w = 0; w < incident.length; w += 1) {
			const wId = incident[w]!;
			const wIdx = idx.wallIndexById.get(wId);
			if (wIdx === undefined || document.walls[wIdx]?.id !== wId) return undefined;
			wallIndices.add(wIdx);
		}
	}
	const sortedIndices = [...wallIndices].sort((a, b) => a - b);
	return sortedIndices.map((wIdx) => document.walls[wIdx]!);
}

/**
 * Derive a Wall's format-6 role in O(1) when `document` has an active world
 * index (or COW parent with unchanged Rooms), falling back to `undefined` when
 * unindexed so callers can run the cold scan.
 */
export function deriveIndexedWallRole(
	document: LayoutDocumentWallFirst,
	wallId: string
): LayoutDerivedWallRole | 'missing-wall' | undefined {
	let idx = peekLayoutWorldIndex(document);
	if (!idx) {
		const cow = COW_DELTA_BY_DOC.get(document);
		if (cow && cow.changedRoomIds.length === 0 && cow.baseline.rooms === document.rooms) {
			idx = peekLayoutWorldIndex(cow.baseline);
		}
	}
	if (!idx) {
		const pending = PENDING_PATCH_BY_DOC.get(document);
		if (pending && pending.parentDoc.rooms === document.rooms) {
			idx = peekLayoutWorldIndex(pending.parentDoc);
		}
	}
	if (!idx) return undefined;
	if (!idx.wallById.has(wallId)) return 'missing-wall';
	const count = idx.roomsByWallId.get(wallId)?.length ?? 0;
	return count === 0 ? 'free-standing' : count === 1 ? 'bounding' : 'dividing';
}

/**
 * Ensure `document` has a certified-clean `DocumentWorldIndex`, returning
 * `undefined` if `document` fails any canonical baseline invariant (so callers
 * fall back to the exact cold gate).
 */
export function ensureLayoutWorldIndex(
	document: LayoutDocumentWallFirst
): DocumentWorldIndex | undefined {
	const cached = WORLD_INDEX_BY_DOC.get(document);
	if (cached === 'invalid') return undefined;
	if (cached !== undefined && matchesArrayRefs(document, cached)) {
		return cached;
	}

	const pending = PENDING_PATCH_BY_DOC.get(document);
	if (pending) {
		const parentIndex = ensureLayoutWorldIndex(pending.parentDoc);
		if (parentIndex) {
			const materialized = materializePatchedWorldIndex(parentIndex, document, pending);
			if (materialized) {
				WORLD_INDEX_BY_DOC.set(document, materialized);
				PENDING_PATCH_BY_DOC.delete(document);
				return materialized;
			}
		}
	}

	const built = buildCertifiedWorldIndex(document);
	WORLD_INDEX_BY_DOC.set(document, built ?? 'invalid');
	return built;
}

function matchesArrayRefs(
	document: LayoutDocumentWallFirst,
	index: DocumentWorldIndex
): boolean {
	return (
		document.junctions === index.junctionsRef &&
		document.walls === index.wallsRef &&
		document.rooms === index.roomsRef &&
		document.openings === index.openingsRef &&
		document.objects === index.objectsRef
	);
}

// =====================================================================
// Copy-on-Write (COW) Candidate Builders
// =====================================================================

export function cowMoveJunctions(
	baseline: LayoutDocumentWallFirst,
	targetPoints: ReadonlyMap<string, LayoutVec2>,
	changedWallIds: readonly string[],
	worldIndex?: DocumentWorldIndex
): LayoutDocumentWallFirst {
	const nextJunctions = baseline.junctions.slice();
	if (worldIndex) {
		for (const [id, pt] of targetPoints) {
			const idx = worldIndex.junctionIndexById.get(id);
			if (idx !== undefined) {
				nextJunctions[idx] = { id, point: [pt[0], pt[1]] };
			}
		}
	} else {
		for (let i = 0; i < nextJunctions.length; i += 1) {
			const j = nextJunctions[i]!;
			const pt = targetPoints.get(j.id);
			if (pt) nextJunctions[i] = { id: j.id, point: [pt[0], pt[1]] };
		}
	}
	// Refresh changed walls' centerline objects so P1 / centerline identity
	// contracts hold even when only endpoint coordinates moved.
	const nextWalls = baseline.walls.slice();
	if (worldIndex) {
		for (const wallId of changedWallIds) {
			const idx = worldIndex.wallIndexById.get(wallId);
			if (idx !== undefined) {
				const w = nextWalls[idx]!;
				nextWalls[idx] = cloneWallRecord(w, cloneWallCenterline(w.centerline));
			}
		}
	} else {
		const wallSet = new Set(changedWallIds);
		for (let i = 0; i < nextWalls.length; i += 1) {
			const w = nextWalls[i]!;
			if (wallSet.has(w.id)) {
				nextWalls[i] = cloneWallRecord(w, cloneWallCenterline(w.centerline));
			}
		}
	}
	const candidate = buildCowWrapper(baseline, {
		junctions: nextJunctions,
		walls: nextWalls
	});
	registerCowDocumentDelta(candidate, {
		baseline,
		changedJunctionIds: [...targetPoints.keys()],
		changedWallIds: [...changedWallIds],
		changedOpeningIds: [],
		changedRoomIds: [],
		changedObjectIds: []
	});
	return candidate;
}

export function cowMoveRigidWall(
	baseline: LayoutDocumentWallFirst,
	wallId: string,
	delta: LayoutVec2,
	changedJunctionIds: readonly string[],
	changedWallIds: readonly string[],
	worldIndex?: DocumentWorldIndex
): LayoutDocumentWallFirst {
	const nextJunctions = baseline.junctions.slice();
	if (worldIndex) {
		for (const jId of changedJunctionIds) {
			const idx = worldIndex.junctionIndexById.get(jId);
			if (idx !== undefined) {
				const j = nextJunctions[idx]!;
				nextJunctions[idx] = {
					id: j.id,
					point: [j.point[0] + delta[0], j.point[1] + delta[1]]
				};
			}
		}
	} else {
		const jSet = new Set(changedJunctionIds);
		for (let i = 0; i < nextJunctions.length; i += 1) {
			const j = nextJunctions[i]!;
			if (jSet.has(j.id)) {
				nextJunctions[i] = {
					id: j.id,
					point: [j.point[0] + delta[0], j.point[1] + delta[1]]
				};
			}
		}
	}

	const nextWalls = baseline.walls.slice();
	if (worldIndex) {
		for (const cWallId of changedWallIds) {
			const idx = worldIndex.wallIndexById.get(cWallId);
			if (idx !== undefined) {
				const w = nextWalls[idx]!;
				const centerline =
					cWallId === wallId
						? translateWallCenterline(w.centerline, delta)
						: cloneWallCenterline(w.centerline);
				nextWalls[idx] = cloneWallRecord(w, centerline);
			}
		}
	} else {
		const wSet = new Set(changedWallIds);
		for (let i = 0; i < nextWalls.length; i += 1) {
			const w = nextWalls[i]!;
			if (wSet.has(w.id)) {
				const centerline =
					w.id === wallId
						? translateWallCenterline(w.centerline, delta)
						: cloneWallCenterline(w.centerline);
				nextWalls[i] = cloneWallRecord(w, centerline);
			}
		}
	}

	const candidate = buildCowWrapper(baseline, {
		junctions: nextJunctions,
		walls: nextWalls
	});
	registerCowDocumentDelta(candidate, {
		baseline,
		changedJunctionIds: [...changedJunctionIds],
		changedWallIds: [...changedWallIds],
		changedOpeningIds: [],
		changedRoomIds: [],
		changedObjectIds: []
	});
	return candidate;
}

export function cowSetWallCenterline(
	baseline: LayoutDocumentWallFirst,
	wallId: string,
	centerline: LayoutWallCenterline,
	worldIndex?: DocumentWorldIndex
): LayoutDocumentWallFirst {
	const nextWalls = baseline.walls.slice();
	const clonedCenterline = cloneWallCenterline(centerline);
	if (worldIndex) {
		const idx = worldIndex.wallIndexById.get(wallId);
		if (idx !== undefined) {
			nextWalls[idx] = cloneWallRecord(nextWalls[idx]!, clonedCenterline);
		}
	} else {
		const idx = nextWalls.findIndex((w) => w.id === wallId);
		if (idx !== -1) {
			nextWalls[idx] = cloneWallRecord(nextWalls[idx]!, clonedCenterline);
		}
	}
	const candidate = buildCowWrapper(baseline, {
		walls: nextWalls
	});
	registerCowDocumentDelta(candidate, {
		baseline,
		changedJunctionIds: [],
		changedWallIds: [wallId],
		changedOpeningIds: [],
		changedRoomIds: [],
		changedObjectIds: []
	});
	return candidate;
}

export function cowSetWallScalar(
	baseline: LayoutDocumentWallFirst,
	wallId: string,
	patch: { thickness?: number; height?: number },
	worldIndex?: DocumentWorldIndex
): LayoutDocumentWallFirst {
	const nextWalls = baseline.walls.slice();
	const updateAt = (idx: number): void => {
		const w = nextWalls[idx]!;
		nextWalls[idx] = {
			id: w.id,
			startJunctionId: w.startJunctionId,
			endJunctionId: w.endJunctionId,
			thickness: patch.thickness ?? w.thickness,
			height: patch.height ?? w.height,
			centerline: cloneWallCenterline(w.centerline),
			...(w.name !== undefined ? { name: w.name } : {})
		};
	};
	if (worldIndex) {
		const idx = worldIndex.wallIndexById.get(wallId);
		if (idx !== undefined) updateAt(idx);
	} else {
		const idx = nextWalls.findIndex((w) => w.id === wallId);
		if (idx !== -1) updateAt(idx);
	}
	const candidate = buildCowWrapper(baseline, {
		walls: nextWalls
	});
	registerCowDocumentDelta(candidate, {
		baseline,
		changedJunctionIds: [],
		changedWallIds: [wallId],
		changedOpeningIds: [],
		changedRoomIds: [],
		changedObjectIds: []
	});
	return candidate;
}

export function cowCreateObject(
	baseline: LayoutDocumentWallFirst,
	object: LayoutObject
): LayoutDocumentWallFirst {
	const freshObject = cloneObjectRecord(object);
	const candidate = buildCowWrapper(baseline, {
		objects: [...baseline.objects, freshObject]
	});
	registerCowDocumentDelta(candidate, {
		baseline,
		changedJunctionIds: [],
		changedWallIds: [],
		changedOpeningIds: [],
		changedRoomIds: [],
		changedObjectIds: [freshObject.id]
	});
	return candidate;
}

export function cowUpdateObject(
	baseline: LayoutDocumentWallFirst,
	objectId: string,
	updater: (existing: LayoutObject) => LayoutObject,
	worldIndex?: DocumentWorldIndex
): LayoutDocumentWallFirst {
	const nextObjects = baseline.objects.slice();
	if (worldIndex) {
		const idx = worldIndex.objectIndexById.get(objectId);
		if (idx !== undefined) {
			nextObjects[idx] = cloneObjectRecord(updater(nextObjects[idx]!));
		}
	} else {
		const idx = nextObjects.findIndex((o) => o.id === objectId);
		if (idx !== -1) {
			nextObjects[idx] = cloneObjectRecord(updater(nextObjects[idx]!));
		}
	}
	const candidate = buildCowWrapper(baseline, {
		objects: nextObjects
	});
	registerCowDocumentDelta(candidate, {
		baseline,
		changedJunctionIds: [],
		changedWallIds: [],
		changedOpeningIds: [],
		changedRoomIds: [],
		changedObjectIds: [objectId]
	});
	return candidate;
}

export function cowDeleteObject(
	baseline: LayoutDocumentWallFirst,
	objectId: string
): LayoutDocumentWallFirst {
	const candidate = buildCowWrapper(baseline, {
		objects: baseline.objects.filter((entry) => entry.id !== objectId)
	});
	registerCowDocumentDelta(candidate, {
		baseline,
		changedJunctionIds: [],
		changedWallIds: [],
		changedOpeningIds: [],
		changedRoomIds: [],
		changedObjectIds: [objectId]
	});
	return candidate;
}

export function cowUpdateOpening(
	baseline: LayoutDocumentWallFirst,
	openingId: string,
	nextOpening: LayoutWallOpening,
	worldIndex?: DocumentWorldIndex
): LayoutDocumentWallFirst {
	const nextOpenings = baseline.openings.slice();
	const freshOpening: LayoutWallOpening = {
		id: nextOpening.id,
		wallId: nextOpening.wallId,
		kind: nextOpening.kind,
		offset: nextOpening.offset,
		width: nextOpening.width,
		height: nextOpening.height,
		sillHeight: nextOpening.sillHeight,
		profile: nextOpening.profile,
		...(nextOpening.name !== undefined ? { name: nextOpening.name } : {}),
		...(nextOpening.connectsRoomIds !== undefined
			? { connectsRoomIds: [nextOpening.connectsRoomIds[0], nextOpening.connectsRoomIds[1]] }
			: {})
	};
	if (worldIndex) {
		const idx = worldIndex.openingIndexById.get(openingId);
		if (idx !== undefined && nextOpenings[idx]?.id === openingId) {
			nextOpenings[idx] = freshOpening;
		} else {
			const fallbackIdx = nextOpenings.findIndex((o) => o.id === openingId);
			if (fallbackIdx !== -1) nextOpenings[fallbackIdx] = freshOpening;
		}
	} else {
		const idx = nextOpenings.findIndex((o) => o.id === openingId);
		if (idx !== -1) nextOpenings[idx] = freshOpening;
	}
	const candidate = buildCowWrapper(baseline, { openings: nextOpenings });
	registerCowDocumentDelta(candidate, {
		baseline,
		changedJunctionIds: [],
		changedWallIds: [],
		changedOpeningIds: [openingId],
		changedRoomIds: [],
		changedObjectIds: []
	});
	return candidate;
}

function buildCowWrapper(
	baseline: LayoutDocumentWallFirst,
	overrides: Partial<
		Pick<LayoutDocumentWallFirst, 'junctions' | 'walls' | 'rooms' | 'openings' | 'objects'>
	>
): LayoutDocumentWallFirst {
	return {
		units: baseline.units,
		formatVersion: baseline.formatVersion,
		floor: baseline.floor,
		junctions: overrides.junctions ?? baseline.junctions,
		walls: overrides.walls ?? baseline.walls,
		rooms: overrides.rooms ?? baseline.rooms,
		openings: overrides.openings ?? baseline.openings,
		objects: overrides.objects ?? baseline.objects,
		...(baseline.identity !== undefined ? { identity: baseline.identity } : {})
	};
}

function cloneWallRecord(wall: LayoutWall, centerline: LayoutWallCenterline): LayoutWall {
	return {
		id: wall.id,
		startJunctionId: wall.startJunctionId,
		endJunctionId: wall.endJunctionId,
		thickness: wall.thickness,
		height: wall.height,
		centerline,
		...(wall.name !== undefined ? { name: wall.name } : {})
	};
}

function cloneObjectRecord(object: LayoutObject): LayoutObject {
	return {
		id: object.id,
		kind: object.kind,
		position: [object.position[0], object.position[1], object.position[2]],
		rotation: [object.rotation[0], object.rotation[1], object.rotation[2]],
		dimensions: [object.dimensions[0], object.dimensions[1], object.dimensions[2]],
		...(object.profile
			? {
					profile: {
						closed: object.profile.closed,
						segments: object.profile.segments.map((segment) =>
							segment.kind === 'auto-bezier'
								? {
										id: segment.id,
										kind: 'auto-bezier' as const,
										start: [segment.start[0], segment.start[1]] as LayoutVec2,
										end: [segment.end[0], segment.end[1]] as LayoutVec2,
										interiorAnchors: segment.interiorAnchors.map((anchor) => ({
											id: anchor.id,
											point: [anchor.point[0], anchor.point[1]] as LayoutVec2
										}))
									}
								: {
										id: segment.id,
										kind: 'line' as const,
										start: [segment.start[0], segment.start[1]] as LayoutVec2,
										end: [segment.end[0], segment.end[1]] as LayoutVec2
									}
						)
					}
				}
			: {}),
		...(object.roomId !== undefined ? { roomId: object.roomId } : {})
	};
}

// =====================================================================
// Swept-Bounds Geometry Delta Certificate
// =====================================================================

/**
 * Verify a coordinate/centerline candidate derived via COW from `baseline`.
 *
 * Returns `'certified-valid'` ONLY when `baseline` is certified clean AND every
 * structural, topological, planar-rotation-system, Green's-theorem face-area,
 * opening-set, and portal-relation invariant is proven to hold on `candidate`.
 * Returns `'delegate-cold'` on any potential failure or uncertified baseline.
 */
export function verifySweptBoundsGeometryDelta(options: {
	baseline: LayoutDocumentWallFirst;
	candidate: LayoutDocumentWallFirst;
	changedJunctionIds: readonly string[];
	changedWallIds: readonly string[];
	sampling: WallSamplingDerivation;
}): 'certified-valid' | 'delegate-cold' {
	const { baseline, candidate, changedJunctionIds, changedWallIds, sampling } = options;
	const worldIndex = ensureLayoutWorldIndex(baseline);
	if (!worldIndex) return 'delegate-cold';

	// Guard against in-place mutation of non-frozen test baselines on touched entities.
	for (const jId of changedJunctionIds) {
		const jIdx = worldIndex.junctionIndexById.get(jId);
		const baseJ = jIdx !== undefined ? baseline.junctions[jIdx] : undefined;
		const storedPt = worldIndex.pointById.get(jId);
		if (!baseJ || !storedPt || baseJ.point[0] !== storedPt[0] || baseJ.point[1] !== storedPt[1]) {
			WORLD_INDEX_BY_DOC.delete(baseline);
			return 'delegate-cold';
		}
	}

	// 1. Structural codec verification on changed Junctions and Walls.
	const nextJunctionById = new Map<string, LayoutJunction>();
	for (const jId of changedJunctionIds) {
		const idx = worldIndex.junctionIndexById.get(jId);
		if (idx === undefined) return 'delegate-cold';
		const j = candidate.junctions[idx];
		if (!j || j.id !== jId || !isValidVec2(j.point)) return 'delegate-cold';
		nextJunctionById.set(jId, j);
	}

	// Affected walls = union of `changedWallIds` and all walls incident to `changedJunctionIds`.
	const affectedWallIdSet = new Set<string>(changedWallIds);
	for (const jId of changedJunctionIds) {
		const incident = worldIndex.incidentWallIdsByJunctionId.get(jId);
		if (incident) {
			for (const wId of incident) affectedWallIdSet.add(wId);
		}
	}
	const affectedWallIds = [...affectedWallIdSet].sort(
		(a, b) => (worldIndex.wallIndexById.get(a) ?? 0) - (worldIndex.wallIndexById.get(b) ?? 0)
	);

	const nextWallById = new Map<string, LayoutWall>();
	for (const wId of affectedWallIds) {
		const idx = worldIndex.wallIndexById.get(wId);
		if (idx === undefined) return 'delegate-cold';
		const w = candidate.walls[idx];
		if (!w || w.id !== wId || !isValidWallRecord(w)) return 'delegate-cold';
		nextWallById.set(wId, w);
	}

	const pointOf = (jId: string): LayoutVec2 | undefined =>
		nextJunctionById.get(jId)?.point ?? worldIndex.pointById.get(jId);
	const wallOf = (wId: string): LayoutWall | undefined =>
		nextWallById.get(wId) ?? worldIndex.wallById.get(wId);

	// 2. Resolve affected Wall segments, check zero-length, sample centerlines & compute swept box.
	const nextSegments = new Map<string, TopologySegment>();
	const nextSampledWalls = new Map<string, SampledTopologyWall>();
	const nextWallBoxes = new Map<string, PlanBox>();
	let sweptBox: PlanBox | null = null;

	for (const jId of changedJunctionIds) {
		const oldPt = worldIndex.pointById.get(jId)!;
		const newPt = nextJunctionById.get(jId)!.point;
		const ptBox = expandPlanBox(
			{
				minX: Math.min(oldPt[0], newPt[0]),
				minZ: Math.min(oldPt[1], newPt[1]),
				maxX: Math.max(oldPt[0], newPt[0]),
				maxZ: Math.max(oldPt[1], newPt[1])
			},
			SWEPT_INDEX_PAD
		);
		sweptBox = sweptBox ? mergePlanBoxes(sweptBox, ptBox) : ptBox;
	}

	for (const wId of affectedWallIds) {
		const wall = nextWallById.get(wId)!;
		countWork('lookup:junctions', 2);
		const start = pointOf(wall.startJunctionId);
		const end = pointOf(wall.endJunctionId);
		if (!start || !end) return 'delegate-cold';
		const len = Math.hypot(end[0] - start[0], end[1] - start[1]);
		if (!(len > POINT_EPSILON)) {
			// Zero-length wall detected — delegate to cold for canonical issue formatting.
			return 'delegate-cold';
		}
		const segment: TopologySegment = { id: wId, start, end };
		nextSegments.set(wId, segment);

		let samples: readonly CurveSample[];
		if (wall.centerline.kind === 'line') {
			samples = chordSamples(segment, len);
		} else {
			const sampled = sampling.samples(wall, start, end, 'forward');
			if (!sampled) return 'delegate-cold';
			samples = sampled.samples;
		}
		const sampledWall: SampledTopologyWall = {
			id: wId,
			startJunctionId: wall.startJunctionId,
			endJunctionId: wall.endJunctionId,
			samples
		};
		if (wall.centerline.kind !== 'line' && sampledWallSelfIntersects(sampledWall)) {
			return 'delegate-cold';
		}
		nextSampledWalls.set(wId, sampledWall);

		const newBox = computeIndexedWallBox(segment, samples);
		nextWallBoxes.set(wId, newBox);
		const wIdx = worldIndex.wallIndexById.get(wId)!;
		const oldBox = worldIndex.wallBvh.boxOf(wIdx);
		const unionWallBox = mergePlanBoxes(oldBox, newBox);
		sweptBox = sweptBox ? mergePlanBoxes(sweptBox, unionWallBox) : unionWallBox;
	}

	// 3. Single unified swept-bounds BVH query (counts `index:node-visit` once).
	const nearbyWallIndices = sweptBox ? worldIndex.wallBvh.overlaps(sweptBox) : [];

	// 4. Component-scoped Junction coincidence in the swept neighborhood.
	if (changedJunctionIds.length > 0) {
		const nearbyJunctionIds = new Set<string>(changedJunctionIds);
		for (let i = 0; i < nearbyWallIndices.length; i += 1) {
			const w = baseline.walls[nearbyWallIndices[i]!]!;
			nearbyJunctionIds.add(w.startJunctionId);
			nearbyJunctionIds.add(w.endJunctionId);
		}
		// Include unattached junctions if any moved junction is unattached.
		for (const jId of changedJunctionIds) {
			if ((worldIndex.incidentWallIdsByJunctionId.get(jId)?.length ?? 0) === 0) {
				for (const uId of worldIndex.unattachedJunctionIds) nearbyJunctionIds.add(uId);
				break;
			}
		}
		const movedSet = new Set(changedJunctionIds);
		const nearbyList = [...nearbyJunctionIds];
		for (const movedId of changedJunctionIds) {
			const movedPt = pointOf(movedId)!;
			const movedComp = worldIndex.componentKeyByJunctionId.get(movedId);
			for (let i = 0; i < nearbyList.length; i += 1) {
				const otherId = nearbyList[i]!;
				if (otherId === movedId) continue;
				if (movedSet.has(otherId) && otherId < movedId) continue;
				const otherPt = pointOf(otherId)!;
				if (
					Math.abs(movedPt[0] - otherPt[0]) > SWEPT_INDEX_PAD ||
					Math.abs(movedPt[1] - otherPt[1]) > SWEPT_INDEX_PAD
				) {
					continue;
				}
				countWork('pairs:junction-junction');
				if (worldIndex.componentKeyByJunctionId.get(otherId) !== movedComp) continue;
				countWork('pairs:junction-junction:same-component');
				if (coincidesAsJunction(movedPt, otherPt)) {
					return 'delegate-cold';
				}
			}
		}
	}

	// 5. Component-scoped Wall chord & curve crossings in the swept neighborhood.
	const candidateNeighborWallIds = new Set<string>(affectedWallIds);
	for (let i = 0; i < nearbyWallIndices.length; i += 1) {
		candidateNeighborWallIds.add(baseline.walls[nearbyWallIndices[i]!]!.id);
	}
	for (const wAId of affectedWallIds) {
		const wA = wallOf(wAId)!;
		const segA = nextSegments.get(wAId)!;
		const sampA = nextSampledWalls.get(wAId)!;
		const compA = worldIndex.componentKeyByWallId.get(wAId);

		for (const wBId of candidateNeighborWallIds) {
			if (wBId === wAId) continue;
			if (affectedWallIdSet.has(wBId) && wBId < wAId) continue;
			const wB = wallOf(wBId)!;
			const segB =
				nextSegments.get(wBId) ??
				(() => {
					const s = pointOf(wB.startJunctionId)!;
					const e = pointOf(wB.endJunctionId)!;
					return { id: wBId, start: s, end: e };
				})();

			// Chord overlap check (padded by POINT_EPSILON so boundary/near-boundary touches reach `classifyWallIntersection`)
			if (
				Math.max(segA.start[0], segA.end[0]) + POINT_EPSILON >= Math.min(segB.start[0], segB.end[0]) &&
				Math.min(segA.start[0], segA.end[0]) - POINT_EPSILON <= Math.max(segB.start[0], segB.end[0]) &&
				Math.max(segA.start[1], segA.end[1]) + POINT_EPSILON >= Math.min(segB.start[1], segB.end[1]) &&
				Math.min(segA.start[1], segA.end[1]) - POINT_EPSILON <= Math.max(segB.start[1], segB.end[1])
			) {
				countWork('pairs:wall-wall');
				if (worldIndex.componentKeyByWallId.get(wBId) === compA) {
					countWork('pairs:wall-wall:same-component');
					const shared = sharedJunctions(wA, wB);
					const inter = classifyWallIntersection(segA, segB, shared);
					if (inter.kind === 'shared-explicit-junction') {
						const geom = classifyWallIntersection(segA, segB, []);
						if (geom.kind === 'collinear-overlap') return 'delegate-cold';
					} else if (inter.kind !== 'none') {
						return 'delegate-cold';
					}
				}
			}

			// Curve crossing check (when at least one Wall is curved)
			if (wA.centerline.kind !== 'line' || wB.centerline.kind !== 'line') {
				const sampB = nextSampledWalls.get(wBId) ?? worldIndex.sampledWallById.get(wBId);
				if (!sampB) return 'delegate-cold';
				if (sampledWallExtentsOverlap(sampA, sampB)) {
					countWork('pairs:wall-wall-curve');
					if (worldIndex.componentKeyByWallId.get(wBId) === compA) {
						const shared = sharedJunctions(wA, wB)[0];
						if (sampledWallsCross(sampA, sampB, shared)) {
							return 'delegate-cold';
						}
					}
				}
			}
		}
	}

	// 6. Planar Combinatorial Map invariance (cyclic star order at 1-hop junctions)
	//    + Green's-theorem boundary-chain differential on affected closed walks.
	const starCheckJunctionIds = new Set<string>();
	for (const jId of changedJunctionIds) {
		if (worldIndex.starOrderByJunctionId.has(jId)) starCheckJunctionIds.add(jId);
	}
	for (const wId of affectedWallIds) {
		if (!worldIndex.faceGraphWallIdSet.has(wId)) continue;
		const w = wallOf(wId)!;
		if (worldIndex.starOrderByJunctionId.has(w.startJunctionId)) {
			starCheckJunctionIds.add(w.startJunctionId);
		}
		if (worldIndex.starOrderByJunctionId.has(w.endJunctionId)) {
			starCheckJunctionIds.add(w.endJunctionId);
		}
	}

	for (const jId of starCheckJunctionIds) {
		const baseStar = worldIndex.starOrderByJunctionId.get(jId);
		if (!baseStar || baseStar.length <= 1) continue;
		const nextStar = [...baseStar].sort((a, b) => compareHalfEdgesWithPoints(pointOf, jId, a, b));
		if (!sameCyclicHalfEdgeOrder(baseStar, nextStar)) {
			return 'delegate-cold';
		}
	}

	const walkDeltaByIndex = new Map<number, number>();
	const nextHalfEdgeContribs = new Map<string, number>();
	for (const wId of affectedWallIds) {
		if (!worldIndex.faceGraphWallIdSet.has(wId)) continue;
		const wall = wallOf(wId)!;
		const start = pointOf(wall.startJunctionId)!;
		const end = pointOf(wall.endJunctionId)!;
		for (const direction of ['forward', 'reverse'] as const) {
			const heKey = `${wId}:${direction}`;
			const link = worldIndex.halfEdgeWalkByKey.get(heKey);
			if (!link) return 'delegate-cold';
			const contrib = computeHalfEdgeTwiceAreaContrib(wall, start, end, direction, sampling);
			if (contrib === null || !Number.isFinite(contrib)) return 'delegate-cold';
			nextHalfEdgeContribs.set(heKey, contrib);
			const diff = contrib - link.twiceEdgeContrib;
			walkDeltaByIndex.set(link.walkIndex, (walkDeltaByIndex.get(link.walkIndex) ?? 0) + diff);
		}
	}

	const nextWalkTwiceAreas = new Map<number, number>();
	for (const [walkIndex, deltaTwiceArea] of walkDeltaByIndex) {
		const walk = worldIndex.walks[walkIndex];
		if (!walk) return 'delegate-cold';
		const nextTwiceArea = walk.twiceSignedArea + deltaTwiceArea;
		if (
			!Number.isFinite(nextTwiceArea) ||
			Math.abs(nextTwiceArea) <= WALK_AREA_GUARD_EPSILON ||
			nextTwiceArea > 0 !== walk.wasPositive
		) {
			return 'delegate-cold';
		}
		nextWalkTwiceAreas.set(walkIndex, nextTwiceArea);
	}

	// 7. Opening-set fit/height/profile/overlap on affected Walls only.
	const affectedOpeningEntries: IndexedOpeningEntry[] = [];
	for (const wId of affectedWallIds) {
		const entries = worldIndex.openingsByWallId.get(wId);
		if (entries) {
			for (const entry of entries) affectedOpeningEntries.push(entry);
		}
	}
	if (affectedOpeningEntries.length > 0) {
		affectedOpeningEntries.sort((a, b) => a.index - b.index);
		const wallIdxView: WallFirstWallIndex = {
			wallById: {
				get: (id: string) => wallOf(id),
				has: (id: string) => worldIndex.wallById.has(id)
			} as ReadonlyMap<string, LayoutWall>,
			pointById: {
				get: (id: string) => pointOf(id),
				has: (id: string) => worldIndex.pointById.has(id)
			} as ReadonlyMap<string, LayoutVec2>
		};
		const openingIssues = validateWallFirstOpeningSubset(
			candidate,
			affectedOpeningEntries,
			wallIdxView,
			sampling
		);
		if (openingIssues.length > 0) {
			return 'delegate-cold';
		}
	}

	// Record O(k) lazy world-index patch for `candidate` in case it is committed
	// and used as the baseline of a subsequent edit.
	PENDING_PATCH_BY_DOC.set(candidate, {
		parentDoc: baseline,
		changedJunctionIds,
		affectedWallIds,
		changedObjectIds: [],
		nextSampledWalls,
		nextWallBoxes,
		nextWalkTwiceAreas,
		nextHalfEdgeContribs
	});

	return 'certified-valid';
}

/**
 * Verify a non-topological Wall scalar (`wall-thickness`, `wall-height`) or
 * `LayoutObject` (`create`, `transform`, `delete`) COW edit against a certified
 * clean baseline.
 */
export function verifyScalarOrObjectDelta(options: {
	baseline: LayoutDocumentWallFirst;
	candidate: LayoutDocumentWallFirst;
	operation:
		| 'wall-thickness'
		| 'wall-height'
		| 'layout-object-preset-create'
		| 'layout-object-transform'
		| 'layout-object-delete';
	changedWallIds: readonly string[];
	changedObjectIds: readonly string[];
}): 'certified-valid' | 'delegate-cold' {
	const { baseline, candidate, operation, changedWallIds, changedObjectIds } = options;
	const worldIndex = ensureLayoutWorldIndex(baseline);
	if (!worldIndex) return 'delegate-cold';

	if (operation === 'wall-thickness' || operation === 'wall-height') {
		for (const wId of changedWallIds) {
			const idx = worldIndex.wallIndexById.get(wId);
			if (idx === undefined) return 'delegate-cold';
			const w = candidate.walls[idx];
			if (!w || !isValidWallRecord(w)) return 'delegate-cold';
			if (operation === 'wall-height') {
				const entries = worldIndex.openingsByWallId.get(wId);
				if (entries && entries.length > 0) {
					for (const { opening } of entries) {
						if (opening.sillHeight + opening.height > w.height + OPENING_SET_EPSILON) {
							return 'delegate-cold';
						}
					}
				}
			}
		}
		PENDING_PATCH_BY_DOC.set(candidate, {
			parentDoc: baseline,
			changedJunctionIds: [],
			affectedWallIds: changedWallIds,
			changedObjectIds: []
		});
		return 'certified-valid';
	}

	// Object operations: verify ID pattern, uniqueness and optional `roomId` reference.
	if (operation === 'layout-object-preset-create') {
		const createdId = changedObjectIds[0];
		if (!createdId || !ID_PATTERN.test(createdId) || worldIndex.objectById.has(createdId)) {
			return 'delegate-cold';
		}
		const obj = candidate.objects[candidate.objects.length - 1];
		if (!obj || obj.id !== createdId || !isValidObjectRecord(obj, worldIndex.roomById)) {
			return 'delegate-cold';
		}
	} else if (operation === 'layout-object-transform') {
		const objId = changedObjectIds[0];
		const idx = objId ? worldIndex.objectIndexById.get(objId) : undefined;
		if (idx === undefined) return 'delegate-cold';
		const obj = candidate.objects[idx];
		if (!obj || obj.id !== objId || !isValidObjectRecord(obj, worldIndex.roomById)) {
			return 'delegate-cold';
		}
	}

	PENDING_PATCH_BY_DOC.set(candidate, {
		parentDoc: baseline,
		changedJunctionIds: [],
		affectedWallIds: [],
		changedObjectIds
	});
	return 'certified-valid';
}

/**
 * Verify a rectangular Opening scalar update (`offset`, `width`, `height`,
 * `sillHeight`) on a certified clean baseline without scanning unrelated Walls.
 */
export function verifyOpeningUpdateDelta(options: {
	baseline: LayoutDocumentWallFirst;
	candidate: LayoutDocumentWallFirst;
	openingId: string;
	wallId: string;
}): 'certified-valid' | 'delegate-cold' {
	const { baseline, candidate, openingId, wallId } = options;
	const worldIndex = ensureLayoutWorldIndex(baseline);
	if (!worldIndex) return 'delegate-cold';
	const opIdx = worldIndex.openingIndexById.get(openingId);
	if (opIdx === undefined) return 'delegate-cold';
	const nextOp = candidate.openings[opIdx];
	if (
		!nextOp ||
		nextOp.id !== openingId ||
		nextOp.wallId !== wallId ||
		!ID_PATTERN.test(nextOp.id) ||
		!ID_PATTERN.test(nextOp.wallId) ||
		(nextOp.kind !== 'door' && nextOp.kind !== 'window') ||
		!Number.isFinite(nextOp.offset) ||
		nextOp.offset < 0 ||
		!Number.isFinite(nextOp.width) ||
		nextOp.width <= 0 ||
		!Number.isFinite(nextOp.height) ||
		nextOp.height <= 0 ||
		!Number.isFinite(nextOp.sillHeight) ||
		nextOp.sillHeight < 0 ||
		(nextOp.name !== undefined &&
			(typeof nextOp.name !== 'string' || nextOp.name.trim().length === 0)) ||
		(nextOp.profile !== undefined && nextOp.profile !== 'rectangular') ||
		nextOp.connectsRoomIds !== undefined
	) {
		return 'delegate-cold';
	}
	if (!worldIndex.wallById.has(wallId)) return 'delegate-cold';

	const baseWallEntries = worldIndex.openingsByWallId.get(wallId) ?? [];
	const updatedEntries: IndexedOpeningEntry[] = baseWallEntries.map((entry) =>
		entry.index === opIdx ? { opening: nextOp, index: opIdx } : entry
	);
	const subsetIssues = validateWallFirstOpeningSubset(candidate, updatedEntries, {
		wallById: worldIndex.wallById,
		pointById: worldIndex.pointById
	});
	if (subsetIssues.length > 0) return 'delegate-cold';

	PENDING_PATCH_BY_DOC.set(candidate, {
		parentDoc: baseline,
		changedJunctionIds: [],
		affectedWallIds: [],
		changedObjectIds: [],
		changedOpeningWallIds: [wallId]
	});
	return 'certified-valid';
}

// =====================================================================
// Certified World-Index Construction & Incremental Patch Materialization
// =====================================================================

function buildCertifiedWorldIndex(
	document: LayoutDocumentWallFirst
): DocumentWorldIndex | undefined {
	// 1. Complete structural validation (with lazy canonicalJson getter — zero stringify).
	const structural = validateWallFirstLayoutDocument(document);
	if (!structural.success) return undefined;

	const junctionById = new Map<string, LayoutJunction>();
	const junctionIndexById = new Map<string, number>();
	const pointById = new Map<string, LayoutVec2>();
	for (let i = 0; i < document.junctions.length; i += 1) {
		const j = document.junctions[i]!;
		junctionById.set(j.id, j);
		junctionIndexById.set(j.id, i);
		pointById.set(j.id, j.point);
	}

	const wallById = new Map<string, LayoutWall>();
	const wallIndexById = new Map<string, number>();
	const incidentMutable = new Map<string, string[]>();
	for (let i = 0; i < document.walls.length; i += 1) {
		const w = document.walls[i]!;
		wallById.set(w.id, w);
		wallIndexById.set(w.id, i);
		let sList = incidentMutable.get(w.startJunctionId);
		if (!sList) {
			sList = [];
			incidentMutable.set(w.startJunctionId, sList);
		}
		sList.push(w.id);
		if (w.endJunctionId !== w.startJunctionId) {
			let eList = incidentMutable.get(w.endJunctionId);
			if (!eList) {
				eList = [];
				incidentMutable.set(w.endJunctionId, eList);
			}
			eList.push(w.id);
		}
	}

	const unattachedJunctionIds: string[] = [];
	for (let i = 0; i < document.junctions.length; i += 1) {
		const jId = document.junctions[i]!.id;
		if (!incidentMutable.has(jId)) {
			unattachedJunctionIds.push(jId);
		}
	}

	const roomById = new Map<string, LayoutWallFirstRoom>();
	const roomIndexById = new Map<string, number>();
	const roomsByWallMutable = new Map<string, string[]>();
	for (let i = 0; i < document.rooms.length; i += 1) {
		const r = document.rooms[i]!;
		if (r.boundary.length < 3) return undefined;
		roomById.set(r.id, r);
		roomIndexById.set(r.id, i);
		let prevEnd: string | undefined;
		let firstStart: string | undefined;
		const seenOnRoom = new Set<string>();
		for (let b = 0; b < r.boundary.length; b += 1) {
			const ref = r.boundary[b]!;
			const w = wallById.get(ref.wallId);
			if (!w) return undefined;
			const s = ref.direction === 'forward' ? w.startJunctionId : w.endJunctionId;
			const e = ref.direction === 'forward' ? w.endJunctionId : w.startJunctionId;
			if (b === 0) firstStart = s;
			if (prevEnd !== undefined && prevEnd !== s) return undefined;
			prevEnd = e;
			if (!seenOnRoom.has(ref.wallId)) {
				seenOnRoom.add(ref.wallId);
				const list = roomsByWallMutable.get(ref.wallId);
				if (list) list.push(r.id);
				else roomsByWallMutable.set(ref.wallId, [r.id]);
			}
		}
		if (prevEnd !== firstStart) return undefined;
	}

	const openingsByWallMutable = new Map<string, IndexedOpeningEntry[]>();
	const openingIndexById = new Map<string, number>();
	for (let i = 0; i < document.openings.length; i += 1) {
		const opening = document.openings[i]!;
		openingIndexById.set(opening.id, i);
		const list = openingsByWallMutable.get(opening.wallId);
		if (list) list.push({ opening, index: i });
		else openingsByWallMutable.set(opening.wallId, [{ opening, index: i }]);
	}

	const objectById = new Map<string, LayoutObject>();
	const objectIndexById = new Map<string, number>();
	for (let i = 0; i < document.objects.length; i += 1) {
		const obj = document.objects[i]!;
		objectById.set(obj.id, obj);
		objectIndexById.set(obj.id, i);
	}

	const componentKeyByJunctionId = topologyComponentKeyByJunctionId(document);
	const componentKeyByWallId = topologyComponentKeyByWallId(document);

	// 2. Certify baseline Junction coincidence cleanly (silent — index build).
	const candidateJuncPairs = coincidentJunctionPairs(document.junctions);
	for (let i = 0; i < candidateJuncPairs.length; i += 1) {
		const [aIdx, bIdx] = candidateJuncPairs[i]!;
		const a = document.junctions[aIdx]!;
		const b = document.junctions[bIdx]!;
		if (componentKeyByJunctionId.get(a.id) !== componentKeyByJunctionId.get(b.id)) continue;
		if (coincidesAsJunction(a.point, b.point)) return undefined;
	}

	// 3. Resolve all Wall segments, sampled centerlines & build BVH8.
	const wallSegments = new Map<string, TopologySegment>();
	const sampledWallById = new Map<string, SampledTopologyWall>();
	const wallBoxes: PlanBox[] = new Array<PlanBox>(document.walls.length);

	for (let i = 0; i < document.walls.length; i += 1) {
		const w = document.walls[i]!;
		const start = pointById.get(w.startJunctionId);
		const end = pointById.get(w.endJunctionId);
		if (!start || !end) return undefined;
		const len = Math.hypot(end[0] - start[0], end[1] - start[1]);
		if (!(len > POINT_EPSILON)) return undefined;
		const seg: TopologySegment = { id: w.id, start, end };
		wallSegments.set(w.id, seg);

		let samples: readonly CurveSample[];
		if (w.centerline.kind === 'line') {
			samples = chordSamples(seg, len);
		} else {
			const sampled = sampleSegmentQuietly(w, start, end, 'forward');
			if (!sampled) return undefined;
			samples = sampled.samples;
		}
		const sampledWall: SampledTopologyWall = {
			id: w.id,
			startJunctionId: w.startJunctionId,
			endJunctionId: w.endJunctionId,
			samples
		};
		if (w.centerline.kind !== 'line' && sampledWallSelfIntersects(sampledWall)) {
			return undefined;
		}
		sampledWallById.set(w.id, sampledWall);
		wallBoxes[i] = computeIndexedWallBox(seg, samples);
	}

	const wallBvh = createDynamicBvh(wallBoxes);

	// 4. Certify baseline Wall chord & curve crossings via `wallBvh` (`countVisits: false`).
	for (let first = 0; first < document.walls.length; first += 1) {
		const wA = document.walls[first]!;
		const segA = wallSegments.get(wA.id)!;
		const sampA = sampledWallById.get(wA.id)!;
		const compA = componentKeyByWallId.get(wA.id);
		const candidates = wallBvh.overlaps(wallBoxes[first]!, { countVisits: false });
		for (let c = 0; c < candidates.length; c += 1) {
			const second = candidates[c]!;
			if (second <= first) continue;
			const wB = document.walls[second]!;
			if (componentKeyByWallId.get(wB.id) !== compA) continue;
			const segB = wallSegments.get(wB.id)!;
			const shared = sharedJunctions(wA, wB);
			const inter = classifyWallIntersection(segA, segB, shared);
			if (inter.kind === 'shared-explicit-junction') {
				if (classifyWallIntersection(segA, segB, []).kind === 'collinear-overlap') {
					return undefined;
				}
			} else if (inter.kind !== 'none') {
				return undefined;
			}
			if (wA.centerline.kind !== 'line' || wB.centerline.kind !== 'line') {
				const sampB = sampledWallById.get(wB.id)!;
				if (sampledWallExtentsOverlap(sampA, sampB) && sampledWallsCross(sampA, sampB, shared[0])) {
					return undefined;
				}
			}
		}
	}

	// 5. Certify planar combinatorial map, exact 1-to-1 Room face correspondence
	//    and canonical `room.boundary` element equality.
	const mapInfo = buildPlanarCombinatorialMap(document, pointById, wallById);
	if (!mapInfo) return undefined;

	// 6. Certify Opening set and Portal relations on baseline.
	if (document.openings.length > 0) {
		if (!certifyOpeningsQuietly(document, wallById, pointById)) return undefined;
		if (validateWallFirstPortalRelations(document).length > 0) return undefined;
	}

	return {
		junctionsRef: document.junctions,
		wallsRef: document.walls,
		roomsRef: document.rooms,
		openingsRef: document.openings,
		objectsRef: document.objects,
		junctionById,
		junctionIndexById,
		wallById,
		wallIndexById,
		roomById,
		roomIndexById,
		objectById,
		objectIndexById,
		openingIndexById,
		pointById,
		incidentWallIdsByJunctionId: incidentMutable,
		roomsByWallId: roomsByWallMutable,
		openingsByWallId: openingsByWallMutable,
		componentKeyByJunctionId,
		componentKeyByWallId,
		unattachedJunctionIds,
		wallBvh,
		sampledWallById,
		faceGraphWallIdSet: mapInfo.faceGraphWallIdSet,
		starOrderByJunctionId: mapInfo.starOrderByJunctionId,
		walks: mapInfo.walks,
		halfEdgeWalkByKey: mapInfo.halfEdgeWalkByKey
	};
}

function materializePatchedWorldIndex(
	prev: DocumentWorldIndex,
	document: LayoutDocumentWallFirst,
	patch: PendingWorldPatch
): DocumentWorldIndex | undefined {
	const junctionById = new Map(prev.junctionById);
	const pointById = new Map(prev.pointById);
	for (const jId of patch.changedJunctionIds) {
		const idx = prev.junctionIndexById.get(jId);
		if (idx === undefined) return undefined;
		const j = document.junctions[idx]!;
		junctionById.set(jId, j);
		pointById.set(jId, j.point);
	}

	const wallById = new Map(prev.wallById);
	const sampledWallById = new Map(prev.sampledWallById);
	const wallBvh = patch.nextWallBoxes && patch.nextWallBoxes.size > 0 ? prev.wallBvh.clone() : prev.wallBvh;
	for (const wId of patch.affectedWallIds) {
		const idx = prev.wallIndexById.get(wId);
		if (idx === undefined) return undefined;
		const w = document.walls[idx]!;
		wallById.set(wId, w);
		const nextSamp = patch.nextSampledWalls?.get(wId);
		if (nextSamp) sampledWallById.set(wId, nextSamp);
		const nextBox = patch.nextWallBoxes?.get(wId);
		if (nextBox) wallBvh.update(idx, nextBox);
	}

	let objectById = prev.objectById;
	let objectIndexById = prev.objectIndexById;
	if (patch.changedObjectIds.length > 0 || document.objects !== prev.objectsRef) {
		const nextObjById = new Map<string, LayoutObject>();
		const nextObjIdx = new Map<string, number>();
		for (let i = 0; i < document.objects.length; i += 1) {
			const obj = document.objects[i]!;
			nextObjById.set(obj.id, obj);
			nextObjIdx.set(obj.id, i);
		}
		objectById = nextObjById;
		objectIndexById = nextObjIdx;
	}

	let walks = prev.walks;
	if (patch.nextWalkTwiceAreas && patch.nextWalkTwiceAreas.size > 0) {
		const copy = prev.walks.slice();
		for (const [walkIdx, twiceArea] of patch.nextWalkTwiceAreas) {
			const old = copy[walkIdx]!;
			copy[walkIdx] = { twiceSignedArea: twiceArea, wasPositive: old.wasPositive };
		}
		walks = copy;
	}

	let halfEdgeWalkByKey = prev.halfEdgeWalkByKey;
	if (patch.nextHalfEdgeContribs && patch.nextHalfEdgeContribs.size > 0) {
		const copy = new Map(prev.halfEdgeWalkByKey);
		for (const [heKey, contrib] of patch.nextHalfEdgeContribs) {
			const old = copy.get(heKey)!;
			copy.set(heKey, { walkIndex: old.walkIndex, twiceEdgeContrib: contrib });
		}
		halfEdgeWalkByKey = copy;
	}

	let openingsByWallId = prev.openingsByWallId;
	let openingIndexById = prev.openingIndexById;
	if (patch.changedOpeningWallIds && patch.changedOpeningWallIds.length > 0) {
		const copy = new Map(prev.openingsByWallId);
		for (const wId of patch.changedOpeningWallIds) {
			const entries = prev.openingsByWallId.get(wId);
			if (entries) {
				copy.set(
					wId,
					entries.map((entry) => ({
						opening: document.openings[entry.index]!,
						index: entry.index
					}))
				);
			}
		}
		openingsByWallId = copy;
	} else if (document.openings !== prev.openingsRef) {
		const nextOpeningsByWall = new Map<string, IndexedOpeningEntry[]>();
		const nextOpeningIdx = new Map<string, number>();
		for (let i = 0; i < document.openings.length; i += 1) {
			const opening = document.openings[i]!;
			nextOpeningIdx.set(opening.id, i);
			const list = nextOpeningsByWall.get(opening.wallId);
			if (list) list.push({ opening, index: i });
			else nextOpeningsByWall.set(opening.wallId, [{ opening, index: i }]);
		}
		openingsByWallId = nextOpeningsByWall;
		openingIndexById = nextOpeningIdx;
	}

	return {
		...prev,
		junctionsRef: document.junctions,
		wallsRef: document.walls,
		roomsRef: document.rooms,
		openingsRef: document.openings,
		objectsRef: document.objects,
		junctionById,
		pointById,
		wallById,
		objectById,
		objectIndexById,
		openingIndexById,
		openingsByWallId,
		wallBvh,
		sampledWallById,
		walks,
		halfEdgeWalkByKey
	};
}

function buildPlanarCombinatorialMap(
	document: LayoutDocumentWallFirst,
	pointById: ReadonlyMap<string, LayoutVec2>,
	wallById: ReadonlyMap<string, LayoutWall>
): {
	faceGraphWallIdSet: ReadonlySet<string>;
	starOrderByJunctionId: ReadonlyMap<string, readonly HalfEdgeDesc[]>;
	walks: readonly WalkSummary[];
	halfEdgeWalkByKey: ReadonlyMap<string, HalfEdgeWalkLink>;
} | undefined {
	const faceGraphWalls = stripDanglesForIndex(document.walls);
	const faceGraphWallIdSet = new Set(faceGraphWalls.map((w) => w.id));

	const halfEdges: HalfEdgeDesc[] = [];
	for (const w of faceGraphWalls) {
		halfEdges.push({
			fromId: w.startJunctionId,
			toId: w.endJunctionId,
			wallId: w.id,
			direction: 'forward'
		});
		halfEdges.push({
			fromId: w.endJunctionId,
			toId: w.startJunctionId,
			wallId: w.id,
			direction: 'reverse'
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
				(cand) => cand.toId === current.fromId && cand.wallId === current.wallId
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
		let twiceArea = 0;
		for (const half of ring) {
			const w = wallById.get(half.wallId)!;
			const start = pointById.get(w.startJunctionId)!;
			const end = pointById.get(w.endJunctionId)!;
			const contrib = computeHalfEdgeTwiceAreaContrib(w, start, end, half.direction);
			if (contrib === null || !Number.isFinite(contrib)) return undefined;
			twiceArea += contrib;
			halfEdgeWalkByKey.set(`${half.wallId}:${half.direction}`, {
				walkIndex,
				twiceEdgeContrib: contrib
			});
		}
		if (!Number.isFinite(twiceArea) || Math.abs(twiceArea) <= WALK_AREA_GUARD_EPSILON) {
			return undefined;
		}
		const wasPositive = twiceArea > 0;
		walks.push({ twiceSignedArea: twiceArea, wasPositive });
		if (wasPositive) {
			const boundary = ring.map((h) => ({ wallId: h.wallId, direction: h.direction }));
			const faceKey = canonicalBoundaryCycleKey(boundary);
			if (positiveFaceBoundaryByKey.has(faceKey)) return undefined;
			positiveFaceBoundaryByKey.set(faceKey, boundary);
		}
	}

	// Every positive bounded face must map 1-to-1 to a Room in `document.rooms`,
	// and each Room's stored `boundary` must already match the canonical walk
	// sequence element-for-element (so `reconcileRooms` produces the exact same
	// `boundary` array without rotating elements).
	if (positiveFaceBoundaryByKey.size !== document.rooms.length) {
		return undefined;
	}
	const claimedFaceKeys = new Set<string>();
	for (const room of document.rooms) {
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
		halfEdgeWalkByKey
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
			(w) => (degree.get(w.startJunctionId) ?? 0) > 1 && (degree.get(w.endJunctionId) ?? 0) > 1
		);
		if (kept.length === current.length) return current;
		current = kept;
	}
	return [];
}

function compareHalfEdgesWithPoints(
	pointOf: (id: string) => LayoutVec2 | undefined,
	fromId: string,
	a: HalfEdgeDesc,
	b: HalfEdgeDesc
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

function sameCyclicHalfEdgeOrder(
	a: readonly HalfEdgeDesc[],
	b: readonly HalfEdgeDesc[]
): boolean {
	if (a.length !== b.length) return false;
	if (a.length <= 2) {
		// Any two distinct elements have only one cyclic order of length <= 2,
		// provided neither became collinear/degenerate (orientXZ == 0).
		return true;
	}
	const first = a[0]!;
	const offset = b.findIndex(
		(cand) => cand.wallId === first.wallId && cand.direction === first.direction
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

function computeHalfEdgeTwiceAreaContrib(
	wall: LayoutWall,
	canonicalStart: LayoutVec2,
	canonicalEnd: LayoutVec2,
	direction: 'forward' | 'reverse',
	sampling?: WallSamplingDerivation
): number | null {
	const fromPt = direction === 'forward' ? canonicalStart : canonicalEnd;
	const toPt = direction === 'forward' ? canonicalEnd : canonicalStart;
	if (wall.centerline.kind === 'line') {
		return fromPt[0] * toPt[1] - toPt[0] * fromPt[1];
	}
	const sampled = sampling
		? sampling.samples(wall, canonicalStart, canonicalEnd, direction)
		: sampleSegmentQuietly(wall, canonicalStart, canonicalEnd, direction);
	if (!sampled) return null;
	const samples = sampled.samples;
	let sum = 0;
	let prev = fromPt;
	for (let i = 1; i < samples.length - 1; i += 1) {
		const curr = samples[i]!.point;
		sum += prev[0] * curr[1] - curr[0] * prev[1];
		prev = curr;
	}
	sum += prev[0] * toPt[1] - toPt[0] * prev[1];
	return sum;
}

function sampleSegmentQuietly(
	wall: LayoutWall,
	start: LayoutVec2,
	end: LayoutVec2,
	direction: 'forward' | 'reverse'
) {
	return wallCenterlineSamples(wall, start, end, direction);
}

function certifyOpeningsQuietly(
	document: LayoutDocumentWallFirst,
	wallById: ReadonlyMap<string, LayoutWall>,
	pointById: ReadonlyMap<string, LayoutVec2>
): boolean {
	// Validate baseline openings without emitting per-edit lookup work counts.
	const openingsByWall = new Map<string, LayoutWallOpening[]>();
	for (let i = 0; i < document.openings.length; i += 1) {
		const opening = document.openings[i]!;
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
					{ id: wall.endJunctionId, point: end }
				],
				openings: [opening]
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

function chordSamples(segment: TopologySegment, length: number): CurveSample[] {
	return [
		{ point: segment.start, distance: 0, tangent: [1, 0], normal: [0, 1], t: 0 },
		{ point: segment.end, distance: length, tangent: [1, 0], normal: [0, 1], t: 1 }
	];
}

function computeIndexedWallBox(
	segment: TopologySegment,
	samples: readonly CurveSample[]
): PlanBox {
	let minX = Math.min(segment.start[0], segment.end[0]);
	let minZ = Math.min(segment.start[1], segment.end[1]);
	let maxX = Math.max(segment.start[0], segment.end[0]);
	let maxZ = Math.max(segment.start[1], segment.end[1]);
	for (let i = 0; i < samples.length; i += 1) {
		const pt = samples[i]!.point;
		if (pt[0] < minX) minX = pt[0];
		if (pt[1] < minZ) minZ = pt[1];
		if (pt[0] > maxX) maxX = pt[0];
		if (pt[1] > maxZ) maxZ = pt[1];
	}
	const pad = Math.max(SWEPT_INDEX_PAD, CURVE_SELF_INTERSECTION_TOLERANCE);
	return { minX: minX - pad, minZ: minZ - pad, maxX: maxX + pad, maxZ: maxZ + pad };
}

function sharedJunctions(a: LayoutWall, b: LayoutWall): string[] {
	const shared: string[] = [];
	if (a.startJunctionId === b.startJunctionId || a.startJunctionId === b.endJunctionId) {
		shared.push(a.startJunctionId);
	}
	if (
		a.endJunctionId !== a.startJunctionId &&
		(a.endJunctionId === b.startJunctionId || a.endJunctionId === b.endJunctionId)
	) {
		shared.push(a.endJunctionId);
	}
	return shared;
}

function isValidVec2(value: readonly number[]): value is LayoutVec2 {
	return (
		Array.isArray(value) &&
		value.length === 2 &&
		typeof value[0] === 'number' &&
		Number.isFinite(value[0]) &&
		typeof value[1] === 'number' &&
		Number.isFinite(value[1])
	);
}

function isValidWallRecord(wall: LayoutWall): boolean {
	if (!ID_PATTERN.test(wall.id)) return false;
	if (!ID_PATTERN.test(wall.startJunctionId) || !ID_PATTERN.test(wall.endJunctionId)) return false;
	if (wall.startJunctionId === wall.endJunctionId) return false;
	if (typeof wall.thickness !== 'number' || !Number.isFinite(wall.thickness) || wall.thickness <= 0) {
		return false;
	}
	if (typeof wall.height !== 'number' || !Number.isFinite(wall.height) || wall.height <= 0) {
		return false;
	}
	if (wall.name !== undefined && (typeof wall.name !== 'string' || wall.name.trim().length === 0)) {
		return false;
	}
	const cl = wall.centerline;
	if (cl.kind === 'line') return true;
	if (cl.kind !== 'cubic-chain') return false;
	if (cl.spans.length !== cl.knots.length + 1) return false;
	const seenKnotIds = new Set<string>();
	for (let i = 0; i < cl.knots.length; i += 1) {
		const knot = cl.knots[i]!;
		if (!ID_PATTERN.test(knot.id) || seenKnotIds.has(knot.id) || !isValidVec2(knot.point)) {
			return false;
		}
		seenKnotIds.add(knot.id);
	}
	for (let i = 0; i < cl.spans.length; i += 1) {
		const span = cl.spans[i]!;
		if (!isValidVec2(span.handleOut) || !isValidVec2(span.handleIn)) return false;
	}
	return true;
}

function isValidObjectRecord(
	obj: LayoutObject,
	roomById: ReadonlyMap<string, LayoutWallFirstRoom>
): boolean {
	if (!ID_PATTERN.test(obj.id)) return false;
	if (
		obj.position.length !== 3 ||
		!obj.position.every((n) => typeof n === 'number' && Number.isFinite(n))
	) {
		return false;
	}
	if (
		obj.rotation.length !== 3 ||
		!obj.rotation.every((n) => typeof n === 'number' && Number.isFinite(n))
	) {
		return false;
	}
	if (
		obj.dimensions.length !== 3 ||
		!obj.dimensions.every((n) => typeof n === 'number' && Number.isFinite(n) && n > 0)
	) {
		return false;
	}
	if (obj.roomId !== undefined && !roomById.has(obj.roomId)) return false;
	return true;
}
