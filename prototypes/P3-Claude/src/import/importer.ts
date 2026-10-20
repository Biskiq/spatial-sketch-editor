// Imported architecture: a building modelled elsewhere arrives as fixed geometry. It can be inspected, sliced,
// furnished, walked and told — but not revised. To revise part of it, trace over it with the pen.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Stage } from '../scene/stage';

function box(cx: number, cy: number, cz: number, sx: number, sy: number, sz: number) {
  const g = new THREE.BoxGeometry(sx, sy, sz);
  g.translate(cx, cy, cz);
  return g.toNonIndexed();
}

function gableRoof(x0: number, x1: number, z0: number, z1: number, eave: number, ridge: number, t = 0.25) {
  const pos: number[] = [];
  const zc = (z0 + z1) / 2;
  const q = (a: number[], b: number[], c: number[], d: number[]) => pos.push(...a, ...b, ...c, ...a, ...c, ...d);
  q([x0, eave, z0], [x1, eave, z0], [x1, ridge, zc], [x0, ridge, zc]);
  q([x1, eave, z1], [x0, eave, z1], [x0, ridge, zc], [x1, ridge, zc]);
  q([x0, eave - t, z0], [x0, ridge - t, zc], [x1, ridge - t, zc], [x1, eave - t, z0]);
  q([x1, eave - t, z1], [x1, ridge - t, zc], [x0, ridge - t, zc], [x0, eave - t, z1]);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

/** A prepared stand-in for "a building modelled elsewhere": one merged mesh, no walls or rooms inside it. */
export function preparedBoathouse(): THREE.Group {
  const parts: THREE.BufferGeometry[] = [];
  const x0 = -7, x1 = 7, z0 = -4.5, z1 = 4.5, H = 4.2, t = 0.3;
  parts.push(box(0, 0.1, 0, 14.6, 0.2, 9.6)); // floor slab
  // long walls with a run of openings (modelled as separate pieces — the way exported meshes often arrive)
  for (const z of [z0, z1]) {
    let x = x0;
    const doors = [-4, 0, 4];
    for (const dx of doors) {
      parts.push(box((x + dx - 0.9) / 2, H / 2, z, dx - 0.9 - x, H, t));
      parts.push(box(dx, H - 0.6, z, 1.8, 1.2, t));
      x = dx + 0.9;
    }
    parts.push(box((x + x1) / 2, H / 2, z, x1 - x, H, t));
  }
  // gable ends
  parts.push(box(x0, H / 2, 0, t, H, 9));
  const gable = new THREE.BufferGeometry();
  const gp = [x0, H, z0, x0, H, z1, x0, H + 2.6, 0, x1, H, z1, x1, H, z0, x1, H + 2.6, 0];
  gable.setAttribute('position', new THREE.Float32BufferAttribute(gp, 3));
  gable.computeVertexNormals();
  parts.push(gable);
  parts.push(box(x1, 1.4, 0, t, 2.8, 9));
  parts.push(box(x1, 3.6, -3.3, t, 1.2, 2.4));
  parts.push(box(x1, 3.6, 3.3, t, 1.2, 2.4));
  parts.push(gableRoof(x0 - 0.5, x1 + 0.5, z0 - 0.6, z1 + 0.6, H, H + 2.6));
  // a jetty
  parts.push(box(x1 + 5, 0.15, 0, 9, 0.3, 2.4));
  for (const x of [x1 + 2, x1 + 5, x1 + 8]) for (const z of [-1, 1]) parts.push(box(x, -0.3, z, 0.25, 0.9, 0.25));
  const merged = mergeGeometries(parts.map((g) => (g.index ? g.toNonIndexed() : g)).map((g) => {
    g.deleteAttribute('uv');
    return g;
  }), false)!;
  merged.computeVertexNormals();
  const grp = new THREE.Group();
  grp.add(new THREE.Mesh(merged));
  grp.position.set(0, 0, 14);
  grp.name = 'Old boathouse (imported)';
  return grp;
}

export async function loadGLB(file: File): Promise<THREE.Group> {
  const buf = await file.arrayBuffer();
  const loader = new GLTFLoader();
  const gltf = await loader.parseAsync(buf, '');
  const g = new THREE.Group();
  g.add(gltf.scene);
  g.updateMatrixWorld(true);
  const bb = new THREE.Box3().setFromObject(g);
  const size = bb.getSize(new THREE.Vector3());
  const maxD = Math.max(size.x, size.y, size.z);
  // guess units: centimetres and millimetres arrive huge
  let k = 1;
  if (maxD > 2000) k = 0.001;
  else if (maxD > 250) k = 0.01;
  g.scale.setScalar(k);
  g.updateMatrixWorld(true);
  const bb2 = new THREE.Box3().setFromObject(g);
  const c = bb2.getCenter(new THREE.Vector3());
  g.position.set(-c.x, -bb2.min.y, -c.z + 14);
  g.name = file.name.replace(/\.(glb|gltf)$/i, '') + ' (imported)';
  return g;
}

const underlayFill = new THREE.MeshBasicMaterial({ color: '#9a8f7e', transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide });
const underlayEdge = new THREE.LineBasicMaterial({ color: '#7d7466', transparent: true, opacity: 0.55, depthWrite: false });

/** Put an imported group on the table: solid, dressed like the rest of the model — or as tracing paper to draw over. */
export function attachImport(stage: Stage, g: THREE.Group, display: 'solid' | 'underlay') {
  if (stage.importObject) stage.importObject.removeFromParent();
  const m = stage.m;
  const under = display === 'underlay';
  g.traverse((o: any) => {
    if (!o.isMesh) return;
    o.material = under ? underlayFill : m.imported;
    o.castShadow = !under;
    o.receiveShadow = !under;
    // an underlay is not pickable: the pen draws through it onto the table
    o.userData = under ? { underlay: true } : { isImport: true, kind: 'import', id: 'import' };
    let e = o.children.find((c: any) => c.userData?.isImportEdge);
    if (!e) {
      e = new THREE.LineSegments(new THREE.EdgesGeometry(o.geometry, 30), m.edge);
      e.userData = { isImportEdge: true };
      o.add(e);
    }
    e.material = under ? underlayEdge : m.edge;
  });
  stage.importObject = g;
  stage.root.add(g);
}

export function detachImport(stage: Stage) {
  if (stage.importObject) stage.importObject.removeFromParent();
  stage.importObject = null;
}
