import { experienceIndex, experienceCard, foreignExperienceCard, renderExperienceSurfaces } from './experience-ui.js';
import { S, ctx, W, C, thing, refOf, labelOf } from './state.js';
import { PLACES, placeOf, placesOfBound, placesOfThing, browseRecords as recordList, metadataOf, PRESENTATION, presentationOf } from './fixtures.js';
import {
  wallLength, frameAt, fmt, maxTop, topAt, springOf, centroid, planeY, byId, FLOOR_Y, modS, bbox,
} from './model.js';
import * as T from './tasks.js';
import * as nav from './navigation.js';
import {
  memberOf, viewKind, viewLabel, lidRelations, gapOptions, lookWord, knifeCut, editOnce,
  applyOpening, applyWallTop, applyCeiling, setTopForm, setProfile, deg, whereIs, crumbs, declareRepair,
  isUnresolved, parkedContext,
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
  renderStageTools();
  renderIndex();
  renderBrowse();
  renderCard();
  renderInstrument();
  renderStatus();
  renderPopover();
  renderWhereStatic();
  renderSummary();
  renderExperienceSurfaces();
}

// ---------------------------------------------------------------- head
// Identity of the document, the one search entry, and the building's own history. No domain spine,
// no mode pair, no permanent tool catalogue: what a subject can offer belongs to that subject.

function renderHead() {
  const u = S.undo[S.undo.length - 1], r = S.redo[S.redo.length - 1];
  const ub = $('#undoBtn'), rb = $('#redoBtn');
  if (!ub || !rb) return;
  // The lens is a document state, shown where the document's identity is: which kind of document is in
  // hand, with both lenses real — the bridge is a fixture, not a disabled placeholder.
  for (const b of document.querySelectorAll('#lens [data-act="lens"]')) {
    const on = b.dataset.lens === S.lens;
    if (b.classList.contains('on') !== on) b.classList.toggle('on', on);
    b.setAttribute('aria-selected', String(on));
  }
  // The narrow shell's two sheets: real toggles that say whether their panel is open. They are hidden
  // at the widths where the columns are there, never disabled.
  for (const which of ['index', 'card']) {
    const b = document.querySelector(`[data-act="sheet-${which}"]`);
    if (!b) continue;
    const on = !!S.sheet[which];
    b.classList.toggle('on', on);
    b.setAttribute('aria-expanded', String(on));
  }
  ub.disabled = !u; rb.disabled = !r;
  ub.title = u ? `Undo “${u.label}” (⌘Z)` : 'Nothing to undo';
  rb.title = r ? `Redo “${r.label}” (⇧⌘Z)` : 'Nothing to redo';
  $('#undoLabel').textContent = u ? u.label : 'No building changes yet';
  $('#undoCount').textContent = S.undo.length ? String(S.undo.length) : '';
  $('#docState').textContent = S.undo.length ? `${S.undo.length} change${S.undo.length > 1 ? 's' : ''} · saved` : 'All changes saved';
}

// ---------------------------------------------------------------- stage tools
// The world's own navigation, on the world: one camera tipped between Plan and 3D, and the way back
// to the overview. These are standpoints, not tools.

export function updateTilt() {
  const bead = $('#tiltBead');
  if (!bead) return;
  const el = deg(ctx.stage.cam.el);
  const t = Math.max(0, Math.min(1, (el - 20) / 70));
  bead.style.left = `${(1 - t) * 100}%`;
  bead.classList.toggle('settled', ctx.stage.cam.flat > 0.95 && !S.session);
  $('#tilt').classList.toggle('locked', !!S.session);
}

function renderStageTools() {
  const out = $('#stViewNow');
  if (!out) return;
  const label = S.session ? viewLabel() : (viewKind() === 'plan' ? 'Plan' : '3D');
  if (out.textContent !== label) out.textContent = label;
}

// ---------------------------------------------------------------- the relation Index
// Local context, not a document tree: what is in this place, what is attached to the subject, and
// what the current reading has done to it. A row's own action is Select — the one canonical
// identity — and relation navigation never writes selection by itself.

const BADGE = {
  flat: ['laid flat', 'moved'], opened: ['unrolled', 'moved'], facing: ['facing', 'quiet'], aside: ['set aside', 'quiet'], cut: ['cut', 'cut'],
  away: ['opened away', 'away'], beyond: ['beyond depth', 'away'], lifted: ['lifted', 'moved'], unresolved: ['unresolved', 'away'],
};

function badgeFor(id) {
  const m = memberOf(id);
  let b = BADGE[m.state];
  if (S.reveal && S.reveal === id) b = ['revealed', 'moved'];
  return b ? `<span class="state ${b[1]}">${b[0]}</span>` : '';
}

// Which relation is focused as local context — the point the next work will be about. Focus is not
// identity: it never moves the selection, and Select never moves the focus.
function focusNote(id) {
  const f = S.browse.focus;
  if (f?.kind !== 'rel' || f.at !== id) return '';
  return f.what === 'wall-top' ? 'focused · the next work is about its top' : 'focused · the next work is about it';
}

function indexRow(id, glyph, opts = {}) {
  const t = thing(id);
  if (!t) return '';
  const verbs = opts.noVerbs ? '' : T.capabilities(id)
    .filter((c) => c !== 'reveal')
    .map((c) => `<button class="ix-verb" data-act="look-${c}" data-id="${id}" title="${esc(T.VERB[c])} · ${esc(t.item.name)}">${esc(T.VERB[c])}</button>`).join('');
  const note = [opts.note, focusNote(id)].filter(Boolean).join(' · ');
  return `<div class="ix-row${S.sel === id ? ' sel' : ''}${focusNote(id) ? ' focused' : ''}${opts.cls ? ' ' + opts.cls : ''}">
    <button class="ix-go" data-sel="${id}" aria-selected="${S.sel === id}">
      <span class="glyph ${glyph}"></span><span class="ix-name">${esc(t.item.name)}</span><span class="ix-ref">${esc(refOf(id))}</span>${note ? `<span class="ix-note">${esc(note)}</span>` : ''}
    </button>${badgeFor(id)}${verbs}</div>`;
}

// Which place are we in? The explicit relations first (a shared bound is listed by both places),
// then the subject's own declared place. The Index is about where you are — the selection rides along.
function placeFor(id) {
  const t = thing(id);
  if (!t) return null;
  const g = t.item.gallery || t.wall?.gallery || (t.kind === 'art' ? W(t.item.wall)?.gallery : null);
  const own = g ? PLACES.find((p) => p.id === g) : null;
  if (own) return own;
  const direct = placesOfThing(id);
  return direct[0] || null;
}

// The name of a place, for the shell: a context chip, an announcement. Never an identity.
export const placeNameOf = (id) => placeOf(id)?.name || id;

function sharedNoteFor(wid, place) {
  const others = placesOfBound(wid).filter((p) => p.id !== place.id);
  return others.length ? `shared bound · also in the ${others.map((p) => p.name).join(' and the ')}` : '';
}

function renderIndex() {
  const el = $('#index');
  if (!el) return;
  if (S.lens !== 'world') { const html = experienceIndex(); if (el._html !== html) { el.innerHTML = html; el._html = html; } return; }
  const f = S.browse.focus;
  const focused = f?.kind === 'place' ? placeOf(f.id) : null;
  const place = focused || (S.sel ? placeFor(S.sel) : null);
  const selRecord = S.sel ? metadataOf(S.sel) : null;
  let html = '';
  if (f?.kind === 'records' || (selRecord && !focused)) {
    html += recordsIndex();
  } else if (place) {
    html += `<div class="ix-head"><button class="ix-title" data-act="place" data-id="${place.id}" title="Focus this place — the context changes, the selection does not">${esc(place.name)}</button><span class="ix-place">${place.ref}</span>${focused ? `<span class="ix-note">focused · context, not selection</span>` : ''}</div>`;
    html += `<div class="ix-group">Bounds and openings</div>`;
    for (const wid of place.bounds) {
      const w = W(wid);
      if (!w) continue;
      html += indexRow(w.id, w.kind === 'arc' ? 'arc' : 'wall', { note: sharedNoteFor(wid, place) });
      for (const o of w.openings) html += indexRow(o.id, 'open', { cls: 'sub' });
    }
    html += `<div class="ix-group">Ceilings</div>`;
    for (const cid of place.ceilings) { const c = C(cid); if (c) html += indexRow(c.id, c.rel === 'suspended' ? 'ceil susp' : 'ceil'); }
    html += `<div class="ix-group">On display <span class="ix-note">Scene · passive here</span></div>`;
    for (const aid of place.onDisplay) if (thing(aid)) html += indexRow(aid, 'art', { cls: 'scene' });
    for (const oid of place.located) if (thing(oid)) html += indexRow(oid, 'obj', { cls: 'scene' });
  } else {
    html += `<div class="ix-head"><span class="ix-title">${esc(ctx.museum.name)}</span><span class="ix-place">everything</span></div>`;
    for (const p of PLACES) {
      const closureId = p.ceilings.find((cid) => C(cid)?.rel === 'closure');
      const main = closureId ? C(closureId) : null;
      html += `<div class="ix-group">${esc(p.name)} <span class="ix-note">${main ? `ceiling ${fmt(main.plane.base)}` : ''}</span></div>`;
      for (const wid of p.bounds) { const w = W(wid); if (w) html += indexRow(w.id, w.kind === 'arc' ? 'arc' : 'wall', { noVerbs: true, note: sharedNoteFor(wid, p) }); }
      for (const cid of p.ceilings) { const c = C(cid); if (c) html += indexRow(c.id, 'ceil', { noVerbs: true }); }
    }
    html += `<div class="ix-group">Elsewhere</div><div class="ix-hint">Paintings, furniture and references are found by name, with a reason why they may not be in view (<kbd>/</kbd>).</div>`;
    html += `<div class="ix-row rec"><button class="ix-go" data-act="ctx" data-ctx="records" title="Show the register as context: records with no Stage location"><span class="glyph rec"></span><span class="ix-name">Records register</span><span class="ix-note">no Stage location</span></button></div>`;
  }
  if (S.sel && place) {
    const rel = relationsOf(S.sel);
    if (rel.length) html += `<div class="ix-group">Around it</div>` + rel.map((r) => `<div class="ix-rel"><span class="dot"></span>${r}</div>`).join('');
  }
  html += unresolvedRows();
  if (el._html !== html) { el.innerHTML = html; el._html = html; }
}

export function relationsOf(id) {
  const t = thing(id);
  if (!t) return [];
  const out = [];
  if (t.kind === 'openings') out.push(`opening in <button class="lnk inline" data-sel="${t.wall.id}">${esc(t.wall.name)}</button>`);
  if (t.kind === 'art') out.push(`hangs on <button class="lnk inline" data-sel="${t.item.wall}">${esc(W(t.item.wall)?.name || 'a wall')}</button>`);
  if (t.kind === 'walls') {
    const here = ctx.museum.art.filter((a) => a.wall === t.item.id);
    if (here.length) out.push(`${here.length} attached: ${here.map((a) => esc(a.name)).join(', ')}`);
    for (const c of ctx.museum.ceilings) {
      const r = lidRelations(c).find((x) => x.wall.id === t.item.id);
      if (r?.status === 'gap') out.push(`top is ${Math.round(r.gap * 100)} cm below the ${esc(c.name)}`);
      else if (r?.status === 'intended') out.push(`gap above is kept open to the ${esc(c.name)}`);
    }
  }
  if (t.kind === 'ceilings') {
    for (const r of lidRelations(t.item)) out.push(`${esc(r.wall.name)} · ${r.status === 'gap' ? `${Math.round(r.gap * 100)} cm gap` : r.status === 'intended' ? 'kept open' : 'meets'}`);
  }
  if (t.kind === 'objects') out.push('staged content · no specialist depth in this prototype');
  return out;
}

// ---------------------------------------------------------------- Browse and Search
// One bounded list, honestly labelled: the museum's own subjects, which have Stage geometry, and the
// dense metadata fixture, which does not. Query, context, page and the highlighted row are shell
// session state — they are never the selection, and nothing here moves the Camera. Each row carries
// its own verbs, so Select, Open location, Bring into view, Include, Reveal and Face stay separate
// promises: a record with no geometry says where it really lives and offers Select alone, because
// there is nothing to fly to, reveal or include.

const PAGE = 9;

// One list per museum, rebuilt only when the fixture changes: Browse cannot invent a second registry.
const recCache = { museum: null, list: [] };
export function records() {
  if (recCache.museum !== ctx.museum) { recCache.museum = ctx.museum; recCache.list = recordList(ctx.museum); }
  return recCache.list;
}

export const recordOf = (id) => metadataOf(id);

const contexts = () => [{ id: null, name: 'All places' }, ...PLACES.map((p) => ({ id: p.id, name: p.name })), { id: 'records', name: 'Records register' }];

function ctxOn(c) {
  const f = S.browse.focus;
  if (!c.id) return !f || f.kind === 'rel';
  if (c.id === 'records') return f?.kind === 'records';
  return f?.kind === 'place' && f.id === c.id;
}

// Explicit relations only: a museum subject is in a place context when that place names it, and a
// metadata record is in the register — never inferred into a gallery from the coordinates it lacks.
function inContext(r, f) {
  if (!f || f.kind === 'rel') return true;
  if (f.kind === 'records') return !r.geom;
  if (!r.geom) return false;
  // An unresolved reference is a fact about the document, not about a place: it stays listed in every
  // context, exactly as the Index shows it in every context.
  if (isUnresolved(r.id)) return true;
  return placesOfThing(r.id).some((p) => p.id === f.id);
}

const matches = (r, q) => !q || `${r.name} ${r.kind} ${r.where} ${r.ref || ''} ${r.id}`.toLowerCase().includes(q);
const queryOf = () => S.browse.q.trim().toLowerCase();

export function browseMatches() {
  const q = queryOf();
  const f = S.browse.focus;
  return records().filter((r) => inContext(r, f) && matches(r, q));
}

// What is on screen: the first (page + 1) pages. Scroll reaches the rest of a page; More pages it.
export function browseShown() {
  return browseMatches().slice(0, (S.browse.page + 1) * PAGE);
}

// D's tag vocabulary, kept: the reason a subject may not be on screen, in the same words the resolver
// returns to the Card, the Index and the beacon — one reason, three surfaces.
const WHERE_TAG = { visible: 'in view', off: 'out of frame', behind: 'hidden behind', beyond: 'beyond depth', away: 'opened away', aside: 'set aside', cut: 'cut', flat: 'laid flat', opened: 'unrolled', facing: 'facing', lifted: 'lifted', unresolved: 'unresolved' };

// A row's verbs come from the record and the reading, not from a catalogue. Nothing is offered that
// could not act on the *named* record, and a record with no geometry is never promised a flight.
function browseVerbs(r, w) {
  const t = r.geom ? thing(r.id) : null;
  const out = [`<button class="fx-v sel" data-act="sel" data-id="${r.id}" title="Select ${esc(r.name)} — the identity only: no view move, nothing opens">Select</button>`];
  if (!r.geom) return out.join('');
  // No host, no geometry verbs: the row offers the one operation that can resolve the reference, and
  // none of the verbs that would need a wall to exist first.
  if (isUnresolved(r.id)) {
    out.push(`<button class="fx-v" data-act="look-repair" data-id="${r.id}" title="Name the wall the ${esc(r.name)} belongs on — nothing is guessed">Repair</button>`);
    return out.join('');
  }
  const hostless = t && (t.kind === 'objects');
  if (t && !hostless) out.push(`<button class="fx-v" data-act="open-loc" data-id="${r.id}" title="Open the place that holds the ${esc(t.item.name)} — the specialist work, on the named record">Open location</button>`);
  if (w.state === 'off' || w.state === 'behind') out.push(`<button class="fx-v" data-act="lookat" data-id="${r.id}" title="Bring it into view from where you stand — nothing opens, the selection does not change">Bring into view</button>`);
  if (w.state === 'beyond') out.push(`<button class="fx-v" data-act="include" data-id="${r.id}" title="Reach just far enough to include it — a view setting with a number on it, not an edit">Include it · ${fmt(w.need)} m</button>`);
  if (w.state === 'beyond' || w.state === 'away') out.push(`<button class="fx-v${S.reveal === r.id ? ' on' : ''}" data-act="reveal" data-id="${r.id}" title="Show it through at its true place — the depth and the cut are untouched">${S.reveal === r.id ? 'Stop showing' : 'Show it through'}</button>`);
  if (t && (t.kind === 'walls' || t.kind === 'openings' || t.kind === 'art')) out.push(`<button class="fx-v" data-act="faceit" data-id="${r.id}" title="Face the wall that holds it — the specialist reading, on the named record">Face it</button>`);
  return out.join('');
}

function browseRow(r) {
  const w = r.geom ? whereIs(r.id) : null;
  const tag = w ? WHERE_TAG[w.state] : '';
  return `<li class="fx-row${S.sel === r.id ? ' sel' : ''}${S.browse.at === r.id ? ' on' : ''}" data-rec="${r.id}" role="option" aria-selected="${S.sel === r.id}">
    <button class="fx-go" data-act="sel" data-id="${r.id}" title="Select the ${esc(r.name)} — the identity only">
      <span class="fn">${esc(r.name)}</span><span class="fk">${esc(r.kind)}${r.ref ? ' · ' + esc(r.ref) : ''} · ${esc(r.where)}</span>
      ${tag ? `<span class="state ${w.state === 'visible' || w.state === 'cut' ? 'ok' : 'away'}">${esc(tag)}</span>` : ''}
    </button>
    <span class="fx-acts">${browseVerbs(r, w || { state: 'none' })}</span>
    ${r.geom ? '' : `<span class="fx-note">no location here — kept in the ${esc(r.where)}; Select only, nothing to fly to</span>`}
  </li>`;
}

// The reference warning belongs to the document, not to a place: it is shown whatever the Index is
// showing, so an unresolved reference is never hidden by which context happens to be focused.
function unresolvedRows() {
  const loose = ctx.museum.art.filter((a) => !W(a.wall));
  if (!loose.length) return '';
  return `<div class="ix-group">Unresolved references</div>` + loose.map((a) => `<div class="ix-row warn${S.sel === a.id ? ' sel' : ''}">
    <button class="ix-go" data-sel="${a.id}" aria-selected="${S.sel === a.id}" title="${esc(a.name)} has no wall reference — select it and Repair names the wall">
      <span class="glyph art"></span><span class="ix-name">${esc(a.name)}</span><span class="ix-note">no wall reference · Repair from its Card</span>
    </button></div>`).join('');
}

function emptyBrowse() {
  const q = S.browse.q.trim();
  const ql = queryOf();
  const f = S.browse.focus;
  const elsewhere = records().filter((r) => !inContext(r, f) && matches(r, ql)).length;
  const where = f?.kind === 'records' ? 'the register' : f?.kind === 'place' ? (placeOf(f.id)?.name || 'this place') : 'the whole museum';
  return `<li class="empty">Nothing${q ? ` matches “${esc(q)}”` : ' is listed'} in ${esc(where)}${elsewhere ? ` · ${elsewhere} match${elsewhere === 1 ? '' : 'es'} in another context` : ''}</li>`;
}

export function renderBrowse() {
  if ($('#finder').hidden) return;
  const all = browseMatches();
  const shown = all.slice(0, (S.browse.page + 1) * PAGE);
  const ctx = $('#finderCtx');
  if (ctx) {
    const html = `<span class="fx-ctx-k">Look in</span>${contexts().map((c) => `<button class="fx-chip${ctxOn(c) ? ' on' : ''}" data-act="ctx" data-ctx="${c.id ?? ''}" aria-pressed="${ctxOn(c)}">${esc(c.name)}</button>`).join('')}`;
    if (ctx._html !== html) { ctx.innerHTML = html; ctx._html = html; }
  }
  const list = $('#finderList');
  if (list) {
    const html = shown.length ? shown.map((r) => browseRow(r)).join('') : emptyBrowse();
    if (list._html !== html) { list.innerHTML = html; list._html = html; }
  }
  const more = $('#finderMore');
  if (more) {
    const html = `<span class="fx-n">${shown.length} of ${all.length}</span>`
      + (shown.length < all.length ? `<button class="fx-v" data-act="more">More results</button>` : '')
      + (S.browse.page > 0 ? `<button class="fx-v ghost" data-act="less">Back to the first ${PAGE}</button>` : '');
    if (more._html !== html) { more.innerHTML = html; more._html = html; }
  }
}

// The register as Index context: no geometry, so no Look, no badge and no camera verb — a selected
// record is still an identity, and the Index says what it is instead of where it would be.
function recordIndexRow(r) {
  return `<div class="ix-row rec${S.sel === r.id ? ' sel' : ''}">
    <button class="ix-go" data-sel="${r.id}" aria-selected="${S.sel === r.id}" title="Select the ${esc(r.name)} — a record with no Stage location">
      <span class="glyph rec"></span><span class="ix-name">${esc(r.name)}</span><span class="ix-ref">${esc(r.ref || '')}</span>
      <span class="ix-note">${esc(r.where)}</span>
    </button></div>`;
}

function recordsIndex() {
  let html = `<div class="ix-head"><span class="ix-title">Records register</span><span class="ix-place">no Stage location</span>${S.browse.focus?.kind === 'records' ? '<span class="ix-note">focused · context, not selection</span>' : ''}</div>`;
  html += `<div class="ix-hint">Sheets, files and photographs this museum keeps elsewhere. They can be selected — an identity is an identity — but there is no geometry here to open, reveal or fly to.</div>`;
  html += `<div class="ix-group">Kept elsewhere</div>`;
  for (const r of records().filter((x) => !x.geom)) html += recordIndexRow(r);
  html += `<div class="ix-row rec"><button class="ix-go" data-act="ctx" data-ctx="" title="Back to the whole museum"><span class="ix-name">Back to the museum</span></button></div>`;
  return html;
}

// ---------------------------------------------------------------- the Card
// The stable identity of the subject: ref, name, capabilities and what it is attached to,
// and — when the view cannot show it — why not and what to do about it. Nothing here depends on
// which reading happens to be open; the reading's own controls are the Instrument, below the stage.

function field(label, spec, value, opts = {}) {
  const err = S.fieldErr && S.fieldErr.key === JSON.stringify(spec) ? S.fieldErr.msg : null;
  return `<label class="pf${err ? ' bad' : ''}${opts.readonly ? ' ro' : ''}"><span class="pk">${label}</span><span class="pv"><input data-field="${J(spec)}" value="${fmt(value)}" inputmode="decimal" ${opts.readonly ? 'readonly tabindex="-1"' : ''} aria-label="${esc(label)}" aria-invalid="${err ? 'true' : 'false'}"><span class="pu">m</span></span>${opts.hint ? `<span class="ph">${opts.hint}</span>` : ''}${err ? `<span class="perr" role="alert">${esc(err)}</span>` : ''}</label>`;
}

function seg(name, spec, options, value) {
  return `<div class="pseg" role="radiogroup" aria-label="${esc(name)}">${options.map(([v, l]) => `<button role="radio" aria-checked="${v === value}" class="${v === value ? 'on' : ''}" data-seg="${J({ ...spec, value: v })}">${l}</button>`).join('')}</div>`;
}

function cardHead(kicker, title, sub) {
  return `<div class="c-head"><div class="c-k">${kicker}</div><div class="c-t">${esc(title)}</div>${sub ? `<div class="c-s">${sub}</div>` : ''}</div>`;
}

// What the subject itself offers. The verbs come from the fixture's own capabilities, so a bench
// offers nothing and a curved wall offers unrolling: no tool catalogue, and no button that cannot act.
// Spatial work, in-place measurement and work about a reference are different promises, so they are
// offered separately — an unresolved reference offers Repair, and no Look that would need a host.
function looks(id) {
  const caps = T.capabilities(id).filter((c) => c !== 'reveal');
  if (!caps.length) return '';
  const name = thing(id)?.item.name ?? '';
  const verb = (c) => `<button class="verb" data-act="look-${c}" data-id="${id}" title="${esc(T.VERB[c])} ${esc(name)}"><span class="vg ${c}"></span>${esc(T.VERB[c])}</button>`;
  const spatial = caps.filter((c) => T.SPATIAL.includes(c));
  const inPlace = caps.filter((c) => T.IN_PLACE.includes(c));
  const reference = caps.filter((c) => T.REFERENCE.includes(c));
  let html = '';
  if (reference.length) html += `<div class="c-sec">Reference</div><div class="c-acts">${reference.map(verb).join('')}<span class="c-note">the fixture leaves this unresolved — nothing is guessed</span></div>`;
  if (spatial.length) html += `<div class="c-sec">Look</div><div class="c-acts">${spatial.map(verb).join('')}</div>`;
  if (inPlace.length) html += `<div class="c-sec">In place</div><div class="c-acts">${inPlace.map(verb).join('')}<span class="c-note">no view moves, nothing opens</span></div>`;
  return html;
}

// Owner / Source / Reach, shown where the decision is actually made: which document owns the fact, where
// the value really comes from, and what changing it touches. Only supported facts — no shared-use
// counts, no source forks and no instance-only choices, because no such model exists in this prototype.
function facts(id) {
  const t = thing(id);
  if (!t) return null;
  const host = t.kind === 'art' ? W(t.item.wall) : null;
  if (t.kind === 'walls') return {
    owner: 'Layout document — the museum’s walls, and the openings they carry',
    source: 'prototype-local fixture · <b>app/model.js</b>, no production schema behind it',
    reach: 'this wall only — its top and its own openings. The ceilings that meet it keep their own planes',
  };
  if (t.kind === 'openings') return {
    owner: 'Layout document — an opening belongs to the wall that carries it',
    source: 'prototype-local fixture · <b>app/model.js</b>, no production schema behind it',
    reach: `this opening only — the ${esc(t.wall.name)} keeps its own geometry, and no other wall is touched`,
  };
  if (t.kind === 'ceilings') return {
    owner: 'Layout document — ceiling regions, their closure or suspension, and their planes',
    source: 'prototype-local fixture · <b>app/model.js</b>, no production schema behind it',
    reach: 'this region only — it overlaps its gallery and owns none of it',
  };
  if (t.kind === 'art') return {
    owner: 'Scene document — the artwork, and the wall it hangs on',
    source: host ? 'prototype-local fixture · <b>app/model.js</b> — its stored size and its wall reference' : 'prototype-local fixture · <b>app/model.js</b> — its wall reference, unresolved',
    reach: host ? `this artwork only — the ${esc(host.name)} is referenced, and never edited` : 'this artwork only — Repair writes one reference, and never the wall',
  };
  return null;
}

function factsHtml(id) {
  const f = facts(id);
  if (!f) return '';
  return `<div class="c-sec">Who owns this fact <span class="det-n">at the field, not in the abstract</span></div><div class="own">`
    + `<div class="own-row"><span class="own-k">Owner</span><span>${f.owner}</span></div>`
    + `<div class="own-row"><span class="own-k">Source</span><span>${f.source}</span></div>`
    + `<div class="own-row"><span class="own-k">Reach</span><span>${f.reach}</span></div></div>`;
}

// ----- the numbers of a subject, from one source -----
// Precision shows the numbers the work in hand is about; in-place Measure shows the subject’s
// numbers without moving Camera. Both read this, so a value can
// never disagree with itself, and every field keeps the one validated edit path.

function numbersOf(id) {
  const t = thing(id);
  if (!t) return [];
  if (t.kind === 'openings') {
    const o = t.item;
    const w = t.wall;
    return [
      { sec: 'Shape', items: [
        { seg: ['Profile', { type: 'profile', id: o.id }, [['rect', 'Square'], ['round', 'Round'], ['pointed', 'Pointed']], o.profile] },
        { field: ['Width', { type: 'op', id: o.id, key: 'w' }, o.w, { hint: w.kind === 'arc' ? 'measured along the curve' : '' }] },
        { field: ['Centre along wall', { type: 'op', id: o.id, key: 's' }, o.s, { hint: w.closed ? 'from the seam, going round' : 'from the wall’s start' }] },
      ] },
      { sec: 'Vertical', items: [
        { field: ['Sill', { type: 'op', id: o.id, key: 'sill' }, o.sill] },
        { field: ['Head', { type: 'op', id: o.id, key: 'head' }, o.head, { hint: `overall top · world ${fmt(o.head + FLOOR_Y)}` }] },
        ...(o.profile !== 'rect' ? [{ field: ['Arch rise', { type: 'op', id: o.id, key: 'rise' }, o.rise, { hint: `head stays put; the spring line moves (now ${fmt(springOf(o))})` }] }] : []),
        { field: ['Clear height', { type: 'ro' }, Math.round((o.head - o.sill) * 1000) / 1000, { readonly: true, hint: 'read-out: head minus sill' }] },
      ] },
    ];
  }
  if (t.kind === 'walls') {
    const w = t.item;
    const p = w.top;
    const L = wallLength(w);
    const items = [
      { seg: ['Top form', { type: 'form', wall: w.id }, [['constant', 'Level'], ['slope', 'Slope'], ['gable', 'Gable']], p.form] },
    ];
    if (p.form === 'constant') items.push({ field: ['Height', { type: 'top', wall: w.id, key: 'h' }, p.h, { hint: `top at world ${fmt(p.h + FLOOR_Y)}` }] });
    else if (p.form === 'slope') {
      items.push({ field: ['At start', { type: 'top', wall: w.id, key: 'h0' }, p.h0] });
      items.push({ field: ['At end', { type: 'top', wall: w.id, key: 'h1' }, p.h1] });
    } else {
      items.push({ field: [w.closed ? 'At the low point' : 'At start', { type: 'top', wall: w.id, key: 'h0' }, p.h0] });
      items.push({ field: ['Ridge height', { type: 'top', wall: w.id, key: 'rh' }, p.rh] });
      items.push({ field: ['Ridge along wall', { type: 'top', wall: w.id, key: 'rs' }, p.rs, { hint: 'distance along the wall from its start' }] });
      if (!w.closed) items.push({ field: ['At end', { type: 'top', wall: w.id, key: 'h1' }, p.h1] });
    }
    return [
      { sec: 'Top', items },
      { sec: 'Measured', items: [
        { field: [`Length${w.kind === 'arc' ? ' along the curve' : ''}`, { type: 'ro' }, Math.round(L * 1000) / 1000, { readonly: true, hint: w.kind === 'arc' ? 'measured with the wall as built' : '' }] },
        { field: ['Thickness', { type: 'ro' }, w.thick, { readonly: true }] },
      ] },
    ];
  }
  if (t.kind === 'ceilings') {
    const c = t.item;
    const items = [
      { seg: ['Form', { type: 'cform', id: c.id }, [['flat', 'Flat'], ['shed', 'Sloped']], c.form] },
      { field: ['Height', { type: 'ceil', id: c.id, key: 'base' }, fieldValue({ type: 'ceil', id: c.id, key: 'base' }), { hint: c.form === 'shed' ? 'at the west end of the gallery' : `world ${fmt(c.plane.base + FLOOR_Y)}` }] },
    ];
    if (c.form === 'shed') items.push({ field: ['Rise per metre', { type: 'ceil', id: c.id, key: 'gx' }, c.plane.gx, { hint: 'toward the east' }] });
    return [
      { sec: 'Underside', items: [{ seg: ['Relationship', { type: 'rel', id: c.id }, [['closure', 'Closes the room'], ['suspended', 'Suspended']], c.rel] }, ...items] },
      { sec: 'Measured', items: [
        { field: ['Thickness', { type: 'ro' }, c.thick, { readonly: true }] },
        { field: ['Width', { type: 'ro' }, Math.round((bbox(c.outline).x1 - bbox(c.outline).x0) * 1000) / 1000, { readonly: true }] },
        { field: ['Depth', { type: 'ro' }, Math.round((bbox(c.outline).z1 - bbox(c.outline).z0) * 1000) / 1000, { readonly: true }] },
      ] },
    ];
  }
  if (t.kind === 'art' && typeof t.item.w === 'number') {
    const w = W(t.item.wall);
    // With no host there is no station to report: the panel's own size is real, where it hangs is not.
    return [{ sec: 'Measured', items: [
      { field: ['Width', { type: 'ro' }, t.item.w, { readonly: true }] },
      { field: ['Height', { type: 'ro' }, t.item.h, { readonly: true }] },
      ...(w ? [{ field: ['Hangs at', { type: 'ro' }, t.item.s, { readonly: true, hint: `along the ${w.name}` }] }] : []),
    ] }];
  }
  return [];
}

// Details: what it is attached to, named as a relation with its own target — and, once expanded, each
// relation's own verbs. Expand changes disclosure only; Select changes the canonical identity; Focus
// sets the local point the next work will be about (never the selection); the task verbs invoke
// specialist work on the *named target*, not on whatever happens to be selected.
function details(id) {
  const rows = detailRows(id);
  if (!rows.length) return '';
  const open = !!S.expand;
  const head = `<div class="c-sec">Details <span class="det-n">${rows.length} relation${rows.length === 1 ? '' : 's'}</span><button class="c-toggle" data-act="expand" aria-expanded="${open}">${open ? 'Collapse' : 'Expand'}</button></div>`;
  if (!open) return head + `<div class="c-hint">Expand to name each relation and act on it directly.</div>`;
  return head + `<ul class="rels">${rows.map((r) => `<li class="rel-row"><span class="dot"></span><span class="rel-what">${esc(r.label)} <b>${esc(r.name)}</b></span><span class="rel-acts">${r.acts.map((a) => `<button class="c-v" data-act="${a.act}" data-id="${a.id}"${a.focus ? ` data-focus="${a.focus}"` : ''} title="${esc(a.title)} · ${esc(r.name)}">${esc(a.label)}</button>`).join('')}</span></li>`).join('')}</ul>`;
}

function detailRows(id) {
  const t = thing(id);
  if (!t) return [];
  const sel = (target) => ({ act: 'sel', id: target, label: 'Select', title: `Select ${labelOf(target)}` });
  const face = (target) => ({ act: 'look-face', id: target, label: 'Look', title: `Face ${labelOf(target)}` });
  const focusTop = (wall) => ({ act: 'focus', id: wall, focus: 'wall-top', label: 'Focus top', title: `Focus the ${labelOf(wall)} top for the next work — the selection does not change` });
  const repair = (target) => ({ act: 'look-repair', id: target, label: 'Repair', title: `Name the wall the ${labelOf(target)} belongs on — nothing is guessed` });
  const out = [];
  if (t.kind === 'openings') out.push({ label: 'Host', name: t.wall.name, acts: [sel(t.wall.id), face(t.wall.id), focusTop(t.wall.id)] });
  if (t.kind === 'art') {
    const w = W(t.item.wall);
    // The relation is named as it really is. Unresolved, it offers the one operation that can resolve it
    // — Repair — and none of the verbs that would need a host to exist first.
    if (w) out.push({ label: 'Hangs on', name: w.name, acts: [sel(w.id), face(w.id), focusTop(w.id)] });
    else out.push({ label: 'Wall reference', name: 'unresolved', acts: [repair(t.item.id)] });
  }
  if (t.kind === 'walls') {
    for (const a of ctx.museum.art.filter((x) => x.wall === t.item.id)) out.push({ label: 'Attached here', name: a.name, acts: [sel(a.id), face(a.id)] });
    for (const c of ctx.museum.ceilings) {
      const r = lidRelations(c).find((x) => x.wall.id === t.item.id);
      if (!r) continue;
      const status = r.status === 'gap' ? `${Math.round(r.gap * 100)} cm gap` : r.status === 'intended' ? 'kept open' : 'meets';
      out.push({ label: 'Ceiling', name: `${c.name} · ${status}`, acts: [sel(c.id), { act: 'look-lift', id: c.id, label: 'Lift', title: `Lift the ${c.name}` }] });
    }
    out.push({ label: 'Top', name: `${t.item.name} top`, acts: [focusTop(t.item.id), ...(t.item.kind === 'arc' ? [{ act: 'look-unroll', id: t.item.id, label: 'Unroll', title: `Unroll the ${t.item.name}` }] : [])] });
  }
  if (t.kind === 'ceilings') {
    for (const r of lidRelations(t.item)) out.push({ label: 'Meets', name: `${r.wall.name} · ${r.status === 'gap' ? `${Math.round(r.gap * 100)} cm gap` : r.status === 'intended' ? 'kept open' : 'meets'}`, acts: [sel(r.wall.id), face(r.wall.id), focusTop(r.wall.id)] });
  }
  return out;
}

// Where is it, and what can you do about it — the same resolver Search and the beacon read.
// Combines "why can't I see it" with recovery: include it, show it through, go to its host.
function where(id) {
  const r = whereIs(id);
  const t = thing(id);
  const s = S.session;
  const act = (a, label, primary, target) => `<button class="w-act${primary ? ' primary' : ''}" data-act="${a}"${target ? ` data-id="${target}"` : ''}>${label}</button>`;
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
  // An unresolved reference is not a view problem: there is nothing to look at, fly to or reveal. The
  // reason is stated, and the one real operation is offered on the record it belongs to.
  if (r.state === 'unresolved') return block('quiet', `<b>Unresolved reference</b> — no wall is named for it in the source, so nothing here is a host: the marker on the drawing is where it was last seen, not where it hangs. It keeps its own size; only its wall is missing.`, [act('look-repair', 'Repair', true, id)]);
  if (r.state === 'aside') return block('quiet', `Set aside while you face the ${esc(s.wall.name)}.`, t.kind === 'walls' || t.kind === 'openings' || t.kind === 'art' ? [act('faceit', 'Face it instead')] : []);
  if (r.state === 'off') return block('quiet', `Out of frame — ${esc(r.reason)}.`, [act('lookat', 'Bring it into view', true)]);
  if (r.state === 'behind') return block('quiet', `Hidden ${esc(r.reason)}.`, [act('lookat', 'Look at it', true), ...(t.kind !== 'objects' && t.kind !== 'ceilings' ? [act('faceit', 'Face it')] : [])]);
  if (r.state === 'flat') return block('moved', 'Laid flat for this view — the dashed ring is where it stands. Folds back when you leave.');
  if (r.state === 'opened') return block('moved', `Unrolled to ${Math.round(360 * (1 - s.u))}° for this view. It never stretches, so every number is measured along the real wall.`);
  if (r.state === 'lifted') return block('moved', 'Lifted 2.60 for this view — the dashed outline is where it really is.');
  if (r.state === 'cut') return `<div class="where"><span class="dot ok"></span><span>The line passes through it.</span></div>`;
  return '';
}

function renderCard() {
  const el = $('#card');
  if (!el) return;
  const id = S.sel;
  const t = thing(id);
  const rec = id ? metadataOf(id) : null;
  let html = '';
  if (S.lens !== 'world') html = experienceCard() + parkedBlock();
  else {
    if (rec) html = cardRecord(rec);
    // An identity from another lens is not a World subject, and the World says so instead of showing the
    // empty state: the selection is real, and what can be done with it is the bridge's own act.
    else if (!t && id) html = foreignExperienceCard();
    else if (!t) html = emptyCard();
    else if (t.kind === 'walls') html = cardWall(t.item);
    else if (t.kind === 'openings') html = cardOpening(t.item, t.wall);
    else if (t.kind === 'ceilings') html = cardCeiling(t.item);
    else html = cardScene(t);
    // Above the identity: the parked work belongs to the session, not to the subject, and it must never
    // be the thing you have to scroll a long Card to find.
    html = parkedBlock() + html;
  }
  if (el._html !== html) {
    const focused = document.activeElement?.dataset?.field;
    el.innerHTML = html;
    el._html = html;
    if (focused) el.querySelector(`[data-field='${focused}']`)?.focus?.();
  }
}

function emptyCard() {
  return `<div class="c-empty"><div class="c-k">Nothing selected</div>
  <p>Select a wall, an opening or a ceiling — on the paper or in the Index. The selection is the identity you keep; the work you invoke from it comes and goes.</p>
  <div class="c-sec">Ways to look</div>
  <div class="c-acts">
    <button class="verb" data-act="knife"><span class="vg cut"></span>Open along a line<kbd>K</kbd></button>
    <button class="verb" data-act="plan"><span class="vg plan"></span>Plan<kbd>1</kbd></button>
    <button class="verb" data-act="3d"><span class="vg three"></span>3D<kbd>2</kbd></button>
  </div></div>`;
}

function cardWall(w) {
  const L = wallLength(w);
  let html = cardHead(`${w.kind === 'arc' ? 'Curved wall' : 'Wall'} · ${w.ref}`, w.name, `${esc(byId(ctx.museum.galleries, w.gallery).name)} · ${fmt(L)} m${w.kind === 'arc' ? ' around' : ''} · ${fmt(w.thick)} thick`);
  html += where(w.id);
  html += looks(w.id);
  const rel = wallCeilingNote(w);
  if (rel) html += rel;
  if (w.openings.length) {
    html += `<div class="c-sec">Openings</div><div class="chips">${w.openings.map((o) => `<button class="chip-btn" data-sel="${o.id}">${esc(o.name)}</button>`).join('')}</div>`;
  }
  html += details(w.id);
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

function cardOpening(o, w) {
  let html = cardHead(`${o.kind === 'door' ? 'Door' : 'Window'} · ${o.ref}`, o.name, `in <button class="lnk inline" data-sel="${w.id}">${esc(w.name)}</button> · ${w.ref}`);
  html += where(o.id);
  html += looks(o.id);
  html += details(o.id);
  return html;
}

function cardCeiling(c) {
  let html = cardHead(`Ceiling region · ${c.ref}`, c.name, `${c.rel === 'closure' ? 'closes the room over its footprint' : 'hangs below the room ceiling'} · ${esc(byId(ctx.museum.galleries, c.gallery).name)} (overlaps, does not own)`);
  html += where(c.id);
  html += looks(c.id);
  html += details(c.id);
  return html;
}

function cardScene(t) {
  const it = t.item;
  let html = cardHead(`${t.kind === 'art' ? 'Artwork' : 'Object'} · Scene`, it.name, it.by ? esc(it.by) : '');
  html += where(it.id);
  html += looks(it.id);
  html += `<div class="relation quiet"><span class="dot"></span><span>Staged content lives in the Scene document. Here it is passive context — edit it in <b>Arrange</b>.</span></div>`;
  html += details(it.id);
  return html;
}

// A record with no Stage geometry is not an empty Card: it is an identity with a home outside the
// model, and it says where that is. No verb here offers to fly to, reveal or include it.
function cardRecord(r) {
  let html = cardHead(`Record · ${r.ref || 'registry'}`, r.name, esc(r.kind));
  html += `<div class="where quiet"><span class="dot"></span><div><span>No Stage location — this one is kept in the <b>${esc(r.where)}</b>. Selected, it stays an identity: nothing opens, no view moves, and there is no geometry to reveal or include.</span></div></div>`;
  html += `<div class="c-sec">Listing</div><div class="c-foot">${esc(r.where)} · prototype registry, not a document store</div>`;
  return html;
}

// ---------------------------------------------------------------- the Instrument
// The work in hand, and nothing else: the reading's path, what it is, the controls that belong to it,
// and the way back. Hidden the moment no work is invoked, so the stage owns the screen at rest.

function shortLabel(r) {
  if (r.kind === 'section') return 'Section';
  if (r.kind === 'lift') return 'Lifted';
  if (r.kind === 'lookup') return 'Looking up';
  if (r.kind === 'face') return r.label.replace(/^Facing /, '');
  return r.label;
}

function depthCtl(d) {
  return `<span class="st-depth" title="How far in to include. A view setting, not an edit.">depth<button data-act="depth-" aria-label="Less depth">−</button><b data-drag="depth">${fmt(d)}</b><span class="u">m</span><button data-act="depth+" aria-label="More depth">+</button></span>`;
}

function sectionCounts() {
  const out = { beyond: 0, away: 0, beyondNames: [] };
  const ids = [...ctx.museum.walls.map((w) => w.id), ...ctx.museum.art.map((a) => a.id), ...ctx.museum.objects.map((o) => o.id)];
  for (const id of ids) {
    const m = memberOf(id);
    if (m.state === 'beyond') { out.beyond++; out.beyondNames.push(thing(id).item.name); }
    if (m.state === 'away') out.away++;
  }
  return out;
}

// The numbers the work in hand is about: the reading's local focus, or the subject of an in-place
// measurement. Only invoked work discloses technical numbers.
function precisionGroups() {
  const t = S.task;
  if (!t) return [];
  if (t.kind === 'dims') return numbersOf(t.subject);
  // The declared candidate: values the editor is naming here, not values the source already has. They go
  // through the same cast as every other number, and the fixture's own validation still decides.
  if (t.kind === 'repair') return [{ sec: 'Declared candidate', items: [
    { field: ['Station along the wall', { type: 'repair', key: 's' }, t.params.s, { hint: 'from the wall’s own start — declared here, written only on accept' }] },
    { field: ['Centre height', { type: 'repair', key: 'y' }, t.params.y, { hint: 'the panel’s centre above the floor' }] },
  ] }];
  const s = S.session;
  if (!s) return [];
  if (s.kind === 'face' && s.opening) return numbersOf(s.opening);
  if (s.kind === 'face') return numbersOf(s.wallId).slice(0, 1);
  if (s.kind === 'lift' || s.kind === 'lookup') return numbersOf(s.ceilId).slice(0, 1);
  return [];
}

function precisionHtml() {
  const groups = precisionGroups();
  if (!groups.length) return '';
  const groupsRendered = groups.map((g) => g.items.map((it) => (it.seg ? seg(...it.seg) : field(...it.field))).join('')).join('');
  const factId = ['dims','repair'].includes(S.task.kind) ? S.task.subject : S.task.focus?.id;
  return `<div class="st-prec" id="precision"><span class="st-prec-label">Precision</span>${groupsRendered}<span class="st-meta">${esc(S.task.focus?.label || '')}</span></div><details class="st-facts"><summary>Owner · Source · Reach</summary>${factsHtml(factId)}</details>`;
}

function renderInstrument() {
  const el = $('#instrument');
  if (!el) return;
  const s = S.session;
  const k = S.knife;
  // Where the keyboard was, if it was in here: the Instrument is rebuilt as the work changes, and a
  // control that is still offered afterwards must not have been dropped out from under a keyboard user.
  const was = document.activeElement && el.contains(document.activeElement) ? document.activeElement : null;
  const handoff = () => { if (was) document.querySelector('#gl')?.focus?.(); };
  const restore = () => {
    if (!was) return;
    // A rebuilt row gives the keyboard back to the same control: the same verb where it is still
    // offered, and the same field where it is still there, so a numeric writer keeps its caret across
    // the commit it just made. A control that is genuinely gone hands focus to the drawing.
    const sel = was.dataset.act
      ? `[data-act="${was.dataset.act}"]${was.dataset.id ? `[data-id="${was.dataset.id}"]` : ''}`
      : null;
    const next = sel
      ? el.querySelector(sel)
      : was.dataset.field
        ? [...el.querySelectorAll('input[data-field]')].find((i) => i.dataset.field === was.dataset.field)
        : null;
    if (next) next.focus(); else document.querySelector('#gl')?.focus?.();
  };
  // No World work stands in the bridge: the work in hand is parked and inactive, so the Instrument is
  // absent from the DOM, not a hidden remnant of another lens' presentation.
  if (S.lens !== 'world') { handoff(); el.hidden = true; el._html = ''; el.innerHTML = ''; el.classList.remove('prec'); return; }
  const d = T.describe();
  // No work, no Instrument: the row is dropped from the DOM as well as hidden, so no stale control
  // (the numbers row, a crumb) can be found or reached once the work it belonged to is gone.
  if (!s && !k && !S.task) { handoff(); el.hidden = true; el._html = ''; el.innerHTML = ''; el.classList.remove('prec'); return; }
  el.hidden = false;
  let html = '';
  if (k) {
    const cut = knifeCut();
    html = `<span class="st-kind">Open along a line</span>`;
    if (!cut) html += `<span class="st-meta">Press and drag across the museum in Plan or 3D. Nothing opens until you say so.</span>`;
    else html += `<span class="st-title">${esc(lookWord(cut))}</span>${depthCtl(cut.depth)}<button class="st-btn" data-act="knife-flip">Look the other way <kbd>Tab</kbd></button><button class="st-btn primary" data-act="knife-open">Open it <kbd>↵</kbd></button>`;
    html += `<button class="st-btn ghost" data-act="knife-cancel">Cancel <kbd>Esc</kbd></button>`;
  } else if (S.task?.kind === 'repair') {
    // The reference work: the wall is chosen explicitly and the station and height are declared —
    // nothing is inferred from the marker or from proximity. Accept writes one validated edit; leaving
    // unresolved writes nothing, and no verb here acts on any other subject.
    const p = S.task.params;
    const w = W(p.wall);
    html = `<span class="st-kind">Unresolved reference</span><span class="st-title">${esc(d ? d.title : 'Repair')}</span>`;
    html += `<span class="st-meta">${w ? `candidate · ${esc(w.name)} · station ${fmt(p.s)} · centre ${fmt(p.y)}` : 'pick the wall it belongs on — it is never inferred'}</span>`;
    html += `<span class="st-seg rel" role="group" aria-label="Compatible walls">${ctx.museum.walls.map((x) => `<button class="${x.id === p.wall ? 'on' : ''}" data-act="repair-pick" data-id="${x.id}" aria-pressed="${x.id === p.wall}">${esc(x.name.replace(/ wall$/, ''))}</button>`).join('')}</span>`;
    if (w) html += `<button class="st-btn primary" data-act="repair-accept" title="Validate against the fixture and write one edit — one Undo entry">Accept <kbd>↵</kbd></button>`;
    html += `<button class="st-btn close" data-act="repair-leave" title="Leave the reference exactly as the fixture has it">Leave unresolved <kbd>Esc</kbd></button>`;
  } else if (!s || (S.task && S.task.kind !== s.kind)) {
    // Work in hand that is not the reading's own surface: in-place measurement, and later a repair.
    // One active task surface — the reading itself is untouched underneath and comes back with it.
    html = `<span class="st-kind">${d?.kind === 'dims' ? 'Measured' : 'In hand'}</span><span class="st-title">${esc(d ? d.title : 'Work')}</span>`;
    html += `<span class="st-meta">${d?.kind === 'dims' ? 'in place · nothing opened, nothing moved' : `on ${esc(d?.subjectName || d?.subject || '')}`}</span>`;
    html += `<button class="st-btn close" data-act="close">Close <kbd>Esc</kbd></button>`;
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
    if (d?.focusLabel) html += `<span class="st-focus">at <b>${esc(d.focusLabel)}</b></span>`;
    html += `<button class="st-btn ${S.task?.precision ? 'on' : ''}" data-act="precision" aria-pressed="${!!S.task?.precision}" title="Precision: reach the numbers of this work without a pointer (P)">Precision <kbd>P</kbd></button>`;
    html += s.parent
      ? `<button class="st-btn close" data-act="close" title="Back to ${esc(shortLabel(s.parent))}, exactly as you left it">Back <kbd>Esc</kbd></button>`
      : `<button class="st-btn close" data-act="close" title="Put everything back and return to ${esc(s.origin.label)}">Put it back <kbd>Esc</kbd></button>`;
  }
  // One row always, and the numbers when the work in hand is the numbers (in-place measurement) or
  // when Precision has been asked for. Never the whole subject: only what this work is about.
  const showNumbers = !!S.task && (S.task.kind === 'dims' || S.task.kind === 'repair' || !!S.task.precision);
  const prec = showNumbers ? precisionHtml() : '';
  const body = `<div class="st-row">${html}</div>${prec}`;
  el.classList.toggle('prec', !!prec);
  if (el._html !== body) { el.innerHTML = body; el._html = body; restore(); }
}

// per-frame: the curvature readout follows the wall without re-rendering the instrument
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

// ---------------------------------------------------------------- status rail
// What just happened, where the view has been, and the two settings that are not building changes:
// drafting paper on the wall you are working on, and whether a move is watched at all.

function renderStatus() {
  const st = S.status;
  const el = $('#statusText');
  const fresh = st && performance.now() - st.t < 6000;
  el.className = `status-text ${fresh ? st.kind : ''}`;
  el.innerHTML = fresh ? esc(st.text) : hintFor();
  // The rail is the shell's polite voice; a refusal is announced assertively, because it is the answer
  // to something the editor just asked for and it names what did not happen.
  const ann = $('#announcer');
  if (ann) {
    const say = fresh && st.kind === 'refuse' ? st.text : '';
    if (ann._say !== say) { ann._say = say; ann.textContent = say; }
  }
  let html = '';
  S.trail.forEach((e, i) => {
    html += `${i ? '<span class="tr-sep">›</span>' : ''}<button class="tr-stop${i === S.trailPos ? ' on' : ''}" data-trail="${i}" title="Go back to this standpoint (view only)">${esc(e.label)}</button>`;
  });
  const tr = $('#trail');
  if (tr._html !== html) { tr.innerHTML = html; tr._html = html; tr.scrollLeft = tr.scrollWidth; }
  document.querySelectorAll('#motion button').forEach((b) => b.classList.toggle('on', b.dataset.motion === S.motion));
  renderMotion();
  renderDrafting();
}

function hintFor() {
  const s = S.session;
  if (S.knife) return '<kbd>Drag</kbd> draw the line · <kbd>Tab</kbd> look the other way · <kbd>↵</kbd> open';
  const esc2 = s?.parent ? '<kbd>Esc</kbd> back one · <kbd>⇧Esc</kbd> put everything back' : '<kbd>Esc</kbd> put it back';
  if (!s) return viewKind() === 'plan'
    ? '<kbd>Drag</kbd> pan or a handle · <kbd>⌥ Drag</kbd> tilt into 3D · <kbd>/</kbd> search · <kbd>K</kbd> open along a line'
    : '<kbd>Drag</kbd> orbit · <kbd>⇧ Drag</kbd> pan · <kbd>/</kbd> search · pull a curved wall’s corner to unroll it';
  if (s.kind === 'face') return `<kbd>Drag</kbd> a handle · click a number to type · <kbd>S</kbd> square up · ${esc2}`;
  if (s.kind === 'section') return `Drag the cut on the locator to slide it · heads and sills edit at the cut · ${esc2}`;
  if (s.kind === 'lift') return `Click a coral gap to fix it · <kbd>U</kbd> look up · ${esc2}`;
  return `Click an underside height to type it · <kbd>M</kbd> mirror · ${esc2}`;
}

// Wall grid: is the wall you are working on drawn as drafting paper, or as the surface you are
// editing? On, the wall reads as a layout drawing; off, it keeps its own material so an editor can
// judge the thing itself. The displaced-wall cue does not depend on it (the dashed footprint and
// the instrument's “view only” stay either way).
function renderDrafting() {
  const b = $('#draftBtn');
  if (!b) return;
  const on = S.wallDrafting !== false;
  b.classList.toggle('on', on);
  b.setAttribute('aria-pressed', String(on));
  b.title = on
    ? 'Wall grid on: drafting paper with a 1 m / 5 m grid on the wall you are working on. Turn it off to see the wall’s real material (G).'
    : 'Wall grid off: walls show their real material. Turn it on to read the layout on drafting paper (G).';
}

// The Motion control answers one question — should anything travel on screen? Esc and “Put it
// back” are how you return; this is only about whether the move is watched.
function renderMotion() {
  const b = $('#motionBtn');
  if (!b) return;
  // The control is the editor's own choice; the machine's preference is followed separately, and when
  // it is in force the button says so rather than pretending nothing changed.
  const on = !!S.reduceMotion;
  const os = !S.reduceMotion && (!!S.osReduced || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
  b.classList.toggle('on', on || os);
  b.setAttribute('aria-pressed', String(on));
  b.title = on || os
    ? `Reduce motion is in force${on ? '' : ' from the system setting'}: every view move is an instant change. The speeds stay in Motion.`
    : 'Reduce motion: every view move becomes an instant change — the same as the system reduced-motion setting. The speeds stay in Motion.';
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

// ---------------------------------------------------------------- where you are

const MB = { x0: -16, x1: 12, z0: -6.4, z1: 6.4 };
const MW = 196, MH = (MW * (MB.z1 - MB.z0)) / (MB.x1 - MB.x0);
export const mapPt = (x, z) => [((x - MB.x0) / (MB.x1 - MB.x0)) * MW, ((z - MB.z0) / (MB.z1 - MB.z0)) * MH];
export const mapInv = (px, py) => [MB.x0 + (px / MW) * (MB.x1 - MB.x0), MB.z0 + (py / MH) * (MB.z1 - MB.z0)];
const pts = (list) => list.map(([x, z]) => mapPt(x, z).map((v) => v.toFixed(1)).join(',')).join(' ');

function renderWhereStatic() {
  const svg = $('#whereSvg');
  if (!svg || svg._built) return;
  svg._built = true;
  svg.setAttribute('viewBox', `0 0 ${MW} ${MH.toFixed(1)}`);
  let html = '';
  for (const f of ctx.museum.floors) html += `<polygon class="wm-room" points="${pts(f.outline)}"/>`;
  html += `<g id="wmDyn"></g>`;
  svg.innerHTML = html;
}

export function updateWhere() {
  const box = $('#where');
  if (!box) return;
  // The plan locator is World furniture: it belongs to reading the museum, so it does not stand in the
  // bridge, where no World reading is open.
  if (S.lens !== 'world') { box.hidden = true; return; }
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
    dyn += `<polygon class="wm-cone" points="${ex},${ey} ${cx},${cy}"/><line class="wm-view" x1="${ex}" y1="${ey}" x2="${cx}" y2="${cy}"/><circle class="wm-eye" cx="${ex}" cy="${ey}" r="3"/>`;
    if (!caption) caption = 'Your standpoint';
  }
  const g = document.getElementById('wmDyn');
  if (g && g._html !== dyn) { g.innerHTML = dyn; g._html = dyn; }
  const cap = $('#whereCap');
  if (cap && cap.textContent !== caption) cap.textContent = caption;
}

// ---------------------------------------------------------------- the bridge lens, and parked work
// The Experience lens is one read-only continuity fixture, and the shell says so where it is used: what
// it is, what it references, and what it deliberately does not do. It shares this selection slot and
// this Camera with the World; the World's own work is parked meanwhile, and Resume is offered in the
// World lens on the identity it belongs to — never restored by switching back.

function renderBridgeIndex(el) {
  const p = PRESENTATION;
  let html = `<div class="ix-head"><span class="ix-title">${esc(p.name)}</span><span class="ix-place">${esc(p.ref)}</span><span class="ix-note">${esc(p.note)}</span></div>`;
  html += `<div class="ix-group">Presentations <span class="ix-note">one fixture</span></div>`;
  html += `<div class="ix-row${S.sel === p.id ? ' sel' : ''}"><button class="ix-go" data-act="pres-sel" data-id="${p.id}" aria-selected="${S.sel === p.id}"><span class="glyph pres"></span><span class="ix-name">${esc(p.name)}</span><span class="ix-ref">${esc(p.ref)}</span></button>${S.sel === p.id ? '<span class="state quiet">selected</span>' : ''}</div>`;
  html += `<div class="ix-group">Referenced <span class="ix-note">World subjects</span></div>`;
  for (const s of p.slots) {
    const t = thing(s.ref);
    html += `<div class="ix-row sub${S.sel === s.ref ? ' sel' : ''}"><button class="ix-go" data-act="pres-ref" data-id="${s.ref}" aria-selected="${S.sel === s.ref}"><span class="glyph open"></span><span class="ix-name">${esc(t?.item.name || s.label)}</span><span class="ix-ref">${esc(t ? refOf(s.ref) : s.ref)}</span></button><button class="ix-verb" data-act="pres-ref" data-id="${s.ref}" title="Select the referenced window — the same identity the World lens uses">Select</button></div>`;
  }
  html += `<div class="ix-hint">This lens is a continuity fixture for the World Authoring Prototype. It reads the same selection and the same Camera, and it does not yet create presentations, guide, capture, author a Camera View or preview a visitor — those belong to #113.</div>`;
  if (el._html !== html) { el.innerHTML = html; el._html = html; }
}

function cardBridge(id, t, rec) {
  const p = presentationOf(id);
  if (p) return cardPresentation(p);
  if (t || rec) return cardForeign(id, t, rec);
  return `<div class="c-empty"><div class="c-k">The Experience lens</div>
  <p>One read-only continuity fixture sits here: <b>${esc(PRESENTATION.name)}</b>, referencing the ${esc(thing(PRESENTATION.slots[0].ref)?.item.name || PRESENTATION.slots[0].label)}.</p>
  <div class="c-acts"><button class="verb" data-act="pres-sel" data-id="${PRESENTATION.id}"><span class="vg pres"></span>Select Presentation</button></div>
  <p class="c-hint">The World's work is parked while this lens is in hand. It is inactive — nothing is open, nothing is drawn, and no Camera is remembered.</p></div>`;
}

function cardPresentation(p) {
  let html = cardHead('Experience · continuity fixture', p.name, `${p.ref} · ${p.note}`);
  html += `<div class="c-sec">Referenced</div>`;
  for (const s of p.slots) {
    const t = thing(s.ref);
    html += `<div class="relation quiet"><span class="dot"></span><span><b>${esc(t?.item.name || s.label)}</b> — a World subject, by identity. This lens reads it and never edits it.</span><button class="lnk" data-act="pres-ref" data-id="${s.ref}">Select referenced window</button></div>`;
  }
  html += `<div class="c-sec">What this lens can do</div><div class="c-acts"><button class="verb" data-act="pres-sel" data-id="${p.id}"><span class="vg pres"></span>Select Presentation</button></div>`;
  html += `<div class="c-hint">Ordinary Camera input is the same Camera: orbit, zoom, Plan and 3D all still work on the museum. There is no ${p.absent.slice(0, -1).map((s) => s.toLowerCase()).join(', no ')} and no ${p.absent.slice(-1)[0].toLowerCase()} in this prototype.</div>`;
  html += parkedBlock();
  return html;
}

// The World lens, holding an identity that belongs to the bridge. It is not a subject here and it is not
// nothing: the Card names it, and the one act that makes sense is the explicit selection of a World
// subject. A parked record about it is never resumed from a foreign identity.
function legacyForeignCard(id) {
  const p = presentationOf(id);
  const name = p ? p.name : 'Another lens’ subject';
  const sub = p ? `${p.ref} · ${p.note}` : 'selected outside the World lens';
  return cardHead('Foreign identity · not a World subject', name, sub)
    + `<div class="relation quiet"><span class="dot"></span><span>It was selected in the Experience lens. The World edits nothing about it: select a wall, an opening, a ceiling or an artwork to work on the building.</span></div>`;
}

function cardForeign(id, t, rec) {
  const name = t ? t.item.name : rec.name;
  const ref = t ? refOf(id) : `${rec.ref || ''} record · no Stage location`;
  let html = cardHead('From the World lens · read-only here', name, ref);
  html += `<div class="c-sec">In this lens</div>`;
  html += `<div class="relation quiet"><span class="dot"></span><span>It is the World's subject, not the bridge's: selecting it here is the same identity the World lens uses. Nothing in this lens edits it or opens a reading about it.</span></div>`;
  html += `<div class="c-acts"><button class="verb" data-act="pres-sel" data-id="${PRESENTATION.id}"><span class="vg pres"></span>Select Presentation</button></div>`;
  return html;
}

// Parked work, offered where it belongs: on its own identity, with the reason when it cannot be used.
// Nothing here is a hidden session, and nothing is restored by the lens toggle itself.
function parkedBlock() {
  const p = S.parked;
  if (!p) return '';
  const v = parkedContext();
  const kinds = { face: 'a reading', section: 'a section', lift: 'a lift', lookup: 'a look-up', dims: 'measurements', repair: 'a repair' };
  const what = `${p.name ? `the ${p.name}` : 'a location'} · ${p.chain.map((c) => kinds[c.kind] || c.kind).join(' + ')}`;
  // In the bridge the record is still valid, but Resume is World work: it is named where it will be
  // offered rather than as a button that could not act here.
  if (v.wrongLens) return `<div class="relation parked quiet"><span class="dot"></span><span><b>Parked</b> — ${esc(what)}. Inactive, and waiting in the World lens, where Resume is offered on its own identity.</span></div>`;
  if (v.ok) {
    return `<div class="relation parked"><span class="dot"></span><span><b>Parked</b> — ${esc(what)}. Inactive: nothing is open, nothing is drawn, and no Camera is remembered.</span><button class="lnk" data-act="resume">Resume</button><button class="lnk" data-act="parked-off">Dismiss</button></div>`;
  }
  const act = v.fix === 'select' && p.identity ? `<button class="lnk" data-act="sel" data-id="${p.identity}">Select ${esc(p.name || p.identity)}</button>` : '';
  return `<div class="relation parked quiet"><span class="dot"></span><span><b>Parked, not resumable</b> — ${esc(v.reason)}. Resume never guesses a host or a name: start the work fresh instead.</span>${act}<button class="lnk" data-act="parked-off">Dismiss</button></div>`;
}

// ---------------------------------------------------------------- fields shared by Card and on-drawing numbers

export function fieldValue(spec) {
  // A declared candidate is not a source value: it lives in the work in hand, and the source is only
  // touched by accepting it.
  if (spec.type === 'repair') return S.task?.params?.[spec.key] ?? 0;
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
  if (spec.type === 'repair') return declareRepair(spec.key, v);
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
