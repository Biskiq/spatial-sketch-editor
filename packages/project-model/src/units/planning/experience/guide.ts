import { type DomainPlanner } from '../../../f4/types';
import { ShapeReader } from '../../../strict-shape';
import { planGuideRemoval } from '../../experience-structure';
import { readOptionalTransition } from './payload';
import { containerOf, withExperience, prepared, installRemoval, emptyPayload } from './update';
import { refuse, envelopeOf, revisionOf, reference, targetOf, capturedId, allIds } from '../shared';
import { UNIT_SOURCE_KIND, UNIT_SOURCE_VERSION } from '../../source';
import {
	EXPERIENCE_GUIDE_PACINGS,
	EXPERIENCE_STAY_DEFAULT_SECONDS,
	presentationDefaultViewId,
	presentationViewIds,
	type ExperienceGuidePacing,
	EXPERIENCE_UNIT_FORMAT_VERSION,
	type Experience,
	type ExperienceGuide,
	type ExperienceStop,
	type ProjectEnvelope,
} from '../../types';
import { readStaySeconds } from '../../validate';

/** Create a Guide and its initial Stop from an existing Presentation; the first one opens the Experience. */
export const EXPERIENCE_GUIDE_CREATE_KIND = 'experience-guide-create';

/** Reorder a Guide's Stops by stable identity. */
export const EXPERIENCE_GUIDE_ORDER_KIND = 'experience-guide-order';

/** Edit one Guide's label or start Stop. */
export const EXPERIENCE_GUIDE_UPDATE_KIND = 'experience-guide-update';

/** Remove one Guide under the removal rules. */
export const EXPERIENCE_GUIDE_REMOVE_KIND = 'experience-guide-remove';

export const GUIDE_CREATE_PAYLOAD_KEYS = [
	'label',
	'presentationId',
	'entryViewId',
	'staySeconds',
	'transition',
	'pacing',
] as const;

/**
 * Create one Guide of an Experience and its initial distinct Stop.
 *
 * Targets: exactly one `experience:experience` reference. The Guide's label and
 * the captured guide/stop ids are the intent's; the Stop enters the chosen
 * Presentation at its own entry View (the Presentation's Default unless the
 * payload names one of its views). Reusing a Presentation creates a fresh Stop
 * identity: no Camera pose or FOV is copied and no Connection is manufactured.
 *
 * Any number of Guides may be created. The first one becomes the
 * Experience's explicit `entryGuideId`; a later one leaves the Opening Guide as
 * it is. Guide membership is never made mandatory for any other Presentation,
 * and a source with no Guide still Previews through the visitor list.
 */
export function createExperienceGuideCreatePlanner(): DomainPlanner<ProjectEnvelope> {
	return {
		id: 'unit.experience-guide-create',
		kind: EXPERIENCE_GUIDE_CREATE_KIND,
		admission: {
			domain: 'experience',
			compound: true,
			writes: ['camera'],
			units: true,
			resources: false,
		},
		sourceKinds: [UNIT_SOURCE_KIND],
		sourceVersions: [UNIT_SOURCE_VERSION],
		prepare(request) {
			const envelope = envelopeOf(request);
			const reader = new ShapeReader();
			const payload = reader.object(request.intent.payload, '$.payload', GUIDE_CREATE_PAYLOAD_KEYS);
			if (payload === null)
				return refuse('invalid-payload', 'The Guide payload is not a valid shape', reader.issues);
			const label = reader.string(payload.label, '$.payload.label');
			const presentationId = reader.opaqueId(payload.presentationId, '$.payload.presentationId');
			const entryViewProvided = payload.entryViewId !== undefined && payload.entryViewId !== null;
			const entryViewId = entryViewProvided
				? reader.opaqueId(payload.entryViewId, '$.payload.entryViewId')
				: null;
			const staySeconds =
				payload.staySeconds === undefined
					? EXPERIENCE_STAY_DEFAULT_SECONDS
					: readStaySeconds(reader, payload.staySeconds, '$.payload.staySeconds');
			const pacing =
				payload.pacing === undefined
					? 'automatic'
					: (reader.tag(
							payload.pacing,
							'$.payload.pacing',
							EXPERIENCE_GUIDE_PACINGS,
						) as ExperienceGuidePacing | null);
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
				return refuse(
					'unsupported-operation',
					'experience-guide-create targets exactly one experience:experience reference',
				);
			}
			const experienceIndex = envelope.units.experience.data.experiences.findIndex(
				(candidate) => candidate.id === target.subject.id,
			);
			if (experienceIndex === -1)
				return refuse(
					'missing-target',
					`experience "${target.subject.id}" is not in this envelope`,
				);
			const experience = envelope.units.experience.data.experiences[experienceIndex]!;
			const firstGuide = experience.guides.length === 0;
			if (firstGuide && experience.entryGuideId !== null) {
				return refuse(
					'missing-target',
					`experience "${experience.id}" already names entry guide "${experience.entryGuideId}", which it does not carry`,
				);
			}
			const presentation = experience.presentations.find(
				(candidate) => candidate.id === presentationId,
			);
			if (presentation === undefined) {
				return refuse(
					'missing-target',
					`presentation "${presentationId}" is not in experience "${experience.id}"`,
				);
			}
			// A Presentation without a Default View is not enterable, so no Stop of it
			// can join a Guide.
			const defaultViewId = presentationDefaultViewId(presentation);
			if (defaultViewId === null) {
				return refuse(
					'missing-entry',
					`presentation "${presentation.id}" has no Default View, so a Stop cannot enter it`,
				);
			}
			const entry: string = entryViewId ?? defaultViewId;
			if (!presentationViewIds(presentation).includes(entry)) {
				return refuse(
					'invalid-payload',
					`entry view "${entry}" is not one of presentation "${presentation.id}"'s views`,
				);
			}
			const guideId = capturedId(request.intent, 'guide');
			const stopId = capturedId(request.intent, 'stop');
			if (guideId === null || stopId === null) {
				return refuse(
					'unsupported-operation',
					'the intent must capture exactly one guide id and one stop id',
				);
			}
			const ids = allIds(envelope);
			for (const id of [guideId, stopId]) {
				if (ids.has(id))
					return refuse(
						'duplicate-identity',
						`the captured id "${id}" already names a subject in this envelope`,
					);
			}
			if (guideId === stopId) {
				return refuse(
					'duplicate-identity',
					'a Guide and its initial Stop must have distinct identities',
				);
			}
			const newStop: ExperienceStop = {
				id: stopId,
				presentationId,
				entryViewId: entryViewId ?? null,
				staySeconds,
				invitation: null,
				...(transition === undefined ? {} : { transition }),
			};
			const newGuide: ExperienceGuide = { id: guideId, label, stopIds: [newStop.id], pacing };
			const updatedExperience: Experience = {
				...experience,
				entryGuideId: firstGuide ? newGuide.id : experience.entryGuideId,
				stops: [...experience.stops, newStop],
				guides: [...experience.guides, newGuide],
			};
			const candidate: ProjectEnvelope = {
				...envelope,
				units: {
					...envelope.units,
					experience: {
						header: { ...envelope.units.experience.header },
						data: {
							formatVersion: EXPERIENCE_UNIT_FORMAT_VERSION,
							experiences: envelope.units.experience.data.experiences.map(
								(entryExperience, index) =>
									index === experienceIndex ? updatedExperience : entryExperience,
							),
						},
					},
				},
			};
			return prepared(
				request,
				candidate,
				[
					{
						kind: 'experience.guide.created',
						subjectIds: [newGuide.id],
						fields: ['label', 'stopIds', 'pacing'],
					},
					{
						kind: 'experience.stop.created',
						subjectIds: [newStop.id],
						fields: ['presentationId', 'entryViewId', 'staySeconds', 'invitation', 'transition'],
					},
					...(firstGuide
						? [
								{
									kind: 'experience.updated',
									subjectIds: [experience.id],
									fields: ['entryGuideId'],
								},
							]
						: []),
				],
				[
					{
						relation: 'created',
						before: null,
						after: reference(
							'experience',
							'guide',
							newGuide.id,
							[experience.id],
							revisionOf(candidate, 'experience'),
						),
					},
					{
						relation: 'created',
						before: null,
						after: reference(
							'experience',
							'stop',
							newStop.id,
							[experience.id],
							revisionOf(candidate, 'experience'),
						),
					},
				],
			);
		},
	};
}

/* --- Reuse a Presentation at a distinct Stop ------------------------------- */

export const GUIDE_ORDER_PAYLOAD_KEYS = ['guideId', 'stopIds'] as const;

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
		admission: {
			domain: 'experience',
			compound: true,
			writes: ['camera'],
			units: true,
			resources: false,
		},
		sourceKinds: [UNIT_SOURCE_KIND],
		sourceVersions: [UNIT_SOURCE_VERSION],
		prepare(request) {
			const envelope = envelopeOf(request);
			const reader = new ShapeReader();
			const payload = reader.object(request.intent.payload, '$.payload', GUIDE_ORDER_PAYLOAD_KEYS);
			if (payload === null)
				return refuse(
					'invalid-payload',
					'The Guide order payload is not a valid shape',
					reader.issues,
				);
			const guideId = reader.opaqueId(payload.guideId, '$.payload.guideId');
			const stopIds = reader.opaqueIdArray(payload.stopIds, '$.payload.stopIds');
			if (guideId === null || stopIds === null) {
				return refuse(
					'invalid-payload',
					'The Guide order payload is not a valid shape',
					reader.issues,
				);
			}
			const target = targetOf(request.intent, 'experience', 'experience');
			if (target === null) {
				return refuse(
					'unsupported-operation',
					'experience-guide-order targets exactly one experience:experience reference',
				);
			}
			const experienceIndex = envelope.units.experience.data.experiences.findIndex(
				(candidate) => candidate.id === target.subject.id,
			);
			if (experienceIndex === -1)
				return refuse(
					'missing-target',
					`experience "${target.subject.id}" is not in this envelope`,
				);
			const experience = envelope.units.experience.data.experiences[experienceIndex]!;
			const guide = experience.guides.find((candidate) => candidate.id === guideId);
			if (guide === undefined)
				return refuse(
					'missing-target',
					`guide "${guideId}" is not in experience "${experience.id}"`,
				);
			const authored = new Set(guide.stopIds);
			const supplied = new Set(stopIds);
			if (
				guide.stopIds.length !== stopIds.length ||
				authored.size !== supplied.size ||
				![...authored].every((stopId) => supplied.has(stopId))
			) {
				return refuse(
					'invalid-order',
					`the new order must be a permutation of guide "${guide.id}"'s authored stops; it is never an insert, a removal or an index-keyed move`,
				);
			}
			const updatedExperience: Experience = {
				...experience,
				guides: experience.guides.map((candidate) =>
					candidate.id === guide.id ? { ...candidate, stopIds } : candidate,
				),
			};
			const candidate: ProjectEnvelope = {
				...envelope,
				units: {
					...envelope.units,
					experience: {
						header: { ...envelope.units.experience.header },
						data: {
							formatVersion: EXPERIENCE_UNIT_FORMAT_VERSION,
							experiences: envelope.units.experience.data.experiences.map(
								(entryExperience, index) =>
									index === experienceIndex ? updatedExperience : entryExperience,
							),
						},
					},
				},
			};
			return prepared(
				request,
				candidate,
				[{ kind: 'experience.guide.updated', subjectIds: [guide.id], fields: ['stopIds'] }],
				[
					{
						relation: 'preserved',
						before: reference(
							'experience',
							'guide',
							guide.id,
							[experience.id],
							revisionOf(envelope, 'experience'),
						),
						after: reference(
							'experience',
							'guide',
							guide.id,
							[experience.id],
							revisionOf(candidate, 'experience'),
						),
					},
				],
			);
		},
	};
}

export const GUIDE_UPDATE_KEYS = ['label', 'pacing'] as const;

/**
 * Edit one Guide's label, its start Stop or its pacing (sheet §31: Automatic
 * moves on when each stay ends; Manual waits for Next and keeps every stay).
 *
 * Targets: exactly one `experience:guide` reference scoped by its Experience.
 * A Guide has no start Stop: its first ordered Stop starts it, so this never
 * reorders and reordering never moves the start.
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
			if (payload === null)
				return refuse('invalid-payload', 'The Guide payload is not a valid shape', reader.issues);
			const label =
				payload.label === undefined ? undefined : reader.string(payload.label, '$.payload.label');
			const pacing =
				payload.pacing === undefined
					? undefined
					: (reader.tag(
							payload.pacing,
							'$.payload.pacing',
							EXPERIENCE_GUIDE_PACINGS,
						) as ExperienceGuidePacing | null);
			if (label === null || pacing === null) {
				return refuse('invalid-payload', 'The Guide payload is not a valid shape', reader.issues);
			}
			if (label === undefined && pacing === undefined) {
				return refuse('invalid-payload', 'the Guide payload names no field to change');
			}
			if (label !== undefined && label.trim() === '')
				return refuse('invalid-payload', 'A name is needed');
			const target = targetOf(request.intent, 'experience', 'guide');
			if (target === null) {
				return refuse(
					'unsupported-operation',
					'experience-guide-update targets exactly one experience:guide reference',
				);
			}
			const container = containerOf(envelope, target);
			if (container === undefined) {
				return refuse(
					'missing-target',
					`the Guide's Experience "${target.instancePath[0] ?? '(unspecified)'}" is not in this envelope`,
				);
			}
			const previous = container.guides.find((candidate) => candidate.id === target.subject.id);
			if (previous === undefined)
				return refuse(
					'missing-target',
					`guide "${target.subject.id}" is not in experience "${container.id}"`,
				);
			const updated: ExperienceGuide = {
				...previous,
				label: label ?? previous.label,
				pacing: pacing ?? previous.pacing,
			};
			const candidate = withExperience(envelope, {
				...container,
				guides: container.guides.map((candidate) =>
					candidate.id === updated.id ? updated : candidate,
				),
			});
			const fields: string[] = [];
			if (updated.label !== previous.label) fields.push('label');
			if (updated.pacing !== previous.pacing) fields.push('pacing');
			return prepared(
				request,
				candidate,
				[{ kind: 'experience.guide.updated', subjectIds: [updated.id], fields }],
				[
					{
						relation: 'preserved',
						before: reference(
							'experience',
							'guide',
							previous.id,
							[container.id],
							revisionOf(envelope, 'experience'),
						),
						after: reference(
							'experience',
							'guide',
							previous.id,
							[container.id],
							revisionOf(candidate, 'experience'),
						),
					},
				],
			);
		},
	};
}

/* --- Removal ------------------------------------------------ */

/**
 * The changes and correspondence of an installed removal plan: every removed
 * subject is `retired`, every changed one is reported under its own change kind.

/**
 * Remove one Guide. Targets: exactly one `experience:guide` reference. Its
 * Stops no other Guide orders go with it; the Opening Guide passes to the next.
 */
export function createExperienceGuideRemovePlanner(): DomainPlanner<ProjectEnvelope> {
	return {
		id: 'unit.experience-guide-remove',
		kind: EXPERIENCE_GUIDE_REMOVE_KIND,
		admission: {
			domain: 'experience',
			compound: true,
			writes: ['camera'],
			units: true,
			resources: false,
		},
		sourceKinds: [UNIT_SOURCE_KIND],
		sourceVersions: [UNIT_SOURCE_VERSION],
		prepare(request) {
			const envelope = envelopeOf(request);
			const invalid = emptyPayload(request, 'Guide');
			if (invalid !== null) return invalid;
			const target = targetOf(request.intent, 'experience', 'guide');
			if (target === null)
				return refuse(
					'unsupported-operation',
					'experience-guide-remove targets exactly one experience:guide reference',
				);
			const container = containerOf(envelope, target);
			if (container === undefined) {
				return refuse(
					'missing-target',
					`the Guide's Experience "${target.instancePath[0] ?? '(unspecified)'}" is not in this envelope`,
				);
			}
			return installRemoval(
				request,
				envelope,
				container.id,
				planGuideRemoval(container, target.subject.id),
			);
		},
	};
}
