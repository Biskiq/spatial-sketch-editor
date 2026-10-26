// The roof demo: a plan, a section, and the field that derives the rest.
//
// Owns: the four demo plans, the roof demo's authored state, the eave handle and
// the card's words. The gable-legality rule lives with the field that refutes it
// (core/roof.js: settleGables), so the chip and the card cannot word it twice.
// Owns no ink: faces come from ./faces.js.

import { asDrawn, sectionMonotone, SECTIONS, settleGables } from '../core/roof.js';
import { roofInk } from './faces.js';
import { clamp, fmt } from './format.js';

const rect = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];

// ------------------------------------------------------------------ plans

export const PLANS = {
  ell: {
    name: 'L plan',
    outline: [[0, 0], [11, 0], [11, 4], [4, 4], [4, 10], [0, 10]],
    eaveZ: 3.0,
    rise: 3.1,
    run: 3.0,
    note: 'One L, one roof. The inside corner is a valley; the outside corners are hips.',
  },
  t: {
    name: 'T plan',
    outline: [[0, 0], [14, 0], [14, 4.4], [9, 4.4], [9, 9.6], [5, 9.6], [5, 4.4], [0, 4.4]],
    eaveZ: 3.0,
    rise: 3.0,
    run: 3.2,
    note: 'A T needs no wings: the same field carries both arms and the two inside corners.',
  },
  offaxis: {
    name: 'Off-axis',
    outline: [[0, 0], [9.4, 0.6], [12.2, 4.0], [9.4, 7.6], [3.0, 8.6], [-0.8, 4.4]],
    eaveZ: 3.0,
    rise: 3.0,
    run: 3.2,
    note: 'No right angles anywhere. A rectilinear wing decomposition would refuse this plan; the field does not care.',
  },
  courtyard: {
    name: 'Courtyard',
    outline: rect(0, 0, 16, 11),
    holes: [rect(6.2, 3.6, 10.4, 7.4)],
    eaveZ: 3.0,
    rise: 2.6,
    run: 3.0,
    note: 'A courtyard is a hole with its own eaves. The ring reads as a hip roof turned inside out.',
  },
};

const SECTIONS_UI = [
  { id: 'straight', label: 'Straight' },
  { id: 'gambrel', label: 'Gambrel' },
  { id: 'mansard', label: 'Mansard' },
  { id: 'vault', label: 'Vault' },
];

export function roofState() {
  return {
    plan: 'ell',
    section: 'straight',
    runs: {},      // edgeIndex -> run override
    gables: {},    // edgeIndex -> true
    sel: null,     // selected eave id
    refuse: null,  // a declined action, with the reason
    labels: true,
  };
}

// ------------------------------------------------------------------ field

function planRoof(state, gables = state.gables) {
  const p = PLANS[state.plan];
  const edges = p.outline.map((_, i) => (
    gables[i] ? { kind: 'gable' } : { kind: 'eave', run: state.runs[i] ?? p.run }
  ));
  return {
    id: 'roof',
    outline: p.outline,
    holes: p.holes || [],
    eaveZ: p.eaveZ,
    rise: p.rise,
    section: state.section,
    edges,
  };
}

// ------------------------------------------------------------------ scene

export function roofScene(state) {
  const p = PLANS[state.plan];
  const { built, revoked } = settleGables((g) => planRoof(state, g), state.gables);
  const ink = roofInk(built, { selected: state.sel, labels: state.labels });
  const s = built.stats;
  const monotone = sectionMonotone(SECTIONS[state.section] || SECTIONS.straight);

  const selEdge = built.roofs[0].allEaves.find((e) => e.id === state.sel);
  const selGable = selEdge ? selEdge.kind === 'gable' : false;

  const chips = [
    ...Object.entries(PLANS).map(([id, v]) => ({ group: 'plan', id: `plan:${id}`, label: v.name, active: state.plan === id })),
    ...SECTIONS_UI.map((x) => ({ group: 'section', id: `section:${x.id}`, label: x.label, active: state.section === x.id })),
  ];

  const facts = [
    ['Eaves', `${s.eaves}`],
    ['Plan cells', `${s.cells}`],
    ['Valleys', `${fmt(s.lengths.valley)} m`],
    ['Hips', `${fmt(s.lengths.hip)} m`],
    ['Ridge', `${fmt(s.lengths.ridge)} m`],
    ['Peak', `${fmt(s.peak)} m`],
    ['Field', `${fmt(s.ms, 1)} ms`],
  ];
  if (selEdge) {
    facts.push(['Selected', selGable ? 'Gable end' : `Eave ${selEdge.edgeIndex + 1}`]);
    facts.push(selGable ? ['End', 'Gable (vertical)'] : ['Run', `${fmt(selEdge.run, 2)} m`]);
  }

  const issues = [];
  if (state.refuse) issues.push({ text: state.refuse.text, fix: state.refuse.fix });
  for (const r of revoked) {
    // the drawn form is the eave, so say both what was asked and what is shown
    issues.push({ text: asDrawn(r.issue), fix: r.issue.fix });
  }
  for (const i of built.issues) issues.push({ text: i.text, fix: i.fix });
  if (!monotone) {
    issues.push({ text: 'This section dips: the roof would fold over itself.', fix: 'Keep the section rising from eave to ridge.' });
  }

  return {
    faces: ink.faces,
    lines: ink.lines,
    labels: ink.labels,
    dots: ink.dots,
    shadowRings: [built.roofs[0].outline, ...built.roofs[0].holes],
    ui: {
      kicker: 'One field, one section',
      title: 'Compound is not a special case',
      lede: 'The plan decides where planes meet; the section decides what the slope looks like. Pull an eave and the hips, valleys and ridge move with it — none of them was drawn.',
      note: p.note,
      chips,
      facts,
      issues,
      hint: 'Click an eave to select it; drag its dot up or down to steepen or flatten it. Drag empty paper to turn the table.',
      selection: selEdge ? {
        title: selGable ? 'Gable end' : `Eave ${selEdge.edgeIndex + 1}`,
        actions: selGable
          ? [{ id: 'hip', label: 'Give it a hip' }]
          : [{ id: 'gable', label: 'Make this end a gable' }],
      } : null,
    },
  };
}

// ------------------------------------------------------------------ selection

// A selection says which end the card is describing, and a refusal is a
// statement about exactly one end. So changing the selection drops the refusal
// with the end it was made about; reselecting the same end keeps it.
export function selectEave(state, id) {
  if (state.sel !== id) state.refuse = null;
  state.sel = id;
}

// ------------------------------------------------------------------ handles

// The eave's own gesture: the tip it shows, what selection a grab means, and how
// a drag becomes an authored run. The shell looks a handle up by kind and calls
// it; it never reads this demo's state.
export const roofHandles = {
  eave: {
    tip: '<b>Eave</b> · drag to steepen',
    begin(state, handle) { selectEave(state, handle.id); },
    drag(state, handle, { dy }) {
      state.refuse = null;
      const prev = state.runs[handle.edgeIndex] ?? handle.run;
      state.runs[handle.edgeIndex] = clamp(prev - dy * 0.014, 0.55, 9);
    },
  },
};

// ------------------------------------------------------------------ actions

export function applyRoofChip(state, id) {
  state.refuse = null;
  if (id.startsWith('plan:')) state.plan = id.slice(5);
  else if (id.startsWith('section:')) state.section = id.slice(8);
  else if (id === 'gable' && state.sel) {
    const idx = Number(state.sel.split(':e').pop());
    // Refuse the click rather than enter a state the field cannot draw true:
    // with no eave opposite, this end is a wall under a plane past its run.
    const trial = settleGables((g) => planRoof(state, g), { ...state.gables, [idx]: true });
    const refused = trial.revoked.find((r) => r.edgeIndex === idx);
    if (refused) state.refuse = refused.issue;
    else state.gables[idx] = true;
  } else if (id === 'hip' && state.sel) {
    delete state.gables[Number(state.sel.split(':e').pop())];
  }
}
