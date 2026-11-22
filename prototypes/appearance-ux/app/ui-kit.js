/* Small UI helpers shared by the prototype pages. */
import * as T from './thumbs.js';
import { look, nameOf, S, slotHex } from './model.js';
import { icon } from '../shared/icons.js';

export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export function h(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
    else if (k.startsWith('on')) e.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'html') e.innerHTML = v;
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const k of kids.flat()) if (k !== null && k !== undefined && k !== false) e.append(k instanceof Node ? k : document.createTextNode(String(k)));
  return e;
}
export const ic = (job, px = 18) => { const s = document.createElement('span'); s.style.display = 'inline-grid'; s.innerHTML = icon(job, px); return s; };

/** Pixel bucket for a CSS size at 2× so the cache stays small. */
export const pxFor = (css) => (css <= 34 ? 64 : css <= 60 ? 112 : 256);

/** Swatch: circle = colour (coats, keeps relief), rounded square = material (replaces the Finish). */
export function swatch(item, size, opts = {}) {
  const isColour = item.kind === 'colour';
  const b = h('button', { class: `sw ${isColour ? 'c' : 'm'} ${opts.cls || ''}`, type: 'button', 'aria-pressed': opts.pressed ? 'true' : 'false', title: opts.title || labelOf(item), 'aria-label': opts.title || labelOf(item), style: { width: size + 'px', height: size + 'px' }, onClick: opts.onClick, 'data-key': keyOf(item) });
  if (isColour) b.style.background = item.slot ? slotHex(item.slot) : item.hex;
  else b.style.backgroundImage = `url(${T.url(look(item.ref), size <= 34 ? 'xs' : 'sample', pxFor(size))})`;
  if (opts.badge) b.append(h('span', { class: 'badge', html: opts.badge }));
  if (opts.draggable) b.draggable = true;
  return b;
}
export const keyOf = (item) => item.kind === 'colour' ? (item.slot ? 'slot:' + item.slot : 'hex:' + item.hex) : item.ref;
export function labelOf(item) {
  if (item.kind === 'colour') return item.slot ? (S.p.palette.find((s) => s.id === item.slot)?.name || 'Colour') + ' · palette colour' : item.hex;
  return nameOf(item.ref);
}

export function seg(options, value, onPick, cls = 'seg') {
  const w = h('div', { class: cls, role: 'group' });
  for (const [v, label, title] of options) {
    w.append(h('button', { type: 'button', 'aria-pressed': String(v === value), title: title || undefined, onClick: () => onPick(v) }, typeof label === 'string' ? label : label));
  }
  return w;
}

export function range({ min, max, step, value, onInput, onChange, label, ticks, pinned }) {
  const r = h('input', { type: 'range', min, max, step, value, 'aria-label': label });
  const setP = () => r.style.setProperty('--p', ((r.value - min) / (max - min)) * 100 + '%');
  setP();
  r.addEventListener('input', () => { setP(); onInput?.(+r.value); });
  r.addEventListener('change', () => onChange?.(+r.value));
  const wrap = h('div', { class: 'cr-ctl' + (pinned ? ' pinned' : '') }, r);
  if (ticks) {
    const t = h('div', { class: 'ticks' });
    for (const [v, txt, on] of ticks) t.append(h('span', { class: on ? 'on' : '', style: { left: ((v - min) / (max - min)) * 100 + '%' } }, txt));
    wrap.append(t);
  }
  return wrap;
}

let toastTimer;
export function toast(text, action) {
  const el = $('#toast'); if (!el) return;
  el.innerHTML = ''; el.append(h('span', {}, text));
  if (action) el.append(h('button', { class: 'linkb', style: { color: '#cfe3a8' }, onClick: () => { action.run(); el.hidden = true; } }, action.label));
  el.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.hidden = true; }, 5200);
}

export function hexToHsl(hex) {
  const n = parseInt(hex.slice(1), 16); let r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b); let hh = 0, s = 0; const l = (mx + mn) / 2;
  if (mx !== mn) { const d = mx - mn; s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn); hh = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; hh *= 60; }
  return [hh, s, l];
}
export function hslToHex(hh, s, l) {
  const k = (n) => (n + hh / 30) % 12, a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return '#' + [f(0), f(8), f(4)].map((v) => Math.round(v * 255).toString(16).padStart(2, '0')).join('');
}
export const validHex = (s) => /^#?[0-9a-f]{6}$/i.test(s.trim());
export const normHex = (s) => '#' + s.trim().replace('#', '').toLowerCase();

/** Sheen ⇄ roughness factor. Five named detents; the slider is sheen = 1 − roughness. */
export const SHEEN = [[0, 'Matte'], [0.2, 'Eggshell'], [0.4, 'Satin'], [0.6, 'Semi-gloss'], [0.8, 'Gloss']];
export const sheenName = (rough) => { const s = 1 - rough; let n = SHEEN[0][1]; for (const [v, name] of SHEEN) if (s >= v - 0.1) n = name; return n; };
