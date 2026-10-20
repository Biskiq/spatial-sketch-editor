// Things drawn over the model: handles, the pen's trail, knots, the sheet, pencil suggestions, labels.
import * as THREE from 'three';
import { Line2 } from 'three/examples/jsm/lines/Line2.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js';
import { store } from '../store';
import type { Stage } from './stage';
import type { Handle } from './handles';
import { derive } from '../model/derive';
import { V2, fmtM, inPeople, polyCentroid, dist } from '../model/geom2d';
import { mats, BLUE, RED, PENCIL, INK } from './materials';
import { routeHeights } from '../story/route';

export class Overlays {
  stage: Stage;
  group = new THREE.Group();
  handleGroup = new THREE.Group();
  pencilGroup = new THREE.Group();
  handles: Handle[] = [];
  handleMeshes: THREE.Object3D[] = [];
  hoverHandle: string | null = null;
  activeHandle: string | null = null;
  trail: Line2;
  trailMat: LineMaterial;
  trailPts: THREE.Vector3[] = [];
  knot: THREE.Mesh;
  knot2: THREE.Mesh;
  sheet: THREE.Group;
  sheetPlane: THREE.Mesh;
  sheetEdge: THREE.LineSegments;
  route: Line2;
  routeMat: LineMaterial;
  slice: THREE.Line;
  measure: { text: string; pos: THREE.Vector3 } | null = null;
  pencilPosts: { mesh: THREE.Mesh; key: string; fix: number }[] = [];
  private lastVersion = -1;
  private sheetKey = '';

  constructor(stage: Stage) {
    this.stage = stage;
    stage.overlay.add(this.group, this.handleGroup, this.pencilGroup);
    this.trailMat = new LineMaterial({ color: INK, linewidth: 2.6, worldUnits: false, transparent: true, opacity: 0.9, depthTest: false });
    this.trail = new Line2(new LineGeometry(), this.trailMat);
    this.trail.renderOrder = 20;
    this.trail.visible = false;
    this.group.add(this.trail);
    const knotGeo = new THREE.TorusGeometry(0.22, 0.045, 8, 32);
    knotGeo.rotateX(Math.PI / 2);
    this.knot = new THREE.Mesh(knotGeo, new THREE.MeshBasicMaterial({ color: BLUE, depthTest: false, transparent: true }));
    this.knot.renderOrder = 21;
    this.knot.visible = false;
    this.knot2 = this.knot.clone();
    this.knot2.material = new THREE.MeshBasicMaterial({ color: PENCIL, depthTest: false, transparent: true, opacity: 0.8 });
    this.group.add(this.knot, this.knot2);
    // the sheet of vellum
    this.sheet = new THREE.Group();
    this.sheetPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: '#fbf8f1', transparent: true, opacity: 0.38, depthWrite: false, side: THREE.DoubleSide }),
    );
    this.sheetPlane.renderOrder = 8;
    this.sheetEdge = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: '#9a8f7e', transparent: true, opacity: 0.5, depthWrite: false }));
    this.sheet.add(this.sheetPlane, this.sheetEdge);
    this.sheet.visible = false;
    this.group.add(this.sheet);
    this.routeMat = new LineMaterial({ color: BLUE, linewidth: 3, worldUnits: false, transparent: true, opacity: 0.85, dashed: false, depthTest: false });
    this.route = new Line2(new LineGeometry(), this.routeMat);
    this.route.renderOrder = 19;
    this.route.visible = false;
    this.group.add(this.route);
    this.slice = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: RED, depthTest: false }));
    this.slice.visible = false;
    this.group.add(this.slice);
    stage.onFrame.push(() => this.frame());
  }

  setTrail(pts: THREE.Vector3[] | null, color = INK) {
    if (!pts || pts.length < 2) {
      this.trail.visible = false;
      return;
    }
    const g = new LineGeometry();
    g.setPositions(pts.flatMap((p) => [p.x, p.y + 0.02, p.z]));
    this.trail.geometry.dispose();
    this.trail.geometry = g;
    this.trail.computeLineDistances();
    this.trailMat.color.set(color);
    this.trail.visible = true;
  }

  setKnot(at: [number, number, number] | null, tied = true, second?: [number, number, number] | null) {
    this.knot.visible = !!at;
    if (at) this.knot.position.set(at[0], at[1] + 0.03, at[2]);
    this.knot2.visible = !!second;
    if (second) this.knot2.position.set(second[0], second[1] + 0.03, second[2]);
  }

  private frame() {
    const st = this.stage;
    const res = st.renderer.getSize(new THREE.Vector2());
    this.trailMat.resolution.set(res.x, res.y);
    this.routeMat.resolution.set(res.x, res.y);
    if (store.version !== this.lastVersion) {
      this.lastVersion = store.version;
      this.rebuild();
    }
    // constant-size handles
    for (const m of this.handleMeshes) {
      const d = st.camera.position.distanceTo(m.position);
      const k = d * st.mpp(m.position) / Math.max(d, 1e-3);
      const hov = m.userData.hid === this.hoverHandle || m.userData.hid === this.activeHandle;
      const s = (hov ? 9 : 6.5) * k;
      m.scale.setScalar(s);
      if (m.userData.face) m.quaternion.copy(st.camera.quaternion);
    }
    const kk = st.mpp(this.knot.position) * 14;
    this.knot.scale.setScalar(Math.max(0.6, kk / 0.22));
    this.knot2.scale.copy(this.knot.scale);
    this.labelsPass();
  }

  rebuild() {
    const st = this.stage;
    const p = store.shown;
    const d = derive(p);
    // sheet
    const v = store.view;
    this.sheet.visible = v.sheetOut && store.ui.mode !== 'visit';
    if (this.sheet.visible) {
      const b = d.bounds;
      const pad = 4;
      const w = b.max[0] - b.min[0] + pad * 2, h = b.max[1] - b.min[1] + pad * 2;
      const cx = (b.min[0] + b.max[0]) / 2, cz = (b.min[1] + b.max[1]) / 2;
      this.sheetPlane.scale.set(Math.max(w, 16), 1, Math.max(h, 16));
      this.sheet.position.set(cx, v.sheetY + 0.005, cz);
      const key = `${Math.max(w, 16)}|${Math.max(h, 16)}`;
      if (key !== this.sheetKey) {
        this.sheetKey = key;
        const W = Math.max(w, 16) / 2, H = Math.max(h, 16) / 2;
        const pts: number[] = [-W, 0, -H, W, 0, -H, W, 0, -H, W, 0, H, W, 0, H, -W, 0, H, -W, 0, H, -W, 0, -H];
        for (let x = Math.ceil(-W); x <= W; x += 1) pts.push(x, 0, -H, x, 0, H);
        for (let z = Math.ceil(-H); z <= H; z += 1) pts.push(-W, 0, z, W, 0, z);
        this.sheetEdge.geometry.dispose();
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
        this.sheetEdge.geometry = g;
        (this.sheetEdge.material as THREE.LineBasicMaterial).opacity = 0.22;
      }
    }
    // handles
    for (const m of this.handleMeshes) m.removeFromParent();
    this.handleMeshes = [];
    const blue = new THREE.MeshBasicMaterial({ color: BLUE, depthTest: false, transparent: true });
    const white = new THREE.MeshBasicMaterial({ color: '#ffffff', depthTest: false, transparent: true });
    const dotG = new THREE.CircleGeometry(1, 20);
    const ringG = new THREE.RingGeometry(0.62, 1, 24);
    const beadG = new THREE.PlaneGeometry(1.5, 1.5);
    const moveG = new THREE.CircleGeometry(1.25, 4);
    for (const h of this.handles) {
      const grp = new THREE.Group();
      const back = new THREE.Mesh(h.shape === 'ring' ? new THREE.CircleGeometry(1.15, 24) : h.shape === 'bead' ? new THREE.PlaneGeometry(1.9, 1.9) : h.shape === 'move' ? new THREE.CircleGeometry(1.6, 4) : new THREE.CircleGeometry(1.3, 20), white);
      const front = new THREE.Mesh(h.shape === 'ring' ? ringG : h.shape === 'bead' ? beadG : h.shape === 'move' ? moveG : dotG, blue);
      back.renderOrder = 30;
      front.renderOrder = 31;
      front.position.z = 0.01;
      grp.add(back, front);
      grp.position.copy(h.pos);
      grp.userData = { hid: h.id, face: true };
      this.handleGroup.add(grp);
      this.handleMeshes.push(grp);
    }
    // pencil suggestions: posts proposed for loose ends (nothing becomes ink until accepted)
    for (const pp of this.pencilPosts) {
      pp.mesh.geometry.dispose();
      pp.mesh.removeFromParent();
    }
    this.pencilPosts = [];
    this.pencilGroup.clear();
    if (store.ui.mode === 'make') {
      const m = mats(p.palette);
      for (const iss of d.issues) {
        if (iss.acknowledged) continue;
        iss.fixes.forEach((fx, fi) => {
          if (!fx.pencilPosts) return;
          for (const pp of fx.pencilPosts) {
            const h = Math.max(0.3, pp.y1 - pp.y0);
            const g = new THREE.BoxGeometry(0.24, h, 0.24);
            const mesh = new THREE.Mesh(g, m.pencil);
            mesh.position.set(pp.at[0], pp.y0 + h / 2, pp.at[1]);
            mesh.renderOrder = 7;
            const e = new THREE.LineSegments(new THREE.EdgesGeometry(g), m.pencilEdge);
            e.computeLineDistances();
            mesh.add(e);
            mesh.userData = { pencilFix: { key: iss.key, fix: fi } };
            this.pencilGroup.add(mesh);
            this.pencilPosts.push({ mesh, key: iss.key, fix: fi });
          }
        });
      }
    }
    // the visitor's walk
    const route = p.story.route;
    if (store.ui.mode !== 'make' && route.length > 1) {
      const hs = routeHeights(p, route, p.story.routeStartY);
      const g = new LineGeometry();
      g.setPositions(route.flatMap((q, i) => [q[0], hs[i] + 0.08, q[1]]));
      this.route.geometry.dispose();
      this.route.geometry = g;
      this.route.visible = store.ui.mode === 'tell';
    } else this.route.visible = false;
    // slice line
    const sl = v.slice;
    this.slice.visible = !!sl && store.ui.mode === 'make';
    if (sl) {
      const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(sl.a[0], 0.03, sl.a[1]), new THREE.Vector3(sl.b[0], 0.03, sl.b[1])]);
      this.slice.geometry.dispose();
      this.slice.geometry = g;
    }
  }

  labelsPass() {
    const st = this.stage;
    const L = st.labels;
    L.begin();
    const p = store.shown;
    const d = derive(p);
    const mode = store.ui.mode;
    if (mode !== 'visit') {
      const v = store.view;
      for (const r of d.rooms) {
        const hidden = v.sheetOut && r.floorY > v.sheetY + 1.3;
        if (hidden && mode === 'make') continue;
        const pencil = r.seed.inheritedFrom ? ` <span class="pencil-tag" title="Borrowed from the room it was divided from — change it or confirm it to make it this room's own">borrowed ${r.seed.height.toFixed(1)} m</span>` : '';
        const lift = st.liftOf(r.id);
        L.put(`room:${r.id}`, `<span class="rn">${esc(r.name)}</span>${pencil}`, [r.at[0], r.floorY + 0.03 + lift, r.at[1]], 'room-label' + (store.ui.selection === r.id ? ' sel' : ''));
      }
      if (mode === 'make') {
        let n = 0;
        for (const iss of d.issues) {
          n++;
          if (iss.acknowledged) continue;
          L.put(`iss:${iss.key}`, `<span>!</span>`, iss.at, 'issue-pin' + (store.ui.issueFocus === iss.key ? ' focus' : ''), () => {
            store.set({ panel: 'issues', issueFocus: iss.key });
          });
        }
      }
      if (mode === 'tell') {
        const route = p.story.route;
        if (route.length > 1) {
          const hs = routeHeights(p, route, p.story.routeStartY);
          const acc = [0];
          for (let i = 1; i < route.length; i++) acc.push(acc[i - 1] + dist(route[i - 1], route[i]));
          const Lr = acc[acc.length - 1];
          p.story.moments.forEach((m, mi) => {
            const s = m.t * Lr;
            let i = acc.findIndex((x) => x >= s);
            if (i <= 0) i = 1;
            const k = (s - acc[i - 1]) / Math.max(acc[i] - acc[i - 1], 1e-6);
            const q: V2 = [route[i - 1][0] + (route[i][0] - route[i - 1][0]) * k, route[i - 1][1] + (route[i][1] - route[i - 1][1]) * k];
            const y = hs[i - 1] + (hs[i] - hs[i - 1]) * k;
            L.put(`mo:${m.id}`, `<b>${mi + 1}</b>`, [q[0], y + 0.4, q[1]], 'moment-pin' + (store.ui.momentFocus === m.id ? ' focus' : ''), () => store.set({ momentFocus: m.id, panel: 'story' }));
          });
          L.put('route-start', 'start', [route[0][0], hs[0] + 0.5, route[0][1]], 'route-tag');
        }
      }
    }
    if (this.measure) L.put('measure', esc(this.measure.text), this.measure.pos, 'measure');
    for (const h of this.handles) if (h.label && (h.id === this.hoverHandle || h.id === this.activeHandle)) L.put(`hl:${h.id}`, esc(h.title), h.pos, 'handle-tip');
    L.end();
  }
}

export const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
