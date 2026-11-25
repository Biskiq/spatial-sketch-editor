<script lang="ts">
	import StageLibrary from './StageLibrary.svelte';
	import type { LibraryView } from './library-view';

	let { view }: { readonly view: LibraryView } = $props();
</script>

{#if view.open && !view.previewing && view.lens === 'world' && view.available}
	{#key view.nonce}
		<StageLibrary {...view.props} />
	{/key}
{/if}
