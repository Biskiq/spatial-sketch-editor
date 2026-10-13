// Plan Stage: SVG drawn in screen space from world coordinates every frame of pan/zoom,
// so View markers and route points stay anchored to the world while glyphs keep their size.
import { walls, rooms, objects, LENSES, WALL_T } from './world.js';
import { controlPoints, sampleRoute, pathKey, viewPose } from './camera.js';

const NS = 'http://www.w3.org/2000/svg';
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export class Plan {
  constructor(host, cb) {
    this.host = host; this.cb = cb;
    this.svg = document.createElementNS(NS, 'svg'); this.svg.setAttribute('class', 'plan-svg');
    this.svg.setAttribute('role', 'img'); this.svg.setAttribute('aria-label', 'Plan of the Salon Chopin wing');
    host.appendChild(this.svg);
    this.cam = { cx: 20, cz: 10, ppm: 26 };
    this.tool = null; this.doc = null; this.emph = {};
    this.drag = null; this.hover = null;
    this.svg.addEventListener('pointerdown', (e) => this.down(e));
    window.addEventListener('pointermove', (e) => this.move(e));
    window.addEventListener('pointerup', (e) => this.up(e));
    this.svg.addEventListener('wheel', (e) => { e.preventDefault(); this.zoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * 0.0015)); }, { passive: false });
    new ResizeObserver(() => this.draw()).observe(host);
    this.fitted = false;
  }
  get w() { return this.host.clientWidth; } get h() { return this.host.clientHeight; }
  fit() {
    const w = this.w, h = this.h; if (!w || !h) return;
    // Fit into the Stage area the Card never covers, so opening a Card never needs a camera move.
    // Wide: the Card is a right sheet. Narrow: it is a bottom sheet, so fit above it.
    const app = this.host.closest('.app'); const aw = app ? app.clientWidth : w;
    const rw = aw > 980 ? 324 : 0, rh = aw > 980 ? 0 : Math.round(h * 0.42);
    const ppm = Math.min((w - rw - 40) / 37, (h - rh - 70) / 17.5);
    this.cam = { cx: 20.3 + rw / 2 / ppm, cz: 10 + rh / 2 / ppm, ppm };
    this.fitted = true; this.draw();
  }
  sx(x) { return (x - this.cam.cx) * this.cam.ppm + this.w / 2; }
  sz(z) { return (z - this.cam.cz) * this.cam.ppm + this.h / 2; }
  wx(px) { return (px - this.w / 2) / this.cam.ppm + this.cam.cx; }
  wz(py) { return (py - this.h / 2) / this.cam.ppm + this.cam.cz; }
  local(e) { const r = this.svg.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
  zoomAt(cx, cy, f) {
    const r = this.svg.getBoundingClientRect(); const px = cx - r.left, py = cy - r.top;
    const wx = this.wx(px), wz = this.wz(py);
    this.cam.ppm = Math.min(120, Math.max(8, this.cam.ppm * f));
    this.cam.cx = wx - (px - this.w / 2) / this.cam.ppm; this.cam.cz = wz - (py - this.h / 2) / this.cam.ppm;
    this.draw();
  }
  zoomStep(f) { const r = this.svg.getBoundingClientRect(); this.zoomAt(r.left + r.width / 2, r.top + r.height / 2, f); }

  render(doc, emph) { this.doc = doc; this.emph = emph; if (!this.fitted) this.fit(); else this.draw(); }

  draw() {
    if (!this.doc) return;
    const { doc, emph } = this;
    const P = (x, z) => `${this.sx(x).toFixed(1)},${this.sz(z).toFixed(1)}`;
    const k = this.cam.ppm;
    let s = '';
    // grid (1 m, every 5 m stronger)
    const x0 = Math.floor(this.wx(0)), x1 = Math.ceil(this.wx(this.w)), z0 = Math.floor(this.wz(0)), z1 = Math.ceil(this.wz(this.h));
    s += '<g class="grid">';
    if (k > 14) for (let x = x0; x <= x1; x++) s += `<line x1="${this.sx(x)}" y1="0" x2="${this.sx(x)}" y2="${this.h}" class="${x % 5 ? 'g1' : 'g5'}"/>`;
    if (k > 14) for (let z = z0; z <= z1; z++) s += `<line x1="0" y1="${this.sz(z)}" x2="${this.w}" y2="${this.sz(z)}" class="${z % 5 ? 'g1' : 'g5'}"/>`;
    s += '</g>';
    // rooms
    for (const r of rooms) {
      s += `<polygon class="room room-${r.id}" points="${r.poly.map(([x, z]) => P(x, z)).join(' ')}"/>`;
    }
    for (const r of rooms) if (r.name) s += `<text class="room-label" x="${this.sx(r.label[0])}" y="${this.sz(r.label[1])}" text-anchor="middle">${esc(r.name.toUpperCase())}</text>`;
    // objects
    for (const o of objects) s += this.objectSvg(o, emph.objectId === o.id, emph.subjectId === o.id);
    // walls
    s += '<g class="walls">';
    for (const [ax, az, bx, bz] of walls) s += `<line x1="${this.sx(ax)}" y1="${this.sz(az)}" x2="${this.sx(bx)}" y2="${this.sz(bz)}" stroke-width="${Math.max(3, WALL_T * k)}"/>`;
    s += '</g>';
    // routes
    for (const r of emph.routes || []) s += this.routeSvg(r);
    // views
    const seqIndex = new Map((emph.stopSeq || []).map((id, i) => [id, i + 1]));
    const order = Object.values(doc.views).sort((a, b) => (a.id === emph.viewId) - (b.id === emph.viewId));
    for (const v of order) s += this.viewSvg(v, emph, seqIndex.get(v.id));
    // playback puck
    if (emph.puck) {
      const p = emph.puck; const a = Math.atan2(p.dir[2], p.dir[0]);
      const x = this.sx(p.pos[0]), y = this.sz(p.pos[2]);
      s += `<g class="puck" transform="translate(${x},${y}) rotate(${a * 180 / Math.PI})"><path d="M0,0 L30,-15 A34,34 0 0 1 30,15 Z" class="puck-cone"/><rect x="-9" y="-6" width="14" height="12" rx="2.5" class="puck-body"/></g>`;
    }
    // placement ghost
    if (this.drag && this.drag.kind === 'place') {
      const d = this.drag; const x = this.sx(d.x), y = this.sz(d.z);
      s += `<g class="view-marker placing" transform="translate(${x},${y})"><path transform="rotate(${d.yaw * 180 / Math.PI})" d="${wedge(LENSES.normal.fov, 34)}" class="cone"/><circle r="6" class="dot"/></g>`;
    }
    this.svg.innerHTML = s;
    this.cb.onDraw && this.cb.onDraw();
  }

  objectSvg(o, selected, subject) {
    const k = this.cam.ppm, x = this.sx(o.x), y = this.sz(o.z);
    let g = '';
    if (o.kind === 'piano') {
      const pts = [[-1, -0.74], [-1, 0.74], [-0.1, 0.74], [0.45, 0.6], [0.8, 0.3], [1.2, 0.0], [1.2, -0.42], [0.9, -0.74]];
      g = `<polygon points="${pts.map(([a, b]) => `${(a * k).toFixed(1)},${(b * k).toFixed(1)}`).join(' ')}" class="obj-fill"/><rect x="${-1.28 * k}" y="${-0.68 * k}" width="${0.26 * k}" height="${1.36 * k}" class="obj-line"/>`;
    } else if (o.kind === 'painting') {
      g = `<rect x="${-o.w / 2 * k}" y="${-0.07 * k}" width="${o.w * k}" height="${Math.max(4, 0.16 * k)}" class="obj-art"/>`;
    } else if (o.kind === 'statue') {
      g = `<rect x="${-0.55 * k}" y="${-0.55 * k}" width="${1.1 * k}" height="${1.1 * k}" class="obj-line"/><circle r="${0.34 * k}" class="obj-fill"/>`;
    } else if (o.kind === 'vitrine') {
      g = `<rect x="${-o.w / 2 * k}" y="${-o.d / 2 * k}" width="${o.w * k}" height="${o.d * k}" class="obj-line"/><rect x="${-0.3 * k}" y="${-0.2 * k}" width="${0.6 * k}" height="${0.4 * k}" class="obj-paper"/>`;
    } else if (o.kind === 'bench') {
      g = `<rect x="${-o.w / 2 * k}" y="${-o.d / 2 * k}" width="${o.w * k}" height="${o.d * k}" rx="2" class="obj-bench"/>`;
    } else {
      g = `<rect x="${-o.w / 2 * k}" y="${-o.d / 2 * k}" width="${o.w * k}" height="${o.d * k}" class="obj-line"/><circle r="${0.12 * k}" class="obj-fill"/>`;
    }
    const hw = Math.max(o.w, 0.5) / 2 * k + 7, hd = Math.max(o.d, 0.5) / 2 * k + 7;
    const br = selected ? `<path class="sel-ring" d="${brackets(hw, hd)}"/>` : '';
    const label = selected || this.hover === o.id ? `<text class="obj-label" y="${hd + 15}" text-anchor="middle">${esc(o.name)}</text>` : '';
    return `<g class="obj${selected ? ' is-selected' : ''}${subject ? ' is-subject' : ''}" data-obj="${o.id}" transform="translate(${x},${y})"><rect class="hit" x="${-hw}" y="${-hd}" width="${hw * 2}" height="${hd * 2}"/>${g}${br}${label}</g>`;
  }

  viewSvg(v, emph, seqN) {
    const p = viewPose(v), x = this.sx(v.pos[0]), y = this.sz(v.pos[2]);
    const sel = emph.viewId === v.id, mine = !emph.presId || emph.presId === v.presId;
    const isDefault = this.doc.presentations.find((pp) => pp.id === v.presId)?.defaultViewId === v.id;
    const deg = v.yaw * 180 / Math.PI;
    const len = sel ? 46 : 32;
    const cls = ['view-marker', sel && 'is-selected', !mine && 'is-dim', seqN && 'in-seq'].filter(Boolean).join(' ');
    let s = `<g class="${cls}" data-view="${v.id}" transform="translate(${x},${y})">`;
    s += `<path transform="rotate(${deg})" d="${wedge(p.fov, len)}" class="cone"/>`;
    if (sel) s += `<g transform="rotate(${deg})"><line x1="0" y1="0" x2="${len + 8}" y2="0" class="aim-line"/><circle cx="${len + 8}" cy="0" r="6.5" class="aim-handle" data-aim="${v.id}"><title>Drag to aim</title></circle></g>`;
    s += `<circle r="${sel ? 7.5 : 5.5}" class="dot"/>`;
    if (isDefault && mine) s += `<path d="M0,-12.5 L3.4,-9 L0,-5.5 L-3.4,-9 Z" class="default-mark"><title>Default View</title></path>`;
    if (seqN) s += `<g class="seq-badge" transform="translate(-13,-13)"><circle r="8"/><text y="3.6" text-anchor="middle">${seqN}</text></g>`;
    if (sel) s += `<path class="sel-ring" d="${brackets(13, 13)}"/>`;
    if (sel || (mine && emph.presId) || seqN || this.hover === v.id) {
      const flip = Math.cos(v.yaw) > 0.3 ? -1 : 1;
      s += `<text class="view-label${sel ? ' strong' : ''}" x="${flip * 12}" y="${Math.sin(v.yaw) > 0.5 ? -12 : 18}" text-anchor="${flip < 0 ? 'end' : 'start'}">${esc(v.name)}</text>`;
    }
    return s + '</g>';
  }

  routeSvg(r) {
    const doc = this.doc, from = doc.views[r.from], to = doc.views[r.to];
    if (!from || !to) return '';
    const key = pathKey(r.from, r.to);
    if (r.mode === 'cut') {
      const a = [this.sx(from.pos[0]), this.sz(from.pos[2])], b = [this.sx(to.pos[0]), this.sz(to.pos[2])];
      const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
      return `<g class="route cut${r.selected ? ' is-selected' : ''}" data-route="${key}"><line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" class="cut-line"/><g transform="translate(${mx},${my})"><rect x="-17" y="-9" width="34" height="18" rx="9" class="cut-chip"/><text y="4" text-anchor="middle" class="cut-text">CUT</text></g></g>`;
    }
    const cps = controlPoints(from, to, doc.paths[key]);
    const pts = sampleRoute(cps, 20);
    const d = 'M' + pts.map(([x, z]) => `${this.sx(x).toFixed(1)},${this.sz(z).toFixed(1)}`).join(' L');
    let s = `<g class="route travel${r.selected ? ' is-selected' : ''}${r.warn ? ' is-warn' : ''}" data-route="${key}">`;
    s += `<path d="${d}" class="route-hit" data-insert="${key}"/><path d="${d}" class="route-line"/>`;
    // direction chevrons
    for (let i = 8; i < pts.length - 4; i += 14) {
      const [x, z] = pts[i], [x2, z2] = pts[i + 1];
      const a = Math.atan2(z2 - z, x2 - x) * 180 / Math.PI;
      s += `<path transform="translate(${this.sx(x)},${this.sz(z)}) rotate(${a})" d="M-4,-4 L2,0 L-4,4" class="chev"/>`;
    }
    if (r.selected) (doc.paths[key]?.points || []).forEach(([x, z], i) => {
      const ps = this.emph.pointSel; const on = ps && ps.key === key && ps.i === i;
      s += `<g class="route-pt${on ? ' is-selected' : ''}" data-pt="${key}|${i}" transform="translate(${this.sx(x)},${this.sz(z)})"><circle r="11" class="pt-hit"/><circle r="${on ? 7 : 5.5}" class="pt"/></g>`;
    });
    return s + '</g>';
  }

  // ——— interaction ———
  down(e) {
    if (e.button !== 0) return;
    const [px, py] = this.local(e), t = e.target;
    const wx = this.wx(px), wz = this.wz(py);
    this.svg.setPointerCapture?.(e.pointerId);
    if (this.tool === 'place') { this.drag = { kind: 'place', x: wx, z: wz, yaw: 0, sx: px, sy: py }; this.draw(); return; }
    const aim = t.closest('[data-aim]'), pt = t.closest('[data-pt]'), ins = t.closest('[data-insert]'), vm = t.closest('[data-view]'), ob = t.closest('[data-obj]'), rt = t.closest('[data-route]');
    if (aim) this.drag = { kind: 'aim', id: aim.dataset.aim, moved: false };
    else if (pt) { const [key, i] = pt.dataset.pt.split('|'); this.drag = { kind: 'pt', key, i: +i, sx: px, sy: py, moved: false }; this.cb.onPick({ type: 'point', key, i: +i }); }
    else if (vm) this.drag = { kind: 'view', id: vm.dataset.view, sx: px, sy: py, moved: false, ox: this.doc.views[vm.dataset.view].pos[0] - wx, oz: this.doc.views[vm.dataset.view].pos[2] - wz };
    else if ((ins || rt) && this.isEditableRoute((ins || rt).dataset.insert || (ins || rt).dataset.route)) { const k = (ins || rt).dataset.insert || (ins || rt).dataset.route; this.cb.onInsertPoint(k, wx, wz); }
    else if (rt) this.drag = { kind: 'route', key: rt.dataset.route, sx: px, sy: py, moved: false };
    else if (ob) this.drag = { kind: 'obj', id: ob.dataset.obj, sx: px, sy: py, moved: false };
    else this.drag = { kind: 'pan', sx: px, sy: py, cx: this.cam.cx, cz: this.cam.cz, moved: false };
  }
  isEditableRoute(key) { return !!this.emph.routes?.find((r) => r.selected && r.mode !== 'cut' && pathKey(r.from, r.to) === key); }
  move(e) {
    if (!this.drag) {
      if (e.target && this.svg.contains(e.target)) {
        const h = e.target.closest?.('[data-obj],[data-view]'); const id = h ? (h.dataset.obj || h.dataset.view) : null;
        if (id !== this.hover) { this.hover = id; this.draw(); }
        this.svg.style.cursor = this.tool === 'place' ? 'crosshair' : '';
      }
      return;
    }
    const [px, py] = this.local(e), d = this.drag;
    const far = Math.hypot(px - (d.sx ?? px), py - (d.sy ?? py)) > 4;
    if (d.kind === 'pan') { if (far) d.moved = true; this.cam.cx = d.cx - (px - d.sx) / this.cam.ppm; this.cam.cz = d.cz - (py - d.sy) / this.cam.ppm; this.draw(); }
    else if (d.kind === 'place') { if (Math.hypot(px - d.sx, py - d.sy) > 6) d.yaw = Math.atan2(py - d.sy, px - d.sx); this.draw(); }
    else if (d.kind === 'view' && (far || d.moved)) { d.moved = true; this.cb.onMoveView(d.id, this.wx(px) + d.ox, this.wz(py) + d.oz, false); }
    else if (d.kind === 'aim') { d.moved = true; const v = this.doc.views[d.id]; this.cb.onAimView(d.id, Math.atan2(this.wz(py) - v.pos[2], this.wx(px) - v.pos[0]), false); }
    else if (d.kind === 'pt' && (far || d.moved)) { d.moved = true; this.cb.onMovePoint(d.key, d.i, this.wx(px), this.wz(py), false); }
  }
  up(e) {
    const d = this.drag; if (!d) return; this.drag = null;
    if (d.kind === 'place') { this.cb.onPlace(d.x, d.z, d.yaw); return; }
    if (d.kind === 'pan' && !d.moved) this.cb.onPick(null);
    if (d.kind === 'view') { if (d.moved) this.cb.onMoveView(d.id, null, null, true); else this.cb.onPick({ type: 'view', id: d.id }); }
    if (d.kind === 'aim' && d.moved) this.cb.onAimView(d.id, null, true);
    if (d.kind === 'pt' && d.moved) this.cb.onMovePoint(d.key, d.i, null, null, true);
    if (d.kind === 'obj') this.cb.onPick({ type: 'object', id: d.id });
    if (d.kind === 'route') this.cb.onPick({ type: 'route', key: d.key });
  }
}

function wedge(fov, len) {
  const a = (fov * Math.PI / 180) / 2;
  const x = Math.cos(a) * len, y = Math.sin(a) * len;
  return `M0,0 L${x.toFixed(1)},${(-y).toFixed(1)} A${len},${len} 0 0 1 ${x.toFixed(1)},${y.toFixed(1)} Z`;
}
function brackets(hw, hh) {
  const c = 6;
  return `M${-hw},${-hh + c} V${-hh} H${-hw + c} M${hw - c},${-hh} H${hw} V${-hh + c} M${hw},${hh - c} V${hh} H${hw - c} M${-hw + c},${hh} H${-hw} V${hh - c}`;
}
export { brackets };
