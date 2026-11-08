'use strict';
/*
 * World creation tools — the shell around the Stage.
 *
 * One instrument at the lower edge: a forest dock tier and, above it, one ivory tier that
 * holds whichever of three things is current — the armed tool's palette, the selection's
 * actions (Select armed), or the Library. The armed key is the tab that tier hangs from.
 * The head carries the project, history and the view cluster; the Card shows the
 * selection's properties. The dark strip at the very top and the readout in the lower
 * left are instruments for reviewing the proposal, not proposed product UI.
 */

const $ = (s, r = document) => r.querySelector(s);
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const firstSentence = (s) => String(s).split(/(?<=\.)\s/)[0];
const OWNER_LABEL = { walls: 'Layout', rooms: 'Layout', openings: 'Layout', roofs: 'Layout', buildings: 'Layout', stairs: 'Layout', objects: 'Scene', forms: 'Scene', art: 'Scene', lights: 'Scene', paths: 'Needs an owner' };
const KIND_NAME = { walls: 'Wall', rooms: 'Room (derived)', openings: 'Opening', roofs: 'Roof', buildings: 'Placed building', stairs: 'Stair', objects: 'Object', forms: 'Form', art: 'Frame', lights: 'Light', paths: 'Path' };

/* Suggestions for a reviewer, per tool, phrased against the seeded scenarios. */
const TRY = {
  select: ['Click inside a closed room: the tier above the dock offers it a roof.', 'Studio: click the Stage, then drag it. The drum on it moves too.', 'Click the Cottage, then drag the gold square above its roof to change storeys.', 'Select a garden wall and pull the gold knob on its top to bend it.'],
  walls: ['Draw a Box (3) of room-height walls: closing it offers a roof. Open is the default; click the token to change it.', 'Pick Circle (4) and drag out a round room: the roof offer becomes Dome or Flat.', 'Draw a Line across the Garden path: a doorway is proposed where they cross.'],
  building: ['Press K, open Buildings and pick the Tower: the palette is set for a round footprint.', 'Drag a Box on the hill to the east: choose Plinth or Level the ground on the token.', 'Draw a footprint across the Garden path to get a door where it meets.'],
  opening: ['Hover the Tower: the opening lands on the storey you point at.', 'Try a door on an upper storey to see the refusal.', 'Arch (3) through a gallery wall connects two rooms.'],
  stair: ['Hillside scenario: drag from the foot of the terrace up onto it.', 'Studio: drag from the floor up onto the Stage.'],
  object: ['Drag across open ground: a row of the shelf item, evenly spaced. It skips what is in the way and says so.', 'Gallery: pick Frame (6), then drag along a long wall to hang a row. It skips the door.', 'Press K for the Library. Picking a vitrine puts it on the shelf.', 'Studio: place a plinth on the Stage. It stands on top.'],
  form: ['Studio: draw a Box on the Stage, move up to pull its height, click to set. It rests on the Stage.', 'Circle (4) and a tall pull makes a column; the name follows the proportions.', 'Select a form, then Duplicate. Things you compose can be saved to the Library.'],
  light: ['Drag the sun across the sky arc to dusk, or click a point on the arc.', 'Place a Spot near a frame, then change the token after release: once, keep aimed, or not aimed.', 'A pendant outside a room refuses: nothing to hang from.'],
  ground: ['Hold over open ground to raise it; Shift lowers. [ and ] change the brush.', 'Pond (6): hold across the Garden path. A bridge token appears after the stroke.', 'Stream (7): drag a stroke down the hill.', 'Terrace (5): drag a shape, move up to lift it, click to set.'],
  path: ['Draw from the Cottage across the meadow to the garden wall: a gate, steps or a bridge are proposed where they happen.', 'After release, click a token to change it. Still one undo step.'],
  plants: ['Hold to scatter trees; they skip the path, water, buildings and forms.', 'Click once for a single plant. Shift-hold clears.'],
  paint: ['Reach: Room or building, then click the Cottage. It asks: only this one, or every Cottage.', 'Studio: Reach Whole wall or form, then click the Drum.', 'Hold Alt over a wall to sample its material.'],
  erase: ['Hover a garden wall: the tag names what goes with it.', 'Studio: hover the Stage. The drum on it comes down with it.', 'Click inside a room: rooms come from walls, so it refuses.'],
  measure: ['Drag between two points. Readings are never saved.'],
  slice: ['Unchanged from the approved sheet.'],
};

/* What the selection tier says under the actions, per kind. */
const SEL_HINT = {
  walls: 'Pull the gold knob on its top to curve it.',
  rooms: 'A room comes from its walls. Roof it here; erase a wall to open it.',
  roofs: 'Open to the sky removes the roof and keeps the room.',
  buildings: 'Drag the gold square above the roof to change storeys.',
  openings: 'Its kind and size are in the Card.',
  objects: 'Drag to move. Replace keeps its place and its turn.',
  forms: 'Drag to move; what stands on it moves too. The gold square sets its height.',
  art: 'Its size and hang line are in the Card.',
  lights: 'Drag to move.',
  paths: 'Its width, surface and crossings are in the Card.',
  stairs: 'Its treads follow the rise.',
};

const UI = {
  ready: false, paletteOpen: true, lib: null, view: 'stage', spec: false, scenario: 'village',
  lastTool: null, trySeq: 0, edgeH: 150,
  sig: {}, els: {}, toks: new Map(), toastT: null,

  init() {
    this.els = { dock: $('#dock'), palette: $('#palette'), edge: $('#edge'), tip: $('#tip'), head: $('#head'), headR: $('#headR'), card: $('#card'), spec: $('#spec'), readout: $('#readout'), overlay: $('#overlay'), tag: $('#tag'), toasts: $('#toasts'), stageView: $('#stageView'), sheetView: $('#sheetView') };
    document.addEventListener('click', (e) => this.onClick(e));
    document.addEventListener('change', (e) => this.onChange(e));
    window.addEventListener('keydown', (e) => { if (this.view === 'stage') { onKey(e); this.sync(); } });
    window.addEventListener('keyup', (e) => { if (this.view === 'stage') onKeyUp(e); });
    window.addEventListener('resize', () => { resizeStage(); VIEW.dirty = true; });
    window.addEventListener('hashchange', () => this.route());
    new ResizeObserver(() => { this.edgeH = this.els.edge.offsetHeight; this.els.stageView.style.setProperty('--edge-h', `${this.edgeH}px`); }).observe(this.els.edge);
    this.initTip();
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
    const el = e.target.closest('[data-tool],[data-opt],[data-action],[data-view],[data-sel],[data-edit],[data-tok],[data-act],[data-lib],[data-lib-cat]');
    if (!el) return;
    const d = el.dataset;
    if (d.view) { this.setView(d.view); return; }
    if (d.tool) {
      const t = TOOLS[d.tool];
      // The armed key folds its tier away and back; a view tool toggles back to Select.
      if (d.tool === T.tool && !this.lib && !t.disabled) { if (t.group === 'view') armTool('select'); else this.paletteOpen = !this.paletteOpen; }
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
    else if (a === 'plan') { setPlan(!VIEW.plan); this.sync(); }
    else if (a === 'spec') { this.spec = !this.spec; document.body.classList.toggle('spec-open', this.spec); this.sync(); }
    else if (a === 'library') this.openLibrary();
    else if (a === 'library-close') { this.lib = null; this.sync(); }
    else if (a === 'reset') { loadScenario(this.scenario); armTool('select'); this.toast('Scenario reset'); }
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

  // ── tooltip: name, key and one line of what it makes ──────────────────────
  initTip() {
    const tip = this.els.tip; let cur = null, timer = null, hidAt = 0;
    const show = (el) => {
      const d = el.dataset;
      tip.innerHTML = `<b>${esc(d.tip)}</b>${d.k ? `<kbd>${esc(d.k)}</kbd>` : ''}${d.d ? `<span>${esc(d.d)}</span>` : ''}`;
      tip.hidden = false;
      const r = el.getBoundingClientRect(), tw = tip.offsetWidth, th = tip.offsetHeight;
      const x = clamp(r.left + r.width / 2 - tw / 2, 8, innerWidth - tw - 8);
      const y = r.top - th - 7 < 8 ? r.bottom + 7 : r.top - th - 7;
      tip.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
    };
    const hide = () => { clearTimeout(timer); if (!tip.hidden) hidAt = performance.now(); tip.hidden = true; };
    document.addEventListener('pointerover', (e) => {
      const el = e.target.closest('[data-tip]'); if (el === cur) return;
      cur = el; clearTimeout(timer);
      if (!el) { hide(); return; }
      const warm = !tip.hidden || performance.now() - hidAt < 500;
      timer = setTimeout(() => show(el), warm ? 0 : 420);
    });
    document.addEventListener('pointerdown', () => { hide(); cur = null; });
  },

  // ── rendering ────────────────────────────────────────────────────────────
  gate(key, sig, fn) { if (this.sig[key] === sig) return; this.sig[key] = sig; fn(); },
  sync() {
    if (!this.ready) return;
    if (T.tool !== this.lastTool) { this.lastTool = T.tool; this.trySeq = 0; }
    if (this.lib && this.lib.mode === 'replace' && !(T.sel === this.lib.target && byId(world, T.sel))) this.lib = null;
    this.renderDock(); this.renderTier(); this.renderHead(); this.renderReadout(); this.renderCard(); this.renderSpec();
    document.body.dataset.armed = T.tool;
    document.querySelectorAll('.proto [data-action="spec"]').forEach((b) => b.setAttribute('aria-pressed', this.spec));
    this.updateHash();
  },

  tierOpen() { return !!this.lib || this.paletteOpen; },

  /* The dock tier's markup, shared with the System sheet's specimens. */
  dockHtml(tool, libOpen) {
    const key = (id) => {
      const t = TOOLS[id], armed = tool === id;
      const cls = armed ? (libOpen ? ' held' : ' armed') : '';
      return `<button class="key${cls}${t.disabled ? ' off' : ''}" data-tool="${id}" aria-pressed="${armed}" aria-label="${esc(t.name)} (${t.key})" data-tip="${esc(t.name)}" data-k="${t.key}" data-d="${esc(firstSentence(t.makes))}">${icon(t.icon, 22)}</button>`;
    };
    const grp = (ids, f) => `<div class="dg"${f ? ` style="--mark:${f.mark}"` : ''}><div class="dk">${ids.map(key).join('')}</div>${f ? `<span class="cap">${f.name}</span>` : ''}</div>`;
    const lib = `<div class="dg"><div class="dk"><button class="key${libOpen ? ' armed' : ''}" data-action="library" aria-pressed="${libOpen}" aria-label="Library (K)" data-tip="Library" data-k="K" data-d="Everything you place, by kind: objects, lights, plants, building definitions and materials.">${icon('library', 22)}</button></div></div>`;
    return grp(UTILITY_LEFT) + FAMILIES.map((f) => grp(f.tools, f)).join('') + grp(UTILITY_RIGHT) + lib;
  },

  renderDock() {
    this.gate('dock', [T.tool, !!this.lib, this.tierOpen()].join('|'), () => {
      this.els.dock.innerHTML = this.dockHtml(T.tool, !!this.lib);
      this.els.edge.classList.toggle('joined', this.tierOpen());
    });
  },

  paletteHint() {
    const t = TOOLS[T.tool], has = (id) => (t.palette || []).some((g) => g.id === id);
    if (T.tool === 'ground') {
      const b = opt('brush');
      if (b === 'terrace') return 'Drag a shape, then move up or down to set its height. Click to set it.';
      if (b === 'pond') return 'Hold to paint a pond. It keeps its level and fills what it meets.';
      if (b === 'stream') return 'Drag a stroke. The stream follows the ground down.';
      return 'Hold to brush; Shift inverts. [ and ] change the size.';
    }
    if (T.tool === 'object') return isWallItem(opt('item')) ? 'Point at a wall face and click to hang. Drag along the wall for an evenly spaced row.' : 'Click to place; drag to lay a row. R turns 15°. K opens the Library.';
    if (T.tool === 'form') return `${SHAPES[opt('shape')].hint} Then move up to pull its height, and click to set.`;
    if (has('shape')) return SHAPES[opt('shape')].hint;
    return t.gesture;
  },

  renderTier() {
    const sel = T.tool === 'select' && T.sel ? byId(world, T.sel) : null;
    const sig = [T.tool, JSON.stringify(T.opts[T.tool] || {}), T.shelf.join(), this.paletteOpen, JSON.stringify(this.lib), sel ? JSON.stringify(sel.item) + world.rev : ''].join('|');
    this.gate('tier', sig, () => {
      const el = this.els.palette;
      if (!this.tierOpen()) { el.hidden = true; el.innerHTML = ''; return; }
      el.hidden = false;
      if (this.lib) { el.className = 'tier library'; el.innerHTML = this.libraryHtml(); return; }
      el.className = 'tier';
      el.innerHTML = T.tool === 'select' ? this.selectionHtml(sel) : this.paletteHtml();
    });
  },

  paletteHtml() {
    const t = TOOLS[T.tool];
    const groupHtml = (g) => {
      if (g.kind === 'action') return `<div class="pg"><span class="gl">${g.label}</span><button class="act" data-action="${g.id}" data-tip="${esc(g.text)}" data-k="K" data-d="${esc(g.note || '')}">${icon(g.icon, 18)}<span>${g.text}</span></button></div>`;
      const cur = opt(g.id), curO = g.options.find((o) => o.v === cur);
      const lab = `<span class="gl">${g.label}<b>${esc(curO ? curO.label : '')}</b></span>`;
      if (g.kind === 'swatch') {
        let prevFor = null;
        const sw = g.options.map((o) => {
          const m = MATERIALS[o.v], gap = m && prevFor && m.for !== prevFor ? ' gap' : ''; prevFor = m ? m.for : null;
          return `<button class="sw${cur === o.v ? ' on' : ''}${gap}" style="--c:${o.color}" data-opt="${g.id}" data-v="${o.v}" role="radio" aria-checked="${cur === o.v}" aria-label="${esc(o.label)}" data-tip="${esc(o.label)}"></button>`;
        }).join('');
        return `<div class="pg">${lab}<div class="opts sws" role="radiogroup" aria-label="${g.label}">${sw}</div></div>`;
      }
      const btns = g.options.map((o) => `<button class="opt${cur === o.v ? ' on' : ''}${o.gap ? ' gap' : ''}" data-opt="${g.id}" data-v="${o.v}" role="radio" aria-checked="${cur === o.v}" aria-label="${esc(o.label)}" data-tip="${esc(o.label)}" data-k="${o.key || ''}">${o.icon ? icon(o.icon, 20) : `<span class="tx">${o.text}</span>`}</button>`).join('');
      return `<div class="pg">${lab}<div class="opts" role="radiogroup" aria-label="${g.label}">${btns}</div></div>`;
    };
    const groups = groupsOf();
    return `<div class="prow"><div class="pn"><b>${t.name}</b><kbd>${t.key}</kbd></div>${groups.map(groupHtml).join('')}</div><p class="hint">${esc(this.paletteHint())}</p>`;
  },

  selectionHtml(r) {
    if (!r) return `<div class="prow"><div class="pn"><b>Select</b><kbd>V</kbd></div></div><p class="hint">Click anything to see what you can do with it. Drag a gold mark to reshape; drag empty ground to orbit.</p>`;
    const it = r.item, id = it.id;
    const act = (a, ic, text, tip) => `<button class="act" data-act="${a}" data-id="${id}" data-tip="${esc(text)}" data-d="${esc(tip || '')}">${icon(ic, 18)}<span>${text}</span></button>`;
    const choice = (label, a, cur, options) => {
      const curO = options.find((o) => o.v === cur);
      return `<div class="pg"><span class="gl">${label}<b>${esc(curO ? curO.label : '')}</b></span><div class="opts">${options.map((o) => `<button class="opt${cur === o.v ? ' on' : ''}" data-act="${a}" data-id="${id}" data-v="${o.v}" role="radio" aria-checked="${cur === o.v}" aria-label="${esc(o.label)}" data-tip="${esc(o.label)}">${o.icon ? icon(o.icon, 20) : `<span class="tx">${o.text}</span>`}</button>`).join('')}</div></div>`;
    };
    const acts = (...b) => `<div class="pg"><div class="opts">${b.filter(Boolean).join('')}</div></div>`;
    const erase = `<div class="pg end"><button class="act erase" data-act="erase" data-id="${id}" data-tip="Erase" data-k="⌫" data-d="Names what goes with it before it goes.">${icon('erase', 18)}<span>Erase</span></button></div>`;
    let body = '', canErase = true;
    if (r.kind === 'rooms' || r.kind === 'roofs') {
      const room = r.kind === 'rooms' ? it : world.rooms.find((x) => x.id === it.roomId);
      const roof = room && world.roofs.find((x) => x.roomId === room.id);
      if (room) {
        const styles = roomRoofStyles(room).map((v) => ({ v, icon: ROOF_STYLES[v].icon, label: ROOF_STYLES[v].label }));
        body = choice('Roof', 'roof', roof ? roof.style : 'none', styles) + (roof ? choice('Pitch', 'pitch', roof.pitch, PITCHES) : '');
      }
      canErase = false;
    } else if (r.kind === 'walls') body = acts(it.bulge ? act('straighten', 'shape-line', 'Straighten', 'Takes the bend out. One undo step.') : '', act('opening', 'opening', 'Opening', 'Arms Opening to cut a door or window in it.'), act('paint', 'paint', 'Paint', 'Arms Paint, reaching the whole wall.'));
    else if (r.kind === 'objects') body = acts(act('turn', 'turn', 'Turn 90°'), act('duplicate', 'duplicate', 'Duplicate', 'A copy beside it, then selected.'), act('replace', 'replace', 'Replace…', 'Swap it for something from the Library. It keeps its place and turn.'));
    else if (r.kind === 'forms') body = acts(act('duplicate', 'duplicate', 'Duplicate', 'A copy beside it, then selected.'), act('save', 'library', 'Save to Library', 'Keep this form as a reusable thing you place with Object.'), act('paint', 'paint', 'Paint', 'Arms Paint, reaching the whole form.'));
    else if (r.kind === 'buildings') body = acts(act('paint', 'paint', 'Paint', 'Arms Paint. A shared style asks before it changes every copy.'));
    else if (r.kind === 'lights' && it.aimAt) body = acts(act('stopAim', 'aim', 'Stop aiming', 'Keeps the direction; drops the relationship.'));
    return `<div class="prow"><div class="pn"><b>${esc(it.name)}</b><span>${KIND_NAME[r.kind]}</span></div>${body}${canErase ? erase : ''}</div><p class="hint">${esc(SEL_HINT[r.kind] || '')}</p>`;
  },

  libraryHtml() {
    const L = this.lib, cat = LIBRARY.find((c) => c.id === L.cat), tgt = L.mode === 'replace' ? byId(world, L.target) : null;
    const items = cat.items.filter((x) => !tgt || !isWallItem(x.v));
    const cur = tgt ? tgt.item.item : cat.id === 'objects' ? opt('item', 'object') : cat.opt ? opt(cat.opt, cat.tool) : null;
    const head = tgt
      ? `<div class="pn"><b>Replace ${esc(tgt.item.name)}</b><span>with</span></div>`
      : `<div class="pn"><b>Library</b><kbd>K</kbd></div><div class="cats" role="tablist">${LIBRARY.map((c) => `<button class="cat${c.id === L.cat ? ' on' : ''}" role="tab" aria-selected="${c.id === L.cat}" data-lib-cat="${c.id}">${c.name}</button>`).join('')}</div>`;
    const tile = (x) => `<button class="tile${x.v === cur ? ' on' : ''}" data-lib="${x.v}" data-tip="${esc(x.label)}" data-d="${esc(x.note || '')}">${x.color ? `<i class="dot" style="--c:${x.color}"></i>` : icon(x.icon, 26)}<span>${esc(x.label)}</span></button>`;
    const note = tgt ? 'Floor things only: it keeps its place and its turn. One undo step.' : cat.blurb || `Picking one arms ${TOOLS[cat.tool].name} with it.`;
    return `<div class="prow lh">${head}<button class="x" data-action="library-close" aria-label="Close the Library (Esc)" data-tip="Close" data-k="Esc">${icon('close', 16)}</button></div><div class="tiles">${items.map(tile).join('')}</div><p class="hint">${esc(note)}</p>`;
  },

  renderHead() {
    const u = HIST.undo[HIST.undo.length - 1], r = HIST.redo[HIST.redo.length - 1];
    this.gate('head', [this.scenario, u && u.label, r && r.label, HIST.undo.length, VIEW.plan, T.tool].join('|'), () => {
      this.els.head.innerHTML = `<span class="brand">Biskiq</span><span class="proj"><b>${esc(SCENARIOS[this.scenario].name)}</b><span>World</span></span>
        <span class="hist"><button data-action="undo" ${u ? '' : 'disabled'} aria-label="Undo" data-tip="${u ? `Undo ${esc(u.label)}` : 'Nothing to undo'}" data-k="⌘Z">${icon('undo', 18)}</button><button data-action="redo" ${r ? '' : 'disabled'} aria-label="Redo" data-tip="${r ? `Redo ${esc(r.label)}` : 'Nothing to redo'}" data-k="⇧⌘Z">${icon('redo', 18)}</button></span>`;
      // The view cluster: ways of looking at and reading the world. None of them makes anything.
      const vt = (id) => { const t = TOOLS[id]; return `<button class="hb${t.disabled ? ' off' : ''}" data-tool="${id}" aria-pressed="${T.tool === id}" aria-label="${t.name} (${t.key})" data-tip="${t.name}" data-k="${t.key}" data-d="${esc(firstSentence(t.makes))}">${icon(t.icon, 18)}</button>`; };
      this.els.headR.innerHTML = `<button class="hb tx" data-action="plan" aria-pressed="${VIEW.plan}" data-tip="${VIEW.plan ? 'Back to 3D' : 'Plan view'}" data-d="Every tool works in both.">${VIEW.plan ? '3D' : 'Plan'}</button>${VIEW_TOOLS.map(vt).join('')}`;
    });
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
const segBtns = (edit, id, cur, opts) => `<div class="seg sm">${opts.map(([v, t, title]) => `<button class="opt${String(cur) === String(v) ? ' on' : ''}" data-edit="${edit}" data-id="${id}" data-v="${v}" data-tip="${esc(title || t)}"><span class="tx">${t}</span></button>`).join('')}</div>`;
const iconSeg = (edit, id, cur, options) => `<div class="seg sm">${options.map((o) => `<button class="opt${cur === o.v ? ' on' : ''}" data-edit="${edit}" data-id="${id}" data-v="${o.v}" data-tip="${esc(o.label)}">${o.icon ? icon(o.icon, 18) : `<span class="tx">${o.text}</span>`}</button>`).join('')}</div>`;
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
    row('Windows', iconSeg('windows', id, it.windows, TOOLS.building.palette.find((g) => g.id === 'windows').options));
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
