/**
 * The Scene look adapter, projected through the canonical v1 contract.
 *
 * `sceneLookFor` keeps the pre-S8 descriptor shape the look golden froze.
 * `sceneFinishFor` returns the same plain descriptor **plus** the sampled plan and
 * the view sources the renderer acquires. Both come from one resolution:
 *
 * 1. the Scene 11 instance is adapted by `sceneFinishToContract`;
 * 2. `resolveFinish` applies sparse overrides, palette followers and provenance;
 * 3. `bindFinish` qualifies the target and produces per-role UV sets, transforms
 *    and origins;
 * 4. `finishSamplingPlan` freezes the portable plan;
 * 5. this module assigns the renderer's view keys and URIs.
 *
 * Treatment is applied once, here, to the effective factors; Clay and Flat Colour
 * remove every sample. A dangling Scene texture id is dropped before adaptation,
 * preserving the shipped resolver's fallback to the base slot; the pure resolver
 * would otherwise report `missing-pin` for a record the Scene already lost.
 */
import {
	bindFinish,
	finishSamplingPlan,
	materialImageIndex,
	mergeImageIndexes,
	pruneOverrides,
	resolveFinish,
	shippedImage,
	shippedImageIndex,
	type BoundInputs,
	type Finish,
	type FinishOverrides,
	type ImageIndex,
	type MapRole,
	type MaterialIssue,
	type ResolvedMaps,
	type TargetFacts
} from '@portfolio/project-model/materials';
import { computeTextureRepeat, materialById } from '$lib/content/materials';
import { countWork } from '@portfolio/layout-core';
import type {
	MaterialDefinition,
	MaterialId,
	MaterialTextureSlot
} from '$lib/types/materials';
import type { RuntimeScene, SceneTextureAsset } from '$lib/content/scene';
import type {
	FinishMapRole,
	FinishSamplingPlanEntry as DescriptorPlanEntry,
	StandardFinishPlan,
	StandardMaterialDescriptor
} from '$lib/render/resources/material-descriptor';
import type {
	SceneFinishViewSource,
	SceneTextureSpec
} from '$lib/render/resources/scene-render-item';
import { applyTreatment } from './treatment';

const SLOT_ORDER: MaterialTextureSlot[] = [
	'map',
	'normalMap',
	'roughnessMap',
	'aoMap',
	'metalnessMap'
];

const SLOT_FOR_ROLE: Readonly<Record<MapRole, MaterialTextureSlot>> = {
	color: 'map',
	normal: 'normalMap',
	roughness: 'roughnessMap',
	occlusion: 'aoMap',
	metalness: 'metalnessMap'
};

export type LookSource = Pick<RuntimeScene, 'materials' | 'textures' | 'palette' | 'environment'> &
	Pick<Partial<RuntimeScene>, 'materialIndex'>;

export type ResolveTarget = {
	materialInstanceId: string | null;
	fallbackCatalogueId: MaterialId;
};

/**
 * The target's native UV meaning.
 *
 * `uvMeters` is metres per native UV unit. Forms, Walls, Room floors/lids and
 * Region faces are metre charts (`[1,1]`); a normalized primitive states its
 * rendered span. A legacy model remap has identity UV0 and no metric basis.
 */
export type SceneFinishGeometry =
	| {
			readonly kind: 'metric';
			readonly uvMeters: readonly [number, number];
			readonly surfaceMeters: readonly [number, number];
	  }
	| {
			readonly kind: 'legacy';
			/** Native UV sets the draw actually has; defaults to UV0 only. */
			readonly uvSets?: readonly (0 | 1)[];
			readonly normalFrameSets?: readonly (0 | 1)[];
	  };

export type SceneFinishLook = {
	/** The catalogue base the look resolved through, if any. */
	readonly catalogue: MaterialId | null;
	readonly material: StandardMaterialDescriptor;
	readonly textures: SceneTextureSpec | null;
	/** The effective untreated inputs, retained for inspection. */
	readonly inputs: BoundInputs | null;
	readonly issues: readonly MaterialIssue[];
};

export type EffectiveSceneMaterial = {
	catalogue: MaterialId | null;
	slotUris: Partial<Record<MaterialTextureSlot, string>>;
	roughness: number;
	metalness: number;
	color: string;
	defaultTileSizeMeters: [number, number];
	rotation: number;
	offset: [number, number];
	normalScale: [number, number] | null;
	variantSeed: string;
};

export type SceneLook = {
	readonly material: StandardMaterialDescriptor;
	readonly textures: SceneTextureSpec | null;
};

// Static property access required — Vite's module runner rejects dynamic import.meta.env reads.
const isDevEnv = import.meta.env.DEV;

function djb2(input: string): string {
	let hash = 5381;
	for (let i = 0; i < input.length; i += 1) {
		hash = ((hash << 5) + hash + input.charCodeAt(i)) & 0xffffffff;
	}
	return (hash >>> 0).toString(16).padStart(8, '0').slice(0, 6);
}

function findTexture(document: LookSource, textureId: string | undefined): SceneTextureAsset | undefined {
	if (!textureId) return undefined;
	return document.textures.find((texture) => texture.id === textureId);
}

/**
 * Image identities for the Scene's local records and the shipped catalogue.
 * A local record's identity is its authored texture id: the Scene format carries
 * no digest until D, and this resolver must not invent one. The render layer's
 * view key names the same identity, so bytes are shared by record, not by URI
 * spelling alone.
 */
function sceneImageIndex(document: LookSource, definitionHash?: string): ImageIndex {
	const allImages = document.materialIndex?.images ?? [];
	const proofImages = definitionHash === undefined
		? allImages
		: (document.materialIndex?.definitionImages.get(definitionHash) ?? []);
	// A definition's own mappings win over an unrelated texture with the same
	// bytes. Overrides may still pin another texture from this Scene, so the full
	// registry remains a fallback rather than being dropped.
	return mergeImageIndexes(
		shippedImageIndex(),
		materialImageIndex(proofImages),
		materialImageIndex(allImages)
	);
}

/** The recipe a resource-backed Finish names, from its derived runtime index. */
function definitionRecipe(document: LookSource, hash: string) {
	return document.materialIndex?.definitions.get(hash) ?? null;
}

/** A URI for one resolved image, or null when a local record no longer exists. */
type ImageRef = { readonly source: import('@portfolio/project-model/materials').LocalImage; readonly hash?: string };

function imageUri(document: LookSource, image: ImageRef): string | null {
	if ('textureId' in image.source) {
		return findTexture(document, image.source.textureId)?.uri ?? null;
	}
	const shipped = shippedImage(image.source.shipped);
	return shipped?.uri ?? null;
}

function imageIdentity(image: ImageRef): string {
	return 'textureId' in image.source
		? `texture:${image.source.textureId}`
		: `shipped:${image.source.shipped}`;
}

/** The view key: image identity plus the decode policy the role needs. */
function viewKey(role: MapRole, image: ImageRef): string {
	return `${imageIdentity(image)}|${role === 'color' ? 'srgb' : 'raw'}`;
}

/**
 * Drop a map entry whose Scene texture record no longer exists, so the base
 * slot survives exactly as the shipped resolver's fallback did. A dev warning
 * names the lost id.
 */
function sanitizeInstance(
	document: LookSource,
	instance: Finish
): { instance: Finish; dropped: string[] } {
	const maps = instance.overrides?.maps;
	if (maps === undefined) return { instance, dropped: [] };
	const kept: Record<string, NonNullable<FinishOverrides['maps']>[MapRole]> = {};
	const dropped: string[] = [];
	for (const role of Object.keys(maps) as MapRole[]) {
		const binding = maps[role];
		if (binding === undefined || binding === null) continue;
		const textureId = 'textureId' in binding.image ? binding.image.textureId : null;
		if (textureId !== null && findTexture(document, textureId) === undefined) {
			dropped.push(`${role}:${textureId}`);
			continue;
		}
		kept[role] = binding;
	}
	if (dropped.length === 0) return { instance, dropped };
	if (isDevEnv) {
		for (const entry of dropped) {
			console.warn(`[scene-finish] Unknown finish map: ${entry}`);
		}
	}
	const overrides = pruneOverrides({
		...instance.overrides,
		...(Object.keys(kept).length === 0 ? { maps: undefined } : { maps: kept as NonNullable<FinishOverrides['maps']> })
	});
	return {
		instance: {
			id: instance.id,
			name: instance.name,
			base: instance.base,
			...(overrides === undefined ? {} : { overrides })
		},
		dropped
	};
}

function targetFacts(
	instanceId: string | null,
	catalogueId: string | null,
	geometry: SceneFinishGeometry
): TargetFacts {
	const subject = instanceId ?? `catalogue:${catalogueId ?? 'unknown'}`;
	if (geometry.kind === 'legacy') {
		return {
			subject,
			geometryRevision: `legacy:${(geometry.uvSets ?? [0]).join(',')}`,
			draws: [
				{
					drawKey: 'legacy-draw',
					uvSets: [...(geometry.uvSets ?? [0])],
					normalFrameSets: [...(geometry.normalFrameSets ?? geometry.uvSets ?? [0])]
				}
			]
		};
	}
	const revision = `metric:${geometry.uvMeters[0]},${geometry.uvMeters[1]}:${geometry.surfaceMeters[0]},${geometry.surfaceMeters[1]}`;
	return {
		subject,
		geometryRevision: revision,
		metricBasis: {
			uvMeters: [geometry.uvMeters[0], geometry.uvMeters[1]],
			surfaceMeters: [geometry.surfaceMeters[0], geometry.surfaceMeters[1]]
		},
		// Scene 11 metric targets author UV0 only; UV1 is a future format capability.
		draws: [{ drawKey: 'native-draw', uvSets: [0], normalFrameSets: [0] }]
	};
}

export function mappingMetric(inputs: BoundInputs): {
	tileMeters: [number, number];
	rotation: number;
	offset: [number, number];
} {
	const mapping = inputs.mapping;
	if (mapping.kind === 'uv') {
		return { tileMeters: [1, 1], rotation: 0, offset: [0, 0] };
	}
	return {
		tileMeters: [mapping.metric.tileMeters[0], mapping.metric.tileMeters[1]],
		rotation: mapping.metric.rotation,
		offset: [mapping.metric.offset[0], mapping.metric.offset[1]]
	};
}

function slotUrisFor(
	document: LookSource,
	maps: ResolvedMaps
): { slotUris: Partial<Record<MaterialTextureSlot, string>>; uris: Map<MapRole, string> } {
	const slotUris: Partial<Record<MaterialTextureSlot, string>> = {};
	const uris = new Map<MapRole, string>();
	for (const role of ['color', 'normal', 'roughness', 'metalness', 'occlusion'] as const) {
		const binding = maps[role];
		if (binding?.image == null) continue;
		const uri = imageUri(document, binding.image);
		if (uri === null) continue;
		uris.set(role, uri);
		slotUris[SLOT_FOR_ROLE[role]] = uri;
	}
	return { slotUris, uris };
}

/** The legacy variant identity, preserved byte-for-byte for the look golden. */
function legacyVariantSeed(
	slotUris: Partial<Record<MaterialTextureSlot, string>>,
	roughness: number,
	metalness: number,
	treatment: 'flat-colour' | 'clay' | undefined
): string {
	const sortedEntries = SLOT_ORDER.filter((slot) => slotUris[slot] !== undefined)
		.map((slot) => `${slot}=${slotUris[slot]}`)
		.join('&');
	const treatmentSeed = treatment === undefined ? '' : `|${treatment}`;
	return `v${djb2(
		`${sortedEntries}|${Math.round(roughness * 1000)}|${Math.round(metalness * 1000)}${treatmentSeed}`
	)}`;
}

function descriptorEntry(entry: ReturnType<typeof finishSamplingPlan>['entries'][number]): DescriptorPlanEntry {
	return {
		role: entry.role,
		view: viewKey(entry.role, { hash: entry.hash, source: entry.source }),
		uvSet: entry.uvSet,
		origin: entry.origin,
		repeat: [entry.repeat[0], entry.repeat[1]],
		rotation: entry.rotation,
		offset: [entry.offset[0], entry.offset[1]],
		...(entry.convention === undefined ? {} : { convention: entry.convention }),
		...(entry.component === undefined ? {} : { component: entry.component }),
		...(entry.invert === undefined ? {} : { invert: entry.invert })
	};
}

/**
 * One Scene look through the canonical contract.
 *
 * A target that cannot be bound returns the effective factors and the legacy
 * slot map without a plan: the surface draws its fallback colour exactly as the
 * shipped resolver would, and the ordered issues say why. This is a draft-time
 * degradation, never a silent substitute for a qualified plan.
 */
export function sceneFinishFor(
	document: LookSource,
	target: ResolveTarget,
	geometry: SceneFinishGeometry
): SceneFinishLook {
	countWork('material:resolve');
	const instance = target.materialInstanceId
		? document.materials.find((material) => material.id === target.materialInstanceId)
		: undefined;
	if (target.materialInstanceId && !instance && isDevEnv) {
		console.warn(`[scene-instance-material] Unknown materialInstanceId: ${target.materialInstanceId}`);
	}
	const base = instance?.base;
	const definitionHash = base !== undefined && 'material' in base ? base.material : null;
	const baseRecipe = definitionHash === null ? null : definitionRecipe(document, definitionHash);
	let catalogueId: MaterialId | null =
		base !== undefined && 'catalogue' in base
			? (base.catalogue as MaterialId)
			: instance === undefined
				? target.fallbackCatalogueId
				: null;
	if (catalogueId !== null && !materialById.has(catalogueId)) catalogueId = null;
	const catalogue: MaterialDefinition | undefined = catalogueId ? materialById.get(catalogueId) : undefined;
	const fallbackCatalogue = materialById.get(target.fallbackCatalogueId);
	if (base !== undefined && 'material' in base && baseRecipe === null) {
		const fallback = applyTreatment(document.environment?.treatment, {
			color: fallbackCatalogue?.fallbackColor ?? '#c4b4a0',
			roughness: fallbackCatalogue?.roughness ?? 0.5,
			metalness: 0,
			slotUris: {},
			normalScale: null
		});
		return {
			catalogue: null,
			material: {
				kind: 'standard',
				color: fallback.color,
				roughness: fallback.roughness,
				metalness: fallback.metalness,
				toneMapped: true
			},
			textures: null,
			inputs: null,
			issues: [
				{
					code: 'missing-definition',
					path: '$.base.material',
					action: 'Re-import the material definition so its recipe and images are available.'
				}
			]
		};
	}
	if (catalogueId === null && baseRecipe === null) {
		const fallback = applyTreatment(document.environment?.treatment, {
			color: fallbackCatalogue?.fallbackColor ?? '#c4b4a0',
			roughness: fallbackCatalogue?.roughness ?? 0.5,
			metalness: 0,
			slotUris: {},
			normalScale: null
		});
		return {
			catalogue: null,
			material: {
				kind: 'standard',
				color: fallback.color,
				roughness: fallback.roughness,
				metalness: fallback.metalness,
				toneMapped: true
			},
			textures: null,
			inputs: null,
			issues: [
				{
					code: 'unknown-catalogue-base',
					path: '$.base.catalogue',
					action: 'Use an admitted catalogue base.'
				}
			]
		};
	}

	const issues: MaterialIssue[] = [];
	const sanitized = instance === undefined ? undefined : sanitizeInstance(document, instance);
	const source = sanitized?.instance ?? instance;
	const resolution = baseRecipe !== null
		? resolveFinish(
				{ material: baseRecipe },
				source?.overrides,
				document.palette,
				sceneImageIndex(document, definitionHash ?? undefined)
			)
		: resolveFinish(
				{ catalogue: catalogue!.id },
				source?.overrides,
				document.palette,
				sceneImageIndex(document)
			);
	issues.push(...resolution.issues);
	warnIssues(target.materialInstanceId ?? catalogueId ?? 'material', resolution.issues);
	const inputs = resolution.inputs;
	if (inputs === null) {
		const fallback = applyTreatment(document.environment?.treatment, {
			color: catalogue?.fallbackColor ?? fallbackCatalogue?.fallbackColor ?? '#c4b4a0',
			roughness: catalogue?.roughness ?? fallbackCatalogue?.roughness ?? 0.5,
			metalness: catalogue?.metalness ?? 0,
			slotUris: {},
			normalScale: null
		});
		return {
			catalogue: catalogueId,
			material: {
				kind: 'standard',
				color: fallback.color,
				roughness: fallback.roughness,
				metalness: fallback.metalness,
				toneMapped: true
			},
			textures: null,
			inputs: null,
			issues
		};
	}

	const facts = targetFacts(instance?.id ?? null, catalogueId, geometry);
	const binding = bindFinish(resolution, { subject: facts.subject, facts });
	issues.push(...binding.issues);
	warnIssues(target.materialInstanceId ?? catalogue?.id ?? catalogueId ?? 'material', binding.issues);
	const { slotUris, uris } = slotUrisFor(document, inputs.maps);
	const treatment = document.environment?.treatment;

	let roughness = inputs.roughness;
	let metalness = inputs.metalness;
	let colorValue = inputs.color;
	if (treatment === 'clay') {
		colorValue = '#d6d3cd';
		roughness = 0.9;
		metalness = 0;
	} else if (treatment === 'flat-colour') {
		roughness = Math.max(inputs.roughness, 0.6);
		metalness = 0;
	}

	const metric = mappingMetric(inputs);
	// The legacy repeat is the surface span divided by the tile on a normalized
	// chart and 1/tile on a metre chart; the metric basis already encodes which.
	const legacyRepeat: [number, number] =
		geometry.kind === 'metric'
			? computeTextureRepeat(
					geometry.uvMeters[0] === 1 && geometry.uvMeters[1] === 1
						? [1, 1]
						: [geometry.surfaceMeters[0], geometry.surfaceMeters[1]],
					metric.tileMeters
				)
			: [1, 1];
	const rotation = geometry.kind === 'metric' ? metric.rotation : 0;
	const offset: [number, number] = geometry.kind === 'metric' ? [metric.offset[0], metric.offset[1]] : [0, 0];

	const bound = binding.bound;
	let finish: StandardFinishPlan | undefined;
	let views: SceneFinishViewSource[] = [];
	if (bound !== null && treatment === undefined) {
		const portable = finishSamplingPlan(bound);
		const entries = portable.entries.map(descriptorEntry);
		const unique = new Map<string, SceneFinishViewSource>();
		let complete = true;
		for (const entry of portable.entries) {
			const uri = uris.get(entry.role);
			const key = viewKey(entry.role, { hash: entry.hash, source: entry.source });
			if (uri === undefined) {
				complete = false;
				break;
			}
			if (!unique.has(key)) unique.set(key, { view: key, uri, role: entry.role });
		}
		if (complete && entries.length > 0) {
			finish = {
				profile: 'pbr-metallic-roughness/v1',
				entries,
				occlusionStrength: inputs.occlusionStrength,
				normalScale: inputs.normalScale
			};
			views = [...unique.values()];
		}
	}

	const normalBinding = inputs.maps.normal;
	const normalScale: [number, number] | null =
		normalBinding === undefined || normalBinding.image === null
			? null
			: [
					inputs.normalScale,
					normalBinding.convention === '-Y' ? -inputs.normalScale : inputs.normalScale
				];

	const descriptor: StandardMaterialDescriptor = {
		kind: 'standard',
		color: colorValue,
		roughness,
		metalness,
		toneMapped: true,
		...(normalScale === null || treatment !== undefined ? {} : { normalScale }),
		...(finish === undefined ? {} : { finish })
	};

	// A Treatment is not a textured look: Clay and Flat Colour drop every sample,
	// exactly as `applyTreatment` always did. Otherwise keep the legacy slot map
	// for the frozen projection and the sampled views for the new path.
	const effectiveSlotUris: Partial<Record<MaterialTextureSlot, string>> = {};
	if (treatment === undefined) {
		for (const slot of SLOT_ORDER) {
			const uri = slotUris[slot];
			if (uri !== undefined) effectiveSlotUris[slot] = uri;
		}
	}
	const boundTextures = Object.keys(effectiveSlotUris).length > 0;
	const textures: SceneTextureSpec | null = boundTextures
		? {
				variantSeed: legacyVariantSeed(effectiveSlotUris, roughness, metalness, treatment),
				slotUris: effectiveSlotUris,
				repeat: legacyRepeat,
				rotation,
				offset,
				...(views.length === 0 ? {} : { views })
			}
		: null;

	return { catalogue: catalogueId, material: descriptor, textures, inputs, issues };
}

/**
 * Preserve the shipped resolver's dev warnings for a degraded resolution. The
 * pure contract returns ordered issues; the editor has always mirrored them to
 * the console while a creator is editing, so a missing palette slot or a normal
 * image with no pin still says why the surface fell back.
 */
const warned = new Set<string>();
function warnIssues(subject: string, issues: readonly MaterialIssue[]): void {
	if (!isDevEnv) return;
	for (const issue of issues) {
		const key = `${subject}|${issue.code}|${issue.path}`;
		if (warned.has(key)) continue;
		warned.add(key);
		console.warn(`[scene-instance-material] ${issue.code} at ${issue.path}: ${issue.action}`);
	}
}

/** Project one resolved look to the frozen pre-S8 descriptor shape. */
export function projectSceneLook(look: SceneFinishLook): SceneLook {
	const { finish: _finish, ...material } = look.material;
	const textures =
		look.textures === null
			? null
			: (() => {
					const { views: _views, ...legacy } = look.textures;
					return legacy;
				})();
	return { material: material as StandardMaterialDescriptor, textures };
}

/** The resolved look for one entity at one surface size, in the frozen shape. */
export function sceneLookFor(
	document: LookSource,
	target: ResolveTarget,
	surfaceSize: readonly [number, number]
): SceneLook {
	return projectSceneLook(
		sceneFinishFor(document, target, {
			kind: 'metric',
			uvMeters: [surfaceSize[0], surfaceSize[1]],
			surfaceMeters: [surfaceSize[0], surfaceSize[1]]
		})
	);
}

/**
 * The tile/rotation/offset projection of one resolution, for the frozen
 * `EffectiveSceneMaterial` caller. The tile is the base metric's unless the
 * instance authored a target mapping.
 */
function defaultsFor(document: LookSource, target: ResolveTarget): {
	tileMeters: [number, number];
	rotation: number;
	offset: [number, number];
} {
	const instance = target.materialInstanceId
		? document.materials.find((material) => material.id === target.materialInstanceId)
		: undefined;
	const baseRecipe = instance !== undefined && 'material' in instance.base
		? definitionRecipe(document, instance.base.material)
		: null;
	const catalogueId = instance !== undefined && 'catalogue' in instance.base
		? (instance.base.catalogue as MaterialId)
		: target.fallbackCatalogueId;
	const catalogue = materialById.get(catalogueId);
	const baseMapping = baseRecipe?.mapping;
	const override = instance?.overrides?.mapping;
	const metric = override !== undefined && override.kind !== 'uv'
		? override.metric
		: baseMapping !== undefined && baseMapping.kind !== 'uv'
			? baseMapping.metric
			: undefined;
	const tile = metric?.tileMeters ?? catalogue?.defaultTileSizeMeters ?? [1, 1];
	return {
		tileMeters: [tile[0], tile[1]],
		rotation: metric?.rotation ?? 0,
		offset: metric ? [metric.offset[0], metric.offset[1]] : [0, 0]
	};
}

/**
 * The frozen `EffectiveSceneMaterial` reading. It is the scalar/tile projection of
 * the same resolution, kept for callers that need a value rather than a material.
 */
export function resolveSceneMaterial(document: LookSource, target: ResolveTarget): EffectiveSceneMaterial {
	const look = sceneFinishFor(document, target, {
		kind: 'metric',
		uvMeters: [1, 1],
		surfaceMeters: [1, 1]
	});
	const defaults = defaultsFor(document, target);
	return {
		catalogue: look.catalogue,
		slotUris: look.textures?.slotUris ?? {},
		roughness: look.material.roughness,
		metalness: look.material.metalness,
		color: typeof look.material.color === 'string' ? look.material.color : '#ffffff',
		defaultTileSizeMeters: defaults.tileMeters,
		rotation: defaults.rotation,
		offset: defaults.offset,
		normalScale:
			look.material.normalScale === undefined
				? null
				: [look.material.normalScale[0], look.material.normalScale[1]],
		variantSeed: look.textures?.variantSeed ?? `v${djb2(`${defaults.tileMeters.join(',')}`)}`
	};
}
