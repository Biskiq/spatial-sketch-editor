import { S } from './state.js';

const NS = 'http://www.w3.org/2000/svg';

function defaultPri(cls) {
  // the value being dragged or edited must stay available, even against a handle beside it
  if (/\bactive\b/.test(cls)) return 96;
  if (/\bwarn\b/.test(cls)) return 92;
  if (/\bedit\b/.test(cls)) return 88;
  if (/\bletter\b/.test(cls)) return 80;
  if (/\bquiet\b|\bref\b|datum-tag/.test(cls)) return 22;
  return 50;
}

// Keyed element pool: overlays are redrawn every frame, but elements persist so
// hover and in-progress drags survive.
export class Overlay {
  constructor(svg, html) {
    this.svg = svg;
    this.html = html;
    this.pool = new Map();
    this.frame = 0;
    this.specs = new Map();
  }

  begin() { this.frame++; this.specs.clear(); }

  end() {
    for (const [k, e] of this.pool) {
      if (e._f !== this.frame) { e.remove(); this.pool.delete(k); }
    }
    this.declutter();
  }

  // Labels yield to each other by priority instead of stacking: handles are never hidden and
  // claim their space first; a lower-priority label that would overlap anything placed is hidden.
  declutter() {
    const items = [];
    for (const e of this.html.children) {
      if (e._f !== this.frame) continue;
      items.push({ e, r: e.getBoundingClientRect(), pri: e.dataset.h ? 1000 : e._pri ?? 50 });
    }
    items.sort((a, b) => b.pri - a.pri);
    const placed = [];
    const hit = (a, b) => a.left < b.right - 2 && b.left < a.right - 2 && a.top < b.bottom - 1 && b.top < a.bottom - 1;
    for (const it of items) {
      const hide = it.pri < 1000 && it.r.width > 0 && placed.some((p) => hit(p, it.r));
      if (!hide && it.r.width > 0) placed.push(it.r);
      const v = hide ? 'hidden' : '';
      if (it.e.style.visibility !== v) it.e.style.visibility = v;
    }
  }

  get(key, tag, isSvg) {
    let e = this.pool.get(key);
    if (!e || e._tag !== tag) {
      if (e) e.remove();
      e = isSvg ? document.createElementNS(NS, tag) : document.createElement(tag);
      e._tag = tag;
      (isSvg ? this.svg : this.html).appendChild(e);
      this.pool.set(key, e);
    }
    e._f = this.frame;
    return e;
  }

  setCls(e, cls) { if (e._cls !== cls) { e.setAttribute('class', cls); e._cls = cls; } }
  setHtml(e, html) {
    if (e._html === html && !this.stale(e)) return;
    e.innerHTML = html;
    e._html = html;
  }

  // A pooled control's displayed value must never outlive the value it was rendered from. Typing writes
  // the input's value property, not the markup, so a later render that produces the same markup would
  // otherwise leave a dropped or declined draft on screen. The field being typed in is left alone.
  stale(e) {
    for (const i of e.querySelectorAll('input[value]')) {
      if (i !== document.activeElement && i.value !== i.getAttribute('value')) return true;
    }
    return false;
  }

  chip(key, x, y, html, cls = 'tape', attrs = {}) {
    // An editable number is a control: give it the same keyboard activation as any other button.
    const e = this.get(key, attrs.tag || (attrs['data-edit'] ? 'button' : 'div'));
    this.setCls(e, cls);
    this.setHtml(e, html);
    e.style.left = `${x.toFixed(1)}px`;
    e.style.top = `${y.toFixed(1)}px`;
    // A pooled label can be reassigned (an editable value becomes a reference or back), so a
    // wrapper attribute from its previous role must never survive into this frame.
    // Experience switches a pooled grip between an activation button and the one live gesture.
    // World retains its established overlay metadata contract.
    const previous = /\bexp-/.test(cls) ? (e._attrs || []) : [];
    for (const k of new Set(['data-edit', 'data-sel', 'data-gap', ...previous])) {
      if (!(k in attrs) && e.hasAttribute(k)) e.removeAttribute(k);
    }
    for (const [k, v] of Object.entries(attrs)) if (k !== 'tag' && k !== 'pri' && e.getAttribute(k) !== String(v)) e.setAttribute(k, v);
    if(/\bexp-/.test(cls))e._attrs = Object.keys(attrs).filter(k=>k!=='tag'&&k!=='pri');
    e._pri = /\bactive\b/.test(cls) ? Math.max(attrs.pri ?? 0, 96) : (attrs.pri ?? defaultPri(cls));
    return e;
  }

  handle(key, x, y, spec, cls = 'handle') {
    const e = this.chip(key, x, y, spec.label || '', cls, { 'data-h': key, tag: 'button', 'aria-label': spec.aria || spec.label || 'handle' });
    this.specs.set(key, spec);
    return e;
  }

  path(key, pts, cls, closed = false, attrs = {}) {
    const e = this.get(key, 'path', true);
    this.setCls(e, cls);
    const d = pts.length ? 'M' + pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join('L') + (closed ? 'Z' : '') : '';
    if (e._d !== d) { e.setAttribute('d', d); e._d = d; }
    for (const [k, v] of Object.entries(attrs)) if (e.getAttribute(k) !== String(v)) e.setAttribute(k, v);
    return e;
  }

  line(key, a, b, cls) { return this.path(key, [a, b], cls); }

  text(key, x, y, str, cls) {
    const e = this.get(key, 'text', true);
    this.setCls(e, cls);
    if (e.textContent !== str) e.textContent = str;
    e.setAttribute('x', x.toFixed(1));
    e.setAttribute('y', y.toFixed(1));
    return e;
  }
}
