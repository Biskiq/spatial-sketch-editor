<script lang="ts">
	/**
	 * The visitor's scene renderer: grouping/material resolution plus the static
	 * model support (glTF loader and realization). The public preview and the visitor path import this module,
	 * so its closure stays exactly what the preview boundary expects.
	 */
	import type { RuntimeScene } from '$lib/content/scene';
	import type { TextureLoadScope } from '$lib/render/resources/texture-store';
	import { sceneModelSupport } from '$lib/render/models/scene-model-support';
	import type { ArtworkScope } from '$lib/render/artwork/artwork-scope';
	import VisitorEntityGroups from './VisitorEntityGroups.svelte';

	let {
		scene,
		textureScope = null,
		artworkScope = null,
		onArtworkError,
		modelUrls = null,
		includeLights = true
	}: {
		scene: RuntimeScene;
		textureScope?: TextureLoadScope | null;
		/**
		 * Runtime-safe approved model bytes: model resource id → derivative URL. The
		 * editor and Preview resolve them; this renderer never learns how.
		 */
		artworkScope?: ArtworkScope | null;
		onArtworkError?: (message: string) => void;
		modelUrls?: ReadonlyMap<string, string> | null;
		/** Paper is an editor-only reading: it never draws authored lights. */
		includeLights?: boolean;
	} = $props();
</script>

<VisitorEntityGroups {scene} {artworkScope} {onArtworkError} {textureScope} {modelUrls} {includeLights} modelSupport={sceneModelSupport} />
