// Three.js stage: builds placed uses, the Layout bay, ghosts and the definition bench from
// resolved values. Rendering only — it never decides what a value is (model.js does).
import * as THREE from 'three';
import { FINISH, GLASS, PAINT, NATIVE, SOURCES, defOf, iface, valueOf, defChain, featureAt, allowed, poseOf, compileLayout, hangPose, PLINTH } from './model.js';

const V3 = THREE.Vector3;
export const COLORS = {
  paper: '#F5F2E9', grid: '#E9E3D5', gridMajor: '#DCD4C2', ink: '#252A2E',
  sel: '#2F8CFF', view: '#56707C', guide: '#146D68', refuse: '#9B3149', run: '#6B4FA0',
  wall: '#EEEAE3', slab: '#E4DDCD', steel: '#4E5358', glass: '#BFD6DE',
};
const rad = (d) => (d * Math.PI) / 180;

function gridTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = COLORS.paper; g.fillRect(0, 0, 256, 256);
  g.strokeStyle = COLORS.grid; g.lineWidth = 2;
  for (let i = 1; i < 4; i++) { const p = i * 64; g.beginPath(); g.moveTo(p, 0); g.lineTo(p, 256); g.moveTo(0, p); g.lineTo(256, p); g.stroke(); }
  g.strokeStyle = COLORS.gridMajor; g.lineWidth = 3;
  g.strokeRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(60, 60);
  t.anisotropy = 8;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const M = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0, ...o });

// ---------------------------------------------------------------- builders
// Each builder tags meshes with the declared id-path they belong to, and registers the
// node for that path. Render-only meshes are tagged with their owning declared part.
function tagNode(H, node, path) {
  H.nodes.set(path.join('/'), node);
  node.userData.path = path;
}
function mesh(H, geo, mat, path, extra = {}) {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true;
  m.receiveShadow = true;
  m.userData = { path, ...extra };
  H.meshes.push(m);
  return m;
}

function buildNative(H, id, val, path) {
  const n = NATIVE[id];
  const g = new THREE.Group();
  tagNode(H, g, path);
  const [w, h, d] = n.size;
  const paint = PAINT[val('paint')] ?? PAINT.chalk;
  const box = mesh(H, new THREE.BoxGeometry(w, h, d), M(paint.color, { roughness: 0.86 }), path);
  box.position.y = h / 2;
  g.add(box);
  if (id === 'N-PLINTH') {
    const cleat = mesh(H, new THREE.BoxGeometry(w * 0.7, 0.05, 0.012), M('#6B6F73', { roughness: 0.6 }), path, { render: 'cleat' });
    cleat.position.set(0, h - 0.09, -d / 2 - 0.006);
    g.add(cleat);
  }
  return g;
}

function buildLamp(H, rev, val, path) {
  const g = new THREE.Group();
  tagNode(H, g, path);
  const has = (id) => rev.parts.some((p) => p.id === id);
  const shapeOf = (id) => rev.parts.find((p) => p.id === id)?.shape;
  const steel = () => M(COLORS.steel, { metalness: 0.55, roughness: 0.42 });
  const fin = FINISH[val('slot.finish')] ?? FINISH.brass;
  const L = { armPivot: null, shadePivot: null, diffuser: null, clip: null, spot: null, bulb: null };

  // Base
  const base = new THREE.Group();
  tagNode(H, base, [...path, 'p.base']);
  const disc = mesh(H, new THREE.CylinderGeometry(0.088, 0.094, 0.024, 44), steel(), [...path, 'p.base']);
  disc.position.y = 0.012;
  const post = mesh(H, new THREE.CylinderGeometry(0.012, 0.014, 0.04, 16), steel(), [...path, 'p.base']);
  post.position.y = 0.044;
  const knuckle = mesh(H, new THREE.SphereGeometry(0.019, 20, 14), steel(), [...path, 'p.base']);
  knuckle.position.y = 0.064;
  base.add(disc, post, knuckle);
  g.add(base);

  // Arm (bounded articulation: tilt about the knuckle)
  const armPivot = new THREE.Group();
  armPivot.position.y = 0.064;
  tagNode(H, armPivot, [...path, 'p.arm']);
  base.add(armPivot);
  const rod = mesh(H, new THREE.CylinderGeometry(0.0085, 0.0085, 0.4, 12), steel(), [...path, 'p.arm']);
  rod.position.y = 0.2;
  const cable = mesh(H, new THREE.CylinderGeometry(0.0028, 0.0028, 0.38, 6), M('#1E2023', { roughness: 0.9 }), [...path, 'p.arm'], { render: 'cable_01' });
  cable.position.set(0.014, 0.2, 0);
  const elbow = mesh(H, new THREE.SphereGeometry(0.014, 16, 12), steel(), [...path, 'p.arm']);
  elbow.position.y = 0.4;
  armPivot.add(rod, cable, elbow);
  L.armPivot = armPivot;

  if (has('p.clip')) {
    const clipG = new THREE.Group();
    tagNode(H, clipG, [...path, 'p.clip']);
    const clip = mesh(H, new THREE.BoxGeometry(0.022, 0.034, 0.024), M('#C9C3B6', { roughness: 0.5 }), [...path, 'p.clip']);
    clipG.position.set(0.012, 0.23, 0);
    clipG.add(clip);
    armPivot.add(clipG);
    L.clip = clipG;
  }

  // Shade / Hood (same declared id p.shade in both revisions)
  const shadePivot = new THREE.Group();
  shadePivot.position.y = 0.4;
  shadePivot.rotation.x = -1.05;
  const sp = [...path, 'p.shade'];
  tagNode(H, shadePivot, sp);
  armPivot.add(shadePivot);
  const shadeMat = () => M(fin.color, { metalness: fin.metal, roughness: fin.rough, side: THREE.DoubleSide });
  let mouth = -0.13;
  if (shapeOf('p.shade') === 'dome') {
    const dome = mesh(H, new THREE.SphereGeometry(0.094, 44, 16, 0, Math.PI * 2, 0, Math.PI / 2), shadeMat(), sp);
    dome.position.y = -0.094;
    const cap = mesh(H, new THREE.CylinderGeometry(0.02, 0.022, 0.02, 20), shadeMat(), sp);
    cap.position.y = 0.004;
    const ring = mesh(H, new THREE.TorusGeometry(0.09, 0.0045, 8, 44), M('#DAD5C8', { roughness: 0.4 }), sp, { render: 'diffuser_ring' });
    ring.rotation.x = Math.PI / 2;
    ring.position.y = -0.094;
    shadePivot.add(dome, cap, ring);
    mouth = -0.094;
  } else {
    const cone = mesh(H, new THREE.CylinderGeometry(0.024, 0.078, 0.13, 44, 1, true), shadeMat(), sp);
    cone.position.y = -0.065;
    const cap = mesh(H, new THREE.CylinderGeometry(0.025, 0.025, 0.018, 20), shadeMat(), sp);
    cap.position.y = -0.002;
    shadePivot.add(cone, cap);
  }
  const bulb = mesh(H, new THREE.SphereGeometry(0.021, 16, 12), new THREE.MeshBasicMaterial({ color: '#FFE7B0' }), sp, { render: 'bulb_glow' });
  bulb.castShadow = false;
  bulb.position.y = mouth * 0.42;
  shadePivot.add(bulb);
  L.bulb = bulb;
  L.shadePivot = shadePivot;

  if (has('p.diffuser')) {
    const dp = [...path, 'p.diffuser'];
    const dG = new THREE.Group();
    tagNode(H, dG, dp);
    const gl = GLASS[val('slot.glass')] ?? GLASS.frosted;
    const dm = new THREE.MeshStandardMaterial({ color: gl.color, roughness: 0.25, metalness: 0, transparent: gl.opacity < 1, opacity: gl.opacity, emissive: '#FFF1D2', emissiveIntensity: gl.opacity > 0.6 ? 0.35 : 0.05, side: THREE.DoubleSide });
    const disc2 = mesh(H, new THREE.CylinderGeometry(0.071, 0.071, 0.004, 40), dm, dp);
    disc2.castShadow = false;
    dG.add(disc2);
    dG.position.y = -0.118;
    shadePivot.add(dG);
    L.diffuser = dG;
  }

  const spot = new THREE.SpotLight('#FFE3B4', 7, 7, 0.62, 0.75, 1.6);
  spot.position.set(0, mouth * 0.5, 0);
  spot.target.position.set(0, -3, 0);
  shadePivot.add(spot, spot.target);
  L.spot = spot;
  H.lamps.push({ path, L });
  return g;
}

function buildRelief(H, path) {
  const g = new THREE.Group();
  tagNode(H, g, path);
  const plate = mesh(H, new THREE.BoxGeometry(1.1, 0.04, 0.2), M('#3E4B53', { roughness: 0.7 }), path, { render: 'plate', flat: true });
  plate.position.y = 0.02;
  g.add(plate);
  for (let i = 0; i < 13; i++) {
    const h = 0.46 + 0.36 * (0.5 + 0.5 * Math.sin(i * 0.58 + 0.25));
    const s = mesh(H, new THREE.BoxGeometry(0.058, h, 0.046), M(i % 2 ? '#56768A' : '#4E6D80', { roughness: 0.62 }), path, { render: `slat_${String(i + 1).padStart(2, '0')}`, flat: true });
    s.position.set(-0.5 + i * (1.0 / 12), 0.04 + h / 2, 0.04 * Math.sin(i * 0.7));
    s.rotation.y = 0.28 * Math.sin(i * 0.5 + 0.3);
    g.add(s);
  }
  return g;
}

// Build any definition's content. val(key) returns the effective value for a key relative
// to this definition's root; pin selects an exact source revision (forks).
function buildDef(H, doc, defId, val, path, pin) {
  const d = defOf(doc, defId);
  if (!d) return new THREE.Group();
  if (d.kind === 'native') return buildNative(H, defId, val, path);
  if (d.kind === 'flat') return buildRelief(H, path);
  if (d.kind === 'imported') return buildLamp(H, SOURCES[d.src].revs[pin ?? d.lock], val, path);
  const g = new THREE.Group();
  tagNode(H, g, path);
  for (const c of d.comps) {
    const sub = buildDef(H, doc, c.def, (k) => val(`${c.id}/${k}`), [...path, c.id], c.pin);
    sub.position.set(c.at[0], c.at[1], c.at[2]);
    sub.rotation.y = c.rotY ?? 0;
    sub.userData.compRest = sub.position.clone();
    g.add(sub);
  }
  return g;
}

function newHandles() {
  return { nodes: new Map(), meshes: [], lamps: [] };
}

// ---------------------------------------------------------------- stage
export class Stage {
  constructor(canvas) {
    this.canvas = canvas;
    const r = (this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true }));
    r.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.toneMapping = THREE.NoToneMapping;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(COLORS.paper);
    this.scene.fog = new THREE.Fog(COLORS.paper, 16, 42);
    this.camera = new THREE.PerspectiveCamera(36, 1, 0.03, 200);
    this.cam = { target: new V3(-0.3, 0.5, -0.6), az: 0.62, el: 0.4, dist: 6.6 };
    this.camTo = null;

    const hemi = new THREE.HemisphereLight('#FFFFFF', '#D9D2C2', 1.25);
    const sun = new THREE.DirectionalLight('#FFF7EC', 1.55);
    sun.position.set(3.5, 7, 5);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -7, right: 7, top: 7, bottom: -7, near: 0.5, far: 25 });
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.02;
    this.scene.add(hemi, sun);

    const ground = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshStandardMaterial({ map: gridTexture(), roughness: 1 }));
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    ground.userData = { ground: true };
    this.ground = ground;
    this.scene.add(ground);
    const om = new THREE.LineBasicMaterial({ color: '#8A8F92' });
    const og = new THREE.BufferGeometry().setFromPoints([new V3(-0.18, 0.002, 0), new V3(0.18, 0.002, 0), new V3(0, 0.002, -0.18), new V3(0, 0.002, 0.18)]);
    this.origin = new THREE.LineSegments(og, om);
    this.scene.add(this.origin);

    this.world = new THREE.Group();
    this.arch = new THREE.Group();
    this.ghosts = new THREE.Group();
    this.bench = new THREE.Group();
    this.scene.add(this.world, this.arch, this.ghosts, this.bench);
    this.uses = new Map(); // uid → { group, H, sig, def }
    this.layoutSig = null;
    this.archMeshes = [];
    this.ray = new THREE.Raycaster();
    this.shown = new Map(); // animated values: `${uid}|tilt|path`, `${uid}|sep`
    this.leaders = [];
    this.benchH = null;
  }

  resize() {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    if (!w || !h) return;
    if (this.canvas.width !== Math.floor(w * this.renderer.getPixelRatio()) || this.canvas.height !== Math.floor(h * this.renderer.getPixelRatio())) {
      this.renderer.setSize(w, h, false);
    }
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  // ------------------------------------------------------------ sync from resolved state
  // view: { doc, C (compiled layout), extra: { uid: { key: value } } (hover previews),
  //         hideUses: Set, ghostDoc, ghostUses, candidate: {...}, benchDef, benchSets }
  sync(view) {
    const { doc } = view;
    const seen = new Set();
    for (const uid of Object.keys(doc.uses)) {
      if (view.hideUses?.has(uid)) continue;
      seen.add(uid);
      const u = doc.uses[uid];
      const extra = view.extra?.[uid];
      const vals = this.valuesFor(doc, uid, extra);
      const sig = JSON.stringify([u.def, this.defSig(doc, u.def), vals]);
      let rec = this.uses.get(uid);
      if (!rec || rec.sig !== sig) {
        if (rec) this.disposeGroup(rec.group);
        const H = newHandles();
        const val = (k) => (k in vals ? vals[k] : undefined);
        const group = buildDef(H, doc, u.def, val, []);
        group.userData.use = uid;
        for (const m of H.meshes) m.userData.use = uid;
        this.world.add(group);
        rec = { group, H, sig, def: u.def };
        this.uses.set(uid, rec);
      }
      rec.doc = doc;
    }
    for (const [uid, rec] of this.uses) if (!seen.has(uid)) { this.disposeGroup(rec.group); this.uses.delete(uid); }

    // Layout (simulated canonical compile)
    const C = view.C;
    const lsig = JSON.stringify(C);
    if (lsig !== this.layoutSig) {
      this.layoutSig = lsig;
      this.buildLayout(C);
    }

    // Ghosts (e.g. the accepted revision behind an offered one, or a hang candidate)
    this.disposeChildren(this.ghosts);
    this.ghostRecs = [];
    if (view.ghosts) for (const gdef of view.ghosts) this.addGhost(gdef);

    // Bench specimen
    const bsig = view.bench ? JSON.stringify([view.bench.defId, this.defSig(view.bench.doc, view.bench.defId), view.bench.vals]) : null;
    if (bsig !== this.benchSig) {
      this.benchSig = bsig;
      this.disposeChildren(this.bench);
      this.benchH = null;
      if (view.bench) {
        const H = newHandles();
        const vals = view.bench.vals;
        const g = buildDef(H, view.bench.doc, view.bench.defId, (k) => vals[k], []);
        for (const m of H.meshes) m.userData.bench = true;
        const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.012, 64), M('#ECE6D8', { roughness: 0.95 }));
        disc.position.y = -0.006;
        disc.receiveShadow = true;
        this.bench.add(disc, g);
        this.benchH = { group: g, H, vals };
      }
    }
    this.world.visible = !view.bench;
    this.arch.visible = !view.bench;
    this.bench.visible = !!view.bench;
  }

  valuesFor(doc, uid, extra) {
    const u = doc.uses[uid];
    const out = {};
    for (const f of iface(doc, u.def).features) out[f.key] = valueOf(doc, uid, f.key, extra).value;
    return out;
  }
  defSig(doc, defId) {
    const d = defOf(doc, defId);
    if (!d || d.kind === 'native') return defId;
    if (d.kind !== 'composition') return `${defId}@${d.lock}`;
    return JSON.stringify(d.comps.map((c) => [c.id, c.at, c.rotY, c.pin, this.defSig(doc, c.def)]));
  }

  addGhost(gd) {
    // gd: { doc, uid, pose?, tone: 'view'|'guide'|'refuse', label }
    const H = newHandles();
    const vals = this.valuesFor(gd.doc, gd.uid);
    const g = buildDef(H, gd.doc, gd.doc.uses[gd.uid].def, (k) => vals[k], []);
    const col = new THREE.Color(COLORS[gd.tone] ?? COLORS.view);
    g.traverse((o) => {
      if (o.isSpotLight) { o.intensity = 0; o.visible = false; }
      if (!o.isMesh) return;
      o.castShadow = false;
      o.receiveShadow = false;
      o.material = new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: gd.tone === 'view' ? 0.12 : 0.2, depthWrite: false });
      const e = new THREE.LineSegments(new THREE.EdgesGeometry(o.geometry, 28), new THREE.LineDashedMaterial({ color: col, dashSize: 0.02, gapSize: 0.014, transparent: true, opacity: 0.9 }));
      e.computeLineDistances();
      o.add(e);
    });
    const p = gd.pose ?? poseOf(gd.doc, gd.C, gd.uid);
    g.position.set(p.x, p.y, p.z);
    g.rotation.y = p.rotY;
    this.ghosts.add(g);
    // articulation of the ghost follows its own baseline
    for (const { path, L } of H.lamps) {
      const key = [...path, 'a.tilt'].join('/');
      const v = gd.tilt ?? (gd.doc.uses[gd.uid] ? valueOf(gd.doc, gd.uid, key).value : 30);
      L.armPivot.rotation.x = rad(v ?? 30);
    }
    this.ghostRecs.push({ group: g, gd });
  }

  buildLayout(C) {
    this.disposeChildren(this.arch);
    this.archMeshes = [];
    if (!C) return;
    const slab = new THREE.Mesh(new THREE.BoxGeometry(C.floor.x1 - C.floor.x0, 0.08, C.floor.z1 - C.floor.z0), M(COLORS.slab, { roughness: 0.95 }));
    slab.position.set((C.floor.x0 + C.floor.x1) / 2, -0.034, (C.floor.z0 + C.floor.z1) / 2);
    slab.receiveShadow = true;
    slab.userData = { floor: 'F-BAY1' };
    this.arch.add(slab);
    this.archMeshes.push(slab);
    for (const w of C.walls) {
      const s = new THREE.Shape();
      s.moveTo(0, 0); s.lineTo(w.len, 0); s.lineTo(w.len, w.h); s.lineTo(0, w.h); s.lineTo(0, 0);
      for (const o of w.openings) {
        const hole = new THREE.Path();
        hole.moveTo(o.s0, o.sill); hole.lineTo(o.s1, o.sill); hole.lineTo(o.s1, o.head); hole.lineTo(o.s0, o.head); hole.lineTo(o.s0, o.sill);
        s.holes.push(hole);
      }
      const geo = new THREE.ExtrudeGeometry(s, { depth: w.t, bevelEnabled: false });
      geo.translate(0, 0, -w.t / 2);
      const m = new THREE.Mesh(geo, M(COLORS.wall, { roughness: 0.92 }));
      m.castShadow = true;
      m.receiveShadow = true;
      m.userData = { wall: w.id };
      const grp = new THREE.Group();
      grp.position.set(w.a[0], 0, w.a[1]);
      grp.rotation.y = Math.atan2(-w.tan[1], w.tan[0]);
      grp.add(m);
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 20), new THREE.LineBasicMaterial({ color: '#8C8A84' }));
      grp.add(edges);
      for (const o of w.openings) {
        const glass = new THREE.Mesh(new THREE.PlaneGeometry(o.s1 - o.s0, o.head - o.sill), new THREE.MeshStandardMaterial({ color: COLORS.glass, transparent: true, opacity: 0.28, roughness: 0.1, side: THREE.DoubleSide }));
        glass.position.set((o.s0 + o.s1) / 2, (o.sill + o.head) / 2, 0);
        glass.userData = { opening: o.id, wall: w.id };
        grp.add(glass);
        this.archMeshes.push(glass);
      }
      this.arch.add(grp);
      this.archMeshes.push(m);
      w._grp = grp;
    }
  }

  disposeGroup(g) {
    g.parent?.remove(g);
    g.traverse((o) => {
      o.geometry?.dispose?.();
      if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose());
    });
  }
  disposeChildren(g) {
    for (const c of [...g.children]) this.disposeGroup(c);
  }

  // ------------------------------------------------------------ per frame
  // f: { poses: Map uid→pose, tilt: (uid, key) → deg, sep: uid → 0..1, tint: (mesh) → {color, k}, instant }
  frame(dt, f) {
    const k = f.instant ? 1 : 1 - Math.exp(-dt * 9);
    // camera
    if (this.camTo) {
      const c = this.cam;
      const t = this.camTo;
      const kk = f.instant ? 1 : 1 - Math.exp(-dt * 6);
      c.target.lerp(t.target, kk);
      c.dist += (t.dist - c.dist) * kk;
      c.az += (t.az - c.az) * kk;
      c.el += (t.el - c.el) * kk;
      if (c.target.distanceTo(t.target) < 0.002 && Math.abs(t.dist - c.dist) < 0.002 && Math.abs(t.az - c.az) < 0.001 && Math.abs(t.el - c.el) < 0.001) this.camTo = null;
    }
    const { target, az, el, dist } = this.cam;
    this.camera.position.set(target.x + dist * Math.cos(el) * Math.sin(az), target.y + dist * Math.sin(el), target.z + dist * Math.cos(el) * Math.cos(az));
    this.camera.lookAt(target);

    this.leaders = [];
    for (const [uid, rec] of this.uses) {
      const pose = f.poses.get(uid);
      if (!pose) continue;
      rec.group.position.set(pose.x, pose.y, pose.z);
      rec.group.rotation.y = pose.rotY;
      // articulation
      for (const { path, L } of rec.H.lamps) {
        const key = [...path, 'a.tilt'].join('/');
        const want = f.tilt(uid, key);
        const id = `${uid}|${key}`;
        const cur = this.shown.get(id);
        const v = cur === undefined || f.instant ? want : cur + (want - cur) * k;
        this.shown.set(id, v);
        L.armPivot.rotation.x = rad(v);
      }
      // view-only separation (inspection)
      const sepWant = f.sep(uid);
      const sid = `${uid}|sep`;
      const sc = this.shown.get(sid) ?? 0;
      const sep = f.instant ? sepWant : sc + (sepWant - sc) * k;
      this.shown.set(sid, Math.abs(sep) < 0.0005 ? 0 : sep);
      if (sep > 0.001 || sc > 0.001) {
        this.applySep(rec, 0);
        rec.group.updateMatrixWorld(true);
        const rest = this.anchors(rec);
        this.applySep(rec, sep);
        rec.group.updateMatrixWorld(true);
        const now = this.anchors(rec);
        for (const [p, a] of rest) {
          const b = now.get(p);
          if (b && a.distanceTo(b) > 0.01) this.leaders.push({ uid, path: p, from: a, to: b });
        }
      } else this.applySep(rec, 0);
      // tints
      for (const m of rec.H.meshes) {
        const t = f.tint(m);
        const mat = m.material;
        if (!mat.emissive || m.userData.render === 'bulb_glow') continue;
        if (m.userData.path?.includes('p.diffuser')) continue;
        if (t) { mat.emissive.set(t.color); mat.emissiveIntensity = t.k; } else { mat.emissive.set('#000000'); mat.emissiveIntensity = 0; }
      }
      // lamp light pools — dimmed while the world is washed
      for (const { L } of rec.H.lamps) L.spot.intensity = f.lampOn(uid) ? 0.65 : 0;
    }
    // bench specimen: articulation at its default, optional separation
    if (this.benchH) {
      for (const { path, L } of this.benchH.H.lamps) {
        const key = [...path, 'a.tilt'].join('/');
        L.armPivot.rotation.x = rad(this.benchH.vals[key] ?? 30);
      }
    }
    if (f.archTint) for (const m of this.archMeshes) {
      const mat = m.material;
      if (!mat.emissive) continue;
      const t = f.archTint(m);
      if (t) { mat.emissive.set(t.color); mat.emissiveIntensity = t.k; } else { mat.emissive.set('#000000'); mat.emissiveIntensity = 0; }
    }
    for (const g of this.ghostRecs ?? []) if (g.gd.follow) {
      const p = g.gd.follow();
      if (p) { g.group.position.set(p.x, p.y, p.z); g.group.rotation.y = p.rotY; }
    }
    if (this.frameRequest) {
      const r = this.frameRequest;
      this.frameRequest = null;
      const rec = this.uses.get(r.uid);
      if (rec) {
        // Frame the final inspection extent, without snapping the displayed separation.
        if (r.separation != null) this.applySep(rec, r.separation);
        rec.group.updateMatrixWorld(true);
        const box = this.boxOfUse(r.uid, r.path);
        if (box && !box.isEmpty()) {
          const size = box.getSize(new V3());
          this.lookAt(box.getCenter(new V3()), Math.max(size.x, size.y, size.z, 0.25), { pad: r.pad });
        }
        if (r.separation != null) this.applySep(rec, this.shown.get(`${r.uid}|sep`) ?? 0);
      }
    }
    this.renderer.render(this.scene, this.camera);
  }

  applySep(rec, s) {
    rec.group.traverse((o) => {
      const p = o.userData.path;
      if (!p || !o.isGroup) return;
      const leaf = p[p.length - 1];
      if (o.userData.compRest && leaf === 'lamp') o.position.y = o.userData.compRest.y + 0.3 * s;
    });
    for (const { L } of rec.H.lamps) {
      L.armPivot.position.y = 0.064 + 0.1 * s;
      L.shadePivot.position.y = 0.4 + 0.13 * s;
      if (L.diffuser) L.diffuser.position.y = -0.118 - 0.19 * s;
      if (L.clip) L.clip.position.x = 0.012 + 0.07 * s;
    }
  }
  anchors(rec) {
    const out = new Map();
    const box = new THREE.Box3();
    for (const [k, node] of rec.H.nodes) {
      if (!k) continue;
      const leaf = k.split('/').pop();
      if (!['lamp', 'p.arm', 'p.shade', 'p.diffuser', 'p.clip'].includes(leaf)) continue;
      box.makeEmpty();
      this.expandOwn(box, node, k);
      if (!box.isEmpty()) out.set(k, box.getCenter(new V3()));
    }
    return out;
  }
  // bbox of a node's own meshes (not its declared children), so leaders connect the part itself
  expandOwn(box, node, key) {
    node.updateWorldMatrix(true, true);
    node.traverse((o) => {
      if (!o.isMesh || !o.geometry) return;
      const pk = (o.userData.path ?? []).join('/');
      if (pk !== key) return;
      o.geometry.computeBoundingBox();
      box.union(o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld));
    });
  }

  // ------------------------------------------------------------ camera
  orbit(dx, dy) {
    this.camTo = null;
    this.cam.az -= dx * 0.006;
    this.cam.el = Math.min(1.45, Math.max(0.06, this.cam.el + dy * 0.005));
  }
  pan(dx, dy) {
    this.camTo = null;
    const c = this.cam;
    const s = (c.dist * Math.tan(rad(this.camera.fov / 2)) * 2) / this.canvas.clientHeight;
    const right = new V3().setFromMatrixColumn(this.camera.matrixWorld, 0);
    const up = new V3().setFromMatrixColumn(this.camera.matrixWorld, 1);
    c.target.addScaledVector(right, -dx * s).addScaledVector(up, dy * s);
  }
  zoom(f) {
    this.camTo = null;
    this.cam.dist = Math.min(30, Math.max(0.5, this.cam.dist * f));
  }
  lookAt(center, size, opts = {}) {
    this.frameRequest = null;
    const dist = Math.max(0.9, (size / 2 / Math.tan(rad(this.camera.fov / 2))) * (opts.pad ?? 1.35));
    this.camTo = { target: center.clone(), dist, az: opts.az ?? this.cam.az, el: opts.el ?? this.cam.el };
  }
  frameObject(obj, opts) {
    const box = new THREE.Box3().setFromObject(obj, true);
    if (box.isEmpty()) return;
    const c = box.getCenter(new V3());
    const s = box.getSize(new V3());
    this.lookAt(c, Math.max(s.x, s.y, s.z, 0.4), opts);
  }

  // ------------------------------------------------------------ picking & projection
  ndc(x, y) {
    const r = this.canvas.getBoundingClientRect();
    return new THREE.Vector2(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
  }
  pick(x, y, opts = {}) {
    this.ray.setFromCamera(this.ndc(x, y), this.camera);
    const objs = [];
    if (this.bench.visible) { if (this.benchH) objs.push(...this.benchH.H.meshes); }
    else {
      if (opts.uses !== false) for (const rec of this.uses.values()) objs.push(...rec.H.meshes);
      if (opts.arch !== false) objs.push(...this.archMeshes);
      objs.push(this.ground);
    }
    const hits = this.ray.intersectObjects(objs, false);
    for (const h of hits) {
      const u = h.object.userData;
      if (opts.skipUse && u.use === opts.skipUse) continue;
      return { ...u, point: h.point.clone(), normal: h.face ? h.face.normal.clone().transformDirection(h.object.matrixWorld) : null, object: h.object };
    }
    return null;
  }
  // Highest upward-facing surface of another placed object under (x, z) — resting only.
  supportAt(x, z, skipUse) {
    const objs = [];
    for (const [uid, rec] of this.uses) if (uid !== skipUse) objs.push(...rec.H.meshes);
    this.ray.set(new V3(x, 6, z), new V3(0, -1, 0));
    for (const h of this.ray.intersectObjects(objs, false)) {
      const n = h.face ? h.face.normal.clone().transformDirection(h.object.matrixWorld) : null;
      if (n && n.y > 0.7) return { y: h.point.y, use: h.object.userData.use };
    }
    return null;
  }
  rayPlaneY(x, y, py = 0) {
    this.ray.setFromCamera(this.ndc(x, y), this.camera);
    const out = new V3();
    return this.ray.ray.intersectPlane(new THREE.Plane(new V3(0, 1, 0), -py), out) ? out : null;
  }
  rayPlane(x, y, normal, point) {
    this.ray.setFromCamera(this.ndc(x, y), this.camera);
    const out = new V3();
    const pl = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, point);
    return this.ray.ray.intersectPlane(pl, out) ? out : null;
  }
  toScreen(v) {
    const p = v.clone().project(this.camera);
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    return { x: (p.x * 0.5 + 0.5) * w, y: (-p.y * 0.5 + 0.5) * h, behind: p.z > 1 };
  }
  rectOfBox(box) {
    if (box.isEmpty()) return null;
    let x0 = Infinity; let y0 = Infinity; let x1 = -Infinity; let y1 = -Infinity;
    let behind = true;
    for (let i = 0; i < 8; i++) {
      const v = new V3(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z);
      const s = this.toScreen(v);
      if (!s.behind) behind = false;
      x0 = Math.min(x0, s.x); y0 = Math.min(y0, s.y); x1 = Math.max(x1, s.x); y1 = Math.max(y1, s.y);
    }
    return behind ? null : { x0, y0, x1, y1 };
  }
  boxOfUse(uid, path = []) {
    const rec = this.uses.get(uid);
    if (!rec) return null;
    const node = rec.H.nodes.get(path.join('/'));
    if (!node) return null;
    const box = new THREE.Box3();
    const key = path.join('/');
    // a declared part is bounded by its own meshes; a use or component by everything in it
    if (String(path[path.length - 1] ?? '').startsWith('p.')) this.expandOwn(box, node, key);
    else this.expandAll(box, node);
    return box;
  }
  rectOfUse(uid, path = []) {
    const b = this.boxOfUse(uid, path);
    return b ? this.rectOfBox(b) : null;
  }
  wallGroup(id) {
    for (const g of this.arch.children) if (g.children?.[0]?.userData?.wall === id) return g;
    return null;
  }
  rectOfWall(id) {
    const g = this.wallGroup(id);
    if (!g) return null;
    return this.rectOfBox(new THREE.Box3().setFromObject(g.children[0]));
  }
  benchRect(path = []) {
    if (!this.benchH) return null;
    const node = this.benchH.H.nodes.get(path.join('/'));
    if (!node) return null;
    const box = new THREE.Box3();
    this.expandAll(box, node);
    return this.rectOfBox(box);
  }
  expandAll(box, node) {
    node.updateWorldMatrix(true, true);
    node.traverse((o) => {
      if (!o.isMesh || !o.geometry) return;
      o.geometry.computeBoundingBox();
      box.union(o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld));
    });
  }
  // world point of a lamp's arm pivot (for the articulation arc)
  armPivotWorld(uid, compPath) {
    const rec = this.uses.get(uid);
    if (!rec) return null;
    const lamp = rec.H.lamps.find((l) => l.path.join('/') === compPath.join('/'));
    if (!lamp) return null;
    const o = new V3();
    lamp.L.armPivot.getWorldPosition(o);
    const ax = new V3(1, 0, 0).applyQuaternion(lamp.L.armPivot.parent.getWorldQuaternion(new THREE.Quaternion()));
    const up = new V3(0, 1, 0).applyQuaternion(lamp.L.armPivot.parent.getWorldQuaternion(new THREE.Quaternion()));
    const fw = new V3(0, 0, 1).applyQuaternion(lamp.L.armPivot.parent.getWorldQuaternion(new THREE.Quaternion()));
    return { o, ax, up, fw };
  }
}

export { hangPose, PLINTH, compileLayout, featureAt, allowed, defChain };
