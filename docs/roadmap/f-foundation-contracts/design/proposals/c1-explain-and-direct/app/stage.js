// Three.js stage: the bay, two PX-2 instances, ghosts, selection brackets and
// picking. The stage renders whatever channel values and pose it is given; it
// owns no timing, no camera math and no authored state.

import * as THREE from 'three';
import { BAY, PX2 } from './fixture.js';
import { ASPECT, projectedFov } from './camera.js';

const C = {
  bg: 0xebe6dc, ground: 0xe2dccf, floor: 0xcfc8bb, wall: 0xe8e3d9, wallEdge: 0xd3cdc1, roof: 0xd9d3c7, poche: 0x2b3035,
  paint: 0x4d6a5b, paintDark: 0x3f574b, skid: 0x3a3f43, guard: 0xc6a24a, bronze: 0xb88a4a, dark: 0x1f2426,
  pipe: 0x8f989c, pipeDark: 0x6f787c, valve: 0x2f3438, panel: 0xcdc8bd, mark: 0xd4b24e,
  sel: 0x2f8cff, hover: 0x7db4ff, session: 0x56707c, authored: 0x7a4a86, ghost: 0x145da8,
};

export function createStage(canvas, thumbCanvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(C.bg);
  const camera = new THREE.PerspectiveCamera(50, ASPECT, 0.05, 200);

  scene.add(new THREE.HemisphereLight(0xfbf7ef, 0x9f978a, 1.55));
  const sun = new THREE.DirectionalLight(0xfff2dc, 2.1);
  sun.position.set(4.5, 9, 5.5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -6.5, right: 6.5, top: 6.5, bottom: -6.5, near: 1, far: 30 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0xe4edf4, 0.55);
  fill.position.set(-6, 4, -2);
  scene.add(fill);

  const std = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.78, metalness: 0.05, ...extra });
  const M = {
    ground: std(C.ground, { roughness: 1 }),
    wall: std(C.wall, { roughness: 0.92 }),
    roof: std(C.roof, { roughness: 0.95, transparent: true, opacity: 1 }),
    poche: std(C.poche, { roughness: 1 }),
    paint: std(C.paint, { roughness: 0.55, metalness: 0.15 }),
    paintDark: std(C.paintDark, { roughness: 0.6, metalness: 0.15 }),
    skid: std(C.skid, { roughness: 0.7, metalness: 0.3 }),
    guard: std(C.guard, { roughness: 0.6 }),
    bronze: std(C.bronze, { roughness: 0.32, metalness: 0.65 }),
    dark: std(C.dark, { roughness: 1, side: THREE.DoubleSide }),
    pipe: std(C.pipe, { roughness: 0.45, metalness: 0.45 }),
    pipeDark: std(C.pipeDark, { roughness: 0.5, metalness: 0.4 }),
    valve: std(C.valve, { roughness: 0.5, metalness: 0.3 }),
    panel: std(C.panel, { roughness: 0.7 }),
    mark: std(C.mark, { roughness: 0.9 }),
  };

  // ---- ground + floor ----
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), M.ground);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.012;
  ground.receiveShadow = true;
  scene.add(ground);

  const tile = document.createElement('canvas');
  tile.width = tile.height = 256;
  const tg = tile.getContext('2d');
  tg.fillStyle = '#cfc8bb'; tg.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 900; i++) { tg.fillStyle = `rgba(80,70,55,${Math.random() * 0.05})`; tg.fillRect(Math.random() * 256, Math.random() * 256, 2, 2); }
  tg.strokeStyle = 'rgba(70,64,54,.18)'; tg.lineWidth = 2; tg.strokeRect(0, 0, 256, 256);
  tg.strokeStyle = 'rgba(70,64,54,.07)'; tg.lineWidth = 1; tg.beginPath(); tg.moveTo(128, 0); tg.lineTo(128, 256); tg.moveTo(0, 128); tg.lineTo(256, 128); tg.stroke();
  const tex = new THREE.CanvasTexture(tile);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const fw = BAY.x1 - BAY.x0, fd = BAY.z1 - BAY.z0;
  tex.repeat.set(fw, fd);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(fw, fd), std(0xffffff, { map: tex, roughness: 0.95 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  // ---- walls (Layout) ----
  const T = BAY.t, H = BAY.h;
  const box = (w, h, d, mat) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  const walls = new THREE.Group();
  const wN = box(fw + 2 * T, H, T, M.wall); wN.position.set(0, H / 2, BAY.z0 - T / 2); walls.add(wN);
  const wE = box(T, H, fd, M.wall); wE.position.set(BAY.x1 + T / 2, H / 2, 0); walls.add(wE);
  const wW = box(T, H, fd, M.wall); wW.position.set(BAY.x0 - T / 2, H / 2, 0); walls.add(wW);
  for (const w of walls.children) { w.receiveShadow = true; w.userData.pick = { layout: true }; }
  scene.add(walls);

  // South wall with a door, built as segments so the cutaway can lower it.
  const south = new THREE.Group();
  const doorX0 = -3.1, doorX1 = -1.9, doorH = 2.2;
  const sL = box(1, 1, T, M.wall), sR = box(1, 1, T, M.wall), sLin = box(1, 1, T, M.wall);
  const capL = box(1, 0.02, T + 0.01, M.poche), capR = box(1, 0.02, T + 0.01, M.poche), capLin = box(1, 0.02, T + 0.01, M.poche);
  for (const m of [sL, sR, sLin]) m.receiveShadow = true;
  south.add(sL, sR, sLin, capL, capR, capLin);
  south.position.z = BAY.z1 + T / 2;
  scene.add(south);
  const segL = [BAY.x0 - T, doorX0], segR = [doorX1, BAY.x1 + T];

  const roof = box(fw + 2 * T, 0.2, fd + 2 * T, M.roof);
  roof.receiveShadow = true;
  scene.add(roof);

  // ---- plant: header, panel, drain ----
  const header = new THREE.Group();
  const hp = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, fw + 0.3, 28), M.pipe);
  hp.rotation.z = Math.PI / 2; hp.position.set(0, 2.3, -2.95); hp.castShadow = true;
  header.add(hp);
  for (let x = -4; x <= 4; x += 2) { const s = box(0.08, 0.5, 0.55, M.pipeDark); s.position.set(x, 2.3, -3.25); header.add(s); }
  scene.add(header);
  const panel = box(0.22, 1.45, 0.95, M.panel); panel.position.set(BAY.x0 + 0.11, 1.1, 1.5); panel.castShadow = true; scene.add(panel);
  const screen = box(0.02, 0.35, 0.55, std(0x2c3336)); screen.position.set(BAY.x0 + 0.23, 1.45, 1.5); scene.add(screen);
  const drain = box(6.5, 0.012, 0.28, std(0x8e8a82, { roughness: 1 })); drain.position.set(0.4, 0.006, 0.9); drain.receiveShadow = true; scene.add(drain);

  // ---- pumps ----
  const pumps = {};
  function cylX(r, len, mat, x, y = 0.44, z = 0, seg = 40) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, seg), mat);
    m.rotation.z = Math.PI / 2;
    m.position.set(x, y, z);
    return m;
  }
  function tag(obj, inst, comp) {
    obj.traverse((o) => { if (o.isMesh) { o.userData.pick = { inst, comp }; o.castShadow = true; o.receiveShadow = true; } });
    return obj;
  }

  function buildPump(id) {
    const g = new THREE.Group();
    const coverMat = M.paint.clone();
    // skid + keep-clear marking
    g.add(tag(box(1.72, 0.14, 0.66, M.skid), id, 'skid')).children.at(-1).position.set(0, 0.07, 0);
    const mark = new THREE.Group();
    for (const [w, d, x, z] of [[2.3, 0.05, 0, -0.62], [2.3, 0.05, 0, 0.62], [0.05, 1.29, -1.15, 0], [0.05, 1.29, 1.15, 0]]) { const m = box(w, 0.004, d, M.mark); m.position.set(x, 0.003, z); mark.add(m); }
    g.add(mark);
    // motor
    const motor = new THREE.Group();
    motor.add(cylX(0.24, 0.6, M.paint, -0.42));
    for (let i = 0; i < 7; i++) motor.add(cylX(0.256, 0.018, M.paintDark, -0.67 + i * 0.075));
    motor.add(cylX(0.25, 0.12, M.paintDark, -0.78));
    const tb = box(0.16, 0.13, 0.17, M.paint); tb.position.set(-0.4, 0.72, 0); motor.add(tb);
    for (const x of [-0.6, -0.24]) { const f = box(0.08, 0.1, 0.44, M.paintDark); f.position.set(x, 0.19, 0); motor.add(f); }
    g.add(tag(motor, id, 'motor'));
    // coupling guard + bearing frame + pedestal
    const guard = box(0.22, 0.25, 0.27, M.guard); guard.position.set(0.02, 0.44, 0);
    g.add(tag(guard, id, 'motor'));
    const pumpEnd = new THREE.Group();
    pumpEnd.add(cylX(0.1, 0.22, M.paintDark, 0.25));
    const ped = box(0.28, 0.2, 0.34, M.paintDark); ped.position.set(0.36, 0.19, 0); pumpEnd.add(ped);
    // volute (stationary half of the casing) + tangential discharge
    pumpEnd.add(cylX(0.34, 0.16, M.paint, 0.44));
    const dn = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.34, 24), M.paint); dn.position.set(0.44, 0.9, -0.14); pumpEnd.add(dn);
    const df = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.03, 24), M.paintDark); df.position.set(0.44, 1.075, -0.14); pumpEnd.add(df);
    g.add(tag(pumpEnd, id, 'casing'));
    const inner = new THREE.Mesh(new THREE.CircleGeometry(0.31, 44), M.dark); inner.rotation.y = Math.PI / 2; inner.position.set(0.522, 0.44, 0);
    g.add(tag(inner, id, 'rotor'));
    // impeller (rotor) — spins about local x
    const rotor = new THREE.Group();
    rotor.position.set(0.5, 0.44, 0);
    rotor.add(cylX(0.27, 0.02, M.bronze, 0, 0));
    for (let i = 0; i < 6; i++) {
      const piv = new THREE.Group(); piv.rotation.x = (i * Math.PI) / 3;
      const vane = box(0.055, 0.19, 0.026, M.bronze); vane.position.set(0.035, 0.15, 0); vane.rotation.x = 0.42;
      piv.add(vane); rotor.add(piv);
    }
    rotor.add(cylX(0.075, 0.08, M.bronze, 0.045, 0));
    rotor.add(cylX(0.03, 0.12, M.valve, 0.06, 0));
    g.add(tag(rotor, id, 'rotor'));
    // cover assembly — the part the "Casing opening" capability separates along +x
    const cover = new THREE.Group();
    cover.add(cylX(0.34, 0.1, coverMat, 0.575));
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.335, 0.016, 10, 48), coverMat); ring.rotation.y = Math.PI / 2; ring.position.set(0.53, 0.44, 0); cover.add(ring);
    for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; const b = cylX(0.017, 0.05, M.valve, 0.63, 0.44 + 0.29 * Math.cos(a), 0.29 * Math.sin(a), 8); cover.add(b); }
    cover.add(cylX(0.1, 0.22, coverMat, 0.735));
    cover.add(cylX(0.15, 0.028, coverMat, 0.857));
    g.add(tag(cover, id, 'casing'));
    // riser, valve, branch to the header (pipework belonging to this placement)
    const pipes = new THREE.Group();
    const riser = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 1.2, 24), M.pipe); riser.position.set(0.44, 1.69, -0.14); pipes.add(riser);
    const vb = box(0.2, 0.2, 0.2, M.valve); vb.position.set(0.44, 1.55, -0.14); pipes.add(vb);
    const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.014, 8, 28), M.valve); wheel.position.set(0.44, 1.55, 0.02); pipes.add(wheel);
    const elbow = new THREE.Mesh(new THREE.SphereGeometry(0.1, 20, 14), M.pipe); elbow.position.set(0.44, 2.3, -0.14); pipes.add(elbow);
    const branch = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 1, 24), M.pipe); branch.rotation.x = Math.PI / 2; pipes.add(branch);
    pipes.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.userData.pick = { inst: id, comp: 'pipework' }; } });
    g.add(pipes);
    // as-built ghost of the cover: shown whenever the displayed cover is away from it
    const ghost = new THREE.Group();
    const dashed = new THREE.LineDashedMaterial({ color: C.session, dashSize: 0.035, gapSize: 0.025, transparent: true, opacity: 0.95, depthTest: false });
    for (const [r, len, x] of [[0.345, 0.1, 0.575], [0.105, 0.22, 0.735], [0.155, 0.03, 0.857]]) {
      const e = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.CylinderGeometry(r, r, len, 28), 30), dashed);
      e.computeLineDistances(); e.rotation.z = Math.PI / 2; e.position.set(x, 0.44, 0); e.renderOrder = 5; ghost.add(e);
    }
    ghost.visible = false;
    g.add(ghost);
    scene.add(g);
    return { id, group: g, cover, rotor, coverMat, ghost, ghostMat: dashed, branch, sep: 0 };
  }

  // ---- brackets (selection / hover / move preview) ----
  function bracketGeom() {
    const pts = [];
    const k = 0.22;
    for (const x of [-0.5, 0.5]) for (const y of [-0.5, 0.5]) for (const z of [-0.5, 0.5]) {
      pts.push(x, y, z, x - Math.sign(x) * k, y, z);
      pts.push(x, y, z, x, y - Math.sign(y) * k, z);
      pts.push(x, y, z, x, y, z - Math.sign(z) * k);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    return g;
  }
  const BG = bracketGeom();
  const mkBracket = (color, opacity = 1) => { const b = new THREE.LineSegments(BG, new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthTest: false })); b.renderOrder = 10; b.visible = false; return b; };
  const selB = mkBracket(C.sel), hovB = mkBracket(C.hover, 0.8);

  const COMP_BOX = {
    whole: () => PX2.bounds,
    casing: () => ({ min: [0.2, 0.06, -0.38], max: [0.89, 1.1, 0.38] }),
    rotor: () => ({ min: [0.47, 0.14, -0.3], max: [0.6, 0.74, 0.3] }),
    motor: () => ({ min: [-0.86, 0.12, -0.3], max: [0.14, 0.8, 0.3] }),
    skid: () => ({ min: [-0.87, 0, -0.34], max: [0.87, 0.15, 0.34] }),
    pipework: () => ({ min: [0.3, 1.0, -0.3], max: [0.6, 2.4, 0.1] }),
  };
  function placeBracket(b, sel) {
    if (b.parent) b.parent.remove(b);
    b.visible = false;
    if (!sel || !pumps[sel.inst]) return;
    const p = pumps[sel.inst];
    const bx = (COMP_BOX[sel.comp] || COMP_BOX.whole)();
    const min = [...bx.min], max = [...bx.max];
    const parent = sel.comp === 'casing' ? p.cover : p.group;
    if (sel.comp === 'casing') { min[0] = 0.51; max[0] = 0.89; min[1] = 0.08; max[1] = 0.8; }
    if (!sel.comp || sel.comp === 'whole') max[0] = Math.max(max[0], PX2.coverSpan[1] + p.sep + 0.02);
    b.scale.set(max[0] - min[0] + 0.04, max[1] - min[1] + 0.04, max[2] - min[2] + 0.04);
    b.position.set((min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2);
    parent.add(b);
    b.visible = true;
  }

  // Pending-move preview (PLATE "preview/ghost"): a footprint at the proposed position.
  const moveGhost = new THREE.Group();
  {
    const b = PX2.bounds;
    const geo = new THREE.BoxGeometry(b.max[0] - b.min[0], b.max[1] - b.min[1], b.max[2] - b.min[2]);
    const fillM = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: C.ghost, transparent: true, opacity: 0.16, depthWrite: false }));
    const edge = new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: C.ghost, transparent: true, opacity: 0.9 }));
    for (const o of [fillM, edge]) { o.position.set((b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2, 0); moveGhost.add(o); }
    moveGhost.visible = false;
    scene.add(moveGhost);
  }

  // ---- roof ghost for a displaced representation ----
  const roofGhostMat = new THREE.LineDashedMaterial({ color: C.session, dashSize: 0.16, gapSize: 0.1, transparent: true, opacity: 0.9, depthTest: false });
  const roofGhost = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(fw + 2 * T, 0.2, fd + 2 * T)), roofGhostMat);
  roofGhost.computeLineDistances();
  roofGhost.position.set(0, H + 0.1, 0);
  roofGhost.renderOrder = 5;
  roofGhost.visible = false;
  scene.add(roofGhost);

  // ---- API ----
  let cut = 0;
  function setCutaway(c) {
    cut = c;
    const top = H - 2.2 * c;
    const seg = (m, cap, [x0, x1], y0, y1) => {
      const h = Math.max(0.001, y1 - y0);
      m.scale.set(x1 - x0, h, 1); m.position.set((x0 + x1) / 2, y0 + h / 2, 0); m.visible = y1 - y0 > 0.002;
      cap.scale.set(x1 - x0, 1, 1); cap.position.set((x0 + x1) / 2, y1 + 0.01, 0); cap.visible = c > 0.01 && m.visible;
    };
    seg(sL, capL, segL, 0, top);
    seg(sR, capR, segR, 0, top);
    seg(sLin, capLin, [doorX0, doorX1], doorH, Math.max(doorH, top));
    roof.position.set(0, H + 0.1 + 3.4 * c, 0);
    M.roof.opacity = 1 - 0.86 * c;
    M.roof.depthWrite = c < 0.05;
    roof.visible = c < 0.995;
  }
  setCutaway(0);

  function syncProject(P) {
    for (const [id, inst] of Object.entries(P.scene.inst)) {
      if (!pumps[id]) pumps[id] = buildPump(id);
      const p = pumps[id];
      p.group.position.set(inst.pos[0], 0, inst.pos[1]);
      p.group.rotation.y = ((inst.rot || 0) * Math.PI) / 180;
      // branch runs from the riser elbow back to the header at z = -2.95
      const zElbow = inst.pos[1] - 0.14;
      const L = Math.max(0.05, zElbow - -2.95);
      p.branch.scale.set(1, L, 1);
      p.branch.position.set(0.44, 2.3, -0.14 - L / 2);
    }
  }

  function setChannels(ch) {
    for (const p of Object.values(pumps)) {
      const v = ch[p.id + '.casing'] ?? 0;
      p.sep = v;
      p.cover.position.x = v;
    }
    setCutaway(ch['bay.cutaway'] ?? 0);
  }

  function setRotor(phase, still) {
    for (const p of Object.values(pumps)) p.rotor.rotation.x = still ? 0.35 : phase[p.id] ?? 0;
  }

  // style: null | 'session' | 'authored'
  function setGhost(instId, style) {
    for (const p of Object.values(pumps)) {
      const show = p.id === instId && style && p.sep > 0.03;
      p.ghost.visible = !!show;
      if (show) p.ghostMat.color.setHex(style === 'authored' ? C.authored : C.session);
    }
  }
  function setGhosts(map) {
    for (const p of Object.values(pumps)) {
      const style = map[p.id];
      const show = style && p.sep > 0.03;
      p.ghost.visible = !!show;
      if (show) p.ghostMat.color.setHex(style === 'authored' ? C.authored : C.session);
    }
  }
  function setRoofGhost(style) {
    roofGhost.visible = !!style && cut > 0.03;
    if (style) roofGhostMat.color.setHex(style === 'authored' ? C.authored : C.session);
  }

  function setPulse(instId, k) {
    for (const p of Object.values(pumps)) {
      const on = p.id === instId ? k : 0;
      p.coverMat.emissive.setRGB(0.95 * on, 0.92 * on, 0.82 * on);
    }
  }

  function setMoveGhost(instId, pos) {
    moveGhost.visible = !!pos;
    if (pos) moveGhost.position.set(pos[0], 0, pos[1]);
  }

  const setSelection = (sel) => placeBracket(selB, sel);
  const setHover = (h) => placeBracket(hovB, h);

  function setPose(pose) {
    camera.fov = projectedFov(pose.fov, camera.aspect);
    camera.position.set(...pose.eye);
    camera.lookAt(...pose.target);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
  }

  const ray = new THREE.Raycaster();
  function pick(nx, ny) {
    ray.setFromCamera({ x: nx, y: ny }, camera);
    const targets = [];
    for (const p of Object.values(pumps)) p.group.traverse((o) => { if (o.isMesh && o.userData.pick && o.visible) targets.push(o); });
    const hit = ray.intersectObjects(targets, false)[0];
    return hit ? hit.object.userData.pick : null;
  }

  const _p = new THREE.Vector3();
  function project(p3) {
    _p.set(p3[0], p3[1], p3[2]).project(camera);
    const r = canvas.getBoundingClientRect();
    return { x: ((_p.x + 1) / 2) * r.width, y: ((1 - _p.y) / 2) * r.height, on: _p.z < 1 && _p.z > -1 && Math.abs(_p.x) < 1.05 && Math.abs(_p.y) < 1.05 };
  }

  function resize() {
    const r = canvas.parentElement.getBoundingClientRect();
    const w = Math.max(2, Math.floor(r.width)), h = Math.max(2, Math.floor(r.height));
    renderer.setSize(w, h, false);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  function render() { renderer.render(scene, camera); }

  // ---- thumbnails: a second, small renderer over the same scene ----
  const tr = new THREE.WebGLRenderer({ canvas: thumbCanvas, antialias: true, preserveDrawingBuffer: true });
  tr.setPixelRatio(1);
  tr.setSize(288, 180, false);
  const tcam = new THREE.PerspectiveCamera(50, 288 / 180, 0.05, 200);
  function thumb(pose, ch) {
    const saved = Object.fromEntries(Object.values(pumps).map((p) => [p.id, p.sep]));
    const savedCut = cut;
    const vis = [selB.visible, hovB.visible, moveGhost.visible, roofGhost.visible, ...Object.values(pumps).map((p) => p.ghost.visible)];
    try {
      selB.visible = hovB.visible = moveGhost.visible = roofGhost.visible = false;
      for (const p of Object.values(pumps)) p.ghost.visible = false;
      setChannels(ch);
      tcam.fov = pose.fov; tcam.position.set(...pose.eye); tcam.lookAt(...pose.target); tcam.updateProjectionMatrix();
      tr.render(scene, tcam);
      return thumbCanvas.toDataURL('image/jpeg', 0.82);
    } finally {
      for (const p of Object.values(pumps)) { p.sep = saved[p.id]; p.cover.position.x = saved[p.id]; }
      setCutaway(savedCut);
      [selB.visible, hovB.visible, moveGhost.visible, roofGhost.visible] = vis;
      Object.values(pumps).forEach((p, i) => { p.ghost.visible = vis[4 + i]; });
    }
  }

  return { renderer, scene, camera, syncProject, setChannels, setRotor, setGhost, setGhosts, setRoofGhost, setPulse, setMoveGhost, setSelection, setHover, setPose, pick, project, resize, render, thumb };
}
