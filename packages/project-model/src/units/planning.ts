/**
 * `F4.intent-acceptance@1:unit-acceptance-v1` — the F.2 candidate planners.
 *
 * The slice's authored operations, one deterministic shape each:
 *
 * - `camera-view-update` rewrites one Camera View's label/pose/FOV. The View's
 *   connectivity is **not** editable here: changing adjacency requires a
 *   connection record, and that is a Camera graph operation this slice does not
 *   invent.
 * - `experience-create` creates one empty Experience — explicitly, never as an
 *   implicit document created by a first edit.
 * - `experience-capture-bind` creates one Camera View, one Presentation bound to
 *   it as its Default, and, when the payload asks, one Stop inserted into an
 *   existing Guide — one candidate, one acceptance, one undo.
 * - `experience-stop-create` reuses an existing Presentation at a distinct Stop
 *   in a Guide. The Stop's entry View is its own identity, so the same
 *   Presentation may be entered at a different View at another Stop.
 * - `experience-guide-order` reorders a Guide's Stops by stable identity. It is a
 *   permutation of the authored order, never an insert, a removal or an
 *   index-keyed move, and it is the only order writer.
 * - `experience-presentation-update` and `experience-stop-update` edit the bounded
 *   editorial fields: a Presentation's label, text, subject and Default (a newly
 *   captured View rebinds it deliberately), and a Stop's entry View, hold and
 *   continuation edge (including its Cut/Travel selector).
 *
 * Everything a planner needs is supplied: the captured ids arrive in
 * `intent.allocatedIds`, the payload is read strictly (unknown keys refuse), and
 * every pre-existing subject it names is resolved against the **same** envelope
 * the candidate is built from. A planner never hashes (unit content revisions
 * are derived and normalized by the acceptance adapter), never allocates an id,
 * never reads a clock and never installs.
 *
 * Runtime-safe: no editor, renderer, Svelte or Three import.
 */

import { ShapeReader, type ShapeIssue } from '../strict-shape';
import type { SemanticReference } from '../references/types';
import { validateSemanticReference } from '../references/validate';
import { createUnitReadContext } from '../references/unit-resolution';
import type {
	AcceptanceSourceAdapter,
	AcceptedSnapshot,
	AuthoringIntent,
	CapturedInput,
	DomainPlanner,
	PlannerOutcome,
	PlannerRequest,
	OperationChange,
	CorrespondenceEntry
} from '../f4/types';
import type { PlannerRegistry, PrepareResult } from '../f4/prepare';
import { createUnitPlannerRegistry } from '../f4/unit-acceptance';
import {
	createUnitAcceptanceAdapter,
	createUnitAcceptancePreparation
} from './acceptance';
import { stageUnitResources, type StagedUnitResource } from './acceptance-staging';
import {
	CAMERA_UNIT_FORMAT_VERSION,
	EXPERIENCE_TEXT_KINDS,
	EXPERIENCE_TEXT_MAX_LENGTH,
	EXPERIENCE_TRANSITIONS,
	EXPERIENCE_UNIT_FORMAT_VERSION,
	type CameraView,
	type Experience,
	type ExperienceContinuation,
	type ExperienceGuide,
	type ExperiencePresentation,
	type ExperiencePresentationText,
	type ExperienceStop,
	type ExperienceTransitionKind,
	type ProjectEnvelope,
	type ResourcePin,
	type TypedResource,
	RESOURCE_UNIT_FORMAT_VERSION
} from './types';

import { UNIT_SOURCE_KIND, UNIT_SOURCE_VERSION } from './source';

/** The single-domain Camera View operation kind. */
export const CAMERA_VIEW_UPDATE_KIND = 'camera-view-update';
/** Create one empty Experience. */
export const EXPERIENCE_CREATE_KIND = 'experience-create';
/** Capture a View and bind a Presentation (and optionally one Stop) to it. */
export const EXPERIENCE_CAPTURE_BIND_KIND = 'experience-capture-bind';
/** Reuse an existing Presentation at a distinct Stop. */
export const EXPERIENCE_STOP_CREATE_KIND = 'experience-stop-create';
/** Reorder a Guide's Stops by stable identity. */
export const EXPERIENCE_GUIDE_ORDER_KIND = 'experience-guide-order';
/** Edit one Presentation's label, text, subject or Default View. */
export const EXPERIENCE_PRESENTATION_UPDATE_KIND = 'experience-presentation-update';
/** Edit one Stop's entry View, hold or continuation edge. */
export const EXPERIENCE_STOP_UPDATE_KIND = 'experience-stop-update';

/** The captured staging input name; the value is the staging set the host uploaded. */
export const STAGED_RESOURCES_INPUT = 'staged-resources-v1';

type PrepareFailure = Extract<PlannerOutcome<ProjectEnvelope>, { kind: 'rejected' }>;

function refuse(code: string, message: string, diagnostics: readonly ShapeIssue[] = []): PrepareFailure {
	return { kind: 'rejected', code, message, diagnostics };
}

function envelopeOf(request: PlannerRequest<ProjectEnvelope>): ProjectEnvelope {
	return request.snapshot.domain.source;
}

function revisionOf(envelope: ProjectEnvelope, domain: 'camera' | 'experience' | 'resources'): string {
	return envelope.units[domain].header.contentRevision;
}

/** One deterministic lock order: domain, subject kind, subject id, instance path. */
function compareLockEntries(
	left: ProjectEnvelope['dependencyLock']['entries'][number],
	right: ProjectEnvelope['dependencyLock']['entries'][number]
): number {
	const key = (entry: ProjectEnvelope['dependencyLock']['entries'][number]) =>
		[entry.domain, entry.subjectKind, entry.subjectId, entry.instancePath.join('\u0000')].join('\u0001');
	return key(left).localeCompare(key(right));
}

function reference(
	domain: SemanticReference['domain'],
	subjectKind: string,
	subjectId: string,
	instancePath: readonly string[],
	contentRevision: string
): SemanticReference {
	return {
		version: 1,
		domain,
		revision: { kind: 'exact', contentRevision },
		subject: { kind: subjectKind, id: subjectId },
		instancePath,
		location: { kind: 'project-root' },
		componentId: null,
		capabilityId: null
	};
}

function targetOf(intent: PlannerRequest<ProjectEnvelope>['intent'], domain: string, subjectKind: string): SemanticReference | null {
	const matches = intent.targets.filter((target) => target.domain === domain && target.subject.kind === subjectKind);
	return matches.length === 1 ? matches[0]! : null;
}

/** Captured ids are the only source of new identity; a missing or extra one refuses. */
function capturedId(intent: PlannerRequest<ProjectEnvelope>['intent'], kind: string): string | null {
	const matches = intent.allocatedIds.filter((entry) => entry.kind === kind);
	return matches.length === 1 ? matches[0]!.id : null;
}

function allIds(envelope: ProjectEnvelope): Set<string> {
	const ids = new Set<string>();
	for (const unit of Object.values(envelope.units)) ids.add(unit.header.unitId);
	for (const view of envelope.units.camera.data.views) ids.add(view.id);
	for (const connection of envelope.units.camera.data.connections) ids.add(connection.id);
	for (const experience of envelope.units.experience.data.experiences) {
		ids.add(experience.id);
		for (const item of [...experience.presentations, ...experience.stops, ...experience.guides, ...experience.gates, ...experience.detours]) {
			ids.add(item.id);
		}
	}
	for (const resource of envelope.units.resources.data.resources) ids.add(`${resource.kind}:${resource.id}`);
	return ids;
}

const VIEW_POSE_KEYS = ['label', 'eye', 'target', 'fov'] as const;

type ViewPose = { readonly label: string; readonly eye: [number, number, number]; readonly target: [number, number, number]; readonly fov: number };

function readViewPose(reader: ShapeReader, input: unknown, path: string): ViewPose | null {
	const record = reader.object(input, path, VIEW_POSE_KEYS);
	if (record === null) return null;
	const label = reader.string(record.label, `${path}.label`);
	const eye = reader.vector3(record.eye, `${path}.eye`);
	const target = reader.vector3(record.target, `${path}.target`);
	const fov = reader.numberAtLeast(record.fov, `${path}.fov`, 0, true);
	if (label === null || eye === null || target === null || fov === null) return null;
	return { label, eye, target, fov };
}

const UPDATE_PAYLOAD_KEYS = VIEW_POSE_KEYS;

/**
 * Rewrite one existing Camera View's authored pose and label.
 *
 * Targets: exactly one `camera:view` reference. The View must exist in the
 * envelope the dispatch validated; connectivity is preserved verbatim, because
 * changing it is a Camera connection operation with its own validation.
 */
export function createCameraViewUpdatePlanner(): DomainPlanner<ProjectEnvelope> {
	return {
		id: 'unit.camera-view-update',
		kind: CAMERA_VIEW_UPDATE_KIND,
		admission: { domain: 'camera', compound: false, units: true, resources: false },
		sourceKinds: [UNIT_SOURCE_KIND],
		sourceVersions: [UNIT_SOURCE_VERSION],
		prepare(request) {
			const envelope = envelopeOf(request);
			const reader = new ShapeReader();
			const pose = readViewPose(reader, request.intent.payload, '$.payload');
			if (pose === null) return refuse('invalid-payload', 'The Camera View payload is not a valid pose', reader.issues);
			const target = targetOf(request.intent, 'camera', 'view');
			if (target === null) {
				return refuse('unsupported-operation', 'camera-view-update targets exactly one camera:view reference');
			}
			const index = envelope.units.camera.data.views.findIndex((view) => view.id === target.subject.id);
			if (index === -1) {
				return refuse('missing-target', `camera view "${target.subject.id}" is not in this envelope`);
			}
			const previous = envelope.units.camera.data.views[index]!;
			const views = envelope.units.camera.data.views.map((view) =>
				view.id === previous.id ? { ...view, label: pose.label, eye: pose.eye, target: pose.target, fov: pose.fov } : view
			);
			const cameraData = { formatVersion: CAMERA_UNIT_FORMAT_VERSION, views, connections: envelope.units.camera.data.connections };
			const candidate: ProjectEnvelope = {
				...envelope,
				units: {
					...envelope.units,
					camera: { header: { ...envelope.units.camera.header }, data: cameraData }
				}
			};
			const changes: OperationChange[] = [
				{ kind: 'camera.view.updated', subjectIds: [previous.id], fields: ['label', 'eye', 'target', 'fov'] }
			];
			const correspondence: CorrespondenceEntry[] = [
				{
					relation: 'preserved',
					before: reference('camera', 'view', previous.id, [], revisionOf(envelope, 'camera')),
					after: reference('camera', 'view', previous.id, [], revisionOf(candidate, 'camera'))
				}
			];
			return { kind: 'prepared', candidate: { operationId: request.intent.operationId, sourceKind: request.snapshot.sourceKind, sourceVersion: request.snapshot.sourceVersion, source: candidate, changes, correspondence, diagnostics: [] } };
		}
	};
}

/* --- shared payload readers ------------------------------------------------ */

const CONTINUATION_KEYS = ['kind', 'stopId', 'transition'] as const;
const STOP_PAYLOAD_KEYS = ['holdSeconds', 'continuation', 'guideId', 'afterStopId'] as const;
const COMPOUND_PAYLOAD_KEYS = ['view', 'presentation', 'stop', 'resource'] as const;
const PRESENTATION_PAYLOAD_KEYS = ['label', 'subject', 'text'] as const;
const TEXT_KEYS = ['kind', 'body'] as const;
const RESOURCE_UPDATE_KEYS = ['contentRevision', 'pin'] as const;

type ResourceUpdate = { readonly contentRevision: string | null; readonly pin: ResourcePin | null };

/** Read the optional staged-resource change; at least one identity is required. */
function readResourceUpdate(reader: ShapeReader, input: unknown, path: string): ResourceUpdate | null {
	const record = reader.object(input, path, RESOURCE_UPDATE_KEYS);
	if (record === null) return null;
	const contentRevision = record.contentRevision === undefined || record.contentRevision === null
		? null
		: reader.opaqueId(record.contentRevision, `${path}.contentRevision`);
	const pin = record.pin === undefined || record.pin === null ? null : readPin(reader, record.pin, `${path}.pin`);
	if (contentRevision === null && pin === null) {
		reader.problem(path, 'missing-resource-identity', `${path} must name a content revision, an external-bytes pin, or both`);
		return null;
	}
	if ((record.contentRevision !== undefined && record.contentRevision !== null && contentRevision === null) || (record.pin !== undefined && record.pin !== null && pin === null)) {
		return null;
	}
	return { contentRevision, pin };
}

/** One Presentation's plain text: the closed kind set, bounded at 4,000 code points. */
function readTextPayload(reader: ShapeReader, input: unknown, path: string): ExperiencePresentationText | null {
	const record = reader.object(input, path, TEXT_KEYS);
	if (record === null) return null;
	const kind = reader.tag(record.kind, `${path}.kind`, EXPERIENCE_TEXT_KINDS);
	const body = reader.string(record.body, `${path}.body`);
	if (kind === null || body === null) return null;
	const length = [...body].length;
	if (length > EXPERIENCE_TEXT_MAX_LENGTH) {
		reader.problem(
			`${path}.body`,
			'text-too-long',
			`${path}.body carries ${length} characters; Presentation text is bounded at ${EXPERIENCE_TEXT_MAX_LENGTH}`
		);
		return null;
	}
	return { kind: 'plain', body };
}

type SubjectRead =
	| { readonly ok: true; readonly value: SemanticReference | null }
	| { readonly ok: false };

/** A Presentation subject is a whole Scene entity or Layout element, no component. */
function readSubjectPayload(reader: ShapeReader, input: unknown, path: string): SubjectRead {
	if (input === null) return { ok: true, value: null };
	const read = validateSemanticReference(input);
	if (!read.success) {
		for (const issue of read.issues) reader.problem(`${path}${issue.path.slice(1)}`, issue.code, issue.message);
		return { ok: false };
	}
	if (read.value.componentId !== null) {
		reader.problem(`${path}.componentId`, 'component-not-admitted', 'a Presentation subject names a whole subject; a component-scoped reference is not admitted');
		return { ok: false };
	}
	if (read.value.domain !== 'scene' && read.value.domain !== 'layout') {
		reader.problem(`${path}.domain`, 'unsupported-subject-domain', `a Presentation subject resolves to a Scene entity or a Layout element; "${read.value.domain}" is neither`);
		return { ok: false };
	}
	return { ok: true, value: read.value };
}

function readTransition(reader: ShapeReader, input: unknown, path: string, kind: 'sequence-next' | 'stop' | 'end'): ExperienceTransitionKind | null {
	if (kind === 'end') {
		if (input !== undefined) {
			reader.problem(path, 'unknown-key', `${path} is not part of the end continuation`);
			return null;
		}
		return 'cut';
	}
	if (input === undefined) return 'cut';
	return reader.tag(input, path, EXPERIENCE_TRANSITIONS) as ExperienceTransitionKind | null;
}

function readContinuation(reader: ShapeReader, input: unknown, path: string): ExperienceContinuation | null {
	const record = reader.object(input, path, CONTINUATION_KEYS);
	if (record === null) return null;
	const kind = reader.tag(record.kind, `${path}.kind`, ['sequence-next', 'stop', 'end']);
	if (kind === null) return null;
	if (kind === 'end') {
		if (readTransition(reader, record.transition, `${path}.transition`, 'end') === null) return null;
		return { kind: 'end' };
	}
	const transition = readTransition(reader, record.transition, `${path}.transition`, kind as 'sequence-next' | 'stop');
	if (transition === null) return null;
	if (kind === 'sequence-next') {
		if (record.stopId !== undefined) reader.problem(`${path}.stopId`, 'unknown-key', `${path}.stopId is not part of the sequence-next continuation`);
		return { kind: 'sequence-next', transition };
	}
	const stopId = reader.opaqueId(record.stopId, `${path}.stopId`);
	if (stopId === null) return null;
	return { kind: 'stop', stopId, transition };
}

type StopPayload = {
	readonly holdSeconds: number | undefined;
	readonly continuation: ExperienceContinuation | undefined;
	readonly guideId: string;
	readonly afterStopId: string | null;
};

function readStopPayload(reader: ShapeReader, input: unknown, path: string): StopPayload | null {
	const record = reader.object(input, path, STOP_PAYLOAD_KEYS);
	if (record === null) return null;
	const holdSeconds = record.holdSeconds === undefined ? undefined : reader.numberAtLeast(record.holdSeconds, `${path}.holdSeconds`, 0, false);
	const continuation = record.continuation === undefined ? undefined : readContinuation(reader, record.continuation, `${path}.continuation`);
	const guideId = reader.opaqueId(record.guideId, `${path}.guideId`);
	let afterStopId: string | null = null;
	if (record.afterStopId !== undefined && record.afterStopId !== null) {
		const parsed = reader.opaqueId(record.afterStopId, `${path}.afterStopId`);
		if (parsed === null) return null;
		afterStopId = parsed;
	}
	if (holdSeconds === null || continuation === null || guideId === null) return null;
	return { holdSeconds: holdSeconds ?? undefined, continuation: continuation ?? undefined, guideId, afterStopId };
}

const PIN_KEYS = ['hash', 'mime', 'size', 'locator'] as const;

function readPin(reader: ShapeReader, input: unknown, path: string): ResourcePin | null {
	if (input === null) return null;
	const record = reader.object(input, path, PIN_KEYS);
	if (record === null) return null;
	const hash = reader.opaqueId(record.hash, `${path}.hash`);
	const mime = reader.string(record.mime, `${path}.mime`);
	const size = reader.integerAtLeast(record.size, `${path}.size`, 0);
	const locator = reader.string(record.locator, `${path}.locator`);
	if (hash === null || mime === null || size === null || locator === null) return null;
	return { hash, mime, size, locator };
}

/** Read the host-captured staging set exactly; it is compared, never trusted. */
function readCapturedStaging(reader: ShapeReader, input: unknown): StagedUnitResource[] | null {
	if (!Array.isArray(input)) {
		reader.problem('$.capturedInputs.staged', 'not-an-array', 'the captured staging set must be an array');
		return null;
	}
	const result: StagedUnitResource[] = [];
	for (const [index, entry] of input.entries()) {
		const path = `$.capturedInputs.staged[${index}]`;
		const record = reader.object(entry, path, ['kind', 'id', 'contentRevision', 'pin']);
		if (record === null) return null;
		const kind = reader.string(record.kind, `${path}.kind`);
		const id = reader.opaqueId(record.id, `${path}.id`);
		const contentRevision = reader.opaqueId(record.contentRevision, `${path}.contentRevision`);
		const pin = record.pin === undefined || record.pin === null ? null : readPin(reader, record.pin, `${path}.pin`);
		if (kind === null || id === null || contentRevision === null || (record.pin !== null && record.pin !== undefined && pin === null)) return null;
		result.push({ kind, id, contentRevision, pin });
	}
	return result;
}

function sameStaging(left: readonly StagedUnitResource[], right: readonly StagedUnitResource[]): boolean {
	const key = (item: StagedUnitResource) => `${item.kind}:${item.id}`;
	const sortedLeft = [...left].sort((a, b) => key(a).localeCompare(key(b)));
	const sortedRight = [...right].sort((a, b) => key(a).localeCompare(key(b)));
	if (sortedLeft.length !== sortedRight.length) return false;
	return sortedLeft.every((item, index) => {
		const other = sortedRight[index]!;
		if (key(item) !== key(other) || item.contentRevision !== other.contentRevision) return false;
		if (item.pin === null || other.pin === null) return item.pin === other.pin;
		// A pin is four facts. Comparing only its hash would admit different bytes
		// under one content identity.
		return (
			item.pin.hash === other.pin.hash &&
			item.pin.mime === other.pin.mime &&
			item.pin.size === other.pin.size &&
			item.pin.locator === other.pin.locator
		);
	});
}

/* --- Experience creation --------------------------------------------------- */

const CREATE_PAYLOAD_KEYS = ['label'] as const;

/**
 * Create one empty Experience.
 *
 * Targets: none. The Experience unit is a collection, so creating a second one
 * over the same world is an explicit operation rather than an implicit edit; the
 * new Experience enters nothing until a Guide exists (`entryGuideId` is null).
 */
export function createExperienceCreatePlanner(): DomainPlanner<ProjectEnvelope> {
	return {
		id: 'unit.experience-create',
		kind: EXPERIENCE_CREATE_KIND,
		admission: { domain: 'experience', compound: false, units: true, resources: false },
		sourceKinds: [UNIT_SOURCE_KIND],
		sourceVersions: [UNIT_SOURCE_VERSION],
		prepare(request) {
			const envelope = envelopeOf(request);
			const reader = new ShapeReader();
			const payload = reader.object(request.intent.payload, '$.payload', CREATE_PAYLOAD_KEYS);
			if (payload === null) return refuse('invalid-payload', 'The Experience payload is not a valid shape', reader.issues);
			const label = reader.string(payload.label, '$.payload.label');
			if (label === null) return refuse('invalid-payload', 'The Experience payload is not a valid shape', reader.issues);
			const experienceId = capturedId(request.intent, 'experience');
			if (experienceId === null) {
				return refuse('unsupported-operation', 'the intent must capture exactly one experience id');
			}
			if (allIds(envelope).has(experienceId)) {
				return refuse('duplicate-identity', `the captured id "${experienceId}" already names a subject in this envelope`);
			}
			const created: Experience = {
				id: experienceId,
				label,
				entryGuideId: null,
				presentations: [],
				stops: [],
				guides: [],
				gates: [],
				detours: []
			};
			const candidate: ProjectEnvelope = {
				...envelope,
				units: {
					...envelope.units,
					experience: {
						header: { ...envelope.units.experience.header },
						data: {
							formatVersion: EXPERIENCE_UNIT_FORMAT_VERSION,
							experiences: [...envelope.units.experience.data.experiences, created]
						}
					}
				}
			};
			return {
				kind: 'prepared',
				candidate: {
					operationId: request.intent.operationId,
					sourceKind: request.snapshot.sourceKind,
					sourceVersion: request.snapshot.sourceVersion,
					source: candidate,
					changes: [
						{ kind: 'experience.created', subjectIds: [created.id], fields: ['label', 'entryGuideId'] }
					],
					correspondence: [
						{
							relation: 'created',
							before: null,
							after: reference('experience', 'experience', created.id, [], revisionOf(candidate, 'experience'))
						}
					],
					diagnostics: []
				}
			};
		}
	};
}

/* --- Capture and bind ------------------------------------------------------ */

export type CaptureBindOptions = {
	/** Admit a captured resource staging set; the registry must grant it too. */
	readonly resourceStaging?: boolean;
};

/**
 * Capture one Camera View and bind one Presentation — and optionally one Stop —
 * to it.
 *
 * Targets: exactly one `experience:experience` reference (the container the
 * Presentation and Stop join). The captured View becomes the Presentation's only
 * View and its Default, so a bind is always a deliberate capture rather than a
 * side effect of selecting something. Resource targets, when present, must be
 * staged by the host exactly as before; that half is unchanged.
 */
export function createCaptureBindPlanner(
	options: CaptureBindOptions = {}
): DomainPlanner<ProjectEnvelope> {
	return {
		id: 'unit.experience-capture-bind',
		kind: EXPERIENCE_CAPTURE_BIND_KIND,
		admission: {
			domain: 'experience',
			compound: true,
			writes: ['camera'],
			units: true,
			resources: options.resourceStaging === true
		},
		sourceKinds: [UNIT_SOURCE_KIND],
		sourceVersions: [UNIT_SOURCE_VERSION],
		prepare(request) {
			const envelope = envelopeOf(request);
			const reader = new ShapeReader();
			const payload = reader.object(request.intent.payload, '$.payload', COMPOUND_PAYLOAD_KEYS);
			if (payload === null) return refuse('invalid-payload', 'The capture payload is not a valid shape', reader.issues);
			const view = readViewPose(reader, payload.view, '$.payload.view');
			const presentationPayload = reader.object(payload.presentation, '$.payload.presentation', PRESENTATION_PAYLOAD_KEYS);
			const presentationLabel = presentationPayload === null ? null : reader.string(presentationPayload.label, '$.payload.presentation.label');
			const text = presentationPayload === null || presentationPayload.text === null
				? null
				: readTextPayload(reader, presentationPayload.text, '$.payload.presentation.text');
			const subject = presentationPayload === null
				? { ok: false as const }
				: readSubjectPayload(reader, presentationPayload.subject, '$.payload.presentation.subject');
			// An omitted Stop is the explicit "Presentation only" case; a present but
			// malformed Stop is a refusal, not the same absence.
			const requestedStop = payload.stop !== null && payload.stop !== undefined;
			const stop = requestedStop ? readStopPayload(reader, payload.stop, '$.payload.stop') : null;
			const requestedResource = payload.resource !== null && payload.resource !== undefined;
			const resourceUpdate = requestedResource ? readResourceUpdate(reader, payload.resource, '$.payload.resource') : null;
			if (
				view === null ||
				presentationPayload === null ||
				presentationLabel === null ||
				subject.ok === false ||
				(presentationPayload.text !== null && text === null) ||
				(requestedStop && stop === null) ||
				(requestedResource && resourceUpdate === null)
			) {
				return refuse('invalid-payload', 'The capture payload is not a valid shape', reader.issues);
			}
			const resourceTargets = request.intent.targets.filter((candidateTarget) => candidateTarget.domain.startsWith('resource:'));
			if (requestedResource && resourceTargets.length !== 1) {
				return refuse('unsupported-operation', 'a staged resource change targets exactly one resource reference');
			}

			const target = targetOf(request.intent, 'experience', 'experience');
			if (target === null) {
				return refuse('unsupported-operation', 'experience-capture-bind targets exactly one experience:experience reference');
			}
			const experienceIndex = envelope.units.experience.data.experiences.findIndex(
				(candidate) => candidate.id === target.subject.id
			);
			if (experienceIndex === -1) return refuse('missing-target', `experience "${target.subject.id}" is not in this envelope`);
			const experience = envelope.units.experience.data.experiences[experienceIndex]!;

			const viewId = capturedId(request.intent, 'view');
			const presentationId = capturedId(request.intent, 'presentation');
			const stopId = stop === null ? null : capturedId(request.intent, 'stop');
			if (viewId === null || presentationId === null || (stop !== null && stopId === null)) {
				return refuse(
					'unsupported-operation',
					'the intent must capture exactly one view id, one presentation id, and one stop id when a stop is requested'
				);
			}
			const ids = allIds(envelope);
			for (const id of [viewId, presentationId, ...(stopId === null ? [] : [stopId])]) {
				if (ids.has(id)) return refuse('duplicate-identity', `the captured id "${id}" already names a subject in this envelope`);
			}
			if (viewId === presentationId || viewId === stopId || presentationId === stopId) {
				return refuse('duplicate-identity', 'a View, a Presentation and a Stop must have distinct identities');
			}

			let guide: ExperienceGuide | null = null;
			let insertionIndex = -1;
			if (stop !== null) {
				const guideIndex = experience.guides.findIndex((candidate) => candidate.id === stop.guideId);
				if (guideIndex === -1) return refuse('missing-target', `guide "${stop.guideId}" is not in experience "${experience.id}"`);
				guide = experience.guides[guideIndex]!;
				if (stop.afterStopId !== null) {
					const at = guide.stopIds.indexOf(stop.afterStopId);
					if (at === -1) return refuse('missing-target', `guide "${guide.id}" does not order stop "${stop.afterStopId}"`);
					insertionIndex = at + 1;
				} else {
					insertionIndex = guide.stopIds.length;
				}
				const authoredContinuation = stop.continuation;
				if (
					authoredContinuation !== undefined &&
					authoredContinuation.kind === 'stop' &&
					!experience.stops.some((candidate) => candidate.id === authoredContinuation.stopId)
				) {
					return refuse('missing-target', `the new Stop continues to stop "${authoredContinuation.stopId}", which this Experience does not carry`);
				}
			}

			const newView: CameraView = { id: viewId, label: view.label, eye: view.eye, target: view.target, fov: view.fov, connectedViewIds: [] };
			const newPresentation: ExperiencePresentation = {
				id: presentationId,
				label: presentationLabel,
				viewIds: [viewId],
				defaultViewId: viewId,
				subject: subject.value,
				text
			};
			const newStop: ExperienceStop | null =
				stop === null || stopId === null
					? null
					: {
							id: stopId,
							presentationId,
							...(stop.holdSeconds === undefined ? {} : { holdSeconds: stop.holdSeconds }),
							...(stop.continuation === undefined ? {} : { continuation: stop.continuation })
						};
			const guides = experience.guides.map((candidate) =>
				guide !== null && candidate.id === guide.id && newStop !== null
					? { ...candidate, stopIds: [...candidate.stopIds.slice(0, insertionIndex), newStop.id, ...candidate.stopIds.slice(insertionIndex)] }
					: candidate
			);
			const updatedExperience: Experience = {
				...experience,
				presentations: [...experience.presentations, newPresentation],
				stops: newStop === null ? experience.stops : [...experience.stops, newStop],
				guides
			};
			const experiences = envelope.units.experience.data.experiences.map((candidate, index) =>
				index === experienceIndex ? updatedExperience : candidate
			);
			// An optional staged-resource change is applied to the **same candidate**
			// as the Camera/Experience content, including its exact lock entry, so one
			// install carries one resource revision/pin beside the authored change.
			let resources = envelope.units.resources.data.resources;
			let dependencyEntries = envelope.dependencyLock.entries;
			let updatedResource: TypedResource | null = null;
			let resourceTarget: SemanticReference | null = null;
			if (resourceUpdate !== null) {
				const resourceTargetRef = resourceTargets[0]!;
				resourceTarget = resourceTargetRef;
				const resourceKind = resourceTargetRef.domain.slice('resource:'.length);
				const resourceIndex = resources.findIndex(
					(candidate) => candidate.kind === resourceKind && candidate.id === resourceTargetRef.subject.id
				);
				if (resourceIndex === -1) {
					return refuse('missing-target', `resource "${resourceTargetRef.domain}:${resourceTargetRef.subject.id}" is not in this envelope`);
				}
				const previousResource = resources[resourceIndex]!;
				updatedResource = {
					kind: previousResource.kind,
					id: previousResource.id,
					contentRevision: resourceUpdate.contentRevision,
					pin: resourceUpdate.pin,
					unresolved: null
				};
				resources = resources.map((candidate, index) => (index === resourceIndex ? updatedResource! : candidate));
				const previousLock = dependencyEntries.find(
					(entry) =>
						entry.domain === resourceTargetRef.domain &&
						entry.subjectKind === 'resource' &&
						entry.subjectId === previousResource.id &&
						entry.instancePath.length === 0
				);
				dependencyEntries = [
					...dependencyEntries.filter((entry) => entry !== previousLock),
					{
						domain: resourceTargetRef.domain,
						subjectKind: 'resource',
						subjectId: previousResource.id,
						instancePath: [],
						contentRevision: resourceUpdate.contentRevision ?? resourceUpdate.pin!.hash,
						requiredCapabilities: previousLock?.requiredCapabilities ?? [],
						pin: resourceUpdate.pin
					}
				].sort(compareLockEntries);
			}
			const candidate: ProjectEnvelope = {
				...envelope,
				units: {
					...envelope.units,
					camera: {
						header: { ...envelope.units.camera.header },
						data: {
							formatVersion: CAMERA_UNIT_FORMAT_VERSION,
							views: [...envelope.units.camera.data.views, newView],
							connections: envelope.units.camera.data.connections
						}
					},
					experience: {
						header: { ...envelope.units.experience.header },
						data: { formatVersion: EXPERIENCE_UNIT_FORMAT_VERSION, experiences }
					},
					resources: {
						header: { ...envelope.units.resources.header },
						data: { formatVersion: RESOURCE_UNIT_FORMAT_VERSION, resources }
					}
				},
				dependencyLock: { ...envelope.dependencyLock, entries: dependencyEntries }
			};

			// Resource staging is derived from the **accepted snapshot** plus the
			// intent's new identity for a changed resource, and compared with the
			// captured set. A host that uploads bytes for a different revision or pin
			// has not staged this operation, and a target with no capture is refused
			// rather than silently staged from the envelope alone.
			if (resourceTargets.length > 0) {
				const captured = request.intent.capturedInputs.find((input) => input.name === STAGED_RESOURCES_INPUT);
				if (captured === undefined) {
					return refuse('missing-staging', `the intent stages resources but carries no ${STAGED_RESOURCES_INPUT} capture`);
				}
				const capturedStaging = readCapturedStaging(reader, captured.value);
				if (capturedStaging === null) {
					return refuse('invalid-payload', 'The captured staging set is not a valid staging record', reader.issues);
				}
				// The targets were captured against the **accepted** snapshot, so F.1
				// resolution reads that source, its accepted revision and its digest —
				// never the changed candidate carrying the previous snapshot's digest.
				// A changed resource's *new* identity has no source to resolve against
				// before acceptance: it is the intent's authored identity, carried on the
				// candidate registry record, and the captured staging must name exactly
				// it. That binding is host-asserted until a byte store exists.
				const context = createUnitReadContext({
					envelope: request.snapshot.domain.source,
					acceptedRevision: request.snapshot.acceptedRevision,
					sourceContentId: request.snapshot.sourceContentId,
					sessionEpoch: 'unit-planning'
				});
				const acceptedStaging = stageUnitResources(request.snapshot.domain.source, resourceTargets, context);
				if (acceptedStaging.kind === 'refused') {
					return refuse('unresolved-resource', 'The accepted snapshot does not stage every requested resource', acceptedStaging.issues);
				}
				const changedKind = resourceTarget === null ? null : resourceTarget.domain.slice('resource:'.length);
				const derived = {
					resources: acceptedStaging.resources.map((item) =>
						resourceUpdate !== null && resourceTarget !== null && changedKind === item.kind && item.id === resourceTarget.subject.id
							? {
									...item,
									contentRevision: resourceUpdate.contentRevision ?? resourceUpdate.pin!.hash,
									pin: resourceUpdate.pin
								}
							: item
					)
				};
				if (!sameStaging(derived.resources, capturedStaging)) {
					return refuse(
						'invalid-staging',
						'the captured resource staging does not match the accepted staging plus the intent\'s new resource identity'
					);
				}
			} else if (request.intent.capturedInputs.some((input) => input.name === STAGED_RESOURCES_INPUT)) {
				const captured = request.intent.capturedInputs.find((input) => input.name === STAGED_RESOURCES_INPUT)!;
				const capturedStaging = readCapturedStaging(reader, captured.value);
				if (capturedStaging === null) {
					return refuse('invalid-payload', 'The captured staging set is not a valid staging record', reader.issues);
				}
				if (capturedStaging.length > 0) {
					return refuse('invalid-staging', 'the intent captures staged resources but targets none');
				}
			}

			const changes: OperationChange[] = [
				{ kind: 'camera.view.created', subjectIds: [newView.id], fields: ['label', 'eye', 'target', 'fov', 'connectedViewIds'] },
				{
					kind: 'experience.presentation.created',
					subjectIds: [newPresentation.id],
					fields: ['label', 'viewIds', 'defaultViewId', 'subject', 'text']
				}
			];
			const correspondence: CorrespondenceEntry[] = [
				{
					relation: 'created',
					before: null,
					after: reference('camera', 'view', newView.id, [], revisionOf(candidate, 'camera'))
				},
				{
					relation: 'created',
					before: null,
					after: reference('experience', 'presentation', newPresentation.id, [experience.id], revisionOf(candidate, 'experience'))
				}
			];
			if (updatedResource !== null && resourceTarget !== null) {
				changes.push({ kind: 'resource.updated', subjectIds: [updatedResource.id], fields: ['contentRevision', 'pin'] });
				correspondence.push({
					relation: 'replaced',
					before: reference(resourceTarget.domain, 'resource', updatedResource.id, [], resourceTarget.revision.kind === 'exact' ? resourceTarget.revision.contentRevision : ''),
					after: reference(resourceTarget.domain, 'resource', updatedResource.id, [], updatedResource.contentRevision ?? updatedResource.pin!.hash)
				});
			}
			if (newStop !== null) {
				changes.push({ kind: 'experience.stop.created', subjectIds: [newStop.id], fields: ['presentationId', 'entryViewId', 'holdSeconds', 'continuation'] });
				if (guide !== null) changes.push({ kind: 'experience.guide.updated', subjectIds: [guide.id], fields: ['stopIds'] });
				correspondence.push({
					relation: 'created',
					before: null,
					after: reference('experience', 'stop', newStop.id, [experience.id], revisionOf(candidate, 'experience'))
				});
			}
			return {
				kind: 'prepared',
				candidate: {
					operationId: request.intent.operationId,
					sourceKind: request.snapshot.sourceKind,
					sourceVersion: request.snapshot.sourceVersion,
					source: candidate,
					changes,
					correspondence,
					diagnostics: []
				}
			};
		}
	};
}

/* --- Reuse a Presentation at a distinct Stop ------------------------------- */

const STOP_CREATE_PAYLOAD_KEYS = ['presentationId', 'guideId', 'afterStopId', 'entryViewId', 'holdSeconds', 'continuation'] as const;

/**
 * Create one Stop for an existing Presentation and insert it into a Guide.
 *
 * Targets: exactly one `experience:experience` reference. The Stop's entry View
 * is the payload's `entryViewId` or its Presentation's Default, so one
 * Presentation reused at two Stops can enter at two different Views while the
 * holds and continuation edges stay per Stop.
 */
export function createExperienceStopCreatePlanner(): DomainPlanner<ProjectEnvelope> {
	return {
		id: 'unit.experience-stop-create',
		kind: EXPERIENCE_STOP_CREATE_KIND,
		admission: { domain: 'experience', compound: false, units: true, resources: false },
		sourceKinds: [UNIT_SOURCE_KIND],
		sourceVersions: [UNIT_SOURCE_VERSION],
		prepare(request) {
			const envelope = envelopeOf(request);
			const reader = new ShapeReader();
			const payload = reader.object(request.intent.payload, '$.payload', STOP_CREATE_PAYLOAD_KEYS);
			if (payload === null) return refuse('invalid-payload', 'The Stop payload is not a valid shape', reader.issues);
			const presentationId = reader.opaqueId(payload.presentationId, '$.payload.presentationId');
			const guideId = reader.opaqueId(payload.guideId, '$.payload.guideId');
			const entryViewId = payload.entryViewId === undefined
				? undefined
				: reader.opaqueId(payload.entryViewId, '$.payload.entryViewId');
			const entryViewProvided = payload.entryViewId !== undefined;
			const holdSeconds = payload.holdSeconds === undefined
				? undefined
				: reader.numberAtLeast(payload.holdSeconds, '$.payload.holdSeconds', 0, false);
			const continuation = payload.continuation === undefined
				? undefined
				: readContinuation(reader, payload.continuation, '$.payload.continuation');
			let afterStopId: string | null = null;
			if (payload.afterStopId !== undefined && payload.afterStopId !== null) {
				const parsed = reader.opaqueId(payload.afterStopId, '$.payload.afterStopId');
				if (parsed === null) return refuse('invalid-payload', 'The Stop payload is not a valid shape', reader.issues);
				afterStopId = parsed;
			}
			if (
				presentationId === null ||
				guideId === null ||
				(holdSeconds === null && payload.holdSeconds !== undefined) ||
				continuation === null ||
				(entryViewProvided && entryViewId === null)
			) {
				return refuse('invalid-payload', 'The Stop payload is not a valid shape', reader.issues);
			}
			const target = targetOf(request.intent, 'experience', 'experience');
			if (target === null) {
				return refuse('unsupported-operation', 'experience-stop-create targets exactly one experience:experience reference');
			}
			const experienceIndex = envelope.units.experience.data.experiences.findIndex((candidate) => candidate.id === target.subject.id);
			if (experienceIndex === -1) return refuse('missing-target', `experience "${target.subject.id}" is not in this envelope`);
			const experience = envelope.units.experience.data.experiences[experienceIndex]!;
			const presentation = experience.presentations.find((candidate) => candidate.id === presentationId);
			if (presentation === undefined) {
				return refuse('missing-target', `presentation "${presentationId}" is not in experience "${experience.id}"`);
			}
			const guide = experience.guides.find((candidate) => candidate.id === guideId);
			if (guide === undefined) return refuse('missing-target', `guide "${guideId}" is not in experience "${experience.id}"`);
			const entry: string | null = entryViewId ?? presentation.defaultViewId;
			if (entry === null) {
				return refuse('missing-entry', `presentation "${presentation.id}" has no Default View, so a Stop must name its entry View`);
			}
			if (!presentation.viewIds.includes(entry)) {
				return refuse('invalid-payload', `entry view "${entry}" is not one of presentation "${presentation.id}"'s views`);
			}
			if (continuation !== undefined && continuation.kind === 'stop' && !experience.stops.some((candidate) => candidate.id === continuation.stopId)) {
				return refuse('missing-target', `the new Stop continues to stop "${continuation.stopId}", which this Experience does not carry`);
			}
			let insertionIndex = guide.stopIds.length;
			if (afterStopId !== null) {
				const at = guide.stopIds.indexOf(afterStopId);
				if (at === -1) return refuse('missing-target', `guide "${guide.id}" does not order stop "${afterStopId}"`);
				insertionIndex = at + 1;
			}
			const stopId = capturedId(request.intent, 'stop');
			if (stopId === null) {
				return refuse('unsupported-operation', 'the intent must capture exactly one stop id');
			}
			if (allIds(envelope).has(stopId)) {
				return refuse('duplicate-identity', `the captured id "${stopId}" already names a subject in this envelope`);
			}
			const newStop: ExperienceStop = {
				id: stopId,
				presentationId,
				...(entryViewId === undefined || entryViewId === null ? {} : { entryViewId }),
				...(holdSeconds === undefined || holdSeconds === null ? {} : { holdSeconds }),
				...(continuation === undefined || continuation === null ? {} : { continuation })
			};
			const guides = experience.guides.map((candidate) =>
				candidate.id === guide.id
					? {
							...candidate,
							stopIds: [...candidate.stopIds.slice(0, insertionIndex), newStop.id, ...candidate.stopIds.slice(insertionIndex)]
						}
					: candidate
			);
			const updatedExperience: Experience = {
				...experience,
				stops: [...experience.stops, newStop],
				guides
			};
			const candidate: ProjectEnvelope = {
				...envelope,
				units: {
					...envelope.units,
					experience: {
						header: { ...envelope.units.experience.header },
						data: {
							formatVersion: EXPERIENCE_UNIT_FORMAT_VERSION,
							experiences: envelope.units.experience.data.experiences.map((entryExperience, index) =>
								index === experienceIndex ? updatedExperience : entryExperience
							)
						}
					}
				}
			};
			return {
				kind: 'prepared',
				candidate: {
					operationId: request.intent.operationId,
					sourceKind: request.snapshot.sourceKind,
					sourceVersion: request.snapshot.sourceVersion,
					source: candidate,
					changes: [
						{ kind: 'experience.stop.created', subjectIds: [newStop.id], fields: ['presentationId', 'entryViewId', 'holdSeconds', 'continuation'] },
						{ kind: 'experience.guide.updated', subjectIds: [guide.id], fields: ['stopIds'] }
					],
					correspondence: [
						{
							relation: 'created',
							before: null,
							after: reference('experience', 'stop', newStop.id, [experience.id], revisionOf(candidate, 'experience'))
						}
					],
					diagnostics: []
				}
			};
		}
	};
}

/* --- Guide order ----------------------------------------------------------- */

const GUIDE_ORDER_PAYLOAD_KEYS = ['guideId', 'stopIds'] as const;

/**
 * Reorder one Guide's Stops by stable identity.
 *
 * Targets: exactly one `experience:experience` reference. The payload must be a
 * permutation of the Guide's authored `stopIds`: insertion and removal have their
 * own operations, and an index-keyed move is exactly the identity confusion this
 * rule prevents. `entryStopId` is untouched.
 */
export function createExperienceGuideOrderPlanner(): DomainPlanner<ProjectEnvelope> {
	return {
		id: 'unit.experience-guide-order',
		kind: EXPERIENCE_GUIDE_ORDER_KIND,
		admission: { domain: 'experience', compound: false, units: true, resources: false },
		sourceKinds: [UNIT_SOURCE_KIND],
		sourceVersions: [UNIT_SOURCE_VERSION],
		prepare(request) {
			const envelope = envelopeOf(request);
			const reader = new ShapeReader();
			const payload = reader.object(request.intent.payload, '$.payload', GUIDE_ORDER_PAYLOAD_KEYS);
			if (payload === null) return refuse('invalid-payload', 'The Guide order payload is not a valid shape', reader.issues);
			const guideId = reader.opaqueId(payload.guideId, '$.payload.guideId');
			const stopIds = reader.opaqueIdArray(payload.stopIds, '$.payload.stopIds');
			if (guideId === null || stopIds === null) {
				return refuse('invalid-payload', 'The Guide order payload is not a valid shape', reader.issues);
			}
			const target = targetOf(request.intent, 'experience', 'experience');
			if (target === null) {
				return refuse('unsupported-operation', 'experience-guide-order targets exactly one experience:experience reference');
			}
			const experienceIndex = envelope.units.experience.data.experiences.findIndex((candidate) => candidate.id === target.subject.id);
			if (experienceIndex === -1) return refuse('missing-target', `experience "${target.subject.id}" is not in this envelope`);
			const experience = envelope.units.experience.data.experiences[experienceIndex]!;
			const guide = experience.guides.find((candidate) => candidate.id === guideId);
			if (guide === undefined) return refuse('missing-target', `guide "${guideId}" is not in experience "${experience.id}"`);
			const authored = new Set(guide.stopIds);
			const supplied = new Set(stopIds);
			if (
				guide.stopIds.length !== stopIds.length ||
				authored.size !== supplied.size ||
				![...authored].every((stopId) => supplied.has(stopId))
			) {
				return refuse(
					'invalid-order',
					`the new order must be a permutation of guide "${guide.id}"'s authored stops; it is never an insert, a removal or an index-keyed move`
				);
			}
			const updatedExperience: Experience = {
				...experience,
				guides: experience.guides.map((candidate) => (candidate.id === guide.id ? { ...candidate, stopIds } : candidate))
			};
			const candidate: ProjectEnvelope = {
				...envelope,
				units: {
					...envelope.units,
					experience: {
						header: { ...envelope.units.experience.header },
						data: {
							formatVersion: EXPERIENCE_UNIT_FORMAT_VERSION,
							experiences: envelope.units.experience.data.experiences.map((entryExperience, index) =>
								index === experienceIndex ? updatedExperience : entryExperience
							)
						}
					}
				}
			};
			return {
				kind: 'prepared',
				candidate: {
					operationId: request.intent.operationId,
					sourceKind: request.snapshot.sourceKind,
					sourceVersion: request.snapshot.sourceVersion,
					source: candidate,
					changes: [{ kind: 'experience.guide.updated', subjectIds: [guide.id], fields: ['stopIds'] }],
					correspondence: [
						{
							relation: 'preserved',
							before: reference('experience', 'guide', guide.id, [experience.id], revisionOf(envelope, 'experience')),
							after: reference('experience', 'guide', guide.id, [experience.id], revisionOf(candidate, 'experience'))
						}
					],
					diagnostics: []
				}
			};
		}
	};
}

/* --- Bounded editorial fields ---------------------------------------------- */

const PRESENTATION_UPDATE_KEYS = ['label', 'text', 'subject', 'view', 'defaultViewId'] as const;

/**
 * Edit one Presentation's label, text and subject, or rebind it to a freshly
 * captured View.
 *
 * Targets: exactly one `experience:presentation` reference. `text` and `subject`
 * are replaced when present and cleared by an explicit `null`; `view` captures a
 * new View, appends it to `viewIds` and makes it the Default — the deliberate
 * rebind, rather than editing a shared View in place.
 */
export function createExperiencePresentationUpdatePlanner(): DomainPlanner<ProjectEnvelope> {
	return {
		id: 'unit.experience-presentation-update',
		kind: EXPERIENCE_PRESENTATION_UPDATE_KIND,
		admission: { domain: 'experience', compound: true, writes: ['camera'], units: true, resources: false },
		sourceKinds: [UNIT_SOURCE_KIND],
		sourceVersions: [UNIT_SOURCE_VERSION],
		prepare(request) {
			const envelope = envelopeOf(request);
			const reader = new ShapeReader();
			const payload = reader.object(request.intent.payload, '$.payload', PRESENTATION_UPDATE_KEYS);
			if (payload === null) return refuse('invalid-payload', 'The Presentation payload is not a valid shape', reader.issues);
			const label = payload.label === undefined ? undefined : reader.string(payload.label, '$.payload.label');
			const textPresent = payload.text !== undefined;
			const text = !textPresent || payload.text === null
				? null
				: readTextPayload(reader, payload.text, '$.payload.text');
			const subjectPresent = payload.subject !== undefined;
			const subject = payload.subject === null
				? { ok: true as const, value: null }
				: payload.subject === undefined
					? null
					: readSubjectPayload(reader, payload.subject, '$.payload.subject');
			const viewPresent = payload.view !== undefined && payload.view !== null;
			const view = viewPresent ? readViewPose(reader, payload.view, '$.payload.view') : null;
			const defaultViewId = payload.defaultViewId === undefined
				? undefined
				: payload.defaultViewId === null
					? null
					: reader.opaqueId(payload.defaultViewId, '$.payload.defaultViewId');
			if (
				(label === null && payload.label !== undefined) ||
				(textPresent && payload.text !== null && text === null) ||
				(subject !== null && subject.ok === false) ||
				(viewPresent && view === null) ||
				(payload.defaultViewId !== undefined && payload.defaultViewId !== null && defaultViewId === null)
			) {
				return refuse('invalid-payload', 'The Presentation payload is not a valid shape', reader.issues);
			}
			if (
				payload.label === undefined &&
				!textPresent &&
				!subjectPresent &&
				!viewPresent &&
				payload.defaultViewId === undefined
			) {
				return refuse('invalid-payload', 'the Presentation payload names no field to change');
			}
			const target = targetOf(request.intent, 'experience', 'presentation');
			if (target === null) {
				return refuse('unsupported-operation', 'experience-presentation-update targets exactly one experience:presentation reference');
			}
			const container = target.instancePath.length === 1
				? envelope.units.experience.data.experiences.find((candidate) => candidate.id === target.instancePath[0])
				: undefined;
			if (container === undefined) {
				return refuse('missing-target', `the Presentation's Experience "${target.instancePath[0] ?? '(unspecified)'}" is not in this envelope`);
			}
			const presentationIndex = container.presentations.findIndex((candidate) => candidate.id === target.subject.id);
			if (presentationIndex === -1) {
				return refuse('missing-target', `presentation "${target.subject.id}" is not in experience "${container.id}"`);
			}
			const previous = container.presentations[presentationIndex]!;
			let viewIds = previous.viewIds;
			let defaultView: string | null = previous.defaultViewId;
			let createdView: CameraView | null = null;
			if (view !== null) {
				const viewId = capturedId(request.intent, 'view');
				if (viewId === null) {
					return refuse('unsupported-operation', 'a captured View change must capture exactly one view id');
				}
				if (allIds(envelope).has(viewId)) {
					return refuse('duplicate-identity', `the captured id "${viewId}" already names a subject in this envelope`);
				}
				createdView = { id: viewId, label: view.label, eye: view.eye, target: view.target, fov: view.fov, connectedViewIds: [] };
				viewIds = [...viewIds, viewId];
				defaultView = viewId;
			}
			if (defaultViewId !== undefined) {
				if (defaultViewId === null) {
					defaultView = null;
				} else {
					if (!viewIds.includes(defaultViewId)) {
						return refuse('invalid-payload', `default view "${defaultViewId}" is not one of this Presentation's views`);
					}
					defaultView = defaultViewId;
				}
			}
			const updated: ExperiencePresentation = {
				id: previous.id,
				label: label ?? previous.label,
				viewIds,
				defaultViewId: defaultView,
				subject: subject === null ? previous.subject : subject.value,
				text: textPresent ? text : previous.text
			};
			const updatedExperience: Experience = {
				...container,
				presentations: container.presentations.map((candidate, index) => (index === presentationIndex ? updated : candidate))
			};
			const experiences = envelope.units.experience.data.experiences.map((candidate) =>
				candidate.id === container.id ? updatedExperience : candidate
			);
			const candidate: ProjectEnvelope = {
				...envelope,
				units: {
					...envelope.units,
					camera: createdView === null
						? envelope.units.camera
						: {
								header: { ...envelope.units.camera.header },
								data: {
									formatVersion: CAMERA_UNIT_FORMAT_VERSION,
									views: [...envelope.units.camera.data.views, createdView],
									connections: envelope.units.camera.data.connections
								}
							},
					experience: {
						header: { ...envelope.units.experience.header },
						data: { formatVersion: EXPERIENCE_UNIT_FORMAT_VERSION, experiences }
					}
				}
			};
			const changedFields: string[] = [];
			if (updated.label !== previous.label) changedFields.push('label');
			if (textPresent) changedFields.push('text');
			if (subject !== null) changedFields.push('subject');
			if (defaultView !== previous.defaultViewId) changedFields.push('defaultViewId');
			if (viewIds !== previous.viewIds) changedFields.push('viewIds');
			const changes: OperationChange[] = [
				{ kind: 'experience.presentation.updated', subjectIds: [updated.id], fields: changedFields }
			];
			const correspondence: CorrespondenceEntry[] = [
				{
					relation: 'preserved',
					before: reference('experience', 'presentation', previous.id, [container.id], revisionOf(envelope, 'experience')),
					after: reference('experience', 'presentation', previous.id, [container.id], revisionOf(candidate, 'experience'))
				}
			];
			if (createdView !== null) {
				changes.push({ kind: 'camera.view.created', subjectIds: [createdView.id], fields: ['label', 'eye', 'target', 'fov', 'connectedViewIds'] });
				correspondence.push({
					relation: 'created',
					before: null,
					after: reference('camera', 'view', createdView.id, [], revisionOf(candidate, 'camera'))
				});
			}
			return {
				kind: 'prepared',
				candidate: {
					operationId: request.intent.operationId,
					sourceKind: request.snapshot.sourceKind,
					sourceVersion: request.snapshot.sourceVersion,
					source: candidate,
					changes,
					correspondence,
					diagnostics: []
				}
			};
		}
	};
}

const STOP_UPDATE_PAYLOAD_KEYS = ['entryViewId', 'holdSeconds', 'continuation'] as const;

function presentationOfStop(experience: Experience, stop: ExperienceStop): ExperiencePresentation | null {
	return experience.presentations.find((candidate) => candidate.id === stop.presentationId) ?? null;
}

/**
 * Edit one Stop's entry View, hold or continuation edge.
 *
 * Targets: exactly one `experience:stop` reference. Every field is replaced when
 * present; `entryViewId: null` and `holdSeconds: null` clear them, and
 * `continuation: null` restores the authored default. The continuation's
 * transition is the Cut/Travel selector, so an unsupported Travel stays authored
 * and is reported by Preview rather than silently cut.
 */
export function createExperienceStopUpdatePlanner(): DomainPlanner<ProjectEnvelope> {
	return {
		id: 'unit.experience-stop-update',
		kind: EXPERIENCE_STOP_UPDATE_KIND,
		admission: { domain: 'experience', compound: false, units: true, resources: false },
		sourceKinds: [UNIT_SOURCE_KIND],
		sourceVersions: [UNIT_SOURCE_VERSION],
		prepare(request) {
			const envelope = envelopeOf(request);
			const reader = new ShapeReader();
			const payload = reader.object(request.intent.payload, '$.payload', STOP_UPDATE_PAYLOAD_KEYS);
			if (payload === null) return refuse('invalid-payload', 'The Stop payload is not a valid shape', reader.issues);
			const entryPresent = payload.entryViewId !== undefined;
			const entryViewId = entryPresent
				? payload.entryViewId === null
					? null
					: reader.opaqueId(payload.entryViewId, '$.payload.entryViewId')
				: undefined;
			const holdPresent = payload.holdSeconds !== undefined;
			const holdSeconds = !holdPresent || payload.holdSeconds === null
				? null
				: reader.numberAtLeast(payload.holdSeconds, '$.payload.holdSeconds', 0, false);
			const continuationPresent = payload.continuation !== undefined;
			const continuation = !continuationPresent || payload.continuation === null
				? null
				: readContinuation(reader, payload.continuation, '$.payload.continuation');
			if (
				(entryPresent && payload.entryViewId !== null && entryViewId === null) ||
				(holdPresent && payload.holdSeconds !== null && holdSeconds === null) ||
				(continuationPresent && payload.continuation !== null && continuation === null)
			) {
				return refuse('invalid-payload', 'The Stop payload is not a valid shape', reader.issues);
			}
			if (!entryPresent && !holdPresent && !continuationPresent) {
				return refuse('invalid-payload', 'the Stop payload names no field to change');
			}
			const target = targetOf(request.intent, 'experience', 'stop');
			if (target === null) {
				return refuse('unsupported-operation', 'experience-stop-update targets exactly one experience:stop reference');
			}
			const container = target.instancePath.length === 1
				? envelope.units.experience.data.experiences.find((candidate) => candidate.id === target.instancePath[0])
				: undefined;
			if (container === undefined) {
				return refuse('missing-target', `the Stop's Experience "${target.instancePath[0] ?? '(unspecified)'}" is not in this envelope`);
			}
			const stopIndex = container.stops.findIndex((candidate) => candidate.id === target.subject.id);
			if (stopIndex === -1) return refuse('missing-target', `stop "${target.subject.id}" is not in experience "${container.id}"`);
			const previous = container.stops[stopIndex]!;
			const presentation = presentationOfStop(container, previous);
			if (presentation === undefined || presentation === null) {
				return refuse('missing-target', `stop "${previous.id}" names presentation "${previous.presentationId}", which this Experience does not carry`);
			}
			if (entryPresent && entryViewId !== null && entryViewId !== undefined && !presentation.viewIds.includes(entryViewId)) {
				return refuse('invalid-payload', `entry view "${entryViewId}" is not one of presentation "${presentation.id}"'s views`);
			}
			if (
				continuationPresent &&
				continuation !== null &&
				continuation.kind === 'stop' &&
				!container.stops.some((candidate) => candidate.id === continuation.stopId)
			) {
				return refuse('missing-target', `the continuation names stop "${continuation.stopId}", which this Experience does not carry`);
			}
			const updated: ExperienceStop = {
				id: previous.id,
				presentationId: previous.presentationId,
				...(entryPresent
					? entryViewId === null ? {} : { entryViewId }
					: previous.entryViewId === undefined ? {} : { entryViewId: previous.entryViewId }),
				...(holdPresent
					? holdSeconds === null ? {} : { holdSeconds }
					: previous.holdSeconds === undefined ? {} : { holdSeconds: previous.holdSeconds }),
				...(continuationPresent
					? continuation === null ? {} : { continuation }
					: previous.continuation === undefined ? {} : { continuation: previous.continuation })
			};
			const updatedExperience: Experience = {
				...container,
				stops: container.stops.map((candidate, index) => (index === stopIndex ? updated : candidate))
			};
			const candidate: ProjectEnvelope = {
				...envelope,
				units: {
					...envelope.units,
					experience: {
						header: { ...envelope.units.experience.header },
						data: {
							formatVersion: EXPERIENCE_UNIT_FORMAT_VERSION,
							experiences: envelope.units.experience.data.experiences.map((entryExperience) =>
								entryExperience.id === container.id ? updatedExperience : entryExperience
							)
						}
					}
				}
			};
			const changedFields: string[] = [];
			if (updated.entryViewId !== previous.entryViewId) changedFields.push('entryViewId');
			if (updated.holdSeconds !== previous.holdSeconds) changedFields.push('holdSeconds');
			if (JSON.stringify(updated.continuation) !== JSON.stringify(previous.continuation)) changedFields.push('continuation');
			return {
				kind: 'prepared',
				candidate: {
					operationId: request.intent.operationId,
					sourceKind: request.snapshot.sourceKind,
					sourceVersion: request.snapshot.sourceVersion,
					source: candidate,
					changes: [
						{ kind: 'experience.stop.updated', subjectIds: [updated.id], fields: changedFields }
					],
					correspondence: [
						{
							relation: 'preserved',
							before: reference('experience', 'stop', previous.id, [container.id], revisionOf(envelope, 'experience')),
							after: reference('experience', 'stop', previous.id, [container.id], revisionOf(candidate, 'experience'))
						}
					],
					diagnostics: []
				}
			};
		}
	};
}

/** Every planner a host registers for this slice's authored operations. */
export function createUnitCandidatePlanners(options: CaptureBindOptions = {}): DomainPlanner<ProjectEnvelope>[] {
	return [
		createCameraViewUpdatePlanner(),
		createExperienceCreatePlanner(),
		createCaptureBindPlanner(options),
		createExperienceStopCreatePlanner(),
		createExperienceGuideOrderPlanner(),
		createExperiencePresentationUpdatePlanner(),
		createExperienceStopUpdatePlanner()
	];
}

/** One admission profile for both the planner registry and the source adapter. */
export type UnitAcceptanceProfileOptions = {
	readonly compound?: boolean;
	readonly resourceStaging?: boolean;
	readonly sessionEpoch?: string;
};

export type UnitAcceptanceProfile = {
	readonly registry: PlannerRegistry<ProjectEnvelope>;
	readonly planners: readonly DomainPlanner<ProjectEnvelope>[];
	readonly adapter: AcceptanceSourceAdapter<ProjectEnvelope>;
	prepare(
		snapshot: AcceptedSnapshot<ProjectEnvelope>,
		intent: AuthoringIntent,
		capturedInputs?: readonly CapturedInput[]
	): PrepareResult<ProjectEnvelope>;
};

/**
 * Construct the registry, its planners, the source adapter and the preparation
 * seam from **one** options object.
 *
 * Registering a resource-staging planner against a non-staging adapter (or the
 * reverse) is the wiring defect this factory removes: the profile a host grants
 * is the profile every admission layer reads, so one flag cannot be set in two
 * places and disagree.
 */
export function createUnitAcceptanceProfile(
	options: UnitAcceptanceProfileOptions = {}
): UnitAcceptanceProfile {
	const compound = options.compound === true;
	const resourceStaging = options.resourceStaging === true;
	const planners = createUnitCandidatePlanners({ resourceStaging });
	const registry = createUnitPlannerRegistry<ProjectEnvelope>({ resourceStaging });
	for (const planner of planners) registry.register(planner);
	const preparation = createUnitAcceptancePreparation({
		registry,
		compound,
		resourceStaging,
		...(options.sessionEpoch === undefined ? {} : { sessionEpoch: options.sessionEpoch })
	});
	return {
		registry,
		planners,
		adapter: createUnitAcceptanceAdapter({ compound, resourceStaging }),
		prepare: preparation.prepare
	};
}

/** Read-only helper for tests and hosts: the typed resources a captured staging names. */
export function stagedResourcesAsTyped(staged: readonly StagedUnitResource[]): TypedResource[] {
	return staged.map((item) => ({
		kind: item.kind as TypedResource['kind'],
		id: item.id,
		contentRevision: item.contentRevision,
		pin: item.pin,
		unresolved: null
	}));
}
