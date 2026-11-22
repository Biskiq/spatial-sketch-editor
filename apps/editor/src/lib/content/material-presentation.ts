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

export type FoldedCuratedCard<T extends { readonly id: MaterialId }> = T & {
	/** The card's name: the variant card's label, else the entry's own. */
	readonly cardLabel: string | null;
	/** Empty for a plain entry; the chip row for a variant card. */
	readonly variants: readonly { readonly id: MaterialId; readonly label: string }[];
};

/**
 * D1 folding, shared by every curated surface (Library shelf, Paint tray): a
 * variant card sits where its primary does and shows `shown(primary)`, or the
 * primary, and its other variants are dropped from the list.
 */
export function foldVariantCards<T extends { readonly id: MaterialId }>(
	entries: readonly T[],
	shown: (primary: MaterialId) => MaterialId | undefined = () => undefined
): FoldedCuratedCard<T>[] {
	const cards: FoldedCuratedCard<T>[] = [];
	for (const entry of entries) {
		const group = variantCardOf(entry.id);
		if (group === undefined) {
			cards.push({ ...entry, cardLabel: null, variants: [] });
			continue;
		}
		if (entry.id !== group.primary) continue;
		// A choice outside this card (another card's pick) never changes what it shows.
		const wanted = shown(group.primary);
		const chosen = wanted !== undefined && group.variants.some((variant) => variant.id === wanted) ? wanted : group.primary;
		const pick = entries.find((candidate) => candidate.id === chosen) ?? entry;
		cards.push({ ...pick, cardLabel: group.label, variants: group.variants });
	}
	return cards;
}

/** The catalogue's families, in the order every curated surface lists them (presentation only). */
export const materialFamilies = [
	{ id: 'wood', label: 'Wood' },
	{ id: 'stone', label: 'Stone' },
	{ id: 'masonry', label: 'Masonry' },
	{ id: 'plaster-concrete', label: 'Plaster & Concrete' },
	{ id: 'tile-ceramic', label: 'Tile & Ceramic' },
	{ id: 'metal', label: 'Metal' },
	{ id: 'textile', label: 'Textile' },
	{ id: 'leather', label: 'Leather' },
	{ id: 'synthetic-paper', label: 'Synthetic & Paper' }
] as const;

export type MaterialFamilyId = (typeof materialFamilies)[number]['id'];

const familyByPrefix: Readonly<Record<string, MaterialFamilyId>> = {
	wood: 'wood',
	stone: 'stone',
	masonry: 'masonry',
	plaster: 'plaster-concrete',
	concrete: 'plaster-concrete',
	tile: 'tile-ceramic',
	metal: 'metal',
	textile: 'textile',
	leather: 'leather',
	synthetic: 'synthetic-paper',
	paper: 'synthetic-paper'
};

/** A curated entry's family, read from its id's leading word; null for an entry outside the taxonomy. */
export function materialFamilyOf(id: MaterialId): MaterialFamilyId | null {
	return familyByPrefix[id.split('-', 1)[0] ?? ''] ?? null;
}

/** Entries grouped by family in taxonomy order, each group in catalogue order; an unknown family closes the list as "Other". */
export function groupByMaterialFamily<T extends { readonly id: MaterialId }>(
	entries: readonly T[]
): { readonly id: MaterialFamilyId | 'other'; readonly label: string; readonly entries: readonly T[] }[] {
	const groups = [...materialFamilies, { id: 'other', label: 'Other' } as const].map((family) => ({
		id: family.id,
		label: family.label,
		entries: entries.filter((entry) => (materialFamilyOf(entry.id) ?? 'other') === family.id)
	}));
	return groups.filter((group) => group.entries.length > 0);
}
