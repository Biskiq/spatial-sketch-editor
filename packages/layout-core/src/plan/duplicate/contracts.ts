import type { LayoutDocumentIssue } from '../issue';
import type { OpeningSetIssue } from '../../wall/opening-set';
import type { RoomCopyDroppedRelation } from '../../room/isolation';
import type { LayoutDocumentWallFirst } from '../../wall/types';
import type { LayoutVec2 } from '../../geometry/coordinates';
import type { LayoutSurfaceLineage } from '../surface-reference';

/** Repeat-count cap. */
export const LAYOUT_DUPLICATE_MAX_COPIES = 50 as const;


export type DuplicateOperation =
	| 'layout-object-repeat'
	| 'wall-opening-repeat'
	| 'room-duplicate';


export type DuplicateRejectionCode =
	| 'unknown_object'
	| 'unknown_opening'
	| 'unknown_room'
	| 'invalid_reference'
	| 'invalid_value'
	| 'count_out_of_range'
	| 'profile_object_read_only'
	| 'room_not_isolated'
	| 'external_portal_relation'
	| 'invalid_candidate_document'
	| 'topology_invalid'
	| 'opening_set_invalid'
	| 'portal_relation_invalid'
	| 'candidate_does_not_compile'
	| 'captured_id_in_use';


export type DuplicateRejection = {
	code: DuplicateRejectionCode;
	message: string;
	/** Involved authored IDs where available. */
	targetIds?: readonly string[];
	/** Canonical-gate issues, when validation rejected the batch. */
	issues?: readonly (LayoutDocumentIssue | OpeningSetIssue)[];
};


/** Authored source-to-copy identities for one enclosure operation. */
export type RoomCopyCorrespondence = {
	readonly room: { readonly sourceId: string; readonly copyId: string };
	readonly junctions: readonly { readonly sourceId: string; readonly copyId: string }[];
	readonly walls: readonly { readonly sourceId: string; readonly copyId: string }[];
	readonly openings: readonly { readonly sourceId: string; readonly copyId: string }[];
	readonly objects: readonly { readonly sourceId: string; readonly copyId: string }[];
};


export type DuplicatePlan =
	| {
			kind: 'success';
			/** Exact committed document — allocated IDs included. */
			document: LayoutDocumentWallFirst;
			operation: DuplicateOperation;
			createdObjectIds: readonly string[];
			createdOpeningIds: readonly string[];
			createdJunctionIds: readonly string[];
			createdWallIds: readonly string[];
			surfaceLineage: LayoutSurfaceLineage;
			/** Set by the two Room planners. */
			createdRoomId?: string;
			/** Door relations the copy could not carry; set only by `planDuplicateRoom`. */
			droppedRoomRelations?: readonly RoomCopyDroppedRelation[];
			/** Source identities remain live; each entry names its privately captured copy. */
			roomCopyCorrespondence?: RoomCopyCorrespondence;
	  }
	| { kind: 'rejected'; rejection: DuplicateRejection };


// ---------------------------------------------------------------------------
// Layout object duplicate / linear repeat
// ---------------------------------------------------------------------------

export type LayoutObjectRepeatIntent = {
	/** Source document-level object. */
	objectId: string;
	/** Number of copies to add; `1` is a plain duplicate. Bounded `1..50`. */
	count: number;
	/** X/Z translation delta per copy index (meters). Y is preserved. */
	delta: LayoutVec2;
};


// ---------------------------------------------------------------------------
// Opening duplicate / linear repeat
// ---------------------------------------------------------------------------

export type WallOpeningRepeatIntent = {
	/** Source Wall-hosted Opening. */
	openingId: string;
	/** Number of copies to add; `1` is a plain duplicate. Bounded `1..50`. */
	count: number;
	/**
	 * Physical spacing in meters along the canonical Wall direction. Negative
	 * spacing is allowed when the complete final opening set still validates;
	 * anything else rejects the whole batch (never normalized silently).
	 */
	spacing: number;
};


// ---------------------------------------------------------------------------
// Room duplicate: isolated path and the general copy enclosure
// ---------------------------------------------------------------------------

export type RoomDuplicateIntent = {
	/** Source Room whose enclosure is cloned. */
	roomId: string;
	/** Project/world X/Z translation applied to every cloned Junction. */
	delta: LayoutVec2;
};
