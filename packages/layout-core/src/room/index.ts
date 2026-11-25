export {
	closedWallLength,
	closedWallRadius,
	planCreateCircularRoom,
	planResizeClosedWallRadius,
	planTranslateClosedWall,
	prepareClosedCircleProposal,
	proposeCreateCircularWall,
	readClosedWallCircle,
} from '../layout-circular-room';

export type {
	CircularRoomPlan,
	CircularRoomRejection,
	CircularRoomRejectionCode,
	ClosedWallCircleFacts,
} from '../layout-circular-room';

export {
	chooseFloorSupport,
	DATUM_SUPPORT_ORDER_KEY,
	datumSupportCandidate,
	FLOOR_SUPPORT_TOLERANCES,
	FLOOR_SUPPORT_UP_NORMAL,
	floorSupportSnapshotOf,
	layoutDatumElevation,
	OVERHEAD_SUPPORT_DOWN_NORMAL,
	overheadSupportSnapshotOf,
	polygonContainsWithTolerance,
	queryFloorSupports,
	queryOverheadSupports,
} from '../layout-floor-support';

export type {
	FloorSupportCandidate,
	FloorSupportChoice,
	FloorSupportChoiceResult,
	FloorSupportQueryInput,
	FloorSupportQueryPolygon,
	FloorSupportQueryResult,
	FloorSupportRegionFacts,
	FloorSupportScope,
	FloorSupportSnapshot,
	FloorSupportTolerances,
	FloorSupportWitness,
	FloorSupportWitnessSource,
	OverheadSupportCandidate,
	OverheadSupportQueryInput,
	OverheadSupportQueryPolygon,
	OverheadSupportQueryResult,
	OverheadSupportSnapshot,
	OverheadSupportWitness,
} from '../layout-floor-support';

export {
	planCreateRegion,
	planDuplicateRegion,
	planFitRegionEdgeToWall,
	planFitRegionToSpace,
	planFitRegionToWalls,
	planFitWallsToRegion,
	planMoveRegion,
	planRemoveRegion,
	planRenameRegion,
	planRotateRegion,
	planSetRegionElevation,
	planSetRegionFootprint,
	planSetRegionIntendedGap,
	planSetRegionThickness,
} from '../layout-region';

export type {
	RegionCreateIntent,
	RegionPlan,
	RegionPlannerOperation,
	RegionPlannerRejection,
	RegionPlannerRejectionCode,
} from '../layout-region';

export {
	REGION_WALL_RELATION_EPSILON,
	REGION_WALL_RELATION_REACH_METERS,
	regionWallPlanClass,
	regionWallRelations,
	regionWallTopRangeY,
} from '../layout-region-relations';

export type {
	RegionWallMeasureSegment,
	RegionWallPlanClass,
	RegionWallPlanReading,
	RegionWallReading,
	RegionWallRelation,
	RegionWallRelationsResult,
} from '../layout-region-relations';

export {
	carryRegionWallIntents,
	LAYOUT_SLICE_CONTACT_METERS,
	MAX_LAYOUT_REGION_POINTS,
	regionFootprintBounds,
	regionGeometryIssues,
	regionVerticalBand,
} from '../layout-region-validation';

export {
	connectedRoomIds,
	isSupportedLayoutObject,
	resolveIsolatedRoomGroupSubgraph,
	resolveIsolatedRoomSubgraph,
	resolveRoomCopyEnclosure,
} from '../layout-room-isolation';

export type {
	IsolatedRoomGroupSubgraph,
	IsolatedRoomGroupSubgraphResult,
	IsolatedRoomSubgraph,
	IsolatedRoomSubgraphResult,
	RoomCopyDroppedRelation,
	RoomCopyEnclosure,
	RoomCopyEnclosureResult,
	RoomIsolationRejection,
	RoomIsolationRejectionCode,
} from '../layout-room-isolation';

export {
	planWallFirstRoomMove,
	planWallFirstRoomRotation,
	proposeWallFirstRoomUnitGeometry,
	proposeWallFirstRoomUnitRotation,
	roomBoundaryCycleKey,
	roomUnitMoveCandidate,
	rotatePointAbout,
	rotateRoomUnitMoveCandidate,
} from '../layout-room-move';

export type {
	RoomMovePlan,
	RoomMoveRejection,
	RoomMoveRejectionCode,
	RoomUnitMoveProposalWall,
	RoomUnitMoveSubgraph,
} from '../layout-room-move';

export {
	buildCorrespondenceComponents,
	clearCorrespondenceObserverForTest,
	composeSpaceBoundary,
	correspondenceAuthorization,
	createRoomBoundaryLookup,
	disableCorrespondenceShortCircuitsForTest,
	interiorWitness,
	reconcileRooms,
	reconcileRoomsWithGeometry,
	roomBoundaryPolygon,
	setCorrespondenceObserverForTest,
	spaceBoundaryCycleKey,
	spaceBoundaryPolygonFromEdges,
	spaceOpenSideCount,
	wallRef,
} from '../layout-room-reconciliation';

export type {
	ComponentLineage,
	CorrespondenceAuthorization,
	CorrespondenceObservation,
	CorrespondencePairClass,
	ReconciliationFailure,
	ReconciliationRejection,
	ReconciliationResult,
	RoomBoundaryLookup,
	RoomIdAllocator,
	RoomLineageRecord,
	RoomReconciliation,
	SpaceBoundaryEdge,
	SpaceBoundaryIssue,
	SpaceBoundaryIssueCode,
	SpaceBoundaryResult,
	SpaceLifecyclePolicy,
	SpaceRetirement,
	SpaceRetirementReason,
} from '../layout-room-reconciliation';

export {
	planReleaseRoundRoom,
	planResizeRoundRoomRadius,
} from '../layout-round-ops';

export type {
	ReleaseRoundRoomPlan,
	ReleaseRoundRoomRejection,
	ReleaseRoundRoomRejectionCode,
	RoundRoomRadiusPlan,
	RoundRoomRadiusRejection,
	RoundRoomRadiusRejectionCode,
} from '../layout-round-ops';

export {
	buildRoundRoomGeometryFromCertified,
	certifyRoundRoom,
	enumerateClosedWallSafeCutStations,
	findEnclosingRoundRoomForWall,
	findRoundRoomSeamOwner,
	guardRoundRoomMemberGeometryEdit,
	isEnclosedClosedCircleBoundary,
	partitionClosedWallChainAtStations,
	rotateBoundaryToSeam,
	ROUND_ROOM_MEMBER_EDIT_MESSAGE,
	roundRoomSeamJunctionId,
	validateRoundRooms,
} from '../layout-round-room';

export type {
	CertifiedRoundRoom,
	CertifiedRoundSubspan,
	ClosedWallPartitionSegment,
	ClosedWallSafeCutSearch,
	RoundCertificationResult,
	RoundOperationCorrespondence,
	RoundOperationJunctionCorrespondence,
	RoundOperationOpeningCorrespondence,
	RoundOperationRoomCorrespondence,
	RoundOperationWallCorrespondence,
	RoundRoomMemberGuardHit,
} from '../layout-round-room';

export {
	createSpaceCreationOutlineQuery,
	findSpaceCreationOutline,
	findSpaceCreationReturn,
	isSpaceCreationCycle,
	planCreateOpenSpace,
	spaceCreationAnchorKey,
	spaceCreationAnchorPoint,
	spaceCreationContains,
	spaceCreationWallChoices,
} from '../layout-space-create';

export type {
	PlannedSpaceCreation,
	SpaceCreationAnchor,
	SpaceCreationCycle,
	SpaceCreationEvidence,
	SpaceCreationOutline,
	SpaceCreationRefusal,
	SpaceCreationSpan,
} from '../layout-space-create';

export {
	proposeSpaceOpenSideOffset,
	spaceOpenSideFrame,
	spaceOpenSideFrames,
} from '../layout-space-open-side';

export type {
	SpaceOpenSideEndWall,
	SpaceOpenSideFrame,
} from '../layout-space-open-side';

export {
	polygonContainsPolygon,
	spaceOutlineSelfIntersects,
	spaceOutlineSignedArea,
} from '../layout-space-outline';

export {
	isOpenSpace,
	spacePlacementIssues,
} from '../layout-space-placement';

export type {
	SpacePlacementIssue,
} from '../layout-space-placement';

export {
	junctionsShareTopologyComponent,
	roomIdsConnectedByTopology,
	topologyComponentKeyByJunctionId,
	topologyComponentKeyByRoomId,
	topologyComponentKeyByWallId,
	UNATTACHED_JUNCTION_COMPONENT,
	wallIdsConnectedTo,
	wallJunctionComponents,
	wallsShareTopologyComponent,
} from '../layout-topology-components';

export type {
	JunctionTopologyComponentKey,
	LayoutTopologyComponent,
} from '../layout-topology-components';
