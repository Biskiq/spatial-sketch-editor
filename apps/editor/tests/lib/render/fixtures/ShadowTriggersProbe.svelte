<script lang="ts">
	/** Provides the Canvas resources, then mounts the real Stage shadow-trigger wiring. */
	import StageShadowTriggers from '$lib/authoring/stage/shell/StageShadowTriggers.svelte';
	import { provideRenderResources } from '$lib/render/resources/render-resources';
	import { provideCanvasRendererState } from '$lib/render/renderer-context';
	import { countingRenderer } from '../../authoring/fixtures/threlte-counting-context';
	import { probeHandles, probeInput } from './shadow-probe-input.svelte';

	probeHandles.resources = provideRenderResources();
	const rendererState = provideCanvasRendererState();
	rendererState.backend = 'webgl2';
	rendererState.renderer = countingRenderer as never;
	// The Stage passes its Canvas props as one spread object that is rebuilt on any
	// shell change, a Sky edit included; `rebuild` models that with equal values.
	const props = $derived.by(() => {
		void probeInput.rebuild;
		return {
			geometry: probeInput.geometry,
			scene: probeInput.scene,
			modelUrls: probeInput.modelUrls,
			formRenderRevision: probeInput.formRenderRevision
		};
	});
</script>

<StageShadowTriggers {...props} />
