/**
 * `layout-junction-resolution.ts` — Junction-local resolution.
 *
 * The durable model is a pure, renderer-neutral **network-aware** solve:
 *
 * ```text
 * CompiledJunction + incident compiled Wall endpoint facts
 *         ↓
 * CompiledJunctionResolution
 *         ↓
 * resolved Wall-end geometry for every incident Wall
 * ```
 *
 * A Junction resolver inspects every canonical incident leg together before any
 * Wall endpoint geometry is determined. Per-Wall meshes may stay the packaging
 * unit, but per-Wall geometry solving does not happen here or in the renderer.
 *
 * Three conventions make this unambiguous:
 *
 * 1. **Outward frames.** Every leg's `tangentOut`/`normalOut` point from the
 *    Junction into the Wall, so canonical Wall orientation never leaks into the
 *    classification.
 * 2. **Continuity is a centerline relationship.** Degree-2 with outward rays
 *    ≈180° is a straight continuation (suppress the common interface); a real
 *    tangent break is a bend; outward rays ≈0° is a fold (invalid).
 * 3. **Ownership is branch-cut-independent.** Angular order is used for cyclic
 *    adjacency, never for physical ownership.
 *
 * No renderer, no Three.js, no editor/museum state, no second curve abstraction:
 * leg facts come from the incident `CompiledPhysicalWall` samples the curve
 * evaluator already produced.
 */

export {
	JUNCTION_DET_EPSILON,
	JUNCTION_MITER_LIMIT,
	JUNCTION_BAND_EPSILON,
	JUNCTION_SURFACE_PROBE,
	JUNCTION_SECTOR_SNAP,
	JUNCTION_PROBE_TOLERANCE,
	negateVec2,
	outwardTangent,
	resolveSharedCornerSide,
	resolveLegPairCorner,
	isTangentContinuation,
	tangentAnchorsAllowContinuation,
	isFoldPair,
	legEndBoundary,
	joinsBounds2
} from './junction/geometry';
export type { CornerSideResolution } from './junction/geometry';
export {
	endpointSolidBands,
	resolveJunctionGeometry,
	compiledJunctionId,
	legJoinsByWall
} from './junction/joins';
export type { CompiledWallEnds } from './junction/joins';
export { legSolidInBand } from './junction/surfaces';
