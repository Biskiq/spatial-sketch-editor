<script lang="ts">
	/**
	 * The stock-Threlte `<Canvas>` stand-in for the CanvasHost regression test.
	 *
	 * It keeps the one contract the host depends on: each mounted Canvas creates
	 * exactly one renderer through the host's factory. DOM/camera/DPR behaviour is
	 * Threlte's and is not under test here.
	 */
	import type { Snippet } from 'svelte';

	let {
		createRenderer,
		children
	}: {
		createRenderer: (canvas: HTMLCanvasElement) => unknown;
		children?: Snippet;
	} = $props();

	$effect(() => {
		createRenderer(document.createElement('canvas'));
	});
</script>

{#if children}
	{@render children()}
{/if}
