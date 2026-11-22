/**
 * The curated catalogue's presentation side table (T2.S8 U1).
 *
 * Everything here is presentation, never recipe: it sits outside a Finish's
 * canonical identity, so changing it never changes a Finish digest. It joins
 * `materials` by id.
 *
 * - **Framing hints**: the physical window the sample-tile thumbnail shows, in
 *   metres, and where its centre sits on the tile (tile fractions). A hint
 *   frames a piece of the material (a few boards, a brick course, a few linen
 *   threads), never a repeat count. An entry without a hint, and every project
 *   or imported Finish, derives its window from its tile size
 *   (`defaultSampleTileFraming`).
 * - **Variants** (D1): two catalogue entries that differ only by a Finish
 *   factor on one image set present as ONE card with a variant chip. F's
 *   distinctness rule applies between cards, never between a card's variants.
 */
import type { MaterialId } from '$lib/types/materials';
import type { SampleTileFraming } from '$lib/render/materials/sample-tile';

const frame = (windowMeters: number, cx = 0.5, cy = 0.5): SampleTileFraming => ({
	windowMeters,
	centre: [cx, cy]
});

export const materialThumbnailFraming: Readonly<Partial<Record<MaterialId, SampleTileFraming>>> = {
	'wood-oak-veneer': frame(0.28),
	'wood-walnut-veneer': frame(0.34, 0.42),
	'wood-oak-planks': frame(0.62),
	'wood-herringbone-parquet': frame(0.9),
	'stone-travertine': frame(0.6),
	'stone-terrazzo': frame(0.32),
	'masonry-brick-red': frame(0.78),
	'plaster-painted': frame(0.42),
	'concrete-smooth': frame(0.7),
	'concrete-polished': frame(0.7),
	'tile-ceramic-white': frame(0.5),
	'metal-stainless-satin': frame(0.2),
	'metal-brass-satin': frame(0.2),
	'metal-copper-satin': frame(0.2),
	'metal-gold-satin': frame(0.2),
	'metal-stainless-brushed': frame(0.2),
	'metal-aluminium-brushed': frame(0.2),
	'textile-linen': frame(0.09),
	'textile-carpet-loop': frame(0.24),
	'leather-cognac': frame(0.16),
	'synthetic-plastic-matte': frame(0.22)
};

export type MaterialVariantCard = {
	/** The entry the card shows by default and that every variant resolves to. */
	readonly primary: MaterialId;
	/** The card's own name; each variant's label is its chip. */
	readonly label: string;
	readonly variants: readonly { readonly id: MaterialId; readonly label: string }[];
};

/** D1: Smooth and Polished concrete are one card with a Matte/Polished chip. */
export const materialVariantCards: readonly MaterialVariantCard[] = [
	{
		primary: 'concrete-smooth',
		label: 'Concrete',
		variants: [
			{ id: 'concrete-smooth', label: 'Matte' },
			{ id: 'concrete-polished', label: 'Polished' }
		]
	}
];

const variantPrimary = new Map<MaterialId, MaterialId>(
	materialVariantCards.flatMap((card) => card.variants.map((v) => [v.id, card.primary] as const))
);

export function variantCardOf(id: MaterialId): MaterialVariantCard | undefined {
	const primary = variantPrimary.get(id);
	return primary ? materialVariantCards.find((c) => c.primary === primary) : undefined;
}
