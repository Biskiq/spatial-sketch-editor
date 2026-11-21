/**
 * The persisted material definition beside its local image mappings.
 *
 * A definition is the immutable pair a resource stores:
 *
 * - one canonical recipe, whose map bindings are content digests; and
 * - exactly one local source per digest, sorted by digest.
 *
 * The reader refuses rather than repairs: an extra image with no recipe role, a
 * missing role, a duplicate digest, a malformed local image or an unknown key is
 * a structural defect. The definition cannot name a second source for one
 * digest, because a digest is the content identity and two answers for it would
 * be ambiguous after a copy.
 */
import { dedupeMaterialIssues, type MaterialIssue } from './issues';
import { deepFreeze } from './immutable';
import { readRecipe, type RecipeReadResult } from './read';
import {
	MATERIAL_MAP_ROLES,
	type Hash,
	type LocalImage,
	type MapRole,
	type Recipe
} from './types';

export type MaterialResourceImage = {
	readonly hash: Hash;
	readonly source: LocalImage;
};

export type MaterialDefinition = {
	readonly recipe: Recipe;
	/** Unique by hash, sorted ascending, exactly covering the recipe digests. */
	readonly images: readonly MaterialResourceImage[];
};

export type MaterialDefinitionReadResult =
	| { readonly success: true; readonly definition: MaterialDefinition }
	| { readonly success: false; readonly issues: readonly MaterialIssue[] };

const DEFINITION_KEYS = ['recipe', 'images'] as const;
const IMAGE_KEYS = ['hash', 'source'] as const;
const SOURCE_KEYS = ['textureId', 'shipped'] as const;
const OPAQUE_ID = /^[^\s]+$/;

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isHash(value: unknown): value is Hash {
	return typeof value === 'string' && /^sha256-[0-9a-f]{64}$/.test(value);
}

function readLocalImage(
	input: unknown,
	path: string,
	issues: MaterialIssue[]
): LocalImage | null {
	if (!isRecord(input)) {
		issues.push({ code: 'invalid-local-image', path, action: 'Use one textureId or one shipped URI.' });
		return null;
	}
	const keys = Object.keys(input);
	const unknown = keys.filter((key) => !(SOURCE_KEYS as readonly string[]).includes(key));
	if (unknown.length > 0) {
		issues.push({ code: 'unknown-key', path: `${path}.${unknown[0]}`, action: 'Remove the unsupported field.' });
		return null;
	}
	const hasTexture = 'textureId' in input;
	const hasShipped = 'shipped' in input;
	if (hasTexture === hasShipped) {
		issues.push({ code: 'wrong-role-selector', path, action: 'Use exactly one of textureId or shipped.' });
		return null;
	}
	const value = hasTexture ? input.textureId : input.shipped;
	if (typeof value !== 'string' || value.length === 0 || !OPAQUE_ID.test(value)) {
		issues.push({
			code: 'invalid-local-image',
			path: hasTexture ? `${path}.textureId` : `${path}.shipped`,
			action: 'Use a stable local identity without whitespace.'
		});
		return null;
	}
	return hasTexture ? { textureId: value } : { shipped: value };
}

/** The exact set of map digests one recipe binds, with the role that names it. */
export function recipeImageDigests(recipe: Recipe): Map<Hash, readonly MapRole[]> {
	const byHash = new Map<Hash, MapRole[]>();
	for (const role of MATERIAL_MAP_ROLES) {
		const binding = recipe.maps[role];
		if (binding === undefined) continue;
		const roles = byHash.get(binding.image) ?? [];
		roles.push(role);
		byHash.set(binding.image, roles);
	}
	return byHash;
}

/**
 * Strict read of one persisted definition.
 *
 * `contentRevision` is not checked here because the recipe's identity is its
 * canonical bytes, and only the asynchronous digest boundary can recompute those.
 * The structural reader checks everything else, including exact coverage.
 */
export function readMaterialDefinition(input: unknown): MaterialDefinitionReadResult {
	const issues: MaterialIssue[] = [];
	if (!isRecord(input)) {
		return {
			success: false,
			issues: [{ code: 'invalid-type', path: '$', action: 'Use a material definition object.' }]
		};
	}
	for (const key of Object.keys(input)) {
		if (!(DEFINITION_KEYS as readonly string[]).includes(key)) {
			issues.push({ code: 'unknown-key', path: `$.${key}`, action: 'Remove the unsupported field.' });
		}
	}
	const recipeRead: RecipeReadResult = readRecipe(input.recipe);
	if (!recipeRead.success) {
		issues.push(...recipeRead.issues.map((issue) => ({ ...issue, path: `$.recipe${issue.path.slice(1)}` })));
		return { success: false, issues: dedupeMaterialIssues(issues) };
	}
	const recipe = recipeRead.recipe;
	if (!Array.isArray(input.images)) {
		issues.push({ code: 'invalid-type', path: '$.images', action: 'Use an array of image mappings.' });
		return { success: false, issues: dedupeMaterialIssues(issues) };
	}
	const images: MaterialResourceImage[] = [];
	const seen = new Set<Hash>();
	for (const [index, value] of input.images.entries()) {
		const path = `$.images[${index}]`;
		if (!isRecord(value)) {
			issues.push({ code: 'invalid-type', path, action: 'Use an image mapping.' });
			continue;
		}
		for (const key of Object.keys(value)) {
			if (!(IMAGE_KEYS as readonly string[]).includes(key)) {
				issues.push({ code: 'unknown-key', path: `${path}.${key}`, action: 'Remove the unsupported field.' });
			}
		}
		if (!isHash(value.hash)) {
			issues.push({ code: 'invalid-hash', path: `${path}.hash`, action: 'Use a lowercase sha256-<64 hex> digest.' });
			continue;
		}
		const source = readLocalImage(value.source, `${path}.source`, issues);
		if (source === null) continue;
		if (seen.has(value.hash)) {
			issues.push({
				code: 'duplicate-image',
				path: `${path}.hash`,
				action: 'Keep exactly one local source per digest.'
			});
			continue;
		}
		seen.add(value.hash);
		images.push({ hash: value.hash, source });
	}
	const required = recipeImageDigests(recipe);
	for (const hash of required.keys()) {
		if (!seen.has(hash)) {
			issues.push({
				code: 'missing-image',
				path: '$.images',
				action: 'Map every recipe digest to one verified local image.'
			});
		}
	}
	for (const hash of seen) {
		if (!required.has(hash)) {
			issues.push({
				code: 'definition-image-coverage',
				path: '$.images',
				action: 'Remove the image mapping no recipe role names.'
			});
		}
	}
	if (issues.length > 0) return { success: false, issues: dedupeMaterialIssues(issues) };
	const sorted = [...images].sort((left, right) => (left.hash < right.hash ? -1 : left.hash > right.hash ? 1 : 0));
	const definition: MaterialDefinition = deepFreeze({ recipe, images: sorted });
	return { success: true, definition };
}
