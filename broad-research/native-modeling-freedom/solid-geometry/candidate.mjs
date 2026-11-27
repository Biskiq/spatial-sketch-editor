import { axes, normal, roleName } from './oracle.mjs';

export function kernel(api) {
  const { Manifold } = api;

  // Face IDs are mapped from the source primitive's plane, never from output face order.
  function primitive(solid, keep) {
    const { lo, hi, ring, holes } = solid;
    const size = hi.map((x, i) => x - lo[i]);
    let body;
    if (ring) {
      const profile = keep(new api.CrossSection([ring, ...(holes ?? [])], 'EvenOdd'));
      body = keep(profile.extrude(size[2]));
    } else {
      body = keep(Manifold.cube(size));
    }
    return keep(body.translate(lo));
  }

  function register(body, id, roles) {
    const mesh = body.getMesh();
    const byFace = new Map();
    for (let i = 0; i < mesh.triVerts.length; i += 3) {
      const points = [0, 1, 2].map(corner => mesh.position(mesh.triVerts[i + corner]));
      const n = normal(points.map(p => Array.from(p)));
      const axis = axes.reduce((best, a) => Math.abs(n[a]) > Math.abs(n[best]) ? a : best, 0);
      const role = roleName(axis, Math.sign(n[axis]));
      const face = mesh.faceID[i / 3];
      if (byFace.has(face) && byFace.get(face) !== role) throw new Error('Inconsistent input face');
      byFace.set(face, role);
    }
    for (const original of mesh.runOriginalID) roles.set(original, { id, byFace });
  }

  function using(run) {
    const held = [];
    const keep = x => { held.push(x); return x; };
    try {
      return run(keep);
    } finally {
      for (const object of held.reverse()) object.delete();
    }
  }

  function read(body, roles, withPrecision = false) {
    const mesh = body.getMesh();
    const positions = Array.from({ length: mesh.vertProperties.length / mesh.numProp },
      (_, i) => Array.from(mesh.position(i)));
    const triangles = [];
    // These fixtures have no property seams. Fail explicitly if that changes.
    if (mesh.mergeFromVert.length) throw new Error('Unexpected property seam');
    for (const [run, original] of mesh.runOriginalID.entries()) {
      const source = roles.get(original);
      for (let i = mesh.runIndex[run]; i < mesh.runIndex[run + 1]; i += 3) {
        triangles.push({
          indices: Array.from(mesh.triVerts.subarray(i, i + 3)),
          role: source ? source.id + '/' + source.byFace.get(mesh.faceID[i / 3]) : '?',
          backside: mesh.backside(run),
        });
      }
    }
    if (triangles.length * 3 !== mesh.triVerts.length) throw new Error('Incomplete run coverage');
    const result = {
      status: body.status(), tolerance: body.tolerance(), positions, triangles,
      kernelVolume: body.volume(), vertexType: mesh.vertProperties.constructor.name,
      transformType: mesh.runTransform.constructor.name, indexType: mesh.triVerts.constructor.name,
    };
    if (withPrecision) {
      // This is a diagnostic read of the internal coordinate stream, not a mesh export.
      const copy = body.warpBatch(vertices => {
        result.internalPositions = [];
        for (let i = 0; i < vertices.length; i += 3) result.internalPositions.push(Array.from(vertices.subarray(i, i + 3)));
        result.internalType = vertices.constructor.name;
      });
      copy.delete();
    }
    return result;
  }

  function evaluate(source, { reverseAdd = false, roundtrip = false, withPrecision = false } = {}) {
    return using(keep => {
      const roles = new Map();
      let body = primitive(source.base, keep);
      register(body, source.base.id, roles);
      for (const { kind, operand } of source.ops) {
        const tool = primitive(operand, keep);
        register(tool, operand.id, roles);
        const next = kind === 'cut' ? body.subtract(tool) : reverseAdd ? tool.add(body) : body.add(tool);
        body = keep(next);
        // Force each authored operation separately instead of letting a lazy tree reorder it.
        if (body.status() !== 'NoError') break;
        if (roundtrip) body = keep(new Manifold(body.getMesh()));
      }
      return read(body, roles, withPrecision);
    });
  }

  function issue(boxes, { angles, order, roundtrip }) {
    return using(keep => {
      const roles = new Map();
      const parts = boxes.map((solid, index) => {
        let body = primitive(solid, keep);
        register(body, solid.id, roles);
        if (angles) body = keep(body.rotate(angles));
        if (roundtrip) body = keep(new Manifold(body.getMesh()));
        return body;
      });
      let body = parts[order[0]];
      for (const index of order.slice(1)) {
        body = keep(body.add(parts[index]));
        body.status();
      }
      return read(body, roles, true);
    });
  }

  // Carry the last evaluated result through a sequence of exact set deltas.
  // Importing/exporting on every delta is the separate Float32 comparison.
  function chain(initial, revisions, roundtrip) {
    return using(keep => {
      const roles = new Map();
      let body = primitive(initial.base, keep);
      register(body, initial.base.id, roles);
      for (const operation of initial.ops) apply(operation);
      const snapshots = [];
      for (const deltas of revisions) {
        for (const delta of deltas) apply(delta);
        snapshots.push(read(body, roles));
      }
      return snapshots;
      function apply({ kind, operand }) {
        if (body.status() !== 'NoError') return;
        const tool = primitive(operand, keep);
        register(tool, operand.id, roles);
        body = keep(kind === 'cut' ? body.subtract(tool) : body.add(tool));
        if (roundtrip && body.status() === 'NoError') body = keep(new Manifold(body.getMesh()));
      }
    });
  }

  return { evaluate, issue, chain, hasMesh64: typeof api.Mesh64 !== 'undefined' ||
    typeof Manifold.prototype.getMesh64 === 'function' };
}

const lex = (a, b) => {
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return a[i] < b[i] ? -1 : 1;
  }
  return 0;
};

export function canonical(mesh) {
  // Sort without coordinate rounding, geometric welding, or retriangulation.
  // Canonicalisation is only defined here for meshes with unique positions.
  const rank = mesh.positions.map((p, i) => ({ p, i })).sort((a, b) => lex(a.p, b.p));
  if (rank.some(({ p }, i) => i > 0 && lex(p, rank[i - 1].p) === 0)) return null;
  const remap = [];
  for (const [r, { i }] of rank.entries()) remap[i] = r;
  const triangles = mesh.triangles.map(({ indices, role, backside }) => {
    const order = indices.map(i => remap[i]);
    const offset = order.indexOf(Math.min(...order));
    return [...order.slice(offset), ...order.slice(0, offset), role, backside];
  }).sort(lex);
  // JSON would conflate signed zero. Keep it explicit for the exact digest.
  return JSON.stringify([rank.map(({ p }) => p.map(x => Object.is(x, -0) ? '-0' : x)), triangles]);
}

export async function digest(input) {
  if (input === null) return null;
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(bytes), x => x.toString(16).padStart(2, '0')).join('');
}
