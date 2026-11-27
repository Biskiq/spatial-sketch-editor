import type { PlannerOutcome, PlannerRequest } from '../../f4/types';
import { ShapeReader } from '../../strict-shape';
import { replaceUnitData } from '../../units/envelope';
import type { ProjectEnvelope } from '../../units/types';
import type { SemanticReference } from '../../references/types';
import {
	readSceneOperationAllocation,
	readSceneOperationPayload,
	readSceneOperationSubject,
} from '../intent-payload';
import { grantShippedAssetResources, withShippedAssetGrant } from '../shipped-asset-resource';
import { prepareGroupCopyCandidate } from '../group-copy';
import type { NormalizedPlacementDefinition } from '../types';
import { invalidPayload } from './planner';
import { rejected } from './outcome';

/**
 * T2 D8b — the `place-group-copy` intent.
 *
 * The template is re-read strictly by the planner, ids are captured in the
 * payload (no F4 allocation), and the shipped-asset grant is applied in the same
 * accepted result as the entities and the cluster. The whole write is atomic:
 * a refused template, member, support or held resource installs nothing.
 */
export function planPlaceGroupCopyIntent(
	request: PlannerRequest<ProjectEnvelope>,
	definitions: ReadonlyMap<string, NormalizedPlacementDefinition>,
): PlannerOutcome<ProjectEnvelope> {
	const reader = new ShapeReader();
	const payload = readSceneOperationPayload(reader, 'place-group-copy', request.intent.payload);
	if (payload === null || payload.kind !== 'place-group-copy') {
		// A template that cannot be read keeps its own typed refusal instead of
		// being flattened into malformed intent; every other issue is the intent's.
		const templateIssue = reader.issues.find(
			(issue) => issue.code === 'invalid-template' || issue.code === 'ineligible-member',
		);
		if (templateIssue !== undefined) {
			return rejected(
				templateIssue.code,
				templateIssue.message,
				reader.issues.map((issue) => `${issue.path}: ${issue.message}`),
			);
		}
		return invalidPayload(reader.issues);
	}
	const subject = readSceneOperationSubject({
		reader,
		kind: 'place-group-copy',
		targets: request.intent.targets,
		payload,
		sourceContentId: request.snapshot.domain.source.units.scene.header.contentRevision,
	});
	const allocation = readSceneOperationAllocation({
		reader,
		kind: 'place-group-copy',
		allocations: request.intent.allocatedIds,
		scene: request.snapshot.domain.source.units.scene.data,
	});
	if (subject === null || allocation === null) return invalidPayload(reader.issues);
	if (reader.issues.length > 0) return invalidPayload(reader.issues);
	if (subject.kind !== 'none' || allocation.kind !== 'none') {
		return rejected(
			'invalid-value',
			'A group copy addresses no existing subject and captures its ids in the payload.',
			[],
		);
	}

	let prepared;
	try {
		prepared = prepareGroupCopyCandidate({
			context: {
				layout: request.snapshot.domain.source.units.layout.data,
				scene: request.snapshot.domain.source.units.scene.data,
				sourceContentId: request.snapshot.sourceContentId,
			},
			template: payload.template,
			name: payload.name,
			origin: payload.origin,
			yaw: payload.yaw,
			frame: payload.frame,
			entityIds: payload.entityIds,
			clusterId: payload.clusterId,
			contacts: payload.contacts,
			definitions: [...definitions.values()],
		});
	} catch (error) {
		return rejected(
			'invalid-value',
			`The place-group-copy planner failed: ${error instanceof Error ? error.message : 'unknown error'}`,
			[],
		);
	}
	if (prepared.kind === 'rejected') {
		return rejected(
			prepared.code,
			prepared.message,
			prepared.diagnostics.map((diagnostic) => diagnostic.message),
		);
	}

	const grant = grantShippedAssetResources(request.snapshot.domain.source, prepared.assets);
	if (grant.kind === 'refused') {
		return rejected(grant.code, grant.message, grant.diagnostics);
	}
	const sceneSource = replaceUnitData(request.snapshot.domain.source, 'scene', prepared.scene);
	const source = withShippedAssetGrant(sceneSource, grant);
	return {
		kind: 'prepared',
		candidate: {
			operationId: request.intent.operationId,
			sourceKind: request.snapshot.sourceKind,
			sourceVersion: request.snapshot.sourceVersion,
			source,
			changes: [
				{
					kind: 'scene-place-group-copy',
					subjectIds: [prepared.clusterId, ...prepared.entityIds],
					fields: [...prepared.fields],
				},
				...(grant.addedResources.length === 0 && grant.addedLocks.length === 0
					? []
					: [
							{
								kind: 'resource-asset-granted',
								subjectIds: [...grant.assetIds],
								fields: [
									...(grant.addedResources.length === 0 ? [] : ['contentRevision']),
									...(grant.addedLocks.length === 0 ? [] : ['lock']),
								],
							},
						]),
			],
			correspondence: [
				{
					relation: 'created',
					before: null,
					after: clusterReference(request, prepared.clusterId),
				},
				...prepared.entityIds.map((entityId) => ({
					relation: 'created' as const,
					before: null,
					after: entityReference(request, entityId),
				})),
			],
			diagnostics: [...prepared.diagnostics],
		},
	};
}

function sceneRevision(request: PlannerRequest<ProjectEnvelope>): SemanticReference['revision'] {
	return {
		kind: 'exact',
		contentRevision: request.snapshot.domain.source.units.scene.header.contentRevision,
	};
}

function clusterReference(
	request: PlannerRequest<ProjectEnvelope>,
	clusterId: string,
): SemanticReference {
	return {
		version: 1,
		domain: 'scene',
		revision: sceneRevision(request),
		subject: { kind: 'cluster', id: clusterId },
		instancePath: [],
		location: { kind: 'project-root' },
		componentId: null,
		capabilityId: null,
	};
}

function entityReference(
	request: PlannerRequest<ProjectEnvelope>,
	entityId: string,
): SemanticReference {
	return {
		version: 1,
		domain: 'scene',
		revision: sceneRevision(request),
		subject: { kind: 'entity', id: entityId },
		instancePath: [],
		location: { kind: 'project-root' },
		componentId: null,
		capabilityId: null,
	};
}
