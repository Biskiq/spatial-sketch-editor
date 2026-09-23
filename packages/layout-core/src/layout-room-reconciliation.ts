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
 * A side that has no resolvable component (the operation replaced every Wall of
 * that Room, so no authored identity survives) is left UNDEFINED and the caller
 * falls back to geometric evidence for that pair alone — the legacy behaviour
 * the old rule existed for. Where BOTH sides resolve, the component labels must
 * MATCH for a union to be authorized at all.
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
 * Yes when the two component labels agree. When either side is unresolvable the
 * pair is left to the geometric evidence, because no identity claim can be made
 * about it in either direction.
 */
function unionAuthorized(
	authorization: CorrespondenceAuthorization,
	predecessorRoomId: string,
	faceKey: string
): boolean {
	const predecessorKey = authorization.predecessorComponentKeyByRoomId.get(predecessorRoomId);
	const faceKeyValue = authorization.faceComponentKeyByKey.get(faceKey);
	if (predecessorKey === undefined || faceKeyValue === undefined) return true;
	return predecessorKey === faceKeyValue;
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
	faces.forEach((face, faceIndex) => {
		predecessorRoomIds.forEach((roomId, predIndex) => {
			const witness = predecessorWitnesses.get(roomId);
			const polygon = predecessorPolygons.get(roomId);
			const inside = witness !== undefined && pointStrictlyInsidePolygon(face.polygon, witness);
			// Exact adjacency-aware overlap: Rooms that merely share a Wall (any
			// angle) are neighbours, never one component. The sampled
			// `polygonIntersectionArea` (still used below for survivor ranking)
			// reported a phantom sliver for oblique shared edges.
			const overlap = polygon !== undefined && polygonsShareInteriorArea(polygon, face.polygon);
			if (!inside && !overlap) return;
			// P23B.3a D-12 — AUTHORIZATION. Geometry is evidence, not permission: a
			// predecessor Room and a candidate face may join only when authored
			// identity puts them in the SAME connected component of the candidate Wall
			// graph. Two coincident or contained graph-INDEPENDENT Rooms therefore stay
			// two correspondence components, so overlap alone can never merge, retire or
			// reassign an unrelated Room's identity or its owned objects.
			if (!unionAuthorized(authorization, roomId, face.key)) return;
			union(predIndex, predecessorCount + faceIndex);
		});
	});
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
