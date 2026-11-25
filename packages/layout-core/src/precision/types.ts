import type { LayoutDocumentIssue } from '../layout-issue';
import type { CompiledLayoutGeometryResult, LayoutGeometryIssue } from '../layout-geometry-types';
import type { LayoutDocumentWallFirst, LayoutJunction, LayoutObject, LayoutWallCenterline } from '../layout-wall-first-types';
import type { WallSamplingDerivation } from '../layout-wall-centerline';
import type { LayoutVec2 } from '../layout-coordinates';
import type { Vec3 } from '../types';
import type { LayoutSurfaceLineage } from '../layout-surface-reference';

/**
 * Maximum number of bend points a **new** insertion may produce.
 *
 * The ceiling bounds sampling, preflight and unfold cost. It is enforced on the
 * write paths only: an existing chain that already carries more knots (for
 * example from a future or imported document) still reads, edits and deletes
 * normally, because refusing to read it would strand authored geometry.
 */
export const MAX_WALL_CURVE_KNOTS = 32;


export type FixedWallEndpoint = 'start' | 'end';


export type WallLengthIntent = {
	wallId: string;
	length: number;
	fixed?: FixedWallEndpoint;
	fixedEndpoint?: FixedWallEndpoint;
};


export type WallAngleIntent = {
	wallId: string;
	angle: number;
	fixed?: FixedWallEndpoint;
	fixedEndpoint?: FixedWallEndpoint;
};


/**
 * One rigid Wall translation: both endpoint Junctions
 * receive the identical X/Z delta. Endpoint order, role, thickness, height,
 * length and angle are all preserved.
 */
export type WallMoveIntent = {
	wallId: string;
	delta: LayoutVec2;
};


export type RectangleResizeOptions = {
	/** Explicit anchor reference. Omission uses the smallest stable corner ID. */
	anchorJunctionId?: string;
	/** Explicit width edge reference. Omission uses the smallest stable edge ID. */
	widthWallId?: string;
};


export type ResolvedRectangle = {
	anchorJunctionId: string;
	widthEndpointId: string;
	depthEndpointId: string;
	corners: LayoutJunction[];
	roomWallIds: string[];
	widthWallId: string;
	depthWallId: string;
};


export type RectangleResolution = ResolvedRectangle | { rejection: PrecisionRejection };


export type LayoutObjectTransformPatch = Partial<
	Pick<LayoutObject, 'position' | 'rotation' | 'dimensions' | 'roomId'>
>;


export type PrecisionOperation =
	| 'junction-position'
	| 'wall-length'
	| 'wall-angle'
	/** Rigid straight-Wall translation (planner: `planRigidWallMove`). */
	| 'wall-move'
	| 'wall-thickness'
	| 'wall-height'
	| 'wall-role'
	/** Canonical Wall deletion (planner: `planDeleteWall`). */
	| 'wall-delete'
	/** Junction dissolve — degree-2 Junction deletion via Wall join (planner: `planDissolveJunction`). */
	| 'junction-dissolve'
	/** Canonical Room metadata update (planner: `planRoomMetadataUpdate`). */
	| 'room-metadata'
	/** Canonical Wall metadata update (planner: `planWallMetadataUpdate`). */
	| 'wall-metadata'
	/** Canonical Opening metadata update (planner: `planOpeningMetadataUpdate`). */
	| 'opening-metadata'
	/** Room removal through the Wall pipeline (planner: `planRemoveRoom`). */
	| 'room-remove'
	/** Canonical curve operations (convert / knot insert / move / delete / bend). */
	| 'wall-convert-to-curve'
	| 'wall-convert-to-line'
	| 'wall-curve-knot-insert'
	| 'wall-curve-knot-move'
	| 'wall-curve-knot-delete'
	/** The Bend gesture: insert at a physical arc position and place it. */
	| 'wall-curve-knot-bend'
	| 'wall-subdivision'
	| 'rectangle-dimensions'
	| 'layout-object-transform'
	| 'layout-object-delete'
	| 'layout-object-preset-create'
	/** SP1d — one virtual edge moved square to itself. */
	| 'open-side-offset'
	/** SP1d — one virtual edge end slid along its adjoining Wall and split there. */
	| 'open-side-end-slide';


export type PrecisionRejection = {
	code:
		| 'unknown_junction'
		| 'unknown_wall'
		| 'unknown_room'
		| 'unknown_object'
		| 'invalid_value'
		/** A linear dimension or Wall span is outside the supported envelope. */
		| 'dimension_out_of_range'
		| 'invalid_endpoint'
		| 'invalid_reference'
		| 'unsupported_geometry'
		/**
		 * The operation is straight-only and the target Wall carries a
		 * curved centerline. Exact length, exact angle and subdivision all reject
		 * here rather than approximate a curve they cannot solve for.
		 */
		| 'curved_wall_unsupported'
		/** The named curve control does not exist on that Wall. */
		| 'unknown_curve_anchor'
		| 'shared_boundary_resize_ambiguous'
		| 'topology_invalid'
		/** A carried Space's new outline would be invalid; the edit is refused. */
		| 'space_outline_invalid'
		/**
		 * The geometry edit could not map every baseline Room to exactly
		 * one candidate face through explicit boundary-cycle lineage. Direct
		 * coordinate edits and subdivision never authorize Room birth, retirement,
		 * split or merge.
		 */
		| 'room_identity_lost'
		/** The candidate failed the canonical whole-document Opening set. */
		| 'opening_set_invalid'
		/** The candidate failed the canonical portal-relation (adjacency) gate. */
		| 'portal_relation_invalid'
		/**
		 * The edit would cap a Wall below the top of a hosted Opening. The
		 * canonical Opening validator owns the rule; this code only names the
		 * rejection so the message stays actionable.
		 */
		| 'wall_height_below_opening'
		| 'geometry_invalid'
		| 'no_op'
		| 'split_at_existing_endpoint'
		| 'split_distance_out_of_range'
		| 'split_through_opening_interior'
		/** A closed Wall is one canonical loop and refuses topology mutations. */
		| 'closed_wall_isolated'
		/** A circular Wall resizes by radius; its canonical chain is not freely bendable. */
		| 'closed_wall_not_bendable'
		/** A Wall may not gain more than the supported number of bend points. */
		| 'curve_knot_limit'
		| 'junction_point_mismatch'
		/** The addressed virtual edge is not in this Space's composed boundary. */
		| 'unknown_open_side'
		/** The moved open side would share interior area with another Space. */
		| 'space_overlap'
		/** The moved open side would contain, or be contained by, another Space. */
		| 'space_contains_space'
		/** An end slide would release a fragment that still hosts an Opening. */
		| 'opening_on_released_stub'
		/** A member Wall or rim Junction of a Round Room cannot be edited directly. */
		| 'round_room_member_locked';
	message: string;
	targetIds?: readonly string[];
	issues?: readonly (LayoutDocumentIssue | LayoutGeometryIssue)[];
};


/**
 * The **acceptance compile** a successful geometry plan already paid for.
 *
 * `finalizeWallGeometryCandidate` compiles the accepted candidate to prove it
 * does not block, and then discards the result while the editor derives the
 * preview bundle by compiling the same document a second time. Carrying the
 * result here lets that caller install the identical geometry without a second
 * compile.
 *
 * `documentJson` is the accepted document's own canonical JSON (free — the
 * codec gate computed it), so a caller that installs a *re-parsed* copy of that
 * document can prove the re-parse preserved it before reusing anything. It is
 * never a licence to reuse geometry for a different document.
 */
export type WallFirstAcceptanceCompile = {
	documentJson: string;
	geometry: CompiledLayoutGeometryResult['geometry'];
	issues: CompiledLayoutGeometryResult['issues'];
};


export type PrecisionPlan =
	| {
			kind: 'success';
			document: LayoutDocumentWallFirst;
			operation: PrecisionOperation;
			changedJunctionIds: readonly string[];
			changedWallIds: readonly string[];
			changedObjectIds?: readonly string[];
			/** The object a preset create birthed (its stored ID). */
			createdObjectId?: string;
			/**
			 * Set only by the wall-geometry path, and only for the document in
			 * `document`: the compile result acceptance already produced.
			 */
			acceptance?: WallFirstAcceptanceCompile;
		}
	| {
			kind: 'rejected';
			rejection: PrecisionRejection;
		};


/** The split-at-release result: the IDs a captured acceptance must replay. */
export type SpaceOpenSideSlidePlan =
	| {
			kind: 'success';
			document: LayoutDocumentWallFirst;
			operation: 'open-side-end-slide';
			changedJunctionIds: readonly string[];
			changedWallIds: readonly string[];
			createdWallIds: readonly string[];
			/** The canonical split Junction the open side now ends at. */
			splitJunctionId: string;
			/** The Wall the open side still follows (the stub is the other fragment). */
			keptWallId: string;
			stubWallId: string;
			surfaceLineage: LayoutSurfaceLineage;
			acceptance?: WallFirstAcceptanceCompile;
	  }
	| { kind: 'rejected'; rejection: PrecisionRejection };


// =====================================================================
// The pure curve PROPOSAL seam.
//
// Separate from canonical acceptance on purpose: a rejected drag must still
// render the attempted Wall while the immutable baseline is installed, and the
// only way to do that without a second interpolation authority is to run the
// SAME chain algebra the planners run, without finalizing.
// =====================================================================

/** Which curve edit a transient proposal describes. */
export type WallCurveProposeIntent =
	| { kind: 'knot-move'; knotId: string; point: LayoutVec2 }
	| { kind: 'bend'; distance: number; point: LayoutVec2 };


/** One sampled Wall centerline in a transient direct-edit proposal. */
export type WallFirstArchitectureProposalWall = {
	wallId: string;
	points: LayoutVec2[];
};


/** Pure direct-edit intent used only to derive invalid-drag overlay geometry. */
export type WallFirstArchitectureProposalIntent =
	| { kind: 'junction-move'; junctionId: string; point: LayoutVec2 }
	| { kind: 'wall-move'; wallId: string; delta: LayoutVec2 }
	| { kind: 'curve-control-move'; wallId: string; knotId: string; point: LayoutVec2 }
	| { kind: 'wall-bend'; wallId: string; distance: number; point: LayoutVec2 };


/**
 * One intent's structural effect on the baseline: the records it changes and
 * the Walls whose geometry it reshapes. Nothing here is validated, and nothing
 * is written back — this is the **single** intent→candidate mapping shared by
 * the render proposal and the preflight below, so neither can invent geometry
 * the other does not have.
 */
export type ArchitectureCandidatePatch = {
	/** Junction point overrides, by Junction ID. */
	junctionPoints: ReadonlyMap<string, LayoutVec2>;
	/** Wall centerline overrides, by Wall ID. */
	wallCenterlines: ReadonlyMap<string, LayoutWallCenterline>;
	/** The Walls the intent reshapes, in document order. */
	affectedWallIds: readonly string[];
};


/** One candidate relationship the extent rule admits: a same-component pair. */
export type WallFirstArchitectureCandidatePair = readonly [string, string];


/**
 * The AFFECTED EXTENT of one direct-edit intent.
 *
 * Derived from the SAME patch the proposal and the preflight splice
 * (`architectureCandidatePatch`), so nothing here can invent geometry those two do
 * not have. The extent is CONSERVATIVE, never tight:
 *
 * - `junctionIds` — the Junctions whose point the patch overrides, document order;
 * - `wallIds` — every Wall whose derived inputs can change: the Walls whose centreline
 *   the patch overrides, plus every Wall incident to a moved Junction. These are also
 *   the zero-length and self-intersection candidates;
 * - `wallPairs` — the same-component Wall pairs with at least one affected member, in
 *   the canonical gate's own order;
 * - `junctionPairs` — the same-component Junction pairs with at least one moved member,
 *   in the canonical gate's own order.
 *
 * WHAT IS NOT HERE, and why that is sound: a pair with neither member
 * affected has both endpoints on Junctions the patch does not touch and both centreline
 * OBJECTS shared by the splice, so its predicate inputs are the same records — its
 * verdict cannot change, and a gesture may reuse the verdict the frozen baseline
 * produced. Room boundary structure is identity-only and the Opening set is deferred, so
 * both are invariant under a patch for the same reason.
 *
 * The affected sets may GROW WITH THE DOCUMENT — one moved Wall has candidate
 * relationships with every same-component Wall — so this bounds the per-move work for
 * THAT move's patch and is never a fixed count. `undefined` means the intent is not a
 * derivable direct edit at all (unknown Wall/Junction/knot, non-finite point,
 * out-of-range bend distance): the caller's own "underivable" state, not a verdict.
 */
export type WallFirstArchitectureAffectedExtent = {
	junctionIds: readonly string[];
	wallIds: readonly string[];
	wallPairs: readonly WallFirstArchitectureCandidatePair[];
	junctionPairs: readonly WallFirstArchitectureCandidatePair[];
};


/**
 * What one gesture's verdict scope did. Every number is a count of moves or of
 * candidate subjects, never a duration and never a count of the predicate
 * evaluations themselves.
 */
export type WallFirstArchitectureVerdictScopeStats = {
	/** Clean initialization passes taken: one per target identity, at most one per lifetime. */
	initializations: number;
	/** Moves served by the affected-only pass. */
	scoped: number;
	/**
	 * Moves served by the whole-document preflight instead: the initialization move itself, any
	 * move before a clean one, and every move of a gesture whose candidate the scope refused to
	 * initialize on.
	 */
	canonical: number;
	/**
	 * The candidate subjects the scoped moves brought, by kind — a BOUND on what a scoped pass may
	 * evaluate, never a count of what it did: these are summed from each move's affected extent
	 * BEFORE the pass runs.
	 */
	candidates: { walls: number; wallPairs: number; junctionPairs: number };
};


/**
 * The GESTURE-SCOPED VERDICT SET.
 *
 * One gesture's frozen baseline, and the one thing that lets a pointermove skip work the canonical
 * preflight would repeat: a CLEAN INITIALIZATION. On the first move of a target the scope runs the
 * canonical whole-document preflight, verbatim and on that move's candidate. If it comes back
 * clean, the scope has proven — against the frozen baseline, whose unchanged records the shallow
 * splice shares by reference — that every predicate the gesture's patch cannot touch does not
 * fail. From then on each move evaluates only that move's affected extent through the same
 * predicates, and reuses the rest.
 *
 * WHY THE INITIALIZATION MUST BE CLEAN, stated plainly: a reused verdict is only sound while the
 * reused predicate still holds. A baseline that already fails somewhere would need its failure
 * compared against the affected side's failure by gate position — and a scoped pass that stopped
 * earlier than the canonical one would silently drop a request. Requiring cleanliness removes both
 * problems at once: a gesture whose candidate is not clean is served by the canonical preflight on
 * EVERY move (identical verdicts, identical sample requests), so **no request is ever suppressed
 * and no failure is ever approximated**. That is the approved fallback, and it is what ships.
 *
 * SAMPLING IS UNCHANGED BY CONSTRUCTION. The crossing authority still samples every Wall once per
 * call, so a scoped pass issues exactly the sample requests the canonical pass would; scoping
 * changes WHICH PREDICATES are evaluated, never which artefacts are derived.
 *
 * LIFETIME: the scope belongs to ONE gesture and ONE frozen baseline. The owner resets it
 * at gesture finish, cancel, restore or replacement; a move whose document is not the baseline the
 * scope initialized on re-initializes instead of reusing anything, and a target identity change
 * (the gesture's grab resolving to a different Wall, Junction or knot) re-initializes too.
 */
export type WallFirstArchitectureVerdictScope = {
	/**
	 * The canonical failure for this move, or `undefined` when nothing cheap rejects it — the same
	 * contract `preflightWallFirstArchitectureCandidate` has, including `undefined` for an intent
	 * that cannot be derived at all.
	 */
	verdict(
		document: LayoutDocumentWallFirst,
		intent: WallFirstArchitectureProposalIntent,
		sampling?: WallSamplingDerivation
	): WallFirstArchitecturePreflightFailure | undefined;
	/** Forget the initialization; the next move re-initializes. */
	reset(): void;
	readonly stats: WallFirstArchitectureVerdictScopeStats;
};


/** One cheap, canonical refutation of a live direct-edit attempt. */
export type WallFirstArchitecturePreflightFailure = {
	code: string;
	message: string;
};


/** Target of one Bend gesture: how far along the Wall it was grabbed, and where. */
export type WallBendIntent = {
	/** Physical arc distance of the grab point from the Wall's canonical start. */
	distance: number;
	/** Where the dragged bend point sits now (document X/Z meters). */
	point: LayoutVec2;
};


// =====================================================================
// Small architectural preset set (creation defaults only).
//
// A preset is never a serialized kind, linked instance, library service or
// renderer branch: it resolves to ONE ordinary document-level LayoutObject of an
// existing primitive kind with finite/positive default dimensions, floor-relative
// placement, and no roomId. After creation the object edits/compiles/renders
// through the same object controls and canonical compiler as every manually
// created primitive.
// =====================================================================

/** Preset identifiers. No `Partition` preset: partitions are first-class wall-first Walls. */
export type LayoutArchitecturalPresetId = 'column' | 'platform' | 'plinth';


export type LayoutArchitecturalPreset = {
	id: LayoutArchitecturalPresetId;
	/** Human label for tool buttons (toolbar / Inspector Place accordion). */
	label: string;
	/** Ordinary `LayoutObject.kind` the preset creates — never a new kind. */
	kind: 'cylinder' | 'box';
	/** Finite/positive X/Z/Y meters (eye-call defaults, not constraints). */
	dimensions: Vec3;
};
