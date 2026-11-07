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
 *   existing Guide — or, with `firstGuide`, the Experience's first Guide and its
 *   initial Stop — one candidate, one acceptance, one undo.
 * - `experience-guide-create` creates the Experience's first Guide and its
 *   initial distinct Stop from an existing Presentation, and names that Guide the
 *   Experience's explicit entry Guide. It reuses no Camera pose and manufactures
 *   no Connection: the Stop enters the Presentation's own View.
 * - `experience-stop-create` reuses an existing Presentation at a distinct Stop
 *   in a Guide. The Stop's entry View is its own identity, so the same
 *   Presentation may be entered at a different View at another Stop.
 * - `experience-guide-order` reorders a Guide's Stops by stable identity. It is a
 *   permutation of the authored order, never an insert, a removal or an
 *   index-keyed move, and it is the only order writer.
 * - `experience-presentation-update` and `experience-stop-update` edit the bounded
 *   editorial fields: a Presentation's label, text, subject, Default (a newly
 *   captured View rebinds it deliberately) and View order (a permutation of its
 *   `viewIds`), free-exploration reach, and a Stop's guided Views and outgoing step.
 * - `experience-update` and `experience-guide-update` (R217.S26) edit an
 *   Experience's label, welcome and Opening Guide, and a Guide's label and start Stop.
 * - `experience-stop-remove`, `experience-presentation-view-remove`,
 *   `experience-presentation-remove` and `experience-guide-remove` (R217.S26)
 *   install the E4 removal plans of `experience-structure.ts`: one operation,
 *   nothing replaced silently, Camera truth removed only when unshared.
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
import { readExperienceText, readInvitation, readPresentationViews, readStaySeconds } from './validate';
import type { SceneConnection, ScenePathAnchor } from '../scene';
import {
	SCENE_ENVIRONMENT_PRESETS,
	type SceneEnvironmentPreset,
	CAMERA_UNIT_FORMAT_VERSION,
	EXPERIENCE_WELCOME_MAX_LENGTH,
	EXPERIENCE_GUIDE_PACINGS,
	EXPERIENCE_STAY_DEFAULT_SECONDS,
	EXPERIENCE_TRANSITIONS,
	presentationDefaultViewId,
	presentationViewIds,
	type ExperienceGuidePacing,
	type ExperiencePresentationView,
	EXPERIENCE_UNIT_FORMAT_VERSION,
	type CameraView,
	type Experience,
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
import {
	planGuideRemoval,
	planPresentationRemoval,
	planPresentationViewRemoval,
	planStopRemoval,
	normalizeTransitions,
	requiredTravelPairs,
	type ExperienceNormalisedCut,
	type ExperienceRemovalPlan
} from './experience-structure';

/** The single-domain Camera View operation kind. */
export const CAMERA_VIEW_UPDATE_KIND = 'camera-view-update';
/** Create one empty Experience. */
export const EXPERIENCE_CREATE_KIND = 'experience-create';
/** Capture a View and bind a Presentation (and optionally one Stop) to it. */
export const EXPERIENCE_CAPTURE_BIND_KIND = 'experience-capture-bind';
/** Reuse an existing Presentation at a distinct Stop. */
export const EXPERIENCE_STOP_CREATE_KIND = 'experience-stop-create';
/** Create a Guide and its initial Stop from an existing Presentation; the first one opens the Experience. */
export const EXPERIENCE_GUIDE_CREATE_KIND = 'experience-guide-create';
/** Reorder a Guide's Stops by stable identity. */
export const EXPERIENCE_GUIDE_ORDER_KIND = 'experience-guide-order';
/** Edit one Presentation's label, text, subject or Default View. */
export const EXPERIENCE_PRESENTATION_UPDATE_KIND = 'experience-presentation-update';
/** Edit one Stop's entry View, stay, invitation or outgoing step. */
export const EXPERIENCE_STOP_UPDATE_KIND = 'experience-stop-update';
/** Edit one Experience's label or Opening Guide. */
export const EXPERIENCE_UPDATE_KIND = 'experience-update';
/** Edit one Guide's label or start Stop. */
export const EXPERIENCE_GUIDE_UPDATE_KIND = 'experience-guide-update';
/** Remove one Stop under the E4 rules. */
export const EXPERIENCE_STOP_REMOVE_KIND = 'experience-stop-remove';
/** Remove one View from one Presentation under the E4 rules (writes Camera when unshared). */
export const EXPERIENCE_PRESENTATION_VIEW_REMOVE_KIND = 'experience-presentation-view-remove';
/** Remove one Presentation under the E4 rules (writes Camera when unshared). */
export const EXPERIENCE_PRESENTATION_REMOVE_KIND = 'experience-presentation-remove';
/** Remove one Guide under the E4 rules. */
export const EXPERIENCE_GUIDE_REMOVE_KIND = 'experience-guide-remove';

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

/** Every captured id of one kind, in capture order. */
function capturedIds(intent: PlannerRequest<ProjectEnvelope>['intent'], kind: string): string[] {
	return intent.allocatedIds.filter((entry) => entry.kind === kind).map((entry) => entry.id);
}

function allIds(envelope: ProjectEnvelope): Set<string> {
	const ids = new Set<string>();
	for (const unit of Object.values(envelope.units)) ids.add(unit.header.unitId);
	for (const view of envelope.units.camera.data.views) ids.add(view.id);
	for (const connection of envelope.units.camera.data.connections) ids.add(connection.id);
	for (const experience of envelope.units.experience.data.experiences) {
		ids.add(experience.id);
		for (const item of [...experience.presentations, ...experience.stops, ...experience.guides, ...experience.detours]) {
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

const STOP_PAYLOAD_KEYS = ['staySeconds', 'transition', 'guideId', 'afterStopId'] as const;
const COMPOUND_PAYLOAD_KEYS = ['view', 'presentation', 'stop', 'firstGuide', 'resource', 'newExperience'] as const;
const FIRST_GUIDE_PAYLOAD_KEYS = ['label'] as const;
const PRESENTATION_PAYLOAD_KEYS = ['label', 'subject', 'text'] as const;
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

/** An edge's authored Cut/Travel selector; absent means Cut. */
function readOptionalTransition(
	reader: ShapeReader,
	input: unknown,
	path: string
): ExperienceTransitionKind | undefined | null {
	if (input === undefined || input === null) return undefined;
	return reader.tag(input, path, EXPERIENCE_TRANSITIONS) as ExperienceTransitionKind | null;
}

type StopPayload = {
	readonly staySeconds: number;
	readonly transition: ExperienceTransitionKind | undefined;
	/** The existing Guide the Stop joins, or `null` when the capture creates the first Guide. */
	readonly guideId: string | null;
	readonly afterStopId: string | null;
};

function readStopPayload(reader: ShapeReader, input: unknown, path: string): StopPayload | null {
	const record = reader.object(input, path, STOP_PAYLOAD_KEYS);
	if (record === null) return null;
	const staySeconds = record.staySeconds === undefined ? EXPERIENCE_STAY_DEFAULT_SECONDS : readStaySeconds(reader, record.staySeconds, `${path}.staySeconds`);
	const transition = readOptionalTransition(reader, record.transition, `${path}.transition`);
	const guideId = record.guideId === null || record.guideId === undefined
		? null
		: reader.opaqueId(record.guideId, `${path}.guideId`);
	let afterStopId: string | null = null;
	if (record.afterStopId !== undefined && record.afterStopId !== null) {
		const parsed = reader.opaqueId(record.afterStopId, `${path}.afterStopId`);
		if (parsed === null) return null;
		afterStopId = parsed;
	}
	if (staySeconds === null || transition === null) return null;
	return { staySeconds, transition, guideId, afterStopId };
}

/** The first Guide's authored label; its identities are the intent's captured ids. */
function readFirstGuidePayload(
	reader: ShapeReader,
	input: unknown,
	path: string
): { readonly label: string } | null {
	const record = reader.object(input, path, FIRST_GUIDE_PAYLOAD_KEYS);
	if (record === null) return null;
	const label = reader.string(record.label, `${path}.label`);
	return label === null ? null : { label };
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
				welcome: null,
				presentations: [],
				stops: [],
				guides: [],
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
			return prepared(request, candidate, [
						{ kind: 'experience.created', subjectIds: [created.id], fields: ['label', 'entryGuideId'] }
					], [
						{
							relation: 'created',
							before: null,
							after: reference('experience', 'experience', created.id, [], revisionOf(candidate, 'experience'))
						}
					]);
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
			const presentationLabel = presentationPayload === null
				? undefined
				: presentationPayload.label === null
					? null
					: reader.string(presentationPayload.label, '$.payload.presentation.label');
			const text = presentationPayload === null || presentationPayload.text === null
				? null
				: readExperienceText(reader, presentationPayload.text, '$.payload.presentation.text');
			const subject = presentationPayload === null
				? { ok: false as const }
				: readSubjectPayload(reader, presentationPayload.subject, '$.payload.presentation.subject');
			// An omitted Stop is the explicit "Presentation only" case; a present but
			// malformed Stop is a refusal, not the same absence.
			const requestedStop = payload.stop !== null && payload.stop !== undefined;
			const stop = requestedStop ? readStopPayload(reader, payload.stop, '$.payload.stop') : null;
			// The first Guide is requested together with its initial Stop: capture then
			// installs View + Presentation + Guide + Stop as one accepted result.
			const requestedFirstGuide = payload.firstGuide !== null && payload.firstGuide !== undefined;
			const firstGuide = requestedFirstGuide
				? readFirstGuidePayload(reader, payload.firstGuide, '$.payload.firstGuide')
				: null;
			if (requestedFirstGuide && firstGuide === null) {
				return refuse('invalid-payload', 'The first Guide payload is not a valid shape', reader.issues);
			}
			const requestedResource = payload.resource !== null && payload.resource !== undefined;
			const resourceUpdate = requestedResource ? readResourceUpdate(reader, payload.resource, '$.payload.resource') : null;
			if (
				view === null ||
				presentationPayload === null ||
				presentationLabel === undefined ||
				(subject.ok && presentationLabel === null &&
					(subject.value === null || subject.value.domain !== 'scene' || subject.value.subject.kind !== 'entity')) ||
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

			// Experience review 1 (ready draft): the first step in an unsaved draft
			// creates its Experience in the same accepted change, so one Undo removes both.
			const requestedNewExperience = payload.newExperience !== null && payload.newExperience !== undefined;
			const newExperiencePayload = requestedNewExperience
				? reader.object(payload.newExperience, '$.payload.newExperience', CREATE_PAYLOAD_KEYS)
				: null;
			const newExperienceLabel = newExperiencePayload === null ? null : reader.string(newExperiencePayload.label, '$.payload.newExperience.label');
			if (requestedNewExperience && newExperienceLabel === null) {
				return refuse('invalid-payload', 'The new Experience payload is not a valid shape', reader.issues);
			}
			let experienceIndex = -1;
			let experience: Experience;
			if (newExperienceLabel !== null) {
				if (request.intent.targets.some((candidateTarget) => candidateTarget.domain === 'experience')) {
					return refuse('unsupported-operation', 'a capture that creates its Experience targets no existing Experience');
				}
				const newExperienceId = capturedId(request.intent, 'experience');
				if (newExperienceId === null) return refuse('unsupported-operation', 'the intent must capture exactly one experience id');
				if (allIds(envelope).has(newExperienceId)) {
					return refuse('duplicate-identity', `the captured id "${newExperienceId}" already names a subject in this envelope`);
				}
				experience = {
					id: newExperienceId,
					label: newExperienceLabel,
					entryGuideId: null,
					welcome: null,
					presentations: [],
					stops: [],
					guides: [],
					detours: []
				};
			} else {
				const target = targetOf(request.intent, 'experience', 'experience');
				if (target === null) {
					return refuse('unsupported-operation', 'experience-capture-bind targets exactly one experience:experience reference');
				}
				experienceIndex = envelope.units.experience.data.experiences.findIndex(
					(candidate) => candidate.id === target.subject.id
				);
				if (experienceIndex === -1) return refuse('missing-target', `experience "${target.subject.id}" is not in this envelope`);
				experience = envelope.units.experience.data.experiences[experienceIndex]!;
			}

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
				if (id === experience.id) return refuse('duplicate-identity', 'the new Experience and its first View or Presentation must have distinct identities');
				if (ids.has(id)) return refuse('duplicate-identity', `the captured id "${id}" already names a subject in this envelope`);
			}
			if (viewId === presentationId || viewId === stopId || presentationId === stopId) {
				return refuse('duplicate-identity', 'a View, a Presentation and a Stop must have distinct identities');
			}

			// The first Guide is an explicit request, never inferred from the absence of
			// one: a capture that authors no Guide stays Guide-free.
			let firstGuideId: string | null = null;
			if (firstGuide !== null) {
				if (stop === null) {
					return refuse('unsupported-operation', 'a first Guide is created with its initial Stop; the capture carries no Stop');
				}
				if (stop.guideId !== null) {
					return refuse('invalid-payload', 'the capture names both an existing Guide and a first Guide');
				}
				if (experience.guides.length > 0) {
					return refuse(
						'guide-exists',
						`experience "${experience.id}" already carries a Guide; insert the Stop into that Guide instead of creating a first Guide`
					);
				}
				if (experience.entryGuideId !== null) {
					return refuse(
						'missing-target',
						`experience "${experience.id}" already names entry guide "${experience.entryGuideId}", which it does not carry`
					);
				}
				const guideId = capturedId(request.intent, 'guide');
				if (guideId === null) {
					return refuse('unsupported-operation', 'the intent must capture exactly one guide id');
				}
				if (ids.has(guideId) || guideId === viewId || guideId === presentationId || guideId === stopId) {
					return refuse('duplicate-identity', `the captured id "${guideId}" already names a subject in this envelope`);
				}
				if (stop.afterStopId !== null) {
					return refuse('invalid-payload', 'the first Guide has no earlier Stop for the initial Stop to follow');
				}
				firstGuideId = guideId;
			}
			// A Stop joins a Guide: naming neither an existing Guide nor the first Guide
			// would install a Stop no order reaches, which Preview can never enter.
			if (stop !== null && stop.guideId === null && firstGuide === null) {
				return refuse('missing-target', 'a Stop joins a Guide; name the existing Guide or request the first Guide');
			}

			let guide: ExperienceGuide | null = null;
			let insertionIndex = -1;
			if (stop !== null && stop.guideId !== null) {
				const guideId = stop.guideId;
				const guideIndex = experience.guides.findIndex((candidate) => candidate.id === guideId);
				if (guideIndex === -1) return refuse('missing-target', `guide "${guideId}" is not in experience "${experience.id}"`);
				guide = experience.guides[guideIndex]!;
				if (stop.afterStopId !== null) {
					const at = guide.stopIds.indexOf(stop.afterStopId);
					if (at === -1) return refuse('missing-target', `guide "${guideId}" does not order stop "${stop.afterStopId}"`);
					insertionIndex = at + 1;
				} else {
					insertionIndex = guide.stopIds.length;
				}
			} else if (stop !== null) {
			}

			const newView: CameraView = { id: viewId, label: view.label, eye: view.eye, target: view.target, fov: view.fov, connectedViewIds: [] };
			const newPresentation: ExperiencePresentation = {
				id: presentationId,
				label: presentationLabel,
				views: [{ viewId }],
				subject: subject.value,
				explorable: true,
				text
			};
			const newStop: ExperienceStop | null =
				stop === null || stopId === null
					? null
					: {
							id: stopId,
							presentationId,
							entryViewId: null,
							staySeconds: stop.staySeconds,
							invitation: null,
							...(stop.transition === undefined ? {} : { transition: stop.transition })
						};
			const newGuide: ExperienceGuide | null =
				firstGuide === null || firstGuideId === null || newStop === null
					? null
					: { id: firstGuideId, label: firstGuide.label, stopIds: [newStop.id], pacing: 'automatic' };
			const guides = newGuide === null
				? experience.guides.map((candidate) =>
						guide !== null && candidate.id === guide.id && newStop !== null
							? { ...candidate, stopIds: [...candidate.stopIds.slice(0, insertionIndex), newStop.id, ...candidate.stopIds.slice(insertionIndex)] }
							: candidate
					)
				: [...experience.guides, newGuide];
			const updatedExperience: Experience = {
				...experience,
				presentations: [...experience.presentations, newPresentation],
				stops: newStop === null ? experience.stops : [...experience.stops, newStop],
				guides,
				// The first Guide is the Experience's explicit entry Guide. Creating it
				// never makes Guide membership mandatory for any other Presentation.
				entryGuideId: newGuide === null ? experience.entryGuideId : newGuide.id
			};
			const experiences = experienceIndex === -1
				? [...envelope.units.experience.data.experiences, updatedExperience]
				: envelope.units.experience.data.experiences.map((candidate, index) =>
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
					unresolved: null,
					// The retained model detail (source pin, recipe, report, placement) is
					// not the staged-byte update's to drop.
					...(previousResource.model === undefined ? {} : { model: previousResource.model })
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
				...(experienceIndex === -1
					? [{ kind: 'experience.created', subjectIds: [experience.id], fields: ['label', 'entryGuideId'] } as OperationChange]
					: []),
				{ kind: 'camera.view.created', subjectIds: [newView.id], fields: ['label', 'eye', 'target', 'fov', 'connectedViewIds'] },
				{
					kind: 'experience.presentation.created',
					subjectIds: [newPresentation.id],
					fields: ['label', 'views', 'subject', 'text']
				}
			];
			const correspondence: CorrespondenceEntry[] = [
				...(experienceIndex === -1
					? [{ relation: 'created', before: null, after: reference('experience', 'experience', experience.id, [], revisionOf(candidate, 'experience')) } as CorrespondenceEntry]
					: []),
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
			if (newGuide !== null) {
				changes.push(
					{ kind: 'experience.guide.created', subjectIds: [newGuide.id], fields: ['label', 'stopIds', 'pacing'] },
					{ kind: 'experience.updated', subjectIds: [experience.id], fields: ['entryGuideId'] }
				);
				correspondence.push({
					relation: 'created',
					before: null,
					after: reference('experience', 'guide', newGuide.id, [experience.id], revisionOf(candidate, 'experience'))
				});
			}
			if (newStop !== null) {
				changes.push({ kind: 'experience.stop.created', subjectIds: [newStop.id], fields: ['presentationId', 'entryViewId', 'staySeconds', 'invitation', 'transition'] });
				if (guide !== null) changes.push({ kind: 'experience.guide.updated', subjectIds: [guide.id], fields: ['stopIds'] });
				correspondence.push({
					relation: 'created',
					before: null,
					after: reference('experience', 'stop', newStop.id, [experience.id], revisionOf(candidate, 'experience'))
				});
			}
			return prepared(request, candidate, changes, correspondence);
		}
	};
}

/* --- Guide creation -------------------------------------------------------- */

const GUIDE_CREATE_PAYLOAD_KEYS = ['label', 'presentationId', 'entryViewId', 'staySeconds', 'transition', 'pacing'] as const;

/**
 * Create one Guide of an Experience and its initial distinct Stop.
 *
 * Targets: exactly one `experience:experience` reference. The Guide's label and
 * the captured guide/stop ids are the intent's; the Stop enters the chosen
 * Presentation at its own entry View (the Presentation's Default unless the
 * payload names one of its views). Reusing a Presentation creates a fresh Stop
 * identity: no Camera pose or FOV is copied and no Connection is manufactured.
 *
 * Any number of Guides may be created (R217.S26, E5). The first one becomes the
 * Experience's explicit `entryGuideId`; a later one leaves the Opening Guide as
 * it is. Guide membership is never made mandatory for any other Presentation,
 * and a source with no Guide still Previews through the visitor list.
 */
export function createExperienceGuideCreatePlanner(): DomainPlanner<ProjectEnvelope> {
	return {
		id: 'unit.experience-guide-create',
		kind: EXPERIENCE_GUIDE_CREATE_KIND,
		admission: { domain: 'experience', compound: true, writes: ['camera'], units: true, resources: false },
		sourceKinds: [UNIT_SOURCE_KIND],
		sourceVersions: [UNIT_SOURCE_VERSION],
		prepare(request) {
			const envelope = envelopeOf(request);
			const reader = new ShapeReader();
			const payload = reader.object(request.intent.payload, '$.payload', GUIDE_CREATE_PAYLOAD_KEYS);
			if (payload === null) return refuse('invalid-payload', 'The Guide payload is not a valid shape', reader.issues);
			const label = reader.string(payload.label, '$.payload.label');
			const presentationId = reader.opaqueId(payload.presentationId, '$.payload.presentationId');
			const entryViewProvided = payload.entryViewId !== undefined && payload.entryViewId !== null;
			const entryViewId = entryViewProvided ? reader.opaqueId(payload.entryViewId, '$.payload.entryViewId') : null;
			const staySeconds = payload.staySeconds === undefined
				? EXPERIENCE_STAY_DEFAULT_SECONDS
				: readStaySeconds(reader, payload.staySeconds, '$.payload.staySeconds');
			const pacing = payload.pacing === undefined
				? 'automatic'
				: (reader.tag(payload.pacing, '$.payload.pacing', EXPERIENCE_GUIDE_PACINGS) as ExperienceGuidePacing | null);
			const transition = readOptionalTransition(reader, payload.transition, '$.payload.transition');
			if (
				label === null ||
				presentationId === null ||
				(entryViewProvided && entryViewId === null) ||
				staySeconds === null ||
				pacing === null ||
				transition === null
			) {
				return refuse('invalid-payload', 'The Guide payload is not a valid shape', reader.issues);
			}
			const target = targetOf(request.intent, 'experience', 'experience');
			if (target === null) {
				return refuse('unsupported-operation', 'experience-guide-create targets exactly one experience:experience reference');
			}
			const experienceIndex = envelope.units.experience.data.experiences.findIndex((candidate) => candidate.id === target.subject.id);
			if (experienceIndex === -1) return refuse('missing-target', `experience "${target.subject.id}" is not in this envelope`);
			const experience = envelope.units.experience.data.experiences[experienceIndex]!;
			const firstGuide = experience.guides.length === 0;
			if (firstGuide && experience.entryGuideId !== null) {
				return refuse(
					'missing-target',
					`experience "${experience.id}" already names entry guide "${experience.entryGuideId}", which it does not carry`
				);
			}
			const presentation = experience.presentations.find((candidate) => candidate.id === presentationId);
			if (presentation === undefined) {
				return refuse('missing-target', `presentation "${presentationId}" is not in experience "${experience.id}"`);
			}
			// A Presentation without a Default View is not enterable, so no Stop of it
			// can join a Guide.
			const defaultViewId = presentationDefaultViewId(presentation);
			if (defaultViewId === null) {
				return refuse('missing-entry', `presentation "${presentation.id}" has no Default View, so a Stop cannot enter it`);
			}
			const entry: string = entryViewId ?? defaultViewId;
			if (!presentationViewIds(presentation).includes(entry)) {
				return refuse('invalid-payload', `entry view "${entry}" is not one of presentation "${presentation.id}"'s views`);
			}
			const guideId = capturedId(request.intent, 'guide');
			const stopId = capturedId(request.intent, 'stop');
			if (guideId === null || stopId === null) {
				return refuse('unsupported-operation', 'the intent must capture exactly one guide id and one stop id');
			}
			const ids = allIds(envelope);
			for (const id of [guideId, stopId]) {
				if (ids.has(id)) return refuse('duplicate-identity', `the captured id "${id}" already names a subject in this envelope`);
			}
			if (guideId === stopId) {
				return refuse('duplicate-identity', 'a Guide and its initial Stop must have distinct identities');
			}
			const newStop: ExperienceStop = {
				id: stopId,
				presentationId,
				entryViewId: entryViewId ?? null,
				staySeconds,
				invitation: null,
				...(transition === undefined ? {} : { transition })
			};
			const newGuide: ExperienceGuide = { id: guideId, label, stopIds: [newStop.id], pacing };
			const updatedExperience: Experience = {
				...experience,
				entryGuideId: firstGuide ? newGuide.id : experience.entryGuideId,
				stops: [...experience.stops, newStop],
				guides: [...experience.guides, newGuide]
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
			return prepared(request, candidate, [
						{ kind: 'experience.guide.created', subjectIds: [newGuide.id], fields: ['label', 'stopIds', 'pacing'] },
						{ kind: 'experience.stop.created', subjectIds: [newStop.id], fields: ['presentationId', 'entryViewId', 'staySeconds', 'invitation', 'transition'] },
						...(firstGuide ? [{ kind: 'experience.updated', subjectIds: [experience.id], fields: ['entryGuideId'] }] : [])
					], [
						{
							relation: 'created',
							before: null,
							after: reference('experience', 'guide', newGuide.id, [experience.id], revisionOf(candidate, 'experience'))
						},
						{
							relation: 'created',
							before: null,
							after: reference('experience', 'stop', newStop.id, [experience.id], revisionOf(candidate, 'experience'))
						}
					]);
		}
	};
}

/* --- Reuse a Presentation at a distinct Stop ------------------------------- */

const STOP_CREATE_PAYLOAD_KEYS = ['presentationId', 'guideId', 'afterStopId', 'entryViewId', 'staySeconds', 'transition'] as const;

/**
 * Create one Stop for an existing Presentation and insert it into a Guide.
 *
 * Targets: exactly one `experience:experience` reference. The Stop's entry View
 * is the payload's `entryViewId` or its Presentation's Default, so one
 * Presentation reused at two Stops can enter at two different Views while the
 * stays and outgoing steps stay per Stop.
 */
export function createExperienceStopCreatePlanner(): DomainPlanner<ProjectEnvelope> {
	return {
		id: 'unit.experience-stop-create',
		kind: EXPERIENCE_STOP_CREATE_KIND,
		admission: { domain: 'experience', compound: true, writes: ['camera'], units: true, resources: false },
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
			const staySeconds = payload.staySeconds === undefined
				? EXPERIENCE_STAY_DEFAULT_SECONDS
				: readStaySeconds(reader, payload.staySeconds, '$.payload.staySeconds');
			const transition = readOptionalTransition(reader, payload.transition, '$.payload.transition');
			let afterStopId: string | null = null;
			if (payload.afterStopId !== undefined && payload.afterStopId !== null) {
				const parsed = reader.opaqueId(payload.afterStopId, '$.payload.afterStopId');
				if (parsed === null) return refuse('invalid-payload', 'The Stop payload is not a valid shape', reader.issues);
				afterStopId = parsed;
			}
			if (
				presentationId === null ||
				guideId === null ||
				staySeconds === null ||
				transition === null ||
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
			const defaultViewId = presentationDefaultViewId(presentation);
			const entry: string | null = entryViewId ?? defaultViewId;
			// A Presentation without a Default View is not enterable, so lowering never
			// carries its Stops even when this Stop names its own entry View.
			if (defaultViewId === null || entry === null) {
				return refuse('missing-entry', `presentation "${presentation.id}" has no Default View, so a Stop cannot enter it`);
			}
			if (!presentationViewIds(presentation).includes(entry)) {
				return refuse('invalid-payload', `entry view "${entry}" is not one of presentation "${presentation.id}"'s views`);
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
				entryViewId: entryViewId ?? null,
				staySeconds,
				invitation: null,
				...(transition === undefined ? {} : { transition })
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
			return prepared(request, candidate, [
						{ kind: 'experience.stop.created', subjectIds: [newStop.id], fields: ['presentationId', 'entryViewId', 'staySeconds', 'invitation', 'transition'] },
						{ kind: 'experience.guide.updated', subjectIds: [guide.id], fields: ['stopIds'] }
					], [
						{
							relation: 'created',
							before: null,
							after: reference('experience', 'stop', newStop.id, [experience.id], revisionOf(candidate, 'experience'))
						}
					]);
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
 * rule prevents. The Experience's `entryGuideId` is untouched.
 */
export function createExperienceGuideOrderPlanner(): DomainPlanner<ProjectEnvelope> {
	return {
		id: 'unit.experience-guide-order',
		kind: EXPERIENCE_GUIDE_ORDER_KIND,
		admission: { domain: 'experience', compound: true, writes: ['camera'], units: true, resources: false },
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
			return prepared(request, candidate, [{ kind: 'experience.guide.updated', subjectIds: [guide.id], fields: ['stopIds'] }], [
						{
							relation: 'preserved',
							before: reference('experience', 'guide', guide.id, [experience.id], revisionOf(envelope, 'experience')),
							after: reference('experience', 'guide', guide.id, [experience.id], revisionOf(candidate, 'experience'))
						}
					]);
		}
	};
}

/* --- Bounded editorial fields ---------------------------------------------- */

const PRESENTATION_UPDATE_KEYS = ['label', 'text', 'subject', 'view', 'views', 'travelPaths', 'explorable'] as const;
const TRAVEL_PATH_KEYS = ['fromViewId', 'toViewId'] as const;

type ViewPair = { readonly fromViewId: string; readonly toViewId: string };

/** Read an optional list of View pairs a Travel needs a straight Camera path for. */
function readTravelPaths(reader: ShapeReader, input: unknown, path: string): ViewPair[] | null {
	if (!Array.isArray(input)) {
		reader.problem(path, 'not-an-array', `${path} must be an array`);
		return null;
	}
	const pairs: ViewPair[] = [];
	for (const [index, entry] of input.entries()) {
		const record = reader.object(entry, `${path}[${index}]`, TRAVEL_PATH_KEYS);
		if (record === null) return null;
		const fromViewId = reader.opaqueId(record.fromViewId, `${path}[${index}].fromViewId`);
		const toViewId = reader.opaqueId(record.toViewId, `${path}[${index}].toViewId`);
		if (fromViewId === null || toViewId === null) return null;
		pairs.push({ fromViewId, toViewId });
	}
	return pairs;
}

/**
 * Add the straight Camera path each Travel pair needs, in order, consuming one
 * captured `connection` id per pair that is not joined yet. An existing path is
 * kept as it is; the result names every connection it created.
 */
function withStraightConnections(
	envelope: ProjectEnvelope,
	candidate: ProjectEnvelope,
	pairs: readonly ViewPair[],
	connectionIds: readonly string[]
):
	| { readonly kind: 'joined'; readonly envelope: ProjectEnvelope; readonly connections: SceneConnection[] }
	| { readonly kind: 'refused'; readonly code: string; readonly message: string } {
	let current = candidate;
	const created: SceneConnection[] = [];
	let next = 0;
	for (const pair of pairs) {
		if (pair.fromViewId === pair.toViewId) continue;
		const joined = current.units.camera.data.connections.some((connection) =>
			sameUnorderedPair(connection, pair.fromViewId, pair.toViewId)
		);
		if (joined) continue;
		// A pool is shared by every stage of one change, so skip the ids an
		// earlier stage already consumed rather than reusing them.
		let connectionId: string | null = null;
		while (next < connectionIds.length) {
			const candidateId = connectionIds[next]!;
			next += 1;
			if (!allIds(current).has(candidateId)) {
				connectionId = candidateId;
				break;
			}
		}
		const result = withStraightConnection(envelope, current, pair, connectionId);
		if (result.kind === 'refused') return result;
		current = result.envelope;
		if (result.connection !== null) created.push(result.connection);
	}
	return { kind: 'joined', envelope: current, connections: created };
}

function connectionRecords(
	source: ProjectEnvelope,
	connections: readonly SceneConnection[]
): { changes: OperationChange[]; correspondence: CorrespondenceEntry[] } {
	return {
		changes: connections.map((connection) => ({
			kind: 'camera.connection.created',
			subjectIds: [connection.id],
			fields: ['fromNodeId', 'toNodeId', 'clearance', 'positionPath']
		})),
		correspondence: connections.map((connection) => ({
			relation: 'created' as const,
			before: null,
			after: reference('camera', 'connection', connection.id, [], revisionOf(source, 'camera'))
		}))
	};
}

/**
 * Edit one Presentation's label, text, subject, Places listing or Views.
 *
 * Targets: exactly one `experience:presentation` reference. `text` and `subject`
 * are replaced when present and cleared by an explicit `null`. `views` replaces
 * the ordered View list with its Cut/Travel steps: it must name the same Views
 * (a reorder or a step change, never an insert or a removal), and the first View
 * — the Default — carries no step. Moving a View to the top makes it the
 * Default; Stops without their own entry follow it. `view` captures a new View
 * and appends it, joined by a Cut, and is never combined with `views`.
 * `travelPaths` names View pairs a Travel step needs: the same accepted change
 * adds each missing straight Camera path (one captured `connection` id each),
 * so the Travel plays at once and is one Undo.
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
			const labelPresent = payload.label !== undefined;
			const label = payload.label === null
				? null
				: payload.label === undefined
					? undefined
					: reader.string(payload.label, '$.payload.label');
			const textPresent = payload.text !== undefined;
			const text = !textPresent || payload.text === null
				? null
				: readExperienceText(reader, payload.text, '$.payload.text');
			const subjectPresent = payload.subject !== undefined;
			const subject = payload.subject === null
				? { ok: true as const, value: null }
				: payload.subject === undefined
					? null
					: readSubjectPayload(reader, payload.subject, '$.payload.subject');
			const viewPresent = payload.view !== undefined && payload.view !== null;
			const view = viewPresent ? readViewPose(reader, payload.view, '$.payload.view') : null;
			const explorable = payload.explorable === undefined
				? undefined
				: reader.boolean(payload.explorable, '$.payload.explorable');
			const viewsPresent = payload.views !== undefined;
			const views = viewsPresent ? readPresentationViews(reader, payload.views, '$.payload.views') : null;
			const travelPaths = payload.travelPaths === undefined ? [] : readTravelPaths(reader, payload.travelPaths, '$.payload.travelPaths');
			if (
				explorable === null ||
				(viewsPresent && views === null) ||
				travelPaths === null ||
				(labelPresent && payload.label !== null && label === null) ||
				(textPresent && payload.text !== null && text === null) ||
				(subject !== null && subject.ok === false) ||
				(viewPresent && view === null)
			) {
				return refuse('invalid-payload', 'The Presentation payload is not a valid shape', reader.issues);
			}
			if (
				!labelPresent &&
				!textPresent &&
				!subjectPresent &&
				!viewPresent &&
				!viewsPresent &&
				explorable === undefined
			) {
				return refuse('invalid-payload', 'the Presentation payload names no field to change');
			}
			const target = targetOf(request.intent, 'experience', 'presentation');
			if (target === null) {
				return refuse('unsupported-operation', 'experience-presentation-update targets exactly one experience:presentation reference');
			}
			const container = containerOf(envelope, target);
			if (container === undefined) {
				return refuse('missing-target', `the Presentation's Experience "${target.instancePath[0] ?? '(unspecified)'}" is not in this envelope`);
			}
			const presentationIndex = container.presentations.findIndex((candidate) => candidate.id === target.subject.id);
			if (presentationIndex === -1) {
				return refuse('missing-target', `presentation "${target.subject.id}" is not in experience "${container.id}"`);
			}
			const previous = container.presentations[presentationIndex]!;
			if (views !== null) {
				if (viewPresent) {
					return refuse('invalid-payload', 'A View order is never combined with a captured View; reorder after the capture is accepted');
				}
				const authored = new Set(presentationViewIds(previous));
				if (views.length !== previous.views.length || !views.every((entry) => authored.has(entry.viewId))) {
					return refuse(
						'invalid-order',
						`the Views must be presentation "${previous.id}"'s own Views; reordering or changing a step never inserts or removes one`
					);
				}
			}
			let nextViews: ExperiencePresentationView[] = [...(views ?? previous.views)];
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
				nextViews = [...nextViews, nextViews.length === 0 ? { viewId } : { viewId, transition: 'cut' }];
			}
			const nextSubject = subject === null ? previous.subject : subject.value;
			if (label === null && (nextSubject === null || nextSubject.domain !== 'scene' || nextSubject.subject.kind !== 'entity')) {
				return refuse('invalid-payload', 'A Presentation follows its object\'s name only when it names a Scene entity; every other Presentation needs its own name.');
			}
			const updated: ExperiencePresentation = {
				id: previous.id,
				label: labelPresent ? (label ?? null) : previous.label,
				views: nextViews,
				subject: subject === null ? previous.subject : subject.value,
				text: textPresent ? text : previous.text,
				explorable: explorable ?? previous.explorable
			};
			const updatedExperience: Experience = {
				...container,
				presentations: container.presentations.map((candidate, index) => (index === presentationIndex ? updated : candidate))
			};
			let source = withExperience(envelope, updatedExperience);
			if (createdView !== null) {
				source = {
					...source,
					units: {
						...source.units,
						camera: {
							header: { ...envelope.units.camera.header },
							data: {
								formatVersion: CAMERA_UNIT_FORMAT_VERSION,
								views: [...envelope.units.camera.data.views, createdView],
								connections: envelope.units.camera.data.connections
							}
						}
					}
				};
			}
			const joined = withStraightConnections(envelope, source, travelPaths, capturedIds(request.intent, 'connection'));
			if (joined.kind === 'refused') return refuse(joined.code, joined.message);
			source = joined.envelope;
			const changedFields: string[] = [];
			if (updated.label !== previous.label) changedFields.push('label');
			if (textPresent) changedFields.push('text');
			if (updated.explorable !== previous.explorable) changedFields.push('explorable');
			if (subject !== null) changedFields.push('subject');
			if (JSON.stringify(updated.views) !== JSON.stringify(previous.views)) changedFields.push('views');
			const changes: OperationChange[] = [
				{ kind: 'experience.presentation.updated', subjectIds: [updated.id], fields: changedFields }
			];
			const correspondence: CorrespondenceEntry[] = [
				{
					relation: 'preserved',
					before: reference('experience', 'presentation', previous.id, [container.id], revisionOf(envelope, 'experience')),
					after: reference('experience', 'presentation', previous.id, [container.id], revisionOf(source, 'experience'))
				}
			];
			if (createdView !== null) {
				changes.push({ kind: 'camera.view.created', subjectIds: [createdView.id], fields: ['label', 'eye', 'target', 'fov', 'connectedViewIds'] });
				correspondence.push({
					relation: 'created',
					before: null,
					after: reference('camera', 'view', createdView.id, [], revisionOf(source, 'camera'))
				});
			}
			const records = connectionRecords(source, joined.connections);
			return prepared(request, source, [...changes, ...records.changes], [...correspondence, ...records.correspondence]);
		}
	};
}

const STOP_UPDATE_PAYLOAD_KEYS = ['entryViewId', 'staySeconds', 'invitation', 'transition', 'travelPath'] as const;
const STOP_TRAVEL_PATH_KEYS = ['fromViewId', 'toViewId'] as const;

function presentationOfStop(experience: Experience, stop: ExperienceStop): ExperiencePresentation | null {
	return experience.presentations.find((candidate) => candidate.id === stop.presentationId) ?? null;
}

/**
 * Edit one Stop's own visit facts — its entry View, its stay, its invitation —
 * or its outgoing step, in one intent.
 *
 * `entryViewId: null` follows the Presentation's Default; a named entry must be
 * one of its Views. `staySeconds` is finite and at least 1 s. `invitation` is
 * `null` (off) or `{ prompt }`. Experience review 1 — choosing Travel may carry
 * `travelPath` (the leaving and arriving Views). When no Camera path joins that
 * pair yet, the same accepted change adds the straight one (with the captured
 * `connection` id), so Travel plays at once and is one Undo.
 */
export function createExperienceStopUpdatePlanner(): DomainPlanner<ProjectEnvelope> {
	return {
		id: 'unit.experience-stop-update',
		kind: EXPERIENCE_STOP_UPDATE_KIND,
		admission: { domain: 'experience', compound: true, writes: ['camera'], units: true, resources: false },
		sourceKinds: [UNIT_SOURCE_KIND],
		sourceVersions: [UNIT_SOURCE_VERSION],
		prepare(request) {
			const envelope = envelopeOf(request);
			const reader = new ShapeReader();
			const payload = reader.object(request.intent.payload, '$.payload', STOP_UPDATE_PAYLOAD_KEYS);
			if (payload === null) return refuse('invalid-payload', 'The Stop payload is not a valid shape', reader.issues);
			const entryPresent = payload.entryViewId !== undefined;
			const entryViewId = !entryPresent || payload.entryViewId === null
				? null
				: reader.opaqueId(payload.entryViewId, '$.payload.entryViewId');
			const stayPresent = payload.staySeconds !== undefined;
			const staySeconds = stayPresent ? readStaySeconds(reader, payload.staySeconds, '$.payload.staySeconds') : null;
			const invitationPresent = payload.invitation !== undefined;
			const invitation = invitationPresent ? readInvitation(reader, payload.invitation, '$.payload.invitation') : null;
			const transitionPresent = payload.transition !== undefined;
			const transition = transitionPresent ? readOptionalTransition(reader, payload.transition, '$.payload.transition') : undefined;
			if (
				reader.issues.length !== 0 ||
				(entryPresent && payload.entryViewId !== null && entryViewId === null) ||
				(stayPresent && staySeconds === null) ||
				(invitation !== null && !invitation.ok) ||
				transition === null
			) {
				return refuse('invalid-payload', 'The Stop payload is not a valid shape', reader.issues);
			}
			if (!entryPresent && !stayPresent && !invitationPresent && !transitionPresent) {
				return refuse('invalid-payload', 'the Stop payload names no field to change');
			}
			let travelPath: ViewPair | null = null;
			if (payload.travelPath !== undefined) {
				const path = reader.object(payload.travelPath, '$.payload.travelPath', STOP_TRAVEL_PATH_KEYS);
				const fromViewId = path === null ? null : reader.string(path.fromViewId, '$.payload.travelPath.fromViewId');
				const toViewId = path === null ? null : reader.string(path.toViewId, '$.payload.travelPath.toViewId');
				if (fromViewId === null || toViewId === null || reader.issues.length !== 0) {
					return refuse('invalid-payload', 'The Stop payload is not a valid shape', reader.issues);
				}
				travelPath = { fromViewId, toViewId };
			}
			const target = targetOf(request.intent, 'experience', 'stop');
			if (target === null) {
				return refuse('unsupported-operation', 'experience-stop-update targets exactly one experience:stop reference');
			}
			const container = containerOf(envelope, target);
			if (container === undefined) {
				return refuse('missing-target', `the Stop's Experience "${target.instancePath[0] ?? '(unspecified)'}" is not in this envelope`);
			}
			const stopIndex = container.stops.findIndex((candidate) => candidate.id === target.subject.id);
			if (stopIndex === -1) return refuse('missing-target', `stop "${target.subject.id}" is not in experience "${container.id}"`);
			const previous = container.stops[stopIndex]!;
			const presentation = presentationOfStop(container, previous);
			if (presentation === null) {
				return refuse('missing-target', `stop "${previous.id}" names presentation "${previous.presentationId}", which this Experience does not carry`);
			}
			if (entryViewId !== null && !presentationViewIds(presentation).includes(entryViewId)) {
				return refuse('invalid-payload', `entry view "${entryViewId}" is not one of presentation "${presentation.id}"'s views`);
			}
			// A named entry stays pinned through reorder, even when it is currently
			// the Default. Only an explicit null follows the Presentation’s View 1.
			const nextEntry = entryPresent
				? entryViewId
				: previous.entryViewId;
			const updated: ExperienceStop = {
				id: previous.id,
				presentationId: previous.presentationId,
				entryViewId: nextEntry,
				staySeconds: staySeconds ?? previous.staySeconds,
				invitation: invitation !== null && invitation.ok ? invitation.value : previous.invitation,
				...(transitionPresent
					? transition === undefined ? {} : { transition }
					: previous.transition === undefined ? {} : { transition: previous.transition })
			};
			const candidate = withExperience(envelope, {
				...container,
				stops: container.stops.map((candidateStop, index) => (index === stopIndex ? updated : candidateStop))
			});
			const joined = withStraightConnections(
				envelope,
				candidate,
				travelPath === null ? [] : [travelPath],
				capturedIds(request.intent, 'connection')
			);
			if (joined.kind === 'refused') return refuse(joined.code, joined.message);
			const source = joined.envelope;
			const changedFields: string[] = [];
			if (updated.entryViewId !== previous.entryViewId) changedFields.push('entryViewId');
			if (updated.staySeconds !== previous.staySeconds) changedFields.push('staySeconds');
			if (JSON.stringify(updated.invitation) !== JSON.stringify(previous.invitation)) changedFields.push('invitation');
			if (updated.transition !== previous.transition) changedFields.push('transition');
			const records = connectionRecords(source, joined.connections);
			return prepared(
				request,
				source,
				[{ kind: 'experience.stop.updated', subjectIds: [updated.id], fields: changedFields }, ...records.changes],
				[
					{
						relation: 'preserved',
						before: reference('experience', 'stop', previous.id, [container.id], revisionOf(envelope, 'experience')),
						after: reference('experience', 'stop', previous.id, [container.id], revisionOf(source, 'experience'))
					},
					...records.correspondence
				]
			);
		}
	};
}

/* --- Camera connections (R217.S29) ----------------------------------------- */

/**
 * The straight Camera path a Travel needs, added to `candidate` unless the pair
 * is already joined. Shared by the Stop update so Travel and its path are one
 * accepted change; the standalone create planner keeps its own refusal for an
 * existing pair.
 */
function withStraightConnection(
	envelope: ProjectEnvelope,
	candidate: ProjectEnvelope,
	pair: { readonly fromViewId: string; readonly toViewId: string },
	connectionId: string | null
):
	| { readonly kind: 'joined'; readonly envelope: ProjectEnvelope; readonly connection: SceneConnection | null }
	| { readonly kind: 'refused'; readonly code: string; readonly message: string } {
	const views = candidate.units.camera.data.views;
	const fromView = views.find((view) => view.id === pair.fromViewId);
	const toView = views.find((view) => view.id === pair.toViewId);
	if (fromView === undefined || toView === undefined) {
		return { kind: 'refused', code: 'missing-target', message: 'A View this Travel needs is not in this envelope' };
	}
	if (candidate.units.camera.data.connections.some((connection) => sameUnorderedPair(connection, fromView.id, toView.id))) {
		return { kind: 'joined', envelope: candidate, connection: null };
	}
	if (connectionId === null || allIds(candidate).has(connectionId)) {
		return { kind: 'refused', code: 'invalid-identity', message: 'The captured Camera connection id is missing or already used' };
	}
	const connection: SceneConnection = {
		id: connectionId,
		fromNodeId: fromView.id,
		toNodeId: toView.id,
		clearance: CAMERA_CONNECTION_DEFAULT_CLEARANCE,
		positionPath: { kind: 'auto-bezier', anchors: [] }
	};
	const connected = views.map((view) => {
		const other = view.id === fromView.id ? toView.id : view.id === toView.id ? fromView.id : null;
		if (other === null || view.connectedViewIds.includes(other)) return view;
		return { ...view, connectedViewIds: [...view.connectedViewIds, other] };
	});
	return {
		kind: 'joined',
		connection,
		envelope: {
			...candidate,
			units: {
				...candidate.units,
				camera: {
					header: { ...candidate.units.camera.header },
					data: {
						formatVersion: CAMERA_UNIT_FORMAT_VERSION,
						views: connected,
						connections: [...candidate.units.camera.data.connections, connection]
					}
				}
			}
		}
	};
}

type RequiredTravelJoin =
	| {
			readonly kind: 'joined';
			readonly envelope: ProjectEnvelope;
			readonly connections: SceneConnection[];
			readonly cuts: readonly ExperienceNormalisedCut[];
	  }
	| { readonly kind: 'refused'; readonly code: string; readonly message: string };

/**
 * G1–G5, G7, D-12 — reconcile one edited Experience in the same accepted change:
 * write a Cut wherever a Travel can no longer mean anything, then join every
 * pair this edit newly leaves without a Camera connection with one straight path
 * from the captured id pool. The planner refuses rather than leave a new gap.
 */
function travelPairKey(pair: { readonly fromViewId: string; readonly toViewId: string }): string {
	return pair.fromViewId < pair.toViewId
		? `${pair.fromViewId}\u0000${pair.toViewId}`
		: `${pair.toViewId}\u0000${pair.fromViewId}`;
}

function withRequiredTravelPaths(
	envelope: ProjectEnvelope,
	candidate: ProjectEnvelope,
	experienceId: string,
	connectionIds: readonly string[]
): RequiredTravelJoin {
	const experience = candidate.units.experience.data.experiences.find((entry) => entry.id === experienceId);
	if (experience === undefined) {
		return { kind: 'refused', code: 'missing-target', message: `experience "${experienceId}" is not in this envelope` };
	}
	// Join only a pair this edit newly requires. An imported file may already carry
	// an unjoined Travel; unrelated edits keep it reported by the problems chip and
	// do not need a connection id pool to succeed.
	const before = envelope.units.experience.data.experiences.find((entry) => entry.id === experienceId);
	const beforePairs = new Set(
		(before === undefined ? [] : requiredTravelPairs(before, envelope.units.camera.data.connections)).map(travelPairKey)
	);
	const normalized = normalizeTransitions(experience);
	const reconciled = normalized.experience === experience ? candidate : withExperience(candidate, normalized.experience);
	const pairs = requiredTravelPairs(normalized.experience, reconciled.units.camera.data.connections).filter(
		(pair) => !beforePairs.has(travelPairKey(pair))
	);
	const joined = withStraightConnections(envelope, reconciled, pairs, connectionIds);
	if (joined.kind === 'refused') return joined;
	return { kind: 'joined', envelope: joined.envelope, connections: joined.connections, cuts: normalized.cuts };
}

/** Create one straight Camera connection between two existing Views. */
export const CAMERA_CONNECTION_CREATE_KIND = 'camera-connection-create';
/** Edit one Camera connection's interior anchors or per-direction duration. */
export const CAMERA_CONNECTION_UPDATE_KIND = 'camera-connection-update';
/** The canonical clearance a new Camera path carries; authored, never derived. */
export const CAMERA_CONNECTION_DEFAULT_CLEARANCE = 0.35;

const CONNECTION_ANCHOR_KEYS = ['id', 'position'] as const;
const CONNECTION_TIMING_KEYS = ['forward', 'reverse'] as const;
const CONNECTION_TIMING_DIRECTION_KEYS = ['durationSeconds'] as const;
const CONNECTION_UPDATE_KEYS = ['anchors', 'timing'] as const;
const CONNECTION_CREATE_PAYLOAD_KEYS: readonly string[] = [];

function sameUnorderedPair(
	connection: { readonly fromNodeId: string; readonly toNodeId: string },
	left: string,
	right: string
): boolean {
	return (
		(connection.fromNodeId === left && connection.toNodeId === right) ||
		(connection.fromNodeId === right && connection.toNodeId === left)
	);
}

/** The two ordered `camera:view` targets a create names: from first, then to. */
function orderedViewTargets(
	intent: PlannerRequest<ProjectEnvelope>['intent']
): readonly [SemanticReference, SemanticReference] | null {
	if (intent.targets.length !== 2) return null;
	const [from, to] = intent.targets;
	if (
		from.domain !== 'camera' ||
		to.domain !== 'camera' ||
		from.subject.kind !== 'view' ||
		to.subject.kind !== 'view'
	) {
		return null;
	}
	return [from, to];
}

/**
 * Read the optional authored interior anchors. Current-format anchors are
 * world-local `{id, position}` records: a Room-owned point or a duplicate id is
 * refused rather than normalized into a second coordinate basis.
 */
function readConnectionAnchors(reader: ShapeReader, input: unknown, path: string): ScenePathAnchor[] | null {
	if (!Array.isArray(input)) {
		reader.problem(path, 'not-an-array', `${path} must be an array of path anchors`);
		return null;
	}
	const anchors: ScenePathAnchor[] = [];
	const ids = new Set<string>();
	let ok = true;
	for (const [index, entry] of input.entries()) {
		const entryPath = `${path}[${index}]`;
		const record = reader.object(entry, entryPath, CONNECTION_ANCHOR_KEYS);
		if (record === null) {
			ok = false;
			continue;
		}
		const id = reader.opaqueId(record.id, `${entryPath}.id`);
		const position = reader.vector3(record.position, `${entryPath}.position`);
		if (id === null || position === null) {
			ok = false;
			continue;
		}
		if (ids.has(id)) {
			reader.problem(`${entryPath}.id`, 'duplicate-anchor', `Camera path anchor "${id}" appears more than once`);
			ok = false;
			continue;
		}
		ids.add(id);
		anchors.push({ id, position });
	}
	if (reader.issues.length !== 0) ok = false;
	return ok ? anchors : null;
}

type ConnectionTimingUpdate = {
	readonly forward?: { readonly durationSeconds: number | null };
	readonly reverse?: { readonly durationSeconds: number | null };
};

function readConnectionTiming(reader: ShapeReader, input: unknown, path: string): ConnectionTimingUpdate | null {
	const record = reader.object(input, path, CONNECTION_TIMING_KEYS);
	if (record === null) return null;
	let ok = true;
	const update: { forward?: { durationSeconds: number | null }; reverse?: { durationSeconds: number | null } } = {};
	for (const direction of ['forward', 'reverse'] as const) {
		const raw = record[direction];
		if (raw === undefined) continue;
		const directionPath = `${path}.${direction}`;
		const directionRecord = reader.object(raw, directionPath, CONNECTION_TIMING_DIRECTION_KEYS);
		if (directionRecord === null) {
			ok = false;
			continue;
		}
		if (!('durationSeconds' in directionRecord)) {
			reader.problem(directionPath, 'missing-field', `${directionPath} must name durationSeconds`);
			ok = false;
			continue;
		}
		if (directionRecord.durationSeconds === null) {
			update[direction] = { durationSeconds: null };
			continue;
		}
		const duration = reader.numberAtLeast(
			directionRecord.durationSeconds,
			`${directionPath}.durationSeconds`,
			0,
			true
		);
		if (duration === null) {
			ok = false;
			continue;
		}
		update[direction] = { durationSeconds: duration };
	}
	if (!ok || reader.issues.length !== 0) return null;
	if (update.forward === undefined && update.reverse === undefined) {
		reader.problem(path, 'missing-field', `${path} names no direction to change`);
		return null;
	}
	return update;
}

/** Apply duration-only changes, preserving every other field of both directions. */
function mergeConnectionTiming(
	previous: SceneConnection['timing'],
	update: ConnectionTimingUpdate
): SceneConnection['timing'] {
	const next: NonNullable<SceneConnection['timing']> = { ...(previous ?? {}) };
	for (const direction of ['forward', 'reverse'] as const) {
		const change = update[direction];
		if (change === undefined) continue;
		const current = next[direction];
		if (change.durationSeconds === null) {
			if (current === undefined) continue;
			const { durationSeconds: _cleared, ...rest } = current;
			if (Object.keys(rest).length === 0) delete next[direction];
			else next[direction] = rest;
			continue;
		}
		next[direction] = { ...(current ?? {}), durationSeconds: change.durationSeconds };
	}
	return next.forward === undefined && next.reverse === undefined ? undefined : next;
}

/**
 * Create one straight Camera path between two current Views (E11).
 *
 * Targets: exactly two `camera:view` references, from then to. The planner
 * allocates no identity — the captured connection id arrives in
 * `intent.allocatedIds` — writes an empty `auto-bezier` anchor list, the
 * canonical clearance and no timing, so Camera's own automatic duration is in
 * effect. An existing connection on the same unordered pair refuses: a Travel
 * never invents a duplicate path or picks one silently.
 */
export function createCameraConnectionCreatePlanner(): DomainPlanner<ProjectEnvelope> {
	return {
		id: 'unit.camera-connection-create',
		kind: CAMERA_CONNECTION_CREATE_KIND,
		admission: { domain: 'camera', compound: false, units: true, resources: false },
		sourceKinds: [UNIT_SOURCE_KIND],
		sourceVersions: [UNIT_SOURCE_VERSION],
		prepare(request) {
			const envelope = envelopeOf(request);
			const reader = new ShapeReader();
			const payload = reader.object(request.intent.payload, '$.payload', CONNECTION_CREATE_PAYLOAD_KEYS);
			if (payload === null || reader.issues.length !== 0) {
				return refuse('invalid-payload', 'The Camera path payload is not empty', reader.issues);
			}
			const pair = orderedViewTargets(request.intent);
			if (pair === null) {
				return refuse('unsupported-operation', 'camera-connection-create targets exactly two camera:view references, from then to');
			}
			const [fromTarget, toTarget] = pair;
			if (fromTarget.subject.id === toTarget.subject.id) {
				return refuse('same-view', 'A Camera path needs two different Views');
			}
			const views = envelope.units.camera.data.views;
			const fromView = views.find((view) => view.id === fromTarget.subject.id);
			const toView = views.find((view) => view.id === toTarget.subject.id);
			if (fromView === undefined || toView === undefined) {
				return refuse('missing-target', 'A Camera path endpoint is not a View in this envelope');
			}
			const existing = envelope.units.camera.data.connections.find((connection) =>
				sameUnorderedPair(connection, fromView.id, toView.id)
			);
			if (existing !== undefined) {
				return refuse(
					'path-already-exists',
					`A Camera path already joins "${fromView.label}" and "${toView.label}"`
				);
			}
			const connectionId = capturedId(request.intent, 'connection');
			if (connectionId === null || allIds(envelope).has(connectionId)) {
				return refuse('invalid-identity', 'The captured Camera connection id is missing or already used');
			}
			const connection: SceneConnection = {
				id: connectionId,
				fromNodeId: fromView.id,
				toNodeId: toView.id,
				clearance: CAMERA_CONNECTION_DEFAULT_CLEARANCE,
				positionPath: { kind: 'auto-bezier', anchors: [] }
			};
			const connected = views.map((view) => {
				const other = view.id === fromView.id ? toView.id : view.id === toView.id ? fromView.id : null;
				if (other === null || view.connectedViewIds.includes(other)) return view;
				return { ...view, connectedViewIds: [...view.connectedViewIds, other] };
			});
			const candidate: ProjectEnvelope = {
				...envelope,
				units: {
					...envelope.units,
					camera: {
						header: { ...envelope.units.camera.header },
						data: {
							formatVersion: CAMERA_UNIT_FORMAT_VERSION,
							views: connected,
							connections: [...envelope.units.camera.data.connections, connection]
						}
					}
				}
			};
			return prepared(request, candidate, [
						{
							kind: 'camera.connection.created',
							subjectIds: [connection.id],
							fields: ['fromNodeId', 'toNodeId', 'clearance', 'positionPath']
						}
					], [
						{
							relation: 'created',
							before: null,
							after: reference('camera', 'connection', connection.id, [], revisionOf(candidate, 'camera'))
						}
					]);
		}
	};
}

/**
 * Edit one Camera connection's interior anchors or one direction's duration.
 *
 * Targets: exactly one `camera:connection` reference. `anchors` replaces the
 * interior list; `timing.forward` / `timing.reverse` writes only
 * `durationSeconds`, and `null` clears only that direction's duration. Easing,
 * the other direction, clearance, endpoints and every other field survive
 * verbatim. A payload the connection already satisfies refuses as a no-op.
 */
export function createCameraConnectionUpdatePlanner(): DomainPlanner<ProjectEnvelope> {
	return {
		id: 'unit.camera-connection-update',
		kind: CAMERA_CONNECTION_UPDATE_KIND,
		admission: { domain: 'camera', compound: false, units: true, resources: false },
		sourceKinds: [UNIT_SOURCE_KIND],
		sourceVersions: [UNIT_SOURCE_VERSION],
		prepare(request) {
			const envelope = envelopeOf(request);
			const reader = new ShapeReader();
			const payload = reader.object(request.intent.payload, '$.payload', CONNECTION_UPDATE_KEYS);
			if (payload === null) return refuse('invalid-payload', 'The Camera path payload is not a valid shape', reader.issues);
			const anchors = payload.anchors === undefined
				? undefined
				: readConnectionAnchors(reader, payload.anchors, '$.payload.anchors');
			const timing = payload.timing === undefined
				? undefined
				: readConnectionTiming(reader, payload.timing, '$.payload.timing');
			if (
				reader.issues.length !== 0 ||
				(payload.anchors !== undefined && anchors === null) ||
				(payload.timing !== undefined && timing === null)
			) {
				return refuse('invalid-payload', 'The Camera path payload is not a valid shape', reader.issues);
			}
			if (anchors === undefined && timing === undefined) {
				return refuse('invalid-payload', 'The Camera path payload names no field to change');
			}
			const target = targetOf(request.intent, 'camera', 'connection');
			if (target === null) {
				return refuse('unsupported-operation', 'camera-connection-update targets exactly one camera:connection reference');
			}
			const index = envelope.units.camera.data.connections.findIndex(
				(connection) => connection.id === target.subject.id
			);
			if (index === -1) {
				return refuse('missing-target', `camera connection "${target.subject.id}" is not in this envelope`);
			}
			const previous = envelope.units.camera.data.connections[index]!;
			const nextAnchors = anchors === undefined || anchors === null ? undefined : anchors;
			const nextTiming = timing === undefined || timing === null ? previous.timing : mergeConnectionTiming(previous.timing, timing);
			const updated: SceneConnection = {
				...previous,
				...(nextAnchors === undefined ? {} : { positionPath: { ...previous.positionPath, anchors: nextAnchors } }),
				...(timing === undefined || timing === null ? {} : nextTiming === undefined ? {} : { timing: nextTiming })
			};
			if (timing !== undefined && nextTiming === undefined) delete (updated as { timing?: unknown }).timing;
			const changedFields: string[] = [];
			if (anchors !== undefined && JSON.stringify(previous.positionPath) !== JSON.stringify(updated.positionPath)) {
				changedFields.push('anchors');
			}
			if (timing !== undefined && JSON.stringify(previous.timing) !== JSON.stringify(updated.timing)) {
				changedFields.push('timing');
			}
			if (changedFields.length === 0) {
				return refuse('no-op', 'The Camera path already has these values');
			}
			const candidate: ProjectEnvelope = {
				...envelope,
				units: {
					...envelope.units,
					camera: {
						header: { ...envelope.units.camera.header },
						data: {
							formatVersion: CAMERA_UNIT_FORMAT_VERSION,
							views: envelope.units.camera.data.views,
							connections: envelope.units.camera.data.connections.map((connection, position) =>
								position === index ? updated : connection
							)
						}
					}
				}
			};
			return prepared(request, candidate, [{ kind: 'camera.connection.updated', subjectIds: [updated.id], fields: changedFields }], [
						{
							relation: 'preserved',
							before: reference('camera', 'connection', previous.id, [], revisionOf(envelope, 'camera')),
							after: reference('camera', 'connection', previous.id, [], revisionOf(candidate, 'camera'))
						}
					]);
		}
	};
}

/* --- Experience and Guide fields (R217.S26) -------------------------------- */

/** The Experience a member reference names through its one-element instance path. */
function containerOf(envelope: ProjectEnvelope, target: SemanticReference): Experience | undefined {
	return target.instancePath.length === 1
		? envelope.units.experience.data.experiences.find((candidate) => candidate.id === target.instancePath[0])
		: undefined;
}

/** The envelope with one Experience replaced (and, when given, the Camera payload). */
function withExperience(
	envelope: ProjectEnvelope,
	experience: Experience,
	camera: Pick<ProjectEnvelope['units']['camera']['data'], 'views' | 'connections'> | null = null
): ProjectEnvelope {
	return {
		...envelope,
		units: {
			...envelope.units,
			camera: camera === null
				? envelope.units.camera
				: {
						header: { ...envelope.units.camera.header },
						data: { formatVersion: CAMERA_UNIT_FORMAT_VERSION, views: camera.views, connections: camera.connections }
					},
			experience: {
				header: { ...envelope.units.experience.header },
				data: {
					formatVersion: EXPERIENCE_UNIT_FORMAT_VERSION,
					experiences: envelope.units.experience.data.experiences.map((candidate) =>
						candidate.id === experience.id ? experience : candidate
					)
				}
			}
		}
	};
}

function prepared(
	request: PlannerRequest<ProjectEnvelope>,
	candidate: ProjectEnvelope,
	changes: OperationChange[],
	correspondence: CorrespondenceEntry[]
): PlannerOutcome<ProjectEnvelope> {
	const envelope = envelopeOf(request);
	let source = candidate;
	const reconciledChanges = [...changes];
	const reconciledCorrespondence = [...correspondence];
	for (const experience of source.units.experience.data.experiences) {
		const before = envelope.units.experience.data.experiences.find((entry) => entry.id === experience.id);
		if (before === undefined || before === experience) continue;
		const joined = withRequiredTravelPaths(envelope, source, experience.id, capturedIds(request.intent, 'connection'));
		if (joined.kind === 'refused') return refuse(joined.code, joined.message);
		source = joined.envelope;
		for (const cut of joined.cuts) {
			reconciledChanges.push(
				cut.kind === 'stop'
					? {
							kind: 'experience.transition.normalised',
							subjectIds: cut.nextStopId === undefined ? [cut.stopId] : [cut.stopId, cut.nextStopId],
							fields: ['transition']
						}
					: {
							kind: 'experience.presentation-view.transition.normalised',
							subjectIds: [cut.presentationId, cut.viewId],
							fields: ['transition']
						}
			);
		}
		const records = connectionRecords(source, joined.connections);
		reconciledChanges.push(...records.changes);
		reconciledCorrespondence.push(...records.correspondence);
	}
	return {
		kind: 'prepared',
		candidate: {
			operationId: request.intent.operationId,
			sourceKind: request.snapshot.sourceKind,
			sourceVersion: request.snapshot.sourceVersion,
			source,
			changes: reconciledChanges,
			correspondence: reconciledCorrespondence,
			diagnostics: []
		}
	};
}

const EXPERIENCE_UPDATE_KEYS = ['label', 'entryGuideId', 'welcome'] as const;

/**
 * Edit one Experience's label or its Opening Guide.
 *
 * Targets: exactly one `experience:experience` reference. `entryGuideId` names one
 * of the Experience's Guides; it is never cleared while a Guide exists, because
 * the Opening Guide is null only for an Experience with no Guide.
 */
export function createExperienceUpdatePlanner(): DomainPlanner<ProjectEnvelope> {
	return {
		id: 'unit.experience-update',
		kind: EXPERIENCE_UPDATE_KIND,
		admission: { domain: 'experience', compound: false, units: true, resources: false },
		sourceKinds: [UNIT_SOURCE_KIND],
		sourceVersions: [UNIT_SOURCE_VERSION],
		prepare(request) {
			const envelope = envelopeOf(request);
			const reader = new ShapeReader();
			const payload = reader.object(request.intent.payload, '$.payload', EXPERIENCE_UPDATE_KEYS);
			if (payload === null) return refuse('invalid-payload', 'The Experience payload is not a valid shape', reader.issues);
			const label = payload.label === undefined ? undefined : reader.string(payload.label, '$.payload.label');
			const entryGuideId = payload.entryGuideId === undefined ? undefined : reader.opaqueId(payload.entryGuideId, '$.payload.entryGuideId');
			const welcomePresent = payload.welcome !== undefined;
			const welcome = !welcomePresent || payload.welcome === null
				? null
				: readExperienceText(reader, payload.welcome, '$.payload.welcome', EXPERIENCE_WELCOME_MAX_LENGTH);
			if (label === null || entryGuideId === null || reader.issues.length !== 0) {
				return refuse('invalid-payload', 'The Experience payload is not a valid shape', reader.issues);
			}
			if (label === undefined && entryGuideId === undefined && !welcomePresent) {
				return refuse('invalid-payload', 'the Experience payload names no field to change');
			}
			if (label !== undefined && label.trim() === '') return refuse('invalid-payload', 'A name is needed');
			const target = targetOf(request.intent, 'experience', 'experience');
			if (target === null) {
				return refuse('unsupported-operation', 'experience-update targets exactly one experience:experience reference');
			}
			const previous = envelope.units.experience.data.experiences.find((candidate) => candidate.id === target.subject.id);
			if (previous === undefined) return refuse('missing-target', `experience "${target.subject.id}" is not in this envelope`);
			if (entryGuideId !== undefined && !previous.guides.some((guide) => guide.id === entryGuideId)) {
				return refuse('missing-target', `guide "${entryGuideId}" is not in experience "${previous.id}"`);
			}
			const updated: Experience = {
				...previous,
				label: label ?? previous.label,
				entryGuideId: entryGuideId ?? previous.entryGuideId,
				welcome: welcomePresent ? welcome : previous.welcome
			};
			const candidate = withExperience(envelope, updated);
			const fields: string[] = [];
			if (updated.label !== previous.label) fields.push('label');
			if (welcomePresent) fields.push('welcome');
			if (updated.entryGuideId !== previous.entryGuideId) fields.push('entryGuideId');
			return prepared(request, candidate, [{ kind: 'experience.updated', subjectIds: [updated.id], fields }], [
				{
					relation: 'preserved',
					before: reference('experience', 'experience', previous.id, [], revisionOf(envelope, 'experience')),
					after: reference('experience', 'experience', previous.id, [], revisionOf(candidate, 'experience'))
				}
			]);
		}
	};
}

const GUIDE_UPDATE_KEYS = ['label', 'pacing'] as const;

/**
 * Edit one Guide's label, its start Stop or its pacing (sheet §31: Automatic
 * moves on when each stay ends; Manual waits for Next and keeps every stay).
 *
 * Targets: exactly one `experience:guide` reference scoped by its Experience.
 * A Guide has no start Stop: its first ordered Stop starts it, so this never
 * reorders and reordering never moves the start (D-1, E6).
 */
export function createExperienceGuideUpdatePlanner(): DomainPlanner<ProjectEnvelope> {
	return {
		id: 'unit.experience-guide-update',
		kind: EXPERIENCE_GUIDE_UPDATE_KIND,
		admission: { domain: 'experience', compound: false, units: true, resources: false },
		sourceKinds: [UNIT_SOURCE_KIND],
		sourceVersions: [UNIT_SOURCE_VERSION],
		prepare(request) {
			const envelope = envelopeOf(request);
			const reader = new ShapeReader();
			const payload = reader.object(request.intent.payload, '$.payload', GUIDE_UPDATE_KEYS);
			if (payload === null) return refuse('invalid-payload', 'The Guide payload is not a valid shape', reader.issues);
			const label = payload.label === undefined ? undefined : reader.string(payload.label, '$.payload.label');
			const pacing = payload.pacing === undefined
				? undefined
				: (reader.tag(payload.pacing, '$.payload.pacing', EXPERIENCE_GUIDE_PACINGS) as ExperienceGuidePacing | null);
			if (label === null || pacing === null) {
				return refuse('invalid-payload', 'The Guide payload is not a valid shape', reader.issues);
			}
			if (label === undefined && pacing === undefined) {
				return refuse('invalid-payload', 'the Guide payload names no field to change');
			}
			if (label !== undefined && label.trim() === '') return refuse('invalid-payload', 'A name is needed');
			const target = targetOf(request.intent, 'experience', 'guide');
			if (target === null) {
				return refuse('unsupported-operation', 'experience-guide-update targets exactly one experience:guide reference');
			}
			const container = containerOf(envelope, target);
			if (container === undefined) {
				return refuse('missing-target', `the Guide's Experience "${target.instancePath[0] ?? '(unspecified)'}" is not in this envelope`);
			}
			const previous = container.guides.find((candidate) => candidate.id === target.subject.id);
			if (previous === undefined) return refuse('missing-target', `guide "${target.subject.id}" is not in experience "${container.id}"`);
			const updated: ExperienceGuide = {
				...previous,
				label: label ?? previous.label,
				pacing: pacing ?? previous.pacing
			};
			const candidate = withExperience(envelope, {
				...container,
				guides: container.guides.map((candidate) => (candidate.id === updated.id ? updated : candidate))
			});
			const fields: string[] = [];
			if (updated.label !== previous.label) fields.push('label');
			if (updated.pacing !== previous.pacing) fields.push('pacing');
			return prepared(request, candidate, [{ kind: 'experience.guide.updated', subjectIds: [updated.id], fields }], [
				{
					relation: 'preserved',
					before: reference('experience', 'guide', previous.id, [container.id], revisionOf(envelope, 'experience')),
					after: reference('experience', 'guide', previous.id, [container.id], revisionOf(candidate, 'experience'))
				}
			]);
		}
	};
}

/* --- Removal (R217.S26, E4) ------------------------------------------------ */

/**
 * The changes and correspondence of an installed removal plan: every removed
 * subject is `retired`, every changed one is reported under its own change kind.
 */
function removalRecord(
	envelope: ProjectEnvelope,
	experienceId: string,
	plan: Extract<ExperienceRemovalPlan, { kind: 'planned' }>
): { changes: OperationChange[]; correspondence: CorrespondenceEntry[] } {
	const changes: OperationChange[] = [];
	const correspondence: CorrespondenceEntry[] = [];
	const retire = (domain: 'experience' | 'camera', kind: string, id: string, path: readonly string[]) =>
		correspondence.push({ relation: 'retired', before: reference(domain, kind, id, path, revisionOf(envelope, domain)), after: null });
	for (const consequence of plan.consequences) {
		switch (consequence.kind) {
			case 'stop-removed':
				changes.push({ kind: 'experience.stop.removed', subjectIds: [consequence.stopId], fields: [] });
				retire('experience', 'stop', consequence.stopId, [experienceId]);
				break;
			case 'presentation-removed':
				changes.push({ kind: 'experience.presentation.removed', subjectIds: [consequence.presentationId], fields: [] });
				retire('experience', 'presentation', consequence.presentationId, [experienceId]);
				break;
			case 'guide-removed':
				changes.push({ kind: 'experience.guide.removed', subjectIds: [consequence.guideId], fields: [] });
				retire('experience', 'guide', consequence.guideId, [experienceId]);
				break;
			case 'view-deleted':
				changes.push({ kind: 'camera.view.removed', subjectIds: [consequence.viewId], fields: [] });
				retire('camera', 'view', consequence.viewId, []);
				break;
			case 'connection-deleted':
				changes.push({ kind: 'camera.connection.removed', subjectIds: [consequence.connectionId], fields: [] });
				break;
			case 'view-removed':
			case 'default-changed':
				changes.push({ kind: 'experience.presentation.updated', subjectIds: [consequence.presentationId], fields: ['views'] });
				break;
			case 'detour-removed':
				changes.push({ kind: 'experience.detour.removed', subjectIds: [consequence.detourId], fields: [] });
				break;
			case 'stop-entry-fallback':
				changes.push({ kind: 'experience.stop.updated', subjectIds: [consequence.stopId], fields: ['entryViewId'] });
				break;
			case 'opening-guide-moved':
				changes.push({ kind: 'experience.updated', subjectIds: [experienceId], fields: ['entryGuideId'] });
				break;
			case 'view-kept':
				break;
		}
	}
	return { changes, correspondence };
}

/** Run one removal plan and install it, or refuse with its reason. */
function installRemoval(
	request: PlannerRequest<ProjectEnvelope>,
	envelope: ProjectEnvelope,
	experienceId: string,
	plan: ExperienceRemovalPlan
): PlannerOutcome<ProjectEnvelope> {
	if (plan.kind === 'refused') return refuse(plan.code, plan.reason);
	const candidate = withExperience(envelope, plan.experience, plan.camera);
	const record = removalRecord(envelope, experienceId, plan);
	return prepared(request, candidate, record.changes, record.correspondence);
}

function emptyPayload(request: PlannerRequest<ProjectEnvelope>, what: string): PrepareFailure | null {
	const reader = new ShapeReader();
	const payload = reader.object(request.intent.payload, '$.payload', [] as const);
	return payload === null ? refuse('invalid-payload', `The ${what} removal payload is not a valid shape`, reader.issues) : null;
}

/**
 * Remove one Stop (E4). Targets: exactly one `experience:stop` reference. The
 * Stop leaves every Guide that orders it; the only Stop of a Guide and a Stop a
 * Detour uses refuse.
 */
export function createExperienceStopRemovePlanner(): DomainPlanner<ProjectEnvelope> {
	return {
		id: 'unit.experience-stop-remove',
		kind: EXPERIENCE_STOP_REMOVE_KIND,
		admission: { domain: 'experience', compound: true, writes: ['camera'], units: true, resources: false },
		sourceKinds: [UNIT_SOURCE_KIND],
		sourceVersions: [UNIT_SOURCE_VERSION],
		prepare(request) {
			const envelope = envelopeOf(request);
			const invalid = emptyPayload(request, 'Stop');
			if (invalid !== null) return invalid;
			const target = targetOf(request.intent, 'experience', 'stop');
			if (target === null) return refuse('unsupported-operation', 'experience-stop-remove targets exactly one experience:stop reference');
			const container = containerOf(envelope, target);
			if (container === undefined) {
				return refuse('missing-target', `the Stop's Experience "${target.instancePath[0] ?? '(unspecified)'}" is not in this envelope`);
			}
			return installRemoval(request, envelope, container.id, planStopRemoval(container, target.subject.id));
		}
	};
}

/**
 * Remove one Guide (E4). Targets: exactly one `experience:guide` reference. Its
 * Stops no other Guide orders go with it; the Opening Guide passes to the next.
 */
export function createExperienceGuideRemovePlanner(): DomainPlanner<ProjectEnvelope> {
	return {
		id: 'unit.experience-guide-remove',
		kind: EXPERIENCE_GUIDE_REMOVE_KIND,
		admission: { domain: 'experience', compound: true, writes: ['camera'], units: true, resources: false },
		sourceKinds: [UNIT_SOURCE_KIND],
		sourceVersions: [UNIT_SOURCE_VERSION],
		prepare(request) {
			const envelope = envelopeOf(request);
			const invalid = emptyPayload(request, 'Guide');
			if (invalid !== null) return invalid;
			const target = targetOf(request.intent, 'experience', 'guide');
			if (target === null) return refuse('unsupported-operation', 'experience-guide-remove targets exactly one experience:guide reference');
			const container = containerOf(envelope, target);
			if (container === undefined) {
				return refuse('missing-target', `the Guide's Experience "${target.instancePath[0] ?? '(unspecified)'}" is not in this envelope`);
			}
			return installRemoval(request, envelope, container.id, planGuideRemoval(container, target.subject.id));
		}
	};
}

/**
 * Remove one Presentation (E4). Targets: exactly one `experience:presentation`
 * reference. Its Stops, Gates and unshared Camera Views (with their connections)
 * go with it, so it may write Camera.
 */
export function createExperiencePresentationRemovePlanner(): DomainPlanner<ProjectEnvelope> {
	return {
		id: 'unit.experience-presentation-remove',
		kind: EXPERIENCE_PRESENTATION_REMOVE_KIND,
		admission: { domain: 'experience', compound: true, writes: ['camera'], units: true, resources: false },
		sourceKinds: [UNIT_SOURCE_KIND],
		sourceVersions: [UNIT_SOURCE_VERSION],
		prepare(request) {
			const envelope = envelopeOf(request);
			const invalid = emptyPayload(request, 'Presentation');
			if (invalid !== null) return invalid;
			const target = targetOf(request.intent, 'experience', 'presentation');
			if (target === null) {
				return refuse('unsupported-operation', 'experience-presentation-remove targets exactly one experience:presentation reference');
			}
			const container = containerOf(envelope, target);
			if (container === undefined) {
				return refuse('missing-target', `the Presentation's Experience "${target.instancePath[0] ?? '(unspecified)'}" is not in this envelope`);
			}
			return installRemoval(
				request,
				envelope,
				container.id,
				planPresentationRemoval(envelope.units.experience.data.experiences, envelope.units.camera.data, container.id, target.subject.id)
			);
		}
	};
}

const VIEW_REMOVE_KEYS = ['viewId', 'defaultViewId'] as const;

/**
 * Remove one View from one Presentation (E4). Targets: exactly one
 * `experience:presentation` reference; the payload names the View and, when it
 * is the Default, the new Default. The Camera View is deleted only when no other
 * Presentation lists it, so it may write Camera.
 */
export function createExperiencePresentationViewRemovePlanner(): DomainPlanner<ProjectEnvelope> {
	return {
		id: 'unit.experience-presentation-view-remove',
		kind: EXPERIENCE_PRESENTATION_VIEW_REMOVE_KIND,
		admission: { domain: 'experience', compound: true, writes: ['camera'], units: true, resources: false },
		sourceKinds: [UNIT_SOURCE_KIND],
		sourceVersions: [UNIT_SOURCE_VERSION],
		prepare(request) {
			const envelope = envelopeOf(request);
			const reader = new ShapeReader();
			const payload = reader.object(request.intent.payload, '$.payload', VIEW_REMOVE_KEYS);
			if (payload === null) return refuse('invalid-payload', 'The View removal payload is not a valid shape', reader.issues);
			const viewId = reader.opaqueId(payload.viewId, '$.payload.viewId');
			const defaultViewId = payload.defaultViewId === undefined || payload.defaultViewId === null
				? null
				: reader.opaqueId(payload.defaultViewId, '$.payload.defaultViewId');
			if (viewId === null || (payload.defaultViewId !== undefined && payload.defaultViewId !== null && defaultViewId === null)) {
				return refuse('invalid-payload', 'The View removal payload is not a valid shape', reader.issues);
			}
			const target = targetOf(request.intent, 'experience', 'presentation');
			if (target === null) {
				return refuse('unsupported-operation', 'experience-presentation-view-remove targets exactly one experience:presentation reference');
			}
			const container = containerOf(envelope, target);
			if (container === undefined) {
				return refuse('missing-target', `the Presentation's Experience "${target.instancePath[0] ?? '(unspecified)'}" is not in this envelope`);
			}
			return installRemoval(
				request,
				envelope,
				container.id,
				planPresentationViewRemoval(
					envelope.units.experience.data.experiences,
					envelope.units.camera.data,
					container.id,
					target.subject.id,
					viewId,
					defaultViewId
				)
			);
		}
	};
}

/** Every planner a host registers for this slice's authored operations. */
/** Experience review 1 (R5) — choose the World's environment preset. */
export const SCENE_ENVIRONMENT_SET_KIND = 'scene-environment-set';

/**
 * Set the Scene's World environment to one fixed preset. No targets: the Scene
 * holds one environment. `paper` is written as the field's absence, so a World
 * that never chose one and a World set back to Paper are the same bytes.
 */
export function createSceneEnvironmentSetPlanner(): DomainPlanner<ProjectEnvelope> {
	return {
		id: 'unit.scene-environment-set',
		kind: SCENE_ENVIRONMENT_SET_KIND,
		admission: { domain: 'scene', compound: false, units: true, resources: false },
		sourceKinds: [UNIT_SOURCE_KIND],
		sourceVersions: [UNIT_SOURCE_VERSION],
		prepare(request) {
			const envelope = envelopeOf(request);
			const reader = new ShapeReader();
			const payload = reader.object(request.intent.payload, '$.payload', ['preset'] as const);
			const preset = payload === null ? null : payload.preset;
			if (typeof preset !== 'string' || !(SCENE_ENVIRONMENT_PRESETS as readonly string[]).includes(preset)) {
				return refuse('invalid-payload', 'Choose one of the environment presets', reader.issues);
			}
			if (request.intent.targets.length !== 0) {
				return refuse('unsupported-operation', 'scene-environment-set takes no targets');
			}
			const scene = envelope.units.scene.data;
			const previous = scene.environment?.preset ?? 'paper';
			if (previous === preset) return refuse('no-change', 'The World already uses this environment');
			const { environment: _previous, ...rest } = scene;
			const data = preset === 'paper' ? rest : { ...rest, environment: { preset: preset as SceneEnvironmentPreset } };
			const candidate: ProjectEnvelope = {
				...envelope,
				units: { ...envelope.units, scene: { header: { ...envelope.units.scene.header }, data } }
			};
			return prepared(request, candidate, [{ kind: 'scene.environment.updated', subjectIds: [], fields: ['environment'] }], []);
		}
	};
}

export function createUnitCandidatePlanners(options: CaptureBindOptions = {}): DomainPlanner<ProjectEnvelope>[] {
	return [
		createSceneEnvironmentSetPlanner(),
		createCameraViewUpdatePlanner(),
		createCameraConnectionCreatePlanner(),
		createCameraConnectionUpdatePlanner(),
		createExperienceCreatePlanner(),
		createCaptureBindPlanner(options),
		createExperienceGuideCreatePlanner(),
		createExperienceStopCreatePlanner(),
		createExperienceGuideOrderPlanner(),
		createExperiencePresentationUpdatePlanner(),
		createExperienceStopUpdatePlanner(),
		createExperienceUpdatePlanner(),
		createExperienceGuideUpdatePlanner(),
		createExperienceStopRemovePlanner(),
		createExperiencePresentationViewRemovePlanner(),
		createExperiencePresentationRemovePlanner(),
		createExperienceGuideRemovePlanner()
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
