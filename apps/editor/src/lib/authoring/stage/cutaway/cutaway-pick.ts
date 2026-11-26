/**
 * X2's hit-path predicate: a cut Wall above its stub is not pickable.
 *
 * The cut is display geometry, exactly like a Slice: the Wall body is still in the
 * world, and its shadow still falls, but the creator cannot see or aim at the part
 * above the stub. A ray over the stub therefore continues to the interior behind
 * it (click-through), while a ray on the stub's face or the cap selects the Wall.
 *
 * It is a **per-object** predicate, unlike the Slice's point test: the cut set names
 * Walls, so the mesh's render identity is the answer's other half. The canvas ink
 * and the caps are not pick roots (`raycast = () => {}`), so they never enter it.
 */
import type { Object3D } from 'three';
import { renderIdentityOf } from '$lib/render/render-identity';
import type { ResolvedCutaway } from './cutaway-resolved';

/** A small tolerance so a click exactly on the cap plane still finds the Wall. */
export const CUTAWAY_PICK_EPSILON_METERS = 1e-4;

/**
 * Whether this point of this object is removed by the cutaway.
 *
 * A Wall is hidden only when it is in the effective set **and** the point is above
 * the shared stub top. Nothing else is affected: Scene objects keep their own pick
 * (owner ruling O-1 leaves hung artwork as built), and stubs/caps are drawn and
 * picked as walls.
 */
export function cutawayHides(
	point: readonly [number, number, number],
	object: Object3D,
	cutaway: ResolvedCutaway | null | undefined,
): boolean {
	if (cutaway === null || cutaway === undefined) return false;
	if (point[1] <= cutaway.stubTopY + CUTAWAY_PICK_EPSILON_METERS) return false;
	const identity = renderIdentityOf(object);
	return identity !== null && identity.kind === 'wall' && cutaway.wallIds.has(identity.id);
}
