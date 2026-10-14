import { getNode } from '@portfolio/camera-core';
import {
	resolveSceneDocument as resolveCore,
	type SceneModelEntity,
	type SceneObjectPlacement,
	type RuntimeScene
} from '@portfolio/project-model';
import { getAssetById } from './assets';
import { MUSEUM_SCENE_VALIDATION_OPTIONS } from './scene-validation';

export * from '@portfolio/project-model';
export { getNode };

/** Museum catalogue adapter retained at the app compatibility seam. */
export function placementToModelEntity(
	placement: SceneObjectPlacement,
	name?: string
): SceneModelEntity {
	const assetName = getAssetById(placement.assetId)?.name;
	return {
		kind: 'model',
		id: placement.id,
		name: name?.trim() || assetName || placement.id,
		roomId: placement.roomId,
		assetId: placement.assetId,
		fallback: placement.fallback,
		position: placement.position,
		rotation: placement.rotation,
		...(placement.scale === undefined ? {} : { scale: placement.scale })
	};
}

/**
 * App-side resolution seam.
 *
 * PR #115 (WP3): the Scene reader is current-format-only and a current-format
 * Scene carries no Room ownership, so there is no Room registry to pass — the
 * values are already project/world coordinates.
 */
export function resolveSceneDocument(input: unknown): RuntimeScene {
	return resolveCore(input, MUSEUM_SCENE_VALIDATION_OPTIONS);
}
