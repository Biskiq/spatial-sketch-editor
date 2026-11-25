/**
 * Precision planners: exact, operation-specific edits to one wall-first
 * document. Each planner builds a complete candidate and returns one plan for
 * the transaction runner; no planner keeps state between calls.
 */
export { proposeWallCurveShape, proposeWallFirstArchitectureGeometry, readWallFirstDragProposal, resolveProposedCurveChain } from './architecture-proposals';

export { createWallFirstArchitectureVerdictScope, preflightWallFirstArchitectureCandidate, wallFirstArchitectureAffectedExtent } from './architecture-verdict';

export { planConvertWallToCurve, planConvertWallToLine, planDeleteWallCurveKnot, planInsertWallCurveKnot, planMoveWallCurveKnot } from './curve-edits';

export { planSpaceOpenSideEndSlide, planSpaceOpenSideOffset } from './open-side';

export { LAYOUT_ARCHITECTURAL_PRESETS, layoutArchitecturalPreset, layoutPresetPlacement, planCommitLayoutObjectPreset, planDeleteLayoutObject, planExactLayoutObjectTransform, planExactRectangleDimensions, resolveRectangle } from './rectangle-objects';

export { planAddWallVertex, planExactJunctionMove, planExactWallAngle, planExactWallHeight, planExactWallLength, planExactWallThickness, planRigidWallMove, planWallSubdivision } from './scalar-edits';

export { MAX_WALL_CURVE_KNOTS } from './types';

export { planBendWallCurveKnot, prepareWallBend, proposeWallKnotRemoval } from './wall-bends';

export type { FixedWallEndpoint, LayoutArchitecturalPreset, LayoutArchitecturalPresetId, LayoutObjectTransformPatch, PrecisionOperation, PrecisionPlan, PrecisionRejection, RectangleResizeOptions, RectangleResolution, ResolvedRectangle, SpaceOpenSideSlidePlan, WallAngleIntent, WallBendIntent, WallCurveProposeIntent, WallFirstAcceptanceCompile, WallFirstArchitectureAffectedExtent, WallFirstArchitectureCandidatePair, WallFirstArchitecturePreflightFailure, WallFirstArchitectureProposalIntent, WallFirstArchitectureProposalWall, WallFirstArchitectureVerdictScope, WallFirstArchitectureVerdictScopeStats, WallLengthIntent, WallMoveIntent } from './types';
