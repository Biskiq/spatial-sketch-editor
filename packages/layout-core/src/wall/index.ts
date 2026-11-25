export {
	buildClosedWallCircleCenterline,
	buildClosedWallCircleCenterlineFromRay,
	CLOSED_WALL_CIRCLE_ACCURACY,
	createClosedWallCircleDocument,
	isClosedWall,
} from '../layout-closed-wall';

export type {
	ClosedWallCircleAccuracy,
	ClosedWallCircleConstruction,
	ClosedWallCircleDocumentResult,
	ClosedWallCircleRejection,
} from '../layout-closed-wall';

export {
	joinSeamFailure,
	JUNCTION_SEAM_EPSILON,
	JUNCTION_SEAM_MESSAGES,
	JUNCTION_SEAM_PARALLEL_TOLERANCE,
	junctionOutwardRay,
	junctionSeamFailure,
	junctionSeamFailureOf,
	junctionSeamFailureOfCompiled,
	wallEndsSeamFailure,
} from '../layout-junction-clearance';

export type {
	JunctionSeamCode,
	JunctionSeamFailure,
	JunctionSeamInput,
} from '../layout-junction-clearance';

export {
	coincidentJunctionPairs,
	coincidesAsJunction,
	JUNCTION_COINCIDENCE_EPSILON,
} from '../layout-junction-identity';

export {
	compiledJunctionId,
	endpointSolidBands,
	isFoldPair,
	isTangentContinuation,
	JUNCTION_BAND_EPSILON,
	JUNCTION_DET_EPSILON,
	JUNCTION_MITER_LIMIT,
	JUNCTION_PROBE_TOLERANCE,
	JUNCTION_SECTOR_SNAP,
	JUNCTION_SURFACE_PROBE,
	legEndBoundary,
	legJoinsByWall,
	legSolidInBand,
	negateVec2,
	outwardTangent,
	resolveJunctionGeometry,
	resolveLegPairCorner,
	resolveSharedCornerSide,
	tangentAnchorsAllowContinuation,
} from '../layout-junction-resolution';

export type {
	CompiledWallEnds,
	CornerSideResolution,
} from '../layout-junction-resolution';

export {
	OPENING_SET_EPSILON,
	validateWallFirstOpeningSet,
	validateWallFirstOpeningSubset,
	wallFirstOpeningSetIsValid,
	wallFirstWallIndex,
	wallFirstWallLength,
	wallFirstWallSpan,
} from '../layout-opening-set';

export type {
	OpeningSetIssue,
	OpeningSetIssueCode,
	WallFirstWallIndex,
} from '../layout-opening-set';

export {
	clearWallSamplingObserverForTest,
	cloneWallCenterline,
	cloneWallCubicSpan,
	cloneWallCurveKnot,
	createWallSamplingDerivation,
	hasWallSamplingObserverForTest,
	isCanonicalWallSampling,
	nextWallCurveKnotId,
	orientedWallChainKnotsAndSpans,
	projectPointToWallCenterline,
	setWallSamplingObserverForTest,
	translateWallCenterline,
	wallCenterlineCarriesPoint,
	wallCenterlineCubics,
	wallCenterlinePoints,
	wallCenterlineSamples,
	wallCenterlineSegment,
	wallCubicChain,
} from '../layout-wall-centerline';

export type {
	WallCenterlineSegment,
	WallCenterlineTraversal,
	WallSamplingCallObservation,
	WallSamplingDerivation,
} from '../layout-wall-centerline';

export {
	createCapturedWallChainAllocator,
	measureWallArc,
	MIN_WALL_ARC_RISE,
	planWallChain,
	planWallSegment,
	WALL_CHAIN_DEFAULTS,
} from '../layout-wall-chain';

export type {
	WallArcMeasures,
	WallChainArc,
	WallChainIdAllocator,
	WallChainPlan,
	WallChainPlanOptions,
	WallChainRejection,
	WallChainRejectionCode,
	WallEndpointHostSnap,
	WallEndpointJunctionSnap,
} from '../layout-wall-chain';

export {
	detectUnsupportedChainConnections,
} from '../layout-wall-chain-policy';

export type {
	WallChainPolicyInput,
	WallChainPolicyRejection,
	WallChainPolicyRejectionCode,
} from '../layout-wall-chain-policy';

export {
	deleteWallCurveKnot,
	insertWallCurveKnot,
	moveWallCurveKnot,
	resolveWallCurveSplit,
	resolveWallCurveSplitAtKnot,
	subdivideWallCubicSpan,
	WALL_CURVE_SPLIT_MAX_BISECTIONS,
	WALL_CURVE_SPLIT_PARAMETER_TOLERANCE,
	wallCurveChainCubics,
	wallCurveChainLength,
	wallCurveChainPoints,
	wallCurveChainSatisfiesInvariant,
	wallCurveKnotArcDistance,
	wallCurveKnotDistanceAt,
} from '../layout-wall-curve-algebra';

export type {
	ResolvedWallSplit,
	ResolvedWallSplitResult,
	WallCurveChain,
	WallCurveEditRejection,
	WallCurveFragment,
	WallSplitRejection,
	WallSplitResolution,
} from '../layout-wall-curve-algebra';

export {
	buildDevelopedWallMesh,
	createWallDevelopmentBuffers,
	createWallDevelopmentSheetBuffers,
	developmentDisplaySamples,
	developmentFaceFrame,
	developmentInversePoint,
	developmentOpeningFragments,
	developmentOpeningIdentity,
	developmentOpeningTopAt,
	developmentOverlap,
	developmentPointAtSheetFromBuffers,
	developmentPointAtStation,
	developmentPointAtStationFromBuffers,
	developmentSheetCoordinate,
	developmentSheetToStation,
	developmentStationDistanceFromAnchor,
	evaluateWallDevelopment,
	evaluateWallDevelopmentSheet,
	isWallDevelopmentRefusal,
	mapAttributedVertices,
	orderedDevelopmentSamples,
	prepareWallDevelopment,
	spanForStation,
	validateDevelopedMesh,
	validateWallDevelopment,
	WALL_DEVELOPMENT_STATION_TOLERANCE,
	WALL_DEVELOPMENT_TOLERANCE,
	wallDevelopmentFaceLengths,
} from '../layout-wall-development';

export type {
	WallDevelopment,
	WallDevelopmentBuffers,
	WallDevelopmentDisplaySample,
	WallDevelopmentFace,
	WallDevelopmentFaceFrame,
	WallDevelopmentInversePoint,
	WallDevelopmentIssue,
	WallDevelopmentIssueCode,
	WallDevelopmentMesh,
	WallDevelopmentMeshHole,
	WallDevelopmentMeshOptions,
	WallDevelopmentMeshTriangle,
	WallDevelopmentMeshVertex,
	WallDevelopmentOpening,
	WallDevelopmentOpeningBand,
	WallDevelopmentOpeningFragment,
	WallDevelopmentOpeningInput,
	WallDevelopmentPoint,
	WallDevelopmentRefusal,
	WallDevelopmentSheetBuffers,
	WallDevelopmentSourceSpan,
} from '../layout-wall-development';

export {
	planDissolveJunction,
} from '../layout-wall-dissolve';

export type {
	DissolvePlan,
	DissolveRejection,
	DissolveSpecificRejection,
	DissolveSpecificRejectionCode,
} from '../layout-wall-dissolve';

export {
	createEmptyWallFirstLayoutDocument,
	parseWallFirstLayoutDocumentJson,
	serializeWallFirstLayoutDocument,
	validateWallFirstLayoutDocument,
	wallFirstCanonicalFormatVersionIssue,
} from '../layout-wall-first-codec';

export type {
	WallFirstLayoutValidationResult,
} from '../layout-wall-first-codec';

export {
	createWallFirstArchitectureVerdictScope,
	LAYOUT_ARCHITECTURAL_PRESETS,
	layoutArchitecturalPreset,
	layoutPresetPlacement,
	MAX_WALL_CURVE_KNOTS,
	planAddWallVertex,
	planBendWallCurveKnot,
	planCommitLayoutObjectPreset,
	planConvertWallToCurve,
	planConvertWallToLine,
	planDeleteLayoutObject,
	planDeleteWallCurveKnot,
	planExactJunctionMove,
	planExactLayoutObjectTransform,
	planExactRectangleDimensions,
	planExactWallAngle,
	planExactWallHeight,
	planExactWallLength,
	planExactWallThickness,
	planInsertWallCurveKnot,
	planMoveWallCurveKnot,
	planRigidWallMove,
	planSpaceOpenSideEndSlide,
	planSpaceOpenSideOffset,
	planWallSubdivision,
	preflightWallFirstArchitectureCandidate,
	prepareWallBend,
	proposeWallCurveShape,
	proposeWallFirstArchitectureGeometry,
	proposeWallKnotRemoval,
	readWallFirstDragProposal,
	resolveProposedCurveChain,
	resolveRectangle,
	wallFirstArchitectureAffectedExtent,
} from '../precision';

export {
	detectWallCurveTopologyCrossings,
	validateClosedWallContacts,
	validateWallFirstTopology,
} from '../topology';

export type {
	FixedWallEndpoint,
	LayoutArchitecturalPreset,
	LayoutArchitecturalPresetId,
	LayoutObjectTransformPatch,
	PrecisionOperation,
	PrecisionPlan,
	PrecisionRejection,
	RectangleResizeOptions,
	RectangleResolution,
	ResolvedRectangle,
	SpaceOpenSideSlidePlan,
	WallAngleIntent,
	WallBendIntent,
	WallCurveProposeIntent,
	WallFirstAcceptanceCompile,
	WallFirstArchitectureAffectedExtent,
	WallFirstArchitectureCandidatePair,
	WallFirstArchitecturePreflightFailure,
	WallFirstArchitectureProposalIntent,
	WallFirstArchitectureProposalWall,
	WallFirstArchitectureVerdictScope,
	WallFirstArchitectureVerdictScopeStats,
	WallLengthIntent,
	WallMoveIntent,
} from '../precision';

export type {
	WallCurveTopologyCrossing,
	WallCurveTopologyCrossingSubject,
	WallFirstTopologyOptions,
} from '../topology';

export type {
	LayoutDerivedWallRole,
	LayoutDocumentWallFirst,
	LayoutFormatVersion,
	LayoutIdentityFamily,
	LayoutIdentityLedger,
	LayoutJunction,
	LayoutObject,
	LayoutRegion,
	LayoutRoomRound,
	LayoutSpaceOverhead,
	LayoutSpaceVirtualEdge,
	LayoutWall,
	LayoutWallCenterline,
	LayoutWallCubicSpan,
	LayoutWallCurveKnot,
	LayoutWallFirstFloor,
	LayoutWallFirstRoom,
	LayoutWallOpening,
	LayoutWallFirstRoom as NodingRoom,
	OrientedWallRef,
} from '../layout-wall-first-types';

export {
	CLOSED_WALL_CIRCLE_KNOT_COUNT,
	CLOSED_WALL_CIRCLE_SPAN_COUNT,
	KNOWN_LAYOUT_FORMAT_VERSIONS,
	LAYOUT_IDENTITY_FAMILIES,
	LAYOUT_WALL_FIRST_FORMAT_VERSION,
} from '../layout-wall-first-types';

export {
	resolveWallBirthHeight,
	uniqueIncidentWallHeight,
	validateWallFirstWallHeights,
	validateWallHeight,
	WALL_AUTHORING_DEFAULT_HEIGHT,
	WALL_HEIGHT_EPSILON,
} from '../layout-wall-heights';

export type {
	WallHeightIssue,
	WallHeightIssueCode,
} from '../layout-wall-heights';

export {
	planWallCrossing,
	planWallSplit,
	planWallSplitAtPoint,
} from '../layout-wall-noding';

export type {
	NodingIdAllocator,
	NodingPlan,
	NodingPlanSuccess,
	NodingRejection,
} from '../layout-wall-noding';

export {
	minPolylineDistance,
	offsetCurveSamples,
	polylineSegmentDistance,
	polylineSelfClearance,
	WALL_CLEARANCE_INSUFFICIENT_CODE,
	WALL_OFFSET_FOLD_CODE,
	WALL_OFFSET_FOLD_MESSAGE,
	WALL_OFFSET_OVERLAP_CODE,
	WALL_OFFSET_OVERLAP_MESSAGE,
	wallOffsetClearanceFailure,
	wallPairClearanceOverlap,
} from '../layout-wall-offset-clearance';

export type {
	WallOffsetClearanceFailure,
} from '../layout-wall-offset-clearance';

export {
	planCenterWallFirstOpening,
	planCreateWallFirstOpening,
	planDeleteWallFirstOpening,
	planMoveWallFirstOpening,
	planUpdateWallFirstOpening,
	WALL_OPENING_DEFAULTS,
	wallFirstCenterOffset,
	wallFirstOffsetFromEndDistance,
	wallFirstOffsetFromStartDistance,
	wallFirstOpeningClearances,
	wallFirstOpeningMetrics,
} from '../layout-wall-openings';

export type {
	WallFirstOpeningIntent,
	WallFirstOpeningMetrics,
	WallOpeningOperation,
	WallOpeningPatch,
	WallOpeningPlan,
	WallOpeningRejection,
	WallOpeningRejectionCode,
} from '../layout-wall-openings';

export {
	independentWallOverlaps,
	LAYOUT_WALL_OVERLAP_EPSILON,
} from '../layout-wall-overlap';

export type {
	LayoutIndependentWallOverlap,
	LayoutWallOverlapObservation,
	LayoutWallOverlapStretch,
} from '../layout-wall-overlap';

export {
	validateWallFirstPortalRelations,
	wallFirstAdjacentRooms,
} from '../layout-wall-portals';

export type {
	WallFirstPortalIssue,
	WallFirstPortalIssueCode,
} from '../layout-wall-portals';

export {
	deriveLayoutWallRole,
	deriveLayoutWallRoles,
	layoutWallRoomMemberships,
} from '../layout-wall-role';

export {
	classifyWallIntersection,
	sampledWallExtentsOverlap,
	sampledWallsCross,
	sampledWallSelfIntersects,
} from '../layout-wall-topology';

export type {
	SampledTopologyWall,
	TopologySegment,
	WallIntersection,
	WallIntersectionKind,
} from '../layout-wall-topology';

export {
	closedChainWalls,
	createAuthoringRoomAllocator,
	planDeleteWall,
	planDeleteWalls,
	planFirstEnclosureCreation,
	planOpeningMetadataUpdate,
	planRemoveRoom,
	planRemoveSpace,
	planRoomMetadataUpdate,
	planWallMetadataUpdate,
	roomExclusiveBoundaryWallIds,
	validateAndCompile,
} from '../layout-wall-topology-ops';

export type {
	OptionalNamePatch,
	RoomMetadataPatch,
	WallFirstOpPlan,
	WallFirstOpRejection,
	WallFirstOpRejectionCode,
} from '../layout-wall-topology-ops';
