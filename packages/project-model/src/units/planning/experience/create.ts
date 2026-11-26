import { type DomainPlanner } from '../../../f4/types';
import { ShapeReader } from '../../../strict-shape';
import { prepared } from './update';
import { refuse, envelopeOf, revisionOf, reference, capturedId, allIds } from '../shared';
import { UNIT_SOURCE_KIND, UNIT_SOURCE_VERSION } from '../../source';
import { EXPERIENCE_UNIT_FORMAT_VERSION, type Experience, type ProjectEnvelope } from '../../types';

/** Create one empty Experience. */
export const EXPERIENCE_CREATE_KIND = 'experience-create';

/* --- Experience creation --------------------------------------------------- */

export const CREATE_PAYLOAD_KEYS = ['label'] as const;

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
			if (payload === null)
				return refuse(
					'invalid-payload',
					'The Experience payload is not a valid shape',
					reader.issues,
				);
			const label = reader.string(payload.label, '$.payload.label');
			if (label === null)
				return refuse(
					'invalid-payload',
					'The Experience payload is not a valid shape',
					reader.issues,
				);
			const experienceId = capturedId(request.intent, 'experience');
			if (experienceId === null) {
				return refuse('unsupported-operation', 'the intent must capture exactly one experience id');
			}
			if (allIds(envelope).has(experienceId)) {
				return refuse(
					'duplicate-identity',
					`the captured id "${experienceId}" already names a subject in this envelope`,
				);
			}
			const created: Experience = {
				id: experienceId,
				label,
				entryGuideId: null,
				welcome: null,
				presentations: [],
				stops: [],
				guides: [],
				detours: [],
			};
			const candidate: ProjectEnvelope = {
				...envelope,
				units: {
					...envelope.units,
					experience: {
						header: { ...envelope.units.experience.header },
						data: {
							formatVersion: EXPERIENCE_UNIT_FORMAT_VERSION,
							experiences: [...envelope.units.experience.data.experiences, created],
						},
					},
				},
			};
			return prepared(
				request,
				candidate,
				[
					{
						kind: 'experience.created',
						subjectIds: [created.id],
						fields: ['label', 'entryGuideId'],
					},
				],
				[
					{
						relation: 'created',
						before: null,
						after: reference(
							'experience',
							'experience',
							created.id,
							[],
							revisionOf(candidate, 'experience'),
						),
					},
				],
			);
		},
	};
}
