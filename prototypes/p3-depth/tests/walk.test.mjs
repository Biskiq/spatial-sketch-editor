import test from 'node:test';
import assert from 'node:assert/strict';
import { buildWalk } from '../src/core/walk.js';

const straight = (extra = {}) => ({
  id: 's', kind: 'line', points: [[0, 0], [4.2, 0]],
  fromY: 0, toY: 2.8, width: 1.15, turn: 'landing',
  rail: { sides: [1, -1], height: 0.95, frame: 'upright', infill: 'ribbon' },
  ...extra,
});

test('a straight stair derives treads, a valid riser and a going', () => {
  const w = buildWalk(straight());
  assert.ok(w.facts.treads >= 14, `treads: ${w.facts.treads}`);
  assert.ok(Math.abs(w.facts.riser - 2.8 / w.facts.treads) < 1e-9);
  assert.ok(w.facts.riser > 0.15 && w.facts.riser < 0.2, `riser ${w.facts.riser}`);
  assert.ok(w.facts.going > 0.24, `going ${w.facts.going}`);
  assert.equal(w.issues.filter((i) => i.code === 'riser').length, 0);
  const treads = w.faces.filter((f) => f.role === 'tread');
  assert.equal(treads.length, w.facts.treads);
  assert.ok(w.faces.some((f) => f.role === 'stringer'));
});

test('too short a run reports the riser with a fix rather than drawing a broken stair', () => {
  const w = buildWalk(straight({ points: [[0, 0], [1.4, 0]] }));
  const issue = w.issues.find((i) => i.code === 'riser' || i.code === 'going');
  assert.ok(issue, 'an issue is reported');
  assert.ok(issue.fix.length > 10, 'the issue names a fix');
});

test('an L takes a landing: it is level, it costs one riser, and the rail is level across it', () => {
  const w = buildWalk({
    kind: 'polyline', points: [[0, 0], [3.2, 0], [3.2, 2.6]],
    fromY: 0, toY: 2.8, width: 1.2, turn: 'landing',
    rail: { sides: [1, -1], height: 0.95, frame: 'upright', infill: 'ribbon' },
  });
  const platforms = w.faces.filter((f) => f.role === 'platform');
  assert.ok(platforms.length >= 1, 'a landing exists');
  const ys = platforms[0].poly3.map((p) => p[1]);
  assert.ok(ys.every((y) => Math.abs(y - ys[0]) < 1e-9), 'the landing is level');
  // the rail over the landing must be level too
  const landingYs = w.rails[0].points
    .filter((q) => q.s > 3.2 && q.s < 3.2 + 1.2 + 1e-6)
    .map((q) => q.y);
  if (landingYs.length > 1) assert.ok(landingYs.every((y) => Math.abs(y - landingYs[0]) < 1e-6), 'the rail is level over the landing');
});

test('a turn read as winders fans the treads instead of flattening a landing', () => {
  const w = buildWalk({
    kind: 'polyline', points: [[0, 0], [3.2, 0], [3.2, 2.6]],
    fromY: 0, toY: 2.8, width: 1.2, turn: 'winders',
    rail: { sides: [1, -1], height: 0.95, frame: 'upright', infill: 'ribbon' },
  });
  assert.equal(w.faces.filter((f) => f.role === 'platform' && f.winder).length, 2, 'two winder treads');
  assert.equal(w.facts.platforms, 1);
  const winderYs = w.faces.filter((f) => f.winder).map((f) => f.poly3[0][1]);
  assert.ok(Math.max(...winderYs) - Math.min(...winderYs) > 0.1, 'the winders step up');
});

test('a helix is one walk: radial treads, both rails, a band between them', () => {
  const w = buildWalk({
    kind: 'helix', helix: { cx: 0, cy: 0, r: 1.9, turns: 1.25, start: 0, dir: 1 },
    fromY: 0, toY: 3.1, width: 1.15, turn: 'landing',
    rail: { sides: [1, -1], height: 0.95, frame: 'upright', infill: 'ribbon' },
  });
  assert.ok(w.facts.treads > 14, `treads ${w.facts.treads}`);
  assert.ok(w.facts.riser > 0.15 && w.facts.riser < 0.2, `riser ${w.facts.riser}`);
  assert.equal(w.rails.length, 2);
  const inner = w.rails.find((r) => r.side === 1);
  assert.ok(w.facts.railLength > 10, `rail length ${w.facts.railLength}`);
  assert.ok(w.facts.bandArea > 2, `band area ${w.facts.bandArea}`);
  assert.ok(w.facts.innerGoing !== null);
});

test('the upright frame keeps the band vertical; the pitch frame tilts it', () => {
  const mk = (frame) => buildWalk({
    kind: 'helix', helix: { cx: 0, cy: 0, r: 2.2, turns: 1.5 },
    fromY: 0, toY: 3.2, width: 1.15,
    rail: { sides: [1], height: 0.95, frame, infill: 'ribbon' },
  });
  const up = mk('upright').faces.find((f) => f.role === 'ribbon');
  const pitch = mk('pitch').faces.find((f) => f.role === 'ribbon');
  const vertical = (f) => {
    const xs = f.poly3.map((p) => [p[0], p[2]]);
    return Math.abs(xs[0][0] - xs[3][0]) < 1e-6 && Math.abs(xs[0][1] - xs[3][1]) < 1e-6;
  };
  assert.ok(vertical(up), 'the upright band has vertical sides');
  assert.equal(vertical(pitch), false, 'the pitch band leans with the path');
});

test('a tight well is refused in words with a fix', () => {
  const w = buildWalk({
    kind: 'helix', helix: { cx: 0, cy: 0, r: 0.55, turns: 1.5 },
    fromY: 0, toY: 2.8, width: 1.15,
    rail: { sides: [1, -1], height: 0.95, frame: 'upright', infill: 'ribbon' },
  });
  const issue = w.issues.find((i) => i.code === 'well');
  assert.ok(issue, 'the well is reported');
  assert.ok(/well|radius|width/i.test(issue.fix), issue.fix);
});
