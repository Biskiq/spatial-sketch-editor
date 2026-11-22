import { describe, expect, it } from 'vitest';
import { materials } from '$lib/content/materials';
import { createFinishAuthoring } from '$lib/authoring/look/finish-authoring.svelte';

describe('Library › Finishes, curated tiles', () => {
	it('offers colour swatches only until U delivers product thumbnails', () => {
		const shelf = createFinishAuthoring({
			services: () => null,
			onNotice: () => undefined,
			openFinishes: () => undefined,
			armPaint: () => undefined
		}).libraryShelf();

		// Exact objects: E7's engineering reference derivatives are not tile pictures.
		expect(shelf.curated).toStrictEqual(
			materials.map(({ id, label, swatchColor, fallbackColor }) => ({ id, label, color: swatchColor ?? fallbackColor }))
		);
	});
});
