<script lang="ts">
	/**
	 * A Canvas owner around the real Layout shell, for component tests.
	 *
	 * `VisitorLayoutShell` leases from the Canvas's render resources, and the Canvas
	 * host is what provides them, so a test that mounted the shell alone would be
	 * testing a state the product never creates. `provideRenderResources` here is
	 * the same call `StageCanvas` makes.
	 */
	import type { CompiledLayoutGeometry } from '@portfolio/layout-core/geometry';
	import VisitorLayoutShell from '$lib/visitor/VisitorLayoutShell.svelte';
	import { provideRenderResources } from '$lib/render/resources/render-resources';

	let {
		geometry,
		liftedRoomIds = []
	}: {
		geometry: CompiledLayoutGeometry;
		liftedRoomIds?: readonly string[];
	} = $props();

	provideRenderResources();
</script>

<VisitorLayoutShell {geometry} plinth={false} doorFrames={false} {liftedRoomIds} />
