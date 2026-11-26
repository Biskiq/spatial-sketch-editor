import type { LayoutVec2 } from '../../geometry/coordinates';
import { CURVE_ARC_LENGTH_TOLERANCE } from '../../geometry/curve';
import { JUNCTION_COINCIDENCE_EPSILON } from '../../wall/junction-identity';
import type { ResolvedWallSplitResult } from '../../wall/curve-algebra';
import { subdivideWallCubicSpan } from '../../wall/curve-algebra';
import type {
	LayoutWall,
	LayoutWallCubicSpan,
	LayoutWallCurveKnot,
	LayoutWallOpening,
} from '../../wall/types';

export type ClosedWallSafeCutSearch = {
	readonly seamOccupied: boolean;
	readonly seamBlockingOpeningIds: readonly string[];
	readonly candidates: readonly number[];
};

/**
 * Inspect periodic Opening intervals on a closed Wall and enumerate
 * deterministic solid-gap cut stations ordered by increasing periodic distance
 * from the opposite station `L / 2` (ties broken by lower forward station).
 */
export function enumerateClosedWallSafeCutStations(
	openings: readonly LayoutWallOpening[],
	wallId: string,
	totalLength: number,
): ClosedWallSafeCutSearch {
	const occupied: Array<{ start: number; end: number }> = [];
	const seamBlockingOpeningIds: string[] = [];
	let seamOccupied = false;

	for (const opening of openings) {
		if (opening.wallId !== wallId) continue;
		const rawStart = ((opening.offset % totalLength) + totalLength) % totalLength;
		const start = totalLength - rawStart <= CURVE_ARC_LENGTH_TOLERANCE ? 0 : rawStart;
		const end = start + opening.width;
		if (end <= totalLength + CURVE_ARC_LENGTH_TOLERANCE) {
			occupied.push({ start, end: Math.min(totalLength, end) });
		} else {
			occupied.push({ start, end: totalLength });
			occupied.push({ start: 0, end: Math.min(totalLength, end - totalLength) });
			if (start > CURVE_ARC_LENGTH_TOLERANCE) {
				seamOccupied = true;
				seamBlockingOpeningIds.push(opening.id);
			}
		}
	}

	occupied.sort((a, b) => a.start - b.start || a.end - b.end);
	const merged: Array<{ start: number; end: number }> = [];
	for (const interval of occupied) {
		const prev = merged[merged.length - 1];
		if (prev && interval.start <= prev.end + CURVE_ARC_LENGTH_TOLERANCE) {
			prev.end = Math.max(prev.end, interval.end);
		} else {
			merged.push({ ...interval });
		}
	}

	const gaps: Array<{ start: number; length: number }> = [];
	if (merged.length === 0) {
		gaps.push({ start: 0, length: totalLength });
	} else {
		const first = merged[0]!;
		const last = merged[merged.length - 1]!;
		for (let i = 0; i < merged.length - 1; i += 1) {
			const gapStart = merged[i]!.end;
			const gapEnd = merged[i + 1]!.start;
			if (gapEnd - gapStart > 2 * JUNCTION_COINCIDENCE_EPSILON) {
				gaps.push({ start: gapStart, length: gapEnd - gapStart });
			}
		}
		const headLen = first.start;
		const tailLen = totalLength - last.end;
		if (
			!seamOccupied &&
			headLen > CURVE_ARC_LENGTH_TOLERANCE &&
			tailLen > CURVE_ARC_LENGTH_TOLERANCE
		) {
			gaps.push({ start: last.end, length: tailLen + headLen });
		} else {
			if (tailLen > 2 * JUNCTION_COINCIDENCE_EPSILON) {
				gaps.push({ start: last.end, length: tailLen });
			}
			if (headLen > 2 * JUNCTION_COINCIDENCE_EPSILON) {
				gaps.push({ start: 0, length: headLen });
			}
		}
	}

	const opposite = totalLength / 2;
	const isStrictlyInsideOccupied = (station: number): boolean =>
		merged.some(
			(interval) =>
				station > interval.start + CURVE_ARC_LENGTH_TOLERANCE &&
				station < interval.end - CURVE_ARC_LENGTH_TOLERANCE,
		);

	const rawCandidates: number[] = [];
	if (!isStrictlyInsideOccupied(opposite)) {
		rawCandidates.push(opposite);
	}
	for (const gap of gaps) {
		if (gap.length <= 2 * JUNCTION_COINCIDENCE_EPSILON) continue;
		for (const frac of [1 / 3, 0.5, 2 / 3]) {
			const station = (gap.start + gap.length * frac) % totalLength;
			if (
				station > CURVE_ARC_LENGTH_TOLERANCE &&
				totalLength - station > CURVE_ARC_LENGTH_TOLERANCE &&
				!isStrictlyInsideOccupied(station)
			) {
				rawCandidates.push(station);
			}
		}
	}

	const periodicDist = (s: number): number => {
		const d = Math.abs(s - opposite);
		return Math.min(d, totalLength - d);
	};
	rawCandidates.sort((a, b) => periodicDist(a) - periodicDist(b) || a - b);

	const candidates: number[] = [];
	for (const s of rawCandidates) {
		if (!candidates.some((existing) => Math.abs(existing - s) <= CURVE_ARC_LENGTH_TOLERANCE)) {
			candidates.push(s);
		}
	}
	return { seamOccupied, seamBlockingOpeningIds, candidates };
}

export type ClosedWallPartitionSegment = {
	readonly knots: LayoutWallCurveKnot[];
	readonly spans: LayoutWallCubicSpan[];
	readonly startDistance: number;
	readonly endDistance: number;
	readonly length: number;
};

/**
 * Partition a canonical closed 16-span cubic Wall at strictly ascending
 * resolved stations `0 < d_0 <... < d_{k-1} < L`, preserving untouched spans
 * byte-identically and keeping unpromoted interior knot IDs.
 */
export function partitionClosedWallChainAtStations(options: {
	readonly closedWall: LayoutWall;
	readonly seamPoint: LayoutVec2;
	readonly totalLength: number;
	readonly stations: readonly ResolvedWallSplitResult[];
}): readonly ClosedWallPartitionSegment[] {
	const { closedWall, seamPoint, totalLength, stations } = options;
	if (closedWall.centerline.kind !== 'cubic-chain') {
		throw new Error(`Closed Wall '${closedWall.id}' must be a cubic-chain`);
	}
	const { knots: origKnots, spans: origSpans } = closedWall.centerline;
	const pts: LayoutVec2[] = [
		[seamPoint[0], seamPoint[1]],
		...origKnots.map((k): LayoutVec2 => [k.point[0], k.point[1]]),
		[seamPoint[0], seamPoint[1]],
	];

	const interiorCutsBySpan = new Map<number, ResolvedWallSplitResult[]>();
	const promotedKnotCuts = new Map<number, ResolvedWallSplitResult>();
	for (const cut of stations) {
		if (cut.promotedKnotId !== undefined) {
			promotedKnotCuts.set(cut.spanIndex, cut);
		} else {
			const list = interiorCutsBySpan.get(cut.spanIndex) ?? [];
			list.push(cut);
			interiorCutsBySpan.set(cut.spanIndex, list);
		}
	}
	for (const list of interiorCutsBySpan.values()) {
		list.sort((a, b) => a.t - b.t || a.distance - b.distance);
	}

	const segments: ClosedWallPartitionSegment[] = [];
	let curKnots: LayoutWallCurveKnot[] = [];
	let curSpans: LayoutWallCubicSpan[] = [];
	let curStartDist = 0;

	const finalizeSegment = (endDist: number) => {
		segments.push({
			knots: curKnots,
			spans: curSpans,
			startDistance: curStartDist,
			endDistance: endDist,
			length: endDist - curStartDist,
		});
		curKnots = [];
		curSpans = [];
		curStartDist = endDist;
	};

	for (let s = 0; s < origSpans.length; s += 1) {
		const cuts = interiorCutsBySpan.get(s);
		if (!cuts || cuts.length === 0) {
			const orig = origSpans[s]!;
			curSpans.push({
				handleOut: [orig.handleOut[0], orig.handleOut[1]],
				handleIn: [orig.handleIn[0], orig.handleIn[1]],
			});
		} else {
			let remSpan: LayoutWallCubicSpan = origSpans[s]!;
			let remStart: LayoutVec2 = pts[s]!;
			const remEnd: LayoutVec2 = pts[s + 1]!;
			let prevT = 0;
			for (const cut of cuts) {
				const localT = (cut.t - prevT) / (1 - prevT);
				const { left, right } = subdivideWallCubicSpan(remSpan, remStart, remEnd, localT);
				curSpans.push(left);
				finalizeSegment(cut.distance);
				remSpan = right;
				remStart = [cut.point[0], cut.point[1]];
				prevT = cut.t;
			}
			curSpans.push({
				handleOut: [remSpan.handleOut[0], remSpan.handleOut[1]],
				handleIn: [remSpan.handleIn[0], remSpan.handleIn[1]],
			});
		}

		if (s < origKnots.length) {
			const promoted = promotedKnotCuts.get(s);
			if (promoted) {
				finalizeSegment(promoted.distance);
			} else {
				const k = origKnots[s]!;
				curKnots.push({ id: k.id, point: [k.point[0], k.point[1]] });
			}
		}
	}

	finalizeSegment(totalLength);
	return segments;
}
