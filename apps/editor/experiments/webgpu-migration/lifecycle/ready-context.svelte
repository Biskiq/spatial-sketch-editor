<script lang="ts">
	/**
	 * The ready-gated candidate's Threlte context.
	 *
	 * The host binds its own DOM canvas and awaits `init()` before this component
	 * exists. `createThrelteContext` is the exported core seam the plan names: it
	 * supplies the camera, task, resize, disposal and scheduler contexts, and this
	 * component hands it a synchronous `createRenderer` for the exact canvas that
	 * was initialized. Threlte still owns resize, tasks and scheduling; only the
	 * DOM element and the init ordering differ from the stock Canvas.
	 */
	import { createThrelteContext } from '@threlte/core';
	import { NoToneMapping, PCFShadowMap } from 'three';
	import type { Snippet } from 'svelte';
	import type { HostRenderer } from './host-types';

	let {
		canvas,
		dom,
		renderer,
		renderMode = 'on-demand',
		children
	}: {
		canvas: HTMLCanvasElement;
		dom: HTMLElement;
		renderer: HostRenderer;
		renderMode?: 'always' | 'on-demand' | 'manual';
		children: Snippet;
	} = $props();

	createThrelteContext(() => ({
		canvas,
		dom,
		// The renderer in this generation is already initialized for this exact
		// canvas; the factory is synchronous, as Threlte's context requires.
		createRenderer: () => renderer as never,
		dpr: [1, 1.5] as [number, number],
		renderMode,
		shadows: PCFShadowMap,
		toneMapping: NoToneMapping
	}));
</script>

{@render children()}
