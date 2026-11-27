import type { PlannerOutcome, PlannerRequest } from '../../f4/types';
import { ShapeReader } from '../../strict-shape';
import { replaceUnitData } from '../../units/envelope';
import { unlinkSceneSubjects } from '../../units/experience-structure';
import type { ExperienceUnitPayload, ProjectEnvelope } from '../../units/types';
import type { SemanticReference } from '../../references/types';
import {
	readSceneOperationAllocation,
	readSceneOperationPayload,
	readSceneOperationSubject,
} from '../intent-payload';
import {
	CREATE_LIGHT_RIG,
	SCENE_GROUP_CREATE,
	SCENE_GROUP_DUPLICATE,
	SCENE_GROUP_ERASE,
	SCENE_GROUP_RENAME,
	SCENE_GROUP_TRANSFORM,
	SCENE_GROUP_UNGROUP,
	planCreateLightRig,
	planGroupCreate,
	planGroupErase,
	planGroupRename,
	planGroupUngroup,
	type SceneGroupOperationCandidate,
	type SceneGroupOperationKind,
	type SceneGroupOperationResult,
} from '../group-operations';
import { planGroupDuplicate, planGroupTransform } from '../group-motion';
import { frameYawToWorld } from '../frame';
import { invalidPayload, rejected } from './planner';

/**
 * The seven G1a group intents.
 *
 * Every one funnels through the same reader and the same outcome builder:
 * exact captured cluster target, no F4 id allocation (group ids are captured in
 * the payload), one accepted result and one Undo. `scene-group-erase` also
 * unlinks Experience presentations in the same candidate, exactly as
 * `delete-one` does.
 */
export function planGroupIntent(
	request: PlannerRequest<ProjectEnvelope>,
	kind: SceneGroupOperationKind,
): PlannerOutcome<ProjectEnvelope> {
	const reader = new ShapeReader();
	const payload = readSceneOperationPayload(reader, kind, request.intent.payload);
	if (payload === null) return invalidPayload(reader.issues);
	const subject = readSceneOperationSubject({
		reader,
		kind,
		targets: request.intent.targets,
		payload,
		sourceContentId: request.snapshot.domain.source.units.scene.header.contentRevision,
	});
	const allocation = readSceneOperationAllocation({
		reader,
		kind,
		allocations: request.intent.allocatedIds,
		scene: request.snapshot.domain.source.units.scene.data,
	});
	if (subject === null || allocation === null) return invalidPayload(reader.issues);
	if (reader.issues.length > 0) return invalidPayload(reader.issues);
	if (allocation.kind !== 'none') {
		return rejected(
			'invalid-value',
			`${kind} captures its ids in the payload and allocates none.`,
			[],
		);
	}
	const context = {
		layout: request.snapshot.domain.source.units.layout.data,
		scene: request.snapshot.domain.source.units.scene.data,
		sourceContentId: request.snapshot.sourceContentId,
	};
	let result: SceneGroupOperationResult;
	try {
		result = planGroupOperation(kind, payload, subject, context);
	} catch (error) {
		return rejected(
			'invalid-value',
			`The ${kind} planner failed: ${error instanceof Error ? error.message : 'unknown error'}`,
			[],
		);
	}
	if (result.kind === 'rejected') {
		return rejected(
			result.code,
			result.message,
			result.diagnostics.map((diagnostic) => diagnostic.message),
		);
	}
	return groupOutcome(request, result);
}

function planGroupOperation(
	kind: SceneGroupOperationKind,
	payload: Exclude<ReturnType<typeof readSceneOperationPayload>, null>,
	subject:
		| { readonly kind: 'none' }
		| { readonly kind: 'entity'; readonly entityId: string }
		| { readonly kind: 'cluster'; readonly clusterId: string },
	context: Parameters<typeof planGroupTransform>[0]['context'],
): SceneGroupOperationResult {
	if (kind === SCENE_GROUP_CREATE) {
		if (payload.kind !== 'scene-group-create' || subject.kind !== 'none') {
			return invalidKind(kind);
		}
		return planGroupCreate({
			context,
			clusterId: payload.clusterId,
			memberIds: payload.memberIds,
			name: payload.name,
		});
	}
	if (kind === CREATE_LIGHT_RIG) {
		if (payload.kind !== 'create-light-rig' || subject.kind !== 'none') {
			return invalidKind(kind);
		}
		return planCreateLightRig({
			context,
			clusterId: payload.clusterId,
			name: payload.name,
			lights: payload.lights,
		});
	}
	if (subject.kind !== 'cluster') return invalidKind(kind);
	if (kind === SCENE_GROUP_UNGROUP) {
		if (payload.kind !== 'scene-group-ungroup') return invalidKind(kind);
		return planGroupUngroup({ context, clusterId: subject.clusterId });
	}
	if (kind === SCENE_GROUP_RENAME) {
		if (payload.kind !== 'scene-group-rename') return invalidKind(kind);
		return planGroupRename({ context, clusterId: subject.clusterId, name: payload.name });
	}
	if (kind === SCENE_GROUP_TRANSFORM) {
		if (payload.kind !== 'scene-group-transform') return invalidKind(kind);
		return planGroupTransform({
			context,
			clusterId: subject.clusterId,
			motion:
				payload.motion.kind === 'move'
					? payload.motion
					: { kind: 'turn', yaw: frameYawToWorld(payload.frame, payload.motion.yaw) },
			contacts: payload.contacts,
		});
	}
	if (kind === SCENE_GROUP_DUPLICATE) {
		if (payload.kind !== 'scene-group-duplicate') return invalidKind(kind);
		return planGroupDuplicate({
			context,
			clusterId: subject.clusterId,
			copies: payload.copies,
			newClusterId: payload.newClusterId,
			contacts: payload.contacts,
		});
	}
	if (payload.kind !== 'scene-group-erase') return invalidKind(kind);
	return planGroupErase({ context, clusterId: subject.clusterId });
}

function invalidKind(kind: string): SceneGroupOperationResult {
	return {
		kind: 'rejected',
		code: 'invalid-value',
		message: `The ${kind} payload does not match its operation kind or target.`,
		diagnostics: [],
	};
}

function groupOutcome(
	request: PlannerRequest<ProjectEnvelope>,
	result: SceneGroupOperationCandidate,
): PlannerOutcome<ProjectEnvelope> {
	const sceneSource = replaceUnitData(request.snapshot.domain.source, 'scene', result.scene);
	const unlinkedExperience = eraseUnlinksExperience(request, result);
	const source =
		unlinkedExperience === null
			? sceneSource
			: replaceUnitData(sceneSource, 'experience', unlinkedExperience);
	const entityIds = result.correspondence.flatMap((entry) =>
		'entityId' in entry ? [entry.entityId] : [],
	);
	return {
		kind: 'prepared',
		candidate: {
			operationId: request.intent.operationId,
			sourceKind: request.snapshot.sourceKind,
			sourceVersion: request.snapshot.sourceVersion,
			source,
			changes: [
				{
					kind: result.operationKind,
					subjectIds: [result.clusterId, ...entityIds],
					fields: [...result.fields],
				},
				...(unlinkedExperience === null
					? []
					: [
							{
								kind: 'experience-presentations-unlinked',
								subjectIds: result.removedEntityIds ?? [],
								fields: ['presentations'],
							},
						]),
			],
			correspondence: result.correspondence.map((entry) => {
				const reference =
					'clusterId' in entry
						? clusterReference(request, entry.clusterId)
						: entityReference(request, entry.entityId);
				return {
					relation: entry.relation,
					before: entry.relation === 'created' ? null : reference,
					after: entry.relation === 'retired' ? null : reference,
				};
			}),
			diagnostics: result.diagnostics,
		},
	};
}

function eraseUnlinksExperience(
	request: PlannerRequest<ProjectEnvelope>,
	result: SceneGroupOperationCandidate,
): ExperienceUnitPayload | null {
	if (result.operationKind !== SCENE_GROUP_ERASE || result.removedEntityIds === undefined) {
		return null;
	}
	const before = request.snapshot.domain.source.units.scene.data;
	const removed = result.removedEntityIds.map((entityId) => ({
		entityId,
		effectiveName: before.entities.find((entity) => entity.id === entityId)?.name ?? entityId,
	}));
	const data = request.snapshot.domain.source.units.experience.data;
	let changed = false;
	const experiences = data.experiences.map((experience) => {
		const next = unlinkSceneSubjects(experience, removed);
		if (next !== experience) changed = true;
		return next;
	});
	return changed ? { ...data, experiences } : null;
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
