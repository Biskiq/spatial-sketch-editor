import type { LayoutDocumentWallFirst, LayoutWallFirstRoom } from '../wall/types';
import { geometryId } from '../geometry/types';
import type { LayoutVec2 } from '../geometry/coordinates';
import { spaceOutlineSelfIntersects, spaceOutlineSignedArea, spacePairIssue } from './space-outline';
import { rotateBoundaryToSeam, roundRoomSeamJunctionId } from './round-room';
import type { FaceExtractionResult } from '../geometry/face-extraction';
import type { CarriedSpaceEdge } from './reconciliation-survivors';
import { carriedBoundaryEdges, carriedBoundaryParts, carriedCyclePolygon, chooseMergeSurvivor, chooseSplitSurvivor, failure, normalizeCarriedEdges, remapPortalRelations, roomOutlinePolygon, spliceCarriedEdges } from './reconciliation-survivors';
import type { ComponentLineage, ReconciliationResult, RoomIdAllocator, RoomLineageRecord, SpaceLifecyclePolicy, SpaceRetirement, SpaceRetirementReason } from './reconciliation-types';

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
	/** Lifecycle policy; omitted keeps the shipped `retire` behaviour. */
	spacePolicy?: SpaceLifecyclePolicy;
	/**
	 * Candidate Room records before reconciliation. Non-removal operations may
	 * rewrite an open Room's boundary (split, join, move); the carry rule reads
	 * that rewrite instead of restoring the baseline reference list.
	 */
	candidateRooms?: readonly LayoutWallFirstRoom[];
	allocator: RoomIdAllocator;
}): ReconciliationResult {
	const { baseline, candidateDocument, extraction, components, allocator } = options;
	const policy: SpaceLifecyclePolicy = options.spacePolicy ?? { invalidOutline: 'reject' };
	const forcedRetireIds = new Set(policy.retireRoomIds ?? []);
	const predecessorWitnesses = options.predecessorWitnesses ?? new Map<string, LayoutVec2>();
	const predecessorPolygons =
		options.predecessorPolygons ?? new Map<string, readonly LayoutVec2[]>();
	const predecessorRooms = new Map(baseline.rooms.map((room) => [room.id, room]));
	const facesByKey = new Map(extraction.faces.map((face) => [face.key, face]));
	for (const roomId of forcedRetireIds) {
		if (!predecessorRooms.has(roomId)) {
			return failure({
				code: 'unsupported_component',
				message: `Retire list references unknown predecessor room '${roomId}'`,
				roomIds: [roomId]
			});
		}
	}
	// Owner clarification: explicit retirement outranks a face claim. A forced
	// predecessor is removed from every component BEFORE classification, so no
	// candidate face can preserve it (a 2→1 component becomes 1→1 in favour of
	// the other predecessor). If that leaves a face with no predecessor the
	// command refuses rather than birthing a replacement Room.
	const effectiveComponents: ComponentLineage[] = [];
	for (const component of components) {
		const predecessors = component.predecessorRoomIds.filter((id) => !forcedRetireIds.has(id));
		if (
			component.predecessorRoomIds.length > 0 &&
			predecessors.length === 0 &&
			component.candidateFaceKeys.length > 0
		) {
			return failure({
				code: 'unsupported_component',
				message: `Room(s) ${component.predecessorRoomIds.join(', ')} are retired by intent but still claim candidate face(s); no replacement Room is born`,
				roomIds: [...component.predecessorRoomIds]
			});
		}
		if (predecessors.length === 0 && component.candidateFaceKeys.length === 0) continue;
		effectiveComponents.push({
			candidateFaceKeys: component.candidateFaceKeys,
			predecessorRoomIds: predecessors
		});
	}

	const claimedFaces = new Set<string>();
	const claimedPredecessors = new Set<string>();
	const lineage: RoomLineageRecord[] = [];
	const retiredRoomIds: string[] = [];
	const finalRooms: LayoutWallFirstRoom[] = [];
	// Baseline names seed the allocator namespace (review round 1): births
	// during multi-component operations must never reuse a pre-existing name.
	const takenNames = new Set(baseline.rooms.map((room) => room.name));

	for (const component of effectiveComponents) {
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

	for (const component of effectiveComponents) {
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
					virtualEdges: [],
					overhead: 'closed',


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
			const candidateRoom = options.candidateRooms?.find((r) => r.id === predecessor.id);
			const survivingRound = candidateRoom !== undefined ? candidateRoom.round : predecessor.round;
			let boundary = [...face.boundary];
			if (survivingRound !== undefined) {
				const baselineWallById = new Map(baseline.walls.map((w) => [w.id, w] as const));
				const candidateWallById = new Map(candidateDocument.walls.map((w) => [w.id, w] as const));
				const seamJunctionId = roundRoomSeamJunctionId(predecessor, baselineWallById);
				if (!seamJunctionId) {
					return failure({
						code: 'unsupported_component',
						message: `Round Room '${predecessor.id}' has no resolvable seam Junction`,
						roomIds: [predecessor.id]
					});
				}
				const rotated = rotateBoundaryToSeam(boundary, seamJunctionId, candidateWallById);
				if (!rotated) {
					return failure({
						code: 'unsupported_component',
						message: `Round Room '${predecessor.id}' cannot retain seam Junction '${seamJunctionId}'`,
						roomIds: [predecessor.id]
					});
				}
				boundary = rotated;
			}
			const { round: _discardRound, ...predecessorBase } = predecessor;
			finalRooms.push({
				...predecessorBase,
				boundary,
				// A predecessor claimed by a face becomes enclosed: the face is its
				// whole boundary, so no open side survives.
				virtualEdges: [],
				...(survivingRound !== undefined ? { round: survivingRound } : {})
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
			// Dividing a Round Room clears Round from both the survivor and born descendant.
			const { round: _clearedSplitRound, ...predecessorWithoutRound } = predecessor;
			finalRooms.push({
				...predecessorWithoutRound,
				boundary: [...winner.boundary],
				virtualEdges: []
			});
			finalRooms.push({
				id: newRoomId,
				name: newName,
				boundary: [...loser.boundary],
				virtualEdges: [],
				overhead: predecessor.overhead,


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
			// Merging clears Round on the changed enclosure.
			const { round: _clearedMergeRound, ...winnerWithoutRound } = winner;
			finalRooms.push({
				...winnerWithoutRound,
				boundary: [...face.boundary],
				virtualEdges: []
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

	// --- Space lifecycle: forced retire, carry, merge, support, outline gate --
	const survivingPredecessors = new Set<string>();
	for (const component of effectiveComponents) {
		for (const id of component.predecessorRoomIds) survivingPredecessors.add(id);
	}
	const retiredForSpaceIds = new Set<string>();
	const spaceRetirements: SpaceRetirement[] = [];
	const retireSpace = (
		roomId: string,
		reason: SpaceRetirementReason,
		extra: { otherRoomIds?: readonly string[]; successorRoomId?: string } = {}
	): void => {
		if (!retiredForSpaceIds.has(roomId)) {
			retiredForSpaceIds.add(roomId);
			spaceRetirements.push({ roomId, reason, ...extra });
		}
		if (!retiredRoomIds.includes(roomId)) retiredRoomIds.push(roomId);
		// A successor that itself retires cannot receive object/portal remaps.
		// Dropping its record makes the remap see a retired predecessor with no
		// successor and clear the association instead of naming a missing Room.
		for (let index = lineage.length - 1; index >= 0; index -= 1) {
			if (lineage[index]!.roomId === roomId) lineage.splice(index, 1);
		}
	};
	// Forced retirement outranks any face claim (owner clarification): the
	// predecessors were removed from every component above, so no candidate
	// face can preserve them.
	for (const roomId of forcedRetireIds) retireSpace(roomId, 'explicit-remove');

	const carriedRoomIds: string[] = [];
	const carriedRooms: LayoutWallFirstRoom[] = [];
	{
		const removedWallIds = new Set(policy.removedWalls ?? []);
		const wallById = new Map(baseline.walls.map((wall) => [wall.id, wall]));
		const carried: Array<{
			room: LayoutWallFirstRoom;
			edges: CarriedSpaceEdge[];
			/** Original Spaces folded into this entry by open merge. */
			predecessorRoomIds: string[];
		}> = [];
		for (const room of baseline.rooms) {
			if (survivingPredecessors.has(room.id) || forcedRetireIds.has(room.id)) continue;
			// Removals must compose the baseline boundary (the candidate records
			// still name the erased Walls). Non-removal edits use the candidate
			// record, which may already carry a split/joined boundary.
			const candidateRoom = removedWallIds.size === 0
				? options.candidateRooms?.find((record) => record.id === room.id)
				: undefined;
			const result = candidateRoom
				? carriedBoundaryEdges(candidateDocument, candidateRoom, removedWallIds)
				: carriedBoundaryEdges(baseline, room, removedWallIds);
			if (result.kind === 'failed') {
				return failure({
					code: 'unsupported_component',
					message: `Predecessor Space '${room.id}' cannot carry its boundary: ${result.message}`,
					roomIds: [room.id]
				});
			}
			carried.push({ room: candidateRoom ?? room, edges: result.edges, predecessorRoomIds: [room.id] });
		}

		// Open merge (ratified extended merge rule): a removed Wall referenced by
		// two carried predecessors splices their cycles at its ends into one
		// Space. Three or more refuses with today's 3+→1 parity.
		for (const removedWallId of policy.removedWalls ?? []) {
			const wall = wallById.get(removedWallId);
			if (!wall) continue;
			// Ownership is deleted-Wall PROVENANCE, never endpoint coincidence: an
			// authored virtual edge may lie exactly where this Wall was without ever
			// referencing it, and splicing on that coincidence would merge two
			// Spaces the operation did not join and retire the wrong identity.
			const owners = carried.filter((entry) =>
				entry.edges.some(
					(edge) => edge.kind === 'virtual' && edge.replacedWallId === removedWallId
				)
			);
			if (owners.length > 2) {
				return failure({
					code: 'unsupported_component',
					message: `Wall '${removedWallId}' is shared by ${owners.length} Spaces; joining three or more is unsupported`,
					roomIds: owners.map((owner) => owner.room.id)
				});
			}
			if (owners.length !== 2) continue;
			const first = owners[0]!;
			const second = owners[1]!;
			const mergedPredecessorIds = [...new Set([...first.predecessorRoomIds, ...second.predecessorRoomIds])];
			if (mergedPredecessorIds.length > 2) {
				return failure({
					code: 'unsupported_component',
					message: `Deleting this Wall set would join ${mergedPredecessorIds.length} Spaces in one operation; joining three or more is unsupported`,
					roomIds: mergedPredecessorIds
				});
			}
			const spliced = spliceCarriedEdges(first.edges, second.edges, wall);
			if (!spliced) {
				return failure({
					code: 'unsupported_component',
					message: `Wall '${removedWallId}' does not fall between the same two carried Spaces`,
					roomIds: [first.room.id, second.room.id]
				});
			}
			const mergedPolygon = carriedCyclePolygon(candidateDocument, first.room.id, spliced) ?? [];
			const winner = chooseMergeSurvivor({
				predecessors: [first.room, second.room],
				face: { polygon: mergedPolygon },
				overlapPolygons: predecessorPolygons
			});
			if (!winner) {
				return failure({
					code: 'ambiguous_room_correspondence',
					message: `Merge of Spaces '${first.room.id}' and '${second.room.id}' has no deterministic survivor`,
					roomIds: [first.room.id, second.room.id]
				});
			}
			const winnerEntry = winner.id === first.room.id ? first : second;
			const loser = winner.id === first.room.id ? second : first;
			winnerEntry.edges = spliced;
			winnerEntry.predecessorRoomIds = mergedPredecessorIds;
			const firstIndex = carried.indexOf(first);
			const secondIndex = carried.indexOf(second);
			carried[firstIndex] = winnerEntry;
			carried.splice(secondIndex, 1);
			lineage.push({
				faceKey: geometryId(['space-merge', ...mergedPredecessorIds.slice().sort()]),
				roomId: winner.id,
				predecessorRoomIds: mergedPredecessorIds,
				kind: 'merge-survivor'
			});
			// The survivor's overhead wins (ratified default); thicknesses were
			// checked above.
			retireSpace(loser.room.id, 'merged', {
				otherRoomIds: [winner.id],
				successorRoomId: winner.id
			});
		}

		const baselineIndex = new Map(baseline.rooms.map((room, index) => [room.id, index]));
		const orderedCarried = [...carried].sort(
			(a, b) => (baselineIndex.get(a.room.id) ?? 0) - (baselineIndex.get(b.room.id) ?? 0)
		);
		for (const entry of orderedCarried) {
			const parts = carriedBoundaryParts(normalizeCarriedEdges(entry.edges));
			if (parts.boundary.length === 0) {
				// Support rule: the last Wall stands or the Space goes.
				retireSpace(entry.room.id, 'last-boundary-wall');
				continue;
			}
			const { round: _clearedCarriedRound, ...carriedBase } = entry.room;
			carriedRooms.push({ ...carriedBase, boundary: parts.boundary, virtualEdges: parts.virtualEdges });
		}

		// Outline gate (I4/I7) over the provisional candidate. Carried Spaces are
		// evaluated in baseline document order; a retired failure leaves the
		// provisional set before the next is checked, so the outcome is
		// deterministic.
		const provisional = [...finalRooms, ...carriedRooms];
		const polygonCache = new Map<string, readonly LayoutVec2[] | null>();
				const polygonOf = (room: LayoutWallFirstRoom): readonly LayoutVec2[] | null => {
			if (!polygonCache.has(room.id)) {
				polygonCache.set(room.id, roomOutlinePolygon(candidateDocument, room));
			}
			return polygonCache.get(room.id) ?? null;
		};
		for (const room of carriedRooms) {
			const polygon = polygonOf(room);
			let failureReason: SpaceRetirementReason | null = null;
			let otherRoomId: string | undefined;
			let message = '';
			if (!polygon || spaceOutlineSignedArea(polygon) <= 1e-9) {
				failureReason = 'outline-not-positive';
				message = `Space '${room.name}' would have no positive outline`;
			} else if (spaceOutlineSelfIntersects(polygon)) {
				failureReason = 'outline-self-intersects';
				message = `Space '${room.name}' would have an outline that crosses itself`;
			} else {
				for (const other of provisional) {
					if (other.id === room.id) continue;
					const otherPolygon = polygonOf(other);
					if (!otherPolygon) continue;
					const issue = spacePairIssue(polygon, otherPolygon, true, other.virtualEdges.length > 0);
					if (!issue) continue;
					failureReason = issue === 'space_overlap' ? 'overlaps' : 'contains';
					otherRoomId = other.id;
					message =
						issue === 'space_overlap'
							? `Space '${room.name}' would overlap Space '${other.name}'`
							: `Space '${room.name}' would contain Space '${other.name}'`;
					break;
				}
			}
			if (!failureReason) {
				carriedRoomIds.push(room.id);
				continue;
			}
			if (policy.invalidOutline === 'retire') {
				const index = provisional.indexOf(room);
				if (index >= 0) provisional.splice(index, 1);
				polygonCache.delete(room.id);
				retireSpace(room.id, failureReason, otherRoomId ? { otherRoomIds: [otherRoomId] } : {});
				continue;
			}
			return failure({
				code: 'space_outline_invalid',
				message,
				roomIds: otherRoomId ? [room.id, otherRoomId] : [room.id]
			});
		}
		for (const room of carriedRooms) {
			if (carriedRoomIds.includes(room.id)) finalRooms.push(room);
		}
	}


	// --- layout-object semantic associations ------------------------
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
		retiredRoomIds,
		carriedRoomIds,
		spaceRetirements
	};
}


/**
 * Alias kept for call-site readability: reconciliation with explicit baseline
 * room polygons (temporary overlap evidence derived from pre-edit compiled
 * geometry; never persisted).
 */
export const reconcileRoomsWithGeometry = reconcileRooms;
