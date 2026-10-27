/** A local sign certificate must agree with the canonical face sum despite
 * accumulated delta error and cancellation at large world coordinates. */
import { describe, expect, it } from 'vitest';
import {
 clearTopologyGateObserverForTest, compileWallFirstLayoutGeometry,
 createLayoutCompileSession, ensureLayoutWorldIndex, planRigidWallMove,
 setTopologyGateObserverForTest, withLayoutCompileSession,
 type LayoutDocumentWallFirst, type PrecisionPlan
} from '@portfolio/layout-core';
import { buildScaleFixture, SCALE_FIXTURE_SEEDS } from './__fixtures__/layout-scale-fixtures';

function coldPlan(document: LayoutDocumentWallFirst, wallId: string, delta: number): PrecisionPlan {
 setTopologyGateObserverForTest(() => {});
 try { return planRigidWallMove(document, { wallId, delta: [0, delta] }); }
 finally { clearTopologyGateObserverForTest(); }
}

describe('topology area sign certification', () => {
 it('matches cold success/refusal and complete output through repeated edits and cancellation', () => {
  for (const offset of [0, 1e5, 1e8]) {
   let document = buildScaleFixture({ ...SCALE_FIXTURE_SEEDS.small, roomCount: 1, bezierFraction: 0, openingsPerRoom: 0, objectsPerRoom: 0 });
   for (const junction of document.junctions) junction.point = [junction.point[0] + offset, junction.point[1] + offset];
   const target = document.walls[0]!.id;
   const session = createLayoutCompileSession(); session.compile(document); ensureLayoutWorldIndex(document);
   for (let step = 0; step < 128; step += 1) {
    const delta = step % 2 ? -0.003 : 0.003;
    const local = withLayoutCompileSession(session, () => planRigidWallMove(document, { wallId: target, delta: [0, delta] }));
    const cold = coldPlan(document, target, delta);
    expect(local.kind).toBe(cold.kind);
    if (local.kind === 'success' && cold.kind === 'success') {
     expect(JSON.stringify(local.document)).toBe(JSON.stringify(cold.document));
     expect(JSON.stringify(local.acceptance!.geometry)).toBe(JSON.stringify(compileWallFirstLayoutGeometry(cold.document).geometry));
     document = local.document;
    } else if (local.kind === 'rejected' && cold.kind === 'rejected') {
     expect(local.rejection).toEqual(cold.rejection);
    }
   }
   session.reset();
  }
 }, 30_000);
});
