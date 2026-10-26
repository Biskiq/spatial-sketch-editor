// The corpus: fixtures from the research's F10 roof corpus and F11 helical set,
// plus the controls the research expects to be specialist work.

import { buildRoofs } from './roof.js';
import { buildWalk } from './walk.js';

const rect = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
const eaves = (n, run) => Array.from({ length: n }, () => ({ kind: 'eave', run }));

const HOST = {
  id: 'house',
  outline: rect(0, 0, 14, 8),
  eaveZ: 3.1,
  rise: 2.9,
  section: 'straight',
  edges: [
    { kind: 'eave', run: 4.0 },
    { kind: 'gable' },
    { kind: 'eave', run: 4.0 },
    { kind: 'gable' },
  ],
};

function dormerFeature({ id = 'd', cx, cy, w, d, rise, front = -1, mode = 'gable', eaveZ }) {
  const y0 = Math.min(cy + front * (d / 2), cy - front * (d / 2));
  const y1 = Math.max(cy + front * (d / 2), cy - front * (d / 2));
  const outline = [[cx - w / 2, y0], [cx + w / 2, y0], [cx + w / 2, y1], [cx - w / 2, y1]];
  const atFront = front < 0;
  const frontEdge = atFront ? 0 : 2;
  const edges = [
    frontEdge === 0 ? (mode === 'gable' ? { kind: 'gable' } : { kind: 'eave', run: d }) : null,
    mode === 'gable' ? { kind: 'eave', run: w / 2 } : { kind: 'gable' },
    frontEdge === 2 ? (mode === 'gable' ? { kind: 'gable' } : { kind: 'eave', run: d }) : null,
    mode === 'gable' ? { kind: 'eave', run: w / 2 } : { kind: 'gable' },
  ].map((e, i) => e || (i === (atFront ? 2 : 0) ? { kind: 'open' } : { kind: 'eave', run: 1 }));
  return { id, outline, eaveZ, rise, section: 'straight', edges, mode };
}

export const ROOF_CASES = [
  {
    id: 'gable', name: 'Gable rectangle', group: 'plan',
    spec: { ...HOST, id: 'gable' },
  },
  {
    id: 'hip', name: 'Hip rectangle', group: 'plan',
    spec: { id: 'hip', outline: rect(0, 0, 12, 7), eaveZ: 3, rise: 2.6, edges: eaves(4, 3.5) },
  },
  {
    id: 'shed', name: 'Shed (one eave)', group: 'plan',
    spec: {
      id: 'shed', outline: rect(0, 0, 10, 6), eaveZ: 3, rise: 2.2,
      edges: [{ kind: 'eave', run: 6 }, { kind: 'gable' }, { kind: 'gable' }, { kind: 'gable' }],
    },
  },
  {
    id: 'ell', name: 'L plan, all eaves', group: 'plan',
    spec: {
      id: 'ell', outline: [[0, 0], [11, 0], [11, 4], [4, 4], [4, 10], [0, 10]],
      eaveZ: 3, rise: 2.0, edges: eaves(6, 3),
    },
  },
  {
    id: 'tee', name: 'T plan, all eaves', group: 'plan',
    spec: {
      id: 'tee', outline: [[0, 0], [14, 0], [14, 4.4], [9, 4.4], [9, 9.6], [5, 9.6], [5, 4.4], [0, 4.4]],
      eaveZ: 3, rise: 2.0, edges: eaves(8, 2.6),
    },
  },
  {
    id: 'you', name: 'U plan, all eaves', group: 'plan',
    spec: {
      id: 'you', outline: [[0, 0], [16, 0], [16, 9], [12, 9], [12, 4], [4, 4], [4, 9], [0, 9]],
      eaveZ: 3, rise: 2.0, edges: eaves(8, 2.6),
    },
  },
  {
    id: 'plus', name: 'Plus plan, all eaves', group: 'plan',
    spec: {
      id: 'plus',
      outline: [[5, 0], [11, 0], [11, 5], [16, 5], [16, 11], [11, 11], [11, 16], [5, 16], [5, 11], [0, 11], [0, 5], [5, 5]],
      eaveZ: 3, rise: 2.0, edges: eaves(12, 2.6),
    },
  },
  {
    id: 'offaxis', name: 'Off-axis hexagon', group: 'plan',
    spec: {
      id: 'offaxis', outline: [[0, 0], [9.4, 0.6], [12.2, 4.0], [9.4, 7.6], [3.0, 8.6], [-0.8, 4.4]],
      eaveZ: 3, rise: 2.4, edges: eaves(6, 2.8),
    },
  },
  {
    id: 'courtyard', name: 'Courtyard', group: 'plan',
    spec: {
      id: 'courtyard', outline: rect(0, 0, 16, 11), holes: [rect(6.2, 3.6, 10.4, 7.4)],
      eaveZ: 3, rise: 2.2, edges: eaves(4, 3),
    },
  },
  {
    id: 'twopitch', name: 'Unequal pitches', group: 'plan',
    spec: {
      id: 'twopitch', outline: rect(0, 0, 12, 8), eaveZ: 3, rise: 2.9,
      edges: [{ kind: 'eave', run: 2.6 }, { kind: 'gable' }, { kind: 'eave', run: 5.4 }, { kind: 'gable' }],
    },
  },
  {
    id: 'crossgable', name: 'Cross-gable (raised volume)', group: 'compound',
    spec: {
      ...HOST,
      id: 'crossgable',
      features: [dormerFeature({ id: 'cross', cx: 6.2, cy: 4.0, w: 3.0, d: 7.4, rise: 3.6, front: -1, mode: 'gable', eaveZ: 3.1 })],
    },
  },
  {
    id: 'dormer', name: 'Gable dormer', group: 'hosted',
    spec: {
      ...HOST,
      id: 'dormer',
      features: [dormerFeature({ id: 'd1', cx: 4.0, cy: 3.2, w: 1.9, d: 2.9, rise: 1.6, front: -1, mode: 'gable', eaveZ: 4.5 })],
    },
  },
  {
    id: 'shedDormer', name: 'Shed dormer', group: 'hosted',
    spec: {
      ...HOST,
      id: 'shedDormer',
      features: [dormerFeature({ id: 'd1', cx: 4.0, cy: 3.0, w: 2.6, d: 2.6, rise: 1.5, front: -1, mode: 'shed', eaveZ: 4.3 })],
    },
  },
  {
    id: 'twodormers', name: 'Two dormers', group: 'hosted',
    spec: {
      ...HOST,
      id: 'twodormers',
      features: [
        dormerFeature({ id: 'd1', cx: 3.6, cy: 3.2, w: 1.8, d: 2.9, rise: 1.5, front: -1, mode: 'gable', eaveZ: 4.5 }),
        dormerFeature({ id: 'd2', cx: 9.6, cy: 3.2, w: 1.8, d: 2.9, rise: 1.5, front: -1, mode: 'gable', eaveZ: 4.5 }),
      ],
    },
  },
  {
    id: 'stepped', name: 'Stepped wing', group: 'compound',
    spec: {
      ...HOST,
      id: 'stepped',
      features: [{
        id: 'wing', outline: rect(8.4, 0.4, 13.6, 7.6), eaveZ: 4.4, rise: 2.2, section: 'straight',
        edges: eaves(4, 2.4),
      }],
    },
  },
  {
    id: 'leanto', name: 'Lean-to against a wall', group: 'compound',
    spec: [
      { ...HOST, id: 'leanHost' },
      {
        // the eave sits on the wall side (x = 14) and the roof falls away from it,
        // so the slope closes in one run across the 3 m depth
        id: 'leanto', outline: rect(14, 0, 17, 7.8), eaveZ: 2.3, rise: 2.0, section: 'straight',
        edges: [
          { kind: 'gable' }, { kind: 'gable' }, { kind: 'gable' }, { kind: 'eave', run: 3.0 },
        ],
      },
    ],
  },
  {
    id: 'gambrel', name: 'Gambrel section', group: 'section',
    spec: { ...HOST, id: 'gambrel', section: 'gambrel', rise: 3.0 },
  },
  {
    id: 'vault', name: 'Vault section', group: 'section',
    spec: { ...HOST, id: 'vault', section: 'vault', rise: 2.7 },
  },
  {
    id: 'mansard', name: 'Mansard section', group: 'section',
    spec: { ...HOST, id: 'mansard', section: 'mansard', rise: 3.2 },
  },
  {
    id: 'eyebrow', name: 'Eyebrow dormer', group: 'control',
    control: 'The cheek folds under the roof: an eyebrow is not a height field, and the field refuses it instead of drawing a guess.',
    spec: HOST,
  },
  {
    id: 'overroof', name: 'Roof over roof', group: 'control',
    control: "The lower roof's eave would sit under another roof, with no surface above it. Split the plan into two roofs instead.",
    spec: HOST,
  },
  {
    id: 'vaultdormer', name: 'Dormer on a vault', group: 'control',
    control: 'A curved section meets a vertical cheek in a curve. This prototype keeps the profile and the compound apart rather than sampling a lie.',
    spec: { ...HOST, id: 'vaultdormer', section: 'vault' },
  },
];

export const WALK_CASES = [
  {
    id: 'w-straight', name: 'Straight', group: 'walk',
    spec: { kind: 'line', points: [[-2.4, 0], [2.6, 0]], fromY: 0, toY: 2.9, width: 1.15, turn: 'landing', rail: { sides: [1, -1], height: 0.95, frame: 'upright', infill: 'ribbon' } },
  },
  {
    id: 'w-landing', name: 'L with a landing', group: 'walk',
    spec: { kind: 'polyline', points: [[-2.2, -1.4], [1.5, -1.4], [1.5, 1.6]], fromY: 0, toY: 2.9, width: 1.2, turn: 'landing', rail: { sides: [1, -1], height: 0.95, frame: 'upright', infill: 'ribbon' } },
  },
  {
    id: 'w-winders', name: 'L with winders', group: 'walk',
    spec: { kind: 'polyline', points: [[-2.2, -1.4], [1.5, -1.4], [1.5, 1.6]], fromY: 0, toY: 2.9, width: 1.2, turn: 'winders', rail: { sides: [1, -1], height: 0.95, frame: 'upright', infill: 'ribbon' } },
  },
  {
    id: 'w-u', name: 'U stair with two landings', group: 'walk',
    spec: { kind: 'polyline', points: [[-2.2, -1.2], [1.6, -1.2], [1.6, 1.2], [-2.2, 1.2]], fromY: 0, toY: 4.2, width: 1.15, turn: 'landing', rail: { sides: [1, -1], height: 0.95, frame: 'upright', infill: 'ribbon' } },
  },
  {
    id: 'w-helix', name: 'Spiral, 1¼ turns', group: 'walk',
    spec: { kind: 'helix', helix: { cx: 0, cy: 0, r: 1.9, turns: 1.25 }, fromY: 0, toY: 3.1, width: 1.15, turn: 'landing', rail: { sides: [1, -1], height: 0.95, frame: 'upright', infill: 'ribbon' } },
  },
  {
    id: 'w-helix2', name: 'Spiral, 2 turns, glass', group: 'walk',
    spec: { kind: 'helix', helix: { cx: 0, cy: 0, r: 2.3, turns: 2 }, fromY: 0, toY: 4.4, width: 1.15, turn: 'landing', rail: { sides: [1, -1], height: 0.95, frame: 'upright', infill: 'glass' } },
  },
  {
    id: 'w-tight', name: 'Spiral, tight well', group: 'control',
    spec: { kind: 'helix', helix: { cx: 0, cy: 0, r: 0.55, turns: 1.5 }, fromY: 0, toY: 2.8, width: 1.15, turn: 'landing', rail: { sides: [1, -1], height: 0.95, frame: 'upright', infill: 'ribbon' } },
  },
  {
    id: 'w-steep', name: 'Too short to be a stair', group: 'control',
    spec: { kind: 'line', points: [[0, 0], [1.3, 0]], fromY: 0, toY: 2.8, width: 1.15, turn: 'landing', rail: { sides: [1, -1], height: 0.95, frame: 'upright', infill: 'ribbon' } },
  },
];

export function runRoofCase(c) {
  const t0 = performance.now();
  const built = buildRoofs([].concat(c.spec));
  const ms = performance.now() - t0;
  const s = built.stats;
  return {
    id: c.id, name: c.name, group: c.group,
    status: c.control ? 'refused' : 'built',
    reason: c.control || null,
    ms, cells: s.cells, patches: s.patches,
    ridge: s.lengths.ridge, hip: s.lengths.hip, valley: s.lengths.valley,
    peak: s.peak, features: s.counts,
  };
}

export function runWalkCase(c) {
  const t0 = performance.now();
  const w = buildWalk(c.spec);
  const ms = performance.now() - t0;
  return {
    id: c.id, name: c.name, group: c.group,
    status: w.issues.length ? 'refused' : 'built',
    reason: w.issues.map((i) => i.text).join(' ') || null,
    ms, treads: w.facts.treads, riser: w.facts.riser, going: w.facts.going,
    rail: w.facts.railLength, band: w.facts.bandArea,
    issues: w.issues.length,
  };
}

export function runCorpus() {
  const roof = ROOF_CASES.map(runRoofCase);
  const walk = WALK_CASES.map(runWalkCase);
  const built = roof.filter((r) => r.status === 'built').length;
  const refused = roof.filter((r) => r.status === 'refused').length;
  const ordinary = roof.filter((r) => r.group !== 'control');
  return {
    roof, walk,
    summary: {
      roofBuilt: `${built}/${roof.length}`,
      ordinaryBuilt: `${ordinary.filter((r) => r.status === 'built').length}/${ordinary.length}`,
      refusals: refused,
      medianMs: median(roof.map((r) => r.ms)),
      maxMs: Math.max(...roof.map((r) => r.ms)),
      walksBuilt: `${walk.filter((w) => w.status === 'built').length}/${walk.length}`,
    },
  };
}

function median(xs) {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export { HOST, dormerFeature, rect };
