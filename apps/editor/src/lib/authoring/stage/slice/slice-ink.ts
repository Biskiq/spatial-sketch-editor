/**
 * The Slice's ink palette and the two opacity rules that make it readable.
 *
 * One source for the colours, because the rendered fixture (`perf/flows/
 * slice-ink.spec.ts`) has to draw the same ink the Stage draws: a copy of a hex
 * constant in a test proves nothing about what ships. The fixture builds its own
 * scene — it cannot mount a Svelte layer — but it reads these numbers, so a palette
 * change is a failing fixture rather than a silently different picture.
 *
 * Yellow is Slice's alone (§2.2): X2's cutaway stubs keep paper with an ink edge.
 */
export const SLICE_INK = {
	/** The cut plane and the section's outline. */
	plane: 0xe8c14a,
	/** The filled section: opaque paper tone, never white. */
	cap: 0xf0e7d2,
	/** An open group's edge: the section that could not close. */
	warning: 0xc2643f,
	/** A wholly hidden selected subject: a silhouette, not a cap. */
	ghost: 0x8c8578,
	/** Translucent enough to read the paper through, solid enough to see the plane. */
	planeOpacity: 0.1,
	/** Low enough that a ghost never competes with what is drawn. */
	ghostOpacity: 0.18
} as const;
