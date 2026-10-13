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
	{ logicalUri: '/textures/plaster-warm/map.png', deployedPath: 'textures/plaster-warm/map.png', required: true },
	{ logicalUri: '/textures/plaster-warm/roughness.png', deployedPath: 'textures/plaster-warm/roughness.png', required: true },
	{ logicalUri: '/textures/wood-walnut/map.png', deployedPath: 'textures/wood-walnut/map.png', required: true },
	{ logicalUri: '/textures/wood-walnut/roughness.png', deployedPath: 'textures/wood-walnut/roughness.png', required: true },
	{ logicalUri: '/textures/brass-aged/map.png', deployedPath: 'textures/brass-aged/map.png', required: true }
];

const SHIPPED_TEXTURE_SET = new Set(SHIPPED_TEXTURES.map((entry) => entry.logicalUri));

export type ShippedModelEntry = {
	assetId: string;
	/** Deployed static file, or null for fallback-only placeholders (no bytes). */
	productionFile: string | null;
	fallbackOnly: boolean;
};

export const SHIPPED_MODELS: readonly ShippedModelEntry[] = [
	{ assetId: 'paris-grand-piano', productionFile: '/museum/models/piano/grand-piano.glb', fallbackOnly: false },
	{ assetId: 'paris-salon-chair', productionFile: '/museum/models/furniture/chair/salon-chair.glb', fallbackOnly: false },
	{ assetId: 'paris-salon-sofa', productionFile: '/museum/models/furniture/sofa/sofa-03.glb', fallbackOnly: false },
	{ assetId: 'paris-salon-table', productionFile: '/museum/models/furniture/table/salon-table.glb', fallbackOnly: false },
	{ assetId: 'paris-chandelier', productionFile: '/museum/models/decor/chandelier/chandelier2.glb', fallbackOnly: false },
	{ assetId: 'paris-table-lamp', productionFile: '/museum/models/decor/oil-lamp/victorian-oil-lamp.glb', fallbackOnly: false },
	{ assetId: 'paris-grandfather-clock', productionFile: '/museum/models/decor/clock/grandfather-clock.glb', fallbackOnly: false },
	{ assetId: 'paris-writing-desk', productionFile: null, fallbackOnly: true },
	{ assetId: 'paris-portrait-frame', productionFile: null, fallbackOnly: true },
	{ assetId: 'paris-book', productionFile: null, fallbackOnly: true },
	{ assetId: 'paris-salon-rug', productionFile: null, fallbackOnly: true }
];

const SHIPPED_MODEL_BY_ASSET = new Map(SHIPPED_MODELS.map((entry) => [entry.assetId, entry]));
const SHIPPED_MODEL_FILES = new Set(
	SHIPPED_MODELS.map((entry) => entry.productionFile).filter((file): file is string => file !== null)
);

export type ShippedMaterialEntry = {
	id: string;
	/** Catalogue texture URIs implied by this material (subset of SHIPPED_TEXTURES). */
	textureUris: readonly string[];
};

export const SHIPPED_MATERIALS: readonly ShippedMaterialEntry[] = [
	{ id: 'plaster-warm', textureUris: ['/textures/plaster-warm/map.png', '/textures/plaster-warm/roughness.png'] },
	{ id: 'wood-walnut', textureUris: ['/textures/wood-walnut/map.png', '/textures/wood-walnut/roughness.png'] },
	{ id: 'brass-aged', textureUris: ['/textures/brass-aged/map.png'] },
	{ id: 'marble-light', textureUris: [] },
	{ id: 'velvet-dark', textureUris: [] },
	{ id: 'paper-aged', textureUris: [] }
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
	'rug'
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
