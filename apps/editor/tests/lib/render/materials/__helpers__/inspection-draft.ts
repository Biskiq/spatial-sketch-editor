import type { Recipe } from '@portfolio/project-model/materials';
import type { InspectionDraft } from '$lib/render/materials/inspection-subject';
import { IMAGE_HASH, contentHash, fullRecipe } from '../../../../../../../packages/project-model/tests/materials/fixtures';

/** A provisional draft with one colour image and no real bytes. */
export function inspectionDraft(overrides: Partial<Recipe> = {}): InspectionDraft {
	const hash = IMAGE_HASH.color;
	return {
		name: 'Draft',
		recipe: { ...fullRecipe(), maps: { color: { image: hash } }, ...overrides } as Recipe,
		recipeHash: contentHash('inspection-definition'),
		sources: new Map([
			[hash, { hash, mime: 'image/png', length: 4, read: async () => new Uint8Array(4) }]
		])
	};
}
