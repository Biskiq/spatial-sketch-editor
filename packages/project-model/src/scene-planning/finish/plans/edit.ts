/** Finish edits and typed patches. */

import { surfaceKey } from '@portfolio/layout-core/plan';
import { qualifyAcrossTargets } from '../../../materials/bind';
import { catalogueRecipe } from '../../../materials/catalogue';
import { createImageIndex, resolveFinish, mergeImageIndexes, shippedImageIndex, materialImageIndex } from '../../../materials/resolve';
import { MATERIAL_NEUTRAL_BASE_ID, type TargetFacts } from '../../../materials/types';
import { type MaterialId, type SceneEntity, type SceneMaterialInstance, type SceneSurfaceRef } from '../../../scene';
import { collectPristine, materialCandidateScopeProblem } from '../assignment';
import { type Result, type FinishPlanContext } from '../context';
import { planEdit } from '../edit-plan';
import { analysisRequestOf, analysisSubjectOf, finishUsersWithLifecycle } from '../inspect';
import { catalogueBaseOf, finishKeyOfRef, isPristineInstance, materialBaseOf, materialInstanceById, nextFinishName } from '../model';
import { applyFinishPatch, baseRecipeOf } from '../patch';
import { readFinishRef, readFinishEdit } from '../payload';
import { materialRecipesOf, refuse, labelOf, nameContextOf, allocationOf } from '../shared';
import { readRegisterImages, stageMaterialImage, readPatchEdits, readUserKeys } from '../targets';
import { generatedFinishName, isGeneratedFinishName, uniqueFinishName } from '../treatment';
import { sceneEntityTargetProblem } from '../../intent-payload';
import { sameSceneValues } from '../../record-scope';
import { materialRuntimeIndexOf } from '../../../units/material-index';
import { type CameraFreeSceneDocument as SceneDocument, type TypedResource } from '../../../units/types';

export function planSceneFinishEdit(context: FinishPlanContext): Result {
	const { request, options, envelope, before, header, reader, complete, materialGrant } = context;
		const payload = reader.object(request.intent.payload, '$.payload', ['entityId', 'from', 'reach', 'mode', 'edit']);
		const entityId = payload === null ? null : reader.opaqueId(payload.entityId, '$.payload.entityId');
		const from = payload === null ? null : reader.string(payload.from, '$.payload.from');
		const reach = payload === null ? null : reader.integerAtLeast(payload.reach, '$.payload.reach', 1);
		const mode = payload === null ? null : reader.tag(payload.mode, '$.payload.mode', ['just-this', 'all', 'in-place']);
		const edit = payload === null ? null : readFinishEdit(reader, payload.edit, '$.payload.edit');
		if (entityId === null || from === null || reach === null || mode === null || edit === null || reader.issues.length > 0) {
			return refuse(reader.issues[0]?.message ?? 'The Finish edit is incomplete.');
		}
		if (request.intent.targets.length !== 1) return refuse('A Finish edit addresses exactly one object.');
		const targetProblem = sceneEntityTargetProblem(request.intent.targets[0]!, entityId, header.contentRevision);
		if (targetProblem !== null) return refuse(targetProblem.message);
		// The id is offered, not required here: `planEdit` refuses a missing or an
		// unexpected allocation *after* it has judged the reach and the mode, so a
		// mismatched mode reports itself rather than hiding behind an id.
		const allocations = request.allocatedIds;
		if (
			allocations.length > 1 ||
			(allocations.length === 1 && !['scene-finish', 'scene-material'].includes(allocations[0]!.kind))
		) {
			return refuse('A Finish edit takes one allocated Finish id at most.', 'unexpected-allocation');
		}
		const allocationId = allocations[0]?.id ?? null;
		const planned = planEdit(before, {
			layout: envelope.units.layout.data,
			entityId,
			from,
			reach,
			mode: mode as 'just-this' | 'all' | 'in-place',
			edit,
			allocateId: allocationId,
			options,
			materialRecipes: materialRecipesOf(envelope)
		});
		if (planned.kind === 'rejected') return refuse(planned.message, planned.code);
		return complete(
			planned.scene,
			{
				changedEntityIds: planned.changedEntityIds,
				changedEntityFields: ['materialId', 'materialInstanceId'],
				surfaceFinishes: { changedKeys: planned.changedSurfaceKeys },
				materials: materialGrant({
					added: planned.addedMaterials,
					changed: planned.changedMaterials,
					removed: planned.removedMaterials
				})
			},
			planned.subjectIds,
			['finish', 'color', 'roughness', 'metalness', 'maps', 'mapping', 'materials']
		);
}

export function planSceneFinishPatch(context: FinishPlanContext): Result {
	const { request, options, envelope, before, reader, materialGrant, withResources } = context;
		const payload = reader.object(request.intent.payload, '$.payload', [
			'finish',
			'edits',
			'mode',
			'selectedUsers',
			'expectedUsers',
			'images',
			'base'
		]);
		if (payload === null) return refuse(reader.issues[0]?.message ?? 'A Finish patch must be an object.');
		// Swap: an optional catalogue base the patched Finish takes; the
		// treatment edits travel alongside it in the same patch.
		let swapBase: { catalogue: MaterialId } | null = null;
		if (payload.base !== undefined) {
			const baseRecord = reader.object(payload.base, '$.payload.base', ['catalogue']);
			const catalogue = baseRecord === null ? null : reader.opaqueId(baseRecord.catalogue, '$.payload.base.catalogue');
			if (catalogue === null || reader.issues.length > 0) {
				return refuse(reader.issues[0]?.message ?? 'A swap names one catalogue base.');
			}
			if (catalogueRecipe(catalogue) === undefined) return refuse('That curated material does not exist.', 'unknown-catalogue');
			swapBase = { catalogue: catalogue as MaterialId };
		}
		const finish = readFinishRef(reader, payload.finish, '$.payload.finish');
		const mode = reader.tag(payload.mode, '$.payload.mode', ['in-place', 'all', 'just-this']) as
			| 'in-place' | 'all' | 'just-this' | null;
		const edits =
			swapBase !== null && Array.isArray(payload.edits) && payload.edits.length === 0
				? []
				: readPatchEdits(reader, payload.edits, '$.payload.edits');
		const selected = readUserKeys(reader, payload.selectedUsers, '$.payload.selectedUsers');
		const expected = readUserKeys(reader, payload.expectedUsers, '$.payload.expectedUsers');
		const rawImages = payload.images === undefined ? [] : readRegisterImages(reader, payload.images, '$.payload.images');
		if (
			finish === null || mode === null || edits === null || selected === null || expected === null ||
			rawImages === null || reader.issues.length > 0
		) {
			return refuse(reader.issues[0]?.message ?? 'The Finish patch is incomplete.');
		}
		if (request.intent.targets.length !== 0) {
			return refuse('A Finish patch names its users in the payload, not as targets.', 'invalid-target');
		}
		if (finish === 'model-own') {
			return refuse("A model's own materials are not a Finish. Choose a Finish first.", 'not-editable');
		}
		const curated = 'curated' in finish;
		let project: SceneMaterialInstance | undefined;
		if ('project' in finish) {
			project = materialInstanceById(before.materials, finish.project);
			if (project === undefined || isPristineInstance(project)) {
				return refuse('That project Finish no longer exists.', 'unknown-finish');
			}
		} else if (catalogueRecipe(finish.curated) === undefined) {
			return refuse('That curated Finish does not exist.', 'unknown-catalogue');
		}
		const layoutData = envelope.units.layout.data;
		const key = finishKeyOfRef(finish);
		const { users } = finishUsersWithLifecycle(before, key, layoutData);
		const userKeys = users.map((user) => user.key);
		// The caller's affected set is a precondition: a user that appeared or
		// left since the caller looked refuses rather than widening the write.
		if (expected.length !== userKeys.length || !expected.every((entry) => userKeys.includes(entry))) {
			return {
				kind: 'rejected',
				code: 'stale-reach',
				message: `That Finish is now used by ${userKeys.length} target${userKeys.length === 1 ? '' : 's'}. Reopen it and try again.`,
				diagnostics: userKeys.map((entry) => ({ path: '$.payload.expectedUsers', code: 'current-user', message: entry }))
			};
		}
		const unknownSelected = selected.find((entry) => !userKeys.includes(entry));
		if (unknownSelected !== undefined) {
			return refuse(`"${unknownSelected}" does not use this Finish.`, 'invalid-target');
		}
		const selectsAll = selected.length === userKeys.length;
		if (mode === 'in-place') {
			if (curated) return refuse('A curated Finish is never edited in place.', 'mode-mismatch');
			if (userKeys.length > 1) return refuse('A shared Finish is edited for all its users or just some.', 'mode-mismatch');
			if (!selectsAll) return refuse('An in-place edit selects the Finish’s only user.', 'mode-mismatch');
		} else if (mode === 'all') {
			if (!curated && userKeys.length <= 1) return refuse('A Finish with one user is edited in place.', 'mode-mismatch');
			if (!selectsAll) return refuse('Editing all users selects every user.', 'mode-mismatch');
		} else if (selected.length === 0 || selectsAll) {
			return refuse('“Just this” edits a proper subset of the Finish’s users.', 'mode-mismatch');
		}
		const needsNew = curated || mode === 'just-this';
		const allocation = allocationOf(request, ['scene-finish', 'scene-material'], needsNew);
		if ('missing' in allocation) return refuse(allocation.missing, needsNew ? 'missing-allocation' : 'unexpected-allocation');
		if (!needsNew && allocation.id !== null) return refuse('Editing a Finish in place creates no id.', 'unexpected-allocation');
		if (needsNew && before.materials.some((instance) => instance.id === allocation.id)) {
			return refuse('That Finish id is already in use.', 'unexpected-allocation');
		}

		const resources = [...envelope.units.resources.data.resources];
		const textures = [...before.textures];
		const addedTextureResources: TypedResource[] = [];
		for (const image of rawImages) {
			const staged = stageMaterialImage(image, textures, resources, addedTextureResources, true);
			if (staged !== null) return refuse(staged.message, staged.code);
		}
		const recipes = materialRecipesOf(envelope);
		const copy: SceneMaterialInstance = !needsNew
			? project!
			: curated
				? {
						id: allocation.id!,
						name: nextFinishName(labelOf(options, (finish as { curated: MaterialId }).curated), before.materials),
						base: { catalogue: (finish as { curated: MaterialId }).curated }
					}
				: { ...project!, id: allocation.id!, name: nextFinishName(project!.name, before.materials) };
		const baseChanges = swapBase !== null && !sameSceneValues(swapBase, copy.base);
		const seed: SceneMaterialInstance = baseChanges ? { ...copy, base: swapBase! } : copy;
		let patched = applyFinishPatch(seed, edits, baseRecipeOf(seed, recipes));
		if (!patched.ok && patched.problem.code === 'no-change' && baseChanges) {
			patched = { ok: true, instance: seed, touchesSampling: true };
		}
		if (patched.ok && baseChanges) patched = { ...patched, touchesSampling: true };
		if (!patched.ok) {
			return {
				kind: 'rejected',
				code: patched.problem.code,
				message: patched.problem.message,
				diagnostics: [{ path: patched.problem.path, code: patched.problem.code, message: patched.problem.message }]
			};
		}
		let next = patched.instance;
		if (options.treatmentFacts !== undefined) {
			// Naming: a Finish whose name is still generated is renamed with its
			// treatment; a renamed one keeps its name (a copy takes the next free one).
			const context = nameContextOf(options, recipes, before.palette);
			const wasGenerated = curated || isGeneratedFinishName(project!.name, project!, context);
			if (wasGenerated) {
				// The material half of a resource-backed name comes from the source's
				// name, never from a copy's free-name suffix ("Rough Oak 2").
				const label = generatedFinishName(curated ? next : { ...next, name: project!.name }, context);
				next = { ...next, name: uniqueFinishName(label, before.materials, needsNew ? null : next.id) };
			}
		}
		const affected = needsNew
			? users.filter((user) => mode !== 'just-this' || selected.includes(user.key))
			: users;

		// Resolve the result against the candidate's own resources, then qualify
		// every affected user that draws today when sampling changed.
		const runtime = materialRuntimeIndexOf({ formatVersion: envelope.units.resources.data.formatVersion, resources });
		const baseHash = materialBaseOf(next);
		const imageIndex = mergeImageIndexes(
			shippedImageIndex(),
			materialImageIndex(baseHash === null ? [] : (runtime?.definitionImages.get(baseHash) ?? [])),
			createImageIndex(runtime?.images ?? [])
		);
		const baseRecipe = baseHash === null ? undefined : runtime?.definitions.get(baseHash);
		if (baseHash !== null && baseRecipe === undefined) {
			return refuse('That Finish’s material definition is missing.', 'missing-definition');
		}
		const resolution = resolveFinish(
			baseHash === null ? { catalogue: catalogueBaseOf(next)! } : { material: baseRecipe! },
			next.overrides,
			before.palette,
			imageIndex
		);
		if (resolution.inputs === null || resolution.issues.length > 0) {
			const first = resolution.issues[0];
			return {
				kind: 'rejected',
				code: first?.code ?? 'invalid-value',
				message: first?.action ?? 'That Finish cannot resolve with these values.',
				diagnostics: resolution.issues.map((issue) => ({
					path: issue.path,
					code: issue.code,
					message: issue.action ?? issue.code
				}))
			};
		}
		if (patched.touchesSampling) {
			const drawing = affected.filter((user) => user.kind === 'entity' || user.lifecycle === 'present');
			if (drawing.length > 0) {
				const requests = drawing.map((user) => analysisRequestOf(envelope, user));
				const analysis = options.targetAnalysis?.(requests) ?? null;
				if (analysis === null || analysis.length === 0) {
					return refuse('No host geometry analysis covers these users. Requalify the exact revision.', 'target-pending');
				}
				const trusted = new Map<string, TargetFacts>();
				const expectedRevision = new Map(requests.map((entry) => [entry.subject, entry.expectedGeometryRevision]));
				for (const facts of analysis) {
					const revision = expectedRevision.get(facts.subject);
					if (revision === undefined || trusted.has(facts.subject)) {
						return refuse('Target analysis does not match the Finish’s users.', 'invalid-target');
					}
					if (facts.geometryRevision !== revision || facts.draws.length === 0) {
						return refuse('Host target analysis is stale or empty. Requalify the exact geometry revision.', 'target-pending');
					}
					trusted.set(facts.subject, facts);
				}
				if (requests.some((entry) => !trusted.has(entry.subject))) {
					return refuse('Host analysis does not cover every affected user. Requalify the exact geometry revision.', 'target-pending');
				}
				const qualification = qualifyAcrossTargets(
					resolution,
					drawing.map((user) => ({
						subject: analysisSubjectOf(user),
						facts: trusted.get(analysisSubjectOf(user))!,
						expectedGeometryRevision: expectedRevision.get(analysisSubjectOf(user))!
					}))
				);
				if (qualification.issues.length > 0) {
					const failing = new Set(
						qualification.perTarget.filter((entry) => entry.issues.length > 0).map((entry) => entry.subject)
					);
					const viable = drawing.filter((user) => !failing.has(analysisSubjectOf(user))).map((user) => user.key);
					const first = qualification.issues[0]!;
					return {
						kind: 'rejected',
						code: 'target-incompatible',
						message: first.action ?? 'This Finish cannot be drawn on every affected user.',
						diagnostics: [
							...drawing
								.filter((user) => failing.has(analysisSubjectOf(user)))
								.flatMap((user) =>
									qualification.perTarget
										.find((entry) => entry.subject === analysisSubjectOf(user))!
										.issues.map((issue) => ({
											path: '$.payload.selectedUsers',
											code: 'incompatible-user',
											message: `${user.key}: ${issue.code}${issue.role === undefined ? '' : ` (${issue.role})`}`
										}))
								),
							...viable.map((entry) => ({ path: '$.payload.selectedUsers', code: 'viable-user', message: entry }))
						]
					};
				}
			}
		}

		const materials = [...before.materials];
		const addedMaterials: string[] = [];
		const changedMaterials: string[] = [];
		let entities = before.entities;
		let surfaceFinishes = before.surfaceFinishes;
		let changedSurfaceKeys: string[] = [];
		let changedEntityIds: string[] = [];
		if (needsNew) {
			// A clone that ends pristine (catalogue base, no overrides) is never
			// stored for primitives and surfaces: the selected users take the
			// curated normal form and the allocated id is ignored (a reservation,
			// not a grant). A model user has no normal form for a catalogue base,
			// so a clone that reaches a model keeps its instance.
			const reachesModel = affected.some(
				(user) => user.kind === 'entity' && before.entities.find((entity) => entity.id === (user as { entityId: string }).entityId)?.kind === 'model'
			);
			const pristineClone = isPristineInstance(next) && !reachesModel;
			const cloneBase = catalogueBaseOf(next) ?? MATERIAL_NEUTRAL_BASE_ID;
			if (!pristineClone) {
				materials.push(next);
				addedMaterials.push(next.id);
			}
			const entityIds = new Set(
				affected.filter((user) => user.kind === 'entity').map((user) => (user as { entityId: string }).entityId)
			);
			changedEntityIds = [...entityIds];
			entities = before.entities.map((entity) => {
				if (!entityIds.has(entity.id)) return entity;
				if (entity.kind === 'model') return { ...entity, materialInstanceId: next.id } as SceneEntity;
				if (pristineClone) {
					const { materialInstanceId: _dropped, ...rest } = entity as SceneEntity & { materialInstanceId?: string };
					return { ...rest, materialId: cloneBase } as SceneEntity;
				}
				return { ...entity, materialId: cloneBase, materialInstanceId: next.id } as SceneEntity;
			});
			const surfaceKeys = new Set(
				affected
					.filter((user) => user.kind === 'surface')
					.map((user) => surfaceKey((user as { surface: SceneSurfaceRef }).surface))
			);
			changedSurfaceKeys = [...surfaceKeys];
			surfaceFinishes = before.surfaceFinishes?.map((assignment) =>
				surfaceKeys.has(surfaceKey(assignment.surface))
					? { ...assignment, finish: pristineClone ? { materialId: cloneBase as MaterialId } : { materialInstanceId: next.id } }
					: assignment
			);
		} else {
			const index = materials.findIndex((instance) => instance.id === next.id);
			materials[index] = next;
			changedMaterials.push(next.id);
			if (baseChanges) {
				// A swapped Finish's primitive users keep the host's catalogue base in step.
				const nextBase = (catalogueBaseOf(next) ?? MATERIAL_NEUTRAL_BASE_ID) as MaterialId;
				entities = before.entities.map((entity) => {
					const instanceId = (entity as SceneEntity & { materialInstanceId?: string }).materialInstanceId;
					if (instanceId !== next.id || entity.kind === 'model') return entity;
					changedEntityIds.push(entity.id);
					return { ...entity, materialId: nextBase } as SceneEntity;
				});
			}
			// A reset back to its catalogue base leaves a pristine instance, which
			// primitives, Forms and surfaces never store: they take the curated
			// normal form (a model keeps the instance), and an instance nobody
			// still needs is collected below.
			if (isPristineInstance(next)) {
				const nextBase = (catalogueBaseOf(next) ?? MATERIAL_NEUTRAL_BASE_ID) as MaterialId;
				entities = entities.map((entity) => {
					const instanceId = (entity as SceneEntity & { materialInstanceId?: string }).materialInstanceId;
					if (instanceId !== next.id || entity.kind === 'model') return entity;
					if (!changedEntityIds.includes(entity.id)) changedEntityIds.push(entity.id);
					const { materialInstanceId: _dropped, ...rest } = entity as SceneEntity & { materialInstanceId?: string };
					return { ...rest, materialId: nextBase } as SceneEntity;
				});
			}
			if (isPristineInstance(next) && before.surfaceFinishes !== undefined) {
				surfaceFinishes = before.surfaceFinishes.map((assignment) =>
					'materialInstanceId' in assignment.finish && assignment.finish.materialInstanceId === next.id
						? { ...assignment, finish: { materialId: (catalogueBaseOf(next) ?? MATERIAL_NEUTRAL_BASE_ID) as MaterialId } }
						: assignment
				);
				changedSurfaceKeys = surfaceFinishes
					.filter((assignment, assignmentIndex) => assignment !== before.surfaceFinishes![assignmentIndex])
					.map((assignment) => surfaceKey(assignment.surface));
			}
		}
		const collected = collectPristine(materials, entities);
		const removedMaterials = materials
			.filter((instance) => !collected.some((candidate) => candidate.id === instance.id))
			.map((instance) => instance.id);
		const after: SceneDocument = {
			...before,
			textures,
			materials: collected,
			entities,
			...(surfaceFinishes === undefined ? {} : { surfaceFinishes })
		};
		const scopeProblem = materialCandidateScopeProblem(
			envelope.units.resources.data.resources,
			resources,
			envelope.dependencyLock.entries,
			envelope.dependencyLock.entries,
			new Set(addedTextureResources.map((resource) => resource.id)),
			[]
		);
		if (scopeProblem !== null) return refuse(scopeProblem, 'resource-scope');
		return withResources(
			after,
			{
				changedEntityIds,
				changedEntityFields: ['materialId', 'materialInstanceId'],
				surfaceFinishes: { changedKeys: changedSurfaceKeys },
				textures: { added: addedTextureResources.map((resource) => resource.id) },
				materials: materialGrant({ added: addedMaterials, changed: changedMaterials.filter((id) => !removedMaterials.includes(id)), removed: removedMaterials })
			},
			addedTextureResources.length === 0 ? null : resources,
			null,
			[next.id, ...affected.map((user) => user.key)],
			['materials', 'textures', 'surfaceFinishes', 'finish', 'resources']
		);
}

