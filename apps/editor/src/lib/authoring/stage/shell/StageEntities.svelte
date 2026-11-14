<script lang="ts">
	/**
	 * The editor Stage's scene entities with a lazily loaded model support.
	 *
	 * The model support is the one Stage dependency that pulls a glTF loader and
	 * skeletal cloning; an enclosure-only Stage has no model to draw, so its first
	 * load never pays for those bytes. Until it arrives every model draws its
	 * fallback from the retained Scene representation. Deferring the chunk is an
	 * editor-only decision: the public visitor keeps the static support through
	 * `VisitorEntities`, whose first-load graph this component does not change.
	 *
	 * The fetch starts at idle rather than at the first model, so a cold placement
	 * does not have to wait for it, and a failed fetch retries instead of leaving
	 * an approved model permanently invisible.
	 */
	import type { ScenePickSource } from '$lib/authoring/scene/scene-pick-source';
	import type { RuntimeScene } from '$lib/content/scene';
	import type { ArtworkScope } from '$lib/render/artwork/artwork-scope';
	import type { SceneModelSupport } from '$lib/render/scene-model-representation';
	import VisitorEntityGroups from '$lib/visitor/VisitorEntityGroups.svelte';

	let {
		scene,
		artworkScope = null,
		onArtworkError,
		modelUrls = null,
		onFormRendererReady,
		onEntityRenderable,
		scenePick,
		onEntityRoot,
		includeLights = true
	}: {
		scene: RuntimeScene;
		/** Resolved approved creator-model bytes, owned by the route's session. */
		artworkScope?: ArtworkScope | null;
		onArtworkError?: (message: string) => void;
		modelUrls?: ReadonlyMap<string, string> | null;
		/** Notify the Stage shadow owner after the lazy form mesh has mounted. */
		onFormRendererReady: () => void;
		/** Notify Paper after a model instance was drawn or restyled. */
		onEntityRenderable?: () => void;
		scenePick: ScenePickSource;
		/** Optional registration wrapper; Paper redraws when a Scene root arrives. */
		onEntityRoot?: (id: string, root: Parameters<ScenePickSource['register']>[1]) => () => void;
		includeLights?: boolean;
	} = $props();

	let modelSupport = $state.raw<SceneModelSupport | null>(null);
	$effect(() => {
		if (modelSupport !== null) return;
		let cancelled = false;
		let attempt = 0;
		let timer: ReturnType<typeof setTimeout> | null = null;
		const load = (): void => {
			void import('$lib/render/models/scene-model-support')
				.then((module) => {
					if (!cancelled) modelSupport = module.sceneModelSupport;
				})
				.catch(() => {
					// A transient chunk failure must not leave every model invisible; retry
					// a bounded number of times while this Stage stays mounted.
					attempt += 1;
					if (!cancelled && attempt < 3) timer = setTimeout(load, 2_000);
				});
		};
		const idle = setTimeout(load, 200);
		return () => {
			cancelled = true;
			clearTimeout(idle);
			if (timer !== null) clearTimeout(timer);
		};
	});
</script>

<VisitorEntityGroups {scene} {artworkScope} {onArtworkError} {modelUrls} {onFormRendererReady} {includeLights} {modelSupport} onModelDrawn={() => onEntityRenderable?.()} onEntityRoot={onEntityRoot ?? scenePick.register} />
