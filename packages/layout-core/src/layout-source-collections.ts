/**
 * A candidate remains a cloneable, serializable format-6 document. Its public
 * array properties materialize on demand; indexed compiler/planner access uses
 * persistent roots instead. The adapter changes no F4 capture or source format.
 * Reading a complete array deliberately pays and counts its complete output.
 */
import type { LayoutDocumentWallFirst } from './layout-wall-first-types';
import { PersistentVector } from './persistent-store';

export type LayoutCollectionKey = 'junctions' | 'walls' | 'rooms' | 'openings' | 'objects';
type Item<K extends LayoutCollectionKey> = LayoutDocumentWallFirst[K][number];
type Entry = { root: PersistentVector<unknown>; flat?: unknown[] };
const COLLECTIONS = new WeakMap<LayoutDocumentWallFirst, Partial<Record<LayoutCollectionKey, Entry>>>();
const ARRAY_ROOTS = new WeakMap<readonly unknown[], PersistentVector<unknown>>();

export function layoutCollectionRef<K extends LayoutCollectionKey>(document: LayoutDocumentWallFirst, key: K): readonly Item<K>[] | PersistentVector<Item<K>> {
	const entry = COLLECTIONS.get(document)?.[key];
	return (entry ? entry.root : document[key]) as readonly Item<K>[] | PersistentVector<Item<K>>;
}
export function layoutLength(document: LayoutDocumentWallFirst, key: LayoutCollectionKey): number {
	return layoutCollectionRef(document, key).length;
}
export function layoutItem<K extends LayoutCollectionKey>(document: LayoutDocumentWallFirst, key: K, index: number): Item<K> | undefined {
	const entry = COLLECTIONS.get(document)?.[key];
	if (entry?.flat) return entry.flat[index] as Item<K> | undefined;
	const ref = layoutCollectionRef(document, key);
	return ref instanceof PersistentVector ? ref.get(index) : ref[index];
}
export function layoutVector<K extends LayoutCollectionKey>(document: LayoutDocumentWallFirst, key: K): PersistentVector<Item<K>> {
	const ref = layoutCollectionRef(document, key);
	if (ref instanceof PersistentVector) return ref;
	let root = ARRAY_ROOTS.get(ref);
	if (!root) { root = PersistentVector.fromFrozen(ref); ARRAY_ROOTS.set(ref, root); }
	return root as PersistentVector<Item<K>>;
}
/** Run during cold world-index construction, never deferred to the first edit. */
export function seedLayoutVectors(document: LayoutDocumentWallFirst): void {
	for (const key of ['junctions', 'walls', 'rooms', 'openings', 'objects'] as const) layoutVector(document, key);
}
export function withLayoutVectors(
	baseline: LayoutDocumentWallFirst,
	overrides: Partial<{ [K in LayoutCollectionKey]: PersistentVector<Item<K>> }>
): LayoutDocumentWallFirst {
	const result = {
		units: baseline.units, formatVersion: baseline.formatVersion, floor: baseline.floor
	} as LayoutDocumentWallFirst;
	const entries: Partial<Record<LayoutCollectionKey, Entry>> = {};
	for (const key of ['junctions', 'walls', 'rooms', 'openings', 'objects'] as const) {
		const inherited = COLLECTIONS.get(baseline)?.[key];
		const root = overrides[key] ?? inherited?.root;
		if (!root) { Object.defineProperty(result, key, { enumerable: true, configurable: true, writable: true, value: baseline[key] }); continue; }
		const entry: Entry = { root: root as PersistentVector<unknown> };
		entries[key] = entry;
		Object.defineProperty(result, key, {
			enumerable: true, configurable: true,
			get: () => entry.flat ??= entry.root.toArray(`source-${key}`),
			set: (value: unknown[]) => { entry.flat = value; entry.root = PersistentVector.from(value); }
		});
	}
	if (baseline.identity !== undefined) result.identity = baseline.identity;
	COLLECTIONS.set(result, entries);
	return result;
}

/** A view over a stable ID/index directory. No entity-valued map to rebind
 * after F4's detached capture; iteration pays only when explicitly requested. */
export function mappedReadonlyMap<K, V, R>(source: ReadonlyMap<K, V>, project: (value: V, key: K) => R): ReadonlyMap<K, R> {
 const result: ReadonlyMap<K, R> = {
  get size() { return source.size; },
  has: (key) => source.has(key),
  get(key) { const value = source.get(key); return value === undefined ? undefined : project(value, key); },
  *entries(): MapIterator<[K, R]> { for (const [key, value] of source) yield [key, project(value, key)]; },
  keys: () => source.keys(),
  *values(): MapIterator<R> { for (const [key, value] of source) yield project(value, key); },
  [Symbol.iterator]() { return this.entries(); },
  forEach(callback, thisArg) { for (const [key, value] of this) callback.call(thisArg, value, key, this); }
 };
 return result;
}

/** The existing F4 capture requires detached, plain data properties. This is
 * the explicit full-source boundary, never a one-entity read adapter. */
export function materializeLayoutSourceForCapture(document: LayoutDocumentWallFirst): void {
 const entries = COLLECTIONS.get(document);
 if (!entries) return;
 for (const key of ['junctions', 'walls', 'rooms', 'openings', 'objects'] as const) {
  const entry = entries[key]; if (!entry) continue;
  const value = entry.flat ??= entry.root.toArray(`source-${key}`);
  Object.defineProperty(document, key, { value, enumerable: true, configurable: true, writable: true });
 }
}
