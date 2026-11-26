/** Assignment normal form: primitive, Form and model Finish assignment. */

import { MATERIAL_NEUTRAL_BASE_ID } from '../../materials/types';
import { type MaterialId, type SceneEntity, type SceneMaterialInstance } from '../../scene';
import {
	catalogueBaseOf,
	isFinishPaintable,
	isPristineInstance,
	materialInstanceById,
	type SceneFinishRef,
} from './model';
import { type TypedResource } from '../../units/types';

export function assignOne(
	entity: SceneEntity,
	finish: SceneFinishRef,
	materials: SceneMaterialInstance[],
	pristineIdForBase: (base: MaterialId) => string,
): SceneEntity {
	if (!isFinishPaintable(entity)) return entity;
	if (finish === 'model-own') {
		if (entity.kind !== 'model') return entity;
		const { materialInstanceId: _previous, ...rest } = entity as SceneEntity & {
			materialInstanceId?: string;
		};
		void _previous;
		return rest as SceneEntity;
	}
	if ('curated' in finish) {
		if (entity.kind === 'model') {
			const instance = materialInstanceById(materials, entity.materialInstanceId);
			// Already carried by the same pristine base: nothing to write.
			if (
				instance !== undefined &&
				isPristineInstance(instance) &&
				catalogueBaseOf(instance) === finish.curated
			) {
				return entity;
			}
			return { ...entity, materialInstanceId: pristineIdForBase(finish.curated) };
		}
		const { materialInstanceId: _previous, ...rest } = entity as SceneEntity & {
			materialInstanceId?: string;
		};
		void _previous;
		return { ...rest, materialId: finish.curated } as SceneEntity;
	}
	const project = materialInstanceById(materials, finish.project);
	if (project === undefined) return entity;
	if (entity.kind === 'model') {
		return { ...entity, materialInstanceId: project.id };
	}
	return {
		...entity,
		materialId: catalogueBaseOf(project) ?? MATERIAL_NEUTRAL_BASE_ID,
		materialInstanceId: project.id,
	} as SceneEntity;
}

export function collectPristine(
	materials: readonly SceneMaterialInstance[],
	entities: readonly SceneEntity[],
): SceneMaterialInstance[] {
	const used = new Set(
		entities
			.map((entity) => (entity as SceneEntity & { materialInstanceId?: string }).materialInstanceId)
			.filter((id): id is string => id !== undefined),
	);
	return materials.filter((instance) => !isPristineInstance(instance) || used.has(instance.id));
}

export function materialCandidateScopeProblem(
	beforeResources: readonly TypedResource[],
	afterResources: readonly TypedResource[],
	beforeLock: readonly import('../../units/types').DependencyLockEntry[],
	afterLock: readonly import('../../units/types').DependencyLockEntry[],
	allowedResourceIds: ReadonlySet<string>,
	addedLocks: readonly import('../../units/types').DependencyLockEntry[],
): string | null {
	const resourceKey = (resource: TypedResource) => `${resource.kind}:${resource.id}`;
	const beforeById = new Map(beforeResources.map((resource) => [resourceKey(resource), resource]));
	const afterById = new Map(afterResources.map((resource) => [resourceKey(resource), resource]));
	if (afterById.size !== afterResources.length) return 'Two resources claim the same identity.';
	for (const [key, resource] of beforeById) {
		const next = afterById.get(key);
		if (next === undefined || JSON.stringify(next) !== JSON.stringify(resource)) {
			return 'A material registration may not change an existing resource.';
		}
	}
	for (const [key, resource] of afterById) {
		if (beforeById.has(key)) continue;
		if (!allowedResourceIds.has(resource.id))
			return 'A material registration added an undeclared resource.';
	}
	for (const id of allowedResourceIds) {
		if (![...afterById.values()].some((resource) => resource.id === id)) {
			return 'A material registration omitted one of its declared resources.';
		}
	}
	const lockKey = (entry: import('../../units/types').DependencyLockEntry) => JSON.stringify(entry);
	const beforeLockKeys = new Set(beforeLock.map(lockKey));
	const afterLockKeys = new Set(afterLock.map(lockKey));
	for (const entry of beforeLock) {
		if (!afterLockKeys.has(lockKey(entry)))
			return 'A material registration may not remove or rewrite a dependency lock.';
	}
	const declared = new Set(addedLocks.map(lockKey));
	for (const entry of afterLock) {
		if (beforeLockKeys.has(lockKey(entry))) continue;
		if (!declared.has(lockKey(entry)))
			return 'A material registration added an undeclared dependency lock.';
	}
	for (const entry of addedLocks) {
		if (!afterLockKeys.has(lockKey(entry)))
			return 'A material registration omitted its material lock.';
	}
	return null;
}
