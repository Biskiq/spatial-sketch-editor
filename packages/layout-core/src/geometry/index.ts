export type { LayoutVec2 } from './coordinates';

export { canonicalBoundaryCycleKey, extractBoundaryCandidateFaces, faceArea, ON_RING_TOLERANCE, pointStrictlyInsidePolygon, polygonIntersectionArea, polygonsShareInteriorArea } from './face-extraction';

export type { DerivedCandidateFace, FaceExtractionResult, TopologyDiagnostic } from './face-extraction';

export { activeLayoutCompileSession, createLayoutCompileSession, withLayoutCompileSession } from './session'
export { compileLayoutGeometrySource, compileWallFirstLayoutGeometry, compileWallFirstLayoutGeometryFresh } from './compiler';

export type { LayoutCompileSession, LayoutGeometryCompileOptions } from './session';

export { autoBezierAnchorPoints, compileAutoBezierAnchors, cubicBezierArcLength, cubicBezierArcLengthAt, cubicBezierArcLengthBetween, cubicBezierDerivative, cubicBezierPoint, CURVE_ARC_LENGTH_MAX_DEPTH, CURVE_ARC_LENGTH_TOLERANCE, CURVE_ENDPOINT_EPSILON, CURVE_FLATNESS_TOLERANCE, CURVE_MAX_SAMPLE_SPAN, CURVE_SELF_INTERSECTION_TOLERANCE, deriveChainSpans, deriveCubicSpanControls, LAYOUT_AUTO_BEZIER_ALPHA, LayoutGeometrySamplingError, legacyBezierToAutoBezier, MAX_CURVE_SAMPLES_PER_SEGMENT, nextInteriorAnchorId, OPENING_CENTER_EPSILON, openingCenterFrame, openingCenterPolyline, pointAlongSamples, pointAtDistance, projectPointToSampledSegment, sampledIsClosed, sampledPolylineIntersects, sampledPolylineSelfIntersects, samplePolylineInRange, sampleSegment, segmentLength, segmentPointAt, segmentTangentAt, segmentVertexPoints, spansToCubics } from './curve';

export type { AutoBezierSegment, CubicBezierShape, CubicChainSegment, CubicSpanControls, CurveDistanceResult, CurvedSampleableSegment, CurveSample, LegacyBezierSegment, OpeningCenterMode, OpeningHostSamples, SampleableSegment, SampledSegment } from './curve';

export { diffCompiledWalls, indexedCompiledWall, indexedCompiledWallQueries, readPassiveCompiledGeometry, recordPassiveCompiledGeometry, sealCompiledLayoutSnapshot } from './delta';

export { exceedsLayoutDimension, LAYOUT_DIMENSION_LIMIT_MESSAGE, layoutDimensionIssueMessage, layoutDimensionLimitIssues, layoutWallSpanMeters, MAX_LAYOUT_DIMENSION_METERS } from './limits';

export { convexHull, describeLayoutObject, findHitLayoutObject, pointInPolygon, rotateXyz, sphereRenderScale, transformedObjectSamples, transformObjectPoint } from './objects';

export type { LayoutObjectAabb, LayoutObjectDescriptor } from './objects';

export { ARCH_PROFILE_EPSILON, archProfileTopAt, buildArchProfile, LAYOUT_GEOMETRY_EPSILON, lineLength, offsetInsideOpeningIntervals, openingIntervals, samplesInDistanceRange, splitSampledWallAroundOpenings, splitWallAroundOpenings, wallPolylinesAroundOpenings } from './openings';

export type { ArchProfile, ArchProfileIssue, ArchProfileResult, WallOpeningInterval } from './openings';

export { bounds2, compiledQueryGeometry, createQueryGeometryBuilder, findPolygonContaining, overheadSourcesOf, polygonBounds2, projectPointToSpans, regionsOverSpace, resolveLayoutRoomInterior, spaceAtPoint } from './queries';

export type { LayoutRoomInteriorRef, LayoutRoomInteriorResolution, OverheadScope, OverheadSource, OverheadSourceKey, QueryGeometryBuilder, QueryProjection, ResolvedInteriorWallSide } from './queries';

export { beginLayoutCompile, createLayoutCompileReuse, finishLayoutCompile, noQueryRecords, pruneLayoutCompileReuse, sameAuthored } from './reuse';

export type { LayoutCompileReuse, LayoutCompileStats, MutableStats, PrunableLayoutCollections, RetainedCompiledFloor, RetainedDocumentAabb, RetainedJunction, RetainedObject, RetainedQueryRecords, RetainedRoom, RetainedRoomSource, RetainedWall } from './reuse';

export type { ArchProfileKind, CompiledArchProfile, CompiledCornerSide, CompiledCurveSample, CompiledEndCorner, CompiledEndpointBand, CompiledFloor, CompiledIdentity, CompiledJunction, CompiledJunctionBand, CompiledJunctionInterface, CompiledJunctionLeg, CompiledJunctionNeighbor, CompiledJunctionResolution, CompiledJunctionSurface, CompiledLayoutGeometry, CompiledLayoutGeometryResult, CompiledLayoutObject, CompiledLayoutQueryGeometry, CompiledLegJoin, CompiledLegJoinKind, CompiledOpening, CompiledOpeningCenter, CompiledPhysicalWall, CompiledQueryAabb, CompiledQueryPoint, CompiledQueryPolygon, CompiledQuerySpan, CompiledRegion, CompiledRoom, CompiledSolidSpan, CompiledSpaceEdge, CompiledWall, CompiledWallSection, CompilerBoundarySource, CompilerFloorEntry, CompilerFloorSource, CompilerOpening, CompilerRoomShell, CompilerRoomSource, CompilerSource, LayoutBounds2, LayoutBounds3, LayoutGeometryIssue, LayoutObjectKind } from './types';

export { geometryId } from './types';

export { hasBlockingLayoutIssues, isFiniteSegment, prepareLayoutRoomSegments, validatePreparedLayoutRoomGeometry } from './validation';

export type { CompilerRoomValidationSource, PreparedLayoutRoomGeometry } from './validation';

export type { DraftPath, DraftSegment, LayoutInteriorAnchor } from './path';

export { orientXZ } from './robust-orientation';
