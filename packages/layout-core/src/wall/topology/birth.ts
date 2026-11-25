import type { WallFirstOpPlan, WallFirstOpRejection } from './contracts';
import type { LayoutDocumentWallFirst } from '../types';
import { validateWallFirstLayoutDocument } from '../codec';
import { compileWallFirstLayoutGeometry } from '../../geometry/compiler';
import { hasBlockingLayoutIssues } from '../../geometry/validation';
import { extractBoundaryCandidateFaces } from '../../geometry/face-extraction';
import { reconcileRooms } from '../../room/reconciliation';
import type { ComponentLineage, RoomIdAllocator } from '../../room/reconciliation-types';
import { roomSurfaceLineage } from '../../plan/surface-reference';
import type { LayoutIdCapture } from '../../plan/id-capture';
import { LayoutIdCollisionError, allocateCapturedId, layoutWorkingLevelIssue } from '../../plan/id-capture';

/**
 * Captured Room allocator. Room IDs derive from the
 * operation's nonce plus the sanitized canonical face key; the taken set is
 * only the refusal check that the captured id is unused. Names extend the
 * existing `Draft Room N` convention — a name is not identity.
 */
export function createAuthoringRoomAllocator(capture: LayoutIdCapture, namePrefix = 'Draft Room'): RoomIdAllocator {
	return {
		nextRoomId(baseDocument, faceKey) {
			const taken = new Set(baseDocument.rooms.map((room) => room.id));
			// Face keys embed topology tokens; sanitize into the codec's ID
			// charset (same policy as the migration allocator).
			const seed = `room.${faceKey.replace(/[^A-Za-z0-9._:-]+/g, '-')}`;
			return allocateCapturedId(taken, seed, capture);
		},
		nextRoomName(existingNames) {
			const taken = new Set(existingNames);
			let index = 1;
			while (taken.has(`${namePrefix} ${index}`)) index += 1;
			return `${namePrefix} ${index}`;
		}
	};
}


/**
 * Shared foundation operation (P23.8 "Initial Room creation — foundation
 * responsibility"): reconcile the candidate document's zero-predecessor
 * faces into born Rooms, then run the full canonical gates.
 *
 * Called by {@link planFirstEnclosureCreation}: any closed Wall chain births
 * Room(s) through this one path. Format 6 has no role policy to apply — a ring
 * encloses because of its topology.
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
		surfaceLineage: roomSurfaceLineage(result.lineage),
		retiredRoomIds: result.retiredRoomIds
	}));
}


/**
 * Final canonical gates shared by every planner: codec → compile.
 *
 * Generic over the planner's own plan shape so topology operations and the
 * Junction-dissolve planner share one gate implementation: existing callers
 * instantiate `T = WallFirstOpPlan` with identical behavior, dissolve uses its
 * own plan type. Shared authority — never copied per planner.
 */
export function validateAndCompile<T>(
	document: LayoutDocumentWallFirst,
	reject: (rejection: WallFirstOpRejection) => T,
	success: (document: LayoutDocumentWallFirst) => T
): T {
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
	/** The operation's captured identity; every born Room derives from it. */
	capture: LayoutIdCapture;
	/** Explicit working level; must name `candidateDocument.floor.id`. */
	levelId: string;
}): WallFirstOpPlan {
	const levelIssue = layoutWorkingLevelIssue(options.candidateDocument, options.levelId);
	if (levelIssue !== null) {
		return { kind: 'rejected', rejection: { code: 'invalid_value', message: levelIssue } };
	}
	const allocator = createAuthoringRoomAllocator(options.capture);
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
	try {
		return runRoomBirthOperation({
			candidateDocument: options.candidateDocument,
			allocator,
			reject: (rejection) => ({ kind: 'rejected', rejection })
		});
	} catch (error) {
		if (error instanceof LayoutIdCollisionError) {
			return { kind: 'rejected', rejection: { code: 'captured_id_in_use', message: error.message } };
		}
		throw error;
	}
}
