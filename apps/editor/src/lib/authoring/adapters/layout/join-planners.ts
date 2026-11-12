/**
 * T1 A2 — one Join intent over the retained `planDissolveJunction` planner.
 *
 * | Operation | Kind | Canonical planner |
 * | --- | --- | --- |
 * | Join two Walls by removing their degree-2 Junction | `layout-wall-join` | `planDissolveJunction` |
 *
 * The planner is the **same** candidate builder the kernel already owns: it
 * checks the pair's compatibility, joins the centerlines (collinear straight or
 * tangent curved), rebases every hosted Opening by exact arc length, keeps the
 * Room boundaries reconciliation-owned, and rides the shared codec/compile gate.
 * Nothing here mutates the baseline, adds a topology rule or stores session state.
 *
 * Identity is stated at the call site so a reviewer can read it without opening
 * the kernel: the Wall that **ends** at the Joint survives (the exact inverse of
 * split, whose start-side fragment kept its id); when both or neither end there,
 * the lexicographically smaller Wall id survives. The survivor keeps its id,
 * thickness, height, name and Opening stations. The other Wall and the Joint
 * retire, and every Opening keeps its id with a rebased station. A curved join
 * mints one interior knot whose id comes from the captured nonce, so Undo/Redo
 * replay the same id.
 */
import {
	layoutIdCaptureInput,
	layoutWorkingLevelInput,
	materializeLayoutSourceForCapture,
	planDissolveJunction,
	readLayoutIdCapture,
	readLayoutWorkingLevel,
	recordPreparedCowCandidate,
	type LayoutIdCapture
} from '@portfolio/layout-core';
import type {
	AuthoringIntent,
	DomainPlanner,
	PlannerOutcome,
	PlannerRequest,
	PreparedCandidate
} from '@portfolio/project-model';
import {
	canonicalUnitJson,
	replaceUnitData,
	UNIT_SOURCE_KIND,
	UNIT_SOURCE_VERSION,
	type ProjectEnvelope
} from '@portfolio/project-model/units';

import { layoutPlanner } from './precision';
import { layoutSubjectReference } from './drawing-planners';
import { wallJoinRefusalWords } from './refusals';

export const LAYOUT_WALL_JOIN_KIND = 'layout-wall-join';

/** One degree-2 Joint, removed by joining its two incident Walls. */
export type WallJoinPayload = {
	readonly junctionId: string;
};

function refused(message: string): PlannerOutcome<ProjectEnvelope> {
	return { kind: 'rejected', code: 'invalid-value', message, diagnostics: [] };
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readJoinPayload(payload: unknown): WallJoinPayload | { readonly message: string } {
	if (!isRecord(payload)) return { message: 'The Wall join payload must be an object.' };
	const expected = ['junctionId'];
	const unknown = Object.keys(payload).filter((key) => !expected.includes(key));
	if (unknown.length > 0) return { message: `The Wall join payload cannot carry ${unknown.join(', ')}.` };
	if (!('junctionId' in payload)) return { message: 'The Wall join payload is missing "junctionId".' };
	const { junctionId } = payload;
	if (typeof junctionId !== 'string' || junctionId.length === 0) {
		return { message: 'A Wall join needs one junction id.' };
	}
	return { junctionId };
}

function wallJoinPlanner(): DomainPlanner<ProjectEnvelope> {
	return layoutPlanner(LAYOUT_WALL_JOIN_KIND, (request) => {
		const payload = readJoinPayload(request.intent.payload);
		if ('message' in payload) return refused(payload.message);
		const { junctionId } = payload;
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
			return refused('A Wall join addresses exactly one joint.');
		}
		const target = request.intent.targets[0]!;
		if (target.domain !== 'layout' || target.subject.kind !== 'junction' || target.subject.id !== junctionId) {
			return refused(`The intent must address the joint "${junctionId}" it removes.`);
		}
		if (!baseline.junctions.some((junction) => junction.id === junctionId)) {
			return refused(`Unknown joint "${junctionId}".`);
		}
		const plan = planDissolveJunction(baseline, junctionId, capture, levelId);
		if (plan.kind === 'rejected') {
			return {
				kind: 'rejected',
				code: plan.rejection.code,
				message: wallJoinRefusalWords(plan.rejection.code, plan.rejection.message),
				diagnostics: []
			};
		}
		const contentRevision = request.snapshot.domain.source.units.layout.header.contentRevision;
		const reference = (id: string, kind: 'wall' | 'junction' | 'opening' | 'room') =>
			layoutSubjectReference({ kind, id, contentRevision, levelId });
		// Openings recorded on the retired Wall now live on the survivor: their
		// id is preserved, only their host and station are rebased.
		const rebasedOpenings = plan.document.openings.filter(
			(opening) =>
				opening.wallId === plan.survivorWallId &&
				baseline.openings.some((before) => before.id === opening.id && before.wallId === plan.retiredWallId)
		);
		const affectedRoomIds = baseline.rooms
			.filter((room) =>
				room.boundary.some(
					(ref) => ref.wallId === plan.survivorWallId || ref.wallId === plan.retiredWallId
				)
			)
			.map((room) => room.id);
		recordPreparedCowCandidate(request.intent.operationId, plan.document, canonicalUnitJson(request.intent));
		materializeLayoutSourceForCapture(plan.document);
		const candidate: PreparedCandidate<ProjectEnvelope> = {
			operationId: request.intent.operationId,
			sourceKind: UNIT_SOURCE_KIND,
			sourceVersion: UNIT_SOURCE_VERSION,
			source: replaceUnitData(request.snapshot.domain.source, 'layout', plan.document),
			changes: [
				{
					kind: LAYOUT_WALL_JOIN_KIND,
					subjectIds: [
						plan.survivorWallId,
						plan.retiredWallId,
						junctionId,
						...rebasedOpenings.map((opening) => opening.id)
					],
					fields: ['walls', 'junctions', 'openings', 'rooms']
				}
			],
			correspondence: [
				// The survivor keeps the Wall identity the pair is now described by.
				{
					relation: 'preserved',
					before: reference(plan.survivorWallId, 'wall'),
					after: reference(plan.survivorWallId, 'wall')
				},
				// The other Wall and the Joint are gone; nothing replaces either id.
				{ relation: 'retired', before: reference(plan.retiredWallId, 'wall'), after: null },
				{ relation: 'retired', before: reference(junctionId, 'junction'), after: null },
				// Openings keep their ids and their world positions; only the host
				// station moved.
				...rebasedOpenings.map((opening) => ({
					relation: 'preserved' as const,
					before: reference(opening.id, 'opening'),
					after: reference(opening.id, 'opening')
				})),
				// Every Room naming either Wall keeps its id.
				...affectedRoomIds.map((roomId) => ({
					relation: 'preserved' as const,
					before: reference(roomId, 'room'),
					after: reference(roomId, 'room')
				}))
			],
			diagnostics: []
		};
		return { kind: 'prepared', candidate };
	});
}

export function createJoinPlanners(): readonly DomainPlanner<ProjectEnvelope>[] {
	return [wallJoinPlanner()];
}

/** The F.4 intent for one joint removal, with its captured identity and level. */
export function wallJoinIntent(input: {
	readonly junctionId: string;
	readonly capture: LayoutIdCapture;
	readonly operationId: string;
	readonly projectId: string;
	readonly revisionId: string;
	readonly contentRevision: string;
	readonly levelId: string;
}): AuthoringIntent {
	return {
		version: 1,
		kind: LAYOUT_WALL_JOIN_KIND,
		operationId: input.operationId,
		expectedRevision: { projectId: input.projectId, revisionId: input.revisionId },
		targets: [
			layoutSubjectReference({
				kind: 'junction',
				id: input.junctionId,
				contentRevision: input.contentRevision,
				levelId: input.levelId
			})
		],
		payload: { junctionId: input.junctionId },
		capturedInputs: [layoutWorkingLevelInput(input.levelId), layoutIdCaptureInput(input.capture)],
		allocatedIds: []
	};
}
