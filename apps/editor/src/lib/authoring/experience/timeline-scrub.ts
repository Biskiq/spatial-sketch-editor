/**
 * R217.S30 — pointer resolution for the timeline's zero-width wait hatches.
 *
 * A wait is zero elapsed seconds, so several waits can share one timestamp (for
 * example one after another untimed Stop). They are distinct addressable
 * occurrences, so the bar cannot stop at the first match: repeated presses on a
 * coincident hatch cycle through the group in stable order, and the cursor's own
 * segment decides where the next press lands.
 *
 * Pure: percentages in, one segment id out.
 */
export type WaitMarker = { readonly id: string; readonly left: number };

/** Every wait whose hatch is within `tolerancePercent` of the pointer. */
export function coincidentWaitMarkers(
	waits: readonly WaitMarker[],
	fractionPercent: number,
	tolerancePercent = 1.5
): readonly WaitMarker[] {
	return waits.filter(
		(wait) => Math.abs(wait.left - fractionPercent) <= Math.max(0, tolerancePercent)
	);
}

/** One segment of the strip's single track, as a fraction of the track's width. */
export type SegmentLane = { readonly id: string; readonly widthFraction: number };

/**
 * R217.S30 / slice 5 — map a pointer's fraction of the whole track to the
 * segment under it and that segment's own local fraction. Cards of different
 * stay lengths therefore each map their own span; the caller multiplies the
 * local fraction by the segment's duration.
 */
export function locateSegmentAt(
	lanes: readonly SegmentLane[],
	fraction: number
): { readonly segmentId: string; readonly localFraction: number } | null {
	const at = Math.max(0, Math.min(1, fraction));
	let start = 0;
	for (const [index, lane] of lanes.entries()) {
		const width = Math.max(0, lane.widthFraction);
		const end = start + width;
		if (at < end || index === lanes.length - 1) {
			return { segmentId: lane.id, localFraction: width <= 0 ? 0 : Math.max(0, Math.min(1, (at - start) / width)) };
		}
		start = end;
	}
	return null;
}

/**
 * The wait a press should select. A press on a group selects the next one after
 * the current cursor (wrapping), so each stacked wait is reachable without
 * pretending zero seconds have width.
 */
export function resolveWaitScrub(input: {
	readonly waits: readonly WaitMarker[];
	readonly fractionPercent: number;
	readonly currentSegmentId: string | null;
	readonly tolerancePercent?: number;
}): string | null {
	const group = coincidentWaitMarkers(input.waits, input.fractionPercent, input.tolerancePercent);
	if (group.length === 0) return null;
	if (group.length === 1) return group[0]!.id;
	const current = input.currentSegmentId === null
		? -1
		: group.findIndex((wait) => wait.id === input.currentSegmentId);
	return group[(current + 1) % group.length]!.id;
}
