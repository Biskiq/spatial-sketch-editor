import { computeTextureRepeat, materialById } from '$lib/content/materials';
import type {
	MaterialDefinition,
	MaterialId,
	MaterialTextureSlot
} from '$lib/types/materials';
import type {
	RuntimeScene,
	SceneColor,
	SceneMaterialInstance,
	SceneTextureAsset
} from '$lib/content/scene';
import { countWork } from '@portfolio/layout-core';
import type { StandardMaterialDescriptor } from '$lib/render/resources/material-descriptor';
import type { SceneTextureSpec } from '$lib/render/resources/scene-render-item';
import { applyTreatment, type TreatmentSubject } from './treatment';

const DEFAULT_TILE: [number, number] = [1, 1];
const DEFAULT_OFFSET: [number, number] = [0, 0];
const SLOT_ORDER: MaterialTextureSlot[] = [
	'map',
	'normalMap',
	'roughnessMap',
	'aoMap',
	'metalnessMap'
];

/**
 * The Scene fields the look resolver reads. `palette` resolves a follower
 * colour and `environment` supplies the Treatment; both live on the
 * `RuntimeScene` every surface already shares.
 */
export type LookSource = Pick<RuntimeScene, 'materials' | 'textures' | 'palette' | 'environment'>;

// Static property access required — Vite's module runner rejects dynamic import.meta.env reads.
const isDevEnv = import.meta.env.DEV;

export type EffectiveSceneMaterial = {
	catalogue: MaterialId | null;
	slotUris: Partial<Record<MaterialTextureSlot, string>>;
	roughness: number;
	metalness: number;
	color: string;
	defaultTileSizeMeters: [number, number];
	/** Radians about the UV centre; `0` when the Finish sets none. */
	rotation: number;
	/** Shift in tile fractions, u then v. */
	offset: [number, number];
	/** `(x, y)` normal-map scale, or `null` when no normal map is bound. */
	normalScale: [number, number] | null;
	variantSeed: string;
};

/**
 * One resolved Scene look as render data: the surface's canonical descriptor and
 * the texture variant it binds, or none.
 *
 * It is evaluated once per Scene description build, not per entity per render,
 * and this value is plain data a descriptor-keyed store can share: two
 * entities with the same look produce the same descriptor and therefore one
 * material instance.
 */
export type SceneLook = {
	readonly material: StandardMaterialDescriptor;
	readonly textures: SceneTextureSpec | null;
};

/**
 * The resolved look for one entity at one surface size.
 *
 * `toneMapped` is `true`: the Scene's accepted pipeline leaves the surface toned
 * (Gate A). The repeat comes from `computeTextureRepeat`.
 */
export function sceneLookFor(
	document: LookSource,
	target: ResolveTarget,
	surfaceSize: readonly [number, number]
): SceneLook {
	const effective = resolveSceneMaterial(document, target);
	const repeat = computeTextureRepeat([surfaceSize[0], surfaceSize[1]], effective.defaultTileSizeMeters);
	const slotUris: Partial<Record<MaterialTextureSlot, string>> = {};
	for (const slot of SLOT_ORDER) {
		const uri = effective.slotUris[slot];
		if (uri !== undefined) slotUris[slot] = uri;
	}
	const bound = Object.keys(slotUris).length > 0;
	return {
		material: {
			kind: 'standard',
			color: effective.color,
			roughness: effective.roughness,
			metalness: effective.metalness,
			toneMapped: true,
			...(effective.normalScale === null ? {} : { normalScale: effective.normalScale })
		},
		textures: bound
			? {
					variantSeed: effective.variantSeed,
					slotUris,
					repeat,
					rotation: effective.rotation,
					offset: effective.offset
				}
			: null
	};
}

export type ResolveTarget = {
	materialInstanceId: string | null;
	fallbackCatalogueId: MaterialId;
};

function djb2(input: string): string {
	let hash = 5381;
	for (let i = 0; i < input.length; i += 1) {
		hash = ((hash << 5) + hash + input.charCodeAt(i)) & 0xffffffff;
	}
	return (hash >>> 0).toString(16).padStart(8, '0').slice(0, 6);
}

function findTexture(
	document: LookSource,
	textureId: string | undefined
): SceneTextureAsset | undefined {
	if (!textureId) return undefined;
	return document.textures.find((texture) => texture.id === textureId);
}

/**
 * The effective finish colour: the resolved literal or follower, otherwise the
 * catalogue's `fallbackColor`. This is today's rule unchanged — the colour
 * multiplies the colour map, so a catalogue or instance texture is tinted by
 * the base exactly as `main` tints it.
 */
function resolveColor(
	document: LookSource,
	color: SceneColor | undefined,
	fallback: string
): string {
	if (color === undefined) return fallback;
	if (typeof color === 'string') return color;
	const slot = document.palette?.find((entry) => entry.id === color.slot);
	if (slot !== undefined) return slot.color;
	if (isDevEnv) {
		console.warn(`[scene-instance-material] Unknown palette slot: ${color.slot}`);
	}
	return fallback;
}

/**
 * Pure resolver. Combines a material instance override (if any) on top of a
 * catalogue-PBR fallback. Deterministic output; no Three.js or document
 * mutation; safe to call inside Svelte `$derived` blocks.
 *
 * `variantSeed` is the cache key seed shared with texture-cache's variant pool
 * — two effective materials with identical (slotUris, roughness, metalness,
 * treatment) produce the same seed and therefore share the same variant. A
 * natural look keeps exactly the seed it had before Scene 8.
 */
export function resolveSceneMaterial(
	document: LookSource,
	target: ResolveTarget
): EffectiveSceneMaterial {
	countWork('material:resolve');
	const instance: SceneMaterialInstance | undefined = target.materialInstanceId
		? document.materials.find(
				(material) => material.id === target.materialInstanceId
			)
		: undefined;

	if (target.materialInstanceId && !instance && isDevEnv) {
		console.warn(
			`[scene-instance-material] Unknown materialInstanceId: ${target.materialInstanceId}`
		);
	}

	let catalogueId: MaterialId | null =
		instance?.baseMaterialId ?? target.fallbackCatalogueId;
	if (catalogueId && !materialById.has(catalogueId)) {
		catalogueId = null;
	}
	const catalogue: MaterialDefinition | undefined = catalogueId
		? materialById.get(catalogueId)
		: undefined;

	// The base's textures first; a slot named in `maps` replaces exactly that
	// slot and leaves the rest of the base's set intact.
	const slotUris: Partial<Record<MaterialTextureSlot, string>> = {
		...(catalogue?.textures ?? {})
	};
	const finishMaps = instance?.maps;
	for (const slot of SLOT_ORDER) {
		const textureId = finishMaps?.[slotKeyOf(slot)];
		if (textureId === undefined) continue;
		const texture = findTexture(document, textureId);
		if (texture) slotUris[slot] = texture.uri;
		else if (isDevEnv) {
			console.warn(`[scene-instance-material] Unknown finish map: ${textureId} (${slot})`);
		}
	}

	const roughness = instance?.roughness ?? catalogue?.roughness ?? 0.5;
	const metalness = instance?.metalness ?? catalogue?.metalness ?? 0;
	const color = resolveColor(document, instance?.color, catalogue?.fallbackColor ?? '#c4b4a0');
	const defaultTileSizeMeters: [number, number] = instance?.mapping?.tileMeters
		? [instance.mapping.tileMeters[0], instance.mapping.tileMeters[1]]
		: (catalogue?.defaultTileSizeMeters ?? DEFAULT_TILE);
	const rotation = instance?.mapping?.rotation ?? 0;
	const offset: [number, number] = instance?.mapping?.offset
		? [instance.mapping.offset[0], instance.mapping.offset[1]]
		: DEFAULT_OFFSET;

	// A normal scale or flip only means anything once a normal map is bound. The
	// catalogue's own signed pair is the fallback when the instance sets none.
	const catalogueNormalScale = catalogue?.normalScale;
	const normalMagnitude = instance?.normalScale ?? Math.abs(catalogueNormalScale?.[0] ?? 1);
	const flipY =
		instance?.normalFlipY ?? (catalogueNormalScale === undefined ? false : catalogueNormalScale[1] < 0);
	const normalScale: [number, number] | null =
		slotUris.normalMap === undefined
			? null
			: [normalMagnitude, flipY ? -normalMagnitude : normalMagnitude];

	const treatment = document.environment?.treatment;
	const treated: TreatmentSubject = applyTreatment(treatment, {
		color,
		roughness,
		metalness,
		slotUris,
		normalScale
	});

	const sortedEntries = SLOT_ORDER.filter(
		(slot) => treated.slotUris[slot] !== undefined
	)
		.map((slot) => `${slot}=${treated.slotUris[slot]}`)
		.join('&');
	// Natural adds nothing to the seed, so every Scene 7 material keeps its
	// variant. A Treatment changes the look, so it must change the variant.
	const treatmentSeed = treatment === undefined ? '' : `|${treatment}`;
	const variantSeed = `v${djb2(
		`${sortedEntries}|${Math.round(treated.roughness * 1000)}|${Math.round(
			treated.metalness * 1000
		)}${treatmentSeed}`
	)}`;

	return {
		catalogue: catalogueId,
		slotUris: treated.slotUris,
		roughness: treated.roughness,
		metalness: treated.metalness,
		color: treated.color,
		defaultTileSizeMeters,
		rotation,
		offset,
		normalScale:
			treated.normalScale === null ? null : [treated.normalScale[0], treated.normalScale[1]],
		variantSeed
	};
}

/** The authored map key for one render slot. */
function slotKeyOf(slot: MaterialTextureSlot): 'color' | 'normal' | 'roughness' | 'occlusion' | 'metalness' {
	switch (slot) {
		case 'map':
			return 'color';
		case 'normalMap':
			return 'normal';
		case 'roughnessMap':
			return 'roughness';
		case 'aoMap':
			return 'occlusion';
		case 'metalnessMap':
			return 'metalness';
	}
}
