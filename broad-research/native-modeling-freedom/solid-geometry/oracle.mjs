// Independent reference: axis-aligned box truth on a coordinate arrangement.
// It never reads a kernel mesh when constructing the expected solid.
export const axes = [0, 1, 2];
export const MIN_FEATURE = 0.001;
const EMPTY = ' ';

const contains = (p, [lo, hi]) => axes.every(a => lo[a] < p[a] && p[a] < hi[a]);
export const cellsOf = ({ lo, hi, cells }) => cells ?? [[lo, hi]];
export const sub = (a, b) => a.map((x, i) => x - b[i]);
export const dot = (a, b) => a.reduce((sum, x, i) => sum + x * b[i], 0);
export const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const normal = ([a, b, c]) => cross(sub(b, a), sub(c, a));
export const roleName = (axis, sign) => 'xyz'[axis] + (sign > 0 ? '+' : '-');
const key = (a, value) => a + ':' + value;

export function arrangement(source) {
  const solids = [source.base, ...source.ops.map(op => op.operand)];
  const planes = axes.map(a => [...new Set(solids.flatMap(solid => cellsOf(solid)
    .flatMap(([lo, hi]) => [lo[a], hi[a]])))].sort((x, y) => x - y));
  const strides = [1, planes[0].length, planes[0].length * planes[1].length];
  const size = strides[2] * planes[2].length;
  const cells = [];
  for (let k = 0; k < planes[2].length - 1; k++) {
    for (let j = 0; j < planes[1].length - 1; j++) {
      for (let i = 0; i < planes[0].length - 1; i++) {
        const indices = [i, j, k];
        const lo = axes.map(a => planes[a][indices[a]]);
        const hi = axes.map(a => planes[a][indices[a] + 1]);
        const p = axes.map(a => lo[a] + (hi[a] - lo[a]) / 2);
        const index = dot(strides, indices);
        const neighbors = axes.flatMap(a => [-1, 1].map(sign => {
          const next = indices[a] + sign;
          return next < 0 || next >= planes[a].length - 1 ? -1 : index + sign * strides[a];
        }));
        cells.push({ index, lo, hi, p, neighbors, volume: sub(hi, lo).reduce((a, b) => a * b) });
      }
    }
  }

  const masks = solids.map(solid => {
    const boxes = cellsOf(solid);
    const fill = new Uint8Array(size);
    for (const cell of cells) fill[cell.index] = Number(boxes.some(box => contains(cell.p, box)));
    return fill;
  });
  const fill = masks[0].slice();
  const steps = [];
  for (const [i, operation] of source.ops.entries()) {
    const mask = masks[i + 1];
    let changed = 0;
    let overlap = 0;
    let opened = false;
    const previous = fill.slice();
    for (const cell of cells) {
      const n = cell.index;
      if (!mask[n]) continue;
      overlap += previous[n];
      const next = operation.kind === 'add' ? 1 : 0;
      if (previous[n] === next) continue;
      changed++;
      if (next === 0 && cell.neighbors.some(neighbor => !previous[neighbor])) opened = true;
      fill[n] = next;
    }
    const components = countComponents(cells, fill);
    const sealed = sealedVoid(cells, fill);
    steps.push({ id: operation.id, changed, overlap, opened, components, sealed });
  }
  const occupied = cells.filter(cell => fill[cell.index]);
  const tiles = new Map();
  let ambiguousTiles = 0;
  for (const cell of occupied) {
    for (const a of axes) {
      for (const [side, sign] of [[0, -1], [1, 1]]) {
        const neighbor = cell.neighbors[2 * a + side];
        if (fill[neighbor]) continue;
        const coordinate = side ? cell.hi[a] : cell.lo[a];
        const u = (a + 1) % 3;
        const v = (a + 2) % 3;
        const roles = masks.flatMap((mask, i) => {
          if (Boolean(mask[cell.index]) === Boolean(mask[neighbor])) return [];
          const inside = Boolean(mask[cell.index]);
          const backwards = i > 0 && source.ops[i - 1].kind === 'cut';
          if (inside === backwards) return [];
          return [solids[i].id + '/' + roleName(a, backwards ? -sign : sign)];
        });
        if (roles.length !== 1) ambiguousTiles++;
        const tile = {
          sign, rect: [cell.lo[u], cell.lo[v], cell.hi[u], cell.hi[v]], roles,
        };
        const id = key(a, coordinate);
        if (!tiles.has(id)) tiles.set(id, []);
        tiles.get(id).push(tile);
      }
    }
  }
  return {
    planes, tiles, steps, ambiguousTiles,
    surfaceArea: [...tiles.values()].flat().reduce((sum, { rect: [u0, v0, u1, v1] }) =>
      sum + (u1 - u0) * (v1 - v0), 0),
    components: countComponents(cells, fill),
    volume: occupied.reduce((sum, cell) => sum + cell.volume, 0),
  };
}

function countComponents(cells, fill) {
  const byIndex = new Map(cells.map(cell => [cell.index, cell]));
  const seen = new Set();
  let components = 0;
  for (const cell of cells) {
    if (!fill[cell.index] || seen.has(cell.index)) continue;
    components++;
    const queue = [cell.index];
    seen.add(cell.index);
    for (const index of queue) {
      for (const neighbor of byIndex.get(index).neighbors) {
        if (!fill[neighbor] || seen.has(neighbor)) continue;
        seen.add(neighbor);
        queue.push(neighbor);
      }
    }
  }
  return components;
}

function sealedVoid(cells, fill) {
  const voids = new Map(cells.filter(cell => !fill[cell.index]).map(cell => [cell.index, cell]));
  const queue = [...voids.values()].filter(cell => cell.neighbors.includes(-1)).map(cell => cell.index);
  const exterior = new Set(queue);
  for (const index of queue) {
    for (const neighbor of voids.get(index).neighbors) {
      if (!voids.has(neighbor) || exterior.has(neighbor)) continue;
      exterior.add(neighbor);
      queue.push(neighbor);
    }
  }
  return exterior.size < voids.size;
}

export function preflight(source) {
  if (source.ops.length > 8) return { code: 'operation-budget' };
  for (const operation of source.ops) {
    if (!['cut', 'add'].includes(operation.kind) || operation.id !== operation.operand.id) {
      return { code: 'invalid-operation', operation: operation.id };
    }
  }
  const solids = [source.base, ...source.ops.map(op => op.operand)];
  if (new Set(solids.map(solid => solid.id)).size !== solids.length) return { code: 'duplicate-id' };
  for (const solid of solids) {
    if (solid.ring || solid.holes) return { code: 'profile' };
    if (axes.some(a => !Number.isFinite(solid.lo[a]) || !Number.isFinite(solid.hi[a])
      || Math.abs(solid.lo[a]) > 50 || Math.abs(solid.hi[a]) > 50
      || solid.hi[a] - solid.lo[a] < MIN_FEATURE)) return { code: 'bounds' };
  }
  const reference = arrangement(source);
  for (const [i, step] of reference.steps.entries()) {
    const operation = source.ops[i];
    const refusal = code => ({ code, operation: step.id });
    if (!step.components) return refusal('empty');
    const prior = solids.slice(0, i + 1);
    const separations = axes.flatMap(a => [operation.operand.lo[a], operation.operand.hi[a]]
      .flatMap(x => prior.flatMap(solid => [Math.abs(x - solid.lo[a]), Math.abs(x - solid.hi[a])])));
    if (separations.includes(0)) return refusal('coincident-planes');
    if (separations.some(distance => distance < MIN_FEATURE)) return refusal('near-planes');
    if (operation.kind === 'add' && !step.overlap) return refusal('disjoint-add');
    if (!step.changed) return refusal('ineffective');
    if (step.components !== 1) return refusal('split');
    if (operation.kind === 'cut' && !step.opened) return refusal('interior-cut');
    if (step.sealed) return refusal('sealed-void');
  }
  if (reference.ambiguousTiles) return { code: 'ambiguous-role' };
  return { code: 'ok', reference };
}

const area2 = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
function area(poly) {
  return poly.slice(2).reduce((sum, p, i) => sum + area2(poly[0], poly[i + 1], p) / 2, 0);
}

// Convex clipping used for exact-in-shape coverage with a measured numeric error allowance.
function clip(poly, boundary) {
  let result = poly;
  for (const [i, a] of boundary.entries()) {
    const b = boundary[(i + 1) % boundary.length];
    const input = result;
    result = [];
    for (const [j, p] of input.entries()) {
      const q = input[(j + 1) % input.length];
      const dp = area2(a, b, p);
      const dq = area2(a, b, q);
      if (dp >= 0) result.push(p);
      if ((dp < 0) !== (dq < 0)) {
        const t = dp / (dp - dq);
        result.push(p.map((x, i) => x + t * (q[i] - x)));
      }
    }
  }
  return result;
}

export function inspectBoundary(mesh, reference, epsilon = 0.0000021) {
  const groups = new Map();
  let unsupported = 0;
  let error = 0;
  for (const triangle of mesh.triangles) {
    const points = triangle.indices.map(i => mesh.positions[i]);
    const n = normal(points);
    const axis = axes.reduce((best, a) => Math.abs(n[a]) > Math.abs(n[best]) ? a : best, 0);
    const nearest = reference.planes[axis].reduce((best, x) =>
      Math.abs(x - points[0][axis]) < Math.abs(best - points[0][axis]) ? x : best);
    const distance = Math.max(...points.map(p => Math.abs(p[axis] - nearest)));
    error = Math.max(error, distance);
    if (distance > epsilon || n[axis] === 0) {
      unsupported++;
      continue;
    }
    const sign = Math.sign(n[axis]);
    const uv = points.map(p => [p[(axis + 1) % 3], p[(axis + 2) % 3]]);
    const face = { uv: sign === 1 ? uv : uv.reverse(), sign, role: triangle.role, covered: 0 };
    const id = key(axis, nearest);
    if (!groups.has(id)) groups.set(id, []);
    groups.get(id).push(face);
  }

  let missing = 0;
  let excess = 0;
  let overlaps = 0;
  let firstExcess;
  let wrongRole = 0;
  for (const [id, tiles] of reference.tiles) {
    for (const { sign, rect: [u0, v0, u1, v1], roles } of tiles) {
      const boundary = [[u0, v0], [u1, v0], [u1, v1], [u0, v1]];
      const expected = (u1 - u0) * (v1 - v0);
      const margin = 2 * epsilon * ((u1 - u0) + (v1 - v0)) + epsilon ** 2;
      const fragments = [];
      let covered = 0;
      for (const face of groups.get(id) ?? []) {
        if (face.sign !== sign) continue;
        const polygon = clip(face.uv, boundary);
        const amount = area(polygon);
        if (amount <= 0) continue;
        face.covered += amount;
        covered += amount;
        if (!roles.includes(face.role)) wrongRole += amount;
        if (amount > margin) fragments.push(polygon);
      }
      if (expected - covered > margin) missing += expected - covered;
      for (const [i, a] of fragments.entries()) {
        for (const b of fragments.slice(i + 1)) {
          const common = area(clip(a, b));
          if (common > margin) overlaps += common;
        }
      }
    }
  }
  for (const [id, faces] of groups) {
    for (const { uv, covered, sign: faceSign } of faces) {
      const perimeter = uv.reduce((sum, p, i) => sum + Math.hypot(...sub(p, uv[(i + 1) % 3])), 0);
      const outside = area(uv) - covered;
      if (outside > epsilon * perimeter + epsilon ** 2) {
        excess += outside;
        firstExcess ??= { uv, sign: faceSign, plane: id, area: outside };
      }
    }
  }
  return { unsupported, missing, excess, overlaps, wrongRole, error, firstExcess };
}

export function meshTopology(mesh) {
  const edges = new Map();
  const seenPositions = new Set();
  const geometricEdges = [];
  const parents = new Map();
  const links = new Map();
  let coincidentVertices = 0;
  let invalid = 0;
  let badVertices = 0;
  let volume = 0;
  const origin = mesh.positions[0] ?? [0, 0, 0];
  for (const p of mesh.positions) {
    if (!p.every(Number.isFinite)) invalid++;
    const key = p.join(',');
    if (seenPositions.has(key)) coincidentVertices++;
    seenPositions.add(key);
  }
  function root(i) {
    while (parents.get(i) !== i) i = parents.get(i);
    return i;
  }
  for (const { indices } of mesh.triangles) {
    if (indices.some(i => !mesh.positions[i])) {
      invalid++;
      continue;
    }
    const points = indices.map(i => mesh.positions[i]);
    if (normal(points).every(x => x === 0)) invalid++;
    const [a, b, c] = points.map(p => sub(p, origin));
    volume += dot(a, cross(b, c)) / 6;
    for (const i of indices) if (!parents.has(i)) parents.set(i, i);
    for (const [corner, p] of indices.entries()) {
      const q = indices[(corner + 1) % 3];
      const r = indices[(corner + 2) % 3];
      const id = Math.min(p, q) + ':' + Math.max(p, q);
      if (!edges.has(id)) {
        edges.set(id, [0, 0]);
        geometricEdges.push([p, q]);
      }
      edges.get(id)[Number(p > q)]++;
      parents.set(root(q), root(p));
      if (!links.has(p)) links.set(p, new Map());
      const link = links.get(p);
      if (!link.has(q)) link.set(q, []);
      link.get(q).push(r);
    }
  }
  for (const link of links.values()) {
    const queue = [link.keys().next().value];
    const visited = new Set(queue);
    for (const next of queue) {
      for (const vertex of link.get(next) ?? []) {
        if (visited.has(vertex)) continue;
        queue.push(vertex);
        visited.add(vertex);
      }
    }
    if (visited.size !== link.size || [...link.values()].some(neighbors => neighbors.length !== 1)) badVertices++;
  }
  const badEdges = [...edges.values()].filter(([forward, reverse]) => forward !== 1 || reverse !== 1).length;
  // A closed index-edge cycle can still hide a T-junction or edge-only
  // contact. Look for a nonincident exact vertex in the interior of an edge.
  let edgeIncidences = 0;
  for (const [p, q] of geometricEdges) {
    const a = mesh.positions[p];
    const b = mesh.positions[q];
    const d = sub(b, a);
    const length2 = dot(d, d);
    for (const [i, v] of mesh.positions.entries()) {
      if (i === p || i === q || !axes.every(axis => v[axis] >= Math.min(a[axis], b[axis])
        && v[axis] <= Math.max(a[axis], b[axis]))) continue;
      const offset = sub(v, a);
      const along = dot(offset, d);
      if (along > 0 && along < length2 && cross(offset, d).every(x => x === 0)) edgeIncidences++;
    }
  }
  const components = new Set([...parents.keys()].map(root)).size;
  const euler = parents.size - edges.size + mesh.triangles.length;
  return { invalid, coincidentVertices, badEdges, badVertices, edgeIncidences, components, euler, volume };
}
