/**
 * The immutable shipped material catalogue.
 *
 * The catalogue is part of the portable material contract, not of the editor:
 * an API reader, a package reader and the public runtime can qualify a curated
 * base without importing the editor catalogue. The editor's content facade
 * joins names and thumbnails to these records; it does not own their bytes or
 * their meaning.
 *
 * Rules:
 *
 * - a base id is append-only; changing pixels or meaning needs a new id;
 * - a shipped image is keyed by an allowlisted logical URI with its exact
 *   SHA-256, MIME and byte length;
 * - the neutral technical base is frozen and excluded from creator-facing
 *   catalogue counts.
 */
import { deepFreeze } from './immutable';
import { readRecipe } from './read';
import { NEUTRAL_RECIPE } from './recipe';
import {
	MATERIAL_PROFILE,
	MATERIAL_NEUTRAL_BASE_ID,
	type Hash,
	type MapRole,
	type Recipe
} from './types';

export type CatalogueImage = {
	readonly uri: string;
	readonly hash: Hash;
	readonly mime: 'image/png' | 'image/jpeg' | 'image/webp';
	readonly byteSize: number;
};

/**
 * Every shipped image the six curated bases use. `apps/editor/static` verifies
 * these pins at test time; the manifest is the pure, portable copy.
 */
export const SHIPPED_MATERIAL_IMAGES: readonly CatalogueImage[] = deepFreeze([
	{
		uri: '/textures/plaster-warm/map.png',
		hash: 'sha256-fbc560b447dbf80a578ee872d01a47776f041a3a9404603b0f1529664566eec0',
		mime: 'image/png',
		byteSize: 47350
	},
	{
		uri: '/textures/plaster-warm/roughness.png',
		hash: 'sha256-956a35621e1fd853be643bcaf726fd40db671946f80f8475fb5cd60648ca18ec',
		mime: 'image/png',
		byteSize: 61695
	},
	{
		uri: '/textures/wood-walnut/map.png',
		hash: 'sha256-358c89409516f0c020e0ad703ef082666010a00517c68c1667c4d8e885b867f4',
		mime: 'image/png',
		byteSize: 53591
	},
	{
		uri: '/textures/wood-walnut/roughness.png',
		hash: 'sha256-677d806ea44fba6f6d3447b8a0f0c1956b3078e84cf572fd0c444139ac5e7865',
		mime: 'image/png',
		byteSize: 2001
	},
	{
		uri: '/textures/brass-aged/map.png',
		hash: 'sha256-ad73e7b0fec069675ce71f8c0a63734c597d51b6a81d00fa1755dec00c86f271',
		mime: 'image/png',
		byteSize: 76488
	}
] as const);

const IMAGE_BY_URI = new Map(SHIPPED_MATERIAL_IMAGES.map((entry) => [entry.uri, entry]));
const IMAGE_BY_HASH = new Map(SHIPPED_MATERIAL_IMAGES.map((entry) => [entry.hash, entry]));

/** The six creator-facing catalogue ids, in their established order. */
export const CATALOGUE_MATERIAL_IDS = Object.freeze([
	'plaster-warm',
	'wood-walnut',
	'brass-aged',
	'marble-light',
	'velvet-dark',
	'paper-aged'
] as const);

export type CatalogueMaterialId = (typeof CATALOGUE_MATERIAL_IDS)[number];

export type CatalogueMaterial = {
	readonly id: string;
	readonly label: string;
	/** The technical neutral base is not a creator-facing catalogue entry. */
	readonly technical: boolean;
	readonly recipe: Recipe;
};

function recipe(input: {
	readonly color: string;
	readonly roughness: number;
	readonly metalness: number;
	readonly tileMeters: readonly [number, number];
	readonly colorImage?: string;
	readonly roughnessImage?: string;
}): Recipe {
	const colorImage =
		input.colorImage === undefined ? undefined : IMAGE_BY_URI.get(input.colorImage);
	const roughnessImage =
		input.roughnessImage === undefined ? undefined : IMAGE_BY_URI.get(input.roughnessImage);
	if (
		(input.colorImage !== undefined && colorImage === undefined) ||
		(input.roughnessImage !== undefined && roughnessImage === undefined)
	) {
		throw new Error('a catalogue recipe names an unknown shipped image');
	}
	const read = readRecipe({
		profile: MATERIAL_PROFILE,
		color: input.color,
		roughness: input.roughness,
		metalness: input.metalness,
		occlusionStrength: 1,
		normalScale: 1,
		mapping: {
			kind: 'target',
			metric: {
				tileMeters: [input.tileMeters[0], input.tileMeters[1]],
				rotation: 0,
				offset: [0, 0]
			}
		},
		maps: {
			...(colorImage === undefined ? {} : { color: { image: colorImage.hash } }),
			...(roughnessImage === undefined
				? {}
				: {
						roughness: {
							image: roughnessImage.hash,
							// The established render slot reads the green channel, as a
							// metallic–roughness map does. The curated images are grayscale, so the
							// reading is unchanged; the channel states the portable meaning.
							component: 'g',
							invert: false
						}
					})
		}
	});
	if (!read.success) {
		throw new Error(`catalogue recipe is invalid: ${JSON.stringify(read.issues)}`);
	}
	return read.recipe;
}

const CATALOGUE: readonly CatalogueMaterial[] = deepFreeze([
	{
		id: 'plaster-warm',
		label: 'Warm Plaster',
		technical: false,
		recipe: recipe({
			color: '#c4b4a0',
			roughness: 0.92,
			metalness: 0.02,
			tileMeters: [2, 2],
			colorImage: '/textures/plaster-warm/map.png',
			roughnessImage: '/textures/plaster-warm/roughness.png'
		})
	},
	{
		id: 'wood-walnut',
		label: 'Walnut Wood',
		technical: false,
		recipe: recipe({
			color: '#3d2a1a',
			roughness: 0.78,
			metalness: 0.04,
			tileMeters: [1.5, 1.5],
			colorImage: '/textures/wood-walnut/map.png',
			roughnessImage: '/textures/wood-walnut/roughness.png'
		})
	},
	{
		id: 'brass-aged',
		label: 'Aged Brass',
		technical: false,
		recipe: recipe({
			color: '#d6b35f',
			roughness: 0.45,
			metalness: 0.85,
			tileMeters: [0.5, 0.5],
			colorImage: '/textures/brass-aged/map.png'
		})
	},
	{
		id: 'marble-light',
		label: 'Light Marble',
		technical: false,
		recipe: recipe({ color: '#e8e4dc', roughness: 0.35, metalness: 0.08, tileMeters: [1.2, 1.2] })
	},
	{
		id: 'velvet-dark',
		label: 'Dark Velvet',
		technical: false,
		recipe: recipe({ color: '#3a1822', roughness: 0.95, metalness: 0, tileMeters: [1, 1] })
	},
	{
		id: 'paper-aged',
		label: 'Aged Paper',
		technical: false,
		recipe: recipe({ color: '#e2d2b0', roughness: 0.9, metalness: 0, tileMeters: [0.4, 0.4] })
	},
	{
		id: MATERIAL_NEUTRAL_BASE_ID,
		label: 'Neutral PBR',
		technical: true,
		recipe: NEUTRAL_RECIPE
	}
] as const);

const CATALOGUE_BY_ID = new Map(CATALOGUE.map((entry) => [entry.id, entry]));

/** Every material base id, including the technical neutral base. */
export const CATALOGUE_BASE_IDS: readonly string[] = Object.freeze(CATALOGUE.map((entry) => entry.id));

/** The complete immutable catalogue. */
export function catalogueMaterials(): readonly CatalogueMaterial[] {
	return CATALOGUE;
}

/** One base by id, or `undefined` when the id is not admitted. */
export function catalogueMaterial(id: string): CatalogueMaterial | undefined {
	return CATALOGUE_BY_ID.get(id);
}

/** One base's normalized recipe, or `undefined` for an unknown id. */
export function catalogueRecipe(id: string): Recipe | undefined {
	return CATALOGUE_BY_ID.get(id)?.recipe;
}

/** Whether an id is an admitted catalogue base, including the neutral base. */
export function isCatalogueMaterialId(id: string): boolean {
	return CATALOGUE_BY_ID.has(id);
}

/** The shipped image entry for a logical URI, or `undefined`. */
export function shippedImage(uri: string): CatalogueImage | undefined {
	return IMAGE_BY_URI.get(uri);
}

/** The shipped image entry for a content digest, or `undefined`. */
export function shippedImageByHash(hash: string): CatalogueImage | undefined {
	return IMAGE_BY_HASH.get(hash);
}

/**
 * Plain render facts a catalogue facade can join to labels and thumbnails.
 * The URI is the logical shipped path, never a bundler URL.
 */
export type CatalogueRenderFacts = {
	readonly id: string;
	readonly label: string;
	readonly color: string;
	readonly roughness: number;
	readonly metalness: number;
	readonly defaultTileSizeMeters: readonly [number, number];
	readonly mapUris: Readonly<Partial<Record<MapRole, string>>>;
};

/** The normalized recipe expressed in the editor catalogue's existing terms. */
export function catalogueRenderFacts(id: string): CatalogueRenderFacts | undefined {
	const entry = CATALOGUE_BY_ID.get(id);
	if (entry === undefined) return undefined;
	const mapUris: Partial<Record<MapRole, string>> = {};
	for (const role of ['color', 'normal', 'roughness', 'metalness', 'occlusion'] as const) {
		const binding = entry.recipe.maps[role];
		if (binding === undefined) continue;
		const image = shippedImageByHash(binding.image);
		if (image === undefined) continue;
		mapUris[role] = image.uri;
	}
	const mapping = entry.recipe.mapping;
	const tileMeters = mapping.kind === 'uv' ? ([1, 1] as const) : mapping.metric.tileMeters;
	return deepFreeze({
		id: entry.id,
		label: entry.label,
		color: entry.recipe.color,
		roughness: entry.recipe.roughness,
		metalness: entry.recipe.metalness,
		defaultTileSizeMeters: [tileMeters[0], tileMeters[1]],
		mapUris
	});
}
