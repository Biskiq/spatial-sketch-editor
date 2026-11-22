import { describe, expect, it } from 'vitest';
import { materials } from '$lib/content/materials';
import { createFinishAuthoring } from '$lib/authoring/look/finish-authoring.svelte';

describe('Library › Finishes, curated tiles', () => {
	it('carries each shipped thumbnail beside the colour swatch it falls back to', () => {
		const shelf = createFinishAuthoring({
			services: () => null,
			onNotice: () => undefined,
			openFinishes: () => undefined,
			armPaint: () => undefined
		}).libraryShelf();

		expect(shelf.curated.map((tile) => tile.id)).toEqual(materials.map((material) => material.id));
		for (const tile of shelf.curated) {
			expect(tile.thumbnailUri).toMatch(new RegExp(`^/material-thumbnails/${tile.id}-thumb-[0-9a-f]{16}\\.png$`));
			expect(tile.color).toMatch(/^#[0-9a-f]{6}$/);
		}
	});
});
