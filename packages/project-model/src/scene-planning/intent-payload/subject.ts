import { type CapturedIdAllocation } from '../../f4/types';
import { type SemanticReference } from '../../references/types';
import { type SceneOperationPayload, type SceneOperationSubject } from './types';
import { type SceneOperationKind } from '../operations';
import { type ShapeIssue, ShapeReader } from '../../strict-shape';
import { type CameraFreeSceneDocument as SceneDocument } from '../../units/types';

/**
 * Read the operation's target: `none` for creation, exactly one Scene entity
 * reference otherwise. The reference must be exact for this snapshot's content,
 * at the canonical Scene location, and name the payload's entity.
 */
export function readSceneOperationSubject(input: {
	readonly reader: ShapeReader;
	readonly kind: SceneOperationKind;
	readonly targets: readonly SemanticReference[];
	readonly payload: SceneOperationPayload;
	readonly sourceContentId: string;
}): SceneOperationSubject | null {
	const { reader, kind, targets, payload, sourceContentId } = input;
	if (
		kind === 'place-object' ||
		kind === 'create-form' ||
		kind === 'place-form-copy' ||
		kind === 'place-group-copy' ||
		kind === 'create-light' ||
		kind === 'scene-group-create' ||
		kind === 'create-light-rig'
	) {
		if (targets.length !== 0) {
			reader.problem(
				'$.targets',
				'invalid-target',
				`${kind} addresses no existing subject; its entity id is a captured allocation`,
			);
			return null;
		}
		return { kind: 'none' };
	}
	if (targets.length !== 1) {
		reader.problem(
			'$.targets',
			'invalid-target',
			`${kind} addresses exactly one Scene entity; received ${targets.length} targets`,
		);
		return null;
	}
	if (
		payload.kind === 'place-object' ||
		payload.kind === 'create-form' ||
		payload.kind === 'place-form-copy' ||
		payload.kind === 'place-group-copy' ||
		payload.kind === 'create-light' ||
		payload.kind === 'scene-group-create' ||
		payload.kind === 'create-light-rig'
	)
		return null;
	const target = targets[0]!;
	if (
		payload.kind === 'scene-group-ungroup' ||
		payload.kind === 'scene-group-rename' ||
		payload.kind === 'scene-group-transform' ||
		payload.kind === 'scene-group-duplicate' ||
		payload.kind === 'scene-group-erase'
	) {
		const problem = sceneClusterTargetProblem(target, payload.clusterId, sourceContentId);
		if (problem !== null) {
			reader.problem('$.targets[0]', problem.code, problem.message);
			return null;
		}
		return { kind: 'cluster', clusterId: payload.clusterId };
	}
	const entityId = payload.entityId;
	const problem = sceneEntityTargetProblem(target, entityId, sourceContentId);
	if (problem !== null) {
		reader.problem('$.targets[0]', problem.code, problem.message);
		return null;
	}
	return { kind: 'entity', entityId };
}

/** The one creation id a place/duplicate intent must carry, or `none`. */
export function readSceneOperationAllocation(input: {
	readonly reader: ShapeReader;
	readonly kind: SceneOperationKind;
	readonly allocations: readonly CapturedIdAllocation[];
	readonly scene: SceneDocument;
}): { readonly kind: 'none' } | { readonly kind: 'created'; readonly entityId: string } | null {
	const { reader, kind, allocations, scene } = input;
	if (
		kind !== 'place-object' &&
		kind !== 'create-form' &&
		kind !== 'place-form-copy' &&
		kind !== 'duplicate-one' &&
		kind !== 'create-light' &&
		kind !== 'duplicate-light'
	) {
		if (allocations.length !== 0) {
			reader.problem(
				'$.allocatedIds',
				'unexpected-allocation',
				`${kind} creates no id, so its intent must not carry an allocation`,
			);
			return null;
		}
		return { kind: 'none' };
	}
	if (allocations.length !== 1) {
		reader.problem(
			'$.allocatedIds',
			'missing-allocation',
			`${kind} needs exactly one captured scene-entity id; received ${allocations.length}`,
		);
		return null;
	}
	const allocation = allocations[0]!;
	if (allocation.kind !== 'scene-entity') {
		reader.problem(
			'$.allocatedIds[0].kind',
			'unsupported-allocation',
			`${kind} allocates a scene-entity id, not "${allocation.kind}"`,
		);
		return null;
	}
	if (scene.entities.some((entity) => entity.id === allocation.id)) {
		reader.problem(
			'$.allocatedIds[0].id',
			'duplicate-entity-id',
			`Captured id "${allocation.id}" is already used by the accepted source; it is never renamed`,
		);
		return null;
	}
	return { kind: 'created', entityId: allocation.id };
}

export function sceneClusterTargetProblem(
	target: SemanticReference,
	clusterId: string,
	sourceContentId: string,
): ShapeIssue | null {
	if (target.domain !== 'scene') {
		return {
			path: '$.targets[0].domain',
			code: 'invalid-target',
			message: `Scene group operations address Scene subjects, not "${target.domain}"`,
		};
	}
	if (target.subject.kind !== 'cluster') {
		return {
			path: '$.targets[0].subject.kind',
			code: 'invalid-target',
			message: `A group operation addresses a cluster subject, not "${target.subject.kind}"`,
		};
	}
	if (target.subject.id !== clusterId) {
		return {
			path: '$.targets[0].subject.id',
			code: 'invalid-target',
			message: `The target names "${target.subject.id}" and the payload names "${clusterId}"`,
		};
	}
	if (target.revision.kind !== 'exact' || target.revision.contentRevision !== sourceContentId) {
		return {
			path: '$.targets[0].revision',
			code: 'stale-revision',
			message: "The target must be exact for this snapshot's content revision",
		};
	}
	if (target.instancePath.length !== 0) {
		return {
			path: '$.targets[0].instancePath',
			code: 'invalid-target',
			message: 'A root Scene cluster is addressed with an empty instance path',
		};
	}
	if (target.location.kind !== 'project-root') {
		return {
			path: '$.targets[0].location',
			code: 'invalid-target',
			message: 'A current-format Scene cluster lives at the project root',
		};
	}
	if (target.componentId !== null || target.capabilityId !== null) {
		return {
			path: '$.targets[0]',
			code: 'invalid-target',
			message: 'A Scene cluster target names no component or capability',
		};
	}
	return null;
}

export function sceneEntityTargetProblem(
	target: SemanticReference,
	entityId: string,
	sourceContentId: string,
): ShapeIssue | null {
	if (target.domain !== 'scene') {
		return {
			path: '$.targets[0].domain',
			code: 'invalid-target',
			message: `Scene operations address Scene subjects, not "${target.domain}"`,
		};
	}
	if (target.subject.kind !== 'entity') {
		return {
			path: '$.targets[0].subject.kind',
			code: 'invalid-target',
			message: `Scene operations address entity subjects, not "${target.subject.kind}"`,
		};
	}
	if (target.subject.id !== entityId) {
		return {
			path: '$.targets[0].subject.id',
			code: 'invalid-target',
			message: `The target names "${target.subject.id}" and the payload names "${entityId}"`,
		};
	}
	if (target.revision.kind !== 'exact' || target.revision.contentRevision !== sourceContentId) {
		return {
			path: '$.targets[0].revision',
			code: 'stale-revision',
			message: "The target must be exact for this snapshot's content revision",
		};
	}
	if (target.instancePath.length !== 0) {
		return {
			path: '$.targets[0].instancePath',
			code: 'invalid-target',
			message: 'A root Scene entity is addressed with an empty instance path',
		};
	}
	if (target.location.kind !== 'project-root') {
		return {
			path: '$.targets[0].location',
			code: 'invalid-target',
			message: 'A current-format Scene entity lives at the project root',
		};
	}
	if (target.componentId !== null || target.capabilityId !== null) {
		return {
			path: '$.targets[0]',
			code: 'invalid-target',
			message: 'A Scene entity target names no component or capability',
		};
	}
	return null;
}
