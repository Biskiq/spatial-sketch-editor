import type { LayoutDocumentIssue } from '../../plan/issue';
import type { LayoutGeometryIssue } from '../../geometry/types';
import type { OpeningSetIssue } from '../../wall/opening-set';
import { spaceBoundaryCycleKey } from '../reconciliation-boundary';
import type { ReconciliationFailure, ReconciliationResult, RoomIdAllocator } from '../reconciliation-types';
import { wallCenterlineSamples } from '../../wall/centerline';
import type { LayoutDocumentWallFirst, LayoutWallFirstRoom } from '../../wall/types';
import type { LayoutVec2 } from '../../geometry/coordinates';
import type { RoomUnitMoveProposalWall } from './candidate';
import type { RoomMovePlan, RoomMoveRejectionCode } from './contracts';

/** Result narrowing: `RoomReconciliation` carries no `kind` discriminant. */
export function isReconciliationFailure(
	result: ReconciliationResult
): result is ReconciliationFailure {
	return 'kind' in result && result.kind === 'rejected';
}


export function reject(
	code: RoomMoveRejectionCode,
	message: string,
	targetIds?: readonly string[],
	issues?: readonly (LayoutDocumentIssue | LayoutGeometryIssue | OpeningSetIssue)[]
): RoomMovePlan {
	return {
		kind: 'rejected',
		rejection: { code, message, ...(targetIds ? { targetIds } : {}), ...(issues ? { issues } : {}) }
	};
}


/**
 * Boundary-cycle key of a persisted Room. Enclosed Rooms keep the shipped
 * direction-only key; open Spaces append their virtual-edge tokens so identity
 * stays exact through a rigid move (SP-plan §6).
 */
export function roomBoundaryCycleKey(
	document: Pick<LayoutDocumentWallFirst, 'junctions' | 'walls'>,
	room: Pick<LayoutWallFirstRoom, 'id' | 'boundary' | 'virtualEdges'>
): string {
	// The shared key is identical to `canonicalBoundaryCycleKey` for an enclosed
	// Room and appends virtual-edge tokens for an open one.
	return spaceBoundaryCycleKey(document, room) ?? `unresolved:${room.id}`;
}


/**
 * An allocator that must never be reached: a rigid move preserves global Room
 * identity, so a reconciliation branch that allocates a Room ID/name is proof
 * that the operation is not a move. It records the attempt instead of throwing
 * so the planner can reject through its ordinary result contract.
 */
export function guardedAllocator(attempted: { value: boolean }): RoomIdAllocator {
	return {
		nextRoomId(_document, faceKey) {
			attempted.value = true;
			return `unreachable-room-move.${faceKey}`;
		},
		nextRoomName() {
			attempted.value = true;
			return 'Unreachable Room Move';
		}
	};
}


/**
 * Rigid rotation of one point about `pivot`, in DOCUMENT X/Z.
 *
 * THE HANDEDNESS IS THE SHIPPED ONE. Plan X/Z has +Z DOWN the screen, and the
 * gesture's `yaw` is `atan2(dz, dx)` of the pointer about the pivot — the same
 * angle the legacy Room transform receives. This uses that transform's own
 * convention (`layout-room-transform.ts`'s `transformRoom`) rather than the
 * mathematical inverse, so ONE rotation gesture turns a Room the same way in
 * both document kinds. Flipping it here would silently make the new wall-first
 * rotation feel mirrored against the legacy one it sits beside.
 *
 * Exported (not module-private) so the transient overlay draws its outlines
 * through this same function: one handedness decision, one definition.
 */
export function rotatePointAbout(point: LayoutVec2, pivot: LayoutVec2, yaw: number): LayoutVec2 {
	const cos = Math.cos(yaw);
	const sin = Math.sin(yaw);
	const x = point[0] - pivot[0];
	const z = point[1] - pivot[1];
	return [pivot[0] + x * cos + z * sin, pivot[1] - x * sin + z * cos];
}


/**
 * Rigid-motion copy of one canonical centerline: every bend point and every span
 * control moves through `transform`. The rotation partner of
 * `translateWallCenterline`; flat `line` centerlines carry no absolute data.
 */
export function transformWallCenterline(
	centerline: LayoutDocumentWallFirst['walls'][number]['centerline'],
	transform: (point: LayoutVec2) => LayoutVec2
): LayoutDocumentWallFirst['walls'][number]['centerline'] {
	if (centerline.kind === 'line') return { kind: 'line' };
	return {
		kind: 'cubic-chain',
		knots: centerline.knots.map((knot) => ({ id: knot.id, point: transform(knot.point) })),
		spans: centerline.spans.map((span) => ({
			handleOut: transform(span.handleOut),
			handleIn: transform(span.handleIn)
		}))
	};
}


/** Sample every moved Wall of a candidate through the one canonical sampler. */
export function sampleMovedWallProposals(
	candidate: LayoutDocumentWallFirst,
	wallIds: readonly string[]
): RoomUnitMoveProposalWall[] {
	const pointById = new Map(candidate.junctions.map((junction) => [junction.id, junction.point]));
	const proposals: RoomUnitMoveProposalWall[] = [];
	for (const wallId of wallIds) {
		const wall = candidate.walls.find((entry) => entry.id === wallId);
		if (!wall) continue;
		const start = pointById.get(wall.startJunctionId);
		const end = pointById.get(wall.endJunctionId);
		if (!start || !end) continue;
		const sampled = wallCenterlineSamples(wall, start, end, 'forward');
		if (!sampled) continue;
		proposals.push({
			wallId,
			points: sampled.samples.map((sample) => [sample.point[0], sample.point[1]] as LayoutVec2)
		});
	}
	return proposals;
}
