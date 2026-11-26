import type { LayoutVec2 } from '../../geometry/coordinates';
import type { CompiledQuerySpan } from '../../geometry/types';

/**
 * One wall's span set after per-wall deduplication. `straight` gates which
 * semantics consumers may use: midpoint/endpoint families are straight-wall
 * only, curved walls snap via per-sample nearest-point candidates.
 */
export type MergedWallSpan = {
	/**
	 * Collision-safe wall identity: the document-global wall id (wall-first)
	 * or a room-qualified key for legacy segments (unique only per room).
	 */
	key: string;
	/** Bare segment id — the owner identity for moving-target exclusion. */
	segmentId: string;
	/** Farthest endpoint pair over every span endpoint (true extent for straight walls). */
	start: LayoutVec2;
	end: LayoutVec2;
	/**
	 * False for curved walls: consumers must not invent straight midpoint or
	 * endpoint semantics from the chord, and must use `samples` for
	 * nearest-point candidates.
	 */
	straight: boolean;
	/** Per-sample compiled spans (the nearest-point candidate source for curved walls). */
	samples: readonly CompiledQuerySpan[];
};

/**
 * Merge per-sample wall spans of one wall into the full-length span so
 * candidate generation works on authored walls, not sample boundaries.
 *
 * The compiler emits one `wall` query span per sample interval (0.25 m for
 * straight lines), and a shared wall compiles spans per incident room —
 * reversed room refs traverse the wall the other way, so `startDistance` is
 * measured from each room's own segment start and cannot be compared across
 * rooms. Spans are grouped by the compiled `wallKey` (wall-first: the
 * document-global segment id; legacy: floor+room+segment), so same-named
 * segments of different legacy rooms can never collapse into one fake wall.
 *
 * For straight walls the merged extent is the **farthest true endpoint pair**
 * among every span endpoint — exactly the authored wall start/end for any
 * slope or traversal direction. A bounding-box merge would be wrong here — a
 * negative-slope wall `(0,4) → (4,0)` would collapse to the anti-diagonal
 * `(0,0) → (4,4)`.
 *
 * The extent is recovered in **O(k)** from the compiled distances whenever the
 * spans prove a traversal ({@link provenTraversalExtent}): among collinear
 * endpoints the farthest pair is only ever attained by the outermost endpoint
 * of each traversal frame, so scanning every pair re-derives a result the
 * distances already state — and on the editor's `$state`-proxied geometry that
 * scan made Snap the dominant cost of a Plan drag (P23.11 live Snap gate).
 * Straightness is still the same relative-tolerance collinearity test, just
 * against the traversed chord. Curved walls, and any group whose metadata
 * cannot prove a traversal, resolve through the same exact farthest pair by
 * comparing every pair in O(k²) ({@link farthestEndpointPair}) — measured to be
 * the cheaper algorithm at this input's real k, where the O(k log k) sweep is up
 * to 2.2× slower (see that function's note). The pair is IDENTICAL either way and
 * nothing is inferred from a guess.
 *
 * Curved walls (auto-bezier) are detected geometrically — the sample path
 * is longer than the endpoint chord — and keep their per-sample spans:
 * snapping to a curved wall means nearest-point on the actual curve, never
 * a straight chord through its interior.
 */
export function dedupeWallSpans(spans: readonly CompiledQuerySpan[]): MergedWallSpan[] {
	const byWall = new Map<string, CompiledQuerySpan[]>();
	for (const span of spans) {
		const key = span.wallKey ?? span.segmentId;
		const list = byWall.get(key) ?? [];
		list.push(span);
		byWall.set(key, list);
	}
	const merged: MergedWallSpan[] = [];
	for (const [key, list] of byWall) {
		merged.push(mergeWallGroup(key, list[0]!.segmentId, list));
	}
	return merged;
}

/** Merge one wall group — already grouped by `wallKey ?? segmentId` — to its extent. */
function mergeWallGroup(
	key: string,
	segmentId: string,
	list: readonly CompiledQuerySpan[],
): MergedWallSpan {
	const endpoints: LayoutVec2[] = [];
	for (const span of list) endpoints.push(span.start, span.end);

	// O(k): the extent the compiled distances already prove, when they prove one.
	const proven = provenTraversalExtent(list);
	if (proven && withinChordTolerance(endpoints, proven)) {
		return mergedWall(key, segmentId, proven, true, list);
	}

	// Exact: farthest true endpoint pair over every span endpoint. Curved walls
	// keep this pair, and any chord the collinearity test rejects resolves
	// through this same result — so curved output is unchanged by the fast path.
	const exact = farthestEndpointPair(endpoints);
	return mergedWall(key, segmentId, exact, withinChordTolerance(endpoints, exact), list);
}

function mergedWall(
	key: string,
	segmentId: string,
	pair: [LayoutVec2, LayoutVec2],
	straight: boolean,
	samples: readonly CompiledQuerySpan[],
): MergedWallSpan {
	const ordered = lexicographicallySmaller(pair[0], pair[1], pair[1], pair[0])
		? [pair[0], pair[1]]
		: [pair[1], pair[0]];
	return {
		key,
		segmentId,
		start: [...ordered[0]],
		end: [...ordered[1]],
		straight,
		samples,
	};
}

/** One traversal frame's proven extent: the outermost endpoint on each side. */
type TraversalFrameExtent = {
	minStartDistance: number;
	origin: LayoutVec2;
	maxEndDistance: number;
	destination: LayoutVec2;
};

/**
 * Recover a wall group's authored extent in O(k) from the compiled distances,
 * or `null` when the spans cannot prove they form a traversal.
 *
 * A **frame** is one traversal of the Wall: the physical Wall record (no owning
 * room) or one incident Room's boundary record. `startDistance`/`endDistance`
 * are measured from that frame's own segment start, so distances are never
 * compared across frames — each frame contributes its own origin and
 * destination, and the extent is the farthest pair among those outermost
 * endpoints. On a straight wall the outermost endpoint of every frame is an
 * extreme of the whole endpoint set, so this reproduces the exact scan.
 *
 * The metadata must *prove* a traversal before it is trusted: finite forward
 * distances (`endDistance >= startDistance`), and one single position per
 * outermost distance — two distinct positions at the same distance are not a
 * traversal, which is exactly what hand-built spans with placeholder distances
 * look like. Anything else returns `null` and falls back to the exact scan.
 */
function provenTraversalExtent(
	list: readonly CompiledQuerySpan[],
): [LayoutVec2, LayoutVec2] | null {
	const frames = new Map<string, TraversalFrameExtent>();
	for (const span of list) {
		const { startDistance, endDistance } = span;
		if (!Number.isFinite(startDistance) || !Number.isFinite(endDistance)) return null;
		if (endDistance < startDistance) return null;
		const frameKey = `${span.floorId}\u0000${span.roomId ?? ''}`;
		const frame = frames.get(frameKey);
		if (!frame) {
			frames.set(frameKey, {
				minStartDistance: startDistance,
				origin: span.start,
				maxEndDistance: endDistance,
				destination: span.end,
			});
			continue;
		}
		if (startDistance < frame.minStartDistance) {
			frame.minStartDistance = startDistance;
			frame.origin = span.start;
		} else if (startDistance === frame.minStartDistance && !samePoint(frame.origin, span.start)) {
			return null;
		}
		if (endDistance > frame.maxEndDistance) {
			frame.maxEndDistance = endDistance;
			frame.destination = span.end;
		} else if (endDistance === frame.maxEndDistance && !samePoint(frame.destination, span.end)) {
			return null;
		}
	}
	if (frames.size === 0) return null;
	const outermost: LayoutVec2[] = [];
	for (const frame of frames.values()) outermost.push(frame.origin, frame.destination);
	return farthestEndpointPair(outermost);
}

/**
 * Farthest endpoint pair, ties broken by lexicographic point order so the
 * result is a pure function of the geometry (never array order). Called with
 * every span endpoint for the exact path and with the frames' outermost
 * endpoints for the O(k) path — one RESULT and one tie-break, whichever
 * algorithm reaches it.
 *
 * WHY THIS IS STILL THE PER-PAIR SCAN, and why no O(k log k) replacement ships:
 * an exact convex-hull + rotating-calipers sweep was implemented in this slice
 * behind a DEV A/B switch, verified to return this pair on every fixture, and
 * then MEASURED SLOWER on the input the editor actually hands in.
 * At the real scale — 2,560 Wall spans over 40 Walls, k ≤ 128 endpoints per Wall
 * — the scan resolves in 2.4 ms and the sweep in 4.5–5.5 ms, a 0.46–1.07× ratio
 * (up to 2.2× slower) on every fixture that has curved Walls, because a sampled
 * curve's hull is nearly all of its points and k = 128 is only 8,128 pairs. The
 * sweep is deleted rather than kept: at this k the arithmetic is not the cost.
 * The measured cost is the READS — this function runs over the editor's
 * `$state`-proxied geometry, and the same merge over the same values as plain
 * objects is 12× faster (43.7 ms → 3.6 ms, live, one drag). See
 * `recordSnapInputProbe`.
 */
function farthestEndpointPair(points: readonly LayoutVec2[]): [LayoutVec2, LayoutVec2] {
	let best: [LayoutVec2, LayoutVec2] = [points[0]!, points[1] ?? points[0]!];
	let bestSquared = -1;
	for (let first = 0; first < points.length; first += 1) {
		for (let second = first + 1; second < points.length; second += 1) {
			const a = points[first]!;
			const b = points[second]!;
			const dx = a[0] - b[0];
			const dz = a[1] - b[1];
			const squared = dx * dx + dz * dz;
			if (
				squared > bestSquared ||
				(squared === bestSquared && lexicographicallySmaller(a, b, best[0], best[1]))
			) {
				bestSquared = squared;
				best = [a, b];
			}
		}
	}
	return best;
}

/**
 * Collinearity against the endpoint chord. Path-length comparison
 * would be wrong for shared walls (every room re-samples the full
 * wall, so the summed path exceeds the chord even for straight
 * walls); every sample endpoint must instead lie on the chord line.
 * The 2D cross product equals chord × perpendicular deviation, so
 * comparing it against chord² × 1e-6 enforces a RELATIVE
 * perpendicular tolerance of 1e-6 × wall length (plus a 1e-12 m²
 * floor that only absorbs float noise on degenerate chords).
 */
function withinChordTolerance(
	points: readonly LayoutVec2[],
	chord: readonly [LayoutVec2, LayoutVec2],
): boolean {
	const chordX = chord[1][0] - chord[0][0];
	const chordZ = chord[1][1] - chord[0][1];
	const chordLength = Math.hypot(chordX, chordZ);
	const tolerance = Math.max(1e-12, chordLength * chordLength * 1e-6);
	for (const [x, z] of points) {
		if (Math.abs(chordX * (z - chord[0][1]) - chordZ * (x - chord[0][0])) > tolerance) return false;
	}
	return true;
}

function samePoint(a: LayoutVec2, b: LayoutVec2): boolean {
	return a[0] === b[0] && a[1] === b[1];
}

function lexicographicallySmaller(
	a: LayoutVec2,
	b: LayoutVec2,
	c: LayoutVec2,
	d: LayoutVec2,
): boolean {
	if (a[0] !== c[0]) return a[0] < c[0];
	if (a[1] !== c[1]) return a[1] < c[1];
	if (b[0] !== d[0]) return b[0] < d[0];
	return b[1] < d[1];
}

/**
 * Footprint vertex-average center in world X/Z — used by alignment actions
 * for the canonical compiled object bounds reference (not a snap mutation).
 */
export function objectFootprintCenter(footprint: readonly LayoutVec2[]): LayoutVec2 | null {
	if (footprint.length === 0) return null;
	let x = 0;
	let z = 0;
	for (const vertex of footprint) {
		x += vertex[0];
		z += vertex[1];
	}
	return [x / footprint.length, z / footprint.length];
}
