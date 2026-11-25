import { type LayoutVec2 } from '@portfolio/layout-core/geometry';
import { type SceneEntity } from '../../scene';
import { finalize, cloneEntityWithId, note, cleanupClusters, fromFinalization } from './finalization';
import { unsupportedTransform, invalid, refusal } from './refusals';
import { resolveSupport, readContactMinY, upright, entityScale, restSupport, readObject } from './support';
import { type SceneOperationResult, type SceneOperationContext, DUPLICATE_OFFSET_METERS, SCENE_NAME_LIMIT } from './types';
import { finalizeSceneCandidate, sameSceneValues } from '../record-scope';
import { type SceneSupportChoice } from '../support';
import { type CameraFreeSceneDocument as SceneDocument } from '../../units/types';

/**
 * `set-name` — rename one entity. Any entity kind may be renamed, lights
 * included; nothing else changes. A blank name refuses and keeps the old one.
 */
export function planSetName(input: {
	readonly context: SceneOperationContext;
	readonly entityId: string;
	readonly name: string;
}): SceneOperationResult {
	const entity = input.context.scene.entities.find((candidate) => candidate.id === input.entityId);
	if (entity === undefined) {
		return refusal('missing-target', `No Scene entity "${input.entityId}" exists in the accepted source.`, [
			input.entityId
		]);
	}
	const name = typeof input.name === 'string' ? input.name.trim() : '';
	if (name.length === 0) return invalid('A name can’t be empty.', ['name']);
	if (name.length > SCENE_NAME_LIMIT) return invalid(`A name can have at most ${SCENE_NAME_LIMIT} characters.`, ['name']);
	if (name === entity.name) return refusal('no_op', `Entity "${input.entityId}" is already named "${name}".`, ['name']);
	return finalize({
		context: input.context,
		operationKind: 'set-name',
		next: { ...entity, name },
		fields: ['name'],
		scope: {
			changedEntityIds: [entity.id],
			changedEntityFields: ['name'],
			createdEntityIds: [],
			removedEntityIds: [],
			allowClusterCleanup: false
		},
		correspondence: [{ relation: 'preserved', entityId: entity.id }]
	});
}

export function planDuplicateOne(input: {
	readonly context: SceneOperationContext;
	readonly entityId: string;
	readonly newEntityId: string;
	readonly contactMinY: number;
	readonly choice?: SceneSupportChoice | undefined;
}): SceneOperationResult {
	const scene = input.context.scene;
	const target = readObject(scene, input.entityId);
	if (target.kind !== 'object') return target;
	const contact = readContactMinY(target.entity, input.contactMinY);
	if (contact.kind !== 'value') return contact;
	if (!upright(target.entity)) return unsupportedTransform(input.entityId, 'duplicate-one');
	if (typeof input.newEntityId !== 'string' || input.newEntityId.trim().length === 0) {
		return invalid('Duplicate needs a captured new entity id.', ['newEntityId']);
	}
	if (scene.entities.some((entity) => entity.id === input.newEntityId)) {
		return invalid(
			`Captured duplicate id "${input.newEntityId}" is already used by the accepted source; it is never renamed.`,
			['newEntityId', 'duplicate-entity-id']
		);
	}
	const cluster = (scene.clusters ?? []).find((candidate) =>
		candidate.memberIds.includes(input.entityId)
	);
	if (cluster !== undefined) {
		return refusal(
			'unsupported-set',
			`Entity "${input.entityId}" belongs to cluster "${cluster.id}". Duplicating a cluster member would silently change grouping; set duplication is not supported in this phase.`,
			[cluster.id]
		);
	}

	const rest = restSupport(input.context, target.entity, contact.value, input.choice);
	if (rest.kind !== 'resolved') return rest;
	const point: LayoutVec2 = [
		target.entity.position[0] + DUPLICATE_OFFSET_METERS,
		target.entity.position[2] + DUPLICATE_OFFSET_METERS
	];
	const support = resolveSupport(input.context, point, rest.lift > 0 ? null : rest.resting, input.choice);
	if (support.kind !== 'resolved') return support;

	const duplicate: SceneEntity = {
		...cloneEntityWithId(target.entity, input.newEntityId),
		position: [
			target.entity.position[0] + DUPLICATE_OFFSET_METERS,
			target.entity.position[1],
			target.entity.position[2] + DUPLICATE_OFFSET_METERS
		]
	};
	const after: SceneDocument = { ...scene, entities: [...scene.entities, duplicate] };
	const finalized = finalizeSceneCandidate({
		before: scene,
		after,
		scope: {
			operationKind: 'duplicate-one',
			changedEntityIds: [],
			changedEntityFields: [],
			createdEntityIds: [input.newEntityId],
			removedEntityIds: [],
			allowClusterCleanup: false
		}
	});
	if (finalized.kind === 'rejected') return fromFinalization(finalized);

	return {
		kind: 'candidate',
		operationKind: 'duplicate-one',
		entityId: input.newEntityId,
		scene: finalized.scene,
		fields: ['entities'],
		correspondence: [{ relation: 'created', entityId: input.newEntityId }],
		support: support.support,
		worldPose: {
			position: [...duplicate.position],
			rotation: [...duplicate.rotation],
			scale: entityScale(duplicate)
		},
		diagnostics: [note(`duplicate-of:${input.entityId}`), note(`offset-meters:${DUPLICATE_OFFSET_METERS}`)]
	};
}

export function planDeleteOne(input: {
	readonly context: SceneOperationContext;
	readonly entityId: string;
}): SceneOperationResult {
	const scene = input.context.scene;
	const target = scene.entities.find((entity) => entity.id === input.entityId);
	if (target === undefined) {
		return refusal('missing-target', `No Scene entity "${input.entityId}" exists in the accepted source.`, [
			input.entityId
		]);
	}
	const entities = scene.entities.filter((entity) => entity.id !== input.entityId);
	const clusters = cleanupClusters(scene.clusters, [input.entityId]);
	const after: SceneDocument = {
		...scene,
		entities,
		...(clusters === undefined ? { clusters: undefined } : { clusters })
	};
	if (clusters === undefined) delete after.clusters;
	const finalized = finalizeSceneCandidate({
		before: scene,
		after,
		scope: {
			operationKind: 'delete-one',
			changedEntityIds: [],
			changedEntityFields: [],
			createdEntityIds: [],
			removedEntityIds: [input.entityId],
			allowClusterCleanup: true
		}
	});
	const clustersChanged = !sameSceneValues(scene.clusters ?? [], clusters ?? []);
	const fields = clusters === undefined || scene.clusters === undefined || !clustersChanged
		? ['entities']
		: ['entities', 'clusters'];
	if (finalized.kind === 'rejected') return fromFinalization(finalized);
	return {
		kind: 'candidate',
		operationKind: 'delete-one',
		entityId: input.entityId,
		scene: finalized.scene,
		fields,
		correspondence: [{ relation: 'retired', entityId: input.entityId }],
		diagnostics: (scene.clusters ?? []).some((cluster) => cluster.memberIds.includes(input.entityId))
			? [note('cluster-membership-cleaned')]
			: []
	};
}
