/** The frozen neutral recipe, kept in a leaf module so every consumer can
 * initialise it without a catalogue/recipe cycle. */
import { readRecipe } from './read';
import type { Recipe } from './types';

const NEUTRAL_RECIPE_INPUT = {
	profile: 'pbr-metallic-roughness/v1',
	color: '#ffffff',
	roughness: 0.5,
	metalness: 0,
	occlusionStrength: 1,
	normalScale: 1,
	mapping: {
		kind: 'target',
		metric: { tileMeters: [1, 1], rotation: 0, offset: [0, 0] }
	},
	maps: {}
} as const;

export function buildNeutralRecipe(): Recipe {
	const read = readRecipe(NEUTRAL_RECIPE_INPUT);
	if (!read.success) {
		throw new Error(`the neutral material recipe is invalid: ${JSON.stringify(read.issues)}`);
	}
	return read.recipe;
}

/** The frozen neutral recipe: white, 0.5 roughness, not metal, 1 m target tile. */
export const NEUTRAL_RECIPE: Recipe = buildNeutralRecipe();

/**
 * The hash oracle. The neutral recipe must produce exactly this digest; a
 * canonicalization change that moves it is a contract change, not a cleanup.
 */
export const NEUTRAL_RECIPE_HASH =
	'sha256-ce95db1ce6fb2381d7ff4542e05f83b857599e8dc673ca01d082cfc129c973bc' as const;