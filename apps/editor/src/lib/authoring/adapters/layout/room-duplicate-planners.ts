/**
 * T1 A4 — one Duplicate intent over the retained `planDuplicateIsolatedRoom`.
 *
 * | Operation | Kind | Canonical planner |
 * | --- | --- | --- |
 * | Duplicate one isolated Room | `layout-room-duplicate` | `planDuplicateIsolatedRoom` |
 *
 * The planner is the same deterministic clone/remap planner the P23.4 cutover
 * retained. It receives the complete translation the pointer proposal last
 * showed, captures every new identity before evaluation, and returns one
 * complete candidate document. Nothing here mutates the baseline, invents a
 * second clone path, or joins the copy to its source.
 *
 * **Lineage, every cloned element.** No source id survives. Each created id is
 * derived from the exact source id and the one captured nonce, so Undo/Redo
 * replay the same identities and Save/Load persists them as ordinary ids:
 *
 * ```text
 * source Junction <j>  → <j>-copy.<nonce>   same point + delta
 * source Wall     <w>  → <w>-copy.<nonce>   same thickness/height/name,
 *                                            centerline + delta, remapped ends
 * source Opening  <o>  → <o>-copy.<nonce>   same kind/name/offset/width/height/
 *                                            sill/profile, host remapped
 * source Room     <r>  → <r>-copy.<nonce>   name "<name> copy" (or the next
 *                                            free suffix), remapped boundary,
 *                                            same thicknesses
 * associated object <x> → <x>-copy.<nonce>  same shape, + delta, room remapped
 * ```
 *
 * The one placement rule this seam adds is A4's own: a copy may not be
 * committed **coincident with its source**. Zero translation is refused before
 * the canonical planner runs, so no history entry can ever record it. A
 * non-coincident overlap remains ordinary independent placement, exactly as the
 * Layout contract states; A5 owns the general copy and its overlap cue.
 */
import {
	layoutIdCaptureInput,
	layoutWorkingLevelInput,
	materializeLayoutSourceForCapture,
	planDuplicateIsolatedRoom,
	readLayoutIdCapture,
	readLayoutWorkingLevel,
	recordPreparedCowCandidate,
	type LayoutIdCapture,
	type LayoutVec2
} from '@portfolio/layout-core';
import type {
	AuthoringIntent,
	DomainPlanner,
	PlannerOutcome,
	PreparedCandidate
} from '@portfolio/project-model';
import {
	canonicalUnitJson,
	replaceUnitData,
	UNIT_SOURCE_KIND,
	UNIT_SOURCE_VERSION,
	type ProjectEnvelope
} from '@portfolio/project-model/units';

import { layoutSubjectReference } from './drawing-planners';
import { layoutPlanner } from './precision';
import { ROOM_DUPLICATE_COINCIDENT_MESSAGE, roomDuplicateRefusalWords } from './refusals';

export const LAYOUT_ROOM_DUPLICATE_KIND = 'layout-room-duplicate';

/**
 * Is this translation identical to the source placement?
 *
 * The value is the committed delta, not a displayed rounding: pointer arithmetic
 * is cleaned to 1e-9 in the adapter, and this epsilon only absorbs that clean
 * arithmetic's own float residue. Anything a creator can see as distinct is not
 * coincident.
 */
export function roomDuplicateIsCoincident(delta: LayoutVec2): boolean {
	return Math.abs(delta[0]) < 1e-6 && Math.abs(delta[1]) < 1e-6;
}

/** One Room, translated in the level's authored X/Z plane. */
export type RoomDuplicatePayload = {
	readonly roomId: string;
	readonly deltaX: number;
	readonly deltaZ: number;
};

function refused(message: string, code = 'invalid-value'): PlannerOutcome<ProjectEnvelope> {
	return { kind: 'rejected', code, message, diagnostics: [] };
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function finiteNumber(value: unknown): value is number {
	return typeof value === 'number' && Number.isFinite(value);
}

function readDuplicatePayload(payload: unknown): RoomDuplicatePayload | { readonly message: string } {
	if (!isRecord(payload)) return { message: 'The Room duplicate payload must be an object.' };
	const expected = ['roomId', 'deltaX', 'deltaZ'];
	const unknown = Object.keys(payload).filter((key) => !expected.includes(key));
	if (unknown.length > 0) {
		return { message: `The Room duplicate payload cannot carry ${unknown.join(', ')}.` };
	}
	for (const key of expected) {
		if (!(key in payload)) return { message: `The Room duplicate payload is missing "${key}".` };
	}
	const { roomId, deltaX, deltaZ } = payload;
	if (typeof roomId !== 'string' || roomId.length === 0) {
		return { message: 'A Room duplicate needs one room id.' };
	}
	if (!finiteNumber(deltaX) || !finiteNumber(deltaZ)) {
		return { message: 'A Room duplicate needs finite X and Z deltas in meters.' };
	}
	return { roomId, deltaX, deltaZ };
}

/** The F.4 intent for one Room duplicate, with its captured identity and level. */
export function roomDuplicateIntent(input: {
	readonly roomId: string;
	readonly delta: LayoutVec2;
	readonly capture: LayoutIdCapture;
	readonly operationId: string;
	readonly projectId: string;
	readonly revisionId: string;
	readonly contentRevision: string;
	readonly levelId: string;
}): AuthoringIntent {
	return {
		version: 1,
		kind: LAYOUT_ROOM_DUPLICATE_KIND,
		operationId: input.operationId,
		expectedRevision: { projectId: input.projectId, revisionId: input.revisionId },
		targets: [
			layoutSubjectReference({
				kind: 'room',
				id: input.roomId,
				contentRevision: input.contentRevision,
				levelId: input.levelId
			})
		],
		payload: {
			roomId: input.roomId,
			deltaX: input.delta[0],
			deltaZ: input.delta[1]
		},
		capturedInputs: [layoutWorkingLevelInput(input.levelId), layoutIdCaptureInput(input.capture)],
		allocatedIds: []
	};
}

function roomDuplicatePlanner(): DomainPlanner<ProjectEnvelope> {
	return layoutPlanner(LAYOUT_ROOM_DUPLICATE_KIND, (request) => {
		const payload = readDuplicatePayload(request.intent.payload);
		if ('message' in payload) return refused(payload.message);
		const { roomId, deltaX, deltaZ } = payload;
		const capture = readLayoutIdCapture(request.capturedInputs);
		if (capture === null) {
			return refused('The operation must capture its Layout identity before evaluation.');
		}
		const levelId = readLayoutWorkingLevel(request.capturedInputs);
		if (levelId === null) {
			return refused('The intent must capture its working Layout level before evaluation.');
		}
		const baseline = request.snapshot.domain.source.units.layout.data;
		if (levelId !== baseline.floor.id) {
			return refused(`The captured working level '${levelId}' is not the accepted Layout floor.`);
		}
		if (request.intent.targets.length !== 1) {
			return refused('A Room duplicate addresses exactly one Room.');
		}
		const target = request.intent.targets[0]!;
		if (target.domain !== 'layout' || target.subject.kind !== 'room' || target.subject.id !== roomId) {
			return refused(`The intent must address the Room "${roomId}" it duplicates.`);
		}
		if (roomDuplicateIsCoincident([deltaX, deltaZ])) {
			return refused(ROOM_DUPLICATE_COINCIDENT_MESSAGE, 'coincident_with_source');
		}

		const plan = planDuplicateIsolatedRoom(
			baseline,
			{ roomId, delta: [deltaX, deltaZ] },
			capture,
			levelId
		);
		if (plan.kind === 'rejected') {
			return {
				kind: 'rejected',
				code: plan.rejection.code,
				message: roomDuplicateRefusalWords(baseline, plan.rejection),
				diagnostics: []
			};
		}
		const createdRoomId = plan.createdRoomId;
		if (createdRoomId === undefined) {
			return refused('The Room duplicate produced no Room.');
		}
		const contentRevision = request.snapshot.domain.source.units.layout.header.contentRevision;
		recordPreparedCowCandidate(request.intent.operationId, plan.document, canonicalUnitJson(request.intent));
		materializeLayoutSourceForCapture(plan.document);
		const candidate: PreparedCandidate<ProjectEnvelope> = {
			operationId: request.intent.operationId,
			sourceKind: UNIT_SOURCE_KIND,
			sourceVersion: UNIT_SOURCE_VERSION,
			source: replaceUnitData(request.snapshot.domain.source, 'layout', plan.document),
			changes: [
				{
					kind: LAYOUT_ROOM_DUPLICATE_KIND,
					subjectIds: [
						...plan.createdJunctionIds,
						...plan.createdWallIds,
						...plan.createdOpeningIds,
						createdRoomId,
						...plan.createdObjectIds
					],
					fields: ['walls', 'junctions', 'openings', 'rooms', 'objects']
				}
			],
			correspondence: [
				...plan.createdJunctionIds.map((id) => ({
					relation: 'created' as const,
					before: null,
					after: layoutSubjectReference({ kind: 'junction', id, contentRevision, levelId })
				})),
				...plan.createdWallIds.map((id) => ({
					relation: 'created' as const,
					before: null,
					after: layoutSubjectReference({ kind: 'wall', id, contentRevision, levelId })
				})),
				...plan.createdOpeningIds.map((id) => ({
					relation: 'created' as const,
					before: null,
					after: layoutSubjectReference({ kind: 'opening', id, contentRevision, levelId })
				})),
				{
					relation: 'created' as const,
					before: null,
					after: layoutSubjectReference({ kind: 'room', id: createdRoomId, contentRevision, levelId })
				},
				...plan.createdObjectIds.map((id) => ({
					relation: 'created' as const,
					before: null,
					after: layoutSubjectReference({ kind: 'object', id, contentRevision, levelId })
				}))
			],
			diagnostics: []
		};
		return { kind: 'prepared', candidate };
	});
}

export function createRoomDuplicatePlanners(): readonly DomainPlanner<ProjectEnvelope>[] {
	return [roomDuplicatePlanner()];
}
