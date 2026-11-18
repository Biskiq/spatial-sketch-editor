/**
 * SP1d — the two retained planners one open-side handle submits.
 *
 * | Operation | Kind | Canonical planner |
 * | --- | --- | --- |
 * | Mid-grip moves the open side square to itself | `layout-open-side-offset` | `planSpaceOpenSideOffset` |
 * | End knob slides into the adjoining Wall and splits there | `layout-open-side-slide` | `planSpaceOpenSideEndSlide` |
 *
 * Both are ordinary `DomainPlanner`s on the same registry, admission and
 * coordinator as every other Layout operation. A virtual edge has no id, so its
 * payload addresses the Space and the edge's Junction pair; the planner resolves
 * the pair through the one composer and refuses a stale handle rather than
 * repairing it.
 *
 * The slide captures its Layout identity at the press. The split Junction and
 * stub Wall ids therefore come from the operation's nonce, so the candidate the
 * creator previewed and the document that lands describe the same ids, and
 * Undo/Redo replays them.
 */
import {
	allocateCapturedId,
	layoutIdCaptureInput,
	layoutWorkingLevelInput,
	materializeLayoutSourceForCapture,
	planSpaceOpenSideEndSlide,
	planSpaceOpenSideOffset,
	readLayoutIdCapture,
	readLayoutWorkingLevel,
	recordPreparedCowCandidate,
	type LayoutDocumentWallFirst,
	type LayoutIdCapture,
	type LayoutVec2,
	type NodingIdAllocator
} from '@portfolio/layout-core';
import {
	canonicalUnitJson,
	replaceUnitData,
	UNIT_SOURCE_KIND,
	UNIT_SOURCE_VERSION,
	type ProjectEnvelope
} from '@portfolio/project-model/units';
import type {
	AuthoringIntent,
	DomainPlanner,
	PlannerOutcome,
	PlannerRequest,
	PreparedCandidate
} from '@portfolio/project-model';

import { layoutSubjectReference } from './drawing-planners';
import { addressedSubject, layoutPlanner, layoutReference, wallStationFrame } from './precision';

export const LAYOUT_OPEN_SIDE_OFFSET_KIND = 'layout-open-side-offset';
export const LAYOUT_OPEN_SIDE_SLIDE_KIND = 'layout-open-side-slide';

type OpenSidePayload = {
	readonly roomId: string;
	readonly startJunctionId: string;
	readonly endJunctionId: string;
};

type OpenSideOffsetPayload = OpenSidePayload & { readonly offset: number };

type OpenSideSlidePayload = OpenSidePayload & {
	readonly end: 'start' | 'end';
	readonly wallId: string;
	readonly station: number;
};

function refused(message: string): PlannerOutcome<ProjectEnvelope> {
	return { kind: 'rejected', code: 'invalid-value', message, diagnostics: [] };
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function opaqueId(value: unknown): value is string {
	return typeof value === 'string' && value.length > 0;
}

function readOpenSide(
	payload: unknown,
	expected: readonly string[]
): { readonly value: OpenSidePayload } | { readonly message: string } {
	if (!isRecord(payload)) return { message: 'The open-side payload must be an object.' };
	const unknown = Object.keys(payload).filter((key) => !expected.includes(key));
	if (unknown.length > 0) {
		return { message: `The open-side payload cannot carry ${unknown.join(', ')}.` };
	}
	for (const key of expected) {
		if (!(key in payload)) return { message: `The open-side payload is missing "${key}".` };
	}
	const { roomId, startJunctionId, endJunctionId } = payload;
	if (!opaqueId(roomId) || !opaqueId(startJunctionId) || !opaqueId(endJunctionId)) {
		return { message: 'An open side needs a Space id and both end Junction ids.' };
	}
	return { value: { roomId, startJunctionId, endJunctionId } };
}

function readOffsetPayload(payload: unknown): OpenSideOffsetPayload | { readonly message: string } {
	const read = readOpenSide(payload, ['roomId', 'startJunctionId', 'endJunctionId', 'offset']);
	if ('message' in read) return read;
	const offset = (payload as Record<string, unknown>).offset;
	if (typeof offset !== 'number' || !Number.isFinite(offset)) {
		return { message: 'An open side offset must be one finite number of meters.' };
	}
	return { ...read.value, offset };
}

function readSlidePayload(payload: unknown): OpenSideSlidePayload | { readonly message: string } {
	const read = readOpenSide(payload, [
		'roomId',
		'startJunctionId',
		'endJunctionId',
		'end',
		'wallId',
		'station'
	]);
	if ('message' in read) return read;
	const record = payload as Record<string, unknown>;
	const end = record.end;
	if (end !== 'start' && end !== 'end') {
		return { message: "An open-side slide names 'start' or 'end'." };
	}
	if (!opaqueId(record.wallId)) return { message: 'An open-side slide needs one Wall id.' };
	const station = record.station;
	if (typeof station !== 'number' || !Number.isFinite(station) || station <= 0) {
		return { message: 'An open-side slide needs one finite positive station in meters.' };
	}
	return { ...read.value, end, wallId: record.wallId, station };
}

/** The noder's two allocations, captured so preview and commit share them. */
function capturedNodingAllocator(capture: LayoutIdCapture): NodingIdAllocator {
	return {
		nextWallId(baseDocument: LayoutDocumentWallFirst, seed: string): string {
			return allocateCapturedId(new Set(baseDocument.walls.map((wall) => wall.id)), seed, capture);
		},
		nextJunctionId(baseDocument: LayoutDocumentWallFirst, seed: string): string {
			return allocateCapturedId(
				new Set(baseDocument.junctions.map((junction) => junction.id)),
				seed,
				capture
			);
		}
	};
}

function capturedLevel(request: PlannerRequest<ProjectEnvelope>): string | PlannerOutcome<ProjectEnvelope> {
	const levelId = readLayoutWorkingLevel(request.capturedInputs);
	if (levelId === null) return refused('The intent must capture its working Layout level before evaluation.');
	const baseline = request.snapshot.domain.source.units.layout.data;
	if (levelId !== baseline.floor.id) {
		return refused(`The captured working level '${levelId}' is not the accepted Layout floor.`);
	}
	return levelId;
}

/**
 * One open-side gesture's prepared candidate.
 *
 * The Space is preserved by id and name. Every changed Wall keeps its own id;
 * the slide's split Junction and stub Wall are created under the captured
 * nonce. The virtual edge itself allocates nothing and enters no ledger.
 */
function preparedOpenSideCandidate(input: {
	readonly request: PlannerRequest<ProjectEnvelope>;
	readonly kind: string;
	readonly roomId: string;
	readonly document: LayoutDocumentWallFirst;
	readonly changedWallIds: readonly string[];
	/** Walls that existed before and still exist; defaults to every changed Wall. */
	readonly preservedWallIds?: readonly string[];
	readonly createdWallIds?: readonly string[];
	readonly createdJunctionIds?: readonly string[];
}): PlannerOutcome<ProjectEnvelope> {
	const levelId = capturedLevel(input.request);
	if (typeof levelId !== 'string') return levelId;
	const contentRevision = input.request.snapshot.domain.source.units.layout.header.contentRevision;
	const room = layoutReference(input.request.snapshot, { kind: 'room', id: input.roomId }, contentRevision, levelId);
	const createdWallIds = input.createdWallIds ?? [];
	const createdJunctionIds = input.createdJunctionIds ?? [];
	const preservedWallIds = [...new Set(input.preservedWallIds ?? input.changedWallIds)].filter(
		(wallId) => !createdWallIds.includes(wallId)
	);
	recordPreparedCowCandidate(
		input.request.intent.operationId,
		input.document,
		canonicalUnitJson(input.request.intent)
	);
	materializeLayoutSourceForCapture(input.document);
	const candidate: PreparedCandidate<ProjectEnvelope> = {
		operationId: input.request.intent.operationId,
		sourceKind: UNIT_SOURCE_KIND,
		sourceVersion: UNIT_SOURCE_VERSION,
		source: replaceUnitData(input.request.snapshot.domain.source, 'layout', input.document),
		changes: [
			{
				kind: input.kind,
				subjectIds: [
					...new Set([
						input.roomId,
						...input.changedWallIds,
						...createdJunctionIds,
						...createdWallIds
					])
				],
				fields: ['rooms', 'walls', 'junctions']
			}
		],
		correspondence: [
			{ relation: 'preserved', before: room, after: room },
			...preservedWallIds.map((wallId) => {
				const reference = layoutReference(
					input.request.snapshot,
					{ kind: 'wall', id: wallId },
					contentRevision,
					levelId
				);
				return { relation: 'preserved' as const, before: reference, after: reference };
			}),
			...createdJunctionIds.map((id) => ({
				relation: 'created' as const,
				before: null,
				after: layoutSubjectReference({ kind: 'junction', id, contentRevision, levelId })
			})),
			...createdWallIds.map((id) => ({
				relation: 'created' as const,
				before: null,
				after: layoutReference(input.request.snapshot, { kind: 'wall', id }, contentRevision, levelId)
			}))
		],
		diagnostics: []
	};
	return { kind: 'prepared', candidate };
}

function openSideOffsetPlanner(): DomainPlanner<ProjectEnvelope> {
	return layoutPlanner(LAYOUT_OPEN_SIDE_OFFSET_KIND, (request) => {
		const payload = readOffsetPayload(request.intent.payload);
		if ('message' in payload) return refused(payload.message);
		const addressed = addressedSubject(request, 'room', payload.roomId);
		if (!addressed.ok) return refused(addressed.message);
		const plan = planSpaceOpenSideOffset(
			request.snapshot.domain.source.units.layout.data,
			payload.roomId,
			payload.startJunctionId,
			payload.endJunctionId,
			payload.offset
		);
		if (plan.kind === 'rejected') {
			return { kind: 'rejected', code: plan.rejection.code, message: plan.rejection.message, diagnostics: [] };
		}
		return preparedOpenSideCandidate({
			request,
			kind: LAYOUT_OPEN_SIDE_OFFSET_KIND,
			roomId: payload.roomId,
			document: plan.document,
			changedWallIds: plan.changedWallIds
		});
	});
}

function openSideSlidePlanner(): DomainPlanner<ProjectEnvelope> {
	return layoutPlanner(LAYOUT_OPEN_SIDE_SLIDE_KIND, (request) => {
		const payload = readSlidePayload(request.intent.payload);
		if ('message' in payload) return refused(payload.message);
		const addressed = addressedSubject(request, 'room', payload.roomId);
		if (!addressed.ok) return refused(addressed.message);
		const capture = readLayoutIdCapture(request.capturedInputs);
		if (capture === null) {
			return refused('The operation must capture its Layout identity before evaluation.');
		}
		const baseline = request.snapshot.domain.source.units.layout.data;
		const wall = baseline.walls.find((candidate) => candidate.id === payload.wallId);
		if (wall === undefined) return refused(`Unknown Wall "${payload.wallId}".`);
		const stationFrame = wallStationFrame(baseline, payload.wallId);
		const at = stationFrame?.pointAt(payload.station) ?? null;
		if (stationFrame === null || at === null) {
			return refused('Slide the open side inside its Wall.');
		}
		const plan = planSpaceOpenSideEndSlide(
			baseline,
			payload.roomId,
			payload.startJunctionId,
			payload.endJunctionId,
			payload.end,
			payload.wallId,
			payload.station,
			[at.point[0], at.point[1]] as LayoutVec2,
			capturedNodingAllocator(capture)
		);
		if (plan.kind === 'rejected') {
			return { kind: 'rejected', code: plan.rejection.code, message: plan.rejection.message, diagnostics: [] };
		}
		const createdWallId = plan.createdWallIds[0];
		if (createdWallId === undefined) return refused('The Wall split created no second fragment.');
		return preparedOpenSideCandidate({
			request,
			kind: LAYOUT_OPEN_SIDE_SLIDE_KIND,
			roomId: payload.roomId,
			document: plan.document,
			changedWallIds: [payload.wallId, createdWallId],
			preservedWallIds: [payload.wallId],
			createdWallIds: [createdWallId],
			createdJunctionIds: [plan.splitJunctionId]
		});
	});
}

export function createOpenSidePlanners(): readonly DomainPlanner<ProjectEnvelope>[] {
	return [openSideOffsetPlanner(), openSideSlidePlanner()];
}

/** The F.4 intent for one mid-grip offset. No id is minted. */
export function openSideOffsetIntent(input: {
	readonly roomId: string;
	readonly startJunctionId: string;
	readonly endJunctionId: string;
	readonly offset: number;
	readonly operationId: string;
	readonly projectId: string;
	readonly revisionId: string;
	readonly contentRevision: string;
	readonly levelId: string;
}): AuthoringIntent {
	return layoutIntent({
		kind: LAYOUT_OPEN_SIDE_OFFSET_KIND,
		roomId: input.roomId,
		payload: {
			roomId: input.roomId,
			startJunctionId: input.startJunctionId,
			endJunctionId: input.endJunctionId,
			offset: input.offset
		},
		projectId: input.projectId,
		revisionId: input.revisionId,
		contentRevision: input.contentRevision,
		levelId: input.levelId,
		operationId: input.operationId
	});
}

/** The F.4 intent for one end-knob slide, with its captured split identity. */
export function openSideSlideIntent(input: {
	readonly roomId: string;
	readonly startJunctionId: string;
	readonly endJunctionId: string;
	readonly end: 'start' | 'end';
	readonly wallId: string;
	readonly station: number;
	readonly capture: LayoutIdCapture;
	readonly operationId: string;
	readonly projectId: string;
	readonly revisionId: string;
	readonly contentRevision: string;
	readonly levelId: string;
}): AuthoringIntent {
	return layoutIntent({
		kind: LAYOUT_OPEN_SIDE_SLIDE_KIND,
		roomId: input.roomId,
		payload: {
			roomId: input.roomId,
			startJunctionId: input.startJunctionId,
			endJunctionId: input.endJunctionId,
			end: input.end,
			wallId: input.wallId,
			station: input.station
		},
		projectId: input.projectId,
		revisionId: input.revisionId,
		contentRevision: input.contentRevision,
		levelId: input.levelId,
		operationId: input.operationId,
		capture: input.capture
	});
}

function layoutIntent(input: {
	readonly kind: string;
	readonly roomId: string;
	readonly payload: AuthoringIntent['payload'];
	readonly operationId: string;
	readonly projectId: string;
	readonly revisionId: string;
	readonly contentRevision: string;
	readonly levelId: string;
	readonly capture?: LayoutIdCapture;
}): AuthoringIntent {
	return {
		version: 1,
		kind: input.kind,
		operationId: input.operationId,
		expectedRevision: { projectId: input.projectId, revisionId: input.revisionId },
		targets: [
			{
				version: 1,
				domain: 'layout',
				subject: { kind: 'room', id: input.roomId },
				revision: { kind: 'exact', contentRevision: input.contentRevision },
				instancePath: [],
				location: { kind: 'layout-location', levelId: input.levelId, structureInstancePath: [] },
				componentId: null,
				capabilityId: null
			}
		],
		payload: input.payload,
		capturedInputs: [
			layoutWorkingLevelInput(input.levelId),
			...(input.capture === undefined ? [] : [layoutIdCaptureInput(input.capture)])
		],
		allocatedIds: []
	};
}
