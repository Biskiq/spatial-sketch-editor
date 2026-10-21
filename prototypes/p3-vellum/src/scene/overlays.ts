// Things drawn over the model: handles, the pen's trail, knots, the sheet, pencil suggestions, labels.
import * as THREE from 'three';
import { Line2 } from 'three/examples/jsm/lines/Line2.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import { store } from '../store';
import type { Stage } from './stage';
import type { Handle } from './handles';
import { derive } from '../model/derive';
import { V2, fmtM, inPeople, polyCentroid, dist } from '../model/geom2d';
import { mats, BLUE, RED, PENCIL, INK } from './materials';
import { routeHeights } from '../story/route';
import type { Guide } from '../model/snap';
import { ohSection, ohHasSurface, sampleProfile } from '../model/overheadGeom';
import type { ZoneGeometry } from '../model/roofZones';

// Handles share their geometry and materials: a drag previews dozens of times a second and must not allocate.
const H_BLUE = new THREE.MeshBasicMaterial({ color: BLUE, depthTest: false, transparent: true });
const H_WHITE = new THREE.MeshBasicMaterial({ color: '#ffffff', depthTest: false, transparent: true });
const H_FRONT = { dot: new THREE.CircleGeometry(1, 20), ring: new THREE.RingGeometry(0.62, 1, 24), bead: new THREE.PlaneGeometry(1.5, 1.5), move: new THREE.CircleGeometry(1.25, 4) };
const H_BACK = { dot: new THREE.CircleGeometry(1.3, 20), ring: new THREE.CircleGeometry(1.15, 24), bead: new THREE.PlaneGeometry(1.9, 1.9), move: new THREE.CircleGeometry(1.6, 4) };
/** Detail handles appear when the pointer comes this close (px). */
export const REVEAL_PX = 56;

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
  /** why the pen or a handle snapped: dashed blue guide lines, and a few words at the point */
  guides: THREE.LineSegments;
  snapNote: { text: string; pos: THREE.Vector3 } | null = null;
  /** what the stroke will become, drawn under the pen while you draw */
  reading: Line2;
  readingMat: LineMaterial;
  /** the picked roof's profile, drawn on the roof at real scale (its points are the pad's points) */
  section: Line2;
  sectionMat: LineMaterial;
  zoneLines: LineSegments2;
  zoneMat: LineMaterial;
  zoneMarker: THREE.Group;
  private zoneLiftId: string | null = null;
  zoneTip: { text: string; pos: THREE.Vector3 } | null = null;
  pencilPosts: { mesh: THREE.Mesh; key: string; fix: number }[] = [];
  private lastVersion = -1;
  private sheetKey = '';
  private builtHandles: Handle[] | null = null;
  /** pointer over the canvas (canvas px), for revealing detail handles near it */
  pointer: [number, number] | null = null;

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
    this.guides = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineDashedMaterial({ color: BLUE, dashSize: 0.25, gapSize: 0.15, transparent: true, opacity: 0.9, depthTest: false }));
    this.guides.renderOrder = 22;
    this.guides.visible = false;
    this.group.add(this.guides);
    this.readingMat = new LineMaterial({ color: BLUE, linewidth: 1.6, worldUnits: false, transparent: true, opacity: 0.75, depthTest: false });
    this.reading = new Line2(new LineGeometry(), this.readingMat);
    this.reading.renderOrder = 21;
    this.reading.visible = false;
    this.group.add(this.reading);
    this.sectionMat = new LineMaterial({ color: BLUE, linewidth: 2, worldUnits: false, transparent: true, opacity: 0.85, depthTest: false });
    this.section = new Line2(new LineGeometry(), this.sectionMat);
    this.section.renderOrder = 23;
    this.section.visible = false;
    this.group.add(this.section);
    this.zoneMat = new LineMaterial({ color: BLUE, linewidth: 2, worldUnits: false, transparent: true, opacity: 0.95, depthTest: true });
    this.zoneLines = new LineSegments2(new LineSegmentsGeometry(), this.zoneMat);
    this.zoneLines.renderOrder = 22;
    this.zoneLines.visible = false;
    this.group.add(this.zoneLines);
    this.zoneMarker = new THREE.Group();
    const markerBack = new THREE.Mesh(new THREE.RingGeometry(0.72, 1.08, 24), new THREE.MeshBasicMaterial({ color: '#ffffff', depthTest: true, transparent: true }));
    const markerFront = new THREE.Mesh(new THREE.RingGeometry(0.72, 1, 24), new THREE.MeshBasicMaterial({ color: BLUE, depthTest: true, transparent: true }));
    markerBack.renderOrder = 30;
    markerFront.renderOrder = 31;
    this.zoneMarker.add(markerBack, markerFront);
    this.zoneMarker.visible = false;
    this.group.add(this.zoneMarker);
    stage.onFrame.push(() => this.frame());
  }

  /** A hovered Hold zone: its visible reach, one transient grab marker and a short card-like hint. */
  setZone(g: ZoneGeometry | null, tip?: string, at?: [number, number, number] | null, liftId?: string | null) {
    const positions: number[] = [];
    for (const line of g?.lines ?? []) for (let i = 0; i + 1 < line.length; i++) positions.push(...line[i], ...line[i + 1]);
    if (positions.length) {
      const geometry = new LineSegmentsGeometry();
      geometry.setPositions(positions);
      this.zoneLines.geometry.dispose();
      this.zoneLines.geometry = geometry;
      this.zoneLines.visible = true;
    } else this.zoneLines.visible = false;
    this.zoneMarker.visible = !!at;
    this.zoneTip = tip && at ? { text: tip, pos: new THREE.Vector3(at[0], at[1] + 0.12, at[2]) } : null;
    if (at) this.zoneMarker.position.set(at[0], at[1] + 0.05, at[2]);
    this.zoneLiftId = g ? liftId ?? null : null;
    this.zoneLines.position.y = this.zoneLiftId ? this.stage.liftOf(this.zoneLiftId) : 0;
  }

  setGuides(gs: Guide[] | null, y = 0, note?: { text: string; at: V2 } | null) {
    this.snapNote = note && note.text ? { text: note.text, pos: new THREE.Vector3(note.at[0], y + 0.5, note.at[1]) } : null;
    if (!gs || !gs.length) {
      this.guides.visible = false;
      return;
    }
    const g = new THREE.BufferGeometry().setFromPoints(gs.flatMap((s) => [new THREE.Vector3(s.a[0], y + 0.03, s.a[1]), new THREE.Vector3(s.b[0], y + 0.03, s.b[1])]));
    this.guides.geometry.dispose();
    this.guides.geometry = g;
    this.guides.computeLineDistances();
    this.guides.visible = true;
  }

  setReading(pts: THREE.Vector3[] | null) {
    if (!pts || pts.length < 2) {
      this.reading.visible = false;
      return;
    }
    const g = new LineGeometry();
    g.setPositions(pts.flatMap((p) => [p.x, p.y + 0.03, p.z]));
    this.reading.geometry.dispose();
    this.reading.geometry = g;
    this.reading.visible = true;
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
    this.readingMat.resolution.set(res.x, res.y);
    this.sectionMat.resolution.set(res.x, res.y);
    this.zoneMat.resolution.set(res.x, res.y);
    this.zoneLines.position.y = this.zoneLiftId ? st.liftOf(this.zoneLiftId) : 0;
    if (store.version !== this.lastVersion) {
      this.lastVersion = store.version;
      this.rebuild();
    }
    // constant-size handles; detail handles grow in near the pointer and shrink away from it
    for (const m of this.handleMeshes) {
      const d = st.camera.position.distanceTo(m.position);
      const k = d * st.mpp(m.position) / Math.max(d, 1e-3);
      const hov = m.userData.hid === this.hoverHandle || m.userData.hid === this.activeHandle;
      const shown = this.revealed(m.userData.handle as Handle) ? 1 : 0;
      m.userData.reveal = (m.userData.reveal ?? shown) + (shown - (m.userData.reveal ?? shown)) * 0.35;
      const s = (hov ? 9 : 6.5) * k * m.userData.reveal;
      m.visible = m.userData.reveal > 0.02;
      m.scale.setScalar(Math.max(s, 1e-4));
      if (m.userData.face) m.quaternion.copy(st.camera.quaternion);
    }
    const kk = st.mpp(this.knot.position) * 14;
    this.knot.scale.setScalar(Math.max(0.6, kk / 0.22));
    this.knot2.scale.copy(this.knot.scale);
    if (this.zoneMarker.visible) {
      const d = st.camera.position.distanceTo(this.zoneMarker.position);
      const k = d * st.mpp(this.zoneMarker.position) / Math.max(d, 1e-3);
      this.zoneMarker.quaternion.copy(st.camera.quaternion);
      this.zoneMarker.scale.setScalar(Math.max(0.6, 7.5 * k));
    }
    this.labelsPass();
  }

  /** The handle being dragged rides along with what it is shaping. */
  moveActive(pos: THREE.Vector3) {
    const m = this.handleMeshes.find((x) => x.userData.hid === this.activeHandle);
    if (m) m.position.copy(pos);
  }

  /** Primary handles always show; detail handles near the pointer, while held, or when every point is asked for. */
  revealed(h: Handle): boolean {
    if (!h || h.tier !== 'detail' || store.ui.allHandles) return true;
    if (h.id === this.activeHandle || h.id === this.hoverHandle) return true;
    if (this.activeHandle) return false;
    const p = this.pointer;
    if (!p) return false;
    const [sx, sy] = this.stage.screenOf(h.pos);
    return Math.hypot(sx - p[0], sy - p[1]) < REVEAL_PX;
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
    // handles (rebuilt only when the set changes, not on every preview frame of a drag)
    if (this.builtHandles !== this.handles) {
      this.builtHandles = this.handles;
      for (const m of this.handleMeshes) m.removeFromParent();
      this.handleMeshes = [];
      for (const h of this.handles) {
        const grp = new THREE.Group();
        const back = new THREE.Mesh(H_BACK[h.shape], H_WHITE);
        const front = new THREE.Mesh(H_FRONT[h.shape], H_BLUE);
        back.renderOrder = 30;
        front.renderOrder = 31;
        front.position.z = 0.01;
        grp.add(back, front);
        grp.position.copy(h.pos);
        grp.userData = { hid: h.id, face: true, handle: h };
        this.handleGroup.add(grp);
        this.handleMeshes.push(grp);
      }
    }
    // the picked roof's section — but only where there is a surface to show it on: a roof with no surface would draw
    // a ridge line across thin air, which is the one thing that state is not allowed to do
    const picked = store.ui.mode === 'make' ? p.overheads.find((o) => o.id === store.ui.selection) : undefined;
    const ohSel = picked && ohHasSurface(picked) ? picked : undefined;
    this.section.visible = !!ohSel;
    if (ohSel) {
      const sec = ohSection(ohSel);
      const lift = st.liftOf(ohSel.id);
      let sm = sampleProfile(ohSel.profile);
      if (sec.revolve) {
        const half = sm.filter((q) => q.u <= 0.5 + 1e-9);
        sm = [...half, ...half.slice().reverse().map((q) => ({ u: 1 - q.u, h: q.h }))];
      }
      const g = new LineGeometry();
      g.setPositions(sm.flatMap((q) => {
        const a = sec.at(q.u, q.h);
        return [a.plan[0], a.y + 0.04 + lift, a.plan[1]];
      }));
      this.section.geometry.dispose();
      this.section.geometry = g;
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
        const hidden = (v.sheetOut && r.floorY > st.sheetCut()) || (v.focusY !== null && r.floorY < v.focusY - 0.05);
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
    if (this.snapNote) L.put('snap', esc(this.snapNote.text), this.snapNote.pos, 'measure snap-note');
    if (this.zoneTip) L.put('zone-tip', esc(this.zoneTip.text), this.zoneTip.pos, 'handle-tip');
    for (const h of this.handles) if (h.label && (h.id === this.hoverHandle || h.id === this.activeHandle)) L.put(`hl:${h.id}`, esc(h.title), h.pos, 'handle-tip');
    L.end();
  }
}

export const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
