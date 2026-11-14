<script lang="ts">
	/**
	 * E9 — the Stage's Artwork placement ghost, drawn by the retained Artwork
	 * handler in its ghost state (translucent, no shadows) from the Canvas stores.
	 * It is the same realization the Scene uses, over one item, never a second
	 * renderer; it registers no pick root, as the component it replaces did not.
	 */
	import { T, useThrelte } from '@threlte/core';
	import type { SceneArtworkEntity } from '@portfolio/project-model';
	import type { ArtworkScope } from '$lib/render/artwork/artwork-scope';
	import { useRenderResources } from '$lib/render/resources/render-resources';
	import { createSceneArtworkRepresentation } from '$lib/render/scene-artwork-representation';
	import { describeSceneArtwork } from '$lib/render/scene-render-description';

	let { entity, scope, onError }: {
		entity: SceneArtworkEntity;
		scope: ArtworkScope | null;
		onError?: (message: string) => void;
	} = $props();

	const resources = useRenderResources();
	const { invalidate } = useThrelte();
	const ghost = createSceneArtworkRepresentation({
		store: resources.materials,
		geometry: resources.geometry,
		ghost: true,
		onArrival: () => invalidate(),
		onError: (message) => onError?.(message)
	});
	const items = $derived([describeSceneArtwork(entity)]);
	$effect(() => {
		const stats = ghost.update(items, scope);
		if (stats.rebodied + stats.moved + stats.released + stats.detached > 0) invalidate();
	});
	$effect(() => () => ghost.dispose());
</script>

<T is={ghost.object3d} />
