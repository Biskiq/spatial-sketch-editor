/**
 * Approved floor contact for one Scene model entity.
 *
 * Both Scene Compose and Layout's resting-object disclosure read this number.
 * It comes from the accepted envelope's `model` resource (creator imports) or
 * the verified catalogue record, never from a live mesh bound. Keeping it in
 * this neutral authoring module avoids a Layout → Scene-adapter dependency
 * while leaving one authority for the metadata.
 */
import type { SceneEntity } from '@portfolio/project-model/scene';
import type { ProjectEnvelope } from '@portfolio/project-model/units';
import { catalogueModelContactMinY } from '$lib/authoring/scene/object-definition-policy';

export function sceneModelContactMinY(
	envelope: ProjectEnvelope,
	entity: SceneEntity,
): number | null {
	if (entity.kind !== 'model') return null;
	for (const resource of envelope.units.resources.data.resources) {
		if (
			resource.kind === 'model' &&
			resource.id === entity.assetId &&
			resource.model !== undefined
		) {
			return resource.model.placement.contactMinY;
		}
	}
	return catalogueModelContactMinY(entity.assetId);
}
