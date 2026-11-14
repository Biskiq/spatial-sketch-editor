import type { SceneValidationOptions } from '@portfolio/project-model';
import { getAssetById, isSceneObjectFallback } from './assets';
import { isMaterialId } from './materials';
import { isSafeTextureUri } from './texture-uri';

/** Product catalogue policy injected into the shared pure project model. */
export const CATALOGUE_SCENE_VALIDATION_OPTIONS = {
	isKnownAssetId: (assetId: string) => getAssetById(assetId) !== undefined,
	isKnownMaterialId: (materialId: string) => isMaterialId(materialId),
	isSceneObjectFallback,
	isSafeTextureUri
} satisfies SceneValidationOptions;
