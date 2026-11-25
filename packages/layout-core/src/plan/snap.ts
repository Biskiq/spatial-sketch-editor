/**
 * `layout-snap.ts` — centralized, deterministic Plan snapping resolver.
 *
 * Snap truth derives from the canonical compiled query geometry
 * (`CompiledLayoutGeometry.queries`) plus transient gesture context — Plan/SVG
 * code never reconstructs authored geometry for snapping. There are no
 * persistent snap points in the `LayoutDocument`, no persistent constraints,
 * and a snap result never mutates anything by itself.
 *
 * Deterministic winner order:
 *
 * ```text
 * tool/context validity
 * → semantic feature priority
 * → screen distance
 * → stable ID/key
 * ```
 *
 * Source-array/render order is never a hidden tie-break: equal-priority,
 * equal-distance candidates resolve by comparing stable identity keys.
 *
 * Pointer acquisition tolerance is not geometry/topology tolerance — the
 * acquisition radius is a fixed CSS-pixel value converted by the current Plan
 * scale, so acquisition stays zoom-stable (50%/100%/200% acquire the same
 * world features at the same screen distances).
 */

export { LAYOUT_PLAN_GRID_STEP, LAYOUT_PLAN_SNAP_RADIUS_CSS_PX, snapOwnerKey, wallOwnerKey } from './snap/types';
export type {
	SnapFeatureKind,
	SnapOwnerKind,
	SnapOwner,
	SnapCandidate,
	SnapInputContext,
	SnapQueryContext,
	SnapResolution,
	SnapGuide
} from './snap/types';
export {
	snapAcquisitionRadiusWorld,
	snapToGridStep,
	pickSnapWinner,
	spanSnapCandidates,
	openingEdgeSnapCandidates,
	objectBoundsSnapCandidates,
	orthogonalGuideCandidates,
	wallIntersectionSnapCandidates
} from './snap/features';
export { wallSnapIndex, resolveLayoutSnap } from './snap/resolve';
export type { DerivedWallSnapIndex, P23B1SnapInputEntry } from './snap/resolve';
export {
	resolveOpeningDragSnap,
	resolveOpeningDragEdgeSnap,
	resolveOpeningDragSnapUseMode,
	resolveOpeningDragRawValidity
} from './snap/opening-drag';
export type { OpeningDragSnapCandidate, OpeningDragSnapResolution, OpeningDragAnchor, OpeningDragRawResolution } from './snap/opening-drag';
export { dedupeWallSpans, objectFootprintCenter } from './snap/walls';
export type { MergedWallSpan } from './snap/walls';
