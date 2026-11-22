/*
 * The 21 creator-facing S8 catalogue entries, transcribed from
 * packages/project-model/src/materials/catalogue.ts and
 * apps/editor/src/lib/content/materials.ts (main@b5de855c).
 *
 * Recipe facts (tint, factors, tile, bound maps) are copied, not imported:
 * prototypes never import product code. Texture bytes are read live from
 * apps/editor/static/textures, so the study always uses the shipped pixels.
 *
 * `frame` is a PROPOSED thumbnail framing hint (U, not a contract): the
 * physical window in metres the thumbnail shows, and the window centre in
 * tile-normalised coordinates. It lives outside the recipe, like the
 * thumbnail and locator tables (S8 plan § A, canonical identity).
 */
export const TEX = '../../apps/editor/static/textures/';

export const TAXONOMY = [
  { id: 'wood', label: 'Wood' },
  { id: 'stone', label: 'Stone' },
  { id: 'masonry', label: 'Masonry' },
  { id: 'plaster-concrete', label: 'Plaster & Concrete' },
  { id: 'tile-ceramic', label: 'Tile & Ceramic' },
  { id: 'metal', label: 'Metal' },
  { id: 'textile', label: 'Textile' },
  { id: 'leather', label: 'Leather' },
  { id: 'synthetic-paper', label: 'Synthetic & Paper' }
];

// set, tint, roughness factor, metalness factor, tile metres, colour map?, occlusion bound?
const E = (id, label, cat, set, tint, r, m, tile, colorMap, occ, swatch, frame, extra = {}) => ({
  id, label, cat, set, tint, rough: r, metal: m, tile: [tile, tile], colorMap, occ, swatch, frame, ...extra
});

export const CATALOGUE = [
  E('wood-oak-veneer', 'Oak Veneer', 'wood', 'wood-oak-veneer', '#ffffff', 1, 0, 0.5, true, true, '#907963', { w: 0.28, c: [0.5, 0.5] }, { sub: 'Veneer' }),
  E('wood-walnut-veneer', 'Walnut Veneer', 'wood', 'wood-walnut-veneer', '#7a6e63', 1, 0, 1.0, true, true, '#4f3828', { w: 0.34, c: [0.42, 0.5] }, { sub: 'Veneer' }),
  E('wood-oak-planks', 'Oak Plank Floor', 'wood', 'wood-oak-planks', '#ffffff', 1, 0, 1.7, true, true, '#816143', { w: 0.62, c: [0.5, 0.5] }, { sub: 'Boards' }),
  E('wood-herringbone-parquet', 'Herringbone Parquet', 'wood', 'wood-herringbone-parquet', '#ffffff', 1, 0, 3.4, true, true, '#94714e', { w: 0.9, c: [0.5, 0.5] }, { sub: 'Parquet' }),
  E('stone-travertine', 'Travertine', 'stone', 'stone-travertine', '#ffffff', 1, 0, 1.2, true, true, '#e0ccac', { w: 0.6, c: [0.5, 0.5] }, { sub: 'Natural' }),
  E('stone-terrazzo', 'Terrazzo', 'stone', 'stone-terrazzo', '#ffffff', 1, 0, 0.8, true, false, '#a18f76', { w: 0.32, c: [0.5, 0.5] }, { sub: 'Composite' }),
  E('masonry-brick-red', 'Red Brick', 'masonry', 'masonry-brick-red', '#ffffff', 1, 0, 1.0, true, true, '#6e5a52', { w: 0.78, c: [0.5, 0.5] }, { sub: 'Brick' }),
  E('plaster-painted', 'Painted Plaster', 'plaster-concrete', 'plaster-painted', '#fbfff9', 1, 0, 2.0, true, true, '#e7e1d7', { w: 0.42, c: [0.5, 0.5] }, { sub: 'Plaster' }),
  E('concrete-smooth', 'Smooth Concrete', 'plaster-concrete', 'concrete-smooth', '#e7e6ff', 1, 0, 2.4, true, false, '#bababa', { w: 0.7, c: [0.5, 0.5] }, { sub: 'Concrete', family: 'concrete' }),
  E('concrete-polished', 'Polished Concrete', 'plaster-concrete', 'concrete-smooth', '#e7e6ff', 0.45, 0, 2.4, true, false, '#bababa', { w: 0.7, c: [0.5, 0.5] }, { sub: 'Concrete', family: 'concrete', variantOf: 'concrete-smooth' }),
  E('tile-ceramic-white', 'White Ceramic Tile', 'tile-ceramic', 'tile-ceramic-white', '#f3f4f0', 1, 0, 1.0, true, true, '#edeeea', { w: 0.5, c: [0.5, 0.5] }, { sub: 'Glazed tile' }),
  E('metal-stainless-satin', 'Satin Stainless Steel', 'metal', 'metal-satin', '#d6d1cb', 1, 1, 0.5, false, false, '#d6d1cb', { w: 0.2, c: [0.5, 0.5] }, { sub: 'Satin', family: 'satin' }),
  E('metal-brass-satin', 'Satin Brass', 'metal', 'metal-satin', '#f5e4ae', 1, 1, 0.5, false, false, '#f5e4ae', { w: 0.2, c: [0.5, 0.5] }, { sub: 'Satin', family: 'satin' }),
  E('metal-copper-satin', 'Satin Copper', 'metal', 'metal-satin', '#f7cfbf', 1, 1, 0.5, false, false, '#f7cfbf', { w: 0.2, c: [0.5, 0.5] }, { sub: 'Satin', family: 'satin' }),
  E('metal-gold-satin', 'Satin Gold', 'metal', 'metal-satin', '#ffe496', 1, 1, 0.5, false, false, '#ffe496', { w: 0.2, c: [0.5, 0.5] }, { sub: 'Satin', family: 'satin' }),
  E('metal-stainless-brushed', 'Brushed Stainless Steel', 'metal', 'metal-brushed', '#d6d1cb', 1, 1, 0.5, false, false, '#d6d1cb', { w: 0.2, c: [0.5, 0.5] }, { sub: 'Brushed', family: 'brushed' }),
  E('metal-aluminium-brushed', 'Brushed Aluminium', 'metal', 'metal-brushed', '#f5f6f6', 1, 1, 0.5, false, false, '#f5f6f6', { w: 0.2, c: [0.5, 0.5] }, { sub: 'Brushed', family: 'brushed' }),
  E('textile-linen', 'Natural Linen', 'textile', 'textile-linen', '#fdeed2', 1, 0, 0.271, true, true, '#cbbfa8', { w: 0.09, c: [0.5, 0.5] }, { sub: 'Woven' }),
  E('textile-carpet-loop', 'Loop Pile Carpet', 'textile', 'textile-carpet-loop', '#ffffff', 1, 0, 1.7, true, true, '#bcb194', { w: 0.24, c: [0.5, 0.5] }, { sub: 'Pile carpet' }),
  E('leather-cognac', 'Cognac Leather', 'leather', 'leather-smooth', '#eb8d60', 1, 0, 0.3, true, true, '#8a4f2c', { w: 0.16, c: [0.5, 0.5] }, { sub: 'Upholstery' }),
  E('synthetic-plastic-matte', 'Matte Plastic', 'synthetic-paper', 'synthetic-plastic-matte', '#f8fbf9', 1, 0, 0.5, true, false, '#e6e7e3', { w: 0.22, c: [0.5, 0.5] }, { sub: 'Plastic' })
];

export const BY_ID = Object.fromEntries(CATALOGUE.map((e) => [e.id, e]));

/** The pairs F's distinctness rule failed or narrowly passed (E7 report). */
export const WATCH_PAIRS = [
  ['concrete-smooth', 'concrete-polished', 'failed'],
  ['metal-stainless-satin', 'metal-stainless-brushed', 'failed'],
  ['plaster-painted', 'synthetic-plastic-matte', 'failed'],
  ['metal-brass-satin', 'metal-gold-satin', 'narrow pass'],
  ['textile-linen', 'textile-carpet-loop', 'narrow pass']
];

/** E7 reference derivative file names (apps/editor/static/material-thumbnails). */
export const E7_REF = {
  'wood-oak-veneer': 'wood-oak-veneer-thumb-ad43cbb363b6e8e7.png',
  'wood-walnut-veneer': 'wood-walnut-veneer-thumb-9bad06fb09fa270f.png',
  'metal-stainless-satin': 'metal-stainless-satin-thumb-22c2fdc65c64d824.png',
  'metal-stainless-brushed': 'metal-stainless-brushed-thumb-3e8d83ecdd9fb1c6.png',
  'masonry-brick-red': 'masonry-brick-red-thumb-d75ad225b534952d.png',
  'wood-oak-planks': 'wood-oak-planks-thumb-8f2a46be68cd79d2.png',
  'plaster-painted': 'plaster-painted-thumb-79a089b258cc6f1a.png',
  'metal-gold-satin': 'metal-gold-satin-thumb-c731a03c2d3a9afa.png',
  'metal-aluminium-brushed': 'metal-aluminium-brushed-thumb-12cedeed7635fced.png',
  'stone-terrazzo': 'stone-terrazzo-thumb-330ab9ae5bab34de.png',
  'metal-brass-satin': 'metal-brass-satin-thumb-e699846c49fa50a2.png',
  'metal-copper-satin': 'metal-copper-satin-thumb-7452ad90ff928302.png',
  'stone-travertine': 'stone-travertine-thumb-9a102ae423000a48.png',
  'tile-ceramic-white': 'tile-ceramic-white-thumb-a25169dfd4b1bd6b.png',
  'wood-herringbone-parquet': 'wood-herringbone-parquet-thumb-d8ee496c088659f0.png',
  'leather-cognac': 'leather-cognac-thumb-eb85b43d15ca0b89.png',
  'textile-carpet-loop': 'textile-carpet-loop-thumb-7b78bc50b7494c7c.png',
  'concrete-smooth': 'concrete-smooth-thumb-f499c9c6ee425d1e.png',
  'concrete-polished': 'concrete-polished-thumb-3d7faf94cf129c3a.png',
  'synthetic-plastic-matte': 'synthetic-plastic-matte-thumb-d4b0600eaf43b306.png',
  'textile-linen': 'textile-linen-thumb-83bb7cbc8f57c54c.png'
};
export const E7_DIR = '../../apps/editor/static/material-thumbnails/';
