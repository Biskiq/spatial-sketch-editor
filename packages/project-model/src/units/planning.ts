/**
 * `F4.intent-acceptance@1:unit-acceptance-v1` — the F.2 candidate planners
 * (T3.P01.S05).
 *
 * Two real operations, one deterministic shape:
 *
 * - `camera-view-update` rewrites one Camera View's label/pose/FOV. The View's
 *   connectivity is **not** editable here: changing adjacency requires a
 *   connection record, and that is a Camera graph operation this slice does not
 *   invent.
 * - `experience-presentation-stop-create` creates one Camera View, one
 *   Presentation and, when the payload asks, one Stop inserted into an existing
 *   Guide — one candidate, one acceptance, one undo. The optional Stop is the
 *   only difference between the single-presentation and guided cases; it is not
 *   a second operation.
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
	EXPERIENCE_UNIT_FORMAT_VERSION,
	type CameraView,
	type Experience,
	type ExperienceContinuation,
	type ExperienceGuide,
	type ExperiencePresentation,
	type ExperienceStop,
	type ProjectEnvelope,
	type ResourcePin,
	type TypedResource,
	RESOURCE_UNIT_FORMAT_VERSION
} from './types';

/** The admitted source pair these planners plan against. */
export const UNIT_SOURCE_KIND = 'unit-envelope';
export const UNIT_SOURCE_VERSION = 1;

/** The single-domain Camera View operation kind. */
export const CAMERA_VIEW_UPDATE_KIND = 'camera-view-update';
/** The compound Camera View + Experience Presentation (+ optional Stop) kind. */
export const EXPERIENCE_PRESENTATION_STOP_CREATE_KIND = 'experience-presentation-stop-create';

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

const CONTINUATION_KEYS = ['kind', 'stopId'] as const;
const STOP_PAYLOAD_KEYS = ['holdSeconds', 'continuation', 'guideId', 'afterStopId'] as const;
const COMPOUND_PAYLOAD_KEYS = ['view', 'presentationLabel', 'stop', 'resource'] as const;
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

type StopPayload = {
	readonly holdSeconds: number | undefined;
	readonly continuation: ExperienceContinuation | undefined;
	readonly guideId: string;
	readonly afterStopId: string | null;
};

function readContinuation(reader: ShapeReader, input: unknown, path: string): ExperienceContinuation | null | undefined {
	if (input === undefined) return undefined;
	const record = reader.object(input, path, CONTINUATION_KEYS);
	if (record === null) return null;
	const kind = reader.tag(record.kind, `${path}.kind`, ['sequence-next', 'stop', 'end']);
	if (kind === null) return null;
	if (kind !== 'stop') {
		if (record.stopId !== undefined) reader.problem(`${path}.stopId`, 'unknown-key', `${path}.stopId is not part of the ${kind} continuation`);
		return { kind: kind as 'sequence-next' | 'end' };
	}
	const stopId = reader.opaqueId(record.stopId, `${path}.stopId`);
	return stopId === null ? null : { kind: 'stop', stopId };
}

function readStopPayload(reader: ShapeReader, input: unknown, path: string): StopPayload | null {
	const record = reader.object(input, path, STOP_PAYLOAD_KEYS);
	if (record === null) return null;
	const holdSeconds = record.holdSeconds === undefined ? undefined : reader.numberAtLeast(record.holdSeconds, `${path}.holdSeconds`, 0, false);
	const continuation = readContinuation(reader, record.continuation, `${path}.continuation`);
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

export type PresentationStopCreateOptions = {
	/** Admit a captured resource staging set; the registry must grant it too. */
	readonly resourceStaging?: boolean;
};

/**
 * Create one Camera View, one Presentation and, when requested, one Stop in an
 * existing Guide.
 *
 * Targets: exactly one `experience:experience` reference (the container the
 * Presentation and Stop join). Resource targets, when present, must be staged by
 * the host and the captured set must equal the staging derived from the
 * **candidate** envelope; a resource target without a captured staging set
 * refuses, and so does a captured set that names a different revision or pin.
 */
export function createPresentationStopCreatePlanner(
	options: PresentationStopCreateOptions = {}
): DomainPlanner<ProjectEnvelope> {
	return {
		id: 'unit.experience-presentation-stop-create',
		kind: EXPERIENCE_PRESENTATION_STOP_CREATE_KIND,
		// The operation is addressed through its parent Experience (the only
		// pre-existing subject it targets), while it creates a Camera View as well.
		// The landed dispatcher refuses a planner whose single declared domain
		// disagrees with the intent's only domain, so the declared domain is the
		// addressed one; `compound` is what admits the second domain's change.
		admission: { domain: 'experience', compound: true, units: true, resources: options.resourceStaging === true },
		sourceKinds: [UNIT_SOURCE_KIND],
		sourceVersions: [UNIT_SOURCE_VERSION],
		prepare(request) {
			const envelope = envelopeOf(request);
			const reader = new ShapeReader();
			const payload = reader.object(request.intent.payload, '$.payload', COMPOUND_PAYLOAD_KEYS);
			if (payload === null) return refuse('invalid-payload', 'The compound payload is not a valid shape', reader.issues);
			const view = readViewPose(reader, payload.view, '$.payload.view');
			const presentationLabel = reader.string(payload.presentationLabel, '$.payload.presentationLabel');
			// An omitted Stop is the explicit "Presentation only" case; a present but
			// malformed Stop is a refusal, not the same absence.
			const requestedStop = payload.stop !== null && payload.stop !== undefined;
			const stop = requestedStop ? readStopPayload(reader, payload.stop, '$.payload.stop') : null;
			const requestedResource = payload.resource !== null && payload.resource !== undefined;
			const resourceUpdate = requestedResource ? readResourceUpdate(reader, payload.resource, '$.payload.resource') : null;
			if (view === null || presentationLabel === null || (requestedStop && stop === null) || (requestedResource && resourceUpdate === null)) {
				return refuse('invalid-payload', 'The compound payload is not a valid shape', reader.issues);
			}
			const resourceTargets = request.intent.targets.filter((candidateTarget) => candidateTarget.domain.startsWith('resource:'));
			if (requestedResource && resourceTargets.length !== 1) {
				return refuse('unsupported-operation', 'a staged resource change targets exactly one resource reference');
			}

			const target = targetOf(request.intent, 'experience', 'experience');
			if (target === null) {
				return refuse('unsupported-operation', 'experience-presentation-stop-create targets exactly one experience:experience reference');
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
			let guideIndex = -1;
			let insertionIndex = -1;
			if (stop !== null) {
				guideIndex = experience.guides.findIndex((candidate) => candidate.id === stop.guideId);
				if (guideIndex === -1) return refuse('missing-target', `guide "${stop.guideId}" is not in experience "${experience.id}"`);
				guide = experience.guides[guideIndex]!;
				if (stop.afterStopId !== null) {
					const at = guide.stopIds.indexOf(stop.afterStopId);
					if (at === -1) return refuse('missing-target', `guide "${guide.id}" does not order stop "${stop.afterStopId}"`);
					insertionIndex = at + 1;
				} else {
					insertionIndex = guide.stopIds.length;
				}
			}

			// The candidate is built against the same envelope the targets resolved
			// against. The View is added to the Camera unit; the Presentation and the
			// optional Stop to the named Experience.
			const newView: CameraView = { id: viewId, label: view.label, eye: view.eye, target: view.target, fov: view.fov, connectedViewIds: [] };
			const newPresentation: ExperiencePresentation = { id: presentationId, label: presentationLabel, viewId };
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
				const target = resourceTargets[0]!;
				resourceTarget = target;
				const resourceKind = target.domain.slice('resource:'.length);
				const resourceIndex = resources.findIndex(
					(candidate) => candidate.kind === resourceKind && candidate.id === target.subject.id
				);
				if (resourceIndex === -1) {
					return refuse('missing-target', `resource "${target.domain}:${target.subject.id}" is not in this envelope`);
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
						entry.domain === target.domain &&
						entry.subjectKind === 'resource' &&
						entry.subjectId === previousResource.id &&
						entry.instancePath.length === 0
				);
				dependencyEntries = [
					...dependencyEntries.filter((entry) => entry !== previousLock),
					{
						domain: target.domain,
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
					fields: ['label', 'viewId']
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
				changes.push({ kind: 'experience.stop.created', subjectIds: [newStop.id], fields: ['presentationId', 'holdSeconds', 'continuation'] });
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

/** The two planners a host registers for this slice's authored operations. */
export function createUnitCandidatePlanners(options: PresentationStopCreateOptions = {}): DomainPlanner<ProjectEnvelope>[] {
	return [createCameraViewUpdatePlanner(), createPresentationStopCreatePlanner(options)];
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
