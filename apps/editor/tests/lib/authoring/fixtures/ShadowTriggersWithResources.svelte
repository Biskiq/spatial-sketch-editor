<script lang="ts">
	/** Test host: the Canvas resources the Stage provides, around the shadow wiring. */
	import type { CompiledLayoutGeometry } from '@portfolio/layout-core/geometry';
	import type { RuntimeScene } from '@portfolio/project-model/scene';
	import StageShadowTriggers from '$lib/authoring/stage/shell/StageShadowTriggers.svelte';
	import { provideRenderResources } from '$lib/render/resources/render-resources';
	import { provideCanvasRendererState } from '$lib/render/renderer-context';
	import { countingRenderer } from './threlte-counting-context';

	let {
		geometry,
		scene,
		modelUrls = null,
		formRenderRevision
	}: {
		geometry: CompiledLayoutGeometry;
		scene: RuntimeScene;
		modelUrls?: ReadonlyMap<string, string> | null;
		formRenderRevision: number;
	} = $props();

	provideRenderResources();
	// The Stage wiring reads the host's observed renderer; this harness provides
	// the record directly, with the counting renderer the mocked Canvas exposes.
	const rendererState = provideCanvasRendererState();
	rendererState.backend = 'webgl2';
	rendererState.renderer = countingRenderer as never;
</script>

<StageShadowTriggers {geometry} {scene} {modelUrls} {formRenderRevision} />
