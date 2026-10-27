// Scene-level tests: the card is part of the claim, so it gets tested with the geometry.
import test from 'node:test';
import assert from 'node:assert/strict';
import { PLANS, applyRoofChip, roofScene, roofState, selectEave } from '../src/scenes/roof.js';
import { applyDormerChip, dormerScene, dormerState } from '../src/scenes/dormer.js';
import { walkScene, walkState } from '../src/scenes/walk.js';
import { LINE_NAME } from '../src/scenes/faces.js';


const fact = (scene, name) => (scene.ui.facts.find((f) => f[0] === name) || [])[1];
const metres = (scene, name) => parseFloat(fact(scene, name));

test('with no dormer the card still tells the truth about the host', () => {
  const scene = dormerScene({ dormers: [], sel: null, next: 1 });
  assert.equal(fact(scene, 'Host ridge'), '6.3 m', 'the host ridge does not depend on a selection');
  assert.equal(fact(scene, 'Dormers'), '0');
  assert.equal(scene.ui.note, null, 'no dormer, no reading');
  assert.equal(scene.ui.selection, null);
});

test('a dormer reads as a dormer, and as a cross-gable once it passes the ridge', () => {
  const low = dormerState();
  const asDormer = dormerScene(low);
  assert.equal(fact(asDormer, 'Selected'), 'Dormer');
  assert.match(asDormer.ui.note, /^Reading: dormer/);

  const high = dormerState();
  high.dormers[0].rise = 3.4;
  const asCross = dormerScene(high);
  assert.equal(fact(asCross, 'Selected'), 'Cross-gable');
  assert.match(asCross.ui.note, /^Reading: cross-gable/);
});

test('a gable that would run away is declined, and the card says why', () => {
  const state = roofState();
  state.plan = 'courtyard';
  state.sel = 'roof:e0';
  applyRoofChip(state, 'gable');
  assert.equal(state.gables[0], undefined, 'the state never enters the invalid shape');
  assert.ok(state.refuse && state.refuse.text.includes('gable'));
  const scene = roofScene(state);
  assert.ok(scene.ui.issues.some((i) => i.text === state.refuse.text), 'the refusal reaches the card');
});

test('a gable at a short end, with eaves opposite, is still accepted', () => {
  const state = roofState();
  state.plan = 'ell';
  state.sel = 'roof:e1'; // the 4 m end of the bar, closed by the two 3 m runs
  applyRoofChip(state, 'gable');
  assert.equal(state.gables[1], true);
  assert.equal(state.refuse, null);
  const scene = roofScene(state);
  assert.deepEqual(scene.ui.issues, []);
  assert.ok(scene.faces.some((f) => f.kind === 'gable'), 'the end is drawn as a gable face');
  assert.equal(fact(scene, 'Selected'), 'Gable end');
});

test('a gable that a plan switch makes illegal is drawn as an eave and said so', () => {
  const state = roofState();
  state.plan = 'ell';
  state.sel = 'roof:e1';
  applyRoofChip(state, 'gable');
  assert.equal(state.gables[1], true);

  // same edge index, a different plan where that wall has no eave inside its run:
  // the state still holds the gable, so the scene has to settle it rather than
  // draw a wall standing above the roof
  state.plan = 'offaxis';
  const scene = roofScene(state);
  assert.ok(scene.ui.issues.some((i) => /drawn as an eave/.test(i.text)), 'the card says what changed');
  assert.equal(fact(scene, 'Selected'), 'Eave 2', 'the reading follows the drawn edge, not the request');
  assert.ok(!scene.faces.some((f) => f.kind === 'gable'), 'no gable face is drawn');
  assert.equal(
    metres(scene, 'Peak'),
    metres(roofScene({ ...state, gables: {} }), 'Peak'),
    'the drawn roof is the eave roof, not an extrapolation',
  );
  assert.equal(fact(scene, 'Selected'), 'Eave 2');
});

test('a refusal leaves with the end it was made about', () => {
  const state = roofState();
  state.plan = 'courtyard';
  state.sel = 'roof:e0';
  applyRoofChip(state, 'gable');
  assert.ok(state.refuse, 'the click is declined in words');
  assert.ok(roofScene(state).ui.issues.some((i) => i.text === state.refuse.text), 'and the card shows it');

  selectEave(state, 'roof:e2'); // a different end of the same ring
  assert.equal(state.refuse, null, 'the sentence does not follow the selection');
  const after = roofScene(state);
  assert.equal(fact(after, 'Selected'), 'Eave 3');
  assert.deepEqual(after.ui.issues, [], 'nothing left on the card about the end you left');

  // reselecting the same end keeps its refusal: it still describes the eave in front of you
  const same = roofState();
  same.plan = 'courtyard';
  same.sel = 'roof:e0';
  applyRoofChip(same, 'gable');
  const text = same.refuse.text;
  selectEave(same, 'roof:e0');
  assert.equal(same.refuse && same.refuse.text, text);
});

test('every hoverable line is named for a creator, never by an internal kind', () => {
  const seen = new Set();
  const collect = (scene) => scene.lines.forEach((l) => seen.add(l.kind));

  for (const plan of Object.keys(PLANS)) {
    for (const section of ['straight', 'gambrel', 'mansard', 'vault']) {
      const s = roofState();
      s.plan = plan;
      s.section = section;
      collect(roofScene(s));
      s.sel = 'roof:e0';
      s.gables = { 0: true };
      collect(roofScene(s)); // a gable end, and whatever the field makes of the seam
    }
  }
  collect(dormerScene(dormerState()));
  const raised = dormerState();
  raised.dormers[0].rise = 3.4;
  collect(dormerScene(raised));
  for (const kind of ['spiral', 'L', 'straight']) {
    const s = walkState();
    s.kind = kind;
    collect(walkScene(s));
  }

  const silent = new Set(['eave', 'walk', 'rail']); // authored lines: nothing to explain on hover
  for (const kind of seen) {
    assert.ok(LINE_NAME[kind] || silent.has(kind), `a ${kind} line reaches the sheet with no creator name`);
  }
  assert.ok(seen.has('gableEdge'), 'the case that used to leak is covered');
  for (const [kind, name] of Object.entries(LINE_NAME)) {
    assert.match(name, /^[A-Z][a-z]*( [a-z]+)*$/, `${kind} reads as "${name}"`);
  }
});

test('every plan and every edge: the drawing and the reading agree about the end', () => {
  for (const plan of Object.keys(PLANS)) {
    for (let edge = 0; edge < PLANS[plan].outline.length; edge++) {
      const state = roofState();
      state.plan = plan;
      state.sel = `roof:e${edge}`;
      state.gables = { [edge]: true };
      const scene = roofScene(state);
      const where = `${plan} edge ${edge}`;
      const refused = scene.ui.issues.find((i) => /cannot be a gable/.test(i.text));
      if (refused) {
        assert.match(refused.text, /drawn as an eave/, `${where}: a refusal must say what is drawn instead`);
        assert.notEqual(fact(scene, 'Selected'), 'Gable end', `${where}: the reading must not say gable`);
        assert.ok(!scene.faces.some((f) => f.kind === 'gable'), `${where}: no gable face`);
        assert.equal(
          metres(scene, 'Peak'),
          metres(roofScene({ ...state, gables: {} }), 'Peak'),
          `${where}: nothing is drawn that the eave roof does not reach`,
        );
      } else {
        assert.equal(fact(scene, 'Selected'), 'Gable end', `${where}: drawn as a gable, read as one`);
        assert.ok(scene.faces.some((f) => f.kind === 'gable'), `${where}: the gable face exists`);
      }
    }
  }
});

test('removing the last dormer leaves a card with no dormer reading at all', () => {
  const state = dormerState();
  applyDormerChip(state, 'remove');
  assert.equal(state.dormers.length, 0);
  assert.equal(state.sel, null);
  const scene = dormerScene(state);
  assert.equal(fact(scene, 'Selected'), undefined);
  assert.equal(fact(scene, 'Peak'), undefined);
  assert.equal(fact(scene, 'Dormers'), '0');
  assert.equal(scene.ui.note, null);
  assert.equal(scene.ui.selection, null);
  assert.ok(!scene.dots.some((d) => d.handle && d.handle.kind === 'dormerHeight'), 'no handle for a dormer that is not there');
});
