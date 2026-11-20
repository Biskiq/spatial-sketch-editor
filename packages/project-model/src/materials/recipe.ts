/**
 * Canonical recipe bytes and identity.
 *
 * The identity of a material definition is a pure function of the normalized
 * recipe: sorted object keys, no trailing newline, arrays in authored order.
 * Display names, palette slot ids, project ids, transport paths and local
 * texture ids are not part of it, so the same recipe in two projects — with
 * different local image ids — has one digest.
 *
 * The hash primitive is the repository's landed `sha256Bytes`; this module does
 * not define a second implementation. Because it uses Web Crypto only, Node and
 * a browser produce the same digest for the same canonical bytes.
 */
import { sha256Bytes } from '../package-sha';
import { canonicalUnitJson } from '../units/canonical';
import type { Hash, Mapping, Recipe } from './types';
import { readRecipe, type RecipeReadResult } from './read';

/** The neutral recipe every absent value resolves to. */
const NEUTRAL_RECIPE_INPUT = {
	profile: 'pbr-metallic-roughness/v1',
	color: '#ffffff',
	roughness: 0.5,
	metalness: 0,
	occlusionStrength: 1,
	normalScale: 1,
	mapping: {
		kind: 'target',
		metric: {
			tileMeters: [1, 1],
			rotation: 0,
			offset: [0, 0]
		}
	},
	maps: {}
} as const;

function buildNeutralRecipe(): Recipe {
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

/** Canonical UTF-8 bytes of a normalized recipe. */
export function canonicalRecipeBytes(recipe: Recipe): Uint8Array {
	return new TextEncoder().encode(canonicalUnitJson(recipe));
}

/** Canonical JSON text of a normalized recipe, with sorted keys. */
export function canonicalRecipeJson(recipe: Recipe): string {
	return canonicalUnitJson(recipe);
}

/** The recipe revision: `sha256Bytes` over its canonical UTF-8 bytes. */
export async function recipeHash(recipe: Recipe): Promise<Hash> {
	return sha256Bytes(canonicalRecipeBytes(recipe));
}

/** Read and hash one recipe in a single result. */
export async function readRecipeWithHash(
	input: unknown
): Promise<
	| { readonly success: true; readonly recipe: Recipe; readonly hash: Hash }
	| Extract<RecipeReadResult, { readonly success: false }>
> {
	const read = readRecipe(input);
	if (!read.success) return read;
	return { success: true, recipe: read.recipe, hash: await recipeHash(read.recipe) };
}

/**
 * The metric UV repeat for one surface: surface metres divided by one tile's
 * metres, with the established 0.01 lower bound on both the tile and the
 * result. This is the same calculation the editor catalogue has always used.
 */
export function materialMetricRepeat(
	surfaceMeters: readonly [number, number],
	tileMeters: readonly [number, number]
): [number, number] {
	return [
		Math.max(0.01, surfaceMeters[0] / Math.max(0.01, tileMeters[0])),
		Math.max(0.01, surfaceMeters[1] / Math.max(0.01, tileMeters[1]))
	];
}

/** The effective mapping of one binding: its own, or the set mapping. */
export function mappingOfBinding(
	binding: { readonly mapping?: Mapping } | undefined,
	setMapping: Mapping
): Mapping | undefined {
	if (binding === undefined) return undefined;
	return binding.mapping ?? setMapping;
}
