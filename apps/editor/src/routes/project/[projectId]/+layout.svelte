<script lang="ts">
	import { page } from '$app/state';
	import type { Snippet } from 'svelte';

	let { children }: { children: Snippet } = $props();
</script>

<!--
	One mounted project is one identity. The project route reads its id once, so moving
	from one project to another (Return to object, a Place copy destination) must remount
	it instead of reusing the previous project's session.
-->
{#key page.params.projectId}
	{@render children()}
{/key}
