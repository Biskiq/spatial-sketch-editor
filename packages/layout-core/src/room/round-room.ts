/**
 * `layout-round-room.ts` — canonical Round Room certification, seam lookup, and
 * centre-local template writers.
 *
 * One checker serves both codec admission and planner validation for isolated
 * closed-circle Walls and multi-Wall cubic rings alike. It works in
 * centre-local coordinates with outward-rounded binary64 interval arithmetic
 * derived from each stored world coordinate's adjacent IEEE-754 values. It
 * never fits or infers Round, centre or radius from Wall controls, and never
 * widens bounds in response to a residual.
 */

export {
	roundRoomSeamJunctionId,
	rotateBoundaryToSeam,
	findEnclosingRoundRoomForWall,
	isEnclosedClosedCircleBoundary,
	certifyRoundRoom
} from './round-room/certify';
export type { CertifiedRoundSubspan, CertifiedRoundRoom, RoundCertificationResult } from './round-room/certify';
export { validateRoundRooms, buildRoundRoomGeometryFromCertified } from './round-room/build';
export { ROUND_ROOM_MEMBER_EDIT_MESSAGE, guardRoundRoomMemberGeometryEdit, findRoundRoomSeamOwner } from './round-room/guard';
export type { RoundRoomMemberGuardHit } from './round-room/guard';
export type {
	RoundOperationRoomCorrespondence,
	RoundOperationWallCorrespondence,
	RoundOperationJunctionCorrespondence,
	RoundOperationOpeningCorrespondence,
	RoundOperationCorrespondence
} from './round-room/correspondence';
export { enumerateClosedWallSafeCutStations, partitionClosedWallChainAtStations } from './round-room/partitions';
export type { ClosedWallSafeCutSearch, ClosedWallPartitionSegment } from './round-room/partitions';
