/**
 * The Layout-owned support queries.
 *
 * Two directions, one contract:
 *
 * - **Upward** (`queryFloorSupports`) answers which `room-floor` and
 *  `region-top` faces support a world X/Z point. Every containing face is a
 *  witness; coincident equivalent supports merge into one candidate that keeps
 *  **all** witnesses; a genuine elevation ambiguity is `choice-required` rather
 *  than an array-order pick.
 * - **Downward** (`queryOverheadSupports`) mirrors the same validation,
 *  tolerances and witness merging for closed-Space lids and overhead-region
 *  undersides, ordered by increasing elevation.
 *
 * Facts come from compiled records only: elevation is the compiled Room's
 * `floorElevation`, the compiled region's `topY`/`bottomY`, or the compiled lid's
 * `ceilingElevation`, cross-checked against the compiled query record and Floor
 * datum where the contract says so. A rendered mesh face, a centroid, a nearest
 * heuristic and a bare datum are never support authorities. The input is read,
 * never mutated.
 */

export {
	FLOOR_SUPPORT_TOLERANCES,
	FLOOR_SUPPORT_UP_NORMAL,
	OVERHEAD_SUPPORT_DOWN_NORMAL,
	floorSupportSnapshotOf,
	DATUM_SUPPORT_ORDER_KEY,
} from './floor-support/contracts';
export type {
	FloorSupportTolerances,
	FloorSupportQueryPolygon,
	FloorSupportRegionFacts,
	FloorSupportSnapshot,
	FloorSupportScope,
	FloorSupportQueryInput,
	FloorSupportWitnessSource,
	FloorSupportWitness,
	FloorSupportCandidate,
	FloorSupportQueryResult,
} from './floor-support/contracts';
export {
	layoutDatumElevation,
	datumSupportCandidate,
	polygonContainsWithTolerance,
	queryFloorSupports,
} from './floor-support/floor';
export { overheadSupportSnapshotOf, queryOverheadSupports } from './floor-support/overhead';
export type {
	OverheadSupportQueryPolygon,
	OverheadSupportSnapshot,
	OverheadSupportQueryInput,
	OverheadSupportWitness,
	OverheadSupportCandidate,
	OverheadSupportQueryResult,
} from './floor-support/overhead';
export { chooseFloorSupport } from './floor-support/choice';
export type { FloorSupportChoice, FloorSupportChoiceResult } from './floor-support/choice';
