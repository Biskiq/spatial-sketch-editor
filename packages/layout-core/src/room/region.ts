/**
 * `layout-region.ts` — region admission lineage and the region planner family.
 *
 * The planners in this file implement §5.3 and the one-shot fits of §5.5. Each
 * returns exactly one validated candidate document or one typed refusal; none
 * touches Room reconciliation, Scene, Camera or Experience. Geometry-neutral
 * edits keep every region id, document order and flag.
 *
 * Admission is shared with the canonical reader: `layout-region-validation.ts`
 * owns G1/G5 and the codec imports it directly, so Save and these planners cannot
 * disagree about a footprint. Planner-only gates (Opening fit, compiled
 * acceptance) sit on top of that shared predicate.
 */

export { MAX_LAYOUT_REGION_POINTS, LAYOUT_SLICE_CONTACT_METERS, regionVerticalBand, regionFootprintBounds, regionGeometryIssues, carryRegionWallIntents } from './region-validation';
export type { RegionPlannerOperation, RegionPlannerRejectionCode, RegionPlannerRejection, RegionPlan, RegionCreateIntent } from './region/contracts';
export {
	planCreateRegion,
	planMoveRegion,
	planRotateRegion,
	planSetRegionFootprint,
	planSetRegionElevation,
	planSetRegionThickness,
	planSetRegionIntendedGap,
	planRenameRegion,
	planRemoveRegion,
	planDuplicateRegion
} from './region/edits';
export {
	planFitRegionToSpace,
	planFitRegionEdgeToWall,
	planFitRegionToWalls,
	planFitWallsToRegion
} from './region/fit';
