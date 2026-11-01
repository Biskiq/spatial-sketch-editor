/**
 * T1.P02.S03 — the two bounded F.4 operations the Opening family adds.
 *
 * | Operation | Kind | Canonical planner |
 * | --- | --- | --- |
 * | Place one straight Opening on a Wall | `layout-opening-create` | `planCreateWallFirstOpening` |
 * | Remove one Opening | `layout-opening-delete` | `planDeleteWallFirstOpening` |
 *
 * Both are ordinary `DomainPlanner`s on the same registry, admission and
 * coordinator as every other Layout operation. The intent is the whole
 * operation: preview and acceptance share one immutable capture and the
 * explicit working level, so a replay reproduces the same Opening id.
 *
 * **No clamping.** The pointer's exact host offset is what the planner sees; an
 * offset that would pass the Wall end, overlap a sibling or exceed the Wall
 * height is refused, never slid into fit. Refusals are spoken in the creator's
 * terms with a repair, composed from the planner's own rejection — the editor
 * never re-derives fit or overlap.
 */
import {
	LAYOUT_DIMENSION_LIMIT_MESSAGE,
	layoutIdCaptureInput,
	layoutWorkingLevelInput,
	planCreateWallFirstOpening,
	planDeleteWallFirstOpening,
	recordPreparedCowCandidate,
	wallFirstWallLength,
	type LayoutDocumentWallFirst,
	type LayoutIdCapture,
	type LayoutWallOpening,
	type WallOpeningRejection
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

import {
	layoutSubjectReference,
	readCapturedOperation
} from './drawing-planners';
import { layoutPlanner, preparedLayoutCandidate } from './precision';
import { openingRefusalWords } from './refusals';

export { openingRefusalWords };

export const LAYOUT_OPENING_CREATE_KIND = 'layout-opening-create';
export const LAYOUT_OPENING_DELETE_KIND = 'layout-opening-delete';

/** The two landed Opening kinds; the profile stays the canonical rectangular default. */
export type OpeningKind = LayoutWallOpening['kind'];

export type OpeningCreatePayload = {
	readonly wallId: string;
	readonly kind: OpeningKind;
	/** Raw candidate offset in meters from the canonical Wall start. Never clamped. */
	readonly offset: number;
	readonly width: number;
	readonly height: number;
	readonly sillHeight: number;
};

export type OpeningDeletePayload = {
	readonly openingId: string;
};

function refused(message: string): PlannerOutcome<ProjectEnvelope> {
	return { kind: 'rejected', code: 'invalid-value', message, diagnostics: [] };
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readCreatePayload(
	payload: unknown
): OpeningCreatePayload | { readonly message: string } {
	if (!isRecord(payload)) return { message: 'The Opening operation payload must be an object.' };
	const { wallId, kind, offset, width, height, sillHeight } = payload;
	if (typeof wallId !== 'string' || wallId.length === 0) {
		return { message: 'An Opening placement needs one host wall id.' };
	}
	if (kind !== 'door' && kind !== 'window') {
		return { message: 'An Opening placement supports a door or a window.' };
	}
	if (typeof offset !== 'number' || !Number.isFinite(offset) || offset < 0) {
		return { message: 'An Opening offset must be a finite non-negative number of meters.' };
	}
	if (
		typeof width !== 'number' || !Number.isFinite(width) || width <= 0 ||
		typeof height !== 'number' || !Number.isFinite(height) || height <= 0
	) {
		return { message: 'An Opening width and height must be finite positive numbers of meters.' };
	}
	if (typeof sillHeight !== 'number' || !Number.isFinite(sillHeight) || sillHeight < 0) {
		return { message: 'An Opening sill must be a finite non-negative number of meters.' };
	}
	return { wallId, kind, offset, width, height, sillHeight };
}

function readDeletePayload(
	payload: unknown
): OpeningDeletePayload | { readonly message: string } {
	if (!isRecord(payload)) return { message: 'The Opening operation payload must be an object.' };
	return typeof payload.openingId === 'string' && payload.openingId.length > 0
		? { openingId: payload.openingId }
		: { message: 'An Opening deletion needs one opening id.' };
}

/** The create planner: one captured host-relative Opening, one candidate. */
function openingCreatePlanner(): DomainPlanner<ProjectEnvelope> {
	return layoutPlanner(LAYOUT_OPENING_CREATE_KIND, (request) => {
		const payload = readCreatePayload(request.intent.payload);
		if ('message' in payload) return refused(payload.message);
		const captured = readCapturedOperation(request);
		if ('kind' in captured) return captured;
		const { capture, levelId } = captured;
		if (request.intent.targets.length !== 1) {
			return refused('An Opening placement addresses exactly one host Wall.');
		}
		const target = request.intent.targets[0]!;
		if (target.domain !== 'layout' || target.subject.kind !== 'wall' || target.subject.id !== payload.wallId) {
			return refused(`The intent must address the host Wall "${payload.wallId}" it places on.`);
		}
		const baseline = request.snapshot.domain.source.units.layout.data;
		const plan = planCreateWallFirstOpening(
			baseline,
			{
				wallId: payload.wallId,
				kind: payload.kind,
				offset: payload.offset,
				width: payload.width,
				height: payload.height,
				sillHeight: payload.sillHeight
			},
			capture,
			levelId
		);
		if (plan.kind === 'rejected') {
			return {
				kind: 'rejected',
				code: plan.rejection.code,
				message: openingRefusalWords(baseline, plan.rejection, payload),
				diagnostics: []
			};
		}
		const openingId = plan.changedOpeningIds[0]!;
		return preparedLayoutCandidate(
			request,
			LAYOUT_OPENING_CREATE_KIND,
			{ kind: 'opening', id: openingId },
			plan.document,
			['openings'],
			{ created: true, id: openingId }
		);
	});
}

/** The delete planner: one Opening retired, its id retained in correspondence. */
function openingDeletePlanner(): DomainPlanner<ProjectEnvelope> {
	return layoutPlanner(LAYOUT_OPENING_DELETE_KIND, (request) => {
		const payload = readDeletePayload(request.intent.payload);
		if ('message' in payload) return refused(payload.message);
		const captured = readCapturedOperation(request);
		if ('kind' in captured) return captured;
		const { levelId } = captured;
		if (request.intent.targets.length !== 1) {
			return refused('An Opening deletion addresses exactly one Opening.');
		}
		const target = request.intent.targets[0]!;
		if (target.domain !== 'layout' || target.subject.kind !== 'opening' || target.subject.id !== payload.openingId) {
			return refused(`The intent must address the Opening "${payload.openingId}" it deletes.`);
		}
		const baseline = request.snapshot.domain.source.units.layout.data;
		const plan = planDeleteWallFirstOpening(baseline, payload.openingId);
		if (plan.kind === 'rejected') {
			return {
				kind: 'rejected',
				code: plan.rejection.code,
				message: openingRefusalWords(baseline, plan.rejection, {
					openingId: payload.openingId
				}),
				diagnostics: []
			};
		}
		const contentRevision = request.snapshot.domain.source.units.layout.header.contentRevision;
		const reference = layoutSubjectReference({
			kind: 'opening',
			id: payload.openingId,
			contentRevision,
			levelId
		});
		const candidate: PreparedCandidate<ProjectEnvelope> = {
			operationId: request.intent.operationId,
			sourceKind: UNIT_SOURCE_KIND,
			sourceVersion: UNIT_SOURCE_VERSION,
			source: replaceUnitData(request.snapshot.domain.source, 'layout', plan.document),
			changes: [
				{
					kind: LAYOUT_OPENING_DELETE_KIND,
					subjectIds: [payload.openingId],
					fields: ['openings']
				}
			],
			correspondence: [{ relation: 'retired', before: reference, after: null }],
			diagnostics: []
		};
		recordPreparedCowCandidate(
			request.intent.operationId,
			plan.document,
			canonicalUnitJson(request.intent)
		);
		return { kind: 'prepared', candidate };
	});
}

/** The two Opening operations, registered beside the precision and drawing planners. */
export function createOpeningPlanners(): readonly DomainPlanner<ProjectEnvelope>[] {
	return [openingCreatePlanner(), openingDeletePlanner()];
}

type OpeningIntentInput = {
	readonly capture: LayoutIdCapture;
	readonly operationId: string;
	readonly projectId: string;
	readonly revisionId: string;
	readonly contentRevision: string;
	readonly levelId: string;
};

function openingIntent(
	kind: string,
	subjectKind: 'wall' | 'opening',
	subjectId: string,
	payload: AuthoringIntent['payload'],
	input: OpeningIntentInput
): AuthoringIntent {
	return {
		version: 1,
		kind,
		operationId: input.operationId,
		expectedRevision: { projectId: input.projectId, revisionId: input.revisionId },
		targets: [
			layoutSubjectReference({
				kind: subjectKind,
				id: subjectId,
				contentRevision: input.contentRevision,
				levelId: input.levelId
			})
		],
		payload,
		capturedInputs: [
			layoutWorkingLevelInput(input.levelId),
			layoutIdCaptureInput(input.capture)
		],
		allocatedIds: []
	};
}

/** The F.4 intent for one Opening placement, addressed at its host Wall. */
export function openingCreateIntent(
	input: OpeningIntentInput & { readonly payload: OpeningCreatePayload }
): AuthoringIntent {
	return openingIntent(
		LAYOUT_OPENING_CREATE_KIND,
		'wall',
		input.payload.wallId,
		{ ...input.payload },
		input
	);
}

/** The F.4 intent for one Opening deletion, addressed at the Opening. */
export function openingDeleteIntent(
	input: OpeningIntentInput & { readonly openingId: string }
): AuthoringIntent {
	return openingIntent(
		LAYOUT_OPENING_DELETE_KIND,
		'opening',
		input.openingId,
		{ openingId: input.openingId },
		input
	);
}
