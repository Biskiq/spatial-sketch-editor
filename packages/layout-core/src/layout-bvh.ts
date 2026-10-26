/**
 * Persistent, spatially ordered AVL box index. A move removes/reinserts its
 * four-extrema Morton key, so partitions distinguish shape as well as position.
 * Small moves retain a bounded fat partition; larger moves remove/reinsert. Clone shares roots in O(1); maintenance is O(log N) nodes.
 * Range queries cost tested nodes + irregular entries + output ordering; AVL
 * height does NOT imply a logarithmic spatial query guarantee.
 */
import type { PlanBox } from './layout-plan-box-index';
import { countWork } from './p2311-perf';
import { PersistentMap, type MapNode } from './persistent-store';

export type BvhMaintenanceOptions = { readonly partition?: 'adaptive' | 'fixed'; readonly ordering?: 'centroid' | 'extents'; readonly fatMargin?: number };
export type BvhQueryOptions = { /** Controls the legacy accepted-node count only. Full test/output counters always run. */ readonly countVisits?: boolean };
export type DynamicBvh = {
 readonly size: number;
 overlaps(query: PlanBox, options?: BvhQueryOptions): number[];
 update(entryIndex: number, nextBox: PlanBox): void;
 boxOf(entryIndex: number): PlanBox;
 clone(): DynamicBvh;
 /** Explicit topology operations; entry IDs remain stable across removals. */
 insert(entryIndex: number, box: PlanBox): void;
 remove(entryIndex: number): void;
 readonly height: number;
};

export function isRegularPlanBox(box: PlanBox): boolean {
	return (
		Number.isFinite(box.minX) &&
		Number.isFinite(box.minZ) &&
		Number.isFinite(box.maxX) &&
		Number.isFinite(box.maxZ) &&
		box.maxX >= box.minX &&
		box.maxZ >= box.minZ
	);
}

/** Inclusive union of two regular boxes. */
export function mergePlanBoxes(a: PlanBox, b: PlanBox): PlanBox {
	return {
		minX: Math.min(a.minX, b.minX),
		minZ: Math.min(a.minZ, b.minZ),
		maxX: Math.max(a.maxX, b.maxX),
		maxZ: Math.max(a.maxZ, b.maxZ)
	};
}

/** Expand `box` symmetrically on X and Z by `pad`. */
export function expandPlanBox(box: PlanBox, pad: number): PlanBox {
	return {
		minX: box.minX - pad,
		minZ: box.minZ - pad,
		maxX: box.maxX + pad,
		maxZ: box.maxZ + pad
	};
}


type Entry = { readonly index: number; readonly box: PlanBox; readonly fat: PlanBox; readonly key: string | null };
const bits = new DataView(new ArrayBuffer(8));
function orderedBits(value: number): bigint {
 bits.setFloat64(0, value);
 const n = bits.getBigUint64(0);
 return (n & (1n << 63n)) !== 0n ? ~n & ((1n << 64n) - 1n) : n ^ (1n << 63n);
}
/** Fixed-width IEEE-754 Morton key; no quantization, world extent or grid limit. */
function spatialKey(box: PlanBox, index: number, ordering: 'centroid' | 'extents'): string {
 const coordinates = ordering === 'centroid'
  ? [box.minX / 2 + box.maxX / 2, box.minZ / 2 + box.maxZ / 2]
  : [box.minX, box.minZ, box.maxX, box.maxZ];
 const values = coordinates.map(orderedBits);
 let key = 0n;
 for (let bit = 63n; bit >= 0n; bit -= 1n) for (const value of values) key = (key << 1n) | ((value >> bit) & 1n);
 countWork('index:morton-bits', 64 * coordinates.length);
 return `${key.toString(16).padStart(16 * coordinates.length, '0')}:${index}`;
}
function fatBox(box: PlanBox, margin: number): PlanBox {
 return expandPlanBox(box, Math.min(margin, 0.1 * Math.max(box.maxX - box.minX, box.maxZ - box.minZ)));
}

function overlaps(a: PlanBox, b: PlanBox): boolean {
 return !(a.maxX < b.minX || a.minX > b.maxX || a.maxZ < b.minZ || a.minZ > b.maxZ);
}
const augment = (_key: string, entry: Entry, left?: PlanBox, right?: PlanBox): PlanBox => {
 let box = entry.fat;
 if (left) box = mergePlanBoxes(left, box);
 if (right) box = mergePlanBoxes(box, right);
 countWork('index:bounds-union', Number(!!left) + Number(!!right));
 return box;
};
/** Stable entry IDs are unsigned array indices. A four-pass radix sort makes
 * required ascending output linear in its size; tiny outputs use native sort. */
function sortEntryIndices(found: number[], observed: boolean): void {
 if (found.length <= 64) { found.sort((a, b) => { if (observed) countWork('index:sort-compare'); return a - b; }); return; }
 const scratch = new Array<number>(found.length), buckets = new Uint32Array(256);
 if (observed) { countWork('index:sort-scratch-slots', found.length); countWork('index:sort-buffer-bytes', buckets.byteLength); }
 let source = found, target = scratch;
 for (let shift = 0; shift < 32; shift += 8) {
  buckets.fill(0);
  for (const id of source) buckets[(id >>> shift) & 255]! += 1;
  let offset = 0;
  for (let i = 0; i < 256; i += 1) { const count = buckets[i]!; buckets[i] = offset; offset += count; }
  for (const id of source) { const bucket = (id >>> shift) & 255; target[buckets[bucket]!] = id; buckets[bucket]! += 1; }
  [source, target] = [target, source];
 }
 if (observed) { countWork('index:sort-entry-read', 8 * found.length); countWork('index:sort-entry-write', 4 * found.length); countWork('index:sort-bucket-write', 4 * 512); }
}
export function createDynamicBvh(boxes: readonly PlanBox[], options: BvhMaintenanceOptions = {}): DynamicBvh {
 const margin = Number.isFinite(options.fatMargin) && options.fatMargin! >= 0 ? options.fatMargin! : 0.1;
 const settings = { partition: options.partition ?? 'adaptive', ordering: options.ordering ?? 'extents', fatMargin: margin } as const;
 const entries = boxes.map((box, index): Entry => ({ index, box: { ...box }, fat: isRegularPlanBox(box) ? fatBox(box, margin) : { ...box }, key: isRegularPlanBox(box) ? spatialKey(box, index, settings.ordering) : null }));
 return bind(
  PersistentMap.from(entries.map((entry) => [entry.index, entry] as const)),
  PersistentMap.from(entries.filter((entry) => entry.key !== null).map((entry) => [entry.key!, entry] as const), augment),
  PersistentMap.from(entries.filter((entry) => entry.key === null).map((entry) => [entry.index, entry] as const)), settings
 );
}
function bind(directory: PersistentMap<number, Entry>, regular: PersistentMap<string, Entry, PlanBox>, irregular: PersistentMap<number, Entry>, options: { readonly partition: 'adaptive' | 'fixed'; readonly ordering: 'centroid' | 'extents'; readonly fatMargin: number }): DynamicBvh {
 const remove = (index: number): void => {
  const old = directory.get(index); if (!old) return;
  if (old.key === null) irregular.delete(index); else regular.delete(old.key);
  directory.delete(index);
 };
 const put = (index: number, source: PlanBox, old: Entry | undefined): void => {
  if (old && Object.is(old.box.minX, source.minX) && Object.is(old.box.minZ, source.minZ) && Object.is(old.box.maxX, source.maxX) && Object.is(old.box.maxZ, source.maxZ)) return;
  const box = { ...source }, isRegular = isRegularPlanBox(box);
  const retainedPartition = isRegular && old?.key !== null && old !== undefined && (options.partition === 'fixed' ||
   (old.fat.minX <= box.minX && old.fat.minZ <= box.minZ && old.fat.maxX >= box.maxX && old.fat.maxZ >= box.maxZ));
  const key = isRegular ? retainedPartition ? old!.key : spatialKey(box, index, options.ordering) : null;
  const fat = retainedPartition && options.partition !== 'fixed' ? old!.fat : isRegular ? fatBox(box, options.fatMargin) : box;
  const entry: Entry = { index, box, fat, key };
  if (old?.key !== key) {
   if (old?.key === null) irregular.delete(index); else if (old) regular.delete(old.key!);
   countWork('index:reinsert');
  } else countWork('index:retained-partition-update');
  directory.set(index, entry);
  if (key === null) irregular.set(index, entry); else regular.set(key, entry);
 };
 const insert = (index: number, source: PlanBox): void => {
  if (!Number.isInteger(index) || index < 0 || index > 0xffffffff) throw new RangeError('entry ID must be an unsigned array index');
  put(index, source, directory.get(index));
 };

 return {
  get size() { return directory.size; },
  get height() { return regular.root?.height ?? 0; },
  boxOf(index) { return { ...(directory.get(index)?.box ?? { minX: Infinity, minZ: Infinity, maxX: -Infinity, maxZ: -Infinity }) }; },
  update(index, box) { const old = directory.get(index); if (old) put(index, box, old); },
  insert, remove,
  clone() { countWork('index:root-clone'); return bind(directory.fork(), regular.fork(), irregular.fork(), options); },
  overlaps(query, options) {
   const found: number[] = [];
   let testedNodes = 0, testedEntries = 0, acceptedNodes = 0;
   const consider = (entry: Entry): void => { testedEntries += 1; if (overlaps(entry.box, query)) found.push(entry.index); };
   if (!isRegularPlanBox(query)) {
    for (const entry of directory.values()) consider(entry);
   } else {
    // Recursive stack is bounded by AVL height, independent of N and versions.
    const visit = (node: MapNode<string, Entry, PlanBox> | null): void => {
     if (!node) return;
     testedNodes += 1;
     if (!overlaps(node.summary, query)) return;
     acceptedNodes += 1; consider(node.value); visit(node.left); visit(node.right);
    };
    visit(regular.root);
    for (const entry of irregular.values()) consider(entry);
   }
   if (options?.countVisits !== false) countWork('index:node-visit', acceptedNodes);
   {
    countWork('index:node-test', testedNodes);
    countWork('index:entry-test', testedEntries);
    countWork('index:irregular-test', isRegularPlanBox(query) ? irregular.size : 0);
    countWork('index:result-record', found.length);
   }
   if (found.length > 1) sortEntryIndices(found, true);
   return found;
  }
 };
}
