// Derived geometry becomes ink here, once, for every scene that shows it.
//
// A scene builder produces a *description* (faces, lines, labels, dots) and a UI
// description; this module is the only place that decides what a derived surface
// looks like and which layer it paints on. Two scenes showing the same object —
// the walk tab and a corpus row, a roof and a corpus roof — therefore cannot drift.

import { LAYERS, PALETTE } from '../render/ink.js';
import { fmt } from './format.js';

const LINE_STYLE = {
  ridge: { stroke: PALETTE.ink, width: 1.9 },
  hip: { stroke: PALETTE.ink, width: 1.6 },
  valley: { stroke: '#35506b', width: 1.9 },
  crease: { stroke: 'rgba(36,31,25,0.55)', width: 1.0 },
  abutment: { stroke: PALETTE.red, width: 1.2, dash: [4, 3] },
};

// What the paper calls a derived line, when a creator hovers it. A kind with no
// name here has nothing to say on hover, so a new seam shows silence rather than
// leaking its identifier into the sheet. The authored lines — an eave (its own
// handle's tip), the walk, the rail — are deliberately absent.
export const LINE_NAME = {
  ridge: 'Ridge',
  hip: 'Hip',
  valley: 'Valley',
  crease: 'Break',
  abutment: 'Step',
  gableEdge: 'Gable end',
};

// ------------------------------------------------------------------ roofs

// A built field (one volume or several) → faces, seam ink, and eave handles.
// `handles` is the roof demo's: a scene that only shows a roof (a host, a corpus
// row) must not offer to drag an eave it does not own.
export function roofInk(built, { selected = null, labels = false, handles = true } = {}) {
  const faces = [];
  const lines = [];
  const marks = [];
  const dots = [];

  for (const patch of built.patches) {
    // one base tone: the planes are told apart by orientation, not by tint
    const feature = patch.volume.isFeature;
    faces.push({
      poly3: patch.poly3,
      color: feature ? PALETTE.roofFeature : PALETTE.roof[0],
      kind: 'roof',
      volume: patch.volume.id,
      layer: feature ? LAYERS.feature : LAYERS.surface,
    });
  }
  for (const v of built.verticals) {
    const color = v.kind === 'gable' ? PALETTE.gable : v.kind === 'fascia' ? PALETTE.fascia : PALETTE.cheek;
    faces.push({
      poly3: v.quad,
      color,
      kind: v.kind,
      layer: v.volume?.isFeature ? LAYERS.feature : LAYERS.surface,
    });
  }
  for (const s of built.skirts) {
    faces.push({ poly3: s.quad, color: PALETTE.wall, kind: 'wall', layer: LAYERS.under });
  }

  for (const c of built.creases) {
    lines.push({ a3: c.a3, b3: c.b3, ...(LINE_STYLE[c.kind] || LINE_STYLE.crease), kind: c.kind, length: c.length });
  }

  // eave boundary: the line the roof sits on, and the handle that edits its run
  for (const roof of built.roofs) for (const e of roof.allEaves) {
    const z = roof.eaveZ;
    const isSelected = selected === e.id;
    lines.push({
      a3: [e.a[0], z, e.a[1]], b3: [e.b[0], z, e.b[1]],
      stroke: isSelected ? PALETTE.blue : 'rgba(36,31,25,0.55)',
      width: isSelected ? 2.6 : 1.1,
      kind: e.kind === 'gable' ? 'gableEdge' : 'eave',
      id: e.id,
    });
    if (handles && e.kind === 'eave') {
      dots.push({
        p: [e.mid[0], z, e.mid[1]], r: isSelected ? 5.2 : 3.4,
        fill: isSelected ? '#ffffff' : PALETTE.paper, stroke: PALETTE.blue, lw: isSelected ? 2 : 1.2,
        handle: { kind: 'eave', id: e.id, edgeIndex: e.edgeIndex, run: e.run },
      });
    }
  }

  if (labels) {
    const longest = (kind) => built.creases.filter((c) => c.kind === kind).sort((a, b) => b.length - a.length)[0];
    const valley = longest('valley');
    if (valley) marks.push({ p: valley.at, text: `valley · ${fmt(valley.length)} m`, color: '#2c465e', dx: 8, dy: -2 });
    const ridge = longest('ridge');
    if (ridge) marks.push({ p: ridge.at, text: `ridge · ${fmt(ridge.length)} m`, dx: 8, dy: -2 });
  }

  return { faces, lines, labels: marks, dots };
}

// ------------------------------------------------------------------ walks

// A built walk → the stair and the rail. The frame and the infill are already in
// the geometry; this only decides tone.
export function walkInk(w) {
  const faces = w.faces.map((f) => ({
    poly3: f.poly3,
    color: colorForWalk(f.role),
    kind: f.role,
    layer: LAYERS.surface,
    alpha: f.role === 'glass' ? 0.72 : undefined,
  }));

  const lines = [];
  for (const r of w.rails) {
    for (let i = 0; i < r.path.length - 1; i++) {
      lines.push({ a3: r.path[i], b3: r.path[i + 1], stroke: PALETTE.ink, width: 1.6, kind: 'rail' });
    }
  }
  // the authored walk line, a hair under the rail so the two never read as one
  const path = w.path;
  for (let i = 0; i < path.pts.length - 1; i++) {
    const a = path.pts[i], b = path.pts[i + 1];
    lines.push({
      a3: [a[0], w.lineY(path.s[i]), a[1]], b3: [b[0], w.lineY(path.s[i + 1]), b[1]],
      stroke: PALETTE.blue, width: 1.6, dash: [5, 3], kind: 'walk',
    });
  }

  return { faces, lines };
}

function colorForWalk(role) {
  switch (role) {
    case 'tread': return PALETTE.tread;
    case 'riser': return PALETTE.riser;
    case 'platform': return PALETTE.platform;
    case 'stringer': return PALETTE.stringer;
    case 'rail': return PALETTE.woodDark;
    case 'post': return PALETTE.post;
    case 'ribbon': return PALETTE.ribbon;
    case 'glass': return PALETTE.glass;
    default: return PALETTE.tread;
  }
}
