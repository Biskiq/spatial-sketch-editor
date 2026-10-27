// The walk demo: one line between two levels, and everything a stair and a rail
// derive from it.
//
// Owns: the three authored walks, the demo's staging (a newel, a slab at the top,
// the two handles) and the card's words. Owns no ink: the stair and the rail come
// from ./faces.js, so a corpus walk paints exactly like this one.

import { buildWalk } from '../core/walk.js';
import { LAYERS, PALETTE } from '../render/ink.js';
import { walkInk } from './faces.js';
import { clamp, fmt } from './format.js';

export function walkState() {
  return {
    kind: 'spiral',
    turn: 'landing',
    rise: 3.1,
    width: 1.15,
    radius: 1.85,
    turns: 1.25,
    frame: 'upright',
    infill: 'ribbon',
    sides: [1, -1],
  };
}

function walkSpec(state) {
  const rail = { sides: state.sides, height: 0.95, frame: state.frame, infill: state.infill };
  const shared = { id: 'w', fromY: 0, toY: state.rise, width: state.width, turn: state.turn, rail };
  if (state.kind === 'spiral') {
    return {
      ...shared,
      kind: 'helix',
      helix: { cx: 0, cy: 0, r: state.radius, turns: state.turns, start: Math.PI * 0.5, dir: 1 },
    };
  }
  if (state.kind === 'L') {
    return { ...shared, kind: 'polyline', points: [[-2.2, -1.4], [1.5, -1.4], [1.5, 1.6]] };
  }
  return { ...shared, kind: 'line', points: [[-2.4, 0], [2.6, 0]] };
}

export function walkScene(state) {
  const spec = walkSpec(state);
  const w = buildWalk(spec);
  const ink = walkInk(w);
  const faces = ink.faces;
  const path = w.path;
  const endP = path.pts[path.pts.length - 1];

  // A newel and a slab at the top: staging, not derived geometry, so they live
  // here rather than in the shared ink.
  if (state.kind === 'spiral') {
    const { cx, cy } = spec.helix;
    const top = state.rise + 0.95;
    const sides = 12;
    for (let i = 0; i < sides; i++) {
      const a0 = (i / sides) * Math.PI * 2, a1 = ((i + 1) / sides) * Math.PI * 2;
      const p0 = [cx + 0.11 * Math.cos(a0), 0, cy + 0.11 * Math.sin(a0)];
      const p1 = [cx + 0.11 * Math.cos(a1), 0, cy + 0.11 * Math.sin(a1)];
      faces.push({
        poly3: [p0, p1, [p1[0], top, p1[2]], [p0[0], top, p0[2]]],
        color: PALETTE.woodDark, kind: 'column', layer: LAYERS.surface,
      });
    }
  }
  faces.push({
    poly3: [
      [endP[0] - 1.4, state.rise - 0.06, endP[1] - 1.4], [endP[0] + 1.4, state.rise - 0.06, endP[1] - 1.4],
      [endP[0] + 1.4, state.rise - 0.06, endP[1] + 1.4], [endP[0] - 1.4, state.rise - 0.06, endP[1] + 1.4],
    ],
    color: '#ded4c2', kind: 'floor', layer: LAYERS.surface,
  });

  const dots = [{
    p: [endP[0], state.rise + 0.95, endP[1]], r: 5, stroke: PALETTE.blue, fill: '#fff',
    handle: { kind: 'walkRise' },
  }];
  if (state.kind === 'spiral') {
    dots.push({
      p: [spec.helix.cx + state.radius * 0.7, 0.35, spec.helix.cy + state.radius * 0.7],
      r: 4.4, stroke: PALETTE.blue, fill: PALETTE.paper,
      handle: { kind: 'walkRadius' },
    });
  }

  const f = w.facts;
  const facts = [
    ['Rise', `${fmt(f.rise, 2)} m`],
    ['Riser', `${fmt(f.riser * 1000, 0)} mm`],
    ['Treads', `${f.treads}${f.platforms ? ` + ${f.platforms} turn` : ''}`],
    ['Going', `${fmt(f.going * 100, 0)} cm`],
    ['Rail length', `${fmt(f.railLength, 1)} m`],
    ['Band', `${fmt(f.bandArea, 1)} m²`],
    ['Posts', `${f.posts}`],
  ];
  if (f.innerGoing !== null) facts.push(['At the newel', `${fmt(f.innerGoing * 100, 0)} cm`]);

  const chips = [
    { group: 'kind', id: 'kind:spiral', label: 'Spiral', active: state.kind === 'spiral' },
    { group: 'kind', id: 'kind:L', label: 'L stair', active: state.kind === 'L' },
    { group: 'kind', id: 'kind:straight', label: 'Straight', active: state.kind === 'straight' },
    { group: 'turn', id: 'turn:landing', label: 'Landing', active: state.turn === 'landing' },
    { group: 'turn', id: 'turn:winders', label: 'Winders', active: state.turn === 'winders' },
    { group: 'frame', id: 'frame:upright', label: 'Upright frame', active: state.frame === 'upright' },
    { group: 'frame', id: 'frame:pitch', label: 'Pitch frame', active: state.frame === 'pitch' },
    { group: 'infill', id: 'infill:ribbon', label: 'Ribbon', active: state.infill === 'ribbon' },
    { group: 'infill', id: 'infill:balusters', label: 'Balusters', active: state.infill === 'balusters' },
    { group: 'infill', id: 'infill:glass', label: 'Glass', active: state.infill === 'glass' },
    { group: 'infill', id: 'infill:none', label: 'Handrail only', active: state.infill === 'none' },
  ];

  return {
    faces, lines: ink.lines, labels: [], dots,
    shadowRings: [],
    ui: {
      kicker: 'One walk',
      title: 'A stair is a walk; a rail is the walk offset',
      lede: 'Treads, winders, landings, stringers, posts and infill are derived from one line and a total rise. The handrail follows the pitch line — never the stepped tread tops — and its frame is a fact you can see.',
      note: state.kind === 'spiral'
        ? 'Helical: the inner rail is steeper than the outer. Both are the same walk, offset by the walk width.'
        : state.turn === 'winders'
          ? 'The turn is read as winders: the treads fan and keep rising. The rail is continuous through them.'
          : 'The turn is read as a landing: it is level, it costs one riser, and the rail flattens across it.',
      chips,
      facts,
      issues: w.issues.map((i) => ({ text: i.text, fix: i.fix })),
      hint: 'Drag the white dot to change the total rise; on the spiral, drag the small dot to change the well. Drag empty paper to turn the table.',
      selection: null,
    },
  };
}

// ------------------------------------------------------------------ handles

// The two handles are the walk's own gestures: the total rise, and the well of a
// spiral. Each grabs its value at pointerdown and drags from there.
export const walkHandles = {
  walkRise: {
    tip: '<b>Total rise</b> · drag',
    begin: (state) => state.rise,
    drag(state, handle, { dy }, base) {
      state.rise = clamp(base - dy * 0.02, 1.4, 7);
    },
  },
  walkRadius: {
    tip: '<b>Well</b> · drag',
    begin: (state) => state.radius,
    drag(state, handle, { dx, dy }, base) {
      state.radius = clamp(base + (-dx + dy) * 0.01, 0.4, 5);
    },
  },
};

// ------------------------------------------------------------------ actions

export function applyWalkChip(state, id) {
  if (id.startsWith('kind:')) state.kind = id.slice(5);
  else if (id.startsWith('turn:')) state.turn = id.slice(5);
  else if (id.startsWith('frame:')) state.frame = id.slice(6);
  else if (id.startsWith('infill:')) state.infill = id.slice(7);
}
