'use strict';
/*
 * World creation tools — the shell around the Stage.
 *
 * One instrument at the lower edge. The forest dock carries eight labelled keys: Select, four
 * families (Build, Form, Landscape, Furnish), Paint, Erase and the Library. A family key arms
 * the tool you last used in it. Above the dock sits a parchment plate of fixed size: a words row
 * (the family's tools, the selection, or the Library's kinds) over a pictures strip (options,
 * actions, or catalogue). Click only, no hover; rows that hold more scroll inside. The armed key
 * is the tab the plate stands on. The head carries the project, history, the view cluster and the Sky; the Card
 * shows the selection's properties. The dark strip at the very top and the readout on the
 * left are instruments for reviewing the proposal, not proposed product UI.
 */

const $ = (s, r = document) => r.querySelector(s);
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
/* A strip that holds more than it shows fades at the side it continues on. */
function fadeStrip(r) {
  const more = r.scrollWidth - r.clientWidth;
  r.classList.toggle('fr', more > 1 && r.scrollLeft < more - 1);
  r.classList.toggle('fl', r.scrollLeft > 1);
}
const OWNER_LABEL = { walls: 'Layout', rooms: 'Layout', openings: 'Layout', roofs: 'Layout', buildings: 'Layout', stairs: 'Layout', objects: 'Scene', forms: 'Scene', art: 'Scene', lights: 'Scene', paths: 'Needs an owner' };
const KIND_NAME = { walls: 'Wall', rooms: 'Room (derived)', openings: 'Opening', roofs: 'Roof', buildings: 'Placed building', stairs: 'Stair', objects: 'Object', forms: 'Form', art: 'Frame', lights: 'Light', paths: 'Path' };

/* Suggestions for a reviewer, per tool, phrased against the seeded scenarios. */
const TRY = {
  select: ['Click inside a closed room: the plate offers it a roof.', 'Studio: click the Stage, then drag it. The drum on it moves too.', 'Click the Cottage, then drag the gold square above its roof to change storeys.', 'Select a garden wall and pull the gold knob on its top to bend it.'],
  walls: ['Draw a Box (3) of room-height walls: closing it offers a roof. Open is the default; click the token to change it.', 'Pick Circle (4) and drag out a round room: the roof offer becomes Dome or Flat.', 'Draw a Line across the Garden path: a doorway is proposed where they cross.'],
  building: ['Pick Tower in the palette: the footprint turns round and it rises three storeys as you drag.', 'Slope: drag a Box across the terrace edge: choose Plinth or Level the ground on the token.', 'Draw a footprint across the Garden path to get a door where it meets.'],
  opening: ['Hover the Tower: the opening lands on the storey you point at.', 'Try a door on an upper storey to see the refusal.', 'Arch (3) through a gallery wall connects two rooms.'],
  stair: ['Hillside scenario: drag from the foot of the terrace up onto it.', 'Studio: drag from the floor up onto the Stage.'],
  object: ['Drag across open ground: a row of the shelf item, evenly spaced. It skips what is in the way and says so.', 'Gallery: pick Frame (6), then drag along a long wall to hang a row. It skips the door.', 'Press K for the Library. Picking a vitrine puts it on the shelf.', 'Studio: place a plinth on the Stage. It stands on top.'],
  form: ['Studio: draw a Box on the Stage, move up to pull its height, click to set. It rests on the Stage.', 'Circle (4) and a tall pull makes a column; the name follows the proportions.', 'Select a form, then Duplicate. Things you compose can be saved to the Library.'],
  light: ['Gallery: place a Spot near a frame, then change the token after release: once, keep aimed, or not aimed.', 'A pendant outside a room refuses: nothing to hang from.', 'The sun is not a light: open Sky in the head and drag it to dusk.'],
  ground: ['Hold over open ground to raise it; Shift lowers. [ and ] change the brush.', 'Terrace (5): drag a shape, move up to lift it, click to set.', 'Water is next door in Landscape: press A.'],
  water: ['Village: hold across the Garden path to paint a pond. A bridge token appears after the stroke.', 'Stream (2): drag a stroke down the hill. It follows the ground.', 'Meadow: a deep pond, then Path (P) across it.'],
  path: ['Draw from the Cottage across the meadow to the garden wall: a gate, steps or a bridge are proposed where they happen.', 'After release, click a token to change it. Still one undo step.'],
  plants: ['Hold to scatter trees; they skip the path, water, buildings and forms.', 'Click once for a single plant. Shift-hold clears.'],
  paint: ['Reach: Room or building, then click the Cottage. It asks: only this one, or every Cottage.', 'Studio: Reach Whole wall or form, then click the Drum.', 'Hold Alt over a wall to sample its material.'],
  erase: ['Hover a garden wall: the tag names what goes with it.', 'Studio: hover the Stage. The drum on it comes down with it.', 'Click inside a room: rooms come from walls, so it refuses.'],
  measure: ['Drag between two points. Readings are never saved.'],
  slice: ['Unchanged from the approved sheet.'],
};

const UI = {
  ready: false, lib: null, sky: false, skyLive: false, view: 'stage', spec: false, scenario: 'village',
  lastTool: null, trySeq: 0, edgeH: 150,
  sig: {}, els: {}, toks: new Map(), toastT: null,

  init() {
    this.els = { dock: $('#dock'), palette: $('#palette'), edge: $('#edge'), head: $('#head'), headR: $('#headR'), sky: $('#skypop'), card: $('#card'), spec: $('#spec'), readout: $('#readout'), overlay: $('#overlay'), tag: $('#tag'), toasts: $('#toasts'), stageView: $('#stageView'), sheetView: $('#sheetView') };
    document.addEventListener('click', (e) => this.onClick(e));
    document.addEventListener('change', (e) => this.onChange(e));
    document.addEventListener('input', (e) => this.onInput(e));
    window.addEventListener('keydown', (e) => { if (this.view === 'stage') { onKey(e); this.sync(); } });
    window.addEventListener('keyup', (e) => { if (this.view === 'stage') onKeyUp(e); });
    window.addEventListener('resize', () => { resizeStage(); VIEW.dirty = true; });
    window.addEventListener('hashchange', () => this.route());
    new ResizeObserver(() => { this.edgeH = this.els.edge.offsetHeight; this.els.stageView.style.setProperty('--edge-h', `${this.edgeH}px`); }).observe(this.els.edge);
    // Strips that overflow scroll inside the instrument: the wheel scrolls them sideways, and a fade marks more.
    this.els.edge.addEventListener('wheel', (e) => { const r = e.target.closest('.strip'); if (!r || r.scrollWidth <= r.clientWidth || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return; r.scrollLeft += e.deltaY; e.preventDefault(); }, { passive: false });
    this.els.edge.addEventListener('scroll', (e) => { if (e.target.classList && e.target.classList.contains('strip')) fadeStrip(e.target); }, true);
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
  capture() {
    const keep = PROFILE, sky = this.sky, out = {};
    this.sky = false;
    try { for (const p of ['living', 'paper']) { setProfile(p); render(); out[p] = VIEW.cv.toDataURL('image/jpeg', 0.82); } }
    finally { setProfile(keep); this.sky = sky; VIEW.dirty = true; }
    return out;
  },
  updateHash() {
    const h = this.view === 'sheet' ? '#sheet' : `#${this.scenario}${T.tool !== 'select' ? '/' + T.tool : ''}`;
    if (location.hash !== h) history.replaceState(null, '', h);
  },
  setView(v) {
    // The sheet shows the Stage in both profiles: take the two pictures while it is still on screen.
    if (v === 'sheet' && !this.sheetDone && this.view === 'stage' && VIEW.w > 300) this.shots = this.capture();
    this.view = v;
    this.els.stageView.hidden = v !== 'stage'; this.els.sheetView.hidden = v !== 'sheet';
    document.querySelectorAll('[data-view]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.view === v));
    if (v === 'sheet' && !this.sheetDone) { SHEET.render(this.els.sheetView); this.sheetDone = true; }
    if (v === 'stage') { requestAnimationFrame(() => { resizeStage(); VIEW.dirty = true; }); }
    this.updateHash();
  },

  // ── events ────────────────────────────────────────────────────────────────
  onClick(e) {
    const el = e.target.closest('[data-tool],[data-family],[data-sub],[data-sky],[data-opt],[data-action],[data-view],[data-sel],[data-edit],[data-tok],[data-act],[data-lib],[data-lib-cat]');
    if (!el) return;
    const d = el.dataset;
    if (d.view) { this.setView(d.view); return; }
    if (d.family) {
      // A family key opens its tools and arms the one last used in it. Pressed again, nothing moves.
      const f = FAMILIES.find((x) => x.id === d.family);
      if (f.tools.includes(T.tool)) this.lib = null;
      else armTool(T.famLast[f.id] || f.tools[0]);
      this.sync(); return;
    }
    if (d.sub) { if (d.sub !== T.tool) armTool(d.sub); this.sync(); return; }
    if (d.sky) { const p = SKY_PRESETS.find((x) => x.id === d.sky); setHour(p.t, `Sky to ${p.label.toLowerCase()}`); return; }
    if (d.tool) {
      const t = TOOLS[d.tool];
      // A view tool toggles back to Select; any other armed key just stays armed.
      if (d.tool === T.tool && !t.disabled) { if (t.group === 'view') armTool('select'); else this.lib = null; }
      else armTool(d.tool);
      this.sync(); return;
    }
    if (d.opt) { setOpt(d.opt, d.v); this.sync(); return; }
    if (d.act) { SEL_ACT[d.act](d.id, d.v); this.sync(); return; }
    if (d.lib) { this.pickLibrary(d.lib); return; }
    if (d.libCat) { this.lib.cat = d.libCat; this.sync(); return; }
    if (d.sel) { selectId(d.sel); return; }
    if (d.edit) { CARD_EDITS[d.edit](d.id, d.v, d.i); this.sync(); return; }
    if (d.tok) { this.amendToken(d.tok); return; }
    const a = d.action;
    if (a === 'undo') doUndo();
    else if (a === 'redo') doRedo();
    else if (a === 'plan') { setPlan(d.v ? d.v === 'plan' : !VIEW.plan); this.sync(); }
    else if (a === 'profile') { setProfile(d.v); this.sync(); }
    else if (a === 'sky') { this.sky = !this.sky; if (this.sky) this.lib = null; VIEW.dirty = true; this.sync(); }
    else if (a === 'spec') { this.spec = !this.spec; document.body.classList.toggle('spec-open', this.spec); this.sync(); }
    else if (a === 'library') { this.sky = false; this.openLibrary(); }
    else if (a === 'library-close') { this.lib = null; this.sync(); }
    else if (a === 'reset') { loadScenario(this.scenario); armTool('select'); this.toast('Scenario reset'); }
    else if (a === 'readout') { this.roMin = !this.roMin; this.sync(); }
    else if (a === 'try') { this.trySeq++; this.sig.readout = null; this.sync(); }
    else if (a === 'card-close') selectId(null);
  },
  onChange(e) {
    if (e.target.id === 'scenario') { this.scenario = e.target.value; loadScenario(this.scenario); armTool('select'); this.updateHash(); }
    if (e.target.id === 'hour' && this.skyLive) {
      this.skyLive = false;
      liveEnd(`Set the hour to ${hh(world.sun)}`, { intent: 'scene.environment.setHour', hour: r2(world.sun) });
      T.lastIntent = HIST.undo[HIST.undo.length - 1].intent; this.sync();
    }
  },
  /* The hour slider edits live; the step is recorded when it is let go (one undo step). */
  onInput(e) {
    if (e.target.id !== 'hour') return;
    if (!this.skyLive) { liveBegin(); this.skyLive = true; }
    world.sun = +e.target.value; VIEW.dirty = true; this.sync();
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

  // ── the Library: catalogue content, in the same tier as the palette ───────
  openLibrary(mode = 'browse', target = null) {
    if (mode === 'browse' && this.lib && this.lib.mode === 'browse') { this.lib = null; this.sync(); return; }
    const byTool = { object: 'objects', light: 'lights', plants: 'plants', building: 'buildings', paint: 'materials' };
    if (T.draft) cancelDraft(true);
    this.lib = { mode, target, cat: mode === 'replace' ? 'objects' : (this.lib && this.lib.cat) || byTool[T.tool] || 'objects' };
    this.sync();
  },
  pickLibrary(v) {
    const L = this.lib, cat = LIBRARY.find((c) => c.id === L.cat), item = cat.items.find((x) => x.v === v);
    if (L.mode === 'replace') {
      const id = L.target, word = OBJ_LABEL[v];
      this.lib = null; shelfPut(v);
      editProp(id, `Replace ${nameOf(id)} with ${/^[aeiou]/i.test(word) ? 'an' : 'a'} ${word.toLowerCase()}`, (it, w) => { it.item = v; it.name = nid(w, 'object', word).name; }, { intent: 'scene.instance.replace', id, asset: v, keeps: ['position', 'turn'] });
      this.sync(); return;
    }
    if (cat.id === 'objects') shelfPut(v);
    armTool(cat.tool);
    if (item.opts) { for (const [k, val] of Object.entries(item.opts)) setOpt(k, val); this.toast(`${item.label}: draw its footprint`); }
    else setOpt(cat.opt, v);
    this.sync();
  },

  // ── rendering ────────────────────────────────────────────────────────────
  gate(key, sig, fn) { if (this.sig[key] === sig) return; this.sig[key] = sig; fn(); },
  sync() {
    if (!this.ready) return;
    if (T.tool !== this.lastTool) { this.lastTool = T.tool; this.trySeq = 0; }
    if (this.lib && this.lib.mode === 'replace' && !(T.sel === this.lib.target && byId(world, T.sel))) this.lib = null;
    this.renderDock(); this.renderTier(); this.renderHead(); this.renderSky(); this.renderReadout(); this.renderCard(); this.renderSpec();
    document.body.dataset.armed = T.tool;
    document.querySelectorAll('.proto [data-action="spec"]').forEach((b) => b.setAttribute('aria-pressed', this.spec));
    this.updateHash();
  },

  /* The dock's markup, shared with the System sheet's stills. Eight labelled keys of equal width in
     parchment line. A family key carries one dot per tool in it; the armed family's dot takes its colour. */
  dockHtml(tool, libOpen, famLast = T.famLast) {
    const cls = (on) => (on ? (libOpen ? ' held' : ' armed') : '');
    const solo = (id) => {
      const t = TOOLS[id], on = tool === id;
      return `<button class="key${cls(on)}" data-tool="${id}" aria-pressed="${on}" aria-label="${esc(t.name)} (${t.key})">${heroIcon(t.icon, 24)}<span class="kl">${esc(t.name)}</span><span class="kd"></span></button>`;
    };
    const fam = (f) => {
      const on = f.tools.includes(tool), cur = on ? tool : famLast[f.id] || f.tools[0];
      const dots = `<span class="kd" aria-hidden="true">${f.tools.length > 1 ? f.tools.map((id) => `<i${id === cur ? ' class="on"' : ''}></i>`).join('') : ''}</span>`;
      return `<button class="key fam${cls(on)}" data-family="${f.id}" style="--acc:${f.accent}" aria-pressed="${on}" aria-label="${esc(f.name)}: ${esc(f.tools.map((id) => TOOLS[id].name).join(', '))}">${heroIcon(f.icon, 24)}<span class="kl"${f.id === 'land' ? ' data-s="Land"' : ''}>${esc(f.name)}</span>${dots}</button>`;
    };
    const lib = `<button class="key${libOpen ? ' armed' : ''}" data-action="library" aria-pressed="${libOpen}" aria-label="Library (K)">${heroIcon('library', 24)}<span class="kl">Library</span><span class="kd"></span></button>`;
    const sep = '<i class="dsep" aria-hidden="true"></i>';
    return `${UTILITY_LEFT.map(solo).join('')}${sep}${FAMILIES.map(fam).join('')}${sep}${UTILITY_RIGHT.map(solo).join('')}${sep}${lib}`;
  },

  renderDock() {
    this.gate('dock', [T.tool, !!this.lib, JSON.stringify(T.famLast)].join('|'), () => {
      this.els.dock.innerHTML = this.dockHtml(T.tool, !!this.lib);
    });
  },

  /* The plate above the dock is always there and never changes size: a row of words (the family's
     tools, the selection, or the Library's kinds) over a strip of pictures (options, actions, or
     catalogue). Either row scrolls sideways inside itself when it has more than fits. */
  renderTier() {
    const sel = T.tool === 'select' && T.sel ? byId(world, T.sel) : null;
    const sig = [T.tool, JSON.stringify(T.opts[T.tool] || {}), T.shelf.join(), T.recentMat.join(), JSON.stringify(this.lib), sel ? JSON.stringify(sel.item) + world.rev : ''].join('|');
    this.gate('tier', sig, () => {
      const el = this.els.palette;
      el.className = `tier${this.lib ? ' library' : ''}`;
      el.innerHTML = this.lib ? this.libraryHtml() : T.tool === 'select' ? this.selectionHtml(sel) : this.paletteHtml();
      el.querySelectorAll('.strip').forEach(fadeStrip);
    });
  },

  plate(words, strip, aside = '') {
    return `<div class="row words"><div class="strip">${words}</div>${aside}</div><div class="row picks"><div class="strip">${strip}</div></div>`;
  },

  paletteHtml() {
    const groupHtml = (g) => {
      // One word above each group: the choice it holds now. The group's name is in its aria-label.
      if (g.kind === 'action') return `<div class="pg"><span class="gl"></span><button class="opt more" data-action="${g.id}" aria-label="${esc(g.text)} (K)">${icon(g.icon, 18)}<span class="tx">${g.text}</span></button></div>`;
      const cur = opt(g.id), curO = g.options.find((o) => o.v === cur);
      const lab = `<span class="gl">${esc(curO ? curO.label : '')}</span>`;
      if (g.kind === 'swatch') {
        // Paint keeps five recent materials in reach; every material is in the Library.
        const recent = [...new Set([cur, ...T.recentMat])].filter((v) => MATERIALS[v]).slice(0, 5);
        const sw = recent.map((v) => `<button class="sw${cur === v ? ' on' : ''}" style="--c:${MATERIALS[v].color}" data-opt="${g.id}" data-v="${v}" role="radio" aria-checked="${cur === v}" aria-label="${esc(MATERIALS[v].label)}"></button>`).join('');
        return `<div class="pg">${lab}<div class="opts sws" role="radiogroup" aria-label="${g.label}">${sw}<button class="opt more" data-action="library" aria-label="All materials (K)">${icon('library', 18)}<span class="tx">All</span></button></div></div>`;
      }
      const btns = g.options.map((o) => `<button class="opt${cur === o.v ? ' on' : ''}${o.gap ? ' gap' : ''}" data-opt="${g.id}" data-v="${o.v}" role="radio" aria-checked="${cur === o.v}" aria-label="${esc(o.label)}">${o.icon ? icon(o.icon, 20) : `<span class="tx">${o.text}</span>`}</button>`).join('');
      return `<div class="pg">${lab}<div class="opts" role="radiogroup" aria-label="${g.label}">${btns}</div></div>`;
    };
    const f = familyOf(T.tool);
    // Nouns get words: the family's tools by name, the armed one underlined in the family's colour.
    const subs = (f ? f.tools : [T.tool]).map((id) => `<button class="sub${id === T.tool ? ' on' : ''}" data-sub="${id}" role="tab" aria-selected="${id === T.tool}">${esc(TOOLS[id].name)}<kbd>${TOOLS[id].key}</kbd></button>`).join('');
    return this.plate(`<div class="subs" role="tablist" aria-label="${f ? esc(f.name) : 'Tool'}"${f ? ` style="--acc:${f.accent}"` : ''}>${subs}</div>`, groupsOf().map(groupHtml).join(''));
  },

  selectionHtml(r) {
    if (!r) return this.plate('<div class="subs"><button class="sub on" data-sub="select" role="tab" aria-selected="true">Select<kbd>V</kbd></button></div>', '<span class="empty">Nothing selected</span>');
    const it = r.item, id = it.id;
    const act = (a, ic, text) => `<button class="act" data-act="${a}" data-id="${id}">${icon(ic, 18)}<span>${text}</span></button>`;
    const choice = (label, a, cur, options) => {
      const curO = options.find((o) => o.v === cur);
      return `<div class="pg"><span class="gl">${esc(curO ? curO.label : '')}</span><div class="opts" role="radiogroup" aria-label="${label}">${options.map((o) => `<button class="opt${cur === o.v ? ' on' : ''}" data-act="${a}" data-id="${id}" data-v="${o.v}" role="radio" aria-checked="${cur === o.v}" aria-label="${esc(o.label)}">${o.icon ? icon(o.icon, 20) : `<span class="tx">${o.text}</span>`}</button>`).join('')}</div></div>`;
    };
    const acts = (...b) => `<div class="pg"><span class="gl"></span><div class="opts">${b.filter(Boolean).join('')}</div></div>`;
    let body = '', canErase = true;
    if (r.kind === 'rooms' || r.kind === 'roofs') {
      const room = r.kind === 'rooms' ? it : world.rooms.find((x) => x.id === it.roomId);
      const roof = room && world.roofs.find((x) => x.roomId === room.id);
      if (room) {
        const styles = roomRoofStyles(room).map((v) => ({ v, icon: ROOF_STYLES[v].icon, label: ROOF_STYLES[v].label }));
        body = choice('Roof', 'roof', roof ? roof.style : 'none', styles) + (roof ? choice('Pitch', 'pitch', roof.pitch, PITCHES) : '');
      }
      canErase = false;
    } else if (r.kind === 'walls') body = acts(it.bulge ? act('straighten', 'shape-line', 'Straighten') : '', act('opening', 'opening', 'Opening'), act('paint', 'paint', 'Paint'));
    else if (r.kind === 'objects') body = acts(act('turn', 'turn', 'Turn 90°'), act('duplicate', 'duplicate', 'Duplicate'), act('replace', 'replace', 'Replace…'));
    else if (r.kind === 'forms') body = acts(act('duplicate', 'duplicate', 'Duplicate'), act('save', 'library', 'Save to Library'), act('paint', 'paint', 'Paint'));
    else if (r.kind === 'buildings') body = acts(act('paint', 'paint', 'Paint'));
    else if (r.kind === 'lights' && it.aimAt) body = acts(act('stopAim', 'aim', 'Stop aiming'));
    const erase = canErase ? `<div class="pg end"><span class="gl"></span><button class="act erase" data-act="erase" data-id="${id}">${icon('erase', 18)}<span>Erase</span></button></div>` : '';
    return this.plate(`<div class="pn sel"><i class="pip" aria-hidden="true"></i><b>${esc(it.name)}</b><span>${KIND_NAME[r.kind]}</span></div>`, body + erase);
  },

  libraryHtml() {
    const L = this.lib, cat = LIBRARY.find((c) => c.id === L.cat), tgt = L.mode === 'replace' ? byId(world, L.target) : null;
    const items = cat.items.filter((x) => !tgt || !isWallItem(x.v));
    const cur = tgt ? tgt.item.item : cat.id === 'objects' ? opt('item', 'object') : cat.opt ? opt(cat.opt, cat.tool) : null;
    const words = tgt
      ? `<div class="pn"><b>Replace ${esc(tgt.item.name)}</b><span>with</span></div>`
      : `<div class="subs" role="tablist" aria-label="Library">${LIBRARY.map((c) => `<button class="sub${c.id === L.cat ? ' on' : ''}" role="tab" aria-selected="${c.id === L.cat}" data-lib-cat="${c.id}">${c.name}</button>`).join('')}</div>`;
    const tile = (x) => `<button class="tile${x.v === cur ? ' on' : ''}" data-lib="${x.v}" aria-pressed="${x.v === cur}">${x.color ? `<i class="dot" style="--c:${x.color}"></i>` : icon(x.icon, 22)}<span>${esc(x.label)}</span></button>`;
    return this.plate(words, items.map(tile).join(''), `<button class="x" data-action="library-close" aria-label="Close the Library (Esc)">${icon('close', 16)}</button>`);
  },

  renderHead() {
    const u = HIST.undo[HIST.undo.length - 1], r = HIST.redo[HIST.redo.length - 1], pre = skyPresetAt(world.sun);
    this.gate('head', [this.scenario, u && u.label, r && r.label, HIST.undo.length, VIEW.plan, T.tool, PROFILE, hh(world.sun), this.sky].join('|'), () => {
      this.els.head.innerHTML = `<span class="brand" aria-label="Biskiq">${BRAND_MARK}<span>Biskiq</span></span><span class="proj"><b>${esc(SCENARIOS[this.scenario].name)}</b><span>World</span></span>
        <span class="hist"><button class="hb" data-action="undo" ${u ? '' : 'disabled'} aria-label="${u ? `Undo ${esc(u.label)}` : 'Nothing to undo'}">${icon('undo', 18)}</button><button class="hb" data-action="redo" ${r ? '' : 'disabled'} aria-label="${r ? `Redo ${esc(r.label)}` : 'Nothing to redo'}">${icon('redo', 18)}</button></span>`;
      // The view cluster: ways of looking at and reading the world, and the world's sky. None makes anything.
      const vt = (id) => { const t = TOOLS[id]; return `<button class="hb${t.disabled ? ' off' : ''}" data-tool="${id}" aria-pressed="${T.tool === id}" aria-label="${t.name} (${t.key})">${icon(t.icon, 18)}</button>`; };
      const seg = (a, cur, opts, tip) => `<span class="hseg" role="group" aria-label="${esc(tip[0])}">${opts.map(([v, text]) => `<button data-action="${a}" data-v="${v}" aria-pressed="${cur === v}">${text}</button>`).join('')}</span>`;
      this.els.headR.innerHTML = `${seg('plan', VIEW.plan ? 'plan' : '3d', [['3d', '3D'], ['plan', 'Plan']], ['Plan or 3D', 'Every tool works in both.'])}${seg('profile', PROFILE, [['living', 'Living'], ['paper', 'Paper']], ['Living or Paper', 'Living is the illustrated world; Paper is the same world as a technical drawing. A way of looking, never saved into the world.'])}<i class="hsep" aria-hidden="true"></i>${VIEW_TOOLS.map(vt).join('')}<i class="hsep" aria-hidden="true"></i>
        <button class="skychip" data-action="sky" aria-expanded="${this.sky}" style="--a:${pre.a};--b:${pre.b}" aria-label="Sky">${icon('sun', 18)}<span class="sk-h">${hh(world.sun)}</span><span class="sk-n">${esc(pre.label)}</span></button>`;
    });
  },

  /* The Sky: a popover under its chip. Built once per opening so the slider keeps its drag;
     the hour, the sun on the stage and the preset follow it live. */
  renderSky() {
    const el = this.els.sky;
    if (!this.sky || this.view !== 'stage') { el.hidden = true; this.sig.sky = null; return; }
    const pre = skyPresetAt(world.sun);
    if (this.sig.sky !== 'open') {
      this.sig.sky = 'open';
      el.innerHTML = `<header><b>Sky</b><button class="x" data-action="sky" aria-label="Close the Sky (Esc)">${icon('close', 16)}</button></header>
        <div class="presets" role="radiogroup" aria-label="Time of day">${SKY_PRESETS.map((p) => `<button class="pre" data-sky="${p.id}" role="radio" style="--a:${p.a};--b:${p.b}"><i></i><span>${p.label}</span></button>`).join('')}</div>
        <label class="hour"><span>Hour</span><input id="hour" type="range" min="5" max="21" step="0.25" aria-label="Hour of the day"><output></output></label>
`;
    }
    const inp = el.querySelector('#hour');
    if (document.activeElement !== inp || !this.skyLive) inp.value = world.sun;
    el.querySelector('output').textContent = hh(world.sun);
    el.querySelectorAll('.pre').forEach((b) => { const on = b.dataset.sky === pre.id && Math.abs(pre.t - world.sun) < 0.5; b.classList.toggle('on', on); b.setAttribute('aria-checked', on); });
    el.hidden = false;
  },

  renderReadout() {
    const last = HIST.undo[HIST.undo.length - 1];
    // Suggestions phrased for the scenario on screen come first.
    const all = TRY[T.tool] || [], here = (t) => t.toLowerCase().startsWith(this.scenario);
    const tries = [...all.filter(here), ...all.filter((t) => !here(t))], tr = tries[this.trySeq % Math.max(1, tries.length)];
    this.gate('readout', [T.state, last && last.label, HIST.undo.length, T.tool, this.trySeq, this.roMin, this.scenario].join('|'), () => {
      this.els.readout.classList.toggle('min', !!this.roMin);
      if (this.roMin) { this.els.readout.innerHTML = `<button class="ro-h ro-tog" data-action="readout" aria-expanded="false">Prototype readout${icon('chevron', 14)}</button>`; return; }
      const word = (s, cls = '') => (s.id === T.state ? `<b class="${cls}" title="${esc(s.note)}">${s.label}</b>` : `<span title="${esc(s.note)}">${s.label}</span>`);
      const chain = STATES.map((s) => word(s)).join(' <i>›</i> ');
      const exits = STATE_EXITS.map((s) => word(s, `ex-${s.id}`)).join(' or ');
      this.els.readout.innerHTML = `<button class="ro-h ro-tog" data-action="readout" aria-expanded="true">Prototype readout${icon('chevron-up', 14)}</button>
        <p class="ro-chain">${chain}</p><p class="ro-ex">Leaves by ${exits}</p>
        <p class="ro-last">${last ? `Last step <b>${esc(last.label)}</b>` : 'No steps yet'}</p>
        ${tr ? `<p class="ro-try"><span>Try</span> ${esc(tr)}${tries.length > 1 ? ` <button data-action="try" title="Another suggestion">next</button>` : ''}</p>` : ''}`;
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
      this.els.spec.innerHTML = `<header><span class="sp-ico" style="--mark:${fam ? fam.mark : '#f3f0e4'}">${icon(t.icon, 22)}</span><div><h2>${t.name}</h2><span>${fam ? fam.name : t.group === 'view' ? 'View' : 'Utility'} · key ${t.key}</span></div><button class="x" data-action="spec" title="Close">${icon('close', 16)}</button></header>
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
    const seen = new Set(), rects = [], floor = VIEW.h - this.edgeH - 40;
    const toScreen = (at) => P(at.x, at.y, at.z != null ? at.z : hAt(at.x, at.y) + 0.15);
    const place = (c, mode) => {
      if (!c.at) return;
      const s = toScreen(c.at);
      // The dot stays on the consequence; only the label steps aside, joined by a leader.
      const x = clamp(s.x, 12, VIEW.w - 200), y = clamp(s.y, 60, floor);
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
    el.style.transform = `translate(${Math.round(clamp(s.x + 14, 8, VIEW.w - 260))}px, ${Math.round(clamp(s.y - 14, 70, floor + 10))}px) translateY(-100%)`;
  },

  toast(m) {
    const el = document.createElement('div'); el.className = 'toast'; el.textContent = m;
    this.els.toasts.appendChild(el);
    requestAnimationFrame(() => el.classList.add('in'));
    setTimeout(() => { el.classList.remove('in'); setTimeout(() => el.remove(), 260); }, 2600);
    while (this.els.toasts.children.length > 3) this.els.toasts.firstChild.remove();
  },
};

// ── selection actions: operations on what already exists ──────────────────────
const roomOf = (id) => { const r = byId(world, id); if (!r) return null; return r.kind === 'rooms' ? r.item : world.rooms.find((x) => x.id === r.item.roomId); };
const SEL_ACT = {
  roof(id, v) { const room = roomOf(id); if (room) setRoomRoof(room.id, v); },
  pitch(id, v) { const room = roomOf(id), cur = room && world.roofs.find((x) => x.roomId === room.id); if (cur) setRoomRoof(room.id, cur.style, v); },
  straighten(id) { CARD_EDITS.straighten(id); },
  opening() { armTool('opening'); },
  paint(id) { const r = byId(world, id); armTool('paint'); setOpt('scope', r && r.kind === 'buildings' ? 'room' : 'wall'); },
  turn(id) { editProp(id, `Turn ${nameOf(id)}`, (it) => { it.r += Math.PI / 2; }, { intent: 'scene.instance.turn', id, by: 90 }); },
  replace(id) { UI.openLibrary('replace', id); },
  stopAim(id) { CARD_EDITS.stopAim(id); },
  save(id) { toast(`${nameOf(id)} is saved to the Library as a composed thing. Simulated: the entry is not kept.`); },
  erase() { eraseSelection(); },
  duplicate(id) {
    const r = byId(world, id); if (!r) return;
    let made = null;
    if (r.kind === 'objects') {
      const o = r.item, d = OBJECTS[o.item].w + 0.5, off = { x: Math.cos(o.r) * d, y: Math.sin(o.r) * d };
      plainCommit(`Duplicate ${o.name}`, (w) => { const n = nid(w, 'object', OBJ_LABEL[o.item]); made = n.id; w.objects.push({ ...structuredClone(o), id: n.id, name: n.name, x: o.x + off.x, y: o.y + off.y }); },
        { intent: 'scene.instance.duplicate', of: id, by: pt2(off) });
    } else if (r.kind === 'forms') {
      const f = r.item, xs = f.pts.map((p) => p.x), dx = Math.max(...xs) - Math.min(...xs) + 0.5;
      const pts = f.pts.map((p) => ({ x: p.x + dx, y: p.y })), c = G.centroid(pts), under = formAt(c.x, c.y, f.id);
      const base = under ? under.base + under.h : f.on ? hAt(c.x, c.y) : f.base;
      plainCommit(`Duplicate ${f.name}`, (w) => { const n = nid(w, 'form', f.name.replace(/ \d+$/, '')); made = n.id; w.forms.push({ ...structuredClone(f), id: n.id, name: n.name, pts, base, on: under ? under.id : null }); },
        { intent: 'scene.form.duplicate', of: id, by: [r2(dx), 0] });
    }
    if (made) { finishCommit(`Duplicate ${r.item.name}`, [made]); selectId(made); }
  },
};

// ── the selection Card: properties of the selected thing ──────────────────────
const WINDOW_OPTIONS = [{ v: 'none', icon: 'win-none', label: 'No windows' }, { v: 'sparse', icon: 'win-sparse', label: 'Few windows' }, { v: 'regular', icon: 'win-regular', label: 'Regular windows' }];
const segBtns = (edit, id, cur, opts) => `<div class="seg sm">${opts.map(([v, t, title]) => `<button class="opt${String(cur) === String(v) ? ' on' : ''}" data-edit="${edit}" data-id="${id}" data-v="${v}" aria-label="${esc(title || t)}"><span class="tx">${t}</span></button>`).join('')}</div>`;
const iconSeg = (edit, id, cur, options) => `<div class="seg sm">${options.map((o) => `<button class="opt${cur === o.v ? ' on' : ''}" data-edit="${edit}" data-id="${id}" data-v="${o.v}" aria-label="${esc(o.label)}">${o.icon ? icon(o.icon, 18) : `<span class="tx">${o.text}</span>`}</button>`).join('')}</div>`;
const link = (id) => { const r = byId(world, id); return r ? `<button class="ln" data-sel="${id}">${esc(r.item.name)}</button>` : ''; };
const swatch = (m) => `<span class="mini" style="--c:${MATERIALS[m] ? MATERIALS[m].color : '#ddd'}"></span>${MATERIALS[m] ? MATERIALS[m].label : 'Default'}`;
function cardHtml(r) {
  const it = r.item, id = it.id, rows = [], rel = [];
  const row = (k, v) => rows.push(`<div class="cr"><span>${k}</span><div>${v}</div></div>`);
  if (r.kind === 'walls') {
    row('Height', segBtns('wallHeight', id, Object.keys(H_WALL).find((k) => H_WALL[k] === it.height) || '', [['low', '1.2 m', 'Garden wall'], ['room', '3 m', 'Room'], ['tall', '4.5 m', 'Hall']]));
    row('Shape', it.bulge ? `Curved, ${fmt(Math.abs(it.bulge), 2)} m bend` : 'Straight · pull the gold knob to curve');
    row('Length', `${fmt(wallLen(it), 2)} m`);
    row('Faces', `${swatch(it.mat[0])} / ${swatch(it.mat[1])}`);
    roomsOfWall(id).forEach((rm) => rel.push(`Encloses ${link(rm.id)}`));
    world.openings.filter((o) => o.hostId === id).forEach((o) => rel.push(`Hosts ${link(o.id)}`));
    world.art.filter((a) => a.wallId === id).forEach((a) => rel.push(`Carries ${link(a.id)}`));
  } else if (r.kind === 'buildings') {
    row('Storeys', segBtns('storeys', id, it.floors, [[1, '1'], [2, '2'], [3, '3'], [4, '4'], [5, '5']]));
    const roofs = it.shape === 'circle' ? [['cone', 'Cone'], ['flat', 'Flat']] : [['gable', 'Gable'], ['hip', 'Hip'], ['flat', 'Flat']];
    row('Roof', segBtns('broof', id, it.roof, roofs));
    row('Windows', iconSeg('windows', id, it.windows, WINDOW_OPTIONS));
    row('Walls', `${swatch(it.mat)}${Object.keys(it.overrides).length ? ` · ${Object.keys(it.overrides).length} face override` : ''}`);
    const twins = world.buildings.filter((b) => b.style === it.style).length;
    row('Definition', `${esc(it.style)} <small>${twins} placed</small>`);
    rel.push('Walls, roof and windows are generated from the definition');
    world.openings.filter((o) => o.hostId === id).forEach((o) => rel.push(`Explicit ${link(o.id)}${o.origin ? ` · made with ${esc(o.origin)}` : ''}`));
  } else if (r.kind === 'openings') {
    row('Kind', iconSeg('okind', id, it.kind, TOOLS.opening.palette[0].options));
    row('Size', `${fmt(it.width, 1)} × ${fmt(Math.min(it.height, 9), 1)} m${it.sill ? `, sill ${fmt(it.sill, 1)} m` : ''}`);
    rel.push(`In ${link(it.hostId)}${it.hostKind === 'building' && it.floor ? ` · storey ${it.floor + 1}` : ''}`);
    rel.push(it.origin ? `Made with ${esc(it.origin)}` : 'Ordinary opening');
    if (it.hostKind === 'wall') { const rs = roomsOfWall(it.hostId); if (rs.length === 2 && !OPENING_KINDS[it.kind].blind) rel.push(`Connects ${link(rs[0].id)} and ${link(rs[1].id)} (derived)`); }
  } else if (r.kind === 'roofs') {
    const room = world.rooms.find((x) => x.id === it.roomId);
    const styles = (room ? roomRoofStyles(room) : Object.keys(ROOF_STYLES)).filter((v) => v !== 'none').map((v) => ({ v, icon: ROOF_STYLES[v].icon, label: ROOF_STYLES[v].label }));
    row('Style', iconSeg('rstyle', id, it.style, styles));
    row('Pitch', segBtns('rpitch', id, it.pitch, PITCHES.map((p) => [p.v, p.text, p.label])));
    row('Covering', swatch(it.mat));
    rel.push(`Over ${link(it.roomId)}`);
  } else if (r.kind === 'rooms') {
    const roof = world.roofs.find((x) => x.roomId === id);
    row('Area', `${fmt(Math.abs(G.area(roomPoly(it) || [])), 1)} m²`);
    row('Floor', swatch(it.floor));
    row('Roof', roof ? link(roof.id) : 'Open to the sky');
    rel.push('Comes from its walls; erase a wall to open it');
    it.wallIds.forEach((w) => rel.push(`Wall ${link(w)}`));
  } else if (r.kind === 'objects') {
    row('Item', OBJ_LABEL[it.item]);
    row('Turn', `${Math.round(((it.r * 180) / Math.PI % 360 + 360) % 360)}°`);
    const f = formAt(it.x, it.y);
    rel.push(f ? `Stands on ${link(f.id)} · placed, not attached` : 'Placed, not attached to anything');
  } else if (r.kind === 'forms') {
    row('Height', `${fmt(it.h, 1)} m <small>pull the gold square</small>`);
    row('Finish', iconSeg('fmat', id, it.mat, TOOLS.form.palette.find((g) => g.id === 'finish').options.map((o) => ({ v: o.v, label: o.label, text: `<i class="mini" style="--c:${o.color}"></i>` }))));
    row('Footprint', `${fmt(Math.abs(G.area(it.pts)), 1)} m²`);
    rel.push(it.on ? `Rests on ${link(it.on)}` : 'Rests on the floor or ground');
    world.forms.filter((g) => g.on === id).forEach((g) => rel.push(`Carries ${link(g.id)}`));
    world.objects.filter((o) => { const f = formAt(o.x, o.y); return f && f.id === id; }).forEach((o) => rel.push(`Carries ${link(o.id)} · moves with it`));
  } else if (r.kind === 'art') {
    row('Frame', iconSeg('asize', id, it.size, FRAME_SIZES));
    row('Hang line', `${fmt(it.line, 2)} m`);
    rel.push(`Hangs on ${link(it.wallId)}`);
    world.lights.filter((l) => l.aimAt === id).forEach((l) => rel.push(`Lit by ${link(l.id)} (keeps aimed)`));
  } else if (r.kind === 'lights') {
    row('Fixture', TOOLS.light.palette[0].options.find((o) => o.v === it.kind).label);
    if (it.kind === 'spot') row('Aim', it.aimAt ? `Keeps aimed at ${link(it.aimAt)}` : it.aimPoint ? 'Aimed once · no relationship' : 'Not aimed');
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
  return `<header><div><span class="ck">${KIND_NAME[r.kind]}</span><h2>${esc(it.name)}</h2></div><span class="owner${owner === 'Needs an owner' ? ' needs' : ''}" title="The authority that owns this subject">${owner}</span><button class="x" data-action="card-close" aria-label="Deselect (Esc)">${icon('close', 16)}</button></header>
    <div class="crs">${rows.join('')}</div>
    ${rel.length ? `<div class="rel"><h3>Relationships</h3><ul>${rel.map((x) => `<li>${x}</li>`).join('')}</ul></div>` : ''}
    <footer><span class="note">${r.kind === 'rooms' ? 'A derived room cannot be erased on its own. ' : ''}Each change is one undo step.</span></footer>`;
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
  fmat(id, v) { editProp(id, `${nameOf(id)} in ${MATERIALS[v].label.toLowerCase()}`, (it) => { it.mat = v; }, { intent: 'scene.material.assign', target: id, material: v }); },
  asize(id, v) { editProp(id, `Resize ${nameOf(id)}`, (it) => { it.size = v; }, { intent: 'scene.instance.setSize', id, size: v }); },
  stopAim(id) { editProp(id, `${nameOf(id)} stops aiming`, (it) => { const a = world.art.find((x) => x.id === it.aimAt); it.aimPoint = a ? artCentre(a) : null; it.aimAt = null; }, { intent: 'scene.light.clearAim', light: id, keepsDirection: true }); },
  pwidth(id, v) { editProp(id, `${nameOf(id)} to ${v} m`, (it) => { it.width = +v; }, { intent: 'landscape.path.setWidth', path: id, width: +v }); },
  psurface(id, v) { editProp(id, `${nameOf(id)}: ${v}`, (it) => { it.surface = v; }, { intent: 'landscape.path.setSurface', path: id, surface: v }); },
  pslope(id, v) { editProp(id, `${nameOf(id)}: ${v} on slopes`, (it) => { it.slope = v; }, { intent: 'landscape.path.slope', path: id, as: v }); },
  crossing(id, v, i) { editProp(id, `${nameOf(id)}: ${v === 'none' ? 'wade' : v} at crossing ${+i + 1}`, (it) => { it.crossings[+i].mode = v; }, { intent: 'landscape.path.crossing', path: id, crossing: +i, as: v }); },
};
