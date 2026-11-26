/**
 * `layout-round-ops.ts` — C2 Round Room planners: Release round and whole-radius resize.
 *
 * Both planners consume C1's `certifyRoundRoom` and `buildRoundRoomGeometryFromCertified`,
 * preserve exact authored IDs / captures, emit S5a `LayoutSurfaceLineage` and V1
 * `carryRegionWallIntents`, and run the full canonical validation + compile gates.
 */

export { planReleaseRoundRoom } from './round-ops/release';
export type {
	ReleaseRoundRoomRejectionCode,
	ReleaseRoundRoomRejection,
	ReleaseRoundRoomPlan,
} from './round-ops/release';
export { planResizeRoundRoomRadius } from './round-ops/resize';
export type {
	RoundRoomRadiusRejectionCode,
	RoundRoomRadiusRejection,
	RoundRoomRadiusPlan,
} from './round-ops/resize';
