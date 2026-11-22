import { describe, expect, it } from 'vitest';
import { materials, materialById } from '$lib/content/materials';
import { materialVariantCards, variantCardOf } from '$lib/content/material-presentation';
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
