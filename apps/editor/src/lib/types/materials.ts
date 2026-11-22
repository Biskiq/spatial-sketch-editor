export type MaterialId =
  | 'pbr-neutral-v1'
  | 'wood-oak-veneer'
  | 'wood-walnut-veneer'
  | 'wood-oak-planks'
  | 'wood-herringbone-parquet'
  | 'stone-travertine'
  | 'stone-terrazzo'
  | 'masonry-brick-red'
  | 'plaster-painted'
  | 'concrete-smooth'
  | 'concrete-polished'
  | 'tile-ceramic-white'
  | 'metal-stainless-satin'
  | 'metal-brass-satin'
  | 'metal-copper-satin'
  | 'metal-gold-satin'
  | 'metal-stainless-brushed'
  | 'metal-aluminium-brushed'
  | 'textile-linen'
  | 'textile-carpet-loop'
  | 'leather-cognac'
  | 'synthetic-plastic-matte'
  /** Legacy placeholder bases (pre-S8 F): resolvable, not creator-facing. */
  | 'plaster-warm'
  | 'wood-walnut'
  | 'brass-aged'
  | 'marble-light'
  | 'velvet-dark'
  | 'paper-aged';

export type MaterialTextureSlot =
  | 'map'
  | 'normalMap'
  | 'roughnessMap'
  | 'aoMap'
  | 'metalnessMap';

export type MaterialTextures = Partial<Record<MaterialTextureSlot, string>>;

export type MaterialDefinition = {
  id: MaterialId;
  label: string;
  textures?: MaterialTextures;
  fallbackColor: string;
  /**
   * Shelf swatch only: the colour factor times the qualified colour map's
   * measured linear mean, in sRGB. Never a render input; absent means
   * `fallbackColor` already reads as the material.
   */
  swatchColor?: string;
  roughness: number;
  metalness: number;
  normalScale?: [number, number];
  /** Physical size of one texture tile in meters [width, height]. */
  defaultTileSizeMeters?: [number, number];
};

export type MaterialTextureMode = 'auto' | 'off';

export type MaterialLoadStatus =
	| 'idle'
	| 'loading'
	| 'ready'
	| 'partial'
	| 'failed'
	| 'fallback';

export type Vec2 = [number, number];
