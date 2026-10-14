import {
	resolveSceneDocument as resolveCore,
	type RuntimeScene
} from '@portfolio/project-model';
import { MUSEUM_SCENE_VALIDATION_OPTIONS } from './scene-validation';

export * from '@portfolio/project-model';

/**
 * App-side resolution seam.
 *
 * PR #115 (WP3): the Scene reader is current-format-only and a current-format
 * Scene carries no Room ownership, so there is no Room registry to pass — the
 * values are already project/world coordinates.
 *
 * PR #115 (WP3R): the consumer-less `placementToModelEntity` catalogue adapter
 * is gone (it built a `roomId`, which the current Scene format forbids), and so
 * is the orphaned `getNode` re-export — consumers import `getNode` from
 * `@portfolio/camera-core` directly. The alias is retained because this module
 * is the app's catalogue-configured Scene seam for the retained product and its
 * tests.
 */
export function resolveSceneDocument(input: unknown): RuntimeScene {
	return resolveCore(input, MUSEUM_SCENE_VALIDATION_OPTIONS);
}
