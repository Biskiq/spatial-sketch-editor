export type {
	LayoutVec2,
} from '../layout-coordinates';

export {
	canonicalBoundaryCycleKey,
	clearFaceSamplingObserverForTest,
	extractBoundaryCandidateFaces,
	faceArea,
	hasFaceSamplingObserverForTest,
	ON_RING_TOLERANCE,
	pointStrictlyInsidePolygon,
	polygonIntersectionArea,
	polygonsShareInteriorArea,
	setFaceSamplingObserverForTest,
} from '../layout-face-extraction';

export type {
	DerivedCandidateFace,
	FaceExtractionResult,
	FaceSamplingObservation,
	TopologyDiagnostic,
} from '../layout-face-extraction';

export {
	activeLayoutCompileSession,
	compileLayoutGeometrySource,
	compileWallFirstLayoutGeometry,
	compileWallFirstLayoutGeometryFresh,
	createLayoutCompileSession,
	withLayoutCompileSession,
} from '../layout-geometry';

export type {
	LayoutCompileSession,
	LayoutGeometryCompileOptions,
} from '../layout-geometry';

export {
	autoBezierAnchorPoints,
	clearSampleSegmentObserverForTest,
	compileAutoBezierAnchors,
	cubicBezierArcLength,
	cubicBezierArcLengthAt,
	cubicBezierArcLengthBetween,
	cubicBezierDerivative,
	cubicBezierPoint,
	CURVE_ARC_LENGTH_MAX_DEPTH,
	CURVE_ARC_LENGTH_TOLERANCE,
	CURVE_ENDPOINT_EPSILON,
	CURVE_FLATNESS_TOLERANCE,
	CURVE_MAX_SAMPLE_SPAN,
	CURVE_SELF_INTERSECTION_TOLERANCE,
	deriveChainSpans,
	deriveCubicSpanControls,
	hasSampleSegmentObserverForTest,
	LAYOUT_AUTO_BEZIER_ALPHA,
	LayoutGeometrySamplingError,
	legacyBezierToAutoBezier,
	MAX_CURVE_SAMPLES_PER_SEGMENT,
	nextInteriorAnchorId,
	OPENING_CENTER_EPSILON,
	openingCenterFrame,
	openingCenterPolyline,
	pointAlongSamples,
	pointAtDistance,
	projectPointToSampledSegment,
	sampledIsClosed,
	sampledPolylineIntersects,
	sampledPolylineSelfIntersects,
	samplePolylineInRange,
	sampleSegment,
	segmentLength,
	segmentPointAt,
	segmentTangentAt,
	segmentVertexPoints,
	setSampleSegmentObserverForTest,
	spansToCubics,
} from '../layout-geometry-curve';

export type {
	AutoBezierSegment,
	CubicBezierShape,
	CubicChainSegment,
	CubicSpanControls,
	CurveDistanceResult,
	CurvedSampleableSegment,
	CurveSample,
	LegacyBezierSegment,
	OpeningCenterMode,
	OpeningHostSamples,
	SampleableSegment,
	SampledSegment,
	SampleSegmentCallObservation,
} from '../layout-geometry-curve';

export {
	diffCompiledWalls,
	indexedCompiledWall,
	indexedCompiledWallQueries,
	readPassiveCompiledGeometry,
	recordPassiveCompiledGeometry,
	sealCompiledLayoutSnapshot,
} from '../layout-geometry-delta';

export {
	exceedsLayoutDimension,
	LAYOUT_DIMENSION_LIMIT_MESSAGE,
	layoutDimensionIssueMessage,
	layoutDimensionLimitIssues,
	layoutWallSpanMeters,
	MAX_LAYOUT_DIMENSION_METERS,
} from '../layout-geometry-limits';

export {
	convexHull,
	describeLayoutObject,
	findHitLayoutObject,
	pointInPolygon,
	rotateXyz,
	sphereRenderScale,
	transformedObjectSamples,
	transformObjectPoint,
} from '../layout-geometry-objects';

export type {
	LayoutObjectAabb,
	LayoutObjectDescriptor,
} from '../layout-geometry-objects';

export {
	ARCH_PROFILE_EPSILON,
	archProfileTopAt,
	buildArchProfile,
	LAYOUT_GEOMETRY_EPSILON,
	lineLength,
	offsetInsideOpeningIntervals,
	openingIntervals,
	samplesInDistanceRange,
	splitSampledWallAroundOpenings,
	splitWallAroundOpenings,
	wallPolylinesAroundOpenings,
} from '../layout-geometry-openings';

export type {
	ArchProfile,
	ArchProfileIssue,
	ArchProfileResult,
	WallOpeningInterval,
} from '../layout-geometry-openings';

export {
	bounds2,
	compiledQueryGeometry,
	createQueryGeometryBuilder,
	findPolygonContaining,
	overheadSourcesOf,
	polygonBounds2,
	projectPointToSpans,
	regionsOverSpace,
	resolveLayoutRoomInterior,
	spaceAtPoint,
} from '../layout-geometry-queries';

export type {
	LayoutRoomInteriorRef,
	LayoutRoomInteriorResolution,
	OverheadScope,
	OverheadSource,
	OverheadSourceKey,
	QueryGeometryBuilder,
	QueryProjection,
	ResolvedInteriorWallSide,
} from '../layout-geometry-queries';

export {
	beginLayoutCompile,
	createLayoutCompileReuse,
	finishLayoutCompile,
	noQueryRecords,
	pruneLayoutCompileReuse,
	sameAuthored,
} from '../layout-geometry-reuse';

export type {
	LayoutCompileReuse,
	LayoutCompileStats,
	MutableStats,
	PrunableLayoutCollections,
	RetainedCompiledFloor,
	RetainedDocumentAabb,
	RetainedJunction,
	RetainedObject,
	RetainedQueryRecords,
	RetainedRoom,
	RetainedRoomSource,
	RetainedWall,
} from '../layout-geometry-reuse';

export type {
	ArchProfileKind,
	CompiledArchProfile,
	CompiledCornerSide,
	CompiledCurveSample,
	CompiledEndCorner,
	CompiledEndpointBand,
	CompiledFloor,
	CompiledIdentity,
	CompiledJunction,
	CompiledJunctionBand,
	CompiledJunctionInterface,
	CompiledJunctionLeg,
	CompiledJunctionNeighbor,
	CompiledJunctionResolution,
	CompiledJunctionSurface,
	CompiledLayoutGeometry,
	CompiledLayoutGeometryResult,
	CompiledLayoutObject,
	CompiledLayoutQueryGeometry,
	CompiledLegJoin,
	CompiledLegJoinKind,
	CompiledOpening,
	CompiledOpeningCenter,
	CompiledPhysicalWall,
	CompiledQueryAabb,
	CompiledQueryPoint,
	CompiledQueryPolygon,
	CompiledQuerySpan,
	CompiledRegion,
	CompiledRoom,
	CompiledSolidSpan,
	CompiledSpaceEdge,
	CompiledWall,
	CompiledWallSection,
	CompilerBoundarySource,
	CompilerFloorEntry,
	CompilerFloorSource,
	CompilerOpening,
	CompilerRoomShell,
	CompilerRoomSource,
	CompilerSource,
	LayoutBounds2,
	LayoutBounds3,
	LayoutGeometryIssue,
	LayoutObjectKind,
} from '../layout-geometry-types';

export {
	geometryId,
} from '../layout-geometry-types';

export {
	hasBlockingLayoutIssues,
	isFiniteSegment,
	prepareLayoutRoomSegments,
	validatePreparedLayoutRoomGeometry,
} from '../layout-geometry-validation';

export type {
	CompilerRoomValidationSource,
	PreparedLayoutRoomGeometry,
} from '../layout-geometry-validation';

export type {
	DraftPath,
	DraftSegment,
	LayoutInteriorAnchor,
} from '../layout-path';

export {
	orientXZ,
} from '../layout-robust-orientation';
