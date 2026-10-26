// The dormer demo: a host roof, and boxes that stand on it.
//
// Owns: the demo host, where a dormer may be placed, and the reading of one
// raised volume as a dormer or a cross-gable. Owns no ink: faces come from
// ./faces.js, so the dormer paints exactly like the roof it stands on.

import { buildRoofs } from '../core/roof.js';
import { pointInPoly } from '../core/plan.js';
import { PALETTE } from '../render/ink.js';
import { roofInk } from './faces.js';
import { clamp, fmt } from './format.js';

const rect = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];

export const HOST = {
  id: 'house',
  outline: rect(0, 0, 13, 8),
  eaveZ: 3.1,
  rise: 3.2,
  section: 'straight',
  edges: [
    { kind: 'eave', run: 4.0 },
    { kind: 'gable' },
    { kind: 'eave', run: 4.0 },
    { kind: 'gable' },
  ],
};

export function dormerState() {
  return {
    dormers: [
      { id: 'd1', cx: 6.4, cy: 2.1, w: 2.2, d: 2.6, rise: 1.9, front: -1, mode: 'gable' },
    ],
    sel: 'd1',
    next: 2,
  };
}

// A dormer is a small roof volume in the host's plan: a gable or a shed at the
// front, an open back where it merges into the host.
function dormerFeature(d, hostZ) {
  const frontY = d.cy + d.front * (d.d / 2);
  const backY = d.cy - d.front * (d.d / 2);
  const y0 = Math.min(frontY, backY), y1 = Math.max(frontY, backY);
  const outline = [[d.cx - d.w / 2, y0], [d.cx + d.w / 2, y0], [d.cx + d.w / 2, y1], [d.cx - d.w / 2, y1]];
  const atFront = d.front < 0;
  const frontEdge = atFront ? 0 : 2; // edges: 0 south, 1 east, 2 north, 3 west
  const backEdge = atFront ? 2 : 0;
  const gable = d.mode === 'gable';
  const edges = [
    frontEdge === 0 ? (gable ? { kind: 'gable' } : { kind: 'eave', run: d.d }) : null,
    { kind: gable ? 'eave' : 'gable', run: d.w / 2 },
    frontEdge === 2 ? (gable ? { kind: 'gable' } : { kind: 'eave', run: d.d }) : null,
    { kind: gable ? 'eave' : 'gable', run: d.w / 2 },
  ].map((e, i) => e || (i === backEdge ? { kind: 'open' } : { kind: 'eave', run: 1 }));
  return {
    id: d.id,
    outline,
    eaveZ: hostZ + 0.06,
    rise: d.rise,
    section: 'straight',
    edges,
    mode: d.mode,
  };
}

export function dormerScene(state) {
  // the host surface, sampled for placement only
  const hostOnly = buildRoofs([HOST]);
  const hostZ = (p) => {
    let best = -Infinity;
    for (const c of hostOnly.cells) {
      if (pointInPoly(p, c.poly)) best = Math.max(best, c.zAt(p));
    }
    return best;
  };

  const feats = state.dormers.map((d) => dormerFeature(d, hostZ([d.cx, d.cy + d.front * (d.d / 2)])));
  const built = buildRoofs([{ ...HOST, features: feats }]);
  const ink = roofInk(built, { handles: false });

  // The host's ridge is a fact about the host, not about the selection: with no
  // dormer on the roof it must still read true.
  const sel = state.dormers.find((d) => d.id === state.sel);
  const dormerVol = sel ? built.roofs[0].features.find((f) => f.id === sel.id) : null;
  const hostPeak = HOST.eaveZ + HOST.rise;
  let reading = null, peak = 0;
  if (sel && dormerVol) {
    peak = dormerVol.eaveZ + dormerVol.rise;
    reading = peak >= hostPeak - 0.12 ? 'Cross-gable' : 'Dormer';
    ink.dots.push(
      {
        p: [sel.cx, dormerVol.eaveZ + dormerVol.rise, sel.cy], r: 5,
        stroke: PALETTE.blue, fill: '#fff', handle: { kind: 'dormerHeight', id: sel.id },
      },
      {
        p: [sel.cx + sel.w / 2, dormerVol.eaveZ + sel.rise * 0.45, sel.cy], r: 4.4,
        stroke: PALETTE.blue, fill: PALETTE.paper, handle: { kind: 'dormerWidth', id: sel.id },
      },
    );
  }

  const facts = [
    ['Host ridge', `${fmt(hostPeak)} m`],
    ['Dormers', `${state.dormers.length}`],
    ['Field', `${fmt(built.stats.ms, 1)} ms`],
    ['Valleys', `${fmt(built.stats.lengths.valley)} m`],
    ['Cheeks', `${built.verticals.filter((v) => v.kind === 'cheek').length}`],
  ];
  if (sel && dormerVol) {
    facts.push(['Selected', reading || 'Dormer']);
    facts.push(['Width × depth', `${fmt(sel.w, 2)} × ${fmt(sel.d, 2)} m`]);
    facts.push(['Rise', `${fmt(sel.rise, 2)} m`]);
    facts.push(['Peak', `${fmt(peak)} m`]);
  }

  const issues = [];
  for (const i of built.issues) issues.push({ text: i.text, fix: i.fix });
  if (sel && peak < HOST.eaveZ + 0.25) {
    issues.push({ text: 'This dormer is too low: its roof falls below the main roof before it can meet it.', fix: 'Raise it, or make it shallower.' });
  }
  const onValley = built.creases.some((c) => c.kind === 'valley' && c.volumes.includes(state.sel));
  if (!onValley && dormerVol) {
    issues.push({ text: 'The dormer sits entirely above the roof: it reads as a box, with no valley to meet the slope.', fix: 'Move it down-slope until its foot meets the roof.' });
  }

  return {
    faces: ink.faces,
    lines: ink.lines,
    labels: ink.labels,
    dots: ink.dots,
    shadowRings: [HOST.outline],
    ui: {
      kicker: 'Dormer',
      title: 'A dormer is a step, not an element',
      lede: 'Click a slope. The dormer is a second field over the first: where it wins you see its roof; where it loses, its cheeks are the step. Its valleys are the foot of that step — and when it reaches the main ridge, the drawing stops calling it a dormer.',
      // no dormer, no reading: silence is true, a stale sentence is not
      note: !sel || !dormerVol
        ? null
        : reading === 'Cross-gable'
          ? 'Reading: cross-gable. Same object, same facts — only its height changed.'
          : 'Reading: dormer. Its ridge is below the main ridge, so its front gable is a face on the slope.',
      chips: [
        { group: 'mode', id: 'mode:gable', label: 'Gable dormer', active: sel?.mode === 'gable' },
        { group: 'mode', id: 'mode:shed', label: 'Shed dormer', active: sel?.mode === 'shed' },
        { group: 'do', id: 'add', label: 'Add a dormer' },
        { group: 'do', id: 'remove', label: 'Remove' },
      ],
      facts,
      issues,
      hint: 'Click a slope to place a dormer. Drag the white dot to raise it; drag the small dot to widen it.',
      selection: sel && dormerVol ? { title: reading || 'Dormer', actions: [] } : null,
    },
  };
}

// ------------------------------------------------------------------ handles

// Each handle owns its tip, the value it grabs, and what a drag does with it.
// The shell looks the kind up and calls it; it never reads this demo's state.
export const dormerHandles = {
  dormerHeight: {
    tip: '<b>Height</b> · drag',
    begin(state, handle) {
      const d = state.dormers.find((x) => x.id === handle.id);
      return d ? d.rise : null;
    },
    drag(state, handle, { dy }, base) {
      const d = state.dormers.find((x) => x.id === handle.id);
      if (d) d.rise = clamp(base - dy * 0.012, 0.35, 4);
    },
  },
  dormerWidth: {
    tip: '<b>Width</b> · drag',
    begin(state, handle) {
      const d = state.dormers.find((x) => x.id === handle.id);
      return d ? d.w : null;
    },
    drag(state, handle, { dx }, base) {
      const d = state.dormers.find((x) => x.id === handle.id);
      if (d) d.w = clamp(base + dx * 0.02, 0.9, 4.2);
    },
  },
};

// ------------------------------------------------------------------ actions

export function applyDormerChip(state, id) {
  const sel = state.dormers.find((d) => d.id === state.sel);
  if (id === 'add') {
    const d = { id: `d${state.next++}`, cx: 8.6, cy: 3.4, w: 1.8, d: 2.8, rise: 1.4, front: -1, mode: 'gable' };
    state.dormers.push(d);
    state.sel = d.id;
  } else if (id === 'remove' && sel) {
    state.dormers = state.dormers.filter((d) => d.id !== sel.id);
    state.sel = state.dormers[0]?.id || null;
  } else if (id.startsWith('mode:') && sel) {
    sel.mode = id.slice(5);
  }
}

export function addDormerAt(state, p) {
  const d = {
    id: `d${state.next++}`,
    cx: Math.max(1.1, Math.min(11.9, p[0])),
    cy: Math.max(1.8, Math.min(6.2, p[1])),
    w: 1.8, d: 2.8, rise: 1.4, front: p[1] < 4 ? -1 : 1, mode: 'gable',
  };
  state.dormers.push(d);
  state.sel = d.id;
}
