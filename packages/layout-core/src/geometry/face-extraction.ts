/**
 * `layout-face-extraction.ts` — boundary-Wall candidate-face
 * extraction.
 *
 * Runs over **every Wall** (format 6): there is no authored `role`, so a ring
 * encloses because of its topology, not because a field permits it. Emits
 * deterministic **candidate faces**
 * only — this module never allocates, retires or otherwise owns persistent
 * `LayoutRoom` identity (hard H3/H5 boundary). Room correspondence happens
 * in `layout-room-reconciliation.ts` on top of these candidates.
 *
 * Pipeline:
 *
 * ```text
 * validated boundary wall graph
 * → exclude dangles from the face working graph (diagnose, never delete)
 * → directed half-edges
 * → robust outgoing-edge ordering (quadrant + orientXZ, never atan2 alone)
 * → oriented ring traversal (face kept on the left of each traversed edge)
 * → bounded faces kept (positive area), unbounded outer walk discarded
 * → cut-edge / invalid-ring / nested-loop diagnostics
 * ```
 *
 * Face keys are deterministic temporary keys derived from the oriented
 * boundary cycle (rotation-normalized `wallId:direction` tokens through the
 * collision-safe `geometryId` helper). They are NOT room IDs and are never
 * persisted as product identity.
 */

export { ON_RING_TOLERANCE } from './face-extraction/contracts';
export type {
	TopologyDiagnostic,
	DerivedCandidateFace,
	FaceExtractionResult,
} from './face-extraction/contracts';
export { extractBoundaryCandidateFaces } from './face-extraction/extract';
export { canonicalBoundaryCycleKey } from './face-extraction/identity';
export {
	faceArea,
	polygonIntersectionArea,
	polygonsShareInteriorArea,
	pointStrictlyInsidePolygon,
} from './face-extraction/polygons';
