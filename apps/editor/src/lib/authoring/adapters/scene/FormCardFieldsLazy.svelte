<script lang="ts">
	import type { StageAdapterServices } from '$lib/authoring/stage/stage-adapter-host';
	let { services }: { services: StageAdapterServices } = $props();
</script>

{#await import('./FormCardFields.svelte') then { default: Fields }}
	<Fields {services} />
{:catch}
	<p role="alert">Form fields could not load. Close and reopen the Card to retry.</p>
{/await}
