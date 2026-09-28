// Objects & Assemblies — fixture and pure domain rules.
// No DOM, no Three.js. Everything here is SIMULATED: the "sources" are what a truthful
// importer would report for two prepared files, and compileLayout() stands in for the
// canonical Layout compiler. None of these shapes is a proposed schema.

// ---------------------------------------------------------------- option vocabularies
export const FINISH = {
  brass: { name: 'Brushed brass', color: '#B38F57', metal: 0.75, rough: 0.34 },
  black: { name: 'Matte black', color: '#2B2D30', metal: 0.2, rough: 0.74 },
  opal: { name: 'Opal white', color: '#ECE9E1', metal: 0.0, rough: 0.46 },
  sage: { name: 'Sage', color: '#8EA48B', metal: 0.1, rough: 0.6 },
};
export const GLASS = {
  frosted: { name: 'Frosted', color: '#F7F3EA', opacity: 0.94 },
  clear: { name: 'Clear', color: '#CFE3EA', opacity: 0.32 },
};
export const PAINT = {
  chalk: { name: 'Chalk white', color: '#EAE5DA' },
  oak: { name: 'Oiled oak', color: '#B98D5E' },
  graphite: { name: 'Graphite', color: '#4B5056' },
};
const SETS = { finish: FINISH, glass: GLASS, paint: PAINT };
export const optName = (type, v) => SETS[type]?.[v]?.name ?? String(v);
export const optColor = (type, v) => SETS[type]?.[v]?.color ?? '#999';

// ---------------------------------------------------------------- simulated sources
// A source revision is what ingest found in one exported file. Part identity comes from
// the file's declared part manifest (ids), never from mesh names or order.
const LAMP_R1 = {
  rev: 1,
  exported: '2026-08-14',
  sha: '5e1c07d4…9a02',
  bytes: '1.84 MB',
  exporter: 'Blender 4.2 · glTF 2.0',
  manifest: 'Declared part manifest (4 parts, stable ids)',
  parts: [
    { id: 'p.base', name: 'Base', parent: null, shape: 'disc' },
    { id: 'p.arm', name: 'Arm', parent: 'p.base', shape: 'rod' },
    { id: 'p.shade', name: 'Shade', parent: 'p.arm', shape: 'cone' },
    { id: 'p.diffuser', name: 'Diffuser', parent: 'p.shade', shape: 'disc', enclosedBy: 'p.shade' },
  ],
  renderOnly: [
    { name: 'bulb_glow', under: 'p.shade' },
    { name: 'cable_01', under: 'p.arm' },
  ],
  features: [
    { id: 'slot.finish', name: 'Shade finish', kind: 'slot', type: 'finish', part: 'p.shade', options: ['brass', 'black', 'opal'], def: 'brass' },
    { id: 'slot.glass', name: 'Diffuser glass', kind: 'slot', type: 'glass', part: 'p.diffuser', options: ['frosted', 'clear'], def: 'frosted' },
    { id: 'a.tilt', name: 'Arm tilt', kind: 'artic', part: 'p.arm', min: -10, max: 55, def: 30, unit: '°' },
  ],
  clips: [{ name: 'demo_swing', dur: '4.0 s' }],
  pivot: 'Base centre, on the floor',
  units: 'metres — 1 unit = 1 m (checked against declared size)',
  bounds: '0.18 × 0.52 × 0.34 m',
  unsupported: ['Editing meshes', 'Selecting below the declared parts', 'Editing or retiming clips'],
};
const LAMP_R2 = {
  rev: 2,
  exported: '2026-09-26',
  sha: 'b47a9011…31ce',
  bytes: '1.91 MB',
  exporter: 'Blender 4.2 · glTF 2.0',
  manifest: 'Declared part manifest (4 parts, stable ids)',
  parts: [
    { id: 'p.base', name: 'Base', parent: null, shape: 'disc' },
    { id: 'p.arm', name: 'Arm', parent: 'p.base', shape: 'rod' },
    { id: 'p.shade', name: 'Hood', parent: 'p.arm', shape: 'dome' },
    { id: 'p.clip', name: 'Cord clip', parent: 'p.arm', shape: 'clip' },
  ],
  renderOnly: [
    { name: 'bulb_glow', under: 'p.shade' },
    { name: 'cable_01', under: 'p.arm' },
    { name: 'diffuser_ring', under: 'p.shade' },
  ],
  features: [
    { id: 'slot.finish', name: 'Hood finish', kind: 'slot', type: 'finish', part: 'p.shade', options: ['brass', 'black', 'sage'], def: 'brass' },
    { id: 'a.tilt', name: 'Arm tilt', kind: 'artic', part: 'p.arm', min: -10, max: 45, def: 30, unit: '°' },
  ],
  clips: [{ name: 'demo_swing', dur: '4.0 s' }],
  pivot: 'Base centre, on the floor',
  units: 'metres — 1 unit = 1 m (checked against declared size)',
  bounds: '0.20 × 0.50 × 0.33 m',
  unsupported: ['Editing meshes', 'Selecting below the declared parts', 'Editing or retiming clips'],
};
const RELIEF_R1 = {
  rev: 1,
  exported: '2026-07-02',
  sha: '0d93e2a8…77b1',
  bytes: '0.62 MB',
  exporter: 'Rhino 8 · glTF 2.0',
  manifest: 'None — no part manifest in the file',
  flat: true,
  meshes: 14,
  materials: 1,
  parts: [],
  renderOnly: [{ name: 'plate', under: null }, ...Array.from({ length: 13 }, (_, i) => ({ name: `slat_${String(i + 1).padStart(2, '0')}`, under: null }))],
  features: [],
  clips: [],
  pivot: 'Plate centre, on the floor',
  units: 'metres — 1 unit = 1 m (checked against declared size)',
  bounds: '1.10 × 0.86 × 0.20 m',
  unsupported: [
    'Selecting parts — none declared (its 14 meshes are render data)',
    'Changing finish — no material slots declared',
    'Articulation — none declared',
  ],
};

export const SOURCES = {
  lamp: { file: 'desk-lamp.glb', supplier: 'Studio Lumen', revs: { 1: LAMP_R1, 2: LAMP_R2 } },
  relief: { file: 'tide-relief.glb', supplier: 'M. Okafor (commission)', revs: { 1: RELIEF_R1 } },
};

// Built-in native shapes. Not imported: nothing to retain, no source revision.
export const NATIVE = {
  'N-PLINTH': {
    id: 'N-PLINTH',
    name: 'Plinth block',
    size: [0.42, 0.72, 0.42],
    features: [{ id: 'paint', name: 'Paint', kind: 'slot', type: 'paint', part: null, options: ['chalk', 'oak', 'graphite'], def: 'chalk' }],
    mounts: [{ id: 'm.cleat', name: 'Wall cleat', face: 'back', min: 0.6, max: 1.5 }],
  },
  'N-COUNTER': {
    id: 'N-COUNTER',
    name: 'Counter block',
    size: [2.2, 0.95, 0.6],
    features: [{ id: 'paint', name: 'Paint', kind: 'slot', type: 'paint', part: null, options: ['chalk', 'oak', 'graphite'], def: 'graphite' }],
    mounts: [],
  },
};
export const PLINTH = NATIVE['N-PLINTH'].size;

// ---------------------------------------------------------------- helpers
export const clone = (o) => JSON.parse(JSON.stringify(o));
export const fmt = (n, d = 2) => (Math.round(n * 10 ** d) / 10 ** d).toFixed(d);
export const deg = (n) => `${Math.round(n)}°`;
const ALPH = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
export function mint(prefix, taken) {
  for (;;) {
    let s = '';
    for (let i = 0; i < 4; i++) s += ALPH[Math.floor(Math.random() * ALPH.length)];
    const id = `${prefix}-${s}`;
    if (!taken || !taken(id)) return id;
  }
}

// ---------------------------------------------------------------- definitions & interfaces
export function defOf(doc, id) {
  return NATIVE[id] ? { ...NATIVE[id], kind: 'native' } : doc.defs[id];
}
export function defName(doc, id) {
  return defOf(doc, id)?.name ?? id;
}
export function srcRevOf(doc, defId, pin) {
  const d = doc.defs[defId];
  return SOURCES[d.src].revs[pin ?? d.lock];
}

// Flattened interface of a definition at its locked (or pinned) revision:
// parts carry an id-path relative to the definition root; features a key.
export function iface(doc, defId, pin) {
  const d = defOf(doc, defId);
  if (!d) return { kind: 'missing', parts: [], features: [], mounts: [] };
  if (d.kind === 'native') {
    return { kind: 'native', parts: [], features: d.features.map((f) => ({ ...f, key: f.id, path: [] })), mounts: d.mounts.map((m) => ({ ...m, key: m.id, comp: null })) };
  }
  if (d.kind === 'imported' || d.kind === 'flat') {
    const r = srcRevOf(doc, defId, pin);
    // Parts are addressed by declared id within the definition (flat); `parent` is
    // structure (what moves with what), not part of the address.
    return {
      kind: d.kind,
      rev: r,
      flat: !!r.flat,
      parts: r.parts.map((p) => ({ ...p, path: [p.id], leaf: p.id })),
      features: r.features.map((f) => ({ ...f, key: f.id, path: f.part ? [f.part] : [] })),
      mounts: [],
    };
  }
  // composition
  const parts = [];
  const features = [];
  const mounts = [];
  for (const c of d.comps) {
    const sub = iface(doc, c.def, c.pin);
    parts.push({ id: c.id, name: c.name, path: [c.id], comp: true, def: c.def, pin: c.pin ?? null, leaf: c.id });
    for (const p of sub.parts) parts.push({ ...p, path: [c.id, ...p.path] });
    for (const f of sub.features) features.push({ ...f, key: `${c.id}/${f.key}`, path: [c.id, ...f.path], comp: c.id, inner: f.key });
    for (const m of sub.mounts) mounts.push({ ...m, key: `${c.id}/${m.key}`, comp: c.id });
  }
  return { kind: 'composition', parts, features, mounts };
}

export function featureAt(doc, defId, key) {
  return iface(doc, defId).features.find((f) => f.key === key) ?? null;
}
export function partAt(doc, defId, path) {
  if (!path.length) return null;
  const k = path.join('/');
  return iface(doc, defId).parts.find((p) => p.path.join('/') === k) ?? null;
}
export function allowed(f, v) {
  if (!f) return false;
  if (f.kind === 'slot') return f.options.includes(v);
  if (f.kind === 'artic') return typeof v === 'number' && v >= f.min - 1e-9 && v <= f.max + 1e-9;
  return true;
}

// Every label a key ever had, so a removed target can still be named honestly.
export function keyLabel(key) {
  const inner = key.split('/').pop();
  for (const s of Object.values(SOURCES)) for (const r of Object.values(s.revs)) {
    const f = r.features.find((x) => x.id === inner);
    if (f) return f.name;
  }
  for (const n of Object.values(NATIVE)) {
    const f = n.features.find((x) => x.id === inner);
    if (f) return f.name;
  }
  return inner;
}
export function typeOfKey(key) {
  const inner = key.split('/').pop();
  for (const s of Object.values(SOURCES)) for (const r of Object.values(s.revs)) {
    const f = r.features.find((x) => x.id === inner);
    if (f) return f.type ?? f.kind;
  }
  for (const n of Object.values(NATIVE)) {
    const f = n.features.find((x) => x.id === inner);
    if (f) return f.type;
  }
  return 'value';
}
export function showValue(key, v) {
  if (v === undefined || v === null) return '—';
  if (typeof v === 'number') return deg(v);
  return optName(typeOfKey(key), v);
}

// The value chain for a key on a definition: source/native default → each composition
// that sets it. (definition defaults → allowed instance overrides; no variants here.)
export function defChain(doc, defId, key) {
  const d = defOf(doc, defId);
  if (!d) return [];
  if (d.kind === 'native') {
    const f = d.features.find((x) => x.id === key);
    return f ? [{ who: 'native', label: `${d.name} (built-in)`, value: f.def, defId }] : [];
  }
  if (d.kind === 'imported' || d.kind === 'flat') {
    const f = srcRevOf(doc, defId).features.find((x) => x.id === key);
    return f ? [{ who: 'source', label: `${d.name} · rev ${d.lock}`, value: f.def, defId }] : [];
  }
  const [cid, ...rest] = key.split('/');
  const c = d.comps.find((x) => x.id === cid);
  if (!c) return [];
  const inner = rest.join('/');
  const sub = c.pin ? pinnedChain(doc, c.def, inner, c.pin) : defChain(doc, c.def, inner);
  const out = [...sub];
  if (d.sets && key in d.sets) out.push({ who: 'def', label: d.name, value: d.sets[key], defId });
  return out;
}
function pinnedChain(doc, defId, key, pin) {
  const d = doc.defs[defId];
  const f = SOURCES[d.src].revs[pin].features.find((x) => x.id === key);
  return f ? [{ who: 'source', label: `${d.name} · rev ${pin} (pinned)`, value: f.def, defId }] : [];
}

// Effective value of a key on a placed use, with the whole chain and each layer's validity.
export function valueOf(doc, useId, key, extra) {
  const u = doc.uses[useId];
  const f = featureAt(doc, u.def, key);
  const chain = defChain(doc, u.def, key).map((l) => ({ ...l, valid: allowed(f, l.value) }));
  const own = extra && key in extra ? extra[key] : u.sets?.[key];
  if (own !== undefined) chain.push({ who: 'use', label: 'This use', value: own, valid: allowed(f, own) });
  let eff = null;
  for (let i = chain.length - 1; i >= 0; i--) if (chain[i].valid) { eff = chain[i]; break; }
  return { f, chain, value: eff ? eff.value : f?.def, from: eff, own };
}
export function inherited(doc, useId, key) {
  const u = doc.uses[useId];
  const f = featureAt(doc, u.def, key);
  const chain = defChain(doc, u.def, key).filter((l) => allowed(f, l.value));
  return chain.length ? chain[chain.length - 1] : { who: 'source', label: 'declared default', value: f?.def };
}

// Overrides set on a use, each classified against the CURRENT interface.
export function overridesOf(doc, useId) {
  const u = doc.uses[useId];
  const out = [];
  for (const [key, value] of Object.entries(u.sets || {})) {
    const f = featureAt(doc, u.def, key);
    if (!f) out.push({ key, value, status: 'unresolved', label: keyLabel(key) });
    else if (!allowed(f, value)) out.push({ key, value, status: 'incompatible', label: f.name, f });
    else out.push({ key, value, status: 'override', label: f.name, f });
  }
  return out;
}

export function usesOfDef(doc, defId) {
  // direct uses, and uses of compositions that contain it
  const direct = Object.values(doc.uses).filter((u) => u.def === defId).map((u) => u.id);
  const via = [];
  for (const d of Object.values(doc.defs)) {
    if (d.kind !== 'composition' || !d.comps.some((c) => c.def === defId)) continue;
    for (const u of Object.values(doc.uses)) if (u.def === d.id) via.push(u.id);
  }
  return { direct, via, all: [...new Set([...direct, ...via])] };
}
export function compositionsUsing(doc, defId) {
  return Object.values(doc.defs).filter((d) => d.kind === 'composition' && d.comps.some((c) => c.def === defId));
}

// ---------------------------------------------------------------- revision correspondence
// Correspondence is by declared part/feature id. Names are reported, never matched on.
export function diffSource(a, b) {
  const parts = [];
  for (const p of a.parts) {
    const q = b.parts.find((x) => x.id === p.id);
    if (!q) parts.push({ id: p.id, a: p, b: null, status: 'removed' });
    else if (q.name !== p.name || q.shape !== p.shape) parts.push({ id: p.id, a: p, b: q, status: 'changed', renamed: q.name !== p.name, reshaped: q.shape !== p.shape });
    else parts.push({ id: p.id, a: p, b: q, status: 'same' });
  }
  for (const q of b.parts) if (!a.parts.some((p) => p.id === q.id)) parts.push({ id: q.id, a: null, b: q, status: 'new' });
  const features = [];
  for (const f of a.features) {
    const g = b.features.find((x) => x.id === f.id);
    if (!g) features.push({ id: f.id, a: f, b: null, status: 'removed' });
    else {
      const notes = [];
      if (g.name !== f.name) notes.push(`renamed “${f.name}” → “${g.name}”`);
      if (f.kind === 'slot') {
        const lost = f.options.filter((o) => !g.options.includes(o));
        const got = g.options.filter((o) => !f.options.includes(o));
        if (lost.length) notes.push(`no longer offers ${lost.map((o) => optName(f.type, o)).join(', ')}`);
        if (got.length) notes.push(`adds ${got.map((o) => optName(f.type, o)).join(', ')}`);
      }
      if (f.kind === 'artic' && (f.min !== g.min || f.max !== g.max)) notes.push(`limits ${f.min}…${f.max}° → ${g.min}…${g.max}°`);
      features.push({ id: f.id, a: f, b: g, status: notes.length ? 'changed' : 'same', notes });
    }
  }
  for (const g of b.features) if (!a.features.some((f) => f.id === g.id)) features.push({ id: g.id, a: null, b: g, status: 'new' });
  // Render meshes whose NAMES resemble a removed part: shown, deliberately not linked.
  const lookalikes = [];
  for (const r of b.renderOnly) {
    if (a.renderOnly.some((x) => x.name === r.name)) continue;
    const gone = parts.filter((p) => p.status === 'removed').find((p) => r.name.toLowerCase().includes(p.a.name.toLowerCase()));
    lookalikes.push({ name: r.name, resembles: gone ? gone.a : null });
  }
  return { parts, features, lookalikes };
}

// What accepting a source revision would do to every affected use and reference.
// Works on a CANDIDATE doc in which the lock has already moved.
export function impactOn(before, cand, defId) {
  const users = usesOfDef(before, defId).all;
  const rows = [];
  for (const uid of users) {
    const b = overridesOf(before, uid);
    const c = cand.uses[uid] ? overridesOf(cand, uid) : [];
    const items = [];
    for (const o of b) {
      const now = c.find((x) => x.key === o.key);
      if (!now) continue;
      items.push({ key: o.key, value: o.value, before: o.status, after: now.status, label: now.label, f: now.f, beforeLabel: o.label });
    }
    rows.push({ use: uid, items });
  }
  return rows;
}

export function resolveRef(doc, ref) {
  const u = doc.uses[ref.target.use];
  if (!u) return { status: 'removed', why: 'The use it pointed at no longer exists.' };
  const p = partAt(doc, u.def, ref.target.path);
  if (!p) return { status: 'removed', why: `${ref.targetLabel} no longer exists in this use’s definition.` };
  if (ref.shape && p.shape && p.shape !== ref.shape) return { status: 'review', why: `Resolves to ${p.name} (same declared part), but its shape changed — framing needs review.`, part: p };
  if (ref.partName && p.name !== ref.partName) return { status: 'review', why: `Resolves to ${p.name} (renamed from ${ref.partName}). Check the wording.`, part: p };
  return { status: 'ok', why: 'Resolves.', part: p };
}

// ---------------------------------------------------------------- Layout (simulated compiler)
// Stand-in for the one canonical compiler. The prototype's "bay" is parametric: moving the
// back wall changes one number and every derived frame follows.
export const BAY = { x0: -3, x1: 3, zFront: 2.6, h: 3, t: 0.2, win: { s0: 3.3, s1: 4.5, sill: 0.85, head: 2.25 } };
export function compileLayout(L) {
  if (!L) return null;
  const zb = L.backZ;
  const walls = [];
  if (L.back) {
    walls.push({
      id: 'W-FJSK', name: 'Back wall', a: [BAY.x0, zb], b: [BAY.x1, zb], h: BAY.h, t: BAY.t, n: [0, 1], tan: [1, 0],
      len: BAY.x1 - BAY.x0, startClear: L.side ? BAY.t / 2 : 0, endClear: 0,
      openings: [{ id: 'O-7TN4', name: 'Window', ...BAY.win }],
    });
  }
  if (L.side) {
    walls.push({
      id: 'W-2HQM', name: 'Side wall', a: [BAY.x0, zb], b: [BAY.x0, BAY.zFront], h: BAY.h, t: BAY.t, n: [1, 0], tan: [0, 1],
      len: BAY.zFront - zb, startClear: L.back ? BAY.t / 2 : 0, endClear: 0, openings: [],
    });
  }
  return { id: 'L-BAY1', name: 'Gallery bay', walls, floor: { x0: -3.2, x1: 3.5, z0: -3.2, z1: 2.9 }, backZ: zb };
}
export const wallById = (C, id) => C?.walls.find((w) => w.id === id) ?? null;
export const openingById = (C, id) => {
  for (const w of C?.walls ?? []) for (const o of w.openings) if (o.id === id) return { ...o, wall: w };
  return null;
};

// Where a hung use sits: wall frame + declared mount + typed parameters.
export function hangPose(w, s, h) {
  const d = PLINTH[2];
  const x = w.a[0] + w.tan[0] * s + w.n[0] * (w.t / 2 + d / 2);
  const z = w.a[1] + w.tan[1] * s + w.n[1] * (w.t / 2 + d / 2);
  return { x, y: h, z, rotY: Math.atan2(w.n[0], w.n[1]) };
}

// Validate a hang candidate. Refusals name the fix.
export function checkHang(C, wallId, s, h, mount) {
  const w = wallById(C, wallId);
  if (!w) return { ok: false, code: 'host', reason: 'The wall it hung on is gone.', fix: 'Hang it on another wall, or set it down.' };
  const W = PLINTH[0];
  const H = PLINTH[1];
  const sMin = w.startClear + W / 2;
  const sMax = w.len - w.endClear - W / 2;
  if (s < sMin - 1e-6 || s > sMax + 1e-6) {
    return { ok: false, code: 'end', reason: `Too close to the end of the ${w.name.toLowerCase()}.`, fix: `Keep it ${fmt(sMin)}–${fmt(sMax)} m along.`, s: Math.min(sMax, Math.max(sMin, s)), h };
  }
  if (h < mount.min - 1e-6 || h > mount.max + 1e-6) {
    return { ok: false, code: 'height', reason: `The wall cleat holds ${fmt(mount.min)}–${fmt(mount.max)} m above the floor.`, fix: `Set the height between ${fmt(mount.min)} and ${fmt(mount.max)} m.`, s, h: Math.min(mount.max, Math.max(mount.min, h)) };
  }
  for (const o of w.openings) {
    const overlapS = s + W / 2 > o.s0 && s - W / 2 < o.s1;
    const overlapH = h + H > o.sill && h < o.head;
    if (overlapS && overlapH) {
      const left = o.s0 - W / 2;
      const right = o.s1 + W / 2;
      const ns = Math.abs(s - left) < Math.abs(s - right) ? left : right;
      return { ok: false, code: 'opening', reason: `That stretch of the ${w.name.toLowerCase()} is the ${o.name.toLowerCase()} (${o.id}) — the cleat needs solid wall behind it.`, fix: `Nearest solid wall: ${fmt(ns)} m along.`, s: ns, h };
    }
  }
  return { ok: true };
}

// World pose of any use: attachment wins; otherwise its own world-local placement.
export function poseOf(doc, C, uid) {
  const u = doc.uses[uid];
  if (u.attach) {
    const w = wallById(C, u.attach.host);
    if (w && !u.attach.broken) return { ...hangPose(w, u.attach.s, u.attach.h), hung: true, host: w };
    return { x: u.at[0], y: u.at[1], z: u.at[2], rotY: u.rotY, hung: true, broken: true };
  }
  return { x: u.at[0], y: u.at[1], z: u.at[2], rotY: u.rotY, hung: false };
}

// Approximate footprint (for proximity readouts only — proximity is never attachment).
export function footprint(doc, uid) {
  const u = doc.uses[uid];
  if (u.def === 'D-TR05' || doc.defs[u.def]?.kind === 'flat') return [1.1, 0.2];
  if (u.def === 'N-COUNTER') return [2.2, 0.6];
  if (doc.defs[u.def]?.kind === 'imported') return [0.2, 0.34];
  return [0.42, 0.42];
}
export function nearWalls(doc, C, uid, within = 0.35) {
  if (!C) return [];
  const p = poseOf(doc, C, uid);
  const [fw, fd] = footprint(doc, uid);
  const r = Math.max(fw, fd) / 2;
  const out = [];
  for (const w of C.walls) {
    if (doc.uses[uid].attach?.host === w.id) continue;
    // distance from the use centre to the wall's interior face, along the wall normal
    const dx = p.x - w.a[0];
    const dz = p.z - w.a[1];
    const along = dx * w.tan[0] + dz * w.tan[1];
    if (along < -0.2 || along > w.len + 0.2) continue;
    const off = dx * w.n[0] + dz * w.n[1] - w.t / 2;
    const gap = off - r;
    if (gap < within) out.push({ wall: w, gap, through: gap < 0 });
  }
  return out;
}

// ---------------------------------------------------------------- presentation references
// Authored elsewhere (Camera / Experience). This workspace only shows and resolves them.
export function seedRefs(doc) {
  const a = Object.values(doc.uses).find((u) => u.def === 'D-DL01' && u.id === 'U-A4D1') ?? Object.values(doc.uses).find((u) => u.def === 'D-DL01');
  const b = Object.values(doc.uses).find((u) => u.def === 'D-DL01' && u.id === 'U-B7Q2') ?? Object.values(doc.uses).filter((u) => u.def === 'D-DL01')[1];
  const refs = {};
  if (b) refs['R-CV31'] = { id: 'R-CV31', name: 'Shade close-up', domain: 'Camera', kind: 'View', owner: 'Camera views', target: { use: b.id, path: ['lamp', 'p.shade'] }, targetLabel: 'Shade', partName: 'Shade', shape: 'cone' };
  if (a) refs['R-EX07'] = { id: 'R-EX07', name: 'Evening glow', domain: 'Experience', kind: 'State', owner: 'Experience “Opening night”', target: { use: a.id, path: ['lamp', 'p.diffuser'] }, targetLabel: 'Diffuser', partName: 'Diffuser', shape: 'disc' };
  return refs;
}

// ---------------------------------------------------------------- initial documents
export function emptyDoc(name) {
  return { name, defs: {}, uses: {}, order: [], groups: {}, layout: null, refs: {} };
}

// Harbour café: the small second-project specimen (its own mutable state).
export function cafeDoc() {
  const d = emptyDoc('Harbour café');
  d.uses['U-HC02'] = { id: 'U-HC02', name: 'Counter', def: 'N-COUNTER', at: [0.2, 0, -0.6], rotY: 0, sets: {} };
  d.order.push('U-HC02');
  return d;
}

// Snapshot of a composition and its imported dependency, as a library revision holds it.
export function snapshotDef(doc, defId) {
  const d = clone(doc.defs[defId]);
  const deps = {};
  for (const c of d.comps) if (doc.defs[c.def]) deps[c.def] = clone(doc.defs[c.def]);
  return { def: d, deps };
}
export function sameContent(a, b) {
  const strip = (s) => {
    const d = clone(s.def);
    delete d.lib;
    delete d.scope;
    delete d.offer;
    const deps = {};
    for (const [k, v] of Object.entries(s.deps)) deps[k] = { src: v.src, lock: v.lock };
    return JSON.stringify({ d, deps });
  };
  return strip(a) === strip(b);
}
