/**
 * The one accepted-outcome builder shared by every Scene planner.
 *
 * A plan that prepared a Scene candidate may also have introduced typed
 * resources: a creator model payload, or the shipped asset resource and lock a
 * catalogue placement grants. Those envelope changes and their declared
 * `changes` entries are applied here so every planner publishes them the same
 * way. `planner.ts` owns the operation-specific candidate checks; this module
 * owns the envelope merge and correspondence.
 */
import type { PlannerOutcome, PlannerRequest, PreparedCandidate } from '../../f4/types';
import type { ShapeIssue } from '../../strict-shape';
import type { SemanticReference } from '../../references/types';
import { replaceUnitData } from '../../units/envelope';
import type { ExperienceUnitPayload, ProjectEnvelope } from '../../units/types';
import type { CreatorModelResourceEntry } from '../model-resource';
import { withCreatorModelResource } from '../model-resource';
import type { SceneOperationKind, SceneOperationResult } from '../operations';
import { withShippedAssetGrant, type ShippedAssetGrant } from '../shipped-asset-resource';

export function toOutcome(
	request: PlannerRequest<ProjectEnvelope>,
	kind: SceneOperationKind,
	result: SceneOperationResult,
	resourceEntry: CreatorModelResourceEntry | null = null,
	shippedGrant: ShippedAssetGrant | null = null,
	unlinkedExperience: ExperienceUnitPayload | null = null,
): PlannerOutcome<ProjectEnvelope> {
	if (result.kind === 'rejected') {
		return rejected(
			result.code,
			result.message,
			result.diagnostics.map((issue) => issue.message),
		);
	}
	const sceneSource = replaceUnitData(request.snapshot.domain.source, 'scene', result.scene);
	const experiencedSource =
		unlinkedExperience === null
			? sceneSource
			: replaceUnitData(sceneSource, 'experience', unlinkedExperience);
	const withCreatorResources =
		resourceEntry === null
			? experiencedSource
			: withCreatorModelResource(experiencedSource, resourceEntry);
	const source =
		shippedGrant === null
			? withCreatorResources
			: withCreatorResources === null
				? null
				: withShippedAssetGrant(withCreatorResources, shippedGrant);
	if (source === null) {
		return rejected(
			'invalid-value',
			'The model resource could not be added to the candidate envelope.',
			[resourceEntry?.resource.id ?? 'model-resource'],
		);
	}
	const candidate: PreparedCandidate<ProjectEnvelope> = {
		operationId: request.intent.operationId,
		sourceKind: request.snapshot.sourceKind,
		sourceVersion: request.snapshot.sourceVersion,
		source,
		changes: [
			{
				kind: `scene-${kind}`,
				subjectIds: [result.entityId],
				fields: [...result.fields],
			},
			...(unlinkedExperience === null
				? []
				: [
						{
							kind: 'experience-presentations-unlinked',
							subjectIds: [result.entityId],
							fields: ['presentations'],
						},
					]),
			...(resourceEntry === null
				? []
				: [
						{
							kind: 'resource-model-created',
							subjectIds: [resourceEntry.resource.id],
							fields: ['pin', 'model', 'lock'],
						},
					]),
			...(shippedGrant === null ||
			(shippedGrant.addedResources.length === 0 && shippedGrant.addedLocks.length === 0)
				? []
				: [
						{
							kind: 'resource-asset-granted',
							subjectIds: shippedGrant.assetIds,
							fields: [
								...(shippedGrant.addedResources.length === 0 ? [] : ['contentRevision']),
								...(shippedGrant.addedLocks.length === 0 ? [] : ['lock']),
							],
						},
					]),
		],
		correspondence: result.correspondence.map((entry) => ({
			relation: entry.relation,
			before: entry.relation === 'created' ? null : entityReference(request, entry.entityId),
			after: entry.relation === 'retired' ? null : entityReference(request, entry.entityId),
		})),
		diagnostics: result.diagnostics,
	};
	return { kind: 'prepared', candidate };
}

/** The planners' one refusal shape: string diagnostics become payload issues. */
export function rejected(
	code: string,
	message: string,
	diagnostics: readonly string[],
): PlannerOutcome<ProjectEnvelope> {
	return {
		kind: 'rejected',
		code,
		message,
		diagnostics: diagnostics.map(
			(entry): ShapeIssue => ({ path: '$.payload', code: 'planner-refusal', message: entry }),
		),
	};
}

function entityReference(
	request: PlannerRequest<ProjectEnvelope>,
	entityId: string,
): SemanticReference {
	return {
		version: 1,
		domain: 'scene',
		revision: {
			kind: 'exact',
			contentRevision: request.snapshot.domain.source.units.scene.header.contentRevision,
		},
		subject: { kind: 'entity', id: entityId },
		instancePath: [],
		location: { kind: 'project-root' },
		componentId: null,
		capabilityId: null,
	};
}
