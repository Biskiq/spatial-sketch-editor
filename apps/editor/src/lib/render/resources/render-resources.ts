/**
 * One render-resource owner per Canvas.
 *
 * The rendering contract (`docs/reference/components/rendering.md`) makes the
 * render resources exist **once per Canvas**, because
 * WebGL objects cannot be shared across contexts. The Canvas host (the Stage
 * canvas or the visitor preview surface) calls `provideRenderResources` once, and
 * the Layout shell and the Scene entities, which are siblings under it, lease
 * from the same stores.
 *
 * This is one owner, not a second authority: `MaterialStore` is the only
 * material factory, `GeometryStore` the only geometry owner and `LightStore` the
 * only realizer of a world light. The context
 * exists so a deep component (`CatalogueMaterial`, a door portal, a fallback body)
 * reaches the Canvas's stores without threading a prop through every world
 * component. Mounting world content without a Canvas owner is a programming
 * error, and says so.
 *
 * Disposal is idempotent and safe in either order with the representations: a
 * representation releases its leases when it is destroyed, and the stores dispose
 * anything still held. No lease can free a resource another Canvas owns.
 */
import { getContext, setContext } from 'svelte';
import { createGeometryStore, type GeometryStore } from './geometry-store';
import { createMaterialStore, type MaterialStore, type MaterialStoreOptions } from './material-store';
import { createCasterChannel, type CasterChannel } from './caster-channel';
import { createLightStore, type LightStore } from './light-store';

export type RenderResources = {
	/** The Canvas's one material factory. */
	readonly materials: MaterialStore;
	/** The Canvas's one geometry owner. */
	readonly geometry: GeometryStore;
	/** The Canvas's caster arrivals and animation state. */
	readonly casters: CasterChannel;
	/** The Canvas's one light realizer: authored Point/Spot and the Sky's Sun. */
	readonly lights: LightStore;
	/** Dispose the stores and the channel. Idempotent. */
	dispose(): void;
};

const KEY = Symbol('biskiq.render-resources');

/**
 * Create the Canvas's stores and publish them to its subtree.
 *
 * Call during component initialisation, in the component that owns the Canvas.
 *
 * `options.clippingPlanes` is the Stage's slice clipping array, forwarded to the
 * material store so every colour material shares it by reference. The Preview
 * Canvas passes nothing, so its store never clips.
 */
export function provideRenderResources(options: MaterialStoreOptions = {}): RenderResources {
	const materials = createMaterialStore(options);
	const geometry = createGeometryStore();
	const casters = createCasterChannel();
	const lights = createLightStore();
	let disposed = false;
	const resources: RenderResources = {
		materials,
		geometry,
		casters,
		lights,
		dispose() {
			if (disposed) return;
			disposed = true;
			lights.dispose();
			casters.dispose();
			geometry.dispose();
			materials.dispose();
		}
	};
	setContext(KEY, resources);
	return resources;
}

/** The nearest Canvas's stores. Throws outside a Canvas owner. */
export function useRenderResources(): RenderResources {
	const resources = getContext<RenderResources | undefined>(KEY);
	if (resources === undefined) {
		throw new Error(
			'render resources are missing: mount this world content inside StageCanvas or VisitorPreviewSurface'
		);
	}
	return resources;
}
