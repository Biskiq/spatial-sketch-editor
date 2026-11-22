/*
 * Aperture icon family (Light & Sky): 24 grid, 1.5 stroke, round caps and joins, currentColor.
 * The Light & Sky glyphs used here are copied from gallery-ux-recovery/ux-design.html; the
 * appearance glyphs below the divider are new U proposals drawn to the same rules.
 */
const F = 'fill="currentColor" stroke="none"';

export const APX = {
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5V5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M18.7 5.3l-1.8 1.8M7.1 16.9l-1.8 1.8"/>',
  colour: '<circle cx="12" cy="8.8" r="4.6"/><circle cx="8.8" cy="14.4" r="4.6"/><circle cx="15.2" cy="14.4" r="4.6"/>',
  window: '<path d="M2.5 19.5h19"/><rect x="3.5" y="3.5" width="7" height="9"/><path d="M7 3.5v9"/><path d="M10.5 5 16.5 16M10.5 9.5 14 16" opacity=".6"/>',
  pattern: '<circle cx="12" cy="12" r="8.5"/><circle cx="9" cy="9" r="1.7"/><circle cx="15" cy="9.8" r="2.1"/><circle cx="10.5" cy="15.2" r="2.3"/><circle cx="16" cy="15.5" r="1.1"/>',
  place: `<circle cx="12" cy="6.5" r="3"/><circle cx="12" cy="6.5" r=".9" ${F}/><path d="M12 10v6" stroke-dasharray="2 1.8"/><path d="M5 19h14"/><circle cx="12" cy="19" r="1.3" ${F}/><path d="M19 2.5v5M16.5 5h5"/>`,
  // ---- U: appearance ----
  paint: '<path d="M14.5 3.5 20.5 9.5 11 19a2.1 2.1 0 0 1-3 0l-3-3a2.1 2.1 0 0 1 0-3Z"/><path d="M5.5 13.5h11" opacity=".55"/><path d="M19.5 15.5c0 1.6 1 2.4 1 3.5a1.5 1.5 0 0 1-3 0c0-1.1 1-1.9 1-3.5Z"/>',
  dropper: '<path d="m14.5 6.5 3 3"/><path d="M16 3.5a2.1 2.1 0 0 1 3 0l1.5 1.5a2.1 2.1 0 0 1 0 3l-2 2-4.5-4.5Z"/><path d="M14.5 8 6 16.5 5 20l3.5-1 8.5-8.5"/>',
  library: '<rect x="3.5" y="3.5" width="7" height="7" rx="1.8"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.8"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.8"/><circle cx="17" cy="17" r="3"/><path d="m19.2 19.2 1.8 1.8"/>',
  finish: '<rect x="4" y="4" width="16" height="16" rx="3.5"/><path d="M4.5 14c3.5-3 7.5-5 15-6" opacity=".55"/><path d="M8 20v-3.5M12 20v-5M16 20v-6.5" opacity=".35"/>',
  sheen: '<path d="M3.5 18.5h17"/><path d="M5 18.5c1.5-6 4-9 7-9s5.5 3 7 9"/><path d="M9.5 9.5 7 5.5M12 8.8V4M14.5 9.5 17 5.5" opacity=".6"/>',
  scale: '<rect x="3.5" y="3.5" width="17" height="17" rx="2"/><path d="M12 3.5v17M3.5 12h17" opacity=".55"/><path d="M15 15h3v3" />',
  direction: '<rect x="3.5" y="3.5" width="17" height="17" rx="2"/><path d="M7 17 17 7M8 11l3-3M13 16l3-3" opacity=".6"/><path d="M13.5 7H17v3.5"/>',
  relief: '<path d="M2.5 16c2 0 2-4 4-4s2 4 4 4 2-6 4-6 2 6 4 6 2-2 3-2"/><path d="M2.5 20h19" opacity=".4"/><path d="M6 7l2-2.5L10 7" opacity=".6"/>',
  metal: '<path d="M12 3 19.5 7.5v9L12 21l-7.5-4.5v-9Z"/><path d="M8 8.5 12 6l4 2.5" opacity=".6"/><path d="M8.5 15.5 12 13.5" opacity=".4"/>',
  inspect: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5 21 21"/><path d="M7.2 9.8a3.6 3.6 0 0 1 3-3" opacity=".6"/>',
  import: '<path d="M12 3.5v11M7.5 10l4.5 4.5 4.5-4.5"/><path d="M4 15.5v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/>',
  face: '<path d="M4 7.5 12 3.5l8 4v9l-8 4-8-4Z" opacity=".45"/><path d="M12 11.5 20 7.5v9l-8 4Z" fill="currentColor" fill-opacity=".22"/><path d="M12 11.5v9"/>',
  space: '<path d="M4 7.5 12 3.5l8 4v9l-8 4-8-4Z"/><path d="M4 7.5l8 4 8-4M12 11.5v9" opacity=".6"/><path d="M4 7.5v9l8 4 8-4v-9" fill="currentColor" fill-opacity=".16"/>',
  wall: '<path d="M3.5 20.5h17"/><rect x="5" y="5" width="14" height="15.5"/><path d="M5 10h14M5 15h14M12 5v5M8.5 10v5M15.5 10v5M12 15v5.5" opacity=".5"/>',
  floor: '<path d="M2.5 16 12 20.5 21.5 16 12 11.5Z"/><path d="M7.2 13.8l9.5 4.5M16.8 13.8l-9.5 4.5" opacity=".45"/><path d="M12 3.5v5" stroke-dasharray="2 1.6"/>',
  object: '<path d="M5 11h14v3.5H5Z"/><path d="M6.5 14.5V20M17.5 14.5V20M7 11V7.5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2V11"/>',
  star: '<path d="m12 3.5 2.6 5.3 5.9.9-4.2 4.1 1 5.8-5.3-2.8-5.3 2.8 1-5.8-4.2-4.1 5.9-.9Z"/>',
  recent: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3.5 2"/>',
  shared: '<circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="m8.2 10.8 7.6-3.6M8.2 13.2l7.6 3.6"/>',
  single: '<circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="12" r="2.5" stroke-dasharray="2 1.6"/><path d="M8.5 12h7" stroke-dasharray="2 1.8"/>',
  repair: '<path d="M14.5 4.5a4.5 4.5 0 0 0-5.6 5.8L3.5 15.7a2 2 0 0 0 2.8 2.8l5.4-5.4a4.5 4.5 0 0 0 5.8-5.6l-2.7 2.7-2.4-.6-.6-2.4Z"/>',
  warn: '<path d="M12 3.5 21 19.5H3Z"/><path d="M12 9.5v4.5"/><circle cx="12" cy="16.8" r=".9" fill="currentColor" stroke="none"/>',
  sphere: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12c0 2.5 3.8 4.5 8.5 4.5s8.5-2 8.5-4.5" opacity=".5"/><path d="M8.5 7.5a5 5 0 0 1 3-1.5" opacity=".7"/>',
  plane: '<path d="M2.5 15.5 9 8.5h12.5L15 15.5Z"/><path d="M5.8 12h12.5" opacity=".45"/>',
  block: '<path d="M4 7.5 12 3.5l8 4v9l-8 4-8-4Z"/><path d="M4 7.5l8 4 8-4M12 11.5v9"/>',
  studio: '<path d="M4 4.5h7v4.5H4Z"/><path d="M7.5 9v2" /><path d="M3 20.5h18"/><circle cx="15.5" cy="15.5" r="3.5"/><path d="M10 9.5l3 3" opacity=".55"/>',
  grazing: '<path d="M2.5 19.5h19"/><circle cx="4" cy="12.5" r="1.8"/><path d="M6.5 13.5 21 17" opacity=".7"/><path d="M8 16.5c1 0 1.5-1.5 2.5-1.5s1.5 1.5 2.5 1.5 1.5-1.2 2.5-1.2 1.5 1.2 2.5 1.2" opacity=".55"/>',
  layers: '<path d="m12 3.5 9 4.5-9 4.5L3 8Z"/><path d="m3 12 9 4.5 9-4.5" opacity=".7"/><path d="m3 16 9 4.5 9-4.5" opacity=".45"/>',
  nodes: '<rect x="2.5" y="4" width="6" height="5" rx="1.2"/><rect x="15.5" y="9.5" width="6" height="5" rx="1.2"/><rect x="2.5" y="15" width="6" height="5" rx="1.2"/><path d="M8.5 6.5c4 0 3 5.5 7 5.5M8.5 17.5c4 0 3-5.5 7-5.5"/>',
  mask: '<rect x="3.5" y="3.5" width="17" height="17" rx="2"/><path d="M3.5 15c4-1 5-6 9-6s5 3 8 3" /><path d="M3.5 20.5V15c4-1 5-6 9-6s5 3 8 3v8.5Z" fill="currentColor" fill-opacity=".2" stroke="none"/>',
  brush: '<path d="M20 3.5c-4.5 2-8.5 6-10.5 9.5l2 2c3.5-2 7.5-6 9.5-10.5Z"/><path d="M9 13.5c-2 0-3.5 1.5-3.5 3.5 0 1.2-.8 2.4-2 3 3.4.6 7-1 7-4.5"/>',
  source: '<path d="M4 9.5 12 4l8 5.5"/><path d="M5.5 9v9.5h13V9"/><path d="M12 10.5v6M9.5 14l2.5 2.5 2.5-2.5"/>',
  displace: '<path d="M3 18.5c3 0 3-7 6-7s3 4 6 4 3-9 6-9"/><path d="M3 21h18" opacity=".4"/><path d="M15 6.5V3M13.5 4.5 15 3l1.5 1.5" opacity=".6"/>',
  door: '<path d="M3.5 20.5h17"/><path d="M6 20.5V4h9.5v16.5"/><path d="M6 4l6.5 2.5v16" opacity=".55"/><circle cx="10.8" cy="13" r=".9" fill="currentColor" stroke="none"/>',
  more: '<circle cx="6" cy="12" r="1.2" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none"/><circle cx="18" cy="12" r="1.2" fill="currentColor" stroke="none"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  back: '<path d="M14.5 5.5 8 12l6.5 6.5"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5 21 21"/>',
  undo: '<path d="M8.5 5.5 4 10l4.5 4.5"/><path d="M4.5 10H14a5.5 5.5 0 0 1 0 11h-3"/>',
  select: '<path d="M5 3.5 18.5 12 12.5 13.5 9.5 19.5Z"/>',
  erase: '<path d="M13.5 4.5 20 11l-8.5 8.5H7L4 16.5a2 2 0 0 1 0-2.8Z"/><path d="M9 9.5l6.5 6.5M11.5 19.5H20" opacity=".6"/>',
  build: '<path d="M3.5 20.5h17"/><path d="M5.5 20.5v-9L12 6l6.5 5.5v9"/><path d="M10 20.5v-5h4v5" opacity=".6"/>',
  furnish: '<path d="M4 12h16v4H4Z"/><path d="M5.5 16v3.5M18.5 16v3.5M6 12V8.5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2V12"/>',
  landscape: '<path d="M2.5 19.5h19"/><path d="M3.5 19.5 9 10.5l3.5 5 2.5-3.5 5.5 7.5"/><circle cx="16.5" cy="6.5" r="2"/>',
  form: '<path d="M4 18.5V9.5L12 5l8 4.5v9l-8 2Z"/><path d="M12 5v15.5" opacity=".5"/>',
  check: '<path d="M5 12.5 10 17.5 19.5 7"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>'
};

export const icon = (job, px = 20, extra = '') =>
  `<svg width="${px}" height="${px}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="display:block;flex:none" ${extra}>${APX[job] || ''}</svg>`;
