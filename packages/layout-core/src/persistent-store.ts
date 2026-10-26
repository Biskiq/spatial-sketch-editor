/** Runtime-only persistent storage. Nodes never point at an older root.
 * AVL maps give deterministic worst-case logarithmic paths (including collisions:
 * there is no hash). Blocked vectors copy at most 32 slots plus a binary path.
 * Counters describe logical node/slot work, not a JavaScript engine's heap bytes.
 */
import { countWork } from './p2311-perf';

export type MapNode<K, V, A> = {
	readonly key: K; readonly value: V;
	readonly left: MapNode<K, V, A> | null; readonly right: MapNode<K, V, A> | null;
	readonly height: number; readonly size: number; readonly summary: A;
};
type Augment<K, V, A> = (key: K, value: V, left: A | undefined, right: A | undefined) => A;
const height = (node: { height: number } | null): number => node?.height ?? 0;

export class PersistentMap<K extends string | number, V, A = undefined> implements ReadonlyMap<K, V> {
	private constructor(public root: MapNode<K, V, A> | null, private readonly augment: Augment<K, V, A>) { countWork('storage:map-handle-allocated'); }
	static from<K extends string | number, V, A = undefined>(
		entries: Iterable<readonly [K, V]>,
		augment: Augment<K, V, A> = (() => undefined as A)
	): PersistentMap<K, V, A> {
		const ordered = [...entries].sort((a, b) => a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0);
		countWork('storage:seed-entries', ordered.length);
		const map = new PersistentMap<K, V, A>(null, augment);
		const build = (lo: number, hi: number): MapNode<K, V, A> | null => {
			if (lo >= hi) return null;
			const mid = Math.floor((lo + hi) / 2), [key, value] = ordered[mid]!;
			return map.node(key, value, build(lo, mid), build(mid + 1, hi));
		};
		map.root = build(0, ordered.length);
		return map;
	}
	fork(): PersistentMap<K, V, A> { countWork('storage:root-fork'); return new PersistentMap(this.root, this.augment); }
	get size(): number { return this.root?.size ?? 0; }
	get [Symbol.toStringTag](): string { return 'PersistentMap'; }
	get(key: K): V | undefined { return this.find(key)?.value; }
	has(key: K): boolean { return this.find(key) !== null; }
	private find(key: K): MapNode<K, V, A> | null {
		let node = this.root;
		while (node) {
			countWork('storage:map-node-read');
			if (key === node.key) return node;
			node = key < node.key ? node.left : node.right;
		}
		return null;
	}
	set(key: K, value: V): this {
		const put = (node: MapNode<K, V, A> | null): MapNode<K, V, A> => {
			if (!node) return this.node(key, value, null, null);
			countWork('storage:map-node-read');
			if (key === node.key) return Object.is(value, node.value) ? node : this.node(key, value, node.left, node.right);
			return key < node.key
				? this.balance(this.node(node.key, node.value, put(node.left), node.right))
				: this.balance(this.node(node.key, node.value, node.left, put(node.right)));
		};
		this.root = put(this.root); return this;
	}
	delete(key: K): boolean {
		let removed = false;
		const drop = (node: MapNode<K, V, A> | null, target: K): MapNode<K, V, A> | null => {
			if (!node) return null;
			countWork('storage:map-node-read');
			if (target < node.key) {
				const left = drop(node.left, target);
				return left === node.left ? node : this.balance(this.node(node.key, node.value, left, node.right));
			}
			if (target > node.key) {
				const right = drop(node.right, target);
				return right === node.right ? node : this.balance(this.node(node.key, node.value, node.left, right));
			}
			removed = true;
			if (!node.left) return node.right;
			if (!node.right) return node.left;
			let successor = node.right;
			while (successor.left) { countWork('storage:map-node-read'); successor = successor.left; }
			return this.balance(this.node(successor.key, successor.value, node.left, drop(node.right, successor.key)));
		};
		this.root = drop(this.root, key); return removed;
	}
	private node(key: K, value: V, left: MapNode<K, V, A> | null, right: MapNode<K, V, A> | null): MapNode<K, V, A> {
		countWork('storage:map-node-allocated'); countWork('storage:map-node-field-writes', 7);
		return { key, value, left, right, height: 1 + Math.max(height(left), height(right)), size: 1 + (left?.size ?? 0) + (right?.size ?? 0), summary: this.augment(key, value, left?.summary, right?.summary) };
	}
	private left(node: MapNode<K, V, A>): MapNode<K, V, A> {
		const r = node.right!; return this.node(r.key, r.value, this.node(node.key, node.value, node.left, r.left), r.right);
	}
	private right(node: MapNode<K, V, A>): MapNode<K, V, A> {
		const l = node.left!; return this.node(l.key, l.value, l.left, this.node(node.key, node.value, l.right, node.right));
	}
	private balance(node: MapNode<K, V, A>): MapNode<K, V, A> {
		if (height(node.left) - height(node.right) > 1) {
			if (height(node.left!.left) < height(node.left!.right)) node = this.node(node.key, node.value, this.left(node.left!), node.right);
			return this.right(node);
		}
		if (height(node.right) - height(node.left) > 1) {
			if (height(node.right!.right) < height(node.right!.left)) node = this.node(node.key, node.value, node.left, this.right(node.right!));
			return this.left(node);
		}
		return node;
	}
	*entries(): MapIterator<[K, V]> {
		function* walk<K, V, A>(node: MapNode<K, V, A> | null): Generator<[K, V]> {
			if (!node) return; yield* walk(node.left); yield [node.key, node.value]; yield* walk(node.right);
		}
		yield* walk(this.root);
	}
	*keys(): MapIterator<K> { for (const [key] of this) yield key; }
	*values(): MapIterator<V> { for (const [, value] of this) yield value; }
	[Symbol.iterator](): MapIterator<[K, V]> { return this.entries(); }
	forEach(callback: (value: V, key: K, map: ReadonlyMap<K, V>) => void, thisArg?: unknown): void {
		for (const [key, value] of this) callback.call(thisArg, value, key, this);
	}
}

type VectorNode<T, A> = {
	readonly items?: readonly T[]; readonly offset?: number; readonly left?: VectorNode<T, A>; readonly right?: VectorNode<T, A>;
	readonly length: number; readonly summary: A;
};
type Reduce<T, A> = { leaf(items: readonly T[]): A; branch(left: A, right: A): A };
const FULLY_VISITED_ARRAYS = new WeakMap<WeakSet<object>, WeakSet<object>>();

export class PersistentVector<T, A = undefined> {
	private constructor(private readonly root: VectorNode<T, A>, private readonly reduce: Reduce<T, A>) { countWork('storage:vector-handle-allocated'); }
	static from<T, A = undefined>(items: readonly T[], reduce: Reduce<T, A> = { leaf: () => undefined as A, branch: () => undefined as A }): PersistentVector<T, A> {
		countWork('storage:vector-seed-slots', items.length);
		const build = (lo: number, hi: number): VectorNode<T, A> => {
			countWork('storage:vector-node-allocated');
			if (hi - lo <= 32) {
				const block = items.slice(lo, hi); countWork('storage:vector-slots-copied', block.length);
				return { items: block, length: block.length, summary: reduce.leaf(block) };
			}
			const mid = lo + Math.max(32, Math.floor((hi - lo) / 64) * 32);
			const left = build(lo, mid), right = build(mid, hi);
			return { left, right, length: hi - lo, summary: reduce.branch(left.summary, right.summary) };
		};
		return new PersistentVector(build(0, items.length), reduce);
	}
	/** A proven immutable flat array is already a stable root. Split its ranges
	 * lazily on updates; never build or shallow-copy an N/page-size directory. */
	static fromFrozen<T>(items: readonly T[]): PersistentVector<T> {
		if (!Object.isFrozen(items)) return PersistentVector.from(items);
		countWork('storage:borrowed-array-root');
		return new PersistentVector({ items, offset: 0, length: items.length, summary: undefined }, { leaf: () => undefined, branch: () => undefined });
	}
	get length(): number { return this.root.length; }
	get summary(): A { return this.root.summary; }
	get(index: number): T | undefined {
		if (index < 0 || index >= this.length || !Number.isInteger(index)) return undefined;
		let node = this.root, offset = index;
		while (!node.items) { countWork('storage:vector-node-read'); if (offset < node.left!.length) node = node.left!; else { offset -= node.left!.length; node = node.right!; } }
		countWork('storage:vector-node-read'); return node.items[(node.offset ?? 0) + offset];
	}
	set(index: number, value: T): PersistentVector<T, A> {
		if (index < 0 || index >= this.length || !Number.isInteger(index)) throw new RangeError('vector index');
		const put = (node: VectorNode<T, A>, offset: number): VectorNode<T, A> => {
			countWork('storage:vector-node-read');
			if (node.items && Object.is(node.items[(node.offset ?? 0) + offset], value)) return node;
			if (node.items && node.length > 32) {
				countWork('storage:vector-node-allocated', 3);
				const leftLength = Math.max(32, Math.floor(node.length / 64) * 32);
				const left: VectorNode<T, A> = { items: node.items, offset: node.offset ?? 0, length: leftLength, summary: undefined as A };
				const right: VectorNode<T, A> = { items: node.items, offset: (node.offset ?? 0) + leftLength, length: node.length - leftLength, summary: undefined as A };
				return put({ left, right, length: node.length, summary: node.summary }, offset);
			}
			if (node.items) {
				if (Object.is(node.items[(node.offset ?? 0) + offset], value)) return node;
				const items = node.items.slice(node.offset ?? 0, (node.offset ?? 0) + node.length); items[offset] = value;
				countWork('storage:vector-slots-copied', items.length); countWork('storage:vector-node-allocated');
				return { items, length: node.length, summary: this.reduce.leaf(items) };
			}
			const left = offset < node.left!.length ? put(node.left!, offset) : node.left!;
			const right = offset < node.left!.length ? node.right! : put(node.right!, offset - node.left!.length);
			if (left === node.left && right === node.right) return node;
			countWork('storage:vector-node-allocated'); countWork('storage:vector-node-field-writes', 4);
			return { left, right, length: node.length, summary: this.reduce.branch(left.summary, right.summary) };
		};
		const root = put(this.root, index); return root === this.root ? this : new PersistentVector(root, this.reduce);
	}
	*values(): Generator<T> {
		function* walk<T, A>(node: VectorNode<T, A>): Generator<T> {
			if (node.items) { for (let i = 0; i < node.length; i += 1) yield node.items[(node.offset ?? 0) + i]!; return; } yield* walk(node.left!); yield* walk(node.right!);
		}
		yield* walk(this.root);
	}
	toArray(label: string | null = 'runtime'): T[] { if (label !== null) countWork(`materialize:${label}:slots`, this.length); return [...this.values()]; }
	/** Certify immutable subtrees once. The caller owns the proof set and must
	 * use the same value predicate on every invocation. No old root is retained. */
	visitUnseen(seen: WeakSet<object>, visit: (value: T) => void): void {
		let covered = FULLY_VISITED_ARRAYS.get(seen);
		if (!covered) { covered = new WeakSet(); FULLY_VISITED_ARRAYS.set(seen, covered); }
		const walk = (node: VectorNode<T, A>): void => {
			countWork('storage:vector-proof-node');
			if (seen.has(node)) return;
			if (node.items) {
				if (covered.has(node.items)) { seen.add(node); return; }
				for (let i = 0; i < node.length; i += 1) { countWork('storage:vector-proof-slot'); visit(node.items[(node.offset ?? 0) + i]!); }
				if ((node.offset ?? 0) === 0 && node.length === node.items.length) covered.add(node.items);
			} else { walk(node.left!); walk(node.right!); }
			seen.add(node);
		};
		walk(this.root);
	}
	/** Compare roots, skipping shared subtrees. Membership/shape must be equal. */
	diff(previous: PersistentVector<T, A>, changed: (index: number, before: T, after: T) => void): void {
		if (this.length !== previous.length) throw new RangeError('vector diff membership');
		const visit = (before: VectorNode<T, A>, after: VectorNode<T, A>, offset: number): void => {
			countWork('storage:vector-diff-node');
			if (before === after) return;
			if (before.items && before.items === after.items && (before.offset ?? 0) === (after.offset ?? 0) && before.length === after.length) return;
			if (before.items && after.items) {
				for (let i = 0; i < after.length; i += 1) {
					countWork('storage:vector-diff-slot');
					if (before.items[(before.offset ?? 0) + i] !== after.items[(after.offset ?? 0) + i]) changed(offset + i, before.items[(before.offset ?? 0) + i]!, after.items[(after.offset ?? 0) + i]!);
				}
				return;
			}
			const expand = (node: VectorNode<T, A>): VectorNode<T, A> => {
				if (!node.items) return node;
				countWork('storage:vector-view-node-allocated', 3);
				const n = Math.max(32, Math.floor(node.length / 64) * 32), at = node.offset ?? 0;
				return { left: { items: node.items, offset: at, length: n, summary: undefined as A }, right: { items: node.items, offset: at + n, length: node.length - n, summary: undefined as A }, length: node.length, summary: node.summary };
			};
			before = expand(before); after = expand(after);
			visit(before.left!, after.left!, offset); visit(before.right!, after.right!, offset + after.left!.length);
		};
		visit(previous.root, this.root, 0);
	}
}
