/**
 * `layout-plan-box-index.ts` — a small plan-space (X/Z) uniform box index
 * (T1.P02.S06 D.1 / H3, invariant I2).
 *
 * The topology gates used to test every Wall pair and every Junction pair, so a
 * grid-L move ran 88 k Wall × Wall and 25 k Junction × Junction visits per gate
 * and Bench 1 measured that loop as the quadratic term (exponent ≈ 1.9). A pair
 * whose plan boxes are disjoint cannot intersect, cannot share an endpoint and
 * cannot touch, so it can only be classified `none`: pruning it removes work
 * the predicate would reject anyway (I2's "every pair test goes through an
 * index").
 *
 * The index is deterministic and exact — it prunes by inclusive box overlap
 * only, never by a tolerance of its own. Callers that need a tolerance expand
 * the box they insert or query, so the candidate set stays a superset of the
 * pairs the shipped predicate can accept.
 *
 * Cells are a uniform grid sized from the entries themselves. An entry that
 * would span more than {@link MAX_CELLS_PER_ENTRY} cells (one very long Wall)
 * is kept in a small `wide` list consulted by every query, which bounds the
 * insert cost without changing what a query returns.
 */

/** An inclusive plan-space box. */
export type PlanBox = {
	readonly minX: number;
	readonly minZ: number;
	readonly maxX: number;
	readonly maxZ: number;
};

/** Candidate lookup over a fixed set of boxes, in insertion order. */
export type PlanBoxIndex = {
	/** Entry indices whose box overlaps `query` (inclusive), ascending. */
	overlaps(query: PlanBox): number[];
	/** How many entries the index holds. */
	readonly size: number;
};

const MAX_CELLS_PER_ENTRY = 64;
const MIN_CELL_SIZE = 1e-6;

/**
 * Build the index. `cellSize` defaults to the median entry extent (so a typical
 * entry lands in about one cell); it is never smaller than {@link MIN_CELL_SIZE}.
 */
export function createPlanBoxIndex(boxes: readonly PlanBox[], cellSize?: number): PlanBoxIndex {
	const size = boxes.length;
	const resolvedCell = cellSize !== undefined && cellSize > 0 ? cellSize : medianExtent(boxes);
	const cells = new Map<string, number[]>();
	const wide: number[] = [];
	// Query de-duplication without allocating a Set per query.
	const stamp = new Int32Array(size);
	let generation = 0;

	const cellKey = (cellX: number, cellZ: number): string => `${cellX}:${cellZ}`;
	const range = (box: PlanBox): { x0: number; x1: number; z0: number; z1: number } => ({
		x0: Math.floor(box.minX / resolvedCell),
		x1: Math.floor(box.maxX / resolvedCell),
		z0: Math.floor(box.minZ / resolvedCell),
		z1: Math.floor(box.maxZ / resolvedCell)
	});

	for (const [index, box] of boxes.entries()) {
		const { x0, x1, z0, z1 } = range(box);
		const span = (x1 - x0 + 1) * (z1 - z0 + 1);
		// `wide` is the safety net, never a filter: a non-finite or INVERTED box
		// (min > max gives a span below 1) must still be a candidate for every
		// query, or the index would stop being a superset.
		if (!Number.isFinite(span) || span < 1 || span > MAX_CELLS_PER_ENTRY) {
			wide.push(index);
			continue;
		}
		for (let cellX = x0; cellX <= x1; cellX += 1) {
			for (let cellZ = z0; cellZ <= z1; cellZ += 1) {
				const key = cellKey(cellX, cellZ);
				const list = cells.get(key);
				if (list) list.push(index);
				else cells.set(key, [index]);
			}
		}
	}

	return {
		size,
		overlaps(query: PlanBox): number[] {
			// The stamp is an `Int32`: restart it long before it can wrap and make an
			// ancient query look current, which would drop a candidate.
			if (generation >= 2_000_000_000) {
				stamp.fill(0);
				generation = 0;
			}
			generation += 1;
			const found: number[] = [];
			const { x0, x1, z0, z1 } = range(query);
			const consider = (index: number): void => {
				if (stamp[index] === generation) return;
				stamp[index] = generation;
				const box = boxes[index]!;
				if (box.maxX < query.minX || box.minX > query.maxX) return;
				if (box.maxZ < query.minZ || box.minZ > query.maxZ) return;
				found.push(index);
			};
			const span = (x1 - x0 + 1) * (z1 - z0 + 1);
			if (Number.isFinite(span) && span <= MAX_CELLS_PER_ENTRY * 4) {
				for (let cellX = x0; cellX <= x1; cellX += 1) {
					for (let cellZ = z0; cellZ <= z1; cellZ += 1) {
						const list = cells.get(cellKey(cellX, cellZ));
						if (!list) continue;
						for (const index of list) consider(index);
					}
				}
			} else {
				// A query box that spans more cells than the scan bound: check every
				// celled entry. Only a very large query pays this, and it pays once.
				for (const list of cells.values()) for (const index of list) consider(index);
			}
			for (const index of wide) consider(index);
			found.sort((a, b) => a - b);
			return found;
		}
	};
}

function medianExtent(boxes: readonly PlanBox[]): number {
	const extents: number[] = [];
	for (const box of boxes) {
		const extent = Math.max(box.maxX - box.minX, box.maxZ - box.minZ);
		if (Number.isFinite(extent) && extent > 0) extents.push(extent);
	}
	if (extents.length === 0) return MIN_CELL_SIZE;
	extents.sort((a, b) => a - b);
	const median = extents[Math.floor(extents.length / 2)]!;
	return Math.max(median, MIN_CELL_SIZE);
}
