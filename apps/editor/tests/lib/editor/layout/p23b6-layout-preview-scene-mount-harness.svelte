<script lang="ts">
	import LayoutPreviewScene from '$lib/editor/layout/LayoutPreviewScene.svelte';
	import type { LayoutInteractionState } from '$lib/editor/layout/layout-interaction';
	import type { LayoutPreviewState } from '$lib/editor/layout/layout-preview-state.svelte';
	import { untrack } from 'svelte';

	export type LayoutPreviewSceneInputs = Pick<
		LayoutPreviewState,
		'model' | 'geometry' | 'wallMeshesByRoom' | 'wallMeshesByWall'
	>;

	let { initial, interaction } = $props<{
		initial: LayoutPreviewSceneInputs;
		interaction: LayoutInteractionState;
	}>();
	let source = $state.raw(untrack(() => initial));
	let in3d = $state(true);

	export function replace(next: LayoutPreviewSceneInputs): void {
		source = next;
	}

	export function show3d(visible: boolean): void {
		in3d = visible;
	}
</script>

{#if in3d}
	<LayoutPreviewScene
		model={source.model}
		geometry={source.geometry}
		wallMeshesByRoom={source.wallMeshesByRoom}
		wallMeshesByWall={source.wallMeshesByWall}
		{interaction}
	/>
{/if}
