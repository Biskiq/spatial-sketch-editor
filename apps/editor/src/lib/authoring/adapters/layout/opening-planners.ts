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

function finiteNonNegative(value: unknown): value is number {
	return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function finitePositive(value: unknown): value is number {
	return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function exactKeys(
	payload: unknown,
	expected: readonly string[]
): { value: Record<string, unknown> } | { message: string } {
	if (!isRecord(payload)) return { message: 'The Opening operation payload must be an object.' };
	const unknown = Object.keys(payload).filter((key) => !expected.includes(key));
	if (unknown.length > 0) {
		return { message: `The Opening operation payload cannot carry ${unknown.join(', ')}.` };
	}
	for (const key of expected) {
		if (!(key in payload)) return { message: `The Opening operation payload is missing "${key}".` };
	}
	return { value: payload };
}

function readCreatePayload(
	payload: unknown
): OpeningCreatePayload | { readonly message: string } {
	const parsed = exactKeys(payload, ['wallId', 'kind', 'offset', 'width', 'height', 'sillHeight']);
	if ('message' in parsed) return parsed;
	const { wallId, kind, offset, width, height, sillHeight } = parsed.value;
	if (typeof wallId !== 'string' || wallId.length === 0) {
		return { message: 'An Opening placement needs one host wall id.' };
	}
	if (kind !== 'door' && kind !== 'window') {
		return { message: 'An Opening placement supports a door or a window.' };
	}
	if (!finiteNonNegative(offset)) {
		return { message: 'An Opening offset must be a finite non-negative number of meters.' };
	}
	if (!finitePositive(width) || !finitePositive(height)) {
		return { message: 'An Opening width and height must be finite positive numbers of meters.' };
	}
	if (!finiteNonNegative(sillHeight)) {
		return { message: 'An Opening sill must be a finite non-negative number of meters.' };
	}
	return { wallId, kind, offset, width, height, sillHeight };
}

function readDeletePayload(
	payload: unknown
): OpeningDeletePayload | { readonly message: string } {
	const parsed = exactKeys(payload, ['openingId']);
	if ('message' in parsed) return parsed;
	const { openingId } = parsed.value;
	if (typeof openingId !== 'string' || openingId.length === 0) {
		return { message: 'An Opening deletion needs one opening id.' };
	}
	return { openingId };
}

/** The host Wall's own length, or `undefined` when its span is unresolved. */
function hostLength(document: LayoutDocumentWallFirst, wallId: string): number | undefined {
	return wallFirstWallLength(document, wallId);
}

function kindWords(kind: OpeningKind): string {
	return kind === 'door' ? 'door' : 'window';
}

function meters(value: number): string {
	return `${value.toFixed(2)} m`;
}

/**
 * The creator-facing refusal and repair for one rejected Opening operation.
 *
 * Composed from the canonical rejection (code, target ids and the planner's own
 * issue) plus the exact attempted metrics; it never re-derives whether the
 * Opening fits. Preview, palette and acceptance all call this, so the words the
 * creator reads before the gesture are the words acceptance would return.
 */
export function openingRefusalWords(
	document: LayoutDocumentWallFirst,
	rejection: WallOpeningRejection,
	attempt: Partial<OpeningCreatePayload> & { readonly openingId?: string } = {}
): string {
	const wallId = attempt.wallId ?? rejection.targetIds?.[0];
	const wall = wallId === undefined ? undefined : document.walls.find((entry) => entry.id === wallId);
	const length = wallId === undefined ? undefined : hostLength(document, wallId);
	const kind = attempt.kind === undefined ? 'Opening' : kindWords(attempt.kind);
	const firstIssueCode = rejection.issues?.[0]?.code;

	if (rejection.code === 'unknown_wall') {
		return 'That Wall is no longer in the project. Aim at a Wall that is still there.';
	}
	if (rejection.code === 'unknown_opening') {
		return 'That Opening is no longer in the project. Select its Wall and try again.';
	}
	if (rejection.code === 'no_op') {
		return 'That Opening already has those values.';
	}
	if (rejection.code === 'captured_id_in_use') {
		return 'This placement reuses an identity that is already taken. Start the placement again.';
	}
	if (firstIssueCode === 'opening_exceeds_wall') {
		if (length !== undefined && attempt.offset !== undefined && attempt.width !== undefined) {
			const overrun = attempt.offset + attempt.width - length;
			return `This ${kind} would end ${meters(overrun)} past the end of the ${meters(length)} Wall. Move it ${meters(overrun)} earlier or narrow it.`;
		}
		return `This ${kind} does not fit its Wall. Move it earlier along the Wall or narrow it.`;
	}
	if (firstIssueCode === 'opening_exceeds_wall_height') {
		if (wall !== undefined && attempt.height !== undefined && attempt.sillHeight !== undefined) {
			return `This ${meters(attempt.height)} ${kind} with a ${meters(attempt.sillHeight)} sill does not fit the ${meters(wall.height)} Wall. Shorten the Opening or raise the Wall in its Card.`;
		}
		return `This ${kind} is taller than its host Wall. Shorten it or raise the Wall in its Card.`;
	}
	if (firstIssueCode === 'opening_overlap') {
		return `This ${kind} overlaps another Opening on the Wall. Aim clear of it or narrow the Opening.`;
	}
	if (firstIssueCode === 'opening_host_wall_unresolved') {
		return 'That Wall has no resolvable span. Repair the Wall or place the Opening on another Wall.';
	}
	if (rejection.code === 'invalid_value') {
		return 'Check the Offset and size: offset and sill must be non-negative, width and height positive.';
	}
	if (rejection.code === 'candidate_does_not_compile' || rejection.code === 'invalid_candidate_document') {
		return `That Wall cannot carry this ${kind}. Move it to another Wall or adjust its size.`;
	}
	return `That ${kind} was refused. Adjust its host or size and try again.`;
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

/** The F.4 intent for one Opening placement, addressed at its host Wall. */
export function openingCreateIntent(input: {
	readonly payload: OpeningCreatePayload;
	readonly capture: LayoutIdCapture;
	readonly operationId: string;
	readonly projectId: string;
	readonly revisionId: string;
	readonly contentRevision: string;
	readonly levelId: string;
}): AuthoringIntent {
	return {
		version: 1,
		kind: LAYOUT_OPENING_CREATE_KIND,
		operationId: input.operationId,
		expectedRevision: { projectId: input.projectId, revisionId: input.revisionId },
		targets: [
			layoutSubjectReference({
				kind: 'wall',
				id: input.payload.wallId,
				contentRevision: input.contentRevision,
				levelId: input.levelId
			})
		],
		payload: {
			wallId: input.payload.wallId,
			kind: input.payload.kind,
			offset: input.payload.offset,
			width: input.payload.width,
			height: input.payload.height,
			sillHeight: input.payload.sillHeight
		},
		capturedInputs: [
			layoutWorkingLevelInput(input.levelId),
			layoutIdCaptureInput(input.capture)
		],
		allocatedIds: []
	};
}

/** The F.4 intent for one Opening deletion, addressed at the Opening. */
export function openingDeleteIntent(input: {
	readonly openingId: string;
	readonly capture: LayoutIdCapture;
	readonly operationId: string;
	readonly projectId: string;
	readonly revisionId: string;
	readonly contentRevision: string;
	readonly levelId: string;
}): AuthoringIntent {
	return {
		version: 1,
		kind: LAYOUT_OPENING_DELETE_KIND,
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
		payload: { openingId: input.openingId },
		capturedInputs: [
			layoutWorkingLevelInput(input.levelId),
			layoutIdCaptureInput(input.capture)
		],
		allocatedIds: []
	};
}
