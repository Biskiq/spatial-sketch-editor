/**
 * E7/R2b — the texture-variant source: the part of a resolved look the texture
 * store needs, without an upside-down dependency.
 *
 * The variant pool was moved into `texture-store.ts` by E6 with one stated
 * exception: it imported the resolved-look type from
 * `museum/materials/scene-instance-material`. That is the resource layer reading
 * a content layer, and `render-layer-boundary` recorded it as the edge R2b
 * replaces. This module is the replacement: it holds the two fields a variant is
 * keyed by (a seed and the slot → URI map) and nothing else, so the store can
 * type its own input and the resolved look satisfies it structurally.
 */
import type { MaterialTextureSlot } from '$lib/types/materials';

/**
 * One resolved look as the texture pool sees it.
 *
 * `variantSeed` names the effective look (catalogue schema, override colours and
 * texture slots); two looks with the same seed and the same repeat share one
 * loaded variant. `slotUris` is what is loaded — the pool never invents a slot.
 */
export type TextureVariantSource = {
	readonly variantSeed: string;
	readonly slotUris: Partial<Record<MaterialTextureSlot, string>>;
};
