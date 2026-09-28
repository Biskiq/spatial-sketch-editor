// Preview: the visitor runtime inside the Paper (its own visual identity, no
// editor chrome) and the creator's run panel beside it (who controls what, the
// run-state map, what happened, and a source check).

import { S, app } from './state.js';
import * as D from './derive.js';
import * as RUN from './run.js';
import { esc, secs, metres } from './util.js';
import { P } from './actions.js';
import { life, dchip } from './ui.js';

const $ = (id) => document.getElementById(id);

export function renderVisitor() {
  const el = $('visitor');
  const on = S.mode === 'preview' && app.R;
  el.hidden = !on;
  if (!on) return;
  const R = app.R;
  const p = R.P;
  const occ = p.occ[R.stops[R.i]];
  const n = R.stops.length;
  const exp = p.exp.list[R.expId];
  const looking = R.status === 'looking';
  const dots = R.stops.map((_, i) => `<i class="${i < R.i ? 'done' : i === R.i ? 'cur' : ''}"></i>`).join('');
  const ctlSubjects = looking ? Object.values(p.scene.inst).map((inst) => {
    const c = inst.id + '.casing';
    const yours = R.handoff[c] === 'visitor';
    return `<div class="v-subj" data-inst="${inst.id}"><span class="v-sn">${esc(inst.name)} casing${yours ? ' <em>· yours</em>' : ''}</span>
      <button class="v-btn sm" data-act="run-casing" data-inst="${inst.id}" data-op="open">Open</button>
      <button class="v-btn sm" data-act="run-casing" data-inst="${inst.id}" data-op="close">Close</button></div>`;
  }).join('') : '';
  const k = R.conflict;
  const conflict = k ? `<div class="v-conflict" role="alertdialog" aria-labelledby="vcT" aria-describedby="vcD">
      <div class="v-ct" id="vcT">${k.owner.kind === 'use' && k.owner.p < 1 ? 'The tour is opening this casing.' : 'The tour is holding this casing open.'}</div>
      <p id="vcD">You asked to ${k.op} ${esc(p.scene.inst[k.inst].name)}’s casing. Only one of you can control it at a time.</p>
      <button class="v-choice" data-act="run-resolve" data-v="handoff" data-fk="vc-hand"><b>Take it over</b><span>It’s yours while you look around; the tour takes it back when you return.</span></button>
      <button class="v-choice" data-act="run-resolve" data-v="stop"><b>Close it and stop the opening</b><span>For this visit only. Restart brings it back.</span></button>
      <button class="v-choice" data-act="run-resolve" data-v="yield"><b>Leave it to the tour</b><span>Nothing changes.</span></button></div>` : '';
  const ready = R.status === 'ready';
  const ended = R.status === 'ended';
  const say = D.sayOf(occ);
  el.innerHTML = `
    <div class="v-top"><div class="v-exp">${esc(exp.name)}</div><div class="v-dots" role="img" aria-label="Stop ${R.i + 1} of ${n}">${dots}</div></div>
    <div class="v-label" id="vLabel" hidden></div>
    <div class="v-pulse" id="vPulse" hidden></div>
    ${R.reduced ? '<div class="v-rotor"><i class="spin still" aria-hidden="true"></i>Rotor running (shown still)</div>' : ''}
    ${looking ? `<div class="v-look" role="status"><span>You’re looking around. The tour is paused where you left it.</span><button class="v-btn light" data-act="run-back" data-fk="v-back">Back to the tour</button></div>
      <div class="v-subjects" aria-label="Things you can operate">${ctlSubjects}<p class="v-hint">Drag to look · arrow keys turn · +/− zoom</p></div>` : ''}
    ${ready ? `<div class="v-start"><div class="v-st-k">${n} stops</div><div class="v-st-t">${esc(exp.name)}</div><p>An explanation of the pump bay. Pause any time to look around.</p>
        <button class="v-btn main" data-act="run" data-v="play" data-fk="v-start">Start</button></div>` : ''}
    ${ended ? `<div class="v-start"><div class="v-st-t">End of the tour</div><p>Thanks for visiting.</p><button class="v-btn main" data-act="run" data-v="restart" data-fk="v-restart">Start again</button></div>` : ''}
    ${!ready && !ended ? `<div class="v-card${looking ? ' dim' : ''}">
      <div class="v-title">${esc(occ.title)}</div>
      <p class="v-text">${esc(say?.text || '')}</p>
      <div class="v-prog" aria-hidden="true"><span id="vProg"></span></div>
      <div class="v-ctl">
        <button class="v-btn" data-act="run" data-v="prev" aria-label="Previous stop" ${R.i === 0 || looking ? 'disabled' : ''}>‹</button>
        <button class="v-btn main" data-act="run" data-v="toggle" data-fk="v-toggle" ${looking ? 'disabled' : ''}>${R.status === 'playing' || R.status === 'rejoining' ? '❚❚ Pause' : '▶ Play'}</button>
        <button class="v-btn" data-act="run" data-v="look" data-fk="v-look" ${looking ? 'disabled' : ''}>Look around</button>
        <span class="grow"></span>
        <button class="v-btn next${R.waiting ? ' ready' : ''}" data-act="run" data-v="next" data-fk="v-next" ${looking ? 'disabled' : ''}>${R.i === n - 1 ? 'Finish' : 'Next ›'}</button>
      </div></div>` : ''}
    ${conflict}
    <div class="v-summary" id="vSummary" hidden></div>`;
}

const STATES = [
  { id: 'ready', label: 'Ready', x: 4, y: 10, w: 70 },
  { id: 'playing', label: 'Playing', x: 108, y: 10, w: 76 },
  { id: 'paused', label: 'Paused', x: 212, y: 10, w: 70 },
  { id: 'looking', label: 'Looking around', x: 152, y: 80, w: 112 },
  { id: 'rejoining', label: 'Rejoining', x: 12, y: 80, w: 84 },
  { id: 'ended', label: 'Ended', x: 108, y: 148, w: 76 },
];

function stateMap() {
  const box = (s) => `<g class="sm-n" data-state="${s.id}"><rect x="${s.x}" y="${s.y}" width="${s.w}" height="24" rx="4"/><text x="${s.x + s.w / 2}" y="${s.y + 16}">${s.label}</text></g>`;
  const e = (d) => `<path class="sm-e" d="${d}" marker-end="url(#smA)"/>`;
  const l = (x, y, t, a = 'middle') => `<text class="sm-l" x="${x}" y="${y}" text-anchor="${a}">${t}</text>`;
  return `<svg class="smap" viewBox="0 0 290 202" role="img" aria-label="Run states: ready, playing, paused, looking around, rejoining, ended. Restart makes a fresh run; exit discards it.">
    <defs><marker id="smA" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L8,4 L0,8 z" class="sm-ah"/></marker></defs>
    ${e('M74,22 L106,22')}${l(90, 44, 'play')}
    ${e('M184,17 L210,17')}${l(197, 7, 'pause')}
    ${e('M212,28 L186,28')}${l(199, 44, 'play')}
    ${e('M170,34 L198,78')}${l(176, 62, 'look', 'end')}
    ${e('M248,34 L240,78')}${l(250, 60, 'look', 'start')}
    ${e('M152,92 L98,92')}${l(125, 108, 'back')}
    ${e('M58,80 L112,36')}${l(56, 58, 'resumes', 'end')}
    ${e('M146,34 L146,146')}${l(142, 132, 'last Next', 'end')}
    ${STATES.map(box).join('')}
    <text class="sm-l ext" x="4" y="188">Restart → a fresh run from any state</text>
    <text class="sm-l ext" x="4" y="199">Exit preview → authoring; the run is discarded, nothing is written</text>
  </svg>`;
}

export function renderRunPanel() {
  const R = app.R;
  const p = R.P;
  const base = Object.values(P().scene.inst).map((i) => `${esc(i.name)} casing <b>${i.baseline.casing === 0 ? 'closed' : metres(i.baseline.casing)}</b>`).join(' · ');
  const sum = R.summary ? `<section class="isec"><h3>While you looked around</h3><ul class="sumlist">${R.summary.items.map((s) => `<li class="sk-${s.k}"><span class="sk">${{ continued: 'Continued', paused: 'Paused', rejoin: 'Rejoin', stopped: 'Stopped', unchanged: 'Unchanged' }[s.k]}</span>${esc(s.text)}</li>`).join('')}</ul></section>` : '';
  return `
    <div class="ih"><div class="ih-k"><span class="eng">Preview run</span>${life('run', 'Run #' + R.id)}<span class="ref">rev ${R.rev}</span></div>
      <div class="ih-name">${esc(p.exp.list[R.expId].name)}</div>
      <div class="ih-sub" id="rpNow"></div></div>
    <section class="isec"><h3>Transport</h3><div class="transport">
      <button class="btn sm" data-act="run" data-v="restart" title="Restart (R)">⟲ Restart</button>
      <button class="btn sm" data-act="run" data-v="toggle" title="Play / pause (Space)">${R.status === 'playing' || R.status === 'rejoining' ? '❚❚ Pause' : '▶ Play'}</button>
      <button class="btn sm" data-act="run" data-v="next" title="Next (→)">Next ›</button>
      ${R.status === 'looking' ? '<button class="btn sm primary" data-act="run-back">Back to the tour</button>' : `<button class="btn sm" data-act="run" data-v="look" ${R.status === 'playing' || R.status === 'paused' ? '' : 'disabled'} title="Look around (L)">Look around</button>`}
    </div></section>
    <section class="isec"><h3>Who controls what</h3><table class="own" id="rpOwn" aria-live="off"></table>
      <p class="small quiet">Pausing the tour holds what the tour owns. World activity is not the tour’s to pause.</p></section>
    <section class="isec"><h3>Run states</h3>${stateMap()}</section>
    ${sum}
    <section class="isec"><h3>What happened</h3><ol class="rlog" id="rpLog"></ol></section>
    <section class="isec"><h3>Source check</h3><p class="small">Scene baseline: ${base}. Project revision ${P().rev} — ${P().rev === R.rev ? 'unchanged by this run' : 'changed elsewhere'} ✓</p>
      <p class="small quiet">Held poses, handoffs and visitor choices live only in this run. Restart gives a fresh run; it never rewrites Scene defaults.</p></section>
    <div class="i-actions"><button class="btn sm" data-act="exit-preview">Exit preview</button></div>`;
}

let lastLog = -1;
export function frameRunPanel(out) {
  const R = app.R;
  if (!R || S.mode !== 'preview') return;
  const occ = out.occ;
  const now = $('rpNow');
  if (now) now.textContent = R.status === 'ready' ? 'Ready — press Start in the visitor frame' : R.status === 'ended' ? 'Ended' : 'Stop ' + (R.i + 1) + ' of ' + R.stops.length + ' · “' + occ.title + '” · ' + secs(R.t) + ' · ' + ({ playing: R.waiting ? 'waiting for Next' : 'playing', paused: 'paused', looking: 'looking around', rejoining: 'rejoining' }[R.status] || R.status);
  const own = $('rpOwn');
  if (own) own.innerHTML = RUN.ownership(R, out).map((r) => `<tr><th scope="row">${esc(r.what)}</th><td><span class="who">${esc(r.who)}</span><span class="nt">${esc(r.note || '')}</span></td><td><span class="stt st-${r.state}">${esc(r.state)}</span></td></tr>`).join('');
  const log = $('rpLog');
  if (log && (lastLog !== R.log.length + R.id * 1000 || !log.childElementCount)) {
    lastLog = R.log.length + R.id * 1000;
    log.innerHTML = R.log.map((l) => `<li class="lk-${l.kind}"><span class="mono">${esc(l.at)}</span>${esc(l.text)}</li>`).join('');
  }
  document.querySelectorAll('.smap .sm-n').forEach((g) => g.classList.toggle('on', g.dataset.state === R.status));
}

export function frameVisitor(out) {
  const R = app.R;
  if (!R || S.mode !== 'preview') return;
  const prog = $('vProg');
  if (prog && out.say) prog.style.width = (out.say.p * 100).toFixed(1) + '%';
  const lab = $('vLabel');
  if (lab) {
    const show = R.label && R.clock - R.label.t0 < 2.2 && R.status !== 'ready' && (R.reduced ? R.label.travel : false);
    lab.hidden = !show;
    if (show) lab.textContent = 'Now at: ' + R.label.text;
  }
  const pul = $('vPulse');
  if (pul) { pul.hidden = !out.pulse; if (out.pulse) pul.textContent = out.pulse.text; }
  const sm = $('vSummary');
  if (sm) {
    const show = R.summary && R.clock - R.summary.at < 4.5;
    sm.hidden = !show;
    if (show && !sm.textContent) sm.textContent = 'Back on the tour. ' + (R.summary.items.find((i) => i.k === 'rejoin') ? 'The casing is the tour’s again.' : 'Everything is where the tour left it.');
    if (!show) sm.textContent = '';
  }
}
