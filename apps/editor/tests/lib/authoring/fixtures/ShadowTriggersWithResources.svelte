<script lang="ts">
	/** Test host: the Canvas resources the Stage provides, around the shadow wiring. */
	import type { CompiledLayoutGeometry } from '@portfolio/layout-core';
	import type { RuntimeScene } from '@portfolio/project-model';
	import StageShadowTriggers from '$lib/authoring/stage/shell/StageShadowTriggers.svelte';
	import { provideRenderResources } from '$lib/render/resources/render-resources';

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
</script>

<StageShadowTriggers {geometry} {scene} {modelUrls} {formRenderRevision} />
