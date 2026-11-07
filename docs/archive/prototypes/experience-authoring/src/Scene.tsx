import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { automaticCamera, focusCenter, solveView, type Document, type Focus, type Value, type Vec3, type ViewDefinition } from './model';
import { cameraPose, projectedValue, type Runtime } from './runtime';
import type { CameraPose } from './camera';
export type { CameraPose };
export type SceneHandle = { capture: () => CameraPose; move: (pose: CameraPose) => void; frame: (focus: Focus) => void; reset: () => void };
type Props = { document: Document; mode: 'experience' | 'world' | 'visitor'; runtime: Runtime | null; audition: Record<string, Record<string, Value>>; selected: string[]; view: ViewDefinition | null; region: Focus | null; regionPicking: boolean; onSubject: (id: string, additive: boolean) => void; onEncounter: (id: string) => void; onRegion: (region: Focus) => void };
export const Scene = forwardRef<SceneHandle, Props>(function Scene(props, ref) {
  const host = useRef<HTMLDivElement>(null); const latest = useRef(props); latest.current = props;
  const controlRef = useRef<{ camera: THREE.PerspectiveCamera; controls: OrbitControls; move: (p: CameraPose) => void } | null>(null);
  useImperativeHandle(ref, () => ({
    capture: () => controlRef.current ? { position: controlRef.current.camera.position.toArray() as Vec3, target: controlRef.current.controls.target.toArray() as Vec3 } : { position: [13, 10, 17], target: [0, 1, 0] },
    move: pose => controlRef.current?.move(pose),
    frame: focus => controlRef.current?.move(automaticCamera(latest.current.document, focus)),
    reset: () => controlRef.current?.move({ position: [13, 10, 17], target: [0, 1, 0] }),
  }), []);
  useEffect(() => {
    const element = host.current!; const scene = new THREE.Scene(); scene.background = new THREE.Color('#e4e9ef');
    const camera = new THREE.PerspectiveCamera(45, 1, .1, 200); camera.position.set(13, 10, 17);
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true }); } catch { element.dataset.renderError = 'true'; element.textContent = 'WebGL is unavailable. The outline and authoring controls remain usable.'; return; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); renderer.setSize(element.clientWidth, element.clientHeight); renderer.outputColorSpace = THREE.SRGBColorSpace; element.appendChild(renderer.domElement);
    renderer.domElement.setAttribute('aria-label', 'Editable 3D workshop'); renderer.domElement.setAttribute('data-testid', 'spatial-canvas');
    const controls = new OrbitControls(camera, renderer.domElement); controls.target.set(0, 1, 0); controls.enableDamping = true; controls.maxPolarAngle = Math.PI / 2.04; controls.minDistance = 1; controls.maxDistance = 45;
    const ambient = new THREE.AmbientLight(0xffffff, .65); scene.add(ambient); const sun = new THREE.DirectionalLight(0xffffff, 2); sun.position.set(7, 12, 7); scene.add(sun);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(22, 18), new THREE.MeshStandardMaterial({ color: '#d3d9e1', roughness: 1 })); floor.rotation.x = -Math.PI / 2; floor.userData.floor = true; scene.add(floor);
    const grid = new THREE.GridHelper(22, 22, '#a1abb9', '#c3ccd8'); grid.position.y = .005; scene.add(grid);
    const groups: Record<string, THREE.Group> = {}; const markers: Record<string, THREE.Group> = {};
    const geometries: THREE.BufferGeometry[] = []; const materials: THREE.Material[] = []; const textures: THREE.Texture[] = [];
    function material(color: string) { const m = new THREE.MeshStandardMaterial({ color, roughness: .65, metalness: .1 }); materials.push(m); return m; }
    function box(g: THREE.Group, size: Vec3, at: Vec3, color: string) { const geo = new THREE.BoxGeometry(...size); geometries.push(geo); const m = new THREE.Mesh(geo, material(color)); m.position.set(...at); g.add(m); return m; }
    function cylinder(g: THREE.Group, radius: number, height: number, at: Vec3, color: string) { const geo = new THREE.CylinderGeometry(radius, radius, height, 24); geometries.push(geo); const m = new THREE.Mesh(geo, material(color)); m.position.set(...at); g.add(m); return m; }
    function label(text: string) { const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 80; const ctx = canvas.getContext('2d')!; ctx.fillStyle = '#ffffffee'; ctx.fillRect(0, 0, 512, 80); ctx.fillStyle = '#233346'; ctx.font = 'bold 27px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, 256, 40, 490); const tex = new THREE.CanvasTexture(canvas); textures.push(tex); const mat = new THREE.SpriteMaterial({ map: tex, depthTest: false }); materials.push(mat); const sprite = new THREE.Sprite(mat); sprite.scale.set(3.8, .59, 1); sprite.renderOrder = 4; return sprite; }
    function subjectGroup(sid: string) { const s = latest.current.document.world.subjects[sid]; const g = new THREE.Group(); g.userData.subjectId = sid;
      if (s.shape === 'machine') { box(g, [3.2, .3, 2.2], [0, .15, 0], '#637083'); box(g, [.2, 2, 2], [-1.3, 1.3, 0], '#9eacbd').name = 'leftCasing'; box(g, [.2, 2, 2], [1.3, 1.3, 0], '#9eacbd').name = 'rightCasing'; const rotor = cylinder(g, .85, 1, [0, 1.35, 0], '#387b98'); rotor.rotation.x = Math.PI / 2; rotor.name = 'rotor'; box(g, [.15, 1.35, .12], [0, 1.35, .56], '#ebbb63').name = 'blade'; const shaft = cylinder(g, .15, 4, [0, 1.35, 0], '#596779'); shaft.rotation.z = Math.PI / 2; }
      else if (s.shape === 'piano') { box(g, [3, 1.6, 1.4], [0, 1.2, 0], '#3b4656'); box(g, [3, .2, .6], [0, .85, .93], '#ced4dc'); for (let i = 0; i < 12; i++) box(g, [.2, .08, .6], [-1.32 + i * .24, 1, .93], i % 3 === 1 ? '#667386' : '#f7f8fa'); for (const x of [-1.2, 1.2]) box(g, [.18, 1, .18], [x, .5, .2], '#3b4656'); }
      else if (s.shape === 'wall') { const pivot = new THREE.Group(); pivot.name = 'wallPivot'; g.add(pivot); box(pivot, [8, 3.6, .3], [0, 1.8, 0], '#aeb5bd'); for (let x = -3.5; x < 4; x += 1) box(pivot, [.08, 3.6, .36], [x, 1.8, 0], '#8a96a5'); }
      else if (s.shape === 'light') { cylinder(g, .4, .12, [0, .06, 0], '#596779'); cylinder(g, .06, 2.8, [0, 1.4, 0], '#667386'); const bulb = cylinder(g, .3, .4, [0, 2.8, 0], '#e9c779'); bulb.name = 'bulb'; const lamp = new THREE.PointLight('#ffe0a7', 2, 12, 1); lamp.position.set(0, 2.7, 0); lamp.name = 'lamp'; g.add(lamp); }
      else if (s.shape === 'switch') { box(g, [.9, .14, .9], [0, .07, 0], '#596779'); box(g, [.16, .6, .16], [0, .38, 0], '#c9803a').name = 'lever'; }
      else if (s.shape === 'mesh') { const geo = new THREE.TorusKnotGeometry(.65, .22, 72, 10); geometries.push(geo); const m = new THREE.Mesh(geo, material('#708cba')); m.position.y = 1.2; g.add(m); cylinder(g, .9, .4, [0, .2, 0], '#9da8b7'); }
      const l = label(s.name); l.name = 'subjectLabel'; l.position.y = s.shape === 'wall' ? 4.2 : s.shape === 'switch' ? 1.5 : 3.3; g.add(l); g.userData.labelText = s.name; scene.add(g); groups[sid] = g; return g;
    }
    for (const s of Object.values(latest.current.document.world.subjects)) if (s.shape !== 'environment') subjectGroup(s.id);
    const viewMarker = new THREE.Group(); const eye = new THREE.Mesh(new THREE.SphereGeometry(.12, 12, 12), new THREE.MeshBasicMaterial({ color: '#5268a8' })); viewMarker.add(eye); const line = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: '#5268a8' })); scene.add(viewMarker, line);
    let tween: { from: THREE.Vector3; targetFrom: THREE.Vector3; to: THREE.Vector3; targetTo: THREE.Vector3; t: number } | null = null;
    function move(pose: CameraPose) { tween = { from: camera.position.clone(), targetFrom: controls.target.clone(), to: new THREE.Vector3(...pose.position), targetTo: new THREE.Vector3(...pose.target), t: 0 }; }
    controlRef.current = { camera, controls, move }; controls.addEventListener('start', () => { tween = null; });
    const raycaster = new THREE.Raycaster(); const pointer = new THREE.Vector2(); let down = { x: 0, y: 0 }; let firstRegion: Vec3 | null = null;
    const onDown = (ev: PointerEvent) => { down = { x: ev.clientX, y: ev.clientY }; };
    const onUp = (ev: PointerEvent) => { if (Math.hypot(ev.clientX - down.x, ev.clientY - down.y) > 6) return; const rect = renderer.domElement.getBoundingClientRect(); pointer.set((ev.clientX - rect.left) / rect.width * 2 - 1, -(ev.clientY - rect.top) / rect.height * 2 + 1); raycaster.setFromCamera(pointer, camera);
      if (latest.current.regionPicking) { const p = new THREE.Vector3(); if (raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), p)) { const here = p.toArray() as Vec3; if (!firstRegion) firstRegion = here; else { latest.current.onRegion({ kind: 'region', min: [Math.min(firstRegion[0], here[0]), 0, Math.min(firstRegion[2], here[2])], max: [Math.max(firstRegion[0], here[0]), 3, Math.max(firstRegion[2], here[2])] }); firstRegion = null; } } return; }
      const hits = raycaster.intersectObjects([...Object.values(markers), ...Object.values(groups)], true); for (const hit of hits) { let item: THREE.Object3D | null = hit.object; let visible = true; for (let at: THREE.Object3D | null = item; at; at = at.parent) if (!at.visible) visible = false; if (!visible) continue; while (item && !item.userData.subjectId && !item.userData.encounterId) item = item.parent; if (item?.userData.encounterId) { latest.current.onEncounter(item.userData.encounterId); return; } if (item?.userData.subjectId) { latest.current.onSubject(item.userData.subjectId, ev.shiftKey); return; } }
    };
    renderer.domElement.addEventListener('pointerdown', onDown); renderer.domElement.addEventListener('pointerup', onUp);
    const resize = new ResizeObserver(() => { const w = element.clientWidth, h = element.clientHeight; camera.aspect = w / Math.max(1, h); camera.updateProjectionMatrix(); renderer.setSize(w, h); }); resize.observe(element);
    const regionOutline = new THREE.LineLoop(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: '#2d7b73' })); scene.add(regionOutline);
    const regionPoint = new THREE.Mesh(new THREE.SphereGeometry(.15, 10, 10), new THREE.MeshBasicMaterial({ color: '#2d7b73' })); scene.add(regionPoint);
    let frame = 0, last = performance.now();
    const animate = (now: number) => { const dt = Math.min(.1, (now - last) / 1000); last = now; const p = latest.current;
      controls.enabled = p.mode !== 'visitor' || !!p.runtime?.exploring || !p.runtime?.camera;
      if (p.mode === 'visitor') { tween = null; const pose = p.runtime ? cameraPose(p.runtime) : null; if (pose) { camera.position.set(...pose.position); controls.target.set(...pose.target); } }
      else if (tween) { tween.t = Math.min(1, tween.t + dt * 2); const t = tween.t * tween.t * (3 - 2 * tween.t); camera.position.lerpVectors(tween.from, tween.to, t); controls.target.lerpVectors(tween.targetFrom, tween.targetTo, t); if (tween.t === 1) tween = null; }
      for (const [sid, group] of Object.entries(groups)) if (!p.document.world.subjects[sid]) group.visible = false;
      for (const s of Object.values(p.document.world.subjects)) { if (s.shape === 'environment') continue; const g = groups[s.id] ?? subjectGroup(s.id); g.position.set(...s.position); const val = (channel: string) => p.mode === 'world' ? s.properties[channel] : p.mode === 'visitor' ? projectedValue(p.document, p.runtime, s.id, channel) : p.audition[s.id]?.[channel] ?? s.properties[channel]; g.visible = val('visible') !== false;
        if (g.userData.labelText !== s.name) { const oldLabel = g.getObjectByName('subjectLabel'); if (oldLabel) g.remove(oldLabel); const l = label(s.name); l.name = 'subjectLabel'; l.position.y = s.shape === 'wall' ? 4.2 : s.shape === 'switch' ? 1.5 : 3.3; g.add(l); g.userData.labelText = s.name; }
        g.traverse(o => { if (o instanceof THREE.Mesh && o.material instanceof THREE.MeshStandardMaterial) o.material.emissive.set(p.mode !== 'visitor' && p.selected.includes(s.id) ? '#284456' : val('highlight') ? '#805a15' : '#000000'); });
        if (s.shape === 'machine') { const amount = Number(val('open') ?? 0); g.getObjectByName('leftCasing')!.position.x = -1.3 - amount * 1.5; g.getObjectByName('rightCasing')!.position.x = 1.3 + amount * 1.5; if (val('running')) { g.getObjectByName('rotor')!.rotation.y += dt * 2; g.getObjectByName('blade')!.rotation.z += dt * 2; } }
        if (s.shape === 'wall') { const pivot = g.getObjectByName('wallPivot')!; const target = val('unfolded') ? -Math.PI / 2 : 0; pivot.rotation.x += (target - pivot.rotation.x) * Math.min(1, dt * 7); }
        if (s.shape === 'switch') g.getObjectByName('lever')!.rotation.x = val('pressed') ? .55 : 0;
        if (s.shape === 'light') (g.getObjectByName('lamp') as THREE.PointLight).intensity = Number(val('intensity'));
        if (s.shape === 'piano' && val('playing')) g.traverse(o => { if (o instanceof THREE.Mesh && o.material instanceof THREE.MeshStandardMaterial) o.material.emissive.set('#184a2c'); });
      }
      const room = p.document.world.subjects.room; ambient.intensity = Number(p.mode === 'world' ? room?.properties.ambient : p.mode === 'visitor' ? projectedValue(p.document, p.runtime, 'room', 'ambient') : p.audition.room?.ambient ?? room?.properties.ambient ?? .65);
      for (const e of Object.values(p.document.experience.encounters)) { if (!markers[e.id]) { const group = new THREE.Group(); group.userData.encounterId = e.id; const geo = new THREE.OctahedronGeometry(.2); geometries.push(geo); const sphere = new THREE.Mesh(geo, material('#436b92')); group.add(sphere); markers[e.id] = group; scene.add(group); } const marker = markers[e.id]; if (marker.userData.labelText !== e.name) { const old = marker.getObjectByName('encounterLabel'); if (old) marker.remove(old); const l = label(e.name); l.name = 'encounterLabel'; l.position.y = .55; l.scale.multiplyScalar(.85); marker.add(l); marker.userData.labelText = e.name; } const center = focusCenter(p.document, e.focus); marker.position.set(center[0], 4.9, center[2]); marker.visible = p.mode !== 'world'; }
      for (const [eid, marker] of Object.entries(markers)) if (!p.document.experience.encounters[eid]) marker.visible = false;
      viewMarker.visible = line.visible = p.mode === 'experience' && !!p.view;
      if (p.view) { const v = solveView(p.document, p.view); eye.position.set(...v.position); line.geometry.dispose(); line.geometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(...v.position), new THREE.Vector3(...v.target)]); }
      regionOutline.visible = p.region?.kind === 'region'; if (p.region?.kind === 'region') { const { min, max } = p.region; regionOutline.geometry.dispose(); regionOutline.geometry = new THREE.BufferGeometry().setFromPoints([[min[0], .04, min[2]], [max[0], .04, min[2]], [max[0], .04, max[2]], [min[0], .04, max[2]]].map(point => new THREE.Vector3(...point as Vec3))); }
      if (!p.regionPicking) firstRegion = null; regionPoint.visible = !!firstRegion; if (firstRegion) regionPoint.position.set(firstRegion[0], .12, firstRegion[2]);
      controls.update(); renderer.render(scene, camera); frame = requestAnimationFrame(animate);
    }; frame = requestAnimationFrame(animate);
    return () => { cancelAnimationFrame(frame); resize.disconnect(); renderer.domElement.removeEventListener('pointerdown', onDown); renderer.domElement.removeEventListener('pointerup', onUp); controls.dispose(); geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); textures.forEach(t => t.dispose()); scene.traverse(o => { if (o instanceof THREE.Mesh || o instanceof THREE.Line) { o.geometry.dispose(); } }); renderer.dispose(); renderer.domElement.remove(); controlRef.current = null; };
  }, []);
  return <div className="scene" ref={host} data-testid="scene-host" />;
});
