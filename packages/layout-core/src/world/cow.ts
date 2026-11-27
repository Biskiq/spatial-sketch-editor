import type { LayoutVec2 } from '../geometry/coordinates';
import { cloneWallCenterline, translateWallCenterline } from '../wall/centerline';
import type {
	LayoutDocumentWallFirst,
	LayoutObject,
	LayoutWall,
	LayoutWallCenterline,
	LayoutWallOpening,
} from '../wall/types';
import { countWork } from '../kernel/work-observer';
import { layoutCollectionRef, layoutVector, withLayoutVectors } from '../kernel/source-collections';
import { sourceRecordViews } from './certified-index';
import type { DocumentWorldIndex } from './index-types';
import { peekLayoutWorldIndex } from './lookups';

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

type WeakCowDelta = Omit<CowDocumentDelta, 'baseline'> & {
	readonly parent: WeakRef<LayoutDocumentWallFirst>;
};

const COW_DELTA_BY_DOC = new WeakMap<LayoutDocumentWallFirst, WeakCowDelta>();

export const WORLD_INDEX_BY_DOC = new WeakMap<
	LayoutDocumentWallFirst,
	DocumentWorldIndex | 'invalid'
>();

const EQUIVALENT_ROOT_BY_DOC = new WeakMap<LayoutDocumentWallFirst, object>();

type PreparedCow = {
	operationId: string;
	candidate: LayoutDocumentWallFirst;
	baselineToken: object;
	proofKey?: string;
};

const PREPARED_COW_CANDIDATES = new Map<number, PreparedCow>();

let preparedCowSequence = 0;

const MAX_PREPARED_COW_OPS = 16;

function canonicalCloneRoot(document: LayoutDocumentWallFirst): object {
	let token = EQUIVALENT_ROOT_BY_DOC.get(document);
	if (!token) {
		token = {};
		EQUIVALENT_ROOT_BY_DOC.set(document, token);
	}
	return token;
}

export function areEquivalentLayoutClones(
	left: LayoutDocumentWallFirst,
	right: LayoutDocumentWallFirst,
): boolean {
	return left === right || canonicalCloneRoot(left) === canonicalCloneRoot(right);
}

export function getCowDocumentDelta(
	document: LayoutDocumentWallFirst,
): CowDocumentDelta | undefined {
	const stored = COW_DELTA_BY_DOC.get(document);
	const baseline = stored?.parent.deref();
	if (!stored || !baseline) return undefined;
	const { parent: _parent, ...ids } = stored;
	return { ...ids, baseline };
}

export function registerCowDocumentDelta(
	document: LayoutDocumentWallFirst,
	delta: CowDocumentDelta,
): void {
	const { baseline, ...ids } = delta;
	COW_DELTA_BY_DOC.set(document, { ...ids, parent: new WeakRef(baseline) });
}

/**
 * Propagate verified COW lineage and persistent world-index roots from a planner
 * candidate onto an immutable `structuredClone` or validated parse copy.
 */
export function linkClonedCowCandidate(
	originalCandidate: LayoutDocumentWallFirst,
	clonedCandidate: LayoutDocumentWallFirst,
): void {
	if (originalCandidate === clonedCandidate) return;
	const root = canonicalCloneRoot(originalCandidate);
	EQUIVALENT_ROOT_BY_DOC.set(originalCandidate, root);
	EQUIVALENT_ROOT_BY_DOC.set(clonedCandidate, root);
	const delta = COW_DELTA_BY_DOC.get(originalCandidate);
	if (delta) COW_DELTA_BY_DOC.set(clonedCandidate, delta);
	// A clone's native arrays are already indexable. Do not eagerly copy them
	// into vectors while an owning boundary has yet to freeze the clone. The
	// next write can borrow its then-immutable array root in constant work.
	const existingIndex = peekLayoutWorldIndex(originalCandidate);
	if (existingIndex && !WORLD_INDEX_BY_DOC.has(clonedCandidate)) {
		WORLD_INDEX_BY_DOC.set(clonedCandidate, {
			...existingIndex,
			...sourceRecordViews(clonedCandidate, existingIndex),
			junctionsRef: layoutCollectionRef(clonedCandidate, 'junctions'),
			wallsRef: layoutCollectionRef(clonedCandidate, 'walls'),
			roomsRef: layoutCollectionRef(clonedCandidate, 'rooms'),
			openingsRef: layoutCollectionRef(clonedCandidate, 'openings'),
			objectsRef: layoutCollectionRef(clonedCandidate, 'objects'),
		});
	}
}

/**
 * Record a prepared COW Layout candidate by `operationId` so the Stage host can
 * link F4's captured accepted copy back to its COW lineage. Token/index rebinding
 * is constant root work; a first write to an unowned mutable source may copy N slots.
 */
export function recordPreparedCowCandidate(
	operationId: string,
	document: LayoutDocumentWallFirst,
	proofKey?: string,
): void {
	const delta = getCowDocumentDelta(document);
	if (!operationId || !delta) return;
	const baselineToken = canonicalCloneRoot(delta.baseline);
	for (const [key, entry] of PREPARED_COW_CANDIDATES) {
		countWork('session:prepared-cache-test');
		if (
			entry.operationId === operationId &&
			entry.baselineToken === baselineToken &&
			entry.proofKey === proofKey
		)
			PREPARED_COW_CANDIDATES.delete(key);
	}
	if (PREPARED_COW_CANDIDATES.size >= MAX_PREPARED_COW_OPS) {
		const oldestKey = PREPARED_COW_CANDIDATES.keys().next().value;
		if (oldestKey !== undefined) PREPARED_COW_CANDIDATES.delete(oldestKey);
	}
	PREPARED_COW_CANDIDATES.set(preparedCowSequence++, {
		operationId,
		candidate: document,
		baselineToken,
		proofKey,
	});
}

/** A bounded artifact lookup. Production qualifies both the captured baseline
 * and canonical intent data; equal operation IDs in other hosts cannot alias.
 * Baseline-only consumption is for terminal cleanup, never a reuse proof. */
export function consumePreparedCowCandidate(
	operationId: string,
	proof?: { readonly baseline: LayoutDocumentWallFirst; readonly key?: string },
): LayoutDocumentWallFirst | undefined {
	const token = proof ? canonicalCloneRoot(proof.baseline) : undefined;
	for (const [key, entry] of PREPARED_COW_CANDIDATES) {
		countWork('session:prepared-cache-test');
		if (
			entry.operationId !== operationId ||
			(proof && entry.baselineToken !== token) ||
			(proof?.key !== undefined && entry.proofKey !== proof.key)
		)
			continue;
		PREPARED_COW_CANDIDATES.delete(key);
		return entry.candidate;
	}
	return undefined;
}

export function matchesArrayRefs(
	document: LayoutDocumentWallFirst,
	index: DocumentWorldIndex,
): boolean {
	return (
		layoutCollectionRef(document, 'junctions') === index.junctionsRef &&
		layoutCollectionRef(document, 'walls') === index.wallsRef &&
		layoutCollectionRef(document, 'rooms') === index.roomsRef &&
		layoutCollectionRef(document, 'openings') === index.openingsRef &&
		layoutCollectionRef(document, 'objects') === index.objectsRef
	);
}

// =====================================================================
// Copy-on-Write (COW) Candidate Builders
// =====================================================================

export function cowMoveJunctions(
	baseline: LayoutDocumentWallFirst,
	targetPoints: ReadonlyMap<string, LayoutVec2>,
	changedWallIds: readonly string[],
	worldIndex?: DocumentWorldIndex,
): LayoutDocumentWallFirst {
	let nextJunctions = layoutVector(baseline, 'junctions');
	if (worldIndex) {
		for (const [id, pt] of targetPoints) {
			const idx = worldIndex.junctionIndexById.get(id);
			if (idx !== undefined) {
				nextJunctions = nextJunctions.set(idx, { id, point: [pt[0], pt[1]] });
			}
		}
	} else {
		for (let i = 0; i < nextJunctions.length; i += 1) {
			const j = nextJunctions.get(i)!;
			const pt = targetPoints.get(j.id);
			if (pt) nextJunctions = nextJunctions.set(i, { id: j.id, point: [pt[0], pt[1]] });
		}
	}
	// Refresh changed walls' centerline objects so P1 / centerline identity
	// contracts hold even when only endpoint coordinates moved.
	let nextWalls = layoutVector(baseline, 'walls');
	if (worldIndex) {
		for (const wallId of changedWallIds) {
			const idx = worldIndex.wallIndexById.get(wallId);
			if (idx !== undefined) {
				const w = nextWalls.get(idx)!;
				nextWalls = nextWalls.set(idx, cloneWallRecord(w, cloneWallCenterline(w.centerline)));
			}
		}
	} else {
		const wallSet = new Set(changedWallIds);
		for (let i = 0; i < nextWalls.length; i += 1) {
			const w = nextWalls.get(i)!;
			if (wallSet.has(w.id)) {
				nextWalls = nextWalls.set(i, cloneWallRecord(w, cloneWallCenterline(w.centerline)));
			}
		}
	}
	const candidate = withLayoutVectors(baseline, {
		junctions: nextJunctions,
		walls: nextWalls,
	});
	registerCowDocumentDelta(candidate, {
		baseline,
		changedJunctionIds: [...targetPoints.keys()],
		changedWallIds: [...changedWallIds],
		changedOpeningIds: [],
		changedRoomIds: [],
		changedObjectIds: [],
	});
	return candidate;
}

export function cowMoveRigidWall(
	baseline: LayoutDocumentWallFirst,
	wallId: string,
	delta: LayoutVec2,
	changedJunctionIds: readonly string[],
	changedWallIds: readonly string[],
	worldIndex?: DocumentWorldIndex,
): LayoutDocumentWallFirst {
	let nextJunctions = layoutVector(baseline, 'junctions');
	if (worldIndex) {
		for (const jId of changedJunctionIds) {
			const idx = worldIndex.junctionIndexById.get(jId);
			if (idx !== undefined) {
				const j = nextJunctions.get(idx)!;
				nextJunctions = nextJunctions.set(idx, {
					id: j.id,
					point: [j.point[0] + delta[0], j.point[1] + delta[1]],
				});
			}
		}
	} else {
		const jSet = new Set(changedJunctionIds);
		for (let i = 0; i < nextJunctions.length; i += 1) {
			const j = nextJunctions.get(i)!;
			if (jSet.has(j.id)) {
				nextJunctions = nextJunctions.set(i, {
					id: j.id,
					point: [j.point[0] + delta[0], j.point[1] + delta[1]],
				});
			}
		}
	}

	let nextWalls = layoutVector(baseline, 'walls');
	if (worldIndex) {
		for (const cWallId of changedWallIds) {
			const idx = worldIndex.wallIndexById.get(cWallId);
			if (idx !== undefined) {
				const w = nextWalls.get(idx)!;
				const centerline =
					cWallId === wallId
						? translateWallCenterline(w.centerline, delta)
						: cloneWallCenterline(w.centerline);
				nextWalls = nextWalls.set(idx, cloneWallRecord(w, centerline));
			}
		}
	} else {
		const wSet = new Set(changedWallIds);
		for (let i = 0; i < nextWalls.length; i += 1) {
			const w = nextWalls.get(i)!;
			if (wSet.has(w.id)) {
				const centerline =
					w.id === wallId
						? translateWallCenterline(w.centerline, delta)
						: cloneWallCenterline(w.centerline);
				nextWalls = nextWalls.set(i, cloneWallRecord(w, centerline));
			}
		}
	}

	const candidate = withLayoutVectors(baseline, {
		junctions: nextJunctions,
		walls: nextWalls,
	});
	registerCowDocumentDelta(candidate, {
		baseline,
		changedJunctionIds: [...changedJunctionIds],
		changedWallIds: [...changedWallIds],
		changedOpeningIds: [],
		changedRoomIds: [],
		changedObjectIds: [],
	});
	return candidate;
}

export function cowSetWallCenterline(
	baseline: LayoutDocumentWallFirst,
	wallId: string,
	centerline: LayoutWallCenterline,
	worldIndex?: DocumentWorldIndex,
): LayoutDocumentWallFirst {
	let nextWalls = layoutVector(baseline, 'walls');
	const clonedCenterline = cloneWallCenterline(centerline);
	if (worldIndex) {
		const idx = worldIndex.wallIndexById.get(wallId);
		if (idx !== undefined) {
			nextWalls = nextWalls.set(idx, cloneWallRecord(nextWalls.get(idx)!, clonedCenterline));
		}
	} else {
		const idx = nextWalls.toArray().findIndex((w) => w.id === wallId);
		if (idx !== -1) {
			nextWalls = nextWalls.set(idx, cloneWallRecord(nextWalls.get(idx)!, clonedCenterline));
		}
	}
	const candidate = withLayoutVectors(baseline, {
		walls: nextWalls,
	});
	registerCowDocumentDelta(candidate, {
		baseline,
		changedJunctionIds: [],
		changedWallIds: [wallId],
		changedOpeningIds: [],
		changedRoomIds: [],
		changedObjectIds: [],
	});
	return candidate;
}

export function cowSetWallScalar(
	baseline: LayoutDocumentWallFirst,
	wallId: string,
	patch: { thickness?: number; height?: number },
	worldIndex?: DocumentWorldIndex,
): LayoutDocumentWallFirst {
	let nextWalls = layoutVector(baseline, 'walls');
	const updateAt = (idx: number): void => {
		const w = nextWalls.get(idx)!;
		nextWalls = nextWalls.set(idx, {
			id: w.id,
			startJunctionId: w.startJunctionId,
			endJunctionId: w.endJunctionId,
			thickness: patch.thickness ?? w.thickness,
			height: patch.height ?? w.height,
			// A scalar edit shifts the whole top rigidly: the rises are unchanged.
			top: w.top,
			centerline: cloneWallCenterline(w.centerline),
			...(w.name !== undefined ? { name: w.name } : {}),
		});
	};
	if (worldIndex) {
		const idx = worldIndex.wallIndexById.get(wallId);
		if (idx !== undefined) updateAt(idx);
	} else {
		const idx = nextWalls.toArray().findIndex((w) => w.id === wallId);
		if (idx !== -1) updateAt(idx);
	}
	const candidate = withLayoutVectors(baseline, {
		walls: nextWalls,
	});
	registerCowDocumentDelta(candidate, {
		baseline,
		changedJunctionIds: [],
		changedWallIds: [wallId],
		changedOpeningIds: [],
		changedRoomIds: [],
		changedObjectIds: [],
	});
	return candidate;
}

export function cowCreateObject(
	baseline: LayoutDocumentWallFirst,
	object: LayoutObject,
): LayoutDocumentWallFirst {
	const freshObject = cloneObjectRecord(object);
	const candidate = buildCowWrapper(baseline, {
		objects: [...baseline.objects, freshObject],
	});
	registerCowDocumentDelta(candidate, {
		baseline,
		changedJunctionIds: [],
		changedWallIds: [],
		changedOpeningIds: [],
		changedRoomIds: [],
		changedObjectIds: [freshObject.id],
	});
	return candidate;
}

export function cowUpdateObject(
	baseline: LayoutDocumentWallFirst,
	objectId: string,
	updater: (existing: LayoutObject) => LayoutObject,
	worldIndex?: DocumentWorldIndex,
): LayoutDocumentWallFirst {
	let nextObjects = layoutVector(baseline, 'objects');
	if (worldIndex) {
		const idx = worldIndex.objectIndexById.get(objectId);
		if (idx !== undefined) {
			nextObjects = nextObjects.set(idx, cloneObjectRecord(updater(nextObjects.get(idx)!)));
		}
	} else {
		const idx = nextObjects.toArray().findIndex((o) => o.id === objectId);
		if (idx !== -1) {
			nextObjects = nextObjects.set(idx, cloneObjectRecord(updater(nextObjects.get(idx)!)));
		}
	}
	const candidate = withLayoutVectors(baseline, {
		objects: nextObjects,
	});
	registerCowDocumentDelta(candidate, {
		baseline,
		changedJunctionIds: [],
		changedWallIds: [],
		changedOpeningIds: [],
		changedRoomIds: [],
		changedObjectIds: [objectId],
	});
	return candidate;
}

export function cowDeleteObject(
	baseline: LayoutDocumentWallFirst,
	objectId: string,
): LayoutDocumentWallFirst {
	const candidate = buildCowWrapper(baseline, {
		objects: baseline.objects.filter((entry) => entry.id !== objectId),
	});
	registerCowDocumentDelta(candidate, {
		baseline,
		changedJunctionIds: [],
		changedWallIds: [],
		changedOpeningIds: [],
		changedRoomIds: [],
		changedObjectIds: [objectId],
	});
	return candidate;
}

export function cowUpdateOpening(
	baseline: LayoutDocumentWallFirst,
	openingId: string,
	nextOpening: LayoutWallOpening,
	worldIndex?: DocumentWorldIndex,
): LayoutDocumentWallFirst {
	let nextOpenings = layoutVector(baseline, 'openings');
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
			: {}),
	};
	if (worldIndex) {
		const idx = worldIndex.openingIndexById.get(openingId);
		if (idx !== undefined && nextOpenings.get(idx)?.id === openingId) {
			nextOpenings = nextOpenings.set(idx, freshOpening);
		} else {
			const fallbackIdx = nextOpenings.toArray().findIndex((o) => o.id === openingId);
			if (fallbackIdx !== -1) nextOpenings = nextOpenings.set(fallbackIdx, freshOpening);
		}
	} else {
		const idx = nextOpenings.toArray().findIndex((o) => o.id === openingId);
		if (idx !== -1) nextOpenings = nextOpenings.set(idx, freshOpening);
	}
	const candidate = withLayoutVectors(baseline, { openings: nextOpenings });
	registerCowDocumentDelta(candidate, {
		baseline,
		changedJunctionIds: [],
		changedWallIds: [],
		changedOpeningIds: [openingId],
		changedRoomIds: [],
		changedObjectIds: [],
	});
	return candidate;
}

function buildCowWrapper(
	baseline: LayoutDocumentWallFirst,
	overrides: Partial<
		Pick<LayoutDocumentWallFirst, 'junctions' | 'walls' | 'rooms' | 'openings' | 'objects'>
	>,
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
		regions: baseline.regions,
		...(baseline.identity !== undefined ? { identity: baseline.identity } : {}),
	};
}

function cloneWallRecord(wall: LayoutWall, centerline: LayoutWallCenterline): LayoutWall {
	return {
		id: wall.id,
		startJunctionId: wall.startJunctionId,
		endJunctionId: wall.endJunctionId,
		thickness: wall.thickness,
		height: wall.height,
		top: wall.top,
		centerline,
		...(wall.name !== undefined ? { name: wall.name } : {}),
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
											point: [anchor.point[0], anchor.point[1]] as LayoutVec2,
										})),
									}
								: {
										id: segment.id,
										kind: 'line' as const,
										start: [segment.start[0], segment.start[1]] as LayoutVec2,
										end: [segment.end[0], segment.end[1]] as LayoutVec2,
									},
						),
					},
				}
			: {}),
		...(object.roomId !== undefined ? { roomId: object.roomId } : {}),
	};
}
