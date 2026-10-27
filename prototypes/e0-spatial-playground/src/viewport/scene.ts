// Three.js mesh builders and disposal. Regenerated from the evaluation on every change.
import * as THREE from 'three';
import { ARRIVAL, FLOOR_HALF } from '../model/fixture';
import type { E0Document, Entrance, Pose, Vec2 } from '../model/types';

export const COLORS = {
  floor: 0xf1ede2,
  outside: 0xe2ddcf,
  grid: 0xd9d3c3,
  floorEdge: 0x8a8370,
  arrival: 0xd8a657,
  guide: 0x2f6f8f,
  guideActive: 0x1d8fd1,
  guideInvalid: 0xc4452f,
  band: 0x8c7a63,
  scope: 0x1d8fd1,
  select: 0xe0a21a,
  pieces: { main: 0x9b3d2e, b: 0x5d7a63, c: 0x4f6378 } as Record<string, number>,
};

export function disposeGroup(group: THREE.Object3D) {
  for (const child of [...group.children]) {
    group.remove(child);
    child.traverse((node) => {
      const n = node as THREE.Mesh;
      if (n.geometry) n.geometry.dispose();
      const mats = n.material ? (Array.isArray(n.material) ? n.material : [n.material]) : [];
      for (const m of mats) {
        (m as THREE.SpriteMaterial).map?.dispose();
        m.dispose();
      }
    });
  }
}

const flat = (color: number, opacity = 1) =>
  new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity, depthWrite: opacity === 1, side: THREE.DoubleSide });

/** Horizontal polygon at height y from floor coordinates (x, z). */
export function floorPolygon(points: Vec2[], y: number, material: THREE.Material): THREE.Mesh {
  const shape = new THREE.Shape(points.map(([x, z]) => new THREE.Vector2(x, -z)));
  const geo = new THREE.ShapeGeometry(shape);
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, y, 0);
  return new THREE.Mesh(geo, material);
}

export function outline(points: Vec2[], y: number, color: number, closed = true): THREE.Line {
  const verts = points.map(([x, z]) => new THREE.Vector3(x, y, z));
  if (closed) verts.push(verts[0].clone());
  const geo = new THREE.BufferGeometry().setFromPoints(verts);
  return new THREE.Line(geo, new THREE.LineBasicMaterial({ color }));
}

/** Flat strip along a polyline, used for the guide and its (wider, invisible) hit area. */
export function ribbon(points: Vec2[], width: number, y: number, material: THREE.Material): THREE.Mesh {
  const group: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const [ax, az] = points[i];
    const [bx, bz] = points[i + 1];
    const l = Math.hypot(bx - ax, bz - az) || 1;
    const nx = (-(bz - az) / l) * (width / 2);
    const nz = ((bx - ax) / l) * (width / 2);
    const base = group.length / 3;
    group.push(ax + nx, y, az + nz, ax - nx, y, az - nz, bx + nx, y, bz + nz, bx - nx, y, bz - nz);
    idx.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(group, 3));
  geo.setIndex(idx);
  material.side = THREE.DoubleSide;
  return new THREE.Mesh(geo, material);
}

export function bandMesh(outlinePts: Vec2[], height: number, color: number, opacity = 1): THREE.Mesh {
  const shape = new THREE.Shape(outlinePts.map(([x, z]) => new THREE.Vector2(x, -z)));
  const geo = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false });
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.85, transparent: opacity < 1, opacity });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

export function pieceMesh(piece: { width: number; depth: number; height: number }, pose: Pose, color: number, main: boolean): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(piece.width, piece.height, piece.depth),
    new THREE.MeshStandardMaterial({ color, roughness: 0.6 }),
  );
  body.position.y = piece.height / 2;
  body.castShadow = true;
  body.receiveShadow = true;
  g.add(body);
  // Front plaque on local +Z so orientation reads in Plan and 3D.
  const plaque = new THREE.Mesh(
    new THREE.BoxGeometry(piece.width * 0.6, Math.min(0.12, piece.height * 0.3), 0.02),
    new THREE.MeshStandardMaterial({ color: 0xf6f1e3, roughness: 0.4 }),
  );
  plaque.position.set(0, piece.height * 0.62, piece.depth / 2 + 0.011);
  g.add(plaque);
  if (main) {
    const crown = new THREE.Mesh(
      new THREE.BoxGeometry(piece.width * 0.7, 0.08, piece.depth * 0.7),
      new THREE.MeshStandardMaterial({ color: 0xd8a657, roughness: 0.3, metalness: 0.3 }),
    );
    crown.position.y = piece.height + 0.04;
    crown.castShadow = true;
    g.add(crown);
  }
  // Front tick on the floor (useful in Plan).
  const tick = floorPolygon([[-0.06, piece.depth / 2 + 0.02], [0.06, piece.depth / 2 + 0.02], [0, piece.depth / 2 + 0.12]], 0.004, flat(color));
  g.add(tick);
  g.position.set(pose.x, 0, pose.z);
  g.rotation.y = pose.yaw;
  return g;
}

export function labelSprite(text: string, bg: string, size = 0.28): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 96;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.arc(48, 48, 44, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = '600 52px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 48, 52);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false }));
  sprite.scale.set(size, size, 1);
  sprite.renderOrder = 10;
  return sprite;
}

export function handle(position: THREE.Vector3, color: number, userData: Record<string, unknown>, radius = 0.07): THREE.Mesh {
  const m = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 20, 14),
    new THREE.MeshBasicMaterial({ color, depthTest: false }),
  );
  m.position.copy(position);
  m.renderOrder = 12;
  m.userData = userData;
  return m;
}

export function environment(entrance: Entrance): THREE.Group {
  const g = new THREE.Group();
  const outside = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshStandardMaterial({ color: COLORS.outside, roughness: 1 }));
  outside.rotation.x = -Math.PI / 2;
  outside.position.y = -0.002;
  outside.receiveShadow = true;
  g.add(outside);
  const F = FLOOR_HALF;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(2 * F, 2 * F), new THREE.MeshStandardMaterial({ color: COLORS.floor, roughness: 0.95 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  g.add(floor);
  const grid = new THREE.GridHelper(2 * F, 12, COLORS.grid, COLORS.grid);
  grid.position.y = 0.001;
  g.add(grid);
  g.add(outline([[-F, -F], [F, -F], [F, F], [-F, F]], 0.003, COLORS.floorEdge));
  const r = ARRIVAL[entrance];
  const patch: Vec2[] = [[r.minX, r.minZ], [r.maxX, r.minZ], [r.maxX, r.maxZ], [r.minX, r.maxZ]];
  g.add(floorPolygon(patch, 0.002, flat(COLORS.arrival, 0.35)));
  g.add(outline(patch, 0.004, COLORS.arrival));
  // Entrance arrow just outside the floor edge, pointing in.
  const arrow: Vec2[] = entrance === 'south'
    ? [[-0.35, -F - 0.75], [0.35, -F - 0.75], [0.35, -F - 0.35], [0.6, -F - 0.35], [0, -F - 0.05], [-0.6, -F - 0.35], [-0.35, -F - 0.35]]
    : [[F + 0.75, -0.35], [F + 0.75, 0.35], [F + 0.35, 0.35], [F + 0.35, 0.6], [F + 0.05, 0], [F + 0.35, -0.6], [F + 0.35, -0.35]];
  g.add(floorPolygon(arrow, 0.003, flat(COLORS.arrival)));
  return g;
}

export const pieceColor = (doc: E0Document, id: string) => {
  const i = doc.pieces.findIndex((p) => p.id === id);
  return [COLORS.pieces.main, COLORS.pieces.b, COLORS.pieces.c][i] ?? 0x888888;
};
