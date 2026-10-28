<script lang="ts">
	/**
	 * The editor Stage's scene entities with a lazily loaded model renderer.
	 *
	 * The model renderer is the one Stage dependency that pulls a glTF loader and
	 * skeletal cloning; an enclosure-only Stage has no model to draw, so its first
	 * load never pays for those bytes. Deferring the chunk is an editor-only
	 * decision: the public visitor keeps the static renderer through
	 * `VisitorEntities`, whose first-load graph this component does not change.
	 *
	 * The fetch starts at idle rather than at the first model, so a cold placement
	 * does not have to wait for it, and a failed fetch retries instead of leaving
	 * an approved model permanently invisible.
	 */
	import type { ScenePickSource } from '$lib/authoring/scene/scene-pick-source';
	import type { RuntimeScene } from '$lib/content/scene';
	import type { LayoutRoomRegistry } from '@portfolio/project-model';
	import VisitorEntityGroups from '$lib/visitor/VisitorEntityGroups.svelte';

	type AssetModelComponent = typeof import('$lib/museum/assets/AssetModel.svelte')['default'];

	let {
		scene,
		rooms,
		modelUrls = null,
		onFormRendererReady,
		scenePick
	}: {
		scene: RuntimeScene;
		rooms: LayoutRoomRegistry;
		/** Resolved approved creator-model bytes, owned by the route's session. */
		modelUrls?: ReadonlyMap<string, string> | null;
		/** Notify the Stage shadow owner after the lazy form mesh has mounted. */
		onFormRendererReady: () => void;
		scenePick: ScenePickSource;
	} = $props();

	let ModelComponent = $state<AssetModelComponent | null>(null);
	$effect(() => {
		if (ModelComponent !== null) return;
		let cancelled = false;
		let attempt = 0;
		let timer: ReturnType<typeof setTimeout> | null = null;
		const load = (): void => {
			void import('$lib/museum/assets/AssetModel.svelte')
				.then((module) => {
					if (!cancelled) ModelComponent = module.default;
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

<VisitorEntityGroups {scene} {rooms} {modelUrls} {onFormRendererReady} Model={ModelComponent} onEntityRoot={scenePick.register} />
