import { fovFor } from './camera-evaluation.js';
import * as THREE from 'three';
import { buildWallGeometry, buildSlabGeometry, paintTexture, placeArtwork, wallSampler, horizontalCaps } from './geometry.js';
import { byId, planeY, FLOOR_Y } from './model.js';

export const COLORS = {
  mat: '#1D3A33', matDeep: '#152C26', grid: '#2B5147', gridMajor: '#3C6A5C',
  paper: '#F3F4EE', paperGrid: '#9FB2A2', paperGridMajor: '#809984',
  paperGridAlpha: 0.28, paperGridMajorAlpha: 0.45,
  foam: '#F1F2EC', floor: '#D3DBD0', floorPaper: '#E7EBE3', ink: '#202422', poche: '#26302C',
  tape: '#F2B53C', coral: '#C85A48', sky: '#8CC0EA', ghost: '#DCEBE4',
  /* selection and manipulation resolve to the restrained ochre */
  sel: '#E5A020', selEdge: '#8A5B10', view: '#56707C',
};

// Grid decimation. The projected CSS-pixel spacing of a minor line decides which rung of the
// 1, 2, 5 × 10ⁿ ladder is drawn, so the grid reads at a stable apparent density at any zoom.
const GRID_LADDER = [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100];
// The two grids hand over inside the page's own crossfade: the mat's rule is gone before the
// drafting rule arrives, so the two line systems are never drawn over each other, and the surface
// passes through a clean blank moment between them. Both are the material's progress, not a
// timeline — see applyGrid.
const MAT_GRID_OUT = 0.5;
const PAPER_GRID_IN = 0.55;
const PAPER_GRID_FULL = 0.85;
// The plan's density floor: the finest rung that still leaves 16 px between minor lines. At the
// reference Plan and elevation framing that resolves 1 m minors with 5 m majors; sub-metre
// divisions appear only when zoomed in, and the grid fades out and then vanishes below 8 px at
// the coarse end of the ladder.
const GRID_TARGET_PX = 16;
const GRID_MIN_PX = 8;
const smoothstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

const V3 = THREE.Vector3;
const lerp = (a, b, t) => a + (b - a) * t;
export const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export { fovFor };

// A tile holds `cells` minor cells with a heavier line every `majorEvery`. With a transparent
// background the tile is a line layer that can fade on its own; with a background it is an opaque
// drafting sheet.
function gridTexture(bg, minor, major, lwMinor, lwMajor, opts = {}) {
  const { cells = 10, majorEvery = 5, alphaMinor = 1, alphaMajor = 1, size = 1024, transparentBg = false } = opts;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  if (transparentBg) g.clearRect(0, 0, size, size);
  else { g.fillStyle = bg; g.fillRect(0, 0, size, size); }
  for (let i = 0; i <= cells; i++) {
    const p = (i / cells) * size;
    const isMajor = i % majorEvery === 0;
    g.globalAlpha = isMajor ? alphaMajor : alphaMinor;
    g.strokeStyle = isMajor ? major : minor;
    g.lineWidth = isMajor ? lwMajor : lwMinor;
    g.beginPath(); g.moveTo(p, 0); g.lineTo(p, size); g.stroke();
    g.beginPath(); g.moveTo(0, p); g.lineTo(size, p); g.stroke();
  }
  g.globalAlpha = 1;
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(120, 120);
  t.anisotropy = 8;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}  // A ground grid fades out with distance as well as with the zoom ladder. Near the horizon a 1 m grid
  // compresses below one pixel and aliases into wide horizontal bands — the most visible artefact any
  // ground grid has — so each grid lives in its own transparent layer whose alpha dies with view
  // distance. Three lines of shader; no new pass, no per-frame texture work. The fade also retires
  // the far field, where the layers' 2 mm depth separation is finer than the depth buffer can
  // resolve and a coplanar grid would shimmer as the camera moves.
const GRID_FADE_NEAR = 16;
const GRID_FADE_FAR = 44;
function gridLayer(tex, opacity = 1) {
  const m = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity, depthWrite: false });
  m.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace(
      '#include <opaque_fragment>',
      `#ifdef USE_FOG\n\tdiffuseColor.a *= 1.0 - smoothstep(${GRID_FADE_NEAR}.0, ${GRID_FADE_FAR}.0, vFogDepth);\n#endif\n#include <opaque_fragment>`,
    );
  };
  return m;
}

export class Stage {
  constructor(canvas, museum) {
    this.canvas = canvas;
    this.museum = museum;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.localClippingEnabled = true;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene = new THREE.Scene();
    this.bg = new THREE.Color(COLORS.matDeep);
    this.scene.background = this.bg;
    this.scene.fog = new THREE.Fog(COLORS.matDeep, 60, 220);
    this.camera = new THREE.PerspectiveCamera(40, 1, 0.1, 2000);
    this.peekCam = new THREE.PerspectiveCamera(40, 1, 0.1, 2000);
    // One camera for every standpoint. flat 0 = perspective, 1 = drawn to scale.
    this.cam = { target: new V3(-2, 1.5, 0), az: 0.72, el: 0.6, frameH: 26, flat: 0, mirror: false };
    this.paper = 0;
    this.disp = new Map();
    this.items = new Map();
    this.root = new THREE.Group();
    this.scene.add(this.root);
    this.fx = new THREE.Group();
    this.scene.add(this.fx);
    this.capH = new THREE.Group();
    this.capV = new THREE.Group();
    this.scene.add(this.capH, this.capV);
    this.clips = [];
    this.noClip = new THREE.Plane(new V3(0, 1, 0), 1e5);
    this.aways = {};
    this.ceilingsSeeThrough = true;
    this.initMaterials();
    this.initWorld();
    this.buildAll();
    this.raycaster = new THREE.Raycaster();
    this.raycaster.params.Line.threshold = 0.05;
  }

  initMaterials() {
    const M = (o) => new THREE.MeshStandardMaterial({ roughness: 0.92, metalness: 0, side: THREE.DoubleSide, ...o });
    const sel = new THREE.Color(COLORS.sel);
    this.mat = {
      foam: M({ color: COLORS.foam }),
      foamHover: M({ color: COLORS.foam, emissive: sel, emissiveIntensity: 0.07 }),
      foamSel: M({ color: COLORS.foam, emissive: sel, emissiveIntensity: 0.16 }),
      // Vellum: a drafting sheet, not a white light source. The tile is one major interval with
      // five minor cells, so the wall's generated UVs carry honest measurement spacing. The
      // emissive response is calibrated so the displaced wall renders as the same paper as the
      // vellum ground it lies on, rather than a darker sage surface; it stays below the ground's
      // own brightness so the sheet never glows over the page.
      sheet: (() => {
        const tex = gridTexture(COLORS.paper, COLORS.paperGrid, COLORS.paperGridMajor, 3, 5, {
          cells: 5, majorEvery: 5, alphaMinor: COLORS.paperGridAlpha, alphaMajor: COLORS.paperGridMajorAlpha,
        });
        tex.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
        tex.repeat.set(1, 1); // the wall's UVs are already in major-interval units
        return M({ color: '#FFFFFF', map: tex, roughness: 1, emissive: new THREE.Color(COLORS.paper), emissiveIntensity: 0.36 });
      })(),
      floor: M({ color: COLORS.floor }),
      ceil: M({ color: '#E9EBE4' }),
      ceilSee: M({ color: '#E9EBE4', transparent: true, opacity: 0.1, depthWrite: false }),
      ceilLift: M({ color: '#F5F6F1', transparent: true, opacity: 0.92 }),
      ceilSusp: M({ color: '#E3E6DE' }),
      ghost: new THREE.MeshBasicMaterial({ color: COLORS.ghost, transparent: true, opacity: 0.07, depthWrite: false, side: THREE.DoubleSide }),
      frame: M({ color: '#2B2621', roughness: 0.6 }),
      frameSel: M({ color: COLORS.sel, roughness: 0.5 }),
      plinth: M({ color: '#E4E6DF' }),
      vessel: new THREE.MeshStandardMaterial({ color: '#2F63B5', roughness: 0.35, metalness: 0.1 }),
      oak: M({ color: '#B98E5E', roughness: 0.8 }),
      line: new THREE.LineBasicMaterial({ color: COLORS.ink, transparent: true, opacity: 0.5 }),
      lineSel: new THREE.LineBasicMaterial({ color: COLORS.selEdge }),
      lineGhost: new THREE.LineBasicMaterial({ color: '#BFD9CE', transparent: true, opacity: 0.22, depthWrite: false }),
      lineSee: new THREE.LineBasicMaterial({ color: '#E9EBE4', transparent: true, opacity: 0.35 }),
    };
    this.unclipped = {
      cap: new THREE.MeshBasicMaterial({ color: COLORS.poche, side: THREE.DoubleSide }),
      capLine: new THREE.LineBasicMaterial({ color: COLORS.ink }),
      xray: new THREE.MeshBasicMaterial({ color: COLORS.sel, transparent: true, opacity: 0.55, depthTest: false }),
      revealLine: new THREE.LineBasicMaterial({ color: COLORS.selEdge, depthTest: false }),
    };
  }

  initWorld() {
    this.hemi = new THREE.HemisphereLight('#ffffff', '#35574d', 1.35);
    this.scene.add(this.hemi);
    const sun = new THREE.DirectionalLight('#fff6e8', 1.9);
    sun.position.set(-18, 34, 22);
    sun.target.position.set(-2, 0, 0);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera;
    sc.left = -26; sc.right = 26; sc.top = 20; sc.bottom = -20; sc.near = 5; sc.far = 90;
    sun.shadow.bias = -0.0006;
    sun.shadow.normalBias = 0.03;
    this.scene.add(sun, sun.target);
    this.sun = sun;
    // The mat's grid moves onto a layer of its own, like the paper's, so the two grids can be
    // crossfaded and decimated independently instead of one of them being baked into a surface.
    this.ground = new THREE.Mesh(new THREE.PlaneGeometry(1200, 1200), new THREE.MeshStandardMaterial({ color: COLORS.mat, roughness: 1 }));
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.position.y = -0.135;
    this.ground.receiveShadow = true;
    this.scene.add(this.ground);
    this.matGridTex = gridTexture(null, COLORS.grid, COLORS.gridMajor, 1.5, 3, { transparentBg: true });
    this.matGridTex.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
    this.matGrid = new THREE.Mesh(new THREE.PlaneGeometry(1200, 1200), gridLayer(this.matGridTex));
    this.matGrid.rotation.x = -Math.PI / 2;
    // 2 mm above the mat: enough that the opaque mat never wins the depth test against its own
    // grid, invisible at every camera elevation. Its own grid is the plan's 1 m / 5 m rule at the
    // mat's 1200-unit tile (repeat 120), fixed rather than ladder-driven — see applyGrid.
    this.matGrid.position.y = -0.133;
    this.matGrid.renderOrder = -3;
    this.scene.add(this.matGrid);
    // Vellum paper with the grid on its own transparent layer above, so line density can be
    // decimated and faded by projected spacing without touching the paper itself.
    this.paperGround = new THREE.Mesh(new THREE.PlaneGeometry(1200, 1200), new THREE.MeshBasicMaterial({ color: COLORS.paper, transparent: true, opacity: 0, depthWrite: false }));
    this.paperGround.rotation.x = -Math.PI / 2;
    this.paperGround.position.y = -0.132;
    this.paperGround.renderOrder = -2;
    this.scene.add(this.paperGround);
    this.gridTex = gridTexture(null, COLORS.paperGrid, COLORS.paperGridMajor, 3, 5, {
      transparentBg: true, alphaMinor: COLORS.paperGridAlpha, alphaMajor: COLORS.paperGridMajorAlpha,
    });
    this.gridTex.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
    this.grid = new THREE.Mesh(new THREE.PlaneGeometry(1200, 1200), gridLayer(this.gridTex));
    this.grid.rotation.x = -Math.PI / 2;
    this.grid.position.y = -0.129;
    this.grid.renderOrder = -1;
    this.scene.add(this.grid);
    this.cMat = new THREE.Color(COLORS.matDeep);
    this.cPaper = new THREE.Color(COLORS.paper);
    this.cUnder = new THREE.Color('#D4D8CF');
  }

  d(id) {
    if (!this.disp.has(id)) this.disp.set(id, { mode: 'normal', hl: null, u: 0, sA: null, lift: [0, 0], y: 0 });
    return this.disp.get(id);
  }

  clearGroup(g) {
    while (g.children.length) {
      const c = g.children.pop();
      c.traverse?.((o) => { if (o.geometry && !o.userData.keepGeo) o.geometry.dispose(); });
    }
  }

  buildAll() {
    this.clearGroup(this.root);
    this.items.clear();
    const m = this.museum;
    for (const w of m.walls) this.buildWall(w);
    for (const c of m.ceilings) this.buildCeiling(c);
    for (const f of m.floors) {
      const g = buildSlabGeometry(f.outline, [], { base: -0.12, gx: 0, gz: 0 }, 0.12);
      const mesh = new THREE.Mesh(g.mesh, this.mat.floor);
      mesh.receiveShadow = true;
      mesh.userData = { id: f.id, kind: 'floor' };
      this.root.add(mesh);
      this.items.set(f.id, { kind: 'floor', data: f, mesh, lines: null, group: mesh });
    }
    for (const a of m.art) this.buildArt(a);
    for (const o of m.objects) this.buildObject(o);
    // A full rebuild drops the drawn preview with everything else; the declared candidate is part of
    // the work in hand, so it is drawn again from its own parameters, never from a host guess.
    if (this.previewPlace) this.setArtPreview(this.previewPlace);
    this.restyle();
  }

  buildWall(w) {
    const ds = this.d(w.id);
    const g = buildWallGeometry(w, { u: ds.u, sA: ds.sA ?? undefined, lift: ds.lift, y: ds.y });
    let it = this.items.get(w.id);
    if (!it) {
      const mesh = new THREE.Mesh(g.mesh, this.mat.foam);
      mesh.castShadow = true; mesh.receiveShadow = true;
      mesh.userData = { id: w.id, kind: 'wall' };
      const lines = new THREE.LineSegments(g.lines, this.mat.line);
      const group = new THREE.Group();
      group.add(mesh, lines);
      this.root.add(group);
      it = { kind: 'wall', data: w, mesh, lines, group };
      this.items.set(w.id, it);
    } else {
      it.mesh.geometry.dispose(); it.lines.geometry.dispose();
      it.mesh.geometry = g.mesh; it.lines.geometry = g.lines;
      it.data = w;
    }
    return it;
  }

  buildCeiling(c) {
    const ds = this.d(c.id);
    const g = buildSlabGeometry(c.outline, c.holes.map((h) => h.pts), c.plane, c.thick, ds.y);
    let it = this.items.get(c.id);
    if (!it) {
      const mesh = new THREE.Mesh(g.mesh, this.mat.ceil);
      mesh.userData = { id: c.id, kind: 'ceiling' };
      mesh.castShadow = true;
      const lines = new THREE.LineSegments(g.lines, this.mat.line);
      const group = new THREE.Group();
      group.add(mesh, lines);
      this.root.add(group);
      it = { kind: 'ceiling', data: c, mesh, lines, group };
      this.items.set(c.id, it);
    } else {
      it.mesh.geometry.dispose(); it.lines.geometry.dispose();
      it.mesh.geometry = g.mesh; it.lines.geometry = g.lines;
      it.data = c;
    }
    return it;
  }

  buildArt(a) {
    const group = new THREE.Group();
    const frame = new THREE.Mesh(new THREE.BoxGeometry(a.w + 0.1, a.h + 0.1, 0.06), this.mat.frame);
    frame.castShadow = true;
    frame.userData = { id: a.id, kind: 'art' };
    const canvasMat = new THREE.MeshStandardMaterial({ map: paintTexture(a.paint), roughness: 0.8 });
    const face = new THREE.Mesh(new THREE.PlaneGeometry(a.w, a.h), canvasMat);
    face.position.z = 0.032;
    face.userData = { id: a.id, kind: 'art' };
    group.add(frame, face);
    this.root.add(group);
    this.items.set(a.id, { kind: 'art', data: a, mesh: frame, face, canvasMat, lines: null, group });
    if (a.wall) this.placeArt(a);
    else this.layUnplaced(a);
  }

  placeArt(a) {
    const it = this.items.get(a.id);
    const w = byId(this.museum.walls, a.wall);
    // An unresolved reference is never placed on a wall the fixture does not name.
    if (!it || !w) return false;
    it.unplaced = false;
    const ds = this.d(w.id);
    placeArtwork(it.group, w, a, { u: ds.u, sA: ds.sA ?? undefined, lift: ds.lift, y: ds.y });
    return true;
  }

  // A reference with no host still has a body: it lies where it was last seen. This is the display
  // locator the plan allows — visible, pickable, and never an answer to "which wall": placeArt refuses
  // to move it anywhere until the source itself names a wall.
  layUnplaced(a) {
    const it = this.items.get(a.id);
    if (!it || !a.lastAt) return false;
    it.unplaced = true;
    it.group.position.set(a.lastAt.x, FLOOR_Y + 0.05, a.lastAt.z);
    it.group.rotation.set(-Math.PI / 2, 0, 0);
    return true;
  }

  // The declared candidate, drawn where it would hang: a preview, not a source write, and gone the
  // moment the work it belongs to ends. Building it reads only the declared place.
  setArtPreview(place) {
    this.clearArtPreview();
    const a = byId(this.museum.art, place.art);
    const w = byId(this.museum.walls, place.wall);
    if (!a || !w) return null;
    const group = new THREE.Group();
    group.userData = { artPreview: a.id };
    const frame = new THREE.Mesh(new THREE.BoxGeometry(a.w + 0.1, a.h + 0.1, 0.06), this.mat.ghost);
    const face = new THREE.Mesh(new THREE.PlaneGeometry(a.w, a.h), this.mat.ghost);
    face.position.z = 0.032;
    group.add(frame, face);
    this.root.add(group);
    const ds = this.d(w.id);
    placeArtwork(group, w, { ...a, s: place.s, y: place.y }, { u: ds.u, sA: ds.sA ?? undefined, lift: ds.lift, y: ds.y });
    this.previewPlace = { ...place };
    this.artPreview = { art: a.id, wall: w.id, s: place.s, y: place.y };
    return this.artPreview;
  }

  // Nothing unaccepted survives leaving the work: the drawn candidate goes, and the declared place with
  // it, so a later rebuild cannot resurrect a preview that was never accepted.
  clearArtPreview() {
    const p = this.artPreview;
    this.previewPlace = null;
    if (!p) return false;
    const group = this.root.children.find((c) => c.userData?.artPreview === p.art);
    if (group) { this.root.remove(group); group.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); }
    this.artPreview = null;
    return true;
  }

  buildObject(o) {
    const group = new THREE.Group();
    let pick;
    if (o.kind === 'sculpture') {
      const plinth = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.95, 0.9), this.mat.plinth);
      plinth.position.y = 0.475;
      plinth.castShadow = plinth.receiveShadow = true;
      const pts = [];
      for (let i = 0; i <= 20; i++) {
        const t = i / 20;
        pts.push(new THREE.Vector2(0.05 + 0.28 * Math.sin(Math.PI * t * 0.95) * (1 - 0.35 * t) + (t > 0.85 ? 0.06 : 0), t * 1.05));
      }
      const vase = new THREE.Mesh(new THREE.LatheGeometry(pts, 36), this.mat.vessel);
      vase.position.y = 0.95;
      vase.castShadow = true;
      vase.userData = { id: o.id, kind: 'object' };
      group.add(plinth, vase);
      pick = plinth;
    } else {
      const seat = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.12, 0.5), this.mat.oak);
      seat.position.y = 0.45;
      const leg1 = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.45, 0.45), this.mat.oak);
      leg1.position.set(-1, 0.22, 0);
      const leg2 = leg1.clone(); leg2.position.x = 1;
      [seat, leg1, leg2].forEach((m) => { m.castShadow = true; m.userData = { id: o.id, kind: 'object' }; });
      group.add(seat, leg1, leg2);
      pick = seat;
    }
    pick.userData = { id: o.id, kind: 'object' };
    group.position.set(o.x, 0, o.z);
    this.root.add(group);
    this.items.set(o.id, { kind: 'object', data: o, mesh: pick, lines: null, group });
  }

  refreshWall(id) {
    const w = byId(this.museum.walls, id);
    this.buildWall(w);
    for (const a of this.museum.art) if (a.wall === id) this.placeArt(a);
  }
  refreshCeiling(id) { this.buildCeiling(byId(this.museum.ceilings, id)); }
  refreshAll() {
    for (const w of this.museum.walls) this.refreshWall(w.id);
    for (const c of this.museum.ceilings) this.refreshCeiling(c.id);
    // Every refresh settles each artwork by its source: hung on the wall it names, or lying at the
    // locator when the fixture names none. Undo and Redo therefore move the body with the reference.
    for (const a of this.museum.art) { if (a.wall) this.placeArt(a); else this.layUnplaced(a); }
    this.restyle();
  }
  setMuseum(m) {
    this.museum = m;
    for (const it of this.items.values()) {
      if (it.kind === 'wall') it.data = byId(m.walls, it.data.id);
      if (it.kind === 'ceiling') it.data = byId(m.ceilings, it.data.id);
      if (it.kind === 'art') it.data = byId(m.art, it.data.id);
    }
    this.refreshAll();
  }

  restyle() {
    const camY = this.camera.position.y;
    // Three states flip discretely and cannot be interpolated (see-through ceilings here, the sun's
    // shadow at the end of render). Each is pinned to the page covering the mat rather than to a
    // progress value of its own, so the whole move has exactly one visible discontinuity, at the
    // moment the ground changes identity, instead of one at 0.5 and another at 0.6.
    const looking = this.cam.el > 0.25 && this.paper < 0.999;
    for (const [id, it] of this.items) {
      const ds = this.authoring===false ? {...this.d(id),hl:null} : this.d(id);
      const ghost = ds.mode === 'ghost';
      it.group.visible = ds.mode !== 'hidden';
      if (it.kind === 'wall') {
        // Surface and selection are independent: paper keeps the sheet (layout reading);
        // highlight still gets the ochre contour. Do not flood ochre over the grid.
        it.mesh.material = ghost ? this.mat.ghost : ds.sheet ? this.mat.sheet : ds.hl === 'sel' ? this.mat.foamSel : ds.hl === 'hover' ? this.mat.foamHover : this.mat.foam;
        it.lines.material = ghost ? this.mat.lineGhost : ds.hl ? this.mat.lineSel : this.mat.line;
        it.mesh.castShadow = !ghost;
      } else if (it.kind === 'ceiling') {
        const c = it.data;
        const above = looking && camY > planeY(c.plane, 0, 0) + ds.y + 0.5;
        const see = this.ceilingsSeeThrough && above && !ds.lifted && !ds.solid;
        if (ghost) { it.mesh.material = this.mat.ghost; it.lines.material = this.mat.lineGhost; }
        else if (ds.lifted) { it.mesh.material = ds.hl === 'sel' ? this.mat.foamSel : this.mat.ceilLift; it.lines.material = this.mat.lineSel; }
        else if (see) { it.mesh.material = ds.hl ? this.mat.foamHover : this.mat.ceilSee; it.lines.material = ds.hl ? this.mat.lineSel : this.mat.lineSee; }
        else {
          const base = c.rel === 'suspended' ? this.mat.ceilSusp : this.mat.ceil;
          it.mesh.material = ds.hl === 'sel' ? this.mat.foamSel : ds.hl ? this.mat.foamHover : base;
          it.lines.material = ds.hl ? this.mat.lineSel : this.mat.line;
        }
        it.mesh.castShadow = !ghost && !see;
        it.seeThrough = see;
      } else if (it.kind === 'floor') {
        it.mesh.material = ghost ? this.mat.ghost : this.mat.floor;
      } else {
        it.group.traverse((o) => {
          if (!o.isMesh) return;
          if (!o.userData.baseMat) o.userData.baseMat = o.material;
          o.material = ghost ? this.mat.ghost : o.userData.baseMat;
        });
        if (ds.hl && !ghost && it.kind === 'art') it.mesh.material = this.mat.frameSel;
        if (ds.hl && !ghost && it.kind === 'object') it.mesh.material = this.mat.foamSel;
      }
    }
  }

  // ----- clipping: every consumer of "what is in view" reads this one list -----
  setClips(planes) {
    this.clips = planes;
    // a fixed plane count keeps shader programs stable across every standpoint
    const padded = planes.slice(0, 4);
    while (padded.length < 4) padded.push(this.noClip);
    for (const m of Object.values(this.mat)) m.clippingPlanes = padded;
    for (const it of this.items.values()) if (it.canvasMat) it.canvasMat.clippingPlanes = padded;
  }
  inClips(p) {
    return this.clips.every((pl) => pl.distanceToPoint(p) >= -1e-3);
  }

  // ----- caps: ink where a cut passes through solid -----
  setCaps(group, mesh, lines) {
    this.clearGroup(group);
    if (mesh) {
      const m = new THREE.Mesh(mesh, this.unclipped.cap);
      m.renderOrder = 2;
      group.add(m);
    }
    if (lines) group.add(new THREE.LineSegments(lines, this.unclipped.capLine));
  }
  setHorizontalCaps(h) {
    if (h == null) { this.setCaps(this.capH, null, null); this.capHAt = null; return; }
    if (this.capHAt != null && Math.abs(this.capHAt - h) < 0.015 && !this.capsDirty) return;
    this.capHAt = h;
    const g = horizontalCaps(this.museum, h, (w) => this.sampler(w.id));
    this.setCaps(this.capH, g.mesh, g.lines);
  }
  setSectionCaps(quads) {
    const group = this.capV;
    this.clearGroup(group);
    if (!quads) return;
    // one mesh per source, so a click on cut poche resolves to the wall or slab it belongs to
    const bySrc = new Map();
    const lines = [];
    for (const q of quads) {
      if (!q.a) continue;
      if (!bySrc.has(q.owner)) bySrc.set(q.owner, []);
      bySrc.get(q.owner).push(...q.a, ...q.b, ...q.c, ...q.a, ...q.c, ...q.d);
      lines.push(...q.a, ...q.b, ...q.b, ...q.c, ...q.c, ...q.d, ...q.d, ...q.a);
    }
    for (const [owner, tri] of bySrc) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(tri, 3));
      const m = new THREE.Mesh(g, this.unclipped.cap);
      m.renderOrder = 2;
      m.userData = { id: owner, kind: 'cap' };
      group.add(m);
    }
    const lg = new THREE.BufferGeometry();
    lg.setAttribute('position', new THREE.Float32BufferAttribute(lines, 3));
    group.add(new THREE.LineSegments(lg, this.unclipped.capLine));
  }

  // ----- displaced copies: the half that parts away, and what lies beyond depth -----
  buildAway(key, keepPlane, { opacity = 0.1, lineOpacity = 0.35, linesOnly = false } = {}) {
    this.clearAway(key);
    const group = new THREE.Group();
    const ghostM = this.mat.ghost.clone();
    ghostM.opacity = opacity;
    const lineM = this.mat.lineGhost.clone();
    lineM.opacity = lineOpacity;
    ghostM.clippingPlanes = [keepPlane.clone()];
    lineM.clippingPlanes = [keepPlane.clone()];
    for (const it of this.items.values()) {
      const clone = it.group.clone(true);
      clone.traverse((o) => {
        o.userData = { ...o.userData, keepGeo: true, away: key };
        if (o.isMesh) { o.material = linesOnly ? ghostM : ghostM; o.castShadow = false; o.receiveShadow = false; if (linesOnly) o.visible = false; }
        if (o.isLineSegments) o.material = lineM;
      });
      clone.visible = it.group.visible;
      clone.userData.srcId = it.data.id;
      group.add(clone);
    }
    this.aways[key] = { group, base: keepPlane.clone(), mats: [ghostM, lineM], baseOpacity: [opacity, lineOpacity] };
    this.scene.add(group);
  }
  setAway(key, offset, fade = 1) {
    const a = this.aways[key];
    if (!a) return;
    a.group.position.copy(offset);
    const p = a.base.clone().translate(offset);
    for (const m of a.mats) m.clippingPlanes = [p];
    a.mats[0].opacity = a.baseOpacity[0] * fade;
    a.mats[1].opacity = a.baseOpacity[1] * fade;
  }
  revealIn(key, id, on) {
    const a = this.aways[key];
    if (!a) return;
    for (const c of a.group.children) {
      if (c.userData.srcId !== id) continue;
      c.traverse((o) => {
        if (o.isMesh) {
          if (on) { o.userData.prev = o.material; o.userData.prevVis = o.visible; o.material = this.unclipped.xray; o.visible = true; o.renderOrder = 10; }
          else if (o.userData.prev) { o.material = o.userData.prev; o.visible = o.userData.prevVis; o.renderOrder = 0; }
        }
        if (o.isLineSegments) {
          if (on) { o.userData.prevL = o.material; o.material = this.unclipped.revealLine; o.renderOrder = 11; }
          else if (o.userData.prevL) { o.material = o.userData.prevL; o.renderOrder = 0; }
        }
      });
    }
  }
  clearAway(key) {
    const a = this.aways[key];
    if (a) { this.scene.remove(a.group); delete this.aways[key]; }
  }

  // ----- camera -----
  resize() {
    const r = this.canvas.parentElement.getBoundingClientRect();
    // The device scale is re-read here, not only at construction: it changes with the window (a move to
    // another display, a browser zoom, an emulated device), and a drawing buffer left at the old ratio
    // is a canvas painted below the pixels it is drawn into. Capped at 2, as at construction.
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(r.width, r.height, false);
    this.w = r.width; this.h = r.height;
    this.camera.aspect = r.width / Math.max(1, r.height);
  }

  static placeCamera(camera, c, aspect) {
    const fov = fovFor(c.flat);
    const dist = c.frameH / (2 * Math.tan(THREE.MathUtils.degToRad(fov) / 2));
    camera.fov = fov;
    camera.aspect = aspect;
    const ce = Math.cos(c.el);
    camera.position.set(c.target.x + dist * ce * Math.sin(c.az), c.target.y + dist * Math.sin(c.el), c.target.z + dist * ce * Math.cos(c.az));
    if (c.el > 1.55) camera.up.set(-Math.sin(c.az), 0, -Math.cos(c.az));
    else if (c.el < -1.55) camera.up.set(Math.sin(c.az), 0, Math.cos(c.az));
    else camera.up.set(0, 1, 0);
    camera.lookAt(c.target);
    camera.near = Math.max(0.1, dist - 140);
    camera.far = dist + 260;
    camera.updateProjectionMatrix();
    if (c.mirror) {
      camera.projectionMatrix.elements[0] *= -1;
      camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
    }
    camera.updateMatrixWorld();
    return dist;
  }

  applyCamera() {
    // A display-scale change can leave the CSS box unchanged, so ResizeObserver need not fire.
    if (this.renderer.getPixelRatio() !== Math.min(window.devicePixelRatio, 2)) this.resize();
    this.dist = Stage.placeCamera(this.camera, this.cam, this.w / Math.max(1, this.h));
    this.scene.fog.near = this.dist + 40;
    this.scene.fog.far = this.dist + 200;
  }

  camState() {
    const c = this.cam;
    return { target: c.target.clone(), az: c.az, el: c.el, frameH: c.frameH, flat: c.flat, mirror: c.mirror };
  }

  lerpCam(a, b, t, tFlat = t) {
    const c = this.cam;
    c.target.lerpVectors(a.target, b.target, t);
    let daz = b.az - a.az;
    while (daz > Math.PI) daz -= Math.PI * 2;
    while (daz < -Math.PI) daz += Math.PI * 2;
    c.az = a.az + daz * t;
    c.el = a.el + (b.el - a.el) * t;
    c.frameH = Math.exp(lerp(Math.log(a.frameH), Math.log(b.frameH), t));
    c.flat = a.flat + (b.flat - a.flat) * tFlat;
  }

  // visible height that fits a box of half extents (hw, hh) in the current aspect
  fitFrame(hw, hh, margin = 1.18) {
    // the tool tray and the locator card take the paper's edges
    const aspect = Math.max(1, this.w - 110) / Math.max(1, this.h) || 1.6;
    return Math.max(hh * 2, (hw * 2) / aspect) * margin;
  }

  project(p) {
    const v = (p.isVector3 ? p.clone() : new V3(p[0], p[1], p[2])).project(this.camera);
    return { x: (v.x * 0.5 + 0.5) * this.w, y: (-v.y * 0.5 + 0.5) * this.h, behind: v.z > 1 || v.z < -1 };
  }

  // world units per screen pixel at the target distance
  worldPerPx() { return this.cam.frameH / Math.max(1, this.h); }

  ndc(clientX, clientY) {
    const r = this.canvas.getBoundingClientRect();
    return new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
  }

  pick(clientX, clientY, accept) {
    this.raycaster.setFromCamera(this.ndc(clientX, clientY), this.camera);
    const meshes = [];
    this.root.traverse((o) => {
      if (!o.isMesh || !o.userData.id) return;
      const ds = this.d(o.userData.id);
      if (ds.mode !== 'normal') return;
      if (accept && !accept(o.userData)) return;
      const it = this.items.get(o.userData.id);
      if (it?.seeThrough) return;
      meshes.push(o);
    });
    const hits = this.raycaster.intersectObjects(meshes, false).filter((h) => this.inClips(h.point));
    if (this.capV.visible) {
      const caps = this.capV.children.filter((o) => o.isMesh && (!accept || accept(o.userData)));
      hits.push(...this.raycaster.intersectObjects(caps, false));
      hits.sort((a, b) => a.distance - b.distance);
    }
    return hits[0] || null;
  }

  // What solid, drawn geometry stands between the eye and a point (null if nothing does).
  occluder(p, accept) {
    const eye = this.camera.position.clone();
    const dir = p.clone().sub(eye);
    const dist = dir.length();
    this.raycaster.set(eye, dir.normalize());
    const meshes = [];
    this.root.traverse((o) => {
      if (!o.isMesh || !o.userData.id || this.d(o.userData.id).mode !== 'normal') return;
      if (o.userData.kind === 'floor' || this.items.get(o.userData.id)?.seeThrough) return;
      if (accept && !accept(o.userData)) return;
      meshes.push(o);
    });
    const hit = this.raycaster.intersectObjects(meshes, false).find((h) => h.distance < dist - 0.25 && this.inClips(h.point));
    return hit ? hit.object.userData.id : null;
  }

  rayPlane(clientX, clientY, plane) {
    this.raycaster.setFromCamera(this.ndc(clientX, clientY), this.camera);
    const out = new V3();
    return this.raycaster.ray.intersectPlane(plane, out) ? out : null;
  }

  sampler(id) {
    const w = byId(this.museum.walls, id);
    const ds = this.d(id);
    return wallSampler(w, { u: ds.u, sA: ds.sA ?? undefined, lift: ds.lift, y: ds.y });
  }

  // ----- per-frame look -----
  // Drawn to scale, the mat becomes vellum: a 1, 2, 5 × 10ⁿ minor ladder anchored to the world
  // datum, its rung chosen from the projected CSS-pixel spacing at the working plane. Hysteresis
  // keeps the rung from flickering at a boundary; no timeline or delay is added to any view move.
  // The switch is ordered so no two surfaces are ever fighting for the same pixel, and the surface
  // itself moves on one continuous curve across the whole progress:
  //   page        the vellum crossfades up through the mat over the full 0 -> 1 of the paper value,
  //               and the backdrop/fog follow it, so the mat is never dark ground under a pale sky
  //   mat grid    gone by 0.5, the sheet it is ruled on is already half-covered
  //   paper grid  0.55 -> 0.85, drawn onto a page that is already there
  //   the mat     left visible until it is fully covered, instead of being cut at 0.999 in the last
  //               frame of the move, which was a visibility cliff
  // Every part is the same representation progress, so there is no new timeline and no delay.
  applyGrid(p) {
    const wpp = this.cam.frameH / Math.max(1, this.h || 0);
    let minor = GRID_LADDER[GRID_LADDER.length - 1];
    for (const v of GRID_LADDER) { if (v / wpp >= GRID_TARGET_PX) { minor = v; break; } }
    if (this._gridMinor) {
      const r = minor / this._gridMinor;
      if (r > 1 / 1.15 && r < 1.15) minor = this._gridMinor;
    }
    this._gridMinor = minor;
    // major lines are five times the chosen minor interval, so a tile holds two major bands
    const repeat = 1200 / (10 * minor);
    const fade = smoothstep(GRID_MIN_PX, GRID_TARGET_PX, minor / wpp);
    this.gridTex.repeat.set(repeat, repeat);
    const alpha = smoothstep(PAPER_GRID_IN, PAPER_GRID_FULL, p) * fade;
    this.grid.material.opacity = alpha;
    this.grid.visible = alpha > 0.004 && this.groundOn !== false;
    // The mat's grid keeps its fixed 1 m / 5 m rule rather than following the ladder: the mat is a
    // real object, its rule does not change with zoom, and a rung chosen mid-move would step the
    // mat's lines underfoot exactly while the view is turning. Only its opacity is animated here.
    const matRule = 1 - smoothstep(0, MAT_GRID_OUT, p);
    this.matGrid.material.opacity = matRule;
    this.matGrid.visible = matRule > 0.004 && this.groundOn !== false;
  }

  applyPaper() {
    // One curve for the surface: the paper value itself, as the plan means it. Nothing here
    // reshapes it — see main.js slewPaper for how fast it is allowed to move.
    const p = this.paper;
    const page = p;
    this.bg.copy(this.cMat).lerp(this.cPaper, page);
    this.scene.fog?.color.copy(this.bg);
    this.paperGround.material.opacity = page;
    this.paperGround.visible = page > 0.001 && this.groundOn !== false;
    this.applyGrid(p);
    this.ground.visible = page < 0.999 && this.groundOn !== false;
    // Context ghosts exist to keep the room readable while one wall is the subject in 3D. Once the
    // page is drawn they read as pale streaks across it, so they leave with the mat.
    this.mat.ghost.opacity = 0.07 * (1 - page);
    this.mat.lineGhost.opacity = 0.22 * (1 - page);
    this.hemi.intensity = lerp(1.35, 2.35, page);
    this.hemi.groundColor.set('#35574d').lerp(this.cUnder, page);
    this.sun.intensity = lerp(1.9, 0.75, page);
    this.mat.line.opacity = lerp(0.5, 0.78, page);
    this.mat.floor.color.set(COLORS.floor).lerp(new THREE.Color(COLORS.floorPaper), page);
  }

  renderInset(camState, rect, prep) {
    const r = this.renderer;
    Stage.placeCamera(this.peekCam, camState, rect.w / rect.h);
    const saved = { bg: this.scene.background, fog: this.scene.fog, g: this.ground.visible, mg: this.matGrid.visible, pg: this.paperGround.visible, gr: this.grid.visible, aw: Object.values(this.aways).map((a) => [a, a.group.visible]) };
    let undo = null;
    try {
      undo = prep?.();
      this.scene.background = new THREE.Color(COLORS.paper);
      this.scene.fog = null;
      this.ground.visible = false;
      this.matGrid.visible = false;
      this.paperGround.visible = false;
      this.grid.visible = false;
      for (const [a] of saved.aw) a.group.visible = false;
      const y = this.h - rect.y - rect.h;
      r.setScissorTest(true);
      r.setScissor(rect.x, y, rect.w, rect.h);
      r.setViewport(rect.x, y, rect.w, rect.h);
      r.render(this.scene, this.peekCam);
    } finally {
      r.setScissorTest(false);
      r.setViewport(0, 0, this.w, this.h);
      this.scene.background = saved.bg;
      this.scene.fog = saved.fog;
      undo?.();
      this.ground.visible = saved.g;
      this.matGrid.visible = saved.mg;
      this.paperGround.visible = saved.pg;
      this.grid.visible = saved.gr;
      for (const [a, v] of saved.aw) a.group.visible = v;
    }
  }

  render(inset) {
    this.applyCamera();
    this.applyPaper();
    this.sun.castShadow = this.paper < 0.999 && !this.shadowsOff;
    this.renderer.render(this.scene, this.camera);
    if (inset) this.renderInset(inset.cam, inset.rect, inset.prep);
  }
}
