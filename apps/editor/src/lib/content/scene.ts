import { resolveSceneDocument as resolveCore, type RuntimeScene } from '@portfolio/project-model/scene';
import { CATALOGUE_SCENE_VALIDATION_OPTIONS } from './scene-validation';


/**
 * App-side resolution seam.
 *
 * The Scene reader is current-format-only and a current-format Scene carries
 * no Room ownership, so there is no Room registry to pass — the values are
 * already project/world coordinates. This module is the app's
 * catalogue-configured Scene seam; `getNode` comes from `@portfolio/camera-core`
 * directly.
 */
export function resolveSceneDocument(input: unknown): RuntimeScene {
	return resolveCore(input, CATALOGUE_SCENE_VALIDATION_OPTIONS);
}
