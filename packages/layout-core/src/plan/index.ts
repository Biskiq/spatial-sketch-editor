export {
	alignReferenceKey,
	planLayoutObjectAlign,
} from '../layout-align';

export type {
	AlignAction,
	AlignAxis,
	AlignAxisAction,
	AlignPlan,
	AlignReference,
	AlignReferenceKind,
	AlignRejectionCode,
} from '../layout-align';

export {
	isSupportedDuplicateLayoutObject,
	LAYOUT_DUPLICATE_MAX_COPIES,
	planDuplicateIsolatedRoom,
	planDuplicateRoom,
	planRepeatLayoutObject,
	planRepeatWallOpening,
} from '../layout-duplicate';

export type {
	DuplicateOperation,
	DuplicatePlan,
	DuplicateRejection,
	DuplicateRejectionCode,
	LayoutObjectRepeatIntent,
	RoomCopyCorrespondence,
	RoomDuplicateIntent,
	WallOpeningRepeatIntent,
} from '../layout-duplicate';

export {
	allocateCapturedId,
	assertCapturedIdUnused,
	isLayoutIdCapture,
	LAYOUT_ID_NONCE_INPUT,
	LAYOUT_WORKING_LEVEL_INPUT,
	layoutCapturedId,
	layoutIdCaptureInput,
	LayoutIdCollisionError,
	layoutWorkingLevelInput,
	layoutWorkingLevelIssue,
	mintLayoutIdCapture,
	readLayoutIdCapture,
	readLayoutWorkingLevel,
} from '../layout-id-capture';

export type {
	LayoutCapturedInput,
	LayoutIdCapture,
} from '../layout-id-capture';

export {
	emptyLayoutIdentityLedger,
	formatLayoutReference,
	indexOfReference,
	isLayoutReference,
	LAYOUT_IDENTITY_CURSOR_BEHIND_REFERENCE,
	LAYOUT_IDENTITY_EXHAUSTED_CODE,
	LAYOUT_IDENTITY_MALFORMED_REFERENCE,
	LAYOUT_REFERENCE_ALPHABET,
	LAYOUT_REFERENCE_INVERSE_MULTIPLIER,
	LAYOUT_REFERENCE_MULTIPLIER,
	LAYOUT_REFERENCE_OFFSET,
	LAYOUT_REFERENCE_PATTERN,
	LAYOUT_REFERENCE_PREFIX,
	LAYOUT_REFERENCE_SPACE,
	LAYOUT_REFERENCE_SUFFIX_LENGTH,
	layoutAuthoredCanonicalJson,
	layoutIdentityCursor,
	layoutIdentityCursorIssues,
	LayoutIdentityExhaustedError,
	layoutIdentityHighWater,
	layoutIdentityIsComplete,
	parseLayoutReference,
	promoteLayoutIdentity,
	referenceFor,
	repairLayoutIdentityCursor,
	withLayoutIdentity,
} from '../layout-identity';

export type {
	ParsedLayoutReference,
} from '../layout-identity';

export type {
	LayoutDocumentIssue,
} from '../layout-issue';

export {
	LayoutDocumentValidationError,
} from '../layout-issue';

export {
	nextLayoutPresetObjectId,
	planCommitLayoutObjectPresetWithId,
} from '../layout-preset-explicit';

export {
	dedupeWallSpans,
	LAYOUT_PLAN_GRID_STEP,
	LAYOUT_PLAN_SNAP_RADIUS_CSS_PX,
	objectBoundsSnapCandidates,
	objectFootprintCenter,
	openingEdgeSnapCandidates,
	orthogonalGuideCandidates,
	pickSnapWinner,
	resolveLayoutSnap,
	resolveOpeningDragEdgeSnap,
	resolveOpeningDragRawValidity,
	resolveOpeningDragSnap,
	resolveOpeningDragSnapUseMode,
	snapAcquisitionRadiusWorld,
	snapOwnerKey,
	snapToGridStep,
	spanSnapCandidates,
	wallIntersectionSnapCandidates,
	wallOwnerKey,
	wallSnapIndex,
} from '../layout-snap';

export type {
	DerivedWallSnapIndex,
	MergedWallSpan,
	OpeningDragAnchor,
	OpeningDragRawResolution,
	OpeningDragSnapCandidate,
	OpeningDragSnapResolution,
	P23B1SnapInputEntry,
	SnapCandidate,
	SnapFeatureKind,
	SnapGuide,
	SnapInputContext,
	SnapOwner,
	SnapOwnerKind,
	SnapQueryContext,
	SnapResolution,
} from '../layout-snap';

export {
	duplicateRegionSurfaceLineage,
	duplicateRoomSurfaceLineage,
	joinWallSurfaceLineage,
	normalizeLayoutSurfaceLineage,
	repackWallSurfaceLineage,
	resolveLayoutSurface,
	resolveLayoutSurfaceReference,
	roomSurfaceLineage,
	spaceOfSurface,
	spacePaintReading,
	splitWallSurfaceLineage,
	surfaceKey,
	surfacesOfSpace,
	wallSideAt,
	wallSideSurfaceRef,
} from '../layout-surface-reference';

export type {
	LayoutGeometrySurfaceRef,
	LayoutRegionSurfaceRef,
	LayoutRoomFloorSurfaceRef,
	LayoutRoomLidSurfaceRef,
	LayoutSpaceSurfaceRef,
	LayoutSurfaceFace,
	LayoutSurfaceLifecycle,
	LayoutSurfaceLineage,
	LayoutSurfaceLineageEntry,
	LayoutSurfaceLineageNormalization,
	LayoutSurfaceRef,
	LayoutSurfaceResolution,
	LayoutWallSide,
	LayoutWallSideSurfaceRef,
	SpaceOfSurface,
	SpaceSurfaceExclusion,
	SurfacesOfSpace,
} from '../layout-surface-reference';
