/**
 * The Stage's shared hit path. Slice and X2 cutaway hide faces from the pick ray;
 * Object Studio narrows the walk to its one scoped Scene root.
 *
 * The options are read lazily on each pointer. A hidden hit never intercepts the
 * ray behind it, and a Studio scope is applied at the Scene pick source itself,
 * not as a post-filter that could discard a valid hit.
 */
import type { Object3D } from 'three';
import type { PointerRay } from '@portfolio/camera-core';
import type { RuntimeScene } from '@portfolio/project-model';
import type { PickOptions, ScenePickSource } from '../../scene/scene-pick-source';
import { sliceHides, type ResolvedSlice } from './slice-cut';
import { cutawayHides } from '../cutaway/cutaway-pick';
import { resolvedCutawayNow, type ResolvedCutaway } from '../cutaway/cutaway-resolved';
import type { SubjectScope } from '../subject-scope';

/** What the Stage facade and its adapters call; the options stay internal. */
export type SlicePick = (ray: PointerRay, scene: RuntimeScene) => ReturnType<ScenePickSource['pick']>;

export function pickThroughSlice(
	source: ScenePickSource,
	resolved: () => ResolvedSlice | null,
	scope: () => SubjectScope | null = () => null,
	cutaway: () => ResolvedCutaway | null = resolvedCutawayNow
): SlicePick {
	return (ray, scene) => source.pick(ray, scene, optionsOf(resolved, scope, cutaway));
}

/** The same scoped/cut filter for the face-placement ray (artwork hanging). */
export type SliceFacePick = (
	ray: PointerRay,
	scene: RuntimeScene,
	accept: Parameters<ScenePickSource['pickVisibleFace']>[2]
) => ReturnType<ScenePickSource['pickVisibleFace']>;

export function pickVisibleFaceThroughSlice(
	source: ScenePickSource,
	resolved: () => ResolvedSlice | null,
	scope: () => SubjectScope | null = () => null,
	cutaway: () => ResolvedCutaway | null = resolvedCutawayNow
): SliceFacePick {
	return (ray, scene, accept) =>
		source.pickVisibleFace(ray, scene, accept, optionsOf(resolved, scope, cutaway));
}

/** One options object for both rays: scoping and both cuts are independent. */
function optionsOf(
	resolved: () => ResolvedSlice | null,
	scope: () => SubjectScope | null,
	cutaway: () => ResolvedCutaway | null
): PickOptions {
	const current = scope();
	const hidden = hiddenAtOf(resolved, cutaway);
	return current === null ? hidden : { ...hidden, only: current.entityId };
}

/**
 * The union of the two display cuts. X2 is per Wall, not just per point:
 * this must receive the actual object from the Scene pick source.
 */
function hiddenAtOf(
	resolved: () => ResolvedSlice | null,
	cutaway: () => ResolvedCutaway | null
): { hiddenAt(point: readonly [number, number, number], object: Object3D): boolean } {
	return {
		hiddenAt: (point, object) => {
			const slice = resolved();
			if (slice !== null && sliceHides(slice, point[0], point[1], point[2])) return true;
			return cutawayHides(point, object, cutaway());
		}
	};
}
