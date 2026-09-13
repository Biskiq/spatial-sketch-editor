/**
 * `layout-wall-topology-ops.ts` — P23.0 F0 stage 2: canonical wall-first
 * authoring planners over the P23.8 topology/reconciliation engine.
 *
 * Stage-2 scope (P23.0 execution order, item 2): the canonical writers for
 * the P23 minimum are **planners** — explicit-intent → candidate-graph →
 * extract → reconcile → validate → commit-once — implemented as pure
 * functions over the existing engine pieces rather than a new system:
 *
 * - `reconcileRooms` (P23.8) owns persistent Room correspondence;
 * - `extractBoundaryCandidateFaces` (P23.8) derives candidate faces;
 * - `validateWallFirstLayoutDocument` (P23.0a) is the final canonical gate;
 * - `compileWallFirstLayoutGeometry` (P23.0b) proves the document compiles.
 *
 * Planners allocate during the authoring operation only; compilation and
 * rendering never create Rooms (P23.8 "Initial Room creation"). Every
 * rejection names a stable machine code; invalid intent → no document, the
 * caller leaves history untouched. Undo/Redo keeps restoring exact
 * snapshots — allocation never reruns.
 *
 * **Writer-enable boundary.** These planners are called from the canonical
 * writers and the editor's wall-first transaction path after the F0 gate;
 * P23.1 precision operations use the same candidate/validation discipline.
 */
import type {
	LayoutDocumentWallFirst,
	LayoutWall,
	LayoutWallFirstRoom,
	LayoutWallRole
} from './layout-wall-first-types';
import { validateWallFirstLayoutDocument } from './layout-wall-first-codec';
import { compileWallFirstLayoutGeometry } from './layout-geometry';
import { hasBlockingLayoutIssues } from './layout-geometry-validation';
import {
	extractBoundaryCandidateFaces,
	type TopologyDiagnostic
} from './layout-face-extraction';
import {
	buildCorrespondenceComponents,
	interiorWitness,
	reconcileRooms,
	roomBoundaryPolygon,
	ROOM_CREATION_DEFAULTS,
	type ComponentLineage,
	type RoomIdAllocator
} from './layout-room-reconciliation';
import type { LayoutDocumentIssue } from './layout-codec';
import type { LayoutVec2 } from './layout-types';

/**
 * Deterministic authoring allocator (P23.8 ID policy: collision-free
 * against the complete candidate document, never timestamps/random).
 * Room IDs seed from the sanitized canonical face key so the same face
 * always allocates the same ID for the same operation input; names extend
 * the existing `Draft Room N` convention against the full taken set.
 */
export function createAuthoringRoomAllocator(): RoomIdAllocator {
	return {
		nextRoomId(baseDocument, faceKey) {
			const taken = new Set(baseDocument.rooms.map((room) => room.id));
			// Face keys embed topology tokens; sanitize into the codec's ID
			// charset (same policy as the migration allocator).
			const seed = `room.${faceKey.replace(/[^A-Za-z0-9._:-]+/g, '-')}`;
			return allocateId(taken, seed);
		},
		nextRoomName(existingNames) {
			const taken = new Set(existingNames);
			let index = 1;
			while (taken.has(`Draft Room ${index}`)) index += 1;
			return `Draft Room ${index}`;
		}
	};
}

/** Deterministic collision-free ID from a seed (H5 §4.5). */
function allocateId(taken: ReadonlySet<string>, seed: string): string {
	if (!taken.has(seed)) return seed;
	let index = 2;
	while (taken.has(`${seed}.${index}`)) index += 1;
	return `${seed}.${index}`;
}

/** Why a canonical birth operation rejected; stable machine codes. */
export type WallFirstOpRejectionCode =
	| 'unknown_wall'
	| 'invalid_role'
	| 'no_op'
	| 'no_boundary_walls'
	| 'no_enclosed_face'
	| 'room_reconciliation_rejected'
	| 'invalid_candidate_document'
	| 'candidate_does_not_compile';

export type WallFirstOpRejection = {
	code: WallFirstOpRejectionCode;
	message: string;
	/** Involved authored IDs where available. */
	wallIds?: string[];
	roomIds?: string[];
	/** Candidate face key, when the rejection names a face (not a wall). */
	faceKey?: string;
	/** Face-extraction diagnostics that caused the rejection, if any. */
	topology?: readonly TopologyDiagnostic[];
	/** The final canonical gate's issues, when validation rejects. */
	issues?: readonly LayoutDocumentIssue[];
};

export type WallFirstOpPlan =
	| {
			kind: 'success';
			/** Exact committed document — allocated IDs included. */
			document: LayoutDocumentWallFirst;
			/** `created` lineage records from the P23.8 reconciliation. */
			lineage: ReadonlyArray<{
				faceKey: string;
				roomId: string;
				kind: 'created';
			}>;
			retiredRoomIds: readonly string[];
	  }
	| {
			kind: 'rejected';
			rejection: WallFirstOpRejection;
	  };

/**
 * Shared foundation operation (P23.8 "Initial Room creation — foundation
 * responsibility"): reconcile the candidate document's zero-predecessor
 * faces into born Rooms, then run the full canonical gates.
 *
 * Called by both {@link planFirstEnclosureCreation} and
 * {@link planPartitionToBoundaryRoomBirth} — closing a Wall chain and
 * converting a closed Partition chain to boundary Walls go through the
 * exact same path, differing only in the role policy each planner applies
 * to the submitted walls.
 */
function runRoomBirthOperation(options: {
	candidateDocument: LayoutDocumentWallFirst;
	allocator: RoomIdAllocator;
	reject: (rejection: WallFirstOpRejection) => WallFirstOpPlan;
}): WallFirstOpPlan {
	const { candidateDocument, allocator, reject } = options;
	if (candidateDocument.walls.length === 0) {
		return reject({
			code: 'no_boundary_walls',
			message: 'The candidate document has no walls; there is nothing to enclose'
		});
	}

	const extraction = extractBoundaryCandidateFaces(candidateDocument);
	if (extraction.faces.length === 0) {
		const wallIds = [
			...extraction.danglingWallIds,
			...extraction.cutEdgeWallIds
		];
		return reject({
			code: 'no_enclosed_face',
			message:
				'Boundary walls form no enclosed candidate face; a Room is born only from a closed boundary cycle',
			...(wallIds.length > 0 ? { wallIds } : {}),
			topology: extraction.diagnostics
		});
	}

	// Zero-predecessor births: every face is a fresh component with no
	// predecessor rooms (P23.8 proves the "failed match is not permission to
	// create a Room" rule for non-zero predecessors — a birth operation by
	// definition starts from an empty predecessor set, so every face born
	// here is genuinely new).
	const components: ComponentLineage[] = extraction.faces.map((face) => ({
		candidateFaceKeys: [face.key],
		predecessorRoomIds: []
	}));

	const result = reconcileRooms({
		// Births have no predecessor rooms; the baseline is the candidate
		// shape with an empty room registry.
		baseline: { ...candidateDocument, rooms: [] },
		candidateDocument,
		extraction,
		components,
		allocator
	});
	if ('rejection' in result) {
		return reject({
			code: 'room_reconciliation_rejected',
			message: result.rejection.message,
			...(result.rejection.roomIds ? { roomIds: result.rejection.roomIds } : {}),
			...(result.rejection.faceKey ? { faceKey: result.rejection.faceKey } : {})
		});
	}

	return validateAndCompile(result.document, reject, (document) => ({
		kind: 'success',
		document,
		lineage: result.lineage
			.filter((record) => record.kind === 'created')
			.map((record) => ({ faceKey: record.faceKey, roomId: record.roomId, kind: 'created' as const })),
		retiredRoomIds: result.retiredRoomIds
	}));
}

/** Final canonical gates shared by every planner: codec → compile. */
function validateAndCompile(
	document: LayoutDocumentWallFirst,
	reject: (rejection: WallFirstOpRejection) => WallFirstOpPlan,
	success: (document: LayoutDocumentWallFirst) => WallFirstOpPlan
): WallFirstOpPlan {
	const validated = validateWallFirstLayoutDocument(document);
	if (!validated.success) {
		return reject({
			code: 'invalid_candidate_document',
			message: `Candidate document failed canonical validation: ${validated.issues[0]?.message ?? 'unknown issue'}`,
			issues: validated.issues
		});
	}
	// The canonical compile must succeed before a document may be committed
	// — the same compile output Plan/3D/visitor consume downstream. Blocking
	// policy matches the shipped gate (`hasBlockingLayoutIssues`): anything
	// non-warning rejects.
	const compiled = compileWallFirstLayoutGeometry(validated.document);
	if (hasBlockingLayoutIssues(compiled.issues)) {
		return reject({
			code: 'candidate_does_not_compile',
			message: `Candidate document does not compile: ${compiled.issues[0]?.message ?? 'unknown geometry issue'}`
		});
	}
	return success(validated.document);
}

/**
 * Headless first-enclosure creation: reconcile the enclosed candidate faces
 * of a closed boundary-Wall chain into born Rooms with deterministic IDs,
 * `Draft Room N` names and the P23.8 0.1 m floor/ceiling creation defaults.
 *
 * The operation reconciles the **whole** submitted document, so the caller
 * submits the complete post-operation candidate graph (existing walls plus
 * the closing chain, already noded through the P23.8 noding plans). Every
 * enclosed face — not just the newly closed one — receives a Room; a
 * pre-existing Room document is out of scope here (the topology-edit entry
 * points run full P23.8 correspondence against their real baseline).
 */
export function planFirstEnclosureCreation(options: {
	/**
	 * Complete post-operation candidate document. `rooms` must be empty —
	 * first enclosure is a zero-predecessor birth operation.
	 */
	candidateDocument: LayoutDocumentWallFirst;
	allocator?: RoomIdAllocator;
}): WallFirstOpPlan {
	const allocator = options.allocator ?? createAuthoringRoomAllocator();
	if (options.candidateDocument.rooms.length > 0) {
		return {
			kind: 'rejected',
			rejection: {
				code: 'no_enclosed_face',
				message:
					'First-enclosure creation is a zero-predecessor birth operation; the candidate document must not carry rooms'
			}
		};
	}
	return runRoomBirthOperation({
		candidateDocument: options.candidateDocument,
		allocator,
		reject: (rejection) => ({ kind: 'rejected', rejection })
	});
}

/**
 * Partition → boundary Room birth: mark the submitted closed partition
 * chain as `boundary` and run the same foundation operation. The role flip
 * is a topology-changing operation (P23.8 "Boundary versus Partition") and
 * therefore runs the full candidate-face/reconciliation gate — this planner
 * is the P23.9 entry point's engine.
 *
 * Every wall in the chain flips; `null` leaves a wall's role unchanged so
 * the caller can submit a mixed candidate graph when the chain already
 * contains boundary walls.
 */
export function planPartitionToBoundaryRoomBirth(options: {
	/** Complete candidate document with the closed chain still marked `partition`. */
	candidateDocument: LayoutDocumentWallFirst;
	/** Wall IDs of the chain to flip. `null` keeps that wall's authored role. */
	chainWallIds: ReadonlyArray<string | null>;
	allocator?: RoomIdAllocator;
}): WallFirstOpPlan {
	const allocator = options.allocator ?? createAuthoringRoomAllocator();
	const chainIds = options.chainWallIds.filter((id): id is string => id !== null);
	const wallById = new Map(
		options.candidateDocument.walls.map((wall) => [wall.id, wall])
	);
	const missing = chainIds.filter((id) => !wallById.has(id));
	if (missing.length > 0) {
		return {
			kind: 'rejected',
			rejection: {
				code: 'no_boundary_walls',
				message: `Partition chain references unknown walls: ${missing.join(', ')}`,
				wallIds: missing
			}
		};
	}
	if (chainIds.length === 0) {
		return {
			kind: 'rejected',
			rejection: {
				code: 'no_boundary_walls',
				message: 'Partition → boundary birth requires at least one wall to flip'
			}
		};
	}
	const chainSet = new Set(chainIds);
	const walls: LayoutWall[] = options.candidateDocument.walls.map((wall) =>
		chainSet.has(wall.id) ? { ...wall, role: 'boundary' as const } : wall
	);
	return runRoomBirthOperation({
		candidateDocument: { ...options.candidateDocument, walls },
		allocator,
		reject: (rejection) => ({ kind: 'rejected', rejection })
	});
}

/**
 * P23.6 — single-Wall role change through the canonical topology path.
 *
 * Flipping `role` is a topology-changing operation (P23.8 "Boundary versus
 * Partition"), never a direct field assignment: the candidate runs face
 * extraction + P23.8 correspondence reconciliation + the final canonical
 * gates, exactly like the chain engine. Typical outcomes:
 *
 * - boundary → partition: the physical Wall remains; affected Room topology
 *   reconciles canonically (faces that no longer close retire their Rooms);
 * - partition → boundary: supported topology births/splits Rooms through the
 *   same reconciliation; without a closed face the Wall simply flips role.
 *
 * Openings stay hosted on the physical Wall in both directions; portal Room
 * references remap or reject inside reconciliation. One plan = one history
 * entry at the caller. Invalid intent → no document.
 */
export function planWallRoleChange(
	document: LayoutDocumentWallFirst,
	wallId: string,
	role: LayoutWallRole
): WallFirstOpPlan {
	const reject = (rejection: WallFirstOpRejection): WallFirstOpPlan => ({ kind: 'rejected', rejection });
	const wall = document.walls.find((candidate) => candidate.id === wallId);
	if (!wall) {
		return reject({
			code: 'unknown_wall',
			message: `Unknown wall '${wallId}'`,
			wallIds: [wallId]
		});
	}
	if (role !== 'boundary' && role !== 'partition') {
		return reject({
			code: 'invalid_role',
			message: `Wall role must be 'boundary' or 'partition'`,
			wallIds: [wallId]
		});
	}
	if (wall.role === role) {
		return reject({
			code: 'no_op',
			message: `Wall '${wallId}' already ${role === 'boundary' ? 'defines a room boundary' : 'does not divide rooms'}`,
			wallIds: [wallId]
		});
	}

	const candidate: LayoutDocumentWallFirst = {
		...document,
		walls: document.walls.map((entry) => (entry.id === wallId ? { ...entry, role } : entry))
	};

	// --- room reconciliation (both directions) --------------------------------
	// Same correspondence as the chain engine: predecessor polygons/witnesses
	// come from the BASELINE rooms, components join predecessor rooms with
	// candidate faces, and reconcileRooms owns birth/preservation/retirement.
	let lineage: Array<{ faceKey: string; roomId: string; kind: 'created' }> = [];
	let retiredRoomIds: readonly string[] = [];
	const extraction = extractBoundaryCandidateFaces(candidate);
	if (extraction.faces.length > 0 || document.rooms.length > 0) {
		const predecessorPolygons = new Map<string, readonly LayoutVec2[]>();
		const predecessorWitnesses = new Map<string, LayoutVec2>();
		for (const room of document.rooms) {
			const polygon = roomBoundaryPolygon(document, room.id);
			if (!polygon) {
				return reject({
					code: 'room_reconciliation_rejected',
					message: `Predecessor room '${room.id}' has an unresolvable boundary`,
					roomIds: [room.id]
				});
			}
			predecessorPolygons.set(room.id, polygon);
			predecessorWitnesses.set(room.id, interiorWitness(polygon));
		}
		const components = buildCorrespondenceComponents(
			extraction.faces,
			document.rooms.map((room) => room.id),
			predecessorWitnesses,
			predecessorPolygons
		);
		const result = reconcileRooms({
			baseline: document,
			candidateDocument: candidate,
			extraction,
			components,
			predecessorWitnesses,
			predecessorPolygons,
			allocator: createAuthoringRoomAllocator()
		});
		if ('rejection' in result) {
			return reject({
				code: 'room_reconciliation_rejected',
				message: result.rejection.message,
				...(result.rejection.roomIds ? { roomIds: result.rejection.roomIds } : {}),
				...(result.rejection.faceKey ? { faceKey: result.rejection.faceKey } : {})
			});
		}
		candidate.rooms = result.document.rooms;
		candidate.objects = result.document.objects;
		candidate.openings = result.document.openings;
		lineage = result.lineage
			.filter((record) => record.kind === 'created')
			.map((record) => ({ faceKey: record.faceKey, roomId: record.roomId, kind: 'created' as const }));
		retiredRoomIds = [...result.retiredRoomIds];
	}

	return validateAndCompile(candidate, reject, (committed) => ({
		kind: 'success',
		document: committed,
		lineage,
		retiredRoomIds
	}));
}

/**
 * Convenience geometry helper for callers/tests: the submitted wall chain
 * as an untyped rectangle-equivalent seed list, so fixtures can build
 * closed chains without hand-writing junction arrays. Production callers
 * assemble junctions/walls through the P23.8 noding plans instead.
 */
export function closedChainWalls(options: {
	junctions: ReadonlyArray<readonly [string, number, number]>;
	/** Walls as junction-ID pairs traversing the ring in one direction. */
	walls: ReadonlyArray<readonly [string, string, string]>;
	role?: LayoutWall['role'];
	thickness?: number;
	/**
	 * P23.6H — required authoritative Wall height. Fixtures pass their Floor
	 * height; no fixed default survives on this (or any) Wall-birth path.
	 */
	height: number;
}): Pick<LayoutDocumentWallFirst, 'junctions' | 'walls'> {
	const role = options.role ?? 'boundary';
	const thickness = options.thickness ?? 0.2;
	const height = options.height;
	return {
		junctions: options.junctions.map(([id, x, z]) => ({ id, point: [x, z] as LayoutVec2 })),
		walls: options.walls.map(([id, start, end]) => ({
			id,
			startJunctionId: start,
			endJunctionId: end,
			role,
			thickness,
			height
		}))
	};
}

/** Room creation defaults re-export (P23.8 0.1 m floor/ceiling). */
export { ROOM_CREATION_DEFAULTS };
export type { LayoutWallFirstRoom };
