/**
 * T2.G1a — the group operation set.
 *
 * Groups reuse the accepted flat cluster record: there is no parent transform,
 * no nested membership and no shared stratum. These seven operations are
 * concrete because G1 has exactly these consumers:
 *
 * - `scene-group-create`, `scene-group-ungroup` and `scene-group-rename` write
 *   one cluster;
 * - `scene-group-transform` moves or turns every member rigidly, revalidating
 *   support without re-grounding it;
 * - `scene-group-duplicate` appends N independent entity copies plus one new
 *   cluster;
 * - `scene-group-erase` removes every member and the cluster;
 * - `create-light-rig` appends exactly three validated lights and one cluster.
 *
 * Every operation reuses the per-kind gates and the per-kind entity clone; a
 * copy is remapped by captured id, never by name or member order. All seven
 * return through `finalizeSceneCandidate`, so their exact record grants are
 * checked before F.4 admission.
 */
import type { SceneEntity, SceneLightEntity, SceneObjectCluster } from '../scene';
import type { CameraFreeSceneDocument as SceneDocument } from '../units/types';
import type { ShapeIssue } from '../strict-shape';
import type {
	SceneOperationContext,
	SceneOperationCorrespondence,
	SceneOperationRefusal,
	SceneOperationRefusalCode,
	SceneOperationSupportEvidence,
} from './operations';
import {
	finalizeSceneCandidate,
	sameSceneValues,
	type SceneClusterScope,
	type SceneRecordScope,
} from './record-scope';
import { refusal } from './operations/refusals';
import { floorTransformSupport, readContactMinY } from './operations/support';
import { SCENE_NAME_LIMIT } from './operations/types';
import { buildLightEntity, type SceneLightSpec } from './light-operations';

export const SCENE_GROUP_CREATE = 'scene-group-create';
export const SCENE_GROUP_UNGROUP = 'scene-group-ungroup';
export const SCENE_GROUP_RENAME = 'scene-group-rename';
export const SCENE_GROUP_TRANSFORM = 'scene-group-transform';
export const SCENE_GROUP_DUPLICATE = 'scene-group-duplicate';
export const SCENE_GROUP_ERASE = 'scene-group-erase';
export const CREATE_LIGHT_RIG = 'create-light-rig';

export const SCENE_GROUP_OPERATION_KINDS = [
	SCENE_GROUP_CREATE,
	SCENE_GROUP_UNGROUP,
	SCENE_GROUP_RENAME,
	SCENE_GROUP_TRANSFORM,
	SCENE_GROUP_DUPLICATE,
	SCENE_GROUP_ERASE,
	CREATE_LIGHT_RIG,
] as const;

export type SceneGroupOperationKind = (typeof SCENE_GROUP_OPERATION_KINDS)[number];

/** A support witness captured for one group member at its destination. */
export type SceneGroupSupportEvidence = SceneOperationSupportEvidence;

export type SceneGroupCorrespondence =
	| {
			readonly relation: 'created' | 'preserved' | 'retired';
			readonly clusterId: string;
	  }
	| {
			readonly relation: 'created' | 'preserved' | 'retired';
			readonly entityId: string;
	  };

export type SceneGroupOperationCandidate = {
	readonly kind: 'candidate';
	readonly operationKind: SceneGroupOperationKind;
	readonly clusterId: string;
	readonly scene: SceneDocument;
	readonly fields: readonly string[];
	readonly correspondence: readonly SceneGroupCorrespondence[];
	readonly diagnostics: readonly ShapeIssue[];
	/** The members erased by `scene-group-erase`, so the planner can unlink Experience. */
	readonly removedEntityIds?: readonly string[];
};

export type SceneGroupOperationResult = SceneGroupOperationCandidate | SceneOperationRefusal;

export type SceneGroupMemberContact = {
	readonly entityId: string;
	readonly contactMinY: number;
};

/** One member's captured copy identity: the source member and its new id. */
export type SceneGroupDuplicateCopy = {
	readonly sourceEntityId: string;
	readonly entityId: string;
};

type ClusterRead =
	| {
			readonly kind: 'ok';
			readonly cluster: SceneObjectCluster;
			readonly entities: readonly SceneEntity[];
	  }
	| SceneOperationRefusal;

/** An entity a group operation can move rigidly at this moment. */
export function groupMemberEligible(entity: SceneEntity): boolean {
	return (
		entity.kind === 'light' || entity.kind === 'artwork' || floorTransformSupport(entity).supported
	);
}

export function readCluster(scene: SceneDocument, clusterId: string): ClusterRead {
	const cluster = (scene.clusters ?? []).find((candidate) => candidate.id === clusterId);
	if (cluster === undefined) {
		return refusal(
			'missing-target',
			`No Scene cluster "${clusterId}" exists in the accepted source.`,
			[clusterId],
		);
	}
	const entities: SceneEntity[] = [];
	for (const memberId of cluster.memberIds) {
		const entity = scene.entities.find((candidate) => candidate.id === memberId);
		if (entity === undefined) {
			return refusal(
				'missing-target',
				`Cluster "${clusterId}" names Scene entity "${memberId}", which does not exist.`,
				[clusterId, memberId],
			);
		}
		entities.push(entity);
	}
	return { kind: 'ok', cluster, entities };
}

export function readGroupName(
	name: string,
): { readonly kind: 'value'; readonly value: string } | SceneOperationRefusal {
	const trimmed = typeof name === 'string' ? name.trim() : '';
	if (trimmed.length === 0) return invalid('A group name can’t be empty.', ['name']);
	if (trimmed.length > SCENE_NAME_LIMIT) {
		return invalid(`A group name can have at most ${SCENE_NAME_LIMIT} characters.`, ['name']);
	}
	return { kind: 'value', value: trimmed };
}

export function invalid(message: string, diagnostics: readonly string[]): SceneOperationRefusal {
	return refusal('invalid-value', message, diagnostics);
}

export function movableMembers(entities: readonly SceneEntity[]): SceneOperationRefusal | null {
	for (const entity of entities) {
		if (!groupMemberEligible(entity)) {
			return refusal(
				'unsupported-transform',
				`Group member "${entity.name}" (${entity.id}) cannot move rigidly right now; Ungroup to edit it separately.`,
				[entity.id],
			);
		}
	}
	return null;
}

export function createCandidate(input: {
	readonly context: SceneOperationContext;
	readonly operationKind: SceneGroupOperationKind;
	readonly clusterId: string;
	readonly scene: SceneDocument;
	readonly fields: readonly string[];
	readonly scope: Omit<SceneRecordScope, 'operationKind'>;
	readonly correspondence: readonly SceneGroupCorrespondence[];
	readonly diagnostics?: readonly ShapeIssue[];
	readonly removedEntityIds?: readonly string[];
}): SceneGroupOperationResult {
	const before = input.context.scene;
	if (sameSceneValues(before, input.scene)) {
		return refusal(
			'no_op',
			`The ${input.operationKind} operation leaves the accepted source unchanged.`,
			[],
		);
	}
	const finalized = finalizeSceneCandidate({
		before,
		after: input.scene,
		scope: {
			operationKind: input.operationKind,
			...input.scope,
			...snapshotClusterScope(input.scope.clusters),
		},
	});
	if (finalized.kind === 'rejected') {
		return {
			kind: 'rejected',
			code: finalized.code,
			message: finalized.message,
			diagnostics: finalized.diagnostics,
		};
	}
	return {
		kind: 'candidate',
		operationKind: input.operationKind,
		clusterId: input.clusterId,
		scene: finalized.scene,
		fields: input.fields,
		correspondence: input.correspondence,
		diagnostics: input.diagnostics ?? [],
		...(input.removedEntityIds === undefined
			? {}
			: { removedEntityIds: [...input.removedEntityIds] }),
	};
}

/**
 * The declared cluster grant is a snapshot, never a view of the candidate: a
 * created membership is copied, so an in-place edit of the candidate's array
 * cannot change the declaration it is checked against.
 */
function snapshotClusterScope(clusters: SceneClusterScope | undefined): {
	readonly clusters?: SceneClusterScope;
} {
	if (clusters === undefined) return {};
	return {
		clusters: {
			...clusters,
			created: clusters.created.map((cluster) => ({
				id: cluster.id,
				memberIds: [...cluster.memberIds],
			})),
		},
	};
}

export function planGroupCreate(input: {
	readonly context: SceneOperationContext;
	readonly clusterId: string;
	readonly memberIds: readonly string[];
	readonly name: string;
}): SceneGroupOperationResult {
	const scene = input.context.scene;
	if (typeof input.clusterId !== 'string' || input.clusterId.trim().length === 0) {
		return invalid('A group needs a captured cluster id.', ['clusterId']);
	}
	if ((scene.clusters ?? []).some((cluster) => cluster.id === input.clusterId)) {
		return invalid(
			`Captured cluster id "${input.clusterId}" already exists in the accepted source.`,
			['clusterId', 'duplicate-cluster-id'],
		);
	}
	if (!Array.isArray(input.memberIds) || input.memberIds.length < 2) {
		return invalid('A group needs at least two members.', ['memberIds']);
	}
	const seen = new Set<string>();
	for (const memberId of input.memberIds) {
		if (seen.has(memberId)) return invalid(`Member "${memberId}" is selected twice.`, [memberId]);
		seen.add(memberId);
		const entity = scene.entities.find((candidate) => candidate.id === memberId);
		if (entity === undefined) {
			return refusal(
				'missing-target',
				`No Scene entity "${memberId}" exists in the accepted source.`,
				[memberId],
			);
		}
		const cluster = (scene.clusters ?? []).find((candidate) =>
			candidate.memberIds.includes(memberId),
		);
		if (cluster !== undefined) {
			return refusal(
				'already-grouped',
				`Entity "${entity.name}" (${memberId}) already belongs to group "${cluster.name}" (${cluster.id}). Groups are flat and are not nested or merged.`,
				[memberId, cluster.id],
			);
		}
		if (!groupMemberEligible(entity)) {
			return refusal(
				'unsupported-transform',
				`Entity "${entity.name}" (${memberId}) cannot move rigidly right now, so it cannot join a group.`,
				[memberId],
			);
		}
	}
	const name = readGroupName(input.name);
	if (name.kind === 'rejected') return name;
	const cluster: SceneObjectCluster = {
		id: input.clusterId,
		name: name.value,
		memberIds: [...input.memberIds],
	};
	return createCandidate({
		context: input.context,
		operationKind: SCENE_GROUP_CREATE,
		clusterId: cluster.id,
		scene: { ...scene, clusters: [...(scene.clusters ?? []), cluster] },
		fields: ['clusters'],
		scope: {
			changedEntityIds: [],
			changedEntityFields: [],
			createdEntityIds: [],
			removedEntityIds: [],
			clusters: {
				created: [{ id: cluster.id, memberIds: cluster.memberIds }],
				removed: [],
				renamed: [],
				pruned: [],
			},
		},
		correspondence: [
			{ relation: 'created', clusterId: cluster.id },
			...input.memberIds.map((entityId) => ({ relation: 'preserved' as const, entityId })),
		],
	});
}

export function planGroupUngroup(input: {
	readonly context: SceneOperationContext;
	readonly clusterId: string;
}): SceneGroupOperationResult {
	const scene = input.context.scene;
	const target = readCluster(scene, input.clusterId);
	if (target.kind !== 'ok') return target;
	const clusters = (scene.clusters ?? []).filter((cluster) => cluster.id !== input.clusterId);
	const after: SceneDocument = { ...scene };
	if (clusters.length === 0) delete after.clusters;
	else after.clusters = clusters;
	return createCandidate({
		context: input.context,
		operationKind: SCENE_GROUP_UNGROUP,
		clusterId: input.clusterId,
		scene: after,
		fields: ['clusters'],
		scope: {
			changedEntityIds: [],
			changedEntityFields: [],
			createdEntityIds: [],
			removedEntityIds: [],
			clusters: { created: [], removed: [input.clusterId], renamed: [], pruned: [] },
		},
		correspondence: [
			{ relation: 'retired', clusterId: input.clusterId },
			...target.cluster.memberIds.map((entityId) => ({ relation: 'preserved' as const, entityId })),
		],
	});
}

export function planGroupRename(input: {
	readonly context: SceneOperationContext;
	readonly clusterId: string;
	readonly name: string;
}): SceneGroupOperationResult {
	const scene = input.context.scene;
	const read = readCluster(scene, input.clusterId);
	if (read.kind !== 'ok') return read;
	const name = readGroupName(input.name);
	if (name.kind === 'rejected') return name;
	if (read.cluster.name === name.value) {
		return refusal('no_op', `Group "${input.clusterId}" is already named "${name.value}".`, [
			'name',
		]);
	}
	return createCandidate({
		context: input.context,
		operationKind: SCENE_GROUP_RENAME,
		clusterId: input.clusterId,
		scene: {
			...scene,
			clusters: (scene.clusters ?? []).map((cluster) =>
				cluster.id === input.clusterId ? { ...cluster, name: name.value } : cluster,
			),
		},
		fields: ['clusters'],
		scope: {
			changedEntityIds: [],
			changedEntityFields: [],
			createdEntityIds: [],
			removedEntityIds: [],
			clusters: { created: [], removed: [], renamed: [input.clusterId], pruned: [] },
		},
		correspondence: [
			{ relation: 'preserved', clusterId: input.clusterId },
			...read.cluster.memberIds.map((entityId) => ({ relation: 'preserved' as const, entityId })),
		],
	});
}

export function planGroupErase(input: {
	readonly context: SceneOperationContext;
	readonly clusterId: string;
}): SceneGroupOperationResult {
	const scene = input.context.scene;
	const read = readCluster(scene, input.clusterId);
	if (read.kind !== 'ok') return read;
	const removed = new Set(read.cluster.memberIds);
	const clusters = (scene.clusters ?? []).filter((cluster) => cluster.id !== input.clusterId);
	const after: SceneDocument = {
		...scene,
		entities: scene.entities.filter((entity) => !removed.has(entity.id)),
	};
	if (clusters.length === 0) delete after.clusters;
	else after.clusters = clusters;
	return createCandidate({
		context: input.context,
		operationKind: SCENE_GROUP_ERASE,
		clusterId: input.clusterId,
		scene: after,
		fields: ['entities', 'clusters'],
		scope: {
			changedEntityIds: [],
			changedEntityFields: [],
			createdEntityIds: [],
			removedEntityIds: [...read.cluster.memberIds],
			clusters: { created: [], removed: [input.clusterId], renamed: [], pruned: [] },
		},
		correspondence: [
			{ relation: 'retired', clusterId: input.clusterId },
			...read.cluster.memberIds.map((entityId) => ({ relation: 'retired' as const, entityId })),
		],
		removedEntityIds: [...read.cluster.memberIds],
	});
}

export function planCreateLightRig(input: {
	readonly context: SceneOperationContext;
	readonly clusterId: string;
	readonly name: string;
	readonly lights: readonly (SceneLightSpec & { readonly entityId: string })[];
}): SceneGroupOperationResult {
	const scene = input.context.scene;
	if ((scene.clusters ?? []).some((cluster) => cluster.id === input.clusterId)) {
		return invalid(
			`Captured cluster id "${input.clusterId}" already exists in the accepted source.`,
			['clusterId', 'duplicate-cluster-id'],
		);
	}
	const name = readGroupName(input.name);
	if (name.kind === 'rejected') return name;
	if (!Array.isArray(input.lights) || input.lights.length !== 3) {
		return invalid('A light rig has exactly three lights.', ['lights']);
	}
	const ids = new Set<string>();
	const lights: SceneLightEntity[] = [];
	for (const light of input.lights) {
		if (typeof light.entityId !== 'string' || light.entityId.trim().length === 0) {
			return invalid('A rig light needs a captured entity id.', ['entityId']);
		}
		if (ids.has(light.entityId)) {
			return invalid(`Rig light id "${light.entityId}" is used twice.`, [light.entityId]);
		}
		ids.add(light.entityId);
		if (scene.entities.some((entity) => entity.id === light.entityId)) {
			return invalid(`Captured rig light id "${light.entityId}" already exists.`, [
				light.entityId,
				'duplicate-entity-id',
			]);
		}
		const built = buildLightEntity({ ...light, entityId: light.entityId });
		if (built.kind === 'rejected') return built;
		lights.push(built.entity);
	}
	const cluster: SceneObjectCluster = {
		id: input.clusterId,
		name: name.value,
		memberIds: input.lights.map((light) => light.entityId),
	};
	return createCandidate({
		context: input.context,
		operationKind: CREATE_LIGHT_RIG,
		clusterId: cluster.id,
		scene: {
			...scene,
			entities: [...scene.entities, ...lights],
			clusters: [...(scene.clusters ?? []), cluster],
		},
		fields: ['entities', 'clusters'],
		scope: {
			changedEntityIds: [],
			changedEntityFields: [],
			createdEntityIds: [...cluster.memberIds],
			removedEntityIds: [],
			clusters: {
				created: [{ id: cluster.id, memberIds: cluster.memberIds }],
				removed: [],
				renamed: [],
				pruned: [],
			},
		},
		correspondence: [
			{ relation: 'created', clusterId: cluster.id },
			...cluster.memberIds.map((entityId) => ({ relation: 'created' as const, entityId })),
		],
	});
}

export function readContacts(
	cluster: SceneObjectCluster,
	entities: readonly SceneEntity[],
	contacts: readonly SceneGroupMemberContact[],
): { readonly kind: 'ok'; readonly byId: ReadonlyMap<string, number> } | SceneOperationRefusal {
	const members = new Set(cluster.memberIds);
	const byId = new Map<string, number>();
	for (const contact of contacts) {
		if (!members.has(contact.entityId)) {
			return invalid(`Contact entry "${contact.entityId}" is not a member of this group.`, [
				contact.entityId,
			]);
		}
		if (byId.has(contact.entityId)) {
			return invalid(`Contact entry "${contact.entityId}" is captured twice.`, [contact.entityId]);
		}
		const entity = entities.find((candidate) => candidate.id === contact.entityId)!;
		const read = readContactMinY(entity, contact.contactMinY);
		if (read.kind === 'rejected') return read;
		byId.set(contact.entityId, read.value);
	}
	for (const entity of entities) {
		if (entity.kind === 'light' || entity.kind === 'artwork') continue;
		if (!byId.has(entity.id)) {
			return refusal(
				'missing-contact-metadata',
				`Group member "${entity.name}" (${entity.id}) has no captured contact height.`,
				[entity.id, 'contactMinY'],
			);
		}
	}
	return { kind: 'ok', byId };
}

export function groupSupportRefusal(
	entity: SceneEntity,
	point: readonly [number, number],
	refusalValue: SceneOperationRefusal,
): SceneOperationRefusal {
	const available = refusalValue.diagnostics.map((diagnostic) => diagnostic.message).join('; ');
	return {
		kind: 'rejected',
		code: refusalValue.code,
		message: `Group member "${entity.name}" (${entity.id}) cannot keep its height at destination (${point[0]}, ${point[1]}): ${refusalValue.message}${available.length === 0 ? '' : ` Available: ${available}`}`,
		diagnostics: [
			{
				path: '$.payload',
				code: 'operation-refusal',
				message: entity.id,
			},
			{
				path: '$.payload',
				code: 'operation-refusal',
				message: `destination:${point[0]},${point[1]}`,
			},
			{
				path: '$.payload',
				code: 'operation-refusal',
				message: `available:${available}`,
			},
		],
	};
}

export type { SceneOperationCorrespondence, SceneOperationRefusalCode };
