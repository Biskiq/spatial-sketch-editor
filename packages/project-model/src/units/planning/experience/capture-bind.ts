import { type DomainPlanner, type OperationChange, type CorrespondenceEntry } from '../../../f4/types';
import { type SemanticReference } from '../../../references/types';
import { createUnitReadContext } from '../../../references/unit-resolution';
import { ShapeReader } from '../../../strict-shape';
import { stageUnitResources } from '../../acceptance-staging';
import { readViewPose } from '../camera-view';
import { CREATE_PAYLOAD_KEYS } from './create';
import { COMPOUND_PAYLOAD_KEYS, PRESENTATION_PAYLOAD_KEYS, readResourceUpdate, readSubjectPayload, readStopPayload, readFirstGuidePayload, readCapturedStaging, sameStaging } from './payload';
import { prepared } from './update';
import { STAGED_RESOURCES_INPUT, refuse, envelopeOf, revisionOf, compareLockEntries, reference, targetOf, capturedId, allIds } from '../shared';
import { UNIT_SOURCE_KIND, UNIT_SOURCE_VERSION } from '../../source';
import { CAMERA_UNIT_FORMAT_VERSION, EXPERIENCE_UNIT_FORMAT_VERSION, type CameraView, type Experience, type ExperienceGuide, type ExperiencePresentation, type ExperienceStop, type ProjectEnvelope, type TypedResource, RESOURCE_UNIT_FORMAT_VERSION } from '../../types';
import { readExperienceText } from '../../validate';

/** Capture a View and bind a Presentation (and optionally one Stop) to it. */
export const EXPERIENCE_CAPTURE_BIND_KIND = 'experience-capture-bind';

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
