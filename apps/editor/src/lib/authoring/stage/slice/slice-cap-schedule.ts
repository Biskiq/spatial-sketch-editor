/**
 * When the Slice's section is assembled.
 *
 * The measurement (eleven Rooms, 44 Walls, 7,040 candidate triangles: ~30 ms here
 * against a 4 ms budget) makes the original rule — one assembly per animation frame
 * — unusable during a drag. The cut itself never needed the assembly: it is the GPU's
 * plane array, so the plane and the clipping move every frame for free. What is
 * expensive is the *section*, and a section is only wanted once the creator stops
 * moving the line.
 *
 * So the decision is a small pure function, kept out of the component so it can be
 * tested rather than asserted about:
 *
 * - a **new geometry** (an edit, a rebuild, a new selection) → assemble now;
 * - a **moved reading** on the same geometry → defer to the settle timer;
 * - **no reading** → clear the ink;
 * - nothing changed → do nothing.
 *
 * A geometry change is never deferred: the creator edited something and expects the
 * section to follow immediately; the settle exists for the one interaction that
 * changes the reading continuously.
 */

/** What the ink currently reflects. */
export type CapAssemblyState = {
	/** Geometry, inputs and the ghost's identity: any change is a new section. */
	readonly geometryKey: string;
	/** The reading's numbers, or null when the Slice is off. */
	readonly cutKey: string | null;
};

export type CapAssemblyDecision = 'rebuild' | 'defer' | 'none' | 'clear';

export function decideCapAssembly(
	previous: CapAssemblyState | null,
	next: CapAssemblyState | null,
): CapAssemblyDecision {
	if (next === null) return 'clear';
	if (previous === null) return 'rebuild';
	if (previous.geometryKey !== next.geometryKey) return 'rebuild';
	if (previous.cutKey !== next.cutKey) return 'defer';
	return 'none';
}
