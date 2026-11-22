/*
 * Thumbnail service for the prototype: one renderer, one cache, keyed by the effective
 * appearance (never by Finish id), so a coat or an edited Finish gets its own picture and
 * identical recipes share one. Presentations follow the lab's recommendation:
 *   sample — flat, lit, sheen band, physical window (S, M, L)
 *   xs     — same, tighter window (inline circles)
 *   tile   — one seamless tile, lit without sheen (Stage pattern fill)
 *   sphere — shape and sheen read (L detail, inspector)
 *   close  — grazing close-up at a third of the window (L detail)
 */
import { createRenderer } from '../shared/render.js';
import { BY_ID, TEX } from '../shared/catalogue.js';

const R = createRenderer();
const cache = new Map();
let ready = Promise.resolve();

export function preload(entries) {
  ready = Promise.all([...entries.map((e) => R.load(e, TEX)), ...[...new Set(entries.map((e) => e.set))].map(measureScan)]);
  return ready;
}

// Mean scanned roughness (ORM green) per texture set. The recipe's roughness
// is a FACTOR on that map, so the Card must show factor × scan, never the
// factor alone ("Matte r 1.00" on every curated Finish was a lie).
const scan = new Map();
function measureScan(set) {
  return new Promise((res) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas'); c.width = c.height = 32;
      const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(img, 0, 0, 32, 32);
      const d = x.getImageData(0, 0, 32, 32).data; let s = 0;
      for (let i = 1; i < d.length; i += 4) s += d[i];
      scan.set(set, s / (d.length / 4) / 255); res();
    };
    img.onerror = () => { scan.set(set, 1); res(); };
    img.src = TEX + set + '/orm.webp';
  });
}
/** Mean roughness of the shipped scan for a texture set, 0..1 (1 when unknown). */
export const scanRough = (set) => scan.get(set) ?? 1;

/** look: { set (catalogue id whose texture bytes are used), tint, rough, metal, normalScale, tile:[m,m], rot, colour:'natural'|'tint'|'coat', coat, normalOff, ormOff, colourOff } */
export function key(look, pres, px, extra = '') {
  return [look.set, look.tint, look.rough, look.metal, look.normalScale, look.tile?.[0], look.rot, look.colour, look.coat, look.normalOff, look.ormOff, look.colourOff, look.normalFlip, look.missingColour, pres, px, extra].join('|');
}

export function specOf(look, pres, over = {}) {
  const base = BY_ID[look.set];
  const entry = base;
  // A disabled colour map with a colour literal renders exactly like a coat.
  // A missing colour image renders as a neutral placeholder (the Stage adds the amber repair hatch).
  const colour = look.missingColour || look.colourOff ? 'coat' : look.colour;
  const finish = {
    tint: look.tint, rough: look.rough, metal: look.metal, normalScale: look.normalScale,
    tile: look.tile, rot: look.rot, colour, coat: look.missingColour ? '#cfc9bd' : look.colourOff ? (look.coat || look.tint) : look.coat, normalOff: look.normalOff, ormOff: look.ormOff, normalFlip: look.normalFlip
  };
  const w = base.frame.w;
  const P = {
    sample: { geom: 'flat', strip: true, eye: 0.8, window: w },
    xs: { geom: 'flat', strip: true, eye: 0.8, window: w * 0.55 },
    tile: { geom: 'tile', sheen: false, key: 0.5 },
    sphere: { geom: 'sphere' },
    close: { geom: 'flat', sheen: false, grazing: true, window: w / 3 },
    chip: { geom: 'chip', strip: true, eye: 0.9, window: w }
  }[pres];
  return { entry, texBase: TEX, finish, bg: '#e9e6dd', ...P, ...over };
}

export function url(look, pres = 'sample', px = 112, over = {}, extraKey = '') {
  const k = key(look, pres, px, extraKey + JSON.stringify(over));
  if (cache.has(k)) return cache.get(k);
  const spec = specOf(look, pres, over);
  let u;
  try { u = R.toURL(spec, px, px, 'image/webp', 0.9); } catch { u = ''; }
  if (cache.size > 900) cache.clear();
  cache.set(k, u);
  return u;
}

/** Draw straight into a canvas (live previews: inspector, compare). */
export function paint(look, pres, canvas, over = {}) {
  R.paint(specOf(look, pres, over), canvas);
}

export function whenReady() { return ready; }
export const renderer = R;
