<script lang="ts">
	/**
	 * Scene entities in the world frame, shared by the editor Stage and the visitor.
	 *
	 * A Scene is world-local: every entity position is already project/world space,
	 * so entities render directly under the world root with no frame transform.
	 *
	 * Primitives, Forms, Artwork and models draw through the retained Scene entity
	 * representation (mounted once as `entities.object3d`, patched by item key);
	 * authored lights draw through the retained Scene light representation. Exactly
	 * one path draws any given entity, so nothing renders twice.
	 *
	 * The model support (glTF loader and skeleton-aware realization) is a prop
	 * rather than an import: the public preview supplies it statically (unchanged
	 * first-load graph), while the editor Stage supplies a lazily loaded one. Until
	 * it arrives every model draws its fallback. Geometry and material resolution
	 * have exactly one implementation, so editor and visitor cannot drift.
	 */
	import type { Object3D } from 'three';
	import { T, useThrelte } from '@threlte/core';
	import type { RuntimeScene } from '$lib/content/scene';
	import { isSceneFormEntity } from '$lib/content/scene';
	import type { TextureLoadScope } from '$lib/render/resources/texture-store';
	import { useRenderResources } from '$lib/render/resources/render-resources';
	import { createSceneEntityRepresentation } from '$lib/render/scene-entity-representation';
	import type { SceneModelSupport } from '$lib/render/scene-model-representation';
	import {
		describeSceneRender,
		type SceneFormSupport
	} from '$lib/render/scene-render-description';
	import type { ArtworkScope } from '$lib/render/artwork/artwork-scope';
	import { createSceneLightRepresentation } from '$lib/render/scene-light-representation';
	import { describeSceneLights, EMPTY_SCENE_LIGHT_DESCRIPTION } from '$lib/render/scene-light-description';

	let {
		scene,
		textureScope = null,
		textureRevision = 0,
		artworkScope = null,
		onArtworkError,
		modelUrls = null,
		onFormRendererReady,
		onEntityRoot,
		/** Paper is an editor-only reading: it never draws authored Scene lights. */
		includeLights = true,
		modelSupport,
		onModelDrawn
	}: {
		scene: RuntimeScene;
		textureScope?: TextureLoadScope | null;
		/**
		 * Bumped after a targeted texture Retry. A changed value asks only the
		 * items whose textures did not arrive to load them again; a bound look is
		 * left alone.
		 */
		textureRevision?: number;
		artworkScope?: ArtworkScope | null;
		onArtworkError?: (message: string) => void;
		/** Runtime-safe approved model bytes: model resource id → derivative URL. */
		modelUrls?: ReadonlyMap<string, string> | null;
		/** Optional Stage-only notification after a Form body has been built. */
		onFormRendererReady?: () => void;
		/** Optional renderer lifecycle observer; no authoring behavior lives here. */
		onEntityRoot?: (id: string, root: Object3D) => (() => void) | void;
		/** The model support; `null` until a lazy host has fetched it. */
		modelSupport: SceneModelSupport | null;
		/** Optional Stage-only notification after a model instance was drawn or restyled. */
		onModelDrawn?: () => void;
		includeLights?: boolean;
	} = $props();

	/**
	 * The retained primitive/Form subtree: one root for the shell's whole
	 * lifetime, one group and mesh per drawable entity, patched by content key.
	 * Materials and geometry are leases on this Canvas's stores.
	 */
	const resources = useRenderResources();
	const { invalidate } = useThrelte();
	const entities = createSceneEntityRepresentation({
		store: resources.materials,
		geometry: resources.geometry,
		scope: () => textureScope,
		onRoot: (id, root) => onEntityRoot?.(id, root),
		// Read inside the update effect, so a replaced scope re-runs it.
		artworkScope: () => artworkScope,
		onArtworkArrival: () => {
			invalidate();
			onFormRendererReady?.();
		},
		onArtworkError: (message) => onArtworkError?.(message),
		casters: resources.casters,
		// Read inside the update effect, so an arriving support or new URLs re-run it.
		modelSupport: () => modelSupport,
		modelUrls: () => modelUrls,
		onModelDrawn: () => {
			invalidate();
			onModelDrawn?.();
		}
	});

	/**
	 * The Form kernel is fetched only once a document carries a form, so a project
	 * without forms never downloads the evaluator or its adapter. Until it arrives
	 * the description omits form items — the same visibility the lazy component
	 * mount had — and the next update builds them.
	 */
	let formSupport = $state<SceneFormSupport | null>(null);
	const hasForms = $derived(scene.entities.some(isSceneFormEntity));
	$effect(() => {
		if (formSupport !== null || !hasForms) return;
		let cancelled = false;
		let attempt = 0;
		let timer: ReturnType<typeof setTimeout> | null = null;
		const load = (): void => {
			void import('$lib/render/scene-form-support')
				.then((module) => {
					if (!cancelled) formSupport = module.sceneFormSupport;
				})
				.catch(() => {
					attempt += 1;
					if (!cancelled && attempt < 3) timer = setTimeout(load, 2_000);
				});
		};
		load();
		return () => {
			cancelled = true;
			if (timer !== null) clearTimeout(timer);
		};
	});

	/**
	 * One update per description identity. `describeSceneRender` memoises by the
	 * retained `RuntimeScene`, so an edit that does not touch Scene hands back the
	 * same description and the representation does nothing.
	 */
	$effect(() => {
		const description = describeSceneRender(scene, formSupport);
		const stats = entities.update(description);
		if (stats.forms > 0) onFormRendererReady?.();
		const art = stats.artworks;
		// A moved or rebuilt Artwork changed the frame imperatively; Threlte cannot see it.
		if (art.rebodied + art.moved + art.released + art.detached > 0) invalidate();
		const models = stats.models;
		// Built, moved, replaced or released models changed the frame imperatively.
		if (models.built + models.moved + models.replaced + models.refallbacked + models.released > 0) invalidate();
	});

	/** The revision whose retry has already been applied; the first effect run is a no-op. */
	let seenTextureRevision: number | null = null;
	$effect(() => {
		// Read the revision so a creator's Retry re-runs this effect. The initial
		// mount already asked for every item's textures in the update effect above.
		if (seenTextureRevision === null) {
			seenTextureRevision = textureRevision;
			return;
		}
		if (textureRevision === seenTextureRevision) return;
		seenTextureRevision = textureRevision;
		entities.reloadTextures();
	});

	$effect(() => () => entities.dispose());

	/**
	 * Authored Point and Spot lights: resolved once per Scene identity,
	 * realized by this Canvas's light store and placed by one retained root. An
	 * unrelated edit hands back the same description and touches no light; a
	 * changed light updates in place; a changed kind is replaced. Paper draws no
	 * authored light, so it releases them all.
	 */
	const lights = createSceneLightRepresentation({ lights: resources.lights });
	$effect(() => {
		const description = includeLights ? describeSceneLights(scene) : EMPTY_SCENE_LIGHT_DESCRIPTION;
		const stats = lights.update(description);
		if (stats.built + stats.updated + stats.moved + stats.released > 0) invalidate();
	});
	$effect(() => () => lights.dispose());
</script>

<!-- The retained Scene root (primitives, Forms, Artworks, models): mounted once, patched in place. -->
<T is={entities.object3d} />

<!-- The retained authored lights: mounted once, patched in place. -->
<T is={lights.object3d} />
