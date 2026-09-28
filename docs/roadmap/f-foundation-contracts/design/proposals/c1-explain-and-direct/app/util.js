// Small shared helpers. No product meaning lives here.

export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (t) => { t = clamp(t); return t * t * (3 - 2 * t); };
export const smoother = (t) => { t = clamp(t); return t * t * t * (t * (t * 6 - 15) + 10); };
export const easeInOut = (t) => { t = clamp(t); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
export const clone = (o) => (o === undefined ? undefined : JSON.parse(JSON.stringify(o)));
export const deg = (r) => (r * 180) / Math.PI;
export const rad = (d) => (d * Math.PI) / 180;

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// 0:04.2 — Stop-local times are always shown this way.
export function secs(t, precise = true) {
  const s = Math.max(0, t || 0);
  const m = Math.floor(s / 60);
  const r = s - m * 60;
  return m + ':' + (precise ? r.toFixed(1).padStart(4, '0') : String(Math.floor(r)).padStart(2, '0'));
}

export const metres = (v) => (v ?? 0).toFixed(2) + ' m';
export const times = (v) => '×' + (v ?? 1).toFixed(2).replace(/0$/, '');

export function plural(n, one, many) { return n + ' ' + (n === 1 ? one : many || one + 's'); }

export function ordinal(n) { return ['first', 'second', 'third', 'fourth', 'fifth'][n - 1] || n + 'th'; }

export function lerp3(a, b, t) { return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]; }
export function sub3(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
export function add3(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
export function scale3(a, s) { return [a[0] * s, a[1] * s, a[2] * s]; }
export function len3(a) { return Math.hypot(a[0], a[1], a[2]); }
export function norm3(a) { const l = len3(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }
export function dist3(a, b) { return len3(sub3(a, b)); }
