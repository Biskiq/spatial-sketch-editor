export { MIN_WALL_ARC_RISE, measureWallArc, wallChainArcCenterline } from './chain-arcs';
export type { WallArcMeasures, WallChainArc } from './chain-arcs';
export { executeWallChainCandidate } from './chain-execute';
export type { ClosedToRingSpec } from './chain-execute';
export {
	adoptableJunctionAt,
	duplicateJunctionsAt,
	nodingAllocatorAdapter,
	teeThroughJunction,
	validateEndpointHostSnaps,
	wallById,
} from './chain-noding';
export { cloneWallFirstDocument, planWallChain } from './chain-plan';
export { detectUnsupportedChainConnections } from './chain-policy';
export type {
	WallChainPolicyInput,
	WallChainPolicyRejection,
	WallChainPolicyRejectionCode,
} from './chain-policy';
export { nextNodingFix, validateChainTopology } from './chain-repair';
export type { NodingFix } from './chain-repair';
export { planWallSegment } from './chain-segment';
export { WALL_CHAIN_DEFAULTS, createCapturedWallChainAllocator } from './chain-types';
export type {
	WallChainIdAllocator,
	WallChainPlan,
	WallChainPlanOptions,
	WallChainRejection,
	WallChainRejectionCode,
	WallEndpointHostSnap,
	WallEndpointJunctionSnap,
} from './chain-types';
export { absorbPartialVirtualEdgeWalls } from './chain-virtual-edges';
