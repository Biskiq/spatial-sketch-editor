import type { LayoutDocumentWallFirst } from '../wall/types';

/** Why reconciliation rejected; stable machine codes. */
export type ReconciliationRejection = {
	code:
		| 'ambiguous_room_correspondence'
		| 'unsupported_component'
		| 'unresolved_portal_remap'
		| 'unresolved_room_reference'
		/** A carried Space would fail I4 or I7 and the operation may not retire it. */
		| 'space_outline_invalid';
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
	/** Open predecessors preserved by the carry rule, in baseline document order. */
	carriedRoomIds: readonly string[];
	/** Why an open Space left the document (SP-plan §5.4). */
	spaceRetirements: readonly SpaceRetirement[];
};

/** Why an open Space retired; stable machine codes for consequence lines. */
export type SpaceRetirementReason =
	| 'explicit-remove'
	| 'last-boundary-wall'
	| 'merged'
	| 'outline-not-positive'
	| 'outline-self-intersects'
	| 'overlaps'
	| 'contains';

export type SpaceRetirement = {
	roomId: string;
	reason: SpaceRetirementReason;
	/** The other Space involved (merge survivor, overlap or containment). */
	otherRoomIds?: readonly string[];
	successorRoomId?: string;
};

/**
 * How one reconciliation pass treats Spaces that are not claimed by a face.
 *
 * Every pass runs the carry rule (SP-plan §5): a Space that survives the edit
 * keeps its identity, and only a genuine loss of support or an invalid outline
 * retires it. Wall ids this operation removes are named so the carry rule can
 * turn each released Wall side into a virtual edge.
 */
export type SpaceLifecyclePolicy = {
	/** Wall ids this operation removes, resolvable in `baseline`. */
	removedWalls?: readonly string[];
	/** Predecessors the operation retires by intent, before face claims. */
	retireRoomIds?: readonly string[];
	/** What a carried Space failing I4/I7 does. Default `reject`. */
	invalidOutline?: 'retire' | 'reject';
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
