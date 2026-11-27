/**
 * T2.G1a — rigid group Move/Turn and independent member duplication.
 *
 * These two operations are the only group planners that touch members in bulk;
 * their shared capture, contact and refusal helpers live in `group-operations`.
 */
import type { SceneEntity, SceneObjectCluster, Vec3 } from '../scene';
import type { SceneOperationContext } from './operations';
import type { SceneGroupOperationResult } from './group-operations';
import type { SceneRecordScope } from './record-scope';
import { refusal } from './operations/refusals';
import {
	SCENE_GROUP_DUPLICATE,
	SCENE_GROUP_TRANSFORM,
	createCandidate,
	groupSupportRefusal,
	invalid,
	movableMembers,
	readCluster,
	readContacts,
	type SceneGroupDuplicateCopy,
	type SceneGroupMemberContact,
} from './group-operations';
import { cloneEntityWithId } from './operations/finalization';
import { resolveDestinationSupport } from './operations/support';
import { DUPLICATE_OFFSET_METERS } from './operations/types';
import {
	rigidMovePosition,
	rigidPivot,
	rigidTurnPosition,
	rigidTurnRotation,
	rigidYawAdd,
} from './rigid';

export type SceneGroupMotion =
	| { readonly kind: 'move'; readonly deltaXZ: readonly [number, number] }
	| { readonly kind: 'turn'; readonly yaw: number };

export function planGroupTransform(input: {
	readonly context: SceneOperationContext;
	readonly clusterId: string;
	readonly motion: SceneGroupMotion;
	readonly contacts: readonly SceneGroupMemberContact[];
}): SceneGroupOperationResult {
	const scene = input.context.scene;
	const read = readCluster(scene, input.clusterId);
	if (read.kind !== 'ok') return read;
	const ineligible = movableMembers(read.entities);
	if (ineligible !== null) return ineligible;
	const contacts = readContacts(read.cluster, read.entities, input.contacts);
	if (contacts.kind === 'rejected') return contacts;

	const pivot =
		input.motion.kind === 'turn'
			? rigidPivot(read.entities.map((entity) => entity.position))
			: null;
	if (input.motion.kind === 'turn' && pivot === null) {
		return invalid('A group Turn needs finite member positions.', [input.clusterId]);
	}
	if (input.motion.kind === 'move') {
		if (!input.motion.deltaXZ.every(Number.isFinite)) {
			return invalid('A group Move needs a finite X/Z delta.', ['deltaXZ']);
		}
		if (input.motion.deltaXZ[0] === 0 && input.motion.deltaXZ[1] === 0) {
			return refusal('no_op', 'A group Move of zero leaves the accepted source unchanged.', [
				'deltaXZ',
			]);
		}
	} else if (!Number.isFinite(input.motion.yaw)) {
		return invalid('A group Turn needs a finite yaw.', ['yaw']);
	} else if (input.motion.yaw === 0) {
		return refusal('no_op', 'A group Turn of zero leaves the accepted source unchanged.', ['yaw']);
	}

	const moved = new Map<string, SceneEntity>();
	for (const entity of read.entities) {
		const floorMember = entity.kind !== 'light' && entity.kind !== 'artwork';
		const contactMinY = floorMember ? contacts.byId.get(entity.id) : undefined;
		if (floorMember && contactMinY === undefined) {
			return refusal(
				'missing-contact-metadata',
				`Group member "${entity.name}" (${entity.id}) has no captured contact height.`,
				[entity.id, 'contactMinY'],
			);
		}
		let position: Vec3;
		let rotation = entity.rotation;
		if (input.motion.kind === 'move') {
			position = rigidMovePosition(entity.position, input.motion.deltaXZ);
		} else {
			position = rigidTurnPosition(entity.position, pivot!, input.motion.yaw);
			rotation = floorMember
				? rigidYawAdd(entity.rotation, input.motion.yaw)
				: rigidTurnRotation(entity.rotation, input.motion.yaw);
		}
		if (floorMember) {
			const support = resolveDestinationSupport({
				context: input.context,
				entity,
				contactMinY: contactMinY!,
				point: [position[0], position[2]],
			});
			if (support.kind !== 'resolved') {
				return groupSupportRefusal(entity, [position[0], position[2]], support);
			}
		}
		moved.set(entity.id, {
			...entity,
			position,
			rotation: [rotation[0], rotation[1], rotation[2]] as Vec3,
		});
	}

	const entities = scene.entities.map((entity) => moved.get(entity.id) ?? entity);
	const scope: Omit<SceneRecordScope, 'operationKind'> = {
		changedEntityIds: read.cluster.memberIds,
		changedEntityFields:
			input.motion.kind === 'move'
				? ['position[0]', 'position[2]']
				: ['position[0]', 'position[2]', 'rotation[0]', 'rotation[1]', 'rotation[2]'],
		createdEntityIds: [],
		removedEntityIds: [],
	};
	return createCandidate({
		context: input.context,
		operationKind: SCENE_GROUP_TRANSFORM,
		clusterId: input.clusterId,
		scene: { ...scene, entities },
		fields: ['entities'],
		scope,
		correspondence: [
			{ relation: 'preserved', clusterId: input.clusterId },
			...read.cluster.memberIds.map((entityId) => ({ relation: 'preserved' as const, entityId })),
		],
	});
}

export function planGroupDuplicate(input: {
	readonly context: SceneOperationContext;
	readonly clusterId: string;
	readonly copies: readonly SceneGroupDuplicateCopy[];
	readonly newClusterId: string;
	readonly contacts: readonly SceneGroupMemberContact[];
}): SceneGroupOperationResult {
	const scene = input.context.scene;
	const read = readCluster(scene, input.clusterId);
	if (read.kind !== 'ok') return read;
	const ineligible = movableMembers(read.entities);
	if (ineligible !== null) return ineligible;
	// Every copy is captured against its source member, so a copy list in any
	// order names the same copies; nothing is remapped by member order.
	if (!Array.isArray(input.copies) || input.copies.length !== read.cluster.memberIds.length) {
		return invalid(
			`A group duplicate needs exactly ${read.cluster.memberIds.length} captured member copies, one per member.`,
			['copies'],
		);
	}
	const members = new Set(read.cluster.memberIds);
	const copyIdBySource = new Map<string, string>();
	const captured = new Set<string>();
	for (const copy of input.copies) {
		if (
			typeof copy.sourceEntityId !== 'string' ||
			copy.sourceEntityId.trim().length === 0 ||
			typeof copy.entityId !== 'string' ||
			copy.entityId.trim().length === 0
		) {
			return invalid('A captured member copy must name its source member and its new id.', [
				'copies',
			]);
		}
		if (!members.has(copy.sourceEntityId)) {
			return invalid(
				`Captured copy source "${copy.sourceEntityId}" is not a member of group "${input.clusterId}".`,
				[copy.sourceEntityId],
			);
		}
		if (copyIdBySource.has(copy.sourceEntityId)) {
			return invalid(`Captured copy source "${copy.sourceEntityId}" is used twice.`, [
				copy.sourceEntityId,
			]);
		}
		if (captured.has(copy.entityId)) {
			return invalid(`Captured duplicate id "${copy.entityId}" is used twice.`, [copy.entityId]);
		}
		captured.add(copy.entityId);
		if (scene.entities.some((entity) => entity.id === copy.entityId)) {
			return invalid(
				`Captured duplicate id "${copy.entityId}" already exists in the accepted source.`,
				[copy.entityId, 'duplicate-entity-id'],
			);
		}
		copyIdBySource.set(copy.sourceEntityId, copy.entityId);
	}
	const copyIds = read.cluster.memberIds.map((memberId) => copyIdBySource.get(memberId)!);
	if (typeof input.newClusterId !== 'string' || input.newClusterId.trim().length === 0) {
		return invalid('A group duplicate needs a captured cluster id.', ['newClusterId']);
	}
	if ((scene.clusters ?? []).some((cluster) => cluster.id === input.newClusterId)) {
		return invalid(
			`Captured cluster id "${input.newClusterId}" already exists in the accepted source.`,
			['newClusterId', 'duplicate-cluster-id'],
		);
	}
	const contacts = readContacts(read.cluster, read.entities, input.contacts);
	if (contacts.kind === 'rejected') return contacts;

	// Every copy's support is validated before any is built: a failure for any
	// member refuses the whole duplicate and names that member.
	for (const entity of read.entities) {
		if (entity.kind === 'light' || entity.kind === 'artwork') continue;
		const position: readonly [number, number] = [
			entity.position[0] + DUPLICATE_OFFSET_METERS,
			entity.position[2] + DUPLICATE_OFFSET_METERS,
		];
		const support = resolveDestinationSupport({
			context: input.context,
			entity,
			contactMinY: contacts.byId.get(entity.id)!,
			point: [position[0], position[1]],
		});
		if (support.kind !== 'resolved') return groupSupportRefusal(entity, position, support);
	}
	const copies: SceneEntity[] = read.entities.map((entity) => ({
		...cloneEntityWithId(entity, copyIdBySource.get(entity.id)!),
		position: [
			entity.position[0] + DUPLICATE_OFFSET_METERS,
			entity.position[1],
			entity.position[2] + DUPLICATE_OFFSET_METERS,
		] as Vec3,
		rotation: [entity.rotation[0], entity.rotation[1], entity.rotation[2]] as Vec3,
	}));

	const cluster: SceneObjectCluster = {
		id: input.newClusterId,
		name: read.cluster.name,
		memberIds: [...copyIds],
	};
	return createCandidate({
		context: input.context,
		operationKind: SCENE_GROUP_DUPLICATE,
		clusterId: cluster.id,
		scene: {
			...scene,
			entities: [...scene.entities, ...copies],
			clusters: [...(scene.clusters ?? []), cluster],
		},
		fields: ['entities', 'clusters'],
		scope: {
			changedEntityIds: [],
			changedEntityFields: [],
			createdEntityIds: [...copyIds],
			removedEntityIds: [],
			clusters: {
				created: [{ id: cluster.id, memberIds: [...copyIds] }],
				removed: [],
				renamed: [],
				pruned: [],
			},
		},
		correspondence: [
			{ relation: 'preserved', clusterId: input.clusterId },
			{ relation: 'created', clusterId: cluster.id },
			...copyIds.map((entityId) => ({ relation: 'created' as const, entityId })),
		],
	});
}
