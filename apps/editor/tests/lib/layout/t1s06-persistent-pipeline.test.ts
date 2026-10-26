/** Count and differential falsifiers for complete retained edit operations.
 * Timing lives in the bounded Node comparison, never in assertions here. */
import { describe, expect, it } from 'vitest';
import {
 compileWallFirstLayoutGeometry, createLayoutCompileSession, ensureLayoutWorldIndex,
 planExactWallLength, planRigidWallMove, withLayoutCompileSession, setWorkObserver,
 indexedCompiledWall, indexedCompiledWallQueries, linkClonedCowCandidate,
 type LayoutDocumentWallFirst, type CompiledLayoutGeometry
} from '@portfolio/layout-core';
import { immutableF4Data } from '@portfolio/project-model';
import { createWallRepresentation } from '$lib/render/layout-wall-representation';
import { createObjectRepresentation } from '$lib/render/layout-object-representation';
import { buildScaleFixture, SCALE_FIXTURE_SEEDS } from './__fixtures__/layout-scale-fixtures';

function observe<T>(run: () => T) {
 const counts = new Map<string, number>();
 const prior = setWorkObserver({ span() {}, count(name, amount) { counts.set(name, (counts.get(name) ?? 0) + amount); } });
 try { return { result: run(), counts }; } finally { setWorkObserver(prior); }
}
function flatSlots(counts: Map<string, number>): number {
 return [...counts].filter(([name]) => name.startsWith('materialize:')).reduce((sum, [, amount]) => sum + amount, 0);
}
function exact(geometry: CompiledLayoutGeometry): string { return JSON.stringify(geometry); }

describe('persistent candidate → certification → compile → indexed consumer → mesh installation', () => {
 for (const roomCount of [10, 100, 400]) it(`keeps all container work bounded over 24 realistic edits with ${roomCount} Rooms`, async () => {
  let document = immutableF4Data(buildScaleFixture({ ...SCALE_FIXTURE_SEEDS.small, roomCount }));
  const target = document.walls[4]!;
  const session = createLayoutCompileSession();
  let geometry = session.compile(document).geometry;
  ensureLayoutWorldIndex(document);
  const walls = createWallRepresentation(), objects = createObjectRepresentation();
  walls.update(geometry); objects.update(geometry);
  const original = exact(geometry);
  const originalGeometry = geometry;
  for (let step = 0; step < 24; step += 1) {
   const previous = geometry;
   const measured = observe(() => {
    const plan = withLayoutCompileSession(session, () => planRigidWallMove(document, { wallId: target.id, delta: [0, step % 2 ? -0.01 : 0.01] }));
    if (plan.kind !== 'success') throw new Error(plan.rejection.message);
    const next = plan.acceptance!.geometry;
    expect(indexedCompiledWall(next, target.id)?.wallId).toBe(target.id);
    expect(indexedCompiledWallQueries(next, target.id)?.spans.length).toBeGreaterThan(0);
    const wallStats = walls.update(next); const objectStats = objects.update(next);
    expect(wallStats.built).toBeLessThanOrEqual(4); expect(objectStats.built).toBe(0);
    return { document: plan.document, geometry: next };
   });
   document = measured.result.document; geometry = measured.result.geometry;
   // Includes candidate arrays, world maps, spatial maintenance, query output
   // assembly and both imperative renderers. No missing global-copy allowance.
   expect(flatSlots(measured.counts)).toBe(0);
   expect(measured.counts.get('storage:seed-entries') ?? 0).toBe(0);
   expect(measured.counts.get('storage:vector-slots-copied') ?? 0).toBeLessThan(1200);
   expect(measured.counts.get('representation:wall-entry-test') ?? 0).toBeLessThanOrEqual(4);
   expect(measured.counts.get('representation:object-entry-test') ?? 0).toBe(0);
   expect(measured.counts.get('representation:child-array-scan-bound') ?? 0).toBe(0);
   expect(measured.counts.get('index:node-test') ?? 0).toBeLessThan(400);
   expect(session.stats().wallsEvaluated).toBeLessThanOrEqual(3);
   expect(exact(geometry) === exact(compileWallFirstLayoutGeometry(document).geometry)).toBe(true);
   // Reading complete old results must never reveal an in-place session update.
   expect(exact(originalGeometry)).toBe(original);
   expect(previous).not.toBe(geometry);
   // Pointer samples are separate jobs; WeakRef liveness lasts through a job.
   await new Promise<void>((resolve) => setImmediate(resolve));
  }
  walls.dispose(); objects.dispose(); session.reset();
 // The exhaustive cold/output oracle dominates this test under full-suite
 // worker contention. Runtime is measured separately, without assertions here.
 }, 120_000);
 it('restores deeply immutable historical compile roots and safely branches from an old revision', () => {
  const session = createLayoutCompileSession();
  let document = immutableF4Data(buildScaleFixture(SCALE_FIXTURE_SEEDS.small));
  ensureLayoutWorldIndex(document);
  const roots: { document: LayoutDocumentWallFirst; geometry: CompiledLayoutGeometry; bytes: string }[] = [];
  for (let step = 0; step < 8; step += 1) {
   const geometry = session.compile(document).geometry;
   roots.push({ document, geometry, bytes: exact(geometry) });
   const plan = withLayoutCompileSession(session, () => planRigidWallMove(document, { wallId: document.walls[4]!.id, delta: [0, 0.01] }));
   if (plan.kind !== 'success') throw new Error(plan.rejection.message);
   document = immutableF4Data(plan.document); linkClonedCowCandidate(plan.document, document);
  }
  for (const root of roots.toReversed()) {
   const { result, counts } = observe(() => session.compile(root.document));
   expect(result.geometry).toBe(root.geometry);
   expect(counts.get('compile:historical-root-restore')).toBe(1);
   expect(counts.get('storage:vector-node-read') ?? 0).toBe(0);
   expect(flatSlots(counts)).toBe(0);
   expect(exact(result.geometry)).toBe(root.bytes);
  }
  const old = roots[2]!;
  const branch = withLayoutCompileSession(session, () => planExactWallLength(old.document, { wallId: old.document.walls[4]!.id, length: 8, fixedEndpoint: 'start' }));
  if (branch.kind !== 'success') throw new Error(branch.rejection.message);
  expect(exact(branch.acceptance!.geometry)).toBe(exact(compileWallFirstLayoutGeometry(branch.document).geometry));
  expect(exact(old.geometry)).toBe(old.bytes);
 });
 it('does not mistake a shallow-frozen, mutable source for a restorable immutable root', () => {
  const document = buildScaleFixture(SCALE_FIXTURE_SEEDS.small);
  Object.freeze(document);
  const session = createLayoutCompileSession(); session.compile(document);
  const { result, counts } = observe(() => session.compile(document));
  expect(counts.get('compile:historical-root-restore') ?? 0).toBe(0);
  expect(exact(result.geometry) === exact(compileWallFirstLayoutGeometry(document).geometry)).toBe(true);
 });
});
