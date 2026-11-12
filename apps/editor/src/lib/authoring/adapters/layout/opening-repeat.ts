/**
 * T1 A8 — one Repeat intent over the retained `planRepeatWallOpening` planner.
 *
 * | Operation | Kind | Canonical planner |
 * | --- | --- | --- |
 * | Add N copies of one Opening along its host Wall | `layout-opening-repeat` | `planRepeatWallOpening` |
 *
 * The planner is the **same** deterministic batch copier the P23.4 suite
 * certifies. Copy `i` lands at `source.offset + i × spacing` measured from the
 * ORIGINAL source, so no accumulated drift can enter; every copy keeps the
 * source's kind, width, height, sill and profile, and the complete final
 * Opening set on the Wall validates once as one batch. A set that would leave
 * the Wall, collide with another Opening or fail any canonical gate rejects
 * whole: nothing partial is committed and no history entry exists.
 *
 * Nothing here mutates the baseline, adds a geometry model, arms a tool or
 * stores new session state. The allocation is captured before evaluation, so
 * Undo/Redo replays the same generated Opening ids.
 */
import {
	layoutIdCaptureInput,
	layoutWorkingLevelInput,
	mintLayoutIdCapture,
	planRepeatWallOpening,
	readLayoutIdCapture,
	readLayoutWorkingLevel,
	recordPreparedCowCandidate,
	materializeLayoutSourceForCapture,
	wallFirstWallLength,
	type DuplicateRejection,
	type LayoutDocumentWallFirst,
	type LayoutIdCapture,
	type LayoutWallOpening
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

export const LAYOUT_OPENING_REPEAT_KIND = 'layout-opening-repeat';

/** One Opening, copied `count` times at a fixed metre spacing along its host. */
export type OpeningRepeatPayload = {
	readonly openingId: string;
	/** Copies to add; `1` is a plain duplicate. The planner bounds `1..50`. */
	readonly count: number;
	/** Metres between each copy and the original, along the host Wall. */
	readonly spacing: number;
};

export type OpeningRepeatRefusalAttempt = {
	readonly openingId: string;
	readonly count: number;
	readonly spacing: number;
};

function refused(message: string): PlannerOutcome<ProjectEnvelope> {
	return { kind: 'rejected', code: 'invalid-value', message, diagnostics: [] };
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readRepeatPayload(payload: unknown): OpeningRepeatPayload | { readonly message: string } {
	if (!isRecord(payload)) return { message: 'The Opening repeat payload must be an object.' };
	const expected = ['openingId', 'count', 'spacing'];
	const unknown = Object.keys(payload).filter((key) => !expected.includes(key));
	if (unknown.length > 0) return { message: `The Opening repeat payload cannot carry ${unknown.join(', ')}.` };
	for (const key of expected) {
		if (!(key in payload)) return { message: `The Opening repeat payload is missing "${key}".` };
	}
	const { openingId, count, spacing } = payload;
	if (typeof openingId !== 'string' || openingId.length === 0) {
		return { message: 'An Opening repeat needs one Opening id.' };
	}
	if (typeof count !== 'number' || !Number.isFinite(count)) {
		return { message: 'An Opening repeat needs one finite copy count.' };
	}
	if (typeof spacing !== 'number' || !Number.isFinite(spacing)) {
		return { message: 'An Opening repeat needs one finite spacing in meters.' };
	}
	return { openingId, count, spacing };
}

function meters(value: number): string {
	return `${Math.abs(value).toFixed(2)} m`;
}

function kindWords(kind: LayoutWallOpening['kind']): string {
	return kind === 'door' ? 'door' : 'window';
}

/**
 * The creator-facing refusal and repair for one rejected Repeat batch.
 *
 * Composed from the canonical rejection plus the exact attempt, so the words
 * the Card reads before committing are the words acceptance would return. It
 * never re-derives fit or overlap: the planner owns the verdict, this only
 * names it.
 */
export function openingRepeatRefusalWords(
	document: LayoutDocumentWallFirst,
	rejection: DuplicateRejection,
	attempt: OpeningRepeatRefusalAttempt
): string {
	if (rejection.code === 'count_out_of_range') {
		return 'Repeat takes a whole number of copies from 1 to 50.';
	}
	if (rejection.code === 'invalid_value') {
		return 'Spacing must be one finite number of metres from the original.';
	}
	if (rejection.code === 'unknown_opening') {
		return 'That Opening is gone. Select its Wall and try again.';
	}
	if (rejection.code === 'captured_id_in_use') {
		return 'That identity is already taken. Start the repeat again.';
	}
	const source = document.openings.find((opening) => opening.id === attempt.openingId);
	const length = source === undefined ? undefined : wallFirstWallLength(document, source.wallId);
	const issue = rejection.issues?.[0];
	if (source !== undefined && length !== undefined && length !== null) {
		const copyCount = Number.isInteger(attempt.count) && attempt.count >= 0 ? attempt.count : 0;
		const furthestStart = attempt.spacing < 0 ? attempt.spacing * copyCount : 0;
		const furthestEnd = source.offset + source.width + (attempt.spacing > 0 ? attempt.spacing * copyCount : 0);
		const earliestStart = source.offset + Math.min(0, furthestStart);
		if (issue !== undefined && issue.code === 'opening_overlap') {
			return 'A copy would collide with another Opening on this Wall. Increase the spacing or choose a clear stretch.';
		}
		if (issue !== undefined && issue.code === 'opening_exceeds_wall_height') {
			return `This ${kindWords(source.kind)} is taller than the Wall, so a copy cannot fit either. Lower it or raise the Wall.`;
		}
		if (issue !== undefined && issue.code === 'opening_exceeds_wall' && attempt.spacing < 0 && earliestStart < 0) {
			return `The last copy would start ${meters(earliestStart)} before the ${meters(length)} Wall. Reduce the count or the spacing.`;
		}
		if (issue !== undefined && issue.code === 'opening_exceeds_wall' && furthestEnd > length) {
			return `The last copy would end ${meters(furthestEnd - length)} past the ${meters(length)} Wall. Reduce the count or the spacing.`;
		}
	}
	if (rejection.code === 'opening_set_invalid') {
		return 'These copies would not all fit this Wall. Reduce the count or the spacing.';
	}
	if (rejection.code === 'portal_relation_invalid' || rejection.code === 'external_portal_relation') {
		return 'These copies would break the connection between Rooms.';
	}
	if (rejection.code === 'invalid_candidate_document' || rejection.code === 'candidate_does_not_compile' || rejection.code === 'topology_invalid') {
		return 'These copies are not a valid Opening set. Reduce the count or the spacing.';
	}
	return 'These copies were refused. Adjust the count or the spacing and try again.';
}

export type OpeningRepeatPreview =
	| {
			readonly kind: 'planned';
			/** The planner's complete candidate document, generated ids included. */
			readonly document: LayoutDocumentWallFirst;
			readonly wallId: string;
			readonly sourceOpening: LayoutWallOpening;
			readonly createdOpeningIds: readonly string[];
	  }
	| { readonly kind: 'refused'; readonly message: string };

/**
 * The proposal both the Card and the Stage read, computed by the planner that
 * acceptance will run. Preview allocation is its own capture: ids are never
 * reused from a preview by a commit, and neither path mutates the baseline.
 */
export function previewOpeningRepeat(input: {
	readonly document: LayoutDocumentWallFirst;
	readonly openingId: string;
	readonly count: number;
	readonly spacing: number;
	readonly capture?: LayoutIdCapture;
}): OpeningRepeatPreview {
	const source = input.document.openings.find((opening) => opening.id === input.openingId);
	if (source === undefined) {
		return { kind: 'refused', message: 'That Opening is gone. Select its Wall and try again.' };
	}
	const plan = planRepeatWallOpening(
		input.document,
		{ openingId: input.openingId, count: input.count, spacing: input.spacing },
		input.capture ?? mintLayoutIdCapture(),
		input.document.floor.id
	);
	if (plan.kind === 'rejected') {
		return {
			kind: 'refused',
			message: openingRepeatRefusalWords(input.document, plan.rejection, {
				openingId: input.openingId,
				count: input.count,
				spacing: input.spacing
			})
		};
	}
	return {
		kind: 'planned',
		document: plan.document,
		wallId: source.wallId,
		sourceOpening: source,
		createdOpeningIds: plan.createdOpeningIds
	};
}

function openingRepeatPlanner(): DomainPlanner<ProjectEnvelope> {
	return layoutPlanner(LAYOUT_OPENING_REPEAT_KIND, (request) => {
		const payload = readRepeatPayload(request.intent.payload);
		if ('message' in payload) return refused(payload.message);
		const { openingId, count, spacing } = payload;
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
			return refused('An Opening repeat addresses exactly one Opening.');
		}
		const target = request.intent.targets[0]!;
		if (target.domain !== 'layout' || target.subject.kind !== 'opening' || target.subject.id !== openingId) {
			return refused(`The intent must address the Opening "${openingId}" it repeats.`);
		}
		const source = baseline.openings.find((opening) => opening.id === openingId);
		if (source === undefined) return refused(`Unknown Opening "${openingId}".`);
		const plan = planRepeatWallOpening(baseline, { openingId, count, spacing }, capture, levelId);
		if (plan.kind === 'rejected') {
			return {
				kind: 'rejected',
				code: plan.rejection.code,
				message: openingRepeatRefusalWords(baseline, plan.rejection, { openingId, count, spacing }),
				diagnostics: []
			};
		}
		const createdOpeningIds = plan.createdOpeningIds;
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
					kind: LAYOUT_OPENING_REPEAT_KIND,
					subjectIds: [openingId, ...createdOpeningIds],
					fields: ['openings']
				}
			],
			correspondence: [
				// The source Opening keeps its id, station and every authored value.
				{
					relation: 'preserved',
					before: layoutSubjectReference({ kind: 'opening', id: openingId, contentRevision, levelId }),
					after: layoutSubjectReference({ kind: 'opening', id: openingId, contentRevision, levelId })
				},
				// Every copy is a new Opening created from that source, in copy order.
				...createdOpeningIds.map((id) => ({
					relation: 'created' as const,
					before: null,
					after: layoutSubjectReference({ kind: 'opening', id, contentRevision, levelId })
				}))
			],
			diagnostics: []
		};
		return { kind: 'prepared', candidate };
	});
}

export function createOpeningRepeatPlanners(): readonly DomainPlanner<ProjectEnvelope>[] {
	return [openingRepeatPlanner()];
}

/** The F.4 intent for one Opening repeat, with its captured identity and level. */
export function openingRepeatIntent(input: {
	readonly openingId: string;
	readonly count: number;
	readonly spacing: number;
	readonly capture: LayoutIdCapture;
	readonly operationId: string;
	readonly projectId: string;
	readonly revisionId: string;
	readonly contentRevision: string;
	readonly levelId: string;
}): AuthoringIntent {
	return {
		version: 1,
		kind: LAYOUT_OPENING_REPEAT_KIND,
		operationId: input.operationId,
		expectedRevision: { projectId: input.projectId, revisionId: input.revisionId },
		targets: [
			layoutSubjectReference({
				kind: 'opening',
				id: input.openingId,
				contentRevision: input.contentRevision,
				levelId: input.levelId
			})
		],
		payload: { openingId: input.openingId, count: input.count, spacing: input.spacing },
		capturedInputs: [layoutWorkingLevelInput(input.levelId), layoutIdCaptureInput(input.capture)],
		allocatedIds: []
	};
}
