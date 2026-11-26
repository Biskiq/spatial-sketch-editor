import type { MaterialDefinition, MaterialId } from '$lib/types/materials';

/**
 * The creator-facing curated catalogue (T2.S8 F), in shelf order. Every entry
 * joins `catalogueRenderFacts` in `@portfolio/project-model` exactly.
 */
export const materials: MaterialDefinition[] = [
	{
		id: 'wood-oak-veneer',
		label: 'Oak Veneer',
		textures: {
			map: '/textures/wood-oak-veneer/color.webp',
			normalMap: '/textures/wood-oak-veneer/normal.webp',
			roughnessMap: '/textures/wood-oak-veneer/orm.webp',
			aoMap: '/textures/wood-oak-veneer/orm.webp',
		},
		fallbackColor: '#ffffff',
		swatchColor: '#907963',
		roughness: 1,
		metalness: 0,
		defaultTileSizeMeters: [0.5, 0.5],
	},
	{
		id: 'wood-walnut-veneer',
		label: 'Walnut Veneer',
		textures: {
			map: '/textures/wood-walnut-veneer/color.webp',
			normalMap: '/textures/wood-walnut-veneer/normal.webp',
			roughnessMap: '/textures/wood-walnut-veneer/orm.webp',
			aoMap: '/textures/wood-walnut-veneer/orm.webp',
		},
		fallbackColor: '#7a6e63',
		swatchColor: '#4f3828',
		roughness: 1,
		metalness: 0,
		defaultTileSizeMeters: [1.0, 1.0],
	},
	{
		id: 'wood-oak-planks',
		label: 'Oak Plank Floor',
		textures: {
			map: '/textures/wood-oak-planks/color.webp',
			normalMap: '/textures/wood-oak-planks/normal.webp',
			roughnessMap: '/textures/wood-oak-planks/orm.webp',
			aoMap: '/textures/wood-oak-planks/orm.webp',
		},
		fallbackColor: '#ffffff',
		swatchColor: '#816143',
		roughness: 1,
		metalness: 0,
		defaultTileSizeMeters: [1.7, 1.7],
	},
	{
		id: 'wood-herringbone-parquet',
		label: 'Herringbone Parquet',
		textures: {
			map: '/textures/wood-herringbone-parquet/color.webp',
			normalMap: '/textures/wood-herringbone-parquet/normal.webp',
			roughnessMap: '/textures/wood-herringbone-parquet/orm.webp',
			aoMap: '/textures/wood-herringbone-parquet/orm.webp',
		},
		fallbackColor: '#ffffff',
		swatchColor: '#94714e',
		roughness: 1,
		metalness: 0,
		defaultTileSizeMeters: [3.4, 3.4],
	},
	{
		id: 'stone-travertine',
		label: 'Travertine',
		textures: {
			map: '/textures/stone-travertine/color.webp',
			normalMap: '/textures/stone-travertine/normal.webp',
			roughnessMap: '/textures/stone-travertine/orm.webp',
			aoMap: '/textures/stone-travertine/orm.webp',
		},
		fallbackColor: '#ffffff',
		swatchColor: '#e0ccac',
		roughness: 1,
		metalness: 0,
		defaultTileSizeMeters: [1.2, 1.2],
	},
	{
		id: 'stone-terrazzo',
		label: 'Terrazzo',
		textures: {
			map: '/textures/stone-terrazzo/color.webp',
			normalMap: '/textures/stone-terrazzo/normal.webp',
			roughnessMap: '/textures/stone-terrazzo/orm.webp',
		},
		fallbackColor: '#ffffff',
		swatchColor: '#a18f76',
		roughness: 1,
		metalness: 0,
		defaultTileSizeMeters: [0.8, 0.8],
	},
	{
		id: 'masonry-brick-red',
		label: 'Red Brick',
		textures: {
			map: '/textures/masonry-brick-red/color.webp',
			normalMap: '/textures/masonry-brick-red/normal.webp',
			roughnessMap: '/textures/masonry-brick-red/orm.webp',
			aoMap: '/textures/masonry-brick-red/orm.webp',
		},
		fallbackColor: '#ffffff',
		swatchColor: '#6e5a52',
		roughness: 1,
		metalness: 0,
		defaultTileSizeMeters: [1.0, 1.0],
	},
	{
		id: 'plaster-painted',
		label: 'Painted Plaster',
		textures: {
			map: '/textures/plaster-painted/color.webp',
			normalMap: '/textures/plaster-painted/normal.webp',
			roughnessMap: '/textures/plaster-painted/orm.webp',
			aoMap: '/textures/plaster-painted/orm.webp',
		},
		fallbackColor: '#fbfff9',
		swatchColor: '#e7e1d7',
		roughness: 1,
		metalness: 0,
		defaultTileSizeMeters: [2.0, 2.0],
	},
	{
		id: 'concrete-smooth',
		label: 'Smooth Concrete',
		textures: {
			map: '/textures/concrete-smooth/color.webp',
			normalMap: '/textures/concrete-smooth/normal.webp',
			roughnessMap: '/textures/concrete-smooth/orm.webp',
		},
		fallbackColor: '#e7e6ff',
		swatchColor: '#bababa',
		roughness: 1,
		metalness: 0,
		defaultTileSizeMeters: [2.4, 2.4],
	},
	{
		id: 'concrete-polished',
		label: 'Polished Concrete',
		textures: {
			map: '/textures/concrete-smooth/color.webp',
			normalMap: '/textures/concrete-smooth/normal.webp',
			roughnessMap: '/textures/concrete-smooth/orm.webp',
		},
		fallbackColor: '#e7e6ff',
		swatchColor: '#bababa',
		roughness: 0.45,
		metalness: 0,
		defaultTileSizeMeters: [2.4, 2.4],
	},
	{
		id: 'tile-ceramic-white',
		label: 'White Ceramic Tile',
		textures: {
			map: '/textures/tile-ceramic-white/color.webp',
			normalMap: '/textures/tile-ceramic-white/normal.webp',
			roughnessMap: '/textures/tile-ceramic-white/orm.webp',
			aoMap: '/textures/tile-ceramic-white/orm.webp',
		},
		fallbackColor: '#f3f4f0',
		swatchColor: '#edeeea',
		roughness: 1,
		metalness: 0,
		defaultTileSizeMeters: [1.0, 1.0],
	},
	{
		id: 'metal-stainless-satin',
		label: 'Satin Stainless Steel',
		textures: {
			normalMap: '/textures/metal-satin/normal.webp',
			roughnessMap: '/textures/metal-satin/orm.webp',
		},
		fallbackColor: '#d6d1cb',
		swatchColor: '#d6d1cb',
		roughness: 1,
		metalness: 1,
		defaultTileSizeMeters: [0.5, 0.5],
	},
	{
		id: 'metal-brass-satin',
		label: 'Satin Brass',
		textures: {
			normalMap: '/textures/metal-satin/normal.webp',
			roughnessMap: '/textures/metal-satin/orm.webp',
		},
		fallbackColor: '#f5e4ae',
		swatchColor: '#f5e4ae',
		roughness: 1,
		metalness: 1,
		defaultTileSizeMeters: [0.5, 0.5],
	},
	{
		id: 'metal-copper-satin',
		label: 'Satin Copper',
		textures: {
			normalMap: '/textures/metal-satin/normal.webp',
			roughnessMap: '/textures/metal-satin/orm.webp',
		},
		fallbackColor: '#f7cfbf',
		swatchColor: '#f7cfbf',
		roughness: 1,
		metalness: 1,
		defaultTileSizeMeters: [0.5, 0.5],
	},
	{
		id: 'metal-gold-satin',
		label: 'Satin Gold',
		textures: {
			normalMap: '/textures/metal-satin/normal.webp',
			roughnessMap: '/textures/metal-satin/orm.webp',
		},
		fallbackColor: '#ffe496',
		swatchColor: '#ffe496',
		roughness: 1,
		metalness: 1,
		defaultTileSizeMeters: [0.5, 0.5],
	},
	{
		id: 'metal-stainless-brushed',
		label: 'Brushed Stainless Steel',
		textures: {
			normalMap: '/textures/metal-brushed/normal.webp',
			roughnessMap: '/textures/metal-brushed/orm.webp',
		},
		fallbackColor: '#d6d1cb',
		swatchColor: '#d6d1cb',
		roughness: 1,
		metalness: 1,
		defaultTileSizeMeters: [0.5, 0.5],
	},
	{
		id: 'metal-aluminium-brushed',
		label: 'Brushed Aluminium',
		textures: {
			normalMap: '/textures/metal-brushed/normal.webp',
			roughnessMap: '/textures/metal-brushed/orm.webp',
		},
		fallbackColor: '#f5f6f6',
		swatchColor: '#f5f6f6',
		roughness: 1,
		metalness: 1,
		defaultTileSizeMeters: [0.5, 0.5],
	},
	{
		id: 'textile-linen',
		label: 'Natural Linen',
		textures: {
			map: '/textures/textile-linen/color.webp',
			normalMap: '/textures/textile-linen/normal.webp',
			roughnessMap: '/textures/textile-linen/orm.webp',
			aoMap: '/textures/textile-linen/orm.webp',
		},
		fallbackColor: '#fdeed2',
		swatchColor: '#cbbfa8',
		roughness: 1,
		metalness: 0,
		defaultTileSizeMeters: [0.271, 0.271],
	},
	{
		id: 'textile-carpet-loop',
		label: 'Loop Pile Carpet',
		textures: {
			map: '/textures/textile-carpet-loop/color.webp',
			normalMap: '/textures/textile-carpet-loop/normal.webp',
			roughnessMap: '/textures/textile-carpet-loop/orm.webp',
			aoMap: '/textures/textile-carpet-loop/orm.webp',
		},
		fallbackColor: '#ffffff',
		swatchColor: '#bcb194',
		roughness: 1,
		metalness: 0,
		defaultTileSizeMeters: [1.7, 1.7],
	},
	{
		id: 'leather-cognac',
		label: 'Cognac Leather',
		textures: {
			map: '/textures/leather-smooth/color.webp',
			normalMap: '/textures/leather-smooth/normal.webp',
			roughnessMap: '/textures/leather-smooth/orm.webp',
			aoMap: '/textures/leather-smooth/orm.webp',
		},
		fallbackColor: '#eb8d60',
		swatchColor: '#8a4f2c',
		roughness: 1,
		metalness: 0,
		defaultTileSizeMeters: [0.3, 0.3],
	},
	{
		id: 'synthetic-plastic-matte',
		label: 'Matte Plastic',
		textures: {
			map: '/textures/synthetic-plastic-matte/color.webp',
			normalMap: '/textures/synthetic-plastic-matte/normal.webp',
			roughnessMap: '/textures/synthetic-plastic-matte/orm.webp',
		},
		fallbackColor: '#f8fbf9',
		swatchColor: '#e6e7e3',
		roughness: 1,
		metalness: 0,
		defaultTileSizeMeters: [0.5, 0.5],
	},
];

/**
 * The pre-S8 F placeholder bases. They resolve for existing documents and
 * baselines but are never offered on a creator shelf.
 */
export const legacyMaterials: MaterialDefinition[] = [
	{
		id: 'plaster-warm',
		label: 'Warm Plaster',
		textures: {
			map: '/textures/plaster-warm/map.png',
			roughnessMap: '/textures/plaster-warm/roughness.png',
		},
		fallbackColor: '#c4b4a0',
		roughness: 0.92,
		metalness: 0.02,
		defaultTileSizeMeters: [2, 2],
	},
	{
		id: 'wood-walnut',
		label: 'Walnut Wood',
		textures: {
			map: '/textures/wood-walnut/map.png',
			roughnessMap: '/textures/wood-walnut/roughness.png',
		},
		fallbackColor: '#3d2a1a',
		roughness: 0.78,
		metalness: 0.04,
		defaultTileSizeMeters: [1.5, 1.5],
	},
	{
		id: 'brass-aged',
		label: 'Aged Brass',
		textures: {
			map: '/textures/brass-aged/map.png',
		},
		fallbackColor: '#d6b35f',
		roughness: 0.45,
		metalness: 0.85,
		defaultTileSizeMeters: [0.5, 0.5],
	},
	{
		id: 'marble-light',
		label: 'Light Marble',
		fallbackColor: '#e8e4dc',
		roughness: 0.35,
		metalness: 0.08,
		defaultTileSizeMeters: [1.2, 1.2],
	},
	{
		id: 'velvet-dark',
		label: 'Dark Velvet',
		fallbackColor: '#3a1822',
		roughness: 0.95,
		metalness: 0,
		defaultTileSizeMeters: [1, 1],
	},
	{
		id: 'paper-aged',
		label: 'Aged Paper',
		fallbackColor: '#e2d2b0',
		roughness: 0.9,
		metalness: 0,
		defaultTileSizeMeters: [0.4, 0.4],
	},
];

const NEUTRAL_MATERIAL: MaterialDefinition = {
	id: 'pbr-neutral-v1',
	label: 'Neutral PBR',
	fallbackColor: '#ffffff',
	roughness: 0.5,
	metalness: 0,
	defaultTileSizeMeters: [1, 1],
};

export const materialById = new Map<MaterialId, MaterialDefinition>(
	[...materials, ...legacyMaterials, NEUTRAL_MATERIAL].map((material) => [material.id, material]),
);

export function getMaterial(id: MaterialId): MaterialDefinition {
	const material = materialById.get(id);
	if (!material) throw new Error(`Unknown material: ${id}`);
	return material;
}

export function isMaterialId(id: string): id is MaterialId {
	return materialById.has(id as MaterialId);
}

export function computeTextureRepeat(
	surfaceSize: [number, number],
	tileSize: [number, number] = [1, 1],
): [number, number] {
	const repeatX = Math.max(0.01, surfaceSize[0] / Math.max(0.01, tileSize[0]));
	const repeatY = Math.max(0.01, surfaceSize[1] / Math.max(0.01, tileSize[1]));
	return [repeatX, repeatY];
}
