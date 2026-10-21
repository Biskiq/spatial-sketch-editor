// A small geometry builder: triangles oriented by a normal hint, flat polygons with holes, prisms.
import * as THREE from 'three';
import type { V2 } from '../../model/geom2d';
import { polyArea } from '../../model/geom2d';
import type { MPoly } from '../../model/clip';

export type V3 = [number, number, number];

export class Geo {
  pos: number[] = [];
  tri(a: V3, b: V3, c: V3, hint?: V3) {
    if (hint) {
      const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
      const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      if (nx * hint[0] + ny * hint[1] + nz * hint[2] < 0) {
        const t = b;
        b = c;
        c = t;
      }
    }
    this.pos.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
  }
  quad(a: V3, b: V3, c: V3, d: V3, hint?: V3) {
    this.tri(a, b, c, hint);
    this.tri(a, c, d, hint);
  }
  /** Flat horizontal polygon (outer + holes) at height y facing up or down. */
  flat(rings: V2[][], y: number | ((p: V2) => number), up: boolean) {
    const f = typeof y === 'number' ? () => y : y;
    const outer = rings[0];
    if (!outer || outer.length < 3) return;
    const contour = outer.map((p) => new THREE.Vector2(p[0], p[1]));
    const holes = rings.slice(1).filter((h) => h.length >= 3).map((h) => h.map((p) => new THREE.Vector2(p[0], p[1])));
    const all = [...outer, ...rings.slice(1).filter((h) => h.length >= 3).flat()];
    let tris: number[][];
    try {
      tris = THREE.ShapeUtils.triangulateShape(contour, holes);
    } catch {
      return;
    }
    const hint: V3 = up ? [0, 1, 0] : [0, -1, 0];
    for (const t of tris) {
      const [a, b, c] = t.map((i) => all[i]);
      this.tri([a[0], f(a), a[1]], [b[0], f(b), b[1]], [c[0], f(c), c[1]], hint);
    }
  }
  flatM(m: MPoly, y: number | ((p: V2) => number), up: boolean) {
    for (const poly of m) this.flat(poly, y, up);
  }
  /** Vertical skirt along a ring between bottom(p) and top(p). Faces outward for CCW outer rings. */
  skirt(ring: V2[], bottom: number | ((p: V2) => number), top: number | ((p: V2) => number), outward = true) {
    const fb = typeof bottom === 'number' ? () => bottom : bottom;
    const ft = typeof top === 'number' ? () => top : top;
    const ccw = polyArea(ring) > 0;
    const n = ring.length;
    for (let i = 0; i < n; i++) {
      const a = ring[i], b = ring[(i + 1) % n];
      // outward normal of edge a→b for a CCW ring in x–z is (dz, -dx)
      let nx = b[1] - a[1], nz = -(b[0] - a[0]);
      if (!ccw) {
        nx = -nx;
        nz = -nz;
      }
      if (!outward) {
        nx = -nx;
        nz = -nz;
      }
      this.quad([a[0], fb(a), a[1]], [b[0], fb(b), b[1]], [b[0], ft(b), b[1]], [a[0], ft(a), a[1]], [nx, 0, nz]);
    }
  }
  prismM(m: MPoly, y0: number, y1: number) {
    this.flatM(m, y1, true);
    this.flatM(m, y0, false);
    for (const poly of m) {
      poly.forEach((ring, i) => this.skirt(ring, y0, y1, i === 0));
    }
  }
  box(cx: number, cy: number, cz: number, sx: number, sy: number, sz: number, rotY = 0) {
    const hx = sx / 2, hz = sz / 2;
    const c = Math.cos(rotY), s = Math.sin(rotY);
    const P = (x: number, z: number): V2 => [cx + x * c - z * s, cz + x * s + z * c];
    const ring = [P(-hx, -hz), P(hx, -hz), P(hx, hz), P(-hx, hz)];
    this.prismM([[ring]], cy - sy / 2, cy + sy / 2);
  }
  geometry(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.computeVertexNormals();
    g.computeBoundingSphere();
    g.computeBoundingBox();
    return g;
  }
  get empty() {
    return this.pos.length === 0;
  }
}
