// Navigator, Inspector, strips, sheets and popovers. Everything reads resolved state from
// model.js and writes only through actions.js. Hover previews never re-render panels.
import { S, P, D, on } from './state.js';
import * as A from './actions.js';
import {
  SOURCES, NATIVE, FINISH, GLASS, PAINT, fmt, deg, defOf, defName, iface, featureAt, partAt, valueOf, inherited, overridesOf,
  usesOfDef, keyLabel, showValue, optName, optColor, compileLayout, wallById, openingById, poseOf, nearWalls, resolveRef,
  diffSource, impactOn, allowed, compositionsUsing,
} from './model.js';

const $ = (id) => document.getElementById(id);
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const R = (s) => `<span class="ref">${esc(s)}</span>`;
const data = (o = {}) => Object.entries(o).map(([k, v]) => `data-${k}="${esc(typeof v === 'object' ? JSON.stringify(v) : v)}"`).join(' ');
const btn = (label, act, params = {}, cls = '', extra = '') => `<button class="b ${cls}" data-act="${act}" ${data(params)} ${extra}>${label}</button>`;

export const IC = {
  def: '<svg viewBox="0 0 14 14" aria-hidden="true"><path d="M7 1.4 12.6 7 7 12.6 1.4 7Z" fill="currentColor"/></svg>',
  use: '<svg viewBox="0 0 14 14" aria-hidden="true"><path d="M7 1.9 12.1 7 7 12.1 1.9 7Z" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>',
  comp: '<svg viewBox="0 0 14 14" aria-hidden="true"><path d="M7 3.4 10.6 7 7 10.6 3.4 7Z" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>',
  part: '<svg viewBox="0 0 14 14" aria-hidden="true"><circle cx="7" cy="7" r="2.5" fill="currentColor"/></svg>',
  native: '<svg viewBox="0 0 14 14" aria-hidden="true"><rect x="2.6" y="2.6" width="8.8" height="8.8" rx="1" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>',
  flat: '<svg viewBox="0 0 14 14" aria-hidden="true"><rect x="2.6" y="2.6" width="8.8" height="8.8" rx="1" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M3.2 10.8 10.8 3.2" stroke="currentColor" stroke-width="1.2"/></svg>',
  group: '<svg viewBox="0 0 14 14" aria-hidden="true"><rect x="1.8" y="1.8" width="10.4" height="10.4" rx="1.6" fill="none" stroke="currentColor" stroke-width="1.3" stroke-dasharray="2.2 1.7"/></svg>',
  wall: '<svg viewBox="0 0 14 14" aria-hidden="true"><rect x="1.5" y="4.8" width="11" height="4.4" fill="currentColor"/></svg>',
  opening: '<svg viewBox="0 0 14 14" aria-hidden="true"><path d="M3.6 12V6.6a3.4 3.4 0 0 1 6.8 0V12" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>',
  bay: '<svg viewBox="0 0 14 14" aria-hidden="true"><path d="M2 12.2V5.6L7 2l5 3.6v6.6Z" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>',
  ref: '<svg viewBox="0 0 14 14" aria-hidden="true"><circle cx="7" cy="7" r="5.2" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M4.4 7h4.6M7.6 5l2 2-2 2" fill="none" stroke="currentColor" stroke-width="1.3"/></svg>',
  hang: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2.5 1.5v13" stroke="currentColor" stroke-width="2"/><path d="M2.5 5h4M6.5 5v6h7V5h-4.5" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>',
  select: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 1.5 13 9l-4.3.6 2.3 4.4-1.7.9-2.3-4.4L3.5 13Z" fill="currentColor"/></svg>',
  inspect: '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="4.5" y="10" width="7" height="4" fill="none" stroke="currentColor" stroke-width="1.3"/><rect x="5.5" y="5" width="5" height="3" fill="none" stroke="currentColor" stroke-width="1.3" stroke-dasharray="2 1.2"/><path d="M8 1v2.4" stroke="currentColor" stroke-width="1.3"/></svg>',
  try: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 13A8 8 0 0 1 13 4" fill="none" stroke="currentColor" stroke-width="1.4" stroke-dasharray="2 1.5"/><path d="M11 2.2 13.6 4 11.4 6.3" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>',
  pin: '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2 1v10" stroke="currentColor" stroke-width="1.8"/><path d="M2 4h3.5v4H10V4H6.5" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>',
};
const glyphFor = (doc, uid) => {
  const d = defOf(doc, doc.uses[uid].def);
  return d?.kind === 'native' ? IC.native : d?.kind === 'flat' ? IC.flat : IC.use;
};

// ---------------------------------------------------------------- value-state language
const SRC = {
  inherit: (label) => `<span class="src s-inh" title="Inherited — not set here">↳ ${esc(label)}</span>`,
  own: () => '<span class="src s-own" title="Set on this use (override)"><b>◆</b> This use</span>',
  bad: () => '<span class="src s-bad" title="Set here but not allowed by the current definition"><b>!</b> Not allowed now</span>',
  gone: () => '<span class="src s-gone" title="Its target no longer exists"><b>✕</b> Unresolved</span>',
  view: () => '<span class="src s-view" title="Temporary — not saved"><b>⬚</b> View only</span>',
  run: () => '<span class="src s-run" title="Running preview — not saved"><b>▶</b> Preview · not saved</span>',
  review: () => '<span class="src s-rev" title="Resolves, but needs editorial review"><b>◐</b> Needs review</span>',
  draft: () => '<span class="src s-draft" title="Draft — not applied yet"><b>✎</b> Draft</span>',
};
const chip = (text, tone = '') => `<span class="chip ${tone}">${text}</span>`;

// ---------------------------------------------------------------- render entry
let lastFocusKey = null;
export function render(what = 'all') {
  if (what === 'reach') return;
  if (what === 'instr') { lightUpdate(); return; }
  const fk = document.activeElement?.dataset?.fk;
  renderHead();
  renderViewbar();
  renderTray();
  renderNav();
  renderInsp();
  renderStrip();
  renderSheet();
  renderSummary();
  renderStatus();
  renderPop();
  renderEmpty();
  document.body.classList.toggle('reduced', S.motion === 'reduced');
  document.body.dataset.instr = S.instr?.kind ?? '';
  document.body.dataset.mode = S.mode;
  document.body.dataset.project = S.store.active;
  if (fk) {
    const el = document.querySelector(`[data-fk="${CSS.escape(fk)}"]`);
    if (el && el !== document.activeElement) el.focus({ preventScroll: true });
  }
  lastFocusKey = fk;
}
on((what) => render(what));

// ---------------------------------------------------------------- head
function renderHead() {
  const p = P();
  const doc = D();
  const last = p.undo[p.undo.length - 1];
  const offers = offersList();
  $('head').innerHTML = `
    <div class="brand">Biskiq</div>
    <div class="proj">
      <button class="proj-btn" data-act="pop" data-p="projects" data-fk="projbtn" aria-haspopup="true" aria-expanded="${S.pop === 'projects'}">${esc(doc.name)}${S.store.active === 'p2' ? ' <span class="spec">specimen</span>' : ''} <span aria-hidden="true">▾</span></button>
      <span class="doc-state"><span class="mono">rev ${p.rev}</span> · saved <i>(simulated storage)</i></span>
    </div>
    <button class="find-btn" data-act="find" data-fk="find">Find anything <kbd>/</kbd></button>
    ${offers.length ? `<button class="offer-btn" data-act="offer-open" data-def="${offers[0].def}" data-fk="offerbtn"><b>${offers.length}</b> update offered</button>` : ''}
    <div class="head-hist" aria-label="History">
      <button class="icon-btn" data-act="undo" data-fk="undo" aria-label="Undo" ${p.undo.length ? '' : 'disabled'}>↶<span class="count">${p.undo.length || ''}</span></button>
      <button class="undo-label" data-act="pop" data-p="history" data-fk="histbtn" title="History">${last ? esc(last.label) : 'No changes yet'}</button>
      <button class="icon-btn" data-act="redo" data-fk="redo" aria-label="Redo" ${p.redo.length ? '' : 'disabled'}>↷</button>
    </div>
    <nav class="doclinks" aria-label="Design documents"><a href="rationale.html">Rationale</a><a href="specimens.html">Specimens</a><a href="HANDOFF.md">Handoff</a></nav>`;
}
function offersList() {
  const out = [];
  if (S.store.active === 'p1') {
    for (const id of Object.keys(D().defs)) { const o = A.offerOf(id); if (o && !o.declined) out.push({ def: id, ...o }); }
  } else {
    for (const id of Object.keys(D().defs)) { const o = A.libOffer(D(), id); if (o && !o.declined) out.push({ def: id, ...o }); }
  }
  return out;
}

// ---------------------------------------------------------------- view bar + tray
function renderViewbar() {
  const doc = D();
  $('viewbar').innerHTML = `
    <div class="views" role="group" aria-label="View">
      <button class="vtab" disabled title="Plan projection is not part of this prototype">Plan</button>
      <button class="vtab on" aria-pressed="true">3D</button>
    </div>
    <span class="mode-k">MODE</span>
    <div class="modepair" role="group" aria-label="Local mode">
      <button data-act="mode" data-m="layout" data-fk="m-layout" aria-pressed="${S.mode === 'layout'}" class="${S.mode === 'layout' ? 'on' : ''}" ${doc.layout ? '' : 'disabled title="No architecture yet"'}>Layout</button>
      <button data-act="mode" data-m="arrange" data-fk="m-arrange" aria-pressed="${S.mode === 'arrange'}" class="${S.mode === 'arrange' ? 'on' : ''}">Arrange</button>
    </div>
    <div class="vb-util">
      <button data-act="frame" data-fk="frame" title="Frame the selection (F)">Frame</button>
      <button data-act="view" data-v="iso" data-fk="v-iso" title="Three-quarter view">¾</button>
      <button data-act="view" data-v="front" data-fk="v-front" title="Front view">Front</button>
      <button data-act="view" data-v="top" data-fk="v-top" title="Top view">Top</button>
      <span class="vb-sep"></span>
      <button data-act="motion" data-fk="motion" aria-pressed="${S.motion === 'reduced'}" title="Reduced motion keeps every meaning without animation">Reduced motion</button>
      <button data-act="keys" data-fk="keys" title="Keys (?)">Keys</button>
    </div>`;
}
function renderTray() {
  const hang = S.tool === 'hang';
  const selUse = S.sel?.kind === 'use';
  $('tray').innerHTML = `
    <div class="tray-g">SELECT</div>
    <button class="tool ${S.tool === 'select' ? 'on' : ''}" data-act="tool" data-t="select" data-fk="t-select" aria-pressed="${S.tool === 'select'}" title="Select (V) — click, double-click to go inside, Alt-click for the deepest part">${IC.select}<span>Select</span></button>
    <div class="tray-g">RELATE</div>
    <button class="tool ${hang ? 'armed' : ''}" data-act="tool" data-t="hang" data-fk="t-hang" aria-pressed="${hang}" title="Hang the selection on a wall (H)" ${D().layout ? '' : 'disabled'}>${IC.hang}<span>Hang</span></button>
    <div class="tray-g">LOOK</div>
    <button class="tool ${S.instr?.kind === 'inspect' ? 'on' : ''}" data-act="inspect" data-fk="t-inspect" title="Inspect parts — view only (I)" ${selUse ? '' : 'disabled'}>${IC.inspect}<span>Inspect</span></button>
    <button class="tool ${S.instr?.kind === 'preview' ? 'on' : ''}" data-act="preview" data-fk="t-try" title="Try articulation — not saved (P)" ${selUse ? '' : 'disabled'}>${IC.try}<span>Try</span></button>`;
}

// ---------------------------------------------------------------- navigator
function renderNav() {
  const doc = D();
  const C = compileLayout(doc.layout);
  const rows = [];
  const selK = A.selKey(S.sel);
  const multi = new Set(S.multi);
  const push = (r) => rows.push(r);
  const uses = doc.order.filter((id) => doc.uses[id]);
  const grouped = new Set(Object.values(doc.groups).flatMap((g) => g.members));

  // --- placed things (world-local)
  push({ sec: 'In this world', count: uses.length, hint: 'world-local' });
  if (!uses.length) push({ empty: 'Nothing placed yet. No room is needed — import or add an object.' });
  for (const g of Object.values(doc.groups)) {
    const k = `g:${g.id}`;
    const open = S.open.has(k);
    push({ key: k, level: 1, glyph: IC.group, name: g.name, ref: g.id, species: 'group', open, kids: true, sel: selK === `group:${g.id}`, act: { kind: 'group', id: g.id }, meta: '<span class="nv-meta">organizes only</span>' });
    if (open) for (const m of g.members) useRows(m, 2);
  }
  for (const id of uses) if (!grouped.has(id)) useRows(id, 1);

  function useRows(uid, level) {
    const u = doc.uses[uid];
    const d = defOf(doc, u.def);
    const ov = overridesOf(doc, uid);
    const badges = [];
    const nOwn = ov.filter((o) => o.status === 'override').length;
    const nBad = ov.filter((o) => o.status === 'incompatible').length;
    const nGone = ov.filter((o) => o.status === 'unresolved').length;
    if (u.attach) badges.push(u.attach.broken ? '<span class="bd bd-gone" title="Host removed — repair">✕ host</span>' : `<span class="bd bd-hang" title="Hung on ${esc(u.attach.host)}">${IC.pin}${esc(u.attach.host)}</span>`);
    if (nOwn) badges.push(`<span class="bd bd-own" title="${nOwn} setting${nOwn > 1 ? 's' : ''} on this use">◆${nOwn}</span>`);
    if (nBad) badges.push(`<span class="bd bd-bad" title="${nBad} setting${nBad > 1 ? 's' : ''} not allowed now">!${nBad}</span>`);
    if (nGone) badges.push(`<span class="bd bd-gone" title="${nGone} unresolved setting${nGone > 1 ? 's' : ''}">✕${nGone}</span>`);
    if (d?.kind === 'flat') badges.push('<span class="bd bd-q">flat</span>');
    const k = uid;
    const kids = d?.kind === 'composition' || d?.kind === 'imported';
    const open = S.open.has(k);
    push({ key: k, level, glyph: glyphFor(doc, uid), name: u.name, ref: uid, badges, open, kids, sel: selK === uid || multi.has(uid), act: { kind: 'use', id: uid, path: [] }, sub: d?.forkedFrom ? 'independent copy' : null });
    if (!open || !kids) return;
    const I = iface(doc, u.def);
    const top = I.parts.filter((p) => p.path.length === 1);
    for (const p of top) {
      const pk = [uid, ...p.path].join('/');
      const pOpen = S.open.has(pk);
      const hasKids = p.comp && I.parts.some((q) => q.path.length === 2 && q.path[0] === p.id);
      const pb = partBadges(doc, uid, p.path, ov);
      push({ key: pk, level: level + 1, glyph: p.comp ? (defOf(doc, p.def)?.kind === 'native' ? IC.native : IC.comp) : IC.part, name: p.name, ref: p.comp ? p.id : p.id, badges: pb, open: pOpen, kids: hasKids, sel: selK === pk, act: { kind: 'use', id: uid, path: p.path }, sub: p.comp ? compSub(doc, p) : p.enclosedBy ? 'enclosed' : null });
      if (pOpen && hasKids) for (const q of I.parts.filter((q) => q.path.length === 2 && q.path[0] === p.id)) {
        const qk = [uid, ...q.path].join('/');
        push({ key: qk, level: level + 2, glyph: IC.part, name: q.name, ref: q.id, badges: partBadges(doc, uid, q.path, ov), sel: selK === qk, act: { kind: 'use', id: uid, path: q.path }, sub: q.enclosedBy ? 'enclosed' : null });
      }
    }
  }

  // --- architecture (Layout-owned)
  if (C) {
    push({ sec: 'Architecture · Layout', hint: 'owned by Layout' });
    const open = S.open.has('arch');
    push({ key: 'arch', level: 1, glyph: IC.bay, name: C.name, ref: C.id, species: 'container', open, kids: true, sel: false, act: null });
    if (open) for (const w of C.walls) {
      const hosts = Object.values(doc.uses).filter((u) => u.attach?.host === w.id && !u.attach.broken).length;
      const wk = `w:${w.id}`;
      const wOpen = S.open.has(wk);
      push({ key: wk, level: 2, glyph: IC.wall, name: w.name, ref: w.id, open: wOpen, kids: w.openings.length > 0, sel: selK === `wall:${w.id}`, act: { kind: 'wall', id: w.id }, badges: hosts ? [`<span class="bd bd-hang">hosts ${hosts}</span>`] : [] });
      if (wOpen) for (const o of w.openings) push({ key: `o:${o.id}`, level: 3, glyph: IC.opening, name: o.name, ref: o.id, sel: selK === `opening:${o.id}`, act: { kind: 'opening', id: o.id } });
    }
  }

  // --- definitions (reusable, this project)
  const defs = Object.values(doc.defs).filter((d) => d.scope !== 'library-dep' || usesOfDef(doc, d.id).all.length);
  push({ sec: 'Definitions', count: defs.length, hint: S.store.active === 'p2' ? 'this project + library' : 'this project' });
  if (!defs.length) push({ empty: 'Reusable definitions appear here when you import or make one.' });
  for (const d of defs) {
    const u = usesOfDef(doc, d.id);
    const n = u.all.length;
    const badges = [];
    if (d.kind === 'imported' || d.kind === 'flat') badges.push(`<span class="bd bd-q">rev ${d.lock}</span>`);
    const off = S.store.active === 'p1' ? A.offerOf(d.id) : A.libOffer(doc, d.id);
    if (off) badges.push(off.declined ? `<span class="bd bd-q" title="Staying on the current revision">rev ${off.rev} available</span>` : `<span class="bd bd-offer">rev ${off.rev} offered</span>`);
    if (d.scope === 'library' || d.lib) badges.push(`<span class="bd bd-lib" title="Library-hosted">lib${d.lib ? ` rev ${d.lib.rev}` : ''}</span>`);
    if (d.lib && S.store.active === 'p1' && A.libDirty(doc, d.id)) badges.push('<span class="bd bd-rev" title="Changed since the published revision">unpublished</span>');
    if (d.forkedFrom) badges.push('<span class="bd bd-q">copy</span>');
    push({ key: `d:${d.id}`, level: 1, glyph: IC.def, name: d.name, ref: d.id, badges, sel: selK === `def:${d.id}`, act: { kind: 'def', id: d.id }, sub: `${d.kind === 'composition' ? 'composition' : d.kind === 'flat' ? 'imported · flat' : d.scope === 'library-dep' ? 'imported · via library' : 'imported'} · ${n} use${n === 1 ? '' : 's'}` });
  }

  // --- references authored elsewhere
  const refs = Object.values(doc.refs);
  if (refs.length) {
    push({ sec: 'Used by presentations', hint: 'read-only here' });
    for (const r of refs) {
      const st = resolveRef(doc, r);
      const b = st.status === 'ok' ? [] : st.status === 'review' ? ['<span class="bd bd-rev">◐ review</span>'] : ['<span class="bd bd-gone">✕ unresolved</span>'];
      push({ key: `r:${r.id}`, level: 1, glyph: IC.ref, name: r.name, ref: r.id, badges: b, sel: selK === `ref:${r.id}`, act: { kind: 'ref', id: r.id }, sub: `${r.domain} · ${r.kind}` });
    }
  }

  // roving tabindex: selected row, else first row
  const focusIdx = Math.max(0, rows.findIndex((r) => r.sel && r.key));
  let n = 0;
  const html = rows.map((r) => {
    if (r.sec) return `<div class="nv-sec" role="presentation"><span>${esc(r.sec)}</span>${r.count != null ? `<span class="nv-count">${r.count}</span>` : ''}<span class="nv-hint">${esc(r.hint ?? '')}</span></div>`;
    if (r.empty) return `<div class="nv-empty">${esc(r.empty)}</div>`;
    const idx = n++;
    const isFocus = rows.indexOf(r) === focusIdx || (focusIdx === 0 && idx === 0 && !rows.some((x) => x.sel));
    return `<div class="nv-row ${r.sel ? 'sel' : ''} ${r.species ?? ''}" role="treeitem" aria-level="${r.level}" ${r.kids ? `aria-expanded="${!!r.open}"` : ''} aria-selected="${!!r.sel}" tabindex="${isFocus ? 0 : -1}" data-fk="nv:${esc(r.key)}" data-row="${esc(r.key)}" ${r.act ? `data-act="navsel" data-sel='${esc(JSON.stringify(r.act))}'` : `data-act="navtoggle" data-k="${esc(r.key)}"`} style="--lv:${r.level}">
      ${r.kids ? `<span class="nv-disc" data-act="navtoggle" data-k="${esc(r.key)}" aria-hidden="true">${r.open ? '▾' : '▸'}</span>` : '<span class="nv-disc none"></span>'}
      <span class="nv-g">${r.glyph}</span>
      <span class="nv-name">${esc(r.name)}${r.sub ? `<span class="nv-sub">${esc(r.sub)}</span>` : ''}</span>
      ${r.meta ?? ''}
      <span class="nv-badges">${(r.badges ?? []).join('')}</span>
      <span class="nv-ref">${esc(r.ref)}</span>
    </div>`;
  }).join('');
  $('nav').innerHTML = `
    <div class="nv-head">
      <span class="nv-title">Contents</span>
      <span class="nv-datum">world-local · m</span>
    </div>
    <div class="nv-add">
      ${btn('Import…', 'import', {}, 'sm', 'data-fk="nv-import"')}
      ${btn('+ Plinth', 'add-plinth', {}, 'sm', 'data-fk="nv-plinth" title="Add a native plinth block"')}
      ${S.store.active === 'p1' ? btn('+ Architecture', 'add-bay', {}, 'sm', `data-fk="nv-bay" ${doc.layout ? 'disabled title="The prepared bay is already here"' : 'title="Add the prepared Layout bay"'}`) : btn('From library…', 'uselib', { def: 'D-DL01' }, 'sm', `data-fk="nv-lib" ${S.store.library.items['D-DL01'] ? '' : 'disabled title="Nothing shared to the library yet"'}`)}
    </div>
    <div class="nv-tree" role="tree" aria-label="Contents">${html}</div>`;
}
function compSub(doc, p) {
  const d = defOf(doc, p.def);
  if (!d) return null;
  if (d.kind === 'native') return 'native shape';
  if (d.kind === 'imported') return `uses ${d.name} rev ${p.pin ?? d.lock}${p.pin ? ' (pinned)' : ''}`;
  return `uses ${d.name}`;
}
function partBadges(doc, uid, path, ov) {
  const out = [];
  const key = path.join('/');
  for (const o of ov) {
    const f = o.f;
    const fp = f ? f.path.join('/') : null;
    const guessPath = o.key.split('/').slice(0, -1).join('/');
    const matches = fp ? fp === key || (path.length === 1 && fp.startsWith(key + '/')) : guessPath === key || (o.key.includes('slot.glass') && key.endsWith('p.diffuser'));
    if (!matches) continue;
    if (o.status === 'override') out.push(`<span class="bd bd-own">◆ ${esc(showValue(o.key, o.value))}</span>`);
    if (o.status === 'incompatible') out.push(`<span class="bd bd-bad">! ${esc(showValue(o.key, o.value))}</span>`);
    if (o.status === 'unresolved') out.push(`<span class="bd bd-gone">✕ ${esc(showValue(o.key, o.value))}</span>`);
  }
  return out;
}

// ---------------------------------------------------------------- inspector
function renderInsp() {
  const I = S.instr;
  let html;
  if (I?.kind === 'intake') html = inspIntake(I);
  else if (I?.kind === 'hang') html = inspHang(I);
  else if (I?.kind === 'review') html = inspReview(I);
  else if (I?.kind === 'libreview') html = inspLibReview(I);
  else if (I?.kind === 'bench') html = inspBench(I);
  else html = inspSelection();
  $('insp').innerHTML = html;
  $('insp').classList.toggle('wide', I?.kind === 'review' || I?.kind === 'libreview' || I?.kind === 'intake');
  document.body.classList.toggle('insp-wide', I?.kind === 'review' || I?.kind === 'libreview' || I?.kind === 'intake');
}
const hdr = (icon, title, sub, ref) => `<div class="ins-hdr"><span class="ins-ic">${icon}</span><div class="ins-t"><div class="ins-title">${title}</div><div class="ins-sub">${sub}</div></div>${ref ? `<span class="ins-ref">${esc(ref)}</span>` : ''}</div>`;
const sec = (title, body, extra = '') => `<section class="ins-sec" ${extra}><h3>${title}</h3>${body}</section>`;
const kv = (k, v) => `<div class="kv"><span class="k">${k}</span><span class="v">${v}</span></div>`;

function inspSelection() {
  const s = S.sel;
  const doc = D();
  if (S.multi.length && s?.kind === 'use') return inspMulti([...S.multi, s.id]);
  if (!s) return inspNothing();
  if (s.kind === 'use' && !doc.uses[s.id]) return inspNothing();
  if (s.kind === 'use' && !s.path?.length) return inspUse(s.id);
  if (s.kind === 'use') return inspPart(s.id, s.path);
  if (s.kind === 'group') return inspGroup(s.id);
  if (s.kind === 'wall') return inspWall(s.id);
  if (s.kind === 'opening') return inspOpening(s.id);
  if (s.kind === 'def') return inspDef(s.id);
  if (s.kind === 'ref') return inspRef(s.id);
  return inspNothing();
}
function inspNothing() {
  const doc = D();
  const empty = !Object.keys(doc.uses).length;
  return `${hdr(IC.select, 'Nothing selected', empty ? 'An empty, object-centred project' : `${Object.keys(doc.uses).length} objects in this world`)}
    ${sec('How selection works', `<ul class="tips">
      <li><b>Click</b> selects a whole object — or its group.</li>
      <li><b>Double-click</b> goes one level inside: component, then part. <kbd>Esc</kbd> comes back up.</li>
      <li><b>Alt-click</b> picks the deepest declared part directly.</li>
      <li><b>Shift-click</b> adds objects, then <em>Make reusable</em> or <em>Group</em>.</li>
    </ul>`)}
    ${empty ? sec('Start', `<p class="note">No room or tour is required. Import a model, add a native shape, or bring in architecture later — objects stay world-local either way.</p>${btn('Import a model…', 'import', {}, 'primary', 'data-fk="ins-import"')}`) : ''}`;
}

function reachControl(uid, key) {
  const doc = D();
  const u = doc.uses[uid];
  const d = defOf(doc, u.def);
  if (d.kind !== 'composition') {
    return `<div class="reach"><div class="reach-k">Changes apply to</div><div class="reach-fixed">This use only · ${R(uid)}</div><p class="note">${esc(d.name)} is ${d.kind === 'native' ? 'a native shape' : 'imported'} — ${d.kind === 'native' ? 'it has no shared definition' : 'its defaults change at its source (a new revision), not here'}.</p></div>`;
  }
  const n = usesOfDef(doc, u.def).direct.length;
  if (S.approach === 'bench') {
    return `<div class="reach"><div class="reach-k">Changes apply to</div><div class="reach-fixed">This use only · ${R(uid)}</div>
      <p class="note">To change what all ${n} uses start from, edit the definition itself.</p>${btn(`Edit ${esc(d.name)}…`, 'bench', { def: u.def }, 'sm', 'data-fk="ins-bench"')}</div>`;
  }
  const sc = S.reachScope;
  return `<div class="reach" role="radiogroup" aria-label="Changes apply to"><div class="reach-k">Changes apply to</div>
    <div class="reach-seg">
      <button role="radio" aria-checked="${sc === 'use'}" class="${sc === 'use' ? 'on' : ''}" data-act="reach" data-s="use" data-fk="reach-use" data-hreach='${esc(JSON.stringify({ uid, key, scope: 'use' }))}'>This use <span class="ref">${esc(uid)}</span></button>
      <button role="radio" aria-checked="${sc === 'def'}" class="${sc === 'def' ? 'on' : ''}" data-act="reach" data-s="def" data-fk="reach-def" data-hreach='${esc(JSON.stringify({ uid, key, scope: 'def' }))}'>Every use of ${esc(d.name)} <span class="ref">${n}</span></button>
    </div>
    <p class="note reach-note">${sc === 'use' ? `Only ${esc(uid)} changes. The other ${n - 1} use${n - 1 === 1 ? '' : 's'} keep${n - 1 === 1 ? 's' : ''} ${n - 1 === 1 ? 'its' : 'their'} values.` : `Changes the ${esc(d.name)} default. Uses that set their own value keep it.`} Hover a value to see its reach first.</p></div>`;
}

// One value row: current value, where it comes from, and the actions that fit its state.
function valueRow(uid, key, opts = {}) {
  const doc = D();
  const u = doc.uses[uid];
  const f = featureAt(doc, u.def, key);
  const own = u.sets?.[key];
  const scopeDef = S.approach === 'contextual' && S.reachScope === 'def' && defOf(doc, u.def).kind === 'composition';
  if (!f) {
    return `<div class="vrow st-gone"><div class="vrow-h"><span class="vl">${esc(keyLabel(key))}</span>${SRC.gone()}</div>
      <p class="note">“${esc(showValue(key, own))}” was set on this use, but the current definition has no such target. It is kept, inactive — nothing was matched by name.</p>
      <div class="vrow-acts">${btn('Remove this setting', 'drop', { uid, key }, 'sm', `data-fk="drop:${esc(key)}"`)}</div></div>`;
  }
  const v = valueOf(doc, uid, key);
  const inh = inherited(doc, uid, key);
  const bad = own !== undefined && !allowed(f, own);
  let st = own !== undefined ? (bad ? SRC.bad() : SRC.own()) : SRC.inherit(`from ${inh.label}`);
  if (scopeDef) st = `<span class="src s-inh">editing ${esc(defName(doc, u.def))} default</span>`;
  const preview = S.instr?.kind === 'preview' && S.instr.use === uid && S.instr.key === key;
  const shown = scopeDef ? inh.value : v.value;
  let control;
  if (f.kind === 'slot') {
    control = `<div class="swatches" role="radiogroup" aria-label="${esc(f.name)}">${f.options.map((o) => {
      const on = shown === o;
      const mark = scopeDef && own === o ? ' <b class="own-mark" title="This use sets its own value">◆</b>' : '';
      return `<button role="radio" aria-checked="${on}" class="sw ${on ? 'on' : ''}" data-act="val" ${data({ uid, key, v: o })} data-fk="sw:${esc(key)}:${o}" data-hreach='${esc(JSON.stringify({ uid, key, value: o }))}'><i style="background:${optColor(f.type, o)}"></i>${esc(optName(f.type, o))}${mark}</button>`;
    }).join('')}</div>`;
  } else {
    control = `<div class="num">
      <button class="b sm" data-act="nudge" ${data({ uid, key, d: -5 })} data-fk="nd-:${esc(key)}" aria-label="Decrease ${esc(f.name)}" data-hreach='${esc(JSON.stringify({ uid, key, value: Math.max(f.min, shown - 5) }))}'>−</button>
      <input class="mono" data-field="val" ${data({ uid, key })} data-fk="in:${esc(key)}" value="${Math.round(shown)}" inputmode="decimal" aria-label="${esc(f.name)} in degrees" data-hreach='${esc(JSON.stringify({ uid, key }))}'><span class="u">°</span>
      <button class="b sm" data-act="nudge" ${data({ uid, key, d: 5 })} data-fk="nd+:${esc(key)}" aria-label="Increase ${esc(f.name)}" data-hreach='${esc(JSON.stringify({ uid, key, value: Math.min(f.max, shown + 5) }))}'>+</button>
      <span class="range mono">${f.min}…${f.max}°</span>
      ${btn(preview ? 'Trying' : 'Try', 'preview', { uid, comp: f.comp ?? '' }, `sm ${preview ? 'on' : ''}`, `data-fk="try:${esc(key)}" title="Preview the articulation — not saved"`)}
    </div>`;
  }
  let foot = '';
  if (bad) {
    foot = `<p class="note warn">${esc(showValue(key, own))} is set on this use, but ${esc(f.name)} now allows ${f.kind === 'artic' ? `${f.min}…${f.max}°` : f.options.map((o) => optName(f.type, o)).join(', ')}. Using ${esc(showValue(key, v.value))} (${esc(v.from?.label ?? 'default')}) instead.</p>
      <div class="vrow-acts">${f.kind === 'artic' ? btn(`Set ${deg(Math.max(f.min, Math.min(f.max, own)))}`, 'val', { uid, key, v: Math.max(f.min, Math.min(f.max, own)) }, 'sm', `data-fk="clamp:${esc(key)}"`) : ''}${btn('Revert to inherited', 'revert', { uid, key }, 'sm ghost', `data-fk="rv:${esc(key)}"`)}</div>`;
  } else if (own !== undefined && !scopeDef) {
    const canPromote = defOf(doc, u.def).kind === 'composition' && S.approach === 'contextual';
    foot = `<div class="vrow-foot"><span>↳ ${esc(inh.label)}: ${esc(showValue(key, inh.value))}</span>${btn('Revert', 'revert', { uid, key }, 'xs ghost', `data-fk="rv:${esc(key)}" data-hreach='${esc(JSON.stringify({ uid, key, value: inh.value }))}'`)}${canPromote ? btn('Make default…', 'promote', { uid, key }, 'xs ghost', `data-fk="pr:${esc(key)}" data-hreach='${esc(JSON.stringify({ uid, key, scope: 'def', value: own }))}'`) : ''}</div>`;
  } else if (scopeDef && own !== undefined) {
    foot = `<div class="vrow-foot"><span>◆ This use keeps its own ${esc(showValue(key, own))}</span></div>`;
  }
  if (preview) foot += `<div class="vrow-foot run">${SRC.run()}<span class="mono">${deg(S.instr.value)}</span><span>baseline stays ${deg(v.value)}</span></div>`;
  return `<div class="vrow ${own !== undefined ? (bad ? 'st-bad' : 'st-own') : 'st-inh'}"><div class="vrow-h"><span class="vl">${esc(f.name)}</span>${st}</div>${control}${foot}</div>`;
}

function inspUse(uid) {
  const doc = D();
  const u = doc.uses[uid];
  const d = defOf(doc, u.def);
  const C = compileLayout(doc.layout);
  const I = iface(doc, u.def);
  const users = usesOfDef(doc, u.def).direct;
  const ov = overridesOf(doc, uid);
  const inspecting = S.instr?.kind === 'inspect' && S.instr.use === uid;
  const kindLine = d.kind === 'native' ? `Native shape · ${esc(d.name)}` : d.kind === 'flat' ? `Use of ${esc(d.name)} · imported flat` : `Use of ${esc(d.name)} · ${users.length} use${users.length === 1 ? '' : 's'} in this project`;
  let h = hdr(glyphFor(doc, uid), `<input class="name-in" data-field="rename" data-uid="${uid}" data-fk="rename" value="${esc(u.name)}" aria-label="Name">`, kindLine, uid);
  if (inspecting) h += `<div class="banner view">${SRC.view()} Parts are separated for looking. Edits you make here are real and undoable.</div>`;
  // definition
  if (d.kind !== 'native') {
    h += sec('Definition', `${kv('Uses', `<button class="lnk" data-act="navsel" data-sel='${esc(JSON.stringify({ kind: 'def', id: u.def }))}'>${esc(d.name)}</button> ${R(u.def)}`)}
      ${d.kind === 'composition' ? kv('Components', I.parts.filter((p) => p.comp).map((p) => esc(p.name)).join(' · ')) : ''}
      ${lockLine(doc, u.def)}
      <div class="acts">${d.kind === 'composition' && S.approach === 'bench' ? btn(`Edit ${esc(d.name)}…`, 'bench', { def: u.def }, 'sm', 'data-fk="u-bench"') : ''}${d.kind !== 'flat' || true ? btn('Place another use', 'dup', { uid }, 'sm', 'data-fk="u-dup" title="⌘D — another use of the same definition, not a copy of this one’s settings"') : ''}</div>`);
  }
  // settings on this use
  if (d.kind === 'composition' || d.kind === 'imported' || d.kind === 'native') {
    const body = ov.length
      ? ov.map((o) => `<div class="ovr ${o.status}"><span class="ovr-k">${o.status === 'override' ? '◆' : o.status === 'incompatible' ? '!' : '✕'} ${esc(o.label)}</span><span class="ovr-v">${esc(showValue(o.key, o.value))}</span><span class="ovr-s">${o.status === 'override' ? 'this use' : o.status === 'incompatible' ? 'not allowed now' : 'unresolved'}</span><button class="lnk" data-act="goto-key" ${data({ uid, key: o.key })}>show</button></div>`).join('')
      : `<p class="note">Nothing is set on this use — every value comes from ${esc(d.name)}.</p>`;
    h += sec(`Set on this use <span class="n">${ov.length}</span>`, body);
  }
  if (d.kind === 'native') {
    h += sec('Configuration', reachControl(uid, 'paint') + valueRow(uid, 'paint'));
  }
  // placement
  h += sec('Placement', placementBlock(uid, C));
  // relationships
  h += sec('Relationships', relBlock(uid, C));
  // capabilities
  h += sec('Capabilities', capsBlock(doc, u.def));
  // actions (consequential last)
  const hasArtic = I.features.some((f) => f.kind === 'artic');
  const canInspect = d.kind === 'composition' || d.kind === 'imported';
  h += sec('Actions', `<div class="acts col">
    ${canInspect ? btn(`${inspecting ? 'Back from inspection' : 'Inspect parts'} <kbd>I</kbd>`, inspecting ? 'inspect-close' : 'inspect', { uid }, 'sm', 'data-fk="a-inspect"') : ''}
    ${hasArtic ? btn('Try articulation <kbd>P</kbd>', 'preview', { uid }, 'sm', 'data-fk="a-try"') : ''}
    ${I.mounts.length && doc.layout ? btn(u.attach ? 'Re-hang on a wall… <kbd>H</kbd>' : 'Hang on a wall… <kbd>H</kbd>', 'tool', { t: 'hang' }, 'sm', 'data-fk="a-hang"') : ''}
    ${u.attach ? btn('Take off the wall (set down)', 'setdown', { uid }, 'sm', 'data-fk="a-setdown"') : ''}
    ${btn('Remove from world', 'remove', { uid }, 'sm danger', 'data-fk="a-remove"')}
  </div>`);
  h += techDetails(`${S.store.active === 'p1' ? 'project:saltmarsh-lamps' : 'project:harbour-cafe'}@rev${P().rev} / scene / ${uid} → ${u.def}${d.lock ? `@${d.lock}` : ''}`);
  return h;
}
function lockLine(doc, defId) {
  const d = doc.defs[defId];
  if (!d) return '';
  if (d.kind === 'imported' || d.kind === 'flat') {
    const off = A.offerOf(defId);
    return kv('Revision', `rev ${d.lock} <span class="q">locked</span>${off ? ` · <button class="lnk" data-act="offer-open" data-def="${defId}">rev ${off.rev} ${off.declined ? 'available' : 'offered'}</button>` : ''}`);
  }
  const deps = d.comps.filter((c) => doc.defs[c.def]?.kind === 'imported').map((c) => {
    const dd = doc.defs[c.def];
    const off = S.store.active === 'p1' ? A.offerOf(c.def) : null;
    return `${esc(dd.name)} rev ${c.pin ?? dd.lock}${c.pin ? ' <span class="q">pinned</span>' : ''}${off && !c.pin ? ` · <button class="lnk" data-act="offer-open" data-def="${c.def}">rev ${off.rev} ${off.declined ? 'available' : 'offered'}</button>` : ''}`;
  });
  const libo = S.store.active === 'p2' ? A.libOffer(doc, defId) : null;
  let s = deps.length ? kv('Depends on', deps.join('<br>')) : '';
  if (d.lib) s += kv('Library', `${esc(S.store.library.name)} rev ${d.lib.rev}${d.retained ? ' · retained copy' : ''}${libo ? ` · <button class="lnk" data-act="offer-open" data-def="${defId}">rev ${libo.rev} ${libo.declined ? 'available' : 'offered'}</button>` : ''}`);
  if (d.forkedFrom) s += kv('Origin', esc(d.forkedFrom.note));
  return s;
}
function placementBlock(uid, C) {
  const doc = D();
  const u = doc.uses[uid];
  const p = poseOf(doc, C, uid);
  if (u.attach && !u.attach.broken) {
    const w = wallById(C, u.attach.host);
    return `<p class="note">${IC.pin} Hung on <button class="lnk" data-act="navsel" data-sel='${esc(JSON.stringify({ kind: 'wall', id: w.id }))}'>${esc(w.name)}</button> ${R(w.id)} by its wall cleat. Its world position is derived from the wall.</p>
      <div class="fields">${field(uid, 's', 'Along', u.attach.s, 'm')}${field(uid, 'h', 'Height', u.attach.h, 'm')}</div>`;
  }
  if (u.attach?.broken) {
    return `<div class="banner gone"><b>✕ Host removed.</b> It was hung on ${R(u.attach.host)}, which no longer exists. It stays where it last was; nothing was re-hung automatically.</div>
      <div class="acts">${btn('Hang on another wall…', 'tool', { t: 'hang' }, 'sm', 'data-fk="rp-hang"')}${btn('Set it down here', 'setdown', { uid }, 'sm', 'data-fk="rp-down"')}</div>`;
  }
  return `<div class="fields">${field(uid, 'x', 'X', p.x, 'm')}${field(uid, 'z', 'Z', p.z, 'm')}${field(uid, 'rot', 'Turn', (p.rotY * 180) / Math.PI, '°', 0)}</div>
    <p class="note q">World-local — not inside any room.${p.y > 0.001 ? ` Resting ${fmt(p.y)} m up (placement only — not attached).` : ''}</p>`;
}
const field = (uid, f, label, v, unit, dp = 2) => `<label class="fld"><span>${label}</span><input class="mono" data-field="place" data-uid="${uid}" data-f="${f}" data-fk="pl:${f}" value="${dp ? fmt(v, dp) : Math.round(v)}" inputmode="decimal"><span class="u">${unit}</span></label>`;
function relBlock(uid, C) {
  const doc = D();
  const u = doc.uses[uid];
  const g = A.groupOf(uid);
  const rows = [];
  rows.push(kv('Attachment', u.attach ? (u.attach.broken ? '<span class="t-gone">✕ host removed</span>' : `${IC.pin} hung on ${R(u.attach.host)} · cleat`) : '<span class="q">none</span>'));
  rows.push(kv('Group', g ? `<button class="lnk" data-act="navsel" data-sel='${esc(JSON.stringify({ kind: 'group', id: g }))}'>${esc(doc.groups[g].name)}</button> <span class="q">organizes only</span>` : '<span class="q">none</span>'));
  const near = nearWalls(doc, C, uid);
  if (near.length) rows.push(kv('Near', near.map((n) => `${esc(n.wall.name)} ${R(n.wall.id)} <span class="${n.through ? 't-bad' : 'q'}">${n.through ? 'wall passes through it' : `${fmt(Math.max(0, n.gap))} m — not attached`}</span>`).join('<br>')));
  const refs = Object.values(doc.refs).filter((r) => r.target.use === uid);
  if (refs.length) rows.push(kv('Referenced by', refs.map((r) => `<button class="lnk" data-act="navsel" data-sel='${esc(JSON.stringify({ kind: 'ref', id: r.id }))}'>${esc(r.name)}</button>`).join(', ')));
  return rows.join('');
}
function capsBlock(doc, defId) {
  const I = iface(doc, defId);
  const d = defOf(doc, defId);
  if (d.kind === 'flat') {
    const r = SOURCES[d.src].revs[d.lock];
    return `<p class="note">Whole object only. Arrived flat: ${r.meshes} render meshes, ${r.materials} material, no part manifest.</p><ul class="caps no">${r.unsupported.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`;
  }
  const parts = I.parts.filter((p) => !p.comp);
  const slots = I.features.filter((f) => f.kind === 'slot');
  const art = I.features.filter((f) => f.kind === 'artic');
  return `<ul class="caps">
    ${parts.length ? `<li><b>${parts.length}</b> declared part${parts.length > 1 ? 's' : ''} <span class="q">${parts.map((p) => esc(p.name)).join(', ')}</span></li>` : ''}
    ${slots.length ? `<li><b>${slots.length}</b> slot${slots.length > 1 ? 's' : ''} <span class="q">${slots.map((f) => esc(f.name)).join(', ')}</span></li>` : ''}
    ${art.length ? `<li><b>${art.length}</b> bounded articulation <span class="q">${art.map((f) => `${esc(f.name)} ${f.min}…${f.max}°`).join(', ')}</span></li>` : ''}
    ${I.mounts.length ? `<li><b>${I.mounts.length}</b> wall mount <span class="q">${I.mounts.map((m) => `${esc(m.name)} ${fmt(m.min)}–${fmt(m.max)} m`).join(', ')}</span></li>` : ''}
  </ul>`;
}
const techDetails = (path) => `<details class="tech"><summary>Technical details</summary><div class="mono">${esc(path)}</div></details>`;

function inspPart(uid, path) {
  const doc = D();
  const u = doc.uses[uid];
  const p = partAt(doc, u.def, path);
  if (!p) return inspUse(uid);
  const d = defOf(doc, u.def);
  const I = iface(doc, u.def);
  const inspecting = S.instr?.kind === 'inspect' && S.instr.use === uid;
  const parentComp = path.length > 1 ? I.parts.find((q) => q.path.join('/') === path.slice(0, -1).join('/')) : null;
  const chain = [`<button class="lnk" data-act="navsel" data-sel='${esc(JSON.stringify({ kind: 'use', id: uid, path: [] }))}'>${esc(u.name)}</button> ${R(uid)}`];
  if (parentComp) chain.push(`<button class="lnk" data-act="navsel" data-sel='${esc(JSON.stringify({ kind: 'use', id: uid, path: parentComp.path }))}'>${esc(parentComp.name)}</button>`);
  let h;
  if (p.comp) {
    const cd = defOf(doc, p.def);
    const nm = d.kind === 'composition' ? `<input class="name-in" data-field="rename-comp" data-def="${u.def}" data-cid="${p.id}" data-fk="rename-comp" value="${esc(p.name)}" aria-label="Component name (changes it in every use)">` : esc(p.name);
    h = hdr(cd?.kind === 'native' ? IC.native : IC.comp, nm, `Component of ${chain.join(' › ')}`, `${uid}/${p.id}`);
    h += `<p class="note ins-lead">${cd?.kind === 'native' ? 'A native shape inside this definition.' : `A use of ${esc(cd?.name)} inside ${esc(d.name)}.`} Its name belongs to ${esc(d.name)} — renaming it renames it in every use; its reference <span class="ref">${esc(p.id)}</span> never changes.</p>`;
  } else {
    h = hdr(IC.part, esc(p.name), `Part of ${chain.join(' › ')}`, `${uid}/${path.join('/')}`);
    const src = parentComp ? defOf(doc, parentComp.def) : d;
    h += `<p class="note ins-lead">Declared part <span class="ref">${esc(p.id)}</span> in ${esc(src?.name)} rev ${parentComp?.pin ?? src?.lock}.${p.parent ? ` Moves with ${esc(iface(doc, parentComp?.def ?? u.def, parentComp?.pin).parts.find((x) => x.id === p.parent)?.name ?? p.parent)}.` : ''} Names come from the source; identity comes from the id.</p>`;
    if (p.enclosedBy && !inspecting) h += `<div class="banner q"><b>Enclosed</b> by the ${esc(iface(doc, parentComp?.def ?? u.def).parts.find((x) => x.id === p.enclosedBy)?.name ?? 'shade')} — you can’t see it from here. ${btn('Inspect parts <kbd>I</kbd>', 'inspect', { uid }, 'xs', 'data-fk="enc-inspect"')}</div>`;
  }
  if (inspecting) h += `<div class="banner view">${SRC.view()} Separated for looking only.</div>`;
  const keys = I.features.filter((f) => f.path.join('/') === path.join('/') || (p.comp && f.comp === p.id)).map((f) => f.key);
  // also show unresolved settings that used to target this part
  const gone = overridesOf(doc, uid).filter((o) => o.status === 'unresolved' && o.key.startsWith(path[0] + '/') && !keys.includes(o.key));
  if (keys.length || gone.length) {
    h += sec('Configuration', (keys.length ? reachControl(uid, keys[0]) : '') + keys.map((k) => valueRow(uid, k)).join('') + gone.map((o) => valueRow(uid, o.key)).join(''));
  } else h += sec('Configuration', `<p class="note">No configurable values are declared on ${esc(p.name)}.</p>`);
  if (p.comp && defOf(doc, p.def)?.kind === 'native' && iface(doc, u.def).mounts.length) h += sec('Mount', `<p class="note">${IC.pin} Wall cleat on its back face · ${fmt(0.6)}–${fmt(1.5)} m above the floor. Exposed by ${esc(d.name)} so its uses can hang.</p>`);
  const refs = Object.values(doc.refs).filter((r) => r.target.use === uid && r.target.path.join('/') === path.join('/'));
  if (refs.length) h += sec('Referenced by', refs.map((r) => refLine(doc, r)).join(''));
  h += sec('Actions', `<div class="acts col">${btn('Select the whole object <kbd>Esc</kbd>', 'navsel', { sel: { kind: 'use', id: uid, path: [] } }, 'sm', 'data-fk="p-up"')}${!inspecting ? btn('Inspect parts <kbd>I</kbd>', 'inspect', { uid }, 'sm', 'data-fk="p-inspect"') : ''}</div>`);
  h += techDetails(`scene / ${uid} / ${path.join(' / ')}  (${u.def}${p.comp ? '' : ` → ${parentComp?.def ?? u.def}@${parentComp?.pin ?? defOf(doc, parentComp?.def ?? u.def)?.lock}`})`);
  return h;
}
function refLine(doc, r) {
  const st = resolveRef(doc, r);
  return `<div class="refline ${st.status}"><span>${IC.ref} <button class="lnk" data-act="navsel" data-sel='${esc(JSON.stringify({ kind: 'ref', id: r.id }))}'>${esc(r.name)}</button> <span class="q">${esc(r.domain)} ${esc(r.kind.toLowerCase())}</span></span>${st.status === 'ok' ? '<span class="q">resolves</span>' : st.status === 'review' ? SRC.review() : SRC.gone()}</div>`;
}

function inspMulti(ids) {
  const doc = D();
  return `${hdr(IC.use, `${ids.length} objects`, 'Multiple selection')}
    ${sec('Selected', ids.map((id) => `<div class="kv"><span class="k">${glyphFor(doc, id)} ${esc(doc.uses[id].name)}</span><span class="v">${R(id)}</span></div>`).join(''))}
    ${sec('Combine them', `<div class="choice2">
      <div><h4>${IC.def} Make reusable</h4><p class="note">Creates a <b>definition</b> from these. They become one use you can place again. Settings become its defaults.</p>${btn('Make reusable…', 'make', {}, 'sm primary', 'data-fk="m-make"')}</div>
      <div><h4>${IC.group} Group</h4><p class="note">Only <b>organizes</b>. Members keep their own placement and identity. Not reusable, not connected.</p>${btn('Group <kbd>⌘G</kbd>', 'group', {}, 'sm', 'data-fk="m-group"')}</div>
    </div>`)}`;
}

function inspGroup(gid) {
  const doc = D();
  const g = doc.groups[gid];
  return `${hdr(IC.group, esc(g.name), 'Group · organizes only', gid)}
    <div class="banner q">A group is for selecting and moving together. It doesn’t create a reusable definition, and it doesn’t connect anything: each member keeps its own placement, settings and identity.</div>
    ${sec(`Members <span class="n">${g.members.length}</span>`, g.members.map((m) => `<div class="kv"><span class="k">${glyphFor(doc, m)} <button class="lnk" data-act="navsel" data-sel='${esc(JSON.stringify({ kind: 'use', id: m, path: [] }))}'>${esc(doc.uses[m].name)}</button></span><span class="v">${R(m)}</span></div>`).join(''))}
    ${sec('Actions', `<div class="acts col">${btn('Make reusable from members…', 'make', { ids: g.members }, 'sm', 'data-fk="g-make"')}${btn('Ungroup', 'ungroup', { gid }, 'sm', 'data-fk="g-ungroup"')}</div>`)}`;
}

function inspWall(wid) {
  const doc = D();
  const C = compileLayout(doc.layout);
  const w = wallById(C, wid);
  if (!w) return inspNothing();
  const hosted = Object.values(doc.uses).filter((u) => u.attach?.host === wid && !u.attach.broken);
  const near = Object.keys(doc.uses).flatMap((id) => nearWalls(doc, C, id).filter((n) => n.wall.id === wid).map((n) => ({ id, ...n })));
  const moving = S.instr?.kind === 'wallmove';
  return `${hdr(IC.wall, esc(w.name), `Wall · owned by Layout · in ${esc(C.name)}`, wid)}
    <div class="banner layout"><b>Layout</b> owns this wall and compiles it (simulated compiler). Objects never own it, and grouping can’t absorb it.</div>
    ${sec('Geometry', `${kv('Length', `<span class="mono">${fmt(w.len)} m</span>`)}${kv('Height', `<span class="mono">${fmt(w.h)} m</span>`)}${kv('Thickness', `<span class="mono">${fmt(w.t)} m</span>`)}${w.openings.length ? kv('Openings', w.openings.map((o) => `${esc(o.name)} ${R(o.id)}`).join(', ')) : ''}`)}
    ${sec('Relationships', `${kv('Hosts', hosted.length ? hosted.map((u) => `${IC.pin} <button class="lnk" data-act="navsel" data-sel='${esc(JSON.stringify({ kind: 'use', id: u.id, path: [] }))}'>${esc(u.name)}</button> ${R(u.id)}`).join('<br>') : '<span class="q">nothing hung here</span>')}
      ${near.length ? kv('Near, not attached', near.map((n) => `${esc(doc.uses[n.id].name)} ${R(n.id)} <span class="${n.through ? 't-bad' : 'q'}">${n.through ? 'wall passes through it' : `${fmt(Math.max(0, n.gap))} m`}</span>`).join('<br>')) : ''}
      <p class="note q">Hung objects follow this wall. Objects that are only near it stay put.</p>`)}
    ${sec('Layout actions', `<div class="acts col">
      ${wid === 'W-FJSK' ? btn(moving ? 'Moving… drag the arrow or type' : `Move wall ${S.mode === 'layout' ? '' : '(Layout mode)'}`, 'wallmove', { wid }, 'sm', `data-fk="w-move" ${moving ? 'disabled' : ''}`) : '<p class="note q">Only the back wall is movable in this prepared bay.</p>'}
      ${btn('Remove wall…', 'removewall', { wid }, 'sm danger', 'data-fk="w-remove"')}</div>`)}`;
}
function inspOpening(oid) {
  const C = compileLayout(D().layout);
  const o = openingById(C, oid);
  if (!o) return inspNothing();
  return `${hdr(IC.opening, esc(o.name), `Opening in ${esc(o.wall.name)} · Layout`, oid)}
    ${sec('Geometry', `${kv('Along', `<span class="mono">${fmt(o.s0)}–${fmt(o.s1)} m</span>`)}${kv('Sill · head', `<span class="mono">${fmt(o.sill)} · ${fmt(o.head)} m</span>`)}`)}
    <p class="note">Nothing can hang across an opening — a wall mount needs solid wall behind it.</p>`;
}

function inspDef(did) {
  const doc = D();
  const d = doc.defs[did];
  if (!d) return inspNothing();
  const u = usesOfDef(doc, did);
  const I = iface(doc, did);
  let h = hdr(IC.def, esc(d.name), `Definition · ${d.kind === 'composition' ? 'composition made in this project' : d.kind === 'flat' ? 'imported, flat' : 'imported'}${d.scope === 'library' ? ' · library-hosted' : ''}`, did);
  if (d.kind === 'composition' && S.store.active === 'p1') h += `<div class="acts pad">${btn('Edit definition…', 'bench', { def: did }, 'sm primary', 'data-fk="d-bench"')}${btn('Place a use', 'place', { def: did }, 'sm', 'data-fk="d-place"')}</div>`;
  else if (d.kind !== 'composition') h += `<div class="acts pad">${btn('Place a use', 'place', { def: did }, 'sm', 'data-fk="d-place"')}</div>`;
  const off = S.store.active === 'p1' ? A.offerOf(did) : A.libOffer(doc, did);
  if (off) h += `<div class="banner offer"><b>rev ${off.rev} ${off.declined ? 'available' : 'offered'}.</b> ${off.declined ? 'You chose to stay on the current revision.' : 'Nothing changes until you review and accept it.'} ${btn('Review…', 'offer-open', { def: did }, 'xs', 'data-fk="d-review"')}</div>`;
  h += sec(`Uses <span class="n">${u.all.length}</span>`, u.all.length ? u.all.map((id) => {
    const ov = doc.uses[id] ? overridesOf(doc, id) : [];
    return `<div class="kv"><span class="k">${glyphFor(doc, id)} <button class="lnk" data-act="navsel" data-sel='${esc(JSON.stringify({ kind: 'use', id, path: [] }))}'>${esc(doc.uses[id].name)}</button> ${R(id)}</span><span class="v q">${u.direct.includes(id) ? (ov.length ? `◆ ${ov.length} set here` : 'inherits everything') : `via ${esc(defName(doc, doc.uses[id].def))}`}</span></div>`;
  }).join('') : '<p class="note">Not placed anywhere yet.</p>');
  h += sec('Interface', capsBlock(doc, did) + (d.kind === 'composition' ? `<div class="deflist">${I.features.map((f) => `<div class="kv"><span class="k">${esc(I.parts.find((p) => p.id === f.comp)?.name ?? '')} · ${esc(f.name)}</span><span class="v">${esc(showValue(f.key, defaultOf(doc, did, f.key)))}${d.sets && f.key in d.sets ? ' <span class="q">set here</span>' : ''}</span></div>`).join('')}</div>` : ''));
  const refs = Object.values(doc.refs).filter((r) => u.all.includes(r.target.use));
  if (refs.length) h += sec('Referenced by presentations', refs.map((r) => refLine(doc, r)).join(''));
  h += sec('Revision', lockLine(doc, did) || kv('Revision', 'project-local'));
  if (d.kind === 'imported' || d.kind === 'flat') h += sec('Source', provenance(d));
  if (d.kind === 'composition' && S.store.active === 'p1') {
    const item = S.store.library.items[did];
    h += sec('Library', item
      ? `${kv('Published', `${esc(S.store.library.name)} rev ${item.latest}`)}${A.libDirty(doc, did) ? `<p class="note">Changed since rev ${d.lib?.rev}. Other projects keep their revision until they accept a new one.</p>${btn(`Publish rev ${item.latest + 1}…`, 'publish', { def: did }, 'sm', 'data-fk="d-publish"')}` : '<p class="note q">Matches the published revision.</p>'}`
      : `<p class="note">Project-local. Share it to use it in other projects by reference — they’re offered new revisions, never updated silently.</p>${btn('Share to library…', 'share', { def: did }, 'sm', 'data-fk="d-share"')}`);
  }
  h += techDetails(`resource ${did} · ${d.kind}${d.lock ? ` · locked rev ${d.lock}` : ''}${d.lib ? ` · library rev ${d.lib.rev}` : ''}`);
  return h;
}
function defaultOf(doc, did, key) {
  return A.benchValue(doc, did, key, {});
}
function provenance(d) {
  const s = SOURCES[d.src];
  const r = s.revs[d.lock];
  return `${kv('File', `<span class="mono">${esc(s.file)}</span>`)}${kv('Supplier', esc(s.supplier))}${kv('Exported', `<span class="mono">${esc(r.exported)}</span> · ${esc(r.exporter)}`)}${kv('Content', `<span class="mono">sha256 ${esc(r.sha)}</span> · ${esc(r.bytes)}`)}${kv('Structure', esc(r.manifest))}${kv('Source bytes', d.retained ? 'retained <span class="q">(simulated storage)</span> — can be re-processed' : '<span class="t-bad">not retained</span>')}`;
}

function inspRef(rid) {
  const doc = D();
  const r = doc.refs[rid];
  if (!r) return inspNothing();
  const st = resolveRef(doc, r);
  const u = doc.uses[r.target.use];
  return `${hdr(IC.ref, esc(r.name), `${esc(r.domain)} ${esc(r.kind.toLowerCase())} · authored in ${esc(r.owner)}`, rid)}
    <div class="banner q">Read-only here. This workspace shows what the reference points at and whether it still resolves; editing it belongs to ${esc(r.domain)}.</div>
    ${sec('Points at', `${kv('Target', u ? `<button class="lnk" data-act="navsel" data-sel='${esc(JSON.stringify({ kind: 'use', id: u.id, path: st.status === 'removed' ? [] : r.target.path }))}'>${esc(u.name)} › ${esc(st.part?.name ?? r.targetLabel)}</button>` : '<span class="t-gone">removed use</span>')}${kv('Address', `<span class="mono">${esc(r.target.use)} / ${esc(r.target.path.join(' / '))}</span>`)}`)}
    ${sec('Resolution', `<div class="refline ${st.status}">${st.status === 'ok' ? '<span class="q">✓ resolves</span>' : st.status === 'review' ? SRC.review() : SRC.gone()}</div><p class="note">${esc(st.why)}</p>`)}`;
}

// ---------------------------------------------------------------- intake (truthful ingest card)
function inspIntake(I) {
  const s = SOURCES[I.src];
  const r = s.revs[1];
  if (I.phase === 'checking') return `${hdr(IC.def, `Checking ${esc(s.file)}…`, 'Simulated ingest — reading what the file actually declares')}<div class="checking"><span></span><span></span><span></span></div>`;
  const flat = !!r.flat;
  const parts = r.parts;
  return `${hdr(IC.def, esc(flat ? 'Tide relief' : 'Desk light'), `What arrived from <span class="mono">${esc(s.file)}</span> · not in the project yet`)}
    <div class="cap-card ${flat ? 'flat' : ''}">
      <div class="cap-verdict">${flat ? '<b>Whole object only.</b> The file has no part manifest, so nothing inside it is addressable.' : '<b>Structured.</b> The file declares its parts with stable ids, one finish slot, one glass slot and one bounded articulation.'}</div>
      <h4>Supported</h4>
      <ul class="caps">
        ${flat ? '<li>Place, move, turn, hide — as one object</li>' : `<li><b>${parts.length}</b> parts <span class="q">${parts.map((p) => `${esc(p.name)} <span class="ref">${p.id}</span>`).join(' · ')}</span></li>`}
        ${r.features.filter((f) => f.kind === 'slot').map((f) => `<li>Slot <b>${esc(f.name)}</b> <span class="q">${f.options.map((o) => optName(f.type, o)).join(', ')}</span></li>`).join('')}
        ${r.features.filter((f) => f.kind === 'artic').map((f) => `<li>Articulation <b>${esc(f.name)}</b> <span class="q">${f.min}…${f.max}°, rests at ${f.def}°</span></li>`).join('')}
      </ul>
      <h4>Found, not active</h4>
      <ul class="caps q">
        ${r.clips.length ? r.clips.map((c) => `<li>Clip <span class="mono">${esc(c.name)}</span> (${esc(c.dur)}) — kept, <b>not bound</b>. Nothing plays because it was imported.</li>`).join('') : '<li>No clips.</li>'}
        ${flat ? `<li>${r.meshes} render meshes (<span class="mono">plate, slat_01…</span>) — render data, not parts. Their names don’t make them parts.</li>` : `<li>${r.renderOnly.length} render-only meshes (<span class="mono">${r.renderOnly.map((x) => x.name).join(', ')}</span>) — they belong to a declared part; not selectable on their own.</li>`}
      </ul>
      <h4>Not supported</h4>
      <ul class="caps no">${r.unsupported.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
      <details class="prov"><summary>Source and provenance</summary>
        ${kv('File', `<span class="mono">${esc(s.file)}</span> · ${esc(r.bytes)}`)}${kv('Content', `<span class="mono">sha256 ${esc(r.sha)}</span>`)}${kv('Exported', `${esc(r.exported)} · ${esc(r.exporter)}`)}${kv('Pivot', esc(r.pivot))}${kv('Units', esc(r.units))}${kv('Bounds', `<span class="mono">${esc(r.bounds)}</span>`)}${kv('Retention', 'source bytes retained for re-processing <span class="q">(simulated)</span>')}
      </details>
    </div>
    <label class="chk"><input type="checkbox" data-field="intake-place" ${I.place ? 'checked' : ''}> Place one use in the world now</label>
    <div class="acts pad">${btn(`Add to project${I.place ? ' and place' : ''}`, 'intake-commit', {}, 'primary', 'data-fk="in-commit"')}${btn('Cancel', 'intake-cancel', {}, '', 'data-fk="in-cancel"')}</div>`;
}

// ---------------------------------------------------------------- offered revision review
function inspReview(I) {
  const doc = D();
  const d0 = doc.defs[I.def];
  const src = SOURCES[d0.src];
  const a = src.revs[d0.lock];
  const b = src.revs[I.to];
  const diff = diffSource(a, b);
  const cand = A.reviewCandidate();
  // Keep the original conflicts editable while the viewport shows chosen repairs.
  const offered = A.lockedCandidate(doc, I.def, I.to, {}, {});
  const impact = impactOn(doc, offered, I.def);
  const users = usesOfDef(doc, I.def).all;
  const refs = Object.values(doc.refs);
  const partRow = (p) => {
    const nameA = p.a ? esc(p.a.name) : '—';
    const nameB = p.b ? esc(p.b.name) : '—';
    const st = p.status === 'same' ? '<span class="q">unchanged</span>'
      : p.status === 'removed' ? '<span class="t-gone">✕ removed</span>'
      : p.status === 'new' ? '<span class="t-new">+ new</span>'
      : `<span class="t-link">linked</span> <span class="q">${[p.renamed ? 'renamed' : '', p.reshaped ? 'new shape' : ''].filter(Boolean).join(' · ')}</span>`;
    return `<tr class="${p.status}"><td>${nameA}</td><td class="arr">${p.status === 'removed' ? '' : '→'}</td><td>${nameB}</td><td class="mono">${esc(p.id)}</td><td>${st}</td></tr>`;
  };
  let h = `${hdr(IC.def, `${esc(d0.name)} · rev ${d0.lock} → rev ${I.to}`, `Offered by <span class="mono">${esc(src.file)}</span> re-export (${esc(src.supplier)}) · exported ${esc(b.exported)}`, I.def)}`;
  if (I.stale) h += `<div class="banner gone"><b>Not applied — the project changed.</b> ${esc(I.stale.reason)} ${I.stale.who ? `${esc(I.stale.who)}: ${esc(I.stale.what)}.` : ''} Nothing was half-applied. ${btn('Re-check impact', 'review-recheck', {}, 'xs', 'data-fk="rv-recheck"')}</div>`;
  h += sec('How parts correspond', `<p class="note">Matched by the declared part id in each export’s manifest. Names are shown, never used to match.</p>
    <table class="corr"><thead><tr><th>rev ${d0.lock}</th><th></th><th>rev ${I.to}</th><th>id</th><th></th></tr></thead><tbody>${diff.parts.map(partRow).join('')}</tbody></table>
    ${diff.lookalikes.filter((l) => l.resembles).map((l) => `<p class="note q">ⓘ rev ${I.to} contains a render mesh <span class="mono">${esc(l.name)}</span>. Its name resembles the removed ${esc(l.resembles.name)}, but it is not a declared part — <b>not linked</b>.</p>`).join('')}`);
  h += sec('Values it declares', diff.features.map((f) => `<div class="kv"><span class="k">${esc((f.b ?? f.a).name)} <span class="ref">${esc(f.id)}</span></span><span class="v">${f.status === 'same' ? '<span class="q">unchanged</span>' : f.status === 'removed' ? '<span class="t-gone">✕ removed</span>' : f.status === 'new' ? '<span class="t-new">+ new</span>' : esc(f.notes.join('; '))}</span></div>`).join(''));
  // effect on uses
  const useBlocks = users.map((uid) => {
    const u = doc.uses[uid];
    const rows = impact.find((r) => r.use === uid)?.items ?? [];
    const det = !!I.detach[uid];
    const items = rows.map((it) => {
      const k = `${uid}|${it.key}`;
      const ch = I.choices[k];
      if (det) return `<div class="imp q"><span>◆ ${esc(it.beforeLabel)} ${esc(showValue(it.key, it.value))}</span><span>kept with the independent copy</span></div>`;
      if (it.after === 'override') return `<div class="imp ok"><span>◆ ${esc(it.label)}: ${esc(showValue(it.key, it.value))}</span><span class="t-link">kept — still offered</span></div>`;
      if (it.after === 'unresolved') return `<div class="imp gone"><div class="imp-h"><span>✕ ${esc(it.beforeLabel)}: ${esc(showValue(it.key, it.value))}</span><span class="t-gone">target removed</span></div>
        <div class="opts" role="radiogroup" aria-label="What to do with ${esc(it.beforeLabel)}">
          ${radio(k, 'keep', ch, 'Keep, inactive (visible as unresolved)')}
          ${radio(k, 'drop', ch, 'Remove this setting')}
        </div></div>`;
      if (it.after === 'incompatible') {
        const f = it.f;
        return `<div class="imp bad"><div class="imp-h"><span>! ${esc(it.label)}: ${esc(showValue(it.key, it.value))}</span><span class="t-bad">not allowed in rev ${I.to} (${f.kind === 'artic' ? `${f.min}…${f.max}°` : f.options.map((o) => optName(f.type, o)).join(', ')})</span></div>
          <div class="opts" role="radiogroup" aria-label="What to do with ${esc(it.label)}">
            ${radio(k, 'keep', ch, `Keep, inactive — falls back to ${esc(showValue(it.key, valueOf(offered, uid, it.key).value))}`)}
            ${f.kind === 'artic' ? radio(k, 'clamp', ch, `Set ${deg(Math.max(f.min, Math.min(f.max, it.value)))} (nearest allowed)`) : ''}
            ${radio(k, 'default', ch, 'Use the definition default')}
          </div></div>`;
      }
      return '';
    }).join('');
    const via = u.def !== I.def ? ` via ${esc(defName(doc, u.def))}` : '';
    return `<div class="imp-use ${det ? 'det' : ''}"><div class="imp-uh">${glyphFor(doc, uid)} <b>${esc(u.name)}</b> ${R(uid)}<span class="q">${via}</span></div>
      ${items || `<div class="imp q"><span>Nothing set on this use</span><span>${det ? 'keeps rev ' + d0.lock : 'follows rev ' + I.to}</span></div>`}
      <label class="chk sm"><input type="checkbox" data-field="detach" data-fk="detach-${uid}" data-uid="${uid}" ${det ? 'checked' : ''}> Detach this use — make it an independent copy that keeps rev ${d0.lock}</label></div>`;
  }).join('');
  h += sec(`Effect on your uses <span class="n">${users.length}</span>`, useBlocks);
  if (refs.length) {
    h += sec('Presentation references', refs.map((r) => {
      const now = resolveRef(doc, r);
      const after = resolveRef(cand, r);
      return `<div class="refline ${after.status}"><span>${IC.ref} <b>${esc(r.name)}</b> <span class="q">${esc(r.domain)} ${esc(r.kind.toLowerCase())}</span></span>${after.status === 'ok' ? '<span class="q">still resolves</span>' : after.status === 'review' ? SRC.review() : SRC.gone()}</div><p class="note q">${esc(after.why)}${now.status !== 'ok' ? '' : ''}</p>`;
    }).join('') + '<p class="note q">Presentations are reviewed in their own workspaces. Accepting doesn’t edit them.</p>');
  }
  const nRepairs = Object.values(I.choices).filter((v) => v !== 'keep').length + Object.values(I.detach).filter(Boolean).length;
  const left = Object.entries(I.choices).filter(([k, v]) => v === 'keep' && !I.detach[k.split('|')[0]]).length;
  h += `<div class="acts pad sticky">${btn(`Accept rev ${I.to}${nRepairs ? ` · ${nRepairs} repair${nRepairs > 1 ? 's' : ''}` : ''}${left ? ` · ${left} left unresolved` : ''}`, 'review-accept', {}, 'primary', 'data-fk="rv-accept"')}${btn(`Stay on rev ${d0.lock}`, 'review-stay', {}, '', 'data-fk="rv-stay"')}${btn('Cancel', 'review-cancel', {}, 'ghost', 'data-fk="rv-cancel"')}</div>
    <p class="note q pad">Accepting moves the lock and applies your choices as one action — one Undo returns all of it.</p>`;
  return h;
}
const radio = (k, v, cur, label) => `<label class="rad"><input type="radio" name="${esc(k)}" data-field="choice" data-fk="choice-${esc(k)}-${v}" data-k="${esc(k)}" value="${v}" ${cur === v ? 'checked' : ''}> ${label}</label>`;

function inspHang(I) {
  const walls = compileLayout(D().layout).walls;
  const c = I.cand;
  const wall = c?.wall ?? walls[0]?.id;
  return `${hdr(IC.hang, 'Hang on a wall', 'Preview the relationship, then accept. Nothing moves until you hang it.', I.use)}
    ${sec('Placement', `<p class="note">Point at a wall in 3D or enter an exact location here.</p>
      <label class="fld wide"><span>Host wall · Layout</span><select data-field="hang-wall" data-fk="hang-wall">${walls.map((w) => `<option value="${esc(w.id)}" ${w.id === wall ? 'selected' : ''}>${esc(w.name)} · ${esc(w.id)}</option>`).join('')}</select></label>
      <label class="fld"><span>Along wall · m</span><input class="mono" type="number" step="0.05" value="${c?.s ?? 2.3}" data-field="hang-s" data-fk="hang-s"></label>
      <label class="fld"><span>Above floor · m</span><input class="mono" type="number" step="0.05" value="${c?.h ?? 1}" data-field="hang-h" data-fk="hang-h"></label>
      <p class="note">${esc(I.mount.name)} · ${fmt(I.mount.min)}–${fmt(I.mount.max)} m above the floor.</p>
      <div id="hangFeedback" class="banner ${c?.chk?.ok ? 'view' : 'gone'}" role="status">${c?.chk?.ok ? '✓ Supported wall location. The object will follow this host.' : esc(c?.chk?.reason ?? 'Choose a location on the inside of a wall.')} ${esc(c?.chk?.fix ?? '')}</div>
      <div class="acts">${btn('Hang here', 'hang-commit', {}, 'primary', 'data-fk="hang-go"')}${btn('Cancel', 'hang-cancel', {}, '', 'data-fk="hang-x"')}</div>`)}`;
}

function inspLibReview(I) {
  const doc = D();
  const d = doc.defs[I.def];
  const item = S.store.library.items[I.def];
  const from = item.revs[d.lib.rev];
  const to = item.revs[I.to];
  const changes = [];
  const keys = new Set([...Object.keys(from.def.sets || {}), ...Object.keys(to.def.sets || {})]);
  for (const k of keys) {
    const va = from.def.sets?.[k] ?? A.benchValue({ defs: { ...from.deps, [I.def]: { ...from.def, sets: {} } } }, I.def, k, {});
    const vb = to.def.sets?.[k] ?? A.benchValue({ defs: { ...to.deps, [I.def]: { ...to.def, sets: {} } } }, I.def, k, {});
    if (va !== vb) changes.push({ k, va, vb });
  }
  for (const [id, dep] of Object.entries(to.deps)) {
    const was = from.deps[id];
    if (was && was.lock !== dep.lock) changes.push({ k: `${dep.name} revision`, va: `rev ${was.lock}`, vb: `rev ${dep.lock}`, raw: true });
  }
  const users = usesOfDef(doc, I.def).direct;
  return `${hdr(IC.def, `${esc(d.name)} · rev ${d.lib.rev} → rev ${I.to}`, `Offered by ${esc(S.store.library.name)} · published from ${esc(item.from)}`, I.def)}
    <div class="banner q">Harbour café holds rev ${d.lib.rev}${d.retained ? ' as a reference with a retained copy' : ' by reference'}. Nothing here changes until you choose.</div>
    ${sec('What changed', changes.length ? changes.map((c) => `<div class="kv"><span class="k">${esc(c.raw ? c.k : keyLabel(c.k))}</span><span class="v"><span class="mono">${esc(c.raw ? c.va : showValue(c.k, c.va))}</span> → <b class="mono">${esc(c.raw ? c.vb : showValue(c.k, c.vb))}</b></span></div>`).join('') : '<p class="note">No value changes.</p>')}
    ${sec(`Effect here <span class="n">${users.length}</span>`, users.map((uid) => {
      const u = doc.uses[uid];
      const keep = changes.filter((c) => !c.raw && u.sets?.[c.k] !== undefined);
      return `<div class="imp-use"><div class="imp-uh">${glyphFor(doc, uid)} <b>${esc(u.name)}</b> ${R(uid)}</div>${changes.filter((c) => !c.raw).map((c) => `<div class="imp ${keep.includes(c) ? 'q' : 'ok'}"><span>${esc(keyLabel(c.k))}</span><span>${keep.includes(c) ? '◆ keeps its own' : 'changes'}</span></div>`).join('')}</div>`;
    }).join(''))}
    ${sec('Choose', `<div class="choice3">
      <div><h4>Accept rev ${I.to}</h4><p class="note">Move this project’s lock to rev ${I.to}. One Undo returns to rev ${d.lib.rev}.</p>${btn(`Accept rev ${I.to}`, 'lib-accept', {}, 'sm primary', 'data-fk="lr-accept"')}</div>
      <div><h4>Stay pinned</h4><p class="note">Keep rev ${d.lib.rev}. Rev ${I.to} stays available.</p>${btn(`Stay on rev ${d.lib.rev}`, 'lib-stay', {}, 'sm', 'data-fk="lr-stay"')}</div>
      <div><h4>Fork</h4><p class="note">Make an independent copy of rev ${d.lib.rev} owned by this project — a new identity that no longer receives revisions.</p>${btn('Fork…', 'lib-fork', {}, 'sm', 'data-fk="lr-fork"')}</div>
    </div>`)}
    <div class="acts pad">${btn('Close', 'lib-cancel', {}, 'ghost', 'data-fk="lr-cancel"')}</div>`;
}

// ---------------------------------------------------------------- definition bench
function inspBench(I) {
  const doc = D();
  const d = doc.defs[I.def];
  const Iface = iface(doc, I.def);
  const users = usesOfDef(doc, I.def).direct;
  const nm = `<input class="name-in" data-field="rename-def" data-def="${I.def}" data-fk="rename-def" value="${esc(d.name)}" aria-label="Definition name">`;
  const rows = Iface.features.map((f) => {
    const cur = A.benchValue(doc, I.def, f.key, {});
    const val = A.benchValue(doc, I.def, f.key, I.draft);
    const drafted = f.key in I.draft;
    const keep = users.filter((u) => doc.uses[u].sets?.[f.key] !== undefined);
    const comp = Iface.parts.find((p) => p.id === f.comp);
    let control;
    if (f.kind === 'slot') control = `<div class="swatches" role="radiogroup" aria-label="${esc(f.name)}">${f.options.map((o) => `<button role="radio" aria-checked="${val === o}" class="sw ${val === o ? 'on' : ''}" data-act="bench-val" ${data({ key: f.key, v: o })} data-fk="bsw:${esc(f.key)}:${o}"><i style="background:${optColor(f.type, o)}"></i>${esc(optName(f.type, o))}</button>`).join('')}</div>`;
    else control = `<div class="num">${btn('−', 'bench-nudge', { key: f.key, d: -5 }, 'sm', `data-fk="bn-:${esc(f.key)}"`)}<input class="mono" data-field="bench-val" data-key="${esc(f.key)}" data-fk="bin:${esc(f.key)}" value="${Math.round(val)}"><span class="u">°</span>${btn('+', 'bench-nudge', { key: f.key, d: 5 }, 'sm', `data-fk="bn+:${esc(f.key)}"`)}<span class="range mono">${f.min}…${f.max}°</span></div>`;
    return `<div class="vrow ${drafted ? 'st-draft' : 'st-inh'}"><div class="vrow-h"><span class="vl">${esc(comp?.name ?? '')} · ${esc(f.name)}</span>${drafted ? SRC.draft() : d.sets && f.key in d.sets ? '<span class="src s-inh">set by this definition</span>' : `<span class="src s-inh">↳ from ${esc(defName(doc, comp?.def))}</span>`}</div>${control}
      ${drafted ? `<div class="vrow-foot"><span>was ${esc(showValue(f.key, cur))} · ${users.length - keep.length} of ${users.length} uses change${keep.length ? ` · ${keep.map((u) => u).join(', ')} keep${keep.length === 1 ? 's' : ''} ${keep.length === 1 ? 'its' : 'their'} own` : ''}</span></div>` : ''}</div>`;
  }).join('');
  return `${hdr(IC.def, nm, `Definition bench · composition · used ${users.length} time${users.length === 1 ? '' : 's'}`, I.def)}
    <div class="banner q">You are editing the <b>definition</b>. Every use starts from these values unless it sets its own. Changes stay a draft until you apply them.</div>
    ${sec('Defaults', rows)}
    ${sec('Components', Iface.parts.filter((p) => p.comp).map((p) => `<div class="kv"><span class="k">${defOf(doc, p.def)?.kind === 'native' ? IC.native : IC.comp} ${esc(p.name)} <span class="ref">${p.id}</span></span><span class="v q">${esc(compSub(doc, p) ?? '')}</span></div>`).join(''))}
    ${sec('Mount', Iface.mounts.map((m) => `<p class="note">${IC.pin} ${esc(m.name)} on ${esc(m.comp)} · ${fmt(m.min)}–${fmt(m.max)} m</p>`).join('') || '<p class="note q">No mounts.</p>')}`;
}

// ---------------------------------------------------------------- strip (contextual instrument / entered context)
function renderStrip() {
  const I = S.instr;
  const doc = D();
  const el = $('strip');
  let h = '';
  if (I?.kind === 'inspect') {
    const u = doc.uses[I.use];
    const made = P().undo.length - I.from;
    h = `<span class="st-kind view">Inspecting · view only</span><span class="st-title">${esc(u.name)} ${R(I.use)}</span>
      <label class="st-slider"><span>Separate parts</span><input type="range" min="0" max="1" step="0.01" value="${I.sep}" data-field="sep" data-fk="sep" aria-label="Separate parts (view only)"><b class="mono" id="sepK">${Math.round(I.sep * 100)}%</b></label>
      <span class="st-meta">${made > 0 ? `<b>${made}</b> real change${made > 1 ? 's' : ''} while inspecting` : 'Separation is never saved'}</span>
      <button class="st-btn close" data-act="inspect-close" data-fk="st-close">Back <kbd>Esc</kbd></button>`;
  } else if (I?.kind === 'preview') {
    const u = doc.uses[I.use];
    const f = featureAt(doc, u.def, I.key);
    h = `<span class="st-kind run">Preview · not saved</span><span class="st-title">${esc(f.name)} · ${esc(u.name)} ${R(I.use)}</span>
      <label class="st-slider run"><input type="range" min="${f.min}" max="${f.max}" step="1" value="${Math.round(I.value)}" data-field="pv" data-fk="pv" aria-label="${esc(f.name)} preview"><b class="mono" id="pvK">${deg(I.value)}</b></label>
      <span class="st-meta">baseline <b id="pvBase">${deg(valueOf(doc, I.use, I.key).value)}</b></span>
      <button class="st-btn" data-act="pv-play" data-fk="pv-play" aria-pressed="${I.playing}">${I.playing ? 'Pause' : S.motion === 'reduced' ? 'Show range' : 'Play range'}</button>
      <button class="st-btn" data-act="pv-reset" data-fk="pv-reset">Reset</button>
      <button class="st-btn" data-act="pv-keep" data-fk="pv-keep" title="Capture this pose explicitly, with a stated scope">Keep this pose…</button>
      <button class="st-btn close" data-act="pv-end" data-fk="pv-end">End preview <kbd>Esc</kbd></button>`;
  } else if (I?.kind === 'hang') {
    const u = doc.uses[I.use];
    h = `<span class="st-kind armed">Hang on a wall</span><span class="st-title">${esc(u.name)} ${R(I.use)}</span><span class="st-meta">Point at the room side of a wall. ${esc(I.mount.name)} holds ${fmt(I.mount.min)}–${fmt(I.mount.max)} m up. Click to hang.</span>
      <button class="st-btn close" data-act="hang-cancel" data-fk="hang-cancel">Cancel <kbd>Esc</kbd></button>`;
  } else if (I?.kind === 'wallmove') {
    h = `<span class="st-kind layout">Layout edit</span><span class="st-title">Back wall ${R('W-FJSK')}</span>
      <label class="st-num"><span>offset</span><input class="mono" data-field="wall-off" data-fk="wall-off" value="${fmt(I.off)}" aria-label="Wall offset in metres"><span class="u">m</span></label>
      <span class="st-meta">Compiled by Layout (simulated). Hung objects follow; nearby ones don’t.</span>
      <button class="st-btn" data-act="wall-cancel" data-fk="wall-cancel">Cancel</button>
      <button class="st-btn close" data-act="wall-commit" data-fk="wall-commit">Done <kbd>↵</kbd></button>`;
  } else if (I?.kind === 'review') {
    const d0 = doc.defs[I.def];
    h = `<span class="st-kind offer">Offered revision</span><span class="st-title">${esc(d0.name)} rev ${d0.lock} → rev ${I.to}</span>
      <span class="st-seg" role="group" aria-label="Show">${['rev1', 'rev2', 'both'].map((m) => `<button data-act="review-show" data-m="${m}" data-fk="rs-${m}" class="${I.show === m ? 'on' : ''}" aria-pressed="${I.show === m}">${m === 'rev1' ? `rev ${d0.lock} (now)` : m === 'rev2' ? `rev ${I.to} (candidate)` : 'Both'}</button>`).join('')}</span>
      <span class="st-meta">The world shows the candidate with your choices — nothing is applied yet.</span>
      <button class="st-btn close" data-act="review-cancel" data-fk="rv-x">Cancel review</button>`;
  } else if (I?.kind === 'libreview') {
    h = `<span class="st-kind offer">Offered revision</span><span class="st-title">${esc(doc.defs[I.def].name)} · ${esc(S.store.library.name)}</span><span class="st-meta">Harbour café’s copy stays as it is until you choose.</span><button class="st-btn close" data-act="lib-cancel" data-fk="lr-x">Close</button>`;
  } else if (I?.kind === 'bench') {
    const n = Object.keys(I.draft).length;
    const users = usesOfDef(doc, I.def).direct.length;
    h = `<span class="st-kind def">Definition</span><span class="st-title">${esc(doc.defs[I.def].name)} ${R(I.def)}</span><span class="st-meta">used ${users}× · ${n ? `<b>${n}</b> draft change${n > 1 ? 's' : ''}` : 'no changes yet'}</span>
      <button class="st-btn" data-act="bench-discard" data-fk="b-discard">${n ? 'Discard' : 'Close'}</button>
      <button class="st-btn close" data-act="bench-apply" data-fk="b-apply" ${n ? '' : 'disabled'}>Apply to ${users} use${users === 1 ? '' : 's'}</button>`;
  } else if (I?.kind === 'intake') {
    h = `<span class="st-kind">Import</span><span class="st-title mono">${esc(SOURCES[I.src].file)}</span><span class="st-meta">Previewed at the origin — not in the project until you add it.</span><button class="st-btn close" data-act="intake-cancel" data-fk="in-x">Cancel</button>`;
  } else if (S.ctx && (S.ctx.use || S.ctx.group) && S.sel) {
    const crumbs = [];
    if (S.ctx.group) crumbs.push(`<span class="crumb grp" title="A group is a selection context, not part of anything’s identity">${IC.group} ${esc(doc.groups[S.ctx.group]?.name ?? '')}</span>`);
    if (S.sel.kind === 'use') {
      const u = doc.uses[S.sel.id];
      crumbs.push(`<button class="crumb" data-act="navsel" data-sel='${esc(JSON.stringify({ kind: 'use', id: u.id, path: [] }))}'>${esc(u.name)} ${R(u.id)}</button>`);
      const I2 = iface(doc, u.def);
      (S.sel.path ?? []).forEach((_, i) => {
        const p = I2.parts.find((q) => q.path.join('/') === S.sel.path.slice(0, i + 1).join('/'));
        crumbs.push(`<button class="crumb ${i === S.sel.path.length - 1 ? 'cur' : ''}" data-act="navsel" data-sel='${esc(JSON.stringify({ kind: 'use', id: u.id, path: S.sel.path.slice(0, i + 1) }))}'>${esc(p?.name ?? '?')}</button>`);
      });
    }
    h = `<span class="st-kind">Inside</span><span class="crumbs">${crumbs.join('<span class="chev">›</span>')}</span><span class="st-meta">Clicks select at this level. Double-click goes deeper.</span><button class="st-btn close" data-act="up" data-fk="st-up">Up a level <kbd>Esc</kbd></button>`;
  }
  el.hidden = !h;
  el.innerHTML = h;
}
function lightUpdate() {
  const I = S.instr;
  if (I?.kind === 'inspect') {
    const k = $('sepK');
    if (k) k.textContent = `${Math.round(I.sep * 100)}%`;
    const r = document.querySelector('[data-field="sep"]');
    if (r && document.activeElement !== r) r.value = I.sep;
  }
  if (I?.kind === 'preview') {
    const k = $('pvK');
    if (k) k.textContent = deg(I.value);
    const r = document.querySelector('[data-field="pv"]');
    if (r && document.activeElement !== r) r.value = Math.round(I.value);
    const pb = document.querySelector('[data-act="pv-play"]');
    if (pb) { pb.textContent = I.playing ? 'Pause' : S.motion === 'reduced' ? 'Show range' : 'Play range'; pb.setAttribute('aria-pressed', I.playing); }
  }
  if (I?.kind === 'wallmove') {
    const r = document.querySelector('[data-field="wall-off"]');
    if (r && document.activeElement !== r) r.value = fmt(I.off);
  }
  if (I?.kind === 'hang' && I.cand) {
    const c = I.cand;
    for (const [field, value] of [['hang-wall', c.wall], ['hang-s', c.s], ['hang-h', c.h]]) {
      const input = document.querySelector(`[data-field="${field}"]`);
      if (input && input !== document.activeElement && value != null) input.value = value;
    }
    const feedback = $('hangFeedback');
    if (feedback) {
      feedback.className = `banner ${c.chk?.ok ? 'view' : 'gone'}`;
      feedback.textContent = c.back ? 'Choose the inside of a wall.' : c.chk?.ok ? '✓ Supported wall location. The object will follow this host.' : `${c.chk?.reason ?? ''} ${c.chk?.fix ?? ''}`;
    }
  }
}

// ---------------------------------------------------------------- sheets
function renderSheet() {
  const sh = S.sheet;
  const el = $('sheet');
  if (!sh) { el.hidden = true; el.innerHTML = ''; return; }
  const doc = D();
  let h = '';
  if (sh.kind === 'import') {
    h = `<h2>Import a model</h2><p class="note">Simulated: two prepared files. No bytes are read; the importer reports what each file declares.</p>
      <div class="files">
        <button class="file" data-act="intake" data-src="lamp" data-fk="f-lamp" ${doc.defs['D-DK12'] ? 'disabled' : ''}><b class="mono">desk-lamp.glb</b><span>1.84 MB · Studio Lumen</span><span class="q">articulated desk light · part manifest</span>${doc.defs['D-DK12'] ? '<span class="q">already imported</span>' : ''}</button>
        <button class="file" data-act="intake" data-src="relief" data-fk="f-relief" ${doc.defs['D-TR05'] ? 'disabled' : ''}><b class="mono">tide-relief.glb</b><span>0.62 MB · M. Okafor</span><span class="q">decorative relief · no manifest</span>${doc.defs['D-TR05'] ? '<span class="q">already imported</span>' : ''}</button>
      </div>
      <div class="acts">${btn('Cancel', 'sheet-close', {}, '', 'data-fk="sh-x"')}</div>`;
  } else if (sh.kind === 'make') {
    const C = compileLayout(doc.layout);
    const origin = sh.ids.find((id) => doc.uses[id]?.def === 'N-PLINTH') ?? sh.ids[0];
    const carried = sh.ids.flatMap((id) => overridesOf(doc, id).map((o) => `${esc(o.label)} ${esc(showValue(o.key, o.value))}`));
    h = `<h2>Make a reusable definition</h2>
      <label class="fld wide"><span>Name</span><input data-field="make-name" data-fk="make-name" value="${esc(sh.name)}"></label>
      <div class="kv"><span class="k">From</span><span class="v">${sh.ids.map((id) => `${esc(doc.uses[id].name)} ${R(id)}`).join(' + ')}</span></div>
      <div class="kv"><span class="k">Origin</span><span class="v">${esc(doc.uses[origin].name)}’s base centre</span></div>
      <ul class="what">
        <li>A new <b>definition</b> is created in this project. Its components keep their arrangement.</li>
        <li>The ${sh.ids.length} objects are <b>replaced by one use</b> of it, in the same place.</li>
        <li>${carried.length ? `Their settings become its defaults: ${carried.join(', ')}.` : 'They had no settings of their own, so its defaults are the sources’ defaults.'}</li>
        <li>Unlike a group, the result can be placed again, and every use can be changed together.</li>
      </ul>
      <div class="acts">${btn('Create definition', 'make-go', {}, 'primary', 'data-fk="make-go"')}${btn('Cancel', 'sheet-close', {}, '', 'data-fk="sh-x"')}</div>`;
  } else if (sh.kind === 'keep') {
    const u = doc.uses[sh.uid];
    const d = defOf(doc, u.def);
    const users = usesOfDef(doc, u.def).direct;
    const keep = users.filter((id) => id !== sh.uid && doc.uses[id].sets?.[sh.key] !== undefined);
    h = `<h2>Keep ${deg(sh.value)} as the arm tilt?</h2><p class="note">A previewed pose is never saved on its own. Capturing it is an explicit, undoable change — choose where it lives.</p>
      <div class="opts" role="radiogroup">
        <label class="rad"><input type="radio" name="keepscope" data-field="keep-scope" value="use" ${sh.scope === 'use' ? 'checked' : ''}> <b>This use</b> ${R(sh.uid)} — only this light rests at ${deg(sh.value)}</label>
        ${d.kind === 'composition' ? `<label class="rad"><input type="radio" name="keepscope" data-field="keep-scope" value="def" ${sh.scope === 'def' ? 'checked' : ''}> <b>${esc(d.name)} default</b> — ${users.length - keep.length} use${users.length - keep.length === 1 ? '' : 's'} change${keep.length ? `; ${keep.join(', ')} keep${keep.length === 1 ? 's' : ''} ${keep.length === 1 ? 'its' : 'their'} own` : ''}</label>` : ''}
      </div>
      <div class="acts">${btn(`Keep ${deg(sh.value)}`, 'keep-go', {}, 'primary', 'data-fk="keep-go"')}${btn('Cancel', 'sheet-close', {}, '', 'data-fk="sh-x"')}</div>`;
  } else if (sh.kind === 'removewall') {
    h = `<h2>Remove ${esc(sh.name)}?</h2>`;
    if (sh.hosted.length) {
      h += `<p class="note">${sh.hosted.map((id) => `<b>${esc(doc.uses[id].name)}</b> ${R(id)}`).join(', ')} ${sh.hosted.length > 1 ? 'are' : 'is'} hung on this wall. Removing it is one action across Layout and Scene — choose what happens to ${sh.hosted.length > 1 ? 'them' : 'it'}:</p>
        <div class="opts" role="radiogroup">
          <label class="rad"><input type="radio" name="rw" data-field="rw" value="setdown" ${sh.choice === 'setdown' ? 'checked' : ''}> <b>Set it down</b> — keep it at its world position, on the floor, unattached</label>
          <label class="rad"><input type="radio" name="rw" data-field="rw" value="repair" ${sh.choice === 'repair' ? 'checked' : ''}> <b>Leave it needing repair</b> — keep the attachment, marked “host removed”</label>
        </div>`;
    } else h += '<p class="note">Nothing is hung on it. Objects near it are not attached and won’t move.</p>';
    h += `<div class="acts">${btn('Remove wall', 'removewall-go', {}, 'danger', 'data-fk="rw-go"')}${btn('Cancel', 'sheet-close', {}, 'primary', 'data-fk="sh-x"')}</div>`;
  } else if (sh.kind === 'share') {
    const d = doc.defs[sh.defId];
    const deps = d.comps.map((c) => doc.defs[c.def]).filter(Boolean);
    h = `<h2>Share ${esc(d.name)} to ${esc(S.store.library.name)}</h2><p class="note">Simulated storage. Publishes rev 1: an immutable copy of the definition${deps.length ? ` and what it depends on (${deps.map((x) => `${esc(x.name)} rev ${x.lock}`).join(', ')})` : ''}.</p>
      <ul class="what"><li>Its identity ${R(sh.defId)} stays the same — library-hosted, project-local and retained copies are one resource.</li><li>Projects that use it get <b>offered</b> later revisions. Nothing updates on its own.</li><li>Uses keep their own settings.</li></ul>
      <div class="acts">${btn('Share as rev 1', 'share-go', {}, 'primary', 'data-fk="share-go"')}${btn('Cancel', 'sheet-close', {}, '', 'data-fk="sh-x"')}</div>`;
  } else if (sh.kind === 'uselib') {
    const item = S.store.library.items[sh.defId];
    h = `<h2>Use ${esc(item?.name ?? '')} from ${esc(S.store.library.name)}</h2><p class="note">rev ${item?.latest} · published from ${esc(item?.from ?? '')} · you’re authorized (simulated).</p>
      <div class="opts" role="radiogroup">
        <label class="rad"><input type="radio" name="ul" data-field="ul" value="retained" ${sh.mode === 'retained' ? 'checked' : ''}> <b>Reference + retained copy</b> — pinned to rev ${item?.latest}; a vendored immutable copy keeps it working if the library is unavailable</label>
        <label class="rad"><input type="radio" name="ul" data-field="ul" value="reference" disabled> <b>Reference only</b> — not implemented in this specimen; see the unavailable-resource design in Specimens</label>
      </div>
      <p class="note q">Either way it is the same resource identity. Forking — an independent copy you edit here — is a separate, later choice.</p>
      <div class="acts">${btn('Use it', 'uselib-go', {}, 'primary', 'data-fk="ul-go"')}${btn('Cancel', 'sheet-close', {}, '', 'data-fk="sh-x"')}</div>`;
  } else if (sh.kind === 'keys') {
    h = `<h2>Keys</h2><div class="keys">
      <span><kbd>Click</kbd> select object / group</span><span><kbd>Double-click</kbd> go one level inside</span>
      <span><kbd>Alt</kbd>-click deepest part</span><span><kbd>Shift</kbd>-click add objects</span>
      <span><kbd>Esc</kbd> up a level / close</span><span><kbd>F</kbd> frame selection</span>
      <span><kbd>I</kbd> inspect parts (view only)</span><span><kbd>P</kbd> try articulation</span>
      <span><kbd>H</kbd> hang on a wall</span><span><kbd>⌘D</kbd> place another use</span>
      <span><kbd>⌘G</kbd> group</span><span><kbd>/</kbd> find anything</span>
      <span><kbd>⌘Z</kbd> undo · <kbd>⇧⌘Z</kbd> redo</span><span><kbd>J</kbd> scenario panel</span>
      <span><kbd>←↑→↓</kbd> in Contents: move, open, close</span><span>Drag empty space: orbit · right-drag: pan · wheel: zoom</span>
      <span><kbd>[</kbd> / <kbd>]</kbd> previous / next sibling on canvas</span><span><kbd>Tab</kbd> move to the next control</span>
    </div><div class="acts">${btn('Close', 'sheet-close', {}, 'primary', 'data-fk="sh-x"')}</div>`;
  }
  el.hidden = false;
  el.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(sh.kind)}">${h}</div>`;
  requestAnimationFrame(() => {
    if (!el.contains(document.activeElement)) el.querySelector('input:not([type=radio]),.primary,button')?.focus();
  });
}

function renderSummary() {
  const el = $('summary');
  const s = S.summary;
  if (!s) { el.hidden = true; return; }
  el.hidden = false;
  el.innerHTML = `<div class="sm-t">${esc(s.title)}</div><ul>${s.lines.map((l) => `<li>${esc(l)}</li>`).join('')}</ul><div class="acts">${s.n && s.undoTo != null ? btn(s.n > 1 ? `Undo these ${s.n}` : 'Undo this', 'undo-to', { n: s.undoTo }, 'sm', 'data-fk="sm-undo"') : ''}${btn('OK', 'summary-close', {}, 'sm primary', 'data-fk="sm-ok"')}</div>`;
}
export function renderFlash() {
  const el = $('flash');
  const f = S.flash;
  if (!f || performance.now() - f.t > f.ms) { if (!el.hidden) el.hidden = true; return; }
  if (el.dataset.t !== String(f.t)) {
    el.dataset.t = String(f.t);
    el.className = `flash ${f.tone}`;
    el.innerHTML = `${f.tone === 'refuse' ? '<b>✕</b> ' : f.tone === 'warn' ? '<b>!</b> ' : ''}${esc(f.text)}`;
    el.hidden = false;
    if (f.at) {
      const r = $('stage').getBoundingClientRect();
      el.style.left = `${Math.min(r.width - 340, Math.max(60, f.at.x - r.left + 12))}px`;
      el.style.top = `${Math.min(r.height - 60, Math.max(10, f.at.y - r.top + 14))}px`;
      el.style.bottom = 'auto';
      el.classList.add('at');
    } else { el.style.left = ''; el.style.top = ''; el.style.bottom = ''; }
  }
}

function renderStatus() {
  const doc = D();
  const s = S.sel;
  let selText = 'nothing selected';
  if (s?.kind === 'use' && doc.uses[s.id]) {
    const u = doc.uses[s.id];
    const p = s.path?.length ? partAt(doc, u.def, s.path) : null;
    selText = `${p ? `${p.name} · ` : ''}${u.name} <span class="mono">${[s.id, ...(s.path ?? [])].join('/')}</span>`;
  } else if (s) selText = `${s.kind} <span class="mono">${esc(s.id)}</span>`;
  if (S.multi.length && s) selText = `${S.multi.length + 1} objects`;
  $('status').innerHTML = `<span>Scene · 3D · ${S.mode === 'layout' ? 'Layout' : 'Arrange'}</span><span>${selText}</span><span>${Object.keys(doc.uses).length} placed · world-local · metres</span><span class="grow"></span><span>${S.approach === 'bench' ? 'Definition edits: bench' : 'Definition edits: contextual reach'}</span><span>${S.store.library.available ? 'library reachable' : '<b class="t-bad">library unavailable</b>'} <i>(simulated)</i></span>`;
}

function renderPop() {
  const el = $('pop');
  if (!S.pop) { el.hidden = true; el.innerHTML = ''; return; }
  const p = P();
  let h = '';
  if (S.pop === 'history') {
    const entries = [...p.undo].reverse();
    h = `<div class="pop-t">History · ${esc(p.doc.name)}</div><p class="note q">One accepted action = one entry = one Undo. Inspection, previews and view changes never appear here.</p>
      <ol class="hist">${entries.map((e, i) => `<li><span class="h-l">${esc(e.label)}</span><span class="h-d">${e.domains.map((d) => `<i class="dom ${d.toLowerCase()}">${d}</i>`).join('')}</span><span class="mono q">rev ${e.rev}</span>${i === 0 ? '' : ''}</li>`).join('') || '<li class="q">No changes yet.</li>'}</ol>
      ${p.log.length ? `<div class="pop-t sm">Other writers</div><ol class="hist">${p.log.map((l) => `<li><span class="h-l">${esc(l.who)}: ${esc(l.label)}</span><span class="mono q">rev ${l.rev}</span></li>`).join('')}</ol>` : ''}`;
  } else if (S.pop === 'projects') {
    h = `<div class="pop-t">Projects</div>${Object.values(S.store.projects).map((pp) => `<button class="pj ${pp.id === S.store.active ? 'on' : ''}" data-act="project" data-p="${pp.id}" data-fk="pj-${pp.id}"><b>${esc(pp.doc.name)}</b><span class="q">${pp.id === 'p2' ? 'second-project specimen · ' : ''}rev ${pp.rev}</span></button>`).join('')}
      <div class="pop-t sm">Library</div><p class="note">${esc(S.store.library.name)} · ${Object.keys(S.store.library.items).length} resource${Object.keys(S.store.library.items).length === 1 ? '' : 's'} · ${S.store.library.available ? 'reachable' : '<b class="t-bad">unavailable</b>'} <i>(simulated storage)</i></p>`;
  }
  el.hidden = false;
  el.className = `pop ${S.pop}`;
  el.innerHTML = h;
}

function renderEmpty() {
  const el = $('empty');
  const doc = D();
  const empty = !Object.keys(doc.uses).length && !S.instr && !doc.layout;
  el.hidden = !empty;
  if (empty) {
    el.innerHTML = `<div class="empty-card"><div class="empty-k">Empty project · world-local</div><h2>Start with an object</h2><p>No room, tour or floor plan is needed first. Architecture can join later without re-parenting anything.</p>
      <div class="acts">${btn('Import a model…', 'import', {}, 'primary', 'data-fk="e-import"')}${btn('Add a plinth block', 'add-plinth', {}, '', 'data-fk="e-plinth"')}</div></div>`;
  }
}

// ---------------------------------------------------------------- finder (“where is it?”)
export function openFinder() {
  S.finder = { q: '', i: 0, returnFocus: document.activeElement };
  $('finder').hidden = false;
  const inp = $('finderInput');
  inp.value = '';
  renderFinderList();
  inp.focus();
}
export function closeFinder() {
  const returnFocus = S.finder?.returnFocus;
  S.finder = null;
  $('finder').hidden = true;
  if (returnFocus?.isConnected) returnFocus.focus();
  else $('gl').focus();
}
export function finderItems() {
  const doc = D();
  const out = [];
  for (const u of Object.values(doc.uses)) {
    out.push({ name: u.name, kind: defName(doc, u.def), ref: u.id, sel: { kind: 'use', id: u.id, path: [] }, state: u.attach?.broken ? 'repair' : 'placed' });
    for (const p of iface(doc, u.def).parts) {
      out.push({ name: p.name, kind: `${p.comp ? 'component' : 'part'} of ${u.name} ${u.id}`, ref: `${u.id}/${p.path.join('/')}`, sel: { kind: 'use', id: u.id, path: p.path }, state: p.enclosedBy ? 'enclosed' : p.comp ? 'component' : 'part', why: p.enclosedBy ? 'inside the shade — Inspect to see it' : '' });
    }
  }
  const C = compileLayout(doc.layout);
  for (const w of C?.walls ?? []) {
    out.push({ name: w.name, kind: 'wall · Layout', ref: w.id, sel: { kind: 'wall', id: w.id }, state: 'layout' });
    for (const o of w.openings) out.push({ name: o.name, kind: `opening in ${w.name}`, ref: o.id, sel: { kind: 'opening', id: o.id }, state: 'layout' });
  }
  for (const d of Object.values(doc.defs)) out.push({ name: d.name, kind: 'definition', ref: d.id, sel: { kind: 'def', id: d.id }, state: 'definition' });
  for (const r of Object.values(doc.refs)) out.push({ name: r.name, kind: `${r.domain} ${r.kind.toLowerCase()}`, ref: r.id, sel: { kind: 'ref', id: r.id }, state: resolveRef(doc, r).status === 'ok' ? 'reference' : resolveRef(doc, r).status });
  return out;
}
export function renderFinderList() {
  const q = (S.finder?.q ?? '').toLowerCase();
  const items = finderItems().filter((x) => !q || `${x.name} ${x.ref} ${x.kind}`.toLowerCase().includes(q));
  S.finder.items = items;
  S.finder.i = Math.min(S.finder.i, Math.max(0, items.length - 1));
  $('finderList').innerHTML = items.length ? items.map((x, i) => `<li id="find-result-${i}" role="option" aria-selected="${i === S.finder.i}" class="${i === S.finder.i ? 'on' : ''}" data-i="${i}"><span class="fn">${esc(x.name)} <span class="ref">${esc(x.ref)}</span></span><span class="fk">${esc(x.kind)}${x.why ? ` — ${esc(x.why)}` : ''}</span><span class="state ${x.state}">${esc(x.state)}</span></li>`).join('') : '<li class="empty">Nothing matches.</li>';
  if (items.length) $('finderInput').setAttribute('aria-activedescendant', `find-result-${S.finder.i}`);
  else $('finderInput').removeAttribute('aria-activedescendant');
}
