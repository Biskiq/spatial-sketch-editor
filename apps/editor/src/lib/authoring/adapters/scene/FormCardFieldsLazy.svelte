<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { StageAdapterServices } from '$lib/authoring/stage/stage-adapter-host';
	let { services,
		detailOpen = false,
		footer, secondary
	}: { services: StageAdapterServices;
		detailOpen?: boolean;
		footer?: Snippet; secondary?: Snippet<[Snippet?]>;
	} = $props();
</script>

{#await import('./FormCardFields.svelte') then { default: Fields }}
	<Fields {services} {detailOpen} {footer} {secondary} />
{:catch}
	<p role="alert">Form fields could not load. Close and reopen the Card to retry.</p>
{/await}
