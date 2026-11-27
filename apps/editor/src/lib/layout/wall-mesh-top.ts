/**
 * Shared top-edge helpers for the physical Wall mesh.
 *
 * A level Wall emits the pre-format-11 flat +Y quad; a profiled Wall emits a
 * ruled quad whose normal comes from its own corners, because the top edge rises
 * between two stations. Both are the same four corners, so the mesh emits one
 * quad and only the normal differs.
 */
import { quadNormal } from './wall-mesh-geometry';
import { quad, vertex } from './wall-mesh-emit';
import type { Face, FacePick, V3 } from './wall-mesh-types';

/** Emit one section's top face from its four corners. */
export function pushTopFace(
	faces: Face[],
	points: readonly [V3, V3, V3, V3],
	pick: FacePick,
	aDistance: number,
	bDistance: number,
	thickness: number,
	profiled: boolean,
): void {
	const normal: V3 = profiled ? quadNormal(points[0], points[1], points[2]) : [0, 1, 0];
	faces.push(
		quad(
			vertex(...points[0], ...normal, aDistance, thickness),
			vertex(...points[1], ...normal, bDistance, thickness),
			vertex(...points[2], ...normal, bDistance, 0),
			vertex(...points[3], ...normal, aDistance, 0),
			pick,
		),
	);
}
