import type { LayoutDocumentIssue } from '../plan/issue';
import type { LayoutGeometryIssue } from '../geometry/types';
import type { ReconciliationFailure, ReconciliationResult } from '../room/reconciliation-types';
import type { RoundRoomMemberGuardHit } from '../room/round-room';
import type { LayoutVec2 } from '../geometry/coordinates';
import type { FixedWallEndpoint, PrecisionPlan, PrecisionRejection } from './types';
import { POINT_EPSILON } from '../vec2';

export function reject(
	code: PrecisionRejection['code'],
	message: string,
	targetIds?: readonly string[],
	issues?: readonly (LayoutDocumentIssue | LayoutGeometryIssue)[],
): PrecisionPlan {
	return { kind: 'rejected', rejection: makeRejection(code, message, targetIds, issues) };
}

export function makeRejection(
	code: PrecisionRejection['code'],
	message: string,
	targetIds?: readonly string[],
	issues?: readonly (LayoutDocumentIssue | LayoutGeometryIssue)[],
): PrecisionRejection {
	return { code, message, ...(targetIds ? { targetIds } : {}), ...(issues ? { issues } : {}) };
}

export function rejectRoundMember(hit: RoundRoomMemberGuardHit): PrecisionPlan {
	return reject('round_room_member_locked', hit.message, [
		hit.roomId,
		...hit.wallIds,
		...hit.junctionIds,
	]);
}

export function finitePositive(value: number | undefined): value is number {
	return typeof value === 'number' && Number.isFinite(value) && value > POINT_EPSILON;
}

export function finitePoint(point: readonly number[]): point is LayoutVec2 {
	return point.length === 2 && point.every((value) => Number.isFinite(value));
}

export function finiteVector(vector: readonly number[]): boolean {
	return vector.length === 3 && vector.every((value) => Number.isFinite(value));
}

export function validFixedEndpoint(value: unknown): value is FixedWallEndpoint {
	return value === 'start' || value === 'end';
}

/**
 * Result narrowing: `RoomReconciliation` carries no `kind` discriminant,
 * so a type predicate is what lets the success branch expose `document`.
 */
export function isReconciliationFailure(
	result: ReconciliationResult,
): result is ReconciliationFailure {
	return 'kind' in result && result.kind === 'rejected';
}
