/**
 * `layout-wall-topology-ops.ts` — canonical wall-first
 * authoring planners over the topology/reconciliation engine.
 *
 * Scope: the canonical writers
 * are **planners** — explicit-intent → candidate-graph →
 * extract → reconcile → validate → commit-once — implemented as pure
 * functions over the existing engine pieces rather than a new system:
 *
 * - `reconcileRooms` owns persistent Room correspondence;
 * - `extractBoundaryCandidateFaces` derives candidate faces;
 * - `validateWallFirstLayoutDocument` is the final canonical gate;
 * - `compileWallFirstLayoutGeometry` proves the document compiles.
 *
 * Planners allocate during the authoring operation only; compilation and
 * rendering never create Rooms. Every
 * rejection names a stable machine code; invalid intent → no document, the
 * caller leaves history untouched. Undo/Redo keeps restoring exact
 * snapshots — allocation never reruns.
 *
 * **Writer-enable boundary.** These planners are called from the canonical
 * writers and the editor's wall-first transaction path after the F0 gate;
 * The precision operations use the same candidate/validation discipline.
 */

export type {
	WallFirstOpRejectionCode,
	WallFirstOpRejection,
	WallFirstOpPlan,
} from './topology/contracts';
export {
	createAuthoringRoomAllocator,
	validateAndCompile,
	planFirstEnclosureCreation,
} from './topology/birth';
export { planDeleteWall, planDeleteWalls } from './topology/removal';
export {
	planRoomMetadataUpdate,
	planWallMetadataUpdate,
	planOpeningMetadataUpdate,
} from './topology/metadata';
export type { RoomMetadataPatch, OptionalNamePatch } from './topology/metadata';
export {
	roomExclusiveBoundaryWallIds,
	planRemoveRoom,
	planRemoveSpace,
	closedChainWalls,
} from './topology/rooms';
export type { LayoutWallFirstRoom } from './types';
