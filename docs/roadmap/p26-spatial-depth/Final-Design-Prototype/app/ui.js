import { S, ctx, W, C, thing, refOf } from './state.js';
import {
  wallLength, frameAt, fmt, maxTop, topAt, springOf, centroid, planeY, byId, FLOOR_Y, modS, bbox,
} from './model.js';
import {
  memberOf, viewKind, viewLabel, lidRelations, gapOptions, lookWord, knifeCut, editOnce,
  applyOpening, applyWallTop, applyCeiling, setTopForm, setProfile, deg, whereIs, crumbs,
} from './actions.js';

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const J = (o) => esc(JSON.stringify(o));

let queued = false;
export function requestUI() {
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => { queued = false; renderUI(); });
}

export function renderUI() {
  renderHead();
  renderViewBar();
  renderStrip();
  renderNavigator();
  renderInspector();
  renderTray();
  renderStatus();
  renderPopover();
  renderWhereStatic();
  renderSummary();
}

// ---------------------------------------------------------------- after the chain closes

function renderSummary() {
  const el = $('#summary');
  const sm = S.summary;
  if (!sm || S.session) { el.hidden = true; el._html = ''; return; }
  const n = sm.labels.length;
  const html = `<div class="sm-t"><b>View restored.</b> The ${n} building change${n > 1 ? 's' : ''} you made while it was open stay${n > 1 ? '' : 's'}:</div><ul>${sm.labels.map((l) => `<li>${esc(l)}</li>`).join('')}</ul><div class="sm-acts"><button class="btn" data-act="summary-undo">Undo ${n > 1 ? 'these' : 'it'}</button><button class="btn ghost" data-act="summary-keep">Keep</button></div>`;
  if (el._html !== html) { el.innerHTML = html; el._html = html; }
  el.hidden = false;
}

// ---------------------------------------------------------------- head

function renderHead() {
  const u = S.undo[S.undo.length - 1], r = S.redo[S.redo.length - 1];
  const ub = $('#undoBtn'), rb = $('#redoBtn');
  ub.disabled = !u; rb.disabled = !r;
  ub.title = u ? `Undo “${u.label}” (⌘Z)` : 'Nothing to undo';
  rb.title = r ? `Redo “${r.label}” (⇧⌘Z)` : 'Nothing to redo';
  $('#undoLabel').textContent = u ? u.label : 'No building changes yet';
  $('#undoCount').textContent = S.undo.length ? String(S.undo.length) : '';
  $('#docState').textContent = S.undo.length ? `${S.undo.length} change${S.undo.length > 1 ? 's' : ''} · saved` : 'All changes saved';
}

// ---------------------------------------------------------------- view bar

function renderViewBar() {
  const k = viewKind();
  const inSession = !!S.session;
  $('#tabPlan').classList.toggle('on', k === 'plan' && !inSession);
  $('#tabPlan').setAttribute('aria-pressed', String(k === 'plan' && !inSession));
  $('#tab3d').classList.toggle('on', (k === '3d' || inSession) && !(k === 'plan'));
  $('#tab3d').setAttribute('aria-pressed', String(k === '3d'));
  const from = S.session ? (S.session.origin.label.startsWith('Plan') ? 'plan' : '3d') : null;
  $('#tabPlan').classList.toggle('origin', from === 'plan');
  $('#tab3d').classList.toggle('origin', from === '3d');
}

// per-frame: the bead shows where the one camera sits between Plan and 3D
export function updateTilt() {
  const el = deg(ctx.stage.cam.el);
  const t = Math.max(0, Math.min(1, (el - 20) / 70));
  const bead = $('#tiltBead');
  bead.style.left = `${(1 - t) * 100}%`;
  bead.classList.toggle('settled', ctx.stage.cam.flat > 0.95 && !S.session);
  $('#tilt').classList.toggle('locked', !!S.session);
}

// ---------------------------------------------------------------- instrument strip

function renderStrip() {
  const el = $('#strip');
  const s = S.session;
  const k = S.knife;
  if (!s && !k) { el.hidden = true; document.body.classList.remove('instrument'); return; }
  el.hidden = false;
  document.body.classList.add('instrument');
  let html = '';
  if (k) {
    const cut = knifeCut();
    html = `<span class="st-kind">Open along a line</span>`;
    if (!cut) html += `<span class="st-meta">Press and drag across the museum in Plan or 3D. Nothing opens until you say so.</span>`;
    else html += `<span class="st-title">${esc(lookWord(cut))}</span>${depthCtl(cut.depth)}<button class="st-btn" data-act="knife-flip">Look the other way <kbd>Tab</kbd></button><button class="st-btn primary" data-act="knife-open">Open it <kbd>↵</kbd></button>`;
    html += `<button class="st-btn ghost" data-act="knife-cancel">Cancel <kbd>Esc</kbd></button>`;
  } else {
    // where you are, as a path: the durable view you came from, then each open state it passed through.
    // Esc steps back one crumb; the first crumb (or ⇧Esc) puts everything back.
    const cs = crumbs();
    html = `<nav class="st-crumbs" aria-label="Open states"><button class="st-crumb root" data-act="crumb" data-depth="-1" title="Put everything back and return (⇧Esc)">${esc(s.origin.label)}</button>`;
    cs.forEach((c, i) => { html += `<span class="st-chev">›</span><button class="st-crumb" data-act="crumb" data-depth="${i}" title="Back to this, exactly as you left it">${esc(shortLabel(c))}</button>`; });
    html += `<span class="st-chev">›</span></nav>`;
    const id = (kind, title, view = true) => `<span class="st-id"><span class="st-kind"><span id="stKind">${kind}</span><span id="stView" class="st-view" title="Nothing here is a building change — it all goes back when you leave">${view ? ' · view only' : ''}</span></span><span class="st-title" title="${esc(title)}">${esc(title)}</span></span>`;
    if (s.kind === 'face') {
      const w = s.wall;
      html += id('Facing', s.focusName, s.u > 0.015);
      html += `<span class="st-seg" role="radiogroup" aria-label="Which side you stand on"><button class="${s.side === 1 ? 'on' : ''}" data-act="side-in" aria-checked="${s.side === 1}">${w.kind === 'arc' ? 'Inside' : 'Room side'}</button><button class="${s.side === -1 ? 'on' : ''}" data-act="side-out" aria-checked="${s.side === -1}">Outside</button></span>`;
      if (w.kind === 'arc') {
        html += `<span class="st-wrap" role="group" aria-label="Curvature of the wall in this view" title="From the round building to the flat sheet — lengths along the wall never change">`;
        html += [[0, '360°'], [0.5, '180°'], [1, 'Flat']].map(([u, l]) => `<button data-unroll="${u}">${l}</button>`).join('');
        html += `<input class="st-range" type="range" min="0" max="1" step="0.005" data-scrub="unroll" aria-label="Curvature: drag from round to flat"><b id="wrapDeg">360°</b></span>`;
      }
      html += `<span class="st-seg stand" role="group" aria-label="Where to stand"><button data-act="square" title="Stand square: the picture becomes to scale (S)">Square</button><button data-act="stepback" title="Step back into 3D — handles you can read stay live">3D</button></span>`;
    } else if (s.kind === 'section') {
      const counts = sectionCounts();
      html += id('Opened along a line', lookWord(s.cut)) + depthCtl(s.cut.depth);
      html += counts.beyond ? `<span class="st-chip warn" title="${esc(counts.beyondNames.join(', '))}">${counts.beyond} beyond depth</span>` : `<span class="st-chip">everything within depth</span>`;
    } else if (s.kind === 'lift') {
      const c = C(s.ceilId);
      const rels = lidRelations(c);
      const meets = rels.filter((r) => r.status !== 'gap').length;
      html += id('Lifted', c.name) + `<span class="st-meta">${c.rel === 'closure' ? `${meets} of ${rels.length} walls meet it` : 'suspended · hangs free of the walls'}</span>`;
      html += `<button class="st-btn primary" data-act="lookup">Look up <kbd>U</kbd></button>`;
    } else if (s.kind === 'lookup') {
      const c = C(s.ceilId);
      html += id('Looking up', c.name, false) + `<span class="st-meta">sliced at <b>1.60</b></span>`;
      html += `<button class="st-btn ${ctx.stage.cam.mirror ? 'on' : ''}" data-act="mirror" aria-pressed="${ctx.stage.cam.mirror}">Mirror <kbd>M</kbd></button>`;
    }
    html += s.parent
      ? `<button class="st-btn close" data-act="close" title="Back to ${esc(shortLabel(s.parent))}, exactly as you left it">Back <kbd>Esc</kbd></button>`
      : `<button class="st-btn close" data-act="close" title="Put everything back and return to ${esc(s.origin.label)}">Put it back <kbd>Esc</kbd></button>`;
  }
  if (el._html !== html) { el.innerHTML = html; el._html = html; }
}

function shortLabel(r) {
  if (r.kind === 'section') return 'Section';
  if (r.kind === 'lift') return 'Lifted';
  if (r.kind === 'lookup') return 'Looking up';
  if (r.kind === 'face') return r.label.replace(/^Facing /, '');
  return r.label;
}

// per-frame: the curvature readout follows the wall without re-rendering the strip
export function updateStripLive() {
  const s = S.session;
  if (s?.kind !== 'face') return;
  const kind = document.getElementById('stKind');
  const deg = Math.round(360 * (1 - s.u));
  const k = s.u > 0.985 ? 'Laid flat' : s.u > 0.015 ? 'Unrolled' : 'Facing';
  if (kind && kind.textContent !== k) kind.textContent = k;
  const vo = document.getElementById('stView');
  const v = s.u > 0.015 ? ' · view only' : '';
  if (vo && vo.textContent !== v) vo.textContent = v;
  if (s.wall.kind !== 'arc') return;
  const out = document.getElementById('wrapDeg');
  if (out) out.textContent = s.u > 0.985 ? 'flat' : `${deg}°`;
  const range = document.querySelector('[data-scrub="unroll"]');
  if (range && document.activeElement !== range) range.value = s.u.toFixed(3);
  document.querySelectorAll('[data-unroll]').forEach((b) => b.classList.toggle('on', Math.abs(+b.dataset.unroll - s.u) < 0.01));
}

function depthCtl(d) {
  return `<span class="st-depth" title="How far in to include. A view setting, not an edit.">depth<button data-act="depth-" aria-label="Less depth">−</button><b data-drag="depth">${fmt(d)}</b><span class="u">m</span><button data-act="depth+" aria-label="More depth">+</button></span>`;
}

export function sectionCounts() {
  const out = { beyond: 0, away: 0, beyondNames: [] };
  const ids = [...ctx.museum.walls.map((w) => w.id), ...ctx.museum.art.map((a) => a.id), ...ctx.museum.objects.map((o) => o.id)];
  for (const id of ids) {
    const m = memberOf(id);
    if (m.state === 'beyond') { out.beyond++; out.beyondNames.push(thing(id).item.name); }
    if (m.state === 'away') out.away++;
  }
  return out;
}

// ---------------------------------------------------------------- navigator

const BADGE = {
  flat: ['laid flat', 'moved'], opened: ['unrolled', 'moved'], facing: ['facing', 'quiet'], aside: ['set aside', 'quiet'], cut: ['cut', 'cut'],
  away: ['opened away', 'away'], beyond: ['beyond depth', 'away'], lifted: ['lifted', 'moved'],
};

function row(id, name, glyph, cls = '') {
  const m = memberOf(id);
  let b = BADGE[m.state];
  if (S.reveal && (S.reveal === id)) b = ['revealed', 'moved'];
  const badge = b ? `<span class="state ${b[1]}">${b[0]}</span>` : '';
  const sel = S.sel === id ? ' sel' : '';
  return `<div class="nv-row ${cls}${sel}" data-sel="${id}" role="treeitem" aria-selected="${S.sel === id}" tabindex="-1"><span class="glyph ${glyph}"></span><span class="nv-name">${esc(name)}</span><span class="nv-ref">${esc(refOf(id))}</span>${badge}</div>`;
}

function renderNavigator() {
  const m = ctx.museum;
  let html = `<div class="nv-head"><span class="nv-title">Scene · Layout</span><span class="nv-datum" title="World elevation of the floor datum">floor +${fmt(FLOOR_Y)}</span></div>`;
  for (const g of m.galleries) {
    const walls = m.walls.filter((w) => w.gallery === g.id);
    const ceils = m.ceilings.filter((c) => c.gallery === g.id);
    const art = m.art.filter((a) => W(a.wall).gallery === g.id);
    const objs = m.objects.filter((o) => (g.id === 'rotunda' ? o.x > 0 : o.x <= 0));
    const main = ceils.find((c) => c.rel === 'closure');
    html += `<div class="nv-gallery"><div class="nv-gname">${esc(g.name)}<span class="nv-gref">${g.ref}</span><span class="nv-gh">${main ? fmt(main.plane.base) : ''}</span></div>`;
    html += `<div class="nv-group">Architecture</div>`;
    for (const w of walls) {
      html += row(w.id, w.name, w.kind === 'arc' ? 'arc' : 'wall');
      for (const o of w.openings) html += row(o.id, o.name, 'open', 'sub');
    }
    for (const c of ceils) html += row(c.id, c.name, c.rel === 'suspended' ? 'ceil susp' : 'ceil');
    html += `<div class="nv-group">On display <span class="nv-note">Scene · passive here</span></div>`;
    for (const a of art) html += row(a.id, a.name, 'art', 'scene');
    for (const o of objs) html += row(o.id, o.name, 'obj', 'scene');
    html += `</div>`;
  }
  const el = $('#nav');
  if (el._html !== html) { el.innerHTML = html; el._html = html; }
}

// ---------------------------------------------------------------- inspector

function field(label, spec, value, opts = {}) {
  const err = S.fieldErr && S.fieldErr.key === JSON.stringify(spec) ? S.fieldErr.msg : null;
  return `<label class="pf${err ? ' bad' : ''}${opts.readonly ? ' ro' : ''}"><span class="pk">${label}</span><span class="pv"><input data-field="${J(spec)}" value="${fmt(value)}" inputmode="decimal" ${opts.readonly ? 'readonly tabindex="-1"' : ''} aria-label="${esc(label)}"><span class="pu">m</span></span>${opts.hint ? `<span class="ph">${opts.hint}</span>` : ''}${err ? `<span class="perr">${esc(err)}</span>` : ''}</label>`;
}

function seg(name, spec, options, value) {
  return `<div class="pseg" role="radiogroup" aria-label="${esc(name)}">${options.map(([v, l]) => `<button role="radio" aria-checked="${v === value}" class="${v === value ? 'on' : ''}" data-seg="${J({ ...spec, value: v })}">${l}</button>`).join('')}</div>`;
}

// Where is it, and what can you do about it — the same resolver Find and the beacon read.
// Combines D's "why can't I see it" with B's recovery: include it, show it through, go to its host.
function where(id) {
  const r = whereIs(id);
  const t = thing(id);
  const s = S.session;
  const act = (a, label, primary) => `<button class="w-act${primary ? ' primary' : ''}" data-act="${a}">${label}</button>`;
  const hostWord = t.kind === 'ceilings' ? 'Lift it' : t.kind === 'walls' ? 'Face it' : 'Go to its wall';
  const block = (cls, text, acts = []) => `<div class="where ${cls}"><span class="dot"></span><div><span>${text}</span>${acts.length ? `<div class="w-acts">${acts.join('')}</div>` : ''}</div></div>`;
  if (r.state === 'beyond' || r.state === 'away') {
    const revealed = S.reveal && (S.reveal === id || (t.kind === 'openings' && S.reveal === t.wall.id));
    const acts = [];
    if (r.state === 'beyond') acts.push(act('include', `Include it · depth ${fmt(r.need)}`, true));
    acts.push(act('reveal', revealed ? 'Stop showing' : 'Show it through'));
    if (t.kind !== 'objects') acts.push(act('gohost', hostWord));
    return block('warn', `<b>${r.state === 'beyond' ? 'Beyond depth' : 'Opened away'}</b> — ${esc(r.reason)}. Still selected; nothing was deleted.`, acts);
  }
  if (r.state === 'aside') return block('quiet', `Set aside while you face the ${esc(s.wall.name)}.`, t.kind === 'walls' || t.kind === 'openings' || t.kind === 'art' ? [act('faceit', 'Face it instead')] : []);
  if (r.state === 'off') return block('quiet', `Out of frame — ${esc(r.reason)}.`, [act('lookat', 'Bring it into view', true)]);
  if (r.state === 'behind') return block('quiet', `Hidden ${esc(r.reason)}.`, [act('lookat', 'Look at it', true), ...(t.kind !== 'objects' && t.kind !== 'ceilings' ? [act('faceit', 'Face it')] : [])]);
  if (r.state === 'flat') return block('moved', 'Laid flat for this view — the dashed ring is where it stands. Folds back when you leave.');
  if (r.state === 'opened') return block('moved', `Unrolled to ${Math.round(360 * (1 - s.u))}° for this view. It never stretches, so every number is measured along the real wall.`);
  if (r.state === 'lifted') return block('moved', 'Lifted 2.60 for this view — the dashed outline is where it really is.');
  if (r.state === 'cut') return `<div class="where"><span class="dot ok"></span><span>The line passes through it.</span></div>`;
  return '';
}

function renderInspector() {
  const el = $('#insp');
  const id = S.sel;
  const t = thing(id);
  let html = '';
  if (!t) {
    html = `<div class="in-empty"><div class="in-k">Nothing selected</div><p>Select a wall, an opening or a ceiling — in the view or the Navigator. The selection stays with you through every view.</p>
    <div class="in-sec">Ways to look</div>
    <button class="verb" data-act="knife"><span class="vg cut"></span>Open along a line<kbd>K</kbd></button>
    <button class="verb" data-act="plan"><span class="vg plan"></span>Plan<kbd>1</kbd></button>
    <button class="verb" data-act="3d"><span class="vg three"></span>3D<kbd>2</kbd></button></div>`;
  } else if (t.kind === 'walls') html = inspectWall(t.item);
  else if (t.kind === 'openings') html = inspectOpening(t.item, t.wall);
  else if (t.kind === 'ceilings') html = inspectCeiling(t.item);
  else html = inspectScene(t);
  if (el._html !== html) {
    const focused = document.activeElement?.dataset?.field;
    el.innerHTML = html;
    el._html = html;
    if (focused) el.querySelector(`[data-field='${CSS.escape ? focused : focused}']`)?.focus?.();
  }
}

function head(kicker, title, sub) {
  return `<div class="in-head"><div class="in-k">${kicker}</div><div class="in-t">${esc(title)}</div>${sub ? `<div class="in-s">${sub}</div>` : ''}</div>`;
}

function inspectWall(w) {
  const L = wallLength(w);
  const p = w.top;
  let html = head(`${w.kind === 'arc' ? 'Curved wall' : 'Wall'} · ${w.ref}`, w.name, `${esc(byId(ctx.museum.galleries, w.gallery).name)} · ${fmt(L)} m${w.kind === 'arc' ? ' around' : ''} · ${fmt(w.thick)} thick`);
  html += where(w.id);
  const s = S.session;
  const facingThis = s?.kind === 'face' && s.wallId === w.id;
  html += `<div class="in-acts">`;
  if (!facingThis) html += `<button class="verb" data-act="face"><span class="vg face"></span>Face it<kbd>F</kbd></button>`;
  if (w.kind === 'arc' && !(facingThis && s.u > 0.5)) html += `<button class="verb" data-act="unfold"><span class="vg unfold"></span>Unfold it flat<kbd>O</kbd></button>`;
  html += `</div>`;
  html += `<div class="in-sec">Top</div>`;
  html += seg('Top form', { type: 'form', wall: w.id }, [['constant', 'Level'], ['slope', 'Slope'], ['gable', 'Gable']], p.form);
  if (p.form === 'constant') html += field('Height', { type: 'top', wall: w.id, key: 'h' }, p.h, { hint: `top at world ${fmt(p.h + FLOOR_Y)}` });
  else if (p.form === 'slope') {
    html += field('At start', { type: 'top', wall: w.id, key: 'h0' }, p.h0);
    html += field('At end', { type: 'top', wall: w.id, key: 'h1' }, p.h1);
  } else {
    html += field(w.closed ? 'At the low point' : 'At start', { type: 'top', wall: w.id, key: 'h0' }, p.h0);
    html += field('Ridge height', { type: 'top', wall: w.id, key: 'rh' }, p.rh);
    html += field('Ridge along wall', { type: 'top', wall: w.id, key: 'rs' }, p.rs, { hint: 'distance along the wall from its start' });
    if (!w.closed) html += field('At end', { type: 'top', wall: w.id, key: 'h1' }, p.h1);
  }
  const rel = wallCeilingNote(w);
  if (rel) html += rel;
  if (w.openings.length) {
    html += `<div class="in-sec">Openings</div><div class="chips">${w.openings.map((o) => `<button class="chip-btn" data-sel="${o.id}">${esc(o.name)}</button>`).join('')}</div>`;
  }
  return html;
}

function wallCeilingNote(w) {
  for (const c of ctx.museum.ceilings) {
    const r = lidRelations(c).find((x) => x.wall.id === w.id);
    if (r?.status === 'gap') {
      return `<div class="relation"><span class="dot"></span><span>Its top is <b>${Math.round(r.gap * 100)} cm below</b> the ${esc(c.name)} — light shows through.</span><button class="lnk" data-act="lift-rel" data-id="${c.id}">Lift to see</button></div>`;
    }
  }
  return '';
}

function inspectOpening(o, w) {
  let html = head(`${o.kind === 'door' ? 'Door' : 'Window'} · ${o.ref}`, o.name, `in <button class="lnk inline" data-sel="${w.id}">${esc(w.name)}</button> · ${w.ref}`);
  html += where(o.id);
  const s = S.session;
  const facing = s?.kind === 'face' && s.wallId === w.id;
  html += `<div class="in-acts">`;
  if (!facing) html += `<button class="verb" data-act="face"><span class="vg face"></span>Face its wall<kbd>F</kbd></button>`;
  if (w.kind === 'arc' && !(facing && s.u > 0.5)) html += `<button class="verb" data-act="unfold"><span class="vg unfold"></span>Unfold the wall around it<kbd>O</kbd></button>`;
  html += `</div>`;
  html += `<div class="in-sec">Shape</div>`;
  html += seg('Profile', { type: 'profile', id: o.id }, [['rect', 'Square'], ['round', 'Round'], ['pointed', 'Pointed']], o.profile);
  html += field('Width', { type: 'op', id: o.id, key: 'w' }, o.w, { hint: w.kind === 'arc' ? 'measured along the curve' : '' });
  html += field('Centre along wall', { type: 'op', id: o.id, key: 's' }, o.s, { hint: w.closed ? 'from the seam, going round' : 'from the wall’s start' });
  html += `<div class="in-sec">Vertical</div>`;
  html += field('Sill', { type: 'op', id: o.id, key: 'sill' }, o.sill);
  html += field('Head', { type: 'op', id: o.id, key: 'head' }, o.head, { hint: `overall top · world ${fmt(o.head + FLOOR_Y)}` });
  if (o.profile !== 'rect') html += field('Arch rise', { type: 'op', id: o.id, key: 'rise' }, o.rise, { hint: `head stays put; the spring line moves (now ${fmt(springOf(o))})` });
  html += field('Clear height', { type: 'ro' }, o.head - o.sill, { readonly: true, hint: 'read-out: head minus sill' });
  html += `<div class="in-foot">The handles on the drawing and these fields are the same numbers — change either, one Undo step.</div>`;
  return html;
}

function inspectCeiling(c) {
  let html = head(`Ceiling region · ${c.ref}`, c.name, `${c.rel === 'closure' ? 'closes the room over its footprint' : 'hangs below the room ceiling'} · ${esc(byId(ctx.museum.galleries, c.gallery).name)} (overlaps, does not own)`);
  html += where(c.id);
  const s = S.session;
  html += `<div class="in-acts">`;
  if (!(s?.kind === 'lift' && s.ceilId === c.id)) html += `<button class="verb" data-act="lift"><span class="vg lift"></span>Lift it<kbd>O</kbd></button>`;
  if (!(s?.kind === 'lookup' && s.ceilId === c.id)) html += `<button class="verb" data-act="lookup"><span class="vg up"></span>Look up at it<kbd>U</kbd></button>`;
  html += `</div>`;
  html += `<div class="in-sec">Relationship</div>`;
  html += seg('Relationship', { type: 'rel', id: c.id }, [['closure', 'Closes the room'], ['suspended', 'Suspended']], c.rel);
  html += `<div class="in-sec">Underside</div>`;
  html += seg('Form', { type: 'cform', id: c.id }, [['flat', 'Flat'], ['shed', 'Sloped']], c.form);
  html += field('Height', { type: 'ceil', id: c.id, key: 'base' }, fieldValue({ type: 'ceil', id: c.id, key: 'base' }), { hint: c.form === 'shed' ? 'at the west end of the gallery' : `world ${fmt(c.plane.base + FLOOR_Y)}` });
  if (c.form === 'shed') html += field('Rise per metre', { type: 'ceil', id: c.id, key: 'gx' }, c.plane.gx, { hint: 'toward the east' });
  html += field('Thickness', { type: 'ro' }, c.thick, { readonly: true });
  const rels = lidRelations(c);
  if (rels.length) {
    html += `<div class="in-sec">Where it meets walls</div><ul class="rels">${rels.map((r) => `<li class="${r.status}"><span class="dot"></span>${esc(r.wall.name)}<span>${r.status === 'gap' ? `${Math.round(r.gap * 100)} cm gap` : r.status === 'intended' ? 'kept open' : 'meets'}</span></li>`).join('')}</ul>`;
  }
  return html;
}

function inspectScene(t) {
  const it = t.item;
  let html = head(`${t.kind === 'art' ? 'Artwork' : 'Object'} · Scene`, it.name, it.by ? esc(it.by) : '');
  html += where(it.id);
  html += `<div class="relation quiet"><span class="dot"></span><span>Staged content lives in the Scene document. Here it is passive context — edit it in <b>Arrange</b>.</span></div>`;
  if (t.kind === 'art') html += `<div class="in-acts"><button class="verb" data-act="face"><span class="vg face"></span>Face the wall it hangs on<kbd>F</kbd></button></div>`;
  return html;
}

// ---------------------------------------------------------------- tray, status, trail

function renderTray() {
  document.querySelectorAll('.tool').forEach((b) => {
    const on = (b.dataset.tool === 'knife' && S.tool === 'knife') || (b.dataset.tool === 'select' && S.tool === 'select');
    b.classList.toggle('on', on);
    b.setAttribute('aria-pressed', String(on));
  });
}

function renderStatus() {
  const st = S.status;
  const el = $('#statusText');
  const fresh = st && performance.now() - st.t < 6000;
  el.className = `status-text ${fresh ? st.kind : ''}`;
  el.innerHTML = fresh ? esc(st.text) : hintFor();
  let html = '';
  S.trail.forEach((e, i) => {
    html += `${i ? '<span class="tr-sep">›</span>' : ''}<button class="tr-stop${i === S.trailPos ? ' on' : ''}" data-trail="${i}" title="Go back to this standpoint (view only)">${esc(e.label)}</button>`;
  });
  const tr = $('#trail');
  if (tr._html !== html) { tr.innerHTML = html; tr._html = html; tr.scrollLeft = tr.scrollWidth; }
  document.querySelectorAll('#motion button').forEach((b) => b.classList.toggle('on', b.dataset.motion === S.motion));
}

function hintFor() {
  const s = S.session;
  if (S.knife) return '<kbd>Drag</kbd> draw the line · <kbd>Tab</kbd> look the other way · <kbd>↵</kbd> open';
  const esc2 = s?.parent ? '<kbd>Esc</kbd> back one · <kbd>⇧Esc</kbd> put everything back' : '<kbd>Esc</kbd> put it back';
  if (!s) return viewKind() === 'plan'
    ? '<kbd>Drag</kbd> pan or a handle · <kbd>⌥ Drag</kbd> tilt into 3D · <kbd>/</kbd> find · <kbd>K</kbd> open along a line'
    : '<kbd>Drag</kbd> orbit · <kbd>⇧ Drag</kbd> pan · <kbd>/</kbd> find · pull a curved wall’s corner to unroll it';
  if (s.kind === 'face') return `<kbd>Drag</kbd> a handle · click a number to type · <kbd>S</kbd> square up · ${esc2}`;
  if (s.kind === 'section') return `Drag the cut on the locator to slide it · heads and sills edit at the cut · ${esc2}`;
  if (s.kind === 'lift') return `Click a coral gap to fix it · <kbd>U</kbd> look up · ${esc2}`;
  return `Click an underside height to type it · <kbd>M</kbd> mirror · ${esc2}`;
}

// ---------------------------------------------------------------- gap popover

function renderPopover() {
  const el = $('#popover');
  const p = S.popover;
  if (!p) { el.hidden = true; el._html = ''; return; }
  if (!p.opts) p.opts = gapOptions(p.wall, p.ceil);
  const opts = p.opts;
  const html = `<div class="pt">Close the gap above the ${esc(W(p.wall).name)}?</div>${opts.map((o, i) => `<button class="pop-opt${o.intent ? ' intent' : ''}" data-opt="${i}"><span class="t">${esc(o.t)}</span><span class="s">${esc(o.s)}</span></button>`).join('')}<div class="pop-foot">Hover to preview · click to apply as one Undo step</div>`;
  if (el._html !== html) { el.innerHTML = html; el._html = html; }
  el.hidden = false;
  if (p.anchor) { el.style.left = `${p.anchor.x}px`; el.style.top = `${p.anchor.y + 18}px`; }
}

// ---------------------------------------------------------------- where you are

const MB = { x0: -16, x1: 12, z0: -6.4, z1: 6.4 };
const MW = 196, MH = (MW * (MB.z1 - MB.z0)) / (MB.x1 - MB.x0);
export const mapPt = (x, z) => [((x - MB.x0) / (MB.x1 - MB.x0)) * MW, ((z - MB.z0) / (MB.z1 - MB.z0)) * MH];
export const mapInv = (px, py) => [MB.x0 + (px / MW) * (MB.x1 - MB.x0), MB.z0 + (py / MH) * (MB.z1 - MB.z0)];
const pts = (list) => list.map(([x, z]) => mapPt(x, z).map((v) => v.toFixed(1)).join(',')).join(' ');

function renderWhereStatic() {
  const svg = $('#whereSvg');
  if (svg._built) return;
  svg._built = true;
  svg.setAttribute('viewBox', `0 0 ${MW} ${MH.toFixed(1)}`);
  let html = '';
  for (const f of ctx.museum.floors) html += `<polygon class="wm-room" points="${pts(f.outline)}"/>`;
  html += `<g id="wmDyn"></g>`;
  svg.innerHTML = html;
}

export function updateWhere() {
  const box = $('#where');
  const s = S.session;
  // the locator earns its corner of the paper only while something is open or being drawn
  box.hidden = !s && !S.knife;
  if (box.hidden) return;
  const cam = ctx.stage.cam;
  let dyn = '';
  let caption = '';
  for (const w of ctx.museum.walls) {
    const L = wallLength(w);
    const n = w.kind === 'arc' ? 64 : 1;
    const line = Array.from({ length: n + 1 }, (_, i) => { const f = frameAt(w, (i / n) * L); return [f.x, f.z]; });
    const active = s?.kind === 'face' && s.wallId === w.id;
    dyn += `<polyline class="wm-wall${active ? ' on' : ''}${S.sel === w.id ? ' sel' : ''}" points="${pts(line)}"/>`;
  }
  if (s?.kind === 'face') {
    const f = frameAt(s.wall, s.sA);
    const [ax, ay] = mapPt(f.x, f.z);
    dyn += `<circle class="wm-anchor" cx="${ax}" cy="${ay}" r="3"/>`;
    const from = s.side === -1 ? 'outside' : 'inside';
    caption = s.u > 0.985 ? `The ${s.wall.name}, laid flat · seen from ${from}` : s.u > 0.015 ? `The ${s.wall.name} at ${Math.round(360 * (1 - s.u))}° · seen from ${from}` : `Facing the ${s.focusName} from ${from}`;
    if (s.wall.id === 'rotunda') {
      for (const [k, ang] of [['A', Math.PI - Math.atan2(3.5, 5.5 - (5.5 - Math.sqrt(30.25 - 12.25)))], ['B', Math.PI + Math.atan2(3.5, Math.sqrt(30.25 - 12.25))]]) {
        const ff = frameAt(s.wall, modS(s.wall, ang * s.wall.r));
        const [jx, jy] = mapPt(ff.x, ff.z);
        dyn += `<g class="wm-letter"><circle cx="${jx}" cy="${jy}" r="5"/><text x="${jx}" y="${jy}">${k}</text></g>`;
      }
      if (s.u > 0.3) {
        const fs = frameAt(s.wall, modS(s.wall, s.sA + wallLength(s.wall) / 2));
        const [sx, sy] = mapPt(fs.x, fs.z);
        dyn += `<g class="wm-letter seam"><circle cx="${sx}" cy="${sy}" r="5"/><text x="${sx}" y="${sy}">S</text></g>`;
      }
    }
  }
  const cut = s?.kind === 'section' ? s.cut : S.knife ? knifeCut() : null;
  if (cut) {
    const [nx, nz] = cut.n, D = cut.depth;
    const band = [cut.p0, cut.p1, [cut.p1[0] + nx * D, cut.p1[1] + nz * D], [cut.p0[0] + nx * D, cut.p0[1] + nz * D]];
    dyn += `<polygon class="wm-band" points="${pts(band)}"/>`;
    const e0 = mapPt(band[3][0], band[3][1]), e1 = mapPt(band[2][0], band[2][1]);
    dyn += `<line class="wm-depth" x1="${e0[0]}" y1="${e0[1]}" x2="${e1[0]}" y2="${e1[1]}" data-depth-edge="1"/>`;
    const a = mapPt(...cut.p0), b = mapPt(...cut.p1);
    dyn += `<line class="wm-cut" x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}"/>`;
    if (s) dyn += `<line class="wm-cut-hit" data-cut-line="1" x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}"/>`;
    caption = s ? `Drag the cut to slide it · drag the far edge for depth` : 'The line you are drawing';
  }
  if (s?.kind === 'lift' || s?.kind === 'lookup') {
    const c = C(s.ceilId);
    dyn += `<polygon class="wm-lid" points="${pts(c.outline)}"/>`;
    caption = s.kind === 'lift' ? `${c.name}, seen from above` : `${c.name}, seen from below`;
  }
  // the standpoint: where the camera stands and which way it looks
  const tx = cam.target.x, tz = cam.target.z;
  const horiz = Math.cos(cam.el);
  const [cx, cy] = mapPt(tx, tz);
  if (Math.abs(cam.el) > 1.45) {
    dyn += `<circle class="wm-eye-ring" cx="${cx}" cy="${cy}" r="5"/><circle class="wm-eye" cx="${cx}" cy="${cy}" r="2"/>`;
    if (!caption) caption = cam.el > 0 ? 'Looking straight down' : 'Looking straight up';
  } else {
    const dx = Math.sin(cam.az), dz = Math.cos(cam.az);
    const back = 7 + 6 * horiz;
    const [ex, ey] = mapPt(tx + dx * back, tz + dz * back);
    const sp = 0.45;
    const l = mapPt(tx + Math.sin(cam.az + sp) * 3, tz + Math.cos(cam.az + sp) * 3);
    const r = mapPt(tx + Math.sin(cam.az - sp) * 3, tz + Math.cos(cam.az - sp) * 3);
    dyn += `<polygon class="wm-cone" points="${ex},${ey} ${cx},${cy}"/><line class="wm-view" x1="${ex}" y1="${ey}" x2="${cx}" y2="${cy}"/><circle class="wm-eye" cx="${ex}" cy="${ey}" r="3"/>`;
    void l; void r;
    if (!caption) caption = 'Your standpoint';
  }
  const g = document.getElementById('wmDyn');
  if (g && g._html !== dyn) { g.innerHTML = dyn; g._html = dyn; }
  const cap = $('#whereCap');
  if (cap.textContent !== caption) cap.textContent = caption;
}

// ---------------------------------------------------------------- fields shared by Inspector and on-drawing numbers

export function fieldValue(spec) {
  if (spec.type === 'op') return thing(spec.id).item[spec.key];
  if (spec.type === 'top') return W(spec.wall).top[spec.key];
  if (spec.type === 'ceil') {
    const c = C(spec.id);
    if (spec.key !== 'base') return c.plane[spec.key];
    return c.form === 'shed' ? c.plane.base + c.plane.gx * bbox(c.outline).x0 : c.plane.base;
  }
  return 0;
}

export function applyField(spec, v) {
  if (!Number.isFinite(v)) return 'Type a number in metres';
  if (spec.type === 'op') {
    const o = thing(spec.id).item;
    const names = { w: 'width', sill: 'sill', head: 'head', rise: 'arch rise', s: 'position' };
    return editOnce(`${o.name} ${names[spec.key]}`, () => applyOpening(spec.id, { [spec.key]: v }));
  }
  if (spec.type === 'top') {
    const w = W(spec.wall);
    const top = { ...w.top, [spec.key]: v };
    if (w.closed && spec.key === 'h0') top.h1 = v;
    const names = { h: 'height', h0: 'start height', h1: 'end height', rh: 'ridge height', rs: 'ridge position' };
    return editOnce(`${w.name} ${names[spec.key]}`, () => applyWallTop(spec.wall, top));
  }
  if (spec.type === 'ceil') {
    const c = C(spec.id);
    let val = v;
    if (spec.key === 'base' && c.form === 'shed') val = v - c.plane.gx * bbox(c.outline).x0;
    return editOnce(`${c.name} ${spec.key === 'base' ? 'height' : 'slope'}`, () => applyCeiling(spec.id, { plane: { ...c.plane, [spec.key]: val } }));
  }
  return null;
}

export function applySeg(spec) {
  if (spec.type === 'form') return setTopForm(spec.wall, spec.value);
  if (spec.type === 'profile') return setProfile(spec.id, spec.value);
  if (spec.type === 'rel') {
    const c = C(spec.id);
    if (c.rel === spec.value) return null;
    return editOnce(`${c.name} → ${spec.value === 'closure' ? 'closes the room' : 'suspended'}`, () => applyCeiling(spec.id, { rel: spec.value }));
  }
  if (spec.type === 'cform') {
    const c = C(spec.id);
    if (c.form === spec.value) return null;
    const plane = spec.value === 'flat' ? { base: c.plane.base, gx: 0, gz: 0 } : { base: c.plane.base, gx: 0.03, gz: 0 };
    if (spec.value === 'shed') {
      const b = bbox(c.outline);
      plane.base = c.plane.base - plane.gx * b.x0;
    }
    return editOnce(`${c.name} → ${spec.value === 'flat' ? 'Flat' : 'Sloped'}`, () => applyCeiling(spec.id, { form: spec.value, plane }));
  }
  return null;
}

export { topAt, maxTop, planeY, centroid };
