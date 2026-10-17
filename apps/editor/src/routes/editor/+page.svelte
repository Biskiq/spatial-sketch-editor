<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { createProjectId } from '$lib/platform/project-persistence';

	onMount(() => {
		// `/editor` mints a fresh project id, so its address carries the create intent:
		// the route host reads it to offer the starter gallery on an absent row instead
		// of reporting a project that was never started.
		void goto(`/project/${encodeURIComponent(createProjectId())}/spatial?create=1`, { replaceState: true });
	});
</script>

<svelte:head>
	<title>Museum editor</title>
</svelte:head>

<main class="redirecting" aria-live="polite">Opening Spatial…</main>

<style>
	.redirecting { display: grid; min-height: 100dvh; place-items: center; color: #bcb5c4; background: #111117; font-family: Inter, ui-sans-serif, system-ui, sans-serif; }
</style>
