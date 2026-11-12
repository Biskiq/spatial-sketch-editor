import { pointerRay, projectWorld, type ViewingIntent, type ViewportEvaluation } from '@portfolio/camera-core';
import type { RuntimeScene } from '@portfolio/project-model';
import type { ScenePickSource } from '../scene/scene-pick-source';

/** Resolve the nearest drawn surface before asking whether it can anchor zoom. */
export function stageWheelZoom(
	scale: number,
	css: readonly [number, number],
	evaluation: ViewportEvaluation | null,
	scene: RuntimeScene,
	pick: ScenePickSource['pick']
): Extract<ViewingIntent, { kind: 'zoom' }> {
	const zoom = { kind: 'zoom', scale } as const;
	if (evaluation?.renderedReading !== '3d') return zoom;
	const ray = pointerRay(css, evaluation, evaluation.token);
	if (ray.kind !== 'ray') return zoom;
	const hit = pick(ray.ray, scene);
	if (hit === null || (hit.wallId === undefined &&
		!scene.entities.some((entity) => entity.id === hit.entityId && entity.kind === 'artwork'))) return zoom;
	const projected = projectWorld(hit.worldPoint, evaluation, evaluation.token);
	return projected.kind === 'projected' && projected.visibility === 'visible'
		? { ...zoom, anchor: hit.worldPoint }
		: zoom;
}
