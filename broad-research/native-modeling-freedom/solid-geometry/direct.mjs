import { axes } from './oracle.mjs';

// A fixed orthogonal face experiment. Construct the boundary from exposed
// cells, then share vertices at identical indexed intersections of source planes.
export function directMesh(reference) {
  const vertices = new Map();
  const positions = [];
  const triangles = [];
  for (const [key, tiles] of reference.tiles) {
    const [axis, coordinate] = key.split(':').map(Number);
    for (const { sign, rect: [u0, v0, u1, v1], roles } of tiles) {
      const corners = [[u0, v0], [u1, v0], [u1, v1], [u0, v1]].map(([u, v]) => {
        const position = [];
        position[axis] = coordinate;
        position[(axis + 1) % 3] = u;
        position[(axis + 2) % 3] = v;
        const key = position.join(',');
        if (!vertices.has(key)) {
          vertices.set(key, positions.length);
          positions.push(position);
        }
        return vertices.get(key);
      });
      if (sign < 0) corners.reverse();
      const [a, b, c, d] = corners;
      triangles.push({ indices: [a, b, c], role: roles[0] }, { indices: [a, c, d], role: roles[0] });
    }
  }
  return { positions, triangles, status: 'NoError' };
}

// Casework-specific direct face/section comparison. The inset footprint is
// inside the wider rebate. The rear pad is inside the stock's back outline.
// Integrate the four operational depth bands without the arrangement grid.
export function vitrineSections(source) {
  const [recess, rebate, pad] = source.ops.map(operation => operation.operand);
  const stock = source.base;
  const area = ({ lo, hi }) => (hi[0] - lo[0]) * (hi[1] - lo[1]);
  const bands = [
    { range: [pad.lo[2], stock.lo[2]], area: area(pad) },
    { range: [stock.lo[2], recess.lo[2]], area: area(stock) },
    { range: [recess.lo[2], rebate.lo[2]], area: area(stock) - area(recess) },
    { range: [rebate.lo[2], stock.hi[2]], area: area(stock) - area(rebate) },
  ];
  const volume = bands.reduce((sum, { range: [lo, hi], area }) => sum + (hi - lo) * area, 0);
  return { bands, volume };
}

export function sliceArea(mesh, height) {
  // The horizontal section of a consistently oriented mesh has outward-facing
  // intersections. Integrate the oriented segments without assembling rings.
  let area = 0;
  for (const { indices } of mesh.triangles) {
    const points = indices.map(i => mesh.positions[i]);
    let from;
    let to;
    for (const i of axes) {
      const a = points[i];
      const b = points[(i + 1) % 3];
      if ((a[2] < height) === (b[2] < height)) continue;
      const t = (height - a[2]) / (b[2] - a[2]);
      const hit = [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])];
      if (a[2] > height) from = hit;
      else to = hit;
    }
    if (from && to) area += (from[0] * to[1] - from[1] * to[0]) / 2;
  }
  return area;
}
