<script lang="ts">
	import LayoutCardFields from '$lib/authoring/adapters/layout/LayoutCardFields.svelte';
	import type { StageAdapterServices } from '$lib/authoring/stage/stage-adapter-host';
	let { visible, services }: { visible: boolean; services: StageAdapterServices } = $props();
</script>
{#if visible}<LayoutCardFields {services} />{/if}
