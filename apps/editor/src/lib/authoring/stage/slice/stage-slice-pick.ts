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
import type { Object3D } from 'three';
import type { PointerRay } from '@portfolio/camera-core';
import type { RuntimeScene } from '@portfolio/project-model';
import type { ScenePickSource } from '../../scene/scene-pick-source';
import { sliceHides, type ResolvedSlice } from './slice-cut';
import { cutawayHides } from '../cutaway/cutaway-pick';
import { resolvedCutawayNow, type ResolvedCutaway } from '../cutaway/cutaway-resolved';

/** What the Stage facade and its adapters call; the options stay internal. */
export type SlicePick = (ray: PointerRay, scene: RuntimeScene) => ReturnType<ScenePickSource['pick']>;

export function pickThroughSlice(
	source: ScenePickSource,
	resolved: () => ResolvedSlice | null,
	/**
	 * The live effective cutaway (X2), read on the pointer. The default is the
	 * route's own mirror — the same set the Canvas cuts — so a caller that only
	 * knows about Slice still cannot select a cut Wall above its stub.
	 */
	cutaway: () => ResolvedCutaway | null = resolvedCutawayNow
): SlicePick {
	return (ray, scene) => source.pick(ray, scene, hiddenAtOf(resolved, cutaway));
}

/** The same filter for the face-placement ray (artwork hanging, Layout occlusion). */
export type SliceFacePick = (
	ray: PointerRay,
	scene: RuntimeScene,
	accept: Parameters<ScenePickSource['pickVisibleFace']>[2]
) => ReturnType<ScenePickSource['pickVisibleFace']>;

/**
 * The face ray, with the cut folded in.
 *
 * Artwork placement asks a different question than selection — which **face** may
 * receive a body — but it asks it of the same drawn world. A face the Slice removes
 * must not accept a hang and must not block the face behind it, so the filter is the
 * same predicate, applied in the source's own walk rather than after the fact.
 */
export function pickVisibleFaceThroughSlice(
	source: ScenePickSource,
	resolved: () => ResolvedSlice | null,
	cutaway: () => ResolvedCutaway | null = resolvedCutawayNow
): SliceFacePick {
	return (ray, scene, accept) => source.pickVisibleFace(ray, scene, accept, hiddenAtOf(resolved, cutaway));
}

/**
 * One predicate, shared by both rays: a point is hidden when **either** display
 * cut hides it. Slice and cutaway compose as a union (§5), so a Wall face removed
 * by either is not a place to aim at or hang on.
 */
function hiddenAtOf(
	resolved: () => ResolvedSlice | null,
	cutaway: () => ResolvedCutaway | null
): { hiddenAt(point: readonly [number, number, number], object: Object3D): boolean } {
	return {
		hiddenAt: (point, object) => {
			const cut = resolved();
			if (cut !== null && sliceHides(cut, point[0], point[1], point[2])) return true;
			return cutawayHides(point, object, cutaway());
		}
	};
}
