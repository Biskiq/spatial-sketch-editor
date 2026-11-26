import {
	type DomainPlanner,
	type PlannerOutcome,
	type PlannerRequest,
	type OperationChange,
	type CorrespondenceEntry,
} from '../../../f4/types';
import { type SemanticReference } from '../../../references/types';
import { ShapeReader } from '../../../strict-shape';
import { type ExperienceRemovalPlan } from '../../experience-structure';
import { connectionRecords } from './presentation';
import { withRequiredTravelPaths } from './travel';
import {
	type PrepareFailure,
	refuse,
	envelopeOf,
	revisionOf,
	reference,
	targetOf,
	capturedIds,
} from '../shared';
import { UNIT_SOURCE_KIND, UNIT_SOURCE_VERSION } from '../../source';
import {
	CAMERA_UNIT_FORMAT_VERSION,
	EXPERIENCE_WELCOME_MAX_LENGTH,
	EXPERIENCE_UNIT_FORMAT_VERSION,
	type Experience,
	type ProjectEnvelope,
} from '../../types';
import { readExperienceText } from '../../validate';

/** Edit one Experience's label or Opening Guide. */
export const EXPERIENCE_UPDATE_KIND = 'experience-update';

/** The Experience a member reference names through its one-element instance path. */
export function containerOf(
	envelope: ProjectEnvelope,
	target: SemanticReference,
): Experience | undefined {
	return target.instancePath.length === 1
		? envelope.units.experience.data.experiences.find(
				(candidate) => candidate.id === target.instancePath[0],
			)
		: undefined;
}

/** The envelope with one Experience replaced (and, when given, the Camera payload). */
export function withExperience(
	envelope: ProjectEnvelope,
	experience: Experience,
	camera: Pick<ProjectEnvelope['units']['camera']['data'], 'views' | 'connections'> | null = null,
): ProjectEnvelope {
	return {
		...envelope,
		units: {
			...envelope.units,
			camera:
				camera === null
					? envelope.units.camera
					: {
							header: { ...envelope.units.camera.header },
							data: {
								formatVersion: CAMERA_UNIT_FORMAT_VERSION,
								views: camera.views,
								connections: camera.connections,
							},
						},
			experience: {
				header: { ...envelope.units.experience.header },
				data: {
					formatVersion: EXPERIENCE_UNIT_FORMAT_VERSION,
					experiences: envelope.units.experience.data.experiences.map((candidate) =>
						candidate.id === experience.id ? experience : candidate,
					),
				},
			},
		},
	};
}

export function prepared(
	request: PlannerRequest<ProjectEnvelope>,
	candidate: ProjectEnvelope,
	changes: OperationChange[],
	correspondence: CorrespondenceEntry[],
): PlannerOutcome<ProjectEnvelope> {
	const envelope = envelopeOf(request);
	let source = candidate;
	const reconciledChanges = [...changes];
	const reconciledCorrespondence = [...correspondence];
	for (const experience of source.units.experience.data.experiences) {
		const before = envelope.units.experience.data.experiences.find(
			(entry) => entry.id === experience.id,
		);
		if (before === undefined || before === experience) continue;
		const joined = withRequiredTravelPaths(
			envelope,
			source,
			experience.id,
			capturedIds(request.intent, 'connection'),
		);
		if (joined.kind === 'refused') return refuse(joined.code, joined.message);
		source = joined.envelope;
		for (const cut of joined.cuts) {
			reconciledChanges.push(
				cut.kind === 'stop'
					? {
							kind: 'experience.transition.normalised',
							subjectIds:
								cut.nextStopId === undefined ? [cut.stopId] : [cut.stopId, cut.nextStopId],
							fields: ['transition'],
						}
					: {
							kind: 'experience.presentation-view.transition.normalised',
							subjectIds: [cut.presentationId, cut.viewId],
							fields: ['transition'],
						},
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
			diagnostics: [],
		},
	};
}

export const EXPERIENCE_UPDATE_KEYS = ['label', 'entryGuideId', 'welcome'] as const;

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
			if (payload === null)
				return refuse(
					'invalid-payload',
					'The Experience payload is not a valid shape',
					reader.issues,
				);
			const label =
				payload.label === undefined ? undefined : reader.string(payload.label, '$.payload.label');
			const entryGuideId =
				payload.entryGuideId === undefined
					? undefined
					: reader.opaqueId(payload.entryGuideId, '$.payload.entryGuideId');
			const welcomePresent = payload.welcome !== undefined;
			const welcome =
				!welcomePresent || payload.welcome === null
					? null
					: readExperienceText(
							reader,
							payload.welcome,
							'$.payload.welcome',
							EXPERIENCE_WELCOME_MAX_LENGTH,
						);
			if (label === null || entryGuideId === null || reader.issues.length !== 0) {
				return refuse(
					'invalid-payload',
					'The Experience payload is not a valid shape',
					reader.issues,
				);
			}
			if (label === undefined && entryGuideId === undefined && !welcomePresent) {
				return refuse('invalid-payload', 'the Experience payload names no field to change');
			}
			if (label !== undefined && label.trim() === '')
				return refuse('invalid-payload', 'A name is needed');
			const target = targetOf(request.intent, 'experience', 'experience');
			if (target === null) {
				return refuse(
					'unsupported-operation',
					'experience-update targets exactly one experience:experience reference',
				);
			}
			const previous = envelope.units.experience.data.experiences.find(
				(candidate) => candidate.id === target.subject.id,
			);
			if (previous === undefined)
				return refuse(
					'missing-target',
					`experience "${target.subject.id}" is not in this envelope`,
				);
			if (
				entryGuideId !== undefined &&
				!previous.guides.some((guide) => guide.id === entryGuideId)
			) {
				return refuse(
					'missing-target',
					`guide "${entryGuideId}" is not in experience "${previous.id}"`,
				);
			}
			const updated: Experience = {
				...previous,
				label: label ?? previous.label,
				entryGuideId: entryGuideId ?? previous.entryGuideId,
				welcome: welcomePresent ? welcome : previous.welcome,
			};
			const candidate = withExperience(envelope, updated);
			const fields: string[] = [];
			if (updated.label !== previous.label) fields.push('label');
			if (welcomePresent) fields.push('welcome');
			if (updated.entryGuideId !== previous.entryGuideId) fields.push('entryGuideId');
			return prepared(
				request,
				candidate,
				[{ kind: 'experience.updated', subjectIds: [updated.id], fields }],
				[
					{
						relation: 'preserved',
						before: reference(
							'experience',
							'experience',
							previous.id,
							[],
							revisionOf(envelope, 'experience'),
						),
						after: reference(
							'experience',
							'experience',
							previous.id,
							[],
							revisionOf(candidate, 'experience'),
						),
					},
				],
			);
		},
	};
}

/**
 * The changes and correspondence of an installed removal plan: every removed
 * subject is `retired`, every changed one is reported under its own change kind.
 */
export function removalRecord(
	envelope: ProjectEnvelope,
	experienceId: string,
	plan: Extract<ExperienceRemovalPlan, { kind: 'planned' }>,
): { changes: OperationChange[]; correspondence: CorrespondenceEntry[] } {
	const changes: OperationChange[] = [];
	const correspondence: CorrespondenceEntry[] = [];
	const retire = (
		domain: 'experience' | 'camera',
		kind: string,
		id: string,
		path: readonly string[],
	) =>
		correspondence.push({
			relation: 'retired',
			before: reference(domain, kind, id, path, revisionOf(envelope, domain)),
			after: null,
		});
	for (const consequence of plan.consequences) {
		switch (consequence.kind) {
			case 'stop-removed':
				changes.push({
					kind: 'experience.stop.removed',
					subjectIds: [consequence.stopId],
					fields: [],
				});
				retire('experience', 'stop', consequence.stopId, [experienceId]);
				break;
			case 'presentation-removed':
				changes.push({
					kind: 'experience.presentation.removed',
					subjectIds: [consequence.presentationId],
					fields: [],
				});
				retire('experience', 'presentation', consequence.presentationId, [experienceId]);
				break;
			case 'guide-removed':
				changes.push({
					kind: 'experience.guide.removed',
					subjectIds: [consequence.guideId],
					fields: [],
				});
				retire('experience', 'guide', consequence.guideId, [experienceId]);
				break;
			case 'view-deleted':
				changes.push({ kind: 'camera.view.removed', subjectIds: [consequence.viewId], fields: [] });
				retire('camera', 'view', consequence.viewId, []);
				break;
			case 'connection-deleted':
				changes.push({
					kind: 'camera.connection.removed',
					subjectIds: [consequence.connectionId],
					fields: [],
				});
				break;
			case 'view-removed':
			case 'default-changed':
				changes.push({
					kind: 'experience.presentation.updated',
					subjectIds: [consequence.presentationId],
					fields: ['views'],
				});
				break;
			case 'detour-removed':
				changes.push({
					kind: 'experience.detour.removed',
					subjectIds: [consequence.detourId],
					fields: [],
				});
				break;
			case 'stop-entry-fallback':
				changes.push({
					kind: 'experience.stop.updated',
					subjectIds: [consequence.stopId],
					fields: ['entryViewId'],
				});
				break;
			case 'opening-guide-moved':
				changes.push({
					kind: 'experience.updated',
					subjectIds: [experienceId],
					fields: ['entryGuideId'],
				});
				break;
			case 'view-kept':
				break;
		}
	}
	return { changes, correspondence };
}

/** Run one removal plan and install it, or refuse with its reason. */
export function installRemoval(
	request: PlannerRequest<ProjectEnvelope>,
	envelope: ProjectEnvelope,
	experienceId: string,
	plan: ExperienceRemovalPlan,
): PlannerOutcome<ProjectEnvelope> {
	if (plan.kind === 'refused') return refuse(plan.code, plan.reason);
	const candidate = withExperience(envelope, plan.experience, plan.camera);
	const record = removalRecord(envelope, experienceId, plan);
	return prepared(request, candidate, record.changes, record.correspondence);
}

export function emptyPayload(
	request: PlannerRequest<ProjectEnvelope>,
	what: string,
): PrepareFailure | null {
	const reader = new ShapeReader();
	const payload = reader.object(request.intent.payload, '$.payload', [] as const);
	return payload === null
		? refuse('invalid-payload', `The ${what} removal payload is not a valid shape`, reader.issues)
		: null;
}
