<script lang="ts">
	import LayoutDimensionsInstrument from '$lib/authoring/adapters/layout/LayoutDimensionsInstrument.svelte';
	import type { StageAdapterServices } from '$lib/authoring/stage/stage-adapter-host';
	let { visible, services }: { visible: boolean; services: StageAdapterServices } = $props();
</script>
{#if visible}<LayoutDimensionsInstrument {services} />{/if}
