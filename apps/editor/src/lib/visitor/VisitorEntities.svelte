<script lang="ts">
	/**
	 * The visitor's scene renderer: grouping/material resolution plus the static
	 * model renderer. The public preview and the visitor path import this module,
	 * so its closure stays exactly what the preview boundary expects.
	 */
	import type { RuntimeScene } from '$lib/content/scene';
	import type { TextureLoadScope } from '$lib/museum/materials/texture-cache';
	import type { LayoutRoomRegistry } from '@portfolio/project-model';
	import AssetModel from '$lib/museum/assets/AssetModel.svelte';
	import VisitorEntityGroups from './VisitorEntityGroups.svelte';

	let {
		scene,
		rooms,
		textureScope = null,
		modelUrls = null
	}: {
		scene: RuntimeScene;
		rooms: LayoutRoomRegistry;
		textureScope?: TextureLoadScope | null;
		/**
		 * Runtime-safe approved model bytes: model resource id → derivative URL. The
		 * editor and Preview resolve them; this renderer never learns how.
		 */
		modelUrls?: ReadonlyMap<string, string> | null;
	} = $props();
</script>

<VisitorEntityGroups {scene} {rooms} {textureScope} {modelUrls} Model={AssetModel} />
