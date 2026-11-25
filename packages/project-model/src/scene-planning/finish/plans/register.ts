/** Finish registration and image-derived Finishes. */

import { resolveLayoutSurface, surfaceKey } from '@portfolio/layout-core/plan';
import { qualifyAcrossTargets } from '../../../materials/bind';
import { readMaterialDefinition } from '../../../materials/definition';
import { EMPTY_MATERIAL_PROOF, verifyMaterialDigest } from '../../../materials/proof';
import { readRecipe } from '../../../materials/read';
import { resolveFinish, mergeImageIndexes, shippedImageIndex, materialImageIndex } from '../../../materials/resolve';
import { MATERIAL_CAPABILITY, type TargetFacts } from '../../../materials/types';
import { type SceneMaterialInstance, type SceneSurfaceFinish, type SceneSurfaceRef, type SceneTextureAsset } from '../../../scene';
import { assignOne, collectPristine, materialCandidateScopeProblem } from '../assignment';
import { type Result, type FinishPlanContext } from '../context';
import { planEdit } from '../edit-plan';
import { finishOf, finishRefOfKey, isFinishPaintable } from '../model';
import { FINISH_NAME_MAX_LENGTH, readTexturePin, readEntityIdList } from '../payload';
import { materialRecipesOf, refuse } from '../shared';
import { readTargetFacts, readRegisterImages, stageMaterialImage, readSurfaceRefs, surfaceTargetComponent, sameTargetFacts } from '../targets';
import { sceneEntityTargetProblem } from '../../intent-payload';
import { finalizeSceneCandidate, type SceneRecordScope } from '../../record-scope';
import { finishTextureResource, finishTextureUri, sameFinishTexturePin } from '../../texture-resource';
import { replaceUnitData } from '../../../units/envelope';
import { type CameraFreeSceneDocument as SceneDocument, type TypedResource } from '../../../units/types';

export function planSceneFinishRegister(context: FinishPlanContext): Result {
	const { request, kind, options, envelope, before, header, reader, reference, scope, materialGrant } = context;
		const payload = reader.object(request.intent.payload, '$.payload', [
			'name',
			'recipeHash',
			'recipe',
			'images',
			'entityIds',
			'surfaces',
			'targetFacts'
		]);
		if (payload === null) return refuse('The material registration payload must be an object.', 'invalid-value');
		const rawRegisterName = reader.string(payload.name, '$.payload.name');
		const name = rawRegisterName === null ? null : rawRegisterName.trim();
		const recipeHash = payload === null ? null : reader.string(payload.recipeHash, '$.payload.recipeHash');
		const rawImages = payload === null ? null : readRegisterImages(reader, payload.images, '$.payload.images');
		const rawFacts = payload === null ? null : readTargetFacts(reader, payload.targetFacts, '$.payload.targetFacts');
		if (name === null || recipeHash === null || rawImages === null || rawFacts === null || reader.issues.length > 0) {
			return refuse(reader.issues[0]?.message ?? 'The material registration is incomplete.');
		}
		if (name.length === 0 || name.length > FINISH_NAME_MAX_LENGTH) {
			return refuse(`A Finish name must be 1-${FINISH_NAME_MAX_LENGTH} characters.`, 'invalid-value');
		}
		const allocations = request.allocatedIds;
		if (allocations.length !== 1 || !['scene-finish', 'scene-material'].includes(allocations[0]!.kind)) {
			return refuse('Registering a Finish needs exactly one allocated Finish id.', 'missing-allocation');
		}
		const finishId = allocations[0]!.id;
		if (before.materials.some((instance) => instance.id === finishId)) {
			return refuse('That Finish id is already in use.', 'unexpected-allocation');
		}
		const recipeRead = readRecipe(payload.recipe);
		if (!recipeRead.success) {
			return refuse(recipeRead.issues[0]?.action ?? 'The material recipe is not admissible.', 'invalid-value');
		}
		const recipe = recipeRead.recipe;
		const proof = options.materialProof?.(request) ?? EMPTY_MATERIAL_PROOF;
		const verification = verifyMaterialDigest(proof, recipeHash, recipe);
		if (!verification.ok) {
			return refuse(verification.issue.action ?? 'That recipe digest was not verified for these exact canonical bytes. Re-import the material.', 'material-digest-mismatch');
		}
		const definitionRead = readMaterialDefinition({
			recipe,
			images: rawImages.map((image) => ({ hash: image.hash, source: image.source }))
		});
		if (!definitionRead.success) {
			return refuse(definitionRead.issues[0]?.action ?? 'The material definition is not admissible.', 'invalid-value');
		}
		const definition = definitionRead.definition;

		const resources = [...envelope.units.resources.data.resources];
		const textures = [...before.textures];
		const addedTextureResources: TypedResource[] = [];
		const existingMaterial = resources.find((resource) => resource.kind === 'material' && resource.id === recipeHash);
		// A digest already vendored under different local IDs reuses its verified
		// mapping: the recipe bytes are the same, and the existing definition
		// already covers exactly those digests with closure-checked pins. The new
		// request's local IDs are destination hints, not a second definition.
		let effectiveDefinition = definition;
		const reusesDefinition = existingMaterial !== undefined;
		if (reusesDefinition) {
			if (existingMaterial.material === undefined) {
				return refuse('That material identity is already used by another resource kind.', 'material-definition-conflict');
			}
			if (JSON.stringify(existingMaterial.material.recipe) !== JSON.stringify(recipe)) {
				return refuse('That material identity already has a different definition.', 'material-definition-conflict');
			}
			const existingHashes = new Set(existingMaterial.material.images.map((image) => image.hash));
			if (definition.images.some((image) => !existingHashes.has(image.hash))) {
				return refuse('That material identity does not cover these image digests.', 'material-definition-conflict');
			}
			effectiveDefinition = existingMaterial.material;
		}
		for (const image of rawImages) {
			const staged = stageMaterialImage(image, textures, resources, addedTextureResources, !reusesDefinition);
			if (staged !== null) return refuse(staged.message, staged.code);
		}

		const requestedDefinition = { recipe, images: effectiveDefinition.images };
		let materialResource: TypedResource;
		let addedMaterial = false;
		if (existingMaterial === undefined) {
			materialResource = {
				kind: 'material',
				id: recipeHash,
				contentRevision: recipeHash,
				pin: null,
				unresolved: null,
				material: requestedDefinition
			};
			resources.push(materialResource);
			addedMaterial = true;
		} else {
			if (existingMaterial.material === undefined) {
				return refuse('That material identity is already used by another resource kind.', 'material-definition-conflict');
			}
			if (JSON.stringify(existingMaterial.material) !== JSON.stringify(requestedDefinition)) {
				return refuse('That material identity already has a different definition.', 'material-definition-conflict');
			}
			materialResource = existingMaterial;
		}
		const materialLock: import('../../../units/types').DependencyLockEntry = {
			domain: 'resource:material',
			subjectKind: 'resource',
			subjectId: recipeHash,
			instancePath: [],
			contentRevision: recipeHash,
			requiredCapabilities: [MATERIAL_CAPABILITY],
			pin: null
		};
		const existingLock = envelope.dependencyLock.entries.find((entry) =>
			entry.domain === 'resource:material' && entry.subjectId === recipeHash
		);
		const addedLock = existingLock === undefined;
		if (existingLock !== undefined && JSON.stringify(existingLock) !== JSON.stringify(materialLock)) {
			return refuse('That material identity already has a different dependency lock.', 'lock-conflict');
		}

		const entityIds = payload.entityIds === undefined ? [] : readEntityIdList(reader, payload.entityIds, '$.payload.entityIds', true);
		const surfaces = payload.surfaces === undefined ? [] : readSurfaceRefs(reader, payload.surfaces, '$.payload.surfaces');
		if (entityIds === null || surfaces === null || reader.issues.length > 0) {
			return refuse(reader.issues[0]?.message ?? 'The Finish targets are not admissible.');
		}
		if (request.intent.targets.length !== entityIds.length + surfaces.length) {
			return refuse('Registration must address exactly the targets it names.', 'invalid-target');
		}

		const selectedTargets = new Map<
			string,
			{ readonly domain: 'scene' | 'layout'; readonly entityId?: string; readonly surface?: SceneSurfaceRef; readonly revision: string }
		>();
		for (const [index, entityId] of entityIds.entries()) {
			const target = request.intent.targets[index]!;
			const problem = sceneEntityTargetProblem(target, entityId, header.contentRevision);
			if (problem !== null) return refuse(problem.message, 'invalid-target');
			const entity = before.entities.find((candidate) => candidate.id === entityId);
			if (entity === undefined) return refuse('That object is not in the current revision.', 'unknown-entity');
			if (!isFinishPaintable(entity)) {
				return refuse(
					entity.kind === 'light' ? 'Lights have no Finish.' : 'That subject cannot take a Finish.',
					'not-paintable'
				);
			}
			selectedTargets.set(entityId, { domain: 'scene', entityId, revision: header.contentRevision });
		}
		const layout = envelope.units.layout;
		for (const [index, surface] of surfaces.entries()) {
			const target = request.intent.targets[entityIds.length + index]!;
			const expected = surfaceTargetComponent(surface);
			if (
				target.domain !== 'layout' || target.subject.kind !== expected.kind || target.subject.id !== expected.id ||
				target.componentId !== expected.componentId || target.capabilityId !== null || target.instancePath.length !== 0 ||
				target.revision.kind !== 'exact' || target.revision.contentRevision !== layout.header.contentRevision ||
				target.location.kind !== 'layout-location' || target.location.levelId !== layout.data.floor.id ||
				target.location.structureInstancePath.length !== 0
			) {
				return refuse('Registration needs an exact qualified reference to each surface.', 'invalid-target');
			}
			if (resolveLayoutSurface(layout.data, surface) !== 'present') {
				return refuse('That surface changed. Try again.', 'surface_not_present');
			}
			selectedTargets.set(surfaceKey(surface), {
				domain: 'layout',
				surface,
				revision: layout.header.contentRevision
			});
		}
		// Registration never trusts the intent's facts. The host analysis must
		// prove every selected target at exactly this revision; the payload may
		// echo it, and any difference is a refusal rather than a wider admission.
		const trustedFacts = new Map<string, TargetFacts>();
		if (selectedTargets.size > 0) {
			const analysis = options.targetAnalysis?.([...selectedTargets].map(([subject, target]) => ({
				subject,
				domain: target.domain,
				...(target.entityId === undefined ? {} : { entityId: target.entityId }),
				...(target.surface === undefined ? {} : { surface: target.surface }),
				expectedGeometryRevision: target.revision
			}))) ?? null;
			if (analysis === null || analysis.length === 0) {
				return refuse('No host geometry analysis covers these targets. Requalify the exact revision.', 'target-pending');
			}
			for (const facts of analysis) {
				const selected = selectedTargets.get(facts.subject);
				if (selected === undefined) {
					return refuse('Target analysis names an object this registration does not select.', 'invalid-target');
				}
				if (trustedFacts.has(facts.subject)) {
					return refuse('Target analysis answered one subject twice.', 'invalid-target');
				}
				if (facts.geometryRevision !== selected.revision || facts.draws.length === 0) {
					return refuse('Host target analysis is stale or empty. Requalify the exact geometry revision.', 'target-pending');
				}
				trustedFacts.set(facts.subject, facts);
			}
			for (const subject of selectedTargets.keys()) {
				if (!trustedFacts.has(subject)) {
					return refuse('Host analysis does not cover every selected target. Requalify the exact geometry revision.', 'target-pending');
				}
			}
		}
		if (rawFacts.length > 0) {
			if (rawFacts.length !== trustedFacts.size) {
				return refuse('Caller target facts do not describe exactly the selected targets.', 'untrusted-target-facts');
			}
			for (const facts of rawFacts) {
				const trusted = trustedFacts.get(facts.subject);
				if (trusted === undefined || !sameTargetFacts(facts, trusted)) {
					return refuse(
						'Caller target facts disagree with the host geometry analysis. Requalify and retry.',
						'untrusted-target-facts'
					);
				}
			}
		}

		const imageIndex = mergeImageIndexes(shippedImageIndex(), materialImageIndex(effectiveDefinition.images));
		const resolution = resolveFinish({ material: recipe }, undefined, before.palette, imageIndex);
		if (resolution.inputs === null) {
			return refuse('The material recipe cannot resolve on these images.', 'material-definition-conflict');
		}
		if (trustedFacts.size > 0) {
			const qualification = qualifyAcrossTargets(
				resolution,
				[...trustedFacts].map(([subject, facts]) => ({ subject, facts }))
			);
			if (qualification.issues.length > 0) {
				const first = qualification.issues[0]!;
				return refuse(first.action ?? 'This Finish cannot be drawn on the selected target.', first.code);
			}
		}

		const finish: SceneMaterialInstance = {
			id: finishId,
			name,
			base: { material: recipeHash }
		};
		const materials = [...before.materials, finish];
		const entities = before.entities.map((entity) =>
			entityIds.includes(entity.id)
				? assignOne(entity, { project: finishId }, materials, () => {
						throw new Error('a registered Finish needs no pristine instance');
					})
				: entity
		);
		const existingAssignments = new Map((before.surfaceFinishes ?? []).map((entry) => [surfaceKey(entry.surface), entry]));
		const addedKeys: string[] = [];
		const changedKeys: string[] = [];
		for (const surface of surfaces) {
			const key = surfaceKey(surface);
			const assignment: SceneSurfaceFinish = { surface, finish: { materialInstanceId: finishId } };
			const previous = existingAssignments.get(key);
			if (previous === undefined) addedKeys.push(key);
			else if (JSON.stringify(previous) !== JSON.stringify(assignment)) changedKeys.push(key);
			existingAssignments.set(key, assignment);
		}
		const surfaceFinishes = [...existingAssignments.values()].sort((left, right) => {
			const leftKey = surfaceKey(left.surface);
			const rightKey = surfaceKey(right.surface);
			return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0;
		});
		const after: SceneDocument = {
			...before,
			textures,
			materials,
			entities,
			...(surfaceFinishes.length === 0 ? {} : { surfaceFinishes })
		};
		const scopeProblem = materialCandidateScopeProblem(
			envelope.units.resources.data.resources,
			resources,
			envelope.dependencyLock.entries,
			addedLock ? [...envelope.dependencyLock.entries, materialLock] : envelope.dependencyLock.entries,
			new Set([
				...(addedMaterial ? [materialResource.id] : []),
				...addedTextureResources.map((resource) => resource.id)
			]),
			addedLock ? [materialLock] : []
		);
		if (scopeProblem !== null) return refuse(scopeProblem, 'resource-scope');
		const finalized = finalizeSceneCandidate({
			before,
			after,
			scope: {
				...scope,
				changedEntityIds: entityIds,
				changedEntityFields: ['materialId', 'materialInstanceId'],
				surfaceFinishes: { changedKeys, addedKeys },
				textures: { added: addedTextureResources.map((resource) => resource.id) },
				materials: materialGrant({ added: [finishId] })
			}
		});
		if (finalized.kind === 'rejected') return finalized;
		let candidateSource = replaceUnitData(envelope, 'scene', finalized.scene);
		candidateSource = {
			...candidateSource,
			units: {
				...candidateSource.units,
				resources: {
					header: { ...candidateSource.units.resources.header },
					data: { formatVersion: candidateSource.units.resources.data.formatVersion, resources }
				}
			},
			dependencyLock: {
				...candidateSource.dependencyLock,
				entries: addedLock ? [...candidateSource.dependencyLock.entries, materialLock] : candidateSource.dependencyLock.entries
			}
		};
		return {
			kind: 'prepared',
			candidate: {
				operationId: request.intent.operationId,
				sourceKind: request.snapshot.sourceKind,
				sourceVersion: request.snapshot.sourceVersion,
				source: candidateSource,
				changes: [{ kind, subjectIds: [...entityIds, ...surfaces.map(surfaceKey)], fields: ['materials', 'textures', 'surfaceFinishes', 'finish', 'resources', 'dependencyLock'] }],
				correspondence: after.entities.map((entity) => ({
					relation: 'preserved' as const,
					before: reference(entity.id),
					after: reference(entity.id)
				})),
				diagnostics: []
			}
		};
}

export function planSceneFinishFromImage(context: FinishPlanContext): Result {
	const { request, options, envelope, before, header, reader, complete, materialGrant } = context;
		// The one Finish write that stages creator bytes. The P20 upload happened
		// before this intent and is never part of Undo; this write adds only the
		// Scene records that name those bytes, together or not at all.
		const payload = reader.object(request.intent.payload, '$.payload', [
			'name',
			'texture',
			'entityIds',
			'replaceFinishOf'
		]);
		const rawName = payload === null ? null : reader.string(payload.name, '$.payload.name');
		const texturePayload =
			payload === null ? null : reader.object(payload.texture, '$.payload.texture', ['assetId', 'pin']);
		const assetId =
			texturePayload === null
				? null
				: reader.opaqueId(texturePayload.assetId, '$.payload.texture.assetId');
		const pin =
			texturePayload === null
				? null
				: readTexturePin(reader, texturePayload.pin, '$.payload.texture.pin');
		const entityIds =
			payload === null
				? null
				: readEntityIdList(reader, payload.entityIds, '$.payload.entityIds', true);
		if (rawName === null || assetId === null || pin === null || entityIds === null || reader.issues.length > 0) {
			return refuse(reader.issues[0]?.message ?? 'A Finish image needs a name, a verified pin and its objects.', 'invalid-pin');
		}
		const name = rawName.trim();
		if (name.length === 0 || name.length > FINISH_NAME_MAX_LENGTH) {
			return refuse(`A Finish name must be 1 to ${FINISH_NAME_MAX_LENGTH} characters.`, 'invalid-value');
		}
		const textureResource = finishTextureResource({ assetId, pin });
		if (textureResource === null) {
			return refuse('A Finish image needs a sha256 pin for a PNG, JPEG or WebP within the Artwork byte cap.', 'invalid-pin');
		}
		const uri = finishTextureUri(assetId);

		let replace: {
			readonly entityId: string;
			readonly reach: number;
			readonly mode: 'just-this' | 'all' | 'in-place';
		} | null = null;
		if (payload !== null && payload.replaceFinishOf !== undefined) {
			const record = reader.object(payload.replaceFinishOf, '$.payload.replaceFinishOf', [
				'entityId',
				'reach',
				'mode'
			]);
			const replaceEntityId = record === null ? null : reader.opaqueId(record.entityId, '$.payload.replaceFinishOf.entityId');
			const replaceReach =
				record === null ? null : reader.integerAtLeast(record.reach, '$.payload.replaceFinishOf.reach', 1);
			const replaceMode =
				record === null
					? null
					: reader.tag(record.mode, '$.payload.replaceFinishOf.mode', ['just-this', 'all', 'in-place']);
			if (replaceEntityId === null || replaceReach === null || replaceMode === null || reader.issues.length > 0) {
				return refuse(reader.issues[0]?.message ?? 'The image replacement is incomplete.');
			}
			replace = {
				entityId: replaceEntityId,
				reach: replaceReach,
				mode: replaceMode as 'just-this' | 'all' | 'in-place'
			};
		}

		if (replace === null) {
			// An empty selection is the Library's *arm Paint* case: the Finish and
			// its image are created with no user yet, exactly as a project Finish
			// that loses its last user is kept rather than silently deleted.
			if (request.intent.targets.length !== entityIds.length) {
				return refuse('A Finish image must address exactly the objects it names.');
			}
		} else {
			if (entityIds.length > 0) return refuse('An image replacement addresses one object, not a selection.');
			if (request.intent.targets.length !== 1) return refuse('An image replacement addresses exactly one object.');
			const problem = sceneEntityTargetProblem(
				request.intent.targets[0]!,
				replace.entityId,
				header.contentRevision
			);
			if (problem !== null) return refuse(problem.message);
		}
		for (const [index, id] of entityIds.entries()) {
			const problem = sceneEntityTargetProblem(request.intent.targets[index]!, id, header.contentRevision);
			if (problem !== null) return refuse(problem.message);
			const entity = before.entities.find((candidate) => candidate.id === id);
			if (entity === undefined) return refuse(`No Scene object "${id}" is in the current revision.`, 'unknown-entity');
			if (!isFinishPaintable(entity)) return refuse('That subject cannot carry a Finish.', 'not-paintable');
		}

		// The texture record is idempotent: the same bytes always name the same
		// record, and an existing record with another URI is a tampered answer.
		const existingTexture = before.textures.find((texture) => texture.id === assetId);
		if (existingTexture !== undefined && existingTexture.uri !== uri) {
			return refuse('That image is already registered under a different URI.', 'texture-mismatch');
		}
		const textures: SceneTextureAsset[] =
			existingTexture === undefined
				? [...before.textures, { id: assetId, name, uri }]
				: before.textures;
		const texturesAdded = existingTexture === undefined;

		// The typed resource is idempotent too; a record with another pin means the
		// Scene and the registry disagree, which no write may paper over.
		const resources = envelope.units.resources.data.resources;
		const existingResource = resources.find(
			(resource) => resource.kind === 'texture' && resource.id === assetId
		);
		if (
			existingResource !== undefined &&
			(existingResource.pin === null ||
				existingResource.unresolved !== null ||
				!sameFinishTexturePin(existingResource.pin, textureResource.pin))
		) {
			return refuse('That image\u2019s pinned bytes disagree with the project registry.', 'texture-mismatch');
		}
		const resourceToAdd = existingResource === undefined ? textureResource : undefined;

		let scene: SceneDocument;
		let changedEntityIds: readonly string[];
		let subjectIds: readonly string[];
		let addedMaterials: readonly string[] = [];
		let changedMaterials: readonly string[] = [];
		let removedMaterials: readonly string[] = [];

		if (replace === null) {
			const allocations = request.allocatedIds;
			if (allocations.length !== 1 || !['scene-finish', 'scene-material'].includes(allocations[0]!.kind)) {
				return refuse('A Finish image needs one allocated Finish id.', 'missing-allocation');
			}
			const finishId = allocations[0]!.id;
			if (before.materials.some((material) => material.id === finishId)) {
				return refuse('That Finish id is already in use.', 'unexpected-allocation');
			}
			const created: SceneMaterialInstance = {
				id: finishId,
				name,
				base: { catalogue: 'paper-aged' },
				overrides: {
					// The base is `#e2d2b0`; white keeps the image untinted (S1's writer rule).
					color: '#ffffff',
					maps: { color: { image: { textureId: assetId } } }
				}
			};
			const materials = [...before.materials, created];
			const entities = before.entities.map((entity) =>
				entityIds.includes(entity.id)
					? assignOne(entity, { project: finishId }, materials, () => {
							throw new Error('a project Finish needs no pristine instance');
						})
					: entity
			);
			const collected = collectPristine(materials, entities);
			scene = { ...before, textures, materials: collected, entities };
			changedEntityIds = entityIds;
			subjectIds = [...entityIds, finishId];
			addedMaterials = [finishId];
			removedMaterials = materials
				.filter((instance) => !collected.some((candidate) => candidate.id === instance.id))
				.map((instance) => instance.id);
		} else {
			const target = before.entities.find((entity) => entity.id === replace!.entityId);
			if (target === undefined) return refuse('That object is not in the current revision.', 'unknown-entity');
			if (!isFinishPaintable(target)) return refuse('That object has no Finish.', 'not-paintable');
			const key = finishOf(target, before.materials);
			if (key === null || key === 'model-own') {
				return refuse("A model's own materials are not a Finish. Choose a Finish first.", 'not-editable');
			}
			const ref = finishRefOfKey(key);
			if (ref === null || ref === 'model-own') return refuse('That Finish no longer exists.', 'unknown-finish');
			const needsNew = 'curated' in ref || replace.mode === 'just-this';
			const allocations = request.allocatedIds;
			if (needsNew) {
				if (allocations.length !== 1 || !['scene-finish', 'scene-material'].includes(allocations[0]!.kind)) {
					return refuse('This image replacement needs one allocated Finish id.', 'missing-allocation');
				}
			} else if (allocations.length !== 0) {
				return refuse('This image replacement creates no Finish id.', 'unexpected-allocation');
			}
			const workingScene: SceneDocument = { ...before, textures };
			const planned = planEdit(workingScene, {
				layout: envelope.units.layout.data,
				entityId: replace.entityId,
				from: key,
				reach: replace.reach,
				mode: replace.mode,
				edit: { colorMap: assetId },
				allocateId: needsNew ? allocations[0]!.id : null,
				options,
				materialRecipes: materialRecipesOf(envelope)
			});
			if (planned.kind === 'rejected') return refuse(planned.message, planned.code);
			scene = planned.scene;
			changedEntityIds = planned.changedEntityIds;
			subjectIds = [assetId, ...planned.subjectIds];
			addedMaterials = planned.addedMaterials;
			changedMaterials = planned.changedMaterials;
			removedMaterials = planned.removedMaterials;
		}

		const grant: Partial<SceneRecordScope> = {
			changedEntityIds,
			changedEntityFields: ['materialId', 'materialInstanceId'],
			materials: materialGrant({
				added: addedMaterials,
				changed: changedMaterials,
				removed: removedMaterials
			}),
			...(texturesAdded ? { textures: { added: [assetId] } } : {})
		};
		return complete(
			scene,
			grant,
			subjectIds,
			['finish', 'texture', 'resource', 'maps', 'materials'],
			resourceToAdd
		);
}

