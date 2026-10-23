// Chrome around the Stage: Head (with live Find), Index (scope + facets, two collapse
// treatments) and the contextual Card (inline dimensions, progressive detail).
import { icon } from './icons.js';
import * as SC from './scene.js';
import { $, S, M, H, R, UI, esc, f2, clamp, ent, view, pres, guide, level, structure, kindLabel, kindIcon, roomOf, roomsOfWall, levelOf, structureOf, wallRole, usedIn, findRaw, heightMarks, markAt, commit, toast } from './core.js';

// ---------------- Head ----------------
export function renderHead() {
  const can = H.i > 0, canR = H.i < H.stack.length - 1;
  const loc = !S.indexOpen && S.cmp.collapse === 'crumb' && S.lens === 'world' ? locationCrumb() : '';
  $('#head').innerHTML = `
    <button class="hbtn" data-act="appmenu" aria-expanded="${S.appMenu}" title="Menu: viewing preferences, keys">${icon('menu')}</button>
    <span class="proj" title="Project">${M.structures.length > 2 ? 'Harbour museum' : 'Boathouse gallery'}</span>
    <div class="seg" role="group" aria-label="Lens">
      <button aria-pressed="${S.lens === 'world'}" data-act="lens" data-v="world">World</button>
      <button aria-pressed="${S.lens === 'experience'}" data-act="lens" data-v="experience">Experience</button>
    </div>
    ${S.lens === 'experience' ? `<span class="exp"><b>Opening night</b>${icon('chevronDown', 13)}</span>` : ''}
    ${loc}${!S.indexOpen && S.lens === 'experience' ? `<button class="locchip" data-act="indexopen" title="Show the Index (\\)">${icon('indexPanel', 15)}<span>Presentations</span></button>` : ''}
    <span class="grow"></span>
    <div class="findbox${S.find.open ? ' open' : ''}" id="findbox">${icon('search', 15)}<input id="findin" placeholder="Find tools, actions, places…" value="${esc(S.find.q)}" autocomplete="off" spellcheck="false"><span class="kbd">⌘K</span></div>
    <span class="hsep"></span>
    <button class="hbtn" data-act="undo" ${can ? '' : 'disabled'} title="Undo ${esc(can ? H.stack[H.i].label : '')} (⌘Z)">${icon('undo')}</button>
    <button class="hbtn" data-act="redo" ${canR ? '' : 'disabled'} title="Redo (⇧⌘Z)">${icon('redo')}</button>
    <span class="saved" title="Saved">${icon('check', 14)}</span>
    <button class="btn-preview" data-act="preview" title="Preview the visitor experience">${icon('preview', 15)}<span>Preview</span></button>`;
  const fl = $('#findlist');
  fl.innerHTML = S.find.open ? findHtml() : '';
}
function locationCrumb() {
  const sc = scopeNow(); const parts = [];
  if (sc.st) parts.push(structure(sc.st)?.name); if (sc.lv) parts.push(level(sc.lv)?.name); if (sc.room) parts.push(ent(sc.room)?.name);
  return `<button class="locchip" data-act="indexopen" title="Show the Index (\\)">${icon('indexPanel', 15)}<span>${esc(parts.filter(Boolean).join(' › ') || 'Whole project')}</span></button>`;
}
export function appMenuHtml() {
  if (!S.appMenu) return '';
  return `<div class="pop appmenu"><h6>Viewing</h6><div class="row2"><span>Top-down & flat views</span><span class="seg2"><button data-act="pref-topdown" data-v="paper" aria-pressed="${S.prefs.topDown === 'paper'}">Paper</button><button data-act="pref-topdown" data-v="shaded" aria-pressed="${S.prefs.topDown === 'shaded'}">Keep shaded</button></span></div><div class="hint">Paper: 2D, elevations and sections settle onto vellum. Keep shaded: they stay on the 3D mat. Projection and working height are unaffected.</div><hr><button class="row" data-act="indextoggle">${icon('indexPanel', 15)}${S.indexOpen ? 'Hide' : 'Show'} the Index<span class="k kbd">\\</span></button><button class="row" data-act="keys">${icon('dot', 15)}Keys<span class="k kbd">?</span></button></div>`;
}

// ---------------- Find (Head) ----------------
const TOOLS = [
  ['Select', 'tool:select', 'select', 'V'], ['Ink', 'tool:ink', 'ink', 'P'], ['Ink · box', 'tip:box', 'box', ''], ['Ink · round', 'tip:round', 'round', ''],
  ['Slice through', 'tool:slice', 'slice', 'K'], ['Slice at height', 'slice:height', 'focusHeight', ''], ['Eraser', 'tool:eraser', 'eraser', 'E'], ['Lasso erase', 'erase:lasso', 'lasso', ''],
  ['Brush', 'tool:brush', 'paint', 'B'], ['Measure', 'tool:measure', 'measure', 'M'], ['Library', 'assets:objects', 'assets', 'A'], ['Import a model', 'assets:import', 'import', ''],
];
const READS = [['2D', 'reading:plan', 'plan', '2'], ['3D', 'reading:3d', 'view3d', '1'], ['Eye level', 'reading:eye', 'person', '4'], ['Elevation south', 'elev:S', 'elevation', ''], ['Elevation east', 'elev:E', 'elevation', ''], ['Lift roofs apart', 'lift', 'lift', 'L'], ['Focus this height', 'focus', 'focusHeight', 'F']];
const RUNS = [['Pin this height', 'pin', 'pin', ''], ['Add a Level at this height…', 'addlevel', 'layers', ''], ['Viewing preferences', 'prefs', 'eye', ''], ['Divide room', 'proc:divide', 'plan', ''], ['Cover rooms with a roof', 'proc:cover', 'roof', '']];
export function findResults() {
  const q = S.find.q.trim().toLowerCase(); const out = [];
  const match = (l) => !q || l.toLowerCase().includes(q) || q.split(' ').every((w) => l.toLowerCase().includes(w));
  const e = UI.selEntity();
  if (e && ent(e.id)) for (const [l, a] of UI.scopedList(e)) if (match(l)) out.push({ g: `For ${e.name}`, l, a, ic: 'chevronRight', verb: 'Do' });
  for (const [l, a, ic, k] of TOOLS) if (match(l)) out.push({ g: 'Tools', l, a, ic, k, verb: 'Arm' });
  for (const [l, a, ic, k] of READS) if (match(l)) out.push({ g: 'Readings', l, a, ic, k, verb: 'Show' });
  if (q) for (const [l, a, ic] of RUNS) if (match(l)) out.push({ g: 'Commands', l, a, ic, verb: 'Run' });
  if (q.length >= 2) {
    // what is in the current scope ranks first; Select keeps the scope, only Go to moves it
    const near = (x) => { const r = x.k === 'room' ? findRaw(x.id) : x.k ? null : roomOf(x); const lv = x.k === 'level' ? x.id : r ? r.level : null; return (S.scope.room && r && r.id === S.scope.room ? 2 : 0) + (S.scope.lv && lv === S.scope.lv ? 1 : 0); };
    const places = [...M.structures.map((s) => ({ id: s.id, name: s.name, k: 'structure' })), ...M.levels.map((l) => ({ id: l.id, name: l.name, k: 'level', meta: structure(l.structure)?.name })), ...M.rooms.map((r) => ({ id: r.id, name: r.name, k: 'room', meta: level(r.level)?.name }))].filter((p) => match(p.name)).sort((a, b) => near(b) - near(a)).slice(0, 4);
    for (const p of places) out.push({ g: 'Go to', l: p.name, meta: p.meta, a: `goto:${p.k}:${p.id}`, ic: kindIcon[p.k] || 'plan', verb: 'Go to' });
    const subj = SC.entities(M).filter((x) => x.kind !== 'room' && match(x.name)).sort((a, b) => near(b) - near(a));
    for (const x of subj.slice(0, 5)) out.push({ g: 'Select', l: x.name, meta: [roomOf(x)?.name, levelOf(x)?.name].filter(Boolean).join(' · '), a: `select:${x.id}`, ic: kindIcon[x.kind], verb: 'Select' });
    if (subj.length > 5) out.push({ g: 'Select', l: `${subj.length - 5} more subjects in the Index`, a: `indexsearch:${S.find.q}`, ic: 'indexPanel', verb: 'Show' });
  }
  return out.slice(0, q ? 14 : 9);
}
function findHtml() {
  const res = findResults(); if (!res.length) return `<div class="flist"><div class="empty">Nothing matches “${esc(S.find.q)}”.</div></div>`;
  let h = '<div class="flist" role="listbox">', g = '';
  res.forEach((r, i) => {
    if (r.g !== g) { h += `<h6>${esc(r.g)}</h6>`; g = r.g; }
    h += `<button class="${i === S.find.idx ? 'hl' : ''}" data-act="findrun" data-i="${i}" role="option">${icon(r.ic || 'dot', 15)}<span class="l">${esc(r.l)}${r.meta ? `<small>${esc(r.meta)}</small>` : ''}</span><span class="vb">${r.verb}</span>${r.k ? `<span class="kbd">${r.k}</span>` : ''}</button>`;
  });
  return h + '</div>';
}

// ---------------- Index: a navigation projection, never an ownership change ----------------
export function scopeNow() {
  const sc = { ...S.scope };
  if (M.structures.length === 1 && !sc.st) sc.st = M.structures[0].id;
  const st = sc.st && structure(sc.st);
  if (st && !sc.lv) { const lvs = M.levels.filter((l) => l.structure === st.id); if (lvs.length === 1) sc.lv = lvs[0].id; }
  return sc;
}
let IX = { key: '', ent: null };
/** Where every entity sits for navigation: structure, level, rooms (walls may have two). */
function placeIndex() {
  const key = `${H.i}|${S.scenario}`; if (IX.key === key) return IX;
  const list = SC.entities(M).filter((e) => e.kind !== 'room' || true);
  const info = new Map();
  for (const e of list) {
    const rooms = e.kind === 'wall' ? roomsOfWall(e.id).map((r) => r.id) : e.kind === 'room' ? [] : [roomOf(e)?.id].filter(Boolean);
    info.set(e.id, { e, lv: levelOf(e)?.id || null, st: structureOf(e)?.id || null, rooms });
  }
  IX = { key, info }; return IX;
}
const FACETS = [['all', 'All', 'layers'], ['room', 'Rooms', 'plan'], ['wall', 'Walls', 'wall'], ['opening', 'Openings', 'opening'], ['object', 'Objects', 'object'], ['artwork', 'Art', 'material']];
function inScope(i, sc) { if (sc.room) return i.rooms.includes(sc.room) || i.e.id === sc.room; if (sc.lv) return i.lv === sc.lv; if (sc.st) return i.st === sc.st; return true; }
function irow(e, meta, opts = {}) {
  const sel = S.sel === e.id ? ' sel' : '';
  return `<div class="irow${sel}${opts.cls || ''}" style="--d:${opts.depth || 0}" data-hover="${e.id}"><button class="nmb" data-act="${opts.act || 'sel'}" data-id="${e.id}">${icon(opts.ic || kindIcon[e.kind] || 'dot', 15)}<span class="nm">${esc(e.name)}</span><span class="mt">${meta || ''}</span></button>${opts.enter ? `<button class="enter" data-act="scope" data-k="room" data-id="${e.id}" title="Go into ${esc(e.name)}">${icon('chevronRight', 13)}</button>` : ''}</div>`;
}
function metaFor(e, ctxRoom) {
  if (e.kind === 'wall') { const rs = roomsOfWall(e.id); return rs.length > 1 ? `⇄ ${esc(rs.find((r) => r.id !== ctxRoom)?.name || rs[1].name)}` : `${SC.wallLen(e).toFixed(1)} m`; }
  if (e.kind === 'opening') return `${f2(e.w)} m`;
  if (e.kind === 'artwork') return '';
  if (e.kind === 'room') return e.type === 'platform' ? `+${f2(e.z)}` : `${SC.polyArea(e.poly).toFixed(0)} m²`;
  if (e.kind === 'roof') return '';
  return '';
}
export function renderIndex() {
  const el = $('#index'), sh = $('#isheet');
  const overlay = S.mid;
  if (!S.indexOpen) {
    el.className = 'index gone'; el.innerHTML = '';
    // edge treatment: a minimal translucent arrow, no rail; hover or focus brightens it, a tap on the edge opens the Index
    sh.innerHTML = S.cmp.collapse === 'peek' ? `<div class="peekzone" data-act="indexopen"></div><button class="peekarrow${S.peek ? ' on' : ''}" data-act="indexopen" title="Show the Index (\\)" aria-label="Show the Index">${icon('chevronRight', 16)}</button>` : '';
    return;
  }
  const body = indexBody();
  if (overlay) { el.className = 'index gone'; el.innerHTML = ''; sh.innerHTML = `<div class="scrim" data-act="indexclose"></div><aside class="index ov">${body}</aside>`; }
  else { el.className = 'index'; el.innerHTML = body; sh.innerHTML = ''; }
}
function indexBody() {
  const head = `<div class="ihead"><label class="isearch">${icon('search', 14)}<input id="isearch" placeholder="${S.lens === 'world' ? 'Filter places and things' : 'Filter presentations'}" value="${esc(S.lens === 'world' ? S.search : S.exSearch || '')}"></label><button class="iconbtn" data-act="indexclose" title="Hide the Index (\\)">${icon('chevronLeft', 15)}</button></div>`;
  return head + (S.lens === 'world' ? (S.search.trim() ? searchList() : scopeIndex()) : UI.expIndex());
}
function searchList() {
  const q = S.search.trim().toLowerCase(); const { info } = placeIndex();
  const res = [...info.values()].filter((i) => i.e.name.toLowerCase().includes(q));
  let h = `<div class="ilist"><div class="igroup"><span>${res.length} match${res.length === 1 ? '' : 'es'}</span></div>`;
  h += res.slice(0, 60).map((i) => irow(i.e, esc([ent(i.rooms[0])?.name, level(i.lv)?.name].filter(Boolean).join(' · ')))).join('');
  if (res.length > 60) h += `<div class="imore">${res.length - 60} more — narrow the filter</div>`;
  return h + '</div>';
}

// ----- Scope + facets (drill in, breadcrumb segments switch siblings) -----
function scopeIndex() {
  const sc = scopeNow(); const { info } = placeIndex();
  let h = `<div class="crumbs">`;
  const seg = (label, k, id, sibs) => `<span class="cseg"><button data-act="scope" data-k="${k}" data-id="${id || ''}">${esc(label)}</button>${sibs && sibs.length > 1 ? `<button class="sib" data-act="sibs" data-k="${k}" title="Switch">${icon('chevronDown', 11)}</button>` : ''}</span>`;
  h += seg('Project', 'project', '');
  if (sc.st) h += '›' + seg(structure(sc.st)?.name, 'st', sc.st, M.structures);
  if (sc.lv) h += '›' + seg(level(sc.lv)?.name, 'lv', sc.lv, M.levels.filter((l) => l.structure === sc.st));
  if (sc.room) h += '›' + seg(ent(sc.room)?.name || '', 'room', sc.room, M.rooms.filter((r) => r.level === sc.lv));
  h += `</div>`;
  if (S.sibs) h += sibMenu(S.sibs, sc);
  const cnt = (k) => [...info.values()].filter((i) => i.e.kind === k && inScope(i, sc)).length;
  h += `<div class="facets" role="group" aria-label="Show">${FACETS.map(([k, l, ic]) => `<button data-act="facet" data-v="${k}" aria-pressed="${S.facet === k}" title="${l}${k !== 'all' ? ` · ${cnt(k)} here` : ''}">${k === 'all' ? 'All' : icon(ic, 14)}</button>`).join('')}</div><div class="ilist">`;
  const cap = (key, list, fn) => { const n = S.more[key] || 40; return list.slice(0, n).map(fn).join('') + (list.length > n ? `<button class="imore" data-act="more" data-k="${key}">Show ${Math.min(list.length - n, 200)} more of ${list.length}</button>` : ''); };
  if (S.facet !== 'all') {
    const list = [...info.values()].filter((i) => i.e.kind === S.facet && inScope(i, sc)).sort((a, b) => a.e.name.localeCompare(b.e.name, undefined, { numeric: true }));
    h += `<div class="igroup"><span>${FACETS.find((f) => f[0] === S.facet)[1]} in ${esc(sc.room ? ent(sc.room)?.name : sc.lv ? level(sc.lv)?.name : sc.st ? structure(sc.st)?.name : 'the project')}</span><span>${list.length}</span></div>`;
    h += cap('facet', list, (i) => irow(i.e, esc(i.e.kind === 'room' ? `${SC.polyArea(i.e.poly).toFixed(0)} m²` : sc.room ? metaFor(i.e, sc.room) : ent(i.rooms[0])?.name || ''), { enter: i.e.kind === 'room' }));
    return h + '</div>';
  }
  if (!sc.st) {
    for (const s of M.structures) { const lv = M.levels.filter((l) => l.structure === s.id); h += `<div class="irow" data-hover=""><button class="nmb" data-act="scope" data-k="st" data-id="${s.id}">${icon('elevation', 15)}<span class="nm">${esc(s.name)}</span><span class="mt">${lv.length} level${lv.length > 1 ? 's' : ''}</span></button><button class="enter" data-act="scope" data-k="st" data-id="${s.id}">${icon('chevronRight', 13)}</button></div>`; }
  } else if (!sc.lv) {
    for (const l of M.levels.filter((l) => l.structure === sc.st).sort((a, b) => b.z - a.z)) { const n = M.rooms.filter((r) => r.level === l.id).length; h += `<div class="irow"><button class="nmb" data-act="scope" data-k="lv" data-id="${l.id}">${icon('layers', 15)}<span class="nm">${esc(l.name)}</span><span class="mt">${f2(l.z)} · ${n} rooms</span></button><button class="enter" data-act="scope" data-k="lv" data-id="${l.id}">${icon('chevronRight', 13)}</button></div>`; }
    const roofs = M.roofs.filter((r) => r.structure === sc.st); if (roofs.length) h += `<div class="igroup"><span>Overhead</span></div>` + roofs.map((r) => irow({ ...r, kind: 'roof' }, '')).join('');
  } else if (!sc.room) {
    const rooms = M.rooms.filter((r) => r.level === sc.lv).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    h += cap('rooms', rooms, (r) => { const n = [...info.values()].filter((i) => i.rooms.includes(r.id) && i.e.kind !== 'wall').length; return irow({ ...r, kind: 'room' }, r.type === 'platform' ? `platform +${f2(r.z)}` : `${n} things`, { enter: r.type !== 'platform' }); });
    const loose = [...info.values()].filter((i) => i.lv === sc.lv && !i.rooms.length && ['wall', 'object'].includes(i.e.kind));
    if (loose.length) h += `<div class="igroup"><span>Not in a room</span><span>${loose.length}</span></div>` + cap('loose', loose, (i) => irow(i.e, i.e.kind === 'wall' ? wallRole(i.e) : ''));
    const roofs = M.roofs.filter((r) => r.structure === sc.st && (r.over || []).some((w) => info.get(w)?.lv === sc.lv)); if (roofs.length) h += `<div class="igroup"><span>Overhead</span></div>` + roofs.map((r) => irow({ ...r, kind: 'roof' }, '')).join('');
  } else h += roomContents(ent(sc.room), 0);
  if (M.tray.length) h += trayHtml();
  return h + '</div>';
}
function sibMenu(k, sc) {
  const list = k === 'st' ? M.structures : k === 'lv' ? M.levels.filter((l) => l.structure === sc.st) : M.rooms.filter((r) => r.level === sc.lv && r.type !== 'platform');
  return `<div class="sibmenu">${list.map((x) => `<button data-act="scope" data-k="${k}" data-id="${x.id}" aria-pressed="${sc[k] === x.id}">${esc(x.name)}</button>`).join('')}</div>`;
}
function roomContents(room, depth) {
  if (!room) return '';
  const { info } = placeIndex(); const items = [...info.values()].filter((i) => i.rooms.includes(room.id));
  const by = (k) => items.filter((i) => i.e.kind === k).map((i) => i.e);
  const roofs = M.roofs.filter((r) => (r.over || []).some((w) => room.walls.includes(w)));
  const grp = (t, list, fn) => (list.length ? `<div class="igroup" style="--d:${depth}"><span>${t}</span><span>${list.length}</span></div>` + list.map(fn).join('') : '');
  return grp('Walls', by('wall'), (w) => irow(w, metaFor(w, room.id), { depth })) + grp('Openings', by('opening'), (o) => irow(o, metaFor(o), { depth })) + grp('On the walls', by('artwork'), (a) => irow(a, '', { depth })) + grp('In the room', [...by('object'), ...by('import')], (o) => irow(o, '', { depth })) + grp('Overhead', roofs, (r) => irow({ ...r, kind: 'roof' }, '', { depth }));
}
function trayHtml() { return `<div class="igroup"><span>Set aside</span><span>${M.tray.length}</span></div>` + M.tray.map((t, i) => `<div class="irow"><span class="nmb">${icon('layers', 15)}<span class="nm">${esc(t.name)}</span></span><button class="tbtn ghost" data-act="untray" data-i="${i}">Put back</button></div>`).join(''); }

/** Reveal the selection in the Index. */
export function revealInIndex(id) {
  const e = ent(id); if (!e) return;
  setTimeout(() => document.querySelector(`.irow.sel`)?.scrollIntoView({ block: 'nearest' }), 0);
}

// ---------------- Card ----------------
export function renderCard() {
  const el = $('#card'); const e = UI.selEntity();
  if (!e || S.preview || S.lookThrough) { el.innerHTML = ''; return; }
  const shift = S.sheet.side === 'right' && UI.sheetVisible() ? ' shift' : '';
  el.innerHTML = `<section class="card${shift}" aria-label="Selected: ${esc(e.name)}">${S.lens === 'world' ? (ent(e.id) ? worldCard(ent(e.id)) : e.kind === 'level' ? levelCard(e) : foreignCard(e)) : ent(e.id) ? subjectCard(e) : UI.expCard(e)}</section>`;
}
function cardHead(kicker, name, renamable = true) {
  return `<div class="ch"><span class="kick">${kicker}</span><button class="iconbtn sm" data-act="ctxcard" title="More actions">${icon('more', 15)}</button><button class="iconbtn sm" data-act="deselect" title="Deselect (Esc)">${icon('close', 15)}</button></div><h2 ${renamable ? 'data-act="rename" title="Rename"' : ''}>${esc(name)}</h2>`;
}
const LOOKS = {
  wall: [['face', 'face', 'Face this wall'], ['unroll', 'unroll', 'Unroll the room'], ['section', 'section', 'Section through here']],
  room: [['unroll', 'unroll', 'Unroll its walls'], ['focus', 'focusHeight', 'Focus its height'], ['section', 'section', 'Section through here']],
  roof: [['editshape', 'roof', 'Edit its section (Enter)'], ['lift', 'lift', 'Lift roofs apart (L)'], ['section', 'section', 'Section through here']],
  opening: [['facehost', 'face', 'Face its wall'], ['section', 'section', 'Section through here']],
  artwork: [['facehost', 'face', 'Face its wall']],
  object: [['eye', 'person', 'Look from here'], ['section', 'section', 'Section through here']],
  import: [['eye', 'person', 'Look from here'], ['section', 'section', 'Section through here']],
};
export function looksFor(e) { return LOOKS[e.kind] || []; }
/** The ordinary, supported dimensions of a subject: the Card is their one writer. */
export function dimFields(e, adv = false) {
  const F = (k, l, v, o = {}) => ({ k, l, v, ...o });
  if (e.kind === 'wall') return adv ? [F('base', 'Base', f2(e.base)), F('top', 'Top', f2(e.top)), F('th', 'Thick', f2(e.th ?? 0.24))] : [F('len', 'Length', SC.wallLen(e).toFixed(2)), F('ht', 'Height', f2(e.top - e.base))];
  if (e.kind === 'object' || e.kind === 'import') return adv ? [F('x', 'East', f2(e.x)), F('y', 'North', f2(e.y)), F('z', 'Base', f2(e.z || 0), { ro: true, t: 'Follows its support' })] : [F('w', e.fit === 'extend' ? 'Length' : 'Width', f2(e.w)), F('d', 'Depth', f2(e.d)), F('h', 'Height', f2(e.h)), F('rot', 'Turn°', Math.round(e.rot || 0))];
  if (e.kind === 'opening') { const w = SC.wallById(M, e.host); return adv ? [F('at', 'Along', f2(e.at))] : [F('w', 'Width', f2(e.w)), F('h', 'Height', f2(e.h)), F('sill', 'Sill', f2(e.sill - (w?.base || 0)))]; }
  if (e.kind === 'artwork') return adv ? [F('at', 'Along', f2(e.at))] : [F('w', 'Width', f2(e.w)), F('h', 'Height', f2(e.h)), F('c', 'Centre', f2(e.c - (SC.wallById(M, e.host)?.base || 0)))];
  if (e.kind === 'roof') { if (e.poly) return [F('eave', 'Height', f2(e.eave))]; const pr = SC.roofProf(e); return adv ? [F('over', 'Overhang', '0.30', { ro: true })] : [F('eave', 'Eave', f2(SC.roofEave(e))), F('ridge', 'Top', f2(SC.roofTop(e))), F('pitch', 'Pitch°', pr.length === 3 ? Math.round((Math.atan((pr[1][1] - pr[0][1]) / Math.max(0.01, pr[1][0])) * 180) / Math.PI) : '—', { ro: pr.length !== 3 })]; }
  if (e.kind === 'room') return e.walls.length ? [F('area', 'Area m²', SC.polyArea(e.poly).toFixed(1), { ro: true, t: 'Derived from its walls' })] : [F('z', 'Height', f2(e.z)), F('area', 'Area m²', SC.polyArea(e.poly).toFixed(1), { ro: true })];
  return [];
}
function fieldsHtml(e, list) {
  const rf = S.dimRefuse && S.dimRefuse.id === e.id ? S.dimRefuse : null;
  return `<div class="dims">${list.map((f) => `<label class="df${rf && rf.k === f.k ? ' ref' : ''}" title="${esc(f.t || (f.ro ? 'Derived' : 'Type a value · Enter'))}"><span>${f.l}</span><input data-dim="${f.k}" value="${rf && rf.k === f.k ? esc(rf.v) : f.v}" ${f.ro ? 'readonly' : ''} inputmode="decimal"></label>`).join('')}</div>${rf ? `<div class="refuse">${icon('warning', 14)}<span>${esc(rf.msg)}</span>${rf.fix ? `<button data-act="dimfix">${esc(rf.fix.label)}</button>` : ''}</div>` : ''}`;
}
function kicker(e) {
  const lv = levelOf(e), rm = roomOf(e);
  if (e.kind === 'wall') return `Wall · ${esc(wallRole(e))}`;
  if (e.kind === 'opening') return `Opening in <a data-act="sel" data-id="${e.host}">${esc(SC.wallById(M, e.host)?.name || '?')}</a>`;
  if (e.kind === 'artwork') return `Artwork on <a data-act="sel" data-id="${e.host}">${esc(SC.wallById(M, e.host)?.name || '?')}</a>`;
  if (e.kind === 'roof') return `Roof${rm ? ' over ' + esc(rm.name) : ''}`;
  if (e.kind === 'room') return e.walls.length ? `Room · ${esc(lv?.name || '')}` : 'Platform · a surface, not a Level';
  const sup = UI.supportOf?.(e);
  if (e.type === 'profile') return `Ordinary shape · ${esc(rm?.name || 'Outside')}${sup ? ` · on ${esc(sup)}` : ''}`;
  return `${e.imported ? 'Imported · ' : ''}${esc(rm?.name || 'Outside')}${sup ? ` · on ${esc(sup)}` : ''}`;
}
function worldCard(e) {
  let h = cardHead(kicker(e), e.name);
  if (S.editShape && S.editShape.id === e.id) return h + UI.editShapeCard(e);
  h += fieldsHtml(e, dimFields(e));
  if (e.type === 'profile') h += `<div class="inexp">${icon('shape', 13)}<span>${e.h < 0.1 ? 'A drawn profile. Pull it up with the height arrow.' : 'Pulled from its profile, which stays editable.'} Taper and Revolve would join here later.</span></div>`;
  const lo = M.loose.find((l) => l.id === e.id);
  if (lo) h += `<div class="cond">${icon('warning', 14)}<span>${esc(lo.msg)}</span><button data-act="repair">Repair</button></div>`;
  const ui = usedIn(e.id);
  if (ui.length) h += `<div class="inexp">${icon('layers', 13)}<span>In Experience:</span>${ui.map((p) => `<button data-act="openexp" data-id="${p.id}">${esc(p.name)}</button>`).join('')}</div>`;
  const fin = M.finishes[e.id];
  const looks = looksFor(e);
  h += `<div class="cfoot">${looks.map(([k, ic, l]) => `<button class="iconbtn sm" data-act="look" data-v="${k}" title="${esc(l)}">${icon(ic, 15)}</button>`).join('')}${fin ? `<span class="finchip" title="${fin.type === 'material' ? 'Material' : 'Paint'}"><i style="background:${fin.color}"></i>${esc(fin.name)}</span>` : ''}<span class="sp"></span><button class="morebtn" data-act="cardmore" aria-expanded="${S.cardMore}">More ${icon(S.cardMore ? 'chevronUp' : 'chevronDown', 12)}</button></div>`;
  if (S.cardMore) h += advancedHtml(e);
  return h;
}
function advancedHtml(e) {
  let h = '';
  const adv = dimFields(e, true); if (adv.length) h += `<div class="sec">${fieldsHtml(e, adv)}</div>`;
  if (e.kind === 'object' || e.kind === 'import') h += `<div class="sec"><div class="rel"><span>Resizing</span><span>${{ extend: 'extends (parametric)', stretch: 'stretches geometry', proportional: 'proportional by default', fixed: 'stretch distorts it' }[e.fit] || 'stretches geometry'}</span></div></div>`;
  const rel = [];
  if (e.kind === 'wall') { roomsOfWall(e.id).forEach((r) => rel.push(['Bounds', r.name, r.id])); M.openings.filter((o) => o.host === e.id).forEach((o) => rel.push(['Hosts', o.name, o.id])); M.artworks.filter((a) => a.host === e.id).forEach((a) => rel.push(['Carries', a.name, a.id])); M.roofs.filter((r) => (r.over || []).includes(e.id)).forEach((r) => rel.push(['Supports', r.name, r.id])); }
  if (e.kind === 'roof') (e.over || []).forEach((w) => { const ww = SC.wallById(M, w); rel.push(['Rests on', ww ? ww.name : `${w} (missing)`, ww ? w : null]); });
  if (e.kind === 'room') e.walls.forEach((w) => rel.push(['Bounded by', SC.wallById(M, w)?.name || w, w]));
  if (rel.length) h += `<div class="sec"><h4>Relations</h4>${rel.slice(0, 12).map(([k, n, id]) => `<div class="rel"><span>${k}</span>${id ? `<button data-act="sel" data-id="${id}">${esc(n)}</button>` : `<span class="bad">${esc(n)}</span>`}</div>`).join('')}${rel.length > 12 ? `<div class="rel"><span>+${rel.length - 12} more</span></div>` : ''}</div>`;
  h += `<div class="sec"><div class="rel"><span>Owner</span><span>${['object', 'artwork', 'import'].includes(e.kind) ? 'Scene' : 'Layout'}</span></div><div class="rel"><span>Identity</span><span class="mono">${e.id}</span></div></div>`;
  return h;
}
function levelCard(e) {
  const l = level(e.id);
  return cardHead(`Level · ${esc(structure(l.structure)?.name || '')} · structural`, l.name) + `<div class="dims"><label class="df"><span>Floor at</span><input data-dim="lvz" value="${f2(l.z)}"></label><label class="df" title="Derived"><span>Rooms</span><input readonly value="${M.rooms.filter((r) => r.level === l.id).length}"></label></div><div class="cfoot"><span class="quiet">A Level is authored structure. Height pins and surfaces are only snap candidates.</span></div>`;
}
function subjectCard(e) {
  const ui = usedIn(e.id);
  let h = cardHead(`${kindLabel[e.kind]} · World subject`, e.name, false);
  h += `<div class="sec">${ui.map((p) => `<div class="rel"><span>Presented in</span><button data-act="sel" data-id="${p.id}">${esc(p.name)}</button></div>`).join('') || '<div class="rel"><span>Not presented yet</span></div>'}</div>`;
  h += `<div class="cfoot"><button class="tbtn pri" data-act="presentthis">${icon('layers', 14)} Present this</button><button class="tbtn" data-act="lens" data-v="world">Edit in World</button></div>`;
  return h;
}
function foreignCard(e) {
  return cardHead(`${kindLabel[e.kind] || 'Experience'} · Experience identity`, e.name, false) + `<div class="sec"><div class="rel"><span>World doesn't edit ${esc((kindLabel[e.kind] || 'this').toLowerCase())}s.</span></div></div><div class="cfoot"><button class="tbtn" data-act="lens" data-v="experience">Open in Experience</button></div>`;
}

/** Apply one Card field. Refusals stay in the field; nothing is clamped silently. */
export function applyDim(k, val) {
  const e = UI.selEntity(); if (!e) return; const v = parseFloat(val); if (Number.isNaN(v)) return;
  if (k === 'lvz') { const l = level(e.id); const d = v - l.z; l.z = v; M.walls.filter((w) => w.level === l.id).forEach((w) => { w.base += d; w.top += d; }); M.rooms.filter((r) => r.level === l.id).forEach((r) => (r.z += d)); M.objects.filter((o) => o.level === l.id).forEach((o) => (o.z = (o.z || 0) + d)); commit(`Move ${l.name} to ${f2(v)}`); S.dimRefuse = null; return UI.render(); }
  const raw = findRaw(e.id); if (!raw) return;
  const refuse = (msg, fix) => { S.dimRefuse = { id: e.id, k, v: val, msg, fix }; UI.render(); };
  if (e.kind === 'wall') {
    if (k === 'ht' || k === 'top') {
      const top = k === 'ht' ? raw.base + v : v;
      const need = Math.max(raw.base + 0.5, ...M.openings.filter((o) => o.host === e.id).map((o) => o.sill + o.h + 0.05), ...M.artworks.filter((a) => a.host === e.id).map((a) => a.c + a.h / 2 + 0.05));
      if (top < need) return refuse(`Too low for what this wall hosts (needs ${f2(need - (k === 'ht' ? raw.base : 0))}).`, { label: `Use ${f2(need - (k === 'ht' ? raw.base : 0))}`, k, v: f2(need - (k === 'ht' ? raw.base : 0)) });
      raw.top = top;
    } else if (k === 'len') { if (v < 0.3) return refuse('A wall needs at least 0.30 m.'); const L = SC.wallLen(raw); const d = [(raw.b[0] - raw.a[0]) / L, (raw.b[1] - raw.a[1]) / L]; raw.b = [raw.a[0] + d[0] * v, raw.a[1] + d[1] * v]; }
    else if (k === 'base') raw.base = v;
    else if (k === 'th') { if (v < 0.05 || v > 1.2) return refuse('Thickness between 0.05 and 1.20 m.'); raw.th = v; }
  } else if (e.kind === 'object' || e.kind === 'import') {
    if (['w', 'd', 'h'].includes(k) && v <= 0.02) return refuse('Too small to keep.');
    if (k === 'h') UI.carryRiders(raw, raw.h, v);
    raw[k] = k === 'rot' ? ((v % 360) + 360) % 360 : v;
  } else if (e.kind === 'opening') {
    const w = SC.wallById(M, raw.host);
    const sill = k === 'sill' ? w.base + v : raw.sill, hh = k === 'h' ? v : raw.h;
    if (sill + hh > w.top - 0.05) return refuse(`Doesn't fit under ${w.name}'s top (${f2(w.top - w.base)} high).`);
    if (k === 'sill') raw.sill = sill; else raw[k] = v;
  } else if (e.kind === 'artwork') { const w = SC.wallById(M, raw.host); if (k === 'c') raw.c = w.base + v; else raw[k] = v; }
  else if (e.kind === 'roof') {
    if (raw.poly) raw.eave = v;
    else {
      const pr = SC.roofProf(raw);
      if (k === 'eave') { const d = v - SC.roofEave(raw); raw.prof = pr.map(([s, z]) => [s, z + d]); }
      if (k === 'ridge') { const e0 = SC.roofEave(raw), t0 = SC.roofTop(raw); if (v < e0) return refuse('The top cannot sit below the eave.'); raw.prof = t0 - e0 < 0.01 ? pr.map(([s]) => [s, v]) : pr.map(([s, z]) => [s, e0 + ((z - e0) * (v - e0)) / (t0 - e0)]); }
      if (k === 'pitch' && pr.length === 3) { if (v <= 0 || v >= 80) return refuse('Pitch between 1° and 79°.'); pr[1][1] = pr[0][1] + Math.tan((v * Math.PI) / 180) * pr[1][0]; raw.prof = pr; }
    }
  } else if (e.kind === 'room' && k === 'z') raw.z = v;
  S.dimRefuse = null; commit(`Set ${k} of ${e.name}`); UI.render();
}
