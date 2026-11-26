/** The shared Finish edit plan: colour, sheen and metal updates. */

import { surfaceKey } from '@portfolio/layout-core/plan';
import { type LayoutDocumentWallFirst } from '@portfolio/layout-core/wall';
import { MATERIAL_NEUTRAL_BASE_ID, type Recipe } from '../../materials/types';
import { type MaterialId, type SceneEntity, type SceneMaterialInstance } from '../../scene';
import { collectPristine } from './assignment';
import {
	applyFinishEdit,
	catalogueBaseOf,
	finishEditIsNoop,
	finishOf,
	finishRefOfKey,
	isFinishPaintable,
	isPristineInstance,
	materialInstanceById,
	nextFinishName,
	usersOfFinish,
	type FinishKey,
	type SceneFinishEdit,
} from './model';
import { type FinishPlannerOptions, labelOf } from './shared';
import { sameSceneValues } from '../record-scope';
import { type CameraFreeSceneDocument as SceneDocument } from '../../units/types';

export type EditPlan =
	| {
			readonly kind: 'planned';
			readonly scene: SceneDocument;
			readonly changedEntityIds: readonly string[];
			readonly changedSurfaceKeys: readonly string[];
			readonly subjectIds: readonly string[];
			readonly addedMaterials: readonly string[];
			readonly changedMaterials: readonly string[];
			readonly removedMaterials: readonly string[];
	  }
	| { readonly kind: 'rejected'; readonly code: string; readonly message: string };

export function planEdit(
	base: SceneDocument,
	input: {
		readonly layout: LayoutDocumentWallFirst;
		readonly entityId: string;
		readonly from: FinishKey;
		readonly reach: number;
		readonly mode: 'just-this' | 'all' | 'in-place';
		readonly edit: SceneFinishEdit;
		readonly allocateId: string | null;
		readonly options: FinishPlannerOptions;
		readonly materialRecipes?: ReadonlyMap<string, Recipe>;
	},
): EditPlan {
	const entity = base.entities.find((candidate) => candidate.id === input.entityId);
	if (entity === undefined)
		return {
			kind: 'rejected',
			code: 'unknown-entity',
			message: 'Choose an object from the current Scene revision.',
		};
	if (!isFinishPaintable(entity)) {
		return { kind: 'rejected', code: 'not-paintable', message: 'That object has no Finish.' };
	}
	const key = finishOf(entity, base.materials);
	if (key === null || key === 'model-own') {
		return {
			kind: 'rejected',
			code: 'not-editable',
			message: "A model's own materials are not a Finish. Choose a Finish first.",
		};
	}
	const ref = finishRefOfKey(key);
	if (ref === null || ref === 'model-own') {
		return { kind: 'rejected', code: 'unknown-finish', message: 'That Finish no longer exists.' };
	}
	if (input.from !== key) {
		return {
			kind: 'rejected',
			code: 'stale-finish',
			message: 'That object’s Finish changed. Reopen the row and try again.',
		};
	}
	const users = usersOfFinish(base, key, input.layout);
	const reach = users.length;
	if (input.reach !== reach) {
		return {
			kind: 'rejected',
			code: 'stale-reach',
			message: `That Finish is now used by ${reach} object${reach === 1 ? '' : 's'}.`,
		};
	}
	const curated = 'curated' in ref;
	if (curated && input.mode === 'in-place') {
		return {
			kind: 'rejected',
			code: 'mode-mismatch',
			message: 'A curated Finish is never edited in place.',
		};
	}
	if (input.mode === 'all' && reach === 1) {
		return {
			kind: 'rejected',
			code: 'mode-mismatch',
			message: 'A Finish with one user is edited for that object.',
		};
	}
	if (!curated && input.mode === 'in-place' && reach > 1) {
		return {
			kind: 'rejected',
			code: 'mode-mismatch',
			message: 'A shared Finish is edited for one object or for all of them.',
		};
	}
	const needsNewInstance = curated || input.mode === 'just-this';
	if (needsNewInstance && input.allocateId === null) {
		return {
			kind: 'rejected',
			code: 'missing-allocation',
			message: 'This edit needs an allocated Finish id.',
		};
	}
	if (!needsNewInstance && input.allocateId !== null) {
		return {
			kind: 'rejected',
			code: 'unexpected-allocation',
			message: 'Editing a Finish in place creates no id.',
		};
	}

	const materials = [...base.materials];
	let entities = base.entities;
	let surfaceFinishes = base.surfaceFinishes;
	let changedSurfaceKeys: string[] = [];
	const addedMaterials: string[] = [];
	const changedMaterials: string[] = [];

	if (needsNewInstance) {
		const project =
			'project' in ref ? materialInstanceById(base.materials, ref.project) : undefined;
		if ('project' in ref && project === undefined) {
			return { kind: 'rejected', code: 'unknown-finish', message: 'That Finish no longer exists.' };
		}
		const baseId = curated ? ref.curated : (catalogueBaseOf(project!) ?? MATERIAL_NEUTRAL_BASE_ID);
		// A curated edit starts from the catalogue base; a clone keeps every
		// authored value of its source Finish and changes only its id and name.
		const seed: SceneMaterialInstance = curated
			? {
					id: input.allocateId!,
					name: nextFinishName(labelOf(input.options, baseId as MaterialId), base.materials),
					base: { catalogue: baseId },
				}
			: {
					...project!,
					id: input.allocateId!,
					name: nextFinishName(project!.name, base.materials),
				};
		const baseRecipe =
			'material' in seed.base ? input.materialRecipes?.get(seed.base.material) : undefined;
		const created = applyFinishEdit(seed, input.edit, baseRecipe);
		materials.push(created);
		addedMaterials.push(created.id);
		const targets =
			input.mode === 'all'
				? users.filter((user) => user.kind === 'entity').map((user) => user.entity)
				: [entity];
		const targetIds = new Set(targets.map((target) => target.id));
		entities = base.entities.map((candidate) => {
			if (!targetIds.has(candidate.id)) return candidate;
			if (candidate.kind === 'model') return { ...candidate, materialInstanceId: created.id };
			return {
				...candidate,
				materialId: catalogueBaseOf(created) ?? MATERIAL_NEUTRAL_BASE_ID,
				materialInstanceId: created.id,
			} as SceneEntity;
		});
		const sharedSurfaceUsers =
			input.mode === 'all' ? users.filter((user) => user.kind === 'surface') : [];
		changedSurfaceKeys = sharedSurfaceUsers.map((user) => user.key);
		surfaceFinishes = base.surfaceFinishes?.map((assignment) =>
			changedSurfaceKeys.includes(surfaceKey(assignment.surface))
				? { ...assignment, finish: { materialInstanceId: created.id } }
				: assignment,
		);
	} else {
		const project =
			'project' in ref ? materialInstanceById(base.materials, ref.project) : undefined;
		if (project === undefined) {
			return { kind: 'rejected', code: 'unknown-finish', message: 'That Finish no longer exists.' };
		}
		const projectRecipe =
			'material' in project.base ? input.materialRecipes?.get(project.base.material) : undefined;
		if (finishEditIsNoop(project, input.edit, projectRecipe)) {
			return {
				kind: 'rejected',
				code: 'no-change',
				message: 'That Finish already has those values.',
			};
		}
		const updated = applyFinishEdit(project, input.edit, projectRecipe);
		const index = materials.findIndex((instance) => instance.id === project.id);
		materials[index] = updated;
		changedMaterials.push(updated.id);
		// The Scene does not store pristine instances as surface Finishes. If this
		// shared edit removes the last override, preserve every assignment's
		// effective base material (including dormant or retired loaded records).
		if (isPristineInstance(updated) && base.surfaceFinishes !== undefined) {
			surfaceFinishes = base.surfaceFinishes.map((assignment) =>
				'materialInstanceId' in assignment.finish &&
				assignment.finish.materialInstanceId === updated.id
					? {
							...assignment,
							finish: {
								materialId: (catalogueBaseOf(updated) ?? MATERIAL_NEUTRAL_BASE_ID) as MaterialId,
							},
						}
					: assignment,
			);
			changedSurfaceKeys = surfaceFinishes
				.filter(
					(assignment, assignmentIndex) => assignment !== base.surfaceFinishes![assignmentIndex],
				)
				.map((assignment) => surfaceKey(assignment.surface));
		}
	}

	const collected = collectPristine(materials, entities);
	const removedMaterials = materials
		.filter((instance) => !collected.some((candidate) => candidate.id === instance.id))
		.map((instance) => instance.id);
	const after: SceneDocument = {
		...base,
		materials: collected,
		entities,
		...(surfaceFinishes === undefined ? {} : { surfaceFinishes }),
	};
	if (sameSceneValues(base, after)) {
		return {
			kind: 'rejected',
			code: 'no-change',
			message: 'That Finish already has those values.',
		};
	}
	const affected =
		input.mode === 'all'
			? users.filter((user) => user.kind === 'entity').map((user) => user.id)
			: [entity.id];
	return {
		kind: 'planned',
		scene: after,
		changedEntityIds: affected,
		changedSurfaceKeys,
		subjectIds: affected,
		addedMaterials,
		changedMaterials,
		removedMaterials,
	};
}
