// The table, the model on it, and how it is seen. Everything here reads the project; nothing writes it.
import * as THREE from 'three';
import { store } from '../store';
import { derive, Derived, DRoom, elementName } from '../model/derive';
import type { Project } from '../model/types';
import { mats, MatSet, setCut, setSlice, PALETTES } from './materials';
import { CamCtl } from './controls';
import { Labels } from './labels';
import { Geo } from './build/geo';
import { buildWall } from './build/walls';
import { buildOverhead } from './build/overheads';
import { buildFloor, buildCeiling, buildTable, buildDeck, buildStair, buildPost, buildShaft, objGeometries, objPlacement, voidHolesAt, personGeometry } from './build/parts';
import { V2, dist, polyCentroid, pointInPoly, fmtM, inPeople } from '../model/geom2d';
import { ohUndersideAt } from '../model/overheadGeom';
import { runGeom } from '../model/runs';
import { lvl } from '../model/settle';
import { closestOnRun } from '../model/runs';

export interface Part {
  name: string;
  key: string;
  id: string;
  kind: 'wall' | 'floor' | 'ceiling' | 'roof' | 'deck' | 'stair' | 'post' | 'obj' | 'shaft' | 'import' | 'void';
  layer: number;
  group: THREE.Group;
  solids: THREE.Mesh[];
  edges: THREE.LineSegments[];
  ghosts: THREE.Object3D[];
  ghostMeshes: THREE.Mesh[];
}

export type HitKind = 'wall' | 'floor' | 'ceiling' | 'roof' | 'deck' | 'stair' | 'post' | 'obj' | 'ground' | 'import';
export interface Hit {
  kind: HitKind;
  id: string;
  point: THREE.Vector3; // in model coordinates (lift removed)
  normal: THREE.Vector3 | null;
  part?: Part;
}

export interface Presentation {
  lift: number;
  cutY: number | null;
  slice: { a: V2; b: V2 } | null;
  spotlight: string | null;
}

export class Stage {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera: THREE.PerspectiveCamera;
  ctl: CamCtl;
  root = new THREE.Group();
  overlay = new THREE.Group();
  table = new THREE.Group();
  figures = new THREE.Group();
  pencil = new THREE.Group();
  parts = new Map<string, Part>();
  labels: Labels;
  sun: THREE.DirectionalLight;
  hemi: THREE.HemisphereLight;
  el: HTMLElement;
  m: MatSet;
  lift = 0;
  presentation: Presentation | null = null;
  importObject: THREE.Object3D | null = null;
  private dirty = true;
  private lastShown: Project | null = null;
  private lastPalette = '';
  private clock = new THREE.Clock();
  private raycaster = new THREE.Raycaster();
  private tableKey = '';
  private personGeo = personGeometry();
  onFrame: ((dt: number) => void)[] = [];
  fps = 60;
  derived: Derived | null = null;

  constructor(el: HTMLElement) {
    this.el = el;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    this.renderer.localClippingEnabled = true;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.setClearColor('#ece6db');
    el.appendChild(this.renderer.domElement);
    this.renderer.domElement.className = 'stage-canvas';
    this.camera = new THREE.PerspectiveCamera(30, 1, 0.1, 800);
    this.ctl = new CamCtl(this.camera);
    this.labels = new Labels(el);
    this.m = mats('card');
    this.scene.fog = new THREE.Fog('#ece6db', 120, 360);
    this.hemi = new THREE.HemisphereLight('#f6f1e8', '#b8ab98', 1.15);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight('#fff3df', 2.1);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.03;
    this.sun.shadow.radius = 3;
    this.scene.add(this.sun, this.sun.target);
    this.scene.add(this.table, this.root, this.pencil, this.figures, this.overlay);
    store.cam = { snap: () => this.ctl.snap(), restore: (s) => this.ctl.restore(s) };
    store.subscribe(() => (this.dirty = true));
    const ro = new ResizeObserver(() => this.resize());
    ro.observe(el);
    this.resize();
    this.renderer.setAnimationLoop(() => this.frame());
  }

  resize() {
    const w = this.el.clientWidth, h = this.el.clientHeight;
    this.renderer.setSize(w, h, false);
    this.renderer.domElement.style.width = w + 'px';
    this.renderer.domElement.style.height = h + 'px';
    this.camera.aspect = w / Math.max(1, h);
    this.camera.updateProjectionMatrix();
  }

  // ------------------------------------------------------------------ sync model → meshes
  private makePart(name: string, key: string, id: string, kind: Part['kind'], layer: number): Part {
    const group = new THREE.Group();
    group.name = name;
    return { name, key, id, kind, layer, group, solids: [], edges: [], ghosts: [], ghostMeshes: [] };
  }

  private addSolid(part: Part, geo: THREE.BufferGeometry, mat: THREE.Material, opts: { edges?: boolean; shadow?: boolean; pick?: boolean; edgeAngle?: number } = {}) {
    if (!geo.getAttribute('position') || geo.getAttribute('position').count === 0) return;
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = opts.shadow !== false;
    // ceilings sit in the roof's shadow anyway; receiving it only adds acne
    mesh.receiveShadow = part.kind !== 'ceiling';
    mesh.userData = { id: part.id, kind: part.kind, part };
    part.group.add(mesh);
    if (opts.pick !== false) part.solids.push(mesh);
    const eg = opts.edges !== false ? new THREE.EdgesGeometry(geo, opts.edgeAngle ?? 28) : null;
    if (eg) {
      const lines = new THREE.LineSegments(eg, this.m.edge);
      lines.userData.baseMat = this.m.edge;
      part.group.add(lines);
      part.edges.push(lines);
    }
    // the ghost: what the cut or slice takes away stays as a faint pencil outline
    const gm = new THREE.Mesh(geo, this.m.ghost);
    gm.visible = false;
    gm.renderOrder = 2;
    part.group.add(gm);
    part.ghosts.push(gm);
    part.ghostMeshes.push(gm);
    if (eg) {
      const gl = new THREE.LineSegments(eg, this.m.ghostEdge);
      gl.computeLineDistances();
      gl.visible = false;
      gl.renderOrder = 3;
      part.group.add(gl);
      part.ghosts.push(gl);
    }
  }

  private addGlass(part: Part, geo: Geo, mat: THREE.Material = this.m.glass, edges = true) {
    if (geo.empty) return;
    const g = geo.geometry();
    const mesh = new THREE.Mesh(g, mat);
    mesh.renderOrder = 4;
    part.group.add(mesh);
    if (edges) {
      const l = new THREE.LineSegments(new THREE.EdgesGeometry(g, 28), this.m.edge);
      l.userData.baseMat = this.m.edge;
      part.group.add(l);
      part.edges.push(l);
    }
  }

  private addLines(part: Part, pts: number[], mat: THREE.LineBasicMaterial) {
    if (!pts.length) return;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    const l = new THREE.LineSegments(g, mat);
    l.userData.baseMat = mat;
    part.group.add(l);
    part.edges.push(l);
  }

  private disposePart(part: Part) {
    part.group.traverse((o: any) => {
      if (o.geometry && o.geometry !== this.personGeo) o.geometry.dispose?.();
    });
    part.group.removeFromParent();
  }

  private sync() {
    const p = store.shown;
    const d = derive(p);
    this.derived = d;
    this.m = mats(p.palette);
    if (this.lastPalette !== p.palette) {
      this.lastPalette = p.palette;
      this.renderer.setClearColor('#ece6db');
    }
    const want = new Map<string, { key: string; build: () => Part }>();
    const levels = [...new Set([...d.levels.filter((l) => l > 0.05), ...p.decks.map((x) => lvl(x.y))])].sort((a, b) => a - b);
    const layerOfY = (y: number) => {
      let k = 0;
      for (let i = 0; i < levels.length; i++) if (y >= levels[i] - 0.06) k = i + 1;
      return k;
    };
    const topLayer = levels.length + 1;

    // walls
    for (const w of d.walls.values()) {
      const r = w.run;
      const key = JSON.stringify([r.pts, r.bulge, r.center, r.radius, r.thick, r.closed, w.spans, w.extA, w.extB, w.openings.map((o) => [o.s0, o.s1, o.y0, o.y1, o.o.shape, o.o.rise, o.o.sill])]);
      want.set(`wall:${r.id}`, {
        key,
        build: () => {
          const part = this.makePart(`wall:${r.id}`, key, r.id, 'wall', layerOfY(r.baseY));
          const { solid, glass } = buildWall(w);
          this.addSolid(part, solid.geometry(), this.m.wall);
          this.addGlass(part, glass);
          return part;
        },
      });
    }
    // floors and ceilings
    for (const r of d.rooms) {
      const hs = voidHolesAt(p, r.floorY - 0.02).map((x) => x.join());
      const decksAt = p.decks.filter((dk) => Math.abs(dk.y - r.level) < 0.06).map((x) => x.outline.join());
      const key = JSON.stringify([r.poly, r.holes, r.floorY, r.level, hs, decksAt]);
      want.set(`floor:${r.id}`, {
        key,
        build: () => {
          const part = this.makePart(`floor:${r.id}`, key, r.id, 'floor', layerOfY(r.level));
          const g = buildFloor(p, d, r);
          if (g) this.addSolid(part, g.geometry(), r.floorY > r.level + 0.05 ? this.m.plinth : this.m.floor);
          return part;
        },
      });
      if (r.seed.ceiling === 'flat' && r.coveredBy) {
        const ck = JSON.stringify([r.poly, r.holes, r.topY, voidHolesAt(p, r.topY + 0.01).map((x) => x.join()), p.decks.map((x) => [x.y, x.outline.join()])]);
        want.set(`ceil:${r.id}`, {
          key: ck,
          build: () => {
            const part = this.makePart(`ceil:${r.id}`, ck, r.id, 'ceiling', topLayer);
            const g = buildCeiling(p, d, r);
            if (g) this.addSolid(part, g.geometry(), this.m.ceiling);
            return part;
          },
        });
      }
    }
    // overheads
    for (const oh of p.overheads) {
      const holes = p.voids.filter((v) => v.toY >= oh.baseY - 0.01).map((v) => v.outline);
      const key = JSON.stringify([oh.outline, oh.baseY, oh.profile, oh.dir, oh.form, oh.thick, holes]);
      want.set(`roof:${oh.id}`, {
        key,
        build: () => {
          const part = this.makePart(`roof:${oh.id}`, key, oh.id, 'roof', topLayer);
          const mesh = buildOverhead(oh, holes);
          this.addSolid(part, mesh.top.geometry(), this.m.roof);
          this.addSolid(part, mesh.under.geometry(), this.m.roofUnder, { edges: false });
          this.addGlass(part, mesh.glass);
          return part;
        },
      });
    }
    // decks
    for (const dk of p.decks) {
      const key = JSON.stringify([dk.outline, dk.y, dk.thick, voidHolesAt(p, dk.y - 0.01).map((x) => x.join()), [...d.walls.values()].map((w) => [w.run.id, w.maxTop, w.run.pts]), p.decks.map((x) => [x.y, x.outline.join()]), p.stairs.map((s) => [s.path[0], s.path[s.path.length - 1], s.fromY, s.toY]), d.rooms.map((r) => [r.floorY, r.poly.length])]);
      want.set(`deck:${dk.id}`, {
        key,
        build: () => {
          const part = this.makePart(`deck:${dk.id}`, key, dk.id, 'deck', layerOfY(dk.y));
          const b = buildDeck(p, d, dk);
          this.addSolid(part, b.slab.geometry(), this.m.deck);
          this.addGlass(part, b.rails, this.m.rail, false);
          this.addLines(part, b.railLines, this.m.edge);
          return part;
        },
      });
    }
    // stairs
    for (const st of p.stairs) {
      const key = JSON.stringify([st.path, st.fromY, st.toY, st.width, st.mode]);
      want.set(`stair:${st.id}`, {
        key,
        build: () => {
          const part = this.makePart(`stair:${st.id}`, key, st.id, 'stair', layerOfY(Math.min(st.fromY, st.toY)));
          const b = buildStair(st);
          this.addSolid(part, b.solid.geometry(), this.m.stair);
          this.addLines(part, b.lines, this.m.edge);
          return part;
        },
      });
    }
    // posts
    for (const q of p.posts) {
      const key = JSON.stringify([q.at, q.size, p.overheads.map((o) => [o.baseY, o.profile, o.outline.length]), p.decks.map((x) => [x.y, x.outline.join()]), d.rooms.map((r) => r.floorY)]);
      want.set(`post:${q.id}`, {
        key,
        build: () => {
          const part = this.makePart(`post:${q.id}`, key, q.id, 'post', 0);
          this.addSolid(part, buildPost(p, d, q).geometry(), this.m.post);
          return part;
        },
      });
    }
    // light shafts (an effect, labelled as such in "What's real?")
    for (const v of p.voids) {
      const s = buildShaft(p, v);
      if (!s) continue;
      const key = JSON.stringify([v.outline, v.fromY, v.toY, s.top]);
      want.set(`shaft:${v.id}`, {
        key,
        build: () => {
          const part = this.makePart(`shaft:${v.id}`, key, v.id, 'shaft', 0);
          const mat = this.m.shaft.clone();
          mat.uniforms.uTop.value = s.top;
          mat.uniforms.uBottom.value = s.bottom;
          const mesh = new THREE.Mesh(s.geo.geometry(), mat);
          mesh.renderOrder = 6;
          part.group.add(mesh);
          return part;
        },
      });
    }
    // things
    for (const o of p.objs) {
      const pl = objPlacement(p, d, o);
      const key = JSON.stringify([o.type, pl]);
      want.set(`obj:${o.id}`, {
        key,
        build: () => {
          const layer = o.on.kind === 'deck' ? layerOfY(pl.pos[1]) : o.on.kind === 'room' ? layerOfY(d.roomById.get(o.on.id)?.level ?? 0) : 0;
          const part = this.makePart(`obj:${o.id}`, key, o.id, 'obj', layer);
          const sub = new THREE.Group();
          for (const g of objGeometries(o.type)) {
            const holder = this.makePart('tmp', '', o.id, 'obj', 0);
            this.addSolid(holder, g.geo, (this.m as any)[g.mat], { edgeAngle: 40 });
            for (const c of [...holder.group.children]) sub.add(c);
            part.solids.push(...holder.solids);
            part.edges.push(...holder.edges);
            part.ghosts.push(...holder.ghosts);
            part.ghostMeshes.push(...holder.ghostMeshes);
          }
          for (const s of part.solids) s.userData.part = part;
          sub.position.set(pl.pos[0], pl.pos[1], pl.pos[2]);
          sub.rotation.y = pl.rot;
          part.group.add(sub);
          return part;
        },
      });
    }
    // reconcile
    for (const [name, part] of this.parts) {
      const w = want.get(name);
      if (!w || w.key !== part.key) {
        this.disposePart(part);
        this.parts.delete(name);
      }
    }
    for (const [name, w] of want) {
      if (this.parts.has(name)) continue;
      const part = w.build();
      part.key = w.key;
      this.parts.set(name, part);
      this.root.add(part.group);
    }
    // imported building
    if (this.importObject) {
      if (!this.importObject.parent) this.root.add(this.importObject);
    }
    this.syncTable(p, d);
    this.syncFigures(p, d);
    this.syncSun(d);
  }

  private syncTable(p: Project, d: Derived) {
    const sunk = d.rooms.filter((r) => r.level < 0.05 && r.floorY < -0.05).map((r) => [r.poly, r.floorY]);
    const b = d.bounds;
    const key = JSON.stringify([sunk, Math.round(b.min[0] / 4), Math.round(b.min[1] / 4), Math.round(b.max[0] / 4), Math.round(b.max[1] / 4), p.palette]);
    if (key === this.tableKey) return;
    this.tableKey = key;
    this.table.traverse((o: any) => o.geometry?.dispose?.());
    this.table.clear();
    const t = buildTable(p, d);
    const mat = new THREE.MeshStandardMaterial({ color: PALETTES[p.palette].table, roughness: 1, metalness: 0 });
    const board = new THREE.Mesh(t.board.geometry(), mat);
    board.receiveShadow = true;
    board.userData = { id: 'ground', kind: 'ground' };
    this.table.add(board);
    const grid = new THREE.LineSegments(t.grid, new THREE.LineBasicMaterial({ color: '#8b7f6c', transparent: true, opacity: 0.11, depthWrite: false }));
    this.table.add(grid);
  }

  private syncFigures(p: Project, d: Derived) {
    this.figures.clear();
    if (!store.ui.people || store.ui.mode === 'visit') return;
    const mat = new THREE.MeshBasicMaterial({ color: '#6f685f', transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false });
    for (const r of d.rooms) {
      if (r.area < 4) continue;
      const m = new THREE.Mesh(this.personGeo, mat);
      // a little off-centre so the figure does not stand on the room label
      const at = r.at;
      m.position.set(at[0] + 0.6, r.floorY + 0.01, at[1] + 0.4);
      m.rotation.y = this.ctl.cAz;
      m.userData.face = true;
      m.renderOrder = 5;
      this.figures.add(m);
    }
  }

  private syncSun(d: Derived) {
    const b = d.bounds;
    const cx = (b.min[0] + b.max[0]) / 2, cz = (b.min[1] + b.max[1]) / 2;
    const size = Math.max(b.max[0] - b.min[0], b.max[1] - b.min[1], 16) * 0.75 + 8;
    this.sun.position.set(cx - size * 0.8, size * 1.6 + b.top, cz + size * 0.55);
    this.sun.target.position.set(cx, 0, cz);
    const sc = this.sun.shadow.camera as THREE.OrthographicCamera;
    sc.left = -size * 1.4;
    sc.right = size * 1.4;
    sc.top = size * 1.4;
    sc.bottom = -size * 1.4;
    sc.near = 0.5;
    sc.far = size * 6 + b.top * 2;
    sc.updateProjectionMatrix();
  }

  /** Let light fall straight down (used by "light from above" reveals). */
  setNoon(on: boolean) {
    const d = this.derived;
    if (!d) return;
    if (on) {
      const b = d.bounds;
      const cx = (b.min[0] + b.max[0]) / 2, cz = (b.min[1] + b.max[1]) / 2;
      this.sun.position.set(cx + 2, 60, cz + 4);
    } else this.syncSun(d);
  }

  // ------------------------------------------------------------------ per frame
  private frame() {
    const dt = Math.min(0.05, this.clock.getDelta());
    this.fps = this.fps * 0.95 + (1 / Math.max(dt, 1e-3)) * 0.05;
    if (this.dirty) {
      this.dirty = false;
      this.sync();
    }
    for (const f of this.onFrame) f(dt);
    this.ctl.update(dt);
    // at eye height the model is seen from inside: lift the fill so rooms read as rooms, not caves
    const inside = this.ctl.mode === 'eye' || (!!this.ctl.external && this.camera.position.y < (this.derived?.bounds.top ?? 10));
    const k = 1 - Math.exp(-4 * dt);
    this.hemi.intensity += ((inside ? 2.1 : 1.15) - this.hemi.intensity) * k;
    this.renderer.toneMappingExposure += ((inside ? 1.3 : 1.05) - this.renderer.toneMappingExposure) * k;
    this.applyView(dt);
    for (const f of this.figures.children) f.rotation.y = this.ctl.cAz;
    this.labels.update(this.camera, this.el.clientWidth, this.el.clientHeight);
    this.renderer.render(this.scene, this.camera);
  }

  private applyView(dt: number) {
    const v = store.view;
    const pres = store.ui.mode === 'visit' ? this.presentation : null;
    const sel = store.ui.selection;
    const liftGoal = pres ? pres.lift : v.liftHeld || v.liftPinned ? 1 : 0;
    this.lift += (liftGoal - this.lift) * (1 - Math.exp(-7 * dt));
    if (Math.abs(this.lift - liftGoal) < 1e-3) this.lift = liftGoal;
    // cut
    let cutY: number | null = null;
    if (pres) cutY = pres.cutY;
    else if (v.sheetOut && store.ui.mode !== 'visit') cutY = v.sheetY + 1.3;
    setCut(cutY);
    const slice = pres ? pres.slice : v.slice;
    if (slice) {
      // keep the left side of the slice line (it was oriented so the camera stood on the side cut away)
      const { a, b } = slice;
      const n = new THREE.Vector3(-(b[1] - a[1]), 0, b[0] - a[0]).normalize();
      setSlice(n, -(n.x * a[0] + n.z * a[1]));
    } else setSlice(null);
    const clipping = cutY !== null || !!slice;
    const iso = pres ? null : v.isolate;
    const showGhost = clipping && (pres ? true : v.cutMode === 'ghost');
    const issues = store.ui.mode === 'make' ? (this.derived?.issues ?? []).filter((i) => !i.acknowledged) : [];
    const redIds = new Set(issues.flatMap((i) => i.ids));
    const removing = new Set(store.ui.removePreview ?? []);
    const lifted = this.lift;
    for (const part of this.parts.values()) {
      part.group.position.y = lifted * part.layer * 3.4;
      const isolated = iso && part.id !== iso && !(part.kind === 'floor' && iso === part.id);
      const hide = !!isolated;
      for (const s of part.group.children) {
        if (part.ghosts.includes(s)) continue;
        if ((s as any).isMesh || (s as any).isLineSegments || (s as any).isGroup) s.visible = !hide;
      }
      for (const g of part.ghosts) g.visible = hide || showGhost;
      for (const gm of part.ghostMeshes) gm.material = hide ? this.m.ghostAll : this.m.ghost;
      for (const g of part.ghosts) if ((g as any).isLineSegments) (g as any).material = hide ? this.m.ghostAllEdge : this.m.ghostEdge;
      // edge colour: blue for the selection, red pencil for what needs a look or would be affected
      const em = store.ui.mode !== 'make' ? this.m.edge : removing.has(part.id) || (removing.size && sel === part.id) ? this.m.redEdge : sel === part.id || (sel === 'building' && part.kind !== 'shaft') ? selEdge(this.m) : redIds.has(part.id) ? redSoft(this.m) : this.m.edge;
      for (const e of part.edges) e.material = em;
      if (part.kind === 'shaft') part.group.visible = !hide;
    }
    if (this.importObject) {
      this.importObject.position.y = 0;
    }
  }

  // ------------------------------------------------------------------ picking
  ndc(clientX: number, clientY: number): THREE.Vector2 {
    const r = this.renderer.domElement.getBoundingClientRect();
    return new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
  }

  ray(clientX: number, clientY: number) {
    this.raycaster.setFromCamera(this.ndc(clientX, clientY), this.camera);
    return this.raycaster.ray;
  }

  visibleAt(pt: THREE.Vector3): boolean {
    const v = store.view;
    if (v.sheetOut && pt.y > v.sheetY + 1.3 + 1e-3) return false;
    if (v.slice) {
      const { a, b } = v.slice;
      const n = new THREE.Vector3(-(b[1] - a[1]), 0, b[0] - a[0]).normalize();
      if (n.x * (pt.x - a[0]) + n.z * (pt.z - a[1]) < -1e-3) return false;
    }
    return true;
  }

  pick(clientX: number, clientY: number, opts: { kinds?: HitKind[]; ignore?: string[] } = {}): Hit | null {
    this.raycaster.setFromCamera(this.ndc(clientX, clientY), this.camera);
    const objs: THREE.Object3D[] = [];
    const iso = store.view.isolate;
    for (const part of this.parts.values()) {
      if (part.kind === 'shaft') continue;
      if (iso && part.id !== iso) continue;
      if (opts.ignore?.includes(part.id)) continue;
      objs.push(...part.solids);
    }
    if (this.importObject) this.importObject.traverse((o) => (o as any).isMesh && !o.userData.underlay && objs.push(o));
    for (const c of this.table.children) if ((c as any).isMesh) objs.push(c);
    const hits = this.raycaster.intersectObjects(objs, false);
    for (const h of hits) {
      const ud = h.object.userData;
      const part: Part | undefined = ud.part;
      const liftY = part ? part.group.position.y : 0;
      const pt = h.point.clone();
      pt.y -= liftY;
      if (!this.visibleAt(pt)) continue;
      let kind: HitKind = ud.kind ?? 'import';
      if (h.object.userData.isImport) kind = 'import';
      if (opts.kinds && !opts.kinds.includes(kind)) continue;
      const n = h.face ? h.face.normal.clone().transformDirection(h.object.matrixWorld) : null;
      return { kind, id: ud.id ?? 'import', point: pt, normal: n, part };
    }
    return null;
  }

  /** Where the pointer meets a horizontal plane at height y. */
  planAt(clientX: number, clientY: number, y: number): V2 | null {
    const ray = this.ray(clientX, clientY);
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -y);
    const out = new THREE.Vector3();
    if (!ray.intersectPlane(plane, out)) return null;
    return [out.x, out.z];
  }

  /** Metres per screen pixel at a world point (for zoom-aware tolerances). */
  mpp(at?: THREE.Vector3): number {
    const p = at ?? this.ctl.cTarget;
    const d = this.camera.position.distanceTo(p);
    const h = 2 * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) * d;
    return h / Math.max(1, this.el.clientHeight);
  }

  screenOf(p: THREE.Vector3): [number, number] {
    const v = p.clone().project(this.camera);
    return [(v.x * 0.5 + 0.5) * this.el.clientWidth, (-v.y * 0.5 + 0.5) * this.el.clientHeight];
  }

  partsOf(id: string) {
    return [...this.parts.values()].filter((p) => p.id === id);
  }

  liftOf(id: string) {
    const p = this.partsOf(id)[0];
    return p ? p.group.position.y : 0;
  }
}

let _sel: THREE.LineBasicMaterial | null = null;
function selEdge(m: MatSet) {
  if (!_sel) _sel = new THREE.LineBasicMaterial({ color: '#2f4bd8', transparent: true, opacity: 0.95, clippingPlanes: m.edge.clippingPlanes ?? undefined });
  return _sel;
}
let _red: THREE.LineBasicMaterial | null = null;
function redSoft(m: MatSet) {
  if (!_red) _red = new THREE.LineBasicMaterial({ color: '#d9472b', transparent: true, opacity: 0.85, clippingPlanes: m.edge.clippingPlanes ?? undefined });
  return _red;
}
