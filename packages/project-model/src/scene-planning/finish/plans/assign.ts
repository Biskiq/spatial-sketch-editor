/** Finish assignment, Layout surface assignment and colour coats. */

import { surfaceKey } from '@portfolio/layout-core/plan';
import {
	type MaterialId,
	type SceneEntity,
	type SceneMaterialInstance,
	type SceneSurfaceFinish,
} from '../../../scene';
import { assignOne, collectPristine } from '../assignment';
import { planColourCoats, type CoatTarget } from '../colour-coat';
import { type Result, type FinishPlanContext } from '../context';
import {
	catalogueBaseOf,
	isFinishPaintable,
	isPristineInstance,
	materialInstanceById,
	type SceneFinishRef,
} from '../model';
import { readColor, readFinishRef, readMaterialIdList } from '../payload';
import { MATERIAL_ID, materialRecipesOf, refuse, labelOf, allocationOf } from '../shared';
import {
	readAssignDerive,
	readSurfaceRefs,
	surfaceTargetProblem,
	sortedSurfaceFinishes,
} from '../targets';
import { sceneEntityTargetProblem } from '../../intent-payload';
import { sameSceneValues } from '../../record-scope';
import { type CameraFreeSceneDocument as SceneDocument } from '../../../units/types';

export function planSceneFinishAssign(context: FinishPlanContext): Result {
	const {
		request,
		options,
		before,
		header,
		reader,
		complete,
		materialGrant,
		resolveDerivedAssign,
	} = context;
	const payload = reader.object(request.intent.payload, '$.payload', [
		'finish',
		'entityIds',
		'derive',
	]);
	const rawFinish =
		payload === null ? null : readFinishRef(reader, payload.finish, '$.payload.finish');
	const entityIds =
		payload === null ? null : readMaterialIdList(reader, payload.entityIds, '$.payload.entityIds');
	const derive =
		payload === null ? null : readAssignDerive(reader, payload.derive, '$.payload.derive');
	if (rawFinish === null || entityIds === null || reader.issues.length > 0) {
		return refuse(reader.issues[0]?.message ?? 'Paint needs one Finish and at least one object.');
	}
	if (request.intent.targets.length !== entityIds.length) {
		return refuse('Paint must address exactly the objects it names.');
	}
	for (const [index, target] of request.intent.targets.entries()) {
		const problem = sceneEntityTargetProblem(target, entityIds[index]!, header.contentRevision);
		if (problem !== null) return refuse(problem.message);
	}
	const targets: SceneEntity[] = [];
	for (const id of entityIds) {
		const entity = before.entities.find((candidate) => candidate.id === id);
		if (entity === undefined)
			return refuse(`No Scene object "${id}" is in the current revision.`, 'unknown-entity');
		if (!isFinishPaintable(entity)) {
			return refuse(
				entity.kind === 'light' ? 'Lights have no Finish.' : 'That subject cannot be painted.',
				'not-paintable',
			);
		}
		if (rawFinish === 'model-own' && entity.kind !== 'model') {
			return refuse("Model's own can only be painted onto a model.", 'not-paintable');
		}
		targets.push(entity);
	}
	let finish: SceneFinishRef = rawFinish;
	let derivedCreated: SceneMaterialInstance | null = null;
	if (derive !== null) {
		const resolved = resolveDerivedAssign(rawFinish, derive, true);
		if (resolved.kind === 'outcome') return resolved.outcome;
		finish = resolved.finish;
		derivedCreated = resolved.created;
	}
	const curatedFinish = typeof finish === 'object' && 'curated' in finish ? finish : null;
	const projectFinish = typeof finish === 'object' && 'project' in finish ? finish : null;
	if (curatedFinish !== null && !MATERIAL_ID.test(curatedFinish.curated)) {
		return refuse('That curated Finish does not exist.', 'unknown-catalogue');
	}
	if (
		projectFinish !== null &&
		derivedCreated === null &&
		materialInstanceById(before.materials, projectFinish.project) === undefined
	) {
		return refuse('That project Finish no longer exists.', 'unknown-finish');
	}
	// A model can only carry a curated Finish through a pristine instance. Reuse
	// the first one in document order, or install exactly one new instance.
	let pristineId: string | null = null;
	if (
		derivedCreated === null &&
		curatedFinish !== null &&
		targets.some((entity) => entity.kind === 'model')
	) {
		const reusable = before.materials.find(
			(instance) =>
				isPristineInstance(instance) && catalogueBaseOf(instance) === curatedFinish.curated,
		);
		if (reusable !== undefined) pristineId = reusable.id;
		else {
			const allocation = allocationOf(request, ['scene-finish', 'scene-material'], true);
			if ('missing' in allocation) return refuse(allocation.missing, 'missing-allocation');
			pristineId = allocation.id;
		}
	}
	if (derivedCreated === null) {
		const allocation = allocationOf(request, ['scene-finish', 'scene-material'], false);
		if ('missing' in allocation) return refuse(allocation.missing, 'unexpected-allocation');
		if (pristineId === null && allocation.id !== null) {
			return refuse(
				'Painting these objects needs no allocated Finish id.',
				'unexpected-allocation',
			);
		}
	}

	const materials =
		derivedCreated === null ? [...before.materials] : [...before.materials, derivedCreated];
	if (pristineId !== null && !materials.some((instance) => instance.id === pristineId)) {
		if (curatedFinish !== null) {
			materials.push({
				id: pristineId,
				name: labelOf(options, curatedFinish.curated),
				base: { catalogue: curatedFinish.curated },
			});
		}
	}
	const resolvePristine = (base: MaterialId): string => {
		const reusable = materials.find(
			(instance) => isPristineInstance(instance) && catalogueBaseOf(instance) === base,
		);
		if (reusable !== undefined) return reusable.id;
		// Several curated bases in one multi-target paint: each needs its own
		// pristine record. The intent carries one id, so a second base refuses.
		if (pristineId !== null) {
			materials.push({ id: pristineId, name: labelOf(options, base), base: { catalogue: base } });
			return pristineId;
		}
		throw new Error('missing pristine instance');
	};
	let entities: SceneEntity[];
	try {
		entities = before.entities.map((entity) =>
			entityIds.includes(entity.id)
				? assignOne(entity, finish, materials, resolvePristine)
				: entity,
		);
	} catch {
		return refuse(
			'This paint needs one allocated Finish id per curated base.',
			'missing-allocation',
		);
	}
	const collected = collectPristine(materials, entities);
	const after: SceneDocument = { ...before, materials: collected, entities };
	if (sameSceneValues(before, after)) {
		return refuse('Every chosen object already has that Finish.', 'no-change');
	}
	const added = collected
		.filter((instance) => !before.materials.some((candidate) => candidate.id === instance.id))
		.map((instance) => instance.id);
	const removed = before.materials
		.filter((instance) => !collected.some((candidate) => candidate.id === instance.id))
		.map((instance) => instance.id);
	return complete(
		after,
		{
			changedEntityIds: entityIds,
			changedEntityFields: ['materialId', 'materialInstanceId'],
			materials: materialGrant({ added, removed }),
		},
		entityIds,
		['finish', 'materialId', 'materialInstanceId', 'materials'],
	);
}

export function planSceneSurfaceFinishAssign(context: FinishPlanContext): Result {
	const { request, envelope, before, reader, complete, materialGrant, resolveDerivedAssign } =
		context;
	const payload = reader.object(request.intent.payload, '$.payload', [
		'finish',
		'surfaces',
		'derive',
	]);
	const rawFinish =
		payload === null ? null : readFinishRef(reader, payload.finish, '$.payload.finish');
	const surfaces =
		payload === null ? null : readSurfaceRefs(reader, payload.surfaces, '$.payload.surfaces');
	const derive =
		payload === null ? null : readAssignDerive(reader, payload.derive, '$.payload.derive');
	if (rawFinish === null || surfaces === null || reader.issues.length > 0) {
		return refuse(reader.issues[0]?.message ?? 'Paint needs one Finish and at least one surface.');
	}
	if (rawFinish === 'model-own')
		return refuse("Model's own cannot be painted onto a Layout surface.", 'not-paintable');
	let finish: SceneFinishRef = rawFinish;
	let derivedCreated: SceneMaterialInstance | null = null;
	if (derive !== null) {
		const resolved = resolveDerivedAssign(rawFinish, derive, false);
		if (resolved.kind === 'outcome') return resolved.outcome;
		finish = resolved.finish;
		derivedCreated = resolved.created;
	}
	if (derivedCreated === null && request.allocatedIds.length > 0) {
		return refuse('Painting Layout surfaces needs no allocated id.', 'unexpected-allocation');
	}
	const curated = typeof finish === 'object' && 'curated' in finish ? finish.curated : null;
	const project =
		typeof finish === 'object' && 'project' in finish
			? (derivedCreated ?? before.materials.find((entry) => entry.id === finish.project))
			: undefined;
	if (curated !== null && !MATERIAL_ID.test(curated))
		return refuse('That curated Finish does not exist.', 'unknown-catalogue');
	if (
		typeof finish === 'object' &&
		'project' in finish &&
		(project === undefined || (derivedCreated === null && isPristineInstance(project)))
	) {
		return refuse('That project Finish no longer exists.', 'unknown-finish');
	}
	if (request.intent.targets.length !== surfaces.length)
		return refuse('Paint must address exactly the surfaces it names.');
	const layoutUnit = envelope.units.layout;
	const existing = new Map(
		(before.surfaceFinishes ?? []).map((entry) => [surfaceKey(entry.surface), entry]),
	);
	const next = new Map(existing);
	const changedKeys: string[] = [];
	const addedKeys: string[] = [];
	const assignedFinish: SceneSurfaceFinish['finish'] =
		typeof finish === 'object' && 'curated' in finish
			? { materialId: finish.curated }
			: { materialInstanceId: (finish as { readonly project: string }).project };
	for (const [index, surface] of surfaces.entries()) {
		const problem = surfaceTargetProblem(request.intent.targets[index]!, surface, layoutUnit);
		if (problem !== null) return problem;
		const key = surfaceKey(surface);
		const assignment: SceneSurfaceFinish = { surface, finish: assignedFinish };
		const previous = existing.get(key);
		if (previous === undefined) addedKeys.push(key);
		else if (JSON.stringify(previous) !== JSON.stringify(assignment)) changedKeys.push(key);
		next.set(key, assignment);
	}
	const materials =
		derivedCreated === null ? before.materials : [...before.materials, derivedCreated];
	const after: SceneDocument = {
		...before,
		materials,
		surfaceFinishes: sortedSurfaceFinishes(next),
	};
	if (sameSceneValues(before, after))
		return refuse('Every chosen surface already has that Finish.', 'no-change');
	return complete(
		after,
		{
			surfaceFinishes: { changedKeys, addedKeys },
			...(derivedCreated === null
				? {}
				: { materials: materialGrant({ added: [derivedCreated.id] }) }),
			createdEntityIds: [],
			changedEntityIds: [],
			changedEntityFields: [],
		},
		[...new Set([...addedKeys, ...changedKeys])].sort(),
		derivedCreated === null
			? ['surfaceFinishes', 'finish']
			: ['surfaceFinishes', 'finish', 'materials'],
	);
}

export function planSceneColourCoat(context: FinishPlanContext): Result {
	const { request, options, envelope, before, header, reader, complete, materialGrant } = context;
	const payload = reader.object(request.intent.payload, '$.payload', [
		'colour',
		'entityIds',
		'surfaces',
	]);
	if (payload === null)
		return refuse(reader.issues[0]?.message ?? 'A colour coat needs a colour and its targets.');
	const colour = readColor(reader, payload.colour, '$.payload.colour');
	const namesEntities = 'entityIds' in payload;
	const namesSurfaces = 'surfaces' in payload;
	if (namesEntities === namesSurfaces) {
		return refuse('A colour coat paints objects or Layout surfaces, one kind per stroke.');
	}
	const entityIds = namesEntities
		? readMaterialIdList(reader, payload.entityIds, '$.payload.entityIds')
		: [];
	const surfaces = namesSurfaces
		? readSurfaceRefs(reader, payload.surfaces, '$.payload.surfaces')
		: [];
	if (!colour.ok || entityIds === null || surfaces === null || reader.issues.length > 0) {
		return refuse(reader.issues[0]?.message ?? 'A colour coat needs a colour and its targets.');
	}
	const targetCount = entityIds.length + surfaces.length;
	if (request.intent.targets.length !== targetCount)
		return refuse('Paint must address exactly the targets it names.');
	const layoutUnit = envelope.units.layout;
	for (const [index, id] of entityIds.entries()) {
		const problem = sceneEntityTargetProblem(
			request.intent.targets[index]!,
			id,
			header.contentRevision,
		);
		if (problem !== null) return refuse(problem.message);
	}
	for (const [index, surface] of surfaces.entries()) {
		const problem = surfaceTargetProblem(request.intent.targets[index]!, surface, layoutUnit);
		if (problem !== null) return problem;
	}
	const coatTargets: CoatTarget[] = namesEntities
		? entityIds.map((id) => ({ kind: 'entity' as const, id }))
		: surfaces.map((surface) => ({ kind: 'surface' as const, surface }));
	const plan = planColourCoats(before, {
		colour: colour.value,
		targets: coatTargets,
		materialRecipes: materialRecipesOf(envelope),
		labelForMaterial: (id) => labelOf(options, id),
		...(options.treatmentFacts === undefined ? {} : { facts: options.treatmentFacts }),
	});
	if (plan.kind === 'refused') return refuse(plan.message, plan.code);
	if (plan.already) return refuse('Every chosen target already wears that colour.', 'no-change');
	const allocations = request.allocatedIds;
	if (allocations.length !== plan.creates.length) {
		return refuse(
			`This colour coat needs ${plan.creates.length} allocated Finish id${plan.creates.length === 1 ? '' : 's'}.`,
			allocations.length < plan.creates.length ? 'missing-allocation' : 'unexpected-allocation',
		);
	}
	const allocatedIds: string[] = [];
	for (const allocation of allocations) {
		if (!['scene-finish', 'scene-material'].includes(allocation.kind)) {
			return refuse('A colour coat allocates Finish ids only.', 'unexpected-allocation');
		}
		if (
			before.materials.some((instance) => instance.id === allocation.id) ||
			allocatedIds.includes(allocation.id)
		) {
			return refuse('That Finish id is already in use.', 'unexpected-allocation');
		}
		allocatedIds.push(allocation.id);
	}
	const created: SceneMaterialInstance[] = plan.creates.map(
		(entry, index) =>
			({
				id: allocatedIds[index]!,
				name: entry.name,
				base: entry.base,
				...(entry.overrides === undefined ? {} : { overrides: entry.overrides }),
			}) as SceneMaterialInstance,
	);
	const materials = [...before.materials, ...created];
	const finishIdOf = (index: number): string => {
		const assignment = plan.assignments[index]!;
		return assignment.kind === 'existing' ? assignment.finishId : allocatedIds[assignment.index]!;
	};
	const coatByEntity = new Map(entityIds.map((id, index) => [id, finishIdOf(index)]));
	const entities = before.entities.map((entity) => {
		const finishId = coatByEntity.get(entity.id);
		return finishId === undefined
			? entity
			: assignOne(entity, { project: finishId }, materials, () => {
					throw new Error('a coat never assigns a curated Finish');
				});
	});
	let surfaceFinishes = before.surfaceFinishes;
	const changedKeys: string[] = [];
	const addedKeys: string[] = [];
	if (namesSurfaces) {
		const existing = new Map(
			(before.surfaceFinishes ?? []).map((entry) => [surfaceKey(entry.surface), entry]),
		);
		const next = new Map(existing);
		for (const [index, surface] of surfaces.entries()) {
			const key = surfaceKey(surface);
			const assignment: SceneSurfaceFinish = {
				surface,
				finish: { materialInstanceId: finishIdOf(index) },
			};
			const previous = existing.get(key);
			if (previous === undefined) addedKeys.push(key);
			else if (!sameSceneValues(previous, assignment)) changedKeys.push(key);
			next.set(key, assignment);
		}
		surfaceFinishes = sortedSurfaceFinishes(next);
	}
	// A model leaving a pristine curated instance releases it in the same write.
	const used = new Set([
		...entities.flatMap((entity) => {
			const id = (entity as SceneEntity & { materialInstanceId?: string }).materialInstanceId;
			return id === undefined ? [] : [id];
		}),
		...(surfaceFinishes ?? []).flatMap((entry) =>
			'materialInstanceId' in entry.finish ? [entry.finish.materialInstanceId] : [],
		),
	]);
	const ordered = materials.filter(
		(instance) => !isPristineInstance(instance) || used.has(instance.id),
	);
	const after: SceneDocument = {
		...before,
		materials: ordered,
		entities,
		...(surfaceFinishes === undefined ? {} : { surfaceFinishes }),
	};
	if (sameSceneValues(before, after))
		return refuse('Every chosen target already wears that colour.', 'no-change');
	const added = created.map((instance) => instance.id);
	const removed = before.materials
		.filter((instance) => !ordered.includes(instance))
		.map((instance) => instance.id);
	const changedEntityIds = entityIds.filter((id) => {
		const previous = before.entities.find((entity) => entity.id === id);
		const next = entities.find((entity) => entity.id === id);
		return !sameSceneValues(previous, next);
	});
	return complete(
		after,
		{
			changedEntityIds,
			changedEntityFields:
				changedEntityIds.length === 0 ? [] : ['materialId', 'materialInstanceId'],
			materials: materialGrant({ added, removed }),
			...(namesSurfaces ? { surfaceFinishes: { changedKeys, addedKeys } } : {}),
		},
		namesSurfaces ? [...new Set([...addedKeys, ...changedKeys])].sort() : entityIds,
		namesSurfaces
			? ['surfaceFinishes', 'finish', 'materials']
			: ['finish', 'materialId', 'materialInstanceId', 'materials'],
	);
}
