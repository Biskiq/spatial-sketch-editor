// The corpus demo: every fixture, built live by the same evaluator as the demos.
//
// This scene owns the row selection and the evidence card, and nothing about how
// a roof or a walk is drawn: both come from ./faces.js, which is the point — a
// corpus row is the same object the other tabs show.

import { buildRoofs } from '../core/roof.js';
import { buildWalk } from '../core/walk.js';
import { ROOF_CASES, WALK_CASES, runCorpus } from '../core/corpus.js';
import { roofInk, walkInk } from './faces.js';
import { fmt } from './format.js';

export function corpusState() {
  return { sel: 'ell', results: null };
}

export function corpusScene(state) {
  if (!state.results) state.results = runCorpus();
  const rows = [
    ...state.results.roof.map((r) => ({ ...r, kind: 'roof' })),
    ...state.results.walk.map((r) => ({ ...r, kind: 'walk' })),
  ];
  const row = rows.find((r) => r.id === state.sel) || rows[0];
  const isRoof = row.kind === 'roof';
  const fixture = isRoof ? ROOF_CASES.find((x) => x.id === row.id) : WALK_CASES.find((x) => x.id === row.id);

  const walk = isRoof ? null : buildWalk(fixture.spec);
  const built = isRoof ? buildRoofs([].concat(fixture.spec)) : null;
  const ink = isRoof ? roofInk(built) : walkInk(walk);

  const issues = fixture.control
    ? [{ text: fixture.control, fix: 'This is the specialist boundary: name it, do not approximate it.' }]
    : !isRoof
      ? walk.issues.map((i) => ({ text: i.text, fix: i.fix }))
      : [];
  if (isRoof && row.status === 'refused' && !fixture.control) {
    issues.push({ text: row.reason || 'Refused.', fix: 'Adjust the fixture until it qualifies.' });
  }

  const facts = [
    ['Ordinary cover', state.results.summary.ordinaryBuilt],
    ['Refused in words', `${state.results.summary.refusals}`],
    ['Median', `${fmt(state.results.summary.medianMs, 2)} ms`],
    ['Worst', `${fmt(state.results.summary.maxMs, 1)} ms`],
    ['Walks', state.results.summary.walksBuilt],
  ];

  const roofRows = state.results.roof.map((r) => ({
    id: r.id, label: r.name, status: r.status, sel: r.id === row.id,
    cells: [r.name, r.status === 'built' ? 'built' : 'refused', `${fmt(r.ms, 1)} ms`, `${fmt(r.valley, 1)} m`],
  }));
  const walkRows = state.results.walk.map((r) => ({
    id: r.id, label: r.name, status: r.status, sel: r.id === row.id,
    cells: [r.name, r.status === 'built' ? 'built' : 'refused', `${fmt(r.ms, 1)} ms`, `${r.treads} tr`],
  }));

  return {
    faces: ink.faces, lines: ink.lines, labels: ink.labels || [], dots: [],
    shadowRings: built ? built.roofs.map((r) => r.outline) : [],
    ui: {
      kicker: 'Evidence',
      title: 'The corpus, run live',
      lede: 'Fixtures from the research roof corpus and helical set, built by the same evaluator as the demos. Refusals are results: three controls are named rather than approximated.',
      note: row.status === 'built'
        ? `${row.name}: built${isRoof ? ` · ${row.cells} plan cells · ${fmt(row.valley, 1)} m of valley` : ` · ${row.treads} treads · ${fmt(row.rail, 1)} m of rail`}.`
        : `${row.name}: refused. ${row.reason || ''}`,
      chips: [],
      facts,
      issues,
      hint: 'Click a row to build it. Costs are one evaluation in this browser, not a benchmark.',
      table: { roofRows, walkRows },
    },
  };
}
