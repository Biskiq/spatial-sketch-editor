<script lang="ts">
	/**
	 * The Stage's Finish picture host (U1).
	 *
	 * It gives the Finish picture service the E7 inspection host on the Stage's
	 * **existing** renderer: no second GPU context. The host draws each sample
	 * tile into its own offscreen target, one job at a time, and only when a
	 * shelf or the active Library detail asks, so an idle Stage pays nothing. It is attached to the live
	 * renderer generation on demand and detached when the generation changes or
	 * this component leaves.
	 */
	import { onMount } from 'svelte';
	import { useCanvasRendererState } from '$lib/render/renderer-context';
	import { useRenderResources } from '$lib/render/resources/render-resources';
	import { createInspectionHost } from '$lib/render/materials/inspection-host';
	import { tryUseFinishTiles } from '$lib/authoring/look/finish-tiles-context';
	import type { FinishTileInspect, FinishTileRender } from '$lib/render/materials/finish-tiles.svelte';

	const rendererState = useCanvasRendererState();
	const resources = useRenderResources();
	const tiles = tryUseFinishTiles();

	const host = createInspectionHost({ materials: resources.materials, lights: resources.lights });
	let attachedGeneration = -1;

	/** Follow the ready generation; a recovered renderer is a new one. */
	function attach(): boolean {
		const { renderer, backend, generation, viewGeneration } = rendererState;
		if (renderer === null || backend === null) return false;
		if (attachedGeneration !== generation) {
			host.attach({ renderer, backend, viewGeneration: { ...viewGeneration } });
			attachedGeneration = generation;
		}
		return true;
	}

	const render: FinishTileRender = async (request, signal) => {
		if (!attach()) return { status: 'refused', issues: [{ code: 'renderer-unavailable' }] };
		return host.thumbnail({ subject: request.subject, sampleTile: request.framing }, signal);
	};

	/** The one interactive inspection: Library detail or the draft editor, released on stop. */
	const inspect: FinishTileInspect = (request, onState) => {
		if (!attach()) {
			onState({ status: 'refused', issues: [{ code: 'renderer-unavailable' }] });
			return () => {};
		}
		return host.observe(request, onState);
	};

	onMount(() => {
		const unregister = tiles?.registerRenderer(render);
		const unregisterInspector = tiles?.registerInspector(inspect);
		return () => {
			unregister?.();
			unregisterInspector?.();
			host.dispose();
		};
	});
</script>
