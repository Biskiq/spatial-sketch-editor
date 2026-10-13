// 3D Stage: one Three.js scene shared by the editor Stage, thumbnails and the visitor preview.
// Layers: 0 = world, 1 = editor helpers (Views, routes, playback puck), 2 = ceilings (inside-only).
import * as THREE from '../vendor/three.module.js';
import { walls, rooms, objects, WALL_H, WALL_T } from './world.js';
import { viewPose, blendPose, controlPoints, sampleRoute, pathKey } from './camera.js';

const COL = { view: 0x5c9a76, viewDim: 0x5c9a76, sel: 0xd4ad45, route: 0x6fae88, routeSel: 0xd4ad45 };

function setLayer(obj, n) { obj.traverse((o) => o.layers.set(n)); }

// ——— procedural textures ———
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
function artTexture(kind) {
  return canvasTex(256, 320, (g, w, h) => {
    if (kind === 'portrait' || kind === 'sand') {
      const bg = g.createRadialGradient(w * .5, h * .38, 10, w * .5, h * .45, h * .7);
      bg.addColorStop(0, kind === 'sand' ? '#7a5a3a' : '#4a4038'); bg.addColorStop(1, kind === 'sand' ? '#2a1d14' : '#14110e');
      g.fillStyle = bg; g.fillRect(0, 0, w, h);
      g.fillStyle = kind === 'sand' ? '#3b2a20' : '#1e1a17';
      g.beginPath(); g.ellipse(w * .5, h * .95, w * .42, h * .42, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = kind === 'sand' ? '#d9b48f' : '#d8c3a5';
      g.beginPath(); g.ellipse(w * .5, h * .4, w * .16, h * .17, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = kind === 'sand' ? '#2a1a12' : '#3a2a1e';
      g.beginPath(); g.ellipse(w * .5, h * .3, w * .19, h * .1, 0, Math.PI, Math.PI * 2); g.fill();
      g.fillStyle = '#efe7da'; g.fillRect(w * .4, h * .6, w * .2, h * .05);
    } else if (kind === 'landscape') {
      const s = g.createLinearGradient(0, 0, 0, h); s.addColorStop(0, '#9fb6c4'); s.addColorStop(.55, '#e9d8b4'); s.addColorStop(1, '#6b7a4a');
      g.fillStyle = s; g.fillRect(0, 0, w, h);
      g.fillStyle = '#58663e'; g.beginPath(); g.moveTo(0, h * .62); g.quadraticCurveTo(w * .3, h * .45, w * .6, h * .6); g.quadraticCurveTo(w * .85, h * .7, w, h * .55); g.lineTo(w, h); g.lineTo(0, h); g.fill();
      g.fillStyle = '#c8b07a'; g.fillRect(w * .58, h * .48, w * .1, h * .1);
    } else {
      g.fillStyle = '#3e5a3a'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 260; i++) { g.fillStyle = ['#6f8f4f', '#a8b86a', '#d8c27a', '#2c4430', '#c97b5a'][i % 5]; g.beginPath(); g.arc(Math.random() * w, h * .25 + Math.random() * h * .75, 3 + Math.random() * 9, 0, 7); g.fill(); }
      g.fillStyle = '#b9c9d2'; g.fillRect(0, 0, w, h * .22);
    }
  });
}
const parquet = () => canvasTex(512, 512, (g, w, h) => {
  for (let y = 0; y < 16; y++) for (let x = 0; x < 4; x++) {
    const l = 0.85 + ((x * 7 + y * 13) % 9) / 40;
    g.fillStyle = `rgb(${Math.round(150 * l)},${Math.round(112 * l)},${Math.round(76 * l)})`;
    g.fillRect(x * 128 + ((y % 2) * 64), y * 32, 127, 31);
    g.fillRect(x * 128 + ((y % 2) * 64) - 512, y * 32, 127, 31);
  }
});
const scriptTex = () => canvasTex(256, 180, (g, w, h) => {
  g.fillStyle = '#efe6d2'; g.fillRect(0, 0, w, h);
  g.strokeStyle = '#3a2e22'; g.lineWidth = 1.2;
  for (let r = 0; r < 9; r++) { g.beginPath(); for (let x = 14; x < w - 14; x += 6) g.lineTo(x, 18 + r * 17 + Math.sin(x * .3 + r) * 2.5); g.stroke(); }
});

// ——— world builders ———
function buildWorld(scene) {
  const wallMats = [0, 1, 2, 3, 4, 5].map((i) => new THREE.MeshStandardMaterial({ color: i === 2 ? 0x2b3530 : 0xeee9df, roughness: 0.92 }));
  for (const [x1, z1, x2, z2] of walls) {
    const len = Math.hypot(x2 - x1, z2 - z1);
    const m = new THREE.Mesh(new THREE.BoxGeometry(len + WALL_T, WALL_H, WALL_T), wallMats);
    m.position.set((x1 + x2) / 2, WALL_H / 2, (z1 + z2) / 2);
    m.rotation.y = -Math.atan2(z2 - z1, x2 - x1);
    m.castShadow = m.receiveShadow = true;
    scene.add(m);
  }
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(120, 80), new THREE.MeshStandardMaterial({ color: 0x323b36, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2; ground.position.set(20, -0.02, 10); ground.receiveShadow = true; scene.add(ground);

  const wood = parquet(); wood.wrapS = wood.wrapT = THREE.RepeatWrapping; wood.repeat.set(3, 3);
  for (const r of rooms) {
    const sh = new THREE.Shape(r.poly.map(([x, z]) => new THREE.Vector2(x, -z)));
    const geo = new THREE.ShapeGeometry(sh);
    const mat = r.id === 'salon' ? new THREE.MeshStandardMaterial({ map: wood, roughness: 0.6 }) : new THREE.MeshStandardMaterial({ color: r.id === 'gallery' ? 0xd9d5ca : 0xe9e4d8, roughness: 0.45 });
    if (r.id === 'salon') { const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 6, uv.getY(i) / 6); }
    const f = new THREE.Mesh(geo, mat); f.rotation.x = -Math.PI / 2; f.receiveShadow = true; scene.add(f);
    const c = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0xf4f1ea, emissive: 0x5a564e, side: THREE.BackSide, roughness: 1 }));
    c.rotation.x = -Math.PI / 2; c.position.y = WALL_H; setLayer(c, 2); scene.add(c);
  }
  // salon cornice light strip + gallery skylight feel
  const strip = new THREE.Mesh(new THREE.BoxGeometry(10, 0.05, 0.3), new THREE.MeshBasicMaterial({ color: 0xfff6e0 }));
  strip.position.set(20, WALL_H - 0.03, 10); setLayer(strip, 2); scene.add(strip);
  // gallery window on east wall
  const win = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 2.2), new THREE.MeshBasicMaterial({ color: 0xcfe0e6 }));
  win.position.set(37.86, 2.2, 10); win.rotation.y = -Math.PI / 2; scene.add(win);

  const pick = [];
  for (const o of objects) {
    const g = buildObject(o); g.userData.pick = { type: 'object', id: o.id };
    g.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; m.userData.pick = g.userData.pick; } });
    scene.add(g); pick.push(g);
  }
  return pick;
}

const M = {
  ebony: new THREE.MeshStandardMaterial({ color: 0x5a3a22, roughness: 0.35, metalness: 0.1 }),
  dark: new THREE.MeshStandardMaterial({ color: 0x1b1714, roughness: 0.4 }),
  ivory: new THREE.MeshStandardMaterial({ color: 0xf2ece0, roughness: 0.4 }),
  brass: new THREE.MeshStandardMaterial({ color: 0xb08a3e, roughness: 0.35, metalness: 0.7 }),
  marble: new THREE.MeshStandardMaterial({ color: 0xece8e0, roughness: 0.5 }),
  plinth: new THREE.MeshStandardMaterial({ color: 0xdedad0, roughness: 0.8 }),
  frame: new THREE.MeshStandardMaterial({ color: 0xa4823c, roughness: 0.45, metalness: 0.5 }),
  glass: new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.16, roughness: 0.05 }),
  walnut: new THREE.MeshStandardMaterial({ color: 0x4b3424, roughness: 0.6 }),
  velvet: new THREE.MeshStandardMaterial({ color: 0x24493a, roughness: 0.95 }),
  bronze: new THREE.MeshStandardMaterial({ color: 0x7b5a33, roughness: 0.4, metalness: 0.6 }),
};

function box(w, h, d, mat, x, y, z) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); return m; }

function buildObject(o) {
  const g = new THREE.Group(); g.position.set(o.x, 0, o.z);
  if (o.kind === 'piano') {
    const s = new THREE.Shape();
    s.moveTo(0, -0.74); s.lineTo(0, 0.74); s.lineTo(0.9, 0.74);
    s.bezierCurveTo(1.35, 0.74, 1.45, 0.42, 1.75, 0.3); s.bezierCurveTo(2.15, 0.15, 2.3, -0.1, 2.2, -0.42);
    s.bezierCurveTo(2.1, -0.74, 1.6, -0.74, 1.2, -0.74); s.lineTo(0, -0.74);
    const body = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: 0.34, bevelEnabled: false, curveSegments: 18 }), M.ebony);
    body.rotation.x = -Math.PI / 2; body.position.y = 0.62;
    const inner = new THREE.Mesh(new THREE.ShapeGeometry(s), new THREE.MeshStandardMaterial({ color: 0xb3874d, roughness: 0.5 }));
    inner.rotation.x = -Math.PI / 2; inner.position.set(0.04, 0.968, 0); inner.scale.set(0.94, 0.9, 1);
    const lid = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: 0.025, bevelEnabled: false, curveSegments: 18 }), M.ebony);
    // hinge on the straight side (+z); the curved side lifts
    const hinge = new THREE.Group(); hinge.position.set(0, 0.965, 0.74); lid.rotation.x = -Math.PI / 2; lid.position.z = -0.74;
    hinge.add(lid); hinge.rotation.x = 0.62;
    const prop = box(0.025, 0.66, 0.025, M.ebony, 1.1, 1.27, -0.14);
    const keys = box(0.26, 0.06, 1.36, M.ivory, -0.13, 0.83, 0);
    const blacks = new THREE.Group();
    for (let i = 0; i < 36; i++) if ([1, 3, 6, 8, 10].includes(i % 12)) blacks.add(box(0.14, 0.03, 0.022, M.dark, -0.07, 0.875, -0.66 + i * 0.037));
    const cheek = box(0.3, 0.12, 1.5, M.ebony, -0.15, 0.76, 0);
    const stand = box(0.03, 0.26, 0.7, M.ebony, 0.14, 1.08, 0); stand.rotation.z = 0.25;
    g.add(body, inner, hinge, prop, keys, blacks, cheek, stand);
    for (const [lx, lz] of [[0.15, -0.6], [0.15, 0.6], [1.85, -0.25]]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.045, 0.62, 12), M.ebony); leg.position.set(lx, 0.31, lz); g.add(leg);
      const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.04, 12), M.brass); cup.position.set(lx, 0.02, lz); g.add(cup);
    }
    const stool = box(0.4, 0.06, 0.8, M.velvet, -0.75, 0.48, 0); g.add(stool, box(0.36, 0.45, 0.7, M.ebony, -0.75, 0.22, 0));
    g.children.forEach((c) => { c.position.x -= 1.0; });
  } else if (o.kind === 'statue') {
    g.add(box(1.1, 1.0, 1.1, M.plinth, 0, 0.5, 0));
    const prof = [[0, 0], [0.34, 0], [0.32, 0.25], [0.24, 0.6], [0.2, 0.95], [0.26, 1.05], [0.12, 1.12], [0.0, 1.13]].map(([r, y]) => new THREE.Vector2(r, y));
    const fig = new THREE.Mesh(new THREE.LatheGeometry(prof, 28), M.marble); fig.position.y = 1.0; g.add(fig);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 24, 16), M.marble); head.position.y = 2.25; g.add(head);
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.5, 4, 8), M.marble); arm.position.set(0.18, 1.85, 0.08); arm.rotation.z = -0.9; g.add(arm);
  } else if (o.kind === 'painting') {
    g.position.y = o.y;
    g.add(box(o.w + 0.16, o.h + 0.16, 0.06, M.frame, 0, 0, 0));
    const c = new THREE.Mesh(new THREE.PlaneGeometry(o.w, o.h), new THREE.MeshStandardMaterial({ map: artTexture(o.art), roughness: 0.8 }));
    c.position.z = 0.035; g.add(c);
    const lamp = box(0.5, 0.04, 0.12, M.brass, 0, o.h / 2 + 0.22, 0.1); g.add(lamp);
  } else if (o.kind === 'vitrine') {
    g.add(box(o.w, 0.9, o.d, M.walnut, 0, 0.45, 0));
    const paper = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.5), new THREE.MeshStandardMaterial({ map: scriptTex(), roughness: 0.9 }));
    paper.rotation.x = -Math.PI / 2 + 0.25; paper.position.set(0, 0.95, 0); g.add(paper);
    const gl = box(o.w - 0.04, 0.42, o.d - 0.04, M.glass, 0, 1.12, 0); gl.castShadow = false; g.add(gl);
  } else if (o.kind === 'bench') {
    g.add(box(o.w, 0.12, o.d, M.velvet, 0, 0.42, 0), box(o.w - 0.1, 0.36, o.d - 0.1, M.walnut, 0, 0.18, 0));
  } else if (o.kind === 'plinth') {
    g.add(box(o.w, 1.0, o.d, M.plinth, 0, 0.5, 0));
    const palm = box(0.12, 0.04, 0.22, M.bronze, 0, 1.03, 0); g.add(palm);
    for (let i = 0; i < 4; i++) g.add(box(0.022, 0.025, 0.12, M.bronze, -0.045 + i * 0.03, 1.04, -0.16));
    const glass = box(0.5, 0.4, 0.5, M.glass, 0, 1.22, 0); glass.castShadow = false; g.add(glass);
  }
  return g;
}

// ——— view & route helpers ———
function cameraGlyph(color, opacity = 1, fov = 52) {
  const g = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.2, 0.2), mat); body.position.x = -0.12; g.add(body);
  const d = 0.85, hw = Math.tan((fov * Math.PI / 180) / 2) * d, hh = hw * 0.62;
  const p = [[0, 0, 0], [d, hh, -hw], [d, hh, hw], [d, -hh, hw], [d, -hh, -hw]];
  const idx = [0, 1, 0, 2, 0, 3, 0, 4, 1, 2, 2, 3, 3, 4, 4, 1];
  const geo = new THREE.BufferGeometry().setFromPoints(idx.map((i) => new THREE.Vector3(...p[i])));
  g.add(new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color, transparent: true, opacity })));
  const face = new THREE.BufferGeometry().setFromPoints([0, 1, 2, 0, 2, 3, 0, 3, 4, 0, 4, 1].map((i) => new THREE.Vector3(...p[i])));
  g.add(new THREE.Mesh(face, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: opacity * 0.22, side: THREE.DoubleSide, depthWrite: false })));
  const hit = new THREE.Mesh(new THREE.SphereGeometry(0.45, 8, 6), new THREE.MeshBasicMaterial({ visible: false })); g.add(hit);
  return g;
}

function placeGlyph(g, pose) {
  g.position.set(...pose.pos);
  const [dx, dy, dz] = pose.dir;
  g.rotation.set(0, 0, 0, 'YZX');
  g.rotation.y = -Math.atan2(dz, dx);
  g.rotation.z = Math.asin(Math.max(-1, Math.min(1, dy)));
}

export class Stage3D {
  constructor(host) {
    this.host = host;
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.05;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    host.appendChild(this.renderer.domElement);
    this.scene = new THREE.Scene(); this.scene.background = new THREE.Color(0x26302b);
    this.scene.add(new THREE.HemisphereLight(0xfff6e8, 0x40463f, 1.25));
    const sun = new THREE.DirectionalLight(0xfff1dc, 1.6); sun.position.set(28, 30, 22); sun.target.position.set(20, 0, 10);
    sun.castShadow = true; sun.shadow.mapSize.set(1536, 1536);
    Object.assign(sun.shadow.camera, { left: -24, right: 24, top: 16, bottom: -16, near: 1, far: 90 });
    this.scene.add(sun, sun.target);
    this.scene.add(new THREE.AmbientLight(0xf3efe6, 0.55));
    for (const [x, z, i] of [[19.6, 10.5, 22], [7, 10, 20], [32, 10, 20], [20, 4, 10], [20, 15.5, 10]]) {
      const l = new THREE.PointLight(0xffe2b8, i, 13, 1.5); l.position.set(x, 3.7, z); this.scene.add(l);
    }
    this.pickables = buildWorld(this.scene);
    this.helpers = new THREE.Group(); this.scene.add(this.helpers);
    this.camera = new THREE.PerspectiveCamera(50, 1, 0.05, 300);
    this.orbit = { target: new THREE.Vector3(21, 0, 10.5), r: 31, theta: Math.PI / 2 + 0.25, phi: 0.82 };
    this.mode = 'orbit'; // or 'pose'
    this.pose = null;
    this.ray = new THREE.Raycaster(); this.ray.layers.enableAll();
    this.viewGlyphs = new Map();
    this.puck = cameraGlyph(COL.sel, 1); setLayer(this.puck, 1); this.puck.visible = false; this.scene.add(this.puck);
    this.dirty = true; this.anim = null;
    this.applyCamera();
    this.resize();
    new ResizeObserver(() => this.resize()).observe(host);
    const loop = (t) => { requestAnimationFrame(loop); this.tick(t); };
    requestAnimationFrame(loop);
  }

  resize() {
    const w = this.host.clientWidth || 1, h = this.host.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.renderer.domElement.style.width = w + 'px'; this.renderer.domElement.style.height = h + 'px';
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); this.dirty = true;
  }

  applyCamera() {
    const c = this.camera;
    if (this.mode === 'orbit') {
      const o = this.orbit;
      c.position.set(o.target.x + o.r * Math.sin(o.phi) * Math.cos(o.theta), o.target.y + o.r * Math.cos(o.phi), o.target.z + o.r * Math.sin(o.phi) * Math.sin(o.theta));
      c.lookAt(o.target); c.fov = 50;
      c.layers.set(0); c.layers.enable(1);
    } else {
      const p = this.pose;
      c.position.set(...p.pos); c.lookAt(p.pos[0] + p.dir[0], p.pos[1] + p.dir[1], p.pos[2] + p.dir[2]); c.fov = p.fov;
      c.layers.set(0); c.layers.enable(2); if (this.showHelpersInPose) c.layers.enable(1);
    }
    c.updateProjectionMatrix(); this.dirty = true;
  }

  // Current standpoint as a Camera pose (what "Capture" records).
  currentPose() {
    const c = this.camera, d = new THREE.Vector3(); c.getWorldDirection(d);
    return { pos: [c.position.x, c.position.y, c.position.z], dir: [d.x, d.y, d.z], fov: c.fov };
  }
  saveStandpoint() { return { mode: this.mode, orbit: { ...this.orbit, target: this.orbit.target.clone() }, pose: this.pose }; }
  restoreStandpoint(s, animate = true) {
    if (!s) return;
    if (s.mode === 'orbit') {
      const fromPose = this.currentPose();
      this.orbit = { ...s.orbit, target: s.orbit.target.clone() };
      if (animate && this.mode === 'pose') {
        this.mode = 'orbit'; this.applyCamera(); const toPose = this.currentPose();
        this.mode = 'pose'; this.pose = fromPose;
        this.tweenPose(fromPose, toPose, 650, () => { this.mode = 'orbit'; this.applyCamera(); });
      } else { this.mode = 'orbit'; this.applyCamera(); }
    } else this.setPose(s.pose);
  }
  setPose(p) { this.anim = null; this.mode = 'pose'; this.pose = p; this.applyCamera(); }
  tweenPose(a, b, ms, done) {
    this.mode = 'pose';
    this.anim = { a, b, ms, t0: performance.now(), done };
  }
  tick() {
    if (this.anim) {
      const k = Math.min(1, (performance.now() - this.anim.t0) / this.anim.ms);
      this.pose = blendPose(this.anim.a, this.anim.b, k); this.applyCamera();
      if (k >= 1) { const d = this.anim.done; this.anim = null; d && d(); }
    }
    if (this.dirty) { this.renderer.render(this.scene, this.camera); this.dirty = false; this.onRender && this.onRender(); }
  }

  orbitBy(dx, dy) { this.orbit.theta += dx * 0.006; this.orbit.phi = Math.min(1.45, Math.max(0.12, this.orbit.phi - dy * 0.005)); this.applyCamera(); }
  panBy(dx, dy) {
    const o = this.orbit, s = o.r * 0.0016;
    const right = new THREE.Vector3(-Math.sin(o.theta), 0, Math.cos(o.theta));
    const fwd = new THREE.Vector3(Math.cos(o.theta), 0, Math.sin(o.theta));
    o.target.addScaledVector(right, -dx * s).addScaledVector(fwd, -dy * s); this.applyCamera();
  }
  zoomBy(f) { this.orbit.r = Math.min(70, Math.max(3, this.orbit.r * f)); this.applyCamera(); }
  // Look-around for an inside pose (look through / visitor free look).
  lookBy(dx, dy) {
    const p = this.pose; if (!p) return;
    let yaw = Math.atan2(p.dir[2], p.dir[0]) + dx * 0.004;
    let pitch = Math.asin(p.dir[1]) - dy * 0.004; pitch = Math.max(-1.2, Math.min(1.2, pitch));
    this.pose = { ...p, dir: [Math.cos(yaw) * Math.cos(pitch), Math.sin(pitch), Math.sin(yaw) * Math.cos(pitch)] }; this.applyCamera();
  }
  dollyBy(m) { const p = this.pose; if (!p) return; this.pose = { ...p, pos: [p.pos[0] + p.dir[0] * m, p.pos[1], p.pos[2] + p.dir[2] * m] }; this.applyCamera(); }

  pick(clientX, clientY) {
    const r = this.renderer.domElement.getBoundingClientRect();
    this.ray.setFromCamera(new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1), this.camera);
    const targets = [...this.viewGlyphs.values(), ...this.pickables];
    const hits = this.ray.intersectObjects(targets, true);
    for (const h of hits) {
      let o = h.object; while (o && !o.userData.pick) o = o.parent;
      if (o && o.userData.pick) return o.userData.pick;
    }
    return null;
  }

  project(p) {
    const v = new THREE.Vector3(...p).project(this.camera);
    const r = this.renderer.domElement;
    return { x: (v.x + 1) / 2 * r.clientWidth, y: (1 - v.y) / 2 * r.clientHeight, behind: v.z > 1 };
  }

  // Rebuild the editor helpers from the document + UI emphasis.
  updateHelpers(doc, emph) {
    this.helpers.clear(); this.viewGlyphs.clear();
    for (const v of Object.values(doc.views)) {
      const strong = !emph.presId || v.presId === emph.presId;
      const sel = emph.viewId === v.id;
      const g = cameraGlyph(sel ? COL.sel : COL.view, sel ? 1 : strong ? 0.95 : 0.3, viewPose(v).fov);
      placeGlyph(g, viewPose(v)); g.userData.pick = { type: 'view', id: v.id };
      g.scale.setScalar(sel ? 1.9 : 1.45);
      setLayer(g, 1); this.helpers.add(g); this.viewGlyphs.set(v.id, g);
    }
    if (emph.objectId) {
      const g = this.pickables.find((o) => o.userData.pick.id === emph.objectId);
      if (g) { const bx = new THREE.Box3Helper(new THREE.Box3().setFromObject(g).expandByScalar(0.12), COL.sel); setLayer(bx, 1); this.helpers.add(bx); }
    }
    for (const r of emph.routes || []) {
      const from = doc.views[r.from], to = doc.views[r.to]; if (!from || !to) continue;
      const pts = sampleRoute(controlPoints(from, to, doc.paths[pathKey(r.from, r.to)]), 20);
      const n = pts.length;
      const v3 = pts.map(([x, z], i) => new THREE.Vector3(x, from.pos[1] + (to.pos[1] - from.pos[1]) * (i / (n - 1)), z));
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(v3), new THREE.LineBasicMaterial({ color: r.selected ? COL.routeSel : COL.route, transparent: true, opacity: r.selected ? 1 : 0.55 }));
      const shadow = new THREE.Line(new THREE.BufferGeometry().setFromPoints(v3.map((p) => new THREE.Vector3(p.x, 0.03, p.z))), new THREE.LineDashedMaterial({ color: 0x1f3a2e, dashSize: 0.25, gapSize: 0.18 }));
      shadow.computeLineDistances();
      setLayer(line, 1); setLayer(shadow, 1); this.helpers.add(line, shadow);
      if (r.selected) for (const [x, z] of (doc.paths[pathKey(r.from, r.to)]?.points || [])) {
        const s = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 8), new THREE.MeshBasicMaterial({ color: COL.routeSel }));
        s.position.set(x, (from.pos[1] + to.pos[1]) / 2, z); setLayer(s, 1); this.helpers.add(s);
      }
    }
    this.dirty = true;
  }
  setPuck(pose) {
    if (!pose) { this.puck.visible = false; this.dirty = true; return; }
    this.puck.visible = true; placeGlyph(this.puck, pose); this.dirty = true;
  }
}

// Offscreen thumbnails from the same scene (no helpers).
export class Thumbs {
  constructor(stage) {
    this.stage = stage; this.cache = new Map();
    this.r = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    this.r.setSize(240, 150, false); this.r.toneMapping = THREE.ACESFilmicToneMapping; this.r.outputColorSpace = THREE.SRGBColorSpace;
    this.cam = new THREE.PerspectiveCamera(50, 240 / 150, 0.05, 200); this.cam.layers.set(0); this.cam.layers.enable(2);
  }
  get(v) {
    const p = viewPose(v); const key = JSON.stringify(p);
    if (this.cache.has(key)) return this.cache.get(key);
    this.cam.position.set(...p.pos); this.cam.lookAt(p.pos[0] + p.dir[0], p.pos[1] + p.dir[1], p.pos[2] + p.dir[2]);
    this.cam.fov = p.fov; this.cam.updateProjectionMatrix();
    const vis = this.stage.helpers.visible, pk = this.stage.puck.visible;
    this.stage.helpers.visible = false; this.stage.puck.visible = false;
    this.r.render(this.stage.scene, this.cam);
    this.stage.helpers.visible = vis; this.stage.puck.visible = pk;
    const url = this.r.domElement.toDataURL('image/jpeg', 0.82);
    this.cache.set(key, url); return url;
  }
}

// Visitor renderer: same scene, world + ceilings only.
export class VisitorView {
  constructor(stage, host) {
    this.stage = stage; this.host = host;
    this.r = new THREE.WebGLRenderer({ antialias: true });
    this.r.setPixelRatio(Math.min(2, window.devicePixelRatio));
    this.r.shadowMap.enabled = true; this.r.toneMapping = THREE.ACESFilmicToneMapping; this.r.toneMappingExposure = 1.1; this.r.outputColorSpace = THREE.SRGBColorSpace;
    host.appendChild(this.r.domElement);
    this.cam = new THREE.PerspectiveCamera(52, 1, 0.05, 200); this.cam.layers.set(0); this.cam.layers.enable(2);
    this.pose = null; this.anim = null; this.alive = true;
    const ro = new ResizeObserver(() => this.resize()); ro.observe(host); this.ro = ro; this.resize();
    const loop = () => { if (!this.alive) return; requestAnimationFrame(loop); this.tick(); }; loop();
  }
  resize() { const w = this.host.clientWidth || 1, h = this.host.clientHeight || 1; this.r.setSize(w, h); this.cam.aspect = w / h; this.cam.updateProjectionMatrix(); }
  set(p) { this.pose = p; }
  tick() {
    if (!this.pose) return;
    const p = this.pose; this.cam.position.set(...p.pos); this.cam.lookAt(p.pos[0] + p.dir[0], p.pos[1] + p.dir[1], p.pos[2] + p.dir[2]);
    this.cam.fov = p.fov; this.cam.updateProjectionMatrix();
    this.r.render(this.stage.scene, this.cam);
  }
  dispose() { this.alive = false; this.ro.disconnect(); this.r.dispose(); this.r.domElement.remove(); }
}
