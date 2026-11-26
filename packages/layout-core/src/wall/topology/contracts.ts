import type { LayoutDocumentWallFirst } from '../types';
import type { TopologyDiagnostic } from '../../geometry/face-extraction';
import type { SpaceRetirement } from '../../room/reconciliation-types';
import type { LayoutDocumentIssue } from '../../plan/issue';
import type { RoundOperationCorrespondence } from '../../room/round-room';
import type { LayoutSurfaceLineage } from '../../plan/surface-reference';

/** Why a canonical topology operation rejected; stable machine codes. */
export type WallFirstOpRejectionCode =
	| 'unknown_wall'
	| 'invalid_role'
	| 'no_op'
	| 'no_boundary_walls'
	| 'no_enclosed_face'
	| 'room_reconciliation_rejected'
	| 'invalid_candidate_document'
	| 'candidate_does_not_compile'
	/* Canonical Room lifecycle completion. */
	| 'unknown_room'
	| 'invalid_patch'
	| 'invalid_value'
	| 'wall_not_in_room_boundary'
	| 'ambiguous_room_removal'
	| 'captured_id_in_use'
	/* SP1b lifecycle. */
	| 'not_open_space'
	| 'space_outline_invalid'
	/* C2 Round repack conflict. */
	| 'round_repack_conflict';

export type WallFirstOpRejection = {
	code: WallFirstOpRejectionCode;
	message: string;
	/** Involved authored IDs where available. */
	wallIds?: string[];
	roomIds?: string[];
	junctionIds?: string[];
	openingIds?: string[];
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
			/** `created` lineage records from the reconciliation. */
			lineage: ReadonlyArray<{
				faceKey: string;
				roomId: string;
				kind: 'created';
			}>;
			surfaceLineage: LayoutSurfaceLineage;
			retiredRoomIds: readonly string[];
			/** Why an open Space retired; SP1c reads these for consequence lines. */
			spaceRetirements?: readonly SpaceRetirement[];
			/** Round Rooms automatically repacked to one closed Wall on last detach. */
			repackedRoundRoomIds?: readonly string[];
			/** Round Rooms whose `round` fact cleared (open Space, divide, or merge). */
			clearedRoundRoomIds?: readonly string[];
			/** Operation-local Round Room correspondence when affected. */
			roundCorrespondence?: RoundOperationCorrespondence;
	  }
	| {
			kind: 'rejected';
			rejection: WallFirstOpRejection;
	  };
