/**
 * A retained, screen-space broad phase for the Plan hit path.
 *
 * ## The problem it removes
 *
 * `StageFacade.resolveSourceHit` used to sort every eligible fragment and then
 * project every surface of every fragment until one fell inside the 8 px screen
 * tolerance. That is `O(F log F + F·S)` projections for one pointer position,
 * where `F` is every eligible fragment in the project and `S` its surfaces — even
 * though the pointer can only ever be within 8 px of a handful of them. It made
 * *clicking* cost what the whole project contains, which is the one shape of work
 * `T1.P02.S06`'s locality objective (I1) calls a defect rather than a cost.
 *
 * ## What it is
 *
 * A static bounding-volume hierarchy over the world-space boxes of the pickable
 * fragments, queried by projecting each visited node's box and discarding the
 * nodes whose projected extent cannot reach the pointer.
 *
 * It is **conservative by construction**: a node is pruned only when no point of
 * its box can project within the tolerance. So the candidate set is always a
 * superset of the fragments that can hit, and the caller decides the answer with
 * exactly the same exact test and priority order it used before. Broad phase
 * narrows; it never arbitrates. That is what makes the indexed hit path
 * byte-identical to the whole-scan one instead of merely similar.
 *
 * ## Complexity
 *
 * Build: `O(F log F)` once per retained Plan evaluation — every level unions every
 * box it holds, so the build is linear per level of a median-split tree. (The Plan
 * evaluation that owns the index no longer sorts: it hands over an already ordered
 * fragment array.)
 *
 * Query: `O(v + c log c)` where `v` is the number of nodes whose projected extent
 * reaches the pointer, `c` the number of fragments that survive the leaf test, and
 * every visited node costs up to 8 corner projections. The `c log c` term is real and
 * was previously unstated: the tree addresses a **permutation** of the caller's
 * indices, so the surviving candidates come out of the traversal in tree order and
 * are sorted back into the hit path's rank order before they are returned. It is the
 * price of returning a ranked candidate list, and it is small because `c` is a count
 * of screen-space proximity.
 *
 * The ordinary case is `v = O(log F + c)`: a pointer over ordinary sparse geometry
 * visits a root-to-leaf path plus the leaves whose boxes reach the tolerance. The
 * honest limits are the adversarial ones, and they are counted:
 *
 * - many boxes overlapping the pointer in screen space push `c` toward `F`;
 * - a box that crosses the camera plane cannot be bounded, so its node is kept;
 * - a view where every box projects large enough to reach the pointer keeps every
 *   node (`v → F`), because the broad phase is conservative and never guesses.
 *
 * In those cases the query is linear in *overlap*, which is geometry the pointer is
 * genuinely near — never in unrelated project size. Nothing here reads a camera: the
 * caller supplies `project`, so the one evaluation stays the only projection.
 */
import { countWork } from '@portfolio/layout-core';

/** An inclusive world-space box, in project-world meters. */
export type PlanPickBox = {
	readonly minX: number;
	readonly minY: number;
	readonly minZ: number;
	readonly maxX: number;
	readonly maxY: number;
	readonly maxZ: number;
};

/** Projects one project-world point to CSS, or `null` when it is not projectable. */
export type PlanPickProject = (point: readonly [number, number, number]) => readonly [number, number] | null;

export type PlanPickIndex = {
	/** Every indexed entry, in the caller's order. */
	readonly size: number;
	/**
	 * Indices whose box may project within `toleranceCss` of `pointerCss`, in
	 * ascending index order (the caller's own priority order).
	 */
	candidates(
		pointerCss: readonly [number, number],
		toleranceCss: number,
		project: PlanPickProject
	): readonly number[];
	/** The tree's depth, for the count oracle in tests and evidence. */
	readonly depth: number;
};

/** Leaves hold at most this many boxes; below it a scan beats another split. */
const LEAF_SIZE = 8;

type Node = {
	readonly box: PlanPickBox;
	/** Present only on a leaf. */
	readonly from: number;
	/** Exclusive. */
	readonly to: number;
	readonly left: Node | null;
	readonly right: Node | null;
	/** 1 for a leaf; a parent is one deeper than its deepest child. */
	readonly height: number;
};

/**
 * The union of the boxes in `order[from, to)`.
 *
 * It must be read through the permutation: `order` is what the tree splits, and
 * positions in it no longer name their own boxes once the build has partitioned.
 * Unioning `boxes[position]` instead would give a node a box that does not contain
 * its children — which is exactly the shape of bug a broad phase cannot afford,
 * because it silently prunes real hits.
 */
function unionBox(order: Int32Array, boxes: readonly PlanPickBox[], from: number, to: number): PlanPickBox {
	let minX = Infinity;
	let minY = Infinity;
	let minZ = Infinity;
	let maxX = -Infinity;
	let maxY = -Infinity;
	let maxZ = -Infinity;
	for (let position = from; position < to; position += 1) {
		const box = boxes[order[position]!]!;
		if (box.minX < minX) minX = box.minX;
		if (box.minY < minY) minY = box.minY;
		if (box.minZ < minZ) minZ = box.minZ;
		if (box.maxX > maxX) maxX = box.maxX;
		if (box.maxY > maxY) maxY = box.maxY;
		if (box.maxZ > maxZ) maxZ = box.maxZ;
	}
	countWork('plan-pick:node-built');
	return { minX, minY, minZ, maxX, maxY, maxZ };
}

/**
 * Split `order[from, to)` around the median of its boxes' centres on `axis`.
 *
 * A Hoare partition around a median-of-three pivot is `O(n)` per level, so the
 * whole build is `O(F log F)` — the same order as the Plan evaluation that owns
 * it. The split is always strict (both sides non-empty), which is what keeps
 * recursion terminating when every centre is equal — the degenerate case a
 * naive "partition around the median value" turns into an empty side.
 */
function partitionByAxis(
	order: Int32Array,
	boxes: readonly PlanPickBox[],
	from: number,
	to: number,
	axis: 'x' | 'y' | 'z'
): number {
	const centre = (index: number): number => {
		const box = boxes[index]!;
		if (axis === 'x') return box.minX / 2 + box.maxX / 2;
		if (axis === 'y') return box.minY / 2 + box.maxY / 2;
		return box.minZ / 2 + box.maxZ / 2;
	};
	const middle = from + ((to - from) >> 1);
	const a = centre(order[from]!);
	const b = centre(order[middle]!);
	const c = centre(order[to - 1]!);
	const pivot = a < b ? (b < c ? b : a < c ? c : a) : a < c ? a : b < c ? c : b;
	let left = from;
	let right = to - 1;
	while (left <= right) {
		while (left <= right && centre(order[left]!) < pivot) left += 1;
		while (left <= right && centre(order[right]!) > pivot) right -= 1;
		if (left <= right) {
			const swap = order[left]!;
			order[left] = order[right]!;
			order[right] = swap;
			left += 1;
			right -= 1;
		}
	}
	countWork('plan-pick:build-compare', to - from);
	// `left` is the first index not proven below the pivot. A split that isolates
	// nothing (every centre equal, or a pivot on the extreme) falls back to the
	// midpoint, which is strictly inside the range whenever `to - from > 1`.
	return left > from && left < to ? left : middle;
}

function buildNode(order: Int32Array, boxes: readonly PlanPickBox[], from: number, to: number): Node {
	const box = unionBox(order, boxes, from, to);
	if (to - from <= LEAF_SIZE) {
		return { box, from, to, left: null, right: null, height: 1 };
	}
	const extentX = box.maxX - box.minX;
	const extentY = box.maxY - box.minY;
	const extentZ = box.maxZ - box.minZ;
	const axis = extentX >= extentY && extentX >= extentZ ? 'x' : extentY >= extentZ ? 'y' : 'z';
	const middle = partitionByAxis(order, boxes, from, to, axis);
	const left = buildNode(order, boxes, from, middle);
	const right = buildNode(order, boxes, middle, to);
	return { box, from, to, left, right, height: 1 + Math.max(left.height, right.height) };
}

/** Where a projected box lands, or `null` when it provably cannot be pruned. */
type ProjectedSpan = {
	readonly minX: number;
	readonly minY: number;
	readonly maxX: number;
	readonly maxY: number;
};

/**
 * The CSS extent of a box, or `null` when the box cannot be bounded.
 *
 * A perspective projection maps a convex box to the convex hull of its projected
 * corners, so the corners bound every point the box contains. The exception is a
 * box that crosses the camera plane: a corner behind the camera has no CSS
 * position, and the remaining corners no longer bound the visible part. Reporting
 * `null` there keeps the node in the visit set — conservative, never a miss.
 */
function projectBox(box: PlanPickBox, project: PlanPickProject): ProjectedSpan | null {
	let minX = Infinity;
	let minY = Infinity;
	let maxX = -Infinity;
	let maxY = -Infinity;
	for (let corner = 0; corner < 8; corner += 1) {
		const point: readonly [number, number, number] = [
			(corner & 1) === 0 ? box.minX : box.maxX,
			(corner & 2) === 0 ? box.minY : box.maxY,
			(corner & 4) === 0 ? box.minZ : box.maxZ
		];
		const css = project(point);
		countWork('plan-pick:projection');
		if (css === null) return null;
		if (!Number.isFinite(css[0]) || !Number.isFinite(css[1])) return null;
		if (css[0] < minX) minX = css[0];
		if (css[1] < minY) minY = css[1];
		if (css[0] > maxX) maxX = css[0];
		if (css[1] > maxY) maxY = css[1];
	}
	return { minX, minY, maxX, maxY };
}

function reachable(span: ProjectedSpan | null, pointerX: number, pointerY: number, tolerance: number): boolean {
	if (span === null) return true;
	return !(
		span.maxX < pointerX - tolerance ||
		span.minX > pointerX + tolerance ||
		span.maxY < pointerY - tolerance ||
		span.minY > pointerY + tolerance
	);
}

/**
 * Build the index over one Plan evaluation's pickable fragments.
 *
 * `boxes[i]` must **contain every point** fragment `i`'s exact test can project:
 * the whole drawn face for a Wall (not only its centreline at the cut height), the
 * footprint at its own elevation for a flat fragment. A box that is too small
 * would let a real hit be pruned, so callers derive it from the compiled source's
 * own bounds rather than from the Plan cut.
 */
export function createPlanPickIndex(boxes: readonly PlanPickBox[]): PlanPickIndex {
	const order = new Int32Array(boxes.length);
	for (let index = 0; index < boxes.length; index += 1) order[index] = index;
	const root = boxes.length === 0 ? null : buildNode(order, boxes, 0, boxes.length);
	// The leaf ranges address this permutation; `order` is final once the build
	// returns, so a leaf's position resolves to its caller index through it.
	const entries = Int32Array.from(order);

	return {
		size: boxes.length,
		depth: root?.height ?? 0,
		candidates(pointerCss, toleranceCss, project) {
			if (root === null) return [];
			const found: number[] = [];
			const pointerX = pointerCss[0];
			const pointerY = pointerCss[1];
			// An explicit stack, so a deep tree cannot exhaust the call stack.
			const stack: Node[] = [root];
			while (stack.length > 0) {
				const node = stack.pop()!;
				countWork('plan-pick:node-test');
				const span = projectBox(node.box, project);
				if (!reachable(span, pointerX, pointerY, toleranceCss)) {
					countWork('plan-pick:node-prune');
					continue;
				}
				if (node.left === null || node.right === null) {
					for (let position = node.from; position < node.to; position += 1) {
						const index = entries[position]!;
						countWork('plan-pick:leaf-box');
						if (reachable(projectBox(boxes[index]!, project), pointerX, pointerY, toleranceCss)) {
							found.push(index);
						}
					}
					continue;
				}
				stack.push(node.left, node.right);
			}
			found.sort((left, right) => left - right);
			countWork('plan-pick:candidate', found.length);
			return found;
		}
	};
}
