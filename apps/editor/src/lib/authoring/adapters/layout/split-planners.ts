/**
 * T1 A1 — one Split intent over the retained `planWallSplitAtPoint` planner.
 *
 * | Operation | Kind | Canonical planner |
 * | --- | --- | --- |
 * | Split one open Wall at a station | `layout-wall-split` | `planWallSplitAtPoint` |
 *
 * The planner is the **same** deterministic noder the chain uses. It builds one
 * complete candidate from the accepted baseline, keeps the start-side Wall's id,
 * rebases Openings by physical metre offset, rewrites every Room boundary and
 * leaves the Room ids alone. Nothing here mutates the baseline, adds a geometry
 * model or stores new session state.
 *
 * `planWallSplitAtPoint` receives the exact point the station names, so the
 * junction lands on the canonical centerline (and on the same coordinate for
 * straight and curved Walls). The allocation is captured before evaluation:
 * Undo/Redo replays the same Wall and Junction ids.
 */
import {
	allocateCapturedId,
	isClosedWall,
	layoutIdCaptureInput,
	layoutWorkingLevelInput,
	materializeLayoutSourceForCapture,
	planWallSplitAtPoint,
	readLayoutIdCapture,
	readLayoutWorkingLevel,
	recordPreparedCowCandidate,
	type LayoutDocumentWallFirst,
	type LayoutIdCapture,
	type LayoutVec2,
	type NodingIdAllocator
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

import { layoutPlanner, wallStationFrame } from './precision';
import { layoutSubjectReference } from './drawing-planners';
import { wallSplitRefusalWords } from './refusals';

export const LAYOUT_WALL_SPLIT_KIND = 'layout-wall-split';

/** One open Wall, cut at one canonical station measured from its start. */
export type WallSplitPayload = {
	readonly wallId: string;
	/** Metres along the Wall's canonical start→end centerline (arc length on a curve). */
	readonly distance: number;
};

function refused(message: string): PlannerOutcome<ProjectEnvelope> {
	return { kind: 'rejected', code: 'invalid-value', message, diagnostics: [] };
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readSplitPayload(payload: unknown): WallSplitPayload | { readonly message: string } {
	if (!isRecord(payload)) return { message: 'The Wall split payload must be an object.' };
	const expected = ['wallId', 'distance'];
	const unknown = Object.keys(payload).filter((key) => !expected.includes(key));
	if (unknown.length > 0) return { message: `The Wall split payload cannot carry ${unknown.join(', ')}.` };
	for (const key of expected) {
		if (!(key in payload)) return { message: `The Wall split payload is missing "${key}".` };
	}
	const { wallId, distance } = payload;
	if (typeof wallId !== 'string' || wallId.length === 0) {
		return { message: 'A Wall split needs one wall id.' };
	}
	if (typeof distance !== 'number' || !Number.isFinite(distance) || distance <= 0) {
		return { message: 'A Wall split distance must be one finite positive number of meters.' };
	}
	return { wallId, distance };
}

/**
 * Captured identity for the noder's two allocations.
 *
 * The seeds are the noder's own (`${wallId}-b`, `${wallId}-split`); the capture
 * nonce makes them replayable. Occupancy is only a collision refusal, never an
 * allocation source.
 */
function capturedNodingAllocator(capture: LayoutIdCapture): NodingIdAllocator {
	return {
		nextWallId(baseDocument: LayoutDocumentWallFirst, seed: string): string {
			return allocateCapturedId(new Set(baseDocument.walls.map((wall) => wall.id)), seed, capture);
		},
		nextJunctionId(baseDocument: LayoutDocumentWallFirst, seed: string): string {
			return allocateCapturedId(new Set(baseDocument.junctions.map((junction) => junction.id)), seed, capture);
		}
	};
}

function wallSplitPlanner(): DomainPlanner<ProjectEnvelope> {
	return layoutPlanner(LAYOUT_WALL_SPLIT_KIND, (request) => {
		const payload = readSplitPayload(request.intent.payload);
		if ('message' in payload) return refused(payload.message);
		const { wallId, distance } = payload;
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
			return refused('A Wall split addresses exactly one Wall.');
		}
		const target = request.intent.targets[0]!;
		if (target.domain !== 'layout' || target.subject.kind !== 'wall' || target.subject.id !== wallId) {
			return refused(`The intent must address the Wall "${wallId}" it splits.`);
		}
		const wall = baseline.walls.find((candidate) => candidate.id === wallId);
		if (wall === undefined) return refused(`Unknown Wall "${wallId}".`);
		// The planner refuses a closed Wall itself. The preview check names the
		// policy in the creator's words before a candidate is built.
		if (isClosedWall(wall)) return refused(wallSplitRefusalWords('closed_wall_isolated'));
		const station = wallStationFrame(baseline, wallId);
		const at = station?.pointAt(distance) ?? null;
		if (station === null || at === null) {
			return refused(wallSplitRefusalWords('split_distance_out_of_range'));
		}
		const plan = planWallSplitAtPoint(
			baseline,
			wallId,
			distance,
			[at.point[0], at.point[1]] as LayoutVec2,
			capturedNodingAllocator(capture)
		);
		if (plan.kind === 'rejected') {
			return {
				kind: 'rejected',
				code: plan.rejection.code,
				message: wallSplitRefusalWords(plan.rejection.code, plan.rejection.message),
				diagnostics: []
			};
		}
		const newWallId = plan.createdWallIds[0];
		if (newWallId === undefined) return refused('The Wall split created no second fragment.');
		const contentRevision = request.snapshot.domain.source.units.layout.header.contentRevision;
		const movedOpenings = plan.document.openings.filter(
			(opening) => opening.wallId === newWallId && baseline.openings.some((before) => before.id === opening.id)
		);
		const affectedRoomIds = baseline.rooms
			.filter((room) => room.boundary.some((ref) => ref.wallId === wallId))
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
					kind: LAYOUT_WALL_SPLIT_KIND,
					subjectIds: [wallId, newWallId, plan.junctionId, ...movedOpenings.map((opening) => opening.id)],
					fields: ['walls', 'junctions', 'openings', 'rooms']
				}
			],
			correspondence: [
				// The start-side fragment keeps the source Wall's identity.
				{
					relation: 'preserved',
					before: layoutSubjectReference({ kind: 'wall', id: wallId, contentRevision, levelId }),
					after: layoutSubjectReference({ kind: 'wall', id: wallId, contentRevision, levelId })
				},
				// The end-side fragment is a new Wall created from that source.
				{
					relation: 'created',
					before: null,
					after: layoutSubjectReference({ kind: 'wall', id: newWallId, contentRevision, levelId })
				},
				{
					relation: 'created',
					before: null,
					after: layoutSubjectReference({ kind: 'junction', id: plan.junctionId, contentRevision, levelId })
				},
				// Openings keep their ids and positions; the ones re-based onto the new
				// fragment are preserved, not recreated.
				...movedOpenings.map((opening) => ({
					relation: 'preserved' as const,
					before: layoutSubjectReference({ kind: 'opening', id: opening.id, contentRevision, levelId }),
					after: layoutSubjectReference({ kind: 'opening', id: opening.id, contentRevision, levelId })
				})),
				// Every Room whose boundary names the split Wall keeps its id.
				...affectedRoomIds.map((roomId) => ({
					relation: 'preserved' as const,
					before: layoutSubjectReference({ kind: 'room', id: roomId, contentRevision, levelId }),
					after: layoutSubjectReference({ kind: 'room', id: roomId, contentRevision, levelId })
				}))
			],
			diagnostics: []
		};
		return { kind: 'prepared', candidate };
	});
}

export function createSplitPlanners(): readonly DomainPlanner<ProjectEnvelope>[] {
	return [wallSplitPlanner()];
}

/** The F.4 intent for one Wall split, with its captured identity and level. */
export function wallSplitIntent(input: {
	readonly wallId: string;
	readonly distance: number;
	readonly capture: LayoutIdCapture;
	readonly operationId: string;
	readonly projectId: string;
	readonly revisionId: string;
	readonly contentRevision: string;
	readonly levelId: string;
}): AuthoringIntent {
	return {
		version: 1,
		kind: LAYOUT_WALL_SPLIT_KIND,
		operationId: input.operationId,
		expectedRevision: { projectId: input.projectId, revisionId: input.revisionId },
		targets: [
			layoutSubjectReference({
				kind: 'wall',
				id: input.wallId,
				contentRevision: input.contentRevision,
				levelId: input.levelId
			})
		],
		payload: { wallId: input.wallId, distance: input.distance },
		capturedInputs: [layoutWorkingLevelInput(input.levelId), layoutIdCaptureInput(input.capture)],
		allocatedIds: []
	};
}
