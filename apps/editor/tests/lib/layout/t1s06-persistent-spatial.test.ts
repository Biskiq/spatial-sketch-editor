/** Adversarial maintenance and query accounting, including legitimate linear cases. */
import { describe, expect, it } from 'vitest';
import { createDynamicBvh, setWorkObserver, type PlanBox } from '@portfolio/layout-core';
const box = (x: number, z: number, w = 1, h = 1): PlanBox => ({ minX: x, minZ: z, maxX: x + w, maxZ: z + h });
const overlap = (a: PlanBox, b: PlanBox) => !(a.maxX < b.minX || a.minX > b.maxX || a.maxZ < b.minZ || a.minZ > b.maxZ);
function counted<T>(run: () => T) {
 const counts = new Map<string, number>();
 const prior = setWorkObserver({ span() {}, count(name, n) { counts.set(name, (counts.get(name) ?? 0) + n); } });
 try { return { result: run(), counts }; } finally { setWorkObserver(prior); }
}
describe('persistent spatial index under sustained edits', () => {
 it('keeps root forks constant and reinserts 2,000 long-distance movements without stale hits', () => {
  const boxes = Array.from({ length: 2048 }, (_, i) => box((i % 64) * 4, Math.floor(i / 64) * 4));
  const index = createDynamicBvh(boxes), root = index.clone();
  const fork = counted(() => index.clone());
  expect(fork.counts.get('storage:map-node-allocated') ?? 0).toBe(0);
  expect(fork.counts.get('storage:root-fork')).toBe(3);
  const snapshots: { index: typeof index; boxes: PlanBox[] }[] = [];
  for (let step = 0; step < 2000; step += 1) {
   const id = (step * 401) % boxes.length;
   const next = step % 2 ? box(20_000 + step, -20_000 - step, 4, 0.2) : box((id % 64) * 4 + 0.1, Math.floor(id / 64) * 4 + 0.1);
   const work = counted(() => index.update(id, next)); boxes[id] = next;
   expect(work.counts.get('storage:map-node-allocated') ?? 0).toBeLessThan(240);
   expect(index.height).toBeLessThanOrEqual(Math.ceil(1.45 * Math.log2(index.size + 2)));
   const query = step % 3 ? box(0, 0, 3, 3) : box(next.minX - 0.1, next.minZ - 0.1, 5, 2);
   const measured = counted(() => index.overlaps(query));
   expect(measured.result).toEqual(boxes.flatMap((entry, i) => overlap(entry, query) ? [i] : []));
   expect(measured.counts.get('index:node-test') ?? 0).toBeLessThan(200);
   if (step % 100 === 0) snapshots.push({ index: index.clone(), boxes: [...boxes] });
  }
  expect(root.boxOf(0)).toEqual(box(0, 0));
  for (const snapshot of snapshots) {
   const query = box(0, 0, 10, 10);
   expect(snapshot.index.overlaps(query)).toEqual(snapshot.boxes.flatMap((entry, i) => overlap(entry, query) ? [i] : []));
  }
 });
 it('preserves exact results through 2,000 insertions, removals, irregular transitions and historical branches', () => {
  const index = createDynamicBvh([]), entries = new Map<number, PlanBox>();
  for (let step = 0; step < 2000; step += 1) {
   const id = (step * 37) % 211;
   if (step % 4 === 0) { index.remove(id); entries.delete(id); }
   else {
    const next = step % 7 === 0 ? { minX: NaN, minZ: 0, maxX: 1, maxZ: 1 } : step % 11 === 0 ? box(8, 8, -9, -9) : box((step % 23) - 10, (step % 17) - 8, step % 9 + 1, 1);
    index.insert(id, next); entries.set(id, next);
   }
   const query = step % 5 ? box(-1, -1, 2, 2) : { minX: NaN, minZ: -1, maxX: 0, maxZ: 2 };
   expect(index.overlaps(query)).toEqual([...entries].flatMap(([i, entry]) => overlap(entry, query) ? [i] : []).sort((a, b) => a - b));
   expect(index.size).toBe(entries.size);
  }
  const branch = index.clone(); branch.insert(10_000, box(0, 0));
  expect(index.size).toBe(entries.size); expect(branch.size).toBe(entries.size + 1);
 });
 it('counts every tested node even when a balanced tree has linear empty-result queries', () => {
  // Equal centroids interleave horizontal and vertical enclosing slabs. Every
  // mixed subtree encloses the query although no entry overlaps it.
  const boxes = Array.from({ length: 1023 }, (_, i) => i % 2 ? box(-50, -0.5, 100, 1) : box(-0.5, -50, 1, 100));
  const index = createDynamicBvh(boxes, { ordering: 'centroid' });
  const measured = counted(() => index.overlaps(box(10, 10)));
  expect(measured.result).toEqual([]);
  expect(measured.counts.get('index:node-test')).toBe(1023);
  expect(measured.counts.get('index:entry-test')).toBeGreaterThan(500);
  // Large actual overlap also necessarily reports the complete output.
  const enclosing = counted(() => index.overlaps(box(-0.1, -0.1, 0.2, 0.2)));
  expect(enclosing.counts.get('index:result-record')).toBe(1023);
 });
 it('accounts for the entire irregular-entry population instead of hiding it in one directory visit', () => {
  const index = createDynamicBvh(Array.from({ length: 1000 }, () => ({ minX: NaN, minZ: 0, maxX: 1, maxZ: 1 })));
  const measured = counted(() => index.overlaps(box(0, 0)));
  expect(measured.counts.get('index:irregular-test')).toBe(1000);
  expect(measured.counts.get('index:entry-test')).toBe(1000);
  for (let i = 0; i < 1000; i += 1) index.update(i, box(i * 3, 0));
  expect(index.overlaps(box(0, 0))).toEqual([0]);
 });
 it('uses rectangle extents to reject the equal-centroid slab adversary without visiting unrelated entries', () => {
  const boxes = Array.from({ length: 1023 }, (_, i) => i % 2 ? box(-50, -0.5, 100, 1) : box(-0.5, -50, 1, 100));
  const index = createDynamicBvh(boxes);
  const measured = counted(() => index.overlaps(box(10, 10)));
  expect(measured.result).toEqual([]);
  expect(measured.counts.get('index:node-test') ?? 0).toBeLessThan(40);
 });
 it('pays for reinsertion to avoid fixed-refit partition degradation after a full permutation', () => {
  const boxes = Array.from({ length: 1024 }, (_, i) => box(i * 4, 0));
  const fixed = createDynamicBvh(boxes, { partition: 'fixed', fatMargin: 0 });
  const adaptive = createDynamicBvh(boxes);
  const maintenance = counted(() => {
   for (let i = 0; i < boxes.length; i += 1) { const next = box(((i * 401) % boxes.length) * 4, 0); fixed.update(i, next); adaptive.update(i, next); }
  });
  expect(maintenance.counts.get('index:reinsert') ?? 0).toBeGreaterThan(1000);
  const query = box(2049.5, 0.2, 0.1, 0.1);
  const a = counted(() => fixed.overlaps(query)), b = counted(() => adaptive.overlaps(query));
  expect(a.result).toEqual([]); expect(b.result).toEqual([]);
  expect(a.counts.get('index:node-test') ?? 0).toBeGreaterThan(500);
  expect(b.counts.get('index:node-test') ?? 0).toBeLessThan(60);
 });

 it('orders large result sets in linear radix passes, including unsigned IDs above 2^31', () => {
  const index = createDynamicBvh([]);
  const ids = [0xffffffff, 0x80000000, ...Array.from({ length: 200 }, (_, i) => (i * 10_001_021) >>> 0)];
  for (const id of ids) index.insert(id, box(0, 0));
  const measured = counted(() => index.overlaps(box(0, 0)));
  expect(measured.result).toEqual([...new Set(ids)].sort((a, b) => a - b));
  expect(measured.counts.get('index:sort-entry-read')).toBe(8 * measured.result.length);
  expect(measured.counts.get('index:sort-bucket-write')).toBe(4 * (512 + 2 * measured.result.length));
  expect(measured.counts.get('index:sort-compare') ?? 0).toBe(0);
 });

});
