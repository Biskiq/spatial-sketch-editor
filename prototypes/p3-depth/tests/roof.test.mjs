import test from 'node:test';
import assert from 'node:assert/strict';
import { asDrawn, buildRoofs, sectionMonotone, settleGables, SECTIONS } from '../src/core/roof.js';
import { ROOF_CASES } from '../src/core/corpus.js';

const rect = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
const eaves = (n, run) => Array.from({ length: n }, () => ({ kind: 'eave', run }));
const kinds = (scene) => scene.creases.map((c) => c.kind);

function gableHouse(extra = {}) {
  return {
    id: 'house',
    outline: rect(0, 0, 12, 7),
    eaveZ: 3,
    rise: 3,
    section: 'straight',
    edges: [
      { kind: 'eave', run: 3.5 },
      { kind: 'gable' },
      { kind: 'eave', run: 3.5 },
      { kind: 'gable' },
    ],
    ...extra,
  };
}

test('a hipped rectangle has level ridges and sloping hips, and no valleys', () => {
  const scene = buildRoofs([{
    id: 'hip',
    outline: rect(0, 0, 12, 7),
    eaveZ: 3,
    rise: 3,
    edges: [0, 1, 2, 3].map(() => ({ kind: 'eave', run: 3.5 })),
  }]);
  const k = kinds(scene);
  assert.ok(k.includes('ridge'), 'a level ridge exists');
  assert.ok(k.includes('hip'), 'the ends are hips');
  assert.equal(k.filter((x) => x === 'valley').length, 0, 'no valley on a convex plan');
  assert.ok(scene.stats.peak > 5.9 && scene.stats.peak < 6.01, `peak is the eave plus rise (${scene.stats.peak})`);
});

test('a gable end has no hip and produces a gable face', () => {
  const scene = buildRoofs([gableHouse()]);
  const k = kinds(scene);
  assert.ok(k.includes('ridge'));
  assert.equal(k.filter((x) => x === 'hip').length, 0, 'gable ends do not slope');
  assert.ok(scene.verticals.some((v) => v.kind === 'gable'), 'a gable face closes the end');
});

test('an L plan produces a real valley from the reflex corner', () => {
  const L = [[0, 0], [11, 0], [11, 4], [4, 4], [4, 10], [0, 10]];
  const scene = buildRoofs([{
    id: 'ell',
    outline: L,
    eaveZ: 3,
    rise: 3,
    edges: L.map(() => ({ kind: 'eave', run: 3 })),
  }]);
  const k = kinds(scene);
  assert.ok(k.includes('valley'), 'the inside corner is a valley');
  assert.ok(k.includes('hip'), 'outside corners are hips');
  assert.ok(scene.stats.lengths.valley > 0.5, `valley has length (${scene.stats.lengths.valley})`);
});

test('a courtyard is a hole with its own eaves, and its corners are valleys', () => {
  const scene = buildRoofs([{
    id: 'ring',
    outline: rect(0, 0, 16, 12),
    holes: [rect(6, 4, 10, 8)],
    eaveZ: 3,
    rise: 2.4,
    edges: [0, 1, 2, 3].map(() => ({ kind: 'eave', run: 3 })),
  }]);
  assert.ok(kinds(scene).includes('valley'), 'the courtyard corners are valleys');
  assert.ok(scene.stats.peak > 4, 'the ring rises above the courtyard eave');
});

test('a dormer is a volume on a host: cheeks, valleys, its own ridge', () => {
  const scene = buildRoofs([gableHouse({
    features: [{
      id: 'dormer',
      outline: rect(8.5, 1.6, 10.1, 4.6), // 1.6 wide, runs up the slope
      eaveZ: 4.55,
      rise: 1.15,
      edges: [
        { kind: 'gable' },        // front face
        { kind: 'eave', run: 1.15 }, // side cheek roof
        { kind: 'open' },         // back: merges into the host
        { kind: 'eave', run: 1.15 },
      ],
    }],
  })]);
  const k = kinds(scene);
  assert.ok(k.includes('valley'), 'the dormer meets the host in valleys');
  assert.ok(scene.verticals.some((v) => v.kind === 'cheek' || v.kind === 'step'), 'the dormer has vertical cheeks');
  assert.ok(scene.stats.peak > 5.6, 'the dormer rises above the host at its own ridge');
  assert.ok(scene.creases.some((c) => c.kind === 'valley' && c.volumes.includes('dormer')), 'the dormer foot is a valley');
});

test('gambrel and vault sections change the surface but not the plan features', () => {
  const base = { ...gableHouse(), id: 'sec' };
  const straight = buildRoofs([{ ...base }]);
  const gambrel = buildRoofs([{ ...base, section: 'gambrel' }]);
  const vault = buildRoofs([{ ...base, section: 'vault' }]);
  assert.ok(kinds(gambrel).includes('crease'), 'a gambrel break is drawn as a crease');
  assert.ok(vault.patches.length >= straight.patches.length, 'a curved section is banded');
  assert.equal(
    kinds(straight).filter((x) => x === 'ridge').length,
    kinds(vault).filter((x) => x === 'ridge').length,
    'the ridge plan does not depend on the section shape',
  );
});

test('changing one eave run moves the ridge and keeps it level', () => {
  const house = gableHouse();
  const before = buildRoofs([house]);
  const after = buildRoofs([{
    ...house,
    edges: [
      { kind: 'eave', run: 2.4 },
      { kind: 'gable' },
      { kind: 'eave', run: 4.6 },
      { kind: 'gable' },
    ],
  }]);
  const ridgeY = (scene) => {
    const r = scene.creases.filter((c) => c.kind === 'ridge');
    return r.length ? r[0].at[2] : null;
  };
  assert.notEqual(ridgeY(before), null);
  assert.notEqual(ridgeY(after), null);
  assert.notEqual(Math.round(ridgeY(before) * 10), Math.round(ridgeY(after) * 10), 'the ridge moved');
  const level = after.creases.filter((c) => c.kind === 'ridge').every((c) => Math.abs(c.a3[1] - c.b3[1]) < 0.02);
  assert.ok(level, 'the ridge stays level when pitches differ');
});

test('a gable with no eave opposite is refused instead of drawn tall', () => {
  // the long wall of an L bar: the only eave left opposite it is 4 m away with a 3 m
  // run, so the "gable" would be a wall under a plane that never met a ridge
  const bar = {
    id: 'bar',
    outline: [[0, 0], [11, 0], [11, 4], [4, 4], [4, 10], [0, 10]],
    eaveZ: 3,
    rise: 3.1,
    edges: [{ kind: 'gable' }, ...eaves(5, 3)],
  };
  const bad = buildRoofs([bar]);
  assert.equal(bad.issues.length, 1, 'one refusal, not one per cell');
  assert.equal(bad.issues[0].kind, 'gable-unbounded');
  assert.ok(bad.issues[0].u > 1.3, `the refusal names how far the run is over (${bad.issues[0].u})`);
  assert.ok(bad.issues[0].peak > 6.5, `the refusal names the height it would reach (${bad.issues[0].peak})`);
  assert.match(bad.issues[0].fix, /run/);

  // the same rule must leave a legitimate shed alone: it closes in exactly one run
  const shed = {
    id: 'shed', outline: rect(0, 0, 10, 6), eaveZ: 3, rise: 2.2,
    edges: [{ kind: 'eave', run: 6 }, { kind: 'gable' }, { kind: 'gable' }, { kind: 'gable' }],
  };
  assert.equal(buildRoofs([shed]).issues.length, 0);
});

test('the gable rule settles a spec once, and words the drawing it falls back to', () => {
  // the same L bar: the long wall cannot close inside its run, the 4 m end can
  const bar = (gables) => ({
    id: 'bar',
    outline: [[0, 0], [11, 0], [11, 4], [4, 4], [4, 10], [0, 10]],
    eaveZ: 3,
    rise: 3.1,
    edges: Array.from({ length: 6 }, (_, i) => (gables[i] ? { kind: 'gable' } : { kind: 'eave', run: 3 })),
  });

  const settled = settleGables(bar, { 0: true });
  assert.equal(settled.revoked.length, 1);
  assert.equal(settled.revoked[0].edgeIndex, 0);
  assert.equal(settled.built.issues.filter((i) => i.kind === 'gable-unbounded').length, 0, 'nothing unbounded is built');
  assert.equal(settled.built.roofs[0].allEaves[0].kind, 'eave', 'the end is drawn as an eave');
  assert.match(asDrawn(settled.revoked[0].issue), /\bIt is drawn as an eave instead\.$/);

  const kept = settleGables(bar, { 1: true });
  assert.equal(kept.built.roofs[0].allEaves[1].kind, 'gable', 'a legal end is still drawn as one');
  assert.deepEqual(kept.revoked, [], 'and nothing is said about it');
});

test('a hole inherits its own edge kinds, not the outline\'s', () => {
  // the outline's south edge is a gable; the courtyard's south edge must not be
  const ring = {
    id: 'ring',
    outline: rect(0, 0, 16, 11),
    holes: [rect(6.2, 3.6, 10.4, 7.4)],
    eaveZ: 3,
    rise: 2.6,
    edges: [{ kind: 'gable' }, ...eaves(3, 3)],
  };
  const built = buildRoofs([ring]);
  assert.equal(built.issues.length, 1, 'only the outline end is refused');
  assert.equal(built.issues[0].edge, 'ring:e0');
  assert.equal(built.roofs[0].holeEaves[0].kind, 'eave');
});

test('every ordinary corpus fixture is still accepted by the gable rule', () => {
  for (const c of ROOF_CASES.filter((x) => !x.control)) {
    const built = buildRoofs([].concat(c.spec));
    assert.equal(built.issues.length, 0, `${c.name} reports: ${built.issues.map((i) => i.text).join(' ')}`);
  }
});

test('a section that dips is refused as a non-monotone profile', () => {
  assert.equal(sectionMonotone(SECTIONS.straight), true);
  assert.equal(sectionMonotone(SECTIONS.gambrel), true);
  assert.equal(sectionMonotone([{ u: 0, h: 0 }, { u: 0.5, h: 0.8 }, { u: 0.7, h: 0.4 }, { u: 1, h: 1 }]), false);
});
