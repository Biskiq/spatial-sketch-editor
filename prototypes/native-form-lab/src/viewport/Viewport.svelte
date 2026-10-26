<script lang="ts">
  import { onMount } from 'svelte';
  import type { Snippet } from 'svelte';
  import * as THREE from 'three';
  import { roleKey } from '../model/types';
  import type { DocumentEvaluation, Frame, GeneratedRole, HostTarget, LabDocument, SourceRoleKey, Vec2, Vec3 } from '../model/types';
  import { axisDirection, constrainWorldPointToAxis, isAxisLockCompatible, type AxisLock } from '../drafting/constraints';

  export interface Workplane {
    target: HostTarget;
    frame: Frame;
    label: string;
  }

  type SurfaceHit = { formId: string; role: GeneratedRole; point: Vec3 };
  type Drag =
    | { kind: 'profile-point'; formId: string; pointId: string; frame: Frame; original: Vec2; latest: Vec2 }
    | { kind: 'height'; formId: string; frame: Frame; profileCenter: Vec3; latest: number }
    | { kind: 'revolve'; formId: string; frame: Frame; center: THREE.Vector3; startRadial: THREE.Vector3; startAngle: number; latest: number }
    | { kind: 'carrier-point'; formId: string; pointId: string; frame: Frame; frameAnchor: Frame; formFrame: Frame; original: Vec3; latest: Vec3 }
    | { kind: 'orbit'; pointerX: number; pointerY: number }
    | { kind: 'pan'; pointerX: number; pointerY: number };

  interface Props {
    document: LabDocument;
    evaluation: DocumentEvaluation;
    selectedFormId: string | null;
    selectedRoleKey: SourceRoleKey | null;
    selectedAttachmentId: string | null;
    tool: 'select' | 'draw';
    workplane: Workplane | null;
    draftPoints: Vec2[];
    interactionMode: 'context' | 'explicit';
    axisLock: AxisLock;
    snapEnabled: boolean;
    snapStep: number;
    onSelect: (hit: SurfaceHit | null) => void;
    onSelectAttachment: (attachmentId: string | null) => void;
    onLatchPlane: (plane: Workplane) => void;
    onDraftPoint: (point: Vec2) => void;
    onCloseProfile: () => void;
    onPreview: (command: unknown) => void;
    onCommit: (command: unknown) => void;
    onCancel: () => void;
    onStatus: (message: string) => void;
    onCameraMode: (mode: 'perspective' | 'plan' | 'face') => void;
    children?: Snippet;
  }

  let {
    document,
    evaluation,
    selectedFormId,
    selectedRoleKey,
    selectedAttachmentId,
    tool,
    workplane,
    draftPoints,
    interactionMode,
    axisLock,
    snapEnabled,
    snapStep,
    onSelect,
    onSelectAttachment,
    onLatchPlane,
    onDraftPoint,
    onCloseProfile,
    onPreview,
    onCommit,
    onCancel,
    onStatus,
    onCameraMode,
    children,
  }: Props = $props();

  let host: HTMLDivElement;
  let cameraMode = $state<'perspective' | 'plan' | 'face'>('perspective');
  let drag: Drag | null = null;
  let previousCamera: { position: THREE.Vector3; target: THREE.Vector3; up: THREE.Vector3; fov: number } | null = null;
  let renderer: THREE.WebGLRenderer | null = null;
  let scene: THREE.Scene | null = null;
  let camera: THREE.PerspectiveCamera | null = null;
  let controlsTarget = new THREE.Vector3(0, 0.8, 0);
  let modelGroup: THREE.Group | null = null;
  let overlayGroup: THREE.Group | null = null;
  let raycaster = new THREE.Raycaster();
  let pointer = new THREE.Vector2();
  let modelMeshes: THREE.Mesh[] = [];
  let handleObjects: THREE.Object3D[] = [];
  let attachmentObjects: THREE.Mesh[] = [];
  let hoverPlane: Workplane | null = null;
  let hoverPlaneKey: string | null = null;
  let activeHandle: THREE.Object3D | null = null;
  let handleParallel = false;
  let spaceHeld = false;
  let capturedPointerId: number | null = null;

  const groundFrame: Frame = {
    origin: [0, 0, 0],
    u: [1, 0, 0],
    v: [0, 0, -1],
    normal: [0, 1, 0],
  };

  const vec3 = (value: Vec3) => new THREE.Vector3(value[0], value[1], value[2]);
  const tuple3 = (value: THREE.Vector3): Vec3 => [value.x, value.y, value.z];
  const v2 = (value: Vec2) => new THREE.Vector2(value[0], value[1]);
  const tuple2 = (value: THREE.Vector2): Vec2 => [value.x, value.y];
  const unit = (value: Vec3) => vec3(value).normalize();
  const worldFromLocal = (frame: Frame, point: Vec2): THREE.Vector3 =>
    vec3(frame.origin).addScaledVector(unit(frame.u), point[0]).addScaledVector(unit(frame.v), point[1]);
  const localFromWorld = (frame: Frame, point: THREE.Vector3): Vec2 => {
    const delta = point.clone().sub(vec3(frame.origin));
    return [delta.dot(unit(frame.u)), delta.dot(unit(frame.v))];
  };
  const frameQuaternion = (frame: Frame) => {
    const matrix = new THREE.Matrix4().makeBasis(unit(frame.u), unit(frame.v), unit(frame.normal));
    return new THREE.Quaternion().setFromRotationMatrix(matrix);
  };
  const snapScalar = (value: number, step: number) => Math.round(value / step) * step;

  function invalidate() {
    if (renderer && scene && camera) renderer.render(scene, camera);
  }

  function clearGroup(group: THREE.Group) {
    for (const child of [...group.children]) {
      group.remove(child);
      child.traverse((node) => {
        if (node instanceof THREE.Mesh || node instanceof THREE.Line || node instanceof THREE.LineLoop) {
          node.geometry.dispose();
          const materials = Array.isArray(node.material) ? node.material : [node.material];
          materials.forEach((material) => material.dispose());
        }
      });
    }
  }

  function makeSphere(position: THREE.Vector3, radius: number, color: string, userData?: Record<string, unknown>, opacity = 1): THREE.Mesh<THREE.SphereGeometry, THREE.Material> {
    const material = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.58,
      transparent: opacity < 1,
      opacity,
      depthWrite: opacity >= 1,
    });
    const mesh = new THREE.Mesh<THREE.SphereGeometry, THREE.Material>(new THREE.SphereGeometry(radius, 16, 12), material);
    mesh.position.copy(position);
    mesh.castShadow = false;
    if (userData) Object.assign(mesh.userData, userData);
    return mesh;
  }

  function makeLine(points: THREE.Vector3[], color: string, opacity = 1, dashed = false) {
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = dashed
      ? new THREE.LineDashedMaterial({ color, dashSize: 0.08, gapSize: 0.045, transparent: opacity < 1, opacity })
      : new THREE.LineBasicMaterial({ color, transparent: opacity < 1, opacity });
    const line = new THREE.Line(geometry, material);
    if (dashed) line.computeLineDistances();
    return line;
  }

  function roleMaterial(formId: string, role: GeneratedRole) {
    const finish = document.finishes.find((item) => item.target.formId === formId && item.target.partKey === role.address.partKey);
    const selected = selectedFormId === formId && selectedRoleKey === role.key;
    const formSelected = selectedFormId === formId;
    const color = selected ? '#c49a48' : finish?.color ?? (formSelected ? '#a4a77d' : '#798878');
    return new THREE.MeshStandardMaterial({ color, roughness: 0.76, metalness: 0.02, side: THREE.DoubleSide });
  }

  function addFormMesh(formId: string, formEvaluation: DocumentEvaluation['forms'][string]) {
    if (!scene || !modelGroup) return;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(formEvaluation.mesh.positions, 3));
    geometry.setIndex(formEvaluation.mesh.indices);
    geometry.computeVertexNormals();

    const materialRoles = formEvaluation.roles;
    const roleIndices = new Map<SourceRoleKey, number>();
    const materials: THREE.Material[] = [];
    for (const role of materialRoles) {
      roleIndices.set(role.key, materials.length);
      materials.push(roleMaterial(formId, role));
    }
    for (let triangleIndex = 0; triangleIndex < formEvaluation.mesh.triangleRoleKeys.length; triangleIndex += 1) {
      const roleIndex = roleIndices.get(formEvaluation.mesh.triangleRoleKeys[triangleIndex]!) ?? 0;
      geometry.addGroup(triangleIndex * 3, 3, roleIndex);
    }
    const mesh = new THREE.Mesh(geometry, materials);
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.userData.formId = formId;
    mesh.userData.triangleRoleKeys = formEvaluation.mesh.triangleRoleKeys;
    mesh.userData.roles = materialRoles;
    modelGroup.add(mesh);
    modelMeshes.push(mesh);
  }

  function addHandle(parent: THREE.Group, position: THREE.Vector3, kind: string, payload: Record<string, unknown>, radius = 0.052) {
    const halo = makeSphere(position, radius * 1.65, '#fffdf5', { handle: kind, ...payload });
    halo.material = new THREE.MeshBasicMaterial({ color: '#fffdf5', depthTest: false });
    halo.renderOrder = 4;
    const core = makeSphere(position, radius, '#c49a48', { handle: kind, ...payload });
    core.material = new THREE.MeshBasicMaterial({ color: '#c49a48', depthTest: false });
    core.renderOrder = 5;
    const pick = new THREE.Mesh(new THREE.SphereGeometry(radius * 3.4, 12, 8), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
    pick.position.copy(position);
    Object.assign(pick.userData, { handle: kind, ...payload });
    parent.add(halo, core, pick);
    handleObjects.push(pick);
  }

  function addWorkplaneOverlay() {
    if (!overlayGroup) return;
    const plane = workplane ?? (tool === 'draw' ? hoverPlane : null);
    if (!plane) return;
    const latched = workplane !== null;
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(4.4, 4.4),
      new THREE.MeshBasicMaterial({ color: latched ? '#d3b772' : '#b7c79e', transparent: true, opacity: latched ? 0.13 : 0.1, side: THREE.DoubleSide, depthWrite: false }),
    );
    mesh.position.copy(vec3(plane.frame.origin));
    mesh.quaternion.copy(frameQuaternion(plane.frame));
    mesh.renderOrder = 1;
    overlayGroup.add(mesh);
    const corners = [
      [-2.2, -2.2], [2.2, -2.2], [2.2, 2.2], [-2.2, 2.2], [-2.2, -2.2],
    ].map(([x, y]) => worldFromLocal(plane.frame, [x!, y!]));
    const outline = makeLine(corners, latched ? '#aa8744' : '#778b6d', latched ? 0.8 : 0.58);
    outline.renderOrder = 2;
    overlayGroup.add(outline);
  }

  function addProfileAndHandles() {
    if (!overlayGroup || !selectedFormId || tool === 'draw') return;
    const form = document.forms.find((item) => item.id === selectedFormId);
    if (!form) return;
    const points = form.profile.points.map((point) => worldFromLocal(form.frame, point.position));
    const contour = [...points, points[0]!];
    const loop = makeLine(contour, '#d4ad5b', 1);
    loop.renderOrder = 3;
    overlayGroup.add(loop);
    for (const point of form.profile.points) {
      addHandle(overlayGroup, worldFromLocal(form.frame, point.position), 'profile-point', { formId: form.id, pointId: point.id });
    }

    if (form.operation.kind === 'extrude' && interactionMode === 'context') {
      const center2: Vec2 = form.profile.points.reduce((acc, point) => [acc[0] + point.position[0] / form.profile.points.length, acc[1] + point.position[1] / form.profile.points.length], [0, 0]);
      const center = worldFromLocal(form.frame, center2);
      const normal = unit(form.frame.normal);
      const base = center.clone().addScaledVector(normal, 0.08);
      const end = center.clone().addScaledVector(normal, form.operation.height);
      const rayEnd = end.clone().addScaledVector(normal, 0.28);
      const arrow = makeLine([base, rayEnd], '#c49a48', 0.9);
      arrow.renderOrder = 3;
      overlayGroup.add(arrow);
      addHandle(overlayGroup, end, 'height', { formId: form.id, frame: form.frame, profileCenter: tuple3(center) }, 0.065);
    }

    if (form.operation.kind === 'revolve' && interactionMode === 'context') {
      const vAxis = unit(form.frame.v);
      const uAxis = unit(form.frame.u);
      const nAxis = unit(form.frame.normal);
      const centerY = form.profile.points.reduce((sum, point) => sum + point.position[1] / form.profile.points.length, 0);
      const center = vec3(form.frame.origin).addScaledVector(vAxis, centerY);
      const radius = Math.max(0.35, ...form.profile.points.map((point) => Math.abs(point.position[0]))) + 0.18;
      const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.012, 5, 96), new THREE.MeshBasicMaterial({ color: '#9c895c', transparent: true, opacity: 0.6, depthTest: false }));
      const basis = new THREE.Matrix4().makeBasis(uAxis, nAxis.clone().negate(), vAxis);
      ring.quaternion.setFromRotationMatrix(basis);
      ring.position.copy(center);
      ring.renderOrder = 3;
      overlayGroup.add(ring);
      const angle = THREE.MathUtils.degToRad(form.operation.angleDegrees);
      const radial = uAxis.clone().multiplyScalar(Math.cos(angle)).addScaledVector(nAxis, -Math.sin(angle));
      addHandle(overlayGroup, center.clone().addScaledVector(radial, radius), 'revolve-angle', { formId: form.id, frame: form.frame, center: tuple3(center), angle: form.operation.angleDegrees }, 0.062);
    }

    if (form.operation.kind === 'sweep') {
      const carrierPoints = form.operation.carrier.points;
      if (carrierPoints.length > 1) {
        const path = makeLine(carrierPoints.map((point) => vec3(point.position)), '#c49a48', 0.9);
        path.renderOrder = 3;
        overlayGroup.add(path);
      }
      if (interactionMode === 'context') {
        for (const point of carrierPoints) {
          addHandle(overlayGroup, vec3(point.position), 'carrier-point', { formId: form.id, pointId: point.id, frame: form.operation.carrier.frameAnchor }, 0.055);
        }
      }
    }
  }

  function addDraftOverlay() {
    if (!overlayGroup || !workplane || draftPoints.length === 0) return;
    const projected = draftPoints.map((point) => worldFromLocal(workplane.frame, point));
    if (projected.length > 1) {
      const line = makeLine(projected, '#c49a48', 0.98);
      line.renderOrder = 6;
      overlayGroup.add(line);
    }
    for (const point of projected) {
      const dot = makeSphere(point, 0.032, '#fffdf5');
      dot.material = new THREE.MeshBasicMaterial({ color: '#fffdf5', depthTest: false });
      dot.renderOrder = 6;
      overlayGroup.add(dot);
    }
  }

  function addAttachments() {
    if (!overlayGroup) return;
    for (const attachment of document.attachments) {
      const unresolved = attachment.status === 'unresolved';
      const token = new THREE.Mesh(
        new THREE.OctahedronGeometry(unresolved ? 0.095 : 0.075, 0),
        new THREE.MeshStandardMaterial({ color: unresolved ? '#b85d4f' : '#d9d5c8', roughness: 0.52, metalness: 0.16 }),
      );
      token.position.copy(vec3(attachment.lastFrame.origin));
      token.userData.attachmentId = attachment.id;
      token.castShadow = false;
      overlayGroup.add(token);
      attachmentObjects.push(token);
      if (attachment.id === selectedAttachmentId || unresolved) {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.012, 5, 32), new THREE.MeshBasicMaterial({ color: unresolved ? '#b85d4f' : '#fffdf5', depthTest: false }));
        ring.position.copy(token.position);
        ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 1, 0));
        ring.renderOrder = 5;
        overlayGroup.add(ring);
      }
    }
  }

  function rebuildScene() {
    if (!scene || !modelGroup || !overlayGroup) return;
    clearGroup(modelGroup);
    clearGroup(overlayGroup);
    modelMeshes = [];
    handleObjects = [];
    attachmentObjects = [];
    for (const form of document.forms) {
      const formEvaluation = evaluation.forms[form.id];
      if (formEvaluation?.valid) addFormMesh(form.id, formEvaluation);
    }
    addWorkplaneOverlay();
    addProfileAndHandles();
    addDraftOverlay();
    addAttachments();
    invalidate();
  }

  function resize() {
    if (!host || !renderer || !camera) return;
    const width = Math.max(1, host.clientWidth);
    const height = Math.max(1, host.clientHeight);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    invalidate();
  }

  onMount(() => {
    scene = new THREE.Scene();
    scene.background = new THREE.Color('#e7e5dc');
    camera = new THREE.PerspectiveCamera(38, 1, 0.05, 180);
    camera.position.set(6, 6, 8.5);
    camera.up.set(0, 1, 0);
    camera.lookAt(controlsTarget);
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = false;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.style.touchAction = 'none';
    renderer.domElement.addEventListener('wheel', handleWheel, { passive: false });
    host.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight('#fffaf0', '#6e746a', 2.1));
    const key = new THREE.DirectionalLight('#fff6df', 3.0);
    key.position.set(-4, 8, 5);
    key.castShadow = false;
    scene.add(key);
    const grid = new THREE.GridHelper(18, 36, '#aeb2a3', '#c8c9be');
    grid.position.y = -0.006;
    scene.add(grid);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshBasicMaterial({ color: '#e7e5dc', side: THREE.DoubleSide }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.02;
    ground.userData.ground = true;
    scene.add(ground);
    modelGroup = new THREE.Group();
    overlayGroup = new THREE.Group();
    scene.add(modelGroup, overlayGroup);
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'Space' && !(event.target instanceof HTMLInputElement) && !(event.target instanceof HTMLTextAreaElement)) {
        spaceHeld = true;
        event.preventDefault();
      }
      if (event.key === 'Escape' && drag) {
        cancelActiveDrag();
      }
    };
    const onKeyUp = (event: KeyboardEvent) => { if (event.code === 'Space') spaceHeld = false; };
    const onWindowBlur = () => {
      spaceHeld = false;
      if (drag) cancelActiveDrag();
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onWindowBlur);
    resize();
    rebuildScene();

    return () => {
      observer.disconnect();
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onWindowBlur);
      spaceHeld = false;
      renderer?.domElement.removeEventListener('wheel', handleWheel);
      renderer?.dispose();
      scene?.traverse((node) => {
        if (node instanceof THREE.Mesh || node instanceof THREE.Line || node instanceof THREE.LineLoop) {
          node.geometry.dispose();
          const materials = Array.isArray(node.material) ? node.material : [node.material];
          materials.forEach((material) => material.dispose());
        }
      });
      renderer?.domElement.remove();
      scene = null;
      renderer = null;
      camera = null;
    };
  });

  $effect(() => {
    document.forms;
    document.finishes;
    document.attachments;
    evaluation;
    selectedFormId;
    selectedRoleKey;
    selectedAttachmentId;
    tool;
    workplane;
    draftPoints;
    interactionMode;
    if (scene) rebuildScene();
  });

  function setRay(event: PointerEvent | WheelEvent) {
    if (!renderer || !camera) return;
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
  }

  function surfaceUnderPointer(): SurfaceHit | null {
    if (!renderer || !camera) return null;
    setRayFromCurrentPointer();
    const hits = raycaster.intersectObjects(modelMeshes, false);
    const hit = hits[0];
    if (!hit || hit.faceIndex === undefined || hit.faceIndex === null) return null;
    const formId = hit.object.userData.formId as string;
    const roleKeyAtHit = (hit.object.userData.triangleRoleKeys as SourceRoleKey[] | undefined)?.[hit.faceIndex];
    const role = (hit.object.userData.roles as GeneratedRole[] | undefined)?.find((item) => item.key === roleKeyAtHit);
    if (!role) return null;
    return { formId, role, point: tuple3(hit.point) };
  }

  let lastPointerEvent: PointerEvent | null = null;
  function setRayFromCurrentPointer() {
    if (!lastPointerEvent) return;
    setRay(lastPointerEvent);
  }

  function currentNdc(event: PointerEvent) {
    if (!renderer) return new THREE.Vector2();
    const rect = renderer.domElement.getBoundingClientRect();
    return new THREE.Vector2(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
  }

  function pointOnFrame(frame: Frame, event: PointerEvent) {
    if (!renderer || !camera) return null;
    setRay(event);
    const plane = new THREE.Plane(unit(frame.normal), -unit(frame.normal).dot(vec3(frame.origin)));
    const point = raycaster.ray.intersectPlane(plane, new THREE.Vector3());
    return point;
  }

  function closestOnAxis(ray: THREE.Ray, origin: THREE.Vector3, axis: THREE.Vector3) {
    const d = ray.direction.clone().normalize();
    const a = axis.clone().normalize();
    const w0 = ray.origin.clone().sub(origin);
    const b = d.dot(a);
    const d0 = d.dot(w0);
    const e = a.dot(w0);
    const denominator = 1 - b * b;
    if (denominator < 0.08) return null;
    const axisParameter = (e - b * d0) / denominator;
    return origin.clone().addScaledVector(a, axisParameter);
  }

  function projectWorldToAxisLock(frame: Frame, event: PointerEvent, start: THREE.Vector3, lock: AxisLock, mode: 'plane' | 'space' = 'plane') {
    if (lock === 'none') {
      const hit = pointOnFrame(frame, event);
      return hit ? { point: hit, compatible: true } : { point: null, compatible: true };
    }
    if (!isAxisLockCompatible(frame, lock, mode)) return { point: null, compatible: false };
    const directionTuple = axisDirection(frame, lock);
    if (!directionTuple) return { point: null, compatible: false };
    const direction = vec3(directionTuple);
    if (!renderer || !camera) return { point: null, compatible: true };
    setRay(event);
    const point = closestOnAxis(raycaster.ray, start, direction);
    return point ? { point, compatible: true } : { point: null, compatible: true };
  }

  function snapLocal(point: Vec2) {
    if (!snapEnabled) return point;
    return [snapScalar(point[0], snapStep), snapScalar(point[1], snapStep)] as Vec2;
  }

  function profileCommand(formId: string, pointId: string, position: Vec2) {
    return { type: 'moveProfilePoint', formId, pointId, position };
  }

  function beginHandleDrag(event: PointerEvent, handle: THREE.Object3D) {
    const data = handle.userData as Record<string, unknown>;
    const formId = data.formId as string;
    const form = document.forms.find((item) => item.id === formId);
    if (!form) return;
    if (data.handle === 'profile-point') {
      const pointId = data.pointId as string;
      const profilePoint = form.profile.points.find((item) => item.id === pointId);
      if (!profilePoint) return;
      drag = { kind: 'profile-point', formId, pointId, frame: form.frame, original: profilePoint.position, latest: profilePoint.position };
    } else if (data.handle === 'height' && form.operation.kind === 'extrude') {
      drag = { kind: 'height', formId, frame: form.frame, profileCenter: data.profileCenter as Vec3, latest: form.operation.height };
    } else if (data.handle === 'revolve-angle' && form.operation.kind === 'revolve') {
      const center = vec3(data.center as Vec3);
      const normal = unit(form.frame.v);
      if (!renderer || !camera) return;
      setRay(event);
      const plane = new THREE.Plane(normal, -normal.dot(center));
      const intersection = raycaster.ray.intersectPlane(plane, new THREE.Vector3());
      if (!intersection) return;
      const startRadial = intersection.sub(center).normalize();
      drag = { kind: 'revolve', formId, frame: form.frame, center, startRadial, startAngle: form.operation.angleDegrees, latest: form.operation.angleDegrees };
    } else if (data.handle === 'carrier-point' && form.operation.kind === 'sweep') {
      const pointId = data.pointId as string;
      const point = form.operation.carrier.points.find((item) => item.id === pointId);
      if (!point) return;
      const anchor = form.operation.carrier.frameAnchor;
      const pathEditFrame: Frame = { origin: anchor.origin, u: anchor.normal, v: anchor.u, normal: anchor.v };
      drag = {
        kind: 'carrier-point', formId, pointId, frame: pathEditFrame,
        frameAnchor: { ...anchor, origin: [...anchor.origin] },
        formFrame: { origin: [...form.frame.origin], u: [...form.frame.u], v: [...form.frame.v], normal: [...form.frame.normal] },
        original: point.position, latest: point.position,
      };
    }
    activeHandle = handle;
    capturePointer(event);
    event.preventDefault();
  }

  function capturePointer(event: PointerEvent) {
    if (!renderer) return;
    renderer.domElement.setPointerCapture(event.pointerId);
    capturedPointerId = event.pointerId;
  }

  function releasePointer(event?: PointerEvent) {
    if (!renderer || capturedPointerId === null) return;
    const pointerId = event?.pointerId ?? capturedPointerId;
    if (renderer.domElement.hasPointerCapture(pointerId)) renderer.domElement.releasePointerCapture(pointerId);
    capturedPointerId = null;
  }

  function cancelActiveDrag() {
    if (drag && 'formId' in drag) onCancel();
    drag = null;
    activeHandle = null;
    handleParallel = false;
    releasePointer();
    invalidate();
    onStatus('Current gesture cancelled.');
  }

  function handlePointerDown(event: PointerEvent) {
    if (!renderer || !camera) return;
    lastPointerEvent = event;
    if (event.button === 2 || (event.button === 0 && spaceHeld)) {
      drag = { kind: 'orbit', pointerX: event.clientX, pointerY: event.clientY };
      capturePointer(event);
      event.preventDefault();
      return;
    }
    if (event.button !== 0) return;
    if (event.shiftKey) {
      drag = { kind: 'pan', pointerX: event.clientX, pointerY: event.clientY };
      capturePointer(event);
      event.preventDefault();
      return;
    }

    setRay(event);
    const handles = raycaster.intersectObjects(handleObjects, false);
    if (tool === 'select' && handles.length > 0) {
      beginHandleDrag(event, handles[0]!.object);
      return;
    }

    if (tool === 'draw') {
      if (!workplane) {
        const surface = surfaceUnderPointer();
        if (surface?.role.frame && (surface.role.kind === 'face' || surface.role.kind === 'cap')) {
          onSelect(surface);
          onLatchPlane({ target: { kind: 'form-role', formId: surface.formId, partKey: surface.role.address.partKey }, frame: surface.role.frame, label: surface.role.label });
          onDraftPoint(snapLocal(localFromWorld(surface.role.frame, vec3(surface.point))));
          onStatus(`Profile plane latched to ${surface.role.label}; first point placed. Continue the profile.`);
          return;
        }
        if (surface) {
          onStatus(`${surface.role.label} is not a planar host surface. Choose a flat face or cap.`);
          return;
        }
        const groundHit = raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), new THREE.Vector3());
        if (groundHit) {
          onSelect(null);
          onLatchPlane({ target: { kind: 'fixture-plane', fixtureId: 'workspace', planeKey: 'ground' }, frame: groundFrame, label: 'Ground plane' });
          onDraftPoint(snapLocal(localFromWorld(groundFrame, groundHit)));
          onStatus('Ground plane latched; first point placed. Continue the profile.');
          return;
        }
        onStatus('Choose the ground or a planar face to latch a drawing surface.');
        return;
      }
      if (event.detail >= 2 && draftPoints.length >= 3) {
        onCloseProfile();
        return;
      }
      const planePoint = pointOnFrame(workplane.frame, event);
      if (!planePoint) {
        onStatus('Pointer ray is parallel to the latched plane. Move to a clearer view or return to perspective.');
        return;
      }
      const rawLocal = localFromWorld(workplane.frame, planePoint);
      if (draftPoints.length >= 3) {
        const firstWorld = worldFromLocal(workplane.frame, draftPoints[0]!);
        const rect = renderer.domElement.getBoundingClientRect();
        const a = firstWorld.clone().project(camera);
        const sx = rect.left + (a.x + 1) * rect.width / 2;
        const sy = rect.top + (1 - a.y) * rect.height / 2;
        if (Math.hypot(event.clientX - sx, event.clientY - sy) < 15) {
          onCloseProfile();
          return;
        }
      }
      let local: Vec2;
      if (draftPoints.length > 0 && axisLock !== 'none') {
        const previous = worldFromLocal(workplane.frame, draftPoints[draftPoints.length - 1]!);
        const constrained = constrainWorldPointToAxis(
          workplane.frame,
          tuple3(previous),
          tuple3(planePoint),
          axisLock,
          'plane',
          snapEnabled ? snapStep : undefined,
        );
        if (!constrained.compatible || !constrained.point) {
          onStatus(`Lock ${axisLock.toUpperCase()} is not tangent to this profile plane. Choose another tangent world axis or local U/V.`);
          return;
        }
        local = localFromWorld(workplane.frame, vec3(constrained.point));
      } else {
        // The first point establishes the origin; axis locks apply to later points.
        local = snapLocal(rawLocal);
      }
      onDraftPoint(local);
      return;
    }

    const attachHits = raycaster.intersectObjects(attachmentObjects, false);
    if (attachHits.length > 0) {
      onSelectAttachment(attachHits[0]!.object.userData.attachmentId as string);
      return;
    }
    const surface = surfaceUnderPointer();
    onSelectAttachment(null);
    onSelect(surface);
  }

  function handlePointerMove(event: PointerEvent) {
    lastPointerEvent = event;
    if (!renderer || !camera) return;
    if (!drag) {
      if (tool === 'draw' && !workplane) {
        setRay(event);
        const surface = surfaceUnderPointer();
        if (surface?.role.frame && (surface.role.kind === 'face' || surface.role.kind === 'cap')) {
          const key = `${surface.formId}:${surface.role.key}`;
          updateHoverPlane(key, { target: { kind: 'form-role', formId: surface.formId, partKey: surface.role.address.partKey }, frame: surface.role.frame, label: surface.role.label });
        } else if (!surface) {
          const groundHit = raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), new THREE.Vector3());
          updateHoverPlane(groundHit ? 'fixture:workspace:ground' : null, groundHit ? { target: { kind: 'fixture-plane', fixtureId: 'workspace', planeKey: 'ground' }, frame: groundFrame, label: 'Ground plane' } : null);
        } else {
          updateHoverPlane(null, null);
        }
      } else if (hoverPlaneKey) updateHoverPlane(null, null);
      return;
    }
    const activeDrag = drag;
    if (activeDrag.kind === 'orbit' || activeDrag.kind === 'pan') {
      const dx = event.clientX - activeDrag.pointerX;
      const dy = event.clientY - activeDrag.pointerY;
      activeDrag.pointerX = event.clientX;
      activeDrag.pointerY = event.clientY;
      if (activeDrag.kind === 'orbit') {
        const offset = camera.position.clone().sub(controlsTarget);
        const spherical = new THREE.Spherical().setFromVector3(offset);
        spherical.theta -= dx * 0.006;
        spherical.phi = THREE.MathUtils.clamp(spherical.phi + dy * 0.006, 0.06, Math.PI - 0.06);
        offset.setFromSpherical(spherical);
        camera.position.copy(controlsTarget).add(offset);
        camera.lookAt(controlsTarget);
      } else {
        const distance = camera.position.distanceTo(controlsTarget);
        const worldPerPixel = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * distance / Math.max(1, host.clientHeight);
        const right = new THREE.Vector3().setFromMatrixColumn(camera.matrix, 0).normalize();
        const up = new THREE.Vector3().setFromMatrixColumn(camera.matrix, 1).normalize();
        const delta = right.multiplyScalar(-dx * worldPerPixel).addScaledVector(up, dy * worldPerPixel);
        camera.position.add(delta);
        controlsTarget.add(delta);
        camera.lookAt(controlsTarget);
      }
      invalidate();
      return;
    }
    if (!('formId' in activeDrag)) return;
    const form = document.forms.find((item) => item.id === activeDrag.formId);
    if (!form) return;
    if (activeDrag.kind === 'profile-point') {
      const start = worldFromLocal(activeDrag.frame, activeDrag.original);
      const projected = projectWorldToAxisLock(activeDrag.frame, event, start, axisLock, 'plane');
      if (!projected.compatible) {
        handleParallel = true;
        onStatus(`Lock ${axisLock.toUpperCase()} is perpendicular to this profile plane; choose another lock or release it.`);
        return;
      }
      handleParallel = false;
      if (!projected.point) return;
      let position: Vec2;
      if (axisLock === 'none') {
        position = snapLocal(localFromWorld(activeDrag.frame, projected.point));
      } else {
        const constrained = constrainWorldPointToAxis(
          activeDrag.frame,
          tuple3(start),
          tuple3(projected.point),
          axisLock,
          'plane',
          snapEnabled ? snapStep : undefined,
        );
        if (!constrained.compatible || !constrained.point) {
          handleParallel = true;
          onStatus(`Lock ${axisLock.toUpperCase()} is not tangent to this profile plane. Choose another tangent world axis or local U/V.`);
          return;
        }
        position = localFromWorld(activeDrag.frame, vec3(constrained.point));
      }
      activeDrag.latest = position;
      onPreview(profileCommand(activeDrag.formId, activeDrag.pointId, position));
      return;
    }
    if (activeDrag.kind === 'height' && form.operation.kind === 'extrude') {
      setRay(event);
      const base = vec3(activeDrag.profileCenter);
      const point = closestOnAxis(raycaster.ray, base.clone().addScaledVector(unit(activeDrag.frame.normal), form.operation.height), unit(activeDrag.frame.normal));
      if (!point) {
        handleParallel = true;
        onStatus('Height ray is nearly parallel to the view. Orbit a little or use the height field.');
        return;
      }
      handleParallel = false;
      let height = point.clone().sub(base).dot(unit(activeDrag.frame.normal));
      if (snapEnabled) height = snapScalar(height, snapStep);
      height = Math.max(0.01, height);
      activeDrag.latest = height;
      onPreview({ type: 'patchForm', formId: activeDrag.formId, patch: { operation: { kind: 'extrude', height } } });
      return;
    }
    if (activeDrag.kind === 'revolve' && form.operation.kind === 'revolve') {
      setRay(event);
      const axis = unit(activeDrag.frame.v);
      const plane = new THREE.Plane(axis, -axis.dot(activeDrag.center));
      const hit = raycaster.ray.intersectPlane(plane, new THREE.Vector3());
      if (!hit) {
        handleParallel = true;
        onStatus('Turn ring is edge-on. Orbit to a clearer view or type the angle.');
        return;
      }
      handleParallel = false;
      const radial = hit.sub(activeDrag.center).normalize();
      const signed = Math.atan2(axis.dot(new THREE.Vector3().crossVectors(activeDrag.startRadial, radial)), activeDrag.startRadial.dot(radial));
      let angle = THREE.MathUtils.clamp(activeDrag.startAngle + THREE.MathUtils.radToDeg(signed), 1, 360);
      angle = snapScalar(angle, 5);
      angle = THREE.MathUtils.clamp(angle, 1, 360);
      activeDrag.latest = angle;
      onPreview({ type: 'patchForm', formId: activeDrag.formId, patch: { operation: { kind: 'revolve', angleDegrees: angle } } });
      return;
    }
    if (activeDrag.kind === 'carrier-point' && form.operation.kind === 'sweep') {
      const hit = projectWorldToAxisLock(activeDrag.frame, event, vec3(activeDrag.original), axisLock, 'space');
      if (!hit.compatible) {
        handleParallel = true;
        onStatus(`Lock ${axisLock.toUpperCase()} is unavailable for this carrier frame.`);
        return;
      }
      handleParallel = false;
      if (!hit.point) return;
      let updated = hit.point;
      if (axisLock !== 'none') {
        const constrained = constrainWorldPointToAxis(
          activeDrag.frame,
          activeDrag.original,
          tuple3(hit.point),
          axisLock,
          'space',
          snapEnabled ? snapStep : undefined,
        );
        if (!constrained.compatible || !constrained.point) return;
        updated = vec3(constrained.point);
      } else if (snapEnabled) {
        const local = localFromFrame3(activeDrag.frame, updated);
        updated = vec3(activeDrag.frame.origin)
          .addScaledVector(unit(activeDrag.frame.u), snapScalar(local[0], snapStep))
          .addScaledVector(unit(activeDrag.frame.v), snapScalar(local[1], snapStep))
          .addScaledVector(unit(activeDrag.frame.normal), snapScalar(local[2], snapStep));
      }
      const position = tuple3(updated);
      activeDrag.latest = position;
      const pointId = activeDrag.pointId;
      const formId = activeDrag.formId;
      const pointDelta: Vec3 = [position[0] - activeDrag.original[0], position[1] - activeDrag.original[1], position[2] - activeDrag.original[2]];
      const carrier = {
        ...form.operation.carrier,
        points: form.operation.carrier.points.map((point) => point.id === pointId ? { ...point, position } : point),
        frameAnchor: pointId === form.operation.carrier.frameAnchorPointId
          ? { ...form.operation.carrier.frameAnchor, origin: [activeDrag.frameAnchor.origin[0] + pointDelta[0], activeDrag.frameAnchor.origin[1] + pointDelta[1], activeDrag.frameAnchor.origin[2] + pointDelta[2]] as Vec3 }
          : form.operation.carrier.frameAnchor,
      };
      const operation = { ...form.operation, carrier };
      const patch = pointId === form.operation.carrier.frameAnchorPointId
        ? { operation, frame: { ...activeDrag.formFrame, origin: [
            activeDrag.formFrame.origin[0] + pointDelta[0],
            activeDrag.formFrame.origin[1] + pointDelta[1],
            activeDrag.formFrame.origin[2] + pointDelta[2],
          ] as Vec3 } }
        : { operation };
      onPreview({ type: 'patchForm', formId, patch });
    }
  }

  function updateHoverPlane(key: string | null, plane: Workplane | null) {
    if (key === hoverPlaneKey) return;
    hoverPlaneKey = key;
    hoverPlane = plane;
    rebuildScene();
  }

  function localFromFrame3(frame: Frame, point: THREE.Vector3): [number, number, number] {
    const delta = point.clone().sub(vec3(frame.origin));
    return [delta.dot(unit(frame.u)), delta.dot(unit(frame.v)), delta.dot(unit(frame.normal))];
  }

  function handlePointerUp(event: PointerEvent) {
    if (!drag) return;
    const current = drag;
    drag = null;
    activeHandle = null;
    handleParallel = false;
    if (current.kind === 'profile-point') onCommit(profileCommand(current.formId, current.pointId, current.latest));
    else if (current.kind === 'height') onCommit({ type: 'patchForm', formId: current.formId, patch: { operation: { kind: 'extrude', height: current.latest } } });
    else if (current.kind === 'revolve') onCommit({ type: 'patchForm', formId: current.formId, patch: { operation: { kind: 'revolve', angleDegrees: current.latest } } });
    else if (current.kind === 'carrier-point') {
      const form = document.forms.find((item) => item.id === current.formId);
      if (form?.operation.kind === 'sweep') {
        const pointDelta: Vec3 = [current.latest[0] - current.original[0], current.latest[1] - current.original[1], current.latest[2] - current.original[2]];
        const carrier = {
          ...form.operation.carrier,
          points: form.operation.carrier.points.map((point) => point.id === current.pointId ? { ...point, position: current.latest } : point),
          frameAnchor: current.pointId === form.operation.carrier.frameAnchorPointId
            ? { ...form.operation.carrier.frameAnchor, origin: [current.frameAnchor.origin[0] + pointDelta[0], current.frameAnchor.origin[1] + pointDelta[1], current.frameAnchor.origin[2] + pointDelta[2]] as Vec3 }
            : form.operation.carrier.frameAnchor,
        };
        const operation = { ...form.operation, carrier };
        const patch = current.pointId === form.operation.carrier.frameAnchorPointId
          ? { operation, frame: { ...current.formFrame, origin: [
              current.formFrame.origin[0] + pointDelta[0],
              current.formFrame.origin[1] + pointDelta[1],
              current.formFrame.origin[2] + pointDelta[2],
            ] as Vec3 } }
          : { operation };
        onCommit({ type: 'patchForm', formId: current.formId, patch });
      }
    }
    invalidate();
    releasePointer(event);
  }

  function handlePointerCancel(event: PointerEvent) {
    if (!drag) return;
    cancelActiveDrag();
    releasePointer(event);
  }

  function handleLostPointerCapture(event: PointerEvent) {
    if (capturedPointerId !== event.pointerId) return;
    capturedPointerId = null;
    if (drag) cancelActiveDrag();
  }

  function handleWheel(event: WheelEvent) {
    if (!camera) return;
    event.preventDefault();
    const direction = camera.position.clone().sub(controlsTarget);
    direction.multiplyScalar(Math.exp(event.deltaY * 0.001));
    direction.setLength(THREE.MathUtils.clamp(direction.length(), 1.4, 45));
    camera.position.copy(controlsTarget).add(direction);
    camera.lookAt(controlsTarget);
    invalidate();
  }

  function handleDoubleClick(event: MouseEvent) {
    if (tool === 'draw' && workplane && draftPoints.length >= 3) onCloseProfile();
  }

  function handleContextMenu(event: MouseEvent) {
    event.preventDefault();
  }

  function setCameraView(mode: 'perspective' | 'plan' | 'face') {
    if (!camera) return;
    if (mode === 'perspective') {
      if (cameraMode !== 'perspective') {
        if (previousCamera) {
          camera.position.copy(previousCamera.position);
          controlsTarget.copy(previousCamera.target);
          camera.up.copy(previousCamera.up);
          camera.fov = previousCamera.fov;
        } else {
          camera.position.set(6, 6, 8.5);
          controlsTarget.set(0, 0.8, 0);
          camera.up.set(0, 1, 0);
          camera.fov = 38;
        }
        camera.lookAt(controlsTarget);
        camera.updateProjectionMatrix();
      }
      previousCamera = null;
      cameraMode = 'perspective';
      onCameraMode(cameraMode);
      invalidate();
      return;
    }

    if (mode === 'face' && !selectedFormId) {
      onStatus('Select a form to align the reading view to its profile plane.');
      return;
    }
    if (cameraMode === 'perspective') {
      previousCamera = { position: camera.position.clone(), target: controlsTarget.clone(), up: camera.up.clone(), fov: camera.fov };
    }
    camera.fov = 24;
    if (mode === 'plan') {
      const distance = Math.max(8, camera.position.distanceTo(controlsTarget));
      camera.position.copy(controlsTarget).add(new THREE.Vector3(0, distance, 0.01));
      camera.up.set(0, 0, -1);
    } else {
      const form = document.forms.find((item) => item.id === selectedFormId);
      if (!form) {
        onStatus('Select a form to align the reading view to its profile plane.');
        return;
      }
      const positions = evaluation.forms[form.id]?.mesh.positions ?? [];
      const bounds = new THREE.Box3();
      for (let i = 0; i < positions.length; i += 3) bounds.expandByPoint(new THREE.Vector3(positions[i]!, positions[i + 1]!, positions[i + 2]!));
      const center = bounds.isEmpty() ? vec3(form.frame.origin) : bounds.getCenter(new THREE.Vector3());
      const radius = bounds.isEmpty() ? 1 : Math.max(0.5, bounds.getBoundingSphere(new THREE.Sphere()).radius);
      const normal = unit(form.frame.normal);
      camera.position.copy(center).addScaledVector(normal, Math.max(3, radius * 3.25));
      camera.up.copy(unit(form.frame.v));
      controlsTarget.copy(center);
    }
    camera.lookAt(controlsTarget);
    camera.updateProjectionMatrix();
    cameraMode = mode;
    onCameraMode(cameraMode);
    invalidate();
  }

  export function setView(mode: 'perspective' | 'plan' | 'face') { setCameraView(mode); }
  export function zoom(factor: number) {
    if (!camera) return;
    const offset = camera.position.clone().sub(controlsTarget).multiplyScalar(factor);
    offset.setLength(THREE.MathUtils.clamp(offset.length(), 1.4, 45));
    camera.position.copy(controlsTarget).add(offset);
    camera.lookAt(controlsTarget);
    invalidate();
  }
  export function focusAll() {
    if (!camera) return;
    const bounds = new THREE.Box3();
    modelMeshes.forEach((mesh) => bounds.expandByObject(mesh));
    if (bounds.isEmpty()) {
      controlsTarget.set(0, 0.8, 0);
    } else {
      const sphere = bounds.getBoundingSphere(new THREE.Sphere());
      controlsTarget.copy(sphere.center);
      camera.position.copy(sphere.center).add(new THREE.Vector3(6, 5, 8).normalize().multiplyScalar(Math.max(4, sphere.radius * 3.35)));
    }
    camera.lookAt(controlsTarget);
    invalidate();
  }
  export function getDiagnostics() {
    return {
      camera: camera ? { position: tuple3(camera.position), target: tuple3(controlsTarget), up: tuple3(camera.up), fov: camera.fov, mode: cameraMode } : null,
      handles: handleObjects.map((handle) => ({
        kind: handle.userData.handle as string,
        formId: handle.userData.formId as string,
        pointId: handle.userData.pointId as string | undefined,
        screen: screenPoint(handle.position),
      })),
      activeHandleNearParallel: handleParallel,
      workplane: workplane ? { label: workplane.label, target: workplane.target } : null,
    };
  }

  function screenPoint(point: THREE.Vector3) {
    if (!camera || !renderer) return null;
    const projected = point.clone().project(camera);
    const rect = renderer.domElement.getBoundingClientRect();
    return {
      x: Math.round(rect.left + (projected.x + 1) * rect.width / 2),
      y: Math.round(rect.top + (1 - projected.y) * rect.height / 2),
      clientX: Math.round(rect.left + (projected.x + 1) * rect.width / 2),
      clientY: Math.round(rect.top + (1 - projected.y) * rect.height / 2),
    };
  }
</script>

<div
  class="canvas-host"
  role="region"
  aria-label="Interactive 3D form viewport"
  bind:this={host}
  onpointerdown={handlePointerDown}
  onpointermove={handlePointerMove}
  onpointerup={handlePointerUp}
  onpointercancel={handlePointerCancel}
  onlostpointercapture={handleLostPointerCapture}
  ondblclick={handleDoubleClick}
  oncontextmenu={handleContextMenu}
>
  {@render children?.()}
</div>
