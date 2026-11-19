/**
 * The Stage's shared hit path. Slice and X2 cutaway hide faces from the pick ray;
 * Object Studio narrows the walk to its one scoped Scene root.
 *
 * The options are read lazily on each pointer. A hidden hit never intercepts the
 * ray behind it, and a Studio scope is applied at the Scene pick source itself,
 * not as a post-filter that could discard a valid hit.
 */
import { Plane, Ray, Vector3, type Object3D } from 'three';
import { pointInPolygon, type LayoutVec2 } from '@portfolio/layout-core';
import type { PointerRay } from '@portfolio/camera-core';
import type { RuntimeScene } from '@portfolio/project-model';
import type { PickOptions, ScenePickSource, SceneRenderedHit } from '../../scene/scene-pick-source';
import { sliceHides, type ResolvedSlice } from './slice-cut';
import { cutawayHides } from '../cutaway/cutaway-pick';
import { resolvedCutawayNow, type ResolvedCutaway } from '../cutaway/cutaway-resolved';
import type { SubjectScope } from '../subject-scope';
import { capFillsOf } from './slice-cap-shapes';
import { sectionForSlice } from './slice-section';

/** What the Stage facade and its adapters call; the options stay internal. */
export type SlicePick = (ray: PointerRay, scene: RuntimeScene) => ReturnType<ScenePickSource['pick']>;

export function pickThroughSlice(
	source: ScenePickSource,
	resolved: () => ResolvedSlice | null,
	scope: () => SubjectScope | null = () => null,
	cutaway: () => ResolvedCutaway | null = resolvedCutawayNow
): SlicePick {
	return (ray, scene) => {
		const hit = source.pick(ray, scene, optionsOf(resolved, scope, cutaway));
		const slice = resolved();
		if (slice === null || scope() !== null) return hit;
		const caps = source.sectionSources(true);
		if (caps.length === 0) return hit;
		return regionSectionHit(ray, caps, slice, hit) ?? hit;
	};
}

/** The same section loops the Stage draws, attributed to the owning slab edge. */
function regionSectionHit(
	pointer: PointerRay,
	inputs: Parameters<typeof sectionForSlice>[0],
	slice: ResolvedSlice,
	occluder: SceneRenderedHit | null
): SceneRenderedHit | null {
	const { result, basis } = sectionForSlice(inputs, slice);
	if (result.groups.length === 0) return null;
	const origin = new Vector3(...basis.origin);
	const normal = new Vector3(...basis.normal);
	const ray = new Ray(new Vector3(...pointer.origin), new Vector3(...pointer.direction));
	const point = ray.intersectPlane(new Plane().setFromNormalAndCoplanarPoint(normal, origin), new Vector3());
	if (point === null) return null;
	const distanceMeters = ray.origin.distanceTo(point);
	if (occluder && distanceMeters >= occluder.distanceMeters) return null;
	const local = point.clone().sub(origin);
	const sectionPoint: LayoutVec2 = [local.dot(new Vector3(...basis.u)), local.dot(new Vector3(...basis.v))];
	for (const group of result.groups) {
		if (group.issue !== null) continue;
		if (!capFillsOf(group.loops).some(({ outer, holes }) =>
			pointInPolygon(sectionPoint, outer) && !holes.some((hole) => pointInPolygon(sectionPoint, hole))
		)) continue;
		return {
			entityId: null, kind: 'layout', distanceMeters, worldPoint: point.toArray(),
			region: { regionId: group.group.slice('layout-region:'.length), surface: 'edge' }
		};
	}
	return null;
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
