/**
 * Canonical shipped-static compatibility registry.
 *
 * Stable logical identities for built-in catalogue/model/material resources,
 * keyed by logical URI / asset ID — never by bundler hash URLs. A shipped
 * resource referenced by an existing release may not be removed or renamed
 * without retaining a compatible mapping/file. The registry is append-only.
 *
 * Shared by the editor cold-visitor runtime and the API publication validator
 * so both sides agree on exactly which static resources a release may pin.
 * Deliberately dependency-free: no catalogue reads, so an existing release
 * keeps validating after a later catalogue or deploy change. Placeholder
 * assets are listed as fallback-only (no bytes).
 */

export type ShippedTextureEntry = {
	logicalUri: string;
	deployedPath: string;
	required: boolean;
};

export const SHIPPED_TEXTURES: readonly ShippedTextureEntry[] = [
	{
		logicalUri: '/textures/plaster-warm/map.png',
		deployedPath: 'textures/plaster-warm/map.png',
		required: true,
	},
	{
		logicalUri: '/textures/plaster-warm/roughness.png',
		deployedPath: 'textures/plaster-warm/roughness.png',
		required: true,
	},
	{
		logicalUri: '/textures/wood-walnut/map.png',
		deployedPath: 'textures/wood-walnut/map.png',
		required: true,
	},
	{
		logicalUri: '/textures/wood-walnut/roughness.png',
		deployedPath: 'textures/wood-walnut/roughness.png',
		required: true,
	},
	{
		logicalUri: '/textures/brass-aged/map.png',
		deployedPath: 'textures/brass-aged/map.png',
		required: true,
	},
	// T2.S8 F curated catalogue: qualified WebP derivatives.
	{
		logicalUri: '/textures/wood-oak-veneer/color.webp',
		deployedPath: 'textures/wood-oak-veneer/color.webp',
		required: true,
	},
	{
		logicalUri: '/textures/wood-oak-veneer/normal.webp',
		deployedPath: 'textures/wood-oak-veneer/normal.webp',
		required: true,
	},
	{
		logicalUri: '/textures/wood-oak-veneer/orm.webp',
		deployedPath: 'textures/wood-oak-veneer/orm.webp',
		required: true,
	},
	{
		logicalUri: '/textures/wood-walnut-veneer/color.webp',
		deployedPath: 'textures/wood-walnut-veneer/color.webp',
		required: true,
	},
	{
		logicalUri: '/textures/wood-walnut-veneer/normal.webp',
		deployedPath: 'textures/wood-walnut-veneer/normal.webp',
		required: true,
	},
	{
		logicalUri: '/textures/wood-walnut-veneer/orm.webp',
		deployedPath: 'textures/wood-walnut-veneer/orm.webp',
		required: true,
	},
	{
		logicalUri: '/textures/wood-oak-planks/color.webp',
		deployedPath: 'textures/wood-oak-planks/color.webp',
		required: true,
	},
	{
		logicalUri: '/textures/wood-oak-planks/normal.webp',
		deployedPath: 'textures/wood-oak-planks/normal.webp',
		required: true,
	},
	{
		logicalUri: '/textures/wood-oak-planks/orm.webp',
		deployedPath: 'textures/wood-oak-planks/orm.webp',
		required: true,
	},
	{
		logicalUri: '/textures/wood-herringbone-parquet/color.webp',
		deployedPath: 'textures/wood-herringbone-parquet/color.webp',
		required: true,
	},
	{
		logicalUri: '/textures/wood-herringbone-parquet/normal.webp',
		deployedPath: 'textures/wood-herringbone-parquet/normal.webp',
		required: true,
	},
	{
		logicalUri: '/textures/wood-herringbone-parquet/orm.webp',
		deployedPath: 'textures/wood-herringbone-parquet/orm.webp',
		required: true,
	},
	{
		logicalUri: '/textures/stone-terrazzo/color.webp',
		deployedPath: 'textures/stone-terrazzo/color.webp',
		required: true,
	},
	{
		logicalUri: '/textures/stone-terrazzo/normal.webp',
		deployedPath: 'textures/stone-terrazzo/normal.webp',
		required: true,
	},
	{
		logicalUri: '/textures/stone-terrazzo/orm.webp',
		deployedPath: 'textures/stone-terrazzo/orm.webp',
		required: true,
	},
	{
		logicalUri: '/textures/masonry-brick-red/color.webp',
		deployedPath: 'textures/masonry-brick-red/color.webp',
		required: true,
	},
	{
		logicalUri: '/textures/masonry-brick-red/normal.webp',
		deployedPath: 'textures/masonry-brick-red/normal.webp',
		required: true,
	},
	{
		logicalUri: '/textures/masonry-brick-red/orm.webp',
		deployedPath: 'textures/masonry-brick-red/orm.webp',
		required: true,
	},
	{
		logicalUri: '/textures/plaster-painted/color.webp',
		deployedPath: 'textures/plaster-painted/color.webp',
		required: true,
	},
	{
		logicalUri: '/textures/plaster-painted/normal.webp',
		deployedPath: 'textures/plaster-painted/normal.webp',
		required: true,
	},
	{
		logicalUri: '/textures/plaster-painted/orm.webp',
		deployedPath: 'textures/plaster-painted/orm.webp',
		required: true,
	},
	{
		logicalUri: '/textures/concrete-smooth/color.webp',
		deployedPath: 'textures/concrete-smooth/color.webp',
		required: true,
	},
	{
		logicalUri: '/textures/concrete-smooth/normal.webp',
		deployedPath: 'textures/concrete-smooth/normal.webp',
		required: true,
	},
	{
		logicalUri: '/textures/concrete-smooth/orm.webp',
		deployedPath: 'textures/concrete-smooth/orm.webp',
		required: true,
	},
	{
		logicalUri: '/textures/tile-ceramic-white/color.webp',
		deployedPath: 'textures/tile-ceramic-white/color.webp',
		required: true,
	},
	{
		logicalUri: '/textures/tile-ceramic-white/normal.webp',
		deployedPath: 'textures/tile-ceramic-white/normal.webp',
		required: true,
	},
	{
		logicalUri: '/textures/tile-ceramic-white/orm.webp',
		deployedPath: 'textures/tile-ceramic-white/orm.webp',
		required: true,
	},
	{
		logicalUri: '/textures/metal-satin/normal.webp',
		deployedPath: 'textures/metal-satin/normal.webp',
		required: true,
	},
	{
		logicalUri: '/textures/metal-satin/orm.webp',
		deployedPath: 'textures/metal-satin/orm.webp',
		required: true,
	},
	{
		logicalUri: '/textures/metal-brushed/normal.webp',
		deployedPath: 'textures/metal-brushed/normal.webp',
		required: true,
	},
	{
		logicalUri: '/textures/metal-brushed/orm.webp',
		deployedPath: 'textures/metal-brushed/orm.webp',
		required: true,
	},
	{
		logicalUri: '/textures/textile-linen/color.webp',
		deployedPath: 'textures/textile-linen/color.webp',
		required: true,
	},
	{
		logicalUri: '/textures/textile-linen/normal.webp',
		deployedPath: 'textures/textile-linen/normal.webp',
		required: true,
	},
	{
		logicalUri: '/textures/textile-linen/orm.webp',
		deployedPath: 'textures/textile-linen/orm.webp',
		required: true,
	},
	{
		logicalUri: '/textures/textile-carpet-loop/color.webp',
		deployedPath: 'textures/textile-carpet-loop/color.webp',
		required: true,
	},
	{
		logicalUri: '/textures/textile-carpet-loop/normal.webp',
		deployedPath: 'textures/textile-carpet-loop/normal.webp',
		required: true,
	},
	{
		logicalUri: '/textures/textile-carpet-loop/orm.webp',
		deployedPath: 'textures/textile-carpet-loop/orm.webp',
		required: true,
	},
	{
		logicalUri: '/textures/leather-smooth/color.webp',
		deployedPath: 'textures/leather-smooth/color.webp',
		required: true,
	},
	{
		logicalUri: '/textures/leather-smooth/normal.webp',
		deployedPath: 'textures/leather-smooth/normal.webp',
		required: true,
	},
	{
		logicalUri: '/textures/leather-smooth/orm.webp',
		deployedPath: 'textures/leather-smooth/orm.webp',
		required: true,
	},
	{
		logicalUri: '/textures/synthetic-plastic-matte/color.webp',
		deployedPath: 'textures/synthetic-plastic-matte/color.webp',
		required: true,
	},
	{
		logicalUri: '/textures/synthetic-plastic-matte/normal.webp',
		deployedPath: 'textures/synthetic-plastic-matte/normal.webp',
		required: true,
	},
	{
		logicalUri: '/textures/synthetic-plastic-matte/orm.webp',
		deployedPath: 'textures/synthetic-plastic-matte/orm.webp',
		required: true,
	},
	{
		logicalUri: '/textures/stone-travertine/color.webp',
		deployedPath: 'textures/stone-travertine/color.webp',
		required: true,
	},
	{
		logicalUri: '/textures/stone-travertine/normal.webp',
		deployedPath: 'textures/stone-travertine/normal.webp',
		required: true,
	},
	{
		logicalUri: '/textures/stone-travertine/orm.webp',
		deployedPath: 'textures/stone-travertine/orm.webp',
		required: true,
	},
];

const SHIPPED_TEXTURE_SET = new Set(SHIPPED_TEXTURES.map((entry) => entry.logicalUri));

export type ShippedModelEntry = {
	assetId: string;
	/** Deployed static file, or null for fallback-only placeholders (no bytes). */
	productionFile: string | null;
	fallbackOnly: boolean;
};

export const SHIPPED_MODELS: readonly ShippedModelEntry[] = [
	{
		assetId: 'paris-grand-piano',
		productionFile: '/museum/models/piano/grand-piano.glb',
		fallbackOnly: false,
	},
	{
		assetId: 'paris-salon-chair',
		productionFile: '/museum/models/furniture/chair/salon-chair.glb',
		fallbackOnly: false,
	},
	{
		assetId: 'paris-salon-sofa',
		productionFile: '/museum/models/furniture/sofa/sofa-03.glb',
		fallbackOnly: false,
	},
	{
		assetId: 'paris-salon-table',
		productionFile: '/museum/models/furniture/table/salon-table.glb',
		fallbackOnly: false,
	},
	{
		assetId: 'paris-chandelier',
		productionFile: '/museum/models/decor/chandelier/chandelier2.glb',
		fallbackOnly: false,
	},
	{
		assetId: 'paris-table-lamp',
		productionFile: '/museum/models/decor/oil-lamp/victorian-oil-lamp.glb',
		fallbackOnly: false,
	},
	{
		assetId: 'paris-grandfather-clock',
		productionFile: '/museum/models/decor/clock/grandfather-clock.glb',
		fallbackOnly: false,
	},
	{ assetId: 'paris-writing-desk', productionFile: null, fallbackOnly: true },
	{ assetId: 'paris-portrait-frame', productionFile: null, fallbackOnly: true },
	{ assetId: 'paris-book', productionFile: null, fallbackOnly: true },
	{ assetId: 'paris-salon-rug', productionFile: null, fallbackOnly: true },
];

const SHIPPED_MODEL_BY_ASSET = new Map(SHIPPED_MODELS.map((entry) => [entry.assetId, entry]));
const SHIPPED_MODEL_FILES = new Set(
	SHIPPED_MODELS.map((entry) => entry.productionFile).filter(
		(file): file is string => file !== null,
	),
);

export type ShippedMaterialEntry = {
	id: string;
	/** Catalogue texture URIs implied by this material (subset of SHIPPED_TEXTURES). */
	textureUris: readonly string[];
};

export const SHIPPED_MATERIALS: readonly ShippedMaterialEntry[] = [
	{
		id: 'plaster-warm',
		textureUris: ['/textures/plaster-warm/map.png', '/textures/plaster-warm/roughness.png'],
	},
	{
		id: 'wood-walnut',
		textureUris: ['/textures/wood-walnut/map.png', '/textures/wood-walnut/roughness.png'],
	},
	{ id: 'brass-aged', textureUris: ['/textures/brass-aged/map.png'] },
	{ id: 'marble-light', textureUris: [] },
	{ id: 'velvet-dark', textureUris: [] },
	{ id: 'paper-aged', textureUris: [] },
	// T2.S8 F curated catalogue.
	{
		id: 'wood-oak-veneer',
		textureUris: [
			'/textures/wood-oak-veneer/color.webp',
			'/textures/wood-oak-veneer/normal.webp',
			'/textures/wood-oak-veneer/orm.webp',
		],
	},
	{
		id: 'wood-walnut-veneer',
		textureUris: [
			'/textures/wood-walnut-veneer/color.webp',
			'/textures/wood-walnut-veneer/normal.webp',
			'/textures/wood-walnut-veneer/orm.webp',
		],
	},
	{
		id: 'wood-oak-planks',
		textureUris: [
			'/textures/wood-oak-planks/color.webp',
			'/textures/wood-oak-planks/normal.webp',
			'/textures/wood-oak-planks/orm.webp',
		],
	},
	{
		id: 'wood-herringbone-parquet',
		textureUris: [
			'/textures/wood-herringbone-parquet/color.webp',
			'/textures/wood-herringbone-parquet/normal.webp',
			'/textures/wood-herringbone-parquet/orm.webp',
		],
	},
	{
		id: 'stone-travertine',
		textureUris: [
			'/textures/stone-travertine/color.webp',
			'/textures/stone-travertine/normal.webp',
			'/textures/stone-travertine/orm.webp',
		],
	},
	{
		id: 'stone-terrazzo',
		textureUris: [
			'/textures/stone-terrazzo/color.webp',
			'/textures/stone-terrazzo/normal.webp',
			'/textures/stone-terrazzo/orm.webp',
		],
	},
	{
		id: 'masonry-brick-red',
		textureUris: [
			'/textures/masonry-brick-red/color.webp',
			'/textures/masonry-brick-red/normal.webp',
			'/textures/masonry-brick-red/orm.webp',
		],
	},
	{
		id: 'plaster-painted',
		textureUris: [
			'/textures/plaster-painted/color.webp',
			'/textures/plaster-painted/normal.webp',
			'/textures/plaster-painted/orm.webp',
		],
	},
	{
		id: 'concrete-smooth',
		textureUris: [
			'/textures/concrete-smooth/color.webp',
			'/textures/concrete-smooth/normal.webp',
			'/textures/concrete-smooth/orm.webp',
		],
	},
	{
		id: 'concrete-polished',
		textureUris: [
			'/textures/concrete-smooth/color.webp',
			'/textures/concrete-smooth/normal.webp',
			'/textures/concrete-smooth/orm.webp',
		],
	},
	{
		id: 'tile-ceramic-white',
		textureUris: [
			'/textures/tile-ceramic-white/color.webp',
			'/textures/tile-ceramic-white/normal.webp',
			'/textures/tile-ceramic-white/orm.webp',
		],
	},
	{
		id: 'metal-stainless-satin',
		textureUris: ['/textures/metal-satin/normal.webp', '/textures/metal-satin/orm.webp'],
	},
	{
		id: 'metal-brass-satin',
		textureUris: ['/textures/metal-satin/normal.webp', '/textures/metal-satin/orm.webp'],
	},
	{
		id: 'metal-copper-satin',
		textureUris: ['/textures/metal-satin/normal.webp', '/textures/metal-satin/orm.webp'],
	},
	{
		id: 'metal-gold-satin',
		textureUris: ['/textures/metal-satin/normal.webp', '/textures/metal-satin/orm.webp'],
	},
	{
		id: 'metal-stainless-brushed',
		textureUris: ['/textures/metal-brushed/normal.webp', '/textures/metal-brushed/orm.webp'],
	},
	{
		id: 'metal-aluminium-brushed',
		textureUris: ['/textures/metal-brushed/normal.webp', '/textures/metal-brushed/orm.webp'],
	},
	{
		id: 'textile-linen',
		textureUris: [
			'/textures/textile-linen/color.webp',
			'/textures/textile-linen/normal.webp',
			'/textures/textile-linen/orm.webp',
		],
	},
	{
		id: 'textile-carpet-loop',
		textureUris: [
			'/textures/textile-carpet-loop/color.webp',
			'/textures/textile-carpet-loop/normal.webp',
			'/textures/textile-carpet-loop/orm.webp',
		],
	},
	{
		id: 'leather-cognac',
		textureUris: [
			'/textures/leather-smooth/color.webp',
			'/textures/leather-smooth/normal.webp',
			'/textures/leather-smooth/orm.webp',
		],
	},
	{
		id: 'synthetic-plastic-matte',
		textureUris: [
			'/textures/synthetic-plastic-matte/color.webp',
			'/textures/synthetic-plastic-matte/normal.webp',
			'/textures/synthetic-plastic-matte/orm.webp',
		],
	},
];

const SHIPPED_MATERIAL_BY_ID = new Map(SHIPPED_MATERIALS.map((entry) => [entry.id, entry]));

const SHIPPED_FALLBACKS = new Set([
	'piano',
	'chair',
	'sofa',
	'table',
	'chandelier',
	'desk',
	'lamp',
	'frame',
	'books',
	'clock',
	'rug',
]);

export function isAllowedShippedTextureUri(uri: string): boolean {
	return SHIPPED_TEXTURE_SET.has(uri);
}

export function isAllowedShippedModelFile(path: string): boolean {
	return SHIPPED_MODEL_FILES.has(path);
}

export function getShippedModelByAssetId(assetId: string): ShippedModelEntry | undefined {
	return SHIPPED_MODEL_BY_ASSET.get(assetId);
}

export function getShippedMaterialById(id: string): ShippedMaterialEntry | undefined {
	return SHIPPED_MATERIAL_BY_ID.get(id);
}

export function isKnownShippedAssetId(assetId: string): boolean {
	return SHIPPED_MODEL_BY_ASSET.has(assetId);
}

export function isKnownShippedMaterialId(id: string): boolean {
	return SHIPPED_MATERIAL_BY_ID.has(id);
}

export function isShippedFallback(value: unknown): boolean {
	return typeof value === 'string' && SHIPPED_FALLBACKS.has(value);
}

export function listShippedTextureUris(): string[] {
	return SHIPPED_TEXTURES.map((entry) => entry.logicalUri);
}

export function listShippedModelFiles(): string[] {
	return [...SHIPPED_MODEL_FILES];
}

export function listShippedAssetIds(): string[] {
	return SHIPPED_MODELS.map((entry) => entry.assetId);
}

export function listShippedMaterialIds(): string[] {
	return SHIPPED_MATERIALS.map((entry) => entry.id);
}
