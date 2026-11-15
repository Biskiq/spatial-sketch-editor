<script lang="ts">
	/**
	 * E7's visit bench surface.
	 *
	 * It is the visitor's world-rendering path — the same renderer callback,
	 * `PCFShadowMap`, `NoToneMapping`, `WorldEnvironment`, `VisitorLayoutShell`,
	 * `VisitorEntities`, ambient fill and lit ground — with a bench-owned camera.
	 * It deliberately excludes the visitor HUD and the Camera input director so a
	 * frame-time run measures rendering and shadow work; the real
	 * `VisitorPreviewSurface` is mounted separately for the cold-start baseline.
	 */
	import { T, Canvas } from '@threlte/core';
	import { onDestroy } from 'svelte';
	import { PCFShadowMap, type PerspectiveCamera } from 'three';
	import { CANVAS_TONE_MAPPING, previewCanvasRenderer } from '$lib/render/canvas-renderers';
	import { provideRenderResources } from '$lib/render/resources/render-resources';
	import WorldEnvironment from '$lib/render/WorldEnvironment.svelte';
	import VisitorLayoutShell from '$lib/visitor/VisitorLayoutShell.svelte';
	import VisitorEntities from '$lib/visitor/VisitorEntities.svelte';
	import { benchEye, type BenchWorld } from './worlds';

	let {
		world,
		shadows = true,
		camera = $bindable(undefined)
	}: {
		world: BenchWorld;
		/** The shadow-cost control: the shipped setting is PCF with the Sun casting. */
		shadows?: boolean;
		camera?: PerspectiveCamera | undefined;
	} = $props();

	const resources = provideRenderResources();
	onDestroy(() => resources.dispose());
	const eye = benchEye(world, 0);
</script>

<div class="surface">
	<Canvas
		createRenderer={previewCanvasRenderer}
		dpr={[1, 1]}
		renderMode="always"
		shadows={shadows ? PCFShadowMap : false}
		toneMapping={CANVAS_TONE_MAPPING}
	>
		<T.PerspectiveCamera
			bind:ref={camera}
			makeDefault
			position={eye}
			fov={world.camera.fovYDegrees}
			near={0.1}
			far={500}
		/>
		<T.AmbientLight intensity={0.12} />
		<WorldEnvironment preset="daylight" bounds={world.bounds} />
		<VisitorLayoutShell geometry={world.geometry} />
		<VisitorEntities scene={world.scene} />
	</Canvas>
</div>

<style>
	.surface {
		width: 1280px;
		height: 720px;
		background: #e9ebe6;
	}
</style>
