/**
 * E7 — one render-resource owner per Canvas.
 *
 * `renderer-refactor.md` §2 makes layers 4–6 exist **once per Canvas**, because
 * WebGL objects cannot be shared across contexts. E6 created the material store
 * inside the Layout shell, which worked while the Layout was its only consumer;
 * E7 adds Scene entities as a sibling of that shell, so ownership moves up to the
 * Canvas host and both families lease from the same two stores.
 *
 * This is still one owner, not a second authority: `MaterialStore` remains the
 * only material factory and `GeometryStore` the only geometry owner. The context
 * exists so a deep component (`MuseumMaterial`, a door portal, a fallback body)
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
import { createMaterialStore, type MaterialStore } from './material-store';
import { createCasterChannel, type CasterChannel } from './caster-channel';

export type RenderResources = {
	/** The Canvas's one material factory. */
	readonly materials: MaterialStore;
	/** The Canvas's one geometry owner. */
	readonly geometry: GeometryStore;
	/** The Canvas's caster arrivals and animation state (E8/G4). */
	readonly casters: CasterChannel;
	/** Dispose the stores and the channel. Idempotent. */
	dispose(): void;
};

const KEY = Symbol('biskiq.render-resources');

/**
 * Create the Canvas's stores and publish them to its subtree.
 *
 * Call during component initialisation, in the component that owns the Canvas.
 */
export function provideRenderResources(): RenderResources {
	const materials = createMaterialStore();
	const geometry = createGeometryStore();
	const casters = createCasterChannel();
	let disposed = false;
	const resources: RenderResources = {
		materials,
		geometry,
		casters,
		dispose() {
			if (disposed) return;
			disposed = true;
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
