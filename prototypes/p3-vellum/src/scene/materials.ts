// The drafting-table look: card, ink, graphite pencil, red pencil, blue pencil.
import * as THREE from 'three';
import type { Palette } from '../model/types';

export const INK = '#1f1c19';
export const PENCIL = '#8b857c';
export const RED = '#d9472b';
export const BLUE = '#2f4bd8';
export const PAPER = '#ece6db';
export const POCHE = '#2a2522';

export interface PaletteColors {
  wall: string;
  floor: string;
  plinth: string;
  roof: string;
  roofUnder: string;
  deck: string;
  stair: string;
  post: string;
  ceiling: string;
  edge: string;
  table: string;
}

export const PALETTES: Record<Palette, PaletteColors> = {
  card: { wall: '#f7f4ee', floor: '#e8e0d2', plinth: '#efe9df', roof: '#f3efe8', roofUnder: '#ece6dc', deck: '#efe8dc', stair: '#f1ece3', post: '#f4f0e9', ceiling: '#f5f2ec', edge: '#2a2622', table: '#e4dccd' },
  basswood: { wall: '#ecd5ae', floor: '#d8b98a', plinth: '#e3c89e', roof: '#e6cda3', roofUnder: '#dfc39a', deck: '#dcbd8e', stair: '#e2c597', post: '#e9d0a6', ceiling: '#eed9b6', edge: '#5b4427', table: '#e7ddd0' },
  concrete: { wall: '#d3d0ca', floor: '#bdb8b0', plinth: '#c8c4bd', roof: '#cbc7c0', roofUnder: '#c2beb7', deck: '#c4c0b9', stair: '#ccc8c1', post: '#d0ccc6', ceiling: '#d8d5d0', edge: '#34322f', table: '#e4dfd6' },
  terracotta: { wall: '#ecc3aa', floor: '#dcc5ad', plinth: '#e3b89c', roof: '#c97b5c', roofUnder: '#d99a7c', deck: '#d9b597', stair: '#e3bca1', post: '#e8c3ab', ceiling: '#f0d3c0', edge: '#4c2c20', table: '#e8ded2' },
};

/** Shared clipping planes: solids keep below the cut and on the kept side of a slice; ghosts show the rest. */
export const clip = {
  cut: new THREE.Plane(new THREE.Vector3(0, -1, 0), 1e5),
  slice: new THREE.Plane(new THREE.Vector3(1, 0, 0), 1e5),
  cutInv: new THREE.Plane(new THREE.Vector3(0, 1, 0), -1e5),
  sliceInv: new THREE.Plane(new THREE.Vector3(-1, 0, 0), -1e5),
  floor: new THREE.Plane(new THREE.Vector3(0, 1, 0), 1e5),
  floorInv: new THREE.Plane(new THREE.Vector3(0, -1, 0), -1e5),
};
export const solidPlanes = [clip.cut, clip.slice, clip.floor];
export const ghostPlanes = [clip.cutInv, clip.sliceInv, clip.floorInv];

/** Focus Height: below this height turns to pencil ghost (null: nothing). */
export function setFloorCut(y: number | null) {
  const c = y ?? -1e5;
  clip.floor.set(new THREE.Vector3(0, 1, 0), -c);
  clip.floorInv.set(new THREE.Vector3(0, -1, 0), c);
}

export function setCut(y: number | null) {
  const c = y ?? 1e5;
  clip.cut.set(new THREE.Vector3(0, -1, 0), c);
  clip.cutInv.set(new THREE.Vector3(0, 1, 0), -c);
}

export function setSlice(n: THREE.Vector3 | null, c = 0) {
  if (!n) {
    clip.slice.set(new THREE.Vector3(1, 0, 0), 1e5);
    clip.sliceInv.set(new THREE.Vector3(-1, 0, 0), -1e5);
    return;
  }
  clip.slice.set(n.clone(), c);
  clip.sliceInv.set(n.clone().negate(), -c);
}

const poche = new THREE.Color(POCHE);

function solid(color: string, opts: Partial<THREE.MeshStandardMaterialParameters> = {}) {
  const m = new THREE.MeshStandardMaterial({
    color, roughness: 0.92, metalness: 0, side: THREE.DoubleSide, clippingPlanes: solidPlanes, clipShadows: true,
    polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1, ...opts,
  });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uPoche = { value: poche };
    sh.fragmentShader = sh.fragmentShader
      .replace('void main() {', 'uniform vec3 uPoche;\nvoid main() {')
      .replace('#include <dithering_fragment>', '#include <dithering_fragment>\n  if (!gl_FrontFacing) gl_FragColor = vec4(uPoche, 1.0);');
  };
  return m;
}

export interface MatSet {
  wall: THREE.MeshStandardMaterial;
  floor: THREE.MeshStandardMaterial;
  plinth: THREE.MeshStandardMaterial;
  roof: THREE.MeshStandardMaterial;
  roofUnder: THREE.MeshStandardMaterial;
  deck: THREE.MeshStandardMaterial;
  stair: THREE.MeshStandardMaterial;
  post: THREE.MeshStandardMaterial;
  ceiling: THREE.MeshStandardMaterial;
  obj: THREE.MeshStandardMaterial;
  objDark: THREE.MeshStandardMaterial;
  canvas: THREE.MeshStandardMaterial;
  leaf: THREE.MeshStandardMaterial;
  imported: THREE.MeshStandardMaterial;
  glass: THREE.MeshStandardMaterial;
  rail: THREE.MeshStandardMaterial;
  edge: THREE.LineBasicMaterial;
  ghost: THREE.MeshBasicMaterial;
  ghostEdge: THREE.LineDashedMaterial;
  ghostAll: THREE.MeshBasicMaterial;
  ghostAllEdge: THREE.LineDashedMaterial;
  pencil: THREE.MeshBasicMaterial;
  pencilEdge: THREE.LineDashedMaterial;
  red: THREE.MeshBasicMaterial;
  redEdge: THREE.LineBasicMaterial;
  blue: THREE.MeshBasicMaterial;
  blueEdge: THREE.LineBasicMaterial;
  shaft: THREE.ShaderMaterial;
  selectTint: THREE.MeshBasicMaterial;
}

let current: MatSet | null = null;
let currentPalette: Palette | null = null;

export function mats(p: Palette = 'card'): MatSet {
  if (current && currentPalette === p) return current;
  const c = PALETTES[p];
  if (current) {
    // re-colour in place so existing meshes update
    current.wall.color.set(c.wall);
    current.floor.color.set(c.floor);
    current.plinth.color.set(c.plinth);
    current.roof.color.set(c.roof);
    current.roofUnder.color.set(c.roofUnder);
    current.deck.color.set(c.deck);
    current.stair.color.set(c.stair);
    current.post.color.set(c.post);
    current.ceiling.color.set(c.ceiling);
    current.edge.color.set(c.edge);
    current.imported.color.set(c.wall);
    currentPalette = p;
    return current;
  }
  currentPalette = p;
  const ghostLine = (opacity: number) =>
    new THREE.LineDashedMaterial({ color: PENCIL, transparent: true, opacity, dashSize: 0.18, gapSize: 0.12, depthWrite: false });
  current = {
    wall: solid(c.wall),
    floor: solid(c.floor),
    plinth: solid(c.plinth),
    roof: solid(c.roof),
    roofUnder: solid(c.roofUnder),
    deck: solid(c.deck),
    stair: solid(c.stair),
    post: solid(c.post),
    ceiling: solid(c.ceiling),
    obj: solid('#f9f7f3', { roughness: 0.6 }),
    objDark: solid('#3b3631', { roughness: 0.5 }),
    canvas: solid('#9fb3ad', { roughness: 0.8 }),
    leaf: solid('#a9b48f', { roughness: 0.9 }),
    // imported meshes often arrive with mixed winding: no poché trick for them (and so no section fill — an honest limit)
    imported: new THREE.MeshStandardMaterial({ color: c.wall, roughness: 0.92, metalness: 0, side: THREE.DoubleSide, clippingPlanes: solidPlanes, clipShadows: true, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 }),
    glass: new THREE.MeshStandardMaterial({
      color: '#c9dcdc', roughness: 0.15, metalness: 0, transparent: true, opacity: 0.32, side: THREE.DoubleSide, depthWrite: false,
      clippingPlanes: solidPlanes,
    }),
    rail: new THREE.MeshStandardMaterial({
      color: '#d7e3e2', roughness: 0.2, transparent: true, opacity: 0.38, side: THREE.DoubleSide, depthWrite: false, clippingPlanes: solidPlanes,
    }),
    edge: new THREE.LineBasicMaterial({ color: c.edge, transparent: true, opacity: 0.78, clippingPlanes: solidPlanes }),
    ghost: new THREE.MeshBasicMaterial({ color: '#b8b1a6', transparent: true, opacity: 0.07, depthWrite: false, side: THREE.DoubleSide, clippingPlanes: ghostPlanes, clipIntersection: true }),
    ghostEdge: Object.assign(ghostLine(0.42), { clippingPlanes: ghostPlanes, clipIntersection: true }),
    ghostAll: new THREE.MeshBasicMaterial({ color: '#b8b1a6', transparent: true, opacity: 0.06, depthWrite: false, side: THREE.DoubleSide }),
    ghostAllEdge: ghostLine(0.32),
    pencil: new THREE.MeshBasicMaterial({ color: PENCIL, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide }),
    pencilEdge: ghostLine(0.8),
    red: new THREE.MeshBasicMaterial({ color: RED, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide }),
    redEdge: new THREE.LineBasicMaterial({ color: RED, transparent: true, opacity: 0.95, depthTest: false }),
    blue: new THREE.MeshBasicMaterial({ color: BLUE, transparent: true, opacity: 0.14, depthWrite: false, side: THREE.DoubleSide }),
    blueEdge: new THREE.LineBasicMaterial({ color: BLUE, transparent: true, opacity: 1, depthTest: false }),
    shaft: new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      uniforms: { uTop: { value: 10 }, uBottom: { value: 0 }, uStrength: { value: 0.32 } },
      vertexShader: `varying vec3 vW; varying vec3 vN; varying vec3 vV;
        void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; vN = normalize(mat3(modelMatrix)*normal); vV = normalize(cameraPosition - w.xyz); gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: `uniform float uTop; uniform float uBottom; uniform float uStrength; varying vec3 vW; varying vec3 vN; varying vec3 vV;
        void main(){ float t = clamp((vW.y - uBottom)/max(uTop-uBottom,0.001),0.0,1.0); float edge = 1.0 - abs(dot(vN, vV)); float a = uStrength * (0.25 + 0.75*t) * (0.35 + 0.65*(1.0-edge)); gl_FragColor = vec4(vec3(1.0,0.96,0.86)*a, a); }`,
    }),
    selectTint: new THREE.MeshBasicMaterial({ color: BLUE, transparent: true, opacity: 0.1, depthWrite: false, side: THREE.DoubleSide }),
  };
  return current;
}
