/**
 * The Scene look facade.
 *
 * The resolver itself lives in `./scene-finish`, which projects the canonical
 * `pbr-metallic-roughness/v1` contract. This module keeps the established import
 * path for the Stage, Layout, model remap and the look golden; it adds no second
 * resolution.
 */
export {
	sceneFinishFor,
	sceneLookFor,
	resolveSceneMaterial,
	projectSceneLook,
	mappingMetric,
	type EffectiveSceneMaterial,
	type LookSource,
	type ResolveTarget,
	type SceneFinishGeometry,
	type SceneFinishLook,
	type SceneLook,
} from './scene-finish';
