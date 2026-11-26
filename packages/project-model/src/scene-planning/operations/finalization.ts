import { cloneFormSource, type SceneEntity, type Vec3 } from '../../scene';
import { refusal } from './refusals';
import { entityScale } from './support';
import {
	type SceneOperationKind,
	type SceneOperationRefusal,
	type SceneOperationCorrespondence,
	type SceneOperationSupportEvidence,
	type SceneOperationResult,
	type SceneOperationContext,
} from './types';
import { finalizeSceneCandidate, sameSceneValues, type SceneRecordScope } from '../record-scope';
import { type ShapeIssue } from '../../strict-shape';
import { type CameraFreeSceneDocument as SceneDocument } from '../../units/types';

/**
 * `place-object` is the prepared candidate, wrapped here with the same
 * record-scope finalization every other operation uses. Keeping the placement
 * math in one place is what stops Plan and 3D input from diverging.
 */
export function finalizePlacedEntity(input: {
	readonly context: SceneOperationContext;
	readonly entityId: string;
	readonly scene: SceneDocument;
}): SceneOperationResult {
	const finalized = finalizeSceneCandidate({
		before: input.context.scene,
		after: input.scene,
		scope: {
			operationKind: 'place-object',
			changedEntityIds: [],
			changedEntityFields: [],
			createdEntityIds: [input.entityId],
			removedEntityIds: [],
			allowClusterCleanup: false,
		},
	});
	if (finalized.kind === 'rejected') return fromFinalization(finalized);
	return {
		kind: 'candidate',
		operationKind: 'place-object',
		entityId: input.entityId,
		scene: finalized.scene,
		fields: ['entities'],
		correspondence: [{ relation: 'created', entityId: input.entityId }],
		diagnostics: [],
	};
}

export function finalize(input: {
	readonly context: SceneOperationContext;
	readonly operationKind: SceneOperationKind;
	readonly next: SceneEntity;
	readonly fields: readonly string[];
	readonly scope: Omit<SceneRecordScope, 'operationKind'>;
	readonly correspondence: readonly SceneOperationCorrespondence[];
	readonly support?: SceneOperationSupportEvidence;
}): SceneOperationResult {
	const before = input.context.scene;
	const after: SceneDocument = {
		...before,
		entities: before.entities.map((entity) => (entity.id === input.next.id ? input.next : entity)),
	};
	if (sameSceneValues(after, before)) {
		return refusal(
			'no_op',
			`The ${input.operationKind} operation leaves the accepted source unchanged.`,
			[],
		);
	}
	const finalized = finalizeSceneCandidate({
		before,
		after,
		scope: { operationKind: input.operationKind, ...input.scope },
	});
	if (finalized.kind === 'rejected') return fromFinalization(finalized);
	return {
		kind: 'candidate',
		operationKind: input.operationKind,
		entityId: input.next.id,
		scene: finalized.scene,
		fields: input.fields,
		correspondence: input.correspondence,
		...(input.support === undefined ? {} : { support: input.support }),
		worldPose: {
			position: [...input.next.position],
			rotation: [...input.next.rotation],
			scale: entityScale(input.next),
		},
		diagnostics: [],
	};
}

export function cloneEntityWithId(entity: SceneEntity, id: string): SceneEntity {
	if (entity.kind === 'form') {
		return {
			...entity,
			id,
			position: [...entity.position] as Vec3,
			rotation: [...entity.rotation] as Vec3,
			form: cloneFormSource(entity.form),
		};
	}
	if (entity.kind === 'primitive') {
		// The spread preserves the discriminated primitive; TypeScript cannot carry
		// that correlation through a union spread, so the clone states its type.
		return {
			...entity,
			id,
			position: [...entity.position] as Vec3,
			rotation: [...entity.rotation] as Vec3,
			dimensions: { ...entity.dimensions },
		} as SceneEntity;
	}
	return {
		...entity,
		id,
		position: [...entity.position] as Vec3,
		rotation: [...entity.rotation] as Vec3,
	};
}

export function note(message: string): ShapeIssue {
	return { path: '$.payload', code: 'operation-note', message };
}

export function cleanupClusters(
	clusters: SceneDocument['clusters'],
	removedIds: readonly string[],
): SceneDocument['clusters'] {
	if (clusters === undefined) return undefined;
	return clusters
		.map((cluster) => ({
			...cluster,
			memberIds: cluster.memberIds.filter((memberId) => !removedIds.includes(memberId)),
		}))
		.filter((cluster) => cluster.memberIds.length >= 2);
}

export function fromFinalization(
	finalized: Extract<ReturnType<typeof finalizeSceneCandidate>, { kind: 'rejected' }>,
): SceneOperationRefusal {
	return {
		kind: 'rejected',
		code: finalized.code,
		message: finalized.message,
		diagnostics: finalized.diagnostics,
	};
}
