'use strict';
/*
 * World creation tools — icon set.
 * One 24 × 24 grid, 1.5 px strokes, round caps. Every glyph is inner SVG markup so a
 * glyph can mix paths, circles and rects. Drawn for the dark forest dock (white ink)
 * and reused on paper in the system sheet (dark ink): colour comes from currentColor.
 */
const ICONS = {
  // ── utilities ──────────────────────────────────────────────────────────────
  select: '<path d="M6.5 3.8 18 10.6l-5.1 1.5 3 5.3-2.2 1.3-3-5.3-3.9 3.7z"/>',
  paint: '<rect x="4" y="3.8" width="13" height="5.2" rx="1.2"/><path d="M17 6.4h2.6v5.2h-8.1v3"/><rect x="10" y="14.6" width="3" height="6" rx=".8"/>',
  erase: '<path d="m14.4 4.6 5 5-9.2 9.4H5.6l-2-2a1.4 1.4 0 0 1 0-2z"/><path d="m8.6 10.2 5 5M10.2 19H20"/>',
  measure: '<path d="m3.6 16.4 12.8-12.8 4 4L7.6 20.4z"/><path d="m7 13 1.6 1.6M9.6 10.4l2 2M12.2 7.8l1.6 1.6M14.8 5.2l2 2"/>',
  slice: '<path d="M8.5 3.5 16 6.2v14.3l-7.5-2.7z"/><path d="M3 12.2h3.2M18.4 12.2h2.6" stroke-dasharray="1.6 1.6"/>',
  inspect: '<circle cx="10.5" cy="10.5" r="6"/><path d="m15 15 5.2 5.2"/>',

  // ── families (collapsed dock keys) ─────────────────────────────────────────
  'fam-build': '<path d="M3 20.2h18"/><path d="M5 20.2v-8.4l5-4.4 5 4.4v8.4"/><path d="M15 13h5v7.2"/><path d="M8.6 20.2v-4h2.8v4"/>',
  'fam-furnish': '<path d="M5.6 12V8.4a2 2 0 0 1 2-2h8.8a2 2 0 0 1 2 2V12"/><path d="M3.6 12.6a1.5 1.5 0 0 1 3 0v2.6h10.8v-2.6a1.5 1.5 0 0 1 3 0V18H3.6z"/><path d="M6 18v2.2M18 18v2.2"/>',
  'fam-land': '<path d="M2.6 19.4c3.4-4.8 6-6.8 9.4-6.8 2.1 0 3.9.8 5.6 2.3 1.4 1.2 2.6 2.7 3.8 4.5z"/><path d="M16.2 13V9.2"/><circle cx="16.2" cy="6.6" r="2.6"/>',

  // ── Build ──────────────────────────────────────────────────────────────────
  walls: '<path d="M4 20.2V5.8h16"/><path d="M7.2 20.2V9h12.8"/><path d="M4 20.2h3.2M20 5.8V9"/>',
  building: '<path d="m3.8 11.2 8.2-6.6 8.2 6.6"/><path d="M6 9.6v10.6h12V9.6"/><path d="M10.2 20.2v-4.6h3.6v4.6"/><path d="M8.2 12.2h1.6M14.2 12.2h1.6"/>',
  opening: '<path d="M3 20.2h18"/><path d="M4.4 20.2V5.6h15.2v14.6"/><path d="M9.4 20.2v-6.4a2.6 2.6 0 0 1 5.2 0v6.4"/>',
  roof: '<path d="m2.8 14.2 6.6-7.6h5.2l6.6 7.6z"/><path d="M9.4 6.6 12 14.2l2.6-7.6"/><path d="M5 14.2v5.4M19 14.2v5.4" stroke-dasharray="1.4 1.6"/>',
  stair: '<path d="M3 20.2h4v-3.6h4V13h4V9.4h4V5.8h2"/><path d="M3 20.2h18" opacity=".45"/>',

  // ── Furnish ────────────────────────────────────────────────────────────────
  object: '<path d="m12 3.6 7.6 4.2v8.4L12 20.4l-7.6-4.2V7.8z"/><path d="M4.4 7.8 12 12l7.6-4.2M12 12v8.4"/>',
  art: '<path d="m12 3.4-4.6 4.8M12 3.4l4.6 4.8"/><rect x="4.4" y="8.2" width="15.2" height="11.4" rx=".6"/><path d="m7.4 17 3.4-3.8 2.4 2.4 1.6-1.6 2 3"/>',
  light: '<path d="M12 3v4.6"/><path d="M6.8 12.8a5.2 5.2 0 0 1 10.4 0z"/><path d="M10.4 15.4a1.6 1.6 0 0 0 3.2 0"/><path d="m5.2 19.2 1.8-1.8M18.8 19.2 17 17.4M12 18.6v2.2"/>',

  // ── Landscape ──────────────────────────────────────────────────────────────
  ground: '<path d="M2.8 19.4c3-4.2 5.6-6.2 9.2-6.2s6.2 2 9.2 6.2"/><path d="M12 10V3.6M9.4 6.2 12 3.6l2.6 2.6"/>',
  path: '<path d="M5.2 21c1-4.2 4-5.6 7-7.2s5-4.4 5.4-10.6"/><path d="M10.4 21c.8-2.8 3-4 5-5.2s4.6-3.2 5-8.4"/><path d="M8.2 18.6l1.6.8M12.6 15.2l1.4 1.1M16.4 11.2l1.6.6" opacity=".6"/>',
  water: '<path d="M3 9.4c1.5-1.3 3-1.3 4.5 0s3 1.3 4.5 0 3-1.3 4.5 0 3 1.3 4.5 0"/><path d="M3 14c1.5-1.3 3-1.3 4.5 0s3 1.3 4.5 0 3-1.3 4.5 0 3 1.3 4.5 0"/><path d="M3 18.6c1.5-1.3 3-1.3 4.5 0s3 1.3 4.5 0 3-1.3 4.5 0 3 1.3 4.5 0"/>',
  plants: '<path d="M12 21v-9.4"/><path d="M12 11.6c-4 0-6.2-2.6-6.2-6.2 3.6 0 6.2 2.6 6.2 6.2z"/><path d="M12 15.2c3.6 0 5.6-2.2 5.6-5.6-3.4 0-5.6 2.2-5.6 5.6z"/>',

  // ── shared shape modifiers ─────────────────────────────────────────────────
  'shape-line': '<path d="M5.4 18.6 18.6 5.4"/><circle cx="5.4" cy="18.6" r="1.5"/><circle cx="18.6" cy="5.4" r="1.5"/>',
  'shape-arc': '<path d="M4.6 17.4C6 10 9 7 12 7s6 3 7.4 10.4"/><circle cx="4.6" cy="17.4" r="1.5"/><circle cx="19.4" cy="17.4" r="1.5"/>',
  'shape-box': '<rect x="4.6" y="6" width="14.8" height="12" rx="1"/>',
  'shape-circle': '<circle cx="12" cy="12" r="7.4"/><circle cx="12" cy="12" r=".9" fill="currentColor"/>',
  'shape-free': '<path d="M3.8 15.6c1.8-5 3.8-6.2 5.4-3.2 1.4 2.6 2.8 2.4 4.4-1.6 1.6-3.8 3.8-4 6.6-.8"/>',
  'shape-outline': '<path d="m5.2 18.2 1.6-10.6 8.4-2.2 4 8-6.2 5.6z"/>',

  // ── Walls / heights ────────────────────────────────────────────────────────
  'h-low': '<path d="M3.4 19.4h17.2"/><rect x="5" y="14.6" width="14" height="4.8" rx=".5"/>',
  'h-room': '<path d="M3.4 19.4h17.2"/><rect x="5" y="9" width="14" height="10.4" rx=".5"/>',
  'h-tall': '<path d="M3.4 19.4h17.2"/><rect x="5" y="4" width="14" height="15.4" rx=".5"/>',

  // ── Opening kinds ──────────────────────────────────────────────────────────
  'op-door': '<path d="M3 20.2h18"/><path d="M7.6 20.2V5h8.8v15.2"/><circle cx="14.2" cy="13" r=".7" fill="currentColor"/>',
  'op-window': '<path d="M3 20.2h18"/><rect x="6.2" y="6" width="11.6" height="9.4" rx=".5"/><path d="M12 6v9.4M6.2 10.7h11.6"/>',
  'op-arch': '<path d="M3 20.2h18"/><path d="M7 20.2v-8.6a5 5 0 0 1 10 0v8.6"/>',
  'op-round': '<path d="M3 20.2h18"/><circle cx="12" cy="11" r="5"/><path d="M12 6v10M7 11h10" opacity=".55"/>',
  'op-niche': '<path d="M3 20.2h18"/><path d="M7 17.2v-6.6a5 5 0 0 1 10 0v6.6z"/><path d="M9.4 17.2v-6.2a2.6 2.6 0 0 1 5.2 0v6.2" opacity=".55"/>',
  'op-wide': '<path d="M3 20.2h18"/><path d="M4.4 20.2V8.4h15.2v11.8"/><path d="M4.4 8.4 7 5.8h10l2.6 2.6" opacity=".55"/>',

  // ── Roof styles ────────────────────────────────────────────────────────────
  'roof-gable': '<path d="m3.2 13.6 8.8-7.6 8.8 7.6"/><path d="M5.4 12v7.4h13.2V12"/>',
  'roof-hip': '<path d="m3.2 14.2 5-6.4h7.6l5 6.4z"/><path d="M5.4 14.2v5.2h13.2v-5.2"/>',
  'roof-flat': '<path d="M3.8 9.4h16.4v2.2H3.8z"/><path d="M5.4 11.6v7.8h13.2v-7.8"/>',
  'roof-cone': '<path d="M12 3.6 5 14h14z"/><path d="M6.2 14v5.4h11.6V14"/>',
  'roof-dome': '<path d="M5 14a7 7 0 0 1 14 0z"/><path d="M6.2 14v5.4h11.6V14"/>',

  // ── Building facades ───────────────────────────────────────────────────────
  'win-none': '<rect x="5" y="5" width="14" height="14.4" rx=".5"/>',
  'win-sparse': '<rect x="5" y="5" width="14" height="14.4" rx=".5"/><rect x="7.6" y="8" width="2.6" height="3" rx=".3"/><rect x="13.8" y="13.2" width="2.6" height="3" rx=".3"/>',
  'win-regular': '<rect x="5" y="5" width="14" height="14.4" rx=".5"/><path d="M7.6 8h2.4M13.8 8h2.4M7.6 12h2.4M13.8 12h2.4M7.6 16h2.4M13.8 16h2.4" stroke-width="2.4"/>',

  // ── Objects shelf ──────────────────────────────────────────────────────────
  'obj-bench': '<path d="M3.4 11.4h17.2v2.4H3.4z"/><path d="M5.4 13.8v4.6M18.6 13.8v4.6M5.4 16.4h13.2" opacity=".6"/>',
  'obj-table': '<path d="M3 9.4h18"/><path d="M4.6 9.4v10M19.4 9.4v10M7.2 9.4 6 19.4M16.8 9.4l1.2 10" opacity=".55"/>',
  'obj-chair': '<path d="M7.6 3.8v9.4h9v6.6"/><path d="M7.6 13.2v6.6M7.6 8.4h7.4"/>',
  'obj-plinth': '<circle cx="12" cy="6.4" r="2.8"/><path d="M7.4 10.4h9.2v9.4H7.4z"/>',
  'obj-sofa': '<path d="M4.6 12V8.6a1.6 1.6 0 0 1 1.6-1.6h11.6a1.6 1.6 0 0 1 1.6 1.6V12"/><path d="M3 12.2h18v5.2H3z"/><path d="M5 17.4v2M19 17.4v2"/>',
  'obj-planter': '<path d="M6.6 13.4h10.8l-1.4 6.6H8z"/><path d="M12 13.4c0-4 1.6-7 5-8.4-.4 4.2-2 7-5 8.4zM12 13.4c-.2-3.4-1.8-5.6-4.8-6.4.2 3.4 1.8 5.4 4.8 6.4z"/>',

  // ── Art ────────────────────────────────────────────────────────────────────
  'art-s': '<path d="M3 20.4h18" opacity=".45"/><rect x="9" y="8.6" width="6" height="7" rx=".4"/>',
  'art-m': '<path d="M3 20.4h18" opacity=".45"/><rect x="7.2" y="6.4" width="9.6" height="11" rx=".4"/>',
  'art-l': '<path d="M3 20.4h18" opacity=".45"/><rect x="4.6" y="4.4" width="14.8" height="13.4" rx=".4"/>',
  'art-row': '<path d="M3 20.4h18" opacity=".45"/><rect x="3.4" y="8" width="4.4" height="6" rx=".3"/><rect x="9.8" y="8" width="4.4" height="6" rx=".3"/><rect x="16.2" y="8" width="4.4" height="6" rx=".3"/><path d="M3.4 11h17.2" stroke-dasharray="1.2 1.6" opacity=".55"/>',

  // ── Light kinds ────────────────────────────────────────────────────────────
  'light-spot': '<path d="m8.6 4.4 5.4 3.2-2 3.4-5.4-3.2z"/><path d="m12 11 4.6 8.4M9.4 9.6 7 19.4" opacity=".6"/><path d="M5.4 20h13.2" opacity=".45"/>',
  'light-pendant': '<path d="M12 2.8v5.6"/><path d="M7.4 13a4.6 4.6 0 0 1 9.2 0z"/><path d="M12 15.6v1.6M8.4 18.6l-1 1.6M15.6 18.6l1 1.6" opacity=".6"/>',
  'light-wall': '<path d="M5 3.6v16.8"/><path d="M5 10h3.4l3.4-2.4v7.2L8.4 12.4H5"/><path d="M14.6 7.4l3-1.6M15 11.2h3.6M14.6 15l3 1.6" opacity=".6"/>',
  'light-lamp': '<path d="M9 3.6h6l2.2 6.4H6.8z"/><path d="M12 10v9.4M8.6 19.6h6.8"/>',
  sun: '<circle cx="12" cy="12" r="3.8"/><path d="M12 3v2.2M12 18.8V21M3 12h2.2M18.8 12H21M5.6 5.6l1.6 1.6M16.8 16.8l1.6 1.6M5.6 18.4l1.6-1.6M16.8 7.2l1.6-1.6"/>',

  // ── Ground brushes ─────────────────────────────────────────────────────────
  raise: '<path d="M2.8 19.4c3-4.2 5.6-6.2 9.2-6.2s6.2 2 9.2 6.2"/><path d="M12 10V3.6M9.4 6.2 12 3.6l2.6 2.6"/>',
  lower: '<path d="M2.8 8.6c3 4.2 5.6 6.2 9.2 6.2s6.2-2 9.2-6.2"/><path d="M12 13.4V20M9.4 17.4 12 20l2.6-2.6" opacity=".75"/>',
  flatten: '<path d="M3 16.4h18"/><path d="M5 12.4c2.2-2.8 4.4-4 7-4s4.8 1.2 7 4" stroke-dasharray="1.6 1.8" opacity=".6"/><path d="M12 9.6v4.6M10 12.2l2 2 2-2"/>',
  smooth: '<path d="M3 13.4c2-3 4-3 6 0s4 3 6 0 4-3 6 0"/><path d="M3 18.4h18" opacity=".5"/>',
  terrace: '<path d="M2.8 19.6h4v-5.2h10.4v5.2h4"/><path d="m6.8 14.4 2.2-4.2h6l2.2 4.2" opacity=".55"/>',

  // ── sizes ──────────────────────────────────────────────────────────────────
  'size-s': '<circle cx="12" cy="12" r="3.2"/>',
  'size-m': '<circle cx="12" cy="12" r="5.6"/>',
  'size-l': '<circle cx="12" cy="12" r="8.2"/>',

  // ── Path widths ────────────────────────────────────────────────────────────
  'w-narrow': '<path d="M10.4 3.4v17.2M13.6 3.4v17.2"/>',
  'w-path': '<path d="M8.6 3.4v17.2M15.4 3.4v17.2"/>',
  'w-wide': '<path d="M5.6 3.4v17.2M18.4 3.4v17.2"/><path d="M12 5v2.6M12 10.6v2.6M12 16.2v2.6" opacity=".45"/>',

  // ── Water ──────────────────────────────────────────────────────────────────
  'water-pond': '<path d="M5 12.4c0-4 3.4-6.2 7.4-6.2 4.4 0 7 2.4 7 5.6 0 3.6-3 6-7.4 6-4.4 0-7-1.6-7-5.4z"/><path d="M9 12.2c1-.8 2-.8 3 0s2 .8 3 0" opacity=".6"/>',
  'water-stream': '<path d="M3.6 6.4c4 0 4.4 4 8.4 4s4.4 4 8.4 4"/><path d="M3.6 10.2c4 0 4.4 4 8.4 4s4.4 4 8.4 4" opacity=".6"/>',
  'depth-shallow': '<path d="M3.4 9h17.2"/><path d="M5 9c1.6 3 3.6 4 7 4s5.4-1 7-4" opacity=".6"/>',
  'depth-deep': '<path d="M3.4 7h17.2"/><path d="M5 7c1 7 3.6 11 7 11s6-4 7-11" opacity=".6"/>',

  // ── Plants ─────────────────────────────────────────────────────────────────
  'plant-tree': '<circle cx="12" cy="9" r="5.6"/><path d="M12 14.6v6"/>',
  'plant-shrub': '<path d="M4.4 18.6c0-3.4 2-5.4 4.4-5.4.6-2.4 2-3.6 3.6-3.6s3.2 1.2 3.6 3.6c2.4 0 4 2 4 5.4z"/>',
  'plant-flower': '<circle cx="12" cy="9.6" r="2"/><path d="M12 5.6v-.4M15.6 9.6h.4M12 13.6v.4M8.4 9.6H8M14.6 7l.3-.3M14.6 12.2l.3.3M9.4 12.2l-.3.3M9.4 7l-.3-.3"/><path d="M12 13.6v6.8M12 17.6c-1.6-.4-2.6-1.4-3-3" opacity=".6"/>',
  'plant-grass': '<path d="M6 20.2c0-4 .6-7 2-9.6M10 20.2c0-5 .6-9 1.6-12.6M14 20.2c.2-4.4 1.2-7.6 3.2-10M18 20.2c0-2.6.6-4.6 1.6-6.4"/>',
  'dens-sparse': '<circle cx="7" cy="8" r="1.3"/><circle cx="16" cy="11" r="1.3"/><circle cx="9.4" cy="16.6" r="1.3"/>',
  'dens-full': '<circle cx="6" cy="6.4" r="1.3"/><circle cx="12" cy="7.4" r="1.3"/><circle cx="18" cy="6" r="1.3"/><circle cx="8.6" cy="12" r="1.3"/><circle cx="15.6" cy="12.4" r="1.3"/><circle cx="5.6" cy="17.4" r="1.3"/><circle cx="12" cy="17.6" r="1.3"/><circle cx="18.4" cy="17.4" r="1.3"/>',

  // ── Paint scopes ───────────────────────────────────────────────────────────
  'scope-face': '<path d="m4 8 8-3.4v14.8L4 22.8z" transform="translate(0 -2)" fill="currentColor" fill-opacity=".35"/><path d="m12 2.6 8 3.4v14.8l-8-3.4" stroke-dasharray="1.6 1.6"/>',
  'scope-wall': '<path d="m4 6 8-3.4 8 3.4v14.8l-8-3.4-8 3.4z" fill="currentColor" fill-opacity=".35"/>',
  'scope-room': '<rect x="4" y="4" width="16" height="16" rx="1" fill="currentColor" fill-opacity=".2"/><path d="M4 4h16v16H4z" stroke-width="2.6"/>',
  'scope-all': '<rect x="3.4" y="4.4" width="7" height="7" rx=".6" fill="currentColor" fill-opacity=".35"/><rect x="13.6" y="4.4" width="7" height="7" rx=".6" fill="currentColor" fill-opacity=".35"/><rect x="3.4" y="13.6" width="7" height="7" rx=".6" fill="currentColor" fill-opacity=".35"/><rect x="13.6" y="13.6" width="7" height="7" rx=".6" fill="currentColor" fill-opacity=".35"/>',
  dropper: '<path d="M14.6 4.4a2.1 2.1 0 0 1 3 3L9 16H6v-3z"/><path d="m12.6 6.4 3 3M4 20.4h4"/>',

  // ── Eraser ─────────────────────────────────────────────────────────────────
  'erase-click': '<path d="M7 4.4 16.4 12l-4 .8 2.4 4.4-1.8 1-2.4-4.4L7.6 16.4z"/>',
  'erase-scrub': '<path d="M3.8 16c2.6-6 5-8 6.4-4.4 1.2 3.2 3 3 4.6-1.4s3.6-4.4 5.4-1.6" stroke-dasharray="2 1.6"/>',

  // ── chrome ─────────────────────────────────────────────────────────────────
  undo: '<path d="M9 7.4 4.6 11.8 9 16.2"/><path d="M4.6 11.8h10a4.6 4.6 0 0 1 0 9.2H12"/>',
  redo: '<path d="m15 7.4 4.4 4.4-4.4 4.4"/><path d="M19.4 11.8h-10a4.6 4.6 0 0 0 0 9.2H12"/>',
  search: '<circle cx="10.6" cy="10.6" r="5.6"/><path d="m15 15 4.8 4.8"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  close: '<path d="m6.4 6.4 11.2 11.2M17.6 6.4 6.4 17.6"/>',
  chevron: '<path d="m7 10 5 5 5-5"/>',
  'chevron-up': '<path d="m7 14 5-5 5 5"/>',
  more: '<circle cx="6" cy="12" r="1.2" fill="currentColor"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/><circle cx="18" cy="12" r="1.2" fill="currentColor"/>',
  library: '<rect x="4" y="4" width="6.6" height="6.6" rx="1"/><rect x="13.4" y="4" width="6.6" height="6.6" rx="1"/><rect x="4" y="13.4" width="6.6" height="6.6" rx="1"/><path d="M16.7 13.4v6.6M13.4 16.7h6.6"/>',
  check: '<path d="m5 12.6 4.4 4.4L19 7.4"/>',
  info: '<circle cx="12" cy="12" r="8"/><path d="M12 11v5.4M12 7.6v.4"/>',
  cycle: '<path d="M18.4 9.4A7 7 0 0 0 5.8 8.2"/><path d="M5.6 4.4v3.8h3.8"/><path d="M5.6 14.6a7 7 0 0 0 12.6 1.2"/><path d="M18.4 19.6v-3.8h-3.8"/>',
  doorway: '<path d="M3 20.2h18"/><path d="M7 20.2V6.6h10v13.6"/>',
  bridge: '<path d="M3 14.4c3-3.4 6-5 9-5s6 1.6 9 5"/><path d="M3 14.4h18M7 12v2.4M12 9.4v5M17 12v2.4"/><path d="M3 18.4c1.5-1 3-1 4.5 0s3 1 4.5 0 3-1 4.5 0 3 1 4.5 0" opacity=".55"/>',
  steps: '<path d="M3 19.6h4.4v-3.8h4.4V12h4.4V8.2H20"/>',
  plinth: '<path d="M5 9.6h14v6H5z" opacity=".55"/><path d="M3.4 15.6h17.2v3.8H3.4z"/>',
  room: '<path d="M4.6 4.6h14.8v14.8H4.6z"/><path d="M8.6 12h6.8" opacity=".55"/>',
  connect: '<rect x="3.4" y="7" width="6.6" height="10" rx="1"/><rect x="14" y="7" width="6.6" height="10" rx="1"/><path d="M10 12h4"/>',
  aim: '<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2.4"/><path d="M12 2.6V5M12 19v2.4M2.6 12H5M19 12h2.4"/>',
  clear: '<path d="M12 21v-7"/><path d="M12 14c-3.4 0-5.2-2.2-5.2-5.2 3 0 5.2 2.2 5.2 5.2z"/><path d="m4 4 16 16"/>',
  keep: '<path d="M7 4.4h10v16l-5-3.6-5 3.6z"/>',
  datum: '<path d="M3 12h18" stroke-dasharray="2 1.8"/><path d="M8 12V6.4h8V12"/>',
  key: '<rect x="3.4" y="6.4" width="17.2" height="11.2" rx="2"/><path d="M7 10h.01M10.4 10h.01M13.6 10h.01M17 10h.01M8 14h8"/>',
  eye: '<path d="M2.6 12S6 5.8 12 5.8 21.4 12 21.4 12 18 18.2 12 18.2 2.6 12 2.6 12z"/><circle cx="12" cy="12" r="2.8"/>',
};

/** Returns an inline SVG for an icon id. */
function icon(name, size = 20, extra = '') {
  const body = ICONS[name] || ICONS.info;
  return `<svg class="ico" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${body}</svg>`;
}
