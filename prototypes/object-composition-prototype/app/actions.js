// Every command. Accepted work goes through state.accept (one candidate, one validation,
// one history entry). Inspection, previews, reach and tools are session-only.
import * as THREE from 'three';
import { S, P, D, accept, emit, undo, redo, externalEdit } from './state.js';
import {
  SOURCES, NATIVE, PLINTH, clone, fmt, deg, mint, defOf, defName, iface, featureAt, partAt, allowed, valueOf, inherited,
  overridesOf, usesOfDef, keyLabel, showValue, compileLayout, wallById, checkHang, hangPose, poseOf, seedRefs,
  snapshotDef, sameContent, impactOn, resolveRef, diffSource, nearWalls,
} from './model.js';

let stage = null;
export const bindStage = (s) => { stage = s; };
export const getStage = () => stage;
const V3 = THREE.Vector3;

// ---------------------------------------------------------------- ids (deterministic for the fixture)
const PREFER = {
  lamp: ['U-7K2F'], relief: ['U-3R8T'], plinth: ['U-P5L2'], display: ['U-A4D1', 'U-B7Q2', 'U-C9M3'],
  cafe: ['U-HC11'], group: ['G-M2P8', 'G-R4W6'], comp: ['D-DL01'], fork: ['D-DL02', 'D-HB03'],
};
function nextId(kind, prefix, doc) {
  const taken = (id) => !!(doc.uses[id] || doc.defs[id] || doc.groups[id]);
  for (const id of PREFER[kind] ?? []) if (!taken(id)) return id;
  return mint(prefix, taken);
}

// ---------------------------------------------------------------- notes
export function flash(text, tone = 'info', at = null, ms = 3800) {
  S.flash = { text, tone, at, t: performance.now(), ms };
  emit('ui');
}
export function note(text, tone = 'info') { flash(text, tone, null, 5200); }

// ---------------------------------------------------------------- selection
export const selKey = (s) => (!s ? '' : s.kind === 'use' ? [s.id, ...(s.path ?? [])].join('/') : `${s.kind}:${s.id}`);
export function select(sel, opts = {}) {
  if (sel?.kind === 'use' && !D().uses[sel.id]) return;
  if (!opts.keepReach) S.reach = null;
  if (opts.add && sel?.kind === 'use' && !sel.path?.length) {
    const ids = new Set([...(S.sel?.kind === 'use' && !S.sel.path?.length ? [S.sel.id] : []), ...S.multi]);
    if (ids.has(sel.id)) ids.delete(sel.id); else ids.add(sel.id);
    const arr = [...ids];
    S.sel = arr.length ? { kind: 'use', id: arr[arr.length - 1], path: [] } : null;
    S.multi = arr.slice(0, -1);
    S.ctx = null;
    emit('sel');
    return;
  }
  S.sel = sel;
  S.multi = [];
  if (sel?.kind === 'use') {
    S.ctx = sel.path?.length ? { use: sel.id, path: sel.path.slice(0, -1) } : S.ctx?.group && groupOf(sel.id) === S.ctx.group ? S.ctx : null;
    revealInNav(sel);
  } else if (!opts.keepCtx) S.ctx = null;
  if (S.tool === 'hang' && !(sel?.kind === 'use' && sel.id === S.instr?.use)) cancelHang(true);
  emit('sel');
}
export function selectedUses() {
  const out = [...S.multi];
  if (S.sel?.kind === 'use' && !S.sel.path?.length) out.push(S.sel.id);
  return [...new Set(out)];
}
export function groupOf(uid, doc = D()) {
  for (const g of Object.values(doc.groups)) if (g.members.includes(uid)) return g.id;
  return null;
}
function revealInNav(sel) {
  if (sel.kind !== 'use') return;
  const g = groupOf(sel.id);
  if (g) S.open.add(`g:${g}`);
  const p = sel.path ?? [];
  for (let i = 0; i < p.length; i++) S.open.add([sel.id, ...p.slice(0, i)].join('/'));
}

// Click in the Paper, honouring the entered context (descend with double-click, Alt = deepest).
export function pickSelect(hit, e) {
  if (!hit || hit.ground || hit.floor) {
    if (!e.shiftKey) { S.ctx = null; select(null); }
    return;
  }
  if (hit.wall || hit.opening) {
    select(hit.opening ? { kind: 'opening', id: hit.opening } : { kind: 'wall', id: hit.wall });
    return;
  }
  if (!hit.use) return;
  const path = hit.path ?? [];
  if (e.altKey) {
    const d = D().defs[D().uses[hit.use].def];
    if (d?.kind === 'flat' || (!path.length)) return flatRefusal(hit, e);
    select({ kind: 'use', id: hit.use, path });
    return;
  }
  if (e.shiftKey) { select({ kind: 'use', id: hit.use, path: [] }, { add: true }); return; }
  const ctx = S.ctx;
  if (ctx?.use === hit.use) {
    const pre = ctx.path;
    const inside = pre.every((x, i) => path[i] === x);
    // inside the entered branch: one level below it; a sibling branch: the same level there
    const p = inside ? path.slice(0, pre.length + 1) : path.slice(0, Math.min(path.length, pre.length + 1));
    if (!p.length) { select({ kind: 'use', id: hit.use, path: [] }); return; }
    select({ kind: 'use', id: hit.use, path: p });
    return;
  }
  const g = groupOf(hit.use);
  if (g && !(ctx?.group === g)) { S.ctx = null; select({ kind: 'group', id: g }); return; }
  if (g && ctx?.group === g) { select({ kind: 'use', id: hit.use, path: [] }, { keepCtx: true }); S.ctx = { group: g }; emit('sel'); return; }
  S.ctx = null;
  select({ kind: 'use', id: hit.use, path: [] });
}
export function descend(hit, e) {
  if (!hit?.use) return;
  const doc = D();
  const u = doc.uses[hit.use];
  const d = defOf(doc, u.def);
  const g = groupOf(hit.use);
  if (S.sel?.kind === 'group' && g === S.sel.id) {
    S.ctx = { group: g };
    select({ kind: 'use', id: hit.use, path: [] }, { keepCtx: true });
    S.ctx = { group: g };
    emit('sel');
    return;
  }
  if (d.kind === 'flat' || d.kind === 'native') return flatRefusal(hit, e);
  const cur = S.sel?.kind === 'use' && S.sel.id === hit.use ? S.sel.path ?? [] : null;
  const path = hit.path ?? [];
  const depth = cur ? cur.length + 1 : 1;
  const next = path.slice(0, depth);
  if (next.length < depth) return flatRefusal(hit, e, true);
  S.ctx = { use: hit.use, path: next.slice(0, -1) };
  select({ kind: 'use', id: hit.use, path: next });
}
function flatRefusal(hit, e, deepest) {
  const doc = D();
  const u = doc.uses[hit.use];
  const d = defOf(doc, u.def);
  const at = e ? { x: e.clientX, y: e.clientY } : null;
  if (d.kind === 'flat') flash(`${d.name} arrived flat — its ${SOURCES[d.src].revs[d.lock].meshes} meshes are render data, not parts. Select it as a whole.`, 'info', at, 4600);
  else if (d.kind === 'native') flash(`${d.name} is one native shape — it has no parts.`, 'info', at);
  else if (deepest) flash('That is the deepest declared part here.', 'info', at, 2400);
  select({ kind: 'use', id: hit.use, path: S.sel?.id === hit.use ? S.sel.path : [] });
}
export function ascend() {
  const s = S.sel;
  if (!s) { S.ctx = null; emit('sel'); return false; }
  if (s.kind === 'use' && s.path?.length) {
    const p = s.path.slice(0, -1);
    S.ctx = p.length ? { use: s.id, path: p.slice(0, -1) } : null;
    select({ kind: 'use', id: s.id, path: p }, { keepCtx: true });
    S.ctx = p.length ? { use: s.id, path: p.slice(0, -1) } : null;
    emit('sel');
    return true;
  }
  if (s.kind === 'use' && S.ctx?.group) { select({ kind: 'group', id: S.ctx.group }); return true; }
  select(null);
  S.ctx = null;
  return true;
}

// ---------------------------------------------------------------- import (simulated truthful ingest)
export function openImport() {
  S.sheet = { kind: 'import' };
  emit('ui');
}
export function startIntake(src) {
  S.sheet = null;
  S.instr = { kind: 'intake', src, phase: 'checking', place: true };
  emit('ui');
  const done = () => { if (S.instr?.kind === 'intake' && S.instr.src === src) { S.instr.phase = 'ready'; emit('ui'); } };
  if (S.motion === 'reduced' || S._instant) done(); else setTimeout(done, 650);
  if (stage) stage.lookAt(new V3(0, -0.1, 0), src === 'lamp' ? 0.9 : 1.4, { az: 0.55, el: 0.32 });
}
export function commitIntake() {
  const I = S.instr;
  if (!I || I.kind !== 'intake' || I.phase !== 'ready') return;
  const src = SOURCES[I.src];
  const isLamp = I.src === 'lamp';
  const defId = isLamp ? 'D-DK12' : 'D-TR05';
  const name = isLamp ? 'Desk light' : 'Tide relief';
  let uid = null;
  const res = accept(I.place ? `Import ${src.file} as ${name} and place one use` : `Import ${src.file} as ${name}`, I.place ? ['Resources', 'Scene'] : ['Resources'], (d) => {
    if (d.defs[defId]) return { refuse: `${name} is already in this project — place another use from Definitions.` };
    d.defs[defId] = { id: defId, name, kind: isLamp ? 'imported' : 'flat', src: I.src, lock: 1, scope: 'project', retained: true, importedAt: '2026-09-27' };
    if (I.place) {
      uid = nextId(isLamp ? 'lamp' : 'relief', 'U', d);
      const at = I.at ?? (isLamp ? [-1.1, 0, -0.7] : [1.3, 0, -0.9]);
      d.uses[uid] = { id: uid, name, def: defId, at, rotY: isLamp ? 0.25 : -0.25, sets: {} };
      d.order.push(uid);
    }
  });
  if (!res.ok) { note(res.reason, 'refuse'); return; }
  S.instr = null;
  if (uid) { select({ kind: 'use', id: uid, path: [] }); frameSel(); }
  note(isLamp ? 'Desk light added. Its articulation and clip are idle — nothing plays until you bind or preview it.' : 'Tide relief added as a whole object. It has no declared parts, slots or articulation.');
}
// A view-only specimen of what arrived, shown at the origin before anything is added.
export function intakePreviewDoc() {
  const I = S.instr;
  if (I?.kind !== 'intake' || I.phase !== 'ready') return null;
  const doc = D();
  const isLamp = I.src === 'lamp';
  const defId = isLamp ? 'D-DK12' : 'D-TR05';
  const def = doc.defs[defId] ?? { id: defId, name: isLamp ? 'Desk light' : 'Tide relief', kind: isLamp ? 'imported' : 'flat', src: I.src, lock: 1, scope: 'project' };
  return { ...doc, defs: { ...doc.defs, [defId]: def }, uses: { ...doc.uses, 'U-INTAKE': { id: 'U-INTAKE', name: def.name, def: defId, at: [0, 0, 0], rotY: 0.25, sets: {} } } };
}
export function cancelIntake() {
  S.instr = null;
  note('Import cancelled — nothing was added.');
  emit('ui');
}

// ---------------------------------------------------------------- place & edit
const SLOTS = [[-1.9, -1.72], [-0.7, -0.62], [0.2, 0.5], [-1.4, 0.8], [1.6, 0.9], [0.9, -1.7]];
function freeSpot(d) {
  const C = compileLayout(d.layout);
  for (const [x, z] of SLOTS) {
    const clear = Object.keys(d.uses).every((id) => { const p = poseOf(d, C, id); return Math.hypot(p.x - x, p.z - z) > 0.55; });
    if (clear) return [x, 0, z];
  }
  return [0, 0, 0];
}
export function addNative(nid, at) {
  let uid;
  const n = NATIVE[nid];
  const res = accept(`Add ${n.name}`, ['Scene'], (d) => {
    uid = nextId(nid === 'N-PLINTH' ? 'plinth' : 'x', 'U', d);
    d.uses[uid] = { id: uid, name: nid === 'N-PLINTH' ? 'Plinth' : n.name, def: nid, at: at ?? freeSpot(d), rotY: nid === 'N-PLINTH' ? 0.25 : 0, sets: {} };
    d.order.push(uid);
  });
  if (res.ok) { select({ kind: 'use', id: uid, path: [] }); }
  return uid;
}
export function placeUse(defId, at) {
  let uid;
  const doc = D();
  const d0 = defOf(doc, defId);
  const res = accept(`Place a use of ${d0.name}`, ['Scene'], (d) => {
    uid = nextId(d0.kind === 'composition' && d0.id === 'D-DL01' ? 'display' : 'x', 'U', d);
    d.uses[uid] = { id: uid, name: d0.name, def: defId, at: at ?? freeSpot(d), rotY: 0.25, sets: {} };
    d.order.push(uid);
  });
  if (res.ok) select({ kind: 'use', id: uid, path: [] });
  return uid;
}
export function duplicateUse(uid) {
  const doc = D();
  const u = doc.uses[uid];
  if (!u) return null;
  const d0 = defOf(doc, u.def);
  if (d0.kind === 'native') return flash('Native shapes are copied, not reused — use Make reusable first.', 'info');
  let nid;
  const C = compileLayout(doc.layout);
  const p = poseOf(doc, C, uid);
  const res = accept(`Place another use of ${d0.name}`, ['Scene'], (d) => {
    nid = nextId(u.def === 'D-DL01' ? 'display' : 'x', 'U', d);
    d.uses[nid] = { id: nid, name: u.name, def: u.def, at: [p.x + 1.2, 0, p.z + 1.1], rotY: p.rotY, sets: {} };
    d.order.push(nid);
  });
  if (res.ok) {
    select({ kind: 'use', id: nid, path: [] });
    note(`Another use of ${d0.name} — same definition, its own placement and settings. It did not copy ${u.name}’s settings.`);
  }
  return nid;
}
export function moveUse(uid, at, rotY, label) {
  const doc = D();
  const u = doc.uses[uid];
  if (u.attach && !u.attach.broken) return;
  return accept(label ?? `Move ${u.name} ${uid}`, ['Scene'], (d) => {
    d.uses[uid].at = at.map((v) => Math.round(v * 1000) / 1000);
    if (rotY != null) d.uses[uid].rotY = rotY;
  });
}
export function moveGroup(gid, delta) {
  const g = D().groups[gid];
  return accept(`Move ${g.name} (${g.members.length} members — each keeps its own placement)`, ['Scene'], (d) => {
    for (const m of d.groups[gid].members) {
      const u = d.uses[m];
      if (u.attach && !u.attach.broken) continue;
      u.at = [u.at[0] + delta[0], u.at[1], u.at[2] + delta[2]].map((v) => Math.round(v * 1000) / 1000);
    }
  });
}
export function setPlacement(uid, field, v) {
  const u = D().uses[uid];
  if (!Number.isFinite(v)) return flash('Type a number.', 'refuse');
  if (u.attach && !u.attach.broken) {
    const C = compileLayout(D().layout);
    const s = field === 's' ? v : u.attach.s;
    const h = field === 'h' ? v : u.attach.h;
    const chk = checkHang(C, u.attach.host, s, h, NATIVE['N-PLINTH'].mounts[0]);
    if (!chk.ok) { flash(`${chk.reason} ${chk.fix}`, 'refuse'); emit('ui'); return; }
    return accept(`Move ${u.name} ${uid} along ${wallById(C, u.attach.host).name}`, ['Scene'], (d) => { d.uses[uid].attach.s = s; d.uses[uid].attach.h = h; });
  }
  if (field === 'rot') return accept(`Rotate ${u.name} ${uid} to ${Math.round(v)}°`, ['Scene'], (d) => { d.uses[uid].rotY = (v * Math.PI) / 180; });
  const i = field === 'x' ? 0 : field === 'y' ? 1 : 2;
  return accept(`Move ${u.name} ${uid}`, ['Scene'], (d) => { d.uses[uid].at[i] = v; });
}
export function renameUse(uid, name) {
  name = name.trim();
  const u = D().uses[uid];
  if (!name || name === u.name) return;
  accept(`Rename ${uid} “${u.name}” → “${name}”`, ['Scene'], (d) => { d.uses[uid].name = name; });
}
export function renameComp(defId, cid, name) {
  name = name.trim();
  const c = D().defs[defId]?.comps.find((x) => x.id === cid);
  if (!c || !name || name === c.name) return;
  const n = usesOfDef(D(), defId).all.length;
  accept(`Rename component ${cid} of ${D().defs[defId].name} → “${name}” (${n} uses)`, ['Resources'], (d) => { d.defs[defId].comps.find((x) => x.id === cid).name = name; });
}
export function renameDef(defId, name) {
  name = name.trim();
  const d0 = D().defs[defId];
  if (!d0 || !name || name === d0.name) return;
  accept(`Rename definition ${defId} → “${name}”`, ['Resources'], (d) => { d.defs[defId].name = name; });
}
export function removeUse(uid) {
  const doc = D();
  const u = doc.uses[uid];
  const refs = Object.values(doc.refs).filter((r) => r.target.use === uid);
  const res = accept(`Remove ${u.name} ${uid}${refs.length ? ` (${refs.length} reference${refs.length > 1 ? 's' : ''} left unresolved)` : ''}`, ['Scene'], (d) => {
    delete d.uses[uid];
    d.order = d.order.filter((x) => x !== uid);
    for (const g of Object.values(d.groups)) { g.members = g.members.filter((m) => m !== uid); if (g.members.length < 2) delete d.groups[g.id]; }
  });
  if (res.ok) { select(null); if (refs.length) note(`${refs.map((r) => `“${r.name}”`).join(', ')} now point at a removed use — shown as unresolved, never redirected.`, 'refuse'); }
}

// ---------------------------------------------------------------- compose: definition vs group
export function openMakeReusable(ids) {
  ids = ids ?? selectedUses();
  if (ids.length < 2) return flash('Select two or more objects (Shift-click) to make one reusable definition from them.', 'info');
  const doc = D();
  const bad = ids.find((id) => doc.uses[id].attach);
  if (bad) return flash('Take hung objects off the wall first — a definition’s internal frames are world-free.', 'refuse');
  S.sheet = { kind: 'make', ids, name: 'Display light' };
  emit('ui');
}
export function makeReusable(ids, name) {
  if (S.sheet?.kind === 'make') S.sheet = null;
  const doc = D();
  const C = compileLayout(doc.layout);
  // origin: the native plinth if present, otherwise the first member
  const originId = ids.find((id) => doc.uses[id].def === 'N-PLINTH') ?? ids[0];
  const o = poseOf(doc, C, originId);
  let uid;
  let did;
  const res = accept(`Make “${name}” from ${ids.length} objects`, ['Resources', 'Scene'], (d) => {
    did = nextId('comp', 'D', d);
    const comps = [];
    const sets = {};
    const cos = Math.cos(-o.rotY);
    const sin = Math.sin(-o.rotY);
    for (const id of ids) {
      const u = d.uses[id];
      const p = poseOf(d, C, id);
      const dx = p.x - o.x;
      const dz = p.z - o.z;
      const baseId = u.def === 'N-PLINTH' ? 'plinth' : defOf(d, u.def).kind === 'imported' ? 'lamp' : u.def === 'D-TR05' ? 'relief' : id.toLowerCase();
      let cid = baseId;
      for (let n = 2; comps.some((c) => c.id === cid); n++) cid = `${baseId}-${n}`;
      comps.push({ id: cid, name: cid === 'plinth' ? 'Plinth' : cid === 'lamp' ? 'Lamp' : u.name, def: u.def, at: [dx * cos + dz * sin, p.y - o.y, -dx * sin + dz * cos].map((v) => Math.round(v * 1000) / 1000), rotY: p.rotY - o.rotY });
      for (const [k, v] of Object.entries(u.sets || {})) sets[`${cid}/${k}`] = v;
      delete d.uses[id];
      d.order = d.order.filter((x) => x !== id);
      for (const g of Object.values(d.groups)) g.members = g.members.filter((m) => m !== id);
    }
    comps.sort((a, b) => (a.id === 'plinth' ? -1 : b.id === 'plinth' ? 1 : 0));
    d.defs[did] = { id: did, name, kind: 'composition', scope: 'project', comps, sets };
    uid = nextId(did === 'D-DL01' ? 'display' : 'x', 'U', d);
    d.uses[uid] = { id: uid, name, def: did, at: [o.x, o.y, o.z], rotY: o.rotY, sets: {} };
    d.order.push(uid);
    for (const g of Object.values(d.groups)) if (g.members.length < 2) delete d.groups[g.id];
  });
  if (res.ok) {
    S.sheet = null;
    select({ kind: 'use', id: uid, path: [] });
    note(`“${name}” is now a definition in this project, used once (${uid}). Settings the objects had became its defaults.`);
  }
  return uid;
}
export function groupUses(ids) {
  ids = (ids ?? selectedUses()).filter((id) => D().uses[id]);
  if (ids.length < 2) return flash('Select two or more objects (Shift-click) to group them.', 'info');
  let gid;
  const res = accept(`Group ${ids.length} objects (organizes only)`, ['Scene'], (d) => {
    for (const g of Object.values(d.groups)) g.members = g.members.filter((m) => !ids.includes(m));
    for (const g of Object.values(d.groups)) if (g.members.length < 2) delete d.groups[g.id];
    gid = nextId('group', 'G', d);
    d.groups[gid] = { id: gid, name: `Group ${Object.keys(d.groups).length + 1}`, members: [...ids] };
  });
  if (res.ok) { S.open.add(`g:${gid}`); select({ kind: 'group', id: gid }); note('Grouped. A group only organizes: members keep their own placement and identity; nothing is reusable or connected.'); }
}
export function ungroup(gid) {
  const g = D().groups[gid];
  const res = accept(`Ungroup ${g.name}`, ['Scene'], (d) => { delete d.groups[gid]; });
  if (res.ok) select(null);
}

// ---------------------------------------------------------------- values: override, definition default, revert
export function setValue(uid, key, value, scope = 'use') {
  const doc = D();
  const u = doc.uses[uid];
  const f = featureAt(doc, u.def, key);
  if (!f) return;
  if (!allowed(f, value)) {
    flash(f.kind === 'artic' ? `${f.name} is limited to ${f.min}…${f.max}° by its declaration.` : `${showValue(key, value)} isn’t offered for ${f.name}.`, 'refuse');
    emit('ui');
    return;
  }
  if (scope === 'def') {
    const d0 = defOf(doc, u.def);
    if (d0.kind !== 'composition') return flash(`${d0.name} is imported — its defaults come from its source.`, 'refuse');
    const users = usesOfDef(doc, u.def).all;
    const keep = users.filter((id) => doc.uses[id].sets?.[key] !== undefined && allowed(f, doc.uses[id].sets[key]));
    return accept(`Set ${d0.name} default ${f.name} → ${showValue(key, value)} (${users.length - keep.length} of ${users.length} uses change)`, ['Resources'], (d) => {
      d.defs[u.def].sets = d.defs[u.def].sets ?? {};
      if (inheritedAtDef(d, u.def, key) === value) delete d.defs[u.def].sets[key];
      else d.defs[u.def].sets[key] = value;
    });
  }
  const inh = inherited(doc, uid, key);
  return accept(`${f.name} → ${showValue(key, value)} on ${u.name} ${uid} (this use)`, ['Scene'], (d) => {
    d.uses[uid].sets = d.uses[uid].sets ?? {};
    if (inh.value === value) delete d.uses[uid].sets[key];
    else d.uses[uid].sets[key] = value;
  });
}
function inheritedAtDef(d, defId, key) {
  const dd = d.defs[defId];
  const [cid, ...rest] = key.split('/');
  const c = dd.comps.find((x) => x.id === cid);
  const sub = defOf(d, c.def);
  if (sub.kind === 'native') return sub.features.find((x) => x.id === rest.join('/'))?.def;
  const r = SOURCES[sub.src].revs[c.pin ?? sub.lock];
  return r.features.find((x) => x.id === rest.join('/'))?.def;
}
export function revertValue(uid, key) {
  const doc = D();
  const u = doc.uses[uid];
  if (!(key in (u.sets || {}))) return;
  const inh = inherited(doc, uid, key);
  accept(`Revert ${keyLabel(key)} on ${u.name} ${uid} to ${inh.label} (${showValue(key, inh.value)})`, ['Scene'], (d) => { delete d.uses[uid].sets[key]; });
}
export function dropOverride(uid, key) {
  const u = D().uses[uid];
  accept(`Remove unresolved ${keyLabel(key)} setting from ${u.name} ${uid}`, ['Scene'], (d) => { delete d.uses[uid].sets[key]; });
}
export function promoteValue(uid, key) {
  const doc = D();
  const u = doc.uses[uid];
  const v = u.sets?.[key];
  const d0 = defOf(doc, u.def);
  if (v === undefined || d0.kind !== 'composition') return;
  const users = usesOfDef(doc, u.def).all;
  const change = users.filter((id) => id !== uid && doc.uses[id].sets?.[key] === undefined);
  accept(`Make ${showValue(key, v)} the ${d0.name} default ${keyLabel(key)} (${change.length} more use${change.length === 1 ? '' : 's'} change)`, ['Resources', 'Scene'], (d) => {
    d.defs[u.def].sets = d.defs[u.def].sets ?? {};
    d.defs[u.def].sets[key] = v;
    delete d.uses[uid].sets[key];
  });
}
// Reach preview: what a value change would touch, shown before it happens.
export function previewReach(uid, key, scope, value) {
  S.reach = { uid, key, scope, value };
  emit('reach');
}
export function clearReach() {
  if (!S.reach) return;
  S.reach = null;
  emit('reach');
}
export function reachOf(doc, uid, key, scope) {
  const u = doc.uses[uid];
  if (!u) return { changes: [], keeps: [], others: [] };
  if (scope === 'use') {
    const others = usesOfDef(doc, u.def).direct.filter((id) => id !== uid);
    return { changes: [uid], keeps: [], others };
  }
  const users = usesOfDef(doc, u.def).direct;
  const f = featureAt(doc, u.def, key);
  const keeps = users.filter((id) => doc.uses[id].sets?.[key] !== undefined && allowed(f, doc.uses[id].sets[key]));
  return { changes: users.filter((id) => !keeps.includes(id)), keeps, others: [] };
}
export function setReachScope(s) {
  S.reachScope = s;
  emit('ui');
}

// ---------------------------------------------------------------- inspection (view only)
export function openInspect(uid) {
  uid = uid ?? S.sel?.id;
  const doc = D();
  if (!uid || !doc.uses[uid]) return flash('Select an object to inspect.', 'info');
  const d0 = defOf(doc, doc.uses[uid].def);
  if (d0.kind === 'flat' || d0.kind === 'native') return flash(`${d0.name} has no declared parts to separate — it inspects as a whole.`, 'info');
  closeInstr(true);
  S.summary = null;
  S.instr = { kind: 'inspect', use: uid, sep: 1, from: P().undo.length, rev: P().rev };
  if (!(S.sel?.kind === 'use' && S.sel.id === uid)) select({ kind: 'use', id: uid, path: [] });
  S.ctx = { use: uid, path: [] };
  frameUse(uid, 1.9);
  emit('ui');
}
export function setSep(v) {
  if (S.instr?.kind !== 'inspect') return;
  S.instr.sep = Math.max(0, Math.min(1, v));
  emit('instr');
}
export function closeInspect() {
  const I = S.instr;
  if (I?.kind !== 'inspect') return;
  const p = P();
  const made = p.undo.slice(I.from).filter((e) => e.rev > I.rev);
  S.instr = null;
  S.summary = made.length
    ? { title: 'Back from inspection', lines: [`Separation was view only — cleared.`, ...made.map((e) => `Kept: ${e.label}`)], undoTo: I.from, n: made.length }
    : { title: 'Back from inspection', lines: ['Separation was view only — cleared. No changes were made.'], n: 0 };
  emit('ui');
}

// ---------------------------------------------------------------- articulation preview (runtime, not saved)
export function openPreview(uid, comp) {
  const doc = D();
  uid = uid ?? S.sel?.id;
  const u = doc.uses[uid];
  if (!u) return;
  const f = iface(doc, u.def).features.find((x) => x.kind === 'artic' && (!comp || x.comp === comp));
  if (!f) return flash(`${defName(doc, u.def)} declares no articulation.`, 'info');
  closeInstr(true);
  const base = valueOf(doc, uid, f.key).value;
  S.instr = { kind: 'preview', use: uid, key: f.key, value: base, base, playing: false, t: 0 };
  select({ kind: 'use', id: uid, path: f.path });
  frameUse(uid, 1.5);
  emit('ui');
}
export function previewSet(v) {
  const I = S.instr;
  if (I?.kind !== 'preview') return;
  const f = featureAt(D(), D().uses[I.use].def, I.key);
  I.value = Math.max(f.min, Math.min(f.max, v));
  I.playing = false;
  emit('instr');
}
export function previewPlay() {
  const I = S.instr;
  if (I?.kind !== 'preview') return;
  I.playing = !I.playing;
  I.t = 0;
  emit('instr');
}
export function previewReset() {
  const I = S.instr;
  if (I?.kind !== 'preview') return;
  I.playing = false;
  I.value = valueOf(D(), I.use, I.key).value;
  flash('Reset to the baseline pose.', 'info');
  emit('instr');
}
export function closePreview(silent) {
  const I = S.instr;
  if (I?.kind !== 'preview') return;
  const base = valueOf(D(), I.use, I.key).value;
  S.instr = null;
  if (!silent) note(`Preview ended — the arm returned to its baseline ${deg(base)}. Nothing was saved.`);
  emit('ui');
}
export function openKeepPose() {
  const I = S.instr;
  if (I?.kind !== 'preview') return;
  S.sheet = { kind: 'keep', uid: I.use, key: I.key, value: Math.round(I.value), scope: 'use' };
  I.playing = false;
  emit('ui');
}
export function keepPose(scope) {
  const sh = S.sheet;
  const res = setValue(sh.uid, sh.key, sh.value, scope);
  S.sheet = null;
  if (res?.ok) {
    const I = S.instr;
    if (I?.kind === 'preview') { I.base = sh.value; I.value = sh.value; }
    note(`Captured ${deg(sh.value)} as ${scope === 'use' ? 'this use’s' : 'the definition’s'} arm tilt — an explicit, undoable capture.`);
  }
  emit('ui');
}

// ---------------------------------------------------------------- architecture (Layout-owned)
export function addBay() {
  const res = accept('Add Gallery bay (prepared Layout)', ['Layout'], (d) => {
    if (d.layout) return { refuse: 'The bay is already here.' };
    d.layout = { backZ: -2.2, back: true, side: true };
  });
  if (res.ok) {
    if (stage) stage.lookAt(new V3(-0.4, 0.9, -0.6), 6.4, { az: 0.5, el: 0.42 });
    note('Architecture arrived as Layout. Your objects stayed world-local — nothing was moved into the bay or re-parented.');
    S.open.add('arch');
  }
}
export function setMode(m) {
  if (m === 'layout' && !D().layout) return flash('Add architecture first — there is no Layout yet.', 'info');
  closeInstr(true);
  S.mode = m;
  if (m === 'layout' && S.sel?.kind === 'use') select(null);
  if (m === 'arrange' && (S.sel?.kind === 'wall' || S.sel?.kind === 'opening')) { /* keep: walls are selectable in Arrange too */ }
  emit('ui');
}
export function startHang(uid) {
  uid = uid ?? (S.sel?.kind === 'use' ? S.sel.id : null);
  const doc = D();
  if (!uid) return flash('Select the object to hang first.', 'info');
  const u = doc.uses[uid];
  const mounts = iface(doc, u.def).mounts;
  if (!mounts.length) return flash(`${defName(doc, u.def)} declares no wall mount — it can’t hang on a wall.`, 'refuse');
  if (!doc.layout) return flash('There is no architecture to hang on yet.', 'info');
  closeInstr(true);
  S.mode = 'arrange';
  S.tool = 'hang';
  S.instr = { kind: 'hang', use: uid, mount: mounts[0], cand: null };
  const C = compileLayout(doc.layout);
  const wall = C.walls.find((w) => w.id === u.attach?.host) ?? C.walls[0];
  if (wall) setHangCandidate(wall.id, u.attach?.s ?? 2.3, u.attach?.h ?? 1);
  if (!(S.sel?.kind === 'use' && S.sel.id === uid)) select({ kind: 'use', id: uid, path: [] });
  emit('ui');
}
export function setHangCandidate(wall, s, h) {
  const I = S.instr;
  if (I?.kind !== 'hang') return;
  if (!Number.isFinite(s) || !Number.isFinite(h)) return flash('Type a finite distance in metres.', 'refuse');
  I.cand = { wall, s, h, chk: checkHang(compileLayout(D().layout), wall, s, h, I.mount) };
  emit('ui');
}
export function hangHover(hit) {
  const I = S.instr;
  if (I?.kind !== 'hang') return;
  const C = compileLayout(D().layout);
  if (!hit?.wall) { if (I.cand) { I.cand = null; emit('instr'); } return; }
  const w = wallById(C, hit.wall);
  const dx = hit.point.x - w.a[0];
  const dz = hit.point.z - w.a[1];
  const side = dx * w.n[0] + dz * w.n[1];
  if (side < -0.05) { I.cand = { wall: w.id, back: true }; emit('instr'); return; }
  const s = Math.round((dx * w.tan[0] + dz * w.tan[1]) / 0.05) * 0.05;
  const h = Math.round((hit.point.y - PLINTH[1] / 2) / 0.05) * 0.05;
  I.cand = { wall: w.id, s, h, chk: checkHang(C, w.id, s, h, I.mount) };
  emit('instr');
}
export function hangCommit() {
  const I = S.instr;
  if (I?.kind !== 'hang' || !I.cand) return;
  if (I.cand.back) return flash('That is the outside of the bay — hang it on the room side.', 'refuse');
  if (!I.cand.chk.ok) {
    flash(`${I.cand.chk.reason} ${I.cand.chk.fix} Nothing changed.`, 'refuse', null, 5200);
    return;
  }
  const doc = D();
  const u = doc.uses[I.use];
  const C = compileLayout(doc.layout);
  const w = wallById(C, I.cand.wall);
  const { s, h } = I.cand;
  const res = accept(`Hang ${u.name} ${I.use} on ${w.name} ${w.id} (${I.mount.name.toLowerCase()})`, ['Scene'], (d) => {
    d.uses[I.use].attach = { host: w.id, mount: `plinth/${I.mount.id}`, s: Math.round(s * 100) / 100, h: Math.round(h * 100) / 100 };
    for (const g of Object.values(d.groups)) g.members = g.members.filter((m) => m !== I.use);
    for (const g of Object.values(d.groups)) if (g.members.length < 2) delete d.groups[g.id];
  });
  S.tool = 'select';
  S.instr = null;
  if (res.ok) note(`Hung on ${w.name}. It now follows that wall. Objects merely near a wall don’t.`);
  emit('ui');
}
export function hangAt(uid, wallId, s, h) {
  // scripted equivalent of a valid click
  startHang(uid);
  const C = compileLayout(D().layout);
  S.instr.cand = { wall: wallId, s, h, chk: checkHang(C, wallId, s, h, S.instr.mount) };
  hangCommit();
}
export function cancelHang(silent) {
  if (S.instr?.kind !== 'hang') { S.tool = 'select'; return; }
  S.instr = null;
  S.tool = 'select';
  if (!silent) note('Hang cancelled — nothing changed.');
  emit('ui');
}
export function moveAlong(uid, sAlong, h) {
  const doc = D();
  const u = doc.uses[uid];
  const C = compileLayout(doc.layout);
  const w = wallById(C, u.attach.host);
  const chk = checkHang(C, w.id, sAlong, h, NATIVE['N-PLINTH'].mounts[0]);
  if (!chk.ok) { flash(`${chk.reason} Nothing changed.`, 'refuse'); return { ok: false }; }
  return accept(`Move ${u.name} ${uid} along ${w.name} to ${fmt(sAlong)} m, ${fmt(h)} m up`, ['Scene'], (d) => { d.uses[uid].attach.s = Math.round(sAlong * 100) / 100; d.uses[uid].attach.h = Math.round(h * 100) / 100; });
}
export function setDown(uid) {
  const doc = D();
  const u = doc.uses[uid];
  const C = compileLayout(doc.layout);
  const p = poseOf(doc, C, uid);
  const res = accept(`Take ${u.name} ${uid} off the wall (set down, world-local)`, ['Scene'], (d) => {
    const uu = d.uses[uid];
    delete uu.attach;
    uu.at = [Math.round(p.x * 1000) / 1000, 0, Math.round((p.z + (p.hung ? 0.12 : 0)) * 1000) / 1000];
    uu.rotY = p.rotY;
  });
  if (res.ok) note('Set down on the floor. It no longer follows any wall.');
}
export function wallMoveStart(wid) {
  if (S.mode !== 'layout') setMode('layout');
  const C = compileLayout(D().layout);
  if (!wallById(C, wid)) return;
  if (wid !== 'W-FJSK') return flash('In this prepared bay only the back wall is movable (simulated compiler).', 'info');
  S.instr = { kind: 'wallmove', wall: wid, off: 0 };
  select({ kind: 'wall', id: wid });
  S.instr = { kind: 'wallmove', wall: wid, off: 0 };
  emit('ui');
}
export function wallMoveSet(off) {
  const I = S.instr;
  if (I?.kind !== 'wallmove') return;
  const z = D().layout.backZ + off;
  I.off = Math.round(Math.max(-3.0, Math.min(-1.2, z)) * 100) / 100 - D().layout.backZ;
  emit('instr');
}
export function wallMoveCommit() {
  const I = S.instr;
  if (I?.kind !== 'wallmove') return;
  const off = Math.round(I.off * 100) / 100;
  S.instr = null;
  if (Math.abs(off) < 0.005) { emit('ui'); return; }
  const doc = D();
  const hung = Object.values(doc.uses).filter((u) => u.attach?.host === 'W-FJSK' && !u.attach.broken);
  const res = accept(`Move Back wall W-FJSK ${off > 0 ? 'into the room' : 'back'} ${fmt(Math.abs(off))} m${hung.length ? ` — ${hung.length} hung object${hung.length > 1 ? 's' : ''} followed` : ''}`, ['Layout'], (d) => { d.layout.backZ = Math.round((d.layout.backZ + off) * 100) / 100; });
  if (res.ok) {
    const C = compileLayout(D().layout);
    const through = Object.keys(D().uses).flatMap((id) => nearWalls(D(), C, id, 0).filter((n) => n.wall.id === 'W-FJSK' && n.through).map(() => id));
    note(hung.length ? `Only Layout changed. ${hung.map((u) => u.id).join(', ')} followed through its declared attachment — its own placement wasn’t edited.${through.length ? ` Warning: the wall now passes through ${through.join(', ')} (not attached, so it stayed).` : ''}` : 'Only Layout changed.', through.length ? 'warn' : 'info');
  }
}
export function wallMoveCancel() {
  if (S.instr?.kind !== 'wallmove') return;
  S.instr = null;
  note('Wall move cancelled — nothing changed.');
  emit('ui');
}
export function openRemoveWall(wid) {
  const doc = D();
  const hosted = Object.values(doc.uses).filter((u) => u.attach?.host === wid && !u.attach.broken);
  const C = compileLayout(doc.layout);
  const w = wallById(C, wid);
  if (!w) return;
  S.sheet = { kind: 'removewall', wid, name: w.name, hosted: hosted.map((u) => u.id), choice: hosted.length ? 'setdown' : 'plain' };
  emit('ui');
}
export function removeWall(wid, choice) {
  const doc = D();
  const C = compileLayout(doc.layout);
  const w = wallById(C, wid);
  const hosted = Object.values(doc.uses).filter((u) => u.attach?.host === wid && !u.attach.broken).map((u) => u.id);
  const poses = Object.fromEntries(hosted.map((id) => [id, poseOf(doc, C, id)]));
  const key = wid === 'W-FJSK' ? 'back' : 'side';
  const label = hosted.length
    ? `Remove ${w.name} ${wid} · ${choice === 'setdown' ? `set down ${hosted.join(', ')}` : `${hosted.join(', ')} left needing repair`}`
    : `Remove ${w.name} ${wid}`;
  const res = accept(label, hosted.length ? ['Layout', 'Scene'] : ['Layout'], (d) => {
    d.layout[key] = false;
    for (const id of hosted) {
      const p = poses[id];
      const u = d.uses[id];
      if (choice === 'setdown') { delete u.attach; u.at = [p.x, 0, p.z + 0.12]; u.rotY = p.rotY; }
      else { u.attach.broken = true; u.at = [p.x, p.y, p.z]; u.rotY = p.rotY; }
    }
  });
  S.sheet = null;
  if (res.ok) {
    select(hosted.length ? { kind: 'use', id: hosted[0], path: [] } : null);
    note(choice === 'repair' ? 'The attachment is kept as “host removed” — nothing was silently re-hung. Repair it from the Inspector.' : 'Removed as one action — Undo brings the wall and the attachment back together.', choice === 'repair' ? 'refuse' : 'info');
  }
}

// ---------------------------------------------------------------- offered revisions (source re-export)
export function offerRevision(defId = 'D-DK12', rev = 2) {
  const p = P();
  p.offers = p.offers ?? {};
  p.offers[defId] = { rev, from: `${SOURCES[D().defs[defId].src].file} re-export`, declined: false };
  if (!Object.keys(D().refs).length) externalEdit('Camera + Experience (elsewhere)', 'Two presentation references were authored elsewhere', (d) => { d.refs = seedRefs(d); });
  emit('ui');
}
export function offerOf(defId) {
  const o = P().offers?.[defId];
  const d = D().defs[defId];
  if (!o || !d || o.rev <= d.lock) return null;
  return o;
}
export function openReview(defId = 'D-DK12') {
  const o = offerOf(defId);
  if (!o) return;
  closeInstr(true);
  const doc = D();
  const choices = {};
  for (const uid of usesOfDef(doc, defId).all) {
    const cand = lockedCandidate(doc, defId, o.rev, {}, {});
    for (const it of impactOn(doc, cand, defId).find((r) => r.use === uid)?.items ?? []) {
      if (it.after === 'unresolved') choices[`${uid}|${it.key}`] = 'keep';
      if (it.after === 'incompatible') choices[`${uid}|${it.key}`] = 'keep';
    }
  }
  S.instr = { kind: 'review', def: defId, to: o.rev, expected: P().rev, show: 'both', choices, detach: {}, stale: null };
  S.sel = null;
  S.multi = [];
  if (stage) stage.lookAt(new V3(-1.1, 0.9, -1.4), 3.4, { az: 0.35, el: 0.28 });
  emit('ui');
}
// Candidate project: the lock moved, plus the creator's explicit repair choices.
export function lockedCandidate(doc, defId, rev, choices, detach) {
  const d = clone(doc);
  const from = d.defs[defId].lock;
  // detach first: detached uses keep an independent definition pinned to the old revision
  for (const [uid, on] of Object.entries(detach)) {
    if (!on || !d.uses[uid]) continue;
    const u = d.uses[uid];
    const src = d.defs[u.def];
    const forkId = nextId('fork', 'D', d);
    const fork = clone(src);
    fork.id = forkId;
    fork.name = `${src.name} (independent copy)`;
    fork.scope = 'project';
    fork.forkedFrom = { id: src.id, note: `detached from ${src.name} with ${d.defs[defId].name} rev ${from}` };
    delete fork.lib;
    if (fork.comps) {
      for (const c of fork.comps) if (c.def === defId) c.pin = from;
    } else fork.lock = from;
    fork.sets = { ...(fork.sets || {}), ...(u.sets || {}) };
    d.defs[forkId] = fork;
    u.def = forkId;
    u.sets = {};
  }
  d.defs[defId].lock = rev;
  for (const [k, v] of Object.entries(choices)) {
    const [uid, key] = k.split('|');
    const u = d.uses[uid];
    if (!u || detach[uid]) continue;
    const f = featureAt(d, u.def, key);
    if (v === 'drop' || v === 'default') delete u.sets[key];
    else if (v === 'clamp' && f?.kind === 'artic') u.sets[key] = Math.max(f.min, Math.min(f.max, u.sets[key]));
  }
  return d;
}
export function reviewCandidate() {
  const I = S.instr;
  return lockedCandidate(D(), I.def, I.to, I.choices, I.detach);
}
export function reviewChoose(k, v) {
  if (S.instr?.kind !== 'review') return;
  S.instr.choices[k] = v;
  emit('ui');
}
export function reviewDetach(uid, on) {
  if (S.instr?.kind !== 'review') return;
  S.instr.detach[uid] = on;
  emit('ui');
}
export function reviewShow(m) {
  if (S.instr?.kind !== 'review') return;
  S.instr.show = m;
  emit('ui');
}
export function acceptReview() {
  const I = S.instr;
  if (I?.kind !== 'review') return;
  const cand = reviewCandidate();
  const d0 = D().defs[I.def];
  const nRepairs = Object.values(I.choices).filter((v) => v !== 'keep').length + Object.values(I.detach).filter(Boolean).length;
  const left = Object.entries(I.choices).filter(([k, v]) => v === 'keep' && !I.detach[k.split('|')[0]]).length;
  const res = accept(`Accept ${d0.name} rev ${I.to}${nRepairs ? ` · ${nRepairs} repair${nRepairs > 1 ? 's' : ''}` : ''}${left ? ` · ${left} left unresolved` : ''}`, ['Resources', 'Scene'], (d) => {
    for (const k of Object.keys(d)) delete d[k];
    Object.assign(d, clone(cand));
  }, { expectedRev: I.expected });
  if (!res.ok && res.stale) {
    const last = P().log[P().log.length - 1];
    I.stale = { reason: res.reason, who: last?.who, what: last?.label };
    emit('ui');
    return;
  }
  if (!res.ok) { note(res.reason, 'refuse'); return; }
  S.instr = null;
  P().offers[I.def].accepted = true;
  note(`${d0.name} is now locked at rev ${I.to}. One Undo returns the whole update${left ? `; ${left} setting${left > 1 ? 's stay' : ' stays'} visibly unresolved` : ''}.`);
  emit('ui');
}
export function recheckReview() {
  const I = S.instr;
  if (I?.kind !== 'review') return;
  I.expected = P().rev;
  I.stale = null;
  flash('Impact re-checked against the current revision.', 'info');
  emit('ui');
}
export function stayOnRevision() {
  const I = S.instr;
  if (I?.kind !== 'review') return;
  P().offers[I.def].declined = true;
  S.instr = null;
  note(`Staying on rev ${D().defs[I.def].lock}. Rev ${I.to} remains available under Definitions — nothing changed.`);
  emit('ui');
}
export function cancelReview() {
  if (S.instr?.kind !== 'review') return;
  S.instr = null;
  note('Review closed — the update was not applied. Nothing changed.');
  emit('ui');
}
export function injectStale() {
  const doc = D();
  const b = doc.uses['U-B7Q2'] ?? Object.values(doc.uses).find((u) => u.def === 'D-DL01');
  if (!b) return;
  externalEdit('Agent (another writer)', `Renamed ${b.id} “${b.name}” → “Wall light”`, (d) => { if (d.uses[b.id]) d.uses[b.id].name = 'Wall light'; });
  flash(`Another writer renamed ${b.id} to “Wall light” (rev ${P().rev}).`, 'warn');
}
export function repairLater(uid, key) {
  select({ kind: 'use', id: uid, path: [] });
}

// ---------------------------------------------------------------- library & second project (simulated storage)
export function openShare(defId) {
  S.sheet = { kind: 'share', defId };
  emit('ui');
}
export function share(defId) {
  const lib = S.store.library;
  if (!lib.available) { S.sheet = null; return note('Studio library is unavailable (simulated) — nothing was shared.', 'refuse'); }
  const snap = snapshotDef(D(), defId);
  lib.items[defId] = { id: defId, name: snap.def.name, revs: { 1: snap }, latest: 1, from: P().doc.name };
  accept(`Share ${snap.def.name} to ${lib.name} as rev 1`, ['Resources'], (d) => { d.defs[defId].scope = 'library'; d.defs[defId].lib = { rev: 1 }; });
  S.sheet = null;
  note(`${snap.def.name} rev 1 is in ${lib.name} (simulated storage). Projects that use it are offered later revisions; nothing updates on its own.`);
}
export function publishRevision(defId) {
  const lib = S.store.library;
  const item = lib.items[defId];
  if (!item) return;
  if (!lib.available) return note('Studio library is unavailable (simulated) — nothing was published.', 'refuse');
  const snap = snapshotDef(D(), defId);
  if (sameContent(snap, item.revs[item.latest])) return flash('No changes since the published revision.', 'info');
  const n = item.latest + 1;
  item.revs[n] = snap;
  item.latest = n;
  accept(`Publish ${snap.def.name} rev ${n} to ${lib.name}`, ['Resources'], (d) => { d.defs[defId].lib = { rev: n }; });
  note(`Published rev ${n}. Harbour café keeps rev ${n - 1} until someone there accepts it.`);
}
export function libDirty(doc, defId) {
  const d = doc.defs[defId];
  const item = S.store.library.items[defId];
  if (!d?.lib || !item) return false;
  return !sameContent(snapshotDef(doc, defId), item.revs[d.lib.rev]);
}
export function switchProject(pid) {
  if (S.store.active === pid) { S.pop = null; emit('ui'); return; }
  closeInstr(true);
  S.store.active = pid;
  S.sel = null; S.multi = []; S.ctx = null; S.reach = null; S.pop = null; S.summary = null; S.mode = 'arrange'; S.tool = 'select';
  if (stage) {
    if (pid === 'p2') stage.lookAt(new V3(0.2, 0.6, -0.4), 3.6, { az: 0.5, el: 0.36 });
    else stage.lookAt(new V3(-0.4, 0.8, -0.8), 5.8, { az: 0.55, el: 0.4 });
  }
  emit('all');
}
export function openUseFromLibrary(defId = 'D-DL01') {
  S.sheet = { kind: 'uselib', defId, mode: 'retained' };
  emit('ui');
}
export function useFromLibrary(defId, mode) {
  if (mode !== 'retained') return note('This specimen supports a reference with a retained copy. Reference-only loading is not implemented.', 'info');
  const lib = S.store.library;
  const item = lib.items[defId];
  if (!item) return;
  if (!lib.available) { S.sheet = null; return note('Studio library is unavailable (simulated) — try again later.', 'refuse'); }
  const snap = item.revs[item.latest];
  let uid;
  const res = accept(`Use ${item.name} rev ${item.latest} from ${lib.name} (${mode === 'retained' ? 'reference + retained copy' : 'reference'})`, ['Resources', 'Scene'], (d) => {
    for (const [k, v] of Object.entries(snap.deps)) if (!d.defs[k]) d.defs[k] = { ...clone(v), scope: 'library-dep' };
    d.defs[defId] = { ...clone(snap.def), scope: 'library', lib: { rev: item.latest }, retained: mode === 'retained' };
    uid = nextId('cafe', 'U', d);
    d.uses[uid] = { id: uid, name: item.name, def: defId, at: [1.9, 0, -0.35], rotY: -0.5, sets: {} };
    d.order.push(uid);
  });
  S.sheet = null;
  if (res.ok) { select({ kind: 'use', id: uid, path: [] }); note(mode === 'retained' ? 'Referenced at rev 1 with a retained copy — it still renders if the library is unavailable.' : 'Referenced at rev 1 — it needs the library to load.'); }
}
export function libOffer(doc, defId) {
  const d = doc.defs[defId];
  const item = S.store.library.items[defId];
  if (!d || d.scope !== 'library' || !item || !d.lib || S.store.active === 'p1') return null;
  if (item.latest <= d.lib.rev) return null;
  return { rev: item.latest, declined: !!P().libDeclined?.[defId] };
}
export function openLibReview(defId) {
  closeInstr(true);
  const off = libOffer(D(), defId);
  if (!off) return;
  if (!S.store.library.available) return note('Can’t check the offered revision — Studio library is unavailable (simulated). You keep your current revision.', 'refuse');
  S.instr = { kind: 'libreview', def: defId, to: off.rev, expected: P().rev };
  S.sel = null;
  emit('ui');
}
export function libCandidate(doc, defId, rev) {
  const item = S.store.library.items[defId];
  const snap = item.revs[rev];
  const d = clone(doc);
  const keep = { retained: d.defs[defId].retained };
  d.defs[defId] = { ...clone(snap.def), scope: 'library', lib: { rev }, retained: keep.retained };
  for (const [k, v] of Object.entries(snap.deps)) d.defs[k] = { ...clone(v), scope: 'library-dep' };
  return d;
}
export function acceptLib() {
  const I = S.instr;
  if (I?.kind !== 'libreview') return;
  const cand = libCandidate(D(), I.def, I.to);
  const name = D().defs[I.def].name;
  S.instr = null;
  const res = accept(`Accept ${name} rev ${I.to} from ${S.store.library.name}`, ['Resources'], (d) => {
    for (const k of Object.keys(d)) delete d[k];
    Object.assign(d, clone(cand));
  }, { expectedRev: I.expected });
  if (!res.ok) { S.instr = I; emit('ui'); return note(res.reason, 'refuse'); }
  note(`${name} is now rev ${I.to} in Harbour café. Undo returns to rev ${I.to - 1}; the offer comes back.`);
}
export function stayLib() {
  const I = S.instr;
  if (I?.kind !== 'libreview') return;
  P().libDeclined = { ...(P().libDeclined ?? {}), [I.def]: true };
  S.instr = null;
  note(`Staying pinned to rev ${D().defs[I.def].lib.rev}. Rev ${I.to} stays available — nothing changed.`);
  emit('ui');
}
export function forkLib() {
  const I = S.instr;
  if (I?.kind !== 'libreview') return;
  const doc = D();
  const src = doc.defs[I.def];
  let fid;
  S.instr = null;
  const res = accept(`Fork ${src.name} rev ${src.lib.rev} into an independent Harbour café definition`, ['Resources', 'Scene'], (d) => {
    fid = nextId('fork', 'D', d);
    const f = clone(d.defs[I.def]);
    f.id = fid;
    f.name = `${src.name} (Harbour)`;
    f.scope = 'project';
    f.forkedFrom = { id: I.def, note: `forked from ${src.name} rev ${src.lib.rev} (${S.store.library.name})` };
    delete f.lib;
    d.defs[fid] = f;
    for (const u of Object.values(d.uses)) if (u.def === I.def) u.def = fid;
    delete d.defs[I.def];
  });
  if (!res.ok) { S.instr = I; emit('ui'); return; }
  note(`Forked: ${fid} is a new definition owned by this project. It no longer receives library revisions.`);
}
export function cancelLibReview() {
  if (S.instr?.kind !== 'libreview') return;
  S.instr = null;
  note('Review closed — nothing changed.');
  emit('ui');
}
export function setLibrary(avail) {
  S.store.library.available = avail;
  note(avail ? 'Studio library is reachable again (simulated).' : 'Studio library is unavailable (simulated): references resolve from retained copies; offers can’t be checked.', avail ? 'info' : 'warn');
}

// ---------------------------------------------------------------- definition bench (explicit resource editing)
export function openBench(defId) {
  const d0 = D().defs[defId];
  if (!d0 || d0.kind !== 'composition') return flash('Only compositions made in this project are edited here; imported definitions change at their source.', 'info');
  closeInstr(true);
  S.instr = { kind: 'bench', def: defId, draft: {}, focus: null, from: S.sel ? { ...S.sel } : null };
  if (stage) stage.lookAt(new V3(0, 0.62, 0), 1.35, { az: 0.6, el: 0.25 });
  emit('ui');
}
export function benchSet(key, value) {
  const I = S.instr;
  if (I?.kind !== 'bench') return;
  const cur = benchValue(D(), I.def, key, {});
  if (cur === value) delete I.draft[key]; else I.draft[key] = value;
  emit('ui');
}
export function benchValue(doc, defId, key, draft) {
  if (key in draft) return draft[key];
  const d = doc.defs[defId];
  if (d.sets && key in d.sets) return d.sets[key];
  return inheritedAtDef(doc, defId, key);
}
export function benchApply() {
  const I = S.instr;
  if (I?.kind !== 'bench') return;
  const keys = Object.keys(I.draft);
  if (!keys.length) { closeBench(); return; }
  const doc = D();
  const users = usesOfDef(doc, I.def).direct;
  const changed = users.filter((uid) => keys.some((k) => doc.uses[uid].sets?.[k] === undefined));
  const d0 = doc.defs[I.def];
  const res = accept(`Edit ${d0.name}: ${keys.map((k) => `${keyLabel(k)} → ${showValue(k, I.draft[k])}`).join(', ')} (${changed.length} of ${users.length} uses change)`, ['Resources'], (d) => {
    d.defs[I.def].sets = d.defs[I.def].sets ?? {};
    for (const k of keys) {
      if (inheritedAtDef(d, I.def, k) === I.draft[k]) delete d.defs[I.def].sets[k];
      else d.defs[I.def].sets[k] = I.draft[k];
    }
  });
  const from = I.from;
  S.instr = null;
  if (res.ok) {
    S.summary = { title: `${d0.name} changed`, lines: [`${changed.length} of ${users.length} uses changed.`, ...users.filter((u) => !changed.includes(u)).map((u) => `${u} kept its own setting.`)], undoTo: P().undo.length - 1, n: 1 };
  }
  if (from) select(from);
  emit('ui');
}
export function closeBench(discard) {
  const I = S.instr;
  if (I?.kind !== 'bench') return;
  const n = Object.keys(I.draft).length;
  const from = I.from;
  S.instr = null;
  if (n && discard) note(`Discarded ${n} draft change${n > 1 ? 's' : ''} — the definition is unchanged.`);
  if (from) select(from);
  emit('ui');
}

// ---------------------------------------------------------------- instruments, history, camera
export function closeInstr(silent) {
  const I = S.instr;
  if (!I) return;
  if (I.kind === 'inspect') closeInspect();
  else if (I.kind === 'preview') closePreview(silent);
  else if (I.kind === 'hang') cancelHang(silent);
  else if (I.kind === 'wallmove') { S.instr = null; }
  else if (I.kind === 'review') { S.instr = null; }
  else if (I.kind === 'libreview') { S.instr = null; }
  else if (I.kind === 'bench') closeBench(true);
  else if (I.kind === 'intake') S.instr = null;
  S.tool = 'select';
}
export function doUndo() {
  if (S.instr?.kind === 'wallmove' || S.instr?.kind === 'hang') closeInstr(true);
  const e = undo();
  if (!e) return flash('Nothing to undo.', 'info');
  sanitize();
  flash(`Undid: ${e.label}`, 'info');
}
export function doRedo() {
  const e = redo();
  if (!e) return flash('Nothing to redo.', 'info');
  sanitize();
  flash(`Redid: ${e.label}`, 'info');
}
export function undoTo(n) {
  const p = P();
  while (p.undo.length > n) undo();
  S.summary = null;
  sanitize();
  flash('Undone — back to how it was before.', 'info');
}
export function sanitize() {
  const doc = D();
  const ok = (s) => {
    if (!s) return true;
    if (s.kind === 'use') return !!doc.uses[s.id] && (!s.path?.length || !!partAt(doc, doc.uses[s.id].def, s.path));
    if (s.kind === 'group') return !!doc.groups[s.id];
    if (s.kind === 'def') return !!doc.defs[s.id];
    if (s.kind === 'wall') return !!wallById(compileLayout(doc.layout), s.id);
    if (s.kind === 'ref') return !!doc.refs[s.id];
    return true;
  };
  if (!ok(S.sel)) { S.sel = null; S.ctx = null; }
  S.multi = S.multi.filter((id) => doc.uses[id]);
  if (S.instr?.use && !doc.uses[S.instr.use]) S.instr = null;
  if (S.mode === 'layout' && !doc.layout) S.mode = 'arrange';
  emit('ui');
}
export function frameUse(uid, pad = 1.6) {
  if (!stage) return;
  // Resolve after this frame installs the new fixture and its displayed transforms.
  stage.frameRequest = { uid, path: [], pad, separation: S.instr?.kind === 'inspect' ? S.instr.sep : null };
}
export function frameSel() {
  if (!stage || !S.sel) return;
  if (S.sel.kind === 'use') {
    stage.frameRequest = { uid: S.sel.id, path: S.sel.path ?? [], pad: S.sel.path?.length ? 2.6 : 1.6 };
  } else if (S.sel.kind === 'group') {
    const box = new THREE.Box3();
    for (const m of D().groups[S.sel.id].members) { const b = stage.boxOfUse(m, []); if (b) box.union(b); }
    if (!box.isEmpty()) { const s = box.getSize(new V3()); stage.lookAt(box.getCenter(new V3()), Math.max(s.x, s.y, s.z), { pad: 1.3 }); }
  } else if (S.sel.kind === 'wall') {
    const g = stage.wallGroup(S.sel.id);
    if (g) stage.frameObject(g.children[0], { pad: 1.1 });
  }
}
export function viewPreset(name) {
  if (!stage) return;
  const c = stage.cam;
  const t = c.target.clone();
  if (name === 'front') stage.lookAt(t, c.dist * 0.72, { az: 0, el: 0.12, pad: 1 });
  else if (name === 'top') stage.lookAt(t, c.dist * 0.72, { az: c.az, el: 1.42, pad: 1 });
  else stage.lookAt(t, c.dist * 0.72, { az: 0.62, el: 0.42, pad: 1 });
}
export function setMotion(m) {
  S.motion = m;
  emit('ui');
}
export function setApproach(a) {
  if (S.instr?.kind === 'bench' && a === 'contextual') closeBench(true);
  S.approach = a;
  S.reachScope = 'use';
  emit('ui');
}

export const hangPoseFor = (w, s, h) => hangPose(w, s, h);
export { usesOfDef, overridesOf, valueOf, inherited, iface, defOf, resolveRef, diffSource, impactOn };
