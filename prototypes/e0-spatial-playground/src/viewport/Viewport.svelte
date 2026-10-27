<script lang="ts" module>
  export type Selection = { kind: 'piece'; id: string } | { kind: 'band' } | { kind: 'guide' } | null;
  export type Gesture =
    | { type: 'move-piece'; id: string; x: number; z: number }
    | { type: 'rotate-piece'; id: string; yaw: number }
    | { type: 'move-point'; id: string; x: number; z: number }
    | { type: 'band-width'; width: number }
    | { type: 'band-height'; height: number };
  export type ViewMode = '3d' | 'plan';
  export type PointerMode = 'select' | 'draw' | 'borrow' | 'pick-source';
  export interface CameraRequest {
    kind: 'fit' | 'entrance';
    n: number;
  }
</script>

<script lang="ts">
  import { onMount } from 'svelte';
  import * as THREE from 'three';
  import { FLOOR_HALF } from '../model/fixture';
  import { leftNormal } from '../model/geometry';
  import { sampleGuide, type Evaluation } from '../model/evaluate';
  import type { E0Document, Vec2 } from '../model/types';
  import {
    COLORS, bandMesh, disposeGroup, environment, floorPolygon, handle, labelSprite, outline, pieceColor, pieceMesh, ribbon,
  } from './scene';

  interface Props {
    doc: E0Document;
    ev: Evaluation;
    guideInvalid: boolean;
    view: ViewMode;
    cameraRequest: CameraRequest;
    selection: Selection;
    /** Highlight the guide and everything built from it. */
    scope: boolean;
    guideHandles: boolean;
    mode: PointerMode;
    drawPoints: Vec2[];
    borrowOrder: string[];
    epoch: number;
    onSelect: (sel: Selection) => void;
    onDrawPoint: (p: Vec2) => void;
    onBorrowPick: (id: string) => void;
    onPickGuide: () => void;
    onGesture: (g: Gesture, phase: 'preview' | 'commit', epoch: number) => void;
    onInsertPoint: (afterIndex: number, at: Vec2) => void;
  }

  let {
    doc, ev, guideInvalid, view, cameraRequest, selection, scope, guideHandles, mode, drawPoints, borrowOrder, epoch,
    onSelect, onDrawPoint, onBorrowPick, onPickGuide, onGesture, onInsertPoint,
  }: Props = $props();

  let host: HTMLDivElement;
  let renderer: THREE.WebGLRenderer;
  let scene: THREE.Scene;
  let persp: THREE.PerspectiveCamera;
  let ortho: THREE.OrthographicCamera;
  const envGroup = new THREE.Group();
  const modelGroup = new THREE.Group();
  const overlayGroup = new THREE.Group();
  const raycaster = new THREE.Raycaster();
  let cursor: Vec2 | null = $state(null);

  // Orbit state for the 3D view; plan state for the top view.
  const orbit = { target: new THREE.Vector3(0, 0.3, 0), radius: 9.5, azimuth: Math.PI, polar: 0.95 };
  const plan = { cx: 0, cz: 0, span: 8.5 };

  type Drag =
    | { kind: 'gesture'; gesture: (p: THREE.Vector3) => Gesture | null; plane: THREE.Plane; moved: boolean; epoch: number; startX: number; startY: number; last: Gesture | null }
    | { kind: 'orbit' | 'pan'; x: number; y: number; moved: boolean; clickSelectsNothing: boolean };
  let drag: Drag | null = null;

  const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const camera = () => (view === 'plan' ? ortho : persp);
  const r2 = (v: number) => Math.round(v * 100) / 100;

  function render() {
    if (renderer) renderer.render(scene, camera());
  }

  function applyCamera() {
    if (!renderer) return;
    const w = host.clientWidth;
    const h = host.clientHeight || 1;
    const { target, radius, azimuth, polar } = orbit;
    persp.aspect = w / h;
    persp.position.set(
      target.x + radius * Math.sin(polar) * Math.sin(azimuth),
      target.y + radius * Math.cos(polar),
      target.z + radius * Math.sin(polar) * Math.cos(azimuth),
    );
    persp.lookAt(target);
    persp.updateProjectionMatrix();
    const aspect = w / h;
    const halfH = aspect >= 1 ? plan.span / 2 : plan.span / 2 / aspect;
    ortho.left = -halfH * aspect;
    ortho.right = halfH * aspect;
    ortho.top = halfH;
    ortho.bottom = -halfH;
    ortho.position.set(plan.cx, 30, plan.cz);
    ortho.up.set(0, 0, -1);
    ortho.lookAt(plan.cx, 0, plan.cz);
    ortho.updateProjectionMatrix();
    render();
  }

  function fit() {
    orbit.target.set(0, 0.3, 0);
    orbit.radius = 9.5;
    orbit.polar = 0.95;
    orbit.azimuth = doc.entrance === 'south' ? Math.PI : Math.PI / 2;
    Object.assign(plan, { cx: 0, cz: 0, span: 8.5 });
    applyCamera();
  }

  function entranceView() {
    // Standing just outside the entrance at eye height, looking into the display.
    orbit.target.set(0, 0.55, 0);
    const back = FLOOR_HALF + 2.6;
    const eye = 1.6 - orbit.target.y;
    orbit.radius = Math.hypot(back, eye);
    orbit.polar = Math.atan2(back, eye);
    orbit.azimuth = doc.entrance === 'south' ? Math.PI : Math.PI / 2;
    applyCamera();
  }

  function rayAt(clientX: number, clientY: number) {
    const rect = host.getBoundingClientRect();
    const ndc = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera());
    return raycaster;
  }

  function planeHit(plane: THREE.Plane, clientX: number, clientY: number) {
    return rayAt(clientX, clientY).ray.intersectPlane(plane, new THREE.Vector3());
  }

  const PRIORITY: Record<string, number> = { 'guide-point': 0, 'band-width': 0, 'band-height': 0, yaw: 0, piece: 1, band: 2, guide: 3 };

  function pick(clientX: number, clientY: number) {
    const hits = rayAt(clientX, clientY).intersectObjects([...modelGroup.children, ...overlayGroup.children], true);
    let best: { data: Record<string, unknown>; point: THREE.Vector3 } | null = null;
    for (const hit of hits) {
      let o: THREE.Object3D | null = hit.object;
      while (o && !o.userData.kind) o = o.parent;
      if (!o) continue;
      const data = o.userData as Record<string, unknown>;
      if (!best || PRIORITY[data.kind as string] < PRIORITY[best.data.kind as string]) best = { data, point: hit.point };
    }
    return best;
  }

  function rebuild() {
    if (!scene) return;
    disposeGroup(envGroup);
    disposeGroup(modelGroup);
    disposeGroup(overlayGroup);
    envGroup.add(environment(doc.entrance));

    const guidePts: Vec2[] = doc.guide ? doc.guide.points.map((p) => [p.x, p.z]) : [];
    const following = new Set(ev.pieces.filter((p) => p.following).map((p) => p.id));

    // Band
    if (doc.band && ev.bandOutline) {
      const selected = selection?.kind === 'band';
      const mesh = bandMesh(ev.bandOutline, doc.band.height, COLORS.band);
      mesh.userData = { kind: 'band' };
      modelGroup.add(mesh);
      if (scope || selected) {
        const edge = new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry, 20), new THREE.LineBasicMaterial({ color: selected ? COLORS.select : COLORS.scope }));
        modelGroup.add(edge);
      }
    }

    // Pieces
    for (const piece of doc.pieces) {
      const evp = ev.pieces.find((p) => p.id === piece.id)!;
      const g = pieceMesh(piece, evp.pose, pieceColor(doc, piece.id), piece.main);
      g.userData = { kind: 'piece', id: piece.id };
      modelGroup.add(g);
      const selected = selection?.kind === 'piece' && selection.id === piece.id;
      if (selected || (scope && following.has(piece.id))) {
        overlayGroup.add(outline(evp.footprint, 0.012, selected ? COLORS.select : COLORS.scope));
        const ring = floorPolygon(evp.footprint.map(([x, z]) => [x + (x - evp.pose.x) * 0.25, z + (z - evp.pose.z) * 0.25] as Vec2), 0.0015,
          new THREE.MeshBasicMaterial({ color: selected ? COLORS.select : COLORS.scope, transparent: true, opacity: 0.22, depthWrite: false }));
        overlayGroup.add(ring);
      }
      if (mode === 'borrow') {
        const n = borrowOrder.indexOf(piece.id);
        const s = labelSprite(n >= 0 ? String(n + 1) : '·', n >= 0 ? '#1d8fd1' : '#9a9384', 0.32);
        s.position.set(evp.pose.x, piece.height + 0.35, evp.pose.z);
        overlayGroup.add(s);
      }
      if (selected && mode === 'select') {
        const reach = Math.max(piece.width, piece.depth) / 2 + 0.3;
        const front = new THREE.Vector3(evp.pose.x + Math.sin(evp.pose.yaw) * reach, 0.06, evp.pose.z + Math.cos(evp.pose.yaw) * reach);
        overlayGroup.add(handle(front, COLORS.select, { kind: 'yaw', id: piece.id }, 0.075));
        overlayGroup.add(outline([[evp.pose.x, evp.pose.z], [front.x, front.z]], 0.06, COLORS.select, false));
      }
    }

    // Slots left behind by detached members, so the scope of a guide edit stays visible.
    if (scope && doc.arrangement && ev.slots) {
      for (const m of doc.arrangement.members) {
        if (m.following) continue;
        const slot = ev.slots[m.slot];
        const piece = doc.pieces.find((p) => p.id === m.pieceId)!;
        const half = Math.max(piece.width, piece.depth) / 2;
        const ring: Vec2[] = Array.from({ length: 24 }, (_, i) => [slot.x + Math.cos((i / 24) * Math.PI * 2) * half, slot.z + Math.sin((i / 24) * Math.PI * 2) * half]);
        overlayGroup.add(outline(ring, 0.005, 0x9a9384));
      }
    }

    // Guide
    if (guidePts.length >= 2) {
      const active = scope || selection?.kind === 'guide';
      const color = guideInvalid ? COLORS.guideInvalid : active ? COLORS.guideActive : COLORS.guide;
      const visible = ribbon(guidePts, active ? 0.05 : 0.035, 0.008, new THREE.MeshBasicMaterial({ color, depthTest: false, transparent: true, opacity: 0.95 }));
      visible.renderOrder = 5;
      overlayGroup.add(visible);
      const hit = ribbon(guidePts, 0.22, 0.01, new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false }));
      hit.userData = { kind: 'guide' };
      overlayGroup.add(hit);
      // Direction cue: small dots at start, arrow at end.
      const [ex, ez] = guidePts[guidePts.length - 1];
      const [px, pz] = guidePts[guidePts.length - 2];
      const l = Math.hypot(ex - px, ez - pz) || 1;
      const t: Vec2 = [(ex - px) / l, (ez - pz) / l];
      const n = leftNormal(t);
      const tip: Vec2[] = [[ex + t[0] * 0.14, ez + t[1] * 0.14], [ex + n[0] * 0.07, ez + n[1] * 0.07], [ex - n[0] * 0.07, ez - n[1] * 0.07]];
      const arrow = floorPolygon(tip, 0.009, new THREE.MeshBasicMaterial({ color, depthTest: false, side: THREE.DoubleSide }));
      arrow.renderOrder = 5;
      overlayGroup.add(arrow);
      if (guideHandles) {
        doc.guide!.points.forEach((p, i) => {
          overlayGroup.add(handle(new THREE.Vector3(p.x, 0.03, p.z), color, { kind: 'guide-point', id: p.id, index: i }, 0.08));
        });
      }
    }

    // Band size handles
    if (selection?.kind === 'band' && doc.band && ev.bandOutline && doc.guide && mode === 'select') {
      const mid = sampleGuide(doc.guide.points, (ev.guideLength ?? 0) / 2);
      const n = leftNormal(mid.tangent);
      const h = doc.band.height;
      overlayGroup.add(handle(new THREE.Vector3(mid.at[0], h + 0.12, mid.at[1]), COLORS.select, { kind: 'band-height' }, 0.07));
      const w = doc.band.width / 2;
      overlayGroup.add(handle(new THREE.Vector3(mid.at[0] + n[0] * (w + 0.1), h, mid.at[1] + n[1] * (w + 0.1)), COLORS.select, { kind: 'band-width' }, 0.07));
    }

    // Guide drawing draft
    if (mode === 'draw' && drawPoints.length) {
      const pts = cursor ? [...drawPoints, cursor] : drawPoints;
      if (pts.length >= 2) {
        const line = ribbon(pts, 0.04, 0.01, new THREE.MeshBasicMaterial({ color: COLORS.guideActive, depthTest: false, transparent: true, opacity: 0.8 }));
        line.renderOrder = 6;
        overlayGroup.add(line);
      }
      drawPoints.forEach(([x, z], i) => {
        const s = labelSprite(String(i + 1), '#1d8fd1', 0.22);
        s.position.set(x, 0.18, z);
        overlayGroup.add(s);
      });
    }
    render();
  }

  // ---- pointer handling -------------------------------------------------------

  function startGesture(e: PointerEvent, plane: THREE.Plane, gesture: (p: THREE.Vector3) => Gesture | null) {
    drag = { kind: 'gesture', gesture, plane, moved: false, epoch, startX: e.clientX, startY: e.clientY, last: null };
  }

  function onPointerDown(e: PointerEvent) {
    host.setPointerCapture(e.pointerId);
    const panButton = e.button === 1 || e.button === 2 || e.shiftKey;
    const hit = e.button === 0 && !e.shiftKey ? pick(e.clientX, e.clientY) : null;
    const kind = hit?.data.kind as string | undefined;

    if (mode === 'select' && hit && kind) {
      if (kind === 'guide-point') {
        const id = hit.data.id as string;
        startGesture(e, floorPlane, (p) => ({ type: 'move-point', id, x: r2(p.x), z: r2(p.z) }));
        return;
      }
      if (kind === 'yaw') {
        const id = hit.data.id as string;
        const pose = ev.pieces.find((p) => p.id === id)!.pose;
        startGesture(e, floorPlane, (p) => {
          const yaw = Math.atan2(p.x - pose.x, p.z - pose.z);
          const deg = Math.round((yaw * 180) / Math.PI / (e.altKey ? 1 : 5)) * (e.altKey ? 1 : 5);
          return { type: 'rotate-piece', id, yaw: (deg * Math.PI) / 180 };
        });
        return;
      }
      if (kind === 'band-height') {
        const dir = new THREE.Vector3();
        camera().getWorldDirection(dir);
        dir.y = 0;
        if (dir.lengthSq() < 1e-6) return; // Height is not draggable from straight above; use the number field.
        const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(dir.normalize(), hit.point);
        startGesture(e, plane, (p) => ({ type: 'band-height', height: Math.max(0.02, r2(p.y - 0.12)) }));
        return;
      }
      if (kind === 'band-width' && doc.guide && doc.band) {
        const mid = sampleGuide(doc.guide.points, (ev.guideLength ?? 0) / 2);
        const n = leftNormal(mid.tangent);
        const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -doc.band.height);
        startGesture(e, plane, (p) => {
          const d = (p.x - mid.at[0]) * n[0] + (p.z - mid.at[1]) * n[1];
          return { type: 'band-width', width: Math.max(0.02, r2(2 * (Math.abs(d) - 0.1))) };
        });
        return;
      }
      if (kind === 'piece') {
        const id = hit.data.id as string;
        onSelect({ kind: 'piece', id });
        const pose = ev.pieces.find((p) => p.id === id)!.pose;
        const grab = planeHit(floorPlane, e.clientX, e.clientY);
        const dx = grab ? pose.x - grab.x : 0;
        const dz = grab ? pose.z - grab.z : 0;
        startGesture(e, floorPlane, (p) => ({ type: 'move-piece', id, x: r2(p.x + dx), z: r2(p.z + dz) }));
        return;
      }
      if (kind === 'band') {
        onSelect({ kind: 'band' });
        drag = { kind: view === 'plan' ? 'pan' : 'orbit', x: e.clientX, y: e.clientY, moved: false, clickSelectsNothing: false };
        return;
      }
      if (kind === 'guide') {
        onSelect({ kind: 'guide' });
        drag = { kind: view === 'plan' ? 'pan' : 'orbit', x: e.clientX, y: e.clientY, moved: false, clickSelectsNothing: false };
        return;
      }
    }
    if (mode === 'borrow' && kind === 'piece') {
      onBorrowPick(hit!.data.id as string);
      return;
    }
    if (mode === 'pick-source' && (kind === 'guide' || kind === 'band')) {
      onPickGuide();
      return;
    }
    drag = {
      kind: panButton || view === 'plan' ? 'pan' : 'orbit',
      x: e.clientX,
      y: e.clientY,
      moved: false,
      clickSelectsNothing: mode === 'select',
    };
  }

  function onPointerMove(e: PointerEvent) {
    if (mode === 'draw') {
      const p = planeHit(floorPlane, e.clientX, e.clientY);
      cursor = p ? [r2(p.x), r2(p.z)] : null;
      if (!drag) rebuild();
    }
    if (!drag) return;
    if (drag.kind === 'gesture') {
      if (drag.epoch !== epoch) {
        drag = null; // interrupted by Undo/Open/Reset/Escape/path switch
        return;
      }
      if (!drag.moved && Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) < 4) return;
      drag.moved = true;
      const p = planeHit(drag.plane, e.clientX, e.clientY);
      if (!p) return;
      const g = drag.gesture(p);
      if (g) {
        drag.last = g;
        onGesture(g, 'preview', drag.epoch);
      }
      return;
    }
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true;
    drag.x = e.clientX;
    drag.y = e.clientY;
    if (drag.kind === 'orbit' && view === '3d') {
      orbit.azimuth -= dx * 0.008;
      orbit.polar = Math.min(1.52, Math.max(0.12, orbit.polar - dy * 0.006));
    } else if (view === 'plan') {
      const k = plan.span / host.clientHeight;
      plan.cx -= dx * k;
      plan.cz -= dy * k;
    } else {
      const k = orbit.radius * 0.0016;
      const right = new THREE.Vector3(Math.cos(orbit.azimuth), 0, -Math.sin(orbit.azimuth));
      const fwd = new THREE.Vector3(Math.sin(orbit.azimuth), 0, Math.cos(orbit.azimuth));
      orbit.target.addScaledVector(right, -dx * k).addScaledVector(fwd, -dy * k);
    }
    applyCamera();
  }

  function onPointerUp(e: PointerEvent) {
    const d = drag;
    drag = null;
    if (host.hasPointerCapture(e.pointerId)) host.releasePointerCapture(e.pointerId);
    if (!d) return;
    if (d.kind === 'gesture') {
      if (d.moved && d.last && d.epoch === epoch) onGesture(d.last, 'commit', d.epoch);
      return;
    }
    if (d.moved) return;
    if (mode === 'draw' && e.button === 0) {
      const p = planeHit(floorPlane, e.clientX, e.clientY);
      if (p) onDrawPoint([r2(p.x), r2(p.z)]);
      return;
    }
    if (d.clickSelectsNothing) onSelect(null);
  }

  function onDoubleClick(e: MouseEvent) {
    if (mode !== 'select' || !guideHandles || !doc.guide) return;
    const hit = pick(e.clientX, e.clientY);
    if (hit?.data.kind !== 'guide') return;
    const pts = doc.guide.points;
    let best = { i: 0, d: Infinity, at: [0, 0] as Vec2 };
    for (let i = 0; i < pts.length - 1; i++) {
      const ax = pts[i].x, az = pts[i].z, bx = pts[i + 1].x, bz = pts[i + 1].z;
      const l2 = (bx - ax) ** 2 + (bz - az) ** 2;
      const t = Math.min(1, Math.max(0, ((hit.point.x - ax) * (bx - ax) + (hit.point.z - az) * (bz - az)) / l2));
      const at: Vec2 = [ax + (bx - ax) * t, az + (bz - az) * t];
      const dd = Math.hypot(at[0] - hit.point.x, at[1] - hit.point.z);
      if (dd < best.d) best = { i, d: dd, at: [r2(at[0]), r2(at[1])] };
    }
    onInsertPoint(best.i, best.at);
  }

  function onWheel(e: WheelEvent) {
    e.preventDefault();
    const f = Math.exp(e.deltaY * 0.0012);
    if (view === 'plan') plan.span = Math.min(30, Math.max(2, plan.span * f));
    else orbit.radius = Math.min(30, Math.max(1.5, orbit.radius * f));
    applyCamera();
  }

  onMount(() => {
    renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    host.appendChild(renderer.domElement);
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xe9e5d8);
    persp = new THREE.PerspectiveCamera(48, 1, 0.05, 200);
    ortho = new THREE.OrthographicCamera(-5, 5, 5, -5, 0.1, 100);
    scene.add(new THREE.HemisphereLight(0xffffff, 0xcfc6b0, 1.6));
    const sun = new THREE.DirectionalLight(0xffffff, 1.6);
    sun.position.set(-4, 9, -5);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6 });
    scene.add(sun, envGroup, modelGroup, overlayGroup);
    const ro = new ResizeObserver(() => {
      renderer.setSize(host.clientWidth, host.clientHeight);
      applyCamera();
    });
    ro.observe(host);
    fit();
    rebuild();
    window.__e0 = Object.assign((window.__e0 as object) ?? {}, {
      project: (x: number, y: number, z: number) => {
        const v = new THREE.Vector3(x, y, z).project(camera());
        const rect = host.getBoundingClientRect();
        return { x: rect.left + ((v.x + 1) / 2) * rect.width, y: rect.top + ((1 - v.y) / 2) * rect.height };
      },
    });
    return () => {
      ro.disconnect();
      disposeGroup(envGroup);
      disposeGroup(modelGroup);
      disposeGroup(overlayGroup);
      renderer.dispose();
    };
  });

  $effect(() => {
    // Track everything the scene depends on.
    void [doc, ev, guideInvalid, selection, scope, guideHandles, mode, drawPoints, borrowOrder];
    rebuild();
  });

  $effect(() => {
    void view;
    applyCamera();
  });

  $effect(() => {
    void epoch;
    drag = null;
  });

  let lastRequest = 0;
  $effect(() => {
    const req = cameraRequest;
    if (!renderer || req.n === lastRequest) return;
    lastRequest = req.n;
    if (req.kind === 'fit') fit();
    else entranceView();
  });
</script>

<div
  class="viewport"
  class:drawing={mode !== 'select'}
  bind:this={host}
  role="application"
  aria-label="Spatial viewport"
  onpointerdown={onPointerDown}
  onpointermove={onPointerMove}
  onpointerup={onPointerUp}
  onpointercancel={() => (drag = null)}
  ondblclick={onDoubleClick}
  onwheel={onWheel}
  oncontextmenu={(e) => e.preventDefault()}
></div>

<style>
  .viewport { position: absolute; inset: 0; touch-action: none; cursor: grab; }
  .viewport.drawing { cursor: crosshair; }
  .viewport :global(canvas) { display: block; }
</style>
