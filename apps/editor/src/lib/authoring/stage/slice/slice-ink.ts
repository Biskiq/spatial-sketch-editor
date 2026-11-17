/**
 * The Slice's ink colour, one source for the Stage and its rendered fixture.
 *
 * The values are the plan's (§2.2/§2.3): the plane is yellow `#f2d000` at 0.14, the
 * section is paper, and a selected identity's edges are the same gold the selection
 * contour uses (`STAGE_PAINT.selection`) at 3 px over the 2 px yellow edge. Keeping
 * them here means the fixture draws the shipped numbers rather than a copy that can
 * drift — and a palette change is a failing fixture, not a silently different picture.
 *
 * Yellow is Slice's alone: X2's cutaway stubs keep paper with an ink edge.
 */
import { STAGE_PAINT } from '../shell/stage-paint';

export const SLICE_INK = {
	/** The cut plane and the section's own outline. */
	plane: 0xf2d000,
	/** The plane's translucency: present, but never a wash over the work (§2.3). */
	planeOpacity: 0.14,
	/** The filled section: opaque paper tone, never white. */
	cap: 0xf0e7d2,
	/** An open group's edge: the section that could not close. */
	warning: 0xc2643f,
	/** A wholly hidden selected subject: a silhouette, not a cap. */
	ghost: 0x8c8578,
	/** Low enough that a ghost never competes with what is drawn. */
	ghostOpacity: 0.18,
	/** The selected identity's section edge: the same gold as selection ink. */
	gold: STAGE_PAINT.selection,
	/** Section edges: 2 px, the plan's width. */
	edgeWidth: 2,
	/** A selected identity's edges sit over them: 3 px, always readable. */
	selectedEdgeWidth: 3
} as const;
