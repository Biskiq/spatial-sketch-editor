/*
 * Popover and sheets: colour picker (Light & Sky radial geometry), Inspector (view only — it never
 * writes) and Import (E5 draft: collisions block, generic normals need acknowledgement, one kind
 * per registration).
 */
import * as M from './model.js';
import { U, setUi } from './ui-state.js';
import { BY_ID } from '../shared/catalogue.js';
import { TARGETS } from './stage.js';
import * as T from './thumbs.js';
import { $, h, ic, seg, range, toast, hexToHsl, hslToHex, validHex, normHex, sheenName } from './ui-kit.js';
import * as A from './actions.js';

// ================================================================== picker
let pk = null, pkFor = null;
export function renderPicker() {
  const el = $('#picker');
  const P = U.picker;
  if (!P) { el.hidden = true; el.innerHTML = ''; pkFor = null; M.S.preview && M.setPreview(null); return; }
  if (pkFor !== P) { const [hh, s, l] = hexToHsl(P.hex || '#9aa58c'); pk = { h: hh, s, l, hex: P.hex }; pkFor = P; }
  if (el.contains(document.activeElement) && document.activeElement.matches('input[type=text],.fld')) return;   // don't rebuild under a typing caret
  el.hidden = false; el.innerHTML = '';
  const W = 236; const r = P.anchor || { left: innerWidth / 2, top: innerHeight / 2, bottom: innerHeight / 2, width: 0 };
  let left = Math.min(Math.max(8, r.left + (r.width || 0) / 2 - W / 2), innerWidth - W - 8);
  const estH = 380; let top = r.top - estH - 8; if (top < 52) top = Math.min(r.bottom + 8, innerHeight - estH - 8);
  Object.assign(el.style, { left: left + 'px', top: Math.max(52, top) + 'px' });

  const dialC = h('canvas', { width: 360, height: 360, style: { width: '180px', height: '180px', borderRadius: '50%', display: 'block' } });
  const dial = h('div', { class: 'cp-dial', tabindex: 0, role: 'slider', 'aria-label': 'Hue and saturation', 'aria-valuetext': `hue ${Math.round(pk.h)}, saturation ${Math.round(pk.s * 100)}%` }, dialC);
  const cur = h('i', { style: { background: pk.hex } }), was = h('i', { style: { background: P.hex } });
  const hexF = h('input', { class: 'fld', value: pk.hex, 'aria-label': 'Hex colour', 'data-fid': 'pk-hex' });
  const lr = range({ min: 0.08, max: 0.95, step: 0.005, value: pk.l, label: 'Lightness', onInput: (v) => { pk.l = v; update(true); }, onChange: () => update(false, true) });
  lr.classList.add('ramp');
  const ramp = () => lr.style.setProperty('--ramp', `linear-gradient(90deg, ${hslToHex(pk.h, pk.s, 0.08)}, ${hslToHex(pk.h, pk.s, 0.5)}, ${hslToHex(pk.h, pk.s, 0.95)})`);

  function draw() {
    const ctx = dialC.getContext('2d'); const N = 360, R = N / 2; const img = ctx.createImageData(N, N);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const dx = x - R, dy = y - R, d = Math.hypot(dx, dy) / R; const i = (y * N + x) * 4;
      if (d > 1) { img.data[i + 3] = 0; continue; }
      const hx = hslToHex(((Math.atan2(dy, dx) * 180 / Math.PI) + 360) % 360, d, pk.l); const n = parseInt(hx.slice(1), 16);
      img.data[i] = n >> 16; img.data[i + 1] = (n >> 8) & 255; img.data[i + 2] = n & 255; img.data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    const a = pk.h * Math.PI / 180, px = R + Math.cos(a) * pk.s * R, py = R + Math.sin(a) * pk.s * R;
    ctx.lineWidth = 5; ctx.strokeStyle = '#fff'; ctx.beginPath(); ctx.arc(px, py, 14, 0, 7); ctx.stroke();
    ctx.lineWidth = 2; ctx.strokeStyle = '#12261d'; ctx.beginPath(); ctx.arc(px, py, 17, 0, 7); ctx.stroke();
  }
  function update(live, final) {
    pk.hex = hslToHex(pk.h, pk.s, pk.l); cur.style.background = pk.hex; hexF.value = pk.hex; draw(); ramp();
    dial.setAttribute('aria-valuetext', `hue ${Math.round(pk.h)}, saturation ${Math.round(pk.s * 100)}%`);
    apply({ hex: pk.hex }, final);
  }
  let dragging = false;
  const fromPointer = (e) => { const b = dialC.getBoundingClientRect(); const dx = e.clientX - b.left - b.width / 2, dy = e.clientY - b.top - b.height / 2; pk.h = ((Math.atan2(dy, dx) * 180 / Math.PI) + 360) % 360; pk.s = Math.min(1, Math.hypot(dx, dy) / (b.width / 2)); update(true); };
  dial.addEventListener('pointerdown', (e) => { dragging = true; dial.setPointerCapture(e.pointerId); fromPointer(e); });
  dial.addEventListener('pointermove', (e) => { if (dragging) fromPointer(e); });
  dial.addEventListener('pointerup', () => { dragging = false; update(false, true); });
  dial.addEventListener('keydown', (e) => {
    const k = { ArrowLeft: [-4, 0], ArrowRight: [4, 0], ArrowUp: [0, 0.03], ArrowDown: [0, -0.03] }[e.key]; if (!k) return;
    e.preventDefault(); pk.h = (pk.h + k[0] + 360) % 360; pk.s = Math.min(1, Math.max(0, pk.s + k[1])); update(false, true);
  });
  hexF.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { if (!validHex(hexF.value)) { hexF.classList.add('bad'); return; } const [hh, s, l] = hexToHsl(normHex(hexF.value)); Object.assign(pk, { h: hh, s, l }); update(false, true); hexF.blur(); }
    if (e.key === 'Escape') { e.stopPropagation(); hexF.value = pk.hex; hexF.blur(); }
  });
  hexF.addEventListener('blur', () => { hexF.value = pk.hex; hexF.classList.remove('bad'); });

  const chips = h('div', { class: 'cp-t' });
  for (const s of M.S.p.palette) chips.append(h('button', { style: { background: s.hex }, title: `${s.name} · follows the palette`, 'aria-label': s.name, onClick: () => { const [hh, sat, l] = hexToHsl(s.hex); Object.assign(pk, { h: hh, s: sat, l, hex: s.hex }); apply({ slot: s.id }, true); if (!P.slotEdit) close(); } }));

  const actions = h('div', { style: { display: 'flex', gap: '6px', marginTop: '10px', justifyContent: 'flex-end' } });
  if (P.forPaint || P.addSlot) actions.append(h('button', { class: 'btn sm', title: 'Keep this colour in the project palette so surfaces follow later changes', onClick: () => { const id = M.addPaletteSlot(pk.hex, 'Colour ' + (M.S.p.palette.length + 1)); A.arm({ kind: 'colour', slot: id }); close(); } }, ic('plus', 13), 'Add to palette'));
  actions.append(h('button', { class: 'btn sm pri', onClick: () => { apply({ hex: pk.hex }, true); close(); } }, 'Done'));

  el.append(h('div', { class: 'cpop', role: 'dialog', 'aria-label': P.title },
    h('div', { class: 'cp-h' }, h('b', {}, P.title), h('span', { class: 'cp-wn', title: 'Before · now' }, was, cur), h('button', { class: 'cp-x', 'aria-label': 'Close', onClick: () => { cancel(); close(); } }, '×')),
    dial, lr,
    h('div', { class: 'note-sm', style: { marginTop: '6px' } }, P.slotEdit ? 'Every surface following this palette colour changes with it.' : P.forFinish ? 'Previewed live on the Stage; Done or release commits.' : 'Palette colours keep surfaces linked to later palette changes.'),
    P.slotEdit ? null : chips,
    h('div', { class: 'cp-hex' }, 'Hex', hexF), actions));
  draw(); ramp();
  el.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !e.target.matches('.fld')) { e.stopPropagation(); cancel(); close(); } }, { once: true });

  function apply(c, final) {
    if (P.forPaint) { A.arm(c.slot ? { kind: 'colour', slot: c.slot } : { kind: 'colour', hex: c.hex }, { quiet: true }); return; }
    if (P.slotEdit) { if (c.hex) M.setSlot(P.slotEdit, c.hex); return; }
    if (P.addSlot) return;
    if (P.forFinish) {
      const t = P.forFinish.t, ref = M.S.p.assign[t], f = M.finishOf(ref), mode = P.forFinish.mode;
      const hasMap = BY_ID[M.look(ref, false).set].colorMap;
      const patch = mode === 'coat'
        ? { colour: 'coat', maps: { ...(f?.ov.maps || {}), colour: null }, ...(c.slot ? { slot: c.slot, coat: undefined } : { coat: c.hex, slot: undefined }) }
        : { colour: hasMap ? 'tint' : undefined, ...(c.slot ? { slot: c.slot, tint: undefined } : { tint: c.hex, slot: undefined }) };
      if (!final) { const us = A.reachUsersOf(t, ref); M.setPreview(ref, patch, us.length > 1 && U.reach === 'all' ? us : [t]); return; }
      M.setPreview(null); A.editAt(t, patch, 'colour');
    }
  }
  function cancel() { M.setPreview(null); }
  function close() { setUi({ picker: null }); }
}

// ================================================================== inspector
const LIGHTS = { studio: {}, grazing: { grazing: true }, world: { lightTurn: 0.62, exposure: 0.95, key: 0.95, bg: '#dfe2e3' } };
export function renderInspector() {
  const el = $('#inspector'); const I = U.inspector;
  el.hidden = !I.open || !I.target; if (el.hidden) { el.innerHTML = ''; return; }
  el.innerHTML = '';
  const t = I.target, ref = M.S.p.assign[t], L = M.look(ref), base = BY_ID[L.set];
  const baseLook = M.look('cat:' + base.id, false);
  const pres = I.geom;
  const over = () => ({ ...LIGHTS[I.light], lightTurn: (LIGHTS[I.light].lightTurn || 0) + I.turn, ...(I.display === 'lit' ? {} : I.display === 'colour' ? { shade: 'unlit' } : { solo: I.display }), ...(pres === 'sample' ? { window: base.frame.w * 1.4 } : {}) });
  const mk = (look, label) => {
    const c = h('canvas', { width: 640, height: 640 });
    const probe = h('div', { class: 'probe' }, 'hover to probe');
    const v = h('div', { class: 'view' }, c, probe);
    try { T.paint(look, pres === 'sample' ? 'sample' : pres, c, over()); } catch { /* not loaded */ }
    c.addEventListener('pointermove', (e) => {
      const b = c.getBoundingClientRect(); const x = Math.floor((e.clientX - b.left) / b.width * c.width), y = Math.floor((e.clientY - b.top) / b.height * c.height);
      const d = c.getContext('2d').getImageData(x, y, 1, 1).data; const hex = '#' + [d[0], d[1], d[2]].map((n) => n.toString(16).padStart(2, '0')).join('');
      const Y = 0.2126 * lin(d[0]) + 0.7152 * lin(d[1]) + 0.0722 * lin(d[2]); const Lstar = Y > 0.008856 ? 116 * Math.cbrt(Y) - 16 : 903.3 * Y;
      const m = pres === 'sample' || pres === 'chip' ? `  ·  ${(((x / c.width) - 0.5) * (pres === 'sample' ? base.frame.w * 1.4 : base.frame.w)).toFixed(3)} m` : '';
      probe.textContent = `${hex}  L* ${Lstar.toFixed(0)}${m}`;
    });
    return label ? h('figure', {}, v, h('figcaption', {}, label)) : v;
  };
  const views = I.compare ? h('div', { class: 'ab' }, mk(baseLook, 'A · curated ' + base.label), mk(L, 'B · this Finish')) : mk(L);
  const ctl = h('div', { class: 'ctl' },
    h('div', { class: 'r' }, h('span', {}, 'Shape'), seg([['sphere', 'Sphere'], ['sample', 'Flat sample'], ['chip', 'Chip'], ['tile', 'One tile']], I.geom, (v) => setUi({ inspector: { geom: v } }))),
    h('div', { class: 'r' }, h('span', {}, 'Light'), seg([['studio', 'Studio'], ['grazing', 'Grazing'], ['world', 'This World']], I.light, (v) => setUi({ inspector: { light: v } })),
      range({ min: -1.5, max: 1.5, step: 0.05, value: I.turn, label: 'Turn the light', onChange: (v) => setUi({ inspector: { turn: v } }) }),
      h('div', { class: 'note-sm' }, I.light === 'world' ? 'Approximates this project’s Sky sun (simulated here; product uses the Light & Sky world).' : I.light === 'grazing' ? 'Low light across the surface: relief and scale errors show first.' : 'Even softbox + strip: colour and sheen read.')),
    h('div', { class: 'r' }, h('span', {}, 'Display · view only'), seg([['lit', 'Lit'], ['colour', 'Colour'], ['normal', 'Normal'], ['roughness', 'Rough'], ['metal', 'Metal'], ['occlusion', 'AO']], I.display, (v) => setUi({ inspector: { display: v } }), 'mseg')),
    h('div', { class: 'r' }, h('span', {}, 'Compare'), h('label', { class: 'chk' }, h('button', { class: 'switch', role: 'switch', 'aria-checked': String(I.compare), 'aria-label': 'Compare against curated base', onClick: () => setUi({ inspector: { compare: !I.compare } }) }), 'A/B against the curated base')),
    h('dl', { class: 'facts', style: { display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '3px 10px', fontSize: '12px', margin: 0 } },
      h('dt', { class: 'note' }, 'Sheen'), h('dd', { style: { margin: 0 } }, (() => { const sc = L.ormOff ? 1 : T.scanRough(L.set), r = Math.min(1, L.rough * sc); return `${!L.ormOff && Math.abs(L.rough - 1) < 0.005 ? 'As scanned' : sheenName(r)} · r ${r.toFixed(2)}${L.ormOff ? '' : ' (×' + L.rough.toFixed(2) + ' on scan)'} · m ${L.metal.toFixed(2)}`; })()),
      h('dt', { class: 'note' }, 'Repeat'), h('dd', { style: { margin: 0 } }, `${L.tile[0].toFixed(2)} m · ${L.rot || 0}°`),
      h('dt', { class: 'note' }, 'Used by'), h('dd', { style: { margin: 0 } }, M.usersOf(ref).map(A.shortTarget).join(', '))),
    h('p', { class: 'note-sm' }, 'Inspect never writes. Change values on the Card — this view updates live.'));
  el.append(
    h('div', { class: 'sh-h' }, ic('inspect', 18), h('div', {}, h('div', { class: 'k' }, 'Inspect · ' + A.originLabel(ref)), h('b', {}, M.nameOf(ref))), h('span', { class: 'note', style: { marginLeft: 'auto' } }, A.targetLabel(t)), h('button', { class: 'cp-x', 'aria-label': 'Close inspector', onClick: () => setUi({ inspector: { open: false } }) }, '×')),
    h('div', { class: 'sh-b' }, views, ctl));
}
const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };

// ================================================================== importer
const FILES = [
  ['RoughOak_Color.jpg', 'Colour', 'sRGB base colour', 'ok'],
  ['RoughOak_Normal.png', 'Normal', 'generic name — Y direction not stated', 'ack'],
  ['RoughOak_ORM.png', 'Occlusion · Roughness · Metal', 'R · G · B', 'clash'],
  ['RoughOak_Gloss.png', 'Roughness', 'gloss, inverted to roughness', 'clash'],
  ['RoughOak_Height.png', 'Not used', 'height / displacement — later', 'skip']
];
let D = null;
export function renderImporter() {
  const el = $('#importer'); const I = U.importer;
  el.hidden = !I.open; if (el.hidden) { el.innerHTML = ''; D = null; return; }
  if (!D) D = { rough: null, flip: false, ack: false, size: '1.20', name: 'Rough Oak', targets: I.targets || (U.focus ? [U.focus.target] : []), kind: null };
  const keep = document.activeElement?.dataset?.fid;
  el.innerHTML = '';
  const kinds = [...new Set(D.targets.map((t) => TARGETS[t].kind))];
  if (!D.kind) D.kind = kinds[0] || 'layout';
  const regTargets = D.targets.filter((t) => TARGETS[t].kind === D.kind);
  const size = parseFloat(D.size); const sizeOk = Number.isFinite(size) && size >= 0.05 && size <= 20;
  const draftLook = M.recipeLook({ set: 'rough-oak' }, { rough: D.rough === 'gloss' ? 0.62 : 1, normalFlip: D.flip, tile: sizeOk ? size : 1.2 });
  const ready = D.rough && D.ack && sizeOk && D.name.trim().length >= 1 && D.name.trim().length <= 120;

  const rows = FILES.map(([fn, ch, sub, st]) => h('tr', {}, h('td', { class: 'fn' }, fn), h('td', {}, ch, h('div', { class: 'note-sm' }, sub)),
    h('td', {}, st === 'ok' ? h('span', { class: 'tag ok' }, 'ready') : st === 'skip' ? h('span', { class: 'tag fut' }, 'ignored') : st === 'ack' ? h('span', { class: 'tag ' + (D.ack ? 'ok' : 'warn') }, D.ack ? (D.flip ? '−Y confirmed' : '+Y confirmed') : 'check') : h('span', { class: 'tag ' + (D.rough ? (D.rough === (fn.includes('ORM') ? 'orm' : 'gloss') ? 'ok' : 'fut') : 'no') }, D.rough ? (D.rough === (fn.includes('ORM') ? 'orm' : 'gloss') ? 'roughness source' : 'roughness unused') : 'collision'))));
  const left = h('div', { class: 'ctl', style: { minWidth: 0 } },
    h('div', { class: 'tw' }, h('table', { class: 'files' }, h('thead', {}, h('tr', {}, h('th', {}, 'File'), h('th', {}, 'Reads as'), h('th', {}, ''))), h('tbody', {}, rows))),
    D.rough ? h('div', { class: 'okbox' }, `Roughness from ${D.rough === 'orm' ? 'ORM green channel; Gloss is ignored' : 'Gloss (inverted); ORM keeps occlusion and metal only'}.`, ' ', h('button', { class: 'linkb', onClick: () => { D.rough = null; renderImporter(); } }, 'Change'))
      : h('div', { class: 'refuse', role: 'alert' }, h('b', {}, 'Two files claim roughness. '), 'Choose one — nothing imports until you do.', h('div', { style: { marginTop: '6px' } }, seg([['orm', 'ORM green channel'], ['gloss', 'Gloss, inverted']], null, (v) => { D.rough = v; renderImporter(); }))),
    h('div', { class: 'r' }, h('span', {}, 'Normal map direction'),
      seg([[false, '+Y up · OpenGL (proposed)'], [true, '−Y · DirectX']], D.flip, (v) => { D.flip = v; D.ack = false; renderImporter(); }),
      h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: D.ack || undefined, 'data-fid': 'imp-ack', onChange: (e) => { D.ack = e.target.checked; renderImporter(); } }), 'I checked the test: bumps look raised, lit from above.')),
    h('div', { class: 'g2', style: { gap: '10px' } },
      h('div', { class: 'r' }, h('span', {}, 'Physical size'), h('div', { class: 'fldrow' }, h('input', { class: 'fld' + (sizeOk ? '' : ' bad'), value: D.size, 'data-fid': 'imp-size', 'aria-label': 'Physical size of one image in metres', onInput: (e) => { D.size = e.target.value; } , onChange: () => renderImporter(), onKeydown: (e) => { if (e.key === 'Enter') renderImporter(); } }), h('span', { class: 'unit' }, 'm per image'))),
      h('div', { class: 'r' }, h('span', {}, 'Name'), h('input', { class: 'fld', value: D.name, maxlength: 120, 'data-fid': 'imp-name', 'aria-label': 'Finish name', onInput: (e) => { D.name = e.target.value; }, onChange: () => renderImporter() }))),
    h('div', { class: 'r' }, h('span', {}, 'Register on'),
      kinds.length > 1 ? h('div', {}, h('div', { class: 'refuse' }, 'Layout surfaces and Scene objects register in separate steps. Pick one now; paint the rest from Materials afterwards — it stays one shared Finish.'), h('div', { style: { marginTop: '6px' } }, seg(kinds.map((k) => [k, `${k === 'layout' ? 'Layout surfaces' : 'Scene objects'} · ${D.targets.filter((t) => TARGETS[t].kind === k).length}`]), D.kind, (v) => { D.kind = v; renderImporter(); })))
        : h('div', { class: 'note' }, regTargets.length ? regTargets.map(A.shortTarget).join(', ') : 'Nothing selected — it lands in This project; paint it from Materials.')));
  const testC = h('canvas', { width: 360, height: 360 });
  const sampleC = h('canvas', { width: 480, height: 480 });
  const right = h('div', { class: 'ctl' },
    h('figure', {}, h('div', { class: 'view', style: { width: 'min(300px,80vw)' } }, sampleC), h('figcaption', {}, 'draft · flat sample · studio')),
    h('figure', {}, h('div', { class: 'view', style: { width: 'min(300px,80vw)' } }, testC), h('figcaption', {}, 'normal test · light from above')));
  el.append(h('div', { class: 'sh-h' }, ic('import', 18), h('div', {}, h('div', { class: 'k' }, 'Import material · draft'), h('b', {}, '5 files dropped')), h('button', { class: 'cp-x', style: { marginLeft: 'auto' }, 'aria-label': 'Cancel import', onClick: () => setUi({ importer: { open: false } }) }, '×')),
    h('div', { class: 'sh-b', style: { gridTemplateColumns: 'minmax(0,1fr) auto' } }, left, right),
    h('div', { class: 'sh-f' }, h('span', { class: 'note' }, ready ? 'Ready. One undo removes the import and its assignments.' : 'Resolve the red and amber items to continue.'),
      h('button', { class: 'btn', onClick: () => setUi({ importer: { open: false } }) }, 'Cancel'),
      h('button', { class: 'btn pri', disabled: !ready || undefined, onClick: accept }, regTargets.length ? `Import & apply to ${regTargets.length}` : 'Import')));
  try {
    T.paint(draftLook, 'sample', sampleC);
    T.paint({ ...draftLook, normalScale: 2.2 }, 'sphere', testC, { lightTurn: 0, grazing: true });
  } catch { /* textures loading */ }
  if (keep) el.querySelector(`[data-fid="${keep}"]`)?.focus();

  function accept() {
    const res = M.registerImport({ name: D.name.trim(), set: 'rough-oak', ov: { rough: D.rough === 'gloss' ? 0.62 : 1, normalFlip: D.flip || undefined, tile: size }, maps: { colour: 'RoughOak_Color.jpg', normal: 'RoughOak_Normal.png', orm: 'RoughOak_ORM.png', ...(D.rough === 'gloss' ? { gloss: 'RoughOak_Gloss.png' } : {}) }, notes: `Roughness from ${D.rough === 'orm' ? 'ORM.G' : 'Gloss (inverted)'} · normal ${D.flip ? '−Y' : '+Y'} acknowledged · height ignored.` }, regTargets, (t) => TARGETS[t].kind);
    if (res.refused) { toast('Refused: one kind per registration'); return; }
    setUi({ importer: { open: false } });
    if (regTargets[0]) A.focus(regTargets[0], 'finish');
    toast(`${D.name.trim()} is on ${regTargets.length} ${D.kind === 'layout' ? 'surfaces' : 'parts'} · paint it on ${D.kind === 'layout' ? 'objects' : 'walls'} from Materials — same Finish`);
    M.pushRecent('material', res.ref);
  }
}
