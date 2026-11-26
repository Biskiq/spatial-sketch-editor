/**
 * Authored Scene lights, resolved: Scene in, frozen light items out.
 *
 * The light half of the resolved look. Each authored Point or Spot becomes one
 * item — its placement and a `LightDescriptor` in the approved light units — and nothing
 * here builds a Three object. The Canvas light store realizes the descriptors;
 * the light representation places them.
 *
 * Memoised by the accepted `RuntimeScene` identity, as the Scene render
 * description is: an edit that does not touch Scene (a Camera move, a Layout
 * accept, an Experience edit) hands back the same description object, and the
 * representation touches no light. Inside a changed Scene, an item's `key` and
 * `placementKey` let the representation tell a changed light from a moved one
 * from an unchanged one.
 *
 * Only Point and Spot exist: the authored Directional kind is retired
 * (Scene format 7) and the Sky owns the only Sun (`resolveSkySun`).
 */
import {
	isSceneLightEntity,
	type RuntimeScene,
	type SceneLightEntity,
} from '@portfolio/project-model/scene';
import {
	lightKey,
	PHYSICAL_LIGHT_DECAY,
	type PointLightDescriptor,
	type SpotLightDescriptor,
} from './resources/light-descriptor';
import type { SceneTransform } from './resources/scene-render-item';

export type SceneLightItem = {
	/** The authored entity id. */
	readonly id: string;
	/** The light's content key: an unchanged key is an unchanged light. */
	readonly key: string;
	readonly light: PointLightDescriptor | SpotLightDescriptor;
	/** The entity's placement: the light sits at its origin and a Spot aims down its −Z. */
	readonly transform: SceneTransform;
	readonly placementKey: string;
};

export type SceneLightDescription = {
	readonly items: readonly SceneLightItem[];
};

export const EMPTY_SCENE_LIGHT_DESCRIPTION: SceneLightDescription = Object.freeze({
	items: Object.freeze([]),
});

/** The descriptor an authored light resolves to. */
export function resolveSceneLight(
	entity: SceneLightEntity,
): PointLightDescriptor | SpotLightDescriptor {
	if (entity.light === 'point') {
		return {
			kind: 'point',
			color: entity.color,
			intensity: entity.intensity,
			distance: entity.range ?? 0,
			decay: PHYSICAL_LIGHT_DECAY,
			castShadow: entity.castShadow,
		};
	}
	return {
		kind: 'spot',
		color: entity.color,
		intensity: entity.intensity,
		distance: entity.range ?? 0,
		decay: PHYSICAL_LIGHT_DECAY,
		angle: entity.angle,
		penumbra: entity.penumbra ?? 0,
		castShadow: entity.castShadow,
	};
}

function itemOf(entity: SceneLightEntity): SceneLightItem {
	const light = resolveSceneLight(entity);
	const scale = entity.scale ?? 1;
	const transform: SceneTransform = {
		position: [entity.position[0], entity.position[1], entity.position[2]],
		rotation: [entity.rotation[0], entity.rotation[1], entity.rotation[2]],
		scale: [scale, scale, scale],
	};
	return Object.freeze({
		id: entity.id,
		key: lightKey(light),
		light: Object.freeze(light),
		transform: Object.freeze(transform),
		placementKey: `${transform.position.join(',')}|${transform.rotation.join(',')}|${scale}`,
	});
}

const described = new WeakMap<RuntimeScene, SceneLightDescription>();

/** The light items of `scene`, one conversion per Scene identity. */
export function describeSceneLights(scene: RuntimeScene): SceneLightDescription {
	const cached = described.get(scene);
	if (cached !== undefined) return cached;
	const items = scene.entities.filter(isSceneLightEntity).map(itemOf);
	const description: SceneLightDescription = Object.freeze({ items: Object.freeze(items) });
	described.set(scene, description);
	return description;
}
