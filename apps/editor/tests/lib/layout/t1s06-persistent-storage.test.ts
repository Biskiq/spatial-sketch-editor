import { describe, expect, it } from 'vitest';
import { PersistentMap, PersistentVector } from '../../../../../packages/layout-core/src/persistent-store';
import { freezeF4Data, immutableF4Data } from '@portfolio/project-model';
import { buildScaleFixture, SCALE_FIXTURE_SEEDS } from './__fixtures__/layout-scale-fixtures';
import { setWorkObserver, cowCreateObject, cowSetWallScalar, recordPreparedCowCandidate, consumePreparedCowCandidate, rememberImmutableJsonNode, createLayoutCompileSession, withLayoutCompileSession, planRigidWallMove, linkClonedCowCandidate } from '@portfolio/layout-core';

function counted<T>(run: () => T) {
 const counts = new Map<string, number>();
 const prior = setWorkObserver({ span() {}, count(name, amount) { counts.set(name, (counts.get(name) ?? 0) + amount); } });
 try { return { value: run(), counts }; } finally { setWorkObserver(prior); }
}

describe('persistent storage roots', () => {
 it('branches maps through rotations and deletions without changing older roots', () => {
  const map = PersistentMap.from<number, number>([]), oracle = new Map<number, number>();
  const versions: { root: ReturnType<typeof map.fork>; entries: [number, number][] }[] = [];
  for (let i = 0; i < 500; i += 1) {
   const key = (i * 31) % 137;
   if (i % 3 === 0) { map.delete(key); oracle.delete(key); } else { map.set(key, i); oracle.set(key, i); }
   if (i % 25 === 0) versions.push({ root: map.fork(), entries: [...oracle].sort((a, b) => a[0] - b[0]) });
   expect([...map]).toEqual([...oracle].sort((a, b) => a[0] - b[0]));
   expect(map.root?.height ?? 0).toBeLessThanOrEqual(Math.ceil(1.45 * Math.log2(map.size + 2)));
  }
  for (const version of versions) expect([...version.root]).toEqual(version.entries);
 });
 it('copies bounded vector blocks and paths at non-power-of-two lengths', () => {
  for (const length of [0, 1, 31, 32, 33, 63, 64, 65, 1001]) {
   const input = Array.from({ length }, (_, index) => index);
   const root = PersistentVector.from(input);
   if (length === 0) { expect(root.toArray()).toEqual([]); continue; }
   const next = root.set(length - 1, -1).set(0, -2);
   const expected = [...input]; expected[length - 1] = -1; expected[0] = -2;
   expect(next.toArray()).toEqual(expected); expect(root.toArray()).toEqual(input);
   const different: number[] = []; next.diff(root, (index) => different.push(index));
   expect(different).toEqual(length === 1 ? [0] : [0, length - 1]);
  }
 });
 it('borrows a frozen 100,000-slot root and lazily copies only the edited path', () => {
  const array = Object.freeze(Array.from({ length: 100_000 }, (_, i) => i));
  const { value: root, counts: seed } = counted(() => PersistentVector.fromFrozen(array));
  expect(seed.get('storage:vector-slots-copied') ?? 0).toBe(0);
  const { value: branch, counts } = counted(() => root.set(50_001, -1));
  expect(counts.get('storage:vector-slots-copied')).toBeLessThanOrEqual(32);
  expect(branch.get(50_001)).toBe(-1); expect(root.get(50_001)).toBe(50_001);
  const diffs: number[] = [];
  const diff = counted(() => branch.diff(root, (index) => diffs.push(index)));
  expect(diffs).toEqual([50_001]);
  expect(diff.counts.get('storage:vector-diff-slot') ?? 0).toBeLessThanOrEqual(32);
  const sealed = new WeakSet<object>(); root.visitUnseen(sealed, () => {});
  const proof = counted(() => branch.visitUnseen(sealed, () => {}));
  expect(proof.counts.get('storage:vector-proof-slot') ?? 0).toBeLessThanOrEqual(32);
 });
 it('reuses only F4-owned captured JSON and detaches a merely shallow-frozen input', () => {
  const input = Object.freeze({ child: { value: 1 } });
  const captured = immutableF4Data(input);
  input.child.value = 2; expect(captured.child.value).toBe(1);
  const { value: recaptured, counts } = counted(() => immutableF4Data(captured));
  expect(recaptured).toBe(captured); expect(counts.get('f4:clone') ?? 0).toBe(0);
  const map = immutableF4Data(new Map([['key', { value: 1 }]]));
  expect(immutableF4Data(map)).not.toBe(map);
  const customArray = Object.freeze(Object.setPrototypeOf([1], Object.create(Array.prototype)));
  expect(rememberImmutableJsonNode(customArray)).toBe(false);
 });
 it('shares already captured JSON children while detaching new containers and preserving aliases', () => {
  const owned = immutableF4Data({ stable: { value: 1 } });
  const fresh = { value: 2 };
  const input = { stable: owned.stable, left: fresh, right: fresh };
  const captured = immutableF4Data(input);
  expect(captured.stable).toBe(owned.stable);
  expect(captured.left).toBe(captured.right);
  expect(captured.left).not.toBe(fresh);
  fresh.value = 3; expect(captured.left.value).toBe(2);
  let getterReads = 0;
  const accessor = { get child() { getterReads += 1; return fresh; } };
  expect(immutableF4Data(accessor).child.value).toBe(3);
  expect(getterReads).toBe(1);
 });

 it('qualifies prepared artifacts by immutable baseline and intent, and keeps the cache bounded', () => {
  const first = immutableF4Data(buildScaleFixture(SCALE_FIXTURE_SEEDS.small));
  const second = immutableF4Data(structuredClone(first));
  const a = cowSetWallScalar(first, first.walls[4]!.id, { height: 4 });
  const b = cowSetWallScalar(second, second.walls[4]!.id, { height: 5 });
  recordPreparedCowCandidate('same-operation', a, 'first-intent');
  recordPreparedCowCandidate('same-operation', b, 'second-intent');
  expect(consumePreparedCowCandidate('same-operation', { baseline: first, key: 'second-intent' })).toBeUndefined();
  expect(consumePreparedCowCandidate('same-operation', { baseline: first, key: 'first-intent' })).toBe(a);
  expect(consumePreparedCowCandidate('same-operation', { baseline: second, key: 'second-intent' })).toBe(b);
  for (let i = 0; i < 17; i += 1) recordPreparedCowCandidate(`bounded-${i}`, a, 'intent');
  expect(consumePreparedCowCandidate('bounded-0', { baseline: first, key: 'intent' })).toBeUndefined();
  for (let i = 1; i < 17; i += 1) expect(consumePreparedCowCandidate(`bounded-${i}`, { baseline: first, key: 'intent' })).toBe(a);
 });

 it('counts a retained unit whose value did not compile, in both store shapes', () => {
  // `retained()` answers "units the store can serve", not "values that compiled".
  // The world branch used to count `objectUnit.compiledObjects`, so a delta that
  // introduced an `object_invalid` descriptor made the same document report one
  // fewer object than the map branch — an F13 attribution that depended on which
  // path served the last compile.
  const baseline = immutableF4Data(buildScaleFixture(SCALE_FIXTURE_SEEDS.small));
  const session = createLayoutCompileSession();
  session.compile(baseline);
  expect(session.retained().objects).toBe(baseline.objects.length);
  const invalid = cowCreateObject(baseline, {
   id: 'object-invalid', kind: 'box', position: [0, 0, 0], rotation: [0, 0, 0], dimensions: [0, 0.5, 0.5]
  });
  const compiled = session.compile(invalid);
  expect(compiled.issues.map((issue) => issue.code)).toContain('object_invalid');
  expect(compiled.geometry.objects).toHaveLength(baseline.objects.length);
  expect(session.retained().objects).toBe(baseline.objects.length + 1);
 });
 it('does not seed full mutable arrays while handing a clone to its owning capture boundary', () => {
  const baseline = immutableF4Data(buildScaleFixture(SCALE_FIXTURE_SEEDS.small));
  const session = createLayoutCompileSession(); session.compile(baseline);
  const plan = withLayoutCompileSession(session, () => planRigidWallMove(baseline, { wallId: baseline.walls[4]!.id, delta: [0, 0.01] }));
  if (plan.kind !== 'success') throw new Error(plan.rejection.message);
  const clone = structuredClone(plan.document);
  const linked = counted(() => linkClonedCowCandidate(plan.document, clone));
  expect(linked.counts.get('storage:vector-seed-slots') ?? 0).toBe(0);
  expect(linked.counts.get('storage:vector-slots-copied') ?? 0).toBe(0);
  freezeF4Data(clone);
  const next = counted(() => withLayoutCompileSession(session, () => planRigidWallMove(clone, { wallId: baseline.walls[4]!.id, delta: [0, -0.01] })));
  expect(next.value.kind).toBe('success');
  expect(next.counts.get('storage:vector-seed-slots') ?? 0).toBe(0);
 });

});
