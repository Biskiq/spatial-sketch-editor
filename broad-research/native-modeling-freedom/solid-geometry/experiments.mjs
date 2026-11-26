import { directMesh, sliceArea, vitrineSections } from './direct.mjs';
import { canonical, digest, kernel } from './candidate.mjs';
import { box, cases, casework, op, stressCases, translated, windowWall } from './fixtures.mjs';
import { stack, rotated, angles, regression, regressionAngles } from './issue-1888.mjs';
import { arrangement, axes, inspectBoundary, meshTopology, preflight } from './oracle.mjs';

const EPSILON = 0.0000021;
const ensure = (condition, message) => { if (!condition) throw new Error(message); };

function inspect(mesh, reference, epsilon = EPSILON) {
  const topology = meshTopology(mesh);
  const boundary = inspectBoundary(mesh, reference, epsilon);
  const volumeError = Math.abs(topology.volume - reference.volume);
  const areaBound = mesh.triangles.length * epsilon ** 2;
  const geometry = mesh.status === 'NoError'
    && topology.components === reference.components && topology.invalid === 0
    && topology.badEdges === 0 && topology.badVertices === 0 && topology.coincidentVertices === 0
    && topology.edgeIncidences === 0 && volumeError <= 2 * epsilon * reference.surfaceArea
    && boundary.unsupported === 0 && boundary.missing === 0 && boundary.excess === 0 && boundary.overlaps === 0;
  const provenance = boundary.wrongRole <= areaBound
    && mesh.triangles.every(face => face.role !== '?' && !face.role.includes('undefined'));
  return { geometry, provenance, topology, boundary, volumeError, triangles: mesh.triangles.length, status: mesh.status };
}

function propose(candidate, accepted, source) {
  const guard = preflight(source);
  if (guard.code !== 'ok') return { verdict: guard, accepted };
  let mesh;
  // Evaluate each prefix from source so a later operation cannot cover up an
  // invalid intermediate. This is a research transaction over JSON bytes.
  for (let n = 0; n <= source.ops.length; n++) {
    const prefix = { ...source, ops: source.ops.slice(0, n) };
    const reference = n === source.ops.length ? guard.reference : arrangement(prefix);
    mesh = candidate.evaluate(prefix);
    const check = inspect(mesh, reference);
    if (!check.geometry || !check.provenance || mesh.triangles.length > 100000) {
      return { verdict: { code: 'invalid-derived', operation: prefix.ops.at(-1)?.id }, accepted };
    }
  }
  return { verdict: { code: 'ok' }, accepted: JSON.stringify(source), mesh };
}

function resultSummary(result) {
  return {
    geometry: result.geometry, provenance: result.provenance, status: result.status,
    triangles: result.triangles, shellComponents: result.topology.components, euler: result.topology.euler,
    volumeError: result.volumeError, coordinateError: result.boundary.error,
    defects: [...Object.entries(result.topology).filter(([key]) =>
      ['invalid', 'badEdges', 'badVertices', 'coincidentVertices', 'edgeIncidences'].includes(key)),
    ...Object.entries(result.boundary).filter(([key]) => !['error', 'firstExcess'].includes(key))].filter(([, value]) => value !== 0),
  };
}

function inverseRotation(positions, angles) {
  if (!angles) return positions;
  return positions.map(point => {
    let p = point;
    // Manifold documents global x then y then z. Invert in reverse order.
    for (const a of [2, 1, 0]) {
      const radians = -angles[a] * Math.PI / 180;
      const u = (a + 1) % 3;
      const v = (a + 2) % 3;
      const next = p.slice();
      next[u] = Math.cos(radians) * p[u] - Math.sin(radians) * p[v];
      next[v] = Math.sin(radians) * p[u] + Math.cos(radians) * p[v];
      p = next;
    }
    return p;
  });
}

// Separate issue oracle: inclusion/exclusion of boxes, plus an input-support plane
// test in the original frame. The tile oracle's plane uniqueness assumption does
// not apply to contact distances in this fixture.
function issueOracle(mesh, bounds, rotation, epsilon) {
  const count = bounds.length;
  let volume = 0;
  for (let mask = 1; mask < 2 ** count; mask++) {
    const subset = bounds.filter((_, i) => mask & (1 << i));
    const overlap = axes.reduce((product, a) => product * Math.max(0,
      Math.min(...subset.map(([, hi]) => hi[a])) - Math.max(...subset.map(([lo]) => lo[a]))), 1);
    volume += (subset.length % 2 ? 1 : -1) * overlap;
  }
  const positions = inverseRotation(mesh.positions, rotation);
  const unsupported = mesh.triangles.filter(({ indices }) => !bounds.some(([lo, hi]) =>
    axes.some(a => [lo[a], hi[a]].some(plane =>
      indices.every(i => Math.abs(positions[i][a] - plane) <= epsilon))))).length;
  const topology = meshTopology(mesh);
  return { kernelVolume: mesh.kernelVolume, referenceVolume: volume, relativeError: (mesh.kernelVolume - volume) / volume,
    meshVolume: topology.volume, unsupported, invalid: topology.invalid, shellComponents: topology.components,
    coincidentVertices: topology.coincidentVertices, status: mesh.status, tolerance: mesh.tolerance };
}

function rolePatches(mesh, role) {
  const triangles = mesh.triangles.filter(tri => tri.role === role);
  const edgeToTriangle = new Map();
  const neighbors = triangles.map(() => []);
  for (const [index, { indices }] of triangles.entries()) {
    for (const [i, a] of indices.entries()) {
      const b = indices[(i + 1) % 3];
      const edge = Math.min(a, b) + ':' + Math.max(a, b);
      if (edgeToTriangle.has(edge)) {
        const other = edgeToTriangle.get(edge);
        neighbors[other].push(index);
        neighbors[index].push(other);
      }
      edgeToTriangle.set(edge, index);
    }
  }
  const seen = new Set();
  let components = 0;
  for (const i of neighbors.keys()) {
    if (seen.has(i)) continue;
    const queue = [i];
    seen.add(i);
    components++;
    for (const j of queue) {
      for (const n of neighbors[j]) {
        if (seen.has(n)) continue;
        queue.push(n);
        seen.add(n);
      }
    }
  }
  return components;
}

async function revisionExperiment(candidate) {
  const initial = casework();
  let source = initial;
  const before = JSON.stringify(initial);
  const allSources = [];
  const deltas = [];
  for (let i = 1; i <= 20; i++) {
    const original = i % 2 === 0;
    const next = casework(original ? initial.base.hi[0] : 1.139876543,
      original ? initial.ops[0].operand.lo[2] : 0.089876543);
    const oldWidth = source.base.hi[0];
    const width = next.base.hi[0];
    const [, h, d] = initial.base.hi;
    const oldFloor = source.ops[0].operand.lo[2];
    const floor = next.ops[0].operand.lo[2];
    const { lo: [u0, v0], hi: [u1, v1] } = initial.ops[0].operand;
    deltas.push([
      width > oldWidth
        ? op('add', box('width-' + i, [oldWidth - 0.01, 0, 0], [width, h, d]))
        : op('cut', box('width-' + i, [width, -0.01, -0.01], [oldWidth + 0.01, h + 0.01, d + 0.01])),
      floor > oldFloor
        ? op('add', box('floor-' + i, [u0, v0, oldFloor - 0.01], [u1, v1, floor]))
        : op('cut', box('floor-' + i, [u0, v0, floor], [u1, v1, oldFloor + 0.01])),
    ]);
    allSources.push(next);
    source = next;
  }

  const authority = await digest(canonical(candidate.evaluate(initial)));
  const sequences = {
    replay: allSources.map(s => candidate.evaluate(JSON.parse(JSON.stringify(s)))),
    kernelInternalChain: candidate.chain(initial, deltas, false),
    float32ExportChain: candidate.chain(initial, deltas, true),
  };
  const results = {};
  const sections = { maxAreaError: 0, maxVolumeError: 0 };
  const replayHashes = [];
  for (const [method, meshes] of Object.entries(sequences)) {
    const rows = [];
    for (const [i, mesh] of meshes.entries()) {
      const next = allSources[i];
      const check = inspect(mesh, arrangement(next));
      const hash = await digest(canonical(mesh));
      if (method === 'replay') replayHashes.push(hash);
      const matchesReplay = hash !== null && hash === replayHashes[i];
      const exactReversal = i % 2 ? hash === authority : null;
      if (method === 'replay') {
        ensure(check.geometry && check.provenance && hash, 'Failed replay at revision ' + (i + 1));
        ensure(exactReversal !== false, 'Failed exact replay reversal');
        const measurements = checkVitrineSections(mesh, next);
        sections.maxAreaError = Math.max(sections.maxAreaError, measurements.maxAreaError);
        sections.maxVolumeError = Math.max(sections.maxVolumeError, measurements.volumeError);
        ensure(next.finish === initial.finish && next.ops.every((op, idx) => op.id === initial.ops[idx].id),
          'Authored identity changed on replay');
      }
      rows.push({ revision: i + 1, matchesReplay, exactReversal, ...resultSummary(check) });
    }
    results[method] = rows;
  }

  // A too-shallow remaining back is the refused edit, followed by Undo and cold reopen.
  const acceptedBytes = JSON.stringify(source);
  const invalid = casework(source.base.hi[0], 0.0004);
  const refused = propose(candidate, acceptedBytes, invalid);
  const refusal = refused.verdict;
  ensure(refusal.code === 'near-planes' && refusal.operation === 'recess', 'Refusal must identify the revised operation');
  ensure(refused.accepted === before && JSON.stringify(initial) === before, 'Refused edit mutated accepted source');
  const restored = propose(candidate, acceptedBytes, allSources[18]);
  ensure(restored.verdict.code === 'ok' && await digest(canonical(restored.mesh)) === replayHashes[18],
    'Earlier snapshot disagrees on restore');
  const reopened = JSON.parse(before);
  const undoHash = await digest(canonical(candidate.evaluate(reopened)));
  ensure(undoHash === authority, 'Cold reopen or source snapshot restore disagrees');
  const counterexample = inspect(sequences.float32ExportChain[0], arrangement(allSources[0])).boundary.firstExcess;
  return { results, sections, hashes: replayHashes, authority, refused: refusal, counterexample, sourceSha256: await digest(before) };
}

async function issueExperiments(candidate) {
  const observations = {};
  const twoOrders = [[0, 1], [1, 0]];
  const threeOrders = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]];
  const runs = [
    { id: 'two-literal', coords: stack, orders: twoOrders },
    { id: 'two-local-scale', coords: stack.map(bounds => bounds.map(p => p.map(x => x * 0.05))), orders: twoOrders },
    { id: 'two-translated', coords: stack.map(bounds => bounds.map(p => p.map((x, a) => x + [10, -7, 2][a]))), orders: twoOrders },
    { id: 'three-rotated-internal', coords: rotated, orders: threeOrders, rotation: angles },
    { id: 'three-rotated-f32-reimport', coords: rotated, orders: threeOrders, rotation: angles, roundtrip: true },
    { id: 'five-regression-internal', coords: regression, orders: [[0, 1, 2, 3, 4], [4, 3, 2, 1, 0]],
      rotation: regressionAngles },
    { id: 'five-regression-f32-reimport', coords: regression, orders: [[0, 1, 2, 3, 4], [4, 3, 2, 1, 0]],
      rotation: regressionAngles, roundtrip: true },
  ];
  for (const { id, coords, orders, rotation, roundtrip } of runs) {
    observations[id] = orders.map(order => {
      const mesh = candidate.issue(coords.map(([lo, hi], i) => box('part-' + i, lo, hi)),
        { order, angles: rotation, roundtrip });
      return { order, ...issueOracle(mesh, coords, rotation, EPSILON) };
    });
  }
  observations.clearanceSweep = [0.001, 0.000001, 1e-8, 1e-10, 0, -1e-10, -1e-8, -0.000001, -0.001]
    .map(overlap => {
      const coords = [[[0, 0, 0], [1.01234567, 1.03456789, 1]],
        [[0.00023, 0.00034, 1 - overlap], [1.00123456, 1.01456789, 2]]];
      return { overlap, orders: twoOrders.map(order => {
        const mesh = candidate.issue(coords.map(([lo, hi], i) => box('part-' + i, lo, hi)), { order });
        return { order, ...issueOracle(mesh, coords, undefined, EPSILON) };
      }) };
    });
  return observations;
}

export async function run(api) {
  const candidate = kernel(api);
  const observations = [];
  const hashes = {};
  const stress = stressCases();
  let acceptedStress = 0;
  let maximumStressError = 0;
  const stressHashes = [];
  const stressRefusals = [];
  for (const [i, source] of stress.entries()) {
    const guard = preflight(source);
    if (guard.code !== 'ok') {
      ensure(guard.code === 'near-planes', 'Unexpected stress refusal at ' + i);
      stressRefusals.push({ i, code: guard.code, operation: guard.operation });
      continue;
    }
    const mesh = candidate.evaluate(source);
    const check = inspect(mesh, guard.reference);
    ensure(check.geometry && check.provenance, 'Stress failure ' + i + ': ' + JSON.stringify(resultSummary(check)));
    acceptedStress++;
    maximumStressError = Math.max(maximumStressError, check.boundary.error);
    stressHashes.push(await digest(canonical(mesh)));
  }
  const allCases = [...cases,
    { name: 'offset-thin-back', source: translated(cases.find(x => x.name === 'thin-back-1mm').source, [44, -45, 46]),
      expected: 'near-planes' },
    { name: 'offset-thin-back-margin', source: translated(cases.find(x => x.name === 'thin-back-1mm').source, [44, -45, 46], 2),
      expected: 'ok' },
    { name: 'nonfinite', source: translated(casework(), [Infinity, 0, 0]), expected: 'bounds' },
    { name: 'operation-budget', source: windowWall(9), expected: 'operation-budget' },
    { name: 'eight-cuts', source: windowWall(8), expected: 'ok' },
  ];
  let roleEvidence;
  const direct = {};
  const accepted = JSON.stringify(casework());
  for (const { name, source, expected } of allCases) {
    const guard = preflight(source);
    ensure(guard.code === expected, name + ': expected ' + expected + ', got ' + guard.code);
    const proposal = propose(candidate, accepted, source);
    ensure(proposal.verdict.code === expected, name + ': proposal disagrees with expected verdict');
    ensure(proposal.accepted === (expected === 'ok' ? JSON.stringify(source) : accepted),
      name + ': incorrect source publication');
    if (['bounds', 'operation-budget'].includes(expected)) {
      observations.push({ name, preflight: guard.code });
      continue;
    }
    const reference = guard.reference ?? arrangement(source);
    const result = proposal.mesh ?? candidate.evaluate(source);
    const checked = inspect(result, reference);
    const row = { name, preflight: guard.code, ambiguousTiles: reference.ambiguousTiles,
      exactVolume: reference.volume, kernelVolume: result.kernelVolume, ...resultSummary(checked) };
    if (source.ops.some(op => op.kind === 'add')) {
      const swapped = candidate.evaluate(source, { reverseAdd: true });
      row.reversed = resultSummary(inspect(swapped, reference));
      row.identicalOrderVariant = canonical(result) !== null && canonical(result) === canonical(swapped);
      if (expected === 'ok') ensure(row.reversed.geometry && row.reversed.provenance, name + ' reversed');
      if (name === 'coplanar-role-tie') {
        row.topAttribution = [result, swapped].map(mesh => mesh.triangles.filter(t => t.role.endsWith('/z+'))
          .reduce((counts, t) => ({ ...counts, [t.role]: (counts[t.role] ?? 0) + 1 }), {}));
      }
    }
    if (expected === 'ok') {
      ensure(checked.geometry && checked.provenance, name + ': ' + JSON.stringify(row));
      ensure(result.triangles.length <= 100000, name + ': triangle budget');
      for (const { role, backside } of result.triangles) {
        ensure(backside === source.ops.some(op => op.kind === 'cut' && role.startsWith(op.id + '/')),
          name + ': invalid front/back attribution');
      }
      const current = canonical(result);
      ensure(current && current === canonical(candidate.evaluate(source)), name + ': repeated evaluation mismatch');
      hashes[name] = await digest(current);
      const analytic = directMesh(reference);
      const directCheck = inspect(analytic, reference);
      ensure(directCheck.geometry && directCheck.provenance, name + ': direct mesh failed');
      direct[name] = { triangles: analytic.triangles.length, volumeError: directCheck.volumeError };
      if (name === 'vitrine') direct[name].sections = checkVitrineSections(analytic, source);
    }
    if (name === 'role-split-trench' || name === 'role-vanished-top') {
      row.stockTopPatches = rolePatches(result, 'stock/z+');
      ensure(row.stockTopPatches === (name === 'role-split-trench' ? 2 : 0), name + ': role lifecycle');
    }
    if (name === 'vitrine') {
      const roleTriangles = Object.groupBy(result.triangles, t => t.role);
      roleEvidence = Object.fromEntries(Object.entries(roleTriangles).map(([role, tris]) => [role, {
        triangles: tris.length, backside: tris[0].backside,
        materialToken: role.startsWith('stock/') ? 'stock-swab' : role.split('/')[0] + '-swab',
      }]));
      negativeControls(candidate, source, reference, result);
    }
    observations.push(row);
  }
  const cutAdd = observations.find(row => row.name === 'ordered-cut-add');
  const addCut = observations.find(row => row.name === 'ordered-add-cut');
  ensure(Math.abs(cutAdd.exactVolume - addCut.exactVolume) > 0.08, 'Lost program order');
  const edge = observations.find(row => row.name === 'edge-only-add');
  ensure(edge.defects.some(([key, value]) => key === 'edgeIncidences' && value > 0),
    'Failed to detect exact edge-only contact');
  const precisionMesh = candidate.evaluate(casework(), { withPrecision: true });
  const precision = {
    mesh64Exposed: candidate.hasMesh64, vertexType: precisionMesh.vertexType, indexType: precisionMesh.indexType,
    transformType: precisionMesh.transformType, internalType: precisionMesh.internalType,
    exportedStockX: Math.max(...precisionMesh.positions.map(p => p[0])),
    internalStockX: Math.max(...precisionMesh.internalPositions.map(p => p[0])),
    expectedStockX: casework().base.hi[0], kernelTolerance: precisionMesh.tolerance,
  };
  ensure(precision.internalStockX === precision.expectedStockX && precision.exportedStockX === Math.fround(precision.expectedStockX),
    'Precision probe changed');
  const revisions = await revisionExperiment(candidate);
  const issue = await issueExperiments(candidate);
  const exact = { build: 'manifold-3d@3.5.4', fixtures: hashes, stress: await digest(JSON.stringify(stressHashes)),
    revisions: await digest(JSON.stringify(revisions.hashes)), authored: revisions.sourceSha256 };
  return { exact, observations, direct, roleEvidence, precision, revisions, issue,
    stress: { acceptedStress, maximumStressError, stressRefusals } };
}

function checkVitrineSections(mesh, source) {
  const { bands, volume } = vitrineSections(source);
  const maxAreaError = Math.max(...bands.map(({ range: [lo, hi], area }) =>
    Math.abs(sliceArea(mesh, (lo + hi) / 2) - area)));
  const volumeError = Math.abs(meshTopology(mesh).volume - volume);
  ensure(maxAreaError < 1e-7 && volumeError < 1e-7, 'Casework section or direct volume mismatch');
  return { maxAreaError, volumeError };
}

function negativeControls(candidate, source, reference, good) {
  const moved = structuredClone(source);
  // Punch the same shape into a plain block at a different location; volume stays the same.
  const normal = { base: source.base, ops: [source.ops[0]] };
  moved.ops[0].operand.lo[0] += 0.035;
  moved.ops[0].operand.hi[0] += 0.035;
  const bad = candidate.evaluate({ base: moved.base, ops: [moved.ops[0]] });
  const shifted = inspect(bad, arrangement(normal));
  ensure(shifted.volumeError < 1e-7 && !shifted.geometry, 'Oracle missed a volume-preserving shifted recess');
  const retagged = { ...good, triangles: good.triangles.map(t => ({ ...t, role: 'stock/z+' })) };
  const roles = inspect(retagged, reference);
  ensure(roles.geometry && !roles.provenance, 'Oracle missed damaged provenance');
  const holed = { ...good, triangles: good.triangles.slice(1) };
  ensure(!inspect(holed, reference).geometry, 'Oracle missed open edges');
  const duplicate = { ...good, triangles: [...good.triangles, good.triangles[0]] };
  ensure(!inspect(duplicate, reference).geometry, 'Oracle missed duplicated face');
}

export function timings(api) {
  const candidate = kernel(api);
  const timings = {};
  for (const [name, source, reps] of [['vitrine', casework(), 100], ['8 cuts', windowWall(8), 60],
    ['40 cuts (beyond scope)', windowWall(40), 30]]) {
    const reference = name.startsWith('40') ? null : arrangement(source);
    const meshMs = [];
    const validationMs = [];
    const directMs = [];
    let triangles;
    for (let i = -5; i < reps; i++) {
      const start = performance.now();
      const mesh = candidate.evaluate(source);
      const copied = performance.now();
      if (reference) {
        const validation = inspect(mesh, reference);
        ensure(validation.geometry && validation.provenance, 'Invalid benchmark mesh: ' + name);
      }
      const validated = performance.now();
      if (reference) directMesh(arrangement(source));
      const built = performance.now();
      if (i >= 0) {
        meshMs.push(copied - start);
        if (reference) {
          validationMs.push(validated - copied);
          directMs.push(built - validated);
        }
      }
      triangles = mesh.triangles.length;
    }
    const quantiles = samples => {
      samples.sort((a, b) => a - b);
      return [0.5, 0.95].map(p => Number(samples[Math.ceil(samples.length * p) - 1].toFixed(3)));
    };
    timings[name] = {
      reps, triangles, meshMs: quantiles(meshMs),
      oracleMs: reference ? quantiles(validationMs) : null,
      directMs: reference ? quantiles(directMs) : null,
    };
  }
  return timings;
}
