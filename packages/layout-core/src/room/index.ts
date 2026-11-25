export { closedWallLength, closedWallRadius, planCreateCircularRoom, planResizeClosedWallRadius, planTranslateClosedWall, prepareClosedCircleProposal, proposeCreateCircularWall, readClosedWallCircle } from './circular-room';

export type { CircularRoomPlan, CircularRoomRejection, CircularRoomRejectionCode, ClosedWallCircleFacts } from './circular-room';

export { chooseFloorSupport, DATUM_SUPPORT_ORDER_KEY, datumSupportCandidate, FLOOR_SUPPORT_TOLERANCES, FLOOR_SUPPORT_UP_NORMAL, floorSupportSnapshotOf, layoutDatumElevation, OVERHEAD_SUPPORT_DOWN_NORMAL, overheadSupportSnapshotOf, polygonContainsWithTolerance, queryFloorSupports, queryOverheadSupports } from './floor-support';

export type { FloorSupportCandidate, FloorSupportChoice, FloorSupportChoiceResult, FloorSupportQueryInput, FloorSupportQueryPolygon, FloorSupportQueryResult, FloorSupportRegionFacts, FloorSupportScope, FloorSupportSnapshot, FloorSupportTolerances, FloorSupportWitness, FloorSupportWitnessSource, OverheadSupportCandidate, OverheadSupportQueryInput, OverheadSupportQueryPolygon, OverheadSupportQueryResult, OverheadSupportSnapshot, OverheadSupportWitness } from './floor-support';

export { planCreateRegion, planDuplicateRegion, planFitRegionEdgeToWall, planFitRegionToSpace, planFitRegionToWalls, planFitWallsToRegion, planMoveRegion, planRemoveRegion, planRenameRegion, planRotateRegion, planSetRegionElevation, planSetRegionFootprint, planSetRegionIntendedGap, planSetRegionThickness } from './region';

export type { RegionCreateIntent, RegionPlan, RegionPlannerOperation, RegionPlannerRejection, RegionPlannerRejectionCode } from './region';

export { REGION_WALL_RELATION_EPSILON, REGION_WALL_RELATION_REACH_METERS, regionWallPlanClass, regionWallRelations, regionWallTopRangeY } from './region-relations';

export type { RegionWallMeasureSegment, RegionWallPlanClass, RegionWallPlanReading, RegionWallReading, RegionWallRelation, RegionWallRelationsResult } from './region-relations';

export { carryRegionWallIntents, LAYOUT_SLICE_CONTACT_METERS, MAX_LAYOUT_REGION_POINTS, regionFootprintBounds, regionGeometryIssues, regionVerticalBand } from './region-validation';

export { connectedRoomIds, isSupportedLayoutObject, resolveIsolatedRoomGroupSubgraph, resolveIsolatedRoomSubgraph, resolveRoomCopyEnclosure } from './isolation';

export type { IsolatedRoomGroupSubgraph, IsolatedRoomGroupSubgraphResult, IsolatedRoomSubgraph, IsolatedRoomSubgraphResult, RoomCopyDroppedRelation, RoomCopyEnclosure, RoomCopyEnclosureResult, RoomIsolationRejection, RoomIsolationRejectionCode } from './isolation';

export { planWallFirstRoomMove, planWallFirstRoomRotation, proposeWallFirstRoomUnitGeometry, proposeWallFirstRoomUnitRotation, roomBoundaryCycleKey, roomUnitMoveCandidate, rotatePointAbout, rotateRoomUnitMoveCandidate } from './move';

export type { RoomMovePlan, RoomMoveRejection, RoomMoveRejectionCode, RoomUnitMoveProposalWall, RoomUnitMoveSubgraph } from './move';

export { buildCorrespondenceComponents, correspondenceAuthorization } from './reconciliation-correspondence'
export { clearCorrespondenceObserverForTest, disableCorrespondenceShortCircuitsForTest, setCorrespondenceObserverForTest } from './reconciliation-observation'
export { composeSpaceBoundary, createRoomBoundaryLookup, interiorWitness, roomBoundaryPolygon, spaceBoundaryCycleKey, spaceBoundaryPolygonFromEdges, spaceOpenSideCount } from './reconciliation-boundary'
export { reconcileRooms, reconcileRoomsWithGeometry } from './reconciliation'
export { wallRef } from './reconciliation-survivors';

export type { ComponentLineage, ReconciliationFailure, ReconciliationRejection, ReconciliationResult, RoomIdAllocator, RoomLineageRecord, RoomReconciliation, SpaceLifecyclePolicy, SpaceRetirement, SpaceRetirementReason } from './reconciliation-types'
export type { CorrespondenceAuthorization, CorrespondencePairClass } from './reconciliation-correspondence'
export type { CorrespondenceObservation } from './reconciliation-observation'
export type { RoomBoundaryLookup, SpaceBoundaryEdge, SpaceBoundaryIssue, SpaceBoundaryIssueCode, SpaceBoundaryResult } from './reconciliation-boundary';

export { planReleaseRoundRoom, planResizeRoundRoomRadius } from './round-ops';

export type { ReleaseRoundRoomPlan, ReleaseRoundRoomRejection, ReleaseRoundRoomRejectionCode, RoundRoomRadiusPlan, RoundRoomRadiusRejection, RoundRoomRadiusRejectionCode } from './round-ops';

export { buildRoundRoomGeometryFromCertified, certifyRoundRoom, enumerateClosedWallSafeCutStations, findEnclosingRoundRoomForWall, findRoundRoomSeamOwner, guardRoundRoomMemberGeometryEdit, isEnclosedClosedCircleBoundary, partitionClosedWallChainAtStations, rotateBoundaryToSeam, ROUND_ROOM_MEMBER_EDIT_MESSAGE, roundRoomSeamJunctionId, validateRoundRooms } from './round-room';

export type { CertifiedRoundRoom, CertifiedRoundSubspan, ClosedWallPartitionSegment, ClosedWallSafeCutSearch, RoundCertificationResult, RoundOperationCorrespondence, RoundOperationJunctionCorrespondence, RoundOperationOpeningCorrespondence, RoundOperationRoomCorrespondence, RoundOperationWallCorrespondence, RoundRoomMemberGuardHit } from './round-room';

export { createSpaceCreationOutlineQuery, findSpaceCreationOutline, findSpaceCreationReturn, isSpaceCreationCycle, planCreateOpenSpace, spaceCreationAnchorKey, spaceCreationAnchorPoint, spaceCreationContains, spaceCreationWallChoices } from './space-create';

export type { PlannedSpaceCreation, SpaceCreationAnchor, SpaceCreationCycle, SpaceCreationEvidence, SpaceCreationOutline, SpaceCreationRefusal, SpaceCreationSpan } from './space-create';

export { proposeSpaceOpenSideOffset, spaceOpenSideFrame, spaceOpenSideFrames } from './space-open-side';

export type { SpaceOpenSideEndWall, SpaceOpenSideFrame } from './space-open-side';

export { polygonContainsPolygon, spaceOutlineSelfIntersects, spaceOutlineSignedArea } from './space-outline';

export { isOpenSpace, spacePlacementIssues } from './space-placement';

export type { SpacePlacementIssue } from './space-placement';

export { junctionsShareTopologyComponent, roomIdsConnectedByTopology, topologyComponentKeyByJunctionId, topologyComponentKeyByRoomId, topologyComponentKeyByWallId, UNATTACHED_JUNCTION_COMPONENT, wallIdsConnectedTo, wallJunctionComponents, wallsShareTopologyComponent } from './topology-components';

export type { JunctionTopologyComponentKey, LayoutTopologyComponent } from './topology-components';
