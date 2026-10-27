import { describe, expect, it } from 'vitest';
import {
 compileWallFirstLayoutGeometry, createWallSamplingDerivation, createLayoutCompileSession, ensureLayoutWorldIndex, indexedCompiledWall,
 planRigidWallMove, sealCompiledLayoutSnapshot, setWorkObserver, withLayoutCompileSession
} from '@portfolio/layout-core';
import { immutableF4Data } from '@portfolio/project-model';
import { buildScaleFixture, SCALE_FIXTURE_SEEDS } from './__fixtures__/layout-scale-fixtures';

describe('Stage sealing of persistent generated snapshots', () => {
 it('freezes generated facts and lazy array outputs without flattening unrelated query records', () => {
  const document = immutableF4Data(buildScaleFixture(SCALE_FIXTURE_SEEDS.small));
  const session = createLayoutCompileSession();
  const before = session.compile(document).geometry;
  ensureLayoutWorldIndex(document);
  expect(sealCompiledLayoutSnapshot(before)).toBe(true);
  const previousBytes = JSON.stringify(before);
  const plan = withLayoutCompileSession(session, () => planRigidWallMove(document, { wallId: document.walls[4]!.id, delta: [0, 0.01] }));
  if (plan.kind !== 'success' || !plan.acceptance) throw new Error('fixture move refused');
  const after = plan.acceptance.geometry;
  const counts = new Map<string, number>();
  const old = setWorkObserver({ span() {}, count(name, amount) { counts.set(name, (counts.get(name) ?? 0) + amount); } });
  try { expect(sealCompiledLayoutSnapshot(after)).toBe(true); } finally { setWorkObserver(old); }
  expect([...counts].filter(([name]) => name.startsWith('materialize:'))).toEqual([]);
  expect(Object.isFrozen(after)).toBe(true); expect(Object.isFrozen(after.queries)).toBe(true);
  expect(Object.isFrozen(indexedCompiledWall(after, document.walls[4]!.id))).toBe(true);
  // A complete array consumer pays its full output only now; every returned
  // array and its records are immutable, just as at the former full freeze.
  for (const records of Object.values(after.queries)) {
   expect(Object.isFrozen(records)).toBe(true);
   for (const record of records) expect(Object.isFrozen(record)).toBe(true);
  }
  expect(Object.isFrozen(after.walls)).toBe(true); expect(Object.isFrozen(after.rooms)).toBe(true);
  expect(Object.isFrozen(after.junctions)).toBe(true);
  expect(JSON.stringify(before)).toBe(previousBytes);
 });
 it('keeps the generic freeze path for geometry with no retained proof', () => {
  const session = createLayoutCompileSession();
  const geometry = session.compile(buildScaleFixture(SCALE_FIXTURE_SEEDS.small)).geometry;
  const detached = JSON.parse(JSON.stringify(geometry));
  expect(sealCompiledLayoutSnapshot(detached)).toBe(false);
  expect(Object.isFrozen(detached)).toBe(false);
 });
 it('defers the Floor key containing all Room IDs when an extreme Wall changes global bounds', () => {
  const document = immutableF4Data(buildScaleFixture(SCALE_FIXTURE_SEEDS.small));
  const session = createLayoutCompileSession();
  const before = session.compile(document).geometry; ensureLayoutWorldIndex(document); sealCompiledLayoutSnapshot(before);
  const counts = new Map<string, number>();
  const old = setWorkObserver({ span() {}, count(name, amount) { counts.set(name, (counts.get(name) ?? 0) + amount); } });
  try {
   const plan = withLayoutCompileSession(session, () => planRigidWallMove(document, { wallId: document.walls[0]!.id, delta: [0, -0.01] }));
   if (plan.kind !== 'success' || !plan.acceptance) throw new Error('extreme move refused');
   const after = plan.acceptance.geometry;
   expect(after.bounds).not.toEqual(before.bounds);
   sealCompiledLayoutSnapshot(after);
   expect(counts.get('cache-key:deferred-floor-built') ?? 0).toBe(0);
   expect(after.floors[0]!.cacheKey).toBeTruthy();
   expect(counts.get('cache-key:deferred-floor-built')).toBe(1);
   // A genuine full-output consumer still receives exactly the canonical key.
   expect(after.floors[0]!.cacheKey).toBe(compileWallFirstLayoutGeometry(plan.document).geometry.floors[0]!.cacheKey);
  } finally { setWorkObserver(old); }
 });

 it('does not reuse a sampling wrapper across revisions or seed default sampling from it', () => {
  const document = immutableF4Data(buildScaleFixture(SCALE_FIXTURE_SEEDS.small));
  const canonical = createWallSamplingDerivation(); let requests = 0;
  const wrapper = { ...canonical, samples: (...args: Parameters<typeof canonical.samples>) => { requests += 1; return canonical.samples(...args); } };
  const session = createLayoutCompileSession();
  const first = session.compile(document, wrapper); const before = requests;
  const second = session.compile(document, wrapper);
  expect(requests).toBeGreaterThan(before);
  expect(JSON.stringify(second) === JSON.stringify(first)).toBe(true);
  expect(JSON.stringify(session.compile(document)) === JSON.stringify(compileWallFirstLayoutGeometry(document))).toBe(true);
  const originalSamples = canonical.samples;
  canonical.samples = (...args) => { requests += 1; return originalSamples(...args); };
  session.compile(document, canonical); const modifiedBefore = requests;
  session.compile(document, canonical);
  expect(requests).toBeGreaterThan(modifiedBefore);
 });

});
