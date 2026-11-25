<script lang="ts">
	import type { ComponentProps } from 'svelte';
	import StudioWorldRegions from '$lib/authoring/studio/StudioWorldRegions.svelte';

	let props: ComponentProps<typeof StudioWorldRegions> = $props();
</script>

<StudioWorldRegions {...props} />
