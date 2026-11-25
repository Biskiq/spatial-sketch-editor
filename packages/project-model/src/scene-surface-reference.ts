/** Runtime-safe lookup for Scene-owned Finish assignments by canonical Layout identity. */
import { surfaceKey } from '@portfolio/layout-core/plan';
import type { RuntimeScene, SceneSurfaceFinish, SceneSurfaceRef } from './scene';

export function resolveSceneSurfaceFinish(
	scene: Pick<RuntimeScene, 'surfaceFinishes'>,
	surface: SceneSurfaceRef
): SceneSurfaceFinish | null {
	const key = surfaceKey(surface);
	return scene.surfaceFinishes?.find((assignment) => surfaceKey(assignment.surface) === key) ?? null;
}
