/**
 * C4 — the Room-owned Round Room operations.
 *
 * A Round Room is one authored fact (`room.round`) whether its boundary is a
 * single closed Wall or a connected ring of open arcs. These two planners are
 * the only editor entry points that write it:
 *
 * | Operation | Kind | Canonical planner |
 * | --- | --- | --- |
 * | Radius / Diameter | `layout-round-room-radius` | `planResizeRoundRoomRadius` |
 * | Release round | `layout-round-room-release` | `planReleaseRoundRoom` |
 *
 * Both are ordinary `DomainPlanner`s on the same registry, admission and
 * coordinator as every other Layout operation. Neither re-derives geometry: the
 * retained planner owns the ring, the Opening stations and the surface lineage,
 * and this module only translates an F.4 intent into that planner's request.
 */
import {
	layoutIdCaptureInput,
	layoutWorkingLevelInput,
	type LayoutIdCapture,
} from '@portfolio/layout-core/plan';
import { materializeLayoutSourceForCapture } from '@portfolio/layout-core/kernel';
import { planReleaseRoundRoom, planResizeRoundRoomRadius } from '@portfolio/layout-core/room';
import { recordPreparedCowCandidate } from '@portfolio/layout-core/world';
import type {
	AuthoringIntent,
	DomainPlanner,
	PlannerOutcome,
	PreparedCandidate,
} from '@portfolio/project-model/f4';
import {
	canonicalUnitJson,
	replaceUnitData,
	UNIT_SOURCE_KIND,
	UNIT_SOURCE_VERSION,
	type ProjectEnvelope,
} from '@portfolio/project-model/units';

import {
	addressedSubject,
	layoutPlanner,
	layoutSubjectReference,
	preparedLayoutCandidate,
	readCapturedOperation,
	registerLayoutSurfaceLineage,
} from './precision';

/** The Room-owned radius edit, isolated or connected, through the C2 planner. */
export const LAYOUT_ROUND_ROOM_RADIUS_KIND = 'layout-round-room-radius';
/** Release round: clear the Room fact (splitting an isolated circle once). */
export const LAYOUT_ROUND_ROOM_RELEASE_KIND = 'layout-round-room-release';

function refused(message: string): PlannerOutcome<ProjectEnvelope> {
	return { kind: 'rejected', code: 'invalid-value', message, diagnostics: [] };
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function roundRoomRadiusPlanner(): DomainPlanner<ProjectEnvelope> {
	return layoutPlanner(LAYOUT_ROUND_ROOM_RADIUS_KIND, (request) => {
		const payload = request.intent.payload;
		if (!isRecord(payload)) return refused('The radius payload must be an object.');
		if (Object.keys(payload).length !== 2 || !('roomId' in payload) || !('radius' in payload)) {
			return refused('A Round Room radius payload is exactly { roomId, radius }.');
		}
		const { roomId, radius } = payload;
		if (typeof roomId !== 'string' || roomId.length === 0)
			return refused('A radius edit needs one Room id.');
		if (typeof radius !== 'number' || !Number.isFinite(radius) || radius <= 0) {
			return refused('A radius must be one finite positive number of meters.');
		}
		const addressed = addressedSubject(request, 'room', roomId);
		if (!addressed.ok) return refused(addressed.message);
		const plan = planResizeRoundRoomRadius({
			document: request.snapshot.domain.source.units.layout.data,
			roomId,
			radius,
		});
		if (plan.kind === 'rejected') {
			return {
				kind: 'rejected',
				code: plan.rejection.code,
				message: plan.rejection.message,
				diagnostics: [],
			};
		}
		return preparedLayoutCandidate(
			request,
			LAYOUT_ROUND_ROOM_RADIUS_KIND,
			{ kind: 'room', id: roomId },
			plan.document,
			['radius', 'diameter', 'walls', 'openings'],
			{ surfaceLineage: plan.surfaceLineage },
		);
	});
}

function roundRoomReleasePlanner(): DomainPlanner<ProjectEnvelope> {
	return layoutPlanner(LAYOUT_ROUND_ROOM_RELEASE_KIND, (request) => {
		const payload = request.intent.payload;
		if (
			!isRecord(payload) ||
			Object.keys(payload).length !== 1 ||
			typeof payload.roomId !== 'string'
		) {
			return refused('A Release round payload is exactly { roomId }.');
		}
		const roomId = payload.roomId;
		if (roomId.length === 0) return refused('Release round needs one Room id.');
		const addressed = addressedSubject(request, 'room', roomId);
		if (!addressed.ok) return refused(addressed.message);
		const captured = readCapturedOperation(request);
		if ('kind' in captured) return captured;
		const { capture, levelId } = captured;
		const plan = planReleaseRoundRoom({
			document: request.snapshot.domain.source.units.layout.data,
			roomId,
			capture,
			levelId,
		});
		if (plan.kind === 'rejected') {
			return {
				kind: 'rejected',
				code: plan.rejection.code,
				message: plan.rejection.message,
				diagnostics: [],
			};
		}
		const contentRevision = request.snapshot.domain.source.units.layout.header.contentRevision;
		const roomReference = layoutSubjectReference({
			kind: 'room',
			id: roomId,
			contentRevision,
			levelId,
		});
		const wallReference = (id: string) =>
			layoutSubjectReference({ kind: 'wall', id, contentRevision, levelId });
		const junctionReference = (id: string) =>
			layoutSubjectReference({ kind: 'junction', id, contentRevision, levelId });
		// Every identity the operation reports, through the canonical
		// correspondence. The source Wall keeps its id; new fragments and
		// Junctions are created; the retired seam Junction is explicitly retired
		// with no successor and never transferred to the seam knot.
		type CorrespondenceEntry = PreparedCandidate<ProjectEnvelope>['correspondence'][number];
		const correspondence: CorrespondenceEntry[] = [
			{ relation: 'preserved', before: roomReference, after: roomReference },
		];
		for (const entry of plan.correspondence.walls) {
			if (entry.kind === 'subdivision') {
				const source = wallReference(entry.sourceWallId);
				correspondence.push({ relation: 'preserved', before: source, after: source });
				for (const id of entry.fragmentWallIds) {
					if (id === entry.sourceWallId) continue;
					correspondence.push({ relation: 'created', before: null, after: wallReference(id) });
				}
				continue;
			}
			// Repack: every old arc maps to the one surviving Wall in traversal
			// order; the other arcs are explicitly retired.
			const survivor = wallReference(entry.survivorWallId);
			correspondence.push({ relation: 'preserved', before: survivor, after: survivor });
			for (const id of entry.sourceWallIds) {
				if (id === entry.survivorWallId) continue;
				correspondence.push({ relation: 'retired', before: wallReference(id), after: null });
			}
		}
		for (const entry of plan.correspondence.junctions) {
			if (entry.kind === 'born') {
				correspondence.push({
					relation: 'created',
					before: null,
					after: junctionReference(entry.junctionId),
				});
			} else if (entry.kind === 'retired') {
				correspondence.push({
					relation: 'retired',
					before: junctionReference(entry.junctionId),
					after: null,
				});
			} else {
				correspondence.push({
					relation: 'preserved',
					before: junctionReference(entry.junctionId),
					after: junctionReference(entry.junctionId),
				});
			}
		}
		for (const entry of plan.correspondence.openings) {
			const reference = layoutSubjectReference({
				kind: 'opening',
				id: entry.openingId,
				contentRevision,
				levelId,
			});
			correspondence.push({ relation: 'preserved', before: reference, after: reference });
		}
		recordPreparedCowCandidate(
			request.intent.operationId,
			plan.document,
			canonicalUnitJson(request.intent),
		);
		materializeLayoutSourceForCapture(plan.document);
		const candidate: PreparedCandidate<ProjectEnvelope> = {
			operationId: request.intent.operationId,
			sourceKind: UNIT_SOURCE_KIND,
			sourceVersion: UNIT_SOURCE_VERSION,
			source: replaceUnitData(request.snapshot.domain.source, 'layout', plan.document),
			changes: [
				{
					kind: LAYOUT_ROUND_ROOM_RELEASE_KIND,
					subjectIds: [
						roomId,
						...plan.createdWallIds,
						...plan.createdJunctionIds,
						...plan.retiredJunctionIds,
					],
					fields: ['rooms', 'walls', 'junctions', 'openings'],
				},
			],
			correspondence,
			diagnostics: [],
		};
		registerLayoutSurfaceLineage(candidate, plan.surfaceLineage);
		return { kind: 'prepared', candidate };
	});
}

export function createRoundRoomPlanners(): readonly DomainPlanner<ProjectEnvelope>[] {
	return [roundRoomRadiusPlanner(), roundRoomReleasePlanner()];
}

/** The F.4 intent for one Room-owned radius edit, isolated or connected. */
export function roundRoomRadiusIntent(input: {
	readonly roomId: string;
	readonly radius: number;
	readonly operationId: string;
	readonly projectId: string;
	readonly revisionId: string;
	readonly contentRevision: string;
	readonly levelId: string;
}): AuthoringIntent {
	return {
		version: 1,
		kind: LAYOUT_ROUND_ROOM_RADIUS_KIND,
		operationId: input.operationId,
		expectedRevision: { projectId: input.projectId, revisionId: input.revisionId },
		targets: [
			layoutSubjectReference({
				kind: 'room',
				id: input.roomId,
				contentRevision: input.contentRevision,
				levelId: input.levelId,
			}),
		],
		payload: { roomId: input.roomId, radius: input.radius },
		capturedInputs: [layoutWorkingLevelInput(input.levelId)],
		allocatedIds: [],
	};
}

/** The F.4 intent for one Release round, with its captured identity and level. */
export function roundRoomReleaseIntent(input: {
	readonly roomId: string;
	readonly capture: LayoutIdCapture;
	readonly operationId: string;
	readonly projectId: string;
	readonly revisionId: string;
	readonly contentRevision: string;
	readonly levelId: string;
}): AuthoringIntent {
	return {
		version: 1,
		kind: LAYOUT_ROUND_ROOM_RELEASE_KIND,
		operationId: input.operationId,
		expectedRevision: { projectId: input.projectId, revisionId: input.revisionId },
		targets: [
			layoutSubjectReference({
				kind: 'room',
				id: input.roomId,
				contentRevision: input.contentRevision,
				levelId: input.levelId,
			}),
		],
		payload: { roomId: input.roomId },
		capturedInputs: [layoutWorkingLevelInput(input.levelId), layoutIdCaptureInput(input.capture)],
		allocatedIds: [],
	};
}
