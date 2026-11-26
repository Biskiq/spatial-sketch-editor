/**
 * Half-plane clipping of a **region** — a set of rings — that keeps its topology.
 *
 * Sutherland–Hodgman maps one input ring to at most one output ring. That is exact
 * for a convex input, but a concave ring (a C, a U, a Wall run with a return) can
 * meet a half-plane in several disjoint islands, and SH then emits one
 * self-touching contour joined along the clip line. A hole that crosses the line
 * must also *open* into its outer instead of surviving as a hole that touches it.
 *
 * This module clips the region, not the rings one at a time:
 *
 * 1. Every ring is split at its crossings with the line into **runs** — open paths
 *    that enter the kept side, stay in it and leave it.
 * 2. Along the clip line, the region's interior is a union of intervals. With the
 *    region on the **left** of every ring (outers counter-clockwise, holes
 *    clockwise, as `mesh-plane-section.ts` returns them) and rings that do not cross
 *    each other, each interval starts at an exit crossing and ends at the next entry
 *    crossing in the line's direction `d = (-n.y, n.x)`; sorted crossings therefore
 *    alternate exit, entry, exit, entry. The alternation is **checked**, not
 *    assumed: a violation means the input was not a valid region and is reported.
 * 3. Runs are stitched through those intervals into closed rings. Disjoint islands
 *    become separate rings, a crossing hole merges into the contour it opens onto,
 *    and rings wholly on one side are kept or dropped whole.
 *
 * Vertices exactly on the line are treated as outside (symbolic perturbation), so a
 * crossing is always a proper sign change and no vertex is ever both in and out.
 * Each edge carries a tag (a section edge identity); an edge along the clip line
 * takes the tag of the edge that left the kept side there.
 *
 * Pure maths: no Three, no Svelte, no editor state.
 */

export type ClipPoint = readonly [number, number];

/** The kept side: `nx * x + ny * y <= c`. */
export type ClipHalfPlane = { readonly nx: number; readonly ny: number; readonly c: number };

/** A closed ring; `tags[i]` belongs to the edge `points[i] → points[i + 1]`. */
export type ClipRing = { readonly points: readonly ClipPoint[]; readonly tags: readonly string[] };

export type ClipRegionResult =
	| { readonly kind: 'clipped'; readonly rings: readonly ClipRing[] }
	/** The rings crossed each other or were inconsistently oriented. */
	| { readonly kind: 'invalid' };

/** Points closer than this are one point; rings smaller than the area are dropped. */
const POINT_EPSILON = 1e-12;
const AREA_EPSILON = 1e-12;

export function ringSignedArea(points: readonly ClipPoint[]): number {
	let sum = 0;
	for (let index = 0; index < points.length; index += 1) {
		const a = points[index]!;
		const b = points[(index + 1) % points.length]!;
		sum += a[0] * b[1] - b[0] * a[1];
	}
	return sum / 2;
}

/** Positive inside the kept side, zero on the line. */
function slack(half: ClipHalfPlane, point: ClipPoint): number {
	return half.c - (half.nx * point[0] + half.ny * point[1]);
}

function crossingPoint(a: ClipPoint, b: ClipPoint, fa: number, fb: number): ClipPoint {
	const t = fa / (fa - fb);
	if (!(t > 0)) return a;
	if (!(t < 1)) return b;
	return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

/** Drop repeated consecutive points (and the zero-length edges between them). */
function cleanRing(points: readonly ClipPoint[], tags: readonly string[]): ClipRing | null {
	const outPoints: ClipPoint[] = [];
	const outTags: string[] = [];
	for (let index = 0; index < points.length; index += 1) {
		const point = points[index]!;
		const previous = outPoints[outPoints.length - 1];
		if (
			previous !== undefined &&
			Math.abs(previous[0] - point[0]) <= POINT_EPSILON &&
			Math.abs(previous[1] - point[1]) <= POINT_EPSILON
		) {
			// The zero-length edge `previous → point` disappears; the edge leaving the
			// merged vertex is the one leaving `point`.
			outTags[outTags.length - 1] = tags[index] ?? '';
			continue;
		}
		outPoints.push(point);
		outTags.push(tags[index] ?? '');
	}
	while (outPoints.length > 1) {
		const first = outPoints[0]!;
		const last = outPoints[outPoints.length - 1]!;
		if (
			Math.abs(first[0] - last[0]) > POINT_EPSILON ||
			Math.abs(first[1] - last[1]) > POINT_EPSILON
		)
			break;
		outPoints.pop();
		outTags.pop();
	}
	if (outPoints.length < 3) return null;
	const area = ringSignedArea(outPoints);
	if (!Number.isFinite(area) || Math.abs(area) <= AREA_EPSILON) return null;
	return { points: outPoints, tags: outTags };
}

type Run = {
	readonly points: ClipPoint[];
	readonly tags: string[];
	/** Index into the crossing list of the crossing this run ends at. */
	exit: number;
};

type Crossing = { readonly kind: 'entry' | 'exit'; readonly at: number; readonly run: number };

/** Clip a region (a set of non-crossing, left-oriented rings) to one half-plane. */
export function clipRegionToHalfPlane(
	rings: readonly ClipRing[],
	half: ClipHalfPlane,
): ClipRegionResult {
	const whole: ClipRing[] = [];
	const runs: Run[] = [];
	const crossings: Crossing[] = [];
	const dx = -half.ny;
	const dy = half.nx;
	const along = (point: ClipPoint): number => point[0] * dx + point[1] * dy;

	for (const ring of rings) {
		const count = ring.points.length;
		if (count < 3) continue;
		const f = ring.points.map((point) => slack(half, point));
		const inside = f.map((value) => value > 0);
		if (inside.every(Boolean)) {
			whole.push(ring);
			continue;
		}
		if (!inside.some(Boolean)) continue;
		// Start the walk just after an exit so every run is contiguous.
		let start = 0;
		while (!(inside[start] === false && inside[(start + 1) % count] === true)) start += 1;
		let open: Run | null = null;
		for (let step = 0; step < count; step += 1) {
			const index = (start + step) % count;
			const next = (index + 1) % count;
			const a = ring.points[index]!;
			const b = ring.points[next]!;
			const tag = ring.tags[index] ?? '';
			if (inside[index]) open!.points.push(a);
			if (inside[index] && !inside[next]) {
				const point = crossingPoint(a, b, f[index]!, f[next]!);
				open!.points.push(point);
				open!.tags.push(tag);
				open!.exit = crossings.length;
				crossings.push({ kind: 'exit', at: along(point), run: runs.length - 1 });
				open = null;
			} else if (!inside[index] && inside[next]) {
				const point = crossingPoint(a, b, f[index]!, f[next]!);
				open = { points: [point], tags: [tag], exit: -1 };
				runs.push(open);
				crossings.push({ kind: 'entry', at: along(point), run: runs.length - 1 });
			} else if (inside[index]) {
				open!.tags.push(tag);
			}
		}
	}

	if (runs.length > 0) {
		// Along `d`, exits open an interior interval and entries close it. At a tie the
		// exit sorts first: a ring touching the line at one vertex leaves and re-enters
		// at the same point, and that is an interval of zero length, not a crossing.
		const order = crossings
			.map((crossing, index) => ({ crossing, index }))
			.sort((left, right) =>
				left.crossing.at !== right.crossing.at
					? left.crossing.at - right.crossing.at
					: left.crossing.kind === right.crossing.kind
						? 0
						: left.crossing.kind === 'exit'
							? -1
							: 1,
			);
		const entryAfterExit = new Map<number, number>();
		for (let position = 0; position < order.length; position += 2) {
			const exit = order[position]!;
			const entry = order[position + 1];
			if (exit.crossing.kind !== 'exit' || entry === undefined || entry.crossing.kind !== 'entry') {
				return { kind: 'invalid' };
			}
			entryAfterExit.set(exit.index, entry.crossing.run);
		}
		const used = new Array<boolean>(runs.length).fill(false);
		for (let first = 0; first < runs.length; first += 1) {
			if (used[first]) continue;
			const points: ClipPoint[] = [];
			const tags: string[] = [];
			let current = first;
			let guard = 0;
			while (!used[current]) {
				used[current] = true;
				const run = runs[current]!;
				points.push(...run.points);
				// The run's own edges, then the edge along the line to the next run. The
				// line edge takes the tag of the edge that left the kept side.
				tags.push(...run.tags, run.tags[run.tags.length - 1] ?? '');
				const nextRun = entryAfterExit.get(run.exit);
				if (nextRun === undefined) return { kind: 'invalid' };
				current = nextRun;
				guard += 1;
				if (guard > runs.length) return { kind: 'invalid' };
			}
			if (current !== first) return { kind: 'invalid' };
			const ring = cleanRing(points, tags);
			if (ring !== null) whole.push(ring);
		}
	}
	return { kind: 'clipped', rings: whole };
}

/** Clip a region by every half-plane in turn (their intersection is the kept side). */
export function clipRegionToHalfPlanes(
	rings: readonly ClipRing[],
	halves: readonly ClipHalfPlane[],
): ClipRegionResult {
	let current: readonly ClipRing[] = rings;
	for (const half of halves) {
		const result = clipRegionToHalfPlane(current, half);
		if (result.kind === 'invalid') return result;
		current = result.rings;
		if (current.length === 0) break;
	}
	return { kind: 'clipped', rings: current };
}

/**
 * The parameter interval `[t0, t1] ⊆ [0, 1]` of the segment `a → b` that lies on
 * the closed kept side of every half-plane, or null. Inclusive on purpose: an open
 * chain or a line exactly on the boundary is kept rather than lost.
 */
export function segmentIntervalInHalfPlanes(
	a: ClipPoint,
	b: ClipPoint,
	halves: readonly ClipHalfPlane[],
): readonly [number, number] | null {
	let lo = 0;
	let hi = 1;
	for (const half of halves) {
		const fa = slack(half, a);
		const fb = slack(half, b);
		if (fa < 0 && fb < 0) return null;
		if (fa >= 0 && fb >= 0) continue;
		const t = fa / (fa - fb);
		if (fa < 0) lo = Math.max(lo, t);
		else hi = Math.min(hi, t);
		if (lo > hi) return null;
	}
	return [lo, hi];
}

/** `a + (b - a) t`. */
export function pointOnSegment(a: ClipPoint, b: ClipPoint, t: number): ClipPoint {
	if (t <= 0) return a;
	if (t >= 1) return b;
	return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}
