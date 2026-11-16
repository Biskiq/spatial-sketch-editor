/**
 * The Stage's hit path, with the Slice's cut folded in.
 *
 * A cut changes no document and no draw list membership: the body under the
 * pointer is still in the world, it is simply not drawn. Selection therefore
 * cannot follow the ray's nearest hit while a Slice is armed — a click above the
 * cut would take a wall the creator cannot see. `pickThroughSlice` is the one
 * place that turns the resolved reading into the source's `hiddenAt` filter, so
 * every host pick (Layout, Scene, Light) inherits the same rule and no adapter
 * has to know about Slice at all.
 *
 * The filter reads the reading lazily, on the pointer, so arming, dragging and
 * putting the cut back need no re-wiring: there is one wrapped pick for the
 * session and it is always current.
 */
import type { PointerRay } from '@portfolio/camera-core';
import type { RuntimeScene } from '@portfolio/project-model';
import type { ScenePickSource } from '../../scene/scene-pick-source';
import { sliceHides, type ResolvedSlice } from './slice-cut';

/** What the Stage facade and its adapters call; the options stay internal. */
export type SlicePick = (ray: PointerRay, scene: RuntimeScene) => ReturnType<ScenePickSource['pick']>;

export function pickThroughSlice(
	source: ScenePickSource,
	resolved: () => ResolvedSlice | null
): SlicePick {
	return (ray, scene) =>
		source.pick(ray, scene, {
			hiddenAt: (point) => {
				const cut = resolved();
				return cut !== null && sliceHides(cut, point[0], point[1], point[2]);
			}
		});
}
