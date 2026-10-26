/** Bounded primitive comparison, separate from the realistic complete pipeline.
 * Queries and index maintenance are both counted; timing is a separate replay. */
import { writeFileSync } from 'node:fs';
import { createDynamicBvh, setWorkObserver, type DynamicBvh, type PlanBox } from '@portfolio/layout-core';

const n = Number(process.env.S06_ROOMS ?? 100_000), steps = Number(process.env.S06_STEPS ?? 2048);
const box = (x: number, z = 0, width = 1, height = 1): PlanBox => ({ minX: x, minZ: z, maxX: x + width, maxZ: z + height });
const overlap = (a: PlanBox, b: PlanBox) => !(a.maxX < b.minX || a.minX > b.maxX || a.maxZ < b.minZ || a.minZ > b.maxZ);
const create = createDynamicBvh as (boxes: readonly PlanBox[], options?: { partition?: 'adaptive' | 'fixed'; ordering?: 'centroid' | 'extents'; fatMargin?: number }) => DynamicBvh;
const modern = typeof create([]).insert === 'function';
const policies = modern ? [
 { name: 'fixed-centroid', options: { partition: 'fixed', ordering: 'centroid', fatMargin: 0 } as const },
 { name: 'adaptive-centroid', options: { ordering: 'centroid' } as const },
 { name: 'adaptive-extents', options: { ordering: 'extents' } as const }
] : [{ name: 'BVH8-refit', options: {} }];
const tick = () => new Promise<void>((resolve) => setImmediate(resolve));
async function gc() { await tick(); (globalThis as { gc?: () => void }).gc?.(); await tick(); }
let sink = 0;
const results = [];
for (const policy of policies) {
 process.stderr.write(`spatial:${policy.name}\n`);
 const initial = Array.from({ length: n }, (_, i) => box(i * 4));
 const query = box(Math.floor(n / 2) * 4 + 1.5, 0.2, 0.1, 0.1);
 const replay = (observed: boolean) => {
  let index = create(initial, policy.options);
  const oracle = [...initial], roots: { index: DynamicBvh; id: number; old: PlanBox }[] = [];
  const total: Record<string, number> = {}, peak: Record<string, number> = {};
  let current: Record<string, number> = {};
  if (observed) setWorkObserver({ span() {}, count(name, amount) { total[name] = (total[name] ?? 0) + amount; current[name] = (current[name] ?? 0) + amount; } });
  const begin = performance.now();
  for (let step = 0; step < steps; step += 1) {
   current = {};
   const id = (step * 499) % n, next = box(((id * 401 + step) % n) * 4);
   if (step % 64 === 0) roots.push({ index, id, old: oracle[id]! });
   index = index.clone(); index.update(id, next); oracle[id] = next;
   sink += index.overlaps(query).length;
   if (observed) for (const [name, amount] of Object.entries(current)) peak[name] = Math.max(peak[name] ?? 0, amount);
  }
  const milliseconds = performance.now() - begin;
  setWorkObserver(null);
  // Exact oracle and historical isolation checks run after both count/timing windows.
  const expected = oracle.flatMap((entry, i) => overlap(entry, query) ? [i] : []);
  if (JSON.stringify(index.overlaps(query)) !== JSON.stringify(expected)) throw new Error('spatial oracle mismatch');
  for (const root of roots) if (JSON.stringify(root.index.boxOf(root.id)) !== JSON.stringify(root.old)) throw new Error('historical index mutated');
  return { total, peak, milliseconds, index, roots };
 };
 const counted = replay(true);
 const countedReport = { counts: counted.total, perOperationMax: counted.peak, retainedHistoricalRoots: counted.roots.length, height: counted.index.height };
 // Drop the counted roots before the timing replay, avoiding a mismatched heap.
 counted.roots.length = 0;
 await gc();
 const timed = replay(false);
 await gc(); const retainedMemory = process.memoryUsage();
 const adversaries = [];
 for (const [name, boxes, q] of [
  ['equal-centroid-slabs', Array.from({ length: 4095 }, (_, i) => i % 2 ? box(-50, -0.5, 100, 1) : box(-0.5, -50, 1, 100)), box(10, 10)],
  ['fully-overlapping', Array.from({ length: 8192 }, () => box(-100, -100, 200, 200)), box(0, 0)],
  ['irregular-population', Array.from({ length: 1000 }, () => ({ minX: NaN, minZ: 0, maxX: 1, maxZ: 1 })), box(0, 0)]
 ] as const) {
  const index = create(boxes, policy.options), counts: Record<string, number> = {};
  setWorkObserver({ span() {}, count(key, value) { counts[key] = (counts[key] ?? 0) + value; } });
  const found = index.overlaps(q); setWorkObserver(null);
  if (JSON.stringify(found) !== JSON.stringify(boxes.flatMap((entry, i) => overlap(entry, q) ? [i] : []))) throw new Error('adversarial oracle mismatch');
  adversaries.push({ name, entries: boxes.length, results: found.length, counts });
 }
 results.push({ policy: policy.name, entries: n, steps, ...countedReport, unobservedReplayMilliseconds: timed.milliseconds, retainedMemory, adversaries });
 timed.roots.length = 0;
 await gc();
}
const result = { label: 'bounded spatial primitive comparison, not a geometry benchmark or universal query guarantee', mode: 'spatial', entries: n, steps, policies: results, sink };
if (process.env.S06_RESULT) writeFileSync(process.env.S06_RESULT, JSON.stringify(result, null, 2) + '\n');
else process.stdout.write(JSON.stringify(result) + '\n');
