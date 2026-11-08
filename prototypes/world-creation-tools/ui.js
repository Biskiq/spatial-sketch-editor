'use strict';
/*
 * World creation tools — the shell around the Stage.
 * Dock, palette, Card, Spec drawer, consequence tokens, live tags and the prototype's own
 * controls. Product chrome and prototype chrome are kept visibly apart: the dark strip at
 * the very top and the readout in the lower left are instruments for reviewing the
 * proposal, not proposed product UI.
 */

const $ = (s, r = document) => r.querySelector(s);
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const OWNER_LABEL = { walls: 'Layout', rooms: 'Layout', openings: 'Layout', roofs: 'Layout', buildings: 'Layout', stairs: 'Layout', objects: 'Scene', art: 'Scene', lights: 'Scene', paths: 'Needs an owner' };
const KIND_NAME = { walls: 'Wall', rooms: 'Room (derived)', openings: 'Opening', roofs: 'Roof', buildings: 'Placed building', stairs: 'Stair', objects: 'Object', art: 'Artwork', lights: 'Light', paths: 'Path' };

/* Suggestions for a reviewer, per tool, phrased against the seeded scenarios. */
const TRY = {
  select: ['Click the Cottage, then drag the gold square above its roof up or down to change storeys.', 'Select a garden wall and pull the gold knob on its top to bend it.', 'Drag empty ground to orbit. Space-drag orbits from anywhere; wheel zooms.'],
  walls: ['Pick Circle (4) and drag out a round room on open ground.', 'Draw a Line across the Garden path: a doorway is proposed where they cross. Click the token after release to drop it.', 'Draw a wall into the Cottage: the crossing part turns red with a reason.'],
  building: ['Drag a Box on the hill to the east: choose Plinth or Level the ground on the token.', 'Draw a footprint across the Garden path to get a door where it meets.', 'Circle (4) makes a round tower with a cone roof.'],
  opening: ['Hover the Tower: the opening lands on the storey you point at.', 'Try a door on an upper storey to see the refusal.', 'Arch (3) through a gallery wall connects two rooms.'],
  roof: ['Draw a closed Box of walls (W, then 3), switch to Roof and hover inside it.', 'Pick Gable and hover a round room: it refuses and suggests Dome.'],
  stair: ['Hillside scenario: drag from the foot of the terrace up onto it.', 'Drag across flat ground: nothing to climb, so it refuses.'],
  object: ['Move a bench close to a wall: it backs onto it as placement only, with no attachment.', 'Press and drag to turn it as you place; R turns 15°.'],
  art: ['Gallery: drag along a long wall for a row. It skips the door and says so.', 'Hover a garden wall: too low to hang.'],
  light: ['Drag the sun across the sky arc to dusk, or click a point on the arc.', 'Place a Spot near a painting, then change the token after release: once, keep aimed, or not aimed.', 'A pendant outside a room refuses: nothing to hang from.'],
  ground: ['Hold over open ground to raise it; Shift lowers. [ and ] change the brush.', 'Brush beside the Cottage: it keeps its datum and says so.', 'Terrace: drag a shape, move up to lift it, click to set.'],
  path: ['Draw from the Cottage across the meadow to the garden wall: a gate, steps or a bridge are proposed where they happen.', 'After release, click a token to change it. Still one undo step.'],
  water: ['Paint a pond across the Garden path: a bridge token appears after the stroke.', 'Stream (2): drag a stroke down the hill.'],
  plants: ['Hold to scatter trees; they skip the path, the pond and the buildings.', 'Click once for a single plant. Shift-hold clears.'],
  paint: ['Reach: Room or building, then click the Cottage. It asks: only this one, or every Cottage.', 'Hold Alt over a wall to sample its material.', 'Paint the ground: brush with Lawn or Gravel.'],
  erase: ['Hover a garden wall: the tag names what goes with it.', 'Erase the Garden path: its gate stays as an ordinary opening.', 'Click inside a room: rooms come from walls, so it refuses.'],
  measure: ['Drag between two points. Readings are never saved.'],
  slice: ['Unchanged from the approved sheet.'],
};

const UI = {
  ready: false, paletteOpen: true, dockMode: 'families', openFamily: 'build', view: 'stage', spec: false, scenario: 'village',
  famLast: { build: 'walls', furnish: 'object', land: 'ground' }, lastTool: null, trySeq: 0,
  sig: {}, els: {}, toks: new Map(), toastT: null,

  init() {
    this.els = { dock: $('#dock'), palette: $('#palette'), head: $('#head'), headR: $('#headR'), card: $('#card'), spec: $('#spec'), readout: $('#readout'), overlay: $('#overlay'), tag: $('#tag'), toasts: $('#toasts'), stageView: $('#stageView'), sheetView: $('#sheetView') };
    document.addEventListener('click', (e) => this.onClick(e));
    document.addEventListener('change', (e) => this.onChange(e));
    window.addEventListener('keydown', (e) => { if (this.view === 'stage') { onKey(e); this.sync(); } });
    window.addEventListener('keyup', (e) => { if (this.view === 'stage') onKeyUp(e); });
    window.addEventListener('resize', () => { resizeStage(); VIEW.dirty = true; });
    window.addEventListener('hashchange', () => this.route());
    this.ready = true;
  },

  route() {
    const [a, b] = location.hash.replace(/^#/, '').split('/');
    const scn = SCENARIOS[a] ? a : this.scenario;
    if (scn !== this.scenario || !this.loaded) { this.scenario = scn; loadScenario(scn); this.loaded = true; $('#scenario').value = scn; }
    if (a === 'sheet') { this.setView('sheet'); return; }
    this.setView('stage');
    if (b && TOOLS[b]) armTool(b);
    this.sync();
  },
  updateHash() {
    const h = this.view === 'sheet' ? '#sheet' : `#${this.scenario}${T.tool !== 'select' ? '/' + T.tool : ''}`;
    if (location.hash !== h) history.replaceState(null, '', h);
  },
  setView(v) {
    this.view = v;
    this.els.stageView.hidden = v !== 'stage'; this.els.sheetView.hidden = v !== 'sheet';
    document.querySelectorAll('[data-view]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.view === v));
    if (v === 'sheet' && !this.sheetDone) { SHEET.render(this.els.sheetView); this.sheetDone = true; }
    if (v === 'stage') { requestAnimationFrame(() => { resizeStage(); VIEW.dirty = true; }); }
    this.updateHash();
  },

  // ── events ────────────────────────────────────────────────────────────────
  onClick(e) {
    const el = e.target.closest('[data-tool],[data-family],[data-opt],[data-action],[data-view],[data-sel],[data-edit],[data-tok]');
    if (!el) return;
    const d = el.dataset;
    if (d.view) { this.setView(d.view); return; }
    if (d.tool) { armTool(d.tool); this.sync(); return; }
    if (d.family) {
      if (this.dockMode === 'families' && this.openFamily === d.family && TOOLS[T.tool].family === d.family) { this.openFamily = null; this.sync(); return; }
      this.openFamily = d.family; armTool(this.famLast[d.family]); this.sync(); return;
    }
    if (d.opt) { setOpt(d.opt, d.v); this.sync(); return; }
    if (d.sel) { selectId(d.sel); return; }
    if (d.edit) { CARD_EDITS[d.edit](d.id, d.v, d.i); this.sync(); return; }
    if (d.tok) { this.amendToken(d.tok); return; }
    const a = d.action;
    if (a === 'undo') doUndo();
    else if (a === 'redo') doRedo();
    else if (a === 'plan') { setPlan(!VIEW.plan); this.sync(); }
    else if (a === 'spec') { this.spec = !this.spec; document.body.classList.toggle('spec-open', this.spec); this.sync(); }
    else if (a === 'palette') { this.paletteOpen = !this.paletteOpen; this.sync(); }
    else if (a === 'dock') { this.dockMode = d.v; this.sync(); }
    else if (a === 'reset') { loadScenario(this.scenario); armTool('select'); this.toast('Scenario reset'); }
    else if (a === 'library') this.toast('The Library opens as an Instrument above the dock. Not prototyped here.');
    else if (a === 'readout') { this.roMin = !this.roMin; this.sync(); }
    else if (a === 'try') { this.trySeq++; this.sig.readout = null; this.sync(); }
    else if (a === 'card-close') selectId(null);
  },
  onChange(e) {
    if (e.target.id === 'scenario') { this.scenario = e.target.value; loadScenario(this.scenario); armTool('select'); this.updateHash(); }
  },
  amendToken(id) {
    if (!T.amend) return;
    const c = T.amend.cons.find((x) => x.id === id); if (!c || c.info) return;
    if (c.options) c.choice = c.options[(c.options.indexOf(c.choice) + 1) % c.options.length];
    else c.accepted = c.accepted === false;
    T.amend.redo();
    const text = c.options ? c.labels[c.choice] : `${c.accepted ? '' : 'No '}${c.accepted ? c.label : c.label[0].toLowerCase() + c.label.slice(1)}`;
    this.toast(`Amended the last step · ${text}`);
    VIEW.dirty = true; this.sync();
  },

  // ── rendering ────────────────────────────────────────────────────────────
  gate(key, sig, fn) { if (this.sig[key] === sig) return; this.sig[key] = sig; fn(); },
  sync() {
    if (!this.ready) return;
    if (T.tool !== this.lastTool) {
      const fam = TOOLS[T.tool].family;
      if (fam) { this.famLast[fam] = T.tool; if (this.dockMode === 'families') this.openFamily = fam; }
      this.lastTool = T.tool; this.trySeq = 0;
    }
    this.renderDock(); this.renderPalette(); this.renderHead(); this.renderReadout(); this.renderCard(); this.renderSpec();
    document.body.dataset.armed = T.tool;
    this.updateHash();
  },

  renderDock() {
    this.gate('dock', [T.tool, this.dockMode, this.openFamily].join('|'), () => {
      const key = (id) => {
        const t = TOOLS[id], on = T.tool === id;
        return `<button class="key${on ? ' armed' : ''}${t.disabled ? ' off' : ''}" data-tool="${id}" aria-pressed="${on}" title="${esc(t.name)} (${t.key})${t.disabled ? ' · unchanged, not prototyped' : ''}">${icon(t.icon, 22)}<span class="kl">${t.name}</span><kbd>${t.key}</kbd></button>`;
      };
      let html = `<div class="dg">${UTILITY_LEFT.map(key).join('')}</div><i class="ds"></i>`;
      if (this.dockMode === 'families') {
        html += FAMILIES.map((f) => {
          const open = this.openFamily === f.id, holds = TOOLS[T.tool].family === f.id;
          return `<div class="fam${open ? ' open' : ''}" style="--mark:${f.mark}"><button class="famkey${holds ? ' holds' : ''}" data-family="${f.id}" aria-expanded="${open}" title="${esc(f.name)}: ${esc(f.blurb)}">${icon(f.icon, 22)}<span class="kl">${f.name}</span>${open ? '' : `<em>${f.tools.length}</em>`}</button>${open ? `<div class="famtools">${f.tools.map(key).join('')}</div>` : ''}</div>`;
        }).join('');
      } else {
        html += FAMILIES.map((f) => `<div class="fam flat" style="--mark:${f.mark}" title="${esc(f.name)}">${f.tools.map(key).join('')}</div>`).join('');
      }
      html += `<i class="ds"></i><div class="dg">${UTILITY_RIGHT.map(key).join('')}</div><i class="ds"></i><div class="dg quiet">${INSPECT.map(key).join('')}</div><i class="ds"></i><button class="key lib" data-action="library" title="Library">${icon('library', 22)}<span class="kl">Library</span></button>`;
      this.els.dock.innerHTML = html;
      this.els.dock.dataset.mode = this.dockMode;
      document.querySelectorAll('[data-action="dock"]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.v === this.dockMode));
    });
  },

  paletteHint() {
    const t = TOOLS[T.tool], has = (id) => (t.palette || []).some((g) => g.id === id);
    if (T.tool === 'ground' && opt('brush') === 'terrace') return 'Drag a shape, then move up or down to set its height. Click to set it.';
    if (T.tool === 'water') return opt('mode') === 'stream' ? 'Drag a stroke. The stream follows the ground down.' : 'Hold to paint a pond. It keeps its level and fills what it meets.';
    if (has('shape')) return SHAPES[opt('shape')].hint;
    return t.gesture;
  },
  renderPalette() {
    const t = TOOLS[T.tool];
    this.gate('pal', [T.tool, JSON.stringify(T.opts[T.tool] || {}), this.paletteOpen].join('|'), () => {
      const el = this.els.palette, groups = t.palette || [];
      el.style.setProperty('--mark', t.family ? FAMILIES.find((f) => f.id === t.family).mark : '#f3f0e4');
      if (!this.paletteOpen) {
        const sum = groups.filter((g) => g.kind !== 'action').map((g) => { const o = g.options.find((x) => x.v === opt(g.id)); return o ? o.label.split(' · ')[0].split(' (')[0] : ''; }).filter(Boolean).join(', ');
        el.className = 'palette collapsed';
        el.innerHTML = `<button class="paltab" data-action="palette" title="Open the palette">${icon(t.icon, 16)}<b>${t.name}</b>${sum ? `<span>${esc(sum)}</span>` : ''}${icon('chevron-up', 14)}</button>`;
        return;
      }
      el.className = 'palette';
      const groupHtml = (g) => {
        if (g.kind === 'action') return `<div class="grp"><button class="act" data-action="${g.id}" title="${esc(g.note || g.text)}">${icon(g.icon, 18)}<span>${g.text}</span></button></div>`;
        const cur = opt(g.id), curO = g.options.find((o) => o.v === cur);
        const lab = `<span class="gl">${g.label}<b>${esc(curO ? curO.label : '')}</b></span>`;
        if (g.kind === 'swatch') {
          let prevFor = null;
          const sw = g.options.map((o) => {
            const m = MATERIALS[o.v], gap = m && prevFor && m.for !== prevFor ? '<i class="swgap"></i>' : ''; prevFor = m ? m.for : null;
            return `${gap}<button class="sw${cur === o.v ? ' on' : ''}" style="--c:${o.color}" data-opt="${g.id}" data-v="${o.v}" role="radio" aria-checked="${cur === o.v}" title="${esc(o.label)}"></button>`;
          }).join('');
          return `<div class="grp">${lab}<div class="sws" role="radiogroup" aria-label="${g.label}">${sw}</div></div>`;
        }
        const btns = g.options.map((o) => `<button class="opt${cur === o.v ? ' on' : ''}" data-opt="${g.id}" data-v="${o.v}" role="radio" aria-checked="${cur === o.v}" title="${esc(o.label)}${o.key ? ` (${o.key})` : ''}">${o.icon ? icon(o.icon, 20) : `<span class="tx">${o.text}</span>`}${o.key ? `<kbd>${o.key}</kbd>` : ''}</button>`).join('');
        return `<div class="grp${g.shared ? ' shared' : ''}">${lab}<div class="seg" role="radiogroup" aria-label="${g.label}">${btns}</div></div>`;
      };
      el.innerHTML = `<div class="pal-row">${groups.length ? groups.map(groupHtml).join('<i class="ps"></i>') : `<div class="grp solo">${icon(t.icon, 18)}<b>${t.name}</b></div>`}<button class="palx" data-action="palette" title="Collapse the palette (Esc)">${icon('chevron', 16)}</button></div><p class="hint">${esc(this.paletteHint())}</p>`;
    });
  },

  renderHead() {
    const u = HIST.undo[HIST.undo.length - 1], r = HIST.redo[HIST.redo.length - 1];
    this.gate('head', [this.scenario, u && u.label, r && r.label, HIST.undo.length, VIEW.plan, this.spec].join('|'), () => {
      this.els.head.innerHTML = `<span class="brand">Biskiq</span><span class="proj"><b>${esc(SCENARIOS[this.scenario].name)}</b><span>World</span></span>
        <span class="hist"><button data-action="undo" ${u ? '' : 'disabled'} title="${u ? `Undo: ${esc(u.label)}` : 'Nothing to undo'} (⌘Z)">${icon('undo', 18)}</button><button data-action="redo" ${r ? '' : 'disabled'} title="${r ? `Redo: ${esc(r.label)}` : 'Nothing to redo'} (⇧⌘Z)">${icon('redo', 18)}</button></span>`;
      this.els.headR.innerHTML = `<button class="hb" data-action="plan" aria-pressed="${VIEW.plan}" title="Toggle the plan view">${VIEW.plan ? '3D' : 'Plan'}</button><button class="hb" data-action="spec" aria-pressed="${this.spec}" title="The armed tool’s spec, intent and history">${icon('info', 16)}Spec</button>`;
    });
  },

  renderReadout() {
    const last = HIST.undo[HIST.undo.length - 1];
    const tries = TRY[T.tool] || [], tr = tries[this.trySeq % Math.max(1, tries.length)];
    this.gate('readout', [T.state, last && last.label, HIST.undo.length, T.tool, this.trySeq, this.roMin].join('|'), () => {
      this.els.readout.classList.toggle('min', !!this.roMin);
      if (this.roMin) { this.els.readout.innerHTML = `<button class="ro-h ro-tog" data-action="readout" aria-expanded="false">Prototype readout${icon('chevron', 14)}</button>`; return; }
      const exit = T.state === 'cancel' || T.state === 'refuse';
      const chain = STATES.map((s) => `<li class="${s.id === T.state ? 'on' : ''}" title="${esc(s.note)}">${s.label}</li>`).join('');
      const exits = STATE_EXITS.map((s) => `<li class="exit${s.id === T.state ? ' on' : ''}" title="${esc(s.note)}">${s.label}</li>`).join('');
      this.els.readout.innerHTML = `<button class="ro-h ro-tog" data-action="readout" aria-expanded="true">Prototype readout${icon('chevron-up', 14)}</button><ol class="chain${exit ? ' exited' : ''}">${chain}</ol><ol class="chain exits">${exits}</ol>
        <div class="ro-last">${last ? `Last step <b>${esc(last.label)}</b>` : 'No steps yet'}</div>
        ${tr ? `<div class="ro-try"><span>Try</span> ${esc(tr)}${tries.length > 1 ? ` <button data-action="try" title="Another suggestion">next</button>` : ''}</div>` : ''}`;
    });
  },

  renderCard() {
    const r = T.sel && T.tool === 'select' ? byId(world, T.sel) : null;
    this.gate('card', r ? JSON.stringify(r.item) + world.rev : 'none', () => {
      const el = this.els.card;
      if (!r) { el.hidden = true; el.innerHTML = ''; return; }
      el.hidden = false; el.innerHTML = cardHtml(r);
    });
  },

  renderSpec() {
    if (!this.spec) { this.els.spec.hidden = true; this.sig.spec = null; return; }
    const t = TOOLS[T.tool];
    this.gate('spec', [T.tool, HIST.undo.length, JSON.stringify(T.lastIntent), world.rev].join('|'), () => {
      const fam = t.family ? FAMILIES.find((f) => f.id === t.family) : null;
      const hist = HIST.undo.slice(-8).reverse().map((e) => `<li>${esc(e.label)}${e.intent && e.intent.intent ? `<code>${esc(e.intent.intent)}</code>` : ''}</li>`).join('');
      this.els.spec.hidden = false;
      this.els.spec.innerHTML = `<header><span class="sp-ico" style="--mark:${fam ? fam.mark : '#f3f0e4'}">${icon(t.icon, 22)}</span><div><h2>${t.name}</h2><span>${fam ? fam.name : 'Utility'} · key ${t.key}</span></div><button class="x" data-action="spec" title="Close">${icon('close', 16)}</button></header>
        <p class="makes">${esc(t.makes)}</p>
        <dl><dt>Aims at</dt><dd>${esc(t.target)}</dd><dt>Gesture</dt><dd>${esc(t.gesture)}</dd><dt>Result</dt><dd>${esc(t.result)}</dd><dt>Owner</dt><dd class="${/Needs an owner/.test(t.owner) ? 'needs' : ''}">${esc(t.owner)}</dd><dt>Lands in</dt><dd>${esc(t.area)}</dd>${t.today ? `<dt>Today</dt><dd>${esc(t.today)}</dd>` : ''}</dl>
        ${t.proposes.length ? `<h3>Proposes during the gesture</h3><ul>${t.proposes.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>` : ''}
        <h3>Try it here</h3><ul class="try">${(TRY[T.tool] || []).map((p) => `<li>${esc(p)}</li>`).join('')}</ul>
        <h3>Last accepted intent</h3><pre>${T.lastIntent ? esc(JSON.stringify(T.lastIntent, (k, v) => (typeof v === 'function' ? undefined : v), 1)) : '—'}</pre>
        <h3>History <small>one row per accepted gesture</small></h3><ol class="hist-list">${hist || '<li class="none">Nothing yet</li>'}</ol>`;
    });
  },

  // ── Stage overlay: tokens and the live tag ────────────────────────────────
  layout() {
    if (this.view !== 'stage') return;
    const seen = new Set(), rects = [];
    const toScreen = (at) => P(at.x, at.y, at.z != null ? at.z : hAt(at.x, at.y) + 0.15);
    const place = (c, mode) => {
      if (!c.at) return;
      const s = toScreen(c.at);
      // The dot stays on the consequence; only the label steps aside, joined by a leader.
      const x = clamp(s.x, 12, VIEW.w - 200), y = clamp(s.y, 60, VIEW.h - 150);
      let dy = 0;
      for (let k = 0; k < 6 && rects.some((r) => Math.abs(r.y - (y + dy)) < 27 && Math.abs(r.x - x) < 170); k++) dy += 28;
      rects.push({ x, y: y + dy });
      let el = this.toks.get(c.id);
      if (!el) { el = document.createElement('button'); el.dataset.tok = c.id; el.type = 'button'; this.els.overlay.appendChild(el); this.toks.set(c.id, el); }
      const text = c.options ? c.labels[c.choice] : c.label;
      const sig = mode + text + c.accepted + (c.options ? c.options.length : '');
      if (el._sig !== sig) {
        el._sig = sig;
        el.className = `tok ${mode}${c.accepted === false ? ' declined' : ''}`;
        el.tabIndex = mode === 'amend' ? 0 : -1;
        el.title = mode === 'amend' ? (c.options ? `Change: ${c.options.map((o) => c.labels[o]).join(' / ')}. Amends the last step.` : `${c.accepted === false ? 'Restore' : 'Drop'} this. Amends the last step.`) : mode === 'live' ? 'Proposed: commits with the gesture' : '';
        const tail = mode === 'amend' ? `<i class="tk-act">${c.options ? icon('cycle', 13) : icon(c.accepted === false ? 'close' : 'check', 13)}</i>` : '';
        el.innerHTML = `<span class="tk-b">${icon(c.icon || 'info', 15)}<span>${esc(text)}</span>${c.options && mode !== 'info' ? `<small>${c.options.indexOf(c.choice) + 1}/${c.options.length}</small>` : ''}${tail}</span>`;
      }
      el.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
      el.style.setProperty('--dy', `${dy}px`);
      seen.add(c.id);
    };
    for (const c of T.live) place(c, c.info ? 'info live-info' : 'live');
    if (T.amend && !T.draft) for (const c of T.amend.cons) place(c, c.info ? 'info' : 'amend');
    for (const [id, el] of this.toks) if (!seen.has(id)) { el.remove(); this.toks.delete(id); }
    // the live tag
    const tg = T.tag, el = this.els.tag;
    if (!tg || !tg.at || !tg.text) { el.hidden = true; return; }
    const s = toScreen(tg.at);
    const sig = tg.kind + tg.text + (tg.sub || []).join('|');
    if (el._sig !== sig) { el._sig = sig; el.className = `tag ${tg.kind}`; el.innerHTML = `<span>${esc(tg.text)}</span>${tg.sub ? `<ul>${tg.sub.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}`; }
    el.hidden = false;
    el.style.transform = `translate(${Math.round(clamp(s.x + 14, 8, VIEW.w - 260))}px, ${Math.round(clamp(s.y - 14, 70, VIEW.h - 40))}px) translateY(-100%)`;
  },

  toast(m) {
    const el = document.createElement('div'); el.className = 'toast'; el.textContent = m;
    this.els.toasts.appendChild(el);
    requestAnimationFrame(() => el.classList.add('in'));
    setTimeout(() => { el.classList.remove('in'); setTimeout(() => el.remove(), 260); }, 2600);
    while (this.els.toasts.children.length > 3) this.els.toasts.firstChild.remove();
  },
};

// ── the selection Card ────────────────────────────────────────────────────────
const segBtns = (edit, id, cur, opts) => `<div class="seg sm">${opts.map(([v, t, title]) => `<button class="opt${String(cur) === String(v) ? ' on' : ''}" data-edit="${edit}" data-id="${id}" data-v="${v}" title="${esc(title || t)}"><span class="tx">${t}</span></button>`).join('')}</div>`;
const iconSeg = (edit, id, cur, group) => `<div class="seg sm">${group.options.map((o) => `<button class="opt${cur === o.v ? ' on' : ''}" data-edit="${edit}" data-id="${id}" data-v="${o.v}" title="${esc(o.label)}">${o.icon ? icon(o.icon, 18) : `<span class="tx">${o.text}</span>`}</button>`).join('')}</div>`;
const link = (id) => { const r = byId(world, id); return r ? `<button class="ln" data-sel="${id}">${esc(r.item.name)}</button>` : ''; };
const swatch = (m) => `<span class="mini" style="--c:${MATERIALS[m] ? MATERIALS[m].color : '#ddd'}"></span>${MATERIALS[m] ? MATERIALS[m].label : 'Default'}`;
function cardHtml(r) {
  const it = r.item, id = it.id, rows = [], rel = [];
  const row = (k, v) => rows.push(`<div class="cr"><span>${k}</span><div>${v}</div></div>`);
  if (r.kind === 'walls') {
    row('Height', segBtns('wallHeight', id, Object.keys(H_WALL).find((k) => H_WALL[k] === it.height) || '', [['low', '1.2 m', 'Garden wall'], ['room', '3 m', 'Room'], ['tall', '4.5 m', 'Hall']]));
    row('Shape', it.bulge ? `Curved, ${fmt(Math.abs(it.bulge), 2)} m bend <button class="mini-act" data-edit="straighten" data-id="${id}">Straighten</button>` : 'Straight · pull the gold knob to curve');
    row('Length', `${fmt(wallLen(it), 2)} m`);
    row('Faces', `${swatch(it.mat[0])} / ${swatch(it.mat[1])}`);
    roomsOfWall(id).forEach((rm) => rel.push(`Encloses ${link(rm.id)}`));
    world.openings.filter((o) => o.hostId === id).forEach((o) => rel.push(`Hosts ${link(o.id)}`));
    world.art.filter((a) => a.wallId === id).forEach((a) => rel.push(`Carries ${link(a.id)}`));
  } else if (r.kind === 'buildings') {
    row('Storeys', segBtns('storeys', id, it.floors, [[1, '1'], [2, '2'], [3, '3'], [4, '4'], [5, '5']]));
    const roofs = it.shape === 'circle' ? [['cone', 'Cone'], ['flat', 'Flat']] : [['gable', 'Gable'], ['hip', 'Hip'], ['flat', 'Flat']];
    row('Roof', segBtns('broof', id, it.roof, roofs));
    row('Windows', iconSeg('windows', id, it.windows, TOOLS.building.palette.find((g) => g.id === 'windows')));
    row('Walls', `${swatch(it.mat)}${Object.keys(it.overrides).length ? ` · ${Object.keys(it.overrides).length} face override` : ''}`);
    const twins = world.buildings.filter((b) => b.style === it.style).length;
    row('Definition', `${esc(it.style)} <small>${twins} placed</small>`);
    rel.push('Walls, roof and windows are generated from the definition');
    world.openings.filter((o) => o.hostId === id).forEach((o) => rel.push(`Explicit ${link(o.id)}${o.origin ? ` · made with ${esc(o.origin)}` : ''}`));
  } else if (r.kind === 'openings') {
    row('Kind', iconSeg('okind', id, it.kind, TOOLS.opening.palette[0]));
    row('Size', `${fmt(it.width, 1)} × ${fmt(Math.min(it.height, 9), 1)} m${it.sill ? `, sill ${fmt(it.sill, 1)} m` : ''}`);
    rel.push(`In ${link(it.hostId)}${it.hostKind === 'building' && it.floor ? ` · storey ${it.floor + 1}` : ''}`);
    rel.push(it.origin ? `Made with ${esc(it.origin)}` : 'Ordinary opening');
    if (it.hostKind === 'wall') { const rs = roomsOfWall(it.hostId); if (rs.length === 2 && !OPENING_KINDS[it.kind].blind) rel.push(`Connects ${link(rs[0].id)} and ${link(rs[1].id)} (derived)`); }
  } else if (r.kind === 'roofs') {
    row('Style', iconSeg('rstyle', id, it.style, TOOLS.roof.palette[0]));
    row('Pitch', segBtns('rpitch', id, it.pitch, [['low', '20°'], ['mid', '35°'], ['steep', '50°']]));
    rel.push(`Over ${link(it.roomId)}`);
  } else if (r.kind === 'rooms') {
    row('Area', `${fmt(Math.abs(G.area(roomPoly(it) || [])), 1)} m²`);
    row('Floor', swatch(it.floor));
    rel.push('Comes from its walls; erase a wall to open it');
    it.wallIds.forEach((w) => rel.push(`Wall ${link(w)}`));
  } else if (r.kind === 'objects') {
    row('Item', OBJ_LABEL[it.item]);
    row('Turn', `${Math.round(((it.r * 180) / Math.PI % 360 + 360) % 360)}°`);
    rel.push('Placed, not attached to anything');
  } else if (r.kind === 'art') {
    row('Frame', iconSeg('asize', id, it.size, TOOLS.art.palette[0]));
    row('Hang line', `${fmt(it.line, 2)} m`);
    rel.push(`Hangs on ${link(it.wallId)}`);
    world.lights.filter((l) => l.aimAt === id).forEach((l) => rel.push(`Lit by ${link(l.id)} (keeps aimed)`));
  } else if (r.kind === 'lights') {
    row('Fixture', TOOLS.light.palette[0].options.find((o) => o.v === it.kind).label);
    if (it.kind === 'spot') row('Aim', it.aimAt ? `Keeps aimed at ${link(it.aimAt)} <button class="mini-act" data-edit="stopAim" data-id="${id}">Stop aiming</button>` : it.aimPoint ? 'Aimed once · no relationship' : 'Not aimed');
    if (it.roomId) rel.push(`Hangs in ${link(it.roomId)}`);
    if (it.wallId) rel.push(`Mounted on ${link(it.wallId)}`);
    if (it.aimAt) rel.push(`Keeps aimed at ${link(it.aimAt)} · explicit relationship`);
  } else if (r.kind === 'paths') {
    row('Width', segBtns('pwidth', id, String(it.width), [['1', '1 m'], ['1.6', '1.6 m'], ['2.6', '2.6 m']]));
    row('Surface', segBtns('psurface', id, it.surface, [['gravel', 'Gravel'], ['stone', 'Stone'], ['boards', 'Boards']]));
    row('On slopes', segBtns('pslope', id, it.slope, [['steps', 'Steps'], ['ramp', 'Ramp']]));
    (it.crossings || []).forEach((c, i) => row(`Crossing ${i + 1}`, segBtns('crossing', id, c.mode, [['bridge', 'Bridge'], ['stones', 'Stones'], ['none', 'Wade']]).replace(/data-v=/g, `data-i="${i}" data-v=`)));
    world.openings.filter((o) => o.origin === it.name).forEach((o) => rel.push(`Made ${link(o.id)} · it stays if the path goes`));
  } else if (r.kind === 'stairs') {
    const n = Math.max(2, Math.round((it.z1 - it.z0) / 0.17));
    row('Treads', `${n} · rise ${fmt(it.z1 - it.z0, 2)} m`);
    row('Width', `${fmt(it.width, 1)} m`);
  }
  const owner = OWNER_LABEL[r.kind];
  return `<header><div><span class="ck">${KIND_NAME[r.kind]}</span><h2>${esc(it.name)}</h2></div><span class="owner${owner === 'Needs an owner' ? ' needs' : ''}" title="The authority that owns this subject">${owner}</span><button class="x" data-action="card-close" title="Deselect (Esc)">${icon('close', 16)}</button></header>
    <div class="crs">${rows.join('')}</div>
    ${rel.length ? `<div class="rel"><h3>Relationships</h3><ul>${rel.map((x) => `<li>${x}</li>`).join('')}</ul></div>` : ''}
    <footer>${r.kind === 'rooms' ? '<span class="note">A derived room cannot be erased on its own.</span>' : `<button class="danger" data-edit="erase" data-id="${id}">${icon('erase', 16)}Erase ${esc(it.name)}</button>`}<span class="note">Each change is one undo step.</span></footer>`;
}
const CARD_EDITS = {
  wallHeight(id, v) { editProp(id, `Set ${nameOf(id)} to ${H_WALL[v]} m`, (it) => { it.height = H_WALL[v]; }, { intent: 'layout.wall.setHeight', wall: id, height: H_WALL[v] }); },
  straighten(id) { editProp(id, `Straighten ${nameOf(id)}`, (it) => { it.bulge = 0; }, { intent: 'layout.wall.bend', wall: id, sagitta: 0 }); },
  storeys(id, v) { editProp(id, `${nameOf(id)} to ${v} storeys`, (it) => { it.floors = +v; }, { intent: 'layout.structure.setStoreys', structure: id, storeys: +v }); },
  broof(id, v) { editProp(id, `${nameOf(id)} gets a ${v} roof`, (it) => { it.roof = v; }, { intent: 'layout.structure.setRoof', structure: id, roof: v }); },
  windows(id, v) { editProp(id, `${nameOf(id)} windows: ${v}`, (it) => { it.windows = v; }, { intent: 'layout.structure.setWindows', structure: id, windows: v }); },
  okind(id, v) {
    const K = OPENING_KINDS[v];
    editProp(id, `Make ${nameOf(id)} ${/^[aeiou]/i.test(K.label) ? 'an' : 'a'} ${K.label.toLowerCase()}`, (it, w) => {
      const host = it.hostKind === 'wall' ? w.walls.find((x) => x.id === it.hostId) : null;
      it.kind = v; it.width = K.width; it.sill = K.sill; it.height = host && K.sill < 0.05 && (v === 'wide' || host.height <= K.height) ? host.height : K.height;
    }, { intent: 'layout.opening.setKind', opening: id, kind: v });
  },
  rstyle(id, v) { editProp(id, `${nameOf(id)}: ${v}`, (it) => { it.style = v; }, { intent: 'layout.roof.set', roof: id, style: v }); },
  rpitch(id, v) { editProp(id, `${nameOf(id)}: ${v} pitch`, (it) => { it.pitch = v; }, { intent: 'layout.roof.set', roof: id, pitch: v }); },
  asize(id, v) { editProp(id, `Resize ${nameOf(id)}`, (it) => { it.size = v; }, { intent: 'scene.art.setSize', art: id, size: v }); },
  stopAim(id) { editProp(id, `${nameOf(id)} stops aiming`, (it) => { const a = world.art.find((x) => x.id === it.aimAt); it.aimPoint = a ? artCentre(a) : null; it.aimAt = null; }, { intent: 'scene.light.clearAim', light: id, keepsDirection: true }); },
  pwidth(id, v) { editProp(id, `${nameOf(id)} to ${v} m`, (it) => { it.width = +v; }, { intent: 'landscape.path.setWidth', path: id, width: +v }); },
  psurface(id, v) { editProp(id, `${nameOf(id)}: ${v}`, (it) => { it.surface = v; }, { intent: 'landscape.path.setSurface', path: id, surface: v }); },
  pslope(id, v) { editProp(id, `${nameOf(id)}: ${v} on slopes`, (it) => { it.slope = v; }, { intent: 'landscape.path.slope', path: id, as: v }); },
  crossing(id, v, i) { editProp(id, `${nameOf(id)}: ${v === 'none' ? 'wade' : v} at crossing ${+i + 1}`, (it) => { it.crossings[+i].mode = v; }, { intent: 'landscape.path.crossing', path: id, crossing: +i, as: v }); },
  erase() { eraseSelection(); },
};
