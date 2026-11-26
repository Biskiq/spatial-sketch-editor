import { resolveSceneSurfaceFinish } from '@portfolio/project-model/scene-surface-reference';
import type { RuntimeScene } from '@portfolio/project-model/scene';
import type { SceneTreatment } from '@portfolio/project-model/units';
import { sceneFinishFor } from '$lib/render/materials/scene-instance-material';
import type { SceneSurfaceLook, SceneSurfaceRef } from './surface-look';

/** Resolve one Scene assignment through the same catalogue/instance look used by entities. */
export function resolveSceneSurfaceLook(
	scene: RuntimeScene,
	surface: SceneSurfaceRef,
	treatment: SceneTreatment | undefined,
): SceneSurfaceLook | null {
	const assignment = resolveSceneSurfaceFinish(scene, surface);
	if (assignment === null) return null;
	const target =
		'materialId' in assignment.finish
			? { materialInstanceId: null, fallbackCatalogueId: assignment.finish.materialId }
			: {
					materialInstanceId: assignment.finish.materialInstanceId,
					fallbackCatalogueId: 'plaster-warm' as const,
				};
	const finishKey =
		'materialId' in assignment.finish
			? `curated:${assignment.finish.materialId}`
			: `project:${assignment.finish.materialInstanceId}`;
	const sceneWithTreatment =
		treatment === scene.environment?.treatment
			? scene
			: { ...scene, environment: { ...(scene.environment ?? {}), treatment } };
	// Scene surfaces are metre charts (Forms, Walls, Room floor/lid and Region
	// faces). One native UV unit is one metre; the canonical plan supplies the
	// per-mapping repeat and rotation.
	return {
		...sceneFinishFor(sceneWithTreatment, target, {
			kind: 'metric',
			uvMeters: [1, 1],
			surfaceMeters: [1, 1],
		}),
		finishKey,
	};
}
