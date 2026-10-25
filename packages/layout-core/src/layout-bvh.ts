/**
 * `layout-bvh.ts` — dynamic 8-ary plan-space (X/Z) bounding-volume hierarchy
 * (BVH8 / refittable STR R-tree).
 *
 * Supports:
 * - O(N log N) top-down Sort-Tile-Recursive (3-level longest-axis centroid
 *   partition, fanout <= 8) construction into contiguous typed arrays;
 * - O(log_8 N) in-place leaf update and ancestor AABB refit (`update`);
 * - O(1)-per-level typed-array `clone()` so candidate indices derive from an
 *   immutable baseline without rebuilding;
 * - Exact inclusive AABB range queries (`overlaps`), preserving 100% parity
 *   with `PlanBoxIndex` (including NaN, infinite and inverted boxes via an
 *   explicit `irregular` safety-net list, and ascending index order).
 */
import type { PlanBox } from './layout-plan-box-index';
import { countWork } from './p2311-perf';

export type BvhQueryOptions = {
	/**
	 * Whether to emit `index:node-visit` work counts for directory/leaf page
	 * visits. Defaults to `true` for query paths; internal build/diagnostic
	 * callers may pass `false`.
	 */
	readonly countVisits?: boolean;
};

export type DynamicBvh = {
	/** Total number of indexed entries. */
	readonly size: number;
	/** Entry indices whose box overlaps `query` (inclusive), sorted ascending. */
	overlaps(query: PlanBox, options?: BvhQueryOptions): number[];
	/** Update one entry's box and refit its ancestor chain in O(log_8 N). */
	update(entryIndex: number, nextBox: PlanBox): void;
	/** Read back the current stored box for `entryIndex`. */
	boxOf(entryIndex: number): PlanBox;
	/** Copy all backing typed arrays to produce an independent mutable clone. */
	clone(): DynamicBvh;
};

const FANOUT = 8;

/**
 * True iff `box` has finite bounds and non-inverted intervals on both axes.
 * Non-regular boxes (NaN, +-Infinity, or `max < min` on either axis) cannot be
 * pruned by parent union bounds and are routed through the `irregular` list so
 * `overlaps` remains an exact inclusive superset matching `PlanBoxIndex`.
 */
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

type BackingState = {
	readonly size: number;
	readonly nodeCount: number;
	readonly rootNode: number;
	readonly entryMinX: Float64Array;
	readonly entryMinZ: Float64Array;
	readonly entryMaxX: Float64Array;
	readonly entryMaxZ: Float64Array;
	readonly irregularFlag: Uint8Array;
	irregularList: number[];
	readonly leafOfEntry: Int32Array;
	readonly nodeMinX: Float64Array;
	readonly nodeMinZ: Float64Array;
	readonly nodeMaxX: Float64Array;
	readonly nodeMaxZ: Float64Array;
	readonly nodeParent: Int32Array;
	readonly nodeIsLeaf: Uint8Array;
	readonly nodeChildStart: Int32Array;
	readonly nodeChildCount: Uint8Array;
	readonly childLinks: Int32Array;
};

export function createDynamicBvh(boxes: readonly PlanBox[]): DynamicBvh {
	const size = boxes.length;
	if (size === 0) {
		return createEmptyBvh();
	}

	const entryMinX = new Float64Array(size);
	const entryMinZ = new Float64Array(size);
	const entryMaxX = new Float64Array(size);
	const entryMaxZ = new Float64Array(size);
	const centroidX = new Float64Array(size);
	const centroidZ = new Float64Array(size);
	const irregularFlag = new Uint8Array(size);
	const irregularList: number[] = [];

	for (let i = 0; i < size; i += 1) {
		const box = boxes[i]!;
		entryMinX[i] = box.minX;
		entryMinZ[i] = box.minZ;
		entryMaxX[i] = box.maxX;
		entryMaxZ[i] = box.maxZ;
		if (isRegularPlanBox(box)) {
			centroidX[i] = (box.minX + box.maxX) * 0.5;
			centroidZ[i] = (box.minZ + box.maxZ) * 0.5;
		} else {
			irregularFlag[i] = 1;
			irregularList.push(i);
			centroidX[i] = 0;
			centroidZ[i] = 0;
		}
	}

	// Upper bound on nodes: at most `size` leaf pages + `ceil(size / 2)` internal pages + 2.
	const maxNodes = Math.max(4, size * 2 + 4);
	const maxLinks = Math.max(8, size * 3 + 8);
	const tmpMinX = new Float64Array(maxNodes);
	const tmpMinZ = new Float64Array(maxNodes);
	const tmpMaxX = new Float64Array(maxNodes);
	const tmpMaxZ = new Float64Array(maxNodes);
	const tmpParent = new Int32Array(maxNodes).fill(-1);
	const tmpIsLeaf = new Uint8Array(maxNodes);
	const tmpChildStart = new Int32Array(maxNodes);
	const tmpChildCount = new Uint8Array(maxNodes);
	const tmpLinks = new Int32Array(maxLinks);
	const leafOfEntry = new Int32Array(size);

	let nodeCount = 0;
	let linkCount = 0;

	const order = new Array<number>(size);
	for (let i = 0; i < size; i += 1) order[i] = i;

	const partitionLongestAxis = (slice: number[]): [number[], number[]] => {
		if (slice.length <= 1) return [slice, []];
		let cMinX = Infinity;
		let cMinZ = Infinity;
		let cMaxX = -Infinity;
		let cMaxZ = -Infinity;
		for (let i = 0; i < slice.length; i += 1) {
			const idx = slice[i]!;
			if (irregularFlag[idx] !== 0) continue;
			const cx = centroidX[idx]!;
			const cz = centroidZ[idx]!;
			if (cx < cMinX) cMinX = cx;
			if (cz < cMinZ) cMinZ = cz;
			if (cx > cMaxX) cMaxX = cx;
			if (cz > cMaxZ) cMaxZ = cz;
		}
		const splitX = cMaxX - cMinX >= cMaxZ - cMinZ;
		slice.sort((a, b) => {
			const delta = splitX ? centroidX[a]! - centroidX[b]! : centroidZ[a]! - centroidZ[b]!;
			return delta !== 0 ? delta : a - b;
		});
		const mid = slice.length >> 1;
		return [slice.slice(0, mid), slice.slice(mid)];
	};

	const splitIntoOctants = (slice: number[]): number[][] => {
		let groups: number[][] = [slice];
		for (let level = 0; level < 3; level += 1) {
			const nextGroups: number[][] = [];
			for (const group of groups) {
				if (group.length <= 1) {
					if (group.length === 1) nextGroups.push(group);
					continue;
				}
				const [left, right] = partitionLongestAxis(group);
				if (left.length > 0) nextGroups.push(left);
				if (right.length > 0) nextGroups.push(right);
			}
			groups = nextGroups;
		}
		return groups;
	};

	const buildNode = (slice: number[], parent: number): number => {
		const node = nodeCount;
		nodeCount += 1;
		tmpParent[node] = parent;

		if (slice.length <= FANOUT) {
			tmpIsLeaf[node] = 1;
			const start = linkCount;
			tmpChildStart[node] = start;
			tmpChildCount[node] = slice.length;
			linkCount += slice.length;

			let nMinX = Infinity;
			let nMinZ = Infinity;
			let nMaxX = -Infinity;
			let nMaxZ = -Infinity;
			for (let i = 0; i < slice.length; i += 1) {
				const entry = slice[i]!;
				tmpLinks[start + i] = entry;
				leafOfEntry[entry] = node;
				if (irregularFlag[entry] !== 0) continue;
				const bMinX = entryMinX[entry]!;
				const bMinZ = entryMinZ[entry]!;
				const bMaxX = entryMaxX[entry]!;
				const bMaxZ = entryMaxZ[entry]!;
				if (bMinX < nMinX) nMinX = bMinX;
				if (bMinZ < nMinZ) nMinZ = bMinZ;
				if (bMaxX > nMaxX) nMaxX = bMaxX;
				if (bMaxZ > nMaxZ) nMaxZ = bMaxZ;
			}
			tmpMinX[node] = nMinX;
			tmpMinZ[node] = nMinZ;
			tmpMaxX[node] = nMaxX;
			tmpMaxZ[node] = nMaxZ;
			return node;
		}

		const groups = splitIntoOctants(slice);
		const children: number[] = [];
		for (const group of groups) {
			children.push(buildNode(group, node));
		}
		tmpIsLeaf[node] = 0;
		const start = linkCount;
		tmpChildStart[node] = start;
		tmpChildCount[node] = children.length;
		linkCount += children.length;

		let nMinX = Infinity;
		let nMinZ = Infinity;
		let nMaxX = -Infinity;
		let nMaxZ = -Infinity;
		for (let i = 0; i < children.length; i += 1) {
			const child = children[i]!;
			tmpLinks[start + i] = child;
			const cMinX = tmpMinX[child]!;
			const cMinZ = tmpMinZ[child]!;
			const cMaxX = tmpMaxX[child]!;
			const cMaxZ = tmpMaxZ[child]!;
			if (cMinX < nMinX) nMinX = cMinX;
			if (cMinZ < nMinZ) nMinZ = cMinZ;
			if (cMaxX > nMaxX) nMaxX = cMaxX;
			if (cMaxZ > nMaxZ) nMaxZ = cMaxZ;
		}
		tmpMinX[node] = nMinX;
		tmpMinZ[node] = nMinZ;
		tmpMaxX[node] = nMaxX;
		tmpMaxZ[node] = nMaxZ;
		return node;
	};

	const rootNode = buildNode(order, -1);

	const state: BackingState = {
		size,
		nodeCount,
		rootNode,
		entryMinX,
		entryMinZ,
		entryMaxX,
		entryMaxZ,
		irregularFlag,
		irregularList,
		leafOfEntry,
		nodeMinX: tmpMinX.slice(0, nodeCount),
		nodeMinZ: tmpMinZ.slice(0, nodeCount),
		nodeMaxX: tmpMaxX.slice(0, nodeCount),
		nodeMaxZ: tmpMaxZ.slice(0, nodeCount),
		nodeParent: tmpParent.slice(0, nodeCount),
		nodeIsLeaf: tmpIsLeaf.slice(0, nodeCount),
		nodeChildStart: tmpChildStart.slice(0, nodeCount),
		nodeChildCount: tmpChildCount.slice(0, nodeCount),
		childLinks: tmpLinks.slice(0, linkCount)
	};

	return bindBvh(state);
}

function bindBvh(state: BackingState): DynamicBvh {
	const stack = new Int32Array(Math.max(16, state.nodeCount));

	const refitLeafAndAncestors = (leafNode: number): void => {
		const lStart = state.nodeChildStart[leafNode]!;
		const lCount = state.nodeChildCount[leafNode]!;
		let nMinX = Infinity;
		let nMinZ = Infinity;
		let nMaxX = -Infinity;
		let nMaxZ = -Infinity;
		for (let i = 0; i < lCount; i += 1) {
			const entry = state.childLinks[lStart + i]!;
			if (state.irregularFlag[entry] !== 0) continue;
			const bMinX = state.entryMinX[entry]!;
			const bMinZ = state.entryMinZ[entry]!;
			const bMaxX = state.entryMaxX[entry]!;
			const bMaxZ = state.entryMaxZ[entry]!;
			if (bMinX < nMinX) nMinX = bMinX;
			if (bMinZ < nMinZ) nMinZ = bMinZ;
			if (bMaxX > nMaxX) nMaxX = bMaxX;
			if (bMaxZ > nMaxZ) nMaxZ = bMaxZ;
		}
		state.nodeMinX[leafNode] = nMinX;
		state.nodeMinZ[leafNode] = nMinZ;
		state.nodeMaxX[leafNode] = nMaxX;
		state.nodeMaxZ[leafNode] = nMaxZ;

		let current = state.nodeParent[leafNode]!;
		while (current !== -1) {
			const cStart = state.nodeChildStart[current]!;
			const cCount = state.nodeChildCount[current]!;
			let pMinX = Infinity;
			let pMinZ = Infinity;
			let pMaxX = -Infinity;
			let pMaxZ = -Infinity;
			for (let i = 0; i < cCount; i += 1) {
				const child = state.childLinks[cStart + i]!;
				const cMinX = state.nodeMinX[child]!;
				const cMinZ = state.nodeMinZ[child]!;
				const cMaxX = state.nodeMaxX[child]!;
				const cMaxZ = state.nodeMaxZ[child]!;
				if (cMinX < pMinX) pMinX = cMinX;
				if (cMinZ < pMinZ) pMinZ = cMinZ;
				if (cMaxX > pMaxX) pMaxX = cMaxX;
				if (cMaxZ > pMaxZ) pMaxZ = cMaxZ;
			}
			state.nodeMinX[current] = pMinX;
			state.nodeMinZ[current] = pMinZ;
			state.nodeMaxX[current] = pMaxX;
			state.nodeMaxZ[current] = pMaxZ;
			current = state.nodeParent[current]!;
		}
	};

	return {
		size: state.size,
		boxOf(entryIndex: number): PlanBox {
			return {
				minX: state.entryMinX[entryIndex]!,
				minZ: state.entryMinZ[entryIndex]!,
				maxX: state.entryMaxX[entryIndex]!,
				maxZ: state.entryMaxZ[entryIndex]!
			};
		},
		update(entryIndex: number, nextBox: PlanBox): void {
			if (entryIndex < 0 || entryIndex >= state.size) return;
			state.entryMinX[entryIndex] = nextBox.minX;
			state.entryMinZ[entryIndex] = nextBox.minZ;
			state.entryMaxX[entryIndex] = nextBox.maxX;
			state.entryMaxZ[entryIndex] = nextBox.maxZ;

			const wasIrregular = state.irregularFlag[entryIndex] !== 0;
			const nowIrregular = !isRegularPlanBox(nextBox);
			if (wasIrregular !== nowIrregular) {
				state.irregularFlag[entryIndex] = nowIrregular ? 1 : 0;
				if (nowIrregular) {
					state.irregularList.push(entryIndex);
				} else {
					state.irregularList = state.irregularList.filter((idx) => idx !== entryIndex);
				}
			}
			refitLeafAndAncestors(state.leafOfEntry[entryIndex]!);
		},
		overlaps(query: PlanBox, options?: BvhQueryOptions): number[] {
			const found: number[] = [];
			const qMinX = query.minX;
			const qMinZ = query.minZ;
			const qMaxX = query.maxX;
			const qMaxZ = query.maxZ;

			// Exact IEEE-754 inclusive overlap predicate matching `PlanBoxIndex`.
			const considerEntry = (entry: number): void => {
				if (state.entryMaxX[entry]! < qMinX || state.entryMinX[entry]! > qMaxX) return;
				if (state.entryMaxZ[entry]! < qMinZ || state.entryMinZ[entry]! > qMaxZ) return;
				found.push(entry);
			};

			if (!isRegularPlanBox(query)) {
				if (options?.countVisits !== false) countWork('index:node-visit', 1);
				for (let i = 0; i < state.size; i += 1) {
					considerEntry(i);
				}
				return found;
			}

			let nodeVisits = 1;
			if (
				state.nodeMaxX[state.rootNode]! >= qMinX &&
				state.nodeMinX[state.rootNode]! <= qMaxX &&
				state.nodeMaxZ[state.rootNode]! >= qMinZ &&
				state.nodeMinZ[state.rootNode]! <= qMaxZ
			) {
				let sp = 0;
				stack[sp] = state.rootNode;
				sp += 1;
				while (sp > 0) {
					sp -= 1;
					const node = stack[sp]!;
					const cStart = state.nodeChildStart[node]!;
					const cCount = state.nodeChildCount[node]!;
					if (state.nodeIsLeaf[node] !== 0) {
						for (let i = 0; i < cCount; i += 1) {
							const entry = state.childLinks[cStart + i]!;
							if (state.irregularFlag[entry] !== 0) continue;
							considerEntry(entry);
						}
					} else {
						for (let i = 0; i < cCount; i += 1) {
							const child = state.childLinks[cStart + i]!;
							if (
								state.nodeMaxX[child]! < qMinX ||
								state.nodeMinX[child]! > qMaxX ||
								state.nodeMaxZ[child]! < qMinZ ||
								state.nodeMinZ[child]! > qMaxZ
							) {
								continue;
							}
							nodeVisits += 1;
							stack[sp] = child;
							sp += 1;
						}
					}
				}
			}

			if (options?.countVisits !== false) {
				countWork('index:node-visit', nodeVisits);
			}

			for (let i = 0; i < state.irregularList.length; i += 1) {
				considerEntry(state.irregularList[i]!);
			}

			if (found.length > 1) {
				found.sort((a, b) => a - b);
			}
			return found;
		},
		clone(): DynamicBvh {
			return bindBvh({
				size: state.size,
				nodeCount: state.nodeCount,
				rootNode: state.rootNode,
				entryMinX: state.entryMinX.slice(),
				entryMinZ: state.entryMinZ.slice(),
				entryMaxX: state.entryMaxX.slice(),
				entryMaxZ: state.entryMaxZ.slice(),
				irregularFlag: state.irregularFlag.slice(),
				irregularList: [...state.irregularList],
				leafOfEntry: state.leafOfEntry.slice(),
				nodeMinX: state.nodeMinX.slice(),
				nodeMinZ: state.nodeMinZ.slice(),
				nodeMaxX: state.nodeMaxX.slice(),
				nodeMaxZ: state.nodeMaxZ.slice(),
				nodeParent: state.nodeParent.slice(),
				nodeIsLeaf: state.nodeIsLeaf.slice(),
				nodeChildStart: state.nodeChildStart.slice(),
				nodeChildCount: state.nodeChildCount.slice(),
				childLinks: state.childLinks.slice()
			});
		}
	};
}

function createEmptyBvh(): DynamicBvh {
	return {
		size: 0,
		overlaps(_query: PlanBox, options?: BvhQueryOptions): number[] {
			if (options?.countVisits !== false) countWork('index:node-visit', 0);
			return [];
		},
		update(): void {},
		boxOf(): PlanBox {
			return { minX: Infinity, minZ: Infinity, maxX: -Infinity, maxZ: -Infinity };
		},
		clone(): DynamicBvh {
			return createEmptyBvh();
		}
	};
}
