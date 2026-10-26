/**
 * The Plan pick index's **pruning invariant**, proved rather than assumed.
 *
 * The indexed hit path is only identical to the whole-scan one if the broad phase
 * can never discard a fragment that the exact test would have accepted. That is a
 * property of one rule: *a box is pruned only when no point it contains can
 * project within tolerance of the pointer.* So this suite tests exactly that rule
 * against many boxes and many pointers, at 0, 8 and 40 px, and then tests the
 * cases that make a careless implementation miss:
 *
 * - a pointer at no candidate at all (everything pruned, nothing invented);
 * - boxes straddling the camera plane, whose corners do not project (the node must
 *   stay in the visit set, never be dropped);
 * - the degenerate population where every box is identical (the build must not
 *   recurse forever or leave a subtree empty);
 * - a large population where the count oracle shows the query visits a small
 *   fraction of the tree — the claim this module exists to make.
 *
 * The projection is a real pinhole camera, not an orthographic stand-in, because
 * the perspective divide is what makes a projected bounding box a *convex hull of
 * corners* and what makes a box cross the camera plane.
 */
import { describe, expect, it } from 'vitest';
import { setWorkObserver, type WorkObserver } from '@portfolio/layout-core';
import {
	createPlanPickIndex,
	type PlanPickBox,
	type PlanPickProject
} from '$lib/authoring/layout/plan-pick-index';

/** A deterministic PRNG: the suite must not vary between runs. */
function rng(seed: number): () => number {
	let state = seed >>> 0;
	return () => {
		state = (state * 1664525 + 1013904223) >>> 0;
		return state / 0x100000000;
	};
}

/** A pinhole projector looking at the world origin from `eye`. */
function pinhole(eye: readonly [number, number, number], focal = 900, width = 1280, height = 720): PlanPickProject {
	const len = Math.hypot(eye[0], eye[1], eye[2]);
	const forward: [number, number, number] = [-eye[0] / len, -eye[1] / len, -eye[2] / len];
	const worldUp: [number, number, number] = [0, 1, 0];
	// right = forward × up, up' = right × forward
	const right = [
		forward[1] * worldUp[2] - forward[2] * worldUp[1],
		forward[2] * worldUp[0] - forward[0] * worldUp[2],
		forward[0] * worldUp[1] - forward[1] * worldUp[0]
	] as [number, number, number];
	const up = [
		right[1] * forward[2] - right[2] * forward[1],
		right[2] * forward[0] - right[0] * forward[2],
		right[0] * forward[1] - right[1] * forward[0]
	] as [number, number, number];
	const centreX = width / 2;
	const centreY = height / 2;
	return (point) => {
		const dx = point[0] - eye[0];
		const dy = point[1] - eye[1];
		const dz = point[2] - eye[2];
		const depth = dx * forward[0] + dy * forward[1] + dz * forward[2];
		// The near plane. A point at or behind it has no CSS position, exactly as
		// `projectWorld` reports `visibility: 'behind'`.
		if (!(depth > 0.05)) return null;
		const x = dx * right[0] + dy * right[1] + dz * right[2];
		const y = dx * up[0] + dy * up[1] + dz * up[2];
		return [centreX + (focal * x) / depth, centreY - (focal * y) / depth] as const;
	};
}

/** The same projection the index performs internally, for the reference set. */
function spanOf(box: PlanPickBox, project: PlanPickProject) {
	let minX = Infinity;
	let minY = Infinity;
	let maxX = -Infinity;
	let maxY = -Infinity;
	for (let corner = 0; corner < 8; corner += 1) {
		const css = project([
			(corner & 1) === 0 ? box.minX : box.maxX,
			(corner & 2) === 0 ? box.minY : box.maxY,
			(corner & 4) === 0 ? box.minZ : box.maxZ
		]);
		if (css === null) return null;
		if (css[0] < minX) minX = css[0];
		if (css[1] < minY) minY = css[1];
		if (css[0] > maxX) maxX = css[0];
		if (css[1] > maxY) maxY = css[1];
	}
	return { minX, minY, maxX, maxY };
}

function nearBox(span: ReturnType<typeof spanOf>, pointer: readonly [number, number], tolerance: number): boolean {
	// A span that cannot be bounded is *always* "near": it must never be pruned.
	if (span === null) return true;
	return !(
		span.maxX < pointer[0] - tolerance ||
		span.minX > pointer[0] + tolerance ||
		span.maxY < pointer[1] - tolerance ||
		span.minY > pointer[1] + tolerance
	);
}

type Observed = { readonly counts: Record<string, number> };

function observe(): { readonly seen: Observed; readonly restore: () => void } {
	const counts: Record<string, number> = {};
	const observer: WorkObserver = {
		count(name, amount) {
			counts[name] = (counts[name] ?? 0) + amount;
		},
		span() {}
	};
	const previous = setWorkObserver(observer);
	return { seen: { counts }, restore: () => setWorkObserver(previous) };
}

const EYE: readonly [number, number, number] = [6, 9, 11];
const WIDTH = 1280;
const HEIGHT = 720;

/**
 * A deterministic architectural-ish population: walls, floors and, when asked, a
 * deliberately dense cluster.
 *
 * The clustered variant is the honest adversary — boxes that all project near one
 * point are *real* overlap, and the index is allowed to return them all. The
 * unclustered variant is where the population must not enter the query's cost.
 */
function population(count: number, seed = 7, clustered = false): PlanPickBox[] {
	const random = rng(seed);
	const boxes: PlanPickBox[] = [];
	for (let index = 0; index < count; index += 1) {
		const inCluster = clustered && index % 3 === 0;
		const originX = inCluster ? 0.4 + random() * 0.6 : -8 + random() * 16;
		const originZ = inCluster ? 0.4 + random() * 0.6 : -8 + random() * 16;
		const span = 0.2 + random() * 1.6;
		const bottom = random() < 0.3 ? 0 : 1.2;
		boxes.push({
			minX: originX,
			minY: bottom,
			minZ: originZ,
			maxX: originX + span,
			maxY: bottom + 0.05 + random() * 3,
			maxZ: originZ + span
		});
	}
	return boxes;
}

describe('Plan pick index — the candidate set is a superset of every possible hit', () => {
	it('never prunes a box whose projected extent can reach the pointer', () => {
		const project = pinhole(EYE);
		const boxes = population(180, 7, true);
		const index = createPlanPickIndex(boxes);
		for (let x = 0; x <= WIDTH; x += 40) {
			for (let y = 0; y <= HEIGHT; y += 40) {
				for (const tolerance of [0, 8, 40]) {
					const candidates = new Set(index.candidates([x, y], tolerance, project));
					for (const [entry, box] of boxes.entries()) {
						if (!nearBox(spanOf(box, project), [x, y], tolerance)) continue;
						expect(
							candidates.has(entry),
							`box ${entry} projects near (${x}, ${y}) at ${tolerance}px but was pruned`
						).toBe(true);
					}
				}
			}
		}
	});

	it('returns candidates in ascending order, so a candidate index is its priority rank', () => {
		const project = pinhole(EYE);
		const index = createPlanPickIndex(population(120));
		const candidates = index.candidates([WIDTH / 2, HEIGHT / 2], 8, project);
		expect(candidates.length).toBeGreaterThan(0);
		expect([...candidates].sort((left, right) => left - right)).toEqual([...candidates]);
	});

	it('invents nothing where no box projects near the pointer', () => {
		const project = pinhole(EYE);
		const boxes = population(60);
		const index = createPlanPickIndex(boxes);
		// A pointer far outside every projected extent.
		const candidates = index.candidates([-10_000, -10_000], 0, project);
		expect(candidates).toEqual([]);
	});

	it('keeps a box that straddles the camera plane, whose corners do not project', () => {
		// The eye sits inside this box, so at least one corner is behind the near
		// plane and the projected corners no longer bound the visible part.
		const straddling: PlanPickBox = {
			minX: EYE[0] - 2,
			minY: EYE[1] - 2,
			minZ: EYE[2] - 2,
			maxX: EYE[0] + 2,
			maxY: EYE[1] + 2,
			maxZ: EYE[2] + 2
		};
		const project = pinhole(EYE);
		expect(spanOf(straddling, project)).toBeNull();
		const index = createPlanPickIndex([straddling]);
		expect(index.candidates([10, 10], 0, project)).toEqual([0]);
	});

	it('terminates and keeps everything when every box is identical', () => {
		const box: PlanPickBox = { minX: 0, minY: 0, minZ: 0, maxX: 1, maxY: 1, maxZ: 1 };
		const boxes = Array.from({ length: 257 }, () => box);
		const project = pinhole(EYE);
		const index = createPlanPickIndex(boxes);
		const candidates = index.candidates([WIDTH / 2, HEIGHT / 2], 8, project);
		// Whether the coincident box lands under this pointer or not, the query must
		// answer and the answer must be all-or-nothing for an identical population.
		expect(candidates.length === 0 || candidates.length === boxes.length).toBe(true);
		// Every centre is equal, so every split falls back to the midpoint — balanced,
		// which is the only thing that keeps the build terminating here.
		expect(index.depth).toBeGreaterThan(1);
	});

	it('visits a small fraction of a large, genuinely sparse population', () => {
		const project = pinhole(EYE);
		const boxes = population(4000, 11, false);
		const index = createPlanPickIndex(boxes);
		const observed = observe();
		try {
			const candidates = index.candidates([WIDTH / 2, HEIGHT / 2], 8, project);
			const counts = observed.seen.counts;
			// The whole-scan alternative projects every box at every pointer: 32,000
			// projections for 4,000 boxes. The claim is that a query costs the tree path
			// plus the boxes that really are near, so the population never enters it.
			expect(candidates.length).toBeLessThan(boxes.length);
			expect(counts['plan-pick:node-test'] ?? 0).toBeLessThan(boxes.length / 2);
			expect(counts['plan-pick:projection'] ?? 0).toBeLessThan(boxes.length * 4);
			// A build is not a query: it happened before the observer was installed.
			expect(counts['plan-pick:node-built']).toBeUndefined();
		} finally {
			observed.restore();
		}
	});

	it('reports overlap honestly: a dense cluster may return most of the population', () => {
		// Not a defect and not a pass — the documented limit. When boxes really do
		// project onto the same pixels, candidates approach the population, and the
		// count says so rather than the index pretending otherwise.
		const project = pinhole(EYE);
		const boxes = population(900, 5, true);
		const index = createPlanPickIndex(boxes);
		const candidates = index.candidates([WIDTH / 2, HEIGHT / 2], 8, project);
		expect(candidates.length).toBeGreaterThan(boxes.length / 10);
		// Still a superset of every box that projects near the pointer.
		const set = new Set(candidates);
		for (const [entry, box] of boxes.entries()) {
			if (nearBox(spanOf(box, project), [WIDTH / 2, HEIGHT / 2], 8)) expect(set.has(entry)).toBe(true);
		}
	});

	it('answers an empty population with an empty candidate set', () => {
		const project = pinhole(EYE);
		const index = createPlanPickIndex([]);
		expect(index.size).toBe(0);
		expect(index.depth).toBe(0);
		expect(index.candidates([1, 1], 8, project)).toEqual([]);
	});
});
