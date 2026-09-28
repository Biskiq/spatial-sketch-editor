// Shell rendering: Project Head, Outline, View Bar, session strip, Inspector,
// Status Rail, capture sheet, popovers, toasts and help. Panels re-render on state
// changes; per-frame values (tags, clocks, playheads) update in ui-frame.js.

import { S, app } from './state.js';
import { store } from './store.js';
import * as D from './derive.js';
import { describeView } from './camera.js';
import { esc, secs, metres, times, plural } from './util.js';
import { P, animValue, followPose } from './actions.js';
import { renderDrawer } from './ui-drawer.js';
import { renderVisitor, renderRunPanel } from './ui-preview.js';
import { renderPresenter } from './journeys.js';

const $ = (id) => document.getElementById(id);

// ---- vocabulary: domains and lifetimes ----

const DOMAIN = { Scene: 'scene', Camera: 'camera', Experience: 'exp', Layout: 'layout', Resource: 'res' };
export const dchip = (d, text) => `<span class="dchip d-${DOMAIN[d] || 'x'}">${esc(text || d)}</span>`;
export const life = (kind, text) => `<span class="life l-${kind}">${esc(text || { source: 'Source', session: 'View only', authored: 'Authored', run: 'Run' }[kind])}</span>`;
export const ref = (t) => `<span class="ref">${esc(t)}</span>`;
export const sevIcon = (s) => ({ error: '<i class="sev s-error" aria-hidden="true">✕</i>', decide: '<i class="sev s-decide" aria-hidden="true">?</i>', warn: '<i class="sev s-warn" aria-hidden="true">!</i>', ok: '<i class="sev s-ok" aria-hidden="true">✓</i>', kept: '<i class="sev s-kept" aria-hidden="true">✓</i>' }[s] || '');
export const sevWord = (s) => ({ error: 'Needs repair', decide: 'Needs a decision', warn: 'Needs review', ok: 'Handled', kept: 'Kept' }[s]);

// ---- thumbnails ----

const thumbs = new Map();
export function stopThumb(occ) {
  const p = P();
  const key = occ.id + '@' + p.rev;
  if (!thumbs.has(key)) {
    const e = D.evalStop(p, occ, D.schedule(p, occ).length, {});
    thumbs.set(key, e.pose ? app.stage.thumb(e.pose, e.ch) : '');
  }
  return thumbs.get(key);
}
export function poseThumb(key, pose, ch) {
  if (!thumbs.has(key)) thumbs.set(key, app.stage.thumb(pose, ch));
  return thumbs.get(key);
}

// ---- helpers ----

export function stopMeta(p, occ) {
  const bits = [];
  const vi = D.visitInfo(p, occ);
  if (occ.subject) bits.push(p.scene.inst[occ.subject].name + (vi && vi.of > 1 ? ' · visit ' + vi.n + ' of ' + vi.of : ''));
  else bits.push(D.viewName(p, D.firstShot(occ)?.view));
  bits.push(D.isTimed(occ) ? secs(D.schedule(p, occ).length) : 'still');
  return bits.join(' · ');
}

function flagsFor(diags, occId) {
  const mine = D.diagFor(diags, occId).filter(D.needsWork);
  if (!mine.length) return '';
  const e = mine.filter((d) => d.sev === 'error').length, q = mine.filter((d) => d.sev === 'decide').length, w = mine.filter((d) => d.sev === 'warn').length;
  return `<span class="flags" aria-label="${mine.length} to handle">${e ? `<span class="flg f-error">✕${e}</span>` : ''}${q ? `<span class="flg f-decide">?${q}</span>` : ''}${w ? `<span class="flg f-warn">!${w}</span>` : ''}</span>`;
}

// ---- head ----

function renderHead(diags) {
  const p = P();
  const top = store.undo[store.undo.length - 1];
  const open = diags.filter(D.needsWork).length;
  const preview = S.mode === 'preview';
  const R = app.R;
  $('head').innerHTML = `
    <div class="doc-meta"><span class="doc-name">${esc(p.name)}</span><span class="doc-state">${preview ? 'Previewing revision ' + R.rev : 'Revision ' + p.rev + ' · accepted'}</span></div>
    <div class="exps" role="group" aria-label="Experiences over this world">
      <span class="k">Experiences</span>
      ${p.exp.order.map((id) => { const e = p.exp.list[id]; return `<button class="exp-tab${S.exp === id ? ' on' : ''}" data-act="exp" data-id="${id}" aria-pressed="${S.exp === id}" ${preview ? 'disabled' : ''}>${esc(e.name)}<span class="n">${e.stops.length}</span></button>`; }).join('')}
    </div>
    <div class="hist" aria-label="Document history">
      <button class="ib" data-act="undo" data-fk="undo" ${!top || preview ? 'disabled' : ''} aria-label="Undo${top ? ': ' + esc(top.label) : ''}" title="Undo (⌘Z)">↶</button>
      <span class="hist-label" title="${top ? esc(top.label) : ''}">${top ? (top.author !== 'You' ? '<b>' + esc(top.author) + ':</b> ' : '') + esc(top.label) : 'No changes yet'}</span>
      <button class="ib" data-act="redo" data-fk="redo" ${!store.redo.length || preview ? 'disabled' : ''} aria-label="Redo" title="Redo (⇧⌘Z)">↷</button>
    </div>
    ${preview ? `<div class="run-id">${life('run', 'Run #' + R.id)}<span>${esc(D.expName(p, R.expId))}</span></div>
      <button class="btn md" data-act="exit-preview" data-fk="exitp">Exit preview <kbd>Esc</kbd></button>`
    : `<button class="btn md review-btn${S.panel === 'review' ? ' on' : ''}" data-act="review" data-fk="review" aria-pressed="${S.panel === 'review'}">Review${open ? `<span class="badge${diags.some((d) => d.sev === 'error') ? ' err' : ''}">${open}</span>` : ''}</button>
      <button class="btn md primary" data-act="preview" data-fk="preview">▶ Preview <kbd>P</kbd></button>`}
    <a class="btn md quiet" href="rationale.html" target="_blank" rel="noopener">Rationale</a>`;
}

// ---- outline (Navigator projection: this Experience) ----

function renderOutline(diags) {
  const p = P();
  const exp = p.exp.list[S.exp];
  const stops = D.stopsOf(p, S.exp);
  const preview = S.mode === 'preview';
  const R = app.R;
  const rows = stops.map((o, i) => {
    const cur = preview ? R.i === i : S.stop === o.id;
    const sel = !preview && S.sel?.kind === 'stop' && S.sel.id === o.id;
    const done = preview && (i < R.i || R.status === 'ended');
    return `<li class="stop-row${cur ? ' cur' : ''}${sel ? ' sel' : ''}${done ? ' done' : ''}" role="option" aria-selected="${sel}" tabindex="${cur || (!S.stop && i === 0) ? 0 : -1}"
      data-act="${preview ? 'run-goto' : 'stop'}" data-id="${o.id}" data-i="${i}" data-fk="stop:${o.id}">
      <span class="num">${i + 1}</span>
      <img class="thumb" alt="" src="${stopThumb(o)}">
      <span class="st-main"><span class="st-title">${esc(o.title)}</span><span class="st-meta">${esc(stopMeta(p, o))}</span></span>
      ${preview ? (cur ? `<span class="run-mark" aria-label="Now playing">▶</span>` : '') : flagsFor(diags, o.id)}
      <span class="occ-id">${o.id}</span>
    </li>`;
  }).join('');

  const subjects = Object.values(p.scene.inst).map((inst) => {
    const visits = D.stopsOf(p, S.exp).filter((o) => o.subject === inst.id).length;
    const all = D.subjectVisits(p, inst.id).length;
    const sel = S.sel?.kind === 'subject' && S.sel.inst === inst.id;
    return `<button class="row${sel ? ' sel' : ''}" data-act="subject" data-inst="${inst.id}" data-fk="subj:${inst.id}" ${preview ? 'disabled' : ''}>
      <span class="glyph g-inst" aria-hidden="true"></span><span class="nm">${esc(inst.name)}</span>
      <span class="meta">${visits ? plural(visits, 'visit') + ' here' : 'not visited here'}${all > visits ? ' · ' + (all - visits) + ' elsewhere' : ''}</span></button>`;
  }).join('');

  const perfs = Object.values(p.res.perfs).map((d) => {
    const uses = D.usesOf(p, d.id);
    const exps = new Set(uses.map((u) => u.occ.exp)).size;
    const sel = S.sel?.kind === 'perf' && S.sel.id === d.id;
    return `<button class="row${sel ? ' sel' : ''}" data-act="perf" data-id="${d.id}" data-fk="perf:${d.id}" ${preview ? 'disabled' : ''}>
      <span class="glyph g-perf" aria-hidden="true"></span><span class="nm">${esc(d.name)}</span>
      <span class="meta">${uses.length ? plural(uses.length, 'use') + (exps > 1 ? ' · ' + exps + ' Experiences' : '') : 'not used yet'}</span></button>`;
  }).join('');

  const views = Object.values(p.camera.views).map((v) => {
    const users = D.viewUsers(p, v.id);
    const sel = S.sel?.kind === 'view' && S.sel.id === v.id;
    const routes = Object.values(p.camera.routes).filter((r) => r.a === v.id || r.b === v.id).length;
    return `<button class="row sub${sel ? ' sel' : ''}" data-act="view" data-id="${v.id}" data-fk="view:${v.id}" ${preview ? 'disabled' : ''}>
      <span class="glyph g-view${v.framing === 'locked' ? ' locked' : ''}" aria-hidden="true"></span><span class="nm">${esc(v.name)}</span>
      <span class="meta">${users.length ? plural(users.length, 'Stop') : 'unused'} · ${routes ? plural(routes, 'route') : 'no routes'}</span></button>`;
  }).join('');

  $('outline').innerHTML = `
    <div class="ol-sec-h"><span class="eng">Explanation</span>${dchip('Experience')}</div>
    <div class="ol-title"><span>${esc(exp.name)}</span><span class="ref">${exp.ref}</span></div>
    <ol class="stops" role="listbox" aria-label="Stops of ${esc(exp.name)}, in order">${rows}</ol>
    ${preview ? '' : `<button class="add-stop" data-act="add-stop" data-fk="add-stop">+ Add Stop <span>after ${S.stop ? '“' + esc(p.occ[S.stop]?.title) + '”' : 'the last'}</span></button>`}
    <div class="ol-sec-h"><span class="eng">Subjects</span>${dchip('Scene')}</div>
    <div class="rows">${subjects}
      <button class="row" data-act="bay" ${preview ? 'disabled' : ''}><span class="glyph g-bay" aria-hidden="true"></span><span class="nm">Pump bay</span><span class="meta">Layout · 4 walls</span></button>
    </div>
    <div class="ol-sec-h"><span class="eng">Reusable</span>${dchip('Resource', 'Resources')}</div>
    <div class="rows">${perfs}</div>
    <div class="ol-sec-h"><span class="eng">Camera views</span>${dchip('Camera')}</div>
    <div class="rows">${views}</div>
    <div class="ol-sec-h"><span class="eng">World activity</span>${dchip('Scene')}</div>
    <div class="rows"><div class="row amb"><span class="glyph g-amb${S.motion === 'reduced' ? ' still' : ''}" aria-hidden="true"></span><span class="nm">Rotor spin</span><span class="meta">Pump A, Pump B · own clock</span></div>
      <p class="amb-note">Runs in every Experience. A Stop can show it but cannot pause, cut or restart it.</p></div>`;
}

// ---- view bar + session strip ----

function renderViewBar() {
  const preview = S.mode === 'preview';
  const occ = S.stop ? P().occ[S.stop] : null;
  $('viewbar').innerHTML = preview
    ? `<span class="vb-cap">Visitor preview</span><span class="vb-note">The frame below is the visitor runtime: no selection, history, gizmos or editor overlays.</span>
       <div class="vb-util"><button class="util" data-act="keys">Keys <kbd>?</kbd></button></div>`
    : `<div class="views" role="group" aria-label="Look">
        <button class="vtab${S.look === 'shot' && !S.inspect ? ' on' : ''}" data-act="look" data-v="shot" data-fk="look-shot" ${!occ || S.inspect ? 'disabled' : ''} aria-pressed="${S.look === 'shot'}" title="Look through the current Stop’s shot (1)">Shot</button>
        <button class="vtab${S.look === 'free' || S.inspect ? ' on' : ''}" data-act="look" data-v="free" data-fk="look-free" aria-pressed="${S.look === 'free'}" title="Your own camera — never saved (2)">Free look</button>
      </div>
      <span class="vb-note">${S.inspect ? 'Inspection is temporary until you capture.' : S.look === 'shot' && occ ? 'Seeing Stop ' + (D.position(P(), occ).i + 1) + ' as authored.' : 'Browsing is session state — it never becomes audience behaviour.'}</span>
      <div class="vb-util">
        <button class="util" data-act="inspect-sel" ${S.sel?.kind === 'subject' && !S.inspect ? '' : 'disabled'} title="Inspect the selected subject (I)">Inspect <kbd>I</kbd></button>
        <button class="util" data-act="capture" title="Capture from the viewport (C)">Capture <kbd>C</kbd></button>
        <button class="util${app.showMap ? ' on' : ''}" data-act="cammap" aria-pressed="${!!app.showMap}">Camera map</button>
        <button class="util" data-act="keys">Keys <kbd>?</kbd></button>
      </div>`;

  const strip = $('strip');
  const I = S.inspect;
  strip.hidden = !I || preview;
  if (!I || preview) return;
  const name = P().scene.inst[I.inst].name;
  const sep = animValue(I.sepA);
  strip.innerHTML = `
    <span class="k">Inspecting</span>
    <nav class="crumbs" aria-label="Inspection depth"><button data-act="inspect-return" class="crumb">Where you were</button><span>›</span>
      <button class="crumb${I.level === 'casing' ? ' cur' : ''}" data-act="${I.level === 'bay' ? 'inspect-bay' : 'noop'}">${esc(name)} casing</button>
      ${I.level === 'bay' ? '<span>›</span><span class="crumb cur">Bay cutaway</span>' : ''}</nav>
    ${life('session')}
    <label class="sep-ctl"><span>Opening</span><input type="range" min="0" max="1" step="0.01" value="${sep.toFixed(2)}" data-field="inspect-sep" aria-label="Casing opening (view only)"><output class="mono">${metres(sep)}</output></label>
    <button class="btn sm${I.level === 'bay' ? ' pressed' : ''}" data-act="inspect-bay" aria-pressed="${I.level === 'bay'}" data-fk="insp-bay">${I.level === 'bay' ? 'Close the bay' : 'Open the bay'} <kbd>B</kbd></button>
    <span class="grow"></span>
    <button class="btn sm primary" data-act="capture" data-fk="insp-cap">Capture… <kbd>C</kbd></button>
    <button class="btn sm" data-act="inspect-back" data-fk="insp-ret">${I.level === 'bay' ? 'Back' : 'Return'} <kbd>Esc</kbd></button>`;
}

// ---- inspector ----

function field(label, body, cls = '') { return `<div class="f ${cls}"><div class="fl">${label}</div><div class="fv">${body}</div></div>`; }
function sec(title, body, extra = '') { return `<section class="isec"><h3>${title}${extra}</h3>${body}</section>`; }

function inspStop(p, occ, diags) {
  const pos = D.position(p, occ);
  const vi = D.visitInfo(p, occ);
  const sch = D.schedule(p, occ);
  const shots = sch.shots;
  const say = D.sayOf(occ);
  const other = p.exp.order.filter((e) => e !== occ.exp);
  const reusedIn = Object.values(p.occ).filter((o) => o.reusedFrom === occ.id);
  const mine = D.diagFor(diags, occ.id).filter((d) => d.sev !== 'ok');
  return `
    <div class="ih">
      <div class="ih-k"><span class="eng">Stop ${pos.i + 1} of ${pos.n}</span>${dchip('Experience')}<span class="ref">${occ.id}</span></div>
      <input class="ih-title" value="${esc(occ.title)}" data-field="title" data-occ="${occ.id}" aria-label="Stop title" data-fk="title:${occ.id}">
      <div class="ih-sub">${occ.subject ? `${esc(p.scene.inst[occ.subject].name)}${vi && vi.of > 1 ? ` · <b>visit ${vi.n} of ${vi.of}</b> — the other is “${esc(vi.others.map((o) => o.title).join('”, “'))}”, a separate occurrence` : ''}` : 'No single subject'}</div>
    </div>
    ${mine.length ? `<div class="idiag">${mine.map((d) => `<button class="dg dg-${d.sev}" data-act="diag-open" data-id="${d.id}">${sevIcon(d.sev)}<span>${esc(d.title)}</span></button>`).join('')}</div>` : ''}
    ${sec('Shot' + (shots.length > 1 ? 's' : ''), shots.map((s, i) => {
      const v = p.camera.views[s.beat.view];
      return `<button class="shot-card" data-act="beat" data-occ="${occ.id}" data-id="${s.beat.id}">
        <span class="sc-k">${i ? 'Then' : 'Enters'} by ${s.beat.move === 'travel' ? (s.gap ? '<b class="t-err">travel — no route</b>' : 'travel') : 'cut'}</span>
        <span class="sc-n">${esc(v?.name)}</span><span class="sc-f">${esc(describeView(v))} ${dchip('Camera', v?.id)}</span></button>`;
    }).join(''))}
    ${sec('At this Stop', `${occ.states.length ? occ.states.map((st) => `<div class="st-line"><button class="linkish" data-act="state" data-occ="${occ.id}" data-id="${st.id}">${esc(st.label)}</button><span class="mono">${st.ch === 'bay.cutaway' ? 'Layout representation' : metres(st.v)}</span>${life('authored', 'Stop ' + (pos.i + 1))}</div>`).join('') : ''}
      ${D.usesIn(occ).map((b) => { const u = D.useInfo(p, b); return `<div class="st-line"><button class="linkish" data-act="beat" data-occ="${occ.id}" data-id="${b.id}">${esc(u.def.name)} · ${esc(p.scene.inst[b.subject].name)}</button><span class="mono">${u.localSpeed ? times(u.speed) + ' · ' : ''}${metres(u.sep)}</span>${life('authored', 'Use')}</div>`; }).join('')}
      ${!occ.states.length && !D.usesIn(occ).length ? '<p class="quiet">Nothing is changed here — the world as it is.</p>' : ''}
      <p class="hint">States and uses are this Stop’s presentation. They never write Pump A or Pump B.</p>`)}
    ${sec('Words', `<textarea rows="4" data-field="text" data-occ="${occ.id}" aria-label="Words for this Stop" data-fk="text:${occ.id}" placeholder="What should a visitor understand here?">${esc(say?.text)}</textarea>
      <div class="f-row"><span class="quiet">${say ? secs(say.dur) + ' when read aloud' : ''}</span></div>`)}
    ${sec('Then', `<div class="seg" role="radiogroup" aria-label="Continue">
        <button role="radio" aria-checked="${occ.cont === 'hold'}" class="${occ.cont === 'hold' ? 'on' : ''}" data-act="cont" data-occ="${occ.id}" data-v="hold">Wait for the visitor</button>
        <button role="radio" aria-checked="${occ.cont === 'auto'}" class="${occ.cont === 'auto' ? 'on' : ''}" data-act="cont" data-occ="${occ.id}" data-v="auto">Continue after ${secs(sch.length)}</button></div>`)}
    ${sec('Reduced motion', `<p class="small">${D.isTimed(occ) ? 'Travel becomes a cut with a place label. ' + (D.usesIn(occ).length ? '“Open casing” steps open and outlines the moved cover (its authored alternative). ' : '') : 'Nothing moves here, so nothing changes. '}The words and their order stay.</p>`)}
    ${sec('Reuse', `${reusedIn.length ? reusedIn.map((o) => `<p class="small">Reused in <b>${esc(D.expName(p, o.exp))}</b> as occurrence ${o.id} — its own words and invocation.</p>`).join('') : '<p class="small quiet">Only in this Experience.</p>'}
      ${other.map((e) => `<button class="btn sm" data-act="reuse" data-occ="${occ.id}" data-exp="${e}">Reuse in ${esc(D.expName(p, e))}…</button>`).join('')}`)}
    <div class="i-actions">
      <button class="btn sm" data-act="stop-move" data-occ="${occ.id}" data-dir="-1" ${pos.i === 0 ? 'disabled' : ''}>Move earlier</button>
      <button class="btn sm" data-act="stop-move" data-occ="${occ.id}" data-dir="1" ${pos.i === pos.n - 1 ? 'disabled' : ''}>Move later</button>
      <button class="btn sm danger" data-act="stop-remove" data-occ="${occ.id}">Remove Stop</button>
    </div>`;
}

function scopeSwitch(scope, uses) {
  return `<div class="scope" role="radiogroup" aria-label="Edit scope">
    <button role="radio" aria-checked="${scope === 'use'}" class="${scope === 'use' ? 'on' : ''}" data-act="scope" data-v="use"><b>This use</b><span>only here</span></button>
    <button role="radio" aria-checked="${scope === 'def'}" class="${scope === 'def' ? 'on' : ''}" data-act="scope" data-v="def"><b>Shared definition</b><span>${plural(uses, 'use')}</span></button></div>`;
}

function impactList(p, perfId, { exceptBeat = null, sepChange = null } = {}) {
  return D.usesOf(p, perfId).map(({ occ, beat }) => {
    const u = D.useInfo(p, beat);
    const pos = D.position(p, occ);
    const shielded = sepChange !== null && u.localSep;
    const hit = sepChange !== null && !u.localSep ? D.wallHit(p, beat.subject, sepChange) : null;
    return `<li class="${beat.id === exceptBeat ? 'me' : ''}${shielded ? ' shielded' : ''}">
      <span class="il-e">${esc(D.expName(p, occ.exp))}</span><span class="il-s">Stop ${pos.i + 1} “${esc(occ.title)}” · ${esc(p.scene.inst[beat.subject].name)}</span>
      <span class="il-v mono">${u.localSpeed ? times(u.speed) + ' ' : ''}${u.localSep ? metres(u.sep) + ' own' : metres(u.sep)}</span>
      ${sepChange !== null ? (shielded ? '<span class="il-x ok">keeps its own value</span>' : hit ? `<span class="il-x err">would pass through ${hit.wall}</span>` : `<span class="il-x">→ ${metres(sepChange)}</span>`) : ''}</li>`;
  }).join('');
}

function inspUse(p, occ, beat) {
  const u = D.useInfo(p, beat);
  const def = u.def;
  const uses = D.usesOf(p, def.id);
  const scope = S.useScope || 'use';
  const sch = D.schedule(p, occ);
  const it = sch.items.find((i) => i.beat.id === beat.id);
  const pos = D.position(p, occ);
  const pend = S.pendingPerf && S.pendingPerf.perf === def.id ? S.pendingPerf : null;
  const body = scope === 'use' ? `
    <p class="scope-note">Changes here apply to <b>this use in Stop ${pos.i + 1}</b> only. The shared definition and its other ${plural(uses.length - 1, 'use')} stay as they are.</p>
    ${field('Speed', `<div class="stepper"><button class="btn xs" data-act="speed" data-occ="${occ.id}" data-id="${beat.id}" data-v="${Math.max(0.25, u.speed - 0.1).toFixed(2)}" aria-label="Slower">−</button><span class="mono val">${times(u.speed)}</span><button class="btn xs" data-act="speed" data-occ="${occ.id}" data-id="${beat.id}" data-v="${Math.min(3, u.speed + 0.1).toFixed(2)}" aria-label="Faster">+</button>
        ${u.localSpeed ? `<button class="btn xs quiet" data-act="speed" data-occ="${occ.id}" data-id="${beat.id}" data-v="1">Reset</button>` : ''}</div>
        <div class="derived">${secs(u.dur)} here · definition plays ${secs(def.duration)} ${u.localSpeed ? '<span class="tag own">this use</span>' : '<span class="tag inh">inherited</span>'}</div>`)}
    ${field('Separation', `<div class="stepper"><span class="mono val">${metres(u.sep)}</span>
        ${u.localSep ? `<span class="tag own">this use</span><button class="btn xs quiet" data-act="sep-clear" data-occ="${occ.id}" data-id="${beat.id}">Use the definition’s ${metres(def.params.separation)}</button>`
          : `<span class="tag inh">from definition</span><button class="btn xs" data-act="sep-own" data-occ="${occ.id}" data-id="${beat.id}">Set for this use…</button>`}</div>`)}
    ${uses.length > 1 ? `<div class="others"><div class="ik">Other uses of “${esc(def.name)}” — unaffected by edits here</div><ul class="ilist">${D.usesOf(p, def.id).filter((x) => x.beat.id !== beat.id).map(({ occ: o, beat: b }) => { const ui = D.useInfo(p, b); const pp = D.position(p, o); return `<li><span class="il-e">${esc(D.expName(p, o.exp))}</span><span class="il-s">Stop ${pp.i + 1} “${esc(o.title)}” · ${esc(p.scene.inst[b.subject].name)}</span><span class="il-v mono">${times(ui.speed)} · ${metres(ui.sep)}</span><span class="il-x ok">✓ unaffected</span></li>`; }).join('')}</ul></div>` : ''}
    ${S.sepEdit === beat.id ? `<div class="inline-edit"><input type="range" min="0" max="1" step="0.05" value="${u.sep}" data-field="use-sep" data-occ="${occ.id}" data-id="${beat.id}" aria-label="Separation for this use"><output class="mono">${metres(u.sep)}</output><button class="btn xs primary" data-act="sep-own-apply" data-occ="${occ.id}" data-id="${beat.id}">Apply here only</button></div>` : ''}`
  : `
    <p class="scope-note warn">Changes here reach <b>every use of “${esc(def.name)}”</b> that doesn’t set its own value — across Experiences.</p>
    ${field('Separation', `<div class="stepper"><input class="num" type="number" min="0" max="1" step="0.05" value="${(pend ? pend.separation : def.params.separation).toFixed(2)}" data-field="def-sep" data-perf="${def.id}" aria-label="Shared separation in metres"><span class="unit">m</span></div>`)}
    ${field('Duration', `<span class="mono val">${secs(def.duration)}</span> <span class="quiet">intrinsic timing</span>`)}
    ${pend ? `<div class="impact"><div class="ik">Before you apply: ${metres(def.params.separation)} → ${metres(pend.separation)}</div><ul class="ilist">${impactList(p, def.id, { exceptBeat: beat.id, sepChange: pend.separation })}</ul>
      <div class="f-row"><button class="btn sm primary" data-act="def-apply" data-perf="${def.id}">Apply to the shared definition</button><button class="btn sm" data-act="def-cancel">Cancel</button></div></div>`
      : `<ul class="ilist">${impactList(p, def.id, { exceptBeat: beat.id })}</ul>`}`;
  return `
    <div class="ih">
      <div class="ih-k"><span class="eng">Performance use</span>${dchip('Experience')}<span class="ref">${beat.id}</span></div>
      <div class="ih-name">${esc(def.name)} <span class="on-subj">on ${esc(p.scene.inst[beat.subject].name)}</span></div>
      <div class="ih-sub">In Stop ${pos.i + 1} “${esc(occ.title)}” · starts ${relWords(p, occ, beat)} · ${secs(it?.start)}–${secs(it?.end)}</div>
    </div>
    ${scopeSwitch(scope, uses.length)}
    <div class="scope-body s-${scope}">${body}</div>
    ${sec('Controls', `<p class="small mono">${esc(p.scene.inst[beat.subject].name)} › Casing cover › separation</p><p class="small">Exclusive: while this use holds the cover, visitor inspection must ask for it (yield, stop or hand off).</p>`)}
    ${sec('Definition', `<button class="linkish" data-act="perf" data-id="${def.id}">${esc(def.name)}</button> ${dchip('Resource', def.ref)} <span class="quiet">rev ${def.rev}</span>`)}
    <div class="i-actions"><button class="btn sm danger" data-act="beat-remove" data-occ="${occ.id}" data-id="${beat.id}">Remove this use</button></div>`;
}

export function relWords(p, occ, beat) {
  const i = occ.beats.indexOf(beat);
  if (i === 0 || beat.rel === 'start') return 'at the start';
  const prev = occ.beats[i - 1];
  const nm = (b) => b.kind === 'shot' ? 'shot “' + D.viewName(p, b.view) + '”' : b.kind === 'use' ? '“' + (p.res.perfs[b.perf]?.name) + '”' : b.kind === 'say' ? 'the words' : 'the wait';
  if (beat.rel === 'with') return 'with ' + nm(prev);
  if (beat.rel === 'cue') return 'at “' + beat.cue?.name + '” in the words';
  return 'after ' + nm(prev);
}

function inspShot(p, occ, beat) {
  const v = p.camera.views[beat.view];
  const sch = D.schedule(p, occ);
  const it = sch.items.find((i) => i.beat.id === beat.id);
  const users = D.viewUsers(p, v.id);
  const first = sch.shots[0]?.beat.id === beat.id;
  return `
    <div class="ih">
      <div class="ih-k"><span class="eng">Shot</span>${dchip('Experience')}<span class="ref">${beat.id}</span></div>
      <div class="ih-name">${esc(v.name)}</div>
      <div class="ih-sub">${first ? 'How the tour arrives at this Stop' : 'Starts ' + relWords(p, occ, beat)} · ${secs(it.start)}</div>
    </div>
    ${sec(first ? 'Arrive by' : 'Change by', `<div class="seg" role="radiogroup" aria-label="Transition">
        <button role="radio" aria-checked="${beat.move !== 'travel'}" class="${beat.move !== 'travel' ? 'on' : ''}" data-act="beat-move" data-occ="${occ.id}" data-id="${beat.id}" data-v="cut">Cut</button>
        <button role="radio" aria-checked="${beat.move === 'travel'}" class="${beat.move === 'travel' ? 'on' : ''}" data-act="beat-move" data-occ="${occ.id}" data-id="${beat.id}" data-v="travel">Travel</button></div>
      ${beat.move === 'travel' ? (it.gap ? `<div class="refusal"><b>No Camera route</b> from “${esc(D.viewName(p, it.gap.from))}” to “${esc(v.name)}”. A cut needs no route; travel does — Camera owns routes.
          <div class="f-row"><button class="btn xs" data-act="beat-move" data-occ="${occ.id}" data-id="${beat.id}" data-v="cut">Use a cut</button><button class="btn xs" data-act="add-route" data-a="${it.gap.from}" data-b="${v.id}">Add a Camera route…</button></div></div>`
          : it.noOrigin ? '<p class="small quiet">The first Stop has nothing to travel from.</p>' : `<p class="small">Camera route ${it.route.legs.map((l) => l.route).join(' → ')} · ${secs(it.dur)}.</p>`)
        : '<p class="small quiet">A cut implies no spatial route.</p>'}`)}
    ${sec('Camera view', `<p class="small">${esc(describeView(v))} ${dchip('Camera', v.id)}</p>
      <div class="seg" role="radiogroup" aria-label="Framing">
        <button role="radio" aria-checked="${v.framing === 'assisted'}" class="${v.framing === 'assisted' ? 'on' : ''}" ${v.subject ? '' : 'disabled'} data-act="framing" data-view="${v.id}" data-occ="${occ.id}" data-v="assisted">Follow the subject</button>
        <button role="radio" aria-checked="${v.framing === 'locked'}" class="${v.framing === 'locked' ? 'on' : ''}" data-act="framing" data-view="${v.id}" data-occ="${occ.id}" data-v="locked">Locked shot</button></div>
      <p class="scope-note">Views belong to Camera: changing framing affects ${plural(users.length, 'Stop')} that ${users.length === 1 ? 'uses' : 'use'} this view.</p>`)}
    ${first ? '' : `<div class="i-actions"><button class="btn sm danger" data-act="beat-remove" data-occ="${occ.id}" data-id="${beat.id}">Remove this cut</button></div>`}`;
}

function inspSay(p, occ, beat) {
  const sch = D.schedule(p, occ);
  const it = sch.items.find((i) => i.beat.id === beat.id);
  return `
    <div class="ih"><div class="ih-k"><span class="eng">Words</span>${dchip('Experience')}<span class="ref">${beat.id}</span></div>
      <div class="ih-name">Stop ${D.position(p, occ).i + 1} “${esc(occ.title)}”</div>
      <div class="ih-sub">Starts ${relWords(p, occ, beat)} · ${secs(it.dur)}</div></div>
    ${sec('Text', `<textarea rows="5" data-field="text" data-occ="${occ.id}" aria-label="Words" data-fk="saytext:${occ.id}">${esc(beat.text)}</textarea>`)}
    ${beat.cues?.length ? sec('Cues', beat.cues.map((c) => `<div class="st-line"><span>“${esc(c.name)}”</span><span class="mono">${secs(c.t)}</span></div>`).join('') + '<p class="small quiet">A cue is a moment in the words that other beats can start at.</p>') : ''}
    ${it.crossings?.length ? sec('Across the cut', `<p class="small">The camera cuts to “${esc(D.viewName(p, it.crossings[0].beat.view))}” at ${secs(it.crossings[0].start)} while these words play.</p>
      <div class="seg" role="radiogroup" aria-label="Words at the cut">
        <button role="radio" aria-checked="${beat.crossCut === 'continue'}" class="${beat.crossCut === 'continue' ? 'on' : ''}" data-act="cross" data-occ="${occ.id}" data-id="${beat.id}" data-v="continue">Keep speaking</button>
        <button role="radio" aria-checked="${beat.crossCut === 'end'}" class="${beat.crossCut === 'end' ? 'on' : ''}" data-act="cross" data-occ="${occ.id}" data-id="${beat.id}" data-v="end">Stop at the cut</button></div>
      ${!beat.crossCut ? '<p class="small t-decide">Undecided — the Stop is flagged until you choose.</p>' : ''}`) : ''}`;
}

function inspState(p, occ, st) {
  const canAnimate = st.ch.endsWith('.casing');
  return `
    <div class="ih"><div class="ih-k"><span class="eng">State at a Stop</span>${dchip('Experience')}<span class="ref">${st.id}</span></div>
      <div class="ih-name">${esc(st.label)}</div>
      <div class="ih-sub">${st.ch === 'bay.cutaway' ? 'Pump bay › representation › cutaway — evaluated by Layout' : esc(D.instName(p, st.ch.split('.')[0])) + ' › Casing cover › separation = ' + metres(st.v)}</div></div>
    ${sec('What it is', `<p class="small">A partial declaration held for the whole Stop. It has no timing: the Stop simply shows it. ${life('authored', 'Stop ' + (D.position(p, occ).i + 1))}</p>
      <p class="small">It is not a Scene edit — the Scene baseline stays “closed”.</p>`)}
    ${canAnimate ? sec('Grow into timing', `<p class="small">Replace the still state with a use of a reusable performance that animates to it — the Stop becomes timed, and Beats appear.</p>
      <button class="btn sm primary" data-act="animate" data-occ="${occ.id}" data-id="${st.id}">Animate with “Open casing”</button>`) : ''}
    <div class="i-actions"><button class="btn sm danger" data-act="state-remove" data-occ="${occ.id}" data-id="${st.id}">Remove state</button></div>`;
}

function inspSubject(p, instId) {
  const inst = p.scene.inst[instId];
  const visits = D.subjectVisits(p, instId);
  const pend = S.pendingMove && S.pendingMove.inst === instId ? S.pendingMove : null;
  const pos = pend ? pend.pos : inst.pos;
  const moved = pend && (Math.abs(pend.pos[0] - inst.pos[0]) > 1e-3 || Math.abs(pend.pos[1] - inst.pos[1]) > 1e-3);
  return `
    <div class="ih"><div class="ih-k"><span class="eng">Subject</span>${dchip('Scene')}<span class="ref">${inst.ref}</span></div>
      <div class="ih-name">${esc(inst.name)}</div>
      <div class="ih-sub">Instance of PX-2 end-suction pump · definition rev 4</div></div>
    ${sec('Capabilities', `
      <div class="cap"><b>Casing opening</b><span>separation 0–1.00 m · exclusive · visitor may operate</span></div>
      <div class="cap"><b>Rotor spin</b><span>ambient · own clock · not controllable by a tour</span></div>
      <p class="small quiet">Declared by the definition — imported render parts are not assumed to be components.</p>`)}
    ${sec('Placement', `
      <div class="xyz"><label>x <input class="num" type="number" step="0.1" value="${pos[0].toFixed(2)}" data-field="move-x" data-inst="${instId}"></label>
      <label>z <input class="num" type="number" step="0.1" value="${pos[1].toFixed(2)}" data-field="move-z" data-inst="${instId}"></label><span class="unit">m</span></div>
      ${moved ? `<div class="impact"><div class="ik">Moving ${esc(inst.name)} edits Scene — the world every Experience shows.</div>
        <ul class="ilist">${visits.map((o) => { const pp = D.position(p, o); return `<li><span class="il-e">${esc(D.expName(p, o.exp))}</span><span class="il-s">Stop ${pp.i + 1} “${esc(o.title)}”</span></li>`; }).join('')}</ul>
        <div class="f-row"><button class="btn sm primary" data-act="move-apply" data-inst="${instId}">Move (Scene)</button><button class="btn sm" data-act="move-cancel">Cancel</button></div></div>`
        : `<p class="small">Seen by ${plural(visits.length, 'Stop')} across ${new Set(visits.map((o) => o.exp)).size} Experiences. Type a position to preview the move first.</p>`}`)}
    ${sec('Visits', visits.length ? visits.map((o) => { const pp = D.position(p, o); return `<button class="linkish block" data-act="stop" data-id="${o.id}">${esc(D.expName(p, o.exp))} · Stop ${pp.i + 1} “${esc(o.title)}”</button>`; }).join('') : '<p class="quiet small">Not in any Stop yet.</p>')}
    <div class="i-actions"><button class="btn sm primary" data-act="inspect" data-inst="${instId}" ${S.inspect ? 'disabled' : ''}>Inspect <kbd>I</kbd></button></div>`;
}

function inspPerf(p, def) {
  const uses = D.usesOf(p, def.id);
  const pend = S.pendingPerf && S.pendingPerf.perf === def.id ? S.pendingPerf : null;
  return `
    <div class="ih"><div class="ih-k"><span class="eng">Reusable performance</span>${dchip('Resource')}<span class="ref">${def.ref} · rev ${def.rev}</span></div>
      <div class="ih-name">${esc(def.name)}</div>
      <div class="ih-sub">Role “${def.role.name}” — needs the capability “${def.role.needs}”</div></div>
    ${sec('Parameters', `${field('Separation', `<div class="stepper"><input class="num" type="number" min="0" max="1" step="0.05" value="${(pend ? pend.separation : def.params.separation).toFixed(2)}" data-field="def-sep" data-perf="${def.id}" aria-label="Shared separation"><span class="unit">m</span></div>`)}
      ${field('Duration', `<span class="mono val">${secs(def.duration)}</span>`)}
      ${field('Easing', 'in-out')}${field('At the end', 'holds its final pose (owned by the run)')}
      ${pend ? `<div class="impact"><div class="ik">Before you apply: ${metres(def.params.separation)} → ${metres(pend.separation)}</div><ul class="ilist">${impactList(p, def.id, { sepChange: pend.separation })}</ul>
        <div class="f-row"><button class="btn sm primary" data-act="def-apply" data-perf="${def.id}">Apply to the shared definition</button><button class="btn sm" data-act="def-cancel">Cancel</button></div></div>` : ''}`)}
    ${sec('Reduced motion', `<p class="small">${esc(def.reduced)}. Meaning is kept; motion is not required.</p>`)}
    ${sec('Uses (' + uses.length + ')', uses.length ? `<ul class="ilist">${impactList(p, def.id)}</ul>` : '<p class="small quiet">Not used yet. Animate a casing state to use it.</p>')}`;
}

function inspView(p, v) {
  const users = D.viewUsers(p, v.id);
  const routes = Object.values(p.camera.routes).filter((r) => r.a === v.id || r.b === v.id);
  return `
    <div class="ih"><div class="ih-k"><span class="eng">Camera view</span>${dchip('Camera')}<span class="ref">${v.id}</span></div>
      <div class="ih-name">${esc(v.name)}</div><div class="ih-sub">${esc(describeView(v))}</div></div>
    ${sec('Routes', routes.length ? routes.map((r) => `<p class="small">${r.id} ↔ ${esc(D.viewName(p, r.a === v.id ? r.b : r.a))}</p>`).join('') : '<p class="small t-warn">No routes: Stops can cut here but cannot travel here.</p>')}
    ${sec('Used by', users.length ? users.map(({ occ }) => { const pp = D.position(p, occ); return `<button class="linkish block" data-act="stop" data-id="${occ.id}">${esc(D.expName(p, occ.exp))} · Stop ${pp.i + 1} “${esc(occ.title)}”</button>`; }).join('') : '<p class="small quiet">No Stop uses it.</p>')}`;
}

function inspBay(p) {
  return `<div class="ih"><div class="ih-k"><span class="eng">Architecture</span>${dchip('Layout')}<span class="ref">LAYOUT · BAY-1</span></div>
    <div class="ih-name">Pump bay</div><div class="ih-sub">North, east, south and west walls · roof · one door</div></div>
    ${sec('Representation', '<p class="small">Cutaway lifts the roof and cuts the south wall to 1 m. It is Layout evaluation of a typed parameter — it never changes the walls, and a lifted roof creates no new opening.</p><p class="small">Open it from an inspection (<kbd>B</kbd>) to look, or capture it into a Stop as authored representation intent.</p>')}`;
}

function reviewPanel(p, diags) {
  const groups = p.exp.order.map((e) => ({ e, items: diags.filter((d) => d.exp === e) })).filter((g) => g.items.length);
  const open = diags.filter(D.needsWork).length;
  return `
    <div class="ih"><div class="ih-k"><span class="eng">Review</span><span class="ref">revision ${p.rev}</span></div>
      <div class="ih-name">${open ? plural(open, 'thing') + ' to handle' : 'Nothing needs attention'}</div>
      <div class="ih-sub">What a change reached: invalid shots, uses that no longer fit, words that may not match.</div></div>
    ${groups.map((g) => `<section class="isec"><h3>${esc(D.expName(p, g.e))}</h3>${g.items.map((d) => diagCard(p, d)).join('')}</section>`).join('') || '<p class="small quiet pad">Change a subject or a shared performance and the consequences appear here.</p>'}
    <div class="i-actions"><button class="btn sm" data-act="review">Close review</button></div>`;
}

function diagCard(p, d) {
  const occ = p.occ[d.occ];
  const pos = D.position(p, occ);
  let actions = '';
  let extra = '';
  if (d.kind === 'frame') {
    const v = p.camera.views[d.view];
    const e = D.evalStop(p, occ, D.schedule(p, occ).length);
    const locked = { eye: v.eye, target: v.target, fov: v.fov };
    const follow = followPose(d.view, occ).pose;
    extra = `<div class="compare"><figure><img alt="Locked shot as authored" src="${poseThumb('lk' + d.id + p.rev, locked, e.ch)}"><figcaption>Locked, as authored</figcaption></figure>
      <figure><img alt="The same framing following the subject" src="${poseThumb('as' + d.id + p.rev, follow, e.ch)}"><figcaption>Following ${esc(p.scene.inst[v.subject].name)}</figcaption></figure></div>`;
    actions = `<button class="btn xs primary" data-act="diag-follow" data-view="${d.view}" data-occ="${d.occ}">Follow ${esc(p.scene.inst[v.subject].name)}</button>
      <button class="btn xs" data-act="diag-reaim" data-view="${d.view}" data-occ="${d.occ}">Re-aim, stay locked</button>
      <button class="btn xs quiet" data-act="diag-keep" data-occ="${d.occ}" data-key="${d.id}">Keep as authored</button>`;
  } else if (d.kind === 'hit') actions = `<button class="btn xs primary" data-act="diag-repair" data-occ="${d.occ}" data-id="${d.beat}">Repair this use only</button><button class="btn xs" data-act="perf" data-id="P-OPEN">Open the definition</button>`;
  else if (d.kind === 'gap') actions = `<button class="btn xs primary" data-act="beat-move" data-occ="${d.occ}" data-id="${d.beat}" data-v="cut">Use a cut</button><button class="btn xs" data-act="beat" data-occ="${d.occ}" data-id="${d.beat}">Open the shot</button>`;
  else if (d.kind === 'cross') actions = `<button class="btn xs" data-act="cross" data-occ="${d.occ}" data-id="${d.beat}" data-v="continue">Keep speaking</button><button class="btn xs" data-act="cross" data-occ="${d.occ}" data-id="${d.beat}" data-v="end">Stop at the cut</button>`;
  else if (d.kind === 'review') actions = `<button class="btn xs" data-act="stop" data-id="${d.occ}">Edit the words</button><button class="btn xs primary" data-act="diag-reviewed" data-occ="${d.occ}">Words still fit</button>`;
  return `<article class="dcard dc-${d.sev}" id="dg-${esc(d.id)}">
    <div class="dc-h">${sevIcon(d.sev)}<span class="dc-sev">${sevWord(d.sev)}</span><button class="linkish" data-act="stop" data-id="${d.occ}">Stop ${pos.i + 1} “${esc(occ.title)}”</button></div>
    <div class="dc-t">${esc(d.title)}</div>${d.detail ? `<div class="dc-d">${esc(d.detail)}</div>` : ''}${extra}
    ${actions ? `<div class="dc-a">${actions}</div>` : ''}</article>`;
}

function renderInspector(diags) {
  const p = P();
  const el = $('insp');
  if (S.mode === 'preview') { el.innerHTML = renderRunPanel(); return; }
  if (S.panel === 'review') { el.innerHTML = reviewPanel(p, diags); return; }
  const s = S.sel;
  let html = '';
  if (s?.kind === 'stop' && p.occ[s.id]) html = inspStop(p, p.occ[s.id], diags);
  else if (s?.kind === 'beat' && p.occ[s.occ]) {
    const occ = p.occ[s.occ], b = occ.beats.find((x) => x.id === s.id);
    if (b?.kind === 'use') html = inspUse(p, occ, b);
    else if (b?.kind === 'shot') html = inspShot(p, occ, b);
    else if (b?.kind === 'say') html = inspSay(p, occ, b);
  } else if (s?.kind === 'state' && p.occ[s.occ]) { const occ = p.occ[s.occ]; const st = occ.states.find((x) => x.id === s.id); if (st) html = inspState(p, occ, st); }
  else if (s?.kind === 'subject' && p.scene.inst[s.inst]) html = inspSubject(p, s.inst);
  else if (s?.kind === 'perf' && p.res.perfs[s.id]) html = inspPerf(p, p.res.perfs[s.id]);
  else if (s?.kind === 'view' && p.camera.views[s.id]) html = inspView(p, p.camera.views[s.id]);
  else if (s?.kind === 'bay') html = inspBay(p);
  el.innerHTML = html || `<div class="empty"><p>Select a Stop, a subject or a reusable performance.</p><p class="small quiet">Selection is session state: it never reaches a visitor.</p></div>`;
}

// ---- status rail ----

function renderStatus() {
  const p = P();
  const s = S.sel;
  let selText = 'Nothing selected';
  if (s?.kind === 'stop' && p.occ[s.id]) selText = 'Stop “' + p.occ[s.id].title + '” · ' + s.id;
  else if (s?.kind === 'subject') selText = p.scene.inst[s.inst]?.name + (s.comp && s.comp !== 'whole' ? ' › ' + ({ casing: 'Casing', rotor: 'Impeller', motor: 'Motor', skid: 'Skid', pipework: 'Pipework' }[s.comp] || s.comp) : '') + ' · ' + p.scene.inst[s.inst]?.ref;
  else if (s?.kind === 'beat') selText = 'Beat ' + s.id + ' in “' + p.occ[s.occ]?.title + '”';
  else if (s?.kind === 'perf') selText = p.res.perfs[s.id]?.name + ' · ' + p.res.perfs[s.id]?.ref;
  else if (s?.kind === 'view') selText = p.camera.views[s.id]?.name + ' · ' + s.id;
  $('status').innerHTML = `
    <span class="st-sel">${S.mode === 'preview' ? 'Preview: editor selection is not part of the run' : esc(selText)}</span>
    <span class="st-rev mono">rev ${p.rev}</span>
    <span class="st-world"><i class="spin${S.motion === 'reduced' ? ' still' : ''}" aria-hidden="true"></i>World activity: ${S.motion === 'reduced' ? 'rotor shown still' : 'rotor running'}</span>
    <div class="motion" role="radiogroup" aria-label="Motion"><span class="k">Motion</span>
      <button role="radio" aria-checked="${S.motion === 'full'}" class="${S.motion === 'full' ? 'on' : ''}" data-act="motion" data-v="full">Full</button>
      <button role="radio" aria-checked="${S.motion === 'reduced'}" class="${S.motion === 'reduced' ? 'on' : ''}" data-act="motion" data-v="reduced">Reduced</button></div>
    <button class="st-btn" data-act="presenter" aria-pressed="${S.presenter.open}">Presenter <kbd>J</kbd></button>`;
}

// ---- capture sheet ----

function capturePreview(c) {
  const ch = { 'pumpA.casing': 0, 'pumpB.casing': 0, 'bay.cutaway': 0 };
  if (c.inst && c.includeCasing) ch[c.inst + '.casing'] = c.sep;
  if (c.includeCut) ch['bay.cutaway'] = 1;
  return app.stage.thumb(c.pose, ch);
}

function renderSheet() {
  const el = $('sheet');
  const c = S.capture;
  el.hidden = !c;
  if (!c) return;
  el.style.top = ($('strip').hidden ? 34 : 72) + 'px';
  const p = P();
  const stops = D.stopsOf(p, c.exp);
  const name = c.inst ? p.scene.inst[c.inst].name : null;
  const refused = c.status === 'refused';
  const err = c.error;
  el.innerHTML = `
    <div class="sheet-box${refused ? ' refused' : ''}" role="dialog" aria-modal="false" aria-labelledby="sheetT">
      <div class="sh-head"><span class="eng" id="sheetT">Capture for an explanation</span><span class="ref">based on revision ${c.expected}</span></div>
      ${refused ? `<div class="refusal big" role="alert">
          <div class="rf-t">${err.reason === 'stale' ? 'Nothing was added — the project changed while this was open.' : 'Nothing was added — the capture did not validate.'}</div>
          ${err.reason === 'stale' ? `<p>You started from revision ${err.expected}; it is now ${err.current}.</p><ul>${err.since.map((s) => `<li><b>${esc(s.author)}:</b> ${esc(s.label)}</li>`).join('')}</ul>` : `<ul>${err.errors.map((e) => `<li>${esc(e)}</li>`).join('')}</ul>`}
          <p class="rf-none"><b>Not created:</b> Camera view “${esc(c.viewName)}”${c.as === 'stop' ? ` · Stop “${esc(c.title)}”` : ''}. Your choices below are kept.</p>
          <div class="f-row">${err.reason === 'stale' ? `<button class="btn sm primary" data-act="capture-retry" data-fk="cap-retry">Capture again on revision ${p.rev}</button>` : `<button class="btn sm primary" data-act="capture-retry" data-fk="cap-retry">Try again</button>`}<button class="btn sm" data-act="capture-cancel">Discard this capture</button></div></div>` : ''}
      <div class="sh-grid">
        <div class="sh-prev">
          <div class="sh-k">What the ${c.as === 'stop' ? 'Stop' : 'view'} will show</div>
          <img alt="Preview of the captured frame" src="${capturePreview(c)}">
          <p>Exactly this frame and ${c.includeCasing || c.includeCut ? 'these states' : 'the world as it is'} — no selection, no ghost, no labels.</p>
        </div>
        <div class="sh-col">
          <div class="sh-k">From what you see now, save</div>
          <label class="ck on-always"><input type="checkbox" checked disabled><span><span class="ck-t"><b>Camera view</b> — this standpoint ${dchip('Camera', 'Camera · new view')}</span><input class="inl" value="${esc(c.viewName)}" data-field="cap-viewName" aria-label="View name"></span></label>
          ${c.inst ? `<div class="sub-opt seg" role="radiogroup" aria-label="Framing">
            <button role="radio" aria-checked="${c.framing === 'assisted'}" class="${c.framing === 'assisted' ? 'on' : ''}" data-act="cap-set" data-k="framing" data-v="assisted">Follow ${esc(name)} if it moves</button>
            <button role="radio" aria-checked="${c.framing === 'locked'}" class="${c.framing === 'locked' ? 'on' : ''}" data-act="cap-set" data-k="framing" data-v="locked">Lock this exact shot</button></div>` : ''}
          ${c.inst && c.sep > 0.02 ? `<label class="ck"><input type="checkbox" ${c.includeCasing ? 'checked' : ''} data-field="cap-casing"><span><span class="ck-t"><b>Casing open · ${metres(c.sep)}</b> on ${esc(name)} ${dchip('Experience', c.as === 'stop' ? 'Stop state' : 'not saved without a Stop')}</span></span></label>` : ''}
          ${c.cut > 0.5 ? `<label class="ck"><input type="checkbox" ${c.includeCut ? 'checked' : ''} data-field="cap-cut"><span><span class="ck-t"><b>Bay cutaway</b> — Layout representation ${dchip('Experience', c.as === 'stop' ? 'Stop state' : 'not saved without a Stop')}</span></span></label>` : ''}
          <div class="never"><span class="sh-k">Never saved</span>
            <span>Selection outline</span><span>The dashed as-built ghost</span><span>How you moved the camera to get here</span><span>Rotor spin — world activity; a Stop shows it but can’t capture it</span></div>
        </div>
        <div class="sh-col">
          <div class="sh-k">Where it goes</div>
          <div class="seg col" role="radiogroup" aria-label="Capture as">
            <button role="radio" aria-checked="${c.as === 'stop'}" class="${c.as === 'stop' ? 'on' : ''}" data-act="cap-set" data-k="as" data-v="stop">New Stop in ${esc(D.expName(p, c.exp))}</button>
            <button role="radio" aria-checked="${c.as === 'view'}" class="${c.as === 'view' ? 'on' : ''}" data-act="cap-set" data-k="as" data-v="view">Camera view only</button></div>
          ${c.as === 'stop' ? `<label class="fld"><span>Stop title</span><input value="${esc(c.title)}" data-field="cap-title" data-fk="cap-title"></label>
            <label class="fld"><span>After</span><select data-field="cap-after">${stops.map((o, i) => `<option value="${o.id}" ${o.id === c.after ? 'selected' : ''}>${i + 1}. ${esc(o.title)}</option>`).join('')}</select></label>` : ''}
          <div class="one-step">${c.as === 'stop' ? `<b>One step:</b> Camera view + Stop, accepted together against revision ${c.expected}. Undo removes both; a failure adds neither.` : '<b>One step:</b> a Camera view only. No Stop is created.'}</div>
        </div>
      </div>
      <div class="sh-foot"><button class="btn md" data-act="capture-cancel" data-fk="cap-cancel">Cancel <kbd>Esc</kbd></button><span class="grow"></span>
        ${refused ? '' : `<button class="btn md primary" data-act="capture-commit" data-fk="cap-commit">${c.as === 'stop' ? 'Capture as Stop' : 'Save view'} <kbd>↵</kbd></button>`}</div>
    </div>`;
}

// ---- popovers ----

function renderMenu() {
  const el = $('menu');
  const m = S.menu;
  el.hidden = !m;
  if (!m) return;
  const p = P();
  let html = '';
  if (m.kind === 'add-stop') {
    const views = Object.values(p.camera.views);
    html = `<div class="m-k">Add a Stop after ${S.stop ? '“' + esc(p.occ[S.stop].title) + '”' : 'the last Stop'}</div>
      <button class="m-row" data-act="capture"><b>Capture from the viewport…</b><span>New Camera view + Stop, one step</span><kbd>C</kbd></button>
      <div class="m-k">Or use a saved Camera view</div>
      ${views.map((v) => { const vis = v.subject ? D.stopsOf(p, S.exp).filter((o) => o.subject === v.subject).length : 0; return `<button class="m-row" data-act="add-stop-view" data-view="${v.id}"><b>${esc(v.name)}</b><span>${v.subject ? esc(p.scene.inst[v.subject].name) + (vis ? ' · already visited ' + plural(vis, 'time') + ' — this will be a separate occurrence' : ' · first visit') : 'no single subject'}</span></button>`; }).join('')}`;
  } else if (m.kind === 'add-shot') {
    html = `<div class="m-k">Cut to a view inside this Stop</div>${Object.values(p.camera.views).map((v) => `<button class="m-row" data-act="add-shot" data-occ="${m.occ}" data-view="${v.id}"><b>${esc(v.name)}</b><span>${esc(describeView(v))}</span></button>`).join('')}
      <p class="m-note">A cut needs no route. You can switch it to travel later — Camera will say if no route exists.</p>`;
  } else if (m.kind === 'add-use') {
    html = `<div class="m-k">Use a reusable performance</div>${Object.values(p.res.perfs).map((d) => Object.values(p.scene.inst).map((inst) => `<button class="m-row" data-act="add-use" data-occ="${m.occ}" data-perf="${d.id}" data-inst="${inst.id}"><b>${esc(d.name)}</b><span>on ${esc(inst.name)} · role “${d.role.name}” ✓ capability declared</span></button>`).join('')).join('')}`;
  }
  el.innerHTML = `<div class="m-box" role="menu">${html}<button class="m-close" data-act="menu-close" aria-label="Close">Close <kbd>Esc</kbd></button></div>`;
  const anchor = m.anchor && document.querySelector(m.anchor);
  const r = anchor?.getBoundingClientRect();
  const box = el.firstElementChild;
  if (r) { box.style.left = Math.min(window.innerWidth - 340, r.left) + 'px'; box.style.top = (m.up ? Math.max(8, r.top - box.offsetHeight - 6) : r.bottom + 6) + 'px'; }
}

function renderToast() {
  const el = $('toast');
  const t = S.toast;
  if (!t || performance.now() / 1000 > t.until) { el.hidden = true; return; }
  if (el.dataset.id !== String(t.id)) { el.dataset.id = t.id; el.className = 'toast t-' + t.kind; el.innerHTML = `<span>${esc(t.text)}</span><button class="t-x" data-act="toast-x" aria-label="Dismiss">×</button>`; }
  el.hidden = false;
}

function renderHelp() {
  const el = $('help');
  el.hidden = !S.help;
  if (!S.help) return;
  el.innerHTML = `<div class="help-box" role="dialog" aria-label="Keys"><div class="eng">Keys</div><div class="help-g">
    <span><kbd>I</kbd> inspect the selected subject</span><span><kbd>B</kbd> open / close the bay while inspecting</span>
    <span><kbd>C</kbd> capture from the viewport</span><span><kbd>Esc</kbd> back one level · cancel · exit preview</span>
    <span><kbd>1</kbd> look through the Stop’s shot</span><span><kbd>2</kbd> free look (session camera)</span>
    <span><kbd>↑</kbd> <kbd>↓</kbd> move between Stops</span><span><kbd>⌥↑</kbd> <kbd>⌥↓</kbd> move a Stop earlier / later</span>
    <span><kbd>⌘Z</kbd> <kbd>⇧⌘Z</kbd> undo / redo accepted changes</span><span><kbd>P</kbd> preview the Experience</span>
    <span><kbd>Space</kbd> play / pause (preview)</span><span><kbd>←</kbd> <kbd>→</kbd> previous / next Stop (preview)</span>
    <span><kbd>L</kbd> look around (preview)</span><span><kbd>R</kbd> restart the run (preview)</span>
    <span><kbd>J</kbd> presenter (drag its header to move)</span><span><kbd>Shift</kbd> makes a camera move instant</span>
    <span>Drag orbit · right-drag pan · wheel zoom</span><span>Double-click a pump to inspect it</span></div>
    <button class="btn sm" data-act="keys">Close</button></div>`;
}

// ---- entry ----

export function renderAll() {
  const p = P();
  const diags = D.diagnostics(p);
  const active = document.activeElement;
  const fk = active?.dataset?.fk;
  const caret = active && 'selectionStart' in active && /INPUT|TEXTAREA/.test(active.tagName) && active.type !== 'range' && active.type !== 'number' ? [active.selectionStart, active.selectionEnd] : null;
  const scrolls = ['insp', 'outline'].map((id) => [id, $(id).scrollTop]);
  // Never throw away uncommitted typing: a panel holding a dirty text field waits for its commit.
  const dirty = active && /INPUT|TEXTAREA/.test(active.tagName) && !/range|number|checkbox|radio/.test(active.type) && active.value !== active.defaultValue;
  const holdIn = (id) => dirty && active.closest('#' + id);
  document.body.classList.toggle('previewing', S.mode === 'preview');
  document.body.classList.toggle('reduced', S.motion === 'reduced');
  renderHead(diags);
  renderOutline(diags);
  renderViewBar();
  if (!holdIn('insp')) renderInspector(diags);
  renderDrawer(diags);
  renderStatus();
  if (!holdIn('sheet')) renderSheet();
  renderMenu();
  renderVisitor();
  renderPresenter();
  renderHelp();
  renderToast();
  for (const [id, top] of scrolls) $(id).scrollTop = top;
  if (fk) {
    const el = document.querySelector(`[data-fk="${CSS.escape(fk)}"]`);
    if (el && el !== document.activeElement) {
      el.focus({ preventScroll: true });
      if (caret && el.setSelectionRange) try { el.setSelectionRange(caret[0], caret[1]); } catch { /* not a text field */ }
    }
  }
}

export { renderToast };
