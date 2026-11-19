import { resolveSceneSurfaceFinish } from '@portfolio/project-model/scene-surface-reference';
import type { RuntimeScene, SceneTreatment } from '$lib/content/scene';
import { sceneLookFor } from '$lib/render/materials/scene-instance-material';
import type { SceneSurfaceLook, SceneSurfaceRef } from './surface-look';

/** Resolve one Scene assignment through the same catalogue/instance look used by entities. */
export function resolveSceneSurfaceLook(
	scene: RuntimeScene,
	surface: SceneSurfaceRef,
	treatment: SceneTreatment | undefined
): SceneSurfaceLook | null {
	const assignment = resolveSceneSurfaceFinish(scene, surface);
	if (assignment === null) return null;
	const target = 'materialId' in assignment.finish
		? { materialInstanceId: null, fallbackCatalogueId: assignment.finish.materialId }
		: { materialInstanceId: assignment.finish.materialInstanceId, fallbackCatalogueId: 'plaster-warm' as const };
	const sceneWithTreatment = treatment === scene.environment?.treatment
		? scene
		: { ...scene, environment: { ...(scene.environment ?? {}), treatment } };
	return sceneLookFor(sceneWithTreatment, target, [1, 1]);
}
