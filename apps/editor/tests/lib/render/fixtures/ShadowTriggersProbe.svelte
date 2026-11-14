<script lang="ts">
	/** Provides the Canvas resources, then mounts the real Stage shadow-trigger wiring. */
	import StageShadowTriggers from '$lib/authoring/stage/shell/StageShadowTriggers.svelte';
	import { provideRenderResources } from '$lib/render/resources/render-resources';
	import { probeHandles, probeInput } from './shadow-probe-input.svelte';

	probeHandles.resources = provideRenderResources();
</script>

<StageShadowTriggers
	geometry={probeInput.geometry}
	scene={probeInput.scene}
	modelUrls={probeInput.modelUrls}
	formRenderRevision={probeInput.formRenderRevision}
/>
