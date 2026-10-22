<script lang="ts">
	import type { VisitorRuntimeState } from '$lib/visitor/visitor-runtime-state.svelte';

	let { visitor }: { visitor: VisitorRuntimeState } = $props();
</script>

<p data-testid="view">{visitor.currentViewId ?? 'none'}</p>
<p data-testid="phase">{visitor.state.phase}</p>
<p data-testid="selected">{visitor.state.presentationId ?? 'none'}</p>
