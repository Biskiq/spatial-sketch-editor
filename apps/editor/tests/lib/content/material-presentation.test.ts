import { describe, expect, it } from 'vitest';
import { materials, materialById } from '$lib/content/materials';
import {
	foldVariantCards,
	groupByMaterialFamily,
	materialFamilyOf,
	materialVariantCards,
	variantCardOf
} from '$lib/content/material-presentation';
import type { MaterialId } from '$lib/types/materials';
import { catalogueRenderFacts } from '@portfolio/project-model/materials';

describe('D1 variant cards', () => {
	it('folds Smooth and Polished concrete into one card with a Matte/Polished chip', () => {
		const card = variantCardOf('concrete-polished');
		expect(card).toBe(variantCardOf('concrete-smooth'));
		expect(card).toMatchObject({ primary: 'concrete-smooth', label: 'Concrete' });
		expect(card!.variants.map((variant) => variant.label)).toEqual(['Matte', 'Polished']);
	});

	it('only folds real catalogue entries, each into one card', () => {
		const seen = new Set<string>();
		for (const card of materialVariantCards) {
			for (const variant of card.variants) {
				expect(materialById.has(variant.id), variant.id).toBe(true);
				expect(seen.has(variant.id), `${variant.id} is in two cards`).toBe(false);
				seen.add(variant.id);
			}
			expect(card.variants.some((variant) => variant.id === card.primary)).toBe(true);
		}
	});

	it('keeps every variant a distinct catalogue entry with its own identity', () => {
		// The card is presentation: both entries still exist, with their own Finish recipe.
		expect(materials.map((m) => m.id)).toEqual(expect.arrayContaining(['concrete-smooth', 'concrete-polished']));
		const smooth = catalogueRenderFacts('concrete-smooth');
		const polished = catalogueRenderFacts('concrete-polished');
		expect(smooth).toBeDefined();
		expect(polished).toBeDefined();
		expect(JSON.stringify(smooth)).not.toBe(JSON.stringify(polished));
	});

	it('leaves every other entry a card of its own', () => {
		for (const material of materials) {
			if (material.id === 'concrete-smooth' || material.id === 'concrete-polished') continue;
			expect(variantCardOf(material.id), material.id).toBeUndefined();
		}
	});
});

describe('D1 folding and families, shared by the Library shelf and the Paint tray', () => {
	const entries = (['wood-oak-planks', 'concrete-smooth', 'concrete-polished', 'metal-gold-satin'] as MaterialId[]).map((id) => ({ id }));

	it('shows the chosen variant in the primary’s place and drops the others', () => {
		expect(foldVariantCards(entries).map((card) => card.id)).toEqual(['wood-oak-planks', 'concrete-smooth', 'metal-gold-satin']);
		const folded = foldVariantCards(entries, () => 'concrete-polished');
		expect(folded[1]).toMatchObject({ id: 'concrete-polished', cardLabel: 'Concrete' });
	});

	it('never lets a choice outside the card replace its picture', () => {
		const folded = foldVariantCards(entries, () => 'wood-oak-planks');
		expect(folded.map((card) => card.id)).toEqual(['wood-oak-planks', 'concrete-smooth', 'metal-gold-satin']);
	});

	it('places every curated entry in a family, in taxonomy order', () => {
		for (const material of materials) {
			if (material.id.startsWith('pbr-')) continue;
			if (!['plaster-warm', 'wood-walnut', 'brass-aged', 'marble-light', 'velvet-dark', 'paper-aged'].includes(material.id)) {
				expect(materialFamilyOf(material.id), material.id).not.toBeNull();
			}
		}
		const groups = groupByMaterialFamily([{ id: 'metal-gold-satin' }, { id: 'concrete-smooth' }, { id: 'pbr-neutral-v1' }] as { id: MaterialId }[]);
		expect(groups.map((group) => group.id)).toEqual(['plaster-concrete', 'metal', 'other']);
	});
});
