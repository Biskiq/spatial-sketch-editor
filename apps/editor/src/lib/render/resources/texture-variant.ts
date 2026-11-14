/**
 * The texture-variant source: the part of a resolved look the texture
 * store needs, without an upside-down dependency.
 *
 * The texture store must not import the resolved-look type from the materials
 * layer: that would be the resource layer reading a content layer, which
 * `render-layer-boundary` forbids. This module holds the two fields a variant is
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
