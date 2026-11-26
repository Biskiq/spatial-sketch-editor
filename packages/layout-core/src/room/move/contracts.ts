import type { LayoutDocumentIssue } from '../../plan/issue';
import type { LayoutGeometryIssue } from '../../geometry/types';
import type { OpeningSetIssue } from '../../wall/opening-set';
import type { LayoutDocumentWallFirst } from '../../wall/types';

/** Why a wall-first Room move rejected; stable machine codes. */
export type RoomMoveRejectionCode =
	| 'unknown_room'
	| 'invalid_value'
	| 'no_op'
	| 'invalid_reference'
	| 'room_not_isolated'
	| 'external_portal_relation'
	| 'profile_object_read_only'
	| 'room_identity_lost'
	| 'ambiguous_room_correspondence'
	| 'topology_invalid'
	| 'opening_set_invalid'
	| 'portal_relation_invalid'
	| 'invalid_candidate_document'
	| 'candidate_does_not_compile';

export type RoomMoveRejection = {
	code: RoomMoveRejectionCode;
	message: string;
	/** Involved authored IDs where available. */
	targetIds?: readonly string[];
	/** Canonical-gate issues, when validation rejected the candidate. */
	issues?: readonly (LayoutDocumentIssue | LayoutGeometryIssue | OpeningSetIssue)[];
};

export type RoomMovePlan =
	| {
			kind: 'success';
			/** Exact committed document — same IDs, moved Junction points. */
			document: LayoutDocumentWallFirst;
			/**
			 * Which rigid motion produced it. A rotation is the same operation with a
			 * different candidate: identical correspondence, identity and gate rules.
			 */
			operation: 'room-move' | 'room-rotate';
			/** The dragged (anchor) Room — always a member of `movedRoomIds`. */
			movedRoomId: string;
			/**
			 * Every Room moved as one rigid unit: the connected group containing the
			 * anchor, anchor first then document order. A lone Room is a group of one.
			 */
			movedRoomIds: readonly string[];
			/** Boundary Junctions translated by the delta, deterministic order. */
			changedJunctionIds: readonly string[];
			/** Boundary Walls that moved (their Junctions moved; fields did not). */
			changedWallIds: readonly string[];
			/** Explicitly associated objects translated by the delta. */
			changedObjectIds: readonly string[];
	  }
	| { kind: 'rejected'; rejection: RoomMoveRejection };
