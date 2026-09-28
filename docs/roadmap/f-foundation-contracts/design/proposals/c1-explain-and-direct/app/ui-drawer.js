// The Stop drawer: one Stop's presentation seen three ways over the same data.
//   Still — the Stop as a moment (view + states + words), no timing.
//   Beats — ordered beats with relations (after / with / at a cue). The default.
//   Clock — the same beats on a Stop-local ruler, for precise alignment and retiming.
// World activity appears in every lens as something the Stop does not own.

import { S, app } from './state.js';
import * as D from './derive.js';
import { esc, secs, metres, times } from './util.js';
import { P } from './actions.js';
import { dchip, life, relWords, stopThumb } from './ui.js';

const $ = (id) => document.getElementById(id);

export function renderDrawer(diags) {
  const el = $('drawer');
  const p = P();
  const preview = S.mode === 'preview';
  const R = app.R;
  const occ = preview ? p.occ[R.stops[R.i]] : S.stop ? p.occ[S.stop] : null;
  el.classList.toggle('open', S.drawer.open);
  el.classList.toggle('no-stop', !occ);
  if (!occ) {
    el.innerHTML = `<div class="dr-head"><button class="dr-tog" data-act="drawer" aria-expanded="${S.drawer.open}" aria-label="Toggle the Stop drawer">${S.drawer.open ? '▾' : '▸'}</button>
      <span class="eng">Stop</span><span class="dr-empty">Select a Stop in the outline to see how it unfolds.</span></div>`;
    return;
  }
  const pos = D.position(p, occ);
  const sch = D.schedule(p, occ);
  const lens = preview ? 'beats' : S.drawer.lens;
  const timed = D.isTimed(occ);
  el.innerHTML = `
    <div class="dr-head">
      <button class="dr-tog" data-act="drawer" aria-expanded="${S.drawer.open}" aria-label="Toggle the Stop drawer">${S.drawer.open ? '▾' : '▸'}</button>
      <span class="eng">Stop ${pos.i + 1}</span><span class="dr-title">${esc(occ.title)}</span><span class="ref">${occ.id}</span>
      ${preview ? life('run', 'Run #' + R.id) : `<div class="lens" role="radiogroup" aria-label="Show this Stop as">
        ${['still', 'beats', 'clock'].map((l) => `<button role="radio" aria-checked="${lens === l}" class="${lens === l ? 'on' : ''}" data-act="lens" data-v="${l}" data-fk="lens:${l}">${{ still: 'Still', beats: 'Beats', clock: 'Clock' }[l]}</button>`).join('')}</div>`}
      <span class="dr-len mono" id="drTime">${secs(sch.length)}</span>
      <span class="dr-cont">${timed ? '' : 'a still moment · '}${occ.cont === 'hold' ? 'then waits for the visitor' : 'then continues'}</span>
      <span class="grow"></span>
      ${preview ? '' : `<button class="btn xs" data-act="add-shot-menu" data-occ="${occ.id}" id="addShotBtn">+ Cut</button><button class="btn xs" data-act="add-use-menu" data-occ="${occ.id}" id="addUseBtn">+ Use</button>`}
    </div>
    ${S.drawer.open ? `<div class="dr-body">${lens === 'still' ? still(p, occ, sch) : lens === 'clock' ? clock(p, occ, sch) : beats(p, occ, sch, preview)}</div>` : ''}`;
}

function worldRow() {
  return `<div class="beat k-world" role="listitem"><span class="b-ico ico-world" aria-hidden="true"></span>
    <span class="b-txt"><b>World</b> Rotor spin (Pump A, Pump B) keeps its own clock — this Stop can’t pause, cut or restart it.</span>
    ${dchip('Scene', 'Scene ambient')}</div>`;
}

function relControl(p, occ, b, i, preview) {
  if (i === 0) return '<span class="b-rel">starts the Stop</span>';
  if (preview) return `<span class="b-rel">${esc(relWords(p, occ, b))}</span>`;
  const says = occ.beats.slice(0, i).filter((x) => x.kind === 'say');
  const cues = says.flatMap((s) => (s.cues || []).map((c) => ({ beat: s.id, name: c.name, t: c.t })));
  const val = b.rel === 'cue' ? 'cue:' + b.cue?.beat + ':' + b.cue?.name : b.rel;
  return `<label class="b-rel"><span class="sr">Starts</span><select data-field="beat-rel" data-occ="${occ.id}" data-id="${b.id}" aria-label="When this beat starts">
    <option value="then" ${val === 'then' ? 'selected' : ''}>after the previous beat</option>
    <option value="with" ${val === 'with' ? 'selected' : ''}>with the previous beat</option>
    ${cues.map((c) => `<option value="cue:${c.beat}:${esc(c.name)}" ${val === 'cue:' + c.beat + ':' + c.name ? 'selected' : ''}>at “${esc(c.name)}” in the words (${secs(c.t)})</option>`).join('')}
    ${says.length && b.kind === 'shot' ? '<option value="newcue">during the words — add a cue…</option>' : ''}
  </select></label>`;
}

function beats(p, occ, sch, preview) {
  const rows = sch.items.map((it, i) => {
    const b = it.beat;
    const sel = !preview && S.sel?.kind === 'beat' && S.sel.id === b.id;
    let what = '', opt = '', flag = '';
    if (b.kind === 'shot') {
      const v = p.camera.views[b.view];
      what = `<b>Shot</b> ${esc(v?.name)} <span class="own">${v?.framing === 'locked' ? 'locked' : 'follows subject'}</span>`;
      opt = preview ? `<span class="b-opt">${b.move === 'travel' ? 'travel' : 'cut'}</span>` : `<span class="b-opt seg mini" role="radiogroup" aria-label="Transition">
        <button role="radio" aria-checked="${b.move !== 'travel'}" class="${b.move !== 'travel' ? 'on' : ''}" data-act="beat-move" data-occ="${occ.id}" data-id="${b.id}" data-v="cut">Cut</button>
        <button role="radio" aria-checked="${b.move === 'travel'}" class="${b.move === 'travel' ? 'on' : ''}" data-act="beat-move" data-occ="${occ.id}" data-id="${b.id}" data-v="travel">Travel</button></span>`;
      if (it.gap) flag = `<span class="b-flag f-err" title="No Camera route">✕ no route — travel impossible</span>`;
      else if (b.move === 'travel' && it.route) flag = `<span class="b-flag f-ok">route ${it.route.legs.map((l) => l.route).join('→')}</span>`;
    } else if (b.kind === 'use') {
      const u = it.use;
      what = `<b>Use</b> ${esc(u.def.name)} <span class="on-subj">on ${esc(p.scene.inst[b.subject].name)}</span>`;
      opt = `<span class="b-opt mono">${u.localSpeed ? `<span class="tag own">${times(u.speed)} this use</span>` : times(u.speed)} · ${u.localSep ? `<span class="tag own">${metres(u.sep)}</span>` : metres(u.sep)}</span>`;
      const hit = D.wallHit(p, b.subject, u.sep);
      if (hit) flag = `<span class="b-flag f-err">✕ passes through ${hit.wall}</span>`;
    } else if (b.kind === 'say') {
      what = `<b>Words</b> <span class="quote">“${esc((b.text || '…').slice(0, 64))}${(b.text || '').length > 64 ? '…' : ''}”</span>`;
      opt = `<span class="b-opt mono">${secs(b.dur)}</span>`;
      if (it.crossings?.length) flag = b.crossCut ? `<span class="b-flag f-ok">${b.crossCut === 'continue' ? 'keeps speaking across the cut' : 'stops at the cut'}</span>` : '<span class="b-flag f-decide">? crosses a cut — decide</span>';
    } else if (b.kind === 'hold') { what = '<b>Wait</b>'; opt = `<span class="b-opt mono">${secs(b.dur)}</span>`; }
    const decide = b.kind === 'say' && it.crossings?.length && !b.crossCut && !preview ? `<div class="b-decide" role="group" aria-label="Words at the cut">
        <span>The camera cuts to “${esc(D.viewName(p, it.crossings[0].beat.view))}” at ${secs(it.crossings[0].start)} while these words play.</span>
        <button class="btn xs" data-act="cross" data-occ="${occ.id}" data-id="${b.id}" data-v="continue">Keep speaking across the cut</button>
        <button class="btn xs" data-act="cross" data-occ="${occ.id}" data-id="${b.id}" data-v="end">Stop at the cut</button></div>` : '';
    return `<div class="beat k-${b.kind}${sel ? ' sel' : ''}" role="listitem" data-beat="${b.id}">
      <button class="b-main" data-act="${preview ? 'noop' : 'beat'}" data-occ="${occ.id}" data-id="${b.id}" data-fk="beat:${b.id}" ${preview ? 'tabindex="-1"' : ''}>
        <span class="b-n">${i + 1}</span><span class="b-ico ico-${b.kind}" aria-hidden="true"></span><span class="b-txt">${what}</span></button>
      ${relControl(p, occ, b, i, preview)}${opt}
      <span class="b-time mono">${secs(it.start)}${it.dur ? '–' + secs(it.end) : ''}</span>${flag}
      ${decide}</div>`;
  }).join('');
  const states = occ.states.length ? `<div class="beat k-state" role="listitem"><span class="b-ico ico-state" aria-hidden="true"></span>
      <span class="b-txt"><b>Held all Stop</b> ${occ.states.map((s) => `<button class="linkish" data-act="state" data-occ="${occ.id}" data-id="${s.id}">${esc(s.label)}${s.ch.endsWith('.casing') ? ' · ' + metres(s.v) : ''}</button>`).join(', ')}</span>
      ${!preview && occ.states.some((s) => s.ch.endsWith('.casing')) ? `<button class="btn xs" data-act="animate" data-occ="${occ.id}" data-id="${occ.states.find((s) => s.ch.endsWith('.casing')).id}">Animate with “Open casing”</button>` : ''}</div>` : '';
  return `<div class="beats" role="list" aria-label="Beats of this Stop">${states}${rows}${worldRow()}</div>`;
}

function still(p, occ, sch) {
  const e = D.evalStop(p, occ, sch.length);
  const uses = D.usesIn(occ);
  const cuts = sch.shots.length - 1;
  const moments = [];
  if (uses.length) moments.push(uses.map((b) => '“' + p.res.perfs[b.perf].name + '” plays on ' + p.scene.inst[b.subject].name).join(', '));
  if (cuts) moments.push('the camera cuts ' + (cuts === 1 ? 'once' : cuts + ' times'));
  const say = sch.items.find((i) => i.beat.kind === 'say');
  if (say?.crossings?.length) moments.push('the words ' + (say.beat.crossCut === 'end' ? 'stop at the cut' : 'run across it'));
  return `<div class="still">
    <img class="still-img" alt="" src="${stopThumb(occ)}">
    <div class="still-body">
      <div class="still-k">${D.isTimed(occ) ? 'The waiting moment' : 'A still moment'}</div>
      <dl>
        <dt>Shot</dt><dd>${esc(D.viewName(p, D.lastShotView(occ)))}</dd>
        <dt>Shows</dt><dd>${Object.entries(e.ch).filter(([, v]) => v > 0.02).map(([c, v]) => c === 'bay.cutaway' ? 'Bay cutaway' : esc(D.instName(p, c.split('.')[0])) + ' casing ' + metres(v)).join(' · ') || 'the world as it is'}</dd>
        <dt>Words</dt><dd>${esc((D.sayOf(occ)?.text || '—').slice(0, 120))}</dd>
        <dt>Then</dt><dd>${occ.cont === 'hold' ? 'waits for the visitor' : 'continues'}</dd>
      </dl>
      ${D.isTimed(occ) ? `<p class="endpoints"><b>Endpoints don’t describe everything.</b> Over ${secs(sch.length)}, ${moments.join('; ')} — and the rotor keeps its own clock throughout. Use Beats or Clock to see how.</p>`
        : `<p class="endpoints">No timing: the Stop shows its view and states, then waits. <button class="linkish" data-act="lens" data-v="beats">Add timing in Beats</button> when something needs to happen over time.</p>`}
    </div></div>`;
}

function clock(p, occ, sch) {
  const L = Math.max(4, Math.ceil(sch.length + 1));
  const x = (t) => ((t / L) * 100).toFixed(3) + '%';
  const w = (a, b) => (((b - a) / L) * 100).toFixed(3) + '%';
  const ticks = Array.from({ length: L + 1 }, (_, i) => `<span class="tick" style="left:${x(i)}">${i}s</span>`).join('');
  const shots = sch.shots.map((s, i) => {
    const end = sch.shots[i + 1]?.start ?? sch.length;
    const v = p.camera.views[s.beat.view];
    return `${s.dur ? `<div class="bar travel${s.gap ? ' gap' : ''}" style="left:${x(s.start)};width:${w(s.start, s.end)}" title="Travel">travel</div>` : ''}
      <div class="bar shot${s.gap ? ' gap' : ''}" style="left:${x(s.start + s.dur)};width:${w(s.start + s.dur, Math.max(end, s.start + s.dur + 0.05))}" data-act="beat" data-occ="${occ.id}" data-id="${s.beat.id}">${i ? '<i class="cutmark">▸</i>' : ''}${esc(v?.name)}${s.gap ? ' · no route' : ''}</div>`;
  }).join('');
  const uses = sch.items.filter((i) => i.beat.kind === 'use').map((it) => `<div class="bar use${D.wallHit(p, it.beat.subject, it.use.sep) ? ' err' : ''}" style="left:${x(it.start)};width:${w(it.start, it.end)}" data-act="beat" data-occ="${occ.id}" data-id="${it.beat.id}">
      ${esc(it.use.def.name)} · ${esc(p.scene.inst[it.beat.subject].name)} <span class="mono">${times(it.use.speed)}</span>
      <span class="retime" data-retime="${it.beat.id}" data-occ="${occ.id}" data-start="${it.start}" data-base="${it.use.def.duration}" data-len="${L}" title="Drag to retime this use only" aria-hidden="true"></span></div>`).join('');
  const says = sch.items.filter((i) => i.beat.kind === 'say').map((it) => `<div class="bar say${it.crossings?.length && !it.beat.crossCut ? ' decide' : ''}" style="left:${x(it.start)};width:${w(it.start, Math.max(it.end, it.start + 0.05))}" data-act="beat" data-occ="${occ.id}" data-id="${it.beat.id}">“${esc((it.beat.text || '').slice(0, 48))}…”
      ${(it.beat.cues || []).map((c) => `<i class="cue" style="left:${((c.t / Math.max(0.01, it.cutShort ? it.cutShort - it.start : it.dur)) * 100).toFixed(2)}%" title="Cue “${esc(c.name)}”"></i>`).join('')}</div>
      ${it.cutShort ? `<div class="bar say ghosted" style="left:${x(it.end)};width:${w(it.end, it.cutShort)}">(stopped at the cut)</div>` : ''}`).join('');
  const states = occ.states.map((s) => `<div class="bar state" style="left:0;width:100%">${esc(s.label)} — held all Stop</div>`).join('');
  return `<div class="clock" data-len="${L}">
    <div class="c-ruler">${ticks}</div>
    <div class="c-lane"><span class="c-k">Camera</span><div class="c-track" data-scrub="${occ.id}" data-len="${L}">${shots}</div></div>
    <div class="c-lane"><span class="c-k">Uses</span><div class="c-track" data-scrub="${occ.id}" data-len="${L}">${states}${uses || '<span class="c-none">no performance uses</span>'}</div></div>
    <div class="c-lane"><span class="c-k">Words</span><div class="c-track" data-scrub="${occ.id}" data-len="${L}">${says}</div></div>
    <div class="c-lane world"><span class="c-k">World</span><div class="c-track"><div class="bar world"><span>↤</span> Rotor spin · own clock — starts before this Stop and continues after it <span>↦</span></div></div></div>
    <div class="c-play" id="cPlay" style="left:calc(84px + (100% - 84px) * ${((S.scrub ?? sch.length) / L).toFixed(4)})"><span class="mono" id="cPlayT">${secs(S.scrub ?? sch.length)}</span></div>
    <div class="c-note">Drag across a lane to look at a moment (authoring preview, not a run). Drag the end of a use to retime <b>that use only</b>.</div>
  </div>`;
}
