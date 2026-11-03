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
